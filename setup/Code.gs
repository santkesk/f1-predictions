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

var INITIAL_CONFIG = {"season": 2027, "deadline": "2027-03-12T16:00:00+02:00", "stages": [{"id": "championship-questions", "title": "Maailmanmestaruus", "questions": [{"number": 1, "text": "Ketkä ovat kolme parasta kuljettajaa järjestyksessä?", "scoring": "Kuljettaja +3, sija +1, kaikki kuljettajat oikein +1", "fields": [{"name": "top1", "label": "1. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "top2", "label": "2. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "top3", "label": "3. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 2, "text": "Kuka on kymmenes kuljettaja loppupisteissä?", "scoring": "Kuljettaja +5 (1 ohi +3, 2 ohi +1)", "fields": [{"name": "top10", "label": "10. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}]}, {"id": "win-questions", "title": "Voitot", "questions": [{"number": 3, "text": "Kuka voittaa eniten kilpailuja ja kuinka monta?", "scoring": "Kuljettaja +1, voittojen määrä +5 (lähin +1)", "fields": [{"name": "wins", "label": "Eniten voittoja:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "maxWins", "label": "Voittojen määrä:", "type": "number", "required": true, "min": 0, "max": 24}]}, {"number": 4, "text": "Ketkä kaikki voittavat vähintään yhden kilpailun?", "scoring": "Oikea +3, väärä -1, puuttuva -2", "fields": [{"type": "checkboxes", "name": "winners", "options": "driversByCheckboxOrder", "required": true}], "help": "Valitse kaikki sopivat kuljettajat."}]}, {"id": "podium-questions", "title": "Podiumit", "questions": [{"number": 5, "text": "Kuka saa eniten podiumeja ja kuinka monta?", "scoring": "Kuljettaja +1, podiumien määrä +5 (lähin +1)", "fields": [{"name": "podiums", "label": "Eniten podiumeja:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "maxPodiums", "label": "Podiumien määrä:", "type": "number", "required": true, "min": 0, "max": 24}]}, {"number": 6, "text": "Ketkä kaikki ovat vähintään kerran podiumilla?", "scoring": "Oikea +3, väärä -1, puuttuva -2", "fields": [{"type": "checkboxes", "name": "podiumDrivers", "options": "driversByCheckboxOrder", "required": true}], "help": "Valitse kaikki sopivat kuljettajat."}]}, {"id": "pole-questions", "title": "Paalupaikat", "questions": [{"number": 7, "text": "Ketkä kolme saavat eniten paalupaikkoja?", "scoring": "Jokainen kuljettajan ajama paalupaikka +1", "fields": [{"name": "poles1", "label": "Valinta 1", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "poles2", "label": "Valinta 2", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "poles3", "label": "Valinta 3", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 8, "text": "Kuka keskikastin kuljettajista pääsee lähimmäs paalupaikkaa?", "scoring": "Kuljettaja +5 (1 ohi +3, 2 ohi +1)", "fields": [{"name": "midfieldpole", "label": "Valitse vastaus", "type": "select", "required": true, "options": "midfieldDrivers", "placeholder": "-- Valitse kuljettaja --"}]}]}, {"id": "fastestlap_and_sprint-questions", "title": "Nopeimmat kierrokset ja sprintit", "questions": [{"number": 9, "text": "Ketkä kolme ajavat eniten nopeimpia kierroksia?", "scoring": "Jokainen kuljettajan ajama nopein kierros +1", "fields": [{"name": "fastestlaps1", "label": "Valinta 1", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "fastestlaps2", "label": "Valinta 2", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "fastestlaps3", "label": "Valinta 3", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 10, "text": "Ketkä ovat kolme parasta sprinteissä järjestyksessä?", "scoring": "Kuljettaja +3, sija +1", "fields": [{"name": "sprints1", "label": "1. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "sprints2", "label": "2. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "sprints3", "label": "3. sija:", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}]}, {"id": "team-questions", "title": "Tallit", "questions": [{"number": 11, "text": "Mitkä ovat kolme parasta tallia järjestyksessä?", "scoring": "Talli +2, sija +1", "fields": [{"name": "teams-top1", "label": "1. sija:", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}, {"name": "teams-top2", "label": "2. sija:", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}, {"name": "teams-top3", "label": "3. sija:", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}]}, {"number": 12, "text": "Mikä talli saa vähiten pisteitä ja montako?", "scoring": "Talli +5 (1 ohi +3, 2 ohi +1), pisteet +5 (lähin +1)", "fields": [{"name": "teams-top11", "label": "11. sija:", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}, {"name": "minTeamPoints", "label": "Pisteiden määrä:", "type": "number", "required": true, "min": 0, "max": 1000}]}]}, {"id": "teammates-questions", "title": "Tallikaverit", "questions": [{"number": 13, "text": "Kuka voittaa tallikaverinsa useimmin aika-ajoissa?", "scoring": "Voitot – häviöt = (-24 - +24)", "fields": [{"name": "headtohead-qualifying", "label": "Valitse vastaus", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 14, "text": "Kuka voittaa tallikaverinsa useimmin kilpailuissa?", "scoring": "Voitot – häviöt = (-24 - +24)", "fields": [{"name": "headtohead-race", "label": "Valitse vastaus", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 15, "text": "Minkä tallin kuljettajien piste-ero on suurin?", "scoring": "Talli +5 (toinen +3, kolmas +1)", "fields": [{"name": "pointsdifference", "label": "Valitse vastaus", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}]}]}, {"id": "retirement-questions", "title": "Keskeytykset", "questions": [{"number": 16, "text": "Ketkä kolme keskeyttävät useimmin?", "scoring": "Jokainen kuljettajan keskeytys +1", "fields": [{"name": "retirements1", "label": "Valinta 1", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "retirements2", "label": "Valinta 2", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "retirements3", "label": "Valinta 3", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 17, "text": "Kuinka monta kilpailua ajetaan ilman yhtäkään keskeytystä?", "scoring": "Oikein +3 (lähin +1)", "fields": [{"name": "racesWithoutRetirements", "label": "Kilpailuja ilman keskeytyksiä:", "type": "number", "required": true, "min": 0, "max": 24}]}, {"number": 18, "text": "Mikä on suurin määrä keskeytyksiä yhdessä kilpailussa?", "scoring": "Oikein +3 (lähin +1)", "fields": [{"name": "maxRetirementsInARace", "label": "Eniten keskeytyksiä yhdessä kilpailussa:", "type": "number", "required": true, "min": 0, "max": 22}]}]}, {"id": "improvement-questions", "title": "Kehitys", "questions": [{"number": 19, "text": "Mikä talli kehittyy eniten kaudesta 2026?", "scoring": "Talli +5 (toinen +3, kolmas +1)", "fields": [{"name": "mostImprovedTeam", "label": "Valitse vastaus", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}]}, {"number": 20, "text": "Ketkä kolme kuljettajaa kehittyvät eniten kaudesta 2026?", "scoring": "Kuljettaja +3, sija +1", "fields": [{"name": "mostImprovedDrivers1", "label": "Valinta 1", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "mostImprovedDrivers2", "label": "Valinta 2", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}, {"name": "mostImprovedDrivers3", "label": "Valinta 3", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}, {"number": 21, "text": "Kuka kuljettajista kehittyy vähiten kaudesta 2026?", "scoring": "Kuljettaja +10 (1 ohi +8, 2: +5, 3: +3, 4: +3, 5: +1)", "fields": [{"name": "leastImprovedDriver", "label": "Valitse vastaus", "type": "select", "required": true, "options": "drivers", "placeholder": "-- Valitse kuljettaja --"}]}]}, {"id": "changes-questions", "title": "Muutokset", "questions": [{"number": 22, "text": "Mitkä kolmen tallin kuljettajat vaihtuvat?", "scoring": "Jokainen vaihtunut kuljettaja +3", "fields": [{"name": "changedTeams1", "label": "Valinta 1", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}, {"name": "changedTeams2", "label": "Valinta 2", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}, {"name": "changedTeams3", "label": "Valinta 3", "type": "select", "required": true, "options": "teams", "placeholder": "-- Valitse talli --"}]}, {"number": 23, "text": "Kuinka monta uutta kuljettajaa ajaa kauden 2027 jälkeen?", "scoring": "Oikein +5", "fields": [{"name": "newDrivers", "label": "Uusia kuljettajia:", "type": "number", "required": true, "min": 0, "max": 22}]}, {"number": 24, "text": "Kuinka monta eri kuljettajaa ajaa kaudella 2027?", "scoring": "Oikein +5", "fields": [{"name": "differentDrivers", "label": "Eri kuljettajia:", "type": "number", "required": true, "min": 0, "max": 44}]}]}], "exclusiveGroups": [{"fields": ["top1", "top2", "top3", "top10"], "message": "Maailmanmestaruus: sama kuljettaja on valittu useampaan kohtaan."}, {"fields": ["poles1", "poles2", "poles3"], "message": "Paalupaikat: sama kuljettaja on valittu useammin kuin kerran."}, {"fields": ["fastestlaps1", "fastestlaps2", "fastestlaps3"], "message": "Nopeimmat kierrokset: sama kuljettaja on valittu useammin kuin kerran."}, {"fields": ["sprints1", "sprints2", "sprints3"], "message": "Sprintit: sama kuljettaja on valittu useammin kuin kerran."}, {"fields": ["teams-top1", "teams-top2", "teams-top3", "teams-top11"], "message": "Tallit: sama talli on valittu useampaan kohtaan."}, {"fields": ["retirements1", "retirements2", "retirements3"], "message": "Keskeytykset: sama kuljettaja on valittu useammin kuin kerran."}, {"fields": ["mostImprovedDrivers1", "mostImprovedDrivers2", "mostImprovedDrivers3", "leastImprovedDriver"], "message": "Kehitys: sama kuljettaja on valittu useampaan kohtaan."}, {"fields": ["changedTeams1", "changedTeams2", "changedTeams3"], "message": "Muutokset: sama talli on valittu useammin kuin kerran."}], "bingo": {"number": 25, "instructions": "Valitse tapahtuma ja arvioi, tapahtuuko se. Ruudukko täyttyy automaattisesti. Voit muokata valintoja klikkaamalla ruutua.", "scoring": ["Jokainen oikein valittu tapahtuma +1", "Yhden rivin (vaaka/pysty/vino) kaikki oikein +5"], "scenarios": ["Joku voittaa kisan 10 parhaan lähtöruudun ulkopuolelta.", "Verstappen voittaa Lawsonin kaikissa kisoissa.", "Vähintään 1 tulokas voittaa tallikaverinsa pisteissä.", "Hamilton tekee hattutempun (paalu, voitto, nopein).", "Jokin talli vaihtaa kuskia kesken kauden.", "Audi on viimeinen loppupisteissä.", "Joku keskeyttää lämmittelykierroksen aikana.", "Kimi saa enemmän pisteitä kuin Räikkönen 2018.", "Kaikki kuskit saavat vähintään yhden pisteen.", "Mercedes voittaa kaikki asiakastallinsa pisteissä.", "Vähintään 1 täysin englantilainen podium.", "Molemmat Alpine kuskit saavat podiumin."]}, "schemaVersion": 1, "revision": "2027-v2", "optionLists": {"drivers": ["Kimi Antonelli", "George Russell", "Charles Leclerc", "Lewis Hamilton", "Max Verstappen", "Isack Hadjar", "Lando Norris", "Oscar Piastri", "Liam Lawson", "Arvid Lindblad", "Pierre Gasly", "Franco Colapinto", "Rafael Camara", "Oliver Bearman", "Gabriel Bortoleto", "Nico Hülkenberg", "Alexander Albon", "Carlos Sainz", "Fernando Alonso", "Lance Stroll", "Sergio Pérez", "Valtteri Bottas"], "driversByCheckboxOrder": ["Kimi Antonelli", "George Russell", "Charles Leclerc", "Lewis Hamilton", "Max Verstappen", "Isack Hadjar", "Lando Norris", "Oscar Piastri", "Liam Lawson", "Arvid Lindblad", "Pierre Gasly", "Franco Colapinto", "Rafael Camara", "Oliver Bearman", "Gabriel Bortoleto", "Nico Hülkenberg", "Alexander Albon", "Carlos Sainz", "Fernando Alonso", "Lance Stroll", "Sergio Pérez", "Valtteri Bottas"], "midfieldDrivers": ["Liam Lawson", "Arvid Lindblad", "Pierre Gasly", "Franco Colapinto", "Rafael Camara", "Oliver Bearman", "Gabriel Bortoleto", "Nico Hülkenberg", "Alexander Albon", "Carlos Sainz", "Fernando Alonso", "Lance Stroll", "Sergio Pérez", "Valtteri Bottas"], "teams": ["Mercedes", "Ferrari", "Red Bull", "McLaren", "Racing Bulls", "Alpine", "Haas", "Audi", "Williams", "Aston Martin", "Cadillac"]}, "collectionMode": "setup"};
var INITIAL_PLAYERS = [{"id": "camilla", "name": "Camilla", "overallPercent": 19}, {"id": "oskari", "name": "Oskari", "overallPercent": 26}, {"id": "ducky", "name": "Ducky", "overallPercent": 43}, {"id": "annika", "name": "Annika", "overallPercent": 28}, {"id": "roope", "name": "Roope", "overallPercent": 2}, {"id": "santeri", "name": "Santeri", "overallPercent": 43}, {"id": "marjo", "name": "Marjo", "overallPercent": 35}, {"id": "kalle", "name": "Kalle", "overallPercent": 28}];

/* Bound Google Apps Script. Private Sheet is the only database. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('F1 Ennustukset')
    .addItem('1. Luo kauden taulukot', 'setupSeason')
    .addItem('Päivitä kausi valmistelutilaan (arkistoi aiemmat vastaukset)', 'updateSeasonForSetup')
    .addItem('Avaa valmis kausi ennustuksille', 'openSeason')
    .addItem('2. Vie kysymystiedosto', 'exportQuestions')
    .addItem('3. Valmistele pisteytys', 'prepareScoring')
    .addItem('4. Vie ennustukset (määräajan jälkeen)', 'exportPredictions')
    .addItem('5. Vie vahvistetut tulokset', 'exportResults').addToUi();
}
function book_() {
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id) throw new Error('Aja ensin setupSeason.');
  return SpreadsheetApp.openById(id);
}
function sheet_(name) { const s=book_().getSheetByName(name); if(!s)throw new Error('Taulukko puuttuu: '+name);return s; }
function rows_(name) { return sheet_(name).getDataRange().getValues().slice(1).filter(r=>r[0]!==''); }
function create_(name, headers, rows) {
  const book=book_(); if(book.getSheetByName(name))throw new Error('Taulukko on jo olemassa: '+name);
  const s=book.insertSheet(name); const all=[headers,...rows];
  s.getRange(1,1,all.length,headers.length).setValues(all.map(r=>r.map(safeCell_)));
  s.setFrozenRows(1);s.getRange(1,1,1,headers.length).setFontWeight('bold');return s;
}
function safeCell_(v) { return typeof v==='string' && /^[=+\-@]/.test(v) ? "'"+v : v; }
function hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join(''); }
function locked_(fn) { const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw new Error('Palvelu on varattu. Yritä uudelleen.');try{return fn();}finally{lock.releaseLock();} }
function setupSeason() {
  return locked_(()=>{
    const c=PredictionCore.validateConfig(INITIAL_CONFIG), y=c.season;
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',SpreadsheetApp.getActiveSpreadsheet().getId());
    const names=['Settings','Questions','Options','Players','Submissions','Scores','Correct'].map(n=>n+'_'+y);
    if(names.some(n=>book_().getSheetByName(n)))throw new Error('Kausi on jo alustettu. Olemassa olevia tietoja ei korvata.');
    createSeasonSheets_(c, false);
    PropertiesService.getScriptProperties().setProperty('ACTIVE_SEASON',String(y));
  });
}
function createSeasonSheets_(c, keepPlayers) {
  const y=c.season;
    create_('Settings_'+y,['key','value'],[['season',y],['collectionMode',c.collectionMode || 'open'],['revision',c.revision],['deadline',c.deadline],['bingo',JSON.stringify(c.bingo)],['exclusiveGroups',JSON.stringify(c.exclusiveGroups)]]);
    create_('Questions_'+y,['stage_id','stage_title','number','question','scoring','help','field_name','label','type','required','options','min','max','step','placeholder'],c.stages.flatMap(s=>s.questions.flatMap(q=>q.fields.map(f=>[s.id,s.title,q.number,q.text,q.scoring,q.help||'',f.name,f.label||'',f.type,f.required,f.options||'',f.min??'',f.max??'',f.step??'',f.placeholder||'']))));
    create_('Options_'+y,['list','value'],Object.entries(c.optionLists).flatMap(([k,vs])=>vs.map(v=>[k,v])));
    if (!keepPlayers) create_('Players_'+y,['player_id','name','private_code','enabled'],INITIAL_PLAYERS.map(p=>[p.id,p.name,Utilities.getUuid().replace(/-/g,''),true]));
    create_('Submissions_'+y,['receipt','player_id','name','submitted_at','request_id','answers_json',...PredictionCore.questions(c).map(q=>q.number+'. '+q.text),'Bingo'],[]);
    create_('Scores_'+y,['player_id','name','question_number','question','points'],[]);
    create_('Correct_'+y,['question_number','question','correct_answer'],[...PredictionCore.questions(c).map(q=>[q.number,q.text,'']),[c.bingo.number,'Bingo','']]);
}
function config_() {
  const y=PropertiesService.getScriptProperties().getProperty('ACTIVE_SEASON');
  const values=Object.fromEntries(rows_('Settings_'+y));
  const c={schemaVersion:1,season:Number(values.season),collectionMode:String(values.collectionMode || 'open'),revision:String(values.revision),deadline:String(values.deadline),bingo:JSON.parse(values.bingo),exclusiveGroups:JSON.parse(values.exclusiveGroups),optionLists:{},stages:[]};
  rows_('Options_'+y).forEach(([k,v])=>{if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(k)||['constructor','prototype','__proto__'].includes(k))throw new Error('Virheellinen vaihtoehtolista.');if (!c.optionLists[k]) c.optionLists[k] = []; c.optionLists[k].push(String(v));});
  const qs=new Map();
  rows_('Questions_'+y).forEach(r=>{
    let s=c.stages.find(s=>s.id===r[0]);if(!s){s={id:String(r[0]),title:String(r[1]),questions:[]};c.stages.push(s);}
    let q=qs.get(Number(r[2]));
    if(!q){q={number:Number(r[2]),text:String(r[3]),scoring:String(r[4]),help:String(r[5]),fields:[]};qs.set(q.number,q);s.questions.push(q);}
    if(!s.questions.includes(q)||q.text!==String(r[3])||q.scoring!==String(r[4]))throw new Error('Saman kysymyksen rivien tiedot eroavat.');
    const f={name:String(r[6]),label:String(r[7]),type:String(r[8]),required:r[9]===true||String(r[9]).toLowerCase()==='true'};
    if(r[10]!=='')f.options=String(r[10]);['min','max','step'].forEach((k,i)=>{if(r[11+i]!=='')f[k]=Number(r[11+i]);});
    if(r[14]!=='')f.placeholder=String(r[14]);q.fields.push(f);
  });
  return PredictionCore.validateConfig(c);
}
function fingerprint_(c) { return hash_(JSON.stringify(c)); }
function json_(x) {return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
// No public endpoint ever returns answers, access codes, or scoring data.
function doGet() {return json_({ok:true,service:'F1 predictions',schemaVersion:1});}
function doPost(e) {
  try {
    if(!e || !e.postData || e.postData.contents.length>60000)throw new Error('Virheellinen lähetys.');
    const p=JSON.parse(e.postData.contents);
    return json_(locked_(()=>submit_(p)));
  } catch(error) {return json_({ok:false,error: error.message || 'Tallennus epäonnistui.'});}
}
function submit_(p) {
  const c=config_();
  if(!p || p.season!==c.season || p.revision!==c.revision)throw new Error('Lomake on vanhentunut. Lataa sivu uudelleen.');
  if(c.collectionMode==='setup')throw new Error('Kausi on valmistelussa. Ennustusten lähetys avataan, kun kysymykset ja bingo ovat valmiit.');
  if(typeof p.playerId!=='string'||typeof p.code!=='string'||p.code.length>100)throw new Error('Tarkista pelaaja ja henkilökohtainen koodi.');
  const player=rows_('Players_'+c.season).find(r=>r[0]===p.playerId && r[3]===true && hash_(String(r[2]))===hash_(p.code));
  if(!player)throw new Error('Tarkista pelaaja ja henkilökohtainen koodi.');
  if(typeof p.requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(p.requestId))throw new Error('Virheellinen lähetyksen tunniste.');
  const answers=PredictionCore.validateAnswers(c,p.answers), serialized=JSON.stringify(answers);
  const prior=rows_('Submissions_'+c.season).find(r=>r[4]===p.requestId);
  if(prior){if(prior[1]!==p.playerId || prior[5]!==serialized)throw new Error('Lähetyksen tunniste on jo käytössä.');return {ok:true,receipt:prior[0],savedAt:prior[3],duplicate:true};}
  if(Date.now()>=Date.parse(c.deadline))throw new Error('Ennustusten määräaika on päättynyt.');
  const props=PropertiesService.getScriptProperties(), key='CONFIG_HASH_'+c.season, current=fingerprint_(c), saved=props.getProperty(key);
  if(saved && saved!==current)throw new Error('Kauden kysymyksiä on muutettu vastausten keräämisen jälkeen. Ota yhteys järjestäjään.');
  props.setProperty(key,current);
  const receipt=Utilities.getUuid(), savedAt=new Date().toISOString();
  sheet_('Submissions_'+c.season).appendRow([receipt,p.playerId,player[1],savedAt,p.requestId,serialized,...PredictionCore.questions(c).map(q=>PredictionCore.answerText(q,answers)),PredictionCore.bingoText(answers)].map(safeCell_));
  SpreadsheetApp.flush();
  return {ok:true,receipt,savedAt};
}
function latest_(c) { const map=new Map();rows_('Submissions_'+c.season).forEach(r=>map.set(r[1],{playerId:r[1],playerName:r[2],answers:JSON.parse(r[5])}));return [...map.values()]; }
function checkFrozen_(c) { const h=PropertiesService.getScriptProperties().getProperty('CONFIG_HASH_'+c.season);if(h&&h!==fingerprint_(c))throw new Error('Palauta kauden kysymykset alkuperäiseen muotoon ennen vientiä.'); }
function prepareScoring() {
  locked_(()=>{
    const c=config_();checkFrozen_(c);
    if(Date.now()<Date.parse(c.deadline))throw new Error('Valmistele pisteytys vasta määräajan jälkeen.');
    const s=sheet_('Scores_'+c.season), existing=new Set(rows_(s.getName()).map(r=>r[0]+':'+r[2]));
    const qs=[...PredictionCore.questions(c),{number:c.bingo.number,text:'Bingo'}];
    latest_(c).forEach(p=>qs.forEach(q=>{if(!existing.has(p.playerId+':'+q.number))s.appendRow([p.playerId,p.playerName,q.number,q.text,''].map(safeCell_));}));
  });
}
function download_(name, data) {
  const json=JSON.stringify(data,null,2), encoded=Utilities.base64Encode(json,Utilities.Charset.UTF_8);
  const html='<p>Tiedosto on valmis. Tarkista se ennen julkaisua.</p><a download="'+name+'" href="data:application/json;base64,'+encoded+'">Lataa '+name+'</a>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(150),'Vie tiedosto');
}
function exportQuestions() { const c=config_();checkFrozen_(c);download_(c.season+'.json',c); }
function exportPredictions() { exportSeason_(false); }
function exportResults() { exportSeason_(true); }
function exportSeason_(final) {
  const c=config_();checkFrozen_(c);
  if(Date.now()<Date.parse(c.deadline))throw new Error('Vastaukset voi viedä vasta määräajan jälkeen.');
  const submissions=latest_(c), scores={}, correct={};
  rows_('Scores_'+c.season).forEach(r=>{const k=r[0]+':'+r[2];if(k in scores)throw new Error('Pisterivi toistuu: '+k);if(r[4]!=='') {if(typeof r[4]!=='number'||!Number.isFinite(r[4]))throw new Error('Virheellinen pistemäärä: '+k);scores[k]=r[4];}});
  rows_('Correct_'+c.season).forEach(r=>correct[r[0]]=String(r[2]));
  const season=PredictionCore.buildSeason(c,submissions,scores,correct,final);
  download_('season-'+c.season+'.json',{schemaVersion:1,exportedAt:new Date().toISOString(),season,players:submissions.map(s=>({id:s.playerId,name:s.playerName}))});
}

// Explicit organizer-only migration. Existing records and their matching questions
// are archived together; player codes are retained, never regenerated.
function updateSeasonForSetup() {
  return locked_(()=>{
    const c=PredictionCore.validateConfig(INITIAL_CONFIG), y=c.season;
    if(c.collectionMode!=='setup')throw new Error('Päivityksen tulee olla valmistelutilassa.');
    const props=PropertiesService.getScriptProperties();
    if(props.getProperty('ACTIVE_SEASON')!==String(y))throw new Error('Valitse päivitettävä kausi ensin.');
    const current=config_();
    if(current.revision===c.revision && current.collectionMode==='setup')return;
    if(current.revision===c.revision)throw new Error('Anna päivitykselle uusi revision tunniste.');
    sheet_('Players_'+y);
    const names=['Settings','Questions','Options','Submissions','Scores','Correct'].map(n=>n+'_'+y);
    const originals=names.map(n=>sheet_(n));
    const suffix='_archive_'+new Date().toISOString().replace(/[-:.TZ]/g,'')+'_'+Utilities.getUuid().slice(0,8);
    const renamed=[];
    try {
      originals.forEach((sheet,i)=>{sheet.setName(names[i]+suffix);renamed.push({sheet:sheet,name:names[i]});});
      createSeasonSheets_(c,true);
      SpreadsheetApp.flush();
    } catch(error) {
      // Only remove fresh sheets created in this locked migration, then restore originals.
      renamed.forEach(entry=>{const fresh=book_().getSheetByName(entry.name);if(fresh)book_().deleteSheet(fresh);entry.sheet.setName(entry.name);});
      throw error;
    }
    props.deleteProperty('CONFIG_HASH_'+y);
    console.log('Valmistelutila käytössä. Aiemmat kysymykset ja vastaukset säilyvät archive-välilehdillä. Pelaajakoodit säilytettiin.');
  });
}
function openSeason() {
  return locked_(()=>{
    const c=config_();
    if(c.collectionMode==='open')return;
    if(Date.now()>=Date.parse(c.deadline))throw new Error('Määräajan tulee olla tulevaisuudessa.');
    if(rows_('Submissions_'+c.season).length)throw new Error('Valmistelutilan vastaustaulukon tulee olla tyhjä.');
    const settings=sheet_('Settings_'+c.season), values=settings.getDataRange().getValues();
    const row=values.findIndex(r=>r[0]==='collectionMode');
    if(row<0)throw new Error('collectionMode-asetus puuttuu.');
    settings.getRange(row+1,2,1,1).setValues([['open']]);
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty('CONFIG_HASH_'+c.season,fingerprint_(config_()));
    console.log('Ennustukset avattu ja kysymykset lukittu. Vie kysymystiedosto ja päivitä se sivustolle.');
  });
}
