/* Text collection editor. Approved materials are persisted through the repository. */
(function(root) {
  const matching = root.ChineseApp.materialMatching;
  const escape = root.ChineseApp.text.escapeHtml;
  const drafts=new Map();
  const fields=['chineseTraditional','chineseSimplified','pinyin','english'];
  function mountEditor(container, {snapshot,repository,collectionId,onSaved}) {
    let baseline=snapshot;
    const collection=baseline.collections.find(c=>c.id===collectionId);
    let revision=collection?.revision;
    let requestId=root.crypto.randomUUID();
    let title=collection?.title || '', rawText=collection?.metadata.rawText || '', mode=collection?.metadata.mode || 'word';
    let reviewed=false, busy=false, message='', conflict=false, disposed=false, saved=false;
    let rows=[];
    const toTraditional=root.OpenCC.Converter({from:'cn',to:'tw'});
    const toSimplified=root.OpenCC.Converter({from:'tw',to:'cn'});
    function newRow(text='') {
      const chineseTraditional=toTraditional(text);
      return {chineseTraditional,chineseSimplified:toSimplified(chineseTraditional),pinyin:text?root.pinyinPro.pinyin(toSimplified(text),{toneType:'symbol',nonZh:'consecutive'}):'',english:'',included:true,itemId:null};
    }
    function candidates(row){return matching.matches(row,baseline.items);}
    function useItem(row,id) {
      const item=baseline.items.find(i=>i.id===id);
      row.itemId=id || null; row.forceNew=!id;
      if(item){for(const field of fields) row[field]=field==='chineseSimplified' ? (item[field] || toSimplified(item.chineseTraditional)) : (item[field] || '');row.expectedRevision=item.revision;}
    }
    function prepareRow(text) {
      const row=newRow(text), found=candidates(row);
      if(found.length===1) useItem(row,found[0].id);
      return row;
    }
    const sectionIds=new Set(baseline.sections.filter(s=>s.collectionId===collectionId).map(s=>s.id));
    rows=baseline.sectionItems.filter(p=>sectionIds.has(p.sectionId)).sort((a,b)=>a.position-b.position).map(p=>{
      const item=baseline.items.find(i=>i.id===p.itemId);
      return {...newRow(),...Object.fromEntries(fields.map(f=>[f,f==='chineseSimplified'?(item[f] || toSimplified(item.chineseTraditional)):(item[f] || '')])),itemId:item.id,expectedRevision:item.revision,placementId:p.id,wasNew:!!p.wasNew};
    });
    const draftKey=collectionId || 'new';
    const draft=drafts.get(draftKey);
    if(draft){({baseline,revision,requestId,title,rawText,mode,reviewed,rows,conflict,message}=draft);}
    function impact(itemId) {
      return new Set(baseline.sectionItems.filter(p=>p.itemId===itemId).map(p=>baseline.sections.find(s=>s.id===p.sectionId)?.collectionId)).size;
    }
    function changed(row){const original=baseline.items.find(i=>i.id===row.itemId);return original && fields.some(f=>(f==='chineseSimplified'?(original[f] || toSimplified(original.chineseTraditional)):(original[f]||''))!==row[f]);}
    function render() {
      if(disposed) return;
      container.innerHTML=`<section class="collection-editor"><p>Paste Chinese text, review the suggestions, then save your collection. Shared entry edits apply to every collection using that entry.</p><label>Collection name<input data-editor-title maxlength="100" value="${escape(title)}"></label><div class="editor-source"><label>Split into<select data-editor-mode><option value="word" ${mode==='word'?'selected':''}>Words</option><option value="sentence" ${mode==='sentence'?'selected':''}>Sentences</option></select></label><label>Chinese text<textarea data-editor-text maxlength="20000" rows="6" placeholder="Paste Chinese text here">${escape(rawText)}</textarea></label><button type="button" class="toggle" data-editor-action="prepare">Prepare entries</button></div><p role="status" aria-live="polite">${escape(message)}</p>${conflict?'<button type="button" class="toggle" data-editor-action="refresh">Refresh draft against latest database</button><p>Your edits are kept. Refresh updates revisions and shared-entry impact; review differences before saving again.</p>':''}<div class="editor-actions"><button type="button" class="toggle" data-editor-action="translate">Suggest missing translations</button><button type="button" class="toggle" data-editor-action="add">Add entry</button></div><p>“New” means absent from the database. After saving, “New when added” records its status at import time.</p><div class="editor-rows">${rows.map((row,index)=>{
        const found=candidates(row); const unresolved=!row.itemId&&!row.forceNew&&found.length>1;
        const count=changed(row)?impact(row.itemId):0;
        return `<article class="editor-row" data-editor-row="${index}"><div class="editor-row-head"><label><input type="checkbox" data-editor-field="included" ${row.included?'checked':''}> Include ${index+1}</label><span class="editor-badge">${row.placementId?(row.wasNew?'New when added':'In database'):(found.length?'In database':'New')}</span></div>${fields.map((field,i)=>`<label>${['Traditional Chinese','Simplified Chinese','Pinyin','English'][i]}<textarea rows="2" maxlength="${i<2?2000:4000}" data-editor-field="${field}" ${i===0?'lang="zh-Hant"':i===1?'lang="zh-Hans"':''}>${escape(row[field])}</textarea></label>`).join('')}${found.length>0?`<label>${unresolved?'Choose a matching entry before saving':'Shared entry'}<select data-editor-field="match"><option value="" ${!row.itemId&&!row.forceNew?'selected':''}>${unresolved?'Choose an entry…':'Automatic match'}</option><option value="new" ${row.forceNew?'selected':''}>Create a separate entry</option>${found.concat(row.itemId&&!found.some(i=>i.id===row.itemId)?baseline.items.filter(i=>i.id===row.itemId):[]).map(i=>`<option value="${escape(i.id)}" ${row.itemId===i.id?'selected':''}>${escape(i.chineseTraditional)} · ${escape(i.pinyin)} · ${escape(i.english)}</option>`).join('')}</select></label>`:''}<p class="editor-impact" ${count?'':'hidden'}>${count?`This edit changes the shared entry in ${count} collection(s).`:''}</p>${row.notice?`<p>${escape(row.notice)}</p>`:''}<div class="editor-actions">${[['up','↑ Move up'],['down','↓ Move down'],['merge','Merge with next'],['split','Split'],['remove','Remove']].map(([action,label])=>`<button type="button" class="filter-action" data-editor-action="${action}">${label}</button>`).join('')}</div></article>`;
      }).join('')}</div><label class="editor-review"><input type="checkbox" data-editor-reviewed ${reviewed?'checked':''}> I reviewed these entries, translations and the impact of shared edits.</label><button type="button" class="toggle active" data-editor-action="save" ${!reviewed||!rows.some(r=>r.included)||conflict?'disabled':''}>${collectionId?'Save changes':'Save collection'}</button></section>`;
      container.querySelectorAll('button,input,textarea,select').forEach(node=>{if(busy) node.disabled=true;});
    }
    async function translate() {
      const missing=rows.filter(r=>r.included&&!r.english.trim()&&r.chineseTraditional.trim());
      if(!missing.length){message='All included entries already have translations.';return;}
      message='Requesting English suggestions…';
      render();
      const result=await repository.suggestTranslations(missing.map(r=>toSimplified(r.chineseTraditional)));
      let failed=0;
      missing.forEach((row,index)=>{const suggestion=result.results[index];if(suggestion.error){row.notice=suggestion.error;failed++;}else{row.english=suggestion.english;row.notice=suggestion.needsReview?'Translated in fragments — check this translation carefully.':'Suggested translation — please review.';}});
      reviewed=false;message=failed?`${failed} translation(s) unavailable. Your entries are kept; retry missing translations or fill them in.`:'Translation suggestions ready. Review before saving.';
    }
    async function click(event) {
      const button=event.target.closest('[data-editor-action]');if(!button||busy)return;
      const action=button.dataset.editorAction;
      const index=Number(button.closest('[data-editor-row]')?.dataset.editorRow);
      try {
        if(action==='prepare'){
          if(rows.length&&!root.confirm('Replace the current entries with a fresh split of the pasted text?'))return;
          rows=matching.segment(rawText,mode).map(prepareRow);reviewed=false;message=`${rows.length} entries prepared.`;
          busy=true;render();await translate();
        } else if(action==='translate'){busy=true;render();await translate();}
        else if(action==='add'){if(rows.length>=500)throw Error('Use at most 500 entries.');rows.push(newRow());reviewed=false;}
        else if(action==='remove'){rows.splice(index,1);reviewed=false;}
        else if(action==='up'||action==='down'){const target=index+(action==='up'?-1:1);if(target>=0&&target<rows.length)[rows[index],rows[target]]=[rows[target],rows[index]];reviewed=false;}
        else if(action==='merge'&&index<rows.length-1){const row=prepareRow(rows[index].chineseTraditional+rows[index+1].chineseTraditional);rows.splice(index,2,row);reviewed=false;}
        else if(action==='split'){
          const text=root.prompt('Separate the desired entries with |', rows[index].chineseTraditional);
          if(text!==null){const parts=text.split('|').map(t=>t.trim()).filter(Boolean);if(!parts.length||rows.length-1+parts.length>500)throw Error('Use between 1 and 500 entries.');rows.splice(index,1,...parts.map(prepareRow));reviewed=false;}
        } else if(action==='refresh'){
          busy=true;baseline=await repository.load();revision=baseline.collections.find(c=>c.id===collectionId)?.revision;
          rows.forEach(row=>{const item=baseline.items.find(i=>i.id===row.itemId);if(item){row.expectedRevision=item.revision;row.notice=`Latest database: ${item.chineseTraditional} · ${item.chineseSimplified||''} · ${item.pinyin} · ${item.english}. Your draft values are kept.`;}});
          conflict=false;reviewed=false;message='Latest revisions loaded. Compare the database values with your draft and review again.';
        } else if(action==='save'){
          if(!reviewed||!title.trim())throw Error('Name the collection and review its entries.');
          const selected=rows.filter(r=>r.included);
          if(!selected.length)throw Error('Include at least one entry.');
          if(selected.some(r=>!r.itemId&&!r.forceNew&&candidates(r).length>1))throw Error('Choose a match or a separate entry for each ambiguous entry.');
          busy=true;render();
          const result=await repository.saveCustomCollection({title,mode,rawText,reviewed,requestId,expectedRevision:revision,rows:selected.map(row=>({...row,confirmedImpact:changed(row)?impact(row.itemId):undefined}))},collectionId);
          // Keep the idempotency key until both save and reload have succeeded.
          const fresh=await repository.load();
          saved=true;drafts.delete(draftKey);
          if(!disposed) onSaved(fresh,result.collectionId);return;
        }
      }catch(error){message=error.message;if(error.status===409)conflict=true;}
      finally{busy=false;render();}
    }
    function input(event){
      const target=event.target;
      if(target.hasAttribute('data-editor-reviewed')){reviewed=target.checked;render();return;}
      if(target.hasAttribute('data-editor-title'))title=target.value;
      else if(target.hasAttribute('data-editor-text'))rawText=target.value;
      else if(target.hasAttribute('data-editor-mode'))mode=target.value;
      else if(target.dataset.editorField){
        const row=rows[Number(target.closest('[data-editor-row]').dataset.editorRow)];
        const field=target.dataset.editorField;
        if(field==='match'){useItem(row,target.value==='new'?null:target.value);row.forceNew=target.value==='new';render();}
        else {
          row[field]=field==='included'?target.checked:target.value;
          if(field!=='included' && row.itemId) rows.filter(other=>other!==row && other.itemId===row.itemId).forEach(other=>{other[field]=row[field];});
        }
        const warning=target.closest('[data-editor-row]')?.querySelector('.editor-impact');
        if(warning){const count=changed(row)?impact(row.itemId):0;warning.hidden=!count;warning.textContent=count?`This edit changes the shared entry in ${count} collection(s).`:'';}
      }
      reviewed=false;
      const checkbox=container.querySelector('[data-editor-reviewed]');if(checkbox)checkbox.checked=false;
      const save=container.querySelector('[data-editor-action="save"]');if(save)save.disabled=true;
    }
    // Update badges and the impact warning after an edit without disrupting typing.
    function change(event){if(event.target.dataset.editorField && event.target.dataset.editorField!=='match')render();}
    container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('change',change);
    render();
    return ()=>{disposed=true;if(!saved)drafts.set(draftKey,{baseline,revision,requestId,title,rawText,mode,reviewed,rows,conflict,message});container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('change',change);};
  }
  // Import suggestions are read-only. Editing saved collections is a separate flow.
  function mountImport(container, {snapshot, repository, onSaved, onStats=()=>{}}) {
    const draftKey='simple-import';
    let state=drafts.get(draftKey) || {title:'',rawText:'',mode:'word',rows:[],requestId:root.crypto.randomUUID(),message:'',error:false};
    let disposed=false, busy=false, saved=false, baseline=snapshot;
    const toTraditional=root.OpenCC.Converter({from:'cn',to:'tw'});
    const toSimplified=root.OpenCC.Converter({from:'tw',to:'cn'});
    function validate() {
      if(!state.title.trim()) return ['Enter a collection name before preparing or importing your text.','[data-import-title]'];
      if(!state.rawText.trim()) return ['Paste Chinese text before preparing or importing your material.','[data-import-text]'];
      if(state.title.length>100 || state.rawText.length>20000) return ['Use a name up to 100 characters and text up to 20,000 characters.','[data-import-text]'];
      return null;
    }
    function renderPreview() {
      const confirmed=state.rows.filter(row=>row.confirmed).length;
      if(!state.rows.length) return '';
      const actions=`<div class="editor-actions import-preview-actions"><button type="button" class="toggle active" data-import-action="all">Import all entries</button><button type="button" class="toggle" data-import-action="selected">Import confirmed entries (${confirmed})</button>${state.rows.some(row=>!row.english&&!row.itemId)?'<button type="button" class="filter-action" data-import-action="retry">Retry missing translations</button>':''}</div>`;
      return `<section class="section import-preview"><div class="section-head static-head"><span class="section-heading"><span class="section-title">Import preview</span><span class="section-meta">${state.rows.length} entries · ${confirmed} confirmed</span></span></div><div class="dialog-content">${actions}<div class="import-table-scroll" role="region" aria-label="Import entries" tabindex="0"><table class="import-table"><caption class="sr-only">Read-only import suggestions. Confirm individual entries or import all entries.</caption><thead><tr><th scope="col">Chinese<br><small>Traditional / Simplified</small></th><th scope="col">Pinyin</th><th scope="col">English</th><th scope="col">Status</th><th scope="col">Confirm</th></tr></thead><tbody>${state.rows.map((row,index)=>`<tr><th scope="row"><span lang="zh-Hant">${escape(row.chineseTraditional)}</span><span class="import-simplified" lang="zh-Hans">${escape(row.chineseSimplified)}</span></th><td>${escape(row.pinyin)}</td><td>${escape(row.english || 'Translation unavailable')}${row.notice?`<details class="import-entry-notice"><summary>Note</summary><p>${escape(row.notice)}</p></details>`:''}</td><td><span class="editor-badge">${row.isNew?'New':'In database'}</span></td><td><button type="button" class="filter-action ${row.confirmed?'active':''}" data-import-action="confirm" data-import-index="${index}" aria-label="${row.confirmed?'Unconfirm':'Confirm'} entry ${index+1}" aria-pressed="${row.confirmed}">${row.confirmed?'✓':'Confirm'}</button></td></tr>`).join('')}</tbody></table></div></div></section>`;
    }
    function publishStats() {
      onStats({total:state.rows.length,newCount:state.rows.filter(row=>row.isNew).length,mode:state.mode});
    }
    function render() {
      if(disposed) return;
      container.innerHTML=`<section class="collection-editor simple-import"><details class="import-source-form" ${state.rows.length?'':'open'}><summary>${state.rows.length?'Source text and import options':'Add your text'}</summary><p class="import-form-reminder" id="import-required">Collection name and Chinese text are required. Complete both fields to prepare your import.</p><div class="import-form-fields"><label>Collection name <span aria-hidden="true">*</span><input data-import-title required aria-invalid="${state.invalidField==='[data-import-title]'}" aria-describedby="import-required" maxlength="100" value="${escape(state.title)}"></label><label>Split into<select data-import-mode><option value="word" ${state.mode==='word'?'selected':''}>Words</option><option value="sentence" ${state.mode==='sentence'?'selected':''}>Sentences</option></select></label></div><label>Chinese text <span aria-hidden="true">*</span><textarea data-import-text required aria-invalid="${state.invalidField==='[data-import-text]'}" aria-describedby="import-required" rows="3" maxlength="20000" placeholder="Paste Chinese text here">${escape(state.rawText)}</textarea></label><button type="button" class="toggle" data-import-action="prepare">Prepare import</button></details><p class="import-message" role="${state.error?'alert':'status'}" aria-live="polite">${escape(state.message)}</p>${renderPreview()}</section>`;
      if(busy) container.querySelectorAll('button,input,textarea,select').forEach(node=>{node.disabled=true;});
      publishStats();
    }
    function checkForm() {
      const invalid=validate();
      if(!invalid) return true;
      state.message=invalid[0];state.error=true;state.invalidField=invalid[1];render();
      const field=container.querySelector(invalid[1]);
      field?.closest?.('details')?.setAttribute('open','');field?.setAttribute('aria-invalid','true');field?.focus();return false;
    }
    function prepareRow(text) {
      const chineseTraditional=toTraditional(text);
      const row={chineseTraditional,chineseSimplified:toSimplified(chineseTraditional),pinyin:root.pinyinPro.pinyin(toSimplified(text),{toneType:'symbol',nonZh:'consecutive'}),english:'',confirmed:false};
      const found=matching.matches(row,baseline.items);
      row.isNew=found.length===0;
      if(found.length===1){
        const item=found[0];row.itemId=item.id;row.expectedRevision=item.revision;
        for(const field of fields) row[field]=field==='chineseSimplified'?(item[field] || toSimplified(item.chineseTraditional)):(item[field] || '');
        if(!row.english)row.notice='This database entry has no English translation. Importing keeps its existing content.';
      } else if(found.length>1){row.forceNew=true;row.notice='Multiple database matches: this will be imported as a separate entry.';}
      return row;
    }
    async function translate() {
      const missing=state.rows.filter(row=>!row.english&&!row.itemId);
      if(!missing.length){state.message='Confirm individual entries or import all entries.';return;}
      state.message='Preparing English translations…';render();
      try {
        const response=await repository.suggestTranslations(missing.map(row=>toSimplified(row.chineseTraditional)));
        missing.forEach((row,index)=>{
          const result=response.results[index];
          if(result.error) row.notice=result.error;
          else {row.english=result.english;row.notice=result.needsReview?'Translated in fragments — please check before confirming.':row.forceNew?row.notice:'';}
        });
        const failed=missing.filter(row=>!row.english).length;
        state.message=failed?`${failed} translation(s) unavailable. Retry missing translations, or import the available text.`:'Confirm individual entries or import all entries.';
      } catch(error){state.message=`Translations unavailable: ${error.message}. Your text is kept; you can retry.`;state.error=true;}
    }
    async function click(event) {
      const button=event.target.closest('[data-import-action]');if(!button||busy) return;
      const action=button.dataset.importAction;
      state.error=false;
      try {
        if(action==='prepare') {
          if(!checkForm()) return;
          const texts=matching.segment(state.rawText,state.mode);
          if(!texts.length) throw Error('Paste text containing Chinese characters to prepare an import.');
          if(texts.some(text=>text.length>2000)) throw Error('An entry is too long. Use shorter sentences or choose Words.');
          state.rows=texts.map(prepareRow);state.requestId=root.crypto.randomUUID();busy=true;render();await translate();
        } else if(action==='confirm') {
          const row=state.rows[Number(button.dataset.importIndex)];
          if(row) row.confirmed=!row.confirmed;
        } else if(action==='retry') {state.rows.forEach(row=>{if(!row.english)row.confirmed=false;});busy=true;render();await translate();}
        else if(action==='all'||action==='selected') {
          if(!checkForm()) return;
          const selected=action==='all'?state.rows:state.rows.filter(row=>row.confirmed);
          if(!selected.length) throw Error('Confirm at least one entry, or choose Import all entries.');
          busy=true;state.message='Importing your collection…';render();
          const rows=selected.map(row=>{
            if(!row.itemId) return row;
            // Importing must never edit a shared entry, even when a missing translation was suggested.
            const item=baseline.items.find(item=>item.id===row.itemId);
            return {...row,...Object.fromEntries(fields.map(field=>[field,field==='chineseSimplified'?(item[field] || toSimplified(item.chineseTraditional)):(item[field] || '')]))};
          });
          const result=await repository.saveCustomCollection({title:state.title,rawText:state.rawText,mode:state.mode,reviewed:true,requestId:state.requestId,rows});
          const fresh=await repository.load();saved=true;drafts.delete(draftKey);
          if(!disposed) onSaved(fresh,result.collectionId);
        }
      } catch(error){
        state.message=error.message;state.error=true;
        if(error.status===409){
          try {baseline=await repository.load();state.rows=state.rows.map(row=>prepareRow(row.chineseTraditional));state.requestId=root.crypto.randomUUID();state.message='The database changed. Review the refreshed preview and confirm your import again.';}
          catch {state.message='Could not refresh the database. Your text is kept; prepare the import again to retry.';}
        }
      } finally {busy=false;render();if(state.invalidField){const field=container.querySelector(state.invalidField);field?.closest?.('details')?.setAttribute('open','');field?.focus();}}
    }
    function input(event) {
      if(busy) return;
      const target=event.target;
      if(target.hasAttribute('data-import-title')) state.title=target.value;
      else if(target.hasAttribute('data-import-text')) state.rawText=target.value;
      else if(target.hasAttribute('data-import-mode')) state.mode=target.value;
      else return;
      // Clear generated entries immediately so outdated suggestions cannot be confirmed.
      if(!target.hasAttribute('data-import-title') && state.rows.length){state.rows=[];state.message='Source changed. Choose Prepare import to generate a fresh preview.';container.querySelector('.simple-import .section')?.remove();const message=container.querySelector('.import-message');if(message)message.textContent=state.message;publishStats();}
      state.error=false;state.invalidField=null;target.removeAttribute?.('aria-invalid');
    }
    container.addEventListener('click',click);container.addEventListener('input',input);
    render();
    return ()=>{disposed=true;if(!saved)drafts.set(draftKey,state);container.removeEventListener('click',click);container.removeEventListener('input',input);};
  }

  root.CHINESE_IMPORTER={mount:(container,options)=>options.collectionId?mountEditor(container,options):mountImport(container,options)};
})(typeof window!=='undefined'?window:globalThis);
