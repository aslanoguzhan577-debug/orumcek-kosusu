// hulk.js — the Hulk as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter), same height / hitbox: green skin, messy dark green-black hair, small
// black eyes under an angry brow, a white-toothed grimace, bulky torso / arms / legs (the torso
// mesh and limb groups are scaled wider, not taller) and torn purple shorts.
//   createHulk() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { toonMaterial, addOutline, mergeGeos, smoothNormals } from './toon.js';
import { createSpiderCharacter, SPIDER_DIM, SATIN, OUTLINE_COLOR } from './spiderman.js';

const GREEN = '#6cb83e';
const GREEN_DK = '#3f8226';
const HAIR = '#1c2a17';
const PURPLE = '#6d3fa3';
const PURPLE_DK = '#4a2a75';
const INK = '#14110f';
const D = SPIDER_DIM;

function poly(g, P, pts, fill) {
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

// ragged hem: zigzag from x0 to x1 around y
const zig = (x0, x1, y, n, amp) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + (i % 2 ? -amp : amp)]);

function muscles(g, P, front) {
  g.strokeStyle = GREEN_DK;
  g.lineWidth = 5;
  g.lineCap = 'round';
  const line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => { const p = P(x, y); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke(); };
  if (front) {
    line([[0, 0.4], [0, 0.12]]);                                  // sternum / abs line
    for (const s of [-1, 1]) {
      line([[s * 0.01, 0.31], [s * 0.1, 0.285], [s * 0.19, 0.31]]); // pec underside
      for (const y of [0.22, 0.17]) line([[s * 0.01, y], [s * 0.1, y - 0.005]]);
    }
  } else {
    line([[0, 0.45], [0, 0.1]]);
    for (const s of [-1, 1]) { line([[s * 0.02, 0.38], [s * 0.12, 0.3], [s * 0.2, 0.34]]); line([[s * 0.02, 0.25], [s * 0.14, 0.18]]); }
  }
  // torn purple shorts at the waist
  poly(g, P, [[-0.3, 0.07], ...zig(-0.3, 0.3, 0.07, 10, 0.012), [0.3, -0.2], [-0.3, -0.2]], PURPLE);
  poly(g, P, [[-0.3, 0.07], [0.3, 0.07], [0.3, 0.045], [-0.3, 0.045]], PURPLE_DK);
}

