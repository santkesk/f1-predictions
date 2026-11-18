/* Data-driven statistics, archive filters, player and team profiles.
   All numerical data is read from f1.json or results.json. */
(async () => {
  'use strict';
  const app=window.F1App;
  const {el,render,url,playerToken,teamToken}=app;
  const page=app.page;
  const percent=n=>n===null||n===undefined?'–':`${n} %`;
  const orderByYear=(list)=>[...list].sort((a,b)=>b.year-a.year);
  const svgNS='http://www.w3.org/2000/svg';
  function svg(tag,attrs={},...children){
    const node=document.createElementNS(svgNS,tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
    node.append(...children.flat().map(c=>c instanceof Node?c:String(c)));
    return node;
  }
  let playerByName=new Map();
  function playerLink(name){
    const player=playerByName.get(name);
    if(!player)return name;
    return el('a',{class:'player-link',href:url(`Players/${player.id}.html`),style:{'--player':playerToken(player.id)}},el('span',{class:'player-dot','aria-hidden':'true'}),name);
  }
  function cellContent(value){
    if(value===null||value===undefined)return '–';
    if(typeof value!=='object'||value instanceof Node)return value;
    if(value.player)return playerLink(value.player);
    if(value.parts){return value.parts.flatMap((part,i)=>[i?' ':'',typeof part==='object'?el('i',{},part.italic):part]);}
    return String(value);
  }
  function makeTable(columns,rows,attrs={},makeCell=null){
    const headers=columns.map(col=>typeof col==='object'?col:{label:col});
    const header=el('thead',{},el('tr',{},headers.map(col=>el('th',{scope:'col','data-question':col.question},col.label))));
    const tbody=el('tbody',{},rows.map((row,ri)=>{
      const values=Array.isArray(row)?row:row.values;
      return el('tr',{'data-player':row.player},values.map((value,ci)=>{
        const extra=makeCell?.(value,ci,ri)||{};
        const tag=extra.tag||'td';delete extra.tag;
        return el(tag,{'data-question':headers[ci]?.question,...extra},cellContent(value));
      }));
    }));
    const {caption,...tableAttrs}=attrs;
    return el('table',tableAttrs,caption?el('caption',{},caption):null,header,tbody);
  }
  const scroll=(table,label='Vieritettävä tilastotaulukko')=>el('div',{class:'stats-scroll',role:'region',tabindex:'0','aria-label':label},table);
  const metrics=(items,css='',style={})=>el('div',{class:`metric-grid${css?' '+css:''}`,style},items.map(([label,value])=>el('div',{class:'metric'},el('span',{},label),el('strong',{},value))));
  const section=(title,...children)=>el('section',{class:'stats-card'},el('h2',{},title),children);
  const summary=(year,meta)=>el('summary',{},el('span',{class:'season-year'},year),el('span',{class:'season-meta'},meta));
  const resultLink=(query='')=>url(`results.html${query?'?'+query:''}`);
  function gameModel(data){
    playerByName=new Map(data.players.map(p=>[p.name,p]));
    const seasons=orderByYear(data.seasons);
    const completedSeasons=seasons.filter(s=>s.status!=='predictions');
    const completedYears=completedSeasons.map(s=>s.year).sort((a,b)=>a-b);
    const years=[...new Set([...completedYears,...Object.keys(data.participation||{}).map(Number),data.prediction.season])].sort((a,b)=>a-b);
    const players=data.players.map(p=>{
      const history=completedSeasons.flatMap(s=>s.standings.filter(row=>row.player===p.name).map(row=>({...row,year:s.year})));
      const wins=history.filter(row=>row.rank===1).length;
      const second=history.filter(row=>row.rank===2).length;
      const third=history.filter(row=>row.rank===3).length;
      const points=history.reduce((sum,row)=>sum+row.points,0);
      return {...p,history,wins,second,third,podiums:wins+second+third,points,count:history.length,average:history.length?Math.round(points/history.length):0,best:history.length?Math.min(...history.map(row=>row.rank)):null};
    });
    playerByName=new Map(players.map(p=>[p.name,p]));
    return {data,seasons,completedYears,years,players,playerByName};
  }
  function chart(model,players,metric,legend=false){
    const years=model.completedYears;
    const rank=metric==='rank',pct=metric==='percent';
    const all=model.players.flatMap(p=>p.history);
    const series=players.flatMap(p=>p.history);
    const maxRank=Math.max(2,...all.map(r=>r.rank));
    const highest=Math.max(0,...series.map(r=>r.points));
    const step=highest<=25?10:highest<=100?25:50;
    const top=rank?maxRank:pct?100:Math.max(step,Math.ceil(highest/step)*step);
    const ticks=rank?Array.from({length:maxRank},(_,i)=>i+1):Array.from({length:Math.round(top/(pct?25:step))+1},(_,i)=>i*(pct?25:step));
    const X=year=>years.length<2?410:48+(year===undefined?0:years.indexOf(year))/(years.length-1)*727;
    const Y=v=>rank?30+(v-1)/(maxRank-1)*225:255-v/top*225;
    const title=rank?'Sijoitukset vuosittain':pct?'Osuus maksimipisteistä vuosittain':'Pisteet vuosittain';
    const graph=svg('svg',{viewBox:'0 0 800 300',class:'race-chart',role:'img','aria-label':title},
      ticks.flatMap(t=>[svg('line',{class:'chart-grid',x1:48,x2:775,y1:Y(t),y2:Y(t)}),svg('text',{x:36,y:Y(t)+4,'text-anchor':'end'},pct?percent(t):t)]),
      years.map(y=>svg('text',{x:X(y),y:282,'text-anchor':'middle'},y)),
      players.map(p=>{
        const nodes=[];let previous=null;
        years.forEach(year=>{
          const entry=p.history.find(r=>r.year===year);
          if(!entry){previous=null;return;}
          const v=entry[metric];if(v===null||v===undefined){previous=null;return;}
          const point=[X(year),Y(v)];
          if(previous)nodes.push(svg('path',{class:'chart-line',d:`M ${previous[0]} ${previous[1]} L ${point[0]} ${point[1]}`}));
          nodes.push(svg('circle',{class:'chart-point',cx:point[0],cy:point[1],r:5},svg('title',{},`${p.name} · ${year}: ${pct?percent(v):v}`)));
          previous=point;
        });
        return svg('g',{'data-series':p.name,style:`--series:${playerToken(p.id)}`},nodes);
      }));
    const legendEl=legend?el('div',{class:'chart-legend','aria-label':'Näytä tai piilota pelaaja'},players.map(p=>el('button',{class:'legend-toggle',type:'button','aria-pressed':'true','data-toggle-series':p.name,style:{'--player':playerToken(p.id)}},el('span',{class:'player-dot'}),p.name))):null;
    if(legendEl)legendEl.addEventListener('click',event=>{
      const button=event.target.closest('button[data-toggle-series]');if(!button)return;
      const show=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(show));
      graph.querySelectorAll('[data-series]').forEach(group=>{if(group.dataset.series===button.dataset.toggleSeries)group.classList.toggle('series-off',!show);});
    });
    return el('div',{class:'chart-box'},legendEl,el('div',{class:'chart-scroll'},graph));
  }
  function barChart(standings){
    const max=Math.max(1,...standings.map(r=>r.points));
    return el('div',{class:'bar-chart','aria-label':'Pisteet pelaajittain'},standings.map(row=>el('div',{class:'bar-row'},el('span',{},playerLink(row.player)),el('div',{class:'bar-track'},el('span',{style:{width:`${Math.max(0,row.points/max*100)}%`,background:playerToken(playerByName.get(row.player)?.id||'unknown')}})),el('strong',{},row.points))));
  }
  function sortTables(){
    document.querySelectorAll('[data-sortable]').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')],tbody=table.tBodies[0];
      headers.forEach((th,index)=>{
        const button=el('button',{type:'button',class:'sort-btn'},th.textContent);th.replaceChildren(button);
        button.addEventListener('click',()=>{
          const previous=th.getAttribute('aria-sort');
          const dir=previous==='descending'?'ascending':previous==='ascending'?'descending':index===0?'ascending':'descending';
          headers.forEach(h=>h.removeAttribute('aria-sort'));th.setAttribute('aria-sort',dir);
          [...tbody.rows].sort((a,b)=>{
            const aa=a.cells[index].textContent.trim(),bb=b.cells[index].textContent.trim();
            const n=index===0?aa.localeCompare(bb,'fi'):(parseFloat(aa)||0)-(parseFloat(bb)||0);
            return dir==='ascending'?n:-n;
          }).forEach(row=>tbody.append(row));
        });
      });
    });
  }
  function renderStatistics(model){
    const {players,seasons,years,completedYears,data}=model;
    render('summary-metrics',metrics([['Päättyneet kaudet',String(completedYears.length)],['Pelaajat',String(players.length).padStart(2,'0')],['Eniten voittoja',Math.max(0,...players.map(p=>p.wins))]]));
    const rankingRows=players.map(p=>[playerLink(p.name),...years.map(y=>p.history.find(h=>h.year===y)?.rank??((data.participation?.[y]||[]).includes(p.name)?'✓':'–'))]);
    render('rankings',makeTable(['Pelaaja',...years],rankingRows,{id:'mainTable'},(value,i)=>i&&typeof value==='number'&&value<=3?{class:`rank-${value}`}:value==='✓'?{title:'Osallistuminen merkitty; sijoitus ei vielä saatavilla'}:{}));
    const rankNote=document.querySelector('.stats-card .stats-note');
    if(rankNote&&completedYears.length)rankNote.textContent=`– Ei osallistunut · ✓ Osallistuminen merkitty, sijoitus ei saatavilla. Kaavio näyttää päättyneet kaudet ${completedYears[0]}–${completedYears.at(-1)}.`;
    render('rank-chart',chart(model,players,'rank',true));
    const ordered=[...(data.overallOrder||[]).map(name=>model.playerByName.get(name)).filter(Boolean),...players.filter(p=>!(data.overallOrder||[]).includes(p.name))];
    render('overall',makeTable(['Nimi','Voitot','2. sijat','3. sijat','Podiumit','Pisteet','Pisteet / Maksimipisteet','Pisteet / Vuosi','Vuodet'],ordered.map(p=>[playerLink(p.name),p.wins,p.second,p.third,p.podiums,p.points,percent(p.overallPercent),p.average,p.count]),{id:'statsTable','data-sortable':true}));
    render('annual-statistics',seasons.filter(s=>s.status!=='predictions').map(s=>{
      const standings=[...s.standings].sort((a,b)=>a.rank-b.rank);
      return el('details',{class:'stats-card season-stats',id:`stats-${s.year}`},summary(s.year,`${standings.length} pelaajaa · Voittaja: ${standings[0]?.player||'–'}`),
        el('div',{class:'season-content'},el('div',{class:'season-grid'},scroll(makeTable(['Nimi','Pisteet','%'],standings.map(r=>[playerLink(r.player),r.points,percent(r.percent)]))),barChart(standings)),el('a',{class:'stats-text-link',href:resultLink(`year=${s.year}`)},'Katso kauden vastaukset →')));
    }));
    sortTables();
  }
  function renderArchive(model){
    const {seasons,players}=model;
    const year=document.querySelector('#filter-year'),player=document.querySelector('#filter-player'),category=document.querySelector('#filter-category'),question=document.querySelector('#filter-question');
    const addOptions=(select,values)=>values.forEach(value=>select.append(new Option(value,value)));
    addOptions(year,seasons.map(s=>s.year));addOptions(player,players.map(p=>p.name));addOptions(category,[...new Set(seasons.flatMap(s=>s.categories.map(c=>c.name)))]);
    const seasonNodes=seasons.map(s=>{
      const groups=s.categories.map(c=>el('details',{class:'archive-category','data-category':c.name,'data-questions':JSON.stringify(c.questions)},el('summary',{},c.name),
        el('div',{class:'table-wrap',role:'region',tabindex:'0','aria-label':`${c.name} – taulukot`},c.blocks.map(b=>b.table?makeTable(b.table.columns,b.table.rows,{class:b.table.type==='answers'?'answer-table':'correct-table','aria-label':b.table.label,caption:b.table.caption},(_,i)=>b.table.type==='answers'&&i===b.table.columns.length-1?{class:'points'}:{}):el('p',{},b.note)))));
      const totals=s.archiveTotals||s.standings.map(r=>({player:r.player,points:r.points}));
      return el('details',{class:'results-section archive-season','data-year':s.year,id:`results-${s.year}`},summary(s.year,`${s.categories.length} kategoriaa`),s.archiveIntro?el('p',{},s.archiveIntro):null,groups,el('p',{class:'results-total'},(s.status==='predictions'?'Pisteytys odottaa vahvistusta. ':'Kokonaistulokset: ')+totals.map(r=>`${r.player} ${r.points}`).join(' • ')));
    });
    render('archive',seasonNodes);document.querySelector('.filter-panel').hidden=false;
    // Filter logic works on the generated data-backed table nodes.
    const groups=seasonNodes.flatMap(season=>[...season.querySelectorAll('.archive-category')].map(node=>({season,node,questions:JSON.parse(node.dataset.questions),rows:[...node.querySelectorAll('tr[data-player]')]})));
    const params=new URLSearchParams(location.search);
    const setValue=(select,value)=>{if([...select.options].some(o=>o.value===value))select.value=value;};
    setValue(year,params.get('year')||'');setValue(player,params.get('player')||'');setValue(category,params.get('category')||'');
    const groupMatches=g=>(!year.value||g.season.dataset.year===year.value)&&(!player.value||g.rows.some(row=>row.dataset.player===player.value));
    function refreshCategories(){const selected=category.value;const available=[...new Set(groups.filter(groupMatches).map(g=>g.node.dataset.category))];category.replaceChildren(new Option('Kaikki kategoriat',''),...available.map(v=>new Option(v,v)));setValue(category,selected);}
    function refreshQuestions(){const selected=question.value;const available=[...new Set(groups.filter(g=>groupMatches(g)&&(!category.value||g.node.dataset.category===category.value)).flatMap(g=>g.questions))];question.replaceChildren(new Option('Kaikki kysymykset',''),...available.map(v=>new Option(v,v)));setValue(question,selected);}
    function apply(openMatches=false){
      const active=!!(year.value||player.value||category.value||question.value);let count=0,seasonCount=0;
      for(const g of groups){
        const match=groupMatches(g)&&(!category.value||g.node.dataset.category===category.value)&&(!question.value||g.questions.includes(question.value));g.node.hidden=!match;
        g.rows.forEach(row=>row.hidden=!!player.value&&row.dataset.player!==player.value);
        g.node.querySelectorAll('[data-question]').forEach(cell=>cell.hidden=!!question.value&&cell.dataset.question!==question.value);
        if(match){count++;if(openMatches&&active)g.node.open=!!(player.value||category.value||question.value);}
      }
      seasonNodes.forEach(season=>{const visible=groups.some(g=>g.season===season&&!g.node.hidden);season.hidden=!visible;if(visible){seasonCount++;if(openMatches&&active)season.open=true;}});
      document.querySelector('#filter-status').textContent=count?`${seasonCount} ${seasonCount===1?'kausi':'kautta'} · ${count} ${count===1?'kategoriatulos':'kategoriatulosta'}`:'Ei hakuehtoja vastaavia tuloksia.';
    }
    refreshCategories();refreshQuestions();setValue(question,params.get('question')||'');apply(true);
    [year,player,category,question].forEach(select=>select.addEventListener('change',()=>{if(select===year||select===player)refreshCategories();if(select!==question)refreshQuestions();apply(true);}));
    document.querySelector('#reset-filters').addEventListener('click',()=>{[year,player,category,question].forEach(s=>s.value='');refreshCategories();refreshQuestions();apply();seasonNodes.forEach(s=>s.open=false);groups.forEach(g=>g.node.open=false);});
    document.querySelector('#expand-results').addEventListener('click',()=>{seasonNodes.filter(s=>!s.hidden).forEach(s=>s.open=true);groups.filter(g=>!g.node.hidden).forEach(g=>g.node.open=true);});
    document.querySelector('#collapse-results').addEventListener('click',()=>{seasonNodes.forEach(s=>s.open=false);groups.forEach(g=>g.node.open=false);});
  }
  function renderPlayers(model){
    document.querySelector('.stats-hero p').textContent=`${model.players.length} pelaajaa, ${model.seasons.length} päättynyttä kautta. Valitse pelaaja ja tutustu hänen ennustushistoriaansa.`;
    render('players',el('div',{class:'players-grid'},[...model.players].sort((a,b)=>a.name.localeCompare(b.name,'fi')).map(p=>el('a',{class:'player-card',href:url(`Players/${p.id}.html`),style:{'--player':playerToken(p.id)}},
      el('div',{class:'player-card-top'},el('span',{class:'player-monogram'},p.name[0])),el('h2',{},p.name),el('div',{class:'player-mini'},[[p.wins,'voittoa'],[p.points,'pistettä'],[p.count,'kautta']].map(([v,label])=>el('span',{},el('strong',{},v),label))),el('span',{class:'player-cta'},'Pelaajan tilastot →')))));
  }
  function renderProfile(model){
    const p=model.players.find(p=>p.id===document.body.dataset.id);if(!p)throw new Error('Pelaajaa ei löydy');
    const color={'--player':playerToken(p.id)};
    document.title=`F1 Ennustukset - ${p.name}`;
    const years=p.history.map(r=>r.year);const subtitle=years.length?`${Math.min(...years)}–${Math.max(...years)} · Päättyneet kaudet`:'Ei päättyneitä kausia';
    const profile=el('div',{class:'profile-hero',style:color},el('span',{class:'eyebrow'},'PELAAJAPROFIILI'),el('div',{class:'profile-heading'},el('span',{class:'player-monogram'},p.name[0]),el('div',{},el('h1',{},p.name),el('p',{},subtitle))));
    const playerMetrics=metrics([['Voitot',p.wins],['Podiumit',p.podiums],['Pisteet',p.points],['Osuus maksimipisteistä',percent(p.overallPercent)],['Pisteet / vuosi',p.average],['Kaudet',p.count],['Paras sijoitus',p.best===null?'–':`${p.best}.`],['2. / 3. sijat',`${p.second} / ${p.third}`]],'profile-metrics',color);
    const history=section('Kausihistoria',scroll(makeTable(['Kausi','Sijoitus','Pisteet','Osuus maksimipisteistä','Vastaukset'],p.history.map(row=>[row.year,`${row.rank}.`,row.points,percent(row.percent),el('a',{href:resultLink(`year=${row.year}&player=${encodeURIComponent(p.name)}`)},'Katso vastaukset →')]),{},(_,i)=>i===0?{tag:'th',scope:'row'}:{}),'Kausihistoria'));
    const ongoing=Object.entries(model.data.participation||{}).filter(([y,names])=>names.includes(p.name)&&!years.includes(Number(y))).map(([year])=>el('p',{class:'stats-note'},`${year}: osallistuminen merkitty alkuperäisiin tilastoihin; lopputulosta ei vielä ole aineistossa.`));
    const links=el('div',{class:'stats-links'},el('a',{href:resultLink(`player=${encodeURIComponent(p.name)}`)},el('span',{},'ARKISTO'),el('strong',{},'Kaikki pelaajan vastaukset →')),el('a',{href:url('players.html')},el('span',{},'PELAAJAT'),el('strong',{},'Takaisin pelaajiin →')));
    render('player-profile',profile,playerMetrics,history,ongoing,section('Sijoitukset vuosittain',chart(model,[p],'rank')),section('Pisteet vuosittain',chart(model,[p],'points')),section('Osuus maksimipisteistä',chart(model,[p],'percent')),links);
  }
  function photoCredit(team){
    const c=team.imageCredit;if(!c)return null;
    return el('p',{class:'photo-credit'},'© ',el('a',{href:c.authorUrl},c.author),' · ',el('a',{href:c.source,title:c.title},'Wikimedia Commons'),' · ',el('a',{href:c.licenseUrl},c.license),el('span',{class:'photo-modifications'},c.modifications));
  }
  function renderTeams(data){
    render('teams',statsSources(data),el('div',{class:'team-container'},data.teams.map(team=>{
      const rows=Object.entries(team.overviewStats).map(([label,v])=>[label,v,...team.drivers.map(d=>d.careerStats?.[label])]);
      return el('div',{class:`team-row team-${team.id}`},el('div',{class:'team-img-container'},el('a',{href:url(`Teams/${team.id}.html`)},el('img',{class:'team-img',src:url(team.image),alt:team.imageAlt,loading:'lazy'}),el('h3',{class:'team-name-overlay'},team.name))),el('div',{class:'team-info'},makeTable(['',team.name,...team.drivers.map(d=>d.name)],rows,{class:'driver-stats'})));
    })));
  }
  function statsSources(data,team){
    const meta=data.statistics;if(!meta)return null;
    const sources=team?team.statSources:meta.sources;
    return el('aside',{class:'stats-card stats-provenance','aria-label':'Tilastojen lähteet ja rajaus'},
      el('p',{},el('strong',{},`Tilastot tarkistettu ${meta.checkedLabel}`),` · ${meta.throughLabel}`),
      el('p',{class:'stats-note'},meta.method),
      team?.historyNote?el('p',{class:'stats-note'},team.historyNote):null,
      el('details',{},el('summary',{},'Lähteet ja laskentatapa'),
        el('p',{class:'stats-note'},meta.detail),
        el('ul',{},(sources||[]).map(s=>el('li',{},el('a',{href:s.url},s.label))))));
  }
  function renderTeam(data){
    const team=data.teams.find(t=>t.id===document.body.dataset.id);if(!team)throw new Error('Tallia ei löydy');
    document.title=`F1 Ennustukset - ${team.name}`;
    const img=el('img',{src:url(team.image),alt:team.imageAlt,class:'team-hero-img'});img.addEventListener('error',()=>img.hidden=true);
    const hero=el('section',{class:'team-hero'},img,el('h1',{},team.name),el('p',{class:'team-years'},team.activeYears));
    const grid=el('div',{class:'team-grid'},el('section',{class:'team-card'},el('h2',{},'Moottori'),el('p',{class:'engine-chip'},team.engine),el('h2',{},'Kuljettajat'),el('ul',{class:'driver-list'},team.drivers.map(d=>el('li',{},d.profileName||d.name)))),el('section',{class:'team-card'},el('h2',{},team.achievementHeading),el('div',{class:'stat-tiles'},Object.entries(team.achievements).map(([label,value])=>el('div',{class:'stat-tile'},el('span',{class:'stat-value'},value),el('span',{class:'stat-label'},label))))));
    const history=team.history?el('section',{class:'team-card team-history'},el('h2',{},'Tallin historia'),el('div',{class:'table-scroll'},makeTable(team.history.columns,team.history.rows,{class:'achievements-table'}))):null;
    const switcher=el('div',{class:'team-switcher'},el('h2',{},'Muut tallit'),data.teams.map(t=>el('a',{href:url(`Teams/${t.id}.html`),class:t.id===team.id?'current':null,'aria-current':t.id===team.id?'page':null,style:{'--dot':teamToken(t.id)}},t.name)));
    const driverStats=el('section',{class:'team-card'},el('h2',{},'Kuljettajien uratilastot'),scroll(makeTable(['',...team.drivers.map(d=>d.name)],Object.keys(team.overviewStats).map(label=>[label,...team.drivers.map(d=>d.careerStats?.[label])]),{class:'achievements-table'},(_,i)=>i===0?{tag:'th',scope:'row'}:{})));
    render('team-profile',hero,photoCredit(team),statsSources(data,team),grid,driverStats,history,switcher);
  }
  function renderHistory(data){
    const categories=data.historicalResults;
    document.querySelector('.section-index').replaceChildren(...categories.map(cat=>el('a',{href:`#${cat.id}`},cat.title)));
    render('historical-results',categories.map(cat=>el('section',{class:'season-panel',id:cat.id},el('h2',{},cat.title),el('p',{},cat.description),el('div',{class:'championship-tables'},orderByYear(cat.seasons).filter(s=>s.year<data.referenceSeason).slice(0,3).map(season=>el('div',{class:'table-wrapper'},el('h3',{},season.year),makeTable(season.columns,season.rows,{class:season.tableClass})))))));
    if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }
  try {
    if(['teams','team-profile','seasonsinfo'].includes(page)){
      const f1=await app.load('f1');
      if(page==='teams')renderTeams(f1);else if(page==='team-profile')renderTeam(f1);else renderHistory(f1);
    }else{
      const model=gameModel(await app.load('results'));
      const eyebrow=document.querySelector('.stats-hero .eyebrow');
      if(eyebrow&&model.years.length)eyebrow.textContent=`${eyebrow.textContent.split(' / ')[0]} / ${model.years[0]}–${model.years.at(-1)}`;
      if(page==='statistics')renderStatistics(model);else if(page==='results')renderArchive(model);else if(page==='players')renderPlayers(model);else if(page==='player-profile')renderProfile(model);
    }
  }catch(error){app.showError(error);}
})();
