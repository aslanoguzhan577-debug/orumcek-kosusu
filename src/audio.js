// G5 — Web Audio ile kodla uretilen efekt sesleri. Dosya yok, kutuphane yok.
// Sozlesme olaylarina modul yuklenince abone olur. Disa acik API: music / sfx toggles.
import { events } from './events.js';
import { initMusic, setMusicOn as applyMusicOn, duckMusic, musicStats } from './music.js';
import { loadSettings, saveSettings, COIN_MIDI, COIN_COMP, hz, coinNext, DUCK_SFX } from './audio-logic.js';
const MASTER_VOL = 0.55;
const MAX_VOICES = 24;   // bunun ustunde hicbir ses calinmaz
const SOFT_VOICES = 14;  // bunun ustunde sadece onemli sesler calinir (low=true olanlar atlanir)
const NOISE_SECONDS = 2;

let ctx = null;
let master = null;
let coinIn = null;
let noiseBuf = null;
let voices = 0;
let paused = false;
let unlocked = false;
const settings = loadSettings((k) => { try { return localStorage.getItem(k); } catch (e) { return null; } });
const coinState = { streak: 0, lastCoin: -10, lastPlay: -10 };
const lastPlay = Object.create(null);

function persistSettings() {
  saveSettings((k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* yoksay */ } }, settings);
}
export function isMusicOn() { return settings.music; }
export function setMusicOn(value) { settings.music = !!value; persistSettings(); applyMusicOn(settings.music); }
export function isSfxOn() { return settings.sfx; }
export function setSfxOn(value) { settings.sfx = !!value; persistSettings(); applyMasterGain(); }
function applyMasterGain() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(settings.sfx ? MASTER_VOL : 0, t, 0.015);
}

// ---------- baslatma (mobil autoplay) ----------
function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return null; }

  master = ctx.createGain();
  master.gain.value = settings.sfx ? MASTER_VOL : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 8;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.001; limiter.release.value = 0.08;
  const out = ctx.createGain(); out.gain.value = 0.9;
  comp.connect(limiter); limiter.connect(out); out.connect(ctx.destination);
  const coinLP = ctx.createBiquadFilter();
  coinLP.type = 'lowpass'; coinLP.frequency.value = 5200; coinLP.Q.value = 0.5;
  coinIn = ctx.createGain(); coinIn.gain.value = 1;
  coinIn.connect(coinLP); coinLP.connect(master);

  // Tek, onbellekli gurultu tamponu
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyMusicOn(settings.music);
  initMusic(ctx, limiter, noiseBuf, () => unlocked);
  ctx.onstatechange = () => {
    if (ctx.state === 'running') removeUnlockListeners();
    else if (!paused && !document.hidden) addUnlockListeners();
  };
  if (!unlocked || document.hidden) ctx.suspend().catch(() => {});
  return ctx;
}

// Build the (suspended) context at start-up, behind the loading screen: creating it costs
// 25-50 ms, which would otherwise land on the first tap. The first gesture only resumes it.
export function prepareAudio() { ensureContext(); }

function unlock() {
  unlocked = true;
  if (!ensureContext()) return;
  if (!paused && !document.hidden && ctx.state !== 'running') {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }
  // iOS: ilk dokunusta sessiz bir tampon cal
  try {
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
    s.onended = () => s.disconnect();
  } catch (e) { /* yoksay */ }
  if (ctx.state === 'running') removeUnlockListeners();
}
// iOS Safari only unlocks audio on touchend / click, so listen to those too
const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'pointerup', 'click', 'keydown'];
const UNLOCK_OPTS = { capture: true, passive: true };
function removeUnlockListeners() {
  for (const n of UNLOCK_EVENTS) window.removeEventListener(n, unlock, UNLOCK_OPTS);
}
function addUnlockListeners() {
  for (const n of UNLOCK_EVENTS) window.addEventListener(n, unlock, UNLOCK_OPTS);
}
addUnlockListeners();
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else resumeContext();
});
window.addEventListener('pagehide', () => { if (ctx) ctx.suspend().catch(() => {}); });
function resumeContext() {
  if (ctx && unlocked && !paused && !document.hidden && ctx.state !== 'running') ctx.resume().catch(() => {});
}
events.addEventListener('menu', () => { paused = false; resumeContext(); });

