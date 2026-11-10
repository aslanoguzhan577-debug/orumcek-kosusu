import {
  VoicePool, musicPoolMax, shouldDuck, hz, musicScene, resyncTime, stingerReady, tierFor, bpmFor, layersFor,
  CH, MENU_BARS, M_KICK, M_RIM, M_HAT, M_BASS, BOX,
  RUN_BARS, KICK_A, KICK_B, SNARE, FILL, HAT_A, HAT_B, OPEN_B_STEP, BASS_A, BASS_B, STABS, ARP_ORDER, LEAD,
} from './audio-logic.js';
import { events } from './events.js';
import { game } from './game.js';

let E = null, ctx = null, isUnlocked = () => false;
let musicOn = true, scene = 'none', song = null, seq = null;
let duckLevel = 1, duckUntil = 0;
let crackleVoices = 0;
let stopCrackle = null, tension = false, overMenu = false, overT = 0;
let lastPickupAt = -10, missionTimer = 0, overTimer = 0;
const pendingVoices = [];
const LOOKAHEAD = 0.12, TICK_MS = 25;
const byStep = (list) => { const a = new Array(16).fill(null); for (const n of list) a[n[0]] = n; return a; };
const BOX_S = BOX.map(byStep), M_BASS_S = byStep(M_BASS);
const LEAD_S = LEAD.map(byStep), BASS_A_S = byStep(BASS_A), BASS_B_S = byStep(BASS_B), STABS_S = byStep(STABS);
const ARP_TONES = RUN_BARS.map((c) => { const a = CH[c].tones; return [a[0] + 12, a[1] + 12, a[2] + 12, a[0] + 24]; });
const LOW_END = (navigator.hardwareConcurrency || 8) <= 4;
const MUSIC_VOL = 0.14;
const STINGER_GAIN = 2.2;   // stingers sit ~7 dB above the music bed
const SCENE_GAIN = { menu: 1.6, run: 1.0 };
const LAYER_GAIN = { drums: 1.0, bass: 0.9, chords: 0.8, lead: 0.85, arp: 0.6, tension: 1.0, crackle: 1.0 };

function satCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
function gainNode(ctx, v, to) { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
function filt(ctx, type, f, q, to) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; }

export function initMusic(context, dest, noiseBuf, unlocked) {
  if (E) return;
  ctx = context; isUnlocked = unlocked;
  const music = gainNode(ctx, musicOn ? MUSIC_VOL : 0, dest);
  const duck = gainNode(ctx, 1, music);
  const fade = gainNode(ctx, 1, duck);
  const lp = filt(ctx, 'lowpass', 16000, 0.7, fade);
  const stinger = gainNode(ctx, STINGER_GAIN, music);
  function echo(to) {
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.75 * 60 / 112;
    const input = gainNode(ctx, 0.22, delay);
    const lp = filt(ctx, 'lowpass', 2600, 0.7, to); delay.connect(lp);
    lp.connect(gainNode(ctx, 0.28, delay));
    return { input, delay };
  }
  const { input: echoIn, delay } = echo(lp);
  // Stinger tails must survive the song fade on game over.
  const { input: stingerEcho } = echo(stinger);
  const L = {};
  for (const k of Object.keys(LAYER_GAIN)) L[k] = gainNode(ctx, LAYER_GAIN[k], lp);
  // drums and bass get a soft-clip so phones hear harmonics; their layer gain feeds it
  const dSat = ctx.createWaveShaper(); dSat.curve = satCurve(1.6); dSat.oversample = '2x'; dSat.connect(lp);
  L.drums.disconnect(); L.drums.connect(dSat);
  const bSat = ctx.createWaveShaper(); bSat.curve = satCurve(1.8); bSat.oversample = '2x';
  bSat.connect(filt(ctx, 'lowpass', 3200, 0.7, lp));
  L.bass.disconnect(); L.bass.connect(bSat);
  const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const cd = crackleBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * 0.004;
  for (let k = 0; k < 66; k++) {                       // ~22 clicks per second
    const p = Math.floor(Math.random() * (cd.length - 3)), a = (0.2 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1);
    const w = 1 + Math.floor(Math.random() * 3); for (let j = 0; j < w; j++) cd[p + j] += a * (1 - j / w);
  }
  L.tension.gain.value = 0;
  E = { ctx, noise: noiseBuf, crackleBuf, g: { music, duck, fade, lp, stinger, delay, echoIn, stingerEcho, L },
    pool: new VoicePool(musicPoolMax(navigator.hardwareConcurrency || 8), [0, 4, 8, 12, 16]) };
  setInterval(tick, TICK_MS);
}
export function setMusicOn(on) {
  musicOn = !!on;
  if (!E) return;
  E.g.music.gain.setTargetAtTime(musicOn ? MUSIC_VOL : 0, ctx.currentTime, 0.03);
  if (!musicOn) { pendingVoices.length = 0; if (song) song.pickupAt = -1; }
  if (!musicOn && stopCrackle) { stopCrackle(ctx.currentTime + 0.1); stopCrackle = null; }
  if (musicOn && isUnlocked() && ctx.state === 'running' && (scene === 'menu' || (scene === 'over' && overMenu)) && !stopCrackle) stopCrackle = crackleStart(E, ctx.currentTime + 0.05);
}
export function duckMusic(level, hold, relTau = 0.25) {
  if (!E) return;
  const now = ctx.currentTime;
  if (!shouldDuck({ level: duckLevel, until: duckUntil }, now, level)) return;
  duckLevel = level; duckUntil = now + hold;
  const p = E.g.duck.gain;
  p.cancelScheduledValues(now); p.setValueAtTime(p.value, now);
  p.setTargetAtTime(level, now, 0.01); p.setTargetAtTime(1, now + hold, relTau);
}
export function musicStats() {
  return { used: E ? E.pool.used : 0, scene, tier: song ? song.tier || 0 : 0, bpm: seq ? seq.bpm : 0 };
}

