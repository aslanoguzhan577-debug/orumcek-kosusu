// vfxCore.js — shared "Spider-Verse comic + vinyl toy" effects for the hero specials.
//
// Everything is built ONCE by initVfx() (HeroSpecials constructor, behind the loading screen)
// and pooled: nothing is created, added to the scene or disposed during play, no lights are
// ever added (the scene's light count must never change: every lit material would recompile).
//
//   initVfx({ scene, cameraRig })      build the pools (idempotent)
//   updateVfx(dt) / resetVfx()          once per running frame / run start + game over
//   chunkBurst(pos, opts)               outlined toon rubble (InstancedMesh, 2 draw calls)
//   puffBurst(pos, opts)                outlined toon dust balls (InstancedMesh, 2 draw calls)
//   sparkBurst(pos, opts) / spark(...)  short streak sparks (InstancedMesh, 1 draw call)
//   sticker(key, pos, opts)             onomatopoeia sticker sprite (SMASH! BZZT! THWIP! ...)
//   burst(kind, pos, opts)              flat sprite pop: 'halftone' | 'star' | 'glow'
//   groundRing(pos, opts)               ink-edged shock ring sliding over the ground
//   impactFrame(opts)                   1-2 frames of a flat comic panel behind the hero
//   edgeLines(alpha)                    thin speed lines at the screen edges (0 = off)
//   hitStop(s) / kick(m)                freeze frame / camera dolly punch
//   sfx(name, detail)                   play a sound event; fx.js skips its generic reaction
//   ghostLayer(model, material)         per-mesh sibling copies of a character (ghosts, overlays)
//   rigOf(model)                        shoulder / elbow / hand / hip / knee groups of a model
//   ToonPool, canvasTex                 for a skill's own instanced pool / canvas texture (at load)
// Compatibility (next round's files use these, signatures unchanged): createGlowTexture,
// shatterObstacle, updateShatterDebris, triggerFlashLight, triggerCameraFov, updateCameraFov,
// triggerCameraShake.

import * as THREE from 'three';
import { events, emit } from './events.js';
import { game } from './game.js';
import { toonMaterial, addOutline, mergeGeos } from './models/toon.js';

export const INK = 0x1c1016;
export const VFX_TEXTURES = [];

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _Z = new THREE.Vector3(0, 0, 1);
const _e = new THREE.Euler();

let V = null; // the pools, after initVfx()

// ------------------------------------------------------------------ canvas textures (<= 256 px)
const glowTextureCache = new Map();

/** Radial glow texture, cached per colours (kept for the next round's skills). */
export function createGlowTexture(primaryColor = '#ffffff', coreColor = '#ffffff', size = 128) {
  size = Math.min(size, 128);
  const key = `${primaryColor}_${coreColor}_${size}`;
  if (glowTextureCache.has(key)) return glowTextureCache.get(key);
  const tex = canvasTex(size, size, (g, W) => {
    const grad = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    grad.addColorStop(0, coreColor);
    grad.addColorStop(0.35, primaryColor);
    grad.addColorStop(0.7, primaryColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, W);
  });
  glowTextureCache.set(key, tex);
  return tex;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.draw = draw;
  VFX_TEXTURES.push(tex);
  return tex;
}

function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const INK_CSS = '#1c1016';
const FONT = "'Bangers', Impact, 'Arial Black', sans-serif";

// comic sticker: jagged burst, a few halftone dots, tilted lettering with an ink stroke
const STICKERS = {
  smash: ['SMASH!', '#fff2a8', '#3f8226'],
  krak: ['KRAK!', '#ffffff', '#6cb83e'],
  bam: ['BAM!', '#ffd23a', '#d9364a'],
  bzzt: ['BZZT!', '#ffe14a', '#d9364a'],
  zzap: ['ZZAP!', '#1c1016', '#ffe14a'],
  whoom: ['WHOOM!', '#efe3ff', '#6b3fb8'],
  thwip: ['THWIP!', '#ffffff', '#2b4fa8'],
  gong: ['GONG!', '#f2f4f8', '#2f57b5'],
  yay: ['YAY!', '#ffe3ee', '#e0457b'],
  boing: ['BOING!', '#ffffff', '#e0457b'],
  kapow: ['KAPOW!', '#f4c922', '#1c2440'],
  bwoom: ['BWOOM!', '#ffd23a', '#c8202f'],
  fwoosh: ['FWOOSH!', '#e8f7ff', '#c8202f'],
};

