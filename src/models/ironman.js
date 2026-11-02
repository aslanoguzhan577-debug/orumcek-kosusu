// ironman.js — Iron Man (MCU Mark III style) as a glossy-metal Funko Pop figure on the shared
// Spider-Man body (createSpiderCharacter). Red helmet with panel seams over the back and ear
// discs on the sides, gold faceplate with its cheek / jaw lines and glowing white-cyan eye slits;
// red armour with gold plates, a glowing arc reactor (emissive), two glowing thruster vents on
// the back and glowing boot soles (seen when the feet kick back on the run).
//   createIronMan() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { flatPicture } from './toon.js';
import { createSpiderCharacter, SATIN, TORSO } from './spiderman.js';
import { poly, ellipse, line, fill } from './heroKit.js';

const RED = '#b81424';
const RED_DK = '#6a0812';
const GOLD = '#d9a12a';
const GOLD_FACE = '#e2a935';
const GOLD_EDGE = '#6e4506';
const CYAN = '#d6fbff';
const T = TORSO;
const smooth = THREE.MathUtils.smoothstep;

const METAL = {
  ...SATIN,
  sheen: { color: 0xffe6dc, threshold: 0.6, strength: 0.18, soft: 0.3 },
  gloss: { color: 0xffffff, threshold: 0.975, strength: 0.75, soft: 0.01 },
  rim: { color: 0xffc04a, threshold: 0.64, strength: 0.24, soft: 0.12 },
};

function torso(g, P, k, front) {
  const e = 0.004 * k;
  if (front) {
    // chest plates, gold abs, gold side plates
    for (const s of [-1, 1]) poly(g, P, [[s * 0.025, 0.42], [s * 0.2, 0.44], [s * 0.21, 0.3], [s * 0.08, 0.26], [s * 0.025, 0.29]], null, RED_DK, e);
    poly(g, P, [[-0.12, 0.23], [0.12, 0.23], [0.1, T.beltHi + 0.01], [-0.1, T.beltHi + 0.01]], GOLD, GOLD_EDGE, e);
    for (let i = 1; i < 3; i++) line(g, P, [[-0.11, 0.23 - i * 0.04], [0.11, 0.23 - i * 0.04]], GOLD_EDGE, e);
    line(g, P, [[0, 0.23], [0, T.beltHi + 0.01]], GOLD_EDGE, e);
    for (const s of [-1, 1]) poly(g, P, [[s * 0.16, 0.24], [s * 0.3, 0.26], [s * 0.3, T.beltHi], [s * 0.14, T.beltHi]], GOLD, GOLD_EDGE, e);
    // arc reactor housing
    ellipse(g, P, 0, 0.35, 0.062, 0.062, '#9aa3ad', '#3c434c', 0.006 * k);
    ellipse(g, P, 0, 0.35, 0.046, 0.046, CYAN, '#4b8fa0', 0.005 * k);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      line(g, P, [[Math.cos(a) * 0.03, 0.35 + Math.sin(a) * 0.03], [Math.cos(a) * 0.046, 0.35 + Math.sin(a) * 0.046]], '#7fc8d8', 0.004 * k);
    }
  } else {
    // back plates and two thruster vents between the shoulder blades
    line(g, P, [[0, 0.46], [0, 0.12]], RED_DK, e);
    for (const s of [-1, 1]) {
      poly(g, P, [[s * 0.03, 0.42], [s * 0.2, 0.44], [s * 0.21, 0.24], [s * 0.03, 0.2]], null, RED_DK, e);
      poly(g, P, [[s * 0.055, 0.38], [s * 0.115, 0.38], [s * 0.115, 0.28], [s * 0.055, 0.28]], '#3d434c', GOLD_EDGE, e);
      poly(g, P, [[s * 0.065, 0.37], [s * 0.105, 0.37], [s * 0.105, 0.29], [s * 0.065, 0.29]], CYAN);
    }
    poly(g, P, [[-0.12, 0.17], [0.12, 0.17], [0.1, T.beltHi + 0.01], [-0.1, T.beltHi + 0.01]], GOLD, GOLD_EDGE, e);
  }
  poly(g, P, [[-0.32, T.beltLo], [0.32, T.beltLo], [0.32, T.beltHi], [-0.32, T.beltHi]], RED, RED_DK, e);
}

// emissive picture: reactor and vents glow
function torsoGlow(g, P, k, front) {
  const glow = (x, y, r) => {
    const c = P(x, y), rr = r * k;
    const grd = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], rr);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.55, '#9ff3ff');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(c[0], c[1], rr, 0, Math.PI * 2); g.fill();
  };
  if (front) glow(0, 0.35, 0.06);
  else for (const s of [-1, 1]) poly(g, P, [[s * 0.065, 0.37], [s * 0.105, 0.37], [s * 0.105, 0.29], [s * 0.065, 0.29]], '#8fe9ff');
}

