/* Loopi game systems, adapted from the team's Eggotchi prototype and retuned for school lunch:
   hunger + hearts → evolution → eggs + barn, Eco Booth (food SAVED, not food wasted), cooking with
   recipe order, compost worm farm, Healthy Catch minigame, petting, wardrobe crates.
   Kid-safe changes: no hourly hunger drain or affection loss, daily caps on play and gem drops,
   crates cost earned gems only and show their odds. All state lives on each student as st.game. */
(() => {
'use strict';
const { clamp, rng } = PL;
const G = PL.game = {};

G.HUNGER_MAX = [4, 6, 9, 13];
G.HEARTS_REQ = [3, 5, 7, 9];
G.MEALS_PER_HEART = 2;
G.INGREDIENTS = {
  rice: { name: 'Rice' }, veg: { name: 'Veggies' }, protein: { name: 'Protein' }, fruit: { name: 'Fruit' },
};
G.RECIPES = [
  { id: 'bibimbap', name: 'Bibimbap', seq: ['rice', 'veg', 'protein'], hunger: 3, unlock: null },
  { id: 'veg-soup', name: 'Veggie soup', seq: ['veg', 'veg', 'rice'], hunger: 2, unlock: null },
  { id: 'fruit-cup', name: 'Fruit cup', seq: ['fruit', 'fruit', 'veg'], hunger: 2, unlock: null },
  { id: 'kimbap', name: 'Kimbap', seq: ['rice', 'protein', 'veg', 'rice'], hunger: 4, unlock: 'kimbap', cost: 3 },
  { id: 'rainbow', name: 'Rainbow plate', seq: ['rice', 'protein', 'veg', 'fruit'], hunger: 6, unlock: 'rainbow', cost: 5 },
];
G.OVEN_CAP = 4;
G.SPOIL_CHANCE = .1;            // a correct recipe can still burn; it goes to the compost bin
G.GOLDEN_BASE = .2; G.GOLDEN_PER_GROWN = .2; G.GOLDEN_HUNGER = 2;
G.COMPOST_COST = 15; G.COMPOST_RECOVER = .35; G.WORM_CHANCE = .3;
G.BOOTH_KG_PER_ING = .05; G.BOOTH_KG_PER_GEM = .1; G.BOOTH_GEM = [5, 20];
G.RARITY_BONUS = { common: .4, rare: 1, epic: 1.7, legendary: 2.5 };
G.MENTOR_BONUS = .1;
G.EGG_WEIGHTS = { common: 50, rare: 30, epic: 15, legendary: 5 };
G.ACCESSORIES = [
  { id: 'cap', name: 'Cap', rarity: 'normal', slot: 'head' },
  { id: 'bow', name: 'Bow', rarity: 'normal', slot: 'side' },
  { id: 'glasses', name: 'Glasses', rarity: 'normal', slot: 'face' },
  { id: 'scarf', name: 'Scarf', rarity: 'normal', slot: 'neck' },
  { id: 'flower', name: 'Flower', rarity: 'normal', slot: 'side' },
  { id: 'headphones', name: 'Headphones', rarity: 'epic', slot: 'head' },
  { id: 'halo', name: 'Halo', rarity: 'epic', slot: 'head' },
  { id: 'wings', name: 'Wings', rarity: 'epic', slot: 'back' },
  { id: 'crown', name: 'Crown', rarity: 'legendary', slot: 'head' },
  { id: 'aura', name: 'Sparkle aura', rarity: 'legendary', slot: 'aura' },
];
G.ACC = Object.fromEntries(G.ACCESSORIES.map(a => [a.id, a]));
G.CRATES = {
  normal: { name: 'Basic crate', cost: 40, w: { normal: 85, epic: 14, legendary: 1 } },
  epic: { name: 'Epic crate', cost: 120, w: { normal: 40, epic: 50, legendary: 10 } },
  legendary: { name: 'Legendary crate', cost: 300, w: { normal: 10, epic: 50, legendary: 40 } },
};
G.DUP_REFUND = .2;
G.PET_GEM = { chance: .25, min: 2, max: 8, cap: 3 };
G.PLAYS_PER_DAY = 3;

const today = () => new Date().toISOString().slice(0, 10);
const r2 = v => Math.round(v * 100) / 100;
const pickWeighted = (w, rnd = Math.random) => { const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0); let x = rnd() * tot; for (const [k, v] of e) { if (x < v) return k; x -= v; } return e[0][0]; };
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const blank = () => ({ rice: 0, veg: 0, protein: 0, fruit: 0 });

/* ---------------------------------------------------------------- setup */
G.init = st => {
  const r = rng(hash(st.id)), stage = PL.STAGES.indexOf(PL.stageOf(st.pet.xp)), req = G.HEARTS_REQ[stage];
  const named = st.named;
  const g = {
    name: 'Loopi', rarity: 'common', stage,
    hunger: Math.round(G.HUNGER_MAX[stage] * (.4 + r() * .3)),
    hearts: named ? req - 1 : Math.floor(r() * req), meals: named ? 1 : Math.floor(r() * 2), ready: false,
    gems: Math.round(40 + r() * 140), eco: r2(.1 + r() * .3),
    ing: { rice: 1 + Math.floor(r() * 4), veg: 1 + Math.floor(r() * 4), protein: Math.floor(r() * 3), fruit: 1 + Math.floor(r() * 3) },
    grown: blank(), bin: [], oven: [], snacks: [],
    unlocked: { kimbap: false, rainbow: false }, cards: { kimbap: 1 + Math.floor(r() * 2), rainbow: Math.floor(r() * 2) },
    acc: [], eq: null, barn: [], eggs: [],
    plays: { d: today(), n: 0 }, drops: { d: today(), n: 0 }, best: 0,
  };
  ['veg', 'rice', 'fruit'].slice(0, 1 + Math.floor(r() * 3)).forEach(x => g.bin.push(x));
  if (named) g.snacks.push({ id: 's' + Math.floor(r() * 1e6), recipe: 'bibimbap', name: 'Bibimbap', hunger: 3, golden: false });
  (st.pet.book || []).forEach((form, i) => g.barn.push({ id: 'b' + i, name: 'Loopi ' + (i + 1), form, rarity: r() < .6 ? 'common' : 'rare', stage: 3 }));
  if (named) { g.acc.push('cap'); if (r() < .5) g.acc.push('bow'); }
  if (st.id === 's3') { g.acc.push('crown'); g.eq = 'crown'; }
  if (st.id === 's6') { g.acc.push('headphones'); g.eq = 'headphones'; }
  return g;
};
G.ensure = st => { if (!st.game) st.game = G.init(st); return st.game; };
const ensureAll = () => PL.S.students.forEach(G.ensure);
ensureAll();
PL.store.subscribe(ensureAll);

/* ---------------------------------------------------------------- lookups */
G.hungerMax = g => G.HUNGER_MAX[g.stage];
G.heartsReq = g => G.HEARTS_REQ[g.stage];
G.playsLeft = g => { if (g.plays.d !== today()) g.plays = { d: today(), n: 0 }; return G.PLAYS_PER_DAY - g.plays.n; };
G.multiplier = g => {
  const pets = [...g.barn, { rarity: g.rarity, stage: g.stage, id: 'active' }];
  const val = p => 1 + G.RARITY_BONUS[p.rarity] * (p.stage / 3);
  const best = pets.reduce((a, p) => val(p) > val(a) ? p : a, pets[0]);
  return val(best) + pets.filter(p => p !== best).reduce((a, p) => a + G.MENTOR_BONUS * (p.stage / 3), 0);
};
G.recipeUnlocked = (g, rc) => !rc.unlock || g.unlocked[rc.unlock];

/* ---------------------------------------------------------------- meals, hearts, evolution */
function registerMeal(g) {
  g.meals += 1;
  if (g.meals < G.MEALS_PER_HEART) return false;
  g.meals -= G.MEALS_PER_HEART;
  const req = G.heartsReq(g);
  if (g.hearts >= req) return false;
  g.hearts += 1;
  if (g.hearts === req) g.ready = true;
  return true;
}
/** A real lunch scan feeds Loopi and fills the Eco Booth with the food you SAVED vs. your usual. */
G.feedLunch = (st, r) => {
  const g = G.ensure(st), max = G.hungerMax(g);
  const gain = 1 + (r.w < .3 ? 1 : 0) + (r.w < .12 ? 1 : 0);
  const wasFull = g.hunger >= max;
  g.hunger = Math.min(max, g.hunger + gain);
  const heart = wasFull ? false : registerMeal(g);
  const eco = r2(Math.max(0, st.baseline * r.served - r.left) / 1000 + .03);
  g.eco = r2(g.eco + eco);
  const gems = gain * 5 + 5;
  g.gems += gems;
  return { hunger: gain, eco, gems, heart, ready: g.ready };
};
G.eatSnack = (st, snackId) => {
  const g = G.ensure(st), i = g.snacks.findIndex(s => s.id === snackId);
  if (i < 0) return null;
  const [s] = g.snacks.splice(i, 1), max = G.hungerMax(g), wasFull = g.hunger >= max;
  g.hunger = Math.min(max, g.hunger + s.hunger);
  let heart = false;
  if (!wasFull) { heart = registerMeal(g); if (s.golden) heart = registerMeal(g) || heart; }
  g.gems += s.hunger * 2;
  return { snack: s, heart, wasFull, ready: g.ready };
};
/** Evolve when hearts are full. A fully grown Loopi lays an egg instead. */
G.evolve = st => {
  const g = G.ensure(st);
  if (!g.ready) return null;
  g.ready = false; g.hearts = 0; g.meals = 0;
  if (g.stage < 3) { g.stage += 1; return { type: 'evolve', stage: PL.STAGES[g.stage] }; }
  const rarity = pickWeighted(G.EGG_WEIGHTS);
  g.eggs.push(rarity);
  return { type: 'egg', rarity };
};
/** Hatching retires the current Loopi to the barn (it keeps boosting the Eco Booth) and starts a new egg. */
G.hatch = st => {
  const g = G.ensure(st);
  if (!g.eggs.length) return null;
  const rarity = g.eggs.shift();
  g.barn.push({ id: 'b' + Date.now(), name: g.name, form: PL.formOf(st.pet), rarity: g.rarity, stage: g.stage, acc: g.eq });
  Object.assign(g, { name: 'Loopi ' + (g.barn.length + 1), rarity, stage: 0, hunger: 2, hearts: 0, meals: 0, ready: false, eq: null });
  st.pet.c = { veg: 0, lowWaste: 0, balanced: 0, quests: 0 };
  return rarity;
};

/* ---------------------------------------------------------------- Eco Booth */
G.boothSearch = st => {
  const g = G.ensure(st), mult = G.multiplier(g);
  const raw = g.eco / G.BOOTH_KG_PER_ING * mult;
  let draws = Math.floor(raw); if (Math.random() < raw - draws) draws++;
  const got = blank();
  for (let i = 0; i < draws; i++) { const t = pickWeighted({ rice: 35, veg: 30, fruit: 20, protein: 15 }); got[t]++; g.ing[t]++; }
  let gems = 0;
  for (let i = 0, n = Math.floor(g.eco / G.BOOTH_KG_PER_GEM); i < n; i++) gems += G.BOOTH_GEM[0] + Math.floor(Math.random() * (G.BOOTH_GEM[1] - G.BOOTH_GEM[0] + 1));
  gems = Math.round(gems * mult);
  g.gems += gems;
  const kg = g.eco; g.eco = 0;
  return { got, gems, kg, mult };
};

/* ---------------------------------------------------------------- cooking */
G.ovenAdd = (st, type) => {
  const g = G.ensure(st);
  let grown = false;
  if (g.grown[type] > 0) { g.grown[type]--; grown = true; }
  else if (g.ing[type] > 0) g.ing[type]--;
  else return { result: 'none' };
  g.oven.push({ t: type, grown });
  const seq = g.oven.map(o => o.t);
  const open = G.RECIPES.filter(rc => G.recipeUnlocked(g, rc));
  const match = open.find(rc => rc.seq.length === seq.length && rc.seq.every((x, i) => x === seq[i]));
  if (match) {
    const grownN = g.oven.filter(o => o.grown).length;
    if (Math.random() < G.SPOIL_CHANCE) { dump(g); return { result: 'spoiled', recipe: match }; }
    const golden = grownN > 0 && Math.random() < G.GOLDEN_BASE + G.GOLDEN_PER_GROWN * grownN;
    const snack = { id: 's' + Date.now() + Math.floor(Math.random() * 1e4), recipe: match.id, name: (golden ? 'Golden ' : '') + match.name, hunger: match.hunger + (golden ? G.GOLDEN_HUNGER : 0), golden };
    g.snacks.push(snack); g.oven = []; g.gems += 3;
    return { result: 'cooked', snack };
  }
  const prefix = open.some(rc => rc.seq.length > seq.length && seq.every((x, i) => rc.seq[i] === x));
  if (!prefix || seq.length >= G.OVEN_CAP) { dump(g); return { result: 'rejected' }; }
  return { result: 'pending' };
};
function dump(g) { g.oven.forEach(o => g.bin.push(o.t)); g.oven = []; }
G.emptyOven = st => { const g = G.ensure(st); const n = g.oven.length; dump(g); return n; };

/* ---------------------------------------------------------------- compost worm farm */
G.compost = st => {
  const g = G.ensure(st);
  if (!g.bin.length) return { error: 'The compost bin is empty.' };
  if (g.gems < G.COMPOST_COST) return { error: `Turning the compost costs ${G.COMPOST_COST} gems.` };
  g.gems -= G.COMPOST_COST;
  const worms = Math.random() < G.WORM_CHANCE, got = blank(), n = g.bin.length;
  g.bin.forEach(t => { if (Math.random() < G.COMPOST_RECOVER || (worms && Math.random() < .5)) { got[t]++; g.grown[t]++; } });
  g.bin = [];
  return { got, n, worms };
};

/* ---------------------------------------------------------------- recipes, petting, wardrobe */
G.unlock = (st, key) => {
  const g = G.ensure(st), rc = G.RECIPES.find(x => x.unlock === key);
  if (!rc || g.unlocked[key] || g.cards[key] < rc.cost) return false;
  g.cards[key] -= rc.cost; g.unlocked[key] = true; return true;
};
G.petLoopi = st => {
  const g = G.ensure(st);
  if (g.drops.d !== today()) g.drops = { d: today(), n: 0 };
  if (g.drops.n >= G.PET_GEM.cap || Math.random() >= G.PET_GEM.chance) return 0;
  const gems = G.PET_GEM.min + Math.floor(Math.random() * (G.PET_GEM.max - G.PET_GEM.min + 1));
  g.gems += gems; g.drops.n++; return gems;
};
G.openCrate = (st, tier) => {
  const g = G.ensure(st), c = G.CRATES[tier];
  if (g.gems < c.cost) return { error: `The ${c.name.toLowerCase()} costs ${c.cost} gems.` };
  g.gems -= c.cost;
  const rarity = pickWeighted(c.w), pool = G.ACCESSORIES.filter(a => a.rarity === rarity);
  const acc = pool[Math.floor(Math.random() * pool.length)], dup = g.acc.includes(acc.id);
  let refund = 0;
  if (dup) { refund = Math.round(c.cost * G.DUP_REFUND); g.gems += refund; } else g.acc.push(acc.id);
  return { acc, dup, refund };
};
G.equip = (st, id) => { const g = G.ensure(st); if (id && !g.acc.includes(id)) return; g.eq = g.eq === id ? null : id; };

/* ---------------------------------------------------------------- Loopi's room: ball play and crumbs */
G.BALLS_PER_DAY = 5;
/** Fetch with Loopi: +3 Joy, up to 5 times a day (after that it's just for fun). */
G.playBall = st => {
  const g = G.ensure(st);
  if (!g.balls || g.balls.d !== today()) g.balls = { d: today(), n: 0 };
  if (g.balls.n >= G.BALLS_PER_DAY) return false;
  g.balls.n++;
  st.pet.jo = Math.min(100, st.pet.jo + 3);
  return true;
};
/** A swept crumb goes into the compost bin, where the worm farm can grow it back. */
G.compostCrumb = (st, type) => {
  const g = G.ensure(st);
  g.bin.push(type);
  g.swept = (g.swept || 0) + 1;
  return g.swept;
};

/* ---------------------------------------------------------------- Healthy Catch */
G.catchStart = st => { const g = G.ensure(st); if (G.playsLeft(g) <= 0) return false; g.plays.n++; return true; };
G.catchEnd = (st, res) => {
  const g = G.ensure(st), got = blank();
  Object.keys(got).forEach(t => { got[t] = Math.floor((res.caught[t] + 1) / 2); g.ing[t] += got[t]; });
  Object.keys(res.cards).forEach(k => { g.cards[k] += res.cards[k]; });
  const gems = Math.floor(res.score / 4);
  g.gems += gems;
  const best = res.score > g.best; if (best) g.best = res.score;
  return { got, gems, best };
};

/* ---------------------------------------------------------------- pixel sprites (ingredients, catch items) */
G.SPRITES = {
  rice: { p: ['..wwww..', '.wwwwww.', 'bbbbbbbb', '.bbbbbb.', '..bbbb..'], c: { w: '#FFFFFF', b: '#3E74C9' } },
  veg: { p: ['..gg.gg.', '.gggggg.', '.gdggdg.', '..gggg..', '...dd...', '...dd...'], c: { g: '#3C9A48', d: '#23602D' } },
  protein: { p: ['..wwww..', '.wwwwww.', '.wwyyww.', '.wyyyyw.', '.wwyyww.', '..wwww..'], c: { w: '#FFFFFF', y: '#F4B400' } },
  fruit: { p: ['....sl..', '..rrsrr.', '.rrrrrrr', '.rrrrrrr', '.rrrrrrr', '..rrrrr.'], c: { r: '#E0453A', s: '#6B4A2B', l: '#3C9A48' } },
  soda: { p: ['..kkkk..', '..cccc..', '..ckcc..', '..cccc..', '..cccc..', '..kkkk..'], c: { c: '#B8322A', k: '#D9D9D9' } },
  candy: { p: ['p......p', 'pp.pp.pp', 'pppppppp', 'pp.pp.pp', 'p......p'], c: { p: '#E86FB0' } },
  card: { p: ['.tttttt.', '.tkkkkt.', '.tttttt.', '.tkkktt.', '.tttttt.'], c: { t: '#F1DFAE', k: '#6B4A2B' } },
};
G.drawSprite = (ctx, name, x, y, s) => {
  const sp = G.SPRITES[name];
  sp.p.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { ctx.fillStyle = sp.c[ch]; ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s); } }));
};
/** Paint every <canvas data-ing="rice|veg|…"> inside root. */
G.paintIcons = root => PL.$$('canvas[data-ing]', root).forEach(cv => {
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false;
  const s = Math.floor(Math.min(cv.width, cv.height) / 8);
  const rows = G.SPRITES[cv.dataset.ing].p.length;
  G.drawSprite(ctx, cv.dataset.ing, (cv.width - 8 * s) / 2, (cv.height - rows * s) / 2, s);
});
})();
