/* Lunch Rush: one school lunch with PlateLoop, first person, PS1-style.
   Take a tray, order at the Healthy Set Meal stall (Mrs Lim asks how much of each dish), scan the full
   tray at the PlateLoop station (the camera moves in so you can read the scanner's screen), sit with your
   friends and eat bite by bite, scan again, scrape the leftovers into the scanner's compost module and put
   the tray on the return rack. People talk to you, react, and go about their lunch; a classmate walks the
   whole routine in the background. The scans are real (PL.scanBefore / PL.scanAfter), so the Kiosk,
   Kitchen and Loopi apps update too.
   Rendering: 240 lines into a render target, then a post pass with film grain, vignette, a slight colour
   grade, 15-bit colour and ordered dithering; vertices snap to a coarse grid; painted, pre-lit textures. */
(() => {
'use strict';
const { $, $$, esc, pct, MENU } = PL;
const L = PL.L3;
let root = null, G = null;

const EYE = 1.55, FOG = '#AEB0A8';
const SERVE = ['rice', 'chicken', 'kailan', 'cabbage', 'soup', 'melon'];
const PICK = [.55, 1, 1.35];
const OBJ = {
  getTray: 'Take a tray from the stack at the Healthy Set Meal stall',
  order: 'Ask Mrs Lim for your lunch',
  scanBefore: 'Scan your full tray at the PlateLoop station, in the far corner',
  findSeat: '{a} and {b} kept a seat for you. Sit down to eat',
  eating: 'Eat your lunch: click the food to take a bite',
  scanAfter: 'Scan your tray again at the PlateLoop station',
  compost: 'Scrape your leftovers into the compost bin on the scanner',
  returnTray: 'Put your tray on the return rack',
  done: 'Lunch done. Talk to people, or press Esc for the menu',
};
// how the six named students look
const LOOKS = {
  s1: { kind: 'girl', hair: 'pony', skin: 0, fringe: true, height: 1.6 },
  s2: { kind: 'boy', hair: 'short', skin: 4, height: 1.72 },
  s3: { kind: 'girl', hair: 'tudung', skin: 2, height: 1.58 },
  s4: { kind: 'pe', hair: 'crop', skin: 1, height: 1.7, glasses: true, house: '#1F5FAF' },
  s5: { kind: 'girl', hair: 'bob', skin: 0, fringe: true, glasses: true, height: 1.57 },
  s6: { kind: 'boy', hair: 'short', skin: 1, height: 1.75 },
};
const lookOf = (name, look) => ({ name, ...look, skin: L.SKINS[look.skin || 0] });

/* ================================================================ mount */
function mount(el) {
  root = el;
  el.innerHTML = `
  <div class="g3">
    <div class="g3-view" id="g3-view">
      <canvas id="g3-cv" tabindex="0"></canvas>
      <div class="g3-hud" id="g3-hud" hidden>
        <div class="g3-obj" id="g3-objbox"><span>OBJECTIVE</span><b id="g3-obj"></b></div>
        <div class="g3-cross" id="g3-cross"></div>
        <div class="g3-prompt" id="g3-prompt" hidden></div>
        <div class="g3-sub" id="g3-sub" hidden><b id="g3-who"></b><span id="g3-say"></span><div class="g3-opts" id="g3-opts"></div></div>
        <div class="g3-msg" id="g3-msg" hidden></div>
        <div class="g3-eat" id="g3-eat" hidden></div>
        <button class="g3-mute" id="g3-mute" aria-label="Sound">SND</button>
        <div class="g3-touch" id="g3-touch"><div class="g3-stick" id="g3-stick"><i></i></div><button class="g3-use" id="g3-use">USE</button></div>
      </div>
      <div class="g3-card" id="g3-card" hidden></div>
      <div class="g3-menu" id="g3-menu"></div>
    </div>
    <p class="g3-help">WASD to walk · Shift to run · move the mouse to look (click the game first, or hold and drag) · arrow keys walk and turn · E or click to use and talk · 1–3 to answer · Esc to pause.</p>
  </div>`;
  if (!window.THREE || !L.buildWorld) { $('#g3-menu', el).innerHTML = '<div class="g3-panel"><h2>3D isn\'t available here</h2><p>Open this app in Chrome, Edge or Safari.</p></div>'; return; }
  try { init(); } catch (e) { console.error(e); $('#g3-menu', el).innerHTML = '<div class="g3-panel"><h2>3D isn\'t available here</h2><p>This browser couldn\'t start WebGL. Try Chrome, Edge or Safari.</p></div>'; return; }
  menu('title');
}

/* ================================================================ init */
function init() {
  const view = $('#g3-view', root), cv = $('#g3-cv', root);
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, .043);
  const camera = new THREE.PerspectiveCamera(68, 4 / 3, .03, 200); camera.rotation.order = 'YXZ'; scene.add(camera);
  // post: grain, vignette, grade, 15-bit colour with ordered dithering
  const rt = new THREE.WebGLRenderTarget(640, 480, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], bd = new Uint8Array(64);
  bayer.forEach((v, i) => { bd[i * 4] = bd[i * 4 + 1] = bd[i * 4 + 2] = Math.round(v / 16 * 255); bd[i * 4 + 3] = 255; });
  const dither = new THREE.DataTexture(bd, 4, 4, THREE.RGBAFormat); dither.magFilter = dither.minFilter = THREE.NearestFilter; dither.wrapS = dither.wrapT = THREE.RepeatWrapping; dither.needsUpdate = true;
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, tDither: { value: dither }, uTime: { value: 0 }, uFade: { value: 0 }, uPx: { value: new THREE.Vector2(1 / 640, 1 / 480) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tDither; uniform float uTime; uniform float uFade; uniform vec2 uPx; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 d = vUv - .5; float r2 = dot(d, d); vec2 off = d * r2 * .008;
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        // soft glow around bright areas (windows, lights, the screen), like light scattering in haze
        vec3 b = vec3(0.0);
        for (int i = 0; i < 8; i++) { float a = float(i) * .785; vec2 o = vec2(cos(a), sin(a)) * uPx * 6.0; b += max(texture2D(tDiffuse, vUv + o).rgb - .62, 0.0); }
        c += b * .16;
        float l = dot(c, vec3(.299, .587, .114)); c = mix(vec3(l), c, .82); c = c * vec3(1.0, 1.0, .97) * .96 + vec3(.012, .013, .012);
        c *= 1.0 - r2 * 1.1;
        c += (hash(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7) - .5) * .035;
        c *= 1.0 - uFade;
        c += (texture2D(tDither, gl_FragCoord.xy / 4.0).r - .5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); postScene.add(post);

  const W = L.buildWorld(scene);
  const SFX = L.Sound();
  Object.assign(SFX.spots, W.spots);
  const screen = L.Screen();

  G = {
    renderer, scene, camera, rt, post, postScene, postCam, W, SFX, screen, view, cv,
    phase: 'title', mode: 'title', paused: true, busy: false, baseFov: 68,
    pos: new THREE.Vector3(0, EYE, 7.6), yaw: 0, pitch: 0, look: { dx: 0, dy: 0 }, keys: {}, stick: { x: 0, y: 0 },
    t: 0, last: performance.now(), raf: 0, stepT: 0, tweens: [], people: [], walkers: [], targets: [], hitMeshes: [],
    ray: new THREE.Raycaster(), touch: matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches,
    pick: {}, eaten: {}, served: false, barkT: {}, chatT: 6, tvT: 0, ready: false,
  };
  const resize = () => {
    const w = view.clientWidth || 800, h = view.clientHeight || 600, a = w / h, lh = Math.round(Math.min(h, G.reading ? 900 : 600));
    renderer.setSize(Math.round(lh * a), lh, false); rt.setSize(Math.round(lh * a), lh); post.material.uniforms.uPx.value.set(1 / (lh * a), 1 / lh);
    camera.aspect = a; G.baseFov = a < 1 ? 86 : 68; if (G.mode !== 'focus') camera.fov = G.baseFov; camera.updateProjectionMatrix();
  };
  G.resize = resize;
  G.ro = new ResizeObserver(resize); G.ro.observe(view); resize();

  buildTray();
  buildPeople();
  loadScanner().then(model => { if (!G) return; setupScanner(model); G.ready = true; if (G.phase === 'title') menu('title'); });
  wireInput();
  G.raf = requestAnimationFrame(loop);
}

/* ================================================================ the scanner (the real 3D model) */
function loadScanner() {
  return new Promise(res => {
    if (!THREE.GLTFLoader) return res(null);
    const loader = new THREE.GLTFLoader(), ok = g => res(g.scene), fail = () => res(null);
    const emb = document.getElementById('model-scanner');
    try {
      if (emb) loader.parse(emb.textContent, '', ok, fail);
      else fetch('scanner.gltf.json').then(r => r.text()).then(t => loader.parse(t, '', ok, fail)).catch(fail);
    } catch (e) { fail(); }
  });
}
function setupScanner(model) {
  const st = G.W.station, S = G.scanner = { group: st, leds: [] };
  if (model) {
    model.traverse(o => {
      if (!o.isMesh) return;
      if (/^PS_Tray/.test(o.name) || (o.parent && /^PS_Tray/.test(o.parent.name))) { o.visible = false; return; }
      if (/ReturnScreen/.test(o.name)) { o.material = new THREE.MeshBasicMaterial({ map: G.screen.tex }); S.screen = o; return; }
      const m = o.material, col = m.color ? m.color.clone() : new THREE.Color('#ccc');
      const em = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > .1;
      o.material = em ? L.basic({ color: m.emissive.clone() }) : L.lam({ color: col, transparent: m.transparent, opacity: m.opacity });
      if (/FaceRing|BinRing|ArmLight|StatusLine/.test(o.name)) S.leds.push(o);
      if (/FaceRing/.test(o.name)) S.faceRing = o; if (/BinRing/.test(o.name)) S.binRing = o;
    });
    // the model's origin is between the cabinet and the compost module; it faces +z
    st.add(model);
  } else {
    // fallback if the model can't load: a simple scanner with the same layout
    const w = L.lam({ color: '#F2F2F0' }), a = L.lam({ color: '#C7CACF' });
    const b = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); st.add(o); return o; };
    b(.8, .86, .46, w, 0, .43, 0); b(.36, .86, .46, w, .585, .43, 0); b(.52, .02, .34, a, .08, .87, .04); b(.11, .72, .08, a, .08, 1.22, -.175); b(.12, .05, .4, a, .08, 1.555, -.02);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(.245, .158), new THREE.MeshBasicMaterial({ map: G.screen.tex })); scr.position.set(-.28, 1.17, .06); scr.rotation.set(-.28, 0, Math.PI); scr.scale.x = -1; st.add(scr); S.screen = scr;
  }
  st.updateMatrixWorld(true);
  // where to look at the screen from: its centre and facing direction
  const sc = new THREE.Vector3(), n = new THREE.Vector3(0, 0, 1);
  S.screen.getWorldPosition(sc);
  const pa = S.screen.geometry.attributes.position, v = i => new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(S.screen.matrixWorld);
  if (pa.count >= 3) { n.subVectors(v(1), v(0)).cross(new THREE.Vector3().subVectors(v(2), v(0))).normalize(); if (n.z < 0) n.negate(); }
  S.screenPos = sc; S.screenN = n;
  const P = (x, y, z) => st.localToWorld(new THREE.Vector3(x, y, z));
  S.scale = P(.08, .89, .05); S.camHead = P(.08, 1.49, .1); S.hole = P(.585, .87, .01); S.faceCam = P(-.28, 1.29, -.02);
  S.pose = {
    screen: { pos: sc.clone().addScaledVector(n, .34), target: sc.clone(), fov: 40, read: true },
    scan: { pos: P(-.62, 1.78, 1.12), target: P(.1, 1.1, 0), fov: 56 },
    compost: { pos: P(.62, 1.62, .72), target: P(.66, .95, .02), fov: 54 },
    look: { pos: P(-.1, 1.55, 1.25), target: P(.1, 1.05, 0), fov: 58 },
  };
  // depth camera beam
  const beam = S.beam = new THREE.Mesh(new THREE.ConeGeometry(.24, .58, 4, 1, true), new THREE.MeshBasicMaterial({ color: '#34C759', transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.rotation.y = Math.PI / 4; beam.position.copy(st.worldToLocal(S.camHead.clone())).add(new THREE.Vector3(0, -.3, -.02)); beam.visible = false; st.add(beam);
  S.line = new THREE.Mesh(new THREE.BoxGeometry(.4, .004, .3), new THREE.MeshBasicMaterial({ color: '#7CFF9A', transparent: true, opacity: .7 })); S.line.visible = false; st.add(S.line);
  // interactions on the scanner: screen, compost module
  addTarget(st, () => {
    if (G.busy) return null;
    if ((G.phase === 'scanBefore' || G.phase === 'scanAfter') && G.hasTray) return 'Use the PlateLoop scanner';
    if (G.phase === 'compost') return 'Scrape your leftovers into the compost';
    return 'Look closely at the scanner';
  }, () => {
    if (G.phase === 'scanBefore' || G.phase === 'scanAfter') return scanFlow(G.phase === 'scanBefore');
    if (G.phase === 'compost') return compostFlow();
    return inspect(G.scanner.pose.screen, 'Back');
  }, 2.6);
  SFX().spots.station = [10.2, 1.2, -8.85];
}
const SFX = () => G.SFX;
const play = (n, p, ...a) => G && G.SFX.play(n, p, ...a);
const at = v => v ? [v.x, v.y, v.z] : null;

/* ================================================================ your tray */
function buildTray() {
  const g = L.trayMesh(false), dishes = {};
  // your hands and cuffs holding the sides
  const skin = L.lam({ color: '#E3B894' }), cuff = L.lam({ color: '#F1F1EC' }), hands = new THREE.Group();
  [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, .09), skin); h.position.set(s * .2, -.004, .07); hands.add(h); const c = new THREE.Mesh(new THREE.BoxGeometry(.07, .06, .12), cuff); c.position.set(s * .24, -.03, .16); c.rotation.x = .5; hands.add(c); });
  g.add(hands); g.visible = false;
  G.camera.add(g);
  const HAND = { pos: new THREE.Vector3(0, -.3, -.46), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(.5, 0, 0)) };
  g.position.copy(HAND.pos); g.quaternion.copy(HAND.quat);
  const spoon = new THREE.Group(), sm = L.lam({ color: '#C9CED3' });
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 3), sm); bowl.scale.set(.018, .006, .026); spoon.add(bowl);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.008, .004, .12), sm); handle.position.z = .08; spoon.add(handle);
  spoon.visible = false; G.camera.add(spoon);
  G.tray = { group: g, dishes, hands, HAND, spoon, spoonRest: new THREE.Vector3(.16, -.2, -.36) };
}
function fillTray(pick) {
  const T = G.tray;
  Object.values(T.dishes).forEach(d => T.group.remove(d));
  T.dishes = {};
  MENU.forEach(d => { const f = L.foodGroup(d.id, pick[d.id] || 1, 7); const [x, z] = L.TRAY_SLOT[d.id]; f.position.set(x, .006, z); f.visible = false; T.group.add(f); T.dishes[d.id] = f; f.traverse(o => { if (o.isMesh) o.userData.dish = d.id; }); });
}
function showDish(id, left = 1) { const f = G.tray.dishes[id]; if (!f) return; f.visible = left > .02; L.setFoodLeft(f, left); }
function trayToWorld(pos, quat, dur = .5) {
  const g = G.tray.group; G.scene.attach(g); G.tray.hands.visible = false;
  const p0 = g.position.clone(), q0 = g.quaternion.clone();
  return tween(dur, e => { g.position.lerpVectors(p0, pos, e); g.quaternion.copy(q0).slerp(quat, e); });
}
function trayToHands(dur = .45) {
  const g = G.tray.group; G.camera.attach(g);
  const p0 = g.position.clone(), q0 = g.quaternion.clone(), H = G.tray.HAND;
  return tween(dur, e => { g.position.lerpVectors(p0, H.pos, e); g.quaternion.copy(q0).slerp(H.quat, e); }).then(() => { G.tray.hands.visible = true; });
}

