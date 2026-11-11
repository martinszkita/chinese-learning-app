const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const model = require('../js/data/model.js');
const { migrateMaterialPaths } = require('./material-paths.cjs');
const { convertLegacy, loadLegacy } = require('./legacy-import.cjs');
class StoreError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function openStore(filename, { seed = true, root } = {}) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(fs.readFileSync(path.join(__dirname, 'migrations/001-materials.sql'), 'utf8'));
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const value = work(); db.exec('COMMIT'); return value; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function insertItem(row) {
    run('INSERT INTO items(id,chinese_traditional,chinese_simplified,pinyin,english,part_of_speech,aliases,metadata) VALUES (?,?,?,?,?,?,?,?)',
      row.id, row.chineseTraditional, row.chineseSimplified ?? null, row.pinyin || '', row.english || '', row.partOfSpeech || '', JSON.stringify(row.aliases || []), JSON.stringify(row.metadata || {}));
  }
  function insertAsset(row) {
    model.assetPath(row.path);
    run('INSERT INTO assets(id,kind,path,provider,voice) VALUES (?,?,?,?,?)', row.id, row.kind, row.path, row.provider || '', row.voice || '');
  }
  function insertCollection(row) {
    run('INSERT INTO collections(id,key,kind,title,lesson_number,dialog_number,metadata) VALUES (?,?,?,?,?,?,?)', row.id, row.key, row.kind, row.title, row.lessonNumber ?? null, row.dialogNumber ?? null, JSON.stringify(row.metadata || {}));
  }
  function insertSection(row) {
    run('INSERT INTO sections(id,collection_id,kind,title,position) VALUES (?,?,?,?,?)', row.id, row.collectionId, row.kind, row.title, row.position);
  }
  function insertPlacement(row) {
    run('INSERT INTO section_items(id,section_id,item_id,position,speaker,speaker_pinyin,category,audio_asset_id) VALUES (?,?,?,?,?,?,?,?)', row.id, row.sectionId, row.itemId, row.position, row.speaker || '', row.speakerPinyin || '', row.category || '', row.audioAssetId || null);
  }
  function importSnapshot(snapshot) {
    model.validate(snapshot);
    return transaction(() => {
      snapshot.collections.forEach(insertCollection); snapshot.sections.forEach(insertSection);
      snapshot.items.forEach(insertItem); snapshot.assets.forEach(insertAsset); snapshot.sectionItems.forEach(insertPlacement);
      run("INSERT INTO app_meta(key,value) VALUES ('legacy_imported','1') ON CONFLICT(key) DO UPDATE SET value='1'");
    });
  }
  function snapshot() {
    const parse = row => {
      const result = { ...row };
      if ('metadata' in result) result.metadata = JSON.parse(result.metadata);
      if ('aliases' in result) result.aliases = JSON.parse(result.aliases);
      return result;
    };
    return { schemaVersion: 1,
      collections: db.prepare('SELECT id,key,kind,title,lesson_number AS lessonNumber,dialog_number AS dialogNumber,metadata FROM collections ORDER BY rowid').all().map(parse),
      sections: db.prepare('SELECT id,collection_id AS collectionId,kind,title,position FROM sections ORDER BY rowid').all(),
      items: db.prepare('SELECT id,chinese_traditional AS chineseTraditional,chinese_simplified AS chineseSimplified,pinyin,english,part_of_speech AS partOfSpeech,aliases,metadata,revision FROM items ORDER BY rowid').all().map(parse),
      sectionItems: db.prepare('SELECT id,section_id AS sectionId,item_id AS itemId,position,speaker,speaker_pinyin AS speakerPinyin,category,audio_asset_id AS audioAssetId FROM section_items ORDER BY rowid').all(),
      assets: db.prepare('SELECT id,kind,path,provider,voice FROM assets ORDER BY rowid').all()
    };
  }
  function validateWith(changes) { model.validate({ ...snapshot(), ...changes }); }
  function createCollection(input) {
    const row = { id: randomUUID(), key: `${input.lessonNumber}-dialog${input.dialogNumber}`, kind: 'dialogue', title: input.title, lessonNumber: input.lessonNumber, dialogNumber: input.dialogNumber, metadata: {} };
    const existing = snapshot();
    if (existing.collections.some(c => c.key === row.key)) throw new StoreError('This dialogue already exists', 409);
    validateWith({ collections: [...existing.collections, row] });
    const sections = ['dialogue','vocabulary','examples'].map((kind, position) => ({ id: randomUUID(), collectionId: row.id, kind, title: kind === 'vocabulary' ? 'Words' : kind === 'examples' ? 'Example sentences' : 'Dialogue', position }));
    return transaction(() => { insertCollection(row); sections.forEach(insertSection); return { collection: row, sections }; });
  }
  function addItem(sectionId, input) {
    const existing = snapshot();
    if (!existing.sections.some(s => s.id === sectionId)) throw new StoreError('Section not found', 404);
    const item = input.itemId ? existing.items.find(row => row.id === input.itemId) : {
      id: randomUUID(), chineseTraditional: input.chineseTraditional, chineseSimplified: input.chineseSimplified ?? null,
      pinyin: input.pinyin || '', english: input.english || '', partOfSpeech: input.partOfSpeech || '', aliases: input.aliases || [], metadata: {}, revision: 1
    };
    if (!item) throw new StoreError('Item not found', 404);
    const position = Math.max(-1, ...existing.sectionItems.filter(row => row.sectionId === sectionId).map(row => row.position)) + 1;
    const placement = { id: randomUUID(), sectionId, itemId: item.id, position, speaker: input.speaker || '', speakerPinyin: input.speakerPinyin || '', category: input.category || '', audioAssetId: input.audioAssetId || null };
    validateWith({ items: input.itemId ? existing.items : [...existing.items, item], sectionItems: [...existing.sectionItems, placement] });
    return transaction(() => { if (!input.itemId) insertItem(item); insertPlacement(placement); return { item, placement }; });
  }
  function updateItem(id, input) {
    const existing = snapshot(); const row = existing.items.find(row => row.id === id);
    if (!row) throw new StoreError('Item not found', 404);
    if (input.expectedRevision !== row.revision) throw new StoreError('Material changed; reload it before saving', 409);
    const next = { ...row };
    for (const key of ['chineseTraditional','chineseSimplified','pinyin','english','partOfSpeech','aliases']) if (key in input) next[key] = input[key];
    next.revision++;
    validateWith({ items: existing.items.map(row => row.id === id ? next : row) });
    const result = run('UPDATE items SET chinese_traditional=?,chinese_simplified=?,pinyin=?,english=?,part_of_speech=?,aliases=?,revision=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?', next.chineseTraditional, next.chineseSimplified, next.pinyin, next.english, next.partOfSpeech, JSON.stringify(next.aliases), next.revision, id, input.expectedRevision);
    if (!result.changes) throw new StoreError('Material changed; reload before saving', 409);
    return next;
  }
  function attachAudio(placementId, input) {
    const existing = snapshot(); const placement = existing.sectionItems.find(row => row.id === placementId);
    if (!placement) throw new StoreError('Material placement not found', 404);
    for (const key of ['voice','provider']) if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 200)) throw new StoreError(`Invalid ${key}`);
    const current = existing.assets.find(asset => asset.id === placement.audioAssetId);
    if (current && current.path === input.path && current.voice === (input.voice || '') && current.provider === (input.provider || 'upload')) return current;
    const asset = { id: randomUUID(), kind: 'audio', path: input.path, voice: input.voice || '', provider: input.provider || 'upload' };
    model.assetPath(asset.path);
    return transaction(() => { insertAsset(asset); run('UPDATE section_items SET audio_asset_id=? WHERE id=?', asset.id, placementId); return asset; });
  }
  if (seed && !db.prepare("SELECT value FROM app_meta WHERE key='legacy_imported'").get()) {
    if (db.prepare('SELECT count(*) AS n FROM collections').get().n) throw new StoreError('Refusing to seed a non-empty database');
    importSnapshot(convertLegacy(loadLegacy(root)));
  }
  migrateMaterialPaths(db);
  return { snapshot, importSnapshot, createCollection, addItem, updateItem, attachAudio, close: () => db.close() };
}
module.exports = { openStore, StoreError };
