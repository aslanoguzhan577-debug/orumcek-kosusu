// powerups/bugle.js — Bugle Manşeti: the Daily Bugle front page, and with it a x2 score
// multiplier (PLAN.md 10). Pickup: kind 'bugle', placed by a pattern-generator extra in the
// middle of the route lane's free stretch, as often as the magnet. Collecting sets
// game.state.bugleTime = the run's duration from shop.js and emits 'bugleOn'; game.js reads
// mult.factor = 2 off that time, so the score doubles for exactly as long as the gauge runs.
// The time counts down only while the run moves (not paused / intro / catch); at 0 -> 'bugleOff'.
// A pickup taken while it already runs only extends the time. Restart / menu emit 'bugleOff'
// {reset} and clear it. CONFIG.bugle.duration is the level 0 length; the market upgrade lengthens
// it, so the duration is asked from shop.js like magnet / sense do.

import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { createBuglePickup } from '../pickup-art.js';
import { getEffectiveSkillDuration } from '../shop.js';

const B = CONFIG.bugle;

export class BuglePowerup {
  constructor({ obstacles }) {
    this.obstacles = obstacles;
    this.active = false;
    this._lastPickupD = -Infinity;

    obstacles.registerPickup('bugle', {
      create: () => {
        const item = createBuglePickup();
        item.root.scale.setScalar(B.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));
    this.reset();
  }

  reset() {
    game.state.bugleTime = 0;
    if (this.active) {
      this.active = false;
      emit('bugleOff', { reset: true });
    }
  }

  start() {
    game.state.bugleTime = getEffectiveSkillDuration('bugle');
    if (this.active) return;
    this.active = true;
    emit('bugleOn');
  }

  // Pattern extra: one roll per block always, then the middle of the route lane's free stretch
  // (not in a block that already has a pickup).
  _place(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree || ctx.pickups > 0) return;
    const [d0, d1] = ctx.routeFree;
    const d = (d0 + d1) / 2;
    if (d1 - d0 < 4 || ctx.A - this._lastPickupD < B.pickupMinGap || roll >= B.pickupChance || !ctx.farFromPickup(d)) return;
    ctx.push({ type: 'pickup', kind: 'bugle', lane: ctx.route, d, y: B.pickupY });
    this._lastPickupD = ctx.A;
  }

  update(dt) {
    if (game.halted || !this.active) return;
    const st = game.state;
    st.bugleTime = Math.max(0, st.bugleTime - dt);
    if (st.bugleTime > 0) return;
    this.active = false;
    emit('bugleOff');
  }
}
