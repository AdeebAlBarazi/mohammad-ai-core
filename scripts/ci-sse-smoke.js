/*
  Simple SSE smoke test: starts a stream to /api/ai/chat/stream
  and asserts that at least one meta event and one data chunk arrive.
*/
const http = require('http');

function postSSE({ host = '127.0.0.1', port = process.env.PORT || 3000, path = '/api/ai/chat/stream', body }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      host,
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    });

    let sawMeta = false;
    let sawData = false;
    req.on('response', (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        const str = chunk.toString();
        if (str.includes('event: meta')) sawMeta = true;
        if (str.includes('data: ') && !str.includes('event:')) sawData = true;
      });
      res.on('end', () => {
        if (!sawMeta) return reject(new Error('No meta event received'));
        if (!sawData) return reject(new Error('No data chunk received'));
        resolve({ sawMeta, sawData });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    const result = await postSSE({
      body: {
        prompt: 'Ping test: write one short sentence.',
        mode: 'default',
        sessionId: 'ci-smoke',
        maxTokens: 64,
      },
    });
    console.log('SSE smoke passed:', result);
    process.exit(0);
  } catch (err) {
    console.error('SSE smoke failed:', err.message);
    process.exit(1);
  }
})();
// Simple SSE smoke: ensure stream endpoint returns meta and some data
(async function(){
  try {
    const fetch = global.fetch || require('node-fetch');
    const url = 'http://localhost:' + (process.env.MARKET_PORT || 3002) + '/api/ai/chat/stream';
    const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Accept':'text/event-stream' }, body: JSON.stringify({ prompt:'سحب دخاني', sessionId:'ci-sse' }) });
    if(!res.ok){ console.error('[ci-sse] request failed', res.status); process.exit(2); }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf=''; let sawMeta=false; let sawData=false;
    for(;;){ const { value, done } = await reader.read(); if(done) break; buf += decoder.decode(value, { stream:true }); let idx; while((idx = buf.indexOf('\n\n')) !== -1){ const chunk = buf.slice(0, idx).trim(); buf = buf.slice(idx+2); if(!chunk) continue; const lines = chunk.split('\n'); for(const line of lines){ if(line.startsWith('event: meta')) sawMeta=true; if(line.startsWith('data: ')) sawData=true; } } }
    if(!sawMeta || !sawData){ console.error('[ci-sse] incomplete stream', { sawMeta, sawData }); process.exit(3); }
    console.log('[ci-sse] OK'); process.exit(0);
  } catch(e){ console.error('[ci-sse] error', e && e.message || e); process.exit(1); }
})();