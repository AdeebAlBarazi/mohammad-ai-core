'use strict';

// Simple in-memory popularity tracker (quotes + cart adds) per SKU.
// For DB mode we still keep in-memory counts (ephemeral) until a persistent model is added.

const skuStats = new Map(); // sku -> { quotes: number, cartAdds: number }

function recordQuoteItems(items){
  if(!Array.isArray(items)) return;
  for(const it of items){
    const sku = it && it.sku; if(!sku) continue;
    const rec = skuStats.get(sku) || { quotes:0, cartAdds:0 };
    rec.quotes += 1; // one quote occurrence per product regardless of quantity
    skuStats.set(sku, rec);
  }
}

function recordCartAdd(sku, quantity){
  if(!sku) return;
  const q = Number(quantity)||1;
  const rec = skuStats.get(sku) || { quotes:0, cartAdds:0 };
  rec.cartAdds += q; // weight by quantity added
  skuStats.set(sku, rec);
}

function getScore(sku){
  const rec = skuStats.get(sku);
  if(!rec) return 0;
  // Weighted score: quotes have weight 3, cartAdds weight 1
  return rec.quotes * 3 + rec.cartAdds;
}

function getScoresForSkus(skus){
  const out = Object.create(null);
  for(const s of skus){ out[s] = getScore(s); }
  return out;
}

function stats(){
  let totalSkus = 0, totalQuotes=0, totalCart=0;
  for(const [,v] of skuStats.entries()){ totalSkus++; totalQuotes += v.quotes; totalCart += v.cartAdds; }
  return { totalSkus, totalQuotes, totalCart };
}

module.exports = { recordQuoteItems, recordCartAdd, getScore, getScoresForSkus, stats };
