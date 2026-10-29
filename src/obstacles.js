// obstacles.js — obstacles and coins in play: spawning (from patterns.js), movement,
// standing surfaces (roofs, ramps), collisions, coin pickup, drawing (obstacle-art.js).
// Plugged into game as a system: beforePlayer(dt) -> player.update -> update(dt).
//
// Positions: each obstacle has a lane x and z = world z of its NEAR face (toward the
// player); it extends toward -Z by `length`. Static ones move at the run speed, oncoming
// trains at run speed + their own speed.
//
// ALL collision outcomes go through _hit() and these hooks (G8 / G10 plug in here):
//   obstacles.hooks.onFrontHit(hit) -> return true to absorb the crash (G10 Iron Spider)
//   obstacles.hooks.onCrash(hit)    -> what a crash does; default: knock down + game over
//                                      (G8 may play a "caught" sequence instead)
//   obstacles.hooks.onSideHit(hit)  -> after a stumble (G8 Venom closes in)
//   hit = { kind: 'front'|'side', obstacle, position: THREE.Vector3 }
// Helpers for G10: obstacles.active (list), obstacles.remove(obstacle),
//   obstacles.grace(seconds) = no collisions for a moment.
//
// Pickups (G9 web cartridge, G10 Iron Spider core):
//   obstacles.registerPickup(kind, { create: () => ({ root, update(dt) }), onCollect() })
// Pattern descriptors { type: 'pickup', kind, lane, d, y } then spawn pooled instances
// (built once, reused). Collecting calls onCollect() and emits pickup {type: kind}.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { emit } from './events.js';
import { game } from './game.js';
import { laneX } from './world.js';
import { PatternGenerator, randomSeed } from './patterns.js';
import { createObstacleArt } from './obstacle-art.js';

const O = CONFIG.obstacles;

// ---------- collision parts and visuals per obstacle kind ----------
// part: x0/x1 sideways from the lane centre, y0/y1 height, f0/f1 = distance from the near
// face toward -Z. ramp parts rise from 0 at f0 to y1 at f1.

function lowShape() {
  const w = O.low.width / 2;
  return {
    parts: [{ x0: -w, x1: w, y0: 0, y1: O.low.height, f0: 0, f1: O.low.depth }],
    visuals: [{ art: 'low', f: 0 }],
  };
}

function highShape() {
  const w = O.high.width / 2;
  return {
    parts: [{ x0: -w, x1: w, y0: O.high.bottom, y1: O.high.top, f0: 0, f1: O.high.depth }],
    visuals: [{ art: 'high', f: 0 }],
  };
}

function carShape() {
  const c = O.car;
  const w = c.width / 2;
  return {
    parts: [
      { x0: -w, x1: w, y0: 0, y1: c.hoodHeight, f0: 0, f1: c.hood },
      { x0: -w, x1: w, y0: 0, y1: c.height, f0: c.hood, f1: c.length - c.trunk },
      { x0: -w, x1: w, y0: 0, y1: c.hoodHeight, f0: c.length - c.trunk, f1: c.length },
    ],
    visuals: [{ art: 'car', f: 0 }],
  };
}

function wagonsShape(cars, ramp) {
  const w = O.wagon.width / 2;
  const parts = [];
  const visuals = [];
  let f = 0;
  if (ramp) {
    parts.push({ x0: -w, x1: w, y0: 0, y1: O.wagon.height, f0: 0, f1: O.rampLength, ramp: true });
    visuals.push({ art: 'ramp', f: 0 });
    f = O.rampLength;
  }
  for (let i = 0; i < cars; i++) {
    parts.push({ x0: -w, x1: w, y0: 0, y1: O.wagon.height, f0: f, f1: f + O.wagon.length });
    visuals.push({ art: 'wagon', f });
    f += O.wagon.length + O.wagon.gap;
  }
  return { parts, visuals };
}

// Shapes are shared between obstacles of the same kind (built once, never per frame).
const shapeCache = new Map();
function getShape(desc) {
  const key = desc.type + '|' + (desc.cars || 0) + '|' + (desc.ramp ? 1 : 0);
  let shape = shapeCache.get(key);
  if (!shape) {
    if (desc.type === 'low') shape = lowShape();
    else if (desc.type === 'high') shape = highShape();
    else if (desc.type === 'car') shape = carShape();
    else shape = wagonsShape(desc.cars, desc.ramp);
    shape.halfWidth = Math.max(...shape.parts.map((p) => Math.max(-p.x0, p.x1)));
    shapeCache.set(key, shape);
  }
  return shape;
}