/* ================================================================ people */
function buildPeople() {
  const W = G.W, add = (P, x, z, ry, pose = 'stand') => { P.root.position.set(x, 0, z); P.root.rotation.y = ry; P.pose = pose; G.scene.add(P.root); G.people.push(P); return P; };
  // staff and named people
  G.auntie = add(L.person({ name: 'Mrs Lim', kind: 'auntie', hair: 'net', hairCol: '#2A2420', skin: L.SKINS[1], adult: true, height: 1.55, build: 1.12, watch: true }), W.pans.kailan, -8.72, 0, 'serve');
  G.rahman = add(L.person({ name: 'Mr Rahman', kind: 'teacher', hair: 'short', skin: L.SKINS[3], adult: true, height: 1.74, glasses: true, stubble: true, watch: true }), 8.7, -6.95, 2.3);
  G.tan = add(L.person({ name: 'Mr Tan', kind: 'cleaner', hair: 'crop', hairCol: '#8C8780', skin: L.SKINS[2], adult: true, height: 1.63, watch: true }), 11.55, -7.55, Math.PI, 'wipe');
  G.drinks = add(L.person({ name: 'Mr Ong', kind: 'uncle', hair: 'crop', hairCol: '#9A948C', skin: L.SKINS[1], adult: true, height: 1.66, watch: true }), -10.3, -8.7, 0);
  G.cook = add(L.person({ name: 'Mrs Chua', kind: 'cook', hair: 'bun', skin: L.SKINS[0], adult: true, height: 1.55, build: 1.08 }), -5.4, -8.85, 0, 'wipe');
  G.makcik = add(L.person({ name: 'Mdm Rosnah', kind: 'makcik', hair: 'tudung', tudungCol: '#E9B8C6', skin: L.SKINS[3], adult: true, height: 1.56, watch: true }), 5.9, -8.7, 0);
  [G.auntie, G.rahman, G.tan, G.drinks, G.cook, G.makcik].forEach(P => talkTarget(P));
  // ambient students from the class list
  const others = PL.S.students.filter(s => !s.named && s.name !== 'Priya');
  const r = L.rng(2026);
  let k = 0;
  const student = (seed) => {
    const s = others[k++ % others.length], rr = L.rng(seed), kind = rr() < .22 ? 'pe' : rr() < .5 ? 'boy' : 'girl';
    const hair = kind === 'girl' ? ['pony', 'bob', 'long', 'tudung', 'pony', 'long'][Math.floor(rr() * 6)] : ['short', 'crop', 'short'][Math.floor(rr() * 3)];
    return L.person({ name: s.name, kind, hair, fringe: rr() < .4, glasses: rr() < .22, skin: L.SKINS[Math.floor(rr() * 6)], hairCol: L.HAIRS[Math.floor(rr() * 5)], height: 1.52 + rr() * .24, build: .94 + rr() * .12, seed });
  };
  // friends' table: near the station, two seats for them and one saved for you with a tissue packet
  G.friendTable = W.tables.find(t => t.x === 4.7 && t.z === -3);
  const chope = new THREE.Mesh(new THREE.BoxGeometry(.12, .025, .08), L.lam({ color: '#F4F4F2' })); chope.position.set(4.7, .49, -2.28); G.scene.add(chope); G.chope = chope;
  G.friendTable.spots.find(s => s.side === 1 && Math.abs(s.x - 4.7) < .01).taken = 'you';
  G.dishaTable = L.FACES && L.FACES.disha ? W.tables.find(t => t.x === -4.7 && t.z === 1) : null;
  // seated students around the room
  W.tables.forEach((t, ti) => {
    t.spots.forEach((s, si) => {
      if (s.taken || t === G.friendTable || t === G.dishaTable) return;
      if (r() > (Math.abs(t.x) < 6 ? .5 : .36)) return;
      const P = add(student(ti * 10 + si + 1), s.x, s.z, s.side > 0 ? Math.PI : 0, r() < .6 ? 'eat' : 'sit');
      P.watch = r() < .35; s.taken = P; P.seat = s; P.table = t;
      const tray = L.trayMesh(true, ti * 13 + si); tray.position.set(s.x, .787, t.z + s.side * .2); tray.rotation.y = s.side > 0 ? 0 : Math.PI; G.scene.add(tray);
      talkTarget(P);
    });
  });
  // buddies look at each other when they chat
  G.people.forEach(P => { if (P.table) P.buddies = G.people.filter(Q => Q !== P && Q.table === P.table); });
  // standing students: noodle queue, drinks stall, sink
  G.solidPeople = [];
  [[-5.9, -6.95, Math.PI], [-5.3, -6.55, Math.PI + .3], [-10.6, -6.95, Math.PI]].forEach(([x, z, ry], i) => { const P = add(student(300 + i), x, z, ry); G.solidPeople.push(P); talkTarget(P); });
  const sink = add(student(311), -12.2, 2.1, -Math.PI / 2, 'wipe'); G.solidPeople.push(sink); talkTarget(sink);
  // Sophie dances next to the Healthy Set Meal stall, to music from her phone
  if (L.FACES && L.FACES.sophie) {
    const so = G.sophie = add(L.person({ name: 'Sophie', kind: 'pe', house: '#2A5E9E', face: 'sophie', hair: 'bun', hairCol: '#141214', capTilt: -.82, height: 1.6, watch: false, smooth: true, seed: 505 }), -4.2, -5.35, .5, 'dance');
    so.homeYaw = .5; G.solidPeople.push(so); talkTarget(so);
    // her boombox on a stool
    const stool = new THREE.Mesh(new THREE.BoxGeometry(.4, .45, .4), L.lam({ color: '#6E757C' })); stool.position.set(-3.1, .225, -5.9); G.scene.add(stool);
    const box = new THREE.Group(); box.position.set(-3.1, .45, -5.9); box.rotation.y = -.6; G.scene.add(box);
    const bodyM = L.lam({ map: L.tex(128, 64, c => { c.fillStyle = '#B9BDC2'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#2A2D31'; c.fillRect(44, 10, 40, 14); c.fillStyle = '#7FE0A0'; c.fillRect(48, 14, 22, 6); c.fillStyle = '#E0473A'; c.fillRect(74, 14, 6, 6); for (let x = 46; x < 82; x += 6) { c.fillStyle = '#44484D'; c.fillRect(x, 30, 4, 4); } }) });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.46, .24, .14), bodyM); body.position.y = .12; box.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.34, .025, .025), L.lam({ color: '#2A2D31' })); handle.position.y = .28; box.add(handle);
    [-1, 1].forEach(s => { const post = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, .02), L.lam({ color: '#2A2D31' })); post.position.set(s * .16, .255, 0); box.add(post); });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .35, 4), L.lam({ color: '#C9CED3' })); ant.position.set(.18, .4, -.03); ant.rotation.z = -.35; box.add(ant);
    const cone = L.lam({ map: L.tex(64, 64, c => { c.fillStyle = '#1A1B1D'; c.fillRect(0, 0, 64, 64); [30, 22, 14].forEach((r, i) => { c.strokeStyle = i % 2 ? '#3A3D42' : '#55595F'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, r, 0, Math.PI * 2); c.stroke(); }); c.fillStyle = '#6A6E74'; c.beginPath(); c.arc(32, 32, 7, 0, Math.PI * 2); c.fill(); }) });
    const speakers = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.CircleGeometry(.075, 16), cone); m.position.set(s * .15, .11, .072); box.add(m); return m; });
    G.boombox = { speakers };
    // the disco: a mirror ball, sweeping beams, coloured lights and dots of light on the floor, always on
    const d = new THREE.Group(); d.position.set(so.root.position.x, 0, so.root.position.z); d.visible = false; G.scene.add(d);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .9, 4), L.lam({ color: '#222' })); cord.position.y = 3.75; d.add(cord);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({ map: L.tex(64, 32, c => { for (let y = 0; y < 32; y += 4) for (let x = 0; x < 64; x += 4) { const v = 150 + Math.random() * 105; c.fillStyle = `rgb(${v},${v},${v + 10})`; c.fillRect(x, y, 3, 3); } }) }));
    ball.position.y = 3.25; d.add(ball);
    const COLS = ['#FF2D95', '#2DE1FF', '#FFD62D', '#7CFF4F', '#B04DFF', '#FF7A2D'];
    const glowTex = L.tex(64, 64, c => L.blob(c, 32, 32, 32, 32, '#FFFFFF', 1));
    const beams = COLS.map(col => { const m = new THREE.Mesh(new THREE.ConeGeometry(.35, 3.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.geometry.translate(0, -1.6, 0); m.rotation.order = 'YXZ'; m.position.y = 3.25; d.add(m); return m; });
    const dots = Array.from({ length: 14 }, (_, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(.22, 14), new THREE.MeshBasicMaterial({ color: COLS[i % COLS.length], map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .012; d.add(m); return m; });
    const lights = ['#FF2D95', '#2DE1FF', '#FFD62D'].map(col => { const l = new THREE.PointLight(col, 0, 5, 1.4); l.position.set(d.position.x, 2, d.position.z); G.scene.add(l); return l; });
    G.disco = { group: d, ball, beams, dots, lights, level: 0, on: true };
    W.spots.music = G.SFX.spots.music = [-3.1, .6, -5.9];
  }
  // Disha floats cross-legged above a table in a beam of light, and tells fortunes
  if (G.dishaTable) {
    const T = G.dishaTable, di = G.disha = add(L.person({ name: 'Disha', kind: 'girl', bottom: 'shorts', face: 'disha', hair: 'long', hairCol: '#140F0E', capTilt: -.85, height: 1.58, watch: false, smooth: true, seed: 808 }), T.x, T.z, 0, 'pray');
    di.homeYaw = 0; di.prompt = 'Ask Disha for your fortune'; talkTarget(di);
    const grad = L.tex(8, 64, (c, w, h) => { const g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(.25, 'rgba(255,255,255,.7)'); g2.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g2; c.fillRect(0, 0, w, h); });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18, .95, 3.3, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#FFE9B8', map: grad, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(T.x, 2.55, T.z); G.scene.add(beam);
    const glow = L.tex(64, 64, c => L.blob(c, 32, 32, 32, 32, '#FFFFFF', 1));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(.9, 28), new THREE.MeshBasicMaterial({ color: '#FFE3A6', transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, map: glow }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(T.x, .79, T.z); G.scene.add(pool);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#FFE7B0', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, map: glow }));
    halo.scale.set(1.15, 1.15, 1); G.scene.add(halo);
    const light = new THREE.PointLight('#FFE3B0', .9, 4.5, 1.6); light.position.set(T.x, 2.3, T.z); G.scene.add(light);
    const n = 60, sp = new Float32Array(n * 3), sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#FFF1C8', size: 2.5, sizeAttenuation: false, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); G.scene.add(sparks);
    G.shrine = { T, halo, sparks, sp, n, beam };
    W.spots.shrine = G.SFX.spots.shrine = [T.x, 1.6, T.z];
  }
  // Priya walks the whole PlateLoop routine in the background
  const priya = G.priya = add(L.person({ name: 'Priya', kind: 'girl', hair: 'long', skin: L.SKINS[4], height: 1.6, watch: true, seed: 77 }), 3.9, -6.9, Math.PI / 2, 'walk');
  priya.carrying = true;
  priya.walk = { i: 0, wait: 0, path: [
    [5.8, -6.8], [8.4, -7.2], [9.95, -7.75, 3.2, 'stand', P => npcScan(P, false)],
    [8.6, -5.4], [7.4, -4.3], [7.3, 1.2, 7, 'stand'], [7.4, -4.3], [9.1, -6.2],
    [9.95, -7.75, 3.2, 'stand', P => npcScan(P, true)], [10.6, -7.7, 1.6, 'stand', () => play('scrape', at(G.scanner && G.scanner.hole))],
    [11.6, -7.95, 1.4, 'stand', P => { P.carrying = false; play('tray', G.W.spots.rack); }],
    [9.2, -6.6], [4.2, -6.75], [-1.2, -6.85], [-2.9, -6.6, 1.2, 'stand', P => { P.carrying = true; play('trayDown', [-3, 1, -6.9]); }], [0, -6.85, 2, 'stand'], [2.8, -6.85, 2, 'stand'],
  ] };
  talkTarget(priya);
  G.walkers.push(priya);
  // two more students walking about
  const w1 = add(student(401), -6, -4.8, 0, 'walk'); w1.walk = { i: 0, wait: 0, path: [[-11.4, -4.7], [-11.6, 1.2], [-11.8, 2.1, 4, 'wipe'], [-11.4, -4.7], [-6, -4.1, 5, 'stand'], [-1, -4.1]] };
  const w2 = add(student(402), -3, -4.9, 0, 'walk'); w2.walk = { i: 0, wait: 0, path: [[-6.6, -4.1], [-10.1, -6.7, 4, 'stand'], [-10, -5], [-7, 6.8], [-2.3, 7.4, 6, 'stand'], [-2.3, -4.1]] };
  [w1, w2].forEach(P => { G.walkers.push(P); talkTarget(P); });
  // standing people you bump into
  G.solidPeople.push(G.rahman, G.tan);
}
function makeFriends(sid) {
  (G.friends || []).forEach(P => { G.scene.remove(P.root); G.people = G.people.filter(Q => Q !== P); G.targets = G.targets.filter(t => t.person !== P); });
  const ids = PL.S.students.filter(s => s.named && s.id !== sid).slice(0, 2);
  const T = G.friendTable;
  G.friends = ids.map((s, i) => {
    const P = L.person({ ...lookOf(s.name, LOOKS[s.id]), watch: true, seed: L.hash(s.id) });
    const spot = T.spots.find(q => q.side === -1 && Math.abs(q.x - (T.x + (i ? 0 : -.8))) < .01);
    P.root.position.set(spot.x, 0, spot.z); P.pose = i ? 'eat' : 'sit'; spot.taken = P; P.table = T; P.friend = true;
    G.scene.add(P.root); G.people.push(P);
    const tray = L.trayMesh(true, 90 + i); tray.position.set(spot.x, .787, T.z - .2); tray.rotation.y = Math.PI; G.scene.add(tray);
    talkTarget(P);
    return P;
  });
  G.friends.forEach(P => { P.buddies = G.friends.filter(Q => Q !== P); });
}

/* ================================================================ interaction targets */
function addTarget(obj, label, act, range = 2.4, extra = {}) {
  const t = { obj, label, act, range, ...extra };
  obj.traverse(o => { if (o.isMesh) { o.userData.tgt = t; G.hitMeshes.push(o); } });
  G.targets.push(t);
  return t;
}
function talkTarget(P) {
  return addTarget(P.root, () => (G.busy ? null : P === G.auntie && G.phase === 'order' ? 'Ask Mrs Lim for lunch' : P.prompt || `Talk to ${P.name}`), () => talk(P), 2.6, { person: P });
}
function refreshHitMeshes() { G.hitMeshes = []; G.targets.forEach(t => t.obj.traverse(o => { if (o.isMesh) { o.userData.tgt = t; G.hitMeshes.push(o); } })); }
function setupStaticTargets() {
  const W = G.W;
  addTarget(W.trayStack, () => (G.phase === 'getTray' && !G.busy ? 'Take a tray' : null), takeTray, 2.4);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.2, 1), new THREE.MeshBasicMaterial({ visible: false })); counter.position.set(.2, .6, -7.9); G.scene.add(counter);
  addTarget(counter, () => (G.phase === 'order' && !G.busy ? 'Ask Mrs Lim for lunch' : null), () => talk(G.auntie), 2.4);
  addTarget(W.standee.group, () => (G.busy ? null : 'Read the how-to sign'), () => { const p = new THREE.Vector3(); W.standee.mesh.getWorldPosition(p); const n = new THREE.Vector3(Math.sin(-.75), 0, Math.cos(-.75)); return inspect({ pos: p.clone().addScaledVector(n, .62).add(new THREE.Vector3(0, .05, 0)), target: p, fov: 50, read: true }, 'Back'); }, 2.4);
  addTarget(W.tv.mesh, () => (G.busy ? null : 'Look at the PlateLoop Live screen'), () => { W.tv.draw(); return inspect({ pos: new THREE.Vector3(11.3, 2.15, -5.6), target: new THREE.Vector3(12.94, 2.2, -5.6), fov: 46, read: true }, 'Back'); }, 3.5);
  W.posters.forEach(p => { const [x, y, z] = p.at; const n = new THREE.Vector3(); p.mesh.getWorldDirection(n); addTarget(p.mesh, () => (G.busy ? null : p.label), () => inspect({ pos: new THREE.Vector3(x, y, z).addScaledVector(n, .75), target: new THREE.Vector3(x, y, z), fov: 50, read: true }, 'Back'), 2.4); });
  addTarget(W.rack, () => (G.phase === 'returnTray' && !G.busy ? 'Put your tray on the rack' : null), returnFlow, 2.6);
  W.tables.forEach(t => addTarget(t.group, () => (G.phase === 'findSeat' && !G.busy ? (t === G.friendTable ? `Sit with ${G.friends.map(f => f.name).join(' and ')}` : 'Sit here') : null), () => sit(t), 2.6));
}

/* ================================================================ loop */
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
function loop(now) {
  if (!G || !root || !root.isConnected) return;
  const dt = Math.min(.05, (now - G.last) / 1000); G.last = now; G.t += dt;
  const { camera, W } = G;
  // camera
  if (G.mode === 'title') { G.yaw += dt * .06; camera.position.set(Math.sin(G.t * .05) * 3, 2.3, 6.5); camera.rotation.set(-.1, G.yaw, 0); }
  else if (G.mode === 'walk' || G.mode === 'seat') {
    if (!G.paused) {
      const turn = (G.keys.ArrowLeft ? 1 : 0) - (G.keys.ArrowRight ? 1 : 0);
      G.yaw += turn * dt * 2.2 - G.look.dx * .0024; G.pitch -= G.look.dy * .0024;
    }
    G.look.dx = G.look.dy = 0;
    if (G.faceTarget) { // turn to whoever is talking
      G.faceTarget.head.getWorldPosition(V); V2.subVectors(V, camera.position);
      const wy = Math.atan2(-V2.x, -V2.z), wp = Math.atan2(V2.y, Math.hypot(V2.x, V2.z));
      let dy = wy - G.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      G.yaw += dy * Math.min(1, dt * 5); G.pitch += (wp - G.pitch) * Math.min(1, dt * 5);
    }
    G.pitch = Math.max(-1.35, Math.min(1.25, G.pitch));
    if (G.mode === 'walk') move(dt); else camera.position.copy(G.seatPos);
    camera.rotation.set(G.pitch, G.yaw, 0);
  }
  G.tweens = G.tweens.filter(tw => { tw.t += dt / tw.dur; const k = Math.min(1, tw.t), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; tw.fn(e); if (k >= 1) { tw.done(); return false; } return true; });
  // life
  const cam = camera.position;
  G.walkers.forEach(P => {
    if (G.talkingTo === P) { P.pose = 'stand'; return; }
    const blocked = G.mode !== 'title' && cam.distanceTo(V.set(P.root.position.x, EYE, P.root.position.z)) < .8;
    if (!blocked) L.walkPerson(P, dt, 1.05); else P.pose = 'stand';
  });
  G.people.forEach(P => {
    if (P.faceYaw !== undefined) { let d = P.faceYaw - P.root.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; P.root.rotation.y += d * Math.min(1, dt * 6); }
    if (P.buddies && P.buddies.length && Math.random() < dt * .12) P.chatWith = Math.random() < .6 ? P.buddies[Math.floor(Math.random() * P.buddies.length)] : null;
    if (!P.lookAt && P.chatWith && !(P.watch && cam.distanceTo(P.root.position) < 3.5)) { P._look = P._look || new THREE.Vector3(); P.chatWith.head.getWorldPosition(P._look); P.lookAt = P._look; L.animPerson(P, dt, cam); P.lookAt = null; }
    else L.animPerson(P, dt, cam);
  });
  // background chatter at tables: someone is always talking
  G.chatT -= dt; if (G.chatT < 0) { G.chatT = 2 + Math.random() * 3; const seated = G.people.filter(P => P.table && !P.friend); seated.forEach(P => { if (P !== G.talkingTo) P.talking = false; }); for (let i = 0; i < 6; i++) { const P = seated[Math.floor(Math.random() * seated.length)]; if (P) P.talking = true; } }
  if (G.boombox) { const k = 1 + .09 * Math.pow(Math.abs(Math.sin(G.t * Math.PI * 2.133)), 4); G.boombox.speakers.forEach(sp => sp.scale.setScalar(k)); }
  if (G.disco) {
    const D = G.disco; D.level += ((D.on ? 1 : 0) - D.level) * Math.min(1, dt * 2.5);
    D.group.visible = D.level > .01;
    if (D.group.visible) {
      const t = G.t, L2 = D.level;
      D.ball.rotation.y += dt * 1.2; D.ball.position.y = 3.25 + (1 - L2) * .9;
      D.beams.forEach((b, i) => { const a = t * (.7 + i * .09) + i * 1.05; b.rotation.set(.55 + .25 * Math.sin(t * 1.3 + i), a, 0); b.material.opacity = .13 * L2; });
      D.dots.forEach((m, i) => { const a = t * (.5 + (i % 4) * .15) * (i % 2 ? 1 : -1) + i * .9, r = .6 + (i % 5) * .45; m.position.x = Math.cos(a) * r; m.position.z = Math.sin(a) * r; m.material.opacity = .55 * L2; });
      }
    D.lights.forEach((l, i) => { const a = G.t * 1.6 + i * 2.1; l.position.set(D.group.position.x + Math.cos(a) * 1.2, 2, D.group.position.z + Math.sin(a) * 1.2); l.intensity = 1.3 * D.level * (.6 + .4 * Math.abs(Math.sin(G.t * 6.7 + i))); });
  }
  if (G.shrine) {
    const s = G.shrine, y = 1.08 + (s.lift || 0) + Math.sin(G.t * 1.1) * .06;
    G.disha.root.position.y = y; s.halo.position.set(s.T.x, y + .62, s.T.z); s.halo.material.opacity = .26 + Math.sin(G.t * 1.7) * .06;
    for (let i = 0; i < s.n; i++) { const a = G.t * (.3 + (i % 5) * .08) + i * 2.4, r = .35 + (i % 7) * .09; s.sp[i * 3] = s.T.x + Math.cos(a) * r; s.sp[i * 3 + 1] = .95 + ((G.t * .25 + i * .137) % 1) * 1.6; s.sp[i * 3 + 2] = s.T.z + Math.sin(a) * r; }
    s.sparks.geometry.attributes.position.needsUpdate = true;
  }
  W.update(dt, G.t, camera);
  G.screen.tick(dt);
  G.tvT -= dt; if (G.tvT < 0) { G.tvT = 3; W.tv.draw(); }
  SFX().listen(camera); SFX().tick(dt);
  if (G.dlg && G.dlg.typing) typeTick(dt);
  if (G.mode !== 'title' && !G.paused) { updateTarget(); barks(); if (G.phase === 'eating' && G.friends) friendChat(dt); }
  G.post.material.uniforms.uTime.value = G.t;
  if (!!G.reading !== !!G.wasReading) { G.wasReading = G.reading; G.resize(); }
  G.renderer.setRenderTarget(G.rt); G.renderer.render(G.scene, camera);
  G.renderer.setRenderTarget(null); G.renderer.render(G.postScene, G.postCam);
  G.raf = requestAnimationFrame(loop);
}
function move(dt) {
  const { camera } = G;
  let fx = 0, fz = 0;
  if (!G.busy && !G.paused && !G.dlg) {
    if (G.keys.KeyW || G.keys.ArrowUp) fz -= 1; if (G.keys.KeyS || G.keys.ArrowDown) fz += 1;
    if (G.keys.KeyA) fx -= 1; if (G.keys.KeyD) fx += 1;
    fx += G.stick.x; fz += G.stick.y;
  }
  const len = Math.hypot(fx, fz), run = G.keys.ShiftLeft || G.keys.ShiftRight;
  if (len > .05) {
    const sp = (run ? 4.2 : 2.6) * dt / Math.max(1, len), s = Math.sin(G.yaw), c = Math.cos(G.yaw);
    tryMove((fx * c + fz * s) * sp, 0); tryMove(0, (-fx * s + fz * c) * sp);
    G.stepT += dt * (run ? 1.5 : 1); if (G.stepT > .42) { G.stepT = 0; play('step'); }
    G.bob = (G.bob || 0) + dt * (run ? 13 : 9);
  }
  camera.position.set(G.pos.x, G.pos.y + (len > .05 ? Math.sin(G.bob) * .022 : 0), G.pos.z);
}
function tryMove(dx, dz) {
  const nx = G.pos.x + dx, nz = G.pos.z + dz, r = .26;
  if (!G.W.bounds(nx, nz)) return;
  if (G.W.colliders.some(c => nx > c.minX - r && nx < c.maxX + r && nz > c.minZ - r && nz < c.maxZ + r)) return;
  const ppl = G.solidPeople.concat(G.walkers, G.friends || []);
  if (ppl.some(P => { const px = P.root.position.x, pz = P.root.position.z, dn = Math.hypot(px - nx, pz - nz); return dn < .42 && dn < Math.hypot(px - G.pos.x, pz - G.pos.z); })) return;
  G.pos.x = nx; G.pos.z = nz;
}
function updateTarget() {
  const prompt = $('#g3-prompt', root); if (!prompt) return;
  let text = null;
  G.target = null;
  if (G.waiting) text = G.waiting.label;
  else if (G.dlg) text = null;
  else if (G.mode === 'seat' && G.phase === 'eating') {
    G.ray.setFromCamera(G.aim || { x: 0, y: 0 }, G.camera); G.ray.far = 3;
    const meshes = []; Object.values(G.tray.dishes).forEach(g => g.traverse(o => { if (o.isMesh && o.visible && o.userData.dish) meshes.push(o); }));
    const h = G.ray.intersectObjects(meshes, false)[0];
    G.aimDish = h ? h.object.userData.dish : null;
    if (G.aimDish) text = `Eat the ${PL.DISH[G.aimDish].name.toLowerCase()}`;
  } else if (G.mode === 'walk' && !G.busy) {
    G.ray.setFromCamera({ x: 0, y: 0 }, G.camera); G.ray.far = 3.6;
    const hits = G.ray.intersectObjects(G.hitMeshes, false);
    for (const h of hits) { const t = h.object.userData.tgt; if (!t || h.distance > t.range) continue; const l = t.label(); if (l) { G.target = t; text = l; } break; }
  }
  $('#g3-cross', root).classList.toggle('on', !!text);
  prompt.hidden = !text;
  if (text) prompt.innerHTML = `<b>${G.touch ? 'USE' : 'E'}</b> ${esc(text)}`;
}

/* ================================================================ tweens, dialogue, prompts */
const sleep = ms => new Promise(r => setTimeout(r, ms));
function tween(dur, fn) { return new Promise(res => G.tweens.push({ t: 0, dur, fn, done: res })); }
function objective() { const f = G.friends || []; $('#g3-obj', root).textContent = (OBJ[G.phase] || '').replace('{a}', f[0] ? f[0].name : '').replace('{b}', f[1] ? f[1].name : ''); const b = $('#g3-objbox', root); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
function setPhase(p) { G.phase = p; objective(); $('#g3-hud', root).classList.toggle('eating', p === 'eating'); }
function msg(text, ms = 3000) { const el = $('#g3-msg', root); if (!el) return; el.innerHTML = text; el.hidden = false; clearTimeout(G.msgT); G.msgT = setTimeout(() => { if (el) el.hidden = true; }, ms); }
function showSub(who, text, ambient) {
  const s = $('#g3-sub', root); s.hidden = false; s.classList.toggle('amb', !!ambient);
  $('#g3-who', root).textContent = who ? who + ':' : ''; $('#g3-say', root).textContent = text; $('#g3-opts', root).innerHTML = '';
}
function hideSub() { const s = root && $('#g3-sub', root); if (s) s.hidden = true; }
function say(P, text, options) {
  return new Promise(res => {
    clearTimeout(G.chatHide);
    G.dlg = { P, text, shown: 0, typing: true, options: options || null, resolve: res };
    if (P) P.talking = true;
    showSub(P ? P.name : '', '');
  });
}
const ask = (P, text, options) => say(P, text, options);
function typeTick(dt) {
  const d = G.dlg, before = Math.floor(d.shown);
  d.shown = Math.min(d.text.length, d.shown + dt * 48);
  const n = Math.floor(d.shown);
  $('#g3-say', root).textContent = d.text.slice(0, n);
  if (n >= d.text.length) finishTyping();
}
function finishTyping() {
  const d = G.dlg; if (!d) return;
  d.typing = false; d.shown = d.text.length; $('#g3-say', root).textContent = d.text;
  if (d.P) d.P.talking = false;
  if (d.options) {
    $('#g3-opts', root).innerHTML = d.options.map((o, i) => `<button data-opt="${i}"><i>${i + 1}</i>${esc(o)}</button>`).join('');
    $$('[data-opt]', root).forEach(b => b.onclick = e => { e.stopPropagation(); choose(+b.dataset.opt); });
  } else $('#g3-opts', root).innerHTML = `<small>${G.touch ? 'Tap' : 'E / click'} to continue</small>`;
}
function advance() { const d = G.dlg; if (!d) return false; if (d.typing) { finishTyping(); return true; } if (d.options) return true; G.dlg = null; d.resolve(-1); return true; }
function choose(i) { const d = G.dlg; if (!d || d.typing || !d.options || i < 0 || i >= d.options.length) return; G.dlg = null; play('select'); d.resolve(i); }
function waitUse(label) { return new Promise(res => { G.waiting = { label, resolve: res }; }); }
/** Run a conversation: face the person, quieter crowd, lock movement. */
async function convo(P, fn) {
  if (G.busy) return;
  G.busy = true; G.talkingTo = P; SFX().duck(true);
  let home = null;
  if (P) {
    P.lookAt = G.camera.position; if (G.mode !== 'focus') G.faceTarget = P;
    // people who are standing turn round to face you
    if (!P.table && P !== G.auntie) { home = { yaw: P.root.rotation.y, pose: P.pose }; const d = G.camera.position; P.faceYaw = Math.atan2(d.x - P.root.position.x, d.z - P.root.position.z); if (P.pose === 'wipe' || P.pose === 'walk') P.pose = 'stand'; if (P.pose === 'dance') home.yaw = P.homeYaw; }
  }
  try { await fn(); } finally {
    if (P && home) { P.faceYaw = home.yaw; P.pose = home.pose; setTimeout(() => { if (P.faceYaw === home.yaw) P.faceYaw = undefined; }, 1500); }
    hideSub(); if (P) { P.lookAt = null; P.talking = false; }
    if (G) { G.faceTarget = null; G.busy = false; G.talkingTo = null; SFX().duck(false); }
  }
}
/** A line said in passing, without stopping you. */
function chatter(P, text, ms = 3400) {
  if (!G || G.dlg) return;
  showSub(P.name, text, true); P.talking = true;
  clearTimeout(G.chatHide); G.chatHide = setTimeout(() => { if (!G) return; P.talking = false; if (!G.dlg) hideSub(); }, ms);
}
function barks() {
  if (G.busy) return;
  const near = (P, d) => G.camera.position.distanceTo(V.set(P.root.position.x, EYE, P.root.position.z)) < d;
  const once = (k, cd, fn) => { if ((G.barkT[k] || 0) > G.t) return; G.barkT[k] = G.t + cd; fn(); };
  if (G.phase === 'scanBefore' && near(G.rahman, 3)) once('rahman1', 25, () => chatter(G.rahman, 'Tray here first. Look at the camera, then put it on the scale.'));
  if (G.phase === 'findSeat' && G.friends && near(G.friends[0], 4.5)) once('friends1', 30, () => { const F = G.friends[0]; F.pose = 'wave'; setTimeout(() => { if (G && F) F.pose = 'sit'; }, 2400); chatter(F, `${first()}! Over here, we saved you a seat.`); });
  if (G.phase === 'getTray' && near(G.auntie, 3.2)) once('auntie1', 30, () => chatter(G.auntie, 'Please take a tray from the stack first.'));
  if (G.phase === 'compost' && near(G.tan, 3)) once('tan1', 25, () => chatter(G.tan, 'Scrape your leftovers into the compost first. It\'s the white bin beside the scanner.'));
  if (G.phase === 'scanAfter' && near(G.rahman, 3)) once('rahman2', 25, () => chatter(G.rahman, 'Done eating? Scan it again, same as before.'));
}
const first = () => (G.student ? G.student.name.split(' ')[0] : '');

/* ================================================================ focus camera */
const lookQuat = (pos, target) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0)));
function focus(pose, dur = .7) {
  G.mode = 'focus'; G.reading = !!pose.read; $('#g3-hud', root).classList.add('focus');
  const cam = G.camera, p0 = cam.position.clone(), q0 = cam.quaternion.clone(), f0 = cam.fov, q1 = lookQuat(pose.pos, pose.target), f1 = pose.fov || G.baseFov;
  play('whoosh');
  return tween(dur, e => { cam.position.lerpVectors(p0, pose.pos, e); cam.quaternion.copy(q0).slerp(q1, e); cam.fov = f0 + (f1 - f0) * e; cam.updateProjectionMatrix(); });
}
function unfocus(dur = .6) {
  const cam = G.camera, p0 = cam.position.clone(), q0 = cam.quaternion.clone(), f0 = cam.fov;
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(G.pitch, G.yaw, 0, 'YXZ')), p1 = G.pos.clone();
  G.reading = false; $('#g3-hud', root).classList.remove('focus');
  return tween(dur, e => { cam.position.lerpVectors(p0, p1, e); cam.quaternion.copy(q0).slerp(q1, e); cam.fov = f0 + (G.baseFov - f0) * e; cam.updateProjectionMatrix(); }).then(() => { if (G) G.mode = 'walk'; });
}
async function inspect(pose, back = 'Back') {
  if (G.busy) return; G.busy = true;
  await focus(pose); await waitUse(back); await unfocus();
  G.busy = false;
}

