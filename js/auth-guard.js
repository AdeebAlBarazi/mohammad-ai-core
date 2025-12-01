(function(){
  async function check(){
    try{
      const r = await fetch('/api/market/auth/me');
      const j = await r.json();
      if(!j || !j.authenticated){ block(); }
    }catch(_){ block(); }
  }
  function block(){
    const root = document.body;
    const overlay = document.createElement('div');
    overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.background='rgba(255,255,255,0.95)'; overlay.style.zIndex='9999'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center';
    overlay.innerHTML = '<div style="text-align:center;border:1px solid #eee;background:#fff;padding:16px 20px;border-radius:8px;max-width:440px;">\n<h3>غير مصرح</h3>\n<p style="color:#555">يجب تسجيل الدخول للوصول إلى هذه الصفحة.</p>\n<div style="margin-top:8px;display:flex;gap:8px;justify-content:center;">\n<a class="btn btn-primary" href="../auth/public/login.html">تسجيل الدخول</a>\n<a class="btn" href="marketplace-index.html">العودة للرئيسية</a>\n</div>\n</div>';
    root.appendChild(overlay);
  }
  document.addEventListener('DOMContentLoaded', check);
})();
