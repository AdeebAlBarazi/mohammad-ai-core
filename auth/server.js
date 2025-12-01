const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getAllPublicKeys } = require('../utils/keys');
require('dotenv').config();

const authRoutes = require('./routes/auth');
// Use local middleware path within auth module
const authMiddleware = require('./middleware/auth');
// Logger utilities are under marketplace/utils
const { requestLogger, errorHandler, correlationIdMiddleware } = require('../utils/logger');
const prom = require('prom-client');

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS whitelist using FRONTEND_ORIGIN/ADMIN_ORIGIN, fallback to CORS_ORIGINS
const envOrigins = [process.env.FRONTEND_ORIGIN, process.env.ADMIN_ORIGIN].filter(Boolean).map(o => o.trim()).filter(Boolean);
const corsOrigins = envOrigins.length ? envOrigins : (process.env.CORS_ORIGINS || '*').split(',').map(o => o.trim());
app.use(cors({ origin: (origin, cb) => {
  if (!origin) return cb(null, true);
  if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true);
  return cb(new Error('CORS_DENIED'));
}, credentials: true }));
app.use((err, _req, res, next) => {
  if (err && err.message === 'CORS_DENIED') return res.status(403).json({ ok: false, code: 'CORS_DENIED', message: 'Origin not allowed' });
  return next(err);
});

// Helmet baseline + optional CSP (realistic policy driven by env)
const helmetStack = [];
helmetStack.push(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
if (String(process.env.ENABLE_CSP || '1') === '1') {
  const connectSrc = ["'self'"];
  corsOrigins.forEach(o => { if (o && o !== '*') connectSrc.push(o); });

  let storageOrigin = '';
  try {
    const pub = (process.env.MEDIA_PUBLIC_BASE_URL || '').trim();
    if (pub) { const u = new URL(pub); storageOrigin = u.origin; }
    else if (process.env.MEDIA_S3_BUCKET && process.env.MEDIA_S3_REGION) {
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

  helmetStack.push(helmet.contentSecurityPolicy({
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
helmetStack.forEach(m => app.use(m));

// HTTPS redirect + HSTS when enabled
if (String(process.env.FORCE_HTTPS || '0') === '1') {
  app.use((req, res, next) => {
    const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString();
    if (req.secure || forwardedProto.includes('https')) return next();
    return res.redirect(308, 'https://' + req.headers.host + req.originalUrl);
  });
  const maxAge = Number(process.env.HSTS_MAX_AGE_SECONDS || 15552000);
  app.use(helmet.hsts({ maxAge, includeSubDomains: true, preload: false }));
}

// Rate limiting (global + sensitive endpoints)
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const max = Number(process.env.RATE_LIMIT_MAX || 100);
const generalLimiter = rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
app.use(['/api/auth', '/api/v1/auth'], generalLimiter);
const loginMax = Number(process.env.RATE_LIMIT_LOGIN_MAX || 10);
const registerMax = Number(process.env.RATE_LIMIT_REGISTER_MAX || 10);
const loginLimiter = rateLimit({ windowMs, max: loginMax, standardHeaders: true, legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs, max: registerMax, standardHeaders: true, legacyHeaders: false });

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

// Prometheus metrics (auth)
let metricsEnabled = String(process.env.METRICS_ENABLED || '1') === '1';
const register = new prom.Registry();
prom.collectDefaultMetrics({ register, prefix: process.env.METRICS_PREFIX || 'auth_' });
const reqCounter = new prom.Counter({ name: 'http_requests_total', help: 'Total HTTP requests', registers: [register], labelNames: ['method','route','status'] });
const errCounter = new prom.Counter({ name: 'http_errors_total', help: 'HTTP error class counts', registers: [register], labelNames: ['class','route'] });
const buckets = (process.env.METRICS_BUCKETS || '').split(',').map(x=>Number(x.trim())).filter(x=>!Number.isNaN(x));
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

// Prometheus scrape endpoint(s)
const metricsLimiter = rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000), max: Number(process.env.RATE_LIMIT_METRICS_MAX || 30), standardHeaders: true, legacyHeaders: false });
function scrapeHandler(_req, res) {
  if (!metricsEnabled) return res.status(404).end();
  (async () => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (e) { res.status(500).end(String(e && e.message || e)); }
  })();
}
app.get('/metrics', metricsLimiter, scrapeHandler);
app.get('/api/auth/metrics', metricsLimiter, scrapeHandler);
app.get('/api/v1/auth/metrics', metricsLimiter, scrapeHandler);

// correlation id + unified request logging
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Serve static login page
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Health under root for quick checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth', time: new Date().toISOString() });
});
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'auth' }));
app.get('/readyz', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const body = { ready: dbReady, dbConnected: dbReady };
  return dbReady ? res.json(body) : res.status(503).json(body);
});

