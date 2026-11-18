/* Drafts stay in this browser. Only explicit submissions go to the private Sheet. */
window.setupPredictionSubmission = function(config, players, connection) {
  'use strict';
  const form=document.getElementById('predictionForm'), core=PredictionCore;
  const key=`f1-draft:${config.season}:${config.revision}`, draftStatus=document.getElementById('draft-status');
  const modal=document.getElementById('nameModal'), player=document.getElementById('playerName'), code=document.getElementById('playerCode');
  const error=document.getElementById('nameError'), confirm=document.getElementById('nameConfirm'), cancel=document.getElementById('nameCancel'), status=document.getElementById('saveStatus');
  const availability=document.getElementById('submission-availability');
  let busy=false, returnFocus=null, pending=null, lastReceipt=null;
  players.slice().sort((a,b)=>a.name.localeCompare(b.name,'fi')).forEach(p=>player.add(new Option(p.name,p.id)));
  const setupMode=config.collectionMode==='setup';
  const validEndpoint=/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(connection.endpoint);
  availability.textContent=validEndpoint ? `Lähetä viimeistään ${new Date(config.deadline).toLocaleString('fi-FI',{timeZone:'Europe/Helsinki'})} (Suomen aikaa).` : 'Esikatselu: verkkolähetystä ei ole vielä otettu käyttöön. Voit kokeilla lomaketta; vastaukset säilyvät vain tässä selaimessa.';
  if(setupMode) availability.textContent='Kausi on valmistelussa. Kuljettajat on päivitetty, mutta bingon tapahtumat ovat vielä alustavia. Voit kokeilla lomaketta ja tallentaa luonnoksen; lähetys avataan myöhemmin.';
  const read=()=>{
    const fd=new FormData(form), a={};
    core.fields(config).forEach(f=>{const v=fd.get(f.name);a[f.name]=f.type==='checkboxes'?fd.getAll(f.name):f.type==='number'&&v!==''&&v!==null?Number(v):v||'';});
    a.bingo=[...form.querySelectorAll('.bingo-cell')].map(c=>({event:c.dataset.event||'',result:c.dataset.result==='true'?true:c.dataset.result==='false'?false:null}));return a;
  };
  function save() {
    try {localStorage.setItem(key,JSON.stringify({answers:read(),playerId:player.value,pending,lastReceipt}));draftStatus.textContent='Luonnos tallennettu tähän selaimeen. Luonnos ei ole lähetetty ennustus.';}
    catch {draftStatus.textContent='Selain ei salli luonnoksen tallennusta. Pidä sivu auki lähetykseen asti.';}
  }
  try {
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved?.answers){
      core.fields(config).forEach(f=>{
        const value=saved.answers[f.name];
        [...form.elements].filter(e=>e.name===f.name).forEach(e=>{if(e.type==='checkbox')e.checked=Array.isArray(value)&&value.includes(e.value);else if(value!==undefined)e.value=value;});
      });
      [...form.querySelectorAll('.bingo-cell')].forEach((cell,i)=>{
        const b=saved.answers.bingo?.[i];if(!b||!config.bingo.scenarios.includes(b.event)||typeof b.result!=='boolean')return;
        cell.dataset.event=b.event;cell.dataset.result=String(b.result);cell.textContent=(b.result?'✓ ':'✕ ')+b.event;
        cell.setAttribute('aria-label',`Ruutu ${i+1}: ${b.result?'Tapahtuu':'Ei tapahdu'}, ${b.event}`);
      });
      player.value=saved.playerId||'';pending=saved.pending||null;lastReceipt=saved.lastReceipt||null;
      form.querySelectorAll('select').forEach(e=>e.dispatchEvent(new Event('change',{bubbles:true})));
      form.querySelector('.bingo-cell').click();
      draftStatus.textContent='Aiempi luonnos palautettu tästä selaimesta.';
      if(lastReceipt){status.hidden=false;status.textContent='Viimeisin vastaanottokuitti: '+lastReceipt.receipt+'. Myöhemmät luonnosmuutokset täytyy lähettää erikseen.';}
    }
  } catch {draftStatus.textContent='Luonnosta ei voitu palauttaa. Täytä lomake uudelleen.';}
  form.addEventListener('input',save);form.addEventListener('change',save);player.addEventListener('change',save);
  function close(){if(busy)return;modal.hidden=true;code.value='';returnFocus?.focus();}
  cancel.addEventListener('click',close);
  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close();}
    if(e.key==='Tab'){
      const nodes=[player,code,cancel,confirm].filter(n=>!n.disabled),i=nodes.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus();}
    }
    if(e.key==='Enter'&&e.target===code){e.preventDefault();confirm.click();}
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    try {core.validateAnswers(config,read());}catch(err){const el=document.getElementById('prediction-error');el.textContent=err.message;el.hidden=false;return;}
    returnFocus=document.activeElement;modal.hidden=false;error.hidden=true;
    confirm.disabled=!validEndpoint || setupMode;player.focus();
    if(setupMode){error.textContent='Bingon tapahtumat ovat vielä alustavia. Ennustusten lähetys ei ole vielä avoinna.';error.hidden=false;}
    else if(!validEndpoint){error.textContent='Lähetys tulee käyttöön, kun järjestäjä yhdistää Google-taulukon.';error.hidden=false;}
  });
  confirm.addEventListener('click',async()=>{
    if(busy||!validEndpoint||setupMode)return;
    error.hidden=true;
    if(!player.value||!code.value.trim()){error.textContent='Valitse pelaaja ja kirjoita henkilökohtainen koodi.';error.hidden=false;return;}
    let answers;try{answers=core.validateAnswers(config,read());}catch(err){error.textContent=err.message;error.hidden=false;return;}
    const signature=JSON.stringify({playerId:player.value,answers});
    if(!pending||pending.signature!==signature)pending={signature,requestId:crypto.randomUUID()};
    save();busy=true;confirm.disabled=true;cancel.disabled=true;player.disabled=true;code.disabled=true;confirm.textContent='Lähetetään…';
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch(connection.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},redirect:'follow',credentials:'omit',signal:controller.signal,body:JSON.stringify({season:config.season,revision:config.revision,playerId:player.value,code:code.value.trim(),requestId:pending.requestId,answers})});
      if(!response.ok)throw new Error('Palvelin ei vahvistanut lähetystä.');
      const result=await response.json();
      if(result.ok!==true||typeof result.receipt!=='string'||!result.receipt)throw new Error(result.error||'Vastaanottokuitti puuttuu.');
      lastReceipt={receipt:result.receipt,savedAt:result.savedAt};pending=null;
      // Re-enable the player select before saving its value to the local draft.
      player.disabled=false;save();status.hidden=false;status.textContent=`Ennustus vastaanotettu! Kuitti: ${result.receipt}. Voit muuttaa vastauksia ja lähettää uudelleen ennen määräaikaa.`;
      busy=false;close();status.scrollIntoView({block:'center'});
    }catch(err){error.hidden=false;error.textContent=(err.name==='AbortError'||err instanceof TypeError?'Yhteys katkesi tai palveluun ei saatu yhteyttä.':err.message)+' Lähetystä ei voitu vahvistaa. Luonnos säilyy; voit yrittää uudelleen samalla koodilla. Uusintayritys ei tee kaksoislähetystä.';}
    finally{clearTimeout(timeout);busy=false;confirm.disabled=false;cancel.disabled=false;player.disabled=false;code.disabled=false;confirm.textContent='Lähetä ennustus';}
  });
};
