import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { openAudioDatabase, audioItems } = require('../server/audio-materials.cjs');
export function generateLocalAudio(scope) {
  const root = path.resolve(import.meta.dirname, '..');
  const store = openAudioDatabase();
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const items = audioItems(store.snapshot(), scope);
  try {
    for (const [index,item] of items.entries()) {
      const relative = `materials/audio/generated/meijia-${item.id}.m4a`;
      const output = path.join(root,relative);
      if (!dryRun && (force || !fs.existsSync(output) || fs.statSync(output).size < 1000)) {
        fs.mkdirSync(path.dirname(output),{recursive:true});
        const temporary = path.join(os.tmpdir(),`chinese-audio-${process.pid}-${index}.aiff`);
        try {
          execFileSync('say',['-v','Meijia','-r','155','-o',temporary,item.chinese]);
          execFileSync('afconvert',[temporary,'-o',output,'-f','m4af','-d','aac ','-b','64000']);
        } finally { fs.rmSync(temporary,{force:true}); }
      }
      if (!dryRun) store.attachAudio(item.occurrenceId,{path:relative,voice:'Meijia',provider:'macOS'});
    }
    console.log(`${dryRun ? 'Would process' : 'Processed'} ${items.length} ${scope} recordings from the material database.`);
  } finally { store.close(); }
}
