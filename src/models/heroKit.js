// heroKit.js — shared helpers for the hero skins built on createSpiderCharacter (spiderman.js).
// Sculpted extras (ears, bows, hair, hoods, capes, shields...) are MERGED into the head or the
// torso mesh instead of being meshes of their own: they share that mesh's material, outline and
// draw call. Each extra is one flat colour: its UVs all point at a small solid "swatch" painted
// into a hidden corner of that mesh's texture (under the chin of the head, the top of the torso
// inside the head). With every UV equal the GPU samples the full-size texel: no mip bleeding.
//   attach(mesh, [{ geo, color }, ...]) -> [{ start, count }, ...] vertex ranges of the pieces

import * as THREE from 'three';
import { mergeGeos, smoothNormals } from './toon.js';
import { deformHead } from './spiderman.js';

// ---------------------------------------------------------------- 2D painting helpers
export function poly(g, P, pts, fill, stroke, w = 3) {
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = 'round'; g.stroke(); }
}

export function ellipse(g, P, x, y, rx, ry, fill, stroke, w = 4, rot = 0) {
  const c = P(x, y), a = P(x + rx, y), b = P(x, y + ry);
  g.beginPath();
  g.ellipse(c[0], c[1], Math.abs(a[0] - c[0]), Math.abs(b[1] - c[1]), rot, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); }
}

// polyline / smooth curve through points (metres -> pixels by P)
export function line(g, P, pts, color, w, cap = 'round') {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = cap;
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.stroke();
}

export const starPts = (cx, cy, R, r = R * 0.4, rot = 0) => Array.from({ length: 10 }, (_, i) => {
  const a = Math.PI / 2 + rot + (i * Math.PI) / 5, k = i % 2 ? r : R;
  return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
});

// fills a limb strip with a colour (limb paint functions get (g, W, H, info))
export const fill = (g, W, H, color, y0 = 0, y1 = H) => { g.fillStyle = color; g.fillRect(0, y0, W, y1 - y0); };

// ---------------------------------------------------------------- geometry helpers
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// in-place transform: position, Euler rotation [x, y, z], scale (number or [x, y, z])
export function xf(geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = 1) {
  const s = Array.isArray(scl) ? scl : [scl, scl, scl];
  _m.compose(new THREE.Vector3(...pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), new THREE.Vector3(...s));
  geo.applyMatrix4(_m);
  return geo;
}

// unit sphere (radius 1) for blobs: scale it with xf
export const ball = (w = 14, h = 10) => new THREE.SphereGeometry(1, w, h);

// ---------------------------------------------------------------- swatches + merging
const SWATCH = 8;      // swatch block size in texels
// where the hidden strip is: 'bottom' rows of the head texture (under the chin), 'top' rows of the
// torso texture (the top of the torso, inside the head)
function swatchUV(tex, color, where) {
  const c = tex.image, g = c.getContext('2d');
  const ud = tex.userData;
  if (!ud.swatches) ud.swatches = new Map();
  let uv = ud.swatches.get(color);
  if (uv) return uv;
  const i = ud.swatches.size;
  const x = 4 + i * (SWATCH + 4);
  if (x + SWATCH > c.width) throw new Error('heroKit: out of swatch room');
  const y = where === 'top' ? 1 : c.height - SWATCH - 1;
  g.fillStyle = color;
  g.fillRect(x - 2, y - 1, SWATCH + 4, SWATCH + 1);
  tex.needsUpdate = true;
  uv = [(x + SWATCH / 2) / c.width, 1 - (y + SWATCH / 2) / c.height];
  ud.swatches.set(color, uv);
  return uv;
}

// Merges pieces into mesh.geometry (and its outline / any child sharing it). pieces:
// [{ geo, color }] (geo: indexed or not, with normals; color: '#rrggbb'), or { geo, uv: [u, v] }
// to sample an existing texel of the mesh's own texture (e.g. a black glove).
// where: 'bottom' (head) | 'top' (torso). Returns the vertex range of every piece.
export function attach(mesh, pieces, where = 'bottom') {
  const old = mesh.geometry;
  const tex = mesh.material.map;
  const list = [old];
  const ranges = [];
  let start = old.attributes.position.count;
  for (const pc of pieces) {
    const geo = pc.geo;
    if (pc.smooth !== false) smoothNormals(geo);
    const [u, v] = pc.uv || swatchUV(tex, pc.color, where);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const a = geo.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, u, v);
    const count = geo.attributes.position.count;
    ranges.push({ start, count });
    start += count;
    list.push(geo);
  }
  const merged = mergeGeos(list);
  merged.userData = old.userData;
  mesh.geometry = merged;
  for (const ch of mesh.children) if (ch.geometry === old) ch.geometry = merged;
  for (const g of list) g.dispose();
  return ranges;
}

// An Object3D standing in for merged pieces that game code shows / hides by name
// (getObjectByName(name).visible = false): hiding folds those vertices into one point.
export function rangeToggle(name, geo, ranges) {
  const o = new THREE.Object3D();
  o.name = name;
  const pos = geo.attributes.position;
  const saved = ranges.map(({ start, count }) => pos.array.slice(start * 3, (start + count) * 3));
  let on = true;
  Object.defineProperty(o, 'visible', {
    get: () => on,
    set(v) {
      v = !!v;
      if (v === on) return;
      on = v;
      ranges.forEach(({ start, count }, k) => {
        if (v) pos.array.set(saved[k], start * 3);
        else for (let i = start; i < start + count; i++) pos.setXYZ(i, saved[k][0], saved[k][1], saved[k][2]);
      });
      pos.needsUpdate = true;
    },
  });
  return o;
}

// ---------------------------------------------------------------- head surface

// Point on the head surface (head mesh space, centre at the origin) seen at (x, y) from the
// front (side = -1) or the back (side = 1), pushed out by `out` metres along the surface normal.
export function headPoint(x, y, side = -1, out = 0, target = new THREE.Vector3()) {
  let a = x, b = y;
  const d = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    deformHead(d.set(a, b, side * 0.37));
    a *= Math.abs(d.x) > 1e-5 ? x / d.x : 1;
    b *= Math.abs(d.y) > 1e-5 ? y / d.y : 1;
  }
  deformHead(d.set(a, b, side * 0.37));
  if (out) { // normal from two nearby surface points
    deformHead(q.set(a + 0.01, b, side * 0.37)).sub(d);
    deformHead(n.set(a, b + 0.01, side * 0.37)).sub(d);
    n.crossVectors(n, q).normalize();
    if (n.z * side < 0) n.negate();
    d.addScaledVector(n, out);
  }
  return target.copy(d);
}

// closed tube through head points [[x, y], ...] (front or back), radius r
export function headRing(pts, { side = -1, out = 0.01, r = 0.03, seg = 64, radial = 8, closed = true, sz = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => headPoint(x, y, side, out)), closed);
  const geo = new THREE.TubeGeometry(curve, seg, r, radial, closed);
  if (sz !== 1) geo.scale(1, 1, sz);
  return geo;
}
