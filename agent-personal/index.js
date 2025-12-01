const fs = require('fs');
const path = require('path');

function readProfile() {
  const p = path.join(process.cwd(), 'agent-personal', 'profile.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureSessionDir() {
  const dir = path.join(process.cwd(), 'agent-personal', 'memory', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function appendJsonl(sessionId, message) {
  const dir = ensureSessionDir();
  const file = path.join(dir, `${sessionId}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(message) + '\n');
}

function readHistory(sessionId) {
  const dir = ensureSessionDir();
  const file = path.join(dir, `${sessionId}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
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