/* ================================================================ the lunch */
function takeTray() {
  G.busy = true;
  const top = G.W.trayStackTop(); if (top) top.visible = false;
  fillTray({}); G.tray.group.visible = true; G.hasTray = true;
  G.camera.attach(G.tray.group); G.tray.group.position.copy(G.tray.HAND.pos).add(new THREE.Vector3(0, -.25, 0)); G.tray.group.quaternion.copy(G.tray.HAND.quat);
  trayToHands(.35).then(() => { G.busy = false; });
  play('tray', [G.pos.x, 1, G.pos.z]);
  setPhase('order');
  setTimeout(() => G && chatter(G.auntie, `Hello, ${first()}. The healthy set today?`), 600);
}
async function orderFlow() {
  const A = G.auntie, W = G.W;
  await convo(A, async () => {
    await say(A, `Hello, ${first()}. Put your tray on the rail and I\'ll serve you.`);
    G.faceTarget = null;
    const railQ = new THREE.Quaternion(), railPos = x => new THREE.Vector3(x, W.railY, W.railZ);
    const camPose = x => ({ pos: new THREE.Vector3(x + .05, 1.66, -6.72), target: new THREE.Vector3(x, 1.02, -7.85), fov: 64 });
    await Promise.all([focus(camPose(W.pans.rice), .7), trayToWorld(railPos(W.pans.rice), railQ, .6)]);
    play('trayDown', [W.pans.rice, 1, W.railZ]);
    const lines = {
      rice: ['How much rice? It\'s brown rice today.', ['Less rice, please', 'Normal', 'More rice']],
      chicken: ['Soy sauce chicken. How many pieces?', ['Just one piece', 'Normal', 'Extra piece']],
      kailan: ['It\'s Kailan Week. Would you like to try some?', ['Just a little', 'Normal', 'Lots, please']],
      cabbage: ['Some braised cabbage too?', ['A little', 'Normal', 'More']],
      soup: ['ABC soup? It\'s hot. A full bowl?', ['Half bowl', 'Full bowl', 'Extra']],
      melon: ['Watermelon for dessert.', ['One slice', 'Two slices', 'Three slices']],
    };
    let more = 0, less = 0;
    for (const id of SERVE) {
      const x = W.pans[id];
      // Mrs Lim moves along, the tray slides along the rail
      const ax = A.root.position.x; A.pose = 'walk';
      const g = G.tray.group, gp = g.position.clone(), cam = G.camera, cp = cam.position.clone(), c = camPose(x);
      await tween(.5, e => { A.root.position.x = ax + (x - ax) * e; A.walkPh = (A.walkPh || 0) + .12; g.position.lerpVectors(gp, railPos(x), e); cam.position.lerpVectors(cp, c.pos, e); cam.quaternion.copy(lookQuat(cam.position, c.target)); });
      A.pose = 'serve';
      const [q, opts] = lines[id];
      const i = await ask(A, q, opts);
      if (i === 0) less++; if (i === 2) more++;
      G.pick[id] = PICK[Math.max(0, i)];
      A.act = { kind: 'scoop', t0: A.t };
      play('ladle', [x, 1.1, -8]);
      await sleep(450);
      replaceDish(id, G.pick[id]); showDish(id, 1);
      play('trayDown', [x, 1, W.railZ]);
      await sleep(250);
    }
    A.pose = 'serve';
    const end = more >= 3 ? 'You\'re hungry today! Try to finish it all. The scanner will know.' : less >= 3 ? 'A small portion, good choice. Come back if you\'re still hungry.' : 'There you go. Scan it at the PlateLoop station before you eat.';
    await say(A, end);
    await Promise.all([trayToHands(.5), unfocus(.6)]);
    G.served = true; setPhase('scanBefore');
    msg('Your tray is ready. Take it to the <b>PlateLoop station</b> in the far corner.', 3600);
  });
}
function replaceDish(id, m) {
  const T = G.tray, old = T.dishes[id]; if (old) T.group.remove(old);
  const f = L.foodGroup(id, m, 7); const [x, z] = L.TRAY_SLOT[id]; f.position.set(x, .006, z); T.group.add(f); T.dishes[id] = f;
  f.traverse(o => { if (o.isMesh) o.userData.dish = id; });
}
/** The PlateLoop scan, before or after lunch, seen up close. */
async function scanFlow(before) {
  const S = G.scanner, st = G.student, scr = G.screen, spos = at(S.screenPos);
  if (G.npcScanning) { msg(`Wait a moment, ${G.npcScanning} is using the scanner.`); return; }
  G.busy = true; G.scanBusy = true; SFX().duck(true);
  await focus(S.pose.screen, .8);
  scr.set('face'); play('beep', spos); flashLed(S.faceRing, 1400);
  await sleep(1200); play('shutter', at(S.faceCam));
  await sleep(300);
  scr.set('hello', { name: st.name, cls: st.cls, after: !before }); play('ok', spos);
  await waitUse('Put your tray on the scale');
  await Promise.all([focus(S.pose.scan, .7), trayToWorld(S.scale, G.scanner.group.getWorldQuaternion(new THREE.Quaternion()), .7)]);
  play('trayDown', at(S.scale));
  // measure: depth camera beam sweeps down, the scale settles
  const amounts = Object.fromEntries(MENU.map(d => [d.id, before ? 1 : 1 - (G.eaten[d.id] || 0)]));
  let result;
  if (before) { result = PL.scanBefore(st.id, 'M', 'face', G.pick); }
  else { result = PL.scanAfter(st.id, Object.fromEntries(MENU.map(d => [d.id, Math.round((G.eaten[d.id] || 0) * 100)])), 'face'); G.result = result; }
  PL.store.save('scan');
  const grams = before ? result.total : Math.round(result.left);
  scr.set('scan', { amounts, grams, dur: 1.8, after: !before });
  S.beam.visible = S.line.visible = true; play('scan', at(S.camHead), 1.8);
  const lp = G.scanner.group.worldToLocal(S.scale.clone());
  await tween(1.8, e => { S.line.position.set(lp.x, lp.y + .12 - e * .1, lp.z); S.beam.material.opacity = .08 + Math.sin(e * 30) * .03; });
  S.beam.visible = S.line.visible = false;
  play('ok', spos); flashLed(S.faceRing, 600);
  if (before) scr.set('before', { served: result.served, total: result.total, kcal: result.kcal });
  else scr.set('after', { r: result });
  await focus(S.pose.screen, .7);
  await waitUse(before ? 'Take your tray' : 'Next');
  if (!before) {
    const clean = result.w <= .03;
    scr.set(clean ? 'clean' : 'compost', { left: Math.round(result.left), fill: .62 });
    await waitUse('Take your tray');
  }
  await trayToHands(.5);
  G.pos.copy(G.W.stationStand); G.yaw = 0; G.pitch = -.12;
  await unfocus(.6);
  G.busy = false; G.scanBusy = false; SFX().duck(false);
  if (before) {
    G.scannedBefore = true; setPhase('findSeat');
    msg(`Scanned: <b>${result.total} g</b> on your tray. Now find your friends and eat.`, 3600);
    setTimeout(() => G && chatter(G.rahman, 'Good. Enjoy your lunch!'), 900);
    setTimeout(() => { if (G && !G.scanBusy && !G.npcScanning) G.screen.set('idle'); }, 9000);
  } else {
    const r = result;
    msg(`<b>${pct(1 - r.w)}</b> eaten · +${r.xp} points${r.co2 > 0 ? ` · ${r.co2} g CO₂ saved` : ''}`, 4200);
    setPhase(r.w > .03 ? 'compost' : 'returnTray');
  }
}
function flashLed(o, ms) { if (!o) return; const m = o.material, c0 = m.color.clone(); let on = true; const iv = setInterval(() => { if (!G) return clearInterval(iv); m.color.set(on ? '#FFFFFF' : c0); on = !on; }, 120); setTimeout(() => { clearInterval(iv); m.color.copy(c0); }, ms); }
async function compostFlow() {
  const S = G.scanner, r = G.result;
  if (G.npcScanning) { msg(`Wait a moment, ${G.npcScanning} is using the scanner.`); return; }
  G.busy = true; G.scanBusy = true; SFX().duck(true);
  await focus(S.pose.compost, .7);
  const over = S.hole.clone().add(new THREE.Vector3(.25, .2, .04));
  await trayToWorld(over, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, .5)), .6);
  play('scrape', at(S.hole));
  // leftovers slide off into the compost
  const bits = [];
  Object.values(G.tray.dishes).forEach(g => g.traverse(o => { if (o.isMesh && o.visible && o.userData.dish && (!o.parent || o.parent.visible)) bits.push(o); }));
  bits.forEach(o => G.scene.attach(o));
  const from = bits.map(o => o.position.clone()), s0 = bits.map(o => o.scale.clone()), to = bits.map(() => S.hole.clone().add(new THREE.Vector3((Math.random() - .5) * .1, -.05, (Math.random() - .5) * .08)));
  await tween(.9, e => bits.forEach((o, i) => { o.position.lerpVectors(from[i], to[i], e); o.position.y += Math.sin(e * Math.PI) * .05; o.rotation.x += .1; o.scale.copy(s0[i]).multiplyScalar(1 - e * .7); }));
  bits.forEach(o => { if (o.parent) o.parent.remove(o); });
  play('plop', at(S.hole)); setTimeout(() => play('plop', at(S.hole)), 180);
  flashLed(S.binRing, 900);
  G.screen.set('composted', { left: Math.round(r.left) });
  await waitUse('Take your empty tray');
  await trayToHands(.45);
  G.pos.copy(G.W.stationStand).add(new THREE.Vector3(.6, 0, 0)); G.yaw = -.4; G.pitch = -.1;
  await unfocus(.6);
  G.busy = false; G.scanBusy = false; SFX().duck(false); setPhase('returnTray');
  msg(`${Math.round(r.left)} g of leftovers composted. It goes to the school garden.`, 3600);
}
async function returnFlow() {
  const R = G.W.rack;
  G.busy = true;
  await focus({ pos: new THREE.Vector3(12.05, 1.5, -7.75), target: new THREE.Vector3(12.05, .85, -8.95), fov: 56 }, .6);
  const slot = R.localToWorld(new THREE.Vector3(.15, G.W.rackShelves[2] + .014, 0));
  await trayToWorld(slot.clone().add(new THREE.Vector3(0, .05, .3)), new THREE.Quaternion(), .35);
  await trayToWorld(slot, new THREE.Quaternion(), .35);
  play('traySlide', at(slot));
  R.attach(G.tray.group); G.hasTray = false;
  await sleep(300);
  G.pos.set(11.7, EYE, -7.1); G.yaw = -.3; G.pitch = -.05;
  await unfocus(.5);
  G.busy = false;
  await convo(G.tan, async () => { await say(G.tan, G.result && G.result.w < .1 ? 'That\'s a clean tray. Thank you!' : 'Thank you. Try to finish a bit more tomorrow.'); });
  setPhase('done'); play('bell');
  G.screen.set('bye', { name: G.student.name });
  setTimeout(() => G && G.screen.set('idle'), 6000);
  setTimeout(() => G && finish(), 600);
}
/* ---------------------------------------------------------------- sitting and eating */
function sit(t) {
  if (G.busy) return;
  const side = G.pos.z > t.z ? 1 : -1;
  const spot = t.spots.filter(s => !s.taken || s.taken === 'you').sort((a, b) => ((b.taken === 'you') - (a.taken === 'you')) || ((a.side === side ? 0 : 1) - (b.side === side ? 0 : 1)) || (Math.abs(a.x - G.pos.x) - Math.abs(b.x - G.pos.x)))[0];
  if (!spot) { msg('No free seats here. Try another table.'); return; }
  return sitAt(t, spot);
}
async function sitAt(t, spot) {
  G.busy = true;
  if (spot.taken === 'you') G.chope.visible = false;
  spot.taken = 'me'; G.seat = { t, spot };
  G.seatPos = new THREE.Vector3(spot.x, 1.16, spot.z - spot.side * .12);
  const lookAt = new THREE.Vector3(spot.x, .9, t.z - spot.side * .35);
  await focus({ pos: G.seatPos, target: lookAt, fov: G.baseFov }, .6);
  play('chair', [spot.x, .4, spot.z]);
  await trayToWorld(new THREE.Vector3(spot.x, .787, t.z + spot.side * .17), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, spot.side > 0 ? 0 : Math.PI, 0)), .45);
  play('trayDown', [spot.x, .8, t.z]);
  G.yaw = spot.side > 0 ? 0 : Math.PI; G.pitch = -.55;
  G.mode = 'seat'; G.busy = false; setPhase('eating'); eatHud();
  G.tray.spoon.visible = true; G.tray.spoon.position.copy(G.tray.spoonRest); G.tray.spoon.rotation.set(-.3, .4, 0);
  if (t === G.friendTable && G.friends) { G.chatQ = friendLines(); G.chatT2 = 5; chatter(G.friends[1], 'There you are. Did you scan? Good, let\'s eat.'); }
  else msg(G.touch ? 'Tap the food to eat. Tap DONE when you\'re full.' : 'Click the food to take bites. Press E when you\'re full.', 3400);
}
function friendLines() {
  const [a, b] = G.friends, others = PL.S.students.filter(s => s.named && s.id !== G.student.id && !G.friends.some(f => f.name === s.name)).map(s => s.name);
  return [
    [a, 'Remember it\'s Kailan Week. Even one bite counts for Loopi.'],
    [b, 'My Loopi evolved yesterday. Three clean trays in a row!'],
    [a, '3B is second in the league now. Let\'s not waste anything.'],
    [b, `Yesterday ${others[0] || 'someone'} left half the rice. The screen went orange.`],
    [a, 'Did you see? It even shows how much CO₂ you saved.'],
    [b, 'The rice is quite good today.'],
    [a, 'After this we scan again, compost, and return the trays.'],
  ];
}
function friendChat(dt) {
  if (!G.chatQ || !G.chatQ.length || G.dlg) return;
  G.chatT2 -= dt; if (G.chatT2 > 0) return;
  G.chatT2 = 7 + Math.random() * 4;
  const [P, line] = G.chatQ.shift(); chatter(P, line, 4200);
}
async function bite(id) {
  if (G.eaten[id] >= 1 || G.biting) return;
  G.biting = true;
  const f = G.tray.dishes[id], sp = G.tray.spoon;
  const wp = new THREE.Vector3(); f.getWorldPosition(wp); const lp = G.camera.worldToLocal(wp.clone());
  const p0 = sp.position.clone();
  await tween(.18, e => sp.position.lerpVectors(p0, lp.clone().add(new THREE.Vector3(0, .03, 0)), e));
  G.eaten[id] = Math.min(1, (G.eaten[id] || 0) + .25);
  showDish(id, 1 - G.eaten[id]);
  play(id === 'soup' ? 'slurp' : id === 'kailan' || id === 'cabbage' || id === 'melon' ? 'crunch' : 'soft'); play('spoon');
  const mouth = new THREE.Vector3(0, -.08, -.18);
  await tween(.2, e => sp.position.lerpVectors(lp, mouth, e));
  await tween(.2, e => sp.position.lerpVectors(mouth, G.tray.spoonRest, e));
  G.biting = false;
  if (id === PL.CRAVING && G.eaten[id] === .25) { if (G.friends && G.seat && G.seat.t === G.friendTable) chatter(G.friends[0], 'Kailan! Your Loopi will be happy.'); else msg('You tried the kailan! That counts for Kailan Week.'); }
  eatHud();
  if (MENU.every(d => G.eaten[d.id] >= 1)) { msg('Every bite finished. Clean tray!'); setTimeout(standUp, 900); }
}
function eatHud() {
  const el = $('#g3-eat', root); if (!el) return;
  el.hidden = G.phase !== 'eating';
  el.innerHTML = `<div class="g3-dishes">${MENU.map(d => `<div><i style="background:${d.color}"></i><span>${esc(d.name)}</span><b>${Math.round((G.eaten[d.id] || 0) * 100)}%</b></div>`).join('')}</div><button id="g3-done">DONE, I'M FULL</button>`;
  $('#g3-done', el).onclick = e => { e.stopPropagation(); play('select'); standUp(); };
}
async function standUp() {
  if (G.mode !== 'seat' || G.busy) return;
  const { t, spot } = G.seat;
  G.busy = true; $('#g3-eat', root).hidden = true; G.tray.spoon.visible = false;
  await trayToHands(.45);
  spot.taken = null; G.seat = null; G.chatQ = null;
  G.pos.set(spot.x, EYE, t.z + spot.side * 1.28); G.yaw = spot.side > 0 ? 0 : Math.PI; G.pitch = -.05;
  G.mode = 'focus'; await unfocus(.5);
  G.busy = false; setPhase('scanAfter');
  if (G.friends && t === G.friendTable) setTimeout(() => G && chatter(G.friends[0], 'Go and scan, then compost and return your tray. See you in class!'), 400);
}

