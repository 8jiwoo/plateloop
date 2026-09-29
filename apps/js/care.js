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
  menu: I('<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-3 5-3 8h3v10"/>'),
  speak: I('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4Z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
};
const TABS = { today: 'Today', menu: 'Menu', report: 'Report', me: 'Me' };
/* Tomorrow's choices: patients who pick their own meals eat more energy and protein, and leave less (see docs/research.md). */
const dishLike = (name, color, edge) => ({ name, color, edge });
const CHOICES = {
  breakfast: [
    ['congee', dishLike('Chicken congee', '#F3EDDA', '#BFB28E'), 'Soft and easy to eat', 14],
    ['toast', dishLike('Eggs and wholemeal toast', '#F6D365', '#C9A13B'), 'The most protein', 19],
    ['oats', dishLike('Oats with banana', '#F7DC6F', '#C9A13B'), 'Light, a little sweet', 9],
  ],
  lunch: [
    ['fish', dishLike('Steamed fish with ginger', '#EDE3D1', '#B8A88A'), 'High protein, mild', 24],
    ['chicken', dishLike('Braised chicken and potato', '#B5652D', '#7A3F17'), 'Hearty, soft', 26],
    ['tofu', dishLike('Tofu and vegetable soup', '#F4E7C8', '#C9B48A'), 'Light, if appetite is low', 13],
  ],
  dinner: [
    ['chicken', dishLike('Braised chicken and potato', '#B5652D', '#7A3F17'), 'Hearty, soft', 26],
    ['fish', dishLike('Fish porridge', '#F3EDDA', '#BFB28E'), 'Soft and warm', 18],
    ['tofu', dishLike('Pan-fried tofu with rice', '#F4E7C8', '#C9B48A'), 'Vegetarian', 15],
  ],
};
const SIZES = [['S', 'Small'], ['M', 'Regular'], ['L', 'Large']];
/* Why a meal was left: the reasons patients give most (appetite, taste, portion, tiredness, pain, nausea). */
const FEEL = ['😣', '🙁', '😐', '🙂', '😋'];
const WHY = [['appetite', 'Not hungry'], ['taste', 'Didn’t taste right'], ['portion', 'Too much food'], ['tired', 'Too tired'], ['pain', 'In pain'], ['nausea', 'Felt sick']];
const WHY_REPLY = {
  appetite: 'Smaller portions more often can help. Your nurse can bring a snack between meals.',
  taste: 'Illness can change how food tastes. The dietitian can add sauces or spices to your menu.',
  portion: 'Tomorrow’s portions are set to Small. You can change that in Menu.',
  tired: 'A nurse can help you sit up and open your tray next time.',
  pain: 'Your nurse will check your pain relief before the next meal.',
  nausea: 'Your nurse will ask the doctor about something for the nausea, and bring plain food.',
};
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
      <div class="loopi-brand"><span class="loopi-icon care-icon" aria-hidden="true">${PL.V.loopi('calm', 46)}</span><div><b>Loopi Care</b><span>by PlateLoop · for hospitals</span></div></div>
      <p class="stu-note">Demo: pick a patient</p>
      <div class="chips" id="care-who"></div>
      <div class="demo-box">
        <label for="care-preset">Next meal on the ward</label>
        <select id="care-preset">${Object.keys(H.PRESETS).map(p => `<option>${p}</option>`).join('')}</select>
        <button class="btn primary" id="care-serve"></button>
      </div>
      <section class="ward" id="care-ward" aria-label="Nurse station"></section>
      <button class="linkish" id="care-intro" style="font-size:13px;text-align:left">Show the first-run intro</button>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone" id="care-phone">
      <header class="phone-top" id="care-top"></header>
      <div class="phone-body" id="care-body"></div>
      <nav class="phone-tabs" role="tablist" aria-label="Loopi Care">${Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}">${ICON[t]}${TABS[t]}</button>`).join('')}</nav>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; render(); $('#care-body').scrollTop = 0; });
  $('#care-preset', el).onchange = e => { ui.preset = e.target.value; };
  $('#care-serve', el).onclick = () => {
    const P = me(), rec = H.scanPatientMeal(P, ui.preset);
    if (!rec) return PL.toast('All of today\'s meals are scanned.');
    P.ack = null; // a new meal starts a fresh check
    PL.store.save('care');
    PL.notify($('#care-phone', root), { app: 'Loopi Care', icon: PL.V.loopi(ate(rec) >= .75 ? 'happy' : 'calm', 30), title: `${mealName(rec.meal)}: ${pct(ate(rec))} eaten`, text: `${rec.n.kcal} kcal and ${rec.n.p} g protein. Tap to see it dish by dish.`, onTap: () => { ui.tab = 'today'; render(); } });
  };
  $('#care-intro', el).onclick = intro;
  PL.premium(el, { accent: '#0A84FF', glow: '#5AC8FA', who: 'Hospital patients, nurses and dietitians',
    facts: [['29', '%', 'of inpatients in a Singapore hospital were malnourished, and stayed about two days longer.', 'Lim et al., Clinical Nutrition 2012'],
      ['93', '%', 'of food charts filled in by staff were incomplete. Poor eaters get missed.', 'Clinical Nutrition 2015'],
      ['31', '%', 'of hospital food is left on the plate, the median across studies.', 'Nutrients 2023 review']],
    how: ['Every tray is measured, so no one fills in a chart', 'Patients choose tomorrow’s meals and portion size', 'Alerts reach the nurse with the patient’s own reason', 'Protein shown as recovery, with read-aloud'] });
  render();
  if (!PL.introSeen('care')) intro();
}
/** First run, usually done with a nurse at the bedside: what's tracked, the diet, alerts, who sees it, and bigger text. */
function intro() {
  const P = me(), D = H.DIETS[P.diet];
  PL.onboard($('#care-phone', root), 'care', [
    { art: PL.V.loopi('calm', 150), title: 'We keep an eye on your meals.', text: 'The ward scanner weighs each tray before and after you eat, so your care team knows you’re getting enough, without you writing anything down.' },
    { art: `<div class="vrings">${PL.V.ring(D.target.kcal * .8, D.target.kcal, 'Energy', 'kcal', 'aim')}${PL.V.ring(D.target.p * .9, D.target.p, 'Protein', 'g', 'aim')}</div>`,
      title: `Your ${esc(D.name.toLowerCase())} diet.`, text: `Each day aims for ${D.target.kcal.toLocaleString('en-US')} kcal and ${D.target.p} g of protein. You’ll see how close each meal gets.` },
    { art: PL.V.icon('heart', 'var(--blue)'), title: 'If you’re not hungry, we’ll notice.', text: 'If you leave most of two meals in a row, your nurse gets a gentle alert to check in. It’s about helping you eat enough, not about finishing the plate.' },
    { consent: true, art: PL.V.icon('check', 'var(--blue)'), title: 'Who can see this.', cta: 'Start',
      body: `<ul class="onb-list"><li><b>Your nurses</b> see every meal on the ward.</li><li><b>${esc(P.doctor)} and the dietitian</b> get a weekly report.</li><li><b>No one else.</b> It’s deleted 30 days after you go home.</li></ul>
      <div class="onb-prefs"><label class="onb-pref"><span><b>Larger text</b><small>Easier to read from the bed.</small></span><input type="checkbox" role="switch" data-pref="big" ${P.big ? 'checked' : ''}></label>
      <label class="onb-agree"><input type="checkbox" data-agree> <span>I agree to share my meal records with my care team.</span></label></div>` },
  ], p => { P.big = !!p.big; PL.store.save('care'); });
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
  ward();
  $('#care-top', root).innerHTML = `${PL.V.avatar(P, 36)}<div><b>${esc(P.name)}</b><span>Room ${P.room} · ${H.DIETS[P.diet].name} diet</span></div><button class="speak" id="care-speak" aria-label="Read my day aloud" title="Read aloud">${ICON.speak}</button>`;
  $('#care-speak', root).onclick = () => speak(P);
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ today, menu, report, meTab })[ui.tab === 'me' ? 'meTab' : ui.tab](P);
  wireCare(P, body);
  const send = $('#send-report', body); if (send) send.onclick = () => PL.toast(`Report sent to ${P.doctor} and the ward dietitian (demo, nothing was sent).`);
  const pr = $('#print-report', body); if (pr) pr.onclick = () => print();
  $('#care-phone', root).classList.toggle('lg', !!P.big);
  const big = $('#care-big', body); if (big) big.onchange = () => { P.big = big.checked; PL.store.save('care'); };
  const cf = $('#care-face', body); if (cf) cf.onchange = () => { P.faceOff = !cf.checked; PL.store.save('care'); };
  if (keep) body.scrollTop = y;
  PL.motion(body, `care:${P.id}:${ui.tab}`);
}
/* ================================================================ Nurse station: the ward at a glance, with alerts to act on */
const ACTIONS = {
  visit: ['Check in', 'checked in', 'They asked how the food tastes and what you’d like instead.'],
  drink: ['Offer a supplement drink', 'brought a supplement drink', 'A small nutrition drink between meals makes up for what was missed.'],
  refer: ['Refer to the dietitian', 'asked the dietitian to visit', 'The dietitian will stop by today to adjust your menu.'],
};
const NURSE = 'Nurse Aisha';
function ward() {
  const box = root && $('#care-ward', root); if (!box) return;
  const rows = PL.S.care.patients.map(Q => {
    const D = H.DIETS[Q.diet], tot = sumN(Q.log.filter(l => l.day === H.TODAY)), frac = tot.kcal / D.target.kcal, al = alertFor(Q);
    return { Q, frac, al };
  }).sort((a, b) => (b.al && !b.Q.ack) - (a.al && !a.Q.ack));
  const open = rows.filter(r => r.al && !r.Q.ack).length;
  box.innerHTML = `<div class="ward-h"><b>Nurse station · Ward 7B</b><span class="${open ? 'ward-n' : 'ward-ok'}">${open ? `${open} alert${open > 1 ? 's' : ''}` : 'All fine'}</span></div>
    ${rows.map(({ Q, frac, al }) => `<div class="ward-row ${al && !Q.ack ? 'alarm' : ''}">
      <button class="ward-who" data-open="${Q.id}" aria-pressed="${Q.id === me().id}">${PL.V.avatar(Q, 28)}<span><b>${esc(Q.name)}</b><small>${Q.room} · ${Math.round(frac * 100)}% of today’s energy</small></span><i class="wbar"><i style="width:${Math.min(100, Math.round(frac * 100))}%"></i></i></button>
      ${al ? (Q.ack ? `<p class="ward-done">✓ ${esc(Q.ack.who)} ${ACTIONS[Q.ack.act][1]} · ${Q.ack.t}</p>`
        : `<p class="ward-al">${esc(al)}${(() => { const l = Q.log.filter(x => x.day === H.TODAY && x.why).slice(-1)[0]; return l ? ` · says: ${esc(WHY.find(w => w[0] === l.why)[1].toLowerCase())}` : ''; })()}</p><div class="ward-acts">${Object.entries(ACTIONS).map(([k, a]) => `<button class="btn small" data-act="${k}" data-pid="${Q.id}">${a[0]}</button>`).join('')}</div>`) : ''}
    </div>`).join('')}`;
  $$('[data-open]', box).forEach(b => b.onclick = () => { PL.S.care.me.patient = b.dataset.open; PL.store.save('me'); });
  $$('[data-act]', box).forEach(b => b.onclick = () => {
    const Q = H.patient(b.dataset.pid), last = Q.log[Q.log.length - 1];
    const [h, m] = (last ? last.t : '12:10').split(':').map(Number), t = h * 60 + m + 25;
    Q.ack = { act: b.dataset.act, who: NURSE, t: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` };
    PL.store.save('care'); PL.toast(`${Q.name}: ${ACTIONS[Q.ack.act][1]}. The care team can see it.`);
  });
}

/* ================================================================ Today */
const V = PL.V;
const ALL = Object.values(H.WARD_MENU).flat();
function alertFor(P) {
  const last3 = P.log.slice(-3), low = last3.filter(r => ate(r) < .5).length;
  return low >= 2 ? `Under half eaten at ${low} of the last 3 meals` : '';
}
function today(P) {
  const D = H.DIETS[P.diet], recs = P.log.filter(l => l.day === H.TODAY), tot = sumN(recs), next = H.nextMeal(P);
  const good = recs.filter(r => ate(r) >= .75).length;
  const last = recs[recs.length - 1];
  const [expr, line] = !last ? ['wave', 'Good morning! Breakfast is on its way.']
    : ate(last) >= .75 ? ['happy', `You ate well at ${mealName(last.meal).toLowerCase()}. That helps you heal.`]
    : ate(last) >= .5 ? ['calm', `${pct(ate(last))} of ${mealName(last.meal).toLowerCase()} was eaten. Even a little more helps.`]
    : ['think', `Not much of ${mealName(last.meal).toLowerCase()} was eaten. Tell your nurse if something doesn't taste right.`];
  const alert = alertFor(P), third = P.diet === 'diabetic' ? 'c' : 'na';
  return `
  ${alert ? `<div class="vtips ${P.ack ? '' : 'alert'}">${P.ack
    ? V.tip('heart', 'info', `${esc(P.ack.who)} ${ACTIONS[P.ack.act][1]} at ${P.ack.t}`, ACTIONS[P.ack.act][2])
    : V.tip('warn', 'warn', alert, 'Your nurse has been told and will come by soon.')}</div>` : ''}
  ${V.guide(expr, line)}
  <div class="vcard"><h3>Today's meals <small>${good} of 3 eaten well</small></h3><div class="meals3">${H.MEALS.map(([id, name, t]) => {
    const r = recs.find(x => x.meal === id), menu = H.wardMenu(id, P.diet);
    const col = r ? (ate(r) >= .75 ? 'var(--tint)' : ate(r) >= .5 ? '#FFB23F' : '#FF6B5B') : '';
    return `<div class="mealc ${r ? 'done' : id === next ? 'next' : ''}">
      <div class="mealc-top"><b>${name}</b><small>${r ? r.t : t}</small></div>
      <div class="mealc-food">${menu.slice(0, 4).map(d => V.food(d, 26)).join('')}</div>
      ${r ? `<div class="mealc-ring" style="--p:${Math.round(ate(r) * 100)};--c:${col}"><b class="num">${pct(ate(r))}</b></div><span>${r.n.kcal} kcal · ${r.n.p} g protein</span>`
        : `<div class="mealc-wait">${id === next ? 'Next' : 'Later'}</div><span>${id === next ? `Arrives about ${t}` : `About ${t}`}</span>`}
    </div>`;
  }).join('')}</div></div>
  ${last && ate(last) < .75 ? checkin(last) : ''}
  ${last ? `<div class="vcard"><h3>${mealName(last.meal)}, dish by dish</h3>${V.tray(H.wardMenu(last.meal, P.diet), last)}</div>` : ''}
  <div class="vcard"><h3>So far today <small>of your daily target</small></h3><div class="vrings">${V.ring(tot.kcal, D.target.kcal, 'Energy', 'kcal', 'aim')}${V.ring(tot.p, D.target.p, 'Protein', 'g', 'aim')}${V.ring(tot[third], D.target[third], third === 'c' ? 'Carbs' : 'Sodium', third === 'c' ? 'g' : 'mg', 'limit')}</div></div>
  <p class="foot">Daily targets for a ${D.name.toLowerCase()} diet, set by your care team.</p>`;
}

/** After a poor meal: how was it, and why? The answer goes to the nurse station with the alert. */
function checkin(r) {
  const name = mealName(r.meal).toLowerCase();
  if (r.why) return `<div class="vcard checkin done"><div class="ck-h"><span class="ck-face">${FEEL[r.feel ?? 1]}</span><div><b>Thanks for telling us</b><span>${esc(WHY.find(w => w[0] === r.why)[1])} · your nurse can see this</span></div></div><p class="ck-reply">${esc(WHY_REPLY[r.why])}</p></div>`;
  return `<div class="vcard checkin"><h3>How was ${name}?</h3>
    <div class="ck-faces" role="radiogroup" aria-label="How was ${name}">${FEEL.map((f, i) => `<button role="radio" aria-checked="${r.feel === i}" data-feel="${i}" aria-label="${['Awful', 'Not good', 'Okay', 'Good', 'Great'][i]}">${f}</button>`).join('')}</div>
    <p class="ck-q">What got in the way?</p>
    <div class="ck-why">${WHY.map(([k, t]) => `<button data-why="${k}">${t}</button>`).join('')}</div></div>`;
}
/** Tomorrow's menu: one main per meal and a portion size, sent to the kitchen. */
function menu(P) {
  const o = P.order || (P.order = { breakfast: { pick: 'congee', size: 'M' }, lunch: { pick: 'fish', size: 'M' }, dinner: { pick: 'chicken', size: 'M' }, sent: null });
  const prot = H.MEALS.reduce((a, [id]) => { const c = CHOICES[id].find(x => x[0] === o[id].pick); return a + c[3] * { S: .75, M: 1, L: 1.25 }[o[id].size]; }, 0);
  const T = H.DIETS[P.diet].target;
  return `
  ${V.guide('point', o.sent ? `Tomorrow is sorted. The kitchen is cooking what you chose.` : 'Pick what you feel like eating tomorrow. Choosing your own meals helps you eat more.')}
  ${H.MEALS.map(([id, name, t]) => `<div class="vcard menu-meal"><h3>${name} <small>tomorrow, ${t}</small></h3>
    <div class="mm-opts">${CHOICES[id].map(([k, d, note, p]) => `<button class="mm-opt" data-meal="${id}" data-pick="${k}" aria-pressed="${o[id].pick === k}">${V.food(d, 40)}<b>${esc(d.name)}</b><span>${esc(note)}</span><em>${p} g protein</em></button>`).join('')}</div>
    <div class="seg mm-size" role="group" aria-label="${name} portion">${SIZES.map(([k, l]) => `<button data-meal="${id}" data-size="${k}" aria-pressed="${o[id].size === k}">${l}</button>`).join('')}</div></div>`).join('')}
  <div class="vcard mm-sum"><div class="mm-prot"><span>Protein tomorrow</span><b class="num">${Math.round(prot)} g</b><i><i style="width:${Math.min(100, prot / T.p * 100).toFixed(0)}%"></i></i><small>of ${T.p} g a day from meals, before snacks</small></div>
    ${o.sent ? `<p class="mm-sent">${ICON.check} Sent to the kitchen at ${o.sent}</p>` : '<button class="btn primary mm-send" id="mm-send">Send to the kitchen</button>'}</div>
  <p class="foot">The kitchen cooks to what patients choose, so less comes back uneaten.</p>`;
}
function wireCare(P, body) {
  const last = P.log.filter(l => l.day === H.TODAY).slice(-1)[0];
  $$('[data-feel]', body).forEach(b => b.onclick = () => { last.feel = +b.dataset.feel; render(true); });
  $$('[data-why]', body).forEach(b => b.onclick = () => {
    last.why = b.dataset.why; if (last.feel == null) last.feel = 1;
    if (last.why === 'portion' && P.order) H.MEALS.forEach(([id]) => { P.order[id].size = 'S'; });
    if (last.why === 'portion' && !P.order) { menu(P); H.MEALS.forEach(([id]) => { P.order[id].size = 'S'; }); }
    PL.store.save('care'); PL.toast('Thanks. Your nurse can see this now.');
  });
  $$('.mm-opt', body).forEach(b => b.onclick = () => { P.order[b.dataset.meal].pick = b.dataset.pick; P.order.sent = null; PL.store.save('care'); });
  $$('[data-size]', body).forEach(b => b.onclick = () => { P.order[b.dataset.meal].size = b.dataset.size; P.order.sent = null; PL.store.save('care'); });
  const send = $('#mm-send', body); if (send) send.onclick = () => { P.order.sent = new Date().toTimeString().slice(0, 5); render(true); PL.store.save('care'); PL.toast('Tomorrow’s meals sent to the kitchen.'); };
}
/** Read the day aloud, for patients who find small text hard. */
function speak(P) {
  if (!('speechSynthesis' in window)) return PL.toast('Reading aloud isn’t available in this browser.');
  const recs = P.log.filter(l => l.day === H.TODAY), tot = sumN(recs), T = H.DIETS[P.diet].target, next = H.nextMeal(P);
  const text = `Hello ${P.name.split(' ')[0]}. ${recs.length ? `Today you have had ${recs.length} meal${recs.length > 1 ? 's' : ''}, and ${recs.filter(r => ate(r) >= .75).length} went well. You have had ${Math.round(tot.p)} grams of protein out of ${T.p}.` : 'Breakfast is on its way.'} ${next ? `Your next meal is ${mealName(next).toLowerCase()} at about ${H.MEALS.find(m => m[0] === next)[2]}.` : 'That is all your meals for today.'}`;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = .92; speechSynthesis.speak(u);
  PL.toast('Reading your day aloud.');
}

/* ================================================================ Report: the healthcare report */
function findings(P, days, perDay) {
  const D = H.DIETS[P.diet], T = D.target, out = [];
  const lowDays = perDay.filter(n => n.kcal < T.kcal * .75).length;
  if (lowDays >= 3) out.push(['warn', 'warn', `Energy under 75% of target on ${lowDays} of ${days.length} days`, 'That is a malnutrition risk, so a dietitian review is recommended.']);
  const a = perDay.slice(0, 3).reduce((s, n) => s + n.kcal, 0) / 3, b = perDay.slice(-4, -1).reduce((s, n) => s + n.kcal, 0) / 3;
  if (b > a * 1.12) out.push(['good', 'check', 'Intake is improving', `From about ${Math.round(a)} to ${Math.round(b)} kcal a day over the week.`]);
  else if (b < a * .88) out.push(['warn', 'warn', 'Intake is falling', `From about ${Math.round(a)} to ${Math.round(b)} kcal a day over the week.`]);
  const byMeal = H.MEALS.map(([id, name]) => { const rs = P.log.filter(r => r.meal === id); return [name, rs.reduce((s, r) => s + ate(r), 0) / rs.length]; }).sort((x, y) => x[1] - y[1]);
  if (byMeal[2][1] - byMeal[0][1] > .12) out.push(['info', 'plate', `${byMeal[0][0]} is the weakest meal`, `${pct(byMeal[0][1])} eaten, against ${pct(byMeal[2][1])} at ${byMeal[2][0].toLowerCase()}.`]);
  const avg = k => perDay.reduce((s, n) => s + n[k], 0) / perDay.length;
  if (P.diet === 'protein') out.push(avg('p') >= T.p * .9 ? ['good', 'muscle', 'Protein on target', `${Math.round(avg('p'))} g a day against ${T.p} g.`] : ['warn', 'muscle', `Protein ${Math.round(avg('p'))} g a day, target ${T.p} g`, 'The extra egg, fish and milk are the easiest place to gain.']);
  if (P.diet === 'diabetic') out.push(avg('c') <= T.c * 1.1 ? ['good', 'check', 'Carbs within target', `${Math.round(avg('c'))} g a day against ${T.c} g.`] : ['warn', 'warn', `Carbs ${Math.round(avg('c'))} g a day, over ${T.c} g`, 'Smaller rice portions would help.']);
  if (P.diet === 'lowna') out.push(avg('na') <= T.na ? ['good', 'salt', 'Sodium under the limit', `${Math.round(avg('na')).toLocaleString('en-US')} mg a day against ${T.na.toLocaleString('en-US')} mg.`] : ['warn', 'salt', 'Sodium over the limit', `${Math.round(avg('na')).toLocaleString('en-US')} mg a day against ${T.na.toLocaleString('en-US')} mg.`]);
  const left = leftMost(P)[0];
  if (left && left.left > .45) out.push(['info', 'leaf', `${left.name} comes back the most (${pct(left.left)} left)`, /soup/i.test(left.name) && P.diet === 'lowna' ? 'Low-salt soups often taste bland. Herbs, ginger or pepper can help.' : 'Worth asking the kitchen about a swap.']);
  return out.slice(0, 5);
}
function leftMost(P) {
  const m = {};
  P.log.forEach(r => Object.keys(r.served).forEach(id => { const d = PL.DISH[id], k = d.name; m[k] = m[k] || { d, name: k, s: 0, l: 0 }; m[k].s += r.served[id]; m[k].l += r.measured[id]; }));
  return Object.values(m).map(x => ({ d: x.d, name: x.name, left: x.l / x.s })).sort((a, b) => b.left - a.left).slice(0, 3);
}
function report(P) {
  const D = H.DIETS[P.diet], T = D.target, days = DAYS(), full = days.filter(d => P.log.filter(r => r.day === d).length === 3);
  const perDay = full.map(d => sumN(P.log.filter(r => r.day === d)));
  const avg = Object.fromEntries(Object.keys(T).map(k => [k, Math.round(perDay.reduce((s, n) => s + n[k], 0) / perDay.length)]));
  const grams = {}; P.log.forEach(r => Object.entries(r.eaten).forEach(([id, g]) => { grams[id] = (grams[id] || 0) + g; }));
  const third = P.diet === 'diabetic' ? 'c' : 'na';
  return `
  <section class="group rep-head"><div><b>Nutrition report</b><span>${full[0]} to ${full[full.length - 1]} · ${P.log.length} meals scanned</span></div><span class="pill">${D.name} diet</span></section>
  <div class="vcard"><h3>An average day</h3><div class="vrings">${V.ring(avg.kcal, T.kcal, 'Energy', 'kcal', 'aim')}${V.ring(avg.p, T.p, 'Protein', 'g', 'aim')}${V.ring(avg[third], T[third], third === 'c' ? 'Carbs' : 'Sodium', third === 'c' ? 'g' : 'mg', 'limit')}</div></div>
  <div class="vtips">${findings(P, full, perDay).map(([tone, icon, t, s]) => V.tip(icon, tone, t, s)).join('')}</div>
  <div class="vcard"><h3>Energy each day <small>share of target</small></h3>${V.week(full, perDay.map(n => Math.min(1, n.kcal / T.kcal)))}</div>
  <div class="vcard"><h3>Protein each day <small>share of target</small></h3>${H.dayBars(full, perDay.map(n => n.p / T.p), 'Protein each day')}</div>
  <div class="vcard"><h3>By meal <small>share eaten</small></h3><div class="vrings">${H.MEALS.map(([id, name]) => { const rs = P.log.filter(r => r.meal === id); return V.pctRing(rs.reduce((s, r) => s + ate(r), 0) / rs.length, name); }).join('')}</div></div>
  <div class="vcard"><h3>Plate balance <small>all week</small></h3>${V.healthyPlate(V.plateShares(ALL, grams))}</div>
  <div class="vcard"><h3>Left most often</h3><div class="leftlist">${leftMost(P).map(x => `<div>${V.food(x.d, 34)}<span>${esc(x.name)}</span><b class="num">${pct(x.left)} left</b></div>`).join('')}</div></div>
  <div class="vcard"><h3>Average day, in detail</h3>${H.nutrientRows(avg, T, ['kcal', 'p', 'c', 'f', 'na'])}</div>
  <div class="two-btn"><button class="btn primary" id="send-report">Send to care team</button><button class="btn" id="print-report">Print</button></div>
  <p class="foot">Shared with ${esc(P.doctor)} and the ward dietitian. Measured by the ward scanner before and after every tray; targets are illustrative.</p>`;
}

/* ================================================================ Me */
function meTab(P) {
  const D = H.DIETS[P.diet];
  return `
  <section class="group profile">${PL.V.avatar(P, 64)}<div><b>${esc(P.name)}</b><span>${P.age} · Room ${P.room}<br>${esc(P.why)}</span></div></section>
  <h4 class="sec">Diet</h4>
  <section class="group">
    <div class="g-row two-col"><span>${D.name}</span><span class="g-v">${esc(D.note)}</span></div>
    ${Object.entries(D.target).map(([k, v]) => `<div class="g-row two-col"><span class="g-k">${H.NAMES[k][0]}</span><span class="g-v num">${k === 'na' ? 'under ' : ''}${v.toLocaleString('en-US')} ${H.NAMES[k][1]} a day</span></div>`).join('')}
  </section>
  <h4 class="sec">Care team</h4>
  <section class="group">
    <div class="g-row two-col"><span>Doctor</span><span class="g-v">${esc(P.doctor)}</span></div>
    <div class="g-row two-col"><span>Dietitian</span><span class="g-v">Nurul Huda, ward 7B</span></div>
    <div class="g-row two-col"><span>Nurse station</span><span class="g-v">7B, ext. 4172</span></div>
  </section>
  <h4 class="sec">Privacy</h4>
  <section class="group"><label class="switch-row"><span>Larger text</span><input type="checkbox" role="switch" id="care-big" ${P.big ? 'checked' : ''}></label><label class="switch-row"><span>Face sign-in<small class="sw-sub">${P.faceOff ? 'Off: nurses scan your wristband instead' : 'On: the ward scanner knows you'}</small></span><input type="checkbox" role="switch" id="care-face" ${P.faceOff ? '' : 'checked'}></label></section>
  <p class="foot">The ward scanner keeps a match code made from your face, never a photo. Your report is shared only with your care team, and it's deleted 30 days after you go home.</p>`;
}

PL.apps.care = {
  title: 'Loopi Care',
  mount,
  unmount() { root = null; },
  update() { render(true); },
};
})();