// ---------------------------------------------------------------- voice helpers
function voice(E, prio, cost, build, at) {
  // Long stingers claim voices near playback, not all future notes at once.
  if (at > ctx.currentTime + LOOKAHEAD) { pendingVoices.push({ prio, cost, build, at }); return true; }
  if (E.pool.used + cost + crackleVoices > E.pool.max || !E.pool.claim(prio, cost)) return false;
  const nodes = [];
  const srcs = build(nodes);
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
  o.start(t); o.stop(end); nodes.push(o); return o;
}
function noiseSrc(E, nodes, t, end) {
  const s = E.ctx.createBufferSource(); s.buffer = E.noise;
  s.start(t, Math.random() * 0.9); s.stop(end); nodes.push(s); return s;
}
function amp(E, nodes, ...dest) { const g = E.ctx.createGain(); g.gain.value = 0; for (const d of dest) g.connect(d); nodes.push(g); return g; }
function bq(E, nodes, type, f, q) { const b = E.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; nodes.push(b); return b; }
function perc(p, t, peak, att, tau) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att); p.setTargetAtTime(0, t + att, tau); }
function adsr(p, t, peak, att, sus, dTau, tOff, rTau) {
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att);
  p.setTargetAtTime(peak * sus, t + att, dTau); p.setTargetAtTime(0, tOff, rTau);
}

