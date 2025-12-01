// Local copy (trimmed) of market-products.js for systems/marketplace
(function (w) {
    const Common = (w.Market && w.Market.Common) || { fetchJSON: async () => ({ ok: false }), apiUrl: (x) => x, authHeader: () => ({}) };
    const params = (()=>{ try { return new URLSearchParams(location.search); } catch(_) { return new URLSearchParams(''); } })();
    const DEBUG_VIEWS = (params.get('debug')||'').includes('views') || (function(){ try { return localStorage.getItem('MP_DEBUG_VIEWS') === '1'; } catch(_) { return false; } })();
    const state = { page: 1, limit: 20, q: '', sort: 'newest', total: 0, totalPages: 1, category: '', priceMin: '', priceMax: '', ratingMin: '' };
    const Templates = {
        escape(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); },
        card(item) {
            const name = item.name || item.sku || 'منتج';
            const sku = item.sku || '';
            const price = (item.price != null ? item.price : '—');
            const media = Array.isArray(item.media) ? item.media : [];
            const fallbackSeed = encodeURIComponent(String(sku || name));
            const img = (media[0] && (media[0].thumb || media[0].url)) || `https://picsum.photos/seed/${fallbackSeed}/320/240`;
            const vendor = (item.vendor && (item.vendor.displayName || item.vendor.companyName || item.vendor.name))
                || item.vendorId || item.vendorCode || (typeof item.vendor === 'string' ? item.vendor : '') || '';
            const imgDiv = img ? `<div class="card-image" style="background-image:url('${Templates.escape(img)}')"></div>` : `<div class="card-image placeholder">لا صورة</div>`;
            const desc = item.seoTitle || item.description || '';
            const badge = item._isNew ? `<span class="badge-new">جديد</span>` : '';
            return `
                <div class="market-card" data-sku="${Templates.escape(sku)}">
                    ${badge}
                    ${imgDiv}
                    <div class="card-body">
                        <h3 class="card-title">${Templates.escape(name)}</h3>
                        ${desc ? `<div class="card-desc">${Templates.escape(desc)}</div>` : ''}
                        <div class="card-meta">
                            <span class="meta-price">${Templates.escape(price)} SAR</span>
                            ${vendor ? `<span class="meta-vendor">البائع: ${Templates.escape(vendor)}</span>` : ''}
                        </div>
                        <button class="btn add-to-cart" data-sku="${Templates.escape(sku)}">أضف للسلة</button>
                    </div>
                </div>`;
        },
        skeleton(n = 8) {
            return Array.from({ length: n }).map(() => `
                <div class="market-card skeleton-card">
                  <div class="card-image"></div>
                  <div class="card-body">
                    <div class="skeleton line"></div>
                    <div class="skeleton line short"></div>
                    <div class="skeleton line tiny"></div>
                  </div>
                </div>`).join('');
        }
    };
    function qs(o) { return '?' + Object.keys(o).filter(k => o[k] != null && o[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&'); }
    const Products = {
        _observer: null,
        _inView: Object.create(null),
        _viewTimers: Object.create(null),
        _viewed: new Set(),
        _debugViewsEnabled: false,
        setDebugViews(enabled){
            this._debugViewsEnabled = !!enabled;
            try { localStorage.setItem('MP_DEBUG_VIEWS', this._debugViewsEnabled ? '1':'0'); } catch(_){ }
            if (this._debugViewsEnabled) this._applyDebugMarks(); else this._clearDebugMarks();
        },
        _applyDebugMarks(){ try { if (!this._viewed) return; for (const sku of this._viewed.values()) { this._markViewedDebug(sku); } } catch(_){} },
        _clearDebugMarks(){
            try {
                const grid = document.getElementById('market-grid'); if (!grid) return;
                grid.querySelectorAll('.market-card.debug-viewed').forEach(card => {
                    card.classList.remove('debug-viewed');
                    const b = card.querySelector('.debug-badge'); if (b) b.remove();
                });
            } catch(_){}
        },
        _ensureObserver() {
            if (this._observer) return this._observer;
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const el = entry.target;
                    const sku = el && el.getAttribute && el.getAttribute('data-sku') || '';
                    if (!sku || this._viewed.has(sku)) return;
                    const ratio = (typeof entry.intersectionRatio === 'number') ? entry.intersectionRatio : 0;
                    if (entry.isIntersecting && ratio >= 0.5) {
                        this._inView[sku] = true;
                        if (!this._viewTimers[sku]) {
                            this._viewTimers[sku] = setTimeout(() => {
                                if (this._inView[sku] && !this._viewed.has(sku)) {
                                    this._logViewOnce(sku, 2000);
                                }
                                clearTimeout(this._viewTimers[sku]);
                                delete this._viewTimers[sku];
                            }, 2000);
                        }
                    } else {
                        this._inView[sku] = false;
                        if (this._viewTimers[sku]) { clearTimeout(this._viewTimers[sku]); delete this._viewTimers[sku]; }
                    }
                });
            }, { threshold: [0, 0.5, 1] });
            this._observer = obs; return obs;
        },
                _modal: {
                        el: null,
                    _openAt: 0,
                    _openSku: '',
                        open(item) {
                                if (!this.el) this.el = this._ensure();
                                this._render(item);
                                this.el.style.display = 'flex';
                                document.body.style.overflow = 'hidden';
                        this._openAt = Date.now();
                        this._openSku = item && item.sku || '';
                        },
                        close() {
                                if (!this.el) return;
                                this.el.style.display = 'none';
                                document.body.style.overflow = '';
                        try {
                            if (this._openSku) {
                                const dwell = Math.max(0, Date.now() - (this._openAt||Date.now()));
                                Products._logViewOnce(this._openSku, dwell);
                            }
                        } catch(_){}
                        this._openAt = 0; this._openSku = '';
                        },
                        _ensure() {
                                const overlay = document.createElement('div');
                                overlay.className = 'modal-overlay';
                                overlay.setAttribute('role', 'dialog');
                                overlay.setAttribute('aria-modal', 'true');
                                overlay.style.display = 'none';
                                overlay.innerHTML = `
                                    <div class=\"modal-content modal-large\">
                                        <span id=\"pm-badge\" class=\"badge-new\" style=\"display:none\">جديد</span>
                                        <button class="modal-close-btn" type="button" aria-label="إغلاق">✕</button>
                                        <div class="product-modal-body">
                                            <div class="product-images">
                                                <div class="image-main" id="pm-image-main"></div>
                                                <div class="image-thumbs" id="pm-image-thumbs"></div>
                                            </div>
                                            <div class="product-info">
                                                <h2 id="pm-title" class="card-title"></h2>
                                                <div class="product-meta">
                                                    <div class="price" id="pm-price"></div>
                                                    <div class="material" id="pm-material"></div>
                                                </div>
                                                <div class="seller-info" id="pm-vendor"></div>
                                                <div class="product-description" id="pm-desc"></div>
                                                <div class="product-actions">
                                                    <button id="pm-add" class="btn btn-primary">أضف للسلة</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>`;
                                overlay.addEventListener('click', (e) => {
                                        if (e.target === overlay) this.close();
                                });
                                document.addEventListener('keydown', (e) => {
                                        if (e.key === 'Escape') this.close();
                                });
                                overlay.querySelector('.modal-close-btn').addEventListener('click', () => this.close());
                                document.body.appendChild(overlay);
                                return overlay;
                        },
                        _render(item) {
                                const el = this.el; if (!el) return;
                                const name = item.name || item.sku || 'منتج';
                                const price = (item.price != null ? item.price + ' SAR' : '—');
                                const material = item.material ? ('الخامة: ' + item.material) : '';
                                const vendor = (item.vendor && (item.vendor.displayName || item.vendor.companyName || item.vendor.name))
                                        || item.vendorId || item.vendorCode || (typeof item.vendor === 'string' ? item.vendor : '') || '';
                                const media = Array.isArray(item.media) ? item.media : [];
                                const seed = encodeURIComponent(String(item.sku || name));
                                const primaryUrl = (media[0] && (media[0].url || media[0].thumb)) || `https://picsum.photos/seed/${seed}/800/600`;
                                    // Reset observer state for new render
                                    if (Products._observer) { try { Products._observer.disconnect(); } catch(_){} }
                                    Products._inView = Object.create(null);
                                    Products._viewTimers = Object.create(null);
                                    grid.innerHTML = enriched.map(Templates.card).join('');

                                const main = el.querySelector('#pm-image-main');
                                main.innerHTML = `<img src="${Templates.escape(primaryUrl)}" alt="${Templates.escape(name)}" />`;
                                const thumbsEl = el.querySelector('#pm-image-thumbs');
                                thumbsEl.innerHTML = thumbs.map((m, i) => `<img class="thumb" data-idx="${i}" src="${Templates.escape(m.thumb || m.url)}" alt="${Templates.escape(name)} ${i+1}"/>`).join('');
                                thumbsEl.querySelectorAll('.thumb').forEach(img => {
                                        img.addEventListener('click', (ev) => {
                                                const i = parseInt(ev.currentTarget.getAttribute('data-idx') || '0', 10);
                                                const m = thumbs[i];
                                                const url = m && (m.url || m.thumb) || primaryUrl;
                                    // Observe cards for scroll-based views (>=50% visible for 2s)
                                    const obs = Products._ensureObserver();
                                    grid.querySelectorAll('.market-card').forEach(card => {
                                        const sku = card.getAttribute('data-sku') || '';
                                        if (sku && !Products._viewed.has(sku)) { try { obs.observe(card); } catch(_){} }
                                    });
                                                main.innerHTML = `<img src="${Templates.escape(url)}" alt="${Templates.escape(name)}" />`;
                                        });
                                });
                                el.querySelector('#pm-title').textContent = name;
                                el.querySelector('#pm-price').textContent = price;
                                el.querySelector('#pm-material').textContent = material;
                                el.querySelector('#pm-vendor').textContent = vendor ? ('البائع: ' + vendor) : '';
                                el.querySelector('#pm-desc').textContent = item.seoTitle || item.description || '';
                                async _logViewOnce(sku, dwellMs){
                                    try {
                                        if (!sku) return;
                                        if (!this._viewed) this._viewed = new Set();
                                        if (this._viewed.has(sku)) return;
                                        this._viewed.add(sku);
                                        await this._logView(sku, dwellMs);
                                    } catch(_){}
                                },
                                const badge = el.querySelector('#pm-badge');
                                if (badge) {
                                    badge.style.display = item._isNew ? 'inline-block' : 'none';
                                }
                                    try { this._markViewedDebug(sku); } catch(_){ }
                                const add = el.querySelector('#pm-add');
                                add.onclick = () => { try { Products.addToCart(item.sku); } finally { this.close(); } };
                        }
                            _markViewedDebug(sku){
                                if (!(DEBUG_VIEWS || this._debugViewsEnabled)) return;
                                const grid = document.getElementById('market-grid'); if (!grid) return;
                                const card = grid.querySelector(`.market-card[data-sku="${CSS.escape(String(sku))}"]`);
                                if (!card) return;
                                if (!card.classList.contains('debug-viewed')) {
                                    card.classList.add('debug-viewed');
                                    const badge = document.createElement('span');
                                    badge.className = 'debug-badge';
                                    badge.textContent = 'VIEWED';
                                    card.appendChild(badge);
                                }
                            },
                },
        async fetch() {
            const grid = document.getElementById('market-grid');
            if (grid) grid.innerHTML = Templates.skeleton(Math.min(state.limit, 12));
            const baseParams = {
                page: state.page,
                limit: state.limit,
                expand: 'media,vendor',
                mediaFields: 'thumb,basic'
            };
            const noFilters = (!state.q && !state.category && state.page === 1);
            // Prefer home-feed when no filters to get interest-tuned mix
            if (noFilters) {
                const j = await Common.fetchJSON('/market/home-feed' + qs(baseParams));
                if (!j || j.ok === false) return { items: [], total: 0 };
                const items = Array.isArray(j.items) ? j.items : [];
                state.total = j.total || items.length;
                state.totalPages = Math.max(1, Math.ceil(state.total / state.limit));
                return { items };
            }
            // Otherwise use advanced search
            const params = Object.assign({}, baseParams, {
                sort: (state.sort === 'new' ? 'newest' : state.sort),
                q: state.q || undefined,
                category: state.category || undefined,
                priceMin: state.priceMin || undefined,
                priceMax: state.priceMax || undefined,
                rating_min: state.ratingMin || undefined
            });
            const j = await Common.fetchJSON('/market/search' + qs(params));
            if (!j || j.ok === false) return { items: [], total: 0 };
            const items = Array.isArray(j.items) ? j.items : [];
            state.total = j.total || items.length;
            state.totalPages = j.totalPages || Math.max(1, Math.ceil(state.total / state.limit));
            return { items };
        },
        render(items) {
            const grid = document.getElementById('market-grid');
            if (!grid) return;
            if (!items.length) { grid.innerHTML = '<div class="market-empty">لا توجد نتائج.</div>'; Products.updatePagination(0); return; }
            // compute "new" flag: createdAt within 30d; fallback: first 3 items on newest + page 1 when missing dates
            const now = Date.now();
            const THIRTY_D = 30*24*60*60*1000;
            const enriched = items.map((it, idx) => {
                let isNew = false;
                if (it && it.createdAt) {
                    const t = new Date(it.createdAt).getTime();
                    if (!Number.isNaN(t)) isNew = (now - t) <= THIRTY_D;
                }
                if (!isNew && !it.createdAt && (state.sort === 'newest') && state.page === 1 && idx < 3) {
                    isNew = true;
                }
                return Object.assign({}, it, { _isNew: isNew });
            });
            grid.innerHTML = enriched.map(Templates.card).join('');
            grid.querySelectorAll('.add-to-cart').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const sku = e.currentTarget.getAttribute('data-sku'); if (sku) Products.addToCart(sku); }));
            grid.querySelectorAll('.market-card').forEach((card, idx) => {
                card.addEventListener('click', () => {
                    const sku = card.getAttribute('data-sku') || '';
                    const item = enriched.find(x => String(x.sku||'') === sku) || null;
                    if (item) {
                        try { Products._logClick(item); } catch(_){}
                    }
                    if (item) Products._modal.open(item);
                });
            });
            Products.updatePagination(state.total);
        },
        async _logClick(item){
            try {
                const payload = { sku: item.sku, price: item.price, hasMedia: Array.isArray(item.media) && item.media.length>0 };
                await Common.fetchJSON('/market/interactions/click', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
            } catch(_){ }
        },
        async _logView(sku, dwellMs){
            try {
                const payload = { sku, dwellMs };
                await Common.fetchJSON('/market/interactions/view', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
            } catch(_){ }
        },
        updatePagination(total) {
            const prev = document.getElementById('prev-page');
            const next = document.getElementById('next-page');
            const cur = document.getElementById('current-page');
            const tot = document.getElementById('total-pages');
            const max = state.totalPages || Math.max(1, Math.ceil((total || 0) / (state.limit || 20)));
            if (cur) cur.textContent = String(state.page);
            if (tot) tot.textContent = String(max);
            if (prev) prev.disabled = state.page <= 1;
            if (next) next.disabled = state.page >= max;
            const pag = document.getElementById('market-pagination');
            if (pag) pag.style.display = total > 0 ? 'flex' : 'none';
        },
        readFilters() {
            const qEl = document.getElementById('search-text');
            state.q = (qEl && qEl.value.trim()) || '';
            const sortEl = document.getElementById('sort-select');
            if (sortEl && sortEl.value) state.sort = sortEl.value;
            const sizeEl = document.getElementById('page-size-select');
            const newLimit = sizeEl && parseInt(sizeEl.value, 10);
            if (!Number.isNaN(newLimit) && newLimit > 0) state.limit = newLimit;
            const catHeaderEl = document.getElementById('search-category');
            if (catHeaderEl && catHeaderEl.value) state.category = catHeaderEl.value;
            const ratingEl = document.getElementById('rating-min');
            if (ratingEl && ratingEl.value) state.ratingMin = ratingEl.value;
            const pmin = document.getElementById('price-min');
            const pmax = document.getElementById('price-max');
            state.priceMin = pmin && pmin.value ? pmin.value : '';
            state.priceMax = pmax && pmax.value ? pmax.value : '';
        },
        async addToCart(sku) {
            try {
                const j = await Common.fetchJSON('/market/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku, quantity: 1 }) });
                if (j && j.ok) { Products.status('أُضيف للسلة'); } else { Products.status('فشل الإضافة', true); }
            } catch (e) { Products.status('خطأ: ' + e.message, true); }
        },
        status(t, err) { const el = document.getElementById('market-status'); if (!el) return; el.style.color = err ? '#b02a37' : '#065f46'; el.textContent = t; setTimeout(() => { el.textContent = ''; el.style.color = ''; }, 2200); },
        async load() {
            const r = await Products.fetch();
            if (r.items.length === 0 && !state.q && !state.category && state.page === 1) {
                try {
                    const lastQ = (localStorage.getItem('MP_LAST_QUERY') || '').trim();
                    const lastCat = (localStorage.getItem('MP_LAST_CATEGORY') || '').trim();
                    state.sort = 'popular';
                    state.q = lastQ || '';
                    state.category = state.category || lastCat || '';
                    const f = await Products.fetch();
                    Products.render(f.items);
                    return;
                } catch (_) { /* ignore */ }
            }
            Products.render(r.items);
        },
        wire() {
            const applyTop = document.getElementById('apply-filters');
            const applySide = document.getElementById('apply-filters-side');
            const prev = document.getElementById('prev-page');
            const next = document.getElementById('next-page');
            function doApply() {
                Products.readFilters();
                try { localStorage.setItem('MP_LAST_QUERY', state.q || ''); localStorage.setItem('MP_LAST_CATEGORY', state.category || ''); } catch(_){}
                state.page = 1; Products.load();
            }
            applyTop && applyTop.addEventListener('click', doApply);
            applySide && applySide.addEventListener('click', doApply);
            prev && prev.addEventListener('click', () => { if (state.page > 1) { state.page--; Products.load(); } });
            next && next.addEventListener('click', () => { const max = state.totalPages || Math.max(1, Math.ceil((state.total || 0) / state.limit)); if (state.page < max) { state.page++; Products.load(); } });
        },
        init() { Products.readFilters(); Products.wire(); Products.load(); if (DEBUG_VIEWS) { Products.setDebugViews(true); } }
    };
    w.Market = w.Market || {}; w.Market.Products = Products;
})(window);
