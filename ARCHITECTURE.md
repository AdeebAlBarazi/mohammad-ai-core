## Data Model Relationships (ER Overview)

This section summarizes the core marketplace entities and their relationships. It reflects the current Mongoose models under `models/marketplace/*` and how services use them.

### ASCII ER Diagram

```
     +-------------------+
     |     MpVendor      |
     |-------------------|
     | vendorCode (uniq) |
     | countryCode       |
     | companyName       |
     | ratings.*         |
     +---------+---------+
         |
     1        N|
         v
     +-------------------+
     |   MpWarehouse     |
     |-------------------|
     | countryCode       |
     | name (uniq w/     |
     |  vendor+country)  |
     | ratings.*         |
     +---------^---------+
         |
         |
         |
     +---------+---------+
     |      MpProduct    |
     |-------------------|
     | sku (uniq)        |
     | countryCode       |
     | name, material    |
     | price, currency   |
     | thicknessCm/Mm    |
     | credibilityScore  |
     | active            |
     | vendor -> MpVendor|
     | warehouse ->      |
     |    MpWarehouse    |
     +----+---------+----+
       |         |
      N|         |N
       v         v
   +----------------+  +------------------+
   | MpProductMedia |  | MpProductVariant |
   |----------------|  |------------------|
   | product ->     |  | product ->       |
   |   MpProduct    |  |   MpProduct      |
   | type,url,thumb |  | thickness/size   |
   | qualityScore   |  | price,currency   |
   | meta           |  | stock,active     |
   +----------------+  +------------------+

     +-------------------+
     |     MpCart        |
     |-------------------|
     | userKey           |
     | countryCode       |
     | subtotal,currency |
     | items[ sku, qty,  |
     |  unitPrice, cur,  |
     |  product?->Product|
     +-------------------+

     +-------------------+
     |     MpOrder       |
     |-------------------|
     | orderNumber (uniq)|
     | user -> User?     |
     | vendor -> Vendor? |
     | countryCode       |
     | totals, statuses  |
     | items[ sku, qty,  |
     |  unitPrice, cur,  |
     |  product?->Product|
     +-------------------+

     +-------------------+
     | MpCredibilityScore|
     |-------------------|
     | vendor -> MpVendor|
     | finalScore        |
     | vendorRating      |
     | meta              |
     +-------------------+
```

### Key Relationships
- Vendor 1—N Warehouse: each warehouse belongs to a single vendor; uniqueness across `(countryCode, vendor, name)`.
- Vendor 1—N Product: products may reference the owning vendor (optional in some flows).
- Product 1—N ProductMedia: multiple media entries (images/video/360) per product.
- Product 1—N ProductVariant: variants carry thickness/size/price/stock for a product.
- Vendor 1—N CredibilityScore: computed scores per vendor.
- Cart N—1 UserKey: carts scoped by `userKey` and `countryCode`; items carry `sku` and may reference `product`.
- Order N—1 User (optional) + N—1 Vendor (optional): orders contain item snapshots; each item has `sku` and may reference a product.

### Indexes & Uniqueness
- `MpProduct.sku`: unique, indexed.
- `MpVendor(countryCode, vendorCode)`: unique composite.
- `MpWarehouse(countryCode, vendor, name)`: unique composite.
- `MpOrder.orderNumber`: unique.
- `MpCart.userKey`, `MpCart.countryCode`: indexed; `items.sku` indexed.

### Service Usage Notes
- `productService` orchestrates product creation/search and manages variants/media.
- `cartService` and `orderService` operate in memory or Mongo, depending on connectivity.
- `vendorService` manages vendor lifecycle; `credibilityService` computes scores.
- Media upload paths rely on `mediaStorage` and generate thumbnails via `sharp` for images.

# Axiom Marketplace (systems/marketplace)

هذا المستند يشرح بنية مجلد السوق الكبير كما هي الآن، ويوثّق المعمارية التشغيلية المقترحة لتطوير النظام إلى مستوى إنتاجي.

## 1) نظرة عامة
- واجهة (Client) ثابتة تعتمد HTML/CSS/JS بسيطة.
- خدمة سوق مبسطة `server.js` توفر قوائم منتجات وإحصائيات مع وضع ذاكرة في حال غياب MongoDB.
- خدمة سوق موسّعة `market-server.js` مع وحدات Services متقدّمة (بائعون، سلة، طلبات، وسائط، رسائل، ترتيب ديناميكي…).
- تعدد دول/عملات عبر `config/tenants.json`.
- مجموعة UI System (Tokens + Components) لتوحيد الواجهة.
- مجموعة مصادقة مصغّرة `auth/` قابلة للتشغيل كخدمة مستقلة.

