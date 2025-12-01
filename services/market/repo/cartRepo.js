'use strict';
const MpCart = require('../../../models/marketplace/Cart');
const MpProduct = require('../../../models/marketplace/Product');
const popularity = require('../popularityTracker');

async function getOrCreateCart({ countryCode, userKey, currency='SAR' }){
  let cart = await MpCart.findOne({ userKey, countryCode }).exec();
  if(!cart){
    cart = new MpCart({ userKey, countryCode, items: [], subtotal:0, currency });
    await cart.save();
  }
  return cart;
}

async function addItem({ countryCode, userKey, sku, quantity=1, currency='SAR' }){
  const cart = await getOrCreateCart({ countryCode, userKey, currency });
  const p = await MpProduct.findOne({ sku }).exec();
  if(!p) throw new Error('SKU not found: '+sku);
  const existing = cart.items.find(i=> i.sku === sku);
  const unitPrice = Number(p.price||0);
  if(existing){
    existing.quantity += quantity;
    existing.unitPrice = unitPrice; // refresh price if changed
  } else {
    cart.items.push({ product: p._id, sku, quantity, unitPrice, currency });
  }
  try { popularity.recordCartAdd(sku, quantity); } catch(_e){}
  // recompute subtotal
  cart.subtotal = cart.items.reduce((acc,i)=> acc + (i.unitPrice * i.quantity), 0);
  await cart.save();
  return cart;
}

async function removeItem({ countryCode, userKey, sku }){
  const cart = await getOrCreateCart({ countryCode, userKey });
  cart.items = cart.items.filter(i=> i.sku !== sku);
  cart.subtotal = cart.items.reduce((acc,i)=> acc + (i.unitPrice * i.quantity), 0);
  await cart.save();
  return cart;
}

async function getCart({ countryCode, userKey }){
  const cart = await getOrCreateCart({ countryCode, userKey });
  return cart;
}
async function clearCart({ countryCode, userKey }) {
  const cart = await getOrCreateCart({ countryCode, userKey });
  cart.items = [];
  cart.subtotal = 0;
  await cart.save();
  return cart;
}

async function replaceCart({ countryCode, userKey, items=[], currency='SAR' }) {
  const cart = await getOrCreateCart({ countryCode, userKey, currency });
  const skus = items.map(i=> i.sku);
  const products = await MpProduct.find({ sku: { $in: skus } }).lean();
  const priceMap = new Map(products.map(p=> [p.sku, Number(p.price||0)]));
  cart.items = items.filter(i=> priceMap.has(i.sku)).map(i=> ({
    product: products.find(p=> p.sku === i.sku)._id,
    sku: i.sku,
    quantity: Number(i.quantity||1),
    unitPrice: priceMap.get(i.sku),
    currency
  }));
  cart.subtotal = cart.items.reduce((acc,i)=> acc + (i.unitPrice * i.quantity), 0);
  await cart.save();
  return cart;
}

async function mergeItems({ countryCode, userKey, items=[], currency='SAR' }) {
  const cart = await getOrCreateCart({ countryCode, userKey, currency });
  for (const it of items) {
    if(!it || !it.sku) continue;
    await addItem({ countryCode, userKey, sku: it.sku, quantity: Number(it.quantity||1), currency });
  }
  // Re-fetch to reflect merged subtotal
  const merged = await MpCart.findOne({ userKey, countryCode }).exec();
  return merged;
}

module.exports = { addItem, removeItem, getCart, clearCart, replaceCart, mergeItems };