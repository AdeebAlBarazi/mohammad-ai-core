// market-server.js - LEGACY/EXPERIMENTAL
// NOTE: Official entrypoint is server.js. This file remains for
// legacy experiments and extended stubs (RBAC/ranking/media). Prefer
// migrating features into server.js for production usage.
// Expanded stub marketplace microservice with country tenancy & ingestion (rbac updated + debug logging)
// Optional env loader for monorepo setups; ignore if not present
try { require('./systems/config/env/loader'); } catch (_) { /* no-op */ }
require('dotenv').config();
const express = require('express');
const { pipeline } = require('./utils/market/ingest');
const { addProduct, searchProducts, ensureCountry } = require('./utils/market/store');
const productService = require('./services/market/productService');
const quoteService = require('./services/market/quoteService');
const cartService = require('./services/market/cartService');
const orderService = require('./services/market/orderService');
const vendorService = require('./services/market/vendorService');
const handleService = require('./services/market/handleService');
const messageService = require('./services/market/messageService');
const { computeFinalScore } = require('./services/market/credibilityService');
const path = require('path');
const fs = require('fs');
const { connectMarketDB, getDbType, isMongoReady } = require('./config/market-db');
const { body: vbody, validationResult } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const mediaStorage = require('./services/market/mediaStorage');
const payments = require('./services/market/payments');

const app = express();
const TEST_MODE = process.env.MARKET_TEST === '1';
// Trust proxy for accurate IP (rate limiting, logging) when behind LB
if (process.env.TRUST_PROXY === '1') { app.set('trust proxy', true); }
// Body parser with explicit size cap
app.use(express.json({ limit: process.env.BODY_LIMIT || '2mb' }));

// --- Security Middlewares (Helmet + CORS) ---
const helmet = require('helmet');
const cors = require('cors');
// Basic helmet with minimal CSP (adjust for production static asset domains)
app.use(helmet({
	contentSecurityPolicy: process.env.ENABLE_CSP === '1' ? {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:"],
			objectSrc: ["'none'"],
			connectSrc: ["'self'"]
		}
	} : false,
	crossOriginResourcePolicy: { policy: 'same-site' }
}));

// CORS allowed origins list (comma-separated). Empty => allow all (dev only)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
const devOrigins = ['http://127.0.0.1:5501', 'http://localhost:5501', 'http://localhost:3000', 'http://127.0.0.1:3000'];
const allowSet = new Set([...allowedOrigins, ...(process.env.NODE_ENV === 'production' ? [] : devOrigins)]);
app.use(cors({
	origin: function (origin, cb) {
		// non-browser requests or same-origin
		if (!origin) return cb(null, true);
		// If no restrictions configured, allow all in dev
		if (allowSet.size === 0) return cb(null, true);
		if (allowSet.has(origin)) return cb(null, true);
		return cb(new Error('CORS_DENIED'));
	},
	credentials: true,
	exposedHeaders: ['X-Market-Version', 'X-Request-Id', 'X-Trace-Id', 'ETag']
}));

// CORS error handler
app.use((err, req, res, next) => {
	if (err && err.message === 'CORS_DENIED') {
		return res.status(403).json({ ok: false, code: 'CORS_DENIED', message: 'Origin not allowed' });
	}
	return next(err);
});

// Observability config and helpers
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 300);
const MARKET_VERSION = process.env.MARKET_VERSION || '2025.11.0';
const crypto = require('crypto');
const cache = require('./services/market/cache');
const rankAuto = require('./services/market/rankAutoTune');
const interactions = require('./services/market/interactionsTracker');
function genId(n = 8) { try { return crypto.randomBytes(n).toString('hex'); } catch (_e) { return Math.random().toString(16).slice(2, 2 + n * 2); } }
function logEvent(evt) {
	try { console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'market', ...evt })); } catch (_e) { /* ignore */ }
}
let dailyMetrics = { date: new Date().toISOString().slice(0, 10), productsIngested: 0, quotesCreated: 0, cartOps: 0, startedAt: Date.now() };
function rollMetricsIfNeeded() {
	const today = new Date().toISOString().slice(0, 10);
	if (dailyMetrics.date !== today) { dailyMetrics = { date: today, productsIngested: 0, quotesCreated: 0, cartOps: 0, startedAt: Date.now() }; }
}

// Global headers: version + request/trace ids
app.use((req, res, next) => {
	res.setHeader('X-Market-Version', MARKET_VERSION);
	const inReqId = req.headers['x-request-id'];
	req.requestId = (Array.isArray(inReqId) ? inReqId[0] : inReqId) || genId(8);
	req.traceId = genId(8);
	res.setHeader('X-Request-Id', req.requestId);
	res.setHeader('X-Trace-Id', req.traceId);
	req._startAt = Date.now();
	next();
});

