'use strict';

// Pluggable media storage adapter with optional S3 backend and signed URLs.
// Exports: uploadBuffer -> { ok, key, url, variants? }, getSignedUrl(key, ttl), storeBuffer (compat), publicUrlFor.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BACKEND = (process.env.MEDIA_BACKEND || 'local').toLowerCase();
const LOCAL_BASE_DIR = process.env.MEDIA_LOCAL_DIR || path.join(__dirname, '..', '..', '..', 'uploads', 'product-media');
const LOCAL_BASE_URL = process.env.MEDIA_LOCAL_URL_BASE || '/uploads/product-media';
const SIGNING_ENABLED = String(process.env.MEDIA_SIGNING_ENABLED || '0') === '1';
const SIGN_TTL = Number(process.env.MEDIA_SIGN_TTL_SECONDS || 3600);
const THUMBS_ENABLED = String(process.env.MEDIA_THUMBS_ENABLED || '1') === '1';
const ALLOWED_TYPES = (process.env.MEDIA_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function ensureDir(p){ try { fs.mkdirSync(p, { recursive: true }); } catch(_){} }

function extFromContentType(ct){
  if (!ct) return 'bin';
  if (ct === 'image/jpeg') return 'jpg';
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  return 'bin';
}

async function storeLocal({ key, buffer, contentType }){
  const abs = path.join(LOCAL_BASE_DIR, key);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, buffer);
  const url = LOCAL_BASE_URL + '/' + key.replace(/\\/g, '/');
  return { ok:true, url };
}

// Lazy S3 client loader to avoid hard dependency when not used
let _s3Client = null;
function getS3Client(){
  if (_s3Client) return _s3Client;
  const region = process.env.MEDIA_S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    _s3Client = new S3Client({ region });
    return _s3Client;
  } catch (e) {
    throw new Error('S3 backend selected but @aws-sdk/client-s3 is not installed');
  }
}

async function storeS3({ key, buffer, contentType }){
  const bucket = process.env.MEDIA_S3_BUCKET;
  if (!bucket) return { ok:false, error:'MEDIA_S3_BUCKET is required for s3 backend' };
  const s3 = getS3Client();
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const params = { Bucket: bucket, Key: key, Body: buffer };
  if (contentType) params.ContentType = contentType;
  await s3.send(new PutObjectCommand(params));
  const base = process.env.MEDIA_PUBLIC_BASE_URL || `https://${bucket}.s3.${process.env.MEDIA_S3_REGION || process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
  const url = base.replace(/\/$/, '') + '/' + String(key).replace(/\\/g, '/');
  return { ok:true, url };
}

async function storeBuffer(opts){
  const { key, buffer, contentType } = opts || {};
  if(!key || !buffer) return { ok:false, error:'key and buffer required' };
  if(BACKEND === 'local') return storeLocal({ key, buffer, contentType });
  if(BACKEND === 's3') return storeS3({ key, buffer, contentType });
  console.warn('[mediaStorage] Unsupported backend, falling back to local. BACKEND=', BACKEND);
  return storeLocal({ key, buffer, contentType });
}

function publicUrlFor(key){
  if(BACKEND === 'local') return LOCAL_BASE_URL + '/' + String(key).replace(/\\/g, '/');
  const base = process.env.MEDIA_PUBLIC_BASE_URL || LOCAL_BASE_URL;
  return base.replace(/\/$/, '') + '/' + String(key).replace(/\\/g, '/');
}

async function getSignedUrl(key, ttlSeconds){
  if (!SIGNING_ENABLED) return publicUrlFor(key);
  if (BACKEND !== 's3') return publicUrlFor(key);
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl: presign } = require('@aws-sdk/s3-request-presigner');
  const bucket = process.env.MEDIA_S3_BUCKET;
  const s3 = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await presign(s3, cmd, { expiresIn: Number(ttlSeconds || SIGN_TTL) });
}

async function generateThumbnails(buffer, contentType, baseKey){
  if (!THUMBS_ENABLED) return {};
  try {
    const ext = extFromContentType(contentType);
    const mk = (suffix) => baseKey.replace(/(\.[^.]+)?$/, `_${suffix}.${ext}`);
    const sizes = [
      { name:'thumb', width:150 },
      { name:'medium', width:600 },
      { name:'large', width:1200 }
    ];
    const out = {};
    for (const s of sizes) {
      const buf = await sharp(buffer).resize({ width: s.width, withoutEnlargement: true }).toBuffer();
      const key = mk(s.name);
      const r = await storeBuffer({ key, buffer: buf, contentType });
      if (r.ok) out[s.name] = { key, url: r.url };
    }
    return out;
  } catch (e) {
    console.warn('[mediaStorage] thumbnail generation failed:', e && e.message);
    return {};
  }
}

async function uploadBuffer({ buffer, contentType, filename }){
  if (!buffer) return { ok:false, error:'buffer_required' };
  const ct = String(contentType || '').toLowerCase();
  if (!ALLOWED_TYPES.includes(ct)) return { ok:false, error:'unsupported_media_type' };
  const ext = extFromContentType(ct);
  const safeName = (filename || `upload.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const datePrefix = new Date().toISOString().slice(0,10);
  const baseKey = [datePrefix, Math.random().toString(36).slice(2,10), safeName].join('/');
  const r = await storeBuffer({ key: baseKey, buffer, contentType: ct });
  if (!r.ok) return r;
  const variants = await generateThumbnails(buffer, ct, baseKey);
  return { ok:true, key: baseKey, url: r.url, variants };
}

module.exports = { 
  uploadBuffer,
  storeBuffer, 
  publicUrlFor, 
  getSignedUrl, 
  backend: BACKEND,
  ALLOWED_TYPES
};
