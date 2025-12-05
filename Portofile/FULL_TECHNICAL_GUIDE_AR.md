# الدليل التقني الشامل لعمل الموقع (واجهة + API + الصور) — 2025-11-28

هذا الدليل يغطّي البنية كاملة: الواجهة الأمامية، خادم الـ API، قاعدة البيانات، وخط معالجة الصور، مع وصف تدفق البيانات والمهام العملية للمطورين (تغيير صور البطاقات وإضافة صور المعرض من الكود).

---
## 1) نظرة عامة ومكونات المنظومة
- واجهة ثابتة: `index.html` + `assets/js/*` + `assets/css/*`، تعرض المشاريع والشهادات وتدعم العربية/الإنجليزية.
- خادم API: `api/src/server.js` مع مسارات مصادقة، مشاريع، رفع صور، وخدمة ملفات `uploads/` بشكل ثابت.
- قاعدة بيانات: MongoDB (Atlas). نماذج: `Project` و`User` تحت `api/src/models/*`.
- سكربتات مساعدة: استيراد من CMS، تشخيص الصور، توطين الروابط الخارجية، مزامنة للمحتوى.

الهدف: كل صور المشاريع (الرئيسية والمعرض) تُخدّم محلياً من `uploads/` وبروابط قصيرة، مع أحجام WebP محسّنة.

---
## 2) خريطة الملفات الأساسية (وظائف مختصرة)
- `index.html`: صفحة العرض؛ تهيئة الواجهة وروابط السكربتات.
- `assets/js/projects-extended.js`: يجلب المشاريع من `/api/projects` مع تراجع ذكي إلى `assets/data/content.json`؛ يبني بطاقات ويعالج المعرض.
- `assets/js/admin.js`: لوحة إدارة محتوى CMS مع تكامل اختياري للـ API (تسجيل الدخول، رفع صورة، دفع المشاريع).
- `api/src/server.js`: ضبط Express، خدمة الملفات، CORS، `/api/health`، ربط Mongo ثم listen.
- `api/src/models/Project.js`: مخطط المشروع (حقول محلية، صورة رئيسية، معرض بعناصر كائنات `{url,title,description}`، وسوم، حاله العرض).
- `api/src/routes/projects.js`: CRUD للمشاريع (قائمة + تفاصيل slug + إنشاء/تحديث/حذف بمصادقة).
- `api/src/routes/upload.js`: رفع صورة واحدة؛ يحول إلى WebP ويولّد 3 أحجام (`thumb`, `medium`, `large`) ويعيد روابطها.
- سكربتات تحت `api/scripts/`:
  - `import-from-cms.js`: استيراد `content.json` الجذر إلى Mongo (إنشاء/تحديث المشاريع).
  - `diagnose-images.js`: فحص توافق روابط DB مع وجود الملفات تحت `uploads/` وإظهار الإحصاءات.
  - `localize-external-images.js`: تنزيل روابط خارجية (مثل Unsplash)، توليد WebP محلي، وتحديث المستندات في DB.

---
## 3) تدفق البيانات (واجهة → API → ملفات)
1. الواجهة تحاول تحديد `API_BASE` تلقائياً (`projects-extended.js`)، ثم تجلب `/api/projects`.
2. إن فشل الاتصال، يتم التراجع إلى `assets/data/content.json` لضمان عرض المحتوى.
3. بطاقات المشاريع تُستخدم صورة مصغّرة من `main_image_url` (ويُفضّل صيغة `...-thumb.webp`).
4. عند فتح مشروع، المعرض يحمّل صورًا بحجم مناسب (`medium`/`large`) مع `loading="lazy"`.
5. الملفات الفعلية تُخدّم عبر `server.js` من مجلد `uploads/` في الجذر.

---
## 4) خطّ معالجة الصور (Upload & Optimization)
- نقطة الرفع: `POST /api/upload/image` (مصادقة مطلوبة). يقبل حقل FormData باسم `image`.
- التحويل: `sharp` يحوّل لثلاث صور WebP:
  - `*-thumb.webp` عرض 400px، جودة ~80.
  - `*-medium.webp` عرض 800px، جودة ~85.
  - `*-large.webp` عرض 1200px، جودة ~90.
- المسار ثابت: يحفظ تحت `uploads/` في جذر المشروع ويُخدّم عبر `/uploads/*`.
- العودة: JSON يحوي روابط الأحجام لاستخدامها مباشرة في واجهة أو قاعدة البيانات.

نصيحة: استخدم `thumb.webp` لبطاقات، `medium.webp` للصور داخل الصفحة، و`large.webp` للعرض داخل المعرض المنبثق.

