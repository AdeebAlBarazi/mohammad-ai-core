// Extended Projects overrides (schema support)
// Integrated API fetch override
(function(){
  // Safe storage wrapper - completely silent, no localStorage access if blocked
  let storageEnabled = false;
  let storageCache = {}; // In-memory fallback
  
  // Check once without triggering warnings
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
  
  // Resolve API base dynamically (supports auto-port fallback 3001 -> 3002)
  let apiBase = null;
  // Retry / backoff state
  const retryState = {
    attempts: 0,
    maxAttempts: 8,
    nextDelay: 5000,
    lastFailureTs: 0,
    baseCooldownMs: 2500
  };
  const apiCandidates = [
    typeof window!=='undefined' && window.API_BASE ? window.API_BASE : null,
    'http://localhost:3001/api',
    'http://127.0.0.1:3001/api',
    'http://localhost:3002/api',
    'http://127.0.0.1:3002/api'
  ].filter(Boolean);

  async function fetchWithTimeout(resource, options={}){
    const { timeout = 2500 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(resource, { ...options, signal: controller.signal });
      return resp;
    } finally { clearTimeout(id); }
  }

  async function resolveApiBase(){
    // Cooldown after recent failure to avoid hammering
    const now = Date.now();
    if(retryState.lastFailureTs && (now - retryState.lastFailureTs) < retryState.baseCooldownMs){
      return apiBase || apiCandidates[0];
    }
    if(apiBase) return apiBase;
    for(const base of apiCandidates){
      try{
        const r = await fetchWithTimeout(`${base}/health`, { timeout: 1200 });
        if(r.ok){ apiBase = base; return apiBase; }
      }catch(_){ /* try next */ }
    }
    // Keep null base but record failure (so caller can decide)
    retryState.lastFailureTs = Date.now();
    return apiBase || apiCandidates[0];
  }

  let projectsCache = null;
  let projectsFetchInFlight = null;

  async function fetchProjects(){
    if(projectsCache) return projectsCache;
    if(projectsFetchInFlight) return projectsFetchInFlight;
    projectsFetchInFlight = (async ()=>{
      try {
        const BASE = await resolveApiBase();
        const r = await fetch(`${BASE}/projects?limit=100`, { credentials: 'omit' });
        if(!r.ok) throw new Error('HTTP '+r.status);
        const data = await r.json();
        const items = data.projects || data.items || [];
        
        // If API returns empty, fallback to CMS content
        if(!items.length){
          const cmsList = Array.isArray(window.CMS_CONTENT?.projects) ? window.CMS_CONTENT.projects : [];
          projectsCache = cmsList;
          return cmsList;
        }
        
        projectsCache = items;
        // Persist cache
        safeStorage.setItem('PROJECTS_CACHE_V1', JSON.stringify({ ts: Date.now(), items }));
        return items;
      } catch(err){
        const errStr = String(err);
        const isConnRefused = /Failed to fetch|ERR_CONNECTION_REFUSED|NetworkError|abort/i.test(errStr);
        if(isConnRefused){
          apiBase = null; // force re-detection later
          retryState.lastFailureTs = Date.now();
          retryState.attempts++;
          // Compute next delay with exponential backoff capped at 60s
          if(retryState.attempts === 1){
            retryState.nextDelay = 4000;
          } else {
            retryState.nextDelay = Math.min(60000, Math.round(retryState.nextDelay * 1.6));
          }
          const remainingAuto = Math.max(0, retryState.maxAttempts - retryState.attempts);
          const autoRetryPlanned = remainingAuto > 0;
          const statusMsg = autoRetryPlanned
            ? `تعذر الاتصال بالخادم (محاولة ${retryState.attempts}/${retryState.maxAttempts}). إعادة المحاولة آلياً بعد ${(retryState.nextDelay/1000).toFixed(0)} ثوانٍ. <button class="projects-retry-btn">إعادة المحاولة الآن</button>`
            : `تعذر الاتصال بالخادم بعد ${retryState.attempts} محاولات. لن تتم إعادة المحاولة تلقائياً. <button class="projects-retry-btn">حاول الآن</button>`;
          showProjectsStatus(statusMsg, 'warning');
          if(autoRetryPlanned){
            setTimeout(()=>{
              projectsCache = null;
              fetchProjects().then(renderProjectsSafe);
            }, retryState.nextDelay);
          }
          // Manual retry binding
          setTimeout(()=>{
            const btn = document.querySelector('.projects-retry-btn');
            if(btn){
              btn.addEventListener('click',()=>{
                showProjectsStatus('محاولة اتصال جديدة...', 'info');
                apiBase = null;
                projectsCache = null;
                fetchProjects().then(renderProjectsSafe);
              }, { once: true });
            }
          }, 50);
        } else {
          // Non-network error (e.g., 4xx/5xx parsing issues)
          console.warn('[Projects API] fallback to CMS content', err);
        }
        // Try localStorage cache first
        let list=[];
        try {
          const raw=safeStorage.getItem('PROJECTS_CACHE_V1');
          if(raw){
            const parsed=JSON.parse(raw);
            if(parsed && Array.isArray(parsed.items)) list=parsed.items;
          }
        } catch(e){}
        if(!list.length){
          list=Array.isArray(window.CMS_CONTENT?.projects)?window.CMS_CONTENT.projects:[];
        }
        projectsCache = list;
        return list;
      } finally {
        projectsFetchInFlight=null;
      }
    })();
    return projectsFetchInFlight;
  }

  function showProjectsStatus(msg,type='info'){
    const grid=document.getElementById('projects-grid');
    if(!grid) return;
    grid.innerHTML=`<p class="projects-status projects-status-${type}">${msg}</p>`;
  }

  function renderProjectsSafe(){
    try { initProjects(); } catch(e){ console.error('renderProjectsSafe error', e); }
  }

  // ===============================
  // Projects Marquee with Manual Controls (NO AUTO-SCROLL)
  // ===============================
  function setupProjectsMarquee(grid){
    if(!grid || !grid.classList.contains('marquee')) return;
    
    let x = 0; // Current scroll position in pixels
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let scrollStart = 0;
    
    const prevBtn = document.querySelector('.projects-nav-prev');
    const nextBtn = document.querySelector('.projects-nav-next');
    
    // Calculate one card width + gap dynamically
    function getScrollAmount(){
      const card = grid.querySelector('.project-card');
      if(!card) return 340;
      const cardWidth = card.offsetWidth;
      const gap = parseInt(getComputedStyle(grid).gap) || 32;
      return cardWidth + gap;
    }
    
    // Get half width for seamless loop (cards are duplicated)
    function getHalfWidth(){
      return grid.scrollWidth / 2;
    }
    
    // Update the transform
    function updateTransform(animate = true){
      if(animate){
        grid.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      } else {
        grid.style.transition = 'none';
      }
      grid.style.transform = `translateX(${x}px)`;
    }
    
    // Check and fix infinite loop seamlessly
    function checkLoop(){
      const halfWidth = getHalfWidth();
      
      if(x <= -halfWidth){
        // Reached end, jump back to start instantly
        grid.style.transition = 'none';
        x = 0;
        grid.style.transform = `translateX(${x}px)`;
      } else if(x >= 0){
        // Went past start, jump to end instantly
        grid.style.transition = 'none';
        x = -halfWidth + 1;
        grid.style.transform = `translateX(${x}px)`;
      }
    }
    
    // Arrow buttons - PREV goes LEFT, NEXT goes RIGHT
    if(prevBtn){
      prevBtn.addEventListener('click', () => {
        const scrollAmount = getScrollAmount();
        x -= scrollAmount; // Move left (show next items)
        updateTransform(true);
        setTimeout(checkLoop, 550);
      });
    }
    
    if(nextBtn){
      nextBtn.addEventListener('click', () => {
        const scrollAmount = getScrollAmount();
        x += scrollAmount; // Move right (show previous items)
        updateTransform(true);
        setTimeout(checkLoop, 550);
      });
    }
    
    // Drag to scroll
    grid.addEventListener('mousedown', (e) => {
      isDragging = true;
      hasMoved = false;
      startX = e.pageX;
      scrollStart = x;
      grid.style.cursor = 'grabbing';
      grid.style.userSelect = 'none';
      grid.style.transition = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const distance = Math.abs(e.pageX - startX);
      
      if (distance > 5) {
        hasMoved = true;
        e.preventDefault();
        const walk = (e.pageX - startX);
        x = scrollStart + walk;
        grid.style.transform = `translateX(${x}px)`;
        checkLoop();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        grid.style.cursor = 'grab';
        grid.style.userSelect = '';
        
        setTimeout(() => {
          hasMoved = false;
        }, 50);
      }
    });
    
    // Prevent click on cards if it was a drag
    grid.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    
    // Touch support
    let touchStartX = 0;
    let touchScrollStart = 0;
    let touchHasMoved = false;
    
    grid.addEventListener('touchstart', (e) => {
      isDragging = true;
      touchHasMoved = false;
      touchStartX = e.touches[0].pageX;
      touchScrollStart = x;
      grid.style.transition = 'none';
    }, { passive: true });
    
    grid.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const distance = Math.abs(e.touches[0].pageX - touchStartX);
      
      if (distance > 5) {
        touchHasMoved = true;
        const walk = (e.touches[0].pageX - touchStartX);
        x = touchScrollStart + walk;
        grid.style.transform = `translateX(${x}px)`;
        checkLoop();
      }
    }, { passive: true });
    
    grid.addEventListener('touchend', () => {
      isDragging = false;
      
      setTimeout(() => {
        touchHasMoved = false;
      }, 50);
    }, { passive: true });
    
    // Set initial state
    grid.style.cursor = 'grab';
    x = 0;
    updateTransform(false);
  }

  // Public API
  window.setupProjectsMarquee = setupProjectsMarquee;

  async function fetchProjectDetail(slug){
    try {
      const BASE = await resolveApiBase();
      const r = await fetch(`${BASE}/projects/${encodeURIComponent(slug)}`);
      if(!r.ok) throw new Error('detail fetch failed');
      const data = await r.json();
      return data;
    } catch(e){
      console.warn('[Projects API] detail fallback', e);
      // If network error, clear base to allow re-detection on next attempt
      if(/Failed to fetch|ERR_CONNECTION_REFUSED|NetworkError/i.test(String(e))){ apiBase = null; }
      
      // fallback search in cache or CMS
      const all = projectsCache || window.CMS_CONTENT?.projects || [];
      const found = all.find(p => p.slug === slug || p.id === slug);
      
      if (!found) {
        console.error('[Projects] Project not found:', slug);
        return null;
      }
      
      return found;
    }
  }

  async function initProjects(){
    const grid=document.getElementById('projects-grid');
    if(!grid)return;
    const lang=document.documentElement.getAttribute('lang')||'ar';
    showProjectsStatus('جاري تحميل المشاريع...', 'info');
    const list=await fetchProjects();
    if(!list.length){grid.innerHTML='<p class="no-projects" data-ar="لا توجد مشاريع حالياً" data-en="No projects available">لا توجد مشاريع حالياً</p>';return;}
    // If CMS has projects but list is empty (race when API + CMS load) retry once after short delay
    if(!list.length && window.CMS_CONTENT?.projects?.length){
      setTimeout(()=>{projectsCache=null;fetchProjects().then(renderProjectsSafe);},300);
      return;
    }
    const cards=list.map(p=>{
      const title=p.title?.[lang]||p.title?.ar||p.title||'';
      const shortDesc=p.short_description?.[lang]||p.short_description?.ar||p.short_description||p.description?.[lang]||p.description?.ar||p.description||'';
      const fullDesc=p.full_description?.[lang]||p.full_description?.ar||p.full_description||p.description?.[lang]||p.description?.ar||p.description||'';
      const category=p.category?.[lang]||p.category?.ar||p.category||'';
      const location=p.location?.[lang]||p.location?.ar||p.location||'';
      const year=p.year||p.start_date||'';
      const thumbnail=p.main_image_url||p.thumbnail||"data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='100%' height='100%' fill='%232c3b4c'/><text x='50%' y='50%' fill='%23ffffff' font-family='Arial' font-size='36' text-anchor='middle' dominant-baseline='middle'>Project</text></svg>";
      // Normalize leading slash for uploads (avoid missing root when served at /)
      const normalizedThumbnail =
        thumbnail.startsWith('/uploads/') ? thumbnail :
        (thumbnail.startsWith('uploads/') ? ('/' + thumbnail) : thumbnail);
      const role=p.role?.[lang]||p.role?.ar||p.role||'';
      const status=p.status||'';
      const client=p.client_name||'';
      const slug=p.slug||String(p.id||'').trim();
      const tags=Array.isArray(p.tags)?p.tags:[];
      return `<div class="project-card" data-project-id="${p.id}" data-project-slug="${slug}" data-project-role="${role}" data-project-status="${status}" data-project-client="${client}" data-project-tags="${tags.join(',')}">
        <div class="project-thumbnail">
          <img src="${normalizedThumbnail}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" data-original-src="${thumbnail}">
          <div class="project-overlay"></div>
          <span class="project-badge">${category}</span>
        </div>
        <div class="project-info">
          <h3 class="project-title">${title}</h3>
          <p class="project-description">${shortDesc}</p>
          <div class="project-meta">
            <span class="project-meta-item"><i class="fas fa-calendar"></i> ${year}</span>
            <span class="project-meta-item"><i class="fas fa-map-marker-alt"></i> ${location}</span>
          </div>
        </div>
      </div>`;
    }).join('');
    
    // Don't duplicate cards - Swiper handles looping
    grid.innerHTML = cards;
    
    // Add swiper-slide class to each card
    grid.querySelectorAll('.project-card').forEach(card => {
      card.classList.add('swiper-slide');
    });
    
    // Initialize Swiper if in marquee mode
    if(grid.classList.contains('marquee')){
      // Wait a bit for DOM to settle
      setTimeout(() => {
        if(typeof initProjectsSwiper === 'function') {
          initProjectsSwiper();
        }
      }, 100);
    }
    
    // If result still empty after rendering, show guidance
    if(!grid.children.length){
      showProjectsStatus('لا توجد مشاريع لعرضها حالياً. أضف مشاريع من لوحة التحكم ثم اضغط "حفظ التغييرات" أو "دفع إلى API".', 'info');
    }
    // Inject minimal styles if not present
    if(!document.getElementById('projects-status-styles')){
      const st=document.createElement('style');
      st.id='projects-status-styles';
      st.textContent='.projects-status{padding:1rem;text-align:center;font-size:.95rem;border:1px dashed var(--border-color);border-radius:8px;background:var(--secondary-bg);color:var(--text-secondary);}.projects-status-warning{color:var(--accent-orange);}.projects-retry-btn{margin-right:.5rem;padding:.4rem .8rem;background:var(--accent-blue);border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:.8rem;}.projects-retry-btn:hover{background:var(--accent-blue-hover);}';
      document.head.appendChild(st);
    }
    grid.querySelectorAll('.project-card').forEach((card, index)=>{
      const projectData = list[index % list.length]; // Get original data
      
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-project-slug');
        console.log('[Projects] Card clicked, slug:', slug);
        
        if (!slug) {
          console.error('[Projects] No slug found on card');
          return;
        }
        
        // Open immediately with cached data
        if(projectData){
          if(projectData.openMode === 'page'){
            window.location.href = `projects/${slug}.html`;
          } else {
            openProjectGallery(projectData);
          }
        } else {
          console.error('[Projects] No project data available');
          alert('عذراً، لا يمكن فتح تفاصيل المشروع');
        }
      });
    });

    // Debug instrumentation for image loading issues
    grid.querySelectorAll('.project-thumbnail img').forEach(img => {
      img.addEventListener('load',()=>{
        img.dataset.loaded='true';
        console.log('[ProjectImage] loaded', {src: img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight});
      });
      img.addEventListener('error',()=>{
        img.dataset.error='true';
        console.error('[ProjectImage] error', {src: img.src, original: img.getAttribute('data-original-src')});
        // Visual fallback border to highlight missing image
        img.style.display='none';
        const parent=img.closest('.project-thumbnail');
        if(parent){
          const fallback=document.createElement('div');
          fallback.className='project-image-fallback';
          fallback.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#fff;background:#2c3b4c;';
          fallback.textContent='صورة غير متاحة';
          parent.appendChild(fallback);
        }
      });
      // Force eager load for first few slides to avoid lazy delay confusion
      if(img.loading==='lazy' && img.closest('.project-card.swiper-slide-active')){
        img.loading='eager';
      }
    });

    // Prioritize first few images for faster visual feedback
    Array.from(grid.querySelectorAll('.project-thumbnail img')).slice(0,3).forEach(img=>{
      try { img.setAttribute('fetchpriority','high'); } catch{}
      try { img.loading = 'eager'; } catch{}
    });
  }

  function openProjectGallery(project){
    const lang=document.documentElement.getAttribute('lang')||'ar';
    const modal=document.getElementById('project-modal');
    if(!modal)return;
    const title=project.title?.[lang]||project.title?.ar||project.title||'';
    const desc=project.full_description?.[lang]||project.full_description?.ar||project.full_description||project.description?.[lang]||project.description?.ar||project.description||'';
    const category=project.category?.[lang]||project.category?.ar||project.category||'';
    const location=project.location?.[lang]||project.location?.ar||project.location||'';
    const year=project.year||project.start_date||'';
    const role=project.role?.[lang]||project.role?.ar||project.role||'';
    const status=project.status||'';
    const client=project.client_name||'';
    // Normalize gallery items: accept strings or objects {url,title,description}
    const galleryItems = Array.isArray(project.gallery) ? project.gallery.map(g=>{
      if(typeof g==='string') return { url: g, title: {}, description: {} };
      return g || { url: '', title: {}, description: {} };
    }).filter(g=>g.url) : [];
    document.getElementById('modal-project-title').textContent=title;
    document.getElementById('modal-project-category').textContent=category;
    document.getElementById('modal-project-year').textContent=year;
    document.getElementById('modal-project-location').textContent=location;
    const descEl=document.getElementById('modal-project-description');
    descEl.textContent=desc;
    if(role||status||client){
      const extraParts=[];
      if(role)extraParts.push(`الدور: ${role}`);
      if(client)extraParts.push(`العميل: ${client}`);
      if(status)extraParts.push(`الحالة: ${status}`);
      descEl.textContent=desc+"\n"+extraParts.join(' | ');
    }
    const galleryContainer=document.getElementById('gallery-container');
    const thumbnailsContainer=document.getElementById('gallery-thumbnails');
    galleryContainer.innerHTML=galleryItems.map((g,idx)=>`<div class="gallery-slide ${idx===0?'active':''}"><img src="${g.url}" alt="${title} - صورة ${idx+1}" loading="lazy" referrerpolicy="no-referrer"><div class="gallery-caption">${(g.title?.ar||g.title?.en||'')}</div></div>`).join('');
    thumbnailsContainer.innerHTML=galleryItems.map((g,idx)=>`<div class="gallery-thumb ${idx===0?'active':''}" data-index="${idx}"><img src="${g.url}" alt="Thumbnail ${idx+1}" loading="lazy" referrerpolicy="no-referrer"></div>`).join('');
    let currentIndex=0;
    function showSlide(i){const slides=galleryContainer.querySelectorAll('.gallery-slide');const thumbs=thumbnailsContainer.querySelectorAll('.gallery-thumb');slides.forEach((s,x)=>s.classList.toggle('active',x===i));thumbs.forEach((t,x)=>t.classList.toggle('active',x===i));currentIndex=i;}
    thumbnailsContainer.querySelectorAll('.gallery-thumb').forEach((thumb,idx)=>thumb.addEventListener('click',()=>showSlide(idx)));
    const prevBtn=modal.querySelector('.gallery-prev');
    const nextBtn=modal.querySelector('.gallery-next');
    prevBtn.onclick=()=>showSlide(currentIndex>0?currentIndex-1:galleryItems.length-1);
    nextBtn.onclick=()=>showSlide(currentIndex<galleryItems.length-1?currentIndex+1:0);
    function handleKeyboard(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const isRTL=document.documentElement.getAttribute('dir')==='rtl';const isNext=(e.key==='ArrowRight'&&!isRTL)||(e.key==='ArrowLeft'&&isRTL);if(isNext)nextBtn.click();else prevBtn.click();}else if(e.key==='Escape'){closeProjectGallery();}}
    document.addEventListener('keydown',handleKeyboard);modal.dataset.keyboardHandler='active';
    modal.classList.add('active');document.body.style.overflow='hidden';
    const closeBtn=modal.querySelector('.modal-close');closeBtn.onclick=closeProjectGallery;modal.querySelector('.modal-overlay').onclick=closeProjectGallery;
    function closeProjectGallery(){modal.classList.remove('active');document.body.style.overflow='';document.removeEventListener('keydown',handleKeyboard);delete modal.dataset.keyboardHandler;}
  }

  // Expose overrides
  window.initProjects=initProjects;
  window.openProjectGallery=openProjectGallery;

  // Re-init if data already loaded
  // نحافظ على التهيئة بعد تحميل CMS للأقسام الأخرى لكن المشاريع ستأتي من API
  if(document.readyState==='complete'){initProjects();}
})();
