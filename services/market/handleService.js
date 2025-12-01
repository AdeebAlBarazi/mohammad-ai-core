'use strict';
// Buyer public handle generation & reservation service.
// Supports both Mongo (if a model exists) and in-memory store fallback.

const crypto = require('crypto');
const { isMongoReady } = require('../../config/market-db');
const { ensureCountry } = require('../../utils/market/store');

function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randomDigits(n){ let s=''; for(let i=0;i<n;i++) s += String(randInt(0,9)); return s; }
function randomWord(){
  const pool = ['nova','stone','axis','flow','spark','pixel','marble','granite','onyx','delta','alpha','prime','orbit'];
  return pool[randInt(0,pool.length-1)];
}
function sanitize(base){ return String(base||'').toLowerCase().replace(/[^a-z0-9_]/g,''); }
function buildHandle({ base, digits=3 }){
  const core = sanitize(base) || randomWord();
  return '@' + core + randomDigits(digits);
}

async function getHandleModel(){
  if(!isMongoReady()) return null;
  try { return require('../../models/marketplace/Handle'); } catch(e){ return null; }
}

async function existsInDb(MpHandle, norm){
  try { const ex = await MpHandle.exists({ handle: norm }); return !!ex; } catch(_) { return false; }
}

module.exports = {
  async suggest({ countryCode, base, count=5 }){
    const out = [];
    const bucket = ensureCountry(countryCode);
    const MpHandle = await getHandleModel();
    while(out.length < count){
      const h = buildHandle({ base, digits: randInt(2,4) });
      // Dedup against memory and DB if available
      const memTaken = !!bucket.handles[h];
      const dbTaken = MpHandle ? await existsInDb(MpHandle, h) : false;
      if(!memTaken && !dbTaken && !out.includes(h)) out.push(h);
    }
    return out;
  },
  async claim({ countryCode, userId, handle }){
    if(!handle || !/^@[a-z0-9_]{3,25}$/i.test(handle)) return { ok:false, error:'INVALID_FORMAT' };
    const norm = handle.toLowerCase();
    const MpHandle = await getHandleModel();
    if(MpHandle){
      // If user already has one, return it
      const owned = await MpHandle.findOne({ userId: String(userId) }).lean().exec();
      if(owned) return { ok:true, handle: owned.handle, alreadyOwned: true };
      // Ensure not taken
      const taken = await MpHandle.findOne({ handle: norm }).lean().exec();
      if(taken) return { ok:false, error:'TAKEN' };
      try {
        const doc = await MpHandle.create({ countryCode: String(countryCode||'SA').toUpperCase(), userId: String(userId), handle: norm });
        return { ok:true, handle: doc.handle };
      } catch(e){
        if(e && e.code === 11000) return { ok:false, error:'TAKEN' };
        return { ok:false, error: e.message || 'DB_ERROR' };
      }
    }
    // memory fallback
    const bucket = ensureCountry(countryCode);
    // Already owned?
    for(const key of Object.keys(bucket.handles)){
      if(bucket.handles[key].userId === userId){
        return { ok:true, handle: bucket.handles[key].handle, alreadyOwned: true };
      }
    }
    if(bucket.handles[norm] && bucket.handles[norm].userId !== userId){
      return { ok:false, error:'TAKEN' };
    }
    bucket.handles[norm] = { userId, handle: norm, countryCode, createdAt: new Date().toISOString() };
    return { ok:true, handle: norm };
  },
  async getForUser({ countryCode, userId }){
    const MpHandle = await getHandleModel();
    if(MpHandle){
      try { return await MpHandle.findOne({ userId: String(userId) }).lean().exec(); } catch(_){ return null; }
    }
    const bucket = ensureCountry(countryCode);
    for(const h of Object.keys(bucket.handles)){
      if(bucket.handles[h].userId === userId) return bucket.handles[h];
    }
    return null;
  }
};
