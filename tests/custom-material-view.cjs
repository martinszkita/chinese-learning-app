const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const elements=new Map();
function element(key){if(!elements.has(key))elements.set(key,{innerHTML:'',listeners:{},classList:{toggle(){}},setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];},insertAdjacentHTML(){},addEventListener(type,fn){this.listeners[type]=fn;}});return elements.get(key);}
const context=vm.createContext({window:{},console,document:{getElementById:element,querySelector:element,documentElement:element('root'),addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}}});
const runtime=require('./helpers/runtime.cjs');runtime.loadRuntime(context);
let source=runtime.appSource(context).replace('function draw() {','function actualDraw() {');
source=source.replace(/  draw\(\);\n\}\)\(\);\s*$/,`function draw() {}\nwindow.test={actualDraw,setMode:value=>currentLesson=value,openState};\n})();`);
const snapshot=context.window.__TEST_SNAPSHOT;
for(const mode of ['word','sentence']){
 snapshot.collections.push({id:mode,key:'custom:'+mode,kind:'custom',title:mode==='word'?'Travel <notes>':'My sentences',metadata:{mode},revision:1});
 snapshot.sections.push({id:mode+'-section',collectionId:mode,kind:'vocabulary',title:'Entries',position:0});
 snapshot.items.push({id:mode+'-item',chineseTraditional:'學校',chineseSimplified:'学校',pinyin:'xuéxiào',english:'school',partOfSpeech:'',aliases:[],metadata:{},revision:1});
 snapshot.sectionItems.push({id:mode+'-placement',sectionId:mode+'-section',itemId:mode+'-item',position:0,wasNew:true});
}
vm.runInContext(source,context);const app=context.window.test;
app.setMode('custom:word');app.actualDraw();let html=element('content').innerHTML;
for(const marker of ['class="section"','section-head static-head','dialog-content','subsection-body','word-list','data-edit-collection','Pinyin','English'])assert(html.includes(marker),marker);
assert(html.includes('Travel &lt;notes&gt;'));assert(html.includes('New when added'));assert(!html.includes('class="line clickable-row"'));
app.setMode('custom:sentence');app.actualDraw();html=element('content').innerHTML;
assert(html.includes('Sentences'));assert(html.includes('class="line clickable-row"'));assert(html.includes('data-hint-row'));assert(!html.includes('class="word-list"'));
app.openState['custom:sentence-material']=false;app.actualDraw();assert(!element('content').innerHTML.includes('class="line clickable-row"'));
console.log('PASS: custom material lesson-style sections, word and sentence layouts, hint controls, collapsing, editing link and escaped titles');

let updateStats;
context.window.CHINESE_IMPORTER.mount=(_,options)=>{updateStats=options.onStats;updateStats({total:8,newCount:3,mode:'word'});return ()=>{};};
app.setMode('material-editor');app.actualDraw();
let panel=element('modeSettings').innerHTML;
assert(panel.includes('Import statistics'));assert(panel.includes('Total words'));assert(panel.includes('data-import-total>8<'));assert(panel.includes('data-import-new>3<'));
updateStats({total:0,newCount:0,mode:'sentence'});panel=element('modeSettings').innerHTML;
assert(panel.includes('Total sentences'));assert(panel.includes('New sentences'));assert(panel.includes('data-import-total>0<'));
app.setMode('custom:word');app.actualDraw();assert(!element('modeSettings').innerHTML.includes('Import statistics'));
console.log('PASS: right-panel import statistics update for words, sentences and cleared previews, and disappear after leaving import');
