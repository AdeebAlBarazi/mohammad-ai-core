# 🔄 تحديث content.json تلقائياً

## الاستخدام

### الطريقة 1: تفاعلي (Interactive)

```powershell
.\update-content-images.ps1
```

سيعرض لك قائمة بالمشاريع لتختار:
```
Available projects:

  [1] مشروع شبرا (ID: project-5rjv9q)
  [2] مشروع آخر (ID: project-xyz)

Enter project number (1-2): 1
```

### الطريقة 2: تحديد المشروع مباشرة

```powershell
.\update-content-images.ps1 -ProjectId "project-5rjv9q"
```

### الطريقة 3: تحديد ملف الصور

```powershell
.\update-content-images.ps1 -UploadedImagesFile "uploaded-images-2025-11-27-192327.json" -ProjectId "project-5rjv9q"
```

## سير العمل الكامل

### 1. رفع الصور
```powershell
# ضع الصور في assets/images/projects/
.\upload-images.ps1
```

### 2. تحديث content.json
```powershell
# سيستخدم آخر ملف uploaded-images تلقائياً
.\update-content-images.ps1
```

### 3. اختر المشروع
```
Enter project number (1-2): 1
```

### 4. تم! ✅
```
SUCCESS! content.json updated

Summary:
  Thumbnail: /uploads/xxx-medium.webp
  Gallery images: 3
```

## ماذا يفعل السكريبت؟

1. ✅ يقرأ آخر ملف `uploaded-images-*.json`
2. ✅ يعرض قائمة المشاريع للاختيار
3. ✅ يحدث `thumbnail` من الصورة الأولى
4. ✅ يضيف جميع الصور إلى `gallery`
5. ✅ يحفظ `content.json` تلقائياً

## مثال عملي

```powershell
# 1. ضع صور مشروع شبرا
Copy-Item "C:\MyImages\shubra\*.jpg" "assets\images\projects\shubra\"

# 2. ارفع الصور
.\upload-images.ps1

# 3. حدث content.json
.\update-content-images.ps1
# اختر: 1 (مشروع شبرا)

# 4. انتهى! الصور موجودة في الموقع
```

## نصائح

- 📁 **تنظيم الصور**: ضع صور كل مشروع في مجلد منفصل
- 🔄 **التحديث**: يمكن تشغيل السكريبت عدة مرات لمشاريع مختلفة
- 💾 **النسخ الاحتياطي**: السكريبت يستبدل gallery بالكامل، احفظ نسخة احتياطية إذا احتجت

## للرفع إلى Hostinger

نفس الخطوات، فقط عدل في `upload-images.ps1`:
```powershell
$API_URL = "https://yourdomain.com/api"
```