// ---------------------------------------------------------------- instruments (music)
const I = {
  kick(E, t, v, dest, prio = 0) {
    voice(E, prio, 2, (n) => {
      const g1 = amp(E, n, dest), o1 = osc(E, n, 'sine', 150, t, t + 0.3);
      o1.frequency.exponentialRampToValueAtTime(48, t + 0.1); o1.connect(g1); perc(g1.gain, t, 0.55 * v, 0.002, 0.07);
      const g2 = amp(E, n, dest), o2 = osc(E, n, 'triangle', 220, t, t + 0.12);
      o2.frequency.exponentialRampToValueAtTime(110, t + 0.03); o2.connect(g2); perc(g2.gain, t, 0.35 * v, 0.001, 0.018);
      return [o1, o2];
    }, t);
  },
  snare(E, t, v, dest, prio = 0) {
    voice(E, prio, 2, (n) => {
      const g1 = amp(E, n, dest), bp = bq(E, n, 'bandpass', 1900, 0.9); bp.connect(g1);
      const s = noiseSrc(E, n, t, t + 0.3); s.connect(bp); perc(g1.gain, t, 0.42 * v, 0.001, 0.055);
      const g2 = amp(E, n, dest), o = osc(E, n, 'triangle', 210, t, t + 0.2);
      o.frequency.exponentialRampToValueAtTime(165, t + 0.06); o.connect(g2); perc(g2.gain, t, 0.28 * v, 0.001, 0.04);
      return [s, o];
    }, t);
  },
  rim(E, t, v, dest) {
    voice(E, 0, 2, (n) => {
      const g1 = amp(E, n, dest), bp = bq(E, n, 'bandpass', 2600, 3); bp.connect(g1);
      const s = noiseSrc(E, n, t, t + 0.1); s.connect(bp); perc(g1.gain, t, 0.16 * v, 0.001, 0.012);
      const g2 = amp(E, n, dest), o = osc(E, n, 'triangle', 420, t, t + 0.12); o.connect(g2); perc(g2.gain, t, 0.12 * v, 0.001, 0.02);
      return [s, o];
    }, t);
  },
  hat(E, t, v, dest, open = false) {
    voice(E, 3, 1, (n) => {
      const g = amp(E, n, dest), hp = bq(E, n, 'highpass', 7000, 0.7); hp.connect(g);
      const s = noiseSrc(E, n, t, t + (open ? 0.4 : 0.08)); s.connect(hp);
      perc(g.gain, t, (open ? 0.08 : 0.1) * v, 0.001, open ? 0.07 : 0.012);
      return [s];
    }, t);
  },
  crash(E, t, v, dest) {
    voice(E, 0, 1, (n) => {
      const g = amp(E, n, dest), hp = bq(E, n, 'highpass', 4500, 0.5); hp.connect(g);
      const s = noiseSrc(E, n, t, t + 1.6); s.connect(hp); perc(g.gain, t, 0.11 * v, 0.002, 0.45);
      return [s];
    }, t);
  },
  riser(E, t, dur, dest) {
    voice(E, 3, 1, (n) => {
      const g = amp(E, n, dest), bp = bq(E, n, 'bandpass', 700, 2.5); bp.connect(g);
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(5500, t + dur);
      const s = noiseSrc(E, n, t, t + dur + 0.05); s.connect(bp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      return [s];
    }, t);
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
    }, t);
  },
  lead(E, t, m, dur, v, dest, sparkle = false, prio = 2) {
    // Count the vibrato and sparkle sources too so the source cap stays hard.
    voice(E, prio, 2 + (dur >= 0.35 ? 1 : 0) + (sparkle ? 1 : 0), (n) => {
      const f = hz(m), off = t + dur, end = off + 0.3;
      const g = amp(E, n, dest, dest === E.g.stinger ? E.g.stingerEcho : E.g.echoIn), lp = bq(E, n, 'lowpass', 3400, 1.0); lp.connect(g);
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
    }, t);
  },
  stab(E, t, m, v, dest, prio = 3) {
    voice(E, prio, 1, (n) => {
      const f = hz(m), g = amp(E, n, dest, dest === E.g.stinger ? E.g.stingerEcho : E.g.echoIn), lp = bq(E, n, 'lowpass', 3200, 2); lp.connect(g);
      lp.frequency.setValueAtTime(3200, t); lp.frequency.setTargetAtTime(650, t, 0.05);
      const o = osc(E, n, 'sawtooth', f, t, t + 0.4); o.connect(lp); perc(g.gain, t, 0.07 * v, 0.003, 0.08);
      return [o];
    }, t);
  },
  arp(E, t, m, v, dest) {
    voice(E, 3, 1, (n) => {
      const g = amp(E, n, dest), o = osc(E, n, 'triangle', hz(m), t, t + 0.3); o.connect(g);
      perc(g.gain, t, 0.06 * v, 0.002, 0.06); return [o];
    }, t);
  },
  ep(E, t, m, dur, v, dest, prio = 3) {
    voice(E, prio, 2, (n) => {
      const f = hz(m), off = t + dur, end = off + 0.8;
      const c = osc(E, n, 'sine', f, t, end), mo = osc(E, n, 'sine', f, t, end), mg = E.ctx.createGain(); n.push(mg);
      mg.gain.setValueAtTime(f * 1.8, t); mg.gain.setTargetAtTime(f * 0.3, t, 0.25); mo.connect(mg); mg.connect(c.frequency);
      const g = amp(E, n, dest); c.connect(g); adsr(g.gain, t, 0.075 * v, 0.006, 0, 1.2, off, 0.25);
      return [c, mo];
    }, t);
  },
  box(E, t, m, v, dest, prio = 3) {
    voice(E, prio, 2, (n) => {
      const f = hz(m), g = amp(E, n, dest), o = osc(E, n, 'sine', f, t, t + 1.6); o.connect(g); perc(g.gain, t, 0.085 * v, 0.002, 0.32);
      const g2 = amp(E, n, dest), o2 = osc(E, n, 'sine', f * 2, t, t + 0.8); o2.connect(g2); perc(g2.gain, t, 0.085 * 0.22 * v, 0.002, 0.12);
      return [o, o2];
    }, t);
  },
  bell(E, t, m, v, dest) {
    voice(E, 0, 2, (n) => {
      const f = hz(m), c = osc(E, n, 'sine', f, t, t + 2.0), mo = osc(E, n, 'sine', f * 3.5, t, t + 2.0), mg = E.ctx.createGain(); n.push(mg);
      mg.gain.setValueAtTime(f * 1.2, t); mg.gain.setTargetAtTime(0, t, 0.08); mo.connect(mg); mg.connect(c.frequency);
      const g = amp(E, n, dest); c.connect(g); perc(g.gain, t, 0.12 * v, 0.002, 0.35);
      return [c, mo];
    }, t);
  },
  drone(E, t, dur, dest) {
    voice(E, 3, 2, (n) => {
      const end = t + dur + 0.3, g = amp(E, n, dest), lp = bq(E, n, 'lowpass', 380, 5); lp.connect(g);
      lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(950, t + dur / 2); lp.frequency.linearRampToValueAtTime(380, t + dur);
      const a = osc(E, n, 'sawtooth', hz(45), t, end), b = osc(E, n, 'sawtooth', hz(46), t, end); a.connect(lp); b.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.075, t + 0.15); g.gain.setValueAtTime(0.075, t + dur - 0.05);
      g.gain.setTargetAtTime(0, t + dur - 0.05, 0.08);
      return [a, b];
    }, t);
  },
  heart(E, t, v, dest) {
    voice(E, 1, 2, (n) => {
      const g1 = amp(E, n, dest), o1 = osc(E, n, 'sine', 95, t, t + 0.4); o1.frequency.exponentialRampToValueAtTime(52, t + 0.12);
      o1.connect(g1); perc(g1.gain, t, 0.5 * v, 0.003, 0.08);
      const g2 = amp(E, n, dest), o2 = osc(E, n, 'sine', 190, t, t + 0.3); o2.frequency.exponentialRampToValueAtTime(110, t + 0.08);
      o2.connect(g2); perc(g2.gain, t, 0.22 * v, 0.003, 0.05);
      return [o1, o2];
    }, t);
  },
};


