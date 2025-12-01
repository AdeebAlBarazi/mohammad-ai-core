'use strict';

// SKU format: LP-MKT-<COUNTRY>-<VENDORID>-<CATEGORYID>-<PRODUCTID>
const PREFIX = 'LP-MKT';

function padId(n, size = 2){
  const s = String(n);
  return s.length >= size ? s : ('0'.repeat(size - s.length) + s);
}

function generateSku({ countryCode, vendorId, categoryId, productId }){
  if(!countryCode || !vendorId || !categoryId || !productId){
    throw new Error('Missing fields for SKU generation');
  }
  const cc = String(countryCode).toUpperCase();
  const v = padId(vendorId, 3);
  const c = padId(categoryId, 2);
  const p = String(productId);
  return `${PREFIX}-${cc}-${v}-${c}-${p}`;
}

function parseSku(sku){
  const raw = String(sku).trim();
  const parts = raw.split('-');
  // Expected pattern: LP MKT CC VVV CCID PRODID => length 6
  if(parts.length !== 6) throw new Error('Invalid SKU');
  const [prefix, mktTag, country, vendor, category, productId] = parts;
  if(prefix + '-' + mktTag !== PREFIX) throw new Error('Invalid SKU prefix');
  return {
    countryCode: country,
    vendorId: vendor,
    categoryId: category,
    productId
  };
}

module.exports = { generateSku, parseSku, PREFIX };
// Helpers
function randomIdHex(n=4){
  const crypto = require('crypto');
  try { return crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0,n).toUpperCase(); } catch(_e){ return Math.random().toString(16).slice(2,2+n).toUpperCase(); }
}
module.exports.randomIdHex = randomIdHex;