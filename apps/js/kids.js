/* Loopi Kids: the preschool app. Two separate parts.
   For children: an animated, picture-first guide with sounds. Loopi bounces and giggles when tapped, food
   cards pop in and say what each food does, and after lunch a food rainbow fills in colour by colour with
   chimes and confetti. Everything can be read aloud, and sounds can be muted.
   For grown-ups (behind a grown-up check): Parents see their child's lunch report; Teachers see the whole
   class, who needs a check-in, allergy checks, the week, and can write notes that appear in the parent's report.
   Sounds are made with the Web Audio API, so there are no audio files. */
(() => {
'use strict';
const { $, $$, pct, esc } = PL;
const H = PL.health, V = PL.V, MENU = H.KIDS_MENU;

const ui = { tab: 'kid', role: 'parent', adult: false, gate: null, preset: 'Ate well', focus: null, celebrate: false };
let root = null, timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

/* ---------------------------------------------------------------- sounds */
const SFX = (() => {
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('loopi-kids-mute') === '1'; } catch (e) {}
  const ac = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  const tone = (f, dur = .15, type = 'sine', vol = .18, to = null, at = 0) => {
    if (muted) return; const c = ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
  };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('loopi-kids-mute', muted ? '1' : '0'); } catch (e) {} if (muted && 'speechSynthesis' in window) speechSynthesis.cancel(); else this.pop(); },
    pop() { tone(520, .09, 'sine', .2, 880); },
    boop() { tone(440, .16, 'triangle', .2, 300); },
    tap() { tone(720, .05, 'square', .05); },
    chime(i) { const f = NOTES[i % NOTES.length]; tone(f, .5, 'sine', .16); tone(f * 2, .3, 'sine', .05); },
    giggle() { [0, .1, .2].forEach((d, i) => tone(600 + i * 120, .08, 'triangle', .14, 900 + i * 120, d)); },
    fanfare() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i === 3 ? .6 : .16, 'triangle', .16, null, i * .13)); },
    soft() { tone(392, .25, 'sine', .1, 330); tone(330, .35, 'sine', .08, 294, .22); },
  };
})();
const say = text => {
  if (SFX.muted || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.rate = .92; u.pitch = 1.2; speechSynthesis.speak(u);
};

/* ---------------------------------------------------------------- data helpers */
const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  kid: I('<path d="M12 3c4 0 7 4.5 7 9.5S16 21 12 21s-7-3.5-7-8.5S8 3 12 3Z"/><circle cx="9.5" cy="12" r=".8" fill="currentColor"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>'),
  grown: I('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  sound: I('<path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: I('<path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  speak: I('<path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
};
const FACTS = {
  k_rice: 'Rice gives you energy to run and play!', k_chicken: 'Chicken helps your muscles grow big and strong!',
  k_broccoli: 'Broccoli looks like a tiny tree. It keeps you strong!', k_corn: 'Warm corn soup makes your tummy happy!',
  k_tomato: 'Tomatoes are red and juicy. Pop!', k_dragon: 'Dragon fruit is pink with tiny black seeds. So pretty!',
};
const TAPS = ['Hehe, that tickles!', 'Yay! Let\'s eat lunch together!', 'I love colourful food!', 'High five!', 'Boing boing!'];
const RAINBOW_ORDER = ['red', 'pink', 'yellow', 'green', 'brown', 'white'];
const me = () => H.kid(PL.S.care.me.kid) || PL.S.care.kids[0];
const kids = () => PL.S.care.kids;
const scannedToday = K => K.log[0].day === H.TODAY;
const dishName = (K, d) => K.allergy && d.allergen === K.allergy ? d.safe : d.name;
const short = (K, d) => dishName(K, d).replace(' without egg', '');
const ateFrac = (rec, d) => rec.eaten[d.id] / rec.served[d.id];
const avgEaten = (K, id) => K.log.reduce((s, l) => s + l.eaten[id] / l.served[id], 0) / K.log.length;
const pickyOf = K => [...MENU].sort((a, b) => avgEaten(K, a.id) - avgEaten(K, b.id))[0];
const coloursEaten = (K, rec) => new Set(MENU.filter(d => ateFrac(rec, d) >= .5).map(d => d.rainbow));
const stars = f => f >= .75 ? 3 : f >= .4 ? 2 : f >= .15 ? 1 : 0;

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
        <button class="btn small" id="kid-rest">Scan the rest of the class</button>
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
    SFX.tap();
    if (b.dataset.tab === 'grown' && !ui.adult) { gate(); return; }
    ui.tab = b.dataset.tab; render(); $('#kid-body').scrollTop = 0;
  });
  $('#kid-preset', el).onchange = e => { ui.preset = e.target.value; };
  $('#kid-lunch', el).onclick = () => {
    const K = me(); if (scannedToday(K)) return;
    const r = H.scanKidLunch(K, ui.preset);
    ui.celebrate = true; ui.tab = ui.adult ? ui.tab : 'kid';
    PL.store.save('kids');
    PL.toast(`${K.name}'s tray scanned: ${pct(1 - r.w)} eaten.`);
  };
  $('#kid-rest', el).onclick = () => { const n = H.scanRestOfKids(); PL.store.save('kids'); PL.toast(n ? `${n} more trays scanned in Sunflower class.` : 'Everyone\'s lunch is already scanned.'); };
  render();
}
function render(keep) {
  if (!root) return;
  clearTimers();
  const K = me(), body = $('#kid-body', root), y = body.scrollTop;
  $('#kid-who', root).innerHTML = kids().filter(k => k.named).map(k => `<button class="chip plain" data-kid="${k.id}" aria-pressed="${k.id === K.id}">${esc(k.name)}</button>`).join('');
  $$('#kid-who button', root).forEach(b => b.onclick = () => { ui.focus = null; PL.S.care.me.kid = b.dataset.kid; PL.store.save('me'); });
  const lb = $('#kid-lunch', root); lb.textContent = scannedToday(K) ? `${K.name}'s lunch is done` : `Scan ${K.name}'s lunch tray`; lb.disabled = scannedToday(K);
  $('#kid-preset', root).value = ui.preset;
  $('#kid-rest', root).disabled = kids().filter(k => !k.named).every(scannedToday);
  $('#kid-top', root).innerHTML = ui.tab === 'kid'
    ? `${V.avatar(K, 36)}<div><b>${esc(K.name)}</b><span>Sunflower class · age ${K.age}</span></div><button class="mute" id="mute" aria-label="${SFX.muted ? 'Turn sound on' : 'Turn sound off'}">${SFX.muted ? ICON.mute : ICON.sound}</button>`
    : `<span class="av-circle" style="--av:#8E8E93;width:36px;height:36px;font-size:13px">${ui.role === 'teacher' ? 'MF' : esc(K.name[0])}</span><div><b>${ui.role === 'teacher' ? 'Ms. Farah' : `${esc(K.name)}'s family`}</b><span>${ui.role === 'teacher' ? 'Teacher · Sunflower class' : 'Parent view'}</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ui.tab === 'kid' ? kid(K) : grown(K);
  wire(K);
  if (keep) body.scrollTop = y;
  layer();
  if (ui.tab === 'kid' && ui.celebrate && scannedToday(K)) { ui.celebrate = false; celebrate(K); }
}

