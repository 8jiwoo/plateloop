/* PlateLoop Kitchen: the admin side of PlateLoop. What the scanners measured today (served, eaten, wasted),
   which dishes come back, and what to buy for tomorrow, planned from what people really eat.
   Pages: overview, purchasing (plan & order), waste by dish, nutrition, carbon and reports. */
(() => {
'use strict';
const { $, $$, pct, fmt1, money, esc, MENU, rng, clamp } = PL;

const HISTORY = (() => { const r = rng(11); return Array.from({ length: 30 }, (_, i) => i < 10 ? .29 + (r() - .5) * .04 : clamp(.29 - (i - 9) * .0065 + (r() - .5) * .03, .12, .35)); })();
const TREND = { kailan: [.46, +17, 'Kailan Week quest is working: 46% → 63% eaten on quest days.'], cabbage: [.55, +1, 'Serve 25 g by default and let students take more.'], melon: [.88, +1, 'Popular. Keep it.'], rice: [.82, +4, 'More students choose Small since portion sizes started.'], chicken: [.94, +2, 'Most popular dish. Keep the portion.'], soup: [.58, -2, 'Cut the default ladle from 200 to 150 ml.'] };
const TOMORROW = [
  { id: 'rice', name: 'Rice', std: 180, learned: 148, err: .05, tags: ['grain'], bom: [['Rice (raw)', .42, 2.2]] },
  { id: 'curry', name: 'Chicken curry', std: 150, learned: 131, err: .06, tags: ['protein'], bom: [['Chicken thigh', .22, 7.5], ['Potato', .22, 1.6], ['Carrot', .10, 1.8], ['Onion', .12, 1.4], ['Curry paste', .06, 8.0]] },
  { id: 'soup', name: 'Fishball soup', std: 200, learned: 122, err: .09, tags: ['soup'], bom: [['Fishballs', .08, 9.0], ['Chinese cabbage', .10, 2.0], ['Soy sauce', .02, 3.0]] },
  { id: 'tofu', name: 'Fried tofu', std: 70, learned: 55, err: .08, tags: ['protein'], bom: [['Firm tofu', .9, 3.2], ['Cooking oil', .05, 2.5]] },
  { id: 'sprout', name: 'Bean sprout side', std: 50, learned: 29, err: .11, tags: ['veg'], bom: [['Bean sprouts', .95, 2.4], ['Sesame oil', .02, 12]] },
  { id: 'cucumber', name: 'Cucumber salad', std: 40, learned: 22, err: .10, tags: ['veg'], bom: [['Cucumber', 1.0, 2.2]] },
  { id: 'fruit', name: 'Papaya', std: 85, learned: 81, err: .03, tags: ['fruit'], bom: [['Papaya', 1.0, 2.0]] },
];
const INVENTORY = { 'Rice (raw)': 60, 'Onion': 8, 'Soy sauce': 10, 'Cooking oil': 15, 'Sesame oil': 2, 'Curry paste': 3 };
const ENROLLED = 840;
const MAPE = TOMORROW.reduce((a, d) => a + d.err, 0) / TOMORROW.length;
const SEED_MIX = { S: 35, M: 84, L: 21 }; // portion sizes of the 140 trays scanned before the demo starts

const ui = { view: 'overview', plan: { att: 812, weather: 'sunny', event: 'normal' }, seen: null, prev: {} };
let root = null;
const SV = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const NAV = [
  ['overview', 'Overview', SV('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>')],
  ['plan', 'Purchasing', SV('<path d="M3 4h2l2.5 11h11L21 8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>')],
  ['dishes', 'Waste', SV('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>')],
  ['nutrition', 'Nutrition', SV('<path d="M12 21c-4.5-2.5-8-6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 11c0 4-3.5 7.5-8 10Z"/>')],
  ['carbon', 'Carbon', SV('<path d="M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17 18Z"/><path d="M9.5 14.5h5"/>')],
  ['report', 'Reports', SV('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>')],
];
const IC = {
  tray: SV('<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M9 7v11M15 7v11"/>'),
  leaf: SV('<path d="M5 19c0-8 5-14 15-14 0 9-6 14-15 14ZM5 19l8-8"/>'),
  bin: SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  cloud: SV('<path d="M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17 18Z"/>'),
  cart: SV('<path d="M3 4h2l2.5 11h11L21 8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>'),
  scan: SV('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/>'),
  spark: SV('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>'),
  chev: SV('<path d="M9 6l6 6-6 6"/>'), up: SV('<path d="M7 14l5-5 5 5"/>'), down: SV('<path d="M7 10l5 5 5-5"/>'),
  check: SV('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
};

function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="kit kx">
    <div class="kx-ambient" aria-hidden="true"><i></i><i></i><i></i></div>
    <main class="kit-main" id="kit-main"></main>
    <footer class="kx-footer"><span class="kx-mark" aria-hidden="true"></span>PlateLoop Kitchen · ${PL.SCHOOL} · two scanners<button class="kx-link" data-reset>Reset demo</button></footer>
    <div class="kx-fade" aria-hidden="true"></div>
    <div class="kx-dock" id="kx-dock">
      <div class="kx-scrim" data-dock-close></div>
      <nav class="kx-fan" aria-label="Kitchen pages">${NAV.map(([id, label, ic], i) => { const a = Math.PI * .9 - i / (NAV.length - 1) * Math.PI * .8;
        return `<button class="kx-fan-b" data-view="${id}" style="--i:${i};--x:${Math.cos(a).toFixed(3)};--y:${(-Math.sin(a)).toFixed(3)}" tabindex="-1"><span class="kx-fan-ic">${ic}</span><span class="kx-fan-l">${label}</span></button>`; }).join('')}</nav>
      <span class="kx-cap" id="kx-cap" aria-live="polite"></span>
      <button class="kx-orb" id="kx-dot" aria-expanded="false" aria-label="Pages"><span class="kx-orb-ic" id="kx-dot-ic"></span><span class="kx-orb-x">${SV('<path d="M6 6l12 12M18 6 6 18"/>')}</span></button>
    </div>
  </div>`;
  $$('.kx-fan-b', el).forEach(b => b.onclick = () => { dock(false); go(b.dataset.view); });
  $('#kx-dot', el).onclick = () => dock(!ui.dock);
  $('[data-dock-close]', el).onclick = () => dock(false);
  // 1–6 jump between pages
  ui.onKey = e => { if (e.key === 'Escape' && ui.dock) return dock(false); if (e.target.closest && e.target.closest('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return; const n = +e.key; if (n >= 1 && n <= NAV.length) { dock(false); go(NAV[n - 1][0]); } };
  addEventListener('keydown', ui.onKey);
  render(true);
}
/** Open or close the page fan above the green dot. */
function dock(open) {
  ui.dock = open;
  const d = root && $('#kx-dock', root); if (!d) return;
  d.classList.toggle('open', open);
  $('#kx-dot', d).setAttribute('aria-expanded', String(open));
  $$('.kx-fan-b', d).forEach(b => { b.tabIndex = open ? 0 : -1; });
  if (open) { const cur = $(`.kx-fan-b[data-view="${ui.view}"]`, d); if (cur) cur.focus({ preventScroll: true }); }
}
/** Switch page: the content slides in from the side you're heading to. */
function go(view) {
  if (view === ui.view) return;
  const from = NAV.findIndex(n => n[0] === ui.view), to = NAV.findIndex(n => n[0] === view);
  ui.dir = to > from ? 1 : -1; ui.view = view;
  render(true);
  scrollTo({ top: 0, behavior: PL.reduceMotion ? 'auto' : 'smooth' });
}
const VIEWS = () => ({ overview, dishes, nutrition, carbon, plan, report });
/** A new view renders fresh (and slides in); live updates to the overview patch it in place. */
function render(force) {
  if (!root) return;
  $$('.kx-fan-b', root).forEach(b => b.dataset.view === ui.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  const cur = NAV.find(n => n[0] === ui.view), dotIc = $('#kx-dot-ic', root);
  if (dotIc && dotIc.dataset.view !== ui.view) { dotIc.innerHTML = cur[2]; dotIc.dataset.view = ui.view; $('#kx-dot', root).setAttribute('aria-label', `Pages, now on ${cur[1]}`); const cap = $('#kx-cap', root); if (cap && ui.capped) { cap.textContent = cur[1]; cap.classList.remove('show'); void cap.offsetWidth; cap.classList.add('show'); } ui.capped = true; if (dotIc.animate && !PL.reduceMotion) dotIc.animate([{ transform: 'scale(.4) rotate(-40deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }
  const main = $('#kit-main', root), html = VIEWS()[ui.view]();
  if (!force && main.dataset.view === ui.view && ui.view === 'overview') { const tmp = document.createElement('div'); tmp.innerHTML = html; morph(main, tmp); }
  else {
    const changed = main.dataset.view !== ui.view;
    main.innerHTML = html; main.dataset.view = ui.view;
    if (changed && main.animate && !PL.reduceMotion && ui.dir) main.animate([{ opacity: 0, transform: `translateX(${ui.dir * 28}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    PL.motion(main, 'kitchen:' + ui.view, { force: !!force });
  }
  wire(main);
  flashChanges(main);
}
/** Make `a` look like `b`, keeping the nodes that stay the same so bars and numbers move smoothly. */
function morph(a, b) {
  const an = [...a.childNodes], bn = [...b.childNodes];
  if (an.length !== bn.length) { a.innerHTML = b.innerHTML; return; }
  an.forEach((x, i) => {
    const y = bn[i];
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y.cloneNode(true), x); return; }
    if (x.nodeType === 3) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return; }
    if (x.nodeType !== 1) return;
    [...x.attributes].forEach(at => { if (!y.hasAttribute(at.name)) x.removeAttribute(at.name); });
    [...y.attributes].forEach(at => { if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value); });
    morph(x, y);
  });
}
const liveChip = () => `<span class="kx-live"><i></i>Live · ${PL.clock()}</span>`;
function flashChanges(main) {
  $$('[data-live]', main).forEach(n => {
    const k = n.dataset.live, v = n.textContent;
    if (ui.prev[k] !== undefined && ui.prev[k] !== v && !PL.reduceMotion) { n.classList.remove('upd'); void n.offsetWidth; n.classList.add('upd'); }
    ui.prev[k] = v;
  });
}

