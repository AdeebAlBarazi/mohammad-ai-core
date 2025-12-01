'use strict';

const interactions = require('./interactionsTracker');

let fallback = null; // { credibility, price, freshness, media }
let lastUpdate = 0;
let version = 0;

// Manual override state
let manualWeights = null; // same shape as fallback
let manualVersion = 0;
let manualSetAt = 0;

function isEnabled(){ return process.env.RANK_AUTOTUNE_ENABLED === '1'; }
function periodMs(){ const sec = Number(process.env.RANK_AUTOTUNE_PERIOD_SEC || 604800); return sec * 1000; }

function getFallback(){
  if(manualWeights){
    return { weights: manualWeights, version: `manual-${manualVersion}`, lastUpdate: manualSetAt, manual: true };
  }
  return fallback ? { weights: fallback, version, lastUpdate, manual: false } : null;
}

function toStringWeights(w){
  if(!w) return null;
  return `credibility:${w.credibility},price:${w.price},freshness:${w.freshness},media:${w.media}`;
}

function parseStringWeights(s){
  if(!s || typeof s !== 'string') return null;
  const parts = s.split(',').map(x=>x.trim()).filter(Boolean);
  const obj = {};
  for(const p of parts){
    const [k,v] = p.split(':').map(x=>x.trim());
    if(!k || v==null) continue;
    const num = Number(v);
    if(Number.isFinite(num)) obj[k] = num;
  }
  const required = ['credibility','price','freshness','media'];
  for(const r of required){ if(typeof obj[r] !== 'number') return null; }
  return { credibility: obj.credibility, price: obj.price, freshness: obj.freshness, media: obj.media };
}

function setManualWeights(w){
  let weights = null;
  if(typeof w === 'string') weights = parseStringWeights(w);
  else if(w && typeof w === 'object'){
    const c = Number(w.credibility), p = Number(w.price), f = Number(w.freshness), m = Number(w.media);
    if([c,p,f,m].every(Number.isFinite)) weights = { credibility: c, price: p, freshness: f, media: m };
  }
  if(!weights) throw new Error('Invalid weights payload');
  manualWeights = weights;
  manualVersion += 1;
  manualSetAt = Date.now();
  return getFallback();
}

function clearManualWeights(){
  manualWeights = null;
  return getFallback();
}

async function maybeUpdate(){
  // If manual is set, always return it
  if(manualWeights) return getFallback();
  if(!isEnabled()) return getFallback();
  const now = Date.now();
  if(now - lastUpdate < periodMs()) return getFallback();
  try { interactions.prune(); } catch(_e){}
  const s = interactions.computeWeeklyWeights();
  const suggested = s.weights;
  const changed = !fallback || JSON.stringify(suggested) !== JSON.stringify(fallback);
  fallback = suggested;
  lastUpdate = now;
  if(changed) version += 1;
  return getFallback();
}

module.exports = { isEnabled, maybeUpdate, getFallback, toStringWeights, periodMs, setManualWeights, clearManualWeights, parseStringWeights };
