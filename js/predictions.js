/* Prediction form, team-coloured dropdowns, Bingo and local TXT export.
   All questions, validation groups and scenarios come from results.json.
   Team and driver options come from f1.json. */
(async () => {
  'use strict';
  const app = window.F1App;
  if (app.page !== 'predictions') return;
  const {el} = app;
  const form = document.getElementById('predictionForm');
  try {
    const [f1, data] = await Promise.all([app.load('f1'),app.load('results')]);
    const config = data.prediction;
    const teamById = new Map(f1.teams.map(t => [t.id,t]));
    const driversIn = ids => ids.flatMap(id => (teamById.get(id)?.drivers || []).map(d=>d.name));
    const optionLists = {
      drivers:driversIn(f1.driverTeamOrder || f1.teams.map(t=>t.id)),
      driversByCheckboxOrder:driversIn(f1.checkboxTeamOrder || f1.teams.map(t=>t.id)),
      midfieldDrivers:driversIn(f1.midfieldTeams),
      teams:f1.teams.map(t=>t.name)
    };
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
        return el('div',{class:'driver-buttons',role:'group','aria-labelledby':questionId},optionLists[item.options].map(name=>el('label',{},el('input',{type:'checkbox',name:item.name,value:name}),` ${name}`)));
      }
      const id=`field-${item.name}`;
      let input;
      if(item.type==='select') {
        input=el('select',{id,name:item.name,required:item.required},el('option',{value:'',disabled:true,selected:true},item.placeholder),optionLists[item.options].map(name=>el('option',{value:name},name)));
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
    const intro=document.querySelector('main>p');intro.textContent=`Tee ennustuksesi Formula 1 -kaudesta ${config.season} vaihe vaiheelta. Voit siirtyä osioiden välillä vapaasti ja muuttaa vastauksiasi ennen tallennusta. Lopuksi saat vastauksesi tekstitiedostona.`;
    document.querySelector('.progress-heading .eyebrow').textContent=`YOUR RACE PLAN / ${config.season}`;
    setupPredictionUI(config,colors);
    setupExport(config);
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
    const checks=[...question.querySelectorAll('input[type=checkbox]')];
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
    cell.setAttribute('aria-pressed','false');updateProgress();
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

function setupExport(config) {
  const form = document.getElementById('predictionForm');
  if (!form) {
    console.warn("predictionForm not found");
    return;
  }

  // Helper: get human label text for an input (if label wraps the input or uses for=)
  function labelTextForInput(input) {
    const wrapped = input.closest('label');
    if (wrapped) return wrapped.textContent.trim();
    if (input.id) {
      const lab = document.querySelector(`label[for="${input.id}"]`);
      if (lab) return lab.textContent.trim();
    }
    return null;
  }

  /// Collect answers for a single <p> question in a section:
function collectAnswersForQuestion(section, questionP) {
  const answers = [], seenNames = new Set();
  const question = questionP.closest('.prediction-question');
  if (!question) return answers;
  for (const input of question.querySelectorAll('input, select, textarea')) {
    if (!seenNames.has(input.name)) {
      processInput(input, answers, section);
      seenNames.add(input.name);
    }
  }
  return answers;
}

function processInput(input, answers, section) {
  const name = input.name || input.id || '(unnamed)';

  if (input.tagName.toLowerCase() === 'select') {
    const selected = input.options[input.selectedIndex];
    answers.push({
      key: name,
      value: selected && selected.value ? selected.text : '(ei vastausta)'
    });

  } else if (input.type === 'checkbox') {
    const checked = Array.from(section.querySelectorAll(
      `input[type="checkbox"][name="${CSS.escape(name)}"]`
    )).filter(c => c.checked).map(c => labelTextForInput(c) || c.value);
    if (checked.length) answers.push({ key: name, value: checked.join(', ') });

  } else if (input.type === 'radio') {
    const checked = section.querySelector(
      `input[type="radio"][name="${CSS.escape(name)}"]:checked`
    );
    if (checked) answers.push({ key: name, value: labelTextForInput(checked) || checked.value });

  } else if (['text','number'].includes(input.type) || input.tagName.toLowerCase() === 'textarea') {
    if (input.value) answers.push({ key: name, value: input.value });
  }
}


// Create readable text for one section
function collectSectionText(section) {
  let text = "";
  const titleEl = section.querySelector("h2");
  const title = titleEl ? titleEl.textContent.trim() : "(Ilman otsikkoa)";
  text += `=== ${title} ===\n`;

  // only <p> inside .questions
  const ps = Array.from(section.querySelectorAll(".question-title"));
  if (ps.length === 0) {
    text += "  (ei kysymyksiä tai vastauksia)\n\n";
    return text;
  }

  ps.forEach(p => {
    text += p.textContent.trim() + "\n";
    const ans = collectAnswersForQuestion(section, p);
    if (ans.length) {
      ans.forEach(a => { text += `  - ${a.value}\n`; });
    } else {
      text += "  - (ei vastausta)\n";
    }
    text += "\n";
  });

  return text;
}

  // Checks that no driver/team is picked twice in the same question and that the bingo card is full
  function validateForm(f) {
    const groups = config.exclusiveGroups.map(group=>[group.fields,group.message]);
    for (const [names, msg] of groups) {
      const values = names.map(n => f.elements[n] ? f.elements[n].value : '').filter(Boolean);
      if (new Set(values).size !== values.length) return msg;
    }
    const emptyBingo = Array.from(document.querySelectorAll('.bingo-cell')).filter(c => !c.dataset.event).length;
    if (emptyBingo > 0) return 'Bingo: täytä kaikki 9 ruutua (puuttuu ' + emptyBingo + ').';
    return null;
  }

  // ---- Name dialog + final save ----
  const modal = document.getElementById('nameModal');
  const nameInput = document.getElementById('playerName');
  const nameError = document.getElementById('nameError');
  const saveStatus = document.getElementById('saveStatus');

  function storedName() {
    try { return localStorage.getItem('currentUser') || ''; } catch (err) { return ''; }
  }

  function openNameModal() {
    nameInput.value = storedName();
    nameError.hidden = true;
    modal.hidden = false;
    nameInput.focus();
    nameInput.select();
  }

  function closeNameModal() {
    modal.hidden = true;
  }

  // Builds the text file contents for the given player
  function buildOutput(playerName) {
    const now = new Date().toLocaleString();
    let output = `F1 Ennustukset ${config.season}\nPelaaja: ${playerName}\nTallennettu: ${now}\n\n`;

    // Collect each <section>
    const sections = Array.from(form.querySelectorAll('section'));
    if (sections.length === 0) {
      // fallback: collect entire form fields generically
      const fd = new FormData(form);
      output += '=== Vastaukset ===\n';
      const map = {};
      for (const [k, v] of fd.entries()) {
        if (!map[k]) map[k] = [];
        map[k].push(v);
      }
      for (const k of Object.keys(map)) {
        output += `  - ${k}: ${map[k].join(', ')}\n`;
      }
      output += '\n';
    } else {
      sections.forEach(section => {
        if (section.id === 'bingo') return; // bingo card is written separately below
        output += collectSectionText(section);
      });
    }

    // Bingo card
    output += '=== Bingo-kortti ===\n';
    const bingoCells = Array.from(document.querySelectorAll('.bingo-cell'));
    if (bingoCells.length === 0) {
      output += '  (ei bingo-kenttää)\n';
    } else {
      bingoCells.forEach((cell, i) => {
        const ev = cell.dataset.event;
        const res = cell.dataset.result;
        if (ev) {
          const symbol = res === 'true' ? '✔' : (res === 'false' ? '✘' : '?');
          output += `Ruutu ${i+1}: ${symbol} ${ev}\n`;
        } else {
          output += `Ruutu ${i+1}: (tyhjä)\n`;
        }
      });
    }
    return output;
  }

  // Downloads the text file, returns the file name (or null on failure)
  function downloadAnswers(playerName) {
    try {
      const safeName = playerName.replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_.-]/gu, '') || 'pelaaja';
      const filename = `ennustukset_${safeName}.txt`;
      const blob = new Blob([buildOutput(playerName)], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return filename;
    } catch (err) {
      console.error('Failed to create download:', err);
      alert('Tiedoston luonti epäonnistui.');
      return null;
    }
  }

  function confirmSave() {
    const playerName = nameInput.value.trim();
    if (!playerName) {
      nameError.hidden = false;
      nameInput.focus();
      return;
    }
    try { localStorage.setItem('currentUser', playerName); } catch (err) { /* storage not available */ }
    const filename = downloadAnswers(playerName);
    if (filename) {
      closeNameModal();
      saveStatus.textContent = `✔ Ennustukset tallennettu tiedostoon ${filename}.`;
      saveStatus.hidden = false;
      saveStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Step 1: pressing Tallenna validates the form and asks for the name
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const problem = validateForm(this);
    if (problem) {
      alert(problem);
      return;
    }
    saveStatus.hidden = true;
    openNameModal();
  });

  // Step 2: the final save happens from the dialog
  document.getElementById('nameConfirm').addEventListener('click', confirmSave);
  document.getElementById('nameCancel').addEventListener('click', closeNameModal);
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmSave(); }
    if (e.key === 'Escape') closeNameModal();
  });
  modal.addEventListener('click', e => { if (e.target === modal) closeNameModal(); });

}
})();
