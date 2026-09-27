/* Lunch Rush world: a Singapore secondary-school canteen, painted textures with baked light and grit.
   North: four stalls (Drinks, Noodles, the Healthy Set Meal we use, Malay food). North-east corner: the
   PlateLoop station, where the scanner sits on the flow between the serving line and the dining area, with
   floor lanes, a how-to standee, a live stats screen and the tray return rack right beside its compost
   module. Middle: long tables with benches, pillars, ceiling fans. West: sinks, water cooler, notice board.
   South: open to a covered walkway, the school field, trees and a school block, with sun coming in. */
(() => {
'use strict';
const L = PL.L3;
const TAU = Math.PI * 2;
const F = 'Arial, Helvetica, sans-serif';

/* ================================================================ trays and food */
let STEEL = null;
const steelTex = () => STEEL || (STEEL = L.tex(64, 64, (c, w, h) => {
  c.fillStyle = '#B9BEC3'; c.fillRect(0, 0, w, h); const r = L.rng(5);
  for (let i = 0; i < 90; i++) { c.fillStyle = r() < .5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.08)'; c.fillRect(0, r() * h, w, 1); }
  for (let i = 0; i < 14; i++) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.beginPath(); const x = r() * w, y = r() * h; c.moveTo(x, y); c.lineTo(x + r() * 20 - 10, y + r() * 6 - 3); c.stroke(); }
  L.grain(c, w, h, 10, 2);
}));
const FOODTEX = {};
function foodTex(id) {
  if (FOODTEX[id]) return FOODTEX[id];
  const r = L.rng(L.hash(id));
  const paint = {
    rice: c => { c.fillStyle = '#EFE6CF'; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 90; i++) { c.fillStyle = r() < .25 ? '#A9824F' : r() < .6 ? '#FFFFFF' : '#D9CBAA'; c.fillRect(r() * 32, r() * 32, 2, 1); } },
    chicken: c => { c.fillStyle = '#7A3F1C'; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 20; i++) L.blob(c, r() * 32, r() * 32, 5, 3, r() < .5 ? '#B8702F' : '#4A2410', .5); L.blob(c, 12, 10, 6, 3, '#FFFFFF', .35); },
    kailan: c => { c.fillStyle = '#2E6628'; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 12; i++) L.blob(c, r() * 32, r() * 32, 6, 4, r() < .5 ? '#4A8C38' : '#1D4A1A', .6); c.strokeStyle = '#9CC47A'; c.beginPath(); c.moveTo(0, 16); c.lineTo(32, 18); c.stroke(); },
    cabbage: c => { c.fillStyle = '#CFE0A0'; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 10; i++) { c.strokeStyle = 'rgba(120,150,70,.6)'; c.beginPath(); c.moveTo(r() * 32, 0); c.quadraticCurveTo(r() * 32, 16, r() * 32, 32); c.stroke(); } L.blob(c, 10, 10, 8, 4, '#FFFFFF', .3); },
    soup: c => { c.fillStyle = '#C98B45'; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 12; i++) { c.fillStyle = r() < .5 ? '#E8742A' : '#E9DDB5'; c.fillRect(r() * 30, r() * 30, 3, 3); } L.blob(c, 10, 9, 7, 3, '#FFFFFF', .35); },
    melon: c => { c.fillStyle = '#E8434C'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#2E7D32'; c.fillRect(0, 26, 32, 6); c.fillStyle = '#E8F5C8'; c.fillRect(0, 24, 32, 2); c.fillStyle = '#1B1B1B'; for (let i = 0; i < 5; i++) c.fillRect(4 + r() * 24, 6 + r() * 14, 1, 2); },
    sambal: c => { c.fillStyle = '#B8261C'; c.fillRect(0, 0, 32, 32); for (let i = 0; i < 20; i++) L.blob(c, r() * 32, r() * 32, 3, 3, '#6E1410', .5); },
    noodle: c => { c.fillStyle = '#E8C86A'; c.fillRect(0, 0, 32, 32); c.strokeStyle = '#C9A548'; for (let i = 0; i < 16; i++) { c.beginPath(); c.moveTo(0, r() * 32); c.bezierCurveTo(10, r() * 32, 20, r() * 32, 32, r() * 32); c.stroke(); } },
  }[id];
  const cv = L.canvas(32, 32, c => { paint(c); L.grain(c, 32, 32, 12, L.hash(id)); });
  return (FOODTEX[id] = L.lam({ map: L.texOf(cv) }));
}
/** Food pieces for a dish id, as a group, sized by a serving multiplier. */
L.foodGroup = (id, m = 1, seed = 1) => {
  const g = new THREE.Group(), r = L.rng(seed + L.hash(id)), mat = foodTex(id), pieces = [];
  const add = (geo, x, y, z, ry = 0) => { const p = new THREE.Mesh(geo, mat); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); pieces.push(p); return p; };
  if (id === 'rice') { const s = Math.cbrt(m); const p = add(new THREE.SphereGeometry(1, 8, 4, 0, TAU, 0, Math.PI / 2), 0, 0, 0); p.scale.set(.052 * s, .036 * s, .046 * s); }
  else if (id === 'chicken') { const n = Math.max(1, Math.round(3 * m)); for (let i = 0; i < n; i++) add(new THREE.BoxGeometry(.042, .02, .03), (i % 2 - .5) * .035 + (r() - .5) * .01, .012 + (i > 1 ? .014 : 0), (Math.floor(i / 2) - .3) * .03, r() * 1.2); }
  else if (id === 'kailan' || id === 'cabbage') { const n = Math.max(2, Math.round(5 * m)); for (let i = 0; i < n; i++) { const p = add(new THREE.SphereGeometry(1, 6, 4), (r() - .5) * .07, .008 + (i % 3) * .006, (r() - .5) * .05, r() * 3); p.scale.set(.028, .009, .02); } }
  else if (id === 'melon') { const n = Math.max(1, Math.round(2 * m)); for (let i = 0; i < n; i++) { const p = add(new THREE.CylinderGeometry(.036, .036, .018, 3), (i - (n - 1) / 2) * .035, .01, (r() - .5) * .01, r() * .4); p.scale.z = .8; } }
  else if (id === 'soup') {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.052, .04, .042, 12, 1, true), L.lam({ color: '#F4F2EC', side: THREE.DoubleSide })); bowl.position.y = .021; g.add(bowl);
    const base = new THREE.Mesh(new THREE.CircleGeometry(.04, 12), L.lam({ color: '#E8E6E0' })); base.rotation.x = -Math.PI / 2; base.position.y = .002; g.add(base);
    const liq = add(new THREE.CircleGeometry(.049, 12), 0, .036, 0); liq.rotation.x = -Math.PI / 2; liq.userData.soup = { m };
  }
  else { const p = add(new THREE.SphereGeometry(1, 7, 4, 0, TAU, 0, Math.PI / 2), 0, 0, 0); p.scale.set(.05, .03, .045); }
  g.userData.pieces = pieces;
  return g;
};
/** Show how much of a dish is left (0..1): pieces vanish one by one, mounds shrink, soup level drops. */
L.setFoodLeft = (g, left) => {
  const ps = g.userData.pieces; if (!ps) return;
  if (ps.length === 1 && !ps[0].userData.soup) { const p = ps[0]; p.visible = left > .03; const k = Math.max(.15, Math.sqrt(left)); p.userData.s0 = p.userData.s0 || p.scale.clone(); p.scale.set(p.userData.s0.x * k, p.userData.s0.y * Math.max(.2, left), p.userData.s0.z * k); return; }
  if (ps[0].userData.soup) { const p = ps[0]; p.visible = left > .03; p.position.y = .006 + .03 * left; p.scale.setScalar(.82 + .18 * left); return; }
  const show = left * ps.length;
  ps.forEach((p, i) => { p.visible = i < Math.ceil(show - .001); p.userData.s0 = p.userData.s0 || p.scale.clone(); const part = i === Math.ceil(show) - 1 ? Math.max(.4, show - i) : 1; p.scale.copy(p.userData.s0).multiplyScalar(i < Math.floor(show) ? 1 : part); });
};
/** Where each dish sits on a tray (x, z). The front row faces the person eating (+z). */
L.TRAY_SLOT = { kailan: [-.12, -.068], cabbage: [0, -.068], melon: [.12, -.068], rice: [-.12, .058], chicken: [0, .058], soup: [.12, .058] };
/** A steel canteen tray (38 × 28 cm) with compartments. withFood: random leftovers for background trays. */
L.trayMesh = (withFood = false, seed = 1) => {
  const g = new THREE.Group(), m = L.lam({ map: steelTex() });
  const b = (w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); };
  b(.38, .006, .28, 0, .003, 0);
  b(.38, .022, .008, 0, .011, -.136); b(.38, .022, .008, 0, .011, .136); b(.008, .022, .28, -.186, .011, 0); b(.008, .022, .28, .186, .011, 0);
  b(.37, .016, .005, 0, .008, -.005); b(.005, .016, .27, -.06, .008, 0); b(.005, .016, .27, .06, .008, 0);
  if (withFood) { const r = L.rng(seed); Object.keys(L.TRAY_SLOT).forEach(id => { if (r() < .35) return; const f = L.foodGroup(id, .6 + r() * .5, seed); const [x, z] = L.TRAY_SLOT[id]; f.position.set(x, .006, z); L.setFoodLeft(f, r() < .5 ? r() * .6 : 1); g.add(f); }); }
  return g;
};

