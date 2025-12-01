# Personal AI Assistant (Portable Agent)

This directory documents the portable AI assistant added to the marketplace service. The assistant is designed as a “portable agent”: one identity and core logic that any client (web, CLI, VS Code) can use via a stable HTTP API.

## Concept
- Portable agent: identity + memory + tools + policies.
- Stable API: `POST /api/ai/chat` (JSON in/out). Clients stay thin.
- Memory lives outside the UI so it can move with you.
- Secrets live in environment variables; profile/policies are versioned.

## Files Added
- `agent-core/index.js`: Core chat logic
  - Uses OpenAI if `OPENAI_API_KEY` is set; otherwise returns a safe stub reply.
  - Appends minimal JSONL history to `agent-core/memory/sessions/`.
- `agent-core/profile.json`: Portable profile (modes: `personal`, `market`).
- `src/routes/ai.js`: Express router exposing `POST /api/ai/chat`.
- `pages/ai-chat.html`: Minimal web client using existing API-base detection.
- `env.example`: New AI variables (model/profile/memory); see below.
- `.gitignore`: Excludes `.env`, `node_modules/`, and `agent-core/memory/`.

## API
- `POST /api/ai/chat` (رد غير متدفق)
  - Body: `{ prompt: string, history?: Array<{role:"user"|"assistant", content:string}>, sessionId?: string, mode?: string, maxTokens?: number }`
  - Response: `{ ok: true, reply: string, mode: string, provider: string, model: string, usage?: object, latency: number }`
  - أخطاء: 400 غياب `prompt`، 429 ازدحام، 500 خطأ داخلي.

- `POST /api/ai/chat/stream` (SSE بث متدرّج)
  - Header: `Accept: text/event-stream`
  - Body: نفس `POST /chat`
  - Stream: يرسل أسطر SSE بشكل متكرر:
    - `data: {"delta":"..."}` أجزاء النص بالتتابع.
    - `event: meta` ثم `data: { ok:true, latency: <ms> }` عند الإغلاق.
    - `data: [DONE]` للإشارة لنهاية البث.
  - في وضع Stub (بدون مفتاح): سيبث ردًا تجريبيًا بنفس البروتوكول.

## Environment
Append to your `.env` (don’t commit it):
```
# AI Assistant
# OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4.1-mini
AI_MAX_INFLIGHT=4
AI_PROFILE_PATH=./agent-core/profile.json
AI_MEMORY_DIR=./agent-core/memory/sessions
```

## Run (Windows PowerShell)
- Stub mode (no cost):
```
npm run dev:mem
```
- Real responses (OpenAI):
```
$env:OPENAI_API_KEY="sk-..."; npm run dev:mem
```
- Test the endpoint:
```
Invoke-RestMethod -Method Post -Uri http://localhost:3002/api/ai/chat `
  -Body '{"prompt":"مرحبا"}' -ContentType 'application/json' | ConvertTo-Json -Depth 6
```

## Web Client
Open `pages/ai-chat.html` (e.g., via Live Server at `http://127.0.0.1:5500`).
- كشف تلقائي لعنوان الـ API.
- تبديل بين البث/non-stream من خلال مربع الاختيار "بث مباشر" في الشريط العلوي.

### مثال استهلاك المتصفح (SSE عبر fetch)
```js
const res = await fetch('/api/ai/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
  body: JSON.stringify({ prompt: 'السلام عليكم', history: [] })
});
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = ''; let full = '';
for(;;){
  const { value, done } = await reader.read(); if(done) break;
  buf += dec.decode(value, { stream:true });
  let idx; while((idx = buf.indexOf('\n\n')) !== -1){
    const chunk = buf.slice(0, idx).trim(); buf = buf.slice(idx+2);
    for(const line of chunk.split('\n')){
      if(line.startsWith('data: ')){
        const data = line.slice(6);
        if(data === '[DONE]') break;
        try { const j = JSON.parse(data); if(j.delta) { full += j.delta; } } catch(_){ }
      }
    }
  }
}
console.log(full);
```

### مثال Node.js (v18+)
```js
import fetch from 'node-fetch';
const r = await fetch('http://localhost:3002/api/ai/chat/stream', {
  method: 'POST', headers: { 'Content-Type':'application/json', 'Accept':'text/event-stream' },
  body: JSON.stringify({ prompt: 'Ping', history: [] })
});
const reader = r.body.getReader(); const dec = new TextDecoder(); let buf='';
for(;;){ const { value, done } = await reader.read(); if(done) break; buf += dec.decode(value,{stream:true}); /* parse مثل المثال أعلاه */ }
```

## Portability
- Carry `agent-core/` + `agent-core/profile.json` with you.
- Keep memory out of Git (`agent-core/memory/` is ignored). Backup or sync if desired.
- Any surface (web/CLI/extensions) should talk to `POST /api/ai/chat`.

## Roadmap (optional)
- تحسينات البث (SSE/JSONL، إعادة المحاولة، تلخيص جزئي).
- Unified `MemoryStore` (SQLite + embeddings) with pluggable backends.
- Tools surface following MCP design; wrap into MCP later.
- Thin CLI that posts to the same endpoint.

## Security
- Never commit `.env` or keys.
- Rate/flow guard via `AI_MAX_INFLIGHT` (basic); use a proper limiter/proxy in production.
- Respect CORS settings already present in the service.
