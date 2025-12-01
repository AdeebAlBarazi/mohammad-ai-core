(function(global){
  function onReady(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else {fn();} }
  onReady(function(){
    var prev = document.getElementById('prev-page');
    var next = document.getElementById('next-page');
    var pageInfo = {
      container: document.getElementById('market-pagination'),
      currentEl: document.getElementById('current-page'),
      totalEl: document.getElementById('total-pages')
    };

    function getState(){
      var s = (global.Market && global.Market.Products && global.Market.Products.state) || { page:1, totalPages:1 };
      return { page: s.page||1, totalPages: s.totalPages||1 };
    }
    function applyState(){
      var st = getState();
      if (pageInfo.currentEl) pageInfo.currentEl.textContent = String(st.page);
      if (pageInfo.totalEl) pageInfo.totalEl.textContent = String(st.totalPages);
      if (pageInfo.container) pageInfo.container.style.display = (st.totalPages>1 ? 'flex' : 'none');
      if (prev) prev.disabled = (st.page<=1);
      if (next) next.disabled = (st.page>=st.totalPages);
    }
    function go(delta){
      var st = getState();
      var target = st.page + delta;
      if (target < 1 || target > st.totalPages) return;
      try {
        if (global.Market && global.Market.Products && typeof global.Market.Products.goToPage === 'function'){
          global.Market.MarketplaceScrollTop && typeof global.Market.MarketplaceScrollTop==='function' && global.Market.MarketplaceScrollTop();
          global.Market.Products.goToPage(target).then(applyState);
        }
      } catch(_){ }
    }

    prev && prev.addEventListener('click', function(){ go(-1); });
    next && next.addEventListener('click', function(){ go(1); });

    // Initial sync
    applyState();

    // Expose optional API
    global.Market = global.Market || {};
    global.Market.Pagination = { applyState: applyState };
  });
})(window);
