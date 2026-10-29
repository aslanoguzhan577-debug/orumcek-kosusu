// tools/check-patterns.mjs — asserts that the pattern generator always leaves a way through.
// Run:  node tools/check-patterns.mjs [seeds=150] [metres = a 20-minute run on the speed curve]
//       [marginSeeds=40]
//
// Independent of the generator's own route bookkeeping, it rebuilds each lane as a strip of
// cells (free / jump / slide / ramp+roof / blocked) and searches for a path from the start to
// the end with a simple movement model and a reaction time r:
//   - moving forward in a lane: allowed through free, jump, slide and ramp cells, but a jump /
//     slide / ramp must be preceded by r seconds of free lane (time to react / land);
//   - changing lane at d: both lanes free on [d, d + v * (laneSwitchTime + min(r, reactionTime))];
//   - oncoming trains block their lane from (meet - extra reaction for their speed) until
//     their tail has passed the player.
// r = checkGapTime (0.6 s) up to the endless phase, then it may shrink toward minReaction (0.4 s)
// as the endless share k grows. Per minute it also reports the reaction margin: the largest r
// for which every seed's minute (restarted from the lanes reachable at its start) is passable,
// and asserts it never drops below minReaction.
// It also asserts that nothing static sits where an oncoming train will sweep through, that
// static obstacles in a lane never overlap, that coins are never inside an obstacle or a train's
// sweep, that the pooled instance meshes are never overfilled, and reports how often coins are
// in at least two lanes.

import { CONFIG } from '../src/config.js';
import { PatternGenerator, speedAt, difficultyAt, endlessK } from '../src/patterns.js';

const P = CONFIG.patterns;
const lerp = (a, b, t) => a + (b - a) * t;

// Distance after `seconds` of running, simulated exactly like game.js (dt = 1/60).
function runDistance(seconds) {
  let v = CONFIG.startSpeed;
  let d = 0;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const a = v < CONFIG.cruiseSpeed ? CONFIG.acceleration : v < CONFIG.maxSpeed ? CONFIG.acceleration2 : CONFIG.acceleration3;
    v = Math.min(CONFIG.topSpeed, v + a * dt);
    d += v * dt;
  }
  return { d, v };
}

function fail(seed, msg) {
  console.error(`FAIL seed=${seed}: ${msg}`);
  process.exitCode = 1;
}

const MINUTES = 20;
const minuteD = [];
for (let m = 0; m <= MINUTES; m++) minuteD.push(runDistance(m * 60).d);

// --- the speed model the generator uses must match the game's speed over time ---
{
  for (const sec of [30, 100, 200, 400, 600, 900, 1200]) {
    const r = runDistance(sec);
    const err = Math.abs(speedAt(r.d) - r.v);
    if (err > 0.1) fail('-', `speedAt(${r.d.toFixed(0)} m) = ${speedAt(r.d).toFixed(2)}, game speed ${r.v.toFixed(2)} at ${sec} s`);
  }
  // pattern blocks must stay longer than a lane change window (train margin assumption)
  for (let d = 0; d < 200000; d += 250) {
    const v = speedAt(d), diff = difficultyAt(d); // the block length the generator uses here
    const block = v * lerp(lerp(P.blockTimeEasy, P.blockTimeHard, Math.min(diff, P.difficultyMax)), P.blockTimeEndless, endlessK(diff));
    const shift = v * (CONFIG.laneSwitchTime + P.reactionTime) + 2;
    if (block <= shift) fail('-', `at ${v} m/s a block (${block.toFixed(1)} m) is not longer than a lane change (${shift.toFixed(1)} m)`);
  }
  // difficulty never stops growing
  for (let m = 1; m <= MINUTES; m++) {
    if (difficultyAt(minuteD[m]) <= difficultyAt(minuteD[m - 1]) && minuteD[m] > P.safeStart + 100) {
      fail('-', `difficulty does not grow in minute ${m}`);
    }
  }
}

const SEEDS = Number(process.argv[2] || 150);
const LENGTH = Number(process.argv[3] || Math.ceil(minuteD[MINUTES]));
const MARGIN_SEEDS = Math.min(SEEDS, Number(process.argv[4] || 40));
const STEP = 0.25;
const LANES = CONFIG.laneCount;
const MARGIN_R = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7];
const windows = minuteD.filter((d) => d < LENGTH - 1).concat([LENGTH]); // window w = [windows[w], windows[w+1]]
const W = windows.length - 1;

const FREE = 0, JUMP = 1, SLIDE = 2, RAMP = 3, BLOCK = 4;

