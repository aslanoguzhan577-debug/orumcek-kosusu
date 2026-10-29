// spiderman.js — chibi Spider-Man as a Funko Pop vinyl figure: a big rounded-cube head
// sitting straight on a small, stocky body (no neck), satin vinyl shading, clean colour
// blocks. Modern suit: red head (smooth face, web lines only on the back), big white lenses
// in thick black frames, navy body with a red chest panel / shoulders, white spider front
// and back, red belt, red fists and red boots.
//   createSpiderman() -> { root, setState(name), update(dt, speed?), setSpeed(v), hand }
//   (hand: empty marker in the right fist, where the web line starts; speed: game speed in
//   m/s, optional, makes the run cadence faster - see runCadence)
//   root origin at the feet, facing -Z, about CONFIG.playerHeight tall.
//   States: idle, run, jump, slide, web, stumble, caught; intro clip: swing, fall, roll,
//   scared (blend ~0.12 s).
// The body builder (createSpiderCharacter) and the painting helpers are shared with
// ironspider.js, which only swaps the paint job and adds the mechanical arms.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  toonMaterial, addOutline, canvasTexture, smoothLathe, mergeGeos, smoothNormals, PoseBlend,
  roundCube, boxify, latheGrid, sphereGrid, bakeTextures, sphereDir, flatPicture, rgb, taperCurve,
} from './toon.js';

// ------------------------------------------------------------------ proportions
// Designed at 1.6 m and scaled to CONFIG.playerHeight. Funko Pop: the head is ~46 % of the
// height and about twice as wide as the shoulders; short thick limbs, big fists and boots.
const DESIGN_H = 1.6;
export const SPIDER_DIM = {
  hipY: 0.40,          // hip joint height
  hipX: 0.11,
  thighLen: 0.18,      // hip -> knee (knee 0.22 m above the floor)
  headW: 0.43,         // head half width  (0.86 m)
  headH: 0.365,        // head half height (0.73 m)
  headD: 0.37,         // head half depth
  neckY: 0.47,         // head pivot above the hips (= bottom of the head)
  shoulderX: 0.215,
  shoulderY: 0.34,     // above the hips
  elbowY: 0.15,        // upper arm length
  fistY: 0.17,         // elbow -> centre of the fist
};
const D = SPIDER_DIM;
D.headUp = D.headH;    // head centre above the pivot (top of the head = 1.6 m)

export const OUTLINE = 0.02;
export const OUTLINE_COLOR = 0x1c1016;

// How much of the pose's head nod / tilt is used: the head sits on the shoulders, so it
// only nods a little (big nods would open a gap under it).
const HEAD_NOD = 0.45;
const SPIN_Y = 0.8;      // flip / twist pivot above the feet
const LAND_T = 0.2;     // landing squash after a jump (s)
const POP_T = 0.18;     // stretch when popping up out of a slide (s)

// Funko head: a rounded cube (unit sphere point -> head surface, centred at the origin),
// flat face, big soft corners, the chin a little narrower than the top.
export function deformHead(v, W = D.headW, H = D.headH, Dp = D.headD, n = 4.6) {
  v.normalize();
  roundCube(v, n);
  const t = v.y < 0 ? -v.y : 0;
  const f = 1 - 0.09 * t * t;
  v.x *= W * f;
  v.y *= H;
  v.z *= Dp * f;
  return v;
}

// ------------------------------------------------------------------ painting helpers

const smooth = THREE.MathUtils.smoothstep;

// Web lines on the head: spokes radiating from a pole low on the back of the head plus
// sagging rings, faded out toward the face (the figure's face is smooth). d = unit direction
// from the head centre. Returns the line coverage 0..1.
const WEB_POLE = new THREE.Vector3(0, -0.9, 0.44).normalize();
const WEB_E1 = new THREE.Vector3(0, 1, 0).addScaledVector(WEB_POLE, -WEB_POLE.y).normalize(); // up the back
const WEB_E2 = new THREE.Vector3().crossVectors(WEB_POLE, WEB_E1);
export function headWeb(d, { spokes = 18, step = 0.22, width = 0.0105, sag = 0.3, frontFade = [-0.3, -0.06] } = {}) {
  const fade = smooth(d.z, frontFade[0], frontFade[1]);
  if (fade <= 0) return 0;
  const c = THREE.MathUtils.clamp(d.dot(WEB_POLE), -1, 1);
  const rho = Math.acos(c);
  const psi = Math.atan2(d.dot(WEB_E2), d.dot(WEB_E1));
  const sp = (Math.PI * 2) / spokes;
  const q = psi / sp;
  const fr = q - Math.floor(q);                       // 0..1 between two spokes
  const dSpoke = Math.abs(fr - 0.5) < 0.5 ? Math.min(fr, 1 - fr) * sp * Math.sin(rho) : 0;
  const r = rho + step * sag * Math.sin(Math.PI * fr); // rings sag toward the pole
  const k = Math.max(1, Math.round(r / step));
  const dRing = Math.abs(r - k * step);
  const dist = Math.min(dSpoke, dRing);
  const aa = 0.006;
  return fade * (1 - smooth(dist, width - aa, width + aa));
}

// Spider emblem drawn in a flat picture. P(x, y) maps emblem metres (y up, centre of the
// body at 0, 0) to pixels; k = pixels per metre. legs: per side [[root, ctrl, tip], ...]
// (right side, x > 0), body: { top, bottom, w } in metres.
export function paintSpiderEmblem(g, P, k, { legs, legW = [0.022, 0.009], head, body, color }) {
  g.fillStyle = color;
  for (const s of [-1, 1]) {
    for (const [a, c, b] of legs) {
      taperCurve(g, P(a[0] * s, a[1]), P(c[0] * s, c[1]), P(b[0] * s, b[1]), legW[0] * k, legW[1] * k);
    }
  }
  // head with two little horns on top
  const { top, neck, w: hw } = head;
  g.beginPath();
  let p = P(0, top - 0.012); g.moveTo(p[0], p[1]);
  for (const s of [1, -1]) {
    const q = [P(s * hw * 0.45, top), P(s * hw * 0.75, top - 0.008), P(s * hw, top - 0.03), P(s * hw * 0.75, neck)];
    if (s === 1) {
      g.lineTo(q[0][0], q[0][1]);
      g.quadraticCurveTo(q[1][0], q[1][1], q[2][0], q[2][1]);
      g.quadraticCurveTo(P(hw, neck + 0.01)[0], P(hw, neck + 0.01)[1], q[3][0], q[3][1]);
      p = P(0, neck - 0.006); g.lineTo(p[0], p[1]);
    } else {
      g.lineTo(q[3][0], q[3][1]);
      g.quadraticCurveTo(P(-hw, neck + 0.01)[0], P(-hw, neck + 0.01)[1], q[2][0], q[2][1]);
      g.quadraticCurveTo(q[1][0], q[1][1], q[0][0], q[0][1]);
    }
  }
  g.closePath();
  g.fill();
  // long abdomen: widest just under the neck, forked tip
  const { top: bt, bottom: bb, w: bw } = body;
  g.beginPath();
  p = P(0, bt); g.moveTo(p[0], p[1]);
  for (const s of [1, -1]) {
    const c1 = P(s * bw * 1.15, bt - 0.01), m = P(s * bw, bt - (bt - bb) * 0.35);
    const c2 = P(s * bw * 0.85, bb + (bt - bb) * 0.2), tip = P(s * bw * 0.32, bb);
    if (s === 1) {
      g.quadraticCurveTo(c1[0], c1[1], m[0], m[1]);
      g.quadraticCurveTo(c2[0], c2[1], tip[0], tip[1]);
      p = P(0, bb + 0.012); g.lineTo(p[0], p[1]);
    } else {
      g.lineTo(tip[0], tip[1]);
      g.quadraticCurveTo(c2[0], c2[1], m[0], m[1]);
      g.quadraticCurveTo(c1[0], c1[1], P(0, bt)[0], P(0, bt)[1]);
    }
  }
  g.closePath();
  g.fill();
}

