// city.js (G7) — sunny cartoon New York around the elevated track.
//
//   import { initCity } from './city.js';  initCity(game);
//
// What it builds
//   * A pool of VARIANTS: pre-built 20 m long city chunks (both sides of the track plus the
//     street far below, steel portal frames under the deck, cars, brownstones, brick walk-ups
//     with fire escapes, mid-rises with roof water tanks / billboards, glass towers and a back
//     wall of tall buildings). Every variant is TWO merged geometries:
//       - facade  : textured quads (one shared window-cell canvas texture, tiled by UV)
//       - plain   : everything else (vertex colours only)
//   * Every world segment owns one small Group with TWO meshes (facade + plain). When the
//     world recycles a segment (world.onRecycle) the meshes just swap to another variant
//     and the group is mirrored left/right. No allocation while running.
//   * One static, fog-free skyline + cloud backdrop far ahead (1 draw call).
//   => draw calls added: 2 per segment (18 with 9 segments) + 1 skyline = 19.
//
// Geometry rules: the deck (TRACK.halfWidth ~3.7 m) and its fences (~3.9 m) are never
// touched; the nearest building face is at |x| >= CITY.frontMin (~7 m). The street is
// CITY.streetDrop metres below the running surface.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { toonMaterial } from './models/toon.js';
import { TRACK } from './world.js';

// Tunables (CONFIG.city, if someone adds it to config.js, overrides these).
const CITY = {
  streetDrop: 11,      // m from running surface down to the street
  variants: 12,        // pre-built chunk variants
  crossStreetVariants: [3, 7, 10], // variants that contain a cross street gap
  depth: 9,            // depth of front buildings (m)
  frontMin: 7.0,       // nearest building face |x| (m); deck fences end at ~3.9
  frontMax: 9.0,
  backX: 26,           // |x| of the tall back wall that closes every view
  skylineZ: -166.5,    // just behind the last segment (-164)
  ...(CONFIG.city || {}),
};

const SY = -CITY.streetDrop;
const SEG_L = CONFIG.world.segmentLength;
const HALF_L = SEG_L / 2;

// ---------- helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const randInt = (a, b, rng) => a + Math.floor(rng() * (b - a + 1));

const _c = new THREE.Color();
function mulHex(hex, f) {
  _c.setHex(hex);
  _c.multiplyScalar(f);
  return _c.getHex();
}

// Darker near the street (shadow under the elevated line), full colour high up.
function shade(y) {
  if (y < 0) return THREE.MathUtils.lerp(0.62, 0.9, THREE.MathUtils.clamp((y - SY) / -SY, 0, 1));
  return 0.9 + 0.1 * Math.min(1, y / 20);
}

const PAL = {
  brown: [0x8a4f3c, 0x7a4636, 0x9a6648, 0x6f4a3e, 0xa0674a],
  brick: [0xc0553f, 0xb34a38, 0xcc6a4a, 0xa8573f, 0xd07a52],
  mid: [0xe9d9b0, 0xf0cf7c, 0xaecae0, 0xeaa9a0, 0xa9d9b9, 0xf3e3c8],
  glass: [0x6ec6d9, 0x7ab0e8, 0x8bd6c0, 0xa9c8dc],
  stone: [0xcfc8bb, 0xbfb8aa, 0xd9d0c0],
  roof: 0x5d5a62,
  shop: [0x2e5a4d, 0x2a3556, 0x6a2230, 0x24262c, 0x7a4a1e],
  awning: [0xe8473a, 0x2f80ed, 0xf2b632, 0x3ebd7a, 0xf5f0e6],
  ad: [0xe64a3c, 0x2f80ed, 0xf2b632, 0x3ebd7a, 0x9b59b6, 0xff7a3d],
  car: [0xf6c026, 0xf6c026, 0xe0453a, 0x3b7de0, 0xf2f2f2, 0x3a9a5b],
  steel: 0x4c5562,
  asphalt: 0x6d717a,
  sidewalk: 0xc9c3b7,
};

