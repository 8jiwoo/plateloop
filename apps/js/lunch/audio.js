/* Lunch Rush soundscape, all synthesised with Web Audio (no sound files), built to run smoothly:
   the crowd murmur is rendered once, offline, into seamless loops played from a few spots in the hall;
   positional sound uses cheap equal-power panners, and one-shots share a small pool instead of creating new
   nodes each time. Beds: crowd, room tone, rain outside, the wok, ceiling fans. Events: cutlery, benches,
   the ladle, the till, trays, a distant koel, far-off thunder, the school chime. */
(() => {
'use strict';
const L = PL.L3;

L.Sound = () => {
  let ctx = null, master, dry, verbIn, noiseBuf, brownBuf, flatOut, muted = false;
  const spots = { tables: [], crowd: [], kitchen: [], ladle: null, till: null, rack: null, fans: [], outside: [] };
  const clock = {}, pool = [], loops = [];
  let poolI = 0;
  const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion();
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

  /* ------------------------------------------------------------ graph */
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    ctx = new A({ latencyHint: 'playback' });
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : .85; master.connect(comp);
    dry = ctx.createGain(); dry.connect(master);
    const conv = ctx.createConvolver(); conv.buffer = impulse(2.8, 2.6);
    verbIn = ctx.createGain(); verbIn.gain.value = .3; const verbOut = ctx.createGain(); verbOut.gain.value = .5;
    verbIn.connect(conv).connect(verbOut).connect(master);
    flatOut = ctx.createGain(); flatOut.connect(dry); const fw = ctx.createGain(); fw.gain.value = .25; flatOut.connect(fw).connect(verbIn);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    { const d = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
    for (let i = 0; i < 10; i++) pool.push(panner([0, 1, 0], 1.2, .7));
    beds();
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * Math.min(1, i / (ctx.sampleRate * .015)); }
    return b;
  }
  const setPos = (pn, p) => { if (pn.positionX) { pn.positionX.value = p[0]; pn.positionY.value = p[1]; pn.positionZ.value = p[2]; } else pn.setPosition(p[0], p[1], p[2]); };
  function panner(p, ref = 1.5, wet = 1) {
    const pn = ctx.createPanner();
    pn.panningModel = 'equalpower'; pn.distanceModel = 'inverse'; pn.refDistance = ref; pn.maxDistance = 60; pn.rolloffFactor = 1;
    setPos(pn, p); pn.connect(dry);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; pn.connect(w).connect(verbIn); }
    return pn;
  }
  const at = p => { if (!p) return flatOut; const pn = pool[poolI++ % pool.length]; setPos(pn, p); return pn; };
  const loopSrc = (buf = noiseBuf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); return s; };

  /* ------------------------------------------------------------ offline-rendered crowd */
  /** Crowd murmur: many softly filtered voices with a syllable rhythm, rendered once into a seamless loop. */
  async function renderCrowd(sec, voices, seed) {
    const sr = 22050, n = sr * sec, oc = new OfflineAudioContext(2, n, sr);
    const nb = oc.createBuffer(1, sr * 3, sr); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(oc.destination);
    for (let v = 0; v < voices; v++) {
      const env = oc.createBuffer(1, n, sr), d = env.getChannelData(0);
      let i = Math.floor(Math.random() * sr);
      while (i < n) {
        if (Math.random() < .14) { i += Math.floor(sr * rnd(.4, 1.6)); continue; }
        const len = Math.floor(sr * rnd(.08, .24)), amp = rnd(.35, 1);
        for (let k = 0; k < len && i + k < n; k++) d[i + k] = amp * Math.pow(Math.sin(Math.PI * k / len), 1.5);
        i += len + Math.floor(sr * rnd(.03, .12));
      }
      const ns = oc.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const f0 = Math.random() < .5 ? rnd(110, 150) : rnd(190, 240), osc = oc.createOscillator(); osc.type = 'triangle'; osc.frequency.value = f0;
      const og = oc.createGain(), ng = oc.createGain(); og.gain.value = .35; ng.gain.value = .8;
      const f1 = oc.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 3; const f2 = oc.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 4;
      for (let t = 0; t < sec; t += rnd(.12, .28)) { f1.frequency.setTargetAtTime(rnd(350, 820), t, .04); f2.frequency.setTargetAtTime(rnd(1000, 2200), t, .04); osc.frequency.setTargetAtTime(f0 * rnd(.9, 1.15), t, .08); }
      const src = oc.createGain(); ns.connect(ng).connect(src); osc.connect(og).connect(src); src.connect(f1); src.connect(f2);
      const g = oc.createGain(); g.gain.value = 0; f1.connect(g); f2.connect(g);
      const es = oc.createBufferSource(); es.buffer = env; es.connect(g.gain);
      const pan = oc.createStereoPanner(); pan.pan.value = rnd(-.8, .8); const lv = oc.createGain(); lv.gain.value = rnd(.5, 1);
      g.connect(lv).connect(pan).connect(lp);
      ns.start(0, Math.random() * 3); osc.start(); es.start();
    }
    const out = await oc.startRendering();
    return seamless(out, Math.floor(sr * .8));
  }
  /** A bouncy four-bar loop at 128 bpm: kick, hats, bass and a square-wave hook. */
  async function renderMusic() {
    const sr = 22050, beat = 60 / 128, bars = 8, n = Math.round(sr * beat * 4 * bars), oc = new OfflineAudioContext(1, n, sr);
    const out = oc.createGain(); out.gain.value = .6; out.connect(oc.destination);
    const nb = oc.createBuffer(1, sr, sr); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const note = (f, t, dur, type, vol) => { const o = oc.createOscillator(), g = oc.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005); g.gain.setTargetAtTime(0, t + dur * .6, dur / 5); o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05); };
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
    const hook = [0, 2, 1, 2, 0, 2, 1, 0];
    for (let b = 0; b < bars * 4; b++) {
      const t = b * beat, ch = chords[Math.floor(b / 4) % 4];
      { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12); g.gain.setValueAtTime(.9, t); g.gain.setTargetAtTime(0, t + .02, .05); o.connect(g).connect(out); o.start(t); o.stop(t + .25); }
      [.5, .75].forEach(k => { const s = oc.createBufferSource(), f = oc.createBiquadFilter(), g = oc.createGain(); s.buffer = nb; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(.25, t + k * beat); g.gain.setTargetAtTime(0, t + k * beat, .02); s.connect(f).connect(g).connect(out); s.start(t + k * beat, Math.random() * .5, .08); });
      note(ch[0] / 2, t + beat / 2, beat / 2, 'square', .12);
      [0, .5].forEach((k, j) => note(ch[hook[(b * 2 + j) % 8]] * 2, t + k * beat, beat / 2.2, 'square', .06));
    }
    return oc.startRendering();
  }
  /** Crossfade the end into the start so the loop point can't click. */
  function seamless(b, N) {
    const len = b.length - N, o = ctx.createBuffer(b.numberOfChannels, len, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      const s = b.getChannelData(ch), d = o.getChannelData(ch); let peak = 0;
      for (let i = 0; i < len - N; i++) d[i] = s[i + N];
      for (let j = 0; j < N; j++) { const k = j / N; d[len - N + j] = s[b.length - N + j] * (1 - k) + s[j] * k; }
      for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
      if (peak > 0) for (let i = 0; i < len; i++) d[i] *= .5 / peak;
    }
    return o;
  }

  /* ------------------------------------------------------------ beds */
  function beds() {
    // room tone: air, the fans, the building
    const rt = loopSrc(brownBuf), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    const g = ctx.createGain(); g.gain.value = .14; rt.connect(lp).connect(g).connect(flatOut);
    // rain on the roof and the field outside, from the open side
    spots.outside.slice(0, 2).forEach(([x, y, z]) => {
      const ns = loopSrc(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 5200;
      const lv = ctx.createGain(); lv.gain.value = .1; ns.connect(hp).connect(lp2).connect(lv).connect(panner([x, 3, 9.5], 5, .4));
    });
    { const ns = loopSrc(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .5; const lv = ctx.createGain(); lv.gain.value = .035; ns.connect(bp).connect(lv).connect(panner([0, 4.3, 0], 8, .2)); }
    // kitchens: a wok's sizzle
    spots.kitchen.forEach(p => {
      const ns = loopSrc(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
      const am = ctx.createGain(); am.gain.value = .6; const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(.15, .3); const lg = ctx.createGain(); lg.gain.value = .35; lfo.connect(lg).connect(am.gain); lfo.start();
      const lv = ctx.createGain(); lv.gain.value = .045; ns.connect(hp).connect(am).connect(lv).connect(panner(p, 1.2, .8));
    });
    // two ceiling fans nearby
    spots.fans.slice(0, 2).forEach(p => {
      const ns = loopSrc(), lp3 = ctx.createBiquadFilter(); lp3.type = 'lowpass'; lp3.frequency.value = 450;
      const am = ctx.createGain(); am.gain.value = .6; const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(2.6, 3.2); const lg = ctx.createGain(); lg.gain.value = .3; lfo.connect(lg).connect(am.gain); lfo.start();
      const lv = ctx.createGain(); lv.gain.value = .04; ns.connect(lp3).connect(am).connect(lv).connect(panner(p, 1, .3));
    });
    // a phone playing a song through its tiny speaker
    if (spots.music) renderMusic().then(buf => {
      if (!ctx) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 650;
      const lp4 = ctx.createBiquadFilter(); lp4.type = 'lowpass'; lp4.frequency.value = 4200;
      const g2 = ctx.createGain(); g2.gain.value = .22; s.connect(hp).connect(lp4).connect(g2).connect(panner(spots.music, .8, .5)); s.start();
    }).catch(() => {});
    // the crowd, from a few spots in the hall, once it has rendered
    renderCrowd(14, 16).then(buf => {
      if (!ctx) return;
      spots.crowd.slice(0, 4).forEach(([x, z], i) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rnd(.96, 1.04);
        const g2 = ctx.createGain(); g2.gain.value = 0; s.connect(g2).connect(panner([x, 1.2, z], 3, .9));
        s.start(0, i * 3.3 % buf.duration); loops.push(g2); g2.gain.setTargetAtTime(.55, ctx.currentTime, 1.5);
      });
    }).catch(() => {});
  }

  /* ------------------------------------------------------------ one-shots */
  function tone(f, dur, { type = 'sine', vol = .1, to = null, delay = 0, pos = null, attack = .005 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.setTargetAtTime(0, t + attack, dur / 4);
    o.connect(g).connect(at(pos)); o.start(t); o.stop(t + dur + .1);
  }
  function burst(dur, { vol = .2, type = 'bandpass', freq = 1000, q = 1, to = null, delay = 0, pos = null, attack = .004, buf = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = buf || noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.setTargetAtTime(0, t + attack, dur / 4);
    s.connect(f).connect(g).connect(at(pos)); s.start(t, Math.random() * 2); s.stop(t + dur + .1);
  }
  const metal = (pos, base, vol, dur, delay = 0) => [1, 2.76, 5.4].forEach((r, i) => tone(base * r * rnd(.99, 1.01), dur / (1 + i * .6), { vol: vol / (1 + i), pos, delay }));
  const bellNote = (f, delay, vol = .045) => [1, 2, 2.76].forEach((r, i) => tone(f * r, 2.4 / (1 + i * .7), { vol: vol / (1 + i * 1.6), delay, attack: .01 }));

  const FX = {
    clink: p => metal(p, rnd(2400, 3600), rnd(.02, .04), rnd(.12, .2)),
    ladle: p => metal(p, rnd(620, 740), .07, .5),
    till: p => { tone(1800, .07, { type: 'triangle', vol: .03, pos: p }); tone(1800, .07, { type: 'triangle', vol: .03, pos: p, delay: .12 }); },
    chair: p => burst(rnd(.3, .5), { vol: .04, freq: rnd(380, 520), q: 5, to: rnd(650, 900), pos: p, attack: .04 }),
    tray: p => { burst(.1, { vol: .16, freq: 2300, q: .8, pos: p }); metal(p, rnd(820, 960), .05, .4); },
    traySlide: p => { burst(.38, { vol: .07, freq: 1700, q: 2, to: 2500, pos: p, attack: .06 }); FX.tray(p); },
    trayDown: p => { burst(.06, { vol: .12, freq: 1500, q: .7, pos: p }); metal(p, 700, .03, .25); },
    beep: p => tone(1320, .14, { vol: .07, pos: p }),
    ok: p => [784, 988, 1175].forEach((f, i) => tone(f, .18, { type: 'triangle', vol: .055, pos: p, delay: i * .09 })),
    scan: (p, dur = 1.6) => tone(170, dur, { type: 'triangle', vol: .02, to: 480, pos: p, attack: .15 }),
    shutter: p => burst(.03, { vol: .12, freq: 3200, pos: p }),
    step: () => { burst(.07, { vol: .045, freq: rnd(900, 1300), q: .9 }); tone(70, .08, { vol: .04, to: 48 }); },
    crunch: () => { burst(.06, { vol: .12, freq: 2600, q: .7 }); burst(.05, { vol: .1, freq: 3100, q: .7, delay: .1 }); },
    soft: () => burst(.12, { vol: .12, type: 'lowpass', freq: 900 }),
    slurp: () => burst(.3, { vol: .07, freq: 700, q: 3, to: 2400, attack: .06 }),
    spoon: () => metal(null, rnd(2900, 3300), .02, .14),
    scrape: p => { burst(.55, { vol: .1, freq: 1300, q: 3, to: 800, pos: p, attack: .05 }); burst(.3, { vol: .06, freq: 2000, q: 4, to: 1500, pos: p, delay: .3 }); },
    plop: p => { tone(160, .2, { vol: .08, to: 60, pos: p }); burst(.06, { vol: .05, type: 'lowpass', freq: 600, pos: p }); },
    blip: () => {},
    select: () => tone(740, .08, { type: 'triangle', vol: .025 }),
    whoosh: () => burst(.4, { vol: .03, freq: 500, q: .7, to: 1300, attack: .12 }),
    bell: () => [[659.3, 523.3, 587.3, 392], [392, 587.3, 659.3, 523.3]].flat().forEach((f, i) => bellNote(f, i * .64 + (i > 3 ? .5 : 0))),
    koel: p => { const base = rnd(640, 700); for (let i = 0; i < 3; i++) { const f = base * (1 + i * .07); tone(f, .18, { vol: .025, to: f * 1.1, pos: p, delay: i * .8 }); tone(f * 1.3, .32, { vol: .03, to: f * 1.42, pos: p, delay: i * .8 + .22 }); } },
    thunder: () => { burst(5, { vol: .12, type: 'lowpass', freq: 120, attack: 1, buf: brownBuf }); },
  };

  /* ------------------------------------------------------------ singing */
  // vowel formants (Hz) for a light soprano
  const VOWELS = { a: [800, 1150, 2900], e: [480, 1950, 2700], i: [330, 2500, 3100], o: [470, 830, 2800], u: [350, 760, 2600] };
  /** Sing a melody: notes are [vowel, midi, beats]; returns how long it takes, in seconds. */
  function sing(pos, notes, bpm = 120) {
    if (!ctx || muted) return 0;
    const beat = 60 / bpm, out = panner(pos, 1.4, .7);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const vib = ctx.createOscillator(); vib.frequency.value = 5.4; const vg = ctx.createGain(); vg.gain.value = 22; vib.connect(vg).connect(osc.detune);
    const air = loopSrc(), ag = ctx.createGain(); ag.gain.value = .06;
    const src = ctx.createGain(); osc.connect(src); air.connect(ag).connect(src);
    const env = ctx.createGain(); env.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const fs = [0, 1, 2].map(i => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [7, 9, 12][i]; const g = ctx.createGain(); g.gain.value = [1, .55, .3][i]; src.connect(f).connect(g).connect(env); return f; });
    const vol = ctx.createGain(); vol.gain.value = .5; env.connect(lp).connect(vol).connect(out);
    let t = ctx.currentTime + .15;
    notes.forEach(([v, midi, beats]) => {
      const dur = beats * beat;
      if (!v) { env.gain.setTargetAtTime(0, t, .05); t += dur; return; }
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      osc.frequency.setTargetAtTime(f, t, .02);
      VOWELS[v].forEach((hz, i) => fs[i].frequency.setTargetAtTime(hz, t, .03));
      env.gain.setTargetAtTime(.9, t, .025); env.gain.setTargetAtTime(.3, t + dur * .82, .025);
      burst(.04, { vol: .025, type: 'highpass', freq: 3500, pos, delay: t - ctx.currentTime });
      t += dur;
    });
    env.gain.setTargetAtTime(0, t, .1);
    osc.start(); vib.start(); osc.stop(t + 1); vib.stop(t + 1);
    return t - ctx.currentTime;
  }

  /* ------------------------------------------------------------ per frame */
  function listen(cam) {
    if (!ctx) return;
    const l = ctx.listener, t = ctx.currentTime; cam.getWorldPosition(V1); cam.getWorldQuaternion(Q);
    V2.set(0, 0, -1).applyQuaternion(Q); V3.set(0, 1, 0).applyQuaternion(Q);
    if (l.positionX) {
      [[l.positionX, V1.x], [l.positionY, V1.y], [l.positionZ, V1.z], [l.forwardX, V2.x], [l.forwardY, V2.y], [l.forwardZ, V2.z], [l.upX, V3.x], [l.upY, V3.y], [l.upZ, V3.z]].forEach(([p, v]) => p.setTargetAtTime(v, t, .04));
    } else { l.setPosition(V1.x, V1.y, V1.z); l.setOrientation(V2.x, V2.y, V2.z, V3.x, V3.y, V3.z); }
  }
  function tick(dt) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const every = (k, a, b, fn) => { if (clock[k] === undefined) clock[k] = rnd(a, b); clock[k] -= dt; if (clock[k] <= 0) { clock[k] = rnd(a, b); fn(); } };
    const table = () => { const [x, z] = pick(spots.tables); return [x + rnd(-1.2, 1.2), .8, z + rnd(-.4, .4)]; };
    if (spots.tables.length) { every('clink', .5, 1.6, () => FX.clink(table())); every('chair', 8, 18, () => FX.chair(table())); }
    if (spots.ladle) every('ladle', 7, 14, () => FX.ladle(spots.ladle));
    if (spots.till) every('till', 14, 28, () => FX.till(spots.till));
    if (spots.rack) every('tray', 16, 34, () => FX.tray(spots.rack));
    if (spots.outside.length) every('koel', 30, 60, () => { const [x, y, z] = pick(spots.outside); FX.koel([x + rnd(-8, 8), y, z]); });
    every('thunder', 50, 110, FX.thunder);
  }

  return {
    get ctx() { return ctx; },
    get muted() { return muted; },
    spots, start, listen, tick, sing,
    play(name, pos, ...a) { if (ctx && !muted && ctx.state === 'running' && FX[name]) FX[name](pos, ...a); },
    toggle() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : .85, ctx.currentTime, .05); return muted; },
    /** Quieter crowd while talking to someone or reading the scanner. */
    duck(on) { if (ctx) loops.forEach(g => g.gain.setTargetAtTime(on ? .25 : .55, ctx.currentTime, .4)); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
};
})();
