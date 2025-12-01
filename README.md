## Authentication & Roles

- JWT (RS256/HS256) supported. Configure one of:
  - `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_PATH` for RS256.
  - `AUTH_JWKS_URL` for JWKS auto-refresh.
  - `JWT_SECRET` for HS256 (development only).

- Enforcement flags:
  - `MARKET_REQUIRE_JWT=1` — يفرض JWT فقط، ويعطل أي سقوط تطويري.
  - `MARKET_ALLOWED_DEV_FALLBACK=1` — يسمح باستخدام سقوط تطويري (Bearer كـ userId) عند عدم إعداد JWT.

- الأدوار:
  - تُقرأ من `role` أو أول عنصر من `roles[]` في التوكن.
  - يتم التطبيع إلى: `user` (customer), `seller` (vendor), `admin`.
  - مسارات البائع/الإدارة محمية عبر `requireRole(['seller','admin'])` أو `['admin']`.

### الواجهة (Front-End Guards)
- ملف `js/auth-guard.js` يحجب الصفحات المحمية إذا لم يكن المستخدم مسجلاً الدخول.
- ملف `js/role-guard.js` يفرض الدور المناسب:
  - صفحات البائع: تتطلب `seller` أو `admin`.
  - صفحات الإدارة: تتطلب `admin`.
  - يعرض تراكب عربي مع خيارات العودة أو ترقية الحساب.
  
  ملاحظة تسجيل الدخول (Static paths): لصفحة `auth/public/login.html` تأكد من تقديمها عبر خادم المصادقة (`auth/server.js`) أو استخدام مسارات نسبية للأصول. تم ضبط وسم السكربت إلى `./js/auth.js` لتجنّب 404 و MIME غير صحيح عند التشغيل المحلي. شغّل خادم المصادقة وافتح:
  ```powershell
  cd auth; npm install; node server.js
  # ثم افتح المتصفح على:
  http://localhost:<port>/login.html
  ```

### المقاييس (Metrics)
- `market_auth_denied_total{type="auth|role"}` عدّاد لمحاولات الوصول المرفوضة:
  - `type="auth"` عند فشل التوثيق (401).
  - `type="role"` عند فشل التفويض (403).

### المدفوعات (Payment Stub)
- مفعّل اختيارياً عبر المتغير: `MARKET_ENABLE_PAYMENT_STUB=1` (مفيد في التطوير قبل دمج مزود حقيقي).
- النقاط:
  - `POST /api/market/payments/intents` { orderId } ← ينشئ نية دفع بحالة `requires_confirmation`.
  - `POST /api/market/payments/:id/confirm` ← يؤكد النية ويحدّث الطلب إلى `paymentStatus=paid`.
  - `GET /api/market/payments/:id` ← يعرض تفاصيل النية.
- المقاييس:
  - `market_payment_intents_total` عدّاد نوايا الدفع المنشأة.
  - `market_payment_confirms_total` عدّاد عمليات التأكيد الناجحة.
- تجربة سريعة (PowerShell):
```powershell
$env:MARKET_ENABLE_PAYMENT_STUB = "1"; node server.js
```
ثم افتح صفحة تفاصيل طلب بحالة دفع "قيد الانتظار" واضغط زر "دفع الآن (وهمي)".

### مزود دفع حقيقي (Stripe كمثال)
للسwitch من النمط الوهمي إلى مزود فعلي، عرّف المتغيرات التالية:
```powershell
$env:PAYMENT_PROVIDER = "stripe"            # تفعيل مزود Stripe
$env:STRIPE_SECRET_KEY = "sk_live_or_test"  # مفتاح الخادم السري
$env:STRIPE_WEBHOOK_SECRET = "whsec_..."    # للتحقق من تواقيع الويب هوك
$env:PAYMENT_RETURN_URL_BASE = "https://your-frontend" # قاعدة عنوان الرجوع بعد الدفع
```
عند ضبط `PAYMENT_PROVIDER` يتم تعطيل الـ stub تلقائياً وتُنشأ نوايا الدفع عبر Stripe:
- `POST /api/market/payments/intents` يعيد `clientSecret` الذي يستخدمه المتصفح مع Stripe.js.
- تأكيد الدفع يتم في المتصفح (Stripe Elements)؛ النظام يعتمد على الـ Webhook لتحديث حالة الطلب إلى `paid`.
- `POST /api/market/payments/webhook` يتلقى أحداث مثل `payment_intent.succeeded` ويُحدّث الطلب.

#### حماية Webhook
يتم تمرير الجسم الخام عبر `express.raw()` للتحقق من التوقيع. تأكد من إعداد `STRIPE_WEBHOOK_SECRET`.

#### مقاييس إضافية
عند تفعيل المزود تظهر عدادات:
- `market_payment_provider_success_total`
- `market_payment_provider_fail_total`
- ومخطط زمني عبر `market_payment_provider_duration_seconds`.

#### أحداث تدقيق إضافية
- `payment_intent_provider_created`
- `payment_webhook_received`

### دفتر السجل المالي (Payment Ledger)
يوفر طبقة تتبع دقيقة لكل حدث متعلق بالدفع بهدف التدقيق والمصالحة المالية.

#### التفعيل
يُفعَّل عبر:
```powershell
$env:LEDGER_ENABLED = "1"
```
عند التفعيل يتم حفظ مستند في مجموعة `paymentevents` لكل حدث رئيسي (إنشاء نية، نجاح الدفع، أحداث Webhook أخرى).

#### النموذج (Schema)
المسار: `models/marketplace/PaymentEvent.js`
الحقول الأساسية:
- `intentId` معرف نية الدفع (Stripe PaymentIntent ID).
- `orderId` مرجع الطلب (إن وجد).
- `orderNumber` رقم الطلب المقروء بشرياً.
- `provider` اسم المزود (مثلاً `stripe`).
- `eventType` نوع الحدث (`intent_created`, `payment_intent.succeeded`, أو أي نوع Webhook آخر).
- `status` الحالة (مثل `succeeded`, `processing`).
- `amount` القيمة بالعملة المحلية (SAR) أو المحوّلة من الفلسات/السينت (Stripe تقسم على 100).
- `currency` العملة.
- `customerEmail` البريد الإلكتروني للعميل إن توفر.
- `metadata` نسخة من `metadata` القادمة من المزود (لارتباطات إضافية مثل `orderId`, `userId`).
- `raw` الكائن الكامل للحدث (Webhook) للاحتفاظ بالتفاصيل الأصلية.
- `createdAt` طابع زمني.

#### المؤشرات (Indexes)
- فهرس مركب: `(intentId, createdAt)` للاسترجاع الزمني.
- فهرس إضافي على `orderNumber` لتسريع التحقيق اليدوي.