// ---------- window-cell texture (one cell = one window bay, tiled by UV) ----------
function makeFacadeTexture(renderer) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  // faint brick / siding courses
  g.fillStyle = '#e4e4e4';
  for (let y = 6; y < S; y += 16) g.fillRect(0, y, S, 2);
  // lintel + sill
  g.fillStyle = '#d3cbc0';
  g.fillRect(40, 34, 176, 18);
  g.fillStyle = '#c9c0b3';
  g.fillRect(40, 214, 176, 18);
  // frame
  g.fillStyle = '#efe9df';
  g.fillRect(52, 50, 152, 166);
  // glass
  g.fillStyle = '#2b4562';
  g.fillRect(64, 60, 128, 146);
  // glare
  g.fillStyle = '#5d86ad';
  g.beginPath(); g.moveTo(64, 60); g.lineTo(104, 60); g.lineTo(64, 120); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(120, 60); g.lineTo(140, 60); g.lineTo(64, 170); g.lineTo(64, 150); g.closePath(); g.fill();
  // mullions
  g.fillStyle = '#efe9df';
  g.fillRect(64, 128, 128, 7);
  g.fillRect(125, 60, 6, 146);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(4, renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1);
  return tex;
}

// ---------- facade geometry builder (textured quads) ----------
class Facade {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }

  // Axis-aligned wall. axis 'x': wall at x=coord, runs along z (a = z).
  //                    axis 'z': wall at z=coord, runs along x (a = x).
  // nSign = outward normal sign along that axis. uvp = { uo, us, vo, vs }.
  quad(axis, coord, nSign, a0, a1, y0, y1, tint, uvp) {
    if (a1 - a0 < 0.05 || y1 - y0 < 0.05) return;
    const stops = [y0];
    for (const s of [0, 20]) if (s > y0 + 0.01 && s < y1 - 0.01) stops.push(s);
    stops.push(y1);
    for (let i = 0; i < stops.length - 1; i++) this._q(axis, coord, nSign, a0, a1, stops[i], stops[i + 1], tint, uvp);
  }

  _q(axis, coord, nSign, a0, a1, ya, yb, tint, uvp) {
    const base = this.pos.length / 3;
    const pts = [[a0, ya], [a1, ya], [a1, yb], [a0, yb]];
    _c.setHex(tint);
    for (const [a, y] of pts) {
      if (axis === 'x') this.pos.push(coord, y, a); else this.pos.push(a, y, coord);
      this.nor.push(axis === 'x' ? nSign : 0, 0, axis === 'z' ? nSign : 0);
      this.uv.push((a - uvp.uo) * uvp.us, (y - uvp.vo) * uvp.vs);
      const k = shade(y);
      this.col.push(_c.r * k, _c.g * k, _c.b * k);
    }
    // (p0,p1,p2) is counter-clockwise for normal -x (axis x) or +z (axis z)
    const flip = axis === 'x' ? nSign > 0 : nSign < 0;
    if (flip) this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- plain geometry helpers ----------
function finishPlain(list, g, color, cx, cy, cz, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(cx, cy, cz);
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  const arr = new Float32Array(p.count * 3);
  _c.setHex(color);
  for (let i = 0; i < p.count; i++) {
    const k = shade(p.getY(i));
    arr[i * 3] = _c.r * k; arr[i * 3 + 1] = _c.g * k; arr[i * 3 + 2] = _c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  list.push(g);
}
function pBox(list, cx, cy, cz, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
  finishPlain(list, new THREE.BoxGeometry(sx, sy, sz), color, cx, cy, cz, rx, ry, rz);
}
function pCyl(list, cx, cy, cz, rTop, rBot, h, seg, color) {
  finishPlain(list, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1), color, cx, cy, cz);
}

// ---------- building parts ----------
// Solid block: |x| from r0 to r0+depth on side s, z from zA to zB, y from yA to yB.
function addSolid(F, P, s, r0, depth, zA, zB, yA, yB, tint, cellW, floors, roofCol) {
  const w = zB - zA;
  const n = Math.max(1, Math.round(w / cellW));
  const vs = floors / (yB - yA);
  const xa = s * r0, xb = s * (r0 + depth);
  const xmin = Math.min(xa, xb), xmax = Math.max(xa, xb);
  F.quad('x', xa, -s, zA, zB, yA, yB, tint, { uo: zA, us: n / w, vo: yA, vs });
  const side = { uo: xmin, us: 1 / cellW, vo: yA, vs };
  F.quad('z', zA, -1, xmin, xmax, yA, yB, tint, side);
  F.quad('z', zB, 1, xmin, xmax, yA, yB, tint, side);
  // roof slab, parapet, cornice
  const zc = (zA + zB) / 2;
  pBox(P, s * (r0 + depth / 2), yB + 0.08, zc, depth, 0.16, w, roofCol);
  const par = mulHex(tint, 1.08);
  pBox(P, s * (r0 + 0.12), yB + 0.4, zc, 0.24, 0.5, w, par);
  pBox(P, s * (r0 + depth - 0.12), yB + 0.4, zc, 0.24, 0.5, w, par);
  pBox(P, s * (r0 + depth / 2), yB + 0.4, zA + 0.12, depth, 0.5, 0.24, par);
  pBox(P, s * (r0 + depth / 2), yB + 0.4, zB - 0.12, depth, 0.5, 0.24, par);
  pBox(P, s * (r0 - 0.22), yB - 0.15, zc, 0.55, 0.32, w, mulHex(tint, 1.25));
}

function addShop(P, s, r0, zA, zB, yA, h, rng) {
  const w = zB - zA;
  if (w < 3) return;
  const zc = (zA + zB) / 2;
  pBox(P, s * (r0 - 0.11), yA + h / 2, zc, 0.22, h, w - 0.5, pick(PAL.shop, rng));
  pBox(P, s * (r0 - 0.23), yA + h * 0.52, zc, 0.06, h * 0.55, w - 1.6, 0x9fd8e8);
  // awning, lower at the outer edge
  if (rng() < 0.75) {
    pBox(P, s * (r0 - 0.75), yA + h + 0.05, zc, 1.3, 0.08, (w - 0.5) * 0.7, pick(PAL.awning, rng), 0, 0, s * 0.38);
  }
}

function addFireEscape(P, s, r0, zc, yA, floors, floorH) {
  const steel = 0x2c2f36;
  const px = s * (r0 - 0.5);
  const fx = s * (r0 - 1.0);
  for (let f = 1; f < floors; f++) {
    const y = yA + f * floorH + 0.5;
    pBox(P, px, y, zc, 1.0, 0.07, 2.6, steel);
    pBox(P, fx, y + 0.95, zc, 0.06, 0.06, 2.6, steel);
    pBox(P, px, y + 0.95, zc - 1.3, 1.0, 0.06, 0.06, steel);
    pBox(P, px, y + 0.95, zc + 1.3, 1.0, 0.06, 0.06, steel);
    pBox(P, fx, y + 0.5, zc - 1.3, 0.05, 0.95, 0.05, steel);
    pBox(P, fx, y + 0.5, zc + 1.3, 0.05, 0.95, 0.05, steel);
    if (f < floors - 1) {
      const L = Math.hypot(floorH, 2.2);
      const ang = Math.atan2(floorH, 2.2) * (f % 2 ? 1 : -1);
      pBox(P, px, y + floorH / 2, zc, 0.5, 0.07, L, steel, ang);
    }
  }
}

function addWaterTower(P, x, y, z) {
  const wood = 0x8d5d3c;
  for (const dx of [-0.65, 0.65]) for (const dz of [-0.65, 0.65]) pBox(P, x + dx, y + 0.8, z + dz, 0.14, 1.6, 0.14, 0x3d3a40);
  pBox(P, x, y + 1.62, z, 1.7, 0.1, 1.7, 0x3d3a40);
  pCyl(P, x, y + 2.55, z, 0.95, 0.95, 1.7, 10, wood);
  pCyl(P, x, y + 2.2, z, 1.0, 1.0, 0.07, 10, 0x2f2f33);
  pCyl(P, x, y + 2.95, z, 1.0, 1.0, 0.07, 10, 0x2f2f33);
  pCyl(P, x, y + 3.75, z, 0.02, 1.1, 0.8, 10, 0x56463b);
}

function addBillboard(P, s, cx, y, cz, wB, rng) {
  const ry = -s * 0.5; // faces +z (towards the camera), turned a bit towards the track
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx, ly, lz) => [cx + lx * cs + lz * sn, y + ly, cz - lx * sn + lz * cs];
  const hB = 2.6;
  const base = pick(PAL.ad, rng);
  for (const lx of [-wB * 0.32, wB * 0.32]) {
    const p = at(lx, 0.7, 0);
    pBox(P, p[0], p[1], p[2], 0.2, 1.4, 0.2, 0x35363c, 0, ry);
  }
  let p = at(0, 1.4 + hB / 2, 0);
  pBox(P, p[0], p[1], p[2], wB, hB, 0.24, 0x2f3036, 0, ry);
  p = at(0, 1.4 + hB / 2, 0.14);
  pBox(P, p[0], p[1], p[2], wB - 0.4, hB - 0.4, 0.06, base, 0, ry);
  p = at(-wB * 0.2, 1.4 + hB / 2, 0.19);
  pBox(P, p[0], p[1], p[2], wB * 0.4, hB * 0.62, 0.05, 0xf7f1e4, 0, ry);
  const accent = pick(PAL.ad, rng);
  for (let i = 0; i < 3; i++) {
    p = at(wB * 0.2, 1.4 + hB / 2 + (i - 1) * 0.62, 0.19);
    pBox(P, p[0], p[1], p[2], wB * (0.34 - i * 0.05), 0.3, 0.05, accent, 0, ry);
  }
}

