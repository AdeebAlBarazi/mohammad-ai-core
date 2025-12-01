سؤال ممتاز جدًا، وإليك شرحًا **احترافيًا وواضحًا**:

---

# ⭐ ما هي **Prometheus** ؟

**Prometheus** هي أداة **جمع مقاييس (Metrics Collector)** مصممة لمراقبة الأنظمة والخدمات.

## ✔ ماذا تفعل Prometheus؟

- تجمع بيانات عن أداء النظام (عدد الطلبات، وقت الاستجابة، استهلاك الذاكرة…)
- تخزن هذه البيانات في قاعدة بيانات Time-Series
- توفر لغة خاصة للاستعلام PromQL
- تُستخدم كأساس لأي نظام مراقبة حديث

## ✔ من أين تجمع البيانات؟

من “Exporters”، أمثلة:

- Node Exporter (معلومات سيرفر لينكس)
- Mongo Exporter (معلومات قاعدة البيانات)
- Docker/Kubernetes Exporters
- Metrics من تطبيقك نفسُه عبر endpoint مثل:

```
/metrics
```

## ✔ أمثلة لمقاييس Prometheus:

- `http_requests_total`
- `http_request_duration_seconds`
- `memory_usage_bytes`
- `cpu_load_average`

## ✔ لماذا نستخدمها؟

لأنها:

- خفيفة
- قوية
- معيار صناعي (Industry Standard)
- تعمل ممتاز مع Grafana

---

# ⭐ ما هي **Grafana** ؟

**Grafana** هي أداة **لوحات مراقبة (Dashboards)** تُستخدم لعرض البيانات القادمة من Prometheus بشكل رسوم بيانية جذابة.

## ✔ ماذا تفعل Grafana؟

- تعرض بيانات الأداء في لوحات Dashboard تفاعلية
- تدعم تنبيهات Alerts عند ارتفاع الأخطاء أو زمن الاستجابة
- تربط نفسها بمصادر البيانات مثل:
  - Prometheus
  - MySQL
  - PostgreSQL
  - Elasticsearch
  - InfluxDB
  - Loki
  - CloudWatch

## ✔ ما الذي يعرضه Grafana عادة؟

لوحات تُظهر:

- معدل الطلبات في الثانية RPS
- أحجام الذاكرة والـ CPU
- معدلات الأخطاء
- الـ Latency (p95/p99)
- ترتيب الخدمات
- سلوك المستخدمين
- أداء قواعد البيانات

## ✔ لماذا نستخدمها؟

لأنها:

- تقدم رؤية كاملة (Observability) للتطبيق
- تُظهر المشاكل قبل وقوعها
- تعطي تنبيهات عند النقاط الخطيرة
- قوية جدًا وتستخدمها شركات مثل:
  Uber – Airbnb – Shopify – Datadog – Cloudflare

---

# 🧩 كيف يعمل Prometheus + Grafana معًا؟

1. **Prometheus** يقوم بجمع المقاييس
2. **Grafana** يتصل بـ Prometheus
3. Grafana يقوم بعرض هذه المقاييس بشكل رسوم بيانية (Dashboards)

مثلًا:

- Prometheus يجمع:

```
http_request_duration_seconds
```

- Grafana يعرض لك Dashboard فيها:
  - متوسط زمن الاستجابة
  - p95
  - p99
  - الأخطاء 4xx و 5xx
  - عدد الطلبات في الثانية

---

# 🔥 لماذا تحتاجها في مشروعك Marketplace؟

لأنها جزء أساسي من **الجاهزية للإنتاج (Production Readiness)**:

## ⭐ تعطيك:

- هل API يعمل تحت ضغط عالي؟
- هل فيه تسريب ذاكرة؟
- هل وقت الاستجابة طبيعي؟
- هل الأخطاء ترتفع في ساعات معينة؟
- هل MongoDB فيها اختناقات؟
- هل السيرفر يتعرض لهجوم؟
- هل أحد الـ services متوقف؟

## ⭐ ومع Grafana Alerts:

يمكنك الحصول على تنبيه على:

