// miles.js — Miles Morales as a Funko Pop vinyl figure: the shared Spider-Man body
// (createSpiderCharacter) in a very dark navy suit with a faint halftone dot texture, big white
// lenses with thick red frames, sparse red web lines on the head, a small red spider on the
// chest (big one on the back), red cuffs / fists / leg stripes / boots.
//   createMiles() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, paintSpiderEmblem, CHEST_SPIDER, BACK_SPIDER, TORSO } from './spiderman.js';

const NAVY = '#0d0f19';
const RED = '#d5162e';
const DOT = 'rgba(190, 200, 230, 0.07)';
const T = TORSO;

function dots(g, x0, y0, x1, y1, step) {
  g.fillStyle = DOT;
  for (let y = y0, r = 0; y < y1; y += step * 0.5, r++) {
    for (let x = x0 + (r % 2 ? step * 0.5 : 0); x < x1; x += step) {
      g.beginPath();
      g.arc(x, y, step * 0.17, 0, Math.PI * 2);
      g.fill();
    }
  }
}
const flat = (g, W, H, color = NAVY) => { g.fillStyle = color; g.fillRect(0, 0, W, H); dots(g, 0, 0, W, H, 14); };

const MILES_LOOK = {
  head: { color: NAVY, web: { color: '#b3132a', opacity: 0.95, spokes: 12, step: 0.3, width: 0.008 } },
  face(g, E, s) {
    paintLenses(g, E, s, { frame: RED, groove: '#ff5c6e', lens: '#ffffff', lensShade: '#d4d8e4', frameW: 0.13 });
  },
  lensGlow: 0x8a8a8a,
  torsoBase: NAVY,
  torsoFront(g, P, k) {
    dots(g, ...P(-0.27, 0.5), ...P(0.27, -0.12), 14);
    paintSpiderEmblem(g, (x, y) => P(x * 0.5, y * 0.5 + 0.34), k * 0.5, { ...CHEST_SPIDER, color: RED });
  },
  torsoBack(g, P, k) {
    dots(g, ...P(-0.27, 0.5), ...P(0.27, -0.12), 14);
    paintSpiderEmblem(g, (x, y) => P(x, y + 0.27), k, { ...BACK_SPIDER, color: RED });
  },
  arm(g, W, H) { flat(g, W, H); },
  fore(g, W, H, info) {
    flat(g, W, H);
    const cuff = info.yToPx(-0.085); // red glove: cuff + fist
    g.fillStyle = RED;
    g.fillRect(0, cuff, W, H - cuff);
  },
  thigh(g, W, H) {
    flat(g, W, H);
    g.fillStyle = RED;
    g.fillRect(W * 0.235, 0, W * 0.03, H);
  },
  shin(g, W, H, info) {
    flat(g, W, H);
    g.fillStyle = RED;
    g.fillRect(W * 0.235, 0, W * 0.03, H);
    const top = info.yToPx(-0.1); // red boots
    g.fillRect(0, top, W, H - top);
  },
  matOpts: {},
  lazy: true,
};

export function createMiles() {
  const m = createSpiderCharacter(MILES_LOOK);
  m.root.name = 'miles';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
