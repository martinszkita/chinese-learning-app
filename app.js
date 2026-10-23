(() => {
  const database = window.CHINESE_LESSONS || {};
  const midterms = window.CHINESE_MIDTERMS || {};
  const audioExtension = window.CHINESE_AUDIO_EXTENSION === 'mp3' ? 'mp3' : 'm4a';
  const lessonCount = 7;
  let currentLesson = 'home';
  let currentPart = 'dialog1';
  let expandedLesson = null;
  let selectedReading = 0;
  const hintState = {};
  const rowHintState = {};
  const openState = {};
  const quizState = { index: 0, flipped: false, unansweredOnly: false, needsViewRecord: false, answered: null, currentChinese: null, advanceTimer: null, order: [], sourceKeys: null };
  const listeningState = { kind: 'sentences', sourceKey: 'all', index: 0, rate: 1, revealStage: 0, transitionDirection: 0 };
  const quizStatsStorageKey = 'chinese-exam-quiz-stats-v3';
  const settingsStorageKey = 'chinese-exam-settings-v1';
  const vocabularyFilterState = Object.fromEntries([
    ...Array.from({ length: lessonCount }, (_, index) => `lesson${index + 1}`),
    'midterm1',
    'midterm2'
  ].map((source) => [source, true]));
  const personalListStorageKey = 'chinese-exam-personal-list-v1';
  const personalList = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(personalListStorageKey) || 'null');
      if (saved && typeof saved.name === 'string' && Array.isArray(saved.items)) {
        return { name: saved.name.trim() || 'My list', items: saved.items.filter((item) => item && typeof item.chinese === 'string' && typeof item.pinyin === 'string' && typeof item.english === 'string') };
      }
    } catch {}
    return { name: 'My list', items: [] };
  })();
  const saveableItems = new Map();
  let personalListOnly = false;
  const readingPassages = [{
    title: '我的週末',
    paragraphs: [
      '我現在在臺灣學中文。我的學校在山上，前面有海，後面有山，風景真的很漂亮。學校附近有圖書館、咖啡店和幾家餐廳，所以生活很方便。',
      '週末早上，我常和朋友一起去學校打籃球。有時候我們也踢足球或游泳。中午，我們去一家有名的牛肉麵店吃飯。那裡的牛肉麵和小籠包都很好吃，而且不太貴。我最喜歡喝熱茶，朋友比較喜歡喝咖啡。',
      '下午，我常到圖書館看書、寫字和學書法。晚上如果有空，我會和朋友去看電影或唱歌。這個週末，朋友想去大安的KTV，但是我得先去銀行。我們約晚上七點在咖啡店見面，吃完晚飯再一起去唱歌。',
      '我覺得在臺灣學中文很有意思。雖然每天都很忙，可是我認識了很多朋友，也學會了說中文、看中文和寫中文字。'
    ]
  },
    {
      title: '我在臺灣的大學生活',
      label: '350 words',
      wordCount: 350,
      paragraphs: [
        '我 是 從 波蘭 來 的 學生 現在 在 臺灣 的 大學 學 中文 我 的 學校 在 山上 前面 有 海 後面 有 山 每天 早上 我 從 宿舍 走 到 教室 一路 可以 看見 很 漂亮 的 風景 雖然 上課 的 地方 有點 遠 但是 風景 很 美',
        '我 每天 七點 起床 先 洗臉 再 去 宿舍 一樓 的 餐廳 吃 早餐 我 常 吃 包子 喝 熱茶 有時候 也 買 咖啡 八點 半 我 和 同學 一起 去 上課 老師 先 教 生詞 再 讓 我們 練習 對話 如果 我 不 懂 一個 字 就 問 老師',
        '中午 下課 以後 我 常 跟 朋友 到 學校 外面 吃飯 附近 有 很多 小吃店 有 牛肉麵 水餃 小籠包 和 越南菜 我 最 喜歡 牛肉麵 因為 湯 很 好喝 牛肉 也 很 好吃 一碗 大約 一百 二十 塊 不 太 貴 吃飯 的 時候 我們 只 用 中文 互相 幫忙',
        '下午 沒有 課 的 時候 我 喜歡 去 圖書館 複習 圖書館 在 教室 大樓 的 旁邊 裡面 很 安靜 也 有 很多 中文 書 我 先 看 課本 再 寫 作業 然後 用 新 生詞 寫 幾個 句子 有時候 我 會 聽 中文 音樂 或 看 臺灣 電影 非常 有意思',
        '星期三 晚上 我 有 書法課 剛 開始 學 的 時候 我 覺得 寫 漢字 很 難 老師 告訴 我 不要 太 快 要 慢慢 看 每一個 筆畫 現在 我 可以 寫 自己 的 中文 名字 也 能 寫 一些 簡單 的 句子 我的 字 現在 比 以前 漂亮 很多 了',
        '週末 我 通常 不 上課 星期六 早上 我 和 朋友 去 操場 打 籃球 或 踢 足球 如果 天氣 太 熱 我們 就 去 游泳池 游泳 下午 我們 常 到 咖啡店 聊天 做 作業 那家 店 的 咖啡 不 貴 甜點 也不錯 晚上 我們 去 KTV 一起 唱 中文歌 開心',
        '來 臺灣 以前 我 只 會 說 很少 中文 現在 我 可以 自己 買 東西 點菜 問路 也 可以 跟 新 朋友 聊天 有時候 我 還是 聽 不懂 別人 說 什麼 也 會 用錯 聲調 但是 我 不再 害怕 開口 我 相信 每天 練習 一點 一定 會 慢慢 進步 很多'
      ]
    },
    {
      title: '難忘的花蓮旅行',
      label: '500 words',
      wordCount: 500,
      paragraphs: [
        '上個月 老師 告訴 我們 班 要 去 花蓮 旅行 兩天 大家 聽了 都 很 高興 因為 很多 同學 沒有 去過 花蓮 老師 說 那裡 前面 有 海 後面 有 山 風景 非常 漂亮 我們 可以 看 海 走路 吃 小吃 還 能 跟 當地 學生 練習 中文 每個人 很 期待',
        '旅行 前 一個 星期 我們 在 教室 一起 討論 行程 有人 想 去 海邊 有人 想 爬山 也 有人 只 想 吃 好吃 的 東西 老師 讓 我們 自己 安排 時間 我 和 三個 朋友 負責 找 餐廳 我們 上網 看了 很多 照片 最後 選了 一家 有名 的 麵店 吃飯',
        '星期六 早上 六點 半 我 就 起床 先 檢查 手機 錢包 衣服 和 車票 然後 到 樓下 找 同學 七點 我們 在 學校 門口 見面 一起 坐車 去 車站 有一個 同學 遲到 十分鐘 大家 有點 擔心 幸好 他 最後 跑來 了 我們 買了 早餐 和 咖啡 就 上 火車 出發',
        '火車 開了 以後 我 坐 在 窗戶 旁邊 一邊 吃 包子 一邊 看 外面 的 風景 城市 的 大樓 慢慢 變少 海 和 山 越來越 近 朋友 問 我 喜歡 海 還是 山 我 說 兩個 都 喜歡 因為 海 很 美 山上 的 空氣 也 很 好 大家 開心',
        '當地 學校 的 老師 和 學生 在 車站 歡迎 我們 他們 帶 我們 坐 公車 到 宿舍 宿舍 是 一棟 五層 的 大樓 我們 的 房間 在 三樓 裡面 有 四張 床 一張 桌子 和 一個 很 大 的 窗戶 外面 可以 看見 遠山 我們 都 很 喜歡 這個 房間',
        '放好 東西 以後 我們 去 學校 參觀 圖書館 在 教室 大樓 旁邊 游泳池 在 宿舍 後面 校園 裡 沒有 很多 商店 但是 有 一家 小 咖啡店 店裡 的 學生 用 中文 問 我 想 喝 什麼 我 點了 熱 咖啡 也 買了 一個甜點 我 能 聽懂 中文 覺得 很 開心',
        '中午 當地 學生 帶 我們 去 吃 牛肉麵 那家 店 不 大 可是 客人 很多 老闆 問 我們 要 大碗 還是 小碗 我 點了 小碗 因為 早上 已經 吃了 兩個 包子 麵 很 好吃 湯 也 好喝 一碗 一百 三十 塊 吃完 以後 老闆 還 請 我們 喝茶 非常 開心',
        '下午 我們 一起 去 海邊 天氣 很 熱 可是 海風 很 舒服 有些 同學 在 沙灘 打球 有些 人 坐著 聊天 我 和 新 朋友 沿著 海邊 走 他 問 我 為什麼 來 臺灣 學 中文 我 說 我 喜歡 認識 不同 國家 的 人 也 讓 學習 更 有意思',
        '晚上 我們 在 宿舍 前面 吃 晚飯 然後 舉行 小 活動 每個人 都 要 介紹 自己 還 要 唱 一首 歌 我 本來 很 害怕 因為 我 唱歌 唱得 不好 可是 同學 一直 鼓勵 我 最後 我 選了 一首 簡單 的 中文歌 大家 跟著 一起 唱 我 忘了 幾個 字',
        '第二天 早上 我們 去 山上 看 風景 路 有點 遠 也 不 太 好走 可是 到了 上面 以後 我 覺得 非常 值得 前面 是 藍色 的 海 後面 是 綠色 的 山 我們 在 那裡 拍照 吃 午餐 也 約好 以後 再 見 這次 旅行 讓 我 更 勇敢 說中文'
      ]
    }
  ];
  const nav = document.getElementById('lessonNav');
  const toolsNav = document.getElementById('studyToolsNav');
  const content = document.getElementById('content');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const appSettings = (() => {
    const defaults = { darkMode: false, autoAdvance: true, listPinyin: false, listEnglish: false, listeningChinese: false, quizEnglishFirst: false, quizPinyin: true };
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
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.textContent = appSettings.darkMode ? '☀ Light mode' : '☾ Dark mode';
    themeToggle.setAttribute('aria-pressed', String(appSettings.darkMode));
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
    const listeningLink = `<button type="button" class="lesson-link listening-link ${currentLesson === 'listening' ? 'active' : ''}" data-listening="true" aria-current="${currentLesson === 'listening' ? 'page' : 'false'}">Listening<span class="mini">聽</span></button>`;
    const settingsLink = `<button type="button" class="lesson-link settings-link ${currentLesson === 'settings' ? 'active' : ''}" data-settings="true" aria-current="${currentLesson === 'settings' ? 'page' : 'false'}">Settings<span class="mini">⚙</span></button>`;
    const midtermLinks = [1, 2].map((number) => {
      const key = `midterm${number}`;
      const isCurrent = currentLesson === key;
      return `<button type="button" class="lesson-link midterm-link ${isCurrent ? 'active' : ''}" data-midterm="${key}" aria-current="${isCurrent ? 'page' : 'false'}">Mid Term Questions ${number}<span class="mini">◆</span></button>`;
    }).join('');
    nav.innerHTML = lessons + midtermLinks;
    toolsNav.innerHTML = vocabularyLink + quizLink + readingLink + listeningLink + settingsLink;
  }

  function renderSaveButton(item) {
    saveableItems.set(item.chinese, item);
    const saved = personalList.items.some((entry) => entry.chinese === item.chinese);
    return `<button type="button" class="personal-save ${saved ? 'active' : ''}" data-personal-save="${escapeHtml(item.chinese)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} ${escapeHtml(personalList.name)}">${saved ? '★ Saved' : '☆ Save'}</button>`;
  }

  function persistPersonalList() {
    try {
      localStorage.setItem(personalListStorageKey, JSON.stringify(personalList));
      return true;
    } catch {
      window.alert('Your list could not be saved. Please check browser storage and try again.');
      return false;
    }
  }

  function renderLines(lines, key) {
    const hints = hintState[key] || { pinyin: false, english: false };
    return `<div class="toolbar"><button class="toggle ${hints.pinyin ? 'active' : ''}" type="button" data-toggle="pinyin" data-key="${key}" aria-pressed="${hints.pinyin}">Pinyin ${hints.pinyin ? '✓' : '+'}</button><button class="toggle ${hints.english ? 'active' : ''}" type="button" data-toggle="english" data-key="${key}" aria-pressed="${hints.english}">English ${hints.english ? '✓' : '+'}</button><span class="hint">Click a row: Pinyin → both → hide</span></div>${lines.map((item, index) => {
      const rowKey = `${key}-${index}`;
      const rowHints = rowHintState[rowKey] || hints;
      const showPinyin = rowHints.pinyin;
      const showEnglish = rowHints.english;
      const ruby = showPinyin ? renderRuby(item.chinese, item.pinyin) : null;
      return `<div class="line clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><div><div class="speaker">${escapeHtml(item.speaker || '例句')}</div>${showPinyin && item.speakerPinyin ? `<div class="speaker-pinyin">${escapeHtml(item.speakerPinyin)}</div>` : ''}</div><div><div class="hanzi ${ruby ? 'hanzi-ruby' : ''}" lang="zh-Hant">${ruby || escapeHtml(item.chinese)}</div>${renderSaveButton(item)}${showPinyin && !ruby ? `<div class="pinyin">${escapeHtml(item.pinyin)}</div>` : ''}${showEnglish ? `<div class="english">${escapeHtml(item.english)}</div>` : ''}</div></div>`;
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
        return `${word.category ? `<div class="word-category">${escapeHtml(word.category)}</div>` : ''}<div class="word-row word-row-with-stats clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><span class="word-number">${index + 1}</span><span class="word-hanzi ${ruby ? 'word-hanzi-ruby' : ''}" lang="zh-Hant">${ruby || escapeHtml(word.chinese)}${word.audio ? `<button type="button" class="word-audio" data-word-audio="${escapeHtml(word.audio)}" aria-label="Listen: ${escapeHtml(word.chinese)}" title="Play pronunciation">${renderSpeakerIcon()}</button>` : ''}${renderSaveButton(word)}</span><span class="word-details">${hintsContent}</span><span class="word-stat" data-stat-label="Shown">${stats.shown}</span><span class="word-stat" data-stat-label="Correct">${stats.correct}</span><span class="word-stat word-accuracy" data-stat-label="Accuracy">${getAccuracy(stats)}%</span></div>`;
      }
      return `${word.category ? `<div class="word-category">${escapeHtml(word.category)}</div>` : ''}<div class="word-row clickable-row" data-hint-row="${rowKey}" data-pinyin-default="${hints.pinyin}" data-english-default="${hints.english}" role="button" tabindex="0" aria-label="Cycle translation hints" title="Click: Pinyin → Pinyin and English → hide hints"><span class="word-number">${index + 1}</span><span class="word-hanzi ${ruby ? 'word-hanzi-ruby' : ''}" lang="zh-Hant">${ruby || escapeHtml(word.chinese)}${renderSaveButton(word)}</span>${showPinyin && !ruby ? `<span class="word-pinyin">${escapeHtml(word.pinyin)}</span>` : ''}${showEnglish ? `<span class="word-english">${word.partOfSpeech ? `<small>(${escapeHtml(word.partOfSpeech)})</small>` : ''}${escapeHtml(word.english)}</span>` : ''}</div>`;
    }).join('')}</div>${showStats ? '<audio data-word-audio-player preload="none"></audio>' : ''}`;
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
      ? renderSetting('listeningChinese', 'Show Chinese by default', 'Display Chinese characters when opening a recording.')
      : currentLesson === 'quiz'
      ? renderSetting('autoAdvance', 'Automatic next card', 'Continue after choosing OK or X.')
      : currentLesson === 'vocabulary'
      ? renderSetting('listPinyin', 'Show Pinyin by default', 'Reveal pronunciation in the word list.') + renderSetting('listEnglish', 'Show English by default', 'Reveal meanings in the word list.')
      : `<p class="mode-description">${currentLesson === 'home' ? 'Choose a mode above or study material on the left. Its controls will appear here.' : currentLesson === 'reading' ? 'Choose a passage below and read at your own pace.' : 'Click a sentence to reveal Pinyin and English. Use Hide all hints to practise without help.'}</p>`;
    panel.insertAdjacentHTML('afterbegin', `<section class="settings-card">${settings}</section>`);
  }

  function drawContent() {
    drawNav();
    const isHome = currentLesson === 'home';
    document.querySelector('main').classList.toggle('listening-view', currentLesson === 'listening');
    document.getElementById('hideAll').hidden = isHome;
    document.getElementById('sourceFootnote').hidden = isHome || currentLesson === 'listening';
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
    content.innerHTML = `<section class="section"><div class="section-head static-head"><span class="section-heading"><span class="section-num">0${dialogNumber}</span><span><span class="section-title">Dialog ${dialogNumber}</span><span class="section-meta">${data?.title ? escapeHtml(data.title) : 'Not added yet'}</span></span></span></div><div class="dialog-content">${renderSubsection('Dialogue', dialogue, `${key}-dialogue`, true)}${renderSupplement(data, `${key}-supplement`)}${(data?.screenshots || []).map((path, screenshotIndex) => `<a class="source-link" href="${encodeURI(path)}" target="_blank" rel="noopener">↗ View original screenshot ${screenshotIndex + 1}</a>`).join(' ')}${(data?.sources || []).map((source) => `<a class="source-link" href="${encodeURI(source.path)}" target="_blank" rel="noopener">↗ ${escapeHtml(source.label)}</a>`).join(' ')}</div></section>`;
  }

  function drawHome() {
    document.getElementById('lessonTitle').textContent = 'Welcome';
    content.innerHTML = `<section class="welcome-card"><div class="welcome-hero"><span class="welcome-symbol" aria-hidden="true">中文</span><div><div class="subtle">HOW TO USE THIS WEBSITE</div><h3>Study at your own pace</h3><p>Choose a lesson, reveal only the hints you need, and use the quiz to practise difficult words.</p></div></div><div class="welcome-steps"><article><span>1</span><h4>Choose material</h4><p>Open one lesson on the left, or select a study mode in the top navigation.</p></article><article><span>2</span><h4>Reveal hints</h4><p>Click a sentence or word once for Pinyin, twice for Pinyin and English, and again to hide both.</p></article><article><span>3</span><h4>Practise with cards</h4><p>Flip flashcards, mark your answer with OK or X, and track your results in the complete word list.</p></article><article><span>4</span><h4>Filter your study</h4><p>In the word list, select only the lessons you want and start a quiz from the current filters.</p></article></div></section>`;
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
    const listeningAudio = new Map(collectListeningItems().map((item) => [item.chinese, item.audio]));
    const result = vocabulary.map((item, index) => ({
      ...item,
      audio: listeningAudio.get(item.chinese) || `audio/vocabulary/word-${String(index + 1).padStart(3, '0')}.${audioExtension}`
    }));
    personalList.items.forEach((item) => {
      const existing = result.find((word) => word.chinese === item.chinese);
      if (existing) existing.sources.push('personal');
      else result.push({ ...item, category: '', sources: ['personal'], audio: item.audio || listeningAudio.get(item.chinese) || '' });
    });
    return result;
  }

  function getFilteredVocabulary(words) {
    if (personalListOnly) return words.filter((word) => word.sources.includes('personal')).map((word, index) => ({ ...word, category: index === 0 ? personalList.name : '' }));
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
    content.innerHTML = `<section class="midterm-intro"><div class="subtle">LESSONS 1–7 + MIDTERM QUESTIONS · MASTER VOCABULARY</div><p>Showing ${filteredWords.length} of ${words.length} unique words and expressions. Multi-character expressions stay together; a component is listed separately only when it also appears as an independent vocabulary item.</p></section><fieldset class="vocabulary-filters"><legend>Show content from</legend><div class="vocabulary-filter-actions"><button type="button" class="filter-action" data-vocabulary-select="all">Select all</button><button type="button" class="filter-action" data-vocabulary-select="none">Clear all</button><button type="button" class="filter-action start-filtered-quiz" data-start-filtered-quiz ${filteredWords.length ? '' : 'disabled'}>Quiz selected · ${filteredWords.length}</button></div>${filters}<div class="personal-list-controls"><label class="vocabulary-filter"><input type="checkbox" data-personal-filter ${personalListOnly ? 'checked' : ''}><span>Only: ${escapeHtml(personalList.name)} (${personalList.items.length})</span></label><form data-personal-rename><label>List name <input name="listName" value="${escapeHtml(personalList.name)}" required maxlength="80"></label><button type="submit" class="filter-action">Rename</button></form><small>Use ☆ Save beside a word or sentence. Your list is saved in this browser.</small></div></fieldset><section class="vocabulary-list-panel">${filteredWords.length ? renderWords(filteredWords, key, { showStats: true }) : `<div class="empty">${personalListOnly ? 'Your list is empty. Save words or sentences from lessons or Listening.' : 'Select at least one lesson or mid-term.'}</div>`}</section>`;
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
    content.innerHTML = `<div class="reading-selector" role="group" aria-label="Choose reading text">${passageButtons}</div><article class="reading-card"><div class="reading-card-head"><div><div class="subtle">READING PRACTICE · LESSONS 1–7</div><h3 lang="zh-Hant">${escapeHtml(passage.title)}</h3><p class="reading-ai-note">This practice text was generated by AI from the course vocabulary.</p></div><span class="reading-count">${countLabel}</span></div><div class="reading-text" lang="zh-Hant">${passage.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph.replaceAll(' ', ''))}</p>`).join('')}</div></article>`;
  }

  function collectListeningItems() {
    const items = [];
    for (let lesson = 1; lesson <= lessonCount; lesson++) {
      for (let dialog = 1; dialog <= 2; dialog++) {
        const sourceKey = `${lesson}-dialog${dialog}`;
        const sourceLabel = `Lesson ${lesson} · Dialog ${dialog}`;
        (database[sourceKey]?.examples || []).forEach((item, index) => {
          items.push({
            ...item,
            sourceKey,
            sourceLabel,
            sourceIndex: index + 1,
            voice: 'George',
            audio: `audio/listening/${sourceKey}-example-${String(index + 1).padStart(2, '0')}.${audioExtension}`
          });
        });
      }
    }
    for (let midtermNumber = 1; midtermNumber <= 2; midtermNumber++) {
      const sourceKey = `midterm${midtermNumber}`;
      const sourceLabel = `Mid Term ${midtermNumber}`;
      let questionIndex = 0;
      for (const section of midterms[sourceKey]?.sections || []) {
        for (const item of section.questions || []) {
          questionIndex += 1;
          items.push({
            ...item,
            sourceKey,
            sourceLabel,
            sourceIndex: questionIndex,
            voice: 'George',
            audio: `audio/listening/${sourceKey}-question-${String(questionIndex).padStart(2, '0')}.${audioExtension}`
          });
        }
      }
    }
    return items;
  }

  function resetListeningHints() {
    listeningState.revealStage = appSettings.listeningChinese ? 1 : 0;
  }

  function getListeningPool() {
    if (listeningState.kind === 'words') {
      return collectVocabulary()
        .filter((word) => word.sources.some((source) => source.startsWith('lesson')))
        .map((word, index) => ({
          ...word,
          sources: word.sources.filter((source) => source.startsWith('lesson')),
          sourceLabel: word.sources.filter((source) => source.startsWith('lesson')).map((source) => `Lesson ${source.slice(6)}`).join(' · '),
          sourceIndex: index + 1,
          voice: 'George'
        }));
    }
    return collectListeningItems().map((item) => ({ ...item, sources: [item.sourceKey] }));
  }

  function getListeningItems() {
    const items = getListeningPool();
    return listeningState.sourceKey === 'all'
      ? items
      : items.filter((item) => item.sources.includes(listeningState.sourceKey));
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
    const ruby = renderRuby(item.chinese, item.pinyin);
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
      result += `<button type="button" class="listening-word" data-listening-word="${escapeHtml(word.chinese)}" aria-label="Show word: ${escapeHtml(word.chinese)}">${escapeHtml(word.chinese)}</button>`;
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
    const sources = listeningState.kind === 'words'
      ? Array.from({ length: lessonCount }, (_, index) => [`lesson${index + 1}`, `Lesson ${index + 1}`])
        .filter(([key]) => allItems.some((item) => item.sources.includes(key)))
      : [...new Map(allItems.map((entry) => [entry.sourceKey, entry.sourceLabel])).entries()];
    const kindButtons = [['sentences', 'Sentences'], ['words', 'Words & expressions']]
      .map(([kind, label]) => `<button type="button" class="toggle ${listeningState.kind === kind ? 'active' : ''}" data-listening-kind="${kind}" aria-pressed="${listeningState.kind === kind}">${label}</button>`).join('');
    const sourceOptions = [
      `<option value="all" ${listeningState.sourceKey === 'all' ? 'selected' : ''}>All recordings (${allItems.length})</option>`,
      ...sources.map(([sourceKey, sourceLabel]) => {
        const count = allItems.filter((entry) => entry.sources.includes(sourceKey)).length;
        return `<option value="${escapeHtml(sourceKey)}" ${listeningState.sourceKey === sourceKey ? 'selected' : ''}>${escapeHtml(sourceLabel)} (${count})</option>`;
      })
    ].join('');
    document.getElementById('lessonTitle').textContent = 'Listening practice';
    if (!item) {
      content.innerHTML = '<section class="listening-panel"><div class="empty">No listening material is available for this source.</div></section>';
      drawModeSettings();
      return;
    }
    const rateButtons = [0.75, 1, 1.25].map((rate) => `<button type="button" class="listening-rate ${listeningState.rate === rate ? 'active' : ''}" data-listening-rate="${rate}" aria-pressed="${listeningState.rate === rate}">${rate}×</button>`).join('');
    const revealLabel = listeningState.revealStage === 0 ? 'Show Chinese' : listeningState.revealStage === 1 ? 'Show Pinyin and English translation' : 'Hide answer';
    const revealedAnswer = listeningState.revealStage === 0
      ? '<span class="listening-hidden">Listen first, then click to reveal the Chinese text</span>'
      : `<span class="listening-hanzi" lang="zh-Hant">${renderListeningWords(item)}</span>${listeningState.revealStage === 2 ? `<span class="listening-pinyin" lang="zh-Latn-pinyin">${escapeHtml(item.pinyin)}</span><span class="listening-english" lang="en">${escapeHtml(item.english)}</span>` : ''}`;
    const transitionClass = listeningState.transitionDirection > 0 ? 'listening-slide-next' : listeningState.transitionDirection < 0 ? 'listening-slide-previous' : '';
    listeningState.transitionDirection = 0;
    content.innerHTML = `<div class="listening-layout"><section class="listening-panel"><div class="listening-card-frame ${transitionClass}"><div class="listening-card-meta"><span class="quiz-scope">${escapeHtml(item.sourceLabel)} · ${item.sourceIndex}</span><span class="listening-voice-badge">Voice · ${escapeHtml(item.voice)}</span></div><div class="quiz-progress"><strong>${listeningState.index + 1}</strong> / ${items.length}<span>Press the speaker or Space to play</span></div><div class="listening-flash-stage"><button type="button" class="quiz-arrow" data-listening-nav="-1" aria-label="Previous recording" ${listeningState.index === 0 ? 'disabled' : ''}>←</button><div class="listening-stage-center"><button type="button" class="listening-play-button" data-listening-play aria-label="Play recording">${renderSpeakerIcon()}<span>Play recording</span></button><audio preload="metadata" data-listening-audio src="${encodeURI(item.audio)}">Your browser does not support audio playback.</audio></div><button type="button" class="quiz-arrow" data-listening-nav="1" aria-label="Next recording" ${listeningState.index === items.length - 1 ? 'disabled' : ''}>→</button></div><div role="button" tabindex="0" class="listening-answer-card stage-${listeningState.revealStage}" data-listening-reveal aria-label="${revealLabel}"><span class="listening-answer-action">${revealLabel}</span><span class="listening-answer-content">${revealedAnswer}</span></div><section class="listening-word-menu" data-listening-word-menu hidden aria-label="Selected word" aria-live="polite"></section><div class="listening-save">${renderSaveButton(item)}</div></div></section><aside class="listening-controls" aria-label="Listening settings"><section class="listening-control-card"><span class="listening-control-title">Material</span><div class="listening-kind" role="group" aria-label="Listening material type">${kindButtons}</div><label class="listening-source"><span>Choose material</span><select data-listening-source>${sourceOptions}</select></label><button type="button" class="toggle listening-random" data-listening-random ${items.length < 2 ? 'disabled' : ''}>Shuffle · Random ${listeningState.kind === 'words' ? 'word / expression' : 'sentence'}</button></section><section class="listening-control-card"><span class="listening-control-title">Recording voice</span><div class="listening-voice-detail"><strong>${escapeHtml(item.voice)}</strong><span>ElevenLabs · Mandarin</span></div></section><section class="listening-control-card"><span class="listening-control-title">Playback speed</span><div class="listening-speed" role="group" aria-label="Playback speed">${rateButtons}</div></section><section class="listening-control-card listening-shortcuts"><span class="listening-control-title">Keyboard</span><div><kbd>Space</kbd><span>Play / pause</span></div><div><kbd>←</kbd><kbd>→</kbd><span>Previous / next</span></div><div><kbd>↑</kbd><span>Reveal answer</span></div></section></aside></div>`;
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
    const pinyin = appSettings.quizPinyin ? `<span class="flashcard-pinyin" lang="zh-Latn-pinyin">${escapeHtml(word.pinyin)}</span>` : '';
    if (type === 'chinese') {
      return `<span class="flashcard-face flashcard-${side} flashcard-chinese-face"><span class="flashcard-face-label">Chinese</span><span class="flashcard-hanzi" lang="zh-Hant">${escapeHtml(word.chinese)}</span>${pinyin}</span>`;
    }
    return `<span class="flashcard-face flashcard-${side} flashcard-answer-face"><span class="flashcard-face-label">${appSettings.quizPinyin ? 'English + Pinyin' : 'English'}</span><span class="flashcard-english">${escapeHtml(word.english)}</span>${pinyin}${word.partOfSpeech ? `<span class="flashcard-pos">${escapeHtml(word.partOfSpeech)}</span>` : ''}</span>`;
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
    const scope = quizState.sourceKeys ? `Selected filters: ${quizState.sourceKeys.map((source) => source.startsWith('lesson') ? `Lesson ${source.replace('lesson', '')}` : source === 'personal' ? personalList.name : source === 'midterm1' ? 'Mid Term 1' : 'Mid Term 2').join(', ')}` : 'All lessons and mid-terms';
    const filter = `<span class="quiz-scope">${escapeHtml(scope)}</span><label class="quiz-filter"><input type="checkbox" data-quiz-unanswered ${quizState.unansweredOnly ? 'checked' : ''}><span>Only words never answered correctly</span></label>`;
    document.getElementById('lessonTitle').textContent = 'Flashcard quiz';
    if (!words.length) {
      content.innerHTML = `<section class="quiz-panel"><div class="quiz-options">${filter}</div><div class="quiz-complete"><strong>Everything is known!</strong><span>All words have at least one correct answer.</span></div></section>`;
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
    content.innerHTML = `<section class="quiz-panel"><div class="quiz-options">${filter}</div><div class="quiz-mode quiz-switches" role="group" aria-label="Flashcard display">${renderSetting('quizEnglishFirst', appSettings.quizEnglishFirst ? 'English first' : 'Chinese first', 'Chinese first ↔ English first')}${renderSetting('quizPinyin', 'Show Pinyin', appSettings.quizPinyin ? 'Pinyin on' : 'Pinyin off')}</div><div class="quiz-progress"><strong>${quizState.index + 1}</strong> / ${words.length}<span>Click the card to reveal the other side</span></div><div class="flashcard-stage"><button type="button" class="quiz-arrow" data-quiz-nav="-1" aria-label="Previous flashcard">←</button><div class="flashcard-wrap">${flashcard}${flashcardAudio}</div><button type="button" class="quiz-arrow" data-quiz-nav="1" aria-label="Next flashcard">→</button></div><div class="quiz-save">${renderSaveButton(word)}<span>${escapeHtml(personalList.name)}</span></div><div class="quiz-grade"><button type="button" class="quiz-grade-button incorrect ${quizState.answered === 'incorrect' ? 'selected' : ''}" data-quiz-answer="incorrect" ${quizState.answered ? 'disabled' : ''} aria-label="I do not know this word"><span aria-hidden="true">×</span> X</button><div class="quiz-grade-status"><strong>${answerMessage}</strong><span>Shown: <b data-current-shown>${stats.shown}</b> · Correct: <b data-current-correct>${stats.correct}</b> · <b data-current-accuracy>${getAccuracy(stats)}%</b></span></div><button type="button" class="quiz-grade-button correct ${quizState.answered === 'correct' ? 'selected' : ''}" data-quiz-answer="correct" ${quizState.answered ? 'disabled' : ''} aria-label="I know this word"><span aria-hidden="true">✓</span> OK</button></div><div class="quiz-keyboard-hint">Space: flip · ↑ know · ↓ don't know · ←/→ change card</div></section>`;
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
  document.getElementById('themeToggle').addEventListener('click', () => {
    appSettings.darkMode = !appSettings.darkMode;
    saveSettings();
    applyTheme();
  });
  document.getElementById('homeButton').addEventListener('click', () => {
    currentLesson = 'home';
    expandedLesson = null;
    draw();
  });

  document.querySelector('.shell').addEventListener('submit', (event) => {
    if (!event.target.matches('[data-personal-rename]')) return;
    event.preventDefault();
    const name = new FormData(event.target).get('listName').trim();
    if (!name) return;
    const previous = personalList.name;
    personalList.name = name.slice(0, 80);
    if (!persistPersonalList()) personalList.name = previous;
    draw();
  });

  document.querySelector('.shell').addEventListener('change', (event) => {
    if (event.target.matches('[data-personal-filter]')) {
      personalListOnly = event.target.checked;
      Object.keys(rowHintState).filter((key) => key.startsWith('vocabulary-all-')).forEach((key) => { delete rowHintState[key]; });
      draw();
      return;
    }
    const listeningSource = event.target.closest('[data-listening-source]');
    if (listeningSource) {
      listeningState.sourceKey = listeningSource.value;
      listeningState.index = 0;
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

  document.querySelector('.shell').addEventListener('click', (event) => {
    const wordChoice = event.target.closest('[data-listening-word]');
    if (wordChoice) {
      const word = saveableItems.get(wordChoice.dataset.listeningWord);
      const menu = content.querySelector('[data-listening-word-menu]');
      if (!word || !menu) return;
      menu.hidden = false;
      menu.innerHTML = `<strong lang="zh-Hant">${escapeHtml(word.chinese)}</strong><span lang="zh-Latn-pinyin">${escapeHtml(word.pinyin)}</span><span>${escapeHtml(word.english || 'Translation unavailable in course vocabulary.')}</span>${renderSaveButton(word)}<button type="button" class="filter-action" data-close-word-menu>Close</button>`;
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
      const previous = [...personalList.items];
      const index = personalList.items.findIndex((item) => item.chinese === chinese);
      if (index >= 0) personalList.items.splice(index, 1);
      else {
        const item = saveableItems.get(chinese);
        if (!item) return;
        personalList.items.push({ chinese: item.chinese, pinyin: item.pinyin || '', english: item.english || '', audio: item.audio || '' });
      }
      if (!persistPersonalList()) personalList.items = previous;
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
      listeningState.sourceKey = 'all';
      listeningState.index = 0;
      listeningState.transitionDirection = 0;
      resetListeningHints();
      drawListening();
      return;
    }

    const wordAudio = event.target.closest('[data-word-audio]');
    if (wordAudio) {
      const player = content.querySelector('[data-word-audio-player]');
      if (player) {
        player.pause();
        player.src = wordAudio.dataset.wordAudio;
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
    const listeningRate = event.target.closest('[data-listening-rate]');
    if (listeningRate) {
      listeningState.rate = Number(listeningRate.dataset.listeningRate);
      document.querySelectorAll('[data-listening-rate]').forEach((button) => {
        const isActive = Number(button.dataset.listeningRate) === listeningState.rate;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
      const audio = content.querySelector('[data-listening-audio]');
      if (audio) {
        audio.defaultPlaybackRate = listeningState.rate;
        audio.playbackRate = listeningState.rate;
      }
      return;
    }
    const listeningPlay = event.target.closest('[data-listening-play]');
    if (listeningPlay) {
      const audio = content.querySelector('[data-listening-audio]');
      if (!audio) return;
      if (audio.paused) {
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
      const selectedSources = personalListOnly ? ['personal'] : Object.keys(vocabularyFilterState).filter((key) => vocabularyFilterState[key]);
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
    if (event.target.closest('[data-word-audio], [data-personal-save], [data-listening-word], [data-close-word-menu]')) return;
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
    if (event.target.closest('input, textarea, select, [contenteditable="true"], [data-word-audio], [data-personal-save], [data-listening-word], [data-close-word-menu]')) return;
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
})();
