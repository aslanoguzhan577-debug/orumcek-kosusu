// obstacle-art.js — how obstacles and coins look. Every kind is ONE InstancedMesh (plus one
// for its outline), so the draw calls stay the same however many obstacles are on screen.
// obstacles.js calls  art.begin(); art.add(kind, x, y, z, colorIndex); ... art.end(time).
//
// Each geometry has its origin at the middle of its NEAR face (the face toward the player,
// +Z side), on the track surface (y = 0); it extends toward -Z.
// Colours are baked into vertex colours, so all kinds share one toon material.
// Outlines: back-face shells built from slightly enlarged copies of the main shapes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { toonMaterial } from './models/toon.js';
import { laneX } from './world.js';
import { girderOffset } from './patterns.js';

const OUTLINE_T = 0.045;
const OUTLINE_COLOR = 0x15171c;

export const CAR_COLORS = [0xffc933, 0xe8463a, 0x3fb6e8, 0x9a62e0, 0x4cc76a, 0xff8a3d];

const _color = new THREE.Color();

// ---------- geometry helpers ----------

function colorize(geo, hex) {
  _color.setHex(hex);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = _color.r;
    arr[i * 3 + 1] = _color.g;
    arr[i * 3 + 2] = _color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Collects coloured boxes into one geometry, and "hull" boxes into one outline geometry.
class ShapeBuilder {
  constructor() {
    this.parts = [];
    this.hulls = [];
  }

  // Box of size w,h,d centred at x,y,z. opts: { hull: true, visible: true, rx, ry, rz }
  box(w, h, d, x, y, z, color, opts = {}) {
    const hull = opts.hull !== false;
    const visible = opts.visible !== false;
    const place = (g) => {
      if (opts.rx) g.rotateX(opts.rx);
      if (opts.ry) g.rotateY(opts.ry);
      if (opts.rz) g.rotateZ(opts.rz);
      g.translate(x, y, z);
      return g;
    };
    if (visible) this.parts.push(colorize(place(new THREE.BoxGeometry(w, h, d)).toNonIndexed(), color));
    if (hull) {
      const t = OUTLINE_T * 2;
      const g = place(new THREE.BoxGeometry(w + t, h + t, d + t));
      g.deleteAttribute('uv');
      this.hulls.push(g.toNonIndexed());
    }
    return this;
  }

  // Any ready geometry (non-indexed, with position + normal + uv).
  geometry(geo, color) {
    this.parts.push(colorize(geo, color));
    return this;
  }

  hullGeometry(geo) {
    if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
    this.hulls.push(geo);
    return this;
  }

  build() {
    const geometry = mergeGeometries(this.parts);
    const outline = this.hulls.length ? mergeGeometries(this.hulls) : null;
    for (const g of this.parts) g.dispose();
    for (const g of this.hulls) g.dispose();
    return { geometry, outline };
  }
}

// Wedge for ramps: low edge at z = 0, high edge (height h) at z = -len, width w.
function wedge(w, h, len, grow = 0) {
  const x = w / 2 + grow;
  const z0 = grow;
  const z1 = -len - grow;
  const y0 = -grow;
  const y1 = h + grow;
  const n0 = [-x, y0, z0], n1 = [x, y0, z0];
  const f0 = [-x, y0, z1], f1 = [x, y0, z1];
  const t0 = [-x, y1, z1], t1 = [x, y1, z1];
  const tris = [
    n0, n1, t1, n0, t1, t0,   // slope
    f0, t0, t1, f0, t1, f1,   // back
    n0, f0, f1, n0, f1, n1,   // bottom
    n0, t0, f0,               // left
    n1, f1, t1,               // right
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => pos.set(p, i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tris.length * 2), 2));
  geo.computeVertexNormals();
  return geo;
}

// ---------- the shapes ----------

const DARK = 0x3a3d45;