- Slack
- Telegram
- SMS
- Email

عند:

- ارتفاع الأخطاء
- توقف خدمة
- امتلاء الذاكرة
- تجاوز p95 لحد معين

---

# 🎯 خلاصة سريعة:

| الأداة         | وظيفتها                                           |
| -------------- | ------------------------------------------------- |
| **Prometheus** | يجمع ويخزن المقاييس (Metrics)                     |
| **Grafana**    | يعرض المقاييس في لوحات Dashboard جميلة مع تنبيهات |

وهما يشكلان معًا العمود الفقري لأي نظام مراقبة احترافي.

---

# 📌 إذا أحببت:

أستطيع الآن تجهيز:

- Docker Compose جاهز يشغل **Prometheus + Grafana + Node Exporter + Mongo Exporter** لتوصيلها مباشرة بباك إند المشروع
- أو أعمل لك Dashboard جاهدة لمراقبة `/api/v1/market/*`

هل تريد ذلك؟

---

# 🎯 أولاً — ماذا سنراقب بعد الإطلاق؟

## 1) مراقبة الـ API

- عدد الطلبات لكل مسار مثل `/api/v1/market/products`
- زمن الاستجابة p95, p99
- عدد الأخطاء 5xx و 4xx
- معدل الطلبات في الثانية RPS

## 2) مراقبة السيرفر (Node.js)

- استهلاك الذاكرة
- استهلاك CPU
- عدد الاتصالات Connections
- تأخر حلقة الأحداث Event loop lag

## 3) مراقبة MongoDB

- زمن الاستعلامات
- عدد عمليات القراءة والكتابة
- استخدام الفهارس
- حجم الذاكرة
- Latency

## 4) مراقبة التخزين (S3/MinIO)

- عدد الرفع/التحميل
- أخطاء الرفع
- حجم الوسائط

## 5) مراقبة كل خدمات الـ VPS

- RAM / CPU / Disk / Network

---

# 🎯 ثانيًا — كيف ندمج Prometheus مع نظامنا؟

نحتاج 3 خطوات فقط:

## الخطوة 1 — تفعيل `/metrics` داخل الـ API

تم تفعيل ذلك في `server.js` بالفعل باستخدام `prom-client`:

```js
const prom = require('prom-client');
const register = new prom.Registry();
prom.collectDefaultMetrics({ register, prefix: 'market_' });

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## الخطوة 2 — إضافة مقاييس مخصصة (Custom Metrics)

أضفنا عدّادات مخصصة في `server.js`:

```js
// عدد طلبات المنتجات
const productRequests = new prom.Counter({
  name: 'market_products_requests_total',
  help: 'Total product list requests',
  registers: [register]
});

// أخطاء أوامر الشراء
const orderErrors = new prom.Counter({
  name: 'market_order_errors_total',
  help: 'Total errors in orders API',
  registers: [register]
});

// نبضة صحية (Heartbeat) تُزاد عند استدعاء /healthz
const heartbeatCounter = new prom.Counter({
  name: 'market_heartbeat_total',
  help: 'Heartbeat increments on /healthz checks',
  registers: [register]
});

// قياس زمن الاستجابة مع buckets مناسبة
const durationHist = new prom.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method','route','status'],
  registers: [register],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 3, 5]
});
```

ويتم استدعاؤها داخل المسارات:

```js
// داخل getProductsHandler
productRequests.inc();

// داخل catch لمسارات الطلبات
orderErrors.inc();

// داخل /healthz
heartbeatCounter.inc();
```

## الخطوة 3 — جعل Prometheus يسحب المقاييس

تم إعداد الملف `infra/monitoring/prometheus/prometheus.yml` لالتقاط:

```yaml
scrape_configs:
  - job_name: 'market'
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:3002']

  - job_name: 'auth'
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:4100']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongodb-exporter:9216']
```

---

# 🎯 ثالثًا — لوحات Grafana (Dashboards)

بعد تشغيل Grafana:

1) افتح: `http://localhost:3000`
2) أضف Prometheus كمصدر بيانات: URL `http://prometheus:9090`
3) استورد Dashboard جاهزة:
   - Node.js Dashboard
   - MongoDB Dashboard
   - API Performance Dashboard
