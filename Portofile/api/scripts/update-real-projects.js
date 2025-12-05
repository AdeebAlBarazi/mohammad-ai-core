import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Project } from '../src/models/Project.js';
import { User } from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';

dotenv.config();

const realProjects = [
  {
    slug: 'saudi-concrete-factory-offices',
    title: { 
      ar: 'مكاتب مصنع الخرسانة السعودية', 
      en: 'Saudi Concrete Factory Offices' 
    },
    short_description: { 
      ar: 'تنفيذ إنشاء وتشطيب مكاتب مصنع الخرسانة السعودية', 
      en: 'Construction and finishing of Saudi Concrete Factory offices' 
    },
    full_description: { 
      ar: 'مشروع تنفيذ إنشاء وتشطيب مكاتب مصنع الخرسانة السعودية في المدينة المنورة، يشمل التصميم الداخلي والتجهيزات الكاملة للمكاتب الإدارية والتشغيلية',
      en: 'Execution project for construction and finishing of Saudi Concrete Factory offices in Medina, including interior design and complete furnishing of administrative and operational offices'
    },
    location: { ar: 'المدينة المنورة، السعودية', en: 'Medina, Saudi Arabia' },
    status: 'completed',
    tags: ['إنشاءات', 'تشطيبات', 'مكاتب', 'صناعي'],
    main_image_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80', title: { ar: 'المبنى الخارجي', en: 'External Building' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80', title: { ar: 'المكاتب الداخلية', en: 'Interior Offices' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80', title: { ar: 'المرافق', en: 'Facilities' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'white-horse-hotel-rehabilitation',
    title: { 
      ar: 'إعادة تأهيل فندق الحصان الأبيض', 
      en: 'White Horse Hotel Rehabilitation' 
    },
    short_description: { 
      ar: 'مشروع إعادة تأهيل وتطوير فندق الحصان الأبيض', 
      en: 'Rehabilitation and development project of White Horse Hotel' 
    },
    full_description: { 
      ar: 'مشروع شامل لإعادة تأهيل وتطوير فندق الحصان الأبيض في مدينة جدة، يتضمن تحديث جميع المرافق والغرف والخدمات الفندقية وفق أحدث المعايير',
      en: 'Comprehensive project for rehabilitation and development of White Horse Hotel in Jeddah, including updating all facilities, rooms, and hotel services according to the latest standards'
    },
    location: { ar: 'جدة، السعودية', en: 'Jeddah, Saudi Arabia' },
    status: 'completed',
    tags: ['فنادق', 'إعادة تأهيل', 'تطوير'],
    main_image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80', title: { ar: 'واجهة الفندق', en: 'Hotel Facade' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&q=80', title: { ar: 'اللوبي', en: 'Lobby' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80', title: { ar: 'الغرف', en: 'Rooms' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'youssef-albdeiri-hotel',
    title: { 
      ar: 'فندق يوسف البديري', 
      en: 'Youssef AlBdeiri Hotel' 
    },
    short_description: { 
      ar: 'تصميم وتنفيذ إنشاء وتشطيب فندق يوسف البديري', 
      en: 'Design and execution of Youssef AlBdeiri Hotel construction and finishing' 
    },
    full_description: { 
      ar: 'مشروع متكامل لتصميم وتنفيذ إنشاء وتشطيب فندق يوسف البديري في المدينة المنورة حي قباء، يشمل التصميم المعماري والإنشائي والتنفيذ الكامل',
      en: 'Integrated project for design and execution of Youssef AlBdeiri Hotel construction and finishing in Medina, Quba district, including architectural and structural design and complete execution'
    },
    location: { ar: 'المدينة المنورة، حي قباء، السعودية', en: 'Medina, Quba District, Saudi Arabia' },
    status: 'completed',
    tags: ['فنادق', 'تصميم', 'إنشاءات', 'تشطيبات'],
    main_image_url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&q=80', title: { ar: 'المبنى الرئيسي', en: 'Main Building' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80', title: { ar: 'الاستقبال', en: 'Reception' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80', title: { ar: 'الأجنحة', en: 'Suites' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'youssef-althubaiti-villa',
    title: { 
      ar: 'فيلا يوسف الثبيتي', 
      en: 'Youssef AlThubaiti Villa' 
    },
    short_description: { 
      ar: 'تصميم وتنفيذ إنشاء وتشطيب فيلا يوسف الثبيتي', 
      en: 'Design and execution of Youssef AlThubaiti Villa construction and finishing' 
    },
    full_description: { 
      ar: 'مشروع تصميم وتنفيذ إنشاء وتشطيب فيلا يوسف الثبيتي في مدينة جدة منطقة درة العروس، يتميز بالتصميم العصري والتشطيبات الفاخرة',
      en: 'Design and execution project for Youssef AlThubaiti Villa construction and finishing in Jeddah, Durrat Al-Arus area, featuring modern design and luxurious finishes'
    },
    location: { ar: 'جدة، درة العروس، السعودية', en: 'Jeddah, Durrat Al-Arus, Saudi Arabia' },
    status: 'completed',
    tags: ['فلل', 'تصميم', 'إنشاءات', 'تشطيبات فاخرة'],
    main_image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80', title: { ar: 'الواجهة الخارجية', en: 'External Facade' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80', title: { ar: 'المدخل الرئيسي', en: 'Main Entrance' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=1200&q=80', title: { ar: 'التصميم الداخلي', en: 'Interior Design' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'turbah-police-station',
    title: { 
      ar: 'مركز شرطة تربة', 
      en: 'Turbah Police Station' 
    },
    short_description: { 
      ar: 'تنفيذ بناء وتشطيب مركز الشرطة في مدينة تربة', 
      en: 'Construction and finishing of Police Station in Turbah city' 
    },
    full_description: { 
      ar: 'مشروع تنفيذ بناء وتشطيب مركز الشرطة في مدينة تربة في السعودية، يشمل جميع المرافق الأمنية والإدارية وفق المواصفات المعتمدة',
      en: 'Construction and finishing project of Police Station in Turbah city, Saudi Arabia, including all security and administrative facilities according to approved specifications'
    },
    location: { ar: 'تربة، السعودية', en: 'Turbah, Saudi Arabia' },
    status: 'completed',
    tags: ['مباني حكومية', 'إنشاءات', 'تشطيبات', 'أمني'],
    main_image_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80', title: { ar: 'المبنى الرئيسي', en: 'Main Building' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80', title: { ar: 'المرافق الإدارية', en: 'Administrative Facilities' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80', title: { ar: 'المنطقة الخارجية', en: 'External Area' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'mohammadia-villas',
    title: { 
      ar: 'فلل المحمدية', 
      en: 'Mohammadia Villas' 
    },
    short_description: { 
      ar: 'تنفيذ 9 فلل سكنية في حي المحمدية', 
      en: 'Construction of 9 residential villas in Mohammadia district' 
    },
    full_description: { 
      ar: 'مشروع تنفيذ بناء وتشطيب فلل المحمدية عدد 9 فيلا في مدينة الرياض حي المحمدية، تتميز بالتصميم العصري والمساحات الواسعة',
      en: 'Construction and finishing project of Mohammadia Villas - 9 villas in Riyadh, Mohammadia district, featuring modern design and spacious areas'
    },
    location: { ar: 'الرياض، حي المحمدية، السعودية', en: 'Riyadh, Mohammadia District, Saudi Arabia' },
    status: 'completed',
    tags: ['فلل', 'مجمع سكني', 'إنشاءات', 'تشطيبات'],
    main_image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80', title: { ar: 'المجمع السكني', en: 'Residential Complex' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', title: { ar: 'الفلل', en: 'Villas' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', title: { ar: 'التصميم الخارجي', en: 'External Design' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'ministry-of-health-rehabilitation',
    title: { 
      ar: 'إعادة تأهيل أدوار وزارة الصحة', 
      en: 'Ministry of Health Floors Rehabilitation' 
    },
    short_description: { 
      ar: 'تصميم هيكلية إدارة مشاريع لإعادة تأهيل أدوار وزارة الصحة', 
      en: 'Project management structure design for Ministry of Health floors rehabilitation' 
    },
    full_description: { 
      ar: 'مشروع تصميم هيكلية إدارة مشاريع للعمل على إعادة تأهيل أدوار وزارة الصحة في مدينة الرياض منطقة المدينة الرقمية، يشمل التخطيط والإشراف على التنفيذ',
      en: 'Project management structure design for rehabilitation of Ministry of Health floors in Riyadh, Digital City area, including planning and execution supervision'
    },
    location: { ar: 'الرياض، المدينة الرقمية، السعودية', en: 'Riyadh, Digital City, Saudi Arabia' },
    status: 'completed',
    tags: ['مباني حكومية', 'إدارة مشاريع', 'إعادة تأهيل', 'تخطيط'],
    main_image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80', title: { ar: 'المبنى', en: 'Building' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=1200&q=80', title: { ar: 'الأدوار الإدارية', en: 'Administrative Floors' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80', title: { ar: 'المرافق', en: 'Facilities' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  },
  {
    slug: 'khuzama-villas',
    title: { 
      ar: 'فلل الخزامى', 
      en: 'Khuzama Villas' 
    },
    short_description: { 
      ar: 'تصميم وتنفيذ 12 فيلا سكنية في منطقة الربوة', 
      en: 'Design and construction of 12 residential villas in Rabwah area' 
    },
    full_description: { 
      ar: 'مشروع فلل الخزامى 12 فيلا تصميم وتنفيذ إنشاء وتشطيب في مدينة الرياض منطقة الربوة، يتميز بالتصميم الراقي والمواصفات العالية',
      en: 'Khuzama Villas project - 12 villas design and construction in Riyadh, Rabwah area, featuring elegant design and high specifications'
    },
    location: { ar: 'الرياض، الربوة، السعودية', en: 'Riyadh, Rabwah, Saudi Arabia' },
    status: 'completed',
    tags: ['فلل', 'مجمع سكني', 'تصميم', 'إنشاءات', 'تشطيبات'],
    main_image_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    gallery: [
      { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80', title: { ar: 'المجمع', en: 'Complex' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80', title: { ar: 'الفلل السكنية', en: 'Residential Villas' }, description: { ar: '', en: '' } },
      { url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1200&q=80', title: { ar: 'التشطيبات الداخلية', en: 'Interior Finishes' }, description: { ar: '', en: '' } }
    ],
    openMode: 'modal'
  }
];

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('[UPDATE] Missing MONGO_URI in .env');
    process.exit(1);
  }

  try {
    await connectDB(process.env.MONGO_URI);
    console.log('[UPDATE] Connected to MongoDB');

    // Get admin user
    const user = await User.findOne({ email: 'admin@example.com' });
    if (!user) {
      console.error('[UPDATE] Admin user not found. Run import-from-cms.js first.');
      process.exit(1);
    }

    // Delete old demo projects
    const deleteResult = await Project.deleteMany({});
    console.log(`[UPDATE] Deleted ${deleteResult.deletedCount} old projects`);

    // Insert new real projects
    let created = 0;
    for (const projectData of realProjects) {
      projectData.user_id = user._id;
      projectData.start_date = new Date();
      await Project.create(projectData);
      console.log(`[UPDATE] Created: ${projectData.slug}`);
      created++;
    }

    const total = await Project.countDocuments();
    console.log('\n[UPDATE] Summary:');
    console.log(`  - Created: ${created} real projects`);
    console.log(`  - Total in DB: ${total}`);
    
    await mongoose.connection.close();
    console.log('[UPDATE] Done! Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('[UPDATE] Error:', error.message);
    process.exit(1);
  }
}

run();
