const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const store = new Map();
let fail = false;
const local = { getItem: key => store.get(key), setItem(key,value) { if (fail) throw new Error('QuotaExceeded'); store.set(key,value); } };
global.localStorage = local;
const api = require('../material-import.js');
assert.equal(api.getMaterials().length,0);
const rows = api.parseText('Vocabulary\n1. 火 車 | huǒchē | train\n安同：你想去哪裡？\n你好\nnǐ hǎo\nHello', { defaultKind:'word', pinyin: text => `draft ${text}` });
assert.equal(rows.length,3);
assert.equal(rows[0].chinese,'火車'); assert.equal(rows[0].english,'train');
assert.equal(rows[1].kind,'dialogue'); assert.equal(rows[1].speaker,'安同');
assert.equal(rows[2].pinyin,'nǐ hǎo'); assert.equal(rows[2].english,'Hello');
const known = api.parseText('火車', {knownItems:[{chinese:'火車',pinyin:'huǒchē',english:'train'}]});
assert.equal(known[0].english,'train');
const ocrNoise = api.parseText('公共汽車 | 33 | 44', {knownItems:[{chinese:'公共汽車',pinyin:'gōnggòng qìchē',english:'bus'}]});
assert.equal(ocrNoise[0].english,'bus');
assert.equal(ocrNoise[0].pinyin,'gōnggòng qìchē');
const normalized = api.parseText('明 ”華: 我想坐火車去。', {knownItems:[{chinese:'我想坐火車去',pinyin:'Wǒ xiǎng zuò huǒchē qù',english:'I want to take the train.'}]});
assert.equal(normalized[0].speaker,'明華'); assert.equal(normalized[0].english,'I want to take the train.');
assert.throws(()=>api.parseText('中'.repeat(100001)),/100,000/);
assert.throws(()=>api.parseText(Array(501).fill('你好').join('\n')),/500/);
const input = {title:'My material',sourceType:'text',rows,reviewed:false};
assert.throws(()=>api.approve(input),/Review/);assert.equal(api.getMaterials().length,0);
assert.throws(()=>api.approve({...input,reviewed:true,title:''}),/title/);
assert.throws(()=>api.approve({...input,reviewed:true,rows:[{chinese:'',included:true}]}),/Chinese/);
assert.throws(()=>api.approve({...input,reviewed:true,rows:rows.map(row=>({...row,included:false}))}),/Select/);
for(const sourceType of ['text','screenshot','photo']) {
  const saved = api.approve({...input,sourceType,reviewed:true,rawText:'Original text',rows:[{...rows[0]},{...rows[1],included:false}],sourceNames:['page.png']});
  assert.equal(saved.rows.length,1);assert.equal(saved.sourceType,sourceType);assert.equal(saved.rawText,'Original text');
}
assert.equal(api.getMaterials().length,3);
fail=true;assert.throws(()=>api.approve({...input,reviewed:true}),/could not be saved/);assert.equal(api.getMaterials().length,3);fail=false;
assert(!api.escape('<img src=x onerror=alert(1)>').includes('<img'));
store.set('chinese-study-materials-v1','{"bad":"data"}');assert.equal(api.getMaterials().length,0);
store.set('chinese-study-materials-v1','not json');assert.equal(api.getMaterials().length,0);
store.delete('chinese-study-materials-v1');
const approved=api.approve({...input,reviewed:true,title:'User lesson <unsafe>'});
// The parser output can now be saved through the same database API used by the application.
const { openStore } = require('../server/material-store.cjs');
const db = openStore(':memory:', { seed: false });
const { sections } = db.createCollection({ lessonNumber: 10, dialogNumber: 1, title: approved.title });
for (const row of approved.rows) {
  const kind = row.kind === 'word' ? 'vocabulary' : row.kind === 'dialogue' ? 'dialogue' : 'examples';
  db.addItem(sections.find(section => section.kind === kind).id, {
    chineseTraditional: row.chinese, pinyin: row.pinyin || '', english: row.english || '', speaker: row.speaker || ''
  });
}
assert.equal(db.snapshot().items.length, approved.rows.length);
assert.equal(db.snapshot().assets.length, 0, 'Import must not invent recordings');
assert.equal(db.snapshot().collections[0].title, 'User lesson <unsafe>');
db.close();
console.log('PASS: parsing, selection, review, limits, local import storage, escaping and saving imported rows to the material database');
