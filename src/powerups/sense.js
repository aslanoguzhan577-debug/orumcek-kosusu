// powerups/sense.js — spider-sense: a pickup that makes Spider-Man dodge by himself for a while.
//
// Pickup: kind 'sense', placed by a pattern-generator extra on free stretches of the route lane
// (rarer than the web cartridge). Collecting starts it at once: game.state.senseTime =
// CONFIG.sense.duration, emit('senseOn'); it counts down only while the run moves (not in
// pause / intro / catch), at 0 -> emit('senseOff'). Restart / menu clear it (senseOff {reset}).
//
// Auto-dodge (beforePlayer: after obstacles moved, before the player moves): every frame the
// player's vertical motion is simulated (same rules as player.js: gravity, slide timer, queued
// jump / slide, landing on and stepping up onto surfaces) against every obstacle part in his
// lane (the lane he is moving into, mid-change) that reaches him within lookAhead, each by its
// own closing speed (oncoming trains are faster). Only a front hit counts. If nothing would be
// hit — he already jumped / slid / is riding a ramp — nothing happens. If a hit is coming within
// actTime (laneActTime for walls / trains), the first action that survives is taken, with the
// player's own controls (handleAction / changeLane), never a teleport:
//   low barrier, car:        jump  (or a lane change, or a slide)
//   high barrier:            slide (or a lane change, or a jump)
//   wagon / train face:      lane change to a lane with no wall / train for laneClearTime (and no
//                            side contact while switching); a ramp there is fine — he rides it
// A jump / slide that would only work a little later waits (best timing for cars at low speed).
// Each dodge emits senseDodge {action: 'jump'|'slide'|'left'|'right', position} (the player's feet). Side stumbles
// are not prevented.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import { createSensePickup } from '../pickup-art.js';

const S = CONFIG.sense;
const O = CONFIG.obstacles;
const HZ = CONFIG.playerDepth / 2 - 0.05; // the player's z half span used by obstacles._collide
const _pos = new THREE.Vector3();

function rampTop(p, f) {
  const t = (f - p.f0) / (p.f1 - p.f0);
  return p.y1 * Math.min(1, Math.max(0, t));
}

// Reusable list of obstacle parts coming at the player in one lane.
class PartList {
  constructor() {
    this.items = [];
    this.n = 0;
  }

  // Fill with the parts in `lane` overlapping the player's z span at some time in [0, horizon].
  collect(active, lane, v, horizon) {
    this.n = 0;
    const x = laneX(lane);
    for (const o of active) {
      if (Math.abs(o.x - x) > 0.5) continue;
      const rel = Math.max(1, v + o.speed);
      if (o.z < -HZ - rel * horizon) continue;   // too far ahead
      if (o.z - o.length > HZ) continue;          // already behind
      for (const part of o.parts) {
        const t0 = (-HZ - (o.z - part.f0)) / rel;  // its near end reaches the player's back
        const t1 = (HZ - (o.z - part.f1)) / rel;   // its far end passes the player's front
        if (t1 < 0 || t0 > horizon) continue;
        let it = this.items[this.n];
        if (!it) it = this.items[this.n] = {};
        it.o = o;
        it.part = part;
        it.t0 = t0;
        it.t1 = t1;
        it.rel = rel;
        this.n++;
      }
    }
    return this;
  }
}

// Top of a part where the player's front edge is at time t.
function topAt(it, t) {
  const p = it.part;
  if (!p.ramp) return p.y1;
  return rampTop(p, Math.min(it.o.z + it.rel * t + HZ, p.f1));
}

const sim = {
  y: 0, vy: 0, grounded: true, coyote: 0, sliding: false, slideTimer: 0,
  jumpQueued: false, slideQueued: false, gScale: 1,
};

function loadSim(p) {
  sim.y = p.y;
  sim.vy = p.vy;
  sim.grounded = p.grounded;
  sim.coyote = p._coyote;
  sim.sliding = p.sliding;
  sim.slideTimer = p.slideTimer;
  sim.jumpQueued = p._jumpQueued;
  sim.slideQueued = p._slideQueued;
  sim.gScale = p.gravityScale;
}

// 'up' that is a jump (now or queued for the landing), never a web shot (player.js _up)
const jumpable = (p) => p.grounded || p._coyote > 0 || (p.vy < 0 && p.y - p.floorY < CONFIG.jumpBufferHeight);

