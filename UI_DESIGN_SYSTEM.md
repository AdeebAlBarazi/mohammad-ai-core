# Unified UI Design System (Axiom Hub Multi-Systems)

هدف هذا المستند وضع هوية بصرية وواجهات موحّدة عبر الأنظمة (المنصة الرئيسية، البائع الذكي، السوق، طلبات الشراء، التفتيش، إدارة الشركات، التسويات، التحليلات).

## 1. المبادئ
- بساطة وظيفية أولاً: كل شاشة توصل للمهمة الرئيسية خلال ≤ 3 نقرات.
- تناسق عبر النطاقات: نفس الألوان، نفس أنماط الأزرار، نفس المسافات.
- وضوح حالات النظام: ألوان مميزة للحالات (نشط، قيد المعالجة، فشل، نجاح، أرشيف).
- إمكانية التوسع: مكونات صغيرة قابلة لإعادة الاستخدام (بطاقة، شريط أدوات، جدول، توست، مودال).

## 2. لوحة الألوان (Tokens)
| Token | قيمة | استخدام |
|-------|------|---------|
| --color-bg | #ffffff | خلفيات أساسية |
| --color-bg-alt | #f9fafb | خلفيات أقسام فاتحة |
| --color-border | #e5e7eb | حدود خفيفة |
| --color-text | #111827 | نص أساسي |
| --color-text-muted | #6b7280 | نص ثانوي |
| --color-primary | #065f46 | أزرار أساسية / عناصر تفاعل مهمة |
| --color-primary-hover | #047857 | حالة تحويم للزر الأساسي |
| --color-accent | #1e3a8a | إبراز عدّاد، مقاييس تحليلات |
| --color-danger | #b91c1c | أخطاء / حذف |
| --color-warning | #d97706 | تحذيرات / انتظار |
| --color-success | #059669 | حالات نجاح |
| --color-info | #0c4a6e | معلومات / تنبيه غير خطأ |

## 3. الطباعة (Typography)
- الخط الأساسي: system-ui, "Segoe UI", sans-serif.
- أحجام:
  - عنوان صفحة: 20px / وزن 600
  - عنوان قسم: 16px / وزن 600
  - نص عادي: 13px - 14px
  - توست / تسميات ثانوية: 12px
- تباعد أسطر: 1.4 للنصوص، 1.2 للعناوين.

## 4. المسافات (Spacing Scale)
| اسم | قيمة | استخدام |
|-----|------|---------|
| --space-1 | 4px | فجوات صغيرة بين رموز |
| --space-2 | 8px | فجوات عامة في مكونات صغيرة |
| --space-3 | 12px | فجوات قياسية بين مجموعات |
| --space-4 | 16px | حواف داخلية للصناديق |
| --space-5 | 24px | أقسام رئيسية |

## 5. المكونات الأساسية
### زر (Button)
```html
<button class="btn btn-primary">إجراء</button>
<button class="btn btn-secondary">إجراء ثانوي</button>
<button class="btn btn-danger">حذف</button>
```
أسلوب عام:
```css
.btn { font-size:13px; padding:6px 12px; border-radius:8px; cursor:pointer; border:1px solid var(--color-border); background:#fff; color:var(--color-text); }
.btn-primary { background:var(--color-primary); color:#ecfdf5; border-color:var(--color-primary); }
.btn-primary:hover { background:var(--color-primary-hover); }
.btn-secondary { background:#1e3a8a; color:#fff; border-color:#1e3a8a; }
.btn-danger { background:var(--color-danger); color:#fff; border-color:var(--color-danger); }
.btn[disabled] { opacity:.55; cursor:not-allowed; }
```

### بطاقة (Card)
```html
<div class="card">
  <h3 class="card-title">عنوان</h3>
  <div class="card-body">محتوى</div>
</div>
```
```css
.card { background:#fff; border:1px solid var(--color-border); border-radius:12px; padding:16px; box-shadow:0 2px 4px rgba(0,0,0,.05); }
.card-title { margin:0 0 8px; font-size:14px; font-weight:600; }
```

