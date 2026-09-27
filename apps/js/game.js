/* Loopi's rules, adapted from the team's tomogatchi prototype and tied to real school lunches.
   The core: a tray scanned back feeds Loopi the food you ate; a tray with less left than your usual earns
   a heart; full hearts grow Loopi from egg to adult, and a grown Loopi lays an egg (rarity odds shown) that
   hatches a new one while the old one retires to the Barn. Your real leftovers become crumbs to sweep into
   the compost. Around it: gems, ingredients from the food groups you actually ate, oven cooking in recipe
   order (burnt or wrong dishes go to the compost; compost-grown ingredients can make golden snacks), the
   worm farm, recipe cards from the Healthy Catch minigame, and wardrobe crates (earned gems only, odds
   shown). Hearts only ever come from real trays, so the game can't be won without eating well. */
(() => {
'use strict';
const { MENU } = PL;
const G = PL.game = {};
const V = 3; // bump when the saved game changes shape

/* ---------------------------------------------------------------- tuning */
G.HUNGER_MAX = [4, 6, 9, 13];
G.HEARTS_REQ = [3, 5, 7, 9];
G.PLAYS_PER_DAY = 3;          // Healthy Catch games a day
G.BALLS_PER_DAY = 5;          // fetch throws that add Joy
G.PETS_PER_DAY = 5;           // pats that add Joy
G.PET_GEM = { chance: .25, min: 2, max: 8, cap: 3 };
G.OVEN_CAP = 4;
G.SPOIL_CHANCE = .1;          // a correct recipe can still burn; it goes to the compost
G.GOLDEN_BASE = .2; G.GOLDEN_PER_GROWN = .2; G.GOLDEN_HUNGER = 2;
G.COMPOST_COST = 15; G.COMPOST_RECOVER = .35; G.WORM_CHANCE = .3;
G.RARITY_BONUS = { common: .4, rare: 1, epic: 1.7, legendary: 2.5 };
G.MENTOR_BONUS = .1;
G.EGG_WEIGHTS = { common: 50, rare: 30, epic: 15, legendary: 5 };
G.DUP_REFUND = .2;

G.INGREDIENTS = {
  rice: { name: 'Rice', draw: { name: 'Rice', color: '#F3EDDA', edge: '#BFB28E' } },
  veg: { name: 'Greens', draw: { name: 'Greens', color: '#3F9A48', edge: '#2A5A22' } },
  protein: { name: 'Chicken', draw: { name: 'Chicken', color: '#C98A4B', edge: '#8E5E28' } },
  fruit: { name: 'Fruit', draw: { name: 'Watermelon', color: '#F2545B', edge: '#B8323A' } },
};
/** Which ingredient each lunch food group gives when you eat at least half of it. */
const GROUP_ING = { grain: 'rice', veg: 'veg', protein: 'protein', fruit: 'fruit' };
G.RECIPES = [
  { id: 'chickenrice', name: 'Chicken rice', seq: ['rice', 'protein', 'veg'], hunger: 3, unlock: null },
  { id: 'vegsoup', name: 'Veggie soup', seq: ['veg', 'veg', 'rice'], hunger: 2, unlock: null },
  { id: 'fruitcup', name: 'Fruit cup', seq: ['fruit', 'fruit', 'veg'], hunger: 2, unlock: null },
  { id: 'nasilemak', name: 'Nasi lemak', seq: ['rice', 'protein', 'veg', 'rice'], hunger: 4, unlock: 'nasi', cost: 3 },
  { id: 'rainbow', name: 'Rainbow bowl', seq: ['rice', 'protein', 'veg', 'fruit'], hunger: 6, unlock: 'rainbow', cost: 5 },
];
G.CARD_NAME = { nasi: 'Nasi lemak card', rainbow: 'Rainbow bowl card' };
G.ACCESSORIES = [
  { id: 'cap', name: 'Cap', rarity: 'normal' }, { id: 'bow', name: 'Bow', rarity: 'normal' },
  { id: 'glasses', name: 'Glasses', rarity: 'normal' }, { id: 'scarf', name: 'Scarf', rarity: 'normal' },
  { id: 'flower', name: 'Flower', rarity: 'normal' }, { id: 'headphones', name: 'Headphones', rarity: 'epic' },
  { id: 'halo', name: 'Halo', rarity: 'epic' }, { id: 'wings', name: 'Wings', rarity: 'epic' },
  { id: 'crown', name: 'Crown', rarity: 'legendary' }, { id: 'aura', name: 'Sparkle aura', rarity: 'legendary' },
];
G.CRATES = {
  normal: { name: 'Basic crate', cost: 40, w: { normal: 85, epic: 14, legendary: 1 } },
  epic: { name: 'Epic crate', cost: 120, w: { normal: 40, epic: 50, legendary: 10 } },
  legendary: { name: 'Legendary crate', cost: 300, w: { normal: 10, epic: 50, legendary: 40 } },
};

const today = () => new Date().toISOString().slice(0, 10);
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const blank = () => ({ rice: 0, veg: 0, protein: 0, fruit: 0 });
const pickWeighted = w => { const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0); let x = Math.random() * tot; for (const [k, v] of e) { if (x < v) return k; x -= v; } return e[0][0]; };
const daily = g => { if (!g.day || g.day.d !== today()) g.day = { d: today(), balls: 0, pets: 0, drops: 0, plays: 0 }; return g.day; };
/** Leftovers become crumbs: one per 20 g left of a dish, at most 3 per dish. */
const crumbsFrom = (left, menu = MENU) => menu.flatMap(d => Array(Math.min(3, Math.floor((left[d.id] || 0) / 20))).fill(d.id));
/** The tray is "good" when less is left than 15%, or a quarter less than the student's usual. */
G.heartLine = st => Math.max(.15, st.baseline * .75);

/* ---------------------------------------------------------------- setup */
G.init = st => {
  const r = PL.rng(hash(st.id)), stage = PL.STAGES.indexOf(PL.stageOf(st.pet.xp)), req = G.HEARTS_REQ[stage];
  const n = Math.min(4, Math.round(st.log[0].w * 12));
  const g = {
    v: V, name: 'Loopi', rarity: 'common', stage,
    hunger: Math.round(G.HUNGER_MAX[stage] * (.4 + r() * .3)),
    hearts: st.named ? req - 1 : Math.floor(r() * req), ready: false,
    plate: null, mess: ['kailan', 'cabbage', 'soup', 'rice'].slice(0, n), composted: Math.round(15 + r() * 50),
    gems: Math.round(40 + r() * 140),
    ing: { rice: 1 + Math.floor(r() * 4), veg: 1 + Math.floor(r() * 4), protein: Math.floor(r() * 3), fruit: 1 + Math.floor(r() * 3) },
    grown: blank(), bin: ['veg', 'rice', 'fruit'].slice(0, 1 + Math.floor(r() * 3)), oven: [], snacks: [],
    unlocked: { nasi: false, rainbow: false }, cards: { nasi: 1 + Math.floor(r() * 2), rainbow: Math.floor(r() * 2) },
    acc: [], eq: null, barn: [], eggs: [], best: 0,
    day: { d: today(), balls: 0, pets: 0, drops: 0, plays: 0 },
  };
  if (st.named) g.snacks.push({ id: 's' + Math.floor(r() * 1e6), recipe: 'chickenrice', name: 'Chicken rice', hunger: 3, golden: false });
  (st.pet.book || []).forEach((form, i) => g.barn.push({ id: 'b' + i, name: 'Loopi ' + (i + 1), form, rarity: r() < .6 ? 'common' : 'rare', stage: 3 }));
  if (st.id === 's3') { g.acc.push('crown'); g.eq = 'crown'; }
  if (st.id === 's6') { g.acc.push('headphones'); g.eq = 'headphones'; }
  return g;
};
G.ensure = st => { if (!st.game || st.game.v !== V) st.game = G.init(st); return st.game; };
const ensureAll = () => PL.S.students.forEach(G.ensure);
ensureAll();
PL.store.subscribe(ensureAll);

/* ---------------------------------------------------------------- lookups */
G.hungerMax = g => G.HUNGER_MAX[g.stage];
G.heartsReq = g => G.HEARTS_REQ[g.stage];
G.plantOf = st => Math.min(4, Math.floor(st.pet.c.lowWaste / 5));
G.playsLeft = g => G.PLAYS_PER_DAY - daily(g).plays;
G.recipeUnlocked = (g, rc) => !rc.unlock || g.unlocked[rc.unlock];
/** Barn bonus on the gems each lunch earns: your best Loopi (active or retired) sets it; every other grown Loopi adds a little. */
G.multiplier = g => {
  const pets = [...g.barn, { rarity: g.rarity, stage: g.stage }];
  const val = p => 1 + G.RARITY_BONUS[p.rarity] * (p.stage / 3);
  const best = pets.reduce((a, p) => val(p) > val(a) ? p : a, pets[0]);
  return val(best) + pets.filter(p => p !== best).reduce((a, p) => a + G.MENTOR_BONUS * (p.stage / 3), 0);
};

/* ---------------------------------------------------------------- lunch: the heart of it */
/** Called after the second scan. Hunger, hearts, gems and ingredients change right away; the food waits in the bowl. */
G.feedLunch = (st, r, menu = MENU) => {
  const g = G.ensure(st), max = G.hungerMax(g), req = G.heartsReq(g);
  if (g.plate && !g.plate.eaten) g.mess.push(...g.plate.crumbs); // yesterday's uneaten plate still counts
  const gain = 1 + (r.w < .3 ? 1 : 0) + (r.w < .12 ? 1 : 0);
  g.hunger = Math.min(max, g.hunger + gain);
  let heart = false;
  if (r.w < G.heartLine(st) && g.hearts < req) {
    g.hearts++; heart = true;
    if (g.hearts === req) g.ready = true;
  }
  // one ingredient for each food group you ate at least half of
  const got = blank();
  menu.forEach(d => { const k = GROUP_ING[d.group]; if (k && r.servedBy[d.id] && r.measured[d.id] <= r.servedBy[d.id] * .5) got[k] = 1; });
  Object.keys(got).forEach(k => { g.ing[k] += got[k]; });
  const gems = Math.round((gain * 5 + 5) * G.multiplier(g));
  g.gems += gems;
  g.plate = {
    eaten: false, heart, gain,
    food: menu.filter(d => r.servedBy[d.id] - r.measured[d.id] > 10).map(d => d.id),
    crumbs: crumbsFrom(r.measured, menu),
  };
  return { hunger: gain, heart, ready: g.ready, crumbs: g.plate.crumbs.length, gems, ing: got };
};
/** Loopi eats what's in the bowl; the tray's leftovers land on the floor. */
G.serveLunch = st => {
  const g = G.ensure(st), p = g.plate;
  if (!p || p.eaten) return null;
  p.eaten = true;
  g.mess.push(...p.crumbs);
  return p;
};
/** Swept crumbs are your real leftovers: they're composted and counted, but never turned into ingredients. */
G.sweep = (st, dish) => {
  const g = G.ensure(st), i = g.mess.indexOf(dish);
  if (i >= 0) { g.mess.splice(i, 1); g.composted++; }
  return g.mess.length;
};
/** A cooked snack fills Food and cheers Loopi up (golden: more of both). Hearts only come from real trays. */
G.eatSnack = (st, snackId) => {
  const g = G.ensure(st), i = g.snacks.findIndex(s => s.id === snackId);
  if (i < 0) return null;
  const [s] = g.snacks.splice(i, 1), max = G.hungerMax(g), wasFull = g.hunger >= max;
  g.hunger = Math.min(max, g.hunger + s.hunger);
  st.pet.jo = Math.min(100, st.pet.jo + (s.golden ? 12 : 5));
  g.gems += s.hunger * 2;
  return { snack: s, wasFull, heart: false };
};

/* ---------------------------------------------------------------- growing up, eggs and the Barn */
/** Full hearts: grow a stage. A fully grown Loopi lays an egg instead. */
G.evolve = st => {
  const g = G.ensure(st);
  if (!g.ready) return null;
  g.ready = false; g.hearts = 0;
  if (g.stage < 3) { g.stage += 1; return { type: 'grow', stage: PL.STAGES[g.stage] }; }
  const rarity = pickWeighted(G.EGG_WEIGHTS);
  g.eggs.push(rarity);
  return { type: 'egg', rarity };
};
/** Hatching retires the grown Loopi to the Barn (it keeps boosting your gems) and starts a new one. */
G.hatch = st => {
  const g = G.ensure(st);
  if (!g.eggs.length) return null;
  const rarity = g.eggs.shift();
  g.barn.push({ id: 'b' + Date.now(), name: g.name, form: PL.formOf(st.pet), rarity: g.rarity, stage: g.stage, acc: g.eq });
  Object.assign(g, { name: 'Loopi ' + (g.barn.length + 1), rarity, stage: 0, hunger: 2, hearts: 0, ready: false, eq: null });
  return rarity;
};

/* ---------------------------------------------------------------- cooking */
function dump(g) { g.oven.forEach(o => g.bin.push(o.t)); g.oven = []; }
G.ovenAdd = (st, type) => {
  const g = G.ensure(st);
  let grown = false;
  if (g.grown[type] > 0) { g.grown[type]--; grown = true; }
  else if (g.ing[type] > 0) g.ing[type]--;
  else return { result: 'none' };
  g.oven.push({ t: type, grown });
  const seq = g.oven.map(o => o.t), open = G.RECIPES.filter(rc => G.recipeUnlocked(g, rc));
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
G.emptyOven = st => { const g = G.ensure(st), n = g.oven.length; dump(g); return n; };

/* ---------------------------------------------------------------- worm farm: kitchen scraps grow back */
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
G.unlock = (st, key) => {
  const g = G.ensure(st), rc = G.RECIPES.find(x => x.unlock === key);
  if (!rc || g.unlocked[key] || g.cards[key] < rc.cost) return false;
  g.cards[key] -= rc.cost; g.unlocked[key] = true; return true;
};

/* ---------------------------------------------------------------- play, petting */
G.playBall = st => {
  const g = G.ensure(st), d = daily(g);
  if (d.balls >= G.BALLS_PER_DAY) return false;
  d.balls++; st.pet.jo = Math.min(100, st.pet.jo + 3); return true;
};
/** A pat adds Joy, and now and then Loopi finds a few gems (at most 3 times a day). */
G.petLoopi = st => {
  const g = G.ensure(st), d = daily(g);
  if (d.pets < G.PETS_PER_DAY) { d.pets++; st.pet.jo = Math.min(100, st.pet.jo + 1); }
  if (d.drops >= G.PET_GEM.cap || Math.random() >= G.PET_GEM.chance) return 0;
  const gems = G.PET_GEM.min + Math.floor(Math.random() * (G.PET_GEM.max - G.PET_GEM.min + 1));
  g.gems += gems; d.drops++; return gems;
};

/* ---------------------------------------------------------------- Healthy Catch */
G.catchStart = st => { const g = G.ensure(st), d = daily(g); if (d.plays >= G.PLAYS_PER_DAY) return false; d.plays++; return true; };
G.catchEnd = (st, res) => {
  const g = G.ensure(st), got = blank();
  Object.keys(got).forEach(t => { got[t] = Math.floor((res.caught[t] + 1) / 2); g.ing[t] += got[t]; });
  Object.keys(res.cards).forEach(k => { g.cards[k] += res.cards[k]; });
  const gems = Math.floor(res.score / 4);
  g.gems += gems;
  const best = res.score > g.best; if (best) g.best = res.score;
  return { got, gems, best };
};

/* ---------------------------------------------------------------- wardrobe: badges and crates */
G.BADGES = [
  { id: 'first', name: 'First scan', item: 'cap', how: 'Scan a lunch tray', test: st => st.log.length > 0 },
  { id: 'small', name: 'Small and clean', item: 'bow', how: 'Finish a small portion', test: st => st.log.some(l => l.portion === 'S' && l.w < .12) },
  { id: 'streak', name: 'Three in a row', item: 'scarf', how: '3 clean trays in a row', test: st => st.pet.streak >= 3 },
  { id: 'veg', name: 'Veggie explorer', item: 'flower', how: 'Try the veggies 10 times', test: st => st.pet.c.veg >= 10 },
  { id: 'kailan', name: 'Kailan week', item: 'glasses', how: 'Taste the kailan 3 times', test: st => st.pet.quest >= 3 },
  { id: 'balanced', name: 'Balanced plate', item: 'halo', how: 'Eat from every food group 5 times', test: st => st.pet.c.balanced >= 5 },
  { id: 'class', name: 'Team goal', item: 'wings', how: 'Your class goes under 20% waste', test: st => { const c = PL.S.classes.find(c => c.id === st.cls); return c ? c.ret / c.served < .2 : false; } },
  { id: 'top3', name: 'Podium', item: 'headphones', how: 'Be top 3 in your class', test: st => PL.studentRows().findIndex(s => s.id === st.id) < 3 },
  { id: 'adult', name: 'All grown up', item: 'crown', how: 'Grow Loopi into an adult', test: st => G.ensure(st).stage === 3 || G.ensure(st).barn.length > 0 },
];
G.earned = st => G.BADGES.filter(b => b.test(st));
/** Everything Loopi can wear: won in crates, or unlocked by a badge. */
G.owned = st => new Set([...G.ensure(st).acc, ...G.earned(st).map(b => b.item)]);
G.wear = (st, item) => { const g = G.ensure(st); if (item && !G.owned(st).has(item)) return; g.eq = g.eq === item ? null : item; };
G.openCrate = (st, tier) => {
  const g = G.ensure(st), c = G.CRATES[tier];
  if (g.gems < c.cost) return { error: `The ${c.name.toLowerCase()} costs ${c.cost} gems.` };
  g.gems -= c.cost;
  const rarity = pickWeighted(c.w), pool = G.ACCESSORIES.filter(a => a.rarity === rarity);
  const acc = pool[Math.floor(Math.random() * pool.length)], dup = G.owned(st).has(acc.id);
  let refund = 0;
  if (dup) { refund = Math.round(c.cost * G.DUP_REFUND); g.gems += refund; } else g.acc.push(acc.id);
  return { acc, dup, refund };
};

/* ---------------------------------------------------------------- pixel sprites for the catch game */
G.SPRITES = {
  rice: { p: ['..wwww..', '.wwwwww.', 'bbbbbbbb', '.bbbbbb.', '..bbbb..'], c: { w: '#FFFFFF', b: '#3E74C9' } },
  veg: { p: ['..gg.gg.', '.gggggg.', '.gdggdg.', '..gggg..', '...dd...', '...dd...'], c: { g: '#3C9A48', d: '#23602D' } },
  protein: { p: ['...bb...', '..bbbb..', '.bbbbbb.', '.bbbbbb.', '..bbbb..', '...ww...', '..w..w..'], c: { b: '#C98A4B', w: '#FFF8EC' } },
  fruit: { p: ['gggggggg', '.rrrrrr.', '.rkrrkr.', '..rrrr..', '...rr...'], c: { g: '#5BA84A', r: '#F2545B', k: '#1F2A1D' } },
  soda: { p: ['..kkkk..', '..cccc..', '..ckcc..', '..cccc..', '..cccc..', '..kkkk..'], c: { c: '#B8322A', k: '#D9D9D9' } },
  candy: { p: ['p......p', 'pp.pp.pp', 'pppppppp', 'pp.pp.pp', 'p......p'], c: { p: '#E86FB0' } },
  card: { p: ['.tttttt.', '.tkkkkt.', '.tttttt.', '.tkkktt.', '.tttttt.'], c: { t: '#F1DFAE', k: '#6B4A2B' } },
};
G.drawSprite = (ctx, name, x, y, s) => {
  const sp = G.SPRITES[name];
  sp.p.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { ctx.fillStyle = sp.c[ch]; ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s); } }));
};
})();
