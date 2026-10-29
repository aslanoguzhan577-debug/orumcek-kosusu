// hellokitty.js — chibi Hello Kitty as a Funko Pop vinyl figure: the shared Spider-Man body
// (createSpiderCharacter) with a white paint job, so every state, animation, the `hand`
// marker, the height and the hitbox are identical. Wide white head with two pointed ears, a big
// red bow on her left ear (-X), black oval eyes, yellow nose, 3 whiskers per side, no mouth;
// blue overalls with two white buttons over a yellow shirt, white arms / hands / legs, a small
// white tail. Ears, bow and tail are added through the builder's `build` extra.
//   createHelloKitty() -> same shape as createSpiderman(): { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { toonMaterial, addOutline, mergeGeos, smoothNormals } from './toon.js';
import { createSpiderCharacter, SPIDER_DIM, SATIN, OUTLINE_COLOR } from './spiderman.js';

const WHITE = '#fbfbfd';
const BLUE = '#2f5fc4';
const BLUE_EDGE = '#1c3a86';
const YELLOW = '#f6d23a';
const INK = '#1a1418';
const D = SPIDER_DIM;

function poly(g, P, pts, fill, edge) {
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke(); }
}

// overalls: wide below the chest, a narrower bib on top, straps over the shoulders
function overalls(g, P, front) {
  poly(g, P, [[-0.34, -0.2], [0.34, -0.2], [0.34, 0.2], [0.15, 0.22], [0.15, 0.34], [-0.15, 0.34], [-0.15, 0.22], [-0.34, 0.2]], BLUE, BLUE_EDGE);
  for (const s of [-1, 1]) poly(g, P, [[s * 0.07, 0.33], [s * 0.15, 0.33], [s * 0.17, 0.6], [s * 0.09, 0.6]], BLUE, BLUE_EDGE);
  if (front) {
    g.fillStyle = WHITE;
    g.strokeStyle = BLUE_EDGE;
    g.lineWidth = 3;
    for (const s of [-1, 1]) {
      const p = P(s * 0.11, 0.31);
      g.beginPath();
      g.arc(p[0], p[1], Math.abs(P(0.026, 0)[0] - P(0, 0)[0]), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // bib pocket seam
    const a = P(-0.08, 0.15), b = P(0.08, 0.15);
    g.strokeStyle = BLUE_EDGE;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
}

const KITTY_LOOK = {
  head: { color: WHITE },
  face(g, E) {
    const ell = (x, y, rx, ry, color) => {
      const c = E(x, y), px = E(x + rx, y), py = E(x, y + ry);
      g.beginPath();
      g.ellipse(c[0], c[1], Math.abs(px[0] - c[0]), Math.abs(py[1] - c[1]), 0, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    };
    // whiskers: three fanned lines per side, from the cheek towards the head edge
    g.strokeStyle = INK;
    g.lineCap = 'round';
    g.lineWidth = 11;
    for (const s of [-1, 1]) {
      for (const [y0, y1] of [[-0.16, -0.02], [-0.25, -0.25], [-0.34, -0.48]]) {
        const a = E(s * 0.66, y0), b = E(s * 0.97, y1);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
    }
    for (const s of [-1, 1]) ell(s * 0.5, -0.1, 0.085, 0.17, INK);
    ell(0, -0.27, 0.11, 0.075, '#f0b81a');
    const n = E(0, -0.27);
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(n[0], n[1], Math.abs(E(0.11, -0.27)[0] - n[0]), Math.abs(E(0, -0.195)[1] - n[1]), 0, 0, Math.PI * 2);
    g.stroke();
  },
  lensGlow: 0x000000,
  torsoBase: YELLOW,
  torsoFront(g, P) { overalls(g, P, true); },
  torsoBack(g, P) { overalls(g, P, false); },
  arm(g, W, H) { g.fillStyle = YELLOW; g.fillRect(0, 0, W, H); },
  fore(g, W, H) { g.fillStyle = WHITE; g.fillRect(0, 0, W, H); },
  thigh(g, W, H) {
    g.fillStyle = WHITE;
    g.fillRect(0, 0, W, H);
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H * 0.3);
  },
  shin(g, W, H) { g.fillStyle = WHITE; g.fillRect(0, 0, W, H); },
  matOpts: {},
  lazy: true, // no wide-eyed "scared" texture: the intro just shows the normal face
};

// ears + bow (on the head), tail (on the spine). Ears are sunk into the rounded top corners.
function addExtras(parts) {
  const white = toonMaterial(0xfbfbfd, SATIN);
  const red = toonMaterial(0xd8182c, { ...SATIN, sheen: { color: 0xffd0d0, threshold: 0.7, strength: 0.14, soft: 0.28 } });
  const topY = D.headUp * 2;   // top of the head above the head pivot
  const add = (geo, mat, x, y, z, line) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    addOutline(m, line, OUTLINE_COLOR);
    return m;
  };
  const xf = (geo, pos, rot, scl) => geo.applyMatrix4(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), scl));

  // two pointed ears, slightly flattened front to back, leaning outwards
  const ears = [];
  for (const s of [-1, 1]) {
    const c = new THREE.ConeGeometry(0.115, 0.2, 20, 3);
    xf(c, new THREE.Vector3(s * 0.27, topY + 0.015, 0.0), [0, 0, -s * 0.2], new THREE.Vector3(1, 1, 0.62));
    ears.push(c);
  }
  const earGeo = mergeGeos(ears);
  smoothNormals(earGeo);
  parts.head.add(add(earGeo, white, 0, 0, 0, 0.016));

  // bow on her left ear (-X, the right side as seen from the front): two loops + a knot
  const bow = [];
  for (const s of [-1, 1]) {
    const loop = new THREE.SphereGeometry(1, 16, 12);
    xf(loop, new THREE.Vector3(s * 0.11, 0, 0), [0, 0, s * 0.22], new THREE.Vector3(0.13, 0.095, 0.05));
    bow.push(loop);
  }
  const knot = new THREE.SphereGeometry(1, 12, 10);
  xf(knot, new THREE.Vector3(0, 0, 0.005), [0, 0, 0], new THREE.Vector3(0.05, 0.05, 0.045));
  bow.push(knot);
  const bowGeo = mergeGeos(bow);
  smoothNormals(bowGeo);
  const bowMesh = add(bowGeo, red, -0.34, topY + 0.0, -0.17, 0.012);
  bowMesh.rotation.set(0.12, 0.25, 0.3);
  parts.head.add(bowMesh);

  // little round tail on the back
  const tailGeo = new THREE.SphereGeometry(0.05, 14, 10);
  parts.spine.add(add(tailGeo, white, 0, 0.04, 0.17, 0.012));
}

export function createHelloKitty() {
  const m = createSpiderCharacter(KITTY_LOOK, { build: addExtras });
  m.root.name = 'hellokitty';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
