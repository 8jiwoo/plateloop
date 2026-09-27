/* Loopi, the student app. Loopi is a guide, not a pet: it walks the student through lunch (scan, eat,
   scan again), points out what to try, explains what their tray shows, and where leftovers go.
   Tabs: Today, Week, Class, Me. Drawings come from js/visual.js. */
(() => {
'use strict';
const { $, $$, pct, esc, MENU, DISH } = PL;
const V = PL.V;

const ui = { tab: 'today', seg: 'class', seenScan: 0 };
let root = null;

const I = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  today: I('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5"/>'),
  week: I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  class: I('<path d="M4 20v-7h5v7M9 20V8h6v12M15 20v-9h5v9"/>'),
  me: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
};
const TABS = { today: 'Today', week: 'Week', class: 'Class', me: 'Me' };
const STEP_ICONS = [
  '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
  '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
  '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
  '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7Z"/>',
];
const avatar = (s, size) => V.avatar(s, size);

const me = () => PL.student(PL.S.me) || PL.S.students[0];
const nameFor = (s, viewer) => s.id === viewer.id ? `${s.name} (you)` : s.hideName ? 'Classmate' : s.name;
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const craving = () => DISH[PL.CRAVING];

/* ================================================================ frame */
function mount(el) {
  root = el;
  ui.seenScan = PL.S.lastScan ? PL.S.lastScan.at : 0;
  el.innerHTML = `
  <div class="stu">
    <aside class="stu-side">
      <div class="loopi-brand"><span class="loopi-icon" aria-hidden="true">${V.loopi('happy', 46)}</span><div><b>Loopi</b><span>by PlateLoop · for schools</span></div></div>
      <p class="stu-note">Demo: pick a student</p>
      <div class="chips" id="stu-who"></div>
      <button class="linkish" data-reset style="font-size:13px;text-align:left">Reset demo</button>
    </aside>
    <div class="phone warm" id="phone">
      <header class="phone-top" id="stu-top"></header>
      <div class="phone-body" id="stu-body"></div>
      <nav class="phone-tabs" role="tablist" aria-label="Loopi">
        ${Object.keys(TABS).map(t => `<button role="tab" data-tab="${t}">${ICON[t]}${TABS[t]}</button>`).join('')}
      </nav>
    </div>
  </div>`;
  $$('.phone-tabs button', el).forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; render(); $('#stu-body').scrollTop = 0; });
  render();
}
function render(keepScroll) {
  if (!root) return;
  const st = me(), body = $('#stu-body', root), scroll = body.scrollTop;
  $('#stu-who', root).innerHTML = PL.S.students.filter(s => s.named).map(s => `<button class="chip plain" data-sid="${s.id}" aria-pressed="${s.id === st.id}">${esc(s.name)}</button>`).join('');
  $$('#stu-who button', root).forEach(b => b.onclick = () => { PL.S.me = b.dataset.sid; PL.store.save('me'); });
  $('#stu-top', root).innerHTML = `${avatar(st)}<div><b>${esc(st.name)}</b><span>Class ${st.cls} · Harbourlight Primary</span></div><div class="pts"><b class="num">${st.week}</b><span>points this week</span></div>`;
  $$('.phone-tabs button', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab)));
  body.innerHTML = ({ today, week, class: classTab, me: meTab })[ui.tab](st);
  wire(st);
  if (keepScroll) body.scrollTop = scroll;
}

