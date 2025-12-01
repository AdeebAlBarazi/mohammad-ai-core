// systems/marketplace/src/metrics/aiMetrics.js
const prom = require('prom-client');

let aiRequests = null;
let aiErrors = null;
let aiDuration = null;

function init(register){
  aiRequests = new prom.Counter({ name:'ai_requests_total', help:'Total AI endpoint requests', labelNames:['endpoint'], registers:[register] });
  aiErrors = new prom.Counter({ name:'ai_errors_total', help:'AI endpoint errors', labelNames:['endpoint'], registers:[register] });
  aiDuration = new prom.Histogram({ name:'ai_request_duration_seconds', help:'AI endpoint request duration', labelNames:['endpoint'], registers:[register], buckets:[0.05,0.1,0.3,0.5,1,2,3,5] });
}

function get(){ return { aiRequests, aiErrors, aiDuration }; }

module.exports = { init, get };