'use strict';
const mongoose = require('mongoose');
const ProductVariantSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'MpProduct', required: true, index: true },
  thicknessCm: { type: Number },
  thicknessMm: { type: Number },
  size: { type: String },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' },
  stock: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.models.MpProductVariant || mongoose.model('MpProductVariant', ProductVariantSchema);
