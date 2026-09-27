/* Loopi Care: the hospital patient app. Patients sign in at the ward scanner with their face, and every
   tray is scanned before and after the meal. The app shows what they ate against the targets their care
   team set for their diet, and builds the weekly healthcare report the doctor and dietitian see.
   In hospitals the goal flips: plate waste usually means a patient isn't eating enough. */
(() => {
'use strict';
const { $, $$, pct, esc } = PL;
const H = PL.health;

const ui = { tab: 'today', preset: 'Ate well' };
let root = null;
const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  today: I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  report: I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-4"/>'),
  me: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  alert: I('<path d="M12 4 2.5 20h19Z"/><path d="M12 10v4M12 17v.5"/>'),
};
const TABS = { today: 'Today', report: 'Report', me: 'Me' };
const me = () => H.patient(PL.S.care.me.patient) || PL.S.care.patients[0];
const DAYS = () => [...new Set(me().log.map(l => l.day))];
const sumN = recs => recs.reduce((o, r) => { Object.keys(o).forEach(k => { o[k] += r.n[k] || 0; }); return o; }, { kcal: 0, p: 0, c: 0, f: 0, na: 0 });
const ate = r => 1 - r.w;
const mealName = id => H.MEALS.find(m => m[0] === id)[1];

/* ================================================================ frame */
function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="stu care">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon care-icon" aria-hidden="true"><canvas width="44" height="37" data-form="guardian" data-stage="adult"></canvas></span><div><b>Loopi Care</b><span>by PlateLoop · for hospitals</span></div></div>
      <p class="stu-note">Demo: pick a patient</p>
      <div class="chips" id="care-who"></div>
      <div class="demo-box">
        <label for="care-preset">Next meal on the ward</label>
        <select id="care-preset">${Object.keys(H.PRESETS).map(p => `<option>${p}</option>`).join('')}</select>
        <button class="btn primary" id="care-serve"></button>
      </div>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone">
      <header class="phone-top" id="care-top"></header>
      <div class="phone-body" id="care-body"></div>
      <nav class="phone-tabs three" role="tablist" aria-label="Loopi Care">${Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}">${ICON[t]}${TABS[t]}</button>`).join('')}</nav>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; render(); $('#care-body').scrollTop = 0; });
  $('#care-preset', el).onchange = e => { ui.preset = e.target.value; };
  $('#care-serve', el).onclick = () => {
    const P = me(), rec = H.scanPatientMeal(P, ui.preset);
    if (!rec) return PL.toast('All of today\'s meals are scanned.');
    PL.store.save('care');
    PL.toast(`${mealName(rec.meal)} scanned: ${pct(ate(rec))} eaten, ${rec.n.kcal} kcal.`);
  };
  render();
}
function render(keep) {
  if (!root) return;
  const P = me(), body = $('#care-body', root), y = body.scrollTop;
  $('#care-who', root).innerHTML = PL.S.care.patients.map(p => `<button class="chip plain" data-pid="${p.id}" aria-pressed="${p.id === P.id}">${esc(p.name)}</button>`).join('');
  $$('#care-who button', root).forEach(b => b.onclick = () => { PL.S.care.me.patient = b.dataset.pid; PL.store.save('me'); });
  const next = H.nextMeal(P);
  $('#care-serve', root).textContent = next ? `Scan ${mealName(next).toLowerCase()} tray` : 'Today is done';
  $('#care-serve', root).disabled = !next;
  $('#care-preset', root).value = ui.preset;
  $('#care-top', root).innerHTML = `<canvas width="40" height="34" data-care-pet></canvas><div><b>${esc(P.name)}</b><span>Room ${P.room} · ${H.DIETS[P.diet].name} diet</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ today, report, meTab })[ui.tab === 'me' ? 'meTab' : ui.tab](P);
  paint(0);
  const send = $('#send-report', body); if (send) send.onclick = () => PL.toast(`Report sent to ${P.doctor} and the ward dietitian (demo, nothing was sent).`);
  const pr = $('#print-report', body); if (pr) pr.onclick = () => print();
  if (keep) body.scrollTop = y;
}
function companionMood(P) {
  const last = P.log[P.log.length - 1];
  return ate(last) >= .75 ? 'joy' : ate(last) >= .5 ? 'happy' : 'meh';
}
function paint(t) {
  const P = me();
  $$('canvas[data-care-pet]', root).forEach(cv => PL.drawPet(cv, { rows: 30, t, stage: 'adult', form: 'guardian', mood: companionMood(P) }));
  PL.paintPets(root, t);
}

/* ================================================================ Today */
function alertFor(P) {
  const last3 = P.log.slice(-3), low = last3.filter(r => ate(r) < .5).length;
  return low >= 2 ? `Under half eaten at ${low} of the last 3 meals. Your nurse has been told, and the dietitian will stop by today.` : '';
}
function today(P) {
  const D = H.DIETS[P.diet], recs = P.log.filter(l => l.day === H.TODAY), tot = sumN(recs), next = H.nextMeal(P);
  const good = recs.filter(r => ate(r) >= .75).length;
  const last = recs[recs.length - 1];
  const line = !last ? 'Good morning! Breakfast is on its way.'
    : ate(last) >= .75 ? `You ate well at ${mealName(last.meal).toLowerCase()}. That helps you heal.`
    : ate(last) >= .5 ? `${pct(ate(last))} of ${mealName(last.meal).toLowerCase()} was eaten. Even a little more helps.`
    : `Not much of ${mealName(last.meal).toLowerCase()} was eaten. Tell your nurse if something doesn't taste right.`;
  const alert = alertFor(P);
  return `
  ${alert ? `<div class="care-alert">${ICON.alert}<span>${alert}</span></div>` : ''}
  <section class="group companion">
    <canvas width="96" height="80" data-care-pet></canvas>
    <div><b>Loopi</b><span>${line}</span>
      <div class="meal-dots" aria-label="${good} of 3 meals mostly eaten today">${H.MEALS.map(([id]) => { const r = recs.find(x => x.meal === id); return `<i class="${r ? (ate(r) >= .75 ? 'on' : 'part') : ''}"></i>`; }).join('')}<small>${good} of 3 meals eaten well</small></div></div>
  </section>
  <h4 class="sec">Today's meals</h4>
  <section class="group">${H.MEALS.map(([id, name, t]) => {
    const r = recs.find(x => x.meal === id);
    return `<div class="step ${r ? 'done' : ''}"><span class="step-n">${r ? ICON.check : '·'}</span><div><b>${name}</b><span>${r ? `${pct(ate(r))} eaten · ${r.n.kcal} kcal · ${r.n.p} g protein · scanned ${r.t}` : id === next ? `Arrives about ${t}` : `Later, about ${t}`}</span></div></div>`;
  }).join('')}</section>
  ${last ? `<h4 class="sec">${mealName(last.meal)}, dish by dish</h4><section class="group">${H.dishRows(H.wardMenu(last.meal, P.diet), last)}</section>` : ''}
  <h4 class="sec">So far today</h4>
  <section class="group pad">${H.nutrientRows(tot, D.target, ['kcal', 'p', P.diet === 'diabetic' ? 'c' : 'na'])}</section>
  <p class="foot">Daily targets for a ${D.name.toLowerCase()} diet, set by your care team.</p>`;
}