function buildLow() {
  const O = CONFIG.obstacles.low;
  const zc = -O.depth / 2;
  const s = new ShapeBuilder();
  for (const side of [-1, 1]) {
    s.box(0.14, O.height, 0.14, side * 0.8, O.height / 2, zc, DARK);
    s.box(0.45, 0.08, O.depth, side * 0.8, 0.04, zc, DARK);
  }
  // Striped plank (one hull box for the outline, coloured stripes inside)
  const plankH = 0.38;
  const py = O.height - plankH / 2;
  s.box(O.width, plankH, 0.22, 0, py, zc, 0xffffff, { visible: false });
  const n = 5;
  const sw = O.width / n;
  for (let i = 0; i < n; i++) {
    s.box(sw, plankH, 0.22, -O.width / 2 + sw * (i + 0.5), py, zc, i % 2 ? 0xf4f4f4 : 0xe63946, { hull: false });
  }
  return s.build();
}

function buildHigh() {
  const O = CONFIG.obstacles.high;
  const zc = -O.depth / 2;
  const s = new ShapeBuilder();
  for (const side of [-1, 1]) {
    s.box(0.14, O.top, 0.14, side * (O.width / 2 + 0.05), O.top / 2, zc, DARK);
    s.box(0.45, 0.08, O.depth, side * (O.width / 2 + 0.05), 0.04, zc, DARK);
  }
  // Sign board with yellow / black bands; red-white strip marks the bottom edge.
  const h = O.top - O.bottom;
  s.box(O.width, h, 0.16, 0, O.bottom + h / 2, zc, 0xffffff, { visible: false });
  const bands = 5;
  const bh = (h - 0.16) / bands;
  for (let i = 0; i < bands; i++) {
    s.box(O.width, bh, 0.16, 0, O.bottom + 0.16 + bh * (i + 0.5), zc, i % 2 ? 0x22242a : 0xffc93c, { hull: false });
  }
  const n = 6;
  const sw = O.width / n;
  for (let i = 0; i < n; i++) {
    s.box(sw, 0.16, 0.17, -O.width / 2 + sw * (i + 0.5), O.bottom + 0.08, zc, i % 2 ? 0xf4f4f4 : 0xe63946, { hull: false });
  }
  return s.build();
}

// Car body: white so the instance colour tints it. Details are a separate mesh (not tinted).
function buildCarBody() {
  const O = CONFIG.obstacles.car;
  const s = new ShapeBuilder();
  const bodyBottom = 0.25;
  s.box(O.width, O.hoodHeight - bodyBottom, O.length, 0, (O.hoodHeight + bodyBottom) / 2, -O.length / 2, 0xffffff);
  const cabinLen = O.length - O.hood - O.trunk;
  s.box(O.width - 0.16, O.height - O.hoodHeight, cabinLen, 0, (O.height + O.hoodHeight) / 2, -(O.hood + cabinLen / 2), 0xffffff);
  return s.build();
}

function buildCarDetail() {
  const O = CONFIG.obstacles.car;
  const s = new ShapeBuilder();
  const cabinLen = O.length - O.hood - O.trunk;
  const glass = 0x27384f;
  const cabinH = O.height - O.hoodHeight;
  const cy = O.hoodHeight + cabinH / 2;
  // wheels
  for (const sx of [-1, 1]) {
    for (const f of [0.65, O.length - 0.65]) {
      s.box(0.26, 0.42, 0.62, sx * (O.width / 2 - 0.08), 0.21, -f, 0x1b1b1f, { hull: false });
    }
  }
  // windscreen (front, toward the player) and rear window
  s.box(O.width - 0.3, cabinH - 0.1, 0.04, 0, cy, -O.hood + 0.01, glass, { hull: false });
  s.box(O.width - 0.3, cabinH - 0.1, 0.04, 0, cy, -(O.hood + cabinLen) - 0.01, glass, { hull: false });
  // side windows
  for (const sx of [-1, 1]) {
    s.box(0.04, cabinH - 0.12, cabinLen - 0.3, sx * ((O.width - 0.16) / 2 + 0.01), cy, -(O.hood + cabinLen / 2), glass, { hull: false });
  }
  // headlights, grille, bumpers, tail lights
  for (const sx of [-1, 1]) {
    s.box(0.32, 0.16, 0.05, sx * 0.52, 0.6, 0.02, 0xfff3b0, { hull: false });
    s.box(0.3, 0.14, 0.05, sx * 0.52, 0.6, -O.length - 0.02, 0xd8242c, { hull: false });
  }
  s.box(0.5, 0.12, 0.05, 0, 0.6, 0.02, 0x2a2c33, { hull: false });
  s.box(O.width + 0.04, 0.14, 0.12, 0, 0.3, 0.0, 0x9aa1ad, { hull: false });
  s.box(O.width + 0.04, 0.14, 0.12, 0, 0.3, -O.length, 0x9aa1ad, { hull: false });
  return s.build();
}