function addBladeSign(P, s, r0, y, z, rng) {
  pBox(P, s * (r0 - 0.5), y, z, 1.0, 0.08, 0.08, 0x2c2f36);
  pBox(P, s * (r0 - 0.7), y - 0.7, z, 0.9, 1.3, 0.14, pick(PAL.ad, rng));
  pBox(P, s * (r0 - 0.7), y - 0.7, z + 0.09, 0.6, 0.8, 0.04, 0xf7f1e4);
}

function addRoofClutter(P, s, r0, depth, zA, zB, yB, rng) {
  const w = zB - zA;
  const zc = (zA + zB) / 2;
  if (w > 3.5) {
    const n = randInt(1, 2, rng);
    for (let i = 0; i < n; i++) {
      const x = s * (r0 + 2 + rng() * (depth - 4));
      const z = zA + 1 + rng() * (w - 2);
      pBox(P, x, yB + 0.6, z, 1.5, 0.9, 1.1, 0xa2a8b0);
      pCyl(P, x, yB + 1.1, z, 0.35, 0.35, 0.12, 8, 0x3d3a40);
    }
  }
  return zc;
}

// ---------- building types ----------
const STY = {
  brown: { fl: [4, 5], floorH: 3.2, cellW: 3.0 },
  walk: { fl: [5, 7], floorH: 3.0, cellW: 2.8 },
  mid: { fl: [8, 12], floorH: 3.2, cellW: 3.2 },
  tower: { fl: [20, 32], floorH: 1.9, cellW: 1.7 },
};

