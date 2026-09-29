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
    d('w_rice', 'Chicken rice', 250, { kcal: 1.7, c: .3, p: .03, f: .04, fb: .004, na: 1.5 }, '#F3E6B8', '#C9B272', { base: true , group: 'grain' }),
    d('w_roast', 'Roast chicken', 120, { kcal: 2.0, c: 0, p: .25, f: .11, fb: 0, na: 3.5 }, '#C98A4B', '#8E5E28', { group: 'protein' }),
    d('w_soup', 'Chicken broth', 200, { kcal: .15, c: .01, p: .01, f: .006, fb: 0, na: 3.5 }, '#EAD9A6', '#B8A36A', { broth: true , group: 'soup' }),
    d('w_chilli', 'Chilli sauce', 25, { kcal: .8, c: .1, p: .01, f: .04, fb: .01, na: 10 }, '#E2462F', '#A52A1A', { side: true , group: 'sauce' }),
    d('w_cucumber', 'Cucumber slices', 40, { kcal: .15, c: .03, p: .007, f: .001, fb: .005, na: .02 }, '#9CCB6B', '#6A9440', { group: 'veg' }),
  ] },
  B: { name: 'Grill and salad', lc: 'grill and salad', dishes: [
    d('w_chicken', 'Grilled chicken breast', 130, { kcal: 1.65, c: 0, p: .31, f: .036, fb: 0, na: .7 }, '#D9A066', '#9C6A35', { group: 'protein' }),
    d('w_brown', 'Brown rice', 150, { kcal: 1.12, c: .23, p: .026, f: .009, fb: .018, na: 0 }, '#C9A878', '#8E7248', { base: true , group: 'grain' }),
    d('w_salad', 'Green salad', 120, { kcal: .9, c: .06, p: .015, f: .07, fb: .02, na: 2.5 }, '#6DBE45', '#3F7D32', { group: 'veg' }),
    d('w_potato', 'Roast sweet potato', 100, { kcal: .9, c: .21, p: .016, f: .001, fb: .03, na: .4 }, '#E08A3C', '#A85A1C', { side: true , group: 'grain' }),
    d('w_yogurt', 'Greek yogurt', 100, { kcal: .97, c: .04, p: .09, f: .05, fb: 0, na: .4 }, '#FFFFFF', '#C7C7CC', { group: 'dairy' }),
  ] },
  C: { name: 'Noodle stall', lc: 'noodle stall', dishes: [
    d('w_laksa', 'Laksa', 450, { kcal: 1.3, c: .12, p: .045, f: .07, fb: .01, na: 3.6 }, '#F0A04B', '#B86E1E', { base: true, broth: true , group: 'grain' }),
    d('w_wonton', 'Fried wontons', 90, { kcal: 2.8, c: .25, p: .09, f: .16, fb: .01, na: 4.5 }, '#E6B566', '#A67A2E', { side: true , group: 'protein' }),
    d('w_sambal', 'Sambal on the side', 20, { kcal: 1.5, c: .1, p: .02, f: .1, fb: .02, na: 9 }, '#C8321E', '#8A1F12', { side: true , group: 'sauce' }),
  ] },
};
const EGGS = d('w_eggs', 'Two boiled eggs', 100, { kcal: 1.55, c: .01, p: .13, f: .11, fb: 0, na: 1.2 }, '#FFF6E0', '#D9C08A', { group: 'protein' });
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
const V = PL.V;
const GOAL_ICON = { muscle: 'muscle', lose: 'scale', energy: 'bolt', balanced: 'plate' };
const TONE = { warn: 'var(--orange)', good: 'var(--tint)', info: 'var(--blue)' };
const TABS = { today: 'Today', report: 'Report', goals: 'Goals' };
/* Pre-ordering at work leads to healthier picks and less waste, and the kitchen cooks to the orders (see docs/research.md). */
const SLOTS = ['12:00', '12:15', '12:30', '12:45', '13:00'];
const ticket = (w, line) => `${line}-${String(20 + (w.id.charCodeAt(1) * 37) % 70).padStart(3, '0')}`;
/* The 1 to 3 pm dip is worse after carb-heavy lunches. Past days are estimated from the lunch; today is what you say. */
const ENERGY = ['Drained', 'Low', 'Okay', 'Good', 'Sharp'];
const carbShare = r => r.n.kcal ? r.n.c * 4 / r.n.kcal : 0;
const REFINED = { A: true, C: true }; // white rice and fried noodles: the lunches that deepen the dip
const energyOf = r => r.energy ?? clamp(Math.round({ A: 2.6, B: 4.1, C: 2.2 }[r.line] + (r.eggs ? .5 : 0) + ((r.day.charCodeAt(0) + r.day.charCodeAt(5)) % 3 - 1) * .4), 1, 5);
/* Anonymous team challenge: only team totals, never names. */
const TEAMS = [['Design team', .24], ['Engineering', .21], ['Finance', .18], ['Operations', .15], ['Sales', .12], ['People and HR', .09]];