// One subway car: silver body, blue stripe, windows and doors, cab windows at both ends.
function buildWagon() {
  const O = CONFIG.obstacles.wagon;
  const L = O.length;
  const W = O.width;
  const H = O.height;
  const s = new ShapeBuilder();
  const silver = 0xc5ccd6;
  const glass = 0x253246;
  const bodyBottom = 0.5;
  const roofH = 0.1;

  // bogies + wheels
  for (const f of [1.9, L - 1.9]) {
    s.box(W - 0.35, bodyBottom, 2.4, 0, bodyBottom / 2, -f, 0x2b2e35);
  }
  // body and roof
  s.box(W, H - roofH - bodyBottom, L, 0, bodyBottom + (H - roofH - bodyBottom) / 2, -L / 2, silver);
  s.box(W - 0.2, roofH, L - 0.3, 0, H - roofH / 2, -L / 2, 0xe2e7ee, { hull: false });
  s.box(W - 0.9, 0.12, L * 0.5, 0, H + 0.02, -L / 2, 0xa9b1bc, { hull: false }); // roof vent
  // blue stripe
  s.box(W + 0.04, 0.24, L + 0.02, 0, 1.05, -L / 2, 0x2b59c3, { hull: false });

  // sides: windows and doors
  const sideX = W / 2 + 0.015;
  for (const sx of [-1, 1]) {
    for (const f of [1.0, 3.7, 5.3, 8.0]) {
      s.box(0.04, 0.62, 1.05, sx * sideX, 1.9, -f, glass, { hull: false });
    }
    for (const f of [2.35, 6.65]) {
      s.box(0.04, 1.85, 1.25, sx * sideX, 0.5 + 0.95, -f, 0x8c96a4, { hull: false });
      s.box(0.05, 0.55, 0.45, sx * (sideX + 0.005), 1.9, -f + 0.3, glass, { hull: false });
      s.box(0.05, 0.55, 0.45, sx * (sideX + 0.005), 1.9, -f - 0.3, glass, { hull: false });
    }
  }
  // both ends: cab window, headlights, route sign
  for (const [z, dir] of [[0, 1], [-L, -1]]) {
    const ez = z + dir * 0.02;
    s.box(1.2, 0.75, 0.04, 0, 1.95, ez, glass, { hull: false });
    s.box(0.5, 0.24, 0.05, 0, 2.55, ez, 0xff8c1a, { hull: false });
    for (const sx of [-1, 1]) {
      s.box(0.26, 0.2, 0.05, sx * 0.68, 0.95, ez, 0xfff6c8, { hull: false });
    }
    s.box(W - 0.1, 0.16, 0.08, 0, 0.55, ez, 0x5b616c, { hull: false }); // bumper
  }
  return s.build();
}

function buildRamp() {
  const O = CONFIG.obstacles;
  const W = O.wagon.width - 0.1;
  const H = O.wagon.height;
  const L = O.rampLength;
  const angle = Math.atan2(H, L);
  const slope = Math.hypot(H, L);
  const s = new ShapeBuilder();
  s.geometry(wedge(W, H, L), 0x4a505c);
  s.hullGeometry(wedge(W, H, L, OUTLINE_T));
  // yellow edge strips and dark rungs along the slope
  for (const sx of [-1, 1]) {
    s.box(0.16, 0.06, slope, sx * (W / 2 - 0.08), H / 2 + 0.04, -L / 2, 0xffc93c, { hull: false, rx: angle });
  }
  const rungs = 6;
  for (let i = 0; i < rungs; i++) {
    const t = (i + 0.5) / rungs;
    s.box(W - 0.4, 0.05, 0.14, 0, H * t + 0.03, -L * t, 0x2a2d34, { hull: false, rx: angle });
  }
  return s.build();
}

