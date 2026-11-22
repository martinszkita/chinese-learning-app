const assert=require('node:assert/strict');
const {chunks,createTranslator}=require('../server/translations.cjs');
(async()=>{
 const text='學校😀'.repeat(150);assert.equal(chunks(text).join(''),text);assert(chunks(text).every(c=>Buffer.byteLength(c)<=500));
 let calls=0,active=0,max=0;
 const translator=createTranslator({fetch:async url=>{calls++;active++;max=Math.max(max,active);assert(Buffer.byteLength(url.searchParams.get('q'))<=500);await new Promise(r=>setTimeout(r,2));active--;return {ok:true,json:async()=>({responseStatus:200,responseData:{translatedText:'school'}})};}});
 const result=await translator.suggest({texts:['學校','學校','老師',text]});assert.equal(result.results[0].english,'school');assert(result.results[3].needsReview);assert(max<=2);
 const previous=calls;await translator.suggest({texts:['學校']});assert.equal(calls,previous);
 const partial=createTranslator({fetch:async url=>({ok:true,json:async()=>url.searchParams.get('q')==='學校'?{responseStatus:200,responseData:{translatedText:'school'}}:{responseStatus:429,quotaFinished:true}})});
 const mixed=await partial.suggest({texts:['學校','老師']});assert.equal(mixed.results[0].english,'school');assert(mixed.results[1].error);
 const offline=createTranslator({fetch:async()=>{throw Object.assign(Error('timeout'),{name:'TimeoutError'});}});assert.match((await offline.suggest({texts:['學校']})).results[0].error,/timed out/);
 await assert.rejects(translator.suggest({texts:['']}),e=>e.status===400);
 console.log('PASS: MyMemory UTF-8 chunks, cache, duplicate requests, concurrency, partial success, quota errors and timeouts');
})().catch(e=>{console.error(e);process.exit(1);});