/* ================================================================ the canteen */
L.buildWorld = scene => {
  const Wd = { colliders: [], solids: [], tables: [], fans: [], anim: [], spots: {}, posters: [], hot: {} };
  const M = {};
  const add = (o, p = scene) => { p.add(o); return o; };
  const box = (w, h, d, mat, x, y, z, p = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); return add(o, p); };
  const cyl = (rt, rb, h, mat, x, y, z, p = scene, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); o.position.set(x, y, z); return add(o, p); };
  const plane = (w, h, mat, x, y, z, ry = 0, p = scene) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); o.position.set(x, y, z); o.rotation.y = ry; return add(o, p); };
  const solid = (x0, x1, z0, z1) => Wd.colliders.push({ minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) });
  const sign = (w, h, draw, lit = true) => { const cv = L.canvas(w, h, (c) => { draw(c, w, h); L.grain(c, w, h, 6, w + h); }); const t = L.texOf(cv, 1, 1); return lit ? L.basic({ map: t }) : L.lam({ map: t }); };

  /* ------------------------------------------------------------ materials */
  M.floor = L.lam({ map: L.tex(128, 128, (c, w, h) => {
    const r = L.rng(11);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = L.lerpHex('#CFC7B6', '#BDB4A2', r()); c.fillRect(x * 32, y * 32, 32, 32); for (let i = 0; i < 30; i++) { c.fillStyle = r() < .5 ? 'rgba(80,70,60,.25)' : 'rgba(255,255,255,.2)'; c.fillRect(x * 32 + r() * 32, y * 32 + r() * 32, 1, 1); } }
    c.fillStyle = '#8F887A'; for (let i = 0; i <= 4; i++) { c.fillRect(i * 32 - 1, 0, 2, h); c.fillRect(0, i * 32 - 1, w, 2); }
    for (let i = 0; i < 8; i++) L.blob(c, r() * w, r() * h, 10 + r() * 14, 8 + r() * 10, '#5A4E3E', .08);
    L.grain(c, w, h, 12, 11);
  }, 13, 10) });
  M.wall = L.lam({ map: L.tex(64, 128, (c, w, h) => {
    c.fillStyle = '#EDE6D3'; c.fillRect(0, 0, w, h);
    const tiles = 38; c.fillStyle = '#E5EFE8'; c.fillRect(0, h - tiles, w, tiles);
    c.fillStyle = 'rgba(0,0,0,.1)'; for (let y = h - tiles; y < h; y += 5) c.fillRect(0, y, w, 1); for (let x = 0; x < w; x += 5) c.fillRect(x, h - tiles, 1, tiles);
    c.fillStyle = '#3F8A5A'; c.fillRect(0, h - tiles - 3, w, 3);
    const r = L.rng(3); for (let i = 0; i < 10; i++) L.blob(c, r() * w, h - tiles - 10 - r() * 60, 6, 20, '#6B5B40', .07);
    L.vshade(c, w, h, 0, .15); L.grain(c, w, h, 9, 4);
  }, 13, 1) });
  M.wallSide = M.wall.clone(); M.wallSide.map = M.wall.map.clone(); M.wallSide.map.repeat.set(10, 1); M.wallSide.map.needsUpdate = true; L.psx(M.wallSide);
  M.ceil = L.lam({ map: L.tex(64, 64, (c, w, h) => { c.fillStyle = '#D8D8D2'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x, 0, 2, h); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + 3, 0, 1, h); } L.grain(c, w, h, 8, 5); }, 8, 6) });
  M.tileW = L.lam({ map: L.tex(64, 64, (c, w, h) => { c.fillStyle = '#F1F1EC'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < w; i += 8) { c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1); } L.grain(c, w, h, 8, 6); }, 3, 2) });
  M.steel = L.lam({ map: steelTex() });
  M.steelDark = L.lam({ color: '#6E757C' });
  M.dark = L.lam({ color: '#26292D' });
  M.white = L.lam({ color: '#F2F1EC' });
  M.table = L.lam({ map: L.tex(64, 32, (c, w, h) => { c.fillStyle = '#E8E1D0'; c.fillRect(0, 0, w, h); const r = L.rng(8); for (let i = 0; i < 40; i++) { c.fillStyle = r() < .5 ? 'rgba(120,100,70,.12)' : 'rgba(255,255,255,.2)'; c.fillRect(r() * w, r() * h, 3, 1); } c.fillStyle = '#9A8F7A'; c.fillRect(0, 0, w, 2); c.fillRect(0, h - 2, w, 2); L.grain(c, w, h, 8, 8); }) });
  M.bench = L.lam({ map: L.tex(32, 16, (c, w, h) => { c.fillStyle = '#3F6E9E'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(0, 2, w, 2); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, h - 3, w, 3); L.grain(c, w, h, 10, 9); }) });
  M.pillar = L.lam({ map: L.tex(32, 64, (c, w, h) => { c.fillStyle = '#E9E2CF'; c.fillRect(0, 0, w, h); c.fillStyle = '#3F8A5A'; c.fillRect(0, h - 18, w, 18); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, h - 19, w, 1); L.vshade(c, w, h, 0, .15); L.grain(c, w, h, 9, 10); }) });
  M.concrete = L.lam({ map: L.tex(64, 64, (c, w, h) => { c.fillStyle = '#A9A59C'; c.fillRect(0, 0, w, h); const r = L.rng(12); for (let i = 0; i < 200; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'; c.fillRect(r() * w, r() * h, 2, 2); } L.grain(c, w, h, 12, 12); }, 13, 2) });
  M.grass = L.lam({ map: L.tex(64, 64, (c, w, h) => { c.fillStyle = '#5E8F3C'; c.fillRect(0, 0, w, h); const r = L.rng(13); for (let i = 0; i < 400; i++) { c.fillStyle = r() < .5 ? '#4E7E30' : '#77A84E'; c.fillRect(r() * w, r() * h, 1, 2); } L.grain(c, w, h, 10, 13); }, 30, 20) });
  M.glass = new THREE.MeshBasicMaterial({ color: '#CFE8F2', transparent: true, opacity: .22, depthWrite: false });

  /* ------------------------------------------------------------ light */
  scene.add(new THREE.HemisphereLight('#FFF3DC', '#6A6050', .62));
  scene.add(new THREE.AmbientLight('#FFFFFF', .28));
  const sun = new THREE.DirectionalLight('#FFE9C4', .55); sun.position.set(-10, 14, 18); scene.add(sun);
  [[-10.4, -8.4, '#FFE2B0'], [-5.6, -8.4, '#FFD9A8'], [.3, -8.4, '#FFF2D8'], [5.8, -8.4, '#FFE2B0'], [10.4, -7.6, '#DFF5E6']].forEach(([x, z, col]) => { const p = new THREE.PointLight(col, .55, 7, 1.6); p.position.set(x, 2.5, z); scene.add(p); });

  /* ------------------------------------------------------------ shell */
  const X0 = -13, X1 = 13, Z0 = -10, Z1 = 9, H = 4.2;
  const floor = plane(X1 - X0, Z1 - Z0 + 2.5, M.floor, 0, 0, (Z0 + Z1 + 2.5) / 2); floor.rotation.x = -Math.PI / 2;
  const ceil = plane(X1 - X0, Z1 - Z0 + 2.5, M.ceil, 0, H, (Z0 + Z1 + 2.5) / 2); ceil.rotation.x = Math.PI / 2;
  plane(X1 - X0, H, M.wall, 0, H / 2, Z0, 0);
  plane(Z1 - Z0, H, M.wallSide, X0, H / 2, (Z0 + Z1) / 2, Math.PI / 2);
  plane(Z1 - Z0, H, M.wallSide, X1, H / 2, (Z0 + Z1) / 2, -Math.PI / 2);
  [-7.5, -5, -1, 3, 7, 9].forEach(z => box(X1 - X0, .32, .28, M.white, 0, H - .16, z));
  // south side: parapet, railing and pillars, open to the field
  box(X1 - X0, .95, .22, M.pillar, 0, .475, Z1); solid(X0, X1, Z1 - .2, Z1 + .2);
  box(X1 - X0, .05, .06, M.steelDark, 0, 1.12, Z1); for (let x = X0; x <= X1; x += .6) box(.03, .18, .03, M.steelDark, x, 1.03, Z1);
  [-13, -8.6, -4.3, 0, 4.3, 8.6, 13].forEach(x => box(.42, H, .42, M.pillar, x, H / 2, Z1));
  const walk = plane(X1 - X0, 2.5, M.concrete, 0, .005, Z1 + 1.25); walk.rotation.x = -Math.PI / 2;
  // outside: field, trees, a school block, the sky
  const grass = plane(160, 90, M.grass, 0, -.04, Z1 + 47); grass.rotation.x = -Math.PI / 2;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(95, 16, 10), new THREE.MeshBasicMaterial({ fog: false, side: THREE.BackSide, map: L.tex(8, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6FA9DD'); g.addColorStop(.46, '#BFDDF2'); g.addColorStop(.5, '#EAF2EE'); g.addColorStop(1, '#9AA48C'); c.fillStyle = g; c.fillRect(0, 0, w, h); }) }));
  sky.position.set(0, 0, 10); scene.add(sky);
  const tree = L.basic({ transparent: true, alphaTest: .5, side: THREE.DoubleSide, map: L.tex(64, 96, (c, w, h) => {
    const r = L.rng(21); c.fillStyle = '#5A4130'; c.fillRect(29, 50, 7, 46); c.fillRect(22, 58, 20, 3);
    for (let i = 0; i < 70; i++) L.blob(c, 32 + (r() - .5) * 56, 30 + (r() - .5) * 38, 8 + r() * 8, 6 + r() * 6, r() < .5 ? '#3E6E2A' : r() < .7 ? '#5C8E3A' : '#2A4E1E', .9);
  }) });
  const r0 = L.rng(33);
  for (let i = 0; i < 16; i++) { const x = -40 + i * 5.4 + r0() * 3, z = 16 + r0() * 16, s = 6 + r0() * 4; [0, Math.PI / 2].forEach(a => { const t = plane(s * .7, s, tree, x, s / 2 - .2, z, a); t.material = tree; }); }
  const block = sign(256, 96, (c, w, h) => {
    c.fillStyle = '#E9E1CE'; c.fillRect(0, 0, w, h); c.fillStyle = '#C8B89A'; for (let y = 10; y < h; y += 22) c.fillRect(0, y + 14, w, 3);
    for (let y = 10; y < h - 10; y += 22) for (let x = 6; x < w; x += 14) { c.fillStyle = '#5E7383'; c.fillRect(x, y, 10, 11); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x, y, 10, 3); }
    c.fillStyle = '#2B8C43'; c.fillRect(100, 2, 56, 7);
  });
  plane(70, 26, block, 0, 12, Z1 + 44);

  /* ------------------------------------------------------------ stalls (north) */
  const STALLS = [
    { x0: -12.8, x1: -8.2, name: 'DRINKS', cn: '饮料', tag: 'Milo · Bandung · Lime juice', col: '#1E6FB8', kind: 'drinks' },
    { x0: -8.0, x1: -3.2, name: 'NOODLES', cn: '面食', tag: 'Fishball noodles · Mee pok', col: '#B8321E', kind: 'noodles' },
    { x0: -3.0, x1: 3.4, name: 'HEALTHY SET MEAL', cn: '健康套餐', tag: 'My Healthy Plate · S$2.80', col: '#2B8C43', kind: 'healthy' },
    { x0: 3.6, x1: 8.1, name: 'MALAY FOOD', cn: 'Makanan Melayu', tag: 'Nasi lemak · Mee rebus', col: '#C98A06', kind: 'malay' },
  ];
  const CZ = -7.9, CD = .7, CH = .95; // counter centre z, depth, height
  // fascia over all stalls with the school name and a clock
  box(21.1, 1.1, .2, M.wall, -2.35, 3.65, -7.52);
  plane(9, .5, sign(512, 32, (c, w, h) => { c.fillStyle = '#1F3B2C'; c.fillRect(0, 0, w, h); L.lines(c, w, [[`${PL.SCHOOL.toUpperCase()} SCHOOL · CANTEEN`, 18, h / 2 + 1, '#F5E9C8']]); }, false), -7.5, 3.8, -7.41);
  const clock = cyl(.28, .28, .06, L.lam({ color: '#FFFFFF' }), 6, 3.7, -7.38); clock.rotation.x = Math.PI / 2;
  plane(.5, .5, sign(64, 64, (c) => { c.fillStyle = '#FFF'; c.beginPath(); c.arc(32, 32, 31, 0, TAU); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 3; c.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillStyle = '#222'; c.fillRect(32 + Math.sin(a) * 25 - 1, 32 - Math.cos(a) * 25 - 1, 2, 2); } c.lineWidth = 3; c.beginPath(); c.moveTo(32, 32); c.lineTo(32 + Math.sin(TAU * 12.67 / 12) * 14, 32 - Math.cos(TAU * 12.67 / 12) * 14); c.stroke(); c.lineWidth = 2; c.beginPath(); c.moveTo(32, 32); c.lineTo(32 + Math.sin(TAU * 41 / 60) * 22, 32 - Math.cos(TAU * 41 / 60) * 22); c.stroke(); }, false), 6, 3.7, -7.34);
  STALLS.forEach(S => {
    const w = S.x1 - S.x0, cx = (S.x0 + S.x1) / 2;
    // partitions, back tiles, counter, sneeze guard, lightbox sign
    box(.12, 3.1, 2.5, M.white, S.x0, 1.55, -8.75); box(.12, 3.1, 2.5, M.white, S.x1, 1.55, -8.75);
    plane(w, 2.2, M.tileW, cx, 1.1, Z0 + .02);
    box(w - .2, CH, CD, M.steel, cx, CH / 2, CZ); box(w - .16, .04, CD + .06, M.steelDark, cx, CH + .02, CZ);
    const guard = box(w - .3, .02, .5, M.glass, cx, 1.36, CZ + .12); guard.rotation.x = -.6;
    solid(S.x0 - .06, S.x1 + .06, CZ - CD / 2, CZ + CD / 2 + .05);
    plane(w - .25, .72, sign(320, 72, (c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.mix(S.col, .15)); g.addColorStop(1, L.mix(S.col, -.15)); c.fillStyle = g; c.fillRect(0, 0, W, H);
      L.lines(c, W, [[S.name, S.name.length > 12 ? 24 : 30, 26, '#FFFFFF'], [`${S.cn}  ·  ${S.tag}`, 12, 56, 'rgba(255,255,255,.9)', 'bold']]);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, H - 3, W, 3);
    }), cx, 2.82, -7.4);
    box(w - .2, .78, .14, M.dark, cx, 2.82, -7.49);
    // kitchen behind
    box(w - .4, .9, .6, M.steel, cx, .45, -9.55);
    box(Math.min(2.4, w - .6), .5, .8, M.steelDark, cx, 2.55, -9.5);
    if (S.kind === 'drinks') {
      const fridge = sign(64, 128, (c, W, H) => { c.fillStyle = '#20252A'; c.fillRect(0, 0, W, H); const r = L.rng(4); for (let y = 8; y < H - 10; y += 24) { c.fillStyle = '#9AA3AB'; c.fillRect(4, y + 18, W - 8, 2); for (let x = 6; x < W - 8; x += 7) { c.fillStyle = ['#E8423A', '#F5B300', '#2A8FD6', '#39A845', '#F07AA0'][Math.floor(r() * 5)]; c.fillRect(x, y + 4, 5, 14); } } c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, W / 3, H); });
      [-1.1, -.2].forEach(dx => { box(.8, 1.9, .6, M.steelDark, cx + dx, .95, -9.55); plane(.72, 1.8, fridge, cx + dx, .97, -9.24); });
      [['#E07A2A', 1], ['#7A4A2A', 1.4], ['#F29AB6', 1.8]].forEach(([col, dx]) => { cyl(.12, .12, .45, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .75 }), cx + dx - .4, CH + .27, CZ - .15); cyl(.13, .13, .05, M.dark, cx + dx - .4, CH + .52, CZ - .15); });
      for (let i = 0; i < 6; i++) cyl(.04, .035, .1, L.lam({ color: '#F4F4F0' }), cx - 1.6 + i * .09, CH + .06, CZ + .15);
      box(.3, .2, .25, M.dark, cx + 1.8, CH + .1, CZ - .1); plane(.22, .12, L.basic({ color: '#7FE0A0' }), cx + 1.8, CH + .12, CZ + .03);
      Wd.spots.till = [cx + 1.8, 1.1, CZ];
    } else if (S.kind === 'noodles') {
      [-1, .2].forEach(dx => { box(.8, .8, .6, M.dark, cx + dx, .4, -9.4); cyl(.26, .24, .4, M.steel, cx + dx, 1.0, -9.35, scene, 12); Wd.anim.push({ steam: [cx + dx, 1.25, -9.35] }); });
      for (let i = 0; i < 5; i++) { const g = L.foodGroup('noodle', 1, i); g.position.set(cx - .8 + i * .38, CH + .02, CZ - .12); scene.add(g); }
      Wd.spots.kitchen = (Wd.spots.kitchen || []).concat([[cx - .4, 1.1, -9.35]]);
    } else if (S.kind === 'malay') {
      ['sambal', 'rice', 'chicken', 'kailan'].forEach((id, i) => { box(.5, .05, .34, M.steelDark, cx - 1.2 + i * .6, CH + .03, CZ - .1); const g = L.foodGroup(id, 2.2, i + 9); g.position.set(cx - 1.2 + i * .6, CH + .05, CZ - .1); scene.add(g); });
    } else if (S.kind === 'healthy') {
      Wd.healthy = S;
      // the six pans, in serving order, over a steaming bain-marie
      const order = ['rice', 'chicken', 'kailan', 'cabbage', 'soup', 'melon'];
      Wd.pans = {};
      order.forEach((id, i) => {
        const x = S.x0 + .75 + i * .95;
        box(.78, .06, .42, M.steelDark, x, CH + .03, CZ - .1);
        if (id === 'soup') { cyl(.2, .18, .3, M.steel, x, CH + .18, CZ - .1, scene, 12); const liq = new THREE.Mesh(new THREE.CircleGeometry(.18, 12), foodTex('soup')); liq.rotation.x = -Math.PI / 2; liq.position.set(x, CH + .3, CZ - .1); scene.add(liq); Wd.anim.push({ steam: [x, CH + .35, CZ - .1] }); }
        else { const g = L.foodGroup(id, id === 'rice' ? 3.2 : 3, i); g.scale.set(2.6, 1.6, 2.1); g.position.set(x, CH + .06, CZ - .1); scene.add(g); }
        const ladle = cyl(.008, .008, .32, M.steel, x + .25, CH + .22, CZ - .15); ladle.rotation.z = .6;
        Wd.pans[id] = x;
        plane(.36, .09, sign(72, 18, (c, W, H) => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); L.lines(c, W, [[PL.DISH[id].name, 9, H / 2 + 1, '#1D1D1F']]); }, false), x, CH - .08, CZ + CD / 2 + .01);
      });
      Wd.spots.ladle = [cx, 1.2, CZ]; Wd.spots.kitchen = (Wd.spots.kitchen || []).concat([[cx + 1, 1.1, -9.4]]);
      // tray rail along the counter front
      box(w - .3, .025, .1, M.steel, cx, .9, CZ + CD / 2 + .08); box(w - .3, .025, .025, M.steel, cx, .9, CZ + CD / 2 + .18);
      Wd.railZ = CZ + CD / 2 + .13; Wd.railY = .915;
      // menu board and a Kailan Week card
      plane(2.6, 1.0, sign(260, 100, (c, W, H) => {
        c.fillStyle = '#1E2A22'; c.fillRect(0, 0, W, H);
        L.lines(c, W, [['TODAY’S SET  S$2.80', 15, 14, '#FFE08A']]);
        c.font = `bold 10px ${F}`; c.fillStyle = '#FFFFFF';
        PL.MENU.forEach((d, i) => c.fillText('• ' + d.name, 14 + (i % 2) * 124, 36 + Math.floor(i / 2) * 18));
        c.fillStyle = '#9FE0A8'; c.font = `bold 9px ${F}`; c.fillText('Less rice? Just ask. You can come back for more.', 14, 92);
      }), cx, 2.05, Z0 + .03);
      const kw = plane(.46, .62, sign(92, 124, (c, W, H) => { c.fillStyle = '#E3F6E5'; c.fillRect(0, 0, W, H); L.lines(c, W, [['KAILAN', 16, 22, '#2B8C43'], ['WEEK', 16, 40, '#2B8C43'], ['Try a bite,', 10, 62, '#1D1D1F', 'normal'], ['Loopi gets a', 10, 76, '#1D1D1F', 'normal'], ['quest point!', 10, 90, '#1D1D1F', 'normal']]); L.loopi(c, 46, 108, 22); }, false), S.x1 - .45, 1.28, CZ + .12);
      kw.rotation.x = -.6;
      Wd.posters.push({ mesh: kw, label: 'Read the Kailan Week card', at: [S.x1 - .45, 1.28, CZ + .2] });
      // tray stack on a trolley at the start of the line
      const stack = new THREE.Group(); stack.position.set(S.x0 - .05, 0, -6.95); scene.add(stack);
      box(.5, .06, .4, M.steelDark, 0, .78, 0, stack); [[-.22, -.17], [.22, -.17], [-.22, .17], [.22, .17]].forEach(([x, z]) => box(.03, .78, .03, M.steelDark, x, .39, z, stack));
      box(.46, .02, .36, M.steelDark, 0, .18, 0, stack);
      for (let i = 0; i < 12; i++) { const t = L.trayMesh(false); t.position.set(0, .81 + i * .024, 0); t.rotation.y = (i % 2 ? .02 : -.02); stack.add(t); }
      Wd.trayStack = stack; Wd.trayStackTop = () => stack.children.filter(o => o.isGroup).pop();
      solid(S.x0 - .32, S.x0 + .22, -7.17, -6.73);
    }
  });
  // everything north of the counters is off-limits except the station corner
  solid(X0, 8.25, Z0, CZ + CD / 2);

  /* ------------------------------------------------------------ PlateLoop station (north-east corner) */
  const st = Wd.station = new THREE.Group(); st.position.set(10.2, 0, -8.85); scene.add(st);
  Wd.stationStand = new THREE.Vector3(9.95, 1.55, -7.75);
  plane(3.1, 1.86, sign(450, 270, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2FA24E'); g.addColorStop(1, '#1E7A38'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(W * .85, H * .2, 30 + i * 26, 0, TAU); c.stroke(); }
    L.lines(c, W, [['PlateLoop', 34, 42, '#FFFFFF'], ['Every tray counts.', 14, 72, 'rgba(255,255,255,.92)', 'normal']]);
    const steps = [['1', 'Scan', 'full tray'], ['2', 'Eat', 'what you took'], ['3', 'Scan', 'again'], ['4', 'Compost', 'leftovers'], ['5', 'Return', 'your tray']];
    steps.forEach(([n, a, b], i) => {
      const x = 45 + i * 90, y = 130;
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill();
      L.lines(c, W, [[n, 22, y + 1, '#1E7A38', 'bold', x], [a, 13, y + 40, '#FFFFFF', 'bold', x], [b, 10, y + 56, 'rgba(255,255,255,.85)', 'normal', x]]);
      if (i < 4) { c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(x + 32, y - 5); c.lineTo(x + 40, y); c.lineTo(x + 32, y + 5); c.fill(); }
    });
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, H - 34, W, 34);
    L.lines(c, W, [['Your face signs you in. No cards. Photos never leave the scanner.', 11, H - 17, '#FFFFFF', 'normal']]);
  }), 9.85, 1.95, Z0 + .03);
  // floor mat in front of the scanner
  const mat = plane(1.7, 1, sign(170, 100, (c, W, H) => {
    c.fillStyle = '#2B8C43'; c.fillRect(0, 0, W, H); c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.strokeRect(5, 5, W - 10, H - 10);
    [[62, 44], [98, 44]].forEach(([x, y]) => { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x, y, 9, 18, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x, y + 26, 7, 8, 0, 0, TAU); c.fill(); });
    L.lines(c, W, [['STAND HERE · LOOK AT THE CAMERA', 9, 88, '#FFFFFF']]);
  }, false), 10.2, .006, -8.05); mat.rotation.x = -Math.PI / 2; mat.rotation.z = Math.PI;
  // floor lanes: green from the serving line, blue from the tables
  const arrow = (col, label) => sign(64, 64, (c, W, H) => { c.fillStyle = col; c.beginPath(); c.moveTo(32, 4); c.lineTo(58, 30); c.lineTo(42, 30); c.lineTo(42, 58); c.lineTo(22, 58); c.lineTo(22, 30); c.lineTo(6, 30); c.closePath(); c.fill(); if (label) L.lines(c, W, [[label, 8, 44, '#FFFFFF']]); }, false);
  const green = arrow('#2FA24E', 'SCAN'), blue = arrow('#2A7BD6', 'AFTER');
  const lane = (pts, m) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], a = Math.atan2(bx - ax, bz - az); const s = plane(.6, .6, m, ax, .007, az); s.rotation.set(-Math.PI / 2, 0, a + Math.PI); } };
  lane([[4.2, -6.7], [5.6, -6.8], [7, -6.9], [8.4, -7.2], [9.4, -7.6], [10, -7.9]], green);
  lane([[10.7, -2.6], [10.7, -3.9], [10.7, -5.2], [10.6, -6.5], [10.5, -7.6]], blue);
  // how-to standee
  const standee = new THREE.Group(); standee.position.set(8.85, 0, -8.35); standee.rotation.y = -.75; scene.add(standee);
  const how = sign(200, 300, (c, W, H) => {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); c.fillStyle = '#2B8C43'; c.fillRect(0, 0, W, 44);
    L.lines(c, W, [['HOW TO USE', 13, 14, 'rgba(255,255,255,.85)'], ['PlateLoop', 22, 32, '#FFFFFF']]);
    const rows = [['BEFORE YOU EAT', ''], ['1', 'Look at the camera'], ['2', 'Put your tray on the scale'], ['3', 'Wait for the beep'], ['AFTER YOU EAT', ''], ['4', 'Scan your tray again'], ['5', 'Scrape leftovers into the compost'], ['6', 'Return your tray on the rack']];
    let y = 66;
    rows.forEach(([n, t]) => {
      if (!t) { c.font = `bold 10px ${F}`; c.fillStyle = '#2B8C43'; c.fillText(n, 14, y); y += 20; return; }
      c.fillStyle = '#2B8C43'; c.beginPath(); c.arc(24, y - 4, 9, 0, TAU); c.fill(); c.fillStyle = '#FFF'; c.font = `bold 11px ${F}`; c.textAlign = 'center'; c.fillText(n, 24, y); c.textAlign = 'left';
      c.fillStyle = '#1D1D1F'; c.font = `11px ${F}`; c.fillText(t, 40, y); y += 26;
    });
    c.fillStyle = '#F2F2F7'; c.fillRect(10, H - 56, W - 20, 44); c.fillStyle = '#6E6E73'; c.font = `9px ${F}`;
    ['Take what you’ll finish.', 'You can always go back for more.', 'Questions? Ask Mr Rahman.'].forEach((t, i) => c.fillText(t, 18, H - 40 + i * 12));
  }, false);
  const panel = plane(.5, .75, how, 0, 1.05, .02, 0, standee); panel.rotation.x = -.12;
  box(.54, .8, .02, M.dark, 0, 1.05, -.005, standee).rotation.x = -.12;
  box(.03, .7, .03, M.dark, 0, .35, -.1, standee);
  solid(8.6, 9.1, -8.6, -8.1);
  Wd.standee = { mesh: panel, group: standee };
  // tray return rack beside the compost module
  const rack = Wd.rack = new THREE.Group(); rack.position.set(12.05, 0, -8.95); scene.add(rack);
  [[-.6, -.2], [.6, -.2], [-.6, .2], [.6, .2]].forEach(([x, z]) => box(.04, 1.6, .04, M.steelDark, x, .8, z, rack));
  Wd.rackShelves = [.3, .62, .94, 1.26];
  Wd.rackShelves.forEach((y, i) => { box(1.24, .02, .44, M.steel, 0, y, 0, rack); const n = [4, 3, 1, 0][i]; for (let k = 0; k < n; k++) { const t = L.trayMesh(true, i * 7 + k); t.position.set(-.35 + k * .02, y + .012 + k * .024, 0); t.rotation.y = Math.PI / 2 * 0 + (k % 2 ? .03 : -.03); rack.add(t); } });
  plane(1.25, .43, sign(260, 90, (c, W, H) => { c.fillStyle = '#1E6FB8'; c.fillRect(0, 0, W, H); L.lines(c, W, [['TRAY RETURN', 26, 34, '#FFFFFF'], ['Scrape into the compost first, then return your tray', 11, 66, 'rgba(255,255,255,.9)', 'normal']]); }), 12.1, 2.05, Z0 + .03);
  Wd.spots.rack = [12.05, 1, -8.95];
  solid(9.55, 12.75, -9.4, -8.55);
  // trolley of dirty trays next to the rack
  const trolley = new THREE.Group(); trolley.position.set(12.45, 0, -7.35); trolley.rotation.y = .2; scene.add(trolley);
  box(.5, .9, .7, M.steelDark, 0, .5, 0, trolley); for (let i = 0; i < 6; i++) { const t = L.trayMesh(true, 40 + i); t.position.set(0, .96 + i * .024, 0); t.rotation.y = Math.PI / 2; trolley.add(t); }
  solid(12.15, 12.75, -7.75, -6.95);
  // live stats screen on the east wall
  const tvCv = L.canvas(256, 144, () => {}), tvTex = L.texOf(tvCv, 1, 1, true);
  const tv = plane(1.6, .9, new THREE.MeshBasicMaterial({ map: tvTex }), X1 - .06, 2.2, -5.6, -Math.PI / 2);
  box(.06, .98, 1.68, M.dark, X1 - .03, 2.2, -5.6);
  Wd.tv = { mesh: tv, draw() {
    const c = tvCv.getContext('2d'), T = PL.S.today, tt = PL.todayTotals(), W = 256, H = 144;
    c.fillStyle = '#0F1512'; c.fillRect(0, 0, W, H); c.fillStyle = '#2B8C43'; c.fillRect(0, 0, W, 22);
    L.lines(c, W, [['PlateLoop LIVE · Canteen today', 11, 12, '#FFFFFF']]);
    const cell = (x, y, big, small, col) => { L.lines(c, W, [[big, 22, y, col, 'bold', x], [small, 9, y + 18, '#9AA59E', 'normal', x]]); };
    cell(46, 50, String(T.trays || 0), 'trays scanned', '#FFFFFF'); cell(128, 50, Math.round(tt.w * 100) + '%', 'left on trays', tt.w < .2 ? '#7FE0A0' : '#FFB35C'); cell(210, 50, ((T.co2 || 0) / 1000).toFixed(1) + ' kg', 'CO₂ saved', '#7FE0A0');
    const rows = PL.classRows().slice(0, 3); c.font = `bold 10px ${F}`;
    rows.forEach((row, i) => { c.fillStyle = row.c.id === '3B' ? '#FFE08A' : '#DDE5E0'; c.fillText(`${i + 1}. Class ${row.c.id}`, 22, 102 + i * 14); c.fillText(`${Math.round(row.red * 100)}% less waste`, 130, 102 + i * 14); });
    L.lines(c, W, [['CLASS LEAGUE', 8, 90, '#7FE0A0', 'bold', 60]]);
    tvTex.needsUpdate = true;
  } };
  Wd.tv.draw();

  /* ------------------------------------------------------------ dining area */
  const TX = [-9.4, -4.7, 0, 4.7, 9.6], TZ = [-3, 1, 5];
  TX.forEach(x => TZ.forEach(z => {
    if (x === 9.6 && z === -3) return;
    const t = new THREE.Group(); t.position.set(x, 0, z); scene.add(t);
    box(2.4, .05, .8, M.table, 0, .76, 0, t);
    [-1, 1].forEach(s => { box(.05, .74, .05, M.steelDark, s * 1.05, .37, -.3, t); box(.05, .74, .05, M.steelDark, s * 1.05, .37, .3, t); box(.05, .05, 1.5, M.steelDark, s * 1.05, .2, 0, t); });
    [-1, 1].forEach(s => box(2.4, .05, .3, M.bench, 0, .45, s * .72, t));
    solid(x - 1.25, x + 1.25, z - .92, z + .92);
    const spots = [];
    [-1, 1].forEach(side => [-.8, 0, .8].forEach(dx => spots.push({ x: x + dx, z: z + side * .72, side, taken: null })));
    Wd.tables.push({ group: t, x, z, spots });
  }));
  // pillars
  [-7.05, -2.35, 2.35, 7.05].forEach(x => [-1, 3].forEach(z => { cyl(.26, .26, H, M.pillar, x, H / 2, z, scene, 10); solid(x - .3, x + .3, z - .3, z + .3); }));
  // ceiling fans and fluorescent tubes
  TX.forEach(x => TZ.forEach(z => {
    const f = new THREE.Group(); f.position.set(x, 3.5, z); scene.add(f);
    cyl(.02, .02, .7, M.white, 0, .35, 0, f); cyl(.12, .1, .12, M.white, 0, 0, 0, f);
    const blades = new THREE.Group(); f.add(blades);
    for (let i = 0; i < 3; i++) { const b = box(.62, .01, .12, M.white, .36, -.02, 0, blades); const p = new THREE.Group(); p.rotation.y = i * TAU / 3; p.add(b); blades.add(p); }
    Wd.fans.push({ blades, speed: 5 + Math.random() * 1.5 });
  }));
  const tube = L.basic({ color: '#FBFBF4' });
  [-7.05, -2.35, 2.35, 7.05].forEach(x => [-5.3, -1, 3, 7].forEach(z => { box(1.25, .05, .1, M.white, x, H - .06, z); box(1.2, .03, .04, tube, x, H - .1, z - .025); box(1.2, .03, .04, tube, x, H - .1, z + .025); }));
  Wd.spots.fans = [[-4.7, 3.5, -3], [4.7, 3.5, -3], [0, 3.5, 1], [-9.4, 3.5, 5], [9.6, 3.5, 5]];
  Wd.spots.tables = Wd.tables.map(t => [t.x, t.z]);
  Wd.spots.crowd = [[-7, -3], [-2.3, -3], [2.3, 1], [-7, 5], [2.3, 5], [8, 3]];
  Wd.spots.outside = [[-14, 5, 20], [12, 5, 22], [0, 6, 28]];

  /* ------------------------------------------------------------ west wall: notice board, poster, sinks, cooler, bins */
  plane(1.9, 1.1, sign(190, 110, (c, W, H) => {
    c.fillStyle = '#B98F5E'; c.fillRect(0, 0, W, H); const r = L.rng(44);
    for (let i = 0; i < 9; i++) { const x = 8 + (i % 4) * 45 + r() * 6, y = 8 + Math.floor(i / 4) * 34 + r() * 5; c.fillStyle = ['#FFFFFF', '#FFF3B0', '#DDEBFF', '#FFE0E0'][i % 4]; c.fillRect(x, y, 36, 28); c.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 4; k++) c.fillRect(x + 4, y + 6 + k * 5, 18 + r() * 10, 1); c.fillStyle = '#D8322A'; c.fillRect(x + 16, y + 1, 3, 3); }
    c.strokeStyle = '#6B4A2A'; c.lineWidth = 6; c.strokeRect(0, 0, W, H);
  }, false), X0 + .04, 1.75, -3.6, Math.PI / 2);
  const plate = plane(.9, 1.2, sign(90, 120, (c, W, H) => {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); L.lines(c, W, [['MY HEALTHY', 11, 12, '#2B8C43'], ['PLATE', 11, 25, '#2B8C43']]);
    const cx = 45, cy = 70, rr = 30;
    [['#5CB85C', 0, Math.PI], ['#E8B24A', Math.PI, Math.PI * 1.5], ['#D9534F', Math.PI * 1.5, TAU]].forEach(([col, a, b]) => { c.fillStyle = col; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, rr, a, b); c.fill(); });
    c.strokeStyle = '#DDD'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, rr + 2, 0, TAU); c.stroke();
    c.font = `bold 7px ${F}`; c.fillStyle = '#FFF'; c.fillText('FRUIT & VEG', 25, 88); c.fillText('GRAINS', 20, 62); c.fillText('PROTEIN', 48, 62);
    L.lines(c, W, [['Half your plate', 8, 108, '#6E6E73', 'normal'], ['fruit and vegetables', 8, 116, '#6E6E73', 'normal']]);
  }, false), X0 + .04, 1.7, -1.4, Math.PI / 2);
  Wd.posters.push({ mesh: plate, label: 'Read the My Healthy Plate poster', at: [X0 + .04, 1.7, -1.4] });
  box(.55, .85, 1.9, M.white, X0 + .28, .425, 2.1); solid(X0, X0 + .6, 1.1, 3.1);
  [1.5, 2.1, 2.7].forEach(z => { const s = cyl(.17, .12, .08, L.lam({ color: '#DADDE0' }), X0 + .3, .86, z); s.scale.z = .9; cyl(.015, .015, .16, M.steel, X0 + .1, .96, z); box(.12, .02, .02, M.steel, X0 + .16, 1.04, z); });
  plane(1.8, .8, new THREE.MeshBasicMaterial({ color: '#AFC3CC' }), X0 + .03, 1.6, 2.1, Math.PI / 2);
  box(.4, 1.3, .4, L.lam({ color: '#E8ECEF' }), X0 + .25, .65, 4.2); box(.3, .12, .02, L.basic({ color: '#4F9BD9' }), X0 + .46, 1.05, 4.2).rotation.y = Math.PI / 2; solid(X0, X0 + .5, 3.95, 4.45);
  [[X0 + .3, 6.4], [X0 + .3, -5.4], [X1 - .3, 6.4]].forEach(([x, z]) => { cyl(.22, .19, .7, L.lam({ color: '#2E7D4F' }), x, .35, z); cyl(.23, .23, .04, M.dark, x, .72, z); solid(x - .25, x + .25, z - .25, z + .25); });
  /* ------------------------------------------------------------ east wall: Kailan banner, league poster, vending machine */
  plane(2.2, .6, sign(220, 60, (c, W, H) => { c.fillStyle = '#2B8C43'; c.fillRect(0, 0, W, H); L.lines(c, W, [['KAILAN WEEK', 20, 24, '#FFFFFF'], ['One bite = one quest point for your Loopi', 10, 46, 'rgba(255,255,255,.9)', 'normal']]); L.loopi(c, 200, 30, 26); }, false), X1 - .04, 2.9, -1.8, -Math.PI / 2);
  plane(.8, 1.1, sign(80, 110, (c, W, H) => { c.fillStyle = '#FFF9E8'; c.fillRect(0, 0, W, H); L.lines(c, W, [['CLASS', 11, 14, '#C98A06'], ['LEAGUE', 11, 27, '#C98A06']]); c.font = `bold 9px ${F}`; PL.classRows().forEach((row, i) => { c.fillStyle = row.c.id === '3B' ? '#2B8C43' : '#333'; c.fillText(`${i + 1}. ${row.c.id}`, 14, 48 + i * 10); c.fillText(`${Math.round(row.red * 100)}%`, 52, 48 + i * 10); }); }, false), X1 - .04, 1.7, .9, -Math.PI / 2);
  const vm = new THREE.Group(); vm.position.set(X1 - .45, 0, 3.6); vm.rotation.y = -Math.PI / 2; scene.add(vm);
  box(.9, 1.85, .75, L.lam({ color: '#C8322A' }), 0, .925, 0, vm);
  plane(.6, 1.2, sign(60, 120, (c, W, H) => { c.fillStyle = '#12181E'; c.fillRect(0, 0, W, H); const r = L.rng(9); for (let y = 8; y < H - 8; y += 20) for (let x = 6; x < W - 6; x += 12) { c.fillStyle = ['#E8423A', '#F5B300', '#2A8FD6', '#39A845', '#FFFFFF'][Math.floor(r() * 5)]; c.fillRect(x, y, 8, 14); } c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(0, 0, W / 3, H); }), -.08, 1.1, .38, 0, vm);
  solid(X1 - .9, X1, 3.1, 4.1);

  /* ------------------------------------------------------------ atmosphere: sun shafts, dust, steam */
  const shaft = new THREE.MeshBasicMaterial({ color: '#FFF1CF', transparent: true, opacity: .05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, map: L.tex(16, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }) });
  [-10.8, -6.4, -2.1, 2.1, 6.4, 10.8].forEach(x => { const s = plane(3.4, 6.5, shaft, x, 2.2, 6.2, 0); s.rotation.set(-.95, 0, 0); });
  const dustN = 380, dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = (Math.random() - .5) * 25; dp[i * 3 + 1] = Math.random() * 3.8; dp[i * 3 + 2] = -6 + Math.random() * 15; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#FFF3D6', size: 1.5, sizeAttenuation: false, transparent: true, opacity: .45, depthWrite: false })); scene.add(dust);
  const puff = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .16, depthWrite: false, map: L.tex(32, 32, (c) => L.blob(c, 16, 16, 15, 15, '#FFFFFF', 1)) });
  const steams = [];
  Wd.anim.filter(a => a.steam).forEach(a => { for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(.35, .35), puff); s.position.set(...a.steam); s.userData = { base: a.steam, ph: i / 5 }; scene.add(s); steams.push(s); } });

  Wd.update = (dt, t, cam) => {
    Wd.fans.forEach(f => { f.blades.rotation.y += dt * f.speed; });
    for (let i = 0; i < dustN; i++) { dp[i * 3 + 1] += Math.sin(t * .3 + i) * .0015; dp[i * 3] += Math.cos(t * .2 + i * 1.7) * .001; }
    dg.attributes.position.needsUpdate = true;
    steams.forEach(s => { const k = (t * .35 + s.userData.ph) % 1, [x, y, z] = s.userData.base; s.position.set(x + Math.sin(t + k * 6) * .05, y + k * .9, z); s.scale.setScalar(.5 + k * 1.3); s.material.opacity = .16; s.quaternion.copy(cam.quaternion); });
  };
  Wd.bounds = (x, z) => x > X0 + .35 && x < X1 - .35 && z < Z1 - .35 && (z > CZ + CD / 2 + .3 || (x > 8.4 && z > -9.3));
  return Wd;
};
})();
