import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { Project } from '../src/models/Project.js';
import { connectDB } from '../src/config/db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function isExternal(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

async function downloadBuffer(url, retries = 0, delayMs = 1000) {
  let attempt = 0;
  while (true) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.buffer();
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        throw new Error(`Failed after ${attempt} attempts (${err.message}) for ${url}`);
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function optimizeFromBuffer(buffer) {
  const base = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const thumbPath = path.join(uploadsDir, `${base}-thumb.webp`);
  const mediumPath = path.join(uploadsDir, `${base}-medium.webp`);
  const largePath = path.join(uploadsDir, `${base}-large.webp`);

  await sharp(buffer)
    .resize(400, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbPath);
  await sharp(buffer)
    .resize(800, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(mediumPath);
  await sharp(buffer)
    .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(largePath);

  return {
    thumbnail: `/uploads/${base}-thumb.webp`,
    medium: `/uploads/${base}-medium.webp`,
    large: `/uploads/${base}-large.webp`
  };
}

async function processProject(p, options) {
  const updates = {};
  let changed = false;
  const { retries, retryDelay, convertGallery, errors } = options;

  // Main image
  if (p.main_image_url && isExternal(p.main_image_url)) {
    try {
      const buf = await downloadBuffer(p.main_image_url, retries, retryDelay);
      const optimized = await optimizeFromBuffer(buf);
      updates.main_image_url = optimized.medium; // consistent with upload route response
      changed = true;
      console.log(`[LOCALIZE] Main image localized for ${p.slug}`);
    } catch (e) {
      const msg = `[LOCALIZE] Skip main image for ${p.slug}: ${e.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  }

  // Gallery images
  if (Array.isArray(p.gallery)) {
    const newGallery = [];
    for (const item of p.gallery) {
      if (item && item.url && isExternal(item.url) && convertGallery) {
        try {
          const buf = await downloadBuffer(item.url, retries, retryDelay);
            const optimized = await optimizeFromBuffer(buf);
            newGallery.push({
              url: optimized.large, // gallery entries use large variant
              title: item.title || { ar: '', en: '' },
              description: item.description || { ar: '', en: '' }
            });
            changed = true;
        } catch (e) {
          const msg = `[LOCALIZE] Skip gallery item (${p.slug}): ${e.message}`;
          console.warn(msg);
          errors.push(msg);
          // keep original external if failed
          newGallery.push(item);
        }
      } else {
        newGallery.push(item);
      }
    }
    if (changed) updates.gallery = newGallery; // only update if something changed
  }

  if (changed) {
    await Project.findByIdAndUpdate(p._id, updates, { new: true });
  }
  return changed;
}

async function run() {
  const { MONGO_URI } = process.env;
  if (!MONGO_URI) {
    console.error('[LOCALIZE] Missing MONGO_URI');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const convertGallery = args.includes('--gallery');
  const dryRun = args.includes('--dry');
  const slugIndex = args.indexOf('--slug');
  const targetSlug = slugIndex !== -1 ? args[slugIndex + 1] : null;
  const retryIndex = args.indexOf('--retry');
  const retries = retryIndex !== -1 ? parseInt(args[retryIndex + 1], 10) || 0 : 0;
  const retryDelayIndex = args.indexOf('--retry-delay');
  const retryDelay = retryDelayIndex !== -1 ? parseInt(args[retryDelayIndex + 1], 10) || 1000 : 1000;
  const errors = [];

  await connectDB(MONGO_URI);
  console.log('[LOCALIZE] Connected');

  const query = targetSlug ? { slug: targetSlug } : {};
  const projects = await Project.find(query);
  console.log(`[LOCALIZE] Loaded ${projects.length} projects`);
  if (targetSlug && projects.length === 0) {
    console.warn(`[LOCALIZE] No project found for slug: ${targetSlug}`);
  }

  let mainConverted = 0;
  let galleryConverted = 0;
  for (const p of projects) {
    const hadExternalMain = p.main_image_url && isExternal(p.main_image_url);
    const hadExternalGallery = Array.isArray(p.gallery) && p.gallery.some(g => isExternal(g.url));

    if (dryRun) {
      if (hadExternalMain) console.log(`[DRY] Would localize main image for ${p.slug}`);
      if (convertGallery && hadExternalGallery) console.log(`[DRY] Would localize ${p.slug} gallery externals`);
      continue;
    }

    const changed = await processProject(p, { convertGallery, retries, retryDelay, errors });
    if (changed) {
      if (hadExternalMain) mainConverted++;
      if (convertGallery && hadExternalGallery) galleryConverted++;
    }
  }

  console.log('\n[LOCALIZE] Summary:');
  console.log(`  - Main images localized: ${mainConverted}`);
  if (convertGallery) console.log(`  - Galleries localized: ${galleryConverted}`);
  else console.log('  - Galleries localized: (skipped)');
  console.log(`  - Retries used: ${retries}`);
  if (errors.length) {
    const logPath = path.resolve(__dirname, '../../localize-errors.log');
    fs.appendFileSync(logPath, errors.map(e => `[${new Date().toISOString()}] ${e}\n`).join(''));
    console.log(`  - Errors: ${errors.length} (logged to localize-errors.log)`);
  } else {
    console.log('  - Errors: 0');
  }

  await mongoose.connection.close();
  console.log('[LOCALIZE] Done.');
  process.exit(0);
}

run();
