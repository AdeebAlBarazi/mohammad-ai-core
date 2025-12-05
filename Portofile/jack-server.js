// Jack AI Platform Server - Port 3030
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3030;

// Import agent-core from marketplace
let agentCore;
try {
  agentCore = require('../agent-core');
  console.log('✅ Agent-core loaded successfully');
} catch (error) {
  console.error('❌ Failed to load agent-core:', error.message);
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`${req.method} ${url.pathname}`);

  // Health endpoint
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'Jack AI Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      openai: !!process.env.OPENAI_API_KEY
    }));
    return;
  }

  // Chat endpoint (POST /api/chat)
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { message, sessionId } = data;

        if (!message || !String(message).trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'message_required' }));
          return;
        }

        console.log('📨 Jack AI received:', message.substring(0, 50) + '...');

        // Call agent-core
        const result = await agentCore.chat({
          prompt: message,
          sessionId: sessionId || 'portfolio-jack',
          mode: 'unified',
          maxTokens: 1500
        });

        console.log('✅ Jack AI response:', result.reply?.substring(0, 100) + '...');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          response: result.reply,
          model: result.model || 'gpt-4.1-mini',
          provider: result.provider || 'openai',
          latency: result.latency || 0
        }));

      } catch (error) {
        console.error('❌ Chat error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          error: error.message,
          response: 'عذراً، حدث خطأ في معالجة طلبك.'
        }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = '.' + url.pathname;
  if (filePath === './') {
    filePath = './embed.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Jack AI Platform Started! 🤖         ║
╠════════════════════════════════════════╣
║                                        ║
║   🚀 Server: http://localhost:${PORT}    ║
║   💬 API: POST /api/chat               ║
║   🔗 Embed: /embed.html                ║
║                                        ║
║   ✅ CORS enabled                       ║
║   ✅ Agent-core integrated              ║
║   ✅ OpenAI ready                       ║
║                                        ║
║   Press Ctrl+C to stop                 ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', e);
  }
});
