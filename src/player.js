// player.js — player movement: lanes, jump, gravity, slide, fast drop, hitbox,
// and the state string handed to the character model.
// The player stays at z = 0; only x (lane) and y (height) change.
//
// Extension points (default no-op, plug in without touching input):
//   player.hooks.onAirUp(player)        "up" pressed while airborne (G9 web shot).
//                                       Return true if you used the press.
//   player.hooks.onDoubleAction(player) double tap / Space (G10 Iron Spider).
// Other helpers for later tasks:
//   player.floorY            height of the surface under the player (G2 sets it each
//                            frame before update; 0 = track). Floor drops -> falls.
//   player.jump(height)      start a jump of any height (G9 glide jump).
//   player.gravityScale      < 1 for floaty glides (G9).
//   player.setOverride(name, seconds)  force a model state ('stumble', 'web', 'caught');
//                            seconds = Infinity keeps it until reset / clearOverride().
//   player.controlsLocked    true ignores all input (G8 caught).
//   player.setModel(model)   swap the character model (G6).
//   player.useModel(model)   switch to another (pre-built) model, keeping the state (G10).
//                            Both roots stay children; only the active one is visible.
//   player.hitbox            THREE.Box3 in world space, updated every frame (G2).
//   player.lastX / lastY     position before this frame's update (collision side test).
//   player.bounceBack()      return to the lane we came from (side hit).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { emit } from './events.js';
import { laneX } from './world.js';
import { game } from './game.js';

