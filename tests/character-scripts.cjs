const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const storage = new Map();
function load() {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, {
      innerHTML: '', listeners: {}, attributes: {}, open: false,
      showModal() { this.open = true; }, close() { this.open = false; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; },
      querySelectorAll() { return []; }, querySelector() { return null; },
      insertAdjacentHTML(_, html) { this.innerHTML += html; }
    });
    return elements.get(key);
  };
  const context = vm.createContext({
    window: {}, console,
    document: { getElementById: element, querySelector: element, documentElement: element('root'), addEventListener() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }
  });
  for (const [, file] of fs.readFileSync('index.html', 'utf8').matchAll(/<script src="([^"]+)"/g)) {
    if (file !== 'app.js') vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  }
  let source = fs.readFileSync('app.js', 'utf8').replace('function draw() {', 'function actualDraw() {');
  source = source.replace(/  draw\(\);\n\}\)\(\);\s*$/, `function draw() {}\nwindow.test = { appSettings, chineseText, renderLines, renderWords, renderListeningWords, renderQuizFace, drawReading, drawMidterm, content, hintState, openState, collectVocabulary, getWordStats, renderSaveButton, getPersonalList, setMode: mode => { currentLesson = mode; } };\n})();`);
  vm.runInContext(source, context);
  const control = element('characterScript');
  return { app: context.window.test, control, element, change(value) { if (context.window.test.appSettings.characterScript !== value) control.listeners.click(); } };
}
const sentence = { chinese: '他們在臺灣學中文。', pinyin: 'Tāmen zài Táiwān xué Zhōngwén.', english: 'They study Chinese in Taiwan.', speaker: '老師', sources: ['lesson1'], audio: 'test.mp3' };
let { app, control, change } = load();
assert.equal(control.attributes['aria-pressed'], 'false');
control.listeners.click();
assert.equal(control.attributes['aria-pressed'], 'true');
control.listeners.click();
assert.equal(control.attributes['aria-pressed'], 'false');
assert(app.renderLines([sentence], 'sentence').includes('他們在臺灣學中文。'));
change('simplified');
assert.equal(app.appSettings.characterScript, 'simplified');
assert.equal(JSON.parse(storage.get('chinese-exam-settings-v1')).characterScript, 'simplified');
let html = app.renderLines([sentence], 'sentence');
assert(html.includes('他们在台湾学中文。'));
assert(html.includes('老师'));
assert(html.includes('lang="zh-Hans"'));
assert(html.includes('data-personal-save="他們在臺灣學中文。"'));
assert(html.includes('data-word-audio="test.mp3"'));
app.hintState.sentence = { pinyin: true, english: true };
html = app.renderLines([sentence], 'sentence');
assert(html.includes('<ruby>们<rt>'));
assert(html.includes('They study Chinese in Taiwan.'));
assert(app.renderQuizFace(sentence, 'chinese', 'front').includes('他们在台湾学中文。'));
const word = { ...sentence, chinese: '對不起', pinyin: 'Duìbuqǐ', aliases: [{ chinese: '請進' }] };
assert(app.renderWords([word], 'word').includes('对不起'));
assert(app.renderWords([word], 'word').includes('请进'));
// Both columns also cover expressions and full sentences, under either global choice.
for (const script of ['simplified', 'traditional']) {
  change(script);
  html = app.renderWords([word, sentence], 'all', { showStats: true });
  for (const text of ['Traditional · 繁體', 'Simplified · 简体', '對不起', '对不起', '他們在臺灣學中文。', '他们在台湾学中文。']) assert(html.replace(/<[^>]*>/g, '').includes(text), text);
}
change('simplified');
html = app.renderListeningWords({ ...sentence, chinese: '火車', pinyin: 'huǒchē' });
assert(html.includes('data-listening-word="火車"'));
assert(html.includes('>火车</button>'));
app.drawReading();
assert(app.content.innerHTML.includes('我现在在台湾学中文。'));
assert(app.content.innerHTML.includes('lang="zh-Hans"'));
app.setMode('midterm1');
app.openState['midterm1-section-1'] = true;
app.drawMidterm();
assert(app.content.innerHTML.includes('lang="zh-Hans"'));
const before = JSON.stringify(app.collectVocabulary());
const stats = app.getWordStats('火車');
stats.correct = 3;
change('traditional');
change('simplified');
assert.equal(JSON.stringify(app.collectVocabulary()), before);
assert.equal(app.getWordStats('火車').correct, 3);
const reloaded = load();
assert.equal(reloaded.control.attributes['aria-pressed'], 'true');
assert(reloaded.app.renderQuizFace(sentence, 'chinese', 'front').includes('他们在台湾学中文。'));
change('traditional');
assert(app.renderLines([sentence], 'sentence').includes('lang="zh-Hant"'));
assert(app.renderQuizFace(sentence, 'chinese', 'front').includes('他們在臺灣學中文。'));
assert.equal(app.chineseText('<臺灣>', 'simplified'), '<台湾>');
assert(app.renderWords([{ ...sentence, chinese: '<臺灣>' }], 'escape').includes('&lt;臺灣&gt;'));
console.log('PASS: global script switching, persistence, words, phrases, sentences, speakers, aliases, Pinyin, dual columns, Listening keys, Reading, midterms, quiz, stable stats and source data');

