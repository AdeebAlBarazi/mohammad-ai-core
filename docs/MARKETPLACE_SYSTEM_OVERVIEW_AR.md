# نظرة عامة على نظام السوق (Marketplace System Overview)

تهدف هذه الوثيقة إلى تقديم صورة واضحة ومختصرة عن مكوّنات نظام السوق داخل المسار `systems/marketplace/`، وكيف تتكامل الوحدات معًا، وأهم متغيرات البيئة، وخطوات تشغيل سريعة محليًا.

## 1) نظرة سريعة
- خادم سوق Express يقدّم صفحات الواجهة `pages/` ويعرّض REST/JSON لمنتجات، سلة، طلبات، وبحث.
- خدمة مصادقة مستقلة `auth/` لإدارة تسجيل الدخول وJWT/الأدوار.
- مساعد ذكاء اصطناعي عام مدمج مع خادم السوق (يدعم SSE)، ومساعد شخصي معزول يعمل على منفذ مستقل.
- خدمات أعمال (Products/Orders/Search/Payments/Media) تحت `services/market/`.
- مراقبة واختبارات وبنية تحتية عبر Docker Compose وPrometheus/Grafana/Alertmanager.

## 2) هيكل المجلدات الأساسية
- خادم وتطبيق:
  - `server.js` — خادم السوق الأساسي (Express). يعمل بذاكرة أو Mongo.
  - `market-server.js` — نسخة موسعة بميزات متقدمة (بائع/وسائط/رسائل/ترتيب).
  - `src/` — تنظيم خادمي (controllers/models/db/utils/cache) للتوسعة التدريجية.
- الواجهة (Front-End):
  - `pages/` — صفحات HTML (سوق، بائع، إدارة، Checkout، ذكاء اصطناعي).
  - `css/`, `js/`, `ui-system/`, `vendor/` — أنماط وأصول وسكربتات المتصفح.
- المصادقة (Auth):
  - `auth/` — خدمة مستقلة (Express) مع `public/login.html`, middlewares, routes, models.
- المساعدات الذكية (AI Agents):
  - `agent-core/` — نواة المساعد العام (Portable) المدمج مع خادم السوق.
  - `agent-personal/` — نواة المساعد الشخصي المعزول (جلسات JSONL وتشفير اختياري).
  - `server-personal.js` — خادم المساعد الشخصي (منفذ افتراضي 5600).
- الخدمات الخلفية (Domain Services):
  - `services/market/` — منتجات، سلة، طلبات، بحث (مرادفات/Facets/كاش/Fallback/Fuzzy)، مدفوعات (Stub/Stripe)، وسائط.
  - `models/marketplace/` — مخططات Mongo (Product/Order/Cart/Vendor/…)
- بنية تحتية ومراقبة:
  - `docker-compose*.yml`, `Dockerfile`, `infra/`, `ecosystem.config.js`, `logs/`.
- وثائق وأتمتة:
  - `docs/`, `ARCHITECTURE.md`, `README*.md`, `scripts/`, `tests/`, `__tests__/`.

## 3) تكامل المكوّنات
- خادم السوق يقدّم صفحات `pages/` ويعرّض واجهات:
  - منتجات وسلة وطلبات عبر `services/market/*`.
  - بحث متقدم مع Facets وكاش للصفحة الأولى (وFuzzy اختياريًا).
  - مدفوعات: Stub للتطوير أو مزود فعلي (Stripe) مع Webhook ودفتر سجل أحداث.
- المصادقة عبر خدمة `auth/` أو مفاتيح عامة/JWKS، مع تحكم بالأدوار.
- المساعد العام مدمج عبر `server.js` (SSE بتهيئة رؤوس ملائمة). المساعد الشخصي معزول على منفذ مستقل وذاكرة جلسات مشفرة اختياريًا.
- المراقبة عبر `/metrics` والحزمة الكاملة لـ Prometheus/Grafana/Alertmanager.