// Big Spider-Man lenses (photo: rounded triangles, a sharp flick on the outer top corner, a
// pointed inner corner by the nose, thick black frames with a thin groove).
// E(X, Y): face coordinates (X = 1 at the side of the head, Y = 1 at the top) -> pixels.
const EYE = {
  F: [0.872, 0.576], t1: [0.70, 0.52], t2: [0.30, 0.28], I: [0.143, -0.116],
  b1: [0.22, -0.30], b2: [0.42, -0.40], B: [0.592, -0.393],
  b3: [0.76, -0.385], b4: [0.90, -0.24], O: [0.923, 0.029],
  b5: [0.94, 0.25], b6: [0.92, 0.45],
};
export function eyePath(g, side, E) {
  const P = (p) => E(p[0] * side, p[1]);
  const seg = (a, b, c) => { const A = P(a), B = P(b), C = P(c); g.bezierCurveTo(A[0], A[1], B[0], B[1], C[0], C[1]); };
  g.beginPath();
  const f = P(EYE.F);
  g.moveTo(f[0], f[1]);
  seg(EYE.t1, EYE.t2, EYE.I);
  seg(EYE.b1, EYE.b2, EYE.B);
  seg(EYE.b3, EYE.b4, EYE.O);
  seg(EYE.b5, EYE.b6, EYE.F);
  g.closePath();
}
// frameW in face units (fraction of the head half width); scale = pixels per face unit (x)
export function paintLenses(g, E, scale, { frame = '#111015', groove = '#34343c', lens = '#ffffff', lensShade = '#cfd3dc', frameW = 0.1, inner = null } = {}) {
  g.lineJoin = 'round';
  for (const side of [-1, 1]) {
    eyePath(g, side, E);
    g.fillStyle = frame;
    g.fill();
    g.save();
    eyePath(g, side, E);
    g.clip();
    // lens: white, a soft grey shade under the top of the frame
    const [x0, y0] = E(0.55 * side, 0.45), [x1, y1] = E(0.55 * side, -0.25);
    const grd = g.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, lensShade);
    grd.addColorStop(0.45, lens);
    grd.addColorStop(1, lens);
    g.fillStyle = grd;
    g.fill();
    if (inner) inner(g, side, E, scale);
    const w = frameW * scale * 2;
    g.strokeStyle = frame;
    g.lineWidth = w;
    g.stroke();
    g.strokeStyle = groove;
    g.lineWidth = w * 0.63;
    g.stroke();
    g.strokeStyle = frame;
    g.lineWidth = w * 0.55;
    g.stroke();
    g.restore();
  }
}

// Web radiating from a centre point (yoke on the back). toPx(xm, ym) gives pixels for
// metres around the centre.
export function paintRadialWeb(g, toPx, { spokes = 12, step = 0.05, maxR = 0.6, color = '#3c0612', width = 2.2, rot = 0 } = {}) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  for (let k = 0; k < spokes; k++) {
    const a = rot + (k / spokes) * Math.PI * 2;
    const [x0, y0] = toPx(Math.cos(a) * step * 0.6, Math.sin(a) * step * 0.6);
    const [x1, y1] = toPx(Math.cos(a) * maxR, Math.sin(a) * maxR);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  for (let r = step; r < maxR; r += step) {
    g.beginPath();
    for (let k = 0; k <= spokes; k++) {
      const a0 = rot + (k / spokes) * Math.PI * 2;
      const a1 = rot + ((k + 1) / spokes) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const [x0, y0] = toPx(Math.cos(a0) * r, Math.sin(a0) * r);
      const [xc, yc] = toPx(Math.cos(am) * r * 0.82, Math.sin(am) * r * 0.82);
      const [x1, y1] = toPx(Math.cos(a1) * r, Math.sin(a1) * r);
      if (k === 0) g.moveTo(x0, y0);
      g.quadraticCurveTo(xc, yc, x1, y1);
    }
    g.stroke();
  }
}

// Grid web for limbs: lines along the limb + scalloped rings around it.
export function paintWebGrid(g, x0, y0, x1, y1, { cols = 8, rows = 9, color = '#3c0612', width = 2, sag = 0.3 } = {}) {
  g.strokeStyle = color;
  g.lineWidth = width;
  const cw = (x1 - x0) / cols;
  const rh = (y1 - y0) / rows;
  for (let c = 0; c <= cols; c++) {
    const x = x0 + (c + 0.5) * cw;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x, y1);
    g.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = y0 + r * rh;
    g.beginPath();
    for (let c = -1; c <= cols; c++) {
      const xa = x0 + (c + 0.5) * cw;
      const xb = xa + cw;
      if (c === -1) g.moveTo(xa, y);
      g.quadraticCurveTo((xa + xb) / 2, y + rh * sag, xb, y);
    }
    g.stroke();
  }
}

// ------------------------------------------------------------------ the modern suit

const RED = '#ad1242';
const NAVY = '#172142';
const WEB = '#3a0613';
const WHITE = '#f6f6f8';

// Torso pictures, in torso metres (origin at the hips, y up). Shared numbers:
export const TORSO = {
  beltLo: 0.045, beltHi: 0.1,   // red waistband
  armpit: 0.27,
};

// PS4-style chest spider (photo 9): two leg pairs arching over the chest to the shoulders,
// two long pairs reaching down to the belt, long forked abdomen.
export const CHEST_SPIDER = {
  legs: [
    [[0.03, 0.085], [0.1, 0.165], [0.172, 0.1]],
    [[0.035, 0.05], [0.12, 0.1], [0.18, 0.035]],
    [[0.035, 0.02], [0.14, 0.0], [0.13, -0.15]],
    [[0.03, -0.01], [0.085, -0.03], [0.085, -0.165]],
  ],
  legW: [0.024, 0.01],
  head: { top: 0.115, neck: 0.055, w: 0.034 },
  body: { top: 0.06, bottom: -0.105, w: 0.042 },
};
// smaller spider between the shoulder blades (photo 8): upper legs bend up, lower legs down
export const BACK_SPIDER = {
  legs: [
    [[0.022, 0.055], [0.085, 0.035], [0.095, 0.125]],
    [[0.028, 0.034], [0.115, 0.034], [0.12, 0.09]],
    [[0.028, 0.0], [0.115, 0.0], [0.095, -0.145]],
    [[0.022, -0.022], [0.07, -0.045], [0.056, -0.165]],
  ],
  legW: [0.019, 0.008],
  head: { top: 0.078, neck: 0.04, w: 0.025 },
  body: { top: 0.042, bottom: -0.09, w: 0.03 },
};

