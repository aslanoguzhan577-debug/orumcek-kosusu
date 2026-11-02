// gwen.js — Spider-Gwen as a Funko Pop vinyl figure on the shared Spider-Man body
// (createSpiderCharacter). Funko #146 read: a white HOOD is the whole head — a raised rim
// around the face opening with hot-pink lining just inside it, a white mask with thin teal web
// lines and white lenses in slim black frames. Back: hood seam down the middle and a soft hood
// fold draping onto the shoulders (sculpted, merged into the head mesh). Body: white top with
// pink piping, black lower suit, teal web on the inner arms, teal fists, teal ballet-slipper
// shoes with pink trim and white soles, small white spider on the back.
//   createGwen() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { createSpiderCharacter, paintLenses, paintSpiderEmblem, paintWebGrid, BACK_SPIDER, TORSO } from './spiderman.js';
import { attach, ball, xf, headRing, fill, line } from './heroKit.js';

const WHITE = '#fbfbfd';
const BLACK = '#16151c';
const PINK = '#f2318f';
const PINK_DK = '#a8185f';
const TEAL = '#2ec4c0';
const TEAL_DK = '#178e8c';
const T = TORSO;
const smooth = THREE.MathUtils.smoothstep;

// hood opening (superellipse) in face units, scaled by s
const OPEN = { cx: 0, cy: -0.04, rx: 0.8, ry: 0.78 };
function openingPts(s = 1, n = 64) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    pts.push([OPEN.cx + OPEN.rx * s * Math.sign(c) * Math.abs(c) ** 0.6, OPEN.cy + OPEN.ry * s * Math.sign(sn) * Math.abs(sn) ** 0.6]);
  }
  return pts;
}
function opening(g, E, s) {
  g.beginPath();
  openingPts(s).forEach(([x, y], i) => { const p = E(x, y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
  g.closePath();
}

function yoke(g, P, front) {
  const path = () => {
    g.beginPath();
    let p = P(-0.32, 0.7); g.moveTo(p[0], p[1]);
    p = P(-0.32, T.armpit + 0.02); g.lineTo(p[0], p[1]);
    const c = P(0, front ? T.armpit - 0.07 : T.armpit + 0.02);
    const m = P(-0.12, T.armpit + 0.0); g.quadraticCurveTo(m[0], m[1], c[0], c[1]);
    const m2 = P(0.12, T.armpit + 0.0); p = P(0.32, T.armpit + 0.02); g.quadraticCurveTo(m2[0], m2[1], p[0], p[1]);
    p = P(0.32, 0.7); g.lineTo(p[0], p[1]);
  };
  path();
  g.closePath();
  g.fillStyle = WHITE;
  g.fill();
  path();
  g.strokeStyle = PINK;
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.stroke();
}

const GWEN_LOOK = {
  head: { color: WHITE },
  // hood seam down the middle of the back + a soft shade line along the opening's edge
  headPaint(col, glow, d) {
    if (d.z > 0.1 && d.y > -0.75) {
      const a = 1 - smooth(Math.abs(d.x), 0.012, 0.024);
      if (a > 0) for (let i = 0; i < 3; i++) col[i] += (HOOD_RGB[i] - col[i]) * a;
    }
  },
  face(g, E, s) {
    // pink lining inside the hood, the white mask inside that
    opening(g, E, 1.02);
    g.fillStyle = PINK;
    g.fill();
    opening(g, E, 0.9);
    g.fillStyle = '#ffffff';
    g.fill();
    // thin teal web lines on the mask: spokes from between the eyes + sagging rings
    g.save();
    opening(g, E, 0.9);
    g.clip();
    const o = [0, -0.12];
    g.strokeStyle = TEAL;
    g.lineWidth = 7;
    g.lineCap = 'round';
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.11;
      const p0 = E(o[0], o[1]), p1 = E(o[0] + Math.cos(a) * 1.3, o[1] + Math.sin(a) * 1.3);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    }
    for (const r of [0.22, 0.46, 0.72]) {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const a0 = (i / N) * Math.PI * 2 + 0.11, a1 = ((i + 1) / N) * Math.PI * 2 + 0.11, am = (a0 + a1) / 2;
        const p0 = E(o[0] + Math.cos(a0) * r, o[1] + Math.sin(a0) * r);
        const pc = E(o[0] + Math.cos(am) * r * 0.86, o[1] + Math.sin(am) * r * 0.86);
        const p1 = E(o[0] + Math.cos(a1) * r, o[1] + Math.sin(a1) * r);
        if (i === 0) g.moveTo(p0[0], p0[1]);
        g.quadraticCurveTo(pc[0], pc[1], p1[0], p1[1]);
      }
      g.stroke();
    }
    g.restore();
    // darker pink seam where lining meets the mask
    opening(g, E, 0.9);
    g.strokeStyle = PINK_DK;
    g.lineWidth = 5;
    g.stroke();
    // lenses: white, slim black frames (scaled into the mask a little)
    paintLenses(g, (X, Y) => E(X * 0.86, Y * 0.86 - 0.02), s * 0.86, { frame: BLACK, groove: '#3b3646', lens: '#ffffff', lensShade: '#dfe6f2', frameW: 0.085 });
  },
  lensGlow: 0x000000,
  torsoBase: BLACK,
  torsoFront(g, P) { yoke(g, P, true); },
  torsoBack(g, P, k) {
    yoke(g, P, false);
    paintSpiderEmblem(g, (x, y) => P(x * 0.85, y * 0.85 + 0.17), k * 0.85, { ...BACK_SPIDER, color: WHITE });
  },
  arm(g, W, H) {
    fill(g, W, H, WHITE);
    // teal web on the inside of the arm (u = 0.75), pink seam lines either side
    g.save();
    g.beginPath(); g.rect(W * 0.62, 0, W * 0.26, H); g.clip();
    fill(g, W, H, TEAL);
    paintWebGrid(g, W * 0.62, 0, W * 0.88, H, { cols: 3, rows: 6, color: BLACK, width: 3, sag: 0.35 });
    g.restore();
    g.fillStyle = PINK;
    g.fillRect(W * 0.6, 0, W * 0.025, H);
    g.fillRect(W * 0.875, 0, W * 0.025, H);
  },
  fore(g, W, H, info) {
    fill(g, W, H, WHITE);
    g.save();
    g.beginPath(); g.rect(W * 0.62, 0, W * 0.26, H); g.clip();
    fill(g, W, H, TEAL);
    paintWebGrid(g, W * 0.62, 0, W * 0.88, H, { cols: 3, rows: 6, color: BLACK, width: 3, sag: 0.35 });
    g.restore();
    g.fillStyle = PINK;
    g.fillRect(W * 0.6, 0, W * 0.025, H);
    g.fillRect(W * 0.875, 0, W * 0.025, H);
    const cuff = info.yToPx(-0.085);
    fill(g, W, H, PINK, cuff, cuff + 0.022 * info.ky);
    fill(g, W, H, TEAL, cuff + 0.022 * info.ky, H); // teal glove / fist
  },
  thigh(g, W, H) {
    fill(g, W, H, BLACK);
    g.fillStyle = PINK;
    g.fillRect(W * 0.235, 0, W * 0.03, H);
  },
  shin(g, W, H, info) {
    fill(g, W, H, BLACK);
    g.fillStyle = PINK;
    g.fillRect(W * 0.235, 0, W * 0.03, H);
    // teal ballet slippers: a pink top band, criss-cross ribbons, white sole
    const top = info.yToPx(-0.075);
    fill(g, W, H, TEAL, top, H);
    fill(g, W, H, PINK, top, top + 0.016 * info.ky);
    for (let x = 0; x < W; x += W / 6) {
      line(g, (a, b) => [a, b], [[x, top + 0.016 * info.ky], [x + W / 12, info.yToPx(-0.14)], [x + W / 6, top + 0.016 * info.ky]], TEAL_DK, 3);
    }
    fill(g, W, H, WHITE, H - 0.035 * info.ky, H);
  },
  matOpts: {},
  lazy: true,
};
const HOOD_RGB = [0xc9, 0xcb, 0xd8];

// sculpted hood: a rim around the face opening and the hood fold on the shoulders
function addHood(parts) {
  const W = 0.43, H = 0.365;
  // pink-lined rim of the hood opening, standing proud of the mask
  const rim = headRing(openingPts(1.0, 48).map(([x, y]) => [x * W, y * H]), { r: 0.032, out: 0.014, sz: 0.75 });
  // hood fold: a wide flat drape under the back of the head, lying on the shoulders
  const fold = xf(ball(18, 12), [0, -H + 0.01, 0.12], [0.25, 0, 0], [0.31, 0.06, 0.2]);
  attach(parts.headMesh, [
    { geo: rim, color: PINK },
    { geo: fold, color: '#eeeef4' },
  ]);
}

export function createGwen() {
  const m = createSpiderCharacter(GWEN_LOOK, { build: addHood });
  m.root.name = 'gwen';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
