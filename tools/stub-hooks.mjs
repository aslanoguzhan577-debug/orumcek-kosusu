// tools/stub-hooks.mjs — node module resolver hooks so tools/test-skills.mjs can import
// src/player.js and the power-up systems headless. The browser gets `three` from index.html's
// import map and there is no node_modules here; world.js / curve.js are stubbed down to the two
// things player.js uses.
const CONFIG_URL = new URL('../src/config.js', import.meta.url).href;
const data = (src) => 'data:text/javascript,' + encodeURIComponent(src);

const THREE = data(`
const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } });
export class Group {
  constructor() { this.children = []; this.position = vec(); this.rotation = vec(); }
  add(c) { this.children.push(c); }
  remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
}
export class Box3 { constructor() { this.min = vec(); this.max = vec(); } }
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  normalize() { return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
}
// the maths types are only constructed at module load by the hero-special files; node never runs
// their update paths, so empty shapes are enough
export class Quaternion {}
export class Euler {}
export class Matrix4 {}
export class Color {}
export const MathUtils = { clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
`);
const WORLD = data(`
import { CONFIG } from '${CONFIG_URL}';
export const laneX = (lane) => (lane - (CONFIG.laneCount - 1) / 2) * CONFIG.laneWidth;
`);
const CURVE = data('export const curve = { bank: 0 };');
// pickup-art.js is pure THREE + canvas: node only needs the factories the power-ups register.
const PICKUP_ART = data(`
const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } });
const node = () => ({ position: vec(), rotation: vec(), scale: { setScalar() {} }, visible: true });
const item = () => ({ root: node(), update() {} });
export const createSwingPickup = item;
export const createWebPickup = item;
export const createBuglePickup = item;
export const createSpringPickup = item;
export const createDecoyPickup = item;
export const createWallPickup = item;
export const createTracerPickup = item;
export const createDecoyDummy = () => ({ root: node(), lean: { rotation: vec() }, update() {} });
export const createTracerDrone = () => ({ root: node(), update() {} });
export const createWallPanel = () => ({ root: node(), scrolled: 0, scroll(dz) { this.scrolled += dz; } });
export const createTracerRibbon = (n) => ({
  root: node(), max: n, segs: [], shown: 0,
  seg(i, x0, z0, x1, z1, w) { this.segs.push({ i, x0, z0, x1, z1, w }); },
  show(c) { this.shown = c; },
  update() {},
});
`);

export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { shortCircuit: true, url: THREE };
  if (spec.endsWith('/world.js')) return { shortCircuit: true, url: WORLD };
  if (spec.endsWith('/curve.js')) return { shortCircuit: true, url: CURVE };
  if (spec.endsWith('/pickup-art.js')) return { shortCircuit: true, url: PICKUP_ART };
  return next(spec, ctx);
}
