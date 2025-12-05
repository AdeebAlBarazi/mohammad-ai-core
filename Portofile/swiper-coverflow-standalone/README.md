# 🎨 سلايدر Coverflow ثلاثي الأبعاد

## 📦 المحتويات

```
swiper-coverflow-standalone/
│
├── index.html          # الملف الرئيسي للسلايدر
├── css/
│   └── swiper.min.css  # ملف تنسيقات Swiper
├── js/
│   └── swiper.min.js   # مكتبة Swiper JavaScript
├── images/
│   └── nature-*.jpg    # صور العرض (10 صور)
└── README.md           # هذا الملف
```

## 🚀 كيفية الاستخدام

### طريقة 1: استخدام مباشر
1. افتح ملف `index.html` في المتصفح مباشرة
2. جاهز للعمل!

### طريقة 2: دمج في موقعك
1. انسخ المجلد كاملاً إلى مشروعك
2. أضف الكود التالي في صفحتك:

```html
<!-- في قسم head -->
<link rel="stylesheet" href="path/to/swiper-coverflow-standalone/css/swiper.min.css">

<!-- في قسم body -->
<div class="swiper-container">
    <div class="swiper-wrapper">
        <div class="swiper-slide" style="background-image:url(images/nature-1.jpg)"></div>
        <div class="swiper-slide" style="background-image:url(images/nature-2.jpg)"></div>
        <!-- أضف المزيد من الشرائح -->
    </div>
    <div class="swiper-pagination"></div>
</div>

<!-- قبل نهاية body -->
<script src="path/to/swiper-coverflow-standalone/js/swiper.min.js"></script>
<script>
    var swiper = new Swiper('.swiper-container', {
        effect: 'coverflow',
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        coverflowEffect: {
            rotate: 50,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: true,
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
    });
</script>
```

## ⚙️ التخصيص

### تغيير عدد الشرائح المعروضة
```javascript
slidesPerView: 3, // بدلاً من 'auto'
```

### تغيير زاوية الدوران
```javascript
coverflowEffect: {
    rotate: 30, // قيمة أقل = دوران أقل
}
```

### تغيير العمق
```javascript
coverflowEffect: {
    depth: 200, // قيمة أكبر = عمق أكبر
}
```

### إضافة أزرار التنقل
```html
<div class="swiper-button-next"></div>
<div class="swiper-button-prev"></div>
```

```javascript
navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
},
```

## 🎯 الميزات

- ✅ تأثير ثلاثي الأبعاد احترافي
- ✅ يعمل على جميع الأجهزة (Desktop, Mobile, Tablet)
- ✅ دعم اللمس والماوس
- ✅ دعم لوحة المفاتيح (أسهم اليمين واليسار)
- ✅ دعم عجلة الماوس
- ✅ ترقيم قابل للنقر
- ✅ مستقل تماماً - لا يحتاج اتصال إنترنت

## 📝 تغيير الصور

استبدل الصور في مجلد `images/` بصورك الخاصة، ثم حدّث المسارات في `index.html`:

```html
<div class="swiper-slide" style="background-image:url(images/your-image.jpg)"></div>
```

## 🔧 المتطلبات

لا توجد متطلبات! كل شيء مدمج ويعمل offline.

## 📱 التوافق

- Chrome, Firefox, Safari, Edge
- iOS Safari 11+
- Android Chrome 7+

## 📄 الترخيص

Swiper مرخص تحت MIT License

---

**استمتع بالسلايدر! 🎉**
