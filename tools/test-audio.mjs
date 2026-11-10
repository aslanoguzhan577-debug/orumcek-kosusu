// Deterministic Web Audio lifecycle check; run with test-skills.mjs, no speakers needed.
import assert from 'node:assert/strict';
import { game } from '../src/game.js';
import { emit } from '../src/events.js';
import { hz } from '../src/audio-logic.js';

const originals = new Map();
function stub(key, value) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const timers = new Map(), intervals = [];
let nextTimer = 0, context;
stub('setInterval', (fn) => { intervals.push(fn); return intervals.length; });
stub('setTimeout', (fn) => { timers.set(++nextTimer, fn); return nextTimer; });
stub('clearTimeout', (id) => timers.delete(id));
const win = new EventTarget(), doc = new EventTarget();
doc.hidden = false;
stub('window', win); stub('document', doc);
stub('navigator', { hardwareConcurrency: Number(process.env.AUDIO_TEST_CORES || 8) });
const storage = new Map([['spidey.muted', '1']]);
stub('localStorage', { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) });

class Param {
  value = 0;
  events = [];
  record(method, value, time, tau) {
    assert.ok(Number.isFinite(value) && Number.isFinite(time), 'finite automation');
    if (method === 'exp') assert.ok(value > 0, 'positive exponential target');
    this.events.push({ method, value, time, tau }); this.value = value;
    return this;
  }
  setValueAtTime(v, t) { return this.record('set', v, t); }
  linearRampToValueAtTime(v, t) { return this.record('linear', v, t); }
  exponentialRampToValueAtTime(v, t) { return this.record('exp', v, t); }
  setTargetAtTime(v, t, tau) { assert.ok(tau > 0); return this.record('target', v, t, tau); }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e.time < t); }
}
class Node {
  constructor(ctx, kind) {
    this.ctx = ctx; this.kind = kind; this.targets = [];
    for (const key of ['gain', 'frequency', 'detune', 'Q', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release']) this[key] = new Param();
    ctx.nodes.add(this);
  }
  connect(to) { this.ctx.nodes.add(this); this.targets.push(to); return to; }
  disconnect() { this.targets.length = 0; this.ctx.nodes.delete(this); }
  start(t = 0) {
    this.at = t;
    this.end = this.buffer && !this.loop ? t + this.buffer.duration : Infinity;
    this.ctx.sources.add(this); this.ctx.started++;
    if (this.ctx.trace) { this.entry = { t, f: this.frequency.value, kind: this.kind, type: this.type }; this.ctx.trace.push(this.entry); }
  }
  stop(t = this.ctx.currentTime) { this.end = t; if (this.entry) this.entry.duration = t - this.at; }
}
class Context {
  currentTime = 0;
  sampleRate = 8000;
  state = 'suspended';
  nodes = new Set(); sources = new Set(); started = 0; trace = null;
  constructor() { context = this; this.destination = new Node(this, 'destination'); }
  createGain() { return new Node(this, 'gain'); }
  createDynamicsCompressor() { return new Node(this, 'compressor'); }
  createBiquadFilter() { return new Node(this, 'filter'); }
  createDelay() { return new Node(this, 'delay'); }
  createWaveShaper() { return new Node(this, 'shaper'); }
  createOscillator() { return new Node(this, 'oscillator'); }
  createBufferSource() { return new Node(this, 'buffer'); }
  createBuffer(ch, size, rate) { const data = new Float32Array(size); return { duration: size / rate, getChannelData: () => data }; }
  async suspend() { this.state = 'suspended'; this.onstatechange?.(); }
  async resume() { this.state = 'running'; this.onstatechange?.(); }
  advance(dt) {
    if (this.state !== 'running') return;
    this.currentTime += dt;
    for (const source of this.sources) if (source.end <= this.currentTime) {
      this.sources.delete(source); source.onended?.();
    }
  }
}
win.AudioContext = Context;
const audio = await import('../src/audio.js');
const pump = (seconds) => {
  for (let elapsed = 0; elapsed < seconds - 1e-8;) {
    const dt = Math.min(0.025, seconds - elapsed); elapsed += dt;
    context.advance(dt);
    for (const [id, fn] of timers) { timers.delete(id); fn(); }
    for (const fn of intervals) fn();
    const s = audio.audioStats();
    assert.ok(s.sfx <= 24 && s.music.used <= (navigator.hardwareConcurrency <= 4 ? 36 : 44), 'hard pool caps');
    assert.ok(context.sources.size <= s.sfx + s.music.used + 2, 'every source is accounted for, plus crackle/unlock');
    assert.ok(context.sources.size <= (navigator.hardwareConcurrency <= 4 ? 60 : 68), 'hard total source cap');
  }
};
const near = (a, b) => Math.abs(a - b) < 0.001;
const hasPitch = (m) => context.trace.some((s) => near(s.f, hz(m)));
const countPitch = (m) => context.trace.filter((s) => near(s.f, hz(m))).length;

try {
  game.state.mode = 'menu'; game.state.intro = false;
  audio.prepareAudio();
  const graphNodes = context.nodes.size;
  const stinger = [...context.nodes].find((n) => n.kind === 'gain' && n.gain.value === 2.2);
  const echoReturn = [...context.nodes].find((n) => n.kind === 'filter' && n.targets.includes(stinger));
  assert.ok(echoReturn && echoReturn.frequency.value === 2600, 'stinger echo bypasses the song fade');
  const echoDelay = [...context.nodes].find((n) => n.kind === 'delay' && n.targets.includes(echoReturn));
  assert.ok(echoDelay && echoReturn.targets.some((n) => n.gain.value === 0.28 && n.targets.includes(echoDelay)), 'stinger echo keeps feedback level');
  assert.equal(audio.isMusicOn(), false); assert.equal(audio.isSfxOn(), false);
  audio.setMusicOn(true); audio.setSfxOn(true);
  emit('coin'); pump(1);
  assert.equal(context.started, 0, 'no sound before gesture');
  win.dispatchEvent(new Event('pointerdown')); pump(0.1);
  assert.equal(audio.audioStats().music.scene, 'menu');
  pump(4);
  const musicGain = [...context.nodes].find((n) => n.kind === 'gain' && n.gain.events.some((e) => near(e.value, 0.14)));
  audio.setMusicOn(false); pump(5);
  assert.equal(musicGain.gain.value, 0);
  assert.equal(audio.audioStats().music.used, 0, 'music notes release after mute');
  context.trace = []; emit('coin');
  assert.equal(context.trace.length, 2, 'coin has two sources');
  pump(0.2); assert.equal(audio.audioStats().sfx, 0, 'coin releases');
  audio.setSfxOn(false); emit('jump');
  assert.equal(audio.audioStats().sfx, 0, 'effects mute gates new voices');
  assert.equal(storage.get('spidey.muted'), '1', 'both off saves the legacy key');
  audio.setMusicOn(true); pump(0.1);
  assert.ok(audio.audioStats().music.used > 0, 'music resumes independently of effects');

  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  const hiddenTime = context.currentTime, hiddenStarts = context.started;
  emit('pickup'); pump(2);
  assert.equal(context.state, 'suspended'); assert.equal(context.currentTime, hiddenTime);
  assert.equal(context.started, hiddenStarts, 'hidden tab schedules nothing');
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); pump(0.1);
  assert.equal(context.state, 'running', 'menu resumes on visibility');
  game.state.mode = 'paused'; emit('pause');
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(context.state, 'suspended', 'paused run stays silent');
  game.state.mode = 'menu'; emit('menu'); pump(0.1);
  assert.equal(context.state, 'running', 'pause to menu resumes context');
  await context.suspend();
  for (let i = 0; i < 50; i++) {
    audio.setMusicOn(false); audio.setMusicOn(true);
    assert.ok(context.sources.size <= (navigator.hardwareConcurrency <= 4 ? 36 : 44), 'rapid toggles cannot exceed source cap');
  }
  win.dispatchEvent(new Event('touchend'));
  assert.equal(context.state, 'running', 'interruption re-arms unlock listeners');

  game.state.mode = 'running'; game.state.intro = true; pump(1);
  assert.equal(audio.audioStats().music.scene, 'silent');
  game.state.intro = false; game.naturalSpeed = 11; pump(0.5);
  assert.equal(audio.audioStats().music.tier, 0);
  game.state.speed = 800; pump(0.2);
  assert.equal(audio.audioStats().music.tier, 0, 'boost speed does not raise tier');
  game.naturalSpeed = 17; pump(2);
  assert.equal(audio.audioStats().music.tier, 0, 'entrance waits for four bars');
  pump(9); assert.equal(audio.audioStats().music.tier, 2);
  emit('venomNear');
  const tensionLayer = [...context.nodes].find((n) => n.kind === 'gain' && n.gain.events.some((e) => e.value === 1 && e.tau === 0.17));
  assert.ok(tensionLayer, 'Venom fades tension in');
  audio.setMusicOn(false); emit('venomFar'); emit('venomNear');
  assert.equal(tensionLayer.gain.value, 1, 'tension tracks Venom while music is muted');
  audio.setMusicOn(true);
  emit('venomFar'); assert.equal(tensionLayer.gain.value, 0);
  emit('venomNear');
  game.state.mode = 'menu'; pump(0.1);
  assert.equal(tensionLayer.gain.value, 0, 'scene change clears tension');

  game.state.mode = 'running'; game.naturalSpeed = 39; pump(0.5);
  context.trace = []; emit('pickup'); emit('pickup'); pump(1);
  assert.equal(context.trace.filter((s) => s.kind === 'buffer' && near(s.duration, 1.6)).length, 1, 'two pickups produce one crash');
  game.state.intro = true; pump(3); context.trace = [];
  emit('missionDone'); emit('missionDone'); pump(0.5);
  assert.equal(countPitch(84), 1, 'same-frame missions coalesce');
  pump(3); context.trace = [];
  emit('missionDone'); emit('missionSet'); pump(0.7);
  assert.equal(countPitch(84), 1, 'set replaces pending mission bells');
  assert.ok(hasPitch(60), 'set chord plays');

  game.state.intro = false; game.state.mode = 'over'; context.trace = [];
  emit('gameover'); emit('newRecord', { score: 100 }); pump(4.9);
  assert.ok(hasPitch(85), 'record fanfare reaches its final C sharp');
  assert.equal(hasPitch(53), false, 'record cancels closing phrase');
  assert.equal(audio.audioStats().music.used, 0, 'fanfare releases every source');
  pump(3); assert.equal(audio.audioStats().music.scene, 'over');
  assert.equal(audio.audioStats().music.bpm, 84, 'over returns to menu after seven seconds');
  game.state.mode = 'running'; pump(0.5);
  game.state.mode = 'over'; context.trace = []; emit('gameover'); pump(4);
  assert.ok(hasPitch(53) && hasPitch(68), 'closing has EP and G sharp resolution');

  game.state.mode = 'running'; game.naturalSpeed = 39; audio.setSfxOn(true); pump(1);
  context.trace = null; emit('venomNear');
  let peak = 0;
  for (let minute = 0; minute < 20; minute++) {
    for (let second = 0; second < 60; second++) {
      for (let coin = 0; coin < 30; coin++) { emit('coin'); pump(1 / 30); }
      emit('jump');
      if (second % 10 === 0) emit('missionSet');
      peak = Math.max(peak, audio.audioStats().music.used);
    }
    assert.ok(context.nodes.size < 300, 'released voice nodes do not accumulate');
  }
  game.state.mode = 'over'; emit('gameover'); pump(6.9);
  assert.ok(audio.audioStats().music.used < 10, 'post-run music pool drains');
  assert.equal(audio.audioStats().sfx, 0, 'post-run effects pool drains');
  audio.setMusicOn(false); pump(5);
  assert.equal(context.sources.size, 0, 'every source ends');
  assert.equal(context.nodes.size, graphNodes, 'only the fixed output graph remains');
  console.log(`OK: audio lifecycle, stingers and simulated 20-minute soak (${navigator.hardwareConcurrency} cores, peak music ${peak})`);
} finally {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
