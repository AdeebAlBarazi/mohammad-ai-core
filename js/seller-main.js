// Systems copy: minimal initializer for seller pages without cross-folder imports
// We rely on the non-module ../js/seller-dashboard.js (included by the page) for tab logic.
// This file keeps the auth guard behavior and light page detection.

// Note: No imports here to avoid broken relative paths.

function detectPage() {
    const path = window.location.pathname;
    if (path.endsWith('seller-dashboard.html')) return 'dashboard';
    if (path.endsWith('seller-products.html')) return 'products';
    return 'dashboard';
}

document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();
    console.log('[Seller UI/System] init page:', page);
    try {
        const getToken = () => {
            try { if (window.getAxiomToken) return window.getAxiomToken(); } catch (_) { }
            try { const t = localStorage.getItem('axiomUserToken'); if (t) return t; } catch (_) { }
            try { const t = sessionStorage.getItem('axiomUserToken'); if (t) return t; } catch (_) { }
            return '';
        };

        async function verifyAndEnsureSeller() {
            const token = getToken();
            if (!token) {
                try { sessionStorage.setItem('sellerRedirected', '1'); } catch (_) { }
                // Soft-fail in systems copy: don't hard redirect to avoid dev loop; show hint instead
                console.warn('[Seller UI/System] Missing token; some data may not load.');
                return true;
            }
            return true;
        }

        verifyAndEnsureSeller().then((ok) => {
            if (!ok) return;
            // If legacy unified dashboard is present (tabs container exists), the ../js/seller-dashboard.js will take over.
            // Nothing else to do here for systems copy.
        });
    } catch (e) {
        console.error('[Seller UI/System] Initialization error', e);
    }
});
