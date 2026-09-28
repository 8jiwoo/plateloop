/* PlateLoop Prototype: the scanner as a product launch. One full-screen, explorable 3D scanner with glowing
   hotspots on the hardware. Picking one flies the camera to that part, lights it and fades the rest, and a glass
   panel explains it. The display's panel opens the real PlateLoop Kiosk, running on the scanner's own screen.
   This replaces the old product page and the separate Kiosk app. */
(() => {
'use strict';
const { $, $$, esc } = PL;
const TAU = Math.PI * 2;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, k) => a + (b - a) * k;

/* ================================================================ the parts you can explore
   anchor/normal are in the scanner's own space (metres, y up, front = +z). view is where the camera goes:
   target, azimuth (theta, around y from +z), polar angle (phi, from straight up) and distance. */
const PARTS = [
  { id: 'depth', name: 'Depth camera', line: 'Sees every dish in 3D', anchor: [0, 1.594, .05], normal: [0, -.6, .8],
    view: { target: [0, 1.56, .02], theta: -.42, phi: 1.82, r: 1.23 },
    what: 'Recognises each food on the tray and measures how much of it there is.',
    how: 'A colour camera picks out today’s dishes while two infrared cameras and a dot projector map the height of the food in every compartment, 0.62 m below. Height over each compartment gives volume, and volume gives grams.',
    why: 'Looking straight down, no compartment wall hides food. Because the menu is known, the AI only chooses between a handful of dishes, so it’s quick and accurate.',
    spec: 'RGB-D · 1280 × 720 depth · 0.62 m above the tray' },
  { id: 'face', name: 'Face camera', line: 'Sign in by looking up', from: 'faceLens', anchor: [-.262, 1.285, .126], normal: [0, .2, 1],
    view: { target: [-.262, 1.27, .15], theta: -.12, phi: 1.42, r: 1.07 },
    what: 'Knows whose tray it is, hands-free, before and after lunch.',
    how: 'An infrared camera and two IR emitters see faces even in a dim canteen. The chip inside turns a face into a match code and compares it in under a second. The small green light shows when it’s looking.',
    why: 'No cards to lose and no phones in a lunch queue. No photo is ever stored, only the match code, and it never leaves the scanner. Anyone who opts out types their register number instead.',
    spec: 'IR + RGB · under 1 s · on-device only' },
  { id: 'display', name: 'Touch display', line: 'Guides every scan', from: 'screenCorner', anchor: [-.2, 1.15, .15], normal: [0, .26, 1],
    view: { target: [-.262, 1.2, .14], theta: -.26, phi: 1.36, r: 1.37 },
    what: 'Shows the three steps, then what you ate, your nutrition and the CO₂ your tray saved.',
    how: 'A 10.1-inch touchscreen runs PlateLoop Kiosk. It leans back 15° toward someone holding a tray, and has a number keypad for anyone who doesn’t use face sign-in.',
    why: 'Instant feedback turns a chore into a moment: students see the effect of leaving less, right there at the tray rack.',
    spec: '10.1″ · 1280 × 800 · leans back 15°', action: 'Try the kiosk' },
  { id: 'platform', name: 'Weighing platform', line: 'Checks the camera', anchor: [.215, .934, .17], normal: [0, 1, .5],
    view: { target: [.02, .94, .05], theta: .28, phi: .92, r: 1.62 },
    what: 'Weighs the whole tray, before and after lunch.',
    how: 'Four load cells under the aluminium plate measure to ±2 g. The scanner waits for the weight to settle, so a hand still resting on the tray never gets recorded.',
    why: 'Two independent measurements of the same tray. If the camera and the scale disagree by more than 10%, the scanner simply scans again.',
    spec: '0–5 kg · ±2 g · 4 load cells' },
  { id: 'led', name: 'Status light', line: 'Tells you when', anchor: [.2, .872, .263], normal: [0, 0, 1],
    view: { target: [0, .85, .2], theta: .08, phi: 1.5, r: 1.43 },
    what: 'A thin light bar that shows what the scanner is doing.',
    how: 'Steady green means ready. A slow pulse means scanning, so hold still. Two quick blinks and a chime mean done.',
    why: 'In a noisy lunch queue, a light you can catch from the corner of your eye keeps the line moving at about two seconds a tray.',
    spec: 'Diffused LED · 3 states' },
  { id: 'ai', name: 'Edge AI and cooling', line: 'Thinks on the device', anchor: [-.322, .36, .05], normal: [-1, 0, 0],
    view: { target: [-.3, .44, 0], theta: -1.1, phi: 1.42, r: 1.76 },
    what: 'The computer inside the cabinet that runs the vision and face models.',
    how: 'An edge AI module processes each scan in about 1.4 seconds, cooled by quiet vents along the side. If the Wi-Fi drops, results wait in a queue and sync when it’s back.',
    why: 'Photos never leave the scanner: only grams per dish and a tray number are sent. And it keeps scanning when the network doesn’t.',
    spec: 'Edge AI module · offline queue · one socket' },
  { id: 'bin', name: 'Food waste bin', line: 'Weighs what’s left over', anchor: [.51, .872, .09], normal: [0, 1, .4],
    view: { target: [.51, .78, .05], theta: .45, phi: 1.12, r: 1.76 },
    what: 'Where scraps go after the second scan.',
    how: 'A load cell under the 60-litre bin weighs scraps as they drop in, and the fill bar on the front lights up as it fills. The Kitchen app sees the level live.',
    why: 'The kitchen gets total food waste for every lunch without anyone weighing bins by hand, and knows when to empty it before it overflows.',
    spec: '60 L · load cell · fill sensor' },
];
const HERO = { target: [.12, .86, 0], theta: -.36, phi: 1.3 };
const SCREEN = { w: .2176, h: .136 }; // 10.1″ at 16:10

let root = null, X = null;

/* ================================================================ sound: only air. Every cue is filtered white noise:
   quick, soft swishes that sweep up or down and move left or right, with no tones and no rumble. */
function makeAudio() {
  const A = { ctx: null, on: true, air: null };
  try { A.on = localStorage.getItem('plateloop-xp-sound') !== 'off'; } catch (e) {}
  const VOL = .7;
  const ctx = () => {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const c = A.ctx = new AC();
    // master: a gentle top cut and a soft compressor keep every swish smooth and even
    const master = A.master = c.createGain(); master.gain.value = A.on ? VOL : 0;
    const top = c.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = 9000; top.Q.value = .5;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3; comp.attack.value = .003; comp.release.value = .2;
    master.connect(top).connect(comp).connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    // the air that follows the scanner as you turn it
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; hp.Q.value = .4;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = .3;
    const g = c.createGain(); g.gain.value = 0; const pn = c.createStereoPanner();
    src.connect(hp).connect(lp).connect(g).connect(pn).connect(master); src.start();
    A.air = { lp, g, pn };
    return c;
  };
  A.wake = () => { const c = ctx(); if (c && c.state === 'suspended') c.resume(); };
  A.setOn = on => { A.on = on; try { localStorage.setItem('plateloop-xp-sound', on ? 'on' : 'off'); } catch (e) {} if (A.master) A.master.gain.setTargetAtTime(on ? VOL : 0, A.ctx.currentTime, .05); };
  /** rotation: speed 0..1, dir -1..1 */
  A.rotate = (speed, dir) => {
    if (!A.air) return; const t = A.ctx.currentTime, k = Math.min(1, speed);
    A.air.g.gain.setTargetAtTime(k * k * .1, t, .12);
    A.air.lp.frequency.setTargetAtTime(1500 + k * 5500, t, .12);
    A.air.pn.pan.setTargetAtTime(Math.max(-.7, Math.min(.7, dir)), t, .2);
  };
  /** one swish of air: the band sweeps f0 → f1 while it pans p0 → p1; it swells to vol at `at` of its length */
  const swish = ({ dur, vol, f0, f1, q = .8, p0 = 0, p1 = p0, at = .3, delay = 0 }) => {
    const c = A.ctx; if (!c || !A.on) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = A.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * at); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const pn = c.createStereoPanner(); pn.pan.setValueAtTime(p0, t); pn.pan.linearRampToValueAtTime(p1, t + dur);
    s.connect(bp).connect(hp).connect(g).connect(pn).connect(A.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
  };
  let lastZoom = 0;
  A.zoom = (inward, pan) => { const now = performance.now(); if (now - lastZoom < 90) return; lastZoom = now; swish({ dur: .11, vol: .05, f0: inward ? 2600 : 4200, f1: inward ? 4200 : 2600, q: 1, p0: pan }); };
  A.fly = (pan, up = true) => {
    swish({ dur: .8, vol: .16, f0: up ? 700 : 3200, f1: up ? 3200 : 700, q: .7, p0: -pan, p1: pan, at: .4 });
    swish({ dur: .45, vol: .035, f0: up ? 4500 : 6500, f1: up ? 6500 : 4500, q: 1.2, p0: -pan, p1: pan, delay: .22 });
  };
  A.select = pan => { swish({ dur: .22, vol: .1, f0: 1400, f1: 5600, q: 1.1, p0: pan, at: .25 }); swish({ dur: .5, vol: .028, f0: 3600, f1: 2400, q: 1.4, p0: pan, delay: .12 }); };
  A.close = () => swish({ dur: .3, vol: .07, f0: 4800, f1: 1000, q: 1, at: .2 });
  A.hover = pan => swish({ dur: .07, vol: .014, f0: 5200, f1: 6400, q: 1.6, p0: pan });
  A.power = () => { swish({ dur: 1.3, vol: .1, f0: 350, f1: 3400, q: .6, at: .6 }); swish({ dur: .7, vol: .03, f0: 5200, f1: 3800, q: 1.3, delay: .8 }); };
  A.close2 = () => { if (A.ctx) A.ctx.close(); };
  return A;
}

/* ================================================================ materials and shapes */
function brushed() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#b8bcc0'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const y = Math.random() * 256, a = Math.random() * .045; x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '40,44,48'},${a})`; x.fillRect(0, y, 256, Math.random() * .8 + .2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.anisotropy = 8; return t;
}
function makeMats() {
  const BR = brushed();
  return {
    white: () => new THREE.MeshPhysicalMaterial({ color: 0xF0F0ED, roughness: .5, metalness: 0, clearcoat: .22, clearcoatRoughness: .45 }),
    alu: () => new THREE.MeshStandardMaterial({ color: 0xE6E9EC, roughness: .34, metalness: .7, map: BR, roughnessMap: BR, envMapIntensity: 1.5 }),
    glass: () => new THREE.MeshPhysicalMaterial({ color: 0x08090A, roughness: .07, metalness: .15, clearcoat: 1, clearcoatRoughness: .02 }),
    graphite: () => new THREE.MeshStandardMaterial({ color: 0x1C1E20, roughness: .62, metalness: .25 }),
    groove: () => new THREE.MeshStandardMaterial({ color: 0x8C8F90, roughness: .9 }),
    tray: () => new THREE.MeshPhysicalMaterial({ color: 0xE9ECEA, roughness: .38, clearcoat: .5, clearcoatRoughness: .2 }),
    led: (c = 0x4DFFA0) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }),
    lens: () => new THREE.MeshPhysicalMaterial({ color: 0x0B1422, roughness: .02, metalness: .6, clearcoat: 1 }),
    food: c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .55, clearcoat: .25 }),
  };
}
/** A box with rounded edges (r) and rounder vertical corners (rc), centred on the origin. */
function rbox(w, h, d, r = .01, rc = r * 2) {
  const b = Math.max(0, Math.min(r, w / 2 - .0005, h / 2 - .0005, d / 2 - .0005));
  const iw = w - 2 * b, ih = h - 2 * b, c = Math.max(0, Math.min(rc, iw / 2 - .0002, ih / 2 - .0002)), x = -iw / 2, y = -ih / 2, s = new THREE.Shape();
  s.moveTo(x + c, y); s.lineTo(x + iw - c, y); s.quadraticCurveTo(x + iw, y, x + iw, y + c); s.lineTo(x + iw, y + ih - c);
  s.quadraticCurveTo(x + iw, y + ih, x + iw - c, y + ih); s.lineTo(x + c, y + ih); s.quadraticCurveTo(x, y + ih, x, y + ih - c); s.lineTo(x, y + c); s.quadraticCurveTo(x, y, x + c, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.0002, d - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 8 });
  g.center(); return g;
}
const glowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return (t = new THREE.CanvasTexture(c)); }; })();

