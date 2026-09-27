/* Lunch Rush toolkit: PS1 materials (vertices snap to a coarse screen grid), canvas-painted textures with
   baked shading and photographic grain (the "pre-rendered" look), seeded random numbers and colour maths. */
(() => {
'use strict';
const L = PL.L3 = PL.L3 || {};

const SNAP = 'gl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(160.0, 120.0) + 0.5) / vec2(160.0, 120.0) * gl_Position.w;';
/** The PS1 wobble: snap every vertex to a 320×240-ish grid after projection. */
L.psx = m => {
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\t' + SNAP); };
  return m;
};
L.lam = o => L.psx(new THREE.MeshLambertMaterial(o));
L.basic = o => L.psx(new THREE.MeshBasicMaterial(o));

L.rng = seed => {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
L.hash = s => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

/** Colour helpers. k < 0 darkens, k > 0 lightens. */
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
L.mix = (hex, k) => { const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); const [r, g, b] = rgb(hex); return `rgb(${f(r)},${f(g)},${f(b)})`; };
L.rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
L.lerpHex = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

L.canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
L.texOf = (c, rx = 1, ry = 1, smooth = false) => {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
};
L.tex = (w, h, draw, rx, ry) => L.texOf(L.canvas(w, h, draw), rx, ry);

/** Photographic grit: per-pixel luminance noise, like a scanned photo texture. */
L.grain = (c, w, h, amt = 12, seed = 7) => {
  const r = L.rng(seed), img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n * .92; }
  c.putImageData(img, 0, 0);
};
/** Soft round shadow or glow. */
L.blob = (c, x, y, rx, ry, col, a) => {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, L.rgba(col, a)); g.addColorStop(1, L.rgba(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill(); c.restore();
};
/** Column-by-column baked light for textures wrapped around a body: bright at the front (u = front), dark at the back. */
L.wrapShade = (c, w, h, front = .5, amt = .38) => {
  for (let x = 0; x < w; x++) {
    const a = (x / w - front) * Math.PI * 2, k = (1 - Math.max(0, Math.cos(a))) * amt;
    c.fillStyle = `rgba(20,14,10,${k.toFixed(3)})`; c.fillRect(x, 0, 1, h);
  }
};
L.vshade = (c, w, h, top = .0, bottom = .25) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(255,248,235,${top})`); g.addColorStop(.45, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(20,14,10,${bottom})`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
};
/** Sign or poster text lines: [text, px, y, colour, weight]. */
L.lines = (c, w, list, font = 'Arial, Helvetica, sans-serif') => {
  c.textAlign = 'center'; c.textBaseline = 'middle';
  list.forEach(([t, px, y, col, wt = 'bold', x = w / 2]) => { c.font = `${wt} ${px}px ${font}`; c.fillStyle = col; c.fillText(t, x, y); });
  c.textAlign = 'left';
};
L.roundRect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

/** Pixel Loopi for signs and screens. */
L.loopi = (c, x, y, s, mood = 'happy') => {
  c.save(); c.translate(x, y); c.scale(s / 40, s / 40);
  c.fillStyle = '#76C866'; c.beginPath(); c.ellipse(0, 4, 18, 16, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#8FDB7E'; c.beginPath(); c.ellipse(0, 1, 16, 14, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#4DB35B'; c.beginPath(); c.ellipse(5, -15, 6, 3, -.5, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#3E9B4A'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -12); c.lineTo(1, -17); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-6, 0, 3.5, 4.2, 0, 0, Math.PI * 2); c.ellipse(6, 0, 3.5, 4.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#1F2A1D'; c.beginPath(); c.arc(-5.5, .8, 2, 0, Math.PI * 2); c.arc(6.5, .8, 2, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1F2A1D'; c.lineWidth = 1.6; c.beginPath();
  if (mood === 'sad') c.arc(0, 11, 4, Math.PI * 1.15, Math.PI * 1.85); else c.arc(0, 6, 4.5, .2, Math.PI - .2);
  c.stroke(); c.restore();
};
})();
