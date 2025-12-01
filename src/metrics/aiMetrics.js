// systems/marketplace/src/metrics/aiMetrics.js
const prom = require('prom-client');

let aiRequests = null;
let aiErrors = null;
let aiDuration = null;
let promptTokens = null;
let completionTokens = null;
let outputChars = null;

function init(register){
  aiRequests = new prom.Counter({ name:'ai_requests_total', help:'Total AI endpoint requests', labelNames:['endpoint'], registers:[register] });
  aiErrors = new prom.Counter({ name:'ai_errors_total', help:'AI endpoint errors', labelNames:['endpoint'], registers:[register] });
  aiDuration = new prom.Histogram({ name:'ai_request_duration_seconds', help:'AI endpoint request duration', labelNames:['endpoint'], registers:[register], buckets:[0.05,0.1,0.3,0.5,1,2,3,5] });
  promptTokens = new prom.Counter({ name:'ai_prompt_tokens_total', help:'Total prompt tokens (model-reported)', labelNames:['model'], registers:[register] });
  completionTokens = new prom.Counter({ name:'ai_completion_tokens_total', help:'Total completion tokens (model-reported)', labelNames:['model'], registers:[register] });
  outputChars = new prom.Counter({ name:'ai_output_chars_total', help:'Total output characters (approx for stream)', labelNames:['endpoint'], registers:[register] });
}

function get(){ return { aiRequests, aiErrors, aiDuration, promptTokens, completionTokens, outputChars }; }

function recordTokens({ model, prompt, completion }){
  try {
    if(promptTokens && typeof prompt === 'number' && prompt >= 0){ promptTokens.inc({ model: String(model||'unknown') }, prompt); }
    if(completionTokens && typeof completion === 'number' && completion >= 0){ completionTokens.inc({ model: String(model||'unknown') }, completion); }
  } catch(_){ }
}

module.exports = { init, get, recordTokens }; 