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
//                                                           (lane may be fractional: a diagonal
//                                                           line between two free lanes)
// obstacles.js turns them into objects in the scene.
//
// Fairness rule: there is always a "route" lane. On the route there is at most one
// passable obstacle (jump / slide / ramp) per block — two in the endless phase (a combo) —
// spaced by reaction time at the expected speed. The route only moves one lane at a time, and
// only when both lanes are free for long enough to change lanes. Oncoming trains are never
// placed where the route could be until long after they have passed. Other lanes are filled
// randomly.
//
// Difficulty never stops growing (difficultyAt): 0 -> 1 -> difficultyMax on the original
// curve, then slowly (logarithmically) on. Past difficultyMax the "endless" share k (0 -> 1)
// tightens the route spacing, adds jump->slide combos, fills the side lanes and speeds up trains.
//
// Coins (Subway Surfers style): the route lane gets rows, jump arcs, slide rows and ramp-roof
// rows; when the route moves, a diagonal line leads across; a second (sometimes third) lane gets
// its own row / arc / roof row in the same block. Never inside an obstacle or a train's sweep;
// side-lane rows stop well before a wall or a train (following coins never traps you).
//
// All randomness comes from one seeded RNG (createRng), so a seed gives the same track.
//
// Pickups (G9 web cartridge, G10 Iron Spider core, spider-sense, magnet): register an extra with
//   generator.addExtra((ctx) => { ... ctx.push({ type: 'pickup', kind: 'web', lane, d, y }) })
// It is called once per block. ctx = { rng, A, B, speed, difficulty, route, routeFree, push, pickups }
// routeFree is [d0, d1], a stretch of the route lane in this block with no obstacle, or null.
// pickups = how many pickups earlier extras pushed in this block.

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

// Expected run speed when the player reaches ground distance d. Speed grows linearly with
// time in three phases (game.js), so per phase v^2 = v0^2 + 2 a d.
export function speedAt(d) {
  const v0 = CONFIG.startSpeed;
  const v1 = CONFIG.cruiseSpeed;
  const v2 = CONFIG.maxSpeed;
  const d1 = (v1 * v1 - v0 * v0) / (2 * CONFIG.acceleration);       // end of the first phase
  const d2 = d1 + (v2 * v2 - v1 * v1) / (2 * CONFIG.acceleration2); // ... of the second
  d = Math.max(0, d);
  if (d <= d1) return Math.sqrt(v0 * v0 + 2 * CONFIG.acceleration * d);
  if (d <= d2) return Math.sqrt(v1 * v1 + 2 * CONFIG.acceleration2 * (d - d1));
  return Math.min(CONFIG.topSpeed, Math.sqrt(v2 * v2 + 2 * CONFIG.acceleration3 * (d - d2)));
}

// Difficulty at ground distance d: 0 -> 1 over the first phase, then creeping on to
// patterns.difficultyMax, then on forever, slowly (lerps below extrapolate past 1 on purpose).
export function difficultyAt(d) {
  const P = CONFIG.patterns;
  const base = clamp((d - P.safeStart) / P.difficultyDistance, 0, 1);
  const past = d - P.safeStart - P.difficultyDistance;
  const extra = clamp(past / P.difficultyDistance2, 0, 1);
  const endless = Math.max(0, past - P.difficultyDistance2);
  return base + (P.difficultyMax - 1) * extra + P.endlessGain * Math.log1p(endless / P.endlessScale);
}

