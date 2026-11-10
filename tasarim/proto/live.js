// tasarim/proto/live.js — prototype only: applies the 11.3 Midtown facade (atlas + glow +
// halftone), the sky shader and a day phase to the RUNNING game in a dev tab, so the look can be
// judged in the real camera. Not game code. Usage in the console of a game tab:
//   const L = await import('/tasarim/proto/live.js'); L.apply(); L.phase('NIGHT');  // or a 0..6000 m value
import * as THREE from 'three';
import { game } from '/src/game.js';
import { toonMaterial } from '/src/models/toon.js';
import * as T from './sehir-tex.js';
import { PHASES, PHASE_KEYS, DISC_KEYS, PHASE_LOOP } from './tables.js';

const U = {
  uHalftone: { value: 1 }, uDotTint: { value: new THREE.Color() }, uBaseTone: { value: 0 },
  uSunLum: { value: 1 }, uWinOn: { value: 0 },
};
let sky = null, facade = null;

function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4;
  return t;
}

export function apply(kind = 'midtown') {
  // a NEW material each time: three reuses a cached program (and its old uniforms) when a
  // material recompiles to a key it had before, so mutating + needsUpdate is not reliable
  const atlas = { midtown: [T.drawMidtownAtlas, T.drawMidtownGlow], chinatown: [T.drawChinatownAtlas, T.drawChinatownGlow], neon: [T.drawNeonAtlas, T.drawNeonGlow] }[kind];
  const m = toonMaterial(0xffffff, { map: tex(1024, 1024, atlas[0], 0.25), emissiveMap: tex(512, 512, atlas[1], 0.25), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
  m.onBeforeCompile = T.facadeHook(U);
  for (const seg of game.world.segments) if (seg.city) seg.city.facade.material = m;
  facade = m;
  const mask = tex(2048, 512, (g) => T.drawSkylineMask(g));
  mask.colorSpace = THREE.NoColorSpace;
  const c = (h) => new THREE.Color(h);
  sky = new THREE.ShaderMaterial({
    uniforms: {
      uMask: { value: mask }, uTop: { value: c(0) }, uMid: { value: c(0) }, uHorizon: { value: c(0) },
      uFar: { value: c(0) }, uNear: { value: c(0) }, uWin: { value: c(0) }, uWinOn: { value: 0 },
      uSunCol: { value: c(0) }, uSun: { value: new THREE.Vector3() }, uStars: { value: 0 }, uDots: { value: 1 }, uDark: { value: 0 },
    },
    vertexShader: T.SKY_VERT, fragmentShader: T.SKY_FRAG, depthWrite: false, fog: false,
  });
  game.city.skyline.material = sky;
}

const lerp = (a, b, t) => a + (b - a) * t;
const ca = new THREE.Color(), cb = new THREE.Color();
function blend(a, b, t) {
  const o = {};
  for (const k in a) {
    if (k === 'name') continue;
    if (Array.isArray(a[k])) o[k] = a[k].map((v, i) => lerp(v, b[k][i], t));
    else if (k === 'skyTop' || k === 'skyMid' || k === 'horizon' || k === 'fog' || k === 'far' || k === 'near' || k === 'win' || k === 'hemiSky' || k === 'hemiGround' || k === 'sun' || k === 'dotTint') o[k] = ca.setHex(a[k]).lerp(cb.setHex(b[k]), t).getHex();
    else o[k] = lerp(a[k], b[k], t);
  }
  return o;
}
export function phaseAt(d) {
  const s = ((d % PHASE_LOOP) + PHASE_LOOP) % PHASE_LOOP;
  for (let i = 0; i < PHASE_KEYS.length - 1; i++) {
    const [d0, p0] = PHASE_KEYS[i], [d1, p1] = PHASE_KEYS[i + 1];
    if (s <= d1) return blend(p0, p1, d1 > d0 ? (s - d0) / (d1 - d0) : 0);
  }
  return blend(PHASES[0], PHASES[0], 0);
}
export function discAt(d) {
  const s = ((d % PHASE_LOOP) + PHASE_LOOP) % PHASE_LOOP;
  for (let i = 0; i < DISC_KEYS.length - 1; i++) {
    const a = DISC_KEYS[i], b = DISC_KEYS[i + 1];
    if (s <= b[0]) { const t = b[0] > a[0] ? (s - a[0]) / (b[0] - a[0]) : 0; return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), ca.setHex(a[4]).lerp(cb.setHex(b[4]), t).getHex()]; }
  }
  return DISC_KEYS[0].slice(1);
}

export function phase(which) {
  const d = typeof which === 'number' ? which : { DAY: 500, GOLDEN: 2200, DUSK: 3050, NIGHT: 4200, DAWN: 5450 }[which];
  const p = phaseAt(d), disc = discAt(d);
  const sc = game.scene;
  const hemi = sc.children.find((o) => o.isHemisphereLight), sun = sc.children.find((o) => o.isDirectionalLight);
  sc.background.setHex(p.fog); sc.fog.color.setHex(p.fog); sc.fog.near = p.fogNear; sc.fog.far = p.fogFar;
  hemi.color.setHex(p.hemiSky); hemi.groundColor.setHex(p.hemiGround); hemi.intensity = p.hemiI;
  sun.color.setHex(p.sun); sun.intensity = p.sunI; sun.position.set(...p.sunPos);
  U.uHalftone.value = p.halftone; U.uDotTint.value.setHex(p.dotTint); U.uBaseTone.value = p.baseTone;
  U.uSunLum.value = p.sunI * (0.299 * sun.color.r + 0.587 * sun.color.g + 0.114 * sun.color.b) / Math.PI;
  U.uWinOn.value = p.winOn;
  if (facade) facade.emissiveIntensity = p.glow;
  if (sky) {
    const u = sky.uniforms;
    u.uTop.value.setHex(p.skyTop); u.uMid.value.setHex(p.skyMid); u.uHorizon.value.setHex(p.horizon);
    u.uFar.value.setHex(p.far); u.uNear.value.setHex(p.near); u.uWin.value.setHex(p.win); u.uWinOn.value = p.skyWin;
    u.uSun.value.set(disc[0], disc[1], disc[2]); u.uSunCol.value.setHex(disc[3]); u.uStars.value = p.stars; u.uDots.value = p.skyDots;
  }
  game.renderer.render(sc, game.camera);
  return p;
}