const SPIDER_LOOK = {
  head: { color: RED, web: { color: WEB, opacity: 0.92 } },
  face(g, E, s) { paintLenses(g, E, s); },
  lensGlow: 0x8a8a8a,
  torsoBase: NAVY,
  torsoFront(g, P, k) {
    const T = TORSO;
    // red chest panel + yoke over the shoulders, navy wedges down the sides
    g.fillStyle = RED;
    g.beginPath();
    let p = P(0.32, 0.7); g.moveTo(p[0], p[1]);
    p = P(0.32, T.armpit + 0.02); g.lineTo(p[0], p[1]);
    let c = P(0.215, T.armpit + 0.01); p = P(0.18, T.armpit - 0.01); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(0.162, 0.17); p = P(0.132, T.beltHi); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    p = P(-0.132, T.beltHi); g.lineTo(p[0], p[1]);
    c = P(-0.162, 0.17); p = P(-0.18, T.armpit - 0.01); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(-0.215, T.armpit + 0.01); p = P(-0.32, T.armpit + 0.02); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    p = P(-0.32, 0.7); g.lineTo(p[0], p[1]);
    g.closePath();
    g.fill();
    // belt + the red V below it
    g.beginPath();
    p = P(0.32, T.beltHi); g.moveTo(p[0], p[1]);
    p = P(-0.32, T.beltHi); g.lineTo(p[0], p[1]);
    p = P(-0.32, T.beltLo); g.lineTo(p[0], p[1]);
    p = P(-0.16, T.beltLo); g.lineTo(p[0], p[1]);
    c = P(-0.06, T.beltLo - 0.03); p = P(0, T.beltLo - 0.075); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(0.06, T.beltLo - 0.03); p = P(0.16, T.beltLo); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    p = P(0.32, T.beltLo); g.lineTo(p[0], p[1]);
    g.closePath();
    g.fill();
    // sculpted edge of the waistband
    g.strokeStyle = 'rgba(70, 4, 18, 0.55)';
    g.lineWidth = 0.004 * k;
    g.beginPath();
    p = P(0.32, T.beltLo); g.moveTo(p[0], p[1]);
    p = P(-0.32, T.beltLo); g.lineTo(p[0], p[1]);
    g.stroke();
    paintSpiderEmblem(g, (x, y) => P(x, y + 0.27), k, { ...CHEST_SPIDER, color: WHITE });
  },
  torsoBack(g, P, k) {
    const T = TORSO;
    // red yoke across the top of the back and over the shoulders, with web lines
    const yoke = () => {
      g.beginPath();
      let p = P(-0.32, 0.7); g.moveTo(p[0], p[1]);
      p = P(-0.32, T.armpit + 0.02); g.lineTo(p[0], p[1]);
      let c = P(-0.17, T.armpit + 0.03); p = P(-0.1, 0.355); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      c = P(0, 0.33); p = P(0.1, 0.355); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      c = P(0.17, T.armpit + 0.03); p = P(0.32, T.armpit + 0.02); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      p = P(0.32, 0.7); g.lineTo(p[0], p[1]);
      g.closePath();
    };
    yoke();
    g.fillStyle = RED;
    g.fill();
    g.save();
    yoke();
    g.clip();
    paintRadialWeb(g, (x, y) => P(x, 0.47 + y), { spokes: 14, step: 0.045, maxR: 0.4, width: 0.0035 * k, rot: Math.PI / 14 });
    g.restore();
    // belt with web lines, dipping a little at the middle of the back
    const belt = () => {
      g.beginPath();
      let p = P(-0.32, T.beltHi); g.moveTo(p[0], p[1]);
      p = P(0.32, T.beltHi); g.lineTo(p[0], p[1]);
      p = P(0.32, T.beltLo); g.lineTo(p[0], p[1]);
      const c = P(0, T.beltLo - 0.025); p = P(-0.32, T.beltLo);
      g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      g.closePath();
    };
    belt();
    g.fillStyle = RED;
    g.fill();
    g.save();
    belt();
    g.clip();
    const [bx0, by0] = P(-0.32, T.beltHi), [bx1, by1] = P(0.32, T.beltLo - 0.03);
    paintWebGrid(g, bx0, by0, bx1, by1, { cols: 18, rows: 2, width: 0.0035 * k, color: WEB, sag: 0.35 });
    g.restore();
    paintSpiderEmblem(g, (x, y) => P(x, y + 0.27), k, { ...BACK_SPIDER, color: WHITE });
  },
  // limbs are painted in lathe space: u around (0.25 = outside of the limb), y from info.yToPx
  arm(g, W, H, info) {
    g.fillStyle = NAVY;
    g.fillRect(0, 0, W, H);
    // red shoulder cap (seen from the front and the back) and a red stripe down the outside
    const cap = info.yToPx(0.0);
    g.fillStyle = RED;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 4) {
      const f = Math.cos(((x / W) - 0.25) * Math.PI * 2); // 1 on the outside
      g.lineTo(x, cap + (0.045 * Math.max(0, f) - 0.02 * Math.max(0, -f)) * info.ky);
    }
    g.closePath();
    g.fill();
    g.fillRect(W * 0.19, 0, W * 0.12, H);
  },
  fore(g, W, H, info) {
    g.fillStyle = NAVY;
    g.fillRect(0, 0, W, H);
    g.fillStyle = RED;
    g.fillRect(W * 0.19, 0, W * 0.12, H);
    // glove cuff (the fist below uses the bottom rows)
    const cuff = info.yToPx(-0.085);
    g.fillRect(0, cuff, W, H - cuff);
  },
  thigh(g, W, H) {
    g.fillStyle = NAVY;
    g.fillRect(0, 0, W, H);
    g.fillStyle = RED;
    g.fillRect(W * 0.235, 0, W * 0.03, H); // thin seam stripe on the outside
  },
  shin(g, W, H, info) {
    g.fillStyle = NAVY;
    g.fillRect(0, 0, W, H);
    g.fillStyle = RED;
    g.fillRect(W * 0.235, 0, W * 0.03, H);
    // red boot up to just under the knee, its top dips a little at the back
    const top = info.yToPx(-0.03);
    g.save();
    g.beginPath();
    g.moveTo(0, top);
    for (let x = 0; x <= W; x += 4) {
      const f = Math.cos((x / W) * Math.PI * 2); // 1 at the back (u = 0)
      g.lineTo(x, top + Math.max(0, f) * 0.02 * info.ky);
    }
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillStyle = RED;
    g.fill();
    g.clip();
    paintWebGrid(g, 0, top, W, info.yToPx(-0.19), { cols: 10, rows: 5, sag: 0.35, width: 2.4, color: WEB });
    g.restore();
  },
  matOpts: {},
};

// Satin vinyl: soft toon ramp, a broad soft sheen and a faint highlight.
export const SATIN = {
  shade: 'soft',
  sheen: { color: 0xffffff, threshold: 0.72, strength: 0.09, soft: 0.28 },
  gloss: { color: 0xffffff, threshold: 0.985, strength: 0.25, soft: 0.012 },
  rim: { color: 0xffffff, threshold: 0.62, strength: 0.05, soft: 0.3 },
};

// ------------------------------------------------------------------ body builder

