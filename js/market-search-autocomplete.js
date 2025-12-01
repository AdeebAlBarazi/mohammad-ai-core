// Local copy (simplified) of market-search-autocomplete.js
(function (w) {
    const Common = (w.Market && w.Market.Common) || { apiUrl: (x) => x };
    function initBox(inputId, listId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        if (!input || !list) return;
        let last = ''; let timer = null;
        async function fetchSuggest(q) {
            if (!q) { list.style.display = 'none'; list.innerHTML = ''; return; }
            try {
                const url = Common.apiUrl('/market/search/suggest?q=' + encodeURIComponent(q));
                const r = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
                const j = r.ok ? await r.json() : null;
                const items = j && j.items ? j.items : [];
                if (!items.length) { list.style.display = 'none'; list.innerHTML = ''; return; }
                list.innerHTML = items.slice(0, 8).map(s => `<div class='suggest-item' data-v='${s.value || s.text || s}'>${s.text || s.value || s}</div>`).join('');
                list.style.display = 'block';
            } catch (_) { list.style.display = 'none'; }
        }
        input.addEventListener('input', () => { const q = input.value.trim(); if (q === last) return; last = q; clearTimeout(timer); timer = setTimeout(() => fetchSuggest(q), 250); });
        list.addEventListener('click', e => { const it = e.target.closest('.suggest-item'); if (!it) return; input.value = it.getAttribute('data-v') || input.value; list.style.display = 'none'; });
        document.addEventListener('click', e => { if (!list.contains(e.target) && e.target !== input) { list.style.display = 'none'; } });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { initBox('header-search', 'header-suggest'); initBox('hero-search', 'hero-suggest'); }); } else { initBox('header-search', 'header-suggest'); initBox('hero-search', 'hero-suggest'); }
})(window);
