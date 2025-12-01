// systems/marketplace/src/routes/ai.js
const express = require('express');
const router = express.Router();
const { get: getAiMetrics, recordTokens } = require('../metrics/aiMetrics');
const { audit } = (()=>{ try { return require('../../utils/logger'); } catch(_) { return { audit: ()=>{} }; } })();

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
    try { const m = getAiMetrics(); m.aiRequests && m.aiRequests.inc({ endpoint:'chat' }); } catch(_){ }
    const t0 = Date.now();
    const r = await core().chat({ prompt: String(prompt), history: Array.isArray(history) ? history.slice(-10) : [], sessionId: sessionId || 'default', mode, maxTokens });
    const latency = Date.now() - t0;
    try { const m = getAiMetrics(); m.aiDuration && m.aiDuration.observe({ endpoint:'chat' }, latency/1000); } catch(_){ }
    try { audit('ai_chat',{ latency, provider: r.provider, mode: r.mode }, req); } catch(_){ }
    // Model-reported token usage (non-stream)
    try {
      const u = r.usage || {}; const model = r.model || 'unknown';
      if(u && (typeof u.prompt_tokens === 'number' || typeof u.completion_tokens === 'number')){
        recordTokens({ model, prompt: u.prompt_tokens, completion: u.completion_tokens });
      }
      const m = getAiMetrics(); if(m.outputChars && typeof r.reply === 'string'){ m.outputChars.inc({ endpoint:'chat' }, r.reply.length); }
    } catch(_){ }
    return res.json({ ok: true, reply: r.reply, mode: r.mode, provider: r.provider, model: r.model, usage: r.usage || null, latency });
  } catch (e) {
    try { const m = getAiMetrics(); m.aiErrors && m.aiErrors.inc({ endpoint:'chat' }); } catch(_){ }
    return res.status(500).json({ ok: false, error: e && e.message || String(e) });
  } finally {
    inFlight = Math.max(0, inFlight - 1);
  }
});

// Streaming via SSE (Server-Sent Events) using POST for payload convenience.
router.post('/chat/stream', async (req, res) => {
  let ended = false;
  function end() { if (!ended) { ended = true; try { res.write('event: done\n'); res.write('data: [DONE]\n\n'); } catch(_){} try { res.end(); } catch(_){} } }
  try {
    const { prompt, history, sessionId, mode, maxTokens } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      res.status(400).set('Content-Type','application/json');
      return res.end(JSON.stringify({ ok: false, error: 'prompt_required' }));
    }
    if (inFlight >= MAX_IN_FLIGHT) {
      res.status(429).set('Content-Type','application/json');
      return res.end(JSON.stringify({ ok: false, error: 'overloaded' }));
    }
    inFlight += 1;
    try { const m = getAiMetrics(); m.aiRequests && m.aiRequests.inc({ endpoint:'stream' }); } catch(_){ }
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    let full = '';
    const t0 = Date.now();
    await core().stream({
      prompt: String(prompt),
      history: Array.isArray(history) ? history.slice(-10) : [],
      sessionId: sessionId || 'default',
      mode,
      maxTokens,
      onDelta: async (delta, done) => {
        if (ended) return;
        if (typeof delta === 'string' && delta.length) { full += delta; res.write('data: ' + JSON.stringify({ delta }) + '\n\n'); }
        if (done) {
          const latency = Date.now() - t0;
          try { const m = getAiMetrics(); m.aiDuration && m.aiDuration.observe({ endpoint:'stream' }, latency/1000); } catch(_){ }
          try { audit('ai_stream',{ latency, bytes: Buffer.byteLength(full||''), mode }, req); } catch(_){ }
          try { const m = getAiMetrics(); if(m.outputChars){ m.outputChars.inc({ endpoint:'stream' }, (full||'').length); } } catch(_){ }
          res.write('event: meta\n');
          res.write('data: ' + JSON.stringify({ ok:true, latency }) + '\n\n');
          end();
        }
      }
    });
  } catch (e) {
    try {
      try { const m = getAiMetrics(); m.aiErrors && m.aiErrors.inc({ endpoint:'stream' }); } catch(_){ }
      if (!ended) {
        res.write('event: error\n');
        res.write('data: ' + JSON.stringify({ ok:false, error: e && e.message || String(e) }) + '\n\n');
        end();
      }
    } catch(_){}
  } finally {
    inFlight = Math.max(0, inFlight - 1);
    // client disconnect safety
    try { req.on('close', () => { try { end(); } catch(_){} }); } catch(_){ }
  }
});

// Minimal tool-call endpoint
router.post('/tools/call', async (req, res) => {
  try {
    const { name, input } = req.body || {};
    if(!name) return res.status(400).json({ ok:false, error:'name_required' });
    const tools = require('../../agent-core/tools');
    const r = await tools.callTool({ name: String(name), input });
    try { audit('ai_tool_call',{ name, ok: r.ok }, req); } catch(_){ }
    return res.json(r);
  } catch(e){ return res.status(500).json({ ok:false, error: e && e.message || String(e) }); }
});

// --- Sessions & History API ---
router.get('/sessions', async (_req, res) => {
  try {
    const list = core().listSessions();
    return res.json({ ok: true, items: list });
  } catch (e) { return res.status(500).json({ ok: false, error: e && e.message || String(e) }); }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const id = String(req.params.id || 'default');
    const limit = Number(req.query.limit || 100);
    const hist = core().getSessionHistory(id, { limit });
    return res.json({ ok: true, items: hist, id });
  } catch (e) { return res.status(500).json({ ok: false, error: e && e.message || String(e) }); }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const id = String(req.params.id || 'default');
    const r = core().deleteSession(id);
    if (!r.ok) return res.status(500).json(r);
    return res.json({ ok: true, id });
  } catch (e) { return res.status(500).json({ ok: false, error: e && e.message || String(e) }); }
});

module.exports = router;