/** The screen's resting picture (the real kiosk takes over in kiosk mode). */
function screenTex() {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 800; const x = c.getContext('2d');
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 1280, 800);
  x.fillStyle = '#8E8E93'; x.font = '600 22px Inter, system-ui, sans-serif'; x.fillText('11:48', 40, 48); x.textAlign = 'right'; x.fillText('●  Connected to Kitchen', 1240, 48); x.textAlign = 'left';
  // the Green Tree
  x.fillStyle = '#EAF6EC'; x.beginPath(); x.roundRect ? x.roundRect(90, 150, 330, 300, 34) : x.rect(90, 150, 330, 300); x.fill();
  x.fillStyle = '#8B5E3C'; x.fillRect(243, 360, 24, 60);
  [[340, 70], [300, 56], [262, 40], [228, 24]].forEach(([y, w], i) => { x.fillStyle = i % 2 ? '#34A853' : '#2E9447'; x.beginPath(); x.moveTo(255 - w * 2, y + 24); x.lineTo(255, y - 44); x.lineTo(255 + w * 2, y + 24); x.fill(); });
  x.fillStyle = '#FF3B30'; [[220, 330], [290, 310], [250, 270], [230, 230], [285, 250]].forEach(([a, b]) => x.fillRect(a, b, 12, 12));
  x.fillStyle = '#34C759'; x.font = '600 26px Inter, system-ui, sans-serif'; x.fillText('PlateLoop', 520, 200);
  x.fillStyle = '#1D1D1F'; x.font = '700 76px Inter, system-ui, sans-serif'; x.fillText('Scan your tray.', 516, 290);
  x.fillStyle = '#6E6E73'; x.font = '400 28px Inter, system-ui, sans-serif'; x.fillText('Once before lunch and once after.', 520, 350); x.fillText('Every clean tray grows a fruit.', 520, 390);
  x.fillStyle = '#F5F5F7'; x.beginPath(); x.roundRect ? x.roundRect(40, 590, 1200, 170, 30) : x.rect(40, 590, 1200, 170); x.fill();
  ['Look at the camera', 'Place your tray', 'Wait for the chime'].forEach((s, i) => {
    const ox = 60 + i * 395; x.fillStyle = i === 0 ? '#FFFFFF' : 'rgba(0,0,0,0)'; x.beginPath(); x.roundRect ? x.roundRect(ox, 608, 375, 134, 22) : x.rect(ox, 608, 375, 134); x.fill();
    x.fillStyle = i === 0 ? '#34C759' : '#FFFFFF'; x.beginPath(); x.roundRect ? x.roundRect(ox + 20, 636, 78, 78, 18) : x.rect(ox + 20, 636, 78, 78); x.fill();
    x.fillStyle = i === 0 ? '#1D1D1F' : '#8E8E93'; x.font = `${i === 0 ? 700 : 600} 28px Inter, system-ui, sans-serif`; x.fillText(s, ox + 116, 686);
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
}
function labelTex(text, size, color, w = 512, h = 96, weight = 600) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = color; x.font = `${weight} ${size}px Inter, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '2px'; x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

/* ================================================================ the scanner, part by part */
function buildScanner(M) {
  const S = new THREE.Group(), groups = {}, leds = [];
  const part = id => { const g = new THREE.Group(); g.userData.part = id; S.add(g); groups[id] = g; return g; };
  const add = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  const body = part('body');

  /* --- cabinet: 0.64 × 0.86 × 0.52 on a recessed plinth --- */
  add(body, rbox(.6, .05, .48, .008, .03), M.graphite(), 0, .025, 0);
  add(body, rbox(.64, .86, .52, .02, .045), M.white(), 0, .48, 0);
  // the door: four thin grooves, and the etched logo
  const gr = M.groove();
  [[0, .815, .5, .003], [0, .145, .5, .003]].forEach(([x, y, w, h]) => add(body, new THREE.BoxGeometry(w, h, .002), gr, x, y, .2605, 0, 0, 0, false));
  [[-.25, .48], [.25, .48]].forEach(([x, y]) => add(body, new THREE.BoxGeometry(.003, .67, .002), gr, x, y, .2605, 0, 0, 0, false));
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(.2, .0375), new THREE.MeshStandardMaterial({ map: labelTex('PlateLoop', 58, '#A9ACAD', 512, 96, 600), transparent: true, roughness: .6 }));
  logo.position.set(0, .3, .2615); body.add(logo);
  // rear vents
  for (let i = 0; i < 9; i++) add(body, rbox(.36, .008, .004, .0015, .003), M.graphite(), 0, .2 + i * .028, -.2605, 0, 0, 0, false);
  // black glass deck on top
  add(body, rbox(.61, .014, .49, .004, .03), M.glass(), 0, .913, 0);

  /* --- status light bar, just under the deck --- */
  const led = part('led');
  const bar = add(led, rbox(.5, .006, .004, .002, .003), M.led(), 0, .872, .2612, 0, 0, 0, false); leds.push(bar);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x3DFF8E, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(.62, .07, 1); halo.position.set(0, .872, .268); led.add(halo); leds.push(halo);

  /* --- weighing platform, the tray and today's lunch --- */
  const plat = part('platform');
  add(plat, rbox(.47, .012, .35, .003, .02), M.alu(), 0, .927, .02);
  [[-.2, -.13], [.2, -.13], [-.2, .17], [.2, .17]].forEach(([x, z]) => add(plat, new THREE.CylinderGeometry(.006, .006, .003, 16), M.graphite(), x, .9345, z, 0, 0, 0, false));
  const trayG = new THREE.Group(); trayG.position.set(0, .936, .02); plat.add(trayG);
  add(trayG, rbox(.4, .012, .29, .004, .02), M.tray(), 0, .006, 0);
  const tm = M.tray();
  [[-.2, 0, .004, .29], [.2, 0, .004, .29]].forEach(([x, z, w, d]) => add(trayG, new THREE.BoxGeometry(w, .024, d), tm, x, .018, z, 0, 0, 0, false));
  [[0, -.145, .4, .004], [0, .145, .4, .004], [0, 0, .4, .004]].forEach(([x, z, w, d]) => add(trayG, new THREE.BoxGeometry(w, .024, d), tm, x, .018, z, 0, 0, 0, false));
  [-.0667, .0667].forEach(x => add(trayG, new THREE.BoxGeometry(.004, .024, .29), tm, x, .018, 0, 0, 0, 0, false));
  const FOOD = [[0x3F8B3A, -.133, -.072, .04], [0xD8E6A8, 0, -.072, .034], [0xF2545B, .133, -.072, .036], [0xF3EDDA, -.133, .072, .046], [0x9C5A2E, 0, .072, .04], [0xE8A25C, .133, .072, .042]];
  FOOD.forEach(([c, x, z, r]) => { const m = add(trayG, new THREE.SphereGeometry(r, 24, 14), M.food(c), x, .012, z); m.scale.set(1, .32, .82); });

  /* --- the column and the camera arm: machined, with crisp edges and fine split lines --- */
  const arm = part('arm');
  add(arm, rbox(.068, .69, .068, .0025, .007), M.alu(), 0, 1.262, -.205);
  // a dark gasket where the column meets the arm
  add(arm, rbox(.072, .004, .072, .001, .008), M.graphite(), 0, 1.599, -.205, 0, 0, 0, false);
  // the arm: a flat-topped bar, barely softened at the edges
  add(arm, rbox(.1, .04, .34, .0025, .005), M.alu(), 0, 1.621, -.075);
  // split lines along both sides, and a flush black glass face at the front
  [-1, 1].forEach(sx => add(arm, new THREE.BoxGeometry(.0012, .0016, .31), M.graphite(), sx * .0502, 1.621, -.07, 0, 0, 0, false));
  add(arm, rbox(.092, .032, .002, .0008, .004), M.glass(), 0, 1.621, .0955, 0, 0, 0, false);

  /* --- the depth camera module, flush under the arm --- */
  const dep = part('depth');
  add(dep, rbox(.088, .005, .15, .001, .006), M.glass(), 0, 1.5985, .02);
  const LY = 1.5955; // just below the glass
  [-.034, .034].forEach(z => { add(dep, new THREE.CylinderGeometry(.0105, .0105, .0015, 40), M.graphite(), 0, LY, z); add(dep, new THREE.CylinderGeometry(.0072, .0072, .002, 40), M.lens(), 0, LY - .0005, z); });
  add(dep, new THREE.CylinderGeometry(.0125, .0125, .0015, 40), M.graphite(), 0, LY, 0);
  add(dep, new THREE.CylinderGeometry(.0085, .0085, .002, 40), M.lens(), 0, LY - .0005, 0);
  const ring = add(dep, new THREE.TorusGeometry(.0142, .0008, 8, 48), M.led(), 0, LY + .0004, 0, Math.PI / 2, 0, 0, false); leds.push(ring);
  [[.024, .06], [-.024, .06]].forEach(([x, z]) => add(dep, new THREE.CylinderGeometry(.003, .003, .0015, 20), M.led(0x5A1010), x, LY, z));
  // status line in the black glass face at the front of the arm
  const astrip = add(dep, new THREE.BoxGeometry(.05, .0022, .001), M.led(), 0, 1.621, .0969, 0, 0, 0, false); leds.push(astrip);
  // the scan beam, shown while scanning
  const beamM = new THREE.MeshBasicMaterial({ color: 0x46FF9A, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(.3, .63, 4, 1, true), beamM); beam.userData.part = 'beam'; beam.position.set(0, 1.279, .02); beam.rotation.y = Math.PI / 4; beam.scale.set(1, 1, .72); S.add(beam);

  /* --- display on its stand, leaning back 15° --- */
  const disp = part('display');
  add(disp, new THREE.CylinderGeometry(.013, .016, .2, 24), M.alu(), -.262, 1.02, .12);
  add(disp, new THREE.CylinderGeometry(.04, .044, .008, 32), M.alu(), -.262, .924, .12);
  // yaw last, so the screen seen straight on is an upright rectangle (the kiosk overlay lines up exactly)
  const head = new THREE.Group(); head.position.set(-.262, 1.2, .14); head.rotation.order = 'YXZ'; head.rotation.set(-.26, .16, 0); disp.add(head);
  add(head, rbox(.245, .164, .016, .005, .012), M.white(), 0, 0, -.004);
  add(head, rbox(.239, .158, .004, .0015, .01), M.glass(), 0, 0, .0045);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false }));
  scr.position.set(0, -.002, .0068); head.add(scr);
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(.239, .158), new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: .06, roughness: 0, clearcoat: 1 }));
  glare.position.set(0, 0, .0071); head.add(glare);

  /* --- the face camera bar on top of the display --- */
  const face = part('face');
  const fbar = new THREE.Group(); head.add(fbar); fbar.position.set(0, .088, .0);
  // parent the bar to the display head, but keep it in the 'face' part for highlighting
  const fb = add(fbar, rbox(.1, .017, .018, .005, .008), M.glass(), 0, 0, 0);
  const fl1 = add(fbar, new THREE.CylinderGeometry(.0045, .0045, .003, 24), M.lens(), 0, 0, .0095, Math.PI / 2);
  const fl2 = add(fbar, new THREE.CylinderGeometry(.0022, .0022, .003, 16), M.led(0x611515), -.024, 0, .0093, Math.PI / 2);
  const fl3 = add(fbar, new THREE.CylinderGeometry(.0022, .0022, .003, 16), M.led(0x611515), .024, 0, .0093, Math.PI / 2);
  const fled = add(fbar, new THREE.SphereGeometry(.0013, 10, 8), M.led(), .036, 0, .0095); leds.push(fled);
  [fb, fl1, fl2, fl3, fled].forEach(m => { m.userData.part = 'face'; });
  // where the hotspots for these two sit: the lens, and the screen's lower-right corner
  const corner = new THREE.Object3D(); corner.position.set(SCREEN.w / 2 - .018, -SCREEN.h / 2 + .012, .008); head.add(corner);

  /* --- side vents over the AI module --- */
  const ai = part('ai');
  for (let i = 0; i < 12; i++) add(ai, rbox(.004, .007, .28, .0015, .003), M.graphite(), -.3215, .22 + i * .024, .02, 0, 0, 0, false);
  const aiLed = add(ai, new THREE.SphereGeometry(.003, 12, 8), M.led(), -.3222, .54, .15); leds.push(aiLed);

  /* --- food waste bin --- */
  const bin = part('bin');
  add(bin, rbox(.32, .05, .42, .008, .03), M.graphite(), .51, .025, 0);
  add(bin, rbox(.34, .8, .44, .02, .045), M.white(), .51, .45, 0);
  add(bin, rbox(.33, .014, .43, .004, .035), M.glass(), .51, .857, 0);
  add(bin, new THREE.TorusGeometry(.098, .007, 16, 64), M.alu(), .51, .865, .02, Math.PI / 2);
  add(bin, new THREE.CylinderGeometry(.094, .094, .004, 48), new THREE.MeshStandardMaterial({ color: 0x050606, roughness: .9 }), .51, .862, .02);
  const blabel = new THREE.Mesh(new THREE.PlaneGeometry(.14, .026), new THREE.MeshStandardMaterial({ map: labelTex('FOOD WASTE', 44, '#A9ACAD', 512, 96, 600), transparent: true, roughness: .6 }));
  blabel.position.set(.51, .3, .2205); bin.add(blabel);
  // fill bar: five little lights, three on
  for (let i = 0; i < 5; i++) { const m = add(bin, rbox(.03, .005, .003, .0015, .002), i < 3 ? M.led() : M.graphite(), .51 - .07 + i * .035, .8, .2208, 0, 0, 0, false); if (i < 3) leds.push(m); }
  [[0, .815, .28], [0, .145, .28]].forEach(([, y, w]) => add(bin, new THREE.BoxGeometry(w, .003, .002), M.groove(), .51, y, .2205, 0, 0, 0, false));

  beam.userData.skip = true;
  return { S, groups, leds, beam, screen: scr, head, marks: { faceLens: fl1, screenCorner: corner } };
}

/* ================================================================ the studio: reflections, floor, lights */
function studio(renderer, scene) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(.05, .055, .06), side: THREE.BackSide })));
  const panel = (w, h, x, y, z, rx, ry, k, tint = [1, 1, 1]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k * tint[0], k * tint[1], k * tint[2]), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  panel(9, 4, 0, 6.9, 1, Math.PI / 2, 0, 3.4);             // big softbox overhead
  panel(3, 7, -11.9, 2.5, 2, 0, Math.PI / 2, 2.4);          // tall strip, left
  panel(3, 7, 11.9, 2.5, -3, 0, -Math.PI / 2, 1.3);         // tall strip, right
  panel(10, 1.2, 0, 1.2, -11.9, 0, 0, 1.0);                 // low strip behind
  panel(2, 5, 7, 2, 11.9, 0, Math.PI, 1.6);                 // fill, front right
  panel(12, .6, 0, -.2, 11.9, 0, Math.PI, .45, [.4, 1, .65]); // a faint emerald floor bounce
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(s, .025); pm.dispose();
  scene.environment = rt.texture;

  const key = new THREE.DirectionalLight(0xFFFFFF, 1.35); key.position.set(1.6, 4.2, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -1.3, right: 1.6, top: 2, bottom: -1, near: .5, far: 9 }); key.shadow.bias = -.0004; key.shadow.normalBias = .01; key.shadow.radius = 5;
  key.target.position.set(.15, .6, 0); scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xDDE8FF, .55); rim.position.set(-2.5, 2.2, -2.8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x1A1D1C, .18));
  const focus = new THREE.PointLight(0xFFFFFF, 0, 1.1, 1.6); scene.add(focus);

  // floor: soft shadows, a pool of light and an emerald wash from the status bar
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: .42 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x2B302E, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(.2, .001, .1); scene.add(pool);
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .5), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x1FA85A, transparent: true, opacity: .42, depthWrite: false, blending: THREE.AdditiveBlending }));
  wash.rotation.x = -Math.PI / 2; wash.position.set(0, .002, .36); scene.add(wash);
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(1.35, .78), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x000000, transparent: true, opacity: .75, depthWrite: false }));
  ao.rotation.x = -Math.PI / 2; ao.position.set(.25, .003, 0); scene.add(ao);
  return { focus, wash, env: rt };
}

/* ================================================================ mount */
function mount(el) {
  root = el;
  document.body.classList.add('xp-body');
  el.innerHTML = `
  <div class="xp" id="xp">
    <canvas class="xp-gl" id="xp-gl" aria-label="The PlateLoop scanner in 3D. Drag to turn it, scroll to zoom, and pick a glowing light to learn about each part."></canvas>
    <h1 class="xp-title"><b>PlateLoop</b> <span>Prototype</span></h1>
    <div class="xp-hots" id="xp-hots">${PARTS.map((p, i) => `<button class="xp-hot" data-part="${i}" aria-label="${esc(p.name)}"><i></i><span>${esc(p.name)}</span></button>`).join('')}</div>
    <aside class="xp-panel" id="xp-panel" role="dialog" aria-labelledby="xp-pname" hidden></aside>
    <div class="xp-hint" id="xp-hint">Drag to turn · Scroll to zoom · Tap a light</div>
    <button class="xp-mute" id="xp-mute" aria-label="Mute sound"></button>
    <div class="xp-kiosk" id="xp-kiosk" hidden><div id="xp-kroot"></div><div class="xp-kglass" aria-hidden="true"></div><button class="xp-kexit" id="xp-kexit">Close kiosk</button></div>
  </div>`;
  if (!window.THREE) { $('#xp-hint', el).textContent = '3D needs WebGL, which isn’t available here.'; return; }
  X = start(el);
}

function start(el) {
  const canvas = $('#xp-gl', el), stage = $('#xp', el), A = makeAudio(), M = makeMats();
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { $('#xp-hint', el).textContent = '3D needs WebGL, which isn’t available here.'; return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.physicallyCorrectLights = false;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, .03, 40);
  const ST = studio(renderer, scene), SC = buildScanner(M);
  scene.add(SC.S);

  // every mesh keeps its own material so parts can fade independently
  const meshes = []; SC.S.traverse(m => { if (m.isMesh || m.isSprite) { m.userData.part = m.userData.part || partOf(m); meshes.push(m); if (m.material) m.userData.base = { opacity: m.material.opacity, transparent: m.material.transparent, depthWrite: m.material.depthWrite }; } });
  function partOf(m) { let o = m; while (o && !o.userData.part) o = o.parent; return o ? o.userData.part : 'body'; }

  /* ---------------- camera rig: orbit with inertia, smooth zoom, cinematic flights */
  const C = { target: new THREE.Vector3(...HERO.target), theta: HERO.theta, phi: HERO.phi, r: 4, rGoal: 4, vt: 0, vp: 0, shiftX: 0, shiftY: 0, fly: null, idle: 0, lock: false };
  const heroR = () => { const vf = Math.tan(cam.fov * Math.PI / 360), a = cam.aspect; return Math.max(.84 / .83 / vf, .6 / .9 / (vf * a)); };
  const place = () => {
    const sp = Math.sin(C.phi);
    cam.position.set(C.target.x + C.r * sp * Math.sin(C.theta), C.target.y + C.r * Math.cos(C.phi), C.target.z + C.r * sp * Math.cos(C.theta));
    cam.lookAt(C.target);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (Math.abs(C.shiftX) > .0005 || Math.abs(C.shiftY) > .0005) cam.setViewOffset(w, h, -C.shiftX * w, -C.shiftY * h, w, h); else cam.clearViewOffset();
  };
  const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  function flyTo(v, dur = 1.5, shift = [0, 0]) {
    const from = { t: C.target.clone(), theta: C.theta, phi: C.phi, r: C.r, sx: C.shiftX, sy: C.shiftY };
    const to = { t: new THREE.Vector3(...v.target), theta: from.theta + wrap(v.theta - from.theta), phi: v.phi, r: v.r, sx: shift[0], sy: shift[1] };
    C.vt = C.vp = 0;
    return new Promise(res => { C.fly = { from, to, t: 0, dur: PL.reduceMotion ? .01 : dur, res }; });
  }
  const heroView = () => ({ target: HERO.target, theta: HERO.theta, phi: HERO.phi, r: heroR() });

  /* ---------------- input */
  const ptrs = new Map(); let pinch = 0, lastX = 0, lastY = 0, moved = 0;
  const interact = () => { C.idle = 0; A.wake(); hint(); };
  canvas.addEventListener('pointerdown', e => { if (C.lock) return; canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); lastX = e.clientX; lastY = e.clientY; moved = 0; interact(); if (ptrs.size === 2) pinch = dist(); });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || C.lock || C.fly) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const d = dist(); if (pinch) zoomBy(pinch / d); pinch = d; return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    C.vt = -dx * .0055; C.vp = -dy * .0042; C.theta += C.vt; C.phi += C.vp; interact();
  });
  const up = e => { const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (was && e.type === 'pointerup' && moved < 5 && state.focus != null && !C.fly) close(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  const zoomBy = k => { const lo = state.focus != null ? .45 : 1.35, hi = heroR() * 1.45; C.rGoal = Math.max(lo, Math.min(hi, C.rGoal * k)); A.zoom(k < 1, 0); };
  canvas.addEventListener('wheel', e => { if (C.lock) return; e.preventDefault(); interact(); if (!C.fly) zoomBy(Math.exp(e.deltaY * .0011)); }, { passive: false });

  /* ---------------- hotspots and the panel */
  const hots = $$('.xp-hot', el), panel = $('#xp-panel', el);
  SC.S.updateMatrixWorld(true);
  const anchors = PARTS.map(p => { const v = new THREE.Vector3(...p.anchor); if (p.from && SC.marks[p.from]) SC.S.worldToLocal(SC.marks[p.from].getWorldPosition(v)); return v; });
  const headN = new THREE.Vector3(0, 0, 1).transformDirection(SC.head.matrixWorld);
  const normals = PARTS.map(p => p.from ? headN.clone() : new THREE.Vector3(...p.normal).normalize());
  const state = { focus: null, fade: 0, kiosk: false, t: 0 };
  hots.forEach(b => {
    b.onclick = e => { e.stopPropagation(); interact(); open(+b.dataset.part); };
    b.onmouseenter = () => A.hover(panOf(b));
  });
  const panOf = elx => { const r = elx.getBoundingClientRect(); return Math.max(-.8, Math.min(.8, ((r.left + r.width / 2) / innerWidth - .5) * 1.6)); };
  const narrow = () => innerWidth < 760;
  function open(i) {
    const p = PARTS[i]; if (!p) return;
    const was = state.focus; state.focus = i;
    renderPanel(i);
    panel.hidden = false; panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
    A.select(panOf(hots[i])); if (was !== i) A.fly(was == null ? .3 : .15);
    const v = { ...p.view }, r = narrow() ? v.r * 1.25 : v.r;
    flyTo({ ...v, r }, was == null ? 1.6 : 1.25, narrow() ? [0, -.18] : [-.16, 0]);
    C.rGoal = r;
  }
  function close(silent) {
    if (state.focus == null) return;
    state.focus = null; panel.classList.remove('in'); setTimeout(() => { if (state.focus == null) panel.hidden = true; }, 380);
    if (!silent) { A.close(); A.fly(-.3, false); }
    flyTo(heroView(), 1.5, [0, 0]); C.rGoal = heroR();
  }
  function renderPanel(i) {
    const p = PARTS[i];
    panel.innerHTML = `<button class="xp-x" id="xp-x" aria-label="Close">${IC.x}</button>
      <div class="xp-pk">${String(i + 1).padStart(2, '0')} · ${esc(p.line)}</div>
      <h2 id="xp-pname">${esc(p.name)}</h2>
      <dl><dt>What it does</dt><dd>${esc(p.what)}</dd><dt>How it works</dt><dd>${esc(p.how)}</dd><dt>Why it scans better</dt><dd>${esc(p.why)}</dd></dl>
      <div class="xp-spec">${esc(p.spec)}</div>
      ${p.action ? `<button class="xp-cta" id="xp-cta">${esc(p.action)}<span>→</span></button>` : ''}
      <div class="xp-pnav"><button data-step="-1" aria-label="Previous part">${IC.l}</button><span>${i + 1} / ${PARTS.length}</span><button data-step="1" aria-label="Next part">${IC.r}</button></div>`;
    $('#xp-x', panel).onclick = () => close();
    $$('[data-step]', panel).forEach(b => b.onclick = () => open((i + +b.dataset.step + PARTS.length) % PARTS.length));
    const cta = $('#xp-cta', panel); if (cta) cta.onclick = () => enterKiosk();
  }

  /* ---------------- kiosk mode: the real PlateLoop Kiosk on the scanner's own screen */
  const kbox = $('#xp-kiosk', el), kroot = $('#xp-kroot', el);
  let kioskMounted = false;
  const screenCorners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * SCREEN.w / 2, y * SCREEN.h / 2 - .002, .0068));
  const SN = new THREE.Vector3(), SP = new THREE.Vector3(), V = new THREE.Vector3();
  function screenView() {
    SC.head.updateWorldMatrix(true, false);
    SC.head.getWorldPosition(SP); SN.set(0, 0, 1).transformDirection(SC.head.matrixWorld);
    const vf = Math.tan(cam.fov * Math.PI / 360), fillH = narrow() ? .36 : .6, fillW = narrow() ? .94 : .56;
    const r = Math.max(SCREEN.h / 2 / fillH / vf, SCREEN.w / 2 / fillW / (vf * cam.aspect));
    return { target: SP.toArray(), theta: Math.atan2(SN.x, SN.z), phi: Math.acos(Math.max(-1, Math.min(1, SN.y))), r };
  }
  async function enterKiosk() {
    if (state.kiosk) return;
    state.kiosk = true; C.lock = true; A.power();
    state.focus = null; panel.classList.remove('in'); setTimeout(() => { if (state.focus == null) panel.hidden = true; }, 380);
    stage.classList.add('kiosk-on');
    await flyTo(screenView(), 1.7, narrow() ? [0, -.22] : [.15, 0]);
    if (!state.kiosk) return;
    if (!kioskMounted) { PL.apps.scanner.mount(kroot); kioskMounted = true; const d = $('.kio-drawer', kroot); if (d && narrow()) d.open = false; }
    kbox.hidden = false; requestAnimationFrame(() => kbox.classList.add('in'));
  }
  function exitKiosk() {
    if (!state.kiosk) return;
    state.kiosk = false; kbox.classList.remove('in'); stage.classList.remove('kiosk-on');
    setTimeout(() => { if (!state.kiosk) kbox.hidden = true; }, 420);
    A.close(); A.fly(-.2, false);
    flyTo(heroView(), 1.6, [0, 0]).then(() => { C.lock = false; }); C.rGoal = heroR();
  }
  $('#xp-kexit', el).onclick = exitKiosk;
  function trackScreen() {
    const w = canvas.clientWidth, h = canvas.clientHeight; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    screenCorners.forEach(c => { V.copy(c).applyMatrix4(SC.screen.matrixWorld).project(cam); const x = (V.x * .5 + .5) * w, y = (-V.y * .5 + .5) * h; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    kbox.style.setProperty('--kx', x0 + 'px'); kbox.style.setProperty('--ky', y0 + 'px'); kbox.style.setProperty('--kw', (x1 - x0) + 'px'); kbox.style.setProperty('--kh', (y1 - y0) + 'px');
  }

  /* ---------------- sound toggle, hint, keys */
  const mute = $('#xp-mute', el);
  const paintMute = () => { mute.innerHTML = A.on ? IC.sound : IC.muted; mute.setAttribute('aria-label', A.on ? 'Mute sound' : 'Turn sound on'); mute.classList.toggle('off', !A.on); };
  mute.onclick = () => { A.wake(); A.setOn(!A.on); paintMute(); }; paintMute();
  let hinted = false; const hint = () => { if (hinted) return; hinted = true; $('#xp-hint', el).classList.add('gone'); };
  setTimeout(hint, 7000);
  const onKey = e => {
    if (e.target.closest && e.target.closest('input,select,textarea')) return;
    if (e.key === 'Escape') { if (state.kiosk) exitKiosk(); else close(); }
    else if (state.focus != null && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) open((state.focus + (e.key === 'ArrowRight' ? 1 : -1) + PARTS.length) % PARTS.length);
  };
  addEventListener('keydown', onKey);

  /* ---------------- size */
  const resize = () => {
    const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    if (!C.fly && state.focus == null && !state.kiosk) { C.rGoal = Math.min(C.rGoal, heroR() * 1.45); }
    if (state.kiosk && !C.fly) { const v = screenView(); C.r = C.rGoal = v.r; }
  };
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();

  /* ---------------- intro: the camera glides in from low and far, the title fades up */
  C.r = heroR() * 1.9; C.phi = 1.52; C.theta = HERO.theta - .9; C.rGoal = heroR();
  flyTo(heroView(), PL.reduceMotion ? .01 : 3.2).then(() => { if (/[?&]kiosk\b/.test(location.search)) enterKiosk(); });
  requestAnimationFrame(() => stage.classList.add('ready'));

  /* ---------------- the loop */
  let last = performance.now(), raf = 0, beamT = 5;
  const cp = new THREE.Vector3(), camDir = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; state.t += dt; C.idle += dt;
    // camera
    if (C.fly) {
      const F = C.fly; F.t += dt / F.dur; const k = ease(Math.min(1, F.t));
      C.target.lerpVectors(F.from.t, F.to.t, k); C.theta = lerp(F.from.theta, F.to.theta, k); C.phi = lerp(F.from.phi, F.to.phi, k);
      // a gentle arc: pull back a little in the middle of a flight
      C.r = lerp(F.from.r, F.to.r, k) * (1 + Math.sin(k * Math.PI) * .12);
      C.shiftX = lerp(F.from.sx, F.to.sx, k); C.shiftY = lerp(F.from.sy, F.to.sy, k);
      if (F.t >= 1) { C.fly = null; C.rGoal = C.r = F.to.r; F.res(); }
      A.rotate(Math.sin(k * Math.PI) * .25, (F.to.theta - F.from.theta) > 0 ? .5 : -.5);
    } else if (!C.lock) {
      const damp = Math.pow(.9, dt * 60);
      if (!ptrs.size) { C.theta += C.vt; C.phi += C.vp; C.vt *= damp; C.vp *= damp; }
      // when nobody touches it for a while, it turns very slowly on its own
      if (C.idle > 6 && state.focus == null && !PL.reduceMotion) C.theta += dt * .045 * Math.min(1, (C.idle - 6) / 3);
      C.phi = Math.max(.42, Math.min(1.62, C.phi));
      C.r += (C.rGoal - C.r) * (1 - Math.pow(.001, dt));
      A.rotate(Math.min(1, Math.hypot(C.vt, C.vp) * 22), C.vt > 0 ? -.6 : .6);
    } else A.rotate(0, 0);
    place();

    // the scanner floats, very slightly; it holds still for the kiosk
    const fl = state.kiosk ? 0 : 1; SC.S.userData.fl = lerp(SC.S.userData.fl ?? 1, fl, 1 - Math.pow(.02, dt));
    SC.S.position.y = Math.sin(state.t * .8) * .006 * SC.S.userData.fl; SC.S.rotation.y = Math.sin(state.t * .35) * .006 * SC.S.userData.fl;

    // lights: the status bar breathes, and a scan beam passes over the tray every few seconds

    // focus: the chosen part lights up and everything else fades back
    state.fade = lerp(state.fade, state.focus != null ? 1 : 0, 1 - Math.pow(.004, dt));
    const fid = state.focus != null ? PARTS[state.focus].id : null;
    meshes.forEach(m => {
      const mat = m.material; if (!mat || !m.userData.base || m.userData.skip) return;
      const mine = fid && m.userData.part === fid, base = m.userData.base;
      const target = mine || !fid ? base.opacity : base.opacity * (1 - .68 * state.fade);
      const faded = target < base.opacity - .01;
      if (faded !== !!m.userData.faded) { m.userData.faded = faded; mat.transparent = faded || base.transparent; mat.depthWrite = faded ? false : base.depthWrite; mat.needsUpdate = true; }
      m.userData.k = (mine || !fid) ? 1 : 1 - .68 * state.fade;
      if (!m.isSprite) mat.opacity = target;
      if (mat.emissive) mat.emissive.setRGB(mine ? .03 * state.fade : 0, mine ? .11 * state.fade : 0, mine ? .06 * state.fade : 0);
    });
    if (fid) { const a = anchors[state.focus]; cp.copy(a).applyMatrix4(SC.S.matrixWorld).addScaledVector(normals[state.focus], .18); ST.focus.position.copy(cp); }
    ST.focus.intensity = lerp(ST.focus.intensity, fid ? 1.4 : 0, 1 - Math.pow(.01, dt));
    const pulse = .75 + .25 * Math.sin(state.t * 2.2);
    SC.leds.forEach(l => { if (l.isSprite) l.material.opacity = .45 * pulse * (l.userData.k ?? 1); });
    beamT -= dt; if (beamT < 0) beamT = 7; const b = beamT > 5.8 ? Math.sin((7 - beamT) / 1.2 * Math.PI) : 0;
    SC.beam.material.opacity = b * .09 * (1 - state.fade) * (state.kiosk ? 0 : 1); ST.wash.material.opacity = (.32 + .12 * pulse) * (1 - .6 * state.fade);

    renderer.render(scene, cam);

    // hotspots follow the product; they hide round the back, behind a panel, and in kiosk mode
    const w = canvas.clientWidth, h = canvas.clientHeight; cam.getWorldDirection(camDir);
    hots.forEach((btn, i) => {
      cp.copy(anchors[i]).applyMatrix4(SC.S.matrixWorld);
      const toCam = cam.position.clone().sub(cp).normalize(), facing = normals[i].dot(toCam);
      const p = cp.project(cam), on = p.z < 1 && facing > .08 && !state.kiosk && (state.focus == null || state.focus === i) && !C.fly;
      btn.style.transform = `translate(${(p.x * .5 + .5) * w}px,${(-p.y * .5 + .5) * h}px)`;
      btn.classList.toggle('show', on); btn.classList.toggle('sel', state.focus === i);
    });
    if (state.kiosk) trackScreen();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    get kiosk() { return kioskMounted; }, state,
    look: (v, dur) => flyTo({ target: HERO.target, theta: HERO.theta, phi: HERO.phi, r: heroR(), ...v }, dur), // for testing
    stop() {
      cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown', onKey);
      if (kioskMounted) PL.apps.scanner.unmount();
      renderer.dispose(); ST.env.dispose(); A.close2();
    },
  };
}

const IC = {
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4Z" fill="currentColor"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4Z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

PL.apps.model = {
  title: 'PlateLoop Prototype',
  mount,
  unmount() { if (X) X.stop(); X = null; root = null; document.body.classList.remove('xp-body'); },
  update(kind, fromSelf) { if (X && X.kiosk && PL.apps.scanner.update) PL.apps.scanner.update(kind, fromSelf); },
  tick(t) { if (X && X.kiosk && PL.apps.scanner.tick) PL.apps.scanner.tick(t); },
  debug: () => X,
};
})();
