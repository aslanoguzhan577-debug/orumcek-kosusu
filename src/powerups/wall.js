// powerups/wall.js — Duvar Koşusu (PLAN.md 10): seconds (CONFIG.wall.duration at level 0, longer
// with the market upgrade) of running sideways on the facade next to the track.
//
// Pickup: kind 'wall', placed by a pattern-generator extra in the middle of the route lane's free
// stretch. Collecting sets game.state.wallTime to the duration shop.js gives the level and emits
// 'wallOn'; it counts down only while the run moves, at 0 -> 'wallOff' (restart / menu send
// 'wallOff' {reset}).
//
// The trick is all built from what the game already has for the swing / Kitty / Batman flights:
//   * the altitude goes into player.floorY (obstacles.js keeps writing the surface under him into
//     surfaceY, the wall height is added on top of it), so he is "grounded" 3.2 m above the deck —
//     above every train roof — and obstacles.grace(0.2) every frame means nothing touches him;
//   * player.verticalLocked: the same guard as powerups/swing.js — up / down are ignored while the
//     wall owns the height, and a second flight refuses to start while this one runs;
//   * the body is rolled 90 degrees in update() (AFTER player.update, which damps root.rotation.z
//     back to its lane lean every frame), so his soles press the wall and his run gait churnes up
//     and down the facade ('wall' pose in models/spiderman.js);
//   * beside the track a comic brick facade scrolls past (pickup-art.js createWallPanel: the wall
//     never moves, its texture does) and CONFIG.wall.camBack pulls the camera back so he stays in a
//     tall portrait frame.
//
// He takes the OUTER lane on that side: a press toward the inside ends the wall run early (the same
// landing window the countdown uses takes him back down), anything else keeps it. The landing drops
// him into that outer lane with the usual 1.5 s of grace. While he is up there a row of coins is
// laid along the wall at his height, so the wall is also the way to take the coins no lane reaches.
// game.state.wallMetres (reset every run) is what missions.js measures "Duvarda N m koş" from.

import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import { createWallPickup, createWallPanel } from '../pickup-art.js';
import { getEffectiveSkillDuration } from '../shop.js';

const S = CONFIG.wall;
const smoothstep = (t) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

export class WallPowerup {
  constructor({ player, obstacles, chaser, scene, cameraRig }) {
    this.player = player;
    this.obstacles = obstacles;
    this.chaser = chaser;
    this.cameraRig = cameraRig;
    this.active = false;
    this.time = 0;              // seconds since the leap (drives the take-off / landing)
    this.side = 1;              // +1 the right facade, -1 the left one
    this.outerLane = CONFIG.laneCount - 1;
    this.lift = 0;              // 0..1 how far up (and out) he is right now
    this.height = 0;            // his feet above the deck
    this.surfaceY = 0;          // what obstacles.js put under him before the wall lifted him
    this._fromX = 0;            // the x he leapt from
    this._lastPickupD = -Infinity;
    this._coinAcc = 0;

    obstacles.registerPickup('wall', {
      create: () => {
        const item = createWallPickup();
        item.root.scale.setScalar(S.pickupScale);
        return item;
      },
      onCollect: () => this.start(),
    });
    obstacles.generator.addExtra((ctx) => this._place(ctx));

    const left = createWallPanel(-1), right = createWallPanel(1);
    this.panels = { [-1]: left, 1: right };
    scene.add(left.root, right.root);
    this.reset();
  }

  reset() {
    if (this.active) this._stop(true);
    game.state.wallTime = 0;
    game.state.wallMetres = 0;
    this.time = 0;
    this.lift = 0;
    this.height = 0;
    this.surfaceY = 0;
    this._coinAcc = 0;
    for (const p of Object.values(this.panels)) p.root.visible = false;
  }

  // Another flight already owns the height (or he is caught / zipped): the pickup still counts as a
  // power-up (obstacles.js emits it before calling this), only the wall run is skipped.
  start() {
    const p = this.player, hs = game.heroSpecials, rep = game.repulsor;
    if (p.controlsLocked || p.verticalLocked || game.halted
      || (hs && hs.active) || (rep && rep.active) || (game.web && game.web.zipping)) return;
    const dur = getEffectiveSkillDuration('wall');
    this.active = true;
    this.time = 0;
    this.lift = 0;
    this._coinAcc = 0;
    this.side = p.x >= 0 ? 1 : -1;
    this.outerLane = this.side > 0 ? CONFIG.laneCount - 1 : 0;
    this._fromX = p.x;
    game.state.wallTime = dur;
    p.verticalLocked = true;
    // he commits to the outer lane of that side; from now on only an inner press ends the run
    p.lane = this.outerLane;
    p._prevLane = this.outerLane;
    p._laneFromX = p.x;
    p._laneT = 1;
    this.panels[this.side].root.visible = true;
    this.cameraRig.setDolly(S.camBack, 0);
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') this.chaser._dropBack();
    emit('wallOn', { duration: dur, side: this.side });
  }

