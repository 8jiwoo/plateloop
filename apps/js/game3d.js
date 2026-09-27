/* Lunch Rush: a first-person, PS1-style walk through a school canteen that shows how students use
   PlateLoop. Get a tray at the counter, sign in at the scanner with your face, scan the full tray, sit
   and eat (click dishes to take bites), scan the tray again, scrape leftovers into the compost bin and
   return the tray. The scans are real: they go through PL.scanBefore / PL.scanAfter, so the Kiosk,
   Kitchen and Loopi apps update too.
   PS1 look: renders at 240 lines into a render target, then a post pass reduces colour to 15-bit with
   ordered dithering; vertices snap to a coarse screen grid (the PS1 "wobble"); low-poly meshes,
   nearest-filtered pixel textures, per-vertex (Gouraud) lighting and fog. Needs three.js (vendor). */
(() => {
'use strict';
const { $, $$, esc, pct, MENU } = PL;
let root = null, G = null;

const LOW_H = 240;
const OBJECTIVES = {
  getTray: 'Get your lunch at the serving counter',
  scanBefore: 'Scan your full tray at the PlateLoop scanner',
  findSeat: 'Find a table and sit down to eat',
  eating: 'Click the food to take bites. Press E when you are full',
  scanAfter: 'Scan your tray again at the scanner',
  compost: 'Scrape your leftovers into the compost bin',
  returnTray: 'Put your tray on the return rack',
  done: 'Lunch done! Walk around, or press Esc for the menu',
};
const PORTION_F = { S: .8, M: 1, L: 1.18 };

/* ---------------------------------------------------------------- sound (Web Audio, no files) */
const SFX = (() => {
  let ctx = null, muted = false, murmur = null;
  const ac = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  const tone = (f, dur = .1, type = 'square', vol = .06, to = null, at = 0) => {
    if (muted) return; const c = ac(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
  };
  const noise = (dur = .12, vol = .12, freq = 1200, at = 0) => {
    if (muted) return; const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  };
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; if (murmur) murmur.gain.gain.value = muted ? 0 : .025; },
    blip() { tone(880, .06, 'square', .05); },
    select() { tone(660, .07, 'square', .05); tone(990, .09, 'square', .05, null, .07); },
    beep() { tone(1320, .12, 'sine', .08); },
    scan() { tone(300, 1.2, 'sawtooth', .025, 900); },
    ok() { [784, 988, 1175].forEach((f, i) => tone(f, .14, 'square', .05, null, i * .09)); },
    bite() { noise(.09, .18, 900); noise(.06, .12, 2200, .07); },
    step() { noise(.05, .05, 180); },
    whoosh() { noise(.35, .08, 600); },
    thud() { tone(120, .2, 'sine', .15, 60); noise(.1, .1, 300); },
    fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i > 3 ? .3 : .12, 'square', .05, null, i * .11)); },
    ambience(on) {
      const c = ac(); if (!c) return;
      if (on && !murmur) {
        const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); let last = 0;
        for (let i = 0; i < n; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = buf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = .7; g.gain.value = muted ? 0 : .025;
        s.connect(f).connect(g).connect(c.destination); s.start(); murmur = { s, gain: g };
      } else if (!on && murmur) { murmur.s.stop(); murmur = null; }
    },
  };
})();

/* ---------------------------------------------------------------- PS1 helpers */
const T = () => window.THREE;
/** Snap vertices to a coarse grid in screen space: the PS1's wobbly geometry. */
function psx(m) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tgl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(160.0, 120.0) + 0.5) / vec2(160.0, 120.0) * gl_Position.w;');
  };
  return m;
}
const lam = o => psx(new (T().MeshLambertMaterial)(o));
function tex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new (T().CanvasTexture)(c); t.magFilter = t.minFilter = T().NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = T().RepeatWrapping; t.repeat.set(rx, ry); return t;
}
function textTex(lines, w, h, bg, fg) {
  return tex(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach(([t, size, y, col]) => { c.font = `bold ${size}px monospace`; c.fillStyle = col || fg; c.fillText(t, w / 2, y); });
  });
}