/* ================================================================ for the child */
function kid(K) {
  const done = scannedToday(K), rec = K.log[0], picky = pickyOf(K);
  const ate = done ? coloursEaten(K, rec) : new Set();
  let expr, line;
  if (!done) { expr = 'wave'; line = `Hi ${K.name}! It's lunch time! Can you try one bite of ${short(K, picky).toLowerCase()} today?`; }
  else if (ate.size >= 5) { expr = 'cheer'; line = `Wow, ${K.name}! You ate ${ate.size} colours. A whole rainbow!`; }
  else if (1 - rec.w >= .6) { expr = 'happy'; line = `Yummy lunch, ${K.name}! You ate ${ate.size} colours today.`; }
  else { expr = 'calm'; line = `That's okay, ${K.name}. Tomorrow let's try a little more.`; }
  const cards = MENU.map((d, i) => {
    const f = done ? ateFrac(rec, d) : null, s = done ? stars(f) : 0;
    return `<button class="kfood ${!done && d.id === picky.id ? 'try' : ''}" style="--d:${i * 90}ms" data-food="${d.id}">
      ${!done && d.id === picky.id ? '<em>Try me!</em>' : ''}
      <span class="kf-pic">${V.food(d, 58)}</span><b>${esc(short(K, d))}</b>
      ${done ? `<span class="kstars" aria-label="${s} stars">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span>` : ''}
    </button>`;
  }).join('');
  return `
  <div class="kscene">
    <i class="k-sun"></i><i class="k-cloud c1"></i><i class="k-cloud c2"></i><i class="k-cloud c3"></i><i class="k-hill h1"></i><i class="k-hill h2"></i>
    <div class="k-bubble"><p id="k-line">${esc(line)}</p><button class="k-speak" data-say="${esc(line)}" aria-label="Read aloud">${ICON.speak}</button></div>
    <button class="k-loopi" id="k-loopi" aria-label="Tap Loopi" data-expr="${expr}">${V.loopi(expr, 150)}</button>
  </div>
  <div class="vcard kidcard"><h3>${done ? 'My lunch' : 'Today\'s lunch'} <small>tap a food</small></h3><div class="kfoods">${cards}</div></div>
  <div class="vcard kidcard rbcard"><h3>${done ? 'My food rainbow' : 'Eat a food rainbow'}</h3>${rainbow(ate, done)}
    <p class="kidline">${done ? `${ate.size} of ${RAINBOW_ORDER.length} colours!` : 'Every colour helps your body in a different way.'}</p></div>`;
}
/** A rainbow made of the colours of today's food. Eaten colours draw in; the rest stay dotted. */
function rainbow(ate, done) {
  const cx = 130, cy = 128;
  const arcs = RAINBOW_ORDER.map((c, i) => {
    const r = 108 - i * 13, len = (Math.PI * r).toFixed(1), on = ate.has(c);
    return `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke-width="11" stroke-linecap="round" class="${on ? 'arc on' : 'arc'}" style="--c:${H.RAINBOW[c]};--len:${len};--i:${ate.size ? [...RAINBOW_ORDER].filter(x => ate.has(x)).indexOf(c) : 0}"/>`;
  }).join('');
  return `<svg class="rainbow2 ${done ? 'done' : ''}" viewBox="0 0 260 140" role="img" aria-label="${ate.size} colours eaten">${arcs}
    <g class="rb-cloud"><circle cx="22" cy="128" r="16"/><circle cx="40" cy="124" r="13"/><circle cx="8" cy="132" r="10"/></g>
    <g class="rb-cloud"><circle cx="238" cy="128" r="16"/><circle cx="220" cy="124" r="13"/><circle cx="252" cy="132" r="10"/></g></svg>`;
}
/** After lunch: each eaten colour chimes in turn, then a fanfare and confetti for a big rainbow. */
function celebrate(K) {
  const n = coloursEaten(K, K.log[0]).size;
  for (let i = 0; i < n; i++) later(() => SFX.chime(i), 350 + i * 420);
  later(() => {
    if (n >= 4) { SFX.fanfare(); confetti(); } else SFX.pop();
    const line = $('#k-line', root); if (line) say(line.textContent);
  }, 350 + n * 420 + 150);
}
function confetti() {
  const box = $('.kscene', root); if (!box) return;
  const cols = ['#FF6B5B', '#FFB23F', '#F4C542', '#3DB85A', '#4DA3FF', '#D6246E'];
  for (let i = 0; i < 44; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${(Math.random() - .5) * 120}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .4}s;animation-duration:${1.6 + Math.random()}s`;
    box.appendChild(p);
  }
  later(() => $$('.confetti', root).forEach(p => p.remove()), 3200);
}

/* ================================================================ for grown-ups */
function grown(K) {
  const seg = `<div class="seg role-seg" id="role-seg"><button data-role="parent" aria-pressed="${ui.role === 'parent'}">Parents</button><button data-role="teacher" aria-pressed="${ui.role === 'teacher'}">Teachers</button></div>`;
  return seg + (ui.role === 'teacher' ? teacher() : parent(K));
}
/** Parents: one child's lunch report. */
function parent(K) {
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
  <div class="vcard note2"><p>${K.note ? `“${esc(K.note)}”` : 'No note from the teacher yet today.'}</p><span>Ms. Farah, Sunflower class</span></div>
  <div class="two-btn"><button class="btn" data-lock>Back to Loopi</button><button class="btn" data-print>Print report</button></div>
  <p class="foot">Measured by the preschool scanner before and after lunch. The teacher helps each child look at the camera. Targets are illustrative.</p>`;
}
/** Teachers: the whole class today, who needs a check-in, allergies, the week, and notes for parents. */
function teacher() {
  const all = kids(), done = all.filter(scannedToday), recs = done.map(k => k.log[0]);
  const avgEat = recs.length ? recs.reduce((s, r) => s + (1 - r.w), 0) / recs.length : 0;
  const veg = MENU.filter(d => d.group === 'veg');
  const vegEat = recs.length ? recs.reduce((s, r) => s + veg.reduce((a, d) => a + ateFrac(r, d), 0) / veg.length, 0) / recs.length : 0;
  const check = done.filter(k => 1 - k.log[0].w < .5);
  const allergic = all.filter(k => k.allergy);
  const foodAvg = MENU.map(d => ({ d, a: recs.length ? recs.reduce((s, r) => s + ateFrac(r, d), 0) / recs.length : 0 })).sort((a, b) => a.a - b.a);
  const weekDays = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24', H.TODAY];
  const weekVals = weekDays.map(day => { const rs = all.map(k => k.log.find(l => l.day === day)).filter(Boolean); return rs.length ? rs.reduce((s, r) => s + (1 - r.w), 0) / rs.length : 0; });
  const F = ui.focus && H.kid(ui.focus);
  return `
  ${V.guide('calm', `Sunflower class: ${done.length} of ${all.length} lunches scanned today.${check.length ? ` ${check.length} ${check.length === 1 ? 'child ate' : 'children ate'} less than half.` : ' Everyone scanned so far ate well.'}`)}
  <div class="vcard"><h3>Class today</h3><div class="vrings">${V.pctRing(done.length / all.length, 'Scanned', .99)}${V.pctRing(avgEat, 'Lunch eaten')}${V.pctRing(vegEat, 'Veg eaten', .6)}</div></div>
  ${F ? childPanel(F) : ''}
  <div class="vcard"><h3>Children <small>tap one for details and a note</small></h3><div class="roster">${all.map(k => {
    const r = scannedToday(k) ? k.log[0] : null, f = r ? 1 - r.w : 0;
    return `<button class="rkid ${ui.focus === k.id ? 'on' : ''} ${r && f < .5 ? 'low' : ''}" data-focus="${k.id}">
      ${V.avatar(k, 38)}<b>${esc(k.name)}</b>
      ${r ? `<span class="rring" style="--p:${Math.round(f * 100)};--c:${f >= .75 ? 'var(--tint)' : f >= .5 ? '#FFB23F' : '#FF6B5B'}"><i class="num">${pct(f)}</i></span>` : '<span class="rwait">not yet</span>'}
      ${k.allergy ? `<em class="alg">${esc(k.allergy)}</em>` : ''}${k.note ? '<em class="nt">note</em>' : ''}
    </button>`;
  }).join('')}</div></div>
  <div class="vtips">
    ${check.length ? V.tip('warn', 'warn', `Check in with ${check.map(k => k.name).join(', ')}`, 'They ate less than half of lunch today.') : V.tip('check', 'good', 'No one needs a check-in', 'Every scanned child ate at least half of lunch.')}
    ${V.tip('check', 'good', `${allergic.length} children with allergies, all trays safe`, allergic.map(k => `${k.name} (${k.allergy.toLowerCase()})`).join(', ') + '. Egg-free corn soup was served where needed.')}
    ${recs.length ? V.tip('leaf', 'info', `Least eaten today: ${foodAvg[0].d.name.toLowerCase()} (${pct(foodAvg[0].a)})`, `Most eaten: ${foodAvg[foodAvg.length - 1].d.name.toLowerCase()} (${pct(foodAvg[foodAvg.length - 1].a)}).`) : ''}
  </div>
  <div class="vcard"><h3>Class this week <small>share of lunch eaten</small></h3>${V.week(weekDays, weekVals, { today: 4 })}</div>
  <div class="two-btn"><button class="btn primary" id="send-parents">Send today's reports to parents</button><button class="btn" data-print>Print class sheet</button></div>
  <p class="foot">Only Sunflower class staff see this page. Parents only see their own child.</p>`;
}
function childPanel(K) {
  const r = scannedToday(K) ? K.log[0] : null;
  return `<div class="vcard focus"><h3>${V.avatar(K, 30)} ${esc(K.name)} <small>${r ? `${pct(1 - r.w)} eaten today` : 'lunch not scanned yet'}</small></h3>
    ${r ? V.tray(MENU, r, { name: d => dishName(K, d), size: 32 }) : ''}
    <label class="note-edit"><span>Note for ${esc(K.name)}'s family</span><textarea id="note-text" rows="3" placeholder="What did ${esc(K.name)} try or enjoy today?">${esc(K.note || '')}</textarea></label>
    <div class="two-btn"><button class="btn primary" id="save-note">Save note</button><button class="btn" data-open-parent="${K.id}">Open parent report</button></div></div>`;
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
  $$('[data-ans]', el).forEach(bt => bt.onclick = () => { if (+bt.dataset.ans === ui.gate.ans) { ui.adult = true; ui.tab = 'grown'; } else { SFX.soft(); PL.toast('Not quite. Ask a grown-up!'); } ui.gate = null; render(); });
  $('[data-cancel]', el).onclick = () => { ui.gate = null; layer(); };
}

