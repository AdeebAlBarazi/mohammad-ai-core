// fix-mojibake.js
// Attempt to repair Arabic text that was mis-decoded (UTF-8 shown as Latin1 producing ØÙ sequences)
// Usage: node fix-mojibake.js input.json output.json
import fs from 'fs';

function looksMojibake(str){
  return /[ØÙÂ]{2,}/.test(str) && !/[\u0600-\u06FF]/.test(str);
}
function repairString(str){
  try {
    // Interpret current bytes as latin1 and re-decode as UTF-8
    const buf = Buffer.from(str,'latin1');
    const rec = buf.toString('utf8');
    // If result contains Arabic letters, accept; else return original
    if(/[\u0600-\u06FF]/.test(rec)) return rec;
    return str;
  } catch { return str; }
}
function deepRepair(obj){
  if(Array.isArray(obj)) return obj.map(deepRepair);
  if(obj && typeof obj === 'object'){
    const out={};
    for(const [k,v] of Object.entries(obj)){
      out[k]=deepRepair(v);
    }
    return out;
  }
  if(typeof obj === 'string' && looksMojibake(obj)) return repairString(obj);
  return obj;
}

const [,,inputPath,outputPath] = process.argv;
if(!inputPath||!outputPath){
  console.error('Usage: node fix-mojibake.js input.json output.json');
  process.exit(1);
}
const raw = fs.readFileSync(inputPath,'utf8');
let data;
try { data = JSON.parse(raw); } catch(e){
  console.error('Failed to parse JSON:', e.message);
  process.exit(1);
}
const repaired = deepRepair(data);
fs.writeFileSync(outputPath, JSON.stringify(repaired,null,2), {encoding:'utf8'});
console.log('Repaired file written to', outputPath);
