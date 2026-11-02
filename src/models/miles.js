// miles.js — Miles Morales (Into the Spider-Verse) as a Funko Pop figure on the shared
// Spider-Man body (createSpiderCharacter). Black suit with a faint halftone dot print and the
// red web over the whole head, shoulders and arms; big white lenses in black frames with a
// thin red inner edge; a big spiky red spider on the chest and the back, printed with the
// movie's cyan / magenta "glitch" offset; red palms, black gloves; red-white-black high-tops.
//   createMiles() -> { root, setState, update, setSpeed, hand }

import { createSpiderCharacter, paintLenses, paintSpiderEmblem, paintRadialWeb, paintWebGrid, TORSO } from './spiderman.js';
import { fill } from './heroKit.js';

const BLACK = '#0f1016';
const RED = '#e01b33';
const WEB = '#c3162c';
const DOT = 'rgba(190, 200, 230, 0.07)';
const T = TORSO;

// Spider-Verse spider: long spiky legs, angular body
const VERSE_SPIDER = {
  legs: [
    [[0.03, 0.07], [0.11, 0.17], [0.19, 0.13]],
    [[0.035, 0.04], [0.15, 0.08], [0.22, 0.02]],
    [[0.035, 0.0], [0.15, -0.03], [0.17, -0.17]],
    [[0.03, -0.03], [0.08, -0.08], [0.09, -0.2]],
  ],
  legW: [0.022, 0.006],
  head: { top: 0.1, neck: 0.05, w: 0.032 },
  body: { top: 0.055, bottom: -0.11, w: 0.04 },
};

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

// red spider with the cyan / magenta misregistration of the film's comic print
function glitchSpider(g, P, k, s, y) {
  const o = 0.007 * k;
  const at = (dx) => (x, yy) => { const p = P(x * s, yy * s + y); return [p[0] + dx, p[1]]; };
  g.save();
  g.globalAlpha = 0.75;
  paintSpiderEmblem(g, at(-o), k * s, { ...VERSE_SPIDER, color: '#26d4ff' });
  paintSpiderEmblem(g, at(o), k * s, { ...VERSE_SPIDER, color: '#ff2fa8' });
  g.restore();
  paintSpiderEmblem(g, at(0), k * s, { ...VERSE_SPIDER, color: RED });
}

// red web over the shoulders (yoke), clipped above the armpits
function yokeWeb(g, P, k, front) {
  g.save();
  g.beginPath();
  const a = P(-0.34, 0.7), b = P(0.34, T.armpit + 0.04);
  g.rect(Math.min(a[0], b[0]), a[1], Math.abs(b[0] - a[0]), b[1] - a[1]);
  g.clip();
  paintRadialWeb(g, (x, y) => P(x, (front ? 0.62 : 0.6) + y), { spokes: 16, step: 0.05, maxR: 0.5, width: 0.0035 * k, color: WEB, rot: 0.05 });
  g.restore();
}

const MILES_LOOK = {
  head: { color: BLACK, web: { color: WEB, opacity: 1, spokes: 16, step: 0.24, width: 0.0085, frontFade: [-0.6, -0.3] } },
  face(g, E, s) {
    // black frames vanish into the black mask: the lenses are drawn larger to keep the white big
    paintLenses(g, (X, Y) => E(X * 1.1, Y * 1.14 - 0.01), s * 1.1, {
      frame: '#050508', groove: '#26262e', lens: '#ffffff', lensShade: '#d4d8e4', frameW: 0.09,
      inner(g2, side, E2, sc) { g2.strokeStyle = RED; g2.lineWidth = 0.36 * sc; g2.stroke(); }, // the frame covers all but the inner edge
    });
  },
  lensGlow: 0x8a8a8a,
  torsoBase: BLACK,
  torsoFront(g, P, k) {
    dots(g, ...P(-0.27, 0.5), ...P(0.27, -0.12), 14);
    yokeWeb(g, P, k, true);
    glitchSpider(g, P, k, 0.95, 0.26);
  },
  torsoBack(g, P, k) {
    dots(g, ...P(-0.27, 0.5), ...P(0.27, -0.12), 14);
    yokeWeb(g, P, k, false);
    glitchSpider(g, P, k, 0.95, 0.25);
  },
  arm(g, W, H) {
    fill(g, W, H, BLACK);
    dots(g, 0, 0, W, H, 14);
    paintWebGrid(g, 0, 0, W, H, { cols: 8, rows: 7, sag: 0.35, width: 2.6, color: WEB });
  },
  fore(g, W, H, info) {
    fill(g, W, H, BLACK);
    dots(g, 0, 0, W, H, 14);
    paintWebGrid(g, 0, 0, W, info.yToPx(-0.06), { cols: 8, rows: 4, sag: 0.35, width: 2.6, color: WEB });
    // black glove with a red palm side (inside of the fist, u ~ 0.75)
    const cuff = info.yToPx(-0.085);
    fill(g, W, H, '#16171e', cuff, H);
    g.fillStyle = RED;
    g.fillRect(W * 0.62, cuff + 0.01 * info.ky, W * 0.26, H);
  },
  thigh(g, W, H) {
    fill(g, W, H, BLACK);
    dots(g, 0, 0, W, H, 14);
  },
  shin(g, W, H, info) {
    fill(g, W, H, BLACK);
    dots(g, 0, 0, W, H, 14);
    // high-tops: red with a white toe box and sole, black ankle collar
    const top = info.yToPx(-0.09);
    fill(g, W, H, RED, top, H);
    fill(g, W, H, '#16171e', top, top + 0.018 * info.ky);
    fill(g, W, H, '#f4f4f4', H * 0.984, H);       // sole: bottom of the boot blob
    g.fillStyle = '#f4f4f4';
    g.fillRect(W * 0.38, H * 0.97, W * 0.24, H * 0.014); // toe box (front of the boot)
  },
  matOpts: {},
  lazy: true,
};

export function createMiles() {
  const m = createSpiderCharacter(MILES_LOOK);
  m.root.name = 'miles';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
