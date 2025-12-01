const agent = require('../agent-core');

describe('agent-core', () => {
  test('chat returns reply string', async () => {
    const r = await agent.chat({ prompt: 'اختبار', sessionId: 'jest-session-1' });
    expect(typeof r.reply).toBe('string');
    expect(r.reply.length).toBeGreaterThan(0);
    expect(['stub','openai']).toContain(r.provider);
  });

  test('stream accumulates deltas and ends', async () => {
    let out = '';
    let done = false;
    const r = await agent.stream({ prompt: 'بث تجريبي', sessionId: 'jest-session-2', onDelta: (d, isDone) => {
      if (typeof d === 'string') out += d;
      if (isDone) done = true;
    } });
    expect(done).toBe(true);
    expect(typeof r.reply).toBe('string');
    expect(r.reply.length).toBeGreaterThan(0);
    expect(out.length).toBeGreaterThan(0);
  });
});
