// ironspider.js — chibi Iron Spider: the Spider-Man body (shared builder in spiderman.js)
// with a red / gold / black armour paint job, softly glowing eyes and four golden
// mechanical arms on the back (instanced: 4 draw calls for all of them).
//   createIronSpider() -> { root, setState(name), update(dt) }
//   States: idle, run, jump, slide, web, stumble, caught.

import * as THREE from 'three';
import { toonMaterial, addOutline, mergeGeos, TubeShape } from './toon.js';
import {
  createSpiderCharacter, paintPolarWeb, paintRadialWeb, paintWebGrid, paintSpider, paintEyes,
  OUTLINE_COLOR,
} from './spiderman.js';

const RED = '#d01822';
const BLACK = '#1b1a22';
const GOLD = '#f5c23c';
const GOLD_EDGE = '#6b4300';
const LINE = '#1a0d12';

function goldLine(g, pathFn, w = 5) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  pathFn();
  g.strokeStyle = GOLD_EDGE;
  g.lineWidth = w + 3;
  g.stroke();
  g.strokeStyle = GOLD;
  g.lineWidth = w;
  g.stroke();
}

// Red top, black lower body; the red dips in a V at the chest and between the shoulder blades.
function boundaryY(u, C, yc, yFront, yBack) {
  const df = Math.abs(u - 0.5) * C;
  const db = Math.min(u, 1 - u) * C;
  if (df < 0.13) return yFront + (yc - yFront) * (df / 0.13);
  if (db < 0.13) return yBack + (yc - yBack) * (db / 0.13);
  return yc;
}

const SUIT_GLOSS = { gloss: { color: 0xffe2e2, threshold: 0.985, strength: 0.75 }, rim: { color: 0xffc04a, threshold: 0.72, strength: 0.22 } };

const IRON_LOOK = {
  head(g, W, H) {
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    paintPolarWeb(g, W, H, { color: LINE, width: 1.8 });
  },
  eyes(g, W, H) {
    paintEyes(g, W, H, {
      lens: '#f2fbff',
      borderW: 0.08,
      inner(g2, side, toPx, k) { // soft blue glow toward the rim of the lens
        const [cx, cy] = toPx(0.38 * side, 0.06);
        const grd = g2.createRadialGradient(cx, cy, 0.05 * k, cx, cy, 0.42 * k);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(1, '#a9e4ff');
        g2.fillStyle = grd;
        g2.fillRect(0, 0, W, H);
      },
    });
  },
  torso(g, W, H, info) {
    const { yToPx, C, L } = info;
    const kx = W / C, ky = H / L;
    const yc = yToPx(0.33), yFront = yToPx(0.1), yBack = yToPx(0.18);
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    const path = () => {
      g.beginPath();
      g.moveTo(0, -2);
      g.lineTo(W, -2);
      for (let x = W; x >= 0; x -= 4) g.lineTo(x, boundaryY(x / W, C, yc, yFront, yBack));
      g.closePath();
    };
    path();
    g.fillStyle = RED;
    g.fill();
    g.save();
    path();
    g.clip();
    paintRadialWeb(g, (x, y) => [W / 2 + x * kx, yToPx(0.27) + y * ky], { color: LINE, width: 1.8, step: 0.045, maxR: 0.7 });
    for (const cx of [0, W]) paintRadialWeb(g, (x, y) => [cx + x * kx, yToPx(0.27) + y * ky], { color: LINE, width: 1.8, step: 0.045, maxR: 0.7 });
    g.restore();
    // gold trim along the red edge, and two gold side lines on the black
    goldLine(g, () => {
      g.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const y = boundaryY(x / W, C, yc, yFront, yBack);
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    });
    for (const u of [0.25, 0.75]) {
      goldLine(g, () => {
        g.beginPath();
        g.moveTo(u * W - 0.05 * kx, yc);
        g.quadraticCurveTo(u * W - 0.02 * kx, yToPx(0.18), u * W - 0.06 * kx, yToPx(0.0));
        g.moveTo(u * W + 0.05 * kx, yc);
        g.quadraticCurveTo(u * W + 0.02 * kx, yToPx(0.18), u * W + 0.06 * kx, yToPx(0.0));
      }, 3);
    }
    // gold belt line
    goldLine(g, () => {
      g.beginPath();
      g.moveTo(0, yToPx(0.0));
      g.lineTo(W, yToPx(0.0));
    }, 3);
    // golden spider on the chest
    paintSpider(g, (x, y) => [W / 2 + x * kx, yToPx(0.26) + y * ky], 0.18, GOLD, '#140f14', { edge: 3 });
  },
  arm(g, W, H, info) {
    const elbow = info.yToPx(-0.19);
    const wrist = info.yToPx(-0.265);
    g.fillStyle = RED;
    g.fillRect(0, 0, W, elbow);
    g.save();
    g.beginPath(); g.rect(0, 0, W, elbow); g.clip();
    paintWebGrid(g, 0, 0, W, elbow, { cols: 8, rows: 5, color: LINE, width: 1.8, sag: 0.35 });
    g.restore();
    g.fillStyle = BLACK;
    g.fillRect(0, elbow, W, wrist - elbow);
    g.fillStyle = RED;
    g.fillRect(0, wrist, W, H - wrist);
    goldLine(g, () => { g.beginPath(); g.moveTo(0, elbow); g.lineTo(W, elbow); }, 6);
    goldLine(g, () => { g.beginPath(); g.moveTo(0, wrist); g.lineTo(W, wrist); }, 7);
  },
  thigh(g, W, H) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    goldLine(g, () => {
      g.beginPath();
      g.moveTo(W * 0.3, H * 0.72);
      g.quadraticCurveTo(W * 0.5, H * 0.6, W * 0.7, H * 0.72);
    }, 3);
  },
  shin(g, W, H, info) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    const top = info.yToPx(-0.07);
    const bootPath = () => {
      g.beginPath();
      g.moveTo(0, top + 14);
      for (let x = 0; x <= W; x += 8) {
        const f = Math.cos(((x / W) - 0.5) * Math.PI * 2);
        g.lineTo(x, top + 14 - Math.max(0, f) * 26);
      }
    };
    g.save();
    bootPath();
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillStyle = RED;
    g.fill();
    g.clip();
    paintWebGrid(g, 0, top - 30, W, H, { cols: 8, rows: 7, color: LINE, width: 1.8, sag: 0.35 });
    g.restore();
    goldLine(g, bootPath, 6);
  },
  matOpts: { head: SUIT_GLOSS, torso: SUIT_GLOSS, arm: SUIT_GLOSS, thigh: SUIT_GLOSS, shin: SUIT_GLOSS },
  eyeGlow: 0xbfeaff,
};

