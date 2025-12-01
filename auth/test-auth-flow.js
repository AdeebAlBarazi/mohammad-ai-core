const http = require('http');

function post(url, data){
  return new Promise((resolve,reject)=>{
    try {
      const u = new URL(url);
      const body = JSON.stringify(data);
      const opts = {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req = http.request(opts, res => {
        let chunks = '';
        res.on('data', d => chunks += d);
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(chunks); } catch { parsed = { raw: chunks }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    } catch(e){ reject(e); }
  });
}

(async () => {
  let portEnv = process.env.PORT || process.env.AUTH_PORT || '';
  let port = portEnv;
  try {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, 'runtime-port.txt');
    if(fs.existsSync(p)) {
      const runtimePort = fs.readFileSync(p,'utf8').trim();
      if(runtimePort && runtimePort !== portEnv) {
        port = runtimePort; // prefer actual bound port
      }
    }
  } catch(_) {}
  if(!port) port = '4100';
  if(!port) port = '4100';
  const base = `http://localhost:${port}/api/auth`;
  const ts = new Date().toISOString().replace(/[-:TZ]/g,'').slice(0,14);
  const email = `buyer+${ts}@example.com`;
  const username = `buyer${ts}`;
  console.log('PORT', port, 'Registering', email, username);
  const reg = await post(base + '/register', { email, username, password: 'P@ssw0rd123', fullName: `مستخدم تجريبي ${ts}` });
  console.log('Register result:', reg);
  const loginEmail = await post(base + '/login', { emailOrUsername: email, password: 'P@ssw0rd123' });
  console.log('Login by email result:', loginEmail);
  const loginUser = await post(base + '/login', { emailOrUsername: username, password: 'P@ssw0rd123' });
  console.log('Login by username result:', loginUser);
})();
