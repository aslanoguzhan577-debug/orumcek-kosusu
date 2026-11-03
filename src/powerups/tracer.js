// powerups/tracer.js — Örümcek İzi (PLAN.md 10): seconds (CONFIG.tracer.duration at level 0, longer
// with the market upgrade) in which a little spider-drone flies ahead and paints a glowing web strip
// on the open lane; staying on that strip pays.
//
// Pickup: kind 'tracer', placed by a pattern-generator extra in the middle of the route lane's free
// stretch. Collecting sets game.state.tracerTime to the duration shop.js gives the level and emits
// 'tracerOn'; it counts down only while the run moves, at 0 -> 'tracerOff' (restart / menu send
// 'tracerOff' {reset}).
//
// Which lane is "the open one" is not guessed: the generator already decided it. Its fairness rule
// keeps one route lane with at most one passable obstacle per block, and the extra is called once
// per block with ctx = { A, B, route } — so the power-up just records { d0, d1, lane } per block and
// the strip is laid on that lane. The route only moves one lane at a time and only where both lanes
// are free, so the strip may cross the track diagonally but never over a wall.
//
// The pay: while the player is within half a strip + half a body of the traced lane,
// game.mult.temp grows by 1 every CONFIG.tracer.stepTime seconds, up to CONFIG.tracer.maxTemp
// (game.js adds temp to base + run before the Bugle's factor). Stepping off the strip zeroes temp
// and restarts the timer ('tracerLost'); the end zeroes it too. missions.js counts 'tracerStep'.
//
// The visuals are pickup-art.js's: the drone (createTracerDrone) hovers CONFIG.tracer.ahead metres
// in front at CONFIG.tracer.height, and the strip (createTracerRibbon, ONE InstancedMesh) is
// relaid from CONFIG.tracer.ribbonTail metres behind him to leadTime seconds of track ahead, one
// stamp every ribbonSpacing metres.

import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import { createTracerPickup, createTracerDrone, createTracerRibbon } from '../pickup-art.js';
import { getEffectiveSkillDuration } from '../shop.js';

const T = CONFIG.tracer;
// the longest strip there can be: behind the player, under the drone, and leadTime seconds ahead
const RIB = Math.ceil((T.ahead + CONFIG.topSpeed * T.leadTime + T.ribbonTail) / T.ribbonSpacing) + 1;