// The player's own 'up' / 'down' (player.js _up / _down), on the simulated state.
function applySim(action, floor) {
  const s = sim;
  if (action === 'jump') {
    if (s.grounded || s.coyote > 0) {
      s.vy = Math.sqrt(2 * CONFIG.gravity * CONFIG.jumpHeight);
      s.grounded = false;
      s.coyote = 0;
      s.sliding = false;
      s.jumpQueued = s.slideQueued = false;
    } else if (s.vy < 0 && s.y - floor < CONFIG.jumpBufferHeight) {
      s.jumpQueued = true;
      s.slideQueued = false;
    }
  } else if (action === 'slide') {
    if (s.grounded) {
      s.sliding = true;
      s.slideTimer = CONFIG.slideDuration;
    } else {
      if (s.vy > -CONFIG.fastDropSpeed) s.vy = -CONFIG.fastDropSpeed;
      s.jumpQueued = false;
      if (CONFIG.slideAfterDrop) s.slideQueued = true;
    }
  }
}

// Simulate from the player's current state; `action` at time `delay`. Returns the time of the
// first front hit within `horizon`, or Infinity.
function simulate(p, list, action, delay, horizon) {
  loadSim(p);
  const s = sim;
  const dt = S.simStep;
  const g = CONFIG.gravity;
  let done = !action;
  for (let t = 0; t <= horizon; t += dt) {
    const tn = t + dt;
    // floor: the highest overlapping surface he is on or can step onto (obstacles._floorUnder)
    let floor = 0;
    for (let i = 0; i < list.n; i++) {
      const it = list.items[i];
      if (tn < it.t0 || tn > it.t1) continue;
      const top = topAt(it, tn);
      if (top > floor && s.y + O.stepUp >= top) floor = top;
    }
    if (!done && t >= delay - 1e-6) {
      applySim(action, floor);
      done = true;
    }
    const y0 = s.y;
    const h0 = s.sliding ? CONFIG.slideHeight : CONFIG.playerHeight;
    // vertical motion (player.update)
    if (s.grounded) {
      if (s.y > floor + 0.01) {
        s.grounded = false;
        s.vy = 0;
        s.coyote = CONFIG.coyoteTime;
        s.sliding = false;
      } else s.y = floor;
    }
    if (!s.grounded) {
      s.coyote -= dt;
      s.vy -= g * s.gScale * dt;
      s.y += s.vy * dt;
      if (s.y <= floor && s.vy > 0) s.y = floor;
      else if (s.y <= floor) {
        s.y = floor;
        s.vy = 0;
        s.grounded = true;
        if (s.jumpQueued) {
          s.jumpQueued = false;
          applySim('jump', floor);
        } else if (s.slideQueued) {
          s.slideQueued = false;
          s.sliding = true;
          s.slideTimer = CONFIG.slideDuration;
        }
      }
    }
    if (s.sliding) {
      s.slideTimer -= dt;
      if (s.slideTimer <= 0) s.sliding = false;
    }
    // front hits (obstacles._collide): entering a part's span inside its height, or rising
    // into it from below
    const h = s.sliding ? CONFIG.slideHeight : CONFIG.playerHeight;
    const by0 = s.y + 0.1, by1 = s.y + h - 0.05;
    for (let i = 0; i < list.n; i++) {
      const it = list.items[i];
      if (tn < it.t0 || tn > it.t1) continue;
      const top = topAt(it, tn);
      if (by1 <= it.part.y0 || by0 >= top) continue;
      const entering = it.t0 > 0 && t <= it.t0;
      const rising = y0 + h0 - 0.05 <= it.part.y0;
      if (entering || rising) return tn;
    }
  }
  return Infinity;
}

const isWall = (it) => (it.o.type === 'wagons' || it.o.type === 'train') && !it.part.ramp;

