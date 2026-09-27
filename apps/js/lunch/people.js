/* Lunch Rush people, in the style of low-poly indie horror characters: a faceted, flat-shaded body and head
   with a front-on painted face pasted onto the head (planar projection, so it stretches round the sides),
   long hair as a few flat panels, uniforms painted with soft light and folds. Faces don't animate; heads
   turn to look at you when you're close. Poses: stand, walk, sit, eat, serve, carry a tray, wave, wipe. */
(() => {
'use strict';
const L = PL.L3;
const TAU = Math.PI * 2;

L.SKINS = ['#EDC7A6', '#E2B48E', '#D29E76', '#BC8660', '#99653F', '#76492C'];
L.HAIRS = ['#15100E', '#1B1411', '#221914', '#2B2019', '#382920'];
L.HOUSE = ['#B8392E', '#2A5E9E', '#2F7D44', '#C9981E'];

const OUTFITS = {
  boy:     { top: 'shirt', col: '#EFEFEA', bottom: 'trousers', bot: '#3A3E47', shoes: 'white', sleeves: 'short', crest: true },
  girl:    { top: 'blouse', col: '#F1EFE9', bottom: 'skirt', bot: '#1F2740', shoes: 'black', sleeves: 'short', socks: true, tie: '#1F2740', crest: true },
  pe:      { top: 'tee', col: '#B8392E', bottom: 'shorts', bot: '#1D1F24', shoes: 'white', sleeves: 'short', socks: true, print: 'HLS' },
  teacher: { top: 'shirt', col: '#BCD0E2', bottom: 'trousers', bot: '#2A2C31', shoes: 'black', sleeves: 'long', lanyard: true },
  auntie:  { top: 'tee', col: '#8A4450', apron: '#ECE8DF', bottom: 'trousers', bot: '#1E1E22', shoes: 'black', sleeves: 'short', gloves: '#8DB6DC' },
  cook:    { top: 'tee', col: '#A83A30', apron: '#E3DDCF', bottom: 'trousers', bot: '#25252A', shoes: 'black', sleeves: 'short' },
  uncle:   { top: 'tee', col: '#9AA3AD', apron: '#2E5C8A', bottom: 'trousers', bot: '#2B2B30', shoes: 'black', sleeves: 'short' },
  cleaner: { top: 'polo', col: '#35684F', bottom: 'trousers', bot: '#55585E', shoes: 'black', sleeves: 'short', logo: 'CLEANING' },
  makcik:  { top: 'kurung', col: '#6FA3A0', bottom: 'longskirt', bot: '#6FA3A0', shoes: 'black', sleeves: 'long' },
};

/* ================================================================ the face: a front-on painted portrait */
// head size used for the planar projection: x in ±HW, y in ±HH map to the whole texture
const HW = .1, HH = .125, FS = 256;
function faceCanvas(o) {
  const S = FS, cx = 128, r = L.rng(o.seed), skin = o.skin;
  const dark = L.lerpHex(skin, '#3A1E12', .35), darker = L.lerpHex(skin, '#2A140C', .55), light = L.lerpHex(skin, '#FFF4E6', .32);
  const EY = 124, BY = 100, NY = 160, MY = 190;
  return L.canvas(S, S, c => {
    // skin, darker toward the sides of the head
    c.fillStyle = L.lerpHex(skin, '#2A140C', .22); c.fillRect(0, 0, S, S);
    const g = c.createRadialGradient(cx - 10, 118, 8, cx, 140, 130);
    g.addColorStop(0, light); g.addColorStop(.5, skin); g.addColorStop(1, L.lerpHex(skin, '#2A140C', .28));
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, 140, 108, 124, 0, 0, TAU); c.fill();
    // form: temples, cheekbones, jaw, eye sockets, nose, chin (key light from the upper left)
    L.soft(c, S, S, 6, t => {
      [-1, 1].forEach(s => {
        L.blob(t, cx + s * 96, 112, 22, 56, darker, s > 0 ? .5 : .35);
        L.blob(t, cx + s * 66, 182, 20, 26, dark, .26);
        L.blob(t, cx + s * 80, 214, 26, 34, darker, s > 0 ? .4 : .3);
        L.blob(t, cx + s * 44, 154, 26, 16, '#D96A6E', o.adult ? .12 : .2);
        L.blob(t, cx + s * 40, 120, 28, 17, darker, .34);
        L.blob(t, cx + s * 40, 98, 30, 8, light, .3);
      });
      L.blob(t, cx - 6, 66, 62, 28, light, .4);
      L.blob(t, cx + 12, 142, 8, 30, darker, .4);
      L.blob(t, cx - 5, 140, 6, 28, light, .5);
      L.blob(t, cx, 172, 22, 7, darker, .5);
      L.blob(t, cx, 214, 22, 8, darker, .38);
      L.blob(t, cx - 4, 228, 20, 10, light, .3);
      L.blob(t, cx, 256, 96, 18, darker, .6);
    });
    // adult lines and stubble
    if (o.adult) L.soft(c, S, S, 1.2, t => {
      t.strokeStyle = L.rgba('#3A1E12', .35); t.lineWidth = 2;
      [-1, 1].forEach(s => { t.beginPath(); t.moveTo(cx + s * 18, 164); t.quadraticCurveTo(cx + s * 30, 180, cx + s * 27, 198); t.stroke(); t.beginPath(); t.moveTo(cx + s * 26, 134); t.quadraticCurveTo(cx + s * 40, 140, cx + s * 54, 134); t.stroke(); });
      t.globalAlpha = .6; [70, 80].forEach(y => { t.beginPath(); t.moveTo(cx - 32, y); t.quadraticCurveTo(cx, y - 4, cx + 32, y); t.stroke(); });
    });
    if (o.stubble) L.soft(c, S, S, .8, t => { t.fillStyle = L.rgba('#241A16', .3); for (let i = 0; i < 1400; i++) { const a = r() * Math.PI, d = 50 + r() * 34, x = cx + Math.cos(a) * d * .85, y = 176 + Math.sin(a) * d * .75; if (y > 172) t.fillRect(x, y, 1.2, 1.2); } for (let i = 0; i < 260; i++) t.fillRect(cx - 22 + r() * 44, 176 + r() * 7, 1.2, 1.2); });
    // eyes
    [-1, 1].forEach(s => {
      const ex = cx + s * 40, h = o.eyeH, w = 17, ix = ex - s * w, ox = ex + s * w;
      const eye = new Path2D(); eye.moveTo(ix, EY + 1); eye.quadraticCurveTo(ex, EY - h * 1.9, ox, EY - 2); eye.quadraticCurveTo(ex + s * 2, EY + h * 1.15, ix, EY + 1);
      if (!o.mono) L.soft(c, S, S, 1, t => { t.strokeStyle = L.rgba('#3A1E12', .45); t.lineWidth = 1.6; t.beginPath(); t.moveTo(ix + s * 2, EY - h - 2); t.quadraticCurveTo(ex, EY - h * 2.6, ox, EY - h - 3); t.stroke(); });
      L.blob(c, ex, EY + 9, 18, 6, dark, .3);
      c.save(); c.clip(eye);
      const sg = c.createLinearGradient(ix, 0, ox, 0); sg.addColorStop(0, '#CFC4BC'); sg.addColorStop(.5, '#EEE7E0'); sg.addColorStop(1, '#C4B8AF'); c.fillStyle = sg; c.fillRect(ex - 22, EY - 16, 44, 30);
      const ig = c.createRadialGradient(ex - 1, EY - 2, 1, ex, EY - 1, 9); ig.addColorStop(0, o.iris2); ig.addColorStop(.7, o.iris); ig.addColorStop(1, '#0E0805');
      c.fillStyle = ig; c.beginPath(); c.arc(ex, EY - 1, 8.6, 0, TAU); c.fill();
      c.fillStyle = '#050302'; c.beginPath(); c.arc(ex, EY - 1, 3.4, 0, TAU); c.fill();
      const lg = c.createLinearGradient(0, EY - 12, 0, EY + 2); lg.addColorStop(0, 'rgba(20,10,6,.55)'); lg.addColorStop(1, 'rgba(20,10,6,0)'); c.fillStyle = lg; c.fillRect(ex - 22, EY - 16, 44, 18);
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ex - 3, EY - 4, 1.8, 0, TAU); c.fill();
      c.restore();
      c.strokeStyle = '#140B08'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(ix, EY + 1); c.quadraticCurveTo(ex, EY - h * 1.9, ox, EY - 2); c.stroke();
      c.lineWidth = 1.2; for (let k = 0; k < 4; k++) { const t = .55 + k * .12, x = ix + (ox - ix) * t, y = EY - h * 1.9 * 2 * t * (1 - t) - 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + s * 3, y - 3); c.stroke(); }
      c.strokeStyle = L.rgba('#6A3A2C', .45); c.lineWidth = 1; c.beginPath(); c.moveTo(ox, EY - 2); c.quadraticCurveTo(ex + s * 2, EY + h * 1.15, ix, EY + 1); c.stroke();
      L.blob(c, ix + s * 2, EY + 1, 3, 2, '#C9706C', .6);
      // brows: many fine strokes along an arch
      c.strokeStyle = L.rgba(o.hairCol, .55); c.lineCap = 'round';
      const bi = ex - s * 19, bo = ex + s * 20;
      for (let k = 0; k < 46; k++) { const t = k / 45, x = bi + (bo - bi) * t, y = BY + 2 - Math.sin(Math.min(1, t * 1.3) * Math.PI * .6) * 6 + t * 3 + (r() - .5) * 2; c.lineWidth = (1 - t) * o.brow + .6; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + s * 4, y - 1); c.stroke(); }
      if (o.glasses) { c.strokeStyle = '#1E1C1C'; c.lineWidth = 2.2; L.roundRect(c, ex - 21, EY - 15, 42, 28, 7); c.stroke(); L.blob(c, ex - 8, EY - 7, 10, 4, '#FFFFFF', .22); }
    });
    if (o.glasses) { c.strokeStyle = '#1E1C1C'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(cx - 19, EY - 6); c.quadraticCurveTo(cx, EY - 10, cx + 19, EY - 6); c.stroke(); c.beginPath(); c.moveTo(cx - 61, EY - 6); c.lineTo(cx - 110, EY - 2); c.moveTo(cx + 61, EY - 6); c.lineTo(cx + 110, EY - 2); c.stroke(); }
    // nose
    L.soft(c, S, S, 1.2, t => {
      [-1, 1].forEach(s => { t.fillStyle = L.rgba('#1E0E08', .7); t.beginPath(); t.ellipse(cx + s * 9, NY + 5, 5, 2.6, s * .35, 0, TAU); t.fill(); t.strokeStyle = L.rgba('#3A1E12', .45); t.lineWidth = 2; t.beginPath(); t.arc(cx + s * 13, NY, 7, s > 0 ? -.6 : Math.PI - 1.8, s > 0 ? 1.8 : Math.PI + .6); t.stroke(); });
      L.blob(t, cx - 2, NY - 4, 8, 6, light, .6);
    });
    // mouth
    L.soft(c, S, S, .9, t => {
      const up = new Path2D(); up.moveTo(cx - 24, MY); up.quadraticCurveTo(cx - 14, MY - 7, cx - 6, MY - 7); up.quadraticCurveTo(cx, MY - 4, cx + 6, MY - 7); up.quadraticCurveTo(cx + 14, MY - 7, cx + 24, MY); up.quadraticCurveTo(cx, MY + 3, cx - 24, MY);
      t.fillStyle = L.mix(o.lip, -.18); t.fill(up);
      const lo = new Path2D(); lo.moveTo(cx - 22, MY + 1); lo.quadraticCurveTo(cx, MY + 17, cx + 22, MY + 1); lo.quadraticCurveTo(cx, MY + 3, cx - 22, MY + 1);
      t.fillStyle = o.lip; t.fill(lo);
      L.blob(t, cx - 2, MY + 8, 9, 3, '#FFF0E6', .3);
      t.strokeStyle = L.rgba('#2A0E0A', .8); t.lineWidth = 1.8; t.beginPath(); t.moveTo(cx - 24, MY); t.quadraticCurveTo(cx, MY + 3, cx + 24, MY); t.stroke();
      [-1, 1].forEach(s => L.blob(t, cx + s * 25, MY + 1, 4, 3, '#2A0E0A', .4));
      t.strokeStyle = L.rgba('#3A1E12', .2); t.lineWidth = 1.5; [-1, 1].forEach(s => { t.beginPath(); t.moveTo(cx + s * 4, NY + 12); t.lineTo(cx + s * 5, MY - 7); t.stroke(); });
    });
    // hair or headscarf around the face
    if (o.hair === 'tudung') tudung(c, S, cx, o, r); else if (o.hair !== 'bald') hair(c, S, cx, o, r);
    // skin texture and a touch of softness
    L.grain(c, S, S, 7, o.seed);
    L.soft(c, S, S, .5, t => t.drawImage(c.canvas, 0, 0));
  });
}
function hairPath(o, cx) {
  const long = o.hair === 'long' || o.hair === 'bob' || o.hair === 'pony', p = new Path2D(), top = o.fringe ? 96 : 52;
  p.moveTo(0, 0); p.lineTo(256, 0);
  const side = long ? (o.hair === 'bob' ? 206 : 256) : 128;
  p.lineTo(256, side);
  if (long) { p.lineTo(236, side); p.quadraticCurveTo(222, 150, 214, 96); }
  else p.lineTo(224, 100);
  if (o.fringe) { for (let x = 214; x >= 42; x -= 8) p.lineTo(x, top + ((x / 8) % 2) * 5 + Math.abs(x - cx) * .08); }
  else { p.quadraticCurveTo(196, 58, cx + 4, top); p.quadraticCurveTo(60, 58, 42, 100); }
  if (long) { p.quadraticCurveTo(34, 150, 20, side); p.lineTo(0, side); }
  else { p.lineTo(32, 100); p.lineTo(0, side); }
  p.closePath();
  return p;
}
function hair(c, S, cx, o, r) {
  const p = hairPath(o, cx);
  // the hair's shadow on the skin
  L.soft(c, S, S, 5, t => { t.fillStyle = 'rgba(25,12,8,.45)'; t.translate(0, 5); t.fill(p); });
  c.save(); c.clip(p);
  const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, L.mix(o.hairCol, .1)); g.addColorStop(1, L.mix(o.hairCol, -.2)); c.fillStyle = g; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { const x0 = cx + (r() - .5) * 20, dir = r() < .5 ? -1 : 1, x1 = cx + dir * (20 + r() * 120), y1 = 60 + r() * 200; c.strokeStyle = r() < .55 ? 'rgba(0,0,0,.28)' : L.rgba('#FFFFFF', .06 + r() * .06); c.lineWidth = .8 + r(); c.beginPath(); c.moveTo(x0, -5); c.quadraticCurveTo((x0 + x1) / 2 + dir * 30, 20 + r() * 30, x1, y1); c.stroke(); }
  L.blob(c, cx - 30, 36, 60, 12, '#FFFFFF', .12);
  if (o.hair === 'net') { c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1; for (let x = -60; x < S; x += 7) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, 110); c.stroke(); c.beginPath(); c.moveTo(x + 60, 0); c.lineTo(x, 110); c.stroke(); } }
  c.restore();
}
function tudung(c, S, cx, o, r) {
  L.soft(c, S, S, 4, t => { t.fillStyle = 'rgba(25,12,8,.4)'; t.beginPath(); t.rect(0, 0, S, S); t.ellipse(cx, 150, 80, 100, 0, 0, TAU); t.fill('evenodd'); });
  c.save(); c.beginPath(); c.rect(0, 0, S, S); c.ellipse(cx, 146, 78, 100, 0, 0, TAU); c.clip('evenodd');
  c.fillStyle = o.tudungCol; c.fillRect(0, 0, S, S);
  L.soft(c, S, S, 4, t => { for (let i = 0; i < 26; i++) L.blob(t, r() * S, r() * S, 6, 40, r() < .6 ? '#000000' : '#FFFFFF', .12); L.blob(t, 0, 140, 50, 140, '#000000', .25); L.blob(t, S, 140, 50, 140, '#000000', .3); });
  c.restore();
}
function hairCanvas(o) {
  const r = L.rng(o.seed + 3), col = o.hair === 'tudung' ? o.tudungCol : o.hair === 'net' ? '#EDEDEA' : o.hairCol;
  return L.canvas(128, 128, c => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, L.mix(col, .1)); g.addColorStop(1, L.mix(col, -.25)); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    if (o.hair === 'net' || o.hair === 'tudung') L.soft(c, 128, 128, 3, t => { for (let i = 0; i < 20; i++) L.blob(t, r() * 128, r() * 128, 5, 30, r() < .5 ? '#000000' : '#FFFFFF', .12); });
    else for (let i = 0; i < 420; i++) { const x = r() * 128; c.strokeStyle = r() < .6 ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.07)'; c.lineWidth = .8 + r(); c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + (r() - .5) * 10, 40, x + (r() - .5) * 10, 90, x + (r() - .5) * 12, 128); c.stroke(); }
    L.blob(c, 64, 20, 70, 10, '#FFFFFF', .1);
  });
}
/* ================================================================ clothes */
function topCanvas(o, f) {
  const W = 256, H = 256, fx = 128, r = L.rng(o.seed + 11), ink = 'rgba(0,0,0,.22)';
  return L.canvas(W, H, c => {
    c.fillStyle = f.col; c.fillRect(0, 0, W, H);
    L.soft(c, W, H, 5, t => {
      for (let i = 0; i < 22; i++) L.blob(t, r() * W, 50 + r() * 190, 6, 26 + r() * 30, r() < .6 ? '#000000' : '#FFFFFF', r() < .6 ? .1 : .14);
      [fx - 64, fx + 64].forEach(x => L.blob(t, x, 130, 18, 140, '#000000', .16));
      L.blob(t, fx, 205, 70, 18, '#000000', .1);
    });
    if (f.top === 'shirt' || f.top === 'polo') {
      c.fillStyle = L.mix(f.col, -.12); c.fillRect(0, 0, W, 9);
      c.fillStyle = o.skin; c.beginPath(); c.moveTo(fx - 7, 8); c.lineTo(fx + 7, 8); c.lineTo(fx, 28); c.closePath(); c.fill();
      [-1, 1].forEach(s => { c.fillStyle = f.col; c.beginPath(); c.moveTo(fx + s * 6, 9); c.lineTo(fx + s * 34, 3); c.lineTo(fx + s * 20, 38); c.closePath(); c.fill(); c.strokeStyle = ink; c.lineWidth = 1.5; c.stroke(); });
      c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(fx - 2, 28, 5, f.top === 'polo' ? 44 : 200);
      (f.top === 'polo' ? [44, 60] : [48, 80, 112, 144, 176]).forEach(y => { c.fillStyle = '#E2E2DC'; c.beginPath(); c.arc(fx, y, 3.2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.stroke(); });
      if (f.top === 'shirt' && !f.lanyard) { c.strokeStyle = ink; c.lineWidth = 1.5; c.strokeRect(fx + 18, 68, 32, 34); }
    } else if (f.top === 'blouse') {
      c.fillStyle = L.mix(f.col, -.1); c.fillRect(0, 0, W, 8);
      c.fillStyle = o.skin; c.beginPath(); c.moveTo(fx - 10, 6); c.lineTo(fx + 10, 6); c.lineTo(fx, 22); c.closePath(); c.fill();
      [-1, 1].forEach(s => { c.fillStyle = L.mix(f.col, .3); c.beginPath(); c.ellipse(fx + s * 20, 14, 22, 14, s * .25, 0, TAU); c.fill(); c.strokeStyle = ink; c.lineWidth = 1.5; c.stroke(); });
      if (f.tie) { c.fillStyle = f.tie; c.beginPath(); c.moveTo(fx - 7, 20); c.lineTo(fx + 7, 20); c.lineTo(fx + 9, 110); c.lineTo(fx, 122); c.lineTo(fx - 9, 110); c.closePath(); c.fill(); c.fillStyle = L.mix(f.tie, .15); c.fillRect(fx - 7, 20, 14, 12); }
    } else {
      c.fillStyle = L.mix(f.col, -.22); c.beginPath(); c.ellipse(fx, 0, 30, 16, 0, 0, TAU); c.fill();
      c.fillStyle = o.skin; c.beginPath(); c.ellipse(fx, 0, 24, 12, 0, 0, TAU); c.fill();
      if (f.print) L.lines(c, W, [[f.print, 24, 70, 'rgba(255,255,255,.85)', 'bold', fx]]);
      if (f.logo) { [-1, 1].forEach(s => { c.fillStyle = f.col; c.beginPath(); c.moveTo(fx + s * 8, 8); c.lineTo(fx + s * 28, 4); c.lineTo(fx + s * 16, 26); c.closePath(); c.fill(); c.strokeStyle = ink; c.stroke(); }); L.lines(c, W, [[f.logo, 12, 68, '#F2F2F2', 'bold', fx + 32]]); }
    }
    if (f.crest) { const x = fx + 34, y = f.top === 'blouse' ? 60 : 76; c.fillStyle = '#1F2F5A'; c.beginPath(); c.moveTo(x - 8, y - 8); c.lineTo(x + 8, y - 8); c.lineTo(x + 8, y + 2); c.lineTo(x, y + 10); c.lineTo(x - 8, y + 2); c.closePath(); c.fill(); c.fillStyle = '#D9AE2E'; c.fillRect(x - 2, y - 5, 4, 8); }
    if (f.lanyard) { c.strokeStyle = '#2A5E9E'; c.lineWidth = 4; c.beginPath(); c.moveTo(fx - 18, 6); c.lineTo(fx - 2, 88); c.moveTo(fx + 18, 6); c.lineTo(fx + 2, 88); c.stroke(); c.fillStyle = '#FFFFFF'; c.fillRect(fx - 12, 88, 24, 32); c.fillStyle = '#2A5E9E'; c.fillRect(fx - 12, 88, 24, 8); c.fillStyle = '#C9B8A6'; c.fillRect(fx - 6, 100, 12, 12); }
    if (f.apron) {
      c.fillStyle = f.apron; c.fillRect(fx - 60, 44, 120, H - 44); c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2; c.strokeRect(fx - 60, 44, 120, H - 44);
      c.strokeStyle = f.apron; c.lineWidth = 6; c.beginPath(); c.moveTo(fx - 48, 44); c.lineTo(fx - 20, 0); c.moveTo(fx + 48, 44); c.lineTo(fx + 20, 0); c.stroke();
      L.soft(c, W, H, 3, t => { for (let i = 0; i < 10; i++) L.blob(t, fx + (r() - .5) * 100, 120 + r() * 120, 6, 6, '#8A5A2A', .14); });
    }
    if (f.bottom === 'trousers' || f.bottom === 'shorts') { c.fillStyle = f.bot; c.fillRect(0, 228, W, 28); c.fillStyle = '#16161A'; c.fillRect(0, 222, W, 8); c.fillStyle = '#B0B0A8'; c.fillRect(fx - 6, 222, 12, 8); }
    else { c.fillStyle = f.bot; c.fillRect(0, 236, W, 20); }
    L.wrapShade(c, W, H, .5, .22); L.vshade(c, W, H, .1, .22); L.grain(c, W, H, 6, o.seed + 1);
  });
}
function limbCanvas(o, f, part) {
  const W = 64, H = 128, r = L.rng(o.seed + part.length);
  return L.canvas(W, H, c => {
    const fill = (col, y0, y1) => { c.fillStyle = col; c.fillRect(0, y0, W, y1 - y0); };
    if (part === 'upper') { fill(o.skin, 0, H); fill(f.col, 0, f.sleeves === 'long' ? H : 70); if (f.sleeves !== 'long') fill(L.mix(f.col, -.16), 62, 70); }
    else if (part === 'fore') { fill(o.skin, 0, H); if (f.sleeves === 'long') { fill(f.col, 0, 104); fill(L.mix(f.col, -.15), 96, 104); } }
    else if (part === 'hand') fill(f.gloves || o.skin, 0, H);
    else if (part === 'thigh') { const bare = f.bottom === 'skirt'; fill(bare ? o.skin : f.bot, 0, H); if (f.bottom === 'shorts') { fill(o.skin, 76, H); fill(L.mix(f.bot, .15), 70, 76); } }
    else if (part === 'shin') {
      const bare = f.bottom === 'skirt' || f.bottom === 'shorts';
      fill(bare ? o.skin : f.bot, 0, H);
      if (bare && f.socks) { const top = f.bottom === 'skirt' ? 34 : 70; fill('#E9E6DE', top, H); fill('#D9D5CB', top, top + 6); L.soft(c, W, H, 2, t => { for (let y = top + 10; y < H; y += 7) { t.fillStyle = 'rgba(0,0,0,.06)'; t.fillRect(0, y, W, 2); } }); }
    }
    L.soft(c, W, H, 3, t => { for (let i = 0; i < 6; i++) L.blob(t, r() * W, r() * H, 4, 16, '#000000', .08); });
    L.wrapShade(c, W, H, 0, .28); L.grain(c, W, H, 6, o.seed + 5);
  });
}
function shoeCanvas(f) {
  return L.canvas(64, 64, c => {
    const white = f.shoes === 'white';
    c.fillStyle = white ? '#E6E5E0' : '#1D1B1B'; c.fillRect(0, 0, 64, 64);
    c.fillStyle = white ? '#B7B6B0' : '#0C0B0B'; c.fillRect(0, 48, 64, 16);
    if (white) { c.fillStyle = '#9A9A94'; for (let y = 12; y < 40; y += 8) c.fillRect(24, y, 16, 2); } else L.blob(c, 24, 16, 16, 6, '#FFFFFF', .22);
  });
}
function skirtCanvas(o, f) {
  return L.canvas(128, 128, c => {
    c.fillStyle = f.bot; c.fillRect(0, 0, 128, 128);
    if (f.bottom === 'skirt') L.soft(c, 128, 128, 1.5, t => { for (let x = 0; x < 128; x += 8) { t.fillStyle = 'rgba(0,0,0,.3)'; t.fillRect(x, 10, 2, 118); t.fillStyle = 'rgba(255,255,255,.07)'; t.fillRect(x + 3, 10, 2, 118); } });
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, 128, 10);
    L.wrapShade(c, 128, 128, 0, .3); L.vshade(c, 128, 128, 0, .2); L.grain(c, 128, 128, 6, o.seed + 9);
  });
}