## 2) شجرة المجلدات المهمة
```
systems/marketplace/
  pages/                ← صفحات الواجهة (السوق، المنتج، السلة، الطلبات، الإدارة)
  css/                  ← أنماط عامة (marketplace.css, districts_*.css, index_style.css)
  js/                   ← سكربتات المتصفح: market-*.js، token.js، dev-auth-loader.js
  ui-system/            ← Tokens و Components (CSS) وأنماط صفحات إضافية
  config/tenants.json   ← تعريف الدول والفئات والعملات
  src/                  ← طبقة الخادم المبسطة: controllers, models, db, cache, utils
  services/market/      ← وحدات الخادم المتقدمة: services + repos + cache + search
  vendor/fontawesome/   ← أيقونات الواجهة
  auth/                 ← خدمة مصادقة مستقلة (Stub)
  server.js             ← خادم مبسّط (Express)
  market-server.js      ← خادم موسع يتكامل مع services/*
  package.json          ← سكربتات التشغيل والحزم
```

## 3) واجهة الويب (Client)
- `pages/marketplace-index.html`: صفحة السوق الرئيسية. تربط:
  - `../js/market-common.js`: اكتشاف API، دوال fetch، أحداث.
  - `../js/market-products.js`: جلب/عرض المنتجات + ترقيم + إضافة للسلة.
  - `../js/market-cart.js`: عرض السلة + شارة العدد + الدفع المبسط.
  - `../js/market-init.js`: تهيئة الصفحة وربط الأحداث.
  - `../js/market-search-autocomplete.js`: اقتراحات البحث (تتطلب مسار API للاقتراح).
- أنماط: `css/marketplace.css` + `ui-system/tokens.css` + `ui-system/components.css`.

تدفق الواجهة:
1. عند التحميل يستدعي `market-common` اكتشاف قاعدة API (مثلاً `/api`).
2. `market-init` بانتظار الجاهزية ثم ينادي `Market.Products.init()` ويحدّث شارة السلة.
3. `market-products` يجلب `/market/products` ويملأ الشبكة.
4. عند الضغط "أضف" يستدعي `/market/cart` (POST).

## 4) الخادم المبسط (server.js)
- نهايات متاحة:
  - `GET /api/market/products` و `POST /api/market/products` عبر `src/controllers/productsController.js`.
  - `GET /api/market/metrics` عبر `src/controllers/metricsController.js`.
  - مسارات توافقية قديمة: `/items/data`, `/products`.
- قاعدة البيانات:
  - `src/db/connect.js` يدير اتصال Mongo إن توفّر `MARKET_MONGO_URL`، وإلا يعمل نمط الذاكرة.
  - نموذج `src/models/Product.js`.
- كاش بسيط لقوائم المنتجات: `src/cache/lruCache.js`.

متغيرات البيئة المهمة:
- `MARKET_PORT`، `MARKET_MONGO_URL`، `MARKET_ALLOW_DB_FAIL=1`، `MARKET_SEED_DEMO=1`،
  `MARKET_CACHE_LIMIT`، `MARKET_CACHE_TTL_MS`.

## 5) الخادم الموسع (market-server.js)
- يشمل منظومة متقدمة مبنية على وحدات ضمن `services/market/*`:
  - `productService`, `cartService`, `orderService`, `quoteService`, `vendorService`،
    `messageService`, `handleService` (أسماء مستخدمين عامة) ،
    `mediaStorage`/`mediaUrlSigner`, `rankAutoTune`, `interactionsTracker`, `popularityTracker`،
    `cache` متعدد الأنواع.
  - Repos: `repo/productRepo.js`, `productRepo.memory.js`, `cartRepo.js`, `quoteRepo.js`.
  - البحث/المرادفات: `services/market/search/*`.
- يضيف RBAC، ضبط CORS/Helmet، تسجيل منظّم، قياسات، حدود معدل.
- يقترح مسارات: `/api/market/cart`, `/api/market/orders`, `/api/market/seller/*`, `/api/market/messages/*`, `/api/market/handles/*`, `/api/market/rank/*`…
- يعتمد بيئة أوسع وقد يتطلب Mongo و/أو تخزين وسائط.

## 6) التعدد القطري (Tenancy)
- `config/tenants.json` يحدد البلدان (SA, AE) والعملات والفئات.
- `src/utils/country.js` و `services` يستخدمانه لاشتقاق `countryCode` والعملة،
  مع دعم استنتاج الدولة من النطاق أو الاستعلام.