/* ---------------------------------------------------------------- Priya shows the routine in the background */
async function npcScan(P, after) {
  if (!G || !G.scanner || G.scanBusy) return;
  const scr = G.screen, spos = at(G.scanner.screenPos);
  G.npcScanning = P.name;
  scr.set('face'); play('beep', spos); await sleep(900); if (!G) return;
  scr.set('hello', { name: P.name, after }); play('ok', spos); await sleep(900); if (!G) return;
  scr.set('scan', { amounts: Object.fromEntries(MENU.map(d => [d.id, after ? .1 : 1])), grams: after ? 38 : 652, dur: .9, after }); play('scan', spos, .9); await sleep(1000); if (!G) return;
  play('ok', spos);
  if (after) scr.set('after', { r: { w: .06, xp: 44, co2: 61, line: 'Yum, thanks for lunch! Nice job.', game: { hunger: 2 }, servedBy: Object.fromEntries(MENU.map(d => [d.id, 100])), measured: Object.fromEntries(MENU.map(d => [d.id, d.id === 'rice' ? 20 : 4])) } });
  else scr.set('before', { served: Object.fromEntries(MENU.map(d => [d.id, d.g.M])), total: 652, kcal: 598 });
  await sleep(2400); if (!G) return;
  G.npcScanning = null;
  if (!G.scanBusy) scr.set('idle');
}

