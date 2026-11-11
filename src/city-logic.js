// src/city-logic.js — deterministic scenery tables and distance clock, independent of rendering.
import { CONFIG } from './config.js';

const C = CONFIG.city;
export const lanternLift = () => Math.max(0, CONFIG.swing.height + CONFIG.swing.arcRise + CONFIG.playerHeight + 1 - (11 - C.chinatown.bannerHeight));
export const ANCHOR_COUNTS = {
  ct0: 2, ct1: 2, ctEnd: 2, ctFest: 2, ctFestOdd: 2, ctFestEnd: 2,
  neon0: { ads: 2, bugle: 2 }, neon1: { ads: 3, bugle: 1 }, neon2: { ads: 3, bugle: 1 },
  gate: 1, mouth: 1, gantry: { tabela: 1, bugle: 1 }, midtownSign: 1,
};
const lerp = (a, b, t) => a + (b - a) * t;
const colours = new Set(['skyTop', 'skyMid', 'horizon', 'fog', 'far', 'near', 'win', 'hemiSky', 'hemiGround', 'sun', 'tint', 'water']);
export const loopMetre = (d) => ((d % C.loop) + C.loop) % C.loop;
export const loopOf = (d) => Math.floor(Math.max(0, d) / C.loop) + 1;
export const segCentre = (serial) => serial * 20 - 86;
export const ROW_HOME = { gap: ['bridge'], gate: ['tunnel'], girder: ['midtown', 'neon', 'dawn'] };
export const cityHash = (n) => { const h = Math.sin(n * 127.1) * 43758.5453; return h - Math.floor(h); };
const flavors = [
  { weather: null, festival: false }, { weather: null, festival: true },
  { weather: 'rain', festival: false }, { weather: 'rain', festival: true },
  { weather: 'snow', festival: false }, { weather: 'snow', festival: true },
];
export function loopFlavor(loop) {
  const h = cityHash(loop), weather = loop <= 1 ? 0 : loop === 2 ? 2 : loop === 3 ? 4 : h < 0.5 ? 2 : h < 0.75 ? 4 : 0;
  return flavors[weather + (loop >= 2 && loop % 2 === 0 ? 1 : 0)];
}
export function weatherAt(loop, s, out = { kind: null, k: 0 }) {
  const r = C.weather;
  out.kind = loopFlavor(loop).weather;
  out.k = smoothstep(r[0], r[1], s) * (1 - smoothstep(r[2], r[3], s));
  return out;
}
export const celebrationKind = (phaseId, tunnelFactor) => tunnelFactor >= 0.1 ? 'wait' : phaseId === 'night' ? 'fireworks' : 'tape';

export function flockAt(d) {
  const F = C.life.flock;
  for (let b = Math.floor(Math.max(0, d) / F.block); ; b++) {
    if (cityHash(b * 7.3) >= F.chance) continue;
    const at = F.block * b + F.offset + F.spread * cityHash(b * 3.1), s = loopMetre(at), id = districtAt(at);
    if (at < Math.max(F.first, d) || (id !== 'midtown' && id !== 'chinatown' && id !== 'dawn')) continue;
    let border = s < F.border || C.loop - s < F.border;
    for (const r of C.districts) if (Math.abs(s - r[1]) < F.border) border = true;
    if (border) continue;
    return at;
  }
}

