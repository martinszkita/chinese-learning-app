(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).text = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
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

  function renderRuby(chinese, pinyin, renderCharacter = escapeHtml) {
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
      return `<ruby>${renderCharacter(character)}<rt>${escapeHtml(syllable)}</rt></ruby>`;
    }).join('');
  }

  function normalizeSearch(value) {
    return String(value ?? '').toLowerCase().normalize('NFD')
      .replace(/u\u0308|u:/g, 'v').replace(/[\u0300-\u036f]/g, '')
      .replace(/([a-z])[0-5]/g, '$1').replace(/[\p{P}\p{Z}\s]/gu, '');
  }
  return { escapeHtml, splitPinyinWord, renderRuby, normalizeSearch };
});
