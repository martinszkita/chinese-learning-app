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
  lesson2/ ... lesson8/ (same folder structure)
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