const INK = 0x15171c, STEEL = 0x3a3d45, YEL = 0xffc93c, BLK = 0x22242a;
const RED = 0xe63946, WHT = 0xf4f4f4, RAIL = 0xc8ced8;

function strip(s, f0, f1, color, w = 7.4, y = 0.075, h = 0.02, x = 0) {
  s.box(w, h, f1 - f0, x, y, -(f0 + f1) / 2, color, { hull: false });
}

function buildGapHole() {
  const s = new ShapeBuilder();
  strip(s, 0, 0.02, INK);
  strip(s, 0.02, 0.55, 0x0d0b12);
  strip(s, 0.55, 0.80, 0x2b2733);
  strip(s, 0.80, 0.94, 0x55505a);
  strip(s, 0.94, 0.985, 0x8d8880);
  strip(s, 0.985, 1, 0xe8e2d4, 7.4, 0.09, 0.03);
  for (let i = 0; i < 8; i++) strip(s, 0.55, 0.985, 0x1a1820, 0.12, 0.078, 0.02, -3.2 + i * 0.914);
  return s.build();
}

function buildGapEnds() {
  const s = new ShapeBuilder();
  for (const sx of [-1, 1]) {
    s.box(0.16, 3.4, 0.16, sx * 3.45, 1.7, 0.3, WHT, { visible: false });
    for (let i = 0; i < 6; i++) s.box(0.16, 0.567, 0.16, sx * 3.45, 0.283 + i * 0.567, 0.3, i % 2 ? WHT : RED, { hull: false });
    s.box(1.0, 1.0, 0.04, sx * 3.45, 2.9, 0.4, BLK, { rz: Math.PI / 4 });
    s.box(0.9, 0.9, 0.06, sx * 3.45, 2.9, 0.41, YEL, { rz: Math.PI / 4, hull: false });
    s.box(0.12, 0.42, 0.07, sx * 3.45, 2.84, 0.42, BLK, { hull: false });
    for (const a of [-1, 1]) s.box(0.12, 0.3, 0.07, sx * 3.45 + a * 0.09, 3.04, 0.42, BLK, { rz: a * 0.7, hull: false });
  }
  for (const x of [-2.2, 0, 2.2]) {
    s.box(2.0, 0.1, 0.25, x, 0.06, 0.12, 0x8d8880, { hull: false });
    for (const r of [-0.72, 0.72]) {
      s.box(0.1, 0.1, 0.5, x + r, 0.12, 0.2, RAIL, { rx: -0.4, hull: false });
      s.box(0.1, 0.1, 0.5, x + r, 0.36, 0.02, RAIL, { rx: -0.9, hull: false });
      s.box(0.1, 0.1, 0.5, x + r, 0.68, -0.05, 0xff7a1a, { rx: -1.4, hull: false });
    }
    for (const z of [2.0, 4.0]) for (const a of [-1, 1]) {
      s.box(0.9, 0.022, 0.22, x + a * 0.36, 0.075, z, YEL, { ry: -a * 0.6, hull: false });
    }
  }
  return s.build();
}

function buildGapPatch() {
  const s = new ShapeBuilder();
  strip(s, 0, 1, 0x9aa1ad, 7.0, 0.09, 0.08);
  strip(s, 0, 0.08, YEL, 7.0, 0.092, 0.085);
  strip(s, 0.92, 1, YEL, 7.0, 0.092, 0.085);
  for (let i = 0; i < 6; i++) strip(s, 0.16 + i * 0.13, 0.18 + i * 0.13, 0x5b616c, 6.6, 0.092, 0.085);
  for (const sx of [-1, 1]) s.box(0.06, 0.09, 1, sx * 3.5, 0.09, -0.5, INK, { hull: false });
  return s.build();
}

