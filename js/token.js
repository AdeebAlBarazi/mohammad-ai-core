// Local copy of token.js (systems/marketplace)
(function () {
    // Expose a single function getAxiomToken for other modules
    function getToken() {
        try { if (window.getAxiomToken) return window.getAxiomToken(); } catch (_) { }
        try { const t = localStorage.getItem('axiomUserToken'); if (t) return t; } catch (_) { }
        try { const t = sessionStorage.getItem('axiomUserToken'); if (t) return t; } catch (_) { }
        return null;
    }
    window.getAxiomToken = getToken;
})();
