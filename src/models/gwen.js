// gwen.js — Spider-Gwen as a Funko Pop vinyl figure: the shared Spider-Man body
// (createSpiderCharacter) with a new paint job. White hood (rim + teal/pink web inside it
// around the white mask face), magenta eye frames; black torso with white shoulders / upper
// chest (sleeveless look), white arms with teal fists and magenta cuffs, black legs, teal
// high-top sneakers with white soles. Back: white hood, same black/white split, a small white
// spider.   createGwen() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, paintSpiderEmblem, BACK_SPIDER, TORSO } from './spiderman.js';

const WHITE = '#fbfbfd';
const BLACK = '#14141b';
const PINK = '#ec2f93';
const PINK_LT = '#ff7cc0';
const TEAL = '#35cfc3';
const T = TORSO;

// white yoke: the top of the torso down to the armpits, the lower edge dips to a V at the chest
function yoke(g, P, front) {
  g.beginPath();
  let p = P(-0.32, 0.7); g.moveTo(p[0], p[1]);
  p = P(-0.32, T.armpit + 0.02); g.lineTo(p[0], p[1]);
  const c = P(0, front ? T.armpit - 0.05 : T.armpit + 0.04);
  const m = P(-0.12, T.armpit + 0.0); g.quadraticCurveTo(m[0], m[1], c[0], c[1]);
  const m2 = P(0.12, T.armpit + 0.0); p = P(0.32, T.armpit + 0.02); g.quadraticCurveTo(m2[0], m2[1], p[0], p[1]);
  p = P(0.32, 0.7); g.lineTo(p[0], p[1]);
  g.closePath();
  g.fillStyle = WHITE;
  g.fill();
  // pink piping along the edge
  g.strokeStyle = PINK;
  g.lineWidth = 5;
  g.lineJoin = 'round';
  p = P(-0.32, T.armpit + 0.02); g.beginPath(); g.moveTo(p[0], p[1]);
  g.quadraticCurveTo(m[0], m[1], c[0], c[1]);
  g.quadraticCurveTo(m2[0], m2[1], ...P(0.32, T.armpit + 0.02));
  g.stroke();
}

// rounded hood opening (superellipse) at `s` times its size, in face coordinates
function opening(g, E, s) {
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
    const [x, y] = E(0.84 * s * Math.sign(c) * Math.sqrt(Math.abs(c)), 0.08 + 0.8 * s * Math.sign(n) * Math.sqrt(Math.abs(n)));
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}

const GWEN_LOOK = {
  head: { color: WHITE },
  face(g, E, s) {
    opening(g, E, 1);
    g.fillStyle = TEAL;
    g.fill();
    // pink web spokes inside the rim, then the white mask face on top
    g.strokeStyle = PINK_LT;
    g.lineWidth = 5;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
      const pt = (k) => E(0.84 * k * Math.sign(c) * Math.sqrt(Math.abs(c)), 0.08 + 0.8 * k * Math.sign(n) * Math.sqrt(Math.abs(n)));
      const [x0, y0] = pt(0.78), [x1, y1] = pt(1);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    opening(g, E, 0.89);
    g.stroke();
    opening(g, E, 0.78);
    g.fillStyle = '#fffafd';
    g.fill();
    opening(g, E, 1);
    g.strokeStyle = '#aab4c0';
    g.lineWidth = 7;
    g.stroke();
    paintLenses(g, E, s, { frame: PINK, groove: PINK_LT, lens: '#ffffff', lensShade: '#f4e2ee', frameW: 0.1 });
  },
  lensGlow: 0x000000,
  torsoBase: BLACK,
  torsoFront(g, P) { yoke(g, P, true); },
  torsoBack(g, P, k) {
    yoke(g, P, false);
    paintSpiderEmblem(g, (x, y) => P(x, y + 0.14), k, { ...BACK_SPIDER, color: WHITE });
  },
  arm(g, W, H) { g.fillStyle = WHITE; g.fillRect(0, 0, W, H); },
  fore(g, W, H, info) {
    g.fillStyle = WHITE;
    g.fillRect(0, 0, W, H);
    const cuff = info.yToPx(-0.085);
    g.fillStyle = PINK;
    g.fillRect(0, cuff, W, 0.03 * info.ky);
    g.fillStyle = TEAL; // fist
    g.fillRect(0, cuff + 0.03 * info.ky, W, H);
  },
  thigh(g, W, H) { g.fillStyle = BLACK; g.fillRect(0, 0, W, H); },
  shin(g, W, H, info) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    const top = info.yToPx(-0.06);
    g.fillStyle = TEAL;
    g.fillRect(0, top, W, H - top);
    g.fillStyle = PINK;
    g.fillRect(0, top, W, 0.015 * info.ky);
    g.fillStyle = WHITE; // sole
    g.fillRect(0, H - 0.04 * info.ky, W, 0.04 * info.ky);
  },
  matOpts: {},
  lazy: true,
};

export function createGwen() {
  const m = createSpiderCharacter(GWEN_LOOK);
  m.root.name = 'gwen';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
