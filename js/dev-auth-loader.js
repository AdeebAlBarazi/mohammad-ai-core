// js/dev-auth-loader.js
// Conditionally load dev-auth bootstrap without inline scripts (CSP-safe)
(function(){
  try{
    var host = (location.hostname||'').toLowerCase();
    var isLocal = host === 'localhost' || host === '127.0.0.1';
    var params = new URLSearchParams(location.search||'');
    var allow = isLocal || params.get('dev') === '1' || (typeof window !== 'undefined' && window.USE_DEV_AUTH === true);
    if(!allow) return;
    var thisScript = document.currentScript;
    var base = '';
    if(thisScript && thisScript.src){ base = thisScript.src.replace(/[^/]+$/, ''); }
    else {
      // Fallback: infer by path location
      base = (location.pathname.indexOf('/Coreflowhub/') !== -1) ? '../js/' : 'js/';
      // Convert to absolute if needed
      if(!/^https?:/i.test(base)){ var a=document.createElement('a'); a.href=base; base=a.href; }
    }
    var s = document.createElement('script');
    s.src = base + 'dev-auth-bootstrap.js';
    s.defer = true;
    document.head.appendChild(s);
  }catch(_){ }
})();
