'use strict';

// In-memory interactions tracker per SKU with optional metadata (price, hasMedia)

const bySku = new Map(); // sku -> { clicks, dwellTotalMs, views, meta: { price?: number, hasMedia?: boolean } }
let lastPrune = Date.now();
const MAX_ENTRIES = 5000; // safety cap
const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

function _ensure(sku){
  if(!bySku.has(sku)) bySku.set(sku, { clicks:0, dwellTotalMs:0, views:0, meta:{} });
  return bySku.get(sku);
}

function recordClick(sku, meta){
  if(!sku) return;
  const rec = _ensure(String(sku));
  rec.clicks += 1;
  if(meta && typeof meta === 'object'){
    if(meta.price != null) rec.meta.price = Number(meta.price);
    if(meta.hasMedia != null) rec.meta.hasMedia = !!meta.hasMedia;
  }
}

function recordView(sku, dwellMs, meta){
  if(!sku) return;
  const rec = _ensure(String(sku));
  rec.views += 1;
  rec.dwellTotalMs += Math.max(0, Number(dwellMs)||0);
  if(meta && typeof meta === 'object'){
    if(meta.price != null) rec.meta.price = Number(meta.price);
    if(meta.hasMedia != null) rec.meta.hasMedia = !!meta.hasMedia;
  }
}

function getSnapshot(){
  const out = {};
  for(const [sku, rec] of bySku.entries()){
    out[sku] = { clicks: rec.clicks, views: rec.views, dwellTotalMs: rec.dwellTotalMs, meta: rec.meta };
  }
  return out;
}

function prune(){
  const now = Date.now();
  // Time-based prune (daily)
  if(now - lastPrune < PRUNE_INTERVAL_MS && bySku.size <= MAX_ENTRIES) return { pruned:0, kept: bySku.size };
  lastPrune = now;
  // Strategy: retain top N by (clicks + views) and drop others
  const arr = Array.from(bySku.entries()).map(([sku, rec]) => ({ sku, rec, score: rec.clicks + rec.views }));
  arr.sort((a,b)=> b.score - a.score);
  const keep = arr.slice(0, Math.min(MAX_ENTRIES, arr.length));
  const keepSet = new Set(keep.map(e=>e.sku));
  let pruned = 0;
  for(const key of bySku.keys()){
    if(!keepSet.has(key)){ bySku.delete(key); pruned++; }
  }
  return { pruned, kept: bySku.size };
}

function computeWeeklyWeights(){
  // Heuristics:
  // - media weight: if avg dwell for items marked hasMedia is high (>5s) and higher than those without, increase media weight up to 0.25
  // - price weight: compute share of clicks on items with price <= median clicked price; if >0.5, users prefer cheaper -> raise price weight up to 0.4; else reduce a bit
  // Base weights before tuning: cred=0.5, price=0.3, fresh=0.2, media=0.0
  const base = { credibility: 0.5, price: 0.3, freshness: 0.2, media: 0.0 };
  const data = Array.from(bySku.values());
  const clickItems = data.filter(d=> d.clicks>0 && d.meta && typeof d.meta.price==='number');
  const prices = clickItems.map(d=> d.meta.price).sort((a,b)=>a-b);
  const medianPrice = prices.length? (prices[Math.floor((prices.length-1)/2)] + prices[Math.ceil((prices.length-1)/2)]) / 2 : null;
  const lowPriceClicks = (medianPrice!=null)? clickItems.reduce((acc,d)=> acc + (d.meta.price <= medianPrice ? d.clicks : 0), 0) : 0;
  const totalClicks = clickItems.reduce((acc,d)=> acc + d.clicks, 0) || 1;
  const lowShare = medianPrice!=null ? (lowPriceClicks/totalClicks) : 0.5;
  // priceSuggested between 0.1..0.4, centered at 0.25 with slope around share deviation
  let priceSuggested = Math.max(0.1, Math.min(0.4, 0.25 + (lowShare-0.5)*0.4));

  const mediaItems = data.filter(d=> d.views>0 && d.meta && d.meta.hasMedia);
  const nomediaItems = data.filter(d=> d.views>0 && (!d.meta || !d.meta.hasMedia));
  const avgDwellMedia = mediaItems.length? mediaItems.reduce((a,d)=> a + d.dwellTotalMs/d.views, 0)/mediaItems.length : 0;
  const avgDwellNo = nomediaItems.length? nomediaItems.reduce((a,d)=> a + d.dwellTotalMs/d.views, 0)/nomediaItems.length : 0;
  let mediaSuggested = 0.0;
  if(avgDwellMedia > 5000 && avgDwellMedia >= avgDwellNo){
    mediaSuggested = Math.min(0.25, (avgDwellMedia-5000)/20000); // e.g., 5s -> 0, 25s -> 0.25
  }

  // Allocate remaining to credibility and freshness keeping freshness >=0.15
  let remaining = 1 - (priceSuggested + mediaSuggested);
  let freshness = Math.max(0.15, Math.min(0.35, base.freshness));
  let credibility = Math.max(0.1, remaining - freshness);
  const sum = credibility + priceSuggested + freshness + mediaSuggested;
  credibility/=sum; priceSuggested/=sum; freshness/=sum; mediaSuggested/=sum;

  return {
    weights: { credibility: +credibility.toFixed(4), price: +priceSuggested.toFixed(4), freshness: +freshness.toFixed(4), media: +mediaSuggested.toFixed(4) },
    metrics: { medianPrice, lowPriceShare: +lowShare.toFixed(3), avgDwellMedia: Math.round(avgDwellMedia), avgDwellNo: Math.round(avgDwellNo) },
    sampleCounts: { skus: bySku.size, clickSkus: clickItems.length, mediaViewSkus: mediaItems.length }
  };
}

module.exports = { recordClick, recordView, getSnapshot, computeWeeklyWeights, prune };
