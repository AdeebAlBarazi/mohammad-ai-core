'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.MARKET_ALLOW_DB_FAIL = process.env.MARKET_ALLOW_DB_FAIL || '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_123';

const { app } = require('../server');

/**
 * إنشاء توكن (User / Admin)
 * payload الآن { userId, role } ليتوافق مع منطق الخادم.
 */
function makeToken(id, role, exp = '1h') {
  const payload = { userId: id, role };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: exp,
  });
}

(async () => {
  try {
    const adminTok = makeToken('admin1', 'admin');
    const userTok = makeToken('user1', 'user');

    // Seed memory products (admin)
    await request(app)
      .post('/api/v1/market/dev/seed-memory')
      .set('Authorization', 'Bearer ' + adminTok)
      .expect(201);

    // Browse products
    let list = await request(app)
      .get('/api/v1/market/products')
      .expect(200);

    // Fallback legacy listing if empty (controller direct)
    if (!list.body || !Array.isArray(list.body.items) || list.body.items.length === 0) {
      list = await request(app).get('/items/data').expect(200);
    }

    if (
      !list.body ||
      !Array.isArray(list.body.items) ||
      list.body.items.length === 0
    ) {
      throw new Error('No products after seed');
    }

    const sku = list.body.items[0].sku || list.body.items[0].id;

    // Add to cart (user)
    await request(app)
      .post('/api/v1/market/cart')
      .set('Authorization', 'Bearer ' + userTok)
      .send({ sku, quantity: 1 })
      .expect(200);

    // Create order (user)
    await request(app)
      .post('/api/v1/market/orders')
      .set('Authorization', 'Bearer ' + userTok)
      .send({ currency: 'SAR' })
      .expect(201);

    // List orders includes the new order
    const orders = await request(app)
      .get('/api/v1/market/orders')
      .set('Authorization', 'Bearer ' + userTok)
      .expect(200);

    if (
      !orders.body ||
      !Array.isArray(orders.body.items) ||
      orders.body.items.length === 0
    ) {
      throw new Error('No orders returned');
    }

    console.log('E2E_USER_OK', true);
    process.exit(0);
  } catch (e) {
    console.error(
      'E2E_USER_FAIL',
      e && e.response && e.response.body ? e.response.body : e
    );
    process.exit(1);
  }
})();