function mesh(geo, mat, outline = OUTLINE) {
  const m = new THREE.Mesh(geo, mat);
  if (outline) addOutline(m, outline, OUTLINE_COLOR);
  return m;
}

// left-side copy of a limb: mirrored, so u = 0.25 is the outside on both sides
function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  g.index.needsUpdate = true;
  return g;
}

function infoFor(geo, H) {
  return {
    yToPx: (y) => (1 - geo.userData.vOfY(y)) * H,
    ky: H / geo.userData.arcLength,
  };
}

function limbMat(paint, geo, w, h, matOpts, yShift = 0) {
  const info = infoFor(geo, h);
  const map = canvasTexture(w, h, (g, W, H) => paint(g, W, H, { ...info, yToPx: (y) => info.yToPx(y - yShift) }));
  return toonMaterial(0xffffff, { map, ...SATIN, ...matOpts });
}

// rounded-cube blob (fist, boot), its UVs squeezed into a strip of the limb texture
function blob(r, n, sx, sy, sz, uvV0, uvV1) {
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    roundCube(v.fromBufferAttribute(p, i), n);
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uvV0 + uv.getY(i) * (uvV1 - uvV0));
  smoothNormals(geo);
  return geo;
}

// Head texture (colour + lens glow mask), painted from directions on the head and from a
// flat front picture of the face.
// lensScale > 1: lenses widened around their middles (shock)
function bakeHead(headGeo, look, lensScale = 1) {
  const W = D.headW, H = D.headH, k = lensScale;
  const face = flatPicture(-W * 1.1, W * 1.1, -H * 1.1, H * 1.1, 1000, 'front', (g, toPx) => {
    // anchored at the outer edge: growing outward would wrap the frame onto the sides
    const kx = 1 + (k - 1) * 0.5;
    look.face(g, (X, Y) => {
      const cx = X < 0 ? -0.94 : 0.94, cy = 0.08;
      return toPx((cx + (X - cx) * kx) * W, (cy + (Y - cy) * k) * H);
    }, W * 1000 * kx);
  });
  const base = rgb(look.head.color);
  const web = look.head.web;
  const line = web ? rgb(web.color) : null;
  const d = new THREE.Vector3(), p = new THREE.Vector3();
  const grid = sphereGrid(headGeo);
  const tmp = [0, 0, 0];
  return bakeTextures(1024, 512, ([col, glow], u, v) => {
    col[0] = base[0]; col[1] = base[1]; col[2] = base[2];
    sphereDir(u, v, d);
    if (web) {
      const a = headWeb(d, web) * (web.opacity ?? 1);
      if (a > 0) for (let i = 0; i < 3; i++) col[i] += (line[i] - col[i]) * a;
    }
    if (d.z < -0.05) {
      grid.at(u, v, p);
      tmp[0] = 0; tmp[1] = 0; tmp[2] = 0;
      const a = face.over(p.x, p.y, tmp);
      if (a > 0) {
        for (let i = 0; i < 3; i++) col[i] = col[i] * (1 - a) + tmp[i];
        const lum = (tmp[0] + tmp[1] + tmp[2]) / (3 * a);
        if (lum > 120) for (let i = 0; i < 3; i++) glow[i] = tmp[i];
      }
    }
  }, 2);
}

function bakeTorso(torsoGeo, look) {
  const k = 900;
  const front = flatPicture(-0.27, 0.27, -0.12, 0.5, k, 'front', (g, toPx) => look.torsoFront(g, toPx, k));
  const back = flatPicture(-0.27, 0.27, -0.12, 0.5, k, 'back', (g, toPx) => look.torsoBack(g, toPx, k));
  const base = rgb(look.torsoBase);
  const grid = latheGrid(torsoGeo), p = new THREE.Vector3();
  return bakeTextures(512, 256, ([col], u, v) => {
    col[0] = base[0]; col[1] = base[1]; col[2] = base[2];
    grid.at(u, v, p);
    (p.z < 0 ? front : back).over(p.x, p.y, col);
  })[0];
}

