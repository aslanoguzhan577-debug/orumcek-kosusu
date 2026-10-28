// fx.js (G11) — comic-book effects. Subscribes to game events only; never touches game
// logic or game.state.
//
//   import { initFx } from './fx.js';  initFx(game);   // after game.scene/camera/cameraRig exist
//
// Parts
//   * two pooled THREE.Points systems (normal + additive): dust, sparks, debris, rings,
//     nano swirl. Fixed pools, custom shader (soft AA discs / 4-point stars / squares /
//     rings with an ink outline), no per-frame allocation. 2 draw calls while anything is alive.
//   * a pool of 5 comic text sprites (GÜM! ÇAT! FİŞŞ! ...) with prebuilt canvas textures.
//   * one forward shockwave ring mesh (ironSave).
//   * DOM layers (created here, styled in ui.css): speed lines, venom vignette, colour flash,
//     black "caught" splash.
// The effects run on their own rAF loop so they keep animating in 'over' mode (game systems
// only update while running). World-space effects scroll with the world only while running.
// prefers-reduced-motion: much weaker shake / flashes, no speed lines.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { events } from './events.js';

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHAKE_K = reduceMotion ? 0.25 : 1;
const FLASH_K = reduceMotion ? 0.35 : 1;

const SHAPE = { puff: 0, star: 1, square: 2, ring: 3 };

// ---------- particle system ----------
const VERT = /* glsl */`
attribute vec4 aColor;
attribute float aSize;
attribute float aShape;
attribute float aRot;
uniform float uScale;
varying vec4 vColor;
varying float vShape;
varying float vRot;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 420.0);
  if (aSize <= 0.0 || aColor.a <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }
  vColor = aColor; vShape = aShape; vRot = aRot;
}`;
const FRAG = /* glsl */`
precision mediump float;
uniform float uOutline;
varying vec4 vColor;
varying float vShape;
varying float vRot;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p;
  float edge;
  float ink = 0.0;
  vec3 col = vColor.rgb;
  if (vShape < 0.5) {            // puff
    edge = length(p) - 0.96;
    ink = smoothstep(-0.28, -0.2, edge);
  } else if (vShape < 1.5) {     // 4-point sparkle
    float k = sqrt(abs(p.x)) + sqrt(abs(p.y));
    edge = (k - 1.0) * 0.5;
    col = mix(vec3(1.0), col, smoothstep(-0.32, -0.05, edge));
  } else if (vShape < 2.5) {     // debris square
    edge = max(abs(p.x), abs(p.y)) - 0.72;
    ink = smoothstep(-0.34, -0.26, edge);
  } else {                       // ring
    float d = length(p);
    edge = max(d - 0.97, 0.74 - d);
  }
  float w = max(fwidth(edge), 0.001);
  float a = clamp(0.5 - edge / w, 0.0, 1.0) * vColor.a;
  if (a <= 0.003) discard;
  col = mix(col, vec3(0.05, 0.05, 0.09), ink * uOutline);
  gl_FragColor = vec4(col, a);
}`;