## 7) المصادقة (auth/)
- خدمة مستقلة تجريبية: نماذج وميدلوير ونقاط دخول وتطبيق بسيط للواجهة (login.html).
- يمكن ربطها عبر `dev-auth-loader.js` لحقن توكن تجريبي أثناء التطوير.

## 8) تشغيل محلي سريع
```powershell
cd systems/marketplace
npm install
$env:MARKET_ALLOW_DB_FAIL='1'; $env:MARKET_SEED_DEMO='1'; $env:MARKET_PORT='3002'; node server.js
```
افتح صفحة الواجهة من `pages/marketplace-index.html` (مثلاً عبر Live Server)؛ 
السكربت `market-common` سيكتشف `/api/market/ping` تلقائياً.

---

# التصميم المقترح (Strong Architecture)

## A) تقسيم طبقات واضح
- Client (Static):
  - `pages/` + `css/` + `js/` + `ui-system/`.
  - لا أي استخدام لـ require/mongoose هنا.
- API Service (Core):
  - استخدام `market-server.js` كأساس، مع نقل ما يلزم من الخدمات ضمن `services/market/*` وتهيئة اتصال DB/وسائط.
- Auth Service:
  - إبقاؤها مستقلة، التحقق عبر JWT والتفويض `requireRole`.
- Media Service (اختياري):
  - تخزين الصور/المصغرات في S3/MinIO، توقيع روابط عرض عند الحاجة.

## B) REST API موحّد تحت `/api/market`
- Products:
  - `GET /products`: q, category, priceMin/Max, sort, page/limit, expand.
  - `POST /products`: ingest موحّد مع توليد SKU.
- Search/Suggest:
  - `GET /search/suggest?q=...` يعتمد على مرادفات `services/market/search/synonyms.*` وترتيب شعبي.
- Cart:
  - `GET/POST/DELETE /cart` مع userId من التوكن، idempotency-key للدفع.
- Orders:
  - `POST /orders`, `GET /orders[?filters]`, `GET /orders/:id`.
- Seller:
  - `GET/POST /seller/products`, `.../variants`, `.../images` (رفع وسائط).
- Messaging/Handles:
  - `GET/POST /handles/*` و `messages/*` لأسماء مستخدمين عامة والمراسلات.
- Admin:
  - `GET /admin/metrics`, `POST /admin/reindex`, `POST /admin/rank/weights`.

مبادئ:
- حدود معدل على البحث والاقتراح.
- Caching: LRU داخلي + ETag/Last-Modified للصفحة الأولى.
- Trace/Request-Id في كل استجابة.

## C) نموذج البيانات (Mongo)
- Product:
  - name, description, category, price, currency, stock, sku(unique), vendorId, countryCode, media[], active, timestamps.
- Order:
  - userId, items[{sku, qty, price, currency}], total, status, paymentStatus, fulfillmentStatus.
- Cart (per user):
  - items[], updatedAt.
- Vendor & Members, Message Threads, Media (اختياري: collections منفصلة).

## D) الترتيب الذكي (Ranking)
- سجل تفاعل (views, clicks, dwellMs, hasMedia) عبر `interactionsTracker`.
- خوارزمية وزن قابلة للضبط أسبوعياً `rankAutoTune` مع إمكانية تثبيت يدوي.
- حفظ snapshot و`/rank/audit` للمراجعة.

## E) الأمن والحوكمة
- JWT + أدوار: buyer, seller_owner, staff, super_admin.
- Helmet + CORS بقائمة سماح بيئات التطوير والإنتاج.
- Rate-limit على `/products`, `/search/suggest`, `/messages/*`.
- تدقيق إدخال express-validator على POST/PATCH.

## F) المراقبة والقياس
- لوغات بنيوية JSON مع حقول: ts, requestId, traceId, event, durationMs, status…
- `/metrics` يعيد counters + lru + uptime.

## G) النشر
- Container لكل خدمة (market, auth).
- تهيئة عبر ENV فقط.
- Reverse proxy يوجه `/api/market`، و CDN للوسائط.

## H) خارطة طريق عملية
1. إكمال مسارات مبسطة في `server.js`: `/market/auth/me`, `/market/cart`, `/market/orders`, `/market/search/suggest`.
2. تشغيل الواجهة واختبار التدفق الكامل محلياً (ذاكرة فقط).
3. ترحيل تدريجي إلى `market-server.js` بتمكين الخدمات من `services/market/*`.
4. تمكين Mongo وتفعيل التخزين والوسائط.
5. إضافة حدود معدل، لواصق ETag، وقياسات.
6. إطلاق إصدار أول MVP، ثم إضافة الرسائل والبائعين ورفع الوسائط.
