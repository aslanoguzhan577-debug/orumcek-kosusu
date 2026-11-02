// raimi.js — the 2002 (Raimi) Spider-Man as a Funko Pop figure on the shared Spider-Man body
// (createSpiderCharacter). The signature raised silver webbing is painted as a relief: every
// line has a bright top edge, a silver face and a dark shadow under it (head, torso, gloves,
// boots). Silver-mirror lenses in heavy black frames; bold black chest spider with long legs;
// big red spider outlined in black on the back; blue sides, blue under the arms, blue legs.
//   createRaimi() -> { root, setState, update, setSpeed, hand }
// panelPath is shared with mcu.js.

import * as THREE from 'three';
import { createSpiderCharacter, paintLenses, paintSpiderEmblem, paintRadialWeb, paintWebGrid, headWeb, BACK_SPIDER, TORSO } from './spiderman.js';
import { fill } from './heroKit.js';

const RED = '#c4122b';
const BLUE = '#1d3f95';
const SILVER = '#d4d8e2';
const HILITE = '#ffffff';
const SHADOW = '#560914';
const BLACK = '#121218';
const T = TORSO;

// red centre panel + shoulders + belt (blue wedges stay at the sides); shared with mcu.js
export function panelPath(g, P) {
  g.beginPath();
  let p = P(0.32, 0.7); g.moveTo(p[0], p[1]);
  p = P(0.32, T.armpit + 0.02); g.lineTo(p[0], p[1]);
  let c = P(0.215, T.armpit + 0.01); p = P(0.18, T.armpit - 0.01); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  c = P(0.162, 0.17); p = P(0.132, T.beltHi); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  p = P(-0.132, T.beltHi); g.lineTo(p[0], p[1]);
  c = P(-0.162, 0.17); p = P(-0.18, T.armpit - 0.01); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  c = P(-0.215, T.armpit + 0.01); p = P(-0.32, T.armpit + 0.02); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
  p = P(-0.32, 0.7); g.lineTo(p[0], p[1]);
  g.closePath();
  p = P(0.32, T.beltHi); g.moveTo(p[0], p[1]);
  p = P(-0.32, T.beltHi); g.lineTo(p[0], p[1]);
  p = P(-0.32, T.beltLo); g.lineTo(p[0], p[1]);
  p = P(0.32, T.beltLo); g.lineTo(p[0], p[1]);
  g.closePath();
}

// relief: draws `web(dx, dy, color, width)` three times — shadow below, silver, highlight above
function relief(g, web, w, d) {
  web(0, d, SHADOW, w * 1.25);
  web(0, 0, SILVER, w);
  g.save();
  g.globalAlpha = 0.85;
  web(0, -d * 0.45, HILITE, w * 0.4);
  g.restore();
}

function torso(g, P, k, front) {
  panelPath(g, P);
  g.fillStyle = RED;
  g.fill();
  g.save();
  panelPath(g, P);
  g.clip();
  relief(g, (dx, dy, color, width) => paintRadialWeb(g, (x, y) => { const p = P(x, 0.4 + y); return [p[0] + dx, p[1] + dy]; },
    { spokes: 14, step: 0.05, maxR: 0.5, width, color, rot: 0.1 }), 0.0055 * k, 0.004 * k);
  g.restore();
  if (front) {
    // bold black spider: small body, long legs
    paintSpiderEmblem(g, (x, y) => P(x * 0.9, y * 0.95 + 0.3), k * 0.9, {
      legs: [[[0.02, 0.05], [0.08, 0.12], [0.15, 0.1]], [[0.024, 0.03], [0.12, 0.06], [0.17, 0.02]],
        [[0.024, 0.0], [0.11, -0.02], [0.14, -0.12]], [[0.02, -0.02], [0.06, -0.06], [0.07, -0.16]]],
      legW: [0.014, 0.006], head: { top: 0.075, neck: 0.04, w: 0.024 }, body: { top: 0.042, bottom: -0.07, w: 0.03 }, color: BLACK,
    });
  } else {
    // big red spider outlined in black
    const S = (x, y) => P(x * 1.25, y * 1.25 + 0.27);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]]) {
      const o = 0.009 * k;
      paintSpiderEmblem(g, (x, y) => { const p = S(x, y); return [p[0] + ox * o, p[1] + oy * o]; }, k * 1.25, { ...BACK_SPIDER, color: BLACK });
    }
    paintSpiderEmblem(g, S, k * 1.25, { ...BACK_SPIDER, color: '#d4162f' });
  }
}

