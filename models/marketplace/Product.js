'use strict';
// Minimal Product model (only fields referenced by productService/productRepo)
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, index: true },
  countryCode: { type: String, required: true, index: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'MpVendor' },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'MpWarehouse' },
  name: { type: String, required: true },
  material: { type: String },
  category: { type: String, index: true },
  thicknessCm: { type: Number },
  thicknessMm: { type: Number },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' },
  attributes: { type: Object },
  credibilityScore: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes to speed up common queries and filters
ProductSchema.index({ countryCode: 1, active: 1 });
ProductSchema.index({ vendor: 1, active: 1 });
ProductSchema.index({ category: 1, active: 1 });
ProductSchema.index({ 'attributes.category': 1, active: 1 });
ProductSchema.index({ price: 1, active: 1 });
// Text index for name/material search (best-effort)
try {
  ProductSchema.index({ name: 'text', material: 'text' }, { name: 'product_text_idx', weights: { name: 4, material: 2 } });
} catch(_) { /* ignore duplicate index build */ }

module.exports = mongoose.models.MpProduct || mongoose.model('MpProduct', ProductSchema);
