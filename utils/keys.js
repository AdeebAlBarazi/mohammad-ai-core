'use strict';

// Centralized JWT key management with optional AWS Secrets Manager integration.
// Supports:
// - Single-key via JWT_PUBLIC_KEY / JWT_PRIVATE_KEY (or *_PATH)
// - Multi-key via JWT_PUBLIC_KEYS_JSON / JWT_PRIVATE_KEYS_JSON (array of { kid, pem | key | path })
// - Active signing key via JWT_ACTIVE_KID
// - Optional AWS Secrets Manager (JSON) via JWT_SECRETS_MANAGER_NAME or JWT_SECRETS_MANAGER_ARN

const fs = require('fs');
const path = require('path');

let SecretsManager = null;
function getSecretsClient() {
  try {
    if (!SecretsManager) {
      ({ SecretsManager } = require('@aws-sdk/client-secrets-manager'));
    }
    return new SecretsManager({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1' });
  } catch (_) {
    return null;
  }
}

function readPemInlineOrPath(obj) {
  // obj can be string (pem), or { pem } or { key } or { path }
  if (!obj) return null;
  if (typeof obj === 'string') return obj.replace(/\\n/g, '\n');
  if (obj.pem) return String(obj.pem).replace(/\\n/g, '\n');
  if (obj.key) return String(obj.key).replace(/\\n/g, '\n');
  if (obj.path) {
    const p = path.resolve(String(obj.path));
    try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
  }
  return null;
}

function parseJsonEnv(name) {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function loadSingleFromEnv(pubVar, pubPathVar, privVar, privPathVar) {
  const out = { public: {}, private: {} };
  const pub = process.env[pubVar] && process.env[pubVar].trim();
  const pubPath = process.env[pubPathVar] && process.env[pubPathVar].trim();
  const priv = process.env[privVar] && process.env[privVar].trim();
  const privPath = process.env[privPathVar] && process.env[privPathVar].trim();
  const pubPem = pub ? pub.replace(/\\n/g, '\n') : (pubPath ? (fs.existsSync(pubPath) ? fs.readFileSync(path.resolve(pubPath), 'utf8') : null) : null);
  const privPem = priv ? priv.replace(/\\n/g, '\n') : (privPath ? (fs.existsSync(privPath) ? fs.readFileSync(path.resolve(privPath), 'utf8') : null) : null);
  const kid = process.env.JWT_KID || process.env.JWT_ACTIVE_KID || 'kid1';
  if (pubPem) out.public[kid] = pubPem;
  if (privPem) out.private[kid] = privPem;
  return out;
}

function normalizeKeyArray(arr) {
  // arr: Array<{ kid, pem|key|path }>
  const map = {};
  if (!Array.isArray(arr)) return map;
  for (const item of arr) {
    if (!item || !item.kid) continue;
    const pem = readPemInlineOrPath(item);
    if (pem) map[String(item.kid)] = pem;
  }
  return map;
}

let cache = {
  activeKid: process.env.JWT_ACTIVE_KID || process.env.JWT_KID || undefined,
  public: {},
  private: {},
  lastLoadedAt: 0
};

async function maybeLoadFromSecretsManager() {
  const name = process.env.JWT_SECRETS_MANAGER_NAME || process.env.JWT_SECRETS_MANAGER_ARN;
  if (!name) return null;
  const client = getSecretsClient();
  if (!client) return null;
  try {
    const resp = await client.getSecretValue({ SecretId: name });
    const text = resp.SecretString || (resp.SecretBinary ? Buffer.from(resp.SecretBinary, 'base64').toString('utf8') : null);
    if (!text) return null;
    const obj = JSON.parse(text);
    // Expected shape: { activeKid, publicKeys: [{kid,pem}], privateKeys: [{kid,pem}] }
    const activeKid = obj.activeKid || cache.activeKid;
    const publicMap = normalizeKeyArray(obj.publicKeys || []);
    const privateMap = normalizeKeyArray(obj.privateKeys || []);
    // Merge into cache
    cache.activeKid = activeKid;
    cache.public = { ...cache.public, ...publicMap };
    cache.private = { ...cache.private, ...privateMap };
    cache.lastLoadedAt = Date.now();
    return true;
  } catch (_) {
    return null;
  }
}

function loadFromEnvSync() {
  const pubArr = parseJsonEnv('JWT_PUBLIC_KEYS_JSON');
  const privArr = parseJsonEnv('JWT_PRIVATE_KEYS_JSON');
  const single = loadSingleFromEnv('JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_PATH', 'JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_PATH');
  cache.public = { ...(pubArr ? normalizeKeyArray(pubArr) : {}), ...single.public };
  cache.private = { ...(privArr ? normalizeKeyArray(privArr) : {}), ...single.private };
  cache.activeKid = process.env.JWT_ACTIVE_KID || cache.activeKid;
  cache.lastLoadedAt = Date.now();
}

function getActiveKid() { return cache.activeKid; }
function getPublicKey(kid) { return kid ? cache.public[kid] : undefined; }
function getAllPublicKeys() { return { ...cache.public }; }
function getPrivateKey(kid) { return kid ? cache.private[kid] : undefined; }
function getActivePrivateKey() {
  const kid = cache.activeKid;
  if (!kid) return undefined;
  return { kid, key: cache.private[kid] };
}

async function initKeys() {
  loadFromEnvSync();
  // Best-effort SM fetch; ignore failures
  try { await maybeLoadFromSecretsManager(); } catch (_) {}
}

// Initialize on import (non-blocking)
initKeys();

module.exports = {
  initKeys,
  getActiveKid,
  getActivePrivateKey,
  getPublicKey,
  getAllPublicKeys,
  getPrivateKey
};
