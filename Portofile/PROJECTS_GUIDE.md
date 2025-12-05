# دليل إضافة المشاريع - Projects Guide

## كيفية إضافة مشروع جديد

### 1. رفع الصور إلى خدمة خارجية

استخدم أحد المواقع التالية لرفع صور المشروع (مجاناً):

- **Imgur**: https://imgur.com
- **ImgBB**: https://imgbb.com
- **Cloudinary**: https://cloudinary.com (أكثر احترافية)
- **Unsplash** (للصور التجريبية): https://unsplash.com

### 2. تعديل ملف content.json

افتح الملف: `content.json` (المصدر الموحد)

أضف مشروعك الجديد في قسم `projects`:

```json
{
  "id": "project-4",
  "title": {
    "ar": "اسم المشروع بالعربي",
    "en": "Project Name in English"
  },
  "description": {
    "ar": "وصف قصير للمشروع بالعربي",
    "en": "Short project description in English"
  },
  "category": {
    "ar": "تجاري",
    "en": "Commercial"
  },
  "year": "2024",
  "location": {
    "ar": "دمشق",
    "en": "Damascus"
  },
  "thumbnail": "رابط_الصورة_المصغرة_من_الموقع_الخارجي",
  "gallery": [
    "رابط_الصورة_الأولى",
    "رابط_الصورة_الثانية",
    "رابط_الصورة_الثالثة"
  ]
}
```

### 3. مثال عملي

```json
{
  "id": "project-residential-2024",
  "title": {
    "ar": "مجمع الفردوس السكني",
    "en": "Al-Ferdaws Residential Complex"
  },
  "description": {
    "ar": "تصميم وتنفيذ مجمع سكني فاخر يضم 120 وحدة سكنية",
    "en": "Design and execution of luxury residential complex with 120 units"
  },
  "category": {
    "ar": "سكني",
    "en": "Residential"
  },
  "year": "2024",
  "location": {
    "ar": "حلب",
    "en": "Aleppo"
  },
  "thumbnail": "https://i.imgur.com/abc123.jpg",
  "gallery": [
    "https://i.imgur.com/image1.jpg",
    "https://i.imgur.com/image2.jpg",
    "https://i.imgur.com/image3.jpg",
    "https://i.imgur.com/image4.jpg"
  ]
}
```

### 4. نصائح للصور

- **الحجم المناسب للصورة المصغرة (thumbnail)**: 800x600 بكسل
- **الحجم المناسب لصور المعرض (gallery)**: 1200x800 بكسل أو أكبر
- **التنسيق**: JPG أو PNG
- **الجودة**: استخدم جودة متوسطة إلى عالية (70-85%)
- **التحسين**: ضغط الصور قبل الرفع باستخدام TinyPNG.com

### 5. الفئات المقترحة (Categories)

- تجاري / Commercial
- سكني / Residential
- تقني / Technology
- صناعي / Industrial
- تعليمي / Educational
- طبي / Medical
- ترفيهي / Entertainment

## استخدام Imgur (الطريقة الأسهل)

1. اذهب إلى: https://imgur.com
2. اضغط "New Post"
3. ارفع الصور (يمكنك رفع عدة صور دفعة واحدة)
4. اضغط بزر الماوس الأيمن على الصورة واختر "Copy image address"
5. استخدم الرابط في `content.json`

## استخدام Cloudinary (للمحترفين)

1. سجل حساب مجاني في: https://cloudinary.com
2. ارفع الصور عبر لوحة التحكم
3. احصل على روابط الصور من Media Library
4. يمكنك التحكم بالحجم والجودة من خلال URL parameters

مثال:
```
https://res.cloudinary.com/your-cloud-name/image/upload/w_800,q_80/v1234567890/project-image.jpg
```

## ملاحظات هامة

- تأكد من أن الروابط تبدأ بـ `https://` (وليس `http://`)
- تجنب استخدام مسافات في أسماء المشاريع
- استخدم معرّف فريد (id) لكل مشروع
- احفظ نسخة احتياطية من `content.json` قبل التعديل

---

تم إنشاء هذا الدليل بواسطة GitHub Copilot