#### المقاييس (Metrics)
كل حدث يُحفَظ يزيد العدّاد:
```
payment_ledger_events_total{event_type="payment_intent.succeeded"}
```
استعلام معدل الأحداث لكل نوع خلال آخر 15 دقيقة:
```promql
sum(rate(payment_ledger_events_total[15m])) by (event_type)
```

#### سيناريو استخدام سريع
1. عميل ينشئ طلب (حالة دفع `pending`).
2. استدعاء `POST /api/market/payments/intents` ينشئ سجل `intent_created`.
3. عند نجاح Stripe Webhook يُنشأ سجل `payment_intent.succeeded` ويُحدَّث الطلب إلى `paid`.
4. أي حدث إضافي (مثل `payment_intent.processing`) يُسجَّل تلقائياً.

#### حجم واحتفاظ (Retention)
- يُنصح بالاحتفاظ بـ 90 يومًا في Mongo ثم أرشفة السجلات الأقدم في تخزين رخيص (S3 أو Glacier) بصيغة CSV.
- يمكن تطبيق فهرس TTL مخصص لاحقاً (غير مفعّل الآن لتجنب فقد البيانات قبل الأرشفة).

#### مراقبة صحة السجل
استعلام لمقارنة عدد نجاحات المزود مع أحداث السجل الفعلية:
```promql
sum(increase(market_payment_provider_success_total[1h]))
  - sum(increase(payment_ledger_events_total{event_type="payment_intent.succeeded"}[1h]))
```
إذا كانت النتيجة موجبة باستمرار فقد يعني فقدان كتابة Ledger أو مشكلة Webhook.

#### تحسينات مستقبلية
- إضافة حقل `reconciled` بعد تنفيذ عملية مطابقة مع كشف حساب Stripe.
- بناء خدمة أرشفة آلية (Cron) تنقل السجلات الأقدم من 90 يومًا.
- إضافة فهرس على `eventType` لتحسين الاستعلامات التحليلية.
- دعم مزودات متعددة (PayPal، HyperPay) عبر توحيد الحقول وفصل المصدر في `provider`.

#### ملاحظات هجرة
1. اختبر أولاً بمفتاح `sk_test_...` ثم انتقل لمفتاح الإنتاج.
2. أبقِ `MARKET_ENABLE_PAYMENT_STUB=0` منعاً للتضارب.
3. نفّذ إعدادات أمان الشبكة (CSP يسمح لـ js.stripe.com و cdn.jsdelivr.net إن استخدمت Elements).
4. أضف منطق إعادة المحاولة عند فشل استدعاء Stripe (يمكن لاحقاً توسيعه).
5. احتفظ بسجل الأحداث المالي في قاعدة منفصلة (ليست جزءاً من هذا الـ MVP).

## النشر عبر Docker Compose

### ملفات التركيب
- `docker-compose.yml` تشغيل أساسي (التطبيق + Mongo + MinIO وسائط محلية).
- `docker-compose.full.yml` تشغيل موسّع يشمل (Prometheus, Alertmanager, Grafana, Node Exporter, MongoDB Exporter).
- مجلد المراقبة: `infra/monitoring/*` يحوي ملفات إعداد Prometheus و Grafana و Alertmanager.

### بناء وتشغيل (تطبيق فقط)
```powershell
docker compose build
docker compose up -d
```
الوصول:
- التطبيق: http://localhost:3002
- Mongo: mongodb://localhost:27017/axiom_market
- MinIO: http://localhost:9001 (واجهة)، http://localhost:9000 (API)

### تشغيل الحزمة الكاملة (خدمة + مراقبة)
```powershell
docker compose -f docker-compose.full.yml build
docker compose -f docker-compose.full.yml up -d
```
الوصول:
- التطبيق: http://localhost:3002
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Grafana: http://localhost:3000 (افتراضي admin/admin)
- Node Exporter: http://localhost:9100/metrics
- Mongo Exporter: http://localhost:9216/metrics

### متغيرات أساسية
- `MARKET_MONGO_URL` (يجب ضبطه داخل الحاوية على `mongodb://mongo:27017/axiom_market`).
- `METRICS_ENABLED=1` لتفعيل `/metrics`.
- `ENABLE_CSP=1` لتفعيل سياسة أمن المحتوى.
- `MEDIA_BACKEND=local` مع `MEDIA_LOCAL_DIR` و `MEDIA_LOCAL_URL_BASE` لتخزين وسائط بسيط.

### إيقاف وإزالة
```powershell
docker compose -f docker-compose.full.yml down
```
لإزالة البيانات (حذف الأحجام):
```powershell
docker compose -f docker-compose.full.yml down -v
```

### ملاحظات مراقبة
- ملف `prometheus.yml` يستهدف `app:3002` داخل نفس الشبكة؛ لا حاجة لتعديل إذا استُخدم الملف الكامل.
- لتغيير فواصل الجلب عدّل `global.scrape_interval`.
- يمكن إضافة قواعد SLO إضافية في `infra/monitoring/prometheus/rules-slo.yml`.

### تخصيص الإنتاج
- استبدال MinIO بمزود S3 حقيقي (ضبط مفاتيح الوصول + توقيع الروابط).
- تعيين كلمات مرور Grafana و MinIO من أسرار خارجية أو متغيرات CI.
- إضافة عزل شبكة (frontend/backend) واستخدام عناوين داخلية للـ Prometheus.
- تفعيل HTTPS عبر عكس وكيل (Nginx / Traefik) أمام الحاوية.

## الكاش والأداء
- كاش الصفحة الأولى للمنتجات (بدون بحث/فئة) مفعّل داخل `server.js` ويستخدم LRU (الحد عبر `MARKET_CACHE_LIMIT`).
- زمن TTL للعنصر عبر `MARKET_CACHE_TTL_MS` (افتراضي 30000ms).
- يبطل الكاش عند: إنشاء منتج، تحديث، حذف (بائع أو مشرف).
- المقاييس:
  - `market_products_cache_hits_total`
  - `market_products_cache_misses_total`
  - `market_products_cache_hit_ratio` (Gauge يتم تحديثه لكل طلب مصنف hit/miss).
- لتحليل معدل الضربات في Grafana استخدم استعلام PromQL:
```promql
sum(rate(market_products_cache_hits_total[5m])) / (sum(rate(market_products_cache_hits_total[5m])) + sum(rate(market_products_cache_misses_total[5m])))
```
- ضبط الحجم:
```powershell
$env:MARKET_CACHE_LIMIT = "500"
$env:MARKET_CACHE_TTL_MS = "45000"
```