// Endless share of a difficulty: 0 up to difficultyMax, then toward 1 (never quite).
export function endlessK(diff) {
  const h = Math.max(0, diff - CONFIG.patterns.difficultyMax);
  return h / (h + CONFIG.patterns.endlessHalf);
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
    this.lastPickupD = -Infinity;            // distance of the last pickup of any kind
    this.rng = createRng(this.seed);
    this.cursor = 0;                         // generated up to here
    this.route = CENTER_LANE;
    this.laneFree = new Array(LANES).fill(0); // each lane is empty from here on
    this.routeNext = 0;                      // earliest start of the next route obstacle
    this.coinFree = new Array(LANES).fill(-Infinity); // last coin per lane (no overlapping rows)
    this.coinMax = new Array(LANES).fill(Infinity);   // no coins beyond this per lane (next obstacle)
    this._placed = new Array(LANES).fill(null);
    this._from = new Array(LANES).fill(0);
    this._coinStop = new Array(LANES).fill(Infinity);
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
    const C = CONFIG.coins;
    const rng = this.rng;
    const A = this.cursor;
    const v = speedAt(A + 40); // a little faster than now = safer spacing
    const diff = difficultyAt(A);
    const k = endlessK(diff);
    const blockTime = lerp(P.blockTimeEasy, P.blockTimeHard, Math.min(diff, P.difficultyMax));
    const blockLen = v * lerp(blockTime, P.blockTimeEndless, k);
    const B = A + blockLen;
    this.cursor = B;

    if (A < P.safeStart) {
      if (A > 12) this._coinRow(out, this.route, A, B - 2, 0);
      return;
    }

    // Distance needed to change one lane and get settled.
    const shiftWin = v * (CONFIG.laneSwitchTime + P.reactionTime) + 2;
    const afterScale = lerp(1, P.afterTimeHard, k);

    // 1. Maybe move the route one lane over (both lanes must be empty now).
    const oldRoute = this.route;
    if (rng() < Math.min(0.7, lerp(0.25, 0.45, diff))) {
      let target = oldRoute + (rng() < 0.5 ? -1 : 1);
      if (target < 0 || target >= LANES) target = oldRoute * 2 - target;
      if (this.laneFree[oldRoute] <= A && this.laneFree[target] <= A) {
        this.route = target;
        this.routeNext = Math.max(this.routeNext, A + shiftWin);
      }
    }
    const route = this.route;
    const moved = route !== oldRoute;
    // zigzag: a diagonal coin line from the old route lane to the new one (both are free)
    if (moved && rng() < C.zigzagChance) this._coinDiagonal(out, oldRoute, route, A + 1, A + shiftWin - 1);

    // 2. Route lane: one passable obstacle (+ maybe a combo partner in the endless phase).
    let routeFree = null;
    const rs = Math.max(A, this.laneFree[route], this.routeNext);
    if (rs < B - 1 && rng() < Math.min(1, lerp(0.45, 0.8, diff))) {
      // the endless phase pulls it toward the start of the block (tighter sequences)
      const d = rs + Math.pow(rng(), 1 + 2 * k) * Math.min(B - 1 - rs, blockLen * 0.5);
      const kind = pickWeighted(rng, [['low', 3], ['high', 3], ['car', 2.5], ['ramp', 1.6]]);
      const desc = this._routeObstacle(out, kind, route, d, v, afterScale);
      if (d - rs > 8) routeFree = [rs, d - 4];
      if (d - rs > 8 && rng() < C.routeRowChance) this._coinRow(out, route, rs, d - Math.max(2, v * 0.3), 0);
      this._routeCoins(out, desc, v);
      // combo: jump -> slide (or slide -> jump) as soon as the spacing allows
      if (k > 0 && rng() < P.comboChance * k && this.routeNext < B - 1) {
        const kind2 = desc.type === 'high' ? (rng() < 0.6 ? 'low' : 'car') : 'high';
        this._routeCoins(out, this._routeObstacle(out, kind2, route, this.routeNext, v, afterScale), v);
      }
    } else if (rs < B - 1) {
      routeFree = [rs, B - 1];
      if (rng() < C.routeRowChance) this._coinRow(out, route, rs, B - 1, 0);
    }

    // 3. Other lanes: anything, including blocking cars and oncoming trains.
    const placed = this._placed;
    const from = this._from;
    for (let lane = 0; lane < LANES; lane++) {
      placed[lane] = null;
      from[lane] = B;
      this._coinStop[lane] = Infinity;
      if (lane === route) continue;
      let start = Math.max(A, this.laneFree[lane]);
      if (moved && lane === oldRoute) start = Math.max(start, A + shiftWin); // let the player leave
      if (start >= B) continue;
      from[lane] = start;
      if (rng() > Math.min(1, lerp(0.35, 0.8, diff))) continue;

      const table = [['low', 2], ['high', 2], ['car', 2.5], ['wagons', 2.5 + P.blockWeightHard * k], ['ramp', 1.2]];
      if (A > P.trainStart) table.push(['train', 1.5 + 2 * diff]);
      const kind = pickWeighted(rng, table);
      const d = start + rng() * (B - start) * 0.6;

      if (kind === 'train') {
        const O = CONFIG.obstacles;
        const speed = lerp(lerp(O.trainSpeedMin, P.trainSpeedMinHard, k), lerp(O.trainSpeedMax, P.trainSpeedMaxHard, k), rng());
        // Meet point a bit later: the train closes in faster than the track.
        const meet = d + speed * P.reactionTime + 2;
        const desc = { type: 'train', lane, d: meet, cars: 2 + Math.floor(rng() * 3), ramp: false, speed };
        desc.len = descLength(desc);
        desc.spawnD = trainSpawnD(meet, speed);
        out.push(desc);
        placed[lane] = desc;
        // The train sweeps [meet, spawnD + len] on its way to the player: keep it empty.
        this.laneFree[lane] = desc.spawnD + desc.len + 4;
      } else {
        const desc = this._passable(kind, lane, d);
        out.push(desc);
        placed[lane] = desc;
        this.laneFree[lane] = d + desc.len + 2 + rng() * lerp(6, P.sideGapHard, k);
        // endless phase: fewer free side lanes — a second obstacle right after the first
        if (k > 0 && this.laneFree[lane] < B - 2 && rng() < P.sideSecondChance * k) {
          const kind2 = pickWeighted(rng, table.slice(0, 5)); // no train
          const d2 = this.laneFree[lane];
          const desc2 = this._passable(kind2, lane, d2);
          out.push(desc2);
          this._coinStop[lane] = d2 - 1;
          this.laneFree[lane] = d2 + desc2.len + 2 + rng() * lerp(6, P.sideGapHard, k);
        }
      }
    }

    // 3b. Coins in a second (sometimes a third) lane.
    // The lane with the most room for coins gets the second-lane chance (free > passable
    // obstacle > wagons roof > train), the other one the third-lane chance.
    const room = (lane) => {
      const o = placed[lane];
      if (from[lane] >= B - 1) return -1;
      return !o ? 3 : o.type === 'train' ? 0 : o.type === 'wagons' && !o.ramp ? 1 : 2;
    };
    const flip = rng() < 0.5;
    const sides = [];
    for (let lane = 0; lane < LANES; lane++) if (lane !== route) sides.push(lane);
    sides.sort((a, b) => room(b) - room(a) || (flip ? b - a : a - b));
    for (let i = 0; i < sides.length; i++) {
      const lane = sides[i];
      if (rng() < (i === 0 ? C.sideChance : C.thirdChance) && room(lane) >= 0) this._sideCoins(out, lane, from[lane], placed[lane], B, v);
    }

    // 4. Extras (pickups) from later tasks.
    if (this.extras.length) {
      const ctx = {
        rng, A, B, speed: v, difficulty: diff, route, routeFree, pickups: 0,
        // false when a pickup at metre d would sit within CONFIG.pickups.minGapAny of the last
        farFromPickup: (d) => d - this.lastPickupD >= CONFIG.pickups.minGapAny,
        push: (desc) => {
          if (desc.type === 'pickup') { ctx.pickups++; this.lastPickupD = desc.d; }
          out.push(desc);
        },
      };
      for (const fn of this.extras) fn(ctx);
    }
  }

  // A passable obstacle on the route at d; moves the route bookkeeping past it.
  _routeObstacle(out, kind, route, d, v, afterScale) {
    const desc = this._passable(kind, route, d);
    out.push(desc);
    const end = d + desc.len;
    this.laneFree[route] = end + 1;
    this.routeNext = end + v * AFTER_TIME[desc.type] * afterScale + 1.5; // +1.5: player depth + rounding
    return desc;
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

  // lane may be fractional (diagonal lines): both neighbouring lanes count as used.
  _coin(out, lane, d, y) {
    const l0 = Math.floor(lane), l1 = Math.ceil(lane);
    const gap = CONFIG.coins.spacing * 0.8;
    if (d < this.coinFree[l0] + gap || d < this.coinFree[l1] + gap) return;
    if (d > this.coinMax[l0] || d > this.coinMax[l1]) return;
    out.push({ type: 'coin', lane, d, y });
    this.coinFree[l0] = d;
    this.coinFree[l1] = d;
  }

  _coinRow(out, lane, d0, d1, floorY) {
    const C = CONFIG.coins;
    let n = 0;
    for (let d = Math.max(d0, this.coinFree[lane] + C.spacing); d <= d1 && n < C.maxRow; d += C.spacing, n++) {
      this._coin(out, lane, d, floorY + C.height);
    }
  }

  // Diagonal line from lane a to lane b over [d0, d1] (an S-curve across).
  _coinDiagonal(out, a, b, d0, d1) {
    const C = CONFIG.coins;
    const n = Math.floor((d1 - d0) / C.spacing);
    for (let i = 0; i <= n; i++) {
      const t = n > 0 ? i / n : 1;
      this._coin(out, a + (b - a) * t * t * (3 - 2 * t), d0 + i * C.spacing, C.height);
    }
  }

  // A side lane's coins in this block: a row on its free stretch, then the obstacle's own
  // pattern (arc / slide row / ramp + roof / roof row). Rows end long before a wall or train.
  _sideCoins(out, lane, s, desc, B, v) {
    const C = CONFIG.coins;
    // nothing before s (an earlier obstacle may end just there) ...
    this.coinFree[lane] = Math.max(this.coinFree[lane], s + 1 - C.spacing * 0.8);
    if (!desc) {
      if (B - 1 - s > 4) this._coinRow(out, lane, s + 1, B - 1, 0);
      return;
    }
    // ... and none where the next obstacle in this lane may start (a jump arc runs past)
    this.coinMax[lane] = Math.min(this.laneFree[lane], this._coinStop[lane]) - 1;
    this._sideObstacleCoins(out, lane, s, desc, v);
    this.coinMax[lane] = Infinity;
  }

  _sideObstacleCoins(out, lane, s, desc, v) {
    const C = CONFIG.coins;
    const wall = desc.type === 'train' || (desc.type === 'wagons' && !desc.ramp);
    let e = desc.d - Math.max(2, v * 0.3);
    if (wall) e = desc.d - v * C.trapTime - (desc.type === 'train' ? desc.speed * CONFIG.patterns.reactionTime : 0);
    if (e - s > 4) this._coinRow(out, lane, s + 1, e, 0);
    if (desc.type === 'train') return;
    if (wall) {
      if (this.rng() < C.roofChance) {
        const top = CONFIG.obstacles.wagon.height;
        this._coinRow(out, lane, desc.d + 1, desc.d + desc.len - 1, top);
      }
    } else {
      this._routeCoins(out, desc, v);
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