### جدول (Table)
- رؤوس بخلفية فاتحة (#f3f4f6) ونص 12px عريض فاتح.
- صف تحويم: خلفية #f9fafb.

### شريط أدوات (Toolbar)
سطح أفقي يحتوي أزرار وفلاتر، خلفية بيضاء، ظل خفيف، حواف 10px، مسافة داخلية 8px 12px.

### مودال (Modal)
- خلفية معتمة rgba(0,0,0,.45)
- صندوق أبيض مستدير 14px، ظل قوي، حواف داخلية 18px.

### توست (Toast)
موجود بالفعل في نظام الصور: نفس النظام يعمم عبر المشاريع بصنف `.toast-root` و `.toast` مع ألوان حسب النوع.

## 6. الأنماط التفاعلية (Interactive States)
| حالة | أسلوب |
|------|-------|
| تحويم زر أساسي | زيادة سطوع اللون + انتقال .15s |
| تركيز حقل إدخال | outline:2px solid #3b82f6; outline-offset:1px |
| تحميل | زر عليه spinner بسيط باستخدام pseudo element |

## 7. الأنماط الدلالية (Semantic Status Tags)
```html
<span class="tag tag-pending">قيد الانتظار</span>
<span class="tag tag-processing">قيد المعالجة</span>
<span class="tag tag-paid">مدفوعة</span>
<span class="tag tag-failed">فاشلة</span>
```
```css
.tag { display:inline-block; font-size:11px; line-height:1; padding:4px 8px; border-radius:999px; background:#e5e7eb; color:#374151; }
.tag-pending { background:#fef3c7; color:#92400e; }
.tag-processing { background:#e0f2fe; color:#0c4a6e; }
.tag-paid { background:#d1fae5; color:#065f46; }
.tag-failed { background:#fee2e2; color:#7f1d1d; }
```

## 8. هيكل الصفحة العامة (Page Layout)
```html
<header class="app-header">منطقة شعار + تنقل</header>
<main class="app-main">
  <aside class="app-side">قائمة وروابط فرعية</aside>
  <section class="app-content">محتوى ديناميكي</section>
</main>
```

## 9. نمط الاستجابة (Responsive)
- شبكة المنتجات / الصور تستخدم `repeat(auto-fill,minmax(160px,1fr))`.
- الجداول قابلة للتمرير الأفقي في الشاشات الصغيرة.
- شريط أدوات يلتف (flex-wrap:wrap) عند العرض الضيق.

## 10. بنية الملفات المقترحة للمشاركة
```
/ui-system/
  tokens.css          ← متغيرات CSS (يمكن تحميلها أولاً)
  components.css      ← أزرار / بطاقات / جداول / توست / تاغات
  layout.css          ← ترويسة / جانب / شبكات
  utilities.css       ← مسافات / نصوص مساعدة / إخفاء
```

## 11. خريطة الأنظمة وحالة الواجهات
| النظام | حالة الواجهة الحالية | فجوات مقترحة |
|--------|----------------------|--------------|
| البائع الذكي (Seller) | موجود: seller-dashboard.html | تحسين دمج design tokens + توحيد مكونات |
| السوق الكبير (Marketplace) | موجود: marketplace-index.html + market.js | إضافة توست موحّد + تاغات حالات |
| طلبات الشراء (Purchasing) | جزئي: orders-dashboard.html | إنشاء صفحة نطاق مستقل purchasing-index.html |
| التفتيش (Inspection) | موجود داخل Coreflowhub (inspect_dashboard.html) | صفحة نطاق مستقل inspection-index.html + إدراج tokens |
| إدارة الشركات | موجود: Coreflowhub/Dashboard_Company_Holl_index.html | ربط مركزي بصفحات فرعية + تحسين توحيد أزرار |
| التسويات المالية | ضمن seller-dashboard | استخراج مكون الجدول لمشاركة أوسع لاحقاً |
| التحليلات | مسودة فقط | إضافة لوحات بطاقات + placeholders للرسوم |

## 12. خطوات لاحقة سريعة
1. إنشاء مجلد `/ui-system` وإضافة الملفات الأساسية.
2. تضمين `tokens.css` و `components.css` في كل واجهة.
3. ترقية الصفحات الحالية لاعتماد الأصناف الموحدة.
4. بناء مكون Toast عام (تعميم الموجود في الصور).

## 13. الجودة والتوسع
- جميع الألوان معرفة كمتغيرات لتسهيل التبديل إلى ثيم داكن لاحقاً.
- المكونات بدون JavaScript ثقيل؛ التفاعلات تُبنى تدريجياً (progressive enhancement).

---
تم إعداد هذا الدليل كبداية، وسيتم التوسع مع إضافة الرسوم البيانية (Charts) والمخططات الحرارية لاحقاً.
