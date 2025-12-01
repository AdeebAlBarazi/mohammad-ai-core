(function(){
  const elBody = () => document.getElementById('chatBody');
  const elInput = () => document.getElementById('chatInput');
  const elSend = () => document.getElementById('chatSend');

  const convo = {
    step: 0,
    ctx: {},
    prompts: [
      { key:'purpose', text:'مرحباً بك! ما هو طلبك؟ (مثال: رخام، إسمنت، حديد...)' },
      { key:'form', text:'ما الشكل أو الهيئة؟ (ألواح، مقاسات ستاندرد، بلوكات...)', when: (c)=>/رخام|جرانيت|حجر/i.test(c.purpose||'') },
      { key:'color', text:'ما الألوان المفضلة لديك؟ (أبيض، رمادي، بيج، أسود...)', when: (c)=>/رخام|جرانيت|حجر/i.test(c.purpose||'') },
      { key:'extras', text:'أي تفضيلات إضافية؟ (تشطيب، سماكة، بلد المنشأ...)' }
    ]
  };

  function pushMsg(txt, who){
    const d = document.createElement('div'); d.className = 'msg ' + (who||'bot'); d.textContent = txt; elBody().appendChild(d); elBody().scrollTop = elBody().scrollHeight;
  }

  function nextPrompt(){
    while(convo.step < convo.prompts.length){
      const p = convo.prompts[convo.step];
      if(!p.when || p.when(convo.ctx)){
        pushMsg(p.text, 'bot');
        // Try to hint with available facet options based on current context
        try { showFacetOptionsIfAny(p.key); } catch(_){}
        return;
      }
      convo.step++; // skip hidden step
    }
    // done
    finalize();
  }

  function finalize(){
    const q = buildQuery();
    pushMsg('حسناً، أبحث لك الآن...', 'bot');
    try {
      if(window.Market && Market.Products && Market.Products.setQuery){
        Market.Products.setQuery(Object.assign({ sort: 'newest' }, q));
      } else {
        // fallback: navigate to legacy index with query in URL
        const params = new URLSearchParams(Object.assign({ sort: 'newest' }, q)).toString();
        window.location.href = './marketplace-index.html?' + params;
      }
    } catch(_){}
  }

  function buildQuery(){
    const q = {};
    const purpose = (convo.ctx.purpose||'').toLowerCase();
    if(purpose.includes('رخام')){ q.category = 'stone'; q.search = 'marble'; }
    else if(purpose.includes('حجر')){ q.category = 'stone'; }
    else if(purpose.includes('جرانيت')){ q.category = 'stone'; q.search = 'granite'; }
    else if(purpose.includes('إسمنت')||purpose.includes('اسمنت')){ q.category = 'cement'; }
    else if(purpose.includes('حديد')){ q.category = 'steel'; }
    else if(purpose.includes('بلاط')||purpose.includes('سيراميك')){ q.category = 'tile'; }

    const form = (convo.ctx.form||'').toLowerCase();
    if(form.includes('ألواح')||form.includes('الواح')||form.includes('slab')){ q.search = ((q.search||'') + ' slab').trim(); }
    if(form.includes('مقاسات')||form.includes('standard')){ q.search = ((q.search||'') + ' tile').trim(); }

    const color = (convo.ctx.color||'').toLowerCase();
    if(color){ q.search = ((q.search||'') + ' ' + color).trim(); }

    return q;
  }

  async function fetchFacets(params){
    try {
      if(!(window.Market && Market.ProductsAPI && Market.ProductsAPI.search)) return null;
      const q = Object.assign({}, params||{}, { mode: 'facets' });
      const res = await Market.ProductsAPI.search(q);
      return (res && res.meta && res.meta.facets) ? res.meta.facets : null;
    } catch(_){ return null; }
  }

  async function showFacetOptionsIfAny(stepKey){
    const base = buildQuery();
    const facets = await fetchFacets(base);
    if(!facets) return;
    if(stepKey === 'form' && facets.form){
      const opts = Object.keys(facets.form).sort(function(a,b){ return (facets.form[b]||0)-(facets.form[a]||0); }).slice(0,6);
      if(opts.length) pushMsg('أشكال متاحة: ' + opts.join('، '), 'bot');
    }
    if(stepKey === 'color' && facets.color_family){
      const opts = Object.keys(facets.color_family).sort(function(a,b){ return (facets.color_family[b]||0)-(facets.color_family[a]||0); }).slice(0,6);
      if(opts.length) pushMsg('ألوان شائعة: ' + opts.join('، '), 'bot');
    }
    if(stepKey === 'extras' && facets.thickness_mm){
      const opts = Object.keys(facets.thickness_mm).map(function(x){ return parseInt(x,10); }).filter(function(n){ return !isNaN(n); }).sort(function(a,b){ return a-b; }).slice(0,6);
      if(opts.length) pushMsg('سماكات متاحة: ' + opts.map(function(n){ return n + ' مم'; }).join('، '), 'bot');
    }
  }

  function handleUserInput(){
    const v = elInput().value.trim(); if(!v) return; elInput().value=''; pushMsg(v,'user');
    const p = convo.prompts[convo.step]; if(p){ convo.ctx[p.key] = v; convo.step++; nextPrompt(); } else { finalize(); }
  }

  function init(){
    const send = elSend(); const input = elInput();
    send.addEventListener('click', handleUserInput);
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ handleUserInput(); }});
    // greet and start
    pushMsg('أهلاً بك في سوق مواد البناء 👋', 'bot');
    nextPrompt();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