export function districtInfo(d) {
  if (d < 0) return ['midtown', -1, 0];
  const s = loopMetre(d), districts = C.districts;
  let i = 0;
  while (i + 1 < districts.length && s >= districts[i + 1][1]) i++;
  return [districts[i][0], Math.floor((s - districts[i][1]) / 20), districts[i][1]];
}
export function districtAt(d) {
  if (d < 0) return 'midtown';
  const s = loopMetre(d), districts = C.districts;
  let i = 0;
  while (i + 1 < districts.length && s >= districts[i + 1][1]) i++;
  return districts[i][0];
}
const dayNames = { midtown: 'day', chinatown: 'golden', bridge: 'sunset', tunnel: 'night', neon: 'night', dawn: 'dawn' };
export const dayPhaseAt = (d) => dayNames[districtAt(d)];

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function tunnelAt(d) {
  if (d < 0) return 0;
  const s = loopMetre(d), r = C.tunnel;
  return smoothstep(r[0], r[1], s) * (1 - smoothstep(r[2], r[3], s));
}
export function cityAt(d) {
  const s = loopMetre(d), r = C.cityFade;
  return 1 - smoothstep(r[0], r[1], s) * (1 - smoothstep(r[2], r[3], s));
}

const linear = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const srgb = (c) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
export function mixHex(a, b, t) {
  let hex = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const c = lerp(linear(((a >> shift) & 255) / 255), linear(((b >> shift) & 255) / 255), t);
    hex |= Math.round(srgb(c) * 255) << shift;
  }
  return hex;
}

// Optional output storage lets the renderer reuse the pure clock without frame allocations.
export function phaseAt(d, out = { sunPos: [0, 0, 0] }) {
  const s = loopMetre(d), keys = C.phaseKeys;
  let i = 0;
  while (i + 1 < keys.length - 1 && s > keys[i + 1][0]) i++;
  const a = C.phase[keys[i][1]], b = C.phase[keys[i + 1][1]];
  const t = (s - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  for (const k in a) {
    if (k === 'sunPos') for (let j = 0; j < 3; j++) out.sunPos[j] = lerp(a.sunPos[j], b.sunPos[j], t);
    else out[k] = colours.has(k) ? mixHex(a[k], b[k], t) : lerp(a[k], b[k], t);
  }
  return out;
}
export function discAt(d, out = [0, 0, 0, 0]) {
  const s = loopMetre(d), keys = C.discKeys;
  let i = 0;
  while (i + 1 < keys.length - 1 && s > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], t = (s - a[0]) / (b[0] - a[0]);
  for (let j = 0; j < 3; j++) out[j] = lerp(a[j + 1], b[j + 1], t);
  out[3] = mixHex(a[4], b[4], t);
  return out;
}

export function dressFor(id, k, loop) {
  const o = { chunk: true, facade: 'midtown', dress: null, portal: null };
  if (id === 'chinatown') {
    o.facade = 'chinatown';
    o.dress = loopFlavor(loop).festival ? 'ctFest' : `ct${k % 2}`;
    if (k === 0) o.portal = ['gate', 10, 0];
  } else if (id === 'bridge') {
    o.chunk = false; o.facade = null; o.dress = `cable${k}`;
    if (k === 10 || k === 30) o.portal = ['tower', 10, 0];
    if (k === 6 || k === 24) o.portal = ['vapur', 0, k === 24 ? Math.PI : 0];
  } else if (id === 'tunnel') {
    o.chunk = false; o.facade = null;
    o.dress = k >= 8 && k <= 10 ? `station${k - 8}` : 'shell';
    if (k === 0) o.portal = ['mouth', 10, 0];
    if (k === 17) o.portal = ['mouth', -10, Math.PI];
  } else if (id === 'neon') {
    o.facade = 'neon';
    if (k === 0) o.portal = ['gantry', 0, 0];
    else o.dress = `neon${k % 3}`;
  } else if (id === 'dawn' && k === 0) o.portal = ['midtownSign', 10, 0];
  return o;
}

export function districtEvent(lastId, d) {
  const at = lastId === null ? d : d + C.announceAhead;
  const id = districtAt(at);
  return id !== lastId ? { id, lap: loopOf(at) } : null;
}

export function createAnnouncer(emit) {
  let last = null;
  return {
    update(d) {
      const event = districtEvent(last, d);
      if (event) { last = event.id; emit('districtEnter', event); }
    },
    reset() { last = null; },
  };
}