// pooled instance limits (obstacle-art.js) and what is alive at once (spawn horizon .. release)
const CAP = { coin: 256, low: 24, high: 24, car: 24, wagon: 64, ramp: 16 };
const WCFG = CONFIG.world;
const HORIZON = WCFG.segmentCount * WCFG.segmentLength - WCFG.backZ + WCFG.segmentLength;
const RELEASE = CONFIG.obstacles.releaseZ;

const rAt = (d) => lerp(P.checkGapTime, P.minReaction, endlessK(difficultyAt(d)));

const marginMin = new Array(W).fill(Infinity);
const perWin = { obst: new Array(W).fill(0), train: new Array(W).fill(0) }; // counts per minute
const winOf = (d) => { let w = 0; while (w < W - 1 && d >= windows[w + 1]) w++; return w; };
const capMax = {};
let cover2 = 0, coverN = 0, cover3 = 0;

function checkSeed(seed, withMargin) {
  const gen = new PatternGenerator(seed);
  const descs = gen.generateUntil(LENGTH + 200);
  const cells = Math.ceil((LENGTH + 400) / STEP);
  const lanes = [];
  const floorTop = [];   // per lane: solid height from the track up (coins must be above)
  const highCell = [];   // per lane: a high bar (coins must be under it or above it)
  const sweep = [];      // per lane: an oncoming train's sweep (no coins)
  for (let l = 0; l < LANES; l++) {
    lanes.push(new Uint8Array(cells));
    floorTop.push(new Float32Array(cells));
    highCell.push(new Uint8Array(cells));
    sweep.push(new Uint8Array(cells));
  }
  const cell = (d) => Math.max(0, Math.min(cells - 1, Math.floor(d / STEP)));

  const mark = (lane, d0, d1, kind) => {
    const i1 = cell(Math.ceil(d1 / STEP) * STEP);
    for (let i = cell(d0); i <= i1; i++) lanes[lane][i] = Math.max(lanes[lane][i], kind);
  };

  const statics = [];
  const trains = [];
  const coins = [];
  const counts = {};
  for (const o of descs) {
    counts[o.type] = (counts[o.type] || 0) + 1;
    if (o.type !== 'coin' && o.type !== 'pickup' && o.d < LENGTH) perWin[o.type === 'train' ? 'train' : 'obst'][winOf(o.d)]++;
    if (o.type === 'pickup') continue;
    if (o.type === 'coin') coins.push(o);
    else if (o.type === 'train') trains.push(o);
    else statics.push(o);
  }

  // Static obstacles never overlap in a lane.
  statics.sort((a, b) => a.lane - b.lane || a.d - b.d);
  for (let i = 1; i < statics.length; i++) {
    const a = statics[i - 1], b = statics[i];
    if (a.lane === b.lane && b.d < a.d + a.len) {
      fail(seed, `static overlap lane ${a.lane} at ${a.d.toFixed(1)} (${a.type}) / ${b.d.toFixed(1)} (${b.type})`);
    }
  }

  // Nothing static inside an oncoming train's sweep; trains in a lane do not overlap.
  for (const t of trains) {
    for (const s of statics) {
      if (s.lane === t.lane && s.d < t.spawnD + t.len && s.d + s.len > t.d) {
        fail(seed, `static ${s.type} at ${s.d.toFixed(1)} inside train sweep lane ${t.lane} [${t.d.toFixed(1)}, ${(t.spawnD + t.len).toFixed(1)}]`);
      }
    }
    for (const u of trains) {
      if (u !== t && u.lane === t.lane && u.d > t.d && u.d < t.spawnD + t.len) {
        fail(seed, `two trains overlap in lane ${t.lane} near ${t.d.toFixed(1)}`);
      }
    }
  }

  const O = CONFIG.obstacles;
  const hd = CONFIG.playerDepth / 2;
  for (const s of statics) {
    let kind = BLOCK;
    if (s.type === 'low' || s.type === 'car') kind = JUMP;
    else if (s.type === 'high') kind = SLIDE;
    else if (s.type === 'wagons' && s.ramp) kind = RAMP;
    mark(s.lane, s.d - hd, s.d + s.len + hd, kind);
    // solid profile for the coin test
    for (let i = cell(s.d); i <= cell(s.d + s.len); i++) {
      const f = Math.min(s.len, (i + 1) * STEP - s.d); // far end of the cell (highest on a ramp)
      let top = 0;
      if (s.type === 'low') top = O.low.height;
      else if (s.type === 'car') top = f < O.car.hood || f > O.car.length - O.car.trunk ? O.car.hoodHeight : O.car.height;
      else if (s.type === 'high') highCell[s.lane][i] = 1;
      else top = s.ramp && f < O.rampLength ? O.wagon.height * f / O.rampLength : O.wagon.height;
      floorTop[s.lane][i] = Math.max(floorTop[s.lane][i], top);
    }
  }
  for (const t of trains) {
    const v = speedAt(t.d);
    const extra = t.speed * P.reactionTime;
    const tailPass = t.d + (t.len * v) / (v + t.speed);
    mark(t.lane, t.d - extra - hd, tailPass + hd, BLOCK);
    for (let i = cell(t.d); i <= cell(t.spawnD + t.len); i++) sweep[t.lane][i] = 1;
  }

  // Coins: never inside an obstacle (box radius ~0.3 m) or a train's sweep.
  for (const c of coins) {
    for (const l of new Set([Math.floor(c.lane), Math.ceil(c.lane)])) {
      for (let i = cell(c.d - 0.3); i <= cell(c.d + 0.3); i++) {
        const bad = sweep[l][i] ? 'train sweep'
          : c.y - 0.3 < floorTop[l][i] - 0.02 ? 'obstacle'
          : highCell[l][i] && c.y + 0.3 > O.high.bottom && c.y - 0.3 < O.high.top ? 'high bar' : null;
        if (bad) {
          fail(seed, `coin lane ${c.lane} d=${c.d.toFixed(1)} y=${c.y.toFixed(2)} inside a ${bad}`);
          i = Infinity;
        }
      }
    }
  }

  // Coins in >= 2 lanes: 20 m windows after the safe start.
  {
    const nW = Math.floor(LENGTH / 20);
    const mask = new Uint8Array(nW);
    for (const c of coins) {
      const w = Math.floor(c.d / 20);
      if (w < nW) mask[w] |= (1 << Math.floor(c.lane)) | (1 << Math.ceil(c.lane));
    }
    for (let w = Math.ceil((P.safeStart + 40) / 20); w < nW; w++) {
      const n = (mask[w] & 1) + ((mask[w] >> 1) & 1) + ((mask[w] >> 2) & 1);
      coverN++;
      if (n >= 2) cover2++;
      if (n >= 3) cover3++;
    }
  }

  // Pool limits: how many of each instanced kind are alive at once (1 m resolution).
  {
    const m = Math.ceil(LENGTH + 400);
    const alive = {};
    for (const k in CAP) alive[k] = new Int32Array(m + 2);
    const add = (k, p0, p1, n = 1) => {
      const a = Math.max(0, Math.floor(p0)), b = Math.min(m, Math.ceil(p1));
      if (b < a) return;
      alive[k][a] += n;
      alive[k][b + 1] -= n;
    };
    for (const c of coins) add('coin', c.d - HORIZON, c.d + RELEASE);
    for (const s of statics) {
      const span = [s.d - HORIZON, s.d + s.len + RELEASE];
      if (s.type === 'wagons') {
        add('wagon', ...span, s.cars);
        if (s.ramp) add('ramp', ...span);
      } else add(s.type, ...span);
    }
    for (const t of trains) {
      const v = speedAt(t.d);
      add('wagon', t.d - (O.spawnDistance * v) / (v + t.speed), t.d + ((t.len + RELEASE) * v) / (v + t.speed), t.cars);
    }
    for (const k in CAP) {
      let run = 0, best = 0;
      for (let i = 0; i <= m; i++) {
        run += alive[k][i];
        if (i < LENGTH) best = Math.max(best, run);
      }
      capMax[k] = Math.max(capMax[k] || 0, best);
      if (best > CAP[k]) fail(seed, `${best} ${k} instances alive at once (pool holds ${CAP[k]})`);
    }
  }

  // Free runs: freeAhead[l][i] = free cells starting at i, freeBehind = ending at i.
  const freeAhead = [], freeBehind = [];
  for (let l = 0; l < LANES; l++) {
    const a = new Int32Array(cells + 1), b = new Int32Array(cells);
    for (let i = cells - 1; i >= 0; i--) a[i] = lanes[l][i] === FREE ? a[i + 1] + 1 : 0;
    for (let i = 0; i < cells; i++) b[i] = lanes[l][i] === FREE ? (i > 0 ? b[i - 1] : 0) + 1 : 0;
    freeAhead.push(a);
    freeBehind.push(b);
  }
  const freeRun = (lane, i0, i1) => i0 < 0 || freeAhead[lane][i0] > i1 - i0;

  const end = Math.floor(LENGTH / STEP);
  const winCell = windows.map((d) => Math.floor(d / STEP));

  // Reachability with reaction time rFn(d). base = the global reach (restart points for windows)
  // or null. Returns { reach, failAt, winOk }.
  const search = (rFn, base) => {
    const reach = [];
    for (let l = 0; l < LANES; l++) reach.push(new Uint8Array(cells));
    reach[Math.floor(LANES / 2)][0] = 1;
    const winOk = new Array(W).fill(true);
    let w = 0;
    let failAt = -1;
    for (let i = 0; i < end; i++) {
      if (base && i === winCell[w + 1]) {
        w++;
        for (let l = 0; l < LANES; l++) reach[l][i] |= base[l][i];
      }
      const d = i * STEP;
      const v = speedAt(d);
      const r = rFn(d);
      const gapCells = Math.ceil((v * r) / STEP);
      const changeCells = Math.ceil((v * (CONFIG.laneSwitchTime + Math.min(r, P.reactionTime))) / STEP);
      for (let l = 0; l < LANES; l++) {
        if (!reach[l][i]) continue;
        const next = lanes[l][i + 1];
        const here = lanes[l][i];
        if (next === FREE) reach[l][i + 1] = 1;
        else if (next !== BLOCK) {
          // entering an obstacle needs a free run-up; staying inside one is fine
          if (here === next || (here === FREE && freeBehind[l][i] >= gapCells)) reach[l][i + 1] = 1;
        }
        if (here === FREE) {
          for (const nl of [l - 1, l + 1]) {
            if (nl < 0 || nl >= LANES) continue;
            if (freeRun(l, i, i + changeCells) && freeRun(nl, i, i + changeCells)) reach[nl][i + changeCells] = 1;
          }
        }
      }
      let any = false;
      for (let l = 0; l < LANES; l++) if (reach[l][i + 1]) any = true;
      if (!any) {
        if (!base) { failAt = d + STEP; break; }
        winOk[w] = false;
      }
    }
    return { reach, failAt, winOk };
  };

  const global = search(rAt, null);
  if (global.failAt >= 0) {
    fail(seed, `no route at d=${global.failAt.toFixed(1)} m (speed ${speedAt(global.failAt).toFixed(1)}, r ${rAt(global.failAt).toFixed(2)} s)`);
    return counts;
  }
  if (withMargin) {
    // passing is monotone in r: a window's margin is the largest r that still passes
    const best = new Array(W).fill(0);
    for (const r of MARGIN_R) {
      const { winOk } = search(() => r, global.reach);
      for (let w = 0; w < W; w++) if (winOk[w]) best[w] = r;
    }
    for (let w = 0; w < W; w++) marginMin[w] = Math.min(marginMin[w], best[w]);
  }
  return counts;
}

