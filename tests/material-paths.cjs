const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openStore } = require('../server/material-store.cjs');
const { relocatePath } = require('../server/material-paths.cjs');
process.chdir(path.join(__dirname,'..'));
assert.equal(relocatePath('lesson9/dialog1/screenshots/page.png'),'materials/lesson9/dialog1/screenshots/page.png');
assert.equal(relocatePath('/audio/test.mp3'),'/materials/audio/test.mp3');
assert.equal(relocatePath('materials/audio/test.mp3'),'materials/audio/test.mp3');
assert.equal(relocatePath('https://example.com/audio/test.mp3'),'https://example.com/audio/test.mp3');
for (const name of ['lesson1','lesson9','midterm1','midterm2','audio','reading']) {
  assert(fs.existsSync(path.join('materials',name)));
  assert(!fs.existsSync(name));
}
const folder = fs.mkdtempSync(path.join(os.tmpdir(),'material-layout-'));
const file = path.join(folder,'db.sqlite');
try {
  let store = openStore(file);
  const before = store.snapshot();
  store.close();
  // Simulate a database saved before the directory move.
  const old = new DatabaseSync(file);
  old.prepare("DELETE FROM app_meta WHERE key='material_asset_layout'").run();
  for (const asset of before.assets) old.prepare('UPDATE assets SET path=? WHERE id=?').run(asset.path.replace(/^materials\//,''),asset.id);
  const c = before.collections.find(c=>c.metadata.screenshots?.length);
  const metadata = {...c.metadata,screenshots:c.metadata.screenshots.map(file=>file.replace(/^materials\//,''))};
  old.prepare('UPDATE collections SET metadata=? WHERE id=?').run(JSON.stringify(metadata),c.id);
  old.close();
  store = openStore(file);
  const after = store.snapshot();
  assert.deepEqual(after.assets,before.assets);
  assert.deepEqual(after.collections,before.collections);
  assert.deepEqual(after.items,before.items,'Moving assets must not change content or stable IDs');
  store.close();
  store = openStore(file);
  assert.deepEqual(store.snapshot(),after,'Path migration is idempotent');
  store.close();
  console.log('PASS: material directories consolidated, existing DB paths/metadata migrated, content IDs preserved, and reopening does not duplicate prefixes');
} finally { fs.rmSync(folder,{recursive:true,force:true}); }
