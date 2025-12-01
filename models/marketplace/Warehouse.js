'use strict';
const mongoose = require('mongoose');
const WarehouseSchema = new mongoose.Schema({
  countryCode: { type: String, required: true, index: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'MpVendor', required: true, index: true },
  name: { type: String, required: true },
  ratings: {
    warehouse: { type: Number, default: 0 },
    employee: { type: Number, default: 0 }
  }
}, { timestamps: true });
WarehouseSchema.index({ countryCode: 1, vendor: 1, name: 1 }, { unique: true });
module.exports = mongoose.models.MpWarehouse || mongoose.model('MpWarehouse', WarehouseSchema);
