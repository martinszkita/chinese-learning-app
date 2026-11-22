(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).materialMatching = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const normalize = value => String(value || '').normalize('NFKC').replace(/\s+/gu, '').trim();
  function matches(row, items) {
    const keys = new Set([row.chineseTraditional, row.chineseSimplified].filter(Boolean).map(normalize));
    return items.filter(item => [item.chineseTraditional, item.chineseSimplified, ...(item.aliases || []).map(a => a.chinese)].some(value => value && keys.has(normalize(value))));
  }
  function segment(text, mode) {
    if (typeof text !== 'string' || text.length > 20000) throw new Error('Use at most 20,000 characters.');
    if (!['word','sentence'].includes(mode)) throw new Error('Choose words or sentences.');
    const splitter = new Intl.Segmenter('zh', { granularity: mode });
    const rows = text.split(/\r?\n/).flatMap(line => [...splitter.segment(line)].filter(part => mode !== 'word' || part.isWordLike).map(part => part.segment.trim())).filter(value => /\p{Script=Han}/u.test(value));
    if (rows.length > 500) throw new Error('Use at most 500 entries. Split this text into smaller collections.');
    return rows;
  }
  return { normalize, matches, segment };
});
