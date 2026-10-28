// patterns.js — the track pattern generator. Pure logic (no Three.js) so that
// tools/check-patterns.mjs can test it in node.
//
// It works in "ground distance" d: metres along the track from the run start
// (the player is at d = world.distance). It produces plain descriptors:
//   { type: 'low'|'high'|'car', lane, d, len, color? }      d = near face
//   { type: 'wagons', lane, d, len, cars, ramp }            stationary cars, optional ramp first
//   { type: 'train', lane, d, len, cars, speed, spawnD }    oncoming: d = where the player
//                                                           meets its front, spawnD = where its
//                                                           front is when it appears
//   { type: 'coin', lane, d, y }                            y = absolute height of the coin centre
// obstacles.js turns them into objects in the scene.
//
// Fairness rule: there is always a "route" lane. On the route there is at most one
// passable obstacle (jump / slide / ramp) per block, spaced by reaction time at the
// expected speed. The route only moves one lane at a time, and only when both lanes are
// free for long enough to change lanes. Oncoming trains are never placed where the route
// could be until long after they have passed. Other lanes are filled randomly.
//
// All randomness comes from one seeded RNG (createRng), so a seed gives the same track.
//
// Pickups (G9 web cartridge, G10 Iron Spider core): register an extra with
//   generator.addExtra((ctx) => { ... ctx.push({ type: 'pickup', kind: 'web', lane, d, y }) })
// It is called once per block. ctx = { rng, A, B, speed, difficulty, route, routeFree, push }
// routeFree is [d0, d1], a stretch of the route lane in this block with no obstacle, or null.

import { CONFIG } from './config.js';

const LANES = CONFIG.laneCount;
const CENTER_LANE = Math.floor(LANES / 2);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// mulberry32: small, fast, good enough for level generation.
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

// Expected run speed when the player reaches ground distance d
// (speed grows linearly with time: v^2 = v0^2 + 2 a d).
export function speedAt(d) {
  const v = Math.sqrt(CONFIG.startSpeed * CONFIG.startSpeed + 2 * CONFIG.acceleration * Math.max(0, d));
  return Math.min(CONFIG.maxSpeed, v);
}

// Length along the track of an obstacle descriptor.
export function descLength(desc) {
  const O = CONFIG.obstacles;
  switch (desc.type) {
    case 'low': return O.low.depth;
    case 'high': return O.high.depth;
    case 'car': return O.car.length;
    case 'wagons':
    case 'train':
      return (desc.ramp ? O.rampLength : 0) + desc.cars * O.wagon.length + (desc.cars - 1) * O.wagon.gap;
    default: return 0;
  }
}

// Where an oncoming train's front is when it appears (see obstacles.js spawn rule),
// using the slowest speed the player can have then (= the longest sweep).
export function trainSpawnD(meetD, trainSpeed) {
  const spawn = CONFIG.obstacles.spawnDistance;
  const vLow = speedAt(meetD - spawn);
  return meetD + spawn * trainSpeed / (vLow + trainSpeed);
}

// Seconds the route needs after an obstacle before the next one (land / fall + react).
const AFTER_TIME = { low: 0.75, car: 0.85, high: 0.6, wagons: 0.9 };

const CAR_COLORS = 6;

function pickWeighted(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng() * total;
  for (const [name, w] of table) {
    r -= w;
    if (r < 0) return name;
  }
  return table[table.length - 1][0];
}

export class PatternGenerator {
  constructor(seed = 1) {
    this.extras = [];
    this.reset(seed);
  }

  reset(seed) {
    this.seed = seed >>> 0;
    this.rng = createRng(this.seed);
    this.cursor = 0;                         // generated up to here
    this.route = CENTER_LANE;
    this.laneFree = new Array(LANES).fill(0); // each lane is empty from here on
    this.routeNext = 0;                      // earliest start of the next route obstacle
    this.coinFree = 0;                       // last coin position (no overlapping rows)
  }

  addExtra(fn) {
    this.extras.push(fn);
  }

  // Generate whole blocks until `distance` is covered. Returns the new descriptors.
  generateUntil(distance, out = []) {
    while (this.cursor < distance) this._block(out);
    return out;
  }

