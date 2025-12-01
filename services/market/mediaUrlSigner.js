'use strict';

// Simple HMAC-based URL signer for private media links.
// Env:
// - MEDIA_SIGNING_ENABLED=1 to enable
// - MEDIA_URL_SECRET=<secret>
// - MEDIA_URL_TTL_SEC=600 (default)

const crypto = require('crypto');

function isEnabled(){ return process.env.MEDIA_SIGNING_ENABLED === '1'; }

function signUrl(url, ttlSec){
  if(!isEnabled()) return url;
  try{
    const secret = process.env.MEDIA_URL_SECRET || '';
    if(!secret) return url;
    const ttl = Number(process.env.MEDIA_URL_TTL_SEC || ttlSec || 600);
    const exp = Math.floor(Date.now()/1000) + ttl;
    const base = new URL(url);
    base.searchParams.set('exp', String(exp));
    const payload = base.origin + base.pathname + '?' + base.searchParams.toString();
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    base.searchParams.set('sig', sig);
    return base.toString();
  }catch(_e){ return url; }
}

module.exports = { isEnabled, signUrl };
