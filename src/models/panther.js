// panther.js — Black Panther as a matte-black Funko Pop figure: black suit with silver line
// pattern (necklace arcs on the chest and back, lines over the head), small cat ears, big white
// angular lenses in silver frames, silver ankle bands.   createPanther() -> { root, setState, update, setSpeed, hand }

import * as THREE from 'three';
import { toonMaterial, addOutline } from './toon.js';
import { createSpiderCharacter, paintLenses, SATIN, SPIDER_DIM, OUTLINE_COLOR } from './spiderman.js';

const BLACK = '#101015';
const SILVER = '#b9bdc8';

// matte: no gloss/sheen, only a faint rim
const MATTE = { ...SATIN, gloss: null, sheen: null, rim: { color: 0xffffff, threshold: 0.66, strength: 0.04, soft: 0.3 } };

// necklace: three nested V-arcs from the shoulders meeting under the throat
function necklace(g, P, k, y0) {
  g.strokeStyle = SILVER;
  g.lineCap = 'round';
  g.lineWidth = 0.007 * k;
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      g.beginPath();
      let p = P(s * (0.3 - i * 0.06), y0 + 0.22 - i * 0.01); g.moveTo(p[0], p[1]);
      const c = P(s * (0.2 - i * 0.05), y0 - 0.04 - i * 0.05); p = P(0, y0 - 0.06 - i * 0.05);
      g.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      g.stroke();
    }
  }
}

const line = (g, W, H, x = 0.235) => { g.fillStyle = SILVER; g.fillRect(W * x, 0, W * 0.012, H); };

const PANTHER_LOOK = {
  head: { color: BLACK, web: { color: SILVER, opacity: 0.55, spokes: 10, step: 0.3, width: 0.005 } },
  face(g, E, s) { paintLenses(g, E, s, { frame: SILVER, groove: '#6b6f7a', lens: '#ffffff', lensShade: '#e4e8f0', frameW: 0.06 }); },
  lensGlow: 0x8a8a8a,
  torsoBase: BLACK,
  torsoFront(g, P, k) { necklace(g, P, k, 0.34); },
  torsoBack(g, P, k) {
    necklace(g, P, k, 0.4);
    const a = P(-0.004, 0.3), b = P(0.004, 0.1); // spine line
    g.fillStyle = SILVER;
    g.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  },
  arm(g, W, H) { g.fillStyle = BLACK; g.fillRect(0, 0, W, H); line(g, W, H, 0.24); },
  fore(g, W, H) { g.fillStyle = BLACK; g.fillRect(0, 0, W, H); line(g, W, H, 0.24); },
  thigh(g, W, H) { g.fillStyle = BLACK; g.fillRect(0, 0, W, H); line(g, W, H); },
  shin(g, W, H, info) {
    g.fillStyle = BLACK;
    g.fillRect(0, 0, W, H);
    line(g, W, H);
    g.fillStyle = SILVER; // ankle bands
    g.fillRect(0, info.yToPx(-0.15), W, 0.018 * info.ky);
    g.fillRect(0, info.yToPx(-0.185), W, 0.012 * info.ky);
  },
  matOpts: { head: MATTE, torso: MATTE, arm: MATTE, thigh: MATTE, shin: MATTE },
  lazy: true,
};

function addEars(parts) {
  const mat = toonMaterial(0x101015, MATTE);
  const top = SPIDER_DIM.headUp * 2;
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.11, 4, 1), mat);
    ear.position.set(s * 0.25, top + 0.005, 0.0);
    ear.rotation.set(0, Math.PI / 4, -s * 0.18);
    ear.scale.set(1, 1, 0.6);
    addOutline(ear, 0.014, OUTLINE_COLOR);
    parts.head.add(ear);
  }
}

export function createPanther() {
  const m = createSpiderCharacter(PANTHER_LOOK, { build: addEars });
  m.root.name = 'panther';
  return { root: m.root, setState: m.setState, update: m.update, setSpeed: m.setSpeed, hand: m.parts.handR };
}
