# دليل إعداد بوابات الدفع - PayPal & Stripe

## 📋 نظرة عامة

هذا الدليل يشرح كيفية إعداد بوابتي الدفع:
- **PayPal**: للدفع عبر PayPal وبطاقات الائتمان
- **Stripe**: للدفع عبر البطاقات الائتمانية والمدى

---

## 🔵 إعداد PayPal

### الخطوة 1: إنشاء حساب PayPal Business

1. انتقل إلى: https://www.paypal.com/sa/business
2. اضغط "Sign Up" واختر "Business Account"
3. أدخل معلومات عملك:
   - Business Name: Dr. Mohammad Consulting
   - Business Email: adeeb@myprofcv.com
   - Business Type: Consulting Services

### الخطوة 2: تفعيل PayPal REST API

1. سجل دخول إلى: https://developer.paypal.com
2. اذهب إلى "Dashboard" → "My Apps & Credentials"
3. في قسم "REST API apps"، اضغط "Create App"
4. سمّي التطبيق: "Portfolio Payment System"
5. احصل على:
   - **Client ID** (للإنتاج Production)
   - **Secret Key** (للإنتاج Production)

### الخطوة 3: تكوين PayPal في الموقع

افتح ملف `payment-config.js` وأضف:

```javascript
const PAYPAL_CONFIG = {
    clientId: 'YOUR_PAYPAL_CLIENT_ID_HERE', // من لوحة التحكم
    currency: 'USD',
    intent: 'CAPTURE',
    environment: 'production' // أو 'sandbox' للتجربة
};
```

### الخطوة 4: اختبار PayPal (Sandbox)

للاختبار قبل الإطلاق:
1. في Developer Dashboard، اذهب إلى "Sandbox" → "Accounts"
2. أنشئ حسابين تجريبيين:
   - Business Account (البائع)
   - Personal Account (المشتري)
3. استخدم Client ID من وضع Sandbox
4. غير environment إلى 'sandbox' في الكود

---

## 🟣 إعداد Stripe

### الخطوة 1: إنشاء حساب Stripe

1. انتقل إلى: https://stripe.com
2. اضغط "Sign up" وأكمل التسجيل
3. أدخل معلومات عملك:
   - Business Name: Dr. Mohammad Consulting
   - Country: Saudi Arabia (أو بلدك)
   - Business Type: Individual / Company

### الخطوة 2: الحصول على API Keys

1. سجل دخول إلى: https://dashboard.stripe.com
2. اذهب إلى "Developers" → "API keys"
3. احصل على:
   - **Publishable key** (للواجهة الأمامية)
   - **Secret key** (للخادم - لا تشاركه أبداً!)

### الخطوة 3: تفعيل Payment Methods

1. في Dashboard، اذهب إلى "Settings" → "Payment methods"
2. فعّل:
   - ✅ Card payments (Visa, Mastercard, Amex)
   - ✅ Apple Pay
   - ✅ Google Pay
   - ✅ mada (للسعودية)

### الخطوة 4: تكوين Stripe في الموقع

افتح ملف `payment-config.js` وأضف:

```javascript
const STRIPE_CONFIG = {
    publishableKey: 'pk_live_YOUR_PUBLISHABLE_KEY_HERE',
    currency: 'usd',
    locale: 'ar' // للعربية
};
```

### الخطوة 5: اختبار Stripe (Test Mode)

للاختبار قبل الإطلاق:
1. استخدم Test API keys بدلاً من Live keys
2. بطاقات اختبار:
   - Success: 4242 4242 4242 4242
   - Decline: 4000 0000 0000 0002
   - Expires: أي تاريخ مستقبلي
   - CVC: أي 3 أرقام

---

## 🔧 إعداد الخادم (Backend)

### متطلبات Node.js

قم بتثبيت الحزم المطلوبة:

```bash
npm install express cors dotenv
npm install @paypal/checkout-server-sdk
npm install stripe
```

### ملف .env للمفاتيح السرية

أنشئ ملف `.env` في مجلد المشروع:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_SECRET
PAYPAL_MODE=production

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY

