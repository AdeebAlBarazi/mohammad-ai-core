(function(global){
  function onReady(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else {fn();} }
  onReady(function(){
    var bar = document.getElementById('category-bar');
    if (bar) {
      bar.addEventListener('click', function(e){
        var b = e.target.closest('[data-cat]');
        if(!b) return;
        var v = b.getAttribute('data-cat') || '';
        var input = document.getElementById('search-text');
        if(input){ input.value = v; }
        if (global.Market && global.Market.Products && typeof global.Market.Products.setQuery==='function'){
          global.Market.Products.setQuery({ search: v });
        } else {
          var apply = document.getElementById('apply-filters');
          if(apply){ apply.click(); }
        }
      });
    }
    // Sidebar apply mirrors main apply button
    var applySide = document.getElementById('apply-filters-side');
    if (applySide) {
      applySide.addEventListener('click', function(){
        if (global.Market && global.Market.Products && typeof global.Market.Products.setQuery==='function'){
          var q = {
            search: (document.getElementById('search-text')||{}).value || '',
            sort: (document.getElementById('sort-select')||{}).value || '',
            pageSize: parseInt((document.getElementById('page-size-select')||{}).value || '20', 10) || 20,
            priceMin: parseFloat((document.getElementById('price-min')||{}).value || '') || undefined,
            priceMax: parseFloat((document.getElementById('price-max')||{}).value || '') || undefined
          };
          global.Market.Products.setQuery(q);
        } else {
          var apply = document.getElementById('apply-filters');
          if(apply){ apply.click(); }
        }
      });
    }
  });
})(window);
