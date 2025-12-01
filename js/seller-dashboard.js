// Copy of root js/seller-dashboard.js for organized structure under systems/seller/js

(function () {
    function getToken() { try { return (window.getAxiomToken && window.getAxiomToken()) || localStorage.getItem('axiomUserToken') || ''; } catch (_) { return ''; } }
    function hdrs(json = true) { const t = getToken(); const h = json ? { 'Accept': 'application/json', 'Content-Type': 'application/json' } : { 'Accept': 'application/json' }; if (t) h['Authorization'] = 'Bearer ' + t; return h; }

    const tabsEl = document.getElementById('seller-tabs');
    const contentEl = document.getElementById('tab-content');
    if (!tabsEl || !contentEl) {
        try {
            console.warn('[seller-dashboard] Missing required containers (#seller-tabs or #tab-content).');
        } catch (_) { }
        return;
    }
    let activeTab = 'overview';
    let stPage = 1, stLimit = 20, stTotal = 0;

    const modules = {
        overview: async () => {
            const html = `<div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
        <div class="stat-box" data-k="sales" style="background:#065f46;color:#ecfdf5;padding:12px;border-radius:10px;">
          <div style="font-size:12px;opacity:.85">إجمالي المبيعات (تجريبي)</div>
          <strong style="font-size:20px;">--</strong>
        </div>
        <div class="stat-box" data-k="orders" style="background:#1e3a8a;color:#dbeafe;padding:12px;border-radius:10px;">
          <div style="font-size:12px;opacity:.85">الطلبات</div>
          <strong style="font-size:20px;">--</strong>
        </div>
        <div class="stat-box" data-k="products" style="background:#7c2d12;color:#ffedd5;padding:12px;border-radius:10px;">
          <div style="font-size:12px;opacity:.85">المنتجات</div>
          <strong style="font-size:20px;">--</strong>
        </div>
        <div class="stat-box" data-k="rating" style="background:#312e81;color:#e0e7ff;padding:12px;border-radius:10px;">
          <div style="font-size:12px;opacity:.85">متوسط التقييم</div>
          <strong style="font-size:20px;">--</strong>
        </div>
      </div>
      <div style="margin-top:18px" id="latest-orders-block"><h2 style="margin:0 0 10px">أحدث الطلبات</h2><div class="muted">جاري التحميل...</div></div>`;
            contentEl.innerHTML = html;
            try {
                const r = await fetch('/api/seller/stats', { headers: hdrs(false) });
                if (!r.ok) throw new Error('stats failed');
                const j = await r.json();
                const s = j && j.stats ? j.stats : null;
                if (s) {
                    updateStat('orders', s.totalOrders != null ? s.totalOrders : '--');
                    updateStat('products', s.totalProducts != null ? s.totalProducts : '--');
                    updateStat('rating', s.ratingAverage != null ? Number(s.ratingAverage).toFixed(2) : '--');
                    updateStat('sales', s.salesSum != null ? Number(s.salesSum).toFixed(2) + ' ر.س' : '--');
                }
                const latest = j && Array.isArray(j.recentOrders) ? j.recentOrders : [];
                renderLatestOrders(latest);
            } catch (_) { /* ignore */ }
        },
        products: async () => {
            contentEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">\n        <h2 style="margin:0;display:flex;align-items:center;gap:8px">إدارة المنتجات <span id=\"prod-count-badge\" style=\"display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#374151;font-size:12px;line-height:1;\">—</span></h2>\n        <div style="display:flex;gap:6px;align-items:center;">\n          <input id="prod-search" type="text" placeholder="بحث اسم / SKU" style="height:32px;padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;"/>\n          <button class="btn-add-product" style="padding:6px 12px;border:1px solid #d1d5db;border-radius:8px;background:#065f46;color:#ecfdf5;cursor:pointer;">+ إضافة منتج</button>\n        </div>\n      </div>\n      <div id="products-area" class="muted" style="margin-top:10px">جاري التحميل...</div>\n      <div id="product-modal-root"></div>`;
            await loadProductsList();
        },
        orders: async () => {
            contentEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;display:flex;align-items:center;gap:8px">الطلبات <span id="ord-count-badge" style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#374151;font-size:12px;line-height:1;">—</span></h2>
        <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;">
          <input id="ord-q" type="text" placeholder="بحث (المعرف/معرف المنتج)" style="height:32px;padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;"/>
          <select id="ord-status" style="height:32px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;">
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="processing">قيد المعالجة</option>
            <option value="shipped">مشحون</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">ملغي</option>
          </select>
          <input id="ord-from" type="date" style="height:32px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;"/>
          <input id="ord-to" type="date" style="height:32px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;"/>
          <button id="ord-apply" style="height:32px;padding:0 12px;border:1px solid #065f46;background:#065f46;color:#ecfdf5;border-radius:8px;">تطبيق</button>
        </div>
      </div>
      <div id="orders-area" class="muted" style="margin-top:8px">جاري التحميل...</div>`;
            await loadOrders();
            contentEl.querySelector('#ord-apply').addEventListener('click', loadOrders);
        },
        settlements: async () => {
            contentEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;display:flex;align-items:center;gap:8px">التسويات المالية <span id="st-count-badge" style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#374151;font-size:12px;line-height:1;">—</span></h2>
        <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;">
          <select id="st-status" style="height:32px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;">
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="processing">قيد المعالجة</option>
            <option value="paid">مدفوعة</option>
            <option value="failed">فاشلة</option>
          </select>
          <input id="st-from" type="date" style="height:32px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;"/>
          <input id="st-to" type="date" style="height:32px;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;"/>
          <button id="st-apply" style="height:32px;padding:0 12px;border:1px solid #065f46;background:#065f46;color:#ecfdf5;border-radius:8px;">تطبيق</button>
          <button id="st-export" style="height:32px;padding:0 12px;border:1px solid #1f2937;background:#1f2937;color:#f9fafb;border-radius:8px;">تصدير CSV</button>
        </div>
      </div>
      <div id="st-totals" class="muted" style="margin:8px 0">—</div>
      <div id="settlements-area" class="muted">جاري التحميل...</div>
      <div id="st-pager" style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;">
        <div id="st-page-info" class="muted">الصفحة 1</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <label for="st-limit" class="muted" style="font-size:12px;">عناصر/الصفحة</label>
          <select id="st-limit" style="height:30px;padding:4px 8px;border:1px solid #d1d5db;border-radius:8px;">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <button id="st-prev" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;">السابق</button>
          <button id="st-next" style="padding:4px 10px;border:1px solid #d1d5db;border-radius:8px;background:#fff;">التالي</button>
        </div>
      </div>`;
            stPage = 1;
            await loadSettlements();
            contentEl.querySelector('#st-apply').addEventListener('click', () => { stPage = 1; loadSettlements(); });
            contentEl.querySelector('#st-export').addEventListener('click', exportSettlementsCsv);
            const stLimitSel = contentEl.querySelector('#st-limit');
            if (stLimitSel) {
                stLimitSel.value = String(stLimit);
                stLimitSel.addEventListener('change', () => {
                    const v = parseInt(stLimitSel.value, 10);
                    stLimit = isNaN(v) ? 20 : v;
                    stPage = 1;
                    loadSettlements();
                });
            }
            contentEl.querySelector('#st-prev').addEventListener('click', () => { if (stPage > 1) { stPage--; loadSettlements(); } });
            contentEl.querySelector('#st-next').addEventListener('click', () => {
                const pages = Math.max(1, Math.ceil(stTotal / stLimit));
                if (stPage < pages) { stPage++; loadSettlements(); }
            });
        },
        ratings: async () => {
            contentEl.innerHTML = `<h2 style="margin-top:0">التقييمات</h2><div id="ratings-area" class="muted">جاري التحميل...</div>`;
            try {
                const r = await fetch('/api/seller/ratings?limit=50', { headers: hdrs(false) });
                const j = r.ok ? await r.json() : null;
                const items = j ? j.items : [];
                const avg = j ? j.average : 0;
                contentEl.querySelector('#ratings-area').innerHTML = renderRatings(items, avg);
            } catch (e) { contentEl.querySelector('#ratings-area').textContent = 'فشل التحميل'; }
        },
        analytics: async () => {
            contentEl.innerHTML = `<h2 style="margin-top:0">التحليلات (تجريبي)</h2><p class="muted">سيتم لاحقاً إضافة رسوم بيانية للمبيعات حسب اليوم، والأصناف الأعلى أداءً.</p>`;
        }
    };

    function updateStat(k, val) {
        const box = contentEl.querySelector(`.stat-box[data-k="${k}"] strong`);
        if (box) box.textContent = val;
    }
    function renderLatestOrders(items) {
        const block = contentEl.querySelector('#latest-orders-block');
        if (!block) return;
        if (!items.length) { block.innerHTML = '<h2 style="margin:0 0 10px">أحدث الطلبات</h2><div class="muted">لا توجد طلبات</div>'; return; }
        const rows = items.map(o => `<tr><td>${o.id}</td><td>${o.product_id}</td><td>${o.quantity}</td><td>${o.total_price}</td><td>${o.status}</td><td>${o.created_at || ''}</td></tr>`).join('');
        block.innerHTML = `<h2 style="margin:0 0 10px">أحدث الطلبات</h2><table class="simple" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>المعرف</th><th>منتج</th><th>الكمية</th><th>الإجمالي</th><th>الحالة</th><th>تاريخ</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    async function loadProductsList() {
        const area = contentEl.querySelector('#products-area');
        if (!area) return;
        area.innerHTML = 'جاري التحميل...';
        try {
            const countBadge = contentEl.querySelector('#prod-count-badge');
            if (countBadge) countBadge.textContent = '—';
            const searchVal = contentEl.querySelector('#prod-search')?.value.trim() || '';
            const params = new URLSearchParams({ page: '1', limit: '100', sortBy: 'updated_at', sortDir: 'desc' });
            if (searchVal) params.set('q', searchVal);
            const r = await fetch('/api/seller/products?' + params.toString(), { headers: hdrs(false) });
            const j = r.ok ? await r.json() : null;
            const items = j ? j.items : [];
            area.innerHTML = renderProducts(items);
            const total = (j && typeof j.total !== 'undefined') ? Number(j.total) : null;
            if (countBadge) countBadge.textContent = total != null ? `${items.length}/${total}` : String(items.length);
        } catch (e) {
            area.textContent = 'فشل التحميل';
            const countBadge = contentEl.querySelector('#prod-count-badge');
            if (countBadge) countBadge.textContent = '0';
        }
    }

    function renderProducts(items) {
        if (!items.length) return '<div class="muted">لا توجد منتجات</div>';
        return '<table class="simple" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th>المعرف</th><th>صورة</th><th>الاسم</th><th>المخزون</th><th>السعر</th><th>الحالة</th><th>الصور</th><th></th></tr></thead><tbody>' +
            items.map(p => {
                const img = p.image_url ? `<img src="${p.image_url}" alt="${p.name || ''}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;"/>` : '<div style="width:50px;height:50px;background:#eee;border-radius:6px;border:1px solid #e5e7eb;"></div>';
                return `<tr>
          <td>${p.id}</td>
          <td>${img}</td>
          <td>${p.name}</td>
          <td>${p.stock}</td>
          <td>${p.price}</td>
          <td>${p.status}</td>
          <td><button data-act="upload" data-id="${p.id}" style="padding:4px 8px;font-size:11px;background:#1e3a8a;color:#fff;border-radius:6px;">رفع صور</button> <button data-act="images" data-id="${p.id}" style="padding:4px 8px;font-size:11px;background:#374151;color:#fff;border-radius:6px;">عرض</button></td>
          <td><button data-act="edit" data-id="${p.id}" style="padding:4px 8px;font-size:11px;">تعديل</button> <button data-act="del" data-id="${p.id}" style="padding:4px 8px;font-size:11px;background:#7f1d1d;color:#fff;">حذف</button></td>
        </tr>`;
            }).join('') + '</tbody></table>';
    }

    // ...rest same as root file (omitted for brevity)

    tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const tab = btn.getAttribute('data-tab');
        if (!tab || tab === activeTab) return;
        [...tabsEl.querySelectorAll('.tab-btn')].forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = tab;
        if (modules[tab]) modules[tab]();
    });

    (modules[activeTab] || modules.overview)();
})();
