// Simple SSE smoke: ensure stream endpoint returns meta and some data
(async function(){
  try {
    const fetch = global.fetch || require('node-fetch');
    const url = 'http://localhost:' + (process.env.MARKET_PORT || 3002) + '/api/ai/chat/stream';
    const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', 'Accept':'text/event-stream' }, body: JSON.stringify({ prompt:'سحب دخاني', sessionId:'ci-sse' }) });
    if(!res.ok){ console.error('[ci-sse] request failed', res.status); process.exit(2); }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf=''; let sawMeta=false; let sawData=false;
    for(;;){ const { value, done } = await reader.read(); if(done) break; buf += decoder.decode(value, { stream:true }); let idx; while((idx = buf.indexOf('\n\n')) !== -1){ const chunk = buf.slice(0, idx).trim(); buf = buf.slice(idx+2); if(!chunk) continue; const lines = chunk.split('\n'); for(const line of lines){ if(line.startsWith('event: meta')) sawMeta=true; if(line.startsWith('data: ')) sawData=true; } } }
    if(!sawMeta || !sawData){ console.error('[ci-sse] incomplete stream', { sawMeta, sawData }); process.exit(3); }
    console.log('[ci-sse] OK'); process.exit(0);
  } catch(e){ console.error('[ci-sse] error', e && e.message || e); process.exit(1); }
})();