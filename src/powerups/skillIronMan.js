// skillIronMan.js — Iron Man "Unibeam" special skill.
//
// Gameplay (unchanged): 1 charge, 2.2 s; everything in his lane up to 200 m ahead is destroyed,
// hits are absorbed, 1.5 s grace at the end.
// Look ("comic + vinyl", vfxCore.js; everything built at load, no lights):
//   * lock-on (first 0.3 s): red reticles snap onto the obstacles ahead while the arc reactor
//     charges (the player is protected, nothing is destroyed yet);
//   * fire: freeze frame, cream / red comic panel, BWOOM!, the camera kicks back; a thick toon
//     beam (white-hot core, cyan sheath, deep blue rim, ink outline) leaves the chest with a
//     bright tip racing ahead; shock rings run down the beam; every target bursts into rubble
//     when the tip reaches it;
//   * the beam thins out over the last 0.3 s.

import * as THREE from 'three';
import { emit } from '../events.js';
import { game } from '../game.js';
import {
  INK, canvasTex, chunkBurst, sparkBurst, burst, sticker, impactFrame, hitStop, kick, sfx, triggerCameraShake,
} from '../vfxCore.js';

export const UNIBEAM_SVG_ICON = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="32" cy="32" r="29" fill="#c8202f" stroke="#1c1016" stroke-width="4"/>
  <circle cx="32" cy="32" r="20" fill="#ffd23a" stroke="#1c1016" stroke-width="3"/>
  <polygon points="32,17 45,40 19,40" fill="#e8f7ff" stroke="#1c1016" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="32" cy="33" r="6" fill="#ffffff" stroke="#1c1016" stroke-width="2"/>
</svg>`;

const DURATION = 2.2;
const LOCK = 0.3;        // reticles lock on, then the beam fires
const LEN = 200;         // beam length (m)
const SHOOT = 0.14;      // the tip reaches the end of the beam
const RETICLES = 6;
const PALETTE = { red: 0xc8202f, gold: 0xffd23a, cyan: 0x7fe9ff, white: 0xffffff };

const _p = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _k = new THREE.Vector3();

// toon beam: banded across its width (white-hot core along the middle, cyan sheath, blue rim;
// the view vector is flattened onto the beam's cross-section, so it works seen end-on too),
// energy bands running forward; bends with the curved world
const BEAM_VERT = /* glsl */`
uniform float uLen;
varying vec3 vN;
varying vec3 vV;
varying float vZ;
void main() {
  vec3 pos = position;
  pos.z *= uLen;
  vZ = -pos.z;
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vec3 ax = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  vec3 v = cameraPosition - w.xyz;
  vV = v - ax * dot(v, ax);
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * curveWorld(w);
}`;
const BEAM_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying float vZ;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  vec3 col = f > 0.55 ? vec3(1.0) : f > 0.25 ? vec3(0.5, 0.91, 1.0) : vec3(0.16, 0.42, 0.95);
  float band = step(fract(vZ * 0.12 - uTime * 7.0), 0.18);
  col = mix(col, vec3(1.0), band * 0.6 * step(0.25, f));
  gl_FragColor = vec4(col, 1.0);
}`;

function drawReticle(g, W) {
  g.clearRect(0, 0, W, W);
  const c = W / 2;
  g.lineCap = 'round';
  const pass = (w, col) => {
    g.lineWidth = w;
    g.strokeStyle = col;
    for (let i = 0; i < 4; i++) { // four arcs
      const a = i * Math.PI / 2 + 0.25;
      g.beginPath(); g.arc(c, c, W * 0.36, a, a + Math.PI / 2 - 0.5); g.stroke();
    }
    for (let i = 0; i < 4; i++) { // ticks pointing in
      const a = i * Math.PI / 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * W * 0.46, c + Math.sin(a) * W * 0.46);
      g.lineTo(c + Math.cos(a) * W * 0.26, c + Math.sin(a) * W * 0.26);
      g.stroke();
    }
  };
  pass(11, '#1c1016');
  pass(5, '#ffffff');
  g.fillStyle = '#1c1016';
  g.beginPath(); g.arc(c, c, 7, 0, 6.283); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(c, c, 3.5, 0, 6.283); g.fill();
}

export class IronManSkill {
  constructor({ scene, player, obstacles, cameraRig }) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;

    this.active = false;
    this.charges = 1;
    this.maxCharges = 1;
    this.duration = DURATION;
    this.timeRemaining = 0;
    this.t = 0;
    this.fired = false;
    this.unibeamSvgIcon = UNIBEAM_SVG_ICON;

