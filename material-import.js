/* Browser-local material import. Drafts never enter the study collection. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'chinese-study-materials-v1';
  const SOURCE_TYPES = ['screenshot', 'photo', 'text'];
  const KINDS = ['word', 'sentence', 'dialogue'];
  const MAX_ROWS = 500;
  const MAX_TEXT = 100000;
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const cleanRow = (row) => ({ kind: KINDS.includes(row.kind) ? row.kind : 'sentence', speaker: String(row.speaker || '').trim().slice(0, 80), chinese: String(row.chinese || '').trim().slice(0, 2000), pinyin: String(row.pinyin || '').trim().slice(0, 4000), english: String(row.english || '').trim().slice(0, 4000) });
  function validateMaterial(value) {
    return value && typeof value.id === 'string' && /^import:[a-zA-Z0-9-]+$/.test(value.id) && typeof value.title === 'string' && value.title.trim() && SOURCE_TYPES.includes(value.sourceType) && Array.isArray(value.rows) && value.rows.length && value.rows.length <= MAX_ROWS && value.rows.every((row) => row && typeof row.chinese === 'string' && row.chinese.trim() && KINDS.includes(row.kind));
  }
  function getMaterials() {
    try {
      const stored = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter(validateMaterial).map((item) => ({ ...item, title: item.title.slice(0, 100), rows: item.rows.map(cleanRow) })) : [];
    } catch { return []; }
  }
  function parseText(text, options = {}) {
    if (String(text).length > MAX_TEXT) throw new Error('Use at most 100,000 characters per import.');
    const rows = [];
    const lookupKey = (text) => String(text).replace(/[\p{P}\p{Z}\s]/gu, '');
    const known = new Map((options.knownItems || []).map((item) => [lookupKey(item.chinese), item]));
    let previous = null;
    for (let line of String(text).replace(/\r\n?/g, '\n').replace(/[\u200b\ufeff]/g, '').split('\n')) {
      line = line.trim().replace(/^\d+[A-Za-z]?[.)、:：]?\s+/, '');
      if (!line || /^(?:Vocabulary|Dialogue|Example sentences|Names|Phrases|生詞|詞彙|對話|例句)(?:\s*[IⅡⅠ一二12]*)$/i.test(line)) continue;
      if (!/\p{Script=Han}/u.test(line)) {
        if (previous && /[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(line)) {
          if (!previous.pinyin && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(line)) previous.pinyin = line;
          else if (!previous.english) previous.english = line;
        }
        continue;
      }
      const columns = line.split(/\t+|\s*[|｜]\s*| {2,}/).map((column) => column.trim()).filter(Boolean);
      let chinese = columns.shift() || '';
      let speaker = '';
      const dialogue = chinese.match(/^([\p{Script=Han}A-Za-z0-9\s"'“”‘’·]{1,20})[:：]\s*(.+)$/u);
      if (dialogue) { speaker = dialogue[1].replace(/[^\p{Script=Han}A-Za-z0-9]/gu, ''); chinese = dialogue[2]; }
      // Chinese OCR often inserts spaces between adjacent characters.
      chinese = chinese.replace(/(\p{Script=Han})\s+(?=\p{Script=Han})/gu, '$1');
      if (!/\p{Script=Han}/u.test(chinese)) continue;
      const row = { kind: speaker ? 'dialogue' : (options.defaultKind || 'sentence'), speaker, chinese, pinyin: '', english: '', included: true };
      if (columns.length >= 2) [row.pinyin, row.english] = [columns.shift(), columns.join(' ')];
      else if (columns.length) {
        if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(columns[0])) row.pinyin = columns[0];
        else row.english = columns[0];
      }
      // Discard non-linguistic column noise (page numbers / Bopomofo) before filling known hints.
      if (row.pinyin && !/\p{Script=Latin}/u.test(row.pinyin)) row.pinyin = '';
      if (row.english && !/\p{Script=Latin}/u.test(row.english)) row.english = '';
      rows.push(row); previous = row;
    }
    if (rows.length > MAX_ROWS) throw new Error('Split this material into batches of at most 500 rows.');
    for (const row of rows) {
      const item = known.get(lookupKey(row.chinese));
      row.pinyin ||= item?.pinyin || (options.pinyin ? options.pinyin(row.chinese) : '');
      row.english ||= item?.english || '';
    }
    return rows;
  }
  function approve(input) {
    if (input.reviewed !== true) throw new Error('Review the material and tick the confirmation before saving.');
    if (!SOURCE_TYPES.includes(input.sourceType)) throw new Error('Choose a source type.');
    const title = String(input.title || '').trim().slice(0, 100);
    if (!title) throw new Error('Give your material a title.');
    if (!Array.isArray(input.rows)) throw new Error('Prepare rows for review first.');
    const selected = input.rows.filter((row) => row.included !== false);
    if (!selected.length || selected.length > MAX_ROWS) throw new Error('Select between 1 and 500 rows.');
    if (selected.some((row) => !String(row.chinese || '').trim())) throw new Error('Each selected row needs Chinese text.');
    const id = `import:${root.crypto.randomUUID()}`;
    const material = { id, title, sourceType: input.sourceType, createdAt: Date.now(), rows: selected.map(cleanRow), sourceNames: (input.sourceNames || []).map((name) => String(name).slice(0, 200)), rawText: String(input.rawText || '').slice(0, MAX_TEXT) };
    const materials = getMaterials();
    materials.push(material);
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(materials)); }
    catch { throw new Error('The material could not be saved. Browser storage may be full or unavailable. Your draft is still open.'); }
    return material;
  }

  const initialState = () => ({ sourceType: 'screenshot', defaultKind: 'sentence', title: '', rawText: '', rows: [], files: [], prepared: [], crops: [], busy: false, stage: 'input', reviewed: false, error: '', progress: '', confidence: [], run: 0 });
  let state = initialState();
  let container = null;
  let callbacks = {};
  let worker = null;
  const assetBase = root.document?.currentScript?.src ? new URL('vendor/', root.document.currentScript.src).href : '';
  const sourceLabels = { screenshot: 'Screenshot', photo: 'Book photo', text: 'Plain text' };
  function attached() { return container?.querySelector('[data-material-importer]'); }
  function progress(message) {
    state.progress = message;
    const node = attached()?.querySelector('[data-import-progress]');
    if (node) node.textContent = message;
  }
  function controlsDisabled() { return state.busy ? 'disabled' : ''; }
  function revokeFiles() {
    for (const entry of state.files) URL.revokeObjectURL(entry.url);
  }
  function render() {
    if (!container || (container.innerHTML && !attached())) return;
    const disabled = controlsDisabled();
    const typeCards = SOURCE_TYPES.map((type) => `<button type="button" class="import-source ${state.sourceType === type ? 'active' : ''}" data-import-source="${type}" aria-pressed="${state.sourceType === type}" ${disabled}><strong>${sourceLabels[type]}</strong><span>${type === 'screenshot' ? 'Keep layout → OCR → verify' : type === 'photo' ? 'Crop & rotate → improve contrast → OCR → verify' : 'Paste → split into rows → verify'}</span></button>`).join('');
    const files = state.files.map((file, index) => `<article class="import-source-preview"><h4>${escape(file.file.name)}</h4><img src="${escape(file.url)}" alt="Original source ${index + 1}"><a class="import-source-open" href="${escape(file.url)}" target="_blank" rel="noopener">Open original full size ↗</a>${state.sourceType === 'photo' ? `<fieldset class="import-photo-options"><legend>Prepare photo ${index + 1}</legend><label>Rotate <select data-import-crop="rotation" data-file-index="${index}" ${disabled}>${[0, 90, 180, 270].map((angle) => `<option ${state.crops[index]?.rotation === angle ? 'selected' : ''} value="${angle}">${angle}°</option>`).join('')}</select></label>${['top', 'bottom', 'left', 'right'].map((side) => `<label>Crop ${side} (%) <input type="number" min="0" max="40" value="${state.crops[index]?.[side] || 0}" data-import-crop="${side}" data-file-index="${index}" ${disabled}></label>`).join('')}</fieldset>` : ''}${state.prepared[index] ? `<details open><summary>Prepared for OCR</summary><img src="${state.prepared[index]}" alt="Prepared image ${index + 1}"></details>` : ''}${state.confidence[index] !== undefined ? `<p>OCR confidence: ${Math.round(state.confidence[index])}% — check every line.</p>` : ''}</article>`).join('');
    const rows = state.rows.map((row, index) => `<article class="import-review-row" data-import-row="${index}"><div class="import-review-row-head"><label><input type="checkbox" data-import-row-field="included" data-row-index="${index}" ${row.included !== false ? 'checked' : ''}> Include row ${index + 1}</label><button type="button" class="filter-action" data-import-remove-row="${index}">Remove</button></div><div class="import-row-fields"><label>Type <select data-import-row-field="kind" data-row-index="${index}">${KINDS.map((kind) => `<option ${row.kind === kind ? 'selected' : ''} value="${kind}">${kind}</option>`).join('')}</select></label><label>Speaker <input value="${escape(row.speaker)}" data-import-row-field="speaker" data-row-index="${index}" maxlength="80"></label><label class="import-wide">Chinese <textarea lang="zh-Hant" data-import-row-field="chinese" data-row-index="${index}" maxlength="2000">${escape(row.chinese)}</textarea></label><label class="import-wide">Pinyin <input value="${escape(row.pinyin)}" data-import-row-field="pinyin" data-row-index="${index}" maxlength="4000"></label><label class="import-wide">English <textarea data-import-row-field="english" data-row-index="${index}" maxlength="4000" placeholder="Add a translation if it was not present in the source">${escape(row.english)}</textarea></label></div></article>`).join('');
    container.innerHTML = `<section class="material-importer" data-material-importer><div class="import-intro"><p>Import Chinese words, expressions or dialogue. Nothing enters your study collection until you verify and approve it.</p><p class="import-local-note">OCR runs on this device. Source images stay in this tab; approved text is saved in this browser.</p></div><div class="import-source-types" role="group" aria-label="Source type">${typeCards}</div><section class="import-panel" id="material-import-source"><div class="import-metadata"><label>Material title <input data-import-field="title" value="${escape(state.title)}" maxlength="100" placeholder="e.g. Lesson 9 · Food" ${disabled}></label><label>Default row type <select data-import-field="defaultKind" ${disabled}>${KINDS.map((kind) => `<option value="${kind}" ${state.defaultKind === kind ? 'selected' : ''}>${kind}</option>`).join('')}</select></label></div>${state.sourceType === 'text' ? `<label class="import-text-label">Paste text <textarea data-import-raw maxlength="100000" placeholder="你好 | nǐ hǎo | hello&#10;安同：你想去哪裡？" ${disabled}>${escape(state.rawText)}</textarea></label><p>One entry per line. Use tabs or | to separate Chinese, Pinyin and English. Speaker names followed by : create dialogue rows.</p><button class="toggle active" type="button" data-import-parse ${disabled}>Prepare text for review</button>` : `<label class="import-upload">${state.sourceType === 'photo' ? 'Choose book photos' : 'Choose screenshots'}<input type="file" accept="image/png,image/jpeg,image/webp" multiple data-import-files ${disabled}></label><p>PNG, JPEG or WebP · up to 6 images, 15 MB each. ${state.sourceType === 'photo' ? 'Crop the text area and correct rotation, then prepare the photos.' : 'Upload a clear screenshot. Its layout and colors are preserved.'}</p><div class="import-image-previews">${files}</div><div class="import-actions">${state.sourceType === 'photo' ? `<button type="button" class="toggle" data-import-prepare ${!state.files.length || state.busy ? 'disabled' : ''}>Prepare photos</button>` : ''}<button type="button" class="toggle active" data-import-ocr ${!state.files.length || state.busy || (state.sourceType === 'photo' && state.prepared.length !== state.files.length) ? 'disabled' : ''}>Run OCR & review</button></div>${root.location?.protocol === 'file:' ? '<p class="import-warning">Image OCR requires opening the app over HTTP. In the app folder run <code>python3 -m http.server 8000 --bind 127.0.0.1</code>, then open <a href="http://localhost:8000">localhost:8000</a>. Text import works here too.</p>' : ''}`}</section><p class="import-progress" data-import-progress role="status" aria-live="polite">${escape(state.progress)}</p>${state.busy ? '<button type="button" class="filter-action" data-import-cancel>Cancel processing</button>' : ''}<p class="import-error" data-import-error role="alert">${escape(state.error)}</p>${state.rows.length || state.stage === 'review' ? `<section class="import-panel import-review"><h3>Verify before saving</h3><a class="import-source-open" href="#material-import-source">Back to source preview ↑</a><p>Compare each row with the source. Correct Chinese, Pinyin and translations, and remove headings or unwanted rows. Suggested Pinyin can contain mistakes; missing translations are left blank.</p>${state.sourceType !== 'text' ? `<details class="import-raw-details"><summary>Original OCR text — edit and split again</summary><textarea data-import-raw maxlength="100000">${escape(state.rawText)}</textarea><button type="button" class="filter-action" data-import-parse>Rebuild rows from edited text</button></details>` : ''}<div class="import-review-rows">${rows}</div><button type="button" class="filter-action" data-import-add-row>Add row</button><label class="import-confirm"><input type="checkbox" data-import-reviewed ${state.reviewed ? 'checked' : ''}> I checked the selected rows against the source and approve this material.</label><button type="button" class="toggle active" data-import-approve ${!state.reviewed || !state.rows.some((row) => row.included !== false) ? 'disabled' : ''}>Approve & add to study materials</button></section>` : ''}</section>`;
  }
  function setError(error) {
    state.error = error?.message || String(error);
    const node = attached()?.querySelector('[data-import-error]');
    if (node) node.textContent = state.error;
  }
  function invalidateReview() {
    state.reviewed = false;
    const checkbox = attached()?.querySelector('[data-import-reviewed]');
    if (checkbox) checkbox.checked = false;
    const approveButton = attached()?.querySelector('[data-import-approve]');
    if (approveButton) approveButton.disabled = true;
  }
  function loadScript(path, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(path, assetBase).href;
      script.onload = () => ready() ? resolve() : reject(new Error('Import dependency could not be initialized.'));
      script.onerror = () => { script.remove(); reject(new Error('Import files could not be loaded. Open the app using its HTTP server and try again.')); };
      document.head.append(script);
    });
  }
  async function makeRows(run = state.run) {
    await loadScript('pinyin/pinyin-pro.js', () => !!root.pinyinPro);
    if (run !== state.run) return;
    await loadScript('pinyin/opencc.js', () => !!root.OpenCC);
    if (run !== state.run) return;
    const simplified = root.OpenCC.Converter({ from: 'tw', to: 'cn' });
    state.rows = parseText(state.rawText, { defaultKind: state.defaultKind, knownItems: callbacks.knownItems?.() || [], pinyin: (text) => root.pinyinPro.pinyin(simplified(text), { toneType: 'symbol', nonZh: 'consecutive' }).replace(/\s+([，。！？、；：,.!?;:])/g, '$1') });
    state.stage = 'review';
    state.reviewed = false;
    state.error = state.rows.length ? '' : 'No Chinese entries were found. Edit the text or add a row manually.';
    render();
    attached()?.querySelector('.import-review')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function parseForReview() {
    state.busy = true; state.error = ''; const run = ++state.run; render();
    try { await makeRows(run); }
    catch (error) { if (run === state.run) setError(error); }
    finally { if (run === state.run) { state.busy = false; render(); } }
  }
  async function prepareImage(file, type, crop = {}) {
    const bitmap = await createImageBitmap(file);
    try {
      const rotation = Number(crop.rotation || 0);
      if (bitmap.width * bitmap.height > 50000000) throw new Error('This image is too large. Resize it below 50 megapixels first.');
      const rotated = document.createElement('canvas');
      rotated.width = rotation % 180 ? bitmap.height : bitmap.width;
      rotated.height = rotation % 180 ? bitmap.width : bitmap.height;
      if (rotated.width * rotated.height > 50000000) throw new Error('This image is too large. Resize it below 50 megapixels first.');
      const rc = rotated.getContext('2d');
      rc.translate(rotated.width / 2, rotated.height / 2); rc.rotate(rotation * Math.PI / 180);
      rc.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      const left = Math.max(0, Math.min(40, Number(crop.left) || 0)) / 100;
      const top = Math.max(0, Math.min(40, Number(crop.top) || 0)) / 100;
      const width = rotated.width * (1 - left - Math.max(0, Math.min(40, Number(crop.right) || 0)) / 100);
      const height = rotated.height * (1 - top - Math.max(0, Math.min(40, Number(crop.bottom) || 0)) / 100);
      const targetWidth = type === 'photo' ? 2400 : 1800;
      const scale = Math.min(targetWidth / width, Math.sqrt(6000000 / (width * height)), 3);
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(rotated, rotated.width * left, rotated.height * top, width, height, 0, 0, canvas.width, canvas.height);
      if (type === 'photo') {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const histogram = new Uint32Array(256);
        for (let i = 0; i < pixels.data.length; i += 4) histogram[Math.round(.299 * pixels.data[i] + .587 * pixels.data[i + 1] + .114 * pixels.data[i + 2])]++;
        const count = canvas.width * canvas.height;
        let low = 0, high = 255, sum = 0;
        while (low < 254 && sum < count * .01) sum += histogram[low++];
        sum = 0; while (high > low + 1 && sum < count * .01) sum += histogram[high--];
        for (let i = 0; i < pixels.data.length; i += 4) {
          const value = Math.max(0, Math.min(255, (pixels.data[i] * .299 + pixels.data[i + 1] * .587 + pixels.data[i + 2] * .114 - low) * 255 / Math.max(1, high - low)));
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      return canvas.toDataURL('image/png');
    } finally { bitmap.close(); }
  }
  async function preparePhotos() {
    state.busy = true; state.error = ''; const run = ++state.run; render();
    try {
      const prepared = [];
      for (const [index, entry] of state.files.entries()) {
        progress(`Preparing photo ${index + 1} of ${state.files.length}…`);
        prepared.push(await prepareImage(entry.file, 'photo', state.crops[index]));
        if (run !== state.run) return;
      }
      state.prepared = prepared; progress('Photos prepared. Check the previews, then run OCR.');
    } catch (error) { setError(error); }
    finally { if (run === state.run) { state.busy = false; render(); } }
  }
  async function runOCR() {
    if (root.location.protocol === 'file:') throw new Error('For image OCR, open the app at http://localhost:8000 using python3 -m http.server 8000.');
    state.busy = true; state.error = ''; state.confidence = []; const run = ++state.run; render();
    let timeout;
    let localWorker = null;
    try {
      await loadScript('ocr/tesseract.min.js', () => !!root.Tesseract);
      if (run !== state.run) return;
      let imageIndex = 0;
      timeout = setTimeout(() => { if (run === state.run) { cancelProcessing(); setError(new Error('OCR timed out. Try a smaller image or paste the text instead.')); } }, 180000);
      localWorker = await root.Tesseract.createWorker(['chi_tra', 'eng'], 1, {
        workerPath: new URL('ocr/worker.min.js', assetBase).href,
        corePath: new URL('ocr/core/', assetBase).href,
        langPath: new URL('ocr/lang/', assetBase).href,
        workerBlobURL: false,
        logger: (entry) => { if (run === state.run) progress(`Image ${imageIndex + 1}/${state.files.length}: ${entry.status} ${Math.round((entry.progress || 0) * 100)}%`); },
        errorHandler: () => {}
      });
      if (run !== state.run) { await localWorker.terminate(); return; }
      worker = localWorker;
      await localWorker.setParameters({ tessedit_pageseg_mode: state.sourceType === 'screenshot' ? '6' : '3', preserve_interword_spaces: '1' });
      const texts = [];
      for (const [index, entry] of state.files.entries()) {
        imageIndex = index;
        const image = state.prepared[index] || await prepareImage(entry.file, 'screenshot');
        if (run !== state.run) return;
        const result = await localWorker.recognize(image);
        if (run !== state.run) return;
        texts.push(result.data.text); state.confidence.push(result.data.confidence);
      }
      state.rawText = texts.join('\n\n');
      if (state.rawText.length > MAX_TEXT) throw new Error('OCR found too much text. Import fewer pages at once.');
      progress('OCR complete. Review and correct the text before approving.');
      await makeRows();
    } catch (error) { if (run === state.run) setError(new Error(`OCR failed: ${error.message}. Your images are still available; retry or paste text instead.`)); }
    finally {
      clearTimeout(timeout);
      if (run === state.run) {
        if (localWorker) await localWorker.terminate().catch(() => {});
        if (worker === localWorker) worker = null; state.busy = false; render();
      }
    }
  }
  function cancelProcessing() {
    state.run++; state.busy = false; state.progress = 'Processing cancelled. Nothing was saved.';
    if (worker) { worker.terminate().catch(() => {}); worker = null; }
    render();
  }
  async function click(event) {
    if (!event.target.closest('[data-material-importer]')) return;
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    try {
      if (button.hasAttribute('data-import-cancel')) { cancelProcessing(); return; }
      if (state.busy) return;
      if (button.dataset.importSource) {
        state.sourceType = button.dataset.importSource;
        state.prepared = []; state.rows = []; state.stage = 'input'; state.reviewed = false; state.error = ''; state.progress = ''; render();
      } else if (button.hasAttribute('data-import-prepare')) await preparePhotos();
      else if (button.hasAttribute('data-import-ocr')) await runOCR();
      else if (button.hasAttribute('data-import-parse')) await parseForReview();
      else if (button.hasAttribute('data-import-add-row')) { state.rows.push({ kind: state.defaultKind, speaker: '', chinese: '', pinyin: '', english: '', included: true }); state.stage = 'review'; state.reviewed = false; render(); }
      else if (button.hasAttribute('data-import-remove-row')) { state.rows.splice(Number(button.dataset.importRemoveRow), 1); state.reviewed = false; render(); }
      else if (button.hasAttribute('data-import-approve')) {
        const material = approve({ ...state, sourceNames: state.sourceType === 'text' ? [] : state.files.map((entry) => entry.file.name) });
        revokeFiles(); state = initialState(); callbacks.onSaved?.(material);
      }
    } catch (error) { setError(error); }
  }
  async function change(event) {
    const input = event.target;
    if (!input.closest('[data-material-importer]')) return;
    if (input.hasAttribute('data-import-files')) {
      try {
        const files = Array.from(input.files || []);
        if (!files.length) return;
        if (files.length > 6) throw new Error('Choose at most 6 images at once.');
        if (files.some((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024)) throw new Error('Choose PNG, JPEG or WebP images up to 15 MB each.');
        revokeFiles(); state.files = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
        state.crops = files.map(() => ({ rotation: 0, top: 0, bottom: 0, left: 0, right: 0 }));
        state.prepared = []; state.rows = []; state.rawText = ''; state.stage = 'input'; state.reviewed = false; state.confidence = []; state.error = '';
        state.title ||= files[0].name.replace(/\.[^.]+$/, '').slice(0, 100);
        render();
      } catch (error) { setError(error); }
    } else if (input.hasAttribute('data-import-crop')) {
      const value = Number(input.value);
      state.crops[Number(input.dataset.fileIndex)][input.dataset.importCrop] = Number.isFinite(value) ? value : 0;
      state.prepared = []; invalidateReview(); render();
    } else if (input.hasAttribute('data-import-reviewed')) {
      state.reviewed = input.checked;
      const button = attached()?.querySelector('[data-import-approve]');
      if (button) button.disabled = !state.reviewed || !state.rows.some((row) => row.included !== false);
    } else if (input.dataset.importField === 'defaultKind') {
      state.defaultKind = input.value; invalidateReview();
    } else if (input.dataset.importRowField === 'included' || input.dataset.importRowField === 'kind') updateInput(event);
  }
  function updateInput(event) {
    const input = event.target;
    if (!input.closest('[data-material-importer]') || state.busy) return;
    if (input.hasAttribute('data-import-crop')) {
      const index = Number(input.dataset.fileIndex);
      if (!state.crops[index]) return;
      state.crops[index][input.dataset.importCrop] = Number(input.value) || 0;
      state.prepared = []; invalidateReview();
      const ocrButton = attached()?.querySelector('[data-import-ocr]');
      if (ocrButton) ocrButton.disabled = true;
    }
    else if (input.hasAttribute('data-import-raw')) { state.rawText = input.value; invalidateReview(); }
    else if (input.dataset.importField === 'title') { state.title = input.value; invalidateReview(); }
    else if (input.dataset.importRowField) {
      const row = state.rows[Number(input.dataset.rowIndex)];
      if (!row) return;
      row[input.dataset.importRowField] = input.dataset.importRowField === 'included' ? input.checked : input.value;
      invalidateReview();
    }
  }
  function mount(target, options) {
    container = target; callbacks = options || {};
    container.innerHTML = '';
    if (!container.dataset.importerBound) {
      container.addEventListener('click', click);
      container.addEventListener('change', change);
      container.addEventListener('input', updateInput);
      container.dataset.importerBound = 'true';
    }
    render();
  }
  const api = { getMaterials, parseText, approve, validateMaterial, mount, escape };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CHINESE_IMPORTER = api;
})(typeof window !== 'undefined' ? window : globalThis);
