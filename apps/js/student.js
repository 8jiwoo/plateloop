/* Loopi, the student app for teens and university students: a Tamagotchi fed by real lunches.
   Loopi (the room: feed it the lunch you ate, sweep up your leftovers, play, grow it up, lay and hatch
   eggs), Lunch (the two scans, your tray, your plate and your week), Kitchen (cook snacks in recipe order,
   recipe cards, the Healthy Catch minigame), Ranks and Me (badges, history). Wardrobe
   crates and the Barn open as sheets.
   Rules: js/game.js. Room: js/room.js. Drawings: js/visual.js. */
(() => {
'use strict';
const { $, $$, pct, esc, MENU, DISH, FORMS } = PL;
const G = PL.game, V = PL.V;

const ui = { tab: 'loopi', seg: 'class', kseg: 'cook', big: false, modal: null, sheet: null, ovenMsg: '', seenScan: 0 };
let root = null;

const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  loopi: I('<path d="M12 3c4 0 7 4.5 7 9.5S16 21 12 21s-7-3.5-7-8.5S8 3 12 3Z"/><circle cx="9.5" cy="12" r=".8" fill="currentColor"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>'),
  lunch: I('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>'),
  ranks: I('<path d="M4 20v-7h5v7M9 20V8h6v12M15 20v-9h5v9"/>'),
  me: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  feed: I('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>'),
  play: I('<circle cx="12" cy="12" r="8"/><path d="M4.5 9.5c4 1 11 1 15 0M4.5 14.5c4-1 11-1 15 0"/>'),
  sweep: I('<path d="M14 3l-4 9M6 21l2-9h8l2 9Z"/><path d="M10 16v5M14 16v5"/>'),
  night: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  day: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  expand: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  kitchen: I('<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M3 13h18M8 5v3M16 5v3M12 4v4"/>'),
};
const TABS = { loopi: 'Loopi', lunch: 'Lunch', kitchen: 'Kitchen', ranks: 'Ranks', me: 'Me' };
const GEM = '<svg class="gem" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h8l3 4-7 8-7-8Z" fill="#5FB8E8" stroke="#2A6F99" stroke-width="1"/><path d="M1 6h14M6 2 5 6l3 8 3-8-1-4" fill="none" stroke="#2A6F99" stroke-width=".8"/></svg>';
const RARITY = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', normal: 'Normal' };
const ING = (t, size = 30) => V.food(G.INGREDIENTS[t].draw, size);
const STEP_ICONS = [
  '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
  '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
  '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
  '<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>',
];
const HEART = on => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 2.5 8.5A3.3 3.3 0 0 1 8 4a3.3 3.3 0 0 1 5.5 4.5Z" fill="${on ? '#FF2D55' : 'none'}" stroke="${on ? '#FF2D55' : 'var(--label3)'}" stroke-width="1.5"/></svg>`;

const me = () => PL.student(PL.S.me) || PL.S.students[0];
const act = fn => { const out = fn(); PL.store.save('game'); return out; };
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const pips = (n, max, cls) => `<span class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const nameFor = (s, viewer) => s.id === viewer.id ? `${s.name} (you)` : s.hideName ? 'Classmate' : s.name;
const craving = () => DISH[PL.CRAVING];
/** Your own Loopi (the pixel pet) with a speech bubble. */
const petSays = (st, text) => `<div class="guide petguide"><canvas width="84" height="70" data-pet="${st.id}" aria-label="Your Loopi"></canvas><div class="bubble"><p>${text}</p></div></div>`;

/* ================================================================ mount + frame */
function mount(el) {
  root = el;
  ui.seenScan = PL.S.lastScan ? PL.S.lastScan.at : 0;
  el.innerHTML = `
  <div class="stu">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon" aria-hidden="true">${V.loopi('happy', 46)}</span><div><b>Loopi</b><span>by PlateLoop · for teens and uni students</span></div></div>
      <p class="stu-note">Demo: pick a student</p>
      <div class="chips" id="stu-who"></div>
      <button class="linkish" id="stu-intro" style="font-size:13px;text-align:left">Show the first-run intro</button>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone" id="phone">
      <header class="phone-top" id="stu-top"></header>
      <div class="phone-body" id="stu-body"></div>
      <nav class="phone-tabs five" role="tablist" aria-label="Loopi">
        ${Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}">${ICON[t]}${TABS[t]}</button>`).join('')}
      </nav>
      <div id="stu-layer"></div>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { if (Catch.running) Catch.stop(true); ui.big = false; ui.sheet = null; ui.tab = b.dataset.tab; render(); $('#stu-body').scrollTop = 0; });
  el.onkeydown = e => { if (e.key === 'Escape' && ui.big) { ui.big = false; render(true); } };
  $('#stu-intro', el).onclick = intro;
  render();
  if (!PL.introSeen('loopi')) intro();
}
/** First run: what Loopi is, how the two scans work, why it rewards the right portion, then the privacy choices. */
function intro() {
  const st = me(), step = (ic, t, s) => `<div>${V.icon(ic, 'var(--tint)')}<b>${t}</b><span>${s}</span></div>`;
  PL.onboard($('#phone', root), 'loopi', [
    { art: V.loopi('wave', 150), title: 'Meet Loopi.', text: 'Loopi only eats the lunch you really eat. Whatever you finish goes into its bowl, and it grows up with you all year.' },
    { art: `<div class="onb-steps">${step('smile', 'Look at the camera', 'on the scanner, no card')}${step('scale', 'Place your tray', 'before and after lunch')}${step('check', 'Wait for the chime', 'about two seconds')}</div>`,
      title: 'Two quick scans.', text: 'Before lunch it sees what you were served. After lunch it sees what’s left. The difference is exactly what you ate.' },
    { art: V.loopi('cheer', 150), title: 'Take what you’ll finish.', text: 'This isn’t a clean-plate rule. A small plate you finish gives Loopi full energy, and you’re only ever compared with your own usual.' },
    { consent: true, art: V.icon('check', 'var(--tint)'), title: 'Your data, your choice.', cta: 'Start',
      body: `<div class="onb-prefs">
        <label class="onb-pref"><span><b>Sign in with my face</b><small>The scanner keeps a match code, never a photo. Off: type your class and register number instead.</small></span><input type="checkbox" role="switch" data-pref="face" ${st.faceOff ? '' : 'checked'}></label>
        <label class="onb-pref"><span><b>Show my name on the class board</b><small>Off: you appear as “A classmate”.</small></span><input type="checkbox" role="switch" data-pref="showName" ${st.hideName ? '' : 'checked'}></label>
        <label class="onb-agree"><input type="checkbox" data-agree> <span>I understand PlateLoop records what I’m served and what I leave, for Loopi, my class and the school kitchen. Tray photos never leave the scanner.</span></label></div>` },
  ], p => { st.faceOff = !p.face; st.hideName = !p.showName; PL.store.save('optin'); });
}
function render(keepScroll) {
  if (!root) return;
  const st = me(), g = G.ensure(st), body = $('#stu-body', root), scroll = body.scrollTop;
  $('#stu-who', root).innerHTML = PL.S.students.filter(s => s.named).map(s => `<button class="chip" data-sid="${s.id}" aria-pressed="${s.id === st.id}"><canvas width="26" height="22" data-pet="${s.id}"></canvas>${esc(s.name)}</button>`).join('');
  $$('#stu-who button', root).forEach(b => b.onclick = () => { if (Catch.running) Catch.stop(true); ui.modal = null; ui.big = false; ui.sheet = null; PL.S.me = b.dataset.sid; PL.store.save('me'); });
  $('#stu-top', root).innerHTML = `<canvas width="40" height="34" data-pet="${st.id}"></canvas><div><b>${esc(st.name)}</b><span>Class ${st.cls} · ${PL.SCHOOL}</span></div><div class="pts"><b class="num">${st.week}</b><span>points</span></div><div class="gems" title="Gems">${GEM}<b class="num">${g.gems}</b></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ loopi: loopiTab, lunch: lunchTab, kitchen: kitchenTab, ranks: ranksTab, me: meTab })[ui.tab](st, g);
  layer(st, g);
  wire(st);
  paint(0);
  wireRoom();
  if (ui.tab === 'kitchen' && ui.kseg === 'catch') Catch.attach();
  if (keepScroll) body.scrollTop = scroll;
  PL.motion(body, `loopi:${st.id}:${ui.tab}:${ui.kseg || ''}`);
}
function paint(t) {
  const st = me();
  PL.paintPets(root, t);
  $$('canvas[data-acc]', root).forEach(cv => { const o = PL.petOf(st); PL.drawPet(cv, { rows: 30, t, ...o, stage: o.stage === 'egg' ? 'baby' : o.stage, mood: 'happy', acc: cv.dataset.acc }); });
  $$('canvas[data-evo]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...PL.petOf(st), mood: 'joy' }));
}

/* ================================================================ Loopi: the Tamagotchi */
function loopiTab(st, g) {
  const max = G.hungerMax(g), req = G.heartsReq(g), next = PL.STAGES[g.stage + 1];
  const form = PL.formOf(st.pet), F = FORMS[form], joy = Math.round(st.pet.jo / 20);
  const foot = g.ready ? '' : g.stage === 3 && g.hearts >= req
    ? 'Loopi is fully grown.'
    : `A tray with less than ${pct(G.heartLine(st))} left earns a heart. Your usual is ${pct(st.baseline)}.`;
  return `
  ${roomBlock(st, g, false)}
  <div class="petstats">
    <div>${V.icon('bowl', '#F2A516')}<span>Food</span>${pips(g.hunger, max, 'food')}<b class="num">${g.hunger}/${max}</b></div>
    <div>${V.icon('smile', '#F28C28')}<span>Happy</span>${pips(joy, 5, 'joy')}<b class="num">${joy}/5</b></div>
    <div>${V.icon('heart', '#FF2D55')}<span>Hearts</span><span class="hearts">${Array.from({ length: req }, (_, i) => HEART(i < g.hearts)).join('')}</span><b class="num">${g.hearts}/${req}</b></div>
  </div>
  ${g.ready ? `<button class="btn primary big" id="evolve">${next ? `Grow into ${/^[AEIOU]/.test(next.name) ? 'an' : 'a'} ${next.name.toLowerCase()}` : 'Loopi is ready to lay an egg!'}</button>` : `<p class="foot">${foot}</p>`}
  ${g.eggs.length ? `<button class="btn big eggbtn" id="hatch"><span class="egg-ic ${g.eggs[0]}"></span>Hatch the ${RARITY[g.eggs[0]].toLowerCase()} egg${g.eggs.length > 1 ? ` (+${g.eggs.length - 1} more)` : ''}</button>` : ''}
  <div class="vcard snackcard"><h3>Snacks <small>${g.snacks.length ? 'tap to feed Loopi' : 'cook some in the Kitchen'}</small></h3>
    ${g.snacks.length ? `<div class="snackrow">${g.snacks.map(sn => { const rc = G.RECIPES.find(r => r.id === sn.recipe); return `<button class="snk ${sn.golden ? 'golden' : ''}" data-snack="${sn.id}"><span class="snk-ic">${rc.seq.slice(0, 3).map(t => ING(t, 22)).join('')}</span><b>${esc(sn.name)}</b><small>+${sn.hunger} food</small></button>`; }).join('')}</div>` : `<button class="btn small" data-go="kitchen">Go to the Kitchen</button>`}</div>
  <div class="two"><button class="btn" id="open-wardrobe">${V.icon('smile', 'var(--purple)')}Wardrobe</button><button class="btn" id="open-barn">${V.icon('heart', 'var(--orange)')}Barn · ${g.barn.length}</button></div>
  <div class="vcard growcard">
    <div class="stages">${PL.STAGES.map((s, i) => `<div class="${i < g.stage ? 'past' : i === g.stage ? 'now' : ''}"><canvas width="56" height="47" data-form="${form}" data-stage="${s.id}"></canvas><span>${s.name}</span></div>`).join('')}</div>
    <p><b>${g.stage === 3 ? `${F.name} Loopi` : `Growing up ${F.name}`}</b> · ${st.pet.c[F.key]} ${F.why} so far. What you eat decides how Loopi looks.</p>
  </div>`;
}
function roomBlock(st, g, big) {
  const stg = PL.stuStage(st), mess = g.mess.length, lunch = g.plate && !g.plate.eaten;
  return `
  <div class="room">
    <canvas class="room-cv" id="${big ? 'room-cv-big' : 'room-cv'}" aria-label="Loopi's room. Tap Loopi to pet it, tap the floor to walk, tap crumbs to sweep them."></canvas>
    <div class="room-say" id="${big ? 'room-say-big' : 'room-say'}" hidden></div>
    ${big ? `<div class="room-hud"><span>${esc(g.name)} · ${stg.name}</span><span class="num">Food ${g.hunger}/${G.hungerMax(g)}</span><span class="num">Hearts ${g.hearts}/${G.heartsReq(g)}</span></div>` : ''}
    <button class="room-expand" data-room="${big ? 'close' : 'expand'}" aria-label="${big ? 'Close full screen' : 'Full screen'}">${ICON[big ? 'close' : 'expand']}</button>
  </div>
  <div class="room-actions">
    <button data-room="feed" class="${lunch ? 'hot' : ''}">${ICON.feed}<span>${lunch ? 'Feed lunch' : 'Feed'}</span></button>
    <button data-room="play">${ICON.play}<span>Play</span></button>
    <button data-room="sweep">${ICON.sweep}<span>Sweep${mess ? ` (${mess})` : ''}</span></button>
    <button data-room="lights">${ICON[PL.Room.night ? 'day' : 'night']}<span>${PL.Room.night ? 'Lights on' : 'Lights off'}</span></button>
  </div>`;
}
const roomHooks = {
  info: () => { const st = me(), g = G.ensure(st); return { ...PL.petOf(st), plate: g.plate && !g.plate.eaten ? g.plate.food : null, plant: G.plantOf(st) }; },
  mess: () => G.ensure(me()).mess,
  eat: () => { const p = act(() => G.serveLunch(me())); return p && { heart: p.heart, crumbs: p.crumbs.length }; },
  snackFood: id => { const sn = G.ensure(me()).snacks.find(x => x.id === id); if (!sn) return null; const rc = G.RECIPES.find(r => r.id === sn.recipe); return rc.seq.map(t => ({ rice: 'rice', veg: 'kailan', protein: 'chicken', fruit: 'melon' })[t]); },
  eatSnack: id => { const r = act(() => G.eatSnack(me(), id)); return r && { golden: r.snack.golden, wasFull: r.wasFull }; },
  pet: () => { const gems = act(() => G.petLoopi(me())); if (gems) PL.toast(`Loopi found ${gems} gems!`); },
  fetched: () => act(() => G.playBall(me())),
  swept: type => { act(() => G.sweep(me(), type)); if (!G.ensure(me()).mess.length) PL.Room.say('All clean. Thanks!', 2.4); },
  chatter: () => {
    const st = me(), g = G.ensure(st);
    if (g.plate && !g.plate.eaten) return 'I smell lunch!';
    if (g.ready) return 'I feel funny… I think I\'m growing!';
    if (g.mess.length) return `There's ${DISH[g.mess[0]].name.toLowerCase()} on the floor.`;
    const lines = ['Can we play ball?', null, null];
    if (!st.before) lines.push('Scan your tray before you eat!');
    else if (!st.after) lines.push('Scan your tray again after lunch.');
    if (st.pet.quest < 3) lines.push(`What does ${craving().name.replace('Stir-fried ', '').toLowerCase()} taste like?`);
    if (g.hunger <= 1) lines.push('My tummy is rumbling.');
    return lines[Math.floor(Math.random() * lines.length)];
  },
};
function wireRoom() {
  $$('[data-room]', root).forEach(b => b.onclick = () => {
    const a = b.dataset.room;
    if (a === 'feed') PL.Room.feed();
    else if (a === 'play') PL.Room.throwBall();
    else if (a === 'sweep') { if (PL.Room.crumbs.length) PL.Room.sweepAll(); else PL.Room.say('Nothing to sweep.', 2); }
    else if (a === 'lights') { PL.Room.toggleNight(); render(true); }
    else if (a === 'expand') { ui.big = true; render(true); }
    else if (a === 'close') { ui.big = false; render(true); }
  });
  const big = $('#room-cv-big', root), small = $('#room-cv', root);
  if (big) PL.Room.attach(big, $('#room-say-big', root), roomHooks);
  else if (small) PL.Room.attach(small, $('#room-say', root), roomHooks);
}

