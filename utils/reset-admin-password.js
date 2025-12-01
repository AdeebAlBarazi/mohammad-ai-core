// reset-admin-password.js - إعادة تعيين كلمة السر للـSuperAdmin
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// الاتصال بقاعدة البيانات
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/axiomHubData';

async function resetAdminPassword() {
    try {
        console.log('🔌 الاتصال بقاعدة البيانات...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!\n');

        // تحميل الـModel (استخدم المسار الصحيح)
        const User = require('./models/server_user');

        // 1. عرض جميع المستخدمين SuperAdmin
        console.log('📋 قائمة المستخدمين SuperAdmin:');
        console.log('═'.repeat(60));
        
        const superAdmins = await User.find({ role: 'SuperAdmin' })
            .select('username email fullName')
            .lean();

        if (superAdmins.length === 0) {
            console.log('❌ لم يتم العثور على أي SuperAdmin!');
            process.exit(0);
        }

        superAdmins.forEach((admin, index) => {
            console.log(`${index + 1}. ${admin.fullName || admin.username}`);
            console.log(`   📧 Email: ${admin.email}`);
            console.log(`   👤 Username: ${admin.username}`);
            console.log(`   🆔 ID: ${admin._id}`);
            console.log('─'.repeat(60));
        });

        // 2. اختيار المستخدم
        const targetEmail = 'adeeb01@hotmail.com'; // ✏️ غيّر هذا إذا كنت تريد مستخدم آخر
        
        console.log(`\n🔍 البحث عن المستخدم: ${targetEmail}...`);
        const user = await User.findOne({ 
            $or: [
                { email: targetEmail },
                { username: targetEmail }
            ]
        });

        if (!user) {
            console.log(`❌ لم يتم العثور على المستخدم: ${targetEmail}`);
            process.exit(0);
        }

        console.log(`✅ تم العثور على المستخدم: ${user.fullName || user.username}`);

        // 3. تعيين كلمة السر الجديدة
        const newPassword = 'Admin@12345'; // ✏️ غيّر كلمة السر هنا
        
        console.log(`\n🔐 تشفير كلمة السر الجديدة...`);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        console.log(`💾 حفظ كلمة السر الجديدة...`);
        user.password = hashedPassword;
        await user.save();

        console.log('\n═'.repeat(60));
        console.log('✅ تم تغيير كلمة السر بنجاح!');
        console.log('═'.repeat(60));
        console.log(`👤 المستخدم: ${user.fullName || user.username}`);
        console.log(`📧 Email/Username: ${targetEmail}`);
        console.log(`🔑 كلمة السر الجديدة: ${newPassword}`);
        console.log('═'.repeat(60));
        console.log('\n⚠️  ملاحظة: احفظ كلمة السر في مكان آمن!\n');

    } catch (error) {
        console.error('❌ حدث خطأ:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 تم إغلاق الاتصال بقاعدة البيانات');
        process.exit(0);
    }
}

// تشغيل الـScript
resetAdminPassword();
