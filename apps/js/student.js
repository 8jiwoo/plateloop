/* Student app (phone): Loopi (hunger, hearts, evolution, snacks, petting), Kitchen (Eco Booth, oven,
   compost worm farm, recipes), Play (Healthy Catch), Ranks, Me (lunches, quests, badges),
   plus Wardrobe and Barn sheets. Game rules live in js/game.js. */
(() => {
'use strict';
const { $, $$, pct, esc, MENU, FORMS } = PL;
const G = PL.game;

const ui = { tab: 'loopi', seg: 'students', kseg: 'booth', mseg: 'today', lcd: 'pet', seenScan: 0, sheet: null, modal: null, ovenMsg: '', hearts: 0 };
let root = null;

const TAB_ICONS = {
  loopi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 0 7 4.5 7 9.5S16 21 12 21s-7-3.5-7-8.5S8 3 12 3Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9.5" cy="12" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12" r="1.3" fill="currentColor"/></svg>',
  kitchen: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="11" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5v4M6 12.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15.5" cy="11.5" r="1.2" fill="currentColor"/><circle cx="17.5" cy="14" r="1.2" fill="currentColor"/></svg>',
  health: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 12h3l1.5-2.5 2 4 1.5-1.5H17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ranks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V13h5v7M9 20V8h6v12M15 20v-9h5v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const TAB_NAMES = { loopi: 'Loopi', health: 'Health', kitchen: 'Game', ranks: 'Ranks', me: 'Me' };
const GEM = '<svg class="gem" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h8l3 4-7 8-7-8Z" fill="#5FB8E8" stroke="#2A6F99" stroke-width="1"/><path d="M1 6h14M6 2 5 6l3 8 3-8-1-4" fill="none" stroke="#2A6F99" stroke-width=".8"/></svg>';
const HEART = on => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14 2.5 8.5A3.3 3.3 0 0 1 8 4a3.3 3.3 0 0 1 5.5 4.5Z" fill="${on ? 'var(--persim)' : 'none'}" stroke="${on ? 'var(--persim)' : 'var(--ink-3)'}" stroke-width="1.5"/></svg>`;
const RARITY_LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', normal: 'Normal' };
const ING = t => `<canvas class="ing" width="32" height="32" data-ing="${t}" aria-label="${G.INGREDIENTS[t].name}"></canvas>`;
const BADGE_ICONS = {
  first: '<path d="M6 13l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  small: '<path d="M4 11h16a8 8 0 0 1-16 0Z M9 6c0 1 1 1 1 2M14 6c0 1 1 1 1 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  streak: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 2 3 2 3s1-3 1-7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  veg: '<path d="M5 19C5 10 11 5 20 5c0 9-5 14-14 14Zm0 0 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  chef: '<path d="M7 20h10M8 20v-6a4 4 0 1 1 1-7.5 4 4 0 0 1 6 0A4 4 0 1 1 16 14v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  worm: '<path d="M4 14c2-4 4 4 6 0s4 4 6 0 3-2 4-1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  adult: '<path d="M4 17l2-9 4 4 2-6 2 6 4-4 2 9Z M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  top3: '<path d="M8 4h8v5a4 4 0 0 1-8 0Zm0 2H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

const me = () => PL.student(PL.S.me) || PL.S.students[0];
const displayName = (s, viewer) => s.id === viewer.id ? `${s.name} (you)` : s.hideName ? 'A Loopi friend' : s.name;
const act = fn => { const out = fn(); PL.store.save('game'); return out; };

/* ================================================================ mount + frame */
function mount(el) {
  root = el;
  ui.seenScan = PL.S.lastScan ? PL.S.lastScan.at : 0;
  el.innerHTML = `
  <div class="stu">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon" aria-hidden="true"><canvas width="44" height="37" data-form="leafy" data-stage="child"></canvas></span><div><b>Loopi</b><span>by PlateLoop</span></div></div>
      <div class="eyebrow" style="margin-top:6px">Signed in as (demo)</div>
      <div class="chips" id="stu-who"></div>
      <p class="stu-note">Connected to the scanner. Every tray scanned before and after lunch feeds Loopi, fills the Eco Booth with the food you saved, and moves you up the leaderboards. No real money, ever.</p>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone" id="phone">
      <header class="phone-top" id="stu-top"></header>
      <div class="phone-body" id="stu-body"></div>
      <nav class="phone-tabs" role="tablist" aria-label="Student app">
        ${Object.keys(TAB_NAMES).map(t => `<button role="tab" data-tab="${t}">${TAB_ICONS[t]}${TAB_NAMES[t]}</button>`).join('')}
      </nav>
      <div id="stu-layer"></div>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { if (Catch.running) Catch.stop(true); ui.big = false; ui.tab = b.dataset.tab; render(); $('#stu-body').scrollTop = 0; });
  el.onkeydown = e => { if (e.key === 'Escape' && ui.big) { ui.big = false; render(true); } };
  render();
}

function render(keepScroll) {
  if (!root) return;
  const st = me(), g = G.ensure(st), body = $('#stu-body', root);
  const scroll = body.scrollTop;
  $('#stu-who', root).innerHTML = PL.S.students.filter(s => s.named).map(s => `<button class="chip" data-sid="${s.id}" aria-pressed="${s.id === st.id}"><canvas width="26" height="22" data-pet="${s.id}"></canvas>${esc(s.name)}</button>`).join('');
  $$('#stu-who button', root).forEach(b => b.onclick = () => { if (Catch.running) Catch.stop(true); ui.sheet = null; ui.modal = null; PL.S.me = b.dataset.sid; PL.store.save('me'); });
  $('#stu-top', root).innerHTML = `<canvas width="40" height="34" data-pet="${st.id}"></canvas><div><b>Hi, ${esc(st.name)}</b><span>Class ${st.cls}</span></div><div class="pts"><b class="num">${st.week}</b><span>pts</span></div><div class="gems" title="Gems">${GEM}<b class="num">${g.gems}</b></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ loopi: loopiTab, health: healthTab, kitchen: kitchenTab, ranks: ranksTab, me: meTab })[ui.tab](st, g);
  layer(st, g);
  wire(st, g);
  PL.paintPets(root);
  G.paintIcons(root);
  drawLCD();
  if (ui.tab === 'kitchen' && ui.kseg === 'catch') Catch.attach();
  wireRoom();
  PL.$$('canvas[data-qr]', root).forEach(drawQR);
  if (keepScroll) body.scrollTop = scroll;
}

/* ================================================================ Loopi */
function loopiTab(st, g) {
  const pet = st.pet, stg = PL.stuStage(st), form = PL.formOf(pet), req = G.heartsReq(g), max = G.hungerMax(g);
  const next = PL.STAGES[g.stage + 1];
  const title = stg.id === 'egg' ? `${esc(g.name)} · Egg` : `${esc(g.name)} · ${stg.name}${stg.id === 'adult' ? ' · ' + FORMS[form].name : ''}`;
  return `
  ${roomBlock(st, g, false)}
  <div class="card stack" style="gap:10px">
    <div class="row spread"><h3>${title}</h3><span class="rar rar-${g.rarity}">${RARITY_LABEL[g.rarity]}</span></div>
    <div class="meter"><span>Hunger</span><div class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < g.hunger ? 'on' : ''}"></i>`).join('')}</div><span class="num">${g.hunger}/${max}</span></div>
    <div class="meter"><span>Hearts</span><div class="hearts">${Array.from({ length: req }, (_, i) => HEART(i < g.hearts)).join('')}</div><span class="num">${g.hearts}/${req}</span></div>
    <p class="hint">${g.ready ? 'Hearts are full!' : `${g.meals} of ${G.MEALS_PER_HEART} meals to the next heart. Lunch scans and snacks both count.`}${g.hunger === 0 ? ' Loopi is sleepy. One meal wakes it up.' : ''}</p>
    ${g.ready ? `<button class="btn primary big" id="evolve">${next ? `Evolve into ${/^[AEIOU]/.test(next.name) ? 'an' : 'a'} ${next.name}` : 'Lay an egg'}</button>` : ''}
    ${g.eggs.length ? `<button class="btn big" id="hatch">Hatch the ${RARITY_LABEL[g.eggs[0]].toLowerCase()} egg${g.eggs.length > 1 ? ` (+${g.eggs.length - 1} more)` : ''}</button>` : ''}
    ${[['Energy', pet.en, ''], ['Nutrition', pet.nu, 'nu'], ['Joy', pet.jo, 'jo']].map(([n, v, c]) => `<div class="stat"><span>${n}</span><div class="bar ${c}"><i style="width:${v}%"></i></div><span class="num">${v}</span></div>`).join('')}
  </div>
  <div class="two"><button class="btn" id="open-wardrobe">Wardrobe · ${g.acc.length}/${G.ACCESSORIES.length}</button><button class="btn" id="open-barn">Barn · ${g.barn.length} Loopi${g.barn.length === 1 ? '' : 's'}</button></div>
  <div class="crave"><canvas class="px" width="52" height="44" data-pet="${st.id}"></canvas><div><b>Loopi is craving spinach</b><span class="hint">Taste it at lunch for Spinach Week, ${Math.min(pet.quest, 3)} of 3 done</span><div class="pips q">${[0, 1, 2].map(i => `<i class="${i < pet.quest ? 'on' : ''}"></i>`).join('')}</div></div></div>
  <div class="card"><h3>Where Loopi is heading</h3><p class="hint">The adult form depends on your lunch habits.</p>
    <div class="forms">${Object.entries(FORMS).map(([k, F]) => `<div class="form ${k === form ? 'lead' : ''}"><canvas width="46" height="38" data-form="${k}"></canvas><div><b>${F.name}</b>${pet.c[F.key]} ${F.why}</div></div>`).join('')}</div></div>
  <details class="how card"><summary>How Loopi works</summary><ul>
    <li><b>Hunger</b> fills up when you return your lunch tray or feed a snack. Leaving less than usual fills it more.</li>
    <li>Every ${G.MEALS_PER_HEART} meals earn a <b>heart</b>. Full hearts let Loopi evolve: egg, baby, child, adult.</li>
    <li>A grown-up Loopi <b>lays an egg</b>. Hatching it moves the grown-up to your Barn, where it boosts your Eco Booth.</li>
    <li>The <b>Eco Booth</b> fills with food you saved at lunch. Search it for ingredients and gems.</li>
    <li>Loopi never dies and never loses hearts. Hunger only drops once per school day, and weekends and holidays pause it.</li>
    <li>Gems are only earned in PlateLoop. They can't be bought.</li></ul></details>`;
}

