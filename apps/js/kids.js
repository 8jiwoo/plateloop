/* Loopi Kids: the preschool app. For children, Loopi is a guide, not a game: it shows today's food in
   pictures, suggests one new thing to try, cheers the colours they ate, and reads everything aloud for
   children who can't read yet. Behind a grown-up check, parents and teachers get the healthcare report:
   what the child ate, nutrients for their age, allergy checks and eating habits. */
(() => {
'use strict';
const { $, $$, pct, esc } = PL;
const H = PL.health, V = PL.V, MENU = H.KIDS_MENU;

const ui = { tab: 'kid', adult: false, gate: null, preset: 'Ate well' };
let root = null;
const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  kid: I('<path d="M12 3c4 0 7 4.5 7 9.5S16 21 12 21s-7-3.5-7-8.5S8 3 12 3Z"/><circle cx="9.5" cy="12" r=".8" fill="currentColor"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>'),
  grown: I('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
};
const me = () => H.kid(PL.S.care.me.kid) || PL.S.care.kids[0];
const scannedToday = K => K.log[0].day === H.TODAY;
const dishName = (K, d) => K.allergy && d.allergen === K.allergy ? d.safe : d.name;

/* ================================================================ frame */
function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="stu kids">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon kids-icon" aria-hidden="true">${V.loopi('happy', 46)}</span><div><b>Loopi Kids</b><span>by PlateLoop · for preschools</span></div></div>
      <p class="stu-note">Demo: pick a child</p>
      <div class="chips" id="kid-who"></div>
      <div class="demo-box">
        <label for="kid-preset">Lunch at the scanner</label>
        <select id="kid-preset">${Object.keys(H.PRESETS).map(p => `<option>${p}</option>`).join('')}</select>
        <button class="btn primary" id="kid-lunch"></button>
      </div>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone warm">
      <header class="phone-top" id="kid-top"></header>
      <div class="phone-body" id="kid-body"></div>
      <nav class="phone-tabs two" role="tablist" aria-label="Loopi Kids">
        <button role="tab" data-tab="kid">${ICON.kid}Loopi</button>
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
    const r = H.scanKidLunch(K, ui.preset); PL.store.save('kids');
    PL.toast(`${K.name}'s tray scanned: ${pct(1 - r.w)} eaten.`);
  };
  render();
}
function render(keep) {
  if (!root) return;
  const K = me(), body = $('#kid-body', root), y = body.scrollTop;
  $('#kid-who', root).innerHTML = PL.S.care.kids.map(k => `<button class="chip plain" data-kid="${k.id}" aria-pressed="${k.id === K.id}">${esc(k.name)}</button>`).join('');
  $$('#kid-who button', root).forEach(b => b.onclick = () => { PL.S.care.me.kid = b.dataset.kid; PL.store.save('me'); });
  const lb = $('#kid-lunch', root); lb.textContent = scannedToday(K) ? 'Lunch is done' : 'Scan lunch tray'; lb.disabled = scannedToday(K);
  $('#kid-preset', root).value = ui.preset;
  $('#kid-top', root).innerHTML = `${PL.V.avatar(K, 36)}<div><b>${esc(K.name)}</b><span>Sunflower class · age ${K.age}</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ui.tab === 'kid' ? kid(K) : grown(K);
  wire();
  if (keep) body.scrollTop = y;
  layer();
}

/* ================================================================ for the child: Loopi guides */
const avgEaten = (K, id) => K.log.reduce((s, l) => s + l.eaten[id] / l.served[id], 0) / K.log.length;
function kid(K) {
  const done = scannedToday(K), rec = K.log[0];
  const picky = [...MENU].sort((a, b) => avgEaten(K, a.id) - avgEaten(K, b.id))[0];
  const colours = [...new Set(MENU.map(d => d.rainbow))];
  const ate = new Set(done ? MENU.filter(d => rec.eaten[d.id] >= rec.served[d.id] * .5).map(d => d.rainbow) : []);
  const short = d => dishName(K, d).replace(' without egg', '').toLowerCase();
  let expr, line;
  if (!done) { expr = 'point'; line = `Hi ${K.name}! It's lunch time! Can you try one bite of ${short(picky)} today?`; }
  else if (ate.size >= 5) { expr = 'cheer'; line = `Wow, ${K.name}! You ate ${ate.size} colours. A rainbow makes you strong!`; }
  else if (1 - rec.w >= .6) { expr = 'happy'; line = `Yummy lunch, ${K.name}! You ate ${ate.size} colours today.`; }
  else { expr = 'calm'; line = `That's okay, ${K.name}. Tomorrow, let's try a little more.`; }
  let out = V.guide(expr, esc(line), { big: true, speak: line });
  if (!done) {
    out += `<div class="vcard kidcard"><h3>Today's lunch</h3>${V.tray(MENU, null, { size: 50, hi: picky.id, tag: d => d.id === picky.id ? 'Try me!' : '', name: d => dishName(K, d).replace(' without egg', '') })}</div>
    <div class="vcard kidcard"><h3>Eat a rainbow</h3><div class="rb-dots big">${colours.map(c => `<span class="rb" style="--c:${H.RAINBOW[c]}" aria-label="${c}"></span>`).join('')}</div>
      <p class="kidline">Every colour helps your body in a different way.</p></div>`;
    return out;
  }
  const tried = rec.eaten[picky.id] >= rec.served[picky.id] * .3;
  const tip = tried ? `You tried the ${short(picky)}! New foods get yummier each time.` : `Small bites are okay. Let's try the ${short(picky)} again next time.`;
  out += `<div class="vcard kidcard"><h3>My lunch</h3>${V.tray(MENU, rec, { size: 50, name: d => dishName(K, d).replace(' without egg', '') })}</div>
  <div class="vcard kidcard"><h3>My rainbow</h3><div class="rb-dots big">${colours.map(c => `<span class="rb ${ate.has(c) ? 'on' : ''}" style="--c:${H.RAINBOW[c]}" aria-label="${c}${ate.has(c) ? ', eaten' : ''}">${ate.has(c) ? ICON.check : ''}</span>`).join('')}</div>
    <p class="kidline">${ate.size} of ${colours.length} colours</p></div>
  ${V.guide(tried ? 'cheer' : 'think', esc(tip), { speak: tip })}`;
  return out;
}