function drawSticker([text, burst, fill], seed) {
  return (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const rand = seeded(seed);
    g.lineJoin = 'round';
    g.beginPath();
    const n = 16;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? 0.9 + rand() * 0.1 : 0.66 + rand() * 0.06;
      const x = W / 2 + Math.cos(a) * rr * W * 0.48, y = H / 2 + Math.sin(a) * rr * H * 0.46;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = burst;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = 'rgba(28,16,22,0.16)';
    for (let y = 4; y < H; y += 8) {
      for (let x = (y / 8) % 2 ? 4 : 0; x < W; x += 8) {
        const r = Math.max(0, (x / W + y / H - 0.9)) * 3.4;
        if (r > 0.3) { g.beginPath(); g.arc(x, y, Math.min(r, 3.4), 0, 6.283); g.fill(); }
      }
    }
    g.restore();
    g.lineWidth = 6;
    g.strokeStyle = INK_CSS;
    g.stroke();
    let size = 74;
    g.font = `${size}px ${FONT}`;
    const w = g.measureText(text).width;
    if (w > W * 0.74) { size = Math.floor(size * W * 0.74 / w); g.font = `${size}px ${FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(W / 2, H / 2 + size * 0.05);
    g.rotate(-0.07);
    g.lineWidth = Math.max(8, size * 0.2);
    g.strokeStyle = INK_CSS;
    g.strokeText(text, 3, 4);           // drop shadow ...
    g.strokeText(text, 0, 0);           // ... and outline
    g.fillStyle = fill;
    g.fillText(text, 0, 0);
    g.restore();
  };
}

function drawHalftone(g, W) {
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#ffffff';
  const c = W / 2;
  for (let y = 3; y < W; y += 7) {
    for (let x = (y / 7) % 2 ? 3 : 6.5; x < W; x += 7) {
      const r = Math.hypot(x - c, y - c) / c;
      const s = 3.1 * Math.pow(Math.max(0, 1 - r), 0.55);
      if (s > 0.35) { g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill(); }
    }
  }
}

function drawStar(g, W) {
  g.clearRect(0, 0, W, W);
  const c = W / 2;
  const star = (R, r) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r : R;
      i ? g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr) : g.moveTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
    }
    g.closePath();
  };
  g.lineJoin = 'round';
  star(W * 0.46, W * 0.19);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = INK_CSS;
  g.stroke();
  star(W * 0.3, W * 0.12);
  g.fillStyle = '#e8ecf4';
  g.fill();
}

function drawHeart(g, W) {
  g.clearRect(0, 0, W, W);
  const c = W / 2;
  const heart = (k) => {
    g.beginPath();
    g.moveTo(c, c + W * 0.36 * k);
    g.bezierCurveTo(c - W * 0.5 * k, c + W * 0.02 * k, c - W * 0.42 * k, c - W * 0.38 * k, c, c - W * 0.16 * k);
    g.bezierCurveTo(c + W * 0.42 * k, c - W * 0.38 * k, c + W * 0.5 * k, c + W * 0.02 * k, c, c + W * 0.36 * k);
    g.closePath();
  };
  g.lineJoin = 'round';
  heart(0.95);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = INK_CSS;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.ellipse(c - W * 0.18, c - W * 0.12, W * 0.07, W * 0.04, -0.6, 0, 6.283);
  g.fill();
}

function drawRing(g, W) {
  g.clearRect(0, 0, W, W);
  const c = W / 2;
  g.lineWidth = 12;
  g.strokeStyle = INK_CSS;
  g.beginPath(); g.arc(c, c, W * 0.42, 0, 6.283); g.stroke();
  g.lineWidth = 7;
  g.strokeStyle = '#ffffff';
  g.beginPath(); g.arc(c, c, W * 0.42, 0, 6.283); g.stroke();
}

// ------------------------------------------------------------------ pooled toon instances
// Fixed slots (ring buffer); a dead slot gets a zero matrix. The outline shares the instance
// matrices. count = highest used slot + 1, hidden when nothing is alive.
export class ToonPool {
  constructor(scene, geo, n, mat, outline, outlineGeo, squashY = 1) {
    this.n = n;
    this.squashY = squashY;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 11; // after the impact panel (9), before the player's group (10)
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); this.mesh.setColorAt(i, _c.set(0xffffff)); }
    this.outline = outline ? addOutline(this.mesh, outline, INK) : null;
    if (this.outline) {
      this.outline.renderOrder = 11;
      if (outlineGeo) this.outline.geometry = outlineGeo;
    }
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.head = 0;
    this.used = 0;
    const f = (k) => new Float32Array(n * k);
    this.p = f(3); this.vel = f(3); this.rot = f(3); this.spin = f(3);
    this.life = f(1); this.max = f(1); this.delay = f(1); this.s0 = f(1); this.s1 = f(1);
    this.grav = f(1); this.drag = f(1); this.floor = f(1); this.scroll = new Uint8Array(n); this.kind = new Uint8Array(n);
  }

  spawn(x, y, z, vx, vy, vz, life, s0, s1, hex, o = {}) {
    const i = this.head;
    this.head = (this.head + 1) % this.n;
    const k = i * 3;
    this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.rot[k] = Math.random() * 6.3; this.rot[k + 1] = Math.random() * 6.3; this.rot[k + 2] = Math.random() * 6.3;
    const sp = o.spin ?? 0;
    this.spin[k] = (Math.random() - 0.5) * sp; this.spin[k + 1] = (Math.random() - 0.5) * sp; this.spin[k + 2] = (Math.random() - 0.5) * sp;
    if (this.squashY !== 1) { this.rot[k] = this.rot[k + 2] = this.spin[k] = this.spin[k + 2] = 0; } // puffs stay upright
    this.life[i] = life; this.max[i] = life; this.delay[i] = o.delay || 0;
    this.s0[i] = s0; this.s1[i] = s1;
    this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0;
    this.floor[i] = o.floor ?? -100;
    this.scroll[i] = o.scroll === false ? 0 : 1;
    this.kind[i] = o.kind || 0;
    this.mesh.setColorAt(i, _c.set(hex));
    this.mesh.instanceColor.needsUpdate = true;
    this.used = Math.max(this.used, i + 1);
    return i;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < this.n; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.used = 0;
    this.head = 0;
    this.mesh.visible = false;
  }

  update(dt, dz) {
    let alive = 0, top = 0;
    for (let i = 0; i < this.used; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      if (this.scroll[i]) this.p[k + 2] += dz;
      alive++;
      top = i + 1;
      if (this.delay[i] > 0) { this.delay[i] -= dt; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      const t = 1 - this.life[i] / this.max[i];
      const dr = 1 - Math.min(0.9, this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 2] *= dr;
      this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt;
      this.p[k] += this.vel[k] * dt; this.p[k + 1] += this.vel[k + 1] * dt; this.p[k + 2] += this.vel[k + 2] * dt;
      let s = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - t) * (1 - t));
      const fl = this.floor[i] + s * 0.4;
      if (this.p[k + 1] < fl) { // cartoon bounce: lose most of the energy, keep tumbling
        this.p[k + 1] = fl;
        if (this.vel[k + 1] < 0) { this.vel[k + 1] *= -0.38; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      }
      this.rot[k] += this.spin[k] * dt; this.rot[k + 1] += this.spin[k + 1] * dt; this.rot[k + 2] += this.spin[k + 2] * dt;
      if (t > 0.78) s *= Math.max(0, 1 - (t - 0.78) / 0.22) ** 0.7; // pop out, never fade
      if (t < 0.08) s *= 0.4 + 7.5 * t;                               // pop in
      if (this.p[k + 2] > 1) s *= Math.max(0, (3.5 - this.p[k + 2]) / 2.5); // never big in front of the lens
      _q.setFromEuler(_e.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]));
      this.mesh.setMatrixAt(i, _m.compose(_v.set(this.p[k], this.p[k + 1], this.p[k + 2]), _q, _s.set(s, s * this.squashY, s)));
    }
    this.used = top;
    this.mesh.count = top;
    if (this.outline) this.outline.count = top;
    this.mesh.visible = alive > 0;
    if (alive > 0 || top === 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// streak sparks: two crossed quads stretched along the velocity
class SparkPool extends ToonPool {
  update(dt, dz) {
    let alive = 0, top = 0;
    for (let i = 0; i < this.used; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      if (this.scroll[i]) this.p[k + 2] += dz;
      alive++;
      top = i + 1;
      if (this.delay[i] > 0) { this.delay[i] -= dt; this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      const t = 1 - this.life[i] / this.max[i];
      const dr = 1 - Math.min(0.9, this.drag[i] * dt);
      this.vel[k] *= dr; this.vel[k + 2] *= dr;
      this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt;
      this.p[k] += this.vel[k] * dt; this.p[k + 1] += this.vel[k + 1] * dt; this.p[k + 2] += this.vel[k + 2] * dt;
      _v.set(this.vel[k], this.vel[k + 1], this.vel[k + 2]);
      const sp = _v.length();
      if (sp > 1e-4) _q.setFromUnitVectors(_Z, _v.multiplyScalar(1 / sp));
      const w = this.s0[i] * (1 - t) * Math.min(1, Math.max(0, (4 - this.p[k + 2]) / 2.5));
      this.mesh.setMatrixAt(i, _m.compose(_v.set(this.p[k], this.p[k + 1], this.p[k + 2]), _q, _s.set(w, w, w * 1.5 + sp * this.s1[i])));
    }
    this.used = top;
    this.mesh.count = top;
    this.mesh.visible = alive > 0;
    if (alive > 0 || top === 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function sparkGeometry() {
  // quad in XZ + quad in YZ, both along z (-0.5 .. 0.5), tapered at the tail
  const p = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.1, 0, 0.5, -0.1, 0, 0.5,
    0, -0.5, -0.5, 0, 0.5, -0.5, 0, 0.1, 0.5, 0, -0.1, 0.5,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return g;
}

function roundNormals(geo) {
  // normals straight out from the centre: smooth inverted-hull outline even on a faceted rock
  const p = geo.attributes.position, n = [];
  for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i).normalize(); n.push(_v.x, _v.y, _v.z); }
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return geo;
}

// ------------------------------------------------------------------ screen panels (clip space)
const SCREEN_VERT = /* glsl */`
varying vec2 vNdc;
void main() { vNdc = position.xy * 2.0; gl_Position = vec4(vNdc, 0.0, 1.0); }`;

const IMPACT_FRAG = /* glsl */`
uniform vec2 uCenter;
uniform float uAspect;
uniform float uSeed;
uniform vec3 uBg;
uniform vec3 uDot;
uniform vec3 uLine;
varying vec2 vNdc;
float h(float n) { return fract(sin(n * 127.1 + uSeed) * 43758.5453); }
void main() {
  vec2 p = vNdc - uCenter;
  p.x *= uAspect;
  float r = length(p);
  float k = (atan(p.y, p.x) / 6.2831853 + 0.5) * 72.0;
  float i = floor(k);
  float f = fract(k);
  float r0 = 0.1 + 0.45 * h(i + 31.0);
  float lw = (0.25 + 0.6 * h(i)) * clamp((r - r0) / 0.7, 0.0, 1.0) * step(0.3, h(i + 7.0));
  float line = step(abs(f - 0.5), lw * 0.5);
  vec2 q = fract(gl_FragCoord.xy / 9.0) - 0.5;
  float dotR = 0.12 + 0.3 * clamp(r * 0.8, 0.0, 1.0);
  vec3 col = mix(uBg, uDot, step(length(q), dotR));
  gl_FragColor = vec4(mix(col, uLine, line), 1.0);
}`;

const LINES_FRAG = /* glsl */`
uniform float uAspect;
uniform float uTime;
uniform float uAlpha;
varying vec2 vNdc;
float h(float n) { return fract(sin(n * 91.7) * 43758.5453); }
void main() {
  vec2 p = vNdc;
  p.x *= uAspect;
  float r = length(p) / length(vec2(uAspect, 1.0));
  float k = (atan(p.y, p.x) / 6.2831853 + 0.5) * 110.0;
  float i = floor(k);
  float f = fract(k);
  float on = step(0.45, h(i + 13.0));
  float w = 0.05 + 0.1 * h(i + 3.0);
  float seg = step(fract(r * 1.6 - uTime * (2.2 + 1.5 * h(i)) + h(i)), 0.55);
  float mask = smoothstep(0.45, 0.8, r);
  float a = on * seg * mask * step(abs(f - 0.5), w) * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}`;

// ground shock ring: leading ink edge, light rim, coloured band, trailing halftone dots
const RING_VERT = /* glsl */`
varying vec2 vP;
void main() { vP = position.xz; gl_Position = projectionMatrix * viewMatrix * curveWorld(modelMatrix * vec4(position, 1.0)); }`;
const RING_FRAG = /* glsl */`
uniform float uR;
uniform float uW;
uniform float uOuter;
uniform float uAlpha;
uniform vec3 uColor;
uniform vec3 uEdge;
varying vec2 vP;
void main() {
  float d = length(vP) * uOuter;
  float e = uR - d;                   // 0 at the leading edge, grows inward
  float trail = uW * 1.6;
  if (e < 0.0 || e > uW + trail) discard;
  float ink = 0.05 + uW * 0.06;
  vec3 col;
  if (e < ink) col = vec3(0.11, 0.063, 0.086);
  else if (e < ink + uW * 0.22) col = uEdge;
  else if (e < uW) col = uColor;
  else {
    float t = (e - uW) / trail;
    vec2 q = fract(vP * uOuter / 0.3) - 0.5;
    if (length(q) > 0.42 * (1.0 - t)) discard;
    col = uColor;
  }
  gl_FragColor = vec4(col, uAlpha);
}`;

// ------------------------------------------------------------------ init
export function initVfx({ scene, cameraRig }) {
  if (V) return V;
  const camera = cameraRig.camera;
  V = { scene, cameraRig, camera, time: 0 };

  events.addEventListener('gameover', () => resetVfx());
  events.addEventListener('start', () => resetVfx()); // every run start, whatever the path

  // textures
  V.stickers = {};
  let seed = 3;
  for (const key in STICKERS) V.stickers[key] = canvasTex(256, 128, drawSticker(STICKERS[key], (seed += 17)));
  V.halftone = canvasTex(128, 128, drawHalftone);
  V.star = canvasTex(128, 128, drawStar);
  V.heart = canvasTex(128, 128, drawHeart);
  V.ring = canvasTex(128, 128, drawRing);
  V.glow = createGlowTexture('#ffffff', '#ffffff', 64);
  if (document.fonts && document.fonts.load) {
    document.fonts.load("64px 'Bangers'").then(() => {
      for (const key in V.stickers) { const t = V.stickers[key]; t.userData.draw(t.image.getContext('2d'), 256, 128); t.needsUpdate = true; }
    }).catch(() => {});
  }

  // rubble: faceted toon rocks; dust: round toon puffs; both ink-outlined
  // faceted rock (flat normals) drawn, round-normal twin pushed out for a gap-free outline
  const rock = new THREE.IcosahedronGeometry(0.5, 0);
  V.chunks = new ToonPool(scene, rock, 72, toonMaterial(0xffffff), 0.07, roundNormals(rock.clone()));
  // cartoon cloud: three overlapping balls (each keeps its own round normals for the outline)
  const lump = (r, x, y, z) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
  const ball = mergeGeos([lump(0.36, 0, 0.02, 0), lump(0.26, 0.3, -0.06, 0.05), lump(0.24, -0.28, -0.08, -0.04), lump(0.22, 0.05, 0.2, -0.12)]);
  V.puffs = new ToonPool(scene, ball, 56, toonMaterial(0xffffff, { emissive: 0x5c5650 }), 0.06, null, 0.72); // lifted shadows: dust, not smoke
  V.sparks = new SparkPool(scene, sparkGeometry(), 96, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }), 0);
  V.sparks.mesh.renderOrder = 12;

  // stickers + flat bursts (sprites)
  V.sprites = [];
  for (let i = 0; i < 9; i++) {
    const sticker = i < 3;
    const mat = new THREE.SpriteMaterial({ map: sticker ? V.stickers.smash : V.halftone, depthTest: !sticker, depthWrite: false, fog: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.visible = false;
    sp.frustumCulled = false;
    sp.renderOrder = sticker ? 30 : 12;
    scene.add(sp);
    V.sprites.push({ sp, sticker, life: 0, max: 1, s: 1, rot: 0, spin: 0, scroll: true, kind: 0, s1: 1, a: 1, follow: null, off: new THREE.Vector3() });
  }

  // ground rings
  V.rings = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uR: { value: 1 }, uW: { value: 0.5 }, uOuter: { value: 1 }, uAlpha: { value: 1 },
        uColor: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() },
      },
      vertexShader: RING_VERT, fragmentShader: RING_FRAG,
      transparent: true, depthWrite: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 4;
    scene.add(m);
    V.rings.push({ m, life: 0, max: 1, r0: 0, r1: 1, w: 0.5, a: 1 });
  }

  // impact panel: opaque, no depth, drawn after the world and before the player's group
  const quad = new THREE.PlaneGeometry(1, 1);
  V.impact = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uSeed: { value: 0 },
      uBg: { value: new THREE.Color() }, uDot: { value: new THREE.Color() }, uLine: { value: new THREE.Color() },
    },
    vertexShader: SCREEN_VERT, fragmentShader: IMPACT_FRAG, depthTest: false, depthWrite: false, fog: false,
  }));
  V.impact.frustumCulled = false;
  V.impact.renderOrder = 9;
  V.impact.visible = false;
  V.impactLeft = 0;
  V.impactUntil = 0;
  V.impact.onAfterRender = () => {
    // frame-counted (and >= 35 ms), so it holds through a hit-stop and in stepped captures
    V.impactLeft--;
    if (V.impactLeft <= 0 && performance.now() >= V.impactUntil) {
      V.impact.visible = false;
      if (game.city && game.city.skyline) game.city.skyline.visible = true;
    }
  };
  scene.add(V.impact);

  V.lines = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: { uAspect: { value: 1 }, uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: SCREEN_VERT, fragmentShader: LINES_FRAG,
    transparent: true, depthTest: false, depthWrite: false, fog: false,
  }));
  V.lines.frustumCulled = false;
  V.lines.renderOrder = 29;
  V.lines.visible = false;
  V.linesTarget = 0;
  scene.add(V.lines);
  return V;
}

// ------------------------------------------------------------------ spawners
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Outlined toon rubble. opts: { n, colors, force, size, floor, delay, scroll } */
export function chunkBurst(pos, o = {}) {
  if (!V) return;
  const n = o.n ?? 10, f = o.force ?? 7, size = o.size ?? 0.26;
  const colors = o.colors || [0xa8a3b5, 0xc9c3d6, 0x7d778c];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283;
    const s = size * rnd(0.55, 1.35);
    V.chunks.spawn(pos.x + Math.cos(a) * 0.3, pos.y + rnd(-0.2, 0.3), pos.z + Math.sin(a) * 0.3,
      Math.cos(a) * f * rnd(0.3, 0.8), f * rnd(0.55, 1.15), Math.sin(a) * f * rnd(0.3, 0.8) + (o.vz ?? 0),
      rnd(0.8, 1.15), s, s, pick(colors),
      { grav: 26, drag: 0.4, spin: 16, floor: o.floor ?? 0, delay: (o.delay || 0) + rnd(0, 0.03), scroll: o.scroll });
  }
}

/** Outlined toon dust puffs. opts: { n, color(s), ring, size, rise, floor, life } */
export function puffBurst(pos, o = {}) {
  if (!V) return;
  const n = o.n ?? 6, size = o.size ?? 0.45;
  const colors = o.colors || [0xe9e1d3, 0xd8cfbf];
  for (let i = 0; i < n; i++) {
    const a = o.ring ? (i / n) * 6.283 + rnd(-0.2, 0.2) : Math.random() * 6.283;
    const sp = o.speed ?? 3;
    const r = o.ring ? (o.radius ?? 0.4) : rnd(0, 0.3);
    V.puffs.spawn(pos.x + Math.cos(a) * r, pos.y, pos.z + Math.sin(a) * r * 0.8,
      Math.cos(a) * sp * rnd(0.7, 1.2), (o.rise ?? 1.2) * rnd(0.6, 1.3), Math.sin(a) * sp * rnd(0.7, 1.2) * 0.8 + (o.vz ?? 0),
      (o.life ?? 0.55) * rnd(0.8, 1.2), size * 0.35, size * rnd(0.8, 1.2), pick(colors),
      { drag: o.drag ?? 4, spin: 2, delay: o.delay || 0, scroll: o.scroll, floor: o.floor ?? -100 });
  }
}

/** Streak sparks. opts: { n, colors, speed, up, spread, life, width, stretch, vz, scroll } */
export function sparkBurst(pos, o = {}) {
  if (!V) return;
  const n = o.n ?? 12, sp = o.speed ?? 8;
  const colors = o.colors || [0xffd23a, 0xffffff];
  for (let i = 0; i < n; i++) {
    _v.set(rnd(-1, 1), rnd(-0.3, 1) + (o.up ?? 0.4), rnd(-1, 1) * (o.flat ?? 1)).normalize().multiplyScalar(sp * rnd(0.5, 1.2));
    V.sparks.spawn(pos.x, pos.y, pos.z, _v.x + (o.vx ?? 0), _v.y, _v.z + (o.vz ?? 0),
      (o.life ?? 0.32) * rnd(0.7, 1.2), o.width ?? 0.07, o.stretch ?? 0.04, pick(colors),
      { grav: o.grav ?? 14, drag: 1.5, delay: o.delay || 0, scroll: o.scroll });
  }
}

/** One spark with an exact velocity (rail sparks). */
export function spark(x, y, z, vx, vy, vz, life, width, hex, scroll = true) {
  if (V) V.sparks.spawn(x, y, z, vx, vy, vz, life, width, 0.035, hex, { grav: 10, drag: 1, scroll });
}

function sizeAt(x, y, z, frac) {
  const cam = V.camera;
  const dist = cam.position.distanceTo(_v.set(x, y, z));
  const visW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
  return Math.min(visW * frac, 3.2);
}

function takeSprite(sticker) {
  let best = null;
  for (const s of V.sprites) if (s.sticker === sticker && (!best || s.life < best.life)) best = s;
  return best;
}

/** Onomatopoeia sticker. opts: { width (screen fraction), life, scroll, follow (Object3D), tilt } */
export function sticker(key, pos, o = {}) {
  if (!V || !V.stickers[key]) return;
  const s = takeSprite(true);
  s.sp.material.map = V.stickers[key];
  s.sp.material.opacity = 1;
  s.sp.position.copy(pos);
  s.follow = o.follow || null;
  if (s.follow) s.off.copy(pos);
  s.s = sizeAt(pos.x, pos.y, pos.z, o.width ?? 0.36);
  s.rot = o.tilt ?? rnd(-0.22, 0.22);
  s.life = s.max = o.life ?? 0.8;
  s.scroll = false; // screen-stable: a sticker never slides toward the lens
  s.kind = 0;
  s.sp.visible = true;
}

/** Flat sprite pop. kind: 'halftone' | 'star' | 'heart' | 'ring' | 'glow'. opts: { color, size, grow, life, spin, additive, follow } */
export function burst(kind, pos, o = {}) {
  if (!V) return;
  const s = takeSprite(false);
  const m = s.sp.material;
  m.map = V[kind] || V.halftone;
  m.color.set(o.color ?? 0xffffff);
  m.blending = o.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.depthTest = o.depthTest !== false;
  s.sp.renderOrder = o.depthTest === false ? 28 : 12;
  s.sp.position.copy(pos);
  s.follow = o.follow || null;
  if (s.follow) s.off.copy(pos);
  s.s = o.size ?? 1.5;
  s.s1 = o.grow ?? 2.2;
  s.a = o.alpha ?? 1;
  s.rot = Math.random() * 6.28;
  s.spin = o.spin ?? 0;
  s.life = s.max = o.life ?? 0.4;
  s.scroll = o.scroll === true && !s.follow;
  s.kind = 1;
  s.sp.visible = true;
}

/** Ink-edged ring sliding over the ground. opts: { r0, r1, width, life, color, edge, alpha } */
export function groundRing(pos, o = {}) {
  if (!V) return;
  let r = V.rings[0];
  for (const x of V.rings) if (x.life < r.life) r = x;
  r.m.position.set(pos.x, pos.y + 0.03, pos.z);
  r.r0 = o.r0 ?? 0.3; r.r1 = o.r1 ?? 4; r.w = o.width ?? 0.45; r.a = o.alpha ?? 1;
  r.life = r.max = o.life ?? 0.45;
  r.scroll = o.scroll === true; // centred on the hero by default
  r.m.material.uniforms.uColor.value.set(o.color ?? 0xffffff);
  r.m.material.uniforms.uEdge.value.set(o.edge ?? 0xffffff);
  r.m.visible = true;
  updateRing(r, 0);
}

function updateRing(r, dt) {
  r.life -= dt;
  if (r.life <= 0) { r.m.visible = false; return; }
  const t = 1 - r.life / r.max;
  const R = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) ** 2.4);
  const W = r.w * (1 - 0.5 * t);
  const outer = R + 0.1;
  const u = r.m.material.uniforms;
  u.uR.value = R; u.uW.value = W; u.uOuter.value = outer;
  u.uAlpha.value = r.a * Math.min(1, (1 - t) * 3);
  r.m.scale.set(outer, 1, outer);
}

/** A flat comic panel behind the hero for ~2 frames. opts: { at (world pos), bg, dot, line } */
export function impactFrame(o = {}) {
  if (!V) return;
  const u = V.impact.material.uniforms;
  const cam = V.camera;
  if (o.at) {
    cam.updateMatrixWorld();
    _v.copy(o.at).project(cam);
    u.uCenter.value.set(_v.x, _v.y);
  } else u.uCenter.value.set(0, 0);
  u.uAspect.value = cam.aspect;
  u.uSeed.value = Math.random() * 100;
  u.uBg.value.set(o.bg ?? 0xfff2c4);
  u.uDot.value.set(o.dot ?? 0xf2c46b);
  u.uLine.value.set(o.line ?? INK);
  V.impactLeft = o.frames ?? 2;
  V.impactUntil = performance.now() + (o.ms ?? 35);
  V.impact.visible = true;
  // the skyline backdrop is transparent (drawn after the panel): hide it under the panel
  if (game.city && game.city.skyline) game.city.skyline.visible = false;
}

/** Thin white speed lines at the screen edges; alpha 0 fades them out. */
export function edgeLines(alpha) {
  if (V) V.linesTarget = alpha;
}

export function hitStop(seconds) {
  if (game.hitStop) game.hitStop(seconds);
}

/** Camera dolly punch: + pushes in toward the hero, - knocks it back; springs home. */
export function kick(metres) {
  if (V && V.cameraRig.kick) V.cameraRig.kick(metres);
}

// fx.js skips events marked quiet (only the sound plays)
export function sfx(name, detail = {}) {
  emit(name, { ...detail, quiet: true });
}

// ------------------------------------------------------------------ per-frame
export function updateVfx(dt) {
  if (!V) return;
  V.time += dt;
  const running = game.state.mode === 'running' && !game.halted;
  const dz = running ? (game.state.speed || 0) * dt : 0;
  V.chunks.update(dt, dz);
  V.puffs.update(dt, dz);
  V.sparks.update(dt, dz);
  for (const r of V.rings) {
    if (!r.m.visible) continue;
    if (r.scroll) r.m.position.z += dz;
    updateRing(r, dt);
  }
  for (const s of V.sprites) {
    if (!s.sp.visible) continue;
    s.life -= dt;
    if (s.life <= 0) { s.sp.visible = false; s.follow = null; continue; }
    const t = 1 - s.life / s.max;
    if (s.follow) s.sp.position.copy(s.off).add(s.follow.position);
    else if (s.scroll) s.sp.position.z += dz;
    const m = s.sp.material;
    if (s.kind === 0) {
      // sticker: overshoot pop, hold with a little wobble, snap shut
      const age = s.max - s.life;
      let k = age < 0.07 ? (age / 0.07) * 1.3 : age < 0.16 ? 1.3 - ((age - 0.07) / 0.09) * 0.3 : 1;
      if (s.life < 0.12) k *= s.life / 0.12;
      s.sp.scale.set(s.s * k, s.s * k * 0.5, 1);
      m.rotation = s.rot + Math.sin(age * 22) * 0.04 * Math.max(0, 1 - age * 3);
    } else {
      const k = s.s + (s.s1 - s.s) * (1 - (1 - t) ** 3);
      s.sp.scale.set(k, k, 1);
      s.rot += s.spin * dt;
      m.rotation = s.rot;
      m.opacity = s.a * (1 - t * t);
    }
  }
  // edge lines
  const L = V.lines;
  const u = L.material.uniforms;
  u.uAlpha.value += (V.linesTarget - u.uAlpha.value) * Math.min(1, dt * 8);
  u.uTime.value += dt;
  u.uAspect.value = V.camera.aspect;
  L.visible = u.uAlpha.value > 0.02;
}

export function resetVfx() {
  if (!V) return;
  V.chunks.clear();
  V.puffs.clear();
  V.sparks.clear();
  for (const r of V.rings) { r.life = 0; r.m.visible = false; }
  for (const s of V.sprites) { s.life = 0; s.sp.visible = false; s.follow = null; }
  V.impact.visible = false;
  if (game.city && game.city.skyline) game.city.skyline.visible = true;
  V.linesTarget = 0;
  V.lines.material.uniforms.uAlpha.value = 0;
  V.lines.visible = false;
}

// ------------------------------------------------------------------ character helpers
/**
 * Sibling copies of every opaque mesh of a character model, drawn with `material` (a ghost,
 * an energy overlay ...). Same geometry, same parent and local transform, so they follow the
 * animation. Returns { meshes, originals, setVisible(on), sync() }. Built at load only.
 */
export function ghostLayer(model, material) {
  const originals = [];
  model.root.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline && !o.userData.vfx && o.name !== 'xray' && !o.material.transparent && o.geometry.attributes.normal) originals.push(o);
  });
  const meshes = originals.map((o) => {
    const g = new THREE.Mesh(o.geometry, material);
    g.userData.vfx = true;
    g.userData.isOutline = true; // keeps xray.js from giving it an x-ray twin
    g.raycast = () => {};
    g.visible = false;
    g.renderOrder = o.renderOrder;
    o.parent.add(g);
    return g;
  });
  return {
    meshes,
    originals,
    on: false,
    setVisible(on) {
      if (on === this.on) return;
      this.on = on;
      for (const m of meshes) m.visible = on;
      if (on) this.sync();
    },
    sync() {
      for (let i = 0; i < meshes.length; i++) {
        const o = originals[i], m = meshes[i];
        m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
      }
    },
  };
}

const GHOST_VERT = /* glsl */`
uniform vec3 uOffset;
uniform float uPush;
varying float vRim;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.xyz += uOffset;
  vec4 mv = viewMatrix * curveWorld(w);
  vRim = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
  mv.xyz += normalize(mv.xyz) * uPush; // pushed away from the camera: hidden where the hero is
  gl_Position = projectionMatrix * mv;
}`;
const GHOST_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
varying float vRim;
void main() { gl_FragColor = vec4(mix(uColor, uColor * 0.55, step(0.62, vRim)), uAlpha); }`;

/** Flat-colour ghost material (world-space offset, depth push). */
export function ghostMaterial(color, alpha = 0.6, push = 0.25) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOffset: { value: new THREE.Vector3() }, uPush: { value: push },
      uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha },
    },
    vertexShader: GHOST_VERT, fragmentShader: GHOST_FRAG,
    transparent: true, depthWrite: false, fog: false,
  });
}