// limb with raised web (lathe space)
function webbed(g, x0, y0, x1, y1, cols, rows) {
  relief(g, (dx, dy, color, width) => paintWebGrid(g, x0 + dx, y0 + dy, x1 + dx, y1 + dy, { cols, rows, sag: 0.35, width, color }), 3.4, 2.4);
}

const HILITE_RGB = [255, 255, 255], SILVER_RGB = [0xd4, 0xd8, 0xe2], SHADOW_RGB = [0x56, 0x09, 0x14];
const WEB = { spokes: 18, step: 0.22, width: 0.0115, sag: 0.3 };
const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Vector3();
const mix = (col, c, a) => { for (let i = 0; i < 3; i++) col[i] += (c[i] - col[i]) * a; };

const RAIMI_LOOK = {
  head: { color: RED },
  // raised web: shadow where a line lies just above this texel, silver line, bright top edge
  headPaint(col, glow, d) {
    const a = headWeb(d, WEB);
    if (a < 1) { // shadow under a line (two web lookups per texel at most: bakes are startup time)
      const above = headWeb(_q.copy(d).addScaledVector(UP, 0.016).normalize(), WEB);
      if (above > 0) mix(col, SHADOW_RGB, above * (1 - a) * 0.8);
    }
    if (a > 0) {
      const below = headWeb(_q.copy(d).addScaledVector(UP, -0.01).normalize(), WEB);
      mix(col, SILVER_RGB, a);
      mix(col, HILITE_RGB, a * (1 - below) * 0.8);
    }
  },
  face(g, E, s) {
    paintLenses(g, E, s, {
      frame: BLACK, groove: '#34343e', lens: '#eef1f6', lensShade: '#8d95a4', frameW: 0.19,
      // mirror streak across the silver lens
      inner(g2, side, E2) {
        const a = E2(0.25 * side, 0.4), b = E2(0.8 * side, -0.2);
        const grd = g2.createLinearGradient(a[0], a[1], b[0], b[1]);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(0.45, 'rgba(255,255,255,0.9)');
        grd.addColorStop(0.55, 'rgba(160,170,190,0.5)');
        grd.addColorStop(1, 'rgba(120,130,150,0.2)');
        g2.fillStyle = grd;
        g2.fill();
      },
    });
  },
  lensGlow: 0x8a8a8a,
  glowLum: 200,
  torsoBase: BLUE,
  torsoFront(g, P, k) { torso(g, P, k, true); },
  torsoBack(g, P, k) { torso(g, P, k, false); },
  arm(g, W, H) {
    fill(g, W, H, RED);
    webbed(g, 0, 0, W, H, 10, 8);
    g.fillStyle = BLUE;
    g.fillRect(W * 0.62, 0, W * 0.26, H); // blue under the arm
  },
  fore(g, W, H, info) {
    fill(g, W, H, RED);
    webbed(g, 0, 0, W, H, 10, 8);
    g.fillStyle = BLUE;
    g.fillRect(W * 0.62, 0, W * 0.26, info.yToPx(-0.085));
  },
  thigh(g, W, H) { fill(g, W, H, BLUE); },
  shin(g, W, H, info) {
    fill(g, W, H, BLUE);
    const top = info.yToPx(-0.075);
    g.save();
    g.beginPath();
    g.moveTo(0, top);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, top + Math.max(0, Math.cos((x / W) * Math.PI * 2)) * 0.02 * info.ky);
    g.lineTo(W, H); g.lineTo(0, H);
    g.closePath();
    g.fillStyle = RED;
    g.fill();
    g.clip();
    webbed(g, 0, top, W, H, 10, 5);
    g.restore();
  },
  matOpts: {},
  lazy: true,
};

export function createRaimi() {
  const m = createSpiderCharacter(RAIMI_LOOK);
  m.root.name = 'raimi';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}

