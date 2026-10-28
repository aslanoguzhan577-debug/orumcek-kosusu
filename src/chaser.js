// chaser.js — Venom chasing Spider-Man (G8).
// Venom never collides with anything: he only follows the player's lane and height at a
// distance `gap` behind (+Z). Modes:
//   away   fallen back off screen (hidden)
//   intro  right behind at run start, then falls back
//   near   after a stumble: close behind for CONFIG.chaser.nearTime s ('reach')
//   catch  rushing in after a crash or a 2nd stumble (world is halted, catch cam blends in)
//   lunge  grabbing, catch cam on his face for CONFIG.chaser.lungeTime s
//   caught emits 'caught' (fx ink splash), game over after CONFIG.chaser.afterCaught s
// Catch cam: a front three-quarter shot from beside and ahead of the player, looking
// back at Venom's face (his face is on his -Z side). Pausing freezes it; snap() on
// restart / menu removes it.
// Hooks it takes over in obstacles.hooks: onSideHit (stumble) and onCrash (front crash).
// Its own hook: chaser.hooks.absorbCatch() -> return true to cancel a catch from a 2nd
// stumble (G10 Iron Spider); Venom then drops back.
// onFrontHit stays first in line, so G10 can still absorb a crash before any of this.
// Events: venomNear (he has arrived close), venomFar (he falls back), caught.
//
// Readability: when close, Venom stands where only his head and shoulders show at the
// bottom edge of the screen (CONFIG.chaser.headScreenY, computed from the chase camera),
// so he never hides the player or the lanes ahead.
//
// The model is passed in (main.js is the single creation point); setModel() swaps it.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { emit, events } from './events.js';
import { game } from './game.js';
import { createBlobShadow } from './world.js';

const C = CONFIG.chaser;
const CATCHING = new Set(['catch', 'lunge', 'caught']);
const _box = new THREE.Box3();
const _shotPos = new THREE.Vector3();
const _shotLook = new THREE.Vector3();
const _size = new THREE.Vector3();

function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export class Chaser {
  constructor(scene, player, obstacles, model) {
    this.player = player;
    this.obstacles = obstacles;
    this.hooks = { absorbCatch: () => false };
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
    this.knockback = 0;
    if (game.cameraRig) game.cameraRig.clearShot();
    this._place();
  }

  get isNear() {
    return this.mode === 'near' || CATCHING.has(this.mode);
  }

  _startIntro() {
    this.mode = 'intro';
    this.timer = C.introTime;
    this._snapNear = true;
  }

  // Side hit (called by obstacles after the stumble itself).
  onStumble() {
    if (CATCHING.has(this.mode)) return;
    if (this.mode === 'near') {
      if (this.hooks.absorbCatch()) {
        this._dropBack();
        return;
      }
      this.catchPlayer();
      return;
    }
    this.mode = 'near';
    this.timer = C.nearTime;
    this.arrived = false;
  }

  _dropBack() {
    if (this.arrived) emit('venomFar');
    this.arrived = false;
    this.mode = 'away';
  }

  // Front crash or second stumble: halt the world, rush in, grab.
  catchPlayer() {
    if (CATCHING.has(this.mode)) return;
    game.halt();
    this.player.setOverride('caught', Infinity);
    this.player.controlsLocked = true;
    if (!this.arrived && this.mode !== 'intro') emit('venomNear');
    this.arrived = true;
    this.mode = 'catch';
    this.gap = Math.min(this.gap, C.catchStartGap);
    this.shotSide = this._pickShotSide();
    this.knockback = C.knockback;
  }

  // Outer lane: film from outside the track (nothing there). Middle lane: the side whose
  // neighbouring lane has nothing next to the player.
  _pickShotSide() {
    const px = this.player.x;
    if (Math.abs(px) > 0.5) return Math.sign(px);
    for (const side of [1, -1]) {
      let blocked = false;
      for (const o of this.obstacles.active) {
        if (Math.abs(o.x - (px + side * CONFIG.laneWidth)) > 0.6) continue;
        if (o.z > -4 && o.z - o.length < 2) blocked = true;
      }
      if (!blocked) return side;
    }
    return 1;
  }

  // Catch cam: beside and ahead of the player, above roof height, looking at Venom's head.
  _aimShot() {
    const rig = game.cameraRig;
    if (!rig) return;
    const p = this.player;
    const floor = Math.max(p.floorY, this.floor);
    _shotPos.set(p.x + this.shotSide * C.shotSide, floor + C.shotHeight, -C.shotAhead);
    _shotLook.set((p.x + this.x) / 2, this.y + this.height * 0.68, this.gap * 0.5);
    rig.setShot(_shotPos, _shotLook);
  }

  // Gap at which the top of Venom's head sits at headScreenY (fraction of the screen
  // height, from the bottom), using the chase camera's own pose (not camera.position,
  // which the catch cam may move).
  _nearGap() {
    const rig = game.cameraRig;
    if (!rig || !game.camera) return C.minGap;
    const cam = CONFIG.camera;
    const camUp = cam.height * rig.scale;                       // above the floor
    const camZ = cam.distance * rig.scale;
    const lookY = cam.lookHeight + rig.tilt * cam.zipLookUp;
    const pitch = Math.atan2(camUp - lookY, camZ + cam.lookAhead); // looking down
    const halfFov = THREE.MathUtils.degToRad(game.camera.fov) / 2;
    const below = pitch + Math.atan((1 - 2 * C.headScreenY) * Math.tan(halfFov));
    const gap = camZ - Math.max(0.1, camUp - this.height) / Math.tan(below);
    return THREE.MathUtils.clamp(gap, C.minGap, Math.max(C.minGap, camZ - 0.8));
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
          this.mode = 'lunge';
          this.timer = C.lungeTime;
        }
        break;
      case 'lunge':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.mode = 'caught';
          this.timer = C.afterCaught;
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

    if (!CATCHING.has(this.mode)) {
      const rate = target < this.gap ? C.approachRate : C.retreatRate;
      this.gap = damp(this.gap, target, rate, dt);
    }

    const p = this.player;
    // while catching, lunge in on the camera's side so his face is not behind Spider-Man
    const tx = CATCHING.has(this.mode) ? p.x + this.shotSide * C.catchSide : p.x;
    this.x = damp(this.x, tx, C.followRate, dt);
    this.y = damp(this.y, p.y, C.followRate, dt);
    this.floor = damp(this.floor, p.floorY, C.followRate, dt);

    let state = 'run';
    if (CATCHING.has(this.mode)) state = 'catch';
    else if ((this.mode === 'near' || this.mode === 'intro') && this.gap < near + 1.5) state = 'reach';
    if (state !== this._modelState) {
      this._modelState = state;
      this.model.setState(state);
    }
    this.model.update(dt);
    this._place();
    if (CATCHING.has(this.mode)) {
      // Yanked back: the halted world slides ahead, clearing the view of what was hit.
      if (this.knockback > 0) {
        const step = Math.min(this.knockback, C.knockbackSpeed * dt);
        this.knockback -= step;
        this.obstacles.shift(-step);
      }
      this._aimShot();
    }
  }

  _place() {
    // the chase camera's own distance (not camera.position: the catch cam moves it)
    const camZ = game.cameraRig ? CONFIG.camera.distance * game.cameraRig.scale : 20;
    const visible = CATCHING.has(this.mode) || this.gap < camZ + 1;
    this.root.visible = visible;
    this.shadow.visible = visible;
    this.root.position.set(this.x, this.y, this.gap);
    this.shadow.position.set(this.x, this.floor + 0.08, this.gap);
  }
}