function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="stu work">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon work-icon" aria-hidden="true">${PL.V.loopi('happy', 46)}</span><div><b>Loopi Work</b><span>by PlateLoop · for office canteens</span></div></div>
      <p class="stu-note">Demo: pick a worker</p>
      <div class="chips" id="work-who"></div>
      <div class="demo-box">
        <label for="work-line">Lunch at the scanner</label>
        <select id="work-line"></select>
        <select id="work-preset" aria-label="How much they ate">${Object.keys(H.PRESETS).map(p => `<option>${p}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="work-eggs"> Took the boiled eggs</label>
        <button class="btn primary" id="work-scan"></button>
      </div>
      <button class="linkish" id="work-intro" style="font-size:13px;text-align:left">Show the first-run intro</button>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone" id="work-phone">
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
    const line = ui.line || (w.reserved && w.reserved.line) || recommend(w)[0].line, like = PREFS[w.id].like, base = H.PRESETS[ui.preset], eggs = w.reserved && !ui.line ? w.reserved.eggs : eggsOn(w);
    const rec = record(line, eggs, Object.fromEntries(menuOf(line, eggs).map(x => [x.id, base * Math.min(1.05, like[x.id] || 1) + (Math.random() - .5) * .08])), H.TODAY);
    if (w.reserved) rec.pre = w.reserved.code;
    w.log.push(rec); PL.store.save('work');
    PL.notify($('#work-phone', root), { app: 'Loopi Work', icon: PL.V.loopi('happy', 30), title: `Lunch scanned: ${LINES[line].name}`, text: `${rec.n.kcal} kcal, ${rec.n.p} g protein. Tap for your feedback.`, onTap: () => { ui.tab = 'today'; render(); } });
  };
  $('#work-intro', el).onclick = intro;
  PL.premium(el, { accent: '#5E5CE6', glow: '#7D7AFF', who: 'Office workers at a company canteen',
    facts: [['6', 'in 10', 'Singapore residents usually eat out for lunch or dinner.', 'HPB National Nutrition Survey'],
      ['51', '%', 'more fruit ordered when a canteen pre-order app nudged healthier picks.', 'Cafeteria Online trial, 2021'],
      ['1–3', 'pm', 'is the post-lunch dip, and carb-heavy lunches make it worse.', 'Nutrients, 2025']],
    how: ['A daily pick for your goal', 'Pre-order before 11:30 and skip the queue', 'A 3 pm energy check-in, linked to what you ate', 'Private by default: the company sees team totals only'] });
  render();
  if (!PL.introSeen('work')) intro();
}
/** First run: the idea, pick a goal, then what your employer can and can't see. */
function intro() {
  const w = me();
  PL.onboard($('#work-phone', root), 'work', [
    { art: PL.V.loopi('happy', 150), title: 'Lunch that fits your goal.', text: 'Scan your tray at the canteen. Loopi Work tells you which line to pick, and after lunch, what was missing.' },
    { art: PL.V.icon('muscle', 'var(--indigo)'), title: 'What’s your goal?', text: 'You can change it any time on the Goals tab.',
      body: `<div class="onb-goals">${Object.entries(GOALS).map(([k, G]) => `<label><input type="radio" name="onb-goal" value="${k}" data-pref="goal_${k}" ${k === w.goal ? 'checked' : ''}><span><b>${G.name}</b><small>${G.blurb}</small></span></label>`).join('')}</div>` },
    { consent: true, art: PL.V.icon('check', 'var(--indigo)'), title: 'Only you see your meals.', cta: 'Start',
      body: `<ul class="onb-list"><li><b>Your company</b> sees canteen totals only, never names.</li><li><b>Your weekly report</b> stays on your phone unless you share it.</li></ul>
      <div class="onb-prefs"><label class="onb-pref"><span><b>Share my weekly report</b><small>With the company health programme. Off by default.</small></span><input type="checkbox" role="switch" data-pref="share" ${w.share ? 'checked' : ''}></label>
      <label class="onb-agree"><input type="checkbox" data-agree> <span>I agree to PlateLoop recording my canteen trays for my own report.</span></label></div>` },
  ], p => {
    const g = Object.keys(GOALS).find(k => p['goal_' + k]); if (g) w.goal = g;
    w.share = !!p.share; ui.line = null; ui.eggs = null; PL.store.save('work');
  });
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
  $('#work-top', root).innerHTML = `${V.avatar(w, 36)}<div><b>${esc(w.name)}</b><span>${esc(w.dept)} · goal: ${GOALS[w.goal].name.toLowerCase()}</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ today, report, goals })[ui.tab](w, rec);
  if (ui.tab === 'goals') wireGoals(w);
  wireWork(w, body);
  const pr = $('#work-print', body); if (pr) pr.onclick = () => print();
  const sh = $('#work-share', body); if (sh) sh.onclick = () => PL.toast('Shared with the company health programme (demo, nothing was sent).');
  if (keep) body.scrollTop = y;
  PL.motion(body, `work:${w.id}:${ui.tab}`);
}

