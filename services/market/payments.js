'use strict';

// Lightweight, provider-agnostic helpers for payment webhooks.
// Default: verification disabled unless PAYMENT_VERIFY_STRICT=1.

const crypto = require('crypto');

// In-memory payment intents (stub for development / staging)
// Each intent: { id, orderId, userId, amount, currency, status, clientSecret, createdAt }
const intents = new Map();
function genId(){ return 'pi_' + Math.random().toString(36).slice(2,12); }

function createIntent({ orderId, userId, amount, currency='SAR' }){
  const id = genId();
  const clientSecret = id + '_secret_' + Math.random().toString(36).slice(2,10);
  const rec = { id, orderId, userId, amount: Number(amount||0), currency, status:'requires_confirmation', clientSecret, createdAt: new Date().toISOString() };
  intents.set(id, rec);
  return { ok:true, intent: rec };
}

function getIntent(id){ const it = intents.get(id); return it ? { ok:true, intent: it } : { ok:false, error:'not_found' }; }

function confirmIntent(id){
  const it = intents.get(id); if(!it) return { ok:false, error:'not_found' };
  if(it.status !== 'requires_confirmation') return { ok:false, error:'invalid_state' };
  it.status = 'succeeded'; it.confirmedAt = new Date().toISOString();
  intents.set(id, it);
  return { ok:true, intent: it };
}

function failIntent(id, reason){
  const it = intents.get(id); if(!it) return { ok:false, error:'not_found' };
  it.status = 'failed'; it.failureReason = reason || 'failed'; intents.set(id, it);
  return { ok:true, intent: it };
}

function isVerificationEnabled(){
  return (process.env.PAYMENT_VERIFY_STRICT || '').toString() === '1';
}

function header(name, req){
  const h = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(h) ? h[0] : h;
}

// Generic HMAC verifier: computes HMAC-SHA256 over JSON body string by default.
// Configure header and secret via env: PAYMENT_HMAC_HEADER, PAYMENT_WEBHOOK_SECRET.
function verifyHmac(req){
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  const headerName = (process.env.PAYMENT_HMAC_HEADER || 'x-signature').toLowerCase();
  if(!secret) return { ok:false, reason:'MISSING_SECRET' };
  const sig = header(headerName, req);
  if(!sig) return { ok:false, reason:'MISSING_SIGNATURE' };
  // Note: Using JSON.stringify(req.body) is not canonical for all providers.
  // For robust verification, capture raw body buffer via custom middleware per provider.
  const payload = JSON.stringify(req.body || {});
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(String(sig)));
  return ok ? { ok:true } : { ok:false, reason:'SIGNATURE_MISMATCH' };
}

async function verifyWebhook(req){
  if(!isVerificationEnabled()) return { ok:true, skipped:true };
  const mode = (process.env.PAYMENT_PROVIDER || 'generic').toLowerCase();
  // For now, only generic HMAC is supported.
  return verifyHmac(req);
}

module.exports = { isVerificationEnabled, verifyWebhook, createIntent, getIntent, confirmIntent, failIntent };