4) ستشاهد: p95/p99، RPS، أخطاء 5xx، CPU/RAM، أداء الاستعلامات.

---

# 🎯 رابعًا — خط سير كامل للتكامل

1) Docker Compose يشغل الخدمات:
   - market-api (خارج هذا الملف)
   - mongo
   - prometheus
   - grafana
   - node-exporter
   - mongodb-exporter

2) Prometheus يتصل بـ:
   - `/metrics` للـ API
   - MongoDB Exporter
   - Node Exporter

3) Grafana تعرض Dashboards متقدمة:
   - “حالة البائعين”
   - “تدفق الطلبات”
   - “أداء المنتجات”
   - “مشاكل الـ API”

4) تنبيهات Alerts في الوقت الحقيقي (Slack/Telegram/Email/SMS/Webhook)

أمثلة القواعد موجودة في:

- `infra/monitoring/prometheus/rules-market.yml`

مثال (p95 مرتفع):

```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="market"}[5m])) by (le, route)) > 1.5
```

---

# 🎯 خامسًا — معنى ذلك أثناء الإطلاق

- كشف الأعطال مبكرًا قبل المستخدم
- مراقبة فورية لكل شيء
- تحليل الأداء ومعرفة الاختناقات
- رؤية شاملة لحالة النظام

---

# 🚀 تشغيل الـ Stack محليًا (Docker Compose)

تم تجهيز ملف جاهز:

- `infra/monitoring/docker-compose.yml`

ويحتوي على: Prometheus + Grafana + Node Exporter + MongoDB Exporter.

تشغيل سريع على Windows PowerShell:

```powershell
Push-Location "d:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\infra\monitoring"
docker compose up -d
Pop-Location
```

ثم:

- افتح Prometheus: `http://localhost:9090`
- افتح Grafana: `http://localhost:3000` (user/pass: admin/admin)

ملاحظة: على Windows، Node Exporter داخل Docker يعطي مؤشرات VM الخاصة بـ Docker Desktop، وللسيرفرات الفعلية (VPS Linux) يُنصح تثبيته على النظام مباشرة.

---

# ✅ ماذا غيّرنا في الكود/الملفات؟

- أضفنا عدّادات مخصصة في `server.js`:
  - `market_products_requests_total`
  - `market_order_errors_total`
  - `market_heartbeat_total` (يزداد عند `/healthz`)
- حدّثنا `infra/monitoring/docker-compose.yml` لإضافة Node و MongoDB Exporters.
- حدّثنا `infra/monitoring/prometheus/prometheus.yml` لإضافة Scrape Jobs جديدة.
- مواءمة قواعد التنبيه في `rules-market.yml` مع أسماء المقاييس الحالية.
- أضفنا خدمة Alertmanager + ربطها في `docker-compose.yml` وكتابة إعدادات في `infra/monitoring/alertmanager/alertmanager.yml`.
- أضفنا لوحة تنبيه "Active Firing Alerts" في `dashboard-market.json`.
- أضفنا قواعد SLO في `rules-slo.yml` (تسجيل p95/p99، معدل الأخطاء، RPS، burn rate) وربطناها في `prometheus.yml`.
- أضفنا Panels جديدة في Grafana لعرض مؤشرات SLO (Error Rate %, p95/p99، Burn Rate، RPS).
- أضفنا Panel "Heartbeat (Rate)" لعرض `rate(market_heartbeat_total[5m])`.
- قمنا بتهيئة `alertmanager.yml` لاستخدام متغيرات بيئة `${SLACK_WEBHOOK_URL}`, `${TELEGRAM_BOT_TOKEN}`, `${TELEGRAM_CHAT_ID}` مع توضيح الحاجة لمعالجة تهيئة قبل التشغيل.
# 🧮 منهجية SLO (مثال تطبيقي)
هدف التوافر (Availability SLO): 99% خلال 30 يوم → ميزانية أخطاء (Error Budget) = 1% من إجمالي الطلبات.

