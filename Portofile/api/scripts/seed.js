import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';

dotenv.config();

async function ensureUser() {
  const email = process.env.SEED_USER_EMAIL || 'admin@example.com';
  const password = process.env.SEED_USER_PASSWORD || 'SeedPass123!';
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({ email, passwordHash, name: 'Admin Seed', role: 'admin' });
    console.log('[SEED] Created user:', email);
  } else {
    console.log('[SEED] User exists:', email);
  }
  return user;
}

function sampleProject(userId) {
  return {
    user_id: userId,
    slug: 'seed-demo-project',
    title: { ar: 'مشروع تجريبي', en: 'Seed Demo Project' },
    short_description: { ar: 'وصف مختصر تجريبي', en: 'Demo short description' },
    full_description: { ar: 'تفاصيل كاملة للمشروع التجريبي', en: 'Full details for demo project' },
    role: { ar: '', en: '' },
    location: { ar: 'الرياض', en: 'Riyadh' },
    start_date: new Date('2024-01-01'),
    status: 'planned',
    main_image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80', title: { ar: 'صورة 1', en: 'Image 1' }, description: { ar: 'وصف', en: 'Caption' } },
      { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80', title: { ar: 'صورة 2', en: 'Image 2' }, description: { ar: 'وصف', en: 'Caption' } }
    ],
    tags: ['Demo','Seed'],
    openMode: 'modal'
  };
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('[SEED] Missing MONGO_URI in .env');
    process.exit(1);
  }
  await connectDB(process.env.MONGO_URI);
  const user = await ensureUser();
  const existing = await Project.findOne({ slug: 'seed-demo-project' });
  if (existing) {
    console.log('[SEED] Project exists:', existing.slug);
  } else {
    const doc = await Project.create(sampleProject(user._id));
    console.log('[SEED] Created project:', doc.slug);
  }
  const count = await Project.countDocuments();
  console.log('[SEED] Total projects:', count);
  await mongoose.connection.close();
  console.log('[SEED] Done');
  process.exit(0);
}

run().catch(e => { console.error('[SEED] Error', e); process.exit(1); });
