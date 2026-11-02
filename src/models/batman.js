// batman.js — Batman as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter). Blue-black cowl with tall pointed ears, stern white eye slits, the
// cowl cut down over the cheeks to a skin jaw with a frown; grey suit, black bat in a yellow
// oval, yellow utility belt with pouches, black gloves with three fins, black boots, and a long
// scalloped cape. Ears, cape and fins are merged into the head / torso / forearm meshes (no
// extra draw calls); the cape sways with the run and folds up in slides and rolls.
//   createBatman() -> { root, setState, update, setSpeed, hand }
// skillBatman.js hides "the default cape" by looking for a 4 x 8 plane mesh: a stand-in with
// that signature (never rendered) folds the merged cape away when it is hidden.

import * as THREE from 'three';
import { createSpiderCharacter, SATIN, TORSO } from './spiderman.js';
import { attach, poly, ellipse, line, fill, xf } from './heroKit.js';

const COWL = '#1c2030';
const GREY = '#5c6070';
const GREY_DK = '#454856';
const YELLOW = '#f4c922';
const YELLOW_DK = '#c99a0e';
const SKIN = '#f1c7a0';
const INK = '#0d0e14';
const T = TORSO;

// dark vinyl with a cool rim so the black parts keep their silhouette on a dark street
const DARK = { ...SATIN, rim: { color: 0xa9bcff, threshold: 0.66, strength: 0.22, soft: 0.12 },
  gloss: { color: 0xffffff, threshold: 0.982, strength: 0.4, soft: 0.01 } };

const BAT = [[-0.09, 0.016], [-0.062, 0.036], [-0.026, 0.026], [-0.016, 0.046], [-0.006, 0.034], [0.006, 0.034], [0.016, 0.046], [0.026, 0.026],
  [0.062, 0.036], [0.09, 0.016], [0.07, 0.006], [0.055, -0.012], [0.035, -0.004], [0.018, -0.02], [0, -0.03], [-0.018, -0.02], [-0.035, -0.004], [-0.055, -0.012], [-0.07, 0.006]];

function belt(g, P, k, front) {
  poly(g, P, [[-0.32, T.beltLo], [0.32, T.beltLo], [0.32, T.beltHi], [-0.32, T.beltHi]], YELLOW, YELLOW_DK, 0.004 * k);
  const pouches = front ? [-0.2, -0.13, 0.13, 0.2] : [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2];
  for (const x of pouches) {
    poly(g, P, [[x - 0.028, T.beltLo + 0.004], [x + 0.028, T.beltLo + 0.004], [x + 0.028, T.beltHi + 0.008], [x - 0.028, T.beltHi + 0.008]], YELLOW, YELLOW_DK, 0.004 * k);
  }
  if (front) {
    poly(g, P, [[-0.045, T.beltLo + 0.002], [0.045, T.beltLo + 0.002], [0.045, T.beltHi + 0.004], [-0.045, T.beltHi + 0.004]], '#e5b51a', '#8d6a06', 0.005 * k);
  }
}

