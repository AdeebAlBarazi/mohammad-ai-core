'use strict';

const fs = require('fs');
const path = require('path');

let table = null;
function load(){
  if(table) return table;
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'synonyms.json'), 'utf8');
    table = JSON.parse(raw);
  } catch(_e){ table = {}; }
  return table;
}

function expandTokens(q){
  if(!q) return [];
  const t = String(q).trim().toLowerCase();
  const map = load();
  const set = new Set([t]);
  if(map[t]){
    for(const s of map[t]){ set.add(String(s).toLowerCase()); }
  }
  return Array.from(set);
}

function buildRegexFromSynonyms(q){
  const tokens = expandTokens(q);
  if(tokens.length === 0) return null;
  const escaped = tokens.map(s=> s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = '(' + escaped.join('|') + ')';
  try { return new RegExp(pattern, 'i'); } catch(_e){ return null; }
}

module.exports = { expandTokens, buildRegexFromSynonyms };
