/* PlateLoop Kitchen: the manager's live service dashboard. Pinned alerts, today's service at a glance,
   every dish's remaining servings against AI demand with one action each, waste monitoring and insights.
   Deeper pages: waste by dish, nutrition, plan & order, carbon, the Green Tree and the daily report. */
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

const ui = { view: 'service', plan: { att: 812, weather: 'sunny', event: 'normal' }, seen: null, prev: {} };
let root = null;
const SV = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const NAV = [
  ['service', 'Live service', SV('<path d="M3 12h4l3-8 4 16 3-8h4"/>')],
  ['dishes', 'Waste by dish', SV('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>')],
  ['nutrition', 'Nutrition', SV('<path d="M12 21c-4.5-2.5-8-6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 11c0 4-3.5 7.5-8 10Z"/>')],
  ['plan', 'Plan & order', SV('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>')],
  ['carbon', 'Carbon', SV('<path d="M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17 18Z"/><path d="M9.5 14.5h5"/>')],
  ['environment', 'Green Tree', SV('<path d="M12 22V12M12 12C8 12 5 9 5 5c4 0 7 3 7 7ZM12 14c3 0 6-2.5 6-6-3 0-6 2.5-6 6Z"/>')],
  ['report', 'Daily report', SV('<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>')],
];
const IC = {
  alert: SV('<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17v.5"/>'),
  fire: SV('<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9Z"/>'),
  box: SV('<path d="M3 7l9-4 9 4-9 4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>'),
  scan: SV('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>'),
  tray: SV('<rect x="3" y="8" width="18" height="10" rx="2"/><path d="M9 8v10M15 8v10"/>'),
  doc: SV('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>'),
  up: SV('<path d="M7 14l5-5 5 5"/>'), down: SV('<path d="M7 10l5 5 5-5"/>'),
  spark: SV('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  clock: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  users: SV('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  bin: SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};

function mount(el) {
  root = el;
  ui.seen = PL.S.today.feed.length ? PL.S.today.feed[0].t + PL.S.today.feed[0].tray + PL.S.today.feed[0].kind : null;
  el.innerHTML = `
  <div class="kit kx">
    <aside class="kit-side">
      <div class="kx-brand"><span class="kx-dot" aria-hidden="true"></span><b>plateloop</b><span>kitchen</span></div>
      <div class="kx-title">Kitchen<br>Service</div>
      <nav class="kx-nav" aria-label="Kitchen">${NAV.map(([id, label, ic]) => `<button data-view="${id}">${ic}<span>${label}</span></button>`).join('')}</nav>
      <div class="kit-foot"><div id="kit-live"></div><button class="linkish" data-reset>Reset demo</button></div>
    </aside>
    <main class="kit-main" id="kit-main"></main>
  </div>`;
  $$('.kx-nav button', el).forEach(b => b.onclick = () => { ui.view = b.dataset.view; render(); scrollTo({ top: 0 }); });
  render();
}
function render() {
  if (!root) return;
  $$('.kx-nav button', root).forEach(b => b.dataset.view === ui.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#kit-live', root).innerHTML = liveChip();
  const main = $('#kit-main', root);
  main.innerHTML = ({ service: serviceView, dishes, nutrition, environment, carbon, plan, report })[ui.view]();
  wire(main);
  PL.motion(main, 'kitchen:' + ui.view);
  flashChanges(main);
}
const liveChip = () => `<span class="kx-live"><i></i>Live · ${PL.clock()}</span>`;
/** Only values that changed since the last render get a brief highlight. */
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

/* ================================================================ live service: the model behind the dashboard
   Diners arrive on a lunch curve that peaks at 12:05. Each dish has what a diner really takes (learned from the
   before scans), the share of diners who take it, the size of a batch and how long a batch takes to cook.
   Prepared = cooked so far; served comes from the scanner; remaining = prepared − served. */
const PERIODS = [['Breakfast', 7 * 60, 8 * 60 + 30], ['Lunch', 11 * 60 + 30, 13 * 60 + 30], ['Dinner', 17 * 60 + 30, 19 * 60 + 30]];
const EXPECTED = 812, PEAK = 12 * 60 + 5;
const LIVE = {
  rice:    { take: 205, uptake: 1,   buf: 128, batch: 30, mins: 20, stock: null },
  chicken: { take: 118, uptake: .97, buf: 41, batch: 15, mins: 25, stock: 'chicken' },
  kailan:  { take: 36,  uptake: .8,  buf: 18, batch: 6,  mins: 8,  stock: 'kailan' },
  cabbage: { take: 28,  uptake: .6,  buf: 16, batch: 8,  mins: 10, stock: null },
  melon:   { take: 70,  uptake: .95, buf: 22, batch: 10, mins: 5,  stock: null },
  soup:    { take: 160, uptake: .7,  buf: 75, batch: 30, mins: 20, stock: null },
};
const STOCK = { chicken: ['Chicken thigh', 24], kailan: ['Kailan', 9] };
const YESTERDAY = { perDiner: 171 };
const hm = m => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const arrived = x => { const F = y => 1 / (1 + Math.exp(-(y - PEAK) / 11)), a = PERIODS[1][1], b = PERIODS[1][2]; return clamp((F(x) - F(a)) / (F(b) - F(a)), 0, 1); };
const DEMO_MIN = 1000; // a cooking minute lasts one second in the demo

function service() {
  const t = T(), now = t.clock, [pname, p0, p1] = PERIODS[1];
  if (t.recApplied) LIVE.cabbage.batch = 5;
  const served = t.trays + t.eating, left = Math.max(0, EXPECTED - served);
  const share = m => { const g0 = arrived(now); return g0 >= 1 ? 0 : (arrived(now + m) - g0) / (1 - g0); };
  const next30 = Math.round(left * share(30)), next60 = Math.round(left * share(60));
  if (!t.prep) t.prep = Object.fromEntries(MENU.map(d => [d.id, Math.round(t.servedNow[d.id] / 1000 + LIVE[d.id].buf)]));
  if (!t.stock) t.stock = Object.fromEntries(Object.entries(STOCK).map(([k, v]) => [k, v[1]]));
  const cook = t.cook || {}, stopped = t.stopped || {};
  const dishes = MENU.map(d => {
    const L = LIVE[d.id], servedKg = t.servedNow[d.id] / 1000, prepared = t.prep[d.id];
    const remaining = Math.max(0, prepared - servedKg), c = cook[d.id];
    const incoming = c ? c.kg : 0, have = remaining + incoming;
    const need30 = next30 * L.uptake * L.take / 1000, needRest = left * L.uptake * L.take / 1000;
    const perMin = need30 / 30, runsOut = perMin > 0 ? remaining / perMin : Infinity;
    const ratio = have / Math.max(.1, need30);
    const status = ratio < 1 ? 'high' : have > needRest * 1.15 || ratio > 3 ? 'low' : 'normal';
    const stockKey = L.stock, stockLeft = stockKey ? t.stock[stockKey] : Infinity, canCook = stockLeft >= L.batch;
    let act;
    if (c) { const done = clamp((Date.now() - c.at) / (L.mins * DEMO_MIN), 0, 1); act = { kind: 'cooking', label: 'Batch cooking', detail: `${c.kg} kg · ready in ${Math.max(1, Math.ceil(L.mins * (1 - done)))} min`, done }; }
    else if (stopped[d.id]) act = { kind: 'stopped', label: 'Cooking stopped', detail: `${fmt1(remaining)} kg on the line covers the rest of lunch`, btn: 'Resume' };
    else if (status === 'high') act = { kind: 'prep', label: 'Prepare more', detail: canCook ? `Cook ${L.batch} kg now · ready in ${L.mins} min` : `Not enough ${STOCK[stockKey][0].toLowerCase()} for a batch`, btn: canCook ? `Cook ${L.batch} kg` : null };
    else if (status === 'low') act = { kind: 'stop', label: 'Stop cooking', detail: `${fmt1(have - needRest)} kg more than the rest of lunch needs`, btn: 'Stop cooking' };
    else act = { kind: 'hold', label: 'Hold', detail: isFinite(runsOut) ? `Enough for about ${Math.round(Math.min(runsOut, p1 - now))} min` : 'Enough for the rest of lunch' };
    return { d, L, prepared, servedKg, remaining, servings: Math.floor(remaining * 1000 / L.take), need30, needRest, runsOut, status, act, stockLeft, canCook, over: have - needRest };
  });
  const core = dishes.filter(x => x.L.uptake >= .95), limit = core.reduce((a, b) => (b.servings / b.L.uptake < a.servings / a.L.uptake ? b : a));
  const tot = PL.todayTotals(), wasteKg = tot.lf / 1000, perDiner = t.trays ? tot.lf / t.trays : 0;
  const stats = dishStats().sort((a, b) => a.e - b.e);
  return { t, now, pname, p0, p1, served, left, next30, next60, dishes, mealsLeft: Math.round(limit.servings / limit.L.uptake), limit, wasteKg, perDiner, vsYesterday: perDiner / YESTERDAY.perDiner - 1, stats, tot };
}

/** Pinned alerts: only what needs doing now, most urgent first, a few words and one button each. */
const SHORT = { kailan: 'Kailan', cabbage: 'Cabbage', melon: 'Watermelon', rice: 'Rice', chicken: 'Chicken', soup: 'Soup' };
function alerts(S) {
  const t = S.t, out = [];
  if (t.sc2 !== 'online') out.push({ id: 'sc2', tone: 'red', icon: IC.scan, title: t.sc2 === 'restarting' ? 'Scanner 2 reconnecting…' : 'Scanner 2 offline', btn: t.sc2 === 'restarting' ? null : 'Restart' });
  S.dishes.filter(x => x.status === 'high' && x.runsOut < 25 && !(t.cook || {})[x.d.id]).forEach(x => out.push({ id: 'out-' + x.d.id, tone: 'red', icon: IC.fire, title: `${SHORT[x.d.id]} out in ~${Math.max(1, Math.round(x.runsOut))} min`, btn: x.canCook ? `Cook ${x.L.batch} kg` : null, dish: x.d.id }));
  Object.entries(STOCK).forEach(([k, [name]]) => { if (t.stock[k] < LIVE[k].batch) out.push({ id: 'stock-' + k, tone: 'red', icon: IC.box, title: `${name} almost gone`, btn: 'Order', go: 'plan' }); });
  S.dishes.filter(x => x.status === 'low' && !(t.stopped || {})[x.d.id]).forEach(x => out.push({ id: 'over-' + x.d.id, tone: 'amber', icon: IC.bin, title: `${SHORT[x.d.id]} overproduced`, btn: 'Stop', dish: x.d.id, stop: true }));
  if (t.eating > 0 && !t.remind) out.push({ id: 'remind', tone: 'amber', icon: IC.tray, title: `${t.eating} tray${t.eating > 1 ? 's' : ''} not scanned back`, btn: 'Remind' });
  const rank = { red: 0, amber: 1 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 4);
}

/* ---------------------------------------------------------------- small visual pieces */
/** A ring gauge: k 0..1, coloured by tone, with whatever goes in the middle. */
const ring = (k, tone, size, inner) => { const r = 42, c = 2 * Math.PI * r; return `<div class="kx-ring" style="width:${size}px;height:${size}px" data-tone="${tone}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${r}" class="trk"/><circle cx="50" cy="50" r="${r}" class="val" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - clamp(k, 0, 1))).toFixed(1)}"/></svg><div>${inner}</div></div>`; };
/** The lunch rush as a curve: served so far, the next 30 minutes (amber) and the rest (faint), with a line at now. */
function rushChart(S) {
  const W = 300, H = 92, a = S.p0, b = S.p1, n = 48, X = m => (m - a) / (b - a) * W;
  const dens = m => { const e = Math.exp(-(m - PEAK) / 11); return e / Math.pow(1 + e, 2); }, peak = dens(PEAK);
  const pts = Array.from({ length: n + 1 }, (_, i) => { const m = a + (b - a) * i / n; return [X(m), H - 6 - dens(m) / peak * (H - 14)]; });
  const area = (m0, m1) => { const p = pts.filter(([x]) => x >= X(m0) - .01 && x <= X(m1) + .01); if (p.length < 2) return ''; return `M${p[0][0].toFixed(1)},${H} ${p.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${p[p.length - 1][0].toFixed(1)},${H}Z`; };
  const line = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}`, now = clamp(S.now, a, b);
  return `<svg class="kx-rush" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${area(a, now)}" class="done"/><path d="${area(now, Math.min(b, now + 30))}" class="next"/><path d="${line}" class="ln"/>
    <line x1="${X(now).toFixed(1)}" x2="${X(now).toFixed(1)}" y1="4" y2="${H}" class="now"/></svg>`;
}

function serviceView() {
  const S = service(), A = alerts(S), t = S.t;
  const el = Math.max(0, S.now - S.p0), total = S.p1 - S.p0;
  const pop = S.stats[S.stats.length - 1], least = S.stats[0];
  const tone = { high: 'amber', normal: 'green', low: 'slate' }, word = { high: 'High demand', normal: 'Normal', low: 'Low demand' };
  const cab = S.dishes.find(x => x.d.id === 'cabbage'), recKg = Math.max(1, Math.round(cab.over + 1));
  const up = S.vsYesterday > 0;
  return `
  <header class="kx-head">
    <div><h1>Live service</h1><p>${PL.SCHOOL} · Friday 25 September</p></div>
    <div class="kx-chips"><span class="kx-dotchip"><i class="ok"></i>Scanner 1</span><span class="kx-dotchip"><i class="${t.sc2 === 'online' ? 'ok' : 'bad'}"></i>Scanner 2</span>${liveChip()}</div>
  </header>

  ${A.length ? `<section class="kx-alerts" aria-label="Alerts">${A.map(a => `<div class="kx-alert" data-tone="${a.tone}"><span class="kx-aic">${a.icon}</span><b>${esc(a.title)}</b>${a.btn ? `<button class="kx-btn" data-alert="${a.id}" ${a.dish ? `data-dish="${a.dish}"` : ''} ${a.stop ? 'data-stop="1"' : ''} ${a.go ? `data-go-view="${a.go}"` : ''}>${esc(a.btn)}</button>` : ''}</div>`).join('')}</section>`
    : `<section class="kx-alerts"><div class="kx-alert" data-tone="green"><span class="kx-aic">${SV('<path d="M5 12.5l4.5 4.5L19 7.5"/>')}</span><b>All clear</b></div></section>`}

  <section class="kx-overview">
    <div class="kx-card kx-hero">
      ${ring(el / total, 'green', 128, `<b>${S.pname}</b><span>${hm(S.now)}</span>`)}
      <div class="kx-hero-r"><div class="kx-k">${IC.users}Diners</div><div class="kx-big" data-live="served">${S.served}</div><div class="kx-bar"><i style="width:${Math.min(100, S.served / EXPECTED * 100)}%"></i></div><div class="kx-s">of ${EXPECTED}</div></div>
    </div>
    <div class="kx-card kx-rushcard">
      <div class="kx-k">${IC.clock}Next 30 min</div>
      <div class="kx-rushrow"><div class="kx-big amber" data-live="n30">${S.next30}</div><div class="kx-s">diners<br>coming</div></div>
      ${rushChart(S)}
      <div class="kx-axis"><span>${hm(S.p0)}</span><span>peak ${hm(PEAK)}</span><span>${hm(S.p1)}</span></div>
    </div>
    <div class="kx-card kx-meals">
      <div class="kx-k">${IC.tray}Meals left</div>
      <div class="kx-big" data-live="meals">${S.mealsLeft}</div>
      <div class="kx-dots">${S.dishes.map(x => `<i data-tone="${tone[x.status]}" title="${esc(x.d.name)}"></i>`).join('')}</div>
    </div>
    <div class="kx-card kx-wastecard">
      <div class="kx-k">${IC.bin}Waste today</div>
      <div class="kx-big" data-live="waste">${fmt1(S.wasteKg)}<small>kg</small></div>
      <span class="kx-delta ${up ? 'bad' : 'good'}">${up ? IC.up : IC.down}${Math.abs(Math.round(S.vsYesterday * 100))}% vs yesterday</span>
    </div>
  </section>

  <section class="kx-sec">
    <div class="kx-sec-h"><h2>Food on the line</h2><div class="kx-legend"><span data-tone="amber">High demand</span><span data-tone="green">Normal</span><span data-tone="slate">Low demand</span></div></div>
    <div class="kx-foods">${S.dishes.map(x => {
      const a = x.act, k = x.prepared ? x.remaining / x.prepared : 0, need = x.need30, have = x.remaining, scale = Math.max(need, have) * 1.15 || 1;
      return `<article class="kx-food" data-tone="${tone[x.status]}">
        <div class="kx-food-top">${PL.V.food(x.d, 34)}<b>${esc(SHORT[x.d.id])}</b><em title="${word[x.status]}">${word[x.status]}</em></div>
        ${ring(k, tone[x.status], 118, `<b data-live="sv-${x.d.id}">${x.servings}</b><span>servings</span>`)}
        <div class="kx-hn" title="On the line vs what the next 30 minutes need"><i style="width:${Math.round(have / scale * 100)}%"></i><s style="left:${Math.round(need / scale * 100)}%"></s></div>
        <div class="kx-hn-l"><span>${fmt1(have)} kg left</span><span>needs ${fmt1(need)}</span></div>
        ${a.kind === 'cooking' ? `<div class="kx-act cooking"><span data-cook="${x.d.id}">${esc(a.detail)}</span><i class="kx-cookbar"><i style="width:${Math.round(a.done * 100)}%" data-cookbar="${x.d.id}"></i></i></div>`
          : a.btn ? `<button class="kx-act ${a.kind}" data-dish-act="${a.kind}" data-dish="${x.d.id}">${a.kind === 'prep' ? IC.fire : a.kind === 'stop' ? IC.bin : IC.spark}${esc(a.btn)}</button>`
          : `<div class="kx-act hold">${a.kind === 'prep' ? 'Out of stock' : 'Hold'}</div>`}
      </article>`; }).join('')}</div>
  </section>

  <section class="kx-duo">
    <div class="kx-card kx-waste">
      <div class="kx-sec-h"><h2>Waste</h2><span class="kx-live"><i></i>Live from the scanners</span></div>
      <div class="kx-waste-top"><div class="kx-huge" data-live="waste2">${fmt1(S.wasteKg)}<small>kg</small></div>
        ${ring(Math.min(1, S.perDiner / 300), S.perDiner < YESTERDAY.perDiner ? 'green' : 'amber', 84, `<b>${Math.round(S.perDiner)}</b><span>g/diner</span>`)}
        ${ring(PL.zeroRate(), 'green', 84, `<b>${pct(PL.zeroRate())}</b><span>clean</span>`)}</div>
      <div class="kx-wlist">${S.stats.map(r => `<div><span>${PL.V.food(r.d, 22)}${esc(SHORT[r.d.id])}</span><i><i style="width:${Math.round((1 - r.e) * 100)}%"></i></i><b>${pct(1 - r.e)}</b></div>`).join('')}</div>
    </div>
    <div class="kx-card kx-insights">
      <div class="kx-sec-h"><h2>Insights</h2></div>
      <div class="kx-tiles">
        <div class="kx-tile">${IC.clock}<b>${hm(PEAK - 5)}</b><span>Peak</span></div>
        <div class="kx-tile good">${PL.V.food(pop.d, 30)}<b>${esc(SHORT[pop.d.id])}</b><span>Most eaten · ${pct(pop.e)}</span></div>
        <div class="kx-tile bad">${PL.V.food(least.d, 30)}<b>${esc(SHORT[least.d.id])}</b><span>Least finished · ${pct(least.e)}</span></div>
      </div>
      <div class="kx-rec">${IC.spark}<div><b>${t.recApplied ? 'Cabbage batches set to 5 kg' : `Cabbage: 5 kg batches`}</b><span>${t.recApplied ? 'Applied to the next batch' : `≈ ${recKg} kg less waste today`}</span></div>${t.recApplied ? '' : '<button class="kx-btn" data-rec="1">Apply</button>'}</div>
    </div>
  </section>`;
}

function chartDish() {
  const W = 520, rowH = 36, top = 6, left = 150, right = 50, rows = dishStats().sort((a, b) => b.e - a.e), H = top + rows.length * rowH + 24, iw = W - left - right;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of each dish eaten">`;
  [0, .5, 1].forEach(v => { const x = left + v * iw; s += `<line class="gridline" x1="${x}" x2="${x}" y1="${top}" y2="${H - 20}"/><text class="axis" x="${x}" y="${H - 4}" text-anchor="middle">${v * 100}%</text>`; });
  rows.forEach((r, i) => {
    const y = top + i * rowH + 8;
    s += `<text x="${left - 12}" y="${y + 13}" text-anchor="end" style="font:500 13px var(--font);fill:var(--label)">${r.d.name}</text><rect x="${left}" y="${y}" width="${iw}" height="18" rx="9" fill="var(--fill)"/><rect x="${left}" y="${y}" width="${(iw * r.e).toFixed(1)}" height="18" rx="9" fill="${r.e < .6 ? 'var(--orange)' : 'var(--tint)'}"/><text x="${W - right + 10}" y="${y + 13}" style="font:600 13px var(--font);fill:var(--label)">${pct(r.e)}</text>`;
  });
  return s + '</svg>';
}
function chartTrend() {
  const W = 1000, H = 230, l = 44, r = 16, t = 14, b = 28, iw = W - l - r, ih = H - t - b, max = .35;
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

/* ---------------------------------------------------------------- Dishes */
function dishes() {
  const rows = dishStats(), mix = portionMix();
  const W = 1000, rowH = 44, top = 8, left = 170, right = 90, maxKg = Math.max(...rows.map(r => r.served)) / 1000, H = top + rows.length * rowH + 26, iw = W - left - right;
  let chart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilograms served, eaten and left by dish">`;
  rows.forEach((r, i) => {
    const y = top + i * rowH + 10, we = iw * (r.eaten / 1000) / maxKg, wl = iw * (r.left / 1000) / maxKg;
    chart += `<text x="${left - 14}" y="${y + 15}" text-anchor="end" style="font:500 14px var(--font);fill:var(--label)">${r.d.name}</text>`;
    chart += `<rect x="${left}" y="${y}" width="${we.toFixed(1)}" height="22" rx="6" fill="var(--tint)"/><rect x="${(left + we + 2).toFixed(1)}" y="${y}" width="${Math.max(0, wl - 2).toFixed(1)}" height="22" rx="6" fill="var(--orange)"/>`;
    chart += `<text x="${(left + we + wl + 10).toFixed(1)}" y="${y + 15}" style="font:600 13px var(--font);fill:var(--label2)">${fmt1(r.served / 1000)} kg</text>`;
  });
  chart += `</svg><div class="mix-key"><span style="--c:var(--tint)">Eaten</span><span style="--c:var(--orange)">Left on trays</span><span>Label = kg served</span></div>`;
  return `
  <div class="page-head"><div><h1>Dishes</h1><p>What was served (before scans) against what came back (after scans), dish by dish.</p></div></div>
  <div class="card chart"><h3>Served, eaten and left today</h3>${chart}</div>
  <div class="card"><h3>Dish analysis</h3><div class="table-wrap" style="margin-top:8px"><table>
    <thead><tr><th>Dish</th><th class="r">Served</th><th class="r">Eaten</th><th class="r">Left</th><th class="r">Eaten %</th><th class="r">4-week trend</th><th>Suggestion</th></tr></thead>
    <tbody>${rows.sort((a, b) => a.e - b.e).map(r => { const [, tr, sug] = TREND[r.d.id]; return `<tr><td><b>${r.d.name}</b></td><td class="r num">${fmt1(r.served / 1000)} kg</td><td class="r num">${fmt1(r.eaten / 1000)} kg</td><td class="r num">${fmt1(r.left / 1000)} kg</td><td class="r"><span class="flag ${r.e < .6 ? 'low' : r.e < .8 ? 'mid' : 'ok'}">${pct(r.e)}</span></td><td class="r num" style="color:${tr > 0 ? 'var(--tint-ink)' : tr < 0 ? 'var(--red)' : 'var(--label3)'}">${tr > 0 ? '▲' : tr < 0 ? '▼' : '–'} ${Math.abs(tr)} pts</td><td style="min-width:220px">${sug}</td></tr>`; }).join('')}</tbody></table></div></div>
  <div class="kgrid">
    <div class="card"><h3>Portion sizes served</h3><p class="hint">Measured by the before scan: Small, Regular or Large</p>
      <div class="mix">${['S', 'M', 'L'].map((p, i) => `<i style="width:${mix.m[p] / mix.tot * 100}%;background:${['var(--teal)', 'var(--tint)', 'var(--orange)'][i]}"></i>`).join('')}</div>
      <div class="mix-key">${['S', 'M', 'L'].map((p, i) => `<span style="--c:${['var(--teal)', 'var(--tint)', 'var(--orange)'][i]}">${{ S: 'Small', M: 'Regular', L: 'Large' }[p]} ${pct(mix.m[p] / mix.tot)}</span>`).join('')}</div>
      <p class="hint" style="margin-top:12px">Students who pick Small leave about half as much as those who pick Large.</p></div>
    <div class="card"><h3>Why two scans matter</h3><p class="hint" style="font-size:14px;margin-top:6px">The before scan gives the exact amount each student was served, so the after scan measures true plate waste, not a guess from standard portions. It also shows which dishes students <b>take</b> but don't <b>eat</b>, like the soup.</p></div>
  </div>`;
}


/* ---------------------------------------------------------------- Nutrition (Nuvilab-style intake status) */
function intakeStats() {
  const done = PL.S.students.filter(s => s.log[0] && s.log[0].n);
  const recent = PL.S.students.map(s => s.scanned ? s.after.intake : s.log[0].n);
  const avg = Object.fromEntries(PL.NUTRIENTS.map(([k]) => [k, Math.round(recent.reduce((a, n) => a + n[k], 0) / recent.length)]));
  const low = PL.S.students.map(s => { const n = s.scanned ? s.after.intake : s.log[0].n; return { s, n, r: n.kcal / PL.TARGET.kcal }; }).filter(x => x.r < .6).sort((a, b) => a.r - b.r);
  return { avg, low, n: recent.length, done: done.length };
}
const zoneBar = (k, v) => {
  const max = PL.TARGET[k] * 1.6, pos = x => Math.min(100, x / max * 100), st = PL.nStatus(k, v);
  return `<div class="zbar"><span class="z z1" style="width:${pos(PL.TARGET[k] * .8)}%"></span><span class="z z2" style="left:${pos(PL.TARGET[k] * .8)}%;width:${pos(PL.TARGET[k] * 1.3) - pos(PL.TARGET[k] * .8)}%"></span><i class="${st}" style="width:${pos(v)}%"></i></div>`;
};
function nutrition() {
  const { avg, low, n } = intakeStats();
  const status = { low: ['Low', 'low'], ok: ['Adequate', 'ok'], high: ['Too much', 'mid'] };
  return `
  <div class="page-head"><div><h1>Nutrition</h1><p>What students actually ate at lunch, from the difference between the before and after scans, against the school-lunch target.</p></div></div>
  <div class="card"><div class="row spread"><h3>Average intake per student</h3><span class="hint">Class 3B · ${n} students · latest lunch</span></div>
    <div class="nut-legend"><span class="l1">Low</span><span class="l2">Adequate</span><span class="l3">Too much</span></div>
    <div class="nut-rows">${PL.NUTRIENTS.map(([k, label, unit]) => { const [t, c] = status[PL.nStatus(k, avg[k])]; return `<div class="nut-row"><b>${label}</b>${zoneBar(k, avg[k])}<span class="num">${avg[k]} ${unit} <small>/ ${PL.TARGET[k]}</small></span><span class="flag ${c}">${t}</span></div>`; }).join('')}</div>
    <p class="hint" style="margin-top:12px">Targets are per lunch for a Secondary 3 student (about a third of the daily need). Replace them with the Health Promotion Board's school meal guidelines.</p></div>
  <div class="kgrid">
    <div class="card"><div class="row spread"><h3>Students to check on</h3><span class="pill orange">${low.length} flagged</span></div><p class="hint">Ate less than 60% of the calorie target at their last lunch. Visible to the school dietitian and homeroom teacher only.</p>
      <div class="lowlist">${low.length ? low.slice(0, 8).map(x => `<div><span class="av">${esc(x.s.name[0])}</span><div><b>${esc(x.s.name)} · Class ${x.s.cls}</b><span>${x.n.kcal} kcal · protein ${x.n.p} g</span></div><span class="flag low">${pct(x.r)}</span></div>`).join('') : '<p class="hint" style="padding:12px 0">Nobody below 60% right now.</p>'}</div></div>
    <div class="card"><h3>Where nutrients are lost</h3><p class="hint">Nutrients served but left on trays today, all finished trays</p>
      ${(() => { const left = Object.fromEntries(MENU.map(d => [d.id, T().dish[d.id].ret])); const served = Object.fromEntries(MENU.map(d => [d.id, T().dish[d.id].served])); const L = PL.nutrientsOf(left), S = PL.nutrientsOf(served);
        return `<div class="nut-rows" style="margin-top:12px">${PL.NUTRIENTS.map(([k, label, unit]) => `<div class="nut-row lost"><b>${label}</b><div class="zbar"><i class="high" style="width:${L[k] / S[k] * 100}%"></i></div><span class="num">${pct(L[k] / S[k])}</span><span class="hint">${Math.round(L[k] / 1000 * (unit === 'g' ? 1 : 1)).toLocaleString('en-US')}${unit === 'g' ? ' kg' : 'k kcal'}</span></div>`).join('')}</div>`; })()}
      <p class="hint" style="margin-top:12px">Vegetables carry most of the lost fibre and vitamins. The Kailan Week quest targets this.</p></div>
  </div>`;
}

/* ---------------------------------------------------------------- Environment (Nuvilab-style dashboard + Green Tree) */
function environment() {
  const e = PL.env(PL.S.term.kg), zr = PL.zeroRate(), week = [...(PL.S.zeroWeek || []), zr];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], goal = .2, W = 520, H = 220, l = 34, b = 26, t = 10, ih = H - b - t, max = .3, bw = 52;
  let chart = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Zero-leftover rate this week">`;
  [0, .1, .2, .3].forEach(v => { const y = t + ih - v / max * ih; chart += `<line class="gridline" x1="${l}" x2="${W - 6}" y1="${y}" y2="${y}"/><text class="axis" x="${l - 6}" y="${y + 4}" text-anchor="end">${v * 100}%</text>`; });
  week.forEach((v, i) => { const x = l + 20 + i * ((W - l - 40) / 5), h = v / max * ih; chart += `<rect x="${x}" y="${t + ih - h}" width="${bw}" height="${h}" rx="8" fill="${v >= goal ? 'var(--tint)' : 'var(--blue)'}" opacity="${i === 4 ? 1 : .75}"/><text x="${x + bw / 2}" y="${t + ih - h - 6}" text-anchor="middle" style="font:600 12px var(--font);fill:var(--label)">${pct(v)}</text><text class="axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${days[i]}${i === 4 ? ' (live)' : ''}</text>`; });
  const gy = t + ih - goal / max * ih;
  chart += `<line x1="${l}" x2="${W - 6}" y1="${gy}" y2="${gy}" stroke="var(--orange)" stroke-width="1.5" stroke-dasharray="5 5"/><text class="axis" x="${W - 8}" y="${gy - 6}" text-anchor="end" style="fill:var(--orange)">Goal 20%</text></svg>`;
  return `
  <div class="page-head"><div><h1>Environment</h1><p>The school's impact, shown on the canteen screen and in every student's Loopi app.</p></div></div>
  <div class="env-hero">
    <div class="env-tree"><canvas id="env-tree" width="200" height="170" aria-label="School Green Tree"></canvas><div><b class="num">${PL.S.today.zero}</b> fruits today · one for every zero-leftover tray</div></div>
    <div class="env-big"><div class="k">CO₂ avoided this term</div><div class="v num">${(e.co2 / 1000).toFixed(2)} t</div><div class="s">from ${Math.round(e.kg).toLocaleString('en-US')} kg of food not wasted</div>
      <div class="env-eq"><div><b class="num">${Math.round(e.trees).toLocaleString('en-US')}</b>pine trees<small>absorbing CO₂ for a year</small></div><div><b class="num">${Math.round(e.km).toLocaleString('en-US')}</b>km not driven<small>by an average car</small></div><div><b class="num">${(PL.S.term.zero || 0).toLocaleString('en-US')}</b>zero-leftover trays<small>this term</small></div></div></div>
  </div>
  <div class="kgrid">
    <div class="card chart"><h3>Zero-leftover rate this week</h3><p class="hint">Share of trays with less than 5% left</p>${chart}</div>
    <div class="card"><h3>Waste by class this week</h3><p class="hint">Compared with each class's starting level</p>
      <div class="lb" style="margin-top:12px;box-shadow:none;background:var(--fill)">${PL.classRows().map((r, i) => `<div class="lb-row ${i < 3 ? 'top' + (i + 1) : ''}"><span class="lb-rank">${i + 1}</span><canvas width="40" height="34" data-cls="${r.c.id}"></canvas><div><div class="lb-name">Class ${r.c.id}</div><div class="lb-sub">waste ${pct(r.w)} · started at ${pct(r.c.base)}</div></div><div class="lb-val">${r.red > 0 ? '−' + pct(r.red) : '0%'}</div></div>`).join('')}</div></div>
  </div>
  <p class="hint" style="margin-top:14px">Illustrative factors: 2.5 kg CO₂e per kg of food, 6.6 kg CO₂ absorbed per pine tree per year, 0.17 kg CO₂ per car-km. Swap in published factors (e.g. from NEA or EPA WARM) before quoting.</p>`;
}

/* ---------------------------------------------------------------- Carbon: the whole canteen's footprint, toward carbon-neutral operation
   Illustrative factors (kg CO₂e): per kg of food produced, per kg of food thrown away, and per unit of
   energy, water and transport. Swap in published factors (e.g. EPA WARM, national grid) before quoting. */
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
  const parts = [['Ingredients', c.foodT, 'var(--orange)'], ['Food waste', c.disposalT, 'var(--red)'], ['Energy, water and transport', c.opsT, 'var(--blue)']];
  const meat = c.food.find(x => x.d.id === 'chicken');
  const actions = [
    ['Cut plate waste from ' + pct(c.w) + ' to 20%', Math.max(0, (c.w - .2) / c.w) * (c.disposalT + c.hidden) * 10, 'Using the dish-by-dish waste data'],
    ['Go meat-free with tofu one day a week', meat.t * .2 * (1 - 3 / 6.1) * 10, 'Chicken is ' + pct(meat.t / c.foodT) + ' of ingredient emissions'],
    ['Cook to the forecast, not to enrolment', c.foodT * .06 * 10, 'Plan & order already cooks about 6% less'],
    ['Run dishwashers full and off-peak', c.ops[0].t * .08 * 10, 'About 8% less electricity'],
  ].sort((a, b) => b[1] - a[1]);
  const W = 520, Hh = 180, max = 1.25, months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  let trend = `<svg viewBox="0 0 ${W} ${Hh + 26}" role="img" aria-label="Monthly emissions, April to September">`;
  CARBON_TREND.forEach((k, i) => { const v = c.total * k, h = k / max * Hh, x = 40 + i * 78; trend += `<rect x="${x}" y="${Hh - h}" width="46" height="${h}" rx="8" fill="var(--tint)" opacity="${i === 5 ? 1 : .6}"/><text x="${x + 23}" y="${Hh - h - 6}" text-anchor="middle" style="font:600 12px var(--font);fill:var(--label)">${v.toFixed(1)}</text><text class="axis" x="${x + 23}" y="${Hh + 18}" text-anchor="middle">${months[i]}</text>`; });
  const gy = Hh - (BEFORE * (1 - GOAL)) / max * Hh;
  trend += `<line x1="30" x2="${W - 6}" y1="${gy}" y2="${gy}" stroke="var(--orange)" stroke-width="1.5" stroke-dasharray="5 5"/></svg>`;
  return `
  <div class="page-head"><div><h1>Carbon</h1><p>Every source of the canteen's emissions in one place: ingredients, food waste, and the kitchen's energy, water and deliveries.</p></div><button class="btn" id="copy-carbon">Copy monthly report</button></div>
  <div class="kpis">
    <div class="kpi"><div class="k">This month</div><div class="v">${c.total.toFixed(1)} t</div><div class="s">CO₂e, all sources</div></div>
    <div class="kpi"><div class="k">Per meal</div><div class="v">${c.perMeal.toFixed(2)} kg</div><div class="s">${Math.round(c.meals).toLocaleString('en-US')} meals this month</div></div>
    <div class="kpi good"><div class="k">Vs. before PlateLoop</div><div class="v">−${pct(cut)}</div><div class="s">goal −${pct(GOAL)} this year</div></div>
    <div class="kpi good"><div class="k">Saved today, live</div><div class="v">${((T().co2 || 0) / 1000).toFixed(1)} kg</div><div class="s">from trays scanned so far</div></div>
  </div>
  <div class="kgrid">
    <div class="card"><h3>Where the emissions come from</h3>
      <div class="cstack">${parts.map(([n, v, col]) => `<i style="width:${v / c.total * 100}%;background:${col}" title="${n}"></i>`).join('')}</div>
      <div class="clist">${parts.map(([n, v, col]) => `<div><span class="dot" style="color:${col}"></span><b>${n}</b><span class="num">${v.toFixed(1)} t · ${pct(v / c.total)}</span></div>`).join('')}</div>
      <p class="hint" style="margin-top:10px">Food thrown away also wastes the ${c.hidden.toFixed(1)} t it took to grow it. That's counted under ingredients.</p></div>
    <div class="card chart"><h3>Monthly emissions</h3><p class="hint">t CO₂e, all sources · <span style="color:var(--orange)">dashed line: this year's goal</span></p>${trend}</div>
  </div>
  <div class="kgrid">
    <div class="card"><h3>Ingredients</h3><div class="table-wrap"><table><thead><tr><th>Dish</th><th class="r">kg a month</th><th class="r">t CO₂e</th></tr></thead><tbody>${[...c.food].sort((a, b) => b.t - a.t).map(x => `<tr><td>${x.d.name}</td><td class="r num">${Math.round(x.kg).toLocaleString('en-US')}</td><td class="r num">${x.t.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Operations</h3><div class="table-wrap"><table><thead><tr><th>Source</th><th class="r">Use</th><th class="r">t CO₂e</th></tr></thead><tbody>${c.ops.map(o => `<tr><td>${o.name}<br><small class="muted">${o.what}</small></td><td class="r num">${o.qty.toLocaleString('en-US')} ${o.unit}</td><td class="r num">${o.t.toFixed(2)}</td></tr>`).join('')}<tr><td>Food waste disposal<br><small class="muted">${Math.round(c.wastedKg).toLocaleString('en-US')} kg to the bin</small></td><td class="r num">${EF_DISPOSAL} kg/kg</td><td class="r num">${c.disposalT.toFixed(2)}</td></tr></tbody></table></div></div>
  </div>
  <h2 class="section-title">Biggest cuts toward carbon-neutral</h2>
  <div class="insights">${actions.map(([t, v, s], i) => `<div class="insight"><span class="ic" style="background:${['var(--tint)', 'var(--blue)', 'var(--orange)', 'var(--purple)'][i]}">${SV('<path d="M4 17l6-6 4 4 6-8"/>')}</span><div><b>${t}: −${v.toFixed(1)} t a school year</b><span>${s}</span></div></div>`).join('')}</div>
  <p class="hint" style="margin-top:14px">Illustrative factors: ${Object.entries(EF_FOOD).map(([k, v]) => `${PL.DISH[k].name.toLowerCase()} ${v}`).join(', ')} kg CO₂e per kg; disposal ${EF_DISPOSAL}; electricity 0.41 per kWh (Singapore grid); gas 2.2 per m³. Replace with published factors before reporting.</p>`;
}
function carbonReport() {
  const c = carbonData();
  return `Carbon report, September. The canteen produced ${c.total.toFixed(1)} t CO₂e this month (${c.perMeal.toFixed(2)} kg per meal): ${c.foodT.toFixed(1)} t from ingredients, ${c.disposalT.toFixed(1)} t from food waste disposal, and ${c.opsT.toFixed(1)} t from energy, water and deliveries. That is ${pct(1 - c.total / c.before)} below the level before PlateLoop, against a goal of ${pct(GOAL)} this year. Plate waste is ${pct(c.w)}; food thrown away also carried ${c.hidden.toFixed(1)} t of ingredient emissions.`;
}

/* ---------------------------------------------------------------- Plan & order */
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
function plan() {
  const p = ui.plan;
  return `
  <div class="cycle">${[['Plan', 'Predict how much students will eat'], ['Order', 'Buy only what the plan needs'], ['Cook', 'Tune recipes to what students like'], ['Serve', 'Measure it all again tomorrow']].map(([a, b], i) => `<div class="${i < 2 ? 'on' : ''}"><span class="n">${i + 1}</span><b>${a}</b><small>${b}</small></div>`).join('')}</div>
  <div class="page-head"><div><h1>Plan & order</h1><p>Monday 28 September. Quantities come from what students actually ate, not standard portion × enrolment.</p></div>
    <div class="trust"><span>Forecast error <b class="num">${(MAPE * 100).toFixed(1)}%</b></span><div class="bar"><i style="width:${(1 - MAPE * 4) * 100}%"></i></div></div></div>
  <div class="card">
    <div class="controls">
      <div><label for="att">Attendance · <span class="num" id="att-v">${p.att} of ${ENROLLED}</span></label><input type="range" id="att" min="600" max="840" step="1" value="${p.att}"></div>
      <div><label>Weather</label><div class="seg" id="weather">${['sunny', 'rainy', 'hot'].map(w => `<button data-w="${w}" aria-pressed="${p.weather === w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join('')}</div></div>
      <div><label for="event">School calendar</label><select id="event">${[['normal', 'Normal day'], ['trip', 'Sec 4 learning journey (−138)'], ['sports', 'Sports day']].map(([v, l]) => `<option value="${v}" ${p.event === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div id="plan-out">${planOut()}</div>
  </div>
  <div class="card"><h3>Cook: recipe tweaks students will eat more of</h3><p class="hint">From 4 weeks of before/after scans</p>
    <div class="insights" style="margin-top:10px">${[
      ['var(--tint)', 'Kailan with oyster sauce', 'Eaten 64% vs. 52% plain in the class A/B test. Make it the default.'],
      ['var(--blue)', 'Soup: 150 ml ladle, refills allowed', 'Cuts soup waste from 42% to 24% with no drop in satisfaction.'],
      ['var(--orange)', 'Cabbage: 25 g default portion', 'Most students leave 10–15 g of a 35 g serving.'],
    ].map(([c, t, d]) => `<div class="insight"><span class="ic" style="background:${c}">${SV('<path d="M5 12l5 5 9-10"/>')}</span><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div></div>`;
}
function planOut() {
  const f = forecast(), saved = f.tStd - f.tNew, dollars = f.costStd - f.cost, ap = PL.S.order.approved;
  return `
    <div class="table-wrap"><table><thead><tr><th>Dish</th><th class="r">Standard</th><th class="r">Learned</th><th class="r">Standard plan</th><th class="r">PlateLoop plan</th><th class="r">Less</th></tr></thead><tbody>
      ${f.rows.map(r => `<tr><td><b>${r.d.name}</b></td><td class="r num">${r.d.std} g</td><td class="r num">${r.d.learned} g</td><td class="r num">${fmt1(r.stdKg)} kg</td><td class="r num"><b>${fmt1(r.newKg)} kg</b></td><td class="r num diff">−${fmt1(r.stdKg - r.newKg)} kg</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td></td><td class="muted">${f.att} students</td><td class="r num"><b>${fmt1(f.tStd)} kg</b></td><td class="r num"><b>${fmt1(f.tNew)} kg</b></td><td class="r num diff">−${fmt1(saved)} kg</td></tr></tbody></table></div>
    <div class="savings">
      <div class="save"><div class="k">Less food cooked</div><div class="v">${fmt1(saved)} kg</div><div class="s">vs. standard portion × enrolment</div></div>
      <div class="save"><div class="k">Ingredients saved</div><div class="v">${money(dollars)}</div><div class="s">≈ ${money(dollars * 180)} over a school year</div></div>
      <div class="save"><div class="k">Emissions avoided</div><div class="v">${Math.round(saved * PL.CO2_PER_KG)} kg CO₂e</div><div class="s">illustrative factor</div></div>
    </div>
    <h3 style="margin-top:22px">Supplier order</h3>
    <div class="table-wrap" style="margin-top:6px"><table><thead><tr><th>Ingredient</th><th class="r">Needed</th><th class="r">In stock</th><th class="r">Order</th><th class="r">Cost</th></tr></thead><tbody>
      ${f.orders.map(o => `<tr><td>${o.ing}</td><td class="r num">${fmt1(o.kg)} kg</td><td class="r num">${o.inv ? o.inv + ' kg' : '—'}</td><td class="r num"><b>${o.order > 0 ? fmt1(o.order) + ' kg' : 'none'}</b></td><td class="r num">${o.order > 0 ? money(o.order * o.price) : '—'}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td></td><td></td><td></td><td class="r num"><b>${money(f.orderTotal)}</b></td></tr></tbody></table></div>
    <div class="approve">${ap ? `<span class="pill green">Approved at ${ap.at} · ${money(ap.total)}</span><span class="hint">In a live system this goes to the supplier. Nothing is sent from this demo.</span><button class="btn small ghost" id="unapprove">Undo</button>`
      : `<button class="btn primary" id="approve">Approve order · ${money(f.orderTotal)}</button><span class="hint">Before the 14:00 supplier cut-off.</span>`}</div>`;
}

/* ---------------------------------------------------------------- Report */
function reportData() {
  const t = T(), tot = PL.todayTotals(), rows = dishStats().sort((a, b) => a.e - b.e), f = forecast(), mix = portionMix();
  const worst = rows[0], best = rows[rows.length - 1], diff = (PL.SCHOOL_BASELINE - tot.w) * 100;
  const cls = PL.classRows()[0];
  const text = [
    `Today ${t.trays.toLocaleString('en-US')} trays were scanned before and after lunch, and ${t.eating} students are still eating. Plate waste is ${pct(tot.w)}, ${diff >= 0 ? `${diff.toFixed(0)} points below` : `${(-diff).toFixed(0)} points above`} the ${pct(PL.SCHOOL_BASELINE)} baseline, leaving ${fmt1(tot.lf / 1000)} kg of food (about ${money(tot.val)} of ingredients).`,
    `${best.d.name} was the most eaten dish (${pct(best.e)}). ${worst.d.name} came back the most, with only ${pct(worst.e)} eaten. ${TREND[worst.d.id][2]}`,
    `Class ${cls.c.id} leads Secondary 3 with ${pct(cls.red)} less waste than when it started. ${pct(PL.zeroRate())} of trays had zero leftovers, growing ${t.zero} fruits on the Green Tree, and ${pct(mix.m.S / mix.tot)} were Small portions.`,
    `The average student ate ${intakeStats().avg.kcal} kcal and ${intakeStats().avg.p} g of protein at lunch (targets ${PL.TARGET.kcal} kcal and ${PL.TARGET.p} g). ${intakeStats().low.length} students ate less than 60% of their calorie target and are flagged for the dietitian.`,
    `For Monday, the plan cooks ${fmt1(f.tNew)} kg instead of ${fmt1(f.tStd)} kg, saving about ${money(f.costStd - f.cost)} in ingredients. The supplier order totals ${money(f.orderTotal)}.`,
  ];
  return { text, worst, best, f, tot };
}
function report() {
  const { text, worst, f } = reportData();
  const soup = dishStats().find(r => r.d.id === 'soup');
  const insights = [
    ['var(--orange)', '<path d="M12 3v12M6 9l6 6 6-6M4 21h16"/>', `Serve less ${worst.d.name.toLowerCase()}`, TREND[worst.d.id][2]],
    ['var(--blue)', '<path d="M5 12h14M12 5v14"/>', 'Soup: taken, not eaten', `${fmt1(soup.left / 1000)} kg of soup came back today. A 150 ml ladle would cut most of it.`],
    ['var(--tint)', '<path d="M4 17l6-6 4 4 6-8"/>', 'Kailan Week is working', 'Students tasting kailan for the quest raised the share eaten by 17 points.'],
    ['var(--purple)', '<path d="M6 3h9l4 4v14H6z"/>', `Order ${money(f.orderTotal)} for Monday`, `${fmt1(f.tStd - f.tNew)} kg less food cooked than the standard plan.`],
  ];
  return `
  <div class="page-head"><div><h1>Daily report</h1><p>Written automatically from today's scans. It updates as trays come in.</p></div><button class="btn" id="copy-report">Copy summary</button></div>
  <div class="card"><div class="report">${text.map(p => `<p>${p}</p>`).join('')}</div></div>
  <h2 class="section-title">Suggestions</h2>
  <div class="insights">${insights.map(([c, ic, t, s]) => `<div class="insight"><span class="ic" style="background:${c}">${SV(ic)}</span><div><b>${esc(t)}</b><span>${esc(s)}</span></div></div>`).join('')}</div>`;
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
  // live service actions
  const save = msg => { PL.store.save('kitchen'); if (msg) PL.toast(msg); };
  const cookBatch = id => {
    const t = T(), L = LIVE[id]; if (!L || (t.cook || {})[id]) return;
    if (L.stock) { if (t.stock[L.stock] < L.batch) return PL.toast(`Not enough ${STOCK[L.stock][0].toLowerCase()} for a batch.`); t.stock[L.stock] -= L.batch; }
    t.cook = { ...(t.cook || {}), [id]: { kg: L.batch, at: Date.now() } };
    if (t.stopped) delete t.stopped[id];
    save(`${PL.DISH[id].name}: ${L.batch} kg batch started, ready in ${L.mins} min.`);
  };
  const stopCooking = id => { const t = T(); t.stopped = { ...(t.stopped || {}), [id]: true }; save(`Stopped cooking ${PL.DISH[id].name.toLowerCase()}.`); };
  $$('[data-dish-act]', main).forEach(b => b.onclick = () => {
    const id = b.dataset.dish, k = b.dataset.dishAct;
    if (k === 'prep') cookBatch(id); else if (k === 'stop') stopCooking(id);
    else if (k === 'stopped') { delete T().stopped[id]; save(`Cooking resumed for ${PL.DISH[id].name.toLowerCase()}.`); }
  });
  $$('[data-alert]', main).forEach(b => b.onclick = () => {
    const id = b.dataset.alert, t = T();
    if (b.dataset.goView) { ui.view = b.dataset.goView; render(); scrollTo({ top: 0 }); return; }
    if (b.dataset.dish) return b.dataset.stop ? stopCooking(b.dataset.dish) : cookBatch(b.dataset.dish);
    if (id === 'sc2') { t.sc2 = 'restarting'; save(); setTimeout(() => { T().sc2 = 'online'; save('Scanner 2 is back online. 6 queued trays synced.'); }, 2600); }
    if (id === 'remind') { t.remind = true; save('The scanner now reminds students to scan their tray back.'); }
  });
  const rec = $('[data-rec]', main); if (rec) rec.onclick = () => { const t = T(); t.recApplied = true; LIVE.cabbage.batch = 5; save('Cabbage: 5 kg batches, 25 g served by default.'); };
  PL.paintPets(main);
  const tree = $('#env-tree', main); if (tree) drawTreeInto(tree, 0);
  const cc = $('#copy-carbon', main);
  if (cc) cc.onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(carbonReport()) : Promise.reject()).then(() => PL.toast('Carbon report copied.'), () => PL.toast('Copy is not available here. Select the text instead.'));
  const cp = $('#copy-report', main);
  if (cp) cp.onclick = () => {
    const txt = reportData().text.join('\n\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => PL.toast('Summary copied.'), () => PL.toast('Copy isn\'t available here. Select the text instead.'));
  };
}

function drawTreeInto(cv, t) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, u = 5;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#EAF6EC'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#CFE8D3'; c.fillRect(0, H - 26, W, 26);
  c.fillStyle = '#8B5E3C'; c.fillRect(W / 2 - 7, H - 54, 14, 30);
  const layers = [[H - 56, 38], [H - 78, 30], [H - 98, 22], [H - 114, 13]];
  layers.forEach(([y, hw], i) => { c.fillStyle = i % 2 ? '#34A853' : '#2E9447'; for (let r = 0; r < 22; r += u) { const w = Math.round(hw * (1 - r / 30)) * 2; c.fillRect(W / 2 - w / 2, y - r, w, u); } });
  const n = Math.min(PL.S.today.zero, 48); let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) { const L = layers[i % 4], x = W / 2 + (rnd() - .5) * L[1] * 1.6, y = L[0] - rnd() * 16; c.fillStyle = '#FF3B30'; c.fillRect(Math.round(x / u) * u, Math.round(y / u) * u, u, u); }
}

PL.apps.kitchen = {
  title: 'PlateLoop Kitchen',
  mount,
  unmount() { root = null; },
  update() { if (!root) return; if (T().recApplied) LIVE.cabbage.batch = 5; const y = scrollY, fid = document.activeElement && document.activeElement.id; if (ui.view === 'plan' && fid === 'att') return; render(); scrollTo({ top: y }); if (fid && $('#' + fid)) $('#' + fid).focus(); },
  tick() {
    if (!root) return;
    const T0 = T(), cook = T0.cook || {};
    let finished = null;
    Object.entries(cook).forEach(([id, c]) => {
      const L = LIVE[id], k = clamp((Date.now() - c.at) / (L.mins * DEMO_MIN), 0, 1);
      if (k >= 1) { T0.prep[id] += c.kg; delete cook[id]; finished = id; return; }
      const bar = $(`[data-cookbar="${id}"]`, root); if (bar) bar.style.width = Math.round(k * 100) + '%';
      const txt = $(`[data-cook="${id}"]`, root); if (txt) txt.textContent = `${c.kg} kg · ready in ${Math.max(1, Math.ceil(L.mins * (1 - k)))} min`;
    });
    if (finished) { PL.store.save('kitchen'); PL.toast(`${PL.DISH[finished].name}: fresh batch is on the line.`); }
  },
};
})();
