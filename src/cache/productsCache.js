// systems/marketplace/src/cache/productsCache.js
// Dedicated products listing cache (first-page, no search/category) with simple TTL
'use strict';
const { LRUCache } = require('../cache/lruCache');

const cache = new LRUCache(Number(process.env.MARKET_CACHE_LIMIT || 200));

function keyFor(obj){
  return 'products:' + Object.keys(obj).sort().map(k => k + '=' + obj[k]).join('&');
}

function get(key){ return cache.get(key); }
function set(key, value, ttlMs){ cache.set(key, value, ttlMs); }
function invalidate(key){ if(key) cache.delete(key); }
function invalidateAll(){ cache.clear(); }
function stats(){ return { size: cache.size(), keys: cache.keys ? cache.keys() : undefined }; }

module.exports = { cache, keyFor, get, set, invalidate, invalidateAll, stats };