/* ---------------------------------------------------------------- data helpers */
const T = () => PL.S.today;
const dishStats = () => MENU.map(d => { const x = T().dish[d.id]; return { d, served: x.served, left: x.ret, eaten: x.served - x.ret, e: 1 - x.ret / x.served }; });
function portionMix() {
  const m = { ...SEED_MIX };
  T().feed.filter(f => f.kind === 'before').forEach(f => { m[f.portion]++; });
  const tot = m.S + m.M + m.L;
  return { m, tot };
}
const SHORT = { kailan: 'Kailan', cabbage: 'Cabbage', melon: 'Watermelon', rice: 'Rice', chicken: 'Chicken', soup: 'Soup' };
/** A small line of the last few school days, ending at today's value. */
const spark = (vals, good) => {
  const W = 90, H = 30, lo = Math.min(...vals), hi = Math.max(...vals), k = hi - lo || 1;
  const pts = vals.map((v, i) => [i / (vals.length - 1) * W, H - 3 - (v - lo) / k * (H - 6)]);
  return `<svg class="kx-spark ${good === true ? 'good' : good === false ? 'bad' : ''}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' L')}"/><circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2.6"/></svg>`;
};

/* ================================================================ Overview: the admin's day at a glance */
function overview() {
  const t = T(), tot = PL.todayTotals(), trays = t.trays + t.eating, f = forecast(), saved = f.costStd - f.cost;
  const eaten = 1 - tot.w, co2 = (t.co2 || 0) / 1000, stats = dishStats().sort((a, b) => a.e - b.e);
  const last = HISTORY.slice(-7), wasteTrend = [...last.slice(0, 6), tot.w];
  const todo = [];
  if (!PL.S.order.approved) todo.push({ id: 'order', tone: 'blue', icon: IC.cart, t: 'Approve tomorrow’s order', s: `${money(f.orderTotal)} · supplier cut-off 14:00`, btn: 'Review', go: 'plan' });
  if (t.sc2 !== 'online') todo.push({ id: 'sc2', tone: 'red', icon: IC.scan, t: t.sc2 === 'restarting' ? 'Scanner 2 is reconnecting' : 'Scanner 2 is offline', s: '6 trays waiting on the device, nothing lost', btn: t.sc2 === 'restarting' ? null : 'Restart' });
  if (t.eating > 0 && !t.remind) todo.push({ id: 'remind', tone: 'orange', icon: IC.tray, t: `${t.eating} tray${t.eating > 1 ? 's' : ''} not scanned back`, s: 'Remind students at the tray rack', btn: 'Remind' });
  const top = [...f.orders].filter(o => o.order > 0).sort((a, b) => b.order * b.price - a.order * a.price).slice(0, 5);
  const maxKg = Math.max(...top.map(o => o.kg), 1);
  const ins = stats.slice(0, 3).map(r => ({ d: r.d, e: r.e, tip: TREND[r.d.id] ? TREND[r.d.id][2] : '' }));
  return `
  ${head('Friday 25 September', 'Overview')}

  ${todo.length ? `<section class="kx-group kx-todo" aria-label="To do">${todo.map(x => `<div class="kx-row"><span class="kx-ic" data-tone="${x.tone}">${x.icon}</span><div class="kx-row-t"><b>${x.t}</b><span>${x.s}</span></div>${x.btn ? `<button class="kx-btn ${x.tone === 'blue' ? 'prim' : ''}" data-todo="${x.id}" ${x.go ? `data-go="${x.go}"` : ''}>${x.btn}</button>` : ''}</div>`).join('')}</section>` : ''}

  <section class="kx-widgets">
    <div class="kx-w"><div class="kx-w-h">${IC.tray}<span>Trays scanned</span></div><div class="kx-w-n"><b data-live="trays">${trays}</b></div><div class="kx-w-f"><span>${t.eating} eating now</span>${spark([118, 131, 126, 140, 133, 137, trays])}</div></div>
    <div class="kx-w"><div class="kx-w-h">${IC.leaf}<span>Eaten</span></div><div class="kx-w-n"><b data-live="eaten">${Math.round(eaten * 100)}</b><em>%</em></div><div class="kx-w-f"><span>of ${fmt1(tot.sv / 1000)} kg served</span>${spark([.71, .73, .72, .75, .74, .76, eaten], true)}</div></div>
    <div class="kx-w" style="--wc:var(--orange)"><div class="kx-w-h">${IC.bin}<span>Food wasted</span></div><div class="kx-w-n"><b data-live="waste">${fmt1(tot.lf / 1000)}</b><em>kg</em></div><div class="kx-w-f"><span>${money(tot.val)} of ingredients</span>${spark(wasteTrend, tot.w <= last[0])}</div></div>
    <div class="kx-w" style="--wc:#64D2FF"><div class="kx-w-h">${IC.cloud}<span>CO₂ avoided</span></div><div class="kx-w-n"><b data-live="co2">${fmt1(co2)}</b><em>kg</em></div><div class="kx-w-f"><span>vs the usual leftovers</span>${spark([7.1, 8.4, 8.0, 9.2, 10.1, 10.6, co2], true)}</div></div>
  </section>

  <section class="kx-duo">
    <div class="kx-card">
      <div class="kx-card-h"><div><h2>Tomorrow’s order</h2><p>Monday · ${ui.plan.att} diners expected</p></div><button class="kx-link" data-go="plan">Purchasing${IC.chev}</button></div>
      <div class="kx-order-sum">
        <div><span>To buy</span><b>${money(f.orderTotal)}</b></div>
        <div><span>Less than the standard plan</span><b class="good">${money(saved)}</b></div>
        <div><span>Less food cooked</span><b>${fmt1(f.tStd - f.tNew)} kg</b></div>
      </div>
      <div class="kx-list">${top.map(o => `<div class="kx-buy"><span class="kx-buy-n">${esc(o.ing)}</span><span class="kx-buy-bar"><i class="need" style="width:${(o.kg / maxKg * 100).toFixed(1)}%"></i><i class="stock" style="width:${(Math.min(o.inv, o.kg) / maxKg * 100).toFixed(1)}%"></i></span><b>${fmt1(o.order)} kg</b><em>${money(o.order * o.price)}</em></div>`).join('')}</div>
      <div class="kx-key">${top.some(o => o.inv > 0) ? '<span><i class="stock"></i>In stock</span>' : ''}<span><i class="need"></i>Needed for tomorrow</span></div>
      <div class="kx-order-cta">${PL.S.order.approved ? `<span class="kx-ok">${IC.check}Approved at ${PL.S.order.approved.at}</span>` : `<button class="kx-btn prim wide" data-go="plan">Review and approve</button>`}</div>
    </div>
    <div class="kx-card">
      <div class="kx-card-h"><div><h2>Left on trays</h2><p>Share of each dish that came back today</p></div><button class="kx-link" data-go="dishes">Waste${IC.chev}</button></div>
      <div class="kx-list">${stats.map(r => `<div class="kx-waste"><span class="kx-waste-n">${PL.V.food(r.d, 26)}${esc(SHORT[r.d.id])}</span><span class="kx-waste-bar"><i class="${r.e < .6 ? 'hi' : r.e < .8 ? 'mid' : 'lo'}" style="width:${((1 - r.e) * 100).toFixed(1)}%"></i></span><b data-live="w-${r.d.id}">${pct(1 - r.e)}</b></div>`).join('')}</div>
    </div>
  </section>

  <section class="kx-duo">
    <div class="kx-card"><div class="kx-card-h"><div><h2>Plate waste</h2><p>Last 30 school days, whole school</p></div></div>${chartTrend()}</div>
    <div class="kx-card">
      <div class="kx-card-h"><div><h2>Insights</h2><p>From today’s before and after scans</p></div></div>
      <div class="kx-list">${ins.map(x => `<div class="kx-ins">${PL.V.food(x.d, 34)}<div><b>${esc(x.d.name)} · ${pct(x.e)} eaten</b><span>${esc(x.tip)}</span></div></div>`).join('')}</div>
    </div>
  </section>`;
}

