// G5 — Web Audio ile kodla uretilen efekt sesleri. Dosya yok, kutuphane yok.
// Sozlesme olaylarina modul yuklenince abone olur. Disa acik API: setMuted, isMuted.
import { events } from './events.js';

const MUTE_KEY = 'spidey.muted';
const MASTER_VOL = 0.55;
const MAX_VOICES = 24;   // bunun ustunde hicbir ses calinmaz
const SOFT_VOICES = 14;  // bunun ustunde sadece onemli sesler calinir (low=true olanlar atlanir)
const NOISE_SECONDS = 2;

let ctx = null;
let master = null;
let noiseBuf = null;
let voices = 0;
let paused = false;
let muted = loadMuted();
let coinCombo = 0;
let lastCoinAt = -10;
const lastPlay = Object.create(null);

// ---------- mute (kalici) ----------
function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
}
function saveMuted() {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* yoksay */ }
}
export function isMuted() { return muted; }
export function setMuted(value) {
  muted = !!value;
  saveMuted();
  applyMasterGain();
}
function applyMasterGain() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, t, 0.015);
}

// ---------- baslatma (mobil autoplay) ----------
function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return null; }

  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_VOL;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 8;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);

  // Tek, onbellekli gurultu tamponu
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function unlock() {
  if (!ensureContext()) return;
  if (!paused && ctx.state !== 'running') {
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
for (const n of UNLOCK_EVENTS) window.addEventListener(n, unlock, UNLOCK_OPTS);

// ---------- ses kurucu yardimcilar ----------
function claim(low, count = 1) {
  if (voices + count > MAX_VOICES || (low && voices + count > SOFT_VOICES)) return false;
  voices += count;
  return true;
}
function release(nodes, count = 1) {
  for (const n of nodes) { try { n.disconnect(); } catch (e) { /* yoksay */ } }
  voices -= count;
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

// o: {type,f,to,at,dur,vol,attack,low, filter,f1,f2,q}
function tone(o) {
  if (!claim(o.low)) return;
  const t = ctx.currentTime + (o.at || 0);
  const dur = o.dur;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  const nodes = [osc];
  const tail = addFilter(osc, nodes, t, dur, o);
  const g = ctx.createGain();
  envelope(g, t, dur, o.vol, o.attack);
  tail.connect(g);
  g.connect(master);
  nodes.push(g);
  osc.onended = () => release(nodes);
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
    const now = ctx.currentTime;
    if (now - lastCoinAt > 0.6) coinCombo = 0;
    lastCoinAt = now;
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const f = 988 * Math.pow(2, steps[Math.min(coinCombo, steps.length - 1)] / 12);
    coinCombo++;
    tone({ type: 'square', f, dur: 0.07, vol: 0.1, attack: 0.002, low: true });
    tone({ type: 'sine', f: f * 1.5, dur: 0.26, vol: 0.22, at: 0.055, attack: 0.002, low: true });
    tone({ type: 'sine', f: f * 3, dur: 0.12, vol: 0.05, at: 0.055, low: true });
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
    } else {
      // ag doldurucu: yukari giden parlak arpej
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        tone({ type: 'triangle', f, dur: 0.16, vol: 0.2, at: i * 0.06, attack: 0.003 });
      });
    }
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
};

// ayni sesin cok sik tekrarini engelle (saniye)
const MIN_GAP = { lane: 0.06, land: 0.08, slide: 0.15, stumble: 0.15, venomNear: 1.5, coin: 0.025, crash: 0.1, web: 0.1 };

function play(name, detail) {
  if (muted || paused || !ctx || ctx.state === 'closed') return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[name];
  if (gap) {
    if (now - (lastPlay[name] ?? -10) < gap) return;
    lastPlay[name] = now;
  }
  try { SOUNDS[name](detail); } catch (e) { console.warn("[audio]", name, e); } // ses hatasi oyunu durdurmasin
}

// durum olaylari once kaydedilir: start sesi, paused bayragi temizlendikten sonra calsin
// start: yeni oyun, onceden duraklatilmis olabilir
events.addEventListener('start', () => {
  paused = false;
  if (ctx && ctx.state !== 'running') {
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
  if (ctx && ctx.state !== 'running') {
    const p = ctx.resume();
    if (p && p.catch) p.catch(() => {});
  }
});

for (const name of Object.keys(SOUNDS)) {
  events.addEventListener(name, (e) => play(name, e.detail));
}
