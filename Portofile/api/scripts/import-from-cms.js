import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';

dotenv.config();

async function ensureUser() {
  const email = process.env.SEED_USER_EMAIL || 'admin@example.com';
  const password = process.env.SEED_USER_PASSWORD || 'Admin2025!';
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({ email, passwordHash, name: 'Admin User', role: 'admin' });
    console.log('[IMPORT] Created user:', email);
  } else {
    console.log('[IMPORT] User exists:', email);
  }
  return user;
}

function transformProject(cmsProject, userId) {
  // Transform from CMS format to DB schema
  return {
    user_id: userId,
    slug: cmsProject.id || cmsProject.slug || `project-${Date.now()}`,
    title: cmsProject.title || { ar: 'مشروع', en: 'Project' },
    short_description: cmsProject.description || cmsProject.short_description || { ar: '', en: '' },
    full_description: cmsProject.full_description || cmsProject.description || { ar: '', en: '' },
    role: cmsProject.role || { ar: '', en: '' },
    location: cmsProject.location || { ar: '', en: '' },
    start_date: cmsProject.year ? new Date(`${cmsProject.year}-01-01`) : new Date(),
    status: cmsProject.status || 'completed',
    main_image_url: cmsProject.thumbnail || cmsProject.main_image_url || '',
    gallery: Array.isArray(cmsProject.gallery) 
      ? cmsProject.gallery.map(url => ({
          url: typeof url === 'string' ? url : url.url,
          title: typeof url === 'object' ? url.title : { ar: '', en: '' },
          description: typeof url === 'object' ? url.description : { ar: '', en: '' }
        }))
      : [],
    tags: cmsProject.tags || [cmsProject.category?.ar || cmsProject.category?.en || 'عام'].filter(Boolean),
    openMode: cmsProject.openMode || 'modal',
    client_name: cmsProject.client || ''
  };
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('[IMPORT] Missing MONGO_URI in .env');
    console.error('[IMPORT] Create a .env file in the api folder with:');
    console.error('MONGO_URI=your_mongodb_connection_string');
    console.error('JWT_SECRET=your_secret_key');
    console.error('SEED_USER_EMAIL=admin@example.com');
    console.error('SEED_USER_PASSWORD=Admin2025!');
    process.exit(1);
  }

  try {
    await connectDB(process.env.MONGO_URI);
    console.log('[IMPORT] Connected to MongoDB');

    const user = await ensureUser();
    
    // Read unified root content.json (single source of truth)
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // Adjusted path to point to root-level content.json outside api folder
    const contentPath = path.resolve(__dirname, '../../content.json');
    const content = JSON.parse(readFileSync(contentPath, 'utf-8'));
    
    if (!content.projects || !Array.isArray(content.projects)) {
      console.error('[IMPORT] No projects array found in content.json');
      process.exit(1);
    }

    console.log(`[IMPORT] Found ${content.projects.length} projects in content.json`);

    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const cmsProject of content.projects) {
      const transformed = transformProject(cmsProject, user._id);
      const existing = await Project.findOne({ slug: transformed.slug });
      
      if (existing) {
        console.log(`[IMPORT] Project exists: ${transformed.slug} - Updating...`);
        await Project.findOneAndUpdate({ slug: transformed.slug }, transformed, { new: true });
        updated++;
      } else {
        await Project.create(transformed);
        console.log(`[IMPORT] Created: ${transformed.slug}`);
        created++;
      }
    }

    const total = await Project.countDocuments();
    console.log('\n[IMPORT] Summary:');
    console.log(`  - Created: ${created}`);
    console.log(`  - Updated: ${updated}`);
    console.log(`  - Skipped: ${skipped}`);
    console.log(`  - Total in DB: ${total}`);
    
    await mongoose.connection.close();
    console.log('[IMPORT] Done! Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('[IMPORT] Error:', error.message);
    process.exit(1);
  }
}

run();
