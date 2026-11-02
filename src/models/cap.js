// cap.js — Captain America (classic) as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter). Blue helmet with a big white "A" on the forehead and white feathered
// wings on both sides, skin face with Funko black eyes and determined brows. Blue chain-mail
// suit, white star on the chest over red / white vertical stripes, brown belt, red gloves and
// boots with flared cuffs. Back: the round shield (red / white rings, blue centre, white star)
// slung on the back — the instant read from the game camera. All sculpted parts are merged into
// the torso / forearm / shin meshes (no extra draw calls).
//   createCap() -> { root, setState, update, setSpeed, hand }
// The back shield answers to getObjectByName('capArmShield').visible (hero-specials hides it
// while the shield is surfed on).

import * as THREE from 'three';
import { flatPicture } from './toon.js';
import { createSpiderCharacter, TORSO } from './spiderman.js';
import { attach, rangeToggle, poly, ellipse, starPts, fill, xf } from './heroKit.js';

const BLUE = '#2a5bc4';
const BLUE_DK = '#1b3f8f';
const MAIL = '#2251b3';
const RED = '#c8202f';
const WHITE = '#f4f4f6';
const BROWN = '#6a4222';
const SKIN = '#f2c6a0';
const INK = '#16121a';
const T = TORSO;

// little overlapping scale arcs (chain mail), in pixels
function mail(g, x0, y0, x1, y1, step) {
  g.strokeStyle = MAIL;
  g.lineWidth = Math.max(2, step * 0.14);
  for (let y = y0, r = 0; y < y1; y += step * 0.55, r++) {
    for (let x = x0 + (r % 2 ? step * 0.5 : 0); x < x1; x += step) {
      g.beginPath();
      g.arc(x, y, step * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    }
  }
}

function suit(g, P, k, front) {
  const [ax, ay] = P(-0.3, 0.55), [bx, by] = P(0.3, T.beltHi);
  mail(g, Math.min(ax, bx), ay, Math.max(ax, bx), by, 0.03 * k);
  if (front) {
    // red / white vertical stripes under the star, down to the belt
    const n = 7, x0 = -0.17, x1 = 0.17;
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
      poly(g, P, [[xa, 0.235], [xb, 0.235], [xb, T.beltHi], [xa, T.beltHi]], i % 2 ? WHITE : RED);
    }
    poly(g, P, [[x0, 0.24], [x1, 0.24], [x1, 0.228], [x0, 0.228]], BLUE_DK);
    poly(g, P, starPts(0, 0.33, 0.075), WHITE, BLUE_DK, 0.004 * k);
  }
  poly(g, P, [[-0.32, T.beltLo], [0.32, T.beltLo], [0.32, T.beltHi], [-0.32, T.beltHi]], BROWN);
  if (front) {
    poly(g, P, [[-0.04, T.beltLo + 0.006], [0.04, T.beltLo + 0.006], [0.04, T.beltHi - 0.006], [-0.04, T.beltHi - 0.006]], '#d9b24a', '#7a5a14', 0.003 * k);
    for (const s of [-1, 1]) poly(g, P, [[s * 0.1, T.beltLo + 0.004], [s * 0.16, T.beltLo + 0.004], [s * 0.16, T.beltHi + 0.006], [s * 0.1, T.beltHi + 0.006]], '#7d5230', '#4a2c14', 0.003 * k);
  }
}

// white feathered wing on the side of the helmet, drawn in (z, y) head metres: three feathers
// sweeping back from the temple
const wing = flatPicture(-0.4, 0.4, -0.4, 0.4, 600, 'back', (g, P0, k) => {
  const P = (z, y) => P0(-0.15 + (z + 0.13) * 1.35, 0.03 + (y - 0.06) * 1.35); // grown from the temple
  const feathers = [
    [[-0.13, 0.06], [0.06, 0.06], [0.2, 0.0], [0.11, 0.1]],
    [[-0.13, 0.11], [0.06, 0.14], [0.23, 0.11], [0.1, 0.18]],
    [[-0.12, 0.16], [0.04, 0.22], [0.25, 0.23], [0.06, 0.25]],
  ];
  for (const [a, c1, tip, c2] of feathers) {
    g.beginPath();
    let p = P(...a); g.moveTo(p[0], p[1]);
    let c = P(...c1); p = P(...tip); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    c = P(...c2); p = P(a[0] + 0.01, a[1] + 0.05); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    g.closePath();
    g.fillStyle = WHITE;
    g.fill();
    g.strokeStyle = BLUE_DK;
    g.lineWidth = 0.008 * k;
    g.lineJoin = 'round';
    g.stroke();
  }
});