function makeBuilding(F, P, s, type, zA, zB, front, rng) {
  const sty = STY[type];
  const depth = CITY.depth;
  const w = zB - zA;
  const zc = (zA + zB) / 2;

  if (type === 'tower') {
    const podH = 10;
    const stone = pick(PAL.stone, rng);
    addSolid(F, P, s, front, depth, zA, zB, SY, SY + podH, stone, 3.2, 3, PAL.roof);
    addShop(P, s, front, zA, zB, SY, 3.3, rng);
    const floors = randInt(sty.fl[0], sty.fl[1], rng);
    const top = SY + podH + floors * sty.floorH;
    const r0 = front + 1.6;
    const zA2 = zA + 0.6, zB2 = zB - 0.6;
    const tint = pick(PAL.glass, rng);
    addSolid(F, P, s, r0, depth - 1.6, zA2, zB2, SY + podH, top, tint, sty.cellW, floors, 0x474b55);
    // crown + antenna
    const cx = s * (r0 + (depth - 1.6) / 2);
    const zc2 = (zA2 + zB2) / 2;
    pBox(P, cx, top + 1.6, zc2, (depth - 1.6) * 0.6, 3, (zB2 - zA2) * 0.6, mulHex(tint, 0.8));
    pCyl(P, cx, top + 5.5, zc2, 0.05, 0.12, 5, 6, 0x35363c);
    if (rng() < 0.5) pBox(P, cx, top + 3.4, zc2, 0.2, 0.25, 0.2, 0xe8473a);
    return;
  }

  const floors = randInt(sty.fl[0], sty.fl[1], rng);
  const yB = SY + floors * sty.floorH;
  const tint = pick(type === 'brown' ? PAL.brown : type === 'walk' ? PAL.brick : PAL.mid, rng);
  addSolid(F, P, s, front, depth, zA, zB, SY, yB, tint, sty.cellW, floors, PAL.roof);
  addShop(P, s, front, zA, zB, SY, sty.floorH * 0.92, rng);

  if (type === 'walk' && w > 4.5) addFireEscape(P, s, front, zc + (rng() - 0.5) * (w - 4), SY, floors, sty.floorH);
  if (type !== 'mid' && rng() < 0.4) addBladeSign(P, s, front, SY + sty.floorH * 2.4, zA + 0.8 + rng() * (w - 1.6), rng);
  if (type === 'mid' && rng() < 0.5) addBladeSign(P, s, front, SY + sty.floorH * 3.4, zA + 0.8 + rng() * (w - 1.6), rng);

  addRoofClutter(P, s, front, depth, zA, zB, yB, rng);
  const wtChance = type === 'brown' ? 0.12 : 0.5;
  if (w >= 5 && rng() < wtChance) addWaterTower(P, s * (front + 2.2 + rng() * 2), yB + 0.15, zA + 1.5 + rng() * (w - 3));
  const bbChance = type === 'mid' ? 0.4 : type === 'walk' ? 0.25 : 0;
  if (w >= 6.5 && rng() < bbChance) {
    addBillboard(P, s, s * (front + depth * 0.35), yB + 0.15, zc, Math.min(6, w - 1.2), rng);
  }
}