const CENTER_LANE = Math.floor(CONFIG.laneCount / 2);

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export class Player {
  constructor(model) {
    this.root = new THREE.Group();
    this.root.name = 'player';
    this.model = null;
    this.hitbox = new THREE.Box3();
    this.hooks = {
      onAirUp: () => false,
      onDoubleAction: () => {},
    };
    this.setModel(model);
    this.reset();
  }

  setModel(model) {
    if (this.model) this.root.remove(this.model.root);
    this.model = model;
    this.root.add(model.root);
    this._modelState = null; // force setState on next update
  }

  useModel(model) {
    if (model === this.model) return;
    if (model.root.parent !== this.root) this.root.add(model.root);
    if (this.model) this.model.root.visible = false;
    model.root.visible = true;
    this.model = model;
    model.setState(this.state);
    this._modelState = this.state;
    model.update(0);
  }

  reset() {
    this.lane = CENTER_LANE;
    this._prevLane = this.lane;
    this.x = laneX(this.lane);
    this.lastX = this.x;
    this.lastY = 0;
    this.y = 0;
    this.vy = 0;
    this.floorY = 0;
    this.gravityScale = 1;
    this.grounded = true;
    this.sliding = false;
    this.slideTimer = 0;
    this._laneFromX = this.x;
    this._laneT = 1;
    this._prevX = this.x;
    this._jumpQueued = false;
    this._slideQueued = false;
    this._coyote = 0;
    this.override = null;
    this.overrideTimer = 0;
    this.controlsLocked = false;
    this.state = 'idle';
    this._modelState = null;
    this.root.position.set(this.x, this.y, 0);
    this.root.rotation.set(0, 0, 0);
    this._updateHitbox();
  }

  get airborne() {
    return !this.grounded;
  }

  // Actions from game.handleAction (only while running).
  handleAction(name) {
    if (this.controlsLocked) return;
    switch (name) {
      case 'left': this.changeLane(-1); break;
      case 'right': this.changeLane(1); break;
      case 'up': this._up(); break;
      case 'down': this._down(); break;
      case 'double': this.hooks.onDoubleAction(this); break;
      default: break; // 'tap' does nothing while running
    }
  }

  // dir: -1 left, +1 right. Returns false at the edge.
  changeLane(dir) {
    const target = this.lane + dir;
    if (target < 0 || target >= CONFIG.laneCount) return false;
    this._prevLane = this.lane;
    this.lane = target;
    this._laneFromX = this.x;
    this._laneT = 0;
    emit('lane', { dir, lane: target });
    return true;
  }

  // Side hit: head back to the lane we came from. Returns false if not changing lanes.
  bounceBack() {
    if (this._laneT >= 1 || this._prevLane === this.lane) return false;
    const from = this.lane;
    this.lane = this._prevLane;
    this._prevLane = from;
    this._laneFromX = this.x;
    this._laneT = 0;
    return true;
  }

  jump(height = CONFIG.jumpHeight) {
    if (this.sliding) this._endSlide();
    this.vy = Math.sqrt(2 * CONFIG.gravity * height);
    this.grounded = false;
    this._coyote = 0;
    this._jumpQueued = false;
    this._slideQueued = false;
    emit('jump');
  }

  setOverride(name, seconds = 1) {
    this.override = name;
    this.overrideTimer = seconds;
  }

  clearOverride() {
    this.override = null;
    this.overrideTimer = 0;
  }

  _up() {
    if (this.grounded || this._coyote > 0) {
      this.jump(); // also cancels a slide; just ran off a roof edge = still a normal jump
      return;
    }
    // Falling and almost down: treat as an early press of the next jump.
    if (this.vy < 0 && this.y - this.floorY < CONFIG.jumpBufferHeight) {
      this._jumpQueued = true;
      this._slideQueued = false;
      return;
    }
    this.hooks.onAirUp(this);
  }

  _down() {
    if (!this.grounded) {
      if (this.vy > -CONFIG.fastDropSpeed) this.vy = -CONFIG.fastDropSpeed;
      this._jumpQueued = false;
      if (CONFIG.slideAfterDrop) this._slideQueued = true;
      return;
    }
    this._startSlide();
  }

  _startSlide() {
    const wasSliding = this.sliding;
    this.sliding = true;
    this.slideTimer = CONFIG.slideDuration;
    if (!wasSliding) emit('slide');
  }

  _endSlide() {
    this.sliding = false;
    this.slideTimer = 0;
  }

  update(dt, running) {
    this.lastX = this.x;
    this.lastY = this.y;

    // --- lane movement ---
    if (this._laneT < 1) {
      this._laneT = Math.min(1, this._laneT + dt / CONFIG.laneSwitchTime);
      const k = smoothstep(this._laneT);
      this.x = this._laneFromX + (laneX(this.lane) - this._laneFromX) * k;
    }

    // --- vertical movement ---
    if (this.grounded) {
      if (this.y > this.floorY + 0.01) {
        this.grounded = false;  // floor fell away (end of a train car)
        this.vy = 0;
        this._coyote = CONFIG.coyoteTime;
        if (this.sliding) this._endSlide();
      } else {
        this.y = this.floorY;   // follows ramps up
      }
    }
    if (!this.grounded) {
      this._coyote -= dt;
      this.vy -= CONFIG.gravity * this.gravityScale * dt;
      this.y += this.vy * dt;
      if (this.y <= this.floorY && this.vy > 0) {
        this.y = this.floorY;   // stepped onto a low ledge while rising: keep the jump going
      } else if (this.y <= this.floorY) {
        this.y = this.floorY;
        this.vy = 0;
        this.grounded = true;
        emit('land');
        if (this._jumpQueued) this.jump();
        else if (this._slideQueued) {
          this._slideQueued = false;
          this._startSlide();
        }
      }
    }

    // --- slide timer ---
    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this._endSlide();
    }

    // --- forced state timer ---
    if (this.override && this.overrideTimer !== Infinity) {
      this.overrideTimer -= dt;
      if (this.overrideTimer <= 0) this.clearOverride();
    }

    // --- state for the model ---
    let s;
    if (this.override) s = this.override;
    else if (!running) s = 'idle';
    else if (this.sliding) s = 'slide';
    else if (!this.grounded) s = 'jump';
    else s = 'run';
    this.state = s;
    if (s !== this._modelState) {
      this._modelState = s;
      this.model.setState(s);
    }

    // --- place root, small lean into lane changes ---
    const vx = dt > 0 ? (this.x - this._prevX) / dt : 0;
    this._prevX = this.x;
    this.root.position.set(this.x, this.y, 0);
    const lean = THREE.MathUtils.clamp(vx * 0.012, -0.25, 0.25);
    this.root.rotation.z += (-lean - this.root.rotation.z) * Math.min(1, dt * 14);
    this.root.rotation.y += (-lean * 0.8 - this.root.rotation.y) * Math.min(1, dt * 14);

    this.model.update(dt, game.state.speed); // speed drives the run cadence
    this._updateHitbox();
  }

  _updateHitbox() {
    const hw = CONFIG.playerWidth / 2;
    const hd = CONFIG.playerDepth / 2;
    const h = this.sliding ? CONFIG.slideHeight : CONFIG.playerHeight;
    this.hitbox.min.set(this.x - hw, this.y, -hd);
    this.hitbox.max.set(this.x + hw, this.y + h, hd);
  }
}