/* ================================================================ Kitchen */
function kitchenTab(st, g) {
  const segs = { booth: 'Eco Booth', cook: 'Cook', compost: 'Compost', recipes: 'Recipes', catch: 'Catch' };
  const seg = `<div class="seg" id="kseg">${Object.entries(segs).map(([k, v]) => `<button data-k="${k}" aria-pressed="${ui.kseg === k}">${v}</button>`).join('')}</div>`;
  const ingGrid = (counts, extra) => `<div class="ing-grid">${Object.keys(G.INGREDIENTS).map(t => `<div class="ing-cell">${ING(t)}<b class="num">${counts[t]}</b><small>${G.INGREDIENTS[t].name}${extra && extra[t] ? ` · +${extra[t]} grown` : ''}</small></div>`).join('')}</div>`;
  if (ui.kseg === 'catch') return seg + playTab(st, g);
  if (ui.kseg === 'booth') {
    const mult = G.multiplier(g), fill = Math.min(100, g.eco / .6 * 100);
    return `${seg}
    <div class="card booth">
      <div class="eyebrow">Eco Booth</div>
      <div class="bin"><div class="bin-lid"></div><div class="bin-body"><div class="bin-fill" style="height:${fill}%"></div></div></div>
      <div class="booth-kg num">${g.eco.toFixed(2)} kg</div>
      <p class="hint">Food you <b>saved</b> at lunch compared with your usual. It fills a little more after every tray you return.</p>
      <span class="pill">Barn bonus ×${mult.toFixed(2)}</span>
      <button class="btn primary big" id="search" ${g.eco < G.BOOTH_KG_PER_ING ? 'disabled' : ''}>Search the booth</button>
    </div>
    <div class="card"><h3>Your ingredients</h3>${ingGrid(g.ing, g.grown)}</div>`;
  }
  if (ui.kseg === 'cook') {
    const known = G.RECIPES.filter(rc => G.recipeUnlocked(g, rc));
    return `${seg}
    <div class="card">
      <h3>Oven</h3><p class="hint">Add ingredients in a recipe's order. A wrong order or a burnt dish goes to the compost.</p>
      <div class="oven">${Array.from({ length: G.OVEN_CAP }, (_, i) => `<div class="slot">${g.oven[i] ? ING(g.oven[i].t) + (g.oven[i].grown ? '<em>grown</em>' : '') : ''}</div>`).join('')}</div>
      <p class="oven-msg" role="status">${ui.ovenMsg || '&nbsp;'}</p>
      <div class="ing-grid add">${Object.keys(G.INGREDIENTS).map(t => `<button class="ing-cell" data-add="${t}" ${g.ing[t] + g.grown[t] ? '' : 'disabled'}>${ING(t)}<b class="num">${g.ing[t] + g.grown[t]}</b><small>${G.INGREDIENTS[t].name}</small></button>`).join('')}</div>
      ${g.oven.length ? `<button class="btn small ghost" id="empty-oven" style="margin-top:8px">Empty the oven into the compost</button>` : ''}
    </div>
    <div class="card"><h3>Recipes you know</h3><div class="recipes">${known.map(rc => `<div class="recipe"><div class="seq">${rc.seq.map(ING).join('')}</div><div><b>${rc.name}</b><small>+${rc.hunger} hunger</small></div></div>`).join('')}</div></div>`;
  }
  if (ui.kseg === 'compost') {
    return `${seg}
    <div class="card">
      <div class="eyebrow">Worm farm</div><h3 style="margin-top:2px">Compost bin</h3>
      <p class="hint" style="margin-top:4px">Burnt dishes and wrong recipes end up here, so nothing is wasted. Turn the compost and the worms grow some scraps back into fresh ingredients. Cooking with compost-grown ingredients can make a dish come out golden.</p>
      <div class="bin-items">${g.bin.length ? g.bin.map(ING).join('') : '<span class="hint">The bin is empty.</span>'}</div>
      <button class="btn primary big" id="compost" ${g.bin.length ? '' : 'disabled'}>Turn the compost · ${G.COMPOST_COST} gems</button>
    </div>
    <div class="card"><h3>Compost-grown ingredients</h3>${ingGrid(g.grown)}</div>`;
  }
  return `${seg}
    <div class="card"><h3>Recipe book</h3><p class="hint">Find recipe cards in Healthy Catch to unlock new dishes.</p>
    <div class="recipes">${G.RECIPES.map(rc => {
      const open = G.recipeUnlocked(g, rc), have = rc.unlock ? g.cards[rc.unlock] : 0;
      return `<div class="recipe ${open ? '' : 'locked'}"><div class="seq">${rc.seq.map(ING).join('')}</div><div><b>${rc.name}</b><small>+${rc.hunger} hunger${open ? '' : ` · cards ${have}/${rc.cost}`}</small></div>${open ? '<span class="pill mint">Known</span>' : `<button class="btn small" data-unlock="${rc.unlock}" ${have >= rc.cost ? '' : 'disabled'}>Unlock</button>`}</div>`;
    }).join('')}</div></div>`;
}