const BAT_LOOK = {
  head: { color: COWL },
  face(g, E) {
    // skin jaw: the cowl comes down over the nose and the cheeks
    poly(g, E, [[-0.62, -0.3], [-0.42, -0.24], [-0.2, -0.17], [0, -0.22], [0.2, -0.17], [0.42, -0.24], [0.62, -0.3],
      [0.66, -1.2], [-0.66, -1.2]], SKIN);
    line(g, E, [[-0.62, -0.3], [-0.42, -0.24], [-0.2, -0.17], [0, -0.22], [0.2, -0.17], [0.42, -0.24], [0.62, -0.3]], '#0a0b10', 8);
    // frown
    g.strokeStyle = '#8a5a44';
    g.lineWidth = 9;
    g.lineCap = 'round';
    const a = E(-0.17, -0.6), c = E(0, -0.54), b = E(0.17, -0.6);
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1], b[0], b[1]); g.stroke();
    // stern white eye slits with a dark edge
    for (const s of [-1, 1]) {
      poly(g, (x, y) => E(x * s, y), [[0.12, 0.08], [0.66, 0.24], [0.62, 0.06], [0.16, -0.04]], '#ffffff', '#05060a', 9);
    }
    // brow ridge lines on the cowl
    for (const s of [-1, 1]) line(g, (x, y) => E(x * s, y), [[0.08, 0.2], [0.42, 0.34], [0.72, 0.4]], '#2f3550', 10);
  },
  lensGlow: 0x000000,
  torsoBase: GREY,
  torsoFront(g, P, k) {
    belt(g, P, k, true);
    ellipse(g, P, 0, 0.31, 0.12, 0.068, YELLOW, INK, 0.007 * k);
    poly(g, P, BAT.map(([x, y]) => [x * 1.15, y * 1.15 + 0.31]), INK);
  },
  torsoBack(g, P, k) { belt(g, P, k, false); },
  arm(g, W, H) { fill(g, W, H, GREY); },
  fore(g, W, H, info) {
    fill(g, W, H, GREY);
    fill(g, W, H, INK, info.yToPx(-0.02), H);
  },
  thigh(g, W, H) { fill(g, W, H, GREY); },
  shin(g, W, H, info) {
    fill(g, W, H, GREY);
    fill(g, W, H, INK, info.yToPx(-0.06), H);
  },
  // torso (suit + merged cape): almost no sheen, it greys a broad black cape out
  matOpts: { head: DARK, torso: { sheen: { color: 0xffffff, threshold: 0.8, strength: 0.025, soft: 0.2 } } },
  lazy: true,
};

// ---------------------------------------------------------------- cape
// A closed slab (box grid) reshaped every frame: u -1..1 across, t 0..1 down, s -1..1 through.
const CAPE = { cols: 8, rows: 10, top: 0.44, len: 0.64, z: 0.15, w0: 0.21, w1: 0.32, thick: 0.014 };

function capeBase() {
  const geo = new THREE.BoxGeometry(1, 1, 1, CAPE.cols, CAPE.rows, 1);
  const p = geo.attributes.position;
  const base = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    base[i * 3] = p.getX(i) * 2;          // u
    base[i * 3 + 1] = 0.5 - p.getY(i);    // t
    base[i * 3 + 2] = p.getZ(i) * 2;      // s
  }
  return { geo, base };
}

// shape of the cape: len (0..1) shortens it, out = how far the hem swings back, ph = run phase
function capePoint(u, t0, s, len, out, ph, o) {
  // scalloped hem: three bites out of the bottom edge
  const hem = 1 - 0.09 * Math.abs(Math.sin(((u + 1) / 2) * Math.PI * 3));
  const t = t0 * hem;
  const w = CAPE.w0 + (CAPE.w1 - CAPE.w0) * t;
  const wave = Math.sin(ph * 0.5 - t * 3.2);
  o[0] = u * w + t * t * 0.025 * Math.sin(ph * 0.25 + t * 2);
  o[1] = CAPE.top - t * CAPE.len * len;
  // wraps round the shoulders at the top, flatter lower down; swings back with the run
  o[2] = CAPE.z - (1 - t) * (1 - t) * 0.17 * u * u + t * out * (1 + 0.45 * wave) + t * t * 0.03 + s * CAPE.thick * 0.5;
}

