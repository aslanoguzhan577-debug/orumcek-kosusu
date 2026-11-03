// powerups/swing.js — Ağ Salınışı (PLAN.md 10): 8 seconds of swinging high between the buildings.
//
// Pickup: kind 'swing', placed by a pattern-generator extra in the middle of the route lane's free
// stretch, a little rarer than the magnet. Collecting sets game.state.swingTime =
// CONFIG.swing.duration and emits 'swingOn'; it counts down only while the run moves, at 0 ->
// 'swingOff' (restart / menu send 'swingOff' {reset}).
//
// The flight is the two mechanics the game already has:
//   * skillHelloKitty.js / skillBatman.js: the height is written into player.floorY, so the player
//     stays "grounded" and every obstacle surface keeps working — a smooth take-off and landing
//     with a liftRatio, and obstacles.grace() so nothing can hit him;
//   * intro.js' swing clip: one parabola per CONFIG.swing.arcTime (highest at its ends, lowest in
//     its middle), with the web line to an anchor high on the facade of one side of the street,
//     shot again every arc and alternating sides (web.drawLineTo / web.hideLine).
// Left and right still change lanes; up and down do nothing (player.verticalLocked). Venom falls
// back on take-off, the landing gives the usual 1.5 s of grace.
//
// The coins: while he swings, a ribbon of ordinary coins is laid at the arc's height, one every
// CONFIG.coins.spacing metres, snaking across all three lanes. They are pooled coin objects in
// obstacles.coins, so collecting, the magnet, the coin streaks and the coin missions all work.

import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import { createSwingPickup } from '../pickup-art.js';

const S = CONFIG.swing;
const smoothstep = (t) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