class Particles {
  constructor(n, { additive, reserved = 0 }) {
    this.n = n;
    this.reserved = reserved;   // indices [0, reserved) are kept for orbiting particles
    this.head = reserved;
    this.dirty = false;
    this.alive = 0;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.size = new Float32Array(n);
    this.shape = new Float32Array(n);
    this.rot = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.delay = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.a0 = new Float32Array(n);
    this.spin = new Float32Array(n);
    this.scroll = new Uint8Array(n);
    this.mode = new Uint8Array(n);       // 0 free, 1 orbit
    this.orb = new Float32Array(n * 4);  // angle, radius, phase, omega

    const g = new THREE.BufferGeometry();
    const dyn = (arr, k) => new THREE.BufferAttribute(arr, k).setUsage(THREE.DynamicDrawUsage);
    this.attrs = [dyn(this.pos, 3), dyn(this.col, 4), dyn(this.size, 1), dyn(this.shape, 1), dyn(this.rot, 1)];
    g.setAttribute('position', this.attrs[0]);
    g.setAttribute('aColor', this.attrs[1]);
    g.setAttribute('aSize', this.attrs[2]);
    g.setAttribute('aShape', this.attrs[3]);
    g.setAttribute('aRot', this.attrs[4]);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uOutline: { value: additive ? 0 : 1 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = additive ? 6 : 5;
    this.points.name = additive ? 'fx-additive' : 'fx-normal';
  }

  // Returns the particle index.
  spawn(x, y, z, vx, vy, vz, life, s0, s1, shape, hex, a0 = 1, grav = 0, drag = 0, scroll = true, delay = 0, spin = 0) {
    const i = this.head;
    this.head = this.head + 1 >= this.n ? this.reserved : this.head + 1;
    return this._set(i, x, y, z, vx, vy, vz, life, s0, s1, shape, hex, a0, grav, drag, scroll, delay, spin);
  }

  _set(i, x, y, z, vx, vy, vz, life, s0, s1, shape, hex, a0, grav, drag, scroll, delay, spin) {
    // raw sRGB values: the shader writes them straight to the sRGB framebuffer
    const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = 0;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.delay[i] = delay;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.a0[i] = a0;
    this.size[i] = delay > 0 ? 0 : s0;
    this.shape[i] = shape;
    this.rot[i] = Math.random() * 6.283;
    this.spin[i] = spin;
    this.scroll[i] = scroll ? 1 : 0;
    this.mode[i] = 0;
    this.dirty = true;
    return i;
  }

  kill(i) {
    this.life[i] = 0;
    this.size[i] = 0;
    this.col[i * 4 + 3] = 0;
    this.mode[i] = 0;
    this.dirty = true;
  }

  clear() {
    for (let i = 0; i < this.n; i++) if (this.life[i] > 0) this.kill(i);
  }

  update(dt, dz, px, py, time) {
    let alive = 0;
    const { pos, vel, life, maxLife, col, size } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      alive++;
      const k = i * 3;
      if (this.delay[i] > 0) {
        this.delay[i] -= dt;
        if (this.scroll[i]) pos[k + 2] += dz;
        if (this.delay[i] > 0) continue;
        this.delay[i] = 0;
      }
      let t = 0;
      if (this.mode[i] === 1) {
        // orbiting nano swirl around the player
        const o = i * 4;
        this.orb[o] += this.orb[o + 3] * dt;
        const a = this.orb[o];
        const r = this.orb[o + 1];
        const h = ((this.orb[o + 2] + time * 0.55) % 1) * 1.75;
        pos[k] = px + Math.cos(a) * r;
        pos[k + 1] = py + 0.05 + h;
        pos[k + 2] = Math.sin(a) * r * 0.8;
        const fade = Math.min(1, h / 0.25, (1.75 - h) / 0.35);
        col[i * 4 + 3] = this.a0[i] * Math.max(0, fade);
        size[i] = this.s0[i];
      } else {
        life[i] -= dt;
        if (life[i] <= 0) { this.kill(i); continue; }
        t = 1 - life[i] / maxLife[i];
        const dr = 1 - Math.min(0.95, this.drag[i] * dt);
        vel[k] *= dr; vel[k + 1] = vel[k + 1] * dr - this.grav[i] * dt; vel[k + 2] *= dr;
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt + (this.scroll[i] ? dz : 0);
        const e = 1 - (1 - t) * (1 - t);
        size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * e;
        const fadeOut = 1 - t;
        col[i * 4 + 3] = this.a0[i] * Math.min(1, t * 14 + 0.25) * fadeOut * Math.sqrt(fadeOut);
        this.rot[i] += this.spin[i] * dt;
      }
    }
    this.alive = alive;
    this.points.visible = alive > 0;
    if (alive > 0 || this.dirty) {
      for (const a of this.attrs) a.needsUpdate = true;
      this.dirty = alive > 0;
    }
  }
}

