/**
 * مراقبة ملف content.json والمزامنة التلقائية عند التعديل
 * Watch content.json and auto-sync on changes
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const contentPath = path.join(__dirname, '../../content.json');
const syncScript = path.join(__dirname, 'sync-content-to-db.js');

let syncTimeout = null;
let isRunning = false;

console.log('👀 مراقبة التغييرات في content.json...');
console.log(`📁 الملف: ${contentPath}\n`);

// دالة تشغيل المزامنة
const runSync = () => {
  if (isRunning) {
    console.log('⏳ المزامنة قيد التشغيل، انتظر...');
    return;
  }
  
  isRunning = true;
  console.log(`\n⚡ تم اكتشاف تغيير - بدء المزامنة [${new Date().toLocaleTimeString('ar-SA')}]`);
  
  const sync = spawn('node', [syncScript], {
    stdio: 'inherit',
    shell: true
  });
  
  sync.on('close', (code) => {
    isRunning = false;
    if (code === 0) {
      console.log('✅ انتهت المزامنة بنجاح\n');
      console.log('👀 في انتظار التغييرات التالية...');
    } else {
      console.log(`❌ فشلت المزامنة (رمز الخطأ: ${code})\n`);
    }
  });
};

// مراقبة الملف
fs.watch(contentPath, (eventType, filename) => {
  if (eventType === 'change') {
    // إلغاء أي مزامنة منتظرة
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    
    // الانتظار 1 ثانية قبل المزامنة (لتجنب المزامنة المتعددة)
    syncTimeout = setTimeout(() => {
      runSync();
    }, 1000);
  }
});

// مزامنة أولية عند بدء التشغيل
console.log('🔄 إجراء مزامنة أولية...');
runSync();

// إبقاء السكريبت نشطاً
process.on('SIGINT', () => {
  console.log('\n\n👋 إيقاف المراقبة...');
  process.exit(0);
});
