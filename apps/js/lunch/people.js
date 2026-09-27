/* Lunch Rush people: low-poly characters with painted, pre-lit textures (faces, uniforms, hair), in the
   spirit of lo-fi indie games with photo-textured people. Heads turn to look at you, eyes blink, mouths move
   while they talk, and they have poses for standing, walking, sitting, eating, serving, carrying a tray,
   waving and wiping. */
(() => {
'use strict';
const L = PL.L3;
const TAU = Math.PI * 2;

L.SKINS = ['#F3D3B3', '#EAC29C', '#DDAE84', '#C79268', '#A36E48', '#7E5133'];
L.HAIRS = ['#16110F', '#1D1612', '#241A14', '#2E221A', '#3A2B21'];
L.HOUSE = ['#C8342B', '#1F5FAF', '#2E8B3E', '#E0A21A'];

/** Outfits: top style, colours, bottoms, shoes, sleeves and extras. */
const OUTFITS = {
  boy:     { top: 'shirt', col: '#F2F2EE', bottom: 'trousers', bot: '#3A3E47', shoes: 'white', sleeves: 'short', crest: true },
  girl:    { top: 'blouse', col: '#F5F4F0', bottom: 'skirt', bot: '#26324F', shoes: 'white', sleeves: 'short', socks: true, crest: true },
  pe:      { top: 'tee', col: '#C8342B', bottom: 'shorts', bot: '#1D1F24', shoes: 'white', sleeves: 'short', socks: true, print: 'HLS' },
  teacher: { top: 'shirt', col: '#BCD3E8', bottom: 'trousers', bot: '#2A2C31', shoes: 'black', sleeves: 'long', lanyard: true },
  auntie:  { top: 'tee', col: '#8E3B46', apron: '#EFEBE2', bottom: 'trousers', bot: '#1E1E22', shoes: 'black', sleeves: 'short', gloves: '#7FB2E0', floral: true },
  cook:    { top: 'tee', col: '#B8322A', apron: '#E6E0D2', bottom: 'trousers', bot: '#25252A', shoes: 'black', sleeves: 'short' },
  uncle:   { top: 'tee', col: '#9AA3AD', apron: '#2E5C8A', bottom: 'trousers', bot: '#2B2B30', shoes: 'black', sleeves: 'short' },
  cleaner: { top: 'polo', col: '#2F6B4F', bottom: 'trousers', bot: '#55585E', shoes: 'black', sleeves: 'short', logo: 'CLEANING' },
  makcik:  { top: 'kurung', col: '#5FA3A0', bottom: 'longskirt', bot: '#5FA3A0', shoes: 'black', sleeves: 'long', floral: true },
};

/* ================================================================ painted textures */
function faceCanvas(o, mode) {
  const W = 256, H = 128, fx = 64, r = L.rng(o.seed);
  return L.canvas(W, H, c => {
    c.fillStyle = o.skin; c.fillRect(0, 0, W, H);
    L.wrapShade(c, W, H, .25, .4);
    L.vshade(c, W, H, .1, .38);
    // baked light: cheek blush, eye sockets, under-nose and jaw shadow
    [-1, 1].forEach(s => { L.blob(c, fx + s * 22, 75, 12, 7, '#E06A74', o.adult ? .09 : .15); L.blob(c, fx + s * 13, 60, 12, 7, '#4A2E22', .17); });
    L.blob(c, fx, 101, 36, 10, '#3A2418', .3);
    L.blob(c, fx + 5, 66, 3, 9, '#5A3222', .14);
    L.blob(c, fx - 1, 70, 4, 3, '#FFF3E4', .3);
    c.fillStyle = 'rgba(60,30,22,.5)'; c.fillRect(fx - 4, 73, 2, 1); c.fillRect(fx + 2, 73, 2, 1);
    L.blob(c, fx, 76, 7, 2, '#4A2A1C', .18);
    if (o.adult) { c.strokeStyle = 'rgba(70,40,28,.18)'; c.lineWidth = 1; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(fx + s * 6, 71); c.quadraticCurveTo(fx + s * 10, 78, fx + s * 8, 85); c.stroke(); }); c.beginPath(); c.moveTo(fx - 9, 47); c.lineTo(fx + 9, 47); c.stroke(); }
    if (o.stubble) { c.fillStyle = 'rgba(40,30,25,.22)'; for (let i = 0; i < 260; i++) { const a = r() * Math.PI, d = 20 + r() * 12; c.fillRect(fx + Math.cos(a) * d * .95 - .5, 80 + Math.sin(a) * d * .6, 1, 1); } }
    // ears (u = 0 and .5)
    [0, 128, 256].forEach(x => { L.blob(c, x, 64, 6, 10, '#B06A50', .35); L.blob(c, x, 64, 3, 6, '#4A2A1C', .25); });
    // mouth
    if (mode === 'talk') {
      c.fillStyle = '#3A1512'; c.beginPath(); c.ellipse(fx, 84, 4.6, 3, 0, 0, TAU); c.fill();
      c.fillStyle = '#EDE6DC'; c.fillRect(fx - 3, 81.5, 6, 1.3);
      c.strokeStyle = o.lip; c.lineWidth = 1.2; c.beginPath(); c.ellipse(fx, 84, 5.4, 3.6, 0, 0, TAU); c.stroke();
    } else {
      L.blob(c, fx, 85.5, 5, 2.2, o.lip, .6);
      c.strokeStyle = L.mix(o.lip, -.45); c.lineWidth = 1.3; c.beginPath(); c.moveTo(fx - 6, 83); c.quadraticCurveTo(fx, 85, fx + 6, 83); c.stroke();
    }
    // eyes and brows
    [-1, 1].forEach(s => {
      const cx = fx + s * 13, cy = 60;
      if (mode === 'blink') { c.strokeStyle = '#1A110D'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 6, cy); c.quadraticCurveTo(cx, cy + 2, cx + 6, cy); c.stroke(); }
      else {
        c.fillStyle = '#F1EAE2'; c.beginPath(); c.ellipse(cx, cy, 6.8, o.eyeH, 0, 0, TAU); c.fill();
        c.fillStyle = o.iris; c.beginPath(); c.arc(cx, cy + .3, 3.1, 0, TAU); c.fill();
        c.fillStyle = '#080504'; c.beginPath(); c.arc(cx, cy + .3, 1.3, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.fillRect(cx - 1.2, cy - 1.6, 1.3, 1.3);
        c.strokeStyle = '#150E0B'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy, 7.1, o.eyeH + .5, 0, Math.PI * 1.03, Math.PI * 1.97); c.stroke();
        c.beginPath(); c.moveTo(cx + s * 6, cy - .6); c.lineTo(cx + s * 7.6, cy - 2); c.stroke();
        c.strokeStyle = 'rgba(60,35,25,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(cx, cy, 5.6, o.eyeH, 0, Math.PI * .15, Math.PI * .85); c.stroke();
      }
      c.strokeStyle = L.mix(o.hairCol, .08); c.lineWidth = o.brow; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx - s * 7, cy - 6); c.quadraticCurveTo(cx - s * 1, cy - 9.5, cx + s * 7.5, cy - 7); c.stroke();
      if (o.glasses) { c.strokeStyle = '#222'; c.lineWidth = 1.4; L.roundRect(c, cx - 8.5, cy - 5.5, 17, 11, 3); c.stroke(); L.blob(c, cx - 3, cy - 2, 4, 2, '#FFFFFF', .25); }
    });
    if (o.glasses) { c.strokeStyle = '#222'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(fx - 4.5, 58); c.lineTo(fx + 4.5, 58); c.stroke(); c.beginPath(); c.moveTo(fx - 21, 58); c.lineTo(fx - 40, 60); c.moveTo(fx + 21, 58); c.lineTo(fx + 40, 60); c.stroke(); }
    // hair or headscarf
    if (o.hair === 'tudung') paintTudung(c, W, H, fx, o, r);
    else if (o.hair !== 'bald') paintHair(c, W, H, fx, o, r);
    L.grain(c, W, H, 9, o.seed);
  });
}
function hairline(o, x, W, r) {
  let a = ((x / W - .25) % 1 + 1) % 1; if (a > .5) a -= 1; a = Math.abs(a);
  const back = { short: 94, crop: 90, bun: 98, bob: 112, long: 128, pony: 100, net: 96 }[o.hair] || 96;
  if (a < .12) return o.fringe ? 50 + r() * 4 : 38 + (a / .12) * (a / .12) * 5;
  if (a < .24) return (o.fringe ? 50 : 43) + (a - .12) / .12 * (o.hair === 'long' || o.hair === 'bob' ? 40 : 22);
  return 66 + (a - .24) / .26 * (back - 66);
}
function paintHair(c, W, H, fx, o, r) {
  const path = new Path2D(); path.moveTo(0, 0);
  for (let x = 0; x <= W; x += 2) path.lineTo(x, hairline(o, x, W, r));
  path.lineTo(W, 0); path.closePath();
  c.save(); c.clip(path);
  c.fillStyle = o.hairCol; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) { const x = r() * W, y = r() * 20; c.strokeStyle = r() < .5 ? L.rgba('#000000', .25) : L.rgba('#FFFFFF', .07); c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - .5) * 8, y + 40, x + (r() - .5) * 14, y + 60 + r() * 60); c.stroke(); }
  L.blob(c, fx, 18, 60, 7, '#FFFFFF', .12); L.blob(c, fx + 128, 26, 60, 8, '#FFFFFF', .06);
  if (o.hair === 'net') { c.strokeStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < W; x += 5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 20, 110); c.stroke(); } }
  c.restore();
  // soft shadow the hair throws on the forehead
  for (let x = 0; x < W; x += 2) { const y = hairline(o, x, W, r); const g = c.createLinearGradient(0, y, 0, y + 5); g.addColorStop(0, 'rgba(30,20,15,.3)'); g.addColorStop(1, 'rgba(30,20,15,0)'); c.fillStyle = g; c.fillRect(x, y, 2, 5); }
}
function paintTudung(c, W, H, fx, o, r) {
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.ellipse(fx, 73, 26, 35, 0, 0, TAU); c.clip('evenodd');
  c.fillStyle = o.tudungCol; c.fillRect(0, 0, W, H); L.wrapShade(c, W, H, .25, .3);
  for (let i = 0; i < 40; i++) { const x = r() * W; L.blob(c, x, 40 + r() * 80, 3, 30, r() < .5 ? '#000000' : '#FFFFFF', .08); }
  c.restore();
  c.strokeStyle = L.mix(o.tudungCol, -.3); c.lineWidth = 1.5; c.beginPath(); c.ellipse(fx, 73, 26, 35, 0, 0, TAU); c.stroke();
}
function hairCanvas(o) {
  const r = L.rng(o.seed + 3), col = o.hair === 'tudung' ? o.tudungCol : o.hair === 'net' ? '#F2F2F0' : o.hairCol;
  return L.canvas(64, 64, c => {
    c.fillStyle = col; c.fillRect(0, 0, 64, 64);
    if (o.hair === 'net' || o.hair === 'tudung') { for (let i = 0; i < 24; i++) L.blob(c, r() * 64, r() * 64, 2, 12, r() < .5 ? '#000000' : '#FFFFFF', .08); }
    else for (let i = 0; i < 180; i++) { const x = r() * 64; c.strokeStyle = r() < .6 ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r() - .5) * 6, 64); c.stroke(); }
    const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); L.grain(c, 64, 64, 10, o.seed);
  });
}
function topCanvas(o, f) {
  const W = 128, H = 128, fx = 64, r = L.rng(o.seed + 11);
  return L.canvas(W, H, c => {
    c.fillStyle = f.col; c.fillRect(0, 0, W, H);
    if (f.floral) for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H; c.fillStyle = L.rgba(r() < .5 ? '#F7D6A8' : '#F4F0E8', .55); c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); }
    // creases and folds
    for (let i = 0; i < 16; i++) L.blob(c, r() * W, 30 + r() * 90, 3, 12 + r() * 14, r() < .6 ? '#000000' : '#FFFFFF', r() < .6 ? .08 : .1);
    c.strokeStyle = 'rgba(0,0,0,.1)'; for (let i = 0; i < 10; i++) { const x = fx + (r() - .5) * 60; c.beginPath(); c.moveTo(x, 100); c.lineTo(x + (r() - .5) * 10, 114); c.stroke(); }
    [fx - 32, fx + 32].forEach(x => { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x, 0, 1, H); });
    const ink = 'rgba(0,0,0,.22)';
    if (f.top === 'shirt' || f.top === 'polo') {
      c.fillStyle = L.mix(f.col, -.12); c.fillRect(0, 0, W, 5);
      [-1, 1].forEach(s => { c.fillStyle = f.col; c.beginPath(); c.moveTo(fx + s * 3, 5); c.lineTo(fx + s * 17, 2); c.lineTo(fx + s * 10, 19); c.closePath(); c.fill(); c.strokeStyle = ink; c.lineWidth = 1; c.stroke(); });
      c.fillStyle = o.skin; c.beginPath(); c.moveTo(fx - 3, 5); c.lineTo(fx + 3, 5); c.lineTo(fx, 14); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(fx - 1, 14, 3, f.top === 'polo' ? 22 : 100);
      const n = f.top === 'polo' ? [22, 30] : [24, 40, 56, 72, 88];
      n.forEach(y => { c.fillStyle = '#E4E4DE'; c.beginPath(); c.arc(fx, y, 1.8, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(fx - .5, y - .5, 1, 1); });
      if (f.top === 'shirt' && !f.lanyard) { c.strokeStyle = ink; c.strokeRect(fx + 9, 34, 16, 17); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(fx + 9, 34, 16, 3); }
      if (f.crest) { c.fillStyle = '#1F2F5A'; c.beginPath(); c.moveTo(fx + 13, 38); c.lineTo(fx + 21, 38); c.lineTo(fx + 21, 43); c.lineTo(fx + 17, 47); c.lineTo(fx + 13, 43); c.closePath(); c.fill(); c.fillStyle = '#E0B22A'; c.fillRect(fx + 16, 40, 2, 4); }
    } else if (f.top === 'blouse') {
      c.fillStyle = L.mix(f.col, -.1); c.fillRect(0, 0, W, 4);
      [-1, 1].forEach(s => { c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(fx + s * 9, 7, 10, 7, s * .3, 0, TAU); c.fill(); c.strokeStyle = ink; c.stroke(); });
      c.fillStyle = o.skin; c.beginPath(); c.moveTo(fx - 3, 3); c.lineTo(fx + 3, 3); c.lineTo(fx, 10); c.closePath(); c.fill();
      if (f.crest) { c.fillStyle = '#1F2F5A'; c.beginPath(); c.moveTo(fx + 13, 30); c.lineTo(fx + 21, 30); c.lineTo(fx + 21, 35); c.lineTo(fx + 17, 39); c.lineTo(fx + 13, 35); c.closePath(); c.fill(); c.fillStyle = '#E0B22A'; c.fillRect(fx + 16, 32, 2, 4); }
    } else {
      c.fillStyle = L.mix(f.col, -.2); c.beginPath(); c.ellipse(fx, 0, 14, 8, 0, 0, TAU); c.fill();
      c.fillStyle = o.skin; c.beginPath(); c.ellipse(fx, 0, 11, 6, 0, 0, TAU); c.fill();
      if (f.print) L.lines(c, W, [[f.print, 13, 36, 'rgba(255,255,255,.85)', 'bold', fx]]);
      if (f.logo) { c.fillStyle = f.col; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(fx + s * 4, 4); c.lineTo(fx + s * 14, 2); c.lineTo(fx + s * 8, 13); c.closePath(); c.fill(); c.strokeStyle = ink; c.stroke(); }); L.lines(c, W, [[f.logo, 6, 34, '#F2F2F2', 'bold', fx + 16]]); }
    }
    if (f.lanyard) {
      c.strokeStyle = '#1F5FAF'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx - 9, 3); c.lineTo(fx - 1, 44); c.moveTo(fx + 9, 3); c.lineTo(fx + 1, 44); c.stroke();
      c.fillStyle = '#FFFFFF'; c.fillRect(fx - 6, 44, 12, 16); c.fillStyle = '#1F5FAF'; c.fillRect(fx - 6, 44, 12, 4); c.fillStyle = '#C9B8A6'; c.fillRect(fx - 3, 50, 6, 6);
    }
    if (f.apron) {
      c.fillStyle = f.apron; c.fillRect(fx - 30, 22, 60, H - 22);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.strokeRect(fx - 30, 22, 60, H - 22);
      c.strokeStyle = f.apron; c.lineWidth = 3; c.beginPath(); c.moveTo(fx - 24, 22); c.lineTo(fx - 10, 0); c.moveTo(fx + 24, 22); c.lineTo(fx + 10, 0); c.stroke();
      for (let i = 0; i < 8; i++) L.blob(c, fx + (r() - .5) * 50, 60 + r() * 60, 3, 3, '#8A5A2A', .12);
      c.fillStyle = L.mix(f.apron, -.15); c.fillRect(0, 86, 12, 4); c.fillRect(W - 12, 86, 12, 4);
    }
    if (f.bottom === 'trousers' || f.bottom === 'shorts') {
      c.fillStyle = f.bot; c.fillRect(0, 114, W, 14);
      c.fillStyle = '#16161A'; c.fillRect(0, 111, W, 4); c.fillStyle = '#B8B8B0'; c.fillRect(fx - 3, 111, 6, 4);
    } else { c.fillStyle = f.bot; c.fillRect(0, 118, W, 10); }
    L.wrapShade(c, W, H, .5, .2); L.vshade(c, W, H, .08, .22);
    L.grain(c, W, H, 11, o.seed + 1);
  });
}
function limbCanvas(o, f, part) {
  const W = 32, H = 64, r = L.rng(o.seed + part.length);
  return L.canvas(W, H, c => {
    const skin = o.skin, gloves = f.gloves;
    const fill = (col, y0, y1) => { c.fillStyle = col; c.fillRect(0, y0, W, y1 - y0); };
    if (part === 'upper') { fill(skin, 0, H); fill(f.col, 0, f.sleeves === 'long' ? H : 34); if (f.sleeves !== 'long') fill(L.mix(f.col, -.18), 31, 34); }
    else if (part === 'fore') { fill(skin, 0, H); if (f.sleeves === 'long') { fill(f.col, 0, 52); fill(L.mix(f.col, -.15), 48, 52); } }
    else if (part === 'hand') { fill(gloves || skin, 0, H); }
    else if (part === 'thigh') { const bare = f.bottom === 'skirt'; fill(bare ? skin : f.bot, 0, H); if (f.bottom === 'shorts') { fill(skin, 38, H); fill(L.mix(f.bot, .15), 34, 38); } if (!bare) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, 1, H); } }
    else if (part === 'shin') {
      const bare = f.bottom === 'skirt' || f.bottom === 'shorts';
      fill(bare ? skin : f.bot, 0, H);
      if (bare && f.socks) { fill('#F3F3F0', 34, H); c.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 36; y < H; y += 3) c.fillRect(0, y, W, 1); }
      if (!bare) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, 1, H); }
    }
    for (let i = 0; i < 6; i++) L.blob(c, r() * W, r() * H, 2, 8, '#000000', .06);
    L.wrapShade(c, W, H, 0, .35); L.grain(c, W, H, 10, o.seed + 5);
  });
}
function shoeCanvas(f) {
  return L.canvas(32, 32, c => {
    const white = f.shoes === 'white';
    c.fillStyle = white ? '#EDEDE8' : '#1B1B1E'; c.fillRect(0, 0, 32, 32);
    c.fillStyle = white ? '#B9B9B2' : '#0C0C0E'; c.fillRect(0, 24, 32, 8);
    if (white) { c.fillStyle = '#9A9A94'; for (let y = 6; y < 20; y += 4) c.fillRect(12, y, 8, 1); }
    else L.blob(c, 12, 8, 8, 3, '#FFFFFF', .2);
    L.grain(c, 32, 32, 10, 3);
  });
}
function skirtCanvas(o, f) {
  return L.canvas(64, 64, c => {
    c.fillStyle = f.bot; c.fillRect(0, 0, 64, 64);
    if (f.bottom === 'skirt') for (let x = 0; x < 64; x += 4) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, 6, 1, 58); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x + 1, 6, 1, 58); }
    if (f.floral) { const r = L.rng(o.seed + 21); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(247,214,168,.5)'; c.beginPath(); c.arc(r() * 64, r() * 64, 1.4, 0, TAU); c.fill(); } }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, 64, 5); c.fillRect(0, 60, 64, 4);
    L.wrapShade(c, 64, 64, 0, .35); L.grain(c, 64, 64, 10, o.seed + 9);
  });
}