function rampTop(p, f) {
  const t = (f - p.f0) / (p.f1 - p.f0);
  return p.y1 * Math.min(1, Math.max(0, t));
}

// ---------- the system ----------

export class Obstacles {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.art = createObstacleArt(scene);
    this.generator = new PatternGenerator(1);
    this.seed = 0;
    this.fixedSeed = CONFIG.seed;  // set a number for the same track every run ("daily track")

    this.active = [];        // obstacles in play
    this._pool = [];         // released obstacle objects for reuse
    this.pendingTrains = []; // oncoming train descriptors waiting to appear
    this.coins = [];         // coins in play
    this._coinPool = [];
    this.pickupKinds = {};   // kind -> { create, onCollect, pool }
    this.pickups = [];       // pickups in play: { kind, x, y, z, item }
    this._time = 0;
    this._sideHitTimer = 0;
    this._graceTimer = 0;
    this._hitPos = new THREE.Vector3();

    this.hooks = {
      onFrontHit: () => false,
      onSideHit: () => {},
      onCrash: () => {
        this.player.setOverride('caught', Infinity);
        this.player.controlsLocked = true;
        game.gameOver();
      },
    };

    // New ground appears at the far end -> generate patterns up to there.
    world.onRecycle((segment) => {
      const farD = world.distance - (segment.group.position.z - segment.length / 2);
      this._generateUntil(farD);
    });

