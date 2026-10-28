// venom.js — chibi Venom: big, heavy and glossy black, huge toothy grin, white jagged
// eyes, wiggling red tongue, white spider emblem, clawed hands.
//   createVenom() -> { root, setState(name), update(dt) }
//   root origin at the feet, facing -Z, about 1.4 x CONFIG.playerHeight tall.
//   States: run, reach, catch (blend ~0.12 s).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  toonMaterial, addOutline, canvasTexture, smoothLathe, facePatch, mergeGeos, smoothNormals,
  TubeShape, PoseBlend,
} from './toon.js';

// Designed at 2.24 m (1.4 x 1.6) and scaled with CONFIG.playerHeight.
const DESIGN_H = 1.6;
const V = {
  hipY: 0.52,
  hipX: 0.16,
  thighLen: 0.24,
  shoulderX: 0.33,
  shoulderY: 0.56,  // above the hips
  upperLen: 0.3,    // shoulder -> elbow
  neckY: 0.70,
  neckZ: -0.07,
  headR: 0.46,
  headUp: 0.52,     // head centre above the neck pivot (top ≈ 2.2 m)
};

const OUTLINE = 0.028;
const OUTLINE_COLOR = 0x050509;
const BLACK = 0x1b1b26;
const WHITE = '#f4f3f7';

const GLOSS = {
  gloss: { color: 0xe6ecff, threshold: 0.975, strength: 0.9 },
  rim: { color: 0x5568b0, threshold: 0.68, strength: 0.5 },
};

// Venom's head: a little taller, with a wider jaw for the grin.
function deformHead(v) {
  const R = V.headR;
  const t = v.y < 0 ? Math.min(1, -v.y / R) : 0;
  v.x *= 1.03 + 0.07 * t;
  v.z *= 1 + 0.04 * t;
  v.y *= v.y < 0 ? 1.1 : 1.02;
  return v;
}

// ------------------------------------------------------------------ face texture

const FACE = { a0: -1.3, a1: 1.3, b0: -1.02, b1: 0.6 };

function paintFace(g, W, H) {
  const k = W / (FACE.a1 - FACE.a0);
  const P = (a, b) => [(a - FACE.a0) * k, (FACE.b1 - b) * k];
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round';

  // --- grin: corners pulled up toward the eyes
  const mouth = () => {
    g.beginPath();
    let p = P(-1.08, -0.2); g.moveTo(p[0], p[1]);
    let c = P(-0.55, -0.48); p = P(0, -0.46);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(0.55, -0.48); p = P(1.08, -0.2);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(0.8, -0.95); p = P(0, -0.96);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(-0.8, -0.95); p = P(-1.08, -0.2);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    g.closePath();
  };
  mouth();
  g.fillStyle = '#060207';
  g.lineWidth = 0.06 * k;
  g.strokeStyle = '#060207';
  g.stroke();
  g.save();
  mouth();
  g.clip();
  const [mx, my] = P(0, -0.7);
  const grd = g.createRadialGradient(mx, my, 0.05 * k, mx, my, 0.9 * k);
  grd.addColorStop(0, '#8a1424');
  grd.addColorStop(0.55, '#4a0812');
  grd.addColorStop(1, '#1c0307');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // tongue root
  g.fillStyle = '#c2304a';
  g.beginPath();
  g.ellipse(mx, P(0, -0.78)[1], 0.3 * k, 0.16 * k, 0, 0, Math.PI * 2);
  g.fill();

  // --- teeth: big jagged fangs along both lips
  const upper = (a) => { // y of the upper lip at a
    const f = Math.abs(a) / 1.08;
    return -0.46 + (0.26) * f * f;
  };
  const lower = (a) => {
    const f = Math.abs(a) / 1.08;
    return -0.96 + 0.76 * f * f;
  };
  const tooth = (a, b, w, len, dir) => {
    const p0 = P(a - w / 2, b), p1 = P(a + w / 2, b), tip = P(a + w * 0.08 * Math.sign(-a), b + dir * len);
    g.beginPath();
    g.moveTo(p0[0], p0[1]);
    g.quadraticCurveTo((p0[0] + tip[0]) / 2 - dir * 2, (p0[1] + tip[1]) / 2, tip[0], tip[1]);
    g.quadraticCurveTo((p1[0] + tip[0]) / 2 + dir * 2, (p1[1] + tip[1]) / 2, p1[0], p1[1]);
    g.closePath();
    g.fill();
    g.stroke();
  };
  g.fillStyle = WHITE;
  g.strokeStyle = '#2a2230';
  g.lineWidth = 1.5;
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = -1.0 + (i + 0.5) * (2.0 / n);
    const big = 1 - Math.abs(a) * 0.45;
    tooth(a, upper(a) + 0.02, 0.15 * big, 0.2 * big, -1);
  }
  for (let i = 0; i < n - 2; i++) {
    const a = -0.92 + (i + 0.5) * (1.84 / (n - 2));
    const big = 1 - Math.abs(a) * 0.5;
    tooth(a, lower(a) - 0.02, 0.14 * big, 0.17 * big, 1);
  }
  g.restore();
  g.lineWidth = 0.035 * k;
  g.strokeStyle = '#050307';
  mouth();
  g.stroke();

  // --- eyes: big white jagged shapes sweeping up and back
  const eye = (s) => {
    const E = (a, b) => P(a * s, b);
    g.beginPath();
    let p = E(0.06, -0.16); g.moveTo(p[0], p[1]);
    let c = E(0.12, 0.2); p = E(0.5, 0.42);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = E(0.85, 0.58); p = E(1.18, 0.4);
    g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    const jag = [[1.0, 0.22], [0.98, 0.06], [0.86, 0.14], [0.78, -0.06], [0.68, 0.06], [0.56, -0.13], [0.47, -0.02], [0.36, -0.2], [0.27, -0.1], [0.17, -0.26]];
    for (const [a, b] of jag) { p = E(a, b); g.lineTo(p[0], p[1]); }
    g.closePath();
  };
  for (const s of [-1, 1]) {
    eye(s);
    g.lineWidth = 0.04 * k;
    g.strokeStyle = '#050307';
    g.stroke();
    g.fillStyle = WHITE;
    g.fill();
  }
}