// look: paint functions + material options (see SPIDER_LOOK).
// extras (optional): { defaults: {...pose keys}, pose(state, P, ctx), build(parts), apply(pose, ctx) }
export function createSpiderCharacter(look, extras = {}) {
  const root = new THREE.Group();
  const scaler = new THREE.Group();
  scaler.scale.setScalar(CONFIG.playerHeight / DESIGN_H);
  root.add(scaler);

  // flips / twists turn the whole body around its middle (SPIN_Y above the feet)
  const spin = new THREE.Group();
  spin.position.y = SPIN_Y;
  scaler.add(spin);
  const spinIn = new THREE.Group();
  spinIn.position.y = -SPIN_Y;
  spin.add(spinIn);
  const pelvis = new THREE.Group();
  pelvis.rotation.order = 'YXZ'; // yaw last = turn around the world up axis
  pelvis.position.y = D.hipY;
  spinIn.add(pelvis);
  const spine = new THREE.Group();
  pelvis.add(spine);
  const mo = look.matOpts || {};

  // --- torso: compact rounded box with broad shoulders; its top reaches up inside the head
  const torsoGeo = smoothLathe([
    [0, -0.08], [0.12, -0.072], [0.18, -0.04], [0.196, 0.02], [0.186, 0.085], [0.192, 0.15],
    [0.205, 0.24], [0.2, 0.31], [0.175, 0.37], [0.125, 0.42], [0.05, 0.455], [0, 0.465],
  ], { segments: 22, samples: 20, scaleZ: 0.8 });
  smoothNormals(boxify(torsoGeo, 3.2));
  // All textures are baked here at build time (main.js builds the models behind the loading
  // screen): nothing may be baked later, in the middle of play.
  const torsoMat = toonMaterial(0xffffff, { map: bakeTorso(torsoGeo, look), ...SATIN, ...mo.torso });
  const torso = mesh(torsoGeo, torsoMat);
  spine.add(torso);

  // --- head: Funko rounded cube, eyes baked into its texture
  const headGeo = new THREE.SphereGeometry(1, 40, 28);
  {
    const p = headGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      deformHead(v.fromBufferAttribute(p, i));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    smoothNormals(headGeo);
  }
  const headMaps = bakeHead(headGeo, look);
  const headMat = toonMaterial(0xffffff, {
    map: headMaps[0], emissive: look.lensGlow, emissiveMap: headMaps[1], ...SATIN, ...mo.head,
  });
  // wide "shocked" lenses for the intro's scared state (Iron Spider never gets scared)
  const shockMaps = look.lazy ? null : bakeHead(headGeo, look, 1.3);
  const neck = new THREE.Group(); // head pivot at the bottom of the head, inside the shoulders
  neck.position.y = D.neckY;
  spine.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  const headMesh = mesh(headGeo, headMat, OUTLINE * 1.2);
  headMesh.position.y = D.headUp;
  head.add(headMesh);

  // --- arms: upper arm with the round shoulder (pivot at the shoulder) + forearm with a big
  // fist (pivot at the elbow). Arm-space y is measured from the shoulder for the paint.
  const upperGeo = smoothLathe([
    [0, -D.elbowY - 0.02], [0.054, -D.elbowY - 0.008], [0.06, -D.elbowY + 0.03], [0.066, -0.06],
    [0.074, -0.01], [0.076, 0.02], [0.06, 0.062], [0, 0.077],
  ], { segments: 14, samples: 14 });
  smoothNormals(upperGeo);
  const foreLathe = smoothLathe([
    [0, -0.12], [0.05, -0.112], [0.056, -0.07], [0.06, -0.02], [0.056, 0.025], [0, 0.045],
  ], { segments: 14, samples: 12 });
  const fist = blob(1, 2.8, 0.07, 0.074, 0.074, 0.004, 0.03);
  fist.translate(0, -D.fistY, -0.006);
  const foreGeo = mergeGeos([foreLathe, fist]);
  const upperMat = limbMat(look.arm, upperGeo, 256, 256, mo.arm);
  const foreMat = limbMat(look.fore, foreLathe, 256, 256, mo.arm);
  const upperGeoL = mirrorX(upperGeo);
  const foreGeoL = mirrorX(foreGeo);
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * D.shoulderX, D.shoulderY, 0);
    shoulder.add(mesh(side < 0 ? upperGeoL : upperGeo, upperMat, OUTLINE * 0.9));
    const elbow = new THREE.Group();
    elbow.position.y = -D.elbowY;
    elbow.add(mesh(side < 0 ? foreGeoL : foreGeo, foreMat, OUTLINE * 0.9));
    shoulder.add(elbow);
    spine.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = arm(-1);
  const armR = arm(1);
  const shoulderL = armL.shoulder;
  const shoulderR = armR.shoulder;
  // empty marker in the right fist: where the web line starts (G9)
  const handR = new THREE.Object3D();
  handR.position.y = -D.fistY;
  armR.elbow.add(handR);

  // --- legs: thick thigh + shin with a big rounded boot
  const thighGeo = smoothLathe([
    [0, -0.2], [0.076, -0.19], [0.086, -0.15], [0.094, -0.07], [0.098, 0], [0.078, 0.05], [0, 0.07],
  ], { segments: 14, samples: 12 });
  smoothNormals(thighGeo);
  const kneeY = D.hipY - D.thighLen;
  const shinLathe = smoothLathe([
    [0, -kneeY + 0.02], [0.084, -kneeY + 0.03], [0.092, -0.15], [0.088, -0.08], [0.083, -0.02],
    [0.08, 0.02], [0.055, 0.05], [0, 0.065],
  ], { segments: 14, samples: 14 });
  const boot = blob(1, 2.6, 0.094, 0.06, 0.142, 0.004, 0.03);
  boot.translate(0, -kneeY + 0.06, -0.045);
  const shinGeo = mergeGeos([shinLathe, boot]);
  const thighMat = limbMat(look.thigh, thighGeo, 128, 128, mo.thigh);
  const shinMat = limbMat(look.shin, shinLathe, 256, 256, mo.shin);
  const thighGeoL = mirrorX(thighGeo);
  const shinGeoL = mirrorX(shinGeo);

  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * D.hipX, 0, 0);
    hip.add(mesh(side < 0 ? thighGeoL : thighGeo, thighMat, OUTLINE * 0.9));
    const knee = new THREE.Group();
    knee.position.y = -D.thighLen;
    knee.add(mesh(side < 0 ? shinGeoL : shinGeo, shinMat, OUTLINE * 0.9));
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee };
  }
  const legL = leg(-1);
  const legR = leg(1);

  const parts = { root, scaler, pelvis, spine, neck, head, headMesh, torso, shoulderL, shoulderR, armL, armR, handR, legL, legR };
  if (extras.build) extras.build(parts);

  // ---------------------------------------------------------------- animation
  const defaults = {
    pelvisX: 0, pelvisY: 0, pelvisZ: 0, pelvisRX: 0, pelvisRY: 0, pelvisRZ: 0,
    spineRX: 0, spineRY: 0, spineRZ: 0, squash: 1, rootSquash: 1, flip: 0, twist: 0, lift: 0, pivot: 0,
    headRX: 0, headRY: 0, headRZ: 0, neckOut: 0, limbOut: 0,
    armLX: 0, armLY: 0, armLZ: -0.2, armRX: 0, armRY: 0, armRZ: 0.2, elbowL: 0.15, elbowR: 0.15,
    legLX: 0, legLZ: -0.06, legRX: 0, legRZ: 0.06, kneeL: 0, kneeR: 0,
    ...(extras.defaults || {}),
  };
  const blend = new PoseBlend(defaults, 0.13);
  let state = 'idle';
  const ctx = { t: 0, st: 0, phase: 0, dt: 0, speed: CONFIG.startSpeed, land: 9, pop: 9 };

  function setState(name) {
    if (name === state) return;
    const prev = state;
    state = name;
    ctx.st = 0;
    // leaving a flip / roll past half a turn: finish it forward instead of unwinding it
    if (blend.out.flip < -Math.PI) blend.out.flip += Math.PI * 2;
    let time = 0.13;
    if (name === 'jump') time = 0.06;          // the take-off squash must show at once
    else if (name === 'slide') time = 0.07;    // quick drop
    else if (name === 'roll' || name === 'scared') time = 0.07; // snap into the tuck / the jolt
    else if (prev === 'slide') { time = 0.09; ctx.pop = 0; } // snappy pop back up
    if ((prev === 'jump' || prev === 'web') && (name === 'run' || name === 'idle')) ctx.land = 0;
    blend.start(time);
  }

  // speed (optional, m/s): game speed, drives the run cadence. update(dt) alone keeps
  // the last speed (CONFIG.startSpeed until one is given).
  function setSpeed(v) {
    if (Number.isFinite(v)) ctx.speed = v;
  }

  function update(dt, speed) {
    dt = Math.min(Math.max(dt, 0), CONFIG.dtCap);
    setSpeed(speed);
    ctx.dt = dt;
    ctx.t += dt;
    ctx.st += dt;
    ctx.phase += dt * (state === 'stumble' ? 11 : runCadence(ctx.speed));
    const P = blend.target();
    spiderPose(state, P, ctx);
    if (extras.pose) extras.pose(state, P, ctx);
    const pose = blend.finish(dt);
    ctx.land += dt;
    ctx.pop += dt;
    if (ctx.land < LAND_T) { // landing: squash down into bent knees, arms out for balance
      const e = Math.sin(Math.PI * ctx.land / LAND_T);
      pose.rootSquash *= 1 - 0.16 * e;
      pose.pelvisY -= 0.06 * e;
      pose.kneeL -= 0.7 * e;
      pose.kneeR -= 0.7 * e;
      pose.legLX += 0.4 * e;
      pose.legRX += 0.4 * e;
      pose.spineRX -= 0.15 * e;
      pose.armLZ -= 0.45 * e;
      pose.armRZ += 0.45 * e;
    }
    if (ctx.pop < POP_T) { // popping up out of the slide: a quick stretch
      const e = Math.sin(Math.PI * ctx.pop / POP_T);
      pose.rootSquash *= 1 + 0.1 * e;
      pose.pelvisY += 0.06 * e;
      pose.armLZ -= 0.7 * e;   // arms spring out wide
      pose.armRZ += 0.7 * e;
    }

    pelvis.position.set(pose.pelvisX, D.hipY + pose.pelvisY, pose.pelvisZ);
    pelvis.rotation.set(pose.pelvisRX, pose.pelvisRY, pose.pelvisRZ);
    spine.rotation.set(pose.spineRX, pose.spineRY, pose.spineRZ);
    const base = CONFIG.playerHeight / DESIGN_H, rs = pose.rootSquash;
    scaler.scale.set(base / Math.sqrt(rs), base * rs, base / Math.sqrt(rs));
    spin.rotation.set(pose.flip, pose.twist, 0);
    // a roll turns around the middle of the tucked ball (pivot) and lifts a little (lift)
    spin.position.y = SPIN_Y + pose.pivot + pose.lift;
    spinIn.position.y = -SPIN_Y - pose.pivot;
    const sq = pose.squash;
    spine.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    head.rotation.set(pose.headRX * HEAD_NOD, pose.headRY, pose.headRZ * HEAD_NOD);
    neck.position.y = D.neckY + pose.neckOut; // slide crouch: head pushed out ahead of the shoulders
    // slide crouch: shoulders and hips spread a little (the joints hide under the big head)
    shoulderR.position.x = D.shoulderX + pose.limbOut;
    shoulderL.position.x = -shoulderR.position.x;
    legR.hip.position.x = D.hipX + 0.6 * pose.limbOut;
    legL.hip.position.x = -legR.hip.position.x;
    shoulderL.rotation.set(pose.armLX, pose.armLY, pose.armLZ);
    shoulderR.rotation.set(pose.armRX, pose.armRY, pose.armRZ);
    armL.elbow.rotation.x = pose.elbowL;
    armR.elbow.rotation.x = pose.elbowR;
    legL.hip.rotation.set(pose.legLX, 0, pose.legLZ);
    legR.hip.rotation.set(pose.legRX, 0, pose.legRZ);
    legL.knee.rotation.x = pose.kneeL;
    legR.knee.rotation.x = pose.kneeR;
    const maps = state === 'scared' && shockMaps ? shockMaps : headMaps;
    if (maps && headMat.map !== maps[0]) [headMat.map, headMat.emissiveMap] = maps;
    if (extras.apply) extras.apply(pose, ctx, state);
  }

  update(0);
  // textures that are swapped in later (main.js uploads them to the GPU at start-up)
  const textures = shockMaps || [];
  return { root, setState, update, setSpeed, parts, textures };
}