const HULK_LOOK = {
  head: { color: GREEN },
  face(g, E) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // ragged hairline across the forehead
    poly(g, E, [[-1, 1.1], [-1, 0.55], ...zig(-1, 1, 0.6, 12, 0.12), [1, 0.55], [1, 1.1]], HAIR);
    // heavy angry brow: thick dark-green bars sloping down to the nose
    g.strokeStyle = GREEN_DK;
    g.lineWidth = 34;
    for (const s of [-1, 1]) {
      const a = E(s * 0.78, 0.4), b = E(s * 0.1, 0.18);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // small black eyes under the brow
    for (const s of [-1, 1]) {
      const c = E(s * 0.4, 0.04), r = E(0.08, 0)[0] - E(0, 0)[0];
      g.beginPath(); g.ellipse(c[0], c[1], Math.abs(r), Math.abs(r) * 0.8, 0, 0, Math.PI * 2);
      g.fillStyle = INK; g.fill();
    }
    // nostrils
    for (const s of [-1, 1]) {
      const c = E(s * 0.1, -0.22);
      g.beginPath(); g.arc(c[0], c[1], 7, 0, Math.PI * 2); g.fillStyle = GREEN_DK; g.fill();
    }
    // grimace: wide dark mouth, a row of white teeth top and bottom
    const m = [[-0.55, -0.5], [0.55, -0.5], [0.5, -0.78], [-0.5, -0.78]];
    poly(g, E, m, INK);
    poly(g, E, [[-0.5, -0.52], [0.5, -0.52], [0.5, -0.6], [-0.5, -0.6]], '#fbfbf5');
    poly(g, E, [[-0.46, -0.7], [0.46, -0.7], [0.46, -0.76], [-0.46, -0.76]], '#fbfbf5');
    g.strokeStyle = INK;
    g.lineWidth = 3;
    for (let i = -4; i <= 4; i++) {
      const a = E(i * 0.11, -0.52), b = E(i * 0.11, -0.6), c = E(i * 0.11, -0.7), d = E(i * 0.11, -0.76);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke();
    }
    // sunken cheek / jaw shading
    g.strokeStyle = GREEN_DK;
    g.lineWidth = 8;
    for (const s of [-1, 1]) {
      const a = E(s * 0.62, -0.3), b = E(s * 0.7, -0.62);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  },
  lensGlow: 0x000000,
  torsoBase: GREEN,
  torsoFront(g, P) { muscles(g, P, true); },
  torsoBack(g, P) { muscles(g, P, false); },
  arm(g, W, H) { g.fillStyle = GREEN; g.fillRect(0, 0, W, H); },
  fore(g, W, H) { g.fillStyle = GREEN; g.fillRect(0, 0, W, H); },
  thigh(g, W, H, info) {
    g.fillStyle = GREEN;
    g.fillRect(0, 0, W, H);
    // shorts leg: purple down to a torn hem
    const y = info.yToPx(-0.1), n = 8;
    g.beginPath();
    g.moveTo(0, 0);
    for (let i = 0; i <= n; i++) g.lineTo((W * i) / n, y + (i % 2 ? -1 : 1) * 0.02 * info.ky);
    g.lineTo(W, 0);
    g.closePath();
    g.fillStyle = PURPLE;
    g.fill();
  },
  shin(g, W, H) { g.fillStyle = GREEN; g.fillRect(0, 0, W, H); },
  matOpts: {},
  lazy: true,
};

// messy hair: a flat cap over the top / back of the head plus leaning spikes
function addExtras(parts) {
  bodyParts = parts;
  const hairMat = toonMaterial(0x1c2a17, SATIN);
  const top = D.headUp * 2;
  const geos = [];
  const cap = new THREE.SphereGeometry(1, 20, 12);
  cap.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, top - 0.13, 0.07), new THREE.Quaternion(), new THREE.Vector3(0.4, 0.17, 0.31)));
  geos.push(cap);
  const spikes = [[-0.28, -0.1, -0.5, 0.3], [-0.14, -0.16, -0.2, 0.36], [0.02, -0.14, 0.05, 0.32], [0.17, -0.15, 0.25, 0.37], [0.29, -0.06, 0.55, 0.28],
    [-0.2, 0.1, -0.3, 0.3], [0.05, 0.14, 0.1, 0.34], [0.25, 0.12, 0.4, 0.3], [0, 0.26, 0, 0.3]];
  for (const [x, z, tilt, h] of spikes) {
    const c = new THREE.ConeGeometry(0.075, h * 0.4, 8, 1);
    c.translate(0, h * 0.2, 0);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, top - 0.09, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(z < 0 ? -0.35 : 0.3, 0, -tilt)), new THREE.Vector3(1, 1, 1)));
    geos.push(c);
  }
  const hair = mergeGeos(geos);
  smoothNormals(hair);
  const m = new THREE.Mesh(hair, hairMat);
  addOutline(m, 0.014, OUTLINE_COLOR);
  parts.head.add(m);

  // bulk: wider torso, thicker arms and legs (not taller: total height stays the same)
  parts.torso.scale.set(1.3, 1, 1.18);
  for (const a of [parts.shoulderL, parts.shoulderR]) a.scale.set(1.45, 1.08, 1.45);
  for (const l of [parts.legL.hip, parts.legR.hip]) l.scale.set(1.2, 1, 1.2);
}

let bodyParts;

export function createHulk() {
  const m = createSpiderCharacter(HULK_LOOK, {
    build: addExtras,
    apply() { bodyParts.shoulderR.position.x += 0.05; bodyParts.shoulderL.position.x -= 0.05; }, // wider shoulders
  });
  m.root.name = 'hulk';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
