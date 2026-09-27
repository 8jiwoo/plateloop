/* Loopi Kids: the kindergarten app. Children see pictures, not numbers: their Loopi eats the lunch they
   ate, leftovers turn into crumbs to clean up, every colour of food they eat fills their rainbow, and
   new foods become stickers. Behind a grown-up check, parents and teachers get the healthcare report:
   what the child ate, nutrients against a lunch for their age, allergy checks and eating habits. */
(() => {
'use strict';
const { $, $$, pct, esc } = PL;
const H = PL.health, G = PL.game, MENU = H.KIDS_MENU;

const ui = { tab: 'play', adult: false, gate: null, preset: 'Ate well' };
let root = null;
const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  play: I('<path d="M12 3c4 0 7 4.5 7 9.5S16 21 12 21s-7-3.5-7-8.5S8 3 12 3Z"/><circle cx="9.5" cy="12" r=".8" fill="currentColor"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>'),
  grown: I('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  feed: I('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>'),
  ball: I('<circle cx="12" cy="12" r="8"/><path d="M4.5 9.5c4 1 11 1 15 0M4.5 14.5c4-1 11-1 15 0"/>'),
  sweep: I('<path d="M14 3l-4 9M6 21l2-9h8l2 9Z"/><path d="M10 16v5M14 16v5"/>'),
  night: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  day: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
};
const me = () => H.kid(PL.S.care.me.kid) || PL.S.care.kids[0];
const act = fn => { const out = fn(); PL.store.save('kids'); return out; };
const scannedToday = K => K.log[0].day === H.TODAY;
const dishName = (K, d) => K.allergy && d.allergen === K.allergy ? d.safe : d.name;

/* ================================================================ frame */
function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="stu kids">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon kids-icon" aria-hidden="true"><canvas width="44" height="37" data-form="explorer" data-stage="baby"></canvas></span><div><b>Loopi Kids</b><span>by PlateLoop · for kindergartens</span></div></div>
      <p class="stu-note">Demo: pick a child</p>
      <div class="chips" id="kid-who"></div>
      <div class="demo-box">
        <label for="kid-preset">Lunch at the scanner</label>
        <select id="kid-preset">${Object.keys(H.PRESETS).map(p => `<option>${p}</option>`).join('')}</select>
        <button class="btn primary" id="kid-lunch"></button>
      </div>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone">
      <header class="phone-top" id="kid-top"></header>
      <div class="phone-body" id="kid-body"></div>
      <nav class="phone-tabs two" role="tablist" aria-label="Loopi Kids">
        <button role="tab" data-tab="play">${ICON.play}Loopi</button>
        <button role="tab" data-tab="grown">${ICON.grown}Grown-ups</button>
      </nav>
      <div id="kid-layer"></div>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => {
    if (b.dataset.tab === 'grown' && !ui.adult) { gate(); return; }
    ui.tab = b.dataset.tab; render(); $('#kid-body').scrollTop = 0;
  });
  $('#kid-preset', el).onchange = e => { ui.preset = e.target.value; };
  $('#kid-lunch', el).onclick = () => {
    const K = me(); if (scannedToday(K)) return;
    const r = act(() => H.scanKidLunch(K, ui.preset));
    PL.toast(`${K.name}'s tray scanned: ${pct(1 - r.w)} eaten. Lunch is in Loopi's bowl.`);
  };
  render();
}
function render(keep) {
  if (!root) return;
  const K = me(), g = G.ensure(K), body = $('#kid-body', root), y = body.scrollTop;
  $('#kid-who', root).innerHTML = PL.S.care.kids.map(k => `<button class="chip plain" data-kid="${k.id}" aria-pressed="${k.id === K.id}">${esc(k.name)}</button>`).join('');
  $$('#kid-who button', root).forEach(b => b.onclick = () => { PL.S.care.me.kid = b.dataset.kid; PL.store.save('me'); });
  const lb = $('#kid-lunch', root); lb.textContent = scannedToday(K) ? 'Lunch is done' : 'Scan lunch tray'; lb.disabled = scannedToday(K);
  $('#kid-preset', root).value = ui.preset;
  $('#kid-top', root).innerHTML = `<canvas width="40" height="34" data-kid-pet></canvas><div><b>${esc(K.name)}'s Loopi</b><span>Sunflower class · age ${K.age}</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ui.tab === 'play' ? play(K, g) : grown(K);
  wire(K, g);
  paint(0);
  if (keep) body.scrollTop = y;
  layer();
}
function paint(t) {
  const K = me();
  $$('canvas[data-kid-pet]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...PL.petOf(K) }));
  PL.paintPets(root, t);
}

/* ================================================================ Play: the room, the rainbow, stickers */
function play(K, g) {
  const lunch = g.plate && !g.plate.eaten, mess = g.mess.length, rec = K.log[0];
  const colours = [...new Set(MENU.map(d => d.rainbow))];
  const eatenColours = new Set(scannedToday(K) ? MENU.filter(d => rec.eaten[d.id] >= rec.served[d.id] * .5).map(d => d.rainbow) : []);
  const tried = MENU.map(d => ({ d, n: K.log.filter(l => l.eaten[d.id] >= l.served[d.id] * .2).length }));
  return `
  ${g.ready ? `<button class="btn primary big grow-btn" id="kid-grow">Loopi is ready to grow! Tap!</button>` : ''}
  <div class="room kid-room">
    <canvas class="room-cv" id="room-cv" aria-label="Loopi's room. Tap Loopi to give a hug, tap crumbs to clean them up."></canvas>
    <div class="room-say" id="room-say" hidden></div>
  </div>
  <div class="room-actions kid-actions">
    <button data-k="feed" class="${lunch ? 'hot' : ''}" aria-label="Feed">${ICON.feed}<span>Feed</span></button>
    <button data-k="ball" aria-label="Play ball">${ICON.ball}<span>Play</span></button>
    <button data-k="sweep" aria-label="Clean up">${ICON.sweep}<span>Clean${mess ? ` ${mess}` : ''}</span></button>
    <button data-k="lights" aria-label="${PL.Room.night ? 'Wake up' : 'Sleep'}">${ICON[PL.Room.night ? 'day' : 'night']}<span>${PL.Room.night ? 'Wake' : 'Sleep'}</span></button>
  </div>
  <section class="group rainbow">
    <b>My rainbow lunch</b>
    <div class="rb-dots">${colours.map(c => `<span class="rb ${eatenColours.has(c) ? 'on' : ''}" style="--c:${H.RAINBOW[c]}" aria-label="${c}${eatenColours.has(c) ? ', eaten' : ''}">${eatenColours.has(c) ? ICON.check : ''}</span>`).join('')}</div>
    <span>${scannedToday(K) ? (eatenColours.size >= 5 ? `${eatenColours.size} colours! Super rainbow!` : `${eatenColours.size} colours today!`) : 'Eat lots of colours at lunch!'}</span>
  </section>
  <section class="group stickers">
    <b>My food stickers</b>
    <div class="st-grid">${tried.map(({ d, n }) => `<div class="sticker ${n ? '' : 'empty'}"><span class="st-food" style="--c:${d.color};--e:${d.edge}"><i></i><i></i><em></em></span><small>${esc(d.name.split(' ').slice(-1)[0])}</small><span class="stars">${'★'.repeat(Math.min(5, n))}</span></div>`).join('')}</div>
  </section>`;
}
const roomHooks = {
  info: () => { const K = me(), g = G.ensure(K); return { ...PL.petOf(K), plate: g.plate && !g.plate.eaten ? g.plate.food : null, plant: G.plantOf(K) }; },
  mess: () => G.ensure(me()).mess,
  eat: () => { const p = act(() => G.serveLunch(me())); return p && { heart: p.heart, crumbs: p.crumbs.length }; },
  pet: () => act(() => G.petLoopi(me())),
  fetched: () => act(() => G.playBall(me())),
  swept: type => { act(() => G.sweep(me(), type)); if (!G.ensure(me()).mess.length) PL.Room.say('So clean! Thank you!', 2.4); },
  chatter: () => {
    const g = G.ensure(me());
    if (g.plate && !g.plate.eaten) return 'Yummy smell! Tap Feed!';
    if (g.mess.length) return 'Oops, crumbs! Can you clean up?';
    if (g.ready) return 'I\'m growing! Ask a grown-up!';
    return ['Let\'s play ball!', 'I love blueberries!', 'Broccoli makes me strong!', 'Hug me!', null, null][Math.floor(Math.random() * 6)];
  },
};

/* ================================================================ Grown-ups: the healthcare report */
function grown(K) {
  const today = scannedToday(K), rec = K.log[0], T = H.KIDS_TARGET;
  const days = [...K.log].reverse();
  const avgEat = id => K.log.reduce((s, l) => s + l.eaten[id] / l.served[id], 0) / K.log.length;
  const ranked = MENU.map(d => ({ d, a: avgEat(d.id) })).sort((a, b) => b.a - a.a);
  const fav = ranked.slice(0, 2), picky = ranked[ranked.length - 1];
  const vegDays = K.log.filter(l => MENU.some(d => d.group === 'veg' && l.eaten[d.id] >= l.served[d.id] * .5)).length;
  const allergen = MENU.find(d => d.allergen && d.allergen === K.allergy);
  const g = G.ensure(K);
  return `
  <section class="group rep-head"><div><b>${esc(K.name)}'s lunch report</b><span>${today ? 'Today, Fri 25' : `Last scanned lunch, ${rec.day}`} · Sunflower class</span></div><span class="pill">Age ${K.age}</span></section>
  ${K.allergy ? `<div class="care-alert ok">${ICON.check}<span><b>${esc(K.allergy)} allergy:</b> ${allergen ? `${esc(K.name)} was served ${esc(allergen.safe.toLowerCase())}.` : ''} No ${esc(K.allergy.toLowerCase())} on the tray this week.</span></div>` : ''}
  <h4 class="sec">What ${esc(K.name)} ate</h4>
  <section class="group">${MENU.map(d => { const ate = 1 - rec.measured[d.id] / rec.served[d.id]; return `<div class="dish"><i style="background:${d.color};border-color:${d.edge}"></i><span>${esc(dishName(K, d))}</span><span class="dbar"><i style="width:${Math.round(ate * 100)}%"></i></span><span class="g-v num">${pct(ate)}</span></div>`; }).join('')}</section>
  <h4 class="sec">Nutrition, compared with a lunch for age ${K.age}</h4>
  <section class="group health-top">${H.ring(rec.n.kcal, T.kcal, `of ${T.kcal} kcal`)}<div style="flex:1;min-width:0">${H.nutrientRows(rec.n, T, ['p', 'c', 'f'])}</div></section>
  <h4 class="sec">This week, share of lunch eaten</h4>
  <section class="group chart">${H.dayBars(days.map(l => l.day), days.map(l => 1 - l.w), 'Share of lunch eaten each day', .75, 1)}</section>
  <h4 class="sec">Eating habits</h4>
  <section class="group">
    <div class="finding"><i style="background:var(--tint)"></i><span>Favourites: ${fav.map(x => `${esc(x.d.name.toLowerCase())} (${pct(x.a)})`).join(' and ')}.</span></div>
    <div class="finding"><i style="background:var(--orange)"></i><span>Least eaten: ${esc(picky.d.name.toLowerCase())}, ${pct(picky.a)} on average.${picky.d.group === 'veg' ? ' Small pieces and trying it again at home both help. It can take many tries to like a new vegetable.' : ''}</span></div>
    <div class="finding"><i style="background:var(--blue)"></i><span>Ate at least half the vegetables on ${vegDays} of ${K.log.length} days.</span></div>
    <div class="finding"><i style="background:var(--purple)"></i><span>Loopi is a ${PL.stuStage(K).name.toLowerCase()} with ${g.hearts} of ${G.heartsReq(g)} hearts${g.ready ? ', ready to grow up' : ''}. Hearts come from finishing more than usual.</span></div>
  </section>
  <h4 class="sec">From the teacher</h4>
  <section class="group note"><p>${esc(K.note)}</p><span>Ms. Jung, Sunflower class</span></section>
  <div class="two-btn"><button class="btn" id="kid-lock">Back to Loopi</button><button class="btn" id="kid-print">Print report</button></div>
  <p class="foot">Measured by the kindergarten scanner before and after lunch. The teacher helps each child look at the camera. Targets are illustrative.</p>`;
}

/* ================================================================ grown-up check */
function gate() {
  const a = 2 + Math.floor(Math.random() * 6), b = 2 + Math.floor(Math.random() * 6), ans = a + b;
  const opts = [ans, ans + 2, ans - 1].sort(() => Math.random() - .5);
  ui.gate = { a, b, ans, opts }; layer();
}
function layer() {
  const el = $('#kid-layer', root); if (!el) return;
  if (!ui.gate) { el.innerHTML = ''; return; }
  const { a, b, opts } = ui.gate;
  el.innerHTML = `<div class="pmodal" role="dialog" aria-label="Grown-ups only"><div class="pmodal-card"><h3>Grown-ups only</h3><p class="center hint">What is ${a} + ${b}?</p><div class="gate-opts">${opts.map(o => `<button class="btn" data-ans="${o}">${o}</button>`).join('')}</div><button class="btn ghost" data-cancel>Cancel</button></div></div>`;
  $$('[data-ans]', el).forEach(bt => bt.onclick = () => { if (+bt.dataset.ans === ui.gate.ans) { ui.adult = true; ui.tab = 'grown'; } else PL.toast('Not quite. Ask a grown-up!'); ui.gate = null; render(); });
  $('[data-cancel]', el).onclick = () => { ui.gate = null; layer(); };
}

/* ================================================================ wiring */
function wire(K) {
  const body = $('#kid-body', root);
  $$('[data-k]', body).forEach(b => b.onclick = () => {
    const a = b.dataset.k;
    if (a === 'feed') PL.Room.feed();
    else if (a === 'ball') PL.Room.throwBall();
    else if (a === 'sweep') { if (PL.Room.crumbs.length) PL.Room.sweepAll(); else PL.Room.say('All clean!', 2); }
    else if (a === 'lights') { PL.Room.toggleNight(); render(true); }
  });
  const grow = $('#kid-grow', body);
  if (grow) grow.onclick = () => { const s = act(() => G.evolve(me())); if (s) { PL.Room.jump(16, .8); PL.Room.say(`I'm a ${s.name.toLowerCase()} now!`, 3); } };
  const cv = $('#room-cv', body); if (cv) PL.Room.attach(cv, $('#room-say', body), roomHooks);
  const lock = $('#kid-lock', body); if (lock) lock.onclick = () => { ui.adult = false; ui.tab = 'play'; render(); };
  const pr = $('#kid-print', body); if (pr) pr.onclick = () => print();
}

PL.apps.kids = {
  title: 'Loopi Kids',
  mount,
  unmount() { ui.adult = false; ui.tab = 'play'; ui.gate = null; root = null; },
  update(kind) { render(kind !== 'me'); },
  tick(t) { if (root) PL.drawPet && $$('canvas[data-kid-pet]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...PL.petOf(me()) })); },
};
})();