/* ================================================================ mount */
function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="g3">
    <div class="g3-view" id="g3-view">
      <canvas id="g3-cv" tabindex="0"></canvas>
      <div class="g3-hud" id="g3-hud" hidden>
        <div class="g3-obj"><span>OBJECTIVE</span><b id="g3-obj"></b></div>
        <div class="g3-cross" id="g3-cross"></div>
        <div class="g3-prompt" id="g3-prompt" hidden></div>
        <div class="g3-msg" id="g3-msg" hidden></div>
        <div class="g3-eat" id="g3-eat" hidden></div>
        <button class="g3-mute" id="g3-mute" aria-label="Sound">SND</button>
        <div class="g3-touch" id="g3-touch"><div class="g3-stick" id="g3-stick"><i></i></div><button class="g3-use" id="g3-use">USE</button></div>
      </div>
      <div class="g3-menu" id="g3-menu"></div>
    </div>
    <p class="g3-help">WASD or arrow keys to walk · mouse to look · E or click to use · Esc to pause. On a phone: left thumb walks, drag on the right to look, USE button to use.</p>
  </div>`;
  if (!window.THREE) { $('#g3-menu', el).innerHTML = '<div class="g3-panel"><h2>3D isn\'t available here</h2><p>Open this app in Chrome, Edge or Safari.</p></div>'; return; }
  try { init(); } catch (e) { console.error(e); $('#g3-menu', el).innerHTML = '<div class="g3-panel"><h2>3D isn\'t available here</h2><p>This browser couldn\'t start WebGL. Try Chrome, Edge or Safari.</p></div>'; return; }
  menu('title');
}

/* ================================================================ world */
function init() {
  const THREE = T(), view = $('#g3-view', root), cv = $('#g3-cv', root);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8E9AA3');
  scene.fog = new THREE.Fog('#8E9AA3', 7, 25);
  const camera = new THREE.PerspectiveCamera(70, 4 / 3, .05, 40);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  // low-res target + 15-bit colour with ordered dithering
  const rt = new THREE.WebGLRenderTarget(320, 240, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], bd = new Uint8Array(64);
  bayer.forEach((v, i) => { bd[i * 4] = bd[i * 4 + 1] = bd[i * 4 + 2] = Math.round(v / 16 * 255); bd[i * 4 + 3] = 255; });
  const dither = new THREE.DataTexture(bd, 4, 4, THREE.RGBAFormat); dither.magFilter = dither.minFilter = THREE.NearestFilter; dither.wrapS = dither.wrapT = THREE.RepeatWrapping; dither.needsUpdate = true;
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, tDither: { value: dither } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D tDither; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float d = texture2D(tDither, gl_FragCoord.xy / 4.0).r - 0.5; c = floor((c + d / 31.0) * 31.0 + 0.5) / 31.0; gl_FragColor = vec4(c, 1.0); }',
    depthTest: false, depthWrite: false,
  }));
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(post);

  const resize = () => {
    const w = view.clientWidth || 800, h = view.clientHeight || 600, aspect = w / h;
    const lw = Math.round(LOW_H * aspect);
    renderer.setSize(lw, LOW_H, false); rt.setSize(lw, LOW_H);
    camera.aspect = aspect; camera.fov = aspect < 1 ? 88 : 70; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(view); resize();

  /* ---------------------------------------------------------------- materials + textures */
  const M = {
    floor: lam({ map: tex(32, 32, (c) => { c.fillStyle = '#D9D2C2'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#B9B09C'; c.fillRect(0, 0, 16, 16); c.fillRect(16, 16, 16, 16); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, 15, 32, 1); c.fillRect(15, 0, 1, 32); }, 11, 9) }),
    wall: lam({ map: tex(32, 64, (c) => { c.fillStyle = '#EFE7D6'; c.fillRect(0, 0, 32, 64); c.fillStyle = '#5C9E6E'; c.fillRect(0, 40, 32, 24); c.fillStyle = '#3F7D52'; c.fillRect(0, 39, 32, 2); c.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 44; y < 64; y += 6) c.fillRect(0, y, 32, 1); }, 12, 1) }),
    ceil: lam({ map: tex(32, 32, (c) => { c.fillStyle = '#E4E4E0'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#C8C8C2'; c.fillRect(0, 0, 32, 1); c.fillRect(0, 0, 1, 32); }, 11, 9) }),
    wood: lam({ map: tex(32, 16, (c) => { c.fillStyle = '#B98A55'; c.fillRect(0, 0, 32, 16); c.fillStyle = '#A37543'; for (let y = 2; y < 16; y += 4) c.fillRect(0, y, 32, 1); c.fillStyle = '#C99C66'; c.fillRect(5, 6, 9, 1); c.fillRect(20, 11, 7, 1); }) }),
    steel: lam({ color: '#B8BEC4' }), steelDark: lam({ color: '#7E858C' }), white: lam({ color: '#F4F4F2' }),
    dark: lam({ color: '#2A2E33' }), green: lam({ color: '#34C759', emissive: '#1C7A34' }), bench: lam({ color: '#4F7FA8' }),
    glass: new THREE.MeshBasicMaterial({ color: '#CFE8F2', transparent: true, opacity: .25 }),
    light: new THREE.MeshBasicMaterial({ color: '#FFFDF2' }), window: new THREE.MeshBasicMaterial({ color: '#BFE6FF' }),
    marker: new THREE.MeshBasicMaterial({ color: '#FFD60A' }),
  };
  scene.add(new THREE.AmbientLight('#FFFFFF', .55));
  scene.add(new THREE.HemisphereLight('#FFF6E0', '#6B6252', .45));
  const sun = new THREE.DirectionalLight('#FFFFFF', .55); sun.position.set(-6, 8, 3); scene.add(sun);

  const colliders = [];
  const box = (w, h, d, mat, x, y, z, parent = scene, solid = false) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m);
    if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };
  const cyl = (r, h, mat, x, y, z, parent = scene, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const plane = (w, h, mat, x, y, z, ry = 0, parent = scene) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };

  /* ---------------------------------------------------------------- the room: 22 × 18 m */
  const RW = 11, RD = 9, RH = 3.6;
  const floor = plane(RW * 2, RD * 2, M.floor, 0, 0, 0); floor.rotation.x = -Math.PI / 2;
  const ceil = plane(RW * 2, RD * 2, M.ceil, 0, RH, 0); ceil.rotation.x = Math.PI / 2;
  plane(RW * 2, RH, M.wall, 0, RH / 2, -RD, 0); plane(RW * 2, RH, M.wall, 0, RH / 2, RD, Math.PI);
  plane(RD * 2, RH, M.wall, -RW, RH / 2, 0, Math.PI / 2); plane(RD * 2, RH, M.wall, RW, RH / 2, 0, -Math.PI / 2);
  for (let x = -8; x <= 8; x += 4) for (let z = -6; z <= 6; z += 4) { const l = plane(1.2, .6, M.light, x, RH - .01, z); l.rotation.x = Math.PI / 2; }
  for (let z = -6; z <= 6; z += 3) { plane(1.8, 1.4, M.window, -RW + .02, 2, z, Math.PI / 2); box(.06, .08, 1.9, M.white, -RW + .04, 2.72, z); box(.06, .08, 1.9, M.white, -RW + .04, 1.28, z); }
  // posters
  const poster = (lines, x, y, z, ry, w = 1.3, h = .9, bg = '#FFFFFF') => plane(w, h, new THREE.MeshBasicMaterial({ map: textTex(lines, 128, 88, bg, '#1D1D1F') }), x, y, z, ry);
  poster([['TAKE ONLY', 16, 26], ['WHAT YOU\'LL', 16, 46], ['EAT!', 22, 68, '#2B8C43']], -3, 2.1, RD - .02, Math.PI, 1.3, .9, '#FFF3C4');
  poster([['KAILAN', 18, 30, '#2B8C43'], ['WEEK', 18, 52, '#2B8C43'], ['try a bite!', 11, 72]], 3, 2.1, RD - .02, Math.PI, 1.3, .9, '#E3F6E5');
  poster([['SCAN', 18, 24], ['BEFORE', 14, 44], ['+ AFTER', 14, 64, '#34A853']], RW - .02, 2.2, 1.2, -Math.PI / 2, 1.1, .8, '#FFFFFF');
  // menu board over the counter
  plane(3.4, 1, new THREE.MeshBasicMaterial({ map: tex(170, 50, (c) => { c.fillStyle = '#1F3B2C'; c.fillRect(0, 0, 170, 50); c.fillStyle = '#FFE08A'; c.font = 'bold 10px monospace'; c.fillText('TODAY  FRI 25 SEP', 8, 12); c.fillStyle = '#FFFFFF'; c.font = '8px monospace'; MENU.forEach((d, i) => c.fillText(d.name.toUpperCase(), 8 + (i % 2) * 84, 25 + Math.floor(i / 2) * 9)); }) }), -2, 2.55, -RD + .02);

  /* ---------------------------------------------------------------- serving counter (north wall) */
  const counter = new THREE.Group(); scene.add(counter);
  box(9, .95, .9, M.steel, -2, .475, -7.6, counter, true);
  box(9, .04, .95, M.steelDark, -2, .97, -7.6, counter);
  box(9, .02, .5, M.glass, -2, 1.35, -7.25, counter).rotation.x = -.5;
  MENU.forEach((d, i) => { const x = -5.6 + i * 1.3; box(1.05, .08, .5, M.steelDark, x, .99, -7.75, counter); box(.95, .06, .42, lam({ color: d.color }), x, 1.04, -7.75, counter); });
  // trays stack at the start of the line
  for (let i = 0; i < 8; i++) box(.46, .02, .34, M.steel, -6.9, 1.0 + i * .025, -7.25, counter);
  // the server
  person(scene, -2, -8.5, 0, false, '#FFFFFF', true);

  /* ---------------------------------------------------------------- PlateLoop scanner (east wall), front faces the room (−X) */
  const scanner = new THREE.Group(); scanner.position.set(9.6, 0, -3); scanner.rotation.y = -Math.PI / 2; scene.add(scanner);
  box(.8, .86, .46, M.white, 0, .43, 0, scanner); box(.76, .05, .4, M.dark, 0, .025, 0, scanner);
  box(.4, .01, .01, M.green, 0, .8, .235, scanner);
  box(.52, .02, .34, M.steel, 0, .87, 0, scanner); box(.48, .01, .3, M.dark, 0, .885, 0, scanner);
  box(.11, .72, .08, M.steel, 0, 1.22, -.18, scanner); box(.12, .05, .4, M.steel, 0, 1.56, 0, scanner);
  box(.17, .035, .08, M.dark, 0, 1.52, .1, scanner); box(.09, .006, .01, M.green, 0, 1.502, .14, scanner);
  cyl(.018, .26, M.steel, -.36, .99, .02, scanner, 6);
  const pod = new THREE.Group(); pod.position.set(-.36, 1.18, .04); pod.rotation.x = -.28; scanner.add(pod);
  box(.3, .2, .02, M.steel, 0, 0, 0, pod);
  const screenCv = document.createElement('canvas'); screenCv.width = 128; screenCv.height = 84;
  const screenTex = new THREE.CanvasTexture(screenCv); screenTex.magFilter = screenTex.minFilter = THREE.NearestFilter; screenTex.generateMipmaps = false;
  plane(.27, .177, new THREE.MeshBasicMaterial({ map: screenTex }), 0, 0, .011, 0, pod);
  box(.1, .03, .03, M.dark, 0, .118, 0, pod); box(.02, .02, .005, M.green, 0, .118, .017, pod);
  // compost bin and tray return rack
  const bin = new THREE.Group(); bin.position.set(9.6, 0, -1.9); bin.rotation.y = -Math.PI / 2; scene.add(bin);
  box(.36, .86, .46, M.white, 0, .43, 0, bin); cyl(.13, .02, M.green, 0, .865, -.01, bin, 12); cyl(.11, .025, M.dark, 0, .87, -.01, bin, 12);
  const rack = new THREE.Group(); rack.position.set(9.7, 0, .4); rack.rotation.y = -Math.PI / 2; scene.add(rack);
  box(1.2, 1.3, .4, M.steelDark, 0, .65, 0, rack);
  for (let y = .45; y < 1.3; y += .28) box(1.1, .03, .38, M.steel, 0, y, .02, rack);
  const rackTrays = new THREE.Group(); rack.add(rackTrays);
  for (let i = 0; i < 3; i++) box(.46, .02, .34, M.steel, -.3 + i * .3, .48, .02, rackTrays);
  colliders.push({ minX: 9.3, maxX: 11, minZ: -3.5, maxZ: .8 });
  // floor sign
  const arrow = plane(1.2, .6, new THREE.MeshBasicMaterial({ map: textTex([['PLATELOOP', 9, 16, '#FFFFFF'], ['SCAN HERE', 11, 34, '#FFE08A']], 64, 48, '#2B8C43', '#FFFFFF') }), 8.6, .01, -2.4); arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = Math.PI / 2;

  /* ---------------------------------------------------------------- tables, benches, students */
  const tables = [];
  [-6.5, -2, 2.5].forEach(x => [-3.5, .5, 4.5].forEach(z => {
    const t = new THREE.Group(); t.position.set(x, 0, z); scene.add(t);
    box(2.6, .06, .9, M.wood, 0, .74, 0, t); [[-1.15, -.35], [1.15, -.35], [-1.15, .35], [1.15, .35]].forEach(([a, b]) => box(.05, .72, .05, M.steelDark, a, .36, b, t));
    box(2.6, .05, .3, M.bench, 0, .45, -.75, t); box(2.6, .05, .3, M.bench, 0, .45, .75, t);
    [-1.1, 1.1].forEach(a => { box(.05, .44, .05, M.steelDark, a, .22, -.75, t); box(.05, .44, .05, M.steelDark, a, .22, .75, t); });
    colliders.push({ minX: x - 1.3, maxX: x + 1.3, minZ: z - .92, maxZ: z + .92 });
    tables.push({ group: t, x, z, taken: [] });
  }));
  const people = [];
  const seatSpots = [[-6.5, -3.5, -.8, 1], [-6.5, -3.5, .6, -1], [-2, -3.5, .3, 1], [2.5, -3.5, -.5, -1], [-6.5, .5, 0, 1], [2.5, .5, .7, 1], [2.5, .5, -.7, -1], [-2, 4.5, -.6, -1], [-6.5, 4.5, .5, 1], [2.5, 4.5, 0, -1]];
  const shirts = ['#FFFFFF', '#F2F2F2', '#DDE7F2', '#FFFFFF'];
  seatSpots.forEach(([x, z, off, side], i) => { const p = person(scene, x + off, z + side * .75, side > 0 ? 0 : Math.PI, true, shirts[i % 4]); people.push({ p, bob: Math.random() * 6 }); miniTray(scene, x + off, z + side * .3); if (side > 0) tables.find(t => t.x === x && t.z === z).taken.push(off); });
  // a couple of classmates in the queue and walking about
  const walkers = [
    { p: person(scene, -4, -6.4, Math.PI, false, '#FFFFFF'), path: [[-4, -6.4], [-4, -6.4]] },
    { p: person(scene, -3.2, -6.4, Math.PI, false, '#DDE7F2'), path: [[-3.2, -6.4], [-3.2, -6.4]] },
    { p: person(scene, 6, 6, 0, false, '#FFFFFF'), path: [[6, 6], [6, -5], [7.8, -5], [7.8, 6]], i: 0, speed: 1.1 },
    { p: person(scene, -9, 2, 0, false, '#F2F2F2'), path: [[-9, 7], [-9, -5.5], [5, -5.5], [5, 7]], i: 0, speed: .9 },
  ];

  /* ---------------------------------------------------------------- objective marker */
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(.12, 0), M.marker); scene.add(marker);

  /* ---------------------------------------------------------------- your tray */
  const tray = makeTray();
  camera.add(tray.group); tray.group.visible = false;
  const HAND = { pos: new THREE.Vector3(0, -.36, -.52), rot: new THREE.Euler(.32, 0, 0) };
  tray.group.position.copy(HAND.pos); tray.group.rotation.copy(HAND.rot);

  function makeTray() {
    const g = new THREE.Group(), dishes = {};
    box(.46, .02, .34, M.steel, 0, 0, 0, g);
    [[-.23, 0], [.23, 0]].forEach(([x]) => box(.01, .03, .34, M.steel, x, .015, 0, g));
    box(.46, .03, .01, M.steel, 0, .015, -.17, g); box(.46, .03, .01, M.steel, 0, .015, .17, g);
    MENU.forEach(d => {
      const [c, r] = d.slot, x = (c - 1) * .15, z = (r - .5) * .16;
      const holder = new THREE.Group(); holder.position.set(x, .012, z); g.add(holder);
      let m;
      if (d.id === 'soup') { cyl(.055, .04, M.white, 0, .02, 0, holder, 10); m = cyl(.048, .01, lam({ color: d.color }), 0, .038, 0, holder, 10); }
      else if (d.id === 'rice') { m = new THREE.Mesh(new THREE.SphereGeometry(.055, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), lam({ color: d.color })); holder.add(m); }
      else if (d.id === 'chicken') { m = box(.09, .03, .06, lam({ color: d.color }), 0, .015, 0, holder); }
      else if (d.id === 'melon') { m = new THREE.Mesh(new THREE.ConeGeometry(.045, .03, 3), lam({ color: d.color })); m.rotation.x = Math.PI / 2; m.position.y = .02; holder.add(m); }
      else { m = new THREE.Mesh(new THREE.ConeGeometry(.05, .03, 6), lam({ color: d.color })); m.position.y = .015; holder.add(m); }
      m.userData.dish = d.id;
      dishes[d.id] = { holder, mesh: m };
    });
    return { group: g, dishes };
  }
  function setFood(amounts, portion) {
    const f = PORTION_F[portion] || 1;
    MENU.forEach(d => { const a = amounts[d.id], h = tray.dishes[d.id].holder; h.visible = a > .03; const s = Math.sqrt(Math.max(.05, a)) * f; h.scale.set(s, Math.max(.2, a) * f, s); });
  }
  function miniTray(parent, x, z) {
    const g = new THREE.Group(); g.position.set(x, .78, z); parent.add(g);
    box(.46, .02, .34, M.steel, 0, 0, 0, g);
    MENU.forEach(d => { if (Math.random() < .25) return; const [c, r] = d.slot; box(.08, .03, .06, lam({ color: d.color }), (c - 1) * .15, .02, (r - .5) * .16, g); });
  }
  function person(parent, x, z, ry, seated, shirt, server) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
    const skin = ['#E8C39E', '#C99A6E', '#F1D0B0', '#A8754E'][Math.floor(Math.random() * 4)];
    const by = seated ? .78 : 1.1;
    if (!seated) { box(.1, .7, .12, lam({ color: '#2F3A4E' }), -.08, .35, 0, g); box(.1, .7, .12, lam({ color: '#2F3A4E' }), .08, .35, 0, g); }
    else { box(.3, .1, .36, lam({ color: '#2F3A4E' }), 0, .52, -.12, g); }
    const body = cyl(.17, .56, lam({ color: shirt }), 0, by, 0, g, 7);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 5), lam({ color: skin })); head.position.set(0, by + .42, 0); g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.13, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), lam({ color: server ? '#FFFFFF' : '#1E1A18' })); hair.position.set(0, by + .44, .01); g.add(hair);
    box(.08, .4, .08, lam({ color: shirt }), -.21, by - .02, seated ? -.12 : 0, g).rotation.x = seated ? -.9 : 0;
    box(.08, .4, .08, lam({ color: shirt }), .21, by - .02, seated ? -.12 : 0, g).rotation.x = seated ? -.9 : 0;
    g.userData = { body, head, by };
    return g;
  }

  /* ---------------------------------------------------------------- the scanner's screen */
  function drawScreen(mode, data = {}) {
    const c = screenCv.getContext('2d'), W = 128, H = 84;
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2B8C43'; c.fillRect(0, 0, W, 10); c.fillStyle = '#FFFFFF'; c.font = 'bold 7px monospace'; c.fillText('PLATELOOP', 3, 7);
    c.fillStyle = '#1D1D1F'; c.textAlign = 'center';
    const big = (t, y, col = '#1D1D1F', s = 11) => { c.fillStyle = col; c.font = `bold ${s}px monospace`; c.fillText(t, W / 2, y); };
    const small = (t, y, col = '#6E6E73') => { c.fillStyle = col; c.font = '7px monospace'; c.fillText(t, W / 2, y); };
    if (mode === 'idle') { big('SCAN YOUR', 32); big('TRAY', 46); small('look at the camera', 62); small('before + after lunch', 72, '#2B8C43'); }
    else if (mode === 'face') { c.strokeStyle = '#34C759'; c.lineWidth = 2; c.strokeRect(44, 16, 40, 44); c.strokeStyle = '#C7C7CC'; c.beginPath(); c.arc(64, 34, 9, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#34C759'; c.fillRect(46, 18 + (data.t || 0) % 40, 36, 2); small('LOOK AT THE CAMERA', 74, '#1D1D1F'); }
    else if (mode === 'hello') { small('FACE RECOGNISED', 26, '#2B8C43'); big(`HI, ${(data.name || '').toUpperCase()}!`, 44, '#1D1D1F', 10); small(data.sub || 'place your tray', 62); }
    else if (mode === 'scan') { c.strokeStyle = '#B8BCC2'; c.strokeRect(34, 18, 60, 40); c.fillStyle = '#34C759'; c.fillRect(34, 18 + (data.t || 0) % 40, 60, 2); small('SCANNING...', 72, '#1D1D1F'); }
    else if (mode === 'saved') { big('SAVED!', 34, '#2B8C43'); small(`${data.g} g on your tray`, 50); small('enjoy your lunch', 62); }
    else if (mode === 'result') { big(pct(data.w), 36, data.w < .15 ? '#2B8C43' : '#F28C28', 18); small('left on your tray', 50); small(`+${data.xp} pts  ${data.co2 > 0 ? `CO2 -${data.co2}g` : ''}`, 64, '#2B8C43'); }
    c.textAlign = 'left';
    screenTex.needsUpdate = true;
  }
  drawScreen('idle');

  G = {
    THREE, renderer, scene, camera, rt, postScene, postCam, ro, M, colliders, tables, people, walkers, marker, tray, HAND,
    scanner, bin, rack, rackTrays, counter, drawScreen, setFood, box,
    phase: 'title', sid: null, portion: 'M', eaten: null, busy: false, seated: null, tweens: [], keys: {}, yaw: 0, pitch: 0,
    pos: new THREE.Vector3(0, 1.55, 7.5), look: { dx: 0, dy: 0 }, stick: { x: 0, y: 0 }, stepT: 0, t: 0, raf: 0, last: performance.now(),
    ray: new THREE.Raycaster(), target: null, locked: false, touch: matchMedia('(pointer: coarse)').matches,
  };
  G.targets = [
    { obj: counter, phases: ['getTray'], label: 'Get your lunch', act: openPortion },
    { obj: scanner, phases: ['scanBefore', 'scanAfter'], label: 'Look at the scanner', act: doScan },
    ...tables.map(t => ({ obj: t.group, phases: ['findSeat'], label: 'Sit down and eat', act: () => sit(t) })),
    { obj: bin, phases: ['compost'], label: 'Scrape leftovers into the compost', act: doCompost },
    { obj: rack, phases: ['returnTray'], label: 'Return your tray', act: doReturn },
  ];
  wireInput();
  G.raf = requestAnimationFrame(loop);
}

/* ================================================================ loop */
function loop(now) {
  if (!G || !root || !root.isConnected) return;
  const dt = Math.min(.05, (now - G.last) / 1000); G.last = now; G.t += dt;
  const { THREE, camera } = G;
  // look (the title screen slowly pans the room)
  if (G.phase === 'title') { G.yaw += dt * .12; G.pitch = -.05; }
  G.yaw -= G.look.dx * .0024; G.pitch -= G.look.dy * .0024; G.look.dx = G.look.dy = 0;
  G.pitch = Math.max(-1.35, Math.min(1.2, G.pitch));
  camera.rotation.set(G.pitch, G.yaw, 0);
  // move
  if (G.phase !== 'title' && !G.seated && !G.busy && !G.paused) {
    let fx = 0, fz = 0;
    if (G.keys.KeyW || G.keys.ArrowUp) fz -= 1; if (G.keys.KeyS || G.keys.ArrowDown) fz += 1;
    if (G.keys.KeyA || G.keys.ArrowLeft) fx -= 1; if (G.keys.KeyD || G.keys.ArrowRight) fx += 1;
    fx += G.stick.x; fz += G.stick.y;
    const len = Math.hypot(fx, fz);
    if (len > .05) {
      const sp = 3 * dt / Math.max(1, len), s = Math.sin(G.yaw), c = Math.cos(G.yaw);
      const mx = (fx * c + fz * s) * sp, mz = (-fx * s + fz * c) * sp;
      tryMove(mx, 0); tryMove(0, mz);
      G.stepT += dt; if (G.stepT > .42) { G.stepT = 0; SFX.step(); }
    }
    camera.position.set(G.pos.x, G.pos.y + Math.sin(G.t * 9) * (len > .05 ? .025 : 0), G.pos.z);
  }
  // tweens
  G.tweens = G.tweens.filter(tw => { tw.t += dt / tw.dur; const k = Math.min(1, tw.t), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; tw.fn(e); if (k >= 1) { tw.done && tw.done(); return false; } return true; });
  // people
  G.people.forEach(({ p, bob }) => { p.userData.head.position.y = p.userData.by + .42 + Math.sin(G.t * 2 + bob) * .012; });
  G.walkers.forEach(w => {
    if (!w.speed) { w.p.userData.head.rotation.y = Math.sin(G.t * .7 + w.p.position.x) * .4; return; }
    const [tx, tz] = w.path[w.i], dx = tx - w.p.position.x, dz = tz - w.p.position.z, d = Math.hypot(dx, dz);
    if (d < .1) w.i = (w.i + 1) % w.path.length;
    else { w.p.position.x += dx / d * w.speed * dt; w.p.position.z += dz / d * w.speed * dt; w.p.rotation.y = Math.atan2(dx, dz); w.p.position.y = Math.abs(Math.sin(G.t * 8)) * .03; }
  });
  // scanner screen animation
  if (G.screenAnim) { G.screenAnim.t += dt * 60; G.drawScreen(G.screenAnim.mode, { ...G.screenAnim.data, t: G.screenAnim.t }); }
  // objective marker
  const tgt = G.targets.find(t => t.phases.includes(G.phase) && t.obj !== undefined);
  if (tgt && !G.seated) {
    const p = new THREE.Vector3(); (G.phase === 'findSeat' ? nearestTable().group : tgt.obj).getWorldPosition(p);
    G.marker.visible = true; G.marker.position.set(p.x, (G.phase === 'findSeat' ? 1.4 : 2.1) + Math.sin(G.t * 3) * .08, p.z); G.marker.rotation.y += dt * 2;
  } else G.marker.visible = false;
  // what are we looking at?
  updateTarget();
  // render: low-res scene, then 15-bit dither pass
  G.renderer.setRenderTarget(G.rt); G.renderer.render(G.scene, camera);
  G.renderer.setRenderTarget(null); G.renderer.render(G.postScene, G.postCam);
  G.raf = requestAnimationFrame(loop);
}
function tryMove(dx, dz) {
  const nx = G.pos.x + dx, nz = G.pos.z + dz, r = .28;
  if (nx < -10.6 || nx > 10.6 || nz < -8.6 || nz > 8.6) return;
  if (G.colliders.some(c => nx > c.minX - r && nx < c.maxX + r && nz > c.minZ - r && nz < c.maxZ + r)) return;
  G.pos.x = nx; G.pos.z = nz;
}
const nearestTable = () => G.tables.reduce((a, t) => Math.hypot(t.x - G.pos.x, t.z - G.pos.z) < Math.hypot(a.x - G.pos.x, a.z - G.pos.z) ? t : a, G.tables[0]);
function updateTarget() {
  const prompt = $('#g3-prompt', root);
  if (!prompt) return;
  let hit = null;
  if (G.phase !== 'title' && !G.busy && !G.paused) {
    if (G.seated) {
      G.ray.setFromCamera(G.aim || { x: 0, y: 0 }, G.camera);
      const meshes = Object.values(G.tray.dishes).filter(d => d.holder.visible).map(d => d.mesh);
      const h = G.ray.intersectObjects(meshes, false)[0];
      G.aimDish = h ? h.object.userData.dish : null;
      if (G.aimDish) hit = { label: `Eat the ${PL.DISH[G.aimDish].name.toLowerCase()}` };
    } else {
      G.ray.setFromCamera({ x: 0, y: 0 }, G.camera);
      G.ray.far = 2.8;
      for (const t of G.targets) {
        if (!t.phases.includes(G.phase)) continue;
        if (G.ray.intersectObject(t.obj, true).length) { hit = t; break; }
      }
      G.ray.far = Infinity;
    }
  }
  G.target = G.seated ? null : hit;
  const cross = $('#g3-cross', root); cross.classList.toggle('on', !!hit);
  prompt.hidden = !hit;
  if (hit) prompt.innerHTML = `<b>${G.touch ? 'USE' : 'E'}</b> ${esc(hit.label)}`;
}

/* ================================================================ actions */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const me = () => PL.student(G.sid);
function msg(text, ms = 2600) {
  const el = $('#g3-msg', root); if (!el) return;
  el.innerHTML = text; el.hidden = false; clearTimeout(G.msgT); G.msgT = setTimeout(() => { el.hidden = true; }, ms);
}
function setPhase(p) {
  G.phase = p; $('#g3-obj', root).textContent = OBJECTIVES[p] || '';
  $('#g3-hud', root).classList.toggle('eating', p === 'eating');
}
function use() {
  if (G.phase === 'title' || G.busy || G.paused) return;
  if (G.seated) { if (G.aimDish) bite(G.aimDish); return; }
  if (G.target && G.target.act) { SFX.blip(); G.target.act(); }
}
function openPortion() {
  G.paused = true; unlock();
  panel(`<h2>SERVING COUNTER</h2><p class="g3-say">"What size today, ${esc(me().name)}?"</p>
    <div class="g3-choices">${[['S', 'SMALL', 'a little hungry'], ['M', 'REGULAR', 'normal lunch'], ['L', 'LARGE', 'very hungry']].map(([k, n, s]) => `<button data-portion="${k}"><b>${n}</b><small>${s}</small></button>`).join('')}</div>
    <p class="g3-tip">Tip: take what you'll finish. You can always come back for more.</p>`);
  $$('[data-portion]', root).forEach(b => b.onclick = () => {
    SFX.select(); G.portion = b.dataset.portion; closePanel();
    G.eaten = Object.fromEntries(MENU.map(d => [d.id, 0]));
    G.setFood(Object.fromEntries(MENU.map(d => [d.id, 1])), G.portion);
    G.tray.group.visible = true;
    msg(`You got a ${{ S: 'small', M: 'regular', L: 'large' }[G.portion]} tray.`);
    setPhase('scanBefore');
  });
}
/** Move the tray from your hands onto the scale, run the scan, then hand it back. */
async function doScan() {
  const THREE = G.THREE, before = G.phase === 'scanBefore', st = me();
  G.busy = true;
  G.screenAnim = { mode: 'face', data: {}, t: 0 }; SFX.beep(); await sleep(1100);
  G.screenAnim = null; G.drawScreen('hello', { name: st.name, sub: before ? 'place your full tray' : 'welcome back!' }); SFX.ok(); await sleep(900);
  // hands → scale
  const plat = new THREE.Vector3(0, .9, 0); G.scanner.localToWorld(plat);
  G.scene.attach(G.tray.group);
  const from = G.tray.group.position.clone(), fromQ = G.tray.group.quaternion.clone(), toQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
  await tween(.5, e => { G.tray.group.position.lerpVectors(from, plat, e); G.tray.group.quaternion.copy(fromQ).slerp(toQ, e); });
  G.screenAnim = { mode: 'scan', data: {}, t: 0 }; SFX.scan();
  const beam = G.box(.5, .004, .34, new THREE.MeshBasicMaterial({ color: '#34C759', transparent: true, opacity: .6 }), 0, 1.5, 0, G.scanner);
  await tween(1.2, e => { beam.position.y = 1.5 - e * .6; });
  G.scanner.remove(beam); G.screenAnim = null;
  let result;
  if (before) {
    const b = PL.scanBefore(st.id, G.portion, 'face'); PL.store.save('scan');
    G.drawScreen('saved', { g: b.total }); SFX.ok(); result = b;
  } else {
    const eatPct = Object.fromEntries(MENU.map(d => [d.id, Math.round(G.eaten[d.id] * 100)]));
    result = PL.scanAfter(st.id, eatPct, 'face'); PL.store.save('scan'); G.result = result;
    G.drawScreen('result', { w: result.w, xp: result.xp, co2: result.co2 }); SFX.ok();
  }
  await sleep(700);
  // scale → hands
  G.camera.attach(G.tray.group);
  const f2 = G.tray.group.position.clone(), q2 = G.tray.group.quaternion.clone(), hq = new THREE.Quaternion().setFromEuler(G.HAND.rot);
  await tween(.45, e => { G.tray.group.position.lerpVectors(f2, G.HAND.pos, e); G.tray.group.quaternion.copy(q2).slerp(hq, e); });
  G.busy = false;
  if (before) { msg(`Scanned: <b>${result.total} g</b> on your tray. Now go and eat!`, 3200); setPhase('findSeat'); }
  else {
    const r = result;
    msg(`<b>${pct(r.w)}</b> left · +${r.xp} points${r.co2 > 0 ? ` · ${r.co2} g CO₂ saved` : ''}${r.game ? ` · Loopi +${r.game.hunger} food${r.game.heart ? ', +1 heart' : ''}` : ''}`, 4200);
    setPhase(r.w > .03 ? 'compost' : 'returnTray');
    if (r.w <= .03) msg('Clean tray! Nothing to scrape. Return your tray.', 3200);
  }
  setTimeout(() => G && G.drawScreen('idle'), 5000);
}
async function sit(t) {
  const THREE = G.THREE;
  G.busy = true; G.seated = t;
  // take the free spot on the near bench, away from anyone already sitting there
  t.off = [-.85, 0, .85].reduce((a, o) => Math.min(9, ...t.taken.map(k => Math.abs(k - o))) > Math.min(9, ...t.taken.map(k => Math.abs(k - a))) ? o : a);
  const seat = new THREE.Vector3(t.x + t.off, 1.2, t.z + .72), from = G.camera.position.clone();
  await tween(.5, e => { G.camera.position.lerpVectors(from, seat, e); });
  G.yaw = 0; G.pitch = -.78;
  // tray from hands onto the table
  G.scene.attach(G.tray.group);
  const tp = new THREE.Vector3(t.x + t.off, .78, t.z + .28), f = G.tray.group.position.clone(), q = G.tray.group.quaternion.clone(), tq = new THREE.Quaternion();
  await tween(.4, e => { G.tray.group.position.lerpVectors(f, tp, e); G.tray.group.quaternion.copy(q).slerp(tq, e); });
  G.busy = false; setPhase('eating'); updateEatHud();
  msg(G.touch ? 'Tap the food to take bites. Tap DONE when you\'re full.' : 'Click the food to take bites. Press E when you\'re full.', 3400);
}
function bite(id) {
  const THREE = G.THREE;
  if (G.eaten[id] >= 1) return;
  G.eaten[id] = Math.min(1, G.eaten[id] + .25); SFX.bite();
  G.setFood(Object.fromEntries(MENU.map(d => [d.id, 1 - G.eaten[d.id]])), G.portion);
  if (id === PL.CRAVING && G.eaten[id] === .25) msg('You tried the kailan! That counts for Kailan Week.');
  updateEatHud();
  if (MENU.every(d => G.eaten[d.id] >= 1)) { msg('Every bite finished! Clean tray.'); setTimeout(standUp, 900); }
}
function updateEatHud() {
  const el = $('#g3-eat', root); if (!el) return;
  el.hidden = G.phase !== 'eating';
  el.innerHTML = `<div class="g3-dishes">${MENU.map(d => `<div><i style="background:${d.color}"></i><span>${esc(d.name)}</span><b>${Math.round(G.eaten[d.id] * 100)}%</b></div>`).join('')}</div><button id="g3-done">DONE, I'M FULL</button>`;
  $('#g3-done', el).onclick = () => { SFX.select(); standUp(); };
}
async function standUp() {
  if (!G.seated || G.busy) return;
  const THREE = G.THREE, t = G.seated;
  G.busy = true; $('#g3-eat', root).hidden = true;
  G.camera.attach(G.tray.group);
  const f = G.tray.group.position.clone(), q = G.tray.group.quaternion.clone(), hq = new THREE.Quaternion().setFromEuler(G.HAND.rot);
  await tween(.4, e => { G.tray.group.position.lerpVectors(f, G.HAND.pos, e); G.tray.group.quaternion.copy(q).slerp(hq, e); });
  G.pos.set(t.x + t.off, 1.55, t.z + 1.35); G.camera.position.copy(G.pos); G.pitch = 0; G.yaw = -Math.PI / 2 - .3;
  G.seated = null; G.busy = false; setPhase('scanAfter');
  const left = MENU.reduce((s, d) => s + (1 - G.eaten[d.id]), 0) / MENU.length;
  msg(left < .1 ? 'Great lunch! Now scan your tray again.' : 'Now scan your tray again, leftovers and all.');
}
async function doCompost() {
  const THREE = G.THREE;
  G.busy = true; SFX.whoosh();
  const hole = new THREE.Vector3(0, .9, 0); G.bin.localToWorld(hole);
  const start = new THREE.Vector3(); G.tray.group.getWorldPosition(start);
  const bits = [];
  MENU.forEach(d => { const left = 1 - G.eaten[d.id]; for (let i = 0; i < Math.ceil(left * 4); i++) bits.push(G.box(.03, .03, .03, new THREE.MeshBasicMaterial({ color: d.color }), start.x + (Math.random() - .5) * .2, start.y, start.z + (Math.random() - .5) * .2)); });
  G.setFood(Object.fromEntries(MENU.map(d => [d.id, 0])), G.portion);
  const origins = bits.map(b => b.position.clone());
  await tween(.8, e => bits.forEach((b, i) => { b.position.lerpVectors(origins[i], hole, e); b.position.y += Math.sin(e * Math.PI) * .35; b.rotation.x += .2; }));
  bits.forEach(b => G.scene.remove(b)); SFX.thud();
  G.busy = false;
  const g = G.result ? Math.round(G.result.left) : 0;
  msg(`${g} g of leftovers went into the compost. It becomes soil for the school garden.`, 3400);
  setPhase('returnTray');
}
async function doReturn() {
  const THREE = G.THREE;
  G.busy = true;
  const slot = new THREE.Vector3(.3, .76, .02); G.rack.localToWorld(slot);
  G.scene.attach(G.tray.group);
  const f = G.tray.group.position.clone(), q = G.tray.group.quaternion.clone(), tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
  await tween(.5, e => { G.tray.group.position.lerpVectors(f, slot, e); G.tray.group.quaternion.copy(q).slerp(tq, e); });
  G.busy = false; SFX.fanfare(); setPhase('done'); finish();
}
function finish() {
  const r = G.result, st = me();
  G.paused = true; unlock();
  const grade = r.w < .05 ? 'S' : r.w < .15 ? 'A' : r.w < .3 ? 'B' : 'C';
  panel(`<h2>LUNCH COMPLETE</h2>
    <div class="g3-grade g${grade}">${grade}</div>
    <p class="g3-say">Loopi: "${esc(r.line)}"</p>
    <div class="g3-stats">
      <div><span>Ate</span><b>${pct(1 - r.w)}</b></div><div><span>Left</span><b>${Math.round(r.left)} g</b></div>
      <div><span>Calories</span><b>${r.intake.kcal}</b></div><div><span>Points</span><b>+${r.xp}</b></div>
      <div><span>CO₂ saved</span><b>${r.co2} g</b></div><div><span>Loopi</span><b>${r.game ? `+${r.game.hunger} food${r.game.heart ? ' +♥' : ''}` : 'fed'}</b></div>
    </div>
    <p class="g3-tip">${esc(st.name)}'s scans are real: open the Kiosk, Kitchen or Loopi app to see this tray there.</p>
    <div class="g3-choices two"><button data-m="again"><b>PLAY AGAIN</b><small>as another student</small></button><button data-m="roam"><b>KEEP WALKING</b><small>explore the canteen</small></button></div>`);
  $('[data-m="again"]', root).onclick = () => { SFX.select(); closePanel(); menu('title'); };
  $('[data-m="roam"]', root).onclick = () => { SFX.select(); closePanel(); G.paused = false; lock(); };
}
function tween(dur, fn) { return new Promise(res => G.tweens.push({ t: 0, dur, fn, done: res })); }

