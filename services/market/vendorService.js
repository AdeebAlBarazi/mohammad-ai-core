'use strict';
const { isMongoReady } = require('../../config/market-db');
const { ensureCountry } = require('../../utils/market/store');
const crypto = require('crypto');

function genIdHex(n=12){ try { return crypto.randomBytes(n).toString('hex'); } catch(_){ return Math.random().toString(16).slice(2,2*n); } }

async function getModel(){
  if(isMongoReady()){
    try { return require('../../models/marketplace/Vendor'); } catch(e){ /* ignore */ }
  }
  return null;
}

function normalizeIdOrCode(id){
  const s = String(id||'').trim();
  if(!s) return null;
  if(/^[0-9a-fA-F]{24}$/.test(s)) return { type:'id', value: s };
  return { type:'code', value: s };
}

module.exports = {
  async createVendor({ countryCode, companyName, vendorCode, displayName, contact, address, verified=false, active=true }){
    const MpVendor = await getModel();
    if(MpVendor){
      const doc = new MpVendor({ countryCode, companyName, vendorCode, displayName, contact: contact||{}, address: address||{}, verified: !!verified, active: !!active });
      await doc.save();
      return { ok:true, vendor: doc.toObject() };
    }
    // memory fallback
    const bucket = ensureCountry(countryCode);
    if(!bucket.vendors) bucket.vendors = {};
    const id = genIdHex(12);
    const now = new Date().toISOString();
    const v = { _id: id, countryCode, companyName, vendorCode, displayName: displayName||companyName, contact: contact||{}, address: address||{}, ratings:{vendor:0,warehouse:0,employee:0}, members:[], verified: !!verified, active: !!active, createdAt: now, updatedAt: now };
    bucket.vendors[vendorCode] = v; // key by code for quick lookup
    return { ok:true, vendor: v };
  },

  async getByIdOrCode(idOrCode){
    const MpVendor = await getModel();
    const norm = normalizeIdOrCode(idOrCode);
    if(!norm) return null;
    if(MpVendor){
      if(norm.type==='id'){
        try{ return await MpVendor.findById(norm.value).exec(); }catch(_){ return null; }
      } else {
        try{ return await MpVendor.findOne({ vendorCode: norm.value }).exec(); }catch(_){ return null; }
      }
    }
    // memory
    // We don't know countryCode here; scan all buckets
    const store = require('../../utils/market/store').store;
    for(const cc of Object.keys(store)){
      const bucket = store[cc];
      if(!bucket || !bucket.vendors) continue;
      if(norm.type==='id'){
        const match = Object.values(bucket.vendors).find(v => String(v._id) === norm.value);
        if(match) return match;
      } else {
        if(bucket.vendors[norm.value]) return bucket.vendors[norm.value];
      }
    }
    return null;
  },

  async addMember({ idOrCode, userId, role='staff' }){
    const MpVendor = await getModel();
    const norm = normalizeIdOrCode(idOrCode);
    if(!norm) return { ok:false, error:'invalid vendor id' };
    if(MpVendor){
      const q = norm.type==='id' ? { _id: norm.value } : { vendorCode: norm.value };
      const v = await MpVendor.findOne(q).exec();
      if(!v) return { ok:false, error:'vendor not found' };
      const exists = (v.members||[]).some(m => m.userId === userId);
      if(!exists){ v.members = Array.isArray(v.members) ? v.members : []; v.members.push({ userId, role: (role==='owner'?'owner':'staff') }); }
      await v.save();
      return { ok:true, vendor: v.toObject() };
    }
    // memory
    const store = require('../../utils/market/store').store;
    for(const cc of Object.keys(store)){
      const bucket = store[cc];
      if(!bucket || !bucket.vendors) continue;
      let v = null;
      if(norm.type==='id'){
        v = Object.values(bucket.vendors).find(x => String(x._id) === norm.value);
      } else {
        v = bucket.vendors[norm.value];
      }
      if(v){
        v.members = Array.isArray(v.members) ? v.members : [];
        if(!v.members.some(m => m.userId === userId)){
          v.members.push({ userId, role: (role==='owner'?'owner':'staff'), addedAt: new Date().toISOString() });
        }
        v.updatedAt = new Date().toISOString();
        return { ok:true, vendor: v };
      }
    }
    return { ok:false, error:'vendor not found' };
  },

  async updateVendor({ idOrCode, patch }){
    const MpVendor = await getModel();
    const norm = normalizeIdOrCode(idOrCode);
    if(!norm) return { ok:false, error:'invalid vendor id' };
    const whitelist = ['displayName','verified','active','contact','address'];
    const safePatch = {};
    for(const k of whitelist){ if(patch && Object.prototype.hasOwnProperty.call(patch, k)) safePatch[k] = patch[k]; }
    if(MpVendor){
      const q = norm.type==='id' ? { _id: norm.value } : { vendorCode: norm.value };
      const v = await MpVendor.findOneAndUpdate(q, { $set: safePatch }, { new:true }).exec();
      if(!v) return { ok:false, error:'vendor not found' };
      return { ok:true, vendor: v.toObject() };
    }
    // memory
    const store = require('../../utils/market/store').store;
    for(const cc of Object.keys(store)){
      const bucket = store[cc];
      if(!bucket || !bucket.vendors) continue;
      let code = null; let v = null;
      if(norm.type==='id'){
        for(const [k,val] of Object.entries(bucket.vendors)){
          if(String(val._id) === norm.value){ code = k; v = val; break; }
        }
      } else { code = norm.value; v = bucket.vendors[code]; }
      if(v){
        Object.assign(v, safePatch || {});
        v.updatedAt = new Date().toISOString();
        bucket.vendors[code] = v;
        return { ok:true, vendor: v };
      }
    }
    return { ok:false, error:'vendor not found' };
  }
};
