// ironspider.js — chibi Iron Spider as a Funko Pop vinyl figure: the Spider-Man body (shared
// builder in spiderman.js) with a red / gold / black armour paint job, a glossier metallic
// finish, softly glowing lenses and four golden mechanical arms on the back (instanced:
// 6 draw calls for all of them, outlines included).
//   createIronSpider() -> { root, setState(name), update(dt, speed?), setSpeed(v), hand }
//   (hand: web line start; speed: game speed in m/s for the run cadence, optional)
//   States: idle, run, jump, slide, web, stumble, caught.

import * as THREE from 'three';
import { toonMaterial, addOutline, mergeGeos, TubeShape } from './toon.js';
import {
  createSpiderCharacter, keyframes, paintLenses, paintSpiderEmblem, paintWebGrid,
  CHEST_SPIDER, TORSO, SATIN, OUTLINE_COLOR,
} from './spiderman.js';

const RED = '#c0152a';
const BLACK = '#1a1922';
const GOLD = '#f2bd38';
const GOLD_EDGE = '#7a4a00';
const LINE = '#3a0610';

function goldLine(g, pathFn, w = 5) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  pathFn();
  g.strokeStyle = GOLD_EDGE;
  g.lineWidth = w * 1.7;
  g.stroke();
  g.strokeStyle = GOLD;
  g.lineWidth = w;
  g.stroke();
}

// gold spider with a dark rim: drawn once fat in the rim colour, then in gold
function goldSpider(g, P, k, spider) {
  const fat = { ...spider, legW: [spider.legW[0] + 0.008, spider.legW[1] + 0.008] };
  g.save();
  g.strokeStyle = GOLD_EDGE;
  g.lineWidth = 0.008 * k;
  g.lineJoin = 'round';
  const fill = g.fill.bind(g);
  g.fill = (...a) => { fill(...a); g.stroke(); };   // rim around the head and body shapes too
  paintSpiderEmblem(g, P, k, { ...fat, color: GOLD_EDGE });
  delete g.fill;
  g.restore();
  paintSpiderEmblem(g, P, k, { ...spider, color: GOLD });
}

// Metallic vinyl: glossier than Spider-Man's satin, with a warm gold rim.
const METAL = {
  ...SATIN,
  sheen: { color: 0xffe6dc, threshold: 0.62, strength: 0.16, soft: 0.3 },
  gloss: { color: 0xffffff, threshold: 0.978, strength: 0.65, soft: 0.01 },
  rim: { color: 0xffc04a, threshold: 0.66, strength: 0.2, soft: 0.12 },
};

const IRON_LOOK = {
  head: { color: RED, web: { color: LINE, opacity: 0.8, width: 0.009 } },
  face(g, E, s) {
    paintLenses(g, E, s, {
      lens: '#f2fbff',
      lensShade: '#bfe9ff',
      inner(g2, side, E2, scale) { // soft blue glow toward the rim of the lens
        const [cx, cy] = E2(0.5 * side, 0.02);
        const grd = g2.createRadialGradient(cx, cy, 0.05 * scale, cx, cy, 0.5 * scale);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(1, '#9fe0ff');
        g2.fillStyle = grd;
        g2.fill();
      },
    });
  },
  lensGlow: 0xbfeaff,
  torsoBase: BLACK,
  torsoFront(g, P, k) {
    const T = TORSO;
    // red chest and shoulders, a V of black rising from the belt, gold trim on the edge
    const edge = () => {
      g.beginPath();
      let p = P(0.32, T.armpit - 0.02); g.moveTo(p[0], p[1]);
      p = P(0.17, T.armpit - 0.03); g.lineTo(p[0], p[1]);
      const c = P(0.1, 0.2); p = P(0, 0.135);
      g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      const c2 = P(-0.1, 0.2); p = P(-0.17, T.armpit - 0.03);
      g.quadraticCurveTo(c2[0], c2[1], p[0], p[1]);
      p = P(-0.32, T.armpit - 0.02); g.lineTo(p[0], p[1]);
    };
    edge();
    let p = P(-0.32, 0.7); g.lineTo(p[0], p[1]);
    p = P(0.32, 0.7); g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillStyle = RED;
    g.fill();
    goldSpider(g, (x, y) => P(x, y + 0.27), k, CHEST_SPIDER);
    goldLine(g, edge, 0.009 * k);
    // gold belt line and side lines
    goldLine(g, () => { g.beginPath(); const a = P(0.32, T.beltHi), b = P(-0.32, T.beltHi); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }, 0.008 * k);
    for (const s of [-1, 1]) {
      goldLine(g, () => {
        g.beginPath();
        const a = P(s * 0.165, T.armpit - 0.04), c = P(s * 0.13, 0.17), b = P(s * 0.15, T.beltHi);
        g.moveTo(a[0], a[1]);
        g.quadraticCurveTo(c[0], c[1], b[0], b[1]);
      }, 0.006 * k);
    }
  },
  torsoBack(g, P, k) {
    const T = TORSO;
    const edge = () => {
      g.beginPath();
      let p = P(-0.32, T.armpit - 0.02); g.moveTo(p[0], p[1]);
      p = P(-0.16, T.armpit - 0.02); g.lineTo(p[0], p[1]);
      const c = P(-0.08, 0.22); p = P(0, 0.19);
      g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      const c2 = P(0.08, 0.22); p = P(0.16, T.armpit - 0.02);
      g.quadraticCurveTo(c2[0], c2[1], p[0], p[1]);
      p = P(0.32, T.armpit - 0.02); g.lineTo(p[0], p[1]);
    };
    edge();
    let p = P(0.32, 0.7); g.lineTo(p[0], p[1]);
    p = P(-0.32, 0.7); g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillStyle = RED;
    g.fill();
    goldLine(g, edge, 0.009 * k);
    goldLine(g, () => { g.beginPath(); const a = P(0.32, T.beltHi), b = P(-0.32, T.beltHi); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }, 0.008 * k);
    // gold spine line down from the back unit
    goldLine(g, () => { g.beginPath(); const a = P(0, 0.19), b = P(0, T.beltHi); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }, 0.006 * k);
  },
  arm(g, W, H, info) {
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    // black inside of the arm, gold edges
    const inner = () => { g.beginPath(); g.rect(W * 0.62, info.yToPx(-0.03), W * 0.26, H); };
    inner();
    g.fillStyle = BLACK;
    g.fill();
    goldLine(g, () => {
      g.beginPath();
      g.moveTo(W * 0.62, H); g.lineTo(W * 0.62, info.yToPx(-0.03)); g.lineTo(W * 0.88, info.yToPx(-0.03)); g.lineTo(W * 0.88, H);
    }, 4);
  },
  fore(g, W, H, info) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    const cuff = info.yToPx(-0.08);
    g.fillStyle = RED;
    g.fillRect(0, cuff, W, H - cuff);
    goldLine(g, () => { g.beginPath(); g.moveTo(0, cuff); g.lineTo(W, cuff); }, 7);
    goldLine(g, () => { g.beginPath(); g.moveTo(0, info.yToPx(0.0)); g.lineTo(W, info.yToPx(0.0)); }, 5);
  },
  thigh(g, W, H) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    goldLine(g, () => { g.beginPath(); g.moveTo(W * 0.25, 0); g.lineTo(W * 0.25, H); }, 3);
  },
  shin(g, W, H, info) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    const top = info.yToPx(-0.04);
    const bootPath = () => {
      g.beginPath();
      g.moveTo(0, top);
      for (let x = 0; x <= W; x += 4) {
        const f = Math.cos(((x / W) - 0.5) * Math.PI * 2); // peaks at the front
        g.lineTo(x, top - Math.max(0, f) * 0.03 * info.ky);
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
    paintWebGrid(g, 0, top - 0.03 * info.ky, W, info.yToPx(-0.19), { cols: 10, rows: 5, color: LINE, width: 1.8, sag: 0.35 });
    g.restore();
    goldLine(g, bootPath, 6);
  },
  matOpts: { head: METAL, torso: METAL, arm: METAL, thigh: METAL, shin: METAL },
  lazy: true,
};

