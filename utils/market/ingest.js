'use strict';

// Product ingestion & normalization pipeline.
// High-level stages: validate -> normalize -> enrich -> generate SKU -> index-ready.

const { generateSku, randomIdHex } = require('./sku');

function validate(raw){
  const errors = [];
  if(!raw) errors.push('No data');
  if(!raw.countryCode) errors.push('countryCode required');
  if(!raw.vendorId) errors.push('vendorId required');
  if(!raw.categoryId) errors.push('categoryId required');
  if(!raw.name) errors.push('name required');
  if(!raw.thickness) errors.push('thickness required');
  if(errors.length) return { ok:false, errors };
  return { ok:true };
}

function normalize(raw){
  // Thickness: accept values like '2 cm', '3cm', '1.8 سم' and standardize to millimeters & centimeters.
  const thicknessStr = String(raw.thickness).replace(/سم|cm/gi,'').trim();
  const thicknessNum = parseFloat(thicknessStr);
  const thicknessMm = Math.round(thicknessNum * 10) * 1; // 2.0 -> 20 mm (approx for stone slabs simplified)

  return {
    countryCode: raw.countryCode.toUpperCase(),
    vendorId: raw.vendorId,
    categoryId: raw.categoryId,
    name: raw.name.trim(),
    material: raw.material || 'marble',
    thicknessCm: thicknessNum,
    thicknessMm,
    location: raw.location || null,
    media: raw.media || { images: [], video: null, view360: null },
    original: raw
  };
}

function enrich(normalized){
  // Placeholder AI enrichment logic (could integrate later): create SEO title & keywords.
  const seoTitle = `${normalized.name} ${normalized.thicknessCm}cm ${normalized.material}`;
  const keywords = [normalized.material, normalized.name, `${normalized.thicknessCm}cm`, 'supplier', 'quality'];
  return { ...normalized, seoTitle, keywords };
}

function pipeline(raw){
  const v = validate(raw);
  if(!v.ok) return { ok:false, stage:'validate', errors: v.errors };
  const normalized = normalize(raw);
  const enriched = enrich(normalized);
  // Use short random hex for productId (LAST4-like) to keep SKU compact; uniqueness enforced upstream
  const sku = generateSku({
    countryCode: enriched.countryCode,
    vendorId: enriched.vendorId,
    categoryId: enriched.categoryId,
    productId: randomIdHex(4)
  });
  return { ok:true, sku, product: enriched };
}

module.exports = { pipeline, validate, normalize, enrich };