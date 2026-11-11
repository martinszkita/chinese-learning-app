(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).model = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const schemaVersion = 1;
  const sectionKinds = ['dialogue', 'vocabulary', 'examples', 'questions', 'reading'];
  function text(value, name, max = 20000, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new TypeError(`Invalid ${name}`);
  }
  function assetPath(value) {
    text(value, 'asset path', 4000, true);
    if (/["'<>\\\x00-\x1f]/.test(value) || /^(?!https?:)[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) throw new TypeError('Invalid asset path');
    return value;
  }
  function metadata(value) {
    if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new TypeError('Invalid metadata');
    return value || {};
  }
  function validate(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== schemaVersion) throw new TypeError('Unsupported material schema');
    const maps = {};
    for (const name of ['collections', 'sections', 'items', 'sectionItems', 'assets']) {
      if (!Array.isArray(snapshot[name])) throw new TypeError(`Missing ${name}`);
      maps[name] = new Map();
      for (const row of snapshot[name]) {
        if (!row || typeof row !== 'object') throw new TypeError(`Invalid ${name} row`);
        text(row.id, `${name} id`, 200, true);
        if (maps[name].has(row.id)) throw new TypeError(`Duplicate ${name} id`);
        maps[name].set(row.id, row);
      }
    }
    const keys = new Set();
    for (const row of snapshot.collections) {
      text(row.key, 'collection key', 200, true); text(row.title, 'collection title', 500);
      if (keys.has(row.key)) throw new TypeError('Duplicate collection key');
      keys.add(row.key);
      const meta = metadata(row.metadata);
      for (const key of ['subtitle','instructions','followUps','label','supplementLabel']) if (key in meta) text(meta[key], key);
      if (meta.source) assetPath(meta.source);
      if (meta.screenshots !== undefined) {
        if (!Array.isArray(meta.screenshots)) throw new TypeError('Invalid screenshots');
        meta.screenshots.forEach(assetPath);
      }
      if (meta.sources !== undefined) {
        if (!Array.isArray(meta.sources)) throw new TypeError('Invalid sources');
        meta.sources.forEach(source => { assetPath(source.path); text(source.label, 'source label', 500); });
      }
      if (!['dialogue', 'midterm', 'reading'].includes(row.kind)) throw new TypeError('Invalid collection kind');
      if (row.kind === 'dialogue' && (!Number.isInteger(row.lessonNumber) || row.lessonNumber < 1 || row.lessonNumber > 10000 || ![1, 2].includes(row.dialogNumber) || row.key !== `${row.lessonNumber}-dialog${row.dialogNumber}`)) throw new TypeError('Invalid lesson location');
    }
    for (const row of snapshot.sections) {
      if (!maps.collections.has(row.collectionId) || !sectionKinds.includes(row.kind) || !Number.isInteger(row.position) || row.position < 0) throw new TypeError('Invalid section');
      text(row.title, 'section title', 500);
    }
    for (const row of snapshot.items) {
      text(row.chineseTraditional, 'Chinese text', 20000, true); text(row.pinyin, 'Pinyin'); text(row.english, 'translation');
      text(row.partOfSpeech, 'part of speech', 100); metadata(row.metadata);
      if (row.chineseSimplified !== null && row.chineseSimplified !== undefined) text(row.chineseSimplified, 'Simplified Chinese');
      if (!Array.isArray(row.aliases)) throw new TypeError('Invalid aliases');
      for (const alias of row.aliases) { text(alias.chinese, 'alias', 500, true); text(alias.pinyin || '', 'alias Pinyin', 1000); }
    }
    for (const row of snapshot.assets) {
      if (!['audio', 'image', 'document'].includes(row.kind)) throw new TypeError('Invalid asset kind');
      assetPath(row.path);
    }
    const positions = new Set();
    for (const row of snapshot.sectionItems) {
      const key = `${row.sectionId}:${row.position}`;
      if (!maps.sections.has(row.sectionId) || !maps.items.has(row.itemId) || !Number.isInteger(row.position) || row.position < 0 || positions.has(key) || (row.audioAssetId && maps.assets.get(row.audioAssetId)?.kind !== 'audio')) throw new TypeError('Invalid material placement');
      text(row.speaker || '', 'speaker', 200); text(row.speakerPinyin || '', 'speaker Pinyin', 500); text(row.category || '', 'category', 200);
      positions.add(key);
    }
    return snapshot;
  }
  function createCatalog(input) {
    const snapshot = validate(input);
    const assets = new Map(snapshot.assets.map(row => [row.id, row]));
    const items = new Map(snapshot.items.map(row => [row.id, row]));
    const lessons = {}, midterms = {}, readings = [], audio = {}, byChinese = new Map(), legacyChinese = new Map(), byId = new Map();
    const placements = new Map();
    const sections = new Map();
    for (const row of snapshot.sectionItems) {
      if (!placements.has(row.sectionId)) placements.set(row.sectionId, []);
      placements.get(row.sectionId).push(row);
    }
    for (const row of snapshot.sections) {
      if (!sections.has(row.collectionId)) sections.set(row.collectionId, []);
      sections.get(row.collectionId).push(row);
    }
    const ordered = rows => (rows || []).slice().sort((a,b) => a.position - b.position);
    // Register vocabulary before sentences to keep one stable progress identity per displayed word.
    const register = [];
    for (const collection of snapshot.collections) {
      const data = { ...(collection.metadata || {}), id: collection.id, title: collection.title };
      for (const section of ordered(sections.get(collection.id))) {
        const rows = ordered(placements.get(section.id)).map(placement => {
          const item = items.get(placement.itemId);
          const asset = assets.get(placement.audioAssetId);
          const row = { ...(item.metadata || {}), id: item.id, occurrenceId: placement.id, chinese: item.chineseTraditional, simplified: item.chineseSimplified,
            pinyin: item.pinyin, english: item.english, partOfSpeech: item.partOfSpeech, aliases: item.aliases,
            speaker: placement.speaker || '', speakerPinyin: placement.speakerPinyin || '', category: placement.category || '',
            audio: asset?.path || '', voice: asset?.voice || '' };
          register.push({ row, priority: section.kind === 'vocabulary' ? 0 : 1 });
          return row;
        });
        if (collection.kind === 'midterm') (data.sections ||= []).push({ id: section.id, title: section.title, questions: rows });
        else if (section.kind === 'reading') data.paragraphs = rows.map(row => row.chinese);
        else data[section.kind === 'vocabulary' ? 'words' : section.kind] = rows;
      }
      if (collection.kind === 'dialogue') lessons[collection.key] = data;
      else if (collection.kind === 'midterm') midterms[collection.key] = { ...data, sections: data.sections || [] };
      else readings.push(data);
    }
    register.sort((a,b) => a.priority - b.priority).forEach(({row}) => {
      if (!byChinese.has(row.chinese)) byChinese.set(row.chinese, row.id);
      if (row.legacyChinese && !legacyChinese.has(row.legacyChinese)) legacyChinese.set(row.legacyChinese, row.id);
      if (!byId.has(row.id)) byId.set(row.id, row);
      if (row.audio && !audio[row.chinese]) audio[row.chinese] = row.audio;
    });
    return { snapshot, lessons, midterms, readings, audio,
      lessonCount: Math.max(1, ...snapshot.collections.map(row => row.lessonNumber || 0)),
      idForChinese: chinese => byChinese.get(chinese) || legacyChinese.get(chinese),
      idForLegacyChinese: chinese => legacyChinese.get(chinese) || byChinese.get(chinese), itemById: id => byId.get(id) };
  }
  return { schemaVersion, sectionKinds, validate, assetPath, createCatalog };
});
