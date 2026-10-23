import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repoRoot, 'audio', 'listening');
const voice = 'Meijia';
const wordsPerMinute = '155';
const force = process.argv.includes('--force');
const lessonFiles = Array.from({ length: 7 }, (_, lessonIndex) => lessonIndex + 1)
  .flatMap((lesson) => [1, 2].map((dialog) => `lesson${lesson}/dialog${dialog}/data.js`));
const dataFiles = [...lessonFiles, 'midterm1/data.js', 'midterm2/data.js'];
const context = vm.createContext({ window: {} });

for (const relativePath of dataFiles) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

const items = [];
for (const [sourceKey, data] of Object.entries(context.window.CHINESE_LESSONS || {})) {
  (data.examples || []).forEach((item, index) => {
    items.push({
      ...item,
      sourceKey,
      sourceLabel: `Lesson ${sourceKey.replace('-', ' · ').replace('dialog', 'Dialog ')}`,
      filename: `${sourceKey}-example-${String(index + 1).padStart(2, '0')}.m4a`
    });
  });
}

for (const [sourceKey, data] of Object.entries(context.window.CHINESE_MIDTERMS || {})) {
  let questionIndex = 0;
  for (const section of data.sections || []) {
    for (const item of section.questions || []) {
      questionIndex += 1;
      items.push({
        ...item,
        sourceKey,
        sourceLabel: data.title,
        filename: `${sourceKey}-question-${String(questionIndex).padStart(2, '0')}.m4a`
      });
    }
  }
}

fs.mkdirSync(outputDirectory, { recursive: true });
const manifest = [];

for (const [index, item] of items.entries()) {
  const outputPath = path.join(outputDirectory, item.filename);
  if (force || !fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
    const temporaryPath = path.join(os.tmpdir(), `chinese-listening-${process.pid}-${index}.aiff`);
    try {
      execFileSync('say', ['-v', voice, '-r', wordsPerMinute, '-o', temporaryPath, item.chinese]);
      execFileSync('afconvert', [temporaryPath, '-o', outputPath, '-f', 'm4af', '-d', 'aac ', '-b', '64000']);
    } finally {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
  manifest.push({
    sourceKey: item.sourceKey,
    sourceLabel: item.sourceLabel,
    chinese: item.chinese,
    pinyin: item.pinyin,
    english: item.english,
    audio: `audio/listening/${item.filename}`
  });
  process.stdout.write(`\r${String(index + 1).padStart(3, ' ')}/${items.length} ${item.filename}`);
}

fs.writeFileSync(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ voice, wordsPerMinute: Number(wordsPerMinute), items: manifest }, null, 2)}\n`
);
process.stdout.write(`\nGenerated ${items.length} listening recordings with ${voice} (${wordsPerMinute} wpm).\n`);
