// skillHelloKitty.js — Hello Kitty "Flying Heart" (Uçan Kalp) special skill.
//
// Gameplay (unchanged): 8 s; she rises on a heart to 3.6 m (0.85 s take-off, 0.95 s landing),
// gliding over trains and barriers; a hit is absorbed (the obstacle and its lane neighbours are
// removed, 0.8 s grace); a soft landing gives 1.5 s grace.
// Look ("comic + vinyl", vfxCore.js; built at load, pooled, no lights):
//   * a chubby glossy vinyl heart with a white inlay, Kitty's red bow and two puffy cartoon wings
//     (merged feather lobes, ink-outlined) that flap; it pops in with a squash and banks into
//     lane changes;
//   * tumbling outlined mini hearts, pink cloud puffs and sparkles stream behind her;
//   * take-off: YAY!, a heart pop behind her, a cloud ring; a hit: freeze frame, pink comic
//     panel, BOING!, a heart burst, the heart squashes; the landing: the heart pops away in a
//     puff of clouds and hearts.

import * as THREE from 'three';
import { emit } from '../events.js';
import { game } from '../game.js';
import { toonMaterial, addOutline, mergeGeos } from '../models/toon.js';
import {
  INK, ToonPool, chunkBurst, puffBurst, sparkBurst, burst, sticker, impactFrame, hitStop, kick, sfx,
} from '../vfxCore.js';

export const HEART_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <path d="M 50,84 C 50,84 15,62 15,36 C 15,22 25,12 38,12 C 45,12 50,17 50,21 C 50,17 55,12 62,12 C 75,12 85,22 85,36 C 85,62 50,84 50,84 Z"
        fill="#ff8fb8" stroke="#1c1016" stroke-width="5" stroke-linejoin="round"/>
  <path d="M 26,34 C 26,26 31,20 39,19" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
  <g transform="translate(58,14) rotate(15)">
    <ellipse cx="-9" cy="0" rx="9" ry="6" fill="#e0263f" stroke="#1c1016" stroke-width="3"/>
    <ellipse cx="9" cy="0" rx="9" ry="6" fill="#e0263f" stroke="#1c1016" stroke-width="3"/>
    <circle cx="0" cy="0" r="4.5" fill="#e0263f" stroke="#1c1016" stroke-width="3"/>
  </g>
