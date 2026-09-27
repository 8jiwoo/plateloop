/* Lunch Rush soundscape, all synthesised with Web Audio (no sound files).
   Positional (HRTF) sources placed around the canteen, a hall reverb, and a random scheduler for life:
   crowd chatter (voiced formants with syllable rhythm), cutlery clinks, bench scrapes, wok sizzle and the
   ladle, the drinks-stall till, ceiling fans, cicadas and birds outside (koel, sparrows, mynahs), distant
   thunder, the school chime. One-shots for footsteps, eating, the scanner and trays. */
(() => {
'use strict';
const L = PL.L3;

L.Sound = () => {
  let ctx = null, master, dry, verbIn, noiseBuf, brownBuf, muted = false;
  const voices = [], spots = { tables: [], crowd: [], kitchen: [], ladle: null, till: null, rack: null, fans: [], outside: [] };
  const clock = {};
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion();
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

  /* ------------------------------------------------------------ graph */
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    ctx = new A();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : .9; master.connect(comp);
    dry = ctx.createGain(); dry.connect(master);
    // hall reverb: tiled walls and a high roof
    const conv = ctx.createConvolver(); conv.buffer = impulse(2.6, 2.8);
    verbIn = ctx.createGain(); verbIn.gain.value = .32; const verbOut = ctx.createGain(); verbOut.gain.value = .55;
    verbIn.connect(conv).connect(verbOut).connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    { const d = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
    beds();
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) { const k = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, decay) * Math.min(1, i / (ctx.sampleRate * .012)); }
      // a few early reflections off the tiles
      [.013, .021, .034, .047].forEach((s, j) => { const i = Math.floor(ctx.sampleRate * (s + ch * .003)); if (i < n) d[i] += (j % 2 ? -.6 : .7); });
    }
    return b;
  }
  const setPos = (pn, p) => { if (pn.positionX) { pn.positionX.value = p[0]; pn.positionY.value = p[1]; pn.positionZ.value = p[2]; } else pn.setPosition(p[0], p[1], p[2]); };
  function panner(p, ref = 1.5, wet = 1) {
    const pn = ctx.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = ref; pn.maxDistance = 80; pn.rolloffFactor = 1.1;
    setPos(pn, p); pn.connect(dry);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; pn.connect(w).connect(verbIn); }
    return pn;
  }
  function flat(wet = .4) { const g = ctx.createGain(); g.connect(dry); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verbIn); } return g; }
  const loopNoise = (buf = noiseBuf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); return s; };
  /** A looping control signal (0..1) at a low sample rate, used as a gain envelope. */
  function envBuffer(sec, fill) { const sr = 8000, n = sr * sec, b = ctx.createBuffer(1, n, sr); fill(b.getChannelData(0), sr, n); return b; }
  const syllables = sec => envBuffer(sec, (d, sr, n) => {
    let i = Math.floor(Math.random() * sr);
    while (i < n) {
      if (Math.random() < .13) { i += Math.floor(sr * rnd(.35, 1.4)); continue; }
      const len = Math.floor(sr * rnd(.06, .22)), amp = rnd(.35, 1);
      for (let k = 0; k < len && i + k < n; k++) d[i + k] = amp * Math.sin(Math.PI * k / len);
      i += len + Math.floor(sr * rnd(.02, .11));
    }
  });
  const crackle = sec => envBuffer(sec, (d, sr, n) => { let v = .2; for (let i = 0; i < n; i++) { if (Math.random() < .0035) v = Math.min(1, v + rnd(.3, .9)); v = .2 + (v - .2) * .994; d[i] = v; } });

  /* ------------------------------------------------------------ beds */
  function beds() {
    // room tone: air, fans, the city beyond the school
    const rt = loopNoise(brownBuf), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = ctx.createGain(); g.gain.value = .16; rt.connect(lp).connect(g).connect(flat(.2));
    // crowd: 3–4 voices around each cluster of tables
    spots.crowd.forEach(([x, z], ci) => { for (let k = 0; k < (ci % 2 ? 3 : 4); k++) voices.push(voice([x + rnd(-1.4, 1.4), 1.15, z + rnd(-1, 1)], Math.random() < .5 ? rnd(110, 150) : rnd(190, 250))); });
    // kitchens: wok sizzle with crackle, the exhaust hood
    spots.kitchen.forEach(p => {
      const ns = loopNoise(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
      const env = ctx.createGain(); env.gain.value = 0; const es = ctx.createBufferSource(); es.buffer = crackle(7); es.loop = true; es.connect(env.gain); es.start(0, Math.random() * 7);
      const lv = ctx.createGain(); lv.gain.value = .07; ns.connect(hp).connect(env).connect(lv).connect(panner(p, 1.2));
      const hum = ctx.createOscillator(); hum.frequency.value = 98 + Math.random() * 6; const hg = ctx.createGain(); hg.gain.value = .012;
      const air = loopNoise(brownBuf), alp = ctx.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 400; const ag = ctx.createGain(); ag.gain.value = .08;
      const hood = panner([p[0], 2.6, p[2]], 1.5); hum.connect(hg).connect(hood); air.connect(alp).connect(ag).connect(hood); hum.start();
    });
    // ceiling fans: a slow whoosh with the blade rhythm
    spots.fans.forEach(p => {
      const ns = loopNoise(), lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 520;
      const am = ctx.createGain(); am.gain.value = .6; const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(2.6, 3.4); const lg = ctx.createGain(); lg.gain.value = .35; lfo.connect(lg).connect(am.gain); lfo.start();
      const lv = ctx.createGain(); lv.gain.value = .05; ns.connect(lp2).connect(am).connect(lv).connect(panner(p, 1, .3));
    });
    // cicadas in the trees outside, swelling slowly
    spots.outside.forEach(p => {
      const ns = loopNoise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(4800, 5600); bp.Q.value = 7;
      const am = ctx.createGain(); am.gain.value = .5; const buzz = ctx.createOscillator(); buzz.frequency.value = rnd(38, 46); const bg = ctx.createGain(); bg.gain.value = .5; buzz.connect(bg).connect(am.gain); buzz.start();
      const sw = ctx.createGain(); sw.gain.value = .5; const swell = ctx.createOscillator(); swell.frequency.value = rnd(.04, .08); const sg = ctx.createGain(); sg.gain.value = .45; swell.connect(sg).connect(sw.gain); swell.start();
      const lv = ctx.createGain(); lv.gain.value = .9; ns.connect(bp).connect(am).connect(sw).connect(lv).connect(panner(p, 6, .15));
    });
  }
  /** One chatting voice: a buzzy source through two moving formants, gated by a syllable rhythm. */
  function voice(pos, f0) {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f0;
    const vib = ctx.createOscillator(); vib.frequency.value = rnd(4, 6); const vg = ctx.createGain(); vg.gain.value = f0 * .03; vib.connect(vg).connect(osc.frequency);
    const og = ctx.createGain(), ns = loopNoise(), ng = ctx.createGain(); og.gain.value = .5; ng.gain.value = .6;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 4.5; f1.frequency.value = 600;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.value = 1700;
    const src = ctx.createGain(); osc.connect(og).connect(src); ns.connect(ng).connect(src); src.connect(f1); src.connect(f2);
    const f2g = ctx.createGain(); f2g.gain.value = .6; f2.connect(f2g);
    const env = ctx.createGain(); env.gain.value = 0; f1.connect(env); f2g.connect(env);
    const es = ctx.createBufferSource(); es.buffer = syllables(11); es.loop = true; es.connect(env.gain);
    const lv = ctx.createGain(); lv.gain.value = 1.6; env.connect(lv).connect(panner(pos, 2, .9));
    osc.start(); vib.start(); es.start(0, Math.random() * 11);
    return { f1, f2, osc, f0, lv, next: 0 };
  }

  /* ------------------------------------------------------------ one-shots */
  function tone(f, dur, { type = 'sine', vol = .1, to = null, at = 0, pos = null, attack = .004, ref = 1.2, wet = .6 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(pos ? panner(pos, ref, wet) : flat(wet * .5)); o.start(t); o.stop(t + dur + .05);
  }
  function burst(dur, { vol = .2, type = 'bandpass', freq = 1000, q = 1, to = null, at = 0, pos = null, attack = .002, ref = 1.2, buf = null, wet = .6 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = buf || noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(g).connect(pos ? panner(pos, ref, wet) : flat(wet * .5)); s.start(t, Math.random() * 2); s.stop(t + dur + .05);
  }
  /** Struck metal: inharmonic partials with a fast decay. */
  const metal = (pos, base, vol, dur, at = 0) => [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(base * r * rnd(.99, 1.01), dur / (1 + i * .6), { vol: vol / (1 + i), pos, at, ref: 1 }));
  const bellNote = (f, at, vol = .05) => [1, 2, 2.76, 4.1].forEach((r, i) => tone(f * r, 2.2 / (1 + i * .7), { vol: vol / (1 + i * 1.5), at, attack: .01, wet: 1.4 }));

  const FX = {
    clink: p => metal(p, rnd(2300, 3900), rnd(.03, .07), rnd(.12, .22)),
    ladle: p => { metal(p, rnd(620, 760), .11, .55); burst(.05, { vol: .12, freq: 2200, pos: p }); },
    till: p => { tone(1850, .07, { type: 'square', vol: .04, pos: p }); tone(1850, .07, { type: 'square', vol: .04, pos: p, at: .12 }); },
    chair: p => burst(rnd(.25, .5), { vol: .06, freq: rnd(380, 520), q: 5, to: rnd(650, 900), pos: p, attack: .03 }),
    tray: p => { burst(.09, { vol: .3, freq: 2400, q: .8, pos: p }); metal(p, rnd(820, 980), .08, .4); burst(.06, { vol: .18, freq: 1900, q: .8, pos: p, at: .11 }); },
    traySlide: p => { burst(.38, { vol: .1, freq: 1700, q: 2, to: 2600, pos: p, attack: .05 }); FX.tray(p); },
    trayDown: p => { burst(.05, { vol: .2, freq: 1500, q: .7, pos: p }); metal(p, 700, .05, .25); },
    beep: p => tone(1320, .13, { vol: .12, pos: p, ref: .8 }),
    ok: p => [784, 988, 1175].forEach((f, i) => tone(f, .16, { type: 'triangle', vol: .09, pos: p, at: i * .09, ref: .8 })),
    scan: (p, dur = 1.6) => { tone(170, dur, { type: 'sawtooth', vol: .018, to: 520, pos: p, attack: .1, ref: .8 }); burst(dur, { vol: .02, freq: 3200, q: 3, pos: p, attack: .2 }); },
    shutter: p => { burst(.025, { vol: .2, freq: 3500, pos: p }); burst(.03, { vol: .15, freq: 2500, pos: p, at: .05 }); },
    step: (p = null) => { burst(.07, { vol: .09, freq: rnd(1000, 1500), q: .9, pos: p }); tone(72, .08, { vol: .06, to: 45, pos: p }); },
    crunch: () => { burst(.06, { vol: .22, freq: 2600, q: .7, wet: .1 }); burst(.05, { vol: .18, freq: 3200, q: .7, at: .09, wet: .1 }); burst(.05, { vol: .12, freq: 2200, q: .7, at: .2, wet: .1 }); },
    soft: () => { burst(.1, { vol: .2, type: 'lowpass', freq: 900, wet: .1 }); burst(.08, { vol: .12, type: 'lowpass', freq: 700, at: .18, wet: .1 }); },
    slurp: () => burst(.3, { vol: .12, freq: 700, q: 3, to: 2600, attack: .05, wet: .1 }),
    spoon: () => metal(null, rnd(2900, 3400), .035, .15),
    scrape: p => { burst(.55, { vol: .16, freq: 1300, q: 3, to: 800, pos: p, attack: .04 }); burst(.3, { vol: .1, freq: 2100, q: 4, to: 1500, pos: p, at: .3 }); },
    plop: p => { tone(170, .2, { vol: .12, to: 60, pos: p }); burst(.06, { vol: .08, type: 'lowpass', freq: 600, pos: p }); },
    blip: () => tone(rnd(470, 540), .035, { type: 'triangle', vol: .022, wet: .1 }),
    select: () => { tone(660, .06, { type: 'square', vol: .025, wet: .1 }); tone(990, .08, { type: 'square', vol: .025, at: .06, wet: .1 }); },
    whoosh: () => burst(.35, { vol: .06, freq: 500, q: .7, to: 1400, attack: .1, wet: .2 }),
    // Westminster-style school chime
    bell: () => [[659.3, 523.3, 587.3, 392], [392, 587.3, 659.3, 523.3]].flat().forEach((f, i) => bellNote(f, i * .62 + (i > 3 ? .5 : 0))),
    koel: p => { const base = rnd(640, 720); for (let i = 0; i < 4; i++) { const f = base * (1 + i * .07); tone(f, .16, { vol: .05, to: f * 1.12, pos: p, at: i * .72, ref: 5, wet: .3 }); tone(f * 1.3, .3, { vol: .06, to: f * 1.45, pos: p, at: i * .72 + .2, ref: 5, wet: .3 }); } },
    sparrow: p => { const n = 3 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) tone(rnd(4200, 5200), .05, { vol: .025, to: rnd(3600, 5600), pos: p, at: i * rnd(.09, .16), ref: 4, wet: .2 }); },
    mynah: p => { tone(rnd(1600, 2000), .13, { vol: .03, to: 2700, pos: p, ref: 4, wet: .3 }); tone(2600, .1, { vol: .03, to: 1500, pos: p, at: .17, ref: 4, wet: .3 }); tone(2100, .06, { vol: .025, pos: p, at: .34, ref: 4 }); },
    thunder: () => { burst(4.5, { vol: .22, type: 'lowpass', freq: 140, attack: .7, buf: brownBuf, wet: 1 }); burst(2.5, { vol: .1, type: 'lowpass', freq: 90, attack: .3, at: .5, buf: brownBuf, wet: 1 }); },
  };

  /* ------------------------------------------------------------ per frame */
  function listen(cam) {
    if (!ctx) return;
    const l = ctx.listener; cam.getWorldPosition(V1); cam.getWorldQuaternion(Q);
    V2.set(0, 0, -1).applyQuaternion(Q); V3.set(0, 1, 0).applyQuaternion(Q);
    if (l.positionX) { l.positionX.value = V1.x; l.positionY.value = V1.y; l.positionZ.value = V1.z; l.forwardX.value = V2.x; l.forwardY.value = V2.y; l.forwardZ.value = V2.z; l.upX.value = V3.x; l.upY.value = V3.y; l.upZ.value = V3.z; }
    else { l.setPosition(V1.x, V1.y, V1.z); l.setOrientation(V2.x, V2.y, V2.z, V3.x, V3.y, V3.z); }
  }
  function tick(dt) {
    if (!ctx || muted) return;
    const every = (k, a, b, fn) => { if (clock[k] === undefined) clock[k] = rnd(a, b); clock[k] -= dt; if (clock[k] <= 0) { clock[k] = rnd(a, b); fn(); } };
    const table = () => { const [x, z] = pick(spots.tables); return [x + rnd(-1.2, 1.2), .8, z + rnd(-.4, .4)]; };
    if (spots.tables.length) { every('clink', .22, .9, () => FX.clink(table())); every('chair', 5, 14, () => FX.chair([table()[0], .3, table()[2]])); }
    if (spots.ladle) every('ladle', 5, 12, () => FX.ladle(spots.ladle));
    if (spots.till) every('till', 11, 24, () => FX.till(spots.till));
    if (spots.rack) every('tray', 14, 32, () => FX.tray(spots.rack));
    if (spots.outside.length) {
      const out = () => { const [x, y, z] = pick(spots.outside); return [x + rnd(-8, 8), y + rnd(0, 3), z + rnd(-3, 5)]; };
      every('sparrow', 3, 8, () => FX.sparrow(out())); every('mynah', 8, 19, () => FX.mynah(out())); every('koel', 20, 40, () => FX.koel(out()));
    }
    every('thunder', 60, 130, FX.thunder);
    // chatter: formants glide between vowels, pitch rises and falls
    const now = ctx.currentTime;
    voices.forEach(v => {
      if (now < v.next) return;
      v.next = now + rnd(.11, .26);
      v.f1.frequency.setTargetAtTime(rnd(320, 860), now, .03);
      v.f2.frequency.setTargetAtTime(rnd(950, 2300), now, .03);
      v.osc.frequency.setTargetAtTime(v.f0 * rnd(.88, 1.18), now, .08);
    });
  }

  return {
    get ctx() { return ctx; },
    get muted() { return muted; },
    spots, start, listen, tick,
    play(name, pos, ...a) { if (ctx && !muted && FX[name]) FX[name](pos, ...a); },
    toggle() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : .9, ctx.currentTime, .05); return muted; },
    /** Quieter crowd while talking to someone or reading the scanner. */
    duck(on) { if (!ctx) return; voices.forEach(v => v.lv.gain.setTargetAtTime(on ? .7 : 1.6, ctx.currentTime, .3)); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
};
})();
