// js/market-flags.js
// CSP-safe: sets market flags and optional API override + badge update
(function(){
  try{ window.DISABLE_LEGACY_MARKETPLACE_UI = true; }catch(_){ }
  try{
    var params = new URLSearchParams(window.location.search||'');
    var override = params.get('api');
    if(override){ window.MARKET_API_BASE = override; }
    var badge = document.getElementById('api-badge-text');
    if(badge){ badge.textContent = (window.MARKET_API_BASE || '/api'); }
  }catch(_){ }
})();