function buildGateFrame() {
  const s = new ShapeBuilder();
  for (const sx of [-1, 1]) {
    s.box(0.3, 3.9, 0.3, sx * 3.78, 1.95, -0.175, STEEL);
    s.box(0.6, 0.12, 0.6, sx * 3.78, 0.06, -0.175, STEEL, { hull: false });
  }
  s.box(7.9, 0.5, 0.4, 0, 3.65, -0.175, STEEL);
  s.box(7.9, 0.1, 0.42, 0, 3.42, -0.175, YEL, { hull: false });
  for (const x of [-2.2, 0, 2.2]) {
    s.box(0.7, 0.9, 0.25, x, 4.35, -0.05, INK);
    s.box(0.34, 0.34, 0.06, x, 4.55, 0.1, 0xff2d2d, { hull: false });
    s.box(0.34, 0.34, 0.06, x, 4.15, 0.1, 0x1d5c33, { hull: false });
    s.box(0.1, 0.1, 0.07, x + 0.08, 4.63, 0.1, 0xffffff, { hull: false });
  }
  return s.build();
}

function buildGateShutter() {
  const s = new ShapeBuilder();
  s.box(7.2, 0.26, 0.2, 0, 1.08, -0.175, WHT, { visible: false });
  for (let i = 0; i < 12; i++) s.box(0.6, 0.26, 0.2, -3.3 + i * 0.6, 1.08, -0.175, i % 2 ? WHT : RED, { hull: false });
  for (let i = 0; i < 15; i++) s.box(0.07, 2.1, 0.07, -3.36 + i * 0.48, 2.25, -0.175, 0x55595f, { hull: false });
  for (const y of [1.9, 2.6]) s.box(7.2, 0.06, 0.06, 0, y, -0.175, 0x55595f, { hull: false });
  for (const x of [-2.2, 0, 2.2]) {
    s.box(0.3, 0.3, 0.08, x, 1.08, -0.03, 0xff2d2d, { hull: false });
    s.box(0.1, 0.1, 0.09, x + 0.07, 1.15, -0.03, 0xffffff, { hull: false });
    for (const a of [-1, 1]) s.box(0.5, 0.12, 0.05, x + a * 0.2, 1.65, -0.13, YEL, { rz: a * 0.6, hull: false });
  }
  return s.build();
}

function buildGirderBeam() {
  const s = new ShapeBuilder();
  for (const z of [-0.07, -0.43]) {
    for (const y of [0.37, 2.03]) s.box(4.4, 0.14, 0.14, 0, y, z, 0xf5b417);
    for (const x of [-2.13, -1.065, 0, 1.065, 2.13]) s.box(0.1, 1.52, 0.1, x, 1.2, z, 0xf5b417, { hull: false });
    for (let b = 0; b < 4; b++) s.box(0.08, 1.86, 0.08, -1.5975 + b * 1.065, 1.2, z, 0xd9960a, { rz: (b % 2 ? 1 : -1) * 0.611, hull: false });
  }
  for (const x of [-2.13, 0, 2.13]) s.box(0.08, 0.08, 0.36, x, 2.03, -0.25, 0xd9960a, { hull: false });
  for (const sx of [-1, 1]) {
    s.box(0.12, 1.8, 0.5, sx * 2.2, 1.2, -0.25, YEL, { visible: false });
    for (let i = 0; i < 5; i++) s.box(0.12, 0.36, 0.5, sx * 2.2, 0.48 + i * 0.36, -0.25, i % 2 ? BLK : YEL, { hull: false });
    s.box(0.2, 0.16, 0.2, sx * 2.2, 2.2, -0.25, 0xffa51f, { hull: false });
    s.box(0.05, 1.85, 0.05, sx * 0.7, 2.7, -0.25, 0x2a2d34, { rz: sx * 0.862, hull: false });
  }
  s.box(0.14, 0.3, 0.14, 0, 3.2, -0.25, RED, { hull: false });
  s.box(0.5, 0.45, 0.4, 0, 3.5, -0.25, 0xf5b417);
  s.box(0.07, 12.3, 0.07, 0, 9.86, -0.25, 0x2a2d34, { hull: false });
  return s.build();
}

