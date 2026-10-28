// spiderman.js — chibi Spider-Man, built from smooth primitives + canvas-painted textures.
//   createSpiderman() -> { root, setState(name), update(dt, speed?), setSpeed(v), hand }
//   (hand: empty marker in the right mitten, where the web line starts; speed: game speed in
//   m/s, optional, makes the run cadence faster - see runCadence)
//   root origin at the feet, facing -Z, about CONFIG.playerHeight tall.
//   States: idle, run, jump, slide, web, stumble, caught (blend ~0.12 s).
// The body builder (createSpiderCharacter) and the painting helpers are shared with
// ironspider.js, which only swaps the paint job and adds the mechanical arms.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  toonMaterial, addOutline, canvasTexture, smoothLathe, facePatch, mergeGeos, smoothNormals, PoseBlend,
  roundCube, boxify,
} from './toon.js';

// ------------------------------------------------------------------ proportions
// Designed at 1.6 m and scaled to CONFIG.playerHeight. Funko-style: a big rounded-cube
// head (≈ 45 % of the height) sitting straight on a compact boxy torso, no neck.
const DESIGN_H = 1.6;
export const SPIDER_DIM = {
  hipY: 0.36,          // hip joint height
  hipX: 0.088,
  thighLen: 0.15,      // hip -> knee
  headR: 0.38,         // head "radius" (half width); half height = 0.95 x this
  neckY: 0.54,         // head pivot above the hips (= bottom of the head, inside the shoulders)
  headUp: 0.339,       // head centre above the pivot (top of head = 1.6 m)
  shoulderX: 0.15,
  shoulderY: 0.41,     // above the hips
  elbowY: 0.16,        // elbow below the shoulder
};
const D = SPIDER_DIM;

export const OUTLINE = 0.024;
export const OUTLINE_COLOR = 0x1c1016;
const LINE = '#16121c';

// How much of the pose's head nod / tilt is used: the head sits on the shoulders, so it
// only nods a little (big nods would open a gap under it).
const HEAD_NOD = 0.45;
const SPIN_Y = 0.8;      // flip / twist pivot above the feet
const LAND_T = 0.2;     // landing squash after a jump (s)
const POP_T = 0.18;     // stretch when popping up out of a slide (s)

// Funko head: a rounded cube, a bit flatter front to back, chin slightly narrower.
export function deformHead(v, R = D.headR) {
  roundCube(v, 3);
  v.x *= 1.0;
  v.y *= 0.95;
  v.z *= 0.92;
  const t = v.y < 0 ? Math.min(1, -v.y / (R * 0.95)) : 0;
  const f = 1 - 0.1 * t * t;
  v.x *= f;
  v.z *= f;
  return v;
}

// ------------------------------------------------------------------ painting helpers

// Web on a sphere whose UV pole faces forward: meridians (vertical lines) radiate from
// the face centre (canvas top) and parallels (horizontal lines) make the rings.
export function paintPolarWeb(g, W, H, { spokes = 16, rings = 15, color = LINE, width = 2.3 } = {}) {
  g.fillStyle = color;
  for (let k = 0; k < spokes; k++) {
    const x = ((k + 0.5) / spokes) * W;
    g.beginPath();
    const left = [], right = [];
    for (let y = 0; y <= H; y += 4) {
      const s = Math.max(Math.sin((y / H) * Math.PI), 0.1);
      const hw = Math.min(width * 0.5 / s, 12);
      left.push([x - hw, y]);
      right.push([x + hw, y]);
    }
    g.moveTo(left[0][0], left[0][1]);
    for (const p of left) g.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    g.fill();
  }
  g.strokeStyle = color;
  g.lineWidth = width;
  const step = H / rings;
  for (let i = 1; i < rings; i++) {
    const y = i * step;
    const sag = (y < H / 2 ? -1 : 1) * step * 0.3;
    g.beginPath();
    for (let k = 0; k <= spokes; k++) {
      const x0 = ((k - 0.5) / spokes) * W;
      const x1 = ((k + 0.5) / spokes) * W;
      if (k === 0) g.moveTo(x0, y);
      g.quadraticCurveTo((x0 + x1) / 2, y + sag, x1, y);
    }
    g.stroke();
  }
}