/* ================================================================ for grown-ups: the healthcare report */
function grown(K) {
  const today = scannedToday(K), rec = K.log[0], T = H.KIDS_TARGET;
  const days = [...K.log].reverse();
  const ranked = MENU.map(d => ({ d, a: avgEaten(K, d.id) })).sort((a, b) => b.a - a.a);
  const fav = ranked.slice(0, 2), picky = ranked[ranked.length - 1];
  const vegDays = K.log.filter(l => MENU.some(d => d.group === 'veg' && l.eaten[d.id] >= l.served[d.id] * .5)).length;
  const allergen = MENU.find(d => d.allergen && d.allergen === K.allergy);
  return `
  ${V.guide('calm', `${today ? 'Today' : `On ${rec.day}`}, ${esc(K.name)} ate ${pct(1 - rec.w)} of lunch.${K.allergy ? ` Every tray this week was checked for ${esc(K.allergy.toLowerCase())}.` : ''}`)}
  ${K.allergy ? `<div class="vtips">${V.tip('check', 'good', `${esc(K.allergy)} allergy: safe tray`, `${allergen ? `${esc(K.name)} was served ${esc(allergen.safe.toLowerCase())}. ` : ''}No ${esc(K.allergy.toLowerCase())} on the tray this week.`)}</div>` : ''}
  <div class="vcard"><h3>What ${esc(K.name)} ate <small>${today ? 'today' : rec.day}</small></h3>${V.tray(MENU, rec, { name: d => dishName(K, d) })}</div>
  <div class="vcard"><h3>Nutrition <small>lunch for age ${K.age}</small></h3><div class="vrings">${V.ring(rec.n.kcal, T.kcal, 'Energy', 'kcal')}${V.ring(rec.n.p, T.p, 'Protein', 'g', 'aim')}${V.ring(rec.n.c, T.c, 'Carbs', 'g')}</div></div>
  <div class="vcard"><h3>Plate balance</h3>${V.healthyPlate(V.plateShares(MENU, rec.eaten), { you: `${esc(K.name)}'s plate` })}</div>
  <div class="vcard"><h3>This week <small>share of lunch eaten</small></h3>${V.week(days.map(l => l.day), days.map(l => 1 - l.w), { today: today ? days.length - 1 : -1 })}</div>
  <div class="vtips">
    ${V.tip('check', 'good', `Favourites: ${fav.map(x => x.d.name.toLowerCase()).join(' and ')}`, `Usually ${fav.map(x => pct(x.a)).join(' and ')} eaten.`)}
    ${V.tip('leaf', picky.d.group === 'veg' ? 'warn' : 'info', `Least eaten: ${picky.d.name.toLowerCase()} (${pct(picky.a)})`, picky.d.group === 'veg' ? 'Small pieces and offering it again at home both help. It can take many tries to like a new vegetable.' : 'Worth a gentle try at home too.')}
    ${V.tip('plate', 'info', `Vegetables on ${vegDays} of ${K.log.length} days`, 'Days when at least half the vegetables were eaten.')}
  </div>
  <div class="vcard note2"><p>“${esc(K.note)}”</p><span>Ms. Farah, Sunflower class</span></div>
  <div class="two-btn"><button class="btn" id="kid-lock">Back to Loopi</button><button class="btn" id="kid-print">Print report</button></div>
  <p class="foot">Measured by the preschool scanner before and after lunch. The teacher helps each child look at the camera. Targets are illustrative.</p>`;
}

/* ================================================================ grown-up check */
function gate() {
  const a = 2 + Math.floor(Math.random() * 6), b = 2 + Math.floor(Math.random() * 6), ans = a + b;
  ui.gate = { a, b, ans, opts: [ans, ans + 2, ans - 1].sort(() => Math.random() - .5) }; layer();
}
function layer() {
  const el = $('#kid-layer', root); if (!el) return;
  if (!ui.gate) { el.innerHTML = ''; return; }
  const { a, b, opts } = ui.gate;
  el.innerHTML = `<div class="pmodal" role="dialog" aria-label="Grown-ups only"><div class="pmodal-card"><h3>Grown-ups only</h3><p class="center hint">What is ${a} + ${b}?</p><div class="gate-opts">${opts.map(o => `<button class="btn" data-ans="${o}">${o}</button>`).join('')}</div><button class="btn ghost" data-cancel>Cancel</button></div></div>`;
  $$('[data-ans]', el).forEach(bt => bt.onclick = () => { if (+bt.dataset.ans === ui.gate.ans) { ui.adult = true; ui.tab = 'grown'; } else PL.toast('Not quite. Ask a grown-up!'); ui.gate = null; render(); });
  $('[data-cancel]', el).onclick = () => { ui.gate = null; layer(); };
}
function wire() {
  const body = $('#kid-body', root);
  V.wireSpeak(body);
  const lock = $('#kid-lock', body); if (lock) lock.onclick = () => { ui.adult = false; ui.tab = 'kid'; render(); };
  const pr = $('#kid-print', body); if (pr) pr.onclick = () => print();
}

PL.apps.kids = {
  title: 'Loopi Kids',
  mount,
  unmount() { ui.adult = false; ui.tab = 'kid'; ui.gate = null; root = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); },
  update(kind) { render(kind !== 'me'); },
};
})();