export class TracerPowerup {
  constructor({ player, obstacles, scene }) {
    this.player = player;
    this.obstacles = obstacles;
    this.active = false;
    this.onStrip = false;
    this.onX = 0;               // the traced lane's x right now (fx.js draws along it)
    this._onTime = 0;           // seconds on the strip since the last +1
    this._segs = [];            // [{ d0, d1, lane }] the generator's route, block by block
    this._lastA = -Infinity;    // catches the generator being reset for a new run
    this._lastPickupD = -Infinity;

    this.drone = createTracerDrone();
    this.drone.root.visible = false;
    this.ribbon = createTracerRibbon(RIB);
    scene.add(this.drone.root, this.ribbon.root);

    obstacles.registerPickup('tracer', {
      create: () => {
        const item = createTracerPickup();
        item.root.scale.setScalar(T.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));
    this.reset();
  }

  reset() {
    if (this.active) this._stop(true);
    game.state.tracerTime = 0;
    this._onTime = 0;
    this.onStrip = false;
  }

  start() {
    if (game.halted) return;                    // the catch sequence is playing
    const dur = getEffectiveSkillDuration('tracer');
    this.active = true;
    this._onTime = 0;
    this.onStrip = true;
    game.state.tracerTime = dur;
    emit('tracerOn', { duration: dur });
  }

  _stop(reset) {
    this.active = false;
    this.onStrip = false;
    game.state.tracerTime = 0;
    game.mult.temp = 0;                         // the bonus is this power-up's only debt
    this.drone.root.visible = false;
    this.ribbon.show(0);
    this.ribbon.root.visible = false;
    emit('tracerOff', reset ? { reset: true } : {});
  }

  // Pattern extra: one roll per block always; the route of every block is recorded first, so the
  // strip knows the way ahead even in the blocks that get no pickup.
  _place(ctx) {
    const roll = ctx.rng();
    if (ctx.A <= this._lastA) this._segs.length = 0;  // a new run: the generator started over
    this._lastA = ctx.A;
    this._segs.push({ d0: ctx.A, d1: ctx.B, lane: ctx.route });
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree || ctx.pickups > 0) return;
    const [d0, d1] = ctx.routeFree;
    const d = (d0 + d1) / 2;
    if (d1 - d0 < 4 || ctx.A - this._lastPickupD < T.pickupMinGap || roll >= T.pickupChance || !ctx.farFromPickup(d)) return;
    ctx.push({ type: 'pickup', kind: 'tracer', lane: ctx.route, d, y: T.pickupY });
    this._lastPickupD = ctx.A;
  }

  // The route lane at ground distance d (outside what was recorded: the nearest end).
  _laneAt(d) {
    const s = this._segs;
    if (!s.length) return Math.floor(CONFIG.laneCount / 2);
    if (d <= s[0].d0) return s[0].lane;
    for (let i = s.length - 1; i >= 0; i--) if (d >= s[i].d0) return s[i].lane;
    return s[s.length - 1].lane;
  }

  update(dt) {
    if (!this.active) return;
    if (game.halted) { this._stop(true); return; }   // the catch froze the world
    const st = game.state, p = this.player, v = st.speed;
    // the route book (_segs) is in the generator's metres, so the strip has to be read there too:
    // an Iron Man jet start jumps state.distance far ahead of the world
    const d = game.world.distance;
    st.tracerTime = Math.max(0, st.tracerTime - dt);
    if (st.tracerTime <= 0) { this._stop(false); return; }

    this._trace(dt, d, v);

    this.onX = laneX(this._laneAt(d));   // fx.js: where the strip runs under him
    const on = Math.abs(p.x - this.onX) <= (T.ribbonWidth + CONFIG.playerWidth) / 2;
    if (!on) {
      this.onStrip = false;
      if (game.mult.temp > 0 || this._onTime > 0) {
        game.mult.temp = 0;
        this._onTime = 0;
        emit('tracerLost', { position: this._here(p) });
      }
      return;
    }
    this.onStrip = true;
    this._onTime += dt;
    while (this._onTime >= T.stepTime) {
      this._onTime -= T.stepTime;
      if (game.mult.temp >= T.maxTemp) continue;      // already at the cap: nothing earned, nothing to count
      game.mult.temp++;
      emit('tracerStep', { temp: game.mult.temp, position: this._here(p) });
    }
  }

  _here(p) { return { x: p.x, y: p.y + 1.7, z: 0 }; }

  // The strip, from ribbonTail metres behind him to leadTime seconds of track ahead.
  // shortcut: relaid every frame (RIB <= ~45 stamps) — cheap next to the world; batch the
  // matrices in pickup-art.js if the count ever has to grow with the view distance.
  _trace(dt, d, v) {
    const cut = d - T.ribbonTail - T.ribbonSpacing;
    while (this._segs.length > 1 && this._segs[1].d0 < cut) this._segs.shift();

    this.drone.root.visible = true;
    this.drone.root.position.set(laneX(this._laneAt(d + T.ahead)), T.height, -T.ahead);
    this.drone.update(dt);

    let n = 0, px = null, pz = null;
    for (let dd = d + T.ahead + v * T.leadTime; dd >= d - T.ribbonTail && n < RIB; dd -= T.ribbonSpacing) {
      const x = laneX(this._laneAt(dd)), z = -(dd - d);
      if (px !== null) this.ribbon.seg(n++, x, z, px, pz, T.ribbonWidth);
      px = x; pz = z;
    }
    this.ribbon.root.visible = n > 0;
    this.ribbon.show(n);
    this.ribbon.update(dt);
  }
}
