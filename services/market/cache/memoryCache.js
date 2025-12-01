'use strict';

// Simple in-memory LRU cache with TTL and per-scope version bumping
// API: get(key), set(key, value, ttlMs), stats(), buildKey(country, query), bumpVersion(scope)

const LRU_MAX = Number(process.env.MARKET_CACHE_SIZE || 200);
const LRU_TTL_MS = Number(process.env.MARKET_CACHE_TTL_MS || 30_000);

const store = new Map(); // key -> { value, expires, ts }
const versions = new Map(); // scope (e.g., country) -> integer version

let hits = 0, misses = 0, evictions = 0;

function now(){ return Date.now(); }

function currentVersion(scope){
  if(!scope) return 0;
  return versions.get(scope) || 0;
}

function bumpVersion(scope){
  if(!scope) return;
  const v = (versions.get(scope) || 0) + 1;
  versions.set(scope, v);
}

function evictIfNeeded(){
  if(store.size < LRU_MAX) return;
  let oldestKey = null, oldestTs = Infinity;
  for(const [k,v] of store.entries()){
    if(v.ts < oldestTs){ oldestTs = v.ts; oldestKey = k; }
  }
  if(oldestKey){ store.delete(oldestKey); evictions += 1; }
}

function get(key){
  const rec = store.get(key);
  if(!rec){ misses += 1; return null; }
  if(rec.expires < now()){ store.delete(key); misses += 1; return null; }
  rec.ts = now();
  hits += 1;
  return rec.value;
}

function set(key, value, ttlMs){
  if(!key) return;
  evictIfNeeded();
  store.set(key, { value, expires: now() + (Number(ttlMs)||LRU_TTL_MS), ts: now() });
}

function buildKey(country, query){
  const v = currentVersion(country);
  const { q='', material='', thickness='', vendorRatingMin='', warehouseRatingMin='', employeeRatingMin='', priceMin='', priceMax='', sort='rank', expand='both', mediaFields='', rankWeights='', mode='', rankTuneVer='', sign='' } = query || {};
  return `v3|${country}|${q}|${material}|${thickness}|${vendorRatingMin}|${warehouseRatingMin}|${employeeRatingMin}|${priceMin}|${priceMax}|${sort}|${expand}|${mediaFields}|${rankWeights}|${mode}|tune=${rankTuneVer}|sig=${sign}|v=${v}`;
}

function stats(){
  let valid=0; const t=now();
  for(const [,v] of store.entries()){ if(v.expires>=t) valid++; }
  const denom = hits + misses;
  const hitRate = denom ? (hits/denom) : 0;
  return { size: store.size, valid, max: LRU_MAX, ttlMs: LRU_TTL_MS, hits, misses, evictions, hitRate };
}

module.exports = { get, set, stats, buildKey, bumpVersion, currentVersion };
