'use strict';
const mongoose = require('mongoose');
const VendorSchema = new mongoose.Schema({
  countryCode: { type: String, required: true, index: true },
  vendorCode: { type: String, required: true, index: true },
  companyName: { type: String },
  ratings: {
    vendor: { type: Number, default: 0 },
    warehouse: { type: Number, default: 0 },
    employee: { type: Number, default: 0 }
  }
}, { timestamps: true });
VendorSchema.index({ countryCode: 1, vendorCode: 1 }, { unique: true });
module.exports = mongoose.models.MpVendor || mongoose.model('MpVendor', VendorSchema);