## البحث والترتيب (Search & Relevance)
يوفر المسار الجديد `GET /api/market/search` (وأيضاً الإصدار `GET /api/v1/market/search`) بحثاً متقدماً مع دعم الترتيب الديناميكي، الوجوه (Facets)، التوسعة الاختيارية للعلاقات، والكاش للصفحة الأولى.

### المعاملات (Query Params)
- `q` : نص البحث (يدعم مرادفات أساسية عبر `services/market/search/synonyms.json`).
- `page`, `limit` : ترقيم (حد أقصى للـ limit = 100).
- `sort` : أحد القيم: `rank` (الافتراضي), `popular`, `price_asc`, `price_desc`, `newest`.
- `material`, `thickness` : فلاتر مادة وسُمك (يمكن تمرير سماكات متعددة مفصولة بفواصل).
- `category` : فئة المنتج (تطابق الحقل `category` أو `attributes.category`).
- `priceMin`, `priceMax` : نطاق السعر.
- `vendorRatingMin`, `rating_min` : حد أدنى لتقييم البائع (يُطبِّق فلتر على التقييم المشتق في التجميع).
- `include` : توسعة علاقات مفصولة بفواصل من: `vendor,warehouse,media,variants`.
- `mode=facets` : عند طلب الصفحة الأولى مع هذا المعامل يتم إرجاع وجوه (facets) للمواد والسماكات (وأحيانًا سماكات المتغيرات).
- `expand` : مرادف بديل لـ `include` (للتوافق القديم).

### الاستجابة (Response Shape)
```json
{
  "ok": true,
  "items": [ { /* حقول المنتج مع توسعات حسب include */ } ],
  "total": 57,
  "page": 1,
  "limit": 20,
  "meta": {
    "facets": {
      "materials": { "marble": 12, "granite": 8 },
      "thicknesses": { "2": 15, "3": 9 },
      "variantThicknesses": { "1.5": 4 }
    },
    "hint": "Query too short; consider adding more letters for better relevance"
  },
  "fallback": { "original": "بركشيا", "used": "بركش" },
  "cache": "miss"
}
```

### الترتيب (Ranking Weights)
يتم حساب درجة مركبة من أربعة أوزان (افتراضيًا):
- `credibilityScore` أو تقييم البائع (وزن تقريبي 0.5)
- السعر المعياري العكسي (أرخص = أعلى) (وزن 0.3)
- حداثة الإدراج (وزن 0.2)
- جودة/تنوع الوسائط (وزن 0.0 افتراضيًا ما لم تُضمَّن `media`)

يمكن ضبط الأوزان عبر المعامل `rankWeights` بصيغة:
```
credibility:5,price:3,freshness:2,media:1
```
أو بصيغة رقمية CSV: `5,3,2,1`. يتم تطبيعها داخليًا.

### الوجوه (Facets)
عند `mode=facets` + `page=1` تُجمَّع مواد وسماكات المنتجات (وأحيانًا سماكات المتغيرات إذا توفرت ≤1000 منتج لتفادي الحمل العالي).

### الكاش (Search Cache)
- يتم تخزين نتائج الصفحة الأولى فقط للطلبات البسيطة (لا توسعة علاقات، بدون mode) لمدة افتراضية `MARKET_SEARCH_CACHE_TTL_MS` (افتراضي 15000ms).
- الضبط:
```powershell
$env:MARKET_SEARCH_CACHE_TTL_MS = "20000"
$env:MARKET_SEARCH_CACHE_MAX = "400"
```

### الانحدار (Fallback)
إذا أعاد البحث الأساسي صفر نتائج وكان طول `q >= 4` تُجرى محاولة ثانية باستخدام 60٪ من بادئة النص. إن نجحت تُعاد في الحقل `fallback` ويُسجل حدث تدقيق `search_fallback`.

### المقاييس (Metrics)
- `market_search_requests_total` — عدد طلبات البحث.
- `market_search_zero_results_total` — محاولات البحث الأولى ذات نتائج صفرية.
- `market_search_fallback_total` — عدد نجاحات الانحدار (fallback) بعد محاولة أولى فاشلة.
- `market_search_duration_seconds{fallback="0|1"}` — مدة تنفيذ البحث (بما في ذلك التجميع) مع تمييز استخدام الانحدار.

### مثال سريع (PowerShell / curl)
```powershell
curl "http://localhost:3002/api/market/search?q=marble&sort=rank&page=1&limit=10&mode=facets"
curl "http://localhost:3002/api/market/search?q=granite&include=vendor,media&sort=popular"
```

### تحسينات مستقبلية مقترحة
- دمج فهرس نصي Mongo (`$text`) للمقارنة مع regex + المرادفات.
- إضافة تعديل أوزان ديناميكي عبر خدمة ضبط (`rankAutoTune`).
- دعم fuzzy (Levenshtein) عبر مكتبة خارجية أو تجميع مخصص عند الحاجة.
- تتبع معدل الاستعلامات القصيرة (Quality / Intent metrics).

## البحث الضبابي (Fuzzy Search)
يوفر طبقة إنقاذ أخيرة عند فشل البحث الأساسي + الانحدار (fallback) في إيجاد نتائج، عبر مطابقة تقريبية للأسماء و الـ SKU.

### التفعيل
```powershell
$env:MARKET_ENABLE_FUZZY = "1"
```
اختياري ضبط الفاصل الزمني لإعادة بناء الفهرس:
```powershell
$env:MARKET_FUZZY_REFRESH_MS = "90000"  # 90 ثانية
$env:MARKET_FUZZY_THRESHOLD = "0.4"     # عامل قرب (أقل = تشدد أعلى)
$env:MARKET_FUZZY_MIN_LEN = "2"         # أدنى طول للاستعلام
$env:MARKET_FUZZY_LIMIT = "15"          # أقصى عدد نتائج
```

### كيفية العمل
1. تنفيذ البحث القياسي (تجميع + مرادفات).
2. إذا العدد صفر → محاولة انحدار (بادئة 60%).
3. إذا بقي صفر و `MARKET_ENABLE_FUZZY=1` → تشغيل البحث الضبابي بواسطة Fuse.js.
4. يعاد الحقل:
```json
"fuzzy": { "original": "marbl", "total": 3 }
```
وتتضمن العناصر حقول `sku`, `name`, `fuzzyScore`.

### المقاييس
- `search_fuzzy_attempts_total` عدد محاولات البحث الضبابي.
- `search_fuzzy_success_total` عدد محاولات نجحت بإرجاع ≥1 نتيجة.
- `search_fuzzy_duration_seconds_bucket` زمن تنفيذ البحث الضبابي.

استعلام معدل النجاح النسبي آخر 15 دقيقة:
```promql
sum(rate(search_fuzzy_success_total[15m])) / sum(rate(search_fuzzy_attempts_total[15m]))
```