/* ================================================================ Today: Loopi walks the student through lunch */
function journey(state) {
  const steps = ['Scan your tray', 'Eat your lunch', 'Scan it again', 'See how you did'];
  const at = { none: 0, eating: 1, done: 3 }[state];
  return `<ol class="journey">${steps.map((s, i) => { const done = i < at || state === 'done'; return `<li class="${done ? 'done' : i === at ? 'now' : ''}"><span>${done ? ICON.check : I(STEP_ICONS[i])}</span><small>${s}</small></li>`; }).join('')}</ol>`;
}
function today(st) {
  const state = PL.scanState(st), a = st.after, c = craving();
  let expr, line;
  if (state === 'none') { expr = 'wave'; line = `Hi ${esc(st.name)}! Here's what's for lunch. Look at the scanner's camera and put your tray down before you eat.`; }
  else if (state === 'eating') { expr = 'point'; line = st.pet.quest < 3 ? `Enjoy your lunch! Try the ${c.name.toLowerCase()} first. It's this week's veggie to try.` : 'Enjoy your lunch! Eat slowly and stop when you feel full.'; }
  else if (a.w < .1) { expr = 'cheer'; line = 'You finished almost everything! That gives your body energy for the whole afternoon.'; }
  else if (a.w < st.baseline) { expr = 'happy'; line = `Less came back than usual (${pct(a.w)}, your usual is ${pct(st.baseline)}). Nice going!`; }
  else { expr = 'think'; line = 'Some food came back today. Next time, ask for a smaller portion. That\'s totally okay!'; }
  let out = `${V.guide(expr, line, { big: true })}${journey(state)}`;
  if (state !== 'done') {
    out += `<div class="vcard"><h3>Today's lunch <small>Friday</small></h3>${V.tray(MENU, null, { hi: st.pet.quest < 3 ? c.id : null, tag: d => d.id === c.id && st.pet.quest < 3 ? 'Try me' : '' })}</div>
    <div class="vtips">
      ${V.tip('plate', 'info', 'Not very hungry?', 'Ask for a small portion. It\'s better than leaving food on your tray.')}
      ${V.tip('leaf', 'good', `Why ${c.name.toLowerCase()}?`, 'Dark green veggies have calcium and iron. They help your bones and keep you from feeling tired.')}
    </div>`;
    return out;
  }
  if (!a.measured) return out; // a save from before per-dish results were kept
  const eaten = Object.fromEntries(MENU.map(d => [d.id, a.served[d.id] - a.measured[d.id]]));
  const leftG = Math.round(sum(a.measured));
  out += `<div class="vcard"><h3>What you ate <small>${pct(1 - a.w)} of your tray</small></h3>${V.tray(MENU, a)}</div>
  <div class="vcard"><h3>Your plate today</h3>${V.healthyPlate(V.plateShares(MENU, eaten))}</div>
  <div class="vcard"><h3>Energy for the afternoon</h3><div class="vrings">${V.ring(a.intake.kcal, PL.TARGET.kcal, 'Calories', 'kcal')}${V.ring(a.intake.p, PL.TARGET.p, 'Protein', 'g', 'aim')}${V.ring(a.intake.c, PL.TARGET.c, 'Carbs', 'g')}</div></div>
  <div class="vtips">
    ${a.co2 > 0 ? V.tip('cloud', 'good', `You kept ${a.co2} g of CO₂ out of the air`, 'Food that isn\'t wasted doesn\'t have to be grown, cooked and thrown away again.') : ''}
    ${leftG > 20 ? V.tip('recycle', 'info', `${leftG} g went to the compost bin`, 'It becomes soil for the school garden, but eating it is even better.') : V.tip('check', 'good', 'Hardly anything left', 'Your tray grew a fruit on the school\'s Green Tree.')}
  </div>`;
  return out;
}

