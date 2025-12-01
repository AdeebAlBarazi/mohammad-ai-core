// systems/marketplace/src/controllers/productsController.js
const Product = require('../models/Product');
const { isConnected } = require('../db/connect');
const { generateSku, randomIdHex } = require('../utils/sku');
const { resolveCountry, getCurrencyForCountry } = require('../utils/country');

// In-memory fallback store if Mongo not connected
const memoryStore = { products: [] };

function buildQuery(qs) {
    const q = { active: true };
    if (qs.search) {
        const re = new RegExp(qs.search, 'i');
        q.$or = [{ name: re }, { description: re }, { sku: re }];
    }
    if (qs.category) q.category = qs.category;
    if (qs.vendorId) q.vendorId = qs.vendorId;
    if (qs.countryCode) q.countryCode = qs.countryCode.toUpperCase();
    return q;
}

async function listProducts(req, res) {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const query = buildQuery(req.query);
        if (!isConnected() || String(process.env.MARKET_PREFER_MEMORY || '0') === '1') {
            // Memory mode filtering
            let items = memoryStore.products.filter(p => {
                if (query.category && p.category !== query.category) return false;
                if (query.vendorId && p.vendorId !== query.vendorId) return false;
                if (query.countryCode && p.countryCode !== query.countryCode) return false;
                if (query.$or) {
                    const txt = (p.name + ' ' + (p.description || '') + ' ' + (p.sku || '')).toLowerCase();
                    const needle = String(req.query.search || '').toLowerCase();
                    if (needle && !txt.includes(needle)) return false;
                }
                return true;
            });
            const total = items.length;
            items = items.slice(skip, skip + limit);
            return res.json({ ok: true, items, total, page, limit, mode: 'memory' });
        }
        const [items, total] = await Promise.all([
            Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Product.countDocuments(query)
        ]);
        res.json({ ok: true, items, total, page, limit, mode: 'mongo' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}

async function createProduct(req, res) {
    try {
        const body = req.body || {};
        if (!body.name) { return res.status(400).json({ ok: false, error: 'name required' }); }

        // Normalize basics
        const name = String(body.name).trim();
        const countryCode = String(body.countryCode || req.query.countryCode || resolveCountry(req) || 'SA').toUpperCase();
        const categoryId = body.categoryId || (String(body.category || '').match(/^\d{2}$/) ? body.category : null) || '01';
        const category = body.category || categoryId || 'general';

        // Currency by country unless explicitly provided
        const currency = body.currency || getCurrencyForCountry(countryCode);

        // Generate SKU if not provided and we have required parts
        let sku = String(body.sku || '').trim();
        if (!sku) {
            try {
                if (!body.vendorId) { throw new Error('vendorId required for SKU'); }
                sku = generateSku({ countryCode, vendorId: body.vendorId, categoryId, productId: randomIdHex(4) });
            } catch (_e) {
                sku = 'SKU-' + randomIdHex(6);
            }
        }

        const payload = {
            name,
            description: body.description || '',
            category,
            price: Number(body.price || 0),
            currency,
            stock: Number(body.stock || body.quantity || 0),
            sku,
            vendorId: body.vendorId || null,
            countryCode,
            media: Array.isArray(body.media) ? body.media : [],
            active: true
        };
        if (!isConnected() || String(process.env.MARKET_PREFER_MEMORY || '0') === '1') {
            // Ensure unique SKU in memory mode (retry few times)
            if (memoryStore.products.some(p => String(p.sku) === String(payload.sku))) {
                for (let i = 0; i < 3; i++) {
                    try { payload.sku = generateSku({ countryCode, vendorId: body.vendorId || '000', categoryId, productId: randomIdHex(4) }); } catch (_) { payload.sku = 'SKU-' + randomIdHex(6); }
                    if (!memoryStore.products.some(p => String(p.sku) === String(payload.sku))) break;
                }
            }
            memoryStore.products.push(Object.assign({}, payload, { createdAt: new Date(), updatedAt: new Date() }));
            return res.status(201).json({ ok: true, item: payload, mode: 'memory' });
        }
        const doc = await Product.create(payload);
        return res.status(201).json({ ok: true, item: doc, mode: 'mongo' });
    } catch (e) {
        if (e && e.code === 11000) { return res.status(409).json({ ok: false, error: 'SKU_DUPLICATE' }); }
        res.status(500).json({ ok: false, error: e.message });
    }
}

module.exports = { listProducts, createProduct };
async function deleteProduct(req, res) {
    try {
        const idOrSku = String((req.params && req.params.id) || req.body && (req.body.id || req.body.sku) || '').trim();
        if (!idOrSku) return res.status(400).json({ ok: false, error: 'id_required' });
        if (!isConnected()) {
            const before = memoryStore.products.length;
            const remain = memoryStore.products.filter(p => String(p.sku) !== idOrSku && String(p._id || p.id || '') !== idOrSku);
            memoryStore.products = remain;
            const removed = before - remain.length;
            if (removed > 0) return res.json({ ok: true, removed });
            return res.status(404).json({ ok: false, error: 'not_found' });
        }
        const r = await Product.deleteOne({ $or: [ { sku: idOrSku }, { _id: idOrSku } ] });
        if (r && (r.deletedCount || r.n)) return res.json({ ok: true, removed: r.deletedCount || r.n });
        return res.status(404).json({ ok: false, error: 'not_found' });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

module.exports.deleteProduct = deleteProduct;