/** Joints of a createSpiderCharacter model, found from its hand marker (models expose only the hand). */
export function rigOf(model) {
  const hand = model && model.hand;
  const elbowR = hand && hand.parent;
  const shoulderR = elbowR && elbowR.parent;
  const spine = shoulderR && shoulderR.parent;
  const pelvis = spine && spine.parent;
  if (!pelvis) return null;
  const groups = (p) => p.children.filter((c) => c.isGroup || (c.isObject3D && !c.isMesh && c.children.length));
  const shoulderL = groups(spine).find((c) => c !== shoulderR && c.position.x < -0.02);
  const elbowL = shoulderL && groups(shoulderL)[0];
  const hips = groups(pelvis).filter((c) => c !== spine && Math.abs(c.position.x) > 0.01).sort((a, b) => a.position.x - b.position.x);
  const knees = hips.map((h) => groups(h)[0]);
  if (!shoulderL || !elbowL || hips.length < 2 || !knees[0] || !knees[1]) return null;
  return { hand, elbowR, shoulderR, shoulderL, elbowL, spine, pelvis, hipL: hips[0], hipR: hips[1], kneeL: knees[0], kneeR: knees[1] };
}

// ------------------------------------------------------------------ compatibility API
/**
 * Bursts an obstacle into pooled toon rubble + sparks (no allocation, no lights).
 *   shatterObstacle(scene, position, accentColor)
 *   shatterObstacle(scene, obstacle, options{ color, emissive, sparkColor, blastForce })
 */