// Run cycle speed (rad/s of the stride phase; one stride = 2 steps) from game speed:
// CONFIG.startSpeed (11 m/s) -> 13 rad/s (~2.1 strides/s), CONFIG.maxSpeed (28) -> 21 rad/s (~3.3/s).
export function runCadence(speed) {
  const f = THREE.MathUtils.clamp((speed - CONFIG.startSpeed) / (CONFIG.maxSpeed - CONFIG.startSpeed), 0, 1);
  return 13 + 8 * f;
}

// Jump key poses (st = time since take-off). Keys not listed keep their default.
const JUMP_SQUASH = {
  rootSquash: 0.86, pelvisY: -0.06, kneeL: -0.9, kneeR: -0.9, legLX: 0.5, legRX: 0.5, spineRX: -0.3,
  armLX: -0.6, armRX: -0.6, armLZ: -0.3, armRZ: 0.3, elbowL: 0.4, elbowR: 0.4,
};
const JUMP_STRETCH = {
  rootSquash: 1.12, pelvisY: 0.04, legLX: -0.15, legRX: -0.1, kneeL: -0.15, kneeR: -0.2, spineRX: 0.05,
  headRX: 0.4, armLZ: -2.8, armRZ: 2.8, armLX: 0.2, armRX: 0.2, elbowL: 0.1, elbowR: 0.1,
};
const JUMP_TUCK = {
  rootSquash: 0.95, pelvisY: 0.12, legLX: 1.9, legRX: 1.9, kneeL: -2.4, kneeR: -2.4, legLZ: -0.2, legRZ: 0.2,
  spineRX: -0.45, headRX: -0.4, armLX: 1.0, armRX: 1.0, armLZ: -0.35, armRZ: 0.35, elbowL: 2.0, elbowR: 2.0,
};
// intro roll: tucked into a ball, then crouched
const ROLL_TUCK = {
  rootSquash: 0.9, pelvisY: -0.06, squash: 0.95, spineRX: -0.5, headRX: -0.5,
  legLX: 2.0, legRX: 2.0, kneeL: -2.4, kneeR: -2.4, legLZ: -0.15, legRZ: 0.15,
  armLX: 1.3, armRX: 1.3, armLZ: -0.3, armRZ: 0.3, elbowL: 1.6, elbowR: 1.6,
};
const ROLL_CROUCH = {
  rootSquash: 0.92, pelvisY: -0.03, squash: 1, spineRX: -0.35, headRX: 0.4,
  legLX: 1.0, legRX: 0.7, kneeL: -1.6, kneeR: -1.3, legLZ: -0.2, legRZ: 0.2,
  armLX: 0.7, armRX: 0.5, armLZ: -0.6, armRZ: 0.6, elbowL: 0.8, elbowR: 0.8,
};
// 5.png: arms up and out with bent elbows, knees tucked to the belly, crouched in the air
const _peak = {};
function jumpPeak(t) {
  const f = Math.sin(t * 4) * 0.05;
  return Object.assign(_peak, {
    // arms out wide just under the big head so they read from the front and from behind
    pelvisY: 0.08, pelvisRX: -0.12, spineRX: -0.22, headRX: 0.3, headRZ: 0.06,
    armLZ: -1.95 - f, armRZ: 2.05 + f, armLX: 0.25, armRX: 0.15, elbowL: 0.6, elbowR: 0.6,
    legLX: 1.0, legLZ: -1.1, kneeL: -2.1, legRX: 1.3, legRZ: 0.8, kneeR: -1.8, squash: 1,
  });
}

// Slide: the spider crouch (Funko head 0.73 m tall: its bottom sits ~0.15 m off the deck so the
// top stays under ~0.83 m; the head is pushed out ahead of the shoulders so the back emblem and
// the splayed limbs show around it from the chase camera). Arms/legs solved for hands and boots
// on the deck with elbows and knees out wide.
const SLIDE_CROUCH = {
  rootSquash: 0.9, pelvisY: -0.16, pelvisZ: 0.5, pelvisRX: -0.7, spineRX: -0.95, twist: 0,
  neckOut: 0.28, limbOut: 0.09, headRX: 3.67, headRY: 0, pelvisRZ: 0, spineRZ: 0,
  armLX: 0.46, armLY: 0.21, armLZ: -1.69, elbowL: 1.11, armRX: 0.46, armRY: -0.21, armRZ: 1.69, elbowR: 1.11,
  legLX: 1.89, legLZ: -1.25, kneeL: -0.97, legRX: 1.89, legRZ: 1.25, kneeR: -0.97,
};
// entry: turned sideways in a skid (right side leading), right hand slapping the deck, left
// arm thrown up and back, head still looking down the track
const SLIDE_SKID = {
  ...SLIDE_CROUCH, rootSquash: 0.86, twist: 0.6, pelvisX: -0.2, headRY: -0.5, pelvisRZ: 0.04,
  armRX: 0.95, armRY: 0, armRZ: 1.35, elbowR: 0.55,
  armLX: 0.15, armLY: 0, armLZ: -2.45, elbowL: 0.45,
};

