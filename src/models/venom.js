// venom.js — chibi Venom as a Funko Pop vinyl figure: a huge glossy-black rounded-cube head
// (white organic eyes dripping toward a full-width grin, red gums, two rows of pointed
// teeth, a long red tongue curling out to one side), a stocky muscular body with a white
// spider front and back, thick arms with clawed hands held out, short thick legs.
//   createVenom() -> { root, setState(name), update(dt) }
//   root origin at the feet, facing -Z, about 2.15 m tall while running.
//   States: run, reach, catch; intro clip: roar (blend ~0.12 s).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  toonMaterial, addOutline, smoothLathe, mergeGeos, smoothNormals, TubeShape, PoseBlend,
  roundCube, boxify, latheGrid, sphereGrid, bakeTextures, sphereDir, flatPicture, rgb, taperCurve,
} from './toon.js';

// Designed in metres at CONFIG.playerHeight 1.6 and scaled with it.
const DESIGN_H = 1.6;
const V = {
  hipY: 0.53,
  hipX: 0.175,
  thighLen: 0.23,   // knee 0.30 m above the floor
  shoulderX: 0.4,
  shoulderY: 0.45,  // above the hips
  upperLen: 0.25,   // shoulder -> elbow
  neckY: 0.6,       // bottom of the head above the hips
  neckZ: -0.04,
  headW: 0.59,      // head half width / height / depth
  headH: 0.5,
  headD: 0.5,
};

const OUTLINE = 0.026;
const OUTLINE_COLOR = 0x050509;
const BLACK = 0x14141b;
const WHITE = '#f4f4f6';

// High-gloss black vinyl: sharp bright highlights, a cool reflected rim, a faint sheen.
const GLOSS = {
  shade: 'soft',
  gloss: { color: 0xffffff, threshold: 0.972, strength: 0.95, soft: 0.01 },
  sheen: { color: 0xffffff, threshold: 0.75, strength: 0.06, soft: 0.2 },
  rim: { color: 0xc4d0ff, threshold: 0.8, strength: 0.32, soft: 0.04 },
};

// Only part of the pose's head nod is used: the head sits right on the shoulders (Funko
// style, no neck), so big nods would open a gap under it.
const HEAD_NOD = 0.5;

// Venom's head: a big rounded cube, flat face, the jaw a touch wider than the top.
function deformHead(v) {
  v.normalize();
  roundCube(v, 4.8);
  const t = v.y < 0 ? -v.y : 0;
  const f = 1 + 0.02 * t - 0.07 * t * t * t;
  v.x *= V.headW * f;
  v.y *= V.headH;
  v.z *= V.headD * (1 - 0.06 * t * t);
  return v;
}

// ------------------------------------------------------------------ face picture
// Face coordinates: X = 1 at the side of the head (model +X = left of the picture),
// Y = 1 at the top. E(X, Y) -> pixels; s = pixels per face unit (x).

// smooth closed blob through points (quadratic curves through the midpoints)
function blobPath(g, pts) {
  g.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]);
  g.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    m = mid(p, q);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  g.closePath();
}

// white eye on side s: outer edge along the side of the face, bottom over the grin, the
// inner edge a row of black drips running down to the middle of the face
const EYE_PTS = [
  [0.7, 0.82], [0.81, 0.76], [0.875, 0.56], [0.89, 0.3], [0.88, 0.04], [0.86, -0.1], [0.79, -0.19],
  [0.64, -0.25], [0.42, -0.29], [0.24, -0.28], [0.14, -0.23], [0.1, -0.14], [0.09, -0.05],
  // black drips hanging into the white, bottom to top
  [0.13, 0.05], [0.2, -0.02], [0.24, 0.1], [0.29, 0.2], [0.36, 0.1], [0.39, 0.25],
  [0.45, 0.36], [0.52, 0.26], [0.55, 0.43], [0.6, 0.54], [0.66, 0.47], [0.67, 0.64], [0.66, 0.78],
];

// grin: corners pulled up, the bottom a deep U
const upperLip = (x) => -0.38 + 0.12 * Math.pow(Math.abs(x) / 0.86, 2.2);
const lowerLip = (x) => -0.86 + 0.6 * Math.pow(Math.abs(x) / 0.86, 1.7);
const MOUTH_X = 0.86;

