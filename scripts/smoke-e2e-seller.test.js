'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.MARKET_ALLOW_DB_FAIL = process.env.MARKET_ALLOW_DB_FAIL || '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_123';

const { app } = require('../server');

/**
 * إنشاء توكن لبائع (Seller)
 * ملاحظة: غيّرنا الـ payload ليصبح { userId, role }
 * حتى يتوافق مع منطق المصادقة الجديد في الخادم.
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
    const sellerTok = makeToken('seller1', 'seller');

    // Create product
    const createRes = await request(app)
      .post('/api/v1/market/seller/products')
      .set('Authorization', 'Bearer ' + sellerTok)
      .send({
        name: 'Seller Product X',
        price: 99,
        currency: 'SAR',
        vendorId: '201',
        countryCode: 'SA',
        category: 'stone'
      });
    if (createRes.status !== 201) {
      throw new Error('CREATE_FAILED ' + JSON.stringify(createRes.body || {}));
    }

    const sku =
      (createRes.body &&
        (createRes.body.sku ||
          (createRes.body.item && createRes.body.item.sku))) ||
      null;
    if (!sku) throw new Error('No SKU from create');

    // Upload media
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    await request(app)
      .post('/api/v1/market/media/upload')
      .set('Authorization', 'Bearer ' + sellerTok)
      .send({
        filename: 'sellerx.png',
        contentType: 'image/png',
        data: pngBase64,
      })
      .expect(201);

    // Delete product
    const delRes = await request(app)
      .delete('/api/v1/market/seller/products/' + sku)
      .set('Authorization', 'Bearer ' + sellerTok);
    if (delRes.status !== 200) {
      throw new Error('DELETE_FAILED ' + JSON.stringify(delRes.body || {}));
    }

    console.log('E2E_SELLER_OK', true);
    process.exit(0);
  } catch (e) {
    console.error(
      'E2E_SELLER_FAIL',
      e && e.response && e.response.body ? e.response.body : e
    );
    process.exit(1);
  }
})();
