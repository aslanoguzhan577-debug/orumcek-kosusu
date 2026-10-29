// pickup-art.js — art for the two power-up pickups. No game logic.
//
//   import { createWebPickup, createIronPickup, createSensePickup, createMagnetPickup } from './pickup-art.js';
//   const p = createWebPickup();   // { root, update(dt) }
//   scene.add(p.root); p.root.position.set(x, y, z);  // y = surface the item hovers over
//   every frame: p.update(dt);
//
// Sense = Funko head + yellow spider-sense squiggles, Magnet = red horseshoe magnet with silver
// tips and a spider badge; same interface, 5 draw calls each. drawPowerIcon(canvas, 'sense' |
// 'magnet') paints the matching 2D HUD icon.
// All are about 1 m tall including the float: the lowest point hovers ~0.1 m above the
// origin (bottom centre), the highest reaches ~1.0 m. They spin and bob by themselves;
// every instance starts at a random phase, so pooled copies do not move in sync.
// Draw calls per instance: 4 (body, outline, symbol decal, glow sprite; the glow is a soft
// normal-blended halo because additive glow disappears against the bright sky and track).
// Geometries, materials and textures are shared by all instances; update() allocates nothing.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  toonMaterial, addOutline, roundCube, smoothNormals, facePatch,
  canvasTexture as canvasTextureWH,
} from './models/toon.js';
import { paintLenses } from './models/spiderman.js';

const INK = 0x111111;
const OUTLINE = 0.032;

// ---------- canvas textures ----------
function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function strokeInked(g, fill, inkWidth, fillWidth, path) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#111111';
  g.lineWidth = inkWidth;
  path();
  g.stroke();
  g.strokeStyle = fill;
  g.lineWidth = fillWidth;
  path();
  g.stroke();
}

// white web: 8 spokes + 3 sagging rings, ink outline
function drawWeb(g, S) {
  const c = S / 2, R = S * 0.42;
  const spokes = 8;
  const path = () => {
    g.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + Math.PI / 8;
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
    }
    for (const k of [0.34, 0.62, 0.95]) {
      for (let i = 0; i < spokes; i++) {
        const a0 = (i / spokes) * Math.PI * 2 + Math.PI / 8;
        const a1 = ((i + 1) / spokes) * Math.PI * 2 + Math.PI / 8;
        const x0 = c + Math.cos(a0) * R * k, y0 = c + Math.sin(a0) * R * k;
        const x1 = c + Math.cos(a1) * R * k, y1 = c + Math.sin(a1) * R * k;
        const am = (a0 + a1) / 2;
        const sag = k * 0.86;
        g.moveTo(x0, y0);
        g.quadraticCurveTo(c + Math.cos(am) * R * sag, c + Math.sin(am) * R * sag, x1, y1);
      }
    }
  };
  strokeInked(g, '#ffffff', S * 0.075, S * 0.032, path);
}

// gold spider with ink outline
function drawSpider(g, S, fill = '#ffc83a') {
  const c = S / 2;
  const legs = () => {
    g.beginPath();
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const ang = (-0.55 + i * 0.36) ; // fan from upper to lower
        const y0 = c + (i - 1.5) * S * 0.045;
        const kx = c + sx * S * (0.2 + 0.05 * Math.cos(ang * 2));
        const ky = c + (i - 1.5) * S * 0.16 - S * 0.07;
        const ex = c + sx * S * 0.4;
        const ey = c + (i - 1.5) * S * 0.2 + S * 0.05;
        g.moveTo(c + sx * S * 0.05, y0);
        g.lineTo(kx, ky);
        g.lineTo(ex, ey);
      }
    }
  };
  strokeInked(g, fill, S * 0.09, S * 0.045, legs);
  g.lineWidth = S * 0.025;
  g.strokeStyle = '#111111';
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(c, c - S * 0.12, S * 0.07, S * 0.07, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(c, c + S * 0.08, S * 0.1, S * 0.17, 0, 0, Math.PI * 2); g.fill(); g.stroke();
}

function drawGlow(g, S) {
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
}

// ---------- shared resources (built on first use) ----------
let shared = null;