  _stop(reset) {
    const onWall = this.height > 0;
    this.active = false;
    game.state.wallTime = 0;
    this.lift = 0;
    this.height = 0;
    const p = this.player;
    p.verticalLocked = false;
    // A catch froze him on the wall face: back down into the outer lane he ran in. A run reset does
    // not need it (player.reset already put him in the middle lane) and must not be overwritten.
    if (reset && onWall && game.halted) {
      const x = laneX(this.outerLane);
      p.x = x;
      p._prevX = x;
      p._laneFromX = x;
      p._laneT = 1;
      p.lane = this.outerLane;
      p._prevLane = this.outerLane;
      p.floorY = this.surfaceY;
      p.y = this.surfaceY;
      p.vy = 0;
      p.grounded = true;
    }
    for (const panel of Object.values(this.panels)) panel.root.visible = false;
    this.cameraRig.setDolly(0, 0);
    if (!reset) this.obstacles.grace(1.5); // the landing
    emit('wallOff', reset ? { reset: true } : {});
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
    ctx.push({ type: 'pickup', kind: 'wall', lane: ctx.route, d, y: S.pickupY });
    this._lastPickupD = ctx.A;
  }

  // After obstacles.js set player.floorY, before the player moves.
  beforePlayer(dt) {
    if (!this.active || game.halted) return;
    const p = this.player, st = game.state;
    this.time += dt;
    // a press toward the inside ends the wall run: cut to the landing window, the lift below
    // takes him back down into the outer lane he left
    if (p.lane !== this.outerLane && st.wallTime > S.landingTime) st.wallTime = S.landingTime;

    this.lift = this.time < S.liftTime ? smoothstep(this.time / S.liftTime)
      : st.wallTime < S.landingTime ? smoothstep(st.wallTime / S.landingTime) : 1;
    this.height = this.lift * S.height;

    // one parameter drives both: up the wall and out to it (back down and in at the end)
    const wallX = this.side * S.x;
    const from = this.time < S.liftTime ? this._fromX : laneX(this.outerLane);
    p.x = from + (wallX - from) * this.lift;
    p.lane = this.outerLane;
    p._prevLane = this.outerLane;
    p._laneFromX = p.x;
    p._laneT = 1;
    p._prevX = p.x;

    this.surfaceY = p.floorY || 0;
    // measured from the street, so a wagon roof cannot lift him higher; at the end the lift falls
    // away and he lands on whatever surface is under him
    p.floorY = Math.max(this.surfaceY, this.height);
    if (p.grounded || p.y < p.floorY) { p.y = p.floorY; p.vy = 0; p.grounded = true; }
    const ov = p.override;
    if (this.lift > 0.5 && (!ov || ov === 'wall')) p.setOverride('wall', 0.1);

    this.obstacles.grace(0.2);      // nothing on the deck can reach him up here
    st.wallMetres += st.speed * dt * this.lift;
    this.panels[this.side].scroll(st.speed * dt);
    this._coins(dt, st.speed);
  }

  // After player.update, which damps root.rotation.z back to the lane lean: here the roll is the
  // whole point, so it is written on top of it every frame (and left alone after the wall ends).
  update(dt) {
    if (!this.active) return;
    if (game.halted) { this._stop(true); return; } // the catch froze the world
    const st = game.state;
    st.wallTime = Math.max(0, st.wallTime - dt);
    this.player.root.rotation.z = this.side * Math.PI * 0.5 * this.lift;
    if (st.wallTime <= 0) this._stop(false);
  }

  // A coin every CONFIG.coins.spacing metres, on the wall at his height. None during the leap or in
  // the last CONFIG.wall.coinStop seconds, so the row never starts or ends in a landing.
  _coins(dt, v) {
    const st = game.state;
    if (this.time < S.liftTime || st.wallTime <= S.coinStop) return;
    this._coinAcc += v * dt;
    while (this._coinAcc >= CONFIG.coins.spacing) {
      this._coinAcc -= CONFIG.coins.spacing;
      const c = this.obstacles._coinPool.pop() || {};
      c.x = this.side * S.x;
      c.y = this.height + CONFIG.coins.height;
      c.z = -S.coinAhead;
      this.obstacles.coins.push(c);
    }
  }
}
