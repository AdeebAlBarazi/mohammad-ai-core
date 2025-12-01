// systems/marketplace/agent-core/providers/openai.js
const DEFAULT_MODEL = process.env.AI_MODEL || 'gpt-4.1-mini';

async function callOpenAIChat({ apiKey, model, system, messages, maxTokens }) {
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [ system ? { role:'system', content: system } : null, ...messages ].filter(Boolean),
    temperature: 0.3,
    max_tokens: Math.max(16, Math.min(1024, Number(maxTokens || 300)))
  };
  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = { 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` };
  if (typeof fetch === 'function'){
    const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
    if(!res.ok) throw new Error(`openai_http_${res.status}`);
    const json = await res.json();
    const choice = json && json.choices && json.choices[0];
    const text = (choice && choice.message && choice.message.content) || '';
    return { reply:text, usage: json.usage || null, provider:'openai', model: body.model };
  }
  const https = require('https');
  const payload = JSON.stringify(body);
  const opts = new URL(url);
  const reqOpts = { hostname: opts.hostname, path: opts.pathname, method:'POST', headers: Object.assign({}, headers, { 'Content-Length': Buffer.byteLength(payload) }) };
  const data = await new Promise((resolve,reject)=>{ const req = https.request(reqOpts, (res)=>{ let buf=''; res.on('data',c=>buf+=c); res.on('end',()=>resolve({ status:res.statusCode, body:buf })); }); req.on('error',reject); req.write(payload); req.end(); });
  if(data.status<200 || data.status>=300) throw new Error(`openai_http_${data.status}`);
  const json = JSON.parse(data.body);
  const choice = json && json.choices && json.choices[0];
  const text = (choice && choice.message && choice.message.content) || '';
  return { reply:text, usage: json.usage || null, provider:'openai', model: body.model };
}

async function callOpenAIStream({ apiKey, model, system, messages, maxTokens, onDelta }){
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [ system ? { role:'system', content: system } : null, ...messages ].filter(Boolean),
    temperature: 0.3,
    max_tokens: Math.max(16, Math.min(1024, Number(maxTokens || 300))),
    stream: true
  };
  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = { 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}` };
  const payload = JSON.stringify(body);
  let reply = '';
  if(typeof fetch === 'function'){
    const res = await fetch(url, { method:'POST', headers, body: payload });
    if(!res.ok) throw new Error(`openai_http_${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf='';
    for(;;){
      const { value, done } = await reader.read();
      if(done) break;
      buf += decoder.decode(value, { stream:true });
      let idx;
      while((idx = buf.indexOf('\n\n')) !== -1){
        const chunk = buf.slice(0, idx).trim();
        buf = buf.slice(idx+2);
        if(!chunk) continue;
        const lines = chunk.split('\n');
        for(const line of lines){
          const m = line.match(/^data:\s*(.*)$/);
          if(!m) continue;
          const data = m[1];
          if(data === '[DONE]'){ try { await onDelta && onDelta(null, true); } catch(_){} return { reply, provider:'openai', model: body.model }; }
          try {
            const j = JSON.parse(data);
            const d = j && j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if(typeof d === 'string' && d.length){ reply += d; try { await onDelta && onDelta(d, false); } catch(_){} }
          } catch(_){ }
        }
      }
    }
    return { reply, provider:'openai', model: body.model };
  }
  const r = await callOpenAIChat({ apiKey, model, system, messages, maxTokens });
  if(r.reply){ try { await onDelta && onDelta(r.reply, true); } catch(_){} }
  return r;
}

module.exports = { callOpenAIChat, callOpenAIStream };