    this.reset();
  }

  // ---------- run start ----------

  reset() {
    for (const o of this.active) this._pool.push(o);
    this.active.length = 0;
    for (const c of this.coins) this._coinPool.push(c);
    this.coins.length = 0;
    this.pendingTrains.length = 0;
    for (let i = this.pickups.length - 1; i >= 0; i--) this._releasePickup(i);
    this._sideHitTimer = 0;
    this._graceTimer = 0;

    this.seed = this.fixedSeed != null ? this.fixedSeed : randomSeed();
    this.generator.reset(this.seed);
    let farZ = 0;
    for (const s of this.world.segments) farZ = Math.min(farZ, s.group.position.z - s.length / 2);
    this._generateUntil(this.world.distance - farZ);
    this._draw();
  }

  // ---------- spawning ----------

  _generateUntil(d) {
    const descs = this.generator.generateUntil(d);
    for (const desc of descs) this._spawn(desc);
  }

  _spawn(desc) {
    const ground = this.world.distance;
    if (desc.type === 'coin') {
      const c = this._coinPool.pop() || {};
      c.x = laneX(desc.lane);
      c.y = desc.y;
      c.z = -(desc.d - ground);
      this.coins.push(c);
    } else if (desc.type === 'train') {
      this.pendingTrains.push(desc);
    } else if (desc.type === 'pickup') {
      this._addPickup(desc.kind, laneX(desc.lane), desc.y, -(desc.d - ground));
    } else {
      this._addObstacle(desc, -(desc.d - ground), 0);
    }
  }

  _addObstacle(desc, z, speed) {
    const shape = getShape(desc);
    const o = this._pool.pop() || {};
    o.type = desc.type;
    o.lane = desc.lane;
    o.x = laneX(desc.lane);
    o.z = z;
    o.dz = 0;
    o.length = desc.len;
    o.speed = speed;
    o.color = desc.color || 0;
    o.parts = shape.parts;
    o.visuals = shape.visuals;
    o.halfWidth = shape.halfWidth;
    this.active.push(o);
    return o;
  }

  // An oncoming train appears when it is spawnDistance ahead and placed so that it
  // meets the player at its planned ground distance (desc.d).
  _spawnTrains(v) {
    const ground = this.world.distance;
    for (let i = this.pendingTrains.length - 1; i >= 0; i--) {
      const t = this.pendingTrains[i];
      const ahead = ((t.d - ground) * (v + t.speed)) / v;
      if (ahead <= O.spawnDistance) {
        this._addObstacle(t, -ahead, t.speed);
        this.pendingTrains.splice(i, 1);
      }
    }
  }

  // ---------- pickups ----------

  registerPickup(kind, def) {
    this.pickupKinds[kind] = { create: def.create, onCollect: def.onCollect || (() => {}), pool: [] };
  }

  _addPickup(kind, x, y, z) {
    const def = this.pickupKinds[kind];
    if (!def) return;
    let item = def.pool.pop();
    if (!item) {
      item = def.create();
      this.scene.add(item.root);
    }
    item.root.visible = true;
    item.root.position.set(x, y, z);
    this.pickups.push({ kind, x, y, z, item });
  }

  _releasePickup(i) {
    const pk = this.pickups[i];
    pk.item.root.visible = false;
    this.pickupKinds[pk.kind].pool.push(pk.item);
    this.pickups.splice(i, 1);
  }

  // Move everything along the track by dz (negative = further ahead). Used by the catch
  // knockback (G8) while the world is halted.
  shift(dz) {
    for (const o of this.active) o.z += dz;
    for (const c of this.coins) c.z += dz;
    for (const pk of this.pickups) {
      pk.z += dz;
      pk.item.root.position.z = pk.z;
    }
    this._draw();
  }

  grace(seconds) {
    this._graceTimer = Math.max(this._graceTimer, seconds);
  }

  remove(o) {
    const i = this.active.indexOf(o);
    if (i >= 0) {
      this.active.splice(i, 1);
      this._pool.push(o);
    }
  }

  // ---------- per frame ----------

  // Move everything, then tell the player what is under its feet.
  beforePlayer(dt) {
    const v = game.state.speed;
    const backZ = O.releaseZ;
    this._time += dt;
    this._sideHitTimer -= dt;
    this._graceTimer -= dt;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      o.dz = (v + o.speed) * dt;
      o.z += o.dz;
      if (o.z - o.length > backZ) {
        this.active.splice(i, 1);
        this._pool.push(o);
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.z += v * dt;
      if (c.z > backZ) {
        this.coins.splice(i, 1);
        this._coinPool.push(c);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.z += v * dt;
      if (pk.z > backZ) this._releasePickup(i);
    }
    this._spawnTrains(Math.max(v, 1));

    this.player.floorY = this._floorUnder(this.player, v, dt);
  }

  update(dt) {
    if (game.halted) return; // catch sequence: everything stands still
    this._collide();
    this._collectCoins();
    this._collectPickups();
    this._draw();
    for (const pk of this.pickups) {
      pk.item.root.position.set(pk.x, pk.y, pk.z);
      pk.item.update(dt);
    }
  }

  _collectPickups() {
    const p = this.player;
    const h = p.sliding ? CONFIG.slideHeight : CONFIG.playerHeight;
    const hw = CONFIG.playerWidth / 2;
    const hd = CONFIG.playerDepth / 2;
    const s = 0.55; // pickups are about 1 m tall, origin at the bottom
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      if (pk.z - s > hd || pk.z + s < -hd) continue;
      if (pk.x - s > p.x + hw || pk.x + s < p.x - hw) continue;
      if (pk.y > p.y + h || pk.y + 1.1 < p.y) continue;
      this.pickupKinds[pk.kind].onCollect();
      emit('pickup', { type: pk.kind, position: new THREE.Vector3(pk.x, pk.y + 0.5, pk.z) });
      this._releasePickup(i);
    }
  }

  // Highest surface under the player that it is standing on or above (within stepUp).
  _floorUnder(p, v, dt) {
    const hw = CONFIG.playerWidth / 2 - 0.05;
    const hd = CONFIG.playerDepth / 2;
    let floor = 0;
    for (const o of this.active) {
      if (p.x + hw < o.x - o.halfWidth || p.x - hw > o.x + o.halfWidth) continue;
      const fMin = o.z - hd;
      const fMax = o.z + hd;
      if (fMax < 0 || fMin > o.length) continue;
      for (const part of o.parts) {
        if (fMax < part.f0 || fMin > part.f1) continue;
        if (p.x + hw < o.x + part.x0 || p.x - hw > o.x + part.x1) continue;
        let top = part.y1;
        let allowance = O.stepUp;
        if (part.ramp) {
          top = rampTop(part, Math.min(fMax, part.f1));
          // the ramp rises under a running player by slope * distance per frame
          allowance += (part.y1 / (part.f1 - part.f0)) * (v + o.speed) * dt * 1.5;
        }
        if (top > floor && p.y + allowance >= top) floor = top;
      }
    }
    return floor;
  }

  _collide() {
    if (this._graceTimer > 0) return;
    const p = this.player;
    const h = p.sliding ? CONFIG.slideHeight : CONFIG.playerHeight;
    const hw = CONFIG.playerWidth / 2 - 0.08;
    const hz = CONFIG.playerDepth / 2 - 0.05;
    const x0 = p.x - hw, x1 = p.x + hw;
    const y0 = p.y + 0.1, y1 = p.y + h - 0.05;
    const px0 = p.lastX - hw, px1 = p.lastX + hw;
    const py0 = p.lastY + 0.1, py1 = p.lastY + h - 0.05;
    const dxAbs = Math.abs(p.x - p.lastX);

    for (const o of this.active) {
      if (x1 < o.x - o.halfWidth || x0 > o.x + o.halfWidth) continue;
      const fMin = o.z - hz, fMax = o.z + hz;              // player's span in the obstacle's f
      const pfMin = fMin - o.dz, pfMax = fMax - o.dz;       // ... one frame ago
      // swept span [pfMin, fMax]: a thin bar must not slip through between two frames
      // (closing speed up to ~40 m/s; at 30 fps that is more than bar + player depth)
      if (fMax < 0 || pfMin > o.length) continue;
      for (const part of o.parts) {
        const ax0 = o.x + part.x0, ax1 = o.x + part.x1;
        if (fMax <= part.f0 || pfMin >= part.f1 || x1 <= ax0 || x0 >= ax1) continue;
        const top = part.ramp ? rampTop(part, Math.min(fMax, part.f1)) : part.y1;
        if (y1 <= part.y0 || y0 >= top) continue;

        // Overlap. Which side did we come in from?
        const prevTop = part.ramp ? rampTop(part, Math.min(pfMax, part.f1)) : part.y1;
        const zSep = pfMax <= part.f0 || pfMin >= part.f1;
        const xSep = px1 <= ax0 || px0 >= ax1;
        const ySep = py0 >= prevTop || py1 <= part.y0;
        let kind;
        if (zSep && !xSep) kind = 'front';
        else if (xSep && !zSep) kind = 'side';
        else if (zSep && xSep) {
          // both: the axis crossed last (smaller share of this frame) is the hit side
          const tz = Math.min(fMax - part.f0, part.f1 - fMin) / Math.max(o.dz, 1e-6);
          const tx = Math.min(x1 - ax0, ax1 - x0) / Math.max(dxAbs, 1e-6);
          kind = tz <= tx ? 'front' : 'side';
        } else if (ySep && py1 <= part.y0) kind = 'front'; // jumped up into a bar
        else continue; // already inside last frame, or landing from above (floor handles it)

        this._hit(kind, o);
        return; // one hit per frame
      }
    }
  }

  _hit(kind, o) {
    const p = this.player;
    const hit = { kind, obstacle: o, position: this._hitPos.set(p.x, p.y + 0.8, -CONFIG.playerDepth / 2) };
    if (kind === 'side') {
      if (this._sideHitTimer > 0) return;
      this._sideHitTimer = O.sideHitCooldown;
      p.bounceBack();
      p.setOverride('stumble', O.stumbleTime);
      emit('stumble', { position: hit.position.clone() });
      this.hooks.onSideHit(hit);
      return;
    }
    if (this.hooks.onFrontHit(hit)) return; // absorbed (G10)
    emit('crash', { position: hit.position.clone() });
    this.hooks.onCrash(hit);
  }

  _collectCoins() {
    const p = this.player;
    const s = CONFIG.coins.pickupSize;
    const h = p.sliding ? CONFIG.slideHeight : CONFIG.playerHeight;
    const hw = CONFIG.playerWidth / 2;
    const hd = CONFIG.playerDepth / 2;
    const st = game.state;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (c.z - s > hd || c.z + s < -hd) continue;
      if (c.x - s > p.x + hw || c.x + s < p.x - hw) continue;
      if (c.y - s > p.y + h || c.y + s < p.y) continue;
      st.coins++;
      emit('coin', { position: new THREE.Vector3(c.x, c.y, c.z) });
      this.coins.splice(i, 1);
      this._coinPool.push(c);
    }
  }

  _draw() {
    const art = this.art;
    art.begin();
    for (const o of this.active) {
      for (const vis of o.visuals) art.add(vis.art, o.x, 0, o.z - vis.f, o.color);
    }
    for (const c of this.coins) art.addCoin(c.x, c.y, c.z);
    art.end(this._time);
  }
}
