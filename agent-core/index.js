// systems/marketplace/agent-core/index.js
// Minimal agent core: profile + provider + memory store

const fs = require('fs');
const path = require('path');
const memoryStore = require('./memoryStore');
const openaiProvider = require('./providers/openai');
const stubProvider = require('./providers/stub');

const PROFILE_PATH = process.env.AI_PROFILE_PATH || path.join(__dirname, 'profile.json');
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

function listSessions() {
  try {
    ensureDir(MEMORY_DIR);
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.jsonl'));
    return files.map(f => {
      const p = path.join(MEMORY_DIR, f);
      const id = f.replace(/\.jsonl$/i, '');
      let lastTs = null; let count = 0;
      try {
        const stat = fs.statSync(p);
        const size = stat.size || 0;
        // Read last 2KB for quick last timestamp detection
        const fd = fs.openSync(p, 'r');
        const len = Math.min(2048, size);
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, Math.max(0, size - len));
        fs.closeSync(fd);
        const lines = buf.toString('utf8').trim().split('\n').filter(Boolean);
        count = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).length;
        const lastLine = lines[lines.length - 1] || '';
        try { const j = JSON.parse(lastLine); lastTs = j.ts || null; } catch(_){}
      } catch(_){}
      return { id, lastTs, count };
    });
  } catch (_) { return []; }
}

function getSessionHistory(sessionId, { limit = 100 } = {}) {
  try {
    ensureDir(MEMORY_DIR);
    const file = path.join(MEMORY_DIR, `${sessionId || 'default'}.jsonl`);
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    const take = Math.max(1, Math.min(Number(limit) || 100, lines.length));
    const slice = lines.slice(lines.length - take);
    const out = [];
    for (const ln of slice) { try { out.push(JSON.parse(ln)); } catch(_){} }
    return out;
  } catch (_) { return []; }
}

function deleteSession(sessionId) {
  try {
    ensureDir(MEMORY_DIR);
    const file = path.join(MEMORY_DIR, `${sessionId || 'default'}.jsonl`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { ok: true };
  } catch (e) { return { ok: false, error: e && e.message || String(e) }; }
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

async function callOpenAIStream({ apiKey, model, system, messages, maxTokens, onDelta }) {
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
      system ? { role: 'system', content: system } : null,
      ...messages
    ].filter(Boolean),
    temperature: 0.3,
    max_tokens: Math.max(16, Math.min(1024, Number(maxTokens || 300))),
    stream: true
  };
  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  const payload = JSON.stringify(body);
  let reply = '';
  if (typeof fetch === 'function') {
    const res = await fetch(url, { method: 'POST', headers, body: payload });
    if (!res.ok) throw new Error(`openai_http_${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    for(;;){
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while((idx = buf.indexOf('\n\n')) !== -1){
        const chunk = buf.slice(0, idx).trim();
        buf = buf.slice(idx+2);
        if (!chunk) continue;
        // SSE lines might contain multiple lines; process data: lines only
        const lines = chunk.split('\n');
        for(const line of lines){
          const m = line.match(/^data:\s*(.*)$/);
          if(!m) continue;
          const data = m[1];
          if (data === '[DONE]') { try { await onDelta && onDelta(null, true); } catch(_){} return { reply, provider: 'openai', model: body.model }; }
          try {
            const j = JSON.parse(data);
            const d = j && j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (typeof d === 'string' && d.length){ reply += d; try { await onDelta && onDelta(d, false); } catch(_){} }
          } catch(_){ /* ignore parse errors */ }
        }
      }
    }
    return { reply, provider: 'openai', model: body.model };
  }
  // https fallback: no streaming parsing implemented; fall back to non-streaming
  const r = await callOpenAIChat({ apiKey, model, system, messages, maxTokens });
  if (r.reply){ try { await onDelta && onDelta(r.reply, true); } catch(_){} }
  return r;
}

async function respondStub({ system, messages }) {
  const last = messages[messages.length - 1] || { content: '' };
  const prompt = String(last.content || '').trim();
  const sys = system ? `[${system.slice(0, 60)}...]` : '';
  const reply = `رد تجريبي (Stub)\n${sys}\nسؤالك: ${prompt}\n— هذا رد مؤقت دون اتصال بمزود خارجي.`;
  return { reply, usage: null, provider: 'stub', model: 'stub' };
}

async function stream({ prompt, history, sessionId, mode, maxTokens, onDelta }) {
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
    try { result = await openaiProvider.callOpenAIStream({ apiKey, model: process.env.AI_MODEL, system, messages, maxTokens: maxT, onDelta }); }
    catch(e){ result = await stubProvider.stream({ system, messages, onDelta }); result.error = String(e && e.message || e); }
  } else { result = await stubProvider.stream({ system, messages, onDelta }); }

  memoryStore.append(sessionId || 'default', { mode: activeMode, in: prompt, out: result.reply });
  return Object.assign({ mode: activeMode }, result);
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
  if(apiKey){ try { result = await openaiProvider.callOpenAIChat({ apiKey, model: process.env.AI_MODEL, system, messages, maxTokens: maxT }); } catch(e){ result = await stubProvider.chat({ system, messages }); result.error = String(e && e.message || e); } }
  else { result = await stubProvider.chat({ system, messages }); }

  memoryStore.append(sessionId || 'default', { mode: activeMode, in: prompt, out: result.reply });

  return Object.assign({ mode: activeMode }, result);
}

module.exports = { chat, stream };
module.exports.listSessions = memoryStore.listSessions;
module.exports.getSessionHistory = memoryStore.getSessionHistory;
module.exports.deleteSession = memoryStore.deleteSession;
