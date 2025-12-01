// systems/marketplace/server.js
// Autonomous Marketplace Microservice (stub)
// Exposes minimal endpoints used by UI: /api/market/products, /api/market/metrics, /api/market/messages/threads

// Optional env loader (ignore if not present to prevent crashes in standalone usage)
try { require('./../../systems/config/env/loader'); } catch(_) { /* no-op */ }
require('dotenv').config({ path: process.env.MARKET_ENV_PATH || '.env' });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { connectMongo, isConnected } = require('./src/db/connect');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPublicKey, getAllPublicKeys } = require('./utils/keys');
const jwks = require('./utils/jwksClient');
const { requestLogger, errorHandler, correlationIdMiddleware, audit } = require('./utils/logger');
const prom = require('prom-client');
// Transition to service layer (product/cart/order) with fallback to existing controllers during migration
let listProducts, createProduct;
try {
    // Prefer new productService if available for listing/search in future
    const productService = require('./services/market/productService');
    // Wrapper to keep response shape identical
    listProducts = async (req, res) => {
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
            const countryCode = (req.query.countryCode || 'SA').toUpperCase();
            const query = { search: req.query.search || null, vendorId: req.query.vendorId || null, categoryId: req.query.categoryId || req.query.category || null };
            const results = await productService.search(countryCode, { page, limit, query });
            // Expect results.items + results.total when service is implemented fully
            if (results && Array.isArray(results.items)) {
                return res.json({ ok: true, items: results.items, total: results.total || results.items.length, page, limit, mode: 'service' });
            }
            throw new Error('service_incomplete');
        } catch (e) {
            // Fallback to controller implementation
            const ctrl = require('./src/controllers/productsController');
            return ctrl.listProducts(req, res);
        }
    };
    createProduct = async (req, res) => {
        try {
            const productService = require('./services/market/productService');
            const body = req.body || {};
            if (!body || !body.name) return res.status(400).json({ ok: false, error: 'name required' });
            const ingestRes = await productService.createFromIngest(body);
            if (!ingestRes.ok) return res.status(400).json(ingestRes);
            return res.status(201).json({ ok: true, sku: ingestRes.sku, mode: 'service' });
        } catch (e) {
            const ctrl = require('./src/controllers/productsController');
            return ctrl.createProduct(req, res);
        }
    };
} catch (_e) {
    // Service layer not present; fallback entirely
    const ctrl = require('./src/controllers/productsController');
    listProducts = ctrl.listProducts; createProduct = ctrl.createProduct;
}
const { metrics } = require('./src/controllers/metricsController');
const { withValidation, schemas } = require('./src/validation/validators');
// Product list cache module (first-page cache + invalidation on mutations)
const productsCache = require('./src/cache/productsCache');
const { resolveCountry } = require('./src/utils/country');
const { uploadBuffer, getSignedUrl, ALLOWED_TYPES } = require('./services/market/mediaStorage');

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
// Helmet baseline + optional CSP (realistic policy driven by env)
const helmetMiddlewares = [];
helmetMiddlewares.push(helmet());
if (String(process.env.ENABLE_CSP || '1') === '1') {
    const frontend = (process.env.FRONTEND_ORIGIN || '').trim();
    const admin = (process.env.ADMIN_ORIGIN || '').trim();
    const connectSrc = ["'self'"];
    if (frontend) connectSrc.push(frontend);
    if (admin && admin !== frontend) connectSrc.push(admin);

    // Derive storage image origin from MEDIA_PUBLIC_BASE_URL or S3 settings
    let storageOrigin = '';
    try {
        const pub = (process.env.MEDIA_PUBLIC_BASE_URL || '').trim();
        if (pub) {
            const u = new URL(pub);
            storageOrigin = u.origin;
        } else if (process.env.MEDIA_S3_BUCKET && process.env.MEDIA_S3_REGION) {
            storageOrigin = `https://${process.env.MEDIA_S3_BUCKET}.s3.${process.env.MEDIA_S3_REGION}.amazonaws.com`;
        }
    } catch(_) {}

    const imgSrc = ["'self'", 'data:'];
    if (String(process.env.CSP_IMG_ALLOW_BLOB || '0') === '1') imgSrc.push('blob:');
    if (storageOrigin) imgSrc.push(storageOrigin);
    const extraImg = (process.env.CSP_IMG_EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    imgSrc.push(...extraImg);

    const scriptSrc = ["'self'", ... (process.env.SCRIPT_SRC_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
    const styleSrc = ["'self'", ... (process.env.STYLE_SRC_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
    if (String(process.env.CSP_ALLOW_INLINE_STYLES || '0') === '1') styleSrc.push("'unsafe-inline'");

    helmetMiddlewares.push(helmet.contentSecurityPolicy({
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            connectSrc,
            imgSrc,
            scriptSrc,
            styleSrc,
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    }));
}
helmetMiddlewares.forEach(m => app.use(m));
// Correlation ID + request logging
app.use(correlationIdMiddleware);
app.use(requestLogger);
// Start JWKS auto-refresh if configured
try {
    const jwksUrl = process.env.AUTH_JWKS_URL || process.env.MARKET_JWKS_URL;
    const auto = Number(process.env.JWKS_AUTO_REFRESH_MS || 0);
    if (jwksUrl && auto > 0) { jwks.startAutoRefresh(jwksUrl, auto, Number(process.env.JWKS_AUTO_REFRESH_JITTER_MS || 0)); }
} catch(_) { /* ignore */ }
// Restrict CORS to FRONTEND_ORIGIN and ADMIN_ORIGIN; fallback to ALLOWED_ORIGINS
const envOrigins = [process.env.FRONTEND_ORIGIN, process.env.ADMIN_ORIGIN].filter(Boolean).map(o => o.trim()).filter(Boolean);
const allowedOrigins = (envOrigins.length ? envOrigins : (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(o => o.trim()).filter(Boolean));
app.use(cors({
    origin: function (origin, cb) {
        if (!origin) return cb(null, true);
        if (allowedOrigins.length === 0) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        if (String(process.env.MARKET_CORS_ALLOW_DEV || '0') === '1') {
            // Dev convenience: allow localhost/127.0.0.1 origins even if not explicitly listed
            if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(origin)) return cb(null, true);
        }
        if (String(process.env.MARKET_CORS_DEBUG || '0') === '1') {
            console.warn('[market][cors] denied origin:', origin, 'allowed:', allowedOrigins);
        }
        return cb(new Error('CORS_DENIED'));
    },
    credentials: true
}));
app.use((err, _req, res, next) => {
    if (err && err.message === 'CORS_DENIED') {
        return res.status(403).json({ ok: false, code: 'CORS_DENIED', message: 'Origin not allowed' });
    }
    return next(err);
});
app.use(express.json());
// Serve static pages from /pages for same-origin UI (dev/prod)
try {
    const pagesDir = path.join(__dirname, 'pages');
    app.use('/pages', express.static(pagesDir, { fallthrough: true, index: false }));
} catch(_) { /* ignore */ }
// HTTPS redirect (behind proxy) and HSTS
if (String(process.env.FORCE_HTTPS || '0') === '1') {
    app.use((req, res, next) => {
        const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString();
        if (req.secure || forwardedProto.includes('https')) return next();
        return res.redirect(308, 'https://' + req.headers.host + req.originalUrl);
    });
    const maxAge = Number(process.env.HSTS_MAX_AGE_SECONDS || 15552000);
    app.use(helmet.hsts({ maxAge, includeSubDomains: true, preload: false }));
}

// Rate limiting
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_WINDOW_MS || 60000);
const max = Number(process.env.RATE_LIMIT_MAX || process.env.RATE_LIMIT || 120);
const generalLimiter = rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
app.use(['/api', '/api/v1'], generalLimiter);
const uploadMax = Number(process.env.RATE_LIMIT_UPLOAD_MAX || 30);
const uploadLimiter = rateLimit({ windowMs, max: uploadMax, standardHeaders: true, legacyHeaders: false });

// Focused limiters for cart and orders
const cartMax = Number(process.env.RATE_LIMIT_CART_MAX || 60);
const ordersMax = Number(process.env.RATE_LIMIT_ORDERS_MAX || 30);
const cartLimiter = rateLimit({ windowMs, max: cartMax, standardHeaders: true, legacyHeaders: false });
const ordersLimiter = rateLimit({ windowMs, max: ordersMax, standardHeaders: true, legacyHeaders: false });

// Prometheus metrics
let metricsEnabled = String(process.env.METRICS_ENABLED || '1') === '1';
const register = new prom.Registry();
prom.collectDefaultMetrics({ register, prefix: process.env.METRICS_PREFIX || 'market_' });
// Define buckets BEFORE histograms to avoid reference errors
const buckets = (process.env.METRICS_BUCKETS || '').split(',').map(x=>Number(x.trim())).filter(x=>!Number.isNaN(x));
const reqCounter = new prom.Counter({ name: 'http_requests_total', help: 'Total HTTP requests', registers: [register], labelNames: ['method','route','status'] });
const errCounter = new prom.Counter({ name: 'http_errors_total', help: 'HTTP error class counts', registers: [register], labelNames: ['class','route'] });
// Custom business metrics
const productRequests = new prom.Counter({ name: 'market_products_requests_total', help: 'Total product list requests', registers: [register] });
const orderErrors = new prom.Counter({ name: 'market_order_errors_total', help: 'Total errors in orders API', registers: [register] });
const heartbeatCounter = new prom.Counter({ name: 'market_heartbeat_total', help: 'Heartbeat increments on /healthz checks', registers: [register] });
const authDeniedCounter = new prom.Counter({ name: 'market_auth_denied_total', help: 'Total auth or role denials', registers: [register], labelNames: ['type'] });
const paymentIntentsCounter = new prom.Counter({ name: 'market_payment_intents_total', help: 'Total payment intents created (stub)', registers:[register] });
const paymentConfirmCounter = new prom.Counter({ name: 'market_payment_confirms_total', help: 'Total payment intents confirmations (stub)', registers:[register] });
const cartMergeCounter = new prom.Counter({ name: 'market_cart_merge_total', help: 'Total guest cart merges into persistent carts', registers:[register] });
const fulfillmentTransitionsCounter = new prom.Counter({ name: 'market_order_fulfillment_transitions_total', help: 'Order fulfillment status transitions', registers:[register], labelNames:['from','to','role'] });
// Payment ledger events counter (Stripe or other providers)
const paymentLedgerEventsCounter = new prom.Counter({ name: 'payment_ledger_events_total', help: 'Total payment ledger events saved', registers:[register], labelNames:['event_type'] });
// Search metrics (requests, zero-result events, fallback usage, latency)
const searchRequestsCounter = new prom.Counter({ name: 'market_search_requests_total', help: 'Total search requests', registers:[register] });
const searchZeroResultsCounter = new prom.Counter({ name: 'market_search_zero_results_total', help: 'Search requests yielding zero results (first attempt)', registers:[register] });
const searchFallbackCounter = new prom.Counter({ name: 'market_search_fallback_total', help: 'Fallback search attempts that returned results after initial zero result', registers:[register] });
const searchDurationHist = new prom.Histogram({ name: 'market_search_duration_seconds', help: 'Search handler execution time (seconds)', registers:[register], labelNames:['fallback'], buckets: buckets.length?buckets:[0.05,0.1,0.3,0.5,1,2,3] });
// Fuzzy search metrics (attempts, successes, latency)
const searchFuzzyAttemptsCounter = new prom.Counter({ name: 'search_fuzzy_attempts_total', help: 'Total fuzzy search attempts after zero-result + fallback path', registers:[register] });
const searchFuzzySuccessCounter = new prom.Counter({ name: 'search_fuzzy_success_total', help: 'Fuzzy search attempts that returned one or more matches', registers:[register] });
const searchFuzzyDurationHist = new prom.Histogram({ name: 'search_fuzzy_duration_seconds', help: 'Fuzzy search execution time (seconds)', registers:[register], buckets: buckets.length?buckets:[0.01,0.05,0.1,0.3,0.5,1] });
const durationHist = new prom.Histogram({ name: 'http_request_duration_seconds', help:'Request duration in seconds', registers:[register], labelNames:['method','route','status'], buckets: buckets.length?buckets:[0.05,0.1,0.3,0.5,1,2,3,5] });

app.use((req, res, next) => {
    if (!metricsEnabled) return next();
    const startHr = process.hrtime.bigint();
    res.on('finish', () => {
        const route = (req.route && req.route.path) || req.path || 'unknown';
        const status = res.statusCode;
        const method = req.method;
        try {
            reqCounter.inc({ method, route, status: String(status) });
            const dur = Number(process.hrtime.bigint() - startHr) / 1e9;
            durationHist.observe({ method, route, status: String(status) }, dur);
            if (status >= 500) errCounter.inc({ class: '5xx', route });
            else if (status >= 400) errCounter.inc({ class: '4xx', route });
        } catch(_) {}
    });
    next();
});

// Secure cookie defaults (if cookies are used)
app.use((req, res, next) => {
    const orig = res.cookie.bind(res);
    res.cookie = (name, value, options = {}) => {
        const isSecure = String(process.env.FORCE_HTTPS || '0') === '1' || req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
        const defaults = { httpOnly: true, sameSite: 'lax', secure: !!isSecure };
        return orig(name, value, Object.assign(defaults, options));
    };
    next();
});
// Mount seller router (available under both /api/market/seller and legacy /api/seller)
try {
    const sellerRouter = require('./src/routes/seller');
    // Require seller or admin role for seller gateway
    app.use('/api/market/seller', requireAuth, requireRole(['seller', 'admin']), sellerRouter);
    // Versioned alias
    app.use('/api/v1/market/seller', requireAuth, requireRole(['seller', 'admin']), sellerRouter);
    // Legacy path kept for compatibility; protected equally
    app.use('/api/seller', requireAuth, requireRole(['seller', 'admin']), sellerRouter);
} catch (_e) { console.warn('[market] seller router not mounted:', _e && _e.message); }

// Mount AI router (portable assistant MVP)
try {
    // Initialize AI metrics
    try { require('./src/metrics/aiMetrics').init(register); } catch(_e) { console.warn('[market] aiMetrics init failed:', _e && _e.message); }
    const aiRouter = require('./src/routes/ai');
    app.use('/api/ai', aiRouter);
    app.use('/api/v1/ai', aiRouter);
    console.log('[market] AI router mounted at /api/ai');
} catch (_e) { console.warn('[market] AI router not mounted:', _e && _e.message); }

// Mount seller-upgrade + admin review router
try {
    const sellerUpgradeRouter = require('./src/routes/sellerUpgrade');
    // Protect admin subpaths
    app.use('/api/market/admin', requireAuth, requireRole(['admin']));
    app.use('/api/v1/market/admin', requireAuth, requireRole(['admin']));
    app.use('/api/market', sellerUpgradeRouter);
    // Versioned alias
    app.use('/api/v1/market', sellerUpgradeRouter);
} catch (_e) { console.warn('[market] seller-upgrade router not mounted:', _e && _e.message); }

// --- Cart & Orders via service layer with in-memory fallback retained internally ---
const cartService = require('./services/market/cartService');
const orderService = require('./services/market/orderService');
// Keep minimal internal store only for suggestions logic (orders history for memory suggest fallback)
const _ordersForSuggest = [];
let suggestCache = { list: [], lastBuiltAt: 0 };

function resolveUserId(req) {
    // Try RS256/HS256 JWT first
    try {
        const user = resolveUserFromJWT(req);
        if (user && (user.id || user.userId)) return user.id || user.userId;
    } catch (_) { /* ignore */ }
    // Simple heuristic: Bearer token value acts as userId fallback (dev-only)
    const auth = (req.headers.authorization || '').trim();
    if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').split('|')[0];
    // Fallback to query param userId for flexibility in dev.
    return (req.query.userId || req.body && req.body.userId || 'guest');
}

function readKeyFromEnv(varName, pathVarName) {
    const raw = process.env[varName];
    if (raw && raw.trim()) return raw.replace(/\\n/g, '\n');
    const p = process.env[pathVarName];
    if (p && fs.existsSync(p)) { try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch (_) {} }
    return null;
}
const PUBLIC_KEY = readKeyFromEnv('JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_PATH');
const HS_SECRET = process.env.JWT_SECRET || null;

function resolveUserFromJWT(req) {
    const auth = (req.headers.authorization || '').trim();
    if (!/^Bearer\s+/i.test(auth)) return null;
    const token = auth.replace(/^Bearer\s+/i, '');
    if (PUBLIC_KEY || Object.keys(getAllPublicKeys()).length || process.env.AUTH_JWKS_URL || process.env.MARKET_JWKS_URL) {
        // Prefer selecting by kid
        try {
            const decodedHeader = (() => { try { return jwt.decode(token, { complete: true }); } catch(_) { return null; } })();
            const kid = decodedHeader && decodedHeader.header && decodedHeader.header.kid;
            let pub = null;
            if (kid) {
                pub = jwks.getPublicKeyForKidSync(kid) || getPublicKey(kid) || null;
            }
            if (!pub) pub = PUBLIC_KEY;
            if (pub) {
                const decoded = jwt.verify(token, pub, { algorithms: ['RS256'] });
                return decoded.user || decoded;
            }
            const all = Object.assign({}, getAllPublicKeys(), jwks.getAll());
            for (const k of Object.keys(all)) {
                try { const d = jwt.verify(token, all[k], { algorithms: ['RS256'] }); return d.user || d; } catch(_) {}
            }
        } catch(_) {}
    }
    if (HS_SECRET) {
        const decoded = jwt.verify(token, HS_SECRET, { algorithms: ['HS256'] });
        return decoded.user || decoded;
    }
    return null;
}

// Minimal auth gate with hardened JWT requirement when enabled
function requireAuth(req, res, next) {
    const REQUIRE_JWT = String(process.env.MARKET_REQUIRE_JWT || '0') === '1';
    const ALLOW_DEV_FALLBACK = String(process.env.MARKET_ALLOWED_DEV_FALLBACK || '0') === '1';
    try {
        const user = resolveUserFromJWT(req);
        if (PUBLIC_KEY || HS_SECRET || REQUIRE_JWT) {
            if (!user || !(user.id || user.userId)) { try { authDeniedCounter.inc({ type: 'auth' }); } catch(_){} audit('auth_denied',{ reason:'jwt_invalid' },req); return res.status(401).json({ ok: false, error: 'unauthenticated' }); }
            // Normalize role from token
            const role = (() => {
                const r = (user.role || user.roles && user.roles[0] || '').toString().toLowerCase();
                if (r === 'super-admin' || r === 'super_admin') return 'admin';
                if (r === 'seller' || r === 'vendor') return 'seller';
                if (r === 'customer' || r === 'user') return 'user';
                return r || 'user';
            })();
            req.user = { id: user.id || user.userId, role };
            audit('auth_success',{ role, method:'jwt' },req);
            return next();
        }
    } catch (e) { try { authDeniedCounter.inc({ type: 'auth' }); } catch(_){} return res.status(401).json({ ok: false, error: 'unauthenticated' }); }
    // Dev fallback only when explicitly allowed
    if (!ALLOW_DEV_FALLBACK) { try { authDeniedCounter.inc({ type: 'auth' }); } catch(_){} audit('auth_denied',{ reason:'fallback_disabled' },req); return res.status(401).json({ ok: false, error: 'unauthenticated' }); }
    const userId = resolveUserId(req);
    if (!userId || userId === 'guest') { try { authDeniedCounter.inc({ type: 'auth' }); } catch(_){} audit('auth_denied',{ reason:'guest' },req); return res.status(401).json({ ok: false, error: 'unauthenticated' }); }
    req.user = { id: userId, role: 'user' };
    audit('auth_success',{ role:'user', method:'dev_fallback' },req);
    return next();
}

function requireRole(roles) {
    const norm = (role) => {
        const r = String(role || '').toLowerCase();
        if (r === 'super-admin' || r === 'super_admin') return 'admin';
        if (r === 'customer') return 'user';
        return r;
    };
    const set = new Set((Array.isArray(roles) ? roles : [roles]).map(r => norm(r)));
    return (req, res, next) => {
        const u = req.user || {};
        const r = norm(u.role);
        if (!r || !set.has(r)) { try { authDeniedCounter.inc({ type: 'role' }); } catch(_){} audit('role_denied',{ required:Array.from(set), got:r },req); return res.status(403).json({ ok: false, error: 'forbidden' }); }
        return next();
    };
}

function getCart(userId) {
    // cartService abstracts memory/db; computeTotals will derive enriched data. For legacy endpoints we still need raw items.
    // cartService.getCart returns memory cart in fallback mode.
    try { return cartService.getCart(userId); } catch (_e) { return { items: [] }; }
}

function rebuildSuggestIfNeeded() {
    const TTL = 60_000; // 1 minute
    const now = Date.now();
    if (now - suggestCache.lastBuiltAt < TTL && suggestCache.list.length) return suggestCache.list;
    try {
        // If Mongo connected, read product names directly.
        if (isConnected()) {
            const Product = require('./src/models/Product');
            // limit to recent 200 names for suggestions
            return Product.find({ active: true }).sort({ createdAt: -1 }).limit(200).select('name sku').lean().then(rows => {
                suggestCache = { list: rows.map(r => ({ text: r.name, value: r.sku })), lastBuiltAt: now };
                return suggestCache.list;
            });
        }
    } catch (_) { /* ignore */ }
    // Memory fallback: build from seeded samples present in ordersStore or cart items (less ideal)
    const fallbackSet = new Set();
    // Use internal _ordersForSuggest (since in-memory orders store removed)
    _ordersForSuggest.forEach(o => Array.isArray(o.items) && o.items.forEach(it => it.sku && fallbackSet.add(it.sku)));
    const list = Array.from(fallbackSet).slice(0, 50).map(sku => ({ text: sku, value: sku }));
    suggestCache = { list, lastBuiltAt: now };
    return list;
}

// --- DB Connection ---
(async () => {
    const conn = await connectMongo();
    // Optional: auto-create indexes on start when Mongo is active
    if (isConnected() && String(process.env.MARKET_CREATE_INDEXES_ON_START || '').toLowerCase() === '1') {
        try {
            const Product = require('./src/models/Product');
            await Product.syncIndexes();
            console.log('[market-db] indexes ensured (systems/marketplace)');
        } catch (e) {
            console.warn('[market-db] failed to ensure indexes:', e && e.message);
        }
    }
    // Optional: seed demo data into Mongo on start (idempotent by SKU)
    if (isConnected() && String(process.env.MARKET_SEED_DEMO || '').toLowerCase() === '1') {
        try {
            const Product = require('./src/models/Product');
            const samples = [
                { name: 'Breccia Marble Slab A', category: 'stone', price: 250, currency: 'SAR', vendorId: '101', countryCode: 'SA', sku: 'SA-101-07-A1' },
                { name: 'Breccia Marble Slab B', category: 'stone', price: 310, currency: 'SAR', vendorId: '101', countryCode: 'SA', sku: 'SA-101-07-B1' },
                { name: 'Breccia Marble Slab C', category: 'stone', price: 205, currency: 'SAR', vendorId: '102', countryCode: 'SA', sku: 'SA-102-07-C1' }
            ];
            for (const s of samples) {
                await Product.updateOne({ sku: s.sku }, { $setOnInsert: Object.assign({ stock: 10, active: true }, s) }, { upsert: true });
            }
            console.log('[market-db] demo seed ensured (systems/marketplace)');
        } catch (e) {
            console.warn('[market-db] demo seed failed:', e && e.message);
        }
    }
})();

// --- Cache Setup ---
// Cache metrics
const productsCacheHits = new prom.Counter({ name: 'market_products_cache_hits_total', help: 'Product listing cache hits', registers:[register] });
const productsCacheMisses = new prom.Counter({ name: 'market_products_cache_misses_total', help: 'Product listing cache misses', registers:[register] });
const productsCacheHitRatio = new prom.Gauge({ name: 'market_products_cache_hit_ratio', help: 'Product listing cache hit ratio (hits / (hits+misses))', registers:[register] });
let _hits = 0; let _misses = 0;
function updateHitRatio(){ const total = _hits + _misses; if(total === 0) { productsCacheHitRatio.set(0); return; } productsCacheHitRatio.set(_hits/total); }

// --- Port Binding Logic ---
const START_PORT = Number(process.env.MARKET_PORT) || 3002;
let port = START_PORT; let server;
async function tryListen(p) { return await new Promise(r => { const s = app.listen(p, () => r({ ok: true, server: s })).on('error', e => r({ ok: false, err: e })); }); }
async function start() {
    const candidates = [START_PORT, 3026, 3031];
    for (const p of candidates) { const r = await tryListen(p); if (r.ok) { server = r.server; port = p; break; } if (r.err && r.err.code === 'EADDRINUSE') { console.warn(`[market] Port ${p} in use, trying next...`); } }
    if (!server) { const r = await tryListen(0); if (r.ok) { server = r.server; port = server.address().port; console.warn(`[market] Falling back to random port ${port}`); } }
    if (!server) { console.error('[market] Failed to bind any port. Exiting.'); process.exit(1); }
    console.log(`✅ Marketplace service running on http://localhost:${port}`);
}

// --- Health ---
app.get('/', (req, res) => res.send('Marketplace Service Root'));
app.get('/api/status', (req, res) => res.json({ service: 'market', status: 'ok', port, dbConnected: isConnected() }));
// Versioned status (optional)
app.get('/api/v1/market/status', (req, res) => res.json({ service: 'market', status: 'ok', port, dbConnected: isConnected() }));

// --- Products Endpoints ---
async function getProductsHandler(req, res) {
    try { productRequests.inc(); } catch (_) {}
    // Default country if missing
    if (!req.query.countryCode && !req.query.country) { req.query.countryCode = resolveCountry(req); }
    // Attempt cache hit only for first page & no search modifications
    const page = Number(req.query.page || 1);
    const limitRaw = Number(req.query.limit || 20);
    const LIM_CAP = Number(process.env.MARKET_LIMIT_MAX || 100);
    if (limitRaw > LIM_CAP) {
        return res.status(400).json({ ok: false, code: 'LIMIT_TOO_HIGH', message: `limit cannot exceed ${LIM_CAP}`, max: LIM_CAP });
    }
    const limit = Math.max(1, limitRaw);
    const qObj = { page, limit, search: req.query.search || '', category: req.query.category || '', countryCode: req.query.countryCode || req.query.country || '' };
    const cacheable = page === 1 && !qObj.search && !qObj.category;
    const key = cacheable ? productsCache.keyFor(qObj) : null;
    if (key) {
        const hit = productsCache.get(key);
        if (hit) {
            try { productsCacheHits.inc(); _hits++; updateHitRatio(); } catch(_){}
            return res.json(Object.assign({}, hit, { cache: 'hit' }));
        }
    }
    // Delegate to controller
    return listProducts(req, {
        json: (payload) => {
            // If memory preferred/not connected and items empty, provide demo fallback
            const preferMem = String(process.env.MARKET_PREFER_MEMORY || '0') === '1';
            const notConnected = !isConnected();
            if ((preferMem || notConnected) && payload && payload.ok && Array.isArray(payload.items) && payload.items.length === 0) {
                const samples = [
                    { name: 'Demo Marble Slab A', category: 'stone', price: 190, currency: 'SAR', vendorId: 'demo', countryCode: 'SA', sku: 'DEMO-SA-001' },
                    { name: 'Demo Granite Block X', category: 'stone', price: 320, currency: 'SAR', vendorId: 'demo', countryCode: 'SA', sku: 'DEMO-SA-002' }
                ];
                payload.items = samples;
                payload.total = samples.length;
                payload.mode = 'demo';
            }
            if (key && payload && payload.ok) {
                try { productsCacheMisses.inc(); _misses++; updateHitRatio(); } catch(_){}
                productsCache.set(key, payload, Number(process.env.MARKET_CACHE_TTL_MS || 30000));
            }
            res.json(Object.assign({}, payload, key ? { cache: key && payload.ok ? 'miss' : 'skip' } : {}));
        }, status: (code) => ({ json: (obj) => res.status(code).json(obj) })
    });
}
app.get('/api/market/products', getProductsHandler);
// Versioned alias
app.get('/api/v1/market/products', getProductsHandler);

function invalidateProductsCache(){ try { productsCache.invalidateAll(); } catch(_){} }
function postProductHandler(req, res) {
    const originalJson = res.json.bind(res);
    res.json = (payload) => { invalidateProductsCache(); return originalJson(payload); };
    return createProduct(req, res);
}
app.post('/api/market/products', withValidation(schemas.productCreate), postProductHandler);
app.post('/api/v1/market/products', withValidation(schemas.productCreate), postProductHandler);

// Ingest route (bypasses strict productCreate schema to allow pipeline fields like categoryId, thickness, material)
app.post('/api/market/ingest/products', async (req,res) => {
    try {
        const body = req.body || {};
        const svc = require('./services/market/productService');
        const r = await svc.createFromIngest(body);
        if(!r.ok){ return res.status(400).json(r); }
        return res.status(201).json(Object.assign({ mode: 'ingest' }, r));
    } catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
});

// --- Search Endpoint (advanced) ---
try {
    const searchCache = require('./src/cache/searchCache');
    const productServiceAdv = require('./services/market/productService');
    const interactions = require('./services/market/interactionsTracker');
    async function searchHandler(req, res){
        const startHr = process.hrtime.bigint();
        try { searchRequestsCounter.inc(); } catch(_){ }
        const q = String(req.query.q || req.query.search || '').trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const sort = (req.query.sort || 'rank').toLowerCase();
        const material = req.query.material || undefined;
        const thickness = req.query.thickness || undefined;
        const category = req.query.category || req.query.categoryId || undefined;
        const priceMin = req.query.priceMin || req.query.minPrice || undefined;
        const priceMax = req.query.priceMax || req.query.maxPrice || undefined;
        const vendorRatingMin = req.query.vendorRatingMin || undefined;
        const rating_min = req.query.rating_min || undefined;
        const mode = (req.query.mode || '').toLowerCase(); // facets support when mode=facets
        const includeRaw = String(req.query.include || req.query.expand || '').trim();
        const includeTokens = includeRaw ? includeRaw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
        // Map include tokens to internal expansion keys consumed by repo via _expandTokens
        const expansionMap = new Set();
        for(const t of includeTokens){
            if(['vendor','vendors'].includes(t)) expansionMap.add('vendor');
            if(['warehouse','warehouses'].includes(t)) expansionMap.add('warehouse');
            if(['media','images','video','videos'].includes(t)) expansionMap.add('media');
            if(['variants','variant'].includes(t)) expansionMap.add('variants');
        }
        const _expandTokens = Array.from(expansionMap);
        const countryCode = (req.query.countryCode || req.query.country || resolveCountry(req)).toUpperCase();
        const cacheable = page === 1 && q && q.length >= 2 && _expandTokens.length === 0 && !mode; // cache only simple first-page searches
        const key = cacheable ? require('./src/cache/searchCache').keyFor({ q, page, limit, sort, material, thickness, category, priceMin, priceMax, vendorRatingMin, rating_min }) : null;
        if(key){
            const cached = searchCache.get(key);
            if(cached){
                const dur = Number(process.hrtime.bigint() - startHr)/1e9;
                try { searchDurationHist.observe({ fallback:'0' }, dur); } catch(_){ }
                return res.json(Object.assign({}, cached, { cache:'hit' }));
            }
        }
        let result = await productServiceAdv.advancedSearch(countryCode, { q, page, limit, sort, material, thickness, category, priceMin, priceMax, vendorRatingMin, rating_min, mode, _expandTokens });
        let fallbackUsed = false; let fallbackQ = null;
        if(result && Array.isArray(result.items) && result.total === 0){
            try { searchZeroResultsCounter.inc(); } catch(_){ }
            // Fallback: attempt truncated query if length >= 4
            if(q.length >= 4){
                fallbackQ = q.slice(0, Math.max(2, Math.floor(q.length * 0.6))); // keep 60% prefix
                if(fallbackQ !== q){
                    const fallbackRes = await productServiceAdv.advancedSearch(countryCode, { q: fallbackQ, page, limit, sort, material, thickness, category, priceMin, priceMax, vendorRatingMin, rating_min, mode, _expandTokens });
                    if(fallbackRes && fallbackRes.total > 0){
                        fallbackUsed = true; result = fallbackRes;
                        try { searchFallbackCounter.inc(); } catch(_){ }
                        try { audit('search_fallback',{ original:q, fallback:fallbackQ, gained: fallbackRes.total }, req); } catch(_){ }
                    }
                }
            }
            // Fuzzy search path (only if still zero after fallback)
            if((!result || result.total === 0) && String(process.env.MARKET_ENABLE_FUZZY || '0') === '1' && q.length >= 2){
                const fuzzyStart = process.hrtime.bigint();
                try { searchFuzzyAttemptsCounter.inc(); } catch(_){ }
                let fuzzyMatches = [];
                try {
                    const fuzzy = require('./services/market/search/fuzzy');
                    fuzzyMatches = await fuzzy.search(q, limit);
                } catch(e){ /* ignore fuzzy errors */ }
                const fuzzyDur = Number(process.hrtime.bigint() - fuzzyStart)/1e9;
                try { searchFuzzyDurationHist.observe(fuzzyDur); } catch(_){ }
                if(Array.isArray(fuzzyMatches) && fuzzyMatches.length){
                    try { searchFuzzySuccessCounter.inc(); } catch(_){ }
                    try { audit('search_fuzzy_used',{ original: q, matches: fuzzyMatches.length }, req); } catch(_){ }
                    // Map fuzzy results into product-like items with minimal fields
                    result = { items: fuzzyMatches.map(m => ({ sku: m.sku, name: m.name, fuzzyScore: m.fuzzyScore })), total: fuzzyMatches.length, meta: { fuzzy: true } };
                }
            }
        }
        const dur = Number(process.hrtime.bigint() - startHr)/1e9;
        try { searchDurationHist.observe({ fallback: fallbackUsed ? '1':'0' }, dur); } catch(_){ }
        if(key && result && result.items){
            try { searchCache.set(key, { ok:true, items: result.items, total: result.total, page, limit, meta: result.meta || {} }, Number(process.env.MARKET_SEARCH_CACHE_TTL_MS || 15000)); } catch(_){ }
        }
        // Optional facets computation
        async function computeFacetsIfRequested(baseItems){
            if(mode !== 'facets') return null;
            const facetSample = Math.min(Number(process.env.MARKET_FACET_SAMPLE_LIMIT || 200), 500);
            // If current page already small, fetch larger sample for better facet counts
            let pool = Array.isArray(baseItems) ? baseItems.slice() : [];
            if(pool.length < Math.min(facetSample, 60)){
                try {
                    const sampleRes = await productServiceAdv.advancedSearch(countryCode, { q, page: 1, limit: facetSample, sort, material, thickness, category, priceMin, priceMax, vendorRatingMin, rating_min, _expandTokens });
                    if(sampleRes && Array.isArray(sampleRes.items)) pool = sampleRes.items.slice();
                } catch(_){}
            }
            const counts = { material:{}, form:{}, thickness_mm:{}, color_family:{} };
            function addCount(map, key){ if(!key) return; const k = String(key).trim().toLowerCase(); if(!k) return; map[k] = (map[k]||0) + 1; }
            function getPath(obj, paths){
                for(const p of paths){
                    try {
                        const parts = p.split('.');
                        let v = obj; for(const part of parts){ if(v==null) { v = null; break; } v = v[part]; }
                        if(v!=null && v!=='' && !(Array.isArray(v)&&v.length===0)) return v;
                    } catch(_){}
                }
                return null;
            }
            function parseThicknessMM(v){
                if(v==null) return null; let s = String(v).toLowerCase();
                // numeric
                if(typeof v === 'number' && !Number.isNaN(v)){
                    const num = Math.round(Number(v));
                    return (num>0 && num<2000) ? num : null;
                }
                const m1 = s.match(/([0-9]+(?:\.[0-9]+)?)\s*mm/);
                if(m1){ return Math.round(parseFloat(m1[1])); }
                const m2 = s.match(/([0-9]+(?:\.[0-9]+)?)\s*cm/);
                if(m2){ return Math.round(parseFloat(m2[1])*10); }
                const num = parseFloat(s);
                if(!Number.isNaN(num)){
                    // Assume already mm if reasonable
                    const n = Math.round(num);
                    if(n>0 && n<2000) return n;
                }
                return null;
            }
            function normalizeColor(val){
                if(!val) return null; const s = String(val).toLowerCase();
                const map = {
                    'ابيض':'white','أبيض':'white','white':'white',
                    'اسود':'black','أسود':'black','black':'black',
                    'رمادي':'gray','س灰':'gray','grey':'gray','gray':'gray',
                    'بيج':'beige','beige':'beige',
                    'بني':'brown','brown':'brown',
                    'اخضر':'green','أخضر':'green','green':'green',
                    'ازرق':'blue','أزرق':'blue','blue':'blue',
                    'احمر':'red','أحمر':'red','red':'red',
                    'اصفر':'yellow','أصفر':'yellow','yellow':'yellow'
                };
                return map[s] || s;
            }
            for(const it of pool){
                const mat = getPath(it, ['material','attributes.material','meta.material','specs.material']);
                if(Array.isArray(mat)){ mat.forEach(m=>addCount(counts.material, m)); } else { addCount(counts.material, mat); }
                const form = getPath(it, ['form','shape','attributes.form','attributes.shape','meta.form']);
                if(Array.isArray(form)){ form.forEach(f=>addCount(counts.form, f)); } else { addCount(counts.form, form); }
                const thick = getPath(it, ['thickness_mm','attributes.thickness_mm','thickness','attributes.thickness']);
                const tmm = parseThicknessMM(thick);
                if(tmm!=null){ addCount(counts.thickness_mm, String(tmm)); }
                const color = getPath(it, ['color_family','colorFamily','attributes.color_family','attributes.color','color']);
                const cf = Array.isArray(color) ? color.map(normalizeColor) : [ normalizeColor(color) ];
                cf.forEach(c=>addCount(counts.color_family, c));
            }
            return counts;
        }
        let facets = null;
        try { facets = await computeFacetsIfRequested(result && result.items); } catch(_){}
        const metaOut = Object.assign({}, result.meta||{}, facets ? { facets } : {});
        return res.json({ ok:true, items: result.items||[], total: result.total||0, page, limit, meta: metaOut, fallback: fallbackUsed ? { original:q, used:fallbackQ } : undefined, fuzzy: (result.meta && result.meta.fuzzy) ? { original: q, total: result.total } : undefined, cache: key ? 'miss':'skip' });
    }
    app.get('/api/market/search', searchHandler);
    app.get('/api/v1/market/search', searchHandler);

    // Home feed: blends newest with interaction-tuned ranking
    async function homeFeedHandler(req, res){
        const startHr = process.hrtime.bigint();
        try {
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
            const countryCode = (req.query.countryCode || req.query.country || resolveCountry(req)).toUpperCase();
            const includeRaw = String(req.query.include || req.query.expand || '').trim();
            const includeTokens = includeRaw ? includeRaw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
            const expansionMap = new Set();
            for(const t of includeTokens){
                if(['vendor','vendors'].includes(t)) expansionMap.add('vendor');
                if(['warehouse','warehouses'].includes(t)) expansionMap.add('warehouse');
                if(['media','images','video','videos'].includes(t)) expansionMap.add('media');
                if(['variants','variant'].includes(t)) expansionMap.add('variants');
            }
            const _expandTokens = Array.from(expansionMap);

            // Interaction-tuned weights (global heuristics)
            let tunedWeights = null; let tuneMeta = null;
            try {
                const ww = interactions.computeWeeklyWeights();
                tunedWeights = ww.weights; tuneMeta = ww;
            } catch(_e){}

            // Newest slice for freshness
            const newestSlice = await productServiceAdv.advancedSearch(countryCode, { page: 1, limit: Math.max(3, Math.ceil(limit/2)), sort: 'newest', _expandTokens });
            // Ranked slice using tuned weights
            const rankedSlice = await productServiceAdv.advancedSearch(countryCode, { page, limit, sort: 'rank', tunedWeights, _expandTokens });

            const bySku = new Map();
            const out = [];
            function pushItems(arr){
                if(!arr || !Array.isArray(arr.items)) return;
                for(const it of arr.items){
                    const key = String(it.sku || it._id || '');
                    if(!key || bySku.has(key)) continue;
                    bySku.set(key, true); out.push(it);
                    if(out.length >= limit) break;
                }
            }
            pushItems(newestSlice);
            if(out.length < limit) pushItems(rankedSlice);

            // Fallback to popular if still empty
            if(out.length === 0){
                const popular = await productServiceAdv.advancedSearch(countryCode, { page:1, limit, sort:'popular', _expandTokens });
                pushItems(popular);
            }

            const total = out.length; // home-feed is curated; total reflects returned count
            const dur = Number(process.hrtime.bigint() - startHr)/1e9;
            return res.json({ ok:true, items: out, total, page, limit, meta: { tunedWeights, tuneMeta, latency: dur } });
        } catch(e){
            return res.status(500).json({ ok:false, error: e.message });
        }
    }
    app.get('/api/market/home-feed', homeFeedHandler);
    app.get('/api/v1/market/home-feed', homeFeedHandler);

    // Interactions endpoints (dev-friendly; aggregate global signals)
    app.post('/api/market/interactions/click', express.json(), (req, res) => {
        try {
            const { sku, price, hasMedia } = req.body || {};
            if(!sku) return res.status(400).json({ ok:false, error:'sku_required' });
            const interactions = require('./services/market/interactionsTracker');
            interactions.recordClick(String(sku), { price, hasMedia });
            return res.json({ ok:true });
        } catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
    });
    app.post('/api/v1/market/interactions/click', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/interactions/click'}), res, ()=>{}));

    app.post('/api/market/interactions/view', express.json(), (req, res) => {
        try {
            const { sku, dwellMs, price, hasMedia } = req.body || {};
            if(!sku) return res.status(400).json({ ok:false, error:'sku_required' });
            const interactions = require('./services/market/interactionsTracker');
            interactions.recordView(String(sku), Number(dwellMs||0), { price, hasMedia });
            return res.json({ ok:true });
        } catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
    });
    app.post('/api/v1/market/interactions/view', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/interactions/view'}), res, ()=>{}));
} catch(e){ console.warn('[market] search endpoint init failed:', e && e.message); }

// Manual demo seed endpoint (Mongo only)
app.post('/api/market/seed-demo', requireRole(['super_admin']), async (_req, res) => {
    try {
        if (!isConnected()) return res.status(503).json({ ok: false, error: 'mongo_not_connected' });
        const Product = require('./src/models/Product');
        const samples = [
            { name: 'Breccia Marble Slab A', category: 'stone', price: 250, currency: 'SAR', vendorId: '101', countryCode: 'SA', sku: 'SA-101-07-A1' },
            { name: 'Breccia Marble Slab B', category: 'stone', price: 310, currency: 'SAR', vendorId: '101', countryCode: 'SA', sku: 'SA-101-07-B1' },
            { name: 'Breccia Marble Slab C', category: 'stone', price: 205, currency: 'SAR', vendorId: '102', countryCode: 'SA', sku: 'SA-102-07-C1' }
        ];
        let upserts = 0;
        for (const s of samples) {
            const r = await Product.updateOne({ sku: s.sku }, { $setOnInsert: Object.assign({ stock: 10, active: true }, s) }, { upsert: true });
            if (r.upsertedCount === 1) upserts += 1;
        }
        return res.status(201).json({ ok: true, seeded: upserts });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
});
// Versioned alias
app.post('/api/v1/market/seed-demo', async (req, res) => app._router.handle(Object.assign(req, { url: '/api/market/seed-demo', originalUrl: '/api/market/seed-demo' }), res, () => {}));

// Dev-only: seed demo products in MEMORY mode (no Mongo required)
app.post('/api/market/dev/seed-memory', requireAuth, requireRole(['admin','super_admin']), async (_req, res) => {
    try {
        if (isConnected()) return res.status(400).json({ ok: false, error: 'mongo_connected_use_other_seed' });
        const samples = [
            { name: 'Demo Marble Slab A', category: 'stone', price: 190, currency: 'SAR', vendorId: '101', countryCode: 'SA' },
            { name: 'Demo Marble Slab B', category: 'stone', price: 210, currency: 'SAR', vendorId: '101', countryCode: 'SA' },
            { name: 'Granite Block X', category: 'stone', price: 320, currency: 'SAR', vendorId: '102', countryCode: 'SA' },
            { name: 'Travertine Tile 30x30', category: 'tile', price: 75, currency: 'SAR', vendorId: '103', countryCode: 'SA' },
            { name: 'Limestone Panel L', category: 'stone', price: 145, currency: 'SAR', vendorId: '104', countryCode: 'SA' },
            { name: 'Quartz Surface Q1', category: 'quartz', price: 260, currency: 'SAR', vendorId: '105', countryCode: 'SA' }
        ];
        const ctrl = require('./src/controllers/productsController');
        let created = 0;
        for (const s of samples) {
            await new Promise((resolve) => {
                const fakeReq = { body: s, query: { countryCode: s.countryCode } };
                const fakeRes = {
                    status: (_c) => ({ json: (_o) => resolve() }),
                    json: (_o) => { created++; resolve(); }
                };
                ctrl.createProduct(fakeReq, fakeRes);
            });
        }
        return res.status(201).json({ ok: true, created, mode: 'memory' });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});
// Versioned alias
app.post('/api/v1/market/dev/seed-memory', async (req, res) => app._router.handle(Object.assign(req, { url: '/api/market/dev/seed-memory', originalUrl: '/api/market/dev/seed-memory' }), res, () => {}));

// Dev-only: seed placeholder media for memory products (no Mongo required)
app.post('/api/market/dev/seed-memory-media', async (_req, res) => {
    try {
        if (isConnected()) return res.status(400).json({ ok: false, error: 'mongo_connected_use_db_media' });
        const st = require('./utils/market/store');
        let count = 0;
        for (const cc of Object.keys(st.store || {})) {
            const bucket = st.store[cc];
            const arr = bucket && Array.isArray(bucket.products) ? bucket.products : [];
            for (let i = 0; i < arr.length; i++) {
                const p = arr[i] || {};
                if (!Array.isArray(p.media) || p.media.length === 0) {
                    const seed = encodeURIComponent(String(p.sku || p.name || 'img') + '-' + i);
                    const url = `https://picsum.photos/seed/${seed}/800/600`;
                    const thumbUrl = `https://picsum.photos/seed/${seed}/320/240`;
                    const next = Object.assign({}, p, { media: [ { _id: 'mem-'+i, type: 'image', url, thumb: thumbUrl, qualityScore: 0.7 } ] });
                    // Replace in-place
                    const idx = st.store[cc].products.findIndex(x => x === p);
                    if (idx !== -1) { st.store[cc].products[idx] = next; count++; }
                }
            }
        }
        return res.status(201).json({ ok: true, updated: count });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});
// Versioned alias
app.post('/api/v1/market/dev/seed-memory-media', async (req, res) => app._router.handle(Object.assign(req, { url: '/api/market/dev/seed-memory-media', originalUrl: '/api/market/dev/seed-memory-media' }), res, () => {}));

// --- Metrics ---
function metricsHandler(req, res) {
    if (!req.query.countryCode && !req.query.country) { req.query.countryCode = resolveCountry(req); }
    return metrics(req, res);
}
app.get('/api/market/metrics', metricsHandler);
app.get('/api/v1/market/metrics', metricsHandler);

// --- Messages Threads (remain stub for now) ---
function threadsListHandler(req, res) {
    res.json({ ok: true, items: [{ id: 't1', subject: 'استفسار عن منتج', unreadCount: 1 }], stub: true });
}
app.get('/api/market/messages/threads', threadsListHandler);
app.get('/api/v1/market/messages/threads', threadsListHandler);

// --- API base ping (needed for client detection logic) ---
function pingHandler(_req, res) {
    try {
        // Always allow any origin for lightweight detection (does not expose sensitive info)
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Credentials', 'false');
    } catch(_){}
    res.json({ ok: true, service: 'market', mode: isConnected() ? 'mongo' : 'memory' });
}
app.get('/api/market/ping', pingHandler);
app.get('/api/v1/market/ping', pingHandler);

// --- MVP: Auth (stub) ---
function authMeHandler(req, res) {
    const userId = resolveUserId(req);
    if (!userId || userId === 'guest') return res.json({ authenticated: false });
    let role = 'customer';
    try {
        // Try to read role from sellerUpgrade router's in-memory store
        const sellerUpgrade = require('./src/routes/sellerUpgrade');
        if (sellerUpgrade && sellerUpgrade.__stores && sellerUpgrade.__stores.usersRoles) {
            role = sellerUpgrade.__stores.usersRoles.get(userId) || role;
        }
    } catch (_) { /* ignore */ }
    return res.json({ authenticated: true, user: { id: userId, role } });
}
app.get('/api/market/auth/me', authMeHandler);
app.get('/api/v1/market/auth/me', authMeHandler);
app.get('/api/v1/auth/me', authMeHandler);

// --- MVP: Cart endpoints (memory only) ---
async function cartGetHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const countryCode = (req.query.countryCode || 'SA').toUpperCase();
        const totals = await cartService.computeTotals(userId, countryCode);
        res.json({ ok: true, items: totals.items.map(i => ({ sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })), subtotal: totals.subtotal, currency: 'SAR', mode: 'service' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
}
app.get('/api/market/cart', cartLimiter, requireAuth, cartGetHandler);
app.get('/api/v1/market/cart', cartLimiter, requireAuth, cartGetHandler);
app.get('/api/v1/cart', cartLimiter, requireAuth, cartGetHandler);

async function cartPostHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const { sku, quantity } = req.body || {};
        if (!sku) return res.status(400).json({ ok: false, error: 'sku required' });
        await cartService.addItem({ userId, sku, quantity: Math.max(1, Number(quantity || 1)) });
        res.json({ ok: true, mode: 'service' });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
}
app.post('/api/market/cart', cartLimiter, requireAuth, withValidation(schemas.cartAdd), cartPostHandler);
app.post('/api/v1/market/cart', cartLimiter, requireAuth, withValidation(schemas.cartAdd), cartPostHandler);
app.post('/api/v1/cart', cartLimiter, requireAuth, withValidation(schemas.cartAdd), cartPostHandler);

async function cartDeleteHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const { sku } = req.query;
        if (!sku) {
            // Clear entire cart if no SKU provided
            await cartService.clearCart({ userId });
            return res.json({ ok: true, cleared: true, mode: 'service' });
        }
        await cartService.removeItem({ userId, sku });
        res.json({ ok: true, removed: sku, mode: 'service' });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
}
app.delete('/api/market/cart', cartLimiter, requireAuth, cartDeleteHandler);
app.delete('/api/v1/market/cart', cartLimiter, requireAuth, cartDeleteHandler);
app.delete('/api/v1/cart', cartLimiter, requireAuth, cartDeleteHandler);

// Replace full cart (PUT)
async function cartPutHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const countryCode = (req.query.countryCode || 'SA').toUpperCase();
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        await cartService.replaceCart({ userId, items, countryCode });
        const totals = await cartService.computeTotals(userId, countryCode);
        return res.json({ ok: true, items: totals.items, subtotal: totals.subtotal, currency: 'SAR', mode: 'service' });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}
app.put('/api/market/cart', cartLimiter, requireAuth, withValidation(schemas.cartReplace), cartPutHandler);
app.put('/api/v1/market/cart', cartLimiter, requireAuth, withValidation(schemas.cartReplace), cartPutHandler);
app.put('/api/v1/cart', cartLimiter, requireAuth, withValidation(schemas.cartReplace), cartPutHandler);

// Merge guest items into authenticated cart
async function cartMergeHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const countryCode = (req.query.countryCode || 'SA').toUpperCase();
        const { items, mode='add' } = req.body || {};
        if (mode === 'replace') {
            await cartService.replaceCart({ userId, items, countryCode });
        } else {
            await cartService.mergeItems({ userId, items, countryCode });
        }
        try { cartMergeCounter.inc(); } catch(_){}
        const totals = await cartService.computeTotals(userId, countryCode);
        audit('cart_merged',{ merged: items.length, mode, subtotal: totals.subtotal },req);
        return res.json({ ok: true, merged: items.length, mode, items: totals.items, subtotal: totals.subtotal });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}
app.post('/api/market/cart/merge', cartLimiter, requireAuth, withValidation(schemas.cartMerge), cartMergeHandler);
app.post('/api/v1/market/cart/merge', cartLimiter, requireAuth, withValidation(schemas.cartMerge), cartMergeHandler);

// --- MVP: Orders (memory) ---
async function ordersPostHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        if (!userId || userId === 'guest') return res.status(401).json({ ok: false, error: 'unauthenticated' });
        const { currency = 'SAR' } = req.body || {};
        const result = await orderService.createOrderFromCart({ userId, currency });
        if (!result.ok) return res.status(400).json(result);
        // Track for suggestion fallback
        _ordersForSuggest.push({ userId, items: (result.items || []) });
        audit('order_created',{ orderId: result.id, total: result.total, currency },req);
        res.status(201).json({ ok: true, id: result.id, total: result.total, currency, mode: 'service' });
    } catch (e) { try { orderErrors.inc(); } catch (_) {} res.status(500).json({ ok: false, error: e.message }); }
}
app.post('/api/market/orders', ordersLimiter, requireAuth, withValidation(schemas.orderCreate), ordersPostHandler);
app.post('/api/v1/market/orders', ordersLimiter, requireAuth, withValidation(schemas.orderCreate), ordersPostHandler);

// --- Orders query (list + byId)
async function ordersListHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const { q=null, paymentStatus=null, fulfillmentStatus=null, from=null, to=null, sort='createdAt_desc' } = req.query || {};
        const r = await orderService.listOrdersForUser({ userId, page, limit, q, paymentStatus, fulfillmentStatus, from, to, sort });
        res.json({ ok: true, items: r.items || [], total: r.total || 0, page, limit, mode: 'service' });
    } catch (e) { try { orderErrors.inc(); } catch (_) {} res.status(500).json({ ok: false, error: e.message }); }
}
app.get('/api/market/orders', ordersLimiter, requireAuth, ordersListHandler);
app.get('/api/v1/market/orders', ordersLimiter, requireAuth, ordersListHandler);

async function orderGetByIdHandler(req, res) {
    try {
        const userId = resolveUserId(req);
        const id = String(req.params.id||'');
        const r = await orderService.getOrderByIdForUser({ id, userId });
        if(!r) return res.status(404).json({ ok: false, error: 'not_found' });
        res.json({ ok: true, item: r, mode: 'service' });
    } catch (e) { try { orderErrors.inc(); } catch (_) {} res.status(500).json({ ok: false, error: e.message }); }
}
app.get('/api/market/orders/:id', ordersLimiter, requireAuth, orderGetByIdHandler);
app.get('/api/v1/market/orders/:id', ordersLimiter, requireAuth, orderGetByIdHandler);

// Fulfillment transition endpoint
async function orderFulfillmentHandler(req, res){
    try {
        const id = String(req.params.id||'');
        const { to } = req.body || {};
        if(!to) return res.status(400).json({ ok:false, error:'to_required' });
        const allowed = ['processing','shipped','delivered','cancelled'];
        if(!allowed.includes(to)) return res.status(400).json({ ok:false, error:'unsupported_target' });
        // Permissions:
        // processing/shipped: seller/admin
        // cancelled: admin only
        // delivered: seller/admin OR order owner
        const role = (req.user && req.user.role)||'user';
        const order = await orderService.getOrderByIdForUser({ id, userId: req.user.id }); // ensures existence
        if(!order) return res.status(404).json({ ok:false, error:'not_found' });
        const ownerMatch = (order.meta && order.meta.userId === String(req.user.id)) || (order.user && String(order.user) === String(req.user.id));
        function deny(){ return res.status(403).json({ ok:false, error:'forbidden' }); }
        if(to === 'processing' || to === 'shipped'){ if(!(role==='seller' || role==='admin')) return deny(); }
        if(to === 'cancelled'){ if(role!=='admin') return deny(); }
        if(to === 'delivered'){ if(!(role==='seller' || role==='admin' || ownerMatch)) return deny(); }
        const current = order.fulfillmentStatus || 'pending';
        const r = await orderService.updateFulfillment({ id, to });
        if(!r.ok) return res.status(400).json(r);
        try { fulfillmentTransitionsCounter.inc({ from: current, to, role }); } catch(_){}
        audit('order_fulfillment_transition',{ orderId:id, from: r.from, to: r.to, role },req);
        return res.json({ ok:true, id, from: r.from, to: r.to });
    } catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
}
app.post('/api/market/orders/:id/fulfillment', ordersLimiter, requireAuth, orderFulfillmentHandler);
app.post('/api/v1/market/orders/:id/fulfillment', ordersLimiter, requireAuth, orderFulfillmentHandler);

// --- Payment Stub (enabled via MARKET_ENABLE_PAYMENT_STUB=1) ---
// Payment Integration: prefer real provider when PAYMENT_PROVIDER is set; else use stub (if enabled)
const PAYMENT_PROVIDER = String(process.env.PAYMENT_PROVIDER || '').toLowerCase();
if (PAYMENT_PROVIDER === 'stripe') {
    // Provider-specific metrics
    const paymentProviderSuccessCounter = new prom.Counter({ name: 'market_payment_provider_success_total', help: 'Successful provider payment intents (webhook confirmed)', registers:[register] });
    const paymentProviderFailCounter = new prom.Counter({ name: 'market_payment_provider_fail_total', help: 'Failed provider payment intents', registers:[register] });
    const paymentProviderDuration = new prom.Histogram({ name: 'market_payment_provider_duration_seconds', help: 'Latency for provider intent creation', registers:[register], buckets: buckets.length?buckets:[0.05,0.1,0.3,0.5,1,2,3] });
    const LEDGER_ENABLED = /^(1|true)$/i.test(String(process.env.LEDGER_ENABLED || '0'));
    try {
        const stripeProvider = require('./services/market/paymentProviders/stripe');
        let PaymentEvent = null;
        try { PaymentEvent = require('./models/marketplace/PaymentEvent'); } catch(_){ /* model optional */ }
        // Create payment intent (Stripe) -> returns clientSecret for frontend confirmation
        app.post('/api/market/payments/intents', ordersLimiter, requireAuth, async (req, res) => {
            const startHr = process.hrtime.bigint();
            try {
                const { orderId } = req.body || {};
                if(!orderId) return res.status(400).json({ ok:false, error:'orderId_required' });
                const order = await orderService.getOrderByIdForUser({ id: orderId, userId: (req.user && req.user.id) });
                if(!order) return res.status(404).json({ ok:false, error:'order_not_found' });
                if(String(order.paymentStatus||'') === 'paid') return res.status(400).json({ ok:false, error:'already_paid' });
                const amount = Number(order.total||0);
                const r = await stripeProvider.createIntent({ orderId, userId: req.user.id, amount, currency: order.currency || 'SAR' });
                paymentIntentsCounter.inc();
                const dur = Number(process.hrtime.bigint() - startHr)/1e9; paymentProviderDuration.observe(dur);
                audit('payment_intent_provider_created',{ provider:'stripe', intentId:r.intentId, orderId, amount, currency: order.currency||'SAR' },req);
                // Ledger record (intent_created)
                if(LEDGER_ENABLED && PaymentEvent){
                    try {
                        await PaymentEvent.create({
                            intentId: r.intentId,
                            orderId: order._id || undefined,
                            orderNumber: order.orderNumber || undefined,
                            provider: 'stripe',
                            eventType: 'intent_created',
                            status: 'created',
                            amount,
                            currency: order.currency || 'SAR',
                            customerEmail: (req.user && req.user.email) || undefined,
                            metadata: { userId: String(req.user.id), orderId: String(orderId) },
                            raw: null
                        });
                        try { paymentLedgerEventsCounter.inc({ event_type: 'intent_created' }); } catch(_){ }
                    } catch(e){ /* swallow ledger errors to avoid payment disruption */ }
                }
                return res.status(201).json({ ok:true, provider:'stripe', intentId: r.intentId, clientSecret: r.clientSecret });
            } catch (e) { return res.status(500).json({ ok:false, error: e.message }); }
        });
        // Retrieve intent minimal info (ownership via metadata userId)
        app.get('/api/market/payments/:id', ordersLimiter, requireAuth, async (req, res) => {
            try {
                const id = String(req.params.id||'');
                const r = await stripeProvider.retrieveIntent(id);
                if(!r.ok) return res.status(404).json({ ok:false, error:r.error||'not_found' });
                const userMeta = r.raw && r.raw.metadata && r.raw.metadata.userId;
                if(String(userMeta||'') !== String(req.user.id)) return res.status(403).json({ ok:false, error:'forbidden' });
                return res.json({ ok:true, provider:'stripe', intent: { id: r.raw.id, status: r.raw.status, amount: r.raw.amount/100, currency: r.raw.currency.toUpperCase() } });
            } catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
        });
        // Stripe Webhook (raw body required)
        const rawBodyParser = express.raw({ type: 'application/json' });
        app.post('/api/market/payments/webhook', rawBodyParser, async (req, res) => {
            try {
                const sig = req.headers['stripe-signature'];
                const vp = stripeProvider.verifyAndParseWebhook(req.body, sig);
                if(!vp.ok){ paymentProviderFailCounter.inc(); return res.status(400).json({ ok:false, error: vp.error || 'invalid_signature' }); }
                const ev = vp.event;
                if(ev && ev.type === 'payment_intent.succeeded'){ const pi = ev.data && ev.data.object; if(pi){
                    const orderId = pi.metadata && pi.metadata.orderId; const userIdMeta = pi.metadata && pi.metadata.userId;
                    if(orderId){ await orderService.updateOrderStatus({ id: orderId, paymentStatus:'paid' }); }
                    paymentConfirmCounter.inc(); paymentProviderSuccessCounter.inc();
                    audit('payment_webhook_received',{ provider:'stripe', intentId: pi.id, orderId, status: pi.status }, { headers: req.headers, body: undefined, user: { id: userIdMeta } });
                    // Ledger record for successful intent
                    if(LEDGER_ENABLED && PaymentEvent){
                        try {
                            let orderDoc = null;
                            if(orderId){ try { orderDoc = await orderService.getOrderByIdForUser({ id: orderId, userId: userIdMeta }); } catch(_e){} }
                            await PaymentEvent.create({
                                intentId: pi.id,
                                orderId: orderDoc && orderDoc._id || undefined,
                                orderNumber: orderDoc && orderDoc.orderNumber || undefined,
                                provider: 'stripe',
                                eventType: ev.type,
                                status: pi.status,
                                amount: (pi.amount_received || pi.amount || 0) / 100,
                                currency: (pi.currency || 'sar').toUpperCase(),
                                customerEmail: pi.receipt_email || undefined,
                                metadata: Object.assign({}, pi.metadata || {}),
                                raw: ev
                            });
                            try { paymentLedgerEventsCounter.inc({ event_type: ev.type }); } catch(_){ }
                        } catch(e){ /* ignore ledger error */ }
                    }
                }}
                // Generic ledger record for other webhook events (only basic fields)
                if(LEDGER_ENABLED && PaymentEvent && ev && ev.type && (!/payment_intent\.succeeded/i.test(ev.type))){
                    try {
                        const obj = ev.data && ev.data.object;
                        const intentId = obj && (obj.id || obj.payment_intent) || undefined;
                        await PaymentEvent.create({
                            intentId: intentId || 'unknown',
                            orderId: obj && obj.metadata && obj.metadata.orderId || undefined,
                            orderNumber: undefined,
                            provider: 'stripe',
                            eventType: ev.type,
                            status: obj && obj.status || undefined,
                            amount: obj && obj.amount ? (obj.amount/100) : undefined,
                            currency: obj && obj.currency ? String(obj.currency).toUpperCase() : undefined,
                            customerEmail: obj && obj.receipt_email || undefined,
                            metadata: Object.assign({}, obj && obj.metadata || {}),
                            raw: ev
                        });
                        try { paymentLedgerEventsCounter.inc({ event_type: ev.type }); } catch(_){ }
                    } catch(e){ /* ignore generic ledger error */ }
                }
                return res.json({ ok:true });
            } catch(e){ paymentProviderFailCounter.inc(); return res.status(500).json({ ok:false, error:e.message }); }
        });
        // Versioned aliases
        app.post('/api/v1/market/payments/intents', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/payments/intents'}),res,()=>{}));
        app.get('/api/v1/market/payments/:id', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/payments/'+req.params.id}),res,()=>{}));
        app.post('/api/v1/market/payments/webhook', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/payments/webhook'}),res,()=>{}));
        console.log('[market] stripe payment provider endpoints enabled');
    } catch(e){ console.warn('[market] stripe provider init failed, falling back to stub if enabled:', e && e.message); }
}
if (!PAYMENT_PROVIDER && String(process.env.MARKET_ENABLE_PAYMENT_STUB || '1') === '1') {
    try {
        const { createIntent, getIntent, confirmIntent } = require('./services/market/payments');
        app.post('/api/market/payments/intents', ordersLimiter, requireAuth, async (req, res) => {
            try {
                const { orderId } = req.body || {};
                if(!orderId) return res.status(400).json({ ok:false, error:'orderId_required' });
                const order = await orderService.getOrderByIdForUser({ id: orderId, userId: (req.user && req.user.id) });
                if(!order) return res.status(404).json({ ok:false, error:'order_not_found' });
                if(String(order.paymentStatus||'') === 'paid') return res.status(400).json({ ok:false, error:'already_paid' });
                const amount = Number(order.total||0);
                const r = createIntent({ orderId, userId: req.user.id, amount, currency: order.currency || 'SAR' });
                paymentIntentsCounter.inc();
                audit('payment_intent_created',{ intentId: r.intent.id, orderId, amount, currency: order.currency||'SAR' },req);
                return res.status(201).json({ ok:true, intent: r.intent });
            } catch (e) { return res.status(500).json({ ok:false, error: e.message }); }
        });
        app.get('/api/market/payments/:id', ordersLimiter, requireAuth, async (req, res) => {
            const r = getIntent(String(req.params.id||''));
            if(!r.ok) return res.status(404).json({ ok:false, error:'not_found' });
            if(r.intent.userId !== (req.user && req.user.id)) return res.status(403).json({ ok:false, error:'forbidden' });
            return res.json({ ok:true, intent: r.intent });
        });
        app.post('/api/market/payments/:id/confirm', ordersLimiter, requireAuth, async (req, res) => {
            try {
                const id = String(req.params.id||'');
                const r = getIntent(id);
                if(!r.ok) return res.status(404).json({ ok:false, error:'not_found' });
                if(r.intent.userId !== (req.user && req.user.id)) return res.status(403).json({ ok:false, error:'forbidden' });
                if(r.intent.status === 'succeeded') return res.status(400).json({ ok:false, error:'already_confirmed' });
                const c = confirmIntent(id);
                paymentConfirmCounter.inc();
                await orderService.updateOrderStatus({ id: r.intent.orderId, paymentStatus:'paid' });
                audit('payment_confirmed',{ intentId:id, orderId:r.intent.orderId, amount:r.intent.amount },req);
                return res.json({ ok:true, intent: c.intent });
            } catch(e){ return res.status(500).json({ ok:false, error:e.message }); }
        });
        app.post('/api/v1/market/payments/intents', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/payments/intents'}),res,()=>{}));
        app.get('/api/v1/market/payments/:id', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/payments/'+req.params.id}),res,()=>{}));
        app.post('/api/v1/market/payments/:id/confirm', (req,res)=> app._router.handle(Object.assign(req,{ url:'/api/market/payments/'+req.params.id+'/confirm'}),res,()=>{}));
        console.log('[market] payment stub endpoints enabled');
    } catch(e){ console.warn('[market] payment stub failed to init:', e && e.message); }
}

// --- MVP: Search Suggest (memory / mongo) ---
async function searchSuggestHandler(req, res) {
    const q = (req.query.q || '').toString().trim().toLowerCase();
    if (!q) return res.json({ ok: true, items: [] });
    try {
        const data = await rebuildSuggestIfNeeded();
        const filtered = data.filter(it => (it.text || '').toLowerCase().includes(q) || (it.value || '').toLowerCase().includes(q)).slice(0, 10);
        return res.json({ ok: true, items: filtered });
    } catch (e) {
        return res.json({ ok: true, items: [] });
    }
}
app.get('/api/market/search/suggest', searchSuggestHandler);
app.get('/api/v1/market/search/suggest', searchSuggestHandler);

// --- Media Upload (seller/admin only) ---
async function mediaUploadHandler(req, res) {
    try {
        const { filename, contentType, data } = req.body || {};
        if (!data) return res.status(400).json({ ok: false, error: 'data_base64_required' });
        const buf = Buffer.from(String(data), 'base64');
        const MAX = Number(process.env.MARKET_MEDIA_MAX_BYTES || 5 * 1024 * 1024);
        if (buf.length > MAX) return res.status(413).json({ ok: false, error: 'payload_too_large', max: MAX });
        const ct = String(contentType || '').toLowerCase();
        if (!ALLOWED_TYPES.includes(ct)) return res.status(415).json({ ok: false, error: 'unsupported_media_type' });
        const r = await uploadBuffer({ buffer: buf, contentType: ct, filename });
        if (!r.ok) return res.status(500).json({ ok: false, error: r.error || 'store_failed' });
        const ttl = Number(process.env.MEDIA_SIGN_TTL_SECONDS || 3600);
        const url = await getSignedUrl(r.key, ttl);
        const variants = {};
        for (const k of Object.keys(r.variants || {})) {
            variants[k] = { key: r.variants[k].key, url: await getSignedUrl(r.variants[k].key, ttl) };
        }
        return res.status(201).json({ ok: true, key: r.key, url, variants });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}
app.post('/api/market/media/upload', uploadLimiter, requireAuth, requireRole(['seller', 'admin']), mediaUploadHandler);
app.post('/api/v1/market/media/upload', uploadLimiter, requireAuth, requireRole(['seller', 'admin']), mediaUploadHandler);

// --- Legacy & Fallback Endpoints ---
app.get('/items/data', (req, res) => {
    // Provide basic fallback using products controller with limited fields
    req.query.page = 1; req.query.limit = 50;
    listProducts(req, { json: (payload) => res.json({ items: (payload.items || []), total: payload.total || 0, fallback: true }) });
});
app.get('/products', (req, res) => listProducts(req, { json: (p) => res.json(p) }));
// Dev/test-only: allow creating product via legacy path when not in production
if (String(process.env.MARKET_ENABLE_DEV_LEGACY || '0') === '1' && String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    app.post('/products', (req, res) => {
        const b = req.body || {};
        if (!b.name) {
            req.body = Object.assign({}, b, { name: 'Dev Product', price: 99, currency: 'SAR', vendorId: 'dev', countryCode: 'SA', category: 'stone' });
        }
        return createProduct(req, res);
    });
    // Dev-only delete via legacy path
    app.delete('/products/:id', (req, res) => {
        try {
            const ctrl = require('./src/controllers/productsController');
            return ctrl.deleteProduct(req, res);
        } catch (e) { return res.status(500).json({ ok: false, error: e && e.message || String(e) }); }
    });
}

if (require.main === module) { start(); }
// Global diagnostics to prevent silent exits
process.on('uncaughtException', err => {
    console.error('[market][uncaughtException]', err && err.stack || err);
});
process.on('unhandledRejection', err => {
    console.error('[market][unhandledRejection]', err && err.stack || err);
});
module.exports = { app };

// Optional redirects to versioned API (enable via MARKET_REDIRECT_TO_V1=1)
if (String(process.env.MARKET_REDIRECT_TO_V1 || '').toLowerCase() === '1') {
    try {
        app.use('/api/market', (req, res) => res.redirect(308, '/api/v1/market' + (req.url || '')));
        // Cart and auth convenience top-level redirects
        app.use('/api/cart', (req, res) => res.redirect(308, '/api/v1/cart' + (req.url || '')));
        app.use('/api/auth', (req, res) => res.redirect(308, '/api/v1/auth' + (req.url || '')));
    } catch (_) { /* ignore */ }
}

// Standard health/readiness endpoints
app.get('/healthz', (_req, res) => { try { heartbeatCounter.inc(); } catch(_) {} return res.json({ status: 'ok', service: 'market' }); });
app.get('/readyz', (_req, res) => {
    const dbRequired = (String(process.env.MARKET_DB || 'mongo').toLowerCase() === 'mongo') && String(process.env.MARKET_ALLOW_DB_FAIL || '0') !== '1';
    const dbReady = isConnected();
    const jwksConfigured = !!(process.env.AUTH_JWKS_URL || process.env.MARKET_JWKS_URL);
    let jwksReady = true;
    try { if (jwksConfigured) { const all = jwks.getAll(); jwksReady = Object.keys(all || {}).length > 0; } } catch(_) {}
    const ready = (!dbRequired || dbReady) && (!jwksConfigured || jwksReady);
    const body = { ready, dbConnected: dbReady, jwksReady };
    return ready ? res.json(body) : res.status(503).json(body);
});
// Prometheus scrape endpoint
app.get('/metrics', async (_req, res) => {
    if (!metricsEnabled) return res.status(404).end();
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (e) { res.status(500).end(String(e && e.message || e)); }
});

// Centralized error handler (after routes)
app.use(errorHandler);