// ------------------------------------------------------------------ mechanical arms

const SEG = 0.235;          // segment length
const ARM_COUNT = 4;       // 0,1 = upper pair, 2,3 = lower pair
const ARM_SIDE = [-1, 1, -1, 1];
const ARM_TIER = [0, 0, 1, 1];

function mechGeometries() {
  const seg = new THREE.CylinderGeometry(0.022, 0.029, SEG, 8, 1, true);
  seg.translate(0, SEG / 2, 0);
  const knuckle = new THREE.SphereGeometry(0.04, 10, 7);
  const segGeo = mergeGeos([seg, knuckle]);

  // curved claw blade (curls toward local -X), with a knuckle at its root
  const tube = new TubeShape(7, 6);
  const pts = [], radii = [];
  for (let i = 0; i < 7; i++) {
    const f = i / 6;
    const a = f * 1.25;
    pts.push(new THREE.Vector3(-0.09 * (1 - Math.cos(a)) / (1 - Math.cos(1.25)) * f, Math.sin(a) / Math.sin(1.25) * 0.15, 0));
    radii.push(0.03 * (1 - f) + 0.004);
  }
  tube.set(pts, radii, 1.5);
  const clawGeo = mergeGeos([tube.geometry, new THREE.SphereGeometry(0.038, 10, 7)]);
  return { segGeo, clawGeo };
}

const MECH_DEFAULTS = {
  mUpT: 0.5, mUpB: 0.45, mUpK1: 0.95, mUpK2: 0.9, mUpC: 0.6,
  mLoT: 1.35, mLoB: 0.75, mLoK1: 0.75, mLoK2: 0.6, mLoC: 0.5,
  mSway: 0.06, mFlail: 0,
};

function mechPose(state, P, { t, st }) {
  switch (state) {
    case 'run':
      P.mSway = 0.14;
      P.mUpB = 0.7; P.mLoB = 0.9;
      break;
    case 'jump': // spread wide and reach out
      P.mUpT = 0.6; P.mUpB = 0.25; P.mUpK1 = 0.45; P.mUpK2 = 0.4; P.mUpC = 0.3;
      P.mLoT = 1.75; P.mLoB = 0.3; P.mLoK1 = 0.4; P.mLoK2 = 0.35; P.mLoC = 0.4;
      P.mSway = 0.05;
      break;
    case 'web': // upper pair thrown up high, lower pair spread
      P.mUpT = 0.3; P.mUpB = 0.15; P.mUpK1 = 0.35; P.mUpK2 = 0.3; P.mUpC = 0.2;
      P.mLoT = 1.6; P.mLoB = 0.2; P.mLoK1 = 0.5; P.mLoK2 = 0.45; P.mLoC = 0.5;
      P.mSway = 0.05;
      break;
    case 'slide': // spread flat to the sides, skidding along like extra legs
      P.mUpT = 1.25; P.mUpB = -0.5; P.mUpK1 = 0.35; P.mUpK2 = 0.3; P.mUpC = 0.3;
      P.mLoT = 1.75; P.mLoB = 0.1; P.mLoK1 = 0.35; P.mLoK2 = 0.3; P.mLoC = 0.3;
      P.mSway = 0.02;
      break;
    case 'stumble':
      P.mFlail = 0.45 * Math.max(0.4, 1 - st);
      P.mSway = 0;
      break;
    case 'caught': // stabbing back at whoever grabbed him
      P.mUpT = 0.7; P.mUpB = 1.3 + Math.sin(t * 14) * 0.25; P.mUpK1 = 0.4; P.mUpK2 = 0.3; P.mUpC = 0.2;
      P.mLoT = 1.4; P.mLoB = 1.4 + Math.sin(t * 14 + 1.5) * 0.25; P.mLoK1 = 0.4; P.mLoK2 = 0.3; P.mLoC = 0.2;
      P.mSway = 0.1;
      break;
    default:
      break;
  }
}

