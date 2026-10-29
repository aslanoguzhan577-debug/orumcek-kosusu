// ironman.js — Iron Man (Mark 3 style) as a glossy-metal Funko Pop figure: red helmet with a small
// trapezoid on top, gold faceplate with glowing pale-cyan eye slits, red armour with gold plates
// and a glowing arc reactor. Back: red with gold plates.   createIronMan() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, SATIN, TORSO } from './spiderman.js';

const RED = '#b81424';
const GOLD = '#d6a125';
const GOLD_FACE = '#b8861c'; // luminance < 120 so the faceplate does not glow like the eyes
const GOLD_EDGE = '#5a3a00';
const CYAN = '#c8faff';
const T = TORSO;

const METAL = {
  ...SATIN,
  sheen: { color: 0xffe6dc, threshold: 0.62, strength: 0.16, soft: 0.3 },
  gloss: { color: 0xffffff, threshold: 0.978, strength: 0.65, soft: 0.01 },
  rim: { color: 0xffc04a, threshold: 0.66, strength: 0.2, soft: 0.12 },
};

function poly(g, P, pts, fill, edge, w = 3) {
  g.beginPath();
  pts.forEach(([x, y], i) => { const p = P(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = edge;
  g.lineWidth = w;
  g.lineJoin = 'round';
  g.stroke();
}

function torso(g, P, k, front) {
  const a = P(-0.4, 0.8), b = P(0.4, -0.2);
  g.fillStyle = RED;
  g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  // gold waist plate, shoulder-side plates
  poly(g, P, [[-0.3, 0.17], [0.3, 0.17], [0.3, T.beltLo], [-0.3, T.beltLo]], GOLD, GOLD_EDGE);
  poly(g, P, [[-0.1, 0.17], [0.1, 0.17], [0.07, 0.1], [-0.07, 0.1]], RED, GOLD_EDGE);
  for (const s of [-1, 1]) poly(g, P, [[s * 0.32, 0.7], [s * 0.2, 0.7], [s * 0.19, 0.5], [s * 0.32, 0.46]], GOLD, GOLD_EDGE);
  if (front) {
    for (const s of [-1, 1]) poly(g, P, [[s * 0.06, 0.34], [s * 0.19, 0.38], [s * 0.19, 0.3], [s * 0.06, 0.28]], GOLD, GOLD_EDGE);
    // arc reactor: glow, gold ring, white core
    const c = P(0, 0.36), r = Math.abs(P(0.05, 0)[0] - P(0, 0)[0]);
    const grd = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * 1.6);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.45, CYAN);
    grd.addColorStop(1, 'rgba(120,230,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(c[0], c[1], r * 1.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD_EDGE; g.lineWidth = r * 0.4;
    g.beginPath(); g.arc(c[0], c[1], r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(c[0], c[1], r * 0.45, 0, Math.PI * 2); g.fill();
  } else {
    poly(g, P, [[-0.1, 0.5], [0.1, 0.5], [0.07, 0.3], [-0.07, 0.3]], GOLD, GOLD_EDGE);
  }
}

const band = (g, W, y0, y1, color = GOLD) => { g.fillStyle = color; g.fillRect(0, y0, W, y1 - y0); };

const IRON_LOOK = {
  head: { color: RED },
  face(g, E) {
    // gold faceplate: wide forehead tapering to the chin
    poly(g, E, [[-0.74, 0.55], [0.74, 0.55], [0.8, 0.0], [0.5, -0.78], [-0.5, -0.78], [-0.8, 0.0]], GOLD_FACE, GOLD_EDGE, 8);
    // small trapezoid on the red helmet top
    poly(g, E, [[-0.22, 0.86], [0.22, 0.86], [0.3, 0.64], [-0.3, 0.64]], GOLD_FACE, GOLD_EDGE, 6);
    // glowing eye slits, angled down towards the nose
    for (const s of [-1, 1]) poly(g, E, [[s * 0.14, 0.2], [s * 0.66, 0.3], [s * 0.64, 0.16], [s * 0.2, 0.08]], CYAN, '#f4ffff', 3);
    const a = E(-0.28, -0.42), b = E(0.28, -0.42); // mouth line
    g.strokeStyle = GOLD_EDGE;
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  },
  lensGlow: 0xd8fbff,
  torsoBase: RED,
  torsoFront(g, P, k) { torso(g, P, k, true); },
  torsoBack(g, P, k) { torso(g, P, k, false); },
  arm(g, W, H, info) { g.fillStyle = RED; g.fillRect(0, 0, W, H); band(g, W, 0, info.yToPx(0.0)); },
  fore(g, W, H, info) {
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    band(g, W, info.yToPx(-0.02), info.yToPx(-0.085));
    band(g, W, info.yToPx(-0.085), H); // gold glove
  },
  thigh(g, W, H) { g.fillStyle = RED; g.fillRect(0, 0, W, H); band(g, W, H * 0.62, H); },
  shin(g, W, H, info) {
    g.fillStyle = RED;
    g.fillRect(0, 0, W, H);
    band(g, W, info.yToPx(-0.02), info.yToPx(-0.12));
    band(g, W, H - 0.05 * info.ky, H, GOLD_EDGE);
  },
  matOpts: { head: METAL, torso: METAL, arm: METAL, thigh: METAL, shin: METAL },
  lazy: true,
};

export function createIronMan() {
  const m = createSpiderCharacter(IRON_LOOK);
  m.root.name = 'ironman';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
