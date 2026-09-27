/* Shared visuals for every app: Loopi (the guide character), food illustrations, the tray picture,
   Singapore's My Healthy Plate, ring gauges and a week of plates. Everything returns an HTML or SVG
   string so the apps can drop it into their markup. */
(() => {
'use strict';
const V = PL.V = {};
const esc = PL.esc;

/* ---------------------------------------------------------------- Loopi, the guide
   expr: happy | wave | point | cheer | think | wow | calm */
V.loopi = (expr = 'happy', size = 96, label = 'Loopi') => {
  const look = { point: [2.2, .5], think: [-1.8, -2.2], wow: [0, 0] }[expr] || [0, .6];
  const eye = x => expr === 'cheer'
    ? `<path d="M${x - 7} 67q7-8 14 0" fill="none" stroke="#1F2A1D" stroke-width="3.4" stroke-linecap="round"/>`
    : `<g class="lp-eye"><ellipse cx="${x}" cy="66" rx="${expr === 'wow' ? 8 : 7}" ry="${expr === 'wow' ? 9.5 : 8.5}" fill="#fff"/><circle cx="${x + look[0]}" cy="${67 + look[1]}" r="${expr === 'wow' ? 4.6 : 4}" fill="#1F2A1D"/><circle cx="${x + look[0] + 1.6}" cy="${65 + look[1]}" r="1.4" fill="#fff"/></g>`;
  const mouth = {
    cheer: '<path d="M49 80q11 16 22 0Z" fill="#1F2A1D"/><path d="M54 86q6 5 12 0" fill="#FF8FA0"/>',
    wow: '<ellipse cx="60" cy="84" rx="4.5" ry="5.5" fill="#1F2A1D"/>',
    think: '<path d="M56 84q5-2 9 1" fill="none" stroke="#1F2A1D" stroke-width="3" stroke-linecap="round"/>',
    calm: '<path d="M52 82q8 5 16 0" fill="none" stroke="#1F2A1D" stroke-width="3" stroke-linecap="round"/>',
  }[expr] || '<path d="M50 80q10 10 20 0" fill="none" stroke="#1F2A1D" stroke-width="3.2" stroke-linecap="round"/>';
  const arm = (d, cls = '') => `<path class="${cls}" d="${d}" fill="none" stroke="#6CC25C" stroke-width="8" stroke-linecap="round"/>`;
  const arms = {
    cheer: arm('M26 76q-12-8-13-22') + arm('M94 76q12-8 13-22'),
    wave: arm('M26 82q-9 7-10 16') + arm('M94 76q13-6 14-22', 'lp-wave'),
    point: arm('M26 82q-9 7-10 16') + arm('M95 80q13-1 21-7'),
    think: arm('M26 82q-9 7-10 16') + arm('M92 88q-8 6-22 0'),
  }[expr] || arm('M26 82q-9 7-10 16') + arm('M94 82q9 7 10 16');
  return `<svg class="loopi lp-${expr}" width="${size}" height="${size * 1.08}" viewBox="0 0 120 130" role="img" aria-label="${esc(label)}">
    <ellipse cx="60" cy="124" rx="30" ry="4" fill="rgba(0,0,0,.08)"/>
    <g class="lp-body">
      <ellipse cx="47" cy="119" rx="9" ry="5" fill="#4FA844"/><ellipse cx="73" cy="119" rx="9" ry="5" fill="#4FA844"/>
      ${arms}
      <path d="M60 30c27 0 43 20 43 47s-17 42-43 42-43-15-43-42 16-47 43-47Z" fill="#8FDB7E"/>
      <path d="M18 84c5 21 21 35 42 35s37-14 42-35c-8 13-23 21-42 21s-34-8-42-21Z" fill="#76C866"/>
      <ellipse cx="60" cy="94" rx="21" ry="15" fill="#D6F5CB"/>
      <path d="M60 31c-1-7 0-12 2-16" fill="none" stroke="#3E9B4A" stroke-width="4" stroke-linecap="round"/>
      <path class="lp-leaf" d="M62 16c6-10 19-10 23-5-4 8-15 10-23 5Z" fill="#4DB35B"/><path d="M60 18c-6-8-17-8-21-3 4 7 14 8 21 3Z" fill="#62C76F"/>
      <circle cx="38" cy="78" r="6" fill="#FF9AA8" opacity=".55"/><circle cx="82" cy="78" r="6" fill="#FF9AA8" opacity=".55"/>
      ${eye(47)}${eye(73)}${mouth}
    </g></svg>`;
};
/** Loopi with a speech bubble. */
V.guide = (expr, text, opts = {}) => `<div class="guide ${opts.big ? 'big' : ''}">${V.loopi(expr, opts.size || (opts.big ? 120 : 76))}<div class="bubble"><p>${text}</p>${opts.speak ? `<button class="speak" data-speak="${esc(opts.speak)}" aria-label="Read aloud"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg></button>` : ''}</div></div>`;
/** Read Loopi's words aloud (for children who can't read yet). */
V.wireSpeak = root => PL.$$('[data-speak]', root).forEach(b => b.onclick = () => {
  if (!('speechSynthesis' in window)) return PL.toast('Reading aloud isn\'t available here.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(b.dataset.speak); u.rate = .92; u.pitch = 1.15; speechSynthesis.speak(u);
});

/* ---------------------------------------------------------------- food illustrations (48 × 48) */
const BOWL = '<path d="M5 25h38a19 15 0 0 1-38 0Z" fill="#fff" stroke="#D9D2C3" stroke-width="2"/><path d="M8 25h32" stroke="#D9D2C3" stroke-width="2"/>';
const SHAPES = {
  rice: (c, e) => `${BOWL}<path d="M9 25c2-9 9-13 15-13s13 4 15 13Z" fill="${c}" stroke="${e}" stroke-width="1.5"/>${[[18, 19], [24, 16], [29, 20], [22, 22], [15, 23]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry=".9" fill="${e}" opacity=".7"/>`).join('')}`,
  soup: (c, e) => `${BOWL}<ellipse cx="24" cy="25" rx="17" ry="4.5" fill="${c}" stroke="${e}" stroke-width="1.2"/><circle cx="19" cy="25" r="2" fill="${e}" opacity=".6"/><circle cx="28" cy="24.5" r="1.6" fill="#E0703A" opacity=".8"/><path d="M18 8c-2 3 2 5 0 8M25 6c-2 3 2 5 0 8M32 8c-2 3 2 5 0 8" fill="none" stroke="#C9C2B4" stroke-width="1.8" stroke-linecap="round"/>`,
  noodles: (c, e) => `${BOWL}<ellipse cx="24" cy="25" rx="17" ry="4.5" fill="${c}"/><path d="M11 24c3-3 5 3 8 0s5 3 8 0 5 3 8 0 3 2 3 2" fill="none" stroke="#F7E3A8" stroke-width="2.2"/><circle cx="30" cy="23" r="2.4" fill="#F6C1A0"/><path d="M34 5 22 23M38 6 26 23" stroke="#A67A2E" stroke-width="2" stroke-linecap="round"/>`,
  chicken: (c, e) => `<path d="M31 8c7 0 11 6 10 12-1 8-9 11-15 9l-7 7a3.2 3.2 0 1 1-4.5-4.5 3.2 3.2 0 1 1-4.5-4.5l7-7c-2-7 3-12 9-12Z" fill="${c}" stroke="${e}" stroke-width="1.8" stroke-linejoin="round"/><path d="M28 13c4-1 7 1 8 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/><circle cx="12.5" cy="35.5" r="3.2" fill="#FFF8EC" stroke="#D9CBB0" stroke-width="1.3"/><circle cx="8" cy="31" r="3.2" fill="#FFF8EC" stroke="#D9CBB0" stroke-width="1.3"/>`,
  fish: (c, e) => `<path d="M6 24c6-9 16-11 26-6l9-6v24l-9-6c-10 5-20 3-26-6Z" fill="${c}" stroke="${e}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="13" cy="22" r="1.8" fill="#1F2A1D"/><path d="M20 19c2 3 2 7 0 10" fill="none" stroke="${e}" stroke-width="1.5"/><path d="M10 34h14" stroke="#9CCB6B" stroke-width="2.5" stroke-linecap="round"/>`,
  tofu: (c, e) => `<path d="M10 20 24 13l14 7v14l-14 7-14-7Z" fill="${c}" stroke="${e}" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20l14 7 14-7M24 27v14" fill="none" stroke="${e}" stroke-width="1.5"/>`,
  egg: (c, e) => `<ellipse cx="17" cy="26" rx="10" ry="13" fill="#fff" stroke="#D9CBB0" stroke-width="1.6"/><circle cx="17" cy="28" r="5.5" fill="#F7B733"/><ellipse cx="32" cy="24" rx="10" ry="13" fill="#fff" stroke="#D9CBB0" stroke-width="1.6"/><circle cx="32" cy="26" r="5.5" fill="#F7B733"/>`,
  greens: (c, e) => `<path d="M24 42C12 36 8 22 14 10c9 6 12 18 10 32Z" fill="${c}" stroke="${e}" stroke-width="1.6"/><path d="M24 42c12-6 16-20 10-32-9 6-12 18-10 32Z" fill="${c}" stroke="${e}" stroke-width="1.6" opacity=".92"/><path d="M24 42c-1-10 0-20 1-30" fill="none" stroke="${e}" stroke-width="1.6"/><path d="M14 10c3 8 6 18 10 32M34 10c-3 8-6 18-10 32" fill="none" stroke="#fff" stroke-width="1" opacity=".35"/>`,
  broccoli: (c, e) => `<path d="M21 30h6l2 12h-10Z" fill="#9CCB6B" stroke="#6A9440" stroke-width="1.5"/><circle cx="16" cy="22" r="8" fill="${c}"/><circle cx="32" cy="22" r="8" fill="${c}"/><circle cx="24" cy="15" r="9" fill="${c}"/><circle cx="24" cy="24" r="7" fill="${c}"/><circle cx="20" cy="14" r="2" fill="#fff" opacity=".25"/>`,
  tomato: (c, e) => `<circle cx="17" cy="28" r="10" fill="${c}"/><circle cx="31" cy="25" r="10" fill="${c}"/><path d="M17 18l-3-3M17 18l3-3M17 18v-4M31 15l-3-3M31 15l3-3M31 15v-4" stroke="#3F7D32" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="25" r="2" fill="#fff" opacity=".4"/><circle cx="28" cy="22" r="2" fill="#fff" opacity=".4"/>`,
  cucumber: (c, e) => [[14, 20], [30, 18], [22, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${e}"/><circle cx="${x}" cy="${y}" r="7" fill="#DDF0C0"/><circle cx="${x}" cy="${y}" r="2.5" fill="${c}" opacity=".6"/>`).join(''),
  beans: (c, e) => [0, 1, 2].map(i => `<path d="M${9 + i * 4} ${36 - i * 3}c8-14 18-22 30-24" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/>`).join(''),
  melon: (c, e) => `<path d="M6 16h36a18 18 0 0 1-36 0Z" fill="#5BA84A"/><path d="M9 16h30a15 15 0 0 1-30 0Z" fill="${c}"/>${[[17, 22], [24, 26], [31, 22], [21, 19], [28, 19]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry="1.9" fill="#1F2A1D"/>`).join('')}`,
  papaya: (c, e) => `<path d="M24 6c10 0 16 10 16 20s-7 16-16 16S8 36 8 26 14 6 24 6Z" fill="${c}" stroke="${e}" stroke-width="1.8"/><ellipse cx="24" cy="28" rx="6" ry="9" fill="#FCE3B8"/>${[[22, 24], [26, 26], [23, 30], [26, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#1F2A1D"/>`).join('')}`,
  banana: (c, e) => `<path d="M8 16c4 16 18 24 34 18-12 0-22-8-26-20Z" fill="${c}" stroke="${e}" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 16l-2-4" stroke="#7A5A20" stroke-width="2.5" stroke-linecap="round"/>`,
  dragon: (c, e) => `<circle cx="24" cy="26" r="15" fill="${c}"/><circle cx="24" cy="26" r="11" fill="#fff" opacity=".9"/>${[[20, 22], [27, 21], [24, 27], [19, 29], [29, 29], [23, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#1F2A1D"/>`).join('')}<path d="M12 18l-4-3M36 18l4-3M24 11V6" stroke="#5BA84A" stroke-width="2.5" stroke-linecap="round"/>`,
  berry: (c, e) => [[16, 28], [30, 28], [23, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${c}"/><path d="M${x - 2} ${y - 6}l2 2 2-2" stroke="#1F2A1D" stroke-width="1.2" fill="none"/>`).join(''),
  cup: (c, e) => `<path d="M13 12h22l-3 28H16Z" fill="${c}" stroke="${e}" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 20h20" stroke="${e}" stroke-width="1.5"/>`,
  potato: (c, e) => `<path d="M8 28c0-9 8-16 18-16s14 6 14 12-8 14-18 14-14-4-14-10Z" fill="${c}" stroke="${e}" stroke-width="1.8"/><circle cx="19" cy="24" r="1.3" fill="${e}"/><circle cx="29" cy="28" r="1.3" fill="${e}"/>`,
  dumpling: (c, e) => [[16, 28], [32, 24]].map(([x, y]) => `<path d="M${x - 11} ${y + 3}c0-8 5-13 11-13s11 5 11 13Z" fill="${c}" stroke="${e}" stroke-width="1.6"/><path d="M${x - 5} ${y - 7}l1 4M${x} ${y - 9}v4M${x + 5} ${y - 7}l-1 4" stroke="${e}" stroke-width="1.3"/>`).join(''),
  sauce: (c, e) => `<ellipse cx="24" cy="30" rx="16" ry="7" fill="#fff" stroke="#D9D2C3" stroke-width="2"/><ellipse cx="24" cy="29" rx="11" ry="4" fill="${c}"/>`,
  plate: (c, e) => `<circle cx="24" cy="24" r="16" fill="${c}" stroke="${e}" stroke-width="2"/>`,
};
const KIND = [
  [/laksa|noodle|udon/i, 'noodles'], [/congee|porridge|rice/i, 'rice'], [/soup|broth/i, 'soup'],
  [/chicken/i, 'chicken'], [/fish/i, 'fish'], [/tofu/i, 'tofu'], [/egg/i, 'egg'], [/broccoli/i, 'broccoli'],
  [/tomato/i, 'tomato'], [/cucumber/i, 'cucumber'], [/long bean|sprout/i, 'beans'], [/kailan|spinach|cabbage|greens|salad/i, 'greens'],
  [/watermelon|melon/i, 'melon'], [/papaya/i, 'papaya'], [/banana/i, 'banana'], [/dragon/i, 'dragon'], [/berr/i, 'berry'],
  [/milk|yogurt/i, 'cup'], [/potato/i, 'potato'], [/wonton|dumpling/i, 'dumpling'], [/chilli|sambal|sauce/i, 'sauce'],
];
V.kindOf = d => (KIND.find(([re]) => re.test(d.name)) || [, 'plate'])[1];
V.food = (d, size = 44) => `<svg class="food" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${SHAPES[V.kindOf(d)](d.color, d.edge)}</svg>`;

/* ---------------------------------------------------------------- the tray: each dish, and how much was eaten */
/** rec: optional scanned meal { served, measured }. Without it the tray shows what's on the menu. */
V.tray = (menu, rec, opts = {}) => `<div class="vtray" style="--cols:${Math.min(3, Math.ceil(menu.length / 2))}">${menu.map(d => {
  const ate = rec ? Math.round((1 - rec.measured[d.id] / rec.served[d.id]) * 100) : null;
  const name = opts.name ? opts.name(d) : d.name;
  return `<div class="vcell ${opts.hi === d.id ? 'hi' : ''}">
    <div class="vfood ${rec ? 'scored' : ''}" style="--p:${ate ?? 0};--c:${ate === null ? 'var(--tint)' : ate >= 75 ? 'var(--tint)' : ate >= 40 ? '#FFB23F' : '#FF6B5B'}">${V.food(d, opts.size || 40)}</div>
    <span>${esc(name)}</span>${ate === null ? (opts.tag && opts.tag(d) ? `<em>${opts.tag(d)}</em>` : '') : `<b class="num">${ate}%</b>`}</div>`;
}).join('')}</div>`;

/* ---------------------------------------------------------------- My Healthy Plate (Health Promotion Board, Singapore)
   half fruit and vegetables, a quarter wholegrains, a quarter protein */
const GROUP = { veg: 'fv', fruit: 'fv', grain: 'g', protein: 'p' };
V.plateShares = (menu, grams) => {
  const t = { fv: 0, g: 0, p: 0 };
  menu.forEach(d => { const k = GROUP[d.group]; if (k) t[k] += grams[d.id] || 0; });
  const sum = t.fv + t.g + t.p || 1;
  return { fv: t.fv / sum, g: t.g / sum, p: t.p / sum };
};
const PLATE_COL = { fv: '#4CAF50', g: '#F2B33D', p: '#E4674B' };
const arc = (cx, cy, r, a0, a1) => { const p = a => [cx + r * Math.sin(a * 2 * Math.PI), cy - r * Math.cos(a * 2 * Math.PI)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${cx} ${cy}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > .5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`; };
const pie = (s, size, label) => {
  let a = 0;
  const parts = ['fv', 'g', 'p'].map(k => { const w = Math.max(0, Math.min(.9999, s[k])); const d = w > 0 ? arc(50, 50, 38, a, a + w) : ''; a += w; return d ? `<path d="${d}" fill="${PLATE_COL[k]}"/>` : ''; }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${label}"><circle cx="50" cy="50" r="48" fill="#fff" stroke="#E6E1D6" stroke-width="2"/><circle cx="50" cy="50" r="41" fill="none" stroke="#F1EDE4" stroke-width="2"/>${parts}<circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;
};
V.healthyPlate = (s, opts = {}) => {
  const ideal = { fv: .5, g: .25, p: .25 };
  const tips = [];
  if (s.fv < .38) tips.push('more fruit and vegetables');
  if (s.g > .38) tips.push('a smaller rice or noodle portion');
  if (s.p < .15) tips.push('a little more protein');
  const verdict = tips.length ? `Next time: ${tips.join(', ')}.` : 'Close to My Healthy Plate. Well balanced!';
  return `<div class="hplate">
    <figure>${pie(s, opts.size || 104, 'What you ate')}<figcaption>${opts.you || 'Your plate'}</figcaption></figure>
    <figure class="ideal">${pie(ideal, (opts.size || 104) * .78, 'My Healthy Plate')}<figcaption>My Healthy Plate</figcaption></figure>
    <ul class="hlegend">${[['fv', 'Fruit and veg', '½'], ['g', 'Wholegrains', '¼'], ['p', 'Protein', '¼']].map(([k, n, i]) => `<li><i style="background:${PLATE_COL[k]}"></i><span>${n}</span><b class="num">${Math.round(s[k] * 100)}%</b><small>aim ${i}</small></li>`).join('')}</ul>
    ${opts.noVerdict ? '' : `<p class="hverdict">${verdict}</p>`}</div>`;
};

/* ---------------------------------------------------------------- ring gauge: value against target */
/** kind: 'aim' (reach it), 'limit' (stay under it), 'range' (near it). */
V.ring = (value, target, label, unit, kind = 'range') => {
  const r = value / target, p = Math.min(100, Math.round(r * 100));
  const good = kind === 'limit' ? r <= 1.05 : kind === 'aim' ? r >= .85 : r >= .8 && r <= 1.25;
  const col = good ? 'var(--tint)' : kind === 'limit' || r > 1.25 ? '#FF6B5B' : '#FFB23F';
  return `<div class="vring"><div class="vr" style="--p:${p};--c:${col}"><div><b class="num">${Math.round(value).toLocaleString('en-US')}</b><small>/ ${Math.round(target).toLocaleString('en-US')}${unit === 'kcal' ? '' : ' ' + unit}</small></div></div><span>${label}</span></div>`;
};

/** A share (0..1) as a ring, e.g. how much of a meal was eaten. */
V.pctRing = (frac, label, good = .75) => { const p = Math.round(frac * 100); return `<div class="vring"><div class="vr" style="--p:${p};--c:${frac >= good ? 'var(--tint)' : frac >= .5 ? '#FFB23F' : '#FF6B5B'}"><div><b class="num">${p}%</b></div></div><span>${label}</span></div>`; };

/* ---------------------------------------------------------------- a week of plates: how much was eaten each day */
V.week = (days, fracs, opts = {}) => `<div class="vweek">${days.map((d, i) => `<div class="${opts.today === i ? 'today' : ''}"><i style="--p:${Math.round(fracs[i] * 100)};--c:${fracs[i] >= (opts.good || .75) ? 'var(--tint)' : fracs[i] >= .5 ? '#FFB23F' : '#FF6B5B'}"></i><b class="num">${Math.round(fracs[i] * 100)}%</b><span>${d.slice(0, 3)}</span></div>`).join('')}</div>`;

/* ---------------------------------------------------------------- avatar: initials on a colour picked from the name */
const AV = ['#FF9F0A', '#34C759', '#0A84FF', '#AF52DE', '#FF375F', '#30B0C7', '#5E5CE6', '#E8A317'];
V.avatar = (s, size = 36) => { const h = [...s.name].reduce((a, c) => a + c.charCodeAt(0), 0); return `<span class="av-circle" style="--av:${AV[h % AV.length]};width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px" aria-hidden="true">${esc(s.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</span>`; };

/* ---------------------------------------------------------------- small illustrated tip card */
const TIPICON = {
  leaf: '<path d="M6 30C6 14 16 6 32 6c0 16-8 26-26 24Zm0 0 14-14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  drop: '<path d="M18 4s10 11 10 18a10 10 0 0 1-20 0C8 15 18 4 18 4Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
  bolt: '<path d="M20 3 7 20h10l-2 13 13-17H18Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
  scale: '<path d="M6 10h24M18 6v24M10 30h16M6 10l-4 9h8ZM30 10l-4 9h8Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  muscle: '<path d="M6 26c2-10 8-16 14-16 4 0 5 3 3 5-2 1-5 1-6 3 6-1 11 2 12 7 1 6-5 8-11 8-6 0-11-2-12-7Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>',
  plate: '<circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 5v26M18 18h13" stroke="currentColor" stroke-width="2.6"/>',
  warn: '<path d="M18 4 3 31h30Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 14v8M18 26v.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  check: '<circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 18.5l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  salt: '<path d="M12 12h12l3 20H9Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M13 12c0-5 10-5 10 0M15 7h.1M18 6h.1M21 7h.1" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  recycle: '<path d="M13 8l5-4 5 4M18 4v12M8 28l-3-6 6-2M5 22l9 5M28 28l3-6-6-2M31 22l-9 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  cloud: '<path d="M10 28a7 7 0 0 1-1-14 9 9 0 0 1 17-2 7 7 0 0 1 1 16Z" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/>',
  smile: '<circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 21c3.5 4 8.5 4 12 0M13 14h.1M23 14h.1" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  heart: '<path d="M18 31 6 19a7 7 0 0 1 12-9 7 7 0 0 1 12 9Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
  bowl: '<path d="M4 16h28a14 12 0 0 1-28 0Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M13 10c0-2 2-3 2-5M21 10c0-2 2-3 2-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
};
V.icon = (name, color) => `<span class="vicon" style="--ic:${color}"><svg viewBox="0 0 36 36" aria-hidden="true">${TIPICON[name] || TIPICON.leaf}</svg></span>`;
/** tone: good | warn | info */
V.tip = (icon, tone, title, text) => `<div class="vtip ${tone}">${V.icon(icon, { good: 'var(--tint)', warn: '#F28C28', info: 'var(--blue)', bad: '#FF6B5B' }[tone])}<div><b>${title}</b>${text ? `<span>${text}</span>` : ''}</div></div>`;
})();