// ------------------------------------------------------------------ torso texture

// Thick tapered stroke along a quadratic curve (emblem tendrils).
function taper(g, p0, p1, p2, w0, w1) {
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    g.beginPath();
    g.arc(x, y, (w0 + (w1 - w0) * t) / 2, 0, Math.PI * 2);
    g.fill();
  }
}

function paintVenomSpider(g, toPx, s, back) {
  const U = (x, y) => toPx(x * s, y * s);
  const px = Math.abs(toPx(s, 0)[0] - toPx(0, 0)[0]);
  g.fillStyle = WHITE;
  const legs = back
    ? [[[0.05, -0.1], [0.3, -0.45], [0.7, -0.62]], [[0.08, 0.0], [0.45, -0.05], [0.85, 0.1]], [[0.06, 0.12], [0.35, 0.3], [0.55, 0.65]]]
    : [[[0.06, -0.14], [0.32, -0.55], [0.72, -0.66]], [[0.1, -0.04], [0.5, -0.16], [0.92, 0.02]],
      [[0.1, 0.08], [0.42, 0.2], [0.68, 0.55]], [[0.06, 0.18], [0.2, 0.5], [0.26, 0.95]]];
  for (const side of [-1, 1]) {
    for (const l of legs) {
      taper(g, U(l[0][0] * side, l[0][1]), U(l[1][0] * side, l[1][1]), U(l[2][0] * side, l[2][1]), 0.17 * px, 0.04 * px);
    }
  }
  // body: head + long abdomen, a bit "melty"
  const h = U(0, -0.2);
  g.beginPath();
  g.ellipse(h[0], h[1], 0.12 * px, 0.11 * px * (Math.abs(toPx(0, s)[1] - toPx(0, 0)[1]) / px), 0, 0, Math.PI * 2);
  g.fill();
  const ry = Math.abs(toPx(0, s)[1] - toPx(0, 0)[1]);
  const b = U(0, back ? 0.15 : 0.12);
  g.beginPath();
  g.ellipse(b[0], b[1], 0.15 * px, (back ? 0.3 : 0.36) * ry, 0, 0, Math.PI * 2);
  g.fill();
}

function paintTorso(g, W, H, info) {
  const { yToPx, C, L } = info;
  const kx = W / C, ky = H / L;
  g.fillStyle = '#1b1b26';
  g.fillRect(0, 0, W, H);
  paintVenomSpider(g, (x, y) => [W / 2 + x * kx, yToPx(0.42) + y * ky], 0.48, false);
  for (const cx of [0, W]) paintVenomSpider(g, (x, y) => [cx + x * kx, yToPx(0.46) + y * ky], 0.4, true);
}

