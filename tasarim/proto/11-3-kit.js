// tasarim/proto/11-3-kit.js — PROTOTYPE of stage 11.3 ("one run = one day"), not game code.
// It runs INSIDE a game page (see 11-3-canli.html) and dresses the running game through public
// hooks only (world.onRecycle, material uniforms). The piece builders below (gate, lanternString,
// tower, cableSeg, shell, station, mouth, gantry, board, blimp ...) ARE the build recipes of
// tasarim/11-3-modeller.md: pBox / pCyl have the same signature as in src/city.js, so the coder
// types them into city code 1:1. Coordinates are segment-local: x across, y up (0 = running
// surface), z along the track, +z = towards the camera; one segment is z -10 .. +10.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { game } from '../../src/game.js';           // relative: same module URL as the game's own import, any base path
import { toonMaterial } from '../../src/models/toon.js';
import * as T from './sehir-tex.js';

// ------------------------------------------------------------------ tables (-> CONFIG.city)
export const LOOP = 6000;
// [id, start metre in the loop]; every border is a multiple of 20 (one segment = one district)
export const DISTRICTS = [['midtown', 0], ['chinatown', 1500], ['bridge', 2540], ['tunnel', 3340], ['neon', 3700], ['dawn', 5200]];
export const CLEAR_X = 4.6, CLEAR_Y = 9.5;   // no scenery inside |x| < CLEAR_X below CLEAR_Y

const DAY = { skyTop: 0x3f9eee, skyMid: 0x8fd0ff, horizon: 0xc9e9ff, fog: 0x9ad4ff, far: 0xa9c6e6, near: 0x8fb0d8, win: 0xffffff, skyWin: 0.2,
  hemiSky: 0xdff1ff, hemiGround: 0x6b5d50, hemiI: 1.6, sun: 0xfff1dc, sunI: 2.2, sunPos: [-6, 12, 6], tint: 0xffffff, sign: 0.9,
  halftone: 0.85, baseTone: 0, dotTint: 0x4a5296, winOn: 0, glow: 0, stars: 0, skyDots: 1, fogNear: 45, fogFar: 160, water: 0x2f86cc, lamp: 0.25, coin: 1, rim: 0 };
const GOLDEN = { skyTop: 0x4f86d8, skyMid: 0xffc27a, horizon: 0xffe0a0, fog: 0xffcf96, far: 0xe0a084, near: 0xb9727e, win: 0xffe2a0, skyWin: 0.2,
  hemiSky: 0xffeedb, hemiGround: 0x7a5648, hemiI: 1.5, sun: 0xffd0a0, sunI: 2.5, sunPos: [-10, 5, 7], tint: 0xffdcb8, sign: 0.95,
  halftone: 1, baseTone: 0.05, dotTint: 0x9a4f7a, winOn: 0.1, glow: 0.35, stars: 0, skyDots: 1, fogNear: 44, fogFar: 158, water: 0xe0955c, lamp: 0.7, coin: 1.2, rim: 0 };
const SUNSET = { skyTop: 0x35297a, skyMid: 0xe2507e, horizon: 0xffa040, fog: 0xf07c5c, far: 0x8a3f78, near: 0x552a60, win: 0xffd27a, skyWin: 0.5,
  hemiSky: 0xffe0dc, hemiGround: 0x6a4458, hemiI: 1.5, sun: 0xffc4a4, sunI: 2.1, sunPos: [-9, 4, 2], tint: 0x8a4a6c, sign: 1,
  halftone: 1, baseTone: 0.12, dotTint: 0x6a2f7a, winOn: 0.5, glow: 0.8, stars: 0.15, skyDots: 0.8, fogNear: 44, fogFar: 158, water: 0xd8556a, lamp: 1, coin: 1.5, rim: 0.25 };
const NIGHT = { skyTop: 0x080a26, skyMid: 0x191c56, horizon: 0x3b2f80, fog: 0x1b1a4a, far: 0x1d1d48, near: 0x121236, win: 0xffd27a, skyWin: 0.9,
  hemiSky: 0xa8b6ff, hemiGround: 0x5a3a78, hemiI: 1.4, sun: 0xcfd8ff, sunI: 1.75, sunPos: [6, 12, 7], tint: 0x5a62a6, sign: 1,
  halftone: 1, baseTone: 0.25, dotTint: 0x2a2a70, winOn: 0.85, glow: 1.15, stars: 1, skyDots: 0, fogNear: 42, fogFar: 155, water: 0x1a2a6a, lamp: 1, coin: 2.2, rim: 0.8 };
const DAWN = { skyTop: 0x6b8fd8, skyMid: 0xf6b0c8, horizon: 0xffe0b8, fog: 0xf4c4cc, far: 0xb89ab8, near: 0x9a7aa8, win: 0xffe2a0, skyWin: 0.25,
  hemiSky: 0xffe0f0, hemiGround: 0x6a5670, hemiI: 1.5, sun: 0xffd0b0, sunI: 2.0, sunPos: [6, 6, 7], tint: 0xf0c4d4, sign: 0.95,
  halftone: 0.95, baseTone: 0.08, dotTint: 0x8a6aa8, winOn: 0.25, glow: 0.45, stars: 0.1, skyDots: 0.8, fogNear: 45, fogFar: 160, water: 0xc890b0, lamp: 0.6, coin: 1.2, rim: 0.1 };
export const PHASE = { DAY, GOLDEN, SUNSET, NIGHT, DAWN };
// [loop metre, phase]: linear blend between neighbours. 3340-3700 is the tunnel: the sky turns unseen.
export const PHASE_KEYS = [[0, DAY], [1300, DAY], [1700, GOLDEN], [2440, GOLDEN], [2700, SUNSET], [3340, SUNSET],
  [3520, NIGHT], [5000, NIGHT], [5300, DAWN], [5650, DAWN], [6000, DAY]];
// sun / moon disc on the sky plane: [loop metre, u, v, radius, colour]
export const DISC_KEYS = [[0, 0.5, 0.95, 0, 0xfff0b0], [1300, 0.5, 0.95, 0, 0xfff0b0], [1700, 0.5, 0.42, 0.075, 0xfffbe0],
  [2440, 0.5, 0.3, 0.085, 0xfff6c8], [2700, 0.5, 0.27, 0.11, 0xfff0a0], [3340, 0.5, 0.2, 0.125, 0xffc070],
  [3341, 0.38, 0.6, 0.06, 0xf4f0d8], [5000, 0.38, 0.6, 0.06, 0xf4f0d8], [5300, 0.38, 0.5, 0, 0xf4f0d8],
  [5301, 0.5, 0.12, 0.07, 0xffb08a], [5650, 0.5, 0.26, 0.07, 0xfff0c8], [6000, 0.5, 0.95, 0, 0xfff0b0]];
