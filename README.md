# Chinese Exam Prep — Lessons 1–8

Open `index.html` in a browser. No installation or internet access needed.

## Files and folders

```text
chinese-exam-site/
  index.html
  style.css
  app.js
  lesson1/
    dialog1/
      data.js
      screenshots/01.png
    dialog2/screenshots/
    example-sentences/screenshots/
  lesson2/ ... lesson7/ (same folder structure)
```

Each lesson includes two dialogue folders and an optional example-sentences folder. Original screenshots go into the corresponding `screenshots/` folder; filenames `01.png`, `02.png`, and so forth. The transcribed text is stored separately in `data.js`.

## Adding new study material

1. Save the screenshot in the relevant `lessonN/dialogM/screenshots/` folder.
2. Create a `data.js` in that section, with this format:

```js
window.CHINESE_LESSONS = window.CHINESE_LESSONS || {};
window.CHINESE_LESSONS['2-dialog1'] = {
  title: 'Optional dialogue title',
  lines: [
    { speaker: '王', speakerPinyin: 'Wáng', chinese: '你好。', pinyin: 'Nǐ hǎo.', english: 'Hello.' }
  ],
  screenshots: ['lesson2/dialog1/screenshots/01.png']
};
```

3. Add `<script src="lesson2/dialog1/data.js"></script>` **before** `<script src="app.js"></script>` in `index.html`.
4. For example sentences, use the key `N-example-sentences` and set `speaker` to `例句` or omit it.

Each section has independent Pinyin and English toggles. Chinese is the only text displayed by default. Missing sections display a placeholder until filled.

## Study workspace

Study modes are in the top navigation. The left sidebar contains lessons and midterm materials; the center previews the selected section and the right panel contains its controls.

In Listening, choose a source pool and use **Shuffle · Random sentence** to draw another sentence from that pool without immediately repeating the current one. **Show Chinese by default** is saved in browser settings. Each entry in the complete vocabulary list has a pronunciation button; flashcards also include audio.

## Listening recordings

The Listening view includes every item from each lesson's `examples` array and every question from both mid-terms. Generated AAC files and their manifest are stored in `audio/listening/`.

On macOS, regenerate missing recordings with the Taiwanese Mandarin `Meijia` voice:

```sh
node scripts/generate-listening-audio.mjs
```

Pass `--force` to replace every existing recording. The script requires the built-in `say` and `afconvert` commands.

The flashcard quiz also includes pronunciation audio for every vocabulary item. Generated files and their manifest are stored in `audio/vocabulary/`.

```sh
node scripts/generate-vocabulary-audio.mjs
```

Pass `--force` to replace every vocabulary recording.

### Higher-quality ElevenLabs recordings

The optional ElevenLabs generator creates 44.1 kHz, 128 kbps MP3 files with the `eleven_multilingual_v2` model. Existing AAC recordings remain active until all listening and vocabulary files have been generated successfully.

Copy `.env.example` to `.env.local`, then provide your ElevenLabs API key and the ID of a Mandarin-capable voice:

```sh
cp .env.example .env.local
node scripts/generate-elevenlabs-audio.mjs --dry-run
node scripts/generate-elevenlabs-audio.mjs
```

Use `--scope=listening` or `--scope=vocabulary` to generate one group at a time. Re-running the command resumes missing files; add `--force` only when every existing MP3 should be replaced. The generator reads shell variables first, then `.env.local`, then `.env`; both environment files are ignored by Git. George uses voice ID `JBFqnCBsd6RMkjVDRZzb`.

Lesson 8 · Dialog 1 includes the scanned dialogue, vocabulary and textbook examples. Its 41 word/example recordings use ElevenLabs George (`eleven_multilingual_v2`) and are stored as MP3 in `audio/lesson8/`. Regenerate missing clips with `node scripts/generate-elevenlabs-audio.mjs --scope=lesson8`. Screenshot OCR takes priority over photographed pages; the raw OCR and reviewed differences are stored in `lesson8/dialog1/sources/ocr/`. Listening grades advance immediately; saved progress stores the latest status and cumulative learned/not-learned counts, while buttons stay neutral on revisits.

Lesson 8 · Dialog 2 contains the screenshot dialogue (10 turns) and all 14 vocabulary entries, including the short forms 故宮 and 公車. George recordings are in `audio/materials/` and `audio/lesson8/dialog2-word-*.mp3`; `audio/materials/manifest.json` supports resumable generation with `node scripts/generate-elevenlabs-audio.mjs --scope=materials`. The lesson/material views resolve available recordings through `audio/materials.js` and play them only at 1×. Older dialogue turns without existing recordings do not display an audio button.

Lesson 8 · Dialog 2 also includes all 14 numbered textbook examples (18 spoken turns, with A/B exchanges kept separate), transcribed from the two-page scan. Each has Pinyin, an English translation and a George MP3 recording. They are available in the lesson's Example sentences section and in Listening under Lesson 8 · Dialog 2.
