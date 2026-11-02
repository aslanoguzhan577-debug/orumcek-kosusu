// hulk.js — the Hulk as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter), same height and hitbox. Green skin with soft darker muscle shading,
// shaggy black hair covering the top and back of the head (painted + sculpted tufts merged into
// the head), a heavy angry brow, small fierce eyes and a gritted-teeth snarl. Hulk bulk: wide
// torso with trapezius humps (merged into the torso), thick arms and legs, broad shoulders,
// torn purple shorts, bare green feet.
//   createHulk() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { createSpiderCharacter, SATIN, TORSO } from './spiderman.js';
import { attach, poly, ellipse, line, fill, ball, xf } from './heroKit.js';

const GREEN = '#69b13d';
const GREEN_DK = '#3f7f25';
const GREEN_SH = 'rgba(40, 92, 22, 0.55)';
const HAIR = '#1b2418';
const PURPLE = '#6d3fa3';
const PURPLE_DK = '#47286f';
const INK = '#14110f';
const T = TORSO;
const smooth = THREE.MathUtils.smoothstep;

// ragged hem: zigzag from x0 to x1 around y
const zig = (x0, x1, y, n, amp) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y + (i % 2 ? -amp : amp)]);

// soft muscle shadow: stacked translucent strokes (a canvas blur filter costs ~100 ms per skin)
function shade(g, P, pts, w) {
  g.save();
  g.globalAlpha = 0.4;
  for (const f of [1.7, 1.2, 0.75]) line(g, P, pts, GREEN_SH, w * f);
  g.restore();
}

function muscles(g, P, k, front) {
  if (front) {
    for (const s of [-1, 1]) {
      shade(g, P, [[s * 0.015, 0.3], [s * 0.1, 0.27], [s * 0.2, 0.31]], 0.022 * k);  // under the pecs
      shade(g, P, [[s * 0.2, 0.42], [s * 0.21, 0.32]], 0.018 * k);                   // pec / shoulder
      for (const y of [0.225, 0.17]) shade(g, P, [[s * 0.012, y], [s * 0.085, y - 0.004]], 0.014 * k);
      shade(g, P, [[s * 0.13, 0.24], [s * 0.115, 0.12]], 0.016 * k);                 // obliques
    }
    shade(g, P, [[0, 0.42], [0, 0.12]], 0.014 * k);
  } else {
    shade(g, P, [[0, 0.46], [0, 0.11]], 0.016 * k);
    for (const s of [-1, 1]) {
      shade(g, P, [[s * 0.03, 0.4], [s * 0.13, 0.3], [s * 0.22, 0.34]], 0.022 * k); // shoulder blades
      shade(g, P, [[s * 0.03, 0.24], [s * 0.16, 0.17]], 0.018 * k);                 // lats
    }
  }
  // torn purple shorts
  poly(g, P, [[-0.34, 0.075], ...zig(-0.34, 0.34, 0.075, 12, 0.01), [0.34, -0.2], [-0.34, -0.2]], PURPLE);
  poly(g, P, [[-0.34, 0.08], [0.34, 0.08], [0.34, 0.052], [-0.34, 0.052]], PURPLE_DK);
}

