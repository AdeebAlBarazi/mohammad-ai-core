// Local copy of market-common.js (systems/marketplace)
// Trimmed version: retains event bus, API base resolution, fetchJSON, fetchJSONWithRetry, fetchMe.
(function (w) {
    const Events = (function () { const map = {}; return { on(evt, h) { (map[evt] = map[evt] || []).push(h); return () => { const a = map[evt] || []; const i = a.indexOf(h); if (i >= 0) a.splice(i, 1); } }, emit(evt, p) { (map[evt] || []).forEach(fn => { try { fn(p); } catch (e) { console.warn('event err', e); } }); } }; })();
    let __resolvedBase; let __detectPromise = null;
    const Common = {
        getToken() { return (w.getAxiomToken && w.getAxiomToken()) || null; },
        authHeader() { const t = Common.getToken(); return t ? { 'Authorization': 'Bearer ' + t } : {}; },
        apiBase() { try { if (__resolvedBase) return __resolvedBase; let b = (w.MARKET_API_BASE) || ''; if (!b) { try { b = localStorage.getItem('MARKET_API_BASE') || ''; } catch (_) { } } if (!b) b = '/api'; return b; } catch (_) { return '/api'; } },
        apiUrl(path) { try { if (/^https?:\/\//i.test(path)) return path; const base = Common.apiBase(); const b = base.endsWith('/') ? base.slice(0, -1) : base; const p = path.startsWith('/') ? path : '/' + path; return b + p; } catch (_) { return path; } },
        async parseJsonSafe(r) { try { if (!r) return null; if (r.status === 204) return {}; const ct = r.headers.get('content-type') || ''; if (ct.includes('json')) return await r.json(); const t = await r.text(); if (!t) return {}; try { return JSON.parse(t); } catch (_) { return { ok: false, message: 'Invalid JSON', raw: t }; } } catch (e) { return { ok: false, message: e.message || 'parse error' }; } },
        async fetchJSON(path, options = {}) { const headers = { 'Accept': 'application/json', ...Common.authHeader(), ...(options.headers || {}) }; const url = Common.apiUrl(path); try { const r = await fetch(url, { ...options, headers }); const data = await Common.parseJsonSafe(r); if (!r.ok) return { ok: false, status: r.status, ...(typeof data === 'object' && data ? data : {}) }; if (data && typeof data === 'object' && !('ok' in data)) return { ok: true, ...data }; return data; } catch (e) { return { ok: false, networkError: true, message: e.message || 'Network error' }; } },
        async fetchMe() { const res = await Common.fetchJSON('/market/auth/me'); return (res && typeof res.authenticated === 'boolean') ? res : { authenticated: false }; },
        async fetchJSONWithRetry(path, opts = {}, rOpts = {}) { const { retries = 2, backoffMs = 250, factor = 2, jitter = true } = rOpts; let attempt = 0, delay = backoffMs; const sleep = ms => new Promise(res => setTimeout(res, ms)); while (true) { const res = await Common.fetchJSON(path, opts); const retry = (res.networkError) || (res.status >= 500); if (!retry || attempt >= retries) return res; attempt++; let wait = delay; if (jitter) { const min = Math.floor(delay * 0.5); wait = min + Math.floor(Math.random() * (delay - min + 1)); } if (wait > 5000) wait = 5000; await sleep(wait); delay = Math.min(5000, Math.floor(delay * (factor || 1))); } },
        whenReady() { return __detectPromise || Promise.resolve(); }
    };
    w.Market = w.Market || {}; w.Market.Common = Common; w.Market.Events = Events;
    (function detect() {
        try {
            const cands = ['/api'];
            const proto = w.location.protocol || 'http:';
            const httpProto = /^https?:/i.test(proto) ? proto : 'http:';
            const lh = (w.location && w.location.hostname) ? w.location.hostname : 'localhost';
            const hosts = Array.from(new Set([lh, 'localhost', '127.0.0.1']));
            const ports = [3045, 3031, 3026, 3002, 3000];
            hosts.forEach(h => ports.forEach(p => cands.push(`${httpProto}//${h}:${p}/api`)));
            __detectPromise = (async () => {
                for (const base of cands) {
                    try {
                        const r = await fetch(base.replace(/\/$/, '') + '/market/ping', { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' });
                        if (r.ok) {
                            __resolvedBase = base.replace(/\/$/, '');
                            w.MARKET_API_BASE = __resolvedBase;
                            return __resolvedBase;
                        }
                    } catch (_) { }
                }
                __resolvedBase = '/api';
                w.MARKET_API_BASE = '/api';
                return '/api';
            })();
        } catch (_) { __resolvedBase = '/api'; }
    })();
})(window);