function paintVenomFace(g, E, s) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // --- mouth opening
  const mouth = () => {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = -MOUTH_X + (2 * MOUTH_X * i) / 40;
      const p = E(x, upperLip(x));
      if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
    }
    for (let i = 40; i >= 0; i--) {
      const x = -MOUTH_X + (2 * MOUTH_X * i) / 40;
      const p = E(x, lowerLip(x));
      g.lineTo(p[0], p[1]);
    }
    g.closePath();
  };
  g.save();
  mouth();
  g.clip();
  // inside: dark red throat
  const [cx, cy] = E(0, -0.66);
  const grd = g.createRadialGradient(cx, cy, 0.05 * s, cx, cy, 0.8 * s);
  grd.addColorStop(0, '#5c0a16');
  grd.addColorStop(1, '#1d0207');
  g.fillStyle = grd;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  // gums along both lips
  const gum = (fn, dir) => {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = -MOUTH_X - 0.05 + ((2 * MOUTH_X + 0.1) * i) / 40;
      const p = E(x, fn(x));
      if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
    }
    for (let i = 40; i >= 0; i--) {
      const x = -MOUTH_X - 0.05 + ((2 * MOUTH_X + 0.1) * i) / 40;
      const p = E(x, fn(x) + dir * 0.075);
      g.lineTo(p[0], p[1]);
    }
    g.closePath();
    g.fillStyle = '#b8283c';
    g.fill();
  };
  gum(upperLip, -1);
  gum(lowerLip, 1);
  // teeth: pointed, biggest in the middle
  // rounded cones with gum showing between them, a soft grey shade at the root
  const tooth = (x, y, w, len, dir) => {
    const a = E(x - w / 2, y), b = E(x + w / 2, y), tip = E(x, y + dir * len);
    const c1 = E(x - w * 0.5, y + dir * len * 0.75), c2 = E(x + w * 0.5, y + dir * len * 0.75);
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.bezierCurveTo(c1[0], c1[1], E(x - w * 0.12, y + dir * len)[0], tip[1], tip[0], tip[1]);
    g.bezierCurveTo(E(x + w * 0.12, y + dir * len)[0], tip[1], c2[0], c2[1], b[0], b[1]);
    g.closePath();
    const r = E(x, y), q = E(x, y + dir * len);
    const grd = g.createLinearGradient(r[0], r[1], q[0], q[1]);
    grd.addColorStop(0, '#c9c4c6');
    grd.addColorStop(0.35, WHITE);
    grd.addColorStop(1, WHITE);
    g.fillStyle = grd;
    g.fill();
  };
  g.fillStyle = WHITE;
  const nu = 15;
  for (let i = 0; i < nu; i++) {
    const x = -MOUTH_X * 0.94 + (i + 0.5) * (MOUTH_X * 1.88 / nu);
    const big = 1 - 0.45 * Math.pow(Math.abs(x) / MOUTH_X, 1.5);
    tooth(x, upperLip(x) - 0.045, 0.085 * (0.6 + 0.4 * big), 0.2 * big, -1);
  }
  const nl = 13;
  for (let i = 0; i < nl; i++) {
    const x = -MOUTH_X * 0.8 + (i + 0.5) * (MOUTH_X * 1.6 / nl);
    const big = 1 - 0.45 * Math.pow(Math.abs(x) / MOUTH_X, 1.5);
    tooth(x, lowerLip(x) + 0.045, 0.085 * (0.6 + 0.4 * big), 0.17 * big, 1);
  }
  g.restore();
  // black lip edge
  mouth();
  g.strokeStyle = '#040306';
  g.lineWidth = 0.03 * s;
  g.stroke();

  // --- eyes
  for (const side of [-1, 1]) {
    blobPath(g, EYE_PTS.map(([x, y]) => E(x * side, y)));
    g.fillStyle = WHITE;
    g.fill();
  }
}

// ------------------------------------------------------------------ emblem