// ---------- ses kurucu yardimcilar ----------
function claim(low, count = 1) {
  if (voices + count > MAX_VOICES || (low && voices + count > SOFT_VOICES)) return false;
  voices += count;
  return true;
}
function release(nodes, count = 1) {
  for (const n of nodes) { try { n.disconnect(); } catch (e) { /* yoksay */ } }
  voices = Math.max(0, voices - count);
}

// zarf: kisa atak, ussel sonum
function envelope(g, t, dur, vol, attack = 0.005) {
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(vol, t + attack);
  p.exponentialRampToValueAtTime(0.0001, t + dur);
}

function addFilter(src, nodes, t, dur, o) {
  if (!o.filter) return src;
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q || 1;
  f.frequency.setValueAtTime(o.f1, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  src.connect(f);
  nodes.push(f);
  return f;
}

// o: {type,f,to,at,dur,vol,attack,low, filter,f1,f2,q, trem,depth}
// trem = tremolo rate in Hz (fast amplitude wobble, depth 0..0.5): the "tingle" / electric hum
function tone(o) {
  const cost = o.trem ? 2 : 1;
  if (!claim(o.low, cost)) return;
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const nodes = [osc];
  let tail = addFilter(osc, nodes, t, dur, o);
  if (o.trem) {
    const d = o.depth || 0.45;
    const am = ctx.createGain();
    am.gain.value = 1 - d;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.trem;
    const lfoG = ctx.createGain();
    lfoG.gain.value = d;
    lfo.connect(lfoG);
    lfoG.connect(am.gain);
    tail.connect(am);
    tail = am;
    nodes.push(am, lfo, lfoG);
    lfo.start(t);
    lfo.stop(t + dur + 0.03);
  }
  const g = ctx.createGain();
  envelope(g, t, dur, o.vol, o.attack);
  tail.connect(g);
  g.connect(master);
  nodes.push(g);
  osc.onended = () => release(nodes, cost);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

// o: {at,dur,vol,attack,low, filter,f1,f2,q}  (dur <= 1 sn)
function noise(o) {
  if (!claim(o.low)) return;
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const nodes = [src];
  const tail = addFilter(src, nodes, t, dur, o);
  const g = ctx.createGain();
  envelope(g, t, dur, o.vol, o.attack);
  tail.connect(g);
  g.connect(master);
  nodes.push(g);
  src.onended = () => release(nodes);
  src.start(t, Math.random() * (NOISE_SECONDS - 1));
  src.stop(t + dur + 0.03);
}

// Hirilti: testere dalgasi + alcak geciren filtre + hizli genlik titresimi (LFO)
function growl(o) {
  if (!claim(false, 2)) return;
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(o.f, t);
  osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 5;
  lp.frequency.setValueAtTime(o.lp, t);
  lp.frequency.exponentialRampToValueAtTime(o.lp * 0.5, t + dur);
  const am = ctx.createGain();
  am.gain.value = 0.55;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = o.rate || 26;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.45;
  lfo.connect(lfoDepth);
  lfoDepth.connect(am.gain);
  const g = ctx.createGain();
  envelope(g, t, dur, o.vol, o.attack || 0.06);
  osc.connect(lp);
  lp.connect(am);
  am.connect(g);
  g.connect(master);
  const nodes = [osc, lp, am, lfo, lfoDepth, g];
  osc.onended = () => release(nodes, 2);
  osc.start(t); osc.stop(t + dur + 0.03);
  lfo.start(t); lfo.stop(t + dur + 0.03);
}

// Cartoon scream: sawtooth with vibrato through two "aa" formant band-passes.
// Pitch jumps up fast, then slides down slowly.
function scream(o) {
  if (!claim(false, 3)) return;
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const f0 = o.f;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.linearRampToValueAtTime(f0 * 2.1, t + 0.12);
  osc.frequency.linearRampToValueAtTime(f0 * 2.3, t + 0.3);
  osc.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + dur);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6.5;
  const lfoG = ctx.createGain();
  lfoG.gain.value = f0 * 0.07;
  lfo.connect(lfoG);
  lfoG.connect(osc.frequency);
  const sum = ctx.createGain();
  const p = sum.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(o.vol, t + 0.04);
  p.setValueAtTime(o.vol, t + dur * 0.7);
  p.exponentialRampToValueAtTime(0.0001, t + dur);
  const nodes = [osc, lfo, lfoG, sum];
  for (const [f, q, g] of [[850, 5, 1], [1300, 6, 0.7]]) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const gn = ctx.createGain();
    gn.gain.value = g;
    osc.connect(bp);
    bp.connect(gn);
    gn.connect(sum);
    nodes.push(bp, gn);
  }
  sum.connect(master);
  osc.onended = () => release(nodes, 3);
  osc.start(t); osc.stop(t + dur + 0.03);
  lfo.start(t); lfo.stop(t + dur + 0.03);
}