function buildGirderJib() {
  const s = new ShapeBuilder();
  for (let i = 0; i < 5; i++) s.box(5.2, 0.9, 0.9, -10.4 + i * 5.2, 16.5, -0.25, i % 2 ? WHT : RED, { hull: false });
  s.box(1.0, 0.5, 0.8, 0, 16.1, -0.25, STEEL, { hull: false });
  return s.build();
}

function buildGirderPad() {
  const s = new ShapeBuilder();
  s.box(2.15, 0.02, 7.0, 0, 0.07, 3.5, BLK, { hull: false });
  for (let i = 0; i < 7; i++) s.box(2.15, 0.022, 0.5, 0, 0.072, 0.5 + i, YEL, { hull: false });
  for (const sx of [-1, 1]) s.box(0.1, 0.03, 7.0, sx * 1.03, 0.075, 3.5, RED, { hull: false });
  return s.build();
}

function buildGirderGo() {
  const s = new ShapeBuilder();
  for (const z of [1.5, 3.5, 5.5]) for (const a of [-1, 1]) s.box(0.9, 0.022, 0.26, a * 0.36, 0.075, z, 0x35e06a, { ry: -a * 0.6, hull: false });
  return s.build();
}

// Coin: a lathe of a recessed face + thick raised rim (profile [r, y] bottom -> top, axis turned to Z),
// vertex colours: recess mid tone, inner wall shadow, rim gold. Highlight comes from the material gloss.
function buildCoin() {
  const P = [[0, -0.02, 0xe09b00], [0.19, -0.02, 0xe09b00], [0.22, -0.045, 0x8c4a00], [0.27, -0.05, 0xffc700],
    [0.3, -0.03, 0xffc700], [0.3, 0.03, 0xe09b00], [0.27, 0.05, 0xffc700], [0.22, 0.045, 0x8c4a00],
    [0.19, 0.02, 0xe09b00], [0, 0.02, 0xe09b00]];
  const segs = 18;
  const geometry = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), segs).rotateX(Math.PI / 2);
  const col = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j < P.length; j++) {
      _color.setHex(P[j][2]);
      col.set([_color.r, _color.g, _color.b], (i * P.length + j) * 3);
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const outline = new THREE.CylinderGeometry(0.335, 0.335, 0.13, segs).rotateX(Math.PI / 2);
  return { geometry, outline };
}

// ---------- instanced kinds ----------

class InstancedKind {
  constructor(scene, shape, material, outlineMaterial, capacity, withColor = false) {
    this.capacity = capacity;
    this.n = 0;
    this.mesh = new THREE.InstancedMesh(shape.geometry, material, capacity);
    this.mesh.frustumCulled = false; // instances move every frame; bounds would go stale
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (withColor) {
      for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, _color.setHex(0xffffff));
    }
    scene.add(this.mesh);
    this.outline = null;
    if (shape.outline) {
      this.outline = new THREE.InstancedMesh(shape.outline, outlineMaterial, capacity);
      this.outline.instanceMatrix = this.mesh.instanceMatrix; // same transforms
      this.outline.frustumCulled = false;
      this.outline.count = 0;
      scene.add(this.outline);
    }
    this._colorChanged = false;
  }

  begin() {
    this.n = 0;
  }

  add(matrix, color) {
    if (this.n >= this.capacity) return;
    this.mesh.setMatrixAt(this.n, matrix);
    if (color !== undefined && this.mesh.instanceColor) {
      this.mesh.setColorAt(this.n, color);
      this._colorChanged = true;
    }
    this.n++;
  }

  end() {
    const n = this.n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this._colorChanged) {
      this.mesh.instanceColor.needsUpdate = true;
      this._colorChanged = false;
    }
    if (this.outline) {
      this.outline.count = n;
      this.outline.visible = n > 0;
    }
  }
}