/* ================================================================ Play: Healthy Catch */
function playTab(st, g) {
  const left = G.playsLeft(g);
  return `
  <div class="card">
    <div class="row spread"><h3>Healthy Catch</h3><span class="pill">${left} of ${G.PLAYS_PER_DAY} plays left today</span></div>
    <p class="hint" style="margin-top:4px">Catch rice, veggies, protein and fruit. Dodge soda and candy. Rare recipe cards unlock new dishes.</p>
    <div class="catch-wrap"><canvas id="catch" width="300" height="360" aria-label="Healthy Catch game"></canvas>
      <div class="catch-hud" id="catch-hud"></div>
      <div class="catch-cover" id="catch-cover">${left > 0 ? '<button class="btn primary big" id="catch-start">Start</button>' : '<p>No plays left today. Come back tomorrow!</p>'}<small>Move with your finger, the mouse or the ← → keys</small></div>
    </div>
    <div class="catch-ctrl"><button class="btn" id="c-left" aria-label="Move left">◀</button><button class="btn" id="c-right" aria-label="Move right">▶</button></div>
    <div class="legend"><span>${['rice', 'veg', 'protein', 'fruit'].map(t => `<canvas width="22" height="22" data-ing="${t}"></canvas>`).join('')} catch</span><span><canvas width="22" height="22" data-ing="soda"></canvas><canvas width="22" height="22" data-ing="candy"></canvas> avoid</span><span><canvas width="22" height="22" data-ing="card"></canvas> bonus</span></div>
    <p class="hint">Best score: <b class="num">${g.best}</b> · Every 2 foods you catch become 1 ingredient.</p>
  </div>`;
}
const Catch = {
  running: false, raf: 0,
  attach() {
    const cv = $('#catch', root); if (!cv) return;
    this.cv = cv; this.ctx = cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    const startBtn = $('#catch-start', root);
    if (startBtn) startBtn.onclick = () => this.start();
    const move = e => { const r = cv.getBoundingClientRect(); this.target = PL.clamp((e.clientX - r.left) / r.width, .08, .92); };
    cv.onpointerdown = e => { move(e); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (e.buttons || e.pointerType === 'mouse') move(e); };
    const hold = (id, d) => { const b = $(id, root); if (!b) return; b.onpointerdown = () => { this.dir = d; }; b.onpointerup = b.onpointerleave = () => { this.dir = 0; }; };
    hold('#c-left', -1); hold('#c-right', 1);
    this.drawIdle();
  },
  start() {
    const st = me();
    if (!act(() => G.catchStart(st))) return;
    Object.assign(this, { running: true, items: [], x: .5, target: null, dir: 0, score: 0, misses: 0, maxMiss: 5, caught: { rice: 0, veg: 0, protein: 0, fruit: 0 }, cards: { kimbap: 0, rainbow: 0 }, t0: performance.now(), last: performance.now(), next: 0, flash: 0 });
    $('#catch-cover', root).hidden = true;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  },
  stop(abandon) {
    this.running = false; cancelAnimationFrame(this.raf);
    if (abandon) return;
    const res = act(() => G.catchEnd(me(), { caught: this.caught, cards: this.cards, score: this.score }));
    const got = Object.entries(res.got).filter(([, n]) => n > 0);
    const cards = Object.entries(this.cards).filter(([, n]) => n > 0);
    modal('Nice catching!', `<p class="big-num num">${this.score}</p><p class="hint" style="text-align:center">foods caught${res.best ? ' · new best!' : ''}</p>
      <div class="got">${got.map(([t, n]) => `<div>${ING(t)}<b>+${n}</b></div>`).join('') || '<p class="hint">Catch 2 of the same food to earn an ingredient.</p>'}${cards.map(([k, n]) => `<div><canvas width="32" height="32" data-ing="card"></canvas><b>+${n} ${k === 'kimbap' ? 'Kimbap' : 'Rainbow plate'} card</b></div>`).join('')}<div>${GEM}<b>+${res.gems} gems</b></div></div>`);
  },
  loop(now) {
    if (!this.running || !this.cv || !this.cv.isConnected) { this.running = false; return; }
    const dt = Math.min(50, now - this.last); this.last = now;
    const speed = 1 + Math.floor((now - this.t0) / 7000) * .2;
    if (now > this.next) {
      const r = Math.random();
      const kind = r < .03 ? 'card' : r < .2 ? (Math.random() < .5 ? 'soda' : 'candy') : ['rice', 'veg', 'protein', 'fruit'][Math.floor(Math.random() * 4)];
      this.items.push({ kind, x: .08 + Math.random() * .84, y: -.05, card: Math.random() < .7 ? 'kimbap' : 'rainbow' });
      this.next = now + (550 + Math.random() * 450) / speed;
    }
    const vx = .9 * dt / 1000;
    if (this.dir) this.x = PL.clamp(this.x + this.dir * vx, .08, .92);
    else if (this.target != null) this.x += PL.clamp(this.target - this.x, -vx * 1.4, vx * 1.4);
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
  drawBg() {
    const { ctx, cv } = this, W = cv.width, H = cv.height;
    ctx.fillStyle = '#DDF1E6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#C6E6D4'; for (let y = 0; y < H; y += 24) ctx.fillRect(0, y, W, 12);
    ctx.fillStyle = '#8DBF9F'; ctx.fillRect(0, H - 22, W, 22);
  },
  drawIdle() {
    if (!this.cv) return; this.drawBg();
    ['rice', 'veg', 'protein', 'fruit'].forEach((k, i) => G.drawSprite(this.ctx, k, 40 + i * 62, 90 + (i % 2) * 30, 4));
    this.drawBasket(.5);
  },
  drawBasket(x) {
    const { ctx, cv } = this, W = cv.width, H = cv.height, bx = Math.round(x * W - 30), by = Math.round(H * .88);
    ctx.fillStyle = '#8A5A2B'; ctx.fillRect(bx, by, 60, 16);
    ctx.fillStyle = '#B77B3E'; for (let i = 0; i < 60; i += 8) ctx.fillRect(bx + i, by + 3, 4, 10);
    ctx.fillStyle = '#5E3B1A'; ctx.fillRect(bx - 3, by - 3, 66, 4);
  },
  draw(speed) {
    const { ctx, cv } = this, W = cv.width, H = cv.height;
    this.drawBg();
    this.items.forEach(it => G.drawSprite(ctx, it.kind, it.x * W - 16, it.y * H - 12, 4));
    this.drawBasket(this.x);
    if (this.flash > 0) { ctx.fillStyle = 'rgba(224,69,58,.25)'; ctx.fillRect(0, 0, W, H); this.flash--; }
    const hud = $('#catch-hud', root);
    if (hud) hud.innerHTML = `<b class="num">${this.score}</b> caught · <span>${'●'.repeat(this.maxMiss - this.misses)}${'○'.repeat(this.misses)}</span> · ${speed.toFixed(1)}×`;
  },
};



/* ================================================================ Loopi's room (big, interactive) */
const RI = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ROOM_ICONS = {
  feed: RI('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>'),
  play: RI('<circle cx="12" cy="12" r="8"/><path d="M4.5 9.5c4 1 11 1 15 0M4.5 14.5c4-1 11-1 15 0"/>'),
  sweep: RI('<path d="M14 3l-4 9M6 21l2-9h8l2 9Z"/><path d="M10 16v5M14 16v5"/>'),
  night: RI('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  day: RI('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  expand: RI('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  close: RI('<path d="M6 6l12 12M18 6 6 18"/>'),
};
const FOOD = { rice: '#F3EDDA', veg: '#3C9A48', protein: '#F4B400', fruit: '#E0453A' };
function roomBlock(st, g, big) {
  const stg = PL.stuStage(st), crumbs = PL.Room.crumbs.filter(c => !c.fly).length;
  return `
  <div class="room ${big ? 'big' : ''}">
    <canvas class="room-cv" id="${big ? 'room-cv-big' : 'room-cv'}" aria-label="Loopi's room. Tap Loopi to pet it, tap the floor to walk, tap crumbs to sweep them."></canvas>
    <div class="room-say" id="${big ? 'room-say-big' : 'room-say'}" hidden></div>
    <div class="room-hud"><span>${esc(g.name)} · ${stg.name}</span><span class="num">Hunger ${g.hunger}/${G.hungerMax(g)} · Hearts ${g.hearts}/${G.heartsReq(g)}</span></div>
    <button class="room-expand" ${big ? 'data-room="close"' : 'data-room="expand"'} aria-label="${big ? 'Close full screen' : 'Full screen'}">${ROOM_ICONS[big ? 'close' : 'expand']}</button>
  </div>
  <div class="room-actions">
    <button data-room="feed">${ROOM_ICONS.feed}<span>Feed</span></button>
    <button data-room="play">${ROOM_ICONS.play}<span>Play</span></button>
    <button data-room="sweep">${ROOM_ICONS.sweep}<span>Sweep${crumbs ? ` · ${crumbs}` : ''}</span></button>
    <button data-room="lights">${ROOM_ICONS[PL.Room.night ? 'day' : 'night']}<span>${PL.Room.night ? 'Wake up' : 'Lights off'}</span></button>
  </div>
  <div class="snack-strip">${g.snacks.length ? `<span class="hint">Drag a snack to Loopi, or tap it</span><div class="snack-chips">${g.snacks.map(sn => { const rc = G.RECIPES.find(r => r.id === sn.recipe); return `<button class="snack-chip ${sn.golden ? 'golden' : ''}" data-snack="${sn.id}"><span class="seq">${rc.seq.slice(0, 3).map(ING).join('')}</span><b>${esc(sn.name)}</b><small>+${sn.hunger}</small></button>`; }).join('')}</div>`
    : `<span class="hint">No snacks yet. Cook some in the <button class="linkish" data-go="kitchen">Game</button> tab.</span>`}</div>`;
}
const roomHooks = {
  info: () => PL.petOf(me()),
  pet: () => { const gems = act(() => G.petLoopi(me())); if (gems) PL.toast(`Loopi found ${gems} gems!`); },
  eat: id => {
    const st = me(), g = G.ensure(st), sn = g.snacks.find(x => x.id === id);
    if (!sn) { PL.Room.say('No snacks… cook some in the Game tab!'); return null; }
    const rc = G.RECIPES.find(r => r.id === sn.recipe);
    const res = act(() => G.eatSnack(st, sn.id));
    if (!res) return null;
    return { ...res, colors: rc.seq.map(t => FOOD[t]), crumbs: rc.seq.slice(0, 2 + Math.floor(Math.random() * 2)) };
  },
  fetched: () => { const ok = act(() => G.playBall(me())); PL.Room.say(ok ? 'Got it! Joy +3' : 'Got it! (Joy is maxed for today)', 2.4); },
  swept: type => { act(() => G.compostCrumb(me(), type)); if (!PL.Room.crumbs.some(c => !c.done && c !== undefined && !c.fly)) PL.Room.say('All clean! Scraps are in the compost.', 2.4); },
  chatter: crumbs => {
    const st = me(), g = G.ensure(st);
    if (g.ready) return 'My hearts are full! Tap Evolve!';
    if (crumbs) return 'Can you sweep the crumbs into the compost?';
    if (g.hunger <= 1) return 'I\'m hungry… got a snack?';
    if (!st.scanned && !st.before) return 'Scan your tray before lunch!';
    if (st.before && !st.scanned) return 'Enjoy lunch! Scan again after.';
    const lines = ['Try the spinach today!', 'Let\'s play ball!', 'Tap me!', 'Lunch was yummy!', 'Scraps turn into soil. Cool!', 'Pick a portion you\'ll finish!'];
    return lines[Math.floor(Math.random() * lines.length)];
  },
};
function wireRoom() {
  $$('[data-room]', root).forEach(b => b.onclick = () => {
    const a = b.dataset.room, g = G.ensure(me());
    if (a === 'feed') { if (g.snacks.length) PL.Room.feed(g.snacks[0].id); else PL.Room.say('No snacks… cook some in the Game tab!'); }
    else if (a === 'play') PL.Room.throwBall();
    else if (a === 'sweep') { if (PL.Room.crumbs.length) PL.Room.sweepAll(); else PL.Room.say('Nothing to sweep. So clean!'); }
    else if (a === 'lights') { PL.Room.toggleNight(); render(true); }
    else if (a === 'expand') { ui.big = true; render(true); }
    else if (a === 'close') { ui.big = false; render(true); }
  });
  $$('[data-snack]', root).forEach(ch => ch.onpointerdown = e => {
    e.preventDefault();
    const id = ch.dataset.snack, sx = e.clientX, sy = e.clientY; let ghost = null;
    const mv = ev => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { ghost = ch.cloneNode(true); ghost.classList.add('ghost'); document.body.appendChild(ghost); }
      if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
    };
    const up = ev => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (ghost) ghost.remove();
      if (!ghost || PL.Room.overCanvas(ev.clientX, ev.clientY)) PL.Room.feed(id);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  $$('[data-go]', root).forEach(b => b.onclick = () => { ui.big = false; ui.tab = b.dataset.go; render(); });
  const big = $('#room-cv-big', root), small = $('#room-cv', root);
  if (big) PL.Room.attach(big, $('#room-say-big', root), roomHooks);
  else if (small) PL.Room.attach(small, $('#room-say', root), roomHooks);
}

/* ================================================================ Health (Nuvilab-style health care report) */
function healthTab(st, g) {
  const todayN = st.scanned ? st.after.intake : null, latest = todayN || st.log[0].n, label = todayN ? 'Today\'s lunch' : `Last lunch · ${st.log[0].day}`;
  const cls = PL.S.students.filter(s => s.cls === st.cls);
  const days = st.log.slice(0, 5).reverse();
  const clsAvg = i => { const v = cls.map(s => s.log.slice(0, 5).reverse()[i]).filter(Boolean); return { e: v.reduce((a, l) => a + (1 - l.w), 0) / v.length, kcal: v.reduce((a, l) => a + l.n.kcal, 0) / v.length }; };
  const ring = (v, max) => { const r = 42, C = 2 * Math.PI * r, p = Math.min(1, v / max); return `<svg viewBox="0 0 110 110" class="ring" aria-hidden="true"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--fill2)" stroke-width="11"/><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--tint)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/></svg>`; };
  const zb = (k, v) => { const max = PL.TARGET[k] * 1.6, pos = x => Math.min(100, x / max * 100); return `<div class="zbar"><span class="z z1" style="width:${pos(PL.TARGET[k] * .8)}%"></span><span class="z z2" style="left:${pos(PL.TARGET[k] * .8)}%;width:${pos(PL.TARGET[k] * 1.3) - pos(PL.TARGET[k] * .8)}%"></span><i class="${PL.nStatus(k, v)}" style="width:${pos(v)}%"></i></div>`; };
  const word = { low: 'Low', ok: 'Good', high: 'A lot' };
  const bars = (key, fmt, max) => {
    const W = 300, H = 120, bw = 16;
    let svg = `<svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="You compared with your class">`;
    days.forEach((l, i) => { const x = 22 + i * 56, you = key === 'e' ? 1 - l.w : l.n.kcal, avg = clsAvg(i)[key], hy = you / max * H, ha = avg / max * H;
      svg += `<rect x="${x}" y="${H - ha}" width="${bw}" height="${ha}" rx="5" fill="var(--fill3)"/><rect x="${x + bw + 3}" y="${H - hy}" width="${bw}" height="${hy}" rx="5" fill="var(--tint)"/><text class="axis" x="${x + bw}" y="${H + 14}" text-anchor="middle">${l.day.slice(0, 3)}</text>`; });
    return svg + `</svg><div class="mix-key"><span style="--c:var(--tint)">You</span><span style="--c:var(--fill3)">Class average</span><span>${fmt}</span></div>`;
  };
  const clean = st.log.slice(0, 5).filter(l => l.w < .1).length;
  const savedG = Math.round(st.log.slice(0, 5).reduce((a, l) => a + Math.max(0, st.baseline - l.w) * 620, 0));
  const co2 = savedG / 1000 * 2.5;
  const lowK = PL.NUTRIENTS.map(([k]) => k).find(k => PL.nStatus(k, latest[k]) === 'low');
  const tips = [];
  if (lowK === 'p') tips.push(['Protein was low', 'Finish your bulgogi or tofu first. They\'re the best protein on the tray.']);
  else if (lowK === 'c') tips.push(['Carbs were low', 'Have a little more rice. It keeps your energy up for the afternoon.']);
  else if (lowK === 'kcal') tips.push(['You ate less than usual', 'Try a Small portion and finish it all. Loopi still gets full energy.']);
  if (st.log.slice(0, 5).some(l => l.w > .3)) tips.push(['Pick a portion you\'ll finish', 'Your fullest trays came back with a lot left. Small is fine!']);
  tips.push(['Move after lunch', 'Twenty minutes of play at break helps you feel hungry for a balanced lunch.']);
  return `
  <div class="card health-top"><div class="ring-wrap">${ring(latest.kcal, PL.TARGET.kcal)}<div class="ring-in"><b class="num">${latest.kcal}</b><span>of ${PL.TARGET.kcal} kcal</span></div></div>
    <div style="flex:1;min-width:0"><div class="eyebrow">${label}</div><h3 style="margin:2px 0 8px">What you ate</h3>
      ${PL.NUTRIENTS.filter(([k]) => k !== 'kcal').map(([k, name]) => `<div class="hrow"><span>${name}</span>${zb(k, latest[k])}<b class="num ${PL.nStatus(k, latest[k])}">${latest[k]} g</b></div>`).join('')}
      <div class="hleg"><span class="l1">Low</span><span class="l2">Good</span><span class="l3">A lot</span></div></div></div>
  <div class="card"><h3>This week vs. your class</h3><p class="hint">How much of your lunch you ate</p>${bars('e', 'Share eaten', 1)}</div>
  <div class="card"><h3>Calories at lunch</h3><p class="hint">Target ${PL.TARGET.kcal} kcal</p>${bars('kcal', 'kcal', 800)}</div>
  <div class="two">
    <div class="card stat-card"><span class="eyebrow">Clean trays</span><b class="num">${clean}<small>/5</small></b><span class="hint">lunches with under 10% left this week</span></div>
    <div class="card stat-card"><span class="eyebrow">You saved</span><b class="num">${savedG}<small> g</small></b><span class="hint">of food vs. your usual · ${Math.round(co2 * 1000)} g CO₂</span></div>
  </div>
  <div class="card"><h3>Tips for you</h3><div class="tips">${tips.slice(0, 3).map(([t, d]) => `<div><b>${t}</b><span>${d}</span></div>`).join('')}</div></div>
  <p class="hint" style="text-align:center">Targets are for a grade 3 lunch. Only you and your parents see this page.</p>`;
}
/* a demo scan code: finder squares plus modules seeded by the student id (not a real, readable QR) */
function drawQR(cv) {
  const c = cv.getContext('2d'), n = 25, u = Math.floor(cv.width / n), o = Math.floor((cv.width - u * n) / 2);
  let seed = [...cv.dataset.qr].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#1D1D1F';
  const finder = (x, y) => { c.fillRect(o + x * u, o + y * u, 7 * u, 7 * u); c.fillStyle = '#FFFFFF'; c.fillRect(o + (x + 1) * u, o + (y + 1) * u, 5 * u, 5 * u); c.fillStyle = '#1D1D1F'; c.fillRect(o + (x + 2) * u, o + (y + 2) * u, 3 * u, 3 * u); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!inF && rnd() < .48) c.fillRect(o + x * u, o + y * u, u, u); }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
}

/* ================================================================ Ranks (unchanged boards, stage from the game) */
function ranksTab(st) {
  const segs = { students: 'Students', schools: 'Schools' };
  let body = '';
  if (ui.seg === 'students') {
    const all = PL.studentRows(), myRank = all.findIndex(s => s.id === st.id) + 1, top = all.slice(0, 3);
    const pod = [top[1], top[0], top[2]].map((s, i) => s ? `<div class="${i === 1 ? 'p1' : ''}"><span class="medal m${[2, 1, 3][i]}">${[2, 1, 3][i]}</span><canvas width="56" height="47" data-pet="${s.id}"></canvas><b>${esc(displayName(s, st).replace(' (you)', ''))}</b><small class="num">${s.week} pts</small></div>` : '<div></div>').join('');
    let rows = all.slice(3, 10).map((s, i) => lbStudent(s, i + 4, st, `${s.week}<small>pts</small>`)).join('');
    if (myRank > 10) rows += `<div class="lb-gap">• • •</div>` + lbStudent(st, myRank, st, `${st.week}<small>pts</small>`);
    body = `<p class="hint">Class ${st.cls} this week. Points come from leaving less than <b>your own</b> usual, trying food and keeping streaks, so everyone has a fair shot.${myRank <= 3 ? ` You're on the podium!` : ` You're #${myRank}.`}</p>
      <div class="podium">${pod}</div><div class="lb">${rows}</div>
      <label class="optin"><input type="checkbox" id="optin" ${st.hideName ? '' : 'checked'}> Show my name to classmates</label>`;
  } else {
    const rows = PL.schoolRows();
    body = `<p class="hint">Schools in the district using PlateLoop, ranked by how much less food they waste than when they started.</p>
      <div class="lb">${rows.map((s, i) => `<div class="lb-row ${s.us ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}"><span class="lb-rank">${i + 1}</span><div class="sch">${s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div><div><div class="lb-name">${s.name}${s.us ? ' (yours)' : ''}</div><div class="lb-sub">${Math.round(s.kg).toLocaleString('en-US')} kg saved this term</div><div class="lb-bar"><i style="width:${Math.min(100, s.red / .4 * 100)}%"></i></div></div><div class="lb-val">−${pct(s.red)}<small>waste</small></div></div>`).join('')}</div>`;
  }
  return `<div class="seg" id="rank-seg">${Object.entries(segs).map(([k, v]) => `<button data-seg="${k}" aria-pressed="${ui.seg === k}">${v}</button>`).join('')}</div>${body}<p class="hint" style="text-align:center">Resets every Monday</p>`;
}
function lbStudent(s, rank, viewer, val) {
  const F = FORMS[PL.formOf(s.pet)], stg = PL.stuStage(s);
  return `<div class="lb-row ${s.id === viewer.id ? 'me' : ''} ${rank <= 3 ? 'top' + rank : ''}"><span class="lb-rank">${rank}</span><canvas width="44" height="37" data-pet="${s.id}"></canvas><div><div class="lb-name">${esc(displayName(s, viewer))}</div><div class="lb-sub">${stg.id === 'egg' || stg.id === 'baby' ? stg.name : stg.name + ' · ' + F.name}${s.pet.streak >= 3 ? ` · ${s.pet.streak}-day streak` : ''}</div></div><div class="lb-val">${val}</div></div>`;
}

/* ================================================================ Me: lunches, quests, badges */
function meTab(st, g) {
  const segs = { today: 'Today', lunches: 'History', badges: 'Badges' };
  const seg = `<div class="seg" id="mseg">${Object.entries(segs).map(([k, v]) => `<button data-m="${k}" aria-pressed="${ui.mseg === k}">${v}</button>`).join('')}</div>`;
  if (ui.mseg === 'today') {
    const b = st.before, a = st.after, cls = PL.S.classes.find(c => c.id === st.cls), cw = cls.ret / cls.served;
    const bTot = b ? Object.values(b.served).reduce((x, y) => x + y, 0) : 0;
    return `${seg}
    <div class="scanstat">
      <div class="${b ? 'ok' : ''}"><span class="k"><i></i>Before lunch</span><b class="num">${b ? bTot + ' g' : '–'}</b><small>${b ? 'scanned at ' + b.t : 'not scanned yet'}</small></div>
      <div class="${a ? 'ok' : ''}"><span class="k"><i></i>After lunch</span><b class="num">${a ? pct(a.w) + ' left' : '–'}</b><small>${a ? 'scanned at ' + a.t : b ? 'eat, then scan again' : 'after you eat'}</small></div>
    </div>
    ${!st.scanned ? `<div class="card qr-card"><canvas width="116" height="116" data-qr="${st.id}" aria-label="Your QR code"></canvas><div><h3>Your scan code</h3><p class="hint" style="margin-top:4px">Show this at the PlateLoop scanner ${st.before ? 'after lunch' : 'before lunch'}, or tap your card.</p></div></div>` : `<div class="card"><div class="row spread"><h3>Nice lunch!</h3><span class="pill green">+${st.log[0].pts} pts</span></div><p class="hint" style="margin-top:4px">Your usual is ${pct(st.baseline)} left. Loopi has been fed.</p></div>`}
    <div class="card"><div class="eyebrow">Friday lunch</div><h3 style="margin-top:2px">Menu</h3>
      <div class="menu-list">${MENU.map(d => `<div><i style="background:${d.color};box-shadow:inset 0 0 0 1px ${d.edge}"></i>${d.name}${d.id === PL.CRAVING ? ' <span class="pill orange" style="margin-left:6px">Quest</span>' : ''}<span class="num">${d.g.M} g · ${Math.round(d.g.M * d.kcal)} kcal</span></div>`).join('')}</div></div>
    <div class="quest-card big"><div class="eyebrow">Quest of the week</div><b>Spinach Week</b>Taste the spinach namul 3 times. Just trying it counts.<div class="pips q">${[0, 1, 2].map(i => `<i style="background:${i < st.pet.quest ? '#fff' : 'rgba(255,255,255,.35)'}"></i>`).join('')}</div></div>
    <div class="quest-card"><div class="eyebrow">Class quest</div><b>Class ${st.cls} under 20% waste</b><div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, (.2 / cw) * 100)}%"></i></div><span class="${cw < .2 ? 'qdone' : 'hint'}" style="display:block;margin-top:6px">${cw < .2 ? `Done! The class is at ${pct(cw)}.` : `The class is at ${pct(cw)}.`}</span></div>`;
  }
  if (ui.mseg === 'lunches') {
    const wk = st.log.slice(0, 5), avg = wk.reduce((a, l) => a + l.w, 0) / wk.length;
    return `${seg}
    <div class="mini-stats"><div><b class="num">${pct(avg)}</b>left on average this week</div><div><b class="num">${st.pet.c.veg}</b>veggie tries</div><div><b class="num">${st.pet.c.balanced}</b>balanced plates</div></div>
    <div class="card"><h3>Recent lunches</h3><div class="table-wrap"><table><thead><tr><th>Day</th><th>Portion</th><th class="r">Left</th><th class="r">Points</th></tr></thead><tbody>${st.log.map(l => `<tr><td>${l.day}</td><td>${l.portion}</td><td class="r num">${pct(l.w)}</td><td class="r num">+${l.pts}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  const pet = st.pet, cls = PL.S.classes.find(c => c.id === st.cls), cw = cls.ret / cls.served;
  const rank = PL.studentRows().findIndex(s => s.id === st.id) + 1;
  const badges = [
    ['first', 'First scan', true], ['small', 'Small & clean', st.log.some(l => l.portion === 'S' && l.w < .12)],
    ['streak', '3-day streak', pet.streak >= 3], ['veg', 'Veggie explorer', pet.c.veg >= 10],
    ['chef', 'Little chef', G.RECIPES.every(rc => G.recipeUnlocked(g, rc))], ['worm', 'Worm farmer', Object.values(g.grown).some(n => n > 0)],
    ['adult', 'Fully grown', g.stage === 3 || g.barn.length > 0], ['top3', 'Top 3 in class', rank <= 3],
  ];
  return `${seg}
  <div class="card"><div class="row spread"><h3>Badges</h3><span class="hint">${badges.filter(b => b[2]).length} of ${badges.length}</span></div>
    <div class="badges" style="margin-top:12px">${badges.map(([k, n, got]) => `<div class="badge ${got ? '' : 'locked'}"><div class="em"><svg viewBox="0 0 24 24" aria-hidden="true" style="color:${got ? 'var(--persim-ink)' : 'var(--ink-3)'}">${BADGE_ICONS[k]}</svg></div>${n}</div>`).join('')}</div></div>`;
}

/* ================================================================ sheets + modals (drawn over the phone) */
function modal(title, html) { ui.modal = { title, html }; layer(me(), G.ensure(me())); }
function layer(st, g) {
  const el = $('#stu-layer', root); if (!el) return;
  let out = '';
  if (ui.big) out += `<div class="room-full" role="dialog" aria-label="Loopi's room, full screen"><div class="room-full-in">${roomBlock(st, g, true)}</div></div>`;
  if (ui.sheet === 'wardrobe') {
    out += `<div class="sheet" role="dialog" aria-label="Wardrobe"><header><h3>Wardrobe</h3><span class="gems">${GEM}<b class="num">${g.gems}</b></span><button class="btn small" data-close="sheet">Close</button></header><div class="sheet-body">
      <div class="crates">${Object.entries(G.CRATES).map(([k, c]) => `<div class="crate crate-${k}"><b>${c.name}</b><small>${c.w.normal}% · ${c.w.epic}% · ${c.w.legendary}%</small><button class="btn small" data-crate="${k}" ${g.gems >= c.cost ? '' : 'disabled'}>${GEM} ${c.cost}</button></div>`).join('')}</div>
      <p class="hint">Crates use gems earned in PlateLoop only, never real money. The odds (normal · epic · legendary) are always shown. Duplicates refund ${G.DUP_REFUND * 100}%.</p>
      <div class="acc-grid">${G.ACCESSORIES.map(a => { const own = g.acc.includes(a.id), on = g.eq === a.id; return `<button class="acc ${own ? '' : 'locked'} ${on ? 'on' : ''}" data-equip="${a.id}" ${own ? '' : 'disabled'}><canvas width="72" height="60" data-accprev="${a.id}"></canvas><b>${a.name}</b><span class="rar rar-${a.rarity}">${own ? (on ? 'Wearing' : RARITY_LABEL[a.rarity]) : 'Locked'}</span></button>`; }).join('')}</div>
    </div></div>`;
  } else if (ui.sheet === 'barn') {
    const mult = G.multiplier(g);
    out += `<div class="sheet" role="dialog" aria-label="Barn"><header><h3>Barn</h3><button class="btn small" data-close="sheet">Close</button></header><div class="sheet-body">
      <p class="hint">Grown-up Loopis retire here after you hatch a new egg. Your best Loopi sets the Eco Booth bonus, and every other one adds a little more. Rarer Loopis give bigger bonuses.</p>
      <div class="barn-total"><span>Eco Booth bonus</span><b class="num">×${mult.toFixed(2)}</b></div>
      <div class="barn">${[{ name: g.name + ' (active)', form: PL.formOf(st.pet), rarity: g.rarity, stage: g.stage, acc: g.eq, active: true }, ...g.barn].map(p => `<div class="barn-pet ${p.active ? 'active' : ''}"><canvas width="72" height="60" data-barn='${JSON.stringify({ f: p.form, s: p.stage, a: p.acc || null })}'></canvas><div><b>${esc(p.name)}</b><small>${PL.STAGES[p.stage].name} · ${PL.FORMS[p.form].name}</small></div><span class="rar rar-${p.rarity}">${RARITY_LABEL[p.rarity]}</span></div>`).join('')}</div>
      ${g.eggs.length ? `<p class="hint">${g.eggs.length} egg${g.eggs.length > 1 ? 's' : ''} waiting to hatch on the Loopi tab.</p>` : ''}
    </div></div>`;
  }
  if (ui.modal) out += `<div class="pmodal" role="dialog" aria-label="${esc(ui.modal.title)}"><div class="pmodal-card"><h3>${esc(ui.modal.title)}</h3>${ui.modal.html}<button class="btn primary" data-close="modal">Okay</button></div></div>`;
  el.innerHTML = out;
  $$('[data-close]', el).forEach(b => b.onclick = () => { ui[b.dataset.close] = null; if (b.dataset.close === 'modal') render(true); else { layer(me(), G.ensure(me())); wireRoom(); } });
  $$('[data-crate]', el).forEach(b => b.onclick = () => {
    const res = act(() => G.openCrate(me(), b.dataset.crate));
    if (res.error) return PL.toast(res.error);
    ui.modal = { title: res.dup ? 'Already have it!' : 'New accessory!', html: `<canvas class="reveal" width="120" height="100" data-accprev="${res.acc.id}"></canvas><p style="text-align:center"><b>${res.acc.name}</b> <span class="rar rar-${res.acc.rarity}">${RARITY_LABEL[res.acc.rarity]}</span></p>${res.dup ? `<p class="hint" style="text-align:center">${res.refund} gems refunded.</p>` : ''}` };
    layer(me(), G.ensure(me()));
  });
  $$('[data-equip]', el).forEach(b => b.onclick = () => act(() => G.equip(me(), b.dataset.equip)));
  paintLayer(el, st, g, 0);
  G.paintIcons(el);
}
function paintLayer(el, st, g, t) {
  const base = PL.petOf(st);
  $$('canvas[data-accprev]', el).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...base, stage: base.stage === 'egg' ? 'child' : base.stage, mood: 'joy', acc: cv.dataset.accprev }));
  $$('canvas[data-barn]', el).forEach(cv => { const d = JSON.parse(cv.dataset.barn); PL.drawPet(cv, { rows: 30, t, stage: PL.STAGES[d.s].id, form: d.f, mood: 'happy', acc: d.a }); });
  $$('canvas[data-evo]', el).forEach(cv => PL.drawPet(cv, { rows: 30, t, ...base, mood: 'joy' }));
}