// Character zoom is per character in both columns, including long sentences.
const zoomSession = load();
const zoomApp = zoomSession.app;
const zoomHtml = zoomApp.renderWords([sentence], 'zoom', { showStats: true });
for (const character of ['們', '们', '臺', '台', '灣', '湾']) assert(zoomHtml.includes(`data-character-zoom="${character}"`));
assert(!zoomHtml.includes('data-character-zoom="。"'));
zoomApp.hintState.zoom = { pinyin: true, english: false };
const zoomRuby = zoomApp.renderWords([sentence], 'zoom', { showStats: true });
assert(zoomRuby.includes('data-character-zoom="們"'));
assert(zoomRuby.includes('<rt>men</rt>'));
const zoomTarget = { dataset: { characterZoom: '灣', characterLang: 'zh-Hant' } };
const zoomEvent = { target: { closest: selector => selector === '[data-character-zoom]' ? zoomTarget : null } };
const hintsBeforeZoom = JSON.stringify(zoomApp.hintState);
zoomSession.element('.shell').listeners.click(zoomEvent);
const dialog = zoomSession.element('characterZoomDialog');
assert.equal(dialog.open, true);
assert.equal(zoomSession.element('characterZoomGlyph').textContent, '灣');
assert.equal(zoomSession.element('characterZoomGlyph').attributes.lang, 'zh-Hant');
assert.equal(JSON.stringify(zoomApp.hintState), hintsBeforeZoom);
dialog.listeners.click({ target: zoomSession.element('characterZoomGlyph') });
assert.equal(dialog.open, true, 'Clicking the glyph keeps the popup open');
dialog.listeners.click({ target: dialog });
assert.equal(dialog.open, false, 'Clicking the backdrop closes the popup');
zoomTarget.dataset = { characterZoom: '湾', characterLang: 'zh-Hans' };
zoomSession.element('.shell').listeners.click(zoomEvent);
assert.equal(zoomSession.element('characterZoomGlyph').textContent, '湾');
assert.equal(zoomSession.element('characterZoomGlyph').attributes.lang, 'zh-Hans');
zoomSession.element('characterZoomClose').listeners.click();
assert.equal(dialog.open, false);
zoomSession.element('content').listeners.keydown({
  key: ' ', target: zoomEvent.target,
  preventDefault() { assert.fail('A zoom button must keep its native keyboard activation'); }
});
console.log('PASS: per-character zoom in both scripts, Pinyin, original hints preserved, interior clicks, backdrop dismissal, close button, and native keyboard activation');
