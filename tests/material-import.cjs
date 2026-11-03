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
// Import integration: a fresh app session discovers the verified material, filters it,
// and builds a quiz without inventing audio paths or changing legacy audio indexes.
const elements = new Map();
function element(key) { if(!elements.has(key)) elements.set(key,{listeners:{},addEventListener(k,f){(this.listeners[k]||=[]).push(f);},classList:{toggle(){}},setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];}});return elements.get(key); }
const context={window:{localStorage:local},localStorage:local,document:{getElementById:element,querySelector:element,documentElement:element('root'),addEventListener(){}},console,crypto:global.crypto};
vm.createContext(context);
for(const [,file] of fs.readFileSync('index.html','utf8').matchAll(/<script src="([^"]+)"/g))if(file!=='app.js')vm.runInContext(fs.readFileSync(file,'utf8'),context);
let source=fs.readFileSync('app.js','utf8').replace(/  draw\(\);\n\}\)\(\);\s*$/, 'window.test={importedMaterials,collectVocabulary,resetQuizSession,getQuizVocabulary,drawNav,vocabularyFilterState,getFilteredVocabulary,content,drawContent,show:id=>{currentLesson=id;}};\n})();');
vm.runInContext(source,context);const app=context.window.test;
assert.equal(app.importedMaterials.length,1);
const words=app.collectVocabulary();assert(words.some(row=>row.chinese==='你想去哪裡？'&&row.sources.includes(approved.id)));
const custom=words.find(row=>row.chinese==='你想去哪裡？');assert.equal(custom.audio,'');
app.resetQuizSession([approved.id]);assert.equal(app.getQuizVocabulary().length,3);
for(const key of Object.keys(app.vocabularyFilterState))app.vocabularyFilterState[key]=key===approved.id;
assert.equal(app.getFilteredVocabulary(words).length,3);
app.drawNav();assert(element('lessonNav').innerHTML.includes('User lesson &lt;unsafe&gt;'));
app.show(approved.id);app.drawContent();assert(app.content.innerHTML.includes('data-custom-quiz'));assert(!app.content.innerHTML.includes('<unsafe>'));
console.log('PASS: parsing, all source types, explicit approval, selection, limits, storage recovery, escaping, imported navigation/filter/quiz and no fabricated audio');