// Venom spider: legs = stacked chevrons running out over the chest / shoulder blades and
// bending down over the shoulders, a pointed head, a long body stripe with a forked end.
// P(x, y): metres around the emblem centre (y up) -> pixels, k = pixels per metre.
function paintVenomSpider(g, P, k, { legs, legW, head, body }) {
  g.fillStyle = WHITE;
  for (const s of [-1, 1]) {
    for (const [a, c1, m, c2, b] of legs) {
      const S = (p) => P(p[0] * s, p[1]);
      const wm = (legW[0] + legW[1]) / 2;
      taperCurve(g, S(a), S(c1), S(m), legW[0] * k, wm * k);
      taperCurve(g, S(m), S(c2), S(b), wm * k, legW[1] * k);
    }
  }
  // head: a broad arrow pointing up, two little fangs on top
  const { top, w, neck } = head;
  let p;
  g.beginPath();
  p = P(0, top - 0.02); g.moveTo(p[0], p[1]);
  p = P(w * 0.35, top); g.lineTo(p[0], p[1]);
  p = P(w, top - 0.06); g.lineTo(p[0], p[1]);
  p = P(w * 0.8, neck); g.lineTo(p[0], p[1]);
  p = P(-w * 0.8, neck); g.lineTo(p[0], p[1]);
  p = P(-w, top - 0.06); g.lineTo(p[0], p[1]);
  p = P(-w * 0.35, top); g.lineTo(p[0], p[1]);
  g.closePath();
  g.fill();
  // body: wide under the head, a long stripe down, forked end
  const { top: bt, w: bw, waist, bottom } = body;
  g.beginPath();
  p = P(-bw, bt); g.moveTo(p[0], p[1]);
  p = P(bw, bt); g.lineTo(p[0], p[1]);
  let c = P(bw * 0.9, bt - 0.08); p = P(waist, bt - 0.16); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  p = P(waist * 0.9, bottom + 0.05); g.lineTo(p[0], p[1]);
  p = P(waist * 1.1, bottom); g.lineTo(p[0], p[1]);
  p = P(0, bottom + 0.04); g.lineTo(p[0], p[1]);
  p = P(-waist * 1.1, bottom); g.lineTo(p[0], p[1]);
  p = P(-waist * 0.9, bottom + 0.05); g.lineTo(p[0], p[1]);
  p = P(-waist, bt - 0.16); g.lineTo(p[0], p[1]);
  c = P(-bw * 0.9, bt - 0.08); p = P(-bw, bt); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  g.closePath();
  g.fill();
}

// emblem numbers in metres (torso centre x = 0)
const FRONT_SPIDER = {
  legs: [ // [root, ctrl, knee, ctrl, tip]
    [[0.06, 0.06], [0.13, 0.13], [0.2, 0.15], [0.27, 0.15], [0.33, 0.06]],
    [[0.07, 0.02], [0.15, 0.07], [0.22, 0.08], [0.29, 0.08], [0.34, -0.01]],
    [[0.07, -0.02], [0.16, 0.01], [0.23, 0.01], [0.3, 0.0], [0.33, -0.09]],
    [[0.06, -0.06], [0.15, -0.05], [0.22, -0.06], [0.28, -0.08], [0.3, -0.16]],
  ],
  legW: [0.036, 0.022],
  head: { top: 0.2, w: 0.075, neck: 0.1 },
  body: { top: 0.1, w: 0.09, waist: 0.045, bottom: -0.32 },
};
const BACK_SPIDER = {
  legs: [
    [[0.06, 0.08], [0.15, 0.17], [0.24, 0.19], [0.33, 0.19], [0.39, 0.07]],
    [[0.07, 0.035], [0.17, 0.09], [0.26, 0.1], [0.34, 0.1], [0.4, -0.02]],
    [[0.07, -0.01], [0.18, 0.02], [0.27, 0.02], [0.35, 0.01], [0.38, -0.11]],
    [[0.06, -0.055], [0.17, -0.045], [0.25, -0.055], [0.32, -0.08], [0.34, -0.19]],
  ],
  legW: [0.042, 0.026],
  head: { top: 0.21, w: 0.08, neck: 0.115 },
  body: { top: 0.115, w: 0.1, waist: 0.052, bottom: -0.34 },
};

// ------------------------------------------------------------------ builder

function mesh(geo, mat, outline = OUTLINE) {
  const m = new THREE.Mesh(geo, mat);
  if (outline) addOutline(m, outline, OUTLINE_COLOR);
  return m;
}