/* ================================================================ Lunch: scans, tray, plate, week */
function journey(state, fed) {
  const steps = ['Scan your tray', 'Eat', 'Scan again', 'Feed Loopi'];
  const at = { none: 0, eating: 1, done: fed ? 4 : 3 }[state];
  return `<ol class="journey">${steps.map((s, i) => { const done = i < at; return `<li class="${done ? 'done' : i === at ? 'now' : ''}"><span>${done ? ICON.check : I(STEP_ICONS[i])}</span><small>${s}</small></li>`; }).join('')}</ol>`;
}
function lunchTab(st, g) {
  const state = PL.scanState(st), a = st.after, c = craving();
  const fed = g.plate && g.plate.eaten;
  let line;
  if (state === 'none') line = 'Look at the scanner and put your tray down before you eat. I\'m hungry!';
  else if (state === 'eating') line = st.pet.quest < 3 ? `Enjoy lunch! Try the ${c.name.toLowerCase()} first. It's this week's veggie to try.` : 'Enjoy lunch! Scan your tray again when you\'re done.';
  else if (a.w < .1) line = 'You finished almost everything! That\'s a full bowl for me.';
  else if (a.w < st.baseline) line = `Less left than usual (${pct(a.w)}, your usual is ${pct(st.baseline)}). Nice!`;
  else line = 'Some food came back today. A smaller portion is fine, and I\'ll get crumbs on my floor otherwise!';
  let out = `${petSays(st, line)}${journey(state, fed)}`;
  if (state === 'done' && !fed) out += `<button class="btn primary big" data-go="loopi">Your lunch is in Loopi's bowl. Go feed it</button>`;
  if (state !== 'done') {
    out += `<div class="vcard"><h3>Today's lunch <small>Friday</small></h3>${V.tray(MENU, null, { hi: st.pet.quest < 3 ? c.id : null, tag: d => d.id === c.id && st.pet.quest < 3 ? 'Try me' : '' })}</div>`;
  } else if (a.measured) {
    const eaten = Object.fromEntries(MENU.map(d => [d.id, a.served[d.id] - a.measured[d.id]]));
    const leftG = Math.round(sum(a.measured));
    out += `<div class="vcard"><h3>What you ate <small>${pct(1 - a.w)} of your tray</small></h3>${V.tray(MENU, a)}</div>
    <div class="vcard"><h3>Your plate today</h3>${V.healthyPlate(V.plateShares(MENU, eaten))}</div>
    <div class="vcard"><h3>Nutrition</h3><div class="vrings">${V.ring(a.intake.kcal, PL.TARGET.kcal, 'Calories', 'kcal')}${V.ring(a.intake.p, PL.TARGET.p, 'Protein', 'g', 'aim')}${V.ring(a.intake.c, PL.TARGET.c, 'Carbs', 'g')}</div></div>
    <div class="vtips">
      ${a.co2 > 0 ? V.tip('cloud', 'good', `You saved ${a.co2} g of CO₂`, 'Food that isn\'t wasted doesn\'t have to be grown, cooked and thrown away again.') : ''}
      ${leftG > 20 ? V.tip('recycle', 'info', `${leftG} g went into the food waste bin`, 'It shows up as crumbs in Loopi\'s room until you sweep them.') : V.tip('check', 'good', 'Hardly anything left', 'Your tray grew a fruit on the school\'s Green Tree.')}
    </div>`;
  }
  const days = st.log.slice(0, 5).reverse(), tries = Math.min(3, st.pet.quest);
  out += `<div class="vcard"><h3>This week <small>share of lunch eaten</small></h3>${V.week(days.map(l => l.day), days.map(l => 1 - l.w), { today: days.findIndex(l => l.day.startsWith('Fri')) })}</div>
  <div class="vcard"><h3>${c.name.replace('Stir-fried ', '')} week <small>${tries} of 3 tries</small></h3><div class="tries">${[0, 1, 2].map(i => `<div class="${i < tries ? 'on' : ''}">${V.food(c, 42)}<span>${i < tries ? 'Tried!' : `Try ${i + 1}`}</span></div>`).join('')}</div></div>`;
  return out;
}

