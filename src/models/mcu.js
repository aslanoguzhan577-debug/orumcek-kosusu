// mcu.js — MCU (Homecoming) Spider-Man as a Funko Pop figure on the shared Spider-Man body
// (createSpiderCharacter). Red head with fine black web lines and big expressive lenses in
// thick black frames; red / blue suit split by heavy black piping, fine black web on the red,
// small black chest spider and a black back spider, black stripes down the outside of arms and
// legs, red gloves and boots.   createMcuSpidey() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, paintSpiderEmblem, paintRadialWeb, paintWebGrid, CHEST_SPIDER, BACK_SPIDER, TORSO } from './spiderman.js';
import { panelPath } from './raimi.js';
import { fill } from './heroKit.js';

const RED = '#c0162f';
const BLUE = '#1e3d93';
const WEB = '#1d0509';
const BLACK = '#111116';
const T = TORSO;

function torso(g, P, k, front) {
  panelPath(g, P);
  g.fillStyle = RED;
  g.fill();
  g.save();
  panelPath(g, P);
  g.clip();
  paintRadialWeb(g, (x, y) => P(x, (front ? 0.3 : 0.42) + y), { spokes: 16, step: 0.045, maxR: 0.5, width: 0.0028 * k, color: WEB, rot: 0.1 });
  g.restore();
  // heavy black piping along every red / blue edge
  panelPath(g, P);
  g.strokeStyle = BLACK;
  g.lineWidth = 0.009 * k;
  g.lineJoin = 'round';
  g.stroke();
  if (front) paintSpiderEmblem(g, (x, y) => P(x * 0.55, y * 0.55 + 0.33), k * 0.55, { ...CHEST_SPIDER, color: BLACK });
  else paintSpiderEmblem(g, (x, y) => P(x * 0.9, y * 0.9 + 0.29), k * 0.9, { ...BACK_SPIDER, color: BLACK });
}

// black stripe down the outside (u = 0.25) with a thin blue gap
const stripe = (g, W, H) => { g.fillStyle = BLACK; g.fillRect(W * 0.225, 0, W * 0.05, H); };

const MCU_LOOK = {
  head: { color: RED, web: { color: WEB, opacity: 0.95, width: 0.0075, spokes: 20, step: 0.19 } },
  face(g, E, s) {
    // bigger, rounder lenses than the classic suit
    paintLenses(g, (X, Y) => E(X * 1.04, Y * 1.1 - 0.02), s * 1.04, { frame: BLACK, groove: '#3a3a44', lens: '#ffffff', lensShade: '#cfd5e0', frameW: 0.15 });
  },
  lensGlow: 0x8a8a8a,
  torsoBase: BLUE,
  torsoFront(g, P, k) { torso(g, P, k, true); },
  torsoBack(g, P, k) { torso(g, P, k, false); },
  arm(g, W, H, info) {
    fill(g, W, H, RED);
    paintWebGrid(g, 0, 0, W, H, { cols: 10, rows: 8, sag: 0.35, width: 2, color: WEB });
    g.fillStyle = BLUE;
    g.fillRect(W * 0.58, info.yToPx(-0.02), W * 0.34, H); // blue under the arm
    g.fillStyle = BLACK;
    g.fillRect(W * 0.565, info.yToPx(-0.02), W * 0.02, H);
    g.fillRect(W * 0.915, info.yToPx(-0.02), W * 0.02, H);
    stripe(g, W, H);
  },
  fore(g, W, H, info) {
    fill(g, W, H, BLUE);
    stripe(g, W, H);
    const cuff = info.yToPx(-0.07);
    fill(g, W, H, RED, cuff, H);
    paintWebGrid(g, 0, cuff, W, H, { cols: 10, rows: 3, sag: 0.35, width: 2, color: WEB });
    fill(g, W, H, BLACK, cuff, cuff + 0.008 * info.ky);
  },
  thigh(g, W, H) { fill(g, W, H, BLUE); stripe(g, W, H); },
  shin(g, W, H, info) {
    fill(g, W, H, BLUE);
    stripe(g, W, H);
    const top = info.yToPx(-0.08);
    fill(g, W, H, RED, top, H);
    paintWebGrid(g, 0, top, W, info.yToPx(-0.19), { cols: 10, rows: 4, sag: 0.35, width: 2.2, color: WEB });
    fill(g, W, H, BLACK, top, top + 0.008 * info.ky);
  },
  matOpts: {},
  lazy: true,
};

export function createMcuSpidey() {
  const m = createSpiderCharacter(MCU_LOOK);
  m.root.name = 'mcu';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
