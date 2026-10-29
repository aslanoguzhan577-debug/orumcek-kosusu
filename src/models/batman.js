// batman.js — Batman as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter): black cowl with two pointed ears, white eye slits, skin-coloured
// lower face (no mouth), dark grey suit with a yellow oval bat emblem and yellow belt, black
// gloves / boots, and a black cape (a tapered panel behind the shoulders that sways with the
// run and shortens in slides / rolls). Back: the cape covers it.
//   createBatman() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { toonMaterial, addOutline, smoothNormals } from './toon.js';
import { createSpiderCharacter, SPIDER_DIM, SATIN, OUTLINE_COLOR } from './spiderman.js';

const BLACK = '#13131a';
const GREY = '#3b3c47';
const YELLOW = '#f4c922';
const SKIN = '#f1c7a0';
const D = SPIDER_DIM;

function poly(g, P, pts, fill) {
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function ellipse(g, P, x, y, rx, ry, fill, line) {
  const c = P(x, y), a = P(x + rx, y), b = P(x, y + ry);
  g.beginPath();
  g.ellipse(c[0], c[1], Math.abs(a[0] - c[0]), Math.abs(b[1] - c[1]), 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (line) { g.strokeStyle = line; g.lineWidth = 5; g.stroke(); }
}

const BAT = [[-0.075, 0.012], [-0.05, 0.03], [-0.02, 0.02], [-0.015, 0.04], [0, 0.03], [0.015, 0.04], [0.02, 0.02], [0.05, 0.03], [0.075, 0.012],
  [0.05, 0.0], [0.03, -0.02], [0, -0.012], [-0.03, -0.02], [-0.05, 0.0]];

function belt(g, P, front) {
  poly(g, P, [[-0.27, 0.045], [0.27, 0.045], [0.27, 0.1], [-0.27, 0.1]], YELLOW);
  if (front) {
    for (const s of [-1, 1]) poly(g, P, [[s * 0.1, 0.04], [s * 0.17, 0.04], [s * 0.17, 0.105], [s * 0.1, 0.105]], '#d9a912');
    poly(g, P, [[-0.03, 0.05], [0.03, 0.05], [0.03, 0.095], [-0.03, 0.095]], '#b98a0e');
  }
}

const BAT_LOOK = {
  head: { color: BLACK },
  face(g, E) {
    // skin: the lower face, its top edge curving up over the cheeks (the cowl covers the nose)
    let p = E(-0.9, -0.2); g.beginPath(); g.moveTo(p[0], p[1]);
    const c = E(0, 0.0); p = E(0.9, -0.2);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    p = E(0.9, -1.1); g.lineTo(p[0], p[1]);
    p = E(-0.9, -1.1); g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillStyle = SKIN;
    g.fill();
    // angry white eye slits: inner end low, outer end high
    for (const s of [-1, 1]) poly(g, (x, y) => E(x * s, y), [[0.1, 0.1], [0.7, 0.32], [0.66, 0.15], [0.12, -0.02]], '#ffffff');
  },
  lensGlow: 0x303030,
  torsoBase: GREY,
  torsoFront(g, P) {
    belt(g, P, true);
    ellipse(g, P, 0, 0.3, 0.1, 0.058, YELLOW, BLACK);
    poly(g, P, BAT.map(([x, y]) => [x * 1.15, y * 1.15 + 0.3]), BLACK);
  },
  torsoBack(g, P) { belt(g, P, false); },
  arm(g, W, H) { g.fillStyle = GREY; g.fillRect(0, 0, W, H); },
  fore(g, W, H, info) {
    g.fillStyle = GREY;
    g.fillRect(0, 0, W, H);
    const y = info.yToPx(-0.05);
    g.fillStyle = BLACK;
    g.fillRect(0, y, W, H - y);
  },
  thigh(g, W, H) { g.fillStyle = GREY; g.fillRect(0, 0, W, H); },
  shin(g, W, H, info) {
    g.fillStyle = GREY;
    g.fillRect(0, 0, W, H);
    const y = info.yToPx(-0.06);
    g.fillStyle = BLACK;
    g.fillRect(0, y, W, H - y);
    g.fillStyle = YELLOW;
    g.fillRect(0, y, W, 0.012 * info.ky);
  },
  matOpts: {},
  lazy: true,
};

const CAPE_COLS = 4, CAPE_ROWS = 8;
const CAPE_TOP = 0.38, CAPE_LEN = 0.62, CAPE_Z = 0.17;

function addExtras(parts, state) {
  const black = toonMaterial(0x13131a, SATIN);
  // two pointed ears, sunk into the top of the cowl
  const topY = D.headUp * 2;
  state.ears = new THREE.Group();
  state.ears.position.set(0, topY - 0.03, -0.02);
  for (const s of [-1, 1]) {
    const geo = new THREE.ConeGeometry(0.08, 0.14, 16, 2);
    geo.translate(0, 0.07, 0);
    smoothNormals(geo);
    const m = new THREE.Mesh(geo, black);
    m.position.x = s * 0.22;
    m.rotation.z = -s * 0.12;
    m.scale.z = 0.7;
    addOutline(m, 0.014, OUTLINE_COLOR);
    state.ears.add(m);
  }
  parts.head.add(state.ears);

  // cape: a tapered panel from the shoulders, rebuilt every frame (cheap, 45 vertices)
  const geo = new THREE.PlaneGeometry(1, 1, CAPE_COLS, CAPE_ROWS);
  state.base = geo.attributes.position.array.slice();
  const mat = toonMaterial(0x13131a, SATIN);
  mat.side = THREE.DoubleSide;
  state.geo = geo;
  state.cape = new THREE.Mesh(geo, mat);
  state.cape.frustumCulled = false;
  parts.spine.add(state.cape);
}

export function createBatman() {
  const st = { len: 1 };
  const m = createSpiderCharacter(BAT_LOOK, {
    build: (parts) => addExtras(parts, st),
    apply(pose, ctx, state) {
      const tuck = state === 'slide' || state === 'roll';
      st.len += ((tuck ? 0.45 : 1) - st.len) * Math.min(1, ctx.dt * 14);
      st.ears.scale.setScalar(state === 'slide' ? 0.4 : 1);
      const f = THREE.MathUtils.clamp((ctx.speed - 11) / 17, 0, 1);
      const out = (0.03 + 0.06 * f) * (tuck ? 0.3 : 1); // how far the hem swings out behind
      const a = st.geo.attributes.position, b = st.base;
      for (let i = 0; i < a.count; i++) {
        const u = b[i * 3], t = 0.5 - b[i * 3 + 1];
        const wave = Math.sin(ctx.phase * 0.5 - t * 3.2);
        a.setXYZ(i,
          u * (0.4 + 0.2 * t) + t * t * 0.03 * Math.sin(ctx.phase * 0.25 + t * 2) ,
          CAPE_TOP - t * CAPE_LEN * st.len,
          CAPE_Z + t * out * (1 + 0.5 * wave) + t * t * 0.02);
      }
      a.needsUpdate = true;
      st.geo.computeVertexNormals();
    },
  });
  m.root.name = 'batman';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
