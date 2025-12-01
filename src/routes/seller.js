// systems/marketplace/src/routes/seller.js
// Minimal seller gateway router (CRUD products) with service fallback.
const express = require('express');
const router = express.Router();
const { withValidation, schemas } = require('../validation/validators');

// Try productService first, else fallback to productsController
let productService = null;
try { productService = require('../../services/market/productService'); } catch(_) {}
const productsCtrl = require('../controllers/productsController');
const productsCache = require('../../cache/productsCache');

function mapToSellerShape(p){
  return {
    id: p.sku || p.id || p._id || '',
    name: p.name || '',
    price: p.price != null ? p.price : 0,
    stock: p.stock != null ? p.stock : 0,
    status: p.active === false ? 'inactive' : 'active',
    image_url: Array.isArray(p.media) && p.media.length ? p.media[0].url || p.media[0] : null
  };
}

function deriveVendorCode(userId){
  return String(userId||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,12) || 'unknown';
}

// GET /products (scoped to seller's own vendor unless admin)
router.get('/products', async (req,res) => {
  try {
    const page = Math.max(1, Number(req.query.page)||1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit)||20));
    const search = (req.query.q||req.query.search||'').trim();
    const countryCode = (req.query.countryCode || 'SA').toUpperCase();
    const role = (req.user && req.user.role)||'user';
    const vendorId = role === 'admin' ? (req.query.vendorId || req.query.vendor || '') : deriveVendorCode(req.user && req.user.id);
    let items = []; let total = 0;
    if(productService && productService.search){
      try {
        const r = await productService.search(countryCode, { page, limit, query: { search, vendorId: vendorId || null } });
        if(r && Array.isArray(r.items)){ items = r.items; total = r.total || items.length; }
      } catch(e){ /* fallback */ }
    }
    if(!items.length){
      // Fallback using controller (memory or mongo) via artificial req/res wrapper
      const fakeReq = { query: { page, limit, search, countryCode, vendorId } };
      const fakeRes = { json: (payload) => { items = payload.items||[]; total = payload.total||items.length; }, status: (code) => ({ json: (obj) => res.status(code).json(obj) }) };
      await productsCtrl.listProducts(fakeReq, fakeRes);
    }
    const shaped = items.map(mapToSellerShape);
    res.json({ ok:true, items: shaped, total, page, limit });
  } catch(e){ res.status(500).json({ ok:false, error: e.message }); }
});

// POST /products (create)
router.post('/products', withValidation(schemas.sellerProductCreate), async (req,res) => {
  try {
    const body = req.body || {};
    if(!body.name) return res.status(400).json({ ok:false, error:'name required' });
    const userId = req.user && req.user.id;
    const vendorCode = deriveVendorCode(userId);
    body.vendorId = vendorCode; // enforce ownership
    // Prefer productService ingestion; derive minimal required fields if missing
    if(productService && productService.createFromIngest){
      const categoryId = body.categoryId || (String(body.category||'01').match(/\d{2}/) ? String(body.category) : '01');
      const thickness = body.thickness != null ? body.thickness : 20;
      const ingest = Object.assign({}, body, {
        countryCode: (body.countryCode || 'SA').toUpperCase(),
        vendorId: vendorCode,
        categoryId,
        thickness
      });
      const r = await productService.createFromIngest(ingest);
      if(!r.ok) return res.status(400).json(r);
      try { productsCache.invalidateAll(); } catch(_){}
      return res.status(201).json({ ok:true, sku: r.sku, mode:'service' });
    }
    // Fallback controller path
    const fakeReq = { body }; const fakeRes = { status: (c) => ({ json: (o) => res.status(c).json(o) }), json: (o) => res.status(201).json(o) };
    await productsCtrl.createProduct(fakeReq, fakeRes);
  } catch(e){ res.status(500).json({ ok:false, error: e.message }); }
});

// PATCH /products/:idOrSku
router.patch('/products/:id', async (req,res) => {
  try {
    const idOrSku = String(req.params.id||'');
    const patch = req.body || {};
    if(productService && productService.updateSellerProduct){
      const r = await productService.updateSellerProduct({ idOrSku, patch });
      if(!r) return res.status(404).json({ ok:false, error:'not_found' });
      // Ownership enforcement via SKU prefix containing vendorCode
      const vendorCode = deriveVendorCode(req.user && req.user.id);
      if(r.sku && !r.sku.includes(vendorCode) && (req.user && req.user.role)!=='admin'){
        return res.status(403).json({ ok:false, error:'forbidden' });
      }
      try { productsCache.invalidateAll(); } catch(_){}
      return res.json({ ok:true });
    }
    return res.status(501).json({ ok:false, error:'service_unavailable' });
  } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
});

// DELETE /products/:idOrSku
router.delete('/products/:id', async (req,res) => {
  try {
    const idOrSku = String(req.params.id||'');
    if(productService && productService.deleteSellerProduct){
      const countryCode = (req.query.countryCode || req.headers['x-country-code'] || 'SA').toUpperCase();
      const ok = await productService.deleteSellerProduct({ countryCode, idOrSku });
      if(!ok) return res.status(404).json({ ok:false, error:'not_found' });
      const vendorCode = deriveVendorCode(req.user && req.user.id);
      if(idOrSku && !idOrSku.includes(vendorCode) && (req.user && req.user.role)!=='admin'){
        return res.status(403).json({ ok:false, error:'forbidden' });
      }
      try { productsCache.invalidateAll(); } catch(_){}
      return res.json({ ok:true });
    }
    // Fallback to controller delete (memory or mongo)
    const fakeReq = { params: { id: idOrSku } };
    const fakeRes = { json: (o) => res.json(o), status: (c) => ({ json: (o) => res.status(c).json(o) }) };
    return productsCtrl.deleteProduct(fakeReq, fakeRes);
  } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
});

module.exports = router;