export class SensePowerup {
  constructor({ player, obstacles }) {
    this.player = player;
    this.obstacles = obstacles;
    this._lastPickupD = -Infinity;
    this.here = new PartList();
    this.there = new PartList();
    this.dodges = 0; // handy for tests

    obstacles.registerPickup('sense', {
      create: () => {
        const item = createSensePickup();
        item.root.scale.setScalar(S.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));
    this.reset();
  }

  reset() {
    if (game.state.senseTime > 0) emit('senseOff', { reset: true });
    game.state.senseTime = 0;
  }

  start() {
    const was = game.state.senseTime > 0;
    game.state.senseTime = S.duration;
    if (!was) emit('senseOn');
  }

  // Pattern extra: one roll per block always (keeps a shared track identical), then three
  // quarters into the route lane's free stretch (not in a block that already has a pickup).
  _place(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree || ctx.pickups > 0) return;
    const [d0, d1] = ctx.routeFree;
    const d = d0 + (d1 - d0) * 0.75;
    if (d1 - d0 < 8 || ctx.A - this._lastPickupD < S.pickupMinGap || roll >= S.pickupChance || !ctx.farFromPickup(d)) return;
    ctx.push({ type: 'pickup', kind: 'sense', lane: ctx.route, d, y: S.pickupY });
    this._lastPickupD = ctx.A;
  }

  update(dt) {
    const st = game.state;
    if (st.senseTime <= 0 || game.halted) return;
    st.senseTime = Math.max(0, st.senseTime - dt);
    if (st.senseTime <= 0) emit('senseOff');
  }

  beforePlayer() {
    if (game.state.senseTime <= 0) return;
    const p = this.player;
    if (p.controlsLocked || (game.web && game.web.zipping)) return;
    const v = game.state.speed;
    const active = this.obstacles.active;
    const here = this.here.collect(active, p.lane, v, S.lookAhead);
    const tHit = simulate(p, here, null, 0, S.lookAhead);
    if (tHit === Infinity) return; // nothing to dodge, or he already did the right thing

    // what is it?
    let threat = null;
    for (let i = 0; i < here.n; i++) {
      const it = here.items[i];
      if (tHit >= it.t0 - 1e-6 && tHit <= it.t1 + 1e-6 && (!threat || it.t0 < threat.t0)) threat = it;
    }
    const wall = threat && isWall(threat);
    if (tHit > (wall ? S.laneActTime : S.actTime)) return; // still time for the player himself

    const high = threat && threat.o.type === 'high';
    const order = wall ? ['lane', 'jump', 'slide'] : high ? ['slide', 'lane', 'jump'] : ['jump', 'lane', 'slide'];
    for (const a of order) {
      if (a === 'lane') {
        const dir = this._freeLane(p, v, active);
        if (dir) return this._do(dir < 0 ? 'left' : 'right', p);
        continue;
      }
      const r = this._vertical(p, here, a, tHit);
      if (r === 'now') return this._do(a, p);
      if (r === 'later') return; // the right moment is a frame or two away
    }
  }

  // 'now' if the action now avoids every hit, 'later' if only a slightly later one does, else null.
  _vertical(p, list, action, tHit) {
    if (simulate(p, list, action, 0, S.lookAhead) === Infinity) return 'now';
    for (let d = S.simStep * 2; d < tHit; d += S.simStep * 2) {
      if (simulate(p, list, action, d, S.lookAhead) === Infinity) return 'later';
    }
    return null;
  }

  // -1 / +1 toward a lane he can switch to now and stay in (or jump / slide on in) for a while.
  _freeLane(p, v, active) {
    let best = 0, bestScore = -1;
    const center = (CONFIG.laneCount - 1) / 2;
    for (const dir of [-1, 1]) {
      const lane = p.lane + dir;
      if (lane < 0 || lane >= CONFIG.laneCount) continue;
      const list = this.there.collect(active, lane, v, S.laneRankTime);
      // no contact from the side while moving over
      let side = false;
      for (let i = 0; i < list.n && !side; i++) {
        const it = list.items[i];
        if (it.t0 < CONFIG.laneSwitchTime + 0.04 && topAt(it, Math.max(0, it.t0)) > p.y + 0.1 && it.part.y0 < p.y + CONFIG.playerHeight) side = true;
      }
      if (side) continue;
      const t = simulate(p, list, null, 0, S.laneClearTime);
      let wallT = Infinity; // first wall / train face there
      for (let i = 0; i < list.n; i++) if (isWall(list.items[i]) && list.items[i].t0 > 0) wallT = Math.min(wallT, list.items[i].t0);
      let ok = t === Infinity;
      if (!ok && t > CONFIG.laneSwitchTime + 0.12) {
        // something to jump / slide there later is fine, a wall / train is not
        ok = wallT > t + 1e-6 && (this._vertical(p, list, 'jump', t) || this._vertical(p, list, 'slide', t)) !== null;
      }
      // prefer the lane whose next wall is furthest away, and the middle (two ways out)
      const score = Math.min(wallT, S.laneRankTime) + (lane === center ? S.centerBonus : 0);
      if (ok && score > bestScore) {
        best = dir;
        bestScore = score;
      }
    }
    return best;
  }

  _do(action, p) {
    if (action === 'left' || action === 'right') p.changeLane(action === 'left' ? -1 : 1);
    else if (action === 'slide') p.handleAction('down');
    else if (jumpable(p)) p.handleAction('up');
    else return;
    this.dodges++;
    emit('senseDodge', { action, position: _pos.set(p.x, p.y, 0).clone() }); // the player's position
  }
}
