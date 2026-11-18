/* Optional, read-only detailed archive access. Include after js/main.js when needed. */
(() => {
  'use strict';
  const source=new URL('../data/prediction-archive.json',document.currentScript.src);
  let pending;
  async function load(){if(!pending)pending=fetch(source).then(r=>{if(!r.ok)throw Error('Archive HTTP '+r.status);return r.json()}).then(d=>{if(d?.index?.schemaVersion!==1||!Array.isArray(d.seasons)||!Array.isArray(d.players))throw Error('Invalid archive schema');return d}).catch(e=>{pending=null;throw e});return pending}
  async function season(year){return(await load()).seasons.find(s=>s.year===Number(year))||null}
  async function question(year,number){return(await season(year))?.questions.find(q=>q.number===Number(number))||null}
  async function player(idOrName){const id=String(idOrName).toLowerCase();return(await load()).players.find(p=>p.id===id||p.name.toLowerCase()===id)||null}
  window.F1Archive=Object.freeze({load,season,question,player,standings:async year=>(await season(year))?.standings||[],answers:async(year,n)=>(await question(year,n))?.answers||[],maximumPoints:async year=>(await season(year))?.maximumPoints||null,allTimeStatistics:async()=>(await load()).players});
})();