### الضبط والتوازن
- رفع `MARKET_FUZZY_THRESHOLD` (مثلاً 0.5) يزيد التنوع لكنه قد يدخل نتائج غير دقيقة.
- خفض `MARKET_FUZZY_REFRESH_MS` يحسّن حداثة الفهرس مقابل تكلفة إعادة بناء.
- استخدم لوحة مخصصة في Grafana لمراقبة النسبة أعلاه وتعديل العتبة.

### تجربة نجاح ضبابي سريعة (Quick Demo)
- السكربت Node (متعدد المنصات):
```powershell
npm run quick:test:node
```
- سكربت PowerShell (ويندوز):
```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts/quick-test.ps1
```
هذه السكربتات تقوم بـ:
- تفعيل `MARKET_ENABLE_FUZZY=1` ورفع العتبة إلى `MARKET_FUZZY_THRESHOLD=0.7` لزيادة سعة المطابقة.
- إدخال منتج باسم `Premium Marble Slab`.
- تنفيذ استعلام خاطئ مقصود (مثل `xremum`) ليفشل الأساس والانحدار ويُفعِّل الضبابي.
المخرجات المتوقعة:
- في استجابة البحث: `fuzzy=true` و `total=1`.
- في `/metrics`: زيادة `search_fuzzy_success_total`.
لزيادة/تقليل الحساسية عدّل قيمة `MARKET_FUZZY_THRESHOLD` (نطاق 0.5..0.8) أو غيّر صيغة الاستعلام إلى `premum`, `premiu`, أو أضف منتجات بأسماء متقاربة.

### تحسينات مستقبلية
- دمج وزن `fuzzyScore` داخل ترتيب مركب عند توفر نتائج أساسية قليلة.
- بناء فهرس متعدد اللغات (عربي/إنجليزي) مع تطبيع Unicode.
- الانتقال لفهرس خارجي (مثل Meilisearch / Elastic) عند تجاوز 50K منتج.

## دليل اختبار سريع (Quick Test Guide)
يوفر هذا القسم خطوات عملية للتحقق من الوظائف الأساسية (المنتجات، البحث، الانحدار، البحث الضبابي، المدفوعات، دفتر السجل، والمقاييس) في بيئة محلية.

### 1. تشغيل الخدمة (ذاكرة أو Mongo اختيارياً)
```powershell
# خيار ذاكرة بدون Mongo (منتجات تجريبية)
$env:MARKET_ALLOW_DB_FAIL='1'
$env:MARKET_SEED_DEMO='1'
$env:MARKET_PORT='3002'
$env:METRICS_ENABLED='1'
$env:MARKET_ENABLE_FUZZY='1'
node server.js
```
لتمكين Mongo محلياً أولاً (اختياري):
```powershell
docker run --name market-mongo -p 27017:27017 -d mongo:6
$env:MARKET_MONGO_URL='mongodb://127.0.0.1:27017/axiom_market'
$env:MARKET_CREATE_INDEXES_ON_START='1'
$env:MARKET_SEED_DEMO='1'
$env:METRICS_ENABLED='1'
$env:MARKET_ENABLE_FUZZY='1'
node server.js
```

### 2. اختبار البحث الأساسي + الانحدار
استعلام يعيد نتائج:
```powershell
curl "http://localhost:3002/api/market/search?q=marble&limit=5"
```
استعلام مُتعمد بخطأ إملائي (يؤدي ربما لصفر نتائج ثم انحدار):
```powershell
curl "http://localhost:3002/api/market/search?q=marblxx&limit=5"
```
إذا ظهر الحقل `fallback` تمت محاولة الانحدار بنجاح.

### 3. اختبار البحث الضبابي (بعد فشل الانحدار)
استخدم كلمة شبه صحيحة قصيرة:
```powershell
curl "http://localhost:3002/api/market/search?q=Breccy&limit=5"
```
يُتوقع ظهور:
```json
"fuzzy": { "original": "Breccy", "total": <N> }
```
والعناصر تحتوي `fuzzyScore`.

### 4. تفعيل دفتر السجل + Stripe (يتطلب مفاتيح اختبار)
دفتر السجل يعمل فقط مع مزود حقيقي (Stripe).
```powershell
$env:PAYMENT_PROVIDER='stripe'
$env:STRIPE_SECRET_KEY='sk_test_XXXX'
$env:STRIPE_WEBHOOK_SECRET='whsec_XXXX'
$env:LEDGER_ENABLED='1'
$env:METRICS_ENABLED='1'
node server.js
```
تشغيل Stripe CLI لإعادة توجيه الـ Webhook:
```powershell
stripe login
stripe listen --forward-to localhost:3002/api/market/payments/webhook
```

### 5. إنشاء طلب ثم نية دفع (Stripe)
أضف منتج (إذا لم يكن موجوداً):
```powershell
curl -X POST http://localhost:3002/api/market/products -H "Content-Type: application/json" -d '{"name":"Test Stone A","category":"stone","price":120,"currency":"SAR","vendorId":"101","countryCode":"SA"}'
```
أضف للسلة:
```powershell
curl -X POST http://localhost:3002/api/market/cart -H "Authorization: Bearer devUser123" -H "Content-Type: application/json" -d '{"sku":"SA-101-07-A1","quantity":1}'
```
أنشئ طلباً:
```powershell
curl -X POST http://localhost:3002/api/market/orders -H "Authorization: Bearer devUser123" -H "Content-Type: application/json" -d '{"currency":"SAR"}'
```
احفظ `orderId` من الاستجابة ثم أنشئ نية دفع:
```powershell
curl -X POST http://localhost:3002/api/market/payments/intents -H "Authorization: Bearer devUser123" -H "Content-Type: application/json" -d '{"orderId":"<ORDER_ID>"}'
```
اختبر حدث نجاح وهمي (Stripe CLI):
```powershell
stripe trigger payment_intent.succeeded
```
بعد الاستقبال راجع حالة الطلب:
```powershell
curl http://localhost:3002/api/market/orders/<ORDER_ID> -H "Authorization: Bearer devUser123"
```
يجب أن تكون `paymentStatus` = `paid`.

### 6. فحص دفتر السجل (Mongo)
داخل عميل Mongo:
```powershell
docker exec -it market-mongo mongosh axiom_market --eval 'db.paymentevents.find().sort({createdAt:-1}).limit(5).pretty()'
```
يُتوقع رؤية سجلات: `intent_created` و `payment_intent.succeeded`.

### 7. التحقق من المقاييس
```powershell
curl http://localhost:3002/metrics | Select-String "search_fuzzy_attempts_total"
curl http://localhost:3002/metrics | Select-String "payment_ledger_events_total"
```