export function shatterObstacle(scene, posOrObstacle, accentOrOptions = {}) {
  if (!V || !posOrObstacle) return;
  const ob = posOrObstacle;
  const isObstacle = !!ob.parts;
  const o = typeof accentOrOptions === 'object' && accentOrOptions ? accentOrOptions : {};
  const accent = typeof accentOrOptions === 'number' || typeof accentOrOptions === 'string' ? accentOrOptions : (o.emissive ?? o.color ?? 0xffd23a);
  const y = isObstacle ? (ob.parts[0] ? (ob.parts[0].y0 + ob.parts[0].y1) * 0.5 : 1) : (ob.y ?? 1);
  _v.set(ob.x || 0, y, isObstacle ? (ob.z || 0) - (ob.length || 0) * 0.5 : (ob.z || 0));
  const p = { x: _v.x, y: _v.y, z: _v.z };
  const f = (o.blastForce ?? 9) * 0.75;
  chunkBurst(p, { n: 9, force: f, colors: [o.color ?? 0xa8a3b5, accent, 0xc9c3d6] });
  const sc = typeof o.sparkColor === 'string' ? new THREE.Color(o.sparkColor).getHex() : (o.sparkColor ?? accent);
  sparkBurst(p, { n: 8, speed: f, colors: [sc, 0xffffff] });
  puffBurst(p, { n: 3, size: 0.7, speed: 2 });
}