/** A photo face fitted to the same layout (see sophie.js): drawn once the image has loaded. */
function photoTex(face) {
  const cv = L.canvas(512, 512, c => { c.fillStyle = face.skin; c.fillRect(0, 0, 512, 512); }), tex = L.texOf(cv);
  const img = new Image(); img.onload = () => { cv.getContext('2d').drawImage(img, 0, 0, 512, 512); tex.needsUpdate = true; }; img.src = face.src;
  return tex;
}

/* ================================================================ build */
const matOf = (cv, side) => L.lam({ map: L.texOf(cv), side: side || THREE.FrontSide });
const facetMesh = (geo, mat) => new THREE.Mesh(L.facet(geo), mat);
function shapeHead(g) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { x *= 1 + y * .34; z *= 1 + y * .1; }
    if (y < -.55 && z > 0) z += (-y - .55) * .18;
    if (z > .45) z = .45 + (z - .45) * .62;
    x *= 1 - Math.max(0, -z) * .06;
    p.setXYZ(i, x * .094, y * .122, z * .104);
  }
  return g;
}

/**
 * o: { name, kind: outfit key, skin, hair, hairCol, fringe, glasses, mono, adult, stubble, tudungCol, house, height, build, seed }
 */
L.person = o => {
  o = { skin: L.SKINS[1], hair: 'short', hairCol: L.HAIRS[0], height: 1.65, build: 1, seed: L.hash(o.name || 'x'), ...o };
  if (o.face && L.FACES && L.FACES[o.face]) { o.photo = L.FACES[o.face]; o.skin = o.photo.skin; }
  const r = L.rng(o.seed);
  o.girl = o.girl !== undefined ? o.girl : ['girl', 'auntie', 'makcik'].includes(o.kind);
  o.iris = o.iris || ['#3A2415', '#2E1C12', '#452B18'][Math.floor(r() * 3)];
  o.iris2 = L.mix(o.iris, .25);
  o.lip = o.lip || L.lerpHex(o.skin, '#A8504A', o.adult ? .35 : .45);
  o.eyeH = o.eyeH || 5.2 + r() * 1.6;
  o.mono = o.mono !== undefined ? o.mono : r() < .45;
  o.brow = o.brow || (o.adult ? 3 : 2.2 + r() * .8);
  o.tudungCol = o.tudungCol || '#EEECE6';
  const f = { ...OUTFITS[o.kind || 'boy'] }; if (o.kind === 'pe') f.col = o.house || L.HOUSE[Math.floor(r() * 4)];
  const bw = o.build;
  // smooth: more segments and soft shading instead of flat facets
  const facetMesh = (geo, mat) => new THREE.Mesh(o.smooth ? (geo.computeVertexNormals(), geo) : L.facet(geo), mat), sg = n => o.smooth ? n * 2 : n;
  const P = { o, f, root: new THREE.Group(), pose: 'stand', lookAt: null, watch: o.watch !== undefined ? o.watch : r() < .6, t: r() * 100, act: null, headYaw: 0, headPitch: 0, name: o.name };
  const R = P.root;
  const hips = P.hips = new THREE.Group(); hips.position.y = .84; R.add(hips);
  // torso: a faceted lathe (hips, waist, chest, shoulders, neck) with an oval section
  const prof = [[.15, 0], [.14, .1], [.128, .19], [.14, .28], [.158, .37], [.165, .44], [.12, .5], [.058, .525]]
    .map(([rr, y], j) => new THREE.Vector2(rr * bw * (o.girl && j < 2 ? 1.06 : 1), y));
  const torso = P.torso = facetMesh(new THREE.LatheGeometry(prof, sg(8), Math.PI, TAU), matOf(topCanvas(o, f), THREE.DoubleSide));
  torso.scale.z = .66; hips.add(torso);
  const chest = P.chest = new THREE.Group(); hips.add(chest);
  const skinMat = L.lam({ color: o.skin });
  const neck = facetMesh(new THREE.CylinderGeometry(.043, .05, .1, sg(6)), skinMat); neck.position.y = .56; chest.add(neck);
  // head: the painted face on the front half, hair colour on the back half
  const head = P.head = new THREE.Group(); head.position.y = .675; head.scale.setScalar(o.adult ? 1.04 : 1.08); chest.add(head);
  const front = shapeHead(new THREE.SphereGeometry(1, sg(7), sg(8), Math.PI / 2 - 1.8, 3.6, 0, Math.PI));
  const uv = front.attributes.uv, fp = front.attributes.position;
  for (let i = 0; i < fp.count; i++) uv.setXY(i, Math.min(.995, Math.max(.005, .5 + fp.getX(i) / (2 * HW))), Math.min(.995, Math.max(.005, .5 + fp.getY(i) / (2 * HH))));
  P.faceMat = L.lam({ map: o.photo ? photoTex(o.photo) : L.texOf(faceCanvas(o)) });
  head.add(facetMesh(front, P.faceMat));
  const hm = matOf(hairCanvas(o), THREE.DoubleSide);
  head.add(facetMesh(shapeHead(new THREE.SphereGeometry(1, sg(5), sg(8), Math.PI / 2 + 1.8, TAU - 3.6, 0, Math.PI)), o.hair === 'bald' ? skinMat : hm));
  const shell = (seg, theta, tilt, sx, sy, sz, y = .006) => { const m = facetMesh(new THREE.SphereGeometry(1, sg(seg), sg(4), 0, TAU, 0, Math.PI * theta), hm); m.scale.set(sx, sy, sz); m.rotation.x = tilt; m.position.y = y; head.add(m); return m; };
  if (o.hair === 'tudung') {
    shell(8, .55, -.5, .104, .13, .116);
    const drape = facetMesh(new THREE.CylinderGeometry(.094, .17, .19, sg(8), 1, true), hm); drape.position.set(0, -.16, -.01); drape.scale.z = .8; head.add(drape);
  } else if (o.hair !== 'bald') {
    shell(8, .5, o.capTilt || (o.hair === 'crop' ? -.66 : -.58), .1, .128, .112);
    if (o.hair === 'net') shell(8, .48, -.45, .106, .112, .118, .03);
    if (o.hair === 'bun') { const b = facetMesh(new THREE.SphereGeometry(.05, sg(6), sg(4)), hm); b.position.set(0, .09, -.075); head.add(b); }
    if (o.hair === 'bob' || o.hair === 'long' || o.hair === 'pony') {
      const long = o.hair === 'long', len = long ? .36 : o.hair === 'bob' ? .17 : .12;
      const side = facetMesh(new THREE.CylinderGeometry(.106, long ? .13 : .115, len, sg(8), 1, true, 1.15, TAU - 2.3), hm);
      side.position.y = .02 - len / 2; side.scale.z = 1.05; head.add(side);
    }
    if (o.hair === 'pony') { const tail = facetMesh(new THREE.CylinderGeometry(.034, .012, .26, sg(5)), hm); tail.position.set(0, -.08, -.13); tail.rotation.x = .35; head.add(tail); }
  }
  // arms
  const upM = matOf(limbCanvas(o, f, 'upper')), foM = matOf(limbCanvas(o, f, 'fore')), haM = matOf(limbCanvas(o, f, 'hand'));
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * (.165 * bw + .012), .435, 0); chest.add(sh);
    const ug = new THREE.CylinderGeometry(.046 * bw, .037, .28, sg(6)); ug.translate(0, -.14, 0); sh.add(facetMesh(ug, upM));
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
    const fg = new THREE.CylinderGeometry(.036, .028, .24, sg(6)); fg.translate(0, -.12, 0); el.add(facetMesh(fg, foM));
    const hand = facetMesh(new THREE.BoxGeometry(.05, .09, .028), haM); hand.position.y = -.285; el.add(hand);
    sh.rotation.z = s * .07;
    return { sh, el, hand };
  };
  P.armR = arm(-1); P.armL = arm(1);
  // legs
  const thM = matOf(limbCanvas(o, f, 'thigh')), shM = matOf(limbCanvas(o, f, 'shin')), shoeM = matOf(shoeCanvas(f));
  const leg = s => {
    const hip = new THREE.Group(); hip.position.set(s * .083 * bw, 0, 0); hips.add(hip);
    const tg = new THREE.CylinderGeometry(.074 * bw, .052, .42, sg(6)); tg.translate(0, -.21, 0); hip.add(facetMesh(tg, thM));
    const knee = new THREE.Group(); knee.position.y = -.42; hip.add(knee);
    const shg = new THREE.CylinderGeometry(.052, .038, .39, sg(6)); shg.translate(0, -.195, 0); knee.add(facetMesh(shg, shM));
    const shoe = facetMesh(new THREE.BoxGeometry(.088, .065, .23), shoeM); shoe.position.set(0, -.405, .045); knee.add(shoe);
    return { hip, knee, shoe };
  };
  P.legR = leg(-1); P.legL = leg(1);
  // skirts
  if (f.bottom === 'skirt' || f.bottom === 'longskirt') {
    const sm = matOf(skirtCanvas(o, f), THREE.DoubleSide), long = f.bottom === 'longskirt';
    const sk = P.skirt = facetMesh(new THREE.CylinderGeometry(.152 * bw, long ? .27 : .25, long ? .8 : .4, sg(10), 1, true), sm);
    sk.position.y = long ? -.36 : -.16; sk.scale.z = .82; hips.add(sk);
    const sit = P.skirtSit = new THREE.Group();
    const ring = facetMesh(new THREE.CylinderGeometry(.152 * bw, .2, .1, sg(10), 1, true), sm); ring.position.y = -.02; ring.scale.z = .82; sit.add(ring);
    const lap = facetMesh(new THREE.BoxGeometry(.32 * bw, .025, long ? .5 : .4), sm); lap.position.set(0, -.04, .2); sit.add(lap);
    sit.visible = false; hips.add(sit);
  }
  P.tray = L.trayMesh ? L.trayMesh(true) : new THREE.Group(); P.tray.position.set(0, .2, .33); P.tray.visible = false; hips.add(P.tray);
  R.scale.setScalar(o.height / 1.65);
  R.traverse(m => { if (m.isMesh) m.userData.person = P; });
  return P;
};

