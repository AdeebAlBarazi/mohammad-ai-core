// Local copy (trimmed) of market-cart.js for systems/marketplace
(function (w) {
    const Common = (w.Market && w.Market.Common) || { fetchJSON: async () => ({ ok: false }), getToken: () => null };
    const I18n = (w.Market && w.Market.I18n) || null;
    function formatPrice(val){
        if (w.Market && w.Market.Format && typeof w.Market.Format.currency==='function') return w.Market.Format.currency(val);
        if (val==null) return '0.00';
        var lang = I18n && I18n.getLang ? I18n.getLang() : 'ar';
        var suffix = I18n ? I18n.t('sar', lang) : 'SAR';
        return String(val) + ' ' + suffix;
    }
    const Cart = {
        async fetch() { return await Common.fetchJSON('/market/cart'); },
        showBadge(n) { const b = document.getElementById('cart-badge'); if (!b) return; if (!n) { b.style.display = 'none'; b.textContent = '0'; return; } b.style.display = 'inline-block'; b.textContent = String(n); },
        async refreshBadge() { const d = await Cart.fetch(); Cart.showBadge(d && d.items ? d.items.length : 0); },
        render(data) { const list = document.getElementById('cart-items'); const empty = document.getElementById('cart-empty'); const count = document.getElementById('cart-count'); const subtotal = document.getElementById('cart-subtotal'); const checkout = document.getElementById('cart-checkout'); if (!list) return; list.innerHTML = ''; const items = (data && Array.isArray(data.items)) ? data.items : []; if (!items.length) { empty && (empty.style.display = 'block'); checkout && (checkout.disabled = true); count && (count.textContent = '0'); subtotal && (subtotal.textContent = formatPrice(0)); return; } empty && (empty.style.display = 'none'); count && (count.textContent = String(items.length)); subtotal && (subtotal.textContent = formatPrice(data.subtotal != null ? data.subtotal : 0)); checkout && (checkout.disabled = false); items.forEach(it => { const row = document.createElement('div'); row.className = 'cart-row'; const qty = (it.quantity || 1); const unit = (it.unit || ''); const qtyStr = unit ? `${qty} ${unit}` : `${qty}x`; row.innerHTML = `<strong>${it.name || it.sku || 'Item'}</strong> — <span>${qtyStr}</span>`; list.appendChild(row); }); },
        async open() { const modal = document.getElementById('cart-modal'); const msg = document.getElementById('cart-msg'); const data = await Cart.fetch(); if (data && data.unauthorized) { msg && (msg.textContent = I18n ? I18n.t('session_expired') : 'انتهت الجلسة'); Cart.render({ items: [] }); } else { Cart.render(data); msg && (msg.textContent = ''); } modal && (modal.style.display = 'block'); },
        close() { const modal = document.getElementById('cart-modal'); modal && (modal.style.display = 'none'); },
        async checkout() { const msg = document.getElementById('cart-msg'); if (!Common.getToken()) { msg && (msg.style.color = '#b02a37', msg.textContent = (I18n? I18n.t('signin_required') : 'تسجيل الدخول مطلوب')); return; } try { window.location.href = 'pages/checkout.html'; } catch(_e){ msg && (msg.style.color = '#b02a37', msg.textContent = (I18n? I18n.t('checkout_open_error') : 'تعذر فتح صفحة الدفع')); } },
        wire() { const btn = document.getElementById('cart-button'); const close = document.getElementById('cart-modal-close'); const refresh = document.getElementById('cart-refresh'); const checkout = document.getElementById('cart-checkout'); const modal = document.getElementById('cart-modal'); btn && btn.addEventListener('click', Cart.open); close && close.addEventListener('click', Cart.close); refresh && refresh.addEventListener('click', async () => { const d = await Cart.fetch(); Cart.render(d); await Cart.refreshBadge(); }); checkout && checkout.addEventListener('click', Cart.checkout); modal && modal.addEventListener('click', e => { if (e.target === modal) Cart.close(); }); }
    };
    w.Market = w.Market || {}; w.Market.Cart = Cart;
})(window);
