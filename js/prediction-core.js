/* Shared validation and public export; also loaded by Google Apps Script. */
var PredictionCore = (() => {
  'use strict';
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const fields = c => c.stages.flatMap(s => s.questions.flatMap(q => q.fields));
  const questions = c => c.stages.flatMap(s => s.questions);
  function validateConfig(c) {
    assert(c && c.schemaVersion === 1, 'Tuntematon kysymystiedoston versio.');
    assert(c.collectionMode === undefined || ['setup','open'].includes(c.collectionMode), 'Tuntematon kauden tila.');
    assert(Number.isInteger(c.season) && c.season >= 2020 && c.season <= 2100, 'Virheellinen kausi.');
    assert(typeof c.revision === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(c.revision), 'Virheellinen revision tunniste.');
    assert(typeof c.deadline === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(c.deadline) && Number.isFinite(Date.parse(c.deadline)), 'Määräajasta puuttuu aikavyöhyke.');
    assert(Array.isArray(c.stages) && c.stages.length > 0 && c.stages.length <= 30, 'Tarvitaan 1–30 osiota.');
    const ids = new Set(), names = new Set(), numbers = new Set();
    c.stages.forEach(s => {
      assert(s && /^[a-z][a-z0-9_-]*$/.test(s.id) && s.id !== 'bingo' && !ids.has(s.id), 'Osion tunniste on virheellinen tai toistuu.'); ids.add(s.id);
      assert(typeof s.title === 'string' && s.title.length > 0 && Array.isArray(s.questions) && s.questions.length > 0, 'Osiolta puuttuu nimi tai kysymykset.');
      s.questions.forEach(q => {
        assert(Number.isInteger(q.number) && q.number > 0 && !numbers.has(q.number), 'Kysymysnumero toistuu tai on virheellinen.'); numbers.add(q.number);
        assert(typeof q.text === 'string' && q.text.length > 0 && typeof q.scoring === 'string' && Array.isArray(q.fields) && q.fields.length > 0, 'Kysymyksen tiedot puuttuvat.');
        q.fields.forEach(f => {
          assert(/^[a-zA-Z][a-zA-Z0-9_-]{0,70}$/.test(f.name) && !['__proto__','constructor','prototype'].includes(f.name) && !names.has(f.name), 'Kentän tunniste on virheellinen tai toistuu.'); names.add(f.name);
          assert(['select','checkboxes','number','text'].includes(f.type), 'Tuntematon kenttätyyppi.');
          assert(typeof f.required === 'boolean', 'Kentän required-arvon tulee olla true tai false.');
          if (['select','checkboxes'].includes(f.type)) {
            const opts = c.optionLists && c.optionLists[f.options];
            assert(Array.isArray(opts) && opts.length > 0 && opts.every(v => typeof v === 'string' && v.length > 0) && new Set(opts).size === opts.length, 'Vastausvaihtoehdot puuttuvat tai toistuvat.');
          }
          if (f.type === 'number') {
            ['min','max','step'].forEach(k => assert(f[k] === undefined || Number.isFinite(f[k]), 'Lukuraja on virheellinen.'));
            assert(f.min === undefined || f.max === undefined || f.min <= f.max, 'Lukurajat ovat väärin päin.');
            assert(f.step === undefined || f.step > 0, 'Askelvälin tulee olla positiivinen.');
          }
        });
      });
    });
    assert(Array.isArray(c.exclusiveGroups), 'Valintaryhmät puuttuvat.');
    c.exclusiveGroups.forEach(g => assert(Array.isArray(g.fields) && g.fields.every(n => fields(c).some(f => f.name === n && f.type === 'select')), 'Valintaryhmä viittaa tuntemattomaan kenttään.'));
    assert(c.bingo && Number.isInteger(c.bingo.number) && !numbers.has(c.bingo.number) && typeof c.bingo.instructions === 'string' && Array.isArray(c.bingo.scoring) && c.bingo.scoring.every(v=>typeof v==='string'), 'Bingon tiedot puuttuvat.');
    assert(Array.isArray(c.bingo.scenarios) && c.bingo.scenarios.length >= 9 && c.bingo.scenarios.every(v=>typeof v==='string' && v.length>0) && new Set(c.bingo.scenarios).size === c.bingo.scenarios.length, 'Bingoon tarvitaan vähintään 9 eri tapahtumaa.');
    assert(JSON.stringify(c).length < 45000, 'Kysymystiedosto on liian suuri.');
    return c;
  }
  function validateAnswers(c, answers) {
    validateConfig(c);
    assert(answers && typeof answers === 'object' && !Array.isArray(answers), 'Vastaukset puuttuvat.');
    const fs = fields(c), allowed = new Set([...fs.map(f=>f.name),'bingo']);
    assert(Object.keys(answers).every(k => allowed.has(k)), 'Tuntematon vastauskenttä.');
    const clean = {};
    fs.forEach(f => {
      const v = answers[f.name];
      const empty = v === '' || v === undefined || v === null || (Array.isArray(v) && !v.length);
      assert(!f.required || !empty, 'Vastaa kenttään: ' + (f.label || f.name));
      if (empty) { clean[f.name] = f.type === 'checkboxes' ? [] : ''; return; }
      if (f.type === 'select') assert(typeof v === 'string' && c.optionLists[f.options].includes(v), 'Virheellinen valinta: ' + f.name);
      if (f.type === 'checkboxes') assert(Array.isArray(v) && v.every(x=>c.optionLists[f.options].includes(x)) && new Set(v).size===v.length, 'Virheelliset valinnat: ' + f.name);
      if (f.type === 'number') {
        assert(typeof v === 'number' && Number.isFinite(v) && (f.min===undefined || v>=f.min) && (f.max===undefined || v<=f.max), 'Virheellinen luku: '+f.name);
        const quotient = (v-(f.min||0))/(f.step||1);
        assert(Math.abs(quotient-Math.round(quotient))<1e-8, 'Virheellinen askelväli: '+f.name);
      }
      if (f.type === 'text') assert(typeof v === 'string' && v.trim().length>0 && v.length<=500, 'Tekstivastaus on tyhjä tai liian pitkä.');
      clean[f.name] = v;
    });
    c.exclusiveGroups.forEach(g=>{const vs=g.fields.map(k=>clean[k]).filter(Boolean);assert(new Set(vs).size===vs.length,g.message||'Sama valinta toistuu.');});
    assert(Array.isArray(answers.bingo) && answers.bingo.length===9 && answers.bingo.every(b=>b && c.bingo.scenarios.includes(b.event) && typeof b.result==='boolean') && new Set(answers.bingo.map(b=>b.event)).size===9, 'Täytä 9 eri bingotapahtumaa.');
    clean.bingo=answers.bingo.map(b=>({event:b.event,result:b.result}));
    return clean;
  }
  const answerText = (q, a) => q.fields.map(f => `${f.label || ''} ${Array.isArray(a[f.name]) ? a[f.name].join(', ') : a[f.name] ?? ''}`.trim()).join(' · ');
  const bingoText = a => a.bingo.map((b,i)=>`${i+1}. ${b.result?'✓':'✕'} ${b.event}`).join(' | ');
  function buildSeason(c, submissions, scores, correct, final) {
    validateConfig(c);
    assert(submissions.length > 0, 'Kaudella ei ole vastauksia.');
    const qs = [...questions(c),{number:c.bingo.number,text:'Bingo',scoring:c.bingo.scoring.join(' · ')}];
    const score = (s,q) => {
      const v=scores[`${s.playerId}:${q.number}`];
      assert(!final || (typeof v==='number' && Number.isFinite(v)), `Pisteet puuttuvat: ${s.playerName}, kysymys ${q.number}`);
      return typeof v==='number' && Number.isFinite(v) ? v : null;
    };
    submissions.forEach(s=>validateAnswers(c,s.answers));
    if(final) qs.forEach(q=>assert(typeof correct[q.number]==='string' && correct[q.number].trim(),`Oikea vastaus puuttuu: ${q.number}`));
    const standings = final ? submissions.map(s=>({player:s.playerName,points:qs.reduce((n,q)=>n+score(s,q),0),percent:null})).sort((a,b)=>b.points-a.points || a.player.localeCompare(b.player,'fi')) : [];
    standings.forEach((s,i)=>s.rank=i>0&&s.points===standings[i-1].points?standings[i-1].rank:i+1);
    const stages=[...c.stages,{title:'Bingo',questions:[qs[qs.length-1]]}];
    return {year:c.season,status:final?'final':'predictions',standings,archiveIntro:final?'Vahvistetut tulokset.':'Ennustukset on julkaistu. Pisteitä ei ole vielä vahvistettu.',categories:stages.map(stage=>({name:stage.title,questions:stage.questions.map(q=>q.text),blocks:stage.questions.flatMap(q=>[
      {note:`${q.number}. ${q.text} — Pisteytys: ${q.scoring}`},
      {table:{type:'answers',label:q.text,columns:[{label:'Pelaaja'},{label:q.text,question:q.text},{label:'Pisteet'}],rows:submissions.map(s=>({player:s.playerName,values:[{player:s.playerName},q.number===c.bingo.number?bingoText(s.answers):answerText(q,s.answers),final?score(s,q):null]}))}},
      ...(final?[{note:'Oikea vastaus: '+correct[q.number]}]:[])
    ])}))};
  }
  return {validateConfig,validateAnswers,fields,questions,answerText,bingoText,buildSeason};
})();
if (typeof module !== 'undefined') module.exports = PredictionCore;
