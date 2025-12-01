// messageService.js - lightweight messaging threads service with memory + Mongo (future) capability
'use strict';
const { ensureCountry } = require('../../utils/market/store');
const { isMongoReady } = require('../../config/market-db');
const crypto = require('crypto');

function genId(){ try { return crypto.randomBytes(8).toString('hex'); } catch(_){ return Math.random().toString(16).slice(2,18); } }

async function getThreadModel(){ try { return require('../../models/marketplace/Thread'); } catch(_){ return null; } }
async function getMessageModel(){ try { return require('../../models/marketplace/Message'); } catch(_){ return null; } }
async function getReadStateModel(){ try { return require('../../models/marketplace/ThreadReadState'); } catch(_){ return null; } }

function nowIso(){ return new Date().toISOString(); }

// Create thread (DB if ready, else memory)
async function createThread({ countryCode, creatorUserId, creatorHandle, participants, subject }){
  const cc = String(countryCode||'SA').toUpperCase();
  if(isMongoReady()){
    const MpThread = await getThreadModel();
    if(MpThread){
      const uniqueParticipants = Array.from(new Set([...(participants||[]).map(String), creatorHandle].filter(Boolean)));
      const createdAt = new Date();
      const doc = await MpThread.create({ countryCode: cc, participants: uniqueParticipants, creatorUserId: String(creatorUserId||''), creatorHandle, subject: subject||null, lastMessage: null, messageCount: 0, readStates: [{ handle: creatorHandle, lastReadAt: createdAt }] });
      // Initialize read states collection (optional, lazy for others)
      try{
        const MpRead = await getReadStateModel();
        if(MpRead){
          await MpRead.updateOne({ thread: doc._id, handle: creatorHandle }, { $setOnInsert: { lastReadAt: createdAt, unreadCount: 0 } }, { upsert: true });
          for(const p of uniqueParticipants){ if(p!==creatorHandle){ await MpRead.updateOne({ thread: doc._id, handle: p }, { $setOnInsert: { lastReadAt: null, unreadCount: 0 } }, { upsert: true }); } }
        }
      }catch(_e){}
      return { id: String(doc._id), countryCode: doc.countryCode, participants: doc.participants, creatorUserId: doc.creatorUserId, creatorHandle: doc.creatorHandle, subject: doc.subject, createdAt: doc.createdAt.toISOString(), updatedAt: doc.updatedAt.toISOString(), lastMessage: null, messageCount: 0 };
    }
  }
  const bucket = ensureCountry(countryCode);
  const id = genId();
  const now = nowIso();
  const uniqueParticipants = Array.from(new Set([...(participants||[]).map(String), creatorHandle].filter(Boolean)));
  const thread = { id, countryCode: cc, participants: uniqueParticipants, creatorUserId: String(creatorUserId||''), creatorHandle, subject: subject||null, createdAt: now, updatedAt: now, lastMessage: null, messageCount: 0, readStates: { [creatorHandle]: now } };
  bucket.messages.threads.push(thread);
  bucket.messages.byThread[id] = [];
  return thread;
}

async function listThreadsForHandle({ countryCode, handle, page=1, limit=20 }){
  const cc = String(countryCode||'SA').toUpperCase();
  if(isMongoReady()){
    const MpThread = await getThreadModel();
    if(MpThread){
      const q = { countryCode: cc, participants: handle };
      const total = await MpThread.countDocuments(q).exec();
      const docs = await MpThread.find(q).sort({ updatedAt: -1 }).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).lean().exec();
      const MpRead = await getReadStateModel();
      let rsMap = new Map();
      if(MpRead && docs.length){
        const ids = docs.map(d=> d._id);
        const states = await MpRead.find({ thread: { $in: ids }, handle }).lean().exec();
        for(const s of states){ rsMap.set(String(s.thread), s); }
      }
      const items = docs.map(d => {
        const s = rsMap.get(String(d._id));
        const unreadCount = s ? (s.unreadCount||0) : 0;
        return { id: String(d._id), countryCode: d.countryCode, participants: d.participants, creatorUserId: d.creatorUserId, creatorHandle: d.creatorHandle, subject: d.subject||null, createdAt: d.createdAt && d.createdAt.toISOString(), updatedAt: d.updatedAt && d.updatedAt.toISOString(), lastMessage: d.lastMessage||null, messageCount: d.messageCount||0, unreadCount };
      });
      return { total, items };
    }
  }
  const bucket = ensureCountry(cc);
  const rows = bucket.messages.threads.filter(t => t.participants.includes(handle));
  rows.sort((a,b)=> new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const start = (Number(page)-1)*Number(limit); const items = rows.slice(start, start+Number(limit));
  const mapped = items.map(t => {
    const list = bucket.messages.byThread[t.id] || [];
    const lastRead = t.readStates && t.readStates[handle] ? new Date(t.readStates[handle]).getTime() : 0;
    const unreadCount = list.filter(m => new Date(m.createdAt).getTime() > lastRead).length;
    return Object.assign({}, t, { unreadCount });
  });
  return { total: rows.length, items: mapped };
}

