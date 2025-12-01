#!/usr/bin/env node
'use strict';
// Node.js Quick Test Script (cross-platform) for Marketplace service
// Usage: node scripts/quick-test.js [--mongo] [--port=3002] [--stripe] [--report]
// Ensure `npm install` was run. Stripe mode requires STRIPE env vars already set.

const { spawn } = require('child_process');
const http = require('http');

function parseArgs(){
  const args = process.argv.slice(2);
  const opts = { mongo:false, port:3002, stripe:false, report:false };
  for(const a of args){
    if(a === '--mongo') opts.mongo = true;
    else if(a === '--stripe') opts.stripe = true;
    else if(a.startsWith('--port=')) opts.port = Number(a.split('=')[1]);
    else if(a === '--report') opts.report = true;
  }
  return opts;
}

const opts = parseArgs();
const env = Object.assign({}, process.env, {
  MARKET_PORT: String(opts.port),
  MARKET_SEED_DEMO: '1',
  MARKET_ENABLE_FUZZY: '1',
  MARKET_FUZZY_THRESHOLD: '0.7',
  METRICS_ENABLED: '1',
  MARKET_REQUIRE_JWT: '0',
  MARKET_ALLOWED_DEV_FALLBACK: '1',
  LEDGER_ENABLED: process.env.LEDGER_ENABLED || (opts.stripe ? '1':'0')
});
if(!opts.mongo){ env.MARKET_ALLOW_DB_FAIL = '1'; } else {
  env.MARKET_MONGO_URL = env.MARKET_MONGO_URL || 'mongodb://127.0.0.1:27017/axiom_market';
  env.MARKET_CREATE_INDEXES_ON_START = '1';
}
if(opts.stripe){
  env.PAYMENT_PROVIDER = 'stripe';
  // Expect STRIPE_SECRET_KEY & STRIPE_WEBHOOK_SECRET already supplied in environment.
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function req(method, path, body){
  return new Promise(resolve => {
    const data = body ? JSON.stringify(body) : null;
    const options = { method, hostname:'localhost', port: opts.port, path, headers: { 'Authorization':'Bearer devUser123' } };
    if(data){ options.headers['Content-Type'] = 'application/json'; options.headers['Content-Length'] = Buffer.byteLength(data); }
    const req = http.request(options, res => {
      let chunks='';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); } catch(_) { resolve({ ok:false, raw:chunks }); }
      });
    });
    req.on('error', e => resolve({ ok:false, error:e.message }));
    if(data) req.write(data);
    req.end();
  });
}

async function waitForUp(retries=30){
  for(let i=0;i<retries;i++){
    const primary = await req('GET','/api/market/status'); // may not exist
    const alt = primary && primary.status==='ok' ? primary : await req('GET','/api/status');
    if(alt && alt.status === 'ok') return true;
    await sleep(500);
  }
  return false;
}

