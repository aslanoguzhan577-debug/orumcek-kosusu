// powerups/ironspider.js — G10: Iron Spider cores and the Iron Spider suit.
//
// Cores: placed by a pattern-generator extra on free stretches of the route lane (rare).
// Collecting adds one to game.state.ironCount (max CONFIG.iron.maxCount). The count is a
// persistent inventory: saved in localStorage (CONFIG.iron.storageKey), loaded at startup.
//
// Suit: player.hooks.onDoubleAction (double tap / Space) while running, not halted or
// caught, with a core and the suit off -> one core used, the player's model switches to
// Iron Spider (built once in main.js, roots toggled), game.state.ironTime = duration,
// emit('ironOn'). The timer runs only while running and not halted; at 0 -> back to
// Spider-Man, emit('ironOff').
//
// One save: while suited, a front crash (obstacles.hooks.onFrontHit) or a Venom catch from
// a 2nd stumble (chaser.hooks.absorbCatch) is absorbed instead:
//   1. the suit breaks at once (ironTime = 0, model back, emit('ironOff'));
//   2. everything that would reach the player within clearTime seconds, in every lane, is
//      removed, each by its own closing speed (run speed + an oncoming train's own speed),
//      including what was hit; emit('ironSave', {positions});
//   3. a short grace period with no collisions.
// Side stumbles stay normal stumbles. Restart / menu drop the suit (no refund).
//
// Gold arms (visual only): while suited and sliding, the nearest high barrier ahead in the
// player's lane (within a speed-aware reach) is reported every frame to
// ironModel.setGrabTarget(pos | null) — pos = bottom edge of its board at the lane centre.
// When that barrier passes over the player: emit('ironGrab', {position}) once.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import { createIronPickup } from '../pickup-art.js';

const I = CONFIG.iron;
const _grab = new THREE.Vector3();

function loadCount() {
  try {
    const n = parseInt(localStorage.getItem(I.storageKey), 10);
    return Number.isFinite(n) ? Math.min(I.maxCount, Math.max(0, n)) : 0;
  } catch (e) {
    return 0;
  }
}

function saveCount(n) {
  try {
    localStorage.setItem(I.storageKey, String(n));
  } catch (e) { /* private mode etc. */ }
}

export class IronSpiderPowerup {
  constructor({ player, obstacles, chaser, ironModel }) {
    this.player = player;
    this.obstacles = obstacles;
    this.normalModel = player.model;
    this.ironModel = ironModel;
    this.active = false;
    this._lastPickupD = -Infinity;

    // the Iron Spider model hangs under the player root, hidden until needed
    player.root.add(ironModel.root);
    ironModel.root.visible = false;

    game.state.ironCount = loadCount();

    obstacles.registerPickup('iron', {
      create: () => {
        const item = createIronPickup();
        item.root.scale.setScalar(I.pickupScale);
        return item;
      },
      onCollect: () => {
        game.state.ironCount = Math.min(I.maxCount, game.state.ironCount + 1);
        saveCount(game.state.ironCount);
      },
    });
    obstacles.generator.addExtra((ctx) => this._placeCore(ctx));

    player.hooks.onDoubleAction = () => this.activate();
    obstacles.hooks.onFrontHit = () => this._absorb();
    chaser.hooks.absorbCatch = () => this._absorb();
  }

  // Run start / menu: drop the suit, no refund.
  reset() {
    if (this.active) this._suitOff(false);
    game.state.ironTime = 0;
  }

  // Pattern extra: one roll per block always (the shared track stays identical), then a
  // core at a quarter of the route lane's free stretch (the web cartridge uses the middle).
  _placeCore(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree) return;
    const [d0, d1] = ctx.routeFree;
    if (d1 - d0 < 8 || ctx.A - this._lastPickupD < I.pickupMinGap) return;
    const full = game.state.ironCount >= I.maxCount;
    if (roll >= (full ? I.pickupChanceFull : I.pickupChance)) return;
    ctx.push({ type: 'pickup', kind: 'iron', lane: ctx.route, d: d0 + (d1 - d0) * 0.25, y: I.pickupY });
    this._lastPickupD = ctx.A;
  }

  activate() {
    const st = game.state;
    if (this.active || st.mode !== 'running' || game.halted || this.player.controlsLocked) return false;
    if (st.ironCount <= 0) return false;
    st.ironCount--;
    saveCount(st.ironCount);
    this.active = true;
    st.ironTime = I.duration;
    this.player.useModel(this.ironModel);
    emit('ironOn');
    return true;
  }

  update(dt) {
    if (!this.active || game.halted) return;
    const st = game.state;
    st.ironTime = Math.max(0, st.ironTime - dt);
    if (st.ironTime <= 0) {
      this._suitOff(true);
      return;
    }
    this._updateGrab();
  }

  // Gold arms: tell the model which high barrier to grab; ironGrab as it passes overhead.
  _updateGrab() {
    const p = this.player;
    let best = null;
    if (p.sliding) {
      const reach = THREE.MathUtils.clamp(game.state.speed * I.grabLeadTime, I.grabReachMin, I.grabReachMax);
      const x = laneX(p.lane);
      for (const o of this.obstacles.active) {
        if (o.type !== 'high' || Math.abs(o.x - x) > 0.5) continue;
        const mid = o.z - o.length / 2;               // board centre (world z)
        if (mid < -reach || mid - o.dz >= 0) continue; // too far, or already passed before this frame
        if (!best || o.z > best.z) best = o;
        if (mid >= 0) {                                // crossed the player's z this frame
          _grab.set(o.x, CONFIG.obstacles.high.bottom, mid);
          emit('ironGrab', { position: _grab.clone() });
        }
      }
    }
    if (best) _grab.set(best.x, CONFIG.obstacles.high.bottom, best.z - best.length / 2);
    if (this.ironModel.setGrabTarget) this.ironModel.setGrabTarget(best ? _grab : null);
  }

  _suitOff(withEvent) {
    this.active = false;
    game.state.ironTime = 0;
    this.player.useModel(this.normalModel);
    if (this.ironModel.setGrabTarget) this.ironModel.setGrabTarget(null);
    if (withEvent) emit('ironOff');
  }

  // Front crash or Venom catch while suited: break the suit, clear the road, grace.
  _absorb() {
    if (!this.active) return false;
    this._suitOff(true);

    const v = game.state.speed;
    const hd = CONFIG.playerDepth / 2;
    const positions = [];
    const list = this.obstacles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (o.z - o.length > hd) continue;                    // already behind the player
      const reach = (v + o.speed) * I.clearTime + hd;       // its own closing speed
      if (o.z < -reach) continue;                           // too far ahead
      const part = o.parts[o.parts.length > 1 && o.parts[0].ramp ? 1 : 0];
      positions.push(new THREE.Vector3(o.x, (part.y0 + part.y1) / 2, Math.min(o.z, -hd)));
      this.obstacles.remove(o);
    }
    this.obstacles.grace(I.graceTime);
    emit('ironSave', { positions });
    return true;
  }
}