/* ================================================================ Kitchen: cook, recipes, catch */
function kitchenTab(st, g) {
  const segs = { cook: 'Cook', recipes: 'Recipes', catch: 'Catch' };
  const seg = `<div class="seg" id="kseg">${Object.entries(segs).map(([k, v]) => `<button data-k="${k}" aria-pressed="${ui.kseg === k}">${v}</button>`).join('')}</div>`;
  const pantry = (counts, extra, add) => `<div class="pantry">${Object.keys(G.INGREDIENTS).map(t => { const n = counts[t] + (extra ? extra[t] : 0); return `<${add ? 'button' : 'div'} class="pan" ${add ? `data-add="${t}" ${n ? '' : 'disabled'}` : ''}>${ING(t, 34)}<b class="num">${n}</b><small>${G.INGREDIENTS[t].name}${extra && extra[t] ? ` · ${extra[t]} grown` : ''}</small></${add ? 'button' : 'div'}>`; }).join('')}</div>`;
  if (ui.kseg === 'catch') return seg + catchTab(g);
  if (ui.kseg === 'cook') {
    const known = G.RECIPES.filter(rc => G.recipeUnlocked(g, rc));
    return `${seg}
    <div class="vcard"><h3>Oven <small>add ingredients in a recipe's order</small></h3>
      <div class="oven2">${Array.from({ length: G.OVEN_CAP }, (_, i) => `<div class="slot2">${g.oven[i] ? ING(g.oven[i].t, 36) + (g.oven[i].grown ? '<em>grown</em>' : '') : `<span>${i + 1}</span>`}</div>`).join('')}</div>
      <p class="oven-msg" role="status">${ui.ovenMsg || 'A wrong order or a burnt dish gets thrown away. Now and then a dish comes out golden.'}</p>
      ${pantry(g.ing, g.grown, true)}
      ${g.oven.length ? '<button class="btn small ghost" id="empty-oven" style="margin-top:8px">Empty the oven</button>' : ''}</div>
    <div class="vcard"><h3>Recipes you know</h3><div class="recipes2">${known.map(rc => `<div class="rcp"><span class="seq2">${rc.seq.map((t, i) => `${i ? '<i>›</i>' : ''}${ING(t, 26)}`).join('')}</span><div><b>${rc.name}</b><small>+${rc.hunger} food</small></div></div>`).join('')}</div></div>`;
  }
  return `${seg}
    <div class="vcard"><h3>Recipe book <small>find cards in Healthy Catch</small></h3><div class="recipes2">${G.RECIPES.map(rc => {
      const open = G.recipeUnlocked(g, rc), have = rc.unlock ? g.cards[rc.unlock] : 0;
      return `<div class="rcp ${open ? '' : 'locked'}"><span class="seq2">${rc.seq.map((t, i) => `${i ? '<i>›</i>' : ''}${ING(t, 26)}`).join('')}</span><div><b>${rc.name}</b><small>+${rc.hunger} food${open ? '' : ` · ${have} of ${rc.cost} cards`}</small></div>${open ? '<span class="pill green">Known</span>' : `<button class="btn small" data-unlock="${rc.unlock}" ${have >= rc.cost ? '' : 'disabled'}>Unlock</button>`}</div>`;
    }).join('')}</div></div>`;
}
function catchTab(g) {
  const left = G.playsLeft(g);
  return `
  <div class="vcard"><h3>Healthy Catch <small>${left} of ${G.PLAYS_PER_DAY} plays left today</small></h3>
    <div class="catch-wrap"><canvas id="catch" width="300" height="360" aria-label="Healthy Catch game"></canvas>
      <div class="catch-hud" id="catch-hud"></div>
      <div class="catch-cover" id="catch-cover">${left > 0 ? '<button class="btn primary big" id="catch-start">Start</button>' : '<p>No plays left today. Come back tomorrow!</p>'}<small>Catch rice, greens, chicken and fruit. Dodge soda and candy. Move with your finger, the mouse or ← →.</small></div>
    </div>
    <div class="catch-ctrl"><button class="btn" id="c-left" aria-label="Move left">◀</button><button class="btn" id="c-right" aria-label="Move right">▶</button></div>
    <p class="hint" style="margin-top:10px">Every 2 foods you catch become 1 ingredient. Golden cards unlock recipes. Best score: <b class="num">${g.best}</b></p></div>`;
}
const Catch = {
  running: false, raf: 0,
  attach() {
    const cv = $('#catch', root); if (!cv) return;
    this.cv = cv; this.ctx = cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    const start = $('#catch-start', root); if (start) start.onclick = () => this.start();
    const move = e => { const r = cv.getBoundingClientRect(); this.target = Math.max(.08, Math.min(.92, (e.clientX - r.left) / r.width)); };
    cv.onpointerdown = e => { move(e); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (e.buttons || e.pointerType === 'mouse') move(e); };
    const hold = (id, d) => { const b = $(id, root); if (!b) return; b.onpointerdown = () => { this.dir = d; }; b.onpointerup = b.onpointerleave = () => { this.dir = 0; }; };
    hold('#c-left', -1); hold('#c-right', 1);
    root.onkeydown = e => { if (e.key === 'Escape' && ui.big) { ui.big = false; render(true); return; } if (!this.running) return; if (e.key === 'ArrowLeft') this.dir = -1; if (e.key === 'ArrowRight') this.dir = 1; };
    root.onkeyup = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.dir = 0; };
    this.drawIdle();
  },
  start() {
    if (!act(() => G.catchStart(me()))) return;
    Object.assign(this, { running: true, items: [], x: .5, target: null, dir: 0, score: 0, misses: 0, maxMiss: 5, caught: { rice: 0, veg: 0, protein: 0, fruit: 0 }, cards: { nasi: 0, rainbow: 0 }, t0: performance.now(), last: performance.now(), next: 0, flash: 0 });
    $('#catch-cover', root).hidden = true;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  },
  stop(abandon) {
    this.running = false; cancelAnimationFrame(this.raf);
    if (abandon) return;
    const res = act(() => G.catchEnd(me(), { caught: this.caught, cards: this.cards, score: this.score }));
    const got = Object.entries(res.got).filter(([, n]) => n > 0), cards = Object.entries(this.cards).filter(([, n]) => n > 0);
    modal('Nice catching!', `<p class="big-num num">${this.score}</p><p class="hint center">foods caught${res.best ? ' · new best!' : ''}</p>
      <div class="got2">${got.map(([t, n]) => `<div>${ING(t, 28)}<b>+${n} ${G.INGREDIENTS[t].name}</b></div>`).join('') || '<p class="hint">Catch 2 of the same food to earn an ingredient.</p>'}${cards.map(([k, n]) => `<div><span class="cardic"></span><b>+${n} ${G.CARD_NAME[k]}</b></div>`).join('')}<div>${GEM}<b>+${res.gems} gems</b></div></div>`);
  },
  loop(now) {
    if (!this.running || !this.cv || !this.cv.isConnected) { this.running = false; return; }
    const dt = Math.min(50, now - this.last); this.last = now;
    const speed = 1 + Math.floor((now - this.t0) / 7000) * .2;
    if (now > this.next) {
      const r = Math.random();
      const kind = r < .03 ? 'card' : r < .2 ? (Math.random() < .5 ? 'soda' : 'candy') : ['rice', 'veg', 'protein', 'fruit'][Math.floor(Math.random() * 4)];
      this.items.push({ kind, x: .08 + Math.random() * .84, y: -.05, card: Math.random() < .7 ? 'nasi' : 'rainbow' });
      this.next = now + (550 + Math.random() * 450) / speed;
    }
    const vx = .9 * dt / 1000;
    if (this.dir) this.x = Math.max(.08, Math.min(.92, this.x + this.dir * vx));
    else if (this.target != null) this.x += Math.max(-vx * 1.4, Math.min(vx * 1.4, this.target - this.x));
    this.items.forEach(it => { it.y += dt / (2600 / speed); });
    this.items = this.items.filter(it => {
      if (it.y >= .86 && it.y < .95 && Math.abs(it.x - this.x) < .11) {
        if (it.kind === 'soda' || it.kind === 'candy') { this.misses++; this.flash = 8; }
        else if (it.kind === 'card') this.cards[it.card]++;
        else { this.score++; this.caught[it.kind]++; }
        return false;
      }
      if (it.y > 1.02) { if (G.INGREDIENTS[it.kind]) this.misses++; return false; }
      return true;
    });
    this.draw(speed);
    if (this.misses >= this.maxMiss) { this.stop(false); return; }
    this.raf = requestAnimationFrame(this.loop);
  },
  bg() { const { ctx, cv } = this, W = cv.width, H = cv.height; ctx.fillStyle = '#DDF1E6'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#C6E6D4'; for (let y = 0; y < H; y += 24) ctx.fillRect(0, y, W, 12); ctx.fillStyle = '#8DBF9F'; ctx.fillRect(0, H - 22, W, 22); },
  basket(x) { const { ctx, cv } = this, W = cv.width, H = cv.height, bx = Math.round(x * W - 30), by = Math.round(H * .88); ctx.fillStyle = '#8A5A2B'; ctx.fillRect(bx, by, 60, 16); ctx.fillStyle = '#B77B3E'; for (let i = 0; i < 60; i += 8) ctx.fillRect(bx + i, by + 3, 4, 10); ctx.fillStyle = '#5E3B1A'; ctx.fillRect(bx - 3, by - 3, 66, 4); },
  drawIdle() { if (!this.cv) return; this.bg(); ['rice', 'veg', 'protein', 'fruit'].forEach((k, i) => G.drawSprite(this.ctx, k, 40 + i * 62, 90 + (i % 2) * 30, 4)); this.basket(.5); },
  draw(speed) {
    const { ctx, cv } = this, W = cv.width, H = cv.height;
    this.bg(); this.items.forEach(it => G.drawSprite(ctx, it.kind, it.x * W - 16, it.y * H - 12, 4)); this.basket(this.x);
    if (this.flash > 0) { ctx.fillStyle = 'rgba(224,69,58,.25)'; ctx.fillRect(0, 0, W, H); this.flash--; }
    const hud = $('#catch-hud', root); if (hud) hud.innerHTML = `<b class="num">${this.score}</b> caught · <span>${'●'.repeat(this.maxMiss - this.misses)}${'○'.repeat(this.misses)}</span> · ${speed.toFixed(1)}×`;
  },
};

