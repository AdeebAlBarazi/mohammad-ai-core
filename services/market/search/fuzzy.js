'use strict';
// Fuzzy search module using Fuse.js (in-memory index)
// Builds an index of product names + SKUs (Mongo only when connected).
// Falls back to empty results when DB not available.

const Fuse = require('fuse.js');
let fuse = null;
let lastBuiltAt = 0;
let building = false;

const DEFAULT_LIMIT = Number(process.env.MARKET_FUZZY_LIMIT || 15);
const REFRESH_MS = Number(process.env.MARKET_FUZZY_REFRESH_MS || 60_000); // 1m default

function isMongoConnected(){
  try {
    const mongoose = require('mongoose');
    return mongoose.connection && mongoose.connection.readyState === 1;
  } catch(_) { return false; }
}

async function loadProducts(){
  // When Mongo connected, load from DB; otherwise fall back to in-memory store so fuzzy works in dev/memory mode.
  if(isMongoConnected()){
    let Product = null;
    try { Product = require('../../../src/models/Product'); } catch(_) {}
    if(!Product) return [];
    const rows = await Product.find({ active: true }).select('name sku').limit(2000).lean().exec();
    return rows.map(r => ({ name: r.name, sku: r.sku }));
  } else {
    try {
      const store = require('../../../utils/market/store');
      const data = [];
      const st = store.store || {};
      for(const cc of Object.keys(st)){
        const bucket = st[cc];
        (bucket.products||[]).forEach(p => {
          if(p && p.name && p.sku){ data.push({ name: p.name, sku: p.sku }); }
        });
      }
      return data.slice(0, 2000);
    } catch(_){ return []; }
  }
}

async function buildIndex(force=false){
  const now = Date.now();
  if(building) return fuse;
  if(!force && fuse && (now - lastBuiltAt < REFRESH_MS)) return fuse;
  building = true;
  try {
    const data = await loadProducts();
    fuse = new Fuse(data, {
      includeScore: true,
      keys: ['name', 'sku'],
      threshold: Number(process.env.MARKET_FUZZY_THRESHOLD || 0.4),
      minMatchCharLength: Number(process.env.MARKET_FUZZY_MIN_LEN || 2),
      ignoreLocation: true,
      useExtendedSearch: false
    });
    lastBuiltAt = Date.now();
  } catch(e){ /* swallow */ } finally { building = false; }
  return fuse;
}

async function search(query, limit=DEFAULT_LIMIT){
  const q = String(query||'').trim();
  if(q.length < Number(process.env.MARKET_FUZZY_MIN_LEN || 2)) return [];
  await buildIndex(false);
  if(!fuse) return [];
  const res = fuse.search(q, { limit });
  return res.map(r => ({ name: r.item.name, sku: r.item.sku, fuzzyScore: r.score }));
}

module.exports = { search, buildIndex };
