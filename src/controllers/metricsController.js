// systems/marketplace/src/controllers/metricsController.js
const Product = require('../models/Product');

async function metrics(req, res) {
    try {
        // Compute counts (use lean for speed)
        const country = (req.query.countryCode || req.query.country || 'SA').toUpperCase();
        const [totalItems, categoriesAgg] = await Promise.all([
            Product.countDocuments({ countryCode: country, active: true }),
            Product.aggregate([
                { $match: { countryCode: country, active: true } },
                { $group: { _id: '$category', c: { $sum: 1 } } }
            ])
        ]);
        const categories = categoriesAgg.length;
        // Active vendors: distinct vendorId excluding null
        const vendorsAgg = await Product.distinct('vendorId', { countryCode: country, active: true, vendorId: { $ne: null } });
        const activeVendors = vendorsAgg.length;
        res.json({ ok: true, stats: { totalItems, categories, activeVendors }, country });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}

module.exports = { metrics };