export class SwingPowerup {
  constructor({ player, obstacles, web, chaser }) {
    this.player = player;
    this.obstacles = obstacles;
    this.web = web;
    this.chaser = chaser;
    this.active = false;
    this.time = 0;             // seconds since the swing started (drives the arcs)
    this.offset = 0;           // his height above the track right now
    this.surfaceY = 0;         // what obstacles.js put under him before the web lifted him
    this._arc = -1;            // arc index: a new one shoots a new web
    this._lastPickupD = -Infinity;
    this._anchor = { x: 0, y: 0, z: 0 };
    this._coinAcc = 0;         // metres of coin ribbon owed
    this._coinLane = 1;
    this._coinDir = 1;

    obstacles.registerPickup('swing', {
      create: () => {
        const item = createSwingPickup();
        item.root.scale.setScalar(S.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));
    this.reset();
  }

  // The arc's height above the track at swing time t: CONFIG.swing.height, ±arcRise.
  _arcY(t) {
    const k = 2 * ((t % S.arcTime) / S.arcTime) - 1;
    return S.height - S.arcRise + 2 * S.arcRise * k * k;
  }

  reset() {
    if (this.active) this._stop(true);
    game.state.swingTime = 0;
    this.time = 0;
    this.offset = 0;
    this.surfaceY = 0;
    this._arc = -1;
    this._coinAcc = 0;
    this._coinLane = 1;
    this._coinDir = 1;
  }

  // Another flight already owns the height: the pickup still counts as a power-up (obstacles.js
  // emits it before calling this), only the swing itself is skipped.
  start() {
    const hs = game.heroSpecials, rep = game.repulsor;
    if (this.player.controlsLocked || this.player.verticalLocked || game.halted
      || (hs && hs.active) || (rep && rep.active) || (game.web && game.web.zipping)) return;
    this.active = true;
    this.time = 0;
    this._arc = -1;
    this._coinAcc = 0;
    game.state.swingTime = S.duration;
    this.player.verticalLocked = true;
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') this.chaser._dropBack();
    emit('swingOn', { duration: S.duration });
  }

  _stop(reset) {
    this.active = false;
    game.state.swingTime = 0;
    this.player.verticalLocked = false;
    this.web.hideLine();
    if (!reset) this.obstacles.grace(1.5); // the landing
    emit('swingOff', reset ? { reset: true } : {});
  }

  // Pattern extra: one roll per block always, then the middle of the route lane's free stretch
  // (not in a block that already has a pickup).
  _place(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree || ctx.pickups > 0) return;
    const [d0, d1] = ctx.routeFree;
    const d = (d0 + d1) / 2;
    if (d1 - d0 < 4 || ctx.A - this._lastPickupD < S.pickupMinGap || roll >= S.pickupChance || !ctx.farFromPickup(d)) return;
    ctx.push({ type: 'pickup', kind: 'swing', lane: ctx.route, d, y: S.pickupY });
    this._lastPickupD = ctx.A;
  }

  // After obstacles.js set player.floorY, before the player moves.
  beforePlayer(dt) {
    if (!this.active || game.halted) return;
    const p = this.player;
    const st = game.state;
    this.time += dt;

    let lift = 1;
    if (this.time < S.takeoffTime) lift = smoothstep(this.time / S.takeoffTime);
    else if (st.swingTime < S.landingTime) lift = smoothstep(st.swingTime / S.landingTime);
    this.offset = lift * this._arcY(this.time);

    this.surfaceY = p.floorY || 0;
    // the altitude is measured from the street, so a wagon roof cannot lift him higher; at the end
    // the lift falls away and he lands on whatever surface is under him
    p.floorY = Math.max(this.surfaceY, this.offset);
    if (p.grounded || p.y < p.floorY) { p.y = p.floorY; p.vy = 0; p.grounded = true; }
    const ov = p.override;
    if (this.offset > 0.4 && (!ov || ov === 'swing')) p.setOverride('swing', 0.1);

    // nothing reaches him up here; the two ramps are covered by the grace too
    this.obstacles.grace(0.2);

    const v = st.speed;
    this._anchor.z += v * dt; // the facade scrolls with the world
    const arc = Math.floor(this.time / S.arcTime);
    if (arc !== this._arc) {
      this._arc = arc;
      const side = arc % 2 ? -1 : 1;
      this._anchor.x = side * CONFIG.web.anchorSide;
      this._anchor.y = S.height + S.anchorRise;
      this._anchor.z = -(S.anchorAhead + (v * S.arcTime) / 2);
      emit('swingArc', { side });
    }
    this.web.drawLineTo(this._anchor);
    this._coins(dt, v);
  }

  update(dt) {
    if (!this.active) return;
    // the catch / crash sequence froze the world: end quietly, a web line may not survive it
    if (game.halted) { this._stop(true); return; }
    const st = game.state;
    st.swingTime = Math.max(0, st.swingTime - dt);
    if (st.swingTime <= 0) this._stop(false);
  }

  // A coin every CONFIG.coins.spacing metres, at the height he will be at when it reaches him,
  // snaking over all three lanes. None during the take-off and the last CONFIG.swing.coinStop
  // seconds, so the ribbon never starts or ends in a landing.
  _coins(dt, v) {
    const st = game.state;
    if (this.time < S.takeoffTime || st.swingTime <= S.coinStop) return;
    this._coinAcc += v * dt;
    const spacing = CONFIG.coins.spacing;
    const lead = S.coinAhead / Math.max(1, v);
    while (this._coinAcc >= spacing) {
      this._coinAcc -= spacing;
      const lane = this._coinLane;
      let next = lane + this._coinDir;
      if (next < 0 || next >= CONFIG.laneCount) { this._coinDir = -this._coinDir; next = lane + this._coinDir; }
      this._coinLane = next;
      const c = this.obstacles._coinPool.pop() || {};
      c.x = laneX(lane);
      c.y = this._arcY(this.time + lead) + CONFIG.coins.height;
      c.z = -S.coinAhead;
      this.obstacles.coins.push(c);
    }
  }
}
