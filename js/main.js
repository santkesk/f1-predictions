/* Shared site functionality: navigation, data loading, design-token helpers and homepage countdown. */
(() => {
  'use strict';
  // Resolve files relative to this script, not the page. Works on a GitHub Pages project
  // path as well as nested Teams/ and Players/ detail pages.
  const root = new URL('../', document.currentScript.src);
  const requests = new Map();
  const url = path => new URL(path, root).href;
  const page = document.body.dataset.page;
  function load(file) {
    if (!requests.has(file)) {
      requests.set(file, fetch(url(`data/${file}.json`)).then(response => {
        if (!response.ok) throw new Error(`${file}.json: HTTP ${response.status}`);
        return response.json();
      }).catch(error => { requests.delete(file); throw error; }));
    }
    return requests.get(file);
  }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (name === 'style' && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => node.style.setProperty(key, val));
      } else node.setAttribute(name, value === true ? '' : String(value));
    });
    node.append(...children.flat(Infinity).filter(value => value !== null && value !== undefined && value !== false).map(value => value instanceof Node ? value : String(value)));
    return node;
  }
  function render(key, ...nodes) {
    const target = document.querySelector(`[data-render="${key}"]`);
    if (!target) throw new Error(`Missing data-render target: ${key}`);
    target.replaceWith(...nodes.flat(Infinity).filter(node => node !== null && node !== undefined && node !== false));
  }
  function showError(error, targets = document.querySelectorAll('[data-render]')) {
    console.error(error);
    const message = location.protocol === 'file:'
      ? 'Tietojen lataaminen vaatii verkkopalvelimen. Avaa sivusto GitHub Pagesissa tai paikallisen HTTP-palvelimen kautta.'
      : 'Tietojen lataaminen epäonnistui. Tarkista yhteys ja lataa sivu uudelleen.';
    for (const target of targets) {
      target.replaceWith(el('p', {class:'data-error', role:'alert'}, message));
    }
  }
  const playerToken = id => `var(--player-${id})`;
  const teamToken = id => `var(--team-${id === 'sauber' ? 'audi' : id})`;
  window.F1App = Object.freeze({root, page, url, load, el, render, showError, playerToken, teamToken});

  // Shared responsive navigation.
  const menuButton = document.querySelector('.nav-toggle');
  const menu = document.querySelector('#site-navigation');
  if (menuButton && menu) {
    menuButton.hidden = false;
    const header = menuButton.closest('.site-header');
    header.classList.add('nav-enhanced');
    const closeMenu = () => { menuButton.setAttribute('aria-expanded', 'false'); header.classList.remove('menu-open'); };
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      header.classList.toggle('menu-open', open);
    });
    header.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.classList.contains('menu-open')) { closeMenu(); menuButton.focus(); }
    });
    document.addEventListener('click', event => { if (!header.contains(event.target)) closeMenu(); });
  }

  // Homepage: deadline comes from results.json, not hard-coded JavaScript.
  const countdown = document.getElementById('countdown');
  if (countdown) {
    load('submission').then(connection => load(connection.seasonFile)).then(prediction => {
      const data = {prediction};
      const season = data.prediction.season;
      const kicker = document.querySelector('.hero-kicker');
      const heading = document.querySelector('#hero-heading em');
      const countdownHeading = document.querySelector('#countdown-heading');
      if (kicker) kicker.replaceChildren(el('span', {class:'signal'}), ` FORMULA 1 / KAUSI ${season}`);
      if (heading) heading.replaceChildren(String(season), el('span', {class:'hero-period'}, '.'));
      if (countdownHeading) countdownHeading.textContent = `Aikaa kauden ${season} alkuun:`;
      const target = new Date(data.prediction.deadline).getTime();
      if (!Number.isFinite(target)) throw new Error('Invalid prediction deadline');
      const fields = ['days','hours','minutes','seconds'].map(id => document.getElementById(id));
      let interval;
      function update() {
        const distance = target - Date.now();
        if (distance < 0) {
          countdown.classList.add('countdown-started');
          countdown.replaceChildren(el('div',{class:'season-status'},el('span',{class:'signal','aria-hidden':'true'}),' Kausi on alkanut!'));
          clearInterval(interval);
          return;
        }
        const day = 86400000, hour = 3600000, minute = 60000;
        const values = [Math.floor(distance/day), Math.floor(distance%day/hour), Math.floor(distance%hour/minute), Math.floor(distance%minute/1000)];
        values.forEach((v,i) => { if(fields[i])fields[i].textContent = v; });
      }
      interval = setInterval(update,1000);
      update();
    }).catch(error => { console.error(error); countdown.textContent='Ajastinta ei voitu ladata.'; });
  }
})();
