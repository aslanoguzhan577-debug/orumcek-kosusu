// skillBlackPanther.js — Black Panther: "Kinetic Release" (Vibranyum Şok)
//
// Gameplay (unchanged): 1 charge, 5.5 s, +14 m/s; on activation every obstacle within 16 m is
// shattered, then a growing kinetic barrier (1.5 -> 7.5 m, +2 m reach) keeps shattering what
// comes in; a hit is absorbed (shatter + 1.5 s grace).
// Look (vfxCore.js, everything pooled / built at load):
//   * release: freeze frame, lilac comic panel, a violet shock ring races 16 m across the
//     ground and each obstacle bursts into violet crystal rubble the moment the ring reaches it;
//     WHOOM! sticker, halftone burst behind him.
//   * kinetic charge: purple energy lines on the suit light up from the boots upward as he
//     runs and as he absorbs impacts (runtime overlay on the model's own meshes).
//   * two violet afterimages trail him on lane changes and jumps.
//   * no dome, no lights, nothing in front of the camera.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import {
  chunkBurst, sparkBurst, burst, sticker, groundRing, impactFrame, hitStop, kick, sfx,
  ghostLayer, ghostMaterial, triggerCameraShake,
} from '../vfxCore.js';

export const VIBRANIUM_SVG_ICON = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="44" fill="#2a1846" stroke="#1c1016" stroke-width="5"/>
  <polygon points="50,14 81,32 81,68 50,86 19,68 19,32" fill="none" stroke="#b48cff" stroke-width="4"/>
  <path d="M50 26 L50 74 M30 38 L70 62 M30 62 L70 38" stroke="#efe3ff" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="8" fill="#efe3ff" stroke="#1c1016" stroke-width="3"/>
