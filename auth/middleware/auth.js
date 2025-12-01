const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { getPublicKey, getAllPublicKeys } = require('../../utils/keys');
require('dotenv').config();

function readKeyFromEnv(varName, pathVarName) {
  const raw = process.env[varName];
  if (raw && raw.trim()) {
    return raw.replace(/\\n/g, '\n');
  }
  const p = process.env[pathVarName];
  if (p && fs.existsSync(p)) {
    try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch (_) { }
  }
  return null;
}

const PUBLIC_KEY = readKeyFromEnv('JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_PATH');
const SECRET_KEY = process.env.JWT_SECRET || null;

function authMiddleware(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) return next();
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return next();
  const token = parts[1];
  if (!token) return next();
  try {
    // RS256 with kid selection
    if (PUBLIC_KEY || Object.keys(getAllPublicKeys()).length) {
      const decodedHeader = (() => { try { return jwt.decode(token, { complete: true }); } catch(_) { return null; } })();
      const kid = decodedHeader && decodedHeader.header && decodedHeader.header.kid;
      let pub = (kid && getPublicKey(kid)) || PUBLIC_KEY;
      if (pub) {
        const decoded = jwt.verify(token, pub, { algorithms: ['RS256'] });
        req.user = decoded.user || decoded;
        return next();
      }
      // Fallback: try all known public keys
      const all = getAllPublicKeys();
      for (const k of Object.keys(all)) {
        try {
          const d = jwt.verify(token, all[k], { algorithms: ['RS256'] });
          req.user = d.user || d; return next();
        } catch(_) {}
      }
    }
    if (SECRET_KEY) {
      const decoded = jwt.verify(token, SECRET_KEY, { algorithms: ['HS256'] });
      req.user = decoded.user || decoded;
    }
  } catch (err) {}
  return next();
}

module.exports = authMiddleware;