/* ================================================================ animation */
const V = new THREE.Vector3(), W2 = new THREE.Vector3();
const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Pose for this frame. cam: the player's camera position (people nearby look at you). */
L.animPerson = (P, dt, cam) => {
  P.t += dt;
  const t = P.t, R = P.root, pose = P.pose, sit = pose === 'sit' || pose === 'eat';
  if (pose === 'pray' || pose === 'split') { pray(P, dt, pose === 'split'); return; }
  if (P.skirt) { P.skirt.visible = !sit; P.skirtSit.visible = sit; }
  let hipY = .84, thigh = 0, knee = 0, thighL = 0, kneeL = 0, lean = 0;
  if (sit) { hipY = .5; thigh = thighL = -1.5; knee = kneeL = 1.42; lean = .1; }
  else if (pose === 'walk') {
    const ph = P.walkPh || 0; thigh = Math.sin(ph) * .42; thighL = -thigh; knee = Math.max(0, -Math.sin(ph)) * .65 + .05; kneeL = Math.max(0, Math.sin(ph)) * .65 + .05;
    hipY = .84 + Math.abs(Math.cos(ph)) * .018 - .01;
  }
  P.hips.position.y = hipY;
  P.legR.hip.rotation.x = thigh; P.legL.hip.rotation.x = thighL; P.legR.knee.rotation.x = knee; P.legL.knee.rotation.x = kneeL;
  P.chest.rotation.x = lean; P.torso.rotation.x = lean;
  const br = Math.sin(t * 1.5) * .005;
  P.torso.scale.y = 1 + br; P.chest.position.y = br * .5;
  if (pose === 'stand' || pose === 'serve' || pose === 'wipe' || pose === 'wave') P.hips.rotation.z = Math.sin(t * .4) * .015;
  const A = (arm, x, z, e, ez = 0) => { arm.sh.rotation.x = damp(arm.sh.rotation.x, x, 8, dt); arm.sh.rotation.z = damp(arm.sh.rotation.z, z, 8, dt); arm.el.rotation.x = damp(arm.el.rotation.x, e, 8, dt); arm.el.rotation.z = ez; };
  const s = Math.sin(t * 1.1) * .02;
  if (pose === 'carry' || P.carrying) { A(P.armR, -.45, -.18, -1.25); A(P.armL, -.45, .18, -1.25); }
  else if (pose === 'walk') { const ph = P.walkPh || 0; A(P.armR, -Math.sin(ph) * .32, -.07, -.22); A(P.armL, Math.sin(ph) * .32, .07, -.22); }
  else if (pose === 'eat') {
    const cyc = (t * .28 + (P.o.seed % 7) * .1) % 1, e = cyc < .28 ? Math.sin(cyc / .28 * Math.PI) : 0;
    A(P.armR, -.45 - e * .55, -.15, -1.15 - e * .75); A(P.armL, -.6, .15, -.95);
  } else if (pose === 'sit') { A(P.armR, -.55, -.12, -1.0); A(P.armL, -.55, .12, -1.0); }
  else if (pose === 'serve') {
    const k = P.act && P.act.kind === 'scoop' ? Math.min(1, (t - P.act.t0) / .9) : 1, e = Math.sin(k * Math.PI);
    A(P.armR, -.55 - e * .6, -.1, -.9 + e * .4); A(P.armL, -.5, .12, -1.1);
    if (k >= 1 && P.act) P.act = null;
  } else if (pose === 'wipe') { A(P.armR, -.95 + Math.sin(t * 2.6) * .15, -.2 + Math.cos(t * 2.6) * .1, -.5); A(P.armL, -.1, .07, -.2); }
  else if (pose === 'wave') { A(P.armR, 0, -2.5, -.2, Math.sin(t * 8) * .3); A(P.armL, s, .07, -.15); }
  else { A(P.armR, s, -.07, -.12); A(P.armL, -s, .07, -.12); }
  if (pose === 'dance') { dance(P, dt); P.tray.visible = false; return; }
  // head: look at the player when close, otherwise at a friend or slowly around
  let yaw = Math.sin(t * .2 + P.o.seed) * .22, pitch = sit ? .1 : 0, target = null;
  if (P.lookAt) target = P.lookAt;
  else if (cam && P.watch && R.position.distanceTo(W2.set(cam.x, 0, cam.z)) < 4.2) target = cam;
  if (target) {
    P.head.getWorldPosition(V);
    const dx = target.x - V.x, dz = target.z - V.z, dy = target.y - V.y, a = wrapA(Math.atan2(dx, dz) - R.rotation.y);
    if (Math.abs(a) < 2) { yaw = Math.max(-1.05, Math.min(1.05, a)); pitch = Math.max(-.45, Math.min(.45, -Math.atan2(dy, Math.hypot(dx, dz)) * .8)) - lean; }
  }
  P.headYaw = damp(P.headYaw, yaw, 4, dt); P.headPitch = damp(P.headPitch, pitch, 4, dt);
  P.head.rotation.set(P.headPitch, P.headYaw, 0);
  P.tray.visible = !!P.carrying;
};

