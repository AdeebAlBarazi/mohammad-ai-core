// Image diagnostics script
// Usage:
//   (PowerShell)
//   $env:MONGO_URI="mongodb://..."; $env:JWT_SECRET="test"; node api/scripts/diagnose-images.js
// This script will:
// 1. Connect to MongoDB
// 2. Fetch all projects
// 3. Check each main_image_url and gallery item for:
//    - URL shape (starts with /uploads/ or http)
//    - Physical file existence in the correct root uploads folder
//    - Mismatch where file exists in api/uploads but not root uploads
// 4. Print a summary table and exit with code 0 (even if missing files)

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { connectDB } from '../src/config/db.js';
import { Project } from '../src/models/Project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Correct root uploads path (as used by server.js): ../../uploads from scripts directory
const rootUploads = path.join(__dirname, '../../uploads');
// Legacy wrong path that may contain older files: ../uploads (inside api/)
const apiUploads = path.join(__dirname, '../uploads');

function exists(p){ try { return fs.existsSync(p); } catch { return false; } }

function normalizeUrl(u){
  if(!u) return '';
  // Accept already absolute http(s)
  if(/^https?:\/\//i.test(u)) return u;
  // Ensure leading slash for /uploads
  if(u.startsWith('uploads/')) return '/' + u;
  return u;
}

async function run(){
  const mongoUri = process.env.MONGO_URI;
  if(!mongoUri){
    console.error('[DIAG] MONGO_URI غير موجود في المتغيرات البيئية');
    process.exit(2);
  }
  await connectDB(mongoUri);
  const projects = await Project.find({}).sort({ createdAt: -1 });
  console.log(`[DIAG] عدد المشاريع: ${projects.length}`);

  let missingMain = 0;
  let missingGallery = 0;
  let legacyFound = 0;
  let okMain = 0;
  let okGallery = 0;

  const report = [];

  for(const p of projects){
    const main = normalizeUrl(p.main_image_url || '');
    let mainPhysical = null;
    let mainExists = false;
    let legacyExists = false;
    if(main && main.startsWith('/uploads/')){
      const fname = main.replace('/uploads/','');
      mainPhysical = path.join(rootUploads, fname);
      mainExists = exists(mainPhysical);
      if(!mainExists){
        const legacyCandidate = path.join(apiUploads, fname);
        if(exists(legacyCandidate)) legacyExists = true;
      }
    }
    if(main){
      if(mainExists) okMain++; else if(legacyExists){ legacyFound++; } else missingMain++;
    }
    const galleryItems = Array.isArray(p.gallery) ? p.gallery : [];
    let galleryMissingForProject = 0;
    let galleryLegacyForProject = 0;
    let galleryOkForProject = 0;
    for(const g of galleryItems){
      const url = normalizeUrl(typeof g === 'string' ? g : g.url);
      if(!url) continue;
      if(url.startsWith('/uploads/')){
        const gFile = url.replace('/uploads/','');
        const gPath = path.join(rootUploads, gFile);
        if(exists(gPath)){ galleryOkForProject++; okGallery++; }
        else {
          const legacy = path.join(apiUploads, gFile);
          if(exists(legacy)){ galleryLegacyForProject++; legacyFound++; }
          else { galleryMissingForProject++; missingGallery++; }
        }
      }
    }
    report.push({
      slug: p.slug,
      main: main || '—',
      mainExists,
      mainLegacy: legacyExists,
      galleryCount: galleryItems.length,
      galleryOkForProject,
      galleryLegacyForProject,
      galleryMissingForProject
    });
  }

  console.log('\n[DIAG] ملخص:');
  console.log(`  مشاريع: ${projects.length}`);
  console.log(`  صور رئيسية صحيحة: ${okMain}`);
  console.log(`  صور رئيسية مفقودة: ${missingMain}`);
  console.log(`  صور رئيسية في مجلد قديم (api/uploads): ${legacyFound}`);
  console.log(`  صور معرض صحيحة: ${okGallery}`);
  console.log(`  صور معرض مفقودة: ${missingGallery}`);
  console.log('\n[DIAG] أول 15 صف للتفاصيل:');
  for(const row of report.slice(0,15)){
    console.log(` - ${row.slug} | mainExists=${row.mainExists?'Y':'N'} legacy=${row.mainLegacy?'Y':'N'} | gallery ok=${row.galleryOkForProject} legacy=${row.galleryLegacyForProject} missing=${row.galleryMissingForProject}`);
  }

  if(legacyFound){
    console.warn('\n[DIAG] يوجد ملفات في المسار القديم (api/uploads). انقلها إلى المجلد الجذري uploads لتظهر عبر /uploads/.');
  }
  if(missingMain || missingGallery){
    console.warn('\n[DIAG] هناك صور مفقودة. تحقق من أن المسارات المخزنة في قاعدة البيانات تبدأ بـ /uploads/ وتم رفع الملفات بعد إصلاح المسار.');
  }

  console.log('\n[DIAG] اكتمل الفحص.');
  process.exit(0);
}

run().catch(err=>{
  console.error('[DIAG] خطأ غير متوقع:', err);
  process.exit(1);
});
