import express from 'express';
import mongoose from 'mongoose';
import { authRequired } from '../middleware/auth.js';
import { testConnection, switchDB, getCurrentUri } from '../config/db.js';

const router = express.Router();

// POST /api/admin/db-config { mongoUri, testOnly }
router.post('/db-config', authRequired, async (req,res)=>{
  const { mongoUri, testOnly } = req.body || {};
  if(!mongoUri) return res.status(400).json({ error:'mongoUri required' });
  try {
    if(testOnly){
      await testConnection(mongoUri);
      return res.json({ ok:true, testOnly:true });
    }
    const prev = getCurrentUri();
    const result = await switchDB(mongoUri);
    return res.json({ ok:true, previous: prev, current: mongoUri, changed: result.changed });
  } catch(err){
    console.error('[DB] Switch/Test error', err.message);
    return res.status(500).json({ error: err.message || 'db switch failed' });
  }
});

export default router;

// Graceful shutdown endpoint (POST /api/admin/shutdown)
router.post('/shutdown', authRequired, async (req,res)=>{
  try {
    res.json({ ok:true, message:'Shutting down server gracefully' });
    setTimeout(async ()=>{
      try { await mongoose.connection.close(); } catch {}
      process.exit(0);
    }, 150);
  } catch(err){
    res.status(500).json({ error:'shutdown failed' });
  }
});