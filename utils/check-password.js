// check-password.js - التحقق من كلمة السر
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/axiomHubData';

async function checkPassword() {
    try {
        await mongoose.connect(MONGO_URI);
        const User = require('./models/server_user');

        const email = 'adeeb01@hotmail.com';
        const testPassword = 'Admin@12345';

        const user = await User.findOne({ 
            $or: [{ email }, { username: email }]
        });

        if (!user) {
            console.log('❌ المستخدم غير موجود');
            process.exit(0);
        }

        console.log('✅ تم العثور على المستخدم:', user.fullName);
        console.log('📧 Email:', user.email);
        console.log('👤 Username:', user.username);
        console.log('🔐 Password Hash:', user.password);
        console.log('\n🔍 اختبار كلمة السر...');
        
        const isMatch = await bcrypt.compare(testPassword, user.password);
        
        if (isMatch) {
            console.log('✅ كلمة السر صحيحة!');
        } else {
            console.log('❌ كلمة السر غير صحيحة!');
            console.log('\n🔧 إعادة تعيين كلمة السر...');
            
            // إعادة تشفير بطريقة صحيحة
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(testPassword, salt);
            
            user.password = hashedPassword;
            await user.save();
            
            console.log('✅ تم تحديث كلمة السر!');
            console.log('🔑 كلمة السر الجديدة:', testPassword);
            
            // اختبار مرة أخرى
            const isMatch2 = await bcrypt.compare(testPassword, user.password);
            console.log('🔍 اختبار نهائي:', isMatch2 ? '✅ صحيحة' : '❌ خاطئة');
        }

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

checkPassword();
