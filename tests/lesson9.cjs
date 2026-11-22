const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const elements = new Map();
function element(key) {
  if (!elements.has(key)) elements.set(key, {
    listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; },
    classList: { toggle() {} }, setAttribute() {}, querySelectorAll() { return []; }, querySelector() { return null; }
  });
  return elements.get(key);
}
const context = vm.createContext({
  window: {}, console,
  document: { getElementById: element, querySelector: element, documentElement: element('root'), addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} }
});
require('./helpers/runtime.cjs').loadRuntime(context);
let source = require('./helpers/runtime.cjs').appSource(context).replace(/  draw\(\);\n\}\)\(\);\s*$/, `window.test = { lessonCount, drawNav, drawContent, renderMaterialScope, renderLines, renderRuby, renderSupplement, collectVocabulary, collectListeningItems, resetQuizSession, getQuizVocabulary, chineseText, appSettings, showLesson: (part = 'dialog1') => { currentLesson = 9; currentPart = part; expandedLesson = 9; } };\n})();`);
vm.runInContext(source, context);
const app = context.window.test;
const lesson = context.window.CHINESE_LESSONS['9-dialog1'];
assert.equal(app.lessonCount, 9);
assert.equal(lesson.dialogue.length, 11);
const expected = [
  '田中，下個星期我們放五天的假，你要回國嗎？',
  '不，我打算在家看電視、影片學中文，你呢？',
  '我想跟朋友去玩。', '不錯啊。去什麼地方？',
  '臺東。聽說那裡的風景非常漂亮。',
  '我也聽說。放假的時候，你常去旅行嗎？',
  '不一定。有時候在家寫功課，有時候出去玩。',
  '你們什麼時候去臺東？', '這個星期六下午去。', '去玩多久？', '大概玩四、五天。'
];
assert.deepEqual(Array.from(lesson.dialogue, line => line.chinese), expected);
lesson.dialogue.forEach((line, index) => {
  assert.equal(line.speaker, index % 2 ? '田中' : '安同');
  assert(line.english && line.speakerPinyin);
  assert(app.renderRuby(line.chinese, line.pinyin), `Pinyin must align with all characters in turn ${index + 1}`);
});
assert(fs.existsSync(lesson.screenshots[0]));
assert.equal(lesson.words.length, 14);
assert.equal(lesson.examples.length, 14);
assert.deepEqual(Array.from(lesson.words, item => item.chinese), ['星期', '回國', '打算', '電視', '影片', '旅行', '功課', '出去', '大概', '放假', '下個星期', '有時候', '多久', '臺東']);
assert.deepEqual(Array.from(lesson.examples, item => item.chinese), [
  '我這個星期六要去花蓮玩兩天。', '你想什麼時候回國？',
  '我同學這個週末打算去參觀他朋友的學校。', '我有空的時候，常常在家看電視。',
  '你喜歡看什麼影片？', '在臺灣坐高鐵旅行，又方便又舒服。',
  '我每天都要寫很多功課。', '明華打算星期三下午出去運動。',
  '我一天大概上六、七個鐘頭的網。', '放假的時候，我喜歡在家聽聽音樂、上上網。',
  '下個星期放四天的假，我打算跟家人去旅行。', '我沒課的時候，有時候在家看影片，有時候出去玩。',
  '你大概想學多久的中文？', '臺東是一個風景非常漂亮的地方。'
]);
for (const item of [...lesson.words, ...lesson.examples]) {
  assert(item.english);
  assert(fs.statSync(item.audio).size > 1000, `Complete recording: ${item.audio}`);
  assert(app.renderRuby(item.chinese, item.pinyin), `Aligned Pinyin: ${item.chinese}`);
}
for (const image of lesson.screenshots) assert(fs.existsSync(image));
assert(fs.existsSync(lesson.sources[0].path));
const vocabulary = app.collectVocabulary().filter(word => word.dialogSources?.includes('9-dialog1'));
assert.equal(vocabulary.length, 14);
assert.equal(vocabulary.filter(word => word.materialType === 'expression').length, 4);
assert.equal(vocabulary.find(word => word.chinese === '星期').english.includes('+ number'), true);
app.resetQuizSession(['9-dialog1']);
assert.equal(app.getQuizVocabulary().length, 14);
app.resetQuizSession(['9-dialog1'], 'expression');
assert.equal(app.getQuizVocabulary().length, 4);
app.resetQuizSession(['9-dialog1'], 'word');
assert.equal(app.getQuizVocabulary().length, 10);
const listening = app.collectListeningItems().filter(item => item.sourceKey === '9-dialog1');
assert.equal(listening.length, 14);
assert.deepEqual(Array.from(listening, item => item.chinese), Array.from(lesson.examples, item => item.chinese));
for (const item of listening) assert(item.audio.startsWith('materials/audio/lesson9/'));
const supplement = app.renderSupplement(lesson, '9-dialog1-supplement');
assert(supplement.includes('14 words'));
assert(supplement.includes('Example sentences'));
app.showLesson();
app.drawNav();
assert(element('lessonNav').innerHTML.includes('data-lesson-select="9" data-part="dialog1"'));
assert(app.renderMaterialScope('vocabulary').includes('data-vocabulary-scope="9-dialog1"'));
assert(app.renderMaterialScope('quiz').includes('data-quiz-scope="9-dialog1"'));
app.drawContent();
let html = element('content').innerHTML;
assert(html.includes('data-dialogue-player="9-dialog1-dialogue"'));
assert(!html.includes('data-dialogue-action="play" aria-pressed="false" disabled'));
assert.equal((html.match(/data-dialogue-line=/g) || []).length, 11);
for (const text of expected) assert(html.includes(text));
assert(html.includes(lesson.screenshots[0]));
app.appSettings.characterScript = 'simplified';
html = app.renderLines(lesson.dialogue, '9-dialog1-dialogue');
assert(html.includes('台东。听说那里的风景非常漂亮。'));
assert(html.includes('lang="zh-Hans"'));
assert(html.includes('data-word-audio="materials/audio/dialogues/9-dialog1-dialogue-11.mp3"'));
console.log('PASS: Lesson 9.1 dialogue, 14 vocabulary entries, 14 PDF examples, aligned Pinyin, source files, word/phrase quiz scopes, Listening, dialogue playback and Simplified Chinese');

