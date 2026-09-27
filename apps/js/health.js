/* PlateLoop beyond schools: hospital wards and kindergartens. The same scanner pairs each person by face,
   scans the tray before and after the meal, and turns the difference into a personal healthcare report:
   what they ate, their nutrient intake against their own targets, and their eating habits over time.
   This file holds the menus, the demo people, the meal scan and the report building blocks.
   Loopi Care (js/care.js) and Loopi Kids (js/kids.js) draw on it. */
(() => {
'use strict';
const { clamp, rng, esc, pct } = PL;
const H = PL.health = {};

/* ---------------------------------------------------------------- menus (nutrients per gram; na = sodium mg per gram) */
const dish = (id, name, g, n, color, edge, group, extra) => ({ id, name, g, n, color, edge, group, ...extra });
H.WARD_MENU = {
  breakfast: [
    dish('h_congee', 'Chicken congee', 300, { kcal: .46, c: .10, p: .012, f: .002, na: 1.1 }, '#F3EDDA', '#BFB28E', 'grain'),
    dish('h_egg', 'Steamed egg', 70, { kcal: 1.3, c: .01, p: .11, f: .09, na: 2.4 }, '#F6D365', '#C9A13B', 'protein'),
    dish('h_spinach', 'Stir-fried spinach', 40, { kcal: .55, c: .04, p: .03, f: .035, na: 3.5 }, '#3F7D32', '#2A5A22', 'veg'),
    dish('h_milk', 'Milk', 200, { kcal: .64, c: .05, p: .033, f: .035, na: .4 }, '#FFFFFF', '#C7C7CC', 'dairy'),
    dish('h_banana', 'Banana', 100, { kcal: .89, c: .23, p: .011, f: .003, na: 0 }, '#F7DC6F', '#C9A13B', 'fruit'),
  ],
  lunch: [
    dish('h_rice', 'Brown rice', 210, { kcal: 1.45, c: .32, p: .03, f: .003, na: 0 }, '#F3EDDA', '#BFB28E', 'grain'),
    dish('h_fish', 'Steamed fish with ginger', 100, { kcal: 1.4, c: .01, p: .2, f: .065, na: 1.5 }, '#EDE3D1', '#B8A88A', 'protein'),
    dish('h_vegsoup', 'Clear vegetable soup', 200, { kcal: .15, c: .01, p: .012, f: .005, na: 3.0 }, '#EFE6C4', '#BFB28E', 'soup'),
    dish('h_kailan', 'Stir-fried kailan', 50, { kcal: 1.0, c: .05, p: .03, f: .03, na: 3.2 }, '#5E9E3A', '#3B6E22', 'veg'),
    dish('h_papaya', 'Papaya', 80, { kcal: .43, c: .11, p: .005, f: .003, na: 0 }, '#F6A24B', '#C4731F', 'fruit'),
  ],
  dinner: [
    dish('h_rice2', 'Brown rice', 210, { kcal: 1.45, c: .32, p: .03, f: .003, na: 0 }, '#F3EDDA', '#BFB28E', 'grain'),
    dish('h_chicken', 'Braised chicken and potato', 150, { kcal: 1.5, c: .08, p: .20, f: .06, na: 3.2 }, '#B5652D', '#7A3F17', 'protein'),
    dish('h_tofu', 'Pan-fried tofu', 80, { kcal: 1.9, c: .03, p: .09, f: .13, na: .2 }, '#F4E7C8', '#C9B48A', 'protein'),
    dish('h_lotus', 'Lotus root soup', 200, { kcal: .35, c: .05, p: .02, f: .01, na: 3.2 }, '#D9B98C', '#A0845A', 'soup'),
    dish('h_longbean', 'Stir-fried long beans', 50, { kcal: .8, c: .04, p: .015, f: .03, na: 2.6 }, '#9CC56B', '#6A9440', 'veg'),
  ],
};
H.MEALS = [['breakfast', 'Breakfast', '07:50'], ['lunch', 'Lunch', '12:10'], ['dinner', 'Dinner', '17:40']];
/* each diet sets daily targets and changes what's served (portion multipliers, low-salt cooking) */
H.DIETS = {
  regular: { name: 'Regular', target: { kcal: 1900, p: 70, c: 240, f: 55, na: 2000 }, mult: {}, na: 1, note: 'No restrictions.' },
  diabetic: { name: 'Diabetic', target: { kcal: 1600, p: 70, c: 180, f: 50, na: 2000 }, mult: { h_congee: .8, h_rice: .8, h_rice2: .8, h_papaya: .7, h_banana: .6 }, na: 1, note: 'Smaller rice and fruit portions to keep carbs steady.' },
  lowna: { name: 'Low sodium', target: { kcal: 1800, p: 70, c: 230, f: 55, na: 1500 }, mult: {}, na: .55, note: 'Soups and side dishes are cooked with about half the salt.' },
  protein: { name: 'High protein', target: { kcal: 2100, p: 110, c: 240, f: 65, na: 2000 }, mult: { h_egg: 1.5, h_fish: 1.4, h_chicken: 1.4, h_tofu: 1.5, h_milk: 1.25 }, na: 1, note: 'Extra egg, fish, chicken, tofu and milk to help healing.' },
};
H.KIDS_MENU = [
  dish('k_rice', 'Rice', 120, { kcal: 1.45, c: .32, p: .03, f: .003 }, '#F3EDDA', '#BFB28E', 'grain', { rainbow: 'white' }),
  dish('k_chicken', 'Soy sauce chicken', 50, { kcal: 1.75, c: .03, p: .22, f: .08 }, '#9C5A2E', '#6B3A1A', 'protein', { rainbow: 'brown' }),
  dish('k_broccoli', 'Broccoli', 30, { kcal: .34, c: .07, p: .028, f: .004 }, '#4C9A2A', '#2F6B18', 'veg', { rainbow: 'green' }),
  dish('k_corn', 'Corn and egg soup', 150, { kcal: .5, c: .07, p: .025, f: .015 }, '#F4C542', '#C99A1B', 'soup', { rainbow: 'yellow', allergen: 'Egg', safe: 'Corn soup without egg' }),
  dish('k_tomato', 'Cherry tomatoes', 40, { kcal: .18, c: .04, p: .009, f: .002 }, '#E0453A', '#A52A20', 'veg', { rainbow: 'red' }),
  dish('k_dragon', 'Dragon fruit', 40, { kcal: .5, c: .11, p: .012, f: .004 }, '#D6246E', '#9C1450', 'fruit', { rainbow: 'pink' }),
];
H.KIDS_TARGET = { kcal: 360, c: 55, p: 12, f: 10 }; // one kindergarten lunch, ages 3 to 5 (illustrative)
H.RAINBOW = { red: '#E0453A', yellow: '#F4C542', green: '#4C9A2A', pink: '#D6246E', white: '#E6DCC3', brown: '#9C5A2E' };
// dish colours and drawings are looked up by id
[...Object.values(H.WARD_MENU).flat(), ...H.KIDS_MENU].forEach(d => { PL.DISH[d.id] = d; });

H.nutrients = (grams, menu) => {
  const o = { kcal: 0, c: 0, p: 0, f: 0, fb: 0, na: 0 };
  menu.forEach(d => { const g = grams[d.id] || 0; Object.keys(o).forEach(k => { o[k] += g * (d.n[k] || 0); }); });
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
};

/* ---------------------------------------------------------------- demo people */
const DAYS = ['Sat 19', 'Sun 20', 'Mon 21', 'Tue 22', 'Wed 23', 'Thu 24'];
H.TODAY = 'Fri 25';
const PATIENTS = [
  { id: 'p1', name: 'Tan Boon Huat', age: 68, room: '7B-12', diet: 'protein', why: 'Recovering from hip surgery', doctor: 'Dr. Lee (orthopaedics)', app: d => .42 + d * .07, meal: { breakfast: -.15 }, like: { h_spinach: .6, h_kailan: .6, h_longbean: .7 } },
  { id: 'p2', name: 'Siti Rahmah', age: 74, room: '7B-08', diet: 'diabetic', why: 'Type 2 diabetes', doctor: 'Dr. Ng (endocrinology)', app: () => .82, meal: {}, like: { h_congee: .8, h_rice: .85, h_rice2: .85, h_papaya: 1.1 } },
  { id: 'p3', name: 'Rajesh Kumar', age: 57, room: '7B-03', diet: 'lowna', why: 'Heart failure', doctor: 'Dr. Menon (cardiology)', app: () => .84, meal: { dinner: -.08 }, like: { h_vegsoup: .35, h_lotus: .3 } },
  { id: 'p4', name: 'Chloe Lim', age: 35, room: '7B-15', diet: 'regular', why: 'After appendix surgery', doctor: 'Dr. Wong (general surgery)', app: d => .5 + d * .08, meal: {}, like: { h_milk: .5 } },
];
const KIDS = [
  { id: 'k1', name: 'Ava', age: 5, allergy: null, baseline: .3, app: .78, like: { k_broccoli: .3, k_dragon: 1.2, k_tomato: 1.1 }, note: 'Ava helped hand out spoons today and tried a whole broccoli floret!' },
  { id: 'k2', name: 'Hakim', age: 4, allergy: 'Egg', baseline: .42, app: .6, like: { k_broccoli: .15, k_tomato: .4, k_rice: 1.3 }, note: 'Hakim was a bit tired after outdoor play but finished all the rice.' },
  { id: 'k3', name: 'Kavya', age: 5, allergy: null, baseline: .18, app: .92, like: {}, note: 'Kavya asked for more dragon fruit and told the class the seeds look like tiny stars.' },
  { id: 'k4', name: 'Lucas', age: 4, allergy: null, baseline: .35, app: .66, like: { k_chicken: .5, k_corn: 1.2 }, note: 'Lucas liked the corn soup and practised using his spoon and fork.' },
  // the rest of Sunflower class (for the teacher's view)
  ...[['Isaac', 5, null], ['Zoe', 4, 'Peanut'], ['Aarav', 5, null], ['Mei Ling', 4, null], ['Rayyan', 5, null], ['Sophie', 4, 'Egg'], ['Kai', 5, null], ['Nadia', 4, null]].map(([name, age, allergy], i) => ({
    id: 'k' + (i + 5), name, age, allergy, named: false, baseline: [.28, .4, .22, .33, .19, .36, .3, .45][i], app: [.8, .6, .88, .7, .92, .66, .78, .52][i],
    like: [{ k_broccoli: .5 }, { k_tomato: .3, k_rice: 1.2 }, {}, { k_chicken: .6 }, { k_dragon: 1.2 }, { k_broccoli: .2 }, { k_corn: .6 }, { k_broccoli: .3, k_tomato: .4 }][i], note: '',
  })),
];

function served(menu, diet) {
  const D = H.DIETS[diet];
  return Object.fromEntries(menu.map(d => [d.id, Math.round(d.g * (D ? (D.mult[d.id] || 1) : 1))]));
}
function wardMenu(meal, diet) {
  const D = H.DIETS[diet];
  return H.WARD_MENU[meal].map(d => D.na === 1 ? d : { ...d, n: { ...d.n, na: d.n.na * D.na } });
}
/** Build one scanned meal: grams served, grams left, what was eaten, nutrients, share left. */
function mealRecord(menu, sv, frac, extra) {
  const measured = {}, eaten = {};
  menu.forEach(d => { const f = clamp(frac[d.id], 0, 1); eaten[d.id] = Math.round(sv[d.id] * f); measured[d.id] = sv[d.id] - eaten[d.id]; });
  const total = Object.values(sv).reduce((a, b) => a + b, 0), left = Object.values(measured).reduce((a, b) => a + b, 0);
  return { served: sv, measured, eaten, n: H.nutrients(eaten, menu), w: left / total, total, left, ...extra };
}
function seedPatient(P) {
  const r = rng(P.id.charCodeAt(1) * 97);
  const log = [];
  DAYS.forEach((day, di) => H.MEALS.forEach(([meal, , t]) => {
    const menu = wardMenu(meal, P.diet), base = P.app(di) + (P.meal[meal] || 0);
    const frac = Object.fromEntries(menu.map(d => [d.id, base * (P.like[d.id] || 1) + (r() - .5) * .2]));
    log.push(mealRecord(menu, served(menu, P.diet), frac, { day, meal, t }));
  }));
  // today: breakfast already scanned
  const menu = wardMenu('breakfast', P.diet), base = P.app(6) + (P.meal.breakfast || 0);
  log.push(mealRecord(menu, served(menu, P.diet), Object.fromEntries(menu.map(d => [d.id, base * (P.like[d.id] || 1) + (r() - .5) * .15])), { day: H.TODAY, meal: 'breakfast', t: '07:52' }));
  const { app, meal, like, ...rest } = P;
  return { ...rest, log };
}
function seedKid(K) {
  const r = rng(K.id.charCodeAt(1) * 131);
  const log = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24'].map(day => {
    const frac = Object.fromEntries(H.KIDS_MENU.map(d => [d.id, K.app * (K.like[d.id] || 1) + (r() - .5) * .25]));
    const rec = mealRecord(H.KIDS_MENU, served(H.KIDS_MENU), frac, { day, portion: 'M' });
    return { ...rec, pts: 0 };
  }).reverse();
  const lowWaste = log.filter(l => l.w < .15).length;
  return {
    id: K.id, name: K.name, age: K.age, allergy: K.allergy, note: K.note, cls: 'Sunflower', named: K.named !== false, baseline: K.baseline,
    pet: { xp: K.id === 'k2' ? 24 : 120 + Math.round(r() * 150), c: { veg: 3 + Math.round(r() * 6), lowWaste: lowWaste + Math.round(r() * 4), balanced: 2 + Math.round(r() * 4), quests: 0 }, en: 60 + Math.round(r() * 25), nu: 60 + Math.round(r() * 25), jo: 60 + Math.round(r() * 30), streak: 0, quest: 0 },
    log,
  };
}
function seed() {
  const kids = KIDS.map(seedKid);
  // about half of the rest of the class has already had lunch scanned today
  kids.filter(k => !k.named).forEach((k, i) => { if (i % 2 === 0) scanKid(k, KIDS.find(x => x.id === k.id), .6 + (i % 3) * .15); });
  return { v: CARE_V, patients: PATIENTS.map(seedPatient), kids, me: { patient: 'p1', kid: 'k1' } };
}
const KIDPREFS = Object.fromEntries(KIDS.map(k => [k.id, k]));
const PATPREFS = Object.fromEntries(PATIENTS.map(p => [p.id, p]));
const CARE_V = 7; // bump when the demo data changes shape
const ensure = () => { if (!PL.S.care || PL.S.care.v !== CARE_V) PL.S.care = seed(); };
ensure();
PL.store.subscribe(ensure);
H.patient = id => PL.S.care.patients.find(p => p.id === id);
H.kid = id => PL.S.care.kids.find(k => k.id === id);

