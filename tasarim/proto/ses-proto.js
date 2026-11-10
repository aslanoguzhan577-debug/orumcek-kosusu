// tasarim/proto/ses-proto.js — reference implementation of tasarim/11-1-ses-muzik.md.
// Listening + offline measuring only; NOT game code. The worker ports these numbers and
// recipes into src/audio-logic.js and src/music.js exactly as the design file says.

export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- pure logic (-> audio-logic.js)
export const COIN_MIDI = [81, 84, 86, 88, 91, 93, 96, 98];        // A5 C6 D6 E6 G6 A6 C7 D7
export const COIN_COMP = [1.00, 0.95, 0.90, 0.86, 0.81, 0.77, 0.73, 0.70];
export const COIN_RESET = 0.6;     // s without any coin -> back to step 0
export const COIN_GAP = 1 / 12;    // s between two coin sounds (12 / s)
export function coinNext(st, now) {
  if (now - st.lastCoin > COIN_RESET) st.streak = 0;
  st.lastCoin = now;
  if (now - st.lastPlay < COIN_GAP - 1e-4) return -1;
  st.lastPlay = now;
  const i = st.streak < 8 ? st.streak : 4 + ((st.streak - 8) % 4);
  st.streak++;
  return i;
}
export const TIER_SPEEDS = [13.5, 17, 22, 32];
export const tierFor = (s) => TIER_SPEEDS.filter((v) => s >= v).length;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const bpmFor = (s) => Math.round((112 + 10 * clamp01((s - 11) / 15) + 6 * clamp01((s - 26) / 13)) * 2) / 2;

export class VoicePool {
  constructor(max, reserve) { this.max = max; this.reserve = reserve; this.used = 0; }
  claim(prio, cost) {
    if (this.used + cost > this.max - this.reserve[prio]) return false;
    this.used += cost; return true;
  }
  release(cost) { this.used = Math.max(0, this.used - cost); }
}