</svg>`;

const VIOLET = 0x6b3fb8, LILAC = 0xb48cff, PALE = 0xefe3ff;
const CRYSTAL = [0x5b3a8c, LILAC, PALE, 0x8a63d2];
const RING_R1 = 16, RING_LIFE = 0.5;

// kinetic lines: chevrons + seams in the mesh's own space, revealed from the floor upward
const LINES_VERT = /* glsl */`
varying vec3 vLocal;
varying float vWy;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position + normal * 0.004, 1.0);
  vWy = w.y;
  vec4 mv = viewMatrix * curveWorld(w);
  mv.xyz -= normalize(mv.xyz) * 0.01;
  gl_Position = projectionMatrix * mv;
}`;
const LINES_FRAG = /* glsl */`
uniform float uCharge;
uniform float uTime;
uniform float uFloor;
uniform float uFade;
uniform vec3 uColor;
uniform vec3 uHot;
varying vec3 vLocal;
varying float vWy;
void main() {
  vec3 p = vLocal * 10.0;
  float c1 = abs(fract(p.y + abs(p.x) * 0.7) - 0.5);
  float c2 = abs(fract(p.x * 0.5 + 0.25) - 0.5) * 1.8;
  float d = min(c1, c2);
  float w = 0.055;
  float line = 1.0 - smoothstep(w - fwidth(d), w + fwidth(d), d);
  float h = vWy - uFloor;
  float reveal = step(h, uCharge * 1.9) * uFade;
  if (line * reveal < 0.5) discard;
  float pulse = 0.5 + 0.5 * sin(uTime * 9.0 - h * 7.0);
  gl_FragColor = vec4(mix(uColor, uHot, pulse * uCharge), 1.0);
}`;

export class BlackPantherSkill {
  constructor({ scene, player, obstacles, cameraRig, chaser } = {}) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    this.name = 'panther';
    this.label = 'VİBRANYUM ŞOKU';
    this.duration = 5.5;
    this.maxTime = 5.5;
    this.timeRemaining = 0;
    this.timeAlive = 0;
    this.active = false;
    this.charges = 1;
    this.maxCharges = 1;
    this.mode = 'panther';
    this.vibraniumSvgIcon = VIBRANIUM_SVG_ICON;
    this.baseSpeed = null;
    this._lastShatterCheck = 0;

    this.charge = 0;   // 0..1 kinetic energy (suit lines)
    this.fade = 0;     // 0..1 overlay visibility (fades out after the skill)
    this.model = null;
    this.overlay = null;
    this.trails = null;
    this.hist = new Float32Array(32 * 3); // x, y, t ring buffer for the afterimages
    this.histHead = 0;
    this.linesMat = new THREE.ShaderMaterial({
      uniforms: {
        uCharge: { value: 0 }, uTime: { value: 0 }, uFloor: { value: 0 }, uFade: { value: 1 },
        uColor: { value: new THREE.Color(0x8a5cf0) }, uHot: { value: new THREE.Color(PALE) },
      },
      vertexShader: LINES_VERT, fragmentShader: LINES_FRAG, fog: false,
    });
  }

  // HeroSpecials.prepare (load time): overlay + afterimage copies of the Panther model
  prepare(model) {
    this.model = model;
    this.overlay = ghostLayer(model, this.linesMat);
    this.trails = [ghostMaterial(VIOLET, 0.55, 0.3), ghostMaterial(LILAC, 0.32, 0.45)].map((m) => ghostLayer(model, m));
  }

  activate() {
    if (this.active) return false;
    if (game && (game.halted || (this.player && this.player.controlsLocked))) return false;

    this.active = true;
    this.timeAlive = 0;
    this.timeRemaining = this.duration;
    this._lastShatterCheck = 0;

    this.baseSpeed = game.state ? game.state.speed : 18;
    game.speedOverride = Math.min(CONFIG.topSpeed + 14, this.baseSpeed + 14);

    const p = this.player;
    const chest = new THREE.Vector3(p ? p.x : 0, (p ? p.y : 0) + 0.85, 0);
    this.charge = 0.3;
    this.fade = 1;
    this.histHead = 0;
    this.hist.fill(0);

    // the release
    hitStop(0.07);
    impactFrame({ at: chest, bg: 0xe9dcff, dot: 0xc9a8ff, line: 0x5b3a8c });
    groundRing({ x: p.x, y: p.floorY, z: 0 }, { r0: 0.5, r1: RING_R1, width: 0.7, life: RING_LIFE, color: 0xc9a8ff, edge: 0xffffff });
    groundRing({ x: p.x, y: p.floorY, z: 0 }, { r0: 0.3, r1: 7, width: 0.45, life: 0.42, color: VIOLET, edge: LILAC });
    burst('halftone', new THREE.Vector3(p.x, p.y + 0.95, -0.4), { color: LILAC, size: 1.3, grow: 3.8, life: 0.45, follow: p.root });
    sparkBurst(chest, { n: 16, speed: 8, up: 0.1, colors: [LILAC, PALE, 0xffffff], scroll: false });
    sticker('whoom', new THREE.Vector3(p.x + (p.x > 0.5 ? -1.3 : 1.3), p.y + 2.4, -1.4), { follow: p.root, life: 0.85 });
    kick(0.5);
    triggerCameraShake(this.cameraRig, 0.26, 0.35);

    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') this.chaser._dropBack();

    this.shatterNearbyObstacles(16.0, true);

    emit('vibraniumShockwave', { position: chest });
    emit('specialOn', { mode: 'panther', duration: this.duration });
    return true;
  }

  update(time, dt) {
    if (dt === undefined) { dt = time || 0.016; time = this.timeAlive; }
    this._visuals(dt);
    if (!this.active) return;
    if (game && game.halted) return;

    this.timeAlive += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      this.deactivate();
      return;
    }
    if (this.baseSpeed != null && game.state) game.speedOverride = Math.min(CONFIG.topSpeed + 14, this.baseSpeed + 14);

    // kinetic barrier radius (same curve as before: 1.5 -> 7.5 m, a little pulse)
    const progress = Math.min(1.0, this.timeAlive / this.duration);
    const expandEase = 1.0 - Math.pow(1.0 - Math.min(1.0, progress * 1.8), 3.0);
    const currentRadius = (1.5 + 6.0 * expandEase) * (1.0 + Math.sin(this.timeAlive * 34.0) * 0.055);
    if (this.timeAlive - this._lastShatterCheck > 0.06) {
      this._lastShatterCheck = this.timeAlive;
      this.shatterNearbyObstacles(Math.min(16.0, currentRadius + 2.0));
    }
    this.charge = Math.min(1, this.charge + dt * 0.14);
  }

  _visuals(dt) {
    const p = this.player;
    if (!this.overlay || !p) return;
    const mine = p.model === this.model;
    if (!this.active) this.fade = Math.max(0, this.fade - dt * 2.5);
    const showLines = mine && this.fade > 0;
    this.overlay.setVisible(showLines);
    if (showLines) {
      const u = this.linesMat.uniforms;
      u.uCharge.value = this.charge;
      u.uTime.value += dt;
      u.uFloor.value = p.y;
      u.uFade.value = this.fade > 0.05 ? 1 : 0;
      // fade out top-down: the charge drains
      if (!this.active) this.charge = Math.max(0, this.charge - dt * 2.2);
      this.overlay.sync();
    }
    // afterimages: where he was 0.07 s / 0.14 s ago
    const t = this.timeAlive;
    const H = this.hist;
    const k = (this.histHead % 32) * 3;
    H[k] = p.x; H[k + 1] = p.y; H[k + 2] = t;
    this.histHead++;
    for (let i = 0; i < 2; i++) {
      const layer = this.trails[i];
      let on = false;
      if (this.active && mine) {
        const lag = 0.07 * (i + 1);
        for (let j = 1; j < 32 && j < this.histHead; j++) {
          const q = ((this.histHead - 1 - j + 3200) % 32) * 3;
          if (t - H[q + 2] >= lag) {
            const dx = H[q] - p.x, dy = H[q + 1] - p.y;
            if (dx * dx + dy * dy > 0.04) {
              on = true;
              layer.meshes[0].material.uniforms.uOffset.value.set(dx, dy, 0.15 * (i + 1));
            }
            break;
          }
        }
      }
      layer.setVisible(on);
      if (on) layer.sync();
    }
  }

  // every obstacle in reach: removed now; its crystal burst waits until the ring gets there
  shatterNearbyObstacles(radius = 16.0, release = false) {
    if (!this.obstacles || !this.obstacles.active) return 0;
    const list = this.obstacles.active;
    const px = this.player ? this.player.x : 0;
    let count = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (!o) continue;
      const nearFace = o.z;
      const farFace = o.z - (o.length || 0);
      if (!(nearFace >= -radius && farFace <= 4.0 && Math.abs(o.x - px) <= radius)) continue;
      const cy = o.parts && o.parts[0] ? (o.parts[0].y0 + o.parts[0].y1) * 0.5 : 1.0;
      const pos = new THREE.Vector3(o.x, cy, Math.min(nearFace, Math.max(farFace, -2)));
      const dist = Math.hypot(o.x - px, pos.z);
      const delay = release ? Math.min(RING_LIFE, (dist / RING_R1) ** 2 * RING_LIFE * 0.6) : 0;
      chunkBurst(pos, { n: 10, force: 9, size: 0.24, colors: CRYSTAL, delay, floor: 0 });
      sparkBurst(pos, { n: 6, speed: 7, colors: [LILAC, PALE], delay });
      this.obstacles.remove(o);
      emit('vibraniumShatter', { position: pos });
      count++;
    }
    if (count > 0) {
      this.obstacles.grace(0.35);
      this.charge = Math.min(1, this.charge + 0.12 * count);
      sfx('crash', { position: new THREE.Vector3(px, 1, -3) });
    }
    return count;
  }

  absorbHit(hit) {
    if (!this.active) return false;
    const p = this.player;
    if (hit && hit.obstacle) {
      const o = hit.obstacle;
      const cy = o.parts && o.parts[0] ? (o.parts[0].y0 + o.parts[0].y1) * 0.5 : 1.0;
      const pos = hit.position ? hit.position.clone() : new THREE.Vector3(o.x, cy, o.z);
      chunkBurst(pos, { n: 12, force: 10, size: 0.26, colors: CRYSTAL });
      this.obstacles.remove(o);
    }
    this.shatterNearbyObstacles(16.0);
    const center = hit && hit.position ? hit.position : new THREE.Vector3(p ? p.x : 0, (p ? p.y : 0) + 0.85, 0);
    // a hit feeds the suit: full charge, a second, smaller release
    this.charge = 1;
    hitStop(0.06);
    impactFrame({ at: center, bg: 0xe9dcff, dot: 0xc9a8ff, line: 0x5b3a8c });
    groundRing({ x: p.x, y: p.floorY, z: 0 }, { r0: 0.4, r1: 8, width: 0.7, life: 0.4, color: LILAC, edge: PALE });
    sparkBurst(center, { n: 18, speed: 9, colors: [LILAC, PALE, 0xffffff] });
    kick(0.4);
    triggerCameraShake(this.cameraRig, 0.24, 0.32);
    this.obstacles.grace(1.5);
    emit('vibraniumAbsorb', { position: center });
    return true;
  }

  deactivate() {
    if (this.baseSpeed != null) {
      game.speedOverride = null;
      this.baseSpeed = null;
    }
    if (!this.active) return;
    this.active = false;
    this.timeRemaining = 0;
    if (this.obstacles && typeof this.obstacles.grace === 'function') this.obstacles.grace(0.35);
    emit('specialOff', { mode: 'panther' });
  }

  reset() {
    this.deactivate();
    this.timeAlive = 0;
    this.timeRemaining = 0;
    this.charge = 0;
    this.fade = 0;
    if (this.overlay) this.overlay.setVisible(false);
    if (this.trails) for (const l of this.trails) l.setVisible(false);
  }

  dispose() {
    this.reset();
  }
}

export function createBlackPantherSkill(params) {
  return new BlackPantherSkill(params);
}

export default createBlackPantherSkill;
