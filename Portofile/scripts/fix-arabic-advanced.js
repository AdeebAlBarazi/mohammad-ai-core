const fs = require('fs');
const path = require('path');

// Proper recovery of Arabic text that was originally UTF-8 but mis-decoded as Windows-1252
// The mojibake now contains characters like Ø Ù plus extended punctuation (e.g. U+201E) representing CP1252 range bytes 0x80-0x9F.
// We reconstruct original byte sequence then decode UTF-8.

const filePath = path.join(__dirname, '..', 'content.json');
const outputPath = path.join(__dirname, '..', 'content.recovered.json');

if (!fs.existsSync(filePath)) {
    console.error('content.json not found at', filePath);
    process.exit(1);
}

let raw = fs.readFileSync(filePath, 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

let json;
try { json = JSON.parse(raw); } catch (e) { console.error('Parse fail:', e.message); process.exit(1); }

// Reverse mapping for CP1252 characters > 0x7F that differ from ISO-8859-1.
// Source: Windows-1252 table.
const cp1252Reverse = {
    0x20AC: 0x80, // €
    0x201A: 0x82, // ‚
    0x0192: 0x83, // ƒ
    0x201E: 0x84, // „
    0x2026: 0x85, // …
    0x2020: 0x86, // †
    0x2021: 0x87, // ‡
    0x02C6: 0x88, // ˆ
    0x2030: 0x89, // ‰
    0x0160: 0x8A, // Š
    0x2039: 0x8B, // ‹
    0x0152: 0x8C, // Œ
    0x017D: 0x8E, // Ž
    0x2018: 0x91, // ‘
    0x2019: 0x92, // ’
    0x201C: 0x93, // “
    0x201D: 0x94, // ”
    0x2022: 0x95, // •
    0x2013: 0x96, // –
    0x2014: 0x97, // —
    0x02DC: 0x98, // ˜
    0x2122: 0x99, // ™
    0x0161: 0x9A, // š
    0x203A: 0x9B, // ›
    0x0153: 0x9C, // œ
    0x017E: 0x9E, // ž
    0x0178: 0x9F  // Ÿ
};

const arabicRange = /[\u0600-\u06FF]/;
const mojibakeMarker = /[ØÙ]/; // Common in corrupted Arabic here

function recoverString(s) {
    if (typeof s !== 'string') return s;
    if (arabicRange.test(s)) return s; // already proper Arabic
    if (!mojibakeMarker.test(s)) return s; // not our target
    const bytes = [];
    for (const ch of s) {
        const code = ch.codePointAt(0);
        if (code <= 0xFF) {
            bytes.push(code);
        } else if (cp1252Reverse[code] !== undefined) {
            bytes.push(cp1252Reverse[code]);
        } else {
            // Character outside CP1252 single-byte set; abandon recovery to avoid damaging data.
            return s;
        }
    }
    const buf = Buffer.from(bytes);
    const rec = buf.toString('utf8');
    return arabicRange.test(rec) ? rec : s;
}

let converted = 0;
let visited = 0;

function walk(node) {
    if (Array.isArray(node)) {
        node.forEach(walk);
        return;
    }
    if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (k === 'ar' && typeof v === 'string') {
                visited++;
                const r = recoverString(v);
                if (r !== v) converted++;
                node[k] = r;
            } else if (typeof v === 'object') {
                walk(v);
            }
        }
    }
}

walk(json);

fs.writeFileSync(outputPath, JSON.stringify(json, null, 4), 'utf8');
console.log('Advanced recovery complete');
console.log('Visited ar fields:', visited);
console.log('Converted:', converted);
console.log('Output written to', outputPath);
