/**
 * مزامنة البيانات من content.json إلى MongoDB
 * Sync data from content.json to MongoDB database
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// الاتصال بقاعدة البيانات
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio');
    console.log('✅ تم الاتصال بقاعدة البيانات');
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error);
    process.exit(1);
  }
};

// نموذج المشروع
const ProjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  title: {
    ar: String,
    en: String
  },
  description: {
    ar: String,
    en: String
  },
  short_description: {
    ar: String,
    en: String
  },
  full_description: {
    ar: String,
    en: String
  },
  category: {
    ar: String,
    en: String
  },
  year: String,
  location: {
    ar: String,
    en: String
  },
  status: String,
  thumbnail: String,
  main_image_url: String,
  gallery: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', ProjectSchema);

// قراءة ملف content.json
const readContentFile = async () => {
  try {
    const contentPath = path.join(__dirname, '../../content.json');
    const fileContent = await fs.readFile(contentPath, 'utf-8');
    const data = JSON.parse(fileContent);
    return data.projects || [];
  } catch (error) {
    console.error('❌ خطأ في قراءة ملف content.json:', error);
    process.exit(1);
  }
};

// مزامنة المشاريع
const syncProjects = async () => {
  try {
    const projects = await readContentFile();
    
    console.log(`📦 تم العثور على ${projects.length} مشروع في content.json`);
    
    let added = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const projectData of projects) {
      try {
        // البحث عن المشروع في قاعدة البيانات
        const existingProject = await Project.findOne({ 
          $or: [
            { id: projectData.id },
            { slug: projectData.slug }
          ]
        });
        
        if (existingProject) {
          // تحديث المشروع الموجود
          await Project.updateOne(
            { _id: existingProject._id },
            { 
              ...projectData,
              updatedAt: new Date()
            }
          );
          console.log(`✏️  تحديث: ${projectData.title.ar}`);
          updated++;
        } else {
          // إضافة مشروع جديد
          await Project.create(projectData);
          console.log(`➕ إضافة: ${projectData.title.ar}`);
          added++;
        }
      } catch (error) {
        console.error(`⚠️  تخطي ${projectData.title.ar}:`, error.message);
        skipped++;
      }
    }
    
    console.log('\n📊 ملخص المزامنة:');
    console.log(`   ➕ مشاريع مضافة: ${added}`);
    console.log(`   ✏️  مشاريع محدثة: ${updated}`);
    console.log(`   ⚠️  مشاريع متخطاة: ${skipped}`);
    console.log(`   📦 إجمالي: ${projects.length}`);
    
  } catch (error) {
    console.error('❌ خطأ في المزامنة:', error);
    process.exit(1);
  }
};

// تشغيل المزامنة
const main = async () => {
  console.log('🚀 بدء مزامنة content.json إلى MongoDB...\n');
  
  await connectDB();
  await syncProjects();
  
  console.log('\n✅ تمت المزامنة بنجاح!');
  process.exit(0);
};

main();