const totals = {};
const t0 = Date.now();
for (let s = 1; s <= SEEDS; s++) {
  const counts = checkSeed(s * 7919 + 13, s <= MARGIN_SEEDS);
  for (const k in counts) totals[k] = (totals[k] || 0) + counts[k];
}

// --- report: the curve by minute ---
console.log('min   km    speed  diff   k     margin(s)  obstacles/km  trains/km');
for (let w = 0; w < W; w++) {
  const d = windows[w + 1];
  const top = MARGIN_R[MARGIN_R.length - 1];
  const m = marginMin[w] >= top ? `>=${top}` : marginMin[w].toFixed(2);
  console.log(`${String(w + 1).padStart(3)}  ${(d / 1000).toFixed(1).padStart(5)}  ${speedAt(d).toFixed(1).padStart(5)}  ` +
    `${difficultyAt(d).toFixed(2)}  ${endlessK(difficultyAt(d)).toFixed(2)}  ${m.padStart(6)}     ` +
    `${(perWin.obst[w] / SEEDS / ((d - windows[w]) / 1000)).toFixed(1).padStart(5)}         ${(perWin.train[w] / SEEDS / ((d - windows[w]) / 1000)).toFixed(1).padStart(4)}`);
  if (marginMin[w] < P.minReaction - 1e-9) fail('-', `minute ${w + 1}: reaction margin ${marginMin[w].toFixed(2)} s < ${P.minReaction} s`);
}
const perKm = {};
for (const k in totals) perKm[k] = (totals[k] / SEEDS / (LENGTH / 1000)).toFixed(1);
console.log(`checked ${SEEDS} seeds x ${LENGTH} m (${((Date.now() - t0) / 1000).toFixed(1)} s); per km:`, perKm);
console.log(`coins in >= 2 lanes in ${(100 * cover2 / coverN).toFixed(0)}% of 20 m stretches (3 lanes: ${(100 * cover3 / coverN).toFixed(0)}%)`);
console.log('most alive at once:', capMax, 'pool:', CAP);
for (const t of ['low', 'high', 'car', 'wagons', 'train', 'coin']) {
  if (!totals[t]) fail('-', `type ${t} never generated`);
}
if (!process.exitCode) console.log('OK: every seed has a passable route; reaction margin >= ' + P.minReaction + ' s everywhere.');