// ---------- street level ----------
function addCar(P, x, z, color) {
  const y = SY;
  pBox(P, x, y + 0.5, z, 1.9, 0.62, 4.3, color);
  pBox(P, x, y + 1.08, z - 0.1, 1.7, 0.55, 2.3, 0x9fd2ea);
  pBox(P, x, y + 1.4, z - 0.1, 1.72, 0.1, 2.05, color);
  pBox(P, x, y + 0.28, z + 1.35, 2.05, 0.5, 0.7, 0x23242a);
  pBox(P, x, y + 0.28, z - 1.35, 2.05, 0.5, 0.7, 0x23242a);
  if (color === 0xf6c026) pBox(P, x, y + 1.55, z - 0.1, 0.5, 0.18, 0.25, 0xfff2b0);
}

function addPortalFrame(P, z) {
  const bottom = TRACK.deckBottom;
  const colH = bottom - SY;
  for (const x of [-3.15, 3.15]) {
    pBox(P, x, SY + colH / 2, z, 0.85, colH, 0.85, CITY_STEEL);
    pBox(P, x, SY + 0.3, z, 1.3, 0.6, 1.3, 0x626b78);
    pBox(P, x, SY + 3.2, z, 1.0, 0.18, 1.0, 0x626b78); // collar
  }
  pBox(P, 0, bottom - 0.5, z, 8.1, 1.0, 1.0, CITY_STEEL);
  // X-brace between the two columns
  const dx = 6.3, dy = 4.0;
  const ang = Math.atan2(dy, dx);
  const len = Math.hypot(dx, dy);
  pBox(P, 0, bottom - 1.0 - dy / 2, z, len, 0.22, 0.22, 0x626b78, 0, 0, ang);
  pBox(P, 0, bottom - 1.0 - dy / 2, z, len, 0.22, 0.22, 0x626b78, 0, 0, -ang);
}
const CITY_STEEL = PAL.steel;