function chartTrend() {
  const W = 640, H = 250, l = 44, r = 16, t = 14, b = 28, iw = W - l - r, ih = H - t - b, max = .35;
  const X = i => l + i / (HISTORY.length - 1) * iw, Y = v => t + ih - v / max * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Plate waste over 30 school days">`;
  s += `<rect x="${l}" y="${t}" width="${X(9.5) - l}" height="${ih}" rx="8" fill="var(--fill)"/><text class="axis" x="${l + 10}" y="${t + 18}">Before PlateLoop</text>`;
  [0, .1, .2, .3].forEach(v => { s += `<line class="gridline" x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${l - 8}" y="${Y(v) + 4}" text-anchor="end">${v * 100}%</text>`; });
  s += `<line x1="${l}" x2="${W - r}" y1="${Y(.15)}" y2="${Y(.15)}" stroke="var(--orange)" stroke-width="1.5" stroke-dasharray="5 5"/><text class="axis" x="${X(10.5)}" y="${Y(.15) + 16}" style="fill:var(--orange)">Goal 15%</text>`;
  const line = HISTORY.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  s += `<defs><linearGradient id="tg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--tint)" stop-opacity=".25"/><stop offset="1" stop-color="var(--tint)" stop-opacity="0"/></linearGradient></defs>`;
  s += `<path d="${line} L${X(29)},${Y(0)} L${X(0)},${Y(0)} Z" fill="url(#tg1)"/><path d="${line}" fill="none" stroke="var(--tint)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  s += `<circle cx="${X(29)}" cy="${Y(HISTORY[29])}" r="5" fill="var(--tint)" stroke="var(--bg2)" stroke-width="2.5"/><text x="${X(29) - 10}" y="${Y(HISTORY[29]) - 12}" text-anchor="end" style="font:600 13px var(--font);fill:var(--label)">${pct(HISTORY[29])}</text>`;
  [0, 9, 19, 29].forEach(i => s += `<text class="axis" x="${X(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">Day ${i + 1}</text>`);
  return s + '</svg>';
}

/* ================================================================ shared pieces, so every page looks the same */
const head = (eyebrow, title, right = '') => `<header class="kx-head"><div><p class="kx-date"><span class="kx-mark" aria-hidden="true"></span><span>PlateLoop Kitchen</span><i>·</i><span>${eyebrow}</span></p><h1>${title}</h1></div><div class="kx-head-r">${right}${liveChip()}</div></header>`;
const widget = (icon, color, label, value, unit, foot, extra = '') => `<div class="kx-w" style="--wc:${color}"><div class="kx-w-h">${icon}<span>${label}</span></div><div class="kx-w-n"><b>${value}</b>${unit ? `<em>${unit}</em>` : ''}</div><div class="kx-w-f"><span>${foot}</span>${extra}</div></div>`;
const card = (title, sub, body, link = '', cls = '') => `<div class="kx-card ${cls}"><div class="kx-card-h"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${link}</div>${body}</div>`;
const goLink = (view, label) => `<button class="kx-link" data-go="${view}">${label}${IC.chev}</button>`;
const bar = (frac, color) => `<span class="kx-bar1"><i style="width:${(clamp(frac, 0, 1) * 100).toFixed(1)}%;background:${color}"></i></span>`;
const GREEN = 'var(--green)', ORANGE = 'var(--orange)', BLUE = 'var(--blue)', RED = 'var(--red)', CYAN = '#64D2FF', PURPLE = '#BF5AF2', GREY = '#8E8E93';

/* ================================================================ Purchasing: tomorrow's order from what people really eat */
function plan() {
  const p = ui.plan;
  return `${head('Monday 28 September', 'Purchasing', `<span class="kx-chip">${IC.spark}Forecast error ${(MAPE * 100).toFixed(1)}%</span>`)}
  <section class="kx-group kx-controls">
    <div class="kx-ctl"><div class="kx-ctl-t"><b>Attendance</b><span id="att-v">${p.att} of ${ENROLLED}</span></div><input type="range" id="att" min="600" max="840" step="1" value="${p.att}" aria-label="Attendance"></div>
    <div class="kx-ctl"><div class="kx-ctl-t"><b>Weather</b></div><div class="kx-seg" id="weather">${['sunny', 'rainy', 'hot'].map(w => `<button data-w="${w}" aria-pressed="${p.weather === w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join('')}</div></div>
    <div class="kx-ctl"><div class="kx-ctl-t"><b>School calendar</b></div><select id="event" class="kx-select">${[['normal', 'Normal day'], ['trip', 'Sec 4 learning journey (−138)'], ['sports', 'Sports day']].map(([v, l]) => `<option value="${v}" ${p.event === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  </section>
  <div id="plan-out">${planOut()}</div>
  ${card('Recipe tweaks that cut waste', 'From four weeks of before and after scans', `<div class="kx-list">${[
    [GREEN, IC.leaf, 'Kailan with oyster sauce', 'Eaten 64% vs 52% plain in the class A/B test. Make it the default.'],
    [BLUE, IC.tray, 'Soup: 150 ml ladle, refills allowed', 'Cuts soup waste from 42% to 24% with no drop in satisfaction.'],
    [ORANGE, IC.bin, 'Cabbage: 25 g default portion', 'Most students leave 10–15 g of a 35 g serving.'],
  ].map(([c, ic, t, s]) => `<div class="kx-li"><span class="kx-ic" style="--c:${c}">${ic}</span><div><b>${t}</b><span>${s}</span></div></div>`).join('')}</div>`)}`;
}
function planOut() {
  const f = forecast(), saved = f.tStd - f.tNew, dollars = f.costStd - f.cost, ap = PL.S.order.approved;
  const maxStd = Math.max(...f.rows.map(r => r.stdKg)), maxKg = Math.max(...f.orders.map(o => o.kg), 1);
  return `<section class="kx-widgets three">
    ${widget(IC.cart, BLUE, 'To buy', money(f.orderTotal), '', `${f.orders.filter(o => o.order > 0).length} ingredients`)}
    ${widget(IC.spark, GREEN, 'Saved vs standard plan', money(dollars), '', `about ${money(dollars * 180)} a school year`)}
    ${widget(IC.leaf, CYAN, 'Less food cooked', fmt1(saved), 'kg', `${Math.round(saved * PL.CO2_PER_KG)} kg CO₂e avoided`)}
  </section>
  <section class="kx-duo">
    ${card('Tomorrow’s menu', `${f.att} diners · standard portion × enrolment vs what people eat`, `<div class="kx-list">${f.rows.map(r => `<div class="kx-menu"><div class="kx-menu-t"><b>${esc(r.d.name)}</b><span>${r.d.learned} g eaten of ${r.d.std} g</span></div>
      <div class="kx-menu-b"><span class="kx-bar1 thin"><i style="width:${(r.stdKg / maxStd * 100).toFixed(1)}%;background:#48484A"></i></span><span class="kx-bar1 thin"><i style="width:${(r.newKg / maxStd * 100).toFixed(1)}%;background:${BLUE}"></i></span></div>
      <div class="kx-menu-n"><b>${fmt1(r.newKg)} kg</b><span class="good">−${fmt1(r.stdKg - r.newKg)}</span></div></div>`).join('')}</div>
      <div class="kx-key"><span><i style="background:#48484A"></i>Standard plan</span><span><i style="background:${BLUE}"></i>PlateLoop plan</span></div>`)}
    ${card('Shopping list', 'Needed tomorrow, minus what’s in stock', `<div class="kx-list">${f.orders.map(o => `<div class="kx-buy"><span class="kx-buy-n">${esc(o.ing)}</span><span class="kx-buy-bar"><i class="need" style="width:${(o.kg / maxKg * 100).toFixed(1)}%"></i><i class="stock" style="width:${(Math.min(o.inv, o.kg) / maxKg * 100).toFixed(1)}%"></i></span><b>${o.order > 0 ? fmt1(o.order) + ' kg' : '—'}</b><em>${o.order > 0 ? money(o.order * o.price) : 'in stock'}</em></div>`).join('')}</div>
      <div class="kx-key"><span><i class="stock"></i>In stock</span><span><i class="need"></i>Needed</span></div>
      <div class="kx-total"><span>Total</span><b>${money(f.orderTotal)}</b></div>
      ${ap ? `<div class="kx-approved"><span class="kx-ok">${IC.check}Approved at ${ap.at}</span><button class="kx-btn" id="unapprove">Undo</button></div><p class="kx-note">In a live system this goes to the supplier. Nothing is sent from this demo.</p>`
        : `<button class="kx-btn prim wide" id="approve">Approve order · ${money(f.orderTotal)}</button><p class="kx-note">Supplier cut-off 14:00.</p>`}`)}
  </section>`;
}

/* ================================================================ Waste: what comes back, dish by dish */
function dishes() {
  const rows = dishStats(), mix = portionMix(), tot = PL.todayTotals(), maxKg = Math.max(...rows.map(r => r.served));
  const byWaste = [...rows].sort((a, b) => a.e - b.e);
  return `${head('Today', 'Waste')}
  <section class="kx-widgets">
    ${widget(IC.bin, ORANGE, 'Left on trays', fmt1(tot.lf / 1000), 'kg', `${money(tot.val)} of ingredients`)}
    ${widget(IC.spark, tot.w < PL.SCHOOL_BASELINE ? GREEN : ORANGE, 'Plate waste', Math.round(tot.w * 100), '%', `baseline ${pct(PL.SCHOOL_BASELINE)}`)}
    ${widget(IC.leaf, GREEN, 'Eaten', fmt1((tot.sv - tot.lf) / 1000), 'kg', `of ${fmt1(tot.sv / 1000)} kg served`)}
    ${widget(IC.check, CYAN, 'Clean trays', Math.round(PL.zeroRate() * 100), '%', `${T().zero} with zero leftovers`)}
  </section>
  ${card('Served, eaten and left', 'Before scans against after scans, today', `<div class="kx-list">${byWaste.map(r => { const [, tr] = TREND[r.d.id];
    return `<div class="kx-dish"><span class="kx-dish-n">${PL.V.food(r.d, 28)}<b>${esc(r.d.name)}</b></span>
      <span class="kx-stackbar" style="width:${(r.served / maxKg * 100).toFixed(1)}%"><i style="flex:${r.eaten};background:${GREEN}"></i><i style="flex:${r.left};background:${ORANGE}"></i></span>
      <span class="kx-dish-v"><b>${pct(r.e)}</b> eaten</span><span class="kx-trend ${tr > 0 ? 'up' : tr < 0 ? 'down' : ''}">${tr > 0 ? IC.up : tr < 0 ? IC.down : ''}${tr ? Math.abs(tr) + ' pts' : 'steady'}</span></div>`; }).join('')}</div>
    <div class="kx-key"><span><i style="background:${GREEN}"></i>Eaten</span><span><i style="background:${ORANGE}"></i>Left on trays</span><span>Bar length = kg served · trend over 4 weeks</span></div>`)}
  <section class="kx-duo">
    ${card('Plate waste', 'Last 30 school days, whole school', chartTrend())}
    ${card('Portion sizes', 'Measured by the before scan', `<div class="kx-mix">${['S', 'M', 'L'].map((q, i) => `<i style="flex:${mix.m[q]};background:${[CYAN, GREEN, ORANGE][i]}"></i>`).join('')}</div>
      <div class="kx-list">${['S', 'M', 'L'].map((q, i) => `<div class="kx-li"><span class="kx-dot" style="background:${[CYAN, GREEN, ORANGE][i]}"></span><div><b>${{ S: 'Small', M: 'Regular', L: 'Large' }[q]}</b></div><em>${pct(mix.m[q] / mix.tot)}</em></div>`).join('')}</div>
      <p class="kx-note">People who take Small leave about half as much as those who take Large.</p>`)}
  </section>
  ${card('What to change', 'One suggestion per dish, least finished first', `<div class="kx-list">${byWaste.map(r => `<div class="kx-li">${PL.V.food(r.d, 30)}<div><b>${esc(r.d.name)}</b><span>${esc(TREND[r.d.id][2])}</span></div><em>${pct(r.e)}</em></div>`).join('')}</div>`)}`;
}

/* ================================================================ Nutrition: what people ate, against the lunch target */
function intakeStats() {
  const done = PL.S.students.filter(s => s.log[0] && s.log[0].n);
  const recent = PL.S.students.map(s => s.scanned ? s.after.intake : s.log[0].n);
  const avg = Object.fromEntries(PL.NUTRIENTS.map(([k]) => [k, Math.round(recent.reduce((a, n) => a + n[k], 0) / recent.length)]));
  const low = PL.S.students.map(s => { const n = s.scanned ? s.after.intake : s.log[0].n; return { s, n, r: n.kcal / PL.TARGET.kcal }; }).filter(x => x.r < .6).sort((a, b) => a.r - b.r);
  return { avg, low, n: recent.length, done: done.length };
}
/** A range bar: the low / adequate / too-much zones and a marker for the value. */
const range = (k, v) => {
  const max = PL.TARGET[k] * 1.6, pos = x => clamp(x / max, 0, 1) * 100, st = PL.nStatus(k, v);
  return `<span class="kx-range"><i class="z1" style="width:${pos(PL.TARGET[k] * .8)}%"></i><i class="z2" style="left:${pos(PL.TARGET[k] * .8)}%;width:${pos(PL.TARGET[k] * 1.3) - pos(PL.TARGET[k] * .8)}%"></i><i class="z3" style="left:${pos(PL.TARGET[k] * 1.3)}%;right:0"></i><s class="${st}" style="left:${pos(v)}%"></s></span>`;
};
function nutrition() {
  const { avg, low, n } = intakeStats(), word = { low: 'Low', ok: 'Adequate', high: 'Too much' };
  const left = Object.fromEntries(MENU.map(d => [d.id, T().dish[d.id].ret])), served = Object.fromEntries(MENU.map(d => [d.id, T().dish[d.id].served]));
  const L = PL.nutrientsOf(left), S = PL.nutrientsOf(served), maxLost = Math.max(...PL.NUTRIENTS.map(([k]) => L[k] / S[k]));
  return `${head('Latest lunch', 'Nutrition')}
  ${card('Average intake per student', `Class 3B · ${n} students · target per lunch for Secondary 3`, `<div class="kx-list">${PL.NUTRIENTS.map(([k, label, unit]) => { const st = PL.nStatus(k, avg[k]);
    return `<div class="kx-nut"><b>${label}</b>${range(k, avg[k])}<span class="kx-nut-v">${avg[k]}${unit === 'g' ? ' g' : ''}<small> / ${PL.TARGET[k]}</small></span><span class="kx-tag ${st}">${word[st]}</span></div>`; }).join('')}</div>
    <div class="kx-key"><span><i style="background:rgba(255,159,10,.45)"></i>Low</span><span><i style="background:rgba(48,209,88,.45)"></i>Adequate</span><span><i style="background:rgba(255,69,58,.4)"></i>Too much</span></div>`)}
  <section class="kx-duo">
    ${card('People to check on', 'Under 60% of the calorie target at their last lunch. Only the dietitian and form teacher see names.', low.length ? `<div class="kx-list">${low.slice(0, 7).map(x => `<div class="kx-li">${PL.V.avatar(x.s, 32)}<div><b>${esc(x.s.name)} · ${x.s.cls}</b><span>${x.n.kcal} kcal · ${x.n.p} g protein</span></div><span class="kx-tag low">${pct(x.r)}</span></div>`).join('')}</div>` : `<p class="kx-empty">${IC.check}Nobody under 60% right now.</p>`, `<span class="kx-count">${low.length}</span>`)}
    ${card('Nutrients left on trays', 'Served but not eaten today, all finished trays', `<div class="kx-list">${PL.NUTRIENTS.map(([k, label, unit]) => `<div class="kx-row2"><b>${label}</b>${bar(L[k] / S[k] / maxLost, ORANGE)}<em>${pct(L[k] / S[k])}</em><span>${unit === 'g' ? fmt1(L[k] / 1000) + ' kg' : Math.round(L[k] / 1000).toLocaleString('en-US') + 'k kcal'}</span></div>`).join('')}</div>
      <p class="kx-note">Vegetables carry most of the lost fibre and vitamins. The Kailan Week quest targets this.</p>`)}
  </section>`;
}

/* ================================================================ Carbon: the canteen's whole footprint */
const EF_FOOD = { rice: 2.7, chicken: 6.1, kailan: 1.2, cabbage: .6, melon: .5, soup: 1.8 };
const EF_DISPOSAL = .58;
const OPS = [['Electricity', 'kitchen, fridges, dishwashers', 9800, 'kWh', .41], ['Cooking gas', 'stoves and steamers', 1450, 'm³', 2.2], ['Water', 'cooking and washing', 310, 'm³', .34], ['Deliveries', '22 supplier trips', 396, 'truck-km', .9]];
const DAYS_PER_MONTH = 20, BEFORE = 1.18, GOAL = .12;
const CARBON_TREND = [1.16, 1.12, 1.07, 1.05, 1.02, 1];
function carbonData() {
  const w = PL.todayTotals().w, meals = ENROLLED * .97 * DAYS_PER_MONTH;
  const food = MENU.map(d => { const kg = d.g.M / 1000 * meals; return { d, kg, t: kg * EF_FOOD[d.id] / 1000 }; });
  const foodT = food.reduce((a, x) => a + x.t, 0);
  const wastedKg = food.reduce((a, x) => a + x.kg * (T().dish[x.d.id].ret / T().dish[x.d.id].served), 0);
  const disposalT = wastedKg * EF_DISPOSAL / 1000;
  const ops = OPS.map(([name, what, qty, unit, f]) => ({ name, what, qty, unit, t: qty * f / 1000 }));
  const opsT = ops.reduce((a, x) => a + x.t, 0);
  const total = foodT + disposalT + opsT;
  const hidden = food.reduce((a, x) => a + x.t * (T().dish[x.d.id].ret / T().dish[x.d.id].served), 0);
  return { w, meals, food, foodT, wastedKg, disposalT, ops, opsT, total, hidden, perMeal: total * 1000 / meals, before: total * BEFORE };
}
function carbon() {
  const c = carbonData(), cut = 1 - c.total / c.before;
  const parts = [['Ingredients', c.foodT, ORANGE], ['Food waste', c.disposalT, RED], ['Energy, water and transport', c.opsT, BLUE]];
  const meat = c.food.find(x => x.d.id === 'chicken');
  const actions = [
    ['Cut plate waste from ' + pct(c.w) + ' to 20%', Math.max(0, (c.w - .2) / c.w) * (c.disposalT + c.hidden) * 10, 'Using the dish-by-dish waste data'],
    ['Go meat-free with tofu one day a week', meat.t * .2 * (1 - 3 / 6.1) * 10, 'Chicken is ' + pct(meat.t / c.foodT) + ' of ingredient emissions'],
    ['Cook to the forecast, not to enrolment', c.foodT * .06 * 10, 'Purchasing already plans about 6% less food'],
    ['Run dishwashers full and off-peak', c.ops[0].t * .08 * 10, 'About 8% less electricity'],
  ].sort((a, b) => b[1] - a[1]);
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], maxT = c.total * 1.25, goalT = c.before * (1 - GOAL);
  const src = [...c.food.map(x => [x.d.name, x.t, 'ingredient']), ...c.ops.map(o => [o.name, o.t, o.what]), ['Food waste disposal', c.disposalT, `${Math.round(c.wastedKg).toLocaleString('en-US')} kg to the bin`]].sort((a, b) => b[1] - a[1]), maxS = src[0][1];
  return `${head('September', 'Carbon', '<button class="kx-btn" id="copy-carbon">Copy monthly report</button>')}
  <section class="kx-widgets">
    ${widget(IC.cloud, CYAN, 'This month', c.total.toFixed(1), 't', 'CO₂e, all sources')}
    ${widget(IC.tray, BLUE, 'Per meal', c.perMeal.toFixed(2), 'kg', `${Math.round(c.meals).toLocaleString('en-US')} meals`)}
    ${widget(IC.down, GREEN, 'Vs before PlateLoop', '−' + Math.round(cut * 100), '%', `goal −${pct(GOAL)} this year`)}
    ${widget(IC.leaf, GREEN, 'Saved today', ((T().co2 || 0) / 1000).toFixed(1), 'kg', 'live, from trays scanned')}
  </section>
  <section class="kx-duo">
    ${card('Where it comes from', `Food thrown away also wastes the ${c.hidden.toFixed(1)} t it took to grow it`, `<div class="kx-mix big">${parts.map(([, v, col]) => `<i style="flex:${v};background:${col}"></i>`).join('')}</div>
      <div class="kx-list">${parts.map(([nm, v, col]) => `<div class="kx-li"><span class="kx-dot" style="background:${col}"></span><div><b>${nm}</b></div><em>${v.toFixed(1)} t · ${pct(v / c.total)}</em></div>`).join('')}</div>`)}
    ${card('Monthly emissions', 't CO₂e, all sources · dashed line is this year’s goal', `<div class="kx-cols">${CARBON_TREND.map((k, i) => `<div class="kx-col${i === 5 ? ' now' : ''}"><div class="kx-col-b"><i style="height:${(c.total * k / maxT * 100).toFixed(1)}%"><em>${(c.total * k).toFixed(1)}</em></i><s style="bottom:${(goalT / maxT * 100).toFixed(1)}%"></s></div><span>${months[i]}</span></div>`).join('')}</div>`)}
  </section>
  <section class="kx-duo">
    ${card('Biggest cuts toward carbon-neutral', 'Tonnes CO₂e a school year', `<div class="kx-list">${actions.map(([t2, v, s], i) => `<div class="kx-li"><span class="kx-ic" style="--c:${[GREEN, BLUE, ORANGE, PURPLE][i]}">${IC.down}</span><div><b>${t2}</b><span>${s}</span></div><em class="good">−${v.toFixed(1)} t</em></div>`).join('')}</div>`)}
    ${card('Every source', 'This month', `<div class="kx-list">${src.map(([nm, t2, what]) => `<div class="kx-row2"><b>${esc(nm)}</b>${bar(t2 / maxS, what === 'ingredient' ? ORANGE : nm.startsWith('Food waste') ? RED : BLUE)}<em>${t2.toFixed(2)} t</em><span>${esc(what)}</span></div>`).join('')}</div>`)}
  </section>
  <p class="kx-foot">Illustrative factors: ${Object.entries(EF_FOOD).map(([k, v]) => `${PL.DISH[k].name.toLowerCase()} ${v}`).join(', ')} kg CO₂e per kg; disposal ${EF_DISPOSAL}; electricity 0.41 per kWh (Singapore grid); gas 2.2 per m³. Replace with published factors before reporting.</p>`;
}
function carbonReport() {
  const c = carbonData();
  return `Carbon report, September. The canteen produced ${c.total.toFixed(1)} t CO₂e this month (${c.perMeal.toFixed(2)} kg per meal): ${c.foodT.toFixed(1)} t from ingredients, ${c.disposalT.toFixed(1)} t from food waste disposal, and ${c.opsT.toFixed(1)} t from energy, water and deliveries. That is ${pct(1 - c.total / c.before)} below the level before PlateLoop, against a goal of ${pct(GOAL)} this year. Plate waste is ${pct(c.w)}; food thrown away also carried ${c.hidden.toFixed(1)} t of ingredient emissions.`;
}

/* ================================================================ the forecast behind Purchasing */
function forecast() {
  const p = ui.plan, att = p.att - (p.event === 'trip' ? 138 : 0);
  const rows = TOMORROW.map(d => {
    let k = 1;
    if (p.weather === 'rainy' && d.id === 'soup') k *= 1.10;
    if (p.weather === 'hot' && d.id === 'soup') k *= .9;
    if (p.weather === 'hot' && d.id === 'fruit') k *= 1.08;
    if (p.event === 'sports' && (d.tags.includes('grain') || d.tags.includes('protein'))) k *= 1.10;
    return { d, stdKg: ENROLLED * d.std / 1000, newKg: att * d.learned * k * (1 + Math.max(.04, d.err + .01)) / 1000 };
  });
  const need = {}, needStd = {};
  rows.forEach(r => r.d.bom.forEach(([ing, ratio, price]) => { need[ing] = need[ing] || { kg: 0, price }; need[ing].kg += r.newKg * ratio; needStd[ing] = (needStd[ing] || 0) + r.stdKg * ratio; }));
  let cost = 0, costStd = 0, orderTotal = 0;
  const orders = Object.entries(need).map(([ing, o]) => { const inv = INVENTORY[ing] || 0, order = Math.max(0, o.kg - inv); cost += o.kg * o.price; costStd += needStd[ing] * o.price; orderTotal += order * o.price; return { ing, kg: o.kg, inv, order, price: o.price }; });
  return { att, rows, orders, cost, costStd, orderTotal, tStd: rows.reduce((a, r) => a + r.stdKg, 0), tNew: rows.reduce((a, r) => a + r.newKg, 0) };
}

/* ================================================================ Reports: written from today's scans */
function reportData() {
  const t = T(), tot = PL.todayTotals(), rows = dishStats().sort((a, b) => a.e - b.e), f = forecast(), mix = portionMix();
  const worst = rows[0], best = rows[rows.length - 1], diff = (PL.SCHOOL_BASELINE - tot.w) * 100;
  const cls = PL.classRows()[0], is = intakeStats();
  const text = [
    ['Today', `${t.trays.toLocaleString('en-US')} trays were scanned before and after lunch, and ${t.eating} people are still eating. Plate waste is ${pct(tot.w)}, ${diff >= 0 ? `${diff.toFixed(0)} points below` : `${(-diff).toFixed(0)} points above`} the ${pct(PL.SCHOOL_BASELINE)} baseline, leaving ${fmt1(tot.lf / 1000)} kg of food (about ${money(tot.val)} of ingredients).`],
    ['Dishes', `${best.d.name} was the most eaten dish (${pct(best.e)}). ${worst.d.name} came back the most, with only ${pct(worst.e)} eaten. ${TREND[worst.d.id][2]}`],
    ['People', `Class ${cls.c.id} leads Secondary 3 with ${pct(cls.red)} less waste than when it started. ${pct(PL.zeroRate())} of trays had zero leftovers, and ${pct(mix.m.S / mix.tot)} were Small portions.`],
    ['Nutrition', `The average student ate ${is.avg.kcal} kcal and ${is.avg.p} g of protein at lunch (targets ${PL.TARGET.kcal} kcal and ${PL.TARGET.p} g). ${is.low.length} ate less than 60% of their calorie target and are flagged for the dietitian.`],
    ['Tomorrow', `The plan cooks ${fmt1(f.tNew)} kg instead of ${fmt1(f.tStd)} kg, saving about ${money(f.costStd - f.cost)} in ingredients. The supplier order totals ${money(f.orderTotal)}.`],
  ];
  return { text, worst, best, f, tot };
}
function report() {
  const { text, worst, f, tot } = reportData();
  const soup = dishStats().find(r => r.d.id === 'soup');
  const tips = [
    [ORANGE, IC.down, `Serve less ${worst.d.name.toLowerCase()}`, TREND[worst.d.id][2]],
    [BLUE, IC.tray, 'Soup is taken, not eaten', `${fmt1(soup.left / 1000)} kg of soup came back today. A 150 ml ladle would cut most of it.`],
    [GREEN, IC.leaf, 'Kailan Week is working', 'Tasting kailan for the quest raised the share eaten by 17 points.'],
    [PURPLE, IC.cart, `Order ${money(f.orderTotal)} for Monday`, `${fmt1(f.tStd - f.tNew)} kg less food cooked than the standard plan.`],
  ];
  return `${head('Friday 25 September', 'Daily report', '<button class="kx-btn" id="copy-report">Copy summary</button>')}
  <section class="kx-widgets">
    ${widget(IC.tray, GREEN, 'Trays', T().trays + T().eating, '', 'scanned today')}
    ${widget(IC.bin, ORANGE, 'Plate waste', Math.round(tot.w * 100), '%', `${fmt1(tot.lf / 1000)} kg left`)}
    ${widget(IC.cart, BLUE, 'Tomorrow’s order', money(f.orderTotal), '', PL.S.order.approved ? 'approved' : 'waiting for approval')}
    ${widget(IC.cloud, CYAN, 'CO₂ avoided', ((T().co2 || 0) / 1000).toFixed(1), 'kg', 'today')}
  </section>
  <section class="kx-duo">
    ${card('Summary', 'Written automatically, updates as trays come in', `<div class="kx-report">${text.map(([h, p]) => `<div><b>${h}</b><p>${p}</p></div>`).join('')}</div>`)}
    ${card('Suggestions', '', `<div class="kx-list">${tips.map(([c, ic, t2, s]) => `<div class="kx-li"><span class="kx-ic" style="--c:${c}">${ic}</span><div><b>${esc(t2)}</b><span>${esc(s)}</span></div></div>`).join('')}</div>`)}
  </section>`;
}

/* ---------------------------------------------------------------- wiring */
function wireOrder(scope) {
  const ap = $('#approve', scope); if (ap) ap.onclick = () => { PL.S.order.approved = { at: PL.clock(), total: forecast().orderTotal }; PL.store.save('order'); };
  const un = $('#unapprove', scope); if (un) un.onclick = () => { PL.S.order.approved = null; PL.store.save('order'); };
}
function refreshPlan() { const out = $('#plan-out'); if (!out) return; out.innerHTML = planOut(); wireOrder(out); }
function wire(main) {
  const att = $('#att', main);
  if (att) {
    att.oninput = e => { ui.plan.att = +e.target.value; $('#att-v').textContent = `${ui.plan.att} of ${ENROLLED}`; refreshPlan(); };
    $$('#weather button', main).forEach(b => b.onclick = () => { ui.plan.weather = b.dataset.w; $$('#weather button', main).forEach(x => x.setAttribute('aria-pressed', String(x === b))); refreshPlan(); });
    $('#event', main).onchange = e => { ui.plan.event = e.target.value; refreshPlan(); };
  }
  wireOrder(main);
  $$('[data-go]', main).forEach(b => b.onclick = () => go(b.dataset.go));
  $$('[data-todo]', main).forEach(b => b.onclick = () => {
    const id = b.dataset.todo, t = T(); if (b.dataset.go) return;
    if (id === 'sc2') { t.sc2 = 'restarting'; PL.store.save('kitchen'); setTimeout(() => { T().sc2 = 'online'; PL.store.save('kitchen'); PL.toast('Scanner 2 is back online. 6 queued trays synced.'); }, 2600); }
    if (id === 'remind') { t.remind = true; PL.store.save('kitchen'); PL.toast('The scanner now reminds students to scan their tray back.'); }
  });
  PL.paintPets(main);
  const cc = $('#copy-carbon', main);
  if (cc) cc.onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(carbonReport()) : Promise.reject()).then(() => PL.toast('Carbon report copied.'), () => PL.toast('Copy is not available here. Select the text instead.'));
  const cp = $('#copy-report', main);
  if (cp) cp.onclick = () => {
    const txt = reportData().text.join('\n\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => PL.toast('Summary copied.'), () => PL.toast('Copy isn\'t available here. Select the text instead.'));
  };
}

PL.apps.kitchen = {
  title: 'PlateLoop Kitchen',
  mount,
  unmount() { removeEventListener('keydown', ui.onKey); ui.dock = false; root = null; },
  update() { if (!root) return; const y = scrollY, fid = document.activeElement && document.activeElement.id; if (ui.view === 'plan' && fid === 'att') return; render(); if (ui.view !== 'overview') scrollTo({ top: y }); if (fid && $('#' + fid)) $('#' + fid).focus(); },
  tick(t) { if (root && t % 20 === 0) $$('.kx-live', root).forEach(l => { l.outerHTML = liveChip(); }); },
};
})();
