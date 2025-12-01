(function(global){
  function onReady(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else {fn();} }
  onReady(function(){
    var input = document.getElementById('header-search');
    var suggest = document.getElementById('header-suggest');
    var applyBtn = document.getElementById('apply-filters');
    var searchText = document.getElementById('search-text');

    function openSuggest(){ if(suggest) suggest.style.display = 'block'; }
    function closeSuggest(){ if(suggest) suggest.style.display = 'none'; }
    function setMainSearch(val){ if(searchText) searchText.value = val || ''; }

    // Basic inline suggestions using existing autocomplete module if available
    function fetchSuggestions(q){
      try {
        if (global.Market && global.Market.Search && typeof global.Market.Search.autocomplete === 'function'){
          return global.Market.Search.autocomplete(q);
        }
      } catch(_){}
      return Promise.resolve([]);
    }

    if (input) {
      input.addEventListener('input', function(){
        var q = input.value.trim();
        if (!q){ closeSuggest(); return; }
        fetchSuggestions(q).then(function(items){
          if (!suggest) return;
          if (!items || !items.length){ closeSuggest(); return; }
          suggest.innerHTML = items.map(function(it){ return '<div class="suggest-item" data-val="'+(it.value||it.name||it)+'">'+(it.label||it.name||it)+'</div>'; }).join('');
          openSuggest();
        });
      });
      input.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeSuggest(); } });
    }

    if (suggest) {
      suggest.addEventListener('click', function(e){
        var it = e.target.closest('.suggest-item');
        if(!it) return;
        var v = it.getAttribute('data-val') || '';
        input && (input.value = v);
        setMainSearch(v);
        if (global.Market && global.Market.Products && typeof global.Market.Products.setQuery==='function'){
          global.Market.Products.setQuery({ search: v });
        } else {
          applyBtn && applyBtn.click();
        }
        closeSuggest();
      });
    }

    document.addEventListener('click', function(e){
      var within = e.target.closest('#header-search') || e.target.closest('#header-suggest');
      if(!within) closeSuggest();
    });
  });
})(window);