## 4) متغيرات بيئية أساسية
- السوق:
  - `MARKET_PORT`, `MARKET_MONGO_URL`, `MARKET_ALLOW_DB_FAIL`, `MARKET_SEED_DEMO`, `METRICS_ENABLED`.
  - البحث: `MARKET_ENABLE_FUZZY`, `MARKET_FUZZY_*`; كاش البحث: `MARKET_SEARCH_CACHE_*`; كاش الصفحة الأولى: `MARKET_CACHE_*`.
  - المدفوعات: `MARKET_ENABLE_PAYMENT_STUB` أو مزود فعلي عبر `PAYMENT_PROVIDER="stripe"`, و`STRIPE_*`, ودفتر السجل عبر `LEDGER_ENABLED=1`.
- المصادقة:
  - `MARKET_REQUIRE_JWT`, `AUTH_JWKS_URL`, `JWT_PUBLIC_KEY`, `JWT_SECRET` (للتطوير فقط في HS256).
- المساعد الشخصي:
  - `PERSONAL_PORT` (افتراضي 5600), `PERSONAL_API_KEY` (اختياري)، `PERSONAL_MEM_KEY` (AES-256-GCM)، `AI_MODEL`, `OPENAI_API_KEY` (اختياري).

## 5) تشغيل سريع (محلي)
- خادم السوق (ذاكرة فقط):
```powershell
$env:MARKET_ALLOW_DB_FAIL='1'
$env:MARKET_SEED_DEMO='1'
$env:MARKET_PORT='3002'
node server.js
```
- خادم المساعد الشخصي (مع API Key وتشفير اختياري):
```powershell
$env:PERSONAL_PORT='5600'
$env:PERSONAL_API_KEY='dev-key-123'    # اختياري
$env:PERSONAL_MEM_KEY='0123456789abcdef0123456789abcdef'  # 32 بايت
node server-personal.js
```
- واجهات الدردشة:
  - عام: `http://localhost:3002/pages/ai-chat.html`
  - شخصي: `http://localhost:5600/pages/personal-chat.html`

## 6) نقاط API المهمة (مختصر)
- منتجات/سلة/طلبات السوق: عبر `server.js` تحت `/api/market/*`.
- البحث: `GET /api/market/search` مع دعم `q, page, limit, sort, include, mode=facets` وكاش.
- مدفوعات:
  - Stub: `POST /api/market/payments/intents`, `POST /api/market/payments/:id/confirm`.
  - Stripe: `POST /api/market/payments/intents`, `POST /api/market/payments/webhook` (جسم خام للتحقق من توقيع الحدث).
- المساعد الشخصي:
  - `POST /api/personal/chat` — رد غير متدفق (`{ ok, reply }`).
  - `POST /api/personal/chat/stream` — SSE (ترويسات: `text/event-stream`, `no-transform`, `X-Accel-Buffering: no`).
  - `GET /healthz` — فحص صحة.

## 7) المراقبة والبنية التحتية
- تشغيل أساسي:
```powershell
docker compose build
docker compose up -d
```
- الحزمة الكاملة مع المراقبة:
```powershell
docker compose -f docker-compose.full.yml build
docker compose -f docker-compose.full.yml up -d
```
- نقاط الوصول الشائعة:
  - التطبيق: `http://localhost:3002`
  - Prometheus: `http://localhost:9090`
  - Grafana: `http://localhost:3000`

## 8) روابط ذات صلة
- الدليل العام: [`README.md`](../README.md)
- دليل المعمارية (عربي): [`docs/AI_ARCHITECTURE_GUIDE.md`](./AI_ARCHITECTURE_GUIDE.md)
- دليل المساعد المحمول (EN/AR): `AI_ARCHITECTURE_GUIDE_EN.md`, `AI_ARCHITECTURE_GUIDE_BI.md`
- الخصوصية والاحتفاظ: [`PRIVACY_RETENTION_POLICY.md`](./PRIVACY_RETENTION_POLICY.md)
- مراقبة Prometheus/Grafana: [`MONITORING_PROMETHEUS_GRAFANA.md`](./MONITORING_PROMETHEUS_GRAFANA.md)