// muscles: soft bumps pushed out of a lathe after boxify (centre, radius, amount)
function bulge(geo, bumps) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3(), r = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    r.set(v.x, 0, v.z);
    const len = r.length();
    if (len < 1e-6) continue;
    r.divideScalar(len);
    let d = 0;
    for (const [cx, cy, cz, rad, amt] of bumps) {
      const q = ((v.x - cx) ** 2 + (v.y - cy) ** 2 + (v.z - cz) ** 2) / (rad * rad);
      d += amt * Math.exp(-q);
    }
    v.addScaledVector(r, d);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  return geo;
}

function blobGeo(n, sx, sy, sz, seg = 14) {
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    roundCube(v.fromBufferAttribute(p, i), n);
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  smoothNormals(geo);
  return geo;
}

// big hand at the end of the forearm: a palm block + four thick curled fingers and a thumb,
// spread a little and ending in points (all one geometry with the forearm)
function handGeometry(y0) {
  const parts = [];
  const palm = blobGeo(2.8, 0.1, 0.085, 0.075);
  palm.translate(0, y0 - 0.06, -0.01);
  parts.push(palm);
  const tube = new TubeShape(6, 6);
  const fingers = [[-0.07, 0.11, -0.25], [-0.024, 0.13, -0.08], [0.024, 0.13, 0.08], [0.07, 0.11, 0.25], [0.105, 0.08, 0.9]];
  fingers.forEach(([x, len, spread], i) => {
    const thumb = i === 4;
    const pts = [], radii = [];
    for (let j = 0; j < 6; j++) {
      const f = j / 5;
      const a = f * 1.3;
      // down out of the palm, curling forward (-Z), fanning out sideways
      const dy = Math.sin(a) / Math.sin(1.3) * len;
      const dz = (1 - Math.cos(a)) / (1 - Math.cos(1.3)) * len * 0.6;
      pts.push(new THREE.Vector3(
        x + Math.sin(spread) * dy * 0.45 + (thumb ? 0.03 * f : 0),
        y0 - 0.1 - dy * (thumb ? 0.6 : 1),
        -0.02 - dz - (thumb ? 0.05 : 0)
      ));
      radii.push((thumb ? 0.03 : 0.028) * (1 - f * 0.85) + 0.003);
    }
    tube.set(pts, radii, 1.4);
    parts.push(tube.geometry.clone());
  });
  return parts;
}

function bakeHead(headGeo) {
  const W = V.headW, H = V.headH;
  const s = W * 1100;
  const face = flatPicture(-W * 1.08, W * 1.08, -H * 1.08, H * 1.08, 1100, 'front', (g, toPx) => {
    paintVenomFace(g, (X, Y) => toPx(X * W, Y * H), s);
  });
  const base = rgb('#14141b');
  const white = rgb(WHITE);
  const tmp = [0, 0, 0];
  const grid = sphereGrid(headGeo), p = new THREE.Vector3(), d = new THREE.Vector3();
  return bakeTextures(1280, 640, ([col, glow], u, v) => {
    col[0] = base[0]; col[1] = base[1]; col[2] = base[2];
    sphereDir(u, v, d);
    grid.at(u, v, p);
    if (d.z < -0.05) {
      tmp[0] = 0; tmp[1] = 0; tmp[2] = 0;
      const a = face.over(p.x, p.y, tmp);
      if (a > 0) {
        for (let i = 0; i < 3; i++) col[i] = col[i] * (1 - a) + tmp[i];
        const lum = (tmp[0] + tmp[1] + tmp[2]) / (3 * a);
        if (lum > 150) for (let i = 0; i < 3; i++) glow[i] = tmp[i];
      }
    }
    // outside the face (past the eyes' outer edge), the eye tips run round the sides
    if (Math.abs(p.x) > W * 0.86 || d.z >= -0.05) {
      const a = eyeTip(Math.atan2(Math.abs(d.x), -d.z), p.y / H);
      if (a > 0) for (let i = 0; i < 3; i++) { col[i] += (white[i] - col[i]) * a; glow[i] += (white[i] - glow[i]) * a; }
    }
  }, 2);
}