// ---------------------------------------------------------------- song data
export const CH = {
  Am: { root: 45, tones: [57, 60, 64] }, F: { root: 41, tones: [57, 60, 65] },
  C: { root: 48, tones: [55, 60, 64] }, G: { root: 43, tones: [55, 59, 62] },
  Em: { root: 40, tones: [55, 59, 64] },
  Fmaj7: { root: 41, tones: [53, 57, 60, 64] }, Em7: { root: 40, tones: [52, 55, 59, 62] },
  Dm7: { root: 38, tones: [50, 53, 57, 60] }, Am7: { root: 45, tones: [55, 57, 60, 64] },
};
export const RUN_BARS = ['Am', 'F', 'C', 'G', 'F', 'G', 'Em', 'Am'];
export const MENU_BARS = ['Fmaj7', 'Em7', 'Dm7', 'Am7', 'Fmaj7', 'Em7', 'Dm7', 'Am7'];
export const KICK_A = [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0];
export const KICK_B = [1,0,0,0, 0,0,0,0.6, 1,0,0.7,0, 0,0,0,0];
export const SNARE  = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0.25];
export const FILL   = [0.45, 0.6, 0.75, 0.95];                    // snare, steps 12..15 of bar 8
export const HAT_A  = [0.45,0,0.8,0, 0.45,0,0.8,0, 0.45,0,0.8,0, 0.45,0,0.8,0];
export const HAT_B  = [0.7,0.3,0.9,0.3, 0.7,0.3,0.9,0.3, 0.7,0.3,0.9,0.3, 0.7,0.3,0,0.3];
export const OPEN_B_STEP = 14;
// [step, semitone offset from chord root, length in steps, velocity]
export const BASS_A = [[0,0,2,1],[3,0,1,0.7],[6,12,1,0.8],[8,0,2,1],[11,0,1,0.7],[14,7,2,0.8]];
export const BASS_B = [[0,0,2,1],[3,0,1,0.7],[4,12,1,0.8],[6,0,1,0.7],[8,0,2,1],[10,12,1,0.8],[11,0,1,0.7],[13,7,1,0.75],[14,12,2,0.85]];
export const STABS = [[2,1,0.9],[6,1,0.7],[10,1,0.9],[13,2,0.8]];  // [step, len, vel]
export const ARP_ORDER = [0,1,2,3,2,1,0,1, 2,3,2,1,0,1,2,3];        // into [t0+12, t1+12, t2+12, t0+24]
// lead: per bar [step, midi, len]
export const LEAD = [
  [[0,76,2],[3,81,1],[4,79,2],[6,76,2],[10,74,1],[11,76,3]],
  [[0,72,2],[3,77,1],[4,76,2],[6,72,2],[8,69,2],[11,72,1],[12,74,4]],
  [[0,76,2],[3,79,1],[4,84,2],[6,83,1],[7,79,1],[8,76,4],[12,79,2],[14,81,2]],
  [[0,79,3],[3,74,1],[4,74,2],[6,71,2],[8,74,6],[14,76,1],[15,79,1]],
  [[0,81,2],[3,84,1],[4,81,2],[6,77,2],[8,76,2],[10,77,1],[11,76,1],[12,72,4]],
  [[0,74,2],[3,79,1],[4,83,2],[6,79,2],[8,86,4],[12,84,2],[14,83,2]],
  [[0,83,2],[3,79,1],[4,76,2],[6,71,2],[8,74,2],[10,76,2],[12,79,2],[14,83,2]],
  [[0,81,6],[8,76,2],[11,79,1],[12,81,4]],
];
export const M_KICK = [1,0,0,0, 0,0,0,0, 0,0,0.7,0, 0,0,0,0];
export const M_RIM  = [0,0,0,0, 0.8,0,0,0, 0,0,0,0, 0.8,0,0,0];
export const M_HAT  = [0.35,0,0.2,0, 0.35,0,0.2,0, 0.35,0,0.2,0, 0.35,0,0.2,0.15];
export const M_BASS = [[0,0,6,0.9],[10,7,2,0.7],[14,12,2,0.6]];
export const BOX = [
  [[0,81,3],[3,79,1],[4,76,4],[10,72,2],[12,74,4]],
  [[0,79,6],[8,74,2],[10,76,2],[12,71,4]],
  [[0,77,3],[3,76,1],[4,72,4],[10,69,2],[12,72,4]],
  [[0,76,8],[12,74,2],[14,72,2]],
  [[0,69,2],[2,72,2],[4,77,2],[6,76,2],[8,72,8]],
  [[0,71,2],[2,74,2],[4,79,4],[10,76,2],[12,74,4]],
  [[0,72,2],[2,74,2],[4,77,2],[6,81,2],[8,79,4],[12,77,4]],
  [[0,76,12]],
];
const byStep = (list) => { const a = new Array(16).fill(null); for (const n of list) a[n[0]] = n; return a; };
const LEAD_S = LEAD.map(byStep), BOX_S = BOX.map(byStep);
const BASS_A_S = byStep(BASS_A), BASS_B_S = byStep(BASS_B), M_BASS_S = byStep(M_BASS), STABS_S = byStep(STABS);

// ---------------------------------------------------------------- engine
export const MUSIC_VOL = 0.14;
export const STINGER_GAIN = 2.2;   // stingers sit ~7 dB above the music bed
export const SCENE_GAIN = { menu: 1.6, run: 1.0 };
export const SFX_VOL = 0.55;
export const LAYER_GAIN = { drums: 1.0, bass: 0.9, chords: 0.8, lead: 0.85, arp: 0.6, tension: 1.0, crackle: 1.0 };

function satCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
function comp(ctx, th, knee, ratio, att, rel) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = th; c.knee.value = knee; c.ratio.value = ratio; c.attack.value = att; c.release.value = rel;
  return c;
}
function gainNode(ctx, v, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function filt(ctx, type, f, q, to) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }

