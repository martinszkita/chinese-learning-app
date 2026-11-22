const assert=require('node:assert/strict');
const {openStore}=require('../server/material-store.cjs');
const {createServer}=require('../server/index.cjs');
const {create}=require('../js/data/repository.js');
(async()=>{
 const store=openStore(':memory:',{seed:false});
 const server=createServer({store,translator:{suggest:async({texts})=>({results:texts.map(text=>({text,english:'test translation'}))})}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;const repository=create({baseUrl:base+'/api'});
 const input={title:'Test <collection>',mode:'sentence',rawText:'你好。',reviewed:true,requestId:'http-import',rows:[{chineseTraditional:'你好。',chineseSimplified:'你好。',pinyin:'nǐ hǎo',english:'Hello.'}]};
 try{
  assert.equal((await repository.suggestTranslations(['你好'])).results[0].english,'test translation');
  const saved=await repository.saveCustomCollection(input);
  assert.equal((await repository.saveCustomCollection(input)).collectionId,saved.collectionId);
  let snapshot=await repository.load();const collection=snapshot.collections[0];
  const position=snapshot.sectionItems[0];const item=snapshot.items[0];
  await repository.saveCustomCollection({...input,title:'Updated',expectedRevision:collection.revision,rows:[{...input.rows[0],itemId:item.id,expectedRevision:item.revision,placementId:position.id,english:'Hi.',confirmedImpact:1}]},collection.id);
  await assert.rejects(repository.saveCustomCollection({...input,expectedRevision:collection.revision},collection.id),e=>e.status===409);
  snapshot=await repository.load();assert.equal(snapshot.collections[0].title,'Updated');assert.equal(snapshot.items[0].english,'Hi.');
  await assert.rejects(repository.saveCustomCollection({...input,requestId:'invalid',title:''}),e=>e.status===400);
  for(const asset of ['/material-import.js','/js/services/material-matching.js','/vendor/pinyin/pinyin-pro.js'])assert.equal((await fetch(base+asset)).status,200);
  console.log('PASS: custom collection and translation HTTP endpoints, validation, idempotency, shared edits, conflicts and public editor assets');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1);});
