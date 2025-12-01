'use strict';
const mongoose = require('mongoose');
const CredibilityScoreSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'MpVendor', required: true, index: true },
  finalScore: { type: Number, default: 0 },
  vendorRating: { type: Number, default: 0 },
  meta: { type: Object }
}, { timestamps: true });
module.exports = mongoose.models.MpCredibilityScore || mongoose.model('MpCredibilityScore', CredibilityScoreSchema);