export function makeEngine(ctx, { band = null } = {}) {   // band: [hp, lp] Hz measuring filter
  let sink = ctx.destination;
  if (band) { const lo = filt(ctx, 'lowpass', band[1], 0.707, sink); sink = filt(ctx, 'highpass', band[0], 0.707, lo); }
  const out = gainNode(ctx, 0.9, sink);
  const lim = comp(ctx, -4, 0, 20, 0.001, 0.08); lim.connect(out);
  const sfx = gainNode(ctx, SFX_VOL);
  const sfxComp = comp(ctx, -16, 8, 12, 0.003, 0.2); sfx.connect(sfxComp); sfxComp.connect(lim);
  const coinIn = gainNode(ctx, 1, filt(ctx, 'lowpass', 5200, 0.5, sfx));
  const music = gainNode(ctx, MUSIC_VOL, lim);
  const duck = gainNode(ctx, 1, music);
  const fade = gainNode(ctx, 1, duck);
  const lp = filt(ctx, 'lowpass', 16000, 0.7, fade);
  const stinger = gainNode(ctx, STINGER_GAIN, music);
  // echo (dotted 8th): echoIn -> delay -> echoLP -> lp, echoLP -> fb -> delay
  const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.75 * 60 / 112;
  const echoIn = gainNode(ctx, 0.22, delay);
  const echoLP = filt(ctx, 'lowpass', 2600, 0.7, lp); delay.connect(echoLP);
  const fb = gainNode(ctx, 0.28, delay); echoLP.connect(fb);
  const L = {};
  for (const k of Object.keys(LAYER_GAIN)) L[k] = gainNode(ctx, LAYER_GAIN[k], lp);
  // drums and bass get a soft-clip so phones hear harmonics; their layer gain feeds it
  const dSat = ctx.createWaveShaper(); dSat.curve = satCurve(1.6); dSat.oversample = '2x'; dSat.connect(lp);
  L.drums.disconnect(); L.drums.connect(dSat);
  const bSat = ctx.createWaveShaper(); bSat.curve = satCurve(1.8); bSat.oversample = '2x';
  bSat.connect(filt(ctx, 'lowpass', 3200, 0.7, lp));
  L.bass.disconnect(); L.bass.connect(bSat);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const cd = crackleBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * 0.004;
  for (let k = 0; k < 66; k++) {                       // ~22 clicks per second
    const p = Math.floor(Math.random() * (cd.length - 3)), a = (0.2 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1);
    const w = 1 + Math.floor(Math.random() * 3); for (let j = 0; j < w; j++) cd[p + j] += a * (1 - j / w);
  }
  return {
    ctx, noise, crackleBuf, g: { out, lim, sfx, coinIn, music, duck, fade, lp, stinger, delay, echoIn, L },
    pool: new VoicePool(44, [0, 4, 8, 12, 16]),
  };
}

// crackle: one looping source while the menu theme plays (bandpassed vinyl clicks)
export function crackleStart(E, t) {
  const s = E.ctx.createBufferSource(); s.buffer = E.crackleBuf; s.loop = true;
  const hp = E.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000; hp.Q.value = 0.7;
  const g = E.ctx.createGain(); g.gain.value = 0.09;
  s.connect(hp); hp.connect(g); g.connect(E.g.L.crackle); s.start(t);
  return () => { try { s.stop(); } catch (e) { /* */ } s.disconnect(); hp.disconnect(); g.disconnect(); };
}

// ---------------------------------------------------------------- voice helpers
function voice(E, prio, cost, build) {
  if (!E.pool.claim(prio, cost)) return false;
  const nodes = [];
  if (E.vtrace) E._cur = [];
  const srcs = build(nodes);
  if (E.vtrace) E.vtrace.push([prio, cost, Math.min(...E._cur.map((x) => x[0])), Math.max(...E._cur.map((x) => x[1]))]);
  let left = srcs.length;
  for (const s of srcs) s.onended = () => {
    if (--left) return;
    for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } }
    E.pool.release(cost);
  };
  return true;
}
function osc(E, nodes, type, f, t, end) {
  const o = E.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  o.start(t); o.stop(end); nodes.push(o); if (E.trace) E.trace.push([t, end]); if (E._cur) E._cur.push([t, end]); return o;
}
function noiseSrc(E, nodes, t, end) {
  const s = E.ctx.createBufferSource(); s.buffer = E.noise;
  s.start(t, Math.random() * 0.9); s.stop(end); nodes.push(s); if (E.trace) E.trace.push([t, end]); if (E._cur) E._cur.push([t, end]); return s;
}
function amp(E, nodes, ...dest) { const g = E.ctx.createGain(); g.gain.value = 0; for (const d of dest) g.connect(d); nodes.push(g); return g; }
function bq(E, nodes, type, f, q) { const b = E.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; nodes.push(b); return b; }
function perc(p, t, peak, att, tau) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att); p.setTargetAtTime(0, t + att, tau); }
function adsr(p, t, peak, att, sus, dTau, tOff, rTau) {
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att);
  p.setTargetAtTime(peak * sus, t + att, dTau); p.setTargetAtTime(0, tOff, rTau);
}

