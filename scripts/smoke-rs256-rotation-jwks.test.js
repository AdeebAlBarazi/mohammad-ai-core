'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { generateKeyPairSync } = require('crypto');

(async () => {
  try {
    // Generate two RSA key pairs (k1 old, k2 new)
    function gen() {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pub = publicKey.export({ type: 'spki', format: 'pem' });
      const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
      return { pub, priv };
    }
    const k1 = gen();
    const k2 = gen();

    // Prepare environment for keys util to load multiple keys with active kid=k2
    process.env.JWT_PUBLIC_KEYS_JSON = JSON.stringify([
      { kid: 'k1', pem: k1.pub },
      { kid: 'k2', pem: k2.pub }
    ]);
    process.env.JWT_PRIVATE_KEYS_JSON = JSON.stringify([
      { kid: 'k1', pem: k1.priv },
      { kid: 'k2', pem: k2.priv }
    ]);
    process.env.JWT_ACTIVE_KID = 'k2';

    // Start/load auth app (will bind its own port) and test JWKS
    const authApp = require('../auth/server');
    const jwksRes = await request(authApp)
      .get('/api/v1/auth/.well-known/jwks.json')
      .expect(200);
    const kids = new Set((jwksRes.body && jwksRes.body.keys || []).map(k => k.kid));
    console.log('JWKS_KIDS', Array.from(kids).join(','));

    // Load market app (does not auto-listen) and test RS256 verification with both keys
    const { app } = require('../server');

    function signWith(kid, priv) {
      const payload = { user: { id: `u_${kid}`, role: 'user' } };
      return jwt.sign(payload, priv, { algorithm: 'RS256', keyid: kid, expiresIn: '10m' });
    }

    const tokNew = signWith('k2', k2.priv);
    const tokOld = signWith('k1', k1.priv);

    // New key (active) should pass
    await request(app)
      .get('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + tokNew)
      .expect(200);
    console.log('RS256_NEW_OK', true);

    // Old key (rotation overlap) should also pass due to multi-key verification
    await request(app)
      .get('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + tokOld)
      .expect(200);
    console.log('RS256_OLD_OK', true);

    process.exit(0);
  } catch (e) {
    console.error('RS256_SMOKE_FAIL', e && e.response && e.response.body ? e.response.body : e);
    process.exit(1);
  }
})();
