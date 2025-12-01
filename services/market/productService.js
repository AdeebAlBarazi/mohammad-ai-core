'use strict';
const { pipeline } = require('../../utils/market/ingest');
const memoryRepo = require('./repo/productRepo.memory');
const dbRepo = require('./repo/productRepo');
const mongoose = require('mongoose');

// Lazy-load models only when DB is connected to avoid overhead in memory mode
let MpVendor, MpWarehouse, MpCredibility;
function loadModels(){
  if(!MpVendor){
    MpVendor = require('../../models/marketplace/Vendor');
    MpWarehouse = require('../../models/marketplace/Warehouse');
    MpCredibility = require('../../models/marketplace/CredibilityScore');
  }
}

function repo(){
  // Choose DB repo if mongoose connection is ready, else memory fallback
  if(mongoose.connection && mongoose.connection.readyState === 1){
    return dbRepo;
  }
  return memoryRepo;
}

function resolveCountry(reqQuery, reqHeaders){
  if(reqQuery.country) return String(reqQuery.country).toUpperCase();
  // fallback default
  return 'SA';
}

async function createFromIngest(body){
  const res = pipeline(body);
  if(!res.ok){
    return { ok:false, errors: res.errors, stage: res.stage };
  }
  // Optional: find/create Vendor & Warehouse when using DB repo
  let vendorId, warehouseId, initialCred = null;
  const usingDb = mongoose.connection && mongoose.connection.readyState === 1;
  if(usingDb){
    loadModels();
    const countryCode = res.product.countryCode;
    const vendorCode = String(res.product.vendorId);
    const vendorName = (body.vendorName || body.vendorCompany || `Vendor ${vendorCode}`).trim();
    const whName = (body.warehouseName || 'Main Warehouse').trim();
    initialCred = Number(body.initialCredibility || body.vendorInitialScore || 50);

    // Ensure Vendor
    let vendor = await MpVendor.findOne({ countryCode, vendorCode }).exec();
    if(!vendor){
      vendor = new MpVendor({ countryCode, vendorCode, companyName: vendorName, ratings: { vendor: initialCred } });
      await vendor.save();
      // Record initial credibility snapshot (optional)
      try{
        await new MpCredibility({ vendor: vendor._id, finalScore: initialCred, vendorRating: initialCred }).save();
      }catch(_e){ /* ignore optional snapshot errors */ }
    }

    // Ensure Warehouse
    let wh = await MpWarehouse.findOne({ countryCode, vendor: vendor._id, name: whName }).exec();
    if(!wh){
      wh = new MpWarehouse({ countryCode, vendor: vendor._id, name: whName });
      await wh.save();
    }
    vendorId = vendor._id;
    warehouseId = wh._id;
  }
  const productDoc = {
    sku: res.sku,
    countryCode: res.product.countryCode,
    vendor: vendorId || res.product.vendor || undefined, // linked vendor when DB is available
    warehouse: warehouseId || undefined,
    name: res.product.name,
    material: res.product.material,
    thicknessCm: res.product.thicknessCm,
    thicknessMm: res.product.thicknessMm,
    price: body.price || null,
    currency: body.currency || 'SAR',
    attributes: {},
    credibilityScore: initialCred != null ? initialCred : 0,
    active: true
  };
  // Enforce uniqueness (memory path) naive: if SKU already exists, regenerate once
  if(!mongoose.connection || mongoose.connection.readyState !== 1){
    const existing = await repo().findBySku && await repo().findBySku(productDoc.sku);
    if(existing){
      try {
        const { generateSku, randomIdHex } = require('../../utils/market/sku');
        productDoc.sku = generateSku({ countryCode: res.product.countryCode, vendorId: res.product.vendorId, categoryId: res.product.categoryId, productId: randomIdHex(4) });
      } catch(_e) { /* ignore */ }
    }
  }
  await repo().createProduct(productDoc);
  return { ok:true, sku: res.sku };
}

// Unified search wrapper supporting legacy invocation (opts.query) and advanced options.
// Legacy path: search(countryCode, { page, limit, query: { search, categoryId } })
// Advanced path: search(countryCode, { q, page, limit, sort, material, thickness, category, priceMin, priceMax, vendorRatingMin, rating_min, _expandTokens, mode })
async function search(countryCode, opts){
  if(!opts) return repo().searchProducts({ countryCode, page:1, limit:20 });
  // Legacy shape detection
  if(Object.prototype.hasOwnProperty.call(opts,'query')){
    const { page=1, limit=20, query } = opts;
    const q = query && (query.search || query.q) || '';
    const category = query && (query.categoryId || query.category) || undefined;
    return repo().searchProducts({ countryCode, q, page, limit, category });
  }
  // Advanced shape passthrough
  return repo().searchProducts(Object.assign({ countryCode }, opts));
}

// Advanced explicit function (alias for external clarity)
async function advancedSearch(countryCode, opts){
  return search(countryCode, opts);
}

async function listSellerProducts(ctx){
  return repo().listSellerProducts(ctx);
}

async function updateSellerProduct(ctx){
  return repo().updateSellerProduct(ctx);
}

async function deleteSellerProduct(ctx){
  return repo().deleteSellerProduct(ctx);
}
// Variants CRUD wrappers (DB or memory fallback)
async function listVariantsForProduct({ productId }){
  if(repo().listVariantsForProduct) return repo().listVariantsForProduct({ productId });
  return [];
}

async function createVariantForProduct({ productId, data }){
  if(repo().createVariantForProduct) return repo().createVariantForProduct({ productId, data });
  return null;
}

async function updateVariantForProduct({ productId, variantId, patch }){
  if(repo().updateVariantForProduct) return repo().updateVariantForProduct({ productId, variantId, patch });
  return null;
}

async function deleteVariantForProduct({ productId, variantId }){
  if(repo().deleteVariantForProduct) return repo().deleteVariantForProduct({ productId, variantId });
  return false;
}

module.exports = { resolveCountry, createFromIngest, search, advancedSearch, listSellerProducts, updateSellerProduct, deleteSellerProduct, listVariantsForProduct, createVariantForProduct, updateVariantForProduct, deleteVariantForProduct };