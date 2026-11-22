const fs = require('node:fs');
const vm = require('node:vm');
const { convertLegacy } = require('../../server/legacy-import.cjs');
function loadRuntime(context) {
  for (const file of JSON.parse(fs.readFileSync('data/legacy-manifest.json', 'utf8'))) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  for (const [,file] of fs.readFileSync('index.html', 'utf8').matchAll(/<script src="([^"]+)"/g)) {
    if (!['app.js','bootstrap.js'].includes(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
}
function appSource(context) {
  context.window.__TEST_SNAPSHOT = convertLegacy({ lessons: context.window.CHINESE_LESSONS, midterms: context.window.CHINESE_MIDTERMS, audio: context.window.CHINESE_MATERIAL_AUDIO, readings: require('../../js/data/readings.js') });
  return fs.readFileSync('app.js','utf8').replace('window.ChineseApp.start = function start(snapshot) {', '(() => {\n  const snapshot = window.__TEST_SNAPSHOT;').replace(/};\s*$/, '})();\n');
}
module.exports = { loadRuntime, appSource };