/* ================================================================ Week */
function week(st) {
  const days = st.log.slice(0, 5).reverse(), c = craving();
  const avgEat = days.reduce((s, l) => s + (1 - l.w), 0) / days.length;
  const cls = PL.S.students.filter(s => s.cls === st.cls);
  const clsEat = cls.reduce((s, x) => { const l5 = x.log.slice(0, 5); return s + l5.reduce((a, l) => a + (1 - l.w), 0) / l5.length; }, 0) / cls.length;
  const avg = k => Math.round(days.reduce((s, l) => s + l.n[k], 0) / days.length);
  const tries = Math.min(3, st.pet.quest);
  return `
  ${V.guide(avgEat >= clsEat ? 'happy' : 'think', avgEat >= clsEat ? `This week you ate ${pct(avgEat)} of your lunches. That's more than your class average of ${pct(clsEat)}!` : `This week you ate ${pct(avgEat)} of your lunches. Your class ate ${pct(clsEat)}. Smaller portions can help.`)}
  <div class="vcard"><h3>How much you ate <small>each day</small></h3>${V.week(days.map(l => l.day), days.map(l => 1 - l.w), { today: days.findIndex(l => l.day.startsWith('Fri')) })}</div>
  <div class="vcard"><h3>${c.name.replace('Stir-fried ', '')} week <small>${tries} of 3 tries</small></h3>
    <div class="tries">${[0, 1, 2].map(i => `<div class="${i < tries ? 'on' : ''}">${V.food(c, 46)}<span>${i < tries ? 'Tried!' : `Try ${i + 1}`}</span></div>`).join('')}</div>
    <p class="hint" style="margin-top:10px">${tries >= 3 ? 'You did it! Tasting a new food a few times is how you start to like it.' : 'Just one bite counts. It often takes a few tries to like a new vegetable.'}</p></div>
  <div class="vcard"><h3>An average lunch this week</h3><div class="vrings">${V.ring(avg('kcal'), PL.TARGET.kcal, 'Calories', 'kcal')}${V.ring(avg('p'), PL.TARGET.p, 'Protein', 'g', 'aim')}${V.ring(avg('c'), PL.TARGET.c, 'Carbs', 'g')}</div></div>`;
}

/* ================================================================ Class: leaderboards */
function classTab(st) {
  const segs = { class: `Class ${st.cls}`, schools: 'Schools' };
  let body;
  if (ui.seg === 'class') {
    const all = PL.studentRows(), myRank = all.findIndex(s => s.id === st.id) + 1, top = all.slice(0, 3);
    const c = PL.S.classes.find(c => c.id === st.cls), cw = c.ret / c.served;
    const pod = [top[1], top[0], top[2]].map((s, i) => s ? `<div class="pod p${[2, 1, 3][i]}">${avatar(s, [44, 56, 44][i])}<b>${esc(nameFor(s, st).replace(' (you)', ''))}</b><small class="num">${s.week} pts</small><span class="step">${[2, 1, 3][i]}</span></div>` : '<div></div>').join('');
    body = `
    ${V.guide(myRank <= 3 ? 'cheer' : 'happy', myRank <= 3 ? `You're number ${myRank} in your class this week!` : `You're number ${myRank} in your class. Points come from beating your own usual, so anyone can climb.`)}
    <div class="vcard"><h3>Class ${st.cls} goal <small>under 20% waste</small></h3>
      <div class="goalbar ${cw < .2 ? 'done' : ''}"><i style="width:${Math.min(100, Math.max(4, (.4 - cw) / .2 * 100))}%"></i></div>
      <p class="hint" style="margin-top:8px">${cw < .2 ? `Goal reached! The class left ${pct(cw)} this week.` : `The class left ${pct(cw)} this week. Almost there!`}</p></div>
    <div class="podium2">${pod}</div>
    <div class="lb">${all.slice(3, 10).map((s, i) => lbRow(s, i + 4, st)).join('')}${myRank > 10 ? `<div class="lb-gap">• • •</div>${lbRow(st, myRank, st)}` : ''}</div>
    <p class="foot">Resets every Monday.</p>`;
  } else {
    const rows = PL.schoolRows(), max = Math.max(...rows.map(s => s.red));
    body = `${V.guide('point', 'Schools across Singapore are cutting food waste too. This is how much less each one throws away than when it started.')}
    <div class="vcard schools">${rows.map((s, i) => `<div class="sch-row ${s.us ? 'us' : ''}"><span class="num">${i + 1}</span><div><b>${esc(s.name)}${s.us ? ' (us)' : ''}</b><div class="sbar"><i style="width:${s.red / max * 100}%"></i></div></div><b class="num">−${pct(s.red)}</b></div>`).join('')}</div>`;
  }
  return `<div class="seg" id="rank-seg">${Object.entries(segs).map(([k, v]) => `<button data-seg="${k}" aria-pressed="${ui.seg === k}">${v}</button>`).join('')}</div>${body}`;
}
function lbRow(s, rank, viewer) {
  return `<div class="lb-row ${s.id === viewer.id ? 'me' : ''}"><span class="lb-rank">${rank}</span>${avatar(s, 34)}<div><div class="lb-name">${esc(nameFor(s, viewer))}</div><div class="lb-sub">${s.pet.streak >= 3 ? `${s.pet.streak} clean trays in a row` : `${pct(s.log[0].w)} left last lunch`}</div></div><div class="lb-val">${s.week}<small>pts</small></div></div>`;
}

/* ================================================================ Me */
function meTab(st) {
  return `
  <div class="vcard profile2">${avatar(st, 64)}<div><b>${esc(st.name)}</b><span>Class ${st.cls} · Harbourlight Primary</span></div></div>
  <div class="statgrid">
    <div>${V.icon('check', 'var(--tint)')}<b class="num">${st.pet.c.lowWaste}</b><span>clean trays</span></div>
    <div>${V.icon('leaf', '#2B8C43')}<b class="num">${st.pet.c.veg}</b><span>times you tried veggies</span></div>
    <div>${V.icon('plate', '#F28C28')}<b class="num">${st.pet.c.balanced}</b><span>balanced plates</span></div>
  </div>
  <div class="vcard"><h3>Past lunches</h3><div class="hist2">${st.log.map(l => `<div><i style="--p:${Math.round((1 - l.w) * 100)}"></i><span>${l.day}</span><b class="num">${pct(1 - l.w)} eaten</b><em class="num">+${l.pts}</em></div>`).join('')}</div></div>
  <div class="vtips">
    <div class="switch-row"><span>Face sign-in</span><span class="g-v">On</span></div>
    <label class="switch-row"><span>Show my name on the class board</span><input type="checkbox" role="switch" id="optin" ${st.hideName ? '' : 'checked'}></label>
  </div>
  <p class="foot">The scanner keeps a match code made from your face, never a photo. It's deleted when you leave the school.</p>`;
}

/* ================================================================ wiring */
function wire(st) {
  const body = $('#stu-body', root);
  $$('#rank-seg button', body).forEach(b => b.onclick = () => { ui.seg = b.dataset.seg; render(); });
  const opt = $('#optin', body);
  if (opt) opt.onchange = () => { st.hideName = !opt.checked; PL.store.save('optin'); };
}

PL.apps.student = {
  title: 'Loopi',
  mount,
  unmount() { root = null; },
  update(kind, fromSelf) {
    const ls = PL.S.lastScan;
    if (!fromSelf && ls && ls.at > ui.seenScan) {
      ui.seenScan = ls.at;
      if (ls.sid === PL.S.me) PL.toast(ls.kind === 'before' ? 'Tray scanned. Enjoy your lunch!' : `Lunch scanned, +${ls.xp} points. Loopi has your results.`);
    }
    render(kind !== 'me');
  },
};
})();
