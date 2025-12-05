const fs = require('fs');
const path = require('path');

// Target JSON file (root content.json)
const filePath = path.join(__dirname, '..', 'content.json');
const backupPath = path.join(__dirname, '..', 'content.mojibake.backup.json');

if (!fs.existsSync(filePath)) {
    console.error('content.json not found at', filePath);
    process.exit(1);
}

// Read raw JSON
let raw = fs.readFileSync(filePath, 'utf8');
// Remove UTF-8 BOM if present
if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
}
let data;
try {
    data = JSON.parse(raw);
} catch (e) {
    console.error('Failed to parse JSON:', e.message);
    process.exit(1);
}

// Simple heuristic: mojibake Arabic often contains these Latin1 letters (ØÙ) and lacks real Arabic range.
const mojibakePattern = /[ØÙ]/; // present in broken strings
const arabicRange = /[\u0600-\u06FF]/; // true Arabic letters

let convertedCount = 0;
let skippedAlreadyArabic = 0;
let skippedEmpty = 0;

function recover(str) {
    // If already contains proper Arabic characters, return as-is.
    if (arabicRange.test(str)) {
        skippedAlreadyArabic++;
        return str;
    }
    // If it matches mojibake pattern, attempt latin1->utf8 reinterpretation.
    if (mojibakePattern.test(str)) {
        // Use Buffer latin1 encoding to recover original bytes then decode as UTF-8.
        const recovered = Buffer.from(str, 'latin1').toString('utf8');
        // If recovery now has Arabic, accept it.
        if (arabicRange.test(recovered)) {
            convertedCount++;
            return recovered;
        }
        // Otherwise leave original (avoid destructive changes).
        return str;
    }
    return str;
}

function traverse(obj) {
    if (!obj) return;
    if (Array.isArray(obj)) {
        obj.forEach(traverse);
        return;
    }
    if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (key === 'ar' && typeof val === 'string') {
                if (val.trim() === '') {
                    skippedEmpty++;
                    continue;
                }
                obj[key] = recover(val);
            } else if (typeof val === 'object') {
                traverse(val);
            }
        }
    }
}

// Backup original before modifications.
try {
    fs.writeFileSync(backupPath, raw, 'utf8');
    console.log('Backup written to', backupPath);
} catch (e) {
    console.error('Failed to write backup:', e.message);
    process.exit(1);
}

traverse(data);

// Write updated JSON pretty formatted.
try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
} catch (e) {
    console.error('Failed to write updated content.json:', e.message);
    process.exit(1);
}

console.log('Arabic mojibake fix complete.');
console.log('Converted:', convertedCount);
console.log('Skipped already Arabic:', skippedAlreadyArabic);
console.log('Skipped empty fields:', skippedEmpty);
console.log('Done.');
