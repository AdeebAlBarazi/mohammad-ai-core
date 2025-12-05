import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

// تعليمات الاستخدام:
// 1. ضع صور المشروع في مجلد باسم slug المشروع داخل مجلد project-images
// 2. مثال: project-images/saudi-concrete-factory-offices/image1.jpg
// 3. شغل السكريبت: node scripts/upload-project-images.js

const API_URL = 'http://localhost:3001/api';
const IMAGES_DIR = './project-images';

async function login() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'Admin2025!'
    })
  });
  
  const data = await response.json();
  return data.token;
}

async function uploadImage(token, imagePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));
  
  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });
  
  const data = await response.json();
  return data.url;
}

async function run() {
  console.log('[UPLOAD] Starting image upload process...');
  
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log(`[UPLOAD] Creating ${IMAGES_DIR} directory...`);
    console.log('[UPLOAD] Instructions:');
    console.log('  1. Create folders for each project using project slug');
    console.log('  2. Example: project-images/saudi-concrete-factory-offices/');
    console.log('  3. Put images inside: image1.jpg, image2.jpg, etc.');
    console.log('  4. Run this script again');
    fs.mkdirSync(IMAGES_DIR);
    return;
  }
  
  const token = await login();
  console.log('[UPLOAD] Logged in successfully');
  
  const projectDirs = fs.readdirSync(IMAGES_DIR);
  
  if (projectDirs.length === 0) {
    console.log('[UPLOAD] No project folders found in project-images/');
    console.log('[UPLOAD] Create folders with project slugs and add images');
    return;
  }
  
  for (const projectSlug of projectDirs) {
    const projectPath = path.join(IMAGES_DIR, projectSlug);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    
    console.log(`\n[UPLOAD] Processing project: ${projectSlug}`);
    const imageFiles = fs.readdirSync(projectPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    
    if (imageFiles.length === 0) {
      console.log(`  No images found in ${projectSlug}`);
      continue;
    }
    
    const uploadedUrls = [];
    for (const imageFile of imageFiles) {
      const imagePath = path.join(projectPath, imageFile);
      try {
        console.log(`  Uploading: ${imageFile}...`);
        const url = await uploadImage(token, imagePath);
        uploadedUrls.push(url);
        console.log(`  ✓ Uploaded: ${url}`);
      } catch (err) {
        console.error(`  ✗ Failed to upload ${imageFile}:`, err.message);
      }
    }
    
    console.log(`  Total uploaded for ${projectSlug}: ${uploadedUrls.length} images`);
    console.log('  URLs:', uploadedUrls);
  }
  
  console.log('\n[UPLOAD] Done!');
  console.log('[UPLOAD] Next steps:');
  console.log('  1. Copy the URLs above');
  console.log('  2. Update project gallery using admin panel or API');
}

run().catch(err => {
  console.error('[UPLOAD] Error:', err);
  process.exit(1);
});
