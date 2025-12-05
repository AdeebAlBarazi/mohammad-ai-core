import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// تحسين وضغط الصور تلقائياً
// الاستخدام: node scripts/optimize-images.js

const SIZES = {
  thumbnail: { width: 400, quality: 80 },      // للبطاقات الصغيرة
  medium: { width: 800, quality: 85 },         // للمعاينة
  large: { width: 1200, quality: 90 },         // للمعرض
  original: { quality: 95 }                     // نسخة محفوظة
};

async function optimizeImage(inputPath, outputDir) {
  const filename = path.parse(inputPath).name;
  const results = {};
  
  console.log(`[OPTIMIZE] Processing: ${filename}`);
  
  // إنشاء مجلد الإخراج
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // قراءة الصورة
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  console.log(`  Original: ${metadata.width}x${metadata.height}, ${(metadata.size / 1024).toFixed(2)} KB`);
  
  // توليد نسخ مختلفة الأحجام
  for (const [sizeName, config] of Object.entries(SIZES)) {
    const outputPath = path.join(outputDir, `${filename}-${sizeName}.webp`);
    
    let pipeline = sharp(inputPath);
    
    if (config.width) {
      pipeline = pipeline.resize(config.width, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // تحويل لـ WebP (أفضل ضغط وجودة)
    await pipeline
      .webp({ quality: config.quality })
      .toFile(outputPath);
    
    const stats = fs.statSync(outputPath);
    const savedKB = (stats.size / 1024).toFixed(2);
    console.log(`  ✓ ${sizeName}: ${savedKB} KB`);
    
    results[sizeName] = outputPath;
  }
  
  return results;
}

async function processDirectory(inputDir, outputDir) {
  console.log('[OPTIMIZE] Starting batch optimization...\n');
  
  if (!fs.existsSync(inputDir)) {
    console.error(`[ERROR] Directory not found: ${inputDir}`);
    console.log('\nCreate the directory and add your images:');
    console.log(`  mkdir ${inputDir}`);
    console.log(`  # Add your .jpg, .png images to ${inputDir}`);
    return;
  }
  
  const files = fs.readdirSync(inputDir)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  
  if (files.length === 0) {
    console.log('[OPTIMIZE] No images found in', inputDir);
    console.log('Add .jpg or .png images to process');
    return;
  }
  
  let totalOriginal = 0;
  let totalOptimized = 0;
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const originalSize = fs.statSync(inputPath).size;
    totalOriginal += originalSize;
    
    await optimizeImage(inputPath, outputDir);
    
    // حساب حجم النسخ المحسّنة
    const optimizedFiles = fs.readdirSync(outputDir)
      .filter(f => f.startsWith(path.parse(file).name));
    
    optimizedFiles.forEach(f => {
      totalOptimized += fs.statSync(path.join(outputDir, f)).size;
    });
    
    console.log('');
  }
  
  const savedPercent = ((1 - totalOptimized / totalOriginal) * 100).toFixed(1);
  console.log('\n[OPTIMIZE] Summary:');
  console.log(`  Original total: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Optimized total: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Saved: ${savedPercent}%`);
  console.log(`\n✓ Optimized images saved to: ${outputDir}`);
}

// المجلدات
const INPUT_DIR = './images-to-optimize';
const OUTPUT_DIR = './optimized-images';

processDirectory(INPUT_DIR, OUTPUT_DIR)
  .catch(err => {
    console.error('[ERROR]', err);
    process.exit(1);
  });
