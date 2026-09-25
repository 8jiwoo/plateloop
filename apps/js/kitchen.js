/* PlateLoop Kitchen: every before/after scan arrives here. Today (live), Dishes, Nutrition,
   Environment (Green Tree dashboard), Plan & order (the plan → order → cook → serve cycle), Report. */
(() => {
'use strict';
const { $, $$, pct, fmt1, money, esc, MENU, rng, clamp } = PL;

const HISTORY = (() => { const r = rng(11); return Array.from({ length: 30 }, (_, i) => i < 10 ? .29 + (r() - .5) * .04 : clamp(.29 - (i - 9) * .0065 + (r() - .5) * .03, .12, .35)); })();
const TREND = { spinach: [.46, +17, 'Spinach Week quest is working: 46% → 63% eaten on quest days.'], kimchi: [.55, +1, 'Serve 25 g by default and let students take more.'], apple: [.88, +1, 'Popular. Keep it.'], rice: [.82, +4, 'More students choose Small since portion sizes started.'], bulgogi: [.94, +2, 'Most popular dish. Keep the portion.'], soup: [.58, -2, 'Cut the default ladle from 200 to 150 ml.'] };
const TOMORROW = [
  { id: 'rice', name: 'Rice', std: 180, learned: 148, err: .05, tags: ['grain'], bom: [['Rice (raw)', .42, 2.2]] },
  { id: 'curry', name: 'Pork & vegetable curry', std: 150, learned: 131, err: .06, tags: ['protein'], bom: [['Pork shoulder', .20, 9.0], ['Potato', .22, 1.6], ['Carrot', .10, 1.8], ['Onion', .14, 1.4], ['Curry roux', .07, 7.0]] },
  { id: 'soup', name: 'Seaweed soup', std: 200, learned: 122, err: .09, tags: ['soup'], bom: [['Dried seaweed', .012, 30], ['Beef brisket', .03, 18], ['Soy sauce', .02, 3.0]] },
  { id: 'tofu', name: 'Fried tofu', std: 70, learned: 55, err: .08, tags: ['protein'], bom: [['Firm tofu', .9, 3.2], ['Cooking oil', .05, 2.5]] },
  { id: 'sprout', name: 'Bean sprout side', std: 50, learned: 29, err: .11, tags: ['veg'], bom: [['Bean sprouts', .95, 2.4], ['Sesame oil', .02, 12]] },
  { id: 'kimchi', name: 'Kimchi', std: 40, learned: 22, err: .10, tags: ['veg'], bom: [['Kimchi', 1.0, 4.5]] },
  { id: 'yogurt', name: 'Yogurt', std: 85, learned: 81, err: .03, tags: ['fruit'], bom: [['Yogurt', 1.0, 3.5]] },
];
const INVENTORY = { 'Rice (raw)': 60, 'Kimchi': 12, 'Onion': 8, 'Soy sauce': 10, 'Cooking oil': 15, 'Sesame oil': 2 };
const ENROLLED = 840;
const MAPE = TOMORROW.reduce((a, d) => a + d.err, 0) / TOMORROW.length;
const SEED_MIX = { S: 35, M: 84, L: 21 }; // portion sizes of the 140 trays scanned before the demo starts

const ui = { view: 'overview', plan: { att: 812, weather: 'sunny', event: 'normal' }, seen: null };
let root = null;
const SV = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const NAV = [
  ['overview', 'Overview', SV('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>')],
  ['dishes', 'Dishes', SV('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>')],
  ['nutrition', 'Nutrition', SV('<path d="M12 21c-4.5-2.5-8-6-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 11c0 4-3.5 7.5-8 10Z"/>')],
  ['environment', 'Environment', SV('<path d="M12 22V12M12 12C8 12 5 9 5 5c4 0 7 3 7 7ZM12 14c3 0 6-2.5 6-6-3 0-6 2.5-6 6Z"/>')],
  ['plan', 'Plan & order', SV('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>')],
  ['report', 'Daily report', SV('<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>')],
];

function mount(el) {
  root = el;
  ui.seen = PL.S.today.feed.length ? PL.S.today.feed[0].t + PL.S.today.feed[0].tray + PL.S.today.feed[0].kind : null;
  el.innerHTML = `
  <div class="kit">
    <aside class="kit-side">
      <div class="who"><span class="kit-logo" aria-hidden="true"></span><div><b>PlateLoop Kitchen</b><span>Haneul Elementary</span></div></div>
      ${NAV.map(([id, label, ic]) => `<button data-view="${id}">${ic}${label}</button>`).join('')}
      <div class="kit-foot"><div id="kit-live"></div><button class="linkish" data-reset style="font-size:13px">Reset demo</button></div>
    </aside>
    <main class="kit-main" id="kit-main"></main>
  </div>`;
  $$('.kit-side button', el).forEach(b => b.onclick = () => { ui.view = b.dataset.view; render(); scrollTo({ top: 0 }); });
  render();
}
function render() {
  if (!root) return;
  $$('.kit-side button', root).forEach(b => b.dataset.view === ui.view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#kit-live', root).innerHTML = `<span class="live"><i></i>Live from the scanner · ${PL.clock()}</span>`;
  const main = $('#kit-main', root);
  main.innerHTML = ({ overview, dishes, nutrition, environment, plan, report })[ui.view]();
  wire(main);
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

/* ---------------------------------------------------------------- Overview */
function overview() {
  const t = T(), tot = PL.todayTotals(), good = tot.w < PL.SCHOOL_BASELINE;
  const kpis = [
    ['Trays served', (t.trays + t.eating).toLocaleString('en-US'), `${t.eating} eating now`, ''],
    ['Plate waste', pct(tot.w), `baseline ${pct(PL.SCHOOL_BASELINE)}`, good ? 'good' : ''],
    ['Food left', `${fmt1(tot.lf / 1000)} kg`, `≈ ${money(tot.val)} of ingredients`, ''],
    ['Zero leftover', pct(PL.zeroRate()), `${t.zero} clean trays today`, 'good'],
  ];
  const key = f => f.t + f.tray + f.kind;
  const seenIdx = t.feed.findIndex(f => key(f) === ui.seen);
  const fresh = seenIdx === -1 ? t.feed.length : seenIdx;
  ui.seen = t.feed.length ? key(t.feed[0]) : null;
  return `
  <div class="page-head"><div><h1>Today</h1><p>Friday 25 September · every tray is scanned before and after lunch.</p></div></div>
  <div class="kpis">${kpis.map(([k, v, s, c]) => `<div class="kpi"><div class="k">${k}</div><div class="v ${c}">${v}</div><div class="s">${s}</div></div>`).join('')}</div>
  <div class="kgrid">
    <div class="card"><div class="row spread"><h3>Live scans</h3><span class="hint">Tray numbers, not names</span></div>
      <div class="feed">${t.feed.length ? t.feed.map((f, i) => `<div class="frow ${i < fresh ? 'new' : ''}"><span class="t">${f.t}</span><span class="kind ${f.kind}">${f.kind === 'before' ? 'Before' : 'After'}</span><span class="tr">#${String(f.tray).padStart(4, '0')}</span><span class="cls">Class ${f.cls}${f.method && f.method !== 'card' ? ` · ${f.method === 'qr' ? 'QR' : 'Face'}` : ''}</span><span class="val">${f.kind === 'before' ? `${Math.round(f.served)} g served` : f.zero ? '<span style="color:var(--tint-ink)">Zero leftover</span>' : `<span style="color:${f.w > .3 ? 'var(--orange)' : 'inherit'}">${pct(f.w)} left</span>`}</span></div>`).join('')
        : `<p class="hint" style="padding:22px 2px">Class 3-2 is about to eat. Scans from the PlateLoop scanner appear here the moment they happen.</p>`}</div></div>
    <div class="card chart"><h3>Eaten by dish</h3><p class="hint">Share of each dish eaten on finished trays</p>${chartDish()}</div>
  </div>
  <div class="card chart"><h3>Plate waste, last 30 school days</h3><p class="hint">Food left ÷ food served, whole school</p>${chartTrend()}</div>`;
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
  <div class="card"><div class="row spread"><h3>Average intake per student</h3><span class="hint">Class 3-2 · ${n} students · latest lunch</span></div>
    <div class="nut-legend"><span class="l1">Low</span><span class="l2">Adequate</span><span class="l3">Too much</span></div>
    <div class="nut-rows">${PL.NUTRIENTS.map(([k, label, unit]) => { const [t, c] = status[PL.nStatus(k, avg[k])]; return `<div class="nut-row"><b>${label}</b>${zoneBar(k, avg[k])}<span class="num">${avg[k]} ${unit} <small>/ ${PL.TARGET[k]}</small></span><span class="flag ${c}">${t}</span></div>`; }).join('')}</div>
    <p class="hint" style="margin-top:12px">Targets are per lunch for a grade 3 student (about a third of the daily need). Replace them with your national school-meal standard.</p></div>
  <div class="kgrid">
    <div class="card"><div class="row spread"><h3>Students to check on</h3><span class="pill orange">${low.length} flagged</span></div><p class="hint">Ate less than 60% of the calorie target at their last lunch. Visible to the school dietitian and homeroom teacher only.</p>
      <div class="lowlist">${low.length ? low.slice(0, 8).map(x => `<div><span class="av">${esc(x.s.name[0])}</span><div><b>${esc(x.s.name)} · Class ${x.s.cls}</b><span>${x.n.kcal} kcal · protein ${x.n.p} g</span></div><span class="flag low">${pct(x.r)}</span></div>`).join('') : '<p class="hint" style="padding:12px 0">Nobody below 60% right now.</p>'}</div></div>
    <div class="card"><h3>Where nutrients are lost</h3><p class="hint">Nutrients served but left on trays today, all finished trays</p>
      ${(() => { const left = Object.fromEntries(MENU.map(d => [d.id, T().dish[d.id].ret])); const served = Object.fromEntries(MENU.map(d => [d.id, T().dish[d.id].served])); const L = PL.nutrientsOf(left), S = PL.nutrientsOf(served);
        return `<div class="nut-rows" style="margin-top:12px">${PL.NUTRIENTS.map(([k, label, unit]) => `<div class="nut-row lost"><b>${label}</b><div class="zbar"><i class="high" style="width:${L[k] / S[k] * 100}%"></i></div><span class="num">${pct(L[k] / S[k])}</span><span class="hint">${Math.round(L[k] / 1000 * (unit === 'g' ? 1 : 1)).toLocaleString('en-US')}${unit === 'g' ? ' kg' : 'k kcal'}</span></div>`).join('')}</div>`; })()}
      <p class="hint" style="margin-top:12px">Vegetables carry most of the lost fibre and vitamins. The Spinach Week quest targets this.</p></div>
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
  <div class="page-head"><div><h1>Environment</h1><p>The school's impact, shown on the cafeteria screen and in every student's Loopi app.</p></div></div>
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
  <p class="hint" style="margin-top:14px">Illustrative factors: 2.5 kg CO₂e per kg of food, 6.6 kg CO₂ absorbed per pine tree per year, 0.17 kg CO₂ per car-km. Swap in published factors (e.g. EPA WARM) before quoting.</p>`;
}

/* ---------------------------------------------------------------- Plan & order */
function forecast() {
  const p = ui.plan, att = p.att - (p.event === 'trip' ? 138 : 0);
  const rows = TOMORROW.map(d => {
    let k = 1;
    if (p.weather === 'rainy' && d.id === 'soup') k *= 1.10;
    if (p.weather === 'cold' && d.id === 'soup') k *= 1.15;
    if (p.weather === 'cold' && d.id === 'yogurt') k *= .92;
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
      <div><label>Weather</label><div class="seg" id="weather">${['sunny', 'rainy', 'cold'].map(w => `<button data-w="${w}" aria-pressed="${p.weather === w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join('')}</div></div>
      <div><label for="event">School calendar</label><select id="event">${[['normal', 'Normal day'], ['trip', 'Grade 6 field trip (−138)'], ['sports', 'Sports day']].map(([v, l]) => `<option value="${v}" ${p.event === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div id="plan-out">${planOut()}</div>
  </div>
  <div class="card"><h3>Cook: recipe tweaks students will eat more of</h3><p class="hint">From 4 weeks of before/after scans</p>
    <div class="insights" style="margin-top:10px">${[
      ['var(--tint)', 'Spinach namul with sesame dressing', 'Eaten 64% vs. 52% plain in the class A/B test. Make it the default.'],
      ['var(--blue)', 'Soup: 150 ml ladle, refills allowed', 'Cuts soup waste from 42% to 24% with no drop in satisfaction.'],
      ['var(--orange)', 'Kimchi: 25 g default portion', 'Most students leave 10–15 g of a 35 g serving.'],
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
    `Class ${cls.c.id} leads Grade 3 with ${pct(cls.red)} less waste than when it started. ${pct(PL.zeroRate())} of trays had zero leftovers, growing ${t.zero} fruits on the Green Tree, and ${pct(mix.m.S / mix.tot)} were Small portions.`,
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
    ['var(--tint)', '<path d="M4 17l6-6 4 4 6-8"/>', 'Spinach Week is working', 'Students tasting spinach for the quest raised the share eaten by 17 points.'],
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
  PL.paintPets(main);
  const tree = $('#env-tree', main); if (tree) drawTreeInto(tree, 0);
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
  update() { if (!root) return; const y = scrollY, fid = document.activeElement && document.activeElement.id; if (ui.view === 'plan' && fid === 'att') return; render(); scrollTo({ top: y }); if (fid && $('#' + fid)) $('#' + fid).focus(); },
  tick(t) { if (root && t % 20 === 0) { const l = $('#kit-live', root); if (l) l.innerHTML = `<span class="live"><i></i>Live from the scanner · ${PL.clock()}</span>`; } },
};
})();
