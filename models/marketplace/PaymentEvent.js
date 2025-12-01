'use strict';
// PaymentEvent ledger model for recording payment lifecycle events
const mongoose = require('mongoose');

const PaymentEventSchema = new mongoose.Schema({
  intentId: { type: String, required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'MpOrder', index: true },
  orderNumber: { type: String, index: true },
  provider: { type: String, required: true },
  eventType: { type: String, required: true, index: true },
  status: { type: String },
  amount: { type: Number },
  currency: { type: String, default: 'SAR' },
  customerEmail: { type: String, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  raw: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

// Compound index to quickly retrieve all events for an intent ordered by creation time
try {
  PaymentEventSchema.index({ intentId: 1, createdAt: -1 });
  PaymentEventSchema.index({ orderNumber: 1, createdAt: -1 });
} catch(_) { /* ignore duplicate build */ }

module.exports = mongoose.models.PaymentEvent || mongoose.model('PaymentEvent', PaymentEventSchema);
