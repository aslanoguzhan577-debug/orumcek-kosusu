// tools/check-patterns.mjs — asserts that the pattern generator always leaves a way through.
// Run:  node tools/check-patterns.mjs [seeds=150] [metres = a 10-minute run on the speed curve]
//
// Independent of the generator's own route bookkeeping, it rebuilds each lane as a strip of
// cells (free / jump / slide / ramp+roof / blocked) and searches for a path from the start to
// the end with a simple movement model:
//   - moving forward in a lane: allowed through free, jump, slide and ramp cells, but a jump /
//     slide / ramp must be preceded by checkGapTime seconds of free lane (time to react / land);
//   - changing lane at d: both lanes free on [d, d + v * (laneSwitchTime + reactionTime)];
//   - oncoming trains block their lane from (meet - extra reaction for their speed) until
//     their tail has passed the player.
// It also asserts that nothing static sits where an oncoming train will sweep through, and
// that static obstacles in a lane never overlap.

import { CONFIG } from '../src/config.js';
import { PatternGenerator, speedAt, difficultyAt } from '../src/patterns.js';

// Distance after `seconds` of running, simulated exactly like game.js (dt = 1/60).
function runDistance(seconds) {
  let v = CONFIG.startSpeed;
  let d = 0;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const a = v < CONFIG.cruiseSpeed ? CONFIG.acceleration : CONFIG.acceleration2;
    v = Math.min(CONFIG.maxSpeed, v + a * dt);
    d += v * dt;
  }
  return { d, v };
}

// --- the speed model the generator uses must match the game's speed over time ---
{
  const ten = runDistance(600);
  for (const sec of [30, 100, 200, 400, 600]) {
    const r = runDistance(sec);
    const err = Math.abs(speedAt(r.d) - r.v);
    if (err > 0.1) {
      console.error(`FAIL speedAt(${r.d.toFixed(0)} m) = ${speedAt(r.d).toFixed(2)}, game speed ${r.v.toFixed(2)} at ${sec} s`);
      process.exitCode = 1;
    }
  }
  console.log(`10-minute run: ${(ten.d / 1000).toFixed(1)} km, speed ${ten.v.toFixed(1)} m/s; ` +
    `${runDistance(120).v.toFixed(1)} m/s at 2 min; difficulty at end ${difficultyAt(ten.d).toFixed(2)}`);
  // pattern blocks must stay longer than a lane change window (train margin assumption)
  const P = CONFIG.patterns;
  const lerp = (a, b, t) => a + (b - a) * t;
  for (const v of [CONFIG.startSpeed, CONFIG.cruiseSpeed, CONFIG.maxSpeed]) {
    const block = v * lerp(P.blockTimeEasy, P.blockTimeHard, P.difficultyMax);
    const shift = v * (CONFIG.laneSwitchTime + P.reactionTime) + 2;
    if (block <= shift) {
      console.error(`FAIL at ${v} m/s a block (${block.toFixed(1)} m) is not longer than a lane change (${shift.toFixed(1)} m)`);
      process.exitCode = 1;
    }
  }
}

const SEEDS = Number(process.argv[2] || 150);
const LENGTH = Number(process.argv[3] || Math.ceil(runDistance(600).d));
const STEP = 0.25;
const LANES = CONFIG.laneCount;

const FREE = 0, JUMP = 1, SLIDE = 2, RAMP = 3, BLOCK = 4;

function fail(seed, msg) {
  console.error(`FAIL seed=${seed}: ${msg}`);
  process.exitCode = 1;
}

function checkSeed(seed) {
  const gen = new PatternGenerator(seed);
  const descs = gen.generateUntil(LENGTH + 200);
  const cells = Math.ceil((LENGTH + 400) / STEP);
  const lanes = [];
  for (let l = 0; l < LANES; l++) lanes.push(new Uint8Array(cells));

  const mark = (lane, d0, d1, kind) => {
    const i0 = Math.max(0, Math.floor(d0 / STEP));
    const i1 = Math.min(cells - 1, Math.ceil(d1 / STEP));
    for (let i = i0; i <= i1; i++) lanes[lane][i] = Math.max(lanes[lane][i], kind);
  };

  const statics = [];
  const trains = [];
  const counts = {};
  for (const o of descs) {
    counts[o.type] = (counts[o.type] || 0) + 1;
    if (o.type === 'coin' || o.type === 'pickup') continue;
    if (o.type === 'train') trains.push(o);
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

  const hd = CONFIG.playerDepth / 2;
  for (const s of statics) {
    let kind = BLOCK;
    if (s.type === 'low' || s.type === 'car') kind = JUMP;
    else if (s.type === 'high') kind = SLIDE;
    else if (s.type === 'wagons' && s.ramp) kind = RAMP;
    mark(s.lane, s.d - hd, s.d + s.len + hd, kind);
  }
  for (const t of trains) {
    const v = speedAt(t.d);
    const extra = t.speed * CONFIG.patterns.reactionTime;
    const tailPass = t.d + (t.len * v) / (v + t.speed);
    mark(t.lane, t.d - extra - hd, tailPass + hd, BLOCK);
  }

  // Reachability search.
  const reach = [];
  for (let l = 0; l < LANES; l++) reach.push(new Uint8Array(cells));
  reach[Math.floor(LANES / 2)][0] = 1;
  const end = Math.floor(LENGTH / STEP);

  const freeRun = (lane, i0, i1) => {
    for (let i = Math.max(0, i0); i <= i1; i++) if (lanes[lane][i] !== FREE) return false;
    return true;
  };

  for (let i = 0; i < end; i++) {
    const d = i * STEP;
    const v = speedAt(d);
    const gapCells = Math.ceil((v * CONFIG.patterns.checkGapTime) / STEP);
    const changeCells = Math.ceil((v * (CONFIG.laneSwitchTime + CONFIG.patterns.reactionTime)) / STEP);
    for (let l = 0; l < LANES; l++) {
      if (!reach[l][i]) continue;
      const next = lanes[l][i + 1];
      const here = lanes[l][i];
      if (next === FREE) reach[l][i + 1] = 1;
      else if (next !== BLOCK) {
        // entering an obstacle needs a free run-up; staying inside one is fine
        if (here !== FREE || freeRun(l, i + 1 - gapCells, i)) reach[l][i + 1] = 1;
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
      fail(seed, `no route at d=${(d + STEP).toFixed(1)} m (speed ${v.toFixed(1)})`);
      return counts;
    }
  }
  return counts;
}

const totals = {};
for (let s = 1; s <= SEEDS; s++) {
  const counts = checkSeed(s * 7919 + 13);
  for (const k in counts) totals[k] = (totals[k] || 0) + counts[k];
}
const perKm = {};
for (const k in totals) perKm[k] = (totals[k] / SEEDS / (LENGTH / 1000)).toFixed(1);
console.log(`checked ${SEEDS} seeds x ${LENGTH} m; per km:`, perKm);
for (const t of ['low', 'high', 'car', 'wagons', 'train', 'coin']) {
  if (!totals[t]) fail('-', `type ${t} never generated`);
}
if (!process.exitCode) console.log('OK: every seed has a passable route.');
