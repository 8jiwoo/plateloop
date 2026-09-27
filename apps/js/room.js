/* Loopi's room: a full-colour pixel room where Loopi walks around, eats at its bowl, plays fetch,
   gets petted, sleeps when the lights go off, and leaves crumbs that can be swept into the compost bin.
   This file only animates and handles taps; game-state changes go back to the app through `hooks`. */
(() => {
'use strict';
const W = 160, H = 110, FLOOR = 98, BOWL_X = 22, BIN_X = 140, SCALE = 4;
const BODY = { leafy: ['#D7F2CB', '#A9D99A'], crystal: ['#D6ECFA', '#A9CFEA'], guardian: ['#F8E6C8', '#E2C290'], explorer: ['#FBDCCF', '#EDB39C'], egg: ['#FFF4DC', '#EAD9B0'] };
const CRUMB = { rice: '#F3EDDA', veg: '#3C9A48', protein: '#F4B400', fruit: '#E0453A' };
const rand = (a, b) => a + Math.random() * (b - a);

const Room = PL.Room = {
  pet: { x: 80, y: 0, face: 1, mode: 'idle', until: 0, target: 80, next: 1.5, jumpT: 0, jumpDur: .5, jumpH: 8, onArrive: null },
  ball: null, crumbs: [], hearts: [], night: false, food: null, speech: null, time: 0, tick: 0,
  cv: null, sayEl: null, hooks: {}, raf: 0, last: 0, lastTap: 0,
  petCv: null,

  /** Bind (or re-bind after a re-render) to a canvas and its speech-bubble element. */
  attach(cv, sayEl, hooks) {
    this.cv = cv; this.sayEl = sayEl; this.hooks = hooks;
    cv.width = W * SCALE; cv.height = H * SCALE;
    if (!this.petCv) { this.petCv = document.createElement('canvas'); this.petCv.width = 64; this.petCv.height = 60; }
    cv.onpointerdown = e => this.tap(e);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.loop(t)); }
  },
  loop(now) {
    if (!this.cv || !this.cv.isConnected) { this.raf = 0; return; }
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    this.step(dt); this.draw();
    this.raf = requestAnimationFrame(t => this.loop(t));
  },
  toLogical(e) { const r = this.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; },
  overCanvas(clientX, clientY) { if (!this.cv) return false; const r = this.cv.getBoundingClientRect(); return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom; },

  /* ---------------------------------------------------------------- actions */
  say(text, dur = 3.2) { this.speech = { text, until: this.time + dur }; },
  jump(h = 8, dur = .5) { const p = this.pet; p.jumpT = dur; p.jumpDur = dur; p.jumpH = h; },
  walkTo(x, then, speed) { const p = this.pet; p.target = Math.max(14, Math.min(W - 14, x)); p.mode = 'walk'; p.onArrive = then || null; p.speed = speed || 30; },
  feed(snackId) {
    if (this.night) { this.say('Zzz… turn the lights on first!'); return; }
    if (this.pet.mode === 'eat') return;
    this.walkTo(BOWL_X + 12, () => {
      const res = this.hooks.eat(snackId);
      if (!res) return;
      this.food = res.colors; this.pet.face = -1; this.pet.mode = 'eat'; this.pet.until = this.time + 1.8;
      this.pendingCrumbs = res.crumbs;
      this.say(res.wasFull ? 'I\'m full… but thanks!' : res.heart ? 'Yum! +1 heart!' : 'Nom nom nom!');
    }, 42);
  },
  throwBall() {
    if (this.night) { this.say('It\'s bedtime. No ball now!'); return; }
    this.ball = { x: 10, y: 70, vx: rand(70, 105), vy: -rand(50, 80) };
    this.pet.mode = 'chase'; this.say('Ball! Ball!', 1.4);
  },
  sweepAll() { this.crumbs.filter(c => !c.fly).forEach((c, i) => setTimeout(() => this.sweep(c), i * 120)); },
  sweep(c) { if (c.fly) return; c.fly = true; c.t = 0; c.sx = c.x; c.sy = c.y; },
  toggleNight() {
    this.night = !this.night;
    if (this.night) { this.walkTo(80, () => { this.pet.mode = 'sleep'; }); this.say('Good night…', 2); }
    else { this.pet.mode = 'happy'; this.pet.until = this.time + .9; this.jump(6); this.say('Good morning!', 2); }
  },
  petLoopi() {
    const p = this.pet;
    if (p.mode === 'sleep') { this.say('Zzz… (Loopi smiles in its sleep)'); this.heart(); return; }
    for (let i = 0; i < 3; i++) setTimeout(() => this.heart(), i * 140);
    p.mode = 'happy'; p.until = this.time + 1; this.jump(7);
    const doubleTap = this.time - this.lastTap < .35; this.lastTap = this.time;
    if (doubleTap) { this.jump(14, .7); this.say('Wheee!', 1.4); }
    this.hooks.pet();
  },
  heart() { const p = this.pet; this.hearts.push({ x: p.x + rand(-8, 8), y: FLOOR - 40 - p.y, life: 1.2 }); },

  /** Taps: crumbs get swept, Loopi gets petted, the floor sets where Loopi walks. */
  tap(e) {
    e.preventDefault();
    const L = this.toLogical(e), p = this.pet;
    const c = this.crumbs.find(c => !c.fly && Math.abs(c.x - L.x) < 5 && Math.abs(c.y - L.y) < 5);
    if (c) { this.sweep(c); return; }
    if (Math.abs(L.x - p.x) < 15 && L.y > FLOOR - 44 - p.y && L.y < FLOOR + 3) { this.petLoopi(); return; }
    if (L.y > 74 && p.mode !== 'eat' && p.mode !== 'sleep') this.walkTo(L.x);
  },

  /* ---------------------------------------------------------------- simulation */
  step(dt) {
    const p = this.pet;
    this.time += dt; this.tick = Math.floor(this.time / .42);
    if (p.jumpT > 0) { p.jumpT = Math.max(0, p.jumpT - dt); p.y = Math.sin((1 - p.jumpT / p.jumpDur) * Math.PI) * p.jumpH; } else p.y = 0;
    const moveTo = (tx, speed) => { const dx = tx - p.x; if (Math.abs(dx) < 1.2) { p.x = tx; return true; } p.face = Math.sign(dx); p.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt); return false; };
    if (p.mode === 'walk') { if (moveTo(p.target, p.speed || 30)) { p.mode = 'idle'; p.next = this.time + rand(2, 5); const cb = p.onArrive; p.onArrive = null; if (cb) cb(); } }
    else if (p.mode === 'eat') { if (this.time > p.until) { this.food = null; p.mode = 'happy'; p.until = this.time + .8; this.jump(6); (this.pendingCrumbs || []).forEach(t => this.crumbs.push({ x: rand(26, 70), y: rand(90, 104), type: t })); this.pendingCrumbs = null; } }
    else if (p.mode === 'happy') { if (this.time > p.until) { p.mode = 'idle'; p.next = this.time + rand(1.5, 4); } }
    else if (p.mode === 'chase') {
      if (!this.ball) p.mode = 'idle';
      else if (moveTo(this.ball.x, 48) || (Math.abs(this.ball.x - p.x) < 7 && this.ball.y > FLOOR - 14)) {
        if (this.ball.y > FLOOR - 14) { this.ball = null; p.mode = 'happy'; p.until = this.time + 1; this.jump(10, .6); this.hooks.fetched(); }
      }
    } else if (p.mode === 'idle' && !this.night && this.time > p.next) { this.walkTo(rand(34, 126)); }
    if (this.ball) {
      const b = this.ball; b.vy += 230 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > FLOOR - 3) { b.y = FLOOR - 3; b.vy *= -.55; b.vx *= .82; if (Math.abs(b.vy) < 14) b.vy = 0; }
      if (b.x < 6 || b.x > W - 6) { b.vx *= -.8; b.x = Math.max(6, Math.min(W - 6, b.x)); }
    }
    this.hearts.forEach(h => { h.y -= 16 * dt; h.life -= dt; });
    this.hearts = this.hearts.filter(h => h.life > 0);
    this.crumbs.forEach(c => { if (c.fly) { c.t += dt * 1.6; const k = Math.min(1, c.t); c.x = c.sx + (BIN_X - c.sx) * k; c.y = c.sy + (80 - c.sy) * k - Math.sin(k * Math.PI) * 26; if (k >= 1 && !c.done) { c.done = true; this.hooks.swept(c.type); } } });
    this.crumbs = this.crumbs.filter(c => !c.done);
    if (this.speech && this.time > this.speech.until) this.speech = null;
    if (!this.speech && !this.night && this.time > (this.nextChat || 4)) { const line = this.hooks.chatter && this.hooks.chatter(this.crumbs.length); if (line) this.say(line, 3.4); this.nextChat = this.time + rand(9, 14); }
  },

  /* ---------------------------------------------------------------- drawing */
  draw() {
    const cv = this.cv, ctx = cv.getContext('2d'), n = this.night, p = this.pet;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); ctx.imageSmoothingEnabled = false;
    const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    // wall + window
    R(n ? '#363B5E' : '#FBF3E4', 0, 0, W, 72);
    for (let y = 6; y < 68; y += 12) for (let x = (y / 12) % 2 ? 4 : 10; x < W; x += 12) R(n ? '#40466C' : '#F2E3C8', x, y, 2, 2);
    R('#FFFFFF', 14, 10, 42, 32); R(n ? '#171C3E' : '#A8DDF7', 16, 12, 38, 28);
    if (n) { R('#F5F1D0', 22, 16, 6, 6); R('#171C3E', 25, 15, 4, 4); [[36, 18], [46, 26], [30, 32], [50, 15]].forEach(([x, y]) => R('#FFFFFF', x, y, 1, 1)); }
    else { R('#FFD60A', 44, 15, 6, 6); const cx = 18 + (this.time * 3) % 40; R('#FFFFFF', cx, 26, 10, 3); R('#FFFFFF', cx + 3, 24, 5, 2); }
    R('#FFFFFF', 34, 12, 2, 28); R('#FFFFFF', 16, 25, 38, 2);
    // picture frame with the school Green Tree
    R(n ? '#8A7B66' : '#C9A77C', 104, 16, 26, 20); R(n ? '#26324A' : '#EAF6EC', 106, 18, 22, 16);
    R('#2E9447', 113, 27, 8, 3); R('#34A853', 114, 24, 6, 3); R('#2E9447', 115, 21, 4, 3); R('#8B5E3C', 116, 30, 2, 3); R('#FF3B30', 114, 25, 1, 1); R('#FF3B30', 118, 28, 1, 1);
    // floor, rug
    R(n ? '#4E4038' : '#E8CFA6', 0, 72, W, H - 72);
    R(n ? '#2E3252' : '#E3C08E', 0, 70, W, 3);
    for (let y = 78; y < H; y += 8) R(n ? '#463A33' : '#DDBF92', 0, y, W, 1);
    ctx.fillStyle = n ? '#5E4466' : '#F5C2B2'; ctx.beginPath(); ctx.ellipse(84, 97, 50, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = n ? '#6E5277' : '#F8D3C7'; ctx.beginPath(); ctx.ellipse(84, 97, 40, 5, 0, 0, Math.PI * 2); ctx.fill();
    // plant
    R('#D9724F', 146, 58, 10, 12); R('#C45E3E', 145, 57, 12, 2);
    [[150, 50, 2, 8], [146, 46, 3, 7], [153, 45, 3, 8], [148, 42, 2, 5]].forEach(([x, y, w, h], i) => R(i % 2 ? '#2E9447' : '#34C759', x, y, w, h));
    // compost bin
    R('#248A3D', 131, 79, 20, 3); R('#34C759', 132, 82, 18, 17); R('#2EAA52', 132, 94, 18, 5);
    R('#FFFFFF', 139, 86, 4, 1); R('#FFFFFF', 138, 87, 2, 3); R('#FFFFFF', 141, 88, 3, 2);
    // food bowl (with food while eating)
    if (this.food) this.food.forEach((c, i) => R(c, BOWL_X - 5 + i * 3, 90 - (i % 2), 3, 3));
    R('#FFFFFF', BOWL_X - 8, 92, 16, 3); R('#E5E5EA', BOWL_X - 6, 95, 12, 2);
    // shadow + ball + crumbs
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(p.x, FLOOR + 1, 12 - p.y * .4, 2, 0, 0, Math.PI * 2); ctx.fill();
    this.crumbs.forEach(c => { R('#00000022', c.x - 1, c.y + 1, 3, 1); R(CRUMB[c.type] || '#E8B27A', c.x - 1, c.y - 1, 3, 2); });
    if (this.ball) { const b = this.ball; R('#FF3B30', b.x - 3, b.y - 3, 6, 6); R('#FFFFFF', b.x - 3, b.y - 1, 6, 2); R('#FF6961', b.x - 2, b.y - 4, 4, 1); }
    // Loopi
    const info = this.hooks.info();
    const [fill, mid] = BODY[info.stage === 'egg' ? 'egg' : info.form] || BODY.leafy;
    let mood = info.mood;
    if (p.mode === 'eat') mood = this.tick % 2 ? 'joy' : 'meh';
    else if (p.mode === 'happy' || p.mode === 'chase') mood = 'joy';
    else if (p.mode === 'sleep' || this.night) mood = 'sleepy';
    PL.drawPet(this.petCv, { rows: 30, bg: 'none', noGround: true, t: p.mode === 'walk' || p.mode === 'chase' ? Math.floor(this.time / .16) : this.tick, stage: info.stage, form: info.form, mood, acc: info.acc, progress: info.progress, fill, mid, ink: '#2B2B2E' });
    ctx.save();
    const px = Math.round(p.x), py = Math.round(FLOOR - 52 - p.y);
    if (p.face < 0) { ctx.translate(px, 0); ctx.scale(-1, 1); ctx.drawImage(this.petCv, -32, py); }
    else ctx.drawImage(this.petCv, px - 32, py);
    ctx.restore();
    // hearts
    this.hearts.forEach(h => { const x = Math.round(h.x), y = Math.round(h.y); ctx.globalAlpha = Math.min(1, h.life * 1.5); [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]].forEach(([a, b]) => R('#FF2D55', x + a - 2, y + b, 1, 1)); ctx.globalAlpha = 1; });
    // night dimmer + lamp glow
    if (n) { ctx.fillStyle = 'rgba(8,10,35,.28)'; ctx.fillRect(0, 0, W, H); }
    // speech bubble (HTML, positioned over the canvas)
    if (this.sayEl) {
      if (this.speech) { this.sayEl.hidden = false; if (this.sayEl.textContent !== this.speech.text) this.sayEl.textContent = this.speech.text; this.sayEl.style.left = `${Math.max(18, Math.min(82, p.x / W * 100))}%`; this.sayEl.style.bottom = `${(H - (FLOOR - 46 - p.y)) / H * 100}%`; }
      else this.sayEl.hidden = true;
    }
  },
};
})();