/* ---------------------------------------------------------------- Today: the pick for your goal, then how lunch went */
const RING_KIND = { kcal: 'range', p: 'aim', c: 'range', f: 'limit', fb: 'aim', na: 'limit' };
const rings = (n, T, keys) => `<div class="vrings">${keys.map(k => V.ring(n[k], T[k], H.NAMES[k][0], H.NAMES[k][1], RING_KIND[k])).join('')}</div>`;
const iconFor = t => /protein/i.test(t) ? 'muscle' : /kcal|lunch/i.test(t) ? 'scale' : /salt|sodium/i.test(t) ? 'salt' : /fibre/i.test(t) ? 'leaf' : /target/i.test(t) ? 'check' : 'plate';
const tips = list => `<div class="vtips">${list.map(([k, t, x]) => V.tip(iconFor(t), k, t, x)).join('')}</div>`;
function today(w, rec) {
  const T = targets(w).lunch, R = todayRec(w), G = GOALS[w.goal];
  const keys = ['kcal', 'p', ...G.key.filter(k => k !== 'kcal' && k !== 'p'), 'na'].filter((k, i, a) => a.indexOf(k) === i).slice(0, 3);
  if (R) {
    const menu = menuOf(R.line, R.eggs), fb = feedback(w, R.n), co2 = Math.round(Math.max(0, .17 * Object.values(R.served).reduce((a, b) => a + b, 0) - R.left) / 1000 * PL.CO2_PER_KG * 1000);
    const good = fb.length === 1 && fb[0][0] === 'good';
    return `
    ${V.guide(good ? 'cheer' : 'think', good ? `Right on target for ${G.for}. Same again tomorrow would be great.` : `Here's how lunch went against your goal: ${G.for}.`)}
    ${energyCard(w, R)}
    <div class="vcard"><h3>Your lunch <small>${LINES[R.line].name}${R.eggs ? ' + eggs' : ''} · ${pct(1 - R.w)} eaten</small></h3>${V.tray(menu, R)}</div>
    ${R.pre ? `<p class="pre-done">${ICON.check} Pre-ordered as ${R.pre}. You skipped the queue.</p>` : ''}
    ${good ? '' : tips(fb)}
    <div class="vcard"><h3>Against your lunch target</h3>${rings(R.n, T, ['kcal', 'p', 'fb', 'na'])}</div>
    <div class="vcard"><h3>Plate balance</h3>${V.healthyPlate(V.plateShares(menu, R.eaten))}</div>
    <p class="foot">${co2 > 0 ? `Less left than the office average, which kept about ${co2} g of CO₂ out of the air. ` : ''}Tomorrow's pick appears here in the morning.</p>`;
  }
  const best = rec[0], bestMenu = menuOf(best.line, best.set.some(t => t.id === 'eggs'));
  return `
  ${V.guide('point', `Today's best pick for ${G.for} is the ${LINES[best.line].lc}${best.set.length ? ', with a small change' : ''}.`)}
  <div class="vcard pick2"><h3><span><span class="pill green">Best for ${G.for}</span></span><small>${best.line} · ${LINES[best.line].name}</small></h3>
    ${V.tray(bestMenu, null, { size: 36, tag: d => d.id === 'w_eggs' ? 'Add' : '' })}
    ${best.set.length ? `<ul class="tweaks">${best.set.map(t => `<li>${ICON.check}<span>${typeof t.say === 'function' ? t.say(best.line) : t.say}</span></li>`).join('')}</ul>` : ''}
    ${rings(best.n, T, keys)}</div>
  ${preorder(w, best)}
  <div class="vcard"><h3>The other lines today</h3><div class="lines2">${rec.slice(1).map(o => { const [word, cls] = fitWord(o.plain), n0 = plateNutrients(o.line, { frac: {}, eggs: false, broth: null }); return `<div><div class="lthumbs">${LINES[o.line].dishes.slice(0, 3).map(x => V.food(x, 30)).join('')}</div><div><b>${o.line} · ${LINES[o.line].name}</b><small>${n0.kcal} kcal · ${n0.p} g protein · ${n0.na.toLocaleString('en-US')} mg sodium</small></div><span class="fit ${cls}">${word}</span></div>`; }).join('')}</div></div>
  <p class="foot">Your lunch target: ${T.kcal} kcal, ${T.p} g protein, ${T.fb} g fibre, under ${T.na} mg sodium. It comes from your goal on the Goals tab.</p>`;
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
  const grams = {}; log.forEach(r => Object.entries(r.eaten).forEach(([id, g]) => { grams[id] = (grams[id] || 0) + g; }));
  const allDishes = [...Object.values(LINES).flatMap(l => l.dishes), EGGS];
  return `
  ${V.guide(onTarget >= n / 2 ? 'cheer' : 'think', `${onTarget} of ${n} lunches this week were on target for ${G.for}.`)}
  <div class="vcard"><h3>An average lunch <small>vs your target</small></h3>${rings(avg, T, ['kcal', 'p', 'fb', 'na'])}</div>
  <h4 class="sec">Recommendations</h4>
  ${tips(recs)}
  <div class="vcard"><h3>Protein each lunch <small>share of target</small></h3>${H.dayBars(days, log.map(r => r.n.p / T.p), 'Protein each lunch')}</div>
  <div class="vcard"><h3>Calories each lunch <small>share of target</small></h3>${V.week(days, log.map(r => Math.min(1, r.n.kcal / T.kcal)), { good: .85 })}</div>
  ${energyWeek(log)}
  <div class="vcard"><h3>Plate balance <small>all week</small></h3>${V.healthyPlate(V.plateShares(allDishes, grams))}</div>
  ${teamRace(w)}
  <div class="vcard"><h3>What you picked</h3><div class="lines2">${lineCount.map(([k, c]) => `<div><div class="lthumbs">${LINES[k].dishes.slice(0, 3).map(x => V.food(x, 30)).join('')}</div><div><b>${k} · ${LINES[k].name}</b><small>${c} ${c === 1 ? 'day' : 'days'}</small></div><span class="fit ${fitWord(distance(plateNutrients(k, { frac: {}, eggs: false, broth: null }), T, w.goal))[1]}">${c}×</span></div>`).join('')}</div>
    <p class="hint" style="margin-top:10px">You left ${pct(waste)} of your food on average. The office average is ${pct(.17)}.</p></div>
  <div class="vcard"><h3>Average lunch, in detail</h3>${H.nutrientRows(avg, T, ['kcal', 'p', 'c', 'f', 'fb', 'na'], MINS)}</div>
  <div class="two-btn"><button class="btn primary" id="work-share">Share with health programme</button><button class="btn" id="work-print">Print</button></div>
  <p class="foot">Only you see this report unless you share it. Targets are estimates from your goal and body details, not medical advice.</p>`;
}

/** Pre-order the pick: a ticket, a pickup time, no queue. The kitchen cooks to the orders instead of guessing. */
function preorder(w, best) {
  const R = w.reserved, orders = 96 + (w.id.charCodeAt(1) * 13) % 40;
  if (R) return `<div class="vcard ticket"><div class="tk-top"><div><span class="tk-k">Pre-ordered</span><b>${LINES[R.line].name}${R.eggs ? ' + eggs' : ''}</b><small>Line ${R.line} · pick up at ${R.t}</small></div><div class="tk-code num">${R.code}</div></div>
    <div class="tk-cut" aria-hidden="true"></div>
    <div class="tk-bot"><span>Show this at the <b>express counter</b>. Your tray is scanned as usual.</span><button class="linkish" id="pre-cancel">Cancel</button></div></div>`;
  return `<div class="vcard pre"><h3>Pre-order this lunch <small>order by 11:30</small></h3>
    <p class="hint">Skip the queue. ${orders} people have pre-ordered today, so the kitchen cooks less extra.</p>
    <div class="pre-slots" role="radiogroup" aria-label="Pickup time">${SLOTS.map(t => `<button role="radio" data-slot="${t}" aria-checked="${(ui.slot || '12:30') === t}">${t}</button>`).join('')}</div>
    <button class="btn primary pre-go" id="pre-go">Reserve ${LINES[best.line].name}${best.set.some(t => t.id === 'eggs') ? ' + eggs' : ''}</button></div>`;
}
/** 3 pm: how is your energy? One tap, saved with today's lunch. */
function energyCard(w, R) {
  const cs = carbShare(R);
  if (R.energy) return `<div class="vcard energy done"><div class="en-h"><span class="bolt-big lv${R.energy}">${bolt(R.energy)}</span><div><b>${ENERGY[R.energy - 1]} at 3 pm</b><span>${cs > .5 ? `Lunch was ${pct(cs)} carbs. A lighter-carb lunch may help your afternoon.` : 'Saved. See how lunch and energy line up in your report.'}</span></div></div></div>`;
  return `<div class="vcard energy"><h3>3 pm check-in <small>how is your energy?</small></h3>
    <div class="en-opts">${ENERGY.map((e, i) => `<button data-energy="${i + 1}" class="lv${i + 1}">${bolt(i + 1)}<span>${e}</span></button>`).join('')}</div></div>`;
}
const bolt = lv => `<svg viewBox="0 0 24 30" aria-hidden="true"><rect x="3" y="4" width="18" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="1" width="6" height="3" rx="1" fill="currentColor"/><rect x="6" y="${25 - lv * 4}" width="12" height="${lv * 4}" rx="1.5" fill="currentColor"/></svg>`;
function energyWeek(log) {
  const avg = rs => rs.reduce((s, r) => s + energyOf(r), 0) / (rs.length || 1);
  const by = Object.keys(LINES).map(k => [k, log.filter(r => r.line === k)]).filter(x => x[1].length).map(([k, rs]) => [k, avg(rs)]).sort((a, b) => b[1] - a[1]);
  const gap = by.length > 1 ? by[0][1] - by[by.length - 1][1] : 0;
  return `<div class="vcard en-week"><h3>Lunch and your afternoon <small>3 pm energy</small></h3>
    <div class="en-cols">${log.map((r, i) => `<div style="--h:${energyOf(r) * 20}%;--d:${i * 70}ms" class="${REFINED[r.line] ? 'carby' : ''}"><em>${ENERGY[energyOf(r) - 1]}</em><div class="en-bar"><i></i></div><b>${r.day.slice(0, 3)}</b><small>${LINES[r.line].name.split(' ')[0]}</small></div>`).join('')}</div>
    <p class="hint">${gap >= .5 ? `Your 3 pm energy was best after ${LINES[by[0][0]].name.toLowerCase()} and lowest after ${LINES[by[by.length - 1][0]].name.toLowerCase()}. White rice and fried food make the afternoon dip worse.` : 'Your energy held steady this week. Keep the balance.'} ${log.some(r => r.energy == null) ? 'Days you didn’t check in are estimated from the lunch.' : ''}</p></div>`;
}
/** Teams compete on waste, anonymously. Joining is optional and only adds your trays to your team's total. */
function teamRace(w) {
  const rows = TEAMS.map(([t, r]) => [t, t === w.dept && w.team ? r + .02 : r]).sort((a, b) => b[1] - a[1]), max = rows[0][1];
  const mine = rows.findIndex(r => r[0] === w.dept) + 1;
  return `<div class="vcard race team"><div class="race-h"><div><h3>Team waste challenge <small>October</small></h3><p class="hint">Less food left than when each team started. The winners get a fruit box on Friday.</p></div></div>
    <div class="race-rows">${rows.map(([t, r], i) => `<div class="race-row ${t === w.dept ? 'us' : ''}" style="--w:${(r / max * 100).toFixed(1)}%;--d:${i * 80}ms"><span class="num">${i + 1}</span><b>${esc(t)}</b><div class="race-bar"><i></i></div><em class="num">−${pct(r)}</em></div>`).join('')}</div>
    <div class="race-foot"><p>${w.team ? `Your trays count for ${esc(w.dept)}, now #${mine}.` : `${esc(w.dept)} is #${mine}. Join to add your trays.`} Only team totals are shared, never names.</p>
      <button class="cheer" id="team-join" aria-pressed="${!!w.team}">${w.team ? 'Joined' : 'Join'}</button></div></div>`;
}
function wireWork(w, body) {
  $$('[data-slot]', body).forEach(b => b.onclick = () => { ui.slot = b.dataset.slot; $$('[data-slot]', body).forEach(x => x.setAttribute('aria-checked', String(x === b))); });
  const go = $('#pre-go', body);
  if (go) go.onclick = () => {
    const best = recommend(w)[0];
    w.reserved = { line: best.line, eggs: best.set.some(t => t.id === 'eggs'), t: ui.slot || '12:30', code: ticket(w, best.line) };
    PL.store.save('work'); PL.toast(`Reserved. Pick up at ${w.reserved.t} from the express counter.`);
  };
  const cancel = $('#pre-cancel', body); if (cancel) cancel.onclick = () => { w.reserved = null; PL.store.save('work'); PL.toast('Pre-order cancelled.'); };
  $$('[data-energy]', body).forEach(b => b.onclick = () => { todayRec(w).energy = +b.dataset.energy; PL.store.save('work'); });
  const tj = $('#team-join', body); if (tj) tj.onclick = () => { w.team = !w.team; PL.store.save('work'); if (w.team) PL.toast(`You joined for ${w.dept}. Only the team total is shared.`); };
}

/* ---------------------------------------------------------------- Goals: the personalised system */
function goals(w) {
  const t = targets(w);
  const seg = (id, opts, val) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${v === val}">${l}</button>`).join('')}</div>`;
  return `
  <h4 class="sec">My goal</h4>
  <div class="goal-grid">${Object.entries(GOALS).map(([k, G]) => `<button class="goal-opt ${k === w.goal ? 'on' : ''}" data-goal="${k}">${V.icon(GOAL_ICON[k], 'var(--indigo)')}<b>${G.name}</b><span>${G.blurb}</span></button>`).join('')}</div>
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
};
})();
