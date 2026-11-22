// One idempotent path migration for databases created before materials/ consolidation.
function relocatePath(value) {
  return typeof value === 'string' ? value.replace(/^(\/?)(lesson\d+|midterm\d+|audio|reading)\//, '$1materials/$2/') : value;
}
function relocateReferences(value) {
  if (Array.isArray(value)) return value.map(relocateReferences);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,relocateReferences(entry)]));
  return relocatePath(value);
}
function migrateMaterialPaths(db) {
  if (db.prepare("SELECT value FROM app_meta WHERE key='material_asset_layout'").get()?.value === '2') return;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of db.prepare('SELECT id,path FROM assets').all()) {
      const next = relocatePath(row.path);
      if (next !== row.path) db.prepare('UPDATE assets SET path=? WHERE id=?').run(next,row.id);
    }
    for (const table of ['collections','items']) for (const row of db.prepare(`SELECT id,metadata FROM ${table}`).all()) {
      const next = JSON.stringify(relocateReferences(JSON.parse(row.metadata)));
      if (next !== row.metadata) db.prepare(`UPDATE ${table} SET metadata=? WHERE id=?`).run(next,row.id);
    }
    db.prepare("INSERT INTO app_meta(key,value) VALUES ('material_asset_layout','2') ON CONFLICT(key) DO UPDATE SET value='2'").run();
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
module.exports = { relocatePath, relocateReferences, migrateMaterialPaths };