# Application
PORT=3000
NODE_ENV=production
```

**⚠️ مهم جداً**: أضف `.env` إلى `.gitignore` لعدم رفعه لـ GitHub!

---

## 📧 إعداد إشعارات البريد الإلكتروني

### استخدام EmailJS (مجاني)

1. انتقل إلى: https://www.emailjs.com
2. أنشئ حساب مجاني
3. أنشئ Email Service:
   - اختر Gmail أو Outlook
   - وصّل حسابك البريدي
4. أنشئ Email Template:
   - Template للعميل: "Payment Confirmation"
   - Template للإدارة: "New Payment Received"
5. احصل على:
   - Service ID
   - Template ID
   - Public Key

أضف في `payment-config.js`:

```javascript
const EMAILJS_CONFIG = {
    serviceId: 'service_XXXXXXX',
    templateId: 'template_XXXXXXX',
    publicKey: 'YOUR_PUBLIC_KEY'
};
```

---

## 🚀 خطوات التشغيل

### 1. وضع الاختبار (Development)

```bash
# تشغيل الخادم
node payment-server.js

# اختبار PayPal Sandbox
# اختبار Stripe Test Mode
```

### 2. الانتقال للإنتاج (Production)

قائمة التحقق:
- [ ] استبدل PayPal Sandbox بـ Production credentials
- [ ] استبدل Stripe Test keys بـ Live keys
- [ ] تأكد من تفعيل HTTPS (SSL Certificate)
- [ ] راجع `.env` للتأكد من جميع المفاتيح
- [ ] اختبر جميع سيناريوهات الدفع
- [ ] فعّل إشعارات البريد الإلكتروني

---

## 🔒 الأمان

### أفضل الممارسات

1. **لا تشارك المفاتيح السرية أبداً**
   - لا ترفعها لـ GitHub
   - لا تضعها في الكود الأمامي (Frontend)

2. **استخدم HTTPS دائماً**
   - احصل على SSL Certificate مجاني من Let's Encrypt
   - أو استخدم Cloudflare

3. **تحقق من الدفع في الخادم**
   - لا تثق بالبيانات من المتصفح فقط
   - تحقق من حالة الدفع عبر PayPal/Stripe APIs

4. **سجّل جميع المعاملات**
   - احتفظ بسجل كامل في قاعدة البيانات
   - راقب المعاملات المشبوهة

---

## 📊 مراقبة المعاملات

### لوحة تحكم PayPal
- https://www.paypal.com/businessmanage/account/activity
- تابع المدفوعات، الاسترداد، النزاعات

### لوحة تحكم Stripe
- https://dashboard.stripe.com/payments
- تقارير تفصيلية، رسوم بيانية، تصدير CSV

---

## 💰 الرسوم والعمولات

### PayPal
- **السعودية**: 3.4% + $0.30 للمعاملة المحلية
- **دولي**: 4.4% + رسوم ثابتة

### Stripe
- **السعودية**: 2.9% + SAR 1 للمعاملة
- **دولي**: 3.4% + $0.30 للمعاملة

### حساب صافي الإيرادات

مثال على استشارة بـ $150:
- **PayPal**: $150 - ($150 × 3.4% + $0.30) = $144.60
- **Stripe**: $150 - ($150 × 2.9% + $0.30) = $145.35

---

## 🆘 الدعم الفني

### PayPal Support
- الهاتف: متوفر في لوحة التحكم
- البريد: https://www.paypal.com/smarthelp/contact-us
- المستندات: https://developer.paypal.com/docs

### Stripe Support
- الدردشة المباشرة: في Dashboard
- البريد: support@stripe.com
- المستندات: https://stripe.com/docs

---

## 📝 ملاحظات إضافية

1. **لا تنسَ تفعيل 2FA** على حسابات PayPal و Stripe
2. **راجع السياسات** الخاصة بكل بوابة دفع
3. **احتفظ بنسخة احتياطية** من جميع المعاملات
4. **راقب رسائل البريد** من PayPal/Stripe للتحديثات الأمنية

---

## ✅ الجاهزية للإطلاق

قبل الإطلاق، تأكد من:
- [x] إعداد PayPal Production Account
- [x] إعداد Stripe Live Account
- [x] تثبيت SSL Certificate
- [x] اختبار جميع سيناريوهات الدفع
- [x] إعداد إشعارات البريد الإلكتروني
- [x] مراجعة الأمان والخصوصية
- [x] تفعيل سجل المعاملات

---

**تاريخ آخر تحديث**: ديسمبر 2025
**الإصدار**: 1.0