// Web radiating from a centre point (chest emblem / middle of the back).
// toPx(xm, ym) converts metres around the centre to canvas pixels.
export function paintRadialWeb(g, toPx, { spokes = 12, step = 0.05, maxR = 0.6, color = LINE, width = 2.2, rot = 0 } = {}) {
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
      const [xc, yc] = toPx(Math.cos(am) * r * 0.8, Math.sin(am) * r * 0.8);
      const [x1, y1] = toPx(Math.cos(a1) * r, Math.sin(a1) * r);
      if (k === 0) g.moveTo(x0, y0);
      g.quadraticCurveTo(xc, yc, x1, y1);
    }
    g.stroke();
  }
}

// Grid web for limbs: lines along the limb + scalloped rings around it.
export function paintWebGrid(g, x0, y0, x1, y1, { cols = 8, rows = 9, color = LINE, width = 2, sag = 0.3 } = {}) {
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

// Spider emblem. Unit coordinates (y down), scaled by s metres through toPx.
const SPIDER_LEGS = [
  [[0.07, -0.13], [0.26, -0.40], [0.58, -0.50]],
  [[0.09, -0.05], [0.40, -0.21], [0.68, -0.14]],
  [[0.09, 0.05], [0.38, 0.16], [0.58, 0.44]],
  [[0.07, 0.13], [0.24, 0.40], [0.30, 0.78]],
];
export function paintSpider(g, toPx, s, fill, outline, { leg = 0.085, edge = 3, bodyW = 0.11 } = {}) {
  const ux = (x, y) => toPx(x * s, y * s);
  const pxPerUnit = Math.abs(toPx(s, 0)[0] - toPx(0, 0)[0]);
  const draw = (color, extra) => {
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = leg * pxPerUnit + extra * 2;
    for (const side of [-1, 1]) {
      for (const l of SPIDER_LEGS) {
        g.beginPath();
        const p0 = ux(l[0][0] * side, l[0][1]);
        const p1 = ux(l[1][0] * side, l[1][1]);
        const p2 = ux(l[2][0] * side, l[2][1]);
        g.moveTo(p0[0], p0[1]);
        g.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
        g.stroke();
      }
    }
    // head + long body
    const head = ux(0, -0.17);
    const body = ux(0, 0.07);
    const hx = 0.075 * pxPerUnit + extra;
    g.beginPath();
    g.ellipse(head[0], head[1], hx, hx * 1.05 * Math.abs((toPx(0, s)[1] - toPx(0, 0)[1]) / pxPerUnit), 0, 0, Math.PI * 2);
    g.fill();
    const ry = Math.abs(toPx(0, s)[1] - toPx(0, 0)[1]);
    g.beginPath();
    g.ellipse(body[0], body[1], bodyW * pxPerUnit + extra, 0.25 * ry + extra, 0, 0, Math.PI * 2);
    g.fill();
  };
  if (outline) draw(outline, edge);
  draw(fill, 0);
}

// Spider-Man eye lenses in face-patch space (radians; a = right, b = up).
// eyesPatch() maps them onto a 512x256 canvas covering a∈[-1,1], b∈[-0.5,0.5].
export const EYE_PATCH = { a0: -1, a1: 1, b0: -0.5, b1: 0.5 };
export function eyePath(g, side, toPx) {
  const P = (a, b) => toPx(a * side, b);
  g.beginPath();
  let p = P(0.06, -0.12); g.moveTo(p[0], p[1]);
  let c1 = P(0.04, -0.03), c2 = P(0.05, 0.04); p = P(0.10, 0.09);
  g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
  c1 = P(0.25, 0.20); c2 = P(0.42, 0.30); p = P(0.60, 0.31);
  g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
  c1 = P(0.78, 0.31); c2 = P(0.80, 0.08); p = P(0.68, -0.06);
  g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
  c1 = P(0.52, -0.22); c2 = P(0.22, -0.24); p = P(0.06, -0.12);
  g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
  g.closePath();
}
export function paintEyes(g, W, H, { border = '#111015', lens = '#ffffff', borderW = 0.085, inner = null } = {}) {
  const k = W / (EYE_PATCH.a1 - EYE_PATCH.a0);
  const toPx = (a, b) => [(a - EYE_PATCH.a0) * k, (EYE_PATCH.b1 - b) * k];
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round';
  for (const side of [-1, 1]) {
    eyePath(g, side, toPx);
    g.strokeStyle = border;
    g.lineWidth = borderW * 2 * k;
    g.stroke();
    g.fillStyle = border;
    g.fill();
    g.save();
    eyePath(g, side, toPx);
    g.clip();
    g.fillStyle = lens;
    g.fill();
    if (inner) inner(g, side, toPx, k);
    g.restore();
  }
}

// ------------------------------------------------------------------ the classic paint job

const RED = '#d8202c';
const RED_DARK = '#a3121e';
const BLUE = '#1f4fc4';

const SPIDER_LOOK = {
  head(g, W, H) {
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    paintPolarWeb(g, W, H);
  },
  eyes(g, W, H) {
    paintEyes(g, W, H);
  },
  // info: { W, H, yToPx(y), C (circumference m), L (arc length m) }
  torso(g, W, H, info) {
    const { yToPx, C, L } = info;
    const kx = W / C, ky = H / L;
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    const chestY = yToPx(0.27);
    // front web from the emblem, back web from between the shoulder blades
    g.save();
    g.beginPath(); g.rect(W * 0.25, 0, W * 0.5, H); g.clip();
    paintRadialWeb(g, (x, y) => [W / 2 + x * kx, chestY + y * ky], { spokes: 12, step: 0.05, maxR: 0.75, rot: Math.PI / 12 });
    g.restore();
    for (const cx of [0, W]) {
      g.save();
      g.beginPath(); g.rect(cx === 0 ? 0 : W * 0.75, 0, W * 0.25, H); g.clip();
      paintRadialWeb(g, (x, y) => [cx + x * kx, yToPx(0.25) + y * ky], { spokes: 12, step: 0.05, maxR: 0.75, rot: Math.PI / 12 });
      g.restore();
    }
    // blue side panels (armpit -> waist) and blue below the belt (V at front and back)
    const waist = yToPx(0.07);
    const armpit = yToPx(0.33);
    g.fillStyle = BLUE;
    for (const u of [0.25, 0.75]) {
      const x = u * W;
      g.beginPath();
      g.moveTo(x - 0.015 * kx, armpit);
      g.quadraticCurveTo(x - 0.06 * kx, (armpit + waist) / 2, x - 0.11 * kx, waist + 2);
      g.lineTo(x + 0.11 * kx, waist + 2);
      g.quadraticCurveTo(x + 0.06 * kx, (armpit + waist) / 2, x + 0.015 * kx, armpit);
      g.closePath();
      g.fill();
    }
    g.beginPath();
    g.moveTo(0, waist + 0.05 * ky);
    g.lineTo(W * 0.25, waist);
    g.lineTo(W * 0.5, waist + 0.06 * ky);
    g.lineTo(W * 0.75, waist);
    g.lineTo(W, waist + 0.05 * ky);
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fill();
    // white spider: big on the chest, smaller on the back
    paintSpider(g, (x, y) => [W / 2 + x * kx, chestY + y * ky], 0.2, '#ffffff', '#15121a', { edge: 2.5 });
    for (const cx of [0, W]) {
      paintSpider(g, (x, y) => [cx + x * kx, yToPx(0.25) + y * ky], 0.17, '#ffffff', '#15121a', { edge: 2.5 });
    }
  },
  arm(g, W, H, info) {
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    paintWebGrid(g, 0, 0, W, H, { cols: 8, rows: 10, sag: 0.35 });
    // blue stripe on the inside of the upper arm (u = 0.75 faces the body)
    const elbow = info.yToPx(-0.19);
    g.fillStyle = BLUE;
    g.beginPath();
    g.moveTo(W * 0.62, 0);
    g.lineTo(W * 0.88, 0);
    g.quadraticCurveTo(W * 0.84, elbow * 0.7, W * 0.75, elbow);
    g.quadraticCurveTo(W * 0.66, elbow * 0.7, W * 0.62, 0);
    g.fill();
  },
  thigh(g, W, H) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
  },
  shin(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    // red boot, its top peaks at the front of the shin (u = 0.5)
    const top = info.yToPx(-0.07);
    g.save();
    g.beginPath();
    g.moveTo(0, top + 14);
    for (let x = 0; x <= W; x += 8) {
      const f = Math.cos(((x / W) - 0.5) * Math.PI * 2);
      g.lineTo(x, top + 14 - Math.max(0, f) * 26);
    }
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillStyle = RED;
    g.fill();
    g.clip();
    paintWebGrid(g, 0, top - 30, W, H, { cols: 8, rows: 7, sag: 0.35 });
    g.restore();
  },
  matOpts: { head: { gloss: { color: 0xff9c9c, threshold: 0.985, strength: 0.55 } } },
  eyeGlow: null,
};