// The white eyes do not stop at the corners of the face (photo 7): their outer tips sweep
// back along the sides of the head and end in points on the back corners, so he reads as
// Venom from behind and from above too. The middle of the back stays plain.
// az: angle round the head from the front (0) to the back (pi), y: height (1 = top).
const TIP_A0 = 0.62, TIP_A1 = 2.86;
// lower / upper edge of the tip (height) at s = 0..1 along it
const TIP_LO = [[0, -0.1], [0.3, 0.22], [0.6, 0.38], [0.86, 0.48], [1, 0.74]];
const TIP_HI = [[0, 0.77], [0.4, 0.88], [0.86, 0.9], [1, 0.8]];
function knots(k, s) {
  let i = 0;
  while (i < k.length - 2 && s > k[i + 1][0]) i++;
  const [s0, y0] = k[i], [s1, y1] = k[i + 1];
  const w = THREE.MathUtils.clamp((s - s0) / (s1 - s0), 0, 1);
  return y0 + (y1 - y0) * (1 - Math.cos(Math.PI * w)) / 2;
}
function eyeTip(az, y) {
  if (az < TIP_A0 || az > TIP_A1 + 0.02) return 0;
  const s = Math.min(1, (az - TIP_A0) / (TIP_A1 - TIP_A0));
  const lo = knots(TIP_LO, s), hi = knots(TIP_HI, s);
  const e = 0.012;
  return THREE.MathUtils.smoothstep(y, lo - e, lo + e) * (1 - THREE.MathUtils.smoothstep(y, hi - e, hi + e)) *
    (1 - THREE.MathUtils.smoothstep(az, TIP_A1 - 0.01, TIP_A1 + 0.02));
}

