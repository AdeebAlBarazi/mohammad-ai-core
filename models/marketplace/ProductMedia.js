'use strict';
const mongoose = require('mongoose');
const ProductMediaSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'MpProduct', required: true, index: true },
  type: { type: String, enum: ['image','video','view360','other'], default: 'image' },
  url: { type: String, required: true },
  thumbUrl: { type: String },
  qualityScore: { type: Number, default: 0 },
  meta: { type: Object }
}, { timestamps: true });
module.exports = mongoose.models.MpProductMedia || mongoose.model('MpProductMedia', ProductMediaSchema);