// ------------------------------------------------------------------ body builder

function mesh(geo, mat, outline = OUTLINE) {
  const m = new THREE.Mesh(geo, mat);
  if (outline) addOutline(m, outline, OUTLINE_COLOR);
  return m;
}

function texMat(paint, w, h, info, matOpts) {
  const map = canvasTexture(w, h, (g, W, H) => paint(g, W, H, info && { ...info, W, H }));
  return toonMaterial(0xffffff, { map, ...matOpts });
}

function infoFor(geo, C) {
  const H = 256;
  return {
    yToPx: (y) => (1 - geo.userData.vOfY(y)) * H,
    C,
    L: geo.userData.arcLength,
  };
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

  // --- torso: compact rounded box; its top reaches up inside the head (no neck)
  const torsoGeo = smoothLathe([
    [0, -0.08], [0.12, -0.07], [0.165, -0.02], [0.172, 0.1], [0.17, 0.25],
    [0.166, 0.4], [0.142, 0.5], [0.08, 0.56], [0, 0.575],
  ], { segments: 20, samples: 18, scaleZ: 0.82 });
  smoothNormals(boxify(torsoGeo, 3.5));
  const torso = mesh(torsoGeo, texMat(look.torso, 512, 256, infoFor(torsoGeo, 1.05), mo.torso));
  spine.add(torso);

  // --- head (UV pole turned to face forward, so the web radiates from the face)
  const headGeo = new THREE.SphereGeometry(D.headR, 28, 18);
  headGeo.rotateX(-Math.PI / 2);
  {
    const p = headGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      deformHead(v.fromBufferAttribute(p, i));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    smoothNormals(headGeo);
  }
  const neck = new THREE.Group(); // head pivot at the bottom of the head, inside the shoulders
  neck.position.y = D.neckY;
  spine.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  const headMesh = mesh(headGeo, texMat(look.head, 512, 256, null, mo.head), OUTLINE * 1.15);
  headMesh.position.y = D.headUp;
  head.add(headMesh);

  const eyeTex = canvasTexture(512, 256, look.eyes);
  const eyeMat = toonMaterial(0xffffff, {
    map: eyeTex, alphaTest: 0.5,
    emissive: look.eyeGlow ?? 0x8a8a8a, emissiveMap: eyeTex, emissiveIntensity: look.eyeGlow ? 1 : 1,
    ...(mo.eyes || {}),
  });
  const eyes = new THREE.Mesh(
    // patch shifted 0.1 rad down: the eyes sit a touch low on the face
    facePatch(D.headR, EYE_PATCH.a0, EYE_PATCH.a1, EYE_PATCH.b0 - 0.1, EYE_PATCH.b1 - 0.1, 0.006, { segX: 18, segY: 9, deform: deformHead }),
    eyeMat
  );
  eyes.position.y = D.headUp;
  head.add(eyes);

  // --- arms: upper arm (pivot at the shoulder) + forearm with the mitten hand (pivot at
  // the elbow). One paint job covers the whole arm: arm-space y is measured from the shoulder.
  const upperGeo = smoothLathe([
    [0, -D.elbowY - 0.045], [0.045, -D.elbowY - 0.03], [0.049, -D.elbowY], [0.05, -0.08],
    [0.057, 0], [0.05, 0.03], [0, 0.055],
  ], { segments: 12, samples: 12 });
  const foreGeo = smoothLathe([
    [0, -0.23], [0.056, -0.212], [0.072, -0.162], [0.06, -0.112], [0.046, -0.065],
    [0.047, 0], [0.042, 0.03], [0, 0.045],
  ], { segments: 12, samples: 14 });
  const upperMat = texMat(look.arm, 256, 256, infoFor(upperGeo, 0.35), mo.arm);
  const foreInfo = infoFor(foreGeo, 0.35);
  const foreMat = texMat(look.arm, 256, 256, { ...foreInfo, yToPx: (y) => foreInfo.yToPx(y + D.elbowY) }, mo.arm);
  // left side turned half round so the inside of the arm faces the body
  const upperGeoL = upperGeo.clone().rotateY(Math.PI);
  const foreGeoL = foreGeo.clone().rotateY(Math.PI);
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
  // empty marker in the right mitten: where the web line starts (G9)
  const handR = new THREE.Object3D();
  handR.position.y = -0.19;
  armR.elbow.add(handR);

  // --- legs: thigh + shin with a little foot
  const thighGeo = smoothLathe([
    [0, -0.205], [0.05, -0.19], [0.072, -0.15], [0.082, -0.08], [0.088, 0], [0.07, 0.04], [0, 0.06],
  ], { segments: 12, samples: 12 });
  const shinLathe = smoothLathe([
    [0, -0.17], [0.055, -0.16], [0.062, -0.12], [0.067, -0.05], [0.07, 0.0], [0.05, 0.035], [0, 0.045],
  ], { segments: 12, samples: 12 });
  const shinInfo = infoFor(shinLathe, 0.4);
  const foot = new THREE.SphereGeometry(1, 12, 8);
  foot.scale(0.07, 0.048, 0.105);
  foot.translate(0, -0.163, -0.035);
  { const uv = foot.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.12); }
  const shinGeo = mergeGeos([shinLathe, foot]);
  const thighMat = texMat(look.thigh, 128, 128, null, mo.thigh);
  const shinMat = texMat(look.shin, 256, 256, shinInfo, mo.shin);

  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * D.hipX, 0, 0);
    hip.add(mesh(thighGeo, thighMat, OUTLINE * 0.9));
    const knee = new THREE.Group();
    knee.position.y = -D.thighLen;
    knee.add(mesh(shinGeo, shinMat, OUTLINE * 0.9));
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee };
  }
  const legL = leg(-1);
  const legR = leg(1);

  const parts = { root, scaler, pelvis, spine, neck, head, headMesh, eyes, torso, shoulderL, shoulderR, armL, armR, handR, legL, legR };
  if (extras.build) extras.build(parts);

  // ---------------------------------------------------------------- animation
  const defaults = {
    pelvisX: 0, pelvisY: 0, pelvisZ: 0, pelvisRX: 0, pelvisRY: 0, pelvisRZ: 0,
    spineRX: 0, spineRY: 0, spineRZ: 0, squash: 1, rootSquash: 1, flip: 0, twist: 0,
    headRX: 0, headRY: 0, headRZ: 0,
    armLX: 0, armLY: 0, armLZ: -0.12, armRX: 0, armRY: 0, armRZ: 0.12, elbowL: 0.12, elbowR: 0.12,
    legLX: 0, legLZ: 0, legRX: 0, legRZ: 0, kneeL: 0, kneeR: 0,
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
    let time = 0.13;
    if (name === 'jump') time = 0.06;          // the take-off squash must show at once
    else if (name === 'slide') time = 0.07;    // quick drop
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
      pose.pelvisY -= 0.07 * e;
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
    }

    pelvis.position.set(pose.pelvisX, D.hipY + pose.pelvisY, pose.pelvisZ);
    pelvis.rotation.set(pose.pelvisRX, pose.pelvisRY, pose.pelvisRZ);
    spine.rotation.set(pose.spineRX, pose.spineRY, pose.spineRZ);
    const base = CONFIG.playerHeight / DESIGN_H, rs = pose.rootSquash;
    scaler.scale.set(base / Math.sqrt(rs), base * rs, base / Math.sqrt(rs));
    spin.rotation.set(pose.flip, pose.twist, 0);
    const sq = pose.squash;
    spine.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    head.rotation.set(pose.headRX * HEAD_NOD, pose.headRY, pose.headRZ * HEAD_NOD);
    shoulderL.rotation.set(pose.armLX, pose.armLY, pose.armLZ);
    shoulderR.rotation.set(pose.armRX, pose.armRY, pose.armRZ);
    armL.elbow.rotation.x = pose.elbowL;
    armR.elbow.rotation.x = pose.elbowR;
    legL.hip.rotation.set(pose.legLX, 0, pose.legLZ);
    legR.hip.rotation.set(pose.legRX, 0, pose.legRZ);
    legL.knee.rotation.x = pose.kneeL;
    legR.knee.rotation.x = pose.kneeR;
    if (extras.apply) extras.apply(pose, ctx, state);
  }

  update(0);
  return { root, setState, update, setSpeed, parts };
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
// 5.png: arms up and out with bent elbows, knees tucked to the belly, crouched in the air
const _peak = {};
function jumpPeak(t) {
  const f = Math.sin(t * 4) * 0.05;
  return Object.assign(_peak, {
    // arms out wide just under the big head so they read from the front and from behind
    pelvisY: 0.08, pelvisRX: -0.12, spineRX: -0.22, headRX: 0.3, headRZ: 0.06,
    armLZ: -1.75 - f, armRZ: 1.85 + f, armLX: 0.25, armRX: 0.15, elbowL: 0.55, elbowR: 0.55,
    legLX: 1.0, legLZ: -1.1, kneeL: -2.1, legRX: 1.3, legRZ: 0.8, kneeR: -1.8, squash: 1,
  });
}

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
      P.legLZ = -0.03;
      P.legRZ = 0.03;
      // arms: fists pump hard, close to the body, elbows ~90 degrees
      P.armLX = 0.15 - 1.05 * s;
      P.armRX = 0.15 + 1.05 * s;
      P.armLZ = -0.38 - 0.1 * Math.max(0, s);  // elbows flare a touch on the back swing (shows from behind)
      P.armRZ = 0.38 + 0.1 * Math.max(0, -s);
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
    case 'slide': { // power slide: quick drop, nearly flat, trailing hand drags, buzzing
      const imp = Math.max(0, 1 - st / 0.12);  // impact right after the drop
      const buzz = Math.min(1, st / 0.1);
      P.rootSquash = 0.84 - 0.08 * imp;
      P.pelvisY = -0.21 - 0.03 * imp + 0.012 * Math.sin(t * 62) * buzz;
      P.pelvisRX = 1.1;
      P.pelvisRY = 0.9;
      P.pelvisX = -0.36;
      P.pelvisZ = -0.15;
      P.pelvisRZ = -0.12 + 0.035 * Math.sin(t * 47) * buzz;
      P.spineRX = 0.2;
      P.spineRY = 0.1;
      P.headRX = -0.3;
      P.headRY = -0.7;
      P.headRZ = 0.08 + 0.06 * Math.sin(t * 53) * buzz;
      P.legRX = 0.4;
      P.kneeR = -0.05;
      P.legRZ = 0.1;
      P.legLX = 0.75;
      P.legLZ = -0.7;
      P.kneeL = -1.3;
      P.armLX = -1.05;     // trailing hand dragging on the ground behind
      P.armLZ = -0.5;
      P.elbowL = 0.05;
      P.armRX = 1.5;       // front fist up
      P.armRZ = 0.5;
      P.elbowR = 1.4;
      break;
    }
    case 'web': { // right arm shoots up (past the head), left arm out, legs tucked
      const pull = Math.sin(t * 6) * 0.04;
      P.pelvisY = 0.06;
      P.pelvisRX = 0.05;
      P.spineRX = 0.06;
      P.spineRY = -0.15;
      P.spineRZ = 0.16;
      P.headRX = 0.3;
      P.headRY = 0.2;
      P.headRZ = 0.22;
      P.armRX = -0.4 + pull;                   // up and a little forward
      P.armRZ = 2.65;
      P.armRY = -0.3;
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
    case 'idle':
    default: {
      const b = Math.sin(t * 2.4);
      P.squash = 1 + b * 0.018;
      P.pelvisY = -0.005 + b * 0.004;
      P.spineRX = -0.03;
      P.headRX = 0.04 + Math.sin(t * 1.2) * 0.03;
      P.headRZ = Math.sin(t * 0.9) * 0.05;
      P.armLZ = -0.2 - b * 0.04;
      P.armRZ = 0.2 + b * 0.04;
      P.armLX = 0.05;
      P.armRX = 0.05;
      P.legLZ = -0.04;
      P.legRZ = 0.04;
      break;
    }
  }
}

export function createSpiderman() {
  const m = createSpiderCharacter(SPIDER_LOOK);
  m.root.name = 'spiderman';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
