/* Loopi Work: the office canteen app. Each worker sets a goal (build muscle, lose weight, steady energy,
   eat balanced) and a few body details; PlateLoop turns that into personal lunch targets. Every day it
   recommends the canteen line and the small tweaks that fit the goal, and after the tray is scanned it
   says what was missing ("not enough protein") and builds a weekly healthcare report. */
(() => {
'use strict';
const { $, $$, pct, esc, clamp, rng } = PL;
const H = PL.health;

/* ---------------------------------------------------------------- the canteen: three lines a day (nutrients per gram) */
const d = (id, name, g, n, color, edge, x) => ({ id, name, g, n, color, edge, ...x });
const LINES = {
  A: { name: 'Chicken rice', lc: 'chicken rice stall', dishes: [
    d('w_rice', 'Chicken rice', 250, { kcal: 1.7, c: .3, p: .03, f: .04, fb: .004, na: 1.5 }, '#F3E6B8', '#C9B272', { base: true }),
    d('w_roast', 'Roast chicken', 120, { kcal: 2.0, c: 0, p: .25, f: .11, fb: 0, na: 3.5 }, '#C98A4B', '#8E5E28'),
    d('w_soup', 'Chicken broth', 200, { kcal: .15, c: .01, p: .01, f: .006, fb: 0, na: 3.5 }, '#EAD9A6', '#B8A36A', { broth: true }),
    d('w_chilli', 'Chilli sauce', 25, { kcal: .8, c: .1, p: .01, f: .04, fb: .01, na: 10 }, '#E2462F', '#A52A1A', { side: true }),
    d('w_cucumber', 'Cucumber slices', 40, { kcal: .15, c: .03, p: .007, f: .001, fb: .005, na: .02 }, '#9CCB6B', '#6A9440'),
  ] },
  B: { name: 'Grill and salad', lc: 'grill and salad', dishes: [
    d('w_chicken', 'Grilled chicken breast', 130, { kcal: 1.65, c: 0, p: .31, f: .036, fb: 0, na: .7 }, '#D9A066', '#9C6A35'),
    d('w_brown', 'Brown rice', 150, { kcal: 1.12, c: .23, p: .026, f: .009, fb: .018, na: 0 }, '#C9A878', '#8E7248', { base: true }),
    d('w_salad', 'Green salad', 120, { kcal: .9, c: .06, p: .015, f: .07, fb: .02, na: 2.5 }, '#6DBE45', '#3F7D32'),
    d('w_potato', 'Roast sweet potato', 100, { kcal: .9, c: .21, p: .016, f: .001, fb: .03, na: .4 }, '#E08A3C', '#A85A1C', { side: true }),
    d('w_yogurt', 'Greek yogurt', 100, { kcal: .97, c: .04, p: .09, f: .05, fb: 0, na: .4 }, '#FFFFFF', '#C7C7CC'),
  ] },
  C: { name: 'Noodle stall', lc: 'noodle stall', dishes: [
    d('w_laksa', 'Laksa', 450, { kcal: 1.3, c: .12, p: .045, f: .07, fb: .01, na: 3.6 }, '#F0A04B', '#B86E1E', { base: true, broth: true }),
    d('w_wonton', 'Fried wontons', 90, { kcal: 2.8, c: .25, p: .09, f: .16, fb: .01, na: 4.5 }, '#E6B566', '#A67A2E', { side: true }),
    d('w_sambal', 'Sambal on the side', 20, { kcal: 1.5, c: .1, p: .02, f: .1, fb: .02, na: 9 }, '#C8321E', '#8A1F12', { side: true }),
  ] },
};
const EGGS = d('w_eggs', 'Two boiled eggs', 100, { kcal: 1.55, c: .01, p: .13, f: .11, fb: 0, na: 1.2 }, '#FFF6E0', '#D9C08A');
[...Object.values(LINES).flatMap(l => l.dishes), EGGS].forEach(x => { PL.DISH[x.id] = x; });
const menuOf = (line, eggs) => [...LINES[line].dishes, ...(eggs ? [EGGS] : [])];

/* ---------------------------------------------------------------- personal targets (Mifflin-St Jeor, then the goal) */
const GOALS = {
  muscle: { name: 'Build muscle', for: 'building muscle', blurb: 'More protein, and a little more energy to build with.', kcal: 250, pkg: 1.8, fat: .27, fb: 1, key: ['p', 'kcal'] },
  lose: { name: 'Lose weight', for: 'losing weight', blurb: 'About 400 kcal less a day, with protein kept high so you keep your muscle.', kcal: -400, pkg: 1.6, fat: .3, fb: 1, key: ['kcal', 'p'] },
  energy: { name: 'Steady energy', for: 'steady energy', blurb: 'No afternoon slump: fibre-rich carbs, less salt and less fried food.', kcal: 0, pkg: 1.1, fat: .28, fb: 1.2, key: ['fb', 'na'] },
  balanced: { name: 'Eat balanced', for: 'eating balanced', blurb: 'A bit of everything, in the right amounts.', kcal: 0, pkg: 1.0, fat: .28, fb: 1, key: ['kcal', 'p'] },
};
const ACT = { desk: ['Mostly sitting', 1.3, 'Sitting'], light: ['On my feet some of the day', 1.45, 'On my feet'], active: ['Exercise 3+ times a week', 1.6, 'Exercise'] };
const LUNCH = .35; // lunch is about a third of the day
function targets(w) {
  const G = GOALS[w.goal];
  const bmr = 10 * w.kg + 6.25 * w.cm - 5 * w.age + (w.sex === 'm' ? 5 : -161);
  const kcal = Math.round((bmr * ACT[w.act][1] + G.kcal) / 10) * 10;
  const p = Math.round(w.kg * G.pkg), f = Math.round(kcal * G.fat / 9), c = Math.round((kcal - p * 4 - f * 9) / 4);
  const day = { kcal, p, c, f, fb: Math.round(30 * G.fb), na: 2000 };
  const lunch = Object.fromEntries(Object.entries(day).map(([k, v]) => [k, k === 'na' ? 800 : Math.round(v * LUNCH)]));
  return { bmr: Math.round(bmr), day, lunch };
}

/* how far a lunch is from the targets, weighted by what matters for the goal (0 = perfect) */
const WEIGHTS = {
  muscle: { p: 3, kcal: 1, na: .5, fb: .3, f: .3 },
  lose: { kcal: 3, p: 1.5, na: .5, fb: .5, f: .5 },
  energy: { fb: 2, na: 1.5, kcal: 1, c: .5, f: .8 },
  balanced: { kcal: 1, p: 1, c: .5, f: .5, fb: .8, na: .8 },
};
function distance(n, T, goal) {
  const W = WEIGHTS[goal], r = k => n[k] / T[k];
  const pen = {
    kcal: goal === 'lose' ? Math.max(0, r('kcal') - 1) * 1.2 + Math.max(0, .8 - r('kcal')) : Math.abs(r('kcal') - 1),
    p: Math.max(0, 1 - r('p')), c: Math.abs(r('c') - 1) * .6, f: Math.max(0, r('f') - 1.15),
    fb: Math.max(0, 1 - r('fb')), na: Math.max(0, r('na') - 1),
  };
  return Object.entries(W).reduce((s, [k, w]) => s + w * pen[k], 0) / Object.values(W).reduce((a, b) => a + b, 0);
}
const fitWord = dist => dist < .12 ? ['Great fit', 'good'] : dist < .25 ? ['Good fit', 'ok'] : dist < .4 ? ['OK with tweaks', 'mid'] : ['Not for your goal', 'bad'];

/* tweaks the canteen allows: grams eaten per dish (1 = the full serving) */
const TWEAKS = [
  { id: 'eggs', say: 'Add the two boiled eggs from the salad bar', ok: () => true, apply: m => { m.eggs = true; } },
  { id: 'half', say: line => `Ask for half ${LINES[line].dishes.find(x => x.base).name.toLowerCase()}`, ok: () => true, apply: (m, line) => { m.frac[LINES[line].dishes.find(x => x.base).id] = .5; } },
  { id: 'broth', say: 'Leave most of the broth or gravy', ok: line => LINES[line].dishes.some(x => x.broth), apply: (m, line) => { m.broth = LINES[line].dishes.find(x => x.broth).id; } },
  { id: 'side', say: line => `Skip the ${LINES[line].dishes.find(x => x.side).name.toLowerCase()}`, ok: line => LINES[line].dishes.some(x => x.side), apply: (m, line) => { m.frac[LINES[line].dishes.find(x => x.side).id] = 0; } },
];
function plateNutrients(line, m) {
  const menu = menuOf(line, m.eggs), grams = {};
  menu.forEach(x => { grams[x.id] = x.g * (m.frac[x.id] ?? 1); });
  const n = H.nutrients(grams, menu);
  if (m.broth) { const b = PL.DISH[m.broth]; n.na = Math.round(n.na - b.g * (m.frac[b.id] ?? 1) * b.n.na * .6); } // most salt is in the broth
  return n;
}
/** The best line and tweaks (at most two) for this worker today. */
function recommend(w) {
  const T = targets(w).lunch;
  const opts = Object.keys(LINES).map(line => {
    const usable = TWEAKS.filter(t => t.ok(line));
    const sets = [[]];
    usable.forEach((a, i) => { sets.push([a]); usable.slice(i + 1).forEach(b => sets.push([a, b])); });
    let best = null;
    sets.forEach(set => {
      const m = { frac: {}, eggs: false, broth: null };
      set.forEach(t => t.apply(m, line));
      const n = plateNutrients(line, m), dist = distance(n, T, w.goal) + set.length * .03;
      if (!best || dist < best.dist) best = { line, set, n, dist };
    });
    return { ...best, plain: distance(plateNutrients(line, { frac: {}, eggs: false, broth: null }), T, w.goal) };
  }).sort((a, b) => a.dist - b.dist);
  return opts;
}

/* ---------------------------------------------------------------- demo workers */
const WEEK = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24'];
const DAYNAME = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };
const WORKERS = [
  { id: 'w1', name: 'Marcus Tan', dept: 'Design team', sex: 'm', age: 32, cm: 176, kg: 74, act: 'light', goal: 'muscle', days: ['A', 'A', 'B', 'A'], eat: .95, like: { w_soup: .45 } },
  { id: 'w2', name: 'Nur Farhana', dept: 'Finance', sex: 'f', age: 29, cm: 163, kg: 64, act: 'desk', goal: 'lose', days: ['C', 'B', 'C', 'A'], eat: .9, like: { w_salad: .7 } },
  { id: 'w3', name: 'Ravi Shankar', dept: 'Sales', sex: 'm', age: 45, cm: 172, kg: 80, act: 'desk', goal: 'energy', days: ['C', 'A', 'C', 'A'], eat: .95, like: { w_sambal: .4, w_cucumber: .5 } },
  { id: 'w4', name: 'Rachel Goh', dept: 'Engineering', sex: 'f', age: 38, cm: 160, kg: 54, act: 'active', goal: 'balanced', days: ['B', 'B', 'A', 'B'], eat: .85, like: { w_rice: .6 } },
];
function record(line, eggs, frac, day) {
  const menu = menuOf(line, eggs), served = {}, eaten = {}, measured = {};
  menu.forEach(x => { served[x.id] = x.g; eaten[x.id] = Math.round(x.g * clamp(frac[x.id] ?? 1, 0, 1)); measured[x.id] = x.g - eaten[x.id]; });
  const tot = Object.values(served).reduce((a, b) => a + b, 0), left = Object.values(measured).reduce((a, b) => a + b, 0);
  return { day, line, eggs, served, eaten, measured, n: H.nutrients(eaten, menu), w: left / tot, left };
}
function seedWorker(W) {
  const r = rng(W.id.charCodeAt(1) * 71);
  const log = W.days.map((line, i) => record(line, false, Object.fromEntries(menuOf(line).map(x => [x.id, W.eat * (W.like[x.id] || 1) + (r() - .5) * .1])), WEEK[i]));
  const { days, eat, like, ...rest } = W;
  return { ...rest, log };
}
const WORK_V = 1;
const ensure = () => { if (!PL.S.work || PL.S.work.v !== WORK_V) PL.S.work = { v: WORK_V, workers: WORKERS.map(seedWorker), me: 'w1' }; };
ensure();
PL.store.subscribe(ensure);
const PREFS = Object.fromEntries(WORKERS.map(w => [w.id, w]));
const me = () => PL.S.work.workers.find(w => w.id === PL.S.work.me) || PL.S.work.workers[0];
const todayRec = w => w.log.find(l => l.day === H.TODAY);

/* ---------------------------------------------------------------- feedback on one lunch */
function feedback(w, n) {
  const T = targets(w).lunch, G = w.goal, out = [];
  const r = k => n[k] / T[k];
  if (r('p') < .8) out.push(['warn', `Not enough protein: ${n.p} of ${T.p} g.`, G === 'muscle' || G === 'lose' ? 'Take the boiled eggs (+13 g) or pick Grill and salad (56 g).' : 'Add the boiled eggs or the Greek yogurt next time.']);
  if (G === 'lose' && r('kcal') > 1.12) out.push(['warn', `About ${n.kcal - T.kcal} kcal over your lunch target.`, 'Half rice or skipping the fried side closes most of the gap.']);
  else if (r('kcal') > 1.25) out.push(['info', `A big lunch: ${n.kcal} of ${T.kcal} kcal.`, 'Keep the afternoon snack light.']);
  if (r('kcal') < .7) out.push(['info', `A light lunch: ${n.kcal} of ${T.kcal} kcal.`, G === 'muscle' ? 'Eat a protein snack this afternoon so you still reach your day.' : 'A piece of fruit this afternoon keeps your energy up.']);
  if (r('na') > 1.1) out.push(['warn', `Salty: ${n.na.toLocaleString('en-US')} mg sodium, over the 800 mg lunch limit.`, 'Leaving most of the broth or gravy cuts about half of it.']);
  if (r('fb') < .7 && (G === 'energy' || G === 'balanced' || G === 'lose')) out.push(['info', `Low fibre: ${n.fb} of ${T.fb} g.`, 'Salad, brown rice and sweet potato help you stay full and steady.']);
  if (!out.length) out.push(['good', `Right on target for ${GOALS[G].for}.`, 'Same again tomorrow would be great.']);
  return out;
}

/* ================================================================ app */
const ui = { tab: 'today', line: null, preset: 'Ate well', eggs: null };
let root = null;
const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  today: I('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>'),
  report: I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-4"/>'),
  goals: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
};
const MINS = ['p', 'fb']; // protein and fibre are minimums for office workers
const TONE = { warn: 'var(--orange)', good: 'var(--tint)', info: 'var(--blue)' };
const TABS = { today: 'Today', report: 'Report', goals: 'Goals' };