// ---------------------------------------------------------------- instruments (music)
export const I = {
  kick(E, t, v, dest, prio = 0) {
    voice(E, prio, 2, (n) => {
      const g1 = amp(E, n, dest), o1 = osc(E, n, 'sine', 150, t, t + 0.3);
      o1.frequency.exponentialRampToValueAtTime(48, t + 0.1); o1.connect(g1); perc(g1.gain, t, 0.55 * v, 0.002, 0.07);
      const g2 = amp(E, n, dest), o2 = osc(E, n, 'triangle', 220, t, t + 0.12);
      o2.frequency.exponentialRampToValueAtTime(110, t + 0.03); o2.connect(g2); perc(g2.gain, t, 0.35 * v, 0.001, 0.018);
      return [o1, o2];
    });
  },
  snare(E, t, v, dest, prio = 0) {
    voice(E, prio, 2, (n) => {
      const g1 = amp(E, n, dest), bp = bq(E, n, 'bandpass', 1900, 0.9); bp.connect(g1);
      const s = noiseSrc(E, n, t, t + 0.3); s.connect(bp); perc(g1.gain, t, 0.42 * v, 0.001, 0.055);
      const g2 = amp(E, n, dest), o = osc(E, n, 'triangle', 210, t, t + 0.2);
      o.frequency.exponentialRampToValueAtTime(165, t + 0.06); o.connect(g2); perc(g2.gain, t, 0.28 * v, 0.001, 0.04);
      return [s, o];
    });
  },
  rim(E, t, v, dest) {
    voice(E, 0, 2, (n) => {
      const g1 = amp(E, n, dest), bp = bq(E, n, 'bandpass', 2600, 3); bp.connect(g1);
      const s = noiseSrc(E, n, t, t + 0.1); s.connect(bp); perc(g1.gain, t, 0.16 * v, 0.001, 0.012);
      const g2 = amp(E, n, dest), o = osc(E, n, 'triangle', 420, t, t + 0.12); o.connect(g2); perc(g2.gain, t, 0.12 * v, 0.001, 0.02);
      return [s, o];
    });
  },
  hat(E, t, v, dest, open = false) {
    voice(E, 3, 1, (n) => {
      const g = amp(E, n, dest), hp = bq(E, n, 'highpass', 7000, 0.7); hp.connect(g);
      const s = noiseSrc(E, n, t, t + (open ? 0.4 : 0.08)); s.connect(hp);
      perc(g.gain, t, (open ? 0.08 : 0.1) * v, 0.001, open ? 0.07 : 0.012);
      return [s];
    });
  },
  crash(E, t, v, dest) {
    voice(E, 0, 1, (n) => {
      const g = amp(E, n, dest), hp = bq(E, n, 'highpass', 4500, 0.5); hp.connect(g);
      const s = noiseSrc(E, n, t, t + 1.6); s.connect(hp); perc(g.gain, t, 0.11 * v, 0.002, 0.45);
      return [s];
    });
  },
  riser(E, t, dur, dest) {
    voice(E, 3, 1, (n) => {
      const g = amp(E, n, dest), bp = bq(E, n, 'bandpass', 700, 2.5); bp.connect(g);
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(5500, t + dur);
      const s = noiseSrc(E, n, t, t + dur + 0.05); s.connect(bp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      return [s];
    });
  },
  bass(E, t, m, dur, v, dest, soft = false) {
    voice(E, 1, soft ? 2 : 3, (n) => {
      const f = hz(m), off = t + dur, end = off + 0.15;
      const g = amp(E, n, dest), lp = bq(E, n, 'lowpass', 1000, soft ? 1 : 3.5); lp.connect(g);
      lp.frequency.setValueAtTime(Math.min(f * (soft ? 6 : 14), 1800), t);
      lp.frequency.setTargetAtTime(Math.max(f * (soft ? 3.5 : 5), soft ? 300 : 420), t + 0.005, 0.09);
      const o1 = osc(E, n, 'sawtooth', f, t, end); o1.connect(lp);
      adsr(g.gain, t, (soft ? 0.22 : 0.3) * v, 0.004, 0.65, 0.12, off, 0.03);
      const srcs = [o1];
      if (!soft) {
        const o2 = osc(E, n, 'square', f, t, end); o2.detune.value = 6;
        const g2 = E.ctx.createGain(); g2.gain.value = 0.45; n.push(g2); o2.connect(g2); g2.connect(lp); srcs.push(o2);
      }
      const gs = amp(E, n, dest), sub = osc(E, n, 'sine', f, t, end); sub.connect(gs);
      adsr(gs.gain, t, 0.18 * v, 0.004, 0.65, 0.12, off, 0.03); srcs.push(sub);
      return srcs;
    });
  },
  lead(E, t, m, dur, v, dest, sparkle = false, prio = 2) {
    voice(E, prio, 2, (n) => {
      const f = hz(m), off = t + dur, end = off + 0.3;
      const g = amp(E, n, dest, E.g.echoIn), lp = bq(E, n, 'lowpass', 3400, 1.0); lp.connect(g);
      lp.frequency.setValueAtTime(3400, t); lp.frequency.setTargetAtTime(1900, t, 0.15);
      const a = osc(E, n, 'sawtooth', f, t, end), b = osc(E, n, 'sawtooth', f, t, end);
      a.detune.value = -7; b.detune.value = 7; a.connect(lp); b.connect(lp);
      adsr(g.gain, t, 0.13 * v, 0.008, 0.6, 0.18, off, 0.06);
      const srcs = [a, b];
      if (dur >= 0.35) {
        const lfo = osc(E, n, 'sine', 5.5, t, end), lg = E.ctx.createGain(); n.push(lg);
        lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.18); lg.gain.linearRampToValueAtTime(f * 0.0045, t + 0.3);
        lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); srcs.push(lfo);
      }
      if (sparkle) {
        const sg = E.ctx.createGain(); sg.gain.value = 0.25; n.push(sg); sg.connect(g);
        const s = osc(E, n, 'sine', f * 2, t, end); s.connect(sg); srcs.push(s);
      }
      return srcs;
    });
  },
  stab(E, t, m, v, dest, prio = 3) {
    voice(E, prio, 1, (n) => {
      const f = hz(m), g = amp(E, n, dest, E.g.echoIn), lp = bq(E, n, 'lowpass', 3200, 2); lp.connect(g);
      lp.frequency.setValueAtTime(3200, t); lp.frequency.setTargetAtTime(650, t, 0.05);
      const o = osc(E, n, 'sawtooth', f, t, t + 0.4); o.connect(lp); perc(g.gain, t, 0.07 * v, 0.003, 0.08);
      return [o];
    });
  },
  arp(E, t, m, v, dest) {
    voice(E, 3, 1, (n) => {
      const g = amp(E, n, dest), o = osc(E, n, 'triangle', hz(m), t, t + 0.3); o.connect(g);
      perc(g.gain, t, 0.06 * v, 0.002, 0.06); return [o];
    });
  },
  ep(E, t, m, dur, v, dest, prio = 3) {
    voice(E, prio, 2, (n) => {
      const f = hz(m), off = t + dur, end = off + 0.8;
      const c = osc(E, n, 'sine', f, t, end), mo = osc(E, n, 'sine', f, t, end), mg = E.ctx.createGain(); n.push(mg);
      mg.gain.setValueAtTime(f * 1.8, t); mg.gain.setTargetAtTime(f * 0.3, t, 0.25); mo.connect(mg); mg.connect(c.frequency);
      const g = amp(E, n, dest); c.connect(g); adsr(g.gain, t, 0.075 * v, 0.006, 0, 1.2, off, 0.25);
      return [c, mo];
    });
  },
  box(E, t, m, v, dest, prio = 3) {
    voice(E, prio, 2, (n) => {
      const f = hz(m), g = amp(E, n, dest), o = osc(E, n, 'sine', f, t, t + 1.6); o.connect(g); perc(g.gain, t, 0.085 * v, 0.002, 0.32);
      const g2 = amp(E, n, dest), o2 = osc(E, n, 'sine', f * 2, t, t + 0.8); o2.connect(g2); perc(g2.gain, t, 0.085 * 0.22 * v, 0.002, 0.12);
      return [o, o2];
    });
  },
  bell(E, t, m, v, dest) {
    voice(E, 0, 2, (n) => {
      const f = hz(m), c = osc(E, n, 'sine', f, t, t + 2.0), mo = osc(E, n, 'sine', f * 3.5, t, t + 2.0), mg = E.ctx.createGain(); n.push(mg);
      mg.gain.setValueAtTime(f * 1.2, t); mg.gain.setTargetAtTime(0, t, 0.08); mo.connect(mg); mg.connect(c.frequency);
      const g = amp(E, n, dest); c.connect(g); perc(g.gain, t, 0.12 * v, 0.002, 0.35);
      return [c, mo];
    });
  },
  drone(E, t, dur, dest) {
    voice(E, 3, 2, (n) => {
      const end = t + dur + 0.3, g = amp(E, n, dest), lp = bq(E, n, 'lowpass', 380, 5); lp.connect(g);
      lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(950, t + dur / 2); lp.frequency.linearRampToValueAtTime(380, t + dur);
      const a = osc(E, n, 'sawtooth', hz(45), t, end), b = osc(E, n, 'sawtooth', hz(46), t, end); a.connect(lp); b.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.075, t + 0.15); g.gain.setValueAtTime(0.075, t + dur - 0.05);
      g.gain.setTargetAtTime(0, t + dur - 0.05, 0.08);
      return [a, b];
    });
  },
  heart(E, t, v, dest) {
    voice(E, 1, 2, (n) => {
      const g1 = amp(E, n, dest), o1 = osc(E, n, 'sine', 95, t, t + 0.4); o1.frequency.exponentialRampToValueAtTime(52, t + 0.12);
      o1.connect(g1); perc(g1.gain, t, 0.5 * v, 0.003, 0.08);
      const g2 = amp(E, n, dest), o2 = osc(E, n, 'sine', 190, t, t + 0.3); o2.frequency.exponentialRampToValueAtTime(110, t + 0.08);
      o2.connect(g2); perc(g2.gain, t, 0.22 * v, 0.003, 0.05);
      return [o1, o2];
    });
  },
};

