import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Shell values take priority, then .env.local, then .env.
for (const filename of ['.env.local', '.env']) {
  const localEnvironmentPath = path.join(repoRoot, filename);
  if (!fs.existsSync(localEnvironmentPath)) continue;
  for (const line of fs.readFileSync(localEnvironmentPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const argumentValue = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = argumentValue('voice-id') || process.env.ELEVENLABS_VOICE_ID;
const modelId = argumentValue('model') || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const scope = argumentValue('scope') || 'all';
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
const outputFormat = 'mp3_44100_128';
const scopes = scope === 'all' ? ['listening', 'vocabulary'] : [scope];

if (!['all', 'listening', 'vocabulary'].includes(scope)) {
  throw new Error('Use --scope=all, --scope=listening, or --scope=vocabulary.');
}
if (!dryRun && !apiKey) throw new Error('Missing ELEVENLABS_API_KEY. Add it to .env.local or your shell environment.');
if (!dryRun && !voiceId) throw new Error('Missing ELEVENLABS_VOICE_ID. Add it to .env.local or pass --voice-id=...');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function createSpeech(text) {
  const endpoint = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  endpoint.searchParams.set('output_format', outputFormat);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.72,
          similarity_boost: 0.82,
          style: 0.08,
          use_speaker_boost: true,
          speed: 0.9
        }
      })
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const details = (await response.text()).slice(0, 500);
    if (attempt === 4 || (response.status !== 429 && response.status < 500)) {
      throw new Error(`ElevenLabs returned ${response.status}: ${details}`);
    }
    await sleep(attempt * 1500);
  }
  throw new Error('ElevenLabs generation failed.');
}

function loadManifest(name) {
  const manifestPath = path.join(repoRoot, 'audio', name, 'manifest.json');
  return { manifestPath, data: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) };
}

function mp3Path(audioPath) {
  return audioPath.replace(/\.(?:m4a|mp3)$/i, '.mp3');
}

let generated = 0;
let skipped = 0;

for (const name of scopes) {
  const { manifestPath, data } = loadManifest(name);
  const items = data.items.map((item) => ({ ...item, audio: mp3Path(item.audio) }));
  for (const [index, item] of items.entries()) {
    const outputPath = path.join(repoRoot, item.audio);
    const complete = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000;
    process.stdout.write(`\r${name}: ${String(index + 1).padStart(3, ' ')}/${items.length} ${path.basename(outputPath)}`);
    if (complete && !force) {
      skipped += 1;
      continue;
    }
    if (dryRun) {
      generated += 1;
      continue;
    }
    const audio = await createSpeech(item.chinese);
    const temporaryPath = `${outputPath}.tmp`;
    fs.writeFileSync(temporaryPath, audio);
    fs.renameSync(temporaryPath, outputPath);
    generated += 1;
    await sleep(120);
  }
  process.stdout.write('\n');
  if (!dryRun) {
    fs.writeFileSync(manifestPath, `${JSON.stringify({
      provider: 'ElevenLabs',
      voiceId,
      modelId,
      outputFormat,
      items
    }, null, 2)}\n`);
  }
}

const allMp3FilesExist = ['listening', 'vocabulary'].every((name) => {
  const { data } = loadManifest(name);
  return data.items.every((item) => {
    const outputPath = path.join(repoRoot, mp3Path(item.audio));
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000;
  });
});

if (!dryRun && allMp3FilesExist) {
  fs.writeFileSync(path.join(repoRoot, 'audio', 'config.js'), "window.CHINESE_AUDIO_EXTENSION = 'mp3';\n");
}

console.log(`${dryRun ? 'Would generate' : 'Generated'} ${generated} files; skipped ${skipped}.`);
console.log(allMp3FilesExist ? 'High-quality MP3 audio is active.' : 'AAC audio remains active until both scopes are complete.');
