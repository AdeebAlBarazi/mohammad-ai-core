// Admin Panel Script with simple front-end auth (static site limitation)
// =============================================
// NOTE: This is NOT strong security. Source is visible.
// For real protection use server-side auth / HTTP Basic / reverse proxy.

// Safe storage wrapper - completely silent
let storageEnabled = false;
let storageCache = {};

try {
  storageEnabled = typeof Storage !== 'undefined' && typeof localStorage === 'object';
} catch(e) {
  storageEnabled = false;
}

const safeStorage = {
  getItem(key) {
    if (!storageEnabled) return storageCache[key] || null;
    try { return localStorage.getItem(key); } catch(e) { return storageCache[key] || null; }
  },
  setItem(key, value) {
    if (!storageEnabled) { storageCache[key] = value; return; }
    try { localStorage.setItem(key, value); } catch(e) { storageCache[key] = value; }
  },
  removeItem(key) {
    if (!storageEnabled) { delete storageCache[key]; return; }
    try { localStorage.removeItem(key); } catch(e) { delete storageCache[key]; }
  }
};

const ADMIN_PASSWORD = 'Admin2025!'; // Fallback local password (غير آمن للنشر)
let API_BASE = window.API_BASE || 'http://localhost:3001/api';
async function ensureApiBase(){
  if(ensureApiBase._done) return API_BASE;
  const candidates=[API_BASE,'http://127.0.0.1:3001/api','http://localhost:3002/api','http://127.0.0.1:3002/api'];
  for(const base of candidates){
    try{
      const ctrl = (AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(1200) : undefined;
      const r = await fetch(base + '/health', { signal: ctrl });
      if(r.ok){ API_BASE = base; break; }
    }catch(_){ /* try next */ }
  }
  ensureApiBase._done = true; return API_BASE;
}
let ADMIN_API_TOKEN = safeStorage.getItem('ADMIN_API_TOKEN') || null;
const AUTH_KEY = 'ADMIN_AUTH_SESSION';
const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

function initAdminAuth() {
  const gate = document.getElementById('admin-auth-gate');
  if (!gate) { initAdminPanel(); return; }
  
  // Check if there's a valid session
  const session = safeStorage.getItem(AUTH_KEY);
  if (session) {
    const sessionData = JSON.parse(session);
    const now = Date.now();
    if (now < sessionData.expiry) {
      // Session still valid - extend it
      sessionData.expiry = now + SESSION_DURATION;
      safeStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
      gate.style.display = 'none';
      initAdminPanel();
      addLogoutButton();
      return;
    } else {
      // Session expired - remove it
      safeStorage.removeItem(AUTH_KEY);
    }
  }
  const form = document.getElementById('admin-login-form');
  const passInput = document.getElementById('admin-pass');
  const msg = document.getElementById('admin-auth-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entered = passInput.value.trim();
    const emailInput = document.getElementById('admin-email');
    const email = (emailInput && emailInput.value.trim()) || '';
    if (!entered) return;
    let authenticated = false;
    // Try API auth if email provided
    if (email) {
      try {
        await ensureApiBase();
        const resp = await fetch(API_BASE + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: entered })
        });
        if (resp.ok) {
          const data = await resp.json();
            if (data.token) {
              ADMIN_API_TOKEN = data.token;
              safeStorage.setItem('ADMIN_API_TOKEN', ADMIN_API_TOKEN);
              authenticated = true;
            }
        } else {
          const err = await resp.json().catch(()=>({error:'Auth error'}));
          msg.textContent = 'فشل دخول API: ' + (err.error || resp.status);
        }
      } catch (ex) {
        msg.textContent = 'تعذر الاتصال بالخادم';
      }
    }
    // Fallback local password if not authenticated via API
    if (!authenticated) {
      const ok = await verifyPassword(entered, ADMIN_PASSWORD);
      if (!ok) {
        msg.textContent = 'بيانات الدخول غير صحيحة';
        passInput.focus();
        return;
      }
      authenticated = true;
    }
    if (authenticated) {
      const sessionData = {
        authenticated: true,
        expiry: Date.now() + SESSION_DURATION,
        loginTime: new Date().toLocaleString('ar-EG'),
        api: !!ADMIN_API_TOKEN
      };
      safeStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
      gate.style.opacity = '1';
      gate.style.transition = 'opacity .4s';
      gate.style.opacity = '0';
      setTimeout(()=> { gate.remove(); initAdminPanel(); addLogoutButton(); if(ADMIN_API_TOKEN){ initApiProjectSync(); } }, 400);
    }
  });
}

async function verifyPassword(entered, actual) {
  // Hash both using SHA-256 then compare hex
  try {
    const [h1, h2] = await Promise.all([sha256Hex(entered), sha256Hex(actual)]);
    if (h1.length !== h2.length) return false;
    // Constant-time style compare
    let diff = 0;
    for (let i = 0; i < h1.length; i++) diff |= h1.charCodeAt(i) ^ h2.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b => b.toString(16).padStart(2,'0')).join('');
}

function addLogoutButton() {
  // Add logout button to navbar if not exists
  const navbar = document.querySelector('.nav-menu');
  if (!navbar || navbar.querySelector('#logout-btn')) return;
  
  const logoutItem = document.createElement('li');
  logoutItem.innerHTML = '<a href="#" id="logout-btn" class="nav-link" style="color: var(--accent-red, #ff6b6b);"><i class="fas fa-sign-out-alt"></i> تسجيل خروج</a>';
  navbar.appendChild(logoutItem);
  
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('هل تريد تسجيل الخروج من لوحة التحكم؟')) {
      safeStorage.removeItem(AUTH_KEY);
      location.reload();
    }
  });
}

