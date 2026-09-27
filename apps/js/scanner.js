/* PlateLoop Kiosk: the 10.1" screen on the PlateLoop Scanner. Each student scans twice a day:
   before lunch (what was served) and after lunch (what is left). The idle screen shows the school's
   Green Tree, which grows a fruit for every zero-leftover tray. */
(() => {
'use strict';
const { $, $$, pct, esc, MENU, PRESETS, clamp } = PL;

const I = body => `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  face: I('<path d="M6 13V9a3 3 0 0 1 3-3h4M27 6h4a3 3 0 0 1 3 3v4M34 27v4a3 3 0 0 1-3 3h-4M13 34H9a3 3 0 0 1-3-3v-4" stroke-width="2.4"/><path d="M16 17v2M24 17v2M20 17v5h-1.5M16.5 26.5a5 5 0 0 0 7 0" stroke-width="2.2"/><path class="a-scan" d="M9 20h22" stroke-width="2"/>'),
  tray: I('<path d="M20 5v6" stroke-width="2.4"/><path class="a-drop" d="M20 13v3" stroke-width="2.4"/><g class="a-tray"><rect x="8" y="21" width="24" height="8" rx="2" stroke-width="2.4"/><path d="M16 21v8M24 21v8" stroke-width="2"/></g><path d="M7 34h26" stroke-width="2.4"/>'),
  check: I('<circle cx="20" cy="20" r="13" stroke-width="2.4"/><path class="a-check" d="M13.5 20.5l4.5 4.5 8.5-9" stroke-width="2.8"/>'),
  lunch: I('<path d="M12 6v9a3 3 0 0 0 6 0V6M15 6v28M28 6c-3 3-4 8-4 12h4v16" stroke-width="2.4"/>'),
  compost: I('<path class="a-drop" d="M20 3v8M16 8l4 4 4-4" stroke-width="2.4"/><path d="M10 16h20l-2 18H12Z" stroke-width="2.4"/><path d="M16 22v7M24 22v7" stroke-width="2"/>'),
};
const STEPS = [['face', 'Look at the camera', 'above the screen'], ['tray', 'Place your tray', 'before and after lunch'], ['check', 'Wait for the chime', 'about two seconds']];
const banner = (active, solo) => solo
  ? `<div class="kio-banner solo"><div class="kstep on"><span class="ic">${ICON[solo[0]]}</span><span><b>${solo[1]}</b><small>${solo[2]}</small></span></div></div>`
  : `<div class="kio-banner">${STEPS.map(([ic, t, s], i) => `<div class="kstep ${i === active ? 'on' : ''}" data-step="${i}"><span class="ic">${ICON[ic]}</span><span><span class="n">${i + 1}</span><b>${t}</b><small>${s}</small></span></div>`).join('')}</div>`;
const nbars = n => `<div class="kio-nut">${PL.NUTRIENTS.map(([k, label, unit]) => { const st = PL.nStatus(k, n[k]); return `<div class="${st}"><span>${label}</span><i><b style="width:${Math.min(100, n[k] / PL.TARGET[k] / 1.5 * 100)}%"></b><em style="left:${100 / 1.5}%"></em></i><strong class="num">${n[k]}${unit === 'g' ? ' g' : ''}</strong></div>`; }).join('')}</div>`;

const k = { mode: 'idle', sid: 's1', portion: 'M', preset: 'Tried everything', phase: null, eat: null, before: null, result: null, step: 0, timers: [], bi: 0 };
let root = null;
const later = (fn, ms) => k.timers.push(setTimeout(fn, PL.reduceMotion ? Math.min(ms, 250) : ms));
const clearTimers = () => { k.timers.forEach(clearTimeout); k.timers = []; };
const phaseOf = st => st.scanned ? 'done' : st.before ? 'after' : 'before';

function mount(el) {
  root = el;
  k.mode = 'idle'; clearTimers();
  el.innerHTML = `
  <div class="kio-app">
    <header class="kio-head">
      <div class="kio-brand"><span class="kio-logo" aria-hidden="true"></span><div><b>PlateLoop Kiosk</b><span>Scanner 1 · Haneul Elementary cafeteria</span></div></div>
      <div class="row"><span class="pill green"><i class="dot"></i>Sending to Kitchen</span><button class="btn small" id="kio-fs">Full screen</button></div>
    </header>
    <div class="kiosk"><div class="kio-screen" id="kio-screen" role="region" aria-label="Kiosk screen" aria-live="polite"></div></div>
    <details class="kio-drawer" open>
      <summary><b>Demo controls</b><span class="hint">On the real scanner, the face camera, depth camera and scale do this part.</span></summary>
      <div class="kio-demo">
        <div><label for="kio-sid">Student</label><select id="kio-sid"></select></div>
        <div><label>Kitchen serves</label><div class="seg" id="kio-portion">${['S', 'M', 'L'].map(p => `<button data-p="${p}">${{ S: 'Small', M: 'Regular', L: 'Large' }[p]}</button>`).join('')}</div></div>
        <div><label for="kio-preset">How they eat</label><select id="kio-preset">${[...Object.keys(PRESETS), 'Clean plate', 'Random'].map(p => `<option>${p}</option>`).join('')}</select></div>
        <div><button class="btn primary big" id="kio-tap" style="padding:10px"></button></div>
      </div>
      <div class="kio-note"><p class="hint" id="kio-progress"></p><div class="row"><button class="btn small" id="kio-rest">Scan the whole class</button><button class="btn small ghost" data-reset>Reset demo</button></div></div>
    </details>
  </div>`;
  $('#kio-fs', el).onclick = () => { const s = $('#kio-screen'); if (s.requestFullscreen) s.requestFullscreen().catch(() => PL.toast('Full screen isn\'t available here.')); };
  $$('#kio-portion button', el).forEach(b => b.onclick = () => { k.portion = b.dataset.p; controls(); });
  $('#kio-sid', el).onchange = e => { k.sid = e.target.value; controls(); };
  $('#kio-preset', el).onchange = e => { k.preset = e.target.value; };
  $('#kio-tap', el).onclick = tap;
  $('#kio-rest', el).onclick = () => { const n = PL.scanRestOfClass(); PL.store.save('scan'); PL.toast(n ? `${n} students scanned before and after lunch.` : 'Everyone in class 3-2 is done.'); };
  controls(); screen();
}

function controls() {
  if (!root) return;
  const mark = s => ({ before: '', after: ' · eating', done: ' · done' })[phaseOf(s)];
  const opt = s => `<option value="${s.id}" ${s.id === k.sid ? 'selected' : ''}>${esc(s.name)}${mark(s)}</option>`;
  $('#kio-sid', root).innerHTML = `<optgroup label="Demo students">${PL.S.students.filter(s => s.named).map(opt).join('')}</optgroup><optgroup label="Class 3-2">${PL.S.students.filter(s => !s.named).map(opt).join('')}</optgroup>`;
  $$('#kio-portion button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === k.portion)));
  $('#kio-preset', root).value = k.preset;
  const ph = phaseOf(PL.student(k.sid));
  $('#kio-tap', root).textContent = { before: 'Walk up · before lunch', after: 'Walk up · after lunch', done: 'Walk up · already done' }[ph];
  const cls = PL.S.students.filter(s => s.cls === '3-2');
  const eating = cls.filter(s => phaseOf(s) === 'after').length, done = cls.filter(s => s.scanned).length;
  $('#kio-progress', root).textContent = `Class 3-2: ${eating} eating, ${done} of 28 done. PlateLoop Kitchen and Loopi update as you scan.`;
  $('#kio-rest', root).disabled = done >= 28;
}

function tap() {
  clearTimers();
  const st = PL.student(k.sid);
  k.phase = phaseOf(st);
  if (k.phase === 'done') { k.mode = 'already'; screen(); later(idle, 4000); return; }
  if (k.phase === 'after') k.eat = k.preset === 'Random'
    ? Object.fromEntries(MENU.map(d => [d.id, Math.round(clamp(1 - PL.TYPICAL_LEFT[d.id] * Math.random() * 1.8, 0, 1) * 20) * 5]))
    : k.preset === 'Clean plate' ? Object.fromEntries(MENU.map(d => [d.id, 100])) : { ...PRESETS[k.preset] };
  k.mode = 'face'; screen();
  later(() => { k.mode = 'hello'; screen(); }, 1300);
  later(() => { k.mode = 'scan'; k.step = 0; screen(); }, 2800);
  later(() => { k.step = 1; screen(); }, 3400);
  later(() => { k.step = 2; screen(); }, 4000);
  later(() => {
    if (k.phase === 'before') { k.before = PL.scanBefore(k.sid, k.portion, 'face'); k.mode = 'fed'; later(idle, 9000); }
    else { k.result = PL.scanAfter(k.sid, k.eat, 'face'); k.mode = 'result'; later(idle, 12000); }
    screen();
    PL.store.save('scan');
  }, 4600);
}
function idle() { clearTimers(); k.mode = 'idle'; screen(); controls(); }

/* ---------------------------------------------------------------- the screen */
function screen() {
  const s = root && $('#kio-screen', root); if (!s) return;
  const st = PL.student(k.sid);
  const status = `<div class="kio-status"><span class="num">${PL.clock()}</span><span><i></i>Connected to Kitchen</span></div>`;
  const left = cap => `<div class="kio-left"><canvas id="kio-pet" width="160" height="132"></canvas>${cap ? `<div class="cap">${cap}</div>` : ''}</div>`;
  let main = '', ban = '', extra = '';
  if (k.mode === 'idle') {
    const T = PL.S.today;
    main = `${left(`<b>School Green Tree</b><br>${T.zero} zero-leftover trays today`)}<div class="kio-right">
      <div class="kio-kicker">PlateLoop</div>
      <div class="kio-title">Scan your tray.</div>
      <div class="kio-sub">Once before lunch and once after. Every clean tray grows a fruit on the school's Green Tree.</div>
      <div class="kio-meta"><div><b class="num">${T.trays}</b>trays today</div><div><b class="num">${T.eating}</b>eating now</div><div><b class="num">${pct(PL.zeroRate())}</b>zero leftover</div></div></div>`;
    ban = banner(k.bi);
  } else if (k.mode === 'already') {
    main = `${left()}<div class="kio-right"><div class="kio-kicker">All set</div><div class="kio-title">You're done for today, ${esc(st.name)}.</div><div class="kio-sub">You scanned before and after lunch. See you tomorrow!</div></div>`;
    ban = banner(null, ['check', 'Nothing more to do', 'Loopi has been fed']);
  } else if (k.mode === 'face') {
    main = `<div class="kio-face"><div class="kio-finder"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M10 28V18a8 8 0 0 1 8-8h10M72 10h10a8 8 0 0 1 8 8v10M90 72v10a8 8 0 0 1-8 8H72M28 90H18a8 8 0 0 1-8-8V72"/><ellipse cx="50" cy="48" rx="19" ry="24" class="head"/><path d="M50 72v8M30 92c3-8 11-12 20-12s17 4 20 12" class="head"/></svg><i class="kio-sweep"></i></div>
      <div><div class="kio-kicker">${k.phase === 'before' ? 'Before lunch' : 'After lunch'}</div><div class="kio-title">Look at the camera.</div><div class="kio-sub">It's just above this screen. No card needed.</div></div></div>`;
    ban = banner(0);
  } else if (k.mode === 'hello') {
    const before = k.phase === 'before';
    main = `${left()}<div class="kio-right">
      <div class="kio-kicker">Face recognised · ${before ? 'before lunch' : 'after lunch'}</div>
      <div class="kio-title">${before ? `Hi, ${esc(st.name)}.` : `Welcome back, ${esc(st.name)}.`}</div>
      <div class="kio-sub">${before ? 'Place your full tray on the scale.' : 'Place your tray on the scale, leftovers and all.'}</div>
      <div class="kio-tray">${PL.traySVG({ empty: true, id: 'kt' })}</div></div>`;
    ban = banner(1);
  } else if (k.mode === 'scan') {
    const before = k.phase === 'before';
    const leftFrac = before ? null : Object.fromEntries(MENU.map(d => [d.id, 1 - k.eat[d.id] / 100]));
    const steps = ['Finding each food', 'Measuring depth', 'Checking the scale'];
    main = `${left()}<div class="kio-right">
      <div class="kio-kicker">${before ? 'Before lunch' : 'After lunch'}</div>
      <div class="kio-title">Scanning…</div>
      <div class="kio-tray">${PL.traySVG({ portion: before ? k.portion : PL.portionOf(st.before.served), left: leftFrac, scanning: true, id: 'kt' })}</div>
      <div class="kio-steps">${steps.map((x, i) => `<div class="${i < k.step ? 'done' : i === k.step ? 'on' : ''}">${i < k.step ? '✓' : '·'} ${x}</div>`).join('')}</div></div>`;
    ban = banner(2);
  } else if (k.mode === 'fed') {
    const b = k.before;
    main = `${left()}<div class="kio-right">
      <div class="kio-kicker">Before lunch · saved</div>
      <div class="kio-title">Enjoy your lunch.</div>
      <div class="kio-meta"><div><b class="num">${b.total} g</b>on your tray</div><div><b class="num">${b.n.kcal}</b>kcal served</div><div><b>${{ S: 'Small', M: 'Regular', L: 'Large' }[b.portion]}</b>portion</div></div>
      <div class="kio-bubble">Loopi says: try the ${esc(PL.DISH[PL.CRAVING].name.toLowerCase())} today!</div></div>`;
    ban = banner(null, ['lunch', 'Come back after lunch', 'Scan your tray again before you put it away']);
    extra = `<div class="kio-progress" style="animation-duration:9s"></div><button class="kio-done" id="kio-done">Done</button>`;
  } else {
    const r = k.result, g = r.game;
    const chips = [`Points <em>+${r.xp}</em>`];
    if (g) { chips.push(`Loopi <em>+${g.hunger} food</em>`); if (g.heart) chips.push(`<em>+1 heart</em>`); }
    if (r.zero) chips.unshift(`<em>+1 fruit</em> on the Green Tree`);
    main = `${left()}<div class="kio-right">
      <div class="kio-bubble">“${esc(r.zero ? 'Zero leftovers! You grew a fruit on the school tree!' : r.line)}”</div>
      <div class="kio-split">
        <div class="kio-big"><b class="num">${pct(r.w)}</b><span>left on your tray<br>your usual is ${pct(st.baseline)}</span></div>
        <div><div class="kio-nut-h">You ate ${r.intake.kcal} kcal</div>${nbars(r.intake)}</div>
      </div>
      <div class="kio-chips">${chips.map(c => `<span>${c}</span>`).join('')}</div>
      <div class="kio-rank"><div>You're <b>#${r.meRank}</b> in your class${r.meRank < r.meRankBefore ? ` <b>▲ ${r.meRankBefore - r.meRank}</b>` : ''}${g && g.ready ? ' · Loopi is ready to evolve!' : ''}</div></div></div>`;
    ban = banner(null, ['compost', 'Scraps go in the compost bin', 'Then you\'re all done. See you tomorrow!']);
    extra = `<div class="kio-progress" style="animation-duration:12s"></div><button class="kio-done" id="kio-done">Done</button>`;
  }
  s.innerHTML = `${status}<div class="kio-main">${main}</div>${ban}${extra}`;
  const done = $('#kio-done', s); if (done) done.onclick = idle;
  draw(0);
}