/* ================================================================ Report: the healthcare report */
function findings(P, days, perDay) {
  const D = H.DIETS[P.diet], T = D.target, out = [];
  const lowDays = perDay.filter(n => n.kcal < T.kcal * .75).length;
  if (lowDays >= 3) out.push(['warn', `Energy was under 75% of the target on ${lowDays} of ${days.length} days. That's a malnutrition risk, so a dietitian review is recommended.`]);
  const a = perDay.slice(0, 3).reduce((s, n) => s + n.kcal, 0) / 3, b = perDay.slice(-4, -1).reduce((s, n) => s + n.kcal, 0) / 3;
  if (b > a * 1.12) out.push(['good', `Intake is improving: from about ${Math.round(a)} to ${Math.round(b)} kcal a day over the week.`]);
  else if (b < a * .88) out.push(['warn', `Intake is falling: from about ${Math.round(a)} to ${Math.round(b)} kcal a day over the week.`]);
  const byMeal = H.MEALS.map(([id, name]) => { const rs = P.log.filter(r => r.meal === id); return [name, rs.reduce((s, r) => s + ate(r), 0) / rs.length]; }).sort((x, y) => x[1] - y[1]);
  if (byMeal[2][1] - byMeal[0][1] > .12) out.push(['info', `${byMeal[0][0]} is the weakest meal (${pct(byMeal[0][1])} eaten, against ${pct(byMeal[2][1])} at ${byMeal[2][0].toLowerCase()}).`]);
  const avg = k => perDay.reduce((s, n) => s + n[k], 0) / perDay.length;
  if (P.diet === 'protein') out.push([avg('p') >= T.p * .9 ? 'good' : 'warn', `Protein averaged ${Math.round(avg('p'))} g a day against a ${T.p} g target.`]);
  if (P.diet === 'diabetic') out.push([avg('c') <= T.c * 1.1 ? 'good' : 'warn', `Carbs averaged ${Math.round(avg('c'))} g a day, ${avg('c') <= T.c * 1.1 ? 'within' : 'over'} the ${T.c} g target.`]);
  if (P.diet === 'lowna') out.push([avg('na') <= T.na ? 'good' : 'warn', `Sodium averaged ${Math.round(avg('na')).toLocaleString('en-US')} mg a day, ${avg('na') <= T.na ? 'under' : 'over'} the ${T.na.toLocaleString('en-US')} mg limit.`]);
  const left = leftMost(P)[0];
  if (left && left.left > .45) out.push(['info', `${left.name} comes back the most (${pct(left.left)} left on average).${/soup/i.test(left.name) && P.diet === 'lowna' ? ' Low-salt soups often taste bland; herbs, lemon or sesame can help.' : ' Worth asking the kitchen about a swap.'}`]);
  return out.slice(0, 5);
}
function leftMost(P) {
  const m = {};
  P.log.forEach(r => Object.keys(r.served).forEach(id => { const d = PL.DISH[id]; const k = d.name; m[k] = m[k] || { name: k, s: 0, l: 0 }; m[k].s += r.served[id]; m[k].l += r.measured[id]; }));
  return Object.values(m).map(x => ({ name: x.name, left: x.l / x.s })).sort((a, b) => b.left - a.left).slice(0, 3);
}
function report(P) {
  const D = H.DIETS[P.diet], T = D.target, days = DAYS(), full = days.filter(d => P.log.filter(r => r.day === d).length === 3);
  const perDay = full.map(d => sumN(P.log.filter(r => r.day === d)));
  const avg = Object.fromEntries(Object.keys(T).map(k => [k, Math.round(perDay.reduce((s, n) => s + n[k], 0) / perDay.length)]));
  const wellEaten = P.log.filter(r => ate(r) >= .75).length;
  const tone = { warn: 'var(--orange)', good: 'var(--tint)', info: 'var(--blue)' };
  return `
  <section class="group rep-head"><div><b>Nutrition report</b><span>${full[0]} to ${full[full.length - 1]} · ${P.log.length} meals scanned</span></div><span class="pill">${D.name} diet</span></section>
  <section class="group health-top">
    ${H.ring(avg.kcal, T.kcal, `kcal a day · target ${T.kcal.toLocaleString('en-US')}`)}
    <div class="rep-kpis"><div><b class="num">${avg.p} g</b><span>protein a day · target ${T.p} g</span></div><div><b class="num">${wellEaten}/${P.log.length}</b><span>meals mostly eaten (75%+)</span></div></div>
  </section>
  <h4 class="sec">What this means</h4>
  <section class="group">${findings(P, full, perDay).map(([k, t]) => `<div class="finding"><i style="background:${tone[k]}"></i><span>${t}</span></div>`).join('')}</section>
  <h4 class="sec">Energy each day, share of target</h4>
  <section class="group chart">${H.dayBars(full, perDay.map(n => n.kcal / T.kcal), 'Energy each day')}</section>
  <h4 class="sec">Protein each day, share of target</h4>
  <section class="group chart">${H.dayBars(full, perDay.map(n => n.p / T.p), 'Protein each day')}</section>
  <h4 class="sec">Average day</h4>
  <section class="group pad">${H.nutrientRows(avg, T, ['kcal', 'p', 'c', 'f', 'na'])}</section>
  <h4 class="sec">By meal</h4>
  <section class="group">${H.MEALS.map(([id, name]) => { const rs = P.log.filter(r => r.meal === id), a = rs.reduce((s, r) => s + ate(r), 0) / rs.length; return `<div class="dish"><i style="background:var(--fill3);border-color:var(--fill3)"></i><span>${name}</span><span class="dbar"><i style="width:${Math.round(a * 100)}%"></i></span><span class="g-v num">${pct(a)} eaten</span></div>`; }).join('')}</section>
  <h4 class="sec">Left most often</h4>
  <section class="group">${leftMost(P).map(x => `<div class="g-row two-col"><span>${esc(x.name)}</span><span class="g-v num">${pct(x.left)} left</span></div>`).join('')}</section>
  <div class="two-btn"><button class="btn primary" id="send-report">Send to care team</button><button class="btn" id="print-report">Print</button></div>
  <p class="foot">Shared with ${esc(P.doctor)} and the ward dietitian. Measured by the ward scanner before and after every tray; targets are illustrative.</p>`;
}