/* ---------------------------------------------------------------- scanning a meal (demo: both scans at once) */
H.PRESETS = { 'Ate well': .92, 'Ate about half': .5, 'Barely ate': .15 };
/** The next unscanned meal today for a patient, or null when dinner is done. */
H.nextMeal = P => { const done = P.log.filter(l => l.day === H.TODAY).map(l => l.meal); const m = H.MEALS.find(([id]) => !done.includes(id)); return m ? m[0] : null; };
H.scanPatientMeal = (P, preset) => {
  const meal = H.nextMeal(P); if (!meal) return null;
  const menu = wardMenu(meal, P.diet), like = PATPREFS[P.id].like, base = H.PRESETS[preset];
  const frac = Object.fromEntries(menu.map(d => [d.id, base * Math.min(1.08, like[d.id] || 1) + (Math.random() - .5) * .12]));
  const rec = mealRecord(menu, served(menu, P.diet), frac, { day: H.TODAY, meal, t: H.MEALS.find(m => m[0] === meal)[2] });
  P.log.push(rec);
  return rec;
};
function scanKid(K, prefs, base) {
  const like = prefs.like;
  const frac = Object.fromEntries(H.KIDS_MENU.map(d => [d.id, base * Math.min(1.1, like[d.id] || 1) + (Math.random() - .5) * .15]));
  const rec = mealRecord(H.KIDS_MENU, served(H.KIDS_MENU), frac, { day: H.TODAY, portion: 'M', pts: 0 });
  K.log.unshift(rec); K.log = K.log.slice(0, 5);
  K.scanned = true;
  if (rec.w < .15) { K.pet.c.lowWaste++; K.pet.streak++; } else K.pet.streak = 0;
  if (rec.eaten.k_broccoli + rec.eaten.k_tomato > 20) K.pet.c.veg++;
  return rec;
}
H.scanKidLunch = (K, preset) => scanKid(K, KIDPREFS[K.id], H.PRESETS[preset]);
/** Demo: scan everyone in the class who hasn't had lunch scanned yet. */
H.scanRestOfKids = () => PL.S.care.kids.filter(k => !k.named && k.log[0].day !== H.TODAY).map(k => scanKid(k, KIDPREFS[k.id], KIDPREFS[k.id].app + (Math.random() - .5) * .2)).length;

