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

  // Box of size w,h,d centred at x,y,z. opts: { hull: true, visible: true, rx, rz }
  box(w, h, d, x, y, z, color, opts = {}) {
    const hull = opts.hull !== false;
    const visible = opts.visible !== false;
    const place = (g) => {
      if (opts.rx) g.rotateX(opts.rx);
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

function buildCoin() {
  const r = 0.3;
  const geometry = new THREE.CylinderGeometry(r, r, 0.08, 18).rotateX(Math.PI / 2);
  const outline = new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.14, 18).rotateX(Math.PI / 2);
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
  const coinMaterial = toonMaterial(0xffcf3a, { emissive: 0x6b4500 });
  const coinOutline = new THREE.MeshBasicMaterial({ color: 0x5a3800, side: THREE.BackSide });

  const kinds = {
    low: new InstancedKind(scene, buildLow(), material, outlineMaterial, 24),
    high: new InstancedKind(scene, buildHigh(), material, outlineMaterial, 24),
    carBody: new InstancedKind(scene, buildCarBody(), material, outlineMaterial, 24, true),
    carDetail: new InstancedKind(scene, buildCarDetail(), material, null, 24),
    wagon: new InstancedKind(scene, buildWagon(), material, outlineMaterial, 64),
    ramp: new InstancedKind(scene, buildRamp(), material, outlineMaterial, 16),
    coin: new InstancedKind(scene, buildCoin(), coinMaterial, coinOutline, 256),
  };
  const carColors = CAR_COLORS.map((hex) => new THREE.Color(hex));
  const m = new THREE.Matrix4();
  const spin = new THREE.Matrix4();

  return {
    kinds,

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
