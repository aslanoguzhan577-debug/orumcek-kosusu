// camera.js — chase camera: behind (+Z) and above the player, looking a little ahead.
// Follows the player's lane x and floor height with damping. On resize it pulls back just
// enough that all lanes fit a little ahead of the player in portrait (and moves a bit
// closer on wide screens), so the hero stays as big as the lanes allow.
// rig.shake(strength, seconds) gives a small decaying shake (for G11 effects).
// rig.setTilt(on) lifts the view a little (G9 web zip).
// rig.setShot(position, lookAt) blends to a fixed shot (G8 catch cam); rig.clearShot()
// blends back. snap() drops both instantly (run start / menu).

import * as THREE from 'three';
import { CONFIG } from './config.js';

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.x = 0;
    this.refY = 0;          // damped floor/jump height the camera rides on
    this.scale = 1;         // offset multiplier from the portrait fit
    this.follow = CONFIG.camera.followX;
    this._shakeTime = 0;
    this._shakeDuration = 0;
    this._shakeStrength = 0;
    this.tilt = 0;
    this._tiltOn = false;
    this.shotBlend = 0;
    this._shotOn = false;
    this._shotPos = new THREE.Vector3();
    this._shotLook = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  setTilt(on) {
    this._tiltOn = on;
  }

  // instant = jump straight into the shot (no blend), e.g. the intro clip driving the camera
  setShot(position, lookAt, instant = false) {
    this._shotOn = true;
    if (instant) this.shotBlend = 1;
    this._shotPos.copy(position);
    this._shotLook.copy(lookAt);
  }

  clearShot() {
    this._shotOn = false;
  }

  resize(width, height) {
    const c = CONFIG.camera;
    const cam = this.camera;
    const aspect = width / Math.max(1, height);
    // 0 = landscape/square, 1 = tall phone portrait
    const t = clamp((1 - aspect) / (1 - c.portraitAspect), 0, 1);

    cam.aspect = aspect;
    cam.fov = lerp(c.fov, c.fovPortrait, t);
    cam.updateProjectionMatrix();
    this.follow = lerp(c.followX, c.followXPortrait, t);

    // Fit: with the player in an outer lane, the opposite outer lane must be visible
    // fitAhead metres in front of the player (where the next obstacles come from), and
    // the player himself must stay on screen at his own depth. Grow the offsets until
    // both fit.
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * aspect;
    const outer = ((CONFIG.laneCount - 1) / 2) * CONFIG.laneWidth;
    const needLanes = outer * (1 + this.follow) + c.sideMargin;
    const needPlayer = outer * (1 - this.follow) + c.playerMargin;
    const depthAt = (s, z) => {
      const camY = c.height * s;
      const camZ = c.distance * s;
      const fy = c.lookHeight - camY;
      const fz = -c.lookAhead - camZ;
      const len = Math.hypot(fy, fz);
      const py = CONFIG.playerHeight * 0.5 - camY; // vector camera -> point
      const pz = z - camZ;
      return (py * fy + pz * fz) / len;
    };
    let s = 1;
    for (let i = 0; i < 8; i++) {
      const k = Math.max(needLanes / (depthAt(s, -c.fitAhead) * tanH), needPlayer / (depthAt(s, 0) * tanH));
      s = clamp(s * k, c.minScale, c.maxScale);
    }
    this.scale = s;
  }

  // Jump straight to the target (run start).
  snap(player) {
    this.x = player.x * this.follow;
    this.refY = player.floorY;
    this.tilt = 0;
    this._tiltOn = false;
    this.shotBlend = 0;
    this._shotOn = false;
    this._place();
  }

  shake(strength = 0.15, seconds = 0.3) {
    this._shakeStrength = Math.max(this._shakeStrength, strength);
    this._shakeDuration = Math.max(seconds, 0.01);
    this._shakeTime = this._shakeDuration;
  }

  update(dt, player) {
    const c = CONFIG.camera;
    const kx = 1 - Math.exp(-c.dampX * dt);
    const ky = 1 - Math.exp(-c.dampY * dt);
    this.x += (player.x * this.follow - this.x) * kx;
    const targetY = player.floorY + (player.y - player.floorY) * c.jumpFollow;
    this.refY += (targetY - this.refY) * ky;
    this.tilt += ((this._tiltOn ? 1 : 0) - this.tilt) * (1 - Math.exp(-c.tiltRate * dt));
    this.shotBlend += ((this._shotOn ? 1 : 0) - this.shotBlend) * (1 - Math.exp(-c.shotRate * dt));
    this._place();

    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      const k = Math.max(0, this._shakeTime / this._shakeDuration) * this._shakeStrength;
      this.camera.position.x += (Math.random() * 2 - 1) * k;
      this.camera.position.y += (Math.random() * 2 - 1) * k;
      if (this._shakeTime <= 0) this._shakeStrength = 0;
    }
  }

  _place() {
    const c = CONFIG.camera;
    const s = this.scale;
    this._pos.set(this.x, this.refY + c.height * s, c.distance * s);
    this._look.set(this.x, this.refY + c.lookHeight + this.tilt * c.zipLookUp, -c.lookAhead);
    if (this.shotBlend > 0.001) {
      this._pos.lerp(this._shotPos, this.shotBlend);
      this._look.lerp(this._shotLook, this.shotBlend);
    }
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