// ------------------------------------------------------------------ builder

function mesh(geo, mat, outline = OUTLINE) {
  const m = new THREE.Mesh(geo, mat);
  if (outline) addOutline(m, outline, OUTLINE_COLOR);
  return m;
}

function clawGeometry() {
  const parts = [];
  const tube = new TubeShape(6, 6);
  for (let c = 0; c < 4; c++) {
    const x = -0.075 + c * 0.05;
    const len = c === 0 || c === 3 ? 0.14 : 0.17;
    const pts = [], radii = [];
    for (let i = 0; i < 6; i++) {
      const f = i / 5;
      const a = f * 1.4;
      // down out of the hand, curling forward (-Z)
      pts.push(new THREE.Vector3(x * (1 + f * 0.4), -0.31 - Math.sin(a) / Math.sin(1.4) * len * 0.85, -0.04 - (1 - Math.cos(a)) * len * 0.55));
      radii.push(0.026 * (1 - f) + 0.004);
    }
    tube.set(pts, radii, 1.6);
    parts.push(tube.geometry.clone());
  }
  return mergeGeos(parts);
}

export function createVenom() {
  const root = new THREE.Group();
  root.name = 'venom';
  const scaler = new THREE.Group();
  scaler.scale.setScalar(CONFIG.playerHeight / DESIGN_H);
  root.add(scaler);
  const pelvis = new THREE.Group();
  pelvis.rotation.order = 'YXZ';
  scaler.add(pelvis);
  const spine = new THREE.Group();
  pelvis.add(spine);

  const black = toonMaterial(BLACK, GLOSS);

  // --- torso: barrel chest, narrow waist
  const torsoGeo = smoothLathe([
    [0, -0.13], [0.17, -0.1], [0.22, 0.0], [0.23, 0.14], [0.29, 0.33], [0.335, 0.5],
    [0.3, 0.64], [0.18, 0.76], [0, 0.82],
  ], { segments: 18, samples: 18, scaleZ: 0.76 });
  const torsoInfo = { yToPx: (y) => (1 - torsoGeo.userData.vOfY(y)) * 256, C: 1.75, L: torsoGeo.userData.arcLength };
  const torsoTex = canvasTexture(512, 256, (g, W, H) => paintTorso(g, W, H, torsoInfo));
  const torsoMat = toonMaterial(0xffffff, { map: torsoTex, emissive: 0x4a4a4a, emissiveMap: torsoTex, ...GLOSS });
  spine.add(mesh(torsoGeo, torsoMat));

  // --- head, face decal, tongue
  const neck = new THREE.Group();
  neck.position.set(0, V.neckY, V.neckZ);
  spine.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  const headGeo = new THREE.SphereGeometry(V.headR, 26, 18);
  {
    const p = headGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      deformHead(v.fromBufferAttribute(p, i));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    smoothNormals(headGeo);
  }
  const headMesh = mesh(headGeo, black, OUTLINE * 1.1);
  headMesh.position.y = V.headUp;
  head.add(headMesh);
  const faceTex = canvasTexture(512, Math.round(512 * (FACE.b1 - FACE.b0) / (FACE.a1 - FACE.a0)), paintFace);
  const face = new THREE.Mesh(
    facePatch(V.headR, FACE.a0, FACE.a1, FACE.b0, FACE.b1, 0.007, { segX: 20, segY: 12, deform: deformHead }),
    toonMaterial(0xffffff, { map: faceTex, alphaTest: 0.5, emissive: 0x6a6a6a, emissiveMap: faceTex })
  );
  face.position.y = V.headUp;
  head.add(face);

  const tongue = new TubeShape(10, 7);
  const tongueMesh = new THREE.Mesh(tongue.geometry, toonMaterial(0xe23a58, {
    gloss: { color: 0xffc4d0, threshold: 0.95, strength: 0.8 },
  }));
  tongueMesh.frustumCulled = false;
  addOutline(tongueMesh, 0.014, OUTLINE_COLOR);
  tongueMesh.position.set(0, V.headUp - 0.25, -0.3);
  head.add(tongueMesh);
  const tonguePts = Array.from({ length: 10 }, () => new THREE.Vector3());
  const tongueR = Array.from({ length: 10 }, (_, i) => 0.075 - i * 0.0042);

  // --- arms: upper arm + forearm with a big hand and four claws
  const upperGeo = smoothLathe([
    [0, -0.36], [0.1, -0.335], [0.105, -0.26], [0.115, -0.13], [0.14, -0.02], [0.125, 0.06], [0, 0.1],
  ], { segments: 14, samples: 14 });
  const foreGeo = smoothLathe([
    [0, -0.385], [0.1, -0.36], [0.128, -0.31], [0.092, -0.245], [0.118, -0.15], [0.102, -0.04], [0.07, 0.03], [0, 0.05],
  ], { segments: 14, samples: 16 });
  const clawGeo = clawGeometry();
  const clawMat = toonMaterial(0xece6da, { gloss: { color: 0xffffff, threshold: 0.93, strength: 0.7 } });
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * V.shoulderX, V.shoulderY, 0);
    shoulder.add(mesh(upperGeo, black));
    const elbow = new THREE.Group();
    elbow.position.y = -V.upperLen;
    elbow.add(mesh(foreGeo, black));
    const claws = mesh(clawGeo, clawMat, 0.009);
    elbow.add(claws);
    shoulder.add(elbow);
    spine.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = arm(-1);
  const armR = arm(1);

  // --- legs
  const thighGeo = smoothLathe([
    [0, -0.3], [0.1, -0.28], [0.125, -0.22], [0.14, -0.1], [0.145, 0], [0.11, 0.06], [0, 0.09],
  ], { segments: 14, samples: 12 });
  const shinLathe = smoothLathe([
    [0, -0.25], [0.085, -0.235], [0.09, -0.18], [0.11, -0.08], [0.115, 0], [0.08, 0.05], [0, 0.07],
  ], { segments: 14, samples: 12 });
  const foot = new THREE.SphereGeometry(1, 14, 9);
  foot.scale(0.105, 0.068, 0.155);
  foot.translate(0, -0.213, -0.05);
  const shinGeo = mergeGeos([shinLathe, foot]);
  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * V.hipX, 0, 0);
    hip.add(mesh(thighGeo, black));
    const knee = new THREE.Group();
    knee.position.y = -V.thighLen;
    knee.add(mesh(shinGeo, black));
    hip.add(knee);
    pelvis.add(hip);
    return { hip, knee };
  }
  const legL = leg(-1);
  const legR = leg(1);

  // ---------------------------------------------------------------- animation
  const defaults = {
    pelvisX: 0, pelvisY: 0, pelvisZ: 0, pelvisRX: 0, pelvisRY: 0, pelvisRZ: 0,
    spineRX: 0, spineRY: 0, spineRZ: 0,
    headRX: 0, headRY: 0, headRZ: 0,
    armLX: 0, armLY: 0, armLZ: -0.3, elbowL: 0.3,
    armRX: 0, armRY: 0, armRZ: 0.3, elbowR: 0.3,
    legLX: 0, legLZ: -0.08, legRX: 0, legRZ: 0.08, kneeL: 0, kneeR: 0,
    tongueOut: 0.3, tongueWiggle: 1,
  };
  const blend = new PoseBlend(defaults, 0.13);
  let state = 'run';
  let t = 0, st = 0, phase = 0;

  function setState(name) {
    if (name === state) return;
    state = name;
    st = 0;
    blend.start();
  }

  function update(dt) {
    dt = Math.min(Math.max(dt, 0), CONFIG.dtCap);
    t += dt;
    st += dt;
    phase += dt * 9.5;
    const P = blend.target();
    venomPose(state, P, t, st, phase);
    const p = blend.finish(dt);

    pelvis.position.set(p.pelvisX, V.hipY + p.pelvisY, p.pelvisZ);
    pelvis.rotation.set(p.pelvisRX, p.pelvisRY, p.pelvisRZ);
    spine.rotation.set(p.spineRX, p.spineRY, p.spineRZ);
    head.rotation.set(p.headRX, p.headRY, p.headRZ);
    armL.shoulder.rotation.set(p.armLX, p.armLY, p.armLZ);
    armR.shoulder.rotation.set(p.armRX, p.armRY, p.armRZ);
    armL.elbow.rotation.x = p.elbowL;
    armR.elbow.rotation.x = p.elbowR;
    legL.hip.rotation.set(p.legLX, 0, p.legLZ);
    legR.hip.rotation.set(p.legRX, 0, p.legRZ);
    legL.knee.rotation.x = p.kneeL;
    legR.knee.rotation.x = p.kneeR;

    // tongue: lolls out of the grin and wiggles; longer when reaching / catching
    const out = p.tongueOut;
    const len = 0.32 + 0.3 * out;
    const wig = p.tongueWiggle;
    for (let i = 0; i < 10; i++) {
      const f = i / 9;
      const s = f * len;
      tonguePts[i].set(
        Math.sin(t * 7 * wig - f * 5) * 0.07 * f * f * (0.6 + wig * 0.4),
        -s * (0.55 - 0.25 * out) - 0.25 * f * f * len * (1 - 0.5 * out) + Math.sin(t * 9 * wig - f * 4) * 0.035 * f * f,
        -s * (0.75 + 0.3 * out) + 0.12 * f * f * len,
      );
    }
    tongue.set(tonguePts, tongueR, 0.9);
  }

  update(0);
  return { root, setState, update };
}

