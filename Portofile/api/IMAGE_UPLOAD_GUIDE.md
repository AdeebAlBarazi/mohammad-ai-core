# دليل رفع صور المشاريع

## الطريقة الأولى: عبر Admin Panel (الأسهل)

1. افتح `admin.html` في المتصفح
2. سجل دخول بكلمة المرور: `Admin2025!`
3. اذهب لقسم المشاريع
4. اختر المشروع المراد تحديثه
5. ارفع الصور مباشرة من الواجهة

---

## الطريقة الثانية: رفع دفعة من الصور عبر السكريبت

### الخطوات:

#### 1. تنظيم الصور في مجلدات

أنشئ مجلد `project-images` داخل `api` ثم أنشئ مجلد لكل مشروع:

```
api/
  project-images/
    saudi-concrete-factory-offices/
      main.jpg
      image1.jpg
      image2.jpg
      image3.jpg
    white-horse-hotel-rehabilitation/
      main.jpg
      lobby.jpg
      rooms.jpg
    youssef-albdeiri-hotel/
      facade.jpg
      interior.jpg
```

#### 2. تشغيل سكريبت الرفع

```powershell
cd api
node scripts/upload-project-images.js
```

السكريبت سيرفع جميع الصور ويعطيك الروابط.

#### 3. تحديث المشروع بالصور

استخدم الروابط لتحديث المشروع عبر Admin Panel أو مباشرة في قاعدة البيانات.

---

## الطريقة الثالثة: رفع يدوي عبر API

### رفع صورة واحدة:

```powershell
# 1. احصل على token
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@example.com","password":"Admin2025!"}'
$token = $response.token

# 2. ارفع الصورة
$headers = @{ "Authorization" = "Bearer $token" }
$file = "C:\path\to\your\image.jpg"
$form = @{ image = Get-Item $file }
$result = Invoke-RestMethod -Uri "http://localhost:3001/api/upload" -Method POST -Headers $headers -Form $form

# 3. الرابط المرفوع
Write-Host $result.url
```

---

## الطريقة الرابعة: استخدام روابط خارجية

يمكنك استخدام روابط من:

### Google Drive:
1. ارفع الصورة على Google Drive
2. اجعلها عامة (Anyone with the link can view)
3. احصل على الرابط المباشر

### Imgur:
1. ارفع على https://imgur.com
2. استخدم رابط الصورة المباشر

### Cloudinary:
1. أنشئ حساب مجاني
2. ارفع الصور
3. استخدم الروابط المولدة

---

## أسماء المشاريع (slugs):

1. `saudi-concrete-factory-offices`
2. `white-horse-hotel-rehabilitation`
3. `youssef-albdeiri-hotel`
4. `youssef-althubaiti-villa`
5. `turbah-police-station`
6. `mohammadia-villas`
7. `ministry-of-health-rehabilitation`
8. `khuzama-villas`

---

## مثال كامل:

```javascript
// بعد رفع الصور، حدّث المشروع:
const projectData = {
  main_image_url: 'http://localhost:3001/uploads/main-image.jpg',
  gallery: [
    { 
      url: 'http://localhost:3001/uploads/image1.jpg',
      title: { ar: 'الواجهة الخارجية', en: 'External Facade' },
      description: { ar: '', en: '' }
    },
    { 
      url: 'http://localhost:3001/uploads/image2.jpg',
      title: { ar: 'التصميم الداخلي', en: 'Interior Design' },
      description: { ar: '', en: '' }
    }
  ]
};

// ثم استخدم Admin Panel أو API لتحديث المشروع
```
