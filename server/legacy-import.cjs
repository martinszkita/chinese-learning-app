const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../js/data/model.js');
function loadLegacy(root = path.resolve(__dirname, '..')) {
  const context = vm.createContext({ window: {} });
  for (const file of JSON.parse(fs.readFileSync(path.join(root, 'data/legacy-manifest.json'), 'utf8'))) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return { lessons: context.window.CHINESE_LESSONS, midterms: context.window.CHINESE_MIDTERMS, audio: context.window.CHINESE_MATERIAL_AUDIO,
    readings: require('../js/data/readings.js') };
}
function convertLegacy({ lessons = {}, midterms = {}, audio = {}, readings = [] }) {
  const result = { schemaVersion: 1, collections: [], sections: [], items: [], sectionItems: [], assets: [] };
  const itemIds = new Map(), assetIds = new Map(), vocabularyAudio = new Map();
  let vocabularyIndex = 0;
  // Freeze old numbered audio paths now; new material never guesses filenames from list order.
  for (const data of Object.values(lessons)) for (const item of data.words || []) {
    if (!vocabularyAudio.has(item.chinese)) vocabularyAudio.set(item.chinese, item.audio || audio[item.chinese] || `materials/audio/vocabulary/word-${String(++vocabularyIndex).padStart(3, '0')}.mp3`);
    else continue;
    // Every unique word occupied a legacy index, even when it supplied its own audio.
    vocabularyIndex = vocabularyAudio.size;
  }
  function asset(file, kind = 'audio', voice = '') {
    if (!file) return null;
    const key = `${kind}:${file}`;
    if (!assetIds.has(key)) {
      const id = `seed-asset-${assetIds.size + 1}`;
      assetIds.set(key, id); result.assets.push({ id, kind, path: file, voice, provider: voice ? 'ElevenLabs' : '' });
    }
    return assetIds.get(key);
  }
  function section(collection, kind, rows, title, position) {
    const sectionId = `${collection.id}-${kind}-${position}`;
    result.sections.push({ id: sectionId, collectionId: collection.id, kind, title, position });
    rows.forEach((row, index) => {
      const signature = JSON.stringify([row.chinese, row.pinyin || '', row.english || '', row.partOfSpeech || '']);
      if (!itemIds.has(signature)) {
        const id = `seed-item-${itemIds.size + 1}`; itemIds.set(signature, id);
        const { chinese, pinyin, english, partOfSpeech, aliases, speaker, speakerPinyin, category, audio: ignored, voice, ...metadata } = row;
        result.items.push({ id, chineseTraditional: chinese, chineseSimplified: null, pinyin: pinyin || '', english: english || '', partOfSpeech: partOfSpeech || '', aliases: aliases || [], metadata: { ...metadata, legacyChinese: chinese } });
      }
      let recording = row.audio || audio[row.chinese] || '';
      if (!recording && kind === 'vocabulary') recording = vocabularyAudio.get(row.chinese);
      if (!recording && kind === 'examples') recording = `materials/audio/listening/${collection.key}-example-${String(index + 1).padStart(2, '0')}.mp3`;
      if (!recording && kind === 'questions') recording = `materials/audio/listening/${collection.key}-question-${String(collection.questionOffset + index + 1).padStart(2, '0')}.mp3`;
      result.sectionItems.push({ id: `${sectionId}-${index + 1}`, sectionId, itemId: itemIds.get(signature), position: index,
        speaker: row.speaker || '', speakerPinyin: row.speakerPinyin || '', category: row.category || '', audioAssetId: asset(recording, 'audio', row.voice || (recording ? 'George' : '')) });
    });
  }
  for (const [key, data] of Object.entries(lessons)) {
    const [, lesson, dialog] = /^(\d+)-dialog([12])$/.exec(key);
    const { title, dialogue, lines, words, examples, ...metadata } = data;
    const c = { id: `seed-collection-${key}`, key, kind: 'dialogue', lessonNumber: Number(lesson), dialogNumber: Number(dialog), title: title || '', metadata };
    result.collections.push(c);
    section(c, 'dialogue', dialogue || lines || [], 'Dialogue', 0);
    section(c, 'vocabulary', words || [], 'Words', 1);
    section(c, 'examples', examples || [], 'Example sentences', 2);
    (data.screenshots || []).forEach(file => asset(file, 'image'));
    (data.sources || []).forEach(file => asset(file.path, 'document'));
  }
  for (const [key, data] of Object.entries(midterms)) {
    const { title, sections, ...metadata } = data;
    const c = { id: `seed-collection-${key}`, key, kind: 'midterm', title, metadata };
    result.collections.push(c); let questionOffset = 0;
    sections.forEach((s, i) => { section({ ...c, questionOffset }, 'questions', s.questions, s.title, i); questionOffset += s.questions.length; });
    if (data.source) asset(data.source, 'document');
  }
  readings.forEach((data, i) => {
    const { title, paragraphs, ...metadata } = data;
    const c = { id: `seed-reading-${i + 1}`, key: `reading-${i + 1}`, kind: 'reading', title, metadata };
    result.collections.push(c); section(c, 'reading', paragraphs.map(chinese => ({ chinese })), title, 0);
  });
  return model.validate(result);
}
module.exports = { loadLegacy, convertLegacy };