function venomPose(state, P, t, st, phase) {
  const s = Math.sin(phase), c = Math.cos(phase);
  // the legs keep running in every state
  P.pelvisY = 0.075 * Math.abs(c) - 0.03;
  P.pelvisRX = -0.08;
  P.pelvisRY = -0.12 * s;
  P.pelvisRZ = 0.08 * s;
  P.legLX = 0.75 * s;
  P.legRX = -0.75 * s;
  P.kneeL = -0.25 - 1.1 * Math.max(0, c);
  P.kneeR = -0.25 - 1.1 * Math.max(0, -c);
  P.legLZ = -0.12;
  P.legRZ = 0.12;
  switch (state) {
    case 'reach': { // right claw stretched forward, tongue out
      const w = Math.sin(t * 8) * 0.08;
      P.spineRX = -0.45;
      P.spineRY = 0.3 + 0.08 * s;
      P.spineRZ = -0.05 * s;
      P.headRX = 0.4;
      P.headRY = -0.3;
      P.headRZ = 0.05 * s;
      P.armRX = 1.55 + w;
      P.armRZ = 0.12;
      P.armRY = -0.15;
      P.elbowR = 0.08 - w;
      P.armLX = -0.6 * s + 0.1;
      P.armLZ = -0.6;
      P.armLY = 0.3;
      P.elbowL = 0.7 + 0.25 * s;
      P.tongueOut = 1;
      P.tongueWiggle = 1.6;
      break;
    }
    case 'catch': { // lunge: claws thrown wide, then snap shut
      const close = Math.min(1, Math.max(0, (st - 0.08) / 0.25));
      const k = close * close * (3 - 2 * close);
      const snap = Math.sin(t * 11) * 0.08 * k;
      P.pelvisZ = -0.28;
      P.pelvisY = -0.07;
      P.pelvisRX = -0.22;
      P.pelvisRY = 0;
      P.pelvisRZ = 0;
      P.spineRX = -0.45;
      P.headRX = 0.25;
      P.armLX = 1.3 + snap;
      P.armRX = 1.3 + snap;
      P.armLZ = -0.9 + 1.15 * k;
      P.armRZ = 0.9 - 1.15 * k;
      P.elbowL = 0.25 + 0.4 * k;
      P.elbowR = 0.25 + 0.4 * k;
      P.legLX = 0.85;
      P.kneeL = -1.0;
      P.legRX = -0.55;
      P.kneeR = -0.35;
      P.tongueOut = 1;
      P.tongueWiggle = 2;
      break;
    }
    case 'run':
    default: { // lumbering, hunched, arms swinging wide
      P.spineRX = -0.38;
      P.spineRY = 0.25 * s;
      P.spineRZ = -0.07 * s;
      P.headRX = 0.36;
      P.headRY = -0.12 * s;
      P.headRZ = 0.06 * s;
      P.armLX = -0.85 * s + 0.15;
      P.armRX = 0.85 * s + 0.15;
      P.armLZ = -0.55;
      P.armRZ = 0.55;
      P.armLY = 0.3;
      P.armRY = -0.3;
      P.elbowL = 0.65 + 0.35 * s;
      P.elbowR = 0.65 - 0.35 * s;
      P.tongueOut = 0.3;
      P.tongueWiggle = 1;
      break;
    }
  }
}
