// fix-password.js - إصلاح كلمة السر بطريقة صحيحة
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/axiomHubData';

async function fixPassword() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ متصل بقاعدة البيانات\n');

        const email = 'adeeb01@hotmail.com';
        const newPassword = 'Admin@12345';

        // استخدم updateOne بدلاً من save لتجنب pre('save') middleware
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        console.log('🔐 تشفير كلمة السر...');
        console.log('Hash:', hashedPassword.substring(0, 30) + '...\n');

        const result = await mongoose.connection.collection('users').updateOne(
            { 
                $or: [
                    { email: email },
                    { username: email }
                ]
            },
            { 
                $set: { password: hashedPassword }
            }
        );

        if (result.modifiedCount === 0) {
            console.log('❌ لم يتم العثور على المستخدم');
            process.exit(0);
        }

        console.log('✅ تم تحديث كلمة السر مباشرة في قاعدة البيانات!');
        
        // التحقق
        const user = await mongoose.connection.collection('users').findOne({
            $or: [{ email }, { username: email }]
        });

        console.log('\n📋 معلومات المستخدم:');
        console.log('👤 الاسم:', user.fullName);
        console.log('📧 Email:', user.email);
        console.log('🔐 Password Hash:', user.password.substring(0, 30) + '...');
        
        // اختبار كلمة السر
        const isMatch = await bcrypt.compare(newPassword, user.password);
        
        console.log('\n🔍 اختبار كلمة السر:', isMatch ? '✅ صحيحة' : '❌ خاطئة');
        
        if (isMatch) {
            console.log('\n═'.repeat(40));
            console.log('✅ نجح! يمكنك الآن تسجيل الدخول باستخدام:');
            console.log('═'.repeat(40));
            console.log('📧 Email/Username:', email);
            console.log('🔑 Password:', newPassword);
            console.log('═'.repeat(40));
        }

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

fixPassword();
