'use strict';

// Pluggable cache adapter: memory (default) or redis (future)

const backend = (process.env.MARKET_CACHE_BACKEND || 'memory').toLowerCase();

let adapter;
if(backend === 'redis'){
  try {
    adapter = require('./redisCache');
    console.log('[market-cache] Using Redis backend');
  } catch (e){
    console.warn('[market-cache] Redis backend requested but failed to load, falling back to memory:', e.message);
    adapter = require('./memoryCache');
  }
} else {
  adapter = require('./memoryCache');
}

module.exports = adapter;
