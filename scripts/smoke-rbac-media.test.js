'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.MARKET_ALLOW_DB_FAIL = process.env.MARKET_ALLOW_DB_FAIL || '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_123';

const { app } = require('../server');

function makeToken(id, role, exp='1h'){
  const payload = { user: { id, role } };
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: exp });
}

(async () => {
  try {
    const userTok = makeToken('user1','user');
    const sellerTok = makeToken('seller1','seller');
    const adminTok = makeToken('admin1','admin');

    // Cart GET with user
    const cartRes = await request(app)
      .get('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + userTok)
      .expect(200);
    console.log('CART_OK', cartRes.body && cartRes.body.ok === true);

    // Media upload with seller
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const upRes = await request(app)
      .post('/api/v1/market/media/upload')
      .set('Authorization', 'Bearer ' + sellerTok)
      .send({ filename: 'test.png', contentType: 'image/png', data: pngBase64 })
      .expect(201);
    console.log('UPLOAD_OK', upRes.body && upRes.body.ok === true, 'KEY', upRes.body && upRes.body.key);

    // Admin seller-requests
    const adminRes = await request(app)
      .get('/api/v1/market/admin/seller-requests')
      .set('Authorization', 'Bearer ' + adminTok)
      .expect(200);
    console.log('ADMIN_OK', adminRes.body && adminRes.body.ok === true);

    process.exit(0);
  } catch (e) {
    console.error('SMOKE_FAIL', e && e.response && e.response.body ? e.response.body : e);
    process.exit(1);
  }
})();
