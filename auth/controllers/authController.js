const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { getActivePrivateKey, getActiveKid } = require('../../utils/keys');
const User = require('../models/User');
const DEBUG_ERRORS = process.env.AUTH_DEBUG === '1';

const JWT_SECRET = process.env.JWT_SECRET || null; // HS256 fallback
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '1h';

function readKeyFromEnv(varName, pathVarName) {
  const raw = process.env[varName];
  if (raw && raw.trim()) return raw.replace(/\\n/g, '\n');
  const p = process.env[pathVarName];
  if (p && fs.existsSync(p)) { try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch (_) {} }
  return null;
}

const PRIVATE_KEY = readKeyFromEnv('JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_PATH');

function signToken(user) {
  const payload = {
    user: {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId || null
    }
  };
  // Prefer multi-key signing via keys util
  const active = getActivePrivateKey();
  if (active && active.key) {
    return jwt.sign(payload, active.key, { algorithm: 'RS256', expiresIn: TOKEN_EXPIRES_IN, keyid: active.kid || getActiveKid() });
  }
  if (PRIVATE_KEY) {
    const kid = getActiveKid() || process.env.JWT_KID;
    const opts = { algorithm: 'RS256', expiresIn: TOKEN_EXPIRES_IN };
    if (kid) opts.keyid = kid;
    return jwt.sign(payload, PRIVATE_KEY, opts);
  }
  if (!JWT_SECRET) throw new Error('JWT signing not configured');
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn: TOKEN_EXPIRES_IN });
}

exports.health = async (req, res) => {
  res.json({ status: 'ok', service: 'auth', time: new Date().toISOString() });
};

exports.checkAvailability = async (req, res) => {
  try {
    const { email, username } = req.query;
    const result = { emailAvailable: true, usernameAvailable: true };
    if (email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      result.emailAvailable = !exists;
    }
    if (username) {
      const existsU = await User.findOne({ username: username.toLowerCase() });
      result.usernameAvailable = !existsU;
    }
    res.json(result);
  } catch (err) {
    console.error('[register error]', err);
    if (DEBUG_ERRORS) {
      return res.status(500).json({ error: 'Server error', detail: err && err.message, stack: err && err.stack });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, username, password, fullName, userType, role, companyId } = req.body;
    if (!email || !username || !password || !fullName) {
      return res.status(400).json({ error: 'الحقول الأساسية مطلوبة.' });
    }
    const existsEmail = await User.findOne({ email: email.toLowerCase() });
    if (existsEmail) return res.status(409).json({ error: 'البريد مستخدم.' });
    const existsUser = await User.findOne({ username: username.toLowerCase() });
    if (existsUser) return res.status(409).json({ error: 'اسم المستخدم مستخدم.' });

    const effectiveUserType = userType || 'buyer';
    const user = new User({ email, username, password, fullName, userType: effectiveUserType, role: role || 'User', companyId: companyId || null });
    await user.save();

    const token = signToken(user);
    res.status(201).json({ message: 'تم التسجيل بنجاح', token, user: {
      id: user._id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      userType: user.userType,
      role: user.role,
      companyId: user.companyId
    }});
  } catch (err) {
    console.error('[login error]', err);
    if (DEBUG_ERRORS) {
      return res.status(500).json({ error: 'Server error', detail: err && err.message, stack: err && err.stack });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }
    const query = emailOrUsername.includes('@') ? { email: emailOrUsername.toLowerCase() } : { username: emailOrUsername.toLowerCase() };
    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });

    const token = signToken(user);
    res.json({ message: 'تم تسجيل الدخول', token, user: {
      id: user._id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      userType: user.userType,
      role: user.role,
      companyId: user.companyId
    }});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