function addColors(geo, colorOfVertex) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    c.setHex(colorOfVertex(i, geo));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function buildWebBody() {
  const N = 0x1d3a8a, B = 0x2f8cff, W = 0xffffff;
  // [radius, y, colour]; doubled points make hard colour edges
  const prof = [
    [0.00, 0.00, N], [0.22, 0.00, N], [0.28, 0.02, N], [0.305, 0.07, N], [0.31, 0.14, N],
    [0.31, 0.14, B], [0.31, 0.19, B],
    [0.31, 0.19, W], [0.31, 0.23, W], [0.31, 0.23, B],
    [0.31, 0.62, B],
    [0.31, 0.62, W], [0.31, 0.66, W], [0.31, 0.66, B],
    [0.31, 0.70, B], [0.31, 0.70, N], [0.305, 0.74, N], [0.28, 0.79, N], [0.22, 0.81, N],
    [0.16, 0.81, W], [0.10, 0.83, W], [0.10, 0.90, W], [0.085, 0.94, W], [0.0, 0.95, W],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  const per = prof.length;
  return addColors(geo, (i) => prof[i % per][2]);
}

function buildIronBody() {
  const R = 0.36, CY = 0.5;
  const orb = new THREE.SphereGeometry(R, 24, 16).translate(0, CY, 0);
  addColors(orb, () => 0xd8232a);
  const ring = new THREE.TorusGeometry(0.46, 0.045, 8, 32).translate(0, CY, 0);
  addColors(ring, () => 0xffc83a);
  const ring2 = new THREE.TorusGeometry(0.4, 0.035, 8, 28).rotateY(Math.PI / 2).translate(0, CY, 0);
  addColors(ring2, () => 0xffa21f);
  const cap = new THREE.CylinderGeometry(0.1, 0.12, 0.08, 10).translate(0, CY + R + 0.02, 0);
  addColors(cap, () => 0xffc83a);
  const geo = mergeGeometries([orb, ring, ring2, cap]);
  for (const g of [orb, ring, ring2, cap]) g.dispose();
  return geo;
}

function buildShared() {
  const web = {};
  web.geo = buildWebBody();
  web.mat = toonMaterial(0xffffff, { vertexColors: true, emissive: 0x0b2a66 });
  // decal: two curved patches (front and back) hugging the canister
  const W = 0.31 + 0.006;
  const arc = 1.25;
  const a = new THREE.CylinderGeometry(W, W, 0.5, 14, 1, true, -arc / 2, arc).translate(0, 0.43, 0);
  const b = new THREE.CylinderGeometry(W, W, 0.5, 14, 1, true, Math.PI - arc / 2, arc).translate(0, 0.43, 0);
  web.decalGeo = mergeGeometries([a, b]);
  a.dispose(); b.dispose();
  web.decalMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(256, drawWeb), transparent: true, depthWrite: false, toneMapped: false,
  });
  web.glowMat = new THREE.SpriteMaterial({
    map: canvasTexture(128, drawGlow), color: 0xa8e4ff, transparent: true, opacity: 0.85, depthWrite: false,
  });

  const iron = {};
  iron.geo = buildIronBody();
  iron.mat = toonMaterial(0xffffff, { vertexColors: true, emissive: 0x4a0c0c });
  // decal: front and back caps of a slightly larger sphere
  const R = 0.36 + 0.007;
  const L = 1.5;
  const f = new THREE.SphereGeometry(R, 16, 12, Math.PI / 2 - L / 2, L, Math.PI / 2 - L / 2, L).translate(0, 0.5, 0);
  const k = new THREE.SphereGeometry(R, 16, 12, (3 * Math.PI) / 2 - L / 2, L, Math.PI / 2 - L / 2, L).translate(0, 0.5, 0);
  iron.decalGeo = mergeGeometries([f, k]);
  f.dispose(); k.dispose();
  iron.decalMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(256, drawSpider), transparent: true, depthWrite: false, toneMapped: false,
  });
  iron.glowMat = new THREE.SpriteMaterial({
    map: web.glowMat.map, color: 0xffa83a, transparent: true, opacity: 0.8, depthWrite: false,
  });
  return { web, iron };
}

