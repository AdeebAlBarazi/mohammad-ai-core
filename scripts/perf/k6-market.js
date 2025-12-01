import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3002';

export default function () {
  const res = http.get(`${BASE}/api/v1/market/products`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
