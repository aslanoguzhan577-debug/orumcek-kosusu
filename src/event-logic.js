import { CONFIG } from './config.js';
import { difficultyAt, endlessK } from './patterns.js';

const E = CONFIG.events, P = CONFIG.patterns;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const rAt = (d) => lerp(P.checkGapTime, P.minReaction, endlessK(difficultyAt(d)));
export const floorW = (delta, d) => rAt(d) + delta * (CONFIG.laneSwitchTime + E.switchSlack) + E.inputSlack;
const ease = (d) => Math.min(difficultyAt(d), P.difficultyMax) / P.difficultyMax;
export const warnAt = (d) => Math.max(floorW(1, d), lerp(E.warnEasy, E.warnHard, ease(d)) * lerp(1, E.warnEndless, endlessK(difficultyAt(d))));
export const restAt = (d) => lerp(E.restEasy, E.restHard, ease(d)) * lerp(1, E.restEndless, endlessK(difficultyAt(d)));
export const doubleChance = (d) => clamp((difficultyAt(d) - E.doubleFrom) / E.doubleSpan, 0, E.doubleMax);

// Always consume two draws so the event seed stays independent of the selected row.
export function nextRow(rng, safePrev, aim, d) {
  const roll = rng(), pick = rng();
  const cands = [];
  if (roll < doubleChance(d)) {
    for (let c = 0; c < 3; c++) if (c !== aim) cands.push([c !== 0, c !== 1, c !== 2]);
  }
  if (!cands.length) cands.push([aim === 0, aim === 1, aim === 2]);
  const deadly = cands[Math.min(cands.length - 1, Math.floor(pick * cands.length))];
  let delta = 0;
  for (let p = 0; p < 3; p++) {
    if (!safePrev[p]) continue;
    let near = 3;
    for (let c = 0; c < 3; c++) if (!deadly[c]) near = Math.min(near, Math.abs(p - c));
    delta = Math.max(delta, near);
  }
  return { deadly, delta, warn: Math.max(warnAt(d), floorW(delta, d)) };
}

export function nearestSafe(deadly, lane) {
  let best = lane, bestD = 9;
  for (let c = 0; c < 3; c++) {
    const dd = Math.abs(c - lane) + (c === 1 ? 0 : 0.01);
    if (!deadly[c] && dd < bestD) { best = c; bestD = dd; }
  }
  return best;
}

export const rewardFor = (kind, dodged, hits) => ({
  coins: dodged * (kind === 'venom' ? E.venom.coinPerDodge : E.goblin.coinPerRow) + (hits === 0 ? E[kind].cleanCoins : 0),
  mult: hits === 0 ? E.bonusClean : E.bonusHit,
  clean: hits === 0,
});
