'use strict';
// Minimal Cart mongoose model (fallback stub)
// Only used when Mongo connected; keeps parity with cartRepo expectations.
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'MpProduct', required: false },
  sku: { type: String, required: true, index: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' }
}, { _id: false });

const CartSchema = new mongoose.Schema({
  userKey: { type: String, required: true, index: true },
  countryCode: { type: String, required: true, index: true },
  items: { type: [CartItemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' }
}, { timestamps: true });

module.exports = mongoose.models.MpCart || mongoose.model('MpCart', CartSchema);
