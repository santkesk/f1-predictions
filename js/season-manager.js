(() => {
  'use strict';
  const status=document.getElementById('manager-status');let config,base,incoming;
  const say=s=>status.textContent=s;
  function download(name,value){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function file(input){const f=input.files[0];if(!f||f.size>5e6)throw new Error('Valitse JSON-tiedosto (enintään 5 Mt).');return JSON.parse(await f.text());}
  document.getElementById('questions-file').addEventListener('change',async e=>{
    config=null;document.getElementById('download-config').disabled=true;
    try{config=PredictionCore.validateConfig(await file(e.target));document.getElementById('question-summary').textContent=`Kausi ${config.season}: ${config.stages.length} osiota, ${PredictionCore.questions(config).length} kysymystä ja bingo. Versio ${config.revision}.`;document.getElementById('download-config').disabled=false;say('Kysymystiedosto tarkistettu.');}catch(err){say(err.message);}
  });
  document.getElementById('download-config').addEventListener('click',()=>{
    const endpoint=document.getElementById('endpoint').value.trim();
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){say('Anna verkkosovelluksen /exec-osoite.');return;}
    download(config.season+'.json',config);download('submission.json',{endpoint,seasonFile:'seasons/'+config.season});say('Kaksi tiedostoa ladattu. Salli usean tiedoston lataus tarvittaessa. Julkaise ne GitHubissa.');
  });
  function ready(){document.getElementById('merge-results').disabled=!(base&&incoming);if(base&&incoming)document.getElementById('result-summary').textContent=`${incoming.season.year}: ${incoming.season.status==='final'?'vahvistetut tulokset':'ennustukset ilman lopullisia sijoituksia'}, ${incoming.players.length} pelaajaa. ${base.seasons.some(s=>s.year===incoming.season.year)?'Olemassa oleva kausi korvataan.':'Lisätään uusi kausi.'}`;}
  document.getElementById('existing-file').addEventListener('change',async e=>{base=null;try{const d=await file(e.target);if(!Array.isArray(d.seasons)||!Array.isArray(d.players)||!d.prediction)throw new Error('Valitse sivuston nykyinen results.json.');base=d;say('Nykyiset tulokset luettu.');}catch(err){say(err.message);}ready();});
  document.getElementById('season-file').addEventListener('change',async e=>{incoming=null;try{const d=await file(e.target);if(d.schemaVersion!==1||!Number.isInteger(d.season?.year)||!['predictions','final'].includes(d.season?.status)||!Array.isArray(d.season.categories)||!Array.isArray(d.season.standings)||!Array.isArray(d.players)||!d.players.every(p=>/^[a-z][a-z0-9_-]*$/.test(p.id)&&typeof p.name==='string')||new Set(d.players.map(p=>p.id)).size!==d.players.length)throw new Error('Valitse Sheetsin vientitiedosto.');if(d.season.status==='predictions'&&d.season.standings.length)throw new Error('Ennustusvienti ei saa sisältää sijoituksia.');incoming=d;say('Kauden vienti luettu.');}catch(err){say(err.message);}ready();});
  document.getElementById('merge-results').addEventListener('click',()=>{
    if(!base||!incoming)return;const next=structuredClone(base);
    for(const p of incoming.players){const existing=next.players.find(x=>x.id===p.id||x.name===p.name);if(existing&&(existing.id!==p.id||existing.name!==p.name)){say('Pelaajan nimi tai tunniste on ristiriidassa: '+p.name);return;}if(!existing)next.players.push(p);}
    next.seasons=next.seasons.filter(s=>s.year!==incoming.season.year).concat(incoming.season).sort((a,b)=>b.year-a.year);
    next.participation=next.participation||{};next.participation[incoming.season.year]=incoming.players.map(p=>p.name);
    download('results.json',next);say('Päivitetty results.json ladattu. Muut kaudet säilytettiin. Julkaise tiedosto GitHubissa.');
  });
})();
