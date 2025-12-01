// systems/marketplace/agent-core/providers/stub.js
async function respondStub({ system, messages }){
  const last = messages[messages.length - 1] || { content:'' };
  const prompt = String(last.content||'').trim();
  const sys = system ? `[${system.slice(0,60)}...]` : '';
  const reply = `رد تجريبي (Stub)\n${sys}\nسؤالك: ${prompt}\n— هذا رد مؤقت دون اتصال بمزوّد خارجي.`;
  return { reply, usage:null, provider:'stub', model:'stub' };
}

async function chat({ system, messages }){ return respondStub({ system, messages }); }

async function stream({ system, messages, onDelta }){
  let out=''; const stub = await respondStub({ system, messages });
  const parts = (stub.reply||'').split(/(\s+)/);
  for(const p of parts){ out += p; try { await onDelta && onDelta(p, false); } catch(_){} }
  try { await onDelta && onDelta(null, true); } catch(_){}
  return { reply: out, usage:null, provider:'stub', model:'stub' };
}

module.exports = { chat, stream };