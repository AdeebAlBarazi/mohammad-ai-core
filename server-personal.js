const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const personal = require('./agent-personal');

const app = express();
const PORT = process.env.PERSONAL_PORT || 5600;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(bodyParser.json());

// Simple API key gate (optional)
app.use((req, res, next) => {
  const required = process.env.PERSONAL_API_KEY;
  if (!required) return next();
  const got = req.headers['x-api-key'];
  if (got === required) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
});

// Personal AI chat
app.post('/api/personal/chat', async (req, res) => {
  const { prompt, sessionId, mode } = req.body || {};
  if (!prompt) return res.status(400).json({ ok: false, error: 'prompt required' });
  try {
    const result = await personal.chat({ prompt, sessionId, mode });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SSE stream: POST, hardened headers
app.post('/api/personal/chat/stream', async (req, res) => {
  const { prompt, sessionId, mode } = req.body || {};
  if (!prompt) {
    res.status(400).json({ ok:false, error:'prompt required' });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  function send(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const result = await personal.chat({ prompt, sessionId, mode });
    // naive token-like chunking
    const text = result.reply || '';
    const chunks = text.match(/.{1,40}/g) || [];
    send('meta', { ok:true, model: result.model });
    for (const c of chunks) {
      send('data', { delta: c });
    }
    send('end', { ok:true });
    res.end();
  } catch (e) {
    send('error', { ok:false, error: e.message });
    res.end();
  }
});

// Serve personal pages
app.use('/pages', express.static(path.join(process.cwd(), 'pages')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Personal assistant server listening on http://localhost:${PORT}`);
});