// ------------------------------------------------------------------ mechanical arms

const SEG = 0.235;          // segment length
const ARM_COUNT = 4;       // 0,1 = upper pair, 2,3 = lower pair
const ARM_SIDE = [-1, 1, -1, 1];
const ARM_TIER = [0, 0, 1, 1];

function mechGeometries() {
  const seg = new THREE.CylinderGeometry(0.027, 0.034, SEG, 8, 1, true);
  seg.translate(0, SEG / 2, 0);
  const knuckle = new THREE.SphereGeometry(0.046, 10, 7);
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

const MECH_FLARE = {
  mUpT: 1.1, mUpB: 0.1, mUpK1: 0.15, mUpK2: 0.1, mUpC: 0.0,
  mLoT: 2.0, mLoB: 0.1, mLoK1: 0.15, mLoK2: 0.1, mLoC: 0.1, mSway: 0,
};
const MECH_FOLD = {
  mUpT: 0.4, mUpB: 1.0, mUpK1: 1.4, mUpK2: 1.3, mUpC: 0.8,
  mLoT: 1.2, mLoB: 1.1, mLoK1: 1.4, mLoK2: 1.2, mLoC: 0.8, mSway: 0,
};
const MECH_PEAK = {
  mUpT: 0.6, mUpB: 0.25, mUpK1: 0.45, mUpK2: 0.4, mUpC: 0.3,
  mLoT: 1.75, mLoB: 0.3, mLoK1: 0.4, mLoK2: 0.35, mLoC: 0.4, mSway: 0.05,
};

function mechPose(state, P, { t, st }) {
  switch (state) {
    case 'run':
      P.mSway = 0.14;
      P.mUpB = 0.7; P.mLoB = 0.9;
      break;
    case 'jump': // flare out straight on take-off, fold in for the flip, spread wide at the top
      keyframes(P, st, [[0, MECH_FLARE], [0.08, MECH_FLARE], [0.14, MECH_FOLD], [0.24, MECH_FOLD], [0.32, MECH_PEAK]]);
      break;
    case 'web': // upper pair thrown up high, lower pair spread
      P.mUpT = 0.3; P.mUpB = 0.15; P.mUpK1 = 0.35; P.mUpK2 = 0.3; P.mUpC = 0.2;
      P.mLoT = 1.6; P.mLoB = 0.2; P.mLoK1 = 0.5; P.mLoK2 = 0.45; P.mLoC = 0.5;
      P.mSway = 0.05;
      break;
    case 'slide': // braced low: planted on the track both sides like skids, buzzing
      P.mUpT = 1.5; P.mUpB = -0.35; P.mUpK1 = 0.3; P.mUpK2 = 0.9; P.mUpC = 0.5;
      P.mLoT = 1.95; P.mLoB = -0.05; P.mLoK1 = 0.3; P.mLoK2 = 0.9; P.mLoC = 0.5;
      P.mSway = 0;
      P.mFlail = 0.04;
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
    shade: 'soft',
    gloss: { color: 0xfff7d0, threshold: 0.9, strength: 0.95 },
    rim: { color: 0xffe08a, threshold: 0.66, strength: 0.35 },
  });
  const mech = new THREE.Group();
  mech.name = 'mech-arms';
  mech.position.set(0, 0.27, 0.15);
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
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