/* ================================================================ talking */
async function talk(P) {
  if (P === G.auntie && G.phase === 'order') return orderFlow();
  if (P === G.rahman) return rahmanTalk();
  if (P === G.sophie) return sophieSings();
  if (P === G.disha) return dishaFortune();
  const f = first(), ph = G.phase;
  if (P.friend) {
    const [a] = G.friends;
    return convo(P, async () => {
      if (ph === 'getTray' || ph === 'order' || ph === 'scanBefore') await say(P, P === a ? `${f}! Get your food and scan it first. We\'re keeping your seat.` : 'We left a tissue packet on your seat.');
      else if (ph === 'findSeat') await say(P, 'Sit down, we saved this one for you.');
      else if (ph === 'done') await say(P, 'See you in class!');
      else await say(P, 'Go and scan your tray, then compost and return it. See you later!');
    });
  }
  const script = {
    'Mrs Lim': () => ph === 'getTray' ? ['Take a tray from the stack first, then I\'ll serve you.'] : ph === 'done' ? ['It\'s curry chicken tomorrow. Come early!'] : ['Take your time and enjoy it.'],
    'Mr Tan': () => ph === 'returnTray' ? ['Your tray goes on this rack. Just slide it in.'] : ph === 'compost' ? ['Scrape your leftovers into the compost first. It\'s the white bin beside the scanner.'] : ph === 'done' ? ['The bins used to be full every day. Now there\'s much less waste.'] : [`Good afternoon, ${f}. Bring your tray back here after you eat.`, 'Scrape the leftovers into the compost first, then put the tray on the rack.'],
    'Mr Ong': () => [G.scannedBefore ? 'Would you like an iced Milo? Have your lunch first.' : 'Drinks later. Scan your tray first, the teacher is watching.'],
    'Mrs Chua': () => ['Sorry, the noodles have sold out today. The healthy set is still available.'],
    'Mdm Rosnah': () => ['Nasi lemak tomorrow. Come early!'],
    'Sophie': () => ph === 'done' ? ['You finished your tray? Nice. Now dance with me!'] : ['Sorry, I can’t stop. This song has been stuck in my head all day.', 'Lunch break is the only time I get to practise!'],
    'Priya': () => [ph === 'done' ? 'I ate 94% today. My Loopi is so happy.' : 'First time? Just look at the camera. It knows your face, so you don\'t need a card.'],
  };
  const lines = (script[P.name] && script[P.name]()) || [genericLine(P)];
  return convo(P, async () => { for (const l of lines) await say(P, l); });
}
/** Sophie stops breaking, gets up and sings her lunch song, with the lyrics as subtitles. */
const SONG = [
  ['Take a tray, take a bite, finish every little grain', [['e', 72, .5], ['a', 72, .5], ['e', 74, 1], ['e', 76, .5], ['a', 76, .5], ['a', 74, 1], ['i', 72, .5], ['i', 74, .5], ['e', 76, .5], ['i', 77, .5], ['i', 76, .5], ['o', 74, .5], ['e', 72, 2], [null, 0, 1]]],
  ['Scan it once, scan it twice, Loopi’s happy once again', [['a', 72, .5], ['i', 72, .5], ['a', 74, 1], ['a', 76, .5], ['i', 76, .5], ['a', 77, 1], ['u', 79, .5], ['i', 77, .5], ['a', 76, .5], ['i', 74, .5], ['a', 72, .5], ['a', 74, .5], ['e', 76, 2], [null, 0, 1]]],
  ['Kailan on the side, and the rice is looking fine', [['a', 77, .5], ['a', 77, .5], ['o', 76, .5], ['a', 74, .5], ['a', 76, 1], ['a', 74, .5], ['a', 72, .5], ['a', 74, 1], ['i', 76, .5], ['u', 77, .5], ['i', 76, .5], ['a', 74, 2], [null, 0, 1]]],
  ['Leave it clean, leave it green, every single time', [['i', 79, .5], ['i', 77, .5], ['i', 76, 1], ['i', 79, .5], ['i', 77, .5], ['i', 76, 1], ['e', 74, .5], ['i', 74, .5], ['i', 76, .5], ['o', 74, .5], ['a', 72, 2.5]]],
];
async function sophieSings() {
  const S = G.sophie;
  await convo(S, async () => {
    await say(S, G.phase === 'done' ? 'You finished your tray? Then you get the encore!' : 'Oh, hi! Do you want to hear the song I wrote about lunch?');
    S.singing = true; await sleep(700);
    const hp = new THREE.Vector3(); S.head.getWorldPosition(hp);
    G.SFX.sing(at(hp), SONG.flatMap(l => l[1]));
    for (const [words, notes] of SONG) {
      showSub(S.name, `♪ ${words} ♪`, true); S.talking = true;
      await sleep(notes.reduce((a, n) => a + n[2], 0) * 500);
    }
    S.talking = false; S.singing = false;
    await say(S, 'Thanks for listening! Back to practice.');
  });
}
/** Disha opens her eyes and reads your fortune for the day. */
const FORTUNES = [
  'Finish every grain today, and something good will follow before the last bell.',
  'A green vegetable will surprise you today. Say yes to it.',
  'Someone will share a secret with you before the day is over.',
  'Your Loopi dreams of you. Feed it well and it will grow.',
  'The tray you return clean returns kindness to you.',
  'Take less, and you will find you have more.',
  'A small act at the compost bin will grow into a garden.',
  'Today’s test will be kinder than you fear.',
  'The next person you smile at needed it more than you know.',
  'Luck is hiding in the kailan. Eat it.',
  'Before the week ends, an old friend will make you laugh until it hurts.',
  'Your lucky number today is the grams left on your tray. Aim for zero.',
  'Something you lost will turn up where you least expect it.',
  'A quiet lunch today brings a loud good idea tomorrow.',
  'You will be asked for help, and you will know exactly what to say.',
];
async function dishaFortune() {
  const D = G.disha;
  G.fortunes = G.fortunes && G.fortunes.length ? G.fortunes : FORTUNES.slice().sort(() => Math.random() - .5);
  const f = G.fortunes.pop();
  await convo(D, async () => {
    await say(D, G.toldFortune ? 'You again. The day has more to say. Be still...' : 'Welcome. Be still for a moment, and I will read your day...');
    hideSub();
    // she rises into a split and spins in the light, to celestial music
    const S = G.shrine, y0 = D.root.rotation.y, face = D.faceYaw;
    D.faceYaw = undefined; D.pose = 'split'; play('celestial', null, 5.2);
    const turns = Math.PI * 2 * 3, beam0 = S.beam.material.opacity;
    await tween(3.4, e => { D.root.rotation.y = y0 + turns * e; S.lift = Math.sin(e * Math.PI) * .45; S.beam.material.opacity = beam0 * (1 + Math.sin(e * Math.PI) * 1.4); });
    S.lift = 0; S.beam.material.opacity = beam0; D.pose = 'pray';
    D.root.rotation.y = y0 + turns; D.faceYaw = face + turns;
    await sleep(500);
    play('fortune', at(S.halo.position));
    await say(D, `✦ ${f} ✦`);
    await say(D, 'Go well. Come back if you need another.');
    G.toldFortune = true;
  });
}
function genericLine(P) {
  const pool = ['The kailan is actually good today.', 'Remember to scan before you eat, or it won\'t count.', 'My Loopi evolved yesterday!', 'Lunch break always feels too short.', 'I take less rice now. I can always go back for more.', 'The compost goes to the school garden, you know.', 'Did you see the class league? 3E is catching up.', 'The noodle queue is so long today.', 'I finished everything today. The screen went green!', 'Don\'t forget to scrape your tray before you return it.'];
  return pool[L.hash(P.name) % pool.length];
}
async function rahmanTalk() {
  const R = G.rahman, f = first(), ph = G.phase;
  await convo(R, async () => {
    const open = { getTray: `Hello, ${f}. Get your food first, then come here to scan.`, order: 'Get your food first, then come here to scan.', scanBefore: 'You have your tray. Look into the camera on top of the screen, put your tray on the scale, and wait for the beep.', findSeat: 'Go and eat first. Come back and scan when you\'re done.', eating: 'Go and eat first.', scanAfter: 'Done eating? Scan it again here, then scrape and return the tray.', compost: 'The compost bin is the white box on the right of the scanner. Scrape everything in.', returnTray: 'Tray goes on the rack. Mr Tan will take it from there.', done: `Well done, ${f}. 3B gets league points for every clean tray.` }[ph];
    let i = await ask(R, open, ['How does the scanner work?', 'Why do we scan our trays?', 'Where do the leftovers go?', 'OK, thanks!']);
    while (i >= 0 && i < 3) {
      if (i === 0) { await say(R, 'The camera on the arm sees your food in 3D, and the scale checks the weight. It measures your tray before and after lunch.'); await say(R, 'It knows you from your face, so there\'s nothing to tap or carry. And the photo never leaves the machine.'); }
      if (i === 1) { await say(R, 'So the kitchen knows what we really eat. They cook the right amount, waste less food and save money.'); await say(R, 'And every tray shows how much CO₂ you saved. It adds up for the whole school.'); }
      if (i === 2) { await say(R, 'Into the compost module on the scanner. The compost goes to our school garden. Maybe it will grow next term\'s kailan!'); }
      i = await ask(R, 'Anything else?', ['How does the scanner work?', 'Why do we scan our trays?', 'Where do the leftovers go?', 'No, thanks!']);
    }
  });
}