function bakeTorso(torsoGeo) {
  const k = 700;
  const draw = (sp, cy) => (g, P) => paintVenomSpider(g, (x, y) => P(x, y + cy), k, sp);
  const front = flatPicture(-0.42, 0.42, -0.15, 0.72, k, 'front', draw(FRONT_SPIDER, 0.37));
  const back = flatPicture(-0.42, 0.42, -0.15, 0.72, k, 'back', draw(BACK_SPIDER, 0.41));
  const base = rgb('#14141b');
  const grid = latheGrid(torsoGeo), p = new THREE.Vector3();
  return bakeTextures(512, 256, ([col], u, v) => {
    col[0] = base[0]; col[1] = base[1]; col[2] = base[2];
    grid.at(u, v, p);
    (p.z < 0 ? front : back).over(p.x, p.y, col);
  })[0];
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

  // --- torso: wide muscular chest and back, narrower waist, its top hidden inside the head
  const torsoGeo = smoothLathe([
    [0, -0.12], [0.17, -0.105], [0.25, -0.04], [0.262, 0.05], [0.252, 0.13], [0.29, 0.25],
    [0.345, 0.37], [0.36, 0.46], [0.32, 0.54], [0.21, 0.6], [0.08, 0.63], [0, 0.635],
  ], { segments: 24, samples: 22, scaleZ: 0.74 });
  boxify(torsoGeo, 3.0);
  bulge(torsoGeo, [
    [0.14, 0.37, -0.23, 0.12, 0.035], [-0.14, 0.37, -0.23, 0.12, 0.035], // pecs
    [0.21, 0.53, 0.12, 0.13, 0.05], [-0.21, 0.53, 0.12, 0.13, 0.05],     // traps
    [0.27, 0.27, 0.12, 0.13, 0.035], [-0.27, 0.27, 0.12, 0.13, 0.035],   // lats
    [0.07, 0.18, -0.21, 0.06, 0.012], [-0.07, 0.18, -0.21, 0.06, 0.012], // abs
    [0.07, 0.08, -0.21, 0.06, 0.012], [-0.07, 0.08, -0.21, 0.06, 0.012],
    [0, 0.33, 0.23, 0.05, -0.018],                                        // spine groove
  ]);
  smoothNormals(torsoGeo);
  const torsoTex = bakeTorso(torsoGeo);
  const torsoMat = toonMaterial(0xffffff, { map: torsoTex, emissive: 0x3a3a3a, emissiveMap: torsoTex, ...GLOSS });
  spine.add(mesh(torsoGeo, torsoMat));

  // --- head (face baked into its texture) and tongue
  const neck = new THREE.Group();
  neck.position.set(0, V.neckY, V.neckZ);
  spine.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  const headGeo = new THREE.SphereGeometry(1, 44, 30);
  {
    const p = headGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      deformHead(v.fromBufferAttribute(p, i));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    smoothNormals(headGeo);
  }
  const [faceMap, glowMap] = bakeHead(headGeo);
  const headMat = toonMaterial(0xffffff, { map: faceMap, emissive: 0x9a9a9a, emissiveMap: glowMap, ...GLOSS });
  const headMesh = mesh(headGeo, headMat, OUTLINE * 1.1);
  headMesh.position.y = V.headH;
  head.add(headMesh);
  // remember the camera that draws him: while catching, he turns his face to it
  const camPos = new THREE.Vector3();
  let haveCam = false;
  headMesh.onBeforeRender = (r, s, cam) => {
    camPos.setFromMatrixPosition(cam.matrixWorld);
    haveCam = true;
  };
  const look = { x: 0, y: 0, w: 0 };
  const lookDir = new THREE.Vector3();

  const tongue = new TubeShape(14, 8);
  const tongueMesh = new THREE.Mesh(tongue.geometry, toonMaterial(0xd2404e, {
    shade: 'soft',
    gloss: { color: 0xffd6dc, threshold: 0.94, strength: 0.8, soft: 0.02 },
  }));
  tongueMesh.frustumCulled = false;
  addOutline(tongueMesh, 0.014, OUTLINE_COLOR);
  // root inside the grin, low and a little to the side the tongue hangs out of
  tongueMesh.position.set(0.06, V.headH * 0.3, -V.headD + 0.1);
  head.add(tongueMesh);
  const tonguePts = Array.from({ length: 14 }, () => new THREE.Vector3());
  const tongueR = Array.from({ length: 14 }, (_, i) => 0.066 - i * 0.0019);
  const tongueTmp = new THREE.Vector3();
  const flickTmp = new THREE.Vector3();
  // every 1-2 s a quick whip of the tongue out past the side of the head (seen from behind)
  const flick = { wait: 1.2, u: 1, side: 1 };

  // --- arms: deltoid + bulging biceps, forearm with a big clawed hand (one mesh each)
  const upperGeo = smoothLathe([
    [0, -V.upperLen - 0.04], [0.1, -V.upperLen - 0.02], [0.115, -V.upperLen + 0.04], [0.14, -0.14],
    [0.13, -0.07], [0.155, 0.0], [0.16, 0.05], [0.12, 0.11], [0, 0.135],
  ], { segments: 14, samples: 16 });
  smoothNormals(upperGeo);
  const foreLathe = smoothLathe([
    [0, -0.24], [0.09, -0.23], [0.1, -0.19], [0.14, -0.1], [0.135, -0.03], [0.11, 0.02], [0.06, 0.05], [0, 0.06],
  ], { segments: 14, samples: 14 });
  const foreGeo = mergeGeos([foreLathe, ...handGeometry(-0.2)]);
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * V.shoulderX, V.shoulderY, 0);
    shoulder.add(mesh(upperGeo, black));
    const elbow = new THREE.Group();
    elbow.position.y = -V.upperLen;
    elbow.add(mesh(foreGeo, black));
    shoulder.add(elbow);
    spine.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = arm(-1);
  const armR = arm(1);

  // --- legs: short and thick, bulging calves, big feet
  const thighGeo = smoothLathe([
    [0, -0.27], [0.12, -0.255], [0.14, -0.19], [0.165, -0.1], [0.17, -0.02], [0.13, 0.06], [0, 0.09],
  ], { segments: 14, samples: 12 });
  smoothNormals(thighGeo);
  const kneeY = V.hipY - V.thighLen;
  const shinLathe = smoothLathe([
    [0, -kneeY + 0.06], [0.1, -kneeY + 0.075], [0.11, -0.17], [0.14, -0.09], [0.135, -0.02], [0.1, 0.05], [0, 0.07],
  ], { segments: 14, samples: 12 });
  const foot = blobGeo(2.6, 0.13, 0.075, 0.185);
  foot.translate(0, -kneeY + 0.075, -0.06);
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
    armLX: 0, armLY: 0, armLZ: -0.35, elbowL: 0.3,
    armRX: 0, armRY: 0, armRZ: 0.35, elbowR: 0.3,
    legLX: 0, legLZ: -0.1, legRX: 0, legRZ: 0.1, kneeL: 0, kneeR: 0,
    tongueOut: 0.4, tongueWiggle: 1, tongueSwing: 0, tongueFlick: 0,
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
    // catch cam: face the camera (it films from ahead and to the side), so the grin shows
    let lw = 0;
    if (state === 'catch' && haveCam) {
      neck.worldToLocal(lookDir.copy(camPos));
      lookDir.y -= V.headH;
      lookDir.normalize();
      lw = THREE.MathUtils.smoothstep(-lookDir.z, -0.1, 0.35); // only once the camera is in front
      look.y = THREE.MathUtils.clamp(Math.atan2(-lookDir.x, -lookDir.z), -0.9, 0.9);
      look.x = THREE.MathUtils.clamp(Math.atan2(lookDir.y, Math.hypot(lookDir.x, lookDir.z)), -0.1, 0.45);
    }
    look.w += (lw - look.w) * Math.min(1, dt * 8);
    head.rotation.set(
      THREE.MathUtils.lerp(p.headRX * HEAD_NOD, look.x, look.w),
      THREE.MathUtils.lerp(p.headRY, look.y, look.w),
      p.headRZ * HEAD_NOD * (1 - look.w)
    );
    armL.shoulder.rotation.set(p.armLX, p.armLY, p.armLZ);
    armR.shoulder.rotation.set(p.armRX, p.armRY, p.armRZ);
    armL.elbow.rotation.x = p.elbowL;
    armR.elbow.rotation.x = p.elbowR;
    legL.hip.rotation.set(p.legLX, 0, p.legLZ);
    legR.hip.rotation.set(p.legRX, 0, p.legRZ);
    legL.knee.rotation.x = p.kneeL;
    legR.knee.rotation.x = p.kneeR;

    // tongue (photo 7): out over the lower teeth, hanging down over the chin and curling
    // off to his left (+X) with the tip turned up; longer when reaching / catching,
    // flapping while running
    const reach = 0.5 + 0.5 * p.tongueOut;  // how much of the full curve is out
    const wig = p.tongueWiggle;
    const sw = p.tongueSwing * Math.sin(t * 3.4);
    flick.wait -= dt;
    if (flick.wait <= 0) {
      flick.wait = 1 + Math.random();
      flick.u = 0;
      flick.side = Math.random() < 0.7 ? 1 : -1;  // mostly his left, where it hangs
    }
    flick.u = Math.min(1, flick.u + dt / 0.36);
    const fl = p.tongueFlick * Math.pow(Math.sin(Math.PI * flick.u), 0.6);
    for (let i = 0; i < 14; i++) {
      const f = i / 13;
      TONGUE_PATH.getPoint(f * reach, tongueTmp);
      const ff = f * f;
      tonguePts[i].set(
        tongueTmp.x + sw * 0.3 * ff + Math.sin(t * 7 * wig - f * 5) * 0.045 * ff,
        tongueTmp.y + Math.sin(t * 9 * wig - f * 4) * 0.03 * ff - Math.abs(sw) * 0.05 * ff,
        tongueTmp.z - Math.abs(sw) * 0.08 * ff
      );
      if (fl > 0) {
        TONGUE_WHIP.getPoint(f, flickTmp);
        flickTmp.x = flickTmp.x * flick.side + Math.sin(t * 30 - f * 6) * 0.05 * ff;
        tonguePts[i].lerp(flickTmp, fl);
      }
    }
    tongue.set(tonguePts, tongueR, 0.9);
  }

  update(0);
  return { root, setState, update };
}

