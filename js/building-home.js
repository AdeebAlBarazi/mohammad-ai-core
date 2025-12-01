(function(){
  const buildingCategories = new Set([
    'مواد البناء','مواد-البناء','building','construction','stone','marble','granite','tile','cement','sand','steel','wood','insulation','plumbing','electrical','tools'
  ]);
  const active = { sort:'newest', category:'stone' };
  let apiAttempts = 0;
  const maxAttempts = 12; // ~2 دقائق عند فاصل 10 ثوانٍ
  let retryTimer = null; let apiHealthy = false;

  async function fetchDeck(){
    apiAttempts += 1;
    try {
      const t0 = performance.now();
      const r = await Market.ProductsAPI.homeFeed({ limit: 24, include: 'media,vendor' });
      let items = Array.isArray(r.items)? r.items.slice() : [];
      // Prefer newest: if createdAt present, sort desc
      items.sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0));
      // Filter to building materials by category hint if present
      items = items.filter(it => {
        const c = (it.category || it.categoryId || '').toString().toLowerCase();
        if(!c) return true; // keep if unknown
        return Array.from(buildingCategories).some(k => c.includes(k));
      });
      const latency = Math.round(performance.now() - t0);
      apiHealthy = true;
      updateApiStatus(true, latency);
      return items;
    } catch(e){ apiHealthy = false; return []; }
  }

  function mktPrice(it){
    const val = Number(it.price||0);
    return (window.Market && Market.Format) ? Market.Format.currency(val) : (val.toFixed(2) + ' SAR');
  }

  function renderCard(item){
    const wrap = document.createElement('div');
    wrap.className = 'card';
    const img = document.createElement('img');
    img.src = (item.media && item.media[0] && (item.media[0].thumb || item.media[0].url)) || 'https://picsum.photos/seed/'+encodeURIComponent(item.sku||item.name)+'/120/120';
    const info = document.createElement('div');
    const t = document.createElement('div'); t.className='title'; t.textContent = item.name || item.sku || 'منتج';
    const p = document.createElement('div'); p.className='price'; p.textContent = mktPrice(item);
    info.appendChild(t); info.appendChild(p);
    wrap.appendChild(img); wrap.appendChild(info);
    wrap.addEventListener('click', ()=>{
      if(item.sku){
        try { Market.ProductsAPI.logClick({ sku: item.sku, price: item.price, hasMedia: !!(item.media&&item.media.length) }); } catch(_){ }
      }
      // navigate to product template if exists
      try { if(window.location){ window.location.href = './product.html?sku='+encodeURIComponent(item.sku||''); } } catch(_){ }
    });
    return wrap;
  }

  function populateSlots(deck){
    const slots = Array.from(document.querySelectorAll('.slot'));
    for(let i=0;i<slots.length;i++){
      const s = slots[i]; s.innerHTML='';
      const item = deck[i % deck.length];
      if(item){ s.appendChild(renderCard(item)); }
    }
  }

  function rotate(deck){
    if(deck.length<=6) return deck;
    const head = deck.splice(0,3); // move 3 from front to end
    deck.push(...head);
    return deck;
  }

  async function init(){
    if(!window.Market){ window.Market = {}; }
    try { if (window.Market && Market.Common && typeof Market.Common.whenReady==='function') { await Market.Common.whenReady(); } } catch(_){ }
    // Video fallback if local promo missing
    try {
      const v = document.getElementById('promoVideo');
      if(v){
        v.addEventListener('error', function(){
          try {
            v.src = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
            v.play().catch(function(){});
          } catch(_){}
        }, { once:true });
      }
    } catch(_){ }
    const deck = await fetchDeck();
    if(!deck.length){
      updateApiStatus(false);
      try {
        const host = document.getElementById('facetChips') || document.querySelector('.results');
        if(host){
          const warn = document.createElement('div');
          warn.style.cssText = 'padding:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,80,0,.15);border-radius:10px;color:#ffd9c7;font-size:14px;margin-bottom:12px;';
          warn.textContent = 'تعذر تحميل المنتجات (الخادم غير متصل أو عنوان API غير صحيح). تأكد من تشغيل خدمة السوق على المنفذ 3002.';
          host.parentNode.insertBefore(warn, host);
        }
      } catch(_){}
      scheduleRetry();
      return;
    }
    populateSlots(deck);
    setInterval(()=>{ populateSlots(rotate(deck)); }, 15000);
    try {
      if (window.Market && Market.Products && typeof Market.Products.setQuery === 'function') {
        // افتراضي: أحدث منتجات الحجر/الرخام ضمن مواد البناء
        Market.Products.setQuery(Object.assign({}, active));
      }
    } catch(_){}
    try { await buildFacetChips(); } catch(_){ }
  }

  document.addEventListener('DOMContentLoaded', init);

  async function fetchFacets(params){
    try {
      const q = Object.assign({ page:1, limit: 1, mode:'facets' }, params||{});
      const res = await Market.ProductsAPI.search(q);
      return (res && res.meta && res.meta.facets) ? res.meta.facets : null;
    } catch(e){ return null; }
  }

  function applyFilters(){
    const q = Object.assign({}, active);
    // Map form + color to search terms
    const terms = [];
    if(active.form) terms.push(active.form);
    if(active.color_family) terms.push(active.color_family);
    if(terms.length) q.search = terms.join(' ');
    if(active.material) q.material = active.material;
    if(active.thickness_mm){ q.thickness = active.thickness_mm; }
    try { Market.Products.setQuery(q); } catch(_){ }
  }

  function chipEl(text, pressed){
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'chip'; el.setAttribute('aria-pressed', pressed?'true':'false');
    el.textContent = text; return el;
  }

  async function buildFacetChips(){
    const host = document.getElementById('facetChips'); if(!host) return;
    host.innerHTML = '';
    const facets = await fetchFacets(active); if(!facets) return;
    const groups = [
      { key:'material', label:'المادة', max: 8 },
      { key:'form', label:'الأشكال', max: 8 },
      { key:'color_family', label:'الألوان', max: 8 },
      { key:'thickness_mm', label:'السماكة', max: 8 }
    ];
    function addClear(){
      const c = chipEl('مسح الفلاتر', false); c.classList.add('clear');
      c.addEventListener('click', ()=>{ delete active.form; delete active.color_family; delete active.thickness_mm; delete active.material; applyFilters(); buildFacetChips(); });
      host.appendChild(c);
    }
    addClear();
    for(const g of groups){
      const map = facets[g.key] || {};
      // Sort by count desc
      const entries = Object.keys(map).filter(Boolean).map(k=>({k, c: map[k]})).sort((a,b)=> b.c - a.c).slice(0, g.max);
      for(const e of entries){
        const label = g.key==='thickness_mm' ? (parseInt(e.k,10)+' مم') : e.k;
        const pressed = String(active[g.key]||'').toLowerCase() === String(e.k).toLowerCase();
        const el = chipEl(label + ' · ' + e.c, pressed);
        el.addEventListener('click', ()=>{
          if(pressed){ delete active[g.key]; }
          else { active[g.key] = (g.key==='thickness_mm') ? (parseInt(e.k,10)||undefined) : e.k; }
          applyFilters(); buildFacetChips();
        });
        host.appendChild(el);
      }
    }
  }

  function updateApiStatus(ok, latency){
    try {
      const el = document.getElementById('apiStatus');
      if(!el) return;
      if(ok){
        const latTxt = (typeof latency === 'number') ? ` • ${latency}ms` : '';
        el.textContent = `✅ متصل${latTxt}`;
        el.classList.remove('err'); el.classList.add('ok');
      } else {
        el.textContent = `⚠️ غير متصل (محاولة ${apiAttempts})`;
        el.classList.remove('ok'); el.classList.add('err');
      }
    } catch(_){ }
  }

  function scheduleRetry(){
    if(apiHealthy) return;
    if(apiAttempts >= maxAttempts) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(attemptFetch, 10000); // 10 ثوانٍ
  }

  async function attemptFetch(){
    if(apiHealthy) return;
    const deck = await fetchDeck();
    if(deck.length){
      populateSlots(deck);
      setInterval(()=>{ populateSlots(rotate(deck)); }, 15000);
      try { if (window.Market && Market.Products && typeof Market.Products.setQuery === 'function') { Market.Products.setQuery(Object.assign({}, active)); } } catch(_){ }
      try { await buildFacetChips(); } catch(_){ }
    } else {
      updateApiStatus(false);
      scheduleRetry();
    }
  }

  // السماح بنقرة على الشارة لإعادة المحاولة فوراً
  document.addEventListener('DOMContentLoaded', ()=>{
    const el = document.getElementById('apiStatus');
    if(el){ el.style.cursor='pointer'; el.title='انقر لإعادة المحاولة'; el.addEventListener('click', ()=>{ if(!apiHealthy) attemptFetch(); }); }
  });
})();
