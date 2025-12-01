'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.MARKET_ALLOW_DB_FAIL = process.env.MARKET_ALLOW_DB_FAIL || '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_123';

const { app } = require('../server');

function tok(id, role) {
  return jwt.sign({ user: { id, role } }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

describe('Market core routes', () => {
  const userTok = tok('u_test','user');
  const sellerTok = tok('s_test','seller');

  test('GET /api/v1/market/products returns ok', async () => {
    const res = await request(app).get('/api/v1/market/products').expect(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('POST /api/v1/market/cart add item', async () => {
    const res = await request(app)
      .post('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + userTok)
      .send({ sku: 'UNIT-SKU-1', quantity: 2 })
      .expect(200);
    expect(res.body).toHaveProperty('ok', true);
  });

  test('POST /api/v1/market/orders creates order', async () => {
    await request(app)
      .post('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + userTok)
      .send({ sku: 'UNIT-SKU-2', quantity: 1 })
      .expect(200);
    const res = await request(app)
      .post('/api/v1/market/orders')
      .set('Authorization', 'Bearer ' + userTok)
      .send({ currency: 'SAR' })
      .expect(201);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('id');
  });

  test('Seller can create product', async () => {
    const payload = { name: 'Unit Product', price: 100, currency: 'SAR', vendorId: 'v1', countryCode: 'SA' };
    const res = await request(app)
      .post('/api/v1/market/products')
      .set('Authorization', 'Bearer ' + sellerTok)
      .send(payload)
      .expect(200); // controller may return 200 for fallback
    expect(res.body).toHaveProperty('ok', true);
  });
});
