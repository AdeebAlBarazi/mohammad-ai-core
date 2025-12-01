'use strict';
const mongoose = require('mongoose');
const MpOrder = (()=>{ try { return require('../../models/marketplace/Order'); } catch(_e){ return null; } })();
const MpProduct = (()=>{ try { return require('../../models/marketplace/Product'); } catch(_e){ return null; } })();
const cartService = require('./cartService');

// In-memory fallback storage
const memOrders = [];
function usingDb(){ return mongoose.connection && mongoose.connection.readyState === 1 && MpOrder; }

function genOrderNumber(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const tail = Math.random().toString(16).slice(2,8).toUpperCase();
  return `ORD-${y}${m}${day}-${tail}`;
}

function getCommissionConfig(){
  const pct = Number(process.env.ORDER_COMMISSION_PERCENT || 0);
  const fix = Number(process.env.ORDER_COMMISSION_FIXED || 0);
  return { pct, fix };
}

async function createOrderFromCart({ userId, countryCode='SA', currency='SAR', shippingAddress=null }){
  // Get computed cart totals and raw items
  const totals = await cartService.computeTotals(userId, countryCode);
  const items = Array.isArray(totals.items) ? totals.items : [];
  if(items.length === 0){ return { ok:false, code:'EMPTY_CART', error:'Cart is empty' }; }

  // Try resolve product refs when DB is available
  let itemDocs = [];
  if(usingDb() && MpProduct){
    for(const it of items){
      let product = null;
      try { product = await MpProduct.findOne({ sku: it.sku }).select('_id name').lean().exec(); } catch(_e){}
      itemDocs.push({ product: product ? product._id : undefined, sku: it.sku, name: (product && product.name) || undefined, quantity: it.quantity, unitPrice: it.unitPrice, currency });
    }
  } else {
    itemDocs = items.map(it => ({ product: undefined, sku: it.sku, name: undefined, quantity: it.quantity, unitPrice: it.unitPrice, currency }));
  }

  const subtotal = Number(totals.subtotal||0);
  const taxPct = Number(process.env.ORDER_TAX_PERCENT || process.env.ORDER_VAT_PERCENT || 0);
  const tax = Math.max(0, subtotal * (taxPct/100));
  const shipping = Number(process.env.ORDER_SHIPPING_FIXED || 0);
  const orderNumber = genOrderNumber();
  const { pct, fix } = getCommissionConfig();
  const commission = Math.max(0, subtotal * (pct/100) + fix);
  const total = subtotal + tax + shipping; // commission is platform fee, not charged to buyer in MVP

  if(usingDb()){
    const doc = new MpOrder({
      orderNumber,
      user: mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
      vendor: undefined, // MVP: multi-vendor not supported at order header; keep null
      countryCode,
      items: itemDocs,
      subtotal, tax, shipping, total, currency,
      paymentStatus: 'pending', fulfillmentStatus: 'pending',
      shippingAddress: shippingAddress || undefined,
      meta: { commission: String(commission), commissionPct: String(pct), commissionFixed: String(fix), userId: String(userId||''), taxPct: String(taxPct) }
    });
    const saved = await doc.save();
    // Clear cart by removing all items
    try { for(const it of items){ await cartService.removeItem({ userId, sku: it.sku, countryCode }); } } catch(_e){}
    return { ok:true, id: String(saved._id), orderNumber, total, currency };
  }
  // Memory fallback
  const id = Math.random().toString(36).slice(2);
  const rec = { id, orderNumber, userId, countryCode, items: itemDocs, subtotal, tax, shipping, total, currency, paymentStatus:'pending', fulfillmentStatus:'pending', meta:{ commission, commissionPct:pct, commissionFixed:fix, userId: String(userId||''), taxPct }, createdAt: new Date().toISOString() };
  memOrders.push(rec);
  try { for(const it of items){ await cartService.removeItem({ userId, sku: it.sku, countryCode }); } } catch(_e){}
  return { ok:true, id, orderNumber, total, currency };
}

async function getOrderByIdForUser({ id, userId }){
  if(usingDb()){
    try {
      const doc = await MpOrder.findById(id).lean().exec();
      if(!doc) return null;
      // Optional: enforce ownership if user field is ObjectId equal to userId
      return doc;
    } catch(_e){ return null; }
  }
  return memOrders.find(o => o.id === id && (!userId || o.userId === userId)) || null;
}

function buildSort(sort){
  switch(String(sort||'createdAt_desc')){
    case 'createdAt_asc': return { createdAt: 1, _id: 1 };
    case 'total_desc': return { total: -1, _id: -1 };
    case 'total_asc': return { total: 1, _id: 1 };
    case 'createdAt_desc':
    default: return { createdAt: -1, _id: -1 };
  }
}

