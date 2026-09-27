/* Scanner 3D: the annotated PlateLoop Scanner, one station that scans every tray before and after lunch. */
(() => {
'use strict';
const { $, $$, clamp, esc } = PL;

/* Anchors are in Blender coordinates (metres, Z up, front = −Y) from build_scanner.py; glTF is Y up. */
const PARTS = [
  { p: [0.08, -0.10, 1.49], t: 'Depth camera', s: 'Photographs the tray from 0.62 m above', d: 'A colour camera identifies each dish, and two infrared cameras measure how high the food sits in every compartment. That gives the volume of each food, which becomes grams. It runs twice per tray: before lunch and after.', spec: 'RGB-D · 1280 × 720 depth' },
  { p: [0.08, -0.185, 1.55], t: 'Status light', s: 'Shows when to put the tray down and pick it up', d: 'Soft green means ready. A slow pulse means scanning, so hold still. Two quick blinks mean done.', spec: 'LED strip' },
  { p: [0.08, 0.175, 1.30], t: 'Camera arm', s: 'Holds the camera straight over the tray', d: 'Looking straight down means compartment walls never hide food. The cables run inside the aluminium column.', spec: 'Top at 1.58 m' },
  { p: [-0.28, 0.035, 1.16], t: 'Screen', s: 'Instructions and results', d: 'Runs PlateLoop Kiosk. An animated banner shows the steps, then the student sees grams, calories and nutrients, Loopi\'s reaction and their points.', spec: '10.1" touchscreen · 1.15 m high' },
  { p: [-0.276, 0.055, 1.285], t: 'Face camera', s: 'The only way students sign in', d: 'Students just look up at the screen. An infrared face camera recognises them in under a second, even in a dim cafeteria, so there are no cards to lose and no phones needed. It opens the tray before lunch and closes it after. It keeps a match code, never a photo.', spec: 'IR + RGB · under 1 s · on-device' },
  { p: [0.31, -0.19, 0.88], t: 'Weighing platform', s: 'Checks the camera with a scale', d: 'Four load cells weigh the whole tray. If the camera and the scale disagree by more than 10%, the tray is scanned again.', spec: '0–5 kg · ±2 g' },
  { p: [0.08, -0.04, 0.92], t: 'Tray', s: 'Scanned full, then scanned again', d: 'Before: what was served. After: what is left. Eaten = before − after, per dish. The menu is known in advance, so the AI only chooses among today\'s dishes.', spec: 'Standard 6-compartment tray' },
  { p: [0.585, -0.01, 0.87], t: 'Compost bin', s: 'Scraps go here after the second scan', d: 'The bin weighs scraps in bulk for the compost report. The Kitchen app shows how full it is.', spec: '60 L' },
  { p: [-0.05, -0.235, 0.35], t: 'On-device AI', s: 'Works offline, and photos never leave', d: 'The vision model runs inside the cabinet in about 1.4 s per scan. Face matching happens here too. Only numbers (grams per dish and a student number) are sent to the Kitchen and Student apps.', spec: 'Edge AI module' },
];
const DIMS = [
  { a: [-0.62, -0.25, 0], b: [-0.62, -0.25, 1.58], label: '1.58 m' },
  { a: [-0.40, -0.40, 0], b: [0.765, -0.40, 0], label: '1.17 m' },
  { a: [0.30, -0.10, 0.885], b: [0.30, -0.10, 1.49], label: '0.62 m' },
];
const SPECS = [['Footprint', '1.17 × 0.46 m'], ['Scans', 'Before and after lunch'], ['Measures', 'Dish, grams, kcal, carbs, protein, fat'], ['Sign-in', 'Face only, on-device'], ['Scan time', '≈ 1.4 s'], ['Power', 'One socket'], ['Network', 'Wi-Fi or Ethernet'], ['Parts', '≈ $1,400 (estimate)']];

const q = new URLSearchParams(location.search);
const IDI = b => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
const ID_ICONS = {
  lock: IDI('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>'),
  fast: IDI('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6Z"/>'),
  face: IDI('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16a4 4 0 0 0 5 0"/>'),
};
const ui = { sel: null, labels: true, dims: true };
let root = null, viewer = null;

function mount(el) {
  root = el;
  el.innerHTML = `
  <nav class="prod-nav" aria-label="PlateLoop Scanner"><div class="prod-in">
    <span class="prod-name">PlateLoop Scanner</span>
    <div class="prod-links"><button data-jump="hwx-main">Overview</button><button data-jump="measures">What it measures</button><button data-jump="how">How it works</button><button data-jump="renders">Gallery</button></div>
  </div></nav>
  <div class="hwx">
    <div class="prod-hero">
      <div class="eyebrow" style="color:var(--tint-ink)">For school cafeterias</div>
      <h1>One scanner.<br>Two scans. Zero guesswork.</h1>
      <p>Students scan their tray before lunch and again after. The difference is exactly what they ate, dish by dish, and it goes straight to the kitchen and to each student's Loopi.</p>
    </div>
    <div class="row spread" style="margin-top:6px"><h2 class="section-title" style="margin:0">Explore the scanner</h2><div class="row" style="gap:18px"><label class="tog"><input type="checkbox" id="hwx-labels" checked> Labels</label><label class="tog"><input type="checkbox" id="hwx-dims" checked> Dimensions</label></div></div>
    <div class="hwx-main" id="hwx-main">
      <div class="hwx-stage">
        <div class="viewer" id="viewer"><canvas id="gl"></canvas><div class="hwx-over" id="hwx-over"></div><div class="vmsg" id="vmsg">Loading 3D model…</div><div class="vhint">Drag to rotate · Scroll to zoom · Click a number</div></div>
        <div class="hwx-detail" id="hwx-detail"></div>
      </div>
      <aside class="card hwx-side" id="hwx-side"></aside>
    </div>
    <h2 class="section-title" id="measures">What every scan measures</h2>
    <div class="measures">
      <div><b>6 dishes</b><span>identified per tray, from today's menu</span></div>
      <div><b>± 2 g</b><span>per tray, checked by the scale</span></div>
      <div><b>kcal</b><span>calories eaten, per student</span></div>
      <div><b>C · P · F</b><span>carbs, protein and fat</span></div>
      <div><b>% left</b><span>plate waste for every dish</span></div>
    </div>
    <h2 class="section-title">Sign in with your face</h2>
    <div class="ids">
      <div><span class="idic">${ID_ICONS.face}</span><b>Hands-free</b><span>Look up at the screen with your tray in both hands. No card to lose, no phone needed.</span></div>
      <div><span class="idic">${ID_ICONS.fast}</span><b>Under a second</b><span>Fast enough for a lunch line, and the infrared camera works in a dim cafeteria.</span></div>
      <div><span class="idic">${ID_ICONS.lock}</span><b>Private</b><span>The scanner keeps a match code, never a photo, and it never leaves the scanner.</span></div>
    </div>
    <h2 class="section-title" id="how">How a tray is scanned</h2>
    <div class="flow">
      <div><span class="n">1</span><b>Before lunch</b>Look at the camera and set down your full tray. The scanner records what you were served.</div>
      <div><span class="n">2</span><b>Eat</b>Enjoy lunch. Loopi's tip on the screen suggests one dish to try.</div>
      <div><span class="n">3</span><b>After lunch</b>Look at the camera again and set down the tray. The scanner measures what's left.</div>
      <div><span class="n">4</span><b>Results</b>Eaten = before − after. The kitchen sees the data, and your Loopi gets fed.</div>
    </div>
    <h2 class="section-title">Gallery</h2>
    <div class="renders" id="renders">
      <figure><img src="render_scanner_hero.png" alt="PlateLoop Scanner, full view" loading="lazy"><figcaption>The PlateLoop Scanner with its compost bin</figcaption></figure>
      <figure><img src="render_scanner_detail.png" alt="Close-up of the screen, face camera and tray platform" loading="lazy"><figcaption>Screen, face camera and tray platform</figcaption></figure>
    </div>
  </div>`;
  PL.$$('[data-jump]', el).forEach(b => b.onclick = () => { const t = document.getElementById(b.dataset.jump); if (t) t.scrollIntoView({ behavior: PL.reduceMotion ? 'auto' : 'smooth', block: 'start' }); });
  $('#hwx-labels', el).onchange = e => { ui.labels = e.target.checked; $('#hwx-over', el).classList.toggle('nolabels', !ui.labels); };
  $('#hwx-dims', el).onchange = e => { ui.dims = e.target.checked; if (viewer) viewer.showDims(ui.dims); };
  side();
  viewer = initViewer();
}
function side() {
  $('#hwx-side', root).innerHTML = `<h3 style="font-size:20px;font-weight:700">Parts</h3>
    <ol class="parts">${PARTS.map((p, i) => `<li><button data-i="${i}" aria-pressed="${ui.sel === i}"><span class="pn">${i + 1}</span><span><b>${esc(p.t)}</b><small>${esc(p.s)}</small></span></button></li>`).join('')}</ol>
    <dl class="kspec">${SPECS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  $$('.parts button', root).forEach(b => b.onclick = () => select(+b.dataset.i));
  detail();
}
function select(i) {
  ui.sel = ui.sel === i ? null : i;
  $$('.parts button', root).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === ui.sel)));
  $$('.hwx-over .hot, .hwx-over .tag', root).forEach(h => h.classList.toggle('on', +h.dataset.i === ui.sel));
  detail();
}
function detail() {
  const el = $('#hwx-detail', root);
  if (ui.sel == null) { el.innerHTML = `<p class="hint" style="font-size:14px">Click a number on the model or a part in the list to see what it does.</p>`; return; }
  const p = PARTS[ui.sel];
  el.innerHTML = `<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:nowrap"><span class="pn big">${ui.sel + 1}</span><div style="flex:1"><h3 style="font-size:18px">${esc(p.t)}</h3><p style="margin-top:4px;color:var(--label2);font-size:15px">${esc(p.d)}</p><span class="pill green" style="margin-top:10px">${esc(p.spec)}</span></div></div>`;
}

const toThree = ([x, y, z]) => new THREE.Vector3(x, z, -y);

/** When 3D can't run (no WebGL, a locked-down viewer), show the studio render in its place. */
function fallback(note) {
  const box = $('#viewer', root), msg = $('#vmsg', root);
  if (!box) return;
  box.classList.add('still');
  $('#hwx-over', root).innerHTML = '';
  msg.hidden = false;
  msg.innerHTML = `<img src="render_scanner_hero.png" alt="PlateLoop Scanner"><span class="still-note">${note}</span>`;
}
function initViewer() {
  const msg = $('#vmsg', root);
  if (!window.THREE || !THREE.GLTFLoader) { fallback('Studio render: the 3D viewer isn\'t available here.'); return null; }
  const canvas = $('#gl', root), box = $('#viewer', root), over = $('#hwx-over', root);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
  catch (e) { fallback('Studio render: this viewer doesn\'t support 3D. Open the file in Chrome, Edge or Safari to rotate it.'); return null; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .02, 40);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bcc4, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-2, 4, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, .5); fill.position.set(3, 2, -2); scene.add(fill);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .035 }));
  disc.rotation.x = -Math.PI / 2; scene.add(disc);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 288; screenCanvas.height = 186;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.flipY = false; screenTex.encoding = THREE.sRGBEncoding;
  const loader = new THREE.GLTFLoader(), ray = new THREE.Raycaster();
  let model = null, alive = true, raf = 0, st = 0, frame = 0, dimGroup = null, hots = [], dimLabels = [];
  const orbit = { theta: -.6, phi: 1.13, r: 3, target: new THREE.Vector3(0, .8, 0), auto: !q.has('still') };
  const place = () => { const { theta, phi, r, target } = orbit; cam.position.set(target.x + r * Math.sin(phi) * Math.sin(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.cos(theta)); cam.lookAt(target); };
  // the live screen shows the same instruction banner as the Scanner screen app
  function paintScreen() {
    const c = screenCanvas.getContext('2d'), W = screenCanvas.width, H = screenCanvas.height, k = Math.floor(st / 6) % 3;
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1D1D1F'; c.font = '700 22px -apple-system, "Segoe UI", sans-serif'; c.fillText('Scan your tray', 16, 40);
    c.fillStyle = '#8E8E93'; c.font = '13px -apple-system, "Segoe UI", sans-serif'; c.fillText('Before lunch and after lunch', 16, 60);
    ['Look up', 'Place tray', 'Done'].forEach((s, i) => {
      const x = 12 + i * 90, on = i === k;
      c.fillStyle = on ? '#34C759' : '#F2F2F7'; c.beginPath(); c.roundRect ? c.roundRect(x, 110, 82, 60, 12) : c.rect(x, 110, 82, 60); c.fill();
      c.fillStyle = on ? '#FFFFFF' : '#8E8E93'; c.font = '600 13px -apple-system, "Segoe UI", sans-serif'; c.fillText(`${i + 1}  ${s}`, x + 10, 146);
    });
    const pet = document.createElement('canvas'); pet.width = 72; pet.height = 60;
    const s0 = PL.student(PL.S.me) || PL.S.students[0];
    PL.drawPet(pet, { rows: 30, t: st, ...PL.petOf(s0), mood: 'joy' });
    c.imageSmoothingEnabled = false; c.drawImage(pet, W - 84, 12, 72, 60);
    screenTex.needsUpdate = true; st++;
  }
  function buildOverlay() {
    over.innerHTML = `<svg class="leaders" aria-hidden="true"></svg>`
      + PARTS.map((p, i) => `<button class="hot ${ui.sel === i ? 'on' : ''}" data-i="${i}" aria-label="${esc(p.t)}"><span class="pn">${i + 1}</span></button><button class="tag ${ui.sel === i ? 'on' : ''}" data-i="${i}" tabindex="-1"><span class="pn">${i + 1}</span>${esc(p.t)}</button>`).join('')
      + DIMS.map((d, i) => `<span class="dimlabel" data-d="${i}">${d.label}</span>`).join('');
    over.classList.toggle('nolabels', !ui.labels);
    const tags = [...over.querySelectorAll('.tag')];
    hots = [...over.querySelectorAll('.hot')].map((el, i) => ({ el, tag: tags[i], v: toThree(PARTS[i].p) }));
    dimLabels = [...over.querySelectorAll('.dimlabel')].map((el, i) => ({ el, v: toThree(DIMS[i].a).add(toThree(DIMS[i].b)).multiplyScalar(.5) }));
    [...hots.map(h => h.el), ...tags].forEach(el => el.onclick = e => { e.stopPropagation(); select(+el.dataset.i); });
    if (dimGroup) scene.remove(dimGroup);
    dimGroup = new THREE.Group();
    const col = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--label3').trim() || '#8E8E93');
    DIMS.forEach(d => {
      const a = toThree(d.a), b = toThree(d.b), dir = b.clone().sub(a).normalize();
      const tick = (Math.abs(dir.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).multiplyScalar(.035);
      const geo = new THREE.BufferGeometry().setFromPoints([a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)]);
      const seg = new THREE.LineSegments(geo, d === DIMS[2] ? new THREE.LineDashedMaterial({ color: col, dashSize: .025, gapSize: .018 }) : new THREE.LineBasicMaterial({ color: col }));
      if (d === DIMS[2]) seg.computeLineDistances();
      dimGroup.add(seg);
    });
    dimGroup.visible = ui.dims;
    dimLabels.forEach(l => l.el.hidden = !ui.dims);
    scene.add(dimGroup);
  }
  function project() {
    const W = box.clientWidth, H = box.clientHeight, meshes = [];
    if (model) model.traverse(o => { if (o.isMesh) meshes.push(o); });
    const check = frame % 6 === 0;
    const pts = hots.map(h => {
      const s = h.v.clone().project(cam), x = (s.x + 1) / 2 * W, y = (1 - s.y) / 2 * H;
      h.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (check) { const dir = h.v.clone().sub(cam.position), dist = dir.length(); ray.set(cam.position, dir.normalize()); const hit = ray.intersectObjects(meshes, false)[0]; h.behind = !!hit && hit.distance < dist - .03; h.el.classList.toggle('behind', h.behind); }
      return { h, x, y };
    });
    const gap = 30, pad = 14, top = 16, bottom = H - 16, mid = pts.reduce((a, p) => a + p.x, 0) / (pts.length || 1);
    let d = '';
    [pts.filter(p => p.x < mid), pts.filter(p => p.x >= mid)].forEach((side, si) => {
      side.sort((a, b) => a.y - b.y);
      let prev = -Infinity; side.forEach(p => { p.ly = Math.max(p.y, prev + gap, top); prev = p.ly; });
      let next = bottom; for (let i = side.length - 1; i >= 0; i--) { side[i].ly = Math.min(side[i].ly, next); next = side[i].ly - gap; }
      side.forEach(p => {
        const tw = p.h.tag.offsetWidth || 120, lx = si === 0 ? pad : W - pad - tw;
        p.h.tag.style.transform = `translate(${lx.toFixed(1)}px, ${(p.ly - 13).toFixed(1)}px)`;
        p.h.tag.classList.toggle('behind', !!p.h.behind);
        const ex = si === 0 ? lx + tw : lx, elbow = si === 0 ? ex + 18 : ex - 18;
        d += `M${ex.toFixed(1)} ${p.ly.toFixed(1)}H${elbow.toFixed(1)}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      });
    });
    const leaders = over.querySelector('.leaders'); if (leaders) leaders.innerHTML = `<path d="${d}"/>`;
    dimLabels.forEach(l => { const s = l.v.clone().project(cam); l.el.style.transform = `translate(${((s.x + 1) / 2 * W).toFixed(1)}px, ${((1 - s.y) / 2 * H).toFixed(1)}px)`; });
  }
  function onModel(g) {
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      if (/ReturnScreen/.test(o.name)) { o.material = new THREE.MeshBasicMaterial({ map: screenTex }); return; }
      if (o.material && o.material.metalness > .5) { o.material.metalness = .35; o.material.roughness = .35; }
    });
    model = g.scene; scene.add(model);
    const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    orbit.target.copy(c); orbit.r = Math.max(sz.x, sz.y, sz.z) * 2.3; orbit.min = orbit.r * .3; orbit.max = orbit.r * 1.8;
    disc.scale.setScalar(Math.max(sz.x, sz.z) * .55);
    msg.hidden = true; buildOverlay(); place();
  }
  const embedded = document.getElementById('model-scanner');
  const fail = () => { alive = false; cancelAnimationFrame(raf); fallback('Studio render: the 3D model couldn\'t load in this viewer. Open the file in Chrome, Edge or Safari to rotate it.'); };
  try { if (embedded) loader.parse(embedded.textContent, '', onModel, fail); else loader.load('scanner.gltf.json', onModel, undefined, fail); } catch (e) { fail(); }
  let drag = null;
  box.addEventListener('pointerdown', e => { if (e.target.closest('.hot,.tag')) return; drag = { x: e.clientX, y: e.clientY }; orbit.auto = false; box.setPointerCapture(e.pointerId); box.style.cursor = 'grabbing'; });
  box.addEventListener('pointermove', e => { if (!drag) return; orbit.theta -= (e.clientX - drag.x) * .008; orbit.phi = clamp(orbit.phi - (e.clientY - drag.y) * .006, .25, 1.5); drag = { x: e.clientX, y: e.clientY }; place(); });
  const end = () => { drag = null; box.style.cursor = ''; };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  box.addEventListener('wheel', e => { e.preventDefault(); orbit.r = clamp(orbit.r * (1 + Math.sign(e.deltaY) * .08), orbit.min || .5, orbit.max || 8); place(); }, { passive: false });
  const resize = () => { const w = box.clientWidth, h = box.clientHeight; if (!w) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(box); resize();
  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop); frame++;
    if (orbit.auto && !PL.reduceMotion) { orbit.theta += .002; place(); }
    if (frame % 20 === 0) paintScreen();
    renderer.render(scene, cam); project();
  };
  paintScreen(); loop();
  return { showDims(on) { if (dimGroup) dimGroup.visible = on; dimLabels.forEach(l => l.el.hidden = !on); }, destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); } };
}

PL.apps.model = {
  title: 'Scanner 3D',
  mount,
  unmount() { if (viewer) viewer.destroy(); viewer = null; root = null; },
};
})();
