(function(global){
  function onReady(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else {fn();} }
  onReady(async function(){
    var accBtn = document.getElementById('account-button');
    var accLbl = document.getElementById('account-label');
    var accIco = document.getElementById('account-icon');
    var menu = document.getElementById('account-menu');
    var sellerLink = document.getElementById('seller-link');
    var adminLink = document.getElementById('admin-link');
    var logout = document.getElementById('logout-btn');
    var debugBtn = document.getElementById('toggle-debug-views');

    function showMenu(){ if(menu) menu.style.display = 'block'; }
    function hideMenu(){ if(menu) menu.style.display = 'none'; }
    function toggleMenu(){ if(!menu) return; menu.style.display = (menu.style.display==='block'?'none':'block'); }

    var Common = (global.Market && global.Market.Common) || null;
    var me = null; var role = 'user';
    try {
      if (Common && typeof Common.fetchMe === 'function') {
        me = await Common.fetchMe();
        role = me && me.user && (me.user.role || 'user') || 'user';
        var name = me && me.user && (me.user.name || me.user.displayName || me.user.id) || '';
        if (sellerLink) sellerLink.style.display = (role === 'seller' || role === 'admin') ? 'inline-block' : 'none';
        if (adminLink) adminLink.style.display = (role === 'admin') ? 'inline-block' : 'none';
        if (accLbl) accLbl.textContent = (me && me.authenticated) ? String(name||global.Market.I18n && global.Market.I18n.t('account')) : (global.Market.I18n ? global.Market.I18n.t('signin') : 'تسجيل الدخول');
        if (accIco) accIco.style.background = (me && me.authenticated) ? '#19c37d' : '#0e1a30';
      }
    } catch(_){ }

    // Role-aware menu items
    if (menu) {
      var items = menu.querySelectorAll('.menu-item');
      items.forEach(function(it){
        var r = it.getAttribute('data-role');
        if (!r) { it.style.display = 'block'; return; }
        it.style.display = (String(r) === String(role)) ? 'block' : 'none';
      });
    }

    // Toggle or redirect
    if (accBtn) {
      accBtn.onclick = function(e){
        e.preventDefault();
        if (!(me && me.authenticated)) { window.location.href = '../auth/public/login.html'; return; }
        toggleMenu();
      };
    }

    // Outside click closes menu
    document.addEventListener('click', function(ev){
      var within = ev.target.closest('#account-button') || ev.target.closest('#account-menu');
      if (!within) hideMenu();
    });

    // Logout clears tokens and route to login
    if (logout) {
      logout.addEventListener('click', function(){
        try {
          localStorage.removeItem('MP_TOKEN');
          localStorage.removeItem('AX_TOKEN');
          sessionStorage.removeItem('MP_TOKEN');
        } catch(_){}
        hideMenu();
        window.location.href = '../auth/public/login.html';
      });
    }

    // Debug views toggle label update
    function updateDebugLabel(){
      if(!debugBtn) return;
      try {
        var enabled = (localStorage.getItem('MP_DEBUG_VIEWS') === '1') || (global.Market && global.Market.Products && global.Market.Products._debugViewsEnabled);
        var prefix = (global.Market && global.Market.I18n) ? global.Market.I18n.t('debug_views') : 'المشاهدات: ';
        var on = (global.Market && global.Market.I18n) ? global.Market.I18n.t('views_on') : 'تشغيل';
        var off = (global.Market && global.Market.I18n) ? global.Market.I18n.t('views_off') : 'إيقاف';
        debugBtn.textContent = prefix + (enabled?on:off);
      } catch(_) { }
    }
    updateDebugLabel();
    if (debugBtn) {
      debugBtn.addEventListener('click', function(){
        try {
          var enabled = !(localStorage.getItem('MP_DEBUG_VIEWS') === '1');
          if(global.Market && global.Market.Products && typeof global.Market.Products.setDebugViews === 'function'){
            global.Market.Products.setDebugViews(enabled);
          } else {
            localStorage.setItem('MP_DEBUG_VIEWS', enabled ? '1':'0');
          }
          updateDebugLabel();
        } catch(_){}
      });
    }
  });
})(window);