// ---------------------------------------------------------------- sfx (coin new/old, jump for level reference)
export const COIN = { peak: 0.12, att: 0.004, tau: 0.03, stop: 0.14, scoop: 0.985, scoopT: 0.01, oct: 0.18, octAtt: 0.002, octTau: 0.016, octStop: 0.08 };
export function coinNew(E, t, step) {
  const f = hz(COIN_MIDI[step]), P = COIN.peak * COIN_COMP[step], ctx = E.ctx, nodes = [];
  const o1 = ctx.createOscillator(); o1.type = 'sine';
  o1.frequency.setValueAtTime(f * COIN.scoop, t); o1.frequency.linearRampToValueAtTime(f, t + COIN.scoopT);
  const g1 = ctx.createGain(); g1.gain.value = 0; perc(g1.gain, t, P, COIN.att, COIN.tau);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t);
  const g2 = ctx.createGain(); g2.gain.value = 0; perc(g2.gain, t, P * COIN.oct, COIN.octAtt, COIN.octTau);
  o1.connect(g1); g1.connect(E.g.coinIn); o2.connect(g2); g2.connect(E.g.coinIn);
  nodes.push(o1, g1, o2, g2);
  o1.start(t); o1.stop(t + COIN.stop); o2.start(t); o2.stop(t + COIN.octStop);
  o1.onended = () => { for (const n of nodes) try { n.disconnect(); } catch (e) { /* */ } };
}
function oldTone(E, o) {   // src/audio.js tone(), without tremolo/filter (coin and jump need none)
  const ctx = E.ctx, t = o.t + (o.at || 0), dur = o.dur, osc1 = ctx.createOscillator(); osc1.type = o.type;
  osc1.frequency.setValueAtTime(o.f, t); if (o.to) osc1.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const g = ctx.createGain(); const p = g.gain; const a = o.attack || 0.005;
  p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(o.vol, t + a); p.exponentialRampToValueAtTime(0.0001, t + dur);
  osc1.connect(g); g.connect(E.g.sfx); osc1.start(t); osc1.stop(t + dur + 0.03);
}
export function coinOld(E, t, combo) {
  const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const f = 988 * Math.pow(2, steps[Math.min(combo, steps.length - 1)] / 12);
  oldTone(E, { t, type: 'square', f, dur: 0.07, vol: 0.1, attack: 0.002 });
  oldTone(E, { t, type: 'sine', f: f * 1.5, dur: 0.26, vol: 0.22, at: 0.055, attack: 0.002 });
  oldTone(E, { t, type: 'sine', f: f * 3, dur: 0.12, vol: 0.05, at: 0.055 });
}
export function jump(E, t) {
  oldTone(E, { t, type: 'triangle', f: 260, to: 640, dur: 0.16, vol: 0.28 });
  oldTone(E, { t, type: 'sine', f: 520, to: 1100, dur: 0.1, vol: 0.08, at: 0.02 });
}

