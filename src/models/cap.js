// cap.js — Captain America as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter): blue helmet with a white "A", skin-coloured face area with black eyes,
// blue suit with a white star on the chest and red / white stripes on the belly, brown belt and
// straps, red gloves, brown boots with red tops, and a round shield (red / white rings, blue
// centre, white star) strapped to the left forearm. Back: blue with the straps.
//   createCap() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { toonMaterial, addOutline } from './toon.js';
import { createSpiderCharacter, SATIN, OUTLINE_COLOR } from './spiderman.js';

const BLUE = '#2556b4';
const RED = '#c4202d';
const WHITE = '#f6f6f8';
const BROWN = '#6a4222';
const SKIN = '#f1c7a0';
const INK = '#16121a';

function poly(g, P, pts, fill) {
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

const starPts = (cx, cy, R, r = R * 0.4) => Array.from({ length: 10 }, (_, i) => {
  const a = Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r : R;
  return [cx + Math.cos(a) * k, cy + Math.sin(a) * k];
});

function suit(g, P, front) {
  for (const s of [-1, 1]) poly(g, P, [[s * 0.12, 0.1], [s * 0.18, 0.1], [s * 0.18, 0.5], [s * 0.12, 0.5]], BROWN); // straps
  if (front) {
    poly(g, P, starPts(0, 0.3, 0.065), WHITE);
    for (let i = 0; i < 5; i++) poly(g, P, [[-0.2, 0.1 + i * 0.02], [0.2, 0.1 + i * 0.02], [0.2, 0.12 + i * 0.02], [-0.2, 0.12 + i * 0.02]], i % 2 ? WHITE : RED);
  }
  poly(g, P, [[-0.27, 0.045], [0.27, 0.045], [0.27, 0.1], [-0.27, 0.1]], BROWN);
  if (front) poly(g, P, [[-0.035, 0.05], [0.035, 0.05], [0.035, 0.095], [-0.035, 0.095]], '#c9a13a');
}

const CAP_LOOK = {
  head: { color: BLUE },
  face(g, E) {
    // face opening in the helmet
    const c = E(0, -0.25), a = E(0.8, -0.25), b = E(0, 0.45);
    g.beginPath();
    g.ellipse(c[0], c[1], Math.abs(a[0] - c[0]), Math.abs(b[1] - c[1]), 0, 0, Math.PI * 2);
    g.fillStyle = SKIN;
    g.fill();
    g.strokeStyle = '#d4a37e';
    g.lineWidth = 6;
    g.stroke();
    for (const s of [-1, 1]) {
      const e = E(s * 0.38, -0.08), ex = E(0.38 + 0.08, 0), ey = E(0, 0.115);
      g.beginPath();
      g.ellipse(e[0], e[1], Math.abs(ex[0] - E(0.38, 0)[0]), Math.abs(ey[1] - E(0, 0)[1]), 0, 0, Math.PI * 2);
      g.fillStyle = INK;
      g.fill();
    }
    // white "A" on the forehead
    g.strokeStyle = WHITE;
    g.lineWidth = 15;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const pts = [E(-0.14, 0.58), E(0, 0.9), E(0.14, 0.58)];
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.stroke();
    const l = E(-0.08, 0.7), r = E(0.08, 0.7);
    g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(r[0], r[1]); g.stroke();
  },
  lensGlow: 0x000000,
  torsoBase: BLUE,
  torsoFront(g, P) { suit(g, P, true); },
  torsoBack(g, P) { suit(g, P, false); },
  arm(g, W, H) { g.fillStyle = BLUE; g.fillRect(0, 0, W, H); },
  fore(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    const y = info.yToPx(-0.04);
    g.fillStyle = RED; // glove
    g.fillRect(0, y, W, H - y);
  },
  thigh(g, W, H) { g.fillStyle = BLUE; g.fillRect(0, 0, W, H); },
  shin(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    const y = info.yToPx(-0.06);
    g.fillStyle = BROWN;
    g.fillRect(0, y, W, H - y);
    g.fillStyle = RED;
    g.fillRect(0, y - 0.03 * info.ky, W, 0.03 * info.ky);
  },
  matOpts: {},
  lazy: true,
};

// shield on the left forearm (-X side, facing outwards), pivots with the elbow
function addShield(parts) {
  const R = 0.15;
  const g = new THREE.Group();
  g.position.set(-0.085, -0.06, 0);
  const layer = (geo, color, x, line) => {
    geo.rotateZ(Math.PI / 2); // axis along X
    const m = new THREE.Mesh(geo, toonMaterial(color, SATIN));
    m.position.x = x;
    if (line) addOutline(m, line, OUTLINE_COLOR);
    g.add(m);
  };
  layer(new THREE.CylinderGeometry(R, R, 0.03, 36), 0xc4202d, 0, 0.012);
  layer(new THREE.CylinderGeometry(R * 0.78, R * 0.78, 0.03, 36), 0xf6f6f8, -0.004);
  layer(new THREE.CylinderGeometry(R * 0.58, R * 0.58, 0.03, 36), 0xc4202d, -0.008);
  layer(new THREE.CylinderGeometry(R * 0.4, R * 0.4, 0.03, 36), 0x2556b4, -0.012);
  const sh = new THREE.Shape(starPts(0, 0, R * 0.34).map(([x, y]) => new THREE.Vector2(x, y)));
  const star = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false });
  star.rotateY(-Math.PI / 2); // face -X
  const sm = new THREE.Mesh(star, toonMaterial(0xf6f6f8, SATIN));
  sm.position.x = -0.027;
  g.add(sm);
  parts.armL.elbow.add(g);
}

export function createCap() {
  const m = createSpiderCharacter(CAP_LOOK, { build: addShield });
  m.root.name = 'cap';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
