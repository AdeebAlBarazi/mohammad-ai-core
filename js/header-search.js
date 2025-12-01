// Copy of root js/header-search.js for organized structure under systems/seller/js
(function () {
    function targetUrl() {
        try {
            return (window.location.pathname.indexOf('/Coreflowhub/') !== -1) ? '../marketplace-index.html' : 'marketplace-index.html';
        } catch (_) { return 'marketplace-index.html'; }
    }
    function go() {
        try {
            var el = document.getElementById('header-search');
            if (!el) return;
            var q = (el.value || '').trim();
            if (!q) return;
            window.location.href = targetUrl() + '?q=' + encodeURIComponent(q);
        } catch (_) { }
    }
    function init() {
        var btn = document.getElementById('header-search-btn');
        var input = document.getElementById('header-search');
        if (btn) btn.addEventListener('click', go);
        if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();