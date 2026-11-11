const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'materials/audio/materials.js'), 'utf8'), context);
let count = 0;
const lessonFiles = JSON.parse(fs.readFileSync(path.join(root, 'data/legacy-manifest.json'), 'utf8')).filter(file => /^materials\/lesson/.test(file));
for (const file of lessonFiles) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  const [, lesson, dialog] = /^materials\/lesson(\d+)\/dialog([12])\/data\.js$/.exec(file);
  const data = context.window.CHINESE_LESSONS[`${lesson}-dialog${dialog}`];
  for (const item of data.dialogue || data.lines || []) {
    const recording = item.audio || context.window.CHINESE_MATERIAL_AUDIO[item.chinese];
    assert(recording, `Missing recording: ${lesson}.${dialog}: ${item.chinese}`);
    assert(fs.statSync(path.join(root, recording)).size > 1000, `Incomplete recording: ${recording}`);
    count++;
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'materials/audio/dialogues/manifest.json'), 'utf8'));
assert.equal(manifest.voiceId, 'JBFqnCBsd6RMkjVDRZzb');
assert.equal(manifest.items.length, count);
console.log(`PASS: ${count} individual dialogue recordings across ${lessonFiles.length} lesson parts, mapped to complete George audio files`);
