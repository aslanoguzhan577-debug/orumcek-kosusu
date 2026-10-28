// pickup-art.js — art for the two power-up pickups. No game logic.
//
//   import { createWebPickup, createIronPickup } from './pickup-art.js';
//   const p = createWebPickup();   // { root, update(dt) }
//   scene.add(p.root); p.root.position.set(x, y, z);  // y = surface the item hovers over
//   every frame: p.update(dt);
//
// Both are about 1 m tall including the float: the lowest point hovers ~0.1 m above the
// origin (bottom centre), the highest reaches ~1.0 m. They spin and bob by themselves;
// every instance starts at a random phase, so pooled copies do not move in sync.
// Draw calls per instance: 4 (body, outline, symbol decal, glow sprite; the glow is a soft
// normal-blended halo because additive glow disappears against the bright sky and track).
// Geometries, materials and textures are shared by all instances; update() allocates nothing.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial, addOutline } from './models/toon.js';

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
function drawSpider(g, S) {
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
  strokeInked(g, '#ffc83a', S * 0.09, S * 0.045, legs);
  g.lineWidth = S * 0.025;
  g.strokeStyle = '#111111';
  g.fillStyle = '#ffc83a';
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
