'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

let cache = {
  byKid: {},
  fetchedAt: 0,
  ttl: Number(process.env.JWKS_CACHE_TTL_MS || 3600000) // 1h default
};

let _timer = null;
let _urlInUse = null;

function fetchJson(urlStr){
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({ hostname:u.hostname, port:u.port, path:u.pathname+u.search, method:'GET' }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function jwkToPem(jwk){
  const keyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return keyObj.export({ type: 'spki', format: 'pem' });
}

async function refresh(url){
  const json = await fetchJson(url);
  const keys = Array.isArray(json && json.keys) ? json.keys : [];
  const map = {};
  for (const k of keys){
    try { if (k.kid) map[k.kid] = jwkToPem(k); } catch(_){ }
  }
  cache.byKid = map;
  cache.fetchedAt = Date.now();
  return map;
}

async function getPublicKeyForKid(kid){
  const url = process.env.AUTH_JWKS_URL || process.env.MARKET_JWKS_URL || '';
  if (!kid || !url) return undefined;
  const now = Date.now();
  const fresh = now - cache.fetchedAt < cache.ttl;
  if (!fresh && url) {
    try { await refresh(url); } catch(_){ /* ignore fetch errors */ }
  }
  if (cache.byKid[kid]) return cache.byKid[kid];
  // On miss, attempt one fast refresh
  try { await refresh(url); } catch(_){ }
  return cache.byKid[kid];
}

function getPublicKeyForKidSync(kid){
  if (!kid) return undefined;
  return cache.byKid[kid];
}

function getAll(){ return { ...cache.byKid }; }

function startAutoRefresh(url, intervalMs, jitterMs){
  const u = url || process.env.AUTH_JWKS_URL || process.env.MARKET_JWKS_URL;
  const base = Number(intervalMs != null ? intervalMs : process.env.JWKS_AUTO_REFRESH_MS || 0);
  const jitter = Number(jitterMs != null ? jitterMs : process.env.JWKS_AUTO_REFRESH_JITTER_MS || 0);
  if (!u || base <= 0) return false;
  if (_timer) { clearInterval(_timer); _timer = null; }
  _urlInUse = u;
  const nextDelay = () => base + (jitter > 0 ? Math.floor(Math.random() * jitter) : 0);
  // kick off an immediate refresh in background
  refresh(u).catch(()=>{});
  _timer = setInterval(() => { refresh(u).catch(()=>{}); }, nextDelay());
  return true;
}

function stopAutoRefresh(){ if (_timer) { clearInterval(_timer); _timer = null; } }

module.exports = { getPublicKeyForKid, getPublicKeyForKidSync, getAll, _refresh: refresh, startAutoRefresh, stopAutoRefresh };