/** Cross-legged, hands pressed together at the chest, breathing slowly (the root floats; see game3d.js). */
function pray(P, dt, split) {
  const t = P.t, k = 1 - Math.exp(-7 * dt), to = (r, x, y, z) => { r.x += (x - r.x) * k; r.y += (y - r.y) * k; r.z += (z - r.z) * k; };
  if (P.skirt) { P.skirt.visible = !!split; P.skirtSit.visible = !split; }
  P.hips.position.y += ((split ? .5 : .13) - P.hips.position.y) * k; P.hips.rotation.set(0, 0, 0); P.chest.rotation.x = .04; P.torso.rotation.x = 0; P.chest.position.y = 0;
  P.torso.scale.y = 1 + Math.sin(t * 1.1) * .008;
  if (split) {
    // a side split in the air, arms raised wide
    [[P.legR, -1], [P.legL, 1]].forEach(([Lg, s]) => { to(Lg.hip.rotation, 0, 0, s * 1.52); to(Lg.knee.rotation, 0, 0, 0); Lg.shoe.rotation.set(0, 0, 0); });
    [[P.armR, -1], [P.armL, 1]].forEach(([A, s]) => { to(A.sh.rotation, 0, 0, s * 2.5); to(A.el.rotation, 0, 0, s * .25); });
  } else {
    // thighs out and forward, shins folded inward so they cross in front
    [[P.legR, -1], [P.legL, 1]].forEach(([Lg, s]) => { to(Lg.hip.rotation, -1.4, s * .2, s * .8); to(Lg.knee.rotation, s * .12, 0, -s * 2.4); Lg.shoe.rotation.set(0, s * 1.45, 0); });
    // palms pressed together in front of the chest
    [[P.armR, -1], [P.armL, 1]].forEach(([A, s]) => { to(A.sh.rotation, -.2, 0, s * .15); to(A.el.rotation, -2.35, 0, -s * .72); });
  }
  if (P.skirtSit) P.skirtSit.children[0].visible = false;
  if (P.faceYaw === undefined) P.head.rotation.set(.18 + Math.sin(t * .5) * .03, 0, 0);
  else { P.head.rotation.x += (0 - P.head.rotation.x) * Math.min(1, dt * 3); }
}

