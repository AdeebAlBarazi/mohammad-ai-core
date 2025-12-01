// systems/marketplace/src/models/Product.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, index: true },
    description: { type: String },
    category: { type: String, index: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'SAR' },
    stock: { type: Number, default: 0 },
    sku: { type: String, unique: true, index: true },
    vendorId: { type: String },
    countryCode: { type: String, default: 'SA', index: true },
    media: [{
        type: { type: String, enum: ['image', 'video', 'view360'], default: 'image' },
        url: String,
        thumb: String
    }],
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.MpProduct || mongoose.model('MpProduct', ProductSchema);