async function listOrdersForUser({ userId, limit=20, page=1, q=null, paymentStatus=null, fulfillmentStatus=null, from=null, to=null, sort='createdAt_desc' }){
  if(usingDb()){
    try {
      const and = [];
      if(userId){
        const cond = { $or: [] };
        if(mongoose.Types.ObjectId.isValid(userId)) cond.$or.push({ user: userId });
        cond.$or.push({ 'meta.userId': String(userId) });
        and.push(cond);
      }
      if(paymentStatus) and.push({ paymentStatus });
      if(fulfillmentStatus) and.push({ fulfillmentStatus });
      if(from || to){
        const range = {};
        if(from){ range.$gte = new Date(from); }
        if(to){ range.$lte = new Date(to); }
        // Prefer createdAt if schema timestamps enabled, fallback to date field if present
        and.push({ $or: [ { createdAt: range }, { date: range } ] });
      }
      if(q){
        const or = [ { orderNumber: { $regex: q, $options: 'i' } }, { 'items.sku': { $regex: q, $options: 'i' } } ];
        if(mongoose.Types.ObjectId.isValid(q)) or.push({ _id: q });
        and.push({ $or: or });
      }
      const query = and.length ? { $and: and } : {};
      const total = await MpOrder.countDocuments(query);
      const sortSpec = buildSort(sort);
      const items = await MpOrder.find(query).sort(sortSpec).limit(Number(limit)).skip((Number(page)-1)*Number(limit)).lean().exec();
      return { items, total };
    } catch(_e){ return { items:[], total:0 }; }
  }
  // Memory path
  let all = memOrders.filter(o => !userId || o.userId === userId);
  if(paymentStatus) all = all.filter(o => o.paymentStatus === paymentStatus);
  if(fulfillmentStatus) all = all.filter(o => o.fulfillmentStatus === fulfillmentStatus);
  if(from){ const ts = new Date(from+'T00:00:00').getTime(); all = all.filter(o => new Date(o.createdAt||o.date).getTime() >= ts); }
  if(to){ const ts = new Date(to+'T23:59:59').getTime(); all = all.filter(o => new Date(o.createdAt||o.date).getTime() <= ts); }
  if(q){
    const qq = String(q).toLowerCase();
    all = all.filter(o => {
      const id = (o.id||o._id||'').toString().toLowerCase();
      const on = (o.orderNumber||'').toLowerCase();
      let hit = id.includes(qq) || on.includes(qq);
      if(!hit && Array.isArray(o.items)){
        for(const it of o.items){
          const sku = (it.sku||'').toLowerCase();
          const title = ((it.product && (it.product.name||it.product.title)) || '').toLowerCase();
          if(sku.includes(qq) || title.includes(qq)) { hit = true; break; }
        }
      }
      return hit;
    });
  }
  // Sorting in memory
  switch(String(sort||'createdAt_desc')){
    case 'createdAt_asc':
      all = all.sort((a,b)=> new Date(a.createdAt||a.date) - new Date(b.createdAt||b.date));
      break;
    case 'total_desc':
      all = all.sort((a,b)=> Number(b.total||0) - Number(a.total||0));
      break;
    case 'total_asc':
      all = all.sort((a,b)=> Number(a.total||0) - Number(b.total||0));
      break;
    case 'createdAt_desc':
    default:
      all = all.sort((a,b)=> new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date));
  }
  const start = (Number(page)-1)*Number(limit);
  return { items: all.slice(start, start+Number(limit)), total: all.length };
}

async function updateOrderStatus({ id, paymentStatus, fulfillmentStatus }){
  if(usingDb()){
    try{
      const patch = {};
      if(paymentStatus) patch.paymentStatus = paymentStatus;
      if(fulfillmentStatus) patch.fulfillmentStatus = fulfillmentStatus;
      const res = await MpOrder.findByIdAndUpdate(id, { $set: patch }, { new:true }).lean().exec();
      return !!res;
    } catch(_e){ return false; }
  }
  const idx = memOrders.findIndex(o => o.id === id);
  if(idx === -1) return false;
  const curr = memOrders[idx];
  memOrders[idx] = Object.assign({}, curr, { paymentStatus: paymentStatus || curr.paymentStatus, fulfillmentStatus: fulfillmentStatus || curr.fulfillmentStatus });
  return true;
}

const FULFILLMENT_SEQUENCE = ['pending','processing','shipped','delivered'];
function canTransition(from, to){
  if(from === to) return false;
  if(to === 'cancelled'){
    return from !== 'delivered';
  }
  const fi = FULFILLMENT_SEQUENCE.indexOf(from);
  const ti = FULFILLMENT_SEQUENCE.indexOf(to);
  if(fi === -1 || ti === -1) return false;
  return ti === fi + 1; // enforce linear progression
}

async function updateFulfillment({ id, to }){
  if(usingDb()){
    try{
      const doc = await MpOrder.findById(id).lean().exec();
      if(!doc) return { ok:false, error:'not_found' };
      const from = doc.fulfillmentStatus || 'pending';
      if(!canTransition(from, to)) return { ok:false, error:'invalid_transition', from, to };
      const res = await MpOrder.findByIdAndUpdate(id, { $set: { fulfillmentStatus: to } }, { new:true }).lean().exec();
      return res ? { ok:true, from, to, id: String(res._id) } : { ok:false, error:'update_failed' };
    } catch(e){ return { ok:false, error: e.message }; }
  }
  const idx = memOrders.findIndex(o => o.id === id);
  if(idx === -1) return { ok:false, error:'not_found' };
  const from = memOrders[idx].fulfillmentStatus || 'pending';
  if(!canTransition(from, to)) return { ok:false, error:'invalid_transition', from, to };
  memOrders[idx].fulfillmentStatus = to;
  return { ok:true, from, to, id: memOrders[idx].id };
}

module.exports = { createOrderFromCart, getOrderByIdForUser, listOrdersForUser, updateOrderStatus, updateFulfillment };
