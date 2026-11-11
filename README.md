# Chinese Exam Prep — Lessons 1–9

## Run locally

Requires Node.js 22.13 or newer (tested with Node 26). No npm dependencies or Python are required.

```sh
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The Node server serves the app and its API. Opening `index.html` directly now displays startup instructions instead of a partial/static dataset.

On the first run, the server creates `data/materials.sqlite`, applies `server/migrations/001-materials.sql` and imports all existing lessons, midterms, reading texts, sources and audio references. Subsequent runs use this database; changing old lesson files does not overwrite database edits. Back up the SQLite file before replacing or migrating it. `MATERIAL_DB` selects another database file; `PORT` selects another local port. Runtime databases are ignored by Git.

## Application modules

- `app.js`: view coordination, navigation and event binding.
- `js/data/model.js`: material schema validation and view projection from normalized records.
- `js/data/repository.js`: HTTP repository with load/create/update/audio methods.
- `js/services/study-materials.js`: vocabulary and Listening queries.
- `js/services/text.js`: escaping, Pinyin alignment and search normalization.
- `js/services/storage.js`: browser settings, personal-list migration and stored records.
- `js/services/dialogue-player.js`: sequential audio playback and highlighting.
- `bootstrap.js`: asynchronous database loading and startup/error state.
- `server/material-store.cjs`: SQLite repository, transactions, permanent IDs and edit revisions.
- `server/legacy-import.cjs` and `data/legacy-manifest.json`: one-time migration of archived lesson files.

See [architecture.md](architecture.md) for the data model, API and migration boundaries.

## Add or edit study material

Material changes now go through the repository/API. Adding another script tag to `index.html` is no longer necessary. An editing/upload screen is a separate next step; the underlying API is ready:

```js
const repo = window.ChineseApp.materialRepository;
const { sections } = await repo.createCollection({
  lessonNumber: 10, dialogNumber: 1, title: 'My next lesson'
});
const { item, placement } = await repo.addItem(
  sections.find(section => section.kind === 'vocabulary').id,
  { chineseTraditional: '你好', pinyin: 'nǐ hǎo', english: 'hello' }
);
await repo.updateItem(item.id, { expectedRevision: 1, english: 'hello; hi' });
// Attach an existing uploaded or generated recording:
await repo.attachAudio(placement.id, { path: 'materials/audio/my-recording.mp3', provider: 'upload' });
// Reload to refresh the current view from the database.
```

No audio filename is guessed for a new entry. It appears in Listening once a recording has been attached. Existing progress and personal lists remain in browser storage and are migrated to stable item IDs when loaded.

## Checks

```sh
npm test
```

The suite covers existing study views, script switching, zoom/search/playback, complete seed import, persistent CRUD, optimistic concurrency, stable progress after text edits, database-only UI startup, API validation and HTTP audio ranges. Database tests open a temporary loopback server.

## Study workspace

Study modes are in the top navigation. The left sidebar contains lessons and midterm materials; the center previews the selected section and the right panel contains its controls.

In Listening, choose a source pool and use **Shuffle · Random sentence** to draw another sentence from that pool without immediately repeating the current one. **Show Chinese by default** is saved in browser settings. Entries with recordings in the complete vocabulary list have a pronunciation button; flashcards also include audio.

## Listening recordings

Listening includes recorded example sentences and midterm questions from the database. Generated AAC files and their manifest are stored in `materials/audio/listening/`.

On macOS, regenerate missing recordings with the Taiwanese Mandarin `Meijia` voice:

```sh
node scripts/generate-listening-audio.mjs
```

Pass `--force` to replace every existing recording. The script requires the built-in `say` and `afconvert` commands. Both local audio scripts read the database, save files under `materials/audio/generated/` and attach completed recordings to their material records. Add `--dry-run` to preview without generating or attaching audio.

The flashcard quiz also includes pronunciation audio for every vocabulary item. Generated files and their manifest are stored in `materials/audio/vocabulary/`.

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

Lesson 8 · Dialog 1 includes the scanned dialogue, vocabulary and textbook examples. Its 41 word/example recordings use ElevenLabs George (`eleven_multilingual_v2`) and are stored as MP3 in `materials/audio/lesson8/`. Regenerate missing clips with `node scripts/generate-elevenlabs-audio.mjs --scope=lesson8`. Screenshot OCR takes priority over photographed pages; the raw OCR and reviewed differences are stored in `materials/lesson8/dialog1/sources/ocr/`. Listening grades advance immediately; saved progress stores the latest status and cumulative learned/not-learned counts, while buttons stay neutral on revisits.

Lesson 8 · Dialog 2 contains the screenshot dialogue (10 turns) and all 14 vocabulary entries, including the short forms 故宮 and 公車. George recordings are in `materials/audio/materials/` and `materials/audio/lesson8/dialog2-word-*.mp3`; `materials/audio/materials/manifest.json` supports resumable generation with `node scripts/generate-elevenlabs-audio.mjs --scope=materials`. The lesson/material views resolve available recordings through database asset references and play them only at 1×. Older dialogue turns without existing recordings do not display an audio button.

Lesson 8 · Dialog 2 also includes all 14 numbered textbook examples (18 spoken turns, with A/B exchanges kept separate), transcribed from the two-page scan. Each has Pinyin, an English translation and a George MP3 recording. They are available in the lesson's Example sentences section and in Listening under Lesson 8 · Dialog 2.

Personal vocabulary supports multiple named lists. Create or rename them in All words & expressions, and choose a destination beside Save in quizzes/Listening. Opening a quiz selects the newest list as the save destination; changing that destination does not change the quiz's source material. The old single-list storage is migrated without discarding its entries. Click the Lesson, Shown, Answers, Correct or Accuracy column header to toggle ascending/descending sorting. Answers tracks both new correct and incorrect grades; older sessions can contribute only their saved correct counts. Run `node tests/personal-lists-and-sorting.cjs` for list migration, membership, quiz selection and sorting checks.

The global **馬 / 马** toggle switches lessons, dialogues, example sentences, midterms, flashcards, Listening and Reading between Traditional and Simplified Chinese. The choice is saved in this browser and works offline. All words & expressions always shows separate Traditional and Simplified columns, including sentence entries. Progress, personal lists and audio keep the original material identity across script changes.

In All words & expressions, click any Chinese character in either script column to open a large writing reference with a guide grid. Click outside the popup, press Escape or use its close button to dismiss it.

Each lesson dialogue has a compact **Full dialogue** player. Play reads all turns in order at 1× and highlights the current turn. Stop pauses at the current position; Play resumes. Reset stops playback and returns to the first turn. Changing lessons or study modes stops the dialogue; pronunciation buttons play a single line independently.

Run `node tests/dialogue-playback.cjs` to check sequential playback, highlighting, Stop/Reset, navigation, pronunciation interruption and recording errors.

Lesson 9 · Dialog 1 contains all 11 turns from the supplied screenshot, with speaker names, Pinyin and English translations. The source image is stored in `materials/lesson9/dialog1/screenshots/`. Its supplement includes all 14 vocabulary entries (9 words, 4 phrases and the place name 臺東) from the screenshot and all 14 numbered example sentences from the two-page PDF. Both sources are retained in the lesson folder. Examples are available in Listening, and vocabulary is available in the master list and quizzes. Regenerate supplement recordings with `node scripts/generate-elevenlabs-audio.mjs --scope=lesson9`. Dialogue MP3 files use George and support the individual and full-dialogue players. The navigation and source filters derive the lesson count from loaded materials; audio generation reads material records from the database, including lessons with only one supplied dialogue.

Lesson 9 · Dialog 2 includes all 11 dialogue turns, 16 vocabulary entries and all 16 numbered PDF examples (18 spoken turns; A/B exchanges remain separate). Every entry has Pinyin, an English translation and a George MP3. Dialogue recordings use `--scope=dialogues`; `--scope=lesson9` regenerates missing vocabulary/example recordings for both parts of Lesson 9. Source screenshots and the original two-page PDF are retained in `materials/lesson9/dialog2/`.

The master list supports live search by Traditional/Simplified characters or Pinyin, including aliases. Pinyin matching ignores tones, spaces, capitalization and tone numbers (for example `xuéxiào`, `xue xiao` and `xue2xiao4`); `lü`, `lv` and `lu:` are equivalent. Search combines with lesson, word/expression and personal-list filters. Clear restores the filtered list, and Quiz selected uses the visible search results. Chinese IME composition is preserved while typing.

The app opens directly on All words & expressions. The brand button returns to this list. Search is in the top navbar and opens the list when used from another mode. The list shows only a matching/total count above its results.

All study assets and archived lesson data are grouped under `materials/`: `lesson1/`–`lesson9/`, `midterm1/`, `midterm2/`, `audio/` and `reading/`. Existing databases automatically migrate their file references on the next server start without changing content IDs or learning progress.