// helmet seams over the back and sides: centre ridge, a ring round the back of the skull and a
// round ear disc on each side (in (z, y) head metres)
const ear = flatPicture(-0.4, 0.4, -0.4, 0.4, 600, 'back', (g, P, k) => {
  ellipse(g, P, 0.03, -0.03, 0.12, 0.13, '#c41a2b', RED_DK, 0.012 * k);
  ellipse(g, P, 0.03, -0.03, 0.065, 0.07, GOLD_FACE, GOLD_EDGE, 0.01 * k);
});
const SEAM = [0x6a, 0x08, 0x12];
const IRON_LOOK = {
  head: { color: RED },
  headPaint(col, glow, d, p) {
    let a = 0;
    if (d.z > -0.1) a = Math.max(a, 1 - smooth(Math.abs(d.x), 0.008, 0.018));          // centre ridge
    if (d.z > 0.15) a = Math.max(a, 1 - smooth(Math.abs(d.y + 0.25 - 0.25 * d.z), 0.008, 0.018)); // skull ring
    if (a > 0) for (let i = 0; i < 3; i++) col[i] += (SEAM[i] - col[i]) * a;
    if (Math.abs(d.x) > 0.6) ear.over(p.z, p.y, col);
  },
  face(g, E) {
    // faceplate: wide brow, cheek notch, narrowing jaw, flat chin
    const plate = [[-0.74, 0.6], [0.74, 0.6], [0.8, 0.02], [0.62, -0.18], [0.56, -0.62], [0.36, -0.94], [-0.36, -0.94], [-0.56, -0.62], [-0.62, -0.18], [-0.8, 0.02]];
    poly(g, E, plate, GOLD_FACE, GOLD_EDGE, 10);
    // forehead piece on the red helmet top
    poly(g, E, [[-0.2, 0.92], [0.2, 0.92], [0.3, 0.66], [-0.3, 0.66]], GOLD_FACE, GOLD_EDGE, 8);
    // faceplate lines: brow V, cheek lines, mouth slit, chin
    line(g, E, [[-0.74, 0.42], [-0.1, 0.36], [0, 0.3], [0.1, 0.36], [0.74, 0.42]], GOLD_EDGE, 6);
    for (const s of [-1, 1]) {
      line(g, E, [[s * 0.66, 0.06], [s * 0.42, -0.2], [s * 0.4, -0.62]], GOLD_EDGE, 6);
      line(g, E, [[s * 0.2, -0.05], [s * 0.3, -0.36]], '#8a5a10', 5);
    }
    line(g, E, [[-0.3, -0.54], [0.3, -0.54]], '#2a1802', 10, 'butt');
    line(g, E, [[-0.2, -0.78], [0.2, -0.78]], GOLD_EDGE, 6);
    // glowing eye slits, dark sockets around them
    for (const s of [-1, 1]) {
      poly(g, (x, y) => E(x * s, y), [[0.1, 0.22], [0.68, 0.33], [0.66, 0.1], [0.16, 0.04]], '#2c1a04');
      poly(g, (x, y) => E(x * s, y), [[0.15, 0.19], [0.62, 0.28], [0.61, 0.14], [0.19, 0.08]], CYAN, '#ffffff', 3);
    }
  },
  lensGlow: 0xc4f8ff,
  glowLum: 200, // only the eye slits glow, not the gold faceplate
  torsoBase: RED,
  torsoFront(g, P, k) { torso(g, P, k, true); },
  torsoBack(g, P, k) { torso(g, P, k, false); },
  torsoGlow,
  arm(g, W, H, info) {
    fill(g, W, H, RED);
    fill(g, W, H, GOLD, info.yToPx(-0.06), info.yToPx(-0.11));
    fill(g, W, H, GOLD_EDGE, info.yToPx(-0.06), info.yToPx(-0.066));
  },
  fore(g, W, H, info) {
    fill(g, W, H, RED);
    fill(g, W, H, GOLD, info.yToPx(0.0), info.yToPx(-0.05));
    fill(g, W, H, GOLD_EDGE, info.yToPx(-0.05), info.yToPx(-0.056));
    fill(g, W, H, RED_DK, info.yToPx(-0.085), info.yToPx(-0.092));
  },
  thigh(g, W, H) {
    fill(g, W, H, RED);
    g.fillStyle = GOLD;
    g.fillRect(W * 0.38, 0, W * 0.24, H * 0.85); // gold panel on the front of the thigh
    g.fillStyle = GOLD_EDGE;
    g.fillRect(W * 0.37, 0, W * 0.012, H * 0.85);
    g.fillRect(W * 0.61, 0, W * 0.012, H * 0.85);
  },
  shin(g, W, H, info) {
    fill(g, W, H, RED);
    fill(g, W, H, GOLD, info.yToPx(0.02), info.yToPx(-0.03)); // gold knee
    fill(g, W, H, RED_DK, info.yToPx(-0.1), info.yToPx(-0.107));
    fill(g, W, H, '#3d434c', H * 0.988, H);                    // sole (bottom of the boot blob's UV strip)
  },
  // boot soles glow (the bottom rows of the boot strip are its sole)
  shinGlow(g, W, H) {
    fill(g, W, H, '#000000');
    fill(g, W, H, '#9fefff', H * 0.988, H);
  },
  matOpts: { head: METAL, torso: METAL, arm: METAL, thigh: METAL, shin: METAL },
  lazy: true,
};

export function createIronMan() {
  const m = createSpiderCharacter(IRON_LOOK);
  m.root.name = 'ironman';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
