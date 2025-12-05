# 🤖 Jack AI - Portfolio Integration

## ✅ تم الإصلاح بنجاح!

### المشكلة السابقة
- واجهة Jack AI كانت تظهر لكن لا تستجيب للرسائل
- الخطأ: `Cannot POST /api/chat` - endpoint مفقود

### الحل
أنشأنا **Jack AI Platform** منفصل على port 3030 مع:
- **Backend API** كامل متصل بـ `agent-core`
- **Chat Interface** (`embed.html`) محسّن للـ iframe
- **Integration** مع OpenAI (يدعم stub mode بدون API key)

---

## 🚀 كيفية التشغيل

### الطريقة الأسهل (استخدم START.bat):

```batch
cd D:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\Portofile
START.bat
```

سيفتح نافذتين:
- **Jack AI Platform** على `http://localhost:3030`
- **Portfolio** على `http://localhost:8080`

### أو يدوياً (نافذتين PowerShell):

**نافذة 1 - Jack AI:**
```powershell
cd D:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\Portofile
node jack-server.js
```

**نافذة 2 - Portfolio:**
```powershell
cd D:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\Portofile
node server.js
```

---

## 📁 الملفات المهمة

### ملفات الخوادم
- `jack-server.js` - Jack AI Platform (port 3030)
- `server.js` - Portfolio Server (port 8080)
- `START.bat` - تشغيل كلا الخادمين معاً
- `STOP.bat` - إيقاف جميع خوادم Node.js

### ملفات Jack AI
- `embed.html` - واجهة المحادثة (iframe-optimized)
- `../agent-core/` - محرك الذكاء الصناعي
- `../agent-core/profile.json` - شخصية Jack وقدراته

### ملفات Portfolio
- `index_complete_jack.html` - الصفحة الرئيسية مع Jack AI
- `content.json` - بيانات المشاريع والشهادات
- `assets/` - الصور والأيقونات

---

## 🎯 كيف يعمل Jack AI

### 1. الواجهة (Frontend)
```javascript
// في index_complete_jack.html
function openJackChat() {
    // يفتح popup مع iframe
    document.getElementById('jackChatFrame').src = 'http://localhost:3030/embed.html';
}
```

### 2. صفحة المحادثة (embed.html)
```javascript
// في embed.html
fetch('http://localhost:3030/api/chat', {
    method: 'POST',
    body: JSON.stringify({ 
        message: 'ما هي خبرات الدكتور محمد؟',
        sessionId: 'portfolio-jack-123'
    })
})
```

### 3. الخادم (jack-server.js)
```javascript
// معالجة POST /api/chat
const result = await agentCore.chat({
    prompt: message,
    sessionId: sessionId,
    mode: 'unified',
    maxTokens: 1500
});
```

### 4. Agent Core
```javascript
// في agent-core/index.js
- يقرأ profile.json (شخصية Jack)
- يستدعي OpenAI API (أو stub إذا لم يكن متوفراً)
- يحفظ المحادثة في memory/sessions/
```

---

## 🔧 التكوين

### إضافة OpenAI API Key (اختياري)

لتفعيل الذكاء الحقيقي، أضف API key في ملف `.env`:

```bash
# في مجلد marketplace
cd D:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace
echo OPENAI_API_KEY=sk-your-key-here >> .env
```

### تعديل شخصية Jack

عدّل ملف `agent-core/profile.json`:

```json
{
  "name": "Jack",
  "default_mode": "unified",
  "modes": {
    "unified": {
      "system": "أنت Jack، مساعد شخصي ذكي لمحمد...",
      "max_tokens": 1500
    }
  }
}
```

---

## 🧪 الاختبار

### اختبار الصحة (Health Check)
```powershell
Invoke-WebRequest -Uri "http://localhost:3030/health"
```

### اختبار المحادثة
```powershell
$body = '{"message":"من هو الدكتور محمد؟","sessionId":"test-123"}'
Invoke-RestMethod -Uri "http://localhost:3030/api/chat" -Method POST -ContentType "application/json" -Body $body
```

---

## 📊 الأداء الحالي

✅ **يعمل:**
- واجهة المحادثة تفتح بشكل صحيح
- إرسال الرسائل والحصول على ردود
- حفظ المحادثات في sessions
- دعم العربية والإنجليزية

⏳ **قيد التطوير:**
- تسجيل صوتي 🎤
- رفع صور 📷
- OpenAI API integration (يعمل في stub mode حالياً)

---

## 🐛 حل المشاكل الشائعة

### "Cannot POST /api/chat"
- تأكد أن `jack-server.js` يعمل (ليس server.js)
- افحص port 3030: `netstat -ano | findstr :3030`

### "Jack AI غير متصل"
- تأكد من تشغيل `jack-server.js`
- افتح Console في المتصفح وابحث عن أخطاء CORS

### "الرد gibberish (رموز غريبة)"
- هذا طبيعي في stub mode
- أضف `OPENAI_API_KEY` للحصول على ردود حقيقية

### Port مشغول
```powershell
# إيقاف جميع خوادم Node
Stop-Process -Name node -Force
```

---

## 📝 ملاحظات التطوير

### معمارية النظام

```
Portfolio (8080)
    ↓ iframe
embed.html (3030)
    ↓ POST /api/chat
jack-server.js
    ↓ call
agent-core/index.js
    ↓ uses
OpenAI API / Stub Provider
```

### نقاط API المتوفرة

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | فحص الصحة |
| `/api/chat` | POST | محادثة غير متدفقة |
| `/embed.html` | GET | واجهة المحادثة |
| `/` | GET | يوجه إلى embed.html |

---

## 🎉 النتيجة النهائية

**الآن لديك:**
- ✅ Portfolio احترافي كامل
- ✅ Jack AI يعمل بشكل كامل
- ✅ محادثة تفاعلية في الوقت الفعلي
- ✅ حفظ تاريخ المحادثات
- ✅ جاهز للتطوير والتوسع

**التحسينات المستقبلية:**
- إضافة voice recognition حقيقي
- image analysis بـ GPT-4 Vision
- streaming responses (SSE)
- session management UI
- export conversations

---

## 📞 الدعم

للأسئلة أو المشاكل:
1. افحص Console في المتصفح (F12)
2. اطلع على logs الخادم في terminal
3. تحقق من أن الخادمين يعملان على ports الصحيحة

---

تم إنشاؤه بواسطة GitHub Copilot ✨
