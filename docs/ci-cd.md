# CI/CD — GitHub Actions

يصف هذا المستند مهام CI/CD المضافة لهذا المستودع.

## CI (تشغيل على push/PR)
الملف: `.github/workflows/ci.yml`
- يشتغل على: `push` و `pull_request` لفرع `main`.
- مصفوفة Node: 18.x و 20.x.
- خطوات:
  - Checkout
  - Setup Node + Cache
  - تثبيت الاعتمادات: `npm ci || npm install`
  - فحص دخولي سريع: `npm run ci:smoke`

### الأمر المستخدم (npm script)
- تمت إضافة سكربت:
```
"ci:smoke": "node ./scripts/ci-smoke.js"
```
- وظيفة `scripts/ci-smoke.js`:
  - يتحقق من إمكان تحميل `server.js` (تطبيق Express كـ Module).
  - يستدعي `agent-core.chat()` برد Stub إن لم يكن مفتاح OpenAI مفعّل.

## Release (إنشاء إصدار عند الوسم)
الملف: `.github/workflows/release.yml`
- يشتغل عند دفع وسوم مطابقة `v*` (مثال: `v0.1.0`).
- ينشئ إصدار GitHub Release تلقائيًا مع ملاحظات مُولّدة.

## أسرار وتهيئة
- لا حاجة لأسرار لتشغيل `ci:smoke` (يستخدم Stub افتراضيًا عند غياب `OPENAI_API_KEY`).
- في حال أردت اختبار ردود فعلية:
  - أضف سر المستودع `OPENAI_API_KEY` ثم حدّث CI لتصدير المتغير قبل تشغيل السكربت:
    ```yaml
    - name: CI Smoke
      run: npm run ci:smoke
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ```
- تذكير: لا تلتزم ملف `.env`؛ هو مستبعد في `.gitignore`.

## نصائح
- حافظ على وقت CI منخفضًا بفحوصات سريعة.
- استخدم فروعًا لكل ميزة وافتح PR ليعمل CI تلقائيًا.
- لإصدار نسخة: أنشئ وسمًا بالشكل `vX.Y.Z` وادفعه إلى GitHub لتوليد Release.