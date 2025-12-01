// systems/marketplace/agent-core/memoryStore.js
// File-backed JSONL memory store with simple session helpers

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = process.env.AI_MEMORY_DIR || path.join(__dirname, 'memory', 'sessions');

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} }

function append(sessionId, entry) {
  try {
    ensureDir(MEMORY_DIR);
    const file = path.join(MEMORY_DIR, `${sessionId || 'default'}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(Object.assign({ ts: new Date().toISOString() }, entry)) + '\n', 'utf8');
  } catch (_) {}
}

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
        const all = fs.readFileSync(p, 'utf8');
        count = all ? all.split('\n').filter(Boolean).length : 0;
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

module.exports = { append, listSessions, getSessionHistory, deleteSession, dir: MEMORY_DIR };
