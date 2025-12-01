'use strict';

// Redis-backed cache adapter implementing the same interface as memoryCache.
// API: get(key), set(key, value, ttlMs), stats(), buildKey(country, query), bumpVersion(scope)
// Falls back to in-memory if Redis connection fails (soft degradation).

const memory = require('./memoryCache');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client = null;
let connected = false;
let hits = 0, misses = 0, evictions = 0; // evictions not directly tracked (could use INFO in future)
const LRU_TTL_MS = Number(process.env.MARKET_CACHE_TTL_MS || 30_000);

// Version keys stored separately per scope.
async function getVersionKey(scope){ return `market:cache:ver:${scope}`; }

async function ensureClient(){
  if(client || connected) return client;
  try {
    const { createClient } = require('redis');
    const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 500);
    client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout,
        // Abort immediate reconnects when Redis is unavailable; we'll fallback to memory.
        reconnectStrategy: () => new Error('redis-unavailable')
      }
    });
    client.on('error', err => { console.warn('[redis-cache] error', err?.message || err); });
    await client.connect();
    connected = true;
    console.log('[redis-cache] Connected');
    return client;
  } catch (e){
    console.warn('[redis-cache] Connection failed, falling back to memory:', e?.message || e);
    try { if(client && client.disconnect){ await client.disconnect(); } } catch(_){}
    client = null; connected = false;
    return null;
  }
}

function serialize(value){
  try { return JSON.stringify(value); } catch(e){ return null; }
}
function deserialize(str){
  try { return JSON.parse(str); } catch(e){ return null; }
}

async function bumpVersion(scope){
  if(!scope){ return; }
  const c = await ensureClient();
  if(!c){ return memory.bumpVersion(scope); }
  const key = await getVersionKey(scope);
  try {
    const v = await c.incr(key); // creates with 1 if absent
    // Optionally set small TTL to auto-reset daily (not mandatory)
    await c.expire(key, 60*60*24); // 24h
    return v;
  } catch(e){ console.warn('[redis-cache] bumpVersion error', e.message); }
}

async function currentVersion(scope){
  if(!scope){ return 0; }
  const c = await ensureClient();
  if(!c){ return memory.currentVersion(scope); }
  const key = await getVersionKey(scope);
  try {
    const v = await c.get(key);
    return v ? Number(v) : 0;
  } catch(e){ console.warn('[redis-cache] currentVersion error', e.message); return 0; }
}

function buildKey(country, query){
  // We need a synchronous wrapper; version fetched lazily (may cause slight race but acceptable)
  // For Redis we will inject version later via async; fallback uses memory immediately.
  // To keep interface consistent, we obtain version synchronously if memory fallback.
  const base = query || {};
  return { _country: country, _query: { ...base } }; // placeholder composite; real key produced in async path.
}

function shapeKey(country, query, version){
  const { q='', material='', thickness='', vendorRatingMin='', warehouseRatingMin='', employeeRatingMin='', priceMin='', priceMax='', sort='rank', expand='both', mediaFields='', rankWeights='', mode='', rankTuneVer='', sign='' } = query || {};
  return `v3r|${country}|${q}|${material}|${thickness}|${vendorRatingMin}|${warehouseRatingMin}|${employeeRatingMin}|${priceMin}|${priceMax}|${sort}|${expand}|${mediaFields}|${rankWeights}|${mode}|tune=${rankTuneVer}|sig=${sign}|v=${version}`;
}

async function get(keyObj){
  const c = await ensureClient();
  if(!c){
    // fallback path
    return memory.get(memory.buildKey(keyObj._country, keyObj._query));
  }
  const version = await currentVersion(keyObj._country);
  const realKey = shapeKey(keyObj._country, keyObj._query, version);
  try {
    const data = await c.get(realKey);
    if(!data){ misses += 1; return null; }
    hits += 1;
    return deserialize(data);
  } catch(e){ console.warn('[redis-cache] get error', e.message); misses += 1; return null; }
}

async function set(keyObj, value, ttlMs){
  const c = await ensureClient();
  if(!c){
    return memory.set(memory.buildKey(keyObj._country, keyObj._query), value, ttlMs);
  }
  const version = await currentVersion(keyObj._country);
  const realKey = shapeKey(keyObj._country, keyObj._query, version);
  const payload = serialize(value);
  if(payload === null){ return; }
  try {
    await c.set(realKey, payload, { PX: Number(ttlMs)||LRU_TTL_MS });
  } catch(e){ console.warn('[redis-cache] set error', e.message); }
}

function stats(){
  // If redis is active we only expose local counters + connection flag; memory fallback shows memory stats.
  if(!connected){ return { backend:'memory-fallback', ...memory.stats() }; }
  const denom = hits + misses;
  return { backend:'redis', hits, misses, hitRate: denom? hits/denom : 0, evictions, ttlMs: LRU_TTL_MS };
}

module.exports = { get, set, stats, buildKey, bumpVersion, currentVersion };