    // beam: one shader cylinder (40 length segments, so the curved world can bend it) + ink hull
    this.root = new THREE.Group();
    this.root.name = 'unibeam';
    this.root.visible = false;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 40, true).rotateX(Math.PI / 2).translate(0, 0, -0.5);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uLen: { value: LEN }, uTime: { value: 0 } },
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, fog: false,
    });
    this.inkMat = new THREE.ShaderMaterial({
      uniforms: { uLen: this.beamMat.uniforms.uLen, uTime: this.beamMat.uniforms.uTime },
      vertexShader: BEAM_VERT, fragmentShader: 'void main() { gl_FragColor = vec4(0.11, 0.063, 0.086, 1.0); }',
      side: THREE.BackSide, fog: false,
    });
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.ink = new THREE.Mesh(geo, this.inkMat);
    for (const m of [this.beam, this.ink]) { m.frustumCulled = false; this.root.add(m); }
    // shock rings running down the beam: one instanced torus (1 draw call)
    this.rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.11, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 6);
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rings.frustumCulled = false;
    this.root.add(this.rings);
    // muzzle flare at the chest (always faces the camera)
    const flareTex = canvasTex(128, 128, (g, W) => {
      const c = W / 2;
      g.clearRect(0, 0, W, W);
      g.fillStyle = '#7fe9ff';
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? W * 0.2 : W * 0.48;
        i ? g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r) : g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(c, c, W * 0.2, 0, 6.283); g.fill();
    });
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, fog: false, depthWrite: false }));
    this.flare.renderOrder = 13;
    this.root.add(this.flare);
    this.tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, fog: false, depthWrite: false }));
    this.tip.renderOrder = 13;
    this.root.add(this.tip);
    scene.add(this.root);

    // lock-on reticles
    const retTex = canvasTex(128, 128, drawReticle);
    this.reticles = [];
    for (let i = 0; i < RETICLES; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: retTex, color: 0xffffff, depthTest: false, depthWrite: false, fog: false }));
      s.renderOrder = 27;
      s.visible = false;
      scene.add(s);
      this.reticles.push({ s, o: null, t: 0 });
    }
  }

  getChestPosition() {
    const p = this.player;
    return _p.set(p.x, p.y + (p.sliding ? 0.45 : 0.88), -0.3);
  }

  // obstacles in the line of fire (his lane, up to 200 m)
  _inLine(o) {
    return Math.abs(o.x - this.player.x) <= 2.0 && o.z >= -LEN && o.z <= 4.0;
  }

  _destroyObstaclesInRange(fx = true) {
    const list = this.obstacles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (!this._inLine(o)) continue;
      if (fx) {
        const cy = o.parts && o.parts[0] ? (o.parts[0].y0 + o.parts[0].y1) * 0.5 : 1;
        const z = Math.min(o.z, -1);
        const delay = this.t < LOCK + SHOOT ? Math.max(0, (-z / LEN) * SHOOT - (this.t - LOCK)) : 0;
        const at = { x: o.x, y: cy, z };
        chunkBurst(at, { n: 10, force: 9, size: 0.26, colors: [0xc9c3d6, PALETTE.red, PALETTE.gold], delay });
        sparkBurst(at, { n: 8, speed: 8, colors: [PALETTE.cyan, 0xffffff], delay });
      }
      this.obstacles.remove(o);
    }
  }

  activate() {
    if (this.active || this.charges <= 0) return false;
    this.charges--;
    this.active = true;
    this.duration = DURATION;
    this.timeRemaining = DURATION;
    this.t = 0;
    this.fired = false;
    this.root.visible = false;

    // lock-on: reticles on the nearest targets in the lane
    const targets = this.obstacles.active.filter((o) => this._inLine(o) && o.z > -70).sort((a, b) => b.z - a.z);
    this.reticles.forEach((r, i) => {
      r.o = targets[i] || null;
      r.t = -i * 0.035;
      r.s.visible = false;
    });
    const chest = this.getChestPosition();
    burst('glow', chest, { color: PALETTE.cyan, size: 0.3, grow: 1.2, life: LOCK, additive: true, follow: this.player.root });
    this.obstacles.grace(LOCK + 0.2);
    sfx('ironOn', { position: chest.clone() });
    emit('unibeam', { position: chest.clone() });
    return true;
  }

  _fire() {
    this.fired = true;
    const chest = this.getChestPosition();
    this.root.visible = true;
    hitStop(0.06);
    impactFrame({ at: chest, bg: 0xfff4d6, dot: 0xffd99a, line: PALETTE.red });
    sticker('bwoom', _s.set(this.player.x + (this.player.x > 0.5 ? -1.2 : 1.2), this.player.y + 2.3, -1.4), { follow: this.player.root, life: 0.8 });
    kick(-0.45); // recoil
    triggerCameraShake(this.cameraRig, 0.22, 0.35);
    sparkBurst(chest, { n: 14, speed: 7, colors: [PALETTE.cyan, 0xffffff, PALETTE.gold], scroll: false });
    sfx('venomBlastNova', { position: chest.clone() });
    for (const r of this.reticles) r.s.visible = false;
    this._destroyObstaclesInRange();
    this._updateBeam(chest, 0); // the freeze frame already shows the beam leaving the chest
  }

  update(time, dt) {
    if (!this.active) return;
    this.timeRemaining -= dt;
    this.t += dt;
    const chest = this.getChestPosition();

    if (!this.fired) {
      this._updateReticles(dt);
      if (this.t >= LOCK) this._fire();
    } else {
      this._updateBeam(chest, dt);
      this._destroyObstaclesInRange();
      if (Math.random() < 0.3) this.cameraRig.shake(0.03, 0.08);
    }
    if (this.timeRemaining <= 0) this.deactivate(true);
  }

  _updateReticles(dt) {
    const cam = this.cameraRig.camera;
    for (const r of this.reticles) {
      r.t += dt;
      if (!r.o || r.t < 0 || !this.obstacles.active.includes(r.o)) { r.s.visible = false; continue; }
      const o = r.o;
      const cy = o.parts && o.parts[0] ? (o.parts[0].y0 + o.parts[0].y1) * 0.5 : 1;
      r.s.position.set(o.x, cy, Math.min(o.z, -1));
      const dist = cam.position.distanceTo(r.s.position);
      const size = dist * 0.12;
      const k = Math.min(1, r.t / 0.12);
      const locked = k >= 1;
      r.s.scale.setScalar(size * (2.2 - 1.2 * (1 - (1 - k) ** 3)) * (locked ? 1 + 0.12 * Math.sin(r.t * 40) : 1));
      r.s.material.rotation = (1 - k) * 1.6;
      r.s.material.color.setHex(locked ? PALETTE.red : 0xffffff);
      r.s.visible = true;
    }
  }

  _updateBeam(chest, dt) {
    const age = this.t - LOCK;
    const fade = Math.min(1, Math.max(0, this.timeRemaining / 0.3));
    const pulse = 1 + Math.sin(age * 60) * 0.06;
    const r = 0.3 * fade * pulse;
    const reach = Math.min(1, age / SHOOT);
    this.root.position.copy(chest);
    this.beamMat.uniforms.uLen.value = LEN * reach;
    this.beamMat.uniforms.uTime.value += dt;
    this.beam.scale.set(r, r, 1);
    this.ink.scale.set(r * 1.25 + 0.025, r * 1.25 + 0.025, 1);
    // muzzle + racing tip
    const f = (0.9 + 0.25 * Math.sin(age * 50)) * Math.max(fade, 0.2);
    this.flare.scale.setScalar(f * 1.1);
    this.flare.material.rotation = age * 6;
    this.tip.visible = reach < 1;
    this.tip.position.set(0, 0, -LEN * reach);
    this.tip.scale.setScalar(1.6 + reach * 6);
    // shock rings: born at the chest, race forward, grow, shrink away
    for (let i = 0; i < 6; i++) {
      const k = ((age * 1.6 + i / 6) % 1);
      const z = -k * 45;
      const s = (r + 0.12) * (1 + k * 1.6) * (1 - k * k);
      this.rings.setMatrixAt(i, _m.compose(_s.set(0, 0, z), _q, _k.setScalar(s)));
    }
    this.rings.instanceMatrix.needsUpdate = true;
  }

  absorbHit(hit) {
    if (!this.active) return false;
    const hitPos = (hit && hit.position) ? hit.position : this.getChestPosition();
    if (hit && hit.obstacle) {
      chunkBurst(hitPos, { n: 12, force: 10, size: 0.26, colors: [0xc9c3d6, PALETTE.red, PALETTE.gold] });
      sparkBurst(hitPos, { n: 10, speed: 9, colors: [PALETTE.cyan, 0xffffff] });
      this.obstacles.remove(hit.obstacle);
    }
    triggerCameraShake(this.cameraRig, 0.2, 0.3);
    this.obstacles.grace(1.5);
    sfx('crash', { position: hitPos.clone() });
    return true;
  }

  deactivate(expired = false) {
    if (!this.active) return;
    this.active = false;
    this.timeRemaining = 0;
    this.root.visible = false;
    for (const r of this.reticles) { r.s.visible = false; r.o = null; }
    this.obstacles.grace(1.5);
    sfx('ironOff');
    emit('unibeamEnd', { expired });
  }

  reset() {
    this.deactivate(false);
    this.charges = this.maxCharges;
  }

  dispose() {
    this.reset();
  }
}

export function createIronManSkill({ scene, player, obstacles, cameraRig }) {
  return new IronManSkill({ scene, player, obstacles, cameraRig });
}