// ---------- instance builder ----------
function makePickup(kind, glowBase, glowY) {
  if (!shared) shared = buildShared();
  const s = shared[kind];

  const root = new THREE.Group();
  root.name = kind === 'web' ? 'web-pickup' : 'iron-pickup';

  const spin = new THREE.Group(); // spins around Y and bobs
  const body = new THREE.Mesh(s.geo, s.mat);
  addOutline(body, OUTLINE, INK);
  const decal = new THREE.Mesh(s.decalGeo, s.decalMat);
  decal.renderOrder = 1;
  spin.add(body, decal);
  root.add(spin);

  const glow = new THREE.Sprite(s.glowMat);
  glow.scale.set(glowBase, glowBase, 1);
  glow.position.y = glowY;
  glow.renderOrder = 2;
  root.add(glow);

  const baseY = 0.1;                    // hover height of the lowest point
  let t = Math.random() * 20;
  const spinSpeed = kind === 'web' ? 1.5 : 2.0;

  const update = (dt) => {
    t += dt;
    spin.rotation.y += dt * spinSpeed;
    const bob = Math.sin(t * 2.6) * 0.055;
    spin.position.y = baseY + bob;
    glow.position.y = glowY + baseY + bob;
    const pulse = glowBase * (1 + 0.1 * Math.sin(t * 4.2));
    glow.scale.set(pulse, pulse, 1);
  };
  update(0);
  return { root, update };
}

export function createWebPickup() {
  return makePickup('web', 2.0, 0.47);
}

export function createIronPickup() {
  return makePickup('iron', 2.0, 0.5);
}

// ================= Spider-sense and Magnet =================
// 2D drawing helpers (also used for the HUD icons), then the 3D builders.

const HR = 0.23; // head half-size as a fraction of the logo square