  _block(out) {
    const P = CONFIG.patterns;
    const rng = this.rng;
    const A = this.cursor;
    const v = speedAt(A + 40); // a little faster than now = safer spacing
    const diff = clamp((A - P.safeStart) / P.difficultyDistance, 0, 1);
    const blockLen = v * lerp(P.blockTimeEasy, P.blockTimeHard, diff);
    const B = A + blockLen;
    this.cursor = B;

    if (A < P.safeStart) {
      if (A > 12) this._coinRow(out, this.route, A, B - 2, 0);
      return;
    }

    // Distance needed to change one lane and get settled.
    const shiftWin = v * (CONFIG.laneSwitchTime + P.reactionTime) + 2;

    // 1. Maybe move the route one lane over (both lanes must be empty now).
    const oldRoute = this.route;
    if (rng() < lerp(0.25, 0.45, diff)) {
      let target = oldRoute + (rng() < 0.5 ? -1 : 1);
      if (target < 0 || target >= LANES) target = oldRoute * 2 - target;
      if (this.laneFree[oldRoute] <= A && this.laneFree[target] <= A) {
        this.route = target;
        this.routeNext = Math.max(this.routeNext, A + shiftWin);
      }
    }
    const route = this.route;
    const moved = route !== oldRoute;

    // 2. Route lane: at most one passable obstacle.
    let routeFree = null;
    const rs = Math.max(A, this.laneFree[route], this.routeNext);
    if (rs < B - 1 && rng() < lerp(0.45, 0.8, diff)) {
      const d = rs + rng() * Math.min(B - 1 - rs, blockLen * 0.5);
      const kind = pickWeighted(rng, [['low', 3], ['high', 3], ['car', 2.5], ['ramp', 1.6]]);
      const desc = this._passable(kind, route, d);
      out.push(desc);
      const end = d + desc.len;
      this.laneFree[route] = end + 1;
      this.routeNext = end + v * AFTER_TIME[desc.type] + 1.5; // +1.5: player depth + rounding
      this._routeCoins(out, desc, v);
      if (d - rs > 8) routeFree = [rs, d - 4];
    } else if (rs < B - 1) {
      routeFree = [rs, B - 1];
      if (rng() < 0.55) this._coinRow(out, route, rs, B - 1, 0);
    }

    // 3. Other lanes: anything, including blocking cars and oncoming trains.
    for (let lane = 0; lane < LANES; lane++) {
      if (lane === route) continue;
      let start = Math.max(A, this.laneFree[lane]);
      if (moved && lane === oldRoute) start = Math.max(start, A + shiftWin); // let the player leave
      if (start >= B) continue;
      if (rng() > lerp(0.35, 0.8, diff)) continue;

      const table = [['low', 2], ['high', 2], ['car', 2.5], ['wagons', 2.5], ['ramp', 1.2]];
      if (A > P.trainStart) table.push(['train', 1.5 + 2 * diff]);
      const kind = pickWeighted(rng, table);
      const d = start + rng() * (B - start) * 0.6;

      if (kind === 'train') {
        const speed = lerp(CONFIG.obstacles.trainSpeedMin, CONFIG.obstacles.trainSpeedMax, rng());
        // Meet point a bit later: the train closes in faster than the track.
        const meet = d + speed * P.reactionTime + 2;
        const desc = { type: 'train', lane, d: meet, cars: 2 + Math.floor(rng() * 3), ramp: false, speed };
        desc.len = descLength(desc);
        desc.spawnD = trainSpawnD(meet, speed);
        out.push(desc);
        // The train sweeps [meet, spawnD + len] on its way to the player: keep it empty.
        this.laneFree[lane] = desc.spawnD + desc.len + 4;
      } else {
        const desc = this._passable(kind, lane, d);
        out.push(desc);
        this.laneFree[lane] = d + desc.len + 2 + rng() * 6;
      }
    }

    // 4. Extras (pickups) from later tasks.
    if (this.extras.length) {
      const ctx = { rng, A, B, speed: v, difficulty: diff, route, routeFree, push: (desc) => out.push(desc) };
      for (const fn of this.extras) fn(ctx);
    }
  }

  // kind: low | high | car | wagons | ramp (= wagons with a ramp)
  _passable(kind, lane, d) {
    const rng = this.rng;
    let desc;
    if (kind === 'ramp' || kind === 'wagons') {
      desc = { type: 'wagons', lane, d, cars: 1 + Math.floor(rng() * 3), ramp: kind === 'ramp' };
    } else if (kind === 'car') {
      desc = { type: 'car', lane, d, color: Math.floor(rng() * CAR_COLORS) };
    } else {
      desc = { type: kind, lane, d };
    }
    desc.len = descLength(desc);
    return desc;
  }

  // ---------- coins ----------

  _coin(out, lane, d, y) {
    if (d < this.coinFree + CONFIG.coins.spacing * 0.8) return;
    out.push({ type: 'coin', lane, d, y });
    this.coinFree = d;
  }

  _coinRow(out, lane, d0, d1, floorY) {
    const C = CONFIG.coins;
    let n = 0;
    for (let d = Math.max(d0, this.coinFree + C.spacing); d <= d1 && n < C.maxRow; d += C.spacing, n++) {
      this._coin(out, lane, d, floorY + C.height);
    }
  }

  _routeCoins(out, desc, v) {
    const C = CONFIG.coins;
    const O = CONFIG.obstacles;
    if (desc.type === 'low' || desc.type === 'car') {
      // Arc following a jump centred on the obstacle.
      const air = 2 * Math.sqrt(2 * CONFIG.jumpHeight / CONFIG.gravity);
      const half = (v * air) / 2;
      const mid = desc.d + desc.len / 2;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const s = ((i / (n - 1)) * 2 - 1) * 0.85; // -0.85 .. 0.85 of the half arc
        this._coin(out, desc.lane, mid + s * half, C.height + CONFIG.jumpHeight * (1 - s * s));
      }
    } else if (desc.type === 'high') {
      // Low row under the bar (slide).
      for (let i = -1; i <= 1; i++) this._coin(out, desc.lane, desc.d + desc.len / 2 + i * C.spacing, 0.35);
    } else if (desc.type === 'wagons' && desc.ramp) {
      // Up the ramp, then along the roof.
      const top = O.wagon.height;
      for (let f = 1.5; f < O.rampLength; f += C.spacing) {
        this._coin(out, desc.lane, desc.d + f, top * (f / O.rampLength) + C.height);
      }
      const roofEnd = desc.d + desc.len - 1;
      let n = 0;
      for (let d = desc.d + O.rampLength + 1; d <= roofEnd && n < C.maxRow; d += C.spacing, n++) {
        this._coin(out, desc.lane, d, top + C.height);
      }
    }
  }
}
