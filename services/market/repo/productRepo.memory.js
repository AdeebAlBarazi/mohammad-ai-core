'use strict';
const { addProduct, searchProducts, ensureCountry, updateProduct, deleteProduct, listByVendor } = require('../../../utils/market/store');

async function createProduct(doc){
  addProduct(doc.countryCode, doc);
  return doc;
}

async function findBySku(sku){
  // naive scan for stub
  for(const cc of Object.keys(require('../../../utils/market/store').store || {})){
    const bucket = require('../../../utils/market/store').store[cc];
    const found = bucket.products.find(p => p.sku === sku);
    if(found) return found;
  }
  return null;
}

async function listSellerProducts({ countryCode, vendorId, page=1, limit=20, search, status }){
  return listByVendor(countryCode, vendorId, { page, limit, search, status });
}

async function updateSellerProduct({ countryCode, idOrSku, patch }){
  return updateProduct(countryCode, idOrSku, patch);
}

async function deleteSellerProduct({ countryCode, idOrSku }){
  return deleteProduct(countryCode, idOrSku);
}

async function searchProductsRepo({ countryCode, q, material, thickness, vendorRatingMin, warehouseRatingMin, employeeRatingMin, priceMin, priceMax, page=1, limit=20, sort, rankWeights, mode, rankTuneVer, tunedWeights }){
  // memory path does not yet implement tunedWeights blending; keep existing behavior
  return searchProducts(countryCode, { q, type: material, thickness, vendorRatingMin, warehouseRatingMin, employeeRatingMin, priceMin, priceMax, page, limit, sort, rankWeights, mode, rankTuneVer });
}

module.exports = { createProduct, findBySku, searchProducts: searchProductsRepo, listSellerProducts, updateSellerProduct, deleteSellerProduct };
 
// ---- Variants (Memory) ----
async function listVariantsForProduct({ productId }){
  const pid = String(productId||'');
  // scan all countries for simplicity in memory (ids are not globally unique here anyway)
  const st = require('../../../utils/market/store').store || {};
  for(const cc of Object.keys(st)){
    const bucket = st[cc];
    const idx = (bucket.products||[]).findIndex(p => String(p._id||p.id||p.sku) === pid || String(p.sku||'') === pid);
    if(idx !== -1){
      const curr = bucket.products[idx];
      return Array.isArray(curr.variants) ? curr.variants.slice() : [];
    }
  }
  return [];
}

async function createVariantForProduct({ productId, data }){
  const pid = String(productId||'');
  const st = require('../../../utils/market/store').store || {};
  for(const cc of Object.keys(st)){
    const bucket = st[cc];
    const idx = (bucket.products||[]).findIndex(p => String(p._id||p.id||p.sku) === pid || String(p.sku||'') === pid);
    if(idx !== -1){
      const curr = bucket.products[idx];
      const arr = Array.isArray(curr.variants) ? curr.variants.slice() : [];
      const v = Object.assign({ _id: String(Date.now())+Math.random().toString(16).slice(2,8), active: true }, data||{});
      arr.push(v);
      bucket.products[idx] = Object.assign({}, curr, { variants: arr });
      return v;
    }
  }
  return null;
}

async function updateVariantForProduct({ productId, variantId, patch }){
  const pid = String(productId||'');
  const vid = String(variantId||'');
  const st = require('../../../utils/market/store').store || {};
  for(const cc of Object.keys(st)){
    const bucket = st[cc];
    const idx = (bucket.products||[]).findIndex(p => String(p._id||p.id||p.sku) === pid || String(p.sku||'') === pid);
    if(idx !== -1){
      const curr = bucket.products[idx];
      const arr = Array.isArray(curr.variants) ? curr.variants.slice() : [];
      const vi = arr.findIndex(x => String(x._id||x.id) === vid);
      if(vi === -1) return null;
      arr[vi] = Object.assign({}, arr[vi], patch||{});
      bucket.products[idx] = Object.assign({}, curr, { variants: arr });
      return arr[vi];
    }
  }
  return null;
}

async function deleteVariantForProduct({ productId, variantId }){
  const pid = String(productId||'');
  const vid = String(variantId||'');
  const st = require('../../../utils/market/store').store || {};
  for(const cc of Object.keys(st)){
    const bucket = st[cc];
    const idx = (bucket.products||[]).findIndex(p => String(p._id||p.id||p.sku) === pid || String(p.sku||'') === pid);
    if(idx !== -1){
      const curr = bucket.products[idx];
      const arr = Array.isArray(curr.variants) ? curr.variants.slice() : [];
      const vi = arr.findIndex(x => String(x._id||x.id) === vid);
      if(vi === -1) return false;
      arr.splice(vi,1);
      bucket.products[idx] = Object.assign({}, curr, { variants: arr });
      return true;
    }
  }
  return false;
}

module.exports.listVariantsForProduct = listVariantsForProduct;
module.exports.createVariantForProduct = createVariantForProduct;
module.exports.updateVariantForProduct = updateVariantForProduct;
module.exports.deleteVariantForProduct = deleteVariantForProduct;