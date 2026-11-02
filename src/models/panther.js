// panther.js — Black Panther (MCU) as a satin-black Funko Pop figure on the shared Spider-Man
// body (createSpiderCharacter). Helmet with small cat ears and silver lines sweeping from the
// brow over the head to the back of the neck; big white angular lenses in silver frames and the
// silver V pattern of the mask. The silver claw necklace runs across the chest and the upper
// back; a faint vibranium triangle weave covers the suit. A cool purple rim light keeps the
// silhouette on a dark background.
//   createPanther() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, SATIN, TORSO } from './spiderman.js';
import { attach, poly, line, fill, ball, xf } from './heroKit.js';

const BLACK = '#111117';
const WEAVE = '#1d1d27';
const SILVER = '#cdd2dc';
const SILVER_DK = '#6b707c';
const T = TORSO;

const PANTHER = {
  ...SATIN,
  sheen: { color: 0xd8ccff, threshold: 0.72, strength: 0.08, soft: 0.28 },
  gloss: { color: 0xffffff, threshold: 0.982, strength: 0.32, soft: 0.012 },
  rim: { color: 0xb9a2ff, threshold: 0.66, strength: 0.22, soft: 0.12 },
};

// triangle lattice (vibranium weave), pixels
function weave(g, x0, y0, x1, y1, step, color = WEAVE, w = 2) {
  g.strokeStyle = color;
  g.lineWidth = w;
  const h = step * 0.866;
  g.beginPath();
  for (let y = y0; y <= y1; y += h) { g.moveTo(x0, y); g.lineTo(x1, y); }
  for (let x = x0 - (y1 - y0); x <= x1 + (y1 - y0); x += step) {
    g.moveTo(x, y0); g.lineTo(x + (y1 - y0) * 0.577, y1);
    g.moveTo(x, y0); g.lineTo(x - (y1 - y0) * 0.577, y1);
  }
  g.stroke();
}

// silver claw necklace: a band of fangs hanging from an arc, y0 = lowest point of the arc
function necklace(g, P, k, y0, front) {
  const N = front ? 13 : 11;
  const arc = (t) => { // t -1..1 across
    const x = t * 0.26;
    return [x, y0 + 0.09 * t * t * (front ? 1.4 : 1)];
  };
  // the cord
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(arc(-1 + (i / 24) * 2));
  line(g, P, pts, SILVER_DK, 0.012 * k);
  // fangs pointing down, longest in the middle
  for (let i = 0; i < N; i++) {
    const t = -0.92 + (i / (N - 1)) * 1.84;
    const [x, y] = arc(t);
    const len = 0.045 * (1 - 0.45 * Math.abs(t)), w = 0.016;
    poly(g, P, [[x - w, y + 0.004], [x + w, y + 0.004], [x, y - len]], SILVER, SILVER_DK, 0.003 * k);
  }
}

const PANTHER_LOOK = {
  // silver lines fanning from the back of the neck over the head (spokes only, no rings)
  head: { color: BLACK, web: { color: SILVER, opacity: 0.9, spokes: 10, step: 9, width: 0.0075, frontFade: [-0.55, -0.25] } },
  face(g, E, s) {
    // mask pattern: lines from the nose bridge up over the brow, a silver V down to the chin
    for (const sd of [-1, 1]) {
      const S = (x, y) => E(x * sd, y);
      line(g, S, [[0.05, 0.12], [0.16, 0.5], [0.24, 0.9]], SILVER, 9);
      line(g, S, [[0.07, -0.12], [0.3, -0.5], [0.0, -0.86]], SILVER, 9);
      line(g, S, [[0.62, -0.36], [0.9, -0.1]], SILVER, 8);
    }
    // big white angular lenses (narrower, cat-like), silver frames
    paintLenses(g, (X, Y) => E(X * 0.98, Y * 0.82 + 0.08), s, { frame: SILVER, groove: SILVER_DK, lens: '#ffffff', lensShade: '#e3e6f2', frameW: 0.07 });
  },
  lensGlow: 0x7a7a8a,
  glowLum: 235, // the lenses glow a little, the silver lines do not
  torsoBase: BLACK,
  torsoFront(g, P, k) {
    const [ax, ay] = P(0.3, 0.6), [bx, by] = P(-0.3, -0.15);
    weave(g, Math.min(ax, bx), ay, Math.max(ax, bx), by, 0.06 * k);
    necklace(g, P, k, 0.33, true);
    poly(g, P, [[-0.32, T.beltLo], [0.32, T.beltLo], [0.32, T.beltHi], [-0.32, T.beltHi]], '#16161e', SILVER_DK, 0.004 * k);
    poly(g, P, [[-0.03, T.beltLo + 0.008], [0.03, T.beltLo + 0.008], [0.03, T.beltHi - 0.008], [-0.03, T.beltHi - 0.008]], SILVER);
  },
  torsoBack(g, P, k) {
    const [ax, ay] = P(-0.3, 0.6), [bx, by] = P(0.3, -0.15);
    weave(g, Math.min(ax, bx), ay, Math.max(ax, bx), by, 0.06 * k);
    necklace(g, P, k, 0.37, false);
    line(g, P, [[0, 0.3], [0, T.beltHi]], SILVER, 0.006 * k); // spine line
    poly(g, P, [[-0.32, T.beltLo], [0.32, T.beltLo], [0.32, T.beltHi], [-0.32, T.beltHi]], '#16161e', SILVER_DK, 0.004 * k);
  },
  arm(g, W, H) {
    fill(g, W, H, BLACK);
    weave(g, 0, 0, W, H, 26);
    g.fillStyle = SILVER;
    g.fillRect(W * 0.235, 0, W * 0.014, H);
  },
  fore(g, W, H, info) {
    fill(g, W, H, BLACK);
    weave(g, 0, 0, W, H, 26);
    g.fillStyle = SILVER;
    g.fillRect(W * 0.235, 0, W * 0.014, H);
    fill(g, W, H, SILVER_DK, info.yToPx(-0.08), info.yToPx(-0.088)); // glove edge
  },
  thigh(g, W, H) {
    fill(g, W, H, BLACK);
    weave(g, 0, 0, W, H, 18);
    g.fillStyle = SILVER;
    g.fillRect(W * 0.235, 0, W * 0.016, H);
  },
  shin(g, W, H, info) {
    fill(g, W, H, BLACK);
    weave(g, 0, 0, W, H, 26);
    g.fillStyle = SILVER;
    g.fillRect(W * 0.235, 0, W * 0.014, H);
    fill(g, W, H, SILVER, info.yToPx(-0.13), info.yToPx(-0.145)); // ankle bands
    fill(g, W, H, SILVER, info.yToPx(-0.16), info.yToPx(-0.17));
  },
  matOpts: { head: PANTHER, torso: PANTHER, arm: PANTHER, thigh: PANTHER, shin: PANTHER },
  lazy: true,
};

function addEars(parts) {
  // small rounded cat ears on the top corners of the helmet
  const ears = [-1, 1].map((s) => {
    const c = ball(12, 10);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + 1) / 2;
      p.setXYZ(i, p.getX(i) * (1 - 0.7 * t), p.getY(i), p.getZ(i) * (1 - 0.5 * t));
    }
    return { geo: xf(c, [s * 0.25, 0.35, 0.03], [0, 0, -s * 0.25], [0.105, 0.11, 0.06]), color: BLACK };
  });
  attach(parts.headMesh, ears);
}

export function createPanther() {
  const m = createSpiderCharacter(PANTHER_LOOK, { build: addEars });
  m.root.name = 'panther';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}

