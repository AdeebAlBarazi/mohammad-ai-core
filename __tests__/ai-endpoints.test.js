const request = require('supertest');
const { app } = require('../server');

describe('AI endpoints', () => {
  test('POST /api/ai/chat returns ok and reply', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ prompt: 'مرحبا', sessionId: 'jest-web-1' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(typeof res.body.reply).toBe('string');
    expect(res.body.reply.length).toBeGreaterThan(0);
  });

  test('POST /api/ai/chat/stream returns SSE with meta', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Accept', 'text/event-stream')
      .send({ prompt: 'بث', sessionId: 'jest-web-2' });
    expect(res.status).toBe(200);
    const text = res.text || '';
    // Should contain at least one SSE meta event and some data chunks
    expect(text.includes('event: meta')).toBe(true);
    expect(text.includes('data: ')).toBe(true);
  });

  test('POST /api/ai/tools/call echo', async () => {
    const res = await request(app)
      .post('/api/ai/tools/call')
      .set('Content-Type','application/json')
      .send({ name: 'echo', input: 'اختبار أدوات' });
    expect(res.status).toBe(200);
    expect(res.body && res.body.ok).toBe(true);
    expect(res.body.output).toBe('اختبار أدوات');
  });
});