function coinEnvelope(p, t, peak, att, tau) {
  p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att); p.setTargetAtTime(0, t + att, tau);
}
function coinVoice(step) {
  if (!claim(true, 2)) return;
  const t = ctx.currentTime;
  const f = hz(COIN_MIDI[step]), P = 0.12 * COIN_COMP[step], nodes = [];
  const o1 = ctx.createOscillator(); o1.type = 'sine';
  o1.frequency.setValueAtTime(f * 0.985, t); o1.frequency.linearRampToValueAtTime(f, t + 0.01);
  const g1 = ctx.createGain(); g1.gain.value = 0; coinEnvelope(g1.gain, t, P, 0.004, 0.03);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t);
  const g2 = ctx.createGain(); g2.gain.value = 0; coinEnvelope(g2.gain, t, P * 0.18, 0.002, 0.016);
  o1.connect(g1); g1.connect(coinIn); o2.connect(g2); g2.connect(coinIn);
  nodes.push(o1, g1, o2, g2);
  o1.start(t); o1.stop(t + 0.14); o2.start(t); o2.stop(t + 0.08);
  o1.onended = () => release(nodes, 2);
}

// ---------- sesler ----------
const SOUNDS = {
  jump() {
    tone({ type: 'triangle', f: 260, to: 640, dur: 0.16, vol: 0.28 });
    tone({ type: 'sine', f: 520, to: 1100, dur: 0.1, vol: 0.08, at: 0.02, low: true });
  },
  land() {
    tone({ type: 'sine', f: 170, to: 55, dur: 0.14, vol: 0.4 });
    noise({ dur: 0.07, vol: 0.18, filter: 'lowpass', f1: 900, f2: 250 });
  },
  slide() {
    noise({ dur: 0.34, vol: 0.2, attack: 0.04, filter: 'bandpass', f1: 2200, f2: 500, q: 1.5 });
  },
  lane() {
    noise({ dur: 0.1, vol: 0.07, attack: 0.02, filter: 'bandpass', f1: 1200, f2: 2600, q: 2, low: true });
  },
  coin() {
    const i = coinNext(coinState, ctx.currentTime);
    if (i >= 0) coinVoice(i);
  },
  pickup(d) {
    if (d && d.type === 'iron') {
      // metalik, agir: alcak duyulan ve parlak kare dalga akoru
      const notes = [262, 330, 392, 523];
      notes.forEach((f, i) => {
        tone({ type: 'square', f, dur: 0.22, vol: 0.1, at: i * 0.07, filter: 'lowpass', f1: 2400 });
        tone({ type: 'sine', f: f * 4.02, dur: 0.3, vol: 0.05, at: i * 0.07 + 0.02 });
      });
      tone({ type: 'sawtooth', f: 131, dur: 0.4, vol: 0.1, filter: 'lowpass', f1: 600 });
    } else if (d && d.type === 'sense') {
      // tingle: tiz, titreyen kucuk cinlama arpeji
      [1175, 1568, 2093, 2637].forEach((f, i) => {
        tone({ type: 'sine', f, dur: 0.22, vol: 0.12, at: i * 0.05, attack: 0.003, trem: 32 });
      });
      tone({ type: 'sine', f: 3951, dur: 0.3, vol: 0.05, at: 0.18, trem: 40 });
    } else if (d && d.type === 'magnet') {
      // elektrikli "tak": alcak mıknatıs kenetlenmesi + yukselen iki nota
      tone({ type: 'sawtooth', f: 110, to: 330, dur: 0.22, vol: 0.14, filter: 'lowpass', f1: 500, f2: 2200, q: 3, trem: 48, depth: 0.4 });
      tone({ type: 'square', f: 392, dur: 0.12, vol: 0.09, at: 0.14, filter: 'lowpass', f1: 2600 });
      tone({ type: 'square', f: 587, dur: 0.2, vol: 0.09, at: 0.24, filter: 'lowpass', f1: 2600 });
      tone({ type: 'sine', f: 1500, to: 300, dur: 0.07, vol: 0.14 });
      noise({ dur: 0.04, vol: 0.12, filter: 'highpass', f1: 3500 });
    } else {
      // ag doldurucu: yukari giden parlak arpej
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone({ type: 'triangle', f, dur: 0.16, vol: 0.2, at: i * 0.06, attack: 0.003 });
      });
    }
  },
  senseOn() {
    // titreyen ses: ince sinuslar yukari kayar, hizli tremolo
    [[1568, 2349, 0], [2349, 3136, 0.04], [3136, 4186, 0.08]].forEach(([f, to, at]) => {
      tone({ type: 'sine', f, to, dur: 0.55, vol: 0.075, at, attack: 0.08, trem: 30 });
    });
    tone({ type: 'sine', f: 784, to: 1175, dur: 0.5, vol: 0.06, attack: 0.1, trem: 22 });
    noise({ dur: 0.45, vol: 0.04, attack: 0.1, filter: 'highpass', f1: 5000 });
  },
  senseDodge() {
    // keskin "tingg" + hizli bir vuslama
    tone({ type: 'sine', f: 3136, to: 2637, dur: 0.22, vol: 0.2, attack: 0.002, trem: 36, depth: 0.35 });
    tone({ type: 'triangle', f: 1568, dur: 0.1, vol: 0.12, attack: 0.002 });
    noise({ dur: 0.22, vol: 0.2, attack: 0.03, filter: 'bandpass', f1: 700, f2: 3600, q: 1.6 });
  },
  senseOff() {
    [[3136, 1568, 0], [2349, 1175, 0.05]].forEach(([f, to, at]) => {
      tone({ type: 'sine', f, to, dur: 0.5, vol: 0.06, at, attack: 0.02, trem: 24 });
    });
  },
  magnetOn() {
    // yukselen elektrik vizildisi
    tone({ type: 'sawtooth', f: 70, to: 230, dur: 0.6, vol: 0.14, attack: 0.1, filter: 'lowpass', f1: 300, f2: 2400, q: 3, trem: 52, depth: 0.4 });
    tone({ type: 'sine', f: 140, to: 460, dur: 0.6, vol: 0.1, attack: 0.1 });
    tone({ type: 'square', f: 880, to: 1760, dur: 0.4, vol: 0.025, at: 0.2, attack: 0.1, trem: 60, depth: 0.5 });
  },
  magnetOff() {
    tone({ type: 'sawtooth', f: 230, to: 55, dur: 0.5, vol: 0.13, filter: 'lowpass', f1: 2200, f2: 250, q: 3, trem: 46, depth: 0.4 });
    tone({ type: 'sine', f: 400, to: 90, dur: 0.45, vol: 0.09 });
  },
  web() {
    // "thwip": hizli suprulen bant filtreli gurultu
    const t = ctx.currentTime;
    if (!claim(false)) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 7;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.07);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.22);
    const g = ctx.createGain();
    envelope(g, t, 0.24, 0.55, 0.01);
    src.connect(f); f.connect(g); g.connect(master);
    const nodes = [src, f, g];
    src.onended = () => release(nodes);
    src.start(t, Math.random() * (NOISE_SECONDS - 1));
    src.stop(t + 0.27);
    tone({ type: 'sine', f: 1500, to: 380, dur: 0.12, vol: 0.12, at: 0.05, low: true });
  },
  ironOn() {
    // metalik parilti: yukselen iki detune testere + tiz yildizlar
    tone({ type: 'sawtooth', f: 180, to: 900, dur: 0.55, vol: 0.18, filter: 'lowpass', f1: 400, f2: 4000, q: 4 });
    tone({ type: 'sawtooth', f: 183, to: 1330, dur: 0.55, vol: 0.12, filter: 'lowpass', f1: 400, f2: 4000, q: 4 });
    [1760, 2349, 3136, 4186].forEach((f, i) => {
      tone({ type: 'sine', f, dur: 0.35, vol: 0.09, at: 0.3 + i * 0.05 });
    });
    noise({ dur: 0.5, vol: 0.08, attack: 0.1, filter: 'highpass', f1: 2000, f2: 7000 });
  },
  ironOff() {
    tone({ type: 'sawtooth', f: 800, to: 90, dur: 0.6, vol: 0.2, filter: 'lowpass', f1: 3500, f2: 200, q: 3 });
    tone({ type: 'square', f: 400, to: 60, dur: 0.5, vol: 0.08, filter: 'lowpass', f1: 1200, f2: 150 });
  },
  ironSave() {
    // agir darbe + camlarin / zirhin kirilmasi
    tone({ type: 'sine', f: 130, to: 32, dur: 0.45, vol: 0.55, attack: 0.002 });
    noise({ dur: 0.35, vol: 0.4, attack: 0.002, filter: 'lowpass', f1: 2500, f2: 200 });
    tone({ type: 'sawtooth', f: 200, to: 50, dur: 0.3, vol: 0.18, filter: 'lowpass', f1: 800 });
    for (let i = 0; i < 7; i++) {
      tone({
        type: i % 2 ? 'triangle' : 'sine',
        f: 2200 + Math.random() * 4800,
        to: 1500 + Math.random() * 1000,
        dur: 0.07 + Math.random() * 0.08,
        vol: 0.1,
        at: 0.03 + i * 0.035 + Math.random() * 0.02,
        attack: 0.001,
      });
    }
    noise({ dur: 0.45, vol: 0.14, at: 0.05, attack: 0.002, filter: 'highpass', f1: 5000, f2: 2500 });
  },
  stumble() {
    tone({ type: 'square', f: 230, to: 80, dur: 0.2, vol: 0.2, filter: 'lowpass', f1: 1200 });
    noise({ dur: 0.1, vol: 0.2, filter: 'lowpass', f1: 800, f2: 200 });
    tone({ type: 'sine', f: 120, to: 50, dur: 0.18, vol: 0.3 });
  },
  crash() {
    noise({ dur: 0.6, vol: 0.5, attack: 0.002, filter: 'lowpass', f1: 3500, f2: 150 });
    tone({ type: 'sine', f: 100, to: 28, dur: 0.5, vol: 0.55, attack: 0.002 });
    tone({ type: 'sawtooth', f: 170, to: 45, dur: 0.35, vol: 0.2, filter: 'lowpass', f1: 900 });
  },
  venomNear() {
    growl({ f: 78, to: 52, dur: 0.9, vol: 0.45, lp: 320, rate: 24 });
    noise({ dur: 0.8, vol: 0.12, attack: 0.15, filter: 'lowpass', f1: 450, f2: 200 });
  },
  caught() {
    growl({ f: 90, to: 45, dur: 1.1, vol: 0.5, lp: 380, rate: 30 });
    SOUNDS.crash();
  },
  gameover() {
    // uzgun inis: dusen notalar, sonuncusu uzun ve kayar
    const notes = [392, 349, 294, 220];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      tone({
        type: 'triangle', f, to: last ? f * 0.7 : f * 0.96,
        dur: last ? 0.8 : 0.22, vol: 0.28, at: i * 0.2,
      });
      tone({ type: 'sine', f: f / 2, dur: last ? 0.8 : 0.22, vol: 0.15, at: i * 0.2 });
    });
  },
  start() {
    tone({ type: 'square', f: 523, dur: 0.1, vol: 0.14, filter: 'lowpass', f1: 3000 });
    tone({ type: 'square', f: 784, dur: 0.22, vol: 0.14, at: 0.1, filter: 'lowpass', f1: 3000 });
    tone({ type: 'sine', f: 1568, dur: 0.2, vol: 0.06, at: 0.1 });
    noise({ dur: 0.15, vol: 0.08, attack: 0.05, filter: 'bandpass', f1: 600, f2: 3000, q: 1 });
  },
  hulkRoar() {
    growl({ f: 64, to: 32, dur: 1.8, vol: 0.65, lp: 400, rate: 16, attack: 0.1 });
    tone({ type: 'sawtooth', f: 90, to: 35, dur: 1.5, vol: 0.45, filter: 'lowpass', f1: 600, f2: 120 });
    noise({ dur: 1.4, vol: 0.35, attack: 0.15, filter: 'lowpass', f1: 800, f2: 150 });
  },
  hulkSmash() {
    tone({ type: 'sine', f: 120, to: 24, dur: 0.65, vol: 0.7, attack: 0.002 });
    noise({ dur: 0.6, vol: 0.65, attack: 0.002, filter: 'lowpass', f1: 4200, f2: 120 });
    tone({ type: 'sawtooth', f: 180, to: 38, dur: 0.45, vol: 0.35, filter: 'lowpass', f1: 1200, f2: 100 });
  },
  capShieldSurf() {
    tone({ type: 'sine', f: 440, to: 660, dur: 0.4, vol: 0.15, attack: 0.05 });
    noise({ dur: 0.5, vol: 0.22, attack: 0.05, filter: 'bandpass', f1: 1800, f2: 3200, q: 2.5 });
  },
  capShieldGong() {
    [440, 880, 1320, 1760, 2200].forEach((f, i) => {
      tone({
        type: i % 2 ? 'triangle' : 'sine',
        f, to: f * 0.98,
        dur: 1.8 - i * 0.25,
        vol: 0.35 / (i + 1),
        attack: 0.002,
      });
    });
    noise({ dur: 0.4, vol: 0.3, attack: 0.002, filter: 'bandpass', f1: 2800, f2: 800, q: 4 });
  },
  milesVenomBlast() {
    tone({ type: 'sawtooth', f: 120, to: 950, dur: 0.45, vol: 0.28, filter: 'bandpass', f1: 800, f2: 4500, q: 3 });
    noise({ dur: 0.5, vol: 0.35, attack: 0.02, filter: 'highpass', f1: 2500, f2: 7000 });
    for (let i = 0; i < 5; i++) {
      tone({ type: 'square', f: 800 + Math.random() * 1200, dur: 0.04, vol: 0.15, at: i * 0.04 });
    }
  },
  venomBlastNova() {
    tone({ type: 'sawtooth', f: 600, to: 40, dur: 0.7, vol: 0.5, filter: 'lowpass', f1: 5000, f2: 150 });
    noise({ dur: 0.8, vol: 0.7, attack: 0.002, filter: 'bandpass', f1: 3000, f2: 200, q: 2 });
    tone({ type: 'sine', f: 140, to: 28, dur: 0.7, vol: 0.65, attack: 0.002 });
  },
  // ----- intro clip -----
  i_swing() {
    noise({ dur: 0.55, vol: 0.22, attack: 0.18, filter: 'bandpass', f1: 450, f2: 1900, q: 1.6 });
    noise({ dur: 0.4, vol: 0.08, at: 0.1, attack: 0.1, filter: 'highpass', f1: 1500, f2: 4000 });
  },
  i_webEmpty() {
    [[0, 1900], [0.17, 1500]].forEach(([at, f]) => {
      tone({ type: 'square', f, dur: 0.03, vol: 0.2, at, attack: 0.001, filter: 'highpass', f1: 900 });
      noise({ dur: 0.02, vol: 0.14, at, attack: 0.001, filter: 'highpass', f1: 3500 });
      tone({ type: 'sine', f: f * 1.6, dur: 0.06, vol: 0.05, at, attack: 0.001 });
    });
  },
  i_fall() {
    tone({ type: 'sine', f: 2100, to: 320, dur: 1.0, vol: 0.15, attack: 0.05 });
    tone({ type: 'triangle', f: 1400, to: 210, dur: 1.0, vol: 0.06, attack: 0.05 });
    noise({ dur: 1.0, vol: 0.07, attack: 0.3, filter: 'bandpass', f1: 2600, f2: 500, q: 1.2 });
  },
  i_roll() {
    tone({ type: 'sine', f: 140, to: 45, dur: 0.18, vol: 0.45, attack: 0.002 });
    tone({ type: 'sine', f: 110, to: 40, dur: 0.15, vol: 0.3, at: 0.17, attack: 0.002 });
    noise({ dur: 0.6, vol: 0.16, attack: 0.03, filter: 'bandpass', f1: 1500, f2: 550, q: 2 });
    noise({ dur: 0.25, vol: 0.1, at: 0.3, filter: 'lowpass', f1: 900, f2: 300 });
  },
  i_roar() {
    growl({ f: 68, to: 38, dur: 1.7, vol: 0.5, lp: 300, rate: 13, attack: 0.25 });
    growl({ f: 96, to: 52, dur: 1.5, vol: 0.3, lp: 520, rate: 19, at: 0.05, attack: 0.2 });
    noise({ dur: 1.0, vol: 0.2, attack: 0.25, filter: 'lowpass', f1: 700, f2: 200 });
    tone({ type: 'sine', f: 48, to: 30, dur: 1.8, vol: 0.45, attack: 0.3 });
  },
  i_scream() {
    scream({ f: 330, dur: 1.15, vol: 0.55 });
  },
};

