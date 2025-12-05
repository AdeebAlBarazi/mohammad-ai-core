import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import uploadRoutes from './routes/upload.js';
import adminDbRoutes from './routes/admin-db.js';

// Explicitly load .env (fallback to default path)
dotenv.config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.use(express.json());
// Global headers for charset & language (do not override existing content-types)
app.use((req,res,next)=>{
  if(!res.getHeader('Content-Type')){
    // Will be set later by static middleware; leave blank here
  }
  // Explicit language default (can be enhanced later for i18n)
  res.setHeader('Content-Language','ar');
  next();
});

app.get('/api/health', (req,res)=>res.json({ status: 'ok', time: new Date().toISOString() }));
// Static serving of uploaded images
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Serve uploaded images from parent's uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
// Serve main site files from parent directory
app.use(express.static(path.join(__dirname, '../../')));

process.on('uncaughtException',err=>{console.error('[Fatal] Uncaught',err);});
process.on('unhandledRejection',err=>{console.error('[Fatal] UnhandledRejection',err);});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminDbRoutes);

// Dynamic port selection (tries base then increments)
const BASE_PORT = parseInt(process.env.PORT,10) || 3001;
const MAX_TRIES = parseInt(process.env.PORT_SCAN_MAX,10) || 20; // scan up to +20 ports

function listenWithFallback(app, attempt=0){
  const tryPort = BASE_PORT + attempt;
  const server = app.listen(tryPort, '0.0.0.0', ()=>{
    console.log(`[API] Running on port ${tryPort} (0.0.0.0)`);
  });
  global.__HTTP_SERVER__ = server; // expose for graceful shutdown
  server.on('error', err => {
    if(err.code === 'EADDRINUSE'){
      if(attempt+1 < MAX_TRIES){
        console.warn(`[PORT] ${tryPort} in use, trying ${tryPort+1} ...`);
        listenWithFallback(app, attempt+1);
      } else {
        console.error('[PORT] Exhausted attempts. Could not find free port.');
        process.exit(1);
      }
    } else {
      console.error('[SERVER] Listen error', err);
      process.exit(1);
    }
  });
}

process.on('exit', code=>{
  console.log('[PROCESS] Exit with code', code);
});

console.log('[ENV] MONGO_URI exists:', Boolean(process.env.MONGO_URI));
if(!process.env.MONGO_URI){
  console.warn('[ENV] MONGO_URI is missing. Create .env with MONGO_URI, JWT_SECRET, PORT');
}

connectDB(process.env.MONGO_URI)
  .then(()=>{
    listenWithFallback(app);
  })
  .catch(err=>{
    console.error('[DB] Connection failed', err);
    process.exit(1);
  });

async function gracefulShutdown(signal){
  try {
    console.log(`[SHUTDOWN] Received ${signal}, closing server...`);
    const srv = global.__HTTP_SERVER__;
    if(srv){
      await new Promise(res=>srv.close(res));
      console.log('[SHUTDOWN] HTTP server closed');
    }
    try { await (await import('mongoose')).default.connection.close(); } catch {}
    console.log('[SHUTDOWN] Mongo connection closed');
  } catch(err){
    console.error('[SHUTDOWN] Error during shutdown', err);
  } finally {
    process.exit(0);
  }
}
['SIGINT','SIGTERM'].forEach(sig=>process.on(sig,()=>gracefulShutdown(sig)));