/* ================================================================ Ranks */
function ranksTab(st) {
  const segs = { class: `Class ${st.cls}`, schools: 'Schools' };
  let body;
  if (ui.seg === 'class') {
    const all = PL.studentRows(), myRank = all.findIndex(s => s.id === st.id) + 1, top = all.slice(0, 3);
    const c = PL.S.classes.find(c => c.id === st.cls), cw = c.ret / c.served;
    const pod = [top[1], top[0], top[2]].map((s, i) => s ? `<div class="pod p${[2, 1, 3][i]}"><canvas width="${[48, 60, 48][i]}" height="${[40, 50, 40][i]}" data-pet="${s.id}"></canvas><b>${esc(nameFor(s, st).replace(' (you)', ''))}</b><small class="num">${s.week} pts</small><span class="step">${[2, 1, 3][i]}</span></div>` : '<div></div>').join('');
    body = `
    <div class="vcard"><h3>Class ${st.cls} goal <small>under 20% waste</small></h3>
      <div class="goalbar ${cw < .2 ? 'done' : ''}"><i style="width:${Math.min(100, Math.max(4, (.4 - cw) / .2 * 100))}%"></i></div>
      <p class="hint" style="margin-top:8px">${cw < .2 ? `Goal reached! The class left ${pct(cw)} this week.` : `The class left ${pct(cw)} this week.`} You're #${myRank} in the class.</p></div>
    <div class="podium2">${pod}</div>
    <div class="lb">${all.slice(3, 10).map((s, i) => lbRow(s, i + 4, st)).join('')}${myRank > 10 ? `<div class="lb-gap">• • •</div>${lbRow(st, myRank, st)}` : ''}</div>
    <p class="foot">Points come from beating your own usual, so small eaters can win too. Resets every Monday.</p>`;
  } else {
    const rows = PL.schoolRows(), max = Math.max(...rows.map(s => s.red));
    body = `<div class="vcard schools">${rows.map((s, i) => `<div class="sch-row ${s.us ? 'us' : ''}"><span class="num">${i + 1}</span><div><b>${esc(s.name)}${s.us ? ' (us)' : ''}</b><div class="sbar"><i style="width:${s.red / max * 100}%"></i></div></div><b class="num">−${pct(s.red)}</b></div>`).join('')}</div>
    <p class="foot">Ranked by how much less food each school throws away than when it started.</p>`;
  }
  return `<div class="seg" id="rank-seg">${Object.entries(segs).map(([k, v]) => `<button data-seg="${k}" aria-pressed="${ui.seg === k}">${v}</button>`).join('')}</div>${body}`;
}
function lbRow(s, rank, viewer) {
  const stg = PL.stuStage(s);
  return `<div class="lb-row ${s.id === viewer.id ? 'me' : ''}"><span class="lb-rank">${rank}</span><canvas width="40" height="34" data-pet="${s.id}"></canvas><div><div class="lb-name">${esc(nameFor(s, viewer))}</div><div class="lb-sub">${stg.name} Loopi${s.pet.streak >= 3 ? ` · ${s.pet.streak} clean trays in a row` : ''}</div></div><div class="lb-val">${s.week}<small>pts</small></div></div>`;
}