المؤشرات:
- معدل الأخطاء = (5xx / total requests) خلال نافذة زمنية.
- p95 latency هدف ≤ 800ms، p99 هدف ≤ 1500ms.
- Burn Rate = (error rate / error_budget_rate). إذا ارتفع >14 (قصير + طويل) ⇒ استهلاك سريع للميزانية.

القواعد:
```promql
market:http_error_rate_ratio            # نسبة الأخطاء الخام
market:http_request_duration_p95        # p95 مسجل
market:error_budget_burn_short          # نافذة قصيرة (5m)
market:error_budget_burn_long           # نافذة طويلة (1h)
```

التنبيه السريع (Rapid Burn): يحمي من استنزاف الميزانية مبكرًا، يُستخدم عتبة 14x حسب توصيات Google SRE لمعدل الحرق الحرج.

# 🔐 إدارة الأسرار
يفضل عدم وضع القيم مباشرة في `alertmanager.yml`:
1) استخدم Docker secrets أو ملف `.env.monitoring` غير مُرفوع على Git.
2) نفّذ سكربت Entrypoint يستبدل placeholders قبل تشغيل الحاوية (مثلاً باستخدام `envsubst`).
3) في الإنتاج، استخدم Vault أو SSM Parameter Store.

مثال `.env.monitoring`:
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
TELEGRAM_CHAT_ID=123456789
SMTP_HOST=smtp.example.com:587
SMTP_USER=noreply@example.com
SMTP_PASS=CHANGE_ME
```

# 🛠 تهيئة Alertmanager مع envsubst (اختياري)
```bash
#!/usr/bin/env bash
envsubst < /etc/alertmanager/alertmanager.yml.template > /etc/alertmanager/alertmanager.yml
exec /bin/alertmanager --config.file=/etc/alertmanager/alertmanager.yml
```

# 📊 تحديثات لوحة SLO
اللوحات المضافة:
- SLO Error Rate (%)
- SLO p95 / p99 Latency
- Error Budget Burn (short vs long)
- Requests Per Second (RPS)

# 🧪 اختبار قواعد SLO
نفّذ استعلام:
```promql
market:http_request_duration_p95
market:http_error_rate_ratio * 100
market:error_budget_burn_short
```
تأكد أنها تُرجع قيم، ثم راقب لوحة Grafana.

---

# 🔔 إعداد التنبيهات (Alertmanager)
(ملاحظة) تمت إزالة قاعدة الاختبار `TestAlwaysFiring` بعد التحقق من مسار التنبيهات. إذا رغبت بإعادة تنبيه تجريبي مؤقت:
أضف ملف `rules-test.yml` ثم أضفه إلى `prometheus.yml` مؤقتًا.
## نموذج المسارات (Routes)
يتم توجيه:
- حدّثنا القيم الوهمية لتكون واضحة: `CHANGE/THIS/WEBHOOK` و `CHANGE_TELEGRAM_BOT_TOKEN`.
- بعد إضافة القيم الحقيقية أعد تشغيل Alertmanager:
```powershell
Push-Location "d:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\infra\monitoring"
docker compose restart alertmanager
Pop-Location
```
- `severity=critical` → Slack
- `severity=warning` → Telegram
- `severity=info` → Email

## تعديل القيم الحساسة
استبدل القيم المؤقتة:
```
https://hooks.slack.com/services/REPLACE/ME/WEBHOOK
REPLACE_TELEGRAM_BOT_TOKEN
ops@example.com / smtp.example.com
```

## تشغيل Alertmanager مع بقية الخدمات
```powershell
Push-Location "d:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\infra\monitoring"
docker compose up -d alertmanager prometheus grafana
Pop-Location
```

## اختبار تنبيه يدوي (PromQL)
في Prometheus نفّذ:
```
vector(1)
```
ثم أنشئ قاعدة مؤقتة في واجهة Prometheus (أو أضف قاعدة اختبار إلى ملف rules) لملاحظة ظهور Alert.

تم بالفعل إضافة قاعدة اختبار دائمة في الملف `rules-test.yml`:
```
- alert: TestAlwaysFiring
  expr: vector(1)
  for: 30s
