// systems/marketplace/src/db/connect.js
// Mongo connection helper with graceful fallback when disabled or failing.
const mongoose = require('mongoose');

let connected = false;
let lastError = null;

async function connectMongo() {
    const uri = process.env.MARKET_MONGO_URL || process.env.MONGO_URL || '';
    const allowFail = (process.env.MARKET_ALLOW_DB_FAIL || '').toLowerCase() === '1' || (process.env.MARKET_ALLOW_DB_FAIL || '').toLowerCase() === 'true';
    if (!uri) {
        if (!allowFail) console.warn('[market-db] MARKET_MONGO_URL not set; running in memory mode');
        return { ok: false, reason: 'NO_URI' };
    }
    try {
        await mongoose.connect(uri, {
            autoIndex: true,
            serverSelectionTimeoutMS: 4000,
            maxPoolSize: Number(process.env.MARKET_DB_MAX_POOL || 10)
        });
        connected = true;
        console.log('[market-db] Mongo connected');
        return { ok: true };
    } catch (e) {
        lastError = e;
        console.warn('[market-db] Mongo connection failed:', e.message);
        if (!allowFail) return { ok: false, error: e.message };
        return { ok: false, reason: 'CONNECT_FAIL', error: e.message };
    }
}

function isConnected() { return connected; }
function getLastError() { return lastError; }

module.exports = { connectMongo, isConnected, getLastError };
