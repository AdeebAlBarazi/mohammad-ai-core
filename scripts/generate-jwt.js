'use strict';
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

function parseArgs(argv){
  const out = { id: 'devuser', role: 'user', exp: process.env.TOKEN_EXPIRES_IN || '1h' };
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    const n = (x)=> (i+1<argv.length? argv[++i] : undefined);
    if (a === '--id') out.id = n();
    else if (a === '--role') out.role = n();
    else if (a === '--exp' || a === '--expiresIn') out.exp = n();
  }
  return out;
}

function readKeyFromEnv(varName, pathVarName) {
  const raw = process.env[varName];
  if (raw && raw.trim()) return raw.replace(/\\n/g, '\n');
  const p = process.env[pathVarName];
  if (p && fs.existsSync(p)) { try { return fs.readFileSync(path.resolve(p), 'utf8'); } catch (_) {} }
  return null;
}

(async function main(){
  const { id, role, exp } = parseArgs(process.argv);
  const payload = { user: { id, role } };
  const priv = readKeyFromEnv('JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_PATH');
  const secret = process.env.JWT_SECRET || null;
  const kid = process.env.JWT_ACTIVE_KID || process.env.JWT_KID;
  if (priv) {
    const token = jwt.sign(payload, priv, { algorithm: 'RS256', expiresIn: exp, keyid: kid });
    process.stdout.write(token);
    return;
  }
  if (!secret) {
    console.error('JWT_SECRET or JWT_PRIVATE_KEY(_PATH) is required');
    process.exit(1);
  }
  const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: exp });
  process.stdout.write(token);
})();
