// camera.js — chase camera: behind (+Z) and above the player, looking a little ahead.
// Follows the player's lane x and floor height with damping. On resize it widens the
// FOV and pulls back so all lanes stay on screen in portrait.
// rig.shake(strength, seconds) gives a small decaying shake (for G11 effects).

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
    // at the player's depth. Grow the offsets until it fits.
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * aspect;
    const outer = ((CONFIG.laneCount - 1) / 2) * CONFIG.laneWidth;
    const need = outer * (1 + this.follow) + c.sideMargin;
    let s = 1;
    for (let i = 0; i < 6; i++) {
      const camY = c.height * s;
      const camZ = c.distance * s;
      const fy = c.lookHeight - camY;
      const fz = -c.lookAhead - camZ;
      const len = Math.hypot(fy, fz);
      const py = CONFIG.playerHeight * 0.5 - camY; // vector camera -> player centre
      const pz = -camZ;
      const depth = (py * fy + pz * fz) / len;
      const have = depth * tanH;
      s = clamp(s * (need / have), 1, c.maxScale);
    }
    this.scale = s;
  }

  // Jump straight to the target (run start).
  snap(player) {
    this.x = player.x * this.follow;
    this.refY = player.floorY;
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
    this.camera.position.set(this.x, this.refY + c.height * s, c.distance * s);
    this.camera.lookAt(this.x, this.refY + c.lookHeight, -c.lookAhead);
  }
}
