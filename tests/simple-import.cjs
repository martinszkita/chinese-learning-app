const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const {randomUUID}=require('node:crypto');
function setup(snapshot={collections:[],sections:[],sectionItems:[],items:[]}) {
 const handlers={};let saveCount=0,posted,stats,translationFails=false,conflict=false;
 const controls={focus(){this.focused=true;},setAttribute(k,v){this[k]=v;},remove(){this.removed=true;}};
 const container={innerHTML:'',addEventListener:(name,fn)=>handlers[name]=fn,removeEventListener:name=>delete handlers[name],querySelector:()=>controls,querySelectorAll:()=>[]};
 const repository={load:async()=>snapshot,suggestTranslations:async texts=>{if(translationFails)throw Error('Offline');return {results:texts.map(text=>({text,english:'translation'}))};},saveCustomCollection:async data=>{saveCount++;posted=data;if(conflict)throw Object.assign(Error('stale'),{status:409});return {collectionId:'saved'};}};
 const window={ChineseApp:{materialMatching:require('../js/services/material-matching.js'),text:require('../js/services/text.js')},OpenCC:require('../vendor/pinyin/opencc.js'),pinyinPro:require('../vendor/pinyin/pinyin-pro.js'),crypto:{randomUUID}};
 vm.runInNewContext(fs.readFileSync('material-import.js','utf8'),{window,Intl});
 let result;
 const options={snapshot,repository,onStats:value=>stats=value,onSaved:(_,id)=>result=id};let dispose=window.CHINESE_IMPORTER.mount(container,options);
 return {container,controls,input(name,value){handlers.input({target:{value,hasAttribute:attr=>attr===`data-import-${name}`}});},click(action,index){return handlers.click({target:{closest:()=>({dataset:{importAction:action,importIndex:String(index)}})}});},remount(){dispose();dispose=window.CHINESE_IMPORTER.mount(container,options);},get stats(){return stats;},get posted(){return posted;},get saveCount(){return saveCount;},get result(){return result;},failTranslations(value){translationFails=value;},conflict(value){conflict=value;}};
}
(async()=>{
 let app=setup();
 assert(app.container.innerHTML.includes('Collection name and Chinese text are required'));assert.equal(app.stats.total,0);assert.equal(app.stats.newCount,0);
 await app.click('prepare');assert(app.container.innerHTML.includes('Enter a collection name'));assert(app.controls.focused);assert.equal(app.saveCount,0);
 app.input('title','Test');await app.click('prepare');assert(app.container.innerHTML.includes('Paste Chinese text'));
 app.input('text','only English');await app.click('prepare');assert(app.container.innerHTML.includes('containing Chinese characters'));
 app.input('text','學校 火車');await app.click('prepare');
 assert(app.container.innerHTML.includes('学校'));assert(app.container.innerHTML.includes('translation'));
 assert(app.container.innerHTML.includes('<table class="import-table">'));assert(app.container.innerHTML.includes('<th scope="col">English</th>'));assert(!app.container.innerHTML.includes('import-confirmation-row'));
 assert.equal(app.stats.total,2);assert.equal(app.stats.newCount,2);
 assert(!app.container.innerHTML.includes('data-editor-field'));assert(!app.container.innerHTML.includes('Merge with next'));assert(!app.container.innerHTML.includes('Add entry'));
 assert.equal(app.saveCount,0,'Preparation must not import entries');
 app.input('title','');await app.click('all');assert(app.container.innerHTML.includes('Enter a collection name'));assert.equal(app.saveCount,0);app.input('title','Test');
 await app.click('confirm',0);await app.click('confirm',0);assert(app.container.innerHTML.includes('0 confirmed'),'Confirming can be undone');
 await app.click('selected');assert(app.container.innerHTML.includes('Confirm at least one entry'));assert.equal(app.saveCount,0);
 await app.click('confirm',1);assert(app.container.innerHTML.includes('1 confirmed'));assert.equal(app.stats.total,2);assert.equal(app.stats.newCount,2);
 await app.click('selected');assert.equal(app.posted.rows.length,1);assert.equal(app.posted.rows[0].chineseTraditional,'火車');assert.equal(app.result,'saved');assert(app.posted.reviewed);
 app=setup();app.input('title','All');app.input('text','你好。你去哪裡？');app.input('mode','sentence');await app.click('prepare');await app.click('all');assert.equal(app.posted.rows.length,2);assert.equal(app.posted.rows[0].chineseTraditional,'你好。');assert.equal(app.posted.mode,'sentence');
 app=setup();app.input('title','Retry');app.input('text','學校');app.failTranslations(true);await app.click('prepare');assert(app.container.innerHTML.includes('Translations unavailable'));assert(app.container.innerHTML.includes('學校'));app.failTranslations(false);await app.click('retry');assert(app.container.innerHTML.includes('translation'));
 await app.click('confirm',0);app.remount();assert(app.container.innerHTML.includes('Retry'));assert(app.container.innerHTML.includes('1 confirmed'));
 app.input('text','火車');assert.equal(app.stats.total,0);assert.equal(app.stats.newCount,0);await app.click('selected');assert.equal(app.saveCount,0,'Changed source invalidates prior confirmations');
 await app.click('prepare');app.conflict(true);await app.click('all');assert(app.container.innerHTML.includes('database changed'));assert(app.container.innerHTML.includes('0 confirmed'));app.conflict(false);await app.click('all');assert.equal(app.result,'saved');
 // Import confirmation cannot overwrite content of an existing shared entry.
 const item={id:'known',chineseTraditional:'學校',chineseSimplified:null,pinyin:'xuéxiào',english:'school',aliases:[],revision:3};
 app=setup({collections:[],sections:[],sectionItems:[],items:[item]});app.input('title','Known');app.input('text','学校');await app.click('prepare');assert.equal(app.stats.total,1);assert.equal(app.stats.newCount,0);await app.click('all');assert.equal(app.posted.rows[0].itemId,'known');assert.equal(app.posted.rows[0].english,'school');assert.equal(app.posted.rows[0].expectedRevision,3);
 app=setup();app.input('title','<script>');app.input('text','學校');await app.click('prepare');assert(!app.container.innerHTML.includes('<script>'));assert(app.container.innerHTML.includes('&lt;script&gt;'));
 console.log('PASS: compact table, live total/new counts, required-form reminders, read-only import preview, per-entry/all confirmation, sentences, stale-source invalidation, retry, conflicts, drafts, shared content and escaping');
})().catch(error=>{console.error(error);process.exit(1);});