// writes positions (and normals, when nor is given) of the cape's vertices from `offset` on
const _p = [0, 0, 0], _a = [0, 0, 0], _b = [0, 0, 0];
function capeShape(arr, offset, base, len, out, ph, nor) {
  for (let i = 0, n = base.length / 3; i < n; i++) {
    const u = base[i * 3], t0 = base[i * 3 + 1], s = base[i * 3 + 2];
    capePoint(u, t0, s, len, out, ph, _p);
    const k = (offset + i) * 3;
    arr[k] = _p[0]; arr[k + 1] = _p[1]; arr[k + 2] = _p[2];
    if (!nor) continue;
    // normal from the surface tangents across (u) and down (t), facing the side s is on
    capePoint(u + 0.02, t0, s, len, out, ph, _a);
    capePoint(u, t0 + 0.02, s, len, out, ph, _b);
    const ax = _a[0] - _p[0], ay = _a[1] - _p[1], az = _a[2] - _p[2];
    const bx = _b[0] - _p[0], by = _b[1] - _p[1], bz = _b[2] - _p[2];
    let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax; // b x a
    const l = Math.hypot(nx, ny, nz) * (s < 0 ? -1 : 1) || 1;
    nor[k] = nx / l; nor[k + 1] = ny / l; nor[k + 2] = nz / l;
  }
}

function addExtras(parts, st) {
  // tall pointed ears, flattened front to back, sunk into the top corners of the cowl
  const ears = [-1, 1].map((s) => {
    const c = new THREE.ConeGeometry(0.095, 0.2, 14, 3);
    c.translate(0, 0.1, 0);
    return { geo: xf(c, [s * 0.235, 0.29, 0.02], [0, 0, -s * 0.06], [1, 1, 0.55]), color: COWL };
  });
  attach(parts.headMesh, ears);

  // cape, merged into the torso
  const { geo, base } = capeBase();
  capeShape(geo.attributes.position.array, 0, base, 1, 0.04, 0);
  const [range] = attach(parts.torso, [{ geo, color: '#0f111a' }], 'top');
  st.base = base;
  st.start = range.start;
  st.pos = parts.torso.geometry.attributes.position;
  st.pos.setUsage(THREE.DynamicDrawUsage);
  st.nor = parts.torso.geometry.attributes.normal;
  st.nor.setUsage(THREE.DynamicDrawUsage);
  // stand-in the Batman skill hides while its own cape is out (see the header)
  const stand = new THREE.Mesh(new THREE.BufferGeometry(), parts.torso.material);
  stand.geometry.parameters = { widthSegments: 4, heightSegments: 8 };
  stand.layers.set(31);
  let on = true;
  Object.defineProperty(stand, 'visible', { get: () => on, set: (v) => { on = !!v; st.on = on; } });
  parts.spine.add(stand);

  // three fins on the outside of each glove (forearm mesh, UV on the black glove)
  for (const [a, s] of [[parts.armL, -1], [parts.armR, 1]]) {
    const fins = [0, 1, 2].map((i) => {
      const c = new THREE.ConeGeometry(0.016, 0.06, 4);
      c.translate(0, 0.03, 0);
      return { geo: xf(c, [s * 0.05, -0.035 - i * 0.026, 0.0], [0, 0, -s * 1.15], [1, 1, 0.45]), uv: [0.5, 0.015] };
    });
    attach(a.elbow.children[0], fins);
  }
}

export function createBatman() {
  const st = { len: 1, on: true };
  const m = createSpiderCharacter(BAT_LOOK, {
    build: (parts) => addExtras(parts, st),
    apply(pose, ctx, state) {
      const tuck = state === 'slide' || state === 'roll';
      st.len += ((tuck ? 0.45 : 1) - st.len) * Math.min(1, ctx.dt * 14);
      const f = THREE.MathUtils.clamp((ctx.speed - 11) / 17, 0, 1);
      const air = state === 'jump' || state === 'web' || state === 'fall' ? 1.6 : 1;
      const out = (0.05 + 0.07 * f) * (tuck ? 0.3 : air);
      const arr = st.pos.array;
      if (st.on) capeShape(arr, st.start, st.base, st.len, out, ctx.phase, st.nor.array);
      else for (let i = st.start * 3, e = (st.start + st.base.length / 3) * 3; i < e; i += 3) { arr[i] = 0; arr[i + 1] = 0.2; arr[i + 2] = 0; }
      st.pos.needsUpdate = true;
      st.nor.needsUpdate = true;
    },
  });
  m.root.name = 'batman';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
