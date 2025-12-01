(() => {
  // Configurable API base: prefer window.AUTH_API_BASE or localStorage.AUTH_API_BASE
  const configuredBase = (window.AUTH_API_BASE || localStorage.getItem('AUTH_API_BASE') || '').trim();
  const apiBase = configuredBase || '/api/auth';
  const $ = (id) => document.getElementById(id);
  const show = (el, v) => el.style.display = v ? '' : 'none';

  const tabLogin = $('tab-login');
  const tabRegister = $('tab-register');
  const panelLogin = $('panel-login');
  const panelRegister = $('panel-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    show(panelLogin, true); show(panelRegister, false);
  });
  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    show(panelLogin, false); show(panelRegister, true);
  });

  $('btn-login').addEventListener('click', async () => {
    const emailOrUsername = $('login-user').value.trim();
    const password = $('login-pass').value;
    const msg = $('login-msg'); msg.textContent = '';
    try {
      const res = await fetch(`${apiBase}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailOrUsername, password }) });
      let data = null;
      const ct = res.headers.get('content-type') || '';
      if(ct.includes('application/json')){ data = await res.json(); }
      else { const txt = await res.text(); throw new Error(`استجابة غير متوقعة (${res.status})`); }
      if (!res.ok) throw new Error(data.error || 'خطأ');
      msg.textContent = 'تم تسجيل الدخول'; msg.className = 'msg ok';
      localStorage.setItem('auth_token', data.token);
    } catch (e) {
      msg.textContent = e.message; msg.className = 'msg err';
    }
  });

  $('btn-register').addEventListener('click', async () => {
    const fullName = $('reg-name').value.trim();
    const email = $('reg-email').value.trim();
    const username = $('reg-username').value.trim();
    const userType = $('reg-type').value;
    const password = $('reg-pass').value;
    const msg = $('reg-msg'); msg.textContent = '';
    try {
      // quick availability check
      const av = await fetch(`${apiBase}/check-availability?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}`);
      const avCt = av.headers.get('content-type')||''; if(!avCt.includes('application/json')){ throw new Error('استجابة غير متوقعة'); }
      const avData = await av.json();
      if (!avData.emailAvailable) throw new Error('البريد مستخدم');
      if (!avData.usernameAvailable) throw new Error('اسم المستخدم مستخدم');

      const res = await fetch(`${apiBase}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, email, username, userType, password }) });
      const rCt = res.headers.get('content-type')||''; if(!rCt.includes('application/json')){ throw new Error(`استجابة غير متوقعة (${res.status})`); }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطأ');
      msg.textContent = 'تم التسجيل بنجاح'; msg.className = 'msg ok';
      localStorage.setItem('auth_token', data.token);
    } catch (e) {
      msg.textContent = e.message; msg.className = 'msg err';
    }
  });
})();
