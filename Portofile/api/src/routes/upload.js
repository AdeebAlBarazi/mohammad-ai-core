import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

const allowed = ['.jpg','.jpeg','.png','.webp'];
// اجعل مجلد الرفع مشتركاً على مستوى الجذر حتى يتطابق مع ما يقدّمه server.js عبر /uploads
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// هذا المسار يصل إلى جذر المشروع ثم مجلد uploads (../../ من داخل api/src/routes)
const uploadDir = path.join(__dirname, '../../uploads');

// تأكد من وجود مجلد uploads
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// استخدام memory storage للمعالجة قبل الحفظ
const storage = multer.memoryStorage();

function fileFilter(_req,file,cb){
  const ext = path.extname(file.originalname).toLowerCase();
  if(!allowed.includes(ext)) return cb(new Error('نوع ملف غير مسموح')); 
  cb(null,true);
}

const upload = multer({ 
  storage, 
  fileFilter, 
  limits:{ fileSize: 10*1024*1024 } // 10MB قبل الضغط
});

// دالة تحسين وضغط الصورة
async function optimizeImage(buffer, originalName) {
  const filename = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
  
  // معلومات الصورة الأصلية
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  const results = {};
  
  // 1. نسخة صغيرة للمعاينة (thumbnail) - 400px
  const thumbnailPath = path.join(uploadDir, `${filename}-thumb.webp`);
  await sharp(buffer)
    .resize(400, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbnailPath);
  results.thumbnail = `/uploads/${filename}-thumb.webp`;
  
  // 2. نسخة متوسطة للعرض العادي - 800px
  const mediumPath = path.join(uploadDir, `${filename}-medium.webp`);
  await sharp(buffer)
    .resize(800, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(mediumPath);
  results.medium = `/uploads/${filename}-medium.webp`;
  
  // 3. نسخة كبيرة للمعرض - 1200px
  const largePath = path.join(uploadDir, `${filename}-large.webp`);
  await sharp(buffer)
    .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90 })
    .toFile(largePath);
  results.large = `/uploads/${filename}-large.webp`;
  
  // معلومات الحجم
  const thumbSize = fs.statSync(thumbnailPath).size;
  const mediumSize = fs.statSync(mediumPath).size;
  const largeSize = fs.statSync(largePath).size;
  
  return {
    ...results,
    original: {
      width: metadata.width,
      height: metadata.height,
      size: buffer.length,
      format: metadata.format
    },
    optimized: {
      thumbnail: thumbSize,
      medium: mediumSize,
      large: largeSize,
      totalSaved: buffer.length - (thumbSize + mediumSize + largeSize)
    }
  };
}

// POST /api/upload/image (multipart/form-data, field name: image)
router.post('/image', authRequired, (req,res)=>{
  upload.single('image')(req,res, async (err)=>{
    if(err){
      return res.status(400).json({ error: err.message });
    }
    if(!req.file) return res.status(400).json({ error:'no file' });
    
    try {
      const result = await optimizeImage(req.file.buffer, req.file.originalname);
      console.log('[UPLOAD] Optimized image:', result.medium, 
        `(saved ${(result.optimized.totalSaved / 1024).toFixed(2)} KB)`);
      
      res.status(201).json({ 
        url: result.medium,        // الرابط الافتراضي للاستخدام
        thumbnail: result.thumbnail,
        medium: result.medium,
        large: result.large,
        stats: result.optimized
      });
    } catch (error) {
      console.error('[UPLOAD] Optimization error:', error);
      res.status(500).json({ error: 'فشل معالجة الصورة' });
    }
  });
});

// POST /api/upload/images (multipart/form-data, field name: images[]) up to 10
router.post('/images', authRequired, (req,res)=>{
  upload.array('images', 10)(req,res, async (err)=>{
    if(err){
      return res.status(400).json({ error: err.message });
    }
    if(!req.files || !req.files.length) return res.status(400).json({ error:'no files' });
    
    try {
      const results = [];
      for (const file of req.files) {
        const optimized = await optimizeImage(file.buffer, file.originalname);
        results.push({
          original: file.originalname,
          url: optimized.medium,
          thumbnail: optimized.thumbnail,
          medium: optimized.medium,
          large: optimized.large
        });
      }
      
      res.status(201).json({ files: results });
    } catch (error) {
      console.error('[UPLOAD] Batch optimization error:', error);
      res.status(500).json({ error: 'فشل معالجة الصور' });
    }
  });
});

export default router;