/* ================================================================ wiring */
function wire(K) {
  const body = $('#kid-body', root);
  const mute = $('#mute', root); if (mute) mute.onclick = () => { SFX.toggle(); render(true); };
  $$('[data-say]', body).forEach(b => b.onclick = () => { SFX.pop(); say(b.dataset.say); });
  const lp = $('#k-loopi', body);
  if (lp) lp.onclick = () => {
    const line = TAPS[Math.floor(Math.random() * TAPS.length)];
    lp.innerHTML = V.loopi('cheer', 150); lp.classList.remove('boing'); void lp.offsetWidth; lp.classList.add('boing');
    SFX.giggle(); $('#k-line', body).textContent = line; $('.k-speak', body).dataset.say = line; say(line);
    later(() => { if (lp.isConnected) lp.innerHTML = V.loopi(lp.dataset.expr, 150); }, 1400);
  };
  $$('[data-food]', body).forEach(b => b.onclick = () => {
    const d = MENU.find(x => x.id === b.dataset.food), fact = `${short(K, d)}! ${FACTS[d.id]}`;
    b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
    SFX.boop(); $('#k-line', body).textContent = fact; $('.k-speak', body).dataset.say = fact; say(fact);
  });
  $$('#role-seg button', body).forEach(b => b.onclick = () => { SFX.tap(); ui.role = b.dataset.role; render(); $('#kid-body').scrollTop = 0; });
  $$('[data-focus]', body).forEach(b => b.onclick = () => { SFX.tap(); ui.focus = ui.focus === b.dataset.focus ? null : b.dataset.focus; render(true); });
  const sn = $('#save-note', body);
  if (sn) sn.onclick = () => { const k = H.kid(ui.focus); k.note = $('#note-text', body).value.trim(); PL.store.save('kids'); PL.toast(`Note saved. ${k.name}'s family will see it in their report.`); };
  $$('[data-open-parent]', body).forEach(b => b.onclick = () => { PL.S.care.me.kid = b.dataset.openParent; ui.role = 'parent'; ui.focus = null; PL.store.save('me'); $('#kid-body').scrollTop = 0; });
  const sp = $('#send-parents', body); if (sp) sp.onclick = () => PL.toast(`Reports sent to ${kids().filter(scannedToday).length} families (demo, nothing was sent).`);
  $$('[data-lock]', body).forEach(b => b.onclick = () => { ui.adult = false; ui.tab = 'kid'; render(); });
  $$('[data-print]', body).forEach(b => b.onclick = () => print());
}

PL.apps.kids = {
  title: 'Loopi Kids',
  mount,
  unmount() { clearTimers(); ui.adult = false; ui.tab = 'kid'; ui.gate = null; ui.focus = null; root = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); },
  update(kind) { const f = document.activeElement; if (f && f.id === 'note-text') return; render(kind !== 'me'); },
};
})();
