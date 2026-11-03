// skillBatman.js — Batman "Gece Pelerini" (Night Glide, 8 s) special skill.
//
// Gameplay (unchanged): time based (8 s); he climbs to 3.6 m over the first 0.8 s,
// glides pitched forward, lands over the last 1.0 s; stumble immunity; a hit is absorbed
// (lane cleared, 1.5 s grace) and ends the glide.
// Look ("comic + vinyl", vfxCore.js; everything built at load, pooled, no lights):
//   * the Bat-Signal lights up on the clouds when he takes off, a searchlight sweeping up to it;
//   * a big toon bat-wing glider cape (navy satin, cool moonlit rim, yellow bat emblem on the
//     back) that unfurls with a snap and ripples in the wind;
//   * two thick wind ribbons peel off the wingtips;
//   * a swarm of real-size bat silhouettes flaps out of the cape and away ahead of him;
//   * a hit: freeze frame, yellow comic panel, KAPOW!, a burst of bats, the cape folds away.

import * as THREE from 'three';
import { emit } from '../events.js';
import { game } from '../game.js';
import { toonMaterial } from '../models/toon.js';
import {
  ToonPool, canvasTex, chunkBurst, sparkBurst, sticker, impactFrame, hitStop, kick, sfx,
} from '../vfxCore.js';

export const BATMAN_GLIDE_TIME = 8;
export const FLY_ALTITUDE = 3.6;
export const TAKEOFF_TIME = 0.8;
export const LANDING_TIME = 1.0;
const GLIDE_PITCH_ANGLE = 0.52;
const CAPE_SEGMENTS_X = 24;
const CAPE_SEGMENTS_Y = 12;
const CAPE_WINGSPAN = 2.8;
const CAPE_LENGTH = 1.6;
const NAVY = 0x23263a, YELLOW = 0xf4c922, BAT = 0x17171f;
const TRAIL_N = 12;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _side = new THREE.Vector3(), _view = new THREE.Vector3();

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export const BAT_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100%" height="100%" fill="currentColor">
  <path d="M 50 16 C 52 11, 54 6, 56 2 C 57 8, 60 11, 65 13 C 75 8, 86 11, 98 20 C 92 28, 89 38, 92 50
    C 83 45, 73 47, 65 54 C 60 46, 54 45, 50 51 C 46 45, 40 46, 35 54 C 27 47, 17 45, 8 50
    C 11 38, 8 28, 2 20 C 14 11, 25 8, 35 13 C 40 11, 43 8, 44 2 C 46 6, 48 11, 50 16 Z" />