function addLamp(P, x, z, s) {
  pCyl(P, x, SY + 2.3, z, 0.07, 0.1, 4.6, 6, 0x34373d);
  pBox(P, x - s * 0.5, SY + 4.6, z, 1.0, 0.08, 0.1, 0x34373d);
  pBox(P, x - s * 1.0, SY + 4.5, z, 0.5, 0.14, 0.26, 0xfff0b8);
}

// ---------- one chunk variant ----------
function layoutSide(F, P, s, rng, gap) {
  const ranges = gap
    ? [[-HALF_L, gap.c - gap.w / 2], [gap.c + gap.w / 2, HALF_L]]
    : [[-HALF_L, HALF_L]];
  const baseFront = CITY.frontMin + rng() * (CITY.frontMax - CITY.frontMin);
  let prev = '';
  let lampDone = false;
  for (const [a, b] of ranges) {
    let z = a;
    while (b - z > 0.3) {
      const rem = b - z;
      let w = 5.5 + rng() * 5.5;
      if (rem - w < 4.5) w = rem;
      let type;
      const r = rng();
      type = r < 0.27 ? 'brown' : r < 0.57 ? 'walk' : r < 0.82 ? 'mid' : 'tower';
      if (type === prev && rng() < 0.7) type = type === 'walk' ? 'mid' : 'walk';
      if (type === 'tower' && w < 7.5) type = 'mid';
      prev = type;
      const front = baseFront + (rng() < 0.35 ? rng() * 1.0 : 0);
      makeBuilding(F, P, s, type, z, z + w, front, rng);
      // sidewalk in front of the building
      pBox(P, s * (front - 1.25), SY + 0.1, z + w / 2, 2.5, 0.2, w, PAL.sidewalk);
      if (!lampDone && w > 5 && rng() < 0.6) {
        addLamp(P, s * (front - 2.3), z + w / 2, s);
        lampDone = true;
      }
      z += w;
    }
  }
  // tall back wall
  let z = -HALF_L;
  while (HALF_L - z > 0.3) {
    let w = 6 + rng() * 6;
    if (HALF_L - z - w < 4) w = HALF_L - z;
    const H = 30 + rng() * 30;
    const floors = Math.round(H / 3.3);
    const tint = pick(rng() < 0.5 ? PAL.brick : PAL.mid, rng);
    const n = Math.max(1, Math.round(w / 3.6));
    F.quad('x', s * CITY.backX, -s, z, z + w, SY, SY + floors * 3.3, mulHex(tint, 0.95), {
      uo: z, us: n / w, vo: SY, vs: 1 / 3.3,
    });
    z += w;
  }
}

function buildVariant(index) {
  const rng = mulberry32(7000 + index * 7919);
  const F = new Facade();
  const P = [];
  const gap = CITY.crossStreetVariants.includes(index) ? { c: (rng() - 0.5) * 6, w: 7.5 } : null;

  // street + deck supports
  pBox(P, 0, SY - 0.3, 0, 76, 0.6, SEG_L, PAL.asphalt);
  addPortalFrame(P, -5);
  addPortalFrame(P, 5);
  for (const x of [-3.6, 3.6]) pBox(P, x, TRACK.deckBottom - 0.35, 0, 0.3, 0.7, SEG_L, CITY_STEEL);

  layoutSide(F, P, 1, rng, gap);
  layoutSide(F, P, -1, rng, gap);

  // cars (kept away from the columns)
  const lanes = [-5.4, -1.7, 1.7, 5.4];
  const nCars = randInt(1, 3, rng);
  const used = new Set();
  for (let i = 0; i < nCars; i++) {
    const x = lanes[Math.floor(rng() * lanes.length)];
    const z = (rng() - 0.5) * 12;
    const key = x + '|' + Math.round(z / 5);
    if (used.has(key)) continue;
    used.add(key);
    if (gap && Math.abs(z - gap.c) < 3) continue;
    addCar(P, x, z, pick(PAL.car, rng));
  }

  // cross street: zebra crossing over the avenue + dashed centre line
  if (gap) {
    for (let x = -6.5; x <= 6.5; x += 1.1) pBox(P, x, SY + 0.02, gap.c, 0.5, 0.04, 2.6, 0xeeeeee);
    for (const s of [-1, 1]) for (let x = 10; x < 36; x += 3.2) pBox(P, s * x, SY + 0.02, gap.c, 1.6, 0.04, 0.2, 0xf2d24a);
  }

  const plain = mergeGeometries(P);
  for (const g of P) g.dispose();
  return { facade: F.build(), plain };
}