function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="stu work">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon work-icon" aria-hidden="true"><canvas width="44" height="37" data-form="crystal" data-stage="adult"></canvas></span><div><b>Loopi Work</b><span>by PlateLoop · for office canteens</span></div></div>
      <p class="stu-note">Demo: pick a worker</p>
      <div class="chips" id="work-who"></div>
      <div class="demo-box">
        <label for="work-line">Lunch at the scanner</label>
        <select id="work-line"></select>
        <select id="work-preset" aria-label="How much they ate">${Object.keys(H.PRESETS).map(p => `<option>${p}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="work-eggs"> Took the boiled eggs</label>
        <button class="btn primary" id="work-scan"></button>
      </div>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone">
      <header class="phone-top" id="work-top"></header>
      <div class="phone-body" id="work-body"></div>
      <nav class="phone-tabs three" role="tablist" aria-label="Loopi Work">${Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}">${ICON[t]}${TABS[t]}</button>`).join('')}</nav>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; render(); $('#work-body').scrollTop = 0; });
  $('#work-line', el).onchange = e => { ui.line = e.target.value; };
  $('#work-preset', el).onchange = e => { ui.preset = e.target.value; };
  $('#work-eggs', el).onchange = e => { ui.eggs = e.target.checked; };
  $('#work-scan', el).onclick = () => {
    const w = me(); if (todayRec(w)) return;
    const line = ui.line || recommend(w)[0].line, like = PREFS[w.id].like, base = H.PRESETS[ui.preset], eggs = eggsOn(w);
    const rec = record(line, eggs, Object.fromEntries(menuOf(line, eggs).map(x => [x.id, base * Math.min(1.05, like[x.id] || 1) + (Math.random() - .5) * .08])), H.TODAY);
    w.log.push(rec); PL.store.save('work');
    PL.toast(`Tray scanned: ${LINES[line].name}, ${rec.n.kcal} kcal, ${rec.n.p} g protein.`);
  };
  render();
}
/** The demo's eggs box follows the recommendation until someone changes it. */
const eggsOn = w => ui.eggs ?? recommend(w)[0].set.some(t => t.id === 'eggs');
function render(keep) {
  if (!root) return;
  const w = me(), body = $('#work-body', root), y = body.scrollTop, rec = recommend(w);
  $('#work-who', root).innerHTML = PL.S.work.workers.map(x => `<button class="chip plain" data-wid="${x.id}" aria-pressed="${x.id === w.id}">${esc(x.name)}</button>`).join('');
  $$('#work-who button', root).forEach(b => b.onclick = () => { PL.S.work.me = b.dataset.wid; ui.line = null; ui.eggs = null; PL.store.save('me'); });
  $('#work-line', root).innerHTML = Object.entries(LINES).map(([k, L]) => `<option value="${k}" ${k === (ui.line || rec[0].line) ? 'selected' : ''}>${k} · ${L.name}${k === rec[0].line ? ' (recommended)' : ''}</option>`).join('');
  $('#work-preset', root).value = ui.preset;
  $('#work-eggs', root).checked = eggsOn(w);
  const sb = $('#work-scan', root); sb.textContent = todayRec(w) ? 'Lunch is done' : 'Scan lunch tray'; sb.disabled = !!todayRec(w);
  $('#work-top', root).innerHTML = `<span class="avatar">${esc(w.name.split(' ').map(s => s[0]).join(''))}</span><div><b>${esc(w.name)}</b><span>${esc(w.dept)} · goal: ${GOALS[w.goal].name.toLowerCase()}</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ today, report, goals })[ui.tab](w, rec);
  if (ui.tab === 'goals') wireGoals(w);
  const pr = $('#work-print', body); if (pr) pr.onclick = () => print();
  const sh = $('#work-share', body); if (sh) sh.onclick = () => PL.toast('Shared with the company health programme (demo, nothing was sent).');
  PL.paintPets(root);
  if (keep) body.scrollTop = y;
}

/* ---------------------------------------------------------------- Today: the pick for your goal, then how lunch went */
function today(w, rec) {
  const T = targets(w).lunch, R = todayRec(w), G = GOALS[w.goal];
  const keys = ['kcal', 'p', ...G.key.filter(k => k !== 'kcal' && k !== 'p'), 'na'].filter((k, i, a) => a.indexOf(k) === i);
  if (R) {
    const menu = menuOf(R.line, R.eggs), fb = feedback(w, R.n), co2 = Math.round(Math.max(0, .17 * Object.values(R.served).reduce((a, b) => a + b, 0) - R.left) / 1000 * PL.CO2_PER_KG * 1000);
    return `
    <section class="group rep-head"><div><b>Your lunch</b><span>${LINES[R.line].name}${R.eggs ? ' + boiled eggs' : ''} · scanned before and after</span></div><span class="pill">${pct(1 - R.w)} eaten</span></section>
    <section class="group">${fb.map(([k, t, s]) => `<div class="finding"><i style="background:${TONE[k]}"></i><span><b>${t}</b> ${s}</span></div>`).join('')}</section>
    <h4 class="sec">Against your lunch target</h4>
    <section class="group pad">${H.nutrientRows(R.n, T, ['kcal', 'p', 'c', 'f', 'fb', 'na'], MINS)}</section>
    <h4 class="sec">Dish by dish</h4>
    <section class="group">${H.dishRows(menu, R)}</section>
    <p class="foot">${co2 > 0 ? `Less left than the office average, which kept about ${co2} g of CO₂ out of the air. ` : ''}Tomorrow's pick appears here in the morning.</p>`;
  }
  const best = rec[0];
  return `
  <section class="group pick">
    <div class="pick-head"><span class="pill green">Best for ${G.for}</span><b>${best.line} · ${LINES[best.line].name}</b><span>${LINES[best.line].dishes.map(x => x.name).join(', ')}</span></div>
    ${best.set.length ? `<ul class="tweaks">${best.set.map(t => `<li>${ICON.check}<span>${typeof t.say === 'function' ? t.say(best.line) : t.say}</span></li>`).join('')}</ul>` : ''}
    <div class="pad-in">${H.nutrientRows(best.n, T, keys, MINS)}</div>
  </section>
  <h4 class="sec">The other lines today</h4>
  <section class="group">${rec.slice(1).map(o => { const [word, cls] = fitWord(o.plain); return `<div class="g-row two-col"><span><b>${o.line} · ${LINES[o.line].name}</b><br><small class="muted">${plateNutrients(o.line, { frac: {}, eggs: false, broth: null }).kcal} kcal · ${plateNutrients(o.line, { frac: {}, eggs: false, broth: null }).p} g protein</small></span><span class="fit ${cls}">${word}</span></div>`; }).join('')}</section>
  <h4 class="sec">Your lunch target</h4>
  <section class="group"><div class="g-row two-col"><span>${T.kcal} kcal · ${T.p} g protein · ${T.fb} g fibre</span><span class="g-v">under ${T.na} mg sodium</span></div></section>
  <p class="foot">Look at the camera on the scanner before and after you eat. Your targets come from your goal on the Goals tab.</p>`;
}