/** Breakdancing on the spot, as a flowing routine: toprock, dropping into footwork, a windmill, a headspin
 *  and a freeze, then back up. Each move is a smooth function of time and moves blend into each other. */
const BREAK = [['toprock', 5], ['footwork', 4.5], ['windmill', 3.5], ['headspin', 3.2], ['freeze', 1.8], ['footwork', 2.5]];
function breakPose(name, T) {
  const b = T * Math.PI * 2 * 1.07, s = Math.sin(b), c = Math.cos(b);
  if (name === 'toprock') return { y: .8 + .03 * Math.abs(Math.sin(b * 2)), rx: .12, rz: .07 * s, spin: .5 * Math.sin(b * .25), chest: .08, hy: .25 * Math.sin(b * .5), hp: .08 * Math.sin(b * 2),
    ar: [-.7 - .5 * Math.max(0, -s), -.45, -1.4], al: [-.7 - .5 * Math.max(0, s), .45, -1.4], lr: [-.45 * Math.max(0, s), -.15 * s, .7 * Math.max(0, s)], ll: [-.45 * Math.max(0, -s), -.15 * s, .7 * Math.max(0, -s)] };
  if (name === 'footwork') { const f = T * Math.PI * 2 * .9, fs = Math.sin(f), fc = Math.cos(f);
    return { y: .36, rx: .6, rz: .12 * fs, spin: 1.4, chest: .25, hy: -.2, hp: -.35,
      ar: [-.6 + .3 * fs, -.55, -.5], al: [-1.25, .35, -.15], lr: [-1.1 + .7 * fs, -.25 + .35 * fc, 1.5 - .6 * fs], ll: [-1.1 - .7 * fs, .25 + .35 * fc, 1.5 + .6 * fs] }; }
  if (name === 'windmill') { const w = T * 6.5;
    return { y: .36, rx: -1.22, rz: .5 * Math.sin(w), spin: 6.5, chest: .15, hy: 0, hp: .25,
      ar: [.1, -1.35, -.1], al: [.1, 1.35, -.1], lr: [-1.05 + .3 * Math.sin(w), -.8, .1], ll: [-1.05 - .3 * Math.sin(w), .8, .1] }; }
  if (name === 'headspin') return { y: .79, rx: Math.PI, rz: 0, spin: 9, chest: 0, hy: 0, hp: 0,
    ar: [-2.7, -.55, -.9], al: [-2.7, .55, -.9], lr: [0, -.55, 0], ll: [0, .55, 0] };
  return { y: .46, rx: .15, rz: 1.05, spin: 0, chest: .1, hy: .4, hp: -.25, // freeze
    ar: [-.15, .25, -.1], al: [-.5, 1.3, -.8], lr: [-1.5, -.2, 2.1], ll: [-.3, .5, .4] };
}
const lerpPose = (a, b, k) => { const o = {}; for (const key in b) o[key] = Array.isArray(b[key]) ? b[key].map((v, i) => a[key][i] + (v - a[key][i]) * k) : a[key] + (b[key] - a[key]) * k; return o; };
function dance(P, dt) {
  const D = P.dance || (P.dance = { i: 0, t: 0, T: 0, yaw: 0, spin: 0 });
  D.t += dt; D.T += dt;
  // while singing, stay up on the feet (toprock) and face whoever is listening
  const list = P.singing ? [['toprock', 99]] : BREAK;
  if (P.singing && D.mode !== 'sing') { D.mode = 'sing'; D.prev = D.last; D.i = 0; D.t = 0; }
  if (!P.singing && D.mode === 'sing') { D.mode = null; D.prev = D.last; D.i = 0; D.t = 0; }
  let [name, dur] = list[D.i % list.length];
  if (D.t > dur) { D.prev = D.last; D.i = (D.i + 1) % list.length; D.t = 0; [name] = list[D.i]; }
  let p = breakPose(name, D.T);
  const k = Math.min(1, D.t / .6), e = k * k * (3 - 2 * k);
  if (D.prev && e < 1) p = lerpPose(D.prev, p, e);
  D.last = breakPose(name, D.T);
  if (D.prev && e < 1) D.last = lerpPose(D.prev, D.last, e);
  // apply
  P.hips.position.y = p.y; P.hips.rotation.set(p.rx, 0, p.rz); P.chest.rotation.x = p.chest; P.torso.rotation.x = 0;
  P.head.rotation.set(p.hp, p.hy, 0);
  const arm = (A, v) => { A.sh.rotation.x = v[0]; A.sh.rotation.z = v[1]; A.el.rotation.x = v[2]; A.el.rotation.z = 0; };
  arm(P.armR, p.ar); arm(P.armL, p.al);
  const leg = (Lg, v) => { Lg.hip.rotation.x = v[0]; Lg.hip.rotation.z = v[1]; Lg.knee.rotation.x = v[2]; };
  leg(P.legR, p.lr); leg(P.legL, p.ll);
  D.spin += (p.spin - D.spin) * Math.min(1, dt * 3);
  if (P.faceYaw === undefined) { D.yaw += D.spin * dt; P.root.rotation.y = (P.homeYaw || 0) + D.yaw; }
  else { D.yaw = P.root.rotation.y - (P.homeYaw || 0); }
}

/** Move along a path of [x, z] points (looping), with walking feet and optional stops. */
L.walkPerson = (P, dt, speed = 1.1) => {
  const w = P.walk; if (!w) return;
  if (w.wait > 0) { w.wait -= dt; P.pose = w.stopPose || 'stand'; return; }
  const [tx, tz, stop, stopPose, fn] = w.path[w.i], R = P.root, dx = tx - R.position.x, dz = tz - R.position.z, d = Math.hypot(dx, dz);
  if (d < .08) {
    w.i = (w.i + 1) % w.path.length;
    if (stop) { w.wait = stop; w.stopPose = stopPose; if (typeof fn === 'function') fn(P); }
    return;
  }
  const step = Math.min(d, speed * dt);
  R.position.x += dx / d * step; R.position.z += dz / d * step;
  R.rotation.y += wrapA(Math.atan2(dx, dz) - R.rotation.y) * Math.min(1, dt * 8);
  P.walkPh = (P.walkPh || 0) + step * 5.2; P.pose = 'walk';
};
})();