// Fills P from timed key poses [[time, pose], ...]: smooth (smoothstep) between keys,
// holds the last one. Keys a pose does not list stay at P's current value.
const _base = {};
export function keyframes(P, st, keys) {
  let i = 0;
  while (i < keys.length - 1 && st >= keys[i + 1][0]) i++;
  const A = keys[i][1];
  const next = keys[i + 1];
  const B = next ? next[1] : A;
  let w = next ? (st - keys[i][0]) / (next[0] - keys[i][0]) : 1;
  w = Math.min(1, Math.max(0, w));
  w = w * w * (3 - 2 * w);
  for (const k in A) if (!(k in _base)) _base[k] = 0;
  for (const k in B) if (!(k in _base)) _base[k] = 0;
  for (const k in _base) {
    if (!(k in A) && !(k in B)) continue;
    const d = P[k];
    const a = k in A ? A[k] : d;
    const b = k in B ? B[k] : d;
    P[k] = a + (b - a) * w;
  }
}

// Target pose for each state. Angles in radians. Arms hang down at 0; armZ moves an arm
// out to its side (left negative, right positive); armX / legX swing forward; knees bend
// with negative values.
function spiderPose(state, P, { t, st, phase }) {
  const s = Math.sin(phase), c = Math.cos(phase);
  switch (state) {
    case 'run': { // superhero sprint: big lean, fists pumping, high knees, bounding stride
      // bounce peaks mid-flight between two footfalls (twice per cycle)
      const air = Math.abs(Math.sin(phase + 0.35));
      P.pelvisY = -0.035 + 0.1 * air;
      P.squash = 0.95 + 0.08 * air;            // squashed on footfall, stretched in flight
      P.pelvisRX = -0.24;
      P.pelvisRY = -0.06 * s;
      P.spineRX = -0.3 - 0.04 * air;           // ~31 degrees forward in total, chest out front
      P.spineRY = 0.16 * s;                    // shoulders drive against the hips
      P.headRX = 0.3;                          // head down-forward, eyes on the road
      P.headRY = -0.14 * s;                    // ...and kept steady
      // legs: high front knee, heel kicks up behind, then a long reach
      P.legLX = 0.5 + 1.05 * s;
      P.legRX = 0.5 - 1.05 * s;
      P.kneeL = -0.3 - 1.9 * Math.pow(Math.max(0, Math.cos(phase - 0.35)), 0.7);
      P.kneeR = -0.3 - 1.9 * Math.pow(Math.max(0, -Math.cos(phase - 0.35)), 0.7);
      P.legLZ = -0.05;
      P.legRZ = 0.05;
      // arms: fists pump hard, close to the body, elbows ~90 degrees
      P.armLX = 0.15 - 1.05 * s;
      P.armRX = 0.15 + 1.05 * s;
      P.armLZ = -0.42 - 0.1 * Math.max(0, s);  // elbows flare a touch on the back swing (shows from behind)
      P.armRZ = 0.42 + 0.1 * Math.max(0, -s);
      P.armLY = 0.28;                          // fists drive toward the centre line
      P.armRY = -0.28;
      P.elbowL = 1.5 - 0.4 * s;                // tighter when the fist comes forward
      P.elbowR = 1.5 + 0.4 * s;
      break;
    }
    case 'jump': { // squash -> stretch -> fast tucked front flip -> opens into the 5.png pose
      keyframes(P, st, [[0, JUMP_SQUASH], [0.05, JUMP_STRETCH], [0.12, JUMP_TUCK], [0.22, JUMP_TUCK], [0.3, jumpPeak(t)]]);
      if (st > 0.07 && st < 0.29) { // one full forward flip; ends at 0 (= 2 pi) so blending never unwinds it
        const u = (st - 0.07) / 0.22;
        P.flip = -Math.PI * 2 * u * u * (3 - 2 * u);
      }
      break;
    }
    case 'slide': { // spider crouch-skate: skids in sideways, slaps a hand down, swings square
      // into a low spider crouch and skates on hands and feet, then pops up (POP_T)
      keyframes(P, st, [[0, SLIDE_SKID], [0.08, SLIDE_SKID], [0.2, SLIDE_CROUCH]]);
      const g = Math.min(1, Math.max(0, (st - 0.16) / 0.14));  // glide fades in after the swing
      const slap = st > 0.16 && st < 0.3 ? Math.sin(Math.PI * (st - 0.16) / 0.14) : 0; // left hand lands
      const w = Math.sin(t * 6.5) * g, w2 = Math.sin(t * 13 + 1) * g;
      P.rootSquash -= 0.035 * slap;
      P.pelvisY += -0.02 * slap + 0.006 * Math.sin(t * 62) * g;        // track buzz
      P.pelvisX += 0.035 * w;                                          // skater's weight shift
      P.pelvisRZ += 0.07 * w;
      P.spineRZ -= 0.05 * w;
      P.headRZ -= 0.12 * w;                                            // head stays level
      P.headRY += 0.06 * Math.sin(t * 3.1) * g;
      P.armLX += 0.1 * w2;                                             // fingers skipping on the deck
      P.armRX -= 0.1 * w2;
      P.elbowL += 0.12 * w2;
      P.elbowR -= 0.12 * w2;
      P.legLZ -= 0.06 * w;                                             // knees take the weight in turn
      P.legRZ -= 0.06 * w;
      break;
    }
    case 'web': { // right arm shoots up-out (clear of the big head), left arm out, legs tucked
      const pull = Math.sin(t * 6) * 0.04;
      P.pelvisY = 0.06;
      P.pelvisRX = 0.05;
      P.spineRX = 0.06;
      P.spineRY = -0.15;
      P.spineRZ = 0.2;
      P.headRX = 0.3;
      P.headRY = 0.2;
      P.headRZ = 0.4;                          // head leans away from the shooting arm
      P.armRX = 0.2 + pull;                    // up past the side of the head, a little forward
      P.armRZ = 2.25;
      P.armRY = 0;
      P.elbowR = 0.05;
      P.armLX = 0.35;
      P.armLZ = -1.3 - pull;
      P.legLX = 1.2;
      P.kneeL = -1.75;
      P.legLZ = -0.45;
      P.legRX = 0.5;
      P.kneeR = -1.3;
      P.legRZ = 0.2;
      break;
    }
    case 'stumble': { // tripping forward, arms windmilling, head wobbling
      const k = Math.max(0.35, 1 - st * 0.8);
      P.pelvisY = 0.03 * Math.abs(c);
      P.pelvisRX = -0.12;
      P.pelvisRZ = Math.sin(st * 17) * 0.22 * k;
      P.spineRX = -0.25 - 0.35 * Math.exp(-st * 4) + Math.sin(st * 9) * 0.1;
      P.spineRZ = Math.sin(st * 13 + 1) * 0.15 * k;
      P.headRX = 0.25;
      P.headRZ = Math.sin(st * 19) * 0.3 * k;
      P.headRY = Math.sin(st * 11) * 0.2;
      P.armLX = Math.sin(t * 19) * 1.5;
      P.armLZ = -1.35 + Math.cos(t * 19) * 0.5;
      P.armRX = Math.sin(t * 19 + 2.2) * 1.5;
      P.armRZ = 1.35 + Math.cos(t * 19 + 2.2) * 0.5;
      P.legLX = 0.8 * s;
      P.legRX = -0.8 * s;
      P.kneeL = -0.3 - 1.0 * Math.max(0, c);
      P.kneeR = -0.3 - 1.0 * Math.max(0, -c);
      P.legLZ = -0.12;
      P.legRZ = 0.12;
      break;
    }
    case 'caught': { // grabbed: flailing arms, kicking legs, wriggling
      P.pelvisY = 0.12 + Math.sin(t * 9) * 0.02;
      P.pelvisRX = 0.12;
      P.spineRX = 0.18;
      P.spineRY = Math.sin(t * 7) * 0.35;
      P.spineRZ = Math.sin(t * 5) * 0.1;
      P.headRX = 0.2;
      P.headRY = Math.sin(t * 11) * 0.45;
      P.headRZ = Math.sin(t * 8) * 0.1;
      P.armLX = 0.5 + Math.sin(t * 13) * 0.5;
      P.armLZ = -2.0 + Math.sin(t * 15) * 0.55;
      P.armRX = 0.5 + Math.sin(t * 13 + 2) * 0.5;
      P.armRZ = 2.0 + Math.sin(t * 15 + 2) * 0.55;
      P.legLX = 0.5 + Math.sin(t * 17) * 0.6;
      P.legRX = 0.5 - Math.sin(t * 17) * 0.6;
      P.kneeL = -0.9 - Math.sin(t * 17 + 1) * 0.6;
      P.kneeR = -0.9 + Math.sin(t * 17 + 1) * 0.6;
      P.legLZ = -0.15;
      P.legRZ = 0.15;
      break;
    }
    case 'swing': { // intro: hanging from a web line, right fist up past the head gripping it,
      // the body hanging under it (head leans away), legs together and swept back
      const sw = Math.sin(t * 2.6);
      P.pelvisY = 0.04;
      P.pelvisRZ = 0.25;
      P.pelvisRX = -0.12 + 0.2 * sw;
      P.spineRZ = 0.15;
      P.spineRX = 0.08;
      P.headRX = 0.3;
      P.headRY = 0.2;
      P.headRZ = 0.6;
      P.armRZ = 2.7;
      P.armRX = 0.05;
      P.elbowR = 0.0;
      P.armLZ = -0.55 - 0.1 * sw;
      P.armLX = 0.25;
      P.elbowL = 0.8;
      P.legLX = -0.3 - 0.25 * sw;
      P.legRX = -0.2 - 0.25 * sw;
      P.kneeL = -0.7;
      P.kneeR = -0.45;
      P.legLZ = 0.04;
      P.legRZ = -0.04;
      break;
    }
    case 'fall': { // intro: flailing tumble, arms windmilling, legs kicking, body pitching
      P.pelvisY = 0.08;
      P.pelvisRX = -0.3 + Math.sin(t * 5) * 0.35;
      P.pelvisRZ = Math.sin(t * 3.7) * 0.25;
      P.spineRX = 0.2;
      P.spineRZ = Math.sin(t * 7) * 0.15;
      P.headRX = 0.5;
      P.headRY = Math.sin(t * 9) * 0.4;
      P.headRZ = Math.sin(t * 6) * 0.4;
      P.armLX = Math.sin(t * 16) * 2.0;
      P.armLZ = -1.6 + Math.cos(t * 16) * 0.7;
      P.armRX = Math.sin(t * 16 + 2.4) * 2.0;
      P.armRZ = 1.6 + Math.cos(t * 16 + 2.4) * 0.7;
      P.elbowL = 0.4;
      P.elbowR = 0.4;
      P.legLX = 0.6 + Math.sin(t * 13) * 0.8;
      P.legRX = 0.6 - Math.sin(t * 13) * 0.8;
      P.kneeL = -0.9 - Math.sin(t * 13 + 1) * 0.6;
      P.kneeR = -0.9 + Math.sin(t * 13 + 1) * 0.6;
      P.legLZ = -0.3;
      P.legRZ = 0.3;
      break;
    }
    case 'roll': { // intro: tucked forward roll, one full turn in ~0.45 s, ends crouched
      keyframes(P, st, [[0, ROLL_TUCK], [0.36, ROLL_TUCK], [0.55, ROLL_CROUCH]]);
      if (st > 0.03 && st < 0.45) { // ends at -2 pi (= 0), then the default 0 takes over
        const u = (st - 0.03) / 0.42;
        const e = u * u * (3 - 2 * u);
        P.flip = -Math.PI * 2 * e;
        P.pivot = -0.12;
        // keeps the lowest point of the (lopsided, big-headed) ball on the floor: fitted to
        // the tucked shape's height above the floor at each angle
        const a = e * Math.PI * 2;
        const fit = -0.06 - 0.058 * Math.cos(a) + 0.345 * Math.sin(a) + 0.048 * Math.cos(2 * a) - 0.098 * Math.sin(2 * a);
        P.lift = fit * Math.min(1, Math.sin(Math.PI * e) * 3);
      }
      break;
    }
    case 'scared': { // intro: looking back over the shoulder, hands up by the face, knees bent,
      // a jolt on entry, then shivering
      const jolt = Math.sin(Math.min(1, st / 0.2) * Math.PI);
      const shiver = Math.sin(t * 48) * 0.012;
      P.rootSquash = 1 + 0.1 * jolt;
      P.pelvisY = -0.06 + 0.1 * jolt + shiver;
      P.pelvisRY = 0.25;
      P.spineRX = 0.12;
      P.spineRY = 0.4;
      P.headRX = 0.25;
      P.headRY = 1.2;
      P.headRZ = 0.1 + shiver * 4;
      P.armLX = 1.25;
      P.armLZ = -0.8;
      P.armLY = 0.4;
      P.elbowL = 1.9;
      P.armRX = 1.1;
      P.armRZ = 0.9;
      P.armRY = -0.4;
      P.elbowR = 1.8;
      P.legLX = 0.6;                           // knees bent, shins upright: feet stay flat
      P.legRX = 0.5;
      P.kneeL = -0.6;
      P.kneeR = -0.5;
      P.legLZ = -0.14;
      P.legRZ = 0.14;
      break;
    }
    case 'idle':
    default: { // photo 9: feet planted, fists clenched out at the sides, breathing
      const b = Math.sin(t * 2.4);
      P.squash = 1 + b * 0.018;
      P.pelvisY = -0.005 + b * 0.004;
      P.spineRX = -0.03;
      P.headRX = 0.04 + Math.sin(t * 1.2) * 0.03;
      P.headRZ = Math.sin(t * 0.9) * 0.05;
      P.armLZ = -0.85 - b * 0.03;              // fists out at chest height, like the figure
      P.armRZ = 0.85 + b * 0.03;
      P.armLX = 0.5;
      P.armRX = 0.5;
      P.armLY = 0.6;
      P.armRY = -0.6;
      P.elbowL = 1.2;
      P.elbowR = 1.2;
      P.legLZ = -0.1;
      P.legRZ = 0.1;
      break;
    }
  }
}

export function createSpiderman() {
  const m = createSpiderCharacter(SPIDER_LOOK);
  m.root.name = 'spiderman';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR, textures: m.textures };
}