// ayni sesin cok sik tekrarini engelle (saniye)
const MIN_GAP = { senseDodge: 0.08, i_swing: 0.25, lane: 0.06, land: 0.08, slide: 0.15, stumble: 0.15, venomNear: 1.5, crash: 0.1, web: 0.1, hulkSmash: 0.12, hulkRoar: 1.0, capShieldSurf: 0.5, capShieldGong: 0.5, milesVenomBlast: 0.5, venomBlastNova: 0.5 };

function play(name, detail) {
  if (!settings.sfx || !unlocked || paused || document.hidden || !ctx || ctx.state !== 'running') return;
  if (name === 'gameover' && isMusicOn()) return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[name];
  if (gap) {
    if (now - (lastPlay[name] ?? -10) < gap) return;
    lastPlay[name] = now;
  }
  const d = DUCK_SFX[name];
  if (d) duckMusic(d, 0.25);
  try { SOUNDS[name](detail); } catch (e) { console.warn("[audio]", name, e); } // ses hatasi oyunu durdurmasin
}

// durum olaylari once kaydedilir: start sesi, paused bayragi temizlendikten sonra calsin
// start: yeni oyun, onceden duraklatilmis olabilir
let startTimer = 0;
let introActive = false;
events.addEventListener('start', () => {
  paused = false;
  // the start jingle waits a moment: when the intro clip begins it takes over (jingle on 'run')
  clearTimeout(startTimer);
  startTimer = setTimeout(() => { if (!introActive) play('start'); }, 40);
  if (ctx && unlocked && !document.hidden && ctx.state !== 'running') {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }
});
events.addEventListener('pause', () => {
  paused = true;
  if (ctx && ctx.state === 'running') {
    const p = ctx.suspend();
    if (p && p.catch) p.catch(() => {});
  }
});
events.addEventListener('resume', () => {
  paused = false;
  if (ctx && unlocked && !document.hidden && ctx.state !== 'running') {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }
});

for (const name of Object.keys(SOUNDS)) {
  if (name === 'start' || name.startsWith('i_')) continue;
  events.addEventListener(name, (e) => play(name, e.detail));
}

// intro clip phases -> sounds
const INTRO_SOUND = { swing: 'i_swing', webEmpty: 'i_webEmpty', fall: 'i_fall', roll: 'i_roll', roar: 'i_roar', scream: 'i_scream', run: 'start' };
events.addEventListener('intro', (e) => {
  const d = e.detail || {};
  if (d.phase === 'start') { introActive = true; clearTimeout(startTimer); }
  else if (d.phase === 'end') { introActive = false; if (d.skipped) play('start'); }
  else if (INTRO_SOUND[d.phase]) play(INTRO_SOUND[d.phase]);
});

export function audioStats() { return { sfx: voices, music: musicStats() }; }
