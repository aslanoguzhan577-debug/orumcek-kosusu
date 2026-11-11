// src/city-logic.js — deterministic scenery tables and distance clock, independent of rendering.
import { CONFIG } from './config.js';

const C = CONFIG.city;
export const ANCHOR_COUNTS = {
  ct0: 2, ct1: 2, ctFest: 2,
  neon0: { ads: 2, bugle: 2 }, neon1: { ads: 3, bugle: 1 }, neon2: { ads: 3, bugle: 1 },
  gate: 1, mouth: 1, gantry: { tabela: 1, bugle: 1 }, midtownSign: 1,
};
const lerp = (a, b, t) => a + (b - a) * t;
const colours = new Set(['skyTop', 'skyMid', 'horizon', 'fog', 'far', 'near', 'win', 'hemiSky', 'hemiGround', 'sun', 'tint', 'dotTint', 'water']);
export const loopMetre = (d) => ((d % C.loop) + C.loop) % C.loop;
export const loopOf = (d) => Math.floor(Math.max(0, d) / C.loop) + 1;
export const segCentre = (serial) => serial * 20 - 86;

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
    o.dress = `ct${k % 2}`;
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