/* ================================================================ wiring */
function wire(st, g) {
  const body = $('#stu-body', root);
  $$('[data-lcd]', body).forEach(b => b.onclick = () => { ui.lcd = b.dataset.lcd; $$('[data-lcd]', body).forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawLCD(); });
  const lcd = $('#lcd', body);
  if (lcd) {
    const petIt = () => { const gems = act(() => G.petLoopi(me())); ui.hearts = 6; if (gems) PL.toast(`Loopi found ${gems} gems!`); };
    lcd.onclick = petIt; lcd.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); petIt(); } };
  }
  const evo = $('#evolve', body);
  if (evo) evo.onclick = () => {
    const res = act(() => G.evolve(me()));
    if (!res) return;
    if (res.type === 'evolve') modal(`Loopi evolved!`, `<canvas class="reveal" width="120" height="100" data-evo="1"></canvas><p style="text-align:center">Your Loopi is now a <b>${res.stage.name}</b>.</p>`);
    else modal('Loopi laid an egg!', `<canvas class="reveal egg-reveal" width="120" height="100" data-egg="1"></canvas><p style="text-align:center">It's a <span class="rar rar-${res.rarity}">${RARITY_LABEL[res.rarity]}</span> egg. Hatch it on the Loopi tab.</p>`);
    const eg = $('canvas[data-egg]', root); if (eg) PL.drawPet(eg, { rows: 30, stage: 'egg', progress: 1 });
  };
  const hatch = $('#hatch', body);
  if (hatch) hatch.onclick = () => { const r = act(() => G.hatch(me())); if (r) modal('A new Loopi hatched!', `<canvas class="reveal" width="120" height="100" data-evo="1"></canvas><p style="text-align:center">Meet your <span class="rar rar-${r}">${RARITY_LABEL[r]}</span> Loopi. Your grown-up Loopi moved to the Barn and now boosts your Eco Booth.</p>`); };
  $$('[data-feed]', body).forEach(b => b.onclick = () => {
    const res = act(() => G.eatSnack(me(), b.dataset.feed));
    if (!res) return;
    PL.toast(res.wasFull ? 'Loopi was already full, so no meal counted.' : res.heart ? `Yum! +1 heart${res.ready ? '. Ready to evolve!' : ''}` : 'Yum! Loopi is less hungry.');
  });
  $$('[data-go]', body).forEach(b => b.onclick = () => { ui.tab = b.dataset.go; render(); });
  const ow = $('#open-wardrobe', body); if (ow) ow.onclick = () => { ui.sheet = 'wardrobe'; layer(st, g); };
  const ob = $('#open-barn', body); if (ob) ob.onclick = () => { ui.sheet = 'barn'; layer(st, g); };
  // kitchen
  $$('#kseg button', body).forEach(b => b.onclick = () => { if (Catch.running) Catch.stop(true); ui.kseg = b.dataset.k; ui.ovenMsg = ''; render(); });
  const search = $('#search', body);
  if (search) search.onclick = () => {
    const res = act(() => G.boothSearch(me()));
    const got = Object.entries(res.got).filter(([, n]) => n > 0);
    modal('Found in the booth!', `<p class="hint" style="text-align:center">${res.kg.toFixed(2)} kg of saved food × ${res.mult.toFixed(2)} barn bonus</p><div class="got">${got.map(([t, n]) => `<div>${ING(t)}<b>+${n} ${G.INGREDIENTS[t].name}</b></div>`).join('')}${res.gems ? `<div>${GEM}<b>+${res.gems} gems</b></div>` : ''}</div>`);
    G.paintIcons($('#stu-layer', root));
  };
  $$('[data-add]', body).forEach(b => b.onclick = () => {
    const res = act(() => G.ovenAdd(me(), b.dataset.add));
    ui.ovenMsg = { pending: 'Keep going…', cooked: `Cooked <b>${res.snack ? esc(res.snack.name) : ''}</b>! It's waiting in Snacks.`, rejected: 'No recipe starts like that. The ingredients went to the compost.', spoiled: `Oh no, the ${res.recipe ? res.recipe.name.toLowerCase() : 'dish'} burnt! It went to the compost.`, none: 'You are out of that ingredient.' }[res.result];
    render(true);
  });
  const eo = $('#empty-oven', body); if (eo) eo.onclick = () => { act(() => G.emptyOven(me())); ui.ovenMsg = 'The oven is empty. The ingredients went to the compost.'; render(true); };
  const cp = $('#compost', body);
  if (cp) cp.onclick = () => {
    const res = act(() => G.compost(me()));
    if (res.error) return PL.toast(res.error);
    const got = Object.entries(res.got).filter(([, n]) => n > 0);
    modal(res.worms ? 'The worms helped!' : 'Compost turned', `${res.worms ? '<p class="hint" style="text-align:center">Worms are composting heroes: they gave every scrap a second chance.</p>' : ''}<div class="got">${got.map(([t, n]) => `<div>${ING(t)}<b>+${n} grown ${G.INGREDIENTS[t].name.toLowerCase()}</b></div>`).join('') || '<p class="hint">Nothing grew back this time. The scraps became soil.</p>'}</div>`);
    G.paintIcons($('#stu-layer', root));
  };
  $$('[data-unlock]', body).forEach(b => b.onclick = () => { if (act(() => G.unlock(me(), b.dataset.unlock))) PL.toast('New recipe unlocked!'); });
  // ranks + me
  $$('#rank-seg button', body).forEach(b => b.onclick = () => { ui.seg = b.dataset.seg; render(); });
  $$('#mseg button', body).forEach(b => b.onclick = () => { ui.mseg = b.dataset.m; render(); });
  const opt = $('#optin', body);
  if (opt) opt.onchange = () => { st.hideName = !opt.checked; PL.store.save('optin'); };
}
function drawLCD(t = 0) {
  const cv = root && $('#lcd', root); if (!cv) return;
  const st = me(), pet = st.pet, g = G.ensure(st);
  if (ui.lcd === 'pet') {
    PL.drawPet(cv, { rows: 30, t, ...PL.petOf(st), mood: ui.hearts > 0 ? 'joy' : PL.petOf(st).mood });
    if (ui.hearts > 0) { const ctx = cv.getContext('2d'); ctx.fillStyle = PL.LCD.ink; const k = 6 - ui.hearts; [[20, 30 - k * 3], [100, 22 - k * 3]].forEach(([x, y]) => { [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]].forEach(([a, b]) => ctx.fillRect(x + a * 3, y + b * 3, 3, 3)); }); ui.hearts--; }
  } else if (ui.lcd === 'stats') PL.lcdText(cv, [{ text: g.name.toUpperCase(), size: 11 }, { label: 'FOOD', bar: g.hunger / G.hungerMax(g) * 100 }, { label: 'LOVE', bar: g.hearts / G.heartsReq(g) * 100 }, { label: 'JOY', bar: pet.jo }]);
  else PL.lcdText(cv, [{ text: 'QUEST', size: 12 }, { text: 'TASTE THE', size: 10 }, { text: 'SPINACH', size: 13 }, { text: `${Math.min(pet.quest, 3)} OF 3 DONE`, size: 10 }]);
}

PL.apps.student = {
  title: 'Loopi',
  catchGame: Catch,
  mount,
  unmount() { if (Catch.running) Catch.stop(true); ui.big = false; root = null; },
  update(kind, fromSelf) {
    const ls = PL.S.lastScan;
    if (!fromSelf && ls && ls.at > ui.seenScan) {
      ui.seenScan = ls.at;
      if (ls.sid === PL.S.me) PL.toast(`Loopi just ate lunch! +${ls.xp} points`);
    }
    if (Catch.running) { const top = $('#stu-top b.num', root); return; }
    render(kind !== 'me');
  },
  tick(t) {
    if (!root) return;
    drawLCD(t);
    PL.paintPets($('#stu-top', root), t);
    const layerEl = $('#stu-layer', root);
    if (layerEl && layerEl.innerHTML) paintLayer(layerEl, me(), G.ensure(me()), t);
  },
};
})();