/* ================================================================ menus */
function panel(html) { const m = $('#g3-menu', root); m.innerHTML = `<div class="g3-panel">${html}</div>`; m.hidden = false; }
function closePanel() { const m = $('#g3-menu', root); m.innerHTML = ''; m.hidden = true; G.paused = false; }
function menu(kind) {
  G.paused = true;
  if (kind === 'title') {
    G.mode = 'title'; G.phase = 'title'; unlock(); hideSub();
    $('#g3-hud', root).hidden = true;
    const studs = PL.S.students.filter(s => s.named);
    panel(`<div class="g3-logo"><span>PLATELOOP</span><b>LUNCH RUSH</b></div>
      <p class="g3-sub2">One school lunch with the PlateLoop scanner</p>
      ${G.ready ? `<p class="g3-label">CHOOSE A STUDENT</p>
      <div class="g3-students">${studs.map(s => { const stt = PL.scanState(s); return `<button data-sid="${s.id}" ${stt === 'done' ? 'disabled' : ''}><b>${esc(s.name.toUpperCase())}</b><small>${stt === 'done' ? 'lunch done today' : stt === 'eating' ? 'tray scanned, eating' : 'ready for lunch'}</small></button>`; }).join('')}</div>
      ${studs.every(s => PL.scanState(s) === 'done') ? '<p class="g3-tip">Everyone has had lunch. <button class="g3-link" data-reset>Reset the demo</button> to play again.</p>' : ''}` : '<p class="g3-tip">Setting up the canteen…</p>'}
      <p class="g3-tip">${G.touch ? 'Left thumb to walk · drag to look · USE to talk and interact' : 'WASD to walk · mouse to look · E to talk and interact · 1–3 to answer'}</p>`);
    $$('[data-sid]', root).forEach(b => b.onclick = () => start(b.dataset.sid));
    const rs = $('[data-reset]', root); if (rs) rs.onclick = () => { PL.store.reset(); menu('title'); };
  } else if (kind === 'pause') {
    panel(`<h2>PAUSED</h2><p class="g3-sub2">${esc($('#g3-obj', root).textContent)}</p>
      <div class="g3-choices two"><button data-m="resume"><b>RESUME</b><small>back to lunch</small></button><button data-m="quit"><b>QUIT</b><small>to the title screen</small></button></div>`);
    $('[data-m="resume"]', root).onclick = () => { play('select'); closePanel(); lock(); };
    $('[data-m="quit"]', root).onclick = () => { play('select'); location.reload(); };
  }
}
function start(sid) {
  const st = PL.student(sid);
  G.SFX.start(); play('select');
  G.student = st;
  if (!G.staticTargets) { setupStaticTargets(); G.staticTargets = true; }
  makeFriends(sid); refreshHitMeshes();
  Object.assign(G, { pick: Object.fromEntries(MENU.map(d => [d.id, 1])), eaten: Object.fromEntries(MENU.map(d => [d.id, 0])), result: null, hasTray: false, served: false, scannedBefore: false, busy: false, tweens: [], keys: {}, dlg: null, waiting: null });
  G.pos.set(.6, EYE, 7.7); G.yaw = 0; G.pitch = 0; G.mode = 'walk';
  closePanel(); $('#g3-hud', root).hidden = false; $('#g3-touch', root).hidden = !G.touch;
  if (PL.scanState(st) === 'eating') {
    G.pick = Object.fromEntries(MENU.map(d => [d.id, st.before.served[d.id] / d.g.M]));
    fillTray(G.pick); MENU.forEach(d => showDish(d.id, 1)); G.tray.group.visible = true; G.hasTray = true; G.tray.hands.visible = true;
    G.scannedBefore = true; setPhase('findSeat');
  } else { fillTray({}); G.tray.group.visible = false; setPhase('getTray'); }
  // chapter card, the school chime, fade in
  const card = $('#g3-card', root);
  card.innerHTML = `<b>12:40 PM</b><span>Lunch break · ${esc(PL.SCHOOL)}</span><small>You are ${esc(st.name)}, class ${esc(st.cls)}</small>`;
  card.hidden = false; card.classList.remove('out'); G.post.material.uniforms.uFade.value = 1;
  play('bell');
  setTimeout(() => { if (!G) return; card.classList.add('out'); tween(1.4, e => { G.post.material.uniforms.uFade.value = 1 - e; }); }, 2600);
  setTimeout(() => { if (!G) return; card.hidden = true; msg(PL.scanState(st) === 'eating' ? 'Your tray is already scanned. Find a seat.' : 'Lunch time. Get a tray at the <b>Healthy Set Meal</b> stall.', 3600); }, 4000);
  lock();
}
function finish() {
  const r = G.result, st = G.student;
  G.paused = true; unlock();
  const grade = r.w < .05 ? 'S' : r.w < .15 ? 'A' : r.w < .3 ? 'B' : 'C';
  panel(`<h2>LUNCH COMPLETE</h2>
    <div class="g3-grade g${grade}">${grade}</div>
    <p class="g3-say">Loopi: “${esc(r.line)}”</p>
    <div class="g3-stats">
      <div><span>Ate</span><b>${pct(1 - r.w)}</b></div><div><span>Left</span><b>${Math.round(r.left)} g</b></div>
      <div><span>Calories</span><b>${r.intake.kcal}</b></div><div><span>Points</span><b>+${r.xp}</b></div>
      <div><span>CO₂ saved</span><b>${r.co2} g</b></div><div><span>Loopi</span><b>${r.game ? `+${r.game.hunger} food${r.game.heart ? ' +♥' : ''}` : 'fed'}</b></div>
    </div>
    <p class="g3-tip">${esc(st.name)}'s scans are real: open the Kiosk, Kitchen or Loopi app to see this tray there.</p>
    <div class="g3-choices two"><button data-m="again"><b>PLAY AGAIN</b><small>as another student</small></button><button data-m="roam"><b>KEEP WALKING</b><small>talk to people</small></button></div>`);
  $('[data-m="again"]', root).onclick = () => { play('select'); location.reload(); };
  $('[data-m="roam"]', root).onclick = () => { play('select'); closePanel(); lock(); };
}