/* ---------------------------------------------------------------- Report: the weekly healthcare report */
function report(w) {
  const T = targets(w).lunch, G = GOALS[w.goal], log = w.log, n = log.length;
  const avg = Object.fromEntries(Object.keys(T).map(k => [k, Math.round(log.reduce((s, r) => s + r.n[k], 0) / n)]));
  const onTarget = log.filter(r => distance(r.n, T, w.goal) < .25).length;
  const pDays = log.filter(r => r.n.p >= T.p * .9).length, naDays = log.filter(r => r.n.na > T.na * 1.1);
  const lineCount = Object.keys(LINES).map(k => [k, log.filter(r => r.line === k).length]).filter(x => x[1]);
  const worst = [...log].sort((a, b) => distance(b.n, T, w.goal) - distance(a.n, T, w.goal))[0];
  const waste = log.reduce((s, r) => s + r.w, 0) / n;
  const recs = [];
  if (avg.p < T.p * .9) recs.push(['warn', `Protein averaged ${avg.p} g against ${T.p} g, and you reached it on ${pDays} of ${n} days.`, 'Grill and salad or the boiled eggs close the gap.']);
  else recs.push(['good', `Protein averaged ${avg.p} g against ${T.p} g.`, avg.p >= T.p ? 'Nicely done.' : 'Close to your target.']);
  if (w.goal === 'lose') {
    const heavy = Object.keys(LINES).map(k => { const rs = log.filter(r => r.line === k); return [k, rs.length, rs.reduce((s, r) => s + r.n.kcal, 0) / (rs.length || 1)]; }).filter(x => x[1]).sort((a, b) => b[2] - a[2])[0];
    const fix = { A: 'asking for half rice at the chicken rice stall saves about 210 kcal', B: 'skipping the sweet potato saves about 90 kcal', C: 'skipping the fried wontons at the noodle stall saves about 250 kcal' }[heavy[0]];
    recs.push([avg.kcal > T.kcal * 1.1 ? 'warn' : 'good', `Lunch averaged ${avg.kcal} kcal against ${T.kcal}.`, avg.kcal > T.kcal * 1.1 ? `Your biggest lunches were at the ${LINES[heavy[0]].lc}: ${fix}.` : 'That keeps you on track to lose weight steadily.']);
  }
  if (naDays.length >= 2) recs.push(['warn', `Sodium was over the lunch limit on ${naDays.length} of ${n} days, all on ${[...new Set(naDays.map(r => LINES[r.line].name))].join(' or ')} days.`, 'Leaving most of the broth or gravy is the easiest fix.']);
  if (w.goal === 'energy' || avg.fb < T.fb * .75) recs.push([avg.fb >= T.fb * .9 ? 'good' : 'info', `Fibre averaged ${avg.fb} g against ${T.fb} g.`, avg.fb >= T.fb * .9 ? 'Good for steady energy.' : 'Days with salad, brown rice or sweet potato keep you full and steady through the afternoon.']);
  if (worst && distance(worst.n, T, w.goal) > .3) recs.push(['info', `${DAYNAME[worst.day.split(' ')[0]]}'s ${LINES[worst.line].lc} was the furthest from your goal.`, `Next time, check the pick on the Today tab first.`]);
  const days = log.map(r => r.day);
  return `
  <section class="group rep-head"><div><b>Weekly report</b><span>${days[0]} to ${days[days.length - 1]} · ${n} lunches scanned</span></div><span class="pill">${G.name}</span></section>
  <section class="group health-top">
    <div class="ring-wrap"><svg viewBox="0 0 110 110" class="ring" aria-hidden="true"><circle cx="55" cy="55" r="42" fill="none" stroke="var(--fill2)" stroke-width="11"/><circle cx="55" cy="55" r="42" fill="none" stroke="var(--tint)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(264 * onTarget / n).toFixed(1)} 264" transform="rotate(-90 55 55)"/></svg><div class="ring-in"><b class="num">${onTarget}/${n}</b><span>lunches on target</span></div></div>
    <div class="rep-kpis"><div><b class="num">${avg.p} g</b><span>protein a lunch · target ${T.p} g</span></div><div><b class="num">${avg.kcal}</b><span>kcal a lunch · target ${T.kcal}</span></div></div>
  </section>
  <h4 class="sec">Recommendations</h4>
  <section class="group">${recs.map(([k, t, s]) => `<div class="finding"><i style="background:${TONE[k]}"></i><span><b>${t}</b> ${s}</span></div>`).join('')}</section>
  <h4 class="sec">Protein each lunch, share of target</h4>
  <section class="group chart">${H.dayBars(days, log.map(r => r.n.p / T.p), 'Protein each lunch')}</section>
  <h4 class="sec">Calories each lunch, share of target</h4>
  <section class="group chart">${H.dayBars(days, log.map(r => r.n.kcal / T.kcal), 'Calories each lunch')}</section>
  <h4 class="sec">Average lunch</h4>
  <section class="group pad">${H.nutrientRows(avg, T, ['kcal', 'p', 'c', 'f', 'fb', 'na'], MINS)}</section>
  <h4 class="sec">What you picked</h4>
  <section class="group">${lineCount.map(([k, c]) => `<div class="g-row two-col"><span>${k} · ${LINES[k].name}</span><span class="g-v num">${c} ${c === 1 ? 'day' : 'days'}</span></div>`).join('')}<div class="g-row two-col"><span>Food left on your tray</span><span class="g-v num">${pct(waste)} (office ${pct(.17)})</span></div></section>
  <div class="two-btn"><button class="btn primary" id="work-share">Share with health programme</button><button class="btn" id="work-print">Print</button></div>
  <p class="foot">Only you see this report unless you share it. Targets are estimates from your goal and body details, not medical advice.</p>`;
}

