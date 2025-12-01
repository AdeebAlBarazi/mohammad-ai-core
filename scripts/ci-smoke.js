// Simple CI smoke test: ensure server loads and agent-core responds (stub)

(async function(){
  try {
    const path = require('path');
    const srv = require(path.join(__dirname, '..', 'server.js'));
    if (!srv || !srv.app) {
      console.error('[ci] server app not exported');
      process.exit(2);
    }
    const agent = require(path.join(__dirname, '..', 'agent-core'));
    if (!agent || typeof agent.chat !== 'function') {
      console.error('[ci] agent-core.chat missing');
      process.exit(3);
    }
    const r = await agent.chat({ prompt: 'اختبار CI', history: [] });
    if (!r || typeof r.reply !== 'string' || !r.reply.length) {
      console.error('[ci] empty reply from agent');
      process.exit(4);
    }
    console.log('[ci] OK:', { provider: r.provider, mode: r.mode });
    process.exit(0);
  } catch (e) {
    console.error('[ci] error:', e && e.message || e);
    process.exit(1);
  }
})();
