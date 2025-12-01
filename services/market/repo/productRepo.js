'use strict';
const MpProduct = require('../../../models/marketplace/Product');
const MpVendor = require('../../../models/marketplace/Vendor');
const MpWarehouse = require('../../../models/marketplace/Warehouse');
const MpProductVariant = require('../../../models/marketplace/ProductVariant');

async function createProduct(doc){
  const m = new MpProduct(doc);
  return m.save();
}

async function findBySku(sku){
  return MpProduct.findOne({ sku }).exec();
}

const { buildRegexFromSynonyms } = require('../search/synonyms');
const { signUrl, isEnabled: signingEnabled } = require('../mediaUrlSigner');

async function searchProducts({ countryCode, q, material, thickness, vendorRatingMin, warehouseRatingMin, employeeRatingMin, priceMin, priceMax, page=1, limit=20, expand, sort='rank', rankWeights, mediaFields, _expandTokens, mode, rankTuneVer, tunedWeights, category, rating_min }){
  // Parse and normalize rank weights (support named keys and fallback numeric csv)
  let wCred=0.5, wPrice=0.3, wFresh=0.2, wMedia=0.0; // default media weight 0 to preserve previous behavior
  // If tunedWeights provided and no explicit rankWeights override, adopt them
  if(!rankWeights && tunedWeights && typeof tunedWeights === 'object'){
    const { credibility, price, freshness, media } = tunedWeights;
    if([credibility,price,freshness,media].every(v => typeof v === 'number')){
      const sum = credibility + price + freshness + media;
      if(sum > 0){
        wCred = credibility/sum; wPrice = price/sum; wFresh = freshness/sum; wMedia = media/sum;
      }
    }
  }
  if(rankWeights){
    // expected like credibility:5,price:1,freshness:3 OR "0.5,0.3,0.2"
    const str = String(rankWeights).trim();
    if(str.includes(':')){
      const map = {};
      str.split(',').forEach(part=>{
        const [k,v] = part.split(':').map(s=>s.trim());
        const key = (k||'').toLowerCase();
        const num = parseFloat(v);
        if(!isNaN(num) && num > 0){ map[key] = num; }
      });
      const c = map.credibility, p = map.price, f = map.freshness, m = map.media;
      const arr = [c,p,f,m].filter(n=>typeof n==='number');
      const sum = arr.reduce((a,b)=>a+b,0);
      if(sum > 0 && arr.length){
        wCred = (c||0)/sum; wPrice=(p||0)/sum; wFresh=(f||0)/sum; wMedia=(m||0)/sum;
      }
    } else {
      const parts = str.split(',').map(s=>parseFloat(s.trim()));
      if((parts.length===3 || parts.length===4) && parts.every(n=>!isNaN(n) && n>=0)){
        const sum = parts.reduce((a,b)=>a+b,0) || 1;
        wCred = (parts[0]||0)/sum; wPrice=(parts[1]||0)/sum; wFresh=(parts[2]||0)/sum; wMedia=(parts[3]||0)/sum;
      }
    }
  }

  const criteria = { countryCode, active: true };
  if(material) criteria.material = material;
  if(thickness){
      // Category filter: support either explicit field `category` or inside attributes.category
      if(category){
        const cat = String(category).trim();
        Object.assign(criteria, { $or: [ { category: cat }, { 'attributes.category': cat } ] });
      }
      // Rating min shortcut mapped to vendor rating when available
      if(rating_min && !vendorRatingMin){ vendorRatingMin = Number(rating_min); }
    const list = String(thickness).split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
    if(list.length){ criteria.thicknessCm = { $in: list }; }
  }
  if(priceMin){ criteria.price = Object.assign(criteria.price||{}, { $gte: Number(priceMin) }); }
  if(priceMax){ criteria.price = Object.assign(criteria.price||{}, { $lte: Number(priceMax) }); }

  const tokens = Array.isArray(_expandTokens) ? _expandTokens : [];
  const exp = String(expand || 'both').toLowerCase();
  const needVendorForFilter = !!(vendorRatingMin || warehouseRatingMin || employeeRatingMin);
  const includeVendor = tokens.includes('vendor') || needVendorForFilter;
  const includeWarehouse = tokens.includes('warehouse');
  const includeMedia = tokens.includes('media');
  const includeVariants = tokens.includes('variants');

  const pipeline = [];
  pipeline.push({ $match: criteria });
  if(q){
    const syn = buildRegexFromSynonyms(q) || new RegExp(q, 'i');
    pipeline.push({ $match: { $or: [ { name: syn }, { material: syn } ] } });
  }

  if(includeVendor){
    pipeline.push({
      $lookup: {
        from: MpVendor.collection.name,
        localField: 'vendor',
        foreignField: '_id',
        as: 'vendorObj'
      }
    });
    pipeline.push({ $unwind: { path: '$vendorObj', preserveNullAndEmptyArrays: true } });
    pipeline.push({
      $addFields: {
        _vr: { $ifNull: ['$vendorObj.ratings.vendor', 0] },
        _wr: { $ifNull: ['$vendorObj.ratings.warehouse', 0] },
        _er: { $ifNull: ['$vendorObj.ratings.employee', 0] }
      }
    });
    if(vendorRatingMin){ pipeline.push({ $match: { _vr: { $gte: Number(vendorRatingMin) } } }); }
    if(warehouseRatingMin){ pipeline.push({ $match: { _wr: { $gte: Number(warehouseRatingMin) } } }); }
    if(employeeRatingMin){ pipeline.push({ $match: { _er: { $gte: Number(employeeRatingMin) } } }); }
  }

  if(includeWarehouse){
    pipeline.push({
      $lookup: {
        from: MpWarehouse.collection.name,
        localField: 'warehouse',
        foreignField: '_id',
        as: 'warehouseObj'
      }
    });
    pipeline.push({ $unwind: { path: '$warehouseObj', preserveNullAndEmptyArrays: true } });
  }

  // Ensure mediaCount is available even when media array is not expanded (lightweight summary)
  if(!includeMedia){
    pipeline.push({
      $lookup: {
        from: require('../../../models/marketplace/ProductMedia').collection.name,
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$product', '$$pid'] } } },
          { $group: { _id: '$product', count: { $sum: 1 } } }
        ],
        as: 'mediaSummary'
      }
    });
    pipeline.push({
      $addFields: {
        mediaCount: { $ifNull: [ { $arrayElemAt: ['$mediaSummary.count', 0] }, 0 ] }
      }
    });
    pipeline.push({ $unset: 'mediaSummary' });
  }

  // Compute media summary and items only when media expansion is requested to keep the pipeline light
  if(includeMedia){
    pipeline.push({
      $lookup: {
        from: require('../../../models/marketplace/ProductMedia').collection.name,
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$product', '$$pid'] } } },
          { $group: { _id: '$product', count: { $sum: 1 }, avgQS: { $avg: '$qualityScore' }, types: { $addToSet: '$type' } } }
        ],
        as: 'mediaSummary'
      }
    });
    pipeline.push({
      $addFields: {
        mediaCount: { $ifNull: [ { $arrayElemAt: ['$mediaSummary.count', 0] }, 0 ] },
        mediaAvgQS: { $ifNull: [ { $arrayElemAt: ['$mediaSummary.avgQS', 0] }, 0 ] },
        mediaTypesCount: { $size: { $ifNull: [ { $arrayElemAt: ['$mediaSummary.types', 0] }, [] ] } }
      }
    });
    pipeline.push({ $unset: 'mediaSummary' });
  }

  if(includeVariants){
    pipeline.push({
      $lookup: {
        from: MpProductVariant.collection.name,
        localField: '_id',
        foreignField: 'product',
        as: 'variants'
      }
    });
  }

  if(includeMedia){
    // Additionally fetch concrete media items for response
    pipeline.push({
      $lookup: {
        from: require('../../../models/marketplace/ProductMedia').collection.name,
        localField: '_id',
        foreignField: 'product',
        as: 'mediaItems'
      }
    });
    // Compute weighted media quality and presence flags for diversity boosts
    pipeline.push({
      $addFields: {
        mediaWeightedQS: {
          $cond: [
            { $eq: [ { $size: '$mediaItems' }, 0 ] },
            0,
            {
              $divide: [
                {
                  $sum: {
                    $map: {
                      input: '$mediaItems',
                      as: 'm',
                      in: {
                        $multiply: [
                          { $cond: [ { $eq: [ { $indexOfArray: ['$mediaItems', '$$m'] }, 0 ] }, 1.5, 1 ] },
                          { $cond: [ { $eq: ['$$m.type','video'] }, 1.2, { $cond: [ { $eq: ['$$m.type','view360'] }, 1.3, 1 ] } ] },
                          { $ifNull: ['$$m.qualityScore', 0] }
                        ]
                      }
                    }
                  }
                },
                {
                  $sum: {
                    $map: {
                      input: '$mediaItems',
                      as: 'm',
                      in: {
                        $multiply: [
                          { $cond: [ { $eq: [ { $indexOfArray: ['$mediaItems', '$$m'] }, 0 ] }, 1.5, 1 ] },
                          { $cond: [ { $eq: ['$$m.type','video'] }, 1.2, { $cond: [ { $eq: ['$$m.type','view360'] }, 1.3, 1 ] } ] }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          ]
        },
        mediaHasVideo: { $gt: [ { $size: { $filter: { input: '$mediaItems', as: 'x', cond: { $eq: ['$$x.type','video'] } } } }, 0 ] },
        mediaHas360: { $gt: [ { $size: { $filter: { input: '$mediaItems', as: 'x', cond: { $eq: ['$$x.type','view360'] } } } }, 0 ] }
      }
    });
  }

  // Precompute base fields used in stats/ranking
  pipeline.push({
    $addFields: {
      _p: { $ifNull: ['$price', 0] },
      _t: { $ifNull: ['$createdAt', new Date(0)] },
      _mediaRaw: {
        $add: [
          { $multiply: [ { $ifNull: ['$mediaWeightedQS', 0] }, { $ln: { $add: [1, { $ifNull: ['$mediaCount', 0] }] } } ] },
          { $min: [ { $multiply: [ { $max: [ { $subtract: [ { $ifNull: ['$mediaTypesCount', 0] }, 1 ] }, 0 ] }, 0.1 ] }, 0.3 ] },
          { $cond: [ '$mediaHasVideo', 0.25, 0 ] },
          { $cond: [ '$mediaHas360', 0.2, 0 ] }
        ]
      }
    }
  });

  // Build facet to compute stats and carry data forward
  pipeline.push({
    $facet: {
      data: [ ],
      stats: [ { $group: { _id: null, pMin: { $min: '$_p' }, pMax: { $max: '$_p' }, tMin: { $min: '$_t' }, tMax: { $max: '$_t' }, mMin: { $min: '$_mediaRaw' }, mMax: { $max: '$_mediaRaw' } } } ],
      totalCount: [ { $count: 'count' } ]
    }
  });
  pipeline.push({ $set: { statsObj: { $arrayElemAt: ['$stats', 0] }, totalObj: { $arrayElemAt: ['$totalCount', 0] } } });
  pipeline.push({ $unwind: { path: '$data', preserveNullAndEmptyArrays: true } });
  // Compute normalized fields and composite score
  pipeline.push({
    $set: {
      'data._priceN': {
        $cond: [
          { $eq: ['$$REMOVE', '$$REMOVE'] }, // placeholder (ignored), keep structure explicit
          0.5,
          {
            $cond: [
              { $eq: ['$statsObj.pMax', '$statsObj.pMin'] },
              0.5,
              { $divide: [ { $subtract: ['$statsObj.pMax', '$data._p'] }, { $cond: [ { $eq: ['$statsObj.pMax', '$statsObj.pMin'] }, 1, { $subtract: ['$statsObj.pMax', '$statsObj.pMin'] } ] } ] }
            ]
          }
        ]
      },
      'data._freshN': {
        $cond: [
          { $eq: ['$statsObj.tMax', '$statsObj.tMin'] },
          0.5,
          { $divide: [ { $subtract: [{ $toLong: '$data._t' }, { $toLong: '$statsObj.tMin' }] }, { $cond: [ { $eq: ['$statsObj.tMax', '$statsObj.tMin'] }, 1, { $subtract: [ { $toLong: '$statsObj.tMax' }, { $toLong: '$statsObj.tMin' } ] } ] } ] }
        ]
      },
      'data._credRaw': { $ifNull: ['$data.credibilityScore', { $ifNull: ['$data.vendorObj.ratings.vendor', 0] }] },
      'data._mediaN': {
        $cond: [
          { $eq: ['$statsObj.mMax', '$statsObj.mMin'] },
          0.5,
          { $divide: [ { $subtract: ['$data._mediaRaw', '$statsObj.mMin'] }, { $cond: [ { $eq: ['$statsObj.mMax', '$statsObj.mMin'] }, 1, { $subtract: ['$statsObj.mMax', '$statsObj.mMin'] } ] } ] }
        ]
      }
    }
  });
  pipeline.push({
    $set: {
      'data._credN': {
        $cond: [ { $lte: ['$data._credRaw', 5] }, { $divide: ['$data._credRaw', 5] }, { $divide: ['$data._credRaw', 100] } ]
      },
      'data._score': { $add: [ { $multiply: [wCred, '$data._credN'] }, { $multiply: [wPrice, '$data._priceN'] }, { $multiply: [wFresh, '$data._freshN'] }, { $multiply: [wMedia, '$data._mediaN'] } ] }
    }
  });

  // Sorting
  if(sort === 'popular'){
    // Popularity: approximate score using media presence + recency + price affordability.
    // Compute a popularity raw score first.
    pipeline.push({
      $addFields: {
        'data._popRaw': {
          $add: [
            // Media boost (scaled 0..0.6)
            { $multiply: [ { $cond: [ { $gt: ['$mediaCount', 0] }, 0.6, 0 ] }, { $cond: [ { $gt: ['$mediaCount', 3] }, 1.1, 1 ] } ] },
            // Video & 360 add small boosts
            { $cond: [ '$mediaHasVideo', 0.15, 0 ] },
            { $cond: [ '$mediaHas360', 0.15, 0 ] },
            // Freshness factor (recent items get up to 0.4)
            { $cond: [ { $gt: ['$_t', new Date(Date.now() - 30*24*60*60*1000)] }, 0.4, { $cond: [ { $gt: ['$_t', new Date(Date.now() - 120*24*60*60*1000)] }, 0.15, 0 ] } ] },
            // Price affordability (lower price -> slight boost up to 0.3)
            { $cond: [ { $and: [ { $gt: ['$statsObj.pMax', '$statsObj.pMin'] }, { $gte: ['$statsObj.pMax', 1] } ] }, { $multiply: [0.3, { $cond: [ { $lte: ['$statsObj.pMin', 0] }, 0.5, { $divide: [ { $subtract: ['$statsObj.pMax', '$_p'] }, { $subtract: ['$statsObj.pMax', '$statsObj.pMin'] } ] } ] }] }, 0.1 ] }
          ]
        }
      }
    });
    pipeline.push({ $sort: { 'data._popRaw': -1, 'data.createdAt': -1, 'data._id': 1 } });
  } else if(sort === 'price_asc'){
    pipeline.push({ $sort: { 'data.price': 1, 'data._id': 1 } });
  } else if(sort === 'price_desc'){
    pipeline.push({ $sort: { 'data.price': -1, 'data._id': 1 } });
  } else if(sort === 'newest'){
    pipeline.push({ $sort: { 'data.createdAt': -1, 'data._id': 1 } });
  } else {
    // default rank
    pipeline.push({ $sort: { 'data._score': -1, 'data._id': 1 } });
  }

  const skip = (Number(page) - 1) * Number(limit);
  pipeline.push({ $facet: { pageItems: [ { $skip: skip }, { $limit: Number(limit) } ] } });
  pipeline.push({ $set: { total: { $ifNull: ['$totalObj.count', 0] } } });
  pipeline.push({ $unwind: { path: '$pageItems', preserveNullAndEmptyArrays: true } });
  pipeline.push({ $replaceRoot: { newRoot: { $mergeObjects: [ '$pageItems.data', { _meta_total: '$total' } ] } } });
  // After replaceRoot, records are the actual product docs (with optional vendorObj/warehouseObj) plus _meta_total on each row

  // Execute aggregation
  const rows = await MpProduct.aggregate(pipeline).exec();
  const total = rows.length ? rows[0]._meta_total : 0;

  // Shape response and honor expand flags by coercing relations to ids if needed
  const items = rows.map(r => {
    const d = { ...r };
  delete d._meta_total;
    delete d._p; delete d._t; delete d._priceN; delete d._freshN; delete d._credRaw; delete d._credN; delete d._score;
    // Map vendor/warehouse expansion
    if(includeVendor){
      // rename vendorObj -> vendor
      if(d.vendorObj){ d.vendor = d.vendorObj; delete d.vendorObj; }
    } else {
      // ensure vendor is id string
      if(d.vendor && d.vendor._id){ d.vendor = String(d.vendor._id); }
      if(d.vendorObj && d.vendorObj._id){ d.vendor = String(d.vendorObj._id); delete d.vendorObj; }
    }
    if(includeWarehouse){
      if(d.warehouseObj){ d.warehouse = d.warehouseObj; delete d.warehouseObj; }
    } else {
      if(d.warehouse && d.warehouse._id){ d.warehouse = String(d.warehouse._id); }
      if(d.warehouseObj && d.warehouseObj._id){ d.warehouse = String(d.warehouseObj._id); delete d.warehouseObj; }
    }
    // If expand=none explicitly, coerce both to ids
    if(exp === 'none'){
      if(d.vendor && d.vendor._id){ d.vendor = String(d.vendor._id); }
      if(d.warehouse && d.warehouse._id){ d.warehouse = String(d.warehouse._id); }
    }
    // Media handling: if included keep limited fields, else remove array but keep count
    if(includeMedia){
      if(Array.isArray(d.mediaItems)){
        // Select media fields according to mediaFields param (case-insensitive)
        const allowedLower = new Set(['_id','type','url','qualityscore','meta','all','basic','full','thumb']);
        const defaultOrder = ['_id','type','url','qualityscore','meta'];
        const toCanonProp = t => ({ '_id':'_id', 'type':'type', 'url':'url', 'qualityscore':'qualityScore', 'meta':'meta', 'thumb':'thumb' })[t];
        const normalizeToken = t => {
          switch(t){
            case 'id': return '_id';
            case 'qs':
            case 'quality':
            case 'score':
            case 'qualityscore': return 'qualityscore';
            case 'basic': return 'basic';
            case 'full': return 'all';
            case 'thumb': return 'thumb';
            default: return t;
          }
        };
        let order = null;
        if(typeof mediaFields === 'string' && mediaFields.trim()){
          const tokens = String(mediaFields)
            .split(',')
            .map(s=>s.trim().toLowerCase())
            .map(normalizeToken)
            .filter(s=> allowedLower.has(s));
          if(tokens.includes('all') || tokens.includes('full')){
            order = defaultOrder.slice();
          } else if(tokens.length){
            // de-duplicate while preserving order
            const seen = new Set();
            order = [];
            for(const t of tokens){ if(!seen.has(t)){ seen.add(t); order.push(t); } }
          }
        }
        // Expand presets if present inside order
        const expandPreset = token => token === 'basic' ? ['type','url'] : (token === 'thumb' ? ['_id','type','thumb'] : [token]);
        const expanded = (order && order.length ? order : defaultOrder).flatMap(expandPreset);
        const finalOrder = expanded;
        d.media = d.mediaItems.map(m => {
          const out = {};
          for(const key of finalOrder){
            const prop = toCanonProp(key);
            if(prop === '_id') out._id = m._id;
            else if(prop === 'type') out.type = m.type;
            else if(prop === 'url') out.url = signingEnabled() ? signUrl(m.url) : m.url;
            else if(prop === 'thumb') out.thumb = m.thumbUrl ? (signingEnabled() ? signUrl(m.thumbUrl) : m.thumbUrl) : (signingEnabled() ? signUrl(m.url) : m.url);
            else if(prop === 'qualityScore') out.qualityScore = m.qualityScore;
            else if(prop === 'meta') out.meta = m.meta;
          }
          return out;
        });
        delete d.mediaItems;
      }
    } else {
      if(d.mediaItems) delete d.mediaItems;
    }
    delete d.mediaWeightedQS; delete d.mediaHasVideo; delete d.mediaHas360;
    // Variants passthrough (limit fields)
    if(includeVariants && Array.isArray(d.variants)){
      d.variants = d.variants.map(v => ({ _id: v._id, thicknessCm: v.thicknessCm, thicknessMm: v.thicknessMm, size: v.size, price: v.price, currency: v.currency, stock: v.stock, active: v.active }));
    } else {
      if(d.variants) delete d.variants;
    }
    return d;
  });

  // Facets (page=1, mode=facets)
  let facets = null;
  if(mode === 'facets' && Number(page) === 1){
    const baseMatch = { countryCode, active: true };
    if(material) baseMatch.material = material;
    if(thickness){
      const list = String(thickness).split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
      if(list.length){ baseMatch.thicknessCm = { $in: list }; }
    }
    if(priceMin){ baseMatch.price = Object.assign(baseMatch.price||{}, { $gte: Number(priceMin) }); }
    if(priceMax){ baseMatch.price = Object.assign(baseMatch.price||{}, { $lte: Number(priceMax) }); }
    if(q){
      const syn = buildRegexFromSynonyms(q) || new RegExp(q, 'i');
      baseMatch.$or = [ { name: syn }, { material: syn } ];
    }
    const [matAgg, thickAgg] = await Promise.all([
      MpProduct.aggregate([ { $match: baseMatch }, { $group: { _id: '$material', c: { $sum: 1 } } } ]).exec(),
      MpProduct.aggregate([ { $match: baseMatch }, { $group: { _id: '$thicknessCm', c: { $sum: 1 } } } ]).exec()
    ]);
    const materials = {};
    for(const r of matAgg){ if(r._id) materials[r._id] = r.c; }
    const thicknesses = {};
    for(const r of thickAgg){ if(r._id != null) thicknesses[r._id] = r.c; }
    // Variant thickness facets (best-effort, limited to first 1000 products for performance)
    try{
      const prodIds = await MpProduct.find(baseMatch).select('_id').limit(1000).exec();
      if(prodIds.length){
        const idList = prodIds.map(d => d._id);
        const varAgg = await MpProductVariant.aggregate([
          { $match: { product: { $in: idList } } },
          { $group: { _id: '$thicknessCm', c: { $sum: 1 } } }
        ]).exec();
        const variantThicknesses = {};
        for(const r of varAgg){ if(r._id != null) variantThicknesses[r._id] = r.c; }
        facets = { materials, thicknesses, variantThicknesses };
      } else {
        facets = { materials, thicknesses };
      }
    } catch(_e){
      facets = { materials, thicknesses };
    }
  }

  let hint = null; if(q && String(q).length < 3){ hint = 'Query too short; consider adding more letters for better relevance'; }
  const out = { items, page: Number(page), limit: Number(limit), total: Number(total), rankTuneVer: rankTuneVer || null };
  if(facets){ out.meta = Object.assign(out.meta||{}, { facets }); }
  if(hint){ out.meta = Object.assign(out.meta||{}, { hint }); }
  return out;
}

async function resolveVendorDoc(countryCode, vendorCode){
  return MpVendor.findOne({ countryCode: String(countryCode).toUpperCase(), vendorCode: String(vendorCode) }).exec();
}

async function listSellerProducts({ countryCode, vendorId, page=1, limit=20, search, status }){
  const v = await resolveVendorDoc(countryCode, vendorId);
  if(!v) return { total: 0, items: [] };
  const criteria = { countryCode: String(countryCode).toUpperCase(), vendor: v._id };
  if(status){ criteria.active = (status === 'active'); }
  if(search && String(search).trim()){
    const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    Object.assign(criteria, { $or: [ { name: rx }, { sku: rx } ] });
  }
  const total = await MpProduct.countDocuments(criteria).exec();
  const rows = await MpProduct.find(criteria).sort({ createdAt: -1, _id: 1 }).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).exec();
  return { total, items: rows };
}

async function updateSellerProduct({ countryCode, idOrSku, patch }){
  const id = String(idOrSku||'');
  let doc = null;
  if(id.match(/^[0-9a-fA-F]{24}$/)){
    doc = await MpProduct.findById(id).exec();
  }
  if(!doc){ doc = await MpProduct.findOne({ sku: id }).exec(); }
  if(!doc) return null;
  Object.assign(doc, patch||{});
  await doc.save();
  return doc;
}

async function deleteSellerProduct({ countryCode, idOrSku }){
  const id = String(idOrSku||'');
  let res = null;
  if(id.match(/^[0-9a-fA-F]{24}$/)){
    res = await MpProduct.deleteOne({ _id: id }).exec();
  } else {
    res = await MpProduct.deleteOne({ sku: id }).exec();
  }
  return res && res.deletedCount > 0;
}

// ---- Variants (DB) ----
async function listVariantsForProduct({ productId }){
  const pid = String(productId||'');
  const filter = pid.match(/^[0-9a-fA-F]{24}$/) ? { product: pid } : {};
  if(!filter.product){
    const p = await MpProduct.findOne({ sku: pid }).select('_id').exec();
    if(!p) return [];
    filter.product = p._id;
  }
  return MpProductVariant.find({ product: filter.product }).sort({ createdAt: -1, _id: 1 }).exec();
}

async function createVariantForProduct({ productId, data }){
  const pid = String(productId||'');
  let productRef = null;
  if(pid.match(/^[0-9a-fA-F]{24}$/)){
    productRef = await MpProduct.findById(pid).select('_id').exec();
  } else {
    productRef = await MpProduct.findOne({ sku: pid }).select('_id').exec();
  }
  if(!productRef) throw new Error('Product not found');
  const doc = new MpProductVariant(Object.assign({}, data||{}, { product: productRef._id }));
  return doc.save();
}

async function updateVariantForProduct({ productId, variantId, patch }){
  const pid = String(productId||'');
  const vid = String(variantId||'');
  let productRef = null;
  if(pid.match(/^[0-9a-fA-F]{24}$/)){
    productRef = await MpProduct.findById(pid).select('_id').exec();
  } else {
    productRef = await MpProduct.findOne({ sku: pid }).select('_id').exec();
  }
  if(!productRef) return null;
  const v = await MpProductVariant.findOne({ _id: vid, product: productRef._id }).exec();
  if(!v) return null;
  Object.assign(v, patch||{});
  await v.save();
  return v;
}

async function deleteVariantForProduct({ productId, variantId }){
  const pid = String(productId||'');
  const vid = String(variantId||'');
  let productRef = null;
  if(pid.match(/^[0-9a-fA-F]{24}$/)){
    productRef = await MpProduct.findById(pid).select('_id').exec();
  } else {
    productRef = await MpProduct.findOne({ sku: pid }).select('_id').exec();
  }
  if(!productRef) return false;
  const res = await MpProductVariant.deleteOne({ _id: vid, product: productRef._id }).exec();
  return res && res.deletedCount > 0;
}

module.exports = { createProduct, findBySku, searchProducts, listSellerProducts, updateSellerProduct, deleteSellerProduct, listVariantsForProduct, createVariantForProduct, updateVariantForProduct, deleteVariantForProduct };