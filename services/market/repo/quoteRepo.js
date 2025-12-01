'use strict';
const MpQuote = require('../../../models/marketplace/Quote');
const MpProduct = require('../../../models/marketplace/Product');
const popularity = require('../popularityTracker');

async function createQuote({ countryCode, items, currency }){
  // items: [{ sku, quantity }]
  const docs = [];
  let subtotal = 0;
  for(const it of items){
    const p = await MpProduct.findOne({ sku: it.sku }).exec();
    if(!p) throw new Error('SKU not found: ' + it.sku);
    const qty = Number(it.quantity||1);
    const unitPrice = Number(p.price||0);
    subtotal += unitPrice * qty;
    docs.push({ product: p._id, sku: p.sku, name: p.name, quantity: qty, unitPrice, currency });
  }
  const tax = +(subtotal * 0.15).toFixed(2);
  const shipping = 0;
  const total = +(subtotal + tax + shipping).toFixed(2);
  const quote = new MpQuote({ countryCode, items: docs, subtotal:+subtotal.toFixed(2), tax, shipping, total, currency, validUntil: new Date(Date.now()+7*24*3600*1000) });
  await quote.save();
  try { popularity.recordQuoteItems(docs); } catch(_e){}
  return quote;
}

async function getQuote(id){
  return MpQuote.findById(id).populate('items.product').exec();
}

module.exports = { createQuote, getQuote };