async function postMessage({ countryCode, threadId, authorHandle, authorUserId, content }){
  const cc = String(countryCode||'SA').toUpperCase();
  if(!content || !String(content).trim()) return { ok:false, error:'EMPTY_CONTENT' };
  const text = String(content).trim();
  if(text.length > 2000) return { ok:false, error:'CONTENT_TOO_LONG' };
  if(isMongoReady()){
    const MpThread = await getThreadModel(); const MpMessage = await getMessageModel();
    if(MpThread && MpMessage){
      const thr = await MpThread.findOne({ _id: threadId }).exec();
      if(!thr) return { ok:false, error:'THREAD_NOT_FOUND' };
      if(!thr.participants.includes(authorHandle)) return { ok:false, error:'NOT_PARTICIPANT' };
      const doc = await MpMessage.create({ thread: thr._id, authorHandle, authorUserId: String(authorUserId||''), content: text });
      thr.lastMessage = { authorHandle, content: text.slice(0,160), createdAt: doc.createdAt };
      thr.messageCount = (thr.messageCount||0) + 1; thr.updatedAt = doc.createdAt; await thr.save();
      // Update read/unread counters: mark sender as read, increment others' unread
      try{
        const MpRead = await getReadStateModel();
        if(MpRead){
          // Sender: upsert lastReadAt and reset unread
          await MpRead.updateOne({ thread: thr._id, handle: authorHandle }, { $set: { lastReadAt: doc.createdAt, unreadCount: 0 } }, { upsert: true });
          // Others: increment unread (bulk)
          const ops = (thr.participants||[]).filter(h=> h!==authorHandle).map(h=> ({ updateOne: { filter: { thread: thr._id, handle: h }, update: { $inc: { unreadCount: 1 } }, upsert: true } }));
          if(ops.length) await MpRead.bulkWrite(ops, { ordered:false });
        } else {
          // fallback to embedded array for lastReadAt
          if(Array.isArray(thr.readStates)){
            const idx = thr.readStates.findIndex(r=>r && r.handle === authorHandle);
            if(idx >= 0){ thr.readStates[idx].lastReadAt = doc.createdAt; } else { thr.readStates.push({ handle: authorHandle, lastReadAt: doc.createdAt }); }
            await thr.save();
          }
        }
      }catch(_e){}
      return { ok:true, message: { id: String(doc._id), threadId: String(thr._id), authorHandle, authorUserId: String(authorUserId||''), content: text, createdAt: doc.createdAt.toISOString() } };
    }
  }
  const bucket = ensureCountry(cc);
  const list = bucket.messages.byThread[threadId];
  if(!list) return { ok:false, error:'THREAD_NOT_FOUND' };
  const thread = bucket.messages.threads.find(t => t.id === threadId);
  if(!thread) return { ok:false, error:'THREAD_NOT_FOUND' };
  if(!thread.participants.includes(authorHandle)) return { ok:false, error:'NOT_PARTICIPANT' };
  const now = new Date().toISOString();
  const msg = { id: genId(), threadId, authorHandle, authorUserId: String(authorUserId||''), content: text, createdAt: now };
  list.push(msg);
  thread.lastMessage = { authorHandle, content: text.slice(0,160), createdAt: now };
  thread.updatedAt = now; thread.messageCount = (thread.messageCount||0) + 1;
  // mark sender as read
  try{ if(!thread.readStates) thread.readStates = {}; thread.readStates[authorHandle] = now; }catch(_e){}
  return { ok:true, message: msg };
}

async function getThread({ countryCode, threadId, handle }){
  const cc = String(countryCode||'SA').toUpperCase();
  if(isMongoReady()){
    const MpThread = await getThreadModel();
    if(MpThread){
      const d = await MpThread.findById(threadId).lean().exec();
      if(!d) return null; if(handle && !(d.participants||[]).includes(handle)) return null;
      return { id: String(d._id), countryCode: d.countryCode, participants: d.participants, creatorUserId: d.creatorUserId, creatorHandle: d.creatorHandle, subject: d.subject||null, createdAt: d.createdAt && d.createdAt.toISOString(), updatedAt: d.updatedAt && d.updatedAt.toISOString(), lastMessage: d.lastMessage||null, messageCount: d.messageCount||0 };
    }
  }
  const bucket = ensureCountry(cc);
  const thread = bucket.messages.threads.find(t => t.id === threadId);
  if(!thread) return null;
  if(handle && !thread.participants.includes(handle)) return null;
  return thread;
}