/* the school Green Tree (pixel art): one fruit per zero-leftover tray today */
function drawTree(cv, t) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, u = 4;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#EAF6EC'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#FFFFFF'; [[18, 18], [112, 12]].forEach(([x, y], i) => { const dx = (x + t * (i + 1) * .6) % (W + 30) - 15; c.fillRect(dx, y, 22, 5); c.fillRect(dx + 5, y - 4, 12, 4); });
  c.fillStyle = '#CFE8D3'; c.fillRect(0, H - 22, W, 22);
  c.fillStyle = '#8B5E3C'; c.fillRect(W / 2 - 6, H - 44, 12, 24);
  const layers = [[H - 46, 30], [H - 64, 24], [H - 80, 17], [H - 93, 10]];
  layers.forEach(([y, hw], i) => { c.fillStyle = i % 2 ? '#34A853' : '#2E9447'; for (let r = 0; r < 18; r += u) { const w = Math.round(hw * (1 - r / 26)) * 2; c.fillRect(W / 2 - w / 2, y - r, w, u); } });
  const n = Math.min(PL.S.today.zero, 40);
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const L = layers[i % 4], x = W / 2 + (rnd() - .5) * L[1] * 1.6, y = L[0] - rnd() * 14;
    c.fillStyle = '#FF3B30'; c.fillRect(Math.round(x / u) * u, Math.round(y / u) * u, u, u);
    if (i === n - 1 && t % 2) { c.fillStyle = '#FFD60A'; c.fillRect(Math.round(x / u) * u - u, Math.round(y / u) * u - u, u, u); }
  }
}
function draw(t) {
  const cv = root && $('#kio-pet', root); if (!cv) return;
  if (k.mode === 'idle') { drawTree(cv, t); return; }
  const st = PL.student(k.sid);
  const mood = k.mode === 'result' ? (k.result.zero ? 'joy' : k.result.mood) : k.mode === 'scan' ? 'happy' : 'joy';
  PL.drawPet(cv, { rows: 30, t, ...PL.petOf(st), mood });
}

PL.apps.scanner = {
  title: 'PlateLoop Kiosk',
  mount,
  unmount() { clearTimers(); root = null; },
  update() { controls(); if (k.mode === 'idle') screen(); },
  tick(t) {
    draw(t);
    if (root && k.mode === 'idle' && t % 4 === 0) {
      k.bi = (k.bi + 1) % 3;
      $$('.kstep', root).forEach(el => el.classList.toggle('on', +el.dataset.step === k.bi));
    }
  },
};
})();
