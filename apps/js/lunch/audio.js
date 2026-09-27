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
    loadClips();
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
  /** Sophie's radio: an upbeat 8-bar pop loop at 128 bpm in C (C G Am F) with kick, clap, hats, bass,
   *  chord stabs and a lead that plays the tune she sings. */
  async function renderMusic() {
    const sr = 32000, beat = 60 / 128, bars = 8, n = Math.round(sr * beat * 4 * bars), oc = new OfflineAudioContext(2, n, sr);
    const bus = oc.createGain(); bus.gain.value = .7; bus.connect(oc.destination);
    const nb = oc.createBuffer(1, sr, sr); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const panTo = v => { const p = oc.createStereoPanner(); p.pan.value = v; p.connect(bus); return p; };
    const L = panTo(-.35), R = panTo(.35), C = panTo(0);
    const note = (f, t, dur, type, vol, out = C, cut = 3000) => { const o = oc.createOscillator(), g = oc.createGain(), lp = oc.createBiquadFilter(); o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = cut; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.setTargetAtTime(0, t + dur * .7, dur / 5); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + .1); };
    const noise = (t, dur, vol, type, f, out = C) => { const s2 = oc.createBufferSource(), fl = oc.createBiquadFilter(), g = oc.createGain(); s2.buffer = nb; fl.type = type; fl.frequency.value = f; g.gain.setValueAtTime(vol, t); g.gain.setTargetAtTime(0, t, dur); s2.connect(fl).connect(g).connect(out); s2.start(t, Math.random() * .5, dur * 5); };
    const chords = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];
    const tune = [[72, 72, 74, 76, 76, 74, 72, 74], [76, 77, 76, 74, 72, 74, 72, 0], [72, 72, 74, 76, 76, 77, 79, 77], [76, 74, 72, 74, 76, 74, 72, 0]];
    for (let bar = 0; bar < bars; bar++) {
      const ch = chords[bar % 4], t0 = bar * 4 * beat;
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); g.gain.setValueAtTime(1, t); g.gain.setTargetAtTime(0, t + .03, .07); o.connect(g).connect(C); o.start(t); o.stop(t + .4); }
        if (q % 2) { noise(t, .07, .5, 'bandpass', 1800); noise(t + .012, .05, .3, 'highpass', 3000, R); }
        noise(t + beat / 2, .02, .18, 'highpass', 8000, R); noise(t + beat * .25, .015, .07, 'highpass', 9000, L); noise(t + beat * .75, .015, .07, 'highpass', 9000, L);
        note(hz(ch[0] - 12), t, beat * .45, 'sawtooth', .22, C, 500); note(hz(ch[0]), t + beat / 2, beat * .4, 'sawtooth', .16, C, 700);
        if (q === 1 || q === 3) ch.forEach(m => note(hz(m + 12), t + beat / 2, beat * .35, 'square', .05, L, 2400));
      }
      if (bar >= 4) tune[bar % 4].forEach((m, k) => { if (m) note(hz(m), t0 + k * beat / 2, beat * .45, 'square', .07, R, 3200); });
    }
    return oc.startRendering();
  }
  /** The aura: an "aah" choir drifting through A, F#m, D and E with long swells, harp-like bells twinkling
   *  above and a breath of air, rendered once into a seamless 16-second loop. */
  async function renderAura() {
    const sr = 32000, sec = 17, n = sr * sec, oc = new OfflineAudioContext(2, n, sr);
    const bus = oc.createGain(); bus.gain.value = .8; bus.connect(oc.destination);
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const chords = [[57, 64, 69, 73, 76], [54, 61, 66, 69, 73], [50, 57, 62, 66, 69], [52, 59, 64, 68, 71], [57, 64, 69, 73, 76]];
    chords.forEach((ch, k) => {
      const t0 = k * 4 - 1;
      ch.forEach((m, v) => [-6, 6].forEach(cents => {
        const o = oc.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = cents;
        const vib = oc.createOscillator(), vg = oc.createGain(); vib.frequency.value = 4.4 + v * .15; vg.gain.value = 8; vib.connect(vg).connect(o.detune);
        const mix = oc.createGain(), st = Math.max(0, t0);
        [[800, 6, 1], [1150, 8, .45], [2900, 10, .2]].forEach(([f, q, gn]) => { const b = oc.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const g = oc.createGain(); g.gain.value = gn; o.connect(b).connect(g).connect(mix); });
        mix.gain.setValueAtTime(0, st); mix.gain.linearRampToValueAtTime(.1, t0 + 2); mix.gain.linearRampToValueAtTime(.1, t0 + 4.5); mix.gain.linearRampToValueAtTime(0, t0 + 6.5);
        const pan = oc.createStereoPanner(); pan.pan.value = (v - 2) * .25; mix.connect(pan).connect(bus);
        o.start(st); vib.start(st); o.stop(Math.min(sec, t0 + 6.6)); vib.stop(Math.min(sec, t0 + 6.6));
      }));
    });
    const pluck = (f, when, vol) => { const o = oc.createOscillator(), g = oc.createGain(), pan = oc.createStereoPanner(); o.type = 'triangle'; o.frequency.value = f; pan.pan.value = Math.random() * 1.6 - .8; g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + .005); g.gain.setTargetAtTime(0, when + .01, .7); o.connect(g).connect(pan).connect(bus); o.start(when); o.stop(when + 3.5); };
    const bells = [81, 85, 88, 93, 97, 100];
    for (let t = .5; t < sec - 1; t += .35 + Math.random() * .6) pluck(hz(bells[Math.floor(Math.random() * bells.length)]), t, .045);
    const nb = oc.createBuffer(1, n, sr); { const d = nb.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const air = oc.createBufferSource(), hp = oc.createBiquadFilter(), ag = oc.createGain(); air.buffer = nb; hp.type = 'highpass'; hp.frequency.value = 7000; ag.gain.value = .02; air.connect(hp).connect(ag).connect(bus); air.start();
    const out = await oc.startRendering();
    return seamless(out, sr);
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
    const g = ctx.createGain(); g.gain.value = .05; rt.connect(lp).connect(g).connect(flatOut);
    // rain on the roof and the field outside, from the open side
    spots.outside.slice(0, 2).forEach(([x, y, z]) => {
      const ns = loopSrc(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 5200;
      const lv = ctx.createGain(); lv.gain.value = .04; ns.connect(hp).connect(lp2).connect(lv).connect(panner([x, 3, 9.5], 5, .4));
    });
    { const ns = loopSrc(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .5; const lv = ctx.createGain(); lv.gain.value = .014; ns.connect(bp).connect(lv).connect(panner([0, 4.3, 0], 8, .2)); }
    // kitchens: a wok's sizzle
    spots.kitchen.forEach(p => {
      const ns = loopSrc(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
      const am = ctx.createGain(); am.gain.value = .6; const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(.15, .3); const lg = ctx.createGain(); lg.gain.value = .35; lfo.connect(lg).connect(am.gain); lfo.start();
      const lv = ctx.createGain(); lv.gain.value = .022; ns.connect(hp).connect(am).connect(lv).connect(panner(p, 1.2, .8));
    });
    // two ceiling fans nearby
    spots.fans.slice(0, 2).forEach(p => {
      const ns = loopSrc(), lp3 = ctx.createBiquadFilter(); lp3.type = 'lowpass'; lp3.frequency.value = 450;
      const am = ctx.createGain(); am.gain.value = .6; const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(2.6, 3.2); const lg = ctx.createGain(); lg.gain.value = .3; lfo.connect(lg).connect(am.gain); lfo.start();
      const lv = ctx.createGain(); lv.gain.value = .018; ns.connect(lp3).connect(am).connect(lv).connect(panner(p, 1, .3));
    });
    // a celestial aura where Disha floats: a slow choir with twinkling bells, loud up close, gone across the room
    if (spots.shrine) renderAura().then(buf => {
      if (!ctx) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const pn = panner(spots.shrine, 1.6, .9); pn.distanceModel = 'exponential'; pn.rolloffFactor = 1.6; pn.maxDistance = 40;
      const g2 = ctx.createGain(); g2.gain.value = 0; s.connect(g2).connect(pn); s.start(); g2.gain.setTargetAtTime(.8, ctx.currentTime, 1.5);
    }).catch(() => {});
    // a phone playing a song through its tiny speaker
    if (spots.music) renderMusic().then(buf => {
      if (!ctx) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
      const lp4 = ctx.createBiquadFilter(); lp4.type = 'lowpass'; lp4.frequency.value = 7500;
      // loud next to the radio, fading quickly as you walk away
      const pn = panner(spots.music, 1.4, .45); pn.distanceModel = 'exponential'; pn.rolloffFactor = 1.7; pn.maxDistance = 40;
      const g2 = ctx.createGain(); g2.gain.value = .85; s.connect(hp).connect(lp4).connect(g2).connect(pn); s.start();
    }).catch(() => {});
    // the crowd, from a few spots in the hall, once it has rendered
    renderCrowd(14, 16).then(buf => {
      if (!ctx) return;
      spots.crowd.slice(0, 4).forEach(([x, z], i) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rnd(.96, 1.04);
        const g2 = ctx.createGain(); g2.gain.value = 0; s.connect(g2).connect(panner([x, 1.2, z], 3, .9));
        s.start(0, i * 3.3 % buf.duration); loops.push(g2); g2.gain.setTargetAtTime(.3, ctx.currentTime, 1.5);
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
    fortune: p => [1318.5, 1760, 2093, 2637].forEach((f, i) => tone(f, 1.6, { vol: .035, pos: p, delay: i * .13, attack: .01 })),
    // celestial: an "aah" choir moving A major -> D major -> A major, a harp glissando up and back down,
    // high bells twinkling, and a shimmer of air, all drenched in reverb and played straight to the listener
    celestial: (p, dur = 5.2) => {
      if (!ctx) return;
      const t = ctx.currentTime, out = ctx.createGain(); out.gain.value = .9; out.connect(dry);
      const wet = ctx.createGain(); wet.gain.value = 1.3; out.connect(wet).connect(verbIn);
      const hz = m => 440 * Math.pow(2, (m - 69) / 12);
      const chords = [[57, 64, 69, 73, 76], [50, 57, 62, 66, 69], [57, 64, 69, 73, 81]], at3 = [0, dur * .36, dur * .7];
      chords[0].forEach((m, v) => [-7, 7].forEach(cents => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = cents; o.frequency.setValueAtTime(hz(m), t);
        chords.forEach((ch, k) => { if (k) o.frequency.setTargetAtTime(hz(ch[v]), t + at3[k], .12); });
        const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.6 + v * .2; vg.gain.value = 9; vib.connect(vg).connect(o.detune);
        const mix = ctx.createGain(); mix.gain.value = 0;
        [[800, 6, 1], [1150, 8, .5], [2900, 10, .22]].forEach(([f, q, gn]) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const g = ctx.createGain(); g.gain.value = gn; o.connect(b).connect(g).connect(mix); });
        mix.gain.setValueAtTime(0, t); mix.gain.linearRampToValueAtTime(.16, t + 1.2); mix.gain.setValueAtTime(.16, t + dur - 1); mix.gain.linearRampToValueAtTime(0, t + dur + 1.4);
        mix.connect(out); o.start(t); vib.start(t); o.stop(t + dur + 1.6); vib.stop(t + dur + 1.6);
      }));
      // a warm low drone underneath
      { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz(45); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + 1.5); g.gain.linearRampToValueAtTime(0, t + dur + 1.2); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 1.3); }
      const pluck = (f, when, vol, len = 1.6) => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = .3; o2.connect(g2).connect(g); o.connect(g); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + .004); g.gain.setTargetAtTime(0, when + .01, len / 5); g.connect(out); o.start(when); o2.start(when); o.stop(when + len); o2.stop(when + len); };
      // harp: up two octaves of A major, then back down
      const scale = [69, 71, 73, 76, 78, 81, 83, 85, 88, 90, 93];
      scale.forEach((m, i) => pluck(hz(m), t + .25 + i * .075, .09));
      scale.slice().reverse().forEach((m, i) => pluck(hz(m), t + dur * .62 + i * .075, .08));
      // bells twinkling high above
      for (let i = 0; i < 18; i++) { const m = [93, 97, 100, 105, 97, 100][i % 6]; pluck(hz(m), t + .6 + i * (dur - 1) / 18 + Math.random() * .08, .05, 2.4); }
      // a breath of shimmering air
      burst(dur + .5, { vol: .05, type: 'highpass', freq: 6500, attack: 1.4 });
    },
    punch: p => { tone(95, .28, { vol: .3, to: 38, pos: p }); burst(.07, { vol: .4, freq: 2400, q: .7, pos: p }); burst(.12, { vol: .15, type: 'lowpass', freq: 700, pos: p, delay: .02 }); },
    thud: p => { tone(72, .45, { vol: .32, to: 34, pos: p }); burst(.25, { vol: .2, type: 'lowpass', freq: 420, pos: p }); FX.tray(p); },
    hiya: p => sing(p, [['i', 64, .25], ['a', 71, .9]], 120, .7),
    // an original little victory jingle, with a voice singing "G, G, fricking E, Z"
    ggez: p => {
      if (!ctx) return;
      const bpm = 150, b = 60 / bpm, hz = m => 440 * Math.pow(2, (m - 69) / 12);
      [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(hz(m), .12, { type: 'square', vol: .045, pos: p, delay: i * b / 4 }));
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, i) => ch.forEach(m => tone(hz(m), b * .9, { type: 'square', vol: .025, pos: p, delay: 1.9 * b + i * b })));
      for (let i = 0; i < 8; i++) { tone(140, .12, { vol: .18, to: 45, pos: p, delay: i * b / 2 }); if (i % 2) burst(.06, { vol: .12, freq: 1800, pos: p, delay: i * b / 2 }); }
      sing(p, [[null, 0, 2], ['i', 62, .5], ['i', 62, .5], ['i', 60, .25], ['i', 57, .25], ['i', 64, .5], ['i', 69, 1.3]], bpm, .75);
    },
    ez: p => { const hz = m => 440 * Math.pow(2, (m - 69) / 12); tone(hz(76), .1, { type: 'square', vol: .04, pos: p }); tone(hz(84), .25, { type: 'square', vol: .04, pos: p, delay: .1 }); sing(p, [['i', 64, .5], ['i', 69, 1]], 150, .7); },
    thunder: () => { burst(5, { vol: .12, type: 'lowpass', freq: 120, attack: 1, buf: brownBuf }); },
  };

  /* ------------------------------------------------------------ singing */
  // vowel formants (Hz) for a light soprano
  const VOWELS = { a: [800, 1150, 2900], e: [480, 1950, 2700], i: [330, 2500, 3100], o: [470, 830, 2800], u: [350, 760, 2600] };
  /** Sing a melody: notes are [vowel, midi, beats]; returns how long it takes, in seconds. */
  function sing(pos, notes, bpm = 120, level = .5) {
    if (!ctx || muted) return 0;
    const beat = 60 / bpm, out = panner(pos, 1.4, .7);
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const vib = ctx.createOscillator(); vib.frequency.value = 5.4; const vg = ctx.createGain(); vg.gain.value = 22; vib.connect(vg).connect(osc.detune);
    const air = loopSrc(), ag = ctx.createGain(); ag.gain.value = .06;
    const src = ctx.createGain(); osc.connect(src); air.connect(ag).connect(src);
    const env = ctx.createGain(); env.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const fs = [0, 1, 2].map(i => { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [7, 9, 12][i]; const g = ctx.createGain(); g.gain.value = [1, .55, .3][i]; src.connect(f).connect(g).connect(env); return f; });
    const vol = ctx.createGain(); vol.gain.value = level; env.connect(lp).connect(vol).connect(out);
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

  /* ------------------------------------------------------------ recorded clips (see clips.js) */
  const clips = {};
  function loadClips() {
    if (!L.CLIPS) return;
    Object.entries(L.CLIPS).forEach(([k, url]) => {
      const bin = atob(url.slice(url.indexOf(',') + 1)), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      ctx.decodeAudioData(arr.buffer).then(b => { clips[k] = b; }).catch(() => {});
    });
  }
  /** Play a recorded clip, positioned in the room (or straight to the listener); returns its length. */
  function clip(name, pos, vol = 1) {
    const b = clips[name]; if (!ctx || muted || !b) return 0;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = vol;
    s.connect(g).connect(pos ? panner(pos, 3, .25) : flatOut); s.start();
    return b.duration;
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
    if (spots.tables.length) { every('clink', .9, 2.4, () => FX.clink(table())); every('chair', 8, 18, () => FX.chair(table())); }
    if (spots.ladle) every('ladle', 7, 14, () => FX.ladle(spots.ladle));
    if (spots.till) every('till', 14, 28, () => FX.till(spots.till));
    if (spots.rack) every('tray', 16, 34, () => FX.tray(spots.rack));
    if (spots.outside.length) every('koel', 30, 60, () => { const [x, y, z] = pick(spots.outside); FX.koel([x + rnd(-8, 8), y, z]); });
    every('thunder', 80, 160, FX.thunder);
  }

  return {
    get ctx() { return ctx; },
    get muted() { return muted; },
    spots, start, listen, tick, sing, clip,
    hasClip: name => !!clips[name], clipLength: name => clips[name] ? clips[name].duration : 0,
    play(name, pos, ...a) { if (ctx && !muted && ctx.state === 'running' && FX[name]) FX[name](pos, ...a); },
    toggle() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : .85, ctx.currentTime, .05); return muted; },
    /** Quieter crowd while talking to someone or reading the scanner. */
    duck(on) { if (ctx) loops.forEach(g => g.gain.setTargetAtTime(on ? .14 : .3, ctx.currentTime, .4)); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    close() { if (ctx) ctx.close(); ctx = null; },
  };
};
})();
