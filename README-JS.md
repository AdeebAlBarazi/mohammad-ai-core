# Marketplace JS (systems/marketplace/js)

تم نسخ مجموعة مبسطة من سكربتات السوق إلى هذا المجلد لتكون النسخة منظمة ومكتفية ذاتياً:

## الملفات المحلية
- `token.js`: توفير الدالة `getAxiomToken`.
- `market-common.js`: نسخة مختصرة (كشف واجهة API + fetchJSON + الحدث).
- `market-products.js`: جلب وعرض المنتجات + التصفح البسيط + إضافة للسلة.
- `market-cart.js`: عرض السلة + الشراء المبسط.
- `market-init.js`: تهيئة أولية خفيفة.
- `market-search-autocomplete.js`: اقتراحات البحث المبسطة.

## ما لم يُنسخ
- السكربتات القديمة داخل `Coreflowhub/js/*` وملفات مدمجة كبيرة (لتجنب التكرار وصيانة مزدوجة).
- `market-handle.js`, `market-orders.js` (يمكن إضافتها عند الحاجة بنفس الأسلوب).

## طريقة الربط
تم تحديث صفحات:
- `pages/marketplace-index.html`
- `pages/product.html`
- `pages/cart.html`
- `pages/category.html`

لاستخدام المسار المحلي: `../js/...`

إذا رغبت إضافة ملفات أخرى (مثل إدارة الطلبات أو الـ Handle) أخبرني لأضيف نسخاً مبسطة مماثلة.
