// city-pieces.js ? approved district recipes, built once behind the loader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ANCHOR_COUNTS } from './city-logic.js';
import { rng } from './city-tex.js';

const lerp = (a, b, t) => a + (b - a) * t;
const SY = -11, INK = 0x1c1016;
const _c = new THREE.Color();
const shade = (y) => (y < 0 ? lerp(0.62, 0.9, THREE.MathUtils.clamp((y - SY) / -SY, 0, 1)) : 0.9 + 0.1 * Math.min(1, y / 20));
function fin(L, g, color, cx, cy, cz, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(cx, cy, cz); g.deleteAttribute('uv');
  const p = g.attributes.position, a = new Float32Array(p.count * 3);
  _c.setHex(color);
  for (let i = 0; i < p.count; i++) { const k = L.flat ? 1 : shade(p.getY(i)); a[i * 3] = _c.r * k; a[i * 3 + 1] = _c.g * k; a[i * 3 + 2] = _c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  L.push(g);
}
const pBox = (L, cx, cy, cz, sx, sy, sz, col, rx, ry, rz) => fin(L, new THREE.BoxGeometry(sx, sy, sz, 1, 1, Math.max(1, Math.round(sz / 5))), col, cx, cy, cz, rx, ry, rz);
const pCyl = (L, cx, cy, cz, rT, rB, h, seg, col, rx, ry, rz) => fin(L, new THREE.CylinderGeometry(rT, rB, h, seg, 1), col, cx, cy, cz, rx, ry, rz);
const pSph = (L, cx, cy, cz, r, sy, col) => fin(L, new THREE.SphereGeometry(r, 8, 6).scale(1, sy, 1), col, cx, cy, cz);
const glowList = () => { const L = []; L.flat = true; return L; };   // unlit pieces: no height shade
// textured quad facing +z before ry; rect = [px, py, pw, ph] in an atlas of W x H pixels
function sQuad(L, w, h, x, y, z, ry, rect, W = 1024, H = 1024) {
  L.push({ w, h, x, y, z, ry, rect, W, H });
}
const merge = (L) => (L.length ? mergeGeometries(L.map((g) => (g.index ? g.toNonIndexed() : g))) : null);
const kit = (o) => {
  const r = { anchors: {} };
  for (const k in o) {
    if (k === 'tabela' || k === 'ads' || k === 'bugle') r.anchors[k] = o[k];
    else { const g = merge(o[k]); if (g) r[k] = g; }
  }
  return r;
};

const nameRect = (i) => [(i % 2) * 512, Math.floor(i / 2) * 128, 512, 128];
const shopRect = (i) => [(i % 2) * 512, 384 + Math.floor(i / 2) * 64, 512, 64];
const RED = 0xc8202f, GOLD = 0xf6c64a, JADE = 0x2f9e7a, LAQ = 0x7a1620, PAPER = 0xe8312f;
function lantern(P, G, x, y, z, r = 0.3) {    // y = centre of the paper body
  pSph(G, x, y, z, r, 0.85, PAPER);
  pCyl(P, x, y + r * 0.82, z, r * 0.45, r * 0.6, 0.09, 8, GOLD);
  pCyl(P, x, y - r * 0.82, z, r * 0.6, r * 0.45, 0.09, 8, GOLD);
  pBox(P, x, y - r * 0.82 - 0.2, z, 0.05, 0.32, 0.05, GOLD);
}
// one string across the street: two straight ink lines from the facades (x +-7.5, y 12.6) to the
// middle (y 11.0), 9 lanterns 1.5 m apart hanging 0.42 m under the line. Lowest point 9.9 > CLEAR_Y.
function lanternString(P, G, z, n = 4) {
  for (const s of [-1, 1]) pBox(P, s * 3.75, 11.8, z, 7.67, 0.04, 0.04, INK, 0, 0, s * 0.21);
  for (let i = -n; i <= n; i++) lantern(P, G, i * 1.5, 11.0 + 1.6 * Math.abs(i * 1.5) / 7.5 - 0.42, z);
}
// Ejder Kapısı (paifang), placed at the near edge of the first Chinatown segment (z = +10)
function gate() {
  const P = [], G = glowList(), S = [];
  for (const s of [-1, 1]) {
    pBox(P, s * 5.6, 1.4, 0, 1.0, 24.8, 1.0, RED);                 // column, street (-11) .. 13.8
    pBox(P, s * 5.6, -0.3, 0, 1.5, 1.4, 1.5, 0xcfc8bb);           // stone drum at deck level
    pBox(P, s * 5.6, 10.2, 0, 1.4, 0.4, 1.4, GOLD);               // ring under the beam
    pBox(P, s * 8.3, 10.9, 0, 4.4, 0.6, 0.7, RED);                // wing beam, x 6.1 .. 10.5
    pBox(P, s * 10.3, 0, 0, 0.7, 22, 0.7, RED);                   // outer post
    pBox(P, s * 8.4, 11.7, 0, 5.4, 0.3, 2.4, JADE, 0, 0, s * 0.1); // wing roof, tips up outwards
    pBox(P, s * 8.3, 11.35, 0, 4.4, 0.25, 0.5, GOLD);
    pBox(P, s * 7.75, 15.05, 0, 1.9, 0.3, 3.0, JADE, 0, 0, s * 0.45); // upturned eave of the main roof
    pBox(P, s * 5.6, 15.5, 0, 0.5, 0.6, 0.5, GOLD);               // ridge finial
    lantern(P, G, s * 4.95, 9.95, 0, 0.42);                       // big lantern under the beam, outside the lanes
  }
  pBox(P, 0, 11.0, 0, 12.2, 0.8, 0.9, RED);                        // lower beam, underside 10.6
  pBox(P, 0, 12.5, -0.15, 8.6, 2.2, 0.3, LAQ);                     // name board backing
  pBox(P, 0, 13.8, 0, 12.2, 0.6, 0.9, RED);                        // upper beam
  for (let i = -2; i <= 2; i++) pBox(P, i * 2.4, 14.3, 0, 0.6, 0.4, 1.3, GOLD);   // brackets
  pBox(P, 0, 14.7, 0, 14.0, 0.35, 3.0, JADE);                      // main roof
  pBox(P, 0, 15.15, 0, 11.0, 0.35, 0.4, GOLD);                     // ridge
  sQuad(S, 8, 2, 0, 12.5, 0.02, 0, nameRect(0));
  return kit({ plain: P, glow: G, tabela: S });
}
// street dressing of one Chinatown segment (v = 0 / 1)
function ctDress(v) {
  const P = [], G = glowList(), S = [];
  lanternString(P, G, v ? -6 : -4);
  lanternString(P, G, v ? 4 : 6);
  const COL = [PAPER, GOLD, 0x1f6f6b, LAQ];
  for (let i = 0; i < 4; i++) {                                    // hanging vertical signs on brackets, readable from the track
    const s = i % 2 ? 1 : -1, z = -8 + i * 5 + v * 1.5, y = 5.2 + (i % 3) * 0.9;
    pBox(P, s * 6.9, y + 2.0, z, 1.9, 0.08, 0.08, INK);
    pBox(G, s * 6.3, y, z, 0.95, 3.6, 0.16, COL[(i + v) % 4]);
    for (let k = -1; k <= 1; k++) for (const f of [-1, 1]) pBox(G, s * 6.3, y + k * 1.1, z + f * 0.09, 0.6, 0.6, 0.02, (i + v) % 4 === 1 ? LAQ : GOLD);
  }
  for (const [s, z, i] of [[-1, 2.5, v * 2], [1, -3.5, v * 2 + 1]]) {      // shop name boards, face the track
    pBox(P, s * 7.02, 2.2, z, 0.12, 1.0, 6.3, INK);
    sQuad(S, 6, 0.75, s * 6.95, 2.2, z, -s * Math.PI / 2, shopRect(i));
  }
  const s = v ? 1 : -1;                                             // laundry line along one facade
  pBox(P, s * 6.6, 7.9, 0, 0.03, 0.03, 9, INK);
  [0xf7f1e4, 0xe8473a, 0x3ebd7a, 0xf2b632, 0x2f80ed].forEach((c, i) => pBox(P, s * 6.6, 7.5, -3.6 + i * 1.8, 0.04, 0.75, 0.95, c));
  return kit({ plain: P, glow: G, tabela: S });
}

function ctFest() {
  const base = ctDress(1), P = [], G = glowList();
  lanternString(P, G, 0, 4);
  const extra = kit({ plain: P, glow: G });
  return { ...base, plain: merge([base.plain, extra.plain]), glow: merge([base.glow, extra.glow]) };
}

const STEEL = 0x3b4352, GIRD = 0x5a6472, STONE = 0xc9b79c;
// main cable height over the 800 m bridge; towers stand at 200 m and 600 m
export const cableY = (m) => (m <= 200 ? 3 + 27 * (m / 200) ** 2 : m >= 600 ? 3 + 27 * ((800 - m) / 200) ** 2 : 6 + 24 * (2 * (m - 200) / 400 - 1) ** 2);
function cableSeg(k) {                         // segment k of 40: near edge at 20 k, far edge at 20 k + 20
  const P = [], G = glowList();
  const yA = cableY(20 * k), yB = cableY(20 * k + 20);
  for (const s of [-1, 1]) {
    pBox(P, s * 5.0, (yA + yB) / 2, 0, 0.45, 0.45, Math.hypot(20, yB - yA) + 0.3, STEEL, Math.atan2(yB - yA, 20));
    for (let j = 0; j < 8; j++) {                                  // suspenders every 2.5 m: the zoetrope
      const z = 8.75 - 2.5 * j, y = yA + (yB - yA) * (10 - z) / 20;
      if (y > 1.6) pBox(P, s * 5.0, (y + 1.0) / 2, z, 0.07, y - 1.0, 0.07, STEEL);
    }
    pBox(P, s * 4.6, -0.6, 0, 0.3, 1.4, 20, GIRD);                // edge girder
    pBox(P, s * 4.6, -3.4, 0, 0.25, 0.25, 20, GIRD);              // lower chord
    for (let j = 0; j < 4; j++) pBox(P, s * 4.6, -2.0, -7.5 + 5 * j, 0.18, 0.18, 5.7, GIRD, (j % 2 ? 1 : -1) * 0.5);
    if (k % 2 === 0) {                                             // lamp post every 40 m per side
      pCyl(P, s * 4.45, 3.2, 0, 0.07, 0.09, 4.0, 6, 0x2c2f36);
      pBox(G, s * 4.45, 5.3, 0, 0.5, 0.3, 0.5, 0xffd36b);
    }
  }
  for (const z of [-5, 5]) pBox(P, 0, -1.7, z, 9.4, 0.5, 0.5, 0x4c5562);   // cross beams under the deck
  return kit({ plain: P, glow: G });
}
// stone tower with one pointed arch over the three lanes; placed at the near edge (z = +10)
function tower() {
  const P = [];
  const sh = new THREE.Shape();
  sh.moveTo(-9.6, -42); sh.lineTo(9.6, -42); sh.lineTo(9.6, 31); sh.lineTo(-9.6, 31); sh.closePath();
  const h = new THREE.Path();
  h.moveTo(-5.4, -41.9); h.lineTo(-5.4, 13); h.quadraticCurveTo(-5.4, 20.5, 0, 24); h.quadraticCurveTo(5.4, 20.5, 5.4, 13); h.lineTo(5.4, -41.9); h.closePath();
  sh.holes.push(h);
  fin(P, new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false, curveSegments: 6 }), STONE, 0, 0, -2.5);
  pBox(P, 0, 31.6, 0, 20.6, 1.2, 6.0, 0xd9c9ae);                   // cornice
  pBox(P, 0, 32.5, 0, 19.2, 0.6, 5.0, STONE);
  for (const s of [-1, 1]) {
    pBox(P, s * 7.5, 25, 2.52, 1.1, 4.4, 0.08, 0x6e5f4c);         // slit window + pointed top
    pBox(P, s * 7.5, 27.2, 2.52, 0.78, 0.78, 0.08, 0x6e5f4c, 0, 0, Math.PI / 4);
    for (let y = -6; y <= 22; y += 4) pBox(P, s * 7.5, y, 2.52, 4.2, 0.14, 0.06, 0xa8967c);   // stone courses
    pBox(P, s * 5.43, 6, 2.52, 0.14, 14, 0.06, INK);              // ink edge of the arch jamb
  }
  return kit({ plain: P });
}
function vapur() {                             // the ferry far below (x 30, water at y -40)
  const P = [], x = 30, y = -40;
  pBox(P, x, y + 1.0, 0, 6, 2.0, 24, 0xf2f2f2);
  pBox(P, x, y + 0.3, 0, 6.1, 0.6, 24.1, 0x1c3f6e);
  pBox(P, x, y + 2.9, 1, 4.6, 1.8, 15, 0xf7f1e4);
  pBox(P, x, y + 3.0, 1, 4.7, 0.5, 14, 0x2b4562);
  pBox(P, x, y + 4.3, 2, 3.2, 1.0, 6, 0xf2f2f2);
  pCyl(P, x, y + 6.0, -1, 0.8, 0.9, 2.6, 10, 0xf2b632);
  pCyl(P, x, y + 7.0, -1, 0.82, 0.82, 0.6, 10, 0x12161f);
  return kit({ plain: P });
}

