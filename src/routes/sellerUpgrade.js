// systems/marketplace/src/routes/sellerUpgrade.js
// Seller Upgrade + Admin review (memory-first with optional Mongo in future)
const express = require('express');
const router = express.Router();

// In-memory stores (replace with DB models when Mongo is enabled)
const sellerRequests = [];
const sellers = [];
const usersRoles = new Map(); // userId -> role
// Default dev super admin for quick access
usersRoles.set('superadmin', 'super-admin');
const otpStore = new Map(); // key `${userId}:${type}` -> { code, value, exp }

function now() { return Date.now(); }
function randomId() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }
function resolveUserId(req) {
  const auth = (req.headers.authorization || '').trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').split('|')[0];
  return (req.query.userId || (req.body && req.body.userId) || 'guest');
}

// Sample specializations (would come from DB in real system)
const defaultSpecs = [
  { id: 'sp-01', name: 'Building Materials' },
  { id: 'sp-02', name: 'Ceramics' },
  { id: 'sp-03', name: 'Marble' },
  { id: 'sp-04', name: 'Mosaic' },
  { id: 'sp-05', name: 'Food Products' },
  { id: 'sp-06', name: 'Grocery Items' }
];

router.get('/specializations', (_req, res) => {
  res.json({ ok: true, items: defaultSpecs });
});

// Submit seller upgrade request
router.post('/seller/upgrade', (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId || userId === 'guest') return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const body = req.body || {};
    if (!body.legalAccepted) return res.status(400).json({ ok: false, error: 'legal_required' });
    const existing = sellerRequests.find(r => r.user_id === userId && r.status === 'pending');
    if (existing) return res.status(409).json({ ok: false, error: 'request_pending', id: existing.id });
    const reqId = 'sr_' + randomId();
    const rec = {
      id: reqId,
      user_id: userId,
      specialization_id: body.specialization_id || null,
      bank_name: body.bank_name || '',
      bank_account: body.bank_account || '',
      iban: body.iban || '',
      swift: body.swift || '',
      phone: body.phone || '',
      email: body.email || '',
      phone_verified: !!body.phone_verified || false,
      email_verified: !!body.email_verified || false,
      legal_accepted: !!body.legalAccepted,
      signature: body.signature || '',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    sellerRequests.push(rec);
    return res.status(201).json({ ok: true, id: reqId, status: 'pending' });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Get my seller request status
router.get('/seller/upgrade/me', (req, res) => {
  const userId = resolveUserId(req);
  if (!userId || userId === 'guest') return res.status(401).json({ ok: false, error: 'unauthenticated' });
  const rec = sellerRequests.find(r => r.user_id === userId && (r.status === 'pending' || r.status === 'rejected' || r.status === 'approved'));
  if (!rec) return res.json({ ok: true, item: null });
  res.json({ ok: true, item: rec });
});

// Request OTP (phone/email)
router.post('/seller/upgrade/otp/request', (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId || userId === 'guest') return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { type, value } = req.body || {};
    if (!type || !value) return res.status(400).json({ ok: false, error: 'invalid_params' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exp = now() + 5 * 60 * 1000;
    otpStore.set(`${userId}:${type}`, { code, value, exp });
    const devEcho = String(process.env.MARKET_DEV_OTP || '1') === '1' ? code : undefined;
    return res.json({ ok: true, sent: true, dev_echo: devEcho });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Verify OTP
router.post('/seller/upgrade/otp/verify', (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId || userId === 'guest') return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { type, code } = req.body || {};
    const entry = otpStore.get(`${userId}:${type}`);
    if (!entry) return res.status(400).json({ ok: false, error: 'no_otp' });
    if (now() > entry.exp) return res.status(400).json({ ok: false, error: 'expired' });
    if (String(code) !== String(entry.code)) return res.status(400).json({ ok: false, error: 'invalid_code' });
    const rec = sellerRequests.find(r => r.user_id === userId && r.status === 'pending');
    if (rec) {
      if (type === 'phone') rec.phone_verified = true;
      if (type === 'email') rec.email_verified = true;
    }
    otpStore.delete(`${userId}:${type}`);
    return res.json({ ok: true, verified: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// --- Admin endpoints ---
router.get('/admin/seller-requests', (req, res) => {
  const status = (req.query.status || '').toString();
  const items = sellerRequests.filter(r => !status || r.status === status);
  res.json({ ok: true, items });
});

router.post('/admin/seller-requests/:id/approve', (req, res) => {
  try {
    const id = String(req.params.id || '');
    const rec = sellerRequests.find(r => r.id === id);
    if (!rec) return res.status(404).json({ ok: false, error: 'not_found' });
    rec.status = 'approved';
    const sellerId = 'seller_' + randomId();
    const seller = {
      id: sellerId,
      user_id: rec.user_id,
      specialization_id: rec.specialization_id || null,
      bank_info: { bank_name: rec.bank_name, bank_account: rec.bank_account, iban: rec.iban, swift: rec.swift },
      rating: 0,
      status: 'active',
      created_at: new Date().toISOString()
    };
    sellers.push(seller);
    usersRoles.set(rec.user_id, 'seller');
    return res.json({ ok: true, seller });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/admin/seller-requests/:id/reject', (req, res) => {
  try {
    const id = String(req.params.id || '');
    const rec = sellerRequests.find(r => r.id === id);
    if (!rec) return res.status(404).json({ ok: false, error: 'not_found' });
    rec.status = 'rejected';
    rec.reason = (req.body && req.body.reason) || '';
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
});

// Export internal for potential future use
router.__stores = { sellerRequests, sellers, usersRoles, otpStore };

// Admin: simple endpoints to manage roles in memory (dev only)
router.get('/admin/users/:id/role', (req, res) => {
  const id = String(req.params.id||'');
  const role = usersRoles.get(id) || 'customer';
  res.json({ ok:true, id, role });
});
router.post('/admin/users/:id/role', (req, res) => {
  const id = String(req.params.id||'');
  const role = (req.body && req.body.role) || 'customer';
  usersRoles.set(id, role);
  res.json({ ok:true, id, role });
});

module.exports = router;

// --- Admin: roles management (mounted by server via same router prefix) ---
// Note: simple in-memory role admin helpers for development
module.exports.getRole = function(userId){ return usersRoles.get(userId) || 'customer'; };
module.exports.setRole = function(userId, role){ usersRoles.set(userId, role); };
