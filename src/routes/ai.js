// systems/marketplace/src/routes/ai.js
const express = require('express');
const router = express.Router();

// Lazy require to avoid cost on cold start
function core() { return require('../../agent-core'); }

// Simple per-process guard to avoid abuse in dev (does not replace a real limiter)
let inFlight = 0; const MAX_IN_FLIGHT = Number(process.env.AI_MAX_INFLIGHT || 4);

router.post('/chat', async (req, res) => {
  try {
    const { prompt, history, sessionId, mode, maxTokens } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ ok: false, error: 'prompt_required' });
    }
    if (inFlight >= MAX_IN_FLIGHT) {
      return res.status(429).json({ ok: false, error: 'overloaded' });
    }
    inFlight += 1;
    const t0 = Date.now();
    const r = await core().chat({ prompt: String(prompt), history: Array.isArray(history) ? history.slice(-10) : [], sessionId: sessionId || 'default', mode, maxTokens });
    const latency = Date.now() - t0;
    return res.json({ ok: true, reply: r.reply, mode: r.mode, provider: r.provider, model: r.model, usage: r.usage || null, latency });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message || String(e) });
  } finally {
    inFlight = Math.max(0, inFlight - 1);
  }
});

module.exports = router;