function addMechArms(parts) {
  const { segGeo, clawGeo } = mechGeometries();
  const gold = toonMaterial(0xf0b026, {
    gloss: { color: 0xfff7d0, threshold: 0.9, strength: 0.95 },
    rim: { color: 0xffe08a, threshold: 0.66, strength: 0.35 },
  });
  const mech = new THREE.Group();
  mech.name = 'mech-arms';
  mech.position.set(0, 0.29, 0.13);
  parts.spine.add(mech);

  // gold spider-shaped back unit the legs come out of
  const unitGeo = new THREE.SphereGeometry(1, 14, 10);
  unitGeo.scale(0.1, 0.12, 0.05);
  const unit = new THREE.Mesh(unitGeo, gold);
  addOutline(unit, 0.016, OUTLINE_COLOR);
  mech.add(unit);

  const segs = new THREE.InstancedMesh(segGeo, gold, ARM_COUNT * 3);
  const claws = new THREE.InstancedMesh(clawGeo, gold, ARM_COUNT);
  segs.frustumCulled = false;
  claws.frustumCulled = false;
  addOutline(segs, 0.011, OUTLINE_COLOR);
  addOutline(claws, 0.01, OUTLINE_COLOR);
  mech.add(segs, claws);
  return { segs, claws };
}

const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);
const _flip = new THREE.Matrix4().makeRotationY(Math.PI);

function applyMech(mech, pose, { t }) {
  for (let i = 0; i < ARM_COUNT; i++) {
    const s = ARM_SIDE[i];
    const upper = ARM_TIER[i] === 0;
    const sway = pose.mSway * Math.sin(t * 5.5 + i * 1.7);
    const flail = pose.mFlail * Math.sin(t * 17 + i * 2.1);
    const T = (upper ? pose.mUpT : pose.mLoT) + sway + flail;
    const B = (upper ? pose.mUpB : pose.mLoB) + sway * 0.6;
    const K1 = (upper ? pose.mUpK1 : pose.mLoK1) + sway * 1.2 - flail;
    const K2 = (upper ? pose.mUpK2 : pose.mLoK2) + sway + flail * 0.8;
    const C = (upper ? pose.mUpC : pose.mLoC) + sway * 0.8;

    _p.set(s * 0.05, upper ? 0.05 : -0.05, 0.02);
    _q.setFromEuler(_e.set(0, -s * B, -s * T, 'YZX'));
    _m.compose(_p, _q, _one);
    mech.segs.setMatrixAt(i * 3, _m);
    _m.multiply(_r.makeTranslation(0, SEG, 0)).multiply(_r.makeRotationZ(-s * K1));
    mech.segs.setMatrixAt(i * 3 + 1, _m);
    _m.multiply(_r.makeTranslation(0, SEG, 0)).multiply(_r.makeRotationZ(-s * K2));
    mech.segs.setMatrixAt(i * 3 + 2, _m);
    _m.multiply(_r.makeTranslation(0, SEG, 0)).multiply(_r.makeRotationZ(-s * C));
    if (s < 0) _m.multiply(_flip); // claw curls toward the body on both sides
    mech.claws.setMatrixAt(i, _m);
  }
  mech.segs.instanceMatrix.needsUpdate = true;
  mech.claws.instanceMatrix.needsUpdate = true;
}

export function createIronSpider() {
  let mech = null;
  const m = createSpiderCharacter(IRON_LOOK, {
    defaults: MECH_DEFAULTS,
    build(parts) { mech = addMechArms(parts); },
    pose: mechPose,
    apply(pose, ctx) { applyMech(mech, pose, ctx); },
  });
  m.root.name = 'ironspider';
  return { root: m.root, setState: m.setState, update: m.update };
}
