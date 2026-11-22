(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).storage = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function readRecord(storage, key, defaults = {}) {
    try {
      const value = JSON.parse(storage.getItem(key) || '{}');
      return { ...defaults, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}) };
    } catch { return { ...defaults }; }
  }
  function loadPersonalLists(storage, key, resolveItem = item => item) {
    const cleanItems = (items) => Array.isArray(items) ? items.filter((item) => item && typeof item.chinese === 'string' && typeof item.pinyin === 'string' && typeof item.english === 'string') : [];
    try {
      const saved = JSON.parse(storage.getItem(key) || 'null');
      if (Array.isArray(saved?.lists)) {
        const ids = new Set();
        const lists = saved.lists.filter((list) => list && typeof list.id === 'string' && !ids.has(list.id) && ids.add(list.id) && typeof list.name === 'string').map((list) => ({ ...list, name: list.name.trim() || 'My list', items: cleanItems(list.items).map(resolveItem) }));
        if (lists.length) return lists;
      }
      const legacy = JSON.parse(storage.getItem('chinese-exam-personal-list-v1') || 'null');
      if (legacy && typeof legacy.name === 'string') return [{ id: 'legacy', name: legacy.name.trim() || 'My list', items: cleanItems(legacy.items).map(resolveItem) }];
    } catch {}
    return [{ id: 'default', name: 'My list', items: [] }];
  }
  return { readRecord, loadPersonalLists };

});
