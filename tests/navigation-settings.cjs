const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
function load(saved={}) {
 const elements=new Map();const storage=new Map(Object.keys(saved).length?[['chinese-exam-settings-v1',JSON.stringify(saved)]]:[]);
 function element(key){if(!elements.has(key))elements.set(key,{innerHTML:'',listeners:{},classList:{toggle(){}},setAttribute(){},querySelector(){return null;},querySelectorAll(){return [];},insertAdjacentHTML(_,html){this.innerHTML+=html;},addEventListener(type,fn){this.listeners[type]=fn;}});return elements.get(key);}
 const context=vm.createContext({window:{},console,document:{getElementById:element,querySelector:element,documentElement:element('root'),addEventListener(){}},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
 const runtime=require('./helpers/runtime.cjs');runtime.loadRuntime(context);
 let source=runtime.appSource(context).replace('function draw() {','function actualDraw() {');
 source=source.replace(/  draw\(\);\n\}\)\(\);\s*$/,`function draw() {}\nwindow.test={actualDraw,handleNavigation,appSettings,hintState,setMode:value=>currentLesson=value,getMode:()=>currentLesson,renderMaterialScope};\n})();`);
 const snapshot=context.window.__TEST_SNAPSHOT;snapshot.collections.push({id:'user',key:'custom:user',kind:'custom',title:'My <collection>',metadata:{mode:'word'},revision:1});
 vm.runInContext(source,context);return {app:context.window.test,element,storage};
}
let {app,element,storage}=load();app.actualDraw();
assert(element('studyToolsNav').innerHTML.includes('data-my-materials'));
assert(!element('lessonNav').innerHTML.includes('data-add-materials'));assert(!element('lessonNav').innerHTML.includes('data-custom-collection'));
assert.equal(app.appSettings.listPinyin,true);assert.equal(app.appSettings.listEnglish,true);
assert(element('content').innerHTML.includes('<rt>'));assert(element('content').innerHTML.includes('class="word-english"'));
assert(!element('modeSettings').innerHTML.includes('data-setting="listPinyin"'));assert(!element('modeSettings').innerHTML.includes('data-setting="listEnglish"'));
const scope=app.renderMaterialScope('vocabulary');
assert(scope.includes('material-scope-lesson'));assert(scope.includes('data-vocabulary-scope-lesson="1"'));
assert(scope.includes('data-vocabulary-scope="1-dialog1"'));assert(scope.includes('data-vocabulary-scope="1-dialog2"'));
app.handleNavigation({target:{closest:selector=>selector==='[data-my-materials]'?{}:null}});assert.equal(app.getMode(),'my-materials');app.actualDraw();
assert(element('content').innerHTML.includes('data-material-manager'));assert(element('content').innerHTML.includes('data-add-materials'));assert(element('content').innerHTML.includes('data-edit-collection="user"'));assert(element('content').innerHTML.includes('My &lt;collection&gt;'));
app.setMode('settings');app.actualDraw();assert(element('content').innerHTML.includes('data-setting="listPinyin"'));assert(element('content').innerHTML.includes('data-setting="listEnglish"'));
const setting={dataset:{setting:'listPinyin'},checked:false};
element('.shell').listeners.change({target:{matches:()=>false,closest:selector=>selector==='[data-setting]'?setting:null}});
assert.equal(app.appSettings.listPinyin,false);assert.equal(JSON.parse(storage.get('chinese-exam-settings-v1')).listPinyin,false);
app.setMode('vocabulary');app.actualDraw();assert.equal(app.hintState['vocabulary-all'].pinyin,false);assert.equal(app.hintState['vocabulary-all'].english,true);
const reloaded=load({listPinyin:false,listEnglish:false});assert.equal(reloaded.app.appSettings.listPinyin,false);assert.equal(reloaded.app.appSettings.listEnglish,false);
console.log('PASS: navbar material management, escaped collection list, visible default hints, global-only hint preferences, persistence and compact dialog scope controls');