const TUNNEL = { fog: 0x0a0b16, hemiSky: 0xbfe8ff, hemiI: 1.15, sunI: 1.0, coin: 3, rim: 1 };
const RIM = 0xffb020;                          // obstacle outline colour at rim = 1 (ink at 0)  // blended in by the tunnel factor

export function districtInfo(d) {            // -> [id, segment index inside the district, start metre]
  if (d < 0) return ['midtown', -1, 0];
  const s = d % LOOP;
  let i = 0;
  while (i + 1 < DISTRICTS.length && s >= DISTRICTS[i + 1][1]) i++;
  return [DISTRICTS[i][0], Math.floor((s - DISTRICTS[i][1]) / 20), DISTRICTS[i][1]];
}
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
export function tunnelAt(d) {                // 0 outside .. 1 inside (30 m ramps at both mouths)
  if (d < 0) return 0;
  const s = d % LOOP;
  return ss(3330, 3360, s) * (1 - ss(3670, 3700, s));
}
const lerp = (a, b, t) => a + (b - a) * t;
const ca = new THREE.Color(), cb = new THREE.Color();
const mixHex = (a, b, t) => ca.setHex(a).lerp(cb.setHex(b), t).getHex();
function blend(a, b, t) {
  const o = {};
  for (const k in a) o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : COLOURS.has(k) ? mixHex(a[k], b[k], t) : lerp(a[k], b[k], t);
  return o;
}
const COLOURS = new Set(['skyTop', 'skyMid', 'horizon', 'fog', 'far', 'near', 'win', 'hemiSky', 'hemiGround', 'sun', 'tint', 'dotTint', 'water']);
export function phaseAt(d) {
  const s = ((d % LOOP) + LOOP) % LOOP;
  for (let i = 0; i < PHASE_KEYS.length - 1; i++) {
    const [d0, p0] = PHASE_KEYS[i], [d1, p1] = PHASE_KEYS[i + 1];
    if (s <= d1) return blend(p0, p1, (s - d0) / (d1 - d0));
  }
  return DAY;
}
function discAt(d) {
  const s = ((d % LOOP) + LOOP) % LOOP;
  for (let i = 0; i < DISC_KEYS.length - 1; i++) {
    const a = DISC_KEYS[i], b = DISC_KEYS[i + 1];
    if (s <= b[0]) { const t = (s - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), mixHex(a[4], b[4], t)]; }
  }
  return DISC_KEYS[0].slice(1);
}