/* ================================================================ build */
const matOf = (c, side) => L.lam({ map: L.texOf(c), side: side || THREE.FrontSide });
function headGeo() {
  const g = new THREE.SphereGeometry(1, 14, 10), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { const k = 1 + y * .3; x *= k; z *= (1 + y * .12); }
    if (z > .55) z = .55 + (z - .55) * .75;
    p.setXYZ(i, x * .095, y * .118, z * .105);
  }
  g.computeVertexNormals(); return g;
}

/**
 * o: { name, kind: outfit key, skin, hair, hairCol, fringe, glasses, adult, tudungCol, house, height, build, seed }
 */
L.person = o => {
  o = { skin: L.SKINS[1], hair: 'short', hairCol: L.HAIRS[0], height: 1.65, build: 1, seed: L.hash(o.name || 'x'), ...o };
  const r = L.rng(o.seed);
  o.girl = o.girl !== undefined ? o.girl : ['girl', 'auntie', 'makcik'].includes(o.kind);
  o.iris = o.iris || ['#2B1A12', '#3A2416', '#22160F'][Math.floor(r() * 3)];
  o.lip = o.lip || L.lerpHex(o.skin, '#B0564E', o.adult ? .35 : .45);
  o.eyeH = o.eyeH || 2.5 + r() * .7;
  o.brow = o.brow || (o.adult ? 2 : 1.6 + r() * .6);
  o.tudungCol = o.tudungCol || '#F2F0EC';
  const f = { ...OUTFITS[o.kind || 'boy'] }; if (o.kind === 'pe') f.col = o.house || L.HOUSE[Math.floor(r() * 4)];
  const bw = o.build;
  const P = { o, f, root: new THREE.Group(), pose: 'stand', talking: false, lookAt: null, watch: o.watch !== undefined ? o.watch : r() < .6, t: r() * 100, blinkT: 1 + r() * 4, mouthT: 0, act: null, headYaw: 0, headPitch: 0, name: o.name };
  const R = P.root;
  const hips = P.hips = new THREE.Group(); hips.position.y = .84; R.add(hips);
  // torso: a lathe profile (hips, waist, chest, shoulders, neck) with an oval section
  const prof = [[.15, 0], [.152, .06], [.142, .12], [.128, .18], [.13, .24], [.143, .3], [.157, .36], [.165, .42], [.16, .46], [.12, .5], [.058, .525]]
    .map(([rr, y], j) => new THREE.Vector2(rr * bw * (o.girl && j < 3 ? 1.06 : 1), y));
  const torso = P.torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 10, Math.PI, TAU), matOf(topCanvas(o, f), THREE.DoubleSide));
  torso.scale.z = .66; hips.add(torso);
  const chest = P.chest = new THREE.Group(); hips.add(chest);
  const skinMat = L.lam({ color: o.skin });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.044, .05, .1, 8), skinMat); neck.position.y = .56; chest.add(neck);
  // head
  const head = P.head = new THREE.Group(); head.position.y = .675; head.scale.setScalar(o.adult ? 1.04 : 1.1); chest.add(head);
  P.faces = { open: L.texOf(faceCanvas(o, 'open')), blink: L.texOf(faceCanvas(o, 'blink')), talk: L.texOf(faceCanvas(o, 'talk')) };
  P.faceMat = L.lam({ map: P.faces.open });
  head.add(new THREE.Mesh(headGeo(), P.faceMat));
  const hm = matOf(hairCanvas(o), THREE.DoubleSide);
  const cap = (theta, tilt, sx = .1, sy = .126, sz = .112, y = .008) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI * theta), hm); m.scale.set(sx, sy, sz); m.rotation.x = tilt; m.position.y = y; head.add(m); return m; };
  if (o.hair === 'tudung') {
    cap(.52, -.5, .104, .128, .115);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(.092, .17, .19, 14, 1, true), hm); drape.position.set(0, -.16, -.01); drape.scale.z = .8; head.add(drape);
  } else if (o.hair !== 'bald') {
    cap(.52, o.hair === 'crop' ? -.62 : -.52);
    if (o.hair === 'net') cap(.5, -.4, .108, .11, .12, .03);
    if (o.hair === 'bun') { const b = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), hm); b.position.set(0, .09, -.075); head.add(b); }
    if (o.fringe) { const fr = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 3, Math.PI / 2 - .95, 1.9, Math.PI * .2, Math.PI * .2), hm); fr.scale.set(.103, .124, .113); head.add(fr); }
    if (o.hair === 'bob' || o.hair === 'long') {
      const long = o.hair === 'long', side = new THREE.Mesh(new THREE.CylinderGeometry(.106, long ? .13 : .118, long ? .34 : .15, 14, 1, true, 1.05, TAU - 2.1), hm);
      side.position.y = long ? -.12 : -.035; side.scale.z = 1.04; head.add(side);
    }
    if (o.hair === 'pony') {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(.032, .012, .24, 6), hm); tail.position.set(0, -.07, -.13); tail.rotation.x = .35; head.add(tail);
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .02, 6), L.lam({ color: '#1F5FAF' })); tie.position.set(0, .03, -.115); tie.rotation.x = 1.2; head.add(tie);
    }
  }
  // arms
  const upM = matOf(limbCanvas(o, f, 'upper')), foM = matOf(limbCanvas(o, f, 'fore')), haM = matOf(limbCanvas(o, f, 'hand'));
  const arm = s => {
    const sh = new THREE.Group(); sh.position.set(s * (.165 * bw + .012), .435, 0); chest.add(sh);
    const ug = new THREE.CylinderGeometry(.046 * bw, .038, .28, 7); ug.translate(0, -.14, 0); sh.add(new THREE.Mesh(ug, upM));
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
    const fg = new THREE.CylinderGeometry(.037, .03, .24, 7); fg.translate(0, -.12, 0); el.add(new THREE.Mesh(fg, foM));
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.052, .085, .03), haM); hand.position.y = -.285; el.add(hand);
    sh.rotation.z = s * .07;
    return { sh, el, hand };
  };
  P.armR = arm(-1); P.armL = arm(1);
  // legs
  const thM = matOf(limbCanvas(o, f, 'thigh')), shM = matOf(limbCanvas(o, f, 'shin')), shoeM = matOf(shoeCanvas(f));
  const leg = s => {
    const hip = new THREE.Group(); hip.position.set(s * .083 * bw, 0, 0); hips.add(hip);
    const tg = new THREE.CylinderGeometry(.074 * bw, .054, .42, 8); tg.translate(0, -.21, 0); hip.add(new THREE.Mesh(tg, thM));
    const knee = new THREE.Group(); knee.position.y = -.42; hip.add(knee);
    const sg = new THREE.CylinderGeometry(.053, .04, .39, 8); sg.translate(0, -.195, 0); knee.add(new THREE.Mesh(sg, shM));
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(.09, .065, .23), shoeM); shoe.position.set(0, -.405, .045); knee.add(shoe);
    return { hip, knee };
  };
  P.legR = leg(-1); P.legL = leg(1);
  // skirts
  if (f.bottom === 'skirt' || f.bottom === 'longskirt') {
    const sm = matOf(skirtCanvas(o, f), THREE.DoubleSide), long = f.bottom === 'longskirt';
    const sk = P.skirt = new THREE.Mesh(new THREE.CylinderGeometry(.152 * bw, long ? .27 : .23, long ? .8 : .36, 14, 1, true), sm);
    sk.position.y = long ? -.36 : -.14; sk.scale.z = .8; hips.add(sk);
    const sit = P.skirtSit = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.152 * bw, .2, .1, 14, 1, true), sm); ring.position.y = -.02; ring.scale.z = .8; sit.add(ring);
    const lap = new THREE.Mesh(new THREE.BoxGeometry(.32 * bw, .025, long ? .5 : .38), sm); lap.position.set(0, -.04, .2); sit.add(lap);
    sit.visible = false; hips.add(sit);
  }
  // a tray for carrying
  P.tray = L.trayMesh ? L.trayMesh(true) : new THREE.Group(); P.tray.position.set(0, .2, .33); P.tray.visible = false; hips.add(P.tray);
  R.scale.setScalar(o.height / 1.65);
  R.traverse(m => { if (m.isMesh) m.userData.person = P; });
  return P;
};

