// powerups/spring.js — Örümcek Yayı: web-spring shoes (PLAN.md 10). Pickup: kind 'spring',
// placed by a pattern-generator extra in the middle of the route lane's free stretch, as often
// as the magnet. Collecting sets game.state.springTime = CONFIG.spring.duration and emits
// 'springOn'; it counts down only while the run moves, at 0 -> 'springOff'. Restart / menu clear
// it ('springOff' {reset}).
//
// The higher jump is not done here: game.js exports jumpScale(), which reads this timer, and
// player.js uses it as the default height of jump() (sense.js' dodges through the same scale).
// Everything that shows it — glowing soles, the web ring on take-off — is fx.js' job, driven by
// these events like the magnet's and the sense's effects.

import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { createSpringPickup } from '../pickup-art.js';

const S = CONFIG.spring;

export class SpringPowerup {
  constructor({ obstacles }) {
    this.obstacles = obstacles;
    this.active = false;
    this._lastPickupD = -Infinity;

    obstacles.registerPickup('spring', {
      create: () => {
        const item = createSpringPickup();
        item.root.scale.setScalar(S.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));
    this.reset();
  }

  reset() {
    game.state.springTime = 0;
    if (this.active) {
      this.active = false;
      emit('springOff', { reset: true });
    }
  }

  start() {
    game.state.springTime = S.duration;
    if (this.active) return;
    this.active = true;
    emit('springOn');
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
    ctx.push({ type: 'pickup', kind: 'spring', lane: ctx.route, d, y: S.pickupY });
    this._lastPickupD = ctx.A;
  }

  update(dt) {
    if (game.halted || !this.active) return;
    const st = game.state;
    st.springTime = Math.max(0, st.springTime - dt);
    if (st.springTime > 0) return;
    this.active = false;
    emit('springOff');
  }
}
