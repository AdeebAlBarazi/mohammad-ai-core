// systems/marketplace/agent-core/tools/index.js

function sanitizeExpr(expr){
  const s = String(expr||'').trim();
  if(!/^[0-9+\-*/().\s]+$/.test(s)) throw new Error('invalid_expression');
  return s;
}

async function echo(input){ return { ok:true, output: String(input||'') }; }

async function math(input){
  try {
    const expr = sanitizeExpr(input);
    // eslint-disable-next-line no-new-func
    const val = Function('return ('+expr+')')();
    if(typeof val !== 'number' || Number.isNaN(val)) throw new Error('not_a_number');
    return { ok:true, result: val };
  } catch(e){ return { ok:false, error: e && e.message || String(e) }; }
}

const registry = {
  echo,
  math
};

async function callTool({ name, input }){
  const t = registry[String(name||'')];
  if(!t) return { ok:false, error:'tool_not_found' };
  const r = await t(input);
  return Object.assign({ tool:name }, r);
}

module.exports = { callTool, registry };