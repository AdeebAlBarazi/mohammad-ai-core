// Local copy (trimmed) of market-init.js for systems/marketplace
(function (w) {
    async function init() { try { if (w.Market && w.Market.Products) w.Market.Products.init(); if (w.Market && w.Market.Cart) w.Market.Cart.wire(); } catch (e) { console.warn('market init failed', e); } }
    async function start() { try { const Common = w.Market && w.Market.Common; if (Common && Common.whenReady) await Common.whenReady(); } catch (_) { } await init(); try { if (w.Market && w.Market.Cart) w.Market.Cart.refreshBadge(); } catch (_) { } }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); } else { start(); }
})(window);