const CAP_LOOK = {
  head: { color: BLUE },
  headPaint(col, glow, d, p) {
    if (Math.abs(d.x) > 0.55) wing.over(p.z, p.y, col);
  },
  face(g, E) {
    // face opening: rounded box from the brow line down under the chin
    const r = 0.3, x0 = -0.7, x1 = 0.7, y0 = 0.27, y1 = -1.2;
    const box = () => {
      g.beginPath();
      let p = E(x0 + r, y0); g.moveTo(p[0], p[1]);
      p = E(x1 - r, y0); g.lineTo(p[0], p[1]);
      let c = E(x1, y0); p = E(x1, y0 - r); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      p = E(x1, y1); g.lineTo(p[0], p[1]);
      p = E(x0, y1); g.lineTo(p[0], p[1]);
      p = E(x0, y0 - r); g.lineTo(p[0], p[1]);
      c = E(x0, y0); p = E(x0 + r, y0); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      g.closePath();
    };
    box();
    g.fillStyle = SKIN;
    g.fill();
    box();
    g.strokeStyle = BLUE_DK;
    g.lineWidth = 9;
    g.stroke();
    // Funko eyes + determined brows
    for (const s of [-1, 1]) {
      ellipse(g, E, s * 0.36, -0.02, 0.085, 0.12, INK);
      ellipse(g, E, s * 0.36 - 0.03, 0.03, 0.022, 0.03, 'rgba(255,255,255,0.85)');
      poly(g, E, [[s * 0.2, 0.14], [s * 0.52, 0.2], [s * 0.53, 0.155], [s * 0.21, 0.105]], '#6b4526');
    }
    // big white "A" with a dark blue edge
    const A = [[-0.25, 0.37], [-0.08, 0.86], [0.08, 0.86], [0.25, 0.37], [0.13, 0.37], [0.09, 0.5], [-0.09, 0.5], [-0.13, 0.37]];
    poly(g, E, A, WHITE, BLUE_DK, 7);
    poly(g, E, [[-0.045, 0.6], [0.045, 0.6], [0, 0.74]], BLUE, BLUE_DK, 5);
  },
  lensGlow: 0x000000,
  torsoBase: BLUE,
  torsoFront(g, P, k) { suit(g, P, k, true); },
  torsoBack(g, P, k) { suit(g, P, k, false); },
  arm(g, W, H) {
    fill(g, W, H, BLUE);
    mail(g, 0, 0, W, H * 0.6, 22);
  },
  fore(g, W, H, info) {
    fill(g, W, H, BLUE);
    fill(g, W, H, RED, info.yToPx(-0.045), H); // glove
  },
  thigh(g, W, H) { fill(g, W, H, BLUE); },
  shin(g, W, H, info) {
    fill(g, W, H, BLUE);
    fill(g, W, H, RED, info.yToPx(-0.075), H); // boot
    fill(g, W, H, '#8e1520', info.yToPx(-0.075), info.yToPx(-0.085));
  },
  matOpts: {},
  lazy: true,
};

// flared cuff (glove / boot top): a short thick cone ring around the limb axis
function flare(r0, r1, y0, y1, t = 0.012) {
  const pts = [[r0 - t, y0], [r0, y0 - 0.002], [r1, y1 - 0.004], [r1 + 0.004, y1], [r1 - t, y1 + 0.003], [r0 - t, y0]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 20);
}

// domed shield: base dome + colour rings lying just above it + extruded star
function shield(R) {
  const h = (r) => 0.034 * (1 - (r / R) ** 2);   // dome height at radius r
  const pieces = [];
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  const dome = [[0, -0.012], [R * 0.96, -0.012], [R, -0.004], [R * 1.01, 0.006], [R * 0.97, h(R * 0.97) + 0.004]];
  for (let i = 6; i >= 0; i--) { const r = (R * 0.95 * i) / 7; dome.push([r, h(r) + 0.002]); }
  pieces.push({ geo: lathe(dome), color: RED });
  const ring = (r0, r1, color) => {  // r1 > r0, listed outer -> inner so the faces point out
    const pts = [];
    for (let i = 0; i <= 6; i++) { const r = r1 - ((r1 - r0) * i) / 6; pts.push([r, h(r) + 0.005]); }
    pieces.push({ geo: lathe(pts), color });
  };
  ring(R * 0.58, R * 0.79, WHITE);
  ring(0.0001, R * 0.42, BLUE);
  const sh = new THREE.Shape(starPts(0, 0, R * 0.36).map(([x, y]) => new THREE.Vector2(x, y)));
  const star = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
  xf(star, [0, h(0) + 0.002, 0], [-Math.PI / 2, 0, 0]);
  pieces.push({ geo: star, color: WHITE });
  return pieces;
}

function addGear(parts) {
  // shield on the back: lathe axis (y) turned to +Z, centred between the shoulder blades
  const pieces = shield(0.172);
  for (const pc of pieces) xf(pc.geo, [0, 0.24, 0.158], [Math.PI / 2, 0, 0]);
  const ranges = attach(parts.torso, pieces, 'top');
  parts.spine.add(rangeToggle('capArmShield', parts.torso.geometry, ranges));

  // flared glove cuffs (forearm mesh, UV on the red fist) and boot tops (shin mesh, red boot)
  for (const a of [parts.armL, parts.armR]) {
    attach(a.elbow.children[0], [{ geo: flare(0.06, 0.082, -0.075, -0.035), uv: [0.5, 0.015] }]);
  }
  for (const l of [parts.legL, parts.legR]) {
    attach(l.knee.children[0], [{ geo: flare(0.088, 0.106, -0.12, -0.075), uv: [0.5, 0.015] }]);
  }
}

export function createCap() {
  const m = createSpiderCharacter(CAP_LOOK, { build: addGear });
  m.root.name = 'cap';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
