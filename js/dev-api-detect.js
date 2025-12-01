(function(w){
  async function tryPing(base){
    try {
      const u = base.replace(/\/$/,'') + '/api/market/ping';
      const r = await fetch(u, { method:'GET' });
      if(!r.ok) return false; const j = await r.json().catch(()=>null);
      return !!(j && j.ok !== false && (j.service === 'market' || j.mode));
    } catch(_) { return false; }
  }
  async function detect(){
    // Validate explicit/stored value first; if invalid, clear and continue detection
    if(w.MARKET_API_BASE){
      const ok = await tryPing(w.MARKET_API_BASE);
      if(ok) return w.MARKET_API_BASE;
    }
    try {
      const s = localStorage.getItem('MARKET_API_BASE');
      if(s){
        const ok = await tryPing(s);
        if(ok){ w.MARKET_API_BASE = s; return s; }
        // stale value -> clear
        localStorage.removeItem('MARKET_API_BASE');
      }
    } catch(_){ }
    const candidates = [
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3026',
      'http://localhost:3031',
      '' // same-origin, for reverse proxy setups
    ];
    for(const c of candidates){
      const ok = await tryPing(c || '');
      if(ok){ try{ if(c) localStorage.setItem('MARKET_API_BASE', c); }catch(_){ } w.MARKET_API_BASE = c || '/api'; return w.MARKET_API_BASE; }
    }
    // Fallback to same-origin /api
    w.MARKET_API_BASE = '/api';
    return w.MARKET_API_BASE;
  }
  // Kick detection early
  detect();
  w.__detectMarketApiBase = detect;
})(window);
