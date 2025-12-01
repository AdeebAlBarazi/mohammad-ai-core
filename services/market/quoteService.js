'use strict';
const mongoose = require('mongoose');
const { ensureCountry } = require('../../utils/market/store');
const quoteRepo = require('./repo/quoteRepo');

function buildQuote({ items, countryCode, currency='SAR' }){
  if(!Array.isArray(items) || items.length===0) return { ok:false, error:'No items' };
  const bucket = ensureCountry(countryCode||'SA');
  const lineItems = [];
  let subtotal = 0;
  for(const it of items){
    const p = bucket.products.find(x=> x.sku === it.sku);
    if(!p) return { ok:false, error:`SKU not found: ${it.sku}` };
    const qty = Number(it.quantity||1);
    const unitPrice = Number(p.price||0);
    subtotal += unitPrice * qty;
    lineItems.push({ sku: p.sku, name: p.name, quantity: qty, unitPrice, currency });
  }
  const tax = +(subtotal * 0.15).toFixed(2); // VAT 15% example
  const shipping = 0; // TBD
  const total = +(subtotal + tax + shipping).toFixed(2);
  return {
    ok:true,
    quote: {
      items: lineItems,
      subtotal: +subtotal.toFixed(2),
      tax,
      shipping,
      total,
      currency,
      validUntil: new Date(Date.now()+ 7*24*3600*1000).toISOString()
    }
  };
}

async function createQuote({ items, countryCode, currency='SAR' }){
  // If DB is connected, persist quote using repo; else return in-memory computed quote
  if(mongoose.connection && mongoose.connection.readyState === 1){
    try{
      const q = await quoteRepo.createQuote({ countryCode: countryCode||'SA', items, currency });
      return { ok:true, id: String(q._id), quote: { items: q.items.map(i=> ({ sku:i.sku, name:i.name, quantity:i.quantity, unitPrice:i.unitPrice, currency:i.currency })), subtotal: q.subtotal, tax: q.tax, shipping: q.shipping, total: q.total, currency: q.currency, validUntil: q.validUntil } };
    }catch(e){
      return { ok:false, error: e.message };
    }
  }
  return buildQuote({ items, countryCode, currency });
}

module.exports = { buildQuote, createQuote };