const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const storage = new Map();
let failStorage = false;
function load() {
  const elements = new Map();
  function element(key) {
    if (!elements.has(key)) elements.set(key, {
      listeners: {}, addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      classList: { toggle() {} }, setAttribute() {}, querySelectorAll() { return []; }, querySelector() { return null; }
    });
    return elements.get(key);
  }
  const context = {
    window: { alert() {}, setTimeout() {} }, crypto: { randomUUID: () => `list-${storage.size}-${Date.now()}` },
    document: { getElementById: element, querySelector: element, documentElement: element('root'), addEventListener() {} },
    localStorage: { getItem: k => storage.get(k), setItem(k, v) { if (failStorage) throw Error('Full'); storage.set(k, v); } },
    FormData: class { constructor(form) { this.form = form; } get(key) { return this.form.values[key]; } }, console
  };
  vm.createContext(context);
  for (const [,file] of fs.readFileSync('index.html','utf8').matchAll(/<script src="([^"]+)"/g)) {
    if (file !== 'app.js') vm.runInContext(fs.readFileSync(file,'utf8'),context);
  }
  let source = fs.readFileSync('app.js','utf8').replace('function draw() {', 'function actualDraw() {');
  source = source.replace(/  draw\(\);\n\}\)\(\);\s*$/, `function draw() {}\nwindow.test = { drawVocabulary, content, personalLists, getPersonalList, renderPersonalListPicker, renderSaveButton, collectVocabulary, getFilteredVocabulary, sortVocabulary, vocabularySort, getWordStats, getQuizVocabulary, resetQuizSession, quizState, renderWords, persistPersonalList, filter: value => { personalListOnly = value; }, enterQuiz: () => { currentLesson = 'quiz'; } };\n})();`);
  vm.runInContext(source,context);
  const fire = (type, target) => {
    target.matches ||= () => false;
    target.closest ||= () => null;
    for (const fn of element('.shell').listeners[type] || []) fn({ target, preventDefault() {} });
  };
  const app = context.window.test;
  return { app, fire, nav: element('studyToolsNav') };
}
const item = { chinese: '自訂句子', pinyin: 'Zìdìng jùzi', english: 'Custom sentence' };
storage.set('chinese-exam-personal-list-v1', JSON.stringify({ name: 'Old list', items: [item] }));
let { app, fire, nav } = load();
assert.equal(app.personalLists.length, 1);
assert.equal(app.getPersonalList().items[0].chinese, item.chinese);
assert.equal(app.getPersonalList().name, 'Old list');
function create(name) { fire('submit', { matches: s => s === '[data-personal-create]', values: {listName:name} }); }
function choose(id) { fire('change', { matches: s => s === '[data-personal-list-select]', value:id }); }
function save(word) { app.renderSaveButton(word); fire('click', {closest:s => s === '[data-personal-save]' ? {dataset:{personalSave:word.chinese}} : null}); }
create('Travel <today>');
assert.equal(app.personalLists.length, 2);
const newest = app.getPersonalList().id;
assert(app.renderPersonalListPicker().includes('Travel &lt;today&gt;'));
save(item);
assert.equal(app.personalLists[0].items.length,1);
assert.equal(app.personalLists[1].items.length,1);
save(item);
assert.equal(app.personalLists[0].items.length,1);
assert.equal(app.personalLists[1].items.length,0);
const word = app.collectVocabulary().find(w => w.sources.includes('lesson8'));
save(word);
app.filter(true);
assert.equal(app.getFilteredVocabulary(app.collectVocabulary()).length,1);
// Starting a quiz from list A then changing the save target keeps list A as its pool.
app.resetQuizSession([`personal:${newest}`]);
choose('legacy');
assert.deepEqual(Array.from(app.getQuizVocabulary(), w => w.chinese), [word.chinese]);
assert.equal(app.getPersonalList().id, 'legacy');
fire('submit', { matches:s=>s==='[data-personal-rename]', values:{listName:'Renamed'} });
assert.equal(app.personalLists[0].name,'Renamed');
assert.equal(app.personalLists[1].name,'Travel <today>');
// Quiz entry defaults to the newest list, while the selected target survives card redraws.
const fresh=load();
assert.equal(fresh.app.getPersonalList().id,newest);
// Creation failure rolls back both the collection and selected list.
failStorage=true;
create('Cannot save');
assert.equal(app.personalLists.length,2);
assert.equal(app.getPersonalList().id,'legacy');
failStorage=false;
// Numeric sorting and stable ties on the filtered items.
const rows=[{chinese:'a',sources:['lesson8']},{chinese:'b',sources:['lesson2']},{chinese:'c',sources:['midterm1']}];
Object.assign(app.getWordStats('a'),{shown:10,correct:3,answered:4});
Object.assign(app.getWordStats('b'),{shown:2,correct:2,answered:2});
Object.assign(app.getWordStats('c'),{shown:0,correct:0,answered:0});
for(const [key,direction,expected] of [['lesson','asc','bac'],['lesson','desc','cab'],['answered','asc','cba'],['answered','desc','abc'],['accuracy','desc','bac'],['correct','desc','abc']]) {
  Object.assign(app.vocabularySort,{key,direction});
  assert.equal(app.sortVocabulary(rows).map(w=>w.chinese).join(''),expected);
}
const html=app.renderWords(app.sortVocabulary(rows),'vocabulary-all',{showStats:true});
for(const key of ['lesson','shown','answered','correct','accuracy']) assert(html.includes(`data-vocabulary-sort="${key}"`));
assert(html.includes('data-stat-label="Answers"'));
console.log('PASS: legacy migration, creation, list selection, independent membership, rename, reload, rollback, fixed quiz scope, and numeric sorting');

// Both correct and incorrect quiz grades count as answers; revisiting alone does not.
app.quizState.currentChinese = word.chinese;
app.quizState.answered = null;
const before = app.getWordStats(word.chinese).answered;
fire('click', {closest:s=>s==='[data-quiz-answer]'?{dataset:{quizAnswer:'incorrect'}}:null});
assert.equal(app.getWordStats(word.chinese).answered,before+1);
app.quizState.answered = null;
fire('click', {closest:s=>s==='[data-quiz-answer]'?{dataset:{quizAnswer:'correct'}}:null});
assert.equal(app.getWordStats(word.chinese).answered,before+2);
choose('legacy');
for(const fn of nav.listeners.click) fn({target:{closest:s=>s==='[data-quiz]'?{}:null}});
assert.equal(app.getPersonalList().id,newest);
choose('legacy');
assert.equal(app.getPersonalList().id,'legacy');
// Header clicks reverse sort order.
for(let i=0;i<2;i++) fire('click', {closest:s=>s==='[data-vocabulary-sort]'?{dataset:{vocabularySort:'answered'}}:null});
assert.equal(app.vocabularySort.key,'answered');
assert.equal(app.vocabularySort.direction,'desc');
console.log('PASS: both quiz grades count, quiz entry defaults newest, user can override target, header toggles sorting');

app.filter(false);
app.drawVocabulary();
assert(app.content.innerHTML.includes('data-personal-create'));
assert(app.content.innerHTML.includes('data-personal-rename'));
assert(app.content.innerHTML.includes('data-personal-list-select'));
assert(app.content.innerHTML.includes('data-vocabulary-sort="lesson"'));
console.log('PASS: full vocabulary view renders list management and sortable column headers');