// ---------- comic text sprites ----------
const WORDS = {
  gum:   { t: 'GÜM!',   burst: '#ffd23a', fill: '#e0262c' },
  cat:   { t: 'ÇAT!',   burst: '#ffffff', fill: '#1a3cb0' },
  bam:   { t: 'BAM!',   burst: '#ff9f1c', fill: '#ffffff' },
  pat:   { t: 'PAT!',   burst: '#ffffff', fill: '#e0262c' },
  fiss:  { t: 'FİŞŞ!',  burst: null,      fill: '#ffffff', stroke: '#1a3cb0' },
  parca: { t: 'PARAMPARÇA!', burst: '#ff9f1c', fill: '#ffffff' },
  nano:  { t: 'NANO!',  burst: '#ffd23a', fill: '#1a3cb0' },
};
const FONT = "'Bangers', Impact, 'Arial Black', sans-serif";

function drawWord(canvas, def, seed) {
  const W = canvas.width, H = canvas.height;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  let rnd = seed;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  if (def.burst) {
    const cx = W / 2, cy = H / 2, n = 20;
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const outer = i % 2 === 0;
      const rr = outer ? (0.9 + rand() * 0.1) : 0.62 + rand() * 0.06;
      const x = cx + Math.cos(a) * rr * W * 0.5;
      const y = cy + Math.sin(a) * rr * H * 0.5;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = def.burst;
    g.strokeStyle = '#0d0d14';
    g.lineWidth = 16;
    g.fill();
    g.stroke();
  }
  let size = def.burst ? 150 : 170;
  const maxW = def.burst ? W * 0.62 : W * 0.9;
  g.font = `${size}px ${FONT}`;
  const w = g.measureText(def.t).width;
  if (w > maxW) { size = Math.floor(size * maxW / w); g.font = `${size}px ${FONT}`; }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(W / 2, H / 2 + size * 0.04);
  g.rotate(-0.08);
  g.lineWidth = Math.max(10, size * 0.14);
  g.strokeStyle = def.stroke || '#0d0d14';
  g.strokeText(def.t, 0, 0);
  if (def.stroke) { // double stroke: ink outside, colour inside
    g.lineWidth = Math.max(10, size * 0.14) * 1.9;
    g.strokeStyle = '#0d0d14';
    g.globalCompositeOperation = 'destination-over';
    g.strokeText(def.t, 0, 0);
    g.globalCompositeOperation = 'source-over';
  }
  g.fillStyle = def.fill;
  g.fillText(def.t, 0, 0);
  g.restore();
}

// ---------- DOM layers ----------
// Pre-rendered speed-line image (tapered wedges from the screen edge inwards, centre clear).
function makeSpeedLines() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.translate(S / 2, S / 2);
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = S * (0.3 + rand() * 0.14);
    const r1 = S * (0.62 + rand() * 0.1);
    const w = 0.012 + rand() * 0.03;
    g.fillStyle = `rgba(255,255,255,${0.45 + rand() * 0.5})`;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a - w) * r1, Math.sin(a - w) * r1);
    g.lineTo(Math.cos(a + w) * r1, Math.sin(a + w) * r1);
    g.closePath();
    g.fill();
  }
  return c.toDataURL('image/png');
}

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

function createDom() {
  const ui = document.getElementById('ui') || document.body;
  const root = el('div', 'fx');
  root.setAttribute('aria-hidden', 'true');
  const speed = el('div', 'fx-speed', root);
  const venom = el('div', 'fx-venom', root);
  const flash = el('div', 'fx-flash', root);
  const splash = el('div', 'fx-splash', root);
  const blobs = [[18, 30, .00], [78, 22, .05], [50, 55, .10], [12, 78, .14], [88, 72, .18], [50, 12, .22], [30, 95, .26]];
  for (const [x, y, d] of blobs) {
    const b = el('i', '', splash);
    b.style.left = x + '%';
    b.style.top = y + '%';
    b.style.setProperty('--d', d + 's');
    b.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg');
  }
  speed.style.backgroundImage = `url(${makeSpeedLines()})`;
  speed.hidden = venom.hidden = splash.hidden = true;
  if (ui.firstChild) ui.insertBefore(root, ui.firstChild); else ui.appendChild(root);
  return { root, speed, venom, flash, splash };
}