/* ================================================================ Me: badges to wear, history, privacy */
function meTab(st, g) {
  const earned = new Set(G.earned(st).map(b => b.id));
  return `
  <div class="vcard profile2"><canvas width="96" height="80" data-pet="${st.id}" class="pfpet"></canvas><div><b>${esc(st.name)}</b><span>Class ${st.cls} · ${PL.SCHOOL}</span></div></div>
  <div class="statgrid">
    <div>${V.icon('check', 'var(--tint)')}<b class="num">${st.pet.c.lowWaste}</b><span>clean trays</span></div>
    <div>${V.icon('leaf', '#2B8C43')}<b class="num">${st.pet.c.veg}</b><span>veggie tries</span></div>
    <div>${V.icon('recycle', '#8E6A3A')}<b class="num">${g.composted}</b><span>scraps swept up</span></div>
  </div>
  <h4 class="sec">Badges · ${earned.size} of ${G.BADGES.length} · tap one to dress up Loopi</h4>
  <div class="badge-grid">${G.BADGES.map(b => { const got = earned.has(b.id), on = g.eq === b.item;
    return `<button class="bdg ${got ? '' : 'locked'} ${on ? 'on' : ''}" ${got ? `data-wear="${b.item}"` : 'disabled'} aria-pressed="${on}"><canvas width="72" height="60" data-acc="${b.item}"></canvas><b>${b.name}</b><span>${got ? (on ? 'Wearing' : 'Tap to wear') : b.how}</span></button>`; }).join('')}</div>
  <div class="vcard"><h3>Past lunches</h3><div class="hist2">${st.log.map(l => `<div><i style="--p:${Math.round((1 - l.w) * 100)}"></i><span>${l.day}</span><b class="num">${pct(1 - l.w)} eaten</b><em class="num">+${l.pts}</em></div>`).join('')}</div></div>
  <div class="vtips">
    <label class="switch-row"><span>Face sign-in<small class="sw-sub">${st.faceOff ? 'Off: you sign in with your class and register number' : 'On: just look at the scanner'}</small></span><input type="checkbox" role="switch" id="faceopt" ${st.faceOff ? '' : 'checked'}></label>
    <label class="switch-row"><span>Show my name on the class board</span><input type="checkbox" role="switch" id="optin" ${st.hideName ? '' : 'checked'}></label>
  </div>
  <p class="foot">The scanner keeps a match code made from your face, never a photo. It's deleted when you leave the school.</p>`;
}