export function createObstacleArt(scene) {
  const material = toonMaterial(0xffffff, { vertexColors: true });
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  const coinMaterial = toonMaterial(0xffffff, { vertexColors: true, emissive: 0x4a3000, gloss: { color: 0xfffab3, threshold: 0.9, soft: 0.02 } });
  const coinOutline = new THREE.MeshBasicMaterial({ color: 0x4d2600, side: THREE.BackSide });

  const kinds = {
    low: new InstancedKind(scene, buildLow(), material, outlineMaterial, 24),
    high: new InstancedKind(scene, buildHigh(), material, outlineMaterial, 24),
    carBody: new InstancedKind(scene, buildCarBody(), material, outlineMaterial, 24, true),
    carDetail: new InstancedKind(scene, buildCarDetail(), material, null, 24),
    wagon: new InstancedKind(scene, buildWagon(), material, outlineMaterial, 64),
    ramp: new InstancedKind(scene, buildRamp(), material, outlineMaterial, 16),
    coin: new InstancedKind(scene, buildCoin(), coinMaterial, coinOutline, 256),
    gapHole: new InstancedKind(scene, buildGapHole(), material, outlineMaterial, 3),
    gapEnds: new InstancedKind(scene, buildGapEnds(), material, outlineMaterial, 3),
    gapPatch: new InstancedKind(scene, buildGapPatch(), material, outlineMaterial, 3),
    gateFrame: new InstancedKind(scene, buildGateFrame(), material, outlineMaterial, 3),
    gateShutter: new InstancedKind(scene, buildGateShutter(), material, outlineMaterial, 3),
    girderBeam: new InstancedKind(scene, buildGirderBeam(), material, outlineMaterial, 3),
    girderJib: new InstancedKind(scene, buildGirderJib(), material, outlineMaterial, 3),
    girderPad: new InstancedKind(scene, buildGirderPad(), material, outlineMaterial, 6),
    girderGo: new InstancedKind(scene, buildGirderGo(), material, outlineMaterial, 3),
  };
  const carColors = CAR_COLORS.map((hex) => new THREE.Color(hex));
  const m = new THREE.Matrix4();
  const spin = new THREE.Matrix4();

  return {
    kinds,

    addRow(type, z, len, open, tau) {
      if (type === 'gap') {
        kinds.gapHole.add(m.makeScale(1, 1, len).setPosition(0, 0, z));
        kinds.gapEnds.add(m.makeTranslation(0, 0, z));
      } else if (type === 'gate') {
        const G = CONFIG.obstacles.gate;
        kinds.gateFrame.add(m.makeTranslation(0, 0, z));
        const u = Math.min(1, Math.max(0, (tau - G.dropTo) / (G.dropFrom - G.dropTo)));
        kinds.gateShutter.add(m.makeTranslation(0, G.raised * u * u * (3 - 2 * u), z));
      } else {
        const R = CONFIG.obstacles.girder;
        const th = girderOffset(tau, open) / (R.pivotY - 1.2);
        kinds.girderBeam.add(m.makeRotationZ(th).setPosition(R.pivotY * Math.sin(th), R.pivotY * (1 - Math.cos(th)), z));
        kinds.girderJib.add(m.makeTranslation(0, 0, z));
        for (let lane = 0; lane < 3; lane++) (lane === open ? kinds.girderGo : kinds.girderPad).add(m.makeTranslation(laneX(lane), 0, z));
      }
    },

    addPatch(z, len) {
      kinds.gapHole.add(m.makeScale(1, 1, len).setPosition(0, 0, z));
      kinds.gapEnds.add(m.makeTranslation(0, 0, z));
      kinds.gapPatch.add(m.makeScale(1, 1, len).setPosition(0, 0, z));
    },

    begin() {
      for (const k in kinds) kinds[k].begin();
    },

    // kind: low | high | car | wagon | ramp
    add(kind, x, y, z, colorIndex = 0) {
      m.makeTranslation(x, y, z);
      if (kind === 'car') {
        kinds.carBody.add(m, carColors[colorIndex % carColors.length]);
        kinds.carDetail.add(m);
      } else {
        kinds[kind].add(m);
      }
    },

    addCoin(x, y, z) {
      m.copy(spin).setPosition(x, y, z);
      kinds.coin.add(m);
    },

    // time: seconds, drives the coin spin
    end(time) {
      for (const k in kinds) kinds[k].end();
      spin.makeRotationY(time * 4);
    },
  };
}