// ---------- distant skyline + clouds (one fog-free plane) ----------
function makeSkyline() {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rng = mulberry32(99);
  const sky = '#' + new THREE.Color(CONFIG.render.skyColor).getHexString();

  // clouds
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 9; i++) {
    const cx = rng() * W, cy = 40 + rng() * 120;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.ellipse(cx + (k - 2) * 34 + rng() * 10, cy + (k % 2) * 8, 40 + rng() * 22, 22 + rng() * 10, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  const layer = (top, bot, minH, maxH, minW, maxW) => {
    const grad = g.createLinearGradient(0, H * 0.3, 0, H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    g.fillStyle = grad;
    let x = -20;
    while (x < W) {
      const w = minW + rng() * (maxW - minW);
      const h = minH + rng() * (maxH - minH);
      g.fillRect(x, H - h, w, h);
      if (rng() < 0.25) g.fillRect(x + w * 0.25, H - h - 30 - rng() * 40, w * 0.5, 60); // setback
      if (rng() < 0.12) g.fillRect(x + w * 0.5 - 2, H - h - 70, 4, 70);              // antenna
      x += w + (rng() < 0.3 ? 8 : 0);
    }
  };
  layer('#c1d8ee', sky, 90, 300, 40, 90);
  layer('#abc9e6', sky, 70, 220, 50, 110);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 175), mat);
  mesh.position.set(0, -32 + 87.5, CITY.skylineZ);
  mesh.name = 'city-skyline';
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// ---------- public API ----------
export function initCity(game) {
  const world = game.world;
  const scene = game.scene;

  const facadeMat = toonMaterial(0xffffff, { map: makeFacadeTexture(game.renderer), vertexColors: true });
  const plainMat = toonMaterial(0xffffff, { vertexColors: true });

  const variants = [];
  for (let i = 0; i < CITY.variants; i++) variants.push(buildVariant(i));

  // Deterministic variant sequence per segment serial: never repeats within the last 3.
  const seqRng = mulberry32(424242);
  const seq = [];
  const specFor = (serial) => {
    while (seq.length <= serial) {
      const recent = seq.slice(-3).map((q) => q.v);
      let v;
      do { v = Math.floor(seqRng() * variants.length); } while (recent.includes(v));
      seq.push({ v, flip: seqRng() < 0.5 });
    }
    return seq[serial];
  };

  const assign = (seg) => {
    let c = seg.city;
    if (!c) {
      const group = new THREE.Group();
      group.name = 'city-chunk';
      const facade = new THREE.Mesh(variants[0].facade, facadeMat);
      const plain = new THREE.Mesh(variants[0].plain, plainMat);
      for (const m of [facade, plain]) { m.matrixAutoUpdate = false; m.updateMatrix(); group.add(m); }
      seg.group.add(group);
      c = seg.city = { group, facade, plain };
    }
    const spec = specFor(seg.serial);
    c.facade.geometry = variants[spec.v].facade;
    c.plain.geometry = variants[spec.v].plain;
    c.group.scale.x = spec.flip ? -1 : 1;
  };

  for (const seg of world.segments) assign(seg);
  const off = world.onRecycle((seg) => assign(seg));

  const skyline = makeSkyline();
  scene.add(skyline);

  return {
    skyline,
    variants,
    dispose() {
      off();
      scene.remove(skyline);
      for (const seg of world.segments) {
        if (seg.city) { seg.group.remove(seg.city.group); seg.city = null; }
      }
    },
  };
}