/* ================================================================ input */
function lock() { if (!G.noLock && !G.touch) { const cv = $('#g3-cv', root); try { const p = cv.requestPointerLock && cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
/** E, click, Space or the USE button. */
function use() {
  if (!G || G.phase === 'title' || G.paused) return;
  if (advance()) return;
  if (G.waiting) { const w = G.waiting; G.waiting = null; play('select'); w.resolve(); return; }
  if (G.busy) return;
  if (G.mode === 'seat') { if (G.aimDish) bite(G.aimDish); return; }
  if (G.target) G.target.act();
}
function wireInput() {
  const cv = G.cv, view = G.view;
  const onKey = e => {
    if (!G || !root) return;
    const down = e.type === 'keydown';
    if (down && e.code === 'Escape' && G.phase !== 'title' && !G.paused) { menu('pause'); return; }
    if (G.paused || G.phase === 'title') return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { G.keys[e.code] = down; e.preventDefault(); }
    if (!down) return;
    if (/^Digit[1-4]$/.test(e.code)) { choose(+e.code.slice(5) - 1); return; }
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (G.mode === 'seat' && G.phase === 'eating' && e.code === 'KeyE' && !G.dlg && !G.waiting && !G.aimDish) standUp(); else use(); }
    if (e.code === 'KeyM') $('#g3-mute', root).classList.toggle('off', G.SFX.toggle());
  };
  const onMouse = e => { if (G && document.pointerLockElement === cv) { G.look.dx += e.movementX; G.look.dy += e.movementY; } };
  const onLock = () => { if (!G) return; const was = G.locked; G.locked = document.pointerLockElement === cv; if (was && !G.locked && !G.paused && G.phase !== 'title') menu('pause'); };
  const onLockErr = () => { if (!G || G.noLock) return; G.noLock = true; msg('Hold the mouse button and drag to look around. Arrow keys turn too.', 4200); };
  const onVis = () => { if (!G) return; if (document.hidden) G.SFX.suspend(); else G.SFX.resume(); };
  document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
  document.addEventListener('mousemove', onMouse); document.addEventListener('pointerlockchange', onLock); document.addEventListener('pointerlockerror', onLockErr);
  document.addEventListener('visibilitychange', onVis);
  G.off = () => { document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); document.removeEventListener('mousemove', onMouse); document.removeEventListener('pointerlockchange', onLock); document.removeEventListener('pointerlockerror', onLockErr); document.removeEventListener('visibilitychange', onVis); };
  cv.addEventListener('mousedown', e => { if (document.pointerLockElement === cv && e.button === 0 && !G.paused && G.phase !== 'title') use(); });
  $('#g3-sub', root).addEventListener('click', e => { if (!e.target.closest('button')) use(); });
  // mouse (not captured): drag to look, click to capture and use. Touch: left half walks, right half looks, taps use.
  const stick = $('#g3-stick', root), knob = stick.querySelector('i');
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0, moved = 0, mouseDrag = false;
  view.addEventListener('pointerdown', e => {
    if (G.paused || G.phase === 'title' || e.target.closest('button') || e.target.closest('.g3-sub')) return;
    if (e.pointerType === 'mouse') { if (document.pointerLockElement !== cv && e.button === 0) { e.preventDefault(); lookId = e.pointerId; lx = e.clientX; ly = e.clientY; moved = 0; mouseDrag = true; try { view.setPointerCapture(e.pointerId); } catch (_) {} } return; }
    const r = view.getBoundingClientRect();
    if (e.clientX - r.left < r.width * .45 && stickId === null && G.mode === 'walk') { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.style.left = (sx - r.left - 50) + 'px'; stick.style.top = (sy - r.top - 50) + 'px'; stick.classList.add('on'); }
    else if (lookId === null) { lookId = e.pointerId; lx = e.clientX; ly = e.clientY; moved = 0; }
  });
  view.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { const dx = Math.max(-40, Math.min(40, e.clientX - sx)), dy = Math.max(-40, Math.min(40, e.clientY - sy)); G.stick.x = dx / 40; G.stick.y = dy / 40; knob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === lookId) { const dx = e.clientX - lx, dy = e.clientY - ly, k = mouseDrag ? 1.3 : 1.6; G.look.dx += dx * k; G.look.dy += dy * k; moved += Math.abs(dx) + Math.abs(dy); lx = e.clientX; ly = e.clientY; }
  });
  const end = e => {
    if (e.pointerId === stickId) { stickId = null; G.stick.x = G.stick.y = 0; knob.style.transform = ''; stick.classList.remove('on'); return; }
    if (e.pointerId !== lookId) return;
    lookId = null;
    const tap = moved < (mouseDrag ? 6 : 8), wasMouse = mouseDrag;
    mouseDrag = false;
    if (!tap) return;
    if (G.mode === 'seat' && G.phase === 'eating' && !G.dlg && !G.waiting) { const r = cv.getBoundingClientRect(); G.aim = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }; updateTarget(); G.aim = null; }
    use();
    if (wasMouse && G.mode === 'walk' && !G.dlg && !G.waiting && !G.busy) lock();
  };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  $('#g3-use', root).onclick = e => { e.stopPropagation(); if (G.mode === 'seat' && G.phase === 'eating' && !G.dlg && !G.waiting) standUp(); else use(); };
  $('#g3-mute', root).onclick = e => { e.stopPropagation(); $('#g3-mute', root).classList.toggle('off', G.SFX.toggle()); };
}

PL.apps.lunch = {
  title: 'Lunch Rush',
  mount,
  unmount() {
    if (G) { cancelAnimationFrame(G.raf); G.off && G.off(); G.ro && G.ro.disconnect(); unlock(); G.renderer.dispose(); G.SFX.close(); }
    G = null; root = null;
  },
  update() { if (G && G.phase === 'title') menu('title'); },
  debug: () => ({ G, act: { takeTray, orderFlow, scanFlow, sit, sitAt, bite, standUp, compostFlow, returnFlow, start, talk, use, choose, advance } }),
};
})();
