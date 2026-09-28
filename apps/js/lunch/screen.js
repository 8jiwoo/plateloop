/* The PlateLoop scanner's screen in Lunch Rush, drawn live onto the real 3D model's screen.
   States follow the kiosk: idle (how to use + today's numbers), face sign-in, hello, scanning (depth camera
   and scale), the saved tray, the after-lunch result, the food waste bin, clean tray, goodbye. */
(() => {
'use strict';
const L = PL.L3;
const TAU = Math.PI * 2, F = 'Arial, Helvetica, sans-serif';
const GREEN = '#2B8C43', INK = '#1D1D1F', GREY = '#6E6E73';

L.Screen = () => {
  const W = 400, H = 258, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  let state = 'idle', data = {}, t = 0, t0 = 0, acc = 0;

  const txt = (s, x, y, px, col = INK, wt = 'bold', align = 'left') => { c.font = `${wt} ${px}px ${F}`; c.fillStyle = col; c.textAlign = align; c.fillText(s, x, y); c.textAlign = 'left'; };
  const rr = (x, y, w, h, r, col) => { L.roundRect(c, x, y, w, h, r); c.fillStyle = col; c.fill(); };
  function header(sub = 'Harbourlight Sec · 12:41') {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    c.fillStyle = GREEN; c.fillRect(0, 0, W, 30);
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(18, 15, 6, 0, TAU); c.fill(); c.fillStyle = GREEN; c.beginPath(); c.arc(18, 15, 2.5, 0, TAU); c.fill();
    txt('PlateLoop', 30, 21, 15, '#FFFFFF'); txt(sub, W - 10, 20, 11, 'rgba(255,255,255,.9)', 'normal', 'right');
  }
  function icon(kind, x, y) {
    c.save(); c.translate(x, y); c.strokeStyle = GREEN; c.fillStyle = GREEN; c.lineWidth = 3;
    if (kind === 'face') { c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.stroke(); c.fillRect(-6, -4, 3, 4); c.fillRect(3, -4, 3, 4); c.beginPath(); c.arc(0, 2, 6, .3, Math.PI - .3); c.stroke(); [[-20, -20, 1, 1], [20, -20, -1, 1], [-20, 20, 1, -1], [20, 20, -1, -1]].forEach(([a, b, sx, sy]) => { c.beginPath(); c.moveTo(a, b + sy * 7); c.lineTo(a, b); c.lineTo(a + sx * 7, b); c.stroke(); }); }
    if (kind === 'tray') { L.roundRect(c, -20, -12, 40, 26, 4); c.stroke(); c.beginPath(); c.moveTo(-20, 0); c.lineTo(20, 0); c.moveTo(-7, -12); c.lineTo(-7, 14); c.moveTo(7, -12); c.lineTo(7, 14); c.stroke(); c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -16); c.stroke(); c.beginPath(); c.moveTo(-4, -20); c.lineTo(0, -15); c.lineTo(4, -20); c.stroke(); }
    if (kind === 'beep') { c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(-6, 0); c.lineTo(-1, 5); c.lineTo(7, -5); c.stroke(); c.lineWidth = 2; [18, 23].forEach(r => { c.beginPath(); c.arc(0, 0, r, -.5, .5); c.stroke(); }); }
    c.restore();
  }
  function trayTop(x, y, w, h, amounts, scanY) {
    rr(x, y, w, h, 8, '#C9CED3'); rr(x + 4, y + 4, w - 8, h - 8, 6, '#DDE1E5');
    const cw = (w - 8) / 3, ch = (h - 8) / 2;
    PL.MENU.forEach(d => {
      const [col, row] = d.slot, cx = x + 4 + col * cw + cw / 2, cy = y + 4 + row * ch + ch / 2, a = amounts ? amounts[d.id] : 1;
      if (a > .02) { c.fillStyle = d.color; c.beginPath(); c.ellipse(cx, cy, cw * .36 * Math.sqrt(a), ch * .34 * Math.sqrt(a), 0, 0, TAU); c.fill(); }
    });
    c.strokeStyle = '#B0B6BC'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 4, y + h / 2); c.lineTo(x + w - 4, y + h / 2); c.moveTo(x + 4 + cw, y + 4); c.lineTo(x + 4 + cw, y + h - 4); c.moveTo(x + 4 + cw * 2, y + 4); c.lineTo(x + 4 + cw * 2, y + h - 4); c.stroke();
    if (scanY !== undefined) {
      c.strokeStyle = 'rgba(52,199,89,.35)'; c.lineWidth = 1; for (let gx = x; gx < x + w; gx += 12) { c.beginPath(); c.moveTo(gx, y); c.lineTo(gx, y + h); c.stroke(); } for (let gy = y; gy < y + h; gy += 12) { c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
      const sy = y + scanY * h; const g = c.createLinearGradient(0, sy - 18, 0, sy); g.addColorStop(0, 'rgba(52,199,89,0)'); g.addColorStop(1, 'rgba(52,199,89,.45)'); c.fillStyle = g; c.fillRect(x, sy - 18, w, 18); c.fillStyle = '#34C759'; c.fillRect(x, sy, w, 3);
    }
  }
  const name1 = () => (data.name || '').split(' ')[0];
  const DRAW = {
    idle() {
      header();
      if ((t % 12) < 7.5) {
        txt('Scan your tray', W / 2, 62, 24, INK, 'bold', 'center');
        [['face', '1', 'Look at', 'the camera'], ['tray', '2', 'Put your tray', 'on the scale'], ['beep', '3', 'Wait for', 'the beep']].forEach(([k, n, a, b], i) => {
          const x = 18 + i * 124; rr(x, 76, 116, 112, 12, '#F2F2F7');
          c.fillStyle = GREEN; c.beginPath(); c.arc(x + 16, 92, 10, 0, TAU); c.fill(); txt(n, x + 16, 96.5, 12, '#FFFFFF', 'bold', 'center');
          icon(k, x + 58, 122); txt(a, x + 58, 160, 12.5, INK, 'bold', 'center'); txt(b, x + 58, 175, 12.5, INK, 'bold', 'center');
        });
        rr(12, 198, W - 24, 50, 10, '#E7F6EA');
        txt('After lunch: scan again, scrape leftovers into', W / 2, 219, 12.5, '#1E6B34', 'bold', 'center');
        txt('the food waste bin on the right, then return your tray.', W / 2, 237, 12.5, '#1E6B34', 'bold', 'center');
      } else {
        const T = PL.S.today, tt = PL.todayTotals();
        txt('Today at Harbourlight', W / 2, 62, 20, INK, 'bold', 'center');
        [[String(T.trays || 0), 'trays scanned'], [Math.round(tt.w * 100) + '%', 'left on trays'], [((T.co2 || 0) / 1000).toFixed(1) + ' kg', 'CO₂ saved']].forEach(([a, b], i) => {
          const x = 18 + i * 124; rr(x, 80, 116, 86, 12, '#F2F2F7'); txt(a, x + 58, 122, 26, i === 1 ? '#F28C28' : GREEN, 'bold', 'center'); txt(b, x + 58, 146, 11.5, GREY, 'normal', 'center');
        });
        L.loopi(c, 44, 214, 40); txt('Every tray counts. Take what', 80, 208, 13, INK); txt('you’ll finish, and scan both times!', 80, 226, 13, INK);
      }
    },
    face() {
      c.fillStyle = '#0E1114'; c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(W / 2, 120, 10, W / 2, 120, 160); g.addColorStop(0, '#3A342E'); g.addColorStop(1, '#0E1114'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#5A4A3E'; c.beginPath(); c.ellipse(W / 2, 112, 40, 50, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(W / 2, 214, 86, 50, 0, 0, TAU); c.fill();
      c.fillStyle = '#1B1512'; c.beginPath(); c.ellipse(W / 2, 84, 44, 30, 0, Math.PI, TAU); c.fill();
      const k = Math.min(1, (t - t0) / 1.1);
      c.strokeStyle = k >= 1 ? '#34C759' : '#FFFFFF'; c.lineWidth = 3;
      [[-70, -80, 1, 1], [70, -80, -1, 1], [-70, 70, 1, -1], [70, 70, -1, -1]].forEach(([a, b, sx, sy]) => { const x = W / 2 + a, y = 120 + b; c.beginPath(); c.moveTo(x, y + sy * 20); c.lineTo(x, y); c.lineTo(x + sx * 20, y); c.stroke(); });
      c.fillStyle = 'rgba(52,199,89,.8)'; c.fillRect(W / 2 - 70, 40 + ((t - t0) * 160) % 150, 140, 2);
      rr(0, 0, W, 26, 0, 'rgba(0,0,0,.55)'); txt('Face sign-in · no cards needed', W / 2, 17, 11, '#FFFFFF', 'normal', 'center');
      rr(W / 2 - 110, H - 44, 220, 32, 16, 'rgba(0,0,0,.6)'); txt(k >= 1 ? 'Face matched' : 'Look at the camera', W / 2, H - 23, 15, k >= 1 ? '#7FE0A0' : '#FFFFFF', 'bold', 'center');
    },
    hello() {
      header();
      c.fillStyle = GREEN; c.beginPath(); c.arc(70, 100, 38, 0, TAU); c.fill();
      txt((data.name || '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase(), 70, 111, 28, '#FFFFFF', 'bold', 'center');
      txt(data.after ? `Welcome back, ${name1()}!` : `Hi, ${name1()}!`, 124, 94, 24);
      txt(`${data.cls || '3B'} · ${PL.SCHOOL}`, 124, 116, 12, GREY, 'normal');
      rr(16, 156, W - 32, 84, 14, '#E7F6EA');
      txt(data.after ? 'Put your tray on the scale' : 'Put your tray on the scale', W / 2, 188, 18, '#1E6B34', 'bold', 'center');
      txt(data.after ? 'I’ll measure what’s left.' : 'I’ll measure what you took.', W / 2, 212, 13, '#1E6B34', 'normal', 'center');
      const b = Math.sin(t * 6) * 3; c.fillStyle = GREEN; c.beginPath(); c.moveTo(W / 2 - 10, 222 + b); c.lineTo(W / 2 + 10, 222 + b); c.lineTo(W / 2, 234 + b); c.fill();
    },
    scan() {
      header('Measuring');
      const k = Math.min(1, (t - t0) / (data.dur || 1.8));
      trayTop(18, 46, 210, 150, data.amounts, (t * .9) % 1);
      txt('Measuring…', 244, 70, 16);
      rr(244, 82, 140, 10, 5, '#E5E5EA'); rr(244, 82, 140 * k, 10, 5, '#34C759');
      txt(`${Math.round((data.grams || 0) * k)} g`, 244, 128, 28, INK);
      txt('3D depth camera', 244, 152, 11.5, GREY, 'normal'); txt('+ weighing scale', 244, 168, 11.5, GREY, 'normal');
      txt(data.after ? 'Checking what’s left' : 'Checking what you took', W / 2, 228, 13, GREEN, 'bold', 'center');
    },
    before() {
      header('Saved');
      txt('✓ Lunch saved', 16, 60, 20, GREEN);
      const s = data.served || {};
      PL.MENU.forEach((d, i) => { const x = 16 + (i % 2) * 190, y = 88 + Math.floor(i / 2) * 26; c.fillStyle = d.color; c.beginPath(); c.arc(x + 6, y - 4, 6, 0, TAU); c.fill(); txt(d.name, x + 18, y, 12.5, INK, 'normal'); txt(`${s[d.id] || 0} g`, x + 176, y, 12.5, INK, 'bold', 'right'); });
      rr(16, 170, W - 32, 34, 10, '#F2F2F7'); txt(`Total ${data.total || 0} g`, 28, 192, 14); txt(`${data.kcal || 0} kcal`, W - 28, 192, 14, GREY, 'bold', 'right');
      L.loopi(c, 36, 232, 30); txt('Enjoy your lunch! Scan again after you eat.', 60, 236, 13, '#1E6B34');
    },
    after() {
      header('Result');
      const r = data.r || { w: 0 }, ate = 1 - r.w;
      c.lineWidth = 12; c.strokeStyle = '#E5E5EA'; c.beginPath(); c.arc(70, 104, 46, 0, TAU); c.stroke();
      c.strokeStyle = r.w < .15 ? '#34C759' : r.w < .3 ? '#F2B01E' : '#F28C28'; c.beginPath(); c.arc(70, 104, 46, -Math.PI / 2, -Math.PI / 2 + TAU * ate); c.stroke();
      txt(Math.round(ate * 100) + '%', 70, 110, 22, INK, 'bold', 'center'); txt('eaten', 70, 128, 11, GREY, 'normal', 'center');
      PL.MENU.forEach((d, i) => {
        const y = 52 + i * 21, sv = r.servedBy ? r.servedBy[d.id] : 1, lf = r.measured ? r.measured[d.id] : 0, e = sv ? 1 - lf / sv : 1;
        txt(d.name, 136, y + 4, 11, INK, 'normal'); rr(262, y - 5, 90, 10, 5, '#E5E5EA'); c.fillStyle = d.color; L.roundRect(c, 262, y - 5, Math.max(10, 90 * e), 10, 5); c.fill(); txt(Math.round(e * 100) + '%', 390, y + 4, 11, INK, 'bold', 'right');
      });
      rr(16, 184, W - 32, 30, 10, '#E7F6EA');
      txt(`+${r.xp || 0} pts   ·   CO₂ saved ${r.co2 || 0} g   ·   Loopi ${r.game ? '+' + r.game.hunger + ' food' : 'fed'}`, W / 2, 204, 12.5, '#1E6B34', 'bold', 'center');
      L.loopi(c, 30, 236, 24, r.w > .35 ? 'sad' : 'happy'); txt(`“${(r.line || '').slice(0, 58)}”`, 50, 240, 11.5, INK, 'normal');
    },
    compost() {
      header('Food waste');
      txt('Scrape your leftovers', 18, 70, 22); txt('into the food waste bin', 18, 96, 22);
      txt(`${data.left || 0} g left on your tray`, 18, 124, 13, GREY, 'normal');
      const b = (Math.sin(t * 5) + 1) * 5; c.fillStyle = GREEN; c.beginPath(); c.moveTo(330 + b, 54); c.lineTo(378 + b, 84); c.lineTo(330 + b, 114); c.closePath(); c.fill(); c.fillRect(290 + b, 72, 42, 24);
      rr(18, 150, W - 36, 80, 12, '#F2F2F7'); txt('Food waste bin', 32, 176, 13); rr(32, 188, 240, 14, 7, '#E5E5EA'); rr(32, 188, 240 * (data.fill || .6), 14, 7, '#8E8E93');
      txt(Math.round((data.fill || .6) * 100) + '% full', 290, 200, 12, GREY, 'bold'); txt('Weighed for the kitchen\'s food waste report.', 32, 220, 11.5, GREY, 'normal');
    },
    composted() {
      header('Thank you');
      // a simple bin
      rr(46, 70, 48, 58, 6, '#8E8E93'); rr(40, 62, 60, 10, 4, '#6E6E73'); rr(62, 56, 16, 7, 3, '#6E6E73');
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; [58, 70, 82].forEach(x => { c.beginPath(); c.moveTo(x, 80); c.lineTo(x, 120); c.stroke(); });
      txt(`${data.left || 0} g in the bin`, 124, 86, 22); txt('Weighed for the kitchen\'s food waste report.', 124, 108, 12.5, GREY, 'normal');
      rr(16, 160, W - 32, 64, 14, '#E7F6EA'); txt('Now return your tray on the rack →', W / 2, 198, 16, '#1E6B34', 'bold', 'center');
    },
    clean() {
      header('Clean tray');
      L.loopi(c, 70, 110, 70); txt('Clean tray!', 130, 96, 26, GREEN); txt('Nothing to throw away.', 130, 122, 14, GREY, 'normal');
      rr(16, 170, W - 32, 60, 14, '#E7F6EA'); txt('Return your tray on the rack →', W / 2, 206, 16, '#1E6B34', 'bold', 'center');
    },
    bye() { header(); L.loopi(c, W / 2, 110, 80); txt(`See you tomorrow, ${name1()}!`, W / 2, 196, 20, INK, 'bold', 'center'); },
  };
  function draw() { (DRAW[state] || DRAW.idle)(); tex.needsUpdate = true; }
  draw();
  return {
    tex, canvas: cv,
    get state() { return state; },
    set(s, d = {}) { state = s; data = d; t0 = t; draw(); },
    tick(dt) { t += dt; acc += dt; if (acc > (state === 'idle' || state === 'before' || state === 'after' ? .5 : .06)) { acc = 0; draw(); } },
  };
};
})();
