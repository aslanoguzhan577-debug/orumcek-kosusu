// powerups/decoy.js — Ağ Kuklası (PLAN.md 10): 20 seconds in which the first side stumble does
// not bring Venom nearer.
//
// Pickup: kind 'decoy', placed by a pattern-generator extra in the middle of the route lane's free
// stretch (the last extras only see the blocks the earlier ones passed on). Collecting sets
// game.state.decoyTime = CONFIG.decoy.duration and emits 'decoyOn'; it counts down only while the
// run moves (not paused / intro / catch), at 0 -> 'decoyOff' (restart / menu send 'decoyOff'
// {reset}).
//
// What the pickup does:
//   * a web-wrapped Spider-Man doll is left on the track right behind him (one dummy, built at
//     load; it scrolls back with the world and disappears CONFIG.decoy.behind metres behind);
//   * if Venom was close, he turns to the doll and falls straight back to CONFIG.chaser.farGap
//     ('decoyLure' — the mission counts those, so it only counts real baits);
//   * the first side stumble of the 20 seconds is forgiven. The stumble itself is untouched —
//     obstacles.js still bounces him back, plays the animation and emits 'stumble' — only the
//     chaser is not told about it. That is done by CHAINING obstacles.hooks.onSideStumble (the
//     chaser installs its own before this system is built), never by replacing it.
// The forgiveness is spent with the stumble: the doll topples over ('decoyUse') and the countdown
// ends with it. A front crash is still a crash: the doll only fools the side stumble.

import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { createDecoyPickup, createDecoyDummy } from '../pickup-art.js';

const D = CONFIG.decoy;
const FALL = 0.7;               // s the used-up doll takes to topple over and go out of sight

export class DecoyPowerup {
  constructor({ player, obstacles, chaser, scene }) {
    this.player = player;
    this.obstacles = obstacles;
    this.chaser = chaser;
    this.active = false;
    this.spare = 0;             // 1 = the next side stumble is forgiven
    this._lastPickupD = -Infinity;

    this.dummy = createDecoyDummy();
    this.dummy.root.visible = false;
    scene.add(this.dummy.root);
    this._z = 0;
    this._fall = 0;

    obstacles.registerPickup('decoy', {
      create: () => {
        const item = createDecoyPickup();
        item.root.scale.setScalar(D.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));

    const stumble = obstacles.hooks.onSideStumble;   // the chaser's own reaction, installed first
    obstacles.hooks.onSideStumble = (hit) => {
      if (this.spare > 0) return this._use();        // Venom is not told about this one
      return stumble && stumble(hit);
    };
    this.reset();
  }

  reset() {
    if (this.active) this._stop(true);
    game.state.decoyTime = 0;
    this.spare = 0;
    this._fall = 0;
    this.dummy.root.visible = false;
  }

  start() {
    const p = this.player;
    this.active = true;
    this.spare = 1;
    this._fall = 0;
    game.state.decoyTime = D.duration;
    this._z = 2.4;                                   // just behind him, in the lane he stands in
    this.dummy.root.position.set(p.x, p.y, this._z);
    this.dummy.root.visible = true;
    const lured = !!(this.chaser && this.chaser.isNear);
    if (lured) this.chaser._dropBack();
    const pos = { x: p.x, y: p.y, z: this._z };
    emit('decoyOn', { duration: D.duration, position: pos });
    if (lured) emit('decoyLure', { position: pos });
  }

  // The forgiven stumble: the doll has done its job, so the power is over with it.
  _use() {
    this.spare = 0;
    this._fall = FALL;
    const r = this.dummy.root;
    emit('decoyUse', { position: { x: r.position.x, y: r.position.y, z: r.position.z } });
    this._stop(false);
  }

  _stop(reset) {
    this.active = false;
    this.spare = 0;
    game.state.decoyTime = 0;
    emit('decoyOff', reset ? { reset: true } : {});
  }

  // Pattern extra: one roll per block always, then the middle of the route lane's free stretch
  // (not in a block that already has a pickup).
  _place(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree || ctx.pickups > 0) return;
    const [d0, d1] = ctx.routeFree;
    const d = (d0 + d1) / 2;
    if (d1 - d0 < 4 || ctx.A - this._lastPickupD < D.pickupMinGap || roll >= D.pickupChance || !ctx.farFromPickup(d)) return;
    ctx.push({ type: 'pickup', kind: 'decoy', lane: ctx.route, d, y: D.pickupY });
    this._lastPickupD = ctx.A;
  }

  // After obstacles.js moved the world: the doll is left behind, so it scrolls toward the camera.
  beforePlayer(dt) {
    if (!this.dummy.root.visible) return;
    const st = game.state;
    if (!game.halted) this._z += st.speed * dt;
    if (this._z > D.behind) { this.dummy.root.visible = false; return; }
    this.dummy.root.position.z = this._z;
    this.dummy.update(dt);
    if (this._fall > 0) {
      this._fall -= dt;
      this.dummy.lean.rotation.x -= (1 - Math.max(0, this._fall) / FALL) * 1.4; // falls onto his back
      if (this._fall <= 0) this.dummy.root.visible = false;
    }
  }

  update(dt) {
    if (!this.active) return;
    if (game.halted) { this._stop(true); return; }   // the catch froze the world
    const st = game.state;
    st.decoyTime = Math.max(0, st.decoyTime - dt);
    if (st.decoyTime <= 0) this._stop(false);
  }
}
