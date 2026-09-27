/* Loopi, the student app for teens and university students: a Tamagotchi fed by real lunches.
   Loopi (the room: feed it the lunch you ate, sweep up your leftovers, play, grow it up), Lunch (the two
   scans, your tray, your plate and your week), Ranks (class and schools) and Me (badges to wear, history).
   Rules: js/game.js. Room: js/room.js. Drawings: js/visual.js. */
(() => {
'use strict';
const { $, $$, pct, esc, MENU, DISH, FORMS } = PL;
const G = PL.game, V = PL.V;

const ui = { tab: 'loopi', seg: 'class', big: false, modal: null, seenScan: 0 };
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
};
const TABS = { loopi: 'Loopi', lunch: 'Lunch', ranks: 'Ranks', me: 'Me' };
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
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone" id="phone">
      <header class="phone-top" id="stu-top"></header>
      <div class="phone-body" id="stu-body"></div>
      <nav class="phone-tabs" role="tablist" aria-label="Loopi">
        ${Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}">${ICON[t]}${TABS[t]}</button>`).join('')}
      </nav>
      <div id="stu-layer"></div>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { ui.big = false; ui.tab = b.dataset.tab; render(); $('#stu-body').scrollTop = 0; });
  el.onkeydown = e => { if (e.key === 'Escape' && ui.big) { ui.big = false; render(true); } };
  render();
}
function render(keepScroll) {
  if (!root) return;
  const st = me(), g = G.ensure(st), body = $('#stu-body', root), scroll = body.scrollTop;
  $('#stu-who', root).innerHTML = PL.S.students.filter(s => s.named).map(s => `<button class="chip" data-sid="${s.id}" aria-pressed="${s.id === st.id}"><canvas width="26" height="22" data-pet="${s.id}"></canvas>${esc(s.name)}</button>`).join('');
  $$('#stu-who button', root).forEach(b => b.onclick = () => { ui.modal = null; ui.big = false; PL.S.me = b.dataset.sid; PL.store.save('me'); });
  $('#stu-top', root).innerHTML = `<canvas width="40" height="34" data-pet="${st.id}"></canvas><div><b>${esc(st.name)}</b><span>Class ${st.cls} · ${PL.SCHOOL}</span></div><div class="pts"><b class="num">${st.week}</b><span>points this week</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ loopi: loopiTab, lunch: lunchTab, ranks: ranksTab, me: meTab })[ui.tab](st, g);
  layer(st, g);
  wire(st);
  paint(0);
  wireRoom();
  if (keepScroll) body.scrollTop = scroll;
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
  ${g.ready ? `<button class="btn primary big" id="evolve">Grow into ${/^[AEIOU]/.test(next.name) ? 'an' : 'a'} ${next.name.toLowerCase()}</button>` : `<p class="foot">${foot}</p>`}
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
  pet: () => act(() => G.petLoopi(me())),
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
      ${leftG > 20 ? V.tip('recycle', 'info', `${leftG} g went to the compost bin`, 'It shows up as crumbs in Loopi\'s room until you sweep them.') : V.tip('check', 'good', 'Hardly anything left', 'Your tray grew a fruit on the school\'s Green Tree.')}
    </div>`;
  }
  const days = st.log.slice(0, 5).reverse(), tries = Math.min(3, st.pet.quest);
  out += `<div class="vcard"><h3>This week <small>share of lunch eaten</small></h3>${V.week(days.map(l => l.day), days.map(l => 1 - l.w), { today: days.findIndex(l => l.day.startsWith('Fri')) })}</div>
  <div class="vcard"><h3>${c.name.replace('Stir-fried ', '')} week <small>${tries} of 3 tries</small></h3><div class="tries">${[0, 1, 2].map(i => `<div class="${i < tries ? 'on' : ''}">${V.food(c, 42)}<span>${i < tries ? 'Tried!' : `Try ${i + 1}`}</span></div>`).join('')}</div></div>`;
  return out;
}

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
    <div>${V.icon('recycle', '#8E6A3A')}<b class="num">${g.composted}</b><span>scraps composted</span></div>
  </div>
  <h4 class="sec">Badges · ${earned.size} of ${G.BADGES.length} · tap one to dress up Loopi</h4>
  <div class="badge-grid">${G.BADGES.map(b => { const got = earned.has(b.id), on = g.eq === b.item;
    return `<button class="bdg ${got ? '' : 'locked'} ${on ? 'on' : ''}" ${got ? `data-wear="${b.item}"` : 'disabled'} aria-pressed="${on}"><canvas width="72" height="60" data-acc="${b.item}"></canvas><b>${b.name}</b><span>${got ? (on ? 'Wearing' : 'Tap to wear') : b.how}</span></button>`; }).join('')}</div>
  <div class="vcard"><h3>Past lunches</h3><div class="hist2">${st.log.map(l => `<div><i style="--p:${Math.round((1 - l.w) * 100)}"></i><span>${l.day}</span><b class="num">${pct(1 - l.w)} eaten</b><em class="num">+${l.pts}</em></div>`).join('')}</div></div>
  <div class="vtips">
    <div class="switch-row"><span>Face sign-in</span><span class="g-v">On</span></div>
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
  if (ui.modal) out += `<div class="pmodal" role="dialog" aria-label="${esc(ui.modal.title)}"><div class="pmodal-card"><h3>${esc(ui.modal.title)}</h3>${ui.modal.html}<button class="btn primary" data-close>Okay</button></div></div>`;
  el.innerHTML = out;
  $$('[data-close]', el).forEach(b => b.onclick = () => { ui.modal = null; render(true); });
}

/* ================================================================ wiring */
function wire(st) {
  const body = $('#stu-body', root);
  const evo = $('#evolve', body);
  if (evo) evo.onclick = () => {
    const stage = act(() => G.evolve(me()));
    if (stage) modal('Loopi grew up!', `<canvas class="reveal" width="120" height="100" data-evo="1"></canvas><p class="center">Loopi is ${/^[AEIOU]/.test(stage.name) ? 'an' : 'a'} ${stage.name.toLowerCase()} now.</p>`);
  };
  $$('[data-go]', body).forEach(b => b.onclick = () => { ui.tab = b.dataset.go; render(); $('#stu-body').scrollTop = 0; });
  $$('#rank-seg button', body).forEach(b => b.onclick = () => { ui.seg = b.dataset.seg; render(); });
  $$('[data-wear]', body).forEach(b => b.onclick = () => act(() => G.wear(me(), b.dataset.wear)));
  const opt = $('#optin', body);
  if (opt) opt.onchange = () => { st.hideName = !opt.checked; PL.store.save('optin'); };
}

PL.apps.student = {
  title: 'Loopi',
  mount,
  unmount() { ui.big = false; root = null; },
  update(kind, fromSelf) {
    const ls = PL.S.lastScan;
    if (!fromSelf && ls && ls.at > ui.seenScan) {
      ui.seenScan = ls.at;
      if (ls.sid === PL.S.me) PL.toast(ls.kind === 'before' ? 'Tray scanned. Enjoy your lunch!' : `Lunch scanned, +${ls.xp} points. Loopi's food is in the bowl.`);
    }
    render(kind !== 'me');
  },
  tick(t) {
    if (!root) return;
    PL.paintPets($('#stu-top', root), t);
    const pg = $('.petguide canvas', root); if (pg) PL.paintPets(pg.parentElement, t);
    if (ui.tab === 'me') paint(t);
  },
};
})();