// the full tongue, from its root inside the mouth (head space, metres)
const TONGUE_PATH = new THREE.CatmullRomCurve3([
  [0, 0, 0], [0, -0.01, -0.1], [0.03, -0.08, -0.17], [0.07, -0.2, -0.17], [0.13, -0.31, -0.14],
  [0.22, -0.38, -0.11], [0.33, -0.4, -0.08], [0.43, -0.36, -0.07], [0.49, -0.28, -0.08], [0.48, -0.2, -0.1],
].map((a) => new THREE.Vector3(...a)), false, 'centripetal');

// the whip: out of the mouth, round the side of the head and back past its silhouette
const TONGUE_WHIP = new THREE.CatmullRomCurve3([
  [0, 0, 0], [0.05, -0.05, -0.12], [0.3, -0.12, -0.16], [0.62, -0.06, -0.05], [0.86, 0.08, 0.18],
  [0.98, 0.24, 0.42], [1.02, 0.42, 0.66],
].map((a) => new THREE.Vector3(...a)), false, 'centripetal');

function venomPose(state, P, t, st, phase) {
  const s = Math.sin(phase), c = Math.cos(phase);
  // the legs keep running in every state
  P.pelvisY = 0.06 * Math.abs(c) - 0.03;
  P.pelvisRX = -0.08;
  P.pelvisRY = -0.12 * s;
  P.pelvisRZ = 0.08 * s;
  P.legLX = 0.7 * s;
  P.legRX = -0.7 * s;
  P.kneeL = -0.25 - 1.05 * Math.max(0, c);
  P.kneeR = -0.25 - 1.05 * Math.max(0, -c);
  P.legLZ = -0.14;
  P.legRZ = 0.14;
  switch (state) {
    case 'reach': { // right claw stretched forward, tongue out
      const w = Math.sin(t * 8) * 0.08;
      P.spineRX = -0.4;
      P.spineRY = 0.3 + 0.08 * s;
      P.spineRZ = -0.05 * s;
      P.headRX = 0.35;
      P.headRY = -0.3;
      P.headRZ = 0.05 * s;
      P.armRX = 1.55 + w;
      P.armRZ = 0.25;
      P.armRY = -0.15;
      P.elbowR = 0.1 - w;
      P.armLX = -0.6 * s + 0.1;
      P.armLZ = -0.7;
      P.armLY = 0.3;
      P.elbowL = 0.7 + 0.25 * s;
      P.tongueOut = 1;
      P.tongueWiggle = 1.6;
      P.tongueSwing = 0.35;
      P.tongueFlick = 1;
      break;
    }
    case 'roar': { // intro: planted wide, arms flung out, chest out, head back, tongue out, shuddering
      const sh = Math.sin(t * 46) * 0.025;
      const rise = Math.min(1, st / 0.25);        // rears up into it
      P.pelvisY = -0.05 + sh * 0.5;
      P.pelvisRX = 0.06;
      P.pelvisRY = 0;
      P.pelvisRZ = sh;
      P.legLX = 0.12;
      P.legRX = -0.08;
      P.kneeL = -0.35;
      P.kneeR = -0.3;
      P.legLZ = -0.3;
      P.legRZ = 0.3;
      P.spineRX = 0.28 * rise + sh;
      P.spineRY = 0;
      P.spineRZ = sh;
      P.headRX = 1.1 * rise;
      P.headRY = 0;
      P.headRZ = sh * 3;
      P.armLX = 0.3;
      P.armRX = 0.3;
      P.armLZ = -1.5 + sh;
      P.armRZ = 1.5 - sh;
      P.armLY = -0.25;
      P.armRY = 0.25;
      P.elbowL = 0.75;
      P.elbowR = 0.75;
      P.tongueOut = 1;
      P.tongueWiggle = 2.4;
      P.tongueSwing = 0.6;
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
      P.spineRX = -0.25;
      P.headRX = 0.55;
      P.armLX = 1.3 + snap;
      P.armRX = 1.3 + snap;
      P.armLZ = -1.0 + 1.15 * k;
      P.armRZ = 1.0 - 1.15 * k;
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
    default: { // lumbering, hunched, arms swinging wide so the claws show from behind
      P.spineRX = -0.45;
      P.spineRY = 0.25 * s;
      P.spineRZ = -0.08 * s;
      P.headRX = 0.4;
      P.headRY = -0.14 * s;
      P.headRZ = 0.07 * s;
      P.armLX = -0.8 * s + 0.25;
      P.armRX = 0.8 * s + 0.25;
      P.armLZ = -0.85 - 0.15 * c;
      P.armRZ = 0.85 + 0.15 * c;
      P.armLY = 0.35;
      P.armRY = -0.35;
      P.elbowL = 0.85 + 0.35 * s;
      P.elbowR = 0.85 - 0.35 * s;
      P.tongueSwing = 1;
      P.tongueOut = 0.6;
      P.tongueWiggle = 1;
      P.tongueFlick = 1;
      break;
    }
  }
}
