'use strict';
// Lightweight in-process LRU cache for search responses (first page only)
// Similar shape to productsCache but distinguished keys
const crypto = require('crypto');

const buckets = new Map(); // key -> { value, expiresAt }
let order = []; // recency order
const MAX_ENTRIES = Number(process.env.MARKET_SEARCH_CACHE_MAX || 300);

function keyFor(opts){
  const base = Object.assign({}, opts||{});
  // Normalize fields influencing results
  const parts = [
    base.q||'', base.page||1, base.limit||20, base.sort||'rank', base.material||'', base.thickness||'', base.category||'', base.priceMin||'', base.priceMax||'', base.vendorRatingMin||'', base.rating_min||'', Array.isArray(base._expandTokens)? base._expandTokens.join('|') : ''
  ];
  const raw = parts.join('::');
  return 'S:' + crypto.createHash('sha1').update(raw).digest('hex');
}

function set(key, value, ttlMs){
  const expiresAt = Date.now() + (ttlMs|| (Number(process.env.MARKET_SEARCH_CACHE_TTL_MS)||15000));
  buckets.set(key, { value, expiresAt });
  order = order.filter(k => k !== key);
  order.unshift(key);
  if(order.length > MAX_ENTRIES){
    const evict = order.slice(MAX_ENTRIES);
    for(const k of evict){ buckets.delete(k); }
    order = order.slice(0, MAX_ENTRIES);
  }
}

function get(key){
  const entry = buckets.get(key);
  if(!entry) return null;
  if(entry.expiresAt < Date.now()){ buckets.delete(key); order = order.filter(k=>k!==key); return null; }
  // promote
  order = [key].concat(order.filter(k=>k!==key));
  return entry.value;
}

function invalidateAll(){ buckets.clear(); order = []; }

function stats(){ return { size: buckets.size, keys: order.slice() }; }

module.exports = { keyFor, set, get, invalidateAll, stats };