/* ---------------------------------------------------------------- Goals: the personalised system */
function goals(w) {
  const t = targets(w);
  const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === val}">${l}</button>`).join('')}</div>`;
  return `
  <h4 class="sec">My goal</h4>
  <div class="goal-grid">${Object.entries(GOALS).map(([k, G]) => `<button class="goal-opt ${k === w.goal ? 'on' : ''}" data-goal="${k}"><b>${G.name}</b><span>${G.blurb}</span></button>`).join('')}</div>
  <h4 class="sec">About me</h4>
  <section class="group form">
    <div class="f-row"><span>Sex</span>${seg('f-sex', [['f', 'Female'], ['m', 'Male']], w.sex)}</div>
    <div class="f-row"><span>Age</span><input type="number" id="f-age" min="16" max="90" value="${w.age}" inputmode="numeric"></div>
    <div class="f-row"><span>Height (cm)</span><input type="number" id="f-cm" min="120" max="220" value="${w.cm}" inputmode="numeric"></div>
    <div class="f-row"><span>Weight (kg)</span><input type="number" id="f-kg" min="30" max="200" value="${w.kg}" inputmode="numeric"></div>
    <div class="f-row col"><span>How active</span>${seg('f-act', Object.entries(ACT).map(([k, a]) => [k, a[2]]), w.act)}</div>
  </section>
  <h4 class="sec">My daily targets</h4>
  <section class="group">
    ${[['Energy', `${t.day.kcal.toLocaleString('en-US')} kcal`], ['Protein', `${t.day.p} g`], ['Carbs', `${t.day.c} g`], ['Fat', `${t.day.f} g`], ['Fibre', `${t.day.fb} g`], ['Sodium', 'under 2,000 mg']].map(([k, v]) => `<div class="g-row two-col"><span>${k}</span><span class="g-v num">${v}</span></div>`).join('')}
  </section>
  <p class="foot">How we got these: your body at rest uses about ${t.bmr.toLocaleString('en-US')} kcal a day (Mifflin-St Jeor), times ${ACT[w.act][1]} for how active you are, ${GOALS[w.goal].kcal > 0 ? `plus ${GOALS[w.goal].kcal}` : GOALS[w.goal].kcal < 0 ? `minus ${-GOALS[w.goal].kcal}` : 'with nothing added'} for your goal. Protein is ${GOALS[w.goal].pkg} g per kg of body weight. Lunch is about a third of the day. These are estimates, not medical advice.</p>`;
}
function wireGoals(w) {
  const body = $('#work-body', root);
  const save = () => { PL.store.save('work'); };
  $$('[data-goal]', body).forEach(b => b.onclick = () => { w.goal = b.dataset.goal; save(); });
  $$('#f-sex button', body).forEach(b => b.onclick = () => { w.sex = b.dataset.v; save(); });
  $$('#f-act button', body).forEach(b => b.onclick = () => { w.act = b.dataset.v; save(); });
  [['f-age', 'age', 16, 90], ['f-cm', 'cm', 120, 220], ['f-kg', 'kg', 30, 200]].forEach(([id, k, lo, hi]) => { const el = $('#' + id, body); el.onchange = () => { const v = +el.value; if (v >= lo && v <= hi) { w[k] = v; save(); } else el.value = w[k]; }; });
}

PL.work = { targets, recommend, feedback, GOALS, LINES };
PL.apps.work = {
  title: 'Loopi Work',
  mount,
  unmount() { root = null; },
  update() { render(true); },
  tick(t) { if (root) PL.paintPets($('.stu-side', root), t); },
};
})();
