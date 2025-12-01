// systems/marketplace/js/admin-seller-requests.js
(function(w){
  const Common = (w.Market && w.Market.Common) || { apiUrl:(p)=>p };
  const $ = (id)=>document.getElementById(id);
  const qs = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
  function setMsg(t){ const c = document.querySelector('#msg'); if(c) c.textContent = t||''; }
  function api(path, opt){ return fetch(Common.apiUrl(path), Object.assign({ headers:{'Accept':'application/json','Content-Type':'application/json'}}, opt||{})).then(async r=>({ ok:r.ok, status:r.status, body: await r.json().catch(()=>({})) })); }
  function specName(id){ const specs = w.__specs||[]; const f = specs.find(s=>s.id===id); return f?f.name:''; }

  function render(items){
    const list = $('list');
    if(!list) return;
    if(!items || !items.length){ list.innerHTML = '<div class="muted">لا توجد بيانات.</div>'; return; }
    list.innerHTML = items.map(it=>{
      const verified = [(it.phone_verified?'📞':''),(it.email_verified?'✉️':'')].filter(Boolean).join(' ');
      const bank = `<div class="bank">${(it.bank_name||'-')} · ${(it.bank_account||'-')}<br/>IBAN: ${(it.iban||'-')}${it.swift?(' · SWIFT: '+it.swift):''}</div>`;
      return `<div class="card" data-id="${it.id}">
        <div class="row" style="margin-bottom:8px;">
          <div><strong>طلب: ${it.id}</strong><div class="muted">${new Date(it.created_at||Date.now()).toLocaleString()}</div></div>
          <div style="text-align:left;">المستخدم: ${it.user_id}</div>
        </div>
        <div class="row">
          <div>التخصص: ${specName(it.specialization_id)||'-'}</div>
          <div>التحقق: ${verified||'-'}</div>
        </div>
        <div style="margin:8px 0;">${bank}</div>
        <div class="row" style="align-items:center;">
          <div>الحالة: <span class="badge ${it.status==='pending'?'warn':(it.status==='approved'?'ok':'error')}">${it.status}</span></div>
          <div style="text-align:left;" class="actions">
            <button class="btn btn-primary" data-act="approve" ${it.status!=='pending'?'disabled':''}>اعتماد</button>
            <button class="btn" data-act="reject" ${it.status!=='pending'?'disabled':''}>رفض</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  async function loadSpecs(){ const r = await api('/market/specializations'); w.__specs = (r.body && r.body.items)||[]; }

  async function fetchList(){
    setMsg('جاري التحميل...');
    const activeTab = document.querySelector('.tab.active');
    let status = (activeTab && activeTab.getAttribute('data-status')) || 'pending';
    if(status==='all') status='';
    const r = await api('/market/admin/seller-requests'+(status?`?status=${encodeURIComponent(status)}`:''));
    if(r.ok){
      let items = r.body.items || [];
      const q = ($('search') && $('search').value.trim()) || '';
      if(q){ const ql = q.toLowerCase(); items = items.filter(x => (x.user_id||'').toLowerCase().includes(ql) || (x.iban||'').toLowerCase().includes(ql) || (x.bank_account||'').toLowerCase().includes(ql)); }
      render(items);
      setMsg('');
    } else { setMsg('فشل التحميل: '+(r.status||'')); }
  }

  async function act(id, action){
    if(action==='approve'){
      const r = await api(`/market/admin/seller-requests/${id}/approve`, { method:'POST' });
      if(r.ok){ setMsg('تم الاعتماد'); fetchList(); } else { setMsg('تعذر الاعتماد'); }
    } else if(action==='reject'){
      const reason = w.prompt('سبب الرفض (اختياري)') || '';
      const r = await api(`/market/admin/seller-requests/${id}/reject`, { method:'POST', body: JSON.stringify({ reason }) });
      if(r.ok){ setMsg('تم الرفض'); fetchList(); } else { setMsg('تعذر الرفض'); }
    }
  }

  function wire(){
    const tabs = qs('.tab');
    tabs.forEach(t=> t.addEventListener('click', ()=>{ tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); fetchList(); }));
    const refresh = $('refresh'); if(refresh) refresh.addEventListener('click', fetchList);
    const search = $('search'); if(search) search.addEventListener('input', ()=>{ fetchList(); });
    document.body.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-act]'); if(!btn) return; const card = e.target.closest('[data-id]'); if(!card) return; act(card.getAttribute('data-id'), btn.getAttribute('data-act'));
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    try { if(Common && Common.whenReady) await Common.whenReady(); } catch(_){ }
    await loadSpecs();
    wire();
    fetchList();
  });
})(window);