async function listMessages({ countryCode, threadId, handle, page=1, limit=50, markRead=true }){
  const cc = String(countryCode||'SA').toUpperCase();
  if(isMongoReady()){
    const MpThread = await getThreadModel(); const MpMessage = await getMessageModel();
    if(MpThread && MpMessage){
      const thr = await MpThread.findById(threadId).lean().exec();
      if(!thr) return { ok:false, error:'THREAD_NOT_FOUND' };
      if(handle && !(thr.participants||[]).includes(handle)) return { ok:false, error:'NOT_PARTICIPANT' };
      const q = { thread: threadId };
      const total = await MpMessage.countDocuments(q).exec();
      const docs = await MpMessage.find(q).sort({ createdAt: 1 }).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).lean().exec();
      const items = docs.map(d => ({ id: String(d._id), threadId: String(d.thread), authorHandle: d.authorHandle, authorUserId: d.authorUserId, content: d.content, createdAt: d.createdAt && d.createdAt.toISOString() }));
      // auto mark as read up to newest item
      if(markRead && items.length){
        try{
          const latest = new Date(items[items.length-1].createdAt);
          const MpRead = await getReadStateModel();
          if(MpRead){ await MpRead.updateOne({ thread: threadId, handle }, { $set: { lastReadAt: latest, unreadCount: 0 } }, { upsert: true }); }
          else {
            const thrDoc = await (await getThreadModel()).findById(threadId).exec();
            if(Array.isArray(thrDoc.readStates)){
              const i = thrDoc.readStates.findIndex(r=>r && r.handle === handle);
              if(i>=0){ if(!thrDoc.readStates[i].lastReadAt || latest > thrDoc.readStates[i].lastReadAt){ thrDoc.readStates[i].lastReadAt = latest; } }
              else { thrDoc.readStates.push({ handle, lastReadAt: latest }); }
              await thrDoc.save();
            }
          }
        }catch(_e){}
      }
      return { ok:true, total, items };
    }
  }
  const bucket = ensureCountry(cc);
  const thread = bucket.messages.threads.find(t => t.id === threadId);
  if(!thread) return { ok:false, error:'THREAD_NOT_FOUND' };
  if(handle && !thread.participants.includes(handle)) return { ok:false, error:'NOT_PARTICIPANT' };
  const list = bucket.messages.byThread[threadId] || [];
  const start = (Number(page)-1)*Number(limit); const items = list.slice(start, start+Number(limit));
  // mark read in memory
  if(markRead && items.length){
    try{
      const latest = items[items.length-1].createdAt;
      if(!thread.readStates) thread.readStates = {};
      const prev = thread.readStates[handle];
      if(!prev || new Date(latest) > new Date(prev)) thread.readStates[handle] = latest;
    }catch(_e){}
  }
  return { ok:true, total: list.length, items };
}

async function markThreadRead({ countryCode, threadId, handle, ts }){
  const cc = String(countryCode||'SA').toUpperCase();
  const when = ts ? new Date(ts) : new Date();
  if(isMongoReady()){
    const MpThread = await getThreadModel();
    if(MpThread){
      const thr = await MpThread.findById(threadId).exec();
      if(!thr) return false;
      if(!(thr.participants||[]).includes(handle)) return false;
      try{
        const MpRead = await getReadStateModel();
        if(MpRead){ await MpRead.updateOne({ thread: thr._id, handle }, { $set: { lastReadAt: when, unreadCount: 0 } }, { upsert: true }); }
        else {
          if(!Array.isArray(thr.readStates)) thr.readStates = [];
          const i = thr.readStates.findIndex(r=>r && r.handle === handle);
          if(i>=0){ if(!thr.readStates[i].lastReadAt || when > thr.readStates[i].lastReadAt) thr.readStates[i].lastReadAt = when; }
          else thr.readStates.push({ handle, lastReadAt: when });
          await thr.save();
        }
      }catch(_e){}
      return true;
    }
  }
  const bucket = ensureCountry(cc);
  const thread = (bucket.messages.threads||[]).find(t => t.id === threadId);
  if(!thread || !(thread.participants||[]).includes(handle)) return false;
  if(!thread.readStates) thread.readStates = {};
  const prev = thread.readStates[handle];
  if(!prev || when > new Date(prev)) thread.readStates[handle] = when.toISOString();
  return true;
}

module.exports = { createThread, listThreadsForHandle, postMessage, getThread, listMessages, markThreadRead };