### 8. استعلام Prometheus (إن كانت المنظومة الكاملة تعمل)
معدل نجاح البحث الضبابي آخر 5 دقائق:
```powershell
curl "http://localhost:9090/api/v1/query?query=sum(rate(search_fuzzy_success_total[5m]))/sum(rate(search_fuzzy_attempts_total[5m]))"
```
معدل أحداث السجل لكل نوع:
```powershell
curl "http://localhost:9090/api/v1/query?query=sum(rate(payment_ledger_events_total[10m]))%20by%20(event_type)"
```

### 9. اختبار Alertmanager بعد تعديل الملف
تحقق من صحة التهيئة (يلزم تنزيل promtool أو الدخول للحاوية):
```powershell
promtool check config infra/monitoring/alertmanager/alertmanager.yml
```
أو داخل الحاوية (اسم حاوية افتراضي `alertmanager`):
```powershell
docker exec -it alertmanager /bin/sh -c 'promtool check config /etc/alertmanager/alertmanager.yml'
```

### 10. تنظيف سريع
```powershell
docker stop market-mongo
docker rm market-mongo
```

### استكشاف أخطاء شائعة
- عدم ظهور `fuzzy`: تأكد من `MARKET_ENABLE_FUZZY=1` وأن طول الاستعلام ≥ القيمة في `MARKET_FUZZY_MIN_LEN`.
- عدم إنشاء سجلات دفع: تحقق أن المزود Stripe مفعّل و`LEDGER_ENABLED=1`.
- عدم استقبال Webhook: تأكد من تشغيل `stripe listen` وأن `STRIPE_WEBHOOK_SECRET` مطابق.

### سكربت اختبار سريع آلي
بعد إضافة السكربت `scripts/quick-test.ps1` يمكنك تشغيل:
```powershell
npm run quick:test
```
السكربت سيقوم بـ:
- ضبط متغيرات البيئة (وضع ذاكرة + بذرة + تفعيل fuzzy + المقاييس).
- تشغيل الخادم.
- إنشاء منتج وعناصر سلة وطلب.
- تنفيذ بحث قياسي ثم بحث يفشل لتحفيز الانحدار والبحث الضبابي.
- استخراج مقاييس مختارة وعرض ملخص.
لإيقاف الخادم بعد انتهاء السكربت:
```powershell
Stop-Process -Id (Get-Process -Name node | Select-Object -First 1).Id
```

#### نسخة Node (بدون PowerShell)
للتشغيل عبر سكربت Node متعدد المنصات:
```powershell
npm run quick:test:node
```
خيارات إضافية:
```powershell
node scripts/quick-test.js --mongo --port=3010
node scripts/quick-test.js --stripe  # يتوقع توفر مفاتيح STRIPE_* في البيئة
```
يُغلق الخادم تلقائياً بنهاية الملخص.

ملاحظة (نجاح البحث الضبابي): السكربت يقوم تلقائياً برفع `MARKET_FUZZY_THRESHOLD` إلى `0.7` ويستخدم استعلاماً خاطئاً مثل `xremum` لضمان تفعيل الطبقة الضبابية وظهور `fuzzy=true`، كما يزيد عدّاد `search_fuzzy_success_total` في `/metrics`. يمكن تعديل العتبة أو صيغة الاستعلام حسب الحاجة.

#### محاكاة Webhook Stripe + تقرير HTML
لتشغيل اختبار كاملة يشمل إنشاء نية دفع ثم محاكاة حدث نجاح وتوليد تقرير HTML:
```powershell
$env:STRIPE_SECRET_KEY='sk_test_XXXX'
$env:STRIPE_WEBHOOK_SECRET='whsec_XXXX'
npm run quick:test:node:stripe
```
النتيجة:
- إرسال حدث `payment_intent.succeeded` موقّع (مُنشأ عبر `stripe.webhooks.generateTestHeaderString`).
- تحديث حالة الطلب إلى `paid` إن نجح الحدث.
- إنشاء ملف تقرير: `reports/quick-test-report.html` يحتوي ملخص البحث، حالة الانحدار، النتائج الضبابية، المقاييس الجزئية، ونتيجة الـ Webhook.

في حال فشل التحقق من التوقيع تظهر قيمة `ok=false` في القسم الخاص بالـ Webhook داخل التقرير.

### المرادفات (Synonyms)
يتم توسيع الاستعلام عبر ملف `services/market/search/synonyms.json`. عند وجود كلمة مفتاحية يتم استبدالها/توسيعها إلى مجموعة regex باستخدام دالة `buildRegexFromSynonyms`. لإضافة كلمة جديدة:
1. أضف مفتاحاً جديداً مع مصفوفة المرادفات (باللغتين إن أمكن).
2. حافظ على الحروف الصغيرة داخل الملف لسهولة المطابقة.
3. تجنب التكرارات؛ النظام يستخدم مجموعة (Set).
مثال:
```json
"limestone": ["حجر جيري", "stone"],
"حجر جيري": ["limestone"]
```
بعد التعديل لا حاجة لإعادة بناء خاصة؛ يتم تحميل الملف عند أول استدعاء.

## سجلات التدقيق والأمن
- مفعّلة افتراضياً (`MARKET_AUDIT_ENABLED=1`) وتُسجَّل داخل ملفات السجلات القياسية عبر Winston.
- أحداث رئيسية يتم تسجيلها بصيغة JSON:
  - `auth_success` / `auth_denied`
  - `role_denied`
  - `order_created`
  - `order_fulfillment_transition`
  - `payment_intent_created` / `payment_confirmed`
  - `cart_merged`
- كل سجل يحتوي: `timestamp`, `event`, `userId`, `correlationId`, وإضافات سياقية (`orderId`, `intentId`, إلخ).
- يمكن إيقاف التدقيق:
```powershell
$env:MARKET_AUDIT_ENABLED = "0"
```
- يوصى بإرسال السجلات إلى نظام مركزي (ELK / Loki) عبر ربط الحاوية أو إضافة سطر إلى `docker-compose` بمسار مجلد `logs`.

### إعداد سريع (PowerShell)
```powershell
# تفعيل JWT فقط
$env:MARKET_REQUIRE_JWT = "1"
$env:AUTH_JWKS_URL = "https://your-auth/.well-known/jwks.json"
# أو استخدم مفتاح عام مباشر
# $env:JWT_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

node server.js
```
## Checkout & Orders (MVP)

- Endpoints:
  - `GET /api/market/cart` — يعرض عناصر السلة والإجمالي الفرعي.
  - `POST /api/market/orders` — ينشئ طلباً من السلة. يقبل `currency` (افتراضي `SAR`) و`shippingAddress` اختياري.
  - `GET /api/market/orders` — قائمة الطلبات مع فلاتر: `q`, `paymentStatus`, `fulfillmentStatus`, `from`, `to`, `sort`, `page`, `limit`.
  - `GET /api/market/orders/:id` — تفاصيل الطلب.

