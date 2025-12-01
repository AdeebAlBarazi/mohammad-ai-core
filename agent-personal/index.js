const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readProfile() {
  const p = path.join(process.cwd(), 'agent-personal', 'profile.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureSessionDir() {
  const dir = path.join(process.cwd(), 'agent-personal', 'memory', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMemKey() {
  const key = process.env.PERSONAL_MEM_KEY;
  return key && crypto.createHash('sha256').update(key).digest();
}

function encryptLine(obj) {
  const key = getMemKey();
  const json = JSON.stringify(obj);
  if (!key) return json;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('v1:'), iv, tag, enc]).toString('base64');
}

function decryptLine(line) {
  const key = getMemKey();
  if (!key) return JSON.parse(line);
  const buf = Buffer.from(line, 'base64');
  const prefix = buf.slice(0,3).toString('utf8');
  if (prefix !== 'v1:') throw new Error('invalid mem line');
  const iv = buf.slice(3, 15);
  const tag = buf.slice(15, 31);
  const enc = buf.slice(31);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(dec);
}

function appendJsonl(sessionId, message) {
  const dir = ensureSessionDir();
  const file = path.join(dir, `${sessionId}.jsonl`);
  fs.appendFileSync(file, encryptLine(message) + '\n');
}

function readHistory(sessionId) {
  const dir = ensureSessionDir();
  const file = path.join(dir, `${sessionId}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(l => decryptLine(l));
}

function getProvider() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      name: 'stub',
      async chat(messages) {
        const last = messages[messages.length - 1]?.content || '';
        return `Stub reply to: ${last}`;
      }
    };
  }
  // Minimal OpenAI adapter via fetch
  const model = process.env.AI_MODEL || 'gpt-4.1-mini';
  return {
    name: 'openai',
    async chat(messages) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ model, messages })
      });
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || 'No response';
    }
  };
}

async function chat({ prompt, sessionId = 'personal-main', mode = 'personal' }) {
  const profile = readProfile();
  const history = readHistory(sessionId);
  const systemMsg = { role: 'system', content: profile.system || 'You are a private personal assistant.' };
  const messages = [systemMsg, ...history, { role: 'user', content: prompt }];

  const provider = getProvider();
  const reply = await provider.chat(messages);

  appendJsonl(sessionId, { role: 'user', content: prompt });
  appendJsonl(sessionId, { role: 'assistant', content: reply });

  return { ok: true, reply, model: provider.name };
}

module.exports = { chat };