</svg>`;

const PINK = 0xff8fb8, DEEP = 0xe0457b, RED = 0xe0263f, CREAM = 0xfff2f6;
const CLOUDS = [0xffe3ee, 0xffffff, 0xffd0e2];

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Chubby symmetric heart contour (bezier). */
export function createHeartShape(scale = 1.0) {
  const shape = new THREE.Shape();
  const tipY = -0.65 * scale, waistY = 0.22 * scale, lobeY = 0.65 * scale, notchY = 0.32 * scale, halfW = 0.82 * scale;
  shape.moveTo(0, tipY);
  shape.bezierCurveTo(-halfW * 0.42, -0.38 * scale, -halfW, -0.06 * scale, -halfW, waistY);
  shape.bezierCurveTo(-halfW, lobeY, -halfW * 0.32, lobeY * 1.12, -0.04 * scale, notchY * 1.22);
  shape.bezierCurveTo(-0.02 * scale, notchY * 1.05, 0, notchY, 0, notchY);
  shape.bezierCurveTo(0, notchY, 0.02 * scale, notchY * 1.05, 0.04 * scale, notchY * 1.22);
  shape.bezierCurveTo(halfW * 0.32, lobeY * 1.12, halfW, lobeY, halfW, waistY);
  shape.bezierCurveTo(halfW, -0.06 * scale, halfW * 0.42, -0.38 * scale, 0, tipY);
  return shape;
}

function heartGeo(scale, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(createHeartShape(scale), {
    depth, bevelEnabled: true, bevelSegments: 4, bevelThickness: bevel, bevelSize: bevel, steps: 1, curveSegments: 14,
  });
  g.center();
  return g;
}

// ellipsoid lobe with its transform baked in (keeps smooth normals for the outline)
function lobe(sx, sy, sz, rz, x, y, z) {
  return new THREE.SphereGeometry(1, 16, 10).scale(sx, sy, sz).rotateZ(rz).translate(x, y, z);
}

// ------------------------------------------------------------------ the heart vehicle
function createHeartPlatform() {
  const root = new THREE.Group();
  root.name = 'helloKittyHeartPlatform';
  const body = new THREE.Group(); // squash & bank pivot
  root.add(body);

  const gloss = { color: 0xffffff, threshold: 0.9, strength: 0.9 };
  const geo = heartGeo(1.0, 0.24, 0.08).rotateX(-Math.PI / 2);
  const heart = new THREE.Mesh(geo, toonMaterial(PINK, { gloss, rim: { color: 0xffe3ee, threshold: 0.66, strength: 0.5 } }));
  const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  ink.scale.set(1.06, 1.3, 1.06); // ink hull (the extrusion's split normals would crack a pushed outline)
  heart.add(ink);
  body.add(heart);

  const inlay = new THREE.Mesh(heartGeo(0.7, 0.03, 0.025).rotateX(-Math.PI / 2), toonMaterial(CREAM, { gloss }));
  inlay.position.y = 0.17;
  body.add(inlay);

  // Kitty's bow on the front-left lobe
  const bowGeo = mergeGeos([lobe(0.17, 0.1, 0.08, 0.35, -0.15, 0, 0), lobe(0.17, 0.1, 0.08, -0.35, 0.15, 0, 0), lobe(0.07, 0.07, 0.07, 0, 0, 0, 0.02)]);
  const bow = new THREE.Mesh(bowGeo, toonMaterial(RED, { gloss }));
  addOutline(bow, 0.022, INK);
  bow.position.set(-0.42, 0.26, -0.36);
  bow.rotation.set(-0.5, 0.2, -0.15);
  body.add(bow);

  // puffy cartoon wings: three fanned feather lobes each, one mesh per wing
  const wingGeo = mergeGeos([
    lobe(0.42, 0.075, 0.17, 0.32, 0.36, 0.13, 0),
    lobe(0.34, 0.07, 0.15, 0.08, 0.32, 0.0, 0.05),
    lobe(0.25, 0.065, 0.13, -0.2, 0.25, -0.1, 0.08),
  ]);
  const wingMat = toonMaterial(0xffffff, { gloss, rim: { color: 0xffd0e2, threshold: 0.6, strength: 0.6 } });
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.7, 0.12, 0.05);
    const w = new THREE.Mesh(wingGeo, wingMat);
    addOutline(w, 0.02, INK);
    w.scale.x = side; // mirrored for the left wing
    pivot.add(w);
    body.add(pivot);
    return { pivot, side };
  });

  return {
    root,
    body,
    update(time) {
      const flap = Math.sin(time * 9);
      for (const w of wings) {
        w.pivot.rotation.z = w.side * (0.15 + flap * 0.38);
        w.pivot.rotation.y = -w.side * (0.15 + Math.cos(time * 9) * 0.1);
      }
      heart.rotation.x = Math.sin(time * 4.0) * 0.04;
    },
  };
}

// ------------------------------------------------------------------ skill
export class HelloKittySkill {
  constructor({ scene, player, obstacles, cameraRig, chaser } = {}) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    this.FLY_ALTITUDE = 3.6;
    this.TAKEOFF_TIME = 0.85;
    this.LANDING_TIME = 0.95;
    this.DEFAULT_DURATION = 8.0;

    this.active = false;
    this.duration = this.DEFAULT_DURATION;
    this.timeRemaining = 0;
    this.maxTime = this.DEFAULT_DURATION;
    this.elapsed = 0;
    this.timeAlive = 0;
    this.currentFlyOffset = 0;
    this._lastHitTime = -Infinity;
    this._trail = 0;
    this._puff = 0;
    this._pop = -1;     // pop-in clock
    this._out = -1;     // pop-away clock (after the skill)
    this._sq = 1;       // squash spring
    this._sqV = 0;

    this.heartPlatform = createHeartPlatform();
    this.heartPlatform.root.visible = false;
    this.heartPlatform.root.position.set(0, -0.16, 0);
    player.root.add(this.heartPlatform.root);

    // tumbling outlined mini hearts (2 draw calls); a scaled-up twin is the ink hull
    const mini = heartGeo(0.16, 0.05, 0.02);
    this.hearts = new ToonPool(scene, mini, 40, toonMaterial(0xffffff, { gloss: { color: 0xffffff, threshold: 0.9, strength: 0.8 } }), 0.002, mini.clone().scale(1.22, 1.22, 1.5));
  }

  get heartSvgIcon() {
    return HEART_SVG_ICON;
  }

  _heartBurst(x, y, z, n, speed, scroll = true) {
    const cols = [PINK, DEEP, 0xffffff, RED];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.6 + Math.random() * 0.6);
      this.hearts.spawn(x, y, z, Math.cos(a) * v, 1.5 + Math.random() * speed * 0.6, Math.sin(a) * v * 0.6,
        0.7 + Math.random() * 0.4, 1, 1, cols[i % 4], { grav: 6, drag: 1.2, spin: 9, scroll });
    }
  }

  activate(duration) {
    if (this.active || game.halted || (this.player && this.player.controlsLocked)) return false;
    const dur = (typeof duration === 'number' && duration > 0) ? duration : this.DEFAULT_DURATION;
    this.active = true;
    this.duration = dur;
    this.maxTime = dur;
    this.timeRemaining = dur;
    this.elapsed = 0;
    this.timeAlive = 0;
    this.currentFlyOffset = 0;
    this._lastHitTime = -Infinity;
    this._pop = 0;
    this._out = -1;

    this.heartPlatform.root.visible = true;
    this.player.clearOverride();
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') this.chaser._dropBack();

    const p = this.player;
    puffBurst({ x: p.x, y: p.floorY + 0.05, z: 0 }, { n: 8, ring: true, radius: 0.6, speed: 3.2, size: 0.6, rise: 0.6, colors: CLOUDS, scroll: false });
    this._heartBurst(p.x, p.y + 0.4, 0, 10, 3.5, false);
    burst('heart', new THREE.Vector3(p.x, p.y + 1.0, -0.5), { color: PINK, size: 0.8, grow: 2.6, life: 0.4, follow: p.root });
    sticker('yay', new THREE.Vector3(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.3, -1.4), { follow: p.root, life: 0.8 });
    kick(0.2);
    this.cameraRig.shake(0.06, 0.2);

    emit('kittyFlyStart', { duration: this.duration });
    emit('specialOn', { mode: 'kitty', duration: this.duration, label: 'FLYING HEART' });
    return true;
  }

  beforePlayer(dt) {
    if (!this.active && this.currentFlyOffset <= 0) return;
    if (this.active) {
      let liftRatio = 1.0;
      if (this.elapsed < this.TAKEOFF_TIME) liftRatio = smoothstep(this.elapsed / this.TAKEOFF_TIME);
      else if (this.timeRemaining < this.LANDING_TIME) liftRatio = smoothstep(this.timeRemaining / this.LANDING_TIME);
      const bob = Math.sin(this.timeAlive * 3.5) * 0.08;
      this.currentFlyOffset = (this.FLY_ALTITUDE + bob) * liftRatio;
    } else {
      this.currentFlyOffset = Math.max(0, this.currentFlyOffset - dt * 6.0);
    }
    const baseFloor = this.player.floorY || 0;
    this.player.floorY = Math.max(baseFloor + this.currentFlyOffset, this.currentFlyOffset);
    if (this.player.grounded || this.player.y < this.player.floorY) {
      this.player.y = this.player.floorY;
      this.player.vy = 0;
      this.player.grounded = true;
    }
  }

  update(arg1, arg2) {
    const dt = typeof arg2 === 'number' ? arg2 : (typeof arg1 === 'number' ? arg1 : 0.016);
    this.timeAlive += dt;
    const running = game.state.mode === 'running' && !game.halted;
    this.hearts.update(dt, running ? game.state.speed * dt : 0);
    this._animatePlatform(dt);
    if (!this.active || game.halted) return;

    this.elapsed += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.heartPlatform.update(this.timeAlive);

    // trail: mini hearts, pink clouds, a few sparkles
    const p = this.player;
    this._trail -= dt;
    if (this._trail <= 0) {
      this._trail = 0.07;
      const cols = [PINK, DEEP, 0xffffff, RED];
      const x = p.x + (Math.random() - 0.5) * 1.2;
      this.hearts.spawn(x, p.y - 0.1, 0.4, (x - p.x) * 1.5, 0.6 + Math.random(), 2 + Math.random() * 2,
        0.75, 0.8 + Math.random() * 0.5, 1, cols[(Math.random() * 4) | 0], { grav: 2, drag: 0.8, spin: 7 });
      if (Math.random() < 0.5) sparkBurst({ x, y: p.y - 0.05, z: 0.3 }, { n: 1, speed: 2, colors: [0xffffff, PINK], life: 0.25, width: 0.05, scroll: false });
    }
    this._puff -= dt;
    if (this._puff <= 0 && this.currentFlyOffset > 0.5) {
      this._puff = 0.11;
      puffBurst({ x: p.x + (Math.random() - 0.5) * 1.1, y: p.y - 0.35, z: 0.35 }, { n: 1, size: 0.5, speed: 0.6, rise: -0.3, life: 0.6, colors: CLOUDS, vz: 2 });
    }
    if (this.timeRemaining <= 0) this.deactivate(true);
  }

  // pop in / pop away, squash spring, bank into lane changes
  _animatePlatform(dt) {
    const P = this.heartPlatform;
    if (!P.root.visible) return;
    let k = 1;
    if (this._pop >= 0) {
      this._pop += dt;
      k = this._pop < 0.1 ? 0.3 + (this._pop / 0.1) * 0.85 : this._pop < 0.22 ? 1.15 - ((this._pop - 0.1) / 0.12) * 0.15 : 1;
      if (this._pop > 0.22) this._pop = -1;
    }
    if (this._out >= 0) {
      this._out += dt;
      k = Math.max(0, 1 - this._out / 0.22) * (1 + Math.sin(this._out * 30) * 0.05);
      if (this._out >= 0.22) {
        this._out = -1;
        P.root.visible = false;
        return;
      }
    }
    this._sqV += ((1 - this._sq) * 300 - this._sqV * 14) * dt;
    this._sq += this._sqV * dt;
    const sy = Math.max(0.5, this._sq);
    P.body.scale.set(k / Math.sqrt(sy), k * sy, k / Math.sqrt(sy));
    const p = this.player;
    const lane = dt > 0 ? (p.x - (p.lastX ?? p.x)) / dt : 0;
    P.body.rotation.z += (-lane * 0.03 - P.body.rotation.z) * Math.min(1, dt * 10);
  }

  absorbHit(hit) {
    if (!this.active) return false;
    const now = performance.now();
    if (now - this._lastHitTime < 100) return true;
    this._lastHitTime = now;

    if (hit && hit.obstacle) this.obstacles.remove(hit.obstacle);
    const list = this.obstacles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (Math.abs(o.x - this.player.x) <= 2.2 && o.z > -7.0 && (o.z - o.length) < 2.5) this.obstacles.remove(o);
    }
    const p = this.player;
    const hitPos = (hit && hit.position) ? hit.position.clone() : new THREE.Vector3(p.x, 1.2, 0);
    hitPos.z = Math.min(hitPos.z, -0.5);

    hitStop(0.06);
    impactFrame({ at: new THREE.Vector3(p.x, p.y + 0.9, 0), bg: 0xffe3ee, dot: 0xffb3cf, line: DEEP });
    burst('heart', hitPos, { color: PINK, size: 0.6, grow: 3.2, life: 0.4, spin: 1.5 });
    this._heartBurst(hitPos.x, hitPos.y, hitPos.z, 14, 6);
    chunkBurst(hitPos, { n: 8, force: 8, size: 0.22, colors: [0xffd0e2, 0xffffff, 0xc9c3d6] });
    sticker('boing', new THREE.Vector3(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.3, -1.4), { follow: p.root, life: 0.8 });
    this._sq = 0.6;
    this._sqV = 0;
    kick(0.35);
    this.cameraRig.shake(0.2, 0.3);
    sfx('crash', { position: hitPos.clone() });
    emit('kittyHeartBurst', { position: hitPos.clone() });
    this.obstacles.grace(0.8);
    return true;
  }

  deactivate(expired = false) {
    if (!this.active) return;
    this.active = false;
    this.timeRemaining = 0;
    const p = this.player;
    this._out = 0;
    this._pop = -1;
    puffBurst({ x: p.x, y: p.y - 0.2, z: 0 }, { n: 7, ring: true, radius: 0.5, speed: 3, size: 0.55, rise: 0.4, colors: CLOUDS, scroll: false });
    this._heartBurst(p.x, p.y, 0, 8, 3.5, false);
    this.obstacles.grace(1.5);
    emit('kittyFlyEnd');
    emit('specialOff');
  }

  reset() {
    if (this.active) this.deactivate(false);
    this.currentFlyOffset = 0;
    this.elapsed = 0;
    this.timeRemaining = 0;
    this.timeAlive = 0;
    this._lastHitTime = -Infinity;
    this._pop = this._out = -1;
    this._sq = 1;
    this._sqV = 0;
    this.heartPlatform.root.visible = false;
    this.hearts.clear();
  }

  dispose() {
    this.reset();
  }
}

export function createHelloKittySkill(options = {}) {
  return new HelloKittySkill(options);
}

export default createHelloKittySkill;