const audioManifest = JSON.parse(fs.readFileSync('materials/audio/lesson9/manifest.json', 'utf8'));
assert.equal(audioManifest.items.filter(item => item.sourceKey === '9-dialog1').length, 28);
assert.equal(audioManifest.voiceId, 'JBFqnCBsd6RMkjVDRZzb');
assert.deepEqual(audioManifest.items.filter(item => item.sourceKey === '9-dialog1').map(item => item.chinese), Array.from([...lesson.words, ...lesson.examples], item => item.chinese));
console.log('PASS: 28 complete George recordings and matching supplement manifest');

const second = context.window.CHINESE_LESSONS['9-dialog2'];
assert.equal(second.dialogue.length, 11);
assert.equal(second.words.length, 16);
assert.equal(second.examples.length, 18);
assert.deepEqual(Array.from(second.dialogue, item => item.chinese), [
  '我女朋友九月三十號要來臺灣看我。', '你想帶她去哪裡玩？', '還不知道。你有什麼建議？',
  '臺灣的夜市很有名，你們應該去逛逛。', '謝謝，還有什麼好玩的地方？',
  '臺灣的茶也很特別。臺北有很多茶館。', '到哪裡喝茶比較好？',
  '你們可以去貓空。那裡的風景很美。', '謝謝你。我決定帶她去貓空。你也一起去，好不好？',
  '要是那時候我有空，就跟你們一起去。', '太好了！謝謝！'
]);
assert.deepEqual(Array.from(second.words, item => item.chinese), ['女', '月', '號', '帶', '她', '還', '建議', '夜市', '應該', '逛', '特別', '茶館', '決定', '要是', '就', '貓空']);
assert.deepEqual(Array.from(second.examples, item => item.chinese), [
  '田中的女朋友上個星期來臺灣看他。', '安同打算十二月去日本玩。',
  '你想什麼時候去參觀故宮博物院？', '八月十七號。', '我昨天晚上帶爸爸媽媽去吃越南菜。',
  '她是我們書法課的老師。', '我明天早上得去銀行，還得跟朋友見面。',
  '我想去花蓮玩，你有什麼建議？', '我覺得坐火車去不錯，又便宜又可以看風景。',
  '臺灣有很多有名的夜市。', '來臺灣旅行，我覺得應該去逛逛夜市。',
  '聽說你們學校附近的商店都很有意思，我有空想去逛逛。',
  '很多人都說那家店的牛肉麵很特別，我打算明天下課去吃。', '我最近不忙，常去山上的茶館喝茶。',
  '你決定什麼時候開始教我中文？', '你要是星期天沒事，歡迎來我家坐坐。',
  '要是你想吃臺灣小吃，就去臺南吧！', '貓空的風景很美，那裡的茶也很好喝。'
]);
assert.deepEqual(Array.from(second.examples.filter(item => /[AB]$/.test(item.speaker)), item => item.speaker), ['3A', '3B', '7A', '7B']);
for (const [index, item] of second.dialogue.entries()) assert.equal(item.speaker, index % 2 ? '明華' : '田中');
for (const item of [...second.dialogue, ...second.words, ...second.examples]) {
  assert(item.english);
  assert(app.renderRuby(item.chinese, item.pinyin), `Lesson 9.2 aligned Pinyin: ${item.chinese}`);
}
for (const image of second.screenshots) assert(fs.existsSync(image));
assert(fs.existsSync(second.sources[0].path));
app.appSettings.characterScript = 'traditional';
app.showLesson('dialog2');
app.drawContent();
html = element('content').innerHTML;
assert(html.includes('data-dialogue-player="9-dialog2-dialogue"'));
assert.equal((html.match(/data-dialogue-line=/g) || []).length, 11);
assert(html.includes(second.screenshots[1]));
assert(html.includes(second.sources[0].path));
assert.equal(app.collectVocabulary().filter(item => item.dialogSources?.includes('9-dialog2')).length, 16);
app.resetQuizSession(['9-dialog2']);
assert.equal(app.getQuizVocabulary().length, 16);
app.resetQuizSession(['9-dialog2'], 'expression');
assert.equal(app.getQuizVocabulary().length, 0);
app.resetQuizSession(['9-dialog2'], 'word');
assert.equal(app.getQuizVocabulary().length, 16);
const secondListening = app.collectListeningItems().filter(item => item.sourceKey === '9-dialog2');
assert.equal(secondListening.length, 18);
assert.deepEqual(Array.from(secondListening, item => item.chinese), Array.from(second.examples, item => item.chinese));
app.appSettings.characterScript = 'simplified';
html = app.renderLines(second.dialogue, '9-dialog2-dialogue');
assert(html.includes('我女朋友九月三十号要来台湾看我。'));
assert(html.includes('你们可以去猫空。那里的风景很美。'));
console.log('PASS: Lesson 9.2 source transcription, 11 dialogue turns, 16 words, 18 example turns, A/B grouping, Pinyin, navigation, quiz, Listening and both scripts');
for (const item of [...second.dialogue, ...second.words, ...second.examples]) assert(fs.statSync(item.audio).size > 1000, `Lesson 9.2 recording: ${item.audio}`);
const updatedManifest = JSON.parse(fs.readFileSync('materials/audio/lesson9/manifest.json', 'utf8'));
assert.equal(updatedManifest.items.length, 62);
assert.deepEqual(updatedManifest.items.filter(item => item.sourceKey === '9-dialog2').map(item => item.chinese), Array.from([...second.words, ...second.examples], item => item.chinese));
console.log('PASS: 45 complete George recordings for Lesson 9.2 and matching supplement manifest');
