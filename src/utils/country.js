'use strict';

// Resolve country and currency using tenants config or env fallback
const path = require('path');
const fs = require('fs');

let tenants = null;
function loadTenants() {
    if (tenants) return tenants;
    const p = path.join(__dirname, '..', '..', 'config', 'tenants.json');
    try { tenants = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { tenants = { countries: [] }; }
    return tenants;
}

function resolveCountryFromHost(host) {
    const cfg = loadTenants();
    const h = String(host || '').toLowerCase();
    for (const c of cfg.countries) {
        if (Array.isArray(c.domains) && c.domains.some(d => String(d).toLowerCase() === h)) return c.code;
    }
    return null;
}

function getCurrencyForCountry(code) {
    const cfg = loadTenants();
    const c = cfg.countries.find(x => x.code === String(code).toUpperCase());
    return c && c.currency || (process.env.MARKET_DEFAULT_CURRENCY || 'SAR');
}

function resolveCountry(req) {
    const q = (req && req.query) || {};
    const h = req && (req.headers['x-forwarded-host'] || req.headers['host']);
    return (q.countryCode || q.country || resolveCountryFromHost(h) || process.env.MARKET_DEFAULT_COUNTRY || 'SA').toUpperCase();
}

module.exports = { resolveCountry, resolveCountryFromHost, getCurrencyForCountry };
