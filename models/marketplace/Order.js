'use strict';
// Minimal Order mongoose model (aligned with orderService usage)
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'MpProduct', required: false },
  sku: { type: String, required: true },
  name: { type: String },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'MpVendor', required: false },
  countryCode: { type: String, required: true },
  items: { type: [OrderItemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  currency: { type: String, default: 'SAR' },
  paymentStatus: { type: String, default: 'pending', index: true },
  fulfillmentStatus: { type: String, default: 'pending', index: true },
  shippingAddress: { type: Object },
  meta: { type: Object }
}, { timestamps: true });

module.exports = mongoose.models.MpOrder || mongoose.model('MpOrder', OrderSchema);
