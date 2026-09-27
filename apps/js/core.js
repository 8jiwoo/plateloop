/* PlateLoop core: shared data, before/after scans, state store (synced across tabs and files),
   pixel pet + tray renderers. The four apps (model, scanner, kitchen, student) all use PL.store. */
(() => {
'use strict';
const PL = window.PL = { apps: {} };

/* ------------------------------------------------------------ utils */
const $ = PL.$ = (s, r = document) => r.querySelector(s);
PL.$$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = PL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
PL.pct = v => Math.round(v * 100) + '%';
PL.fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
PL.money = v => 'S$' + Math.round(v).toLocaleString('en-US');
PL.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
PL.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rng = PL.rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
PL.toast = msg => {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3600);
};

/* ------------------------------------------------------------ constants */
const MENU = PL.MENU = [
  { id: 'kailan', n: { c: .04, p: .03, f: .04 }, name: 'Stir-fried kailan', group: 'veg', g: { S: 30, M: 45, L: 60 }, kcal: .6, price: .009, color: '#3F7D32', edge: '#2A5A22', slot: [0, 0] },
  { id: 'cabbage', n: { c: .05, p: .012, f: .02 }, name: 'Braised cabbage', group: 'veg', g: { S: 25, M: 35, L: 45 }, kcal: .4, price: .004, color: '#D8E6A8', edge: '#9DB36A', slot: [1, 0] },
  { id: 'melon', n: { c: .08, p: .006, f: .002 }, name: 'Watermelon', group: 'fruit', g: { S: 50, M: 70, L: 90 }, kcal: .3, price: .004, color: '#F2545B', edge: '#B8323A', slot: [2, 0] },
  { id: 'rice', n: { c: .32, p: .03, f: .003 }, name: 'Brown rice mix', group: 'grain', g: { S: 170, M: 230, L: 290 }, kcal: 1.45, price: .0032, color: '#F3EDDA', edge: '#BFB28E', slot: [0, 1] },
  { id: 'chicken', n: { c: .03, p: .22, f: .08 }, name: 'Soy sauce chicken', group: 'protein', g: { S: 80, M: 115, L: 150 }, kcal: 1.75, price: .012, color: '#9C5A2E', edge: '#6B3A1A', slot: [1, 1] },
  { id: 'soup', n: { c: .04, p: .02, f: .01 }, name: 'ABC soup', group: 'soup', g: { S: 150, M: 200, L: 250 }, kcal: .3, price: .0021, color: '#E8A25C', edge: '#B8722F', slot: [2, 1] },
];
const DISH = PL.DISH = Object.fromEntries(MENU.map(d => [d.id, d]));
/* nutrition: per-lunch targets for a Secondary 3 student (illustrative, about a third of the daily need) */
PL.TARGET = { kcal: 700, c: 100, p: 30, f: 22 };
PL.NUTRIENTS = [['kcal', 'Calories', 'kcal'], ['c', 'Carbs', 'g'], ['p', 'Protein', 'g'], ['f', 'Fat', 'g']];
PL.nutrientsOf = grams => {
  const o = { kcal: 0, c: 0, p: 0, f: 0 };
  MENU.forEach(d => { const g = grams[d.id] || 0; o.kcal += g * d.kcal; o.c += g * d.n.c; o.p += g * d.n.p; o.f += g * d.n.f; });
  return { kcal: Math.round(o.kcal), c: Math.round(o.c), p: Math.round(o.p), f: Math.round(o.f) };
};
/** Nuvilab-style status for one nutrient against the lunch target. */
PL.nStatus = (k, v) => { const r = v / PL.TARGET[k]; return r < .8 ? 'low' : r > 1.3 ? 'high' : 'ok'; };
/* environment equivalents (illustrative factors: 2.5 kg CO2e per kg food, a pine tree absorbs ~6.6 kg CO2 a year, a car emits ~0.17 kg CO2 per km) */
PL.env = kg => { const co2 = kg * 2.5; return { kg, co2, trees: co2 / 6.6, km: co2 / .17 }; };
PL.CRAVING = 'kailan';
PL.SCHOOL = 'Harbourlight Secondary'; // fictional demo school
const TYPICAL_LEFT = PL.TYPICAL_LEFT = { kailan: .50, cabbage: .44, melon: .10, rice: .13, chicken: .05, soup: .38 };
PL.FORMS = {
  leafy: { name: 'Leafy', why: 'veggies tried', key: 'veg' },
  crystal: { name: 'Crystal', why: 'low-waste lunches', key: 'lowWaste' },
  guardian: { name: 'Guardian', why: 'balanced plates', key: 'balanced' },
  explorer: { name: 'Explorer', why: 'quests done', key: 'quests' },
};
const STAGES = PL.STAGES = [{ id: 'egg', name: 'Egg', at: 0 }, { id: 'baby', name: 'Baby', at: 40 }, { id: 'child', name: 'Child', at: 160 }, { id: 'adult', name: 'Adult', at: 400 }];
PL.SCHOOL_BASELINE = 0.29;
PL.CO2_PER_KG = 2.5; // illustrative kgCO2e per kg of food not wasted; swap for an EPA WARM / WRAP factor
PL.PRESETS = {
  'Picky eater': { rice: 70, chicken: 100, soup: 30, kailan: 0, cabbage: 10, melon: 100 },
  'Just right': { rice: 100, chicken: 100, soup: 85, kailan: 90, cabbage: 80, melon: 100 },
  'Tried everything': { rice: 95, chicken: 100, soup: 70, kailan: 60, cabbage: 55, melon: 100 },
  'Not hungry': { rice: 40, chicken: 60, soup: 20, kailan: 10, cabbage: 0, melon: 80 },
};

/* ------------------------------------------------------------ seed data */
const NAMED = [
  { id: 's1', name: 'Wei Ling', baseline: .24, xp: 262, c: { veg: 14, lowWaste: 9, balanced: 11, quests: 3 }, en: 72, nu: 80, jo: 66, streak: 3, book: ['crystal'], week: 168 },
  { id: 's2', name: 'Arjun', baseline: .38, xp: 96, c: { veg: 2, lowWaste: 5, balanced: 4, quests: 1 }, en: 48, nu: 42, jo: 55, streak: 1, book: [], week: 121 },
  { id: 's3', name: 'Aisyah', baseline: .19, xp: 455, c: { veg: 8, lowWaste: 22, balanced: 12, quests: 4 }, en: 88, nu: 70, jo: 81, streak: 9, book: ['leafy', 'guardian'], week: 204 },
  { id: 's4', name: 'Ethan', baseline: .41, xp: 24, c: { veg: 1, lowWaste: 1, balanced: 1, quests: 0 }, en: 35, nu: 40, jo: 50, streak: 0, book: [], week: 88 },
  { id: 's5', name: 'Mei Xin', baseline: .27, xp: 318, c: { veg: 6, lowWaste: 8, balanced: 9, quests: 7 }, en: 64, nu: 61, jo: 77, streak: 2, book: ['explorer'], week: 176 },
  { id: 's6', name: 'Daniel', baseline: .22, xp: 540, c: { veg: 9, lowWaste: 12, balanced: 21, quests: 3 }, en: 90, nu: 88, jo: 73, streak: 5, book: ['crystal', 'leafy'], week: 159 },
];
const EXTRA = ['Jun Hao', 'Nur Iman', 'Priya', 'Ryan', 'Zi Xuan', 'Hafiz', 'Kai Xin', 'Siti', 'Rohan', 'Chloe', 'Jia Hui', 'Irfan', 'Ananya', 'Marcus', 'Xin Yi', 'Farhan', 'Divya', 'Isaac', 'Hui Min', 'Adam', 'Sarah', 'Kavin'];
const CLASS_SEED = [
  { id: '3A', base: .30, served: 61.6, ret: 12.9, form: 'leafy', xp: 380, streak: 4 },
  { id: '3B', base: .31, served: 46.2, ret: 8.9, form: 'explorer', xp: 350, streak: 3 },
  { id: '3C', base: .27, served: 62.0, ret: 14.6, form: 'guardian', xp: 240, streak: 1 },
  { id: '3D', base: .33, served: 60.8, ret: 13.4, form: 'crystal', xp: 410, streak: 2 },
  { id: '3E', base: .29, served: 63.1, ret: 11.7, form: 'crystal', xp: 460, streak: 5 },
  { id: '3F', base: .26, served: 59.9, ret: 16.2, form: 'leafy', xp: 120, streak: 0 },
];
const SCHOOLS = [
  // fictional schools for the demo
  { id: 'maple', name: 'Maple Bay Secondary', red: .34, acc: .93, kg: 1510 },
  { id: 'orchid', name: 'Orchid Grove Secondary', red: .27, acc: .91, kg: 1122 },
  { id: 'sunbird', name: 'Sunbird Secondary', red: .22, acc: .89, kg: 864 },
  { id: 'kingfisher', name: 'Kingfisher Secondary', red: .19, acc: .90, kg: 1390 },
  { id: 'tembusu', name: 'Tembusu Hill Secondary', red: .12, acc: .86, kg: 402 },
];
const DAYS = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24'];

function seedLog(baseline, r) {
  return DAYS.map(d => {
    const w = clamp(baseline * (0.55 + r() * 0.7), 0.02, 0.6);
    const portion = r() < .3 ? 'S' : r() < .85 ? 'M' : 'L';
    const std = PL.nutrientsOf(Object.fromEntries(MENU.map(x => [x.id, x.g[portion]])));
    const k = 1 - w * (.8 + r() * .4);
    return { day: d, portion, w, pts: Math.round(22 + (baseline - w) / baseline * 14 + r() * 8), n: { kcal: Math.round(std.kcal * k), c: Math.round(std.c * k), p: Math.round(std.p * k * (.85 + r() * .3)), f: Math.round(std.f * k) } };
  }).reverse();
}
function freshState() {
  const r = rng(42);
  const dish = {};
  MENU.forEach(d => { const served = 140 * d.g.M * (0.92 + r() * .1); dish[d.id] = { served, ret: served * TYPICAL_LEFT[d.id] * (0.85 + r() * .25) }; });
  const students = NAMED.map(s => ({
    id: s.id, name: s.name, cls: '3B', baseline: s.baseline, week: s.week, scanned: false, named: true,
    pet: { xp: s.xp, c: { ...s.c }, en: s.en, nu: s.nu, jo: s.jo, streak: s.streak, book: [...s.book], quest: 1 }, log: seedLog(s.baseline, r),
  }));
  EXTRA.forEach((name, i) => {
    const baseline = .18 + r() * .24, xp = Math.round(20 + r() * 520);
    students.push({
      id: 'x' + i, name, cls: '3B', baseline, week: Math.round(70 + r() * 130), scanned: false, named: false,
      pet: { xp, c: { veg: Math.round(r() * 14), lowWaste: Math.round(r() * 16), balanced: Math.round(r() * 16), quests: Math.round(r() * 6) }, en: 40 + Math.round(r() * 50), nu: 40 + Math.round(r() * 50), jo: 40 + Math.round(r() * 50), streak: Math.floor(r() * 7), book: [], quest: Math.floor(r() * 3) },
      log: seedLog(baseline, r),
    });
  });
  return {
    v: 8,
    students,
    classes: CLASS_SEED.map(c => ({ ...c })),
    today: { trays: 140, zero: 17, co2: 11200, dish, servedNow: Object.fromEntries(MENU.map(d => [d.id, dish[d.id].served])), eating: 0, feed: [], clock: 11 * 60 + 48, trayNo: 412 },
    term: { kg: 1284, meals: 41210, zero: 6120 },
    zeroWeek: [.11, .14, .13, .16],
    order: { approved: null },
    me: 's1',
  };
}

/* ------------------------------------------------------------ store (localStorage + cross-tab sync) */
const KEY = 'plateloop-sg-v9';
const chan = 'BroadcastChannel' in window ? new BroadcastChannel('plateloop') : null;
const subs = new Set();
function readStored() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s || s.v !== 8) return null;
    if (s.today.co2 == null) s.today.co2 = 11200; // saves from before the live CO₂ counter
    return s;
  } catch (e) { return null; }
}
PL.S = readStored() || freshState();
PL.store = {
  save(kind = 'update') {
    try { localStorage.setItem(KEY, JSON.stringify(PL.S)); } catch (e) {}
    if (chan) chan.postMessage(kind);
    subs.forEach(fn => fn(kind, true));
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  reset() { PL.S = freshState(); this.save('reset'); },
};
const pull = kind => { const s = readStored(); if (s) { PL.S = s; subs.forEach(fn => fn(kind || 'update', false)); } };
// Both: BroadcastChannel is instant between tabs, and the storage event also covers pages opened as local files.
if (chan) chan.onmessage = e => pull(e.data);
addEventListener('storage', e => { if (e.key === KEY) pull('update'); });

/* ------------------------------------------------------------ lookups + leaderboards */
PL.student = id => PL.S.students.find(s => s.id === id);
PL.stageOf = xp => [...STAGES].reverse().find(s => xp >= s.at);
PL.nextStage = xp => STAGES.find(s => s.at > xp);
PL.formOf = pet => Object.entries({ leafy: pet.c.veg, crystal: pet.c.lowWaste, guardian: pet.c.balanced, explorer: pet.c.quests * 2 }).sort((a, b) => b[1] - a[1])[0][0];
PL.moodOf = pet => { const a = (pet.en + pet.nu + pet.jo) / 3; return a < 40 ? 'sleepy' : a < 62 ? 'happy' : 'joy'; };
PL.clock = () => { const m = Math.round(PL.S.today.clock); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
PL.classStats = c => { const w = c.ret / c.served; return { w, red: (c.base - w) / c.base }; };
PL.classRows = () => PL.S.classes.map(c => ({ c, ...PL.classStats(c) })).sort((a, b) => b.red - a.red);
PL.studentRows = () => [...PL.S.students].sort((a, b) => b.week - a.week || a.name.localeCompare(b.name));
PL.streakRows = () => [...PL.S.students].sort((a, b) => b.pet.streak - a.pet.streak || b.week - a.week);
PL.cls32Scanned = () => PL.S.students.filter(s => s.cls === '3B' && s.scanned).length;
PL.schoolRows = () => {
  const cr = PL.S.classes.map(PL.classStats);
  const us = { id: 'harbourlight', name: PL.SCHOOL, us: true, red: cr.reduce((a, c) => a + c.red, 0) / cr.length, acc: .93, kg: PL.S.term.kg };
  return [us, ...SCHOOLS].sort((a, b) => b.red - a.red);
};
PL.todayTotals = () => { let sv = 0, lf = 0, val = 0; MENU.forEach(d => { const x = PL.S.today.dish[d.id]; sv += x.served; lf += x.ret; val += x.ret * d.price; }); return { sv, lf, val, w: lf / sv }; };

/* ------------------------------------------------------------ one scanner, two scans per tray
   BEFORE lunch: the tray is weighed and photographed full, which records what was served.
   AFTER lunch: the same scanner measures what is left. eaten = before − after. */
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const STANDARD_M = Object.fromEntries(MENU.map(d => [d.id, d.g.M]));
PL.portionOf = served => { const r = sum(served) / sum(STANDARD_M); return r < .87 ? 'S' : r > 1.12 ? 'L' : 'M'; };
PL.scanState = st => st.scanned ? 'done' : st.before ? 'eating' : 'none';

function scoreMeal(st, served, measured, portion) {
  const pet = st.pet;
  const total = sum(served), left = sum(measured);
  const w = left / total;
  const improvement = (st.baseline - w) / st.baseline;
  let energy = clamp(Math.round(10 + 14 * improvement), 2, 25);
  const rightSized = portion === 'S' && w < .12;
  if (rightSized) energy = 25;
  const eaten = id => 1 - measured[id] / served[id];
  const groups = ['grain', 'protein', 'veg', 'fruit'].filter(g => MENU.some(d => d.group === g && eaten(d.id) >= .5));
  const nutrition = groups.length * 5;
  const vegTried = MENU.some(d => d.group === 'veg' && eaten(d.id) >= .5);
  const tasted = eaten(PL.CRAVING) >= .2;
  const questDone = tasted && pet.quest < 3;
  const lowWaste = w < .15;
  const streak = lowWaste ? pet.streak + 1 : 0;
  const joy = 4 + (streak >= 3 ? 6 : 0) + (questDone ? 15 : 0);
  const xp = energy + nutrition + joy;
  const mood = w < .12 ? 'joy' : w < .3 ? 'happy' : 'meh';
  let line;
  if (rightSized) line = 'Perfect portion! A small plate, all eaten. Full energy for me!';
  else if (questDone) line = `You tasted the ${DISH[PL.CRAVING].name.toLowerCase()}! Quest ${pet.quest + 1} of 3 done!`;
  else if (improvement > .3) line = 'Way less left than usual. I feel super strong!';
  else if (w < .3) line = 'Yum, thanks for lunch! Nice job.';
  else line = 'Lots came back today. Take a smaller portion tomorrow and I still get full energy!';
  return { w, served: total, left, improvement, energy, nutrition, joy, xp, groups, vegTried, questDone, lowWaste, streak, mood, line, rightSized };
}

/** BEFORE lunch. portion: what the kitchen served (S/M/L); the scanner measures the real grams.
 *  pick (optional): dish id → serving multiplier, when the student asked for less or more of a dish. */
PL.scanBefore = (sid, portion, method = 'face', pick = null) => {
  const st = PL.student(sid), T = PL.S.today;
  const served = Object.fromEntries(MENU.map(d => [d.id, Math.max(1, Math.round(d.g[portion] * (pick && pick[d.id] || 1) * (.94 + Math.random() * .12)))]));
  const tray = ++T.trayNo;
  T.clock += .2;
  st.before = { served, t: PL.clock(), tray, method };
  MENU.forEach(d => { T.servedNow[d.id] += served[d.id]; });
  T.eating += 1;
  const total = sum(served);
  T.feed.unshift({ kind: 'before', t: PL.clock(), tray, cls: st.cls, sid, method, portion: PL.portionOf(served), served: total });
  T.feed = T.feed.slice(0, 60);
  PL.S.lastScan = { sid, at: Date.now(), kind: 'before' };
  return { served, total, n: PL.nutrientsOf(served), kcal: PL.nutrientsOf(served).kcal, portion: PL.portionOf(served), tray, method };
};

/** AFTER lunch. eatPct: dish id → % eaten (0–100). Without a before scan the standard portion is assumed. */
PL.scanAfter = (sid, eatPct, method = 'face') => {
  const st = PL.student(sid), pet = st.pet, T = PL.S.today;
  const clsRankBefore = PL.classRows().findIndex(r => r.c.id === st.cls) + 1;
  const meRankBefore = PL.studentRows().findIndex(s => s.id === sid) + 1;
  let served = st.before && st.before.served, estimated = false, tray = st.before && st.before.tray;
  if (!served) { served = { ...STANDARD_M }; estimated = true; tray = ++T.trayNo; MENU.forEach(d => { T.servedNow[d.id] += served[d.id]; }); }
  else T.eating = Math.max(0, T.eating - 1);
  const portion = PL.portionOf(served);
  const measured = Object.fromEntries(MENU.map(d => {
    const g = served[d.id], tru = g * (1 - eatPct[d.id] / 100);
    return [d.id, tru < 1 ? 0 : clamp(tru + (Math.random() * 4 - 2), 0, g)];
  }));
  const r = scoreMeal(st, served, measured, portion);
  pet.xp += r.xp;
  pet.en = clamp(Math.round(pet.en * .55 + r.energy * 4 * .45), 5, 100);
  pet.nu = clamp(Math.round(pet.nu * .55 + r.nutrition * 5 * .45), 5, 100);
  pet.jo = clamp(Math.round(pet.jo * .6 + (40 + r.joy * 3) * .4), 5, 100);
  pet.streak = r.streak;
  if (r.vegTried) pet.c.veg++;
  if (r.lowWaste) pet.c.lowWaste++;
  if (r.groups.length >= 3) pet.c.balanced++;
  if (r.questDone) { pet.c.quests++; pet.quest++; }
  st.week += r.xp;
  st.scanned = true;
  r.intake = PL.nutrientsOf(Object.fromEntries(MENU.map(d => [d.id, served[d.id] - measured[d.id]])));
  r.zero = r.w < .05;
  // CO₂e avoided on this tray compared with the student's usual leftovers, in grams (shown live to the student)
  r.co2 = Math.round(Math.max(0, st.baseline * r.served - r.left) / 1000 * PL.CO2_PER_KG * 1000);
  T.co2 = (T.co2 || 0) + r.co2;
  if (r.zero) { T.zero = (T.zero || 0) + 1; PL.S.term.zero = (PL.S.term.zero || 0) + 1; }
  st.after = { t: (T.clock += .35, PL.clock()), left: r.left, w: r.w, intake: r.intake, zero: r.zero, served, measured, co2: r.co2 };
  st.log.unshift({ day: 'Fri 25', portion, w: r.w, pts: r.xp, n: r.intake });
  st.log = st.log.slice(0, 6);
  r.servedBy = served; r.measured = measured;
  r.game = PL.game ? PL.game.feedLunch(st, r) : null; // Loopi's hunger, hearts and the plate in its bowl
  // completed trays feed the kitchen's waste numbers and the class league
  MENU.forEach(d => { T.dish[d.id].served += served[d.id]; T.dish[d.id].ret += measured[d.id]; });
  T.trays++;
  const c = PL.S.classes.find(c => c.id === st.cls);
  c.served += r.served / 1000; c.ret += r.left / 1000; c.xp += Math.max(2, Math.round((c.base - r.w) * 40));
  PL.S.term.meals++;
  PL.S.term.kg += Math.max(0, r.served / 1000 * (PL.SCHOOL_BASELINE - r.w));
  T.feed.unshift({ kind: 'after', t: PL.clock(), tray, cls: st.cls, sid, method, portion, w: r.w, xp: r.xp, served: r.served, left: r.left, estimated, zero: r.zero, kcal: r.intake.kcal });
  T.feed = T.feed.slice(0, 60);
  Object.assign(r, { clsRank: PL.classRows().findIndex(x => x.c.id === st.cls) + 1, clsRankBefore, meRank: PL.studentRows().findIndex(s => s.id === sid) + 1, meRankBefore, measured, portion, sid, tray, estimated });
  PL.S.lastScan = { sid, at: Date.now(), kind: 'after', xp: r.xp, line: r.line };
  return r;
};
/** Both scans in one go (used to simulate the rest of the class). */
PL.scanTray = (sid, portion, eatPct) => { if (!PL.student(sid).before) PL.scanBefore(sid, portion); return PL.scanAfter(sid, eatPct); };
PL.zeroRate = () => { const t = PL.S.today; return t.trays ? t.zero / t.trays : 0; };
/** Simulate everyone in class 3B who hasn't finished both scans yet. */
PL.scanRestOfClass = () => {
  let n = 0;
  PL.S.students.filter(s => s.cls === '3B' && !s.scanned).forEach(s => {
    const p = Math.random() < .3 ? 'S' : Math.random() < .8 ? 'M' : 'L';
    const f = (s.baseline / .3) * (.5 + Math.random() * .6);
    PL.scanTray(s.id, p, Object.fromEntries(MENU.map(d => [d.id, Math.round(clamp(1 - TYPICAL_LEFT[d.id] * f, 0, 1) * 100)])));
    n++;
  });
  return n;
};

/* ------------------------------------------------------------ any element with data-reset restarts the demo lunch */
document.addEventListener('click', e => { if (e.target.closest('[data-reset]')) { PL.store.reset(); PL.toast('Demo reset to the start of lunch.'); } });

/* ------------------------------------------------------------ pixel pet renderer (LCD style) */
const LCD = PL.LCD = { bg: '#DDE4D4', ink: '#1D1D1F', mid: '#9AA592' };
const ACC_SLOT = { cap: 'head', crown: 'head', halo: 'head', headphones: 'head', bow: 'side', flower: 'side', glasses: 'face', scarf: 'neck', wings: 'back', aura: 'aura' };
PL.drawPet = (cv, o) => {
  // o.ink / o.mid recolour the outline and shading; o.fill paints the body (for the full-colour room)
  const INK = o.ink || LCD.ink, MID = o.mid || LCD.mid, FILL = o.fill || null;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.imageSmoothingEnabled = false;
  if (o.bg === 'none') ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = o.bg || LCD.bg; ctx.fillRect(0, 0, W, H); }
  const rows = o.rows || 30;
  const u = Math.max(1, Math.floor(H / rows));
  const cols = Math.floor(W / u);
  const ox = Math.floor((W - cols * u) / 2), oy = Math.floor((H - rows * u) / 2);
  const P = (x, y, c = INK) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= cols || y >= rows) return; ctx.fillStyle = c; ctx.fillRect(ox + x * u, oy + y * u, u, u); };
  const t = o.t || 0, cx = cols / 2, ground = rows - 4;
  if (!o.noGround) for (let x = 2; x < cols - 2; x += 2) P(x, ground + 1, MID);
  const ell = (ecx, ecy, rx, ry, dither = true) => {
    const inside = (x, y) => ((x + .5 - ecx) / rx) ** 2 + ((y + .5 - ecy) / ry) ** 2 <= 1;
    for (let y = Math.floor(ecy - ry - 1); y <= Math.ceil(ecy + ry + 1); y++)
      for (let x = Math.floor(ecx - rx - 1); x <= Math.ceil(ecx + rx + 1); x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        if (edge) P(x, y); else { if (FILL) P(x, y, FILL); if ((dither || FILL) && y > ecy + ry * .35 && (x + y) % 2 === 0) P(x, y, MID); }
      }
  };
  if (o.stage === 'egg') {
    const wob = t % 4 === 1 ? 1 : t % 4 === 3 ? -1 : 0, ex = cx + wob, ery = 8.5, ey = ground - ery;
    ell(ex, ey, 6.5, ery, false);
    [[-2, -3], [2, -1], [-1, 2], [3, 3], [0, -6]].forEach(([dx, dy]) => { P(ex + dx - .5, ey + dy, MID); P(ex + dx + .5, ey + dy, MID); });
    if ((o.progress || 0) > .6) [[-3, -1], [-2, 0], [-1, -1], [0, 0], [1, -1], [2, 0]].forEach(([dx, dy]) => P(ex + dx, ey + dy - 1));
    return;
  }
  const [rx, ry] = { baby: [5, 4.2], child: [7, 5.8], adult: [8.8, 7.2] }[o.stage];
  const bob = (t % 2) ? 1 : 0;
  const by = ground - ry - (o.stage === 'baby' ? 0 : 1.5) - bob;
  ell(cx, by, rx, ry);
  if (o.stage !== 'baby') { P(cx - 3, ground); P(cx - 2, ground); P(cx + 2, ground); P(cx + 3, ground); P(cx - 3, ground - 1); P(cx + 3, ground - 1); }
  if (o.stage === 'adult') { const wave = t % 2 ? -1 : 0; P(cx - rx - 1, by + 1 + wave); P(cx - rx - 2, by + wave); P(cx + rx + 1, by + 1); P(cx + rx + 2, by + 2); }
  const ex = Math.round(rx * .42), ey = Math.round(by - ry * .15), blink = t % 9 === 0;
  const eye = x => {
    const m = o.mood;
    if (m === 'sleepy' || blink) { P(x - 1, ey); P(x, ey); P(x + 1, ey); }
    else if (m === 'joy') { P(x - 1, ey + 1); P(x, ey); P(x + 1, ey + 1); }
    else if (m === 'meh') { P(x, ey); P(x, ey + 1); }
    else { P(x, ey); P(x + 1, ey); P(x, ey + 1); P(x + 1, ey + 1); }
  };
  eye(Math.round(cx - ex - .5)); eye(Math.round(cx + ex - .5));
  const my = ey + 3, mx = Math.round(cx - .5);
  if (o.mood === 'joy') { for (let i = -2; i <= 2; i++) P(mx + i, my); P(mx - 1, my + 1); P(mx, my + 1); P(mx + 1, my + 1); P(Math.round(cx - ex - 2.5), my - 1, MID); P(Math.round(cx + ex + 1.5), my - 1, MID); }
  else if (o.mood === 'happy') { P(mx - 2, my); P(mx + 2, my); P(mx - 1, my + 1); P(mx, my + 1); P(mx + 1, my + 1); }
  else if (o.mood === 'meh') { P(mx - 1, my + 1); P(mx, my + 1); P(mx + 1, my + 1); }
  else P(mx, my + 1);
  if (o.mood === 'sleepy') { const zx = cx + rx + 1, zy = by - ry - 2 - (t % 3); [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]].forEach(([a, b]) => P(zx + a, zy + b)); }
  const top = Math.round(by - ry), f = o.form, full = o.stage === 'adult';
  const headAcc = ACC_SLOT[o.acc] === 'head';
  const drawAcc = () => {
    const a = o.acc, xc = cx - .5, I = INK, M = MID;
    if (!a) return;
    if (a === 'cap') { for (let x = -3; x <= 3; x++) P(xc + x, top - 1); for (let x = -2; x <= 2; x++) P(xc + x, top - 2, Math.abs(x) === 2 ? I : M); for (let x = -1; x <= 1; x++) P(xc + x, top - 3); P(xc + 4, top - 1); P(xc + 5, top - 1); }
    else if (a === 'crown') { for (let x = -3; x <= 3; x++) { P(xc + x, top - 1); P(xc + x, top - 2, Math.abs(x) === 3 || x === 0 ? I : M); } [-3, 0, 3].forEach(x => P(xc + x, top - 3)); P(xc, top - 4); }
    else if (a === 'halo') { const y0 = top - 4; for (let x = -2; x <= 2; x++) { P(xc + x, y0 - 1); P(xc + x, y0 + 1); } P(xc - 3, y0); P(xc + 3, y0); if (t % 2) P(xc + 4, y0 - 2, M); }
    else if (a === 'headphones') { for (let k = 0; k <= 16; k++) { const ang = Math.PI * (.12 + .76 * k / 16); P(cx + Math.cos(ang) * (rx + 1) - .5, by - Math.sin(ang) * (ry + 1)); } [-1, 1].forEach(s => { const x0 = Math.round(cx + s * (rx + 1) - .5); for (let y = -1; y <= 1; y++) { P(x0, ey + y); P(x0 - s, ey + y, M); } }); }
    else if (a === 'bow') { const bx = Math.round(cx + rx * .55), y0 = top + 1; P(bx, y0, M); [-1, -2, 1, 2].forEach(dx => { P(bx + dx, y0 - 1); P(bx + dx, y0 + 1); if (Math.abs(dx) === 2) P(bx + dx, y0); }); }
    else if (a === 'flower') { const fx = Math.round(cx - rx * .55), fy = top + 1; P(fx, fy, M); P(fx, fy - 1); P(fx, fy + 1); P(fx - 1, fy); P(fx + 1, fy); }
    else if (a === 'glasses') { const xs = [Math.round(cx - ex - .5), Math.round(cx + ex - .5)]; xs.forEach(x0 => { for (let x = -2; x <= 2; x++) { P(x0 + x, ey - 1); P(x0 + x, ey + 2); } P(x0 - 2, ey); P(x0 - 2, ey + 1); P(x0 + 2, ey); P(x0 + 2, ey + 1); }); for (let x = xs[0] + 3; x <= xs[1] - 3; x++) P(x, ey); }
    else if (a === 'scarf') { const y = Math.round(by + ry * .3); for (let x = Math.round(cx - rx * .85); x <= Math.round(cx + rx * .85); x++) { P(x, y); P(x, y + 1, M); } P(xc + 3, y + 2); P(xc + 3, y + 3); P(xc + 4, y + 3, M); }
    else if (a === 'wings') { const flap = t % 2; [-1, 1].forEach(s => [[0, 0, M], [1, -1, M], [1, 0, M], [2, -2, I], [2, -1, M], [2, 0, I], [1, 1, I], [3, -2, I]].forEach(([dx, dy, c]) => P(cx + s * (rx + 1 + dx) - .5, by - 1 + dy - flap, c))); }
    else if (a === 'aura') { for (let k = 0; k < 4; k++) { const ang = t * .6 + k * Math.PI / 2, x0 = Math.round(cx + Math.cos(ang) * (rx + 3) - .5), y0 = Math.round(by + Math.sin(ang) * (ry + 1)); P(x0, y0); if ((t + k) % 2) { P(x0 - 1, y0, M); P(x0 + 1, y0, M); P(x0, y0 - 1, M); P(x0, y0 + 1, M); } } }
  };
  if (o.stage === 'baby') { if (!headAcc) { P(cx - .5, top - 1); P(cx - .5, top - 2); } drawAcc(); return; }
  if (headAcc && f !== 'guardian') { /* hats and crowns replace the form's head decoration */ }
  else if (f === 'leafy') {
    P(cx - .5, top - 1); P(cx - .5, top - 2);
    [[-1, -3], [-2, -3], [-3, -4], [-2, -4], [-4, -5], [-3, -5], [-2, -5]].forEach(([a, b]) => { P(cx - .5 + a, top + b); P(cx - .5 - a, top + b + (full ? 0 : 1)); });
    if (full) [[-3, 2], [3, 3], [-1, 4]].forEach(([a, b]) => P(cx + a, by + b, MID));
  } else if (f === 'crystal') {
    const h = full ? 3 : 2;
    for (let i = 0; i <= h; i++) for (let j = -i; j <= i; j++) P(cx - .5 + j, top - 1 - (2 * h - i), Math.abs(j) === i ? INK : MID);
    for (let i = h - 1; i >= 0; i--) for (let j = -i; j <= i; j++) P(cx - .5 + j, top - 1 - i, Math.abs(j) === i ? INK : MID);
    if (full && t % 2 === 0) [[-rx - 3, -ry], [rx + 2, -ry + 2]].forEach(([a, b]) => { P(cx + a, by + b); P(cx + a - 1, by + b); P(cx + a + 1, by + b); P(cx + a, by + b - 1); P(cx + a, by + b + 1); });
  } else if (f === 'guardian') {
    const yb = Math.round(by - ry * .62);
    for (let x = Math.round(cx - rx * .8); x <= Math.round(cx + rx * .8); x++) P(x, yb);
    P(cx - .5, yb - 1); P(cx - .5, yb - 2);
    if (full) { const sx = Math.round(cx + rx + 1), sy = Math.round(by - 1); for (let y = 0; y < 5; y++) { P(sx, sy + y); P(sx + 3, sy + y); } for (let x = 0; x <= 3; x++) P(sx + x, sy); P(sx + 1, sy + 5); P(sx + 2, sy + 5); P(sx + 1, sy + 2, MID); P(sx + 2, sy + 2, MID); }
  } else if (f === 'explorer') {
    const w = Math.round(rx * (full ? .95 : .7));
    for (let x = -w; x <= w; x++) P(cx - .5 + x, top);
    for (let x = -2; x <= 2; x++) { P(cx - .5 + x, top - 1); P(cx - .5 + x, top - 2, x === -2 || x === 2 ? INK : MID); }
    for (let x = -2; x <= 2; x++) P(cx - .5 + x, top - 3);
    if (full) { const bx = Math.round(cx - rx - 3), byy = Math.round(by - 2); for (let y = 0; y < 5; y++) { P(bx, byy + y); P(bx + 2, byy + y); } P(bx + 1, byy); P(bx + 1, byy + 4); P(bx + 1, byy + 2, MID); }
  }
  drawAcc();
};
/** A small canvas showing a student's (or class's) current pet. */
PL.petCanvas = (w, h, o) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; PL.drawPet(cv, { rows: 30, ...o }); return cv; };
/** A student's Loopi stage comes from the game (hearts → evolve); before game.js loads, fall back to XP. */
PL.stuStage = st => st.game ? STAGES[st.game.stage] : PL.stageOf(st.pet.xp);
PL.petOf = st => {
  const g = st.game;
  const mood = g && g.hunger === 0 ? 'sleepy' : PL.moodOf(st.pet);
  return { stage: PL.stuStage(st).id, form: PL.formOf(st.pet), mood, progress: g ? g.hearts / Math.max(1, (PL.game ? PL.game.heartsReq(g) : 3)) : st.pet.xp / 40, acc: g ? g.eq : null };
};
/** Replace every <canvas data-pet="sid"> / data-cls="id"> inside root with a drawn pet. */
PL.paintPets = (root, t = 0) => {
  PL.$$('canvas[data-pet]', root).forEach(cv => { const st = PL.student(cv.dataset.pet); if (st) PL.drawPet(cv, { rows: 30, t, ...PL.petOf(st) }); });
  PL.$$('canvas[data-cls]', root).forEach(cv => { const c = PL.S.classes.find(c => c.id === cv.dataset.cls); if (c) PL.drawPet(cv, { rows: 30, t, stage: PL.stageOf(c.xp).id, form: c.form, mood: PL.classStats(c).red > .25 ? 'joy' : 'happy' }); });
  PL.$$('canvas[data-form]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, stage: cv.dataset.stage || 'adult', form: cv.dataset.form, mood: 'happy' }));
};
PL.lcdText = (cv, lines) => {
  const ctx = cv.getContext('2d');
  ctx.fillStyle = LCD.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = LCD.ink; ctx.textBaseline = 'top';
  let y = 10;
  lines.forEach(l => {
    if (l.bar != null) {
      ctx.font = '10px Silkscreen, monospace'; ctx.fillText(l.label, 10, y + 1);
      ctx.strokeStyle = LCD.ink; ctx.lineWidth = 2; ctx.strokeRect(58, y, cv.width - 70, 11);
      ctx.fillRect(61, y + 3, Math.round((cv.width - 76) * l.bar / 100), 5);
      y += 22;
    } else { ctx.font = (l.size || 11) + 'px Silkscreen, monospace'; ctx.fillText(l.text, 10, y); y += (l.size || 11) + 8; }
  });
};

/* ------------------------------------------------------------ tray (top view SVG) */
const CELL = { x: [22, 144, 266], w: 112, y: [22, 138], h: [106, 140] };
const PORTION_F = { S: .74, M: 1, L: 1.18 };
function blobPath(cx, cy, rx, ry, seed) {
  const n = 14, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = 1 + .09 * Math.sin(3 * a + seed) + .06 * Math.sin(5 * a + seed * 2.3); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    if (i === 0) d += `M${((p[0] + q[0]) / 2).toFixed(1)},${((p[1] + q[1]) / 2).toFixed(1)}`;
    const nx = pts[(i + 1) % n], nn = pts[(i + 2) % n];
    d += ` Q${nx[0].toFixed(1)},${nx[1].toFixed(1)} ${((nx[0] + nn[0]) / 2).toFixed(1)},${((nx[1] + nn[1]) / 2).toFixed(1)}`;
  }
  return d + 'Z';
}
PL.traySVG = ({ portion = 'M', left = null, scanning = false, labels = null, empty = false, id = 'tg' }) => {
  let s = `<svg viewBox="0 0 400 300" role="img" aria-label="Lunch tray, top view"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--steel-2)"/><stop offset="1" stop-color="var(--steel)"/></linearGradient></defs>`;
  s += `<rect x="6" y="6" width="388" height="288" rx="22" fill="url(#${id})" stroke="var(--steel-edge)" stroke-width="2"/>`;
  MENU.forEach(d => { const [ci, ri] = d.slot; s += `<rect x="${CELL.x[ci]}" y="${CELL.y[ri]}" width="${CELL.w}" height="${CELL.h[ri]}" rx="14" fill="var(--steel-2)" stroke="var(--steel-edge)" stroke-width="1.5"/>`; });
  if (!empty) MENU.forEach((d, i) => {
    const [ci, ri] = d.slot, cx = CELL.x[ci] + CELL.w / 2, cy = CELL.y[ri] + CELL.h[ri] / 2;
    const frac = (left ? left[d.id] : 1) * PORTION_F[portion];
    if (frac <= 0.01) return;
    const k = Math.sqrt(frac);
    if (d.id === 'soup') {
      s += `<circle cx="${cx}" cy="${cy}" r="46" fill="#F7F7F2" stroke="var(--steel-edge)" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${(38 * Math.min(1, k)).toFixed(1)}" fill="${d.color}"/>`;
      s += `<circle cx="${cx - 10}" cy="${cy - 8}" r="${(5 * k).toFixed(1)}" fill="#E7C08A" opacity=".8"/><circle cx="${cx + 12}" cy="${cy + 6}" r="${(4 * k).toFixed(1)}" fill="#6E8F3A" opacity=".8"/>`;
    } else {
      const rx = CELL.w * .36 * k, ry = CELL.h[ri] * .33 * k;
      s += `<path d="${blobPath(cx, cy, Math.min(rx, CELL.w * .45), Math.min(ry, CELL.h[ri] * .44), i * 1.7)}" fill="${d.color}" stroke="${d.edge}" stroke-width="1.5"/>`;
      if (d.id === 'rice') for (let j = 0; j < 14; j++) { const a = j * 2.4, rr = (j % 5) / 5 * .8; s += `<ellipse cx="${(cx + Math.cos(a) * rx * rr).toFixed(1)}" cy="${(cy + Math.sin(a) * ry * rr).toFixed(1)}" rx="2.2" ry="1.3" fill="#8C6B4A" opacity=".5"/>`; }
      if (d.id === 'cabbage' || d.id === 'chicken' || d.id === 'kailan') for (let j = 0; j < 5; j++) { const a = j * 1.9 + i; s += `<ellipse cx="${(cx + Math.cos(a) * rx * .45).toFixed(1)}" cy="${(cy + Math.sin(a) * ry * .45).toFixed(1)}" rx="${(6 * k).toFixed(1)}" ry="${(3 * k).toFixed(1)}" fill="${d.edge}" opacity=".55" transform="rotate(${j * 40} ${cx} ${cy})"/>`; }
      if (d.id === 'melon') for (let j = 0; j < 6; j++) s += `<ellipse cx="${(cx - 20 + (j % 3) * 20).toFixed(1)}" cy="${(cy - 8 * k + Math.floor(j / 3) * 16 * k).toFixed(1)}" rx="2" ry="3" fill="#2B2B2E" opacity=".8"/>`;
    }
  });
  if (labels) MENU.forEach(d => {
    const [ci, ri] = d.slot, x = CELL.x[ci] + 4, y = CELL.y[ri] + 4, w = CELL.w - 8, h = CELL.h[ri] - 8, txt = `${labels[d.id]} g left`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="var(--mint)" stroke-width="2" stroke-dasharray="6 4"/>`;
    s += `<rect x="${x + 6}" y="${y + h - 24}" width="${Math.min(w - 12, 12 + txt.length * 6.3)}" height="18" rx="9" fill="var(--ink)"/><text class="det-label" x="${x + 13}" y="${y + h - 11}" fill="var(--ground)">${txt}</text>`;
  });
  if (scanning) s += `<g class="scanline"><rect x="10" y="10" width="380" height="4" fill="var(--mint)"/><rect x="10" y="14" width="380" height="22" fill="var(--mint)" opacity=".15"/></g>`;
  return s + '</svg>';
};

/* ------------------------------------------------------------ shared UI bits */
PL.rankDelta = (before, after) => after < before ? `<span class="up">▲ ${before - after}</span>` : '';
PL.icons = {
  back: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  loop: '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="var(--mint)" stroke-width="4"/><path d="M16 3a13 13 0 0 1 13 13" fill="none" stroke="var(--persim)" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="16" r="5" fill="currentColor"/></svg>',
};
PL.backLink = (label = 'All apps') => `<a class="backlink" href="#home">${PL.icons.back}<span>${label}</span></a>`;
})();
