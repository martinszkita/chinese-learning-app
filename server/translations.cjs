function chunks(text, limit=500) {
  const result = []; let chunk='';
  for (const char of text) {
    if (Buffer.byteLength(chunk+char,'utf8') > limit) { result.push(chunk); chunk=''; }
    chunk+=char;
  }
  if(chunk) result.push(chunk);
  return result;
}
function createTranslator({fetch:fetcher=globalThis.fetch, email=process.env.MYMEMORY_EMAIL || '', timeout=10000, cacheLimit=5000}={}) {
  const cache = new Map();
  let active=0; const queue=[];
  async function limited(work) {
    if(active>=2) await new Promise(resolve=>queue.push(resolve));
    active++;
    try { return await work(); } finally { active--; queue.shift()?.(); }
  }
  async function translate(text) {
    if(cache.has(text)) return cache.get(text);
    const pieces = chunks(text);
    const translated=[];
    for(const piece of pieces) {
      const url=new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q',piece); url.searchParams.set('langpair','zh-CN|en');
      if(email) url.searchParams.set('de',email);
      const result = await limited(async()=>{
        const response=await fetcher(url,{signal:AbortSignal.timeout(timeout)});
        if(!response.ok) throw Error(`Translation service unavailable (${response.status}). Retry later or enter a translation.`);
        const data=await response.json();
        if(Number(data.responseStatus)!==200 || data.quotaFinished || typeof data.responseData?.translatedText!=='string' || !data.responseData.translatedText.trim()) throw Error('Translation limit reached or no translation available. Retry later or enter a translation.');
        return data.responseData.translatedText;
      });
      translated.push(result);
    }
    const result={english:translated.join(' '),needsReview:pieces.length>1};
    if(cache.size>=cacheLimit) cache.delete(cache.keys().next().value);
    cache.set(text,result); return result;
  }
  async function suggest(input) {
    if(!Array.isArray(input.texts)||input.texts.length>500||input.texts.some(t=>typeof t!=='string'||!t.trim()||t.length>2000)) {const error=Error('Provide up to 500 nonempty texts (2,000 characters each).');error.status=400;throw error;}
    const unique=[...new Set(input.texts)]; let index=0; const results=new Map();
    async function worker(){while(index<unique.length){const text=unique[index++]; try{results.set(text,{text,...await translate(text)});}catch(error){results.set(text,{text,error:error.name==='TimeoutError'?'Translation timed out. Retry missing translations.':error.message});}}}
    await Promise.all([worker(),worker()]);
    return {results:input.texts.map(text=>results.get(text))};
  }
  return {suggest};
}
module.exports={createTranslator,chunks};
