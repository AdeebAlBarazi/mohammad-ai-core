'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { generateKeyPairSync } = require('crypto');

function gen() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
  return { pub, priv };
}

function sign(priv, kid, payload){
  return jwt.sign(payload, priv, { algorithm: 'RS256', keyid: kid, expiresIn: '5m' });
}

(async () => {
  try {
    // Generate two keys: a (old), b (new)
    const a = gen();
    const b = gen();

    // Configure AUTH keys (initially only 'a') BEFORE requiring auth app
    process.env.JWT_PUBLIC_KEYS_JSON = JSON.stringify([{ kid: 'a', pem: a.pub }]);
    process.env.JWT_PRIVATE_KEYS_JSON = JSON.stringify([{ kid: 'a', pem: a.priv }]);
    process.env.JWT_ACTIVE_KID = 'a';

    const authApp = require('../auth/server');
    const authSrv = authApp.listen(0);
    await new Promise(r => authSrv.once('listening', r));
    const authPort = authSrv.address().port;
    const jwksUrl = `http://127.0.0.1:${authPort}/.well-known/jwks.json`;

    // Configure MARKET JWKS auto-refresh BEFORE requiring server
    process.env.AUTH_JWKS_URL = jwksUrl;
    process.env.JWKS_AUTO_REFRESH_MS = '500';
    process.env.JWKS_AUTO_REFRESH_JITTER_MS = '0';

    const { app } = require('../server');

    // Wait a moment for first refresh
    await new Promise(r => setTimeout(r, 700));

    // Validate token with 'a'
    const tokA = sign(a.priv, 'a', { user: { id: 'uA', role: 'user' } });
    await request(app).get('/api/v1/market/cart').set('Authorization', 'Bearer ' + tokA).expect(200);
    console.log('AUTOREFRESH_PHASE_A_OK', true);

    // Rotate: add 'b' and keep 'a' (overlap). Re-init auth keys cache and wait for refresh.
    process.env.JWT_PUBLIC_KEYS_JSON = JSON.stringify([{ kid: 'a', pem: a.pub }, { kid: 'b', pem: b.pub }]);
    process.env.JWT_PRIVATE_KEYS_JSON = JSON.stringify([{ kid: 'a', pem: a.priv }, { kid: 'b', pem: b.priv }]);
    process.env.JWT_ACTIVE_KID = 'b';
    // Force auth keys reload
    const keys = require('../utils/keys');
    await keys.initKeys();

    // Wait for market auto-refresh to pick new JWKS
    await new Promise(r => setTimeout(r, 1200));

    // Validate token with 'b' now passes
    const tokB = sign(b.priv, 'b', { user: { id: 'uB', role: 'user' } });
    await request(app).get('/api/v1/market/cart').set('Authorization', 'Bearer ' + tokB).expect(200);
    console.log('AUTOREFRESH_PHASE_B_OK', true);

    // Also old 'a' should still pass during overlap
    await request(app).get('/api/v1/market/cart').set('Authorization', 'Bearer ' + tokA).expect(200);
    console.log('AUTOREFRESH_PHASE_A_STILL_OK', true);

    authSrv.close();
    process.exit(0);
  } catch (e) {
    console.error('JWKS_AUTOREFRESH_FAIL', e && e.response && e.response.body ? e.response.body : e);
    process.exit(1);
  }
})();
