// powerups/web.js — G9: web cartridges and the web zip.
//
// Cartridge: placed by a pattern-generator extra on free stretches of the route lane, now
// and then (rarer while full). Collecting fills game.state.webCharges to CONFIG.web.maxCharges.
//
// Web zip: player.hooks.onAirUp (2nd "up" while airborne). Needs: not sliding, a charge,
// not already zipping, run not halted. Costs 1 charge, emits web {from, to}, shows the
// 'web' model state and a web line from the raised hand to an anchor high on a building
// (always out of frame), and steers the flight every frame (beforePlayer):
//   - a train / wagon roof arriving in the player's lane within roofLookTime: rise so the
//     feet clear the roof just as its front arrives (apex at arrival; oncoming trains use
//     their real closing speed), then land on it with the normal roof landing;
//   - otherwise: a high hang (hangHeight) and a floaty fall, landing wherever the floor is.
// Lane changes stay allowed; the plan follows the lane the player is in / moving to.
// "Down" during a zip is a normal fast drop and ends the steering.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import { createWebPickup } from '../pickup-art.js';

const W = CONFIG.web;
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class WebPowerup {
  constructor({ scene, player, obstacles, cameraRig }) {
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.zip = null;          // { time, dropped } while zipping
    this.anchor = new THREE.Vector3();
    this._lastPickupD = -Infinity;

    // --- cartridge pickups ---
    obstacles.registerPickup('web', {
      create: () => {
        const item = createWebPickup();
        item.root.scale.setScalar(W.pickupScale);
        return item;
      },
      onCollect: () => {
        game.state.webCharges = W.maxCharges;
      },
    });
    obstacles.generator.addExtra((ctx) => this._placeCartridge(ctx));

    // --- web shot ---
    player.hooks.onAirUp = () => this.tryShoot();

    // --- web line: white core + dark rim, a unit cylinder stretched hand -> anchor ---
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
    this.line = new THREE.Group();
    this.line.name = 'web-line';
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    core.scale.set(W.lineRadius, 1, W.lineRadius);
    const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1d2433, side: THREE.BackSide, fog: false }));
    rim.scale.set(W.lineRadius * 1.9, 1, W.lineRadius * 1.9);
    this.line.add(core, rim);
    this.line.visible = false;
    this.line.frustumCulled = false;
    core.frustumCulled = false;
    rim.frustumCulled = false;
    scene.add(this.line);

    this.reset();
  }

  reset() {
    this._endZip();
  }

  get zipping() {
    return this.zip !== null;
  }

  // Pattern extra: one roll per block always (keeps the shared track identical for
  // everyone), then place a cartridge in the middle of the route lane's free stretch.
  _placeCartridge(ctx) {
    const roll = ctx.rng();
    if (ctx.A < this._lastPickupD) this._lastPickupD = -Infinity; // generator was reset
    if (!ctx.routeFree) return;
    const [d0, d1] = ctx.routeFree;
    if (d1 - d0 < 4 || ctx.A - this._lastPickupD < W.pickupMinGap) return;
    const full = game.state.webCharges >= W.maxCharges;
    if (roll >= (full ? W.pickupChanceFull : W.pickupChance)) return;
    ctx.push({ type: 'pickup', kind: 'web', lane: ctx.route, d: (d0 + d1) / 2, y: W.pickupY });
    this._lastPickupD = ctx.A;
  }

  tryShoot() {
    const p = this.player;
    const st = game.state;
    if (p.grounded || p.sliding || this.zip || st.webCharges <= 0 || game.halted || p.controlsLocked) return false;
    st.webCharges--;

    this.zip = { time: 0, dropped: false };
    p.setOverride('web', Infinity);
    // Start with a hang; beforePlayer() re-plans toward a roof if one is coming.
    const rise = Math.max(1.5, p.floorY + W.hangHeight - p.y);
    p.vy = Math.sqrt(2 * CONFIG.gravity * rise);
    p.gravityScale = 1;

    const side = p.x < -0.1 ? -1 : 1;
    this.anchor.set(side * W.anchorSide, p.y + W.anchorHeight, -W.anchorAhead);
    this._handPosition(_from);
    this.line.visible = true;
    this._updateLine();
    if (this.cameraRig) this.cameraRig.setTilt(true);
    emit('web', { from: _from.clone(), to: this.anchor.clone() });
    return true;
  }

  _endZip() {
    const p = this.player;
    if (this.zip && p.override === 'web') p.clearOverride();
    this.zip = null;
    p.gravityScale = 1;
    this.line.visible = false;
    if (this.cameraRig) this.cameraRig.setTilt(false);
  }

  // Nearest roof (train / wagon car, not the ramp) in the player's lane whose front reaches
  // the player within roofLookTime. Returns { t, top } or null.
  _findRoof() {
    const p = this.player;
    const v = game.state.speed;
    const hd = CONFIG.playerDepth / 2;
    const x = laneX(p.lane);
    let best = null;
    for (const o of this.obstacles.active) {
      if (o.type !== 'wagons' && o.type !== 'train') continue;
      if (Math.abs(o.x - x) > 0.5) continue;
      const rel = Math.max(1, v + o.speed);
      for (const part of o.parts) {
        if (part.ramp) continue;
        const nearZ = o.z - part.f0;   // world z of the car's front
        const farZ = o.z - part.f1;    // ... and of its back
        if (farZ > -hd) continue;      // already gone past
        const t = Math.max(0, (-hd - nearZ) / rel);
        if (t > W.roofLookTime) break; // later cars of this obstacle are even later
        if (!best || t < best.t) best = { t, top: part.y1 };
        break;
      }
    }
    return best;
  }

  // Steer the flight (runs after obstacles moved, before the player moves).
  beforePlayer(dt) {
    const z = this.zip;
    if (!z) return;
    const p = this.player;
    z.time += dt;
    if (p.grounded || z.dropped) return;
    if (p.vy <= -CONFIG.fastDropSpeed + 0.5) { // the player pressed "down"
      z.dropped = true;
      p.gravityScale = 1;
      return;
    }
    const g = CONFIG.gravity;
    const minG = g * W.minGravityScale;
    const roof = this._findRoof();
    if (roof && roof.t > 0.03) {
      const goal = roof.top + W.roofClear;
      const t = roof.t;
      const yAt = p.y + p.vy * t - 0.5 * g * p.gravityScale * t * t;
      if (yAt < goal - 0.03) {
        // We would be below the roof when it arrives: re-plan to be at `goal` at time t.
        const dy = goal - p.y;
        const apexVy = dy > 0 ? (2 * dy) / t : 0; // rise with the apex exactly at arrival
        if (dy > 0 && p.vy <= apexVy) {
          let vy = apexVy;
          let gEff = (2 * dy) / (t * t);
          if (vy > W.maxRiseSpeed) { // very close: as fast as allowed
            vy = W.maxRiseSpeed;
            gEff = Math.min(gEff, (vy * vy) / (2 * dy));
          }
          p.vy = vy;
          p.gravityScale = THREE.MathUtils.clamp(gEff / g, W.minGravityScale, 1);
        } else {
          // keep the current speed, soften gravity so that y(t) = goal
          const gEff = (2 * (p.y - goal + p.vy * t)) / (t * t);
          if (gEff >= minG) {
            p.gravityScale = Math.min(1, gEff / g);
          } else {
            p.gravityScale = W.minGravityScale;
            p.vy = Math.min(W.maxRiseSpeed, (goal - p.y) / t + 0.5 * minG * t);
          }
        }
      }
    } else {
      // nothing to land on: normal rise to the hang height, floaty fall
      p.gravityScale = p.vy > 0 ? 1 : W.hangGravityScale;
    }
    // never higher than the hang height (+ a little)
    if (p.vy > 0 && p.y > p.floorY + W.hangHeight + 1.5) p.vy = 0;
  }

  update(dt) {
    const z = this.zip;
    if (!z) return;
    if (game.halted || this.player.grounded) {
      this._endZip();
      return;
    }
    if (z.time > W.lineMaxTime) this.line.visible = false;
    if (this.line.visible) {
      this.anchor.z += game.state.speed * dt; // the building scrolls with the world
      this._updateLine();
    }
  }

  // The model's own right-hand marker if it has one, else a fixed offset from the feet.
  _handPosition(out) {
    const hand = this.player.model.hand;
    if (hand) return hand.getWorldPosition(out);
    const root = this.player.root;
    root.updateMatrixWorld();
    return root.localToWorld(out.set(W.handOffset[0], W.handOffset[1], W.handOffset[2]));
  }

  _updateLine() {
    this._handPosition(_from);
    _dir.subVectors(this.anchor, _from);
    const len = _dir.length();
    this.line.position.copy(_from);
    this.line.quaternion.setFromUnitVectors(_up, _dir.divideScalar(len));
    this.line.scale.set(1, len, 1);
  }
}
