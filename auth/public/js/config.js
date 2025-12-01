(function(){
  function setBase(p){
    window.AUTH_API_BASE = 'http://localhost:' + p + '/api/auth';
    console.log('[auth] Using AUTH_API_BASE =', window.AUTH_API_BASE);
  }
  // Optional app home for redirect after login
  (function(){
    try {
      if(!window.APP_HOME){ window.APP_HOME = localStorage.getItem('APP_HOME') || '/'; }
      if(!window.AFTER_LOGIN_URL){ window.AFTER_LOGIN_URL = localStorage.getItem('AFTER_LOGIN_URL') || window.APP_HOME || '/'; }
    } catch(_) {}
  })();
  if(window.AUTH_API_BASE) return;
  const currentPort = (window.location.port||'').trim();
  // If served via Live Server
  if(currentPort === '5500'){ setBase(window.AUTH_PORT || '3003'); return; }
  // Candidate ports to probe (in order)
  const candidates = [currentPort, '3003','3004','4100'].filter((v,i,a)=>v && a.indexOf(v)===i);
  let done = false;
  (async () => {
    for(const c of candidates){
      try {
        const res = await fetch('http://localhost:'+c+'/api/auth/health', { method:'GET' , cache:'no-store' });
        if(res.ok){ setBase(c); done = true; break; }
      } catch(_) {}
    }
    if(!done){ console.warn('[auth] Could not auto-detect AUTH_API_BASE'); }
  })();
})();
