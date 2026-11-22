const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');
const { loadLegacy, convertLegacy } = require('../server/legacy-import.cjs');
const { openStore } = require('../server/material-store.cjs');
const { createServer } = require('../server/index.cjs');
const model = require('../js/data/model.js');
const { create: createRepository } = require('../js/data/repository.js');
process.chdir(path.join(__dirname, '..'));
(async () => {
  const legacy = loadLegacy();
  const seed = convertLegacy(legacy);
  const catalog = model.createCatalog(seed);
  for (const [key, lesson] of Object.entries(legacy.lessons)) {
    const actual = catalog.lessons[key];
    for (const [field, oldRows] of [['dialogue',lesson.dialogue || lesson.lines || []],['words',lesson.words || []],['examples',lesson.examples || []]]) {
      assert.equal(actual[field].length, oldRows.length);
      oldRows.forEach((row, i) => {
        for (const property of ['chinese','pinyin','english','speaker','speakerPinyin','category']) assert.equal(actual[field][i][property] || '', row[property] || '', `${key} ${field} ${i}: ${property}`);
        assert(actual[field][i].id);
        if (row.audio) assert.equal(actual[field][i].audio, row.audio);
      });
    }
  }
  for (const asset of seed.assets.filter(asset => asset.kind === 'audio')) assert(fs.statSync(asset.path).size > 1000, asset.path);
  assert.throws(() => model.validate({ ...seed, items: [...seed.items,seed.items[0]] }), /Duplicate/);
  assert.throws(() => model.validate({ ...seed, sectionItems: [{...seed.sectionItems[0],itemId:'missing'}] }), /Invalid/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'chinese-material-db-'));
  const filename = path.join(temp,'materials.sqlite');
  let store = openStore(filename);
  const originalId = catalog.idForChinese('火車');
  const original = store.snapshot().items.find(row => row.id === originalId);
  const changed = store.updateItem(originalId,{ expectedRevision: original.revision, chineseTraditional:'火車測試' });
  assert.equal(changed.id,originalId);
  assert.equal(changed.revision,2);
  assert.throws(() => store.updateItem(originalId,{expectedRevision:1,english:'stale'}), error => error.status === 409);
  const created = store.createCollection({ lessonNumber:10,dialogNumber:1,title:'A new lesson' });
  const section = created.sections.find(section => section.kind === 'vocabulary');
  const count = store.snapshot().items.length;
  assert.throws(() => store.addItem(section.id,{chineseTraditional:''}), /Invalid/);
  assert.equal(store.snapshot().items.length,count);
  const inserted = store.addItem(section.id,{chineseTraditional:'動態教材',pinyin:'dòngtài jiàocái',english:'Dynamic material'});
  assert(!inserted.placement.audioAssetId);
  store.close();
  store = openStore(filename);
  assert.equal(store.snapshot().items.length,count + 1,'Opening the DB again must not repeat the seed');
  assert.equal(store.snapshot().items.find(row=>row.id===originalId).chineseTraditional,'火車測試');
  const server = createServer({store});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const repository = createRepository({baseUrl:base+'/api'});
    const snapshot = await repository.load();
    assert.equal(model.createCatalog(snapshot).lessonCount,10);
    const remote = await repository.createCollection({lessonNumber:10,dialogNumber:2,title:'Second dynamic dialogue'});
    await assert.rejects(repository.createCollection({lessonNumber:10,dialogNumber:2,title:'Duplicate'}),error=>error.status===409);
    const target = remote.sections.find(row=>row.kind==='examples');
    const item = await repository.addItem(target.id,{chineseTraditional:'你好。',pinyin:'Nǐ hǎo.',english:'Hello.'});
    assert.equal(item.placement.position,0);
    const same = await repository.addItem(target.id,{itemId:item.item.id,speaker:'B'});
    assert.equal(same.item.id,item.item.id);
    const modified = await repository.updateItem(item.item.id,{expectedRevision:1,english:'Hello there.'});
    assert.equal(modified.revision,2);
    await assert.rejects(repository.updateItem(item.item.id,{expectedRevision:1,english:'Lost update'}),error=>error.status===409);
    const recording = seed.assets.find(row=>row.kind==='audio');
    const attached = await repository.attachAudio(item.placement.id,{path:recording.path,voice:'George'});
    const repeated = await repository.attachAudio(item.placement.id,{path:recording.path,voice:'George'});
    assert.equal(attached.id,repeated.id,'Retrying audio attachment is idempotent');
    await assert.rejects(repository.attachAudio(item.placement.id,{path:'javascript:alert(1)'}),error=>error.status===400);
    assert.equal((await fetch(base+'/api/collections',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/collections',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'})).status,400);
    for (const url of ['/.env','/.git/config','/data/materials.sqlite','/server/material-store.cjs','/lesson1/dialog1/data.js']) assert.equal((await fetch(base+url)).status,404,url);
    const html = await (await fetch(base+'/')).text();
    assert(html.includes('bootstrap.js'));
    assert(!html.includes('materials/lesson1/dialog1/data.js'));
    const range = await fetch(base+'/'+recording.path,{headers:{Range:'bytes=0-15'}});
    assert.equal(range.status,206); assert.equal(range.headers.get('content-type'),'audio/mpeg'); assert.equal((await range.arrayBuffer()).byteLength,16);
    for (const asset of seed.assets.filter(asset=>['image','document'].includes(asset.kind)).slice(0,2)) assert.equal((await fetch(base+'/'+asset.path,{method:'HEAD'})).status,200);
    const context = vm.createContext({window:{},console});
    const elements = new Map();
    const element = key => {
      if (!elements.has(key)) elements.set(key,{innerHTML:'',listeners:{},classList:{toggle(){}},setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];},insertAdjacentHTML(){},addEventListener(type,fn){this.listeners[type]=fn;}});
      return elements.get(key);
    };
    const saved = new Map([
      ['chinese-exam-quiz-stats-v3',JSON.stringify({'火車':{shown:7,correct:2}})],
      ['chinese-exam-personal-list-v1',JSON.stringify({name:'Old list',items:[{chinese:'火車',pinyin:'huǒchē',english:'train'}]})]
    ]);
    context.document = {getElementById:element,querySelector:element,documentElement:element('root'),addEventListener(){}};
    context.localStorage = {getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
    context.snapshot = await repository.load();
    for (const [,file] of html.matchAll(/<script src="([^"]+)"/g)) if (!['app.js','bootstrap.js'].includes(file)) vm.runInContext(fs.readFileSync(file,'utf8'),context);
    const app = fs.readFileSync('app.js','utf8').replace(/  draw\(\);\n};\s*$/,`  draw();\nwindow.test={getWordStats,getPersonalList,saveQuizStats,show:()=>{currentLesson=10;currentPart='dialog1';draw();}};\n};`);
    vm.runInContext(app+'\nwindow.ChineseApp.start(snapshot);',context);
    assert(!context.window.CHINESE_LESSONS,'UI must run without loading legacy globals');
    assert(elements.get('content').innerHTML.includes('data-character-zoom="動"'));
    assert.equal(context.window.test.getWordStats('火車測試').correct,2,'Editing Chinese text keeps old progress');
    assert.equal(context.window.test.getPersonalList().items[0].id,originalId);
    assert.equal(context.window.test.getPersonalList().items[0].chinese,'火車測試');
    context.window.test.saveQuizStats();
    assert.equal(JSON.parse(saved.get('chinese-exam-quiz-stats-v3'))[originalId].correct,2);
    context.window.test.show();
    assert.equal(elements.get('lessonTitle').textContent,'Lesson 10 · Dialog 1');
    console.log('PASS: complete seed migration, database persistence, dynamic lessons/items/audio, stable IDs and progress, optimistic revisions, API validation, media ranges, private-file isolation, and database-only UI startup');
  } finally {
    server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); fs.rmSync(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
