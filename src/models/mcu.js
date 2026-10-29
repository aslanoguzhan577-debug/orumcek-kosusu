// mcu.js — MCU "integrated suit" Spider-Man as a Funko Pop figure: red head with black lens
// frames and black web lines, red/blue body with gold trim lines and a small gold chest spider,
// red gloves/boots. Back: red/blue with gold trim.   createMcuSpidey() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, paintSpiderEmblem, CHEST_SPIDER, TORSO } from './spiderman.js';
import { panelPath } from './raimi.js';

const RED = '#b3122a';
const BLUE = '#1c3a8c';
const GOLD = '#e8b73a';
const WEB = '#2a0710';
const BLACK = '#121218';
const T = TORSO;

function torso(g, P, k, front) {
  panelPath(g, P);
  g.fillStyle = RED;
  g.fill();
  // gold trim: seam from armpit to belt on each side + belt line
  g.strokeStyle = GOLD;
  g.lineWidth = 0.007 * k;
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    let p = P(s * 0.18, T.armpit - 0.01); g.moveTo(p[0], p[1]);
    const c = P(s * 0.162, 0.17); p = P(s * 0.132, T.beltHi); g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
    g.stroke();
  }
  g.beginPath();
  let p = P(-0.32, T.beltHi); g.moveTo(p[0], p[1]);
  p = P(0.32, T.beltHi); g.lineTo(p[0], p[1]);
  g.stroke();
  if (front) paintSpiderEmblem(g, (x, y) => P(x * 0.5, y * 0.5 + 0.34), k * 0.5, { ...CHEST_SPIDER, color: GOLD });
}

const stripe = (g, W, H, x = 0.235) => { g.fillStyle = GOLD; g.fillRect(W * x, 0, W * 0.03, H); };

const MCU_LOOK = {
  head: { color: RED, web: { color: WEB, opacity: 0.95, width: 0.009 } },
  face(g, E, s) { paintLenses(g, E, s, { frame: BLACK, groove: '#3a3a44', lens: '#ffffff', lensShade: '#cfd3dc', frameW: 0.13 }); },
  lensGlow: 0x8a8a8a,
  torsoBase: BLUE,
  torsoFront(g, P, k) { torso(g, P, k, true); },
  torsoBack(g, P, k) { torso(g, P, k, false); },
  arm(g, W, H) { g.fillStyle = RED; g.fillRect(0, 0, W, H); stripe(g, W, H, 0.22); },
  fore(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    stripe(g, W, H, 0.22);
    const cuff = info.yToPx(-0.085);
    g.fillStyle = RED;
    g.fillRect(0, cuff, W, H - cuff);
  },
  thigh(g, W, H) { g.fillStyle = BLUE; g.fillRect(0, 0, W, H); stripe(g, W, H); },
  shin(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    stripe(g, W, H);
    const top = info.yToPx(-0.1);
    g.fillStyle = RED;
    g.fillRect(0, top, W, H - top);
    g.fillStyle = GOLD;
    g.fillRect(0, top, W, 0.012 * info.ky);
  },
  matOpts: {},
  lazy: true,
};

export function createMcuSpidey() {
  const m = createSpiderCharacter(MCU_LOOK);
  m.root.name = 'mcu';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