- واجهات:
  - `pages/checkout.html` — نموذج عنوان الشحن + ملخص السلة.
  - `pages/my-orders.html` — قائمة الطلبات مع بحث/فرز وفلاتر الحالات وترقيم.
  - `pages/order-details.html` — تفاصيل الطلب تتضمن العنوان والحالات والإجماليات.

- المتغيرات البيئية (الحساب):
  - `ORDER_TAX_PERCENT` (أو `ORDER_VAT_PERCENT`) — نسبة الضريبة (مثلاً 15).
  - `ORDER_SHIPPING_FIXED` — قيمة الشحن الثابتة (مثلاً 15).

### تشغيل سريع (محلي)

1. ضبط المتغيرات:
```powershell
$env:ORDER_TAX_PERCENT = "15"
$env:ORDER_SHIPPING_FIXED = "15"
```

2. تشغيل الخدمة:
```powershell
node server.js
```

#### تشغيل مع Mongo Atlas (بدون كشف السر في المستودع)
ضع سلسلة الاتصال في متغير البيئة `MARKET_MONGO_URL` ثم استخدم سكربت 5500 مع Mongo:
```powershell
$env:MARKET_MONGO_URL = "<YOUR_ATLAS_URI>"
npm run dev:5500:db
# افتح:
# http://localhost:5500/pages/ai-chat-healthz.html
# http://localhost:5500/pages/ai-chat.html
```
ملاحظة: لا تضع بيانات دخول Mongo داخل ملفات المستودع. استخدم متغيرات البيئة أو أسرار CI.

3. الاختبار:
- افتح `pages/checkout.html`، عبّئ العنوان، اضغط "تأكيد الطلب".
- استخدم الروابط للانتقال إلى `pages/my-orders.html` أو `pages/order-details.html?id=<ORDER_ID>`.

ملاحظات:
- يتم حساب الضريبة والشحن على الخادم وفق المتغيرات البيئية.
- تظهر شارات عربية لحالات الدفع والتنفيذ في قائمة الطلبات والتفاصيل.
# Marketplace System (systems/marketplace)

منصة السوق داخل مجلد الأنظمة تم تنظيمها الآن لتفصل بين طبقة الخادم وطبقة الواجهة مع الحفاظ على سهولة التطوير المحلي.

## الأهداف الرئيسية
1. فصل شيفرة المتصفح (صفحات + أصول) عن منطق الخادم (تحكم، نموذج، اتصال DB).
2. توفير نقطة تشغيل معيارية بخطوات بسيطة.
3. تمهيد مراحل توسعة لاحقة (سلة، طلبات، مصادقة، بائعون) دون تداخل الملفات.

## الهيكل المقترح (الحالي مؤقتاً)
```
systems/marketplace/
  pages/              ← صفحات HTML (واجهة السوق + الطلبات + البائع)
  css/                ← أنماط الواجهة
  js/                 ← سكربتات المتصفح فقط (لا تُستخدم فيها require أو mongoose)
  src/                ← منطق الخادم (controllers, models, utils, db, cache)
  config/tenants.json ← تعريف البلدان والفئات
  server.js           ← خادم مصغر (Express) للمنتجات والإحصائيات
  market-server.js    ← خادم موسع (يتطلب تبعيات غير منسوخة بعد)
  package.json        ← تعريف الحزم وسكربتات التشغيل
```

ملاحظة: بعض الملفات في `js/` كانت خلطاً بين منطق الخادم (مثل تعريف نموذج Mongoose للمتجر) ومنطق المتصفح. سنقوم في مرحلة لاحقة بنقل ما هو خادم إلى `src/modules/*` أو تفكيكه. حاليًا تُركت كما هي لتسهيل البدء.

## تشغيل سريع محلي
انسخ ملف البيئة (إن وُجِد):
```powershell
Copy-Item .env.example .env
```
ثبّت الحزم (مرة واحدة):
```powershell
npm install
```
شغّل الخادم المبسط (وضع ذاكرة فقط إن لم يتوفر Mongo):
```powershell
$env:MARKET_ALLOW_DB_FAIL='1'; $env:MARKET_PORT='3002'; node server.js
```
بذرة بيانات تجريبية تلقائية:
```powershell
$env:MARKET_ALLOW_DB_FAIL='1'; $env:MARKET_SEED_DEMO='1'; $env:MARKET_PORT='3002'; node server.js
```
سيظهر سجل: `✅ Marketplace service running on http://localhost:3002`

### تفعيل Mongo (اختياري)
إذا كان لديك Docker:
```powershell
docker run --name market-mongo -p 27017:27017 -d mongo:6
```
ثم شغّل الخادم بوضع Mongo مع فهارس وبذور:
```powershell
npm run dev:db
```
أو يدويًا:
```powershell
$env:MARKET_MONGO_URL='mongodb://127.0.0.1:27017/axiom_market';
$env:MARKET_CREATE_INDEXES_ON_START='1';
$env:MARKET_SEED_DEMO='1';
$env:MARKET_ALLOW_DB_FAIL='1';
$env:MARKET_PORT='3002';
node server.js
```
إن لم يكن Docker متوفرًا، ثبّت Mongo محليًا أو استخدم Mongo Atlas وضع سلسلة الاتصال في `MARKET_MONGO_URL`.

## نقاط الخادم الحالية (server.js)
- `GET /api/market/products` جلب منتجات (Mongo أو ذاكرة) مع صفحة وحد.
- `POST /api/market/products` إنشاء منتج أساسي وتوليد SKU.
- `GET /api/market/metrics` إحصائيات (عدد المنتجات، الفئات، البائعين).
- نقاط توافقية قديمة: `/items/data`, `/products`.

## ما سيتم إضافته لاحقاً (خطة مراحل)
مرحلة 1: مسارات بسيطة للسلة والطلبات والمصادقة (ذاكرة فقط).  
مرحلة 2: تحسين بنية المجلدات وفصل ملفات الخادم المختلطة داخل `js/`.  
مرحلة 3: توحيد طبقة البحث والاقتراح (Autocomplete) بمسار منفصل + تحسين الكاش.  
مرحلة 4: دعم البائع (CRUD منتجات، رفع وسائط مصغر).  
مرحلة 5: أوامر/سجل الطلبات + حالات الدفع والتنفيذ.  
مرحلة 6: أمن ورصد (معدل طلبات، سجلات منظمة، مراقبة الأداء).  

