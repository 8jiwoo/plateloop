/* Loopi's rules. Loopi only eats real school lunches: when a tray is scanned back, the food the student
   ate waits in Loopi's bowl. A tray with less left than the student's own usual earns a heart, and full
   hearts grow Loopi from egg to adult. Whatever was left on the tray turns up as crumbs on Loopi's floor
   until it's swept into the compost. No currency, no shop; Loopi never gets sick and never dies.
   State lives on each student as st.game. */
(() => {
'use strict';
const { MENU } = PL;
const G = PL.game = {};
const V = 2;

G.HUNGER_MAX = [4, 6, 8, 10];
G.HEARTS_REQ = [3, 5, 7, 9];
G.PLAYS_PER_DAY = 5;
G.PETS_PER_DAY = 5;

const today = () => new Date().toISOString().slice(0, 10);
const hash = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const daily = g => { if (!g.day || g.day.d !== today()) g.day = { d: today(), balls: 0, pets: 0 }; return g.day; };

/** Leftovers become crumbs: one per 20 g left of a dish, at most 3 per dish. */
const crumbsFrom = (left, menu = MENU) => menu.flatMap(d => Array(Math.min(3, Math.floor((left[d.id] || 0) / 20))).fill(d.id));

/** The tray is "good" when less is left than 15 %, or a quarter less than the student's usual. */
G.heartLine = st => Math.max(.15, st.baseline * .75);

/* ---------------------------------------------------------------- setup */
G.init = st => {
  const r = PL.rng(hash(st.id)), stage = PL.STAGES.indexOf(PL.stageOf(st.pet.xp)), req = G.HEARTS_REQ[stage];
  // whatever was left at the last lunch is still lying around
  const n = Math.min(4, Math.round(st.log[0].w * 12));
  return {
    v: V, name: 'Loopi', stage,
    hunger: Math.round(G.HUNGER_MAX[stage] * (.4 + r() * .3)),
    hearts: st.named ? req - 1 : Math.floor(r() * req), ready: false,
    plate: null, mess: (st.messSeed || ['spinach', 'kimchi', 'soup', 'rice']).slice(0, n), composted: Math.round(15 + r() * 50),
    eq: st.id === 's3' ? 'crown' : null, day: { d: today(), balls: 0, pets: 0 },
  };
};
G.ensure = st => { if (!st.game || st.game.v !== V) st.game = G.init(st); return st.game; };
const ensureAll = () => PL.S.students.forEach(G.ensure);
ensureAll();
PL.store.subscribe(ensureAll);

G.hungerMax = g => G.HUNGER_MAX[g.stage];
G.heartsReq = g => G.HEARTS_REQ[g.stage];
G.plantOf = st => Math.min(4, Math.floor(st.pet.c.lowWaste / 5));

/* ---------------------------------------------------------------- lunch */
/** Called after the second scan (school, or kindergarten with its own menu). Hunger and hearts change
    right away; the food waits in the bowl. */
G.feedLunch = (st, r, menu = MENU) => {
  const g = G.ensure(st), max = G.hungerMax(g), req = G.heartsReq(g);
  if (g.plate && !g.plate.eaten) g.mess.push(...g.plate.crumbs); // yesterday's uneaten plate still counts
  const gain = 1 + (r.w < .3 ? 1 : 0) + (r.w < .12 ? 1 : 0);
  g.hunger = Math.min(max, g.hunger + gain);
  let heart = false;
  if (r.w < G.heartLine(st) && g.hearts < req) {
    g.hearts++; heart = true;
    if (g.hearts === req && g.stage < 3) g.ready = true;
  }
  g.plate = {
    eaten: false, heart, gain,
    food: menu.filter(d => r.servedBy[d.id] - r.measured[d.id] > 10).map(d => d.id),
    crumbs: crumbsFrom(r.measured, menu),
  };
  return { hunger: gain, heart, ready: g.ready, crumbs: g.plate.crumbs.length };
};
/** Loopi eats what's in the bowl; the tray's leftovers land on the floor. */
G.serveLunch = st => {
  const g = G.ensure(st), p = g.plate;
  if (!p || p.eaten) return null;
  p.eaten = true;
  g.mess.push(...p.crumbs);
  return p;
};
G.sweep = (st, dish) => {
  const g = G.ensure(st), i = g.mess.indexOf(dish);
  if (i >= 0) { g.mess.splice(i, 1); g.composted++; }
  return g.mess.length;
};
G.evolve = st => {
  const g = G.ensure(st);
  if (!g.ready) return null;
  g.ready = false; g.hearts = 0; g.stage = Math.min(3, g.stage + 1);
  return PL.STAGES[g.stage];
};

/* ---------------------------------------------------------------- play */
G.playBall = st => {
  const g = G.ensure(st), d = daily(g);
  if (d.balls >= G.PLAYS_PER_DAY) return false;
  d.balls++; st.pet.jo = Math.min(100, st.pet.jo + 3); return true;
};
G.petLoopi = st => {
  const g = G.ensure(st), d = daily(g);
  if (d.pets >= G.PETS_PER_DAY) return false;
  d.pets++; st.pet.jo = Math.min(100, st.pet.jo + 1); return true;
};

/* ---------------------------------------------------------------- badges: each unlocks something Loopi can wear */
G.BADGES = [
  { id: 'first', name: 'First scan', item: 'cap', how: 'Scan a lunch tray', test: st => st.log.length > 0 },
  { id: 'small', name: 'Small and clean', item: 'bow', how: 'Finish a small portion', test: st => st.log.some(l => l.portion === 'S' && l.w < .12) },
  { id: 'streak', name: 'Three in a row', item: 'scarf', how: '3 clean trays in a row', test: st => st.pet.streak >= 3 },
  { id: 'veg', name: 'Veggie explorer', item: 'flower', how: 'Try the veggies 10 times', test: st => st.pet.c.veg >= 10 },
  { id: 'spinach', name: 'Spinach week', item: 'glasses', how: 'Taste the spinach 3 times', test: st => st.pet.quest >= 3 },
  { id: 'balanced', name: 'Balanced plate', item: 'halo', how: 'Eat from every food group 5 times', test: st => st.pet.c.balanced >= 5 },
  { id: 'class', name: 'Team goal', item: 'wings', how: 'Your class goes under 20% waste', test: st => { const c = PL.S.classes.find(c => c.id === st.cls); return c.ret / c.served < .2; } },
  { id: 'top3', name: 'Podium', item: 'headphones', how: 'Be top 3 in your class', test: st => PL.studentRows().findIndex(s => s.id === st.id) < 3 },
  { id: 'adult', name: 'All grown up', item: 'crown', how: 'Grow Loopi into an adult', test: st => G.ensure(st).stage === 3 },
];
G.earned = st => G.BADGES.filter(b => b.test(st));
G.wear = (st, item) => {
  const g = G.ensure(st);
  if (!G.earned(st).some(b => b.item === item)) return;
  g.eq = g.eq === item ? null : item;
};
})();
