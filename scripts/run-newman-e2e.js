'use strict';
const http = require('http');
const jwt = require('jsonwebtoken');
const newman = require('newman');
const path = require('path');

process.env.MARKET_ALLOW_DB_FAIL = process.env.MARKET_ALLOW_DB_FAIL || '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_123';

const { app } = require('../server');

function makeTok(id, role) {
  return jwt.sign({ user: { id, role } }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30m' });
}

(async () => {
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const env = {
      id: 'axiom-market-env',
      name: 'Axiom Market Local Env',
      values: [
        { key: 'baseUrl', value: baseUrl, enabled: true },
        { key: 'userToken', value: makeTok('user_e2e','user'), enabled: true },
        { key: 'sellerToken', value: makeTok('seller_e2e','seller'), enabled: true },
        { key: 'adminToken', value: makeTok('admin_e2e','admin'), enabled: true }
      ]
    };

    newman.run({
      collection: require(path.join(__dirname, 'postman', 'market-e2e.postman_collection.json')),
      environment: env,
      reporters: 'cli',
      color: true,
      timeoutRequest: 5000
    }, (err, summary) => {
      server.close();
      if (err || summary.run.failures.length) {
        console.error('NEWMAN_E2E_FAILED', err || summary.run.failures);
        process.exit(1);
      }
      console.log('NEWMAN_E2E_OK');
      process.exit(0);
    });
  });
})();