// crackle: one looping source while the menu theme plays (bandpassed vinyl clicks)
function crackleStart(E, t) {
  if (E.pool.used + crackleVoices >= E.pool.max) return null;
  crackleVoices++;
  const s = E.ctx.createBufferSource(); s.buffer = E.crackleBuf; s.loop = true;
  const hp = E.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1000; hp.Q.value = 0.7;
  const g = E.ctx.createGain(); g.gain.value = 0.09;
  s.connect(hp); hp.connect(g); g.connect(E.g.L.crackle); s.start(t);
  s.onended = () => { s.disconnect(); hp.disconnect(); g.disconnect(); crackleVoices--; };
  return (at = E.ctx.currentTime) => { try { s.stop(at); } catch (e) { /* gone */ } };
}

class Seq {
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

function menuSong(E) {
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

function startSong(kind, t) {
  E.g.lp.frequency.cancelScheduledValues(t); E.g.lp.frequency.setValueAtTime(16000, t);
  E.g.duck.gain.cancelScheduledValues(t); E.g.duck.gain.setValueAtTime(1, t);
  duckLevel = 1; duckUntil = 0;
  E.g.fade.gain.setValueAtTime(0, t);
  E.g.fade.gain.setTargetAtTime(SCENE_GAIN[kind], t, kind === 'menu' ? 0.8 : 0.01);
  song = kind === 'menu' ? menuSong(E) : runSong(E);
  if (kind === 'menu' && musicOn) stopCrackle = crackleStart(E, t);
  seq = song ? new Seq(song) : null;
  if (seq) seq.start(t);
}
function changeScene(to) {
  const now = ctx.currentTime, from = scene;
  seq = null; song = null;
  pendingVoices.length = 0;
  clearTimeout(missionTimer); missionTimer = 0;
  clearTimeout(overTimer); overTimer = 0;
  tension = false; overMenu = false; lastPickupAt = -10;
  if (stopCrackle) { stopCrackle(now + 1.0); stopCrackle = null; }
  E.g.L.tension.gain.cancelScheduledValues(now); E.g.L.tension.gain.setValueAtTime(0, now);
  E.g.L.lead.gain.cancelScheduledValues(now); E.g.L.lead.gain.setValueAtTime(LAYER_GAIN.lead, now);
  E.g.L.chords.gain.cancelScheduledValues(now); E.g.L.chords.gain.setValueAtTime(LAYER_GAIN.chords, now);
  if (to === 'over') overT = now;
  const f = E.g.fade.gain;
  f.cancelScheduledValues(now); f.setValueAtTime(f.value, now);
  f.setTargetAtTime(0, now, to === 'over' ? 0.1 : 0.25);
  if (to === 'menu') startSong('menu', now + (from === 'none' ? 0.05 : 1.0));
  if (to === 'run') startSong('run', now + 0.35);
  scene = to;
}
function tick() {
  if (!ctx || ctx.state !== 'running' || !isUnlocked()) return;
  const want = musicScene(game.state.mode, game.state.intro);
  if (want !== 'hold' && want !== scene) changeScene(want);
  if (scene === 'over' && !overMenu && ctx.currentTime > overT + 7) {
    overMenu = true; startSong('menu', ctx.currentTime + 0.05);
  }
  if (!musicOn) return;
  if (seq && (scene === 'menu' || overMenu) && !stopCrackle) stopCrackle = crackleStart(E, ctx.currentTime + 0.05);
  let keep = 0;
  for (let i = 0; i < pendingVoices.length; i++) {
    const v = pendingVoices[i];
    if (v.at > ctx.currentTime + LOOKAHEAD) { pendingVoices[keep++] = v; continue; }
    if (v.at >= ctx.currentTime) voice(E, v.prio, v.cost, v.build, v.at);
  }
  pendingVoices.length = keep;
  if (!seq) return;
  seq.next = resyncTime(seq.next, ctx.currentTime);
  seq.run(ctx.currentTime + LOOKAHEAD);
}

function runSong(E) {
  const L = E.g.L;
  let layers = layersFor(tierFor(game.naturalSpeed));
  const song = {
    swing: 0.5, bpm: () => bpmFor(game.naturalSpeed), tier: tierFor(game.naturalSpeed), pickupAt: -1,
    play(q, bar, s, t) {
      const b8 = bar % 8, ch = CH[RUN_BARS[b8]], sd = q.sd, want = tierFor(game.naturalSpeed);
      if (s === 0) E.g.delay.delayTime.setTargetAtTime(0.75 * 60 / q.bpm, t, 0.05);
      if (want > song.tier && bar % 4 === 3 && s === 12) I.riser(E, t, 4 * sd, L.drums);
      if (want > song.tier && bar % 4 === 0 && s === 0) { song.tier = want; layers = layersFor(want); I.crash(E, t, 1, L.drums); }
      if (layers.crash8 && b8 === 0 && s === 0 && bar > 0) I.crash(E, t, 0.8, L.drums);
      const fill = layers.fill && b8 === 7 && s >= 12;
      const K = layers.kickB ? KICK_B : KICK_A;
      if (K[s]) I.kick(E, t, K[s], L.drums);
      if (fill) I.snare(E, t, FILL[s - 12], L.drums); else if (SNARE[s]) I.snare(E, t, SNARE[s], L.drums);
      const H = layers.hatsB ? HAT_B : HAT_A;
      if (!fill && H[s]) I.hat(E, t, H[s], L.drums);
      if (!fill && layers.hatsB && s === OPEN_B_STEP) I.hat(E, t, 0.7, L.drums, true);
      const b = (layers.bassB ? BASS_B_S : BASS_A_S)[s]; if (b) I.bass(E, t, ch.root + b[1], b[2] * sd, b[3], L.bass);
      if (layers.stabs) { const st = STABS_S[s]; if (st) for (const m of ch.tones) I.stab(E, t, m, st[2], L.chords); }
      if (layers.lead) { const n = LEAD_S[b8][s]; if (n) I.lead(E, t, n[1], n[2] * sd, 1, L.lead, layers.sparkle); }
      if (layers.arp && !LOW_END) I.arp(E, t, ARP_TONES[b8][ARP_ORDER[s]], s % 4 === 0 ? 0.9 : 0.6, L.arp);
      if (tension) {
        if (s === 0) I.drone(E, t, 16 * sd, L.tension);
        if (s === 0 || s === 8) I.heart(E, t, 1, L.tension);
        if (s === 3 || s === 11) I.heart(E, t, 0.65, L.tension);
      }
      if (song.pickupAt >= 0 && s % 2 === 0 && t >= song.pickupAt) {
        song.pickupAt = -1;
        I.crash(E, t, 0.8, E.g.stinger); I.kick(E, t, 0.8, E.g.stinger);
        for (const m of ch.tones) I.stab(E, t, m + 12, 1, E.g.stinger, 0);
      }
    },
  };
  return song;
}
events.addEventListener('caught', () => {
  if (!E || !isUnlocked() || ctx.state !== 'running' || scene !== 'run') return;
  const now = ctx.currentTime, p = E.g.lp.frequency;
  p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.exponentialRampToValueAtTime(300, now + 0.45);
  duckMusic(0.5, 0.6);
});

function setTension(E, on, t) {
  const L = E.g.L;
  L.tension.gain.setTargetAtTime(on ? LAYER_GAIN.tension : 0, t, on ? 0.17 : 0.6);
  L.lead.gain.setTargetAtTime(LAYER_GAIN.lead * (on ? 0.5 : 1), t, 0.2);
  L.chords.gain.setTargetAtTime(LAYER_GAIN.chords * (on ? 0.7 : 1), t, 0.2);
}


const ST = {
  pickup(E, song, now) { song.pickupAt = now + 0.30; duckMusic(0.6, 0.30); },
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

function canPlay() { return E && musicOn && isUnlocked() && ctx.state === 'running' && !document.hidden; }
function syncScene() {
  const want = musicScene(game.state.mode, game.state.intro);
  if (want !== 'hold' && want !== scene) changeScene(want);
}
events.addEventListener('venomNear', () => {
  if (!E || !isUnlocked() || ctx.state !== 'running' || document.hidden) return;
  syncScene();
  if (scene !== 'run') return;
  tension = true; setTension(E, true, ctx.currentTime);
});
events.addEventListener('venomFar', () => {
  if (!E || scene !== 'run') return;
  tension = false; setTension(E, false, ctx.currentTime);
});
events.addEventListener('pickup', () => {
  if (!canPlay()) return;
  syncScene();
  const now = ctx.currentTime;
  if (scene !== 'run' || !song || !stingerReady(lastPickupAt, now)) return;
  lastPickupAt = now; ST.pickup(E, song, now);
});
events.addEventListener('missionDone', () => {
  if (!canPlay() || missionTimer) return;
  missionTimer = setTimeout(() => {
    missionTimer = 0;
    if (!canPlay()) return;
    if (scene === 'run') duckMusic(0.55, 0.6);
    ST.missionDone(E, ctx.currentTime + 0.02);
  }, 0);
});
events.addEventListener('missionSet', () => {
  clearTimeout(missionTimer); missionTimer = 0;
  if (!canPlay()) return;
  if (scene === 'run') duckMusic(0.55, 1.0);
  ST.missionSet(E, ctx.currentTime + 0.02);
});
events.addEventListener('gameover', () => {
  if (!canPlay()) return;
  syncScene();
  overTimer = setTimeout(() => {
    overTimer = 0;
    if (canPlay() && game.state.mode === 'over') ST.closing(E, ctx.currentTime + 0.6);
  }, 0);
});
events.addEventListener('newRecord', () => {
  clearTimeout(overTimer); overTimer = 0;
  if (!canPlay() || game.state.mode !== 'over') return;
  syncScene(); ST.record(E, ctx.currentTime + 0.35);
});