/* ================================================================ overlays: full-screen room, modals */
function modal(title, html) { ui.modal = { title, html }; render(true); }
function layer(st, g) {
  const el = $('#stu-layer', root); if (!el) return;
  let out = '';
  if (ui.big) out += `<div class="room-full" role="dialog" aria-label="Loopi's room, full screen"><div class="room-full-in">${roomBlock(st, g, true)}</div></div>`;
  if (ui.sheet === 'wardrobe') {
    const owned = G.owned(st);
    out += `<div class="sheet" role="dialog" aria-label="Wardrobe"><header><h3>Wardrobe</h3><span class="gems">${GEM}<b class="num">${g.gems}</b></span><button class="btn small" data-close-sheet>Close</button></header><div class="sheet-body">
      <div class="crates">${Object.entries(G.CRATES).map(([k, c]) => `<div class="crate crate-${k}"><span class="crate-box"></span><b>${c.name}</b><small>${c.w.normal}% · ${c.w.epic}% · ${c.w.legendary}%</small><button class="btn small" data-crate="${k}" ${g.gems >= c.cost ? '' : 'disabled'}>${GEM} ${c.cost}</button></div>`).join('')}</div>
      <p class="hint">Crates only take gems you earned in PlateLoop, never real money. Odds are normal · epic · legendary. A duplicate refunds ${G.DUP_REFUND * 100}%. Badges on the Me tab unlock items too.</p>
      <div class="acc-grid">${G.ACCESSORIES.map(a => { const own = owned.has(a.id), on = g.eq === a.id; return `<button class="acc ${own ? '' : 'locked'} ${on ? 'on' : ''}" data-wear="${a.id}" ${own ? '' : 'disabled'}><canvas width="72" height="60" data-acc="${a.id}"></canvas><b>${a.name}</b><span class="rar rar-${a.rarity}">${own ? (on ? 'Wearing' : RARITY[a.rarity]) : 'Locked'}</span></button>`; }).join('')}</div>
    </div></div>`;
  } else if (ui.sheet === 'barn') {
    out += `<div class="sheet" role="dialog" aria-label="Barn"><header><h3>Barn</h3><button class="btn small" data-close-sheet>Close</button></header><div class="sheet-body">
      <div class="barn-total"><span>Gem bonus on every lunch</span><b class="num">×${G.multiplier(g).toFixed(2)}</b></div>
      <p class="hint">A fully grown Loopi lays an egg when its hearts fill up again. Hatching the egg retires the grown Loopi here, and rarer Loopis give a bigger bonus. Your best Loopi sets the bonus, and every other one adds a little.</p>
      <div class="barn">${[{ name: g.name + ' (active)', form: PL.formOf(st.pet), rarity: g.rarity, stage: g.stage, acc: g.eq, active: true }, ...g.barn].map(p => `<div class="barn-pet ${p.active ? 'active' : ''}"><canvas width="72" height="60" data-barn='${JSON.stringify({ f: p.form, s: p.stage, a: p.acc || null })}'></canvas><div><b>${esc(p.name)}</b><small>${PL.STAGES[p.stage].name} · ${PL.FORMS[p.form].name}</small></div><span class="rar rar-${p.rarity}">${RARITY[p.rarity]}</span></div>`).join('')}</div>
      ${g.eggs.length ? `<p class="hint">${g.eggs.length} egg${g.eggs.length > 1 ? 's' : ''} waiting to hatch on the Loopi tab.</p>` : ''}
    </div></div>`;
  }
  if (ui.modal) out += `<div class="pmodal" role="dialog" aria-label="${esc(ui.modal.title)}"><div class="pmodal-card"><h3>${esc(ui.modal.title)}</h3>${ui.modal.html}<button class="btn primary" data-close>Okay</button></div></div>`;
  el.innerHTML = out;
  $$('[data-close]', el).forEach(b => b.onclick = () => { ui.modal = null; render(true); });
  $$('[data-close-sheet]', el).forEach(b => b.onclick = () => { ui.sheet = null; render(true); });
  $$('[data-crate]', el).forEach(b => b.onclick = () => {
    const res = act(() => G.openCrate(me(), b.dataset.crate));
    if (res.error) return PL.toast(res.error);
    modal(res.dup ? 'Already have it!' : 'New item!', `<canvas class="reveal" width="120" height="100" data-acc="${res.acc.id}"></canvas><p class="center"><b>${res.acc.name}</b> <span class="rar rar-${res.acc.rarity}">${RARITY[res.acc.rarity]}</span></p>${res.dup ? `<p class="hint center">${res.refund} gems refunded.</p>` : ''}`);
  });
  $$('[data-wear]', el).forEach(b => b.onclick = () => act(() => G.wear(me(), b.dataset.wear)));
  $$('canvas[data-barn]', el).forEach(cv => { const d = JSON.parse(cv.dataset.barn); PL.drawPet(cv, { rows: 30, stage: PL.STAGES[d.s].id, form: d.f, mood: 'happy', acc: d.a }); });
}