function tileQuad(L, w, h, x, y, z, ry, rect, W = 1024, H = 1024) {
  const g = new THREE.PlaneGeometry(w, h);
  const [px, py, pw, ph] = rect, uv = g.attributes.uv;
  for (let i = 0; i < 4; i++) uv.setXY(i, (px + uv.getX(i) * pw) / W, 1 - (py + (1 - uv.getY(i)) * ph) / H);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  g.deleteAttribute('normal');
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  L.push(g.toNonIndexed());
}

const SEC = [[-4.7, -1], [-4.7, 6], [-3.4, 9], [-1.3, 10.4], [1.3, 10.4], [3.4, 9], [4.7, 6], [4.7, -1]];
const FACE_LIGHT = [0.55, 0.8, 1, 1, 1, 0.8, 0.55];
// inward-facing shell; vertex colours carry the light rhythm (lamp every 5 m), map = tunnel atlas.
// open = true leaves the right wall and right haunch out (station side).
function shellGeo(open) {
  const pos = [], col = [], uv = [], idx = [];
  const dark = new THREE.Color(0x0b0e22), lit = new THREE.Color(0x3d6c98), c = new THREE.Color();
  for (let f = 0; f < 7 - (open ? 2 : 0); f++) {
    const [x0, y0] = SEC[f], [x1, y1] = SEC[f + 1];
    for (let j = 0; j < 8; j++) {                                   // 2.5 m slices: dark at z -10, -5, 0, 5, bright between
      const zA = 10 - j * 2.5, zB = zA - 2.5, base = pos.length / 3, cell = (Math.floor(j / 2) + f) % 3;
      for (const [x, y, z, u, v] of [[x0, y0, zA, 0, 0], [x0, y0, zB, 1, 0], [x1, y1, zB, 1, 1], [x1, y1, zA, 0, 1]]) {
        pos.push(x, y, z);
        const b = (j % 2 ? (z === zA ? 1 : 0.3) : (z === zA ? 0.3 : 1)) * FACE_LIGHT[f];
        c.copy(dark).lerp(lit, b); col.push(c.r, c.g, c.b);
        uv.push((cell + (j % 2 ? u * 0.5 + 0.5 : u * 0.5)) / 4, 1 - (1 - v) / 2);   // one concrete cell per 5 m
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function tunnelLights(G, open) {
  for (const z of [-7.5, -2.5, 2.5, 7.5]) pBox(G, 0, 10.33, z, 0.7, 0.08, 1.8, 0xc8f8ff);     // ceiling lamps
  for (const s of open ? [-1] : [-1, 1]) {
    pBox(G, s * 4.64, 3.3, 0, 0.06, 0.12, 20, 0x5ff3ff);          // cyan line
    pBox(G, s * 4.64, 0.9, 0, 0.06, 0.08, 20, 0xff2fa8);          // magenta line
    for (const z of [-10, 0]) pBox(G, s * 4.6, 2.5, z, 0.2, 7, 0.5, 0x0c0e1e);    // ribs (dark, strobe past)
  }
  for (const z of [-10, 0]) pBox(G, 0, 10.3, z, 2.6, 0.2, 0.5, 0x0c0e1e);
}
function shell() { const G = glowList(); tunnelLights(G, false); return { tunnel: shellGeo(false), glow: merge(G) }; }
// station: the right side opens onto a lit platform with a silhouette crowd (n people)
function station(n) {
  const G = glowList(), S = [], SIL = 0x14162a;
  tunnelLights(G, true);
  pBox(G, 8.7, 0.0, 0, 8.6, 2.0, 20, 0x8a8d96);                   // platform, top y 1.0, edge x 4.4
  pBox(G, 4.55, 1.02, 0, 0.3, 0.05, 20, 0xffe23a);                // safety line
  pBox(G, 7.2, 10.5, 0, 11.8, 0.2, 20, 0x2a2f48);                 // station ceiling
  for (const z of [-7.5, -2.5, 2.5, 7.5]) {
    pBox(G, 5.4, 5.7, z, 0.35, 9.4, 0.35, 0x2f80c4);              // columns
    pBox(G, 9.0, 10.3, z, 5.0, 0.12, 0.5, 0xffe9b0);              // warm platform lights
  }
  for (let i = 0; i < 4; i++) {                                     // tiled back wall, 5 m per cell
    const cell = [3, 4, 5, 6][i];
    tileQuad(S, 5, 5, 12.98, 3.5, 7.5 - i * 5, -Math.PI / 2, [(cell % 4) * 256, Math.floor(cell / 4) * 256, 256, 256], 1024, 512);
    tileQuad(S, 5, 4.4, 12.98, 8.2, 7.5 - i * 5, -Math.PI / 2, [768, 0, 256, 180], 1024, 512);
  }
  const r = rng(77 + n);
  for (let i = 0; i < n; i++) {                                     // silhouette people on the platform
    const x = 6.4 + r() * 4.6, z = -9 + (i + r() * 0.6) * (18 / n), sc = 0.9 + r() * 0.25;
    pBox(G, x, 1.0 + 0.4 * sc, z, 0.4, 0.8 * sc, 0.28, SIL);
    pBox(G, x, 1.0 + 1.18 * sc, z, 0.56, 0.76 * sc, 0.32, SIL);
    pSph(G, x, 1.0 + 1.78 * sc, z, 0.21, 1, i === 2 ? 0xd8262c : SIL);   // one kid in a red cap
    if (i === 2) pBox(G, x - 0.38, 1.0 + 1.75 * sc, z, 0.14, 0.6, 0.14, SIL, 0, 0, 0.5);   // ... waving
    if (i === 4) pBox(G, x - 0.3, 1.0 + 1.3 * sc, z, 0.02, 0.16, 0.1, 0xffffff);          // phone glow
  }
  return { tunnel: merge([shellGeo(true).toNonIndexed(), ...S]), glow: merge(G) };
}
// concrete headwall with the mouth cut out; 2 m thick, placed at the near edge (z = +10 .. +12)
function mouth() {
  const P = [], G = glowList(), S = [];
  const sh = new THREE.Shape();
  sh.moveTo(-44, -42); sh.lineTo(44, -42); sh.lineTo(44, 21); sh.lineTo(-44, 21); sh.closePath();
  const h = new THREE.Path();
  SEC.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
  h.closePath(); sh.holes.push(h);
  fin(P, new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false }), 0x8a8d96, 0, 0, 0);
  pBox(P, 0, 21.4, 1, 88, 0.8, 2.6, 0x6b6f78);                     // parapet
  for (let f = 0; f < 7; f++) {                                     // hazard band around the mouth
    const [x0, y0] = SEC[f], [x1, y1] = SEC[f + 1], L = Math.hypot(x1 - x0, y1 - y0);
    const nx = (y1 - y0) / L, ny = -(x1 - x0) / L;                  // outward normal of the section
    pBox(P, (x0 + x1) / 2 - nx * 0.35, (y0 + y1) / 2 - ny * 0.35, 2.05, L + 0.5, 0.7, 0.12, f % 2 ? 0x12161f : 0xf2b632, 0, 0, Math.atan2(y1 - y0, x1 - x0));
  }
  pBox(P, 0, 13.3, 2.05, 8.6, 2.5, 0.2, 0x12161f);                 // name board backing
  sQuad(S, 8, 2, 0, 13.3, 2.17, 0, nameRect(2));
  pCyl(G, 0, 17.4, 2.1, 1.7, 1.7, 0.2, 20, 0x2f80c4, Math.PI / 2); // blue roundel
  for (const [x, rz] of [[-0.75, 0], [0.75, 0], [-0.37, -0.5], [0.37, 0.5]]) pBox(G, x, 17.4 + (rz ? 0.25 : 0), 2.22, 0.3, rz ? 1.3 : 1.9, 0.06, 0xffffff, 0, 0, rz);   // "M"
  return kit({ plain: P, glow: G, tabela: S });
}

function midtownSign() {                       // dawn gantry: back in Midtown
  const P = [], S = [];
  for (const s of [-1, 1]) pBox(P, s * 6.2, 0.5, 0, 0.5, 23, 0.5, 0x4c5562);
  pBox(P, 0, 11.6, 0, 12.9, 0.5, 0.5, 0x4c5562);
  pBox(P, 0, 13.4, 0, 8.6, 2.6, 0.25, 0x12161f);
  sQuad(S, 8, 2, 0, 13.4, 0.14, 0, nameRect(4));
  return kit({ plain: P, tabela: S });
}

export function createCityPieces() {
  const pieces = { tower: tower(), vapur: vapur(), midtownSign: midtownSign(),
    ct0: ctDress(0), ct1: ctDress(1), ctFest: ctFest(), gate: gate(),
    shell: shell(), station0: station(4), station1: station(8), station2: station(5), mouth: mouth() };
  for (let k = 0; k < 40; k++) pieces[`cable${k}`] = cableSeg(k);
  for (const name in pieces) {
    for (const kind of ['plain', 'glow', 'tunnel']) pieces[name][kind]?.computeBoundingSphere();
    const expected = ANCHOR_COUNTS[name];
    if (expected === undefined) continue;
    for (const kind of ['tabela', 'ads', 'bugle']) {
      const count = typeof expected === 'number' ? (kind === 'tabela' ? expected : 0) : (expected[kind] || 0);
      if ((pieces[name].anchors[kind]?.length || 0) !== count) throw new Error(`City anchor count: ${name}.${kind}`);
    }
  }
  return pieces;
}
