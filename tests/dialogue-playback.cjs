const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
(async () => {
  const elements = new Map();
  function element(key) {
    if (!elements.has(key)) elements.set(key, {
      listeners: {}, attributes: {}, dataset: {}, classes: new Set(), innerHTML: '',
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      insertAdjacentHTML() {}, scrollIntoView() { this.scrolled = true; }
    });
    const el = elements.get(key);
    el.classList = { toggle(name, enabled) { enabled ? el.classes.add(name) : el.classes.delete(name); } };
    return el;
  }
  const played = [];
  let failPlayback = false;
  const audio = element('dialogueAudio');
  Object.assign(audio, {
    currentTime: 0, paused: true,
    pause() { this.paused = true; },
    play() { this.paused = false; played.push(this.src); return failPlayback ? Promise.reject(Error('Unavailable')) : Promise.resolve(); }
  });
  const context = vm.createContext({
    window: {}, console,
    document: { getElementById: element, querySelector: element, documentElement: element('root'), addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {} }
  });
  for (const [, file] of fs.readFileSync('index.html', 'utf8').matchAll(/<script src="([^"]+)"/g)) {
    if (file !== 'app.js') vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  }
  const lines = [0, 1, 2].map(index => ({ chinese: '你好', pinyin: 'Nǐ hǎo', english: 'Hello', audio: `turn-${index}.mp3` }));
  context.window.CHINESE_LESSONS['1-dialog1'] = { dialogue: lines };
  const source = fs.readFileSync('app.js', 'utf8').replace(/  draw\(\);\n\}\)\(\);\s*$/, `window.test = { renderLines, content, drawContent, updateDialoguePlayer, setMode: value => { currentLesson = value; } };\n})();`);
  vm.runInContext(source, context);
  const app = context.window.test;
  const key = '1-dialog1-dialogue';
  const html = app.renderLines(lines, key);
  assert(html.includes(`data-dialogue-player="${key}"`));
  assert.equal((html.match(/data-dialogue-line=/g) || []).length, 3);
  assert(!app.renderLines(lines, '1-dialog1-examples').includes('data-dialogue-player'));
  const panel = element('panel');
  panel.dataset.dialoguePlayer = key;
  const play = element('play');
  const status = element('status');
  panel.querySelector = selector => selector === '[data-dialogue-action="play"]' ? play : status;
  const rows = lines.map((_, index) => {
    const row = element(`row-${index}`);
    row.dataset = { dialogueKey: key, dialogueLine: String(index) };
    return row;
  });
  let visiblePanel = panel;
  app.content.querySelector = selector => selector === '[data-dialogue-player]' ? visiblePanel : null;
  app.content.querySelectorAll = selector => selector === '[data-dialogue-line]' ? rows : [];
  function click(action) {
    const button = { dataset: { dialogueAction: action }, closest: () => panel };
    const target = { closest: selector => selector === '[data-dialogue-action]' ? button : null };
    for (const listener of element('.shell').listeners.click) listener({ target });
  }
  function active(index) {
    assert.deepEqual(rows.map(row => row.classes.has('dialogue-line-playing')), rows.map((_, i) => i === index));
  }
  click('play');
  assert.equal(audio.src, 'turn-0.mp3');
  assert.equal(audio.playbackRate, 1);
  assert.equal(play.textContent, '■ Stop');
  active(0);
  const staleEnded = audio.onended;
  audio.onended();
  assert.equal(audio.src, 'turn-1.mp3');
  active(1);
  audio.currentTime = 2.5;
  click('play'); // Stop
  assert(audio.paused);
  active(-1);
  staleEnded(); // A queued callback from an old line cannot advance playback.
  assert.equal(audio.src, 'turn-1.mp3');
  click('play');
  assert.equal(audio.currentTime, 2.5);
  active(1);
  // Re-rendering hints / character script within the same dialogue keeps audio alive.
  app.setMode(1);
  app.drawContent();
  assert.equal(audio.paused, false);
  app.updateDialoguePlayer();
  active(1);
  audio.onended();
  assert.equal(audio.src, 'turn-2.mp3');
  active(2);
  audio.onended();
  assert(audio.paused);
  assert(status.textContent.includes('Finished'));
  active(-1);
  click('play');
  assert.equal(audio.src, 'turn-0.mp3');
  click('reset');
  assert(audio.paused);
  assert.equal(audio.currentTime, 0);
  active(-1);
  click('play');
  assert.equal(audio.src, 'turn-0.mp3');
  // Closing the dialogue or leaving the lesson cancels automatic progression.
  visiblePanel = null;
  app.updateDialoguePlayer();
  assert(audio.paused);
  assert.equal(audio.onended, null);
  visiblePanel = panel;
  click('play');
  app.setMode('home');
  app.drawContent();
  assert(audio.paused);
  assert.equal(audio.onended, null);
  click('play');
  assert.equal(audio.src, 'turn-0.mp3');
  click('reset');
  failPlayback = true;
  click('play');
  await Promise.resolve();
  assert(audio.paused);
  assert(status.textContent.includes('could not be played'));
  active(-1);
  failPlayback = false;
  click('play');
  assert.equal(audio.src, 'turn-0.mp3');
  active(0);
  // A single pronunciation button interrupts the full-dialogue queue.
  const singleAudio = { pause() {}, play() { return Promise.resolve(); } };
  const singleButton = { dataset: { wordAudio: 'individual.mp3' }, closest: () => ({ querySelector: () => singleAudio }) };
  for (const listener of element('.shell').listeners.click) listener({ target: { closest: selector => selector === '[data-word-audio]' ? singleButton : null } });
  assert(audio.paused);
  assert.equal(audio.onended, null);
  assert.equal(singleAudio.src, 'individual.mp3');
  active(-1);
  click('play');
  const lateError = audio.onerror;
  click('reset');
  lateError();
  assert(!status.textContent.includes('could not be played'));
  assert(played.length >= 8);
  console.log('PASS: full dialogue sequence, active lines, stop/resume, reset, completion/replay, redraw, collapse/navigation cleanup, stale callbacks and playback failure/retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