/* ---------------------------------------------------------------- report building blocks */
/** limit-type nutrients (sodium) are good when under target; the rest are good near target. */
H.status = (k, v, target, mins = []) => {
  const r = v / target;
  if (mins.includes(k)) return r < .75 ? 'low' : 'ok'; // a minimum: more is fine
  if (k === 'na') return r > 1.1 ? 'high' : 'ok';
  if (k === 'fb') return r < .75 ? 'low' : 'ok'; // more fibre is fine
  return r < .75 ? 'low' : r > 1.3 ? 'high' : 'ok';
};
H.NAMES = { kcal: ['Energy', 'kcal'], p: ['Protein', 'g'], c: ['Carbs', 'g'], f: ['Fat', 'g'], fb: ['Fibre', 'g'], na: ['Sodium', 'mg'] };
H.ring = (v, target, sub) => {
  const r = 42, C = 2 * Math.PI * r, p = Math.min(1, v / target);
  return `<div class="ring-wrap"><svg viewBox="0 0 110 110" class="ring" aria-hidden="true"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--fill2)" stroke-width="11"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="${p < .75 ? 'var(--orange)' : 'var(--tint)'}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/></svg><div class="ring-in"><b class="num">${v}</b><span>${sub}</span></div></div>`;
};
/** One row per nutrient: a zone bar (low / good / a lot, or under / over the limit for sodium). */
H.nutrientRows = (n, target, keys, mins = []) => keys.map(k => {
  const t = target[k], max = t * 1.6, pos = x => Math.min(100, x / max * 100), st = H.status(k, n[k], t, mins);
  const zones = k === 'na'
    ? `<span class="z z2" style="left:0;width:${pos(t)}%"></span>`
    : k === 'fb' || mins.includes(k)
    ? `<span class="z z1" style="width:${pos(t * .75)}%"></span><span class="z z2" style="left:${pos(t * .75)}%;width:${100 - pos(t * .75)}%"></span>`
    : `<span class="z z1" style="width:${pos(t * .75)}%"></span><span class="z z2" style="left:${pos(t * .75)}%;width:${pos(t * 1.3) - pos(t * .75)}%"></span>`;
  return `<div class="hrow wide"><span>${H.NAMES[k][0]}</span><div class="zbar">${zones}<i class="${st}" style="width:${pos(n[k])}%"></i></div><b class="num ${st}">${n[k].toLocaleString('en-US')}<small> / ${t.toLocaleString('en-US')} ${H.NAMES[k][1]}</small></b></div>`;
}).join('');
/** Bars for a series of days, with a dashed target line. vals are 0..1 of target (or share eaten). */
H.dayBars = (days, vals, label, goal = 1, max = 1.3) => {
  const W = 300, Hh = 110, bw = Math.min(26, 220 / days.length);
  const step = (W - 30) / days.length;
  let s = `<svg viewBox="0 0 ${W} ${Hh + 18}" role="img" aria-label="${esc(label)}">`;
  days.forEach((d, i) => { const v = Math.min(max, vals[i]), h = v / max * Hh, x = 22 + i * step; s += `<rect x="${x}" y="${Hh - h}" width="${bw}" height="${h}" rx="5" fill="${vals[i] < goal * .75 ? 'var(--orange)' : 'var(--tint)'}"/><text class="axis" x="${x + bw / 2}" y="${Hh + 14}" text-anchor="middle">${d.slice(0, 3)}</text>`; });
  const gy = Hh - goal / max * Hh;
  return s + `<line x1="16" x2="${W - 4}" y1="${gy}" y2="${gy}" stroke="var(--label3)" stroke-width="1" stroke-dasharray="4 4"/></svg>`;
};
H.dishRows = (menu, rec) => menu.map(d => {
  const sv = rec.served[d.id], lf = rec.measured[d.id], ate = sv ? 1 - lf / sv : 1;
  return `<div class="dish"><i style="background:${d.color};border-color:${d.edge}"></i><span>${esc(d.name)}</span><span class="dbar"><i style="width:${Math.round(ate * 100)}%"></i></span><span class="g-v num">${pct(ate)} eaten</span></div>`;
}).join('');
H.face = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16a4 4 0 0 0 5 0"/></svg>`;
H.wardMenu = wardMenu;
})();
