(function(){
  const base = window.AUTH_API_BASE || '/api/auth';
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const btn = document.getElementById('btn-login');
  const msg = document.getElementById('login-msg');

  function setMessage(text, ok){
    msg.textContent = text;
    msg.style.color = ok ? '#2d8659' : '#c0392b';
  }

  async function login(){
    const identifier = userEl.value.trim();
    const password = passEl.value;
    if(!identifier || !password){
      setMessage('أدخل البيانات المطلوبة', false);return;
    }
    setMessage('... جار التحقق', true);
    try {
      const res = await fetch(base + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername: identifier, password })
      });
      let data = null;
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if(!res.ok){
        setMessage(data.message || 'فشل تسجيل الدخول', false);return;
      }
      setMessage('تم الدخول بنجاح', true);
      if(data.token){
        localStorage.setItem('auth_token', data.token);
      }
      const url = new URL(window.location.href);
      const next = url.searchParams.get('next');
      const fallback = (window.AFTER_LOGIN_URL || localStorage.getItem('AFTER_LOGIN_URL') || '/');
      const target = next || fallback;
      try { window.location.href = target; } catch(_) {}
    } catch(err){
      setMessage('خطأ في الاتصال', false);
    }
  }

  btn.addEventListener('click', login);
  passEl.addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
})();