---
## 5) وصف قاعدة البيانات ونموذج المشروع
- الحقول الرئيسية: `slug`, `title.{ar,en}`, `short_description`, `full_description`, `location.{ar,en}`, `start_date`, `status`, `tags[]`.
- صورة رئيسية: `main_image_url` (يفضّل رابط محلي من `uploads/`).
- المعرض: `gallery[]` عناصر كائن:
  ```json
  { "url": "/uploads/1732-thumb.webp", "title": {"ar": "صورة 1", "en": "Image 1"}, "description": {"ar": "...", "en": "..."} }
  ```
- فهرسة: حقل `slug` مفهرس؛ تجنّب التعارضات.

---
## 6) وصف السكربتات التشغيلية (CLI)
جميع الأوامر تُنفذ من مجلد `api` باستخدام PowerShell:

- استيراد من CMS إلى DB:
  ```powershell
  cd api; node scripts/import-from-cms.js
  ```
- توطين الروابط الخارجية (تحويل إلى محلي):
  ```powershell
  cd api; node scripts/localize-external-images.js --gallery
  # استهداف مشروع محدّد بالـ slug
  cd api; node scripts/localize-external-images.js --slug youssef-althubaiti-villa --gallery --retry 2 --retry-delay 500
  ```
- تشخيص الصور (تحقق من تطابق DB مع الملفات):
  ```powershell
  cd api; node scripts/diagnose-images.js
  ```

مخرجات التشخيص المتوقعة حالياً: 8 مشاريع؛ كل الصور الرئيسية والمعرض "OK" (حوالي 150 صورة).

---
## 7) وصف نقاط الـ API المهمة
- الصحة: `GET /api/health` → `{ ok: true }`.
- المشاريع:
  - قائمة: `GET /api/projects?limit=100`
  - تفاصيل: `GET /api/projects/:slug`
  - إنشاء/تحديث/حذف: `POST/PUT/DELETE /api/projects` (يتطلب `Authorization: Bearer <token>`)
- المصادقة:
  - تسجيل: `POST /api/auth/register`
  - دخول: `POST /api/auth/login` → يعيد `{ token }`
- رفع صورة: `POST /api/upload/image` (FormData مع `image`)
- تبديل اتصال قاعدة البيانات (للمشرف): `POST /api/admin/db-config` مع `{ mongoUri, testOnly }`

---
## 8) وصف واجهة الإدارة (admin.html)
- كلمة مرور محليّة (تعليمية) و/أو دخول عبر API (JWT)؛ تخزين آمن نسبيًا للرمز في المتصفح.
- أزرار: تحميل المحتوى، حفظ كـ JSON، حفظ عبر File System API، مسودة محلية، مزامنة مع API، رفع صورة وإدراج رابطها مباشرة في حقل الـ Thumbnail.
- إدارة المشاريع:
  - حقول ثنائية اللغة.
  - معرض يدعم عناصر كائنات مع عنوان ووصف لكل صورة.
  - سحب وإفلات لإعادة الترتيب + أزرار تحريك + اختصارات لوحة المفاتيح.

---
## 9) وصف واجهة العرض (projects-extended.js)
- يحدد `API_BASE` تلقائياً من عدة احتمالات أو يستخدم `window.API_BASE` إن تم حقنه.
- يجلب المشاريع مع إعادة المحاولة وتراجعات زمنية، ويخزّن نسخة آمنة محلياً كاحتياط.
- يبني البطاقات ويطبّع روابط الصور لتكون محلية بقدر الإمكان.
- يفتح معرضًا منسّقًا مع دعم لوحة المفاتيح وتعدد اللغات.

---
## 10) وصف مسار خدمة الملفات الثابتة (uploads/)
- `server.js` يقدّم `/uploads/*` مباشرة من مجلد الجذر.
- إصلاح مسار الرفع تم لضمان حفظ الملفات ضمن نفس الجذر الذي يُخدّم منه.
- يوصى بجعل `Cache-Control` مناسب للصور على مستوى الاستضافة.

---
## 11) وصف استراتيجيات الأداء
- WebP + ثلاثة أحجام.
- `loading="lazy"` للصور.
- تقليل الحركة عند `prefers-reduced-motion`.
- مسارات قصيرة وملفات محلية تقلّل زمن الرحلة.

---
## 12) وصف إجراءات المطوّر العملية (Recipes)

### أ) تغيير صورة بطاقة مشروع (thumbnail) برمجياً
1. سجّل الدخول واحصل على التوكن:
   ```powershell
   $login = Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/auth/login" -ContentType "application/json" -Body '{"email":"admin@example.com","password":"Admin2025!"}'
   $token = $login.token
   ```