// ------------------------------------------------------------------ geometry helpers (= city.js)
const SY = -11, INK = 0x1c1016;
const _c = new THREE.Color();
const shade = (y) => (y < 0 ? lerp(0.62, 0.9, THREE.MathUtils.clamp((y - SY) / -SY, 0, 1)) : 0.9 + 0.1 * Math.min(1, y / 20));
function fin(L, g, color, cx, cy, cz, rx = 0, ry = 0, rz = 0) {
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
  g.translate(cx, cy, cz); g.deleteAttribute('uv');
  const p = g.attributes.position, a = new Float32Array(p.count * 3);
  _c.setHex(color);
  for (let i = 0; i < p.count; i++) { const k = L.flat ? 1 : shade(p.getY(i)); a[i * 3] = _c.r * k; a[i * 3 + 1] = _c.g * k; a[i * 3 + 2] = _c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  L.push(g);
}
const pBox = (L, cx, cy, cz, sx, sy, sz, col, rx, ry, rz) => fin(L, new THREE.BoxGeometry(sx, sy, sz, 1, 1, Math.max(1, Math.round(sz / 5))), col, cx, cy, cz, rx, ry, rz);
const pCyl = (L, cx, cy, cz, rT, rB, h, seg, col, rx, ry, rz) => fin(L, new THREE.CylinderGeometry(rT, rB, h, seg, 1), col, cx, cy, cz, rx, ry, rz);
const pSph = (L, cx, cy, cz, r, sy, col) => fin(L, new THREE.SphereGeometry(r, 8, 6).scale(1, sy, 1), col, cx, cy, cz);
const glowList = () => { const L = []; L.flat = true; return L; };   // unlit pieces: no height shade
// textured quad facing +z before ry; rect = [px, py, pw, ph] in an atlas of W x H pixels
function sQuad(L, w, h, x, y, z, ry, rect, W = 1024, H = 1024) {
  const g = new THREE.PlaneGeometry(w, h);
  const [px, py, pw, ph] = rect, uv = g.attributes.uv;
  for (let i = 0; i < 4; i++) uv.setXY(i, (px + uv.getX(i) * pw) / W, 1 - (py + (1 - uv.getY(i)) * ph) / H);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  L.push(g);
}
const merge = (L) => (L.length ? mergeGeometries(L.map((g) => (g.index ? g.toNonIndexed() : g))) : null);
const kit = (o) => { const r = {}; for (const k in o) { const g = merge(o[k]); if (g) r[k] = g; } return r; };

// ------------------------------------------------------------------ atlases made here
// "tabela" 1024 x 1024: 6 district name boards 512 x 128 (rows 0-2), 8 Chinatown shop names 512 x 64 (y 384-640)
export const NAMES = [['CHINATOWN', 'FENERLER YANDI', '#e8312f', '#f6c64a'], ['KÖPRÜ', 'DERİN NEFES AL', '#ff8a5c', '#ffd36b'],
  ['METRO', 'SONRAKİ DURAK: GECE', '#2f80c4', '#f2b632'], ['NEON MEYDAN', 'ŞEHİR UYUMAZ', '#ff2fa8', '#22e6ff'],
  ['MIDTOWN', 'GÜNAYDIN ŞEHİR', '#2f80ed', '#ffd23a'], ['ÖRÜMCEK CAD.', 'PERON 1', '#2f80c4', '#f3ecd9']];
export const SHOPS = ['EJDER DÖNER', "WOK'N ROLL", 'ÇAYCI WONG', 'KUNG FU KUAFÖR', 'PANDA BÜFE', 'ŞANGHAY MANTI', 'BAMBU TERZİ', 'NOODLE USTA'];
const nameRect = (i) => [(i % 2) * 512, Math.floor(i / 2) * 128, 512, 128];
const shopRect = (i) => [(i % 2) * 512, 384 + Math.floor(i / 2) * 64, 512, 64];
export function drawTabela(g) {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  NAMES.forEach(([t, sub, c1, c2], i) => {
    const [x, y, W, H] = nameRect(i);
    g.fillStyle = '#14162a'; g.fillRect(x, y, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = `78px ${T.FONT_H}`;
    g.lineWidth = 18; g.strokeStyle = c1; g.globalAlpha = 0.35; g.strokeText(t, x + W / 2, y + 50);
    g.globalAlpha = 1; g.lineWidth = 7; g.strokeText(t, x + W / 2, y + 50);
    g.fillStyle = '#fff'; g.fillText(t, x + W / 2, y + 50);
    g.font = "800 20px 'Baloo 2', sans-serif"; g.fillStyle = c2; g.fillText(sub, x + W / 2, y + 106);
    g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(x + 5, y + 5, W - 10, H - 10);
  });
  const BG = ['#c8202f', '#1f6f6b', '#f6c64a', '#7a1620'], FG = ['#f6c64a', '#f3e2c0', '#7a1620', '#f6c64a'];
  const r = T.rng(3303);
  SHOPS.forEach((t, i) => {
    const [x, y, W, H] = shopRect(i);
    g.fillStyle = BG[i % 4]; g.fillRect(x, y, W, H);
    g.strokeStyle = FG[i % 4]; g.lineWidth = 4; g.strokeRect(x + 5, y + 5, W - 10, H - 10);
    g.save(); g.strokeStyle = FG[i % 4]; g.fillStyle = FG[i % 4]; T.glyph(g, x + 36, y + 32, 34, r); T.glyph(g, x + W - 36, y + 32, 34, r); g.restore();
    g.font = `46px ${T.FONT_H}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = FG[i % 4];
    g.fillText(t, x + W / 2, y + 35);
  });
}
// Bugle atlas (prototype: 1024 x 1024 = 8 slots of 512 x 256; the real one is 2048 x 1024 = 16 slots)
const slot = (i) => [(i % 2) * 512, Math.floor(i / 2) * 256, 512, 256];
export function drawBugle(g, name, best, list) {
  const page = (i, kicker, headline, sub, photo) => T.drawBuglePage(g, ...slot(i), { kicker, headline, sub, photo });
  page(0, 'SON DAKİKA', name + ' YİNE KAÇTI!', 'Venom eli boş döndü · Sayfa 3');
  T.drawRecordBoard(g, ...slot(1), name, best);
  T.drawTopFive(g, ...slot(2), list, name);
  page(3, 'GECE BASKISI', name + ' GECEYİ GÖRDÜ!', 'Şehir uyuyor, o koşuyor');
  page(4, 'CANLI', 'REKORA 1.000 KALDI!', 'Jameson kahvesini döktü');
  page(5, 'TEHLİKE', 'VENOM AÇ KALDI', 'Uzmanlar: "Koşun" diyor', 'venom');
  page(6, 'REZALET', 'SENDELEDİ! FOTOĞRAFI BİZDE', 'Görgü tanığı: "Güldüm"');
  page(7, 'EKONOMİ', 'x12 ÇARPAN: PİYASA SARSILDI', 'Altın fiyatları ' + name + "'e bağlı");
}

// ------------------------------------------------------------------ CHINATOWN
const RED = 0xc8202f, GOLD = 0xf6c64a, JADE = 0x2f9e7a, LAQ = 0x7a1620, PAPER = 0xe8312f;
function lantern(P, G, x, y, z, r = 0.3) {    // y = centre of the paper body
  pSph(G, x, y, z, r, 0.85, PAPER);
  pCyl(P, x, y + r * 0.82, z, r * 0.45, r * 0.6, 0.09, 8, GOLD);
  pCyl(P, x, y - r * 0.82, z, r * 0.6, r * 0.45, 0.09, 8, GOLD);
  pBox(P, x, y - r * 0.82 - 0.2, z, 0.05, 0.32, 0.05, GOLD);
}
// one string across the street: two straight ink lines from the facades (x +-7.5, y 12.6) to the
// middle (y 11.0), 9 lanterns 1.5 m apart hanging 0.42 m under the line. Lowest point 9.9 > CLEAR_Y.
function lanternString(P, G, z, n = 4) {
  for (const s of [-1, 1]) pBox(P, s * 3.75, 11.8, z, 7.67, 0.04, 0.04, INK, 0, 0, s * 0.21);
  for (let i = -n; i <= n; i++) lantern(P, G, i * 1.5, 11.0 + 1.6 * Math.abs(i * 1.5) / 7.5 - 0.42, z);
}
// Ejder Kapısı (paifang), placed at the near edge of the first Chinatown segment (z = +10)
function gate() {
  const P = [], G = glowList(), S = [];
  for (const s of [-1, 1]) {
    pBox(P, s * 5.6, 1.4, 0, 1.0, 24.8, 1.0, RED);                 // column, street (-11) .. 13.8
    pBox(P, s * 5.6, -0.3, 0, 1.5, 1.4, 1.5, 0xcfc8bb);           // stone drum at deck level
    pBox(P, s * 5.6, 10.2, 0, 1.4, 0.4, 1.4, GOLD);               // ring under the beam
    pBox(P, s * 8.3, 10.9, 0, 4.4, 0.6, 0.7, RED);                // wing beam, x 6.1 .. 10.5
    pBox(P, s * 10.3, 0, 0, 0.7, 22, 0.7, RED);                   // outer post
    pBox(P, s * 8.4, 11.7, 0, 5.4, 0.3, 2.4, JADE, 0, 0, s * 0.1); // wing roof, tips up outwards
    pBox(P, s * 8.3, 11.35, 0, 4.4, 0.25, 0.5, GOLD);
    pBox(P, s * 7.75, 15.05, 0, 1.9, 0.3, 3.0, JADE, 0, 0, s * 0.45); // upturned eave of the main roof
    pBox(P, s * 5.6, 15.5, 0, 0.5, 0.6, 0.5, GOLD);               // ridge finial
    lantern(P, G, s * 4.95, 9.95, 0, 0.42);                       // big lantern under the beam, outside the lanes
  }
  pBox(P, 0, 11.0, 0, 12.2, 0.8, 0.9, RED);                        // lower beam, underside 10.6
  pBox(P, 0, 12.5, -0.15, 8.6, 2.2, 0.3, LAQ);                     // name board backing
  pBox(P, 0, 13.8, 0, 12.2, 0.6, 0.9, RED);                        // upper beam
  for (let i = -2; i <= 2; i++) pBox(P, i * 2.4, 14.3, 0, 0.6, 0.4, 1.3, GOLD);   // brackets
  pBox(P, 0, 14.7, 0, 14.0, 0.35, 3.0, JADE);                      // main roof
  pBox(P, 0, 15.15, 0, 11.0, 0.35, 0.4, GOLD);                     // ridge
  sQuad(S, 8, 2, 0, 12.5, 0.02, 0, nameRect(0));
  return kit({ plain: P, glow: G, tabela: S });
}
// street dressing of one Chinatown segment (v = 0 / 1)
function ctDress(v) {
  const P = [], G = glowList(), S = [];
  lanternString(P, G, v ? -6 : -4);
  lanternString(P, G, v ? 4 : 6);
  const COL = [PAPER, GOLD, 0x1f6f6b, LAQ];
  for (let i = 0; i < 4; i++) {                                    // hanging vertical signs on brackets, readable from the track
    const s = i % 2 ? 1 : -1, z = -8 + i * 5 + v * 1.5, y = 5.2 + (i % 3) * 0.9;
    pBox(P, s * 6.9, y + 2.0, z, 1.9, 0.08, 0.08, INK);
    pBox(G, s * 6.3, y, z, 0.95, 3.6, 0.16, COL[(i + v) % 4]);
    for (let k = -1; k <= 1; k++) for (const f of [-1, 1]) pBox(G, s * 6.3, y + k * 1.1, z + f * 0.09, 0.6, 0.6, 0.02, (i + v) % 4 === 1 ? LAQ : GOLD);
  }
  for (const [s, z, i] of [[-1, 2.5, v * 2], [1, -3.5, v * 2 + 1]]) {      // shop name boards, face the track
    pBox(P, s * 7.02, 2.2, z, 0.12, 1.0, 6.3, INK);
    sQuad(S, 6, 0.75, s * 6.95, 2.2, z, -s * Math.PI / 2, shopRect(i));
  }
  const s = v ? 1 : -1;                                             // laundry line along one facade
  pBox(P, s * 6.6, 7.9, 0, 0.03, 0.03, 9, INK);
  [0xf7f1e4, 0xe8473a, 0x3ebd7a, 0xf2b632, 0x2f80ed].forEach((c, i) => pBox(P, s * 6.6, 7.5, -3.6 + i * 1.8, 0.04, 0.75, 0.95, c));
  return kit({ plain: P, glow: G, tabela: S });
}

// ------------------------------------------------------------------ BRIDGE
const STEEL = 0x3b4352, GIRD = 0x5a6472, STONE = 0xc9b79c;
// main cable height over the 800 m bridge; towers stand at 200 m and 600 m
export const cableY = (m) => (m <= 200 ? 3 + 27 * (m / 200) ** 2 : m >= 600 ? 3 + 27 * ((800 - m) / 200) ** 2 : 6 + 24 * (2 * (m - 200) / 400 - 1) ** 2);
function cableSeg(k) {                         // segment k of 40: near edge at 20 k, far edge at 20 k + 20
  const P = [], G = glowList();
  const yA = cableY(20 * k), yB = cableY(20 * k + 20);
  for (const s of [-1, 1]) {
    pBox(P, s * 5.0, (yA + yB) / 2, 0, 0.45, 0.45, Math.hypot(20, yB - yA) + 0.3, STEEL, Math.atan2(yB - yA, 20));
    for (let j = 0; j < 8; j++) {                                  // suspenders every 2.5 m: the zoetrope
      const z = 8.75 - 2.5 * j, y = yA + (yB - yA) * (10 - z) / 20;
      if (y > 1.6) pBox(P, s * 5.0, (y + 1.0) / 2, z, 0.07, y - 1.0, 0.07, STEEL);
    }
    pBox(P, s * 4.6, -0.6, 0, 0.3, 1.4, 20, GIRD);                // edge girder
    pBox(P, s * 4.6, -3.4, 0, 0.25, 0.25, 20, GIRD);              // lower chord
    for (let j = 0; j < 4; j++) pBox(P, s * 4.6, -2.0, -7.5 + 5 * j, 0.18, 0.18, 5.7, GIRD, (j % 2 ? 1 : -1) * 0.5);
    if (k % 2 === 0) {                                             // lamp post every 40 m per side
      pCyl(P, s * 4.45, 3.2, 0, 0.07, 0.09, 4.0, 6, 0x2c2f36);
      pBox(G, s * 4.45, 5.3, 0, 0.5, 0.3, 0.5, 0xffd36b);
    }
  }
  for (const z of [-5, 5]) pBox(P, 0, -1.7, z, 9.4, 0.5, 0.5, 0x4c5562);   // cross beams under the deck
  return kit({ plain: P, glow: G });
}
// stone tower with one pointed arch over the three lanes; placed at the near edge (z = +10)
function tower() {
  const P = [];
  const sh = new THREE.Shape();
  sh.moveTo(-9.6, -42); sh.lineTo(9.6, -42); sh.lineTo(9.6, 31); sh.lineTo(-9.6, 31); sh.closePath();
  const h = new THREE.Path();
  h.moveTo(-5.4, -41.9); h.lineTo(-5.4, 13); h.quadraticCurveTo(-5.4, 20.5, 0, 24); h.quadraticCurveTo(5.4, 20.5, 5.4, 13); h.lineTo(5.4, -41.9); h.closePath();
  sh.holes.push(h);
  fin(P, new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false, curveSegments: 6 }), STONE, 0, 0, -2.5);
  pBox(P, 0, 31.6, 0, 20.6, 1.2, 6.0, 0xd9c9ae);                   // cornice
  pBox(P, 0, 32.5, 0, 19.2, 0.6, 5.0, STONE);
  for (const s of [-1, 1]) {
    pBox(P, s * 7.5, 25, 2.52, 1.1, 4.4, 0.08, 0x6e5f4c);         // slit window + pointed top
    pBox(P, s * 7.5, 27.2, 2.52, 0.78, 0.78, 0.08, 0x6e5f4c, 0, 0, Math.PI / 4);
    for (let y = -6; y <= 22; y += 4) pBox(P, s * 7.5, y, 2.52, 4.2, 0.14, 0.06, 0xa8967c);   // stone courses
    pBox(P, s * 5.43, 6, 2.52, 0.14, 14, 0.06, INK);              // ink edge of the arch jamb
  }
  return kit({ plain: P });
}
function vapur() {                             // the ferry far below (x 30, water at y -40)
  const P = [], x = 30, y = -40;
  pBox(P, x, y + 1.0, 0, 6, 2.0, 24, 0xf2f2f2);
  pBox(P, x, y + 0.3, 0, 6.1, 0.6, 24.1, 0x1c3f6e);
  pBox(P, x, y + 2.9, 1, 4.6, 1.8, 15, 0xf7f1e4);
  pBox(P, x, y + 3.0, 1, 4.7, 0.5, 14, 0x2b4562);
  pBox(P, x, y + 4.3, 2, 3.2, 1.0, 6, 0xf2f2f2);
  pCyl(P, x, y + 6.0, -1, 0.8, 0.9, 2.6, 10, 0xf2b632);
  pCyl(P, x, y + 7.0, -1, 0.82, 0.82, 0.6, 10, 0x12161f);
  return kit({ plain: P });
}

// ------------------------------------------------------------------ SUBWAY
// inner cross-section, left wall foot to right wall foot; 1 m spare above the highest swing (8.8 m)
const SEC = [[-4.7, -1], [-4.7, 6], [-3.4, 9], [-1.3, 10.4], [1.3, 10.4], [3.4, 9], [4.7, 6], [4.7, -1]];
const FACE_LIGHT = [0.55, 0.8, 1, 1, 1, 0.8, 0.55];
// inward-facing shell; vertex colours carry the light rhythm (lamp every 5 m), map = tunnel atlas.
// open = true leaves the right wall and right haunch out (station side).
function shellGeo(open) {
  const pos = [], col = [], uv = [], idx = [];
  const dark = new THREE.Color(0x0b0e22), lit = new THREE.Color(0x3d6c98), c = new THREE.Color();
  for (let f = 0; f < 7 - (open ? 2 : 0); f++) {
    const [x0, y0] = SEC[f], [x1, y1] = SEC[f + 1];
    for (let j = 0; j < 8; j++) {                                   // 2.5 m slices: dark at z -10, -5, 0, 5, bright between
      const zA = 10 - j * 2.5, zB = zA - 2.5, base = pos.length / 3, cell = (Math.floor(j / 2) + f) % 3;
      for (const [x, y, z, u, v] of [[x0, y0, zA, 0, 0], [x0, y0, zB, 1, 0], [x1, y1, zB, 1, 1], [x1, y1, zA, 0, 1]]) {
        pos.push(x, y, z);
        const b = (j % 2 ? (z === zA ? 1 : 0.3) : (z === zA ? 0.3 : 1)) * FACE_LIGHT[f];
        c.copy(dark).lerp(lit, b); col.push(c.r, c.g, c.b);
        uv.push((cell + (j % 2 ? u * 0.5 + 0.5 : u * 0.5)) / 4, 1 - (1 - v) / 2);   // one concrete cell per 5 m
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function tunnelLights(G, open) {
  for (const z of [-7.5, -2.5, 2.5, 7.5]) pBox(G, 0, 10.33, z, 0.7, 0.08, 1.8, 0xc8f8ff);     // ceiling lamps
  for (const s of open ? [-1] : [-1, 1]) {
    pBox(G, s * 4.64, 3.3, 0, 0.06, 0.12, 20, 0x5ff3ff);          // cyan line
    pBox(G, s * 4.64, 0.9, 0, 0.06, 0.08, 20, 0xff2fa8);          // magenta line
    for (const z of [-10, 0]) pBox(G, s * 4.6, 2.5, z, 0.2, 7, 0.5, 0x0c0e1e);    // ribs (dark, strobe past)
  }
  for (const z of [-10, 0]) pBox(G, 0, 10.3, z, 2.6, 0.2, 0.5, 0x0c0e1e);
}
function shell() { const G = glowList(); tunnelLights(G, false); return { tunnel: shellGeo(false), glow: merge(G) }; }
// station: the right side opens onto a lit platform with a silhouette crowd (n people)
function station(n) {
  const G = glowList(), S = [], SIL = 0x14162a;
  tunnelLights(G, true);
  pBox(G, 8.7, 0.0, 0, 8.6, 2.0, 20, 0x8a8d96);                   // platform, top y 1.0, edge x 4.4
  pBox(G, 4.55, 1.02, 0, 0.3, 0.05, 20, 0xffe23a);                // safety line
  pBox(G, 7.2, 10.5, 0, 11.8, 0.2, 20, 0x2a2f48);                 // station ceiling
  for (const z of [-7.5, -2.5, 2.5, 7.5]) {
    pBox(G, 5.4, 5.7, z, 0.35, 9.4, 0.35, 0x2f80c4);              // columns
    pBox(G, 9.0, 10.3, z, 5.0, 0.12, 0.5, 0xffe9b0);              // warm platform lights
  }
  for (let i = 0; i < 4; i++) {                                     // tiled back wall, 5 m per cell
    const cell = [3, 4, 5, 6][i];
    sQuad(S, 5, 5, 12.98, 3.5, 7.5 - i * 5, -Math.PI / 2, [(cell % 4) * 256, Math.floor(cell / 4) * 256, 256, 256], 1024, 512);
    sQuad(S, 5, 4.4, 12.98, 8.2, 7.5 - i * 5, -Math.PI / 2, [768, 0, 256, 180], 1024, 512);
  }
  const r = T.rng(77 + n);
  for (let i = 0; i < n; i++) {                                     // silhouette people on the platform
    const x = 6.4 + r() * 4.6, z = -9 + (i + r() * 0.6) * (18 / n), sc = 0.9 + r() * 0.25;
    pBox(G, x, 1.0 + 0.4 * sc, z, 0.4, 0.8 * sc, 0.28, SIL);
    pBox(G, x, 1.0 + 1.18 * sc, z, 0.56, 0.76 * sc, 0.32, SIL);
    pSph(G, x, 1.0 + 1.78 * sc, z, 0.21, 1, i === 2 ? 0xd8262c : SIL);   // one kid in a red cap
    if (i === 2) pBox(G, x - 0.38, 1.0 + 1.75 * sc, z, 0.14, 0.6, 0.14, SIL, 0, 0, 0.5);   // ... waving
    if (i === 4) pBox(G, x - 0.3, 1.0 + 1.3 * sc, z, 0.02, 0.16, 0.1, 0xffffff);          // phone glow
  }
  return { tunnel: shellGeo(true), glow: merge(G), tunnelFlat: merge(S) };
}
// concrete headwall with the mouth cut out; 2 m thick, placed at the near edge (z = +10 .. +12)
function mouth() {
  const P = [], G = glowList(), S = [];
  const sh = new THREE.Shape();
  sh.moveTo(-44, -42); sh.lineTo(44, -42); sh.lineTo(44, 21); sh.lineTo(-44, 21); sh.closePath();
  const h = new THREE.Path();
  SEC.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
  h.closePath(); sh.holes.push(h);
  fin(P, new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false }), 0x8a8d96, 0, 0, 0);
  pBox(P, 0, 21.4, 1, 88, 0.8, 2.6, 0x6b6f78);                     // parapet
  for (let f = 0; f < 7; f++) {                                     // hazard band around the mouth
    const [x0, y0] = SEC[f], [x1, y1] = SEC[f + 1], L = Math.hypot(x1 - x0, y1 - y0);
    const nx = (y1 - y0) / L, ny = -(x1 - x0) / L;                  // outward normal of the section
    pBox(P, (x0 + x1) / 2 - nx * 0.35, (y0 + y1) / 2 - ny * 0.35, 2.05, L + 0.5, 0.7, 0.12, f % 2 ? 0x12161f : 0xf2b632, 0, 0, Math.atan2(y1 - y0, x1 - x0));
  }
  pBox(P, 0, 13.3, 2.05, 8.6, 2.5, 0.2, 0x12161f);                 // name board backing
  sQuad(S, 8, 2, 0, 13.3, 2.17, 0, nameRect(2));
  pCyl(G, 0, 17.4, 2.1, 1.7, 1.7, 0.2, 20, 0x2f80c4, Math.PI / 2); // blue roundel
  for (const [x, rz] of [[-0.75, 0], [0.75, 0], [-0.37, -0.5], [0.37, 0.5]]) pBox(G, x, 17.4 + (rz ? 0.25 : 0), 2.22, 0.3, rz ? 1.3 : 1.9, 0.06, 0xffffff, 0, 0, rz);   // "M"
  return kit({ plain: P, glow: G, tabela: S });
}

// ------------------------------------------------------------------ NEON MEYDAN
const FRAME = 0x2a2a33, TUBE = [0xff2fa8, 0x22e6ff, 0xffe23a, 0x8cff3a];
// board w x h centred at (x, y, z), turned ry; lists: P frame, G neon tube border, S picture
function board(P, G, S, x, y, z, ry, w, h, rect, i = 0, W, H) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs];
  let p = at(0, 0, -0.2); pBox(P, p[0], p[1], p[2], w + 0.5, h + 0.5, 0.3, FRAME, 0, ry);
  for (const [lx, ly, sx, sy] of [[0, h / 2 + 0.12, w + 0.3, 0.12], [0, -h / 2 - 0.12, w + 0.3, 0.12], [w / 2 + 0.12, 0, 0.12, h + 0.3], [-w / 2 - 0.12, 0, 0.12, h + 0.3]]) {
    p = at(lx, ly, 0); pBox(G, p[0], p[1], p[2], sx, sy, 0.12, TUBE[i % 4], 0, ry);
  }
  p = at(0, 0, 0.02); sQuad(S, w, h, p[0], p[1], p[2], ry, rect, W, H);
}
const adRect = (i) => [(i % 2) * 512, 512 + Math.floor(i / 2) * 256, 512, 256];
// billboard arch right after the tunnel: the hero Bugle board; placed at z = 0 of the first Neon segment
function gantry() {
  const P = [], G = glowList(), S = [], B = [];
  for (const s of [-1, 1]) {
    pBox(P, s * 9.6, 0.4, 0, 0.9, 22.8, 0.9, FRAME);
    pBox(P, s * 7.4, 9.4, 0, 5.2, 0.25, 0.25, FRAME, 0, 0, s * 0.75);
  }
  pBox(P, 0, 11.5, 0, 20.1, 0.7, 0.9, FRAME);
  board(P, G, B, 0, 16.2, 0.3, 0, 16, 8, slot(3), 0);              // Bugle slot "GECEYİ GÖRDÜ", bottom edge 12.2
  for (let i = -8; i <= 8; i++) for (const y of [11.95, 20.45]) pBox(G, i, y, 0.45, 0.3, 0.3, 0.3, i % 2 ? 0xffe23a : 0xff2fa8);   // bulb rows
  pBox(P, 0, 22.3, 0, 12.6, 3.3, 0.3, FRAME);
  sQuad(S, 12, 3, 0, 22.3, 0.17, 0, nameRect(3));
  return kit({ plain: P, glow: G, tabela: S, bugle: B });
}
// boards of one Neon segment (v = 0 .. 2): two tiers, both sides, turned 0.35 rad to the track
function neonDress(v) {
  const P = [], G = glowList(), A = [], B = [];
  const spots = [[-1, 6, 11.6], [1, -4, 11.6], [-1, -6, 16.6], [1, 4, 16.6]];
  spots.forEach(([s, z, y], i) => {
    const bugle = (i + v) % 3 === 0;
    board(P, G, bugle ? B : A, s * 9.6, y, z, -s * 0.35, 8, 4, bugle ? slot((i * 3 + v * 5) % 8) : adRect((i + v) % 4), i + v);
    pBox(P, s * 11, y, z - 1.2, 6, 0.3, 0.3, FRAME);               // strut back to the facade
  });
  return kit({ plain: P, glow: G, ads: A, bugle: B });
}
function midtownSign() {                       // dawn gantry: back in Midtown
  const P = [], S = [];
  for (const s of [-1, 1]) pBox(P, s * 6.2, 0.5, 0, 0.5, 23, 0.5, 0x4c5562);
  pBox(P, 0, 11.6, 0, 12.9, 0.5, 0.5, 0x4c5562);
  pBox(P, 0, 13.4, 0, 8.6, 2.6, 0.25, 0x12161f);
  sQuad(S, 8, 2, 0, 13.4, 0.14, 0, nameRect(4));
  return kit({ plain: P, tabela: S });
}
// the Bugle blimp: hull 26 m long; banner (512 x 128 texture) under it
function blimp() {
  const P = [];
  fin(P, new THREE.SphereGeometry(1, 14, 10).scale(4.2, 4.2, 13), 0xf4f1e6, 0, 0, 0);
  fin(P, new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 1.2, 0.75).scale(4.28, 4.28, 13.2), 0xd8262c, 0, 0, 0);   // red belly band
  for (const rz of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) fin(P, new THREE.BoxGeometry(0.25, 4.6, 4.2), 0xd8262c, Math.sin(-rz) * 3.2, Math.cos(rz) * 3.2, 10.6, 0, 0, rz);
  pBox(P, 0, -4.7, -1, 1.8, 1.5, 5.5, 0x12161f);
  pBox(P, 0, -4.6, -1, 1.85, 0.5, 4.6, 0xffe9b0);
  pBox(P, 4.25, -0.4, 0, 0.3, 3.9, 12.8, 0x12161f);               // banner plate on the side that faces the runner (glyph quads: 11-3-modeller.md)
  return { plain: merge(P) };
}

// ------------------------------------------------------------------ sky: city layers fade out on the bridge, a low far shore fades in
// shore mask 1024 x 64: R = silhouette, G = lit windows. Sampled 3 times across the plane, v 0.195 .. 0.305 (horizon = 0.2).
export function drawShore(g) {
  const r = T.rng(606);
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 64);
  for (let x = 0; x < 1024;) {
    const w = 6 + r() * 18, h = 8 + r() * 26 + (r() < 0.08 ? 22 : 0);
    g.fillStyle = '#ff0000'; g.fillRect(x, 64 - h, w, h);
    if (r() < 0.1) g.fillRect(x + w / 2 - 1, 64 - h - 10, 2, 10);
    g.fillStyle = '#ffff00';
    for (let wy = 64 - h + 3; wy < 60; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < 0.3) g.fillRect(wx, wy, 2, 2);
    x += w;
  }
}
const SKY_FRAG = T.SKY_FRAG
  .replace('uniform float uDark;', 'uniform float uDark; uniform float uCity; uniform sampler2D uShoreTex;')
  .replace('vec3 col = mix(sky, uFar, m.r);', `vec4 sh = texture2D(uShoreTex, vec2(vUv.x * 3.0, (vUv.y - 0.195) / 0.11)) * step(0.195, vUv.y) * step(vUv.y, 0.305) * (1.0 - uCity);
  m.rgb *= uCity;
  vec3 col = mix(sky, uNear, sh.r);
  col = mix(col, uWin, sh.g * uWinOn);
  col = mix(col, uFar, m.r);`);
// 1 = city skyline, 0 = open sky with the far shore (bridge). Fades in the haze 2460-2600, returns unseen in the tunnel.
export function cityAt(d) { const s = ((d % LOOP) + LOOP) % LOOP; return 1 - ss(2460, 2600, s) * (1 - ss(3400, 3420, s)); }

// ------------------------------------------------------------------ apply to the running game
const U = { uHalftone: { value: 1 }, uDotTint: { value: new THREE.Color() }, uBaseTone: { value: 0 }, uSunLum: { value: 1 }, uWinOn: { value: 0 } };
export const K = { shift: 0, M: null, kits: null, raf: 0, sky: null };

function tex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
function facadeMat(day, glowDraw) {
  const m = toonMaterial(0xffffff, { map: tex(1024, 1024, day, [0.25, 0.25]), emissiveMap: tex(512, 512, glowDraw, [0.25, 0.25]), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
  m.onBeforeCompile = T.facadeHook(U);
  return m;
}

export function apply() {
  if (K.M) return K;
  const c0 = game.world.segments[0].city;
  let name = 'ÖRÜMCEK', list = [];
  try { name = (localStorage.getItem('spidey.name') || name).toLocaleUpperCase('tr-TR'); list = JSON.parse(localStorage.getItem('spidey.scores') || '[]'); } catch (e) { /* defaults */ }
  const best = list.reduce((m, e) => Math.max(m, e.s || 0), 0);
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  const neonTex = tex(1024, 1024, T.drawNeonAtlas);
  const M = K.M = {
    facade: { midtown: facadeMat(T.drawMidtownAtlas, T.drawMidtownGlow), chinatown: facadeMat(T.drawChinatownAtlas, T.drawChinatownGlow), neon: facadeMat(T.drawNeonAtlas, T.drawNeonGlow) },
    plain: c0.plain.material,                  // the city's own material: scenery tint reaches cars, roofs, street too
    glow: basic({ vertexColors: true }),
    tabela: basic({ map: tex(1024, 1024, drawTabela) }),
    bugle: basic({ map: tex(1024, 1024, (g) => drawBugle(g, name, best, list)) }),
    ads: basic({ map: neonTex }),
    tunnel: basic({ map: tex(1024, 512, T.drawTunnelAtlas), vertexColors: true }),
    tunnelFlat: basic({ map: tex(1024, 512, T.drawTunnelAtlas) }),
    water: basic({ map: tex(512, 512, T.drawWater, [9, 9]) }),
  };
  const mask = tex(2048, 512, (g) => T.drawSkylineMask(g), null, false);
  const col = () => ({ value: new THREE.Color() });
  K.sky = new THREE.ShaderMaterial({
    uniforms: { uMask: { value: mask }, uTop: col(), uMid: col(), uHorizon: col(), uFar: col(), uNear: col(), uWin: col(), uWinOn: { value: 0 },
      uSunCol: col(), uSun: { value: new THREE.Vector3() }, uStars: { value: 0 }, uDots: { value: 1 }, uDark: { value: 0 },
      uCity: { value: 1 }, uShoreTex: { value: tex(1024, 64, drawShore, [1, 1], false) } },
    vertexShader: T.SKY_VERT, fragmentShader: SKY_FRAG, depthWrite: false, fog: false,
  });
  game.city.skyline.material = K.sky;
  K.kits = {
    gate: gate(), ct: [ctDress(0), ctDress(1)], cable: Array.from({ length: 40 }, (_, k) => cableSeg(k)), tower: tower(), vapur: vapur(),
    shell: shell(), station: [station(4), station(8), station(5)], mouth: mouth(), gantry: gantry(), neon: [neonDress(0), neonDress(1), neonDress(2)],
    midtownSign: midtownSign(),
  };
  K.water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 60).rotateX(-Math.PI / 2), M.water);
  K.water.position.set(0, -40, -300);
  K.blimp = new THREE.Mesh(blimp().plain, toonMaterial(0xffffff, { vertexColors: true }));
  K.blimp.position.set(-34, 44, -120); K.blimp.rotation.y = -1.25;  // broadside: local +x (banner plate) faces the runner
  game.scene.add(K.water, K.blimp);
  K.hemi = game.scene.children.find((o) => o.isHemisphereLight);
  K.sun = game.scene.children.find((o) => o.isDirectionalLight);
  // protected gameplay materials (NOT SEEN in the browser): coins glow, obstacle outlines turn into an amber rim
  K.rims = [];
  game.scene.traverse((o) => {
    const m = o.material;
    if (!o.isInstancedMesh || !m) return;
    if (m.emissive && m.emissive.getHex() === 0x4a3000) K.coin = m;
    else if (m.isMeshBasicMaterial && m.side === THREE.BackSide && m.color.getHex() !== 0x4d2600 && !K.rims.some((r) => r.m === m)) K.rims.push({ m, base: m.color.getHex() });
  });
  K.off = game.world.onRecycle(assign);
  redress();
  const loop = () => { tick(); K.raf = requestAnimationFrame(loop); };
  loop();
  return K;
}

function assign(seg) {
  const c = seg.city;
  if (!c || !K.M) return;
  let h = seg.p113;
  if (!h) { h = seg.p113 = new THREE.Group(); seg.group.add(h); }
  h.clear();
  const [id, k] = districtInfo(seg.serial * 20 - 86 + K.shift);
  const cityOn = id !== 'bridge' && id !== 'tunnel';
  c.group.visible = cityOn;
  if (cityOn) c.facade.material = K.M.facade[id === 'dawn' ? 'midtown' : id];
  const add = (kt, z = 0, ry = 0) => {
    for (const key in kt) {
      const m = new THREE.Mesh(kt[key], K.M[key]);
      m.position.z = z; m.rotation.y = ry; m.matrixAutoUpdate = false; m.updateMatrix();
      h.add(m);
    }
  };
  const X = K.kits;
  if (id === 'chinatown') { if (k === 0) add(X.gate, 10); add(X.ct[k % 2]); }
  if (id === 'bridge') { add(X.cable[k]); if (k === 10 || k === 30) add(X.tower, 10); if (k === 6 || k === 24) add(X.vapur, 0, k === 24 ? Math.PI : 0); }
  if (id === 'tunnel') { if (k === 0) add(X.mouth, 10); if (k === 17) add(X.mouth, -10, Math.PI); add(k >= 8 && k <= 10 ? X.station[k - 8] : X.shell); }
  if (id === 'neon') { if (k === 0) add(X.gantry); else add(X.neon[k % 3]); }
  if (id === 'dawn' && k === 0) add(X.midtownSign, 10);
}
export function redress() { for (const seg of game.world.segments) assign(seg); }
export const dist = () => game.world.distance + K.shift;
export function goto(m) { K.shift = Math.round((m - game.world.distance) / 20) * 20; redress(); tick(); }

export function tick() {
  const d = dist(), p = phaseAt(d), t = tunnelAt(d), disc = discAt(d), sc = game.scene, M = K.M;
  const fog = mixHex(p.fog, TUNNEL.fog, t);
  sc.background.setHex(fog); sc.fog.color.setHex(fog); sc.fog.near = p.fogNear; sc.fog.far = p.fogFar;
  K.hemi.color.setHex(mixHex(p.hemiSky, TUNNEL.hemiSky, t)); K.hemi.groundColor.setHex(p.hemiGround); K.hemi.intensity = lerp(p.hemiI, TUNNEL.hemiI, t);
  K.sun.color.setHex(p.sun); K.sun.intensity = lerp(p.sunI, TUNNEL.sunI, t); K.sun.position.set(...p.sunPos);
  U.uHalftone.value = p.halftone; U.uDotTint.value.setHex(p.dotTint); U.uBaseTone.value = p.baseTone; U.uWinOn.value = p.winOn;
  U.uSunLum.value = p.sunI * (0.299 * K.sun.color.r + 0.587 * K.sun.color.g + 0.114 * K.sun.color.b) / Math.PI;
  for (const k in M.facade) { M.facade[k].emissiveIntensity = p.glow; M.facade[k].color.setHex(p.tint); }
  M.plain.color.setHex(p.tint);
  if (K.coin) K.coin.emissiveIntensity = lerp(p.coin, TUNNEL.coin, t);
  for (const r of K.rims) r.m.color.setHex(mixHex(r.base, RIM, lerp(p.rim, TUNNEL.rim, t)));
  M.glow.color.setScalar(lerp(0.8, 1, p.lamp));
  for (const k of ['tabela', 'bugle', 'ads']) M[k].color.setScalar(p.sign);
  M.water.color.setHex(p.water); M.water.map.offset.y = (d / 100) % 1;
  K.water.visible = districtInfo(d + 120)[0] === 'bridge' || districtInfo(d)[0] === 'bridge' || districtInfo(d - 60)[0] === 'bridge';
  K.blimp.visible = t < 0.5; K.blimp.position.x = -34 + Math.sin(performance.now() / 9000) * 6;
  K.blimp.material.color.setHex(p.tint);
  const u = K.sky.uniforms;
  u.uTop.value.setHex(p.skyTop); u.uMid.value.setHex(p.skyMid); u.uHorizon.value.setHex(p.horizon);
  u.uFar.value.setHex(p.far); u.uNear.value.setHex(p.near); u.uWin.value.setHex(p.win); u.uWinOn.value = p.skyWin;
  u.uSun.value.set(disc[0], disc[1], disc[2]); u.uSunCol.value.setHex(disc[3]); u.uStars.value = p.stars; u.uDots.value = p.skyDots; u.uDark.value = t; u.uCity.value = cityAt(d);
}
