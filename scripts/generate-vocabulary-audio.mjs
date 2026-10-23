import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repoRoot, 'audio', 'vocabulary');
const voice = 'Meijia';
const wordsPerMinute = '145';
const force = process.argv.includes('--force');
const lessonFiles = Array.from({ length: 7 }, (_, lessonIndex) => lessonIndex + 1)
  .flatMap((lesson) => [1, 2].map((dialog) => `lesson${lesson}/dialog${dialog}/data.js`));
const dataFiles = [...lessonFiles, 'midterm1/data.js', 'midterm2/data.js'];
const context = vm.createContext({ window: {} });

for (const relativePath of dataFiles) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

const seen = new Set();
const items = [];
for (let lesson = 1; lesson <= 7; lesson++) {
  for (let dialog = 1; dialog <= 2; dialog++) {
    for (const item of context.window.CHINESE_LESSONS?.[`${lesson}-dialog${dialog}`]?.words || []) {
      if (seen.has(item.chinese)) continue;
      seen.add(item.chinese);
      items.push(item);
    }
  }
}

for (const midtermKey of Object.keys(context.window.CHINESE_MIDTERMS || {}).sort()) {
  for (const section of context.window.CHINESE_MIDTERMS[midtermKey].sections || []) {
    for (const item of section.questions || []) {
      if (seen.has(item.chinese)) continue;
      seen.add(item.chinese);
      items.push(item);
    }
  }
}

fs.mkdirSync(outputDirectory, { recursive: true });
const manifest = [];

for (const [index, item] of items.entries()) {
  const filename = `word-${String(index + 1).padStart(3, '0')}.m4a`;
  const outputPath = path.join(outputDirectory, filename);
  if (force || !fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
    const temporaryPath = path.join(os.tmpdir(), `chinese-vocabulary-${process.pid}-${index}.aiff`);
    try {
      execFileSync('say', ['-v', voice, '-r', wordsPerMinute, '-o', temporaryPath, item.chinese]);
      execFileSync('afconvert', [temporaryPath, '-o', outputPath, '-f', 'm4af', '-d', 'aac ', '-b', '64000']);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
  manifest.push({
    chinese: item.chinese,
    pinyin: item.pinyin,
    english: item.english,
    audio: `audio/vocabulary/${filename}`
  });
  process.stdout.write(`\r${String(index + 1).padStart(3, ' ')}/${items.length} ${filename}`);
}

fs.writeFileSync(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ voice, wordsPerMinute: Number(wordsPerMinute), items: manifest }, null, 2)}\n`
);
process.stdout.write(`\nGenerated ${items.length} vocabulary recordings with ${voice} (${wordsPerMinute} wpm).\n`);
