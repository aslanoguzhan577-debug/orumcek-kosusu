// chaser.js — Venom chasing Spider-Man (G8).
// Venom never collides with anything: he only follows the player's lane and height at a
// distance `gap` behind (+Z). Modes:
//   away   fallen back off screen (hidden)
//   intro  right behind at run start, then falls back
//   near   after a stumble: close behind for CONFIG.chaser.nearTime s ('reach')
//   catch  rushing in after a crash or a 2nd stumble (world is halted)
//   caught grabbed: emits 'caught', game over after CONFIG.chaser.catchBeat s
// Hooks it takes over in obstacles.hooks: onSideHit (stumble) and onCrash (front crash).
// onFrontHit stays first in line, so G10 can still absorb a crash before any of this.
// Events: venomNear (he has arrived close), venomFar (he falls back), caught.
//
// Readability: when close, Venom stands where his head shows just BELOW Spider-Man's
// feet on screen (computed from the camera each frame), so he never hides the player or
// the lanes ahead.
//
// The model is passed in (main.js is the single creation point); setModel() swaps it.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { emit, events } from './events.js';
import { game } from './game.js';
import { createBlobShadow } from './world.js';

const C = CONFIG.chaser;
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export class Chaser {
  constructor(scene, player, obstacles, model) {
    this.player = player;
    this.root = new THREE.Group();
    this.root.name = 'chaser';
    scene.add(this.root);
    this.shadow = createBlobShadow(0.75);
    scene.add(this.shadow);
    this.model = null;
    this.height = CONFIG.playerHeight * C.heightFactor;
    this.setModel(model);

    obstacles.hooks.onSideHit = () => this.onStumble();
    obstacles.hooks.onCrash = () => this.catchPlayer();
    events.addEventListener('start', () => this._startIntro());

    this.reset();
  }

  setModel(model) {
    if (this.model) this.root.remove(this.model.root);
    this.model = model;
    this.root.add(model.root);
    model.setState('run');
    model.update(0);
    _box.setFromObject(model.root);
    if (!_box.isEmpty()) this.height = _box.getSize(_size).y;
    this._modelState = null;
  }

  // Run start / menu: fallen back and hidden. The intro starts on the 'start' event.
  reset() {
    this.mode = 'away';
    this.gap = C.farGap;
    this.x = this.player.x;
    this.y = this.player.y;
    this.floor = this.player.floorY;
    this.timer = 0;
    this.arrived = false;
    this._snapNear = false;
    this._place();
  }

  get isNear() {
    return this.mode === 'near' || this.mode === 'catch' || this.mode === 'caught';
  }

  _startIntro() {
    this.mode = 'intro';
    this.timer = C.introTime;
    this._snapNear = true;
  }

  // Side hit (called by obstacles after the stumble itself).
  onStumble() {
    if (this.mode === 'catch' || this.mode === 'caught') return;
    if (this.mode === 'near') {
      this.catchPlayer();
      return;
    }
    this.mode = 'near';
    this.timer = C.nearTime;
    this.arrived = false;
  }

  // Front crash or second stumble: halt the world, rush in, grab.
  catchPlayer() {
    if (this.mode === 'catch' || this.mode === 'caught') return;
    game.halt();
    this.player.setOverride('caught', Infinity);
    this.player.controlsLocked = true;
    if (!this.arrived && this.mode !== 'intro') emit('venomNear');
    this.arrived = true;
    this.mode = 'catch';
    this.gap = Math.min(this.gap, C.catchStartGap);
  }

  // Gap at which Venom's head sits just below the player's feet on screen.
  _nearGap() {
    const cam = game.camera ? game.camera.position : null;
    if (!cam) return C.minGap;
    const camUp = Math.max(0.5, cam.y - this.player.floorY);
    const gap = ((this.height + C.screenMargin) * cam.z) / camUp;
    return THREE.MathUtils.clamp(gap, C.minGap, Math.max(C.minGap, cam.z - 1));
  }

  update(dt) {
    const near = this._nearGap();
    let target = C.farGap;

    switch (this.mode) {
      case 'intro':
        if (this._snapNear) {
          this.gap = near;
          this._snapNear = false;
        }
        target = near;
        this.timer -= dt;
        if (this.timer <= 0) this.mode = 'away';
        break;
      case 'near':
        target = near;
        if (!this.arrived && this.gap < near + 0.6) {
          this.arrived = true;
          emit('venomNear');
        }
        this.timer -= dt;
        if (this.timer <= 0) {
          this.mode = 'away';
          if (this.arrived) emit('venomFar');
          this.arrived = false;
        }
        break;
      case 'catch':
        this.gap -= C.catchSpeed * dt;
        if (this.gap <= C.catchGap) {
          this.gap = C.catchGap;
          this.mode = 'caught';
          this.timer = C.catchBeat;
          emit('caught');
        }
        break;
      case 'caught':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = Infinity;
          game.gameOver();
        }
        break;
      default:
        break;
    }

    if (this.mode !== 'catch' && this.mode !== 'caught') {
      const rate = target < this.gap ? C.approachRate : C.retreatRate;
      this.gap = damp(this.gap, target, rate, dt);
    }

    const p = this.player;
    this.x = damp(this.x, p.x, C.followRate, dt);
    this.y = damp(this.y, p.y, C.followRate, dt);
    this.floor = damp(this.floor, p.floorY, C.followRate, dt);

    let state = 'run';
    if (this.mode === 'catch' || this.mode === 'caught') state = 'catch';
    else if ((this.mode === 'near' || this.mode === 'intro') && this.gap < near + 1.5) state = 'reach';
    if (state !== this._modelState) {
      this._modelState = state;
      this.model.setState(state);
    }
    this.model.update(dt);
    this._place();
  }

  _place() {
    const camZ = game.camera ? game.camera.position.z : 20;
    const visible = this.gap < camZ + 1;
    this.root.visible = visible;
    this.shadow.visible = visible;
    this.root.position.set(this.x, this.y, this.gap);
    this.shadow.position.set(this.x, this.floor + 0.08, this.gap);
  }
}
