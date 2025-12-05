# 🚀 دليل التثبيت السريع - Quick Setup Guide

## الخطوة 1️⃣: تثبيت الاعتماديات

افتح Terminal في مجلد المشروع وشغّل:

```bash
npm install
```

هذا سيثبت:
- ✅ Express (خادم الويب)
- ✅ PayPal SDK
- ✅ Stripe SDK
- ✅ CORS & Body Parser
- ✅ dotenv (إدارة المتغيرات البيئية)

---

## الخطوة 2️⃣: إعداد ملف .env

انسخ الملف `.env.example` واسمه `.env`:

```bash
copy .env.example .env
```

افتح `.env` وعدّل القيم:

### للتجربة (Sandbox/Test Mode):

```env
# PayPal Sandbox
PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_SECRET
PAYPAL_MODE=sandbox

# Stripe Test
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY

BASE_URL=http://localhost:8080
PORT=3000
NODE_ENV=development
```

### للإنتاج (Production):

```env
# PayPal Live
PAYPAL_CLIENT_ID=YOUR_LIVE_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_LIVE_SECRET
PAYPAL_MODE=production

# Stripe Live
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY

BASE_URL=https://your-domain.com
PORT=3000
NODE_ENV=production
```

---

## الخطوة 3️⃣: تحديث payment-config.js

افتح `payment-config.js` وعدّل:

```javascript
const PAYPAL_CONFIG = {
    clientId: 'YOUR_PAYPAL_CLIENT_ID_HERE', // من .env
    currency: 'USD',
    environment: 'sandbox' // أو 'production'
};

const STRIPE_CONFIG = {
    publishableKey: 'pk_test_YOUR_KEY', // من .env
    currency: 'usd',
    locale: 'ar'
};
```

---

## الخطوة 4️⃣: تحديث payment.html

افتح `payment.html` واستبدل في السطر 8:

```html
<!-- قبل -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=USD"></script>

<!-- بعد -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_ACTUAL_PAYPAL_CLIENT_ID&currency=USD"></script>
```

---

## الخطوة 5️⃣: تشغيل الخادم

### تشغيل خادم الدفع:
```bash
node payment-server.js
```

يجب أن ترى:
```
🚀 Payment Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server running on: http://localhost:3000
🔵 PayPal: ✅ Configured
🟣 Stripe: ✅ Configured
🌍 Environment: development
```

### تشغيل خادم Portfolio (في نافذة أخرى):
```bash
node server.js
```

---

## الخطوة 6️⃣: الاختبار

1. افتح: `http://localhost:8080`
2. اذهب لقسم "تواصل معي"
3. املأ النموذج واختر نوع الخدمة
4. اضغط "متابعة للدفع"
5. اختر PayPal أو Stripe
6. اختبر الدفع

### بطاقات اختبار Stripe:

| النوع | الرقم | النتيجة |
|------|-------|---------|
| نجاح | 4242 4242 4242 4242 | ✅ ناجح |
| رفض | 4000 0000 0000 0002 | ❌ مرفوض |
| 3D Secure | 4000 0025 0000 3155 | 🔒 يطلب تأكيد |

التاريخ: أي تاريخ مستقبلي  
CVC: أي 3 أرقام

---

## 🔧 استكشاف الأخطاء

### المشكلة: "PayPal SDK not loaded"
**الحل**: تحقق من Client ID في `payment.html` السطر 8

### المشكلة: "Stripe not defined"
**الحل**: تحقق من Publishable Key في `payment-config.js`

### المشكلة: "Cannot connect to server"
**الحل**: تأكد من تشغيل `payment-server.js` على منفذ 3000

### المشكلة: "CORS Error"
**الحل**: تأكد من إضافة CORS في `payment-server.js` (موجود بالفعل)

---

## 📚 موارد مفيدة

- 📘 [دليل الإعداد الكامل](PAYMENT_SETUP_GUIDE.md)
- 🔵 [PayPal Developer](https://developer.paypal.com)
- 🟣 [Stripe Dashboard](https://dashboard.stripe.com)
- 📧 [EmailJS Setup](https://www.emailjs.com)

---

## ✅ قائمة التحقق

- [ ] تثبيت npm packages
- [ ] إنشاء ملف .env
- [ ] إعداد PayPal Client ID
- [ ] إعداد Stripe Keys
- [ ] تحديث payment-config.js
- [ ] تحديث payment.html
- [ ] تشغيل payment-server.js
- [ ] تشغيل server.js
- [ ] اختبار الدفع

---

**🎉 مبروك! نظام الدفع جاهز للعمل**

للانتقال للإنتاج، راجع [PAYMENT_SETUP_GUIDE.md](PAYMENT_SETUP_GUIDE.md)
