(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).studyMaterials = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function create({ catalog, getPersonalLists }) {
  const { lessons: database, midterms, lessonCount } = catalog;
  const materialAudio = catalog.audio;
  function collectVocabulary() {
    const seen = new Map();
    const vocabulary = [];
    for (let lesson = 1; lesson <= lessonCount; lesson++) {
      for (let dialog = 1; dialog <= 2; dialog++) {
        const words = database[`${lesson}-dialog${dialog}`]?.words || [];
        let category = '';
        words.forEach((word) => {
          if (word.category) category = word.category;
          const source = `lesson${lesson}`;
          const existing = seen.get(word.chinese);
          if (existing) {
            if (!existing.sources.includes(source)) existing.sources.push(source);
            if (!existing.dialogSources.includes(`${lesson}-dialog${dialog}`)) existing.dialogSources.push(`${lesson}-dialog${dialog}`);
            return;
          }
          const item = {
            ...word,
            materialType: category === 'Phrases' ? 'expression' : 'word',
            category: '',
            sources: [source],
            dialogSources: [`${lesson}-dialog${dialog}`]
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
            id: question.id,
            occurrenceId: question.occurrenceId,
            audio: question.audio,
            chinese: question.chinese,
            pinyin: question.pinyin,
            english: question.english,
            partOfSpeech: 'Question',
            materialType: 'expression',
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
      audio: item.audio || materialAudio?.[item.chinese] || listeningAudio.get(item.chinese) || ''
    }));
    getPersonalLists().forEach((list) => list.items.forEach((item) => {
      item = catalog.itemById(item.id) || item;
      const existing = result.find((word) => word.id && item.id ? word.id === item.id : word.chinese === item.chinese);
      if (existing) existing.sources.push(`personal:${list.id}`);
      else result.push({ ...item, materialType: item.materialType || 'expression', category: '', sources: [`personal:${list.id}`], audio: item.audio || materialAudio?.[item.chinese] || listeningAudio.get(item.chinese) || '' });
    }));
    return result;
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
            voice: item.voice || 'George',
            audio: item.audio || ''
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
            audio: item.audio || ''
          });
        }
      }
    }
    return items.filter((item) => item.audio);
  }

  return { collectVocabulary, collectListeningItems };
  }
  return { create };
});