function startSessionMonitor() {
  // Check session validity every minute
  setInterval(() => {
    const session = safeStorage.getItem(AUTH_KEY);
    if (!session) return;
    
    const sessionData = JSON.parse(session);
    const now = Date.now();
    const remaining = sessionData.expiry - now;
    
    if (remaining <= 0) {
      // Session expired
      safeStorage.removeItem(AUTH_KEY);
      alert('انتهت جلسة العمل. سيتم إعادة تحميل الصفحة.');
      location.reload();
    } else if (remaining <= 5 * 60 * 1000) { // 5 minutes remaining
      // Show warning
      const minutes = Math.ceil(remaining / 60000);
      console.log(`تنبيه: ستنتهي الجلسة خلال ${minutes} دقيقة`);
    }
  }, 60000); // Check every minute
}

// Panel logic extracted into function so we can call post-auth
function initAdminPanel(){
  const $ = (id) => document.getElementById(id);
  const state = { data: null, dirty: false };

  function showMsg(text, kind = 'info') {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('success','error','warning');
    if (kind === 'success') el.classList.add('success');
    else if (kind === 'error') el.classList.add('error');
    else if (kind === 'warning') el.classList.add('warning');
  }

  function setDirty(isDirty = true) {
    state.dirty = !!isDirty;
    if (state.dirty) showMsg('هناك تغييرات غير محفوظة', 'warning');
    else showMsg('كل التغييرات محفوظة', 'success');
  }

  async function loadContent() {
    try {
      // Unified source: root content.json; legacy path removed
      const res = await fetch('content.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      state.data = json;
      bindToForm(json);
      setDirty(false);
      showMsg('تم تحميل المحتوى الحالي.', 'success');
    } catch (e) {
      showMsg('تعذر تحميل المحتوى: ' + e.message, 'error');
    }
  }

  function bindToForm(data) {
    // Video
    setVal('video.url', data.video?.url || '');
    setVal('video.poster', data.video?.poster || '');
    setCheck('video.autoplay', data.video?.autoplay !== false);
    setCheck('video.muted', data.video?.muted !== false);
    setCheck('video.loop', data.video?.loop !== false);
    setCheck('video.background', data.video?.background !== false);

    // Hero
    setVal('hero.title.ar', data.hero?.title?.ar || '');
    setVal('hero.title.en', data.hero?.title?.en || '');
    setVal('hero.subtitle.ar', data.hero?.subtitle?.ar || '');
    setVal('hero.subtitle.en', data.hero?.subtitle?.en || '');
    setVal('hero.description.ar', data.hero?.description?.ar || '');
    setVal('hero.description.en', data.hero?.description?.en || '');

    // Sections
    const sec = data.sections || {};
    ['competencies','experience','education','contact'].forEach(s => {
      setVal(`sections.${s}.title.ar`, sec[s]?.title?.ar || '');
      setVal(`sections.${s}.title.en`, sec[s]?.title?.en || '');
      setVal(`sections.${s}.subtitle.ar`, sec[s]?.subtitle?.ar || '');
      setVal(`sections.${s}.subtitle.en`, sec[s]?.subtitle?.en || '');
    });

    // Certificates list
    renderCertificates(Array.isArray(data.certificates) ? data.certificates : []);
    // Projects list
    renderProjects(Array.isArray(data.projects)? data.projects : []);
  }

  function setVal(id, val) { const el = $(id); if (el) el.value = val; }
  function setCheck(id, val) { const el = $(id); if (el) el.checked = !!val; }

  function readForm() {
    const obj = JSON.parse(JSON.stringify(state.data || {}));

    obj.video = obj.video || {};
    obj.video.url = $("video.url").value.trim();
    obj.video.poster = $("video.poster").value.trim();
    obj.video.autoplay = $("video.autoplay").checked;
    obj.video.muted = $("video.muted").checked;
    obj.video.loop = $("video.loop").checked;
    obj.video.background = $("video.background").checked;

    obj.hero = obj.hero || {};
    obj.hero.title = {
      ar: $("hero.title.ar").value,
      en: $("hero.title.en").value,
    };
    obj.hero.subtitle = {
      ar: $("hero.subtitle.ar").value,
      en: $("hero.subtitle.en").value,
    };
    obj.hero.description = {
      ar: $("hero.description.ar").value,
      en: $("hero.description.en").value,
    };

    obj.sections = obj.sections || {};
    ['competencies','experience','education','contact'].forEach(s => {
      obj.sections[s] = obj.sections[s] || {};
      obj.sections[s].title = {
        ar: $("sections."+s+".title.ar").value,
        en: $("sections."+s+".title.en").value,
      };
      obj.sections[s].subtitle = {
        ar: $("sections."+s+".subtitle.ar").value,
        en: $("sections."+s+".subtitle.en").value,
      };
    });

    // Certificates
    obj.certificates = readCertificatesFromUI();
    // Projects
    obj.projects = readProjectsFromUI();

    return obj;
  }

  // Certificates UI
  function renderCertificates(list) {
    const container = document.getElementById('cert-list');
    if (!container) return;
    container.innerHTML = '';
    list.forEach((item, idx) => {
      container.appendChild(makeCertEditor(item, idx));
    });
    enableDragSort('#cert-list');
  }

  function makeCertEditor(item = {}, index = 0) {
    const wrap = document.createElement('div');
    wrap.className = 'competency-card drag-item';
    wrap.setAttribute('draggable','true');
    wrap.innerHTML = `
      <div class="card-content">
        <div style="display:flex; gap:.5rem; justify-content:space-between; align-items:center; margin-bottom:.5rem;">
          <div style="display:flex;align-items:center;gap:.5rem;">
            <span class="drag-handle" title="اسحب لإعادة الترتيب" style="cursor:grab;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;background:#1d2531;border:1px solid #364352;border-radius:6px;color:#6b7a8a;font-size:.9rem;">⋮⋮</span>
            <strong>شهادة #${index+1}</strong>
          </div>
          <div style="display:flex; gap:.35rem;">
            <button type="button" class="btn btn-secondary cert-move-up" title="تحريك لأعلى" style="padding:.4rem .6rem"><i class="fas fa-arrow-up"></i></button>
            <button type="button" class="btn btn-secondary cert-move-down" title="تحريك لأسفل" style="padding:.4rem .6rem"><i class="fas fa-arrow-down"></i></button>
            <button class="btn btn-secondary cert-preview" title="معاينة">معاينة</button>
            <button class="btn btn-secondary cert-remove" title="حذف"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem;">
          <div>
            <label>العنوان (ar)</label>
            <input type="text" class="c-title-ar" value="${escapeHtml(item.title?.ar || '')}">
          </div>
          <div>
            <label>Title (en)</label>
            <input type="text" class="c-title-en" value="${escapeHtml(item.title?.en || '')}">
          </div>
          <div>
            <label>الوصف (ar)</label>
            <input type="text" class="c-sub-ar" value="${escapeHtml(item.subtitle?.ar || '')}">
          </div>
          <div>
            <label>Subtitle (en)</label>
            <input type="text" class="c-sub-en" value="${escapeHtml(item.subtitle?.en || '')}">
          </div>
          <div>
            <label>السنة</label>
            <input type="text" class="c-year" value="${escapeHtml(item.year || '')}">
          </div>
          <div>
            <label>رابط الصورة</label>
            <input type="text" class="c-img" placeholder="https://.../image.jpg" value="${escapeHtml(item.imageUrl || '')}">
          </div>
          <div>
            <label>أيقونة FontAwesome</label>
            <input type="text" class="c-icon" placeholder="certificate / graduation-cap / server" value="${escapeHtml(item.icon || 'certificate')}">
          </div>
        </div>
        <div class="cert-preview-area" style="margin-top:.75rem; display:none;">
          <img style="max-width:100%; border-radius:8px; border:1px solid var(--border-color)" />
        </div>
      </div>
    `;

    const btnRemove = wrap.querySelector('.cert-remove');
    btnRemove?.addEventListener('click', () => {
      registerUndo('certificate', collectCertDataFromEditor(wrap), [...wrap.parentNode.children].indexOf(wrap));
      wrap.remove();
      setDirty(true);
    });

    const btnPrev = wrap.querySelector('.cert-preview');
    const imgInput = wrap.querySelector('.c-img');
    const prevArea = wrap.querySelector('.cert-preview-area');
    const prevImg = prevArea.querySelector('img');
    btnPrev?.addEventListener('click', () => {
      const url = imgInput.value.trim();
      if (!url) return;
      prevImg.src = url;
      prevArea.style.display = 'block';
    });

    // Move buttons & keyboard reorder
    wrap.querySelector('.cert-move-up')?.addEventListener('click',()=>moveCard(wrap,-1,'#cert-list'));
    wrap.querySelector('.cert-move-down')?.addEventListener('click',()=>moveCard(wrap,1,'#cert-list'));
    wrap.tabIndex=0;
    wrap.addEventListener('keydown',e=>{if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();moveCard(wrap,e.key==='ArrowUp'?-1:1,'#cert-list');}});
    return wrap;
  }

  function readCertificatesFromUI() {
    const nodes = Array.from(document.querySelectorAll('#cert-list .competency-card'));
    return nodes.map(node => ({
      title: {
        ar: node.querySelector('.c-title-ar')?.value || '',
        en: node.querySelector('.c-title-en')?.value || ''
      },
      subtitle: {
        ar: node.querySelector('.c-sub-ar')?.value || '',
        en: node.querySelector('.c-sub-en')?.value || ''
      },
      year: node.querySelector('.c-year')?.value || '',
      imageUrl: node.querySelector('.c-img')?.value || '',
      icon: node.querySelector('.c-icon')?.value || 'certificate'
    }));
  }

  // ===============================
  // Projects Management
  // ===============================
  function renderProjects(list){
    const container=document.getElementById('projects-list');
    if(!container) return;
    container.innerHTML='';
    list.forEach((item,idx)=>container.appendChild(makeProjectEditor(item,idx)));
    enableDragSort('#projects-list');
  }

  function makeProjectEditor(item={},index=0){
    const wrap=document.createElement('div');
    wrap.className='competency-card drag-item';
    wrap.setAttribute('draggable','true');
    // Gallery now supports metadata objects {url,title:{ar,en},description:{ar,en}}
    const galleryItems = Array.isArray(item.gallery) ? item.gallery : [];
    const galleryHTML = galleryItems.map((g,i)=>{
      if(typeof g === 'string'){
        return metadataRowTemplate({url:g,title:{ar:'',en:''},description:{ar:'',en:''}}, i);
      }
      return metadataRowTemplate(g,i);
    }).join('');
    wrap.innerHTML=`<div class="card-content">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.65rem;">
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span class="drag-handle" title="اسحب لإعادة الترتيب" style="cursor:grab;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;background:#1d2531;border:1px solid #364352;border-radius:6px;color:#6b7a8a;font-size:.9rem;">⋮⋮</span>
          <strong>مشروع #${index+1}</strong>
        </div>
        <div style="display:flex;gap:.35rem;">
          <button type="button" class="btn btn-secondary proj-move-up" title="تحريك لأعلى" style="padding:.4rem .6rem"><i class="fas fa-arrow-up"></i></button>
          <button type="button" class="btn btn-secondary proj-move-down" title="تحريك لأسفل" style="padding:.4rem .6rem"><i class="fas fa-arrow-down"></i></button>
          <button class="btn btn-secondary proj-toggle" aria-label="طي/فتح" title="عرض/إخفاء">إخفاء</button>
          <button class="btn btn-secondary proj-remove" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="proj-fields" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem;">
        <div><label>المعرف (id)</label><input type="text" class="p-id" value="${escapeHtml(item.id||'')}" placeholder="project-1"></div>
        <div><label>العنوان (ar)</label><input type="text" class="p-title-ar" value="${escapeHtml(item.title?.ar||'')}"></div>
        <div><label>Title (en)</label><input type="text" class="p-title-en" value="${escapeHtml(item.title?.en||'')}"></div>
        <div><label>الوصف (ar)</label><input type="text" class="p-desc-ar" value="${escapeHtml(item.description?.ar||'')}"></div>
        <div><label>Description (en)</label><input type="text" class="p-desc-en" value="${escapeHtml(item.description?.en||'')}"></div>
        <div><label>التصنيف (ar)</label><input type="text" class="p-cat-ar" value="${escapeHtml(item.category?.ar||'')}"></div>
        <div><label>Category (en)</label><input type="text" class="p-cat-en" value="${escapeHtml(item.category?.en||'')}"></div>
        <div><label>الموقع (ar)</label><input type="text" class="p-loc-ar" value="${escapeHtml(item.location?.ar||'')}"></div>
        <div><label>Location (en)</label><input type="text" class="p-loc-en" value="${escapeHtml(item.location?.en||'')}"></div>
        <div><label>السنة</label><input type="text" class="p-year" value="${escapeHtml(item.year||'')}"></div>
        <div><label>الصورة المصغرة (thumbnail)</label><input type="text" class="p-thumb" value="${escapeHtml(item.thumbnail||'')}"></div>
        <div style="grid-column:1/-1">
          <label>المعرض (صور متعددة مع بيانات)</label>
          <div class="p-gallery-wrapper" style="display:flex;flex-direction:column;gap:.5rem;">
            ${galleryHTML || '<div class="gallery-empty" style="font-size:.7rem;color:var(--text-secondary)">لا توجد صور في المعرض</div>'}
          </div>
          <button type="button" class="btn btn-secondary gallery-add" style="margin-top:.5rem;padding:.35rem .7rem;font-size:.7rem"><i class="fas fa-plus"></i> إضافة صورة للمعرض</button>
        </div>
      </div>
    </div>`;
    const btnRemove=wrap.querySelector('.proj-remove');
    btnRemove?.addEventListener('click',()=>{registerUndo('project',collectProjectDataFromEditor(wrap),[...wrap.parentNode.children].indexOf(wrap));wrap.remove();setDirty(true);});
    const btnToggle=wrap.querySelector('.proj-toggle');
    const fields=wrap.querySelector('.proj-fields');
    btnToggle?.addEventListener('click',()=>{
      const hidden=fields.style.display==='none';
      fields.style.display=hidden?'grid':'none';
      btnToggle.textContent=hidden?'إخفاء':'عرض';
    });
    // Move & keyboard reorder
    wrap.querySelector('.proj-move-up')?.addEventListener('click',()=>moveCard(wrap,-1,'#projects-list'));
    wrap.querySelector('.proj-move-down')?.addEventListener('click',()=>moveCard(wrap,1,'#projects-list'));
    wrap.tabIndex=0;
    wrap.addEventListener('keydown',e=>{if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();moveCard(wrap,e.key==='ArrowUp'?-1:1,'#projects-list');}});
    // Gallery add button
    const addBtn = wrap.querySelector('.gallery-add');
    const galleryContainer = wrap.querySelector('.p-gallery-wrapper');
    addBtn?.addEventListener('click',()=>{
      const idx = galleryContainer.querySelectorAll('.gallery-row').length;
      galleryContainer.insertAdjacentHTML('beforeend', metadataRowTemplate({url:'',title:{ar:'',en:''},description:{ar:'',en:''}}, idx));
      setDirty(true);
    });

    // Delegate remove inside gallery
    galleryContainer?.addEventListener('click',e=>{
      const rm = e.target.closest('.g-remove');
      if(rm){
        rm.closest('.gallery-row')?.remove();
        // reindex labels
        [...galleryContainer.querySelectorAll('.gallery-row')].forEach((row,i)=>{
          const lbl = row.querySelector('.g-index');
          if(lbl) lbl.textContent = 'صورة #' + (i+1);
        });
        setDirty(true);
      }
    });
    return wrap;
  }

  function readProjectsFromUI(){
    const nodes=Array.from(document.querySelectorAll('#projects-list .competency-card'));
    return nodes.map(node=>{
      const get=(sel)=>node.querySelector(sel)?.value.trim()||'';
      const galleryRows = node.querySelectorAll('.p-gallery-wrapper .gallery-row');
      const gallery = [...galleryRows].map(r=>({
        url: r.querySelector('.g-url')?.value.trim() || '',
        title: { ar: r.querySelector('.g-title-ar')?.value.trim() || '', en: r.querySelector('.g-title-en')?.value.trim() || '' },
        description: { ar: r.querySelector('.g-desc-ar')?.value.trim() || '', en: r.querySelector('.g-desc-en')?.value.trim() || '' }
      })).filter(g=>g.url);
      return {
        id:get('.p-id')||('project-'+Math.random().toString(36).slice(2,8)),
        title:{ar:get('.p-title-ar'),en:get('.p-title-en')},
        description:{ar:get('.p-desc-ar'),en:get('.p-desc-en')},
        category:{ar:get('.p-cat-ar'),en:get('.p-cat-en')},
        location:{ar:get('.p-loc-ar'),en:get('.p-loc-en')},
        year:get('.p-year'),
        thumbnail:get('.p-thumb'),
        gallery:gallery
      };
    });
  }

  function metadataRowTemplate(g,i){
    return `<div class="gallery-row" style="border:1px solid var(--border-color);padding:.6rem;border-radius:8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.5rem;font-size:.7rem;">
      <div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;">
        <strong class="g-index">صورة #${i+1}</strong>
        <button type="button" class="btn btn-secondary g-remove" style="padding:.25rem .55rem;font-size:.65rem"><i class="fas fa-times"></i></button>
      </div>
      <div><label>الرابط</label><input type="text" class="g-url" value="${escapeHtml(g.url||'')}" placeholder="https://.../img.jpg"></div>
      <div><label>عنوان (ar)</label><input type="text" class="g-title-ar" value="${escapeHtml(g.title?.ar||'')}"></div>
      <div><label>Title (en)</label><input type="text" class="g-title-en" value="${escapeHtml(g.title?.en||'')}"></div>
      <div><label>وصف (ar)</label><input type="text" class="g-desc-ar" value="${escapeHtml(g.description?.ar||'')}"></div>
      <div><label>Description (en)</label><input type="text" class="g-desc-en" value="${escapeHtml(g.description?.en||'')}"></div>
    </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  }

  function downloadJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDirty(false);
    showMsg('تم إنشاء ملف content.json. لا تنس استبداله في assets/data.', 'success');
  }

  async function saveWithFileSystemAPI(data) {
    if (!('showOpenFilePicker' in window)) {
      showMsg('المتصفح لا يدعم الحفظ المباشر. استخدم حفظ كملف JSON.', 'error');
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      setDirty(false);
      showMsg('تم الحفظ إلى الملف بنجاح.', 'success');
    } catch (e) {
      showMsg('أُلغي الحفظ أو حدث خطأ: ' + e.message, 'error');
    }
  }

  function wireEvents() {
    const btnLoad = document.getElementById('btn-load');
    const btnSaveDl = document.getElementById('btn-save-download');
    const btnSaveFs = document.getElementById('btn-save-fs');
    const btnSaveLocal = document.getElementById('btn-save-local');
    const btnSaveAll = document.getElementById('save-all-btn');
    const btnCertAdd = document.getElementById('cert-add');
    const btnProjectAdd = document.getElementById('project-add');
    const btnProjectsSyncApi = document.getElementById('projects-sync-api');
    const btnProjectsPushApi = document.getElementById('projects-push-api');
    const btnProjectCollapse = document.getElementById('project-collapse-toggle');
    const fileInput = document.getElementById('project-image-file');
    const btnUploadImage = document.getElementById('project-image-upload');
    const dbTestBtn = document.getElementById('db-test-btn');
    const dbApplyBtn = document.getElementById('db-apply-btn');
    const dbStatus = document.getElementById('db-switch-status');

    btnLoad?.addEventListener('click', loadContent);

    btnSaveDl?.addEventListener('click', () => {
      const data = readForm();
      downloadJSON(data);
    });

    btnSaveFs?.addEventListener('click', async () => {
      const data = readForm();
      await saveWithFileSystemAPI(data);
    });
    btnSaveLocal?.addEventListener('click',()=>{
      const data=readForm();
      safeStorage.setItem('CMS_CONTENT_DRAFT', JSON.stringify(data));
      showMsg('تم حفظ مسودة محلياً (المتصفح فقط).', 'success');
      setDirty(false);
    });
    // Unified save button: saves draft + pushes projects (if token) in one step
    btnSaveAll?.addEventListener('click', async ()=>{
      showMsg('جارٍ حفظ كل التغييرات...', 'info');
      const data = readForm();
      safeStorage.setItem('CMS_CONTENT_DRAFT', JSON.stringify(data));
      let stats=null;
      if(ADMIN_API_TOKEN){
        try { stats = await pushProjectsCollectStats(); } catch(e){ console.warn('Unified save push error', e); }
      }
      showMsg('تم الحفظ '+(stats?`(جديد:${stats.created} محدّث:${stats.updated} محذوف:${stats.deleted} فشل:${stats.failed})`:'(محلي فقط)'), 'success');
      setDirty(false);
    });

    btnCertAdd?.addEventListener('click', () => {
      const list = document.getElementById('cert-list');
      list?.appendChild(makeCertEditor({ title:{ar:'',en:''}, subtitle:{ar:'',en:''}, year:'', imageUrl:'', icon:'certificate' }, (list?.children.length||0)));
      setDirty(true);
    });
    btnProjectAdd?.addEventListener('click',()=>{
      const list=document.getElementById('projects-list');
      list?.appendChild(makeProjectEditor({id:'',title:{ar:'',en:''},description:{ar:'',en:''},category:{ar:'',en:''},location:{ar:'',en:''},year:'',thumbnail:'',gallery:[]},(list?.children.length||0)));
      setDirty(true);
    });
    btnProjectsSyncApi?.addEventListener('click',()=>{
      syncProjectsFromAPI();
    });
    btnProjectsPushApi?.addEventListener('click',()=>{
      pushProjectsToAPI();
    });
    btnProjectCollapse?.addEventListener('click',()=>{
      const cards=document.querySelectorAll('#projects-list .competency-card .proj-fields');
      let anyVisible=Array.from(cards).some(c=>c.style.display!=='none');
      cards.forEach(c=>{c.style.display=anyVisible?'none':'grid';});
      setDirty(false); // does not modify data
    });

    // Image upload logic
    btnUploadImage?.addEventListener('click', async ()=>{
      if(!ADMIN_API_TOKEN){ alert('سجل دخول API أولاً'); return; }
      if(!fileInput?.files?.length){ alert('اختر ملف صورة أولاً'); return; }
      const f = fileInput.files[0];
      const formData = new FormData();
      formData.append('image', f);
      try {
        await ensureApiBase();
        const resp = await fetch(API_BASE + '/upload/image', { method:'POST', headers:{ 'Authorization':'Bearer '+ADMIN_API_TOKEN }, body: formData });
        const data = await resp.json();
        if(!resp.ok){ throw new Error(data.error || 'فشل الرفع'); }
        // Put URL into focused project thumbnail if possible
        let targetInput = document.activeElement && document.activeElement.closest('.competency-card')?.querySelector('.p-thumb');
        if(!targetInput){
          // fallback: first project card
          targetInput = document.querySelector('#projects-list .competency-card .p-thumb');
        }
        if(targetInput){ targetInput.value = data.url; setDirty(true); }
        alert('تم الرفع بنجاح: '+ data.url);
      } catch(err){
        alert('خطأ رفع الصورة: '+ err.message);
      }
    });

    // DB switch logic
    async function dbCall(testOnly){
      if(!ADMIN_API_TOKEN){ alert('سجل دخول API أولاً'); return; }
      const uriInput = document.getElementById('db-new-uri');
      const mongoUri = uriInput?.value.trim();
      if(!mongoUri){ alert('أدخل mongo uri'); return; }
      dbStatus.textContent = testOnly? 'جارٍ اختبار الاتصال...' : 'جارٍ التبديل...';
      try {
        await ensureApiBase();
        const resp = await fetch(API_BASE + '/admin/db-config', { method:'POST', headers:{ 'Content-Type':'application/json','Authorization':'Bearer '+ADMIN_API_TOKEN }, body: JSON.stringify({ mongoUri, testOnly }) });
        const data = await resp.json();
        if(!resp.ok){ throw new Error(data.error || 'فشل'); }
        dbStatus.textContent = testOnly? 'نجح الاختبار ✅' : 'تم التبديل ✅';
      } catch(err){
        dbStatus.textContent = 'خطأ: '+ err.message;
      }
    }
    dbTestBtn?.addEventListener('click', ()=> dbCall(true));
    dbApplyBtn?.addEventListener('click', ()=> dbCall(false));

    // Track unsaved changes on all inputs/controls
    const dirtyHandler = (e) => {
      const t = e.target;
      if (!t) return;
      const tag = (t.tagName||'').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setDirty(true);
      }
    };
    document.body.addEventListener('input', dirtyHandler, true);
    document.body.addEventListener('change', dirtyHandler, true);

    // Auto-load once when page opens
    loadContent();
    // offerDraftRestore(); // Removed - function not implemented
  }

  // ===============================
  // Drag & Drop Sorting (Projects & Certificates)
  // ===============================
  function enableDragSort(selector){
    const container=document.querySelector(selector);
    if(!container) return;
    let draggingEl=null; let startIndex=null;
    container.addEventListener('dragstart',e=>{
      const target=e.target.closest('.drag-item');
      if(!target) return; draggingEl=target; startIndex=[...container.children].indexOf(target);
      target.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
    });
    container.addEventListener('dragend',e=>{
      if(!draggingEl) return; draggingEl.classList.remove('dragging'); draggingEl=null; renumber(container,selector);
    });
    container.addEventListener('dragover',e=>{
      if(!draggingEl) return; e.preventDefault();
      const after=getDragAfterElement(container,e.clientY);
      if(after==null){
        container.appendChild(draggingEl);
      }else{
        container.insertBefore(draggingEl,after);
      }
    });
    function getDragAfterElement(parent,y){
      const els=[...parent.querySelectorAll('.drag-item:not(.dragging)')];
      let closest=null; let closestOffset=Number.NEGATIVE_INFINITY;
      els.forEach(el=>{
        const box=el.getBoundingClientRect();
        const offset=y-box.top-box.height/2;
        if(offset<0 && offset>closestOffset){closestOffset=offset; closest=el;}
      });
      return closest;
    }
    function renumber(parent,sel){
      const certMode=sel==='#cert-list';
      [...parent.children].forEach((card,i)=>{
        const strong=card.querySelector('strong');
        if(strong){strong.textContent=(certMode?'شهادة #':'مشروع #')+(i+1);} });
      setDirty(true);
    }
  }

  // Push projects (manual button) using shared stats function
  async function pushProjectsToAPI(){
    if(!ADMIN_API_TOKEN){
      alert('لا يوجد توكن API. سجل الدخول أولاً بإيميل الخادم.');
      return;
    }
    const projects = readProjectsFromUI();
    if(!projects.length){
      alert('لا توجد مشاريع لدفعها.');
      return;
    }
    const stats = await pushProjectsCollectStats(projects, true);
    alert('اكتملت المزامنة:\nجديد: '+stats.created+'\nمحدّث: '+stats.updated+'\nمحذوف: '+stats.deleted+'\nفشل حذف: '+stats.deleteFailed+'\nفشل إنشاء/تحديث: '+stats.failed);
    setDirty(false);
  }

  // Internal reusable push logic returning stats (used by unified save and manual push)
  async function pushProjectsCollectStats(preProvidedProjects=null, confirmDelete=false){
    if(!ADMIN_API_TOKEN){ return { created:0, updated:0, deleted:0, deleteFailed:0, failed:0 }; }
    const projects = preProvidedProjects || readProjectsFromUI();
    if(!projects.length){ return { created:0, updated:0, deleted:0, deleteFailed:0, failed:0 }; }
    let remoteSlugs = [];
    try {
      await ensureApiBase();
      const res = await fetch(API_BASE + '/projects?limit=500', { headers:{ 'Authorization':'Bearer '+ADMIN_API_TOKEN } });
      if(res.ok){
        const json = await res.json();
        remoteSlugs = (json.items||[]).map(p=>p.slug).filter(Boolean);
      }
    } catch(_){ }
    const localSlugs = projects.map(p => (p.id || p.title.ar || p.title.en || '').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60));
    const toDelete = remoteSlugs.filter(s => !localSlugs.includes(s));
    let deleted=0; let deleteFailed=0;
    if(toDelete.length && (!confirmDelete || confirm('سيتم حذف '+toDelete.length+' مشروع من الخادم غير موجود محلياً. متابعة؟'))){
      for(const slug of toDelete){
        try {
          const resp = await fetch(API_BASE + '/projects/' + slug, { method:'DELETE', headers:{ 'Authorization':'Bearer '+ADMIN_API_TOKEN } });
          if(resp.ok) deleted++; else deleteFailed++;
        } catch(e){ deleteFailed++; }
      }
    }
    let created=0, updated=0, failed=0;
    for(const proj of projects){
      const slug = (proj.id || proj.title.ar || proj.title.en || 'proj')
        .toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60);
      const payload = {
        slug,
        title: proj.title,
        short_description: proj.description,
        full_description: proj.description,
        role: { ar:'', en:'' },
        location: proj.location,
        start_date: proj.year ? proj.year+'-01-01' : undefined,
        status: 'planned',
        main_image_url: proj.thumbnail,
        gallery: proj.gallery,
        tags: proj.category.ar ? [proj.category.ar] : []
      };
      try {
        await ensureApiBase();
        let resp = await fetch(API_BASE + '/projects', {
          method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+ADMIN_API_TOKEN }, body: JSON.stringify(payload)
        });
        if(resp.status === 409){
          resp = await fetch(API_BASE + '/projects/' + slug, {
            method:'PUT', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+ADMIN_API_TOKEN }, body: JSON.stringify(payload)
          });
          if(resp.ok) updated++; else failed++;
        } else if(resp.ok){ created++; } else { failed++; }
      } catch(e){ failed++; }
    }
    return { created, updated, deleted, deleteFailed, failed };
  }
  // Hook into removal (modify existing remove handlers by delegation)
  document.addEventListener('click',e=>{
    const removeBtn=e.target.closest('.cert-remove,.proj-remove');
    if(removeBtn){incrementDeleteWarning();}
  },true);
  // ===============================
  // Undo Delete + Data Collectors + Move Utility
  // ===============================
  let lastDeleted=null; // {type,data,index}
  function registerUndo(type,data,index){lastDeleted={type,data,index};showUndoBanner();}
  function showUndoBanner(){let bar=document.getElementById('undo-banner');if(!bar){bar=document.createElement('div');bar.id='undo-banner';bar.style.cssText='position:fixed;bottom:20px;right:20px;background:#1d2531;border:1px solid #364352;padding:.75rem 1rem;border-radius:10px;display:flex;align-items:center;gap:.75rem;z-index:1200;box-shadow:0 6px 18px rgba(0,0,0,.4);font-size:.85rem;';bar.innerHTML='<span>تم حذف عنصر. تراجع؟</span><button id="undo-btn" class="btn btn-secondary" style="padding:.45rem .9rem;font-size:.75rem;">تراجع</button><button id="undo-dismiss" class="btn btn-secondary" style="padding:.45rem .9rem;font-size:.75rem;">إخفاء</button>';document.body.appendChild(bar);bar.querySelector('#undo-dismiss').onclick=()=>{bar.remove();};}bar.style.display='flex';bar.querySelector('#undo-btn').onclick=()=>performUndo();}
  function performUndo(){if(!lastDeleted)return;const {type,data,index}=lastDeleted;if(type==='certificate'){const list=document.getElementById('cert-list');if(list){const el=makeCertEditor(data,index);const ref=list.children[index]||null;list.insertBefore(el,ref);renumberAll(list,'certificate');}}else if(type==='project'){const list=document.getElementById('projects-list');if(list){const el=makeProjectEditor(data,index);const ref=list.children[index]||null;list.insertBefore(el,ref);renumberAll(list,'project');}}lastDeleted=null;const bar=document.getElementById('undo-banner');if(bar)bar.remove();setDirty(true);} 
  function renumberAll(parent,type){[...parent.children].forEach((card,i)=>{const strong=card.querySelector('strong');if(strong)strong.textContent=(type==='certificate'?'شهادة #':'مشروع #')+(i+1);});}
  function collectCertDataFromEditor(node){return {title:{ar:node.querySelector('.c-title-ar')?.value||'',en:node.querySelector('.c-title-en')?.value||''},subtitle:{ar:node.querySelector('.c-sub-ar')?.value||'',en:node.querySelector('.c-sub-en')?.value||''},year:node.querySelector('.c-year')?.value||'',imageUrl:node.querySelector('.c-img')?.value||'',icon:node.querySelector('.c-icon')?.value||'certificate'};}
  function collectProjectDataFromEditor(node){const get=sel=>node.querySelector(sel)?.value.trim()||'';const galleryRaw=get('.p-gallery');const gallery=galleryRaw?galleryRaw.split(/\n+/).map(s=>s.trim()).filter(Boolean):[];return {id:get('.p-id'),title:{ar:get('.p-title-ar'),en:get('.p-title-en')},description:{ar:get('.p-desc-ar'),en:get('.p-desc-en')},category:{ar:get('.p-cat-ar'),en:get('.p-cat-en')},location:{ar:get('.p-loc-ar'),en:get('.p-loc-en')},year:get('.p-year'),thumbnail:get('.p-thumb'),gallery:gallery};}
  function moveCard(card,delta,containerSel){const parent=document.querySelector(containerSel);if(!parent)return;const children=[...parent.children];const idx=children.indexOf(card);if(idx<0)return;const newIndex=idx+delta;if(newIndex<0||newIndex>=children.length)return;if(delta<0){parent.insertBefore(card,children[newIndex]);}else{parent.insertBefore(card,children[newIndex].nextSibling);}const isCert=containerSel==='#cert-list';[...parent.children].forEach((c,i)=>{const strong=c.querySelector('strong');if(strong)strong.textContent=(isCert?'شهادة #':'مشروع #')+(i+1);});setDirty(true);card.focus();}

  wireEvents();
  startSessionMonitor();

  // Warn user on page leave when there are unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}

document.addEventListener('DOMContentLoaded', initAdminAuth);

// ===============================
// API Projects Integration
// ===============================
function initApiProjectSync(){
  // Auto-fetch projects from API once if token exists
  if(ADMIN_API_TOKEN){
    setTimeout(()=>syncProjectsFromAPI(),500);
  }
}

async function syncProjectsFromAPI(){
  if(!ADMIN_API_TOKEN){
    alert('لا يوجد توكن API. سجل الدخول بإيميل وكلمة مرور المستخدم في الخادم.');
    return;
  }
  try {
    await ensureApiBase();
    const res = await fetch(API_BASE + '/projects?limit=100', { headers:{ 'Authorization':'Bearer ' + ADMIN_API_TOKEN } });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const json = await res.json();
    const items = json.items || [];
    // Map API shape to panel shape
    const mapped = items.map(p=>({
      id: p.slug,
      title: p.title || {ar:'',en:''},
      description: { ar: p.short_description?.ar || '', en: p.short_description?.en || '' },
      category: { ar: (p.tags && p.tags[0]) || '', en: (p.tags && p.tags[0]) || '' },
      location: { ar: p.location?.ar || '', en: p.location?.en || '' },
      year: p.start_date ? (new Date(p.start_date).getFullYear().toString()) : '',
      thumbnail: p.main_image_url || '',
      gallery: []
    }));
    renderProjects(mapped);
    const statusEl = document.getElementById('save-status');
    statusEl && (statusEl.textContent = 'تم جلب المشاريع من الخادم ('+mapped.length+')');
    setDirty(false);
  } catch(err){
    alert('فشل جلب المشاريع من API: '+ err.message);
  }
}

async function pushProjectsToAPI(){
  if(!ADMIN_API_TOKEN){
    alert('لا يوجد توكن API. سجل الدخول أولاً بإيميل الخادم.');
    return;
  }
  const projects = readProjectsFromUI();
  if(!projects.length){
    alert('لا توجد مشاريع لدفعها.');
    return;
  }
  // احضر قائمة الـ slugs الحالية في الخادم لتحديد ما تم حذفه محلياً
  let remoteSlugs = [];
  try {
    await ensureApiBase();
    const res = await fetch(API_BASE + '/projects?limit=500', { headers:{ 'Authorization':'Bearer '+ADMIN_API_TOKEN } });
    if(res.ok){
      const json = await res.json();
      remoteSlugs = (json.items||[]).map(p=>p.slug).filter(Boolean);
    }
  } catch(_){}
  const localSlugs = projects.map(p => (p.id || p.title.ar || p.title.en || '').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60));
  const toDelete = remoteSlugs.filter(s => !localSlugs.includes(s));
  let deleted=0; let deleteFailed=0;
  if(toDelete.length){
    if(!confirm('سيتم حذف '+toDelete.length+' مشروع من الخادم غير موجود محلياً. متابعة؟')) return;
    for(const slug of toDelete){
      try {
        const resp = await fetch(API_BASE + '/projects/' + slug, { method:'DELETE', headers:{ 'Authorization':'Bearer '+ADMIN_API_TOKEN } });
        if(resp.ok) deleted++; else deleteFailed++;
      } catch(e){ deleteFailed++; }
    }
  }
  let created=0, updated=0, failed=0;
  for(const proj of projects){
    // Prepare API payload
    const slug = (proj.id || proj.title.ar || proj.title.en || 'proj')
      .toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60);
    const payload = {
      slug,
      title: proj.title,
      short_description: proj.description,
      full_description: proj.description,
      role: { ar:'', en:'' },
      location: proj.location,
      start_date: proj.year ? proj.year+'-01-01' : undefined,
      status: 'planned',
      main_image_url: proj.thumbnail,
      gallery: proj.gallery,
      tags: proj.category.ar ? [proj.category.ar] : []
    };
    try {
      // Try create; if conflict update
      await ensureApiBase();
      let resp = await fetch(API_BASE + '/projects', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+ADMIN_API_TOKEN },
        body: JSON.stringify(payload)
      });
      if(resp.status === 409){
        resp = await fetch(API_BASE + '/projects/' + slug, {
          method:'PUT',
          headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+ADMIN_API_TOKEN },
          body: JSON.stringify(payload)
        });
        if(resp.ok) updated++; else failed++;
      } else if(resp.ok){
        created++;
      } else {
        failed++;
      }
    } catch(e){
      failed++;
    }
  }
  alert('اكتملت المزامنة:\nجديد: '+created+'\nمحدّث: '+updated+'\nمحذوف: '+deleted+'\nفشل حذف: '+deleteFailed+'\nفشل إنشاء/تحديث: '+failed);
  setDirty(false);
}
