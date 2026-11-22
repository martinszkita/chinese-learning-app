const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {openStore}=require('../server/material-store.cjs');
const {createCatalog}=require('../js/data/model.js');
const {create}=require('../js/services/study-materials.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'custom-materials-'));const file=path.join(dir,'test.sqlite');
let store=openStore(file,{seed:false});
const row={chineseTraditional:'學校',chineseSimplified:'学校',pinyin:'xué xiào',english:'school'};
const input={requestId:'first',title:'My collection',mode:'word',reviewed:true,rawText:'学校 学校',rows:[row,row]};
try {
 const {collectionId}=store.saveCustomCollection(input);
 assert.equal(store.saveCustomCollection(input).collectionId,collectionId);
 let snap=store.snapshot();assert.equal(snap.collections.length,1);assert.equal(snap.items.length,1);assert.equal(snap.sectionItems.length,2);
 assert(snap.sectionItems.every(p=>p.wasNew));
 const item=snap.items[0],placement=snap.sectionItems[0];
 const second=store.saveCustomCollection({...input,requestId:'second',title:'Second',rows:[row]});
 assert.equal(store.snapshot().items.length,1);assert.equal(store.snapshot().sectionItems.at(-1).wasNew,0);
 assert.throws(()=>store.saveCustomCollection({...input,expectedRevision:0},collectionId),e=>e.status===409);
 assert.throws(()=>store.saveCustomCollection({...input,requestId:'invalid',rows:[row,{...row,chineseTraditional:''}]}));
 assert.equal(store.snapshot().collections.length,2,'Invalid batch must roll back');
 const edit={...input,title:'Renamed',expectedRevision:1,rows:[{...row,itemId:item.id,expectedRevision:1,placementId:placement.id,english:'a school',confirmedImpact:2}]};
 store.saveCustomCollection(edit,collectionId);
 snap=store.snapshot();assert.equal(snap.items[0].english,'a school');assert.equal(snap.items[0].id,item.id);assert.equal(snap.sectionItems.filter(p=>p.sectionId===placement.sectionId).length,1);assert.equal(snap.sectionItems.find(p=>p.id===placement.id).wasNew,1);
 assert.equal(snap.collections.find(c=>c.id===second.collectionId).revision,2,'Shared edit invalidates other open collections');
 assert.throws(()=>store.saveCustomCollection({...input,requestId:'third',rows:[{...row,itemId:item.id,expectedRevision:1}]}),e=>e.status===409);
 const catalog=createCatalog(snap);assert.equal(catalog.customCollections.length,2);
 const service=create({catalog,getPersonalLists:()=>[]});assert.equal(service.collectVocabulary().length,1);assert.equal(service.collectVocabulary()[0].sources.length,2);assert.equal(service.collectListeningItems().length,0);
 store.close();store=openStore(file,{seed:false});assert.equal(store.snapshot().collections[0].title,'Renamed');
 const current=store.snapshot();const c=current.collections[0];
 store.saveCustomCollection({...input,expectedRevision:c.revision,rows:[{...row,chineseTraditional:'老師',chineseSimplified:'老师',pinyin:'lǎo shī',english:'teacher'}]},c.id);
 assert(store.snapshot().items.some(i=>i.id===item.id),'Detached entry survives');
 console.log('PASS: atomic custom imports, deduplication, novelty, retries, global edits, revision conflicts, placements, persistence and study integration');
} finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
// Upgrade an existing v1 database without losing foreign-key references or IDs.
{
 const {DatabaseSync}=require('node:sqlite');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'custom-upgrade-'));const file=path.join(temp,'v1.sqlite');
 const db=new DatabaseSync(file);db.exec(fs.readFileSync(path.join(__dirname,'../server/migrations/001-materials.sql'),'utf8'));
 db.prepare("INSERT INTO collections(id,key,kind,title) VALUES ('old','reading1','reading','Original')").run();
 db.prepare("INSERT INTO sections(id,collection_id,kind,title,position) VALUES ('section','old','reading','Text',0)").run();
 db.close();const upgraded=openStore(file,{seed:false});
 assert.equal(upgraded.snapshot().collections[0].id,'old');assert.equal(upgraded.snapshot().sections[0].collectionId,'old');
 upgraded.close();const check=new DatabaseSync(file);assert.equal(check.prepare('PRAGMA foreign_key_check').all().length,0);check.close();fs.rmSync(temp,{recursive:true,force:true});
 console.log('PASS: v1 to v2 migration preserves collection and section references');
}
