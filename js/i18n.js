(function(global){
  var I18n = {
    dict: {
      ar: {
        brand: 'السوق الكبير',
        account: 'حسابي',
        seller_link: 'أضفني كبائع',
        admin_link: 'طلبات البائعين (مشرف)',
        cat_all: 'الكل',
        cat_building: 'مواد البناء',
        cat_marble: 'رخام',
        cat_electronics: 'الكترونيات',
        cat_fashion: 'أزياء',
        cat_home: 'منزل',
        cat_toys: 'ألعاب',
        cat_care: 'عناية شخصية',
        cat_grocery: 'بقالة',
        cat_books: 'كتب',
        title: 'استكشف المنتجات',
        subtitle: 'تسوق أحدث العروض والمنتجات الموثوقة',
        hero_title: 'عروض الإطلاق الخاصة',
        hero_sub: 'خصومات وعروض لفترة محدودة على فئات مختارة',
        hero_cta: 'تسوّق الآن',
        filter_by: 'تصفية حسب',
        filters_categories: 'الفئات',
        filters_price: 'السعر',
        filters_rating_min: 'التقييم الأدنى',
        filters_search: 'بحث',
        filters_sort: 'ترتيب',
        sort_popular: 'الأكثر رواجًا',
        sort_price_asc: 'السعر: من الأقل للأعلى',
        sort_price_desc: 'السعر: من الأعلى للأقل',
        sort_newest: 'الأحدث',
        filters_page_size: 'حجم الصفحة',
        apply_filters: 'تطبيق التصفية',
        apply: 'تطبيق',
        prev: 'السابق',
        next: 'التالي',
        page: 'صفحة',
        of: 'من',
        cart: 'سلة المشتريات ',
        cart_title: 'سلة المشتريات',
        close: 'إغلاق',
        cart_empty: 'السلة فارغة',
        items: 'العناصر:',
        subtotal: 'المجموع:',
        refresh: 'تحديث',
        checkout: 'إتمام الطلب',
        add_to_cart: 'أضف إلى السلة',
        sar: 'SAR',
        menu_profile: 'ملفي',
        menu_orders: 'طلباتي',
        menu_seller: 'لوحة البائع',
        menu_contractor: 'لوحة المقاول',
          sar: 'ر.س',
          currency_code: 'SAR',
        menu_logout: 'تسجيل الخروج',
        all: 'الكل',
        stars_4: '4+ نجوم',
        stars_3: '3+ نجوم',
        stars_2: '2+ نجوم',
        debug_views: 'المشاهدات: ',
        signin: 'تسجيل الدخول',
        search_ph: 'ابحث عن منتج',
        views_on: 'تشغيل',
        views_off: 'إيقاف'
        ,badge_new: 'جديد'
        ,available: 'متوفر'
        ,unavailable: 'غير متوفر'
        ,unit_piece: 'قطعة'
        ,unit_kg: 'كجم'
        ,unit_liter: 'لتر'
        ,unit_box: 'علبة'
        ,unit_meter: 'متر'
        ,unit_cm: 'سم'
        ,unit_package: 'طرد'
        ,session_expired: 'انتهت الجلسة'
        ,signin_required: 'تسجيل الدخول مطلوب'
        ,checkout_open_error: 'تعذر فتح صفحة الدفع'
      },
      en: {
        brand: 'Grand Market',
        account: 'Account',
        seller_link: 'Add me as Seller',
        admin_link: 'Seller Requests (Admin)',
        cat_all: 'All',
        cat_building: 'Building Materials',
        cat_marble: 'Marble',
        cat_electronics: 'Electronics',
        cat_fashion: 'Fashion',
        cat_home: 'Home',
        cat_toys: 'Toys',
        cat_care: 'Personal Care',
        cat_grocery: 'Grocery',
        cat_books: 'Books',
        title: 'Explore Products',
        subtitle: 'Shop latest deals and trusted products',
        hero_title: 'Special Launch Deals',
        hero_sub: 'Limited-time discounts on select categories',
        hero_cta: 'Shop Now',
        filter_by: 'Filter by',
        filters_categories: 'Categories',
        filters_price: 'Price',
        filters_rating_min: 'Minimum Rating',
        filters_search: 'Search',
        filters_sort: 'Sort',
          sar: 'SAR',
          currency_code: 'SAR',
        sort_price_asc: 'Price: Low to High',
        sort_price_desc: 'Price: High to Low',
        sort_newest: 'Newest',
        filters_page_size: 'Page Size',
        apply_filters: 'Apply Filters',
        apply: 'Apply',
        prev: 'Previous',
        next: 'Next',
        page: 'Page',
        of: 'of',
        cart: 'Cart ',
        cart_title: 'Cart',
        close: 'Close',
        cart_empty: 'Cart is empty',
        items: 'Items:',
        subtotal: 'Subtotal:',
        refresh: 'Refresh',
        checkout: 'Checkout',
        add_to_cart: 'Add to cart',
        sar: 'SAR',
        menu_profile: 'Profile',
        menu_orders: 'My Orders',
        menu_seller: 'Seller Dashboard',
        menu_contractor: 'Contractor Dashboard',
        menu_admin: 'Admin Dashboard',
        menu_logout: 'Logout',
        all: 'All',
        stars_4: '4+ stars',
        stars_3: '3+ stars',
        stars_2: '2+ stars',
        debug_views: 'Views: ',
        signin: 'Sign in',
        search_ph: 'Search a product',
        views_on: 'On',
        views_off: 'Off'
        ,badge_new: 'NEW'
        ,available: 'Available'
        ,unavailable: 'Unavailable'
        ,unit_piece: 'piece'
        ,unit_kg: 'kg'
        ,unit_liter: 'liter'
        ,unit_box: 'box'
        ,unit_meter: 'meter'
        ,unit_cm: 'cm'
        ,unit_package: 'package'
        ,session_expired: 'Session expired'
        ,signin_required: 'Sign in required'
        ,checkout_open_error: 'Unable to open checkout'
      }
    },
    getLang: function(){ try { return localStorage.getItem('MP_LANG') || 'ar'; } catch(_) { return 'ar'; } },
    setLang: function(l){ try { localStorage.setItem('MP_LANG', l); } catch(_){} },
    t: function(key, lang){ var d = I18n.dict[lang||I18n.getLang()]||I18n.dict.ar; return d[key]!==undefined ? d[key] : (I18n.dict.ar[key]||''); },
    applyAll: function(lang){
      var l = (lang||I18n.getLang());
      document.querySelectorAll('[data-i18n]').forEach(function(el){
        var key = el.getAttribute('data-i18n');
        if (!key) return;
        var val = I18n.t(key, l);
        if (el.tagName==='INPUT' || el.tagName==='TEXTAREA') {
          el.placeholder = val || el.placeholder;
        } else {
          el.textContent = val || el.textContent;
        }
      });
      var hs = document.getElementById('header-search'); if(hs){ hs.placeholder = I18n.t('search_ph', l); }
      var cb = document.getElementById('cart-button'); if(cb && cb.firstChild){ cb.firstChild.nodeValue = I18n.t('cart', l); }
      var dv = document.getElementById('toggle-debug-views'); if(dv){
        try {
          var enabled = (localStorage.getItem('MP_DEBUG_VIEWS') === '1') || (global.Market && global.Market.Products && global.Market.Products._debugViewsEnabled);
          dv.textContent = I18n.t('debug_views', l) + (enabled ? I18n.t('views_on', l) : I18n.t('views_off', l));
        } catch(_){}
      }
      var isAuth = false; try { isAuth = !!(global.Market && global.Market.Common && global.Market.Common._me && global.Market.Common._me.authenticated); } catch(_){}
      if (!isAuth) { var al = document.getElementById('account-label'); if(al) al.textContent = I18n.t('signin', l); }
    },
    toggle: function(){ var l = I18n.getLang(); var nx = (l==='ar'?'en':'ar'); I18n.setLang(nx); return nx; }
  };
  global.Market = global.Market || {};
  global.Market.I18n = I18n;
})(window);
