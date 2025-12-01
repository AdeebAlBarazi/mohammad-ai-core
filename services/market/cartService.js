'use strict';
const mongoose = require('mongoose');
const { ensureCountry } = require('../../utils/market/store');
const cartRepo = require('./repo/cartRepo');

// In-memory carts per user id for stub
const carts = new Map(); // key: userId, value: { items: [] }

function getCartMemory(userId){
  if(!carts.has(userId)) carts.set(userId, { items: [] });
  return carts.get(userId);
}

function addItemMemory({ userId, sku, quantity=1 }){
  const cart = getCartMemory(userId);
  const item = cart.items.find(i=> i.sku === sku);
  if(item){ item.quantity += quantity; }
  else cart.items.push({ sku, quantity });
  return cart;
}

function removeItemMemory({ userId, sku }){
  const cart = getCartMemory(userId);
  cart.items = cart.items.filter(i=> i.sku !== sku);
  return cart;
}

function replaceCartMemory({ userId, items=[] }){
  const cart = getCartMemory(userId);
  cart.items = [];
  for(const it of items){ if(it && it.sku){ const qty = Math.max(1, Number(it.quantity||1)); cart.items.push({ sku: it.sku, quantity: qty }); } }
  return cart;
}

function mergeItemsMemory({ userId, items=[] }){
  const cart = getCartMemory(userId);
  for(const it of items){ if(it && it.sku){ const qty = Math.max(1, Number(it.quantity||1)); const ex = cart.items.find(i=> i.sku === it.sku); if(ex) ex.quantity += qty; else cart.items.push({ sku: it.sku, quantity: qty }); } }
  return cart;
}

function clearCartMemory({ userId }) {
  const cart = getCartMemory(userId);
  cart.items = [];
  return cart;
}

function computeTotalsMemory(userId, countryCode){
  const bucket = ensureCountry(countryCode||'SA');
  const cart = getCartMemory(userId);
  let subtotal = 0;
  const detailed = cart.items.map(ci => {
    const p = bucket.products.find(x=> x.sku === ci.sku);
    const unitPrice = p ? (p.price||0) : 0;
    const lineTotal = unitPrice * ci.quantity;
    subtotal += lineTotal;
    return { sku: ci.sku, quantity: ci.quantity, unitPrice, lineTotal };
  });
  return { items: detailed, subtotal: +subtotal.toFixed(2) };
}

// DB-backed versions
async function addItemDb({ userId, sku, quantity=1, countryCode, currency='SAR' }){
  const userKey = String(userId);
  const cart = await cartRepo.addItem({ countryCode: countryCode||'SA', userKey, sku, quantity:Number(quantity||1), currency });
  return cart;
}

async function removeItemDb({ userId, sku, countryCode }){
  const userKey = String(userId);
  const cart = await cartRepo.removeItem({ countryCode: countryCode||'SA', userKey, sku });
  return cart;
}

async function replaceCartDb({ userId, items=[], countryCode, currency='SAR' }) {
  const userKey = String(userId);
  const cart = await cartRepo.replaceCart({ countryCode: countryCode||'SA', userKey, items, currency });
  return cart;
}

async function mergeItemsDb({ userId, items=[], countryCode, currency='SAR' }) {
  const userKey = String(userId);
  const cart = await cartRepo.mergeItems({ countryCode: countryCode||'SA', userKey, items, currency });
  return cart;
}

async function clearCartDb({ userId, countryCode }) {
  const userKey = String(userId);
  const cart = await cartRepo.clearCart({ countryCode: countryCode||'SA', userKey });
  return cart;
}

async function computeTotalsDb(userId, countryCode){
  const userKey = String(userId);
  const cart = await cartRepo.getCart({ countryCode: countryCode||'SA', userKey });
  const items = (cart.items||[]).map(ci => ({ sku: ci.sku, quantity: ci.quantity, unitPrice: ci.unitPrice, lineTotal: ci.unitPrice * ci.quantity }));
  const subtotal = +(items.reduce((acc,i)=> acc + i.lineTotal, 0).toFixed(2));
  return { items, subtotal };
}

function usingDb(){
  return mongoose.connection && mongoose.connection.readyState === 1;
}

module.exports = {
  // memory (fallback)
  getCart: getCartMemory,
  addItem: (payload)=> usingDb() ? addItemDb(payload) : addItemMemory(payload),
  removeItem: (payload)=> usingDb() ? removeItemDb(payload) : removeItemMemory(payload),
  replaceCart: (payload)=> usingDb() ? replaceCartDb(payload) : replaceCartMemory(payload),
  mergeItems: (payload)=> usingDb() ? mergeItemsDb(payload) : mergeItemsMemory(payload),
  clearCart: (payload)=> usingDb() ? clearCartDb(payload) : clearCartMemory(payload),
  computeTotals: (userId, countryCode)=> usingDb() ? computeTotalsDb(userId, countryCode) : computeTotalsMemory(userId, countryCode)
};