/* ================================================================ menus */
function panel(html) { const m = $('#g3-menu', root); m.innerHTML = `<div class="g3-panel">${html}</div>`; m.hidden = false; }
function closePanel() { const m = $('#g3-menu', root); m.innerHTML = ''; m.hidden = true; G.paused = false; }
function menu(kind) {
  G.paused = true; G.phase = kind === 'title' ? 'title' : G.phase;
  $('#g3-hud', root).hidden = kind === 'title';
  if (kind === 'title') {
    SFX.ambience(false); unlock();
    G.seated = null; G.busy = false; G.tray.group.visible = false; G.camera.position.set(0, 2.4, 1);
    const studs = PL.S.students.filter(s => s.named);
    panel(`<div class="g3-logo"><span>PLATELOOP</span><b>LUNCH RUSH</b></div>
      <p class="g3-sub">A day at the canteen with the PlateLoop scanner</p>
      <p class="g3-label">CHOOSE A STUDENT</p>
      <div class="g3-students">${studs.map(s => { const stt = PL.scanState(s); return `<button data-sid="${s.id}" ${stt === 'done' ? 'disabled' : ''}><b>${esc(s.name.toUpperCase())}</b><small>${stt === 'done' ? 'lunch done today' : stt === 'eating' ? 'tray scanned, eating' : 'ready for lunch'}</small></button>`; }).join('')}</div>
      ${studs.every(s => PL.scanState(s) === 'done') ? '<p class="g3-tip">Everyone has had lunch. <button class="g3-link" data-reset>Reset the demo</button> to play again.</p>' : ''}
      <p class="g3-tip">${G.touch ? 'Left thumb to walk · drag to look · USE to interact' : 'WASD to walk · mouse to look · E or click to use · Esc to pause'}</p>`);
    $$('[data-sid]', root).forEach(b => b.onclick = () => start(b.dataset.sid));
  } else if (kind === 'pause') {
    panel(`<h2>PAUSED</h2><p class="g3-sub">${esc(OBJECTIVES[G.phase] || '')}</p>
      <div class="g3-choices two"><button data-m="resume"><b>RESUME</b><small>back to lunch</small></button><button data-m="quit"><b>QUIT</b><small>to the title screen</small></button></div>`);
    $('[data-m="resume"]', root).onclick = () => { SFX.select(); closePanel(); lock(); };
    $('[data-m="quit"]', root).onclick = () => { SFX.select(); menu('title'); };
  }
}
function start(sid) {
  SFX.select(); SFX.ambience(true);
  const st = PL.student(sid);
  Object.assign(G, { sid, seated: null, busy: false, eaten: Object.fromEntries(MENU.map(d => [d.id, 0])), result: null, yaw: 0, pitch: 0, paused: false, tweens: [], keys: {}, screenAnim: null });
  G.pos.set(0, 1.55, 7.5); G.camera.position.copy(G.pos);
  G.camera.attach(G.tray.group); G.tray.group.position.copy(G.HAND.pos); G.tray.group.rotation.copy(G.HAND.rot);
  closePanel(); $('#g3-hud', root).hidden = false; $('#g3-touch', root).hidden = !G.touch;
  if (PL.scanState(st) === 'eating') {
    // already scanned before lunch (e.g. on the Kiosk): straight to a seat
    G.portion = PL.portionOf(st.before.served); G.setFood(Object.fromEntries(MENU.map(d => [d.id, 1])), G.portion);
    G.tray.group.visible = true; setPhase('findSeat'); msg(`${esc(st.name)}'s tray is already scanned. Find a seat!`);
  } else { G.tray.group.visible = false; setPhase('getTray'); msg(`You're ${esc(st.name)}. Lunch time! Head to the serving counter.`, 3200); }
  lock();
}