function roundedSquare(g, x, y, w, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + w, r);
  g.arcTo(x + w, y + w, x, y + w, r);
  g.arcTo(x, y + w, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// face lenses: E maps face units (X = 1 at the side of the head, Y = 1 at the top) to pixels
function drawFaceLenses(g, cx, cy, unit, frameW) {
  const E = (X, Y) => [cx + X * unit, cy - (Y - 0.09) * unit];
  paintLenses(g, E, unit, { frameW });
}

// halftone dots (a hint) + 7 yellow zigzag squiggles around a head of half-size HR*S
const BOLTS = [ // [angle (deg, up = +), length, first zig side]
  [90, 0.165, 1], [58, 0.18, -1], [122, 0.18, 1], [28, 0.185, 1],
  [152, 0.185, -1], [-2, 0.155, -1], [182, 0.155, 1],
];
function drawSenseBolts(g, S, dots) {
  const c = S / 2;
  if (dots) {
    const step = S * 0.05, rin = HR * S * 1.08, rout = S * 0.485;
    g.fillStyle = 'rgba(255, 205, 20, 0.9)';
    for (let iy = -12; iy <= 12; iy++) {
      for (let ix = -12; ix <= 12; ix++) {
        const x = (ix + (iy & 1) * 0.5) * step, y = iy * step * 0.87;
        const rr = Math.hypot(x, y);
        if (rr < rin || rr > rout || -y < -0.35 * rr) continue; // none far below the head
        const k = 1 - (rr - rin) / (rout - rin);
        g.beginPath();
        g.arc(c + x, c + y, step * 0.36 * k, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const path = () => {
    g.beginPath();
    for (const [deg, len, side] of BOLTS) {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a), uy = -Math.sin(a), px = -uy, py = ux;
      const ext = Math.pow(Math.pow(Math.abs(ux), 3) + Math.pow(Math.abs(uy), 3), -1 / 3);
      const r0 = (HR * ext + 0.03) * S, L = len * S, amp = 0.036 * S * side;
      const off = [0, 1, -1, 1, 0];
      for (let i = 0; i < 5; i++) {
        const d = r0 + (L * i) / 4;
        const x = c + ux * d + px * amp * off[i], y = c + uy * d + py * amp * off[i];
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    }
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#111111'; g.lineWidth = S * 0.088; path(); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.058; path(); g.stroke();
  g.strokeStyle = '#ffd400'; g.lineWidth = S * 0.032; path(); g.stroke();
}

// the Funko head, front view, as a flat HUD picture
function drawSenseHead2D(g, S) {
  const c = S / 2, h = HR * S;
  roundedSquare(g, c - h, c - h, h * 2, h * 0.5);
  g.fillStyle = '#d0192b';
  g.fill();
  g.lineWidth = S * 0.04;
  g.strokeStyle = '#111111';
  g.lineJoin = 'round';
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; // vinyl shine
  g.lineWidth = S * 0.025;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(c - h * 0.82, c - h * 0.35);
  g.quadraticCurveTo(c - h * 0.82, c - h * 0.82, c - h * 0.35, c - h * 0.82);
  g.stroke();
  drawFaceLenses(g, c, c, h * 0.9, 0.09);
}

function drawMagnet2D(g, S) {
  const cx = S / 2, R = S * 0.18, cy = S * 0.6, tipTop = S * 0.32, tipBot = S * 0.46, tw = S * 0.2;
  const body = () => {
    g.beginPath();
    g.moveTo(cx - R, tipBot - S * 0.02);
    g.lineTo(cx - R, cy);
    g.arc(cx, cy, R, Math.PI, 0, true);
    g.lineTo(cx + R, tipBot - S * 0.02);
  };
  g.lineCap = 'butt';
  g.lineJoin = 'round';
  g.strokeStyle = '#111111'; g.lineWidth = tw + S * 0.07; body(); g.stroke();
  g.strokeStyle = '#d8232a'; g.lineWidth = tw; body(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = S * 0.03; // shine on the outer side
  g.beginPath();
  g.arc(cx, cy, R + tw * 0.28, Math.PI * 0.95, Math.PI * 0.62, true);
  g.stroke();
  for (const sx of [-1, 1]) { // silver tips
    const x = cx + sx * R;
    g.fillStyle = '#111111';
    g.fillRect(x - tw / 2 - S * 0.035, tipTop - S * 0.035, tw + S * 0.07, tipBot - tipTop + S * 0.035);
    g.fillStyle = '#dfe4ea';
    g.fillRect(x - tw / 2, tipTop, tw, tipBot - tipTop);
    g.fillStyle = '#8b93a3';
    g.fillRect(x - tw / 2, tipBot - S * 0.045, tw, S * 0.045);
    g.fillStyle = '#ffffff';
    g.fillRect(x - tw / 2 + S * 0.025, tipTop + S * 0.012, S * 0.035, tipBot - tipTop - S * 0.07);
  }
  // attraction arcs over the tips
  g.lineCap = 'round';
  g.setLineDash([S * 0.05, S * 0.04]);
  for (const [rx, ry] of [[R, S * 0.2], [R + S * 0.115, S * 0.28]]) {
    g.strokeStyle = '#111111'; g.lineWidth = S * 0.07;
    g.beginPath(); g.ellipse(cx, tipTop - S * 0.02, rx, ry, 0, Math.PI, 0); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.04;
    g.beginPath(); g.ellipse(cx, tipTop - S * 0.02, rx, ry, 0, Math.PI, 0); g.stroke();
  }
  g.setLineDash([]);
  // spider badge on the bend
  const bs = S * 0.2, bx = cx, by = cy + R;
  g.fillStyle = '#1d3a8a'; g.strokeStyle = '#111111'; g.lineWidth = S * 0.025;
  g.beginPath(); g.arc(bx, by, bs * 0.5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.save(); g.translate(bx - bs / 2, by - bs / 2); drawSpider(g, bs); g.restore();
}

// HUD icon: draws into an existing canvas (any square size)
export function drawPowerIcon(canvas, kind) {
  const g = canvas.getContext('2d');
  const S = canvas.width;
  g.clearRect(0, 0, S, S);
  if (kind === 'sense') {
    drawSenseBolts(g, S, S >= 160);
    drawSenseHead2D(g, S);
  } else {
    drawMagnet2D(g, S);
  }
}

// ---------- 3D: shared resources ----------
const SENSE_R = 0.25;              // head half-size (m)
const SENSE_SPRITE = SENSE_R / HR; // size of the squiggle sprite (m)
const SENSE_YC = 0.4;              // head centre above the origin
const MG = { R: 0.2, r: 0.105, leg: 0.25, tip: 0.16, flat: 0.75 }; // magnet dims (m)
const MG_TIP_Y = MG.R + MG.r + MG.leg + MG.tip; // top of the tips above the lowest point

class UCurve extends THREE.Curve {
  constructor(R, L) { super(); this.R = R; this.L = L; this.tot = 2 * L + Math.PI * R; }
  getPoint(u, out = new THREE.Vector3()) {
    const { R, L, tot } = this, s = u * tot;
    if (s < L) return out.set(-R, L - s, 0);
    if (s < L + Math.PI * R) { const a = (s - L) / R; return out.set(-R * Math.cos(a), -R * Math.sin(a), 0); }
    return out.set(R, s - L - Math.PI * R, 0);
  }
}

function buildHeadGeo() {
  const geo = new THREE.SphereGeometry(SENSE_R, 28, 18);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    roundCube(v, 3);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return smoothNormals(geo);
}

function buildMagnetBody() {
  const { R, r, leg, tip } = MG;
  const tube = new THREE.TubeGeometry(new UCurve(R, leg), 48, r, 12, false);
  addColors(tube, () => 0xd8232a);
  const parts = [tube];
  const rr = r * 1.06;
  // [radius, y, colour]; doubled points = hard colour edges (dark band at the base)
  const D = 0x4a4f5a, Sv = 0xdfe4ea;
  const prof = [
    [0, 0, D], [rr, 0, D], [rr, 0.03, D], [rr, 0.03, Sv], [rr, tip - 0.03, Sv],
    [rr - 0.015, tip - 0.012, Sv], [rr - 0.04, tip, Sv], [0, tip, Sv],
  ];
  const lathe = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 14);
  addColors(lathe, (i) => prof[i % prof.length][2]);
  for (const sx of [-1, 1]) parts.push(lathe.clone().translate(sx * R, leg, 0));
  lathe.dispose();
  const geo = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  geo.scale(1, 1, MG.flat);   // chunky but flat-ish, so the badge sits on it
  geo.translate(0, R + r, 0); // lowest point at y = 0
  return geo;
}

function drawBolts(g, S) { drawSenseBolts(g, S, true); }

function drawField(g, S) {
  const c = S / 2;
  g.lineCap = 'round';
  g.setLineDash([S * 0.045, S * 0.035]);
  for (const [rx, ry] of [[0.2, 0.26], [0.31, 0.4]]) {
    g.beginPath(); g.ellipse(c, c, (rx * S) / 0.9, (ry * S) / 0.9, 0, Math.PI, 0);
    g.strokeStyle = '#111111'; g.lineWidth = S * 0.05; g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.026; g.stroke();
  }
  g.setLineDash([]);
  g.fillStyle = '#ffd400'; g.strokeStyle = '#111111'; g.lineWidth = S * 0.012;
  for (const [x, y, k] of [[0.5, 0.075, 1], [0.215, 0.2, 0.7], [0.785, 0.2, 0.7]]) { // sparkles
    const cx = S * x, cy = S * y, a = S * 0.04 * k, b = S * 0.012 * k;
    g.beginPath();
    g.moveTo(cx, cy - a); g.lineTo(cx + b, cy - b); g.lineTo(cx + a, cy); g.lineTo(cx + b, cy + b);
    g.lineTo(cx, cy + a); g.lineTo(cx - b, cy + b); g.lineTo(cx - a, cy); g.lineTo(cx - b, cy - b);
    g.closePath(); g.fill(); g.stroke();
  }
}

let shared2 = null;
function buildShared2() {
  if (!shared) shared = buildShared();
  const glowTex = shared.web.glowMat.map;
  // ----- sense
  const sense = {};
  sense.headGeo = buildHeadGeo();
  sense.headMat = toonMaterial(0xd0192b, {
    shade: 'soft', emissive: 0x3a0508, gloss: { color: 0xffffff, strength: 0.55, threshold: 0.95, soft: 0.012 },
  });
  const A = 0.9, B0 = 0.62, B1 = 0.68;
  sense.faceGeo = facePatch(SENSE_R, -A, A, -B0, B1, 0.008, { segX: 22, segY: 12, deform: (v) => roundCube(v, 3) });
  const FW = 256, FH = Math.round((FW * (B0 + B1)) / (2 * A));
  sense.faceMat = new THREE.MeshBasicMaterial({
    map: canvasTextureWH(FW, FH, (g, w, h) => drawFaceLenses(g, w / 2, h / 2, w * 0.47, 0.09)),
    transparent: true, depthWrite: false, toneMapped: false,
  });
  sense.boltMat = new THREE.SpriteMaterial({ map: canvasTexture(512, drawBolts), transparent: true, depthWrite: false });
  sense.glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false });
  // ----- magnet
  const mag = {};
  mag.geo = buildMagnetBody();
  mag.mat = toonMaterial(0xffffff, {
    vertexColors: true, shade: 'soft', emissive: 0x3a0a0c,
    gloss: { color: 0xffffff, strength: 0.5, threshold: 0.95, soft: 0.012 },
  });
  const zf = MG.r * MG.flat + 0.006, br = 0.088, by = MG.r;
  const f = new THREE.CircleGeometry(br, 20).rotateY(Math.PI).translate(0, by, -zf);
  const k = new THREE.CircleGeometry(br, 20).translate(0, by, zf);
  mag.badgeGeo = mergeGeometries([f, k]);
  f.dispose(); k.dispose();
  mag.badgeMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(128, (g, S) => {
      g.fillStyle = '#1d3a8a'; g.fillRect(0, 0, S, S);
      g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.06; g.strokeRect(0, 0, S, S);
      drawSpider(g, S);
    }), transparent: true, depthWrite: false, toneMapped: false,
  });
  mag.fieldMat = new THREE.SpriteMaterial({ map: canvasTexture(256, drawField), transparent: true, depthWrite: false });
  mag.glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff7b7b, transparent: true, opacity: 0.8, depthWrite: false });
  return { sense, mag };
}

export function createSensePickup() {
  if (!shared2) shared2 = buildShared2();
  const s = shared2.sense;
  const root = new THREE.Group();
  root.name = 'sense-pickup';
  const spin = new THREE.Group(); // bobs
  const head = new THREE.Group(); // sways, face toward the camera (+Z)
  const body = new THREE.Mesh(s.headGeo, s.headMat);
  addOutline(body, OUTLINE, INK);
  const face = new THREE.Mesh(s.faceGeo, s.faceMat);
  face.renderOrder = 1;
  head.add(body, face);
  const glow = new THREE.Sprite(s.glowMat);
  glow.renderOrder = 2;
  glow.position.z = -0.35; // behind the head: the halo must not wash over the outline
  const bolts = new THREE.Sprite(s.boltMat);
  bolts.renderOrder = 3;
  bolts.position.z = 0.3; // in front of the head: its corners swing out over the squiggles
  spin.add(head, glow, bolts);
  root.add(spin);

  let t = Math.random() * 20;
  const update = (dt) => {
    t += dt;
    spin.position.y = SENSE_YC + Math.sin(t * 2.6) * 0.05;
    head.rotation.y = Math.PI + Math.sin(t * 1.7) * 0.7;
    // comic flicker: the squiggles jump between two sizes at an uneven rhythm
    const fl = Math.sin(t * 17) + Math.sin(t * 7.3) > 0.4 ? 1.07 : 0.97;
    bolts.scale.setScalar(SENSE_SPRITE * fl);
    glow.scale.setScalar(2.0 * (1 + 0.1 * Math.sin(t * 4.2)));
  };
  update(0);
  return { root, update };
}

export function createMagnetPickup() {
  if (!shared2) shared2 = buildShared2();
  const s = shared2.mag;
  const root = new THREE.Group();
  root.name = 'magnet-pickup';
  const spin = new THREE.Group(); // spins and bobs
  const body = new THREE.Mesh(s.geo, s.mat);
  addOutline(body, OUTLINE, INK);
  const badge = new THREE.Mesh(s.badgeGeo, s.badgeMat);
  badge.renderOrder = 1;
  spin.add(body, badge);
  const glow = new THREE.Sprite(s.glowMat);
  glow.renderOrder = 2;
  glow.position.z = -0.35;
  const field = new THREE.Sprite(s.fieldMat.clone()); // own opacity per instance
  field.renderOrder = 3;
  root.add(spin, glow, field);

  const baseY = 0.1;
  let t = Math.random() * 20;
  const update = (dt) => {
    t += dt;
    spin.rotation.y += dt * 2.0;
    const bob = Math.sin(t * 2.6) * 0.055;
    spin.position.y = baseY + bob;
    glow.position.y = 0.4 + baseY + bob;
    field.position.y = MG_TIP_Y + baseY + bob;
    // the dashed field lines keep closing in on the tips: shrink and fade in a loop
    const k = (t * 1.3) % 1;
    field.scale.setScalar(0.9 * (1.2 - 0.3 * k));
    field.material.opacity = Math.sin(Math.PI * k);
    glow.scale.setScalar(1.9 * (1 + 0.1 * Math.sin(t * 4.2)));
  };
  update(0);
  return { root, update };
}