## البيئة وقيم افتراضية
- `MARKET_PORT` المنفذ الافتراضي 3002.
- `MARKET_MONGO_URL` سلسلة اتصال Mongo (إذا غابت يعمل نمط ذاكرة).
- `MARKET_ALLOW_DB_FAIL=1` لتجاهل فشل الاتصال والتشغيل بذاكرة.
- `MARKET_SEED_DEMO=1` لإدخال عينات منتجات.

## البلدان والعملات
يستخدم `config/tenants.json` لتحديد `countryCode` واشتقاق العملة عبر `getCurrencyForCountry`. إذا لم تُحدد دولة في الاستعلام يتم الاعتماد على النطاق أو الافتراضي `SA`.

## تطوير لاحق
الخادم الموسع `market-server.js` يحوي ميزات متقدمة (بائعون، وسائط، رسائل، وزن ترتيب ديناميكي). يتطلب نسخ باقي الخدمات (`services/market/*`, `middleware/rbac`, إلخ). سيتم دمج أجزاء منه تدريجياً داخل هيكل معياري داخل `src/`.

## تنبيهات تنظيمية
- لا تضع منطق خادم داخل ملفات تحت `pages/` أو `css/` أو `js/` مستهدفة للمتصفح.
- تأكد من أن أي ملف يستخدم `require('mongoose')` أو `express.Router()` ينتقل إلى `src/`.
- حافظ على ملفات الواجهة خفيفة وتعتمد على واجهات API واضحة فقط.

## مساهمة
لإضافة وظيفة جديدة:  
1. أنشئ وحدة داخل `src/modules/<feature>/` (إن لم توجد أنشئها).  
2. صدّر راوتر Express في ملف منفصل ثم ضَمّه داخل `server.js`.  
3. حدث README بالمخزون الجديد.

---
تم إعداد هذا المستند ليتماشى مع إعادة تنظيم الشيفرة ويسهّل الانطلاق السريع.

لمزيد من نظرة شاملة ومنظمة: راجع وثيقة النظرة العامة
- `docs/MARKETPLACE_SYSTEM_OVERVIEW_AR.md`

## AI Assistant (Portable Agent)
- تم إضافة مساعد ذكاء صناعي محمول (نواة مستقلة + واجهة HTTP ثابتة).
- اطلع على التفاصيل وخطوات التشغيل في `README-AI.md` داخل نفس المجلد.

### نشر واجهة الدردشة (SSE & Reverse Proxy)
- نفس الأصل: التطبيق يقدّم الآن مجلد `pages/` من الخادم نفسه (`/pages/ai-chat.html` و`/pages/ai-chat-healthz.html`). يُنصح باستخدام نفس الدومين للأصل والـ API لتفادي CORS و405 من خوادم ثابتة.
- متغيرات موصى بها (إنتاج):
  - `FORCE_HTTPS=1` تفعيل التحويل إلى HTTPS + HSTS.
  - `ENABLE_CSP=1` تفعيل سياسة أمن المحتوى. بما أن صفحات الدردشة تستخدم CSS مضمن، فعّل: `CSP_ALLOW_INLINE_STYLES=1`.
  - `METRICS_ENABLED=1` إن رغبت في `/metrics`.
  - للتطوير فقط مع أصول مختلفة: `MARKET_CORS_ALLOW_DEV=1`.
- ترويسات SSE: الخادم يرسل `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, و`X-Accel-Buffering: no`.

Nginx (خلف وكيل)
```
location /api/ai/ {
  proxy_pass http://app:3002/api/ai/;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  chunked_transfer_encoding on;
  add_header X-Accel-Buffering no;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
}

location /pages/ {
  proxy_pass http://app:3002/pages/;
}
```

Kubernetes Ingress (Nginx)
```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Accel-Buffering "no";
```

تشغيل محلي ثابت
```powershell
$env:MARKET_ALLOW_DB_FAIL='1'; $env:MARKET_PORT='5500'; node server.js
# افتح واجهة الصحة للتحقق:
# http://localhost:5500/pages/ai-chat-healthz.html
```

فحص تلقائي (Node)
```powershell
npm run ci:sse
```

## Personal Assistant (Isolated)
- خدمة مساعد شخصية مستقلة تمامًا عن بيانات السوق. تعمل على منفذ منفصل وتستخدم ذاكرة جلسات بصيغة JSONL مع تشفير AES-256-GCM اختياري.

### الملفات ذات الصلة
- `server-personal.js` — خادم Express للمساعد الشخصي (منفذ افتراضي 5600).
- `agent-personal/index.js` — نواة المساعد والذاكرة المشفرة والجلسات.
- `agent-personal/profile.json` — هوية المساعد وسياسة الخصوصية.
- `pages/personal-chat.html` — واجهة ويب بسيطة تدعم البث SSE.

### المتغيرات البيئية
- `PERSONAL_PORT` — المنفذ (افتراضي `5600`).
- `PERSONAL_API_KEY` — مفتاح اختياري لطلبه عبر الترويسة `X-API-KEY`.
- `PERSONAL_MEM_KEY` — مفتاح تشفير سري لـ AES-256-GCM (مطلوب للتشفير؛ إذا غاب تُحفظ الذاكرة كنص عادي).
- `AI_MODEL` — اسم النموذج (افتراضي مزود داخلي مبسط؛ يمكن ربط OpenAI لاحقًا).
- `OPENAI_API_KEY` — مفتاح اختياري إن فُعِّل مزود OpenAI في `agent-personal/index.js`.

### نقاط واجهة API
- `POST /api/personal/chat` — رد غير متدفق. الجسم: `{ sessionId, prompt }`، يعيد `{ ok, reply }`.
- `POST /api/personal/chat/stream` — رد متدفق SSE. الجسم: `{ sessionId, prompt }`. الترويسات المرسلة تتضمن `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, و`X-Accel-Buffering: no`.
- `GET /healthz` — فحص صحة بسيط.

### التشغيل المحلي (PowerShell)
```powershell
# تثبيت الحزم (إن لم تكن مثبّتة)
npm install

# تعيين متغيرات مبدئية وتشغيل الخادم الشخصي
$env:PERSONAL_PORT = "5600";
$env:PERSONAL_API_KEY = "dev-key-123";  # اختياري
$env:PERSONAL_MEM_KEY = "0123456789abcdef0123456789abcdef"; # 32 بايت سداسي
node server-personal.js
```
الوصول:
- صفحة الدردشة: `http://localhost:5600/pages/personal-chat.html`
- عند تفعيل مفتاح API أدخل القيمة في حقل "API Key" داخل الصفحة.

### استخدام واجهة الدردشة
- أدخل `API Base` إذا غيرت المنفذ (افتراضي: `http://localhost:5600`).
- اختر `Session` (يُنشئ معرفًا جديدًا تلقائيًا عند الحاجة).
- فعّل خيار `Stream (SSE)` للحصول على ردود متدرجة مباشرة.

