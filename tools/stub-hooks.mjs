// tools/stub-hooks.mjs — node module resolver hooks so tools/test-skills.mjs can import
// src/player.js headless. The browser gets `three` from index.html's import map and there is
// no node_modules here; world.js / curve.js are stubbed down to the two things player.js uses.
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
export const MathUtils = { clamp: (v, a, b) => Math.min(b, Math.max(a, v)) };
`);
const WORLD = data(`
import { CONFIG } from '${CONFIG_URL}';
export const laneX = (lane) => (lane - (CONFIG.laneCount - 1) / 2) * CONFIG.laneWidth;
`);
const CURVE = data('export const curve = { bank: 0 };');

export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { shortCircuit: true, url: THREE };
  if (spec.endsWith('/world.js')) return { shortCircuit: true, url: WORLD };
  if (spec.endsWith('/curve.js')) return { shortCircuit: true, url: CURVE };
  return next(spec, ctx);
}
