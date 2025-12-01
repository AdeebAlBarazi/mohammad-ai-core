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

// Serve personal pages
app.use('/pages', express.static(path.join(process.cwd(), 'pages')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Personal assistant server listening on http://localhost:${PORT}`);
});