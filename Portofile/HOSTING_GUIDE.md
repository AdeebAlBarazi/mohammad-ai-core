# دليل رفع الموقع على Hostinger

## معلومات FTP من Hostinger
```
FTP Server: ftp.yourdomain.com (أو IP المعطى من Hostinger)
Username: [اسم المستخدم من Hostinger]
Password: [كلمة المرور من Hostinger]
Port: 21 (عادة)
Directory: /public_html/
```

## خطوات الرفع:

### 1. باستخدام FileZilla (مجاني):
1. حمل FileZilla من: https://filezilla-project.org/
2. أدخل معلومات FTP
3. اتصل بالسيرفر
4. ارفع الملفات إلى `/public_html/`

### 2. ترتيب الملفات على السيرفر:
```
/public_html/
├── index.html
├── assets/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── script.js
    └── images/
        ├── MyLogo.jpg
        └── MyChracter.png
```

### 3. التحقق من الموقع:
- اذهب إلى: http://yourdomain.com
- تأكد من عمل جميع الأقسام
- تحقق من الصور والأنماط

## نصائح هامة:
- تأكد من أن اسم الملف الرئيسي هو `index.html`
- احرص على رفع مجلد `assets` بالكامل
- تأكد من صحة مسارات الصور في الكود
- اختبر الموقع بعد الرفع

## استكشاف الأخطاء:
- إذا لم تظهر الأنماط: تحقق من مسار `style.css`
- إذا لم تعمل الحركات: تحقق من مسار `script.js`
- إذا لم تظهر الصور: تحقق من مجلد `images`