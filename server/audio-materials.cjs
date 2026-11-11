const path = require('node:path');
const { openStore } = require('./material-store.cjs');
const { createCatalog } = require('../js/data/model.js');
const studyMaterials = require('../js/services/study-materials.js');
function openAudioDatabase() {
  return openStore(process.env.MATERIAL_DB || path.resolve(__dirname, '../data/materials.sqlite'));
}
function audioItems(snapshot, scope) {
  const catalog = createCatalog(snapshot);
  const service = studyMaterials.create({ catalog, getPersonalLists: () => [] });
  const item = (row, sourceKey, kind) => ({ ...row, sourceKey, kind, audio: row.audio && !/^(?:https?:|\/)/.test(row.audio) ? row.audio : `materials/audio/generated/${row.id}.mp3` });
  if (scope === 'vocabulary') return service.collectVocabulary().map(row => item(row, row.dialogSources?.[0] || row.sources[0], 'vocabulary'));
  if (scope === 'listening') {
    const examples = Object.entries(catalog.lessons).flatMap(([key,data]) => (data.examples || []).map(row=>item(row,key,'examples')));
    const questions = Object.entries(catalog.midterms).flatMap(([key,data]) => data.sections.flatMap(s=>s.questions.map(row=>item(row,key,'questions'))));
    return [...examples,...questions];
  }
  return Object.entries(catalog.lessons).flatMap(([key,data]) => {
    if (scope === 'lesson8' && key !== '8-dialog1') return [];
    if (scope === 'lesson9' && !key.startsWith('9-')) return [];
    if (scope === 'materials' && key !== '8-dialog2') return [];
    const kinds = scope === 'dialogues' ? ['dialogue'] : scope === 'materials' ? ['dialogue','words','examples'] : ['words','examples'];
    return kinds.flatMap(kind => (data[kind] || []).map(row => item(row,key,kind)));
  });
}
module.exports = { openAudioDatabase, audioItems };
