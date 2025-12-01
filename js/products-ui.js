(function(global){
  var state = { page:1, pageSize:20, totalPages:1, items:[], query:{} };
  var grid = null;
  function onReady(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else {fn();} }
  function translateCategory(cat){
    if(!cat) return '';
    var I18n = global.Market && global.Market.I18n;
    var map = {
      'مواد البناء': 'cat_building',
      'رخام': 'cat_marble',
      'الكترونيات': 'cat_electronics',
      'أزياء': 'cat_fashion',
      'منزل': 'cat_home',
      'ألعاب': 'cat_toys',
      'عناية شخصية': 'cat_care',
      'بقالة': 'cat_grocery',
      'كتب': 'cat_books'
    };
    var key = map[cat] || null;
    return key ? (I18n ? I18n.t(key) : cat) : cat;
  }
  function renderItem(it){
    var I18n = global.Market && global.Market.I18n;
    var price = (global.Market && global.Market.Format) ? global.Market.Format.currency(it.price) : (function(v){ if(v==null) return ''; var lang = (I18n && I18n.getLang) ? I18n.getLang() : 'ar'; var suffix = I18n ? I18n.t('sar', lang) : 'SAR'; return String(v)+' '+suffix; })(it.price);
    var badgeNew = it.isNew ? '<span class="badge-new">'+(I18n?I18n.t('badge_new'):'NEW')+'</span>' : '';
    var addLbl = I18n ? I18n.t('add_to_cart') : 'Add to cart';
    var cat = translateCategory(it.category || it.cat || it.categoryName);
    var unitMap = { piece:'unit_piece', kg:'unit_kg', liter:'unit_liter', box:'unit_box', meter:'unit_meter', m:'unit_meter', cm:'unit_cm', package:'unit_package', pkg:'unit_package' };
    var unitKey = unitMap[(it.unit||'').toLowerCase()] || null;
    var unitLbl = unitKey ? (I18n?I18n.t(unitKey): it.unit) : (it.unit||'');
    var availability = ((it.available===true || it.inStock===true) || ((typeof it.stockCount==='number') && it.stockCount>0)) ? (I18n?I18n.t('available'):'Available') : (I18n?I18n.t('unavailable'):'Unavailable');
    var vendorName = (it.vendor && (it.vendor.name||it.vendor.displayName)) || it.vendorName || '';
    function specLine(){
      var t = it.thickness_mm || (it.attributes && (it.attributes.thickness_mm||it.attributes.thickness)) || it.thickness || '';
      var c = (it.color_family||it.colorFamily) || (it.attributes && (it.attributes.color_family||it.attributes.color)) || it.color || '';
      var bits = [];
      if(t){ bits.push(String(t).toString().replace(/\b(mm|millimeter|ملم)\b/i,'').trim() + ' مم'); }
      if(c){ bits.push(String(c)); }
      return bits.join(' • ');
    }
    return '<div class="product-card" data-sku="'+(it.sku||it.id||'')+'">'
      + (badgeNew)
      + '<div class="p-name">'+(it.name||'')+'</div>'
      + (cat ? '<div class="p-cat" style="color:#9fb3d9;font-size:13px;">'+cat+'</div>' : '')
      + (vendorName ? '<div class="p-vendor" style="color:#b8c3da;font-size:12px;">'+vendorName+'</div>' : '')
      + (specLine() ? '<div class="p-specs" style="color:#c7d1e9;font-size:12px;">'+specLine()+'</div>' : '')
      + '<div class="p-price">'+price+'</div>'
      + ((unitLbl||availability) ? '<div class="p-meta" style="display:flex;gap:8px;color:#9fb3d9;font-size:12px;">'
        + (unitLbl ? '<span>'+unitLbl+'</span>' : '')
        + (availability ? '<span>'+availability+'</span>' : '')
        + '</div>' : '')
      + '<button class="btn" data-action="add-to-cart" data-sku="'+(it.sku||it.id||'')+'">'+addLbl+'</button>'
      + '</div>';
  }
  function renderGrid(items){ if(!grid) return; grid.innerHTML = items.map(renderItem).join(''); }
  function applyPagination(total, pageSize){
    state.totalPages = Math.max(1, Math.ceil((total||0)/(pageSize||state.pageSize)) );
    global.Market = global.Market || {}; global.Market.Products = global.Market.Products || {}; global.Market.Products.state = { page: state.page, totalPages: state.totalPages };
    if (global.Market.Pagination && typeof global.Market.Pagination.applyState==='function') global.Market.Pagination.applyState();
  }
  function fetchAndRender(){
    var api = global.Market && global.Market.ProductsAPI;
    if (!api) return;
    var q = Object.assign({}, state.query, { page: state.page, pageSize: state.pageSize });
    var fn = (q.search || q.category || q.sort) ? api.search : api.homeFeed;
    fn(q).then(function(res){
      var items = res && (res.items||res.products||res.data) || [];
      var total = res && (res.total||res.totalItems||items.length) || items.length;
      state.items = items;
      renderGrid(items);
      applyPagination(total, state.pageSize);
    }).catch(function(){ /* ignore */ });
  }
  function setQuery(q){ state.query = Object.assign({}, state.query, q||{}); state.page = 1; fetchAndRender(); }
  function goToPage(p){ state.page = p; return new Promise(function(resolve){ fetchAndRender(); resolve(); }); }

  onReady(function(){
    grid = document.getElementById('market-grid');
    try {
      var Common = (global.Market && global.Market.Common) || null;
      if (Common && typeof Common.whenReady==='function') {
        Common.whenReady().then(fetchAndRender);
        return;
      }
    } catch(_){ }
    fetchAndRender();
  });

  global.Market = global.Market || {};
  global.Market.Products = global.Market.Products || {};
  global.Market.Products.setQuery = setQuery;
  global.Market.Products.goToPage = goToPage;
  global.Market.Products.state = { page: state.page, totalPages: state.totalPages };
})(window);
