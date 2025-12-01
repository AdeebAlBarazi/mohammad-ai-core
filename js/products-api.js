(function(global){
  var Common = null;
  function initCommon(){ Common = (global.Market && global.Market.Common) || null; }
  function apiBase(){ initCommon(); return (Common && Common.apiBase) ? Common.apiBase() : ''; }
  function fetchJSON(url, opts){ initCommon(); if (Common && typeof Common.fetchJSON==='function') return Common.fetchJSON(url, opts); return fetch(url, opts).then(function(r){ return r.json(); }); }
  var ProductsAPI = {
    homeFeed: function(params){
      var q = params||{}; var qs = new URLSearchParams(q).toString();
      var base = apiBase();
      // If apiBase() returns '/api' (same-origin), construct absolute origin + /api
      var origin = (window.location && window.location.origin) ? window.location.origin : '';
      var root = base.replace(/\/?api\/?$/,'');
      var fullBase = root ? root : origin; // root empty => same-origin
      var url = fullBase + '/api/market/home-feed' + (qs?('?'+qs):'');
      return fetchJSON(url);
    },
    search: function(params){
      var q = params||{}; var qs = new URLSearchParams(q).toString();
      var base = apiBase();
      var origin = (window.location && window.location.origin) ? window.location.origin : '';
      var root = base.replace(/\/?api\/?$/,'');
      var fullBase = root ? root : origin;
      var url = fullBase + '/api/market/search' + (qs?('?'+qs):'');
      return fetchJSON(url);
    },
    logClick: function(payload){
      var base = apiBase();
      var origin = (window.location && window.location.origin) ? window.location.origin : '';
      var root = base.replace(/\/?api\/?$/,'');
      var fullBase = root ? root : origin;
      return fetchJSON(fullBase + '/api/market/interactions/click', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload||{}) });
    },
    logView: function(payload){
      var base = apiBase();
      var origin = (window.location && window.location.origin) ? window.location.origin : '';
      var root = base.replace(/\/?api\/?$/,'');
      var fullBase = root ? root : origin;
      return fetchJSON(fullBase + '/api/market/interactions/view', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload||{}) });
    }
  };
  global.Market = global.Market || {};
  global.Market.ProductsAPI = ProductsAPI;
})(window);