/** Kept for the old call sites: the pools update in updateVfx(). */
export function updateShatterDebris(dt) {
  updateVfx(dt);
}

/** Former PointLight burst: now a pooled additive glow sprite (the light count never changes). */
export function triggerFlashLight(scene, position, color = 0xffffff, intensity = 5.0, duration = 0.4) {
  if (!V || !position) return null;
  burst('glow', { x: position.x, y: position.y ?? 1, z: position.z ?? 0 },
    { color, size: 0.6 + intensity * 0.12, grow: 1.4 + intensity * 0.3, life: duration, additive: true, alpha: 0.85 });
  return null;
}

let activeFovTween = null;

export function triggerCameraFov(camera, targetFov, duration = 0.35, onComplete = null) {
  if (!camera) return;
  activeFovTween = { camera, startFov: camera.fov, targetFov, duration, elapsed: 0, onComplete };
}

export function updateCameraFov(dt) {
  if (!activeFovTween) return;
  const tw = activeFovTween;
  tw.elapsed += dt;
  const t = Math.min(1.0, tw.elapsed / tw.duration);
  tw.camera.fov = THREE.MathUtils.lerp(tw.startFov, tw.targetFov, 1 - Math.pow(1 - t, 3));
  tw.camera.updateProjectionMatrix();
  if (t >= 1.0) {
    activeFovTween = null;
    if (tw.onComplete) tw.onComplete();
  }
}

export function triggerCameraShake(cameraRig, strength = 0.35, duration = 0.35) {
  if (cameraRig && typeof cameraRig.shake === 'function') cameraRig.shake(strength, duration);
}
