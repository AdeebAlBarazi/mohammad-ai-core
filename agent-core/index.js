// systems/marketplace/agent-core/index.js
// Minimal agent core: profile + provider + memory store

const fs = require('fs');
const path = require('path');

const PROFILE_PATH = process.env.AI_PROFILE_PATH || path.join(__dirname, 'profile.json');
const MEMORY_DIR = process.env.AI_MEMORY_DIR || path.join(__dirname, 'memory', 'sessions');
const DEFAULT_MODEL = process.env.AI_MODEL || 'gpt-4.1-mini';

function loadProfile() {
  try {
    const raw = fs.readFileSync(PROFILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { default_mode: 'personal', modes: { personal: { system: 'You are a helpful personal assistant for Mohammad.', max_tokens: 300 }, market: { system: 'You are a marketplace assistant for product and vendor help.', max_tokens: 300 } } };
  }
}

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} }

function appendMemory(sessionId, entry) {
  try {
    ensureDir(MEMORY_DIR);
    const file = path.join(MEMORY_DIR, `${sessionId || 'default'}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, entry)) + '\n', 'utf8');
  } catch (_) {}
}

async function callOpenAIChat({ apiKey, model, system, messages, maxTokens }) {
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
      system ? { role: 'system', content: system } : null,
      ...messages
    ].filter(Boolean),
    temperature: 0.3,
    max_tokens: Math.max(16, Math.min(1024, Number(maxTokens || 300)))
  };

  const url = 'https://api.openai.com/v1/chat/completions';
  // Prefer global fetch if available (Node >=18)
  if (typeof fetch === 'function') {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`openai_http_${res.status}`);
    const json = await res.json();
    const choice = json && json.choices && json.choices[0];
    const text = (choice && choice.message && choice.message.content) || '';
    return { reply: text, usage: json.usage || null, provider: 'openai', model: body.model };
  }
  // Fallback to https if fetch is not available
  const https = require('https');
  const payload = JSON.stringify(body);
  const opts = new URL(url);
  const reqOpts = {
    hostname: opts.hostname,
    path: opts.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(payload) }
  };
  const data = await new Promise((resolve, reject) => {
    const req = https.request(reqOpts, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  if (data.status < 200 || data.status >= 300) throw new Error(`openai_http_${data.status}`);
  const json = JSON.parse(data.body);
  const choice = json && json.choices && json.choices[0];
  const text = (choice && choice.message && choice.message.content) || '';
  return { reply: text, usage: json.usage || null, provider: 'openai', model: body.model };
}

async function respondStub({ system, messages }) {
  const last = messages[messages.length - 1] || { content: '' };
  const prompt = String(last.content || '').trim();
  const sys = system ? `[${system.slice(0, 60)}...]` : '';
  const reply = `رد تجريبي (Stub)\n${sys}\nسؤالك: ${prompt}\n— هذا رد مؤقت دون اتصال بمزود خارجي.`;
  return { reply, usage: null, provider: 'stub', model: 'stub' };
}

async function chat({ prompt, history, sessionId, mode, maxTokens }) {
  const profile = loadProfile();
  const activeMode = mode || profile.default_mode || 'personal';
  const modeCfg = (profile.modes && profile.modes[activeMode]) || {};
  const system = modeCfg.system || profile.system || '';
  const maxT = maxTokens || modeCfg.max_tokens || 300;

  const messages = [];
  if (Array.isArray(history)) {
    for (const h of history) {
      const role = h.role === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content: String(h.content || '') });
    }
  }
  messages.push({ role: 'user', content: String(prompt || '') });

  const apiKey = process.env.OPENAI_API_KEY || '';
  let result;
  if (apiKey) {
    try {
      result = await callOpenAIChat({ apiKey, model: process.env.AI_MODEL, system, messages, maxTokens: maxT });
    } catch (e) {
      result = await respondStub({ system, messages });
      result.error = String(e && e.message || e);
    }
  } else {
    result = await respondStub({ system, messages });
  }

  appendMemory(sessionId || 'default', { mode: activeMode, in: prompt, out: result.reply });

  return Object.assign({ mode: activeMode }, result);
}

module.exports = { chat };
