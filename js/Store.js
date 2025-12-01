// axiom-marketplace/models/Store.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storeSchema = new Schema({
    // معرف صاحب المتجر من نظام المصادقة المركزي
    ownerUserId: { type: Schema.Types.ObjectId, required: true, index: true },

    name: {
        ar: { type: String, required: true, trim: true },
        en: { type: String, required: true, trim: true }
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: {
        ar: { type: String },
        en: { type: String }
    },
    logo: { type: String },
    banner: { type: String }, // صورة غلاف المتجر

    // الأقسام التي يعمل بها المتجر
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],

    contact: {
        phone: { type: String },
        email: { type: String },
        address: { type: String },
        city: { type: String },
        region: { type: String }
    },

    businessInfo: {
        commercialRegister: { type: String },
        taxNumber: { type: String },
        licenseUrl: { type: String }, // رابط صورة الرخصة
        verificationStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    },

    commission: {
        rate: { type: Number, default: 0.10 }, // 10%
        type: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }
    },

    rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 }
    },

    bankInfo: {
        bankName: { type: String },
        iban: { type: String },
        accountName: { type: String }
    },

    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false }, // متجر مميز
}, {
    timestamps: true
});

storeSchema.pre('save', function(next) {
    if (this.isModified('name.en')) {
        this.slug = this.name.en.toLowerCase().split(' ').join('-');
    }
    next();
});

module.exports = mongoose.model('Store', storeSchema);