```
عند التأكد من وصول التنبيه إلى القنوات قم بحذف الملف أو تعليق القاعدة.

## عرض التنبيهات في Grafana
تمت إضافة Panel "Active Firing Alerts" يستعلم:
```
ALERTS{alertstate="firing"}
```

---

# 📣 قنوات مقترحة لاحقاً
- Slack: تنبيهات حرجة وفشل الخدمة.
- Telegram: تحذيرات الأداء (p95 مرتفع، زيادة أخطاء 4xx).
- Email: ملخصات يومية أو تنبيهات ذات أولوية منخفضة.

## نسخة Staging من Alertmanager
ملف مبسط: `infra/monitoring/alertmanager/alertmanager-staging.yml` يرسل فقط التنبيهات الحرجة إلى قناة Slack مخصصة.
تشغيله (استبدل المسار في الـ volume):
```powershell
Push-Location "d:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\infra\monitoring"
docker compose stop alertmanager
docker compose run -d --name marketplace-alertmanager -p 9093:9093 -v $(pwd)\alertmanager\alertmanager-staging.yml:/etc/alertmanager/alertmanager.yml prom/alertmanager:latest
Pop-Location
```
أو عدّل الـ compose مؤقتاً ليستخدم ملف staging.

---

# 🛡️ تحسينات مستقبلية للتنبيه
- إضافة `PagerDuty` أو `Opsgenie` عند الحاجة للـ On-Call.
- استخدام `silences` في Alertmanager خلال الصيانة.
- إضافة `inhibit_rules` إضافية لتخفيف الضجيج عند وجود Critical يغطي Warning.


كل ذلك يجعل Prometheus + Grafana يعملان فورًا لمراقبة الإطلاق وما بعده.

---

# 📦 إرشادات بيئة Staging (Datasource + Alerts)

لبيئة Staging نُبسط الإعدادات لتجنب الضوضاء:

- مصدر بيانات Grafana:
  - إذا كانت Grafana داخل الـ Compose: استخدم `http://prometheus:9090`.
  - إذا كانت Grafana خارج الـ Compose (على المضيف): استخدم `http://localhost:9090`.
  - على خادم خارجي: استخدم عنوان Prometheus الفعلي مثل `http://staging-prometheus.internal:9090`.

- توجيه التنبيهات (Alertmanager):
  - استخدم ملف `alertmanager-staging.yml` لتوجيه فقط `severity="critical"` إلى قناة Slack مخصصة لـ Staging.
  - عطل أو خفّض تحذيرات `warning` و`info` في Staging لتقليل الضوضاء.
  - عدّل متغيرات البيئة أو القنوات إلى وجهات اختبارية (Slack/Telegram) في Staging.

- تشغيل Staging سريعًا:
```powershell
Push-Location "d:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\infra\monitoring"
docker compose stop alertmanager
docker compose run -d --name marketplace-alertmanager -p 9093:9093 -v $(pwd)\alertmanager\alertmanager-staging.yml:/etc/alertmanager/alertmanager.yml prom/alertmanager:latest
Pop-Location
```

- ملاحظة: أعِد ربط Grafana بمصدر البيانات الصحيح لبيئة Staging عبر صفحة `Connections -> Data sources` إن كانت تعمل خارج الـ Compose.

---

# 🧪 اختبار نبضات الصحة (Heartbeat)

تحقق بسرعة محليًا:

1) زِد النبض عبر استدعاء `/healthz` عدة مرات:
```powershell
1..5 | ForEach-Object { Invoke-WebRequest -UseBasicParsing http://localhost:3002/healthz | Out-Null }
```
2) استعلم من Prometheus للتأكد:
```promql
increase(market_heartbeat_total[5m])
```
3) في Grafana، راقب Panel "Heartbeat (Rate)" وتأكد أنه يتحرك بعد الاستدعاءات.