2. ارفع الصورة واحصل على روابط الأحجام:
   ```powershell
   $form = New-Object System.Net.Http.MultipartFormDataContent
   $file = Get-Item "d:\path\to\image.jpg"
   $fileContent = New-Object System.Net.Http.StreamContent($file.OpenRead())
   $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/jpeg")
   $form.Add($fileContent, "image", $file.Name)
   $client = New-Object System.Net.Http.HttpClient
   $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)
   $resp = $client.PostAsync("http://localhost:3001/api/upload/image", $form).Result
   $json = [System.Text.Json.JsonDocument]::Parse($resp.Content.ReadAsStringAsync().Result).RootElement
   $thumb = $json.GetProperty("thumbnail").GetString()
   ```
3. حدّث المشروع ليستخدم الرابط المصغّر كـ `main_image_url`:
   ```powershell
   $slug = "youssef-althubaiti-villa"
   $payload = @{ main_image_url = $thumb } | ConvertTo-Json
   Invoke-RestMethod -Method PUT -Uri "http://localhost:3001/api/projects/$slug" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $payload
   ```

### ب) إضافة صور للمعرض عبر الكود
استخدم عناصر كائنات لضبط العنوان والوصف لكل صورة:
```powershell
$slug = "turbah-police-station"
$gallery = @(
  @{ url="/uploads/1732-medium.webp"; title=@{ar="مدخل"; en="Entrance"}; description=@{ar="الواجهة الرئيسية"; en="Main facade"} },
  @{ url="/uploads/1732-large.webp"; title=@{ar="تصميم"; en="Design"}; description=@{ar="قاعات"; en="Halls"} }
) | ConvertTo-Json
$payload = "{ \"gallery\": $gallery }"
Invoke-RestMethod -Method PUT -Uri "http://localhost:3001/api/projects/$slug" -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $payload
```

### ج) توطين الروابط الخارجية إلى محلية
استعمل السكربت:
```powershell
cd api; node scripts/localize-external-images.js --gallery
# مشروع محدد + إعادة المحاولة
cd api; node scripts/localize-external-images.js --slug khuzama-villas --gallery --retry 3 --retry-delay 800
```
يسجّل الأخطاء في `api/localize-errors.log`؛ بعد التنفيذ أعد تشغيل التشخيص.

### د) الاستيراد من CMS إلى قاعدة البيانات
```powershell
cd api; node scripts/import-from-cms.js
```
مصدر القراءة: `content.json` في جذر المشروع.

### هـ) التحقق الدوري عبر التشخيص
```powershell
cd api; node scripts/diagnose-images.js
```
يعرض: عدد المشاريع، عدد الصور الرئيسية والمعرض "OK" أو "Missing"، لتصحيح أي انقطاع.

---
## 13) تهيئة الإنتاج والتكامل مع الواجهة
- حقن `window.API_BASE` في `index.html` لبيئة النشر (الدومين الفعلي):
  ```html
  <script>
    window.API_BASE = 'https://your-domain.com/api';
  </script>
  ```
- تأكد من خدمة `/uploads` من نفس الجذر أو عبر عكس/Proxy آمن.
- فعّل HTTPS و`Cache-Control` مناسب للصور.
- احمِ `admin.html` بمصادقة خادم (Basic Auth أو خلف VPN) إن كانت متاحة للعامة.

---
## 14) استكشاف الأعطال الشائعة
- صور لا تظهر: تحقق من أن `main_image_url` و`gallery[].url` تشير إلى `/uploads/*` الموجود فعلاً؛ استخدم `diagnose-images.js`.
- فشل رفع: تأكد من التوكن وامتداد الصورة وحجمها (< 2MB افتراضياً)؛ راجع سجلات الخادم.
- API لا يستجيب: افحص `/api/health` ثم اتصال Mongo؛ جرّب `admin/db-config` بنمط `testOnly`.
- معرض خاوٍ: تأكد من تهيئة عناصر الكائن للمعرض وعدم وجود روابط فارغة.

---
## 15) صيانة دورية واقتراحات
- جدولة تشغيل `diagnose-images.js` أسبوعياً لرصد الانقطاعات.
- مراجعة `localize-errors.log` ومعالجة الروابط غير الصالحة (404).
- تنظيف صور يتيمة لاحقاً (سكربت مستقبلي) أو عبر مراجعة دورية لـ`uploads/`.
- التفكير في AVIF للصور الحديثة كتحسين إضافي.

---
## 16) ملخص التنفيذ الحالي
- تم إصلاح مسار حفظ الصور ليتطابق مع خدمة `/uploads`.
- تم استيراد 8 مشاريع من CMS؛ قاعدة البيانات جاهزة.
- تم توطين الروابط الخارجية وتحويلها إلى محلية؛ كل الصور الرئيسية وقرابة 150 صورة معرض "OK".
- الواجهة تعرض من API مع تراجع إلى CMS عند الحاجة.

الدليل هذا هو المرجع التقني الحالي للتشغيل والصيانة.
