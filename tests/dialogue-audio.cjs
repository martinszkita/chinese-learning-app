const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'audio/materials.js'), 'utf8'), context);
let count = 0;
for (let lesson = 1; lesson <= 8; lesson++) {
  for (let dialog = 1; dialog <= 2; dialog++) {
    vm.runInContext(fs.readFileSync(path.join(root, `lesson${lesson}/dialog${dialog}/data.js`), 'utf8'), context);
    const data = context.window.CHINESE_LESSONS[`${lesson}-dialog${dialog}`];
    for (const item of data.dialogue || data.lines || []) {
      const recording = item.audio || context.window.CHINESE_MATERIAL_AUDIO[item.chinese];
      assert(recording, `Missing recording: ${lesson}.${dialog}: ${item.chinese}`);
      assert(fs.statSync(path.join(root, recording)).size > 1000, `Incomplete recording: ${recording}`);
      count++;
    }
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'audio/dialogues/manifest.json'), 'utf8'));
assert.equal(manifest.voiceId, 'JBFqnCBsd6RMkjVDRZzb');
assert.equal(manifest.items.length, count);
console.log(`PASS: ${count} individual dialogue recordings across 16 lesson parts, mapped to complete George audio files`);