// ---------------------------------------------------------------- songs + sequencer
export class Seq {
  constructor(song) { this.song = song; this.bar = 0; this.step = 0; this.next = 0; this.bpm = song.bpm(); this.sd = 15 / this.bpm; }
  start(t) { this.next = t; this.bar = 0; this.step = 0; }
  run(until) {
    while (this.next < until) {
      if (this.step === 0) { this.bpm = this.song.bpm(); this.sd = 15 / this.bpm; }
      const sw = this.step % 2 ? (this.song.swing - 0.5) * 2 * this.sd : 0;
      this.song.play(this, this.bar, this.step, this.next + sw);
      this.next += this.sd;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  }
}

export function menuSong(E) {
  const L = E.g.L;
  return {
    swing: 0.58, bpm: () => 84,
    play(q, bar, s, t) {
      const b8 = bar % 8, ch = CH[MENU_BARS[b8]], sd = q.sd;
      if (bar >= 4) {
        if (M_KICK[s]) I.kick(E, t, M_KICK[s] * 0.7, L.drums);
        if (M_RIM[s]) I.rim(E, t, M_RIM[s], L.drums);
        if (M_HAT[s]) I.hat(E, t, M_HAT[s], L.drums);
      }
      const b = M_BASS_S[s]; if (b) I.bass(E, t, ch.root + b[1], b[2] * sd, b[3], L.bass, true);
      if (s === 0) ch.tones.forEach((m, i) => I.ep(E, t + i * 0.018, m, 15 * sd, 0.8, L.chords));
      const n = BOX_S[b8][s]; if (n) I.box(E, t, n[1], 1, L.lead);
    },
  };
}

export function runSong(E, state) {   // state: { speed, tension }
  const L = E.g.L;
  const song = {
    swing: 0.5, bpm: () => bpmFor(state.speed), tier: tierFor(state.speed), pickupAt: -1,
    play(q, bar, s, t) {
      const b8 = bar % 8, ch = CH[RUN_BARS[b8]], sd = q.sd, want = tierFor(state.speed);
      if (s === 0) E.g.delay.delayTime.setTargetAtTime(0.75 * 60 / q.bpm, t, 0.05);
      if (want > song.tier && bar % 4 === 3 && s === 12) I.riser(E, t, 4 * sd, L.drums);
      if (want > song.tier && bar % 4 === 0 && s === 0) { song.tier = want; I.crash(E, t, 1, L.drums); }
      const T = song.tier;
      if (T >= 4 && b8 === 0 && s === 0 && bar > 0) I.crash(E, t, 0.8, L.drums);
      const fill = T >= 1 && b8 === 7 && s >= 12;
      const K = T >= 3 ? KICK_B : KICK_A;
      if (K[s]) I.kick(E, t, K[s], L.drums);
      if (fill) I.snare(E, t, FILL[s - 12], L.drums); else if (SNARE[s]) I.snare(E, t, SNARE[s], L.drums);
      const H = T >= 3 ? HAT_B : HAT_A;
      if (!fill && H[s]) I.hat(E, t, H[s], L.drums);
      if (!fill && T >= 3 && s === OPEN_B_STEP) I.hat(E, t, 0.7, L.drums, true);
      const b = (T >= 3 ? BASS_B_S : BASS_A_S)[s]; if (b) I.bass(E, t, ch.root + b[1], b[2] * sd, b[3], L.bass);
      if (T >= 1) { const st = STABS_S[s]; if (st) for (const m of ch.tones) I.stab(E, t, m, st[2], L.chords); }
      if (T >= 2) { const n = LEAD_S[b8][s]; if (n) I.lead(E, t, n[1], n[2] * sd, 1, L.lead, T >= 4); }
      if (T >= 4) {
        const tones = [ch.tones[0] + 12, ch.tones[1] + 12, ch.tones[2] + 12, ch.tones[0] + 24];
        I.arp(E, t, tones[ARP_ORDER[s]], s % 4 === 0 ? 0.9 : 0.6, L.arp);
      }
      if (state.tension) {
        if (s === 0) I.drone(E, t, 16 * sd, L.tension);
        if (s === 0 || s === 8) I.heart(E, t, 1, L.tension);
        if (s === 3 || s === 11) I.heart(E, t, 0.65, L.tension);
      }
      if (song.pickupAt >= 0 && s % 2 === 0 && t >= song.pickupAt) {
        song.pickupAt = -1;
        I.crash(E, t, 0.8, E.g.stinger); I.kick(E, t, 0.8, E.g.stinger);
        for (const m of ch.tones) I.stab(E, t, m + 12, 1, E.g.stinger, 0);
        E.g.duck.gain.setTargetAtTime(1, t, 0.15);
      }
    },
  };
  return song;
}

export function setTension(E, on, t) {
  const L = E.g.L;
  L.tension.gain.setTargetAtTime(on ? LAYER_GAIN.tension : 0, t, on ? 0.17 : 0.6);
  L.lead.gain.setTargetAtTime(LAYER_GAIN.lead * (on ? 0.5 : 1), t, 0.2);
  L.chords.gain.setTargetAtTime(LAYER_GAIN.chords * (on ? 0.7 : 1), t, 0.2);
}

// ---------------------------------------------------------------- stingers (absolute time)
export const ST = {
  pickup(E, song, now) { song.pickupAt = now + 0.30; E.g.duck.gain.setTargetAtTime(0.6, now, 0.01); },
  missionDone(E, t) { [[0, 84], [0.08, 88], [0.16, 91], [0.24, 96]].forEach(([d, m]) => I.bell(E, t + d, m, d === 0.24 ? 1.1 : 0.9, E.g.stinger)); },
  missionSet(E, t) {
    ST.missionDone(E, t);
    I.crash(E, t + 0.36, 1, E.g.stinger); I.bass(E, t + 0.36, 48, 0.4, 1, E.g.stinger);
    for (const m of [60, 64, 67, 72]) I.lead(E, t + 0.36, m, 0.45, 0.8, E.g.stinger, false, 0);
  },
  record(E, t) {
    const S = E.g.stinger;
    [[0, 69, 0.16], [0.167, 72, 0.16], [0.333, 76, 0.16], [0.5, 81, 0.45], [1.0, 79, 0.22], [1.25, 81, 0.22], [1.5, 84, 0.45], [2.0, 85, 1.6]]
      .forEach(([d, m, len]) => I.lead(E, t + d, m, len, 1, S, true, 0));
    [[0.5, [57, 60, 64]], [1.0, [55, 59, 62]], [1.5, [57, 60, 65]], [2.0, [57, 61, 64]]]
      .forEach(([d, c]) => c.forEach((m) => I.stab(E, t + d, m, 1, S, 0)));
    [57, 61, 64].forEach((m, i) => I.ep(E, t + 2.0 + i * 0.018, m, 1.6, 0.9, S, 0));
    [0.5, 1.0, 1.5, 2.0].forEach((d) => I.kick(E, t + d, 1, S));
    I.snare(E, t + 2.0, 1, S); I.crash(E, t + 0.5, 1, S); I.crash(E, t + 2.0, 1, S);
    [[0.5, 45, 0.4], [1.0, 43, 0.4], [1.5, 41, 0.4], [2.0, 45, 1.2]].forEach(([d, m, len]) => I.bass(E, t + d, m, len, 1, S));
    I.bell(E, t + 2.0, 93, 0.8, S); I.bell(E, t + 2.0, 88, 0.8, S);
  },
  closing(E, t) {
    const S = E.g.stinger;
    [[0, [53, 57, 60, 64], 1.4], [1.43, [52, 57, 59, 62], 0.7], [2.14, [52, 56, 59, 62], 0.7], [2.86, [57, 60, 64, 71], 3.0]]
      .forEach(([d, c, len]) => c.forEach((m, i) => I.ep(E, t + d + i * 0.018, m, len, 0.85, S, 0)));
    [[0, 76], [0.357, 74], [0.714, 72], [1.43, 71], [2.14, 68], [2.86, 69]].forEach(([d, m]) => I.box(E, t + d, m, 1, S, 0));
    I.box(E, t + 2.86, 81, 0.5, S, 0);
    [[0, 41, 1.3], [1.43, 40, 1.3], [2.86, 45, 2.5]].forEach(([d, m, len]) => I.bass(E, t + d, m, len, 0.9, S, true));
  },
};
