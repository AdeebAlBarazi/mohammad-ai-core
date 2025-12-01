'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { generateKeyPairSync } = require('crypto');

(async () => {
  try {
    // Generate one RSA key and publish via env JSON to auth util
    function gen() {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pub = publicKey.export({ type: 'spki', format: 'pem' });
      const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
      return { pub, priv };
    }
    const k = gen();
    process.env.JWT_PUBLIC_KEYS_JSON = JSON.stringify([{ kid: 'kid-fetch', pem: k.pub }]);
    process.env.JWT_PRIVATE_KEYS_JSON = JSON.stringify([{ kid: 'kid-fetch', pem: k.priv }]);
    process.env.JWT_ACTIVE_KID = 'kid-fetch';

    // Spin up auth app on a random port (after env set)
    const authApp = require('../auth/server');
    const server = authApp.listen(0);
    await new Promise(r => server.once('listening', r));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // Confirm JWKS is served from auth
    const jwksRes = await request(authApp).get('/.well-known/jwks.json').expect(200);
    if (!Array.isArray(jwksRes.body && jwksRes.body.keys) || jwksRes.body.keys.length === 0) throw new Error('No JWKS keys');

    // Configure market to fetch JWKS from auth
    process.env.AUTH_JWKS_URL = `${base}/.well-known/jwks.json`;

    // Load market app and attempt RS256 request
    const { app } = require('../server');
    const token = jwt.sign({ user: { id: 'u_fetch', role: 'user' } }, k.priv, { algorithm: 'RS256', keyid: 'kid-fetch', expiresIn: '10m' });

    await request(app)
      .get('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);

    console.log('JWKS_FETCH_OK', true);
    server.close();
    process.exit(0);
  } catch (e) {
    console.error('JWKS_FETCH_FAIL', e && e.response && e.response.body ? e.response.body : e);
    process.exit(1);
  }
})();
