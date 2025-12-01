(function(){
  const PATH = window.location.pathname.toLowerCase();
  const requires = (() => {
    if (PATH.includes('admin-') || PATH.includes('/admin')) return ['admin'];
    if (PATH.includes('seller-dashboard') || PATH.includes('seller-products')) return ['seller','admin'];
    return null; // no role restriction
  })();
  if(!requires) return; // only auth-guard needed
  function deny(reason){
    const overlay = document.createElement('div');
    overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.background='rgba(255,255,255,0.95)'; overlay.style.zIndex='9999'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.innerHTML = '<div style="text-align:center;border:1px solid #eee;background:#fff;padding:18px 22px;border-radius:10px;max-width:480px;">\n<h3>وصول مرفوض</h3>\n<p style="color:#555;margin:8px 0">'+reason+'</p>\n<div style="display:flex;gap:10px;justify-content:center;margin-top:12px">\n<a class="btn" href="marketplace-index.html">الرئيسية</a>\n<a class="btn btn-primary" href="seller-upgrade.html">ترقية الحساب</a>\n</div>\n</div>';
    document.body.appendChild(overlay);
  }
  async function check(){
    try{
      const r = await fetch('/api/market/auth/me');
      const j = await r.json();
      if(!j || !j.authenticated){ deny('يجب تسجيل الدخول أولاً.'); return; }
      const role = (j.user && j.user.role || '').toLowerCase();
      if(role === 'super-admin' || role === 'super_admin') {
        return; // treat as admin
      }
      const ok = requires.includes(role);
      if(!ok){
        deny('صلاحيات غير كافية لهذه الصفحة (مطلوب: '+ requires.join(' أو ') +').');
      }
    }catch(_){ deny('تعذر التحقق من الهوية.'); }
  }
  document.addEventListener('DOMContentLoaded', check);
})();
