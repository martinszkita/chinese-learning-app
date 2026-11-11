const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const elements = new Map();
function element(key) {
  if (!elements.has(key)) elements.set(key, {
    innerHTML: '', listeners: {}, value: '',
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
for (const [, file] of fs.readFileSync('index.html', 'utf8').matchAll(/<script src="([^"]+)"/g)) {
  if (file !== 'app.js') vm.runInContext(fs.readFileSync(file, 'utf8'), context);
}
let source = fs.readFileSync('app.js', 'utf8').replace('function draw() {', 'function actualDraw() {');
source = source.replace(/  draw\(\);\n\}\)\(\);\s*$/, `function draw() {}\nwindow.test = { matchesVocabularySearch, getFilteredVocabulary, getQuizVocabulary, resetQuizSession, drawVocabulary, content, getPersonalList, vocabularyFilterState, rowHintState, setType: type => { vocabularyType = type; }, personalOnly: value => { personalListOnly = value; } };\n})();`);
vm.runInContext(source, context);
const app = context.window.test;
const input = element('[data-vocabulary-search]');
input.matches = selector => selector === '[data-vocabulary-search]';
function fire(type, target, extra = {}) {
  for (const listener of element('.shell').listeners[type] || []) listener({ target, ...extra });
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
fire('click', { closest: selector => selector === '[data-vocabulary-search-clear]' ? {} : null });
assert.equal(input.value, '');
assert(input.focused);
assert(element('[data-vocabulary-search-clear]').disabled);
assert.equal(app.getFilteredVocabulary(fixtures).length, fixtures.length);
search('<img src=x onerror=alert(1)>');
app.drawVocabulary();
assert(!app.content.innerHTML.includes('<img src=x'));
assert(app.content.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
console.log('PASS: Traditional/Simplified and alias search, Pinyin tones/numbers/spaces/ü, combined filters, empty results, IME, stable input, Clear, filtered quiz and escaping');
