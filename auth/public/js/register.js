(function(){
  const base = window.AUTH_API_BASE || '/api/auth';
  const nameEl = document.getElementById('reg-name');
  const emailEl = document.getElementById('reg-email');
  const userEl = document.getElementById('reg-username');
  const passEl = document.getElementById('reg-pass');
  const btn = document.getElementById('btn-register');
  const msg = document.getElementById('reg-msg');

  function setMessage(text, ok){
    msg.textContent = text;
    msg.style.color = ok ? '#2d8659' : '#c0392b';
  }

  async function register(){
    const fullName = nameEl.value.trim();
    const email = emailEl.value.trim();
    const username = userEl.value.trim();
    const password = passEl.value;
    if(!fullName || !email || !username || !password){
      setMessage('أدخل كل الحقول', false);return;
    }
    setMessage('... جار الإنشاء', true);
    try {
      const payload = { fullName, email, username, password, userType: 'buyer' };
      const res = await fetch(base + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data = null;
      const text = await res.text();
      try { data = JSON.parse(text); } catch { data = { message: text }; }
      if(!res.ok){
        setMessage(data.message || 'فشل التسجيل', false);return;
      }
      setMessage('تم التسجيل بنجاح، يمكنك تسجيل الدخول الآن', true);
      setTimeout(()=>{ window.location.href='login.html'; }, 1200);
    } catch(err){
      setMessage('خطأ في الاتصال', false);
    }
  }

  btn.addEventListener('click', register);
  passEl.addEventListener('keydown', e=>{ if(e.key==='Enter') register(); });
})();