/* ================================================================ Me */
function meTab(P) {
  const D = H.DIETS[P.diet];
  return `
  <section class="group profile"><canvas width="120" height="100" data-care-pet></canvas><div><b>${esc(P.name)}</b><span>${P.age} · Room ${P.room}<br>${esc(P.why)}</span></div></section>
  <h4 class="sec">Diet</h4>
  <section class="group">
    <div class="g-row two-col"><span>${D.name}</span><span class="g-v">${esc(D.note)}</span></div>
    ${Object.entries(D.target).map(([k, v]) => `<div class="g-row two-col"><span class="g-k">${H.NAMES[k][0]}</span><span class="g-v num">${k === 'na' ? 'under ' : ''}${v.toLocaleString('en-US')} ${H.NAMES[k][1]} a day</span></div>`).join('')}
  </section>
  <h4 class="sec">Care team</h4>
  <section class="group">
    <div class="g-row two-col"><span>Doctor</span><span class="g-v">${esc(P.doctor)}</span></div>
    <div class="g-row two-col"><span>Dietitian</span><span class="g-v">Park Eunji, ward 7B</span></div>
    <div class="g-row two-col"><span>Nurse station</span><span class="g-v">7B, ext. 4172</span></div>
  </section>
  <h4 class="sec">Privacy</h4>
  <section class="group"><div class="switch-row"><span>Face sign-in</span><span class="g-v">On</span></div></section>
  <p class="foot">The ward scanner keeps a match code made from your face, never a photo. Your report is shared only with your care team, and it's deleted 30 days after you go home.</p>`;
}

PL.apps.care = {
  title: 'Loopi Care',
  mount,
  unmount() { root = null; },
  update() { render(true); },
  tick(t) { if (root) paint(t); },
};
})();
