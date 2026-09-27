/* Loopi, the student app. Four tabs: Loopi (the room), Lunch (today's two scans and what you ate),
   Ranks (class and schools) and Me (badges, past lunches). Rules: js/game.js. Room: js/room.js. */
(() => {
'use strict';
const { $, $$, pct, esc, MENU, DISH, FORMS } = PL;
const G = PL.game;

const ui = { tab: 'loopi', seg: 'class', big: false, modal: null, seenScan: 0 };
let root = null;

const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  loopi: I('<path d="M12 3c4 0 7 4.5 7 9.5S16 21 12 21s-7-3.5-7-8.5S8 3 12 3Z"/><circle cx="9.5" cy="12" r=".8" fill="currentColor"/><circle cx="14.5" cy="12" r=".8" fill="currentColor"/>'),
  lunch: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 11h18M10 5v6M14.5 11v8"/>'),
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
const FACE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16a4 4 0 0 0 5 0"/></svg>`;
const PORTION = { S: 'Small', M: 'Regular', L: 'Large' };
const HEART = on => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 2.5 8.5A3.3 3.3 0 0 1 8 4a3.3 3.3 0 0 1 5.5 4.5Z" fill="${on ? '#FF2D55' : 'none'}" stroke="${on ? '#FF2D55' : 'var(--label3)'}" stroke-width="1.5"/></svg>`;

const me = () => PL.student(PL.S.me) || PL.S.students[0];
const act = fn => { const out = fn(); PL.store.save('game'); return out; };
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const pips = (n, max, cls) => `<span class="pips ${cls}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const nameFor = (s, viewer) => s.id === viewer.id ? `${s.name} (you)` : s.hideName ? 'Classmate' : s.name;

/* ================================================================ mount + frame */
function mount(el) {
  root = el;
  ui.seenScan = PL.S.lastScan ? PL.S.lastScan.at : 0;
  el.innerHTML = `
  <div class="stu">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon" aria-hidden="true"><canvas width="44" height="37" data-form="leafy" data-stage="child"></canvas></span><div><b>Loopi</b><span>by PlateLoop</span></div></div>
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
  $('#stu-top', root).innerHTML = `<canvas width="40" height="34" data-pet="${st.id}"></canvas><div><b>${esc(st.name)}</b><span>Class ${st.cls}</span></div><div class="pts"><b class="num">${st.week}</b><span>points this week</span></div>`;
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
  $$('canvas[data-acc]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...PL.petOf(st), stage: PL.petOf(st).stage === 'egg' ? 'baby' : PL.petOf(st).stage, mood: 'happy', acc: cv.dataset.acc }));
  $$('canvas[data-evo]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...PL.petOf(st), mood: 'joy' }));
}

/* ================================================================ Loopi */
function loopiTab(st, g) {
  const max = G.hungerMax(g), req = G.heartsReq(g), next = PL.STAGES[g.stage + 1];
  const form = PL.formOf(st.pet), F = FORMS[form], joy = Math.round(st.pet.jo / 20);
  const line = G.heartLine(st);
  const foot = g.ready ? '' : g.stage === 3 && g.hearts >= req
    ? 'Loopi is fully grown.'
    : `A tray with less than ${pct(line)} left earns a heart. Your usual is ${pct(st.baseline)}.`;
  return `
  ${roomBlock(st, g, false)}
  <section class="group">
    <div class="g-row"><span class="g-k">Food</span>${pips(g.hunger, max, 'food')}<span class="g-v num">${g.hunger}/${max}</span></div>
    <div class="g-row"><span class="g-k">Happy</span>${pips(joy, 5, 'joy')}<span class="g-v num">${joy}/5</span></div>
    <div class="g-row"><span class="g-k">Hearts</span><span class="hearts">${Array.from({ length: req }, (_, i) => HEART(i < g.hearts)).join('')}</span><span class="g-v num">${g.hearts}/${req}</span></div>
  </section>
  ${g.ready ? `<button class="btn primary big" id="evolve">Grow into ${/^[AEIOU]/.test(next.name) ? 'an' : 'a'} ${next.name.toLowerCase()}</button>` : `<p class="foot">${foot}</p>`}
  <section class="group grow">
    <canvas width="56" height="47" data-form="${form}" data-stage="adult"></canvas>
    <div><b>${g.stage === 3 ? `${F.name} Loopi` : `Will grow up ${F.name}`}</b><span>${st.pet.c[F.key]} ${F.why} so far. What you eat decides how Loopi looks.</span></div>
  </section>`;
}

/* ================================================================ Loopi's room */
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
    if (st.pet.quest < 3) lines.push('What does kailan taste like?');
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

/* ================================================================ Lunch: the two scans, what you ate, nutrition */
function lunchTab(st) {
  const b = st.before, a = st.after;
  const step = (done, n, title, sub) => `<div class="step ${done ? 'done' : ''}"><span class="step-n">${done ? ICON.check : n}</span><div><b>${title}</b><span>${sub}</span></div></div>`;
  let out = `
  <section class="group steps">
    ${step(!!b, 1, 'Before you eat', b ? `${sum(b.served)} g on your tray · ${b.t}` : 'Scan your full tray at the scanner')}
    ${step(!!a, 2, 'After you eat', a ? `${pct(a.w)} left · ${a.t}` : 'Scan it again before you put it away')}
  </section>`;
  if (!a) out += `<section class="group qr"><span class="face-ic">${FACE}</span><div><b>Just look at the camera</b><span>The scanner knows your face, so there's nothing to tap or carry.</span></div></section>`;

  if (a && a.measured) {
    out += `<h4 class="sec">What you ate</h4><section class="group">${MENU.map(d => {
      const sv = a.served[d.id], lf = Math.round(a.measured[d.id]), ate = sv ? 1 - lf / sv : 1;
      return `<div class="dish"><i style="background:${d.color};border-color:${d.edge}"></i><span>${d.name}</span><span class="dbar"><i style="width:${Math.round(ate * 100)}%"></i></span><span class="g-v num">${lf < 3 ? 'all gone' : `${lf} g left`}</span></div>`;
    }).join('')}</section>
    <p class="foot">${a.zero ? 'Nothing left. That tray grew a fruit on the school tree.' : a.w < st.baseline ? `Less left than your usual ${pct(st.baseline)}.` : `A bit more than your usual ${pct(st.baseline)}. A smaller portion is fine.`}${a.co2 > 0 ? ` You kept about ${a.co2} g of CO₂ out of the air today.` : ''}</p>`;
  } else {
    out += `<h4 class="sec">Today's menu</h4><section class="group">${MENU.map(d => `<div class="dish"><i style="background:${d.color};border-color:${d.edge}"></i><span>${d.name}${d.id === PL.CRAVING && st.pet.quest < 3 ? ' <em class="tag">Kailan week</em>' : ''}</span><span class="g-v num">${Math.round(d.g.M * d.kcal)} kcal</span></div>`).join('')}</section>`;
  }

  const n = a ? a.intake : st.log[0].n, when = a ? 'today' : st.log[0].day.split(' ')[0];
  const zb = (k, v) => { const max = PL.TARGET[k] * 1.6, pos = x => Math.min(100, x / max * 100); return `<div class="zbar"><span class="z z1" style="width:${pos(PL.TARGET[k] * .8)}%"></span><span class="z z2" style="left:${pos(PL.TARGET[k] * .8)}%;width:${pos(PL.TARGET[k] * 1.3) - pos(PL.TARGET[k] * .8)}%"></span><i class="${PL.nStatus(k, v)}" style="width:${pos(v)}%"></i></div>`; };
  const r = 42, C = 2 * Math.PI * r, p = Math.min(1, n.kcal / PL.TARGET.kcal);
  out += `<h4 class="sec">Nutrition, ${when}</h4>
  <section class="group health-top">
    <div class="ring-wrap"><svg viewBox="0 0 110 110" class="ring" aria-hidden="true"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--fill2)" stroke-width="11"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--tint)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/></svg><div class="ring-in"><b class="num">${n.kcal}</b><span>of ${PL.TARGET.kcal} kcal</span></div></div>
    <div style="flex:1;min-width:0">${PL.NUTRIENTS.filter(([k]) => k !== 'kcal').map(([k, name]) => `<div class="hrow"><span>${name}</span>${zb(k, n[k])}<b class="num ${PL.nStatus(k, n[k])}">${n[k]} g</b></div>`).join('')}
      <div class="hleg"><span class="l1">Low</span><span class="l2">Good</span><span class="l3">A lot</span></div></div>
  </section>`;

  const days = st.log.slice(0, 5).reverse(), cls = PL.S.students.filter(s => s.cls === st.cls);
  const clsAvg = i => { const v = cls.map(s => s.log.slice(0, 5).reverse()[i]).filter(Boolean); return v.reduce((x, l) => x + (1 - l.w), 0) / v.length; };
  const Hh = 110, bw = 16;
  let svg = `<svg viewBox="0 0 300 ${Hh + 18}" role="img" aria-label="How much you ate each day, next to your class">`;
  days.forEach((l, i) => { const x = 22 + i * 56, you = (1 - l.w) * Hh, avg = clsAvg(i) * Hh; svg += `<rect x="${x}" y="${Hh - avg}" width="${bw}" height="${avg}" rx="5" fill="var(--fill3)"/><rect x="${x + bw + 3}" y="${Hh - you}" width="${bw}" height="${you}" rx="5" fill="var(--tint)"/><text class="axis" x="${x + bw}" y="${Hh + 14}" text-anchor="middle">${l.day.slice(0, 3)}</text>`; });
  out += `<h4 class="sec">This week</h4><section class="group chart">${svg}</svg><div class="mix-key"><span style="--c:var(--tint)">You</span><span style="--c:var(--fill3)">Class 3B</span><span>share of lunch eaten</span></div></section>`;

  const c = PL.S.classes.find(c => c.id === st.cls), cw = c.ret / c.served;
  out += `<h4 class="sec">Goals</h4><section class="group">
    <div class="goal"><div><b>Kailan week</b><span>Taste the stir-fried kailan 3 times. A bite counts.</span></div>${pips(Math.min(3, st.pet.quest), 3, 'q')}</div>
    <div class="goal"><div><b>Class ${st.cls} under 20% waste</b><span>The class is at ${pct(cw)} this week.</span></div>${cw < .2 ? `<span class="ok-mark">${ICON.check}</span>` : `<span class="g-v num">${pct(cw)}</span>`}</div>
  </section>`;
  return out;
}

/* ================================================================ Ranks */
function ranksTab(st) {
  const segs = { class: `Class ${st.cls}`, schools: 'Schools' };
  let body;
  if (ui.seg === 'class') {
    const all = PL.studentRows(), myRank = all.findIndex(s => s.id === st.id) + 1, top = all.slice(0, 3);
    const pod = [top[1], top[0], top[2]].map((s, i) => s ? `<div class="${i === 1 ? 'p1' : ''}"><span class="medal m${[2, 1, 3][i]}">${[2, 1, 3][i]}</span><canvas width="56" height="47" data-pet="${s.id}"></canvas><b>${esc(nameFor(s, st).replace(' (you)', ''))}</b><small class="num">${s.week} pts</small></div>` : '<div></div>').join('');
    let rows = all.slice(3, 10).map((s, i) => lbRow(s, i + 4, st)).join('');
    if (myRank > 10) rows += `<div class="lb-gap">• • •</div>` + lbRow(st, myRank, st);
    body = `<div class="podium">${pod}</div><div class="lb">${rows}</div>
      <p class="foot">Points come from beating your own usual, so small eaters can win too. Resets on Monday.</p>`;
  } else {
    body = `<div class="lb">${PL.schoolRows().map((s, i) => `<div class="lb-row ${s.us ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}"><span class="lb-rank">${i + 1}</span><div class="sch">${s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div><div><div class="lb-name">${s.name}${s.us ? ' (yours)' : ''}</div><div class="lb-sub">${Math.round(s.kg).toLocaleString('en-US')} kg saved this term</div><div class="lb-bar"><i style="width:${Math.min(100, s.red / .4 * 100)}%"></i></div></div><div class="lb-val">−${pct(s.red)}<small>waste</small></div></div>`).join('')}</div>
      <p class="foot">Ranked by how much less food each school throws away than when it started.</p>`;
  }
  return `<div class="seg" id="rank-seg">${Object.entries(segs).map(([k, v]) => `<button data-seg="${k}" aria-pressed="${ui.seg === k}">${v}</button>`).join('')}</div>${body}`;
}
function lbRow(s, rank, viewer) {
  const stg = PL.stuStage(s);
  return `<div class="lb-row ${s.id === viewer.id ? 'me' : ''} ${rank <= 3 ? 'top' + rank : ''}"><span class="lb-rank">${rank}</span><canvas width="44" height="37" data-pet="${s.id}"></canvas><div><div class="lb-name">${esc(nameFor(s, viewer))}</div><div class="lb-sub">${stg.name}${s.pet.streak >= 3 ? ` · ${s.pet.streak} clean trays in a row` : ''}</div></div><div class="lb-val">${s.week}<small>pts</small></div></div>`;
}

/* ================================================================ Me: badges, past lunches, privacy */
function meTab(st, g) {
  const earned = new Set(G.earned(st).map(b => b.id));
  return `
  <section class="group profile">
    <canvas width="120" height="100" data-pet="${st.id}"></canvas>
    <div><b>${esc(st.name)}</b><span>Class ${st.cls} · Harbourlight Primary</span></div>
  </section>
  <div class="me-stats">
    <div><b class="num">${st.pet.c.lowWaste}</b><span>clean trays</span></div>
    <div><b class="num">${st.pet.c.veg}</b><span>veggie tries</span></div>
    <div><b class="num">${g.composted}</b><span>scraps composted</span></div>
  </div>
  <h4 class="sec">Badges · ${earned.size} of ${G.BADGES.length}</h4>
  <div class="badge-grid">${G.BADGES.map(b => { const got = earned.has(b.id), on = g.eq === b.item;
    return `<button class="bdg ${got ? '' : 'locked'} ${on ? 'on' : ''}" ${got ? `data-wear="${b.item}"` : 'disabled'} aria-pressed="${on}"><canvas width="72" height="60" data-acc="${b.item}"></canvas><b>${b.name}</b><span>${got ? (on ? 'Wearing' : 'Tap to wear') : b.how}</span></button>`; }).join('')}</div>
  <h4 class="sec">Past lunches</h4>
  <section class="group">${st.log.map(l => `<div class="g-row hist"><span class="g-k">${l.day}</span><span>${PORTION[l.portion]}</span><span class="g-v num">${pct(l.w)} left</span><b class="num">+${l.pts}</b></div>`).join('')}</section>
  <h4 class="sec">Privacy</h4>
  <section class="group">
    <div class="switch-row"><span>Face sign-in</span><span class="g-v">On</span></div>
    <label class="switch-row"><span>Show my name on the class board</span><input type="checkbox" role="switch" id="optin" ${st.hideName ? '' : 'checked'}></label>
  </section>
  <p class="foot">The scanner stores a match code made from your face, never a photo, and it stays inside the scanner. It's deleted when you leave the school.</p>`;
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
    if (ui.tab === 'me') $$('canvas[data-acc]', root).forEach(cv => { const st = me(), o = PL.petOf(st); PL.drawPet(cv, { rows: 30, t, ...o, stage: o.stage === 'egg' ? 'baby' : o.stage, mood: 'happy', acc: cv.dataset.acc }); });
  },
};
})();
