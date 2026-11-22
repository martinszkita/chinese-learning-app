const { randomUUID } = require('node:crypto');
const matching = require('../js/services/material-matching.js');
const OpenCC = require('../vendor/pinyin/opencc.js');
const traditional = OpenCC.Converter({from:'cn',to:'tw'});
const simplified = OpenCC.Converter({from:'tw',to:'cn'});
module.exports = function customMaterials({db, snapshot, transaction, updateItem, StoreError}) {
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const fail = (message, status=400) => { throw new StoreError(message,status); };
  function save(input, id) {
    if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 100) fail('Give the collection a title (up to 100 characters).');
    if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 500 || input.reviewed !== true) fail('Review between 1 and 500 entries before saving.');
    if (!id && (typeof input.requestId !== 'string' || !/^[\w-]{1,100}$/.test(input.requestId))) fail('Invalid import request ID');
    if (!['word','sentence'].includes(input.mode)) fail('Invalid split mode');
    if (input.rawText !== undefined && (typeof input.rawText !== 'string' || input.rawText.length > 20000)) fail('Use at most 20,000 characters.');
    return transaction(() => {
      if (!id) {
        const retry = db.prepare('SELECT collection_id FROM import_requests WHERE request_id=?').get(input.requestId);
        if (retry) return {collectionId: retry.collection_id};
      }
      const before = snapshot();
      const collection = id && before.collections.find(c=>c.id===id && c.kind==='custom');
      if (id && !collection) fail('Collection not found',404);
      if (collection && input.expectedRevision !== collection.revision) fail('Collection changed; refresh the draft before saving.',409);
      const collectionId = id || randomUUID();
      const metadata = JSON.stringify({sourceType:'text', mode:input.mode, rawText:input.rawText || '', importedAt:collection?.metadata.importedAt || new Date().toISOString()});
      if (!id) run("INSERT INTO collections(id,key,kind,title,metadata) VALUES (?,?,'custom',?,?)",collectionId,`custom:${collectionId}`,input.title.trim(),metadata);
      const section = before.sections.find(s=>s.collectionId===collectionId);
      const sectionId = section?.id || randomUUID();
      if (!section) run("INSERT INTO sections(id,collection_id,kind,title,position) VALUES (?,?,'vocabulary','Entries',0)",sectionId,collectionId);
      const oldPlacements = before.sectionItems.filter(p=>p.sectionId===sectionId);
      const seenPlacements = new Set();
      const updatedItems = new Map();
      const initialItems = before.items;
      const workingItems = before.items.slice();
      run('DELETE FROM section_items WHERE section_id=?',sectionId);
      input.rows.forEach((row,position) => {
        for (const key of ['chineseTraditional','chineseSimplified','pinyin','english']) if (typeof row[key] !== 'string' || row[key].length > (key==='chineseTraditional'||key==='chineseSimplified'?2000:4000)) fail(`Invalid ${key}`);
        if (!row.chineseTraditional.trim()) fail('Each entry needs Chinese text.');
        const normalized = {...row,chineseTraditional:traditional(row.chineseTraditional.trim()),chineseSimplified:row.chineseSimplified.trim() || simplified(row.chineseTraditional.trim())};
        let item = row.itemId && workingItems.find(i=>i.id===row.itemId);
        if (row.itemId && !item) fail('Item not found',404);
        const candidates = matching.matches(normalized,workingItems);
        if (!item && !row.forceNew) {
          if (candidates.length > 1) fail('Several entries match. Choose an existing entry or create a separate one.',409);
          item = candidates[0];
        }
        const wasNew = matching.matches(normalized,initialItems).length === 0;
        if (item && row.itemId) {
          const changed = ['chineseTraditional','chineseSimplified','pinyin','english'].some(k => (k==='chineseSimplified'?(item[k] || simplified(item.chineseTraditional)):(item[k] || '')) !== normalized[k]);
          if (updatedItems.has(item.id)) {
            if (['chineseTraditional','chineseSimplified','pinyin','english'].some(k=>updatedItems.get(item.id)[k]!==normalized[k])) fail('Repeated entries must have the same text and translation.');
          } else {
            if (row.expectedRevision !== item.revision) fail('Entry changed; refresh the draft before saving.',409);
            if (changed) {
              const impact = new Set(before.sectionItems.filter(p=>p.itemId===item.id).map(p=>before.sections.find(s=>s.id===p.sectionId)?.collectionId)).size;
              if (row.confirmedImpact !== impact) fail('Confirm how many collections this edit affects.',409);
              item = updateItem(item.id,{...normalized,expectedRevision:row.expectedRevision});
              workingItems[workingItems.findIndex(i=>i.id===item.id)] = item;
            }
            updatedItems.set(item.id,normalized);
          }
        }
        if (!item) {
          // Repeated new words share identity within this import, including explicitly separate entries.
          item = workingItems.find(i=>!initialItems.some(old=>old.id===i.id) && matching.normalize(i.chineseTraditional)===matching.normalize(normalized.chineseTraditional) && i.pinyin===normalized.pinyin);
          if (!item) {
            item = {id:randomUUID(),...normalized};
            run('INSERT INTO items(id,chinese_traditional,chinese_simplified,pinyin,english,metadata) VALUES (?,?,?,?,?,?)',item.id,normalized.chineseTraditional,normalized.chineseSimplified,normalized.pinyin,normalized.english,JSON.stringify({materialType:input.mode==='word'?'word':'expression'}));
            workingItems.push({...item,revision:1});
          }
        }
        const old = row.placementId && oldPlacements.find(p=>p.id===row.placementId);
        if (row.placementId && (!old || seenPlacements.has(row.placementId))) fail('Invalid collection position');
        if (old) seenPlacements.add(old.id);
        run('INSERT INTO section_items(id,section_id,item_id,position,was_new,audio_asset_id) VALUES (?,?,?,?,?,?)',old?.id || randomUUID(),sectionId,item.id,position,old && old.itemId===item.id ? Number(old.wasNew) : Number(wasNew),old && old.itemId===item.id ? old.audioAssetId : null);
      });
      if (id) run('UPDATE collections SET title=?,metadata=?,revision=revision+1 WHERE id=?',input.title.trim(),metadata,id);
      else run('INSERT INTO import_requests(request_id,collection_id) VALUES (?,?)',input.requestId,collectionId);
      return {collectionId};
    });
  }
  return {saveCustomCollection:save};
};