// JWKS endpoint(s) to publish the public key for RS256 verification
function loadPublicKeyPem() {
  const fromEnv = process.env.JWT_PUBLIC_KEY && process.env.JWT_PUBLIC_KEY.trim();
  if (fromEnv) return fromEnv;
  const p = process.env.JWT_PUBLIC_KEY_PATH && process.env.JWT_PUBLIC_KEY_PATH.trim();
  if (p) {
    try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch (_) {}
  }
  return '';
}

function buildJwks() {
  try {
    const all = getAllPublicKeys();
    const keys = [];
    for (const kid of Object.keys(all)) {
      try {
        const pem = all[kid];
        const pub = crypto.createPublicKey(pem);
        const jwk = pub.export({ format: 'jwk' });
        keys.push({ ...jwk, use: 'sig', alg: 'RS256', kid });
      } catch(_) {}
    }
    // Fallback to single env public key if multi-map empty
    if (keys.length === 0) {
      const pem = loadPublicKeyPem();
      if (!pem) return { keys: [] };
      const pub = crypto.createPublicKey(pem);
      const jwk = pub.export({ format: 'jwk' });
      const kid = (process.env.JWT_KID || process.env.JWT_ACTIVE_KID || '').trim();
      keys.push({ ...jwk, use: 'sig', alg: 'RS256', kid: kid || undefined });
    }
    return { keys };
  } catch (_) {
    return { keys: [] };
  }
}

app.get('/.well-known/jwks.json', (_req, res) => {
  const jwks = buildJwks();
  if (!jwks.keys.length) return res.status(503).json({ keys: [] });
  res.json(jwks);
});

app.get('/api/auth/.well-known/jwks.json', (_req, res) => {
  const jwks = buildJwks();
  if (!jwks.keys.length) return res.status(503).json({ keys: [] });
  res.json(jwks);
});

app.get('/api/v1/auth/.well-known/jwks.json', (_req, res) => {
  const jwks = buildJwks();
  if (!jwks.keys.length) return res.status(503).json({ keys: [] });
  res.json(jwks);
});

// JWT passthrough for any routes that need it
app.use(authMiddleware);

// Apply sensitive endpoint-specific rate limiters
app.use('/api/auth/login', loginLimiter);
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/v1/auth/register', registerLimiter);

// Mount API
app.use('/api/auth', authRoutes);
// Versioned alias
app.use('/api/v1/auth', authRoutes);

// Optional redirect to versioned path
if (String(process.env.MARKET_REDIRECT_TO_V1 || '').toLowerCase() === '1') {
  app.use('/api/auth', (req, res) => res.redirect(308, '/api/v1/auth' + (req.url || '')));
}

// centralized error handler
app.use(errorHandler);

// DB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/axiomAuth';
mongoose.connect(MONGO_URI).then(() => {
  console.log('[Auth] Connected to MongoDB');
}).catch(err => {
  console.warn('[Auth] MongoDB connection failed:', err.message);
});

// Dynamic port fallback
const BASE_PORT = parseInt(process.env.PORT || '4100', 10);
const LIMIT = parseInt(process.env.PORT_SCAN_LIMIT || '50', 10);

function tryListen(port, attemptsLeft) {
  const server = app.listen(port, () => {
    const runtimePath = path.join(__dirname, 'runtime-port.txt');
    try { fs.writeFileSync(runtimePath, String(port)); } catch (e) {}
    console.log(`[Auth] Server listening on port ${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      tryListen(port + 1, attemptsLeft - 1);
    } else {
      console.error('[Auth] Failed to bind port:', err.message);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  tryListen(BASE_PORT, LIMIT);
}

module.exports = app;
