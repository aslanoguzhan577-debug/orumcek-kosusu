// powerups/magnet.js — the coin magnet.
//
// Pickup: kind 'magnet', placed by a pattern-generator extra in the middle of the route lane's
// free stretch (about as often as the web cartridge). Collecting starts it at once:
// game.state.magnetTime = CONFIG.magnet.duration, emit('magnetOn'); it counts down only while
// the run moves, at 0 -> emit('magnetOff'). Restart / menu clear it (magnetOff {reset}).
//
// While on, every coin within `ahead` metres in front (up to `behind` behind), `side` metres to
// the side — all three lanes — at any height (roofs too) leaves obstacles.coins and flies to
// Spider-Man's chest: its start point keeps scrolling with the world and the flight blends from
// it to him with a smoothstep plus an upward bow, so it leaves at its own speed (no pop) and
// arrives exactly on him. emit('magnetCoin', {position}) when a coin starts flying (its world
// position then; the fx streak lasts CONFIG.magnet.flyTime); on arrival it counts like any coin:
// game.state.coins++, emit('coin', {position}). Coins in flight are the pooled coin objects themselves
// (drawn through obstacles.extraCoins in the same InstancedMesh, back to the coin pool after);
// no per-frame allocation.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { createMagnetPickup } from '../pickup-art.js';
import { getEffectiveSkillDuration } from '../shop.js';

const M = CONFIG.magnet;

export class MagnetPowerup {
  constructor({ player, obstacles }) {
    this.player = player;
    this.obstacles = obstacles;
    this.flying = [];
    this._lastPickupD = -Infinity;
    obstacles.extraCoins = this.flying; // drawn with the other coins

    obstacles.registerPickup('magnet', {
      create: () => {
        const item = createMagnetPickup();
        item.root.scale.setScalar(M.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));
    this.reset();
  }

  reset() {
    for (const c of this.flying) this.obstacles._coinPool.push(c);
    this.flying.length = 0;
    if (game.state.magnetTime > 0) emit('magnetOff', { reset: true });
    game.state.magnetTime = 0;
  }

  start() {
    const was = game.state.magnetTime > 0;
    game.state.magnetTime = getEffectiveSkillDuration('magnet');
    if (!was) emit('magnetOn');
  }

  // Pattern extra: one roll per block always, then the middle of the route lane's free stretch
  // (not in a block that already has a pickup).
  _place(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree || ctx.pickups > 0) return;
    const [d0, d1] = ctx.routeFree;
    const d = (d0 + d1) / 2;
    if (d1 - d0 < 4 || ctx.A - this._lastPickupD < M.pickupMinGap || roll >= M.pickupChance || !ctx.farFromPickup(d)) return;
    ctx.push({ type: 'pickup', kind: 'magnet', lane: ctx.route, d, y: M.pickupY });
    this._lastPickupD = ctx.A;
  }

  update(dt) {
    const st = game.state;
    if (game.halted) {
      if (this.flying.length) this._land(0, true); // catch sequence: whatever is in the air counts
      return;
    }
    if (st.magnetTime <= 0) return;
    st.magnetTime = Math.max(0, st.magnetTime - dt);
    if (st.magnetTime <= 0) emit('magnetOff');
  }

  // After obstacles moved the coins, before they are drawn (obstacles.update).
  beforePlayer(dt) {
    const p = this.player;
    const v = game.state.speed;
    const fly = this.flying;
    for (let i = fly.length - 1; i >= 0; i--) {
      const c = fly[i];
      c.t += dt / M.flyTime;
      c.sz += v * dt; // the start point keeps moving with the world
      if (c.t >= 1) {
        this._land(i, false);
        continue;
      }
      const e = c.t * c.t * (3 - 2 * c.t);
      c.x = c.sx + (p.x - c.sx) * e;
      c.y = c.sy + (p.y + M.chest - c.sy) * e + M.arc * Math.sin(Math.PI * c.t);
      c.z = c.sz * (1 - e);
    }

    if (game.state.magnetTime <= 0) return;
    const coins = this.obstacles.coins;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.z < -M.ahead || c.z > M.behind || Math.abs(c.x - p.x) > M.side) continue;
      coins[i] = coins[coins.length - 1]; // swap-remove (order does not matter)
      coins.pop();
      c.sx = c.x;
      c.sy = c.y;
      c.sz = c.z;
      c.t = 0;
      fly.push(c);
      emit('magnetCoin', { position: new THREE.Vector3(c.x, c.y, c.z) }); // fx streak over flyTime
    }
  }

  // Count flying coin i (all of them if `all`), return it to the pool.
  _land(i, all) {
    const fly = this.flying;
    const st = game.state;
    for (let j = all ? fly.length - 1 : i; j >= (all ? 0 : i); j--) {
      const c = fly[j];
      st.coins++;
      emit('coin', { position: new THREE.Vector3(c.x, c.y, c.z) });
      fly[j] = fly[fly.length - 1];
      fly.pop();
      this.obstacles._coinPool.push(c);
    }
  }
}