/* ================================================================ wiring */
function wire(st) {
  const body = $('#stu-body', root);
  const evo = $('#evolve', body);
  if (evo) evo.onclick = () => {
    const res = act(() => G.evolve(me()));
    if (!res) return;
    if (res.type === 'grow') modal('Loopi grew up!', `<canvas class="reveal" width="120" height="100" data-evo="1"></canvas><p class="center">Loopi is ${/^[AEIOU]/.test(res.stage.name) ? 'an' : 'a'} ${res.stage.name.toLowerCase()} now.</p>`);
    else modal('Loopi laid an egg!', `<div class="egg-reveal ${res.rarity}"></div><p class="center">It's a <span class="rar rar-${res.rarity}">${RARITY[res.rarity]}</span> egg. Hatch it on the Loopi tab.</p><p class="hint center">Odds: common 50% · rare 30% · epic 15% · legendary 5%</p>`);
  };
  const hatch = $('#hatch', body);
  if (hatch) hatch.onclick = () => { const r = act(() => G.hatch(me())); if (r) modal('A new Loopi hatched!', `<canvas class="reveal" width="120" height="100" data-evo="1"></canvas><p class="center">Meet your <span class="rar rar-${r}">${RARITY[r]}</span> Loopi. Your grown-up Loopi moved to the Barn and now boosts the gems you earn.</p>`); };
  $$('[data-snack]', body).forEach(b => b.onclick = () => { if (ui.tab !== 'loopi') return; PL.Room.feed(b.dataset.snack); });
  const ow = $('#open-wardrobe', body); if (ow) ow.onclick = () => { ui.sheet = 'wardrobe'; render(true); };
  const ob = $('#open-barn', body); if (ob) ob.onclick = () => { ui.sheet = 'barn'; render(true); };
  $$('#kseg button', body).forEach(b => b.onclick = () => { if (Catch.running) Catch.stop(true); ui.kseg = b.dataset.k; ui.ovenMsg = ''; render(); });
  $$('[data-add]', body).forEach(b => b.onclick = () => {
    const res = act(() => G.ovenAdd(me(), b.dataset.add));
    ui.ovenMsg = { pending: 'Keep going…', cooked: `Cooked <b>${res.snack ? esc(res.snack.name) : ''}</b>! Feed it to Loopi on the Loopi tab.`, rejected: 'No recipe starts like that. The ingredients were thrown away.', spoiled: `Oh no, the ${res.recipe ? res.recipe.name.toLowerCase() : 'dish'} burnt! It went in the bin.`, none: 'You are out of that ingredient.' }[res.result];
    render(true);
  });
  const eo = $('#empty-oven', body); if (eo) eo.onclick = () => { act(() => G.emptyOven(me())); ui.ovenMsg = 'The oven is empty.'; render(true); };
  $$('[data-unlock]', body).forEach(b => b.onclick = () => { if (act(() => G.unlock(me(), b.dataset.unlock))) PL.toast('New recipe unlocked!'); });
  $$('[data-go]', body).forEach(b => b.onclick = () => { ui.tab = b.dataset.go; render(); $('#stu-body').scrollTop = 0; });
  $$('#rank-seg button', body).forEach(b => b.onclick = () => { ui.seg = b.dataset.seg; render(); });
  $$('[data-wear]', body).forEach(b => b.onclick = () => act(() => G.wear(me(), b.dataset.wear)));
  const opt = $('#optin', body);
  if (opt) opt.onchange = () => { st.hideName = !opt.checked; PL.store.save('optin'); };
  const fo = $('#faceopt', body);
  if (fo) fo.onchange = () => { st.faceOff = !fo.checked; PL.store.save('optin'); PL.toast(st.faceOff ? 'Face sign-in is off. Your match code has been deleted from the scanner.' : 'Face sign-in is on. Look at the scanner next time.'); };
}

PL.apps.student = {
  title: 'Loopi',
  mount,
  unmount() { if (Catch.running) Catch.stop(true); ui.big = false; ui.sheet = null; root = null; },
  update(kind, fromSelf) {
    const ls = PL.S.lastScan;
    if (!fromSelf && ls && ls.at > ui.seenScan) {
      ui.seenScan = ls.at;
      if (ls.sid === PL.S.me) PL.toast(ls.kind === 'before' ? 'Tray scanned. Enjoy your lunch!' : `Lunch scanned, +${ls.xp} points. Loopi's food is in the bowl.`);
    }
    if (Catch.running) return;
    render(kind !== 'me');
  },
  tick(t) {
    if (!root) return;
    PL.paintPets($('#stu-top', root), t);
    const pg = $('.petguide canvas', root); if (pg) PL.paintPets(pg.parentElement, t);
    if (ui.tab === 'me' || ui.sheet === 'wardrobe') paint(t);
  },
};
})();