(async () => {
  console.log(`[quick-test-node] Starting server (port=${opts.port}, mongo=${opts.mongo}, stripe=${opts.stripe})`);
  const serverProc = spawn('node',['server.js'], { env, stdio:['ignore','pipe','pipe'] });
  serverProc.stdout.on('data', d => { const s=d.toString(); if(/Marketplace service running/.test(s)) console.log('[server] '+s.trim()); });
  serverProc.stderr.on('data', d => console.error('[server-err]', d.toString().trim()));

  const up = await waitForUp();
  if(!up){ console.error('Server did not become ready. Exiting.'); serverProc.kill(); process.exit(1); }

  // Create product (idempotent). Use ingest-required fields so creation succeeds and fuzzy search has a target.
  console.log('[step] Ingest product');
  const prod = await req('POST','/api/market/ingest/products',{
    countryCode: 'SA',
    vendorId: '101',
    categoryId: '07',
    name: 'Premium Marble Slab',
    thickness: '2 cm',
    material: 'marble',
    price: 111,
    currency: 'SAR'
  });

  // Add to cart
  console.log('[step] Add cart item');
  const cartSku = prod && prod.sku ? prod.sku : 'LP-MKT-SA-101-07-XXXX';
  const cartAdd = await req('POST','/api/market/cart',{ sku: cartSku, quantity:1 });

  // Create order
  console.log('[step] Create order');
  const order = await req('POST','/api/market/orders',{ currency:'SAR' });
  const orderId = order.id;

  // Search baseline
  console.log('[step] Baseline search');
  const searchOk = await req('GET', '/api/market/search?q=marble&limit=3');

  // Search failing -> fuzzy
  console.log('[step] Fuzzy trigger search');
  // Use misspelled query close enough for Fuse to match (premium -> premum)
  const searchFuzzy = await req('GET', '/api/market/search?q=xremum&limit=5');

  // Stripe intent (optional)
  let intent = null;
  let webhookResult = null;
  if(opts.stripe && orderId){
    console.log('[step] Create stripe intent');
    intent = await req('POST','/api/market/payments/intents',{ orderId });
    // Simulate webhook if secrets available
    if(process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY){
      try {
        console.log('[step] Simulate payment_intent.succeeded webhook');
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const fakeEvent = {
          id: 'evt_'+Math.random().toString(36).slice(2),
          object: 'event',
          type: 'payment_intent.succeeded',
          created: Math.floor(Date.now()/1000),
          data: { object: {
            id: intent.intentId || 'pi_'+Math.random().toString(36).slice(2),
            object: 'payment_intent',
            status: 'succeeded',
            amount_received: 11100,
            currency: 'sar',
            receipt_email: 'test@example.com',
            metadata: { orderId, userId: 'devUser123' }
          }},
          livemode: false
        };
        const payload = JSON.stringify(fakeEvent);
        const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
        webhookResult = await new Promise(resolve => {
          const options = { method:'POST', hostname:'localhost', port: opts.port, path:'/api/market/payments/webhook', headers:{ 'Content-Type':'application/json', 'stripe-signature': header } };
          const wreq = http.request(options, res => { let c=''; res.on('data',d=>c+=d); res.on('end',()=>{ try { resolve(JSON.parse(c)); } catch(_) { resolve({ ok:false, raw:c }); } }); });
          wreq.on('error', e => resolve({ ok:false, error:e.message }));
          wreq.write(payload);
          wreq.end();
        });
      } catch(e){ webhookResult = { ok:false, error:e.message }; }
    }
  }

  // Metrics snapshot
  console.log('[step] Metrics snapshot');
  const metricsRaw = await new Promise(r=>{
    http.get({ hostname:'localhost', port: opts.port, path:'/metrics' }, res => { let c=''; res.on('data',d=>c+=d); res.on('end',()=>r(c)); }).on('error',()=>r(''));
  });
  const metricsLines = metricsRaw.split('\n').filter(l => /search_fuzzy_|payment_ledger_events_total/.test(l)).slice(0,12);

  // Summary
  console.log('\n=== Summary (Node Quick Test) ===');
  console.log('Product response:', prod);
  console.log('Order response:', order);
  console.log('Baseline search total:', searchOk && searchOk.total);
  console.log('Fuzzy search flags: fallback=', !!(searchFuzzy && searchFuzzy.fallback), ' fuzzy=', !!(searchFuzzy && searchFuzzy.fuzzy), ' total=', searchFuzzy && searchFuzzy.total);
  if(intent) console.log('Stripe intent:', intent);
  if(webhookResult) console.log('Simulated webhook result:', webhookResult);
  console.log('Metrics lines:\n' + metricsLines.join('\n'));

  // HTML report (optional)
  if(opts.report){
    try {
      const fs = require('fs');
      const reportDir = 'reports';
      if(!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive:true });
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Quick Test Report</title><style>body{font-family:Arial;margin:20px;}h1{font-size:20px;}pre{background:#f5f5f5;padding:10px;border:1px solid #ddd;} .ok{color:green}.fail{color:#c00}</style></head><body>
      <h1>Marketplace Quick Test Report</h1>
      <h2>Summary</h2>
      <ul>
        <li>Order ID: ${orderId || 'N/A'}</li>
        <li>Baseline Search Total: ${searchOk && searchOk.total}</li>
        <li>Fuzzy Used: ${!!(searchFuzzy && searchFuzzy.fuzzy)}</li>
        <li>Stripe Intent: ${intent ? 'created' : 'none'}</li>
        <li>Webhook Simulated: ${webhookResult ? (webhookResult.ok ? 'success' : 'fail') : 'not attempted'}</li>
      </ul>
      <h2>Metrics (partial)</h2>
      <pre>${metricsLines.map(m=>m.replace(/</g,'&lt;')).join('\n')}</pre>
      <h2>Webhook Result</h2>
      <pre>${webhookResult ? JSON.stringify(webhookResult,null,2).replace(/</g,'&lt;') : 'N/A'}</pre>
      <h2>Search Fuzzy Response</h2>
      <pre>${JSON.stringify(searchFuzzy,null,2).replace(/</g,'&lt;')}</pre>
      </body></html>`;
      fs.writeFileSync(`${reportDir}/quick-test-report.html`, html, 'utf8');
      console.log(`[quick-test-node] HTML report written to ${reportDir}/quick-test-report.html`);
    } catch(e){ console.warn('[quick-test-node] Failed writing HTML report:', e.message); }
  }

  // Graceful shutdown
  console.log('\n[quick-test-node] Stopping server');
  serverProc.kill('SIGINT');
  setTimeout(()=>process.exit(0), 500);
})();
