// raimi.js — classic 2002 (Raimi) Spider-Man as a Funko Pop figure: shared body from
// createSpiderCharacter with a new paint job. Red head/torso/arms with raised silver web lines,
// small white lenses in thick black frames, blue sides/legs, red gloves and boots. Back: red with
// silver webs and a black spider.   createRaimi() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, paintSpiderEmblem, paintRadialWeb, paintWebGrid, CHEST_SPIDER, BACK_SPIDER, TORSO } from './spiderman.js';

const RED = '#c4122b';
const BLUE = '#1d3f95';
const SILVER = '#cdd2dc';
const SHADOW = '#5c0a16';
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

function torso(g, P, k, spider) {
  panelPath(g, P);
  g.fillStyle = RED;
  g.fill();
  g.save();
  panelPath(g, P);
  g.clip();
  const web = (x, y) => P(x, 0.4 + y);
  paintRadialWeb(g, web, { spokes: 14, step: 0.05, maxR: 0.5, width: 0.0075 * k, color: SHADOW, rot: 0.1 });
  paintRadialWeb(g, web, { spokes: 14, step: 0.05, maxR: 0.5, width: 0.0045 * k, color: SILVER, rot: 0.1 });
  g.restore();
  paintSpiderEmblem(g, (x, y) => P(x, y + 0.27), k, { ...spider, color: BLACK });
}

// red limb with raised silver web grid (dark under-line + silver line)
function webLimb(g, W, H) {
  g.fillStyle = RED;
  g.fillRect(0, 0, W, H);
  paintWebGrid(g, 0, 0, W, H, { cols: 10, rows: 8, sag: 0.35, width: 4.4, color: SHADOW });
  paintWebGrid(g, 0, 0, W, H, { cols: 10, rows: 8, sag: 0.35, width: 2.4, color: SILVER });
}

const RAIMI_LOOK = {
  head: { color: RED, web: { color: SILVER, opacity: 1, width: 0.0125 } },
  face(g, E, s) { paintLenses(g, E, s, { frame: BLACK, groove: '#3a3a44', lens: '#ffffff', lensShade: '#cfd3dc', frameW: 0.2 }); },
  lensGlow: 0x8a8a8a,
  torsoBase: BLUE,
  torsoFront(g, P, k) { torso(g, P, k, { ...CHEST_SPIDER, legs: [], head: { top: 0.1, neck: 0.05, w: 0.03 }, body: { top: 0.05, bottom: -0.09, w: 0.038 } }); },
  torsoBack(g, P, k) { torso(g, P, k, BACK_SPIDER); },
  arm: webLimb,
  fore(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    const cuff = info.yToPx(-0.085);
    g.fillStyle = RED; // glove
    g.fillRect(0, cuff, W, H - cuff);
  },
  thigh(g, W, H) { g.fillStyle = BLUE; g.fillRect(0, 0, W, H); },
  shin(g, W, H, info) {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, W, H);
    const top = info.yToPx(-0.1);
    g.fillStyle = RED;
    g.fillRect(0, top, W, H - top);
  },
  matOpts: {},
  lazy: true,
};

export function createRaimi() {
  const m = createSpiderCharacter(RAIMI_LOOK);
  m.root.name = 'raimi';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