// ---------- init ----------
export function initFx(game) {
  const scene = game.scene;
  const camera = game.camera;
  const dom = createDom();

  const normal = new Particles(360, { additive: false });
  const glow = new Particles(300, { additive: true, reserved: 28 });
  scene.add(normal.points, glow.points);
  const systems = [normal, glow];

  // ----- text sprites -----
  const wordTex = {};
  const buildTextures = () => {
    let seed = 7;
    for (const key in WORDS) {
      let tex = wordTex[key];
      if (!tex) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 384;
        tex = wordTex[key] = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      drawWord(tex.image, WORDS[key], seed += 977);
      tex.needsUpdate = true;
    }
  };
  buildTextures();
  if (document.fonts && document.fonts.load) {
    document.fonts.load("64px 'Bangers'", 'GÜMÇŞİ').then(buildTextures, () => {});
  }

  const texts = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 10;
    sprite.name = 'fx-text';
    scene.add(sprite);
    texts.push({ sprite, active: false, t: 0, life: 0.8, baseW: 1, aspect: 0.75, scroll: true, vy: 0 });
  }
  let textHead = 0;
  const _v = new THREE.Vector3();
  function showText(key, x, y, z, widthFrac, life = 0.8, scroll = true) {
    const s = texts[textHead];
    textHead = (textHead + 1) % texts.length;
    s.sprite.material.map = wordTex[key];
    s.sprite.material.rotation = (Math.random() - 0.5) * 0.35;
    s.sprite.position.set(x, y, z);
    // size relative to what the camera sees at that distance, so it fits any screen
    _v.set(x, y, z);
    const dist = camera.position.distanceTo(_v);
    const visW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect;
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    s.baseW = Math.min(visW * widthFrac, visH * 0.45, 7);
    s.aspect = 0.75;
    s.t = 0; s.life = life; s.scroll = scroll; s.active = true;
    s.sprite.visible = true;
    s.sprite.material.opacity = 1;
    s.sprite.scale.set(0.01, 0.01, 1);
  }

  // ----- shockwave ring (ironSave) -----
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc83a, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56), ringMat);
  ring.visible = false;
  ring.renderOrder = 7;
  ring.frustumCulled = false;
  scene.add(ring);
  let ringT = -1;
  const RING_TIME = 0.65;

  // ----- DOM helpers -----
  const flashColors = {
    gold: 'radial-gradient(circle at 50% 55%, rgba(255,240,150,.95), rgba(255,170,30,.8) 40%, rgba(224,38,44,.75))',
    white: 'radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,.55))',
    red: 'radial-gradient(circle, rgba(255,60,60,.7), rgba(120,0,10,.7))',
  };
  function flash(kind, alpha, ms) {
    const f = dom.flash;
    f.style.background = flashColors[kind];
    if (f.animate) {
      f.animate([{ opacity: 0 }, { opacity: alpha * FLASH_K, offset: 0.18 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
    }
  }
  let splashTimer = 0;
  function splashOn() {
    clearTimeout(splashTimer);
    dom.splash.hidden = false;
    dom.splash.classList.remove('on', 'off');
    void dom.splash.offsetWidth;
    dom.splash.classList.add('on');
  }
  function splashOff() {
    if (dom.splash.hidden) return;
    dom.splash.classList.remove('on');
    dom.splash.classList.add('off');
    clearTimeout(splashTimer);
    splashTimer = setTimeout(() => { dom.splash.hidden = true; dom.splash.classList.remove('off'); }, 320);
  }
  const shake = (s, sec) => {
    if (game.cameraRig && game.cameraRig.shake) game.cameraRig.shake(s * SHAKE_K, sec);
  };

  // ----- helpers -----
  const rnd = (a, b) => a + Math.random() * (b - a);
  const player = () => game.player;
  const floorY = () => (player().floorY || 0);
  const num = (v, d) => (Number.isFinite(v) ? v : d);

  function posOf(d, fallbackY) {
    const p = d && d.position;
    const pl = player();
    return {
      x: num(p && p.x, pl.x),
      y: num(p && p.y, pl.y + fallbackY),
      z: num(p && p.z, 0),
    };
  }

  function puffBurst(x, y, z, n, hex, spread, up, s0, s1, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(0.4, 1) * spread;
      normal.spawn(x + rnd(-0.1, 0.1), y, z + rnd(-0.1, 0.1),
        Math.cos(a) * sp, rnd(0.2, 1) * up, Math.sin(a) * sp * 0.6,
        rnd(life * 0.7, life), s0, s1, SHAPE.puff, hex, 0.95, -0.6, 3.2, true);
    }
  }
  function sparkBurst(sys, x, y, z, n, colors, speed, size, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(0.5, 1) * speed;
      sys.spawn(x, y, z, Math.cos(a) * sp, Math.sin(a) * sp + speed * 0.25, rnd(-0.4, 0.4) * sp,
        rnd(life * 0.6, life), size, size * 0.15, SHAPE.star, colors[i % colors.length], 1, 0, 3, true, 0, rnd(-6, 6));
    }
  }
  function debris(x, y, z, n, delay) {
    const cols = [0x5d5a62, 0x8d8f98, 0xe0262c, 0xf2f2f2, 0x2b2b33, 0xffb52e];
    for (let i = 0; i < n; i++) {
      normal.spawn(x + rnd(-0.4, 0.4), y + rnd(0, 0.8), z + rnd(-0.3, 0.3),
        rnd(-4.5, 4.5), rnd(2, 7), rnd(-3, 2),
        rnd(0.7, 1.2), rnd(0.18, 0.34), 0.1, SHAPE.square, cols[(Math.random() * cols.length) | 0],
        1, 16, 0.6, true, delay, rnd(-12, 12));
    }
  }

  // ----- event handlers -----
  let slideUntil = 0;
  let slideAcc = 0;
  let simTime = 0;
  let ironActive = false;

  const on = (name, fn) => events.addEventListener(name, (e) => fn(e.detail || {}));

  on('coin', (d) => {
    const p = posOf(d, 1);
    sparkBurst(glow, p.x, p.y, p.z, 7, [0xffd23a, 0xffffff, 0xffb52e], 3.2, 0.34, 0.42);
    glow.spawn(p.x, p.y, p.z, 0, 0, 0, 0.18, 0.9, 1.3, SHAPE.star, 0xfff2a0, 0.9, 0, 0, true, 0, 3);
  });

  on('jump', () => {
    const pl = player();
    puffBurst(pl.x, floorY() + 0.1, 0.1, 4, 0xe9e3d6, 1.4, 0.7, 0.3, 0.6, 0.35);
  });
  on('land', () => {
    const pl = player();
    puffBurst(pl.x, floorY() + 0.1, 0.1, 7, 0xe9e3d6, 2.4, 1.0, 0.45, 0.95, 0.45);
  });
  on('slide', () => { slideUntil = simTime + (CONFIG.slideDuration || 0.7); slideAcc = 0; });

  // Catch cam: crash / 2nd stumble emit their event first and the chaser halts the world
  // right afterwards (same synchronous call). A microtask therefore sees game.halted already
  // set, without waiting a frame. While halted the shot must stay clear: only a few small
  // sparks ahead of the player (where the hit happened), no text, ring, smoke, flash or shake.
  let lastSaveMs = -1e9;
  const microtask = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn);

  function catchSparks(p) {
    sparkBurst(glow, p.x, p.y - 0.2, p.z - 0.7, 6, [0xffd23a, 0xffffff], 3, 0.22, 0.3);
  }

  on('stumble', (d) => {
    const p = posOf(d, 0.8);
    microtask(() => {
      if (game.halted) { catchSparks(p); return; }
      const pl = player();
      const x = pl.x, y = pl.y + 0.8;
      puffBurst(x, y - 0.3, 0.1, 6, 0xf4efe6, 2.8, 1.5, 0.5, 1.1, 0.4);
      sparkBurst(glow, x, y, 0.2, 6, [0xffd23a, 0xffffff], 4.2, 0.36, 0.35);
      showText('pat', x, y + 1.1, 0, 0.3, 0.6, true);
      shake(0.08, 0.22);
    });
  });

  on('crash', (d) => {
    const p = posOf(d, 0.9);
    microtask(() => {
      // Iron Spider absorbed it: ironSave draws its own (bigger) effects
      if (performance.now() - lastSaveMs < 150) return;
      if (game.halted) { catchSparks(p); return; }
      sparkBurst(glow, p.x, p.y, p.z, 18, [0xffd23a, 0xff8a1f, 0xffffff, 0xe0262c], 9, 0.7, 0.65);
      glow.spawn(p.x, p.y, p.z, 0, 0, 0, 0.22, 1.2, 4.2, SHAPE.ring, 0xffe27a, 0.95, 0, 0, true);
      puffBurst(p.x, p.y, p.z, 8, 0x6b6670, 4.5, 2.5, 0.7, 1.6, 0.7);
      debris(p.x, p.y, p.z, 12, 0);
      const key = ['gum', 'cat', 'bam'][(Math.random() * 3) | 0];
      showText(key, p.x, p.y + 2.0, p.z, 0.46, 0.85, true);
      shake(0.4, 0.55);
      flash('white', 0.45, 220);
    });
  });

  on('caught', () => {
    shake(0.1, 0.3);
    splashOn();
  });

  on('pickup', (d) => {
    const pl = player();
    const iron = d.type === 'iron';
    const ringCol = iron ? 0xffd23a : 0x9fd8ff;
    const sparks = iron ? [0xffd23a, 0xe0262c, 0xffffff] : [0xffffff, 0x4aa8ff, 0x9fd8ff];
    const y = pl.y + 0.9;
    glow.spawn(pl.x, y, 0.2, 0, 0, 0, 0.45, 0.6, 3.4, SHAPE.ring, ringCol, 0.95, 0, 0, true);
    glow.spawn(pl.x, y, 0.2, 0, 0, 0, 0.3, 0.3, 2.2, SHAPE.ring, 0xffffff, 0.7, 0, 0, true, 0.07);
    sparkBurst(glow, pl.x, y, 0.2, 10, sparks, 4, 0.4, 0.5);
  });

  on('web', (d) => {
    const pl = player();
    const f = d.from || {};
    const t = d.to || {};
    const fx = num(f.x, pl.x), fy = num(f.y, pl.y + 1), fz = num(f.z, 0);
    const tx = num(t.x, fx), ty = num(t.y, fy + 20), tz = num(t.z, fz);
    showText('fiss', fx + 0.5, fy + 0.7, fz, 0.3, 0.55, true);
    for (let i = 0; i < 10; i++) {
      const k = (i + 1) / 24; // first ~40 % of the line
      glow.spawn(fx + (tx - fx) * k, fy + (ty - fy) * k, fz + (tz - fz) * k,
        rnd(-0.4, 0.4), rnd(-0.2, 0.4), rnd(-0.2, 0.2),
        0.28, 0.4, 0.05, SHAPE.star, i % 2 ? 0xffffff : 0x9fd8ff, 1, 0, 2, true, i * 0.022, rnd(-5, 5));
    }
  });

  function startSwirl() {
    for (let i = 0; i < glow.reserved; i++) {
      const hex = i % 3 === 0 ? 0xe0262c : 0xffd23a;
      glow._set(i, 0, 0, 0, 0, 0, 0, 1e9, 0.2 + (i % 4) * 0.03, 0.2, SHAPE.star, hex, 1, 0, 0, false, 0, 0);
      glow.mode[i] = 1;
      glow.life[i] = 1e9;
      glow.orb[i * 4] = Math.random() * 6.283;
      glow.orb[i * 4 + 1] = rnd(0.55, 0.95);
      glow.orb[i * 4 + 2] = i / glow.reserved;
      glow.orb[i * 4 + 3] = (i % 2 ? 1 : -1) * rnd(4, 7.5);
      glow.col[i * 4 + 3] = 1;
    }
  }
  function stopSwirl() {
    for (let i = 0; i < glow.reserved; i++) if (glow.mode[i] === 1) glow.kill(i);
  }

  on('ironOn', () => {
    const pl = player();
    ironActive = true;
    startSwirl();
    flash('gold', 0.75, 520);
    glow.spawn(pl.x, pl.y + 0.9, 0.2, 0, 0, 0, 0.5, 0.6, 4.5, SHAPE.ring, 0xffd23a, 0.95, 0, 0, true);
    glow.spawn(pl.x, pl.y + 0.9, 0.2, 0, 0, 0, 0.4, 0.4, 3.2, SHAPE.ring, 0xe0262c, 0.85, 0, 0, true, 0.08);
    sparkBurst(glow, pl.x, pl.y + 0.9, 0.2, 12, [0xffd23a, 0xe0262c, 0xffffff], 5, 0.4, 0.5);
    showText('nano', pl.x, pl.y + 2.2, 0, 0.36, 0.7, true);
    shake(0.07, 0.25);
  });
  on('ironOff', () => {
    const pl = player();
    ironActive = false;
    stopSwirl();
    for (let i = 0; i < 18; i++) {
      normal.spawn(pl.x + rnd(-0.5, 0.5), pl.y + rnd(0.2, 1.6), rnd(-0.3, 0.3),
        rnd(-1.6, 1.6), rnd(0, 2.5), rnd(-1, 1),
        rnd(0.9, 1.4), rnd(0.14, 0.26), 0.08, SHAPE.square, i % 3 === 0 ? 0xb01a20 : 0xffc83a,
        1, 6, 0.5, true, 0, rnd(-9, 9));
    }
  });

  on('ironSave', (d) => {
    lastSaveMs = performance.now();
    const pl = player();
    ringT = 0;
    ring.visible = true;
    const list = Array.isArray(d.positions) ? d.positions : [];
    let n = 0;
    let ax = 0, ay = 1.5, az = -6;
    for (const p of list) {
      if (n >= 8) break;
      const x = num(p.x, 0), y = num(p.y, 0.8), z = num(p.z, -6);
      const delay = Math.min(0.55, Math.max(0, -z) / 40);
      debris(x, y, z, 6, delay);
      normal.spawn(x, y + 0.5, z, 0, 0.8, 0, 0.7, 0.8, 2.0, SHAPE.puff, 0x8d8f98, 0.9, -0.5, 2, true, delay);
      sparkBurst(glow, x, y + 0.5, z, 3, [0xffd23a, 0xffffff], 4, 0.42, 0.4);
      if (n === 0) { ax = x; ay = y; az = z; }
      n++;
    }
    showText('parca', num(ax, pl.x), num(ay, 1.2) + 1.8, Math.max(az, -9), 0.5, 1.0, true);
    shake(0.3, 0.5);
    flash('gold', 0.5, 380);
  });

  let venomOn = false;
  on('venomNear', () => { venomOn = true; dom.venom.hidden = false; });
  on('venomFar', () => { venomOn = false; dom.venom.hidden = true; });

  function clearAll() {
    for (const s of systems) s.clear();
    for (const t of texts) { t.active = false; t.sprite.visible = false; }
    ring.visible = false;
    ringT = -1;
    ironActive = false;
    venomOn = false;
    dom.venom.hidden = true;
    slideUntil = 0;
    splashOff();
  }
  on('start', clearAll);
  on('gameover', () => { venomOn = false; dom.venom.hidden = true; });

  // ----- per-frame -----
  let last = performance.now();
  let speedO = -1;
  let speedAcc = 0;
  let raf = 0;
  let prevMode = game.state.mode;
  const dbg = { timeScale: 1 }; // console testing: slow motion

  function tick(now) {
    raf = requestAnimationFrame(tick);
    let dt = (now - last) / 1000;
    last = now;
    if (dt <= 0) return;
    dt = Math.min(dt, 1 / 20) * dbg.timeScale;
    if (document.hidden) return;
    const st = game.state;
    // game.toMenu() emits no event: clear the ink splash, nano swirl, vignette etc. here
    if (st.mode === 'menu' && prevMode !== 'menu') clearAll();
    prevMode = st.mode;
    if (st.mode === 'paused') return;
    const running = st.mode === 'running';
    const dz = running && !game.halted ? st.speed * dt : 0;
    const pl = player();
    simTime += dt;

    // slide dust trail
    if (running && simTime < slideUntil && pl.y <= floorY() + 0.05) {
      slideAcc += dt;
      while (slideAcc > 0.045) {
        slideAcc -= 0.045;
        normal.spawn(pl.x + rnd(-0.2, 0.2), floorY() + 0.1, 0.5, rnd(-0.5, 0.5), rnd(0.3, 0.9), rnd(0.5, 1.5),
          rnd(0.3, 0.45), 0.25, 0.6, SHAPE.puff, 0xe9e3d6, 0.9, -0.4, 2.5, true);
      }
    }

    // pixel scale for point sizes
    // (sizes are also boosted when the portrait camera pulls back, so effects stay readable)
    const pull = THREE.MathUtils.clamp(camera.position.z / CONFIG.camera.distance, 1, 2.2);
    const scale = pull * (game.renderer ? game.renderer.domElement.height : 800) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const s of systems) {
      s.material.uniforms.uScale.value = scale;
      s.update(dt, dz, pl.x, pl.y, simTime);
    }

    // text sprites
    for (const s of texts) {
      if (!s.active) continue;
      s.t += dt;
      const k = s.t / s.life;
      if (k >= 1) { s.active = false; s.sprite.visible = false; continue; }
      let sc;
      if (k < 0.15) { const u = k / 0.15; sc = 0.25 + 1.0 * (1 - (1 - u) * (1 - u)); } // pop in, overshoot
      else if (k < 0.3) sc = 1.25 - 0.25 * ((k - 0.15) / 0.15);
      else sc = 1;
      if (k > 0.72) { const u = (k - 0.72) / 0.28; sc *= 1 - 0.25 * u; s.sprite.material.opacity = 1 - u; }
      s.sprite.scale.set(s.baseW * sc, s.baseW * sc * s.aspect, 1);
      s.sprite.position.y += dt * 0.6;
      if (s.scroll) s.sprite.position.z += dz;
    }

    // shockwave ring
    if (ringT >= 0) {
      ringT += dt;
      const k = ringT / RING_TIME;
      if (k >= 1) { ring.visible = false; ringT = -1; }
      else {
        const e = 1 - (1 - k) * (1 - k);
        ring.position.set(pl.x, pl.y + 0.9, -0.6 - e * 26);
        ring.scale.setScalar(0.8 + e * 9);
        ringMat.opacity = (1 - k) * 0.9;
      }
    }

    // speed lines (cheap: updates the DOM at most ~8x per second, only when the value changes)
    speedAcc += dt;
    if (speedAcc > 0.12) {
      speedAcc = 0;
      let o = 0;
      if (running && !game.halted && !reduceMotion) {
        const k = THREE.MathUtils.clamp((st.speed - CONFIG.startSpeed) / Math.max(1, CONFIG.maxSpeed - CONFIG.startSpeed), 0, 1);
        o = k < 0.06 ? 0 : 0.1 + 0.4 * k * k;
      }
      o = Math.round(o * 40) / 40;
      if (o !== speedO) {
        speedO = o;
        dom.speed.hidden = o <= 0;
        dom.speed.style.opacity = String(o);
      }
    }
  }
  raf = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      scene.remove(normal.points, glow.points, ring);
      for (const t of texts) scene.remove(t.sprite);
      dom.root.remove();
    },
    // for console testing
    _debug: { dbg, normal, glow, texts, dom, get ironActive() { return ironActive; }, get venomOn() { return venomOn; } },
  };
}