// Simple in-memory rate limiter for search endpoint (skip in test mode)
const rateStore = new Map(); // key => { count, reset }
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000); // 1 minute
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 120); // requests per key per window
function rateKey(req) {
	const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
	const country = (req.query.country || 'SA').toString().toUpperCase();
	return `${ip}|${country}`;
}
function rateLimit(req, res, next) {
	if (TEST_MODE) return next();
	const key = rateKey(req);
	const now = Date.now();
	const rec = rateStore.get(key) || { count: 0, reset: now + RATE_WINDOW_MS };
	if (now > rec.reset) { rec.count = 0; rec.reset = now + RATE_WINDOW_MS; }
	rec.count += 1;
	rateStore.set(key, rec);
	res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
	res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT - rec.count).toString());
	res.setHeader('X-RateLimit-Reset', rec.reset.toString());
	if (rec.count > RATE_LIMIT) {
		return res.status(429).json({ ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' });
	}
	next();
}

// Unified error helper
function sendError(res, status, code, message, extra) {
	const body = { ok: false, code, message, error: message, ...extra };
	return res.status(status).json(body);
}

// Load tenant config
let tenants = { countries: [] };
try {
	// Read from local config folder within marketplace service
	const raw = fs.readFileSync(path.join(__dirname, 'config', 'tenants.json'), 'utf8');
	tenants = JSON.parse(raw);
} catch (e) {
	console.warn('[market] tenants.json not found or invalid, proceeding with empty config');
}

// Attempt marketplace DB connection (mongo or memory fallback)
(async () => {
	const result = await connectMarketDB();
	if (result.ok) {
		console.log(`[market-db] Connected using type: ${getDbType()}`);
		// Optional: auto-create indexes once on start when using Mongo
		if (getDbType() === 'mongo' && String(process.env.MARKET_CREATE_INDEXES_ON_START || '').toLowerCase() === '1') {
			try {
				const { spawn } = require('child_process');
				const child = spawn(process.execPath, ['scripts/market_create_indexes.js'], { cwd: __dirname, stdio: 'inherit', env: process.env });
				child.on('exit', (code) => {
					if (code === 0) console.log('[market-db] indexes ensured');
					else console.warn('[market-db] index script exited with code', code);
				});
			} catch (e) {
				console.warn('[market-db] failed to spawn index creation script:', e && e.message);
			}
		}
		// Optional: seed demo data into Mongo on start (idempotent)
		if (getDbType() === 'mongo' && String(process.env.MARKET_SEED_DEMO || '').toLowerCase() === '1') {
			try {
				const MpProduct = require('./models/marketplace/Product');
				const samples = [
					{ name: 'Breccia Marble Slab A', material: 'Breccia', price: 250, currency: 'SAR', countryCode: 'SA', stock: 10, sku: 'SA-101-07-A1' },
					{ name: 'Breccia Marble Slab B', material: 'Breccia', price: 310, currency: 'SAR', countryCode: 'SA', stock: 8, sku: 'SA-101-07-B1' },
					{ name: 'Breccia Marble Slab C', material: 'Breccia', price: 205, currency: 'SAR', countryCode: 'SA', stock: 15, sku: 'SA-102-07-C1' }
				];
				let upserts = 0;
				for (const s of samples) {
					const r = await MpProduct.updateOne({ sku: s.sku }, { $setOnInsert: Object.assign({ active: true }, s) }, { upsert: true });
					if (r.upsertedCount === 1) upserts += 1;
				}
				console.log(`[market-db] demo seed ensured (root market) upserts=${upserts}`);
			} catch (e) {
				console.warn('[market-db] demo seed failed (root market):', e && e.message);
			}
		}
	} else {
		console.warn('[market-db] Connection issue:', result.error);
	}
})();
// (duplicate tenant loading removed)

function resolveCountry(req) {
	// priority: explicit query ?country=SA, then host mapping
	if (req.query.country) return String(req.query.country).toUpperCase();
	const host = (req.headers.host || '').toLowerCase();
	for (const c of tenants.countries) {
		if ((c.domains || []).some(d => host.includes(d.toLowerCase()))) return c.code.toUpperCase();
	}
	return (tenants.countries[0] && tenants.countries[0].code) || 'SA';
}

app.get('/', (req, res) => res.send('Marketplace Service Root'));
app.get('/api/status', (req, res) => res.json({ service: 'market', status: 'ok', countries: tenants.countries.map(c => c.code), dbType: getDbType(), mongoReady: isMongoReady() }));
// Kubernetes-friendly health endpoints
app.get('/healthz', (req, res) => res.status(200).send('ok'));
app.get('/readyz', (req, res) => {
	const ready = getDbType() !== 'mongo' || isMongoReady();
	return res.status(ready ? 200 : 503).json({ ok: ready, dbType: getDbType(), mongoReady: isMongoReady() });
});

// --- RBAC middleware (JWT-based) ---
const { requireSeller, requireAuth, requireRole, ensureUser } = require('./middleware/rbac');
// Auth introspection endpoint
app.get('/api/market/auth/me', async (req, res) => {
	const u = await ensureUser(req);
	if (!u) return res.json({ authenticated: false });
	// Attach handle if exists (memory lookup; DB path can be resolved in service layer later)
	const country = resolveCountry(req);
	let userHandle = null;
	try { const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' }); userHandle = h && h.handle; } catch (_) {/* ignore */ }
	res.json({ authenticated: true, user: Object.assign({}, u, userHandle ? { handle: userHandle } : {}) });
});
// Ingest endpoint (vendor product upload simulation)
app.post('/api/market/ingest', async (req, res) => {
	const body = req.body || {};
	body.countryCode = body.countryCode || resolveCountry(req);
	const result = pipeline(body);
	if (!result.ok) {
		return res.status(400).json(result);
	}
	// Enforce SKU uniqueness (memory store path)
	const bucket = ensureCountry(result.product.countryCode);
	let finalSku = result.sku;
	try {
		const { generateSku, randomIdHex } = require('./utils/market/sku');
		const exists = (sku) => (bucket.products || []).some(p => p.sku === sku);
		let attempts = 0;
		while (exists(finalSku) && attempts < 5) {
			finalSku = generateSku({ countryCode: result.product.countryCode, vendorId: result.product.vendorId, categoryId: result.product.categoryId, productId: randomIdHex(4) });
			attempts++;
		}
	} catch (_e) { /* ignore */ }
	addProduct(result.product.countryCode, {
		...result.product,
		sku: finalSku,
		price: body.price || null,
		vendorRating: body.vendorRating || null,
		warehouseRating: body.warehouseRating || null,
		employeeRating: body.employeeRating || null
	});
	rollMetricsIfNeeded();
	dailyMetrics.productsIngested += 1;
	try { await cache.bumpVersion(result.product.countryCode); } catch (_) { }
	logEvent({ event: 'ingest', requestId: req.requestId, traceId: req.traceId, ok: true, sku: result.sku, country: result.product.countryCode });
	return res.json({ success: true, sku: finalSku, dbType: getDbType(), mongoReady: isMongoReady() });
});

// Products facade: alias to ingest and search
// Basic payload validation for product creation (non-breaking: validates only if fields exist)
const ALLOWED_CURRENCIES = (process.env.ALLOWED_CURRENCIES || 'SAR,USD,AED,EUR').split(',').map(s => s.trim().toUpperCase());
const createProductValidators = [
	vbody('name').optional().isString().isLength({ min: 1, max: 200 }).withMessage('name must be a non-empty string'),
	vbody('price').optional().isFloat({ min: 0 }).withMessage('price must be >= 0'),
	vbody('stock').optional().isInt({ min: 0 }).withMessage('stock must be >= 0'),
	vbody('currency').optional().toUpperCase().isIn(ALLOWED_CURRENCIES).withMessage('currency not allowed'),
	vbody('thicknessCm').optional().isFloat({ min: 0 }).withMessage('thicknessCm must be >= 0'),
	vbody('thicknessMm').optional().isFloat({ min: 0 }).withMessage('thicknessMm must be >= 0'),
];

app.post('/api/market/products', createProductValidators, async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request payload', { errors: errors.array() });
	}
	try {
		const body = req.body || {};
		body.countryCode = body.countryCode || resolveCountry(req);
		const out = await productService.createFromIngest(body);
		if (!out.ok) {
			logEvent({ event: 'ingest', level: 'warn', requestId: req.requestId, traceId: req.traceId, ok: false, message: out.error || 'ingest failed' });
			return res.status(400).json(out);
		}
		rollMetricsIfNeeded();
		dailyMetrics.productsIngested += 1;
		try { await cache.bumpVersion(body.countryCode); } catch (_) { }
		logEvent({ event: 'ingest', requestId: req.requestId, traceId: req.traceId, ok: true, sku: out.sku || (out.product && out.product.sku) || null, country: body.countryCode });
		res.json(out);
	} catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Search endpoint with filters
app.get('/api/market/items/data', (req, res) => {
	const country = resolveCountry(req);
	const { page = 1, limit = 20 } = req.query;
	const LIM_CAP = Number(process.env.MARKET_LIMIT_MAX || 100);
	if (Number(limit) > LIM_CAP) {
		return sendError(res, 400, 'LIMIT_TOO_HIGH', `limit cannot exceed ${LIM_CAP}`, { max: LIM_CAP });
	}
	const data = searchProducts(country, {
		q: req.query.q,
		type: req.query.type,
		thickness: req.query.thickness,
		vendorRatingMin: req.query.vendorRatingMin,
		warehouseRatingMin: req.query.warehouseRatingMin,
		employeeRatingMin: req.query.employeeRatingMin,
		priceMin: req.query.priceMin,
		priceMax: req.query.priceMax,
		page: Number(page),
		limit: Number(limit)
	});
	res.json({ ...data, country, dbType: getDbType(), mongoReady: isMongoReady() });
});

// Standardized products search path
app.get('/api/market/products', rateLimit, async (req, res) => {
	const country = resolveCountry(req);
	const { page = 1, limit = 20 } = req.query;
	// Enforce hard cap on limit to prevent huge payloads
	const LIM_CAP = Number(process.env.MARKET_LIMIT_MAX || 100);
	if (Number(limit) > LIM_CAP) {
		return sendError(res, 400, 'LIMIT_TOO_HIGH', `limit cannot exceed ${LIM_CAP}`, { max: LIM_CAP });
	}
	// Normalize expand: support comma-separated values
	const rawExpand = req.query.expand;
	const allowed = new Set(['none', 'vendor', 'warehouse', 'both', 'media', 'variants', 'all']);
	let expand = 'both';
	if (rawExpand) {
		const parts = String(rawExpand).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
		const invalid = parts.filter(p => !allowed.has(p) && p !== '');
		if (invalid.length) {
			return sendError(res, 400, 'VALIDATION_ERROR', `Invalid expand value(s): ${invalid.join(', ')}`, { allowed: Array.from(allowed) });
		}
		const set = new Set(parts);
		if (set.has('none') && set.size > 1) {
			return res.status(400).json({ ok: false, error: 'expand conflict: none cannot be combined with other values' });
		}
		// Normalize 'both' -> vendor+warehouse, 'all' -> vendor+warehouse+media
		if (set.has('both')) { set.delete('both'); set.add('vendor'); set.add('warehouse'); }
		if (set.has('all')) { set.delete('all'); set.add('vendor'); set.add('warehouse'); set.add('media'); set.add('variants'); }
		// Derive final string classification for backwards compatibility in response
		if (set.has('none')) {
			expand = 'none';
		} else if (set.has('vendor') && set.has('warehouse') && set.has('media')) {
			expand = 'all';
		} else if (set.has('vendor') && set.has('warehouse')) {
			expand = 'both';
		} else if (set.has('vendor')) {
			expand = 'vendor';
		} else if (set.has('warehouse')) {
			expand = 'warehouse';
		} else if (set.has('media')) {
			expand = 'media';
		}
		// Attach parsed tokens for downstream usage
		req._expandTokens = Array.from(set);
	}
	if (!req._expandTokens) {
		// default when not provided: vendor + warehouse
		req._expandTokens = ['vendor', 'warehouse'];
	}

	// Validate sort parameter explicitly
	const rawSort = req.query.sort;
	const allowedSorts = new Set(['rank', 'price_asc', 'price_desc', 'newest', 'popular']);
	let sort = undefined;
	if (rawSort !== undefined) {
		sort = String(rawSort).toLowerCase();
		if (!allowedSorts.has(sort)) {
			return sendError(res, 400, 'VALIDATION_ERROR', `Invalid sort value: ${rawSort}`, { allowed: Array.from(allowedSorts) });
		}
	}

	// Parse mode (e.g., facets)
	let mode = undefined;
	if (typeof req.query.mode === 'string' && req.query.mode.trim()) {
		const m = req.query.mode.trim().toLowerCase();
		if (m === 'facets') mode = 'facets';
	}

	try {
		// Auto-tune update attempt (cheap check once per request cycle on page=1)
		let tuned = null;
		try { tuned = await rankAuto.maybeUpdate(); } catch (_e) { /* ignore */ }
		const rankTuneVer = tuned ? tuned.version : '';
		const data = await (async () => {
			const isFirstPage = Number(page) === 1;
			const cacheEligible = isFirstPage; // refine later if needed
			if (cacheEligible) {
				const key = cache.buildKey(country, { ...req.query, sort, expand, mode, rankTuneVer, sign: process.env.MEDIA_SIGNING_ENABLED === '1' ? '1' : '' });
				const cached = await cache.get(key);
				if (cached) {
					logEvent({ event: 'search_cache_hit', requestId: req.requestId, traceId: req.traceId, key });
					return { ...cached, _fromCache: true };
				}
				const fresh = await productService.search(country, { ...req.query, sort, page, limit, expand, mode, _expandTokens: req._expandTokens, rankTuneVer, tunedWeights: tuned && tuned.weights });
				await cache.set(key, fresh, Number(process.env.MARKET_CACHE_TTL_MS || 30000));
				return fresh;
			}
			return await productService.search(country, { ...req.query, sort, page, limit, expand, mode, _expandTokens: req._expandTokens, rankTuneVer, tunedWeights: tuned && tuned.weights });
		})();
		// Add meta sizes
		const payload = { ...data, country, expand, dbType: getDbType(), mongoReady: isMongoReady(), rankTuneVer };
		let mediaBytes = 0;
		try {
			const items = Array.isArray(payload.items) ? payload.items : [];
			for (const it of items) { if (Array.isArray(it.media)) mediaBytes += Buffer.byteLength(JSON.stringify(it.media)); }
		} catch (_e) { /* ignore */ }
		payload.meta = Object.assign({}, data.meta || {}, { mediaBytes, traceId: req.traceId, cache: data._fromCache ? 'hit' : 'miss' });
		// Attach effective rank weights info
		try {
			const manual = (typeof req.query.rankWeights === 'string' && req.query.rankWeights.trim()) ? String(req.query.rankWeights).trim() : '';
			const effective = manual || (tuned && tuned.weights ? require('./services/market/rankAutoTune').toStringWeights(tuned.weights) : '');
			if (effective) { payload.meta.rankWeights = effective; }
			if (rankTuneVer) { payload.meta.rankTuneVer = rankTuneVer; }
		} catch (_e) { /* ignore */ }
		// responseBytes measured including meta
		payload.meta.responseBytes = Buffer.byteLength(JSON.stringify(payload));

		// ETag / Last-Modified for page=1 only (stable: avoid volatile meta like traceId/cache)
		if (Number(page) === 1) {
			const stableKey = `${payload.total || 0}|${(payload.items && payload.items[0] && payload.items[0].sku) || ''}`;
			const etag = 'W/"' + Buffer.from(stableKey).toString('base64') + '"';
			res.setHeader('ETag', etag);
			const newest = payload.items && payload.items[0] && payload.items[0].createdAt ? new Date(payload.items[0].createdAt) : new Date();
			res.setHeader('Last-Modified', newest.toUTCString());
			const inm = req.headers['if-none-match'];
			if (inm && inm === etag) { return res.status(304).end(); }
		}

		// log structured
		const durationMs = Date.now() - (req._startAt || Date.now());
		const slowQuery = durationMs > SLOW_QUERY_MS;
		logEvent({
			event: 'search', requestId: req.requestId, traceId: req.traceId, method: 'GET', path: '/api/market/products',
			status: 200, durationMs, slowQuery,
			country, page: Number(page), limit: Number(limit), sort: sort || 'rank', expand, rankTuneVer,
			expandTokens: req._expandTokens, mediaFields: req.query.mediaFields || null,
			total: payload.total || 0, responseBytes: payload.meta.responseBytes, mediaBytes,
			dbType: getDbType(), mongoReady: isMongoReady()
		});
		res.json(payload);
	} catch (e) {
		const durationMs = Date.now() - (req._startAt || Date.now());
		logEvent({ event: 'search', level: 'error', requestId: req.requestId, traceId: req.traceId, method: 'GET', path: '/api/market/products', status: 500, durationMs, message: e.message });
		return sendError(res, 500, 'INTERNAL_ERROR', e.message);
	}
});

// Suggested rank weights endpoint (exposes computed weekly weights & next ETA)
app.get('/api/market/rank/weights/suggested', async (req, res) => {
	try {
		const current = await rankAuto.maybeUpdate();
		const etaMs = current ? (rankAuto.periodMs() - (Date.now() - current.lastUpdate)) : null;
		res.json({ ok: true, enabled: rankAuto.isEnabled(), fallback: current, nextUpdateMs: etaMs });
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

// --- Admin-only endpoints (super_admin) ---
app.get('/api/market/admin/metrics', requireRole(['super_admin']), async (req, res) => {
	try {
		rollMetricsIfNeeded();
		const lru = (typeof cache.stats === 'function') ? cache.stats() : null;
		res.json({ ok: true, dailyMetrics, lru, dbType: getDbType(), mongoReady: isMongoReady() });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// --- Vendor onboarding endpoints ---
// Create vendor org (admin only)
app.post('/api/market/admin/vendors', requireRole(['super_admin']), async (req, res) => {
	try {
		const country = (req.body && req.body.countryCode) || resolveCountry(req);
		const payload = req.body || {};
		if (!payload.companyName || !payload.vendorCode) {
			return sendError(res, 400, 'VALIDATION_ERROR', 'companyName and vendorCode are required');
		}
		const out = await vendorService.createVendor({
			countryCode: country,
			companyName: String(payload.companyName),
			vendorCode: String(payload.vendorCode),
			displayName: payload.displayName || payload.companyName,
			contact: payload.contact || {},
			address: payload.address || {},
			verified: !!payload.verified,
			active: payload.active != null ? !!payload.active : true
		});
		if (!out.ok) return sendError(res, 400, 'BAD_REQUEST', out.error || 'cannot create vendor');
		res.status(201).json({ ok: true, vendor: out.vendor });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// --- Buyer signup handles ---
// Suggest a few handles (no auth required)
app.get('/api/market/handles/suggest', async (req, res) => {
	const country = resolveCountry(req);
	const base = (req.query.base || req.query.name || '').toString();
	const count = Number(req.query.count || 5);
	try {
		const started = Date.now();
		const list = await handleService.suggest({ countryCode: country, base, count: Math.max(1, Math.min(10, count)) });
		const arr = Array.isArray(list) ? list : [];
		// Debug headers to inspect runtime state
		res.setHeader('X-Debug-Items-Type', Array.isArray(list) ? 'array' : (list === null ? 'null' : typeof list));
		res.setHeader('X-Debug-Items-Len', String(arr.length));
		res.setHeader('X-Debug-ElapsedMs', String(Date.now() - started));
		// Use res.json with a plain object literal to avoid any string mangling
		return res.json({ ok: true, items: arr });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Temporary diagnostic endpoint to verify array serialization independently
app.get('/api/market/_diag/test-array', (req, res) => {
	const sample = ['alpha123', 'beta456', 'gamma789'];
	res.setHeader('X-Debug-TestArray', '1');
	return res.json({ ok: true, items: sample });
});

// Claim (reserve) a handle for current user
app.post('/api/market/handles/claim', requireAuth(), async (req, res) => {
	const country = resolveCountry(req);
	const u = req.user;
	let desired = (req.body && req.body.handle) || '';
	desired = String(desired || '').trim();
	if (!desired.startsWith('@')) desired = '@' + desired;
	try {
		const existing = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (existing && existing.handle) {
			return res.json({ ok: true, handle: existing.handle, alreadyOwned: true });
		}
		const out = await handleService.claim({ countryCode: country, userId: u.id || u.userId || '', handle: desired });
		if (!out.ok) {
			if (out.error === 'TAKEN') return res.status(409).json({ ok: false, code: 'TAKEN', message: 'handle already taken' });
			if (out.error === 'INVALID_FORMAT') return res.status(400).json({ ok: false, code: 'INVALID_FORMAT', message: 'invalid handle format' });
			return sendError(res, 400, 'BAD_REQUEST', out.error || 'cannot claim handle');
		}
		res.status(201).json({ ok: true, handle: out.handle });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Get my handle
app.get('/api/market/handles/me', requireAuth(), async (req, res) => {
	try {
		const country = resolveCountry(req);
		const u = req.user;
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		res.json({ ok: true, handle: h && h.handle || null });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// --- Messaging Threads (handles-only) ---
// Create a new thread (must have a handle). participants: array of handles (with or without leading @)
app.post('/api/market/messages/threads', requireAuth(), async (req, res) => {
	const country = resolveCountry(req);
	const u = req.user;
	try {
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (!h || !h.handle) { return sendError(res, 400, 'HANDLE_REQUIRED', 'User must claim a public handle before messaging'); }
		let participants = Array.isArray(req.body && req.body.participants) ? req.body.participants : [];
		const subject = (req.body && req.body.subject) ? String(req.body.subject).slice(0, 200) : undefined;
		participants = participants.map(x => String(x).trim()).filter(Boolean).map(x => x.startsWith('@') ? x : ('@' + x));
		// Remove self handle if present will be re-added inside service
		participants = participants.filter(p => p.toLowerCase() !== h.handle.toLowerCase());
		if (participants.length === 0) return sendError(res, 400, 'VALIDATION_ERROR', 'At least one participant handle required');
		// Basic format validation
		for (const p of participants) { if (!/^@[a-z0-9_]{3,25}$/i.test(p)) return sendError(res, 400, 'INVALID_HANDLE', 'Invalid participant handle format: ' + p); }
		const thread = await messageService.createThread({ countryCode: country, creatorUserId: u.id || u.userId || '', creatorHandle: h.handle, participants, subject });
		res.status(201).json({ ok: true, thread });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// List threads for current user's handle
app.get('/api/market/messages/threads', requireAuth(), async (req, res) => {
	const country = resolveCountry(req);
	const u = req.user;
	const { page = 1, limit = 20 } = req.query || {};
	try {
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (!h || !h.handle) return sendError(res, 400, 'HANDLE_REQUIRED', 'User must claim a public handle before listing threads');
		const data = await messageService.listThreadsForHandle({ countryCode: country, handle: h.handle, page: Number(page), limit: Number(limit) });
		res.json({ ok: true, items: data.items, pagination: { page: Number(page), limit: Number(limit), total: data.total }, meta: { unreadTotal: data.items.reduce((a, b) => a + (b.unreadCount || 0), 0) } });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Get single thread (must be participant)
app.get('/api/market/messages/threads/:id', requireAuth(), async (req, res) => {
	const country = resolveCountry(req); const u = req.user; const id = req.params.id;
	try {
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (!h || !h.handle) return sendError(res, 400, 'HANDLE_REQUIRED', 'User must claim a public handle before accessing threads');
		const thread = await messageService.getThread({ countryCode: country, threadId: id, handle: h.handle });
		if (!thread) return sendError(res, 404, 'NOT_FOUND', 'Thread not found or access denied');
		res.json({ ok: true, thread });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Post a message to thread (must be participant)
app.post('/api/market/messages/threads/:id/messages', requireAuth(), async (req, res) => {
	const country = resolveCountry(req); const u = req.user; const id = req.params.id;
	const content = (req.body && req.body.content) || '';
	try {
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (!h || !h.handle) return sendError(res, 400, 'HANDLE_REQUIRED', 'User must claim a public handle before sending messages');
		const result = await messageService.postMessage({ countryCode: country, threadId: id, authorHandle: h.handle, authorUserId: u.id || u.userId || '', content });
		if (!result.ok) {
			if (result.error === 'THREAD_NOT_FOUND') return sendError(res, 404, 'NOT_FOUND', 'Thread not found');
			if (result.error === 'NOT_PARTICIPANT') return sendError(res, 403, 'FORBIDDEN', 'Not a participant in this thread');
			if (result.error === 'EMPTY_CONTENT') return sendError(res, 400, 'VALIDATION_ERROR', 'Message content required');
			if (result.error === 'CONTENT_TOO_LONG') return sendError(res, 400, 'VALIDATION_ERROR', 'Message content too long');
			return sendError(res, 400, 'BAD_REQUEST', result.error);
		}
		res.status(201).json({ ok: true, message: result.message });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// List messages in a thread (must be participant)
app.get('/api/market/messages/threads/:id/messages', requireAuth(), async (req, res) => {
	const country = resolveCountry(req); const u = req.user; const id = req.params.id;
	const { page = 1, limit = 50, markRead = 'true' } = req.query || {};
	try {
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (!h || !h.handle) return sendError(res, 400, 'HANDLE_REQUIRED', 'User must claim a public handle before reading messages');
		const data = await messageService.listMessages({ countryCode: country, threadId: id, handle: h.handle, page: Number(page), limit: Number(limit), markRead: String(markRead).toLowerCase() !== 'false' });
		if (!data.ok) {
			if (data.error === 'THREAD_NOT_FOUND') return sendError(res, 404, 'NOT_FOUND', 'Thread not found');
			if (data.error === 'NOT_PARTICIPANT') return sendError(res, 403, 'FORBIDDEN', 'Not a participant in this thread');
			return sendError(res, 400, 'BAD_REQUEST', data.error);
		}
		res.json({ ok: true, items: data.items, pagination: { page: Number(page), limit: Number(limit), total: data.total } });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Explicit mark thread as read endpoint
app.post('/api/market/messages/threads/:id/mark-read', requireAuth(), async (req, res) => {
	const country = resolveCountry(req); const u = req.user; const id = req.params.id;
	try {
		const h = await handleService.getForUser({ countryCode: country, userId: u.id || u.userId || '' });
		if (!h || !h.handle) return sendError(res, 400, 'HANDLE_REQUIRED', 'User must claim a public handle before marking read');
		const ok = await messageService.markThreadRead({ countryCode: country, threadId: id, handle: h.handle });
		if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Thread not found or access denied');
		res.json({ ok: true });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Update vendor fields (admin only): displayName, verified, active, contact, address
app.patch('/api/market/admin/vendors/:id', requireRole(['super_admin']), async (req, res) => {
	try {
		const out = await vendorService.updateVendor({ idOrCode: req.params.id, patch: req.body || {} });
		if (!out.ok) return sendError(res, 404, 'NOT_FOUND', out.error || 'vendor not found');
		res.json({ ok: true, vendor: out.vendor });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Add member (admin or vendor owner of same vendor)
app.post('/api/market/vendors/:id/members', requireRole(['super_admin', 'vendor_owner']), async (req, res) => {
	try {
		const { userId, role } = req.body || {};
		if (!userId) return sendError(res, 400, 'VALIDATION_ERROR', 'userId required');
		// If requester is vendor_owner, enforce scoping to their vendorCode
		const requester = req.user || {};
		const uRole = (requester.role || '').toLowerCase();
		if (uRole !== 'super_admin') {
			const v = await vendorService.getByIdOrCode(req.params.id);
			const vCode = v && (v.vendorCode || (v.vendor && v.vendor.code));
			const reqCode = requester.vendorCode || (Array.isArray(requester.vendorCodes) && requester.vendorCodes[0]);
			if (!v || !vCode || !reqCode || String(vCode) !== String(reqCode)) {
				return sendError(res, 403, 'FORBIDDEN', 'Not allowed to modify another vendor');
			}
		}
		const out = await vendorService.addMember({ idOrCode: req.params.id, userId: String(userId), role: role === 'owner' ? 'owner' : 'staff' });
		if (!out.ok) return sendError(res, 404, 'NOT_FOUND', out.error || 'vendor not found');
		res.status(201).json({ ok: true, vendor: out.vendor });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

app.post('/api/market/admin/cache/bump', requireRole(['super_admin']), async (req, res) => {
	try {
		const country = (req.query.country || req.body && req.body.country || 'SA').toString().toUpperCase();
		await cache.bumpVersion(country);
		res.json({ ok: true, country, bumped: true });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Manual rank weights: set/clear
app.post('/api/market/admin/rank/weights', requireRole(['super_admin']), async (req, res) => {
	try {
		const payload = req.body && (req.body.weights || req.body);
		const result = rankAuto.setManualWeights(payload);
		res.json({ ok: true, manual: true, effective: rankAuto.toStringWeights(result && result.weights), version: result && result.version });
	} catch (e) { return sendError(res, 400, 'VALIDATION_ERROR', e.message); }
});

app.delete('/api/market/admin/rank/weights', requireRole(['super_admin']), async (_req, res) => {
	try {
		const result = rankAuto.clearManualWeights();
		res.json({ ok: true, manual: false, effective: result && result.weights ? rankAuto.toStringWeights(result.weights) : null, version: result && result.version });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Reindex: bump cache versions for one or all countries (and optionally prune interactions)
app.post('/api/market/admin/reindex', requireRole(['super_admin']), async (req, res) => {
	try {
		const target = (req.query.country || (req.body && req.body.country) || '').toString().toUpperCase();
		const all = String(req.query.all || (req.body && req.body.all) || (!target)).toLowerCase() === 'true' || !target;
		const bumped = [];
		if (all) {
			const list = Array.isArray(tenants.countries) && tenants.countries.length ? tenants.countries.map(c => c.code.toUpperCase()) : ['SA'];
			for (const c of list) { await cache.bumpVersion(c); bumped.push({ country: c, version: cache.currentVersion(c) }); }
		} else {
			await cache.bumpVersion(target);
			bumped.push({ country: target, version: cache.currentVersion(target) });
		}
		// optional cleanup hooks
		try { interactions && interactions.prune && interactions.prune(); } catch (_e) { }
		res.json({ ok: true, bumped });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// --- Seller Products CRUD ---
// List seller products
app.get('/api/market/seller/products', requireSeller, async (req, res) => {
	try {
		const country = resolveCountry(req);
		const { page = 1, limit = 20, search, status } = req.query || {};
		const vendorId = req.seller.vendorCode;
		const result = await productService.listSellerProducts({ countryCode: country, vendorId, page: Number(page), limit: Number(limit), search, status });
		const data = (result.items || []).map(p => ({
			_id: String(p._id || p.id || p.sku),
			nameAr: p.name,
			nameEn: p.name,
			sku: p.sku,
			price: p.price || 0,
			quantity: p.stock || p.quantity || 0,
			status: (p.active === false) ? 'inactive' : 'active',
			imageUrl: (Array.isArray(p.media) && p.media[0] && (p.media[0].thumb || p.media[0].url)) || undefined
		}));
		const totalPages = Math.max(1, Math.ceil((result.total || 0) / Number(limit || 20)));
		res.json({ success: true, data, pagination: { page: Number(page), limit: Number(limit), totalPages, total: result.total || 0 } });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Create product (seller)
app.post('/api/market/seller/products', requireSeller, async (req, res) => {
	try {
		const country = resolveCountry(req);
		const vendorId = req.seller.vendorCode;
		const body = req.body || {};
		const payload = {
			countryCode: country,
			vendorId,
			categoryId: body.categoryId || '01',
			name: body.nameAr || body.nameEn || body.name || 'New Product',
			material: body.material || 'marble',
			thickness: body.thickness || (body.thicknessCm ? String(body.thicknessCm) : '2'),
			location: body.location || null
		};
		const out = await productService.createFromIngest(Object.assign({}, payload, { price: body.price || 0, currency: body.currency || 'SAR' }));
		if (!out.ok) { return sendError(res, 400, 'VALIDATION_ERROR', out.error || 'Invalid product data'); }
		try { await cache.bumpVersion(country); } catch (_) { }
		res.status(201).json({ success: true, id: out.id || out._id || out.sku, sku: out.sku });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Upload media for a product (seller)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MARKET_MEDIA_MAX_BYTES || 10485760) } });
app.post('/api/market/seller/products/:id/images', requireSeller, upload.array('files', 10), async (req, res) => {
	try {
		const country = resolveCountry(req);
		const id = req.params.id;
		const b = req.body || {};
		const files = Array.isArray(req.files) ? req.files : [];
		const mediaType = (b.type || 'image') === 'video' ? 'video' : ((b.type === 'view360') ? 'view360' : 'image');

		// Optionally update product fields if provided
		let updated = true;
		if (isMongoReady()) {
			try {
				const Product = require('./models/marketplace/Product');
				const prod = await Product.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : undefined }, { sku: id }] }).exec();
				if (!prod) { updated = false; }
				const patch = {};
				if (b.nameAr || b.nameEn || b.name) patch.name = b.nameAr || b.nameEn || b.name;
				if (b.price != null) patch.price = Number(b.price);
				if (Object.keys(patch).length && prod) { await Product.updateOne({ _id: prod._id }, { $set: patch }).exec(); }
			} catch (_e) { /* ignore */ }
		}

		if (!updated) return sendError(res, 404, 'NOT_FOUND', 'Product not found');

		const outItems = [];
		for (const f of files) {
			const ext = (f.originalname && f.originalname.includes('.')) ? f.originalname.split('.').pop().toLowerCase() : 'bin';
			const stamp = Date.now() + '-' + Math.random().toString(16).slice(2, 8);
			const baseName = `${id}-${stamp}.${ext}`;
			const key = `${baseName}`;
			const saved = await mediaStorage.storeBuffer({ key, buffer: f.buffer });
			if (!saved.ok) return sendError(res, 500, 'MEDIA_STORE_FAILED', saved.error || 'cannot store media');
			let thumbUrl = undefined;
			if (mediaType === 'image') {
				try {
					const thumbBuf = await sharp(f.buffer).rotate().resize(400).jpeg({ quality: 80 }).toBuffer();
					const thumbKey = `thumbs/${id}-${stamp}-thumb.jpg`;
					const tSaved = await mediaStorage.storeBuffer({ key: thumbKey, buffer: thumbBuf });
					if (tSaved.ok) { thumbUrl = mediaStorage.publicUrlFor(thumbKey); }
				} catch (_e) { /* ignore thumb failure */ }
			}
			const fileUrl = mediaStorage.publicUrlFor(key);
			outItems.push({ type: mediaType, url: fileUrl, thumb: thumbUrl });
		}

		// Persist media
		if (isMongoReady()) {
			try {
				const MpProduct = require('./models/marketplace/Product');
				const MpProductMedia = require('./models/marketplace/ProductMedia');
				const prod = await MpProduct.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : undefined }, { sku: id }] }).exec();
				if (prod) {
					const docs = outItems.map(m => ({ product: prod._id, type: m.type, url: m.url, thumbUrl: m.thumb, qualityScore: 0 }));
					await MpProductMedia.insertMany(docs);
				}
			} catch (_e) { /* ignore */ }
		} else {
			// In-memory: attach to product in store
			const bucket = require('./utils/market/store').ensureCountry(country);
			const idx = (bucket.products || []).findIndex(p => String(p._id || p.id || p.sku) === id || String(p.sku || '') === id);
			if (idx !== -1) {
				const curr = bucket.products[idx];
				const mediaArr = Array.isArray(curr.media) ? curr.media.slice() : [];
				for (const m of outItems) { mediaArr.push({ type: m.type, url: m.url, thumb: m.thumb }); }
				bucket.products[idx] = Object.assign({}, curr, { media: mediaArr });
			}
		}

		try { await cache.bumpVersion(country); } catch (_) { }
		res.status(201).json({ success: true, count: outItems.length, items: outItems });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Delete product (seller)
app.delete('/api/market/seller/products/:id', requireSeller, async (req, res) => {
	try {
		const country = resolveCountry(req);
		const id = req.params.id;
		const ok = await productService.deleteSellerProduct({ countryCode: country, idOrSku: id });
		if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Product not found or not owned');
		try { await cache.bumpVersion(country); } catch (_) { }
		res.json({ success: true });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// ---- Variants CRUD routes (seller) ----
app.get('/api/market/seller/products/:id/variants', requireSeller, async (req, res) => {
	try {
		const id = req.params.id;
		const items = await productService.listVariantsForProduct({ productId: id });
		res.json({ success: true, items });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

app.post('/api/market/seller/products/:id/variants', requireSeller, async (req, res) => {
	try {
		const id = req.params.id;
		const b = req.body || {};
		const data = {
			thicknessCm: b.thicknessCm != null ? Number(b.thicknessCm) : undefined,
			thicknessMm: b.thicknessMm != null ? Number(b.thicknessMm) : (b.thicknessCm != null ? Number(b.thicknessCm) * 10 : undefined),
			size: b.size || undefined,
			price: Number(b.price || 0),
			currency: b.currency || 'SAR',
			stock: Number(b.stock || b.quantity || 0),
			active: b.active != null ? !!b.active : true
		};
		const v = await productService.createVariantForProduct({ productId: id, data });
		res.status(201).json({ success: true, item: v });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

app.put('/api/market/seller/products/:id/variants/:variantId', requireSeller, async (req, res) => {
	try {
		const id = req.params.id;
		const vid = req.params.variantId;
		const b = req.body || {};
		const patch = {};
		if (b.price != null) patch.price = Number(b.price);
		if (b.currency) patch.currency = String(b.currency);
		if (b.stock != null || b.quantity != null) patch.stock = Number(b.stock || b.quantity);
		if (b.active != null) patch.active = !!b.active;
		if (b.thicknessCm != null) patch.thicknessCm = Number(b.thicknessCm);
		if (b.thicknessMm != null) patch.thicknessMm = Number(b.thicknessMm);
		if (b.size != null) patch.size = String(b.size);
		const v = await productService.updateVariantForProduct({ productId: id, variantId: vid, patch });
		if (!v) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
		res.json({ success: true });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

app.delete('/api/market/seller/products/:id/variants/:variantId', requireSeller, async (req, res) => {
	try {
		const id = req.params.id;
		const vid = req.params.variantId;
		const ok = await productService.deleteVariantForProduct({ productId: id, variantId: vid });
		if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Variant not found');
		res.json({ success: true });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Interaction recording endpoints (phase 6)
app.post('/api/market/interaction/click', (req, res) => {
	const { sku, price, hasMedia } = req.body || {};
	if (!sku) return sendError(res, 400, 'VALIDATION_ERROR', 'sku required');
	interactions.recordClick(sku, { price, hasMedia });
	res.json({ ok: true });
});
app.post('/api/market/interaction/view', (req, res) => {
	const { sku, dwellMs, price, hasMedia } = req.body || {};
	if (!sku) return sendError(res, 400, 'VALIDATION_ERROR', 'sku required');
	interactions.recordView(sku, dwellMs, { price, hasMedia });
	res.json({ ok: true });
});

// Seed demo route
app.post('/api/market/seed-demo', async (req, res) => {
	try {
		const country = resolveCountry(req);
		// If Mongo is connected, seed into Mongo collection idempotently
		if (isMongoReady()) {
			const MpProduct = require('./models/marketplace/Product');
			const samples = [
				{ name: 'Breccia Marble Slab A', material: 'Breccia', price: 250, currency: 'SAR', countryCode: country, stock: 10, sku: 'SA-101-07-A1' },
				{ name: 'Breccia Marble Slab B', material: 'Breccia', price: 310, currency: 'SAR', countryCode: country, stock: 8, sku: 'SA-101-07-B1' },
				{ name: 'Breccia Marble Slab C', material: 'Breccia', price: 205, currency: 'SAR', countryCode: country, stock: 15, sku: 'SA-102-07-C1' }
			];
			let upserts = 0;
			for (const s of samples) {
				const r = await MpProduct.updateOne({ sku: s.sku }, { $setOnInsert: Object.assign({ active: true }, s) }, { upsert: true });
				if (r.upsertedCount === 1) upserts += 1;
			}
			return res.status(201).json({ ok: true, seeded: upserts, mode: 'mongo', country });
		}
		// Fallback to in-memory seeding
		ensureCountry(country);
		const samples = [
			{ name: 'Breccia Marble Slab A', thickness: '2 cm', material: 'Breccia', vendorId: 101, categoryId: '07', countryCode: country, price: 250, vendorRating: 4.6 },
			{ name: 'Breccia Marble Slab B', thickness: '3 cm', material: 'Breccia', vendorId: 101, categoryId: '07', countryCode: country, price: 310, vendorRating: 4.8 },
			{ name: 'Breccia Marble Slab C', thickness: '1.8 cm', material: 'Breccia', vendorId: 102, categoryId: '07', countryCode: country, price: 205, vendorRating: 4.5 }
		];
		samples.forEach(s => {
			const r = pipeline(s);
			if (r.ok) addProduct(country, { ...r.product, sku: r.sku, price: s.price, vendorRating: s.vendorRating });
		});
		return res.json({ ok: true, added: samples.length, mode: 'memory', country });
	} catch (e) {
		return res.status(500).json({ ok: false, error: e.message });
	}
});

// Quote endpoints (persist when DB available)
app.post('/api/market/quotes', requireAuth(), async (req, res) => {
	const country = resolveCountry(req);
	const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
	const currency = req.body && req.body.currency || 'SAR';
	const q = await quoteService.createQuote({ items, countryCode: country, currency });
	if (!q.ok) return sendError(res, 400, 'VALIDATION_ERROR', q.error || 'Invalid quote payload');
	rollMetricsIfNeeded();
	dailyMetrics.quotesCreated += 1;
	logEvent({ event: 'quote', requestId: req.requestId, traceId: req.traceId, ok: true, items: items.length, country });
	res.json({ ...q, dbType: getDbType(), mongoReady: isMongoReady() });
});

// Cart endpoints (userId required in request for stub)
app.get('/api/market/cart', requireAuth(), async (req, res) => {
	let userId = req.query.userId;
	if (!userId && req.user && (req.user.id || req.user.userId)) userId = req.user.id || req.user.userId;
	const country = resolveCountry(req);
	if (!userId) return sendError(res, 400, 'VALIDATION_ERROR', 'userId required');
	const totals = await cartService.computeTotals(userId, country);
	res.json({ ok: true, ...totals, country, dbType: getDbType(), mongoReady: isMongoReady() });
});

app.post('/api/market/cart', requireAuth(), async (req, res) => {
	let userId = req.body && req.body.userId;
	if (!userId && req.user && (req.user.id || req.user.userId)) userId = req.user.id || req.user.userId;
	const { sku, quantity } = req.body || {};
	const country = resolveCountry(req);
	if (!userId || !sku) return sendError(res, 400, 'VALIDATION_ERROR', 'userId and sku required');
	try {
		await cartService.addItem({ userId, sku, quantity: Number(quantity || 1), countryCode: country });
		rollMetricsIfNeeded();
		dailyMetrics.cartOps += 1;
		logEvent({ event: 'cart', action: 'add', requestId: req.requestId, traceId: req.traceId, ok: true, userId, sku, country });
		res.json({ ok: true, dbType: getDbType(), mongoReady: isMongoReady() });
	} catch (e) {
		return sendError(res, 400, 'BAD_REQUEST', e.message);
	}
});

// === Vendor application (buyer -> apply vendor) ===
// In-memory applications (dev mode); for production use DB model
const vendorApplications = new Map(); // key userId -> { status, companyName, vendorCode, submittedAt }

// Apply to become vendor (authenticated user without vendorCode)
app.post('/api/market/vendors/apply', requireAuth(), async (req, res) => {
	try {
		const u = req.user;
		const userId = u.id || u.userId;
		if (!userId) return sendError(res, 400, 'USER_UNKNOWN', 'Cannot resolve userId');
		// If already vendor (approved) or has vendorCode
		if (u.vendorCode) {
			return res.json({ ok: true, alreadyVendor: true, status: 'approved', vendorCode: u.vendorCode });
		}
		const existing = vendorApplications.get(userId);
		if (existing) {
			return res.json({ ok: true, alreadyApplied: true, application: existing });
		}
		const companyName = (req.body && req.body.companyName) ? String(req.body.companyName).trim() : 'شركة جديدة';
		const vendorCode = (req.body && req.body.desiredCode) ? String(req.body.desiredCode).trim().toUpperCase() : ('V' + Math.random().toString(16).slice(2, 6).toUpperCase());
		const record = { status: 'applied', companyName, vendorCode, submittedAt: new Date().toISOString() };
		vendorApplications.set(userId, record);
		return res.status(201).json({ ok: true, application: record });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Check my application status
app.get('/api/market/vendors/application', requireAuth(), async (req, res) => {
	try {
		const u = req.user; const userId = u.id || u.userId;
		if (u.vendorCode) {
			return res.json({ ok: true, status: 'approved', vendorCode: u.vendorCode });
		}
		const existing = vendorApplications.get(userId);
		if (!existing) {
			return res.json({ ok: true, status: 'none' });
		}
		return res.json({ ok: true, status: existing.status, application: existing });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Dev: approve my application (admin only)
app.post('/api/market/vendors/approve-my', requireRole(['super_admin']), async (req, res) => {
	try {
		const u = req.user; const userId = u.id || u.userId;
		const rec = vendorApplications.get(userId);
		if (!rec) { return sendError(res, 404, 'NOT_FOUND', 'No application to approve'); }
		rec.status = 'approved';
		vendorApplications.set(userId, rec);
		return res.json({ ok: true, status: 'approved', application: rec });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});


app.delete('/api/market/cart', requireAuth(), async (req, res) => {
	let userId = req.query.userId || (req.body && req.body.userId);
	if (!userId && req.user && (req.user.id || req.user.userId)) userId = req.user.id || req.user.userId;
	const sku = req.query.sku || (req.body && req.body.sku);
	const country = resolveCountry(req);
	if (!userId || !sku) return sendError(res, 400, 'VALIDATION_ERROR', 'userId and sku required');
	try {
		await cartService.removeItem({ userId, sku, countryCode: country });
		rollMetricsIfNeeded();
		dailyMetrics.cartOps += 1;
		logEvent({ event: 'cart', action: 'remove', requestId: req.requestId, traceId: req.traceId, ok: true, userId, sku, country });
		res.json({ ok: true, dbType: getDbType(), mongoReady: isMongoReady() });
	} catch (e) {
		return sendError(res, 400, 'BAD_REQUEST', e.message);
	}
});

// Orders endpoints
app.post('/api/market/orders', requireAuth(), async (req, res) => {
	const country = resolveCountry(req);
	let userId = req.user && (req.user.id || req.user.userId);
	if (!userId) return sendError(res, 400, 'VALIDATION_ERROR', 'user not resolved');
	const currency = (req.body && req.body.currency) || 'SAR';
	const shippingAddress = req.body && req.body.shippingAddress || null;
	try {
		const out = await orderService.createOrderFromCart({ userId, countryCode: country, currency, shippingAddress });
		if (!out.ok) { return sendError(res, 400, out.code || 'BAD_REQUEST', out.error || 'Cannot create order'); }
		rollMetricsIfNeeded();
		logEvent({ event: 'order', action: 'create', requestId: req.requestId, traceId: req.traceId, ok: true, userId, country, orderNumber: out.orderNumber });
		res.status(201).json({ ok: true, id: out.id, orderNumber: out.orderNumber, total: out.total, currency: out.currency });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

app.get('/api/market/orders', requireAuth(), async (req, res) => {
	let userId = req.user && (req.user.id || req.user.userId);
	if (!userId) return sendError(res, 400, 'VALIDATION_ERROR', 'user not resolved');
	const { page = 1, limit = 20, q = '', paymentStatus = '', fulfillmentStatus = '', from = '', to = '', sort = 'createdAt_desc' } = req.query || {};
	try {
		const data = await orderService.listOrdersForUser({ userId, page: Number(page), limit: Number(limit), q: q || null, paymentStatus: paymentStatus || null, fulfillmentStatus: fulfillmentStatus || null, from: from || null, to: to || null, sort: sort || 'createdAt_desc' });
		res.json({ ok: true, items: data.items, pagination: { page: Number(page), limit: Number(limit), total: data.total } });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

app.get('/api/market/orders/:id', requireAuth(), async (req, res) => {
	let userId = req.user && (req.user.id || req.user.userId);
	if (!userId) return sendError(res, 400, 'VALIDATION_ERROR', 'user not resolved');
	try {
		const ord = await orderService.getOrderByIdForUser({ id: req.params.id, userId });
		if (!ord) return sendError(res, 404, 'NOT_FOUND', 'Order not found');
		res.json({ ok: true, order: ord });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// --- Payment webhook stub ---
app.post('/api/payments/webhook', async (req, res) => {
	// Accept generic webhook; optional HMAC verification enabled by env.
	try {
		const ver = await payments.verifyWebhook(req);
		if (!ver.ok) { return sendError(res, 400, 'WEBHOOK_VERIFY_FAILED', ver.reason || 'verification failed'); }
		const { orderId, paymentStatus } = req.body || {};
		if (!orderId || !paymentStatus) { return sendError(res, 400, 'VALIDATION_ERROR', 'orderId and paymentStatus required'); }
		const ok = await orderService.updateOrderStatus({ id: orderId, paymentStatus });
		if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Order not found');
		logEvent({ event: 'payment_webhook', requestId: req.requestId, traceId: req.traceId, ok: true, orderId, paymentStatus, verified: payments.isVerificationEnabled() });
		res.json({ ok: true });
	} catch (e) { return sendError(res, 500, 'INTERNAL_ERROR', e.message); }
});

// Credibility compute stub
app.post('/api/market/credibility/compute', (req, res) => {
	const score = computeFinalScore(req.body || {});
	res.json({ ok: true, score });
});

// Metrics endpoint (observability)
app.get('/api/market/metrics', (req, res) => {
	rollMetricsIfNeeded();
	const uptimeMs = Date.now() - (dailyMetrics.startedAt || Date.now());
	const lru = (typeof cache.stats === 'function') ? cache.stats() : null;
	res.json({
		ok: true, date: dailyMetrics.date, counters: {
			productsIngested: dailyMetrics.productsIngested,
			quotesCreated: dailyMetrics.quotesCreated,
			cartOps: dailyMetrics.cartOps
		}, lru, uptimeMs
	});
});

// Simple ping for lighter API base detection (صحي وخفيف)
app.get('/api/market/ping', (req, res) => {
	res.json({ ok: true, service: 'market', version: MARKET_VERSION });
});

// Rank audit endpoint (weights history snapshot + basic interaction metrics)
app.get('/api/market/rank/audit', (req, res) => {
	try {
		const snap = interactions.getSnapshot();
		const current = rankAuto.getFallback();
		// Aggregate basic stats
		let totalClicks = 0, totalViews = 0, totalDwellMs = 0; let withMedia = 0; let withMediaDwell = 0;
		for (const sku in snap) {
			const r = snap[sku];
			totalClicks += r.clicks; totalViews += r.views; totalDwellMs += r.dwellTotalMs;
			if (r.meta && r.meta.hasMedia) { withMedia += r.views; withMediaDwell += r.dwellTotalMs; }
		}
		const avgDwell = totalViews ? Math.round(totalDwellMs / totalViews) : 0;
		const avgMediaDwell = withMedia ? Math.round(withMediaDwell / withMedia) : 0;
		res.json({ ok: true, weights: current, stats: { totalSkus: Object.keys(snap).length, totalClicks, totalViews, avgDwellMs: avgDwell, avgMediaDwellMs: avgMediaDwell } });
	} catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

let PORT = Number(process.env.MARKET_PORT) || 3002;
async function tryListen(p) { return await new Promise(r => { const s = app.listen(p, '0.0.0.0', () => r({ ok: true, server: s })).on('error', e => r({ ok: false, err: e })); }); }
async function start() {
	const candidates = [PORT, 3007, 3012]; let server;
	for (const p of candidates) { const r = await tryListen(p); if (r.ok) { server = r.server; PORT = p; break; } if (r.err && r.err.code === 'EADDRINUSE') { console.warn(`(market) port ${p} in use, trying next...`); } }
	if (!server) { const r = await tryListen(0); if (r.ok) { server = r.server; PORT = server.address().port; console.warn(`(market) falling back to random port ${PORT}`); } }
	if (!server) { console.error('(market) failed to bind any port'); process.exit(1); }
	console.log(`🛒 Market microservice stub running on ${PORT}`);
}
if (!TEST_MODE) { start(); }

module.exports = { app };