/* ================================================================ input */
function lock() { if (!G.touch) { const cv = $('#g3-cv', root); try { const p = cv.requestPointerLock && cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
function wireInput() {
  const cv = $('#g3-cv', root), view = $('#g3-view', root);
  const onKey = e => {
    if (!G || !root) return;
    if (e.type === 'keydown' && e.code === 'Escape' && G.phase !== 'title' && !G.paused) { menu('pause'); return; }
    if (G.paused || G.phase === 'title') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { G.keys[e.code] = e.type === 'keydown'; e.preventDefault(); }
    if (e.type === 'keydown' && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); if (G.seated && G.phase === 'eating' && e.code === 'KeyE') standUp(); else use(); }
    if (e.type === 'keydown' && e.code === 'KeyM') SFX.toggle();
  };
  const onMouse = e => { if (G && document.pointerLockElement === cv) { G.look.dx += e.movementX; G.look.dy += e.movementY; } };
  const onLock = () => { if (!G) return; G.locked = document.pointerLockElement === cv; if (!G.locked && !G.paused && G.phase !== 'title' && !G.touch) menu('pause'); };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
  document.addEventListener('mousemove', onMouse); document.addEventListener('pointerlockchange', onLock);
  G.off = () => { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); document.removeEventListener('mousemove', onMouse); document.removeEventListener('pointerlockchange', onLock); };
  cv.addEventListener('mousedown', e => {
    if (G.touch || G.phase === 'title' || G.paused) return;
    if (document.pointerLockElement !== cv) { lock(); return; }
    if (e.button === 0) use();
  });
  // touch: left half walks (virtual stick), right half looks, taps use
  const stick = $('#g3-stick', root), knob = stick.querySelector('i');
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = 0;
  view.addEventListener('pointerdown', e => {
    if (!G.touch || e.pointerType === 'mouse' || G.paused || G.phase === 'title' || e.target.closest('button')) return;
    const r = view.getBoundingClientRect();
    if (e.clientX - r.left < r.width * .45 && stickId === null && !G.seated) { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.style.left = (sx - r.left - 50) + 'px'; stick.style.top = (sy - r.top - 50) + 'px'; stick.classList.add('on'); }
    else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; moved = 0; }
  });
  view.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { const dx = Math.max(-40, Math.min(40, e.clientX - sx)), dy = Math.max(-40, Math.min(40, e.clientY - sy)); G.stick.x = dx / 40; G.stick.y = dy / 40; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === lookId) { const dx = e.clientX - lx, dy = e.clientY - ly; G.look.dx += dx * 1.6; G.look.dy += dy * 1.6; moved += Math.abs(dx) + Math.abs(dy); lx = e.clientX; ly = e.clientY; }
  });
  const end = e => {
    if (e.pointerId === stickId) { stickId = null; G.stick.x = G.stick.y = 0; knob.style.transform = ''; stick.classList.remove('on'); }
    else if (e.pointerId === lookId) {
      lookId = null;
      if (moved < 8 && G.seated) { const r = cv.getBoundingClientRect(); G.aim = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }; updateTarget(); use(); G.aim = null; }
    }
  };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  $('#g3-use', root).onclick = () => { if (G.seated && G.phase === 'eating') standUp(); else use(); };
  $('#g3-mute', root).onclick = () => { SFX.toggle(); $('#g3-mute', root).classList.toggle('off', SFX.muted); };
}

PL.apps.lunch = {
  title: 'Lunch Rush',
  mount,
  unmount() {
    if (G) { cancelAnimationFrame(G.raf); G.off && G.off(); G.ro && G.ro.disconnect(); unlock(); G.renderer.dispose(); }
    SFX.ambience(false); G = null; root = null;
  },
  update() { if (G && G.phase === 'title') menu('title'); },
  debug: () => ({ G, act: { openPortion, doScan, sit, bite, standUp, doCompost, doReturn, start } }),
};
})();