</svg>`;

// the same bat outline, in metres (1 m wide), y up
const BAT_PTS = [[50, 16], [52, 11], [54, 6], [56, 2], [57, 8], [60, 11], [65, 13], [75, 8], [86, 11], [98, 20], [92, 28], [89, 38], [92, 50],
  [83, 45], [73, 47], [65, 54], [60, 46], [54, 45], [50, 51], [46, 45], [40, 46], [35, 54], [27, 47], [17, 45], [8, 50],
  [11, 38], [8, 28], [2, 20], [14, 11], [25, 8], [35, 13], [40, 11], [43, 8], [44, 2], [46, 6], [48, 11]];
function batPath(g, cx, cy, s) {
  g.beginPath();
  BAT_PTS.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, cx + (x - 50) * s, cy + (y - 28) * s));
  g.closePath();
}

// Bat-Signal: a soft lit oval on the clouds with the bat cut out of it
function drawSignal(g, W, H) {
  g.clearRect(0, 0, W, H);
  const grad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grad.addColorStop(0, 'rgba(255,246,200,0.95)');
  grad.addColorStop(0.62, 'rgba(255,232,140,0.85)');
  grad.addColorStop(0.8, 'rgba(255,225,120,0.35)');
  grad.addColorStop(1, 'rgba(255,225,120,0)');
  g.save();
  g.scale(1, H / W);
  g.fillStyle = grad;
  g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, 6.283); g.fill();
  g.restore();
  g.fillStyle = '#1c2440';
  batPath(g, W / 2, H / 2, W * 0.0068);
  g.fill();
}

function drawEmblem(g, W, H) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#f4c922';
  g.strokeStyle = '#1c1016';
  g.lineWidth = 8;
  g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.46, H * 0.44, 0, 0, 6.283); g.fill(); g.stroke();
  g.fillStyle = '#1c1016';
  batPath(g, W / 2, H / 2 + 2, W * 0.0085);
  g.fill();
}

function drawBeam(g, W, H) {
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(255,240,180,0)');
  grad.addColorStop(0.5, 'rgba(255,240,180,1)');
  grad.addColorStop(1, 'rgba(255,240,180,0)');
  g.clearRect(0, 0, W, H);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

// flat bat silhouettes facing the camera; the flap squashes the wings, no tumbling
class BatPool extends ToonPool {
  update(dt, dz) {
    let alive = 0, top = 0;
    const m = _m, q = _q, e = _e, v = _v, s = _s;
    for (let i = 0; i < this.used; i++) {
      if (this.life[i] <= 0) continue;
      const k = i * 3;
      alive++;
      top = i + 1;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.mesh.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
      const t = 1 - this.life[i] / this.max[i];
      this.p[k] += this.vel[k] * dt; this.p[k + 1] += this.vel[k + 1] * dt; this.p[k + 2] += this.vel[k + 2] * dt + (this.scroll[i] ? dz : 0);
      this.rot[k] += dt * 26; // flap clock
      const flap = Math.abs(Math.sin(this.rot[k] + this.rot[k + 1]));
      const sc = this.s0[i] * (t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1);
      q.setFromEuler(e.set(0, 0, Math.sin(this.rot[k] * 0.3 + this.rot[k + 1]) * 0.35));
      this.mesh.setMatrixAt(i, m.compose(v.set(this.p[k], this.p[k + 1], this.p[k + 2]), q, s.set(sc * (0.75 + 0.25 * flap), sc * (0.3 + 0.7 * flap), sc)));
    }
    this.used = top;
    this.mesh.count = top;
    this.mesh.visible = alive > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class BatmanSkill {
  constructor({ scene, player, obstacles, cameraRig, chaser } = {}) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    this.active = false;
    this.mode = 'batman';
    this.label = 'GECE PELERİNİ';
    this.batSvgIcon = BAT_SVG_ICON;

    this.FLY_ALTITUDE = FLY_ALTITUDE;
    this.TAKEOFF_TIME = TAKEOFF_TIME;
    this.LANDING_TIME = LANDING_TIME;
    this.currentFlyOffset = 0;
    this.elapsed = 0;
    this.timeAlive = 0;

    this.maxTime = BATMAN_GLIDE_TIME;
    this.timeRemaining = this.maxTime;
    this.progress = 1.0;
    this._origCapes = [];
    this._unfurl = -1;
    this._fold = -1;
    this._batT = 0;
    this._signalT = -1;

    // cape (on the player, at the shoulders)
    this.capeGroup = new THREE.Group();
    this.capeGroup.name = 'batmanGliderCape';
    this.capeGroup.position.set(0, 0.96, -0.08);
    this.capeGroup.visible = false;
    this._buildCape();
    player.root.add(this.capeGroup);

    // wingtip wind ribbons: two tapered strips in world space (1 draw call)
    this.trail = new Float32Array(2 * TRAIL_N * 3);
    this.trailCount = 0;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * TRAIL_N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let r = 0; r < 2; r++) for (let i = 0; i < TRAIL_N - 1; i++) {
      const a = (r * TRAIL_N + i) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    tg.setIndex(idx);
    this.ribbons = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xeef3ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.ribbons.frustumCulled = false;
    this.ribbons.visible = false;
    this.ribbons.renderOrder = 6;
    scene.add(this.ribbons);

    // bat swarm (1 draw call)
    const shape = new THREE.Shape(BAT_PTS.map(([x, y]) => new THREE.Vector2((x - 50) / 96, (28 - y) / 96)));
    this.bats = new BatPool(scene, new THREE.ShapeGeometry(shape), 40, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 0);
    this.bats.mesh.renderOrder = 7;

    // Bat-Signal on the clouds + its searchlight
    this.signal = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 160, drawSignal), fog: false, depthWrite: false, transparent: true, opacity: 0 }));
    this.signal.position.set(6, 34, -120);
    this.signal.scale.set(30, 18.75, 1);
    this.signal.visible = false;
    this.signal.frustumCulled = false;
    scene.add(this.signal);
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({
      map: canvasTex(64, 8, drawBeam), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    }));
    this.beam.position.set(-34, 0, -70);
    this.beam.visible = false;
    this.beam.frustumCulled = false;
    scene.add(this.beam);
  }

  _buildCape() {
    const cols = CAPE_SEGMENTS_X, rows = CAPE_SEGMENTS_Y;
    const total = (cols + 1) * (rows + 1);
    const geo = new THREE.PlaneGeometry(CAPE_WINGSPAN, CAPE_LENGTH, cols, rows);
    this.capeGeo = geo;
    const base = new Float32Array(total * 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < total; i++) {
      const iy = Math.floor(i / (cols + 1)), ix = i % (cols + 1);
      const u = (ix / cols) * 2 - 1, v = iy / rows, au = Math.abs(u);
      const span = v < 0.35 ? 0.35 + 0.65 * (v / 0.35) : 1.0 - 0.14 * Math.pow((v - 0.35) / 0.65, 2);
      const bx = u * (CAPE_WINGSPAN * 0.5) * Math.max(0.32, span);
      const arch = Math.sin(au * Math.PI * 3.0);
      const scallop = v > 0.55 ? ((v - 0.55) / 0.45) * (0.16 * (1.0 - Math.abs(arch))) : 0;
      const tipLift = v > 0.4 ? Math.pow(au, 2.5) * 0.16 : 0;
      const by = -v * CAPE_LENGTH + scallop + tipLift;
      const bz = Math.sin(v * Math.PI * 0.75) * 0.15 - Math.pow(au, 1.8) * 0.12 - 0.03;
      base[i * 3] = bx; base[i * 3 + 1] = by; base[i * 3 + 2] = bz;
      pos.setXYZ(i, bx, by, bz);
    }
    pos.setUsage(THREE.DynamicDrawUsage);
    geo.computeVertexNormals();
    this.capeBasePositions = base;
    this.capeMesh = new THREE.Mesh(geo, toonMaterial(NAVY, {
      side: THREE.DoubleSide, rim: { color: 0x9fb4e6, threshold: 0.55, strength: 0.75 }, gloss: { color: 0x6f7fb0, threshold: 0.93, strength: 0.5 },
    }));
    this.capeGroup.add(this.capeMesh);
    this.emblemMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: canvasTex(256, 160, drawEmblem), transparent: true, depthWrite: false }));
    this.emblemMesh.position.set(0, -0.36, 0.12);
    this.capeGroup.add(this.emblemMesh);
  }

  getHeroConfig() {
    return { name: 'batman', duration: this.maxTime, label: this.label, icon: this.batSvgIcon, className: 'batman' };
  }

  activate(duration) {
    if (this.active || game.halted || (this.player && this.player.controlsLocked)) return false;
    const dur = (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) ? duration : BATMAN_GLIDE_TIME;
    this.maxTime = dur;
    this.timeRemaining = dur;
    this.elapsed = 0;
    this.progress = 1.0;
    this.active = true;
    this.timeAlive = 0;
    this.currentFlyOffset = 0;
    this.trailCount = 0;
    this._unfurl = 0;
    this._fold = -1;
    this._signalT = 0;

    this.capeGroup.visible = true;
    this.capeGroup.scale.set(1, 0.2, 1);
    this._hideDefaultCape();
    this.player.clearOverride();
    this.obstacles.grace(0.4);
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') this.chaser._dropBack();

    // the cape snaps open with a flurry of bats
    const p = this.player;
    for (let i = 0; i < 12; i++) this._spawnBat(p, i % 2 ? 1 : -1, 1.4);
    kick(0.3);
    this.cameraRig.shake(0.1, 0.25);

    emit('batmanGlideStart', { duration: this.maxTime });
    emit('specialOn', { mode: 'batman', duration: this.maxTime });
    return true;
  }

  _spawnBat(p, side, speed = 1) {
    const x = p.x + side * (0.9 + Math.random() * 0.6);
    this.bats.spawn(x, p.y + 0.6 + Math.random() * 0.6, 0.1,
      side * (1 + Math.random() * 3) * speed, (1.5 + Math.random() * 2.5) * speed, -(5 + Math.random() * 7) * speed,
      0.9 + Math.random() * 0.5, 0.45 + Math.random() * 0.3, 1, BAT, { scroll: false });
  }

  beforePlayer(dt) {
    if (!this.active && this.currentFlyOffset <= 0.001) return;
    if (this.active && !game.halted) {
      this.elapsed += dt;
      const remaining = Math.max(0, this.maxTime - this.elapsed);
      let takeoffRatio = 1.0;
      if (this.elapsed < this.TAKEOFF_TIME) takeoffRatio = smoothstep(this.elapsed / this.TAKEOFF_TIME);
      let landingRatio = 1.0;
      if (remaining < this.LANDING_TIME) landingRatio = smoothstep(remaining / this.LANDING_TIME);
      const liftRatio = Math.max(0, Math.min(1, Math.min(takeoffRatio, landingRatio)));
      const bob = Math.sin(this.timeAlive * 3.0) * 0.1;
      this.currentFlyOffset = (this.FLY_ALTITUDE + bob) * liftRatio;
    } else {
      this.currentFlyOffset = Math.max(0, this.currentFlyOffset - dt * 3.5);
    }
    if (this.currentFlyOffset > 0.001) {
      this.player.floorY += this.currentFlyOffset;
      if (this.player.grounded || this.player.y < this.player.floorY) {
        this.player.y = this.player.floorY;
        this.player.vy = 0;
        this.player.grounded = true;
      }
    }
    if ((this.active || this.currentFlyOffset > 0.5) && this.player.override === 'stumble') this.player.clearOverride();
  }

  update(dt) {
    this.timeAlive += dt;
    const time = this.timeAlive;
    const running = game.state.mode === 'running' && !game.halted;
    const dz = running ? game.state.speed * dt : 0;
    this.bats.update(dt, dz);
    this._updateSignal(dt);
    this._updateCapeOpen(dt);
    if (!this.active || game.halted) { if (!this.active) this.ribbons.visible = false; return; }

    const remaining = Math.max(0, this.maxTime - this.elapsed);
    this.timeRemaining = remaining;
    this.progress = Math.max(0, Math.min(1, remaining / this.maxTime));
    if (this.elapsed >= this.maxTime) {
      this.deactivate(true);
      return;
    }

    let pitchBlend = 1.0;
    if (this.elapsed < this.TAKEOFF_TIME) pitchBlend = smoothstep(this.elapsed / this.TAKEOFF_TIME);
    else if (remaining < this.LANDING_TIME) pitchBlend = smoothstep(remaining / this.LANDING_TIME);
    this.player.root.rotation.x = THREE.MathUtils.lerp(this.player.root.rotation.x, GLIDE_PITCH_ANGLE * pitchBlend, Math.min(1, dt * 11));

    this._updateCapePhysics(time);
    this._updateRibbons(dz);
    this._batT -= dt;
    if (this._batT <= 0) {
      this._batT = 0.16;
      this._spawnBat(this.player, Math.random() < 0.5 ? -1 : 1);
    }
  }

  // the Bat-Signal: fades in on the clouds, holds, fades out; the searchlight sweeps up to it
  _updateSignal(dt) {
    if (this._signalT < 0) return;
    this._signalT += dt;
    const t = this._signalT;
    const a = t < 0.35 ? t / 0.35 : t < 2.1 ? 1 : Math.max(0, 1 - (t - 2.1) / 0.5);
    this.signal.visible = this.beam.visible = a > 0;
    this.signal.material.opacity = a;
    const flick = 0.9 + Math.sin(t * 37) * 0.05;
    this.signal.scale.set(30 * flick * (0.85 + 0.15 * Math.min(1, t / 0.35)), 18.75 * flick, 1);
    this.beam.material.opacity = a * 0.35;
    // beam from the street (left) to the signal: length / angle toward it
    const dx = this.signal.position.x - this.beam.position.x, dy = this.signal.position.y - this.beam.position.y, dzz = this.signal.position.z - this.beam.position.z;
    const len = Math.hypot(dx, dy, dzz);
    this.beam.scale.set(9 + 9 * Math.min(1, t / 0.35), len * Math.min(1, t / 0.25), 1);
    this.beam.lookAt(this.signal.position);
    this.beam.rotateX(Math.PI / 2);
    if (a <= 0 && t > 1) this._signalT = -1;
  }

  _updateCapeOpen(dt) {
    const g = this.capeGroup;
    if (this._unfurl >= 0) {
      this._unfurl += dt;
      const t = this._unfurl;
      const y = t < 0.12 ? 0.2 + (t / 0.12) * 0.95 : t < 0.26 ? 1.15 - ((t - 0.12) / 0.14) * 0.15 : 1;
      g.scale.set(t < 0.12 ? 0.7 + t * 2.5 : 1, y, 1);
      if (t > 0.26) this._unfurl = -1;
    }
    if (this._fold >= 0) {
      this._fold += dt;
      const k = Math.max(0, 1 - this._fold / 0.25);
      g.scale.set(0.3 + 0.7 * k, k, 1);
      if (k <= 0) {
        this._fold = -1;
        g.visible = false;
        g.scale.set(1, 1, 1);
        this._restoreDefaultCape();
      }
    }
  }

  _updateCapePhysics(time) {
    const pos = this.capeGeo.attributes.position;
    const arr = pos.array, base = this.capeBasePositions;
    const cols = CAPE_SEGMENTS_X, rows = CAPE_SEGMENTS_Y;
    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      const bx = base[i3], by = base[i3 + 1], bz = base[i3 + 2];
      const iy = Math.floor(i / (cols + 1)), ix = i % (cols + 1);
      const au = Math.abs((ix / cols) * 2 - 1);
      const yr = iy / rows;
      const z = Math.sin(bx * 5.0 + time * 22.0) * 0.12 * yr + Math.sin(bx * 11.0 - time * 32.0) * 0.038 * yr
        + Math.cos(by * 7.0 + time * 18.0) * 0.045 * yr + Math.cos(time * 26.0 + au * 4.0) * 0.055 * yr * au;
      arr[i3] = bx + Math.sin(time * 12.0 + by * 3.5) * 0.02 * yr;
      arr[i3 + 1] = by + Math.cos(time * 14.0 + bx * 4.5) * 0.02 * yr;
      arr[i3 + 2] = bz + z;
    }
    pos.needsUpdate = true;
    this.capeGeo.computeVertexNormals();
  }

  // wingtip ribbons: new head points at the wingtips, older points left in the world
  _updateRibbons(dz) {
    const T = this.trail;
    for (let r = 0; r < 2; r++) {
      for (let i = TRAIL_N - 1; i > 0; i--) {
        const a = (r * TRAIL_N + i) * 3, b = (r * TRAIL_N + i - 1) * 3;
        T[a] = T[b]; T[a + 1] = T[b + 1]; T[a + 2] = T[b + 2] + dz;
      }
    }
    this.capeGroup.updateWorldMatrix(true, false);
    const tip = _v;
    for (let r = 0; r < 2; r++) {
      this.capeGroup.localToWorld(tip.set((r ? 1 : -1) * 1.3 * this.capeGroup.scale.x, -0.55, 0.05));
      const a = r * TRAIL_N * 3;
      T[a] = tip.x; T[a + 1] = tip.y; T[a + 2] = tip.z;
    }
    this.trailCount = Math.min(TRAIL_N, this.trailCount + 1);
    const pos = this.ribbons.geometry.attributes.position;
    const cam = this.cameraRig.camera.position;
    const d = _d, side = _side, view = _view, p = _s;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < TRAIL_N; i++) {
        const j = Math.min(i, this.trailCount - 1);
        const c = (r * TRAIL_N + j) * 3;
        p.set(T[c], T[c + 1], T[c + 2]);
        const n = (r * TRAIL_N + Math.min(j + 1, this.trailCount - 1)) * 3, m = (r * TRAIL_N + Math.max(j - 1, 0)) * 3;
        d.set(T[n] - T[m], T[n + 1] - T[m + 1], T[n + 2] - T[m + 2]);
        view.subVectors(cam, p).normalize();
        side.crossVectors(d, view).normalize();
        const w = 0.13 * (1 - i / (TRAIL_N - 1)) * (p.z > 2.5 ? 0 : 1); // tapers, never near the lens
        const v = (r * TRAIL_N + i) * 2;
        pos.setXYZ(v, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
        pos.setXYZ(v + 1, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
      }
    }
    pos.needsUpdate = true;
    this.ribbons.visible = this.trailCount > 2;
  }

  absorbHit(hit) {
    if (!this.active) return false;
    const p = this.player;
    const hitPos = (hit && hit.position) ? hit.position.clone() : new THREE.Vector3(p.x, 1.0, 0);
    hitPos.z = Math.min(hitPos.z, -0.5);
    if (hit?.obstacle) this.obstacles.remove(hit.obstacle);
    const list = this.obstacles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (Math.abs(o.x - p.x) <= 2.2 && o.z > -7.0 && (o.z - o.length) < 2.5) this.obstacles.remove(o);
    }
    hitStop(0.08);
    impactFrame({ at: new THREE.Vector3(p.x, p.y + 0.9, 0), bg: YELLOW, dot: 0xd9a800, line: 0x1c2440 });
    sticker('kapow', new THREE.Vector3(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.3, -1.4), { follow: p.root, life: 0.85 });
    chunkBurst(hitPos, { n: 10, force: 9, size: 0.24, colors: [0x2a2d3a, 0xc9c3d6, YELLOW] });
    sparkBurst(hitPos, { n: 12, speed: 8, colors: [YELLOW, 0xffffff] });
    for (let i = 0; i < 14; i++) this._spawnBat(p, i % 2 ? 1 : -1, 1.8);
    kick(0.4);
    this.cameraRig.shake(0.24, 0.35);
    sfx('crash', { position: hitPos.clone() });
    emit('batmanCloakSweep', { position: hitPos.clone() });
    this.obstacles.grace(1.5);
    this.deactivate(false);
    return true;
  }

  deactivate(expired = false) {
    if (!this.active) return;
    this.active = false;
    this.progress = 0;
    this.timeRemaining = 0;
    this._fold = 0; // folds away, then the model's own cape comes back
    this._unfurl = -1;
    this.ribbons.visible = false;
    this.player.root.rotation.x = 0;
    this.obstacles.grace(1.5);
    emit('batmanGlideEnd', { expired });
    emit('specialOff', { mode: 'batman', expired });
  }

  // the model's cape answers to a 4 x 8 plane signature (a stand-in mesh, see models/batman.js)
  _hideDefaultCape() {
    this._origCapes = [];
    this.player.root.traverse((obj) => {
      if (!obj.isMesh || obj.parent === this.capeGroup) return;
      const prm = obj.geometry && obj.geometry.parameters;
      if (prm && prm.widthSegments === 4 && prm.heightSegments === 8) {
        obj.visible = false;
        this._origCapes.push(obj);
      }
    });
  }

  _restoreDefaultCape() {
    for (const c of this._origCapes) c.visible = true;
    this._origCapes = [];
  }

  reset() {
    this.deactivate(false);
    this._fold = this._unfurl = this._signalT = -1;
    this.capeGroup.visible = false;
    this.capeGroup.scale.set(1, 1, 1);
    this._restoreDefaultCape();
    this.currentFlyOffset = 0;
    this.ribbons.visible = false;
    this.signal.visible = this.beam.visible = false;
    this.bats.clear();
  }

  dispose() {
    this.reset();
  }
}

export function createBatmanSkill(params = {}) {
  return new BatmanSkill(params);
}

export default createBatmanSkill;
