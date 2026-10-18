(() => {
  const database = window.CHINESE_LESSONS || {};
  const midterms = window.CHINESE_MIDTERMS || {};
  const lessonCount = 7;
  let currentLesson = 'home';
  let currentPart = 'dialog1';
  let expandedLesson = null;
  const hintState = {};
  const rowHintState = {};
  const openState = {};
  const quizState = { index: 0, flipped: false, front: 'chinese', unansweredOnly: false, needsViewRecord: false, answered: null, currentChinese: null, advanceTimer: null, order: [], sourceKeys: null };
  const quizStatsStorageKey = 'chinese-exam-quiz-stats-v3';
  const settingsStorageKey = 'chinese-exam-settings-v1';
  const vocabularyFilterState = Object.fromEntries([
    ...Array.from({ length: lessonCount }, (_, index) => `lesson${index + 1}`),
    'midterm1',
    'midterm2'
  ].map((source) => [source, true]));
  const readingPassage = {
    title: '我的週末',
    paragraphs: [
      '我現在在臺灣學中文。我的學校在山上，前面有海，後面有山，風景真的很漂亮。學校附近有圖書館、咖啡店和幾家餐廳，所以生活很方便。',
      '週末早上，我常和朋友一起去學校打籃球。有時候我們也踢足球或游泳。中午，我們去一家有名的牛肉麵店吃飯。那裡的牛肉麵和小籠包都很好吃，而且不太貴。我最喜歡喝熱茶，朋友比較喜歡喝咖啡。',
      '下午，我常到圖書館看書、寫字和學書法。晚上如果有空，我會和朋友去看電影或唱歌。這個週末，朋友想去大安的KTV，但是我得先去銀行。我們約晚上七點在咖啡店見面，吃完晚飯再一起去唱歌。',
      '我覺得在臺灣學中文很有意思。雖然每天都很忙，可是我認識了很多朋友，也學會了說中文、看中文和寫中文字。'
    ]
  };
  const nav = document.getElementById('lessonNav');
  const toolsNav = document.getElementById('studyToolsNav');
  const content = document.getElementById('content');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const appSettings = (() => {
    const defaults = { darkMode: false, autoAdvance: true, listPinyin: false, listEnglish: false };
    try {
      const saved = JSON.parse(localStorage.getItem(settingsStorageKey) || '{}');
      return { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch {
      return defaults;
    }
  })();
  const quizStats = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(quizStatsStorageKey) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  })();

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
  }

  applyTheme();

  function getWordStats(chinese) {
    quizStats[chinese] ||= { shown: 0, correct: 0 };
    return quizStats[chinese];
  }

  function getAccuracy(stats) {
    return stats.shown ? Math.round((stats.correct / stats.shown) * 100) : 0;
  }
  const pinyinSyllables = new Set(`a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu ca cai can cang cao ce cen ceng ci cong cou cu cuan cui cun cuo cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo da dai dan dang dao de dei den deng di dia dian diang diao die ding diu dong dou du duan dui dun duo e ei en eng er fa fan fang fei fen feng fo fou fu ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo ha hai han hang hao he hei hen heng hong hou hu hua huai huan huang hui hun huo ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke ken keng kong kou ku kua kuai kuan kuang kui kun kuo la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu long lou lu luan lue lun luo lv ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu na nai nan nang nao ne nei nen neng ni nian niang niao nie nin ning niu nong nou nu nuan nue nuo nv o ou pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun ran rang rao re ren reng ri rong rou ru rua ruan rui run ruo sa sai san sang sao se sen seng si song sou su suan sui sun suo sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo wa wai wan wang wei wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun za zai zan zang zao ze zei zen zeng zi zong zou zu zuan zui zun zuo zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo`.split(' '));

  function splitPinyinWord(word) {
    const letters = Array.from(word);
    const plain = letters.map((letter) => letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).join('').replaceAll('ü', 'v');
    const memo = new Map();
    function splitFrom(position) {
      if (position === plain.length) return [];
      if (memo.has(position)) return memo.get(position);
      for (let end = plain.length; end > position; end--) {
        if (!pinyinSyllables.has(plain.slice(position, end))) continue;
        const rest = splitFrom(end);
        if (rest) {
          const result = [letters.slice(position, end).join(''), ...rest];
          memo.set(position, result);
          return result;
        }
      }
      memo.set(position, null);
      return null;
    }
    return splitFrom(0) || [word];
  }

  function renderRuby(chinese, pinyin) {
    const characters = Array.from(String(chinese ?? ''));
    const hanCount = characters.filter((character) => /\p{Script=Han}/u.test(character)).length;
    const pinyinText = String(pinyin ?? '');
    const alignmentText = pinyinText.includes('/') ? pinyinText.split('/')[0].trim() : pinyinText;
    const syllables = (alignmentText
      .replace(/[’']/g, ' ')
      .match(/\p{L}+/gu)?.filter((token) => token !== token.toUpperCase()) || [])
      .flatMap(splitPinyinWord);
    if (!hanCount || syllables.length !== hanCount) return null;
    if (hanCount === 1 && pinyinText.includes('/')) syllables[0] = pinyinText;
    let syllableIndex = 0;
    return characters.map((character) => {
      if (!/\p{Script=Han}/u.test(character)) return escapeHtml(character);
      const syllable = syllables[syllableIndex++];
      return `<ruby>${escapeHtml(character)}<rt>${escapeHtml(syllable)}</rt></ruby>`;
    }).join('');
  }

  function drawNav() {
    const lessons = Array.from({ length: lessonCount }, (_, index) => {
      const lesson = index + 1;
      const isExpanded = expandedLesson === lesson;
      const isCurrent = lesson === currentLesson;
      const parts = ['dialog1', 'dialog2'].map((part, partIndex) => {
        const data = database[`${lesson}-${part}`];
        const isSelected = isCurrent && currentPart === part;
        return `<button type="button" class="dialog-link ${isSelected ? 'active' : ''}" data-lesson-select="${lesson}" data-part="${part}" aria-current="${isSelected ? 'page' : 'false'}"><span>Dialog ${partIndex + 1}</span><small>${data?.title ? escapeHtml(data.title) : 'Not added yet'}</small></button>`;
      }).join('');
      return `<div class="lesson-group ${isExpanded ? 'open' : ''}"><button type="button" class="lesson-link lesson-toggle ${isCurrent ? 'active' : ''}" data-lesson-toggle="${lesson}" aria-expanded="${isExpanded}" aria-controls="lesson-options-${lesson}"><span>Lesson ${lesson}</span><span class="nav-chevron" aria-hidden="true">⌄</span></button><div class="lesson-options" id="lesson-options-${lesson}" ${isExpanded ? '' : 'hidden'}>${parts}</div></div>`;
    }).join('');
    const vocabularyLink = `<button type="button" class="lesson-link vocabulary-link ${currentLesson === 'vocabulary' ? 'active' : ''}" data-vocabulary="true" aria-current="${currentLesson === 'vocabulary' ? 'page' : 'false'}">All words &amp; expressions<span class="mini">字</span></button>`;
    const quizLink = `<button type="button" class="lesson-link quiz-link ${currentLesson === 'quiz' ? 'active' : ''}" data-quiz="true" aria-current="${currentLesson === 'quiz' ? 'page' : 'false'}">Flashcard quiz<span class="mini">↻</span></button>`;
    const readingLink = `<button type="button" class="lesson-link reading-link ${currentLesson === 'reading' ? 'active' : ''}" data-reading="true" aria-current="${currentLesson === 'reading' ? 'page' : 'false'}">Reading<span class="mini">文</span></button>`;
    const settingsLink = `<button type="button" class="lesson-link settings-link ${currentLesson === 'settings' ? 'active' : ''}" data-settings="true" aria-current="${currentLesson === 'settings' ? 'page' : 'false'}">Settings<span class="mini">⚙</span></button>`;
    const midtermLinks = [1, 2].map((number) => {
      const key = `midterm${number}`;
      const isCurrent = currentLesson === key;
      return `<button type="button" class="lesson-link midterm-link ${isCurrent ? 'active' : ''}" data-midterm="${key}" aria-current="${isCurrent ? 'page' : 'false'}">Mid Term Questions ${number}<span class="mini">◆</span></button>`;
    }).join('');
    nav.innerHTML = lessons + midtermLinks;
    toolsNav.innerHTML = vocabularyLink + quizLink + readingLink + settingsLink;
  }

  function renderLines(lines, key) {
    const hints = hintState[key] || { pinyin: false, english: false };
    return `<div class="toolbar"><button class="toggle ${hints.pinyin ? 'active' : ''}" type="button" data-toggle="pinyin" data-key="${key}" aria-pressed="${hints.pinyin}">Pinyin ${hints.pinyin ? '✓' : '+'}</button><button class="toggle ${hints.english ? 'active' : ''}" type="button" data-toggle="english" data-key="${key}" aria-pressed="${hints.english}">English ${hints.english ? '✓' : '+'}</button><span class="hint">Click a row: Pinyin → both → hide</span></div>${lines.map((item, index) => {
      const rowKey = `${key}-${index}`;
      const rowHints = rowHintState[rowKey] || hints;
      const showPinyin = rowHints.pinyin;
      const showEnglish = rowHints.english;
      const ruby = showPinyin ? renderRuby(item.chinese, item.pinyin) : null;
      return `<div class="line clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><div><div class="speaker">${escapeHtml(item.speaker || '例句')}</div>${showPinyin && item.speakerPinyin ? `<div class="speaker-pinyin">${escapeHtml(item.speakerPinyin)}</div>` : ''}</div><div><div class="hanzi ${ruby ? 'hanzi-ruby' : ''}" lang="zh-Hant">${ruby || escapeHtml(item.chinese)}</div>${showPinyin && !ruby ? `<div class="pinyin">${escapeHtml(item.pinyin)}</div>` : ''}${showEnglish ? `<div class="english">${escapeHtml(item.english)}</div>` : ''}</div></div>`;
    }).join('')}`;
  }

  function renderSubsection(label, lines, key, defaultOpen = false) {
    const opened = openState[key] ?? defaultOpen;
    return `<div class="subsection ${opened ? 'open' : ''}"><button class="subsection-head" type="button" data-expand="${key}" aria-expanded="${opened}"><span>${label}<small>${lines.length ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : 'Not added yet'}</small></span><span class="chevron" aria-hidden="true">⌄</span></button>${opened ? `<div class="subsection-body">${lines.length ? renderLines(lines, key) : '<div class="empty">Material will appear here when its screenshot is added.</div>'}</div>` : ''}</div>`;
  }

  function renderWords(words, key, options = {}) {
    const showStats = options.showStats ?? false;
    const hints = hintState[key] || { pinyin: false, english: false };
    const statsHeader = showStats ? '<div class="word-stats-head"><span>#</span><span>Word or expression</span><span>Hints</span><span>Shown</span><span>Correct</span><span>Accuracy</span></div>' : '';
    return `<div class="toolbar"><button class="toggle ${hints.pinyin ? 'active' : ''}" type="button" data-toggle="pinyin" data-key="${key}" aria-pressed="${hints.pinyin}">Pinyin ${hints.pinyin ? '✓' : '+'}</button><button class="toggle ${hints.english ? 'active' : ''}" type="button" data-toggle="english" data-key="${key}" aria-pressed="${hints.english}">English ${hints.english ? '✓' : '+'}</button><span class="hint">Click a row: Pinyin → both → hide</span></div>${statsHeader}<div class="word-list">${words.map((word, index) => {
      const rowKey = `${key}-${index}`;
      const rowHints = rowHintState[rowKey] || hints;
      const showPinyin = rowHints.pinyin;
      const showEnglish = rowHints.english;
      const ruby = showPinyin ? renderRuby(word.chinese, word.pinyin) : null;
      if (showStats) {
        const stats = getWordStats(word.chinese);
        const hintsContent = `${showPinyin && !ruby ? `<span class="word-pinyin">${escapeHtml(word.pinyin)}</span>` : ''}${showEnglish ? `<span class="word-english">${word.partOfSpeech ? `<small>(${escapeHtml(word.partOfSpeech)})</small>` : ''}${escapeHtml(word.english)}</span>` : ''}`;
        return `${word.category ? `<div class="word-category">${escapeHtml(word.category)}</div>` : ''}<div class="word-row word-row-with-stats clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><span class="word-number">${index + 1}</span><span class="word-hanzi ${ruby ? 'word-hanzi-ruby' : ''}" lang="zh-Hant">${ruby || escapeHtml(word.chinese)}</span><span class="word-details">${hintsContent}</span><span class="word-stat" data-stat-label="Shown">${stats.shown}</span><span class="word-stat" data-stat-label="Correct">${stats.correct}</span><span class="word-stat word-accuracy" data-stat-label="Accuracy">${getAccuracy(stats)}%</span></div>`;
      }
      return `${word.category ? `<div class="word-category">${escapeHtml(word.category)}</div>` : ''}<div class="word-row clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><span class="word-number">${index + 1}</span><span class="word-hanzi ${ruby ? 'word-hanzi-ruby' : ''}" lang="zh-Hant">${ruby || escapeHtml(word.chinese)}</span>${showPinyin && !ruby ? `<span class="word-pinyin">${escapeHtml(word.pinyin)}</span>` : ''}${showEnglish ? `<span class="word-english">${word.partOfSpeech ? `<small>(${escapeHtml(word.partOfSpeech)})</small>` : ''}${escapeHtml(word.english)}</span>` : ''}</div>`;
    }).join('')}</div>`;
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
    drawNav();
    const isHome = currentLesson === 'home';
    document.getElementById('hideAll').hidden = isHome;
    document.getElementById('sourceFootnote').hidden = isHome;
    if (isHome) {
      drawHome();
      return;
    }
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
    content.innerHTML = `<section class="section"><div class="section-head static-head"><span class="section-heading"><span class="section-num">0${dialogNumber}</span><span><span class="section-title">Dialog ${dialogNumber}</span><span class="section-meta">${data?.title ? escapeHtml(data.title) : 'Not added yet'}</span></span></span></div><div class="dialog-content">${renderSubsection('Dialogue', dialogue, `${key}-dialogue`, true)}${renderSupplement(data, `${key}-supplement`)}${(data?.screenshots || []).map((path, screenshotIndex) => `<a class="source-link" href="${encodeURI(path)}" target="_blank" rel="noopener">↗ View original screenshot ${screenshotIndex + 1}</a>`).join(' ')}${(data?.sources || []).map((source) => `<a class="source-link" href="${encodeURI(source.path)}" target="_blank" rel="noopener">↗ ${escapeHtml(source.label)}</a>`).join(' ')}</div></section>`;
  }

  function drawHome() {
    document.getElementById('lessonTitle').textContent = 'Welcome';
    content.innerHTML = `<section class="welcome-card"><div class="welcome-hero"><span class="welcome-symbol" aria-hidden="true">中文</span><div><div class="subtle">HOW TO USE THIS WEBSITE</div><h3>Study at your own pace</h3><p>Choose a lesson, reveal only the hints you need, and use the quiz to practise difficult words.</p></div></div><div class="welcome-steps"><article><span>1</span><h4>Choose material</h4><p>Open one lesson on the left, or select vocabulary, quiz, reading, or settings above.</p></article><article><span>2</span><h4>Reveal hints</h4><p>Click a sentence or word once for Pinyin, twice for Pinyin and English, and again to hide both.</p></article><article><span>3</span><h4>Practise with cards</h4><p>Flip flashcards, mark your answer with OK or X, and track your results in the complete word list.</p></article><article><span>4</span><h4>Filter your study</h4><p>In the word list, select only the lessons you want and start a quiz from the current filters.</p></article></div></section>`;
  }

  function drawMidterm() {
    const data = midterms[currentLesson];
    document.getElementById('lessonTitle').textContent = data.title;
    content.innerHTML = `<section class="midterm-intro"><div class="subtle">${escapeHtml(data.subtitle)}</div><p>${escapeHtml(data.instructions)}</p></section>${data.sections.map((section, index) => renderSubsection(section.title, section.questions, `${currentLesson}-section-${index + 1}`)).join('')}<div class="midterm-followup"><strong>Follow-up:</strong> ${escapeHtml(data.followUps)}</div><a class="source-link" href="${encodeURI(data.source)}" target="_blank" rel="noopener">↗ View original PDF</a>`;
  }

  function collectVocabulary() {
    const seen = new Map();
    const vocabulary = [];
    for (let lesson = 1; lesson <= lessonCount; lesson++) {
      for (let dialog = 1; dialog <= 2; dialog++) {
        const words = database[`${lesson}-dialog${dialog}`]?.words || [];
        words.forEach((word) => {
          const source = `lesson${lesson}`;
          const existing = seen.get(word.chinese);
          if (existing) {
            if (!existing.sources.includes(source)) existing.sources.push(source);
            return;
          }
          const item = {
            ...word,
            category: '',
            sources: [source]
          };
          vocabulary.push(item);
          seen.set(word.chinese, item);
        });
      }
    }
    Object.keys(midterms).sort().forEach((midtermKey) => {
      const midterm = midterms[midtermKey];
      midterm.sections.forEach((section) => {
        section.questions.forEach((question) => {
          const existing = seen.get(question.chinese);
          if (existing) {
            if (!existing.sources.includes(midtermKey)) existing.sources.push(midtermKey);
            return;
          }
          const item = {
            chinese: question.chinese,
            pinyin: question.pinyin,
            english: question.english,
            partOfSpeech: 'Question',
            category: '',
            sources: [midtermKey]
          };
          vocabulary.push(item);
          seen.set(question.chinese, item);
        });
      });
    });
    return vocabulary;
  }

  function getFilteredVocabulary(words) {
    const sources = [
      ...Array.from({ length: lessonCount }, (_, index) => ({ key: `lesson${index + 1}`, label: `Lesson ${index + 1}` })),
      { key: 'midterm1', label: 'Mid Term Questions 1' },
      { key: 'midterm2', label: 'Mid Term Questions 2' }
    ];
    const emitted = new Set();
    const filtered = [];
    sources.filter((source) => vocabularyFilterState[source.key]).forEach((source) => {
      let firstInSource = true;
      words.forEach((word) => {
        if (emitted.has(word.chinese) || !word.sources.includes(source.key)) return;
        filtered.push({ ...word, category: firstInSource ? source.label : '' });
        emitted.add(word.chinese);
        firstInSource = false;
      });
    });
    return filtered;
  }

  function drawVocabulary() {
    const words = collectVocabulary();
    const filteredWords = getFilteredVocabulary(words);
    const key = 'vocabulary-all';
    const filters = [
      ...Array.from({ length: lessonCount }, (_, index) => ({ key: `lesson${index + 1}`, label: `Lesson ${index + 1}` })),
      { key: 'midterm1', label: 'Mid Term 1' },
      { key: 'midterm2', label: 'Mid Term 2' }
    ].map((filter) => `<label class="vocabulary-filter"><input type="checkbox" data-vocabulary-filter="${filter.key}" ${vocabularyFilterState[filter.key] ? 'checked' : ''}><span>${filter.label}</span></label>`).join('');
    document.getElementById('lessonTitle').textContent = 'All words & expressions';
    hintState[key] ||= { pinyin: appSettings.listPinyin, english: appSettings.listEnglish };
    content.innerHTML = `<section class="midterm-intro"><div class="subtle">LESSONS 1–7 + MIDTERM QUESTIONS · MASTER VOCABULARY</div><p>Showing ${filteredWords.length} of ${words.length} unique words and expressions. Multi-character expressions stay together; a component is listed separately only when it also appears as an independent vocabulary item.</p></section><fieldset class="vocabulary-filters"><legend>Show content from</legend><div class="vocabulary-filter-actions"><button type="button" class="filter-action" data-vocabulary-select="all">Select all</button><button type="button" class="filter-action" data-vocabulary-select="none">Clear all</button><button type="button" class="filter-action start-filtered-quiz" data-start-filtered-quiz ${filteredWords.length ? '' : 'disabled'}>Quiz selected · ${filteredWords.length}</button></div>${filters}</fieldset><section class="vocabulary-list-panel">${filteredWords.length ? renderWords(filteredWords, key, { showStats: true }) : '<div class="empty">Select at least one lesson or mid-term.</div>'}</section>`;
  }

  function renderSetting(key, title, description) {
    return `<label class="setting-row"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-setting="${key}" ${appSettings[key] ? 'checked' : ''}><span class="setting-switch" aria-hidden="true"></span></label>`;
  }

  function drawSettings() {
    document.getElementById('lessonTitle').textContent = 'Settings';
    content.innerHTML = `<div class="settings-grid"><section class="settings-card"><div class="settings-card-head"><span class="settings-icon">◆</span><div><h3>Quiz</h3><p>Control flashcard behavior.</p></div></div>${renderSetting('autoAdvance', 'Automatic next card', 'Move to the next flashcard after choosing OK or X.')}</section><section class="settings-card"><div class="settings-card-head"><span class="settings-icon">字</span><div><h3>Words & expressions</h3><p>Choose the default hints for the complete list.</p></div></div>${renderSetting('listPinyin', 'Show Pinyin by default', 'Reveal Pinyin when the complete list opens.')}${renderSetting('listEnglish', 'Show English by default', 'Reveal English meanings when the complete list opens.')}</section><section class="settings-card"><div class="settings-card-head"><span class="settings-icon">◐</span><div><h3>General</h3><p>Change the appearance of the whole website.</p></div></div>${renderSetting('darkMode', 'Dark color mode', 'Use darker colors throughout the study interface.')}</section></div>`;
  }

  function drawReading() {
    const characterCount = readingPassage.paragraphs.join('').match(/\p{Script=Han}/gu)?.length || 0;
    document.getElementById('lessonTitle').textContent = 'Reading practice';
    content.innerHTML = `<article class="reading-card"><div class="reading-card-head"><div><div class="subtle">READING PRACTICE · LESSONS 1–7</div><h3 lang="zh-Hant">${escapeHtml(readingPassage.title)}</h3><p class="reading-ai-note">This practice text was generated by AI from the course vocabulary.</p></div><span class="reading-count">${characterCount} characters</span></div><div class="reading-text" lang="zh-Hant">${readingPassage.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div></article>`;
  }

  function renderQuizFace(word, type, side) {
    if (type === 'chinese') {
      return `<span class="flashcard-face flashcard-${side} flashcard-chinese-face"><span class="flashcard-face-label">Chinese</span><span class="flashcard-hanzi" lang="zh-Hant">${escapeHtml(word.chinese)}</span></span>`;
    }
    return `<span class="flashcard-face flashcard-${side} flashcard-answer-face"><span class="flashcard-face-label">English + Pinyin</span><span class="flashcard-english">${escapeHtml(word.english)}</span><span class="flashcard-pinyin">${escapeHtml(word.pinyin)}</span>${word.partOfSpeech ? `<span class="flashcard-pos">${escapeHtml(word.partOfSpeech)}</span>` : ''}</span>`;
  }

  function shuffleWords(words) {
    const shuffled = [...words];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  function resetQuizSession(sourceKeys = null) {
    if (quizState.advanceTimer) clearTimeout(quizState.advanceTimer);
    quizState.index = 0;
    quizState.flipped = false;
    quizState.answered = null;
    quizState.currentChinese = null;
    quizState.needsViewRecord = true;
    quizState.advanceTimer = null;
    quizState.sourceKeys = sourceKeys?.length ? [...sourceKeys] : null;
    quizState.order = [];
  }

  function getQuizVocabulary() {
    let words = collectVocabulary();
    if (quizState.sourceKeys) words = words.filter((word) => word.sources.some((source) => quizState.sourceKeys.includes(source)));
    if (quizState.unansweredOnly) words = words.filter((word) => getWordStats(word.chinese).correct === 0);
    if (!quizState.order.length) quizState.order = shuffleWords(words).map((word) => word.chinese);
    const wordsByChinese = new Map(words.map((word) => [word.chinese, word]));
    const ordered = quizState.order.map((chinese) => wordsByChinese.get(chinese)).filter(Boolean);
    const orderedChinese = new Set(quizState.order);
    return [...ordered, ...shuffleWords(words.filter((word) => !orderedChinese.has(word.chinese)))];
  }

  function drawQuiz() {
    const words = getQuizVocabulary();
    const scope = quizState.sourceKeys ? `Selected filters: ${quizState.sourceKeys.map((source) => source.startsWith('lesson') ? `Lesson ${source.replace('lesson', '')}` : source === 'midterm1' ? 'Mid Term 1' : 'Mid Term 2').join(', ')}` : 'All lessons and mid-terms';
    const filter = `<span class="quiz-scope">${escapeHtml(scope)}</span><label class="quiz-filter"><input type="checkbox" data-quiz-unanswered ${quizState.unansweredOnly ? 'checked' : ''}><span>Only words never answered correctly</span></label>`;
    document.getElementById('lessonTitle').textContent = 'Flashcard quiz';
    if (!words.length) {
      content.innerHTML = `<section class="quiz-panel"><div class="quiz-options">${filter}</div><div class="quiz-complete"><strong>Everything is known!</strong><span>All words have at least one correct answer.</span></div></section>`;
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
    const frontType = quizState.front;
    const backType = frontType === 'chinese' ? 'answer' : 'chinese';
    const isLong = Array.from(word.chinese).length > 14;
    const answerMessage = quizState.answered === 'correct' ? 'Marked as known' : quizState.answered === 'incorrect' ? 'Marked for more practice' : 'Do you know this word?';
    content.innerHTML = `<section class="quiz-panel"><div class="quiz-options">${filter}</div><div class="quiz-mode" role="group" aria-label="Choose the front of each flashcard"><button type="button" class="toggle ${frontType === 'chinese' ? 'active' : ''}" data-quiz-mode="chinese" aria-pressed="${frontType === 'chinese'}">Chinese first</button><button type="button" class="toggle ${frontType === 'answer' ? 'active' : ''}" data-quiz-mode="answer" aria-pressed="${frontType === 'answer'}">English + Pinyin first</button></div><div class="quiz-progress"><strong>${quizState.index + 1}</strong> / ${words.length}<span>Click the card to reveal the other side</span></div><div class="flashcard-stage"><button type="button" class="quiz-arrow" data-quiz-nav="-1" aria-label="Previous flashcard">←</button><button type="button" class="flashcard ${isLong ? 'flashcard-long' : ''} ${quizState.flipped ? 'flipped' : ''}" data-flashcard-flip aria-pressed="${quizState.flipped}" aria-label="Flip flashcard"> <span class="flashcard-inner">${renderQuizFace(word, frontType, 'front')}${renderQuizFace(word, backType, 'back')}</span></button><button type="button" class="quiz-arrow" data-quiz-nav="1" aria-label="Next flashcard">→</button></div><div class="quiz-grade"><button type="button" class="quiz-grade-button incorrect ${quizState.answered === 'incorrect' ? 'selected' : ''}" data-quiz-answer="incorrect" ${quizState.answered ? 'disabled' : ''} aria-label="I do not know this word"><span aria-hidden="true">×</span> X</button><div class="quiz-grade-status"><strong>${answerMessage}</strong><span>Shown: <b data-current-shown>${stats.shown}</b> · Correct: <b data-current-correct>${stats.correct}</b> · <b data-current-accuracy>${getAccuracy(stats)}%</b></span></div><button type="button" class="quiz-grade-button correct ${quizState.answered === 'correct' ? 'selected' : ''}" data-quiz-answer="correct" ${quizState.answered ? 'disabled' : ''} aria-label="I know this word"><span aria-hidden="true">✓</span> OK</button></div><div class="quiz-keyboard-hint">Use ← and → to change cards</div></section>`;
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
  document.getElementById('homeButton').addEventListener('click', () => {
    currentLesson = 'home';
    expandedLesson = null;
    draw();
  });

  content.addEventListener('change', (event) => {
    const setting = event.target.closest('[data-setting]');
    if (setting) {
      appSettings[setting.dataset.setting] = setting.checked;
      saveSettings();
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
      resetQuizSession(quizState.sourceKeys);
      draw();
      return;
    }
    const filter = event.target.closest('[data-vocabulary-filter]');
    if (!filter) return;
    vocabularyFilterState[filter.dataset.vocabularyFilter] = filter.checked;
    Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
    draw();
  });

  content.addEventListener('click', (event) => {
    const filteredQuiz = event.target.closest('[data-start-filtered-quiz]');
    if (filteredQuiz && !filteredQuiz.disabled) {
      const selectedSources = Object.keys(vocabularyFilterState).filter((key) => vocabularyFilterState[key]);
      currentLesson = 'quiz';
      expandedLesson = null;
      resetQuizSession(selectedSources);
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
    const mode = event.target.closest('[data-quiz-mode]');
    if (mode) {
      quizState.front = mode.dataset.quizMode;
      quizState.flipped = false;
      draw();
      return;
    }
    const quizNavigation = event.target.closest('[data-quiz-nav]');
    if (quizNavigation) {
      changeQuizCard(Number(quizNavigation.dataset.quizNav));
      return;
    }
    const quizAnswer = event.target.closest('[data-quiz-answer]');
    if (quizAnswer && !quizState.answered && quizState.currentChinese) {
      const stats = getWordStats(quizState.currentChinese);
      quizState.answered = quizAnswer.dataset.quizAnswer;
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
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-hint-row]');
    if (!row) return;
    event.preventDefault();
    row.click();
  });

  document.addEventListener('keydown', (event) => {
    if (currentLesson !== 'quiz' || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    const change = event.key === 'ArrowLeft' ? -1 : 1;
    changeQuizCard(change);
    window.scrollTo(scrollLeft, scrollTop);
    requestAnimationFrame(() => window.scrollTo(scrollLeft, scrollTop));
  });

  document.getElementById('hideAll').addEventListener('click', () => {
    Object.keys(hintState).forEach((key) => { hintState[key] = { pinyin: false, english: false }; });
    Object.keys(rowHintState).forEach((key) => { delete rowHintState[key]; });
    draw();
  });

  draw();
})();
