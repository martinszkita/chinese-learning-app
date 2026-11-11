window.ChineseApp.start = function start(snapshot) {
  const materialCatalog = window.ChineseApp.model.createCatalog(snapshot);
  const { lessons: database, midterms, lessonCount } = materialCatalog;
  let currentLesson = 'vocabulary';
  let currentPart = 'dialog1';
  let expandedLesson = null;
  let selectedReading = 0;
  const hintState = {};
  const rowHintState = {};
  const openState = {};
  const quizState = { index: 0, flipped: false, unansweredOnly: false, needsViewRecord: false, answered: null, currentChinese: null, advanceTimer: null, order: [], sourceKeys: null };
  const listeningState = { unlearnedOnly: false, kind: 'sentences', index: 0, rate: 1, revealStage: 0, transitionDirection: 0 };
  const listeningScope = Object.fromEntries([
    ...Array.from({ length: lessonCount }, (_, index) => `lesson${index + 1}`),
    'midterm1', 'midterm2'
  ].map((key) => [key, true]));

  function listeningScopeKey(source) {
    const lesson = /^(\d+)-dialog[12]$/.exec(source);
    return lesson ? `lesson${lesson[1]}` : source;
  }

  function renderListeningScope(items) {
    const sources = [
      ...Array.from({ length: lessonCount }, (_, index) => [`lesson${index + 1}`, `Lesson ${index + 1}`]),
      ['midterm1', 'Mid Term 1'], ['midterm2', 'Mid Term 2']
    ];
    return `<fieldset class="listening-scope"><legend>Show content from</legend><div class="vocabulary-filter-actions"><button type="button" class="filter-action" data-listening-select="all">Select all</button><button type="button" class="filter-action" data-listening-select="none">Clear all</button></div>${sources.map(([key, label]) => {
      const count = items.filter((item) => item.sources.some((source) => listeningScopeKey(source) === key)).length;
      return `<label class="vocabulary-filter"><input type="checkbox" data-listening-scope="${key}" ${listeningScope[key] ? 'checked' : ''}><span>${label} (${count})</span></label>`;
    }).join('')}</fieldset>`;
  }

  const listeningProgressKey = 'chinese-listening-progress-v1';
  const listeningProgress = window.ChineseApp.storage.readRecord(localStorage, listeningProgressKey);
  for (const [key, value] of Object.entries(listeningProgress)) {
    const id = materialCatalog.idForLegacyChinese(key);
    if (id && !listeningProgress[id]) listeningProgress[id] = value;
  }
  function getListeningStatus(chinese) {
    const entry = listeningProgress[materialCatalog.idForChinese(chinese) || chinese] ?? listeningProgress[chinese];
    return typeof entry === 'string' ? entry : entry?.status;
  }

  function gradeListeningItem(status) {
    const before = getListeningItems();
    const item = before[listeningState.index];
    if (!item || !['learned', 'unlearned'].includes(status)) return;
    const progressId = materialCatalog.idForChinese(item.chinese) || item.id || item.chinese;
    const previous = listeningProgress[progressId];
    const legacy = listeningProgress[item.chinese];
    const stats = (previous || legacy) && typeof (previous || legacy) === 'object' ? (previous || legacy) : {};
    const attempts = Number(stats.attempts) || 0;
    listeningProgress[progressId] = {
      status, attempts: attempts + 1,
      learned: (Number(stats.learned) || 0) + (status === 'learned' ? 1 : 0),
      unlearned: (Number(stats.unlearned) || 0) + (status === 'unlearned' ? 1 : 0)
    };
    try { localStorage.setItem(listeningProgressKey, JSON.stringify(listeningProgress)); }
    catch {
      if (previous === undefined) delete listeningProgress[progressId];
      else listeningProgress[progressId] = previous;
      window.alert('Learning status could not be saved. Please check browser storage.');
      return;
    }
    const remaining = getListeningItems();
    // When the filter removes this card, its successor takes the same index.
    const removed = listeningState.unlearnedOnly && status === 'learned';
    listeningState.index = remaining.length ? (listeningState.index + (removed ? 0 : 1)) % remaining.length : 0;
    listeningState.transitionDirection = 1;
    resetListeningHints();
    drawListening();
  }

  function renderListeningProgressFilter() {
    return `<section class="listening-control-card"><label class="setting-row"><span><strong>Only not learned yet</strong><small>Hide recordings marked as learned</small></span><input type="checkbox" data-listening-unlearned ${listeningState.unlearnedOnly ? 'checked' : ''}><span class="setting-switch" aria-hidden="true"></span></label></section>`;
  }
  const quizStatsStorageKey = 'chinese-exam-quiz-stats-v3';
  const settingsStorageKey = 'chinese-exam-settings-v1';
  const vocabularyFilterState = Object.fromEntries([
    ...Array.from({ length: lessonCount }, (_, index) => [`${index + 1}-dialog1`, `${index + 1}-dialog2`]).flat(),
    'midterm1', 'midterm2'
  ].map((source) => [source, true]));
  const personalListStorageKey = 'chinese-exam-personal-lists-v2';
  const personalLists = window.ChineseApp.storage.loadPersonalLists(localStorage, personalListStorageKey, (item) => materialCatalog.itemById(item.id || materialCatalog.idForLegacyChinese(item.chinese)) || { ...item, id: materialCatalog.idForChinese(item.chinese) });
  let activePersonalListId = personalLists[personalLists.length - 1].id;
  function getPersonalList() {
    return personalLists.find((list) => list.id === activePersonalListId) || personalLists[personalLists.length - 1];
  }
  function renderPersonalListPicker() {
    return `<label class="personal-list-picker">Save to list <select data-personal-list-select aria-label="Choose personal list">${personalLists.map((list) => `<option value="${escapeHtml(list.id)}" ${list.id === activePersonalListId ? 'selected' : ''}>${escapeHtml(list.name)} (${list.items.length})</option>`).join('')}</select></label>`;
  }
  let vocabularyType = 'all';
  let vocabularySearch = '';
  const vocabularySort = { key: 'lesson', direction: 'asc' };

  const saveableItems = new Map();
  let personalListOnly = false;
  const readingPassages = materialCatalog.readings;
  const nav = document.getElementById('lessonNav');
  const toolsNav = document.getElementById('studyToolsNav');
  const content = document.getElementById('content');
  const { escapeHtml } = window.ChineseApp.text;
  const appSettings = window.ChineseApp.storage.readRecord(localStorage, settingsStorageKey, {
    characterScript: 'traditional', darkMode: false, autoAdvance: true, listPinyin: false, listEnglish: false,
    listeningChinese: false, quizEnglishFirst: false, quizPinyin: true
  });
  // Convert only presentation text. Original Chinese remains the identity for
  // progress, saved lists, audio lookup, and Listening word selection.
  const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
  function chineseText(value, script = appSettings.characterScript) {
    const text = String(value ?? '');
    const explicit = materialCatalog.itemById(materialCatalog.idForChinese(text))?.simplified;
    return script === 'simplified' ? (explicit ?? toSimplified(text)) : text;
  }
  function chineseHtml(value, script) {
    return escapeHtml(chineseText(value, script));
  }
  function chineseLang() {
    return appSettings.characterScript === 'simplified' ? 'zh-Hans' : 'zh-Hant';
  }
  const characterScriptControl = document.getElementById('characterScript');
  function updateCharacterScriptToggle() {
    characterScriptControl.setAttribute('aria-pressed', String(appSettings.characterScript === 'simplified'));
  }
  updateCharacterScriptToggle();
  characterScriptControl.addEventListener('click', () => {
    appSettings.characterScript = appSettings.characterScript === 'simplified' ? 'traditional' : 'simplified';
    updateCharacterScriptToggle();
    saveSettings();
    draw();
  });

  const quizStats = window.ChineseApp.storage.readRecord(localStorage, quizStatsStorageKey);
  for (const [key, value] of Object.entries(quizStats)) {
    const id = materialCatalog.idForLegacyChinese(key);
    if (id && !quizStats[id]) quizStats[id] = value;
  }

  function saveQuizStats() {
    try {
      localStorage.setItem(quizStatsStorageKey, JSON.stringify(quizStats));
    } catch {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(settingsStorageKey, JSON.stringify(appSettings));
    } catch {}
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark-mode', appSettings.darkMode);
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.textContent = appSettings.darkMode ? '☀ Light mode' : '☾ Dark mode';
    themeToggle.setAttribute('aria-pressed', String(appSettings.darkMode));
  }

  applyTheme();

  function getWordStats(chinese) {
    const id = materialCatalog.idForChinese(chinese) || chinese;
    quizStats[id] ||= quizStats[chinese] || { shown: 0, correct: 0 };
    const stats = quizStats[id];
    stats.answered ??= stats.correct;
    return stats;
  }

  function getAccuracy(stats) {
    return stats.shown ? Math.round((stats.correct / stats.shown) * 100) : 0;
  }
  const { renderRuby } = window.ChineseApp.text;

  function renderZoomableCharacters(text, pinyin, showPinyin, lang) {
    const renderCharacter = (character) => `<button type="button" class="character-zoom-trigger" data-character-zoom="${escapeHtml(character)}" data-character-lang="${lang}" aria-label="Enlarge character ${escapeHtml(character)}" aria-haspopup="dialog" title="Enlarge character">${escapeHtml(character)}</button>`;
    return (showPinyin && renderRuby(text, pinyin, renderCharacter))
      || Array.from(text, (character) => /\p{Script=Han}/u.test(character) ? renderCharacter(character) : escapeHtml(character)).join('');
  }

  const characterZoomDialog = document.getElementById('characterZoomDialog');
  function openCharacterZoom(character, lang) {
    if (!/^\p{Script=Han}$/u.test(character)) return;
    const glyph = document.getElementById('characterZoomGlyph');
    glyph.textContent = character;
    glyph.setAttribute('lang', lang === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant');
    document.getElementById('characterZoomScript').textContent = lang === 'zh-Hans' ? 'Simplified Chinese' : 'Traditional Chinese';
    characterZoomDialog.showModal();
  }
  characterZoomDialog.addEventListener('click', (event) => {
    if (event.target === characterZoomDialog) characterZoomDialog.close();
  });
  document.getElementById('characterZoomClose').addEventListener('click', () => characterZoomDialog.close());

  function drawNav() {
    const lessons = Array.from({ length: lessonCount }, (_, index) => {
      const lesson = index + 1;
      const isExpanded = expandedLesson === lesson;
      const isCurrent = lesson === currentLesson;
      const parts = ['dialog1', 'dialog2'].map((part, partIndex) => {
        const data = database[`${lesson}-${part}`];
        const isSelected = isCurrent && currentPart === part;
        return `<button type="button" class="dialog-link ${isSelected ? 'active' : ''}" data-lesson-select="${lesson}" data-part="${part}" aria-current="${isSelected ? 'page' : 'false'}"><span>Dialog ${partIndex + 1}</span><small>${data?.title ? chineseHtml(data.title) : 'Not added yet'}</small></button>`;
      }).join('');
      return `<div class="lesson-group ${isExpanded ? 'open' : ''}"><button type="button" class="lesson-link lesson-toggle ${isCurrent ? 'active' : ''}" data-lesson-toggle="${lesson}" aria-expanded="${isExpanded}" aria-controls="lesson-options-${lesson}"><span>Lesson ${lesson}</span><span class="nav-chevron" aria-hidden="true">⌄</span></button><div class="lesson-options" id="lesson-options-${lesson}" ${isExpanded ? '' : 'hidden'}>${parts}</div></div>`;
    }).join('');
    const vocabularyLink = `<button type="button" class="lesson-link vocabulary-link ${currentLesson === 'vocabulary' ? 'active' : ''}" data-vocabulary="true" aria-current="${currentLesson === 'vocabulary' ? 'page' : 'false'}">All words &amp; expressions<span class="mini">字</span></button>`;
    const quizLink = `<button type="button" class="lesson-link quiz-link ${currentLesson === 'quiz' ? 'active' : ''}" data-quiz="true" aria-current="${currentLesson === 'quiz' ? 'page' : 'false'}">Flashcard quiz<span class="mini">↻</span></button>`;
    const readingLink = `<button type="button" class="lesson-link reading-link ${currentLesson === 'reading' ? 'active' : ''}" data-reading="true" aria-current="${currentLesson === 'reading' ? 'page' : 'false'}">Reading<span class="mini">文</span></button>`;
    const listeningLink = `<button type="button" class="lesson-link listening-link ${currentLesson === 'listening' ? 'active' : ''}" data-listening="true" aria-current="${currentLesson === 'listening' ? 'page' : 'false'}">Listening<span class="mini">聽</span></button>`;
    const settingsLink = `<button type="button" class="lesson-link settings-link ${currentLesson === 'settings' ? 'active' : ''}" data-settings="true" aria-current="${currentLesson === 'settings' ? 'page' : 'false'}"><span class="settings-label">Settings</span><span class="mini">⚙</span></button>`;
    const midtermLinks = [1, 2].map((number) => {
      const key = `midterm${number}`;
      const isCurrent = currentLesson === key;
      return `<button type="button" class="lesson-link midterm-link ${isCurrent ? 'active' : ''}" data-midterm="${key}" aria-current="${isCurrent ? 'page' : 'false'}">Mid Term Questions ${number}<span class="mini">◆</span></button>`;
    }).join('');
    nav.innerHTML = lessons + midtermLinks;
    toolsNav.innerHTML = vocabularyLink + quizLink + readingLink + listeningLink;
    document.getElementById('settingsNav').innerHTML = settingsLink;
  }

  function renderSaveButton(item) {
    saveableItems.set(item.chinese, item);
    const saved = getPersonalList().items.some((entry) => entry.chinese === item.chinese);
    return `<button type="button" class="personal-save ${saved ? 'active' : ''}" data-personal-save="${escapeHtml(item.chinese)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} ${escapeHtml(getPersonalList().name)}">${saved ? '★ Saved' : '☆ Save'}</button>`;
  }

  function persistPersonalList() {
    try {
      localStorage.setItem(personalListStorageKey, JSON.stringify({ lists: personalLists }));
      return true;
    } catch {
      window.alert('Your list could not be saved. Please check browser storage and try again.');
      return false;
    }
  }

  let materialPlayer = null;
  function stopMaterialAudio() {
    if (!materialPlayer) return;
    materialPlayer.pause();
    materialPlayer.onended = null;
    materialPlayer.onerror = null;
    materialPlayer = null;
  }

  function getMaterialAudio(item) {
    return item.audio || materialCatalog.audio[item.chinese]
      || collectListeningItems().find((recording) => recording.chinese === item.chinese)?.audio || '';
  }

  function renderMaterialAudio(item) {
    const audio = getMaterialAudio(item);
    if (!audio) return `<button type="button" class="word-audio material-audio" disabled aria-label="Recording not available yet" title="Recording not available yet">${renderSpeakerIcon()}</button>`;
    return `<button type="button" class="word-audio material-audio" data-word-audio="${escapeHtml(audio)}" aria-label="Play at normal speed: ${chineseHtml(item.chinese)}" title="Play · 1×">${renderSpeakerIcon()}</button>`;
  }

  const { dialoguePlayback, renderDialoguePlayer, updateDialoguePlayer, stopDialogueAudio, handleDialogueAction } = window.ChineseApp.dialoguePlayer.create({
    content, audio: document.getElementById('dialogueAudio'), getMaterialAudio, stopMaterialAudio, escapeHtml, renderSpeakerIcon
  });

  function renderLines(lines, key) {
    const hints = hintState[key] || { pinyin: false, english: false };
    const isDialogue = key.endsWith('-dialogue');
    return `${isDialogue && lines.length ? renderDialoguePlayer(lines, key) : ''}<div class="toolbar"><button class="toggle ${hints.pinyin ? 'active' : ''}" type="button" data-toggle="pinyin" data-key="${key}" aria-pressed="${hints.pinyin}">Pinyin ${hints.pinyin ? '✓' : '+'}</button><button class="toggle ${hints.english ? 'active' : ''}" type="button" data-toggle="english" data-key="${key}" aria-pressed="${hints.english}">English ${hints.english ? '✓' : '+'}</button><span class="hint">Click a row: Pinyin → both → hide</span></div>${lines.map((item, index) => {
      const rowKey = `${key}-${index}`;
      const rowHints = rowHintState[rowKey] || hints;
      const showPinyin = rowHints.pinyin;
      const showEnglish = rowHints.english;
      const ruby = showPinyin ? renderRuby(chineseText(item.chinese), item.pinyin) : null;
      return `<div class="line clickable-row" ${isDialogue ? `data-dialogue-key="${escapeHtml(key)}" data-dialogue-line="${index}"` : ''} data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><div><div class="speaker">${chineseHtml(item.speaker || '例句')}</div>${showPinyin && item.speakerPinyin ? `<div class="speaker-pinyin">${escapeHtml(item.speakerPinyin)}</div>` : ''}</div><div><div class="hanzi ${ruby ? 'hanzi-ruby' : ''}" lang="${chineseLang()}">${ruby || chineseHtml(item.chinese)}</div>${renderMaterialAudio(item)}${renderSaveButton(item)}${showPinyin && !ruby ? `<div class="pinyin">${escapeHtml(item.pinyin)}</div>` : ''}${showEnglish ? `<div class="english">${escapeHtml(item.english)}</div>` : ''}</div></div>`;
    }).join('')}<audio data-word-audio-player preload="none"></audio>`;
  }

  function renderSubsection(label, lines, key, defaultOpen = false) {
    const opened = openState[key] ?? defaultOpen;
    return `<div class="subsection ${opened ? 'open' : ''}"><button class="subsection-head" type="button" data-expand="${key}" aria-expanded="${opened}"><span>${escapeHtml(label)}<small>${lines.length ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : 'Not added yet'}</small></span><span class="chevron" aria-hidden="true">⌄</span></button>${opened ? `<div class="subsection-body">${lines.length ? renderLines(lines, key) : '<div class="empty">Material will appear here when its screenshot is added.</div>'}</div>` : ''}</div>`;
  }

  function renderWords(words, key, options = {}) {
    const showStats = options.showStats ?? false;
    const hints = hintState[key] || { pinyin: false, english: false };
    const statsHeader = showStats ? `<div class="word-stats-head"><span>#</span><span lang="zh-Hant">Traditional · 繁體</span><span lang="zh-Hans">Simplified · 简体</span><span>Hints</span>${renderVocabularySort('Lesson', 'lesson')}${renderVocabularySort('Shown', 'shown')}${renderVocabularySort('Answers', 'answered')}${renderVocabularySort('Correct', 'correct')}${renderVocabularySort('Accuracy', 'accuracy')}</div>` : '';
    return `<div class="toolbar"><button class="toggle ${hints.pinyin ? 'active' : ''}" type="button" data-toggle="pinyin" data-key="${key}" aria-pressed="${hints.pinyin}">Pinyin ${hints.pinyin ? '✓' : '+'}</button><button class="toggle ${hints.english ? 'active' : ''}" type="button" data-toggle="english" data-key="${key}" aria-pressed="${hints.english}">English ${hints.english ? '✓' : '+'}</button><span class="hint">${showStats ? 'Click a character to enlarge · Click the rest of a row for hints' : 'Click a row: Pinyin → both → hide'}</span></div>${statsHeader}<div class="word-list">${words.map((word, index) => {
      const rowKey = `${key}-${index}`;
      const rowHints = rowHintState[rowKey] || hints;
      const showPinyin = rowHints.pinyin;
      const showEnglish = rowHints.english;
      const ruby = showPinyin ? renderRuby(chineseText(word.chinese), word.pinyin) : null;
      if (showStats) {
        const traditionalRuby = showPinyin ? renderRuby(word.chinese, word.pinyin) : null;
        const simplified = chineseText(word.chinese, 'simplified');
        const simplifiedRuby = showPinyin ? renderRuby(simplified, word.pinyin) : null;
        const stats = getWordStats(word.chinese);
        const hintsContent = `${showPinyin && !traditionalRuby ? `<span class="word-pinyin">${escapeHtml(word.pinyin)}</span>` : ''}${showEnglish ? `<span class="word-english">${word.partOfSpeech ? `<small>(${escapeHtml(word.partOfSpeech)})</small>` : ''}${escapeHtml(word.english)}</span>` : ''}`;
        return `${word.category ? `<div class="word-category">${escapeHtml(word.category)}</div>` : ''}<div class="word-row word-row-with-stats clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><span class="word-number">${index + 1}</span><span class="word-hanzi ${traditionalRuby ? 'word-hanzi-ruby' : ''}" lang="zh-Hant">${renderZoomableCharacters(word.chinese, word.pinyin, showPinyin, 'zh-Hant')}${word.audio ? `<button type="button" class="word-audio" data-word-audio="${escapeHtml(word.audio)}" aria-label="Listen: ${chineseHtml(word.chinese)}" title="Play pronunciation">${renderSpeakerIcon()}</button>` : ''}${renderSaveButton(word)}</span><span class="word-hanzi word-simplified ${simplifiedRuby ? 'word-hanzi-ruby' : ''}" lang="zh-Hans">${renderZoomableCharacters(simplified, word.pinyin, showPinyin, 'zh-Hans')}</span><span class="word-details">${hintsContent}</span><span class="word-lesson" data-stat-label="Lesson">${word.sources.filter((source) => !source.startsWith('personal:')).map((source) => source.startsWith('lesson') ? `L${source.slice(6)}` : source === 'midterm1' ? 'Mid 1' : 'Mid 2').join(', ') || 'My list'}</span><span class="word-stat" data-stat-label="Shown">${stats.shown}</span><span class="word-stat" data-stat-label="Answers">${stats.answered}</span><span class="word-stat" data-stat-label="Correct">${stats.correct}</span><span class="word-stat word-accuracy" data-stat-label="Accuracy">${getAccuracy(stats)}%</span></div>`;
      }
      return `${word.category ? `<div class="word-category">${escapeHtml(word.category)}</div>` : ''}<div class="word-row clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><span class="word-number">${index + 1}</span><span class="word-hanzi ${ruby ? 'word-hanzi-ruby' : ''}" lang="${chineseLang()}">${ruby || chineseHtml(word.chinese)}${word.aliases?.length ? `<small class="word-aliases"> (${word.aliases.map((alias) => chineseHtml(alias.chinese)).join(', ')})</small>` : ''}${renderMaterialAudio(word)}${renderSaveButton(word)}</span>${showPinyin && !ruby ? `<span class="word-pinyin">${escapeHtml(word.pinyin)}</span>` : ''}${showEnglish ? `<span class="word-english">${word.partOfSpeech ? `<small>(${escapeHtml(word.partOfSpeech)})</small>` : ''}${escapeHtml(word.english)}</span>` : ''}</div>`;
    }).join('')}</div><audio data-word-audio-player preload="none"></audio>`;
  }

  function renderSupplement(data, key) {
    const words = data?.words || [];
    const examples = data?.examples || [];
    const sections = [];
    if (words.length) {
      const wordsKey = `${key}-words`;
      const opened = openState[wordsKey] ?? false;
      sections.push(`<div class="subsection ${opened ? 'open' : ''}"><button class="subsection-head" type="button" data-expand="${wordsKey}" aria-expanded="${opened}"><span>Words<small>${words.length} words</small></span><span class="chevron" aria-hidden="true">⌄</span></button>${opened ? `<div class="subsection-body">${renderWords(words, wordsKey)}</div>` : ''}</div>`);
    }
    if (examples.length) sections.push(renderSubsection('Example sentences', examples, `${key}-examples`));
    if (!sections.length) sections.push(renderSubsection('Example sentences', [], `${key}-examples`));
    return sections.join('');
  }

  function draw() {
    drawContent();
    if (currentLesson !== 'listening' && currentLesson !== 'quiz') drawModeSettings();
    updateDialoguePlayer();
  }

  function drawModeSettings() {
    const panel = document.getElementById('modeSettings');
    panel.innerHTML = '';
    const selectors = currentLesson === 'listening' ? ['.listening-controls']
      : currentLesson === 'quiz' ? ['.quiz-options', '.quiz-mode']
      : currentLesson === 'vocabulary' ? ['.vocabulary-filters']
      : currentLesson === 'reading' ? ['.reading-selector'] : [];
    for (const selector of selectors) {
      const control = content.querySelector(selector);
      if (control) panel.append(control);
    }
    const hintKeys = typeof currentLesson === 'number'
      ? [`${currentLesson}-${currentPart}-dialogue`]
      : String(currentLesson).startsWith('midterm')
      ? midterms[currentLesson].sections.map((_, index) => `${currentLesson}-section-${index + 1}`) : [];
    if (hintKeys.length) {
      const controls = hintKeys.map((key, index) => {
        const hints = hintState[key] || { pinyin: false, english: false };
        return `<section class="listening-control-card"><span class="listening-control-title">${hintKeys.length > 1 ? `Part ${index + 1}` : 'Dialogue hints'}</span><div class="toolbar"><button type="button" class="toggle ${hints.pinyin ? 'active' : ''}" data-toggle="pinyin" data-key="${key}" aria-pressed="${hints.pinyin}">Pinyin</button><button type="button" class="toggle ${hints.english ? 'active' : ''}" data-toggle="english" data-key="${key}" aria-pressed="${hints.english}">English</button></div></section>`;
      }).join('');
      panel.insertAdjacentHTML('beforeend', controls);
    }
    const settings = currentLesson === 'listening'
      ? renderSetting('listeningChinese', 'Show Chinese by default', 'Display Chinese characters when opening a recording.') + renderListeningProgressFilter()
      : currentLesson === 'quiz'
      ? renderSetting('autoAdvance', 'Automatic next card', 'Continue after choosing OK or X.')
      : currentLesson === 'vocabulary'
      ? renderSetting('listPinyin', 'Show Pinyin by default', 'Reveal pronunciation in the word list.') + renderSetting('listEnglish', 'Show English by default', 'Reveal meanings in the word list.')
      : `<p class="mode-description">${currentLesson === 'reading' ? 'Choose a passage below and read at your own pace.' : 'Click a sentence to reveal Pinyin and English. Use Hide all hints to practise without help.'}</p>`;
    panel.insertAdjacentHTML('afterbegin', `<section class="settings-card">${settings}</section>`);
    if (!['quiz', 'listening', 'vocabulary'].includes(currentLesson)) panel.insertAdjacentHTML('beforeend', `<section class="settings-card personal-target-card">${renderPersonalListPicker()}</section>`);
    if (currentLesson === 'quiz') {
      const switches = panel.querySelector('.quiz-switches');
      if (switches) panel.querySelector('.settings-card').append(switches);
    }
  }

  function drawContent() {
    const dialogueKey = typeof currentLesson === 'number' ? `${currentLesson}-${currentPart}-dialogue` : null;
    if (dialoguePlayback.key && dialoguePlayback.key !== dialogueKey) {
      stopDialogueAudio(true);
      dialoguePlayback.key = null;
      dialoguePlayback.lines = [];
    }
    stopMaterialAudio();
    drawNav();
    document.querySelector('main').classList.toggle('listening-view', currentLesson === 'listening');
    document.getElementById('hideAll').hidden = false;
    document.getElementById('sourceFootnote').hidden = ['vocabulary', 'quiz', 'reading', 'listening', 'settings'].includes(currentLesson);
    if (currentLesson === 'vocabulary') {
      drawVocabulary();
      return;
    }
    if (currentLesson === 'quiz') {
      drawQuiz();
      return;
    }
    if (currentLesson === 'reading') {
      drawReading();
      return;
    }
    if (currentLesson === 'listening') {
      drawListening();
      return;
    }
    if (currentLesson === 'settings') {
      drawSettings();
      return;
    }
    if (typeof currentLesson === 'string' && currentLesson.startsWith('midterm')) {
      drawMidterm();
      return;
    }
    const dialogNumber = currentPart === 'dialog2' ? 2 : 1;
    const key = `${currentLesson}-${currentPart}`;
    const data = database[key];
    const dialogue = data?.dialogue || data?.lines || [];
    document.getElementById('lessonTitle').textContent = `Lesson ${currentLesson} · Dialog ${dialogNumber}`;
    content.innerHTML = `<section class="section"><div class="section-head static-head"><span class="section-heading"><span class="section-num">0${dialogNumber}</span><span><span class="section-title">Dialog ${dialogNumber}</span><span class="section-meta">${data?.title ? chineseHtml(data.title) : 'Not added yet'}</span></span></span></div><div class="dialog-content">${renderSubsection('Dialogue', dialogue, `${key}-dialogue`, true)}${renderSupplement(data, `${key}-supplement`)}${(data?.screenshots || []).map((path, screenshotIndex) => `<a class="source-link" href="${encodeURI(path)}" target="_blank" rel="noopener">↗ View original screenshot ${screenshotIndex + 1}</a>`).join(' ')}${(data?.sources || []).map((source) => `<a class="source-link" href="${encodeURI(source.path)}" target="_blank" rel="noopener">↗ ${escapeHtml(source.label)}</a>`).join(' ')}</div></section>`;
  }

  function drawMidterm() {
    const data = midterms[currentLesson];
    document.getElementById('lessonTitle').textContent = data.title;
    content.innerHTML = `<section class="midterm-intro"><div class="subtle">${escapeHtml(data.subtitle)}</div><p>${escapeHtml(data.instructions)}</p></section>${data.sections.map((section, index) => renderSubsection(section.title, section.questions, `${currentLesson}-section-${index + 1}`)).join('')}<div class="midterm-followup"><strong>Follow-up:</strong> ${escapeHtml(data.followUps)}</div><a class="source-link" href="${encodeURI(data.source)}" target="_blank" rel="noopener">↗ View original PDF</a>`;
  }

  const { collectVocabulary, collectListeningItems } = window.ChineseApp.studyMaterials.create({ catalog: materialCatalog, getPersonalLists: () => personalLists });

  function matchesVocabularyType(word, type) {
    return type === 'all' || word.materialType === type;
  }

  function matchesMaterialSource(word, source) {
    return word.sources.includes(source) || (word.dialogSources || []).includes(source);
  }

  function materialSources() {
    return [
      ...Array.from({ length: lessonCount }, (_, index) => [1, 2].map((dialog) => ({ key: `${index + 1}-dialog${dialog}`, label: `Lesson ${index + 1} · Dialog ${dialog}` }))).flat(),
      { key: 'midterm1', label: 'Mid Term 1' }, { key: 'midterm2', label: 'Mid Term 2' }
    ];
  }

  function renderMaterialScope(mode) {
    const selected = (key) => mode === 'vocabulary' ? vocabularyFilterState[key] : quizState.sourceKeys === null ? !key.startsWith('personal:') : quizState.sourceKeys.some((source) => source === key || source === `lesson${key.split('-')[0]}`);
    const checkbox = (key, label) => `<label class="vocabulary-filter"><input type="checkbox" data-${mode}-scope="${escapeHtml(key)}" ${selected(key) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
    return `<div class="material-scope"><div class="vocabulary-filter-actions"><button type="button" class="filter-action" data-${mode}-scope-select="all">Select all</button><button type="button" class="filter-action" data-${mode}-scope-select="none">Clear all</button></div>${Array.from({ length: lessonCount }, (_, index) => {
      const lesson = index + 1;
      return `<div class="material-scope-lesson"><label class="vocabulary-filter"><input type="checkbox" data-${mode}-scope-lesson="${lesson}" ${selected(`${lesson}-dialog1`) && selected(`${lesson}-dialog2`) ? 'checked' : ''}><span>Lesson ${lesson}</span></label><div class="material-scope-dialogs">${[1, 2].map((dialog) => checkbox(`${lesson}-dialog${dialog}`, `Dialog ${dialog}`)).join('')}</div></div>`;
    }).join('')}${checkbox('midterm1', 'Mid Term 1')}${checkbox('midterm2', 'Mid Term 2')}${mode === 'quiz' ? `<div class="material-scope-custom"><strong>Custom lists</strong>${personalLists.map((list) => checkbox(`personal:${list.id}`, `${list.name} (${list.items.length})`)).join('')}</div>` : ''}</div>`;
  }

  const normalizeVocabularySearch = window.ChineseApp.text.normalizeSearch;

  function matchesVocabularySearch(word, query) {
    const needle = normalizeVocabularySearch(chineseText(query, 'simplified'));
    if (!needle) return true;
    return [word, ...(word.aliases || [])].some((item) =>
      normalizeVocabularySearch(chineseText(item.chinese, 'simplified')).includes(needle)
      || normalizeVocabularySearch(item.pinyin).includes(needle));
  }

  function getFilteredVocabulary(words) {
    words = words.filter((word) => matchesVocabularyType(word, vocabularyType) && matchesVocabularySearch(word, vocabularySearch));
    if (personalListOnly) return words.filter((word) => word.sources.includes(`personal:${activePersonalListId}`)).map((word, index) => ({ ...word, category: index === 0 ? getPersonalList().name : '' }));
    const sources = materialSources();
    const emitted = new Set();
    const filtered = [];
    sources.filter((source) => vocabularyFilterState[source.key]).forEach((source) => {
      let firstInSource = true;
      words.forEach((word) => {
        if (emitted.has(word.chinese) || !matchesMaterialSource(word, source.key)) return;
        filtered.push({ ...word, category: firstInSource ? source.label : '' });
        emitted.add(word.chinese);
        firstInSource = false;
      });
    });
    return filtered;
  }

  function vocabularyLesson(word) {
    const lessons = word.sources.filter((source) => source.startsWith('lesson')).map((source) => Number(source.slice(6)));
    return lessons.length ? Math.min(...lessons) : word.sources.includes('midterm1') ? lessonCount + 1 : word.sources.includes('midterm2') ? lessonCount + 2 : lessonCount + 3;
  }

  function sortVocabulary(words) {
    const value = (word) => {
      const stats = getWordStats(word.chinese);
      return vocabularySort.key === 'lesson' ? vocabularyLesson(word) : vocabularySort.key === 'accuracy' ? getAccuracy(stats) : stats[vocabularySort.key] || 0;
    };
    return words.map((word, index) => ({ word, index })).sort((a, b) => (value(a.word) - value(b.word)) * (vocabularySort.direction === 'asc' ? 1 : -1) || a.index - b.index).map(({ word }) => ({ ...word, category: '' }));
  }

  function renderVocabularySort(label, key) {
    const direction = vocabularySort.key === key ? vocabularySort.direction : '';
    return `<button type="button" class="word-sort ${direction ? 'active' : ''}" data-vocabulary-sort="${key}" aria-label="Sort by ${label}${direction ? `, ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}">${label} <span aria-hidden="true">${direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span></button>`;
  }

  function renderVocabularyResults(words) {
    return words.length ? renderWords(words, 'vocabulary-all', { showStats: true })
      : `<div class="empty">${vocabularySearch.trim() ? 'No words or expressions match your search and selected filters.' : personalListOnly ? 'No items match this list and material type.' : 'No items match the selected lessons and material type.'}</div>`;
  }

  function updateVocabularySearch(value) {
    vocabularySearch = value;
    document.querySelector('[data-vocabulary-search]').value = value;
    document.querySelector('[data-vocabulary-search-clear]').disabled = !value;
    Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
    if (currentLesson !== 'vocabulary') {
      currentLesson = 'vocabulary';
      expandedLesson = null;
      draw();
      return;
    }
    stopMaterialAudio();
    const words = collectVocabulary();
    const filtered = sortVocabulary(getFilteredVocabulary(words));
    content.querySelector('.vocabulary-list-panel').innerHTML = renderVocabularyResults(filtered);
    content.querySelector('[data-vocabulary-result-count]').textContent = `Showing ${filtered.length} of ${words.length} words and expressions`;
    const quizButton = document.querySelector('.shell').querySelector('[data-start-filtered-quiz]');
    if (quizButton) {
      quizButton.textContent = `Quiz selected · ${filtered.length}`;
      quizButton.disabled = !filtered.length;
    }
  }

  function drawVocabulary() {
    const words = collectVocabulary();
    const filteredWords = sortVocabulary(getFilteredVocabulary(words));
    const key = 'vocabulary-all';
    const filters = renderMaterialScope('vocabulary');
    document.getElementById('lessonTitle').textContent = 'All words & expressions';
    hintState[key] ||= { pinyin: appSettings.listPinyin, english: appSettings.listEnglish };
    content.innerHTML = `<p class="vocabulary-result-count" data-vocabulary-result-count role="status">Showing ${filteredWords.length} of ${words.length} words and expressions</p><fieldset class="vocabulary-filters"><legend>Show content from</legend><div class="vocabulary-type-switch" role="group" aria-label="Material type">${[['all', 'All'], ['word', 'Words'], ['expression', 'Expressions']].map(([value, label]) => `<button type="button" class="toggle ${vocabularyType === value ? 'active' : ''}" data-vocabulary-type="${value}" aria-pressed="${vocabularyType === value}">${label}</button>`).join('')}</div><div class="vocabulary-filter-actions"><button type="button" class="filter-action start-filtered-quiz" data-start-filtered-quiz ${filteredWords.length ? '' : 'disabled'}>Quiz selected · ${filteredWords.length}</button></div>${filters}<div class="personal-list-controls">${renderPersonalListPicker()}<form data-personal-create><label>New list <input name="listName" required maxlength="80" placeholder="List name"></label><button type="submit" class="filter-action">Create list</button></form><label class="vocabulary-filter"><input type="checkbox" data-personal-filter ${personalListOnly ? 'checked' : ''}><span>Only: ${escapeHtml(getPersonalList().name)} (${getPersonalList().items.length})</span></label><form data-personal-rename><label>List name <input name="listName" value="${escapeHtml(getPersonalList().name)}" required maxlength="80"></label><button type="submit" class="filter-action">Rename</button></form><small>Use ☆ Save beside a word or sentence. Your list is saved in this browser.</small></div></fieldset><section class="vocabulary-list-panel">${renderVocabularyResults(filteredWords)}</section>`;
  }

  function renderSetting(key, title, description) {
    return `<label class="setting-row"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-setting="${key}" ${appSettings[key] ? 'checked' : ''}><span class="setting-switch" aria-hidden="true"></span></label>`;
  }

  function drawSettings() {
    document.getElementById('lessonTitle').textContent = 'Settings';
    content.innerHTML = `<div class="settings-grid"><section class="settings-card"><div class="settings-card-head"><span class="settings-icon">◆</span><div><h3>Quiz</h3><p>Control flashcard behavior.</p></div></div>${renderSetting('autoAdvance', 'Automatic next card', 'Move to the next flashcard after choosing OK or X.')}</section><section class="settings-card"><div class="settings-card-head"><span class="settings-icon">字</span><div><h3>Words & expressions</h3><p>Choose the default hints for the complete list.</p></div></div>${renderSetting('listPinyin', 'Show Pinyin by default', 'Reveal Pinyin when the complete list opens.')}${renderSetting('listEnglish', 'Show English by default', 'Reveal English meanings when the complete list opens.')}</section></div>`;
  }

  function drawReading() {
    const passage = readingPassages[selectedReading] || readingPassages[0];
    const characterCount = passage.paragraphs.join('').match(/\p{Script=Han}/gu)?.length || 0;
    const countLabel = passage.wordCount ? `${passage.wordCount} words` : `${characterCount} characters`;
    const passageButtons = readingPassages.map((item, index) => `<button type="button" class="toggle ${selectedReading === index ? 'active' : ''}" data-reading-passage="${index}" aria-pressed="${selectedReading === index}">${escapeHtml(item.label || `${characterCount} characters`)}</button>`).join('');
    document.getElementById('lessonTitle').textContent = 'Reading practice';
    content.innerHTML = `<div class="reading-selector" role="group" aria-label="Choose reading text">${passageButtons}</div><article class="reading-card"><div class="reading-card-head"><div><div class="subtle">READING PRACTICE · LESSONS 1–7</div><h3 lang="${chineseLang()}">${chineseHtml(passage.title)}</h3><p class="reading-ai-note">This practice text was generated by AI from the course vocabulary.</p></div><span class="reading-count">${countLabel}</span></div><div class="reading-text" lang="${chineseLang()}">${passage.paragraphs.map((paragraph) => `<p>${chineseHtml(paragraph.replaceAll(' ', ''))}</p>`).join('')}</div></article>`;
  }

  function resetListeningHints() {
    listeningState.revealStage = appSettings.listeningChinese ? 1 : 0;
  }

  function getListeningPool() {
    if (listeningState.kind === 'words') {
      return collectVocabulary()
        .filter((word) => word.audio && word.sources.some((source) => source.startsWith('lesson')))
        .map((word, index) => ({
          ...word,
          sources: word.sources.filter((source) => source.startsWith('lesson')),
          sourceLabel: word.sources.filter((source) => source.startsWith('lesson')).map((source) => `Lesson ${source.slice(6)}`).join(' · '),
          sourceIndex: index + 1,
          voice: word.voice || 'George'
        }));
    }
    return collectListeningItems().map((item) => ({ ...item, sources: [item.sourceKey] }));
  }

  function getListeningItems() {
    const items = getListeningPool().filter((item) => !listeningState.unlearnedOnly || getListeningStatus(item.chinese) !== 'learned');
    return items.filter((item) => item.sources.some((source) => listeningScope[listeningScopeKey(source)]));
  }

  function renderSpeakerIcon() {
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 19h9l11-9v28L16 29H7z"></path><path d="M33 17c3.8 3.8 3.8 10.2 0 14M38 12c6.7 6.7 6.7 17.3 0 24"></path></svg>';
  }

  function renderListeningWords(item) {
    // Match whole vocabulary entries first, so multi-character words stay together.
    const dictionary = new Map(collectVocabulary()
      .filter((word) => /^\p{Script=Han}+$/u.test(word.chinese))
      .map((word) => [word.chinese, word]));
    if (/^\p{Script=Han}+$/u.test(item.chinese)) dictionary.set(item.chinese, item);
    const candidates = [...dictionary.values()].sort((a, b) => b.chinese.length - a.chinese.length);
    const ruby = renderRuby(chineseText(item.chinese), item.pinyin);
    const syllables = ruby ? [...ruby.matchAll(/<rt>(.*?)<\/rt>/g)].map((match) => match[1]) : [];
    let hanIndex = 0;
    let result = '';
    for (let position = 0; position < item.chinese.length;) {
      const character = String.fromCodePoint(item.chinese.codePointAt(position));
      if (!/\p{Script=Han}/u.test(character)) {
        result += escapeHtml(character);
        position += character.length;
        continue;
      }
      const word = candidates.find((entry) => item.chinese.startsWith(entry.chinese, position)) || {
        chinese: character, pinyin: syllables[hanIndex] || '', english: ''
      };
      saveableItems.set(word.chinese, word);
      result += `<button type="button" class="listening-word" data-listening-word="${escapeHtml(word.chinese)}" aria-label="Show word: ${chineseHtml(word.chinese)}">${chineseHtml(word.chinese)}</button>`;
      position += word.chinese.length;
      hanIndex += Array.from(word.chinese).length;
    }
    return result;
  }

  function drawListening() {
    const allItems = getListeningPool();
    const items = getListeningItems();
    listeningState.index = Math.min(listeningState.index, Math.max(items.length - 1, 0));
    const item = items[listeningState.index];
    const kindButtons = [['sentences', 'Sentences'], ['words', 'Words & expressions']]
      .map(([kind, label]) => `<button type="button" class="toggle ${listeningState.kind === kind ? 'active' : ''}" data-listening-kind="${kind}" aria-pressed="${listeningState.kind === kind}">${label}</button>`).join('');
    const scopeControls = renderListeningScope(allItems);
    document.getElementById('lessonTitle').textContent = 'Listening practice';
    if (!item) {
      content.innerHTML = `<div class="listening-layout"><section class="listening-panel"><div class="empty">${Object.values(listeningScope).some(Boolean) ? 'No recordings match your selection. Choose other lessons or turn off Only not learned yet.' : 'Select at least one lesson or mid-term.'}</div></section><aside class="listening-controls"><section class="listening-control-card"><div class="listening-kind">${kindButtons}</div>${scopeControls}</section></aside></div>`;
      drawModeSettings();
      return;
    }

    const revealLabel = listeningState.revealStage === 0 ? 'Show Chinese' : listeningState.revealStage === 1 ? 'Show Pinyin and English translation' : 'Hide answer';
    const revealedAnswer = listeningState.revealStage === 0
      ? '<span class="listening-hidden">Listen first, then click to reveal the Chinese text</span>'
      : `<span class="listening-hanzi" lang="${chineseLang()}">${renderListeningWords(item)}</span>${listeningState.revealStage === 2 ? `<span class="listening-pinyin" lang="zh-Latn-pinyin">${escapeHtml(item.pinyin)}</span><span class="listening-english" lang="en">${escapeHtml(item.english)}</span>` : ''}`;
    const transitionClass = listeningState.transitionDirection > 0 ? 'listening-slide-next' : listeningState.transitionDirection < 0 ? 'listening-slide-previous' : '';
    listeningState.transitionDirection = 0;
    content.innerHTML = `<div class="listening-layout"><section class="listening-panel"><div class="listening-card-frame ${transitionClass}"><div class="listening-card-meta"><span class="quiz-scope">${escapeHtml(item.sourceLabel)} · ${item.sourceIndex}</span><span class="listening-voice-badge">Voice · ${escapeHtml(item.voice)}</span></div><div class="quiz-progress"><strong>${listeningState.index + 1}</strong> / ${items.length}<span>Press the speaker or Space to play</span></div><div class="listening-flash-stage"><button type="button" class="quiz-arrow" data-listening-nav="-1" aria-label="Previous recording" ${listeningState.index === 0 ? 'disabled' : ''}>←</button><div class="listening-stage-center"><button type="button" class="listening-play-button" data-listening-play aria-label="Play recording">${renderSpeakerIcon()}<span>Play recording</span></button><button type="button" class="listening-slow" data-listening-slow aria-label="Play slowly at 0.75 speed" title="Play slowly · 0.75×"><span aria-hidden="true">🐢</span><span>0.75×</span></button><audio preload="metadata" data-listening-audio src="${encodeURI(item.audio)}">Your browser does not support audio playback.</audio></div><button type="button" class="quiz-arrow" data-listening-nav="1" aria-label="Next recording" ${listeningState.index === items.length - 1 ? 'disabled' : ''}>→</button></div><div role="button" tabindex="0" class="listening-answer-card stage-${listeningState.revealStage}" data-listening-reveal aria-label="${revealLabel}"><span class="listening-answer-action">${revealLabel}</span><span class="listening-answer-content">${revealedAnswer}</span></div><section class="listening-word-menu" data-listening-word-menu hidden aria-label="Selected word" aria-live="polite"></section><div class="listening-save">${renderSaveButton(item)}${renderPersonalListPicker()}</div><div class="listening-grades" role="group" aria-label="Learning status"><button type="button" class="toggle" data-listening-grade="learned" aria-pressed="false">✓ Learned</button><button type="button" class="toggle" data-listening-grade="unlearned" aria-pressed="false">Not learned yet</button></div></div></section><aside class="listening-controls" aria-label="Listening settings"><section class="listening-control-card"><span class="listening-control-title">Material</span><div class="listening-kind" role="group" aria-label="Listening material type">${kindButtons}</div>${scopeControls}<button type="button" class="toggle listening-random" data-listening-random ${items.length < 2 ? 'disabled' : ''}>Shuffle · Random ${listeningState.kind === 'words' ? 'word / expression' : 'sentence'}</button></section><section class="listening-control-card listening-shortcuts"><span class="listening-control-title">Keyboard</span><div><kbd>Space</kbd><span>Play / pause</span></div><div><kbd>←</kbd><kbd>→</kbd><span>Previous / next</span></div><div><kbd>↑</kbd><span>Reveal answer</span></div></section></aside></div>`;
    drawModeSettings();
    const audio = content.querySelector('[data-listening-audio]');
    if (audio) {
      audio.defaultPlaybackRate = listeningState.rate;
      audio.playbackRate = listeningState.rate;
      const playButton = content.querySelector('[data-listening-play]');
      audio.addEventListener('play', () => playButton?.classList.add('playing'));
      audio.addEventListener('pause', () => playButton?.classList.remove('playing'));
      audio.addEventListener('ended', () => playButton?.classList.remove('playing'));
    }
  }

  function changeListeningItem(change) {
    const items = getListeningItems();
    const nextIndex = Math.max(0, Math.min(listeningState.index + change, items.length - 1));
    if (nextIndex === listeningState.index) return;
    listeningState.index = nextIndex;
    listeningState.transitionDirection = Math.sign(change);
    resetListeningHints();
    drawListening();
  }

  function renderQuizFace(word, type, side) {
    const pinyin = type === 'chinese' && appSettings.quizPinyin ? `<span class="flashcard-pinyin" lang="zh-Latn-pinyin">${escapeHtml(word.pinyin)}</span>` : '';
    if (type === 'chinese') {
      return `<span class="flashcard-face flashcard-${side} flashcard-chinese-face"><span class="flashcard-face-label">Chinese</span><span class="flashcard-hanzi" lang="${chineseLang()}">${chineseHtml(word.chinese)}</span>${pinyin}</span>`;
    }
    return `<span class="flashcard-face flashcard-${side} flashcard-answer-face"><span class="flashcard-face-label">English</span><span class="flashcard-english">${escapeHtml(word.english)}</span>${pinyin}${word.partOfSpeech ? `<span class="flashcard-pos">${escapeHtml(word.partOfSpeech)}</span>` : ''}</span>`;
  }

  function shuffleWords(words) {
    const shuffled = [...words];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  function resetQuizSession(sourceKeys = null, materialType = 'all', searchQuery = '') {
    if (quizState.advanceTimer) clearTimeout(quizState.advanceTimer);
    quizState.index = 0;
    quizState.flipped = false;
    quizState.answered = null;
    quizState.currentChinese = null;
    quizState.needsViewRecord = true;
    quizState.advanceTimer = null;
    quizState.materialType = materialType;
    quizState.searchQuery = searchQuery;
    quizState.sourceKeys = sourceKeys === null ? null : [...sourceKeys];
    quizState.order = [];
  }

  function getQuizVocabulary() {
    let words = collectVocabulary().filter((word) => matchesVocabularyType(word, quizState.materialType || 'all') && matchesVocabularySearch(word, quizState.searchQuery));
    if (quizState.sourceKeys) words = words.filter((word) => quizState.sourceKeys.some((source) => matchesMaterialSource(word, source)));
    if (quizState.unansweredOnly) words = words.filter((word) => getWordStats(word.chinese).correct === 0);
    if (!quizState.order.length) quizState.order = shuffleWords(words).map((word) => word.chinese);
    const wordsByChinese = new Map(words.map((word) => [word.chinese, word]));
    const ordered = quizState.order.map((chinese) => wordsByChinese.get(chinese)).filter(Boolean);
    const orderedChinese = new Set(quizState.order);
    return [...ordered, ...shuffleWords(words.filter((word) => !orderedChinese.has(word.chinese)))];
  }

  function drawQuiz() {
    const words = getQuizVocabulary();
    const scope = quizState.sourceKeys ? `Selected filters: ${quizState.sourceKeys.map((source) => source.startsWith('lesson') ? `Lesson ${source.replace('lesson', '')}` : /^(\d+)-dialog([12])$/.test(source) ? source.replace(/^(\d+)-dialog([12])$/, 'Lesson $1 · Dialog $2') : source.startsWith('personal:') ? (personalLists.find((list) => `personal:${list.id}` === source)?.name || 'My list') : source === 'midterm1' ? 'Mid Term 1' : 'Mid Term 2').join(', ')}` : 'All lessons and mid-terms';
    const filter = `<fieldset class="quiz-material-scope"><legend>Material scope</legend>${renderMaterialScope('quiz')}</fieldset><span class="quiz-scope">${escapeHtml(scope)}${quizState.searchQuery ? ` · Search: ${escapeHtml(quizState.searchQuery)}` : ''}</span><label class="quiz-filter"><input type="checkbox" data-quiz-unanswered ${quizState.unansweredOnly ? 'checked' : ''}><span>Only words never answered correctly</span></label>`;
    document.getElementById('lessonTitle').textContent = 'Flashcard quiz';
    if (!words.length) {
      content.innerHTML = `<section class="quiz-panel"><div class="quiz-options">${filter}</div><div class="quiz-complete"><strong>No matching cards</strong><span>Select material in the panel or adjust the unanswered filter.</span></div></section>`;
      drawModeSettings();
      return;
    }
    quizState.index = Math.min(quizState.index, words.length - 1);
    const word = words[quizState.index];
    if (quizState.currentChinese !== word.chinese) quizState.answered = null;
    quizState.currentChinese = word.chinese;
    if (quizState.needsViewRecord) {
      getWordStats(word.chinese).shown += 1;
      saveQuizStats();
      quizState.needsViewRecord = false;
    }
    const stats = getWordStats(word.chinese);
    const frontType = appSettings.quizEnglishFirst ? 'english' : 'chinese';
    const backType = frontType === 'chinese' ? 'answer' : 'chinese';
    const isLong = Array.from(word.chinese).length > 14;
    const answerMessage = quizState.answered === 'correct' ? 'Marked as known' : quizState.answered === 'incorrect' ? 'Marked for more practice' : 'Do you know this word?';
    const flashcard = `<button type="button" class="flashcard ${isLong ? 'flashcard-long' : ''} ${quizState.flipped ? 'flipped' : ''}" data-flashcard-flip aria-pressed="${quizState.flipped}" aria-label="Flip flashcard"><span class="flashcard-inner">${renderQuizFace(word, frontType, 'front')}${renderQuizFace(word, backType, 'back')}</span></button>`;
    const flashcardAudio = word.audio ? `<button type="button" class="flashcard-audio" data-quiz-audio aria-label="Play pronunciation">${renderSpeakerIcon()}<span>Listen</span></button><audio preload="metadata" data-quiz-audio-player src="${encodeURI(word.audio)}">Your browser does not support audio playback.</audio>` : '';
    content.innerHTML = `<section class="quiz-panel"><div class="quiz-options">${filter}</div><div class="quiz-mode quiz-switches" role="group" aria-label="Flashcard display">${renderSetting('quizEnglishFirst', appSettings.quizEnglishFirst ? 'English first' : 'Chinese first', 'Chinese first ↔ English first')}${renderSetting('quizPinyin', 'Show Pinyin', appSettings.quizPinyin ? 'Pinyin on' : 'Pinyin off')}</div><div class="quiz-progress"><strong>${quizState.index + 1}</strong> / ${words.length}<span>Click the card to reveal the other side</span></div><div class="flashcard-stage"><button type="button" class="quiz-arrow" data-quiz-nav="-1" aria-label="Previous flashcard">←</button><div class="flashcard-wrap">${flashcard}${flashcardAudio}</div><button type="button" class="quiz-arrow" data-quiz-nav="1" aria-label="Next flashcard">→</button></div><div class="quiz-save">${renderSaveButton(word)}${renderPersonalListPicker()}</div><div class="quiz-grade"><button type="button" class="quiz-grade-button incorrect ${quizState.answered === 'incorrect' ? 'selected' : ''}" data-quiz-answer="incorrect" ${quizState.answered ? 'disabled' : ''} aria-label="I do not know this word"><span aria-hidden="true">×</span> X</button><div class="quiz-grade-status"><strong>${answerMessage}</strong><span>Shown: <b data-current-shown>${stats.shown}</b> · Correct: <b data-current-correct>${stats.correct}</b> · <b data-current-accuracy>${getAccuracy(stats)}%</b></span></div><button type="button" class="quiz-grade-button correct ${quizState.answered === 'correct' ? 'selected' : ''}" data-quiz-answer="correct" ${quizState.answered ? 'disabled' : ''} aria-label="I know this word"><span aria-hidden="true">✓</span> OK</button></div><div class="quiz-keyboard-hint">Space: flip · ↑ know · ↓ don't know · ←/→ change card</div></section>`;
    drawModeSettings();
    const audio = content.querySelector('[data-quiz-audio-player]');
    const audioButton = content.querySelector('[data-quiz-audio]');
    audio?.addEventListener('play', () => audioButton?.classList.add('playing'));
    audio?.addEventListener('pause', () => audioButton?.classList.remove('playing'));
    audio?.addEventListener('ended', () => audioButton?.classList.remove('playing'));
  }

  function changeQuizCard(change) {
    if (quizState.advanceTimer) {
      clearTimeout(quizState.advanceTimer);
      quizState.advanceTimer = null;
    }
    const words = getQuizVocabulary();
    if (!words.length) {
      quizState.currentChinese = null;
      draw();
      return;
    }
    const currentIndex = words.findIndex((word) => word.chinese === quizState.currentChinese);
    quizState.index = currentIndex >= 0
      ? (currentIndex + change + words.length) % words.length
      : change > 0
        ? quizState.index % words.length
        : (quizState.index - 1 + words.length) % words.length;
    quizState.flipped = false;
    quizState.answered = null;
    quizState.needsViewRecord = true;
    draw();
  }

  function handleNavigation(event) {
    const listening = event.target.closest('[data-listening]');
    if (listening) {
      activePersonalListId = personalLists[personalLists.length - 1].id;
      currentLesson = 'listening';
      expandedLesson = null;
      resetListeningHints();
      draw();
      return;
    }
    const reading = event.target.closest('[data-reading]');
    if (reading) {
      currentLesson = 'reading';
      expandedLesson = null;
      draw();
      return;
    }
    const settings = event.target.closest('[data-settings]');
    if (settings) {
      currentLesson = 'settings';
      expandedLesson = null;
      draw();
      return;
    }
    const quiz = event.target.closest('[data-quiz]');
    if (quiz) {
      activePersonalListId = personalLists[personalLists.length - 1].id;
      currentLesson = 'quiz';
      expandedLesson = null;
      resetQuizSession(null);
      draw();
      return;
    }
    const vocabulary = event.target.closest('[data-vocabulary]');
    if (vocabulary) {
      currentLesson = 'vocabulary';
      expandedLesson = null;
      draw();
      return;
    }
    const midterm = event.target.closest('[data-midterm]');
    if (midterm) {
      currentLesson = midterm.dataset.midterm;
      expandedLesson = null;
      draw();
      return;
    }
    const option = event.target.closest('[data-lesson-select]');
    if (option) {
      currentLesson = Number(option.dataset.lessonSelect);
      currentPart = option.dataset.part;
      expandedLesson = currentLesson;
      draw();
      return;
    }
    const toggle = event.target.closest('[data-lesson-toggle]');
    if (!toggle) return;
    const lesson = Number(toggle.dataset.lessonToggle);
    const willExpand = expandedLesson !== lesson;
    expandedLesson = willExpand ? lesson : null;
    if (willExpand && currentLesson !== lesson) {
      currentLesson = lesson;
      currentPart = 'dialog1';
    }
    draw();
  }

  nav.addEventListener('click', handleNavigation);
  toolsNav.addEventListener('click', handleNavigation);
  document.getElementById('settingsNav').addEventListener('click', handleNavigation);
  document.getElementById('themeToggle').addEventListener('click', () => {
    appSettings.darkMode = !appSettings.darkMode;
    saveSettings();
    applyTheme();
  });
  document.getElementById('homeButton').addEventListener('click', () => {
    currentLesson = 'vocabulary';
    expandedLesson = null;
    draw();
  });

  document.querySelector('.shell').addEventListener('submit', (event) => {
    if (event.target.matches('[data-personal-create]')) {
      event.preventDefault();
      const name = String(new FormData(event.target).get('listName') || '').trim().slice(0, 80);
      if (!name) return;
      const previousId = activePersonalListId;
      const list = { id: crypto.randomUUID(), name, items: [], createdAt: Date.now() };
      personalLists.push(list);
      activePersonalListId = list.id;
      if (!persistPersonalList()) { personalLists.pop(); activePersonalListId = previousId; return; }
      Object.keys(rowHintState).forEach((key) => { delete rowHintState[key]; });
      draw();
      return;
    }
    if (!event.target.matches('[data-personal-rename]')) return;
    event.preventDefault();
    const name = new FormData(event.target).get('listName').trim();
    if (!name) return;
    const previous = getPersonalList().name;
    getPersonalList().name = name.slice(0, 80);
    if (!persistPersonalList()) getPersonalList().name = previous;
    draw();
  });

  document.querySelector('[data-vocabulary-search-clear]').addEventListener('click', () => {
    updateVocabularySearch('');
    document.querySelector('[data-vocabulary-search]').focus();
  });

  document.querySelector('.vocabulary-search').addEventListener('input', (event) => {
    if (event.target.matches('[data-vocabulary-search]') && !event.isComposing) updateVocabularySearch(event.target.value);
  });
  document.querySelector('.vocabulary-search').addEventListener('compositionend', (event) => {
    if (event.target.matches('[data-vocabulary-search]')) updateVocabularySearch(event.target.value);
  });

  document.querySelector('.shell').addEventListener('change', (event) => {
    for (const mode of ['vocabulary', 'quiz']) {
      const source = event.target.closest(`[data-${mode}-scope]`);
      const lesson = event.target.closest(`[data-${mode}-scope-lesson]`);
      if (!source && !lesson) continue;
      const selected = mode === 'vocabulary' ? new Set(Object.keys(vocabularyFilterState).filter((key) => vocabularyFilterState[key])) : new Set(quizState.sourceKeys === null ? materialSources().map((item) => item.key) : quizState.sourceKeys.flatMap((key) => /^lesson\d+$/.test(key) ? [`${key.slice(6)}-dialog1`, `${key.slice(6)}-dialog2`] : [key]));
      const keys = source ? [source.dataset[`${mode}Scope`]] : [1, 2].map((dialog) => `${lesson.dataset[`${mode}ScopeLesson`]}-dialog${dialog}`);
      keys.forEach((key) => event.target.checked ? selected.add(key) : selected.delete(key));
      if (mode === 'quiz') resetQuizSession([...selected], quizState.materialType);
      else {
        Object.keys(vocabularyFilterState).forEach((key) => { vocabularyFilterState[key] = selected.has(key); });
        Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      }
      draw();
      return;
    }

    if (event.target.matches('[data-personal-list-select]')) {
      if (!personalLists.some((list) => list.id === event.target.value)) return;
      const selectedWord = content.querySelector('[data-listening-word-menu]:not([hidden]) strong')?.textContent;
      activePersonalListId = event.target.value;
      Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      draw();
      if (selectedWord) Array.from(content.querySelectorAll('[data-listening-word]')).find((button) => button.dataset.listeningWord === selectedWord)?.click();
      return;
    }
    if (event.target.matches('[data-personal-filter]')) {
      personalListOnly = event.target.checked;
      Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      draw();
      return;
    }
    if (event.target.matches('[data-listening-unlearned]')) {
      listeningState.unlearnedOnly = event.target.checked;
      listeningState.index = 0;
      resetListeningHints();
      drawListening();
      return;
    }
    const listeningSource = event.target.closest('[data-listening-scope]');
    if (listeningSource) {
      listeningScope[listeningSource.dataset.listeningScope] = listeningSource.checked;
      listeningState.index = 0;
      listeningState.transitionDirection = 0;
      resetListeningHints();
      drawListening();
      return;
    }
    const setting = event.target.closest('[data-setting]');
    if (setting) {
      appSettings[setting.dataset.setting] = setting.checked;
      if (setting.dataset.setting === 'quizEnglishFirst') quizState.flipped = false;
      saveSettings();
      if (setting.dataset.setting === 'listeningChinese') resetListeningHints();
      applyTheme();
      if (setting.dataset.setting === 'listPinyin' || setting.dataset.setting === 'listEnglish') {
        hintState['vocabulary-all'] = { pinyin: appSettings.listPinyin, english: appSettings.listEnglish };
        Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      }
      draw();
      return;
    }
    const unansweredOnly = event.target.closest('[data-quiz-unanswered]');
    if (unansweredOnly) {
      quizState.unansweredOnly = unansweredOnly.checked;
      resetQuizSession(quizState.sourceKeys, quizState.materialType, quizState.searchQuery);
      draw();
      return;
    }
    const filter = event.target.closest('[data-vocabulary-filter]');
    if (!filter) return;
    vocabularyFilterState[filter.dataset.vocabularyFilter] = filter.checked;
    Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
    draw();
  });

  document.querySelector('.shell').addEventListener('click', (event) => {
    const dialogueAction = event.target.closest('[data-dialogue-action]');
    if (dialogueAction) {
      handleDialogueAction(dialogueAction);
      return;
    }
    const characterZoom = event.target.closest('[data-character-zoom]');
    if (characterZoom) {
      openCharacterZoom(characterZoom.dataset.characterZoom, characterZoom.dataset.characterLang);
      return;
    }
    for (const mode of ['vocabulary', 'quiz']) {
      const selection = event.target.closest(`[data-${mode}-scope-select]`);
      if (!selection) continue;
      const all = selection.dataset[`${mode}ScopeSelect`] === 'all';
      if (mode === 'quiz') resetQuizSession(all ? materialSources().map((source) => source.key) : [], quizState.materialType);
      else Object.keys(vocabularyFilterState).forEach((key) => { vocabularyFilterState[key] = all; });
      draw();
      return;
    }

    const type = event.target.closest('[data-vocabulary-type]');
    if (type && ['all', 'word', 'expression'].includes(type.dataset.vocabularyType)) {
      vocabularyType = type.dataset.vocabularyType;
      Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      draw();
      return;
    }
    const sort = event.target.closest('[data-vocabulary-sort]');
    if (sort) {
      const key = sort.dataset.vocabularySort;
      if (!['lesson', 'shown', 'answered', 'correct', 'accuracy'].includes(key)) return;
      vocabularySort.direction = vocabularySort.key === key && vocabularySort.direction === 'asc' ? 'desc' : 'asc';
      vocabularySort.key = key;
      Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      draw();
      return;
    }
    const scopeSelection = event.target.closest('[data-listening-select]');
    if (scopeSelection) {
      const selected = scopeSelection.dataset.listeningSelect === 'all';
      Object.keys(listeningScope).forEach((key) => { listeningScope[key] = selected; });
      listeningState.index = 0;
      listeningState.transitionDirection = 0;
      resetListeningHints();
      drawListening();
      return;
    }
    const grade = event.target.closest('[data-listening-grade]');
    if (grade) {
      gradeListeningItem(grade.dataset.listeningGrade);
      return;
    }
    const wordChoice = event.target.closest('[data-listening-word]');
    if (wordChoice) {
      const word = saveableItems.get(wordChoice.dataset.listeningWord);
      const menu = content.querySelector('[data-listening-word-menu]');
      if (!word || !menu) return;
      menu.hidden = false;
      menu.innerHTML = `<strong lang="${chineseLang()}">${chineseHtml(word.chinese)}</strong><span lang="zh-Latn-pinyin">${escapeHtml(word.pinyin)}</span><span>${escapeHtml(word.english || 'Translation unavailable in course vocabulary.')}</span>${renderSaveButton(word)}${renderPersonalListPicker()}<button type="button" class="filter-action" data-close-word-menu>Close</button>`;
      content.querySelectorAll('[data-listening-word]').forEach((button) => button.classList.toggle('selected', button === wordChoice));
      return;
    }
    if (event.target.closest('[data-close-word-menu]')) {
      content.querySelector('[data-listening-word-menu]').hidden = true;
      content.querySelectorAll('[data-listening-word]').forEach((button) => button.classList.remove('selected'));
      return;
    }
    const saveButton = event.target.closest('[data-personal-save]');
    if (saveButton) {
      const chinese = saveButton.dataset.personalSave;
      const previous = [...getPersonalList().items];
      const index = getPersonalList().items.findIndex((item) => item.chinese === chinese);
      if (index >= 0) getPersonalList().items.splice(index, 1);
      else {
        const item = saveableItems.get(chinese);
        if (!item) return;
        getPersonalList().items.push({ id: item.id || materialCatalog.idForChinese(item.chinese), chinese: item.chinese, pinyin: item.pinyin || '', english: item.english || '', audio: item.audio || '', materialType: item.materialType || (collectVocabulary().find((word) => word.chinese === item.chinese)?.materialType) || 'expression' });
      }
      if (!persistPersonalList()) getPersonalList().items = previous;
      if (currentLesson === 'vocabulary') {
        Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      }
      draw();
      return;
    }
    const listeningKind = event.target.closest('[data-listening-kind]');
    if (listeningKind) {
      const kind = listeningKind.dataset.listeningKind;
      if (!['sentences', 'words'].includes(kind) || kind === listeningState.kind) return;
      listeningState.kind = kind;
      listeningState.index = 0;
      listeningState.transitionDirection = 0;
      resetListeningHints();
      drawListening();
      return;
    }

    const wordAudio = event.target.closest('[data-word-audio]');
    if (wordAudio) {
      if (dialoguePlayback.playing) stopDialogueAudio();
      stopMaterialAudio();
      content.querySelectorAll('[data-word-audio-player]').forEach((audio) => { audio.pause(); });
      const player = wordAudio.closest('.subsection-body')?.querySelector('[data-word-audio-player]') || content.querySelector('[data-word-audio-player]');
      if (player) {
        materialPlayer = player;
        player.pause();
        player.src = wordAudio.dataset.wordAudio;
        player.defaultPlaybackRate = 1;
        player.playbackRate = 1;
        player.play().catch(() => {});
      }
      return;
    }

    if (event.target.closest('[data-listening-random]')) {
      const items = getListeningItems();
      if (items.length < 2) return;
      // Sample every other item equally, without repeating the current sentence.
      const offset = 1 + Math.floor(Math.random() * (items.length - 1));
      listeningState.index = (listeningState.index + offset) % items.length;
      listeningState.transitionDirection = 1;
      resetListeningHints();
      drawListening();
      return;
    }

    const listeningNavigation = event.target.closest('[data-listening-nav]');
    if (listeningNavigation && !listeningNavigation.disabled) {
      changeListeningItem(Number(listeningNavigation.dataset.listeningNav));
      return;
    }
    if (event.target.closest('[data-listening-slow]')) {
      const audio = content.querySelector('[data-listening-audio]');
      if (!audio) return;
      audio.pause();
      audio.playbackRate = 0.75;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    const listeningPlay = event.target.closest('[data-listening-play]');
    if (listeningPlay) {
      const audio = content.querySelector('[data-listening-audio]');
      if (!audio) return;
      if (audio.paused || audio.playbackRate !== 1) {
        audio.playbackRate = 1;
        if (audio.ended) audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
      return;
    }
    const listeningReveal = event.target.closest('[data-listening-reveal]');
    if (listeningReveal) {
      listeningState.revealStage = (listeningState.revealStage + 1) % 3;
      drawListening();
      return;
    }
    const readingChoice = event.target.closest('[data-reading-passage]');
    if (readingChoice) {
      selectedReading = Number(readingChoice.dataset.readingPassage);
      draw();
      return;
    }
    const filteredQuiz = event.target.closest('[data-start-filtered-quiz]');
    if (filteredQuiz && !filteredQuiz.disabled) {
      const selectedSources = personalListOnly ? [`personal:${activePersonalListId}`] : Object.keys(vocabularyFilterState).filter((key) => vocabularyFilterState[key]);
      activePersonalListId = personalLists[personalLists.length - 1].id;
      currentLesson = 'quiz';
      expandedLesson = null;
      resetQuizSession(selectedSources, vocabularyType, vocabularySearch);
      draw();
      return;
    }
    const filterSelection = event.target.closest('[data-vocabulary-select]');
    if (filterSelection) {
      const checked = filterSelection.dataset.vocabularySelect === 'all';
      Object.keys(vocabularyFilterState).forEach((key) => { vocabularyFilterState[key] = checked; });
      Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      draw();
      return;
    }
    const quizNavigation = event.target.closest('[data-quiz-nav]');
    if (quizNavigation) {
      changeQuizCard(Number(quizNavigation.dataset.quizNav));
      return;
    }
    const quizAudio = event.target.closest('[data-quiz-audio]');
    if (quizAudio) {
      const audio = content.querySelector('[data-quiz-audio-player]');
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    const quizAnswer = event.target.closest('[data-quiz-answer]');
    if (quizAnswer && !quizState.answered && quizState.currentChinese) {
      const stats = getWordStats(quizState.currentChinese);
      quizState.answered = quizAnswer.dataset.quizAnswer;
      stats.answered += 1;
      if (quizState.answered === 'correct') stats.correct += 1;
      saveQuizStats();
      content.querySelectorAll('[data-quiz-answer]').forEach((button) => {
        button.disabled = true;
        button.classList.toggle('selected', button.dataset.quizAnswer === quizState.answered);
      });
      const status = content.querySelector('.quiz-grade-status strong');
      if (status) status.textContent = quizState.answered === 'correct' ? 'Marked as known' : 'Marked for more practice';
      const shownValue = content.querySelector('[data-current-shown]');
      const correctValue = content.querySelector('[data-current-correct]');
      const accuracyValue = content.querySelector('[data-current-accuracy]');
      if (shownValue) shownValue.textContent = stats.shown;
      if (correctValue) correctValue.textContent = stats.correct;
      if (accuracyValue) accuracyValue.textContent = `${getAccuracy(stats)}%`;
      if (appSettings.autoAdvance) {
        const answeredChinese = quizState.currentChinese;
        quizState.advanceTimer = window.setTimeout(() => {
          if (currentLesson === 'quiz' && quizState.currentChinese === answeredChinese && quizState.answered) changeQuizCard(1);
        }, 450);
      }
      return;
    }
    const flashcard = event.target.closest('[data-flashcard-flip]');
    if (flashcard) {
      quizState.flipped = !quizState.flipped;
      flashcard.classList.toggle('flipped', quizState.flipped);
      flashcard.setAttribute('aria-pressed', String(quizState.flipped));
      return;
    }
    const row = event.target.closest('[data-hint-row]');
    if (row) {
      const rowKey = row.dataset.hintRow;
      const current = rowHintState[rowKey] || {
        pinyin: row.dataset.pinyinDefault === 'true',
        english: row.dataset.englishDefault === 'true'
      };
      rowHintState[rowKey] = !current.pinyin && !current.english
        ? { pinyin: true, english: false }
        : current.pinyin && !current.english
          ? { pinyin: true, english: true }
          : { pinyin: false, english: false };
      draw();
      return;
    }
    const expand = event.target.closest('[data-expand]');
    if (expand) {
      const key = expand.dataset.expand;
      const willOpen = !(openState[key] ?? false);
      Object.keys(openState).forEach((openKey) => { openState[openKey] = false; });
      openState[key] = willOpen;
      draw();
      return;
    }
    const toggle = event.target.closest('[data-toggle]');
    if (!toggle) return;
    const key = toggle.dataset.key;
    hintState[key] ||= { pinyin: false, english: false };
    hintState[key][toggle.dataset.toggle] = !hintState[key][toggle.dataset.toggle];
    Object.keys(rowHintState).filter((rowKey) => rowKey.startsWith(`${key}-`)).forEach((rowKey) => { delete rowHintState[rowKey]; });
    draw();
  });

  content.addEventListener('keydown', (event) => {
    if (event.target.closest('[data-dialogue-action], [data-character-zoom], [data-word-audio], [data-personal-save], [data-listening-word], [data-close-word-menu], [data-listening-grade], [data-listening-slow]')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-hint-row]');
    if (!row) return;
    event.preventDefault();
    row.click();
  });

  document.querySelector('.shell').addEventListener('keydown', (event) => {
    if (event.target.matches('[data-listening-reveal]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      event.target.click();
    }
    if (event.key === 'Escape') content.querySelector('[data-close-word-menu]')?.click();
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
    if (!isArrow && event.target.closest('[data-dialogue-action], [data-character-zoom], [data-word-audio], [data-personal-save], [data-listening-word], [data-close-word-menu], [data-listening-grade], [data-listening-slow]')) return;
    if (currentLesson === 'listening') {
      const isSpace = event.code === 'Space';
      const isNavigation = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const isReveal = event.key === 'ArrowUp';
      if (!isSpace && !isNavigation && !isReveal) return;
      if ((isSpace || isReveal) && event.repeat) return;
      event.preventDefault();
      if (isSpace) {
        content.querySelector('[data-listening-play]')?.click();
      } else if (isReveal) {
        content.querySelector('[data-listening-reveal]')?.click();
      } else {
        content.querySelector(`[data-listening-nav="${event.key === 'ArrowLeft' ? -1 : 1}"]:not(:disabled)`)?.click();
      }
      return;
    }
    if (currentLesson !== 'quiz') return;
    const isSpace = event.code === 'Space';
    const isNavigation = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const isAnswer = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    if (!isSpace && !isNavigation && !isAnswer) return;
    if ((isSpace || isAnswer) && event.repeat) return;
    event.preventDefault();
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    if (isSpace) {
      content.querySelector('[data-flashcard-flip]')?.click();
    } else if (isAnswer) {
      const answer = event.key === 'ArrowUp' ? 'correct' : 'incorrect';
      content.querySelector(`[data-quiz-answer="${answer}"]:not(:disabled)`)?.click();
    } else {
      changeQuizCard(event.key === 'ArrowLeft' ? -1 : 1);
    }
    window.scrollTo(scrollLeft, scrollTop);
    requestAnimationFrame(() => window.scrollTo(scrollLeft, scrollTop));
  });

  document.getElementById('hideAll').addEventListener('click', () => {
    if (currentLesson === 'listening') listeningState.revealStage = 0;
    Object.keys(hintState).forEach((key) => { hintState[key] = { pinyin: false, english: false }; });
    Object.keys(rowHintState).forEach((key) => { delete rowHintState[key]; });
    draw();
  });

  draw();
};
