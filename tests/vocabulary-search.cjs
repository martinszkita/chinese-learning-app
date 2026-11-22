const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const elements = new Map();
function element(key) {
  if (!elements.has(key)) elements.set(key, {
    innerHTML: '', listeners: {}, value: '', dataset: {},
    append() {}, insertAdjacentHTML() {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    classList: { toggle() {} }, setAttribute() {}, focus() { this.focused = true; },
    querySelector: selector => element(selector), querySelectorAll() { return []; }
  });
  return elements.get(key);
}
const context = vm.createContext({
  window: {}, console,
  document: { getElementById: element, querySelector: element, documentElement: element('root'), addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} }
});
require('./helpers/runtime.cjs').loadRuntime(context);
let source = require('./helpers/runtime.cjs').appSource(context).replace('function draw() {', 'function actualDraw() {');
source = source.replace(/  draw\(\);\n\}\)\(\);\s*$/, `function draw() {}\nwindow.test = { initialMode: currentLesson, actualDraw, setMode: mode => { currentLesson = mode; }, getMode: () => currentLesson, matchesVocabularySearch, getFilteredVocabulary, getQuizVocabulary, resetQuizSession, drawVocabulary, content, getPersonalList, vocabularyFilterState, rowHintState, setType: type => { vocabularyType = type; }, personalOnly: value => { personalListOnly = value; } };\n})();`);
vm.runInContext(source, context);
const app = context.window.test;
assert.equal(app.initialMode, 'vocabulary');
app.actualDraw();
assert.equal(element('lessonTitle').textContent, 'All words & expressions');
assert(element('content').innerHTML.includes('data-vocabulary-result-count'));
assert(!element('content').innerHTML.includes('HOW TO USE THIS WEBSITE'));
const input = element('[data-vocabulary-search]');
input.matches = selector => selector === '[data-vocabulary-search]';
function fire(type, target, extra = {}) {
  for (const listener of element(['input', 'compositionend'].includes(type) ? '.vocabulary-search' : '.shell').listeners[type] || []) listener({ target, ...extra });
}
function search(value) { input.value = value; fire('input', input); }
const make = (chinese, pinyin, materialType = 'word') => ({ chinese, pinyin, english: 'test', materialType, sources: ['lesson1'], dialogSources: ['1-dialog1'] });
const school = make('學校', 'xuéxiào');
const travel = make('旅行', 'lǚxíng');
const phrase = make('對不起', 'duìbuqǐ', 'expression');
const horse = make('馬', 'mǎ');
const bus = { ...make('公共汽車', 'gōnggòng qìchē'), aliases: [{ chinese: '公車', pinyin: 'gōngchē' }] };
const fixtures = [school, travel, phrase, horse, bus];
for (const [query, expected] of [
  ['學校', '學校'], ['学校', '學校'], ['学', '學校'], ['xuéxiào', '學校'], ['XUE XIAO', '學校'],
  ['xue2xiao4', '學校'], ["xue'xiao", '學校'], ['xiao', '學校'],
  ['lǚxíng', '旅行'], ['lü xing', '旅行'], ['lvxing', '旅行'], ['lu:3xing2', '旅行'],
  ['对不起', '對不起'], ['dui4 bu qi3', '對不起'], ['ma3', '馬'], ['马', '馬'],
  ['公車', '公共汽車'], ['公车', '公共汽車'], ['gongche', '公共汽車']
]) {
  search(query);
  assert.deepEqual(Array.from(app.getFilteredVocabulary(fixtures), item => item.chinese), [expected], query);
}
search('   ');
assert.equal(app.getFilteredVocabulary(fixtures).length, fixtures.length);
search('no-such-item');
assert.equal(app.getFilteredVocabulary(fixtures).length, 0);
assert(element('.vocabulary-list-panel').innerHTML.includes('No words or expressions match'));
assert(element('[data-start-filtered-quiz]').disabled);
search('duibuqi');
app.setType('word');
assert.equal(app.getFilteredVocabulary(fixtures).length, 0);
app.setType('expression');
assert.equal(app.getFilteredVocabulary(fixtures).length, 1);
app.setType('all');
search('xuexiao');
app.vocabularyFilterState['1-dialog1'] = false;
assert.equal(app.getFilteredVocabulary(fixtures).length, 0);
app.vocabularyFilterState['1-dialog1'] = true;
school.sources.push(`personal:${app.getPersonalList().id}`);
app.personalOnly(true);
assert.equal(app.getFilteredVocabulary(fixtures).length, 1);
search('lvxing');
assert.equal(app.getFilteredVocabulary(fixtures).length, 0);
app.personalOnly(false);
// Update only results: input identity, focus and IME composition stay intact.
app.rowHintState['vocabulary-all-0'] = { pinyin: true, english: true };
search('xuexiao');
assert.equal(app.rowHintState['vocabulary-all-0'], undefined);
const previousResults = element('.vocabulary-list-panel').innerHTML;
input.value = 'ni';
fire('input', input, { isComposing: true });
assert.equal(element('.vocabulary-list-panel').innerHTML, previousResults);
input.value = '學校';
fire('compositionend', input);
assert.equal(element('[data-vocabulary-search]'), input);
assert(element('.vocabulary-list-panel').innerHTML.includes('data-character-zoom="學"'));
assert(!element('[data-start-filtered-quiz]').disabled);
// Quiz started from the filtered list keeps its search, then a fresh quiz clears it.
const visibleCount = Number(element('[data-start-filtered-quiz]').textContent.split('·')[1]);
fire('click', { closest: selector => selector === '[data-start-filtered-quiz]' ? { disabled: false } : null });
const quiz = app.getQuizVocabulary();
assert.equal(quiz.length, visibleCount);
assert(quiz.every(item => app.matchesVocabularySearch(item, '學校')));
app.resetQuizSession();
assert(app.getQuizVocabulary().length > visibleCount);
for (const listener of element('[data-vocabulary-search-clear]').listeners.click) listener();
assert.equal(input.value, '');
assert(input.focused);
assert(element('[data-vocabulary-search-clear]').disabled);
assert.equal(app.getFilteredVocabulary(fixtures).length, fixtures.length);
search('<img src=x onerror=alert(1)>');
app.drawVocabulary();
assert(!app.content.innerHTML.includes('<img src=x'));
assert.equal(input.value, '<img src=x onerror=alert(1)>');
assert(!app.content.innerHTML.includes('Multi-character expressions stay together'));
assert(!app.content.innerHTML.includes('Answers counts new quiz responses'));
assert(!app.content.innerHTML.includes('data-vocabulary-search'));
assert(app.content.innerHTML.includes('data-vocabulary-result-count'));
const index = fs.readFileSync('index.html', 'utf8');
assert(index.indexOf('data-vocabulary-search') < index.indexOf('<div class="shell">'));
assert(!require('./helpers/runtime.cjs').appSource(context).includes('function drawHome'));
assert(require('./helpers/runtime.cjs').appSource(context).includes("let currentLesson = 'vocabulary'"));
console.log('PASS: Traditional/Simplified and alias search, Pinyin tones/numbers/spaces/ü, combined filters, empty results, IME, stable input, Clear, filtered quiz and escaping');

app.setMode('reading');
search('xuexiao');
assert.equal(app.getMode(), 'vocabulary');
app.actualDraw();
assert(element('content').innerHTML.includes('data-character-zoom="學"'));
app.setMode('reading');
for (const listener of element('homeButton').listeners.click) listener();
assert.equal(app.getMode(), 'vocabulary');
console.log('PASS: list is the default page, brand returns to the list, navbar search opens results from another mode and explanatory page is removed');
