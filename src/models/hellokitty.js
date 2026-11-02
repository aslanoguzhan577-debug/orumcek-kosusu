// hellokitty.js — Funko Pop Hello Kitty on the shared Spider-Man body (createSpiderCharacter),
// so every state, the `hand` marker, height and hitbox are the same. Extra-wide white head with
// two rounded triangle ears, a big red bow (two plump loops, a knot, two ribbon tails) on her
// left ear, black oval eyes, a yellow nose and three whiskers a side, no mouth. Classic outfit:
// yellow shirt under blue overalls (bib, two buttons, a heart pocket, straps crossing on the
// back), white paws and feet, a little white tail. Ears, bow and tail are merged into the head
// and torso meshes (no extra draw calls).
//   createHelloKitty() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { createSpiderCharacter, TORSO } from './spiderman.js';
import { attach, poly, ellipse, line, fill, ball, xf } from './heroKit.js';

const WHITE = '#fbfbfd';
const BLUE = '#2f5fc4';
const BLUE_DK = '#1c3a86';
const YELLOW = '#f6d23a';
const RED = '#e0182f';
const RED_DK = '#a50e20';
const INK = '#1a1418';
const T = TORSO;

// heart path centred at (x, y), size r (metres -> pixels by P)
function heart(g, P, x, y, r, color) {
  g.beginPath();
  let p = P(x, y - r * 0.9); g.moveTo(p[0], p[1]);
  for (const s of [1, -1]) {
    const c1 = P(x + s * r * 1.2, y - r * 0.1), c2 = P(x + s * r * 0.9, y + r * 0.95), e = P(x, y + r * 0.45);
    g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    if (s === 1) { p = P(x, y - r * 0.9); g.moveTo(p[0], p[1]); }
  }
  g.fillStyle = color;
  g.fill();
}

function overalls(g, P, k, front) {
  const e = 0.004 * k;
  // pants part + bib (front) / back panel
  poly(g, P, [[-0.34, -0.2], [0.34, -0.2], [0.34, 0.17], [0.15, 0.19], [0.15, 0.31], [-0.15, 0.31], [-0.15, 0.19], [-0.34, 0.17]], BLUE, BLUE_DK, e);
  if (front) {
    for (const s of [-1, 1]) poly(g, P, [[s * 0.07, 0.3], [s * 0.15, 0.3], [s * 0.17, 0.6], [s * 0.09, 0.6]], BLUE, BLUE_DK, e);
    for (const s of [-1, 1]) ellipse(g, P, s * 0.11, 0.285, 0.026, 0.026, YELLOW, '#b8920f', e);
    // bib pocket with a red heart
    poly(g, P, [[-0.07, 0.25], [0.07, 0.25], [0.065, 0.16], [-0.065, 0.16]], null, BLUE_DK, e);
    heart(g, P, 0, 0.205, 0.028, RED);
  } else {
    // straps crossing on the back
    for (const s of [-1, 1]) poly(g, P, [[s * 0.15, 0.6], [s * 0.07, 0.6], [-s * 0.13, 0.19], [-s * 0.05, 0.19]], BLUE, BLUE_DK, e);
  }
}

const KITTY_LOOK = {
  head: { color: WHITE },
  face(g, E) {
    // whiskers: three fanned lines per side, reaching past the edge of the face
    for (const s of [-1, 1]) {
      for (const [y0, y1] of [[-0.12, 0.0], [-0.23, -0.24], [-0.34, -0.48]]) {
        line(g, (x, y) => E(x * s, y), [[0.64, y0], [1.02, y1]], INK, 13);
      }
    }
    // eyes: tall black ovals with a soft highlight; yellow nose with a dark rim
    for (const s of [-1, 1]) {
      ellipse(g, E, s * 0.44, -0.08, 0.085, 0.15, INK);
      ellipse(g, E, s * 0.44 - 0.025, -0.02, 0.022, 0.035, 'rgba(255,255,255,0.55)');
    }
    ellipse(g, E, 0, -0.24, 0.11, 0.072, '#f4c21a', INK, 7);
  },
  lensGlow: 0x000000,
  torsoBase: YELLOW,
  torsoFront(g, P, k) { overalls(g, P, k, true); },
  torsoBack(g, P, k) { overalls(g, P, k, false); },
  arm(g, W, H, info) {
    fill(g, W, H, YELLOW);
    fill(g, W, H, WHITE, info.yToPx(-0.1), H); // short sleeve
    fill(g, W, H, '#d8b21c', info.yToPx(-0.1), info.yToPx(-0.108));
  },
  fore(g, W, H) { fill(g, W, H, WHITE); },
  thigh(g, W, H) {
    fill(g, W, H, BLUE);
    fill(g, W, H, BLUE_DK, H * 0.62, H * 0.65); // hem
    fill(g, W, H, WHITE, H * 0.65, H);
  },
  shin(g, W, H) { fill(g, W, H, WHITE); },
  matOpts: {},
  lazy: true, // no wide-eyed "scared" texture: the intro just shows the normal face
};

function addExtras(parts) {
  const head = parts.headMesh;
  head.scale.set(1.08, 0.97, 1); // Kitty's head is wider than Spidey's
  // rounded triangle ears leaning out from the top corners
  const ears = [-1, 1].map((s) => {
    const c = ball(16, 12); // a ball pinched toward the top = soft rounded triangle
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 1) / 2;
      p.setXYZ(i, p.getX(i) * (1 - 0.62 * t), p.getY(i), p.getZ(i) * (1 - 0.35 * t));
    }
    return { geo: xf(c, [s * 0.27, 0.33, 0.02], [0, 0, -s * 0.32], [0.14, 0.14, 0.085]), color: WHITE };
  });
  // the bow: two plump loops, a knot and two short ribbon tails, on her left ear (-X)
  const bow = [];
  for (const s of [-1, 1]) {
    bow.push({ geo: xf(ball(18, 12), [s * 0.115, 0, 0], [0, 0, s * 0.3], [0.13, 0.1, 0.07]), color: RED });
    bow.push({ geo: xf(ball(10, 8), [s * 0.05, -0.085, 0.01], [0, 0, s * 0.5], [0.035, 0.07, 0.03]), color: RED_DK });
  }
  bow.push({ geo: xf(ball(14, 10), [0, 0, -0.012], [0, 0, 0], [0.055, 0.058, 0.06]), color: RED });
  // place the bow at the base of her left ear, facing a little forward and out
  const m = new THREE.Matrix4().compose(new THREE.Vector3(-0.29, 0.34, -0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.45, 0.32)), new THREE.Vector3(1.3, 1.3, 1.3));
  for (const b of bow) b.geo.applyMatrix4(m);
  attach(head, [...ears, ...bow]);

  // little round tail on the back of the overalls
  attach(parts.torso, [{ geo: xf(ball(14, 10), [0, 0.02, 0.17], [0, 0, 0], 0.05), color: WHITE }], 'top');
}

export function createHelloKitty() {
  const m = createSpiderCharacter(KITTY_LOOK, { build: addExtras });
  m.root.name = 'hellokitty';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
