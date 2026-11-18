/* Prediction form, team-coloured dropdowns, Bingo and online submission.
   Questions, validation groups and options come from the season file.
   Team and driver options come from f1.json. */
(async () => {
  'use strict';
  const app = window.F1App;
  if (app.page !== 'predictions') return;
  const {el} = app;
  const form = document.getElementById('predictionForm');
  try {
    const [f1, data] = await Promise.all([app.load('f1'),app.load('results')]);
    const connection = await app.load('submission');
    const config = PredictionCore.validateConfig(await app.load(connection.seasonFile));
    const teamById = new Map(f1.teams.map(t => [t.id,t]));
    const driversIn = ids => ids.flatMap(id => (teamById.get(id)?.drivers || []).map(d=>d.name));
    const optionLists = config.optionLists;
    const bingo = document.getElementById('bingo');
    const totalStages = config.stages.length + 1;
    const colors = new Map();
    f1.teams.forEach(team => {
      const color=app.teamToken(team.id);
      [team.name,...(team.aliases||[]),...team.drivers.flatMap(d=>[d.name,d.profileName].filter(Boolean))].forEach(name=>colors.set(name,color));
    });
    // Generate native form controls first. The existing combobox UI enhancement
    // uses these controls as its accessible, export-compatible source of truth.
    function field(item,questionId) {
      if(item.type==='checkboxes'){
        return el('div',{class:'driver-buttons','data-required':String(item.required),role:'group','aria-labelledby':questionId},optionLists[item.options].map(name=>el('label',{},el('input',{type:'checkbox',name:item.name,value:name}),` ${name}`)));
      }
      const id=`field-${item.name}`;
      let input;
      if(item.type==='select') {
        input=el('select',{id,name:item.name,required:item.required},el('option',{value:'',disabled:true,selected:true},item.placeholder||'-- Valitse --'),optionLists[item.options].map(name=>el('option',{value:name},name)));
      } else {
        input=el('input',{id,name:item.name,type:item.type,required:item.required,min:item.min,max:item.max,step:item.step});
      }
      return el('div',{class:`prediction-field${item.type==='number'?' number-field':''}`},el('label',{for:id},item.label),input);
    }
    function question(q) {
      const id=`question-${q.number}`;
      return el('div',{class:'question-layout'},
        el('div',{class:'prediction-question','aria-labelledby':id},
          el('p',{class:'question-title',id},`${q.number}. ${q.text}`),
          q.help?el('span',{class:'selection-help'},q.help):null,q.fields.map(item=>field(item,id))),
        el('aside',{class:'question-score','aria-label':'Pisteytys'},el('strong',{},'Pisteytys'),el('div',{},q.scoring)));
    }
    config.stages.forEach((stage,index) => {
      const node=el('section',{id:stage.id,class:'prediction-stage'},
        el('div',{class:'stage-kicker'},`OSIO ${index+1} / ${totalStages}`),el('h2',{tabindex:'-1'},stage.title),
        el('div',{class:'section-content'},el('div',{class:'questions'},stage.questions.map(question))));
      bingo.before(node);
    });
    bingo.querySelector('.stage-kicker').textContent=`OSIO ${totalStages} / ${totalStages}`;
    bingo.querySelector('.bingo-container>p').textContent=`${config.bingo.number}. ${config.bingo.instructions}`;
    bingo.querySelector('#bingo-event-list').replaceChildren(...config.bingo.scenarios.map(scenario=>el('button',{class:'bingo-event-option','data-scenario':scenario,type:'button'},scenario)));
    const bingoScore=bingo.querySelector('.points-info p');
    config.bingo.scoring.forEach((line,index)=>{if(index)bingoScore.append(el('br'));bingoScore.append(line);});
    bingo.removeAttribute('data-render');
    // Update visible season labels from the shared configuration.
    document.querySelector('main>h1').textContent=`Ennustukset ${config.season}`;
    const intro=document.querySelector('main>p');intro.textContent=`Tee ennustuksesi Formula 1 -kaudesta ${config.season} vaihe vaiheelta. Voit siirtyä osioiden välillä vapaasti ja muuttaa vastauksiasi ennen tallennusta. Luonnos tallentuu tähän selaimeen. Lähetä valmis ennustus järjestäjälle viimeisessä vaiheessa.`;
    document.querySelector('.progress-heading .eyebrow').textContent=`KISASUUNNITELMA / ${config.season}`;
    setupPredictionUI(config,colors);
    window.setupPredictionSubmission(config, data.players, connection);
    form.hidden=false;
    document.querySelector('[data-render="prediction-status"]').remove();
  } catch(error) {
    form.hidden=true;
    app.showError(error,document.querySelectorAll('[data-render="prediction-status"]'));
  }

function setupPredictionUI(config, colors) {
  const form = document.getElementById('predictionForm');
  if (!form) return;
  const stages = [...form.querySelectorAll('.prediction-stage')];
  const questions = [...form.querySelectorAll('.prediction-question')];
  const cells = [...form.querySelectorAll('.bingo-cell')];
  const exclusiveGroups = config.exclusiveGroups.map(group=>group.fields);
  const groupFor = name => exclusiveGroups.find(group => group.includes(name)) || [];
  const usedElsewhere = select => new Set(groupFor(select.name).filter(n=>n!==select.name).map(n=>form.elements[n]?.value).filter(Boolean));
  const combos = new Map();
  let openCombo = null, stageIndex=0;
  function syncAll() {
    for(const combo of combos.values()) combo.sync();
    updateProgress();
  }
  function enhance(select) {
    const field = select.parentElement, label = field.querySelector('label');
    const allOptions = [...select.options].map(o => ({value:o.value,text:o.textContent.trim()}));
    const wrap = document.createElement('div'); wrap.className='team-select';
    const button = document.createElement('button'); button.type='button'; button.className='team-select-trigger';
    button.id=select.id+'-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',select.id+'-options');button.setAttribute('aria-required',String(select.required));
    label.id=select.id+'-label';label.htmlFor=button.id;
    const line=document.createElement('span');line.className='team-line';line.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.className='selected-name';text.id=select.id+'-text';
    button.setAttribute('aria-labelledby',label.id+' '+text.id);button.append(line,text);
    const list=document.createElement('div');list.id=select.id+'-options';list.className='team-options';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby',label.id);list.hidden=true;
    wrap.append(button,list);field.append(wrap);select.hidden=true;
    let visible=[], active=-1, search='', lastKey=0;
    function mark(index,scroll=true){
      if(!visible.length)return;
      active=Math.max(0,Math.min(visible.length-1,index));
      [...list.children].forEach((el,i)=>el.classList.toggle('is-active',i===active));
      button.setAttribute('aria-activedescendant',list.children[active].id);
      if(scroll)list.children[active].scrollIntoView({block:'nearest'});
    }
    function render(){
      const used=usedElsewhere(select);
      visible=allOptions.filter(o=>!o.value || o.value===select.value || !used.has(o.value));
      list.replaceChildren();
      visible.forEach((option,i)=>{
        const el=document.createElement('div');el.className='team-option';el.id=list.id+'-'+i;el.setAttribute('role','option');el.setAttribute('aria-selected',String(option.value===select.value));
        const stripe=document.createElement('span');stripe.className='team-line';stripe.style.setProperty('--driver-color',colors.get(option.value)||'var(--fallback-stripe)');stripe.setAttribute('aria-hidden','true');
        const name=document.createElement('span');name.textContent=option.value?option.text:'Tyhjennä valinta';el.append(stripe,name);
        el.addEventListener('pointerdown',e=>e.preventDefault());el.addEventListener('click',()=>choose(i));list.append(el);
      });
    }
    function sync(){
      const selected=allOptions.find(o=>o.value===select.value)||allOptions[0];
      text.textContent=selected.text.replace(/^--\s*|\s*--$/g,'');line.style.setProperty('--driver-color',colors.get(selected.value)||'var(--fallback-stripe)');button.classList.toggle('is-placeholder',!select.value);
      if(!list.hidden){render();mark(visible.findIndex(o=>o.value===select.value),false);}
    }
    function close(){list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');if(openCombo===api)openCombo=null;search='';}
    function open(){if(openCombo&&openCombo!==api)openCombo.close();render();list.hidden=false;button.setAttribute('aria-expanded','true');openCombo=api;mark(Math.max(0,visible.findIndex(o=>o.value===select.value)));}
    function choose(i){if(!visible[i])return;select.value=visible[i].value;close();select.dispatchEvent(new Event('change',{bubbles:true}));button.focus({preventScroll:true});}
    const api={sync,close,button,wrap};combos.set(select,api);
    button.addEventListener('click',()=>list.hidden?open():close());
    button.addEventListener('keydown',e=>{
      const key=e.key;
      if(key==='Tab'){close();return;}
      if(key==='Escape'){if(!list.hidden){e.preventDefault();e.stopPropagation();close();}return;}
      if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(key)){
        e.preventDefault();
        if(list.hidden){open();if(key==='End')mark(visible.length-1);if(key==='Home')mark(0);return;}
        if(key==='Enter'||key===' '){choose(active);return;}
        mark(key==='Home'?0:key==='End'?visible.length-1:active+(key==='ArrowDown'?1:-1));return;
      }
      if(key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();if(list.hidden)open();const now=Date.now();search=(now-lastKey>750?'':search)+key.toLocaleLowerCase('fi');lastKey=now;const match=visible.findIndex(o=>o.value.toLocaleLowerCase('fi').startsWith(search));if(match>=0)mark(match);}
    });
    select.addEventListener('change',syncAll);sync();
  }
  form.querySelectorAll('.prediction-field select').forEach(enhance);
  document.addEventListener('pointerdown',e=>{if(openCombo&&!openCombo.wrap.contains(e.target))openCombo.close();});
  document.addEventListener('focusin',e=>{if(openCombo&&!openCombo.wrap.contains(e.target))openCombo.close();});
  form.querySelectorAll('.driver-buttons input').forEach(input=>input.closest('label').style.setProperty('--driver-color',colors.get(input.value)||'var(--fallback-stripe)'));
  const list=document.getElementById('stage-list'), progress=document.getElementById('prediction-progress'), error=document.getElementById('prediction-error');
  const next=document.getElementById('next-stage'),previous=document.getElementById('previous-stage'),submit=form.querySelector('button[type=submit]');
  const stagePosition=document.getElementById('stage-position');
  const stageButtons=stages.map((stage,i)=>{
    const button=document.createElement('button');button.type='button';button.className='stage-button';button.setAttribute('aria-controls',stage.id);
    const name=document.createElement('span');name.className='stage-name';name.textContent=stage.querySelector('h2').textContent;
    const state=document.createElement('span');state.className='stage-state';button.append(name,state);list.append(button);button.addEventListener('click',()=>showStage(i,true));return button;
  });
  function complete(question){
    const required=[...question.querySelectorAll('select[required],input[required]')];
    const checks=[...question.querySelectorAll('[data-required="true"] input[type=checkbox]')];
    return required.every(input=>input.value!==''&&input.validity.valid)&&(!checks.length||checks.some(c=>c.checked));
  }
  function bingoCount(){return cells.filter(c=>c.dataset.event&&c.dataset.result!==undefined).length;}
  function updateProgress(){
    const bingo=bingoCount(),done=questions.filter(complete).length+(bingo===9?1:0),total=questions.length+1;
    const meter=document.getElementById('prediction-meter');meter.max=total;meter.value=done;
    document.getElementById('progress-label').textContent=`${done} / ${total} kysymystä vastattu`;
    document.getElementById('progress-percent').textContent=Math.round(done/total*100)+' %';
    document.getElementById('bingo-progress').textContent=`Bingo ${bingo}/9`;
    stages.forEach((stage,i)=>{const qs=[...stage.querySelectorAll('.prediction-question')];const count=qs.length?qs.filter(complete).length:bingo;const max=qs.length||9;const btn=stageButtons[i];btn.querySelector('.stage-state').textContent=count===max?'✓':`${count}/${max}`;btn.classList.toggle('is-complete',count===max);btn.setAttribute('aria-label',`${stage.querySelector('h2').textContent}, ${count}/${max} ${qs.length?'kysymystä':'ruutua'}`);});
    questions.forEach(q=>{if(complete(q)){q.classList.remove('invalid');q.querySelectorAll('[aria-invalid=true]').forEach(e=>e.removeAttribute('aria-invalid'));}});
  }
  function showStage(i,focus=false){
    if(i<0||i>=stages.length)return;openCombo?.close();stageIndex=i;
    stages.forEach((stage,j)=>stage.hidden=j!==i);stageButtons.forEach((b,j)=>{if(j===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    previous.disabled=i===0;next.hidden=i===stages.length-1;submit.hidden=i!==stages.length-1;
    stagePosition.textContent=`Osio ${i+1} / ${stages.length}`;
    document.getElementById('current-stage').textContent=stagePosition.textContent+' · '+stages[i].querySelector('h2').textContent;
    error.hidden=true;
    if(focus){stages[i].querySelector('h2').focus({preventScroll:true});stages[i].scrollIntoView({block:'start',behavior:'instant'});}
    updateProgress();
  }
  previous.addEventListener('click',()=>showStage(stageIndex-1,true));next.addEventListener('click',()=>showStage(stageIndex+1,true));
  form.addEventListener('input',updateProgress);form.addEventListener('change',updateProgress);
  // Choose a scenario and outcome; automatically advance to the next empty cell.
  const picker=document.getElementById('eventPicker'), eventList=document.getElementById('bingo-event-list'), outcome=document.getElementById('bingo-outcome'), title=document.getElementById('bingo-picker-title'), announcement=document.getElementById('bingo-announcement');
  const eventButtons=[...eventList.querySelectorAll('button')];
  let activeCell=null, selectedEvent='';
  function chooseCell(cell, focus=false){
    activeCell=cell; selectedEvent='';
    cells.forEach(c=>c.setAttribute('aria-pressed',String(c===cell)));
    const used=new Set(cells.filter(c=>c!==cell).map(c=>c.dataset.event).filter(Boolean));
    eventButtons.forEach(b=>{b.hidden=used.has(b.dataset.scenario);});
    eventList.hidden=false; outcome.hidden=true; picker.hidden=false;
    title.textContent=`Ruutu ${Number(cell.dataset.index)+1} – valitse tapahtuma`;
    if(focus)eventButtons.find(b=>!b.hidden)?.focus({preventScroll:true});
  }
  cells.forEach(cell=>{cell.setAttribute('aria-pressed','false');cell.addEventListener('click',()=>chooseCell(cell,true));});
  eventButtons.forEach(button=>button.addEventListener('click',()=>{
    selectedEvent=button.dataset.scenario; eventList.hidden=true; outcome.hidden=false;
    title.textContent=`Ruutu ${Number(activeCell.dataset.index)+1} – tapahtuuko se?`;
    document.getElementById('bingo-selected-event').textContent=selectedEvent;
    outcome.querySelector('button').focus({preventScroll:true});
  }));
  document.getElementById('bingo-back').addEventListener('click',()=>chooseCell(activeCell,true));
  outcome.querySelectorAll('[data-outcome]').forEach(button=>button.addEventListener('click',()=>{
    if(!activeCell||!selectedEvent)return;
    const result=button.dataset.outcome, cell=activeCell;
    cell.dataset.event=selectedEvent;cell.dataset.result=result;
    cell.textContent=(result==='true'?'✓ ':'✕ ')+selectedEvent;
    cell.setAttribute('aria-label',`Ruutu ${Number(cell.dataset.index)+1}: ${result==='true'?'Tapahtuu':'Ei tapahdu'}, ${selectedEvent}`);
    cell.setAttribute('aria-pressed','false');updateProgress();form.dispatchEvent(new Event('change',{bubbles:true}));
    announcement.textContent=`Ruutu ${Number(cell.dataset.index)+1} tallennettu. ${bingoCount()}/9 ruutua.`;
    const nextCell=cells.find(c=>!c.dataset.event);
    if(nextCell){chooseCell(nextCell,true);}else{activeCell=null;eventList.hidden=true;outcome.hidden=true;title.textContent='Bingo valmis – muokkaa valintaa klikkaamalla ruutua';cell.focus({preventScroll:true});}
  }));
  chooseCell(cells[0]);
  // Validate after navigating to a hidden section, before the legacy export listener runs.
  form.noValidate=true;
  form.addEventListener('submit',event=>{
    if(stageIndex!==stages.length-1){event.preventDefault();event.stopImmediatePropagation();showStage(stageIndex+1,true);return;}
    const incomplete=questions.find(q=>!complete(q));
    if(incomplete||bingoCount()!==9){
      event.preventDefault();event.stopImmediatePropagation();
      if(incomplete){showStage(stages.indexOf(incomplete.closest('section')),true);incomplete.classList.add('invalid');error.textContent=`Vastaa vielä kysymykseen ${incomplete.querySelector('p').textContent.match(/^\d+/)?.[0]||''}. Tarkista myös lukuarvot.`;error.hidden=false;
        const input=[...incomplete.querySelectorAll('select[required],input[required]')].find(el=>!el.value||!el.validity.valid)||incomplete.querySelector('input[type=checkbox]');
        if(input){const target=combos.get(input)?.button||input;target.setAttribute('aria-invalid','true');target.focus({preventScroll:true});incomplete.scrollIntoView({block:'center',behavior:'instant'});}
      }else{error.textContent=`Täytä vielä ${9-bingoCount()} bingoruutua.`;error.hidden=false;cells.find(c=>!c.dataset.event)?.focus();}
    }
  },true);
  [progress,document.getElementById('stage-navigation'),next,previous,stagePosition].forEach(el=>el.hidden=false);
  showStage(0);syncAll();

}

})();