/* ================================================================ animation */
const V = new THREE.Vector3(), W2 = new THREE.Vector3();
const wrapA = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Pose and face for this frame. cam: the player's camera position (for looking at you). */
L.animPerson = (P, dt, cam) => {
  P.t += dt;
  const t = P.t, R = P.root, pose = P.pose, sit = pose === 'sit' || pose === 'eat';
  // skirt swaps for sitting
  if (P.skirt) { P.skirt.visible = !sit; P.skirtSit.visible = sit; }
  // legs and hips
  let hipY = .84, thigh = 0, knee = 0, thighL = 0, kneeL = 0, lean = 0;
  if (sit) { hipY = .5; thigh = thighL = -1.5; knee = kneeL = 1.42; lean = .1; }
  else if (pose === 'walk') {
    const ph = P.walkPh || 0; thigh = Math.sin(ph) * .45; thighL = -thigh; knee = Math.max(0, -Math.sin(ph)) * .7 + .05; kneeL = Math.max(0, Math.sin(ph)) * .7 + .05;
    hipY = .84 + Math.abs(Math.cos(ph)) * .02 - .01;
  }
  P.hips.position.y = hipY;
  P.legR.hip.rotation.x = thigh; P.legL.hip.rotation.x = thighL; P.legR.knee.rotation.x = knee; P.legL.knee.rotation.x = kneeL;
  P.chest.rotation.x = lean; P.torso.rotation.x = lean;
  // breathing and weight shift
  const br = Math.sin(t * 1.6) * .006;
  P.torso.scale.y = 1 + br; P.chest.position.y = br * .5;
  if (pose === 'stand' || pose === 'serve' || pose === 'wipe' || pose === 'wave') P.hips.rotation.z = Math.sin(t * .45) * .02;
  // arms
  const A = (arm, x, z, e, ez = 0) => { arm.sh.rotation.x = damp(arm.sh.rotation.x, x, 10, dt); arm.sh.rotation.z = damp(arm.sh.rotation.z, z, 10, dt); arm.el.rotation.x = damp(arm.el.rotation.x, e, 10, dt); arm.el.rotation.z = ez; };
  const s = Math.sin(t * 1.2) * .02;
  if (pose === 'carry' || P.carrying) { A(P.armR, -.45, -.18, -1.25); A(P.armL, -.45, .18, -1.25); }
  else if (pose === 'walk') { const ph = P.walkPh || 0; A(P.armR, -Math.sin(ph) * .35, -.07, -.25); A(P.armL, Math.sin(ph) * .35, .07, -.25); }
  else if (false) { A(P.armR, -.45, -.18, -1.25); A(P.armL, -.45, .18, -1.25); }
  else if (pose === 'eat') {
    const cyc = (t * .32 + P.o.seed % 7 * .1) % 1, e = cyc < .25 ? Math.sin(cyc / .25 * Math.PI) : 0;
    A(P.armR, -.45 - e * .55, -.15, -1.15 - e * .75); A(P.armL, -.6, .15, -.95);
  } else if (pose === 'sit') { A(P.armR, -.55, -.12, -1.0); A(P.armL, -.55, .12, -1.0); }
  else if (pose === 'serve') {
    const k = P.act && P.act.kind === 'scoop' ? Math.min(1, (t - P.act.t0) / .9) : 1, e = Math.sin(k * Math.PI);
    A(P.armR, -.55 - e * .6, -.1, -.9 + e * .4); A(P.armL, -.5, .12, -1.1);
    if (k >= 1 && P.act) P.act = null;
  } else if (pose === 'wipe') { A(P.armR, -.95 + Math.sin(t * 3) * .15, -.2 + Math.cos(t * 3) * .1, -.5); A(P.armL, -.1, .07, -.2); }
  else if (pose === 'wave') { A(P.armR, 0, -2.5, -.2, Math.sin(t * 9) * .35); A(P.armL, s, .07, -.15); }
  else { A(P.armR, s, -.07, -.12); A(P.armL, -s, .07, -.12); }
  // head: look at the player when close, otherwise at a buddy or around
  let yaw = Math.sin(t * .23 + P.o.seed) * .25, pitch = sit ? .12 : 0;
  let target = null;
  if (P.lookAt) target = P.lookAt;
  else if (cam && P.watch && R.position.distanceTo(W2.set(cam.x, 0, cam.z)) < 4.2) target = cam;
  if (target) {
    P.head.getWorldPosition(V);
    const dx = target.x - V.x, dz = target.z - V.z, dy = target.y - V.y;
    const a = wrapA(Math.atan2(dx, dz) - R.rotation.y);
    if (Math.abs(a) < 2) { yaw = Math.max(-1.1, Math.min(1.1, a)); pitch = Math.max(-.5, Math.min(.5, -Math.atan2(dy, Math.hypot(dx, dz)) * .8)) + (sit ? lean * -1 : 0); }
  }
  if (P.talking) { yaw += Math.sin(t * 4) * .05; pitch += Math.sin(t * 6.3) * .04; }
  P.headYaw = damp(P.headYaw, yaw, 6, dt); P.headPitch = damp(P.headPitch, pitch, 6, dt);
  P.head.rotation.set(P.headPitch, P.headYaw, 0);
  // face: blink, and move the mouth while talking
  P.blinkT -= dt;
  let face = 'open';
  if (P.blinkT < 0) { face = 'blink'; if (P.blinkT < -.13) P.blinkT = 2 + Math.random() * 4; }
  if (P.talking && face === 'open') { P.mouthT -= dt; if (P.mouthT < 0) { P.mouthOpen = !P.mouthOpen; P.mouthT = .07 + Math.random() * .1; } if (P.mouthOpen) face = 'talk'; }
  const map = P.faces[face]; if (P.faceMat.map !== map) P.faceMat.map = map;
  P.tray.visible = !!P.carrying;
};

/** Move along a path of [x, z] points (looping), with walking feet and optional stops. */
L.walkPerson = (P, dt, speed = 1.1) => {
  const w = P.walk; if (!w) return;
  if (w.wait > 0) { w.wait -= dt; P.pose = w.stopPose || 'stand'; if (w.wait <= 0 && w.onGo) w.onGo(); return; }
  const [tx, tz, stop, stopPose, fn] = w.path[w.i], R = P.root, dx = tx - R.position.x, dz = tz - R.position.z, d = Math.hypot(dx, dz);
  if (d < .08) {
    w.i = (w.i + 1) % w.path.length;
    if (stop) { w.wait = stop; w.stopPose = stopPose; if (typeof fn === 'function') fn(P); }
    return;
  }
  const step = Math.min(d, speed * dt);
  R.position.x += dx / d * step; R.position.z += dz / d * step;
  const want = Math.atan2(dx, dz); R.rotation.y += wrapA(want - R.rotation.y) * Math.min(1, dt * 8);
  P.walkPh = (P.walkPh || 0) + step * 5.2; P.pose = 'walk';
};
})();
