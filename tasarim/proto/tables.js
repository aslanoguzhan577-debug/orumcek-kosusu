// tasarim/proto/tables.js — the numbers of stage 11.3 as data (copy into src/config.js as
// CONFIG.city.phases / CONFIG.city.disc / CONFIG.city.districts; see tasarim/11-3-sehir.md).

// ---- day cycle: keyframes over one 6000 m loop, linear blend between neighbours ----
const DAY = {
  name: 'GÜNDÜZ', skyTop: 0x4aa8f0, skyMid: 0x8fd0ff, horizon: 0xc4e6ff, fog: 0x8fd0ff,
  far: 0xa9c6e6, near: 0x8fb0d8, win: 0xffffff, skyWin: 0.25,
  hemiSky: 0xdff1ff, hemiGround: 0x6b5d50, hemiI: 1.6, sun: 0xfff1dc, sunI: 2.2, sunPos: [-6, 12, 6],
  halftone: 0.85, baseTone: 0.0, dotTint: 0x4a5296, winOn: 0.0, glow: 0.0, neon: 0.0, stars: 0.0, skyDots: 1.0,
  fogNear: 45, fogFar: 160, rim: 0.0, coin: 1.0,
};
const GOLDEN = {
  name: 'ALTIN SAAT', skyTop: 0x5b7fd6, skyMid: 0xffb46b, horizon: 0xffd08a, fog: 0xffc08a,
  far: 0xd99a8a, near: 0xb7708a, win: 0xffe2a0, skyWin: 0.2,
  hemiSky: 0xffe2c0, hemiGround: 0x6a4a5a, hemiI: 1.45, sun: 0xffb066, sunI: 2.5, sunPos: [-10, 5, 7],
  halftone: 1.0, baseTone: 0.05, dotTint: 0x9a4f7a, winOn: 0.1, glow: 0.4, neon: 0.25, stars: 0.0, skyDots: 1.0,
  fogNear: 42, fogFar: 155, rim: 0.15, coin: 1.2,
};
const DUSK = {
  name: 'ALACAKARANLIK', skyTop: 0x2c2a6e, skyMid: 0xc8508a, horizon: 0xff8a5c, fog: 0xb0507a,
  far: 0x6a3f78, near: 0x4a2c5e, win: 0xffd27a, skyWin: 0.55,
  hemiSky: 0xc8a0e0, hemiGround: 0x3a2a4a, hemiI: 1.3, sun: 0xff8a6a, sunI: 1.9, sunPos: [-10, 4, 6],
  halftone: 1.0, baseTone: 0.15, dotTint: 0x5a3a8a, winOn: 0.55, glow: 0.85, neon: 0.7, stars: 0.3, skyDots: 0.7,
  fogNear: 40, fogFar: 150, rim: 0.35, coin: 1.6,
};
const NIGHT = {
  name: 'GECE', skyTop: 0x0b0d2e, skyMid: 0x1c1f5a, horizon: 0x3a2f78, fog: 0x24204f,
  far: 0x1d1d48, near: 0x15153a, win: 0xffd27a, skyWin: 0.9,
  hemiSky: 0x8f9bff, hemiGround: 0x5a2a6a, hemiI: 1.25, sun: 0xc0ccff, sunI: 1.6, sunPos: [7, 13, 7],
  halftone: 1.0, baseTone: 0.25, dotTint: 0x3a3a8a, winOn: 0.85, glow: 1.15, neon: 1.0, stars: 1.0, skyDots: 0.0,
  fogNear: 38, fogFar: 150, rim: 0.55, coin: 2.4,
};
const DAWN = {
  name: 'ŞAFAK', skyTop: 0x6b8fd8, skyMid: 0xf6b0c8, horizon: 0xffe0b8, fog: 0xf0c8d0,
  far: 0xb89ab8, near: 0x9a7aa8, win: 0xffe2a0, skyWin: 0.3,
  hemiSky: 0xffe0f0, hemiGround: 0x5a4a6a, hemiI: 1.45, sun: 0xffd0b0, sunI: 2.0, sunPos: [6, 6, 7],
  halftone: 0.95, baseTone: 0.08, dotTint: 0x8a6aa8, winOn: 0.3, glow: 0.5, neon: 0.35, stars: 0.15, skyDots: 0.8,
  fogNear: 44, fogFar: 158, rim: 0.15, coin: 1.3,
};
export const PHASES = [DAY, GOLDEN, DUSK, NIGHT, DAWN];
export const PHASE_LOOP = 6000;
// [loop metres, phase] ; between two keys every number / colour is lerped (colours in linear RGB)
export const PHASE_KEYS = [
  [0, DAY], [1400, DAY], [1900, GOLDEN], [2500, GOLDEN], [2900, DUSK], [3200, DUSK],
  [3600, NIGHT], [4900, NIGHT], [5300, DAWN], [5600, DAWN], [6000, DAY],
];
// sun / moon disc on the sky plane: [loop metres, u, v, radius, colour]; radius 0 = hidden
export const DISC_KEYS = [
  [0, 0.53, 0.95, 0, 0xfff0b0], [1400, 0.53, 0.95, 0, 0xfff0b0], [1900, 0.53, 0.32, 0.09, 0xfff0b0],
  [2500, 0.54, 0.28, 0.09, 0xffe08a], [2900, 0.55, 0.215, 0.085, 0xff7a4a], [3300, 0.55, 0.10, 0.085, 0xff5a3a],
  [3350, 0.36, 0.62, 0, 0xf4f0d8], [3700, 0.36, 0.62, 0.05, 0xf4f0d8], [4900, 0.36, 0.62, 0.05, 0xf4f0d8],
  [5050, 0.36, 0.62, 0, 0xf4f0d8], [5060, 0.44, 0.10, 0.07, 0xffb08a], [5400, 0.44, 0.24, 0.07, 0xfff0c8],
  [5800, 0.46, 0.60, 0.0, 0xfff0c8], [6000, 0.53, 0.95, 0, 0xfff0b0],
];

// ---- districts: one loop of 4700 m, Midtown first ----
export const DISTRICT_LOOP = [
  ['midtown', 1200], ['chinatown', 1200], ['bridge', 640], ['neon', 1260], ['subway', 400],
];

export const DISTRICT_PAL = {
  midtown: { brick: 0xc0553f, brown: 0x8a4f3c, cream: 0xf0cf7c, glass: 0x6ec6d9, stone: 0xcfc8bb, awning: 0xe8473a, cab: 0xf6c026 },
  chinatown: { lantern: 0xe8312f, gold: 0xf6c64a, jade: 0x2f9e7a, teal: 0x1f6f6b, cream: 0xf3e2c0, salmon: 0xe98b6d, mustard: 0xd9a63a, tile: 0x2f8f6a },
  bridge: { stone: 0xc9b79c, stoneShade: 0x9c8a72, cable: 0x3b4352, girder: 0x5a6472, water: 0x2f7fc0, foam: 0xbfe6ff, lampGlow: 0xffd36b },
  neon: { magenta: 0xff2fa8, cyan: 0x22e6ff, yellow: 0xffe23a, violet: 0x7b3cff, lime: 0x8cff3a, navy: 0x1e2140, charcoal: 0x2a2a33 },
  subway: { concrete: 0x8a8d96, tile: 0xf3ecd9, band: 0x2f80c4, gold: 0xf2b632, stripCyan: 0x5ff3ff, stripWarm: 0xffcf6a, dark: 0x0a0b16 },
};