const HAIR_RGB = [0x1b, 0x24, 0x18];
const HULK_LOOK = {
  head: { color: GREEN },
  // shaggy hair over the top and the back of the head, ragged edge over the neck / ears
  headPaint(col, glow, d) {
    const ang = Math.atan2(d.x, d.z);
    const edge = -0.42 + 0.07 * Math.sin(ang * 11) + 0.04 * Math.sin(ang * 23 + 1) + 0.5 * smooth(-d.z, 0.0, 0.5);
    const a = smooth(d.y, edge - 0.015, edge + 0.015);
    if (a > 0) for (let i = 0; i < 3; i++) col[i] += (HAIR_RGB[i] - col[i]) * a;
  },
  face(g, E) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // hair fringe over the forehead
    poly(g, E, [[-1.1, 1.2], [-1.1, 0.5], ...zig(-1.0, 1.0, 0.6, 14, 0.1), [1.1, 0.5], [1.1, 1.2]], HAIR);
    // heavy brow ridge: two thick dark-green wedges sloping down to the nose
    for (const s of [-1, 1]) poly(g, (x, y) => E(x * s, y), [[0.08, 0.14], [0.74, 0.4], [0.76, 0.28], [0.1, 0.04]], GREEN_DK);
    // small fierce eyes
    for (const s of [-1, 1]) {
      poly(g, (x, y) => E(x * s, y), [[0.18, 0.02], [0.56, 0.12], [0.54, -0.04], [0.24, -0.08]], '#ffffff');
      ellipse(g, E, s * 0.38, 0.01, 0.065, 0.065, INK);
    }
    // nose
    for (const s of [-1, 1]) ellipse(g, E, s * 0.09, -0.24, 0.035, 0.025, GREEN_DK);
    line(g, E, [[-0.13, -0.17], [0, -0.13], [0.13, -0.17]], GREEN_DK, 8);
    // snarl: dark mouth with gritted upper and lower teeth
    poly(g, E, [[-0.52, -0.42], [0.52, -0.42], [0.46, -0.78], [-0.46, -0.78]], '#3a0d0d', INK, 10);
    poly(g, E, [[-0.48, -0.45], [0.48, -0.45], [0.47, -0.56], [-0.47, -0.56]], '#fbfbf2');
    poly(g, E, [[-0.44, -0.66], [0.44, -0.66], [0.43, -0.75], [-0.43, -0.75]], '#fbfbf2');
    for (let i = -4; i <= 4; i++) {
      line(g, E, [[i * 0.105, -0.45], [i * 0.105, -0.56]], '#8b8a7a', 4, 'butt');
      line(g, E, [[i * 0.1, -0.66], [i * 0.1, -0.75]], '#8b8a7a', 4, 'butt');
    }
    // cheek / jaw creases
    for (const s of [-1, 1]) line(g, (x, y) => E(x * s, y), [[0.58, -0.22], [0.64, -0.5], [0.58, -0.8]], GREEN_DK, 9);
  },
  lensGlow: 0x000000,
  torsoBase: GREEN,
  torsoFront(g, P, k) { muscles(g, P, k, true); },
  torsoBack(g, P, k) { muscles(g, P, k, false); },
  arm(g, W, H, info) {
    fill(g, W, H, GREEN);
    g.save();
    g.globalAlpha = 0.5;
    fill(g, W, H, GREEN_SH, info.yToPx(-0.095), info.yToPx(-0.125)); // bicep shadow
    fill(g, W, H, GREEN_SH, info.yToPx(-0.1), info.yToPx(-0.12));
    g.restore();
  },
  fore(g, W, H) { fill(g, W, H, GREEN); },
  thigh(g, W, H, info) {
    fill(g, W, H, GREEN);
    // shorts leg, torn hem
    const y = info.yToPx(-0.1), n = 10;
    g.beginPath();
    g.moveTo(0, 0);
    for (let i = 0; i <= n; i++) g.lineTo((W * i) / n, y + (i % 2 ? -1 : 1) * 0.02 * info.ky);
    g.lineTo(W, 0);
    g.closePath();
    g.fillStyle = PURPLE;
    g.fill();
  },
  shin(g, W, H) { fill(g, W, H, GREEN); },
  matOpts: { head: { ...SATIN } },
  lazy: true,
};

function addExtras(parts) {
  // hair: shaggy flattened clumps swept back over the top (the back of the head is painted)
  const tufts = [];
  const clumps = [ // x, y, z, lean back (rad), lean out (rad), size
    [-0.27, 0.31, -0.2, 0.9, -0.5, 1], [-0.09, 0.34, -0.22, 0.95, -0.15, 1.1], [0.09, 0.34, -0.22, 0.95, 0.15, 1.1], [0.27, 0.31, -0.2, 0.9, 0.5, 1],
    [-0.2, 0.35, 0.02, 1.25, -0.35, 1.15], [0.0, 0.36, 0.04, 1.3, 0, 1.2], [0.2, 0.35, 0.02, 1.25, 0.35, 1.15],
    [-0.28, 0.3, 0.2, 1.55, -0.55, 0.9], [0.0, 0.33, 0.22, 1.6, 0, 1], [0.28, 0.3, 0.2, 1.55, 0.55, 0.9],
  ];
  for (const [x, y, z, back, out, k] of clumps) {
    const c = new THREE.ConeGeometry(0.1 * k, 0.17 * k, 9, 2);
    c.translate(0, 0.06 * k, 0);
    xf(c, [x, y, z], [back, 0, -out], [1, 1, 0.45]);
    tufts.push({ geo: c, color: HAIR });
  }
  attach(parts.headMesh, tufts);

  // trapezius humps between the neck and the shoulders
  const traps = [-1, 1].map((s) => ({ geo: xf(ball(16, 10), [s * 0.12, 0.38, 0.03], [0, 0, s * 0.5], [0.13, 0.08, 0.12]), color: GREEN }));
  attach(parts.torso, traps, 'top');

  // bulk: wider torso, thicker arms and legs (not taller: total height stays the same)
  parts.torso.scale.set(1.3, 1, 1.18);
  for (const a of [parts.shoulderL, parts.shoulderR]) a.scale.set(1.45, 1.08, 1.45);
  for (const l of [parts.legL.hip, parts.legR.hip]) l.scale.set(1.2, 1, 1.2);
}

export function createHulk() {
  let P;
  const m = createSpiderCharacter(HULK_LOOK, {
    build: (parts) => { P = parts; addExtras(parts); },
    apply() { P.shoulderR.position.x += 0.05; P.shoulderL.position.x -= 0.05; }, // wider shoulders
  });
  m.root.name = 'hulk';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