### ملاحظات الخصوصية
- الذاكرة تُحفظ في ملفات جلسات بصيغة JSONL لدى `agent-personal/`.
- عند ضبط `PERSONAL_MEM_KEY` تُشفّر كل سطر بوسم nonce ووسم توثيق GCM.
- لا يصل هذا المساعد إلى أي خدمة أو قاعدة بيانات السوق.

### عكس وكيل (اختياري)
Nginx snippet للبث بدون تخزين مؤقت:
```
location /api/personal/ {
  proxy_pass http://personal:5600/api/personal/;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_buffering off;
  chunked_transfer_encoding on;
  add_header X-Accel-Buffering no;
}
location /pages/ {
  proxy_pass http://personal:5600/pages/;
}
```

## المراقبة والتنبيهات (Monitoring & Alerts)
تم إعداد مجموعة مقاييس وتسجيلات + تنبيهات Prometheus لمراقبة الصحة والأداء والاعتمادية.

### المقاييس الرئيسية
- Auth / HTTP: `http_requests_total`, `http_errors_total`, `http_request_duration_seconds_bucket`

### توجيه التنبيهات (Alertmanager Routing)
مثال الإنتاج (`alertmanager.yml`) يربط الشدة بقناة مختلفة:
| Severity | Receiver |
|----------|----------|
| critical | slack (قناة حرجة) |
| warning  | telegram |
| info     | email |

إضافة تصعيد (Escalation) عبر مستقبل Pager جديد:
1. أضف مستقبل `pager` (PagerDuty أو SMS gateway).
2. أضف route بمطابقة `severity="critical"` و `team="platform"`.

مثال مقتطف:
```yaml
route:
  receiver: default
  routes:
    - matchers: [ severity="critical", team="platform" ]
      receiver: pager

receivers:
  - name: pager
    pagerduty_configs:
      - routing_key: ${PAGERDUTY_ROUTING_KEY}
        description: '{{ .CommonAnnotations.summary }}'
```

### تحسين قالب Slack
استخدم رموز تعبيرية حسب الشدة:
```yaml
slack_configs:
  - api_url: ${SLACK_WEBHOOK_URL}
    channel: '#prod-alerts'
    title: '{{ .CommonAnnotations.summary }}'
    text: >-
      {{ if eq (index .Alerts 0).Labels.severity "critical" }}:rotating_light:{{ else if eq (index .Alerts 0).Labels.severity "warning" }}:warning:{{ else }}:information_source:{{ end }}
      *Status:* {{ .Status }}
      {{ range .Alerts }}• *{{ .Labels.alertname }}* ({{ .Labels.severity }}) route={{ .Labels.route }}
      {{ end }}
      Silence: {{ .ExternalURL }}/#/silences
```

### Silences (إسكات مؤقت)
لإسكات تنبيه متكرر أثناء الإصلاح:
1. افتح واجهة Alertmanager `/#/silences`.
2. أنشئ Silence يطابق: `alertname="MarketSearchLatencyP95High"` مع مدة محددة.
3. وثّق سبب الإسكات في incident doc.

### فصل البيئات
استعمل ملفي إعداد منفصلين (`alertmanager.yml` للإنتاج و `alertmanager-staging.yml` للتجارب) مع قنوات مختلفة (`#staging-alerts`). تأكد من عدم إعادة استخدام مفاتيح ويب هوك الإنتاج في بيئة الاختبار.
- منتجات: `market_products_requests_total`, الكاش: `market_products_cache_*`
- بحث: `market_search_requests_total`, `market_search_zero_results_total`, `market_search_fallback_total`, `market_search_duration_seconds_bucket`
- مدفوعات: `market_payment_intents_total`, `market_payment_confirms_total`, وعند Stripe: `market_payment_provider_*`
- SLO تسجيلات: `market:http_request_duration_p95`, `market:http_error_rate_ratio`

### ملفات القواعد (Prometheus)
- `infra/monitoring/prometheus/rules-market.yml` أخطاء ولاتنسيات أساسية.
- `infra/monitoring/prometheus/rules-slo.yml` تسجيلات SLO وحرق الميزانية.
- `infra/monitoring/prometheus/rules-search-payment.yml` تنبيهات البحث والمدفوعات.

### الروتبكس (Runbooks)
| حالة | ملف |
|------|------|
| معدل نتائج بحث صفرية مرتفع | `docs/runbooks/search-zero-results.md` |
| استخدام الانحدار (Fallback) عالي | `docs/runbooks/search-fallback.md` |
| زمن بحث p95 عالي | `docs/runbooks/search-latency.md` |
| معدل ضرب الكاش منخفض | `docs/runbooks/cache-low-hit.md` |
| معدل فشل مزود الدفع | `docs/runbooks/payment-provider-failures.md` |
| زمن إنشاء نية الدفع عالي | `docs/runbooks/payment-latency.md` |
| الاستجابة للحوادث | `docs/runbooks/incident-response.md` |

### مستويات الشدة (Severity)
- info: مراقبة تحسين (مثل انخفاض ضرب الكاش).
- warning: تدهور ملحوظ يحتاج تحقيق خلال ساعات.
- critical: تأثير مباشر على المستخدم / الإيرادات يجب التصرف فوراً.

### تدفق الاستجابة المختصر
1. تأكيد صحة التنبيه (لوحة Grafana مقابلة).
2. تحديد النطاق: هل كل المسارات أم مسار محدد؟ هل بلد معين؟
3. جمع سياق (آخر نشر، عدد الطلبات المتأثر، نسبة النجاح البديلة).
4. تطبيق إجراء مؤقت (زيادة TTL، تعطيل توسعة ثقيلة، إعادة مفتاح سرّي) حسب الحالة.
5. توثيق الإجراء في سجل الحوادث (ملف incident-response أو نظام خارجي).
6. مراجعة بعد الحادث لضبط حدود أو إضافة فهرس/كاش.

### أوامر سريعة (PowerShell)
استخراج معدل أخطاء 5xx آخر 5 دقائق:
```powershell
curl http://localhost:9090/api/v1/query?query=sum(rate(http_errors_total{class="5xx",job="market"}[5m]))
```
استخراج p95 زمن البحث:
```powershell
curl "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(market_search_duration_seconds_bucket[5m]))%20by%20(le))"
```

### تحسينات مستقبلية
- دمج Alertmanager routing (critical → SMS / Pager; warning → Email).
- إنشاء لوحة موحدة لحالة الحريق (Incident Overview Dashboard).
- إضافة تتبع توزيع أحجام الاستعلامات.
 - توسيع دفتر السجل المالي بأتمتة الأرشفة + مطابقة كشف حساب المزود.

