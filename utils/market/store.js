'use strict';

// Simple in-memory store per country. Suitable for stubs/dev.

const store = {
  // SA: { products: [] }
};
const popularity = require('../../services/market/popularityTracker');

function ensureCountry(code){
  const cc = String(code).toUpperCase();
  if(!store[cc]) store[cc] = { products: [], vendors: {}, warehouses: {}, handles: {}, messages: { threads: [], byThread: {} } };
  if(!store[cc].handles) store[cc].handles = {};
  if(!store[cc].messages){ store[cc].messages = { threads: [], byThread: {} }; }
  if(!store[cc].messages.threads) store[cc].messages.threads = [];
  if(!store[cc].messages.byThread) store[cc].messages.byThread = {};
  return store[cc];
}

function addProduct(countryCode, product){
  const bucket = ensureCountry(countryCode);
  bucket.products.push(product);
  return product;
}

function listProducts(countryCode){
  const bucket = ensureCountry(countryCode);
  return bucket.products.slice();
}

function findProductIndex(bucket, idOrSku){
  if(!bucket || !Array.isArray(bucket.products)) return -1;
  const key = String(idOrSku||'').trim();
  if(!key) return -1;
  return bucket.products.findIndex(p => String(p._id||'') === key || String(p.id||'') === key || String(p.sku||'') === key);
}

function updateProduct(countryCode, idOrSku, patch){
  const bucket = ensureCountry(countryCode);
  const idx = findProductIndex(bucket, idOrSku);
  if(idx === -1) return null;
  const curr = bucket.products[idx];
  const next = Object.assign({}, curr, patch || {});
  bucket.products[idx] = next;
  return next;
}

function deleteProduct(countryCode, idOrSku){
  const bucket = ensureCountry(countryCode);
  const idx = findProductIndex(bucket, idOrSku);
  if(idx === -1) return false;
  bucket.products.splice(idx, 1);
  return true;
}

function listByVendor(countryCode, vendorId, { page=1, limit=20, search, status }={}){
  const bucket = ensureCountry(countryCode);
  const v = String(vendorId||'').trim();
  let rows = bucket.products.filter(p => String(p.vendorId||p.vendorCode||'') === v);
  if(search){
    const s = String(search).trim().toLowerCase();
    rows = rows.filter(p => (`${p.name||''} ${p.sku||''}`).toLowerCase().includes(s));
  }
  if(status){
    const active = status === 'active';
    rows = rows.filter(p => (p.active != null ? !!p.active : true) === active);
  }
  const total = rows.length;
  const start = (Number(page)-1) * Number(limit);
  const pageItems = rows.slice(start, start + Number(limit));
  return { total, items: pageItems };
}

function searchProducts(countryCode, query){
  const bucket = ensureCountry(countryCode);
  const { q, type, thickness, vendorRatingMin, warehouseRatingMin, employeeRatingMin, priceMin, priceMax, page=1, limit=20, sort='rank', rankWeights, mode } = query;

  const search = String(q||'').trim().toLowerCase();
  const { expandTokens, buildRegexFromSynonyms } = require('../../services/market/search/synonyms');
  const synRegex = search ? (buildRegexFromSynonyms(search) || new RegExp(search, 'i')) : null;
  const thicknesses = (thickness? String(thickness).split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n)) : null);

  let results = bucket.products.filter(p => {
    if(type && p.material && String(p.material).toLowerCase() !== String(type).toLowerCase()) return false;
    if(thicknesses && !thicknesses.some(t => Math.abs((p.thicknessCm||0) - t) < 0.05)) return false;
    if(search){
      const hay = `${p.name} ${p.material} ${p.seoTitle||''}`;
      if(!synRegex.test(hay)) return false;
    }
    // ratings (if present)
    if(vendorRatingMin && (p.vendorRating||0) < Number(vendorRatingMin)) return false;
    if(warehouseRatingMin && (p.warehouseRating||0) < Number(warehouseRatingMin)) return false;
    if(employeeRatingMin && (p.employeeRating||0) < Number(employeeRatingMin)) return false;
    // price filters (if present)
    if(priceMin && (p.price||0) < Number(priceMin)) return false;
    if(priceMax && (p.price||0) > Number(priceMax)) return false;
    return true;
  });

  // Parse rankWeights if provided: "cred,price,fresh" decimals
  let wCred=0.5, wPrice=0.3, wFresh=0.2;
  if(rankWeights){
    const parts = String(rankWeights).split(',').map(s=>parseFloat(s.trim()));
    if(parts.length===3 && parts.every(n=>!isNaN(n))){
      const sum = parts.reduce((a,b)=>a+b,0) || 1;
      wCred = parts[0]/sum; wPrice=parts[1]/sum; wFresh=parts[2]/sum;
    }
  }
  // Compute ranking score: credibility (wCred) + price (wPrice, lower better) + freshness (wFresh, newer better)
  // Normalize within current result set
  const prices = results.map(p => Number(p.price||0)).filter(n=>!isNaN(n));
  const priceMinAll = prices.length ? Math.min(...prices) : 0;
  const priceMaxAll = prices.length ? Math.max(...prices) : 0;
  const timeStamps = results.map(p => {
    const t = p.createdAt ? new Date(p.createdAt).getTime() : (p.timestamp ? new Date(p.timestamp).getTime() : 0);
    return isNaN(t) ? 0 : t;
  });
  const tMin = timeStamps.length ? Math.min(...timeStamps) : 0;
  const tMax = timeStamps.length ? Math.max(...timeStamps) : 0;

  function credNorm(p){
    const raw = (p.credibilityScore != null ? Number(p.credibilityScore) : (p.vendorRating != null ? Number(p.vendorRating) : 0));
    if(isNaN(raw)) return 0;
    // If looks like 0..5 scale, map to 0..1; if >5 assume 0..100
    if(raw <= 5) return Math.max(0, Math.min(1, raw/5));
    return Math.max(0, Math.min(1, raw/100));
  }
  function priceNorm(p){
    const price = Number(p.price||0);
    if(isNaN(price) || priceMaxAll === priceMinAll) return 0.5; // neutral
    const inv = (priceMaxAll - price) / (priceMaxAll - priceMinAll);
    return Math.max(0, Math.min(1, inv));
  }
  function freshNorm(p){
    const t = p.createdAt ? new Date(p.createdAt).getTime() : (p.timestamp ? new Date(p.timestamp).getTime() : 0);
    if(tMax === tMin) return 0.5;
    const n = (t - tMin) / (tMax - tMin);
    return Math.max(0, Math.min(1, isNaN(n) ? 0.5 : n));
  }
  if(sort === 'rank'){
    results.sort((a,b)=>{
      const aScore = wCred*credNorm(a) + wPrice*priceNorm(a) + wFresh*freshNorm(a);
      const bScore = wCred*credNorm(b) + wPrice*priceNorm(b) + wFresh*freshNorm(b);
      return bScore - aScore;
    });
  } else if(sort === 'popular'){
    const scores = popularity.getScoresForSkus(results.map(r=>r.sku));
    results.sort((a,b)=> (scores[b.sku]||0) - (scores[a.sku]||0));
  } else if(sort === 'price_asc'){
    results.sort((a,b)=> (a.price||0) - (b.price||0));
  } else if(sort === 'price_desc'){
    results.sort((a,b)=> (b.price||0) - (a.price||0));
  } else if(sort === 'newest'){
    results.sort((a,b)=>{
      const at = a.createdAt ? new Date(a.createdAt).getTime() : (a.timestamp? new Date(a.timestamp).getTime():0);
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : (b.timestamp? new Date(b.timestamp).getTime():0);
      return bt - at;
    });
  }

  const total = results.length;
  const start = (page - 1) * limit;
  const items = results.slice(start, start + Number(limit));
  let facets = null;
  if(mode === 'facets' && Number(page) === 1){
    const materialCounts = Object.create(null);
    const thicknessCounts = Object.create(null);
    for(const r of results){
      if(r.material){ materialCounts[r.material] = (materialCounts[r.material]||0)+1; }
      if(r.thicknessCm != null){ const t = r.thicknessCm; thicknessCounts[t] = (thicknessCounts[t]||0)+1; }
    }
    facets = { materials: materialCounts, thicknesses: thicknessCounts };
  }

  let hint = null;
  if(q && String(q).length < 3){
    hint = 'Query too short; consider adding more letters for better relevance';
  }
  const meta = {};
  if(hint) meta.hint = hint;
  if(facets) meta.facets = facets;
  return { items, page: Number(page), limit: Number(limit), total, meta };
}

module.exports = { addProduct, listProducts, searchProducts, ensureCountry, updateProduct, deleteProduct, listByVendor, store };
