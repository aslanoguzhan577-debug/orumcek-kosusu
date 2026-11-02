// repulsor.js — Iron Man Repulsor Boost:
// In the first 7 seconds of any run, press the bottom-left button.
// Iron Man swoops in from behind, grabs the player from behind/above,
// rotates both characters into a horizontal rocket flight pose, and fires
// full ARC-REACTOR CYAN/BLUE LINEAR REPULSOR THRUSTERS to rocket forward
// until reaching 2000 score!
// Then descends, lands the player safely on the track, and blasts off into space.

import * as THREE from 'three';
import { game } from '../game.js';
import { CONFIG } from '../config.js';
import { createIronMan } from '../models/ironman.js';
import { getJetStartCount, useJetStart } from '../shop.js';

const FLY_HEIGHT = 4.8;             // altitude during horizontal flight
const ARRIVE_TIME = 0.40;           // swoop in from behind camera
const LIFTOFF_TIME = 0.45;          // grab player, rise and pitch horizontal
const MAX_FLY_DURATION = 3.2;       // max flight time to cover the distance
const DESCEND_TIME = 0.50;          // descent and level out back to track
const DEPART_TIME = 0.60;           // Iron Man rockets up into the clouds
const WINDOW_SECONDS = 7;           // skill window from run start

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Creates an authentic Iron Man Arc-Reactor Repulsor Thruster:
 * - Linear, collimated laser beam geometry ("çizgisel")
 * - High-tech Arc-Reactor Cyan & Electric Blue color palette
 * - Blinding pure-white plasma laser core
 * - 4 fine linear streak filaments trailing back
 * - 3 Concentric energy shock-diamond rings along the beam
 * - Emitter lens ring at nozzle
 */
function createThrusterAssembly() {
  const group = new THREE.Group();

  // 1. Hot white linear laser core beam
  const coreGeo = new THREE.CylinderGeometry(0.022, 0.038, 3.2, 12, 1, true);
  coreGeo.translate(0, -1.6, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // 2. Arc-Reactor Cyan Plasma Column
  const plasmaGeo = new THREE.CylinderGeometry(0.048, 0.082, 2.8, 12, 1, true);
  plasmaGeo.translate(0, -1.4, 0);
  const plasmaMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
  group.add(plasmaMesh);

  // 3. Deep electric cobalt-blue outer ion sheath
  const auraGeo = new THREE.CylinderGeometry(0.078, 0.14, 2.2, 12, 1, true);
  auraGeo.translate(0, -1.1, 0);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x0055ff,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  group.add(auraMesh);

  // 4. Linear Laser Streak Filaments ("çizgisel" laser lines)
  const streakGroup = new THREE.Group();
  const streakMat = new THREE.MeshBasicMaterial({
    color: 0x80ffff,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const streaks = [];
  const streakAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  for (const a of streakAngles) {
    const sGeo = new THREE.CylinderGeometry(0.006, 0.009, 3.8, 4, 1, true);
    sGeo.translate(0, -1.9, 0);
    const sMesh = new THREE.Mesh(sGeo, streakMat);
    const r = 0.038;
    sMesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    streakGroup.add(sMesh);
    streaks.push(sMesh);
  }
  group.add(streakGroup);

  // 5. Shock-Diamond Energy Rings along the beam
  const ringGroup = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ringDistances = [-0.45, -1.15, -2.0];
  const ringMeshes = [];
  for (let i = 0; i < ringDistances.length; i++) {
    const rGeo = new THREE.RingGeometry(0.025, 0.065 + i * 0.02, 16);
    rGeo.rotateX(Math.PI / 2);
    const rMesh = new THREE.Mesh(rGeo, ringMat);
    rMesh.position.y = ringDistances[i];
    ringGroup.add(rMesh);
    ringMeshes.push(rMesh);
  }
  group.add(ringGroup);

  // 6. Nozzle Emitter Arc-Disc at base
  const nozzleGeo = new THREE.RingGeometry(0.015, 0.08, 16);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
  group.add(nozzleMesh);

  return {
    group,
    setPower(power, time) {
      if (power <= 0.01) {
        group.visible = false;
        return;
      }
      group.visible = true;

      // High-frequency reactor micro-humming (40-60Hz)
      const hum = 1 + (Math.sin(time * 52) * 0.06 + Math.cos(time * 36) * 0.04);
      const lenHum = power * (1 + (Math.sin(time * 44) * 0.12 + Math.random() * 0.06));

      // Core beams maintain sleek collimated profile
      coreMesh.scale.set(power * hum, lenHum, power * hum);
      plasmaMesh.scale.set(power * hum, lenHum * 0.95, power * hum);
      auraMesh.scale.set(power * hum, lenHum * 0.85, power * hum);

      // Streak filaments rotate subtly with intense linear speed
      streakGroup.rotation.y = time * 8;
      for (let i = 0; i < streaks.length; i++) {
        const sLen = lenHum * (0.95 + Math.sin(time * 30 + i) * 0.15);
        streaks[i].scale.set(power, sLen, power);
      }

      // Energy rings pulse and travel down the beam
      for (let i = 0; i < ringMeshes.length; i++) {
        const pulse = 1 + Math.sin(time * 24 + i * 2) * 0.2;
        ringMeshes[i].scale.set(pulse, pulse, pulse);
      }

      nozzleMesh.scale.set(power * hum, power * hum, power * hum);
    },
  };
}

export class RepulsorBoost {
  constructor({ player, scene }) {
    this.player = player;
    this.scene = scene;
    this.active = false;
    this.used = false;
    this.phase = 'idle'; // 'arrive' | 'liftoff' | 'fly' | 'descend' | 'depart' | 'idle'
    this.elapsed = 0;
    this.flightTime = 0;
    this.targetDistance = 2000;

    // Helper Iron Man model
    this.ironModel = createIronMan();
    this.ironRoot = this.ironModel.root;
    this.ironRoot.visible = false;
    this.ironModel.setState('jump');
    scene.add(this.ironRoot);

    // Dynamic Arc-Reactor Cyan Light on Iron Man
    this.engineLight = new THREE.PointLight(0x00e5ff, 0, 14);
    this.ironRoot.add(this.engineLight);

    // Build linear cyan thrusters (2 boots, 2 hands)
    this.thrusters = [];
    const thrusterDefs = [
      { x: -0.12, y: 0.04, z: 0 },       // left boot
      { x: 0.12, y: 0.04, z: 0 },        // right boot
      { x: -0.27, y: 0.32, z: -0.06 },   // left hand
      { x: 0.27, y: 0.32, z: -0.06 },    // right hand
    ];

    for (const def of thrusterDefs) {
      const th = createThrusterAssembly();
      th.group.position.set(def.x, def.y, def.z);
      this.ironRoot.add(th.group);
      this.thrusters.push(th);
    }
  }

  get available() {
    return !this.active
      && !this.used
      && getJetStartCount() > 0
      && game.state.mode === 'running'
      && !game.state.intro
      && game.state.time <= WINDOW_SECONDS;
  }

  get windowLeft() {
    if (this.used || this.active) return 0;
    if (game.state.mode !== 'running') return WINDOW_SECONDS;
    return Math.max(0, WINDOW_SECONDS - game.state.time);
  }

  activate() {
    if (!this.available) return;
    if (!useJetStart()) return;
    this.active = true;
    this.used = true;
    this.elapsed = 0;
    this.flightTime = 0;
    this.phase = 'arrive';

    // Target: advance until score/distance reaches 2000!
    this.targetDistance = game.state.distance < 2000 ? 2000 : (game.state.distance + 2000);

    // Show Iron Man, start high behind camera
    this.ironRoot.visible = true;
    this.ironModel.setState('jump');
    this.ironRoot.position.set(
      this.player.x,
      this.player.y + 6.0,
      this.player.root.position.z + 10.0
    );
    this.ironRoot.rotation.set(-0.6, 0, 0);

    // Thrusters start firing with arc-reactor cyan energy
    this._setThrusterPower(0.65, 0);
  }

  _setThrusterPower(p, time) {
    for (const th of this.thrusters) th.setPower(p, time);
    this.engineLight.intensity = p * 4.5;
  }

  beforePlayer(dt) {
    if (!this.active) return;
    this.elapsed += dt;

    // While boost is active, keep player invincible
    if (this.phase !== 'depart' && this.phase !== 'idle') {
      if (game.obstacles) game.obstacles.grace(0.5);
    }

    const px = this.player.x;
    const pz = this.player.root.position.z;

    switch (this.phase) {
      case 'arrive': {
        // Iron Man swoops in from behind camera to right behind player's back
        const k = Math.min(1, this.elapsed / ARRIVE_TIME);
        const sk = smoothstep(k);

        const targetY = this.player.y + 0.22;
        const targetZ = pz + 0.38;

        this.ironRoot.position.set(
          px,
          THREE.MathUtils.lerp(this.player.y + 6.0, targetY, sk),
          THREE.MathUtils.lerp(pz + 10.0, targetZ, sk)
        );
        this.ironRoot.rotation.x = THREE.MathUtils.lerp(-0.6, 0, sk);

        this._setThrusterPower(0.65 + sk * 0.35, this.elapsed);

        if (k >= 1) {
          this.phase = 'liftoff';
          this.elapsed = 0;

          // Lock player controls, pose into jump
          this.player.controlsLocked = true;
          this.player.setOverride('jump', Infinity);

          // Tilt camera up to capture the ascent
          if (game.cameraRig) game.cameraRig.setTilt(true);
        }
        break;
      }

      case 'liftoff': {
        // Both characters lift off and pitch forward into horizontal rocket pose!
        const k = Math.min(1, this.elapsed / LIFTOFF_TIME);
        const sk = smoothstep(k);

        const h = THREE.MathUtils.lerp(this.player.floorY, FLY_HEIGHT, sk);
        this.player.y = h;
        this.player.vy = 0;
        this.player.grounded = false;

        // Pitch both forward horizontally: 0 -> -1.42 radians (~82 degrees prone)
        const pitch = THREE.MathUtils.lerp(0, -1.42, sk);
        this.player.root.rotation.x = pitch;
        this.ironRoot.rotation.x = pitch;

        // Iron Man holding player from behind/above
        this.ironRoot.position.set(px, h + 0.22, pz + 0.38);

        this._setThrusterPower(0.85 + sk * 0.15, this.elapsed);

        if (k >= 1) {
          this.phase = 'fly';
          this.elapsed = 0;
          this.flightTime = 0;
        }
        break;
      }

      case 'fly': {
        this.flightTime += dt;

        // Aerodynamic hover wave
        const bob = Math.sin(this.flightTime * 9) * 0.08;
        const h = FLY_HEIGHT + bob;
        this.player.y = h;
        this.player.vy = 0;
        this.player.grounded = false;

        // Locked in horizontal flight
        this.player.root.rotation.x = -1.42;
        this.ironRoot.rotation.x = -1.42;
        this.ironRoot.position.set(px, h + 0.22, pz + 0.38);

        // Calculate supersonic speed to hit exactly 2000 score in ~2.8s
        const distRemaining = Math.max(0, this.targetDistance - game.state.distance);
        const timeRemaining = Math.max(0.15, MAX_FLY_DURATION - this.flightTime);
        const neededSpeed = distRemaining / timeRemaining;
        const speed = THREE.MathUtils.clamp(neededSpeed, 250, 800);

        game.speedOverride = speed;

        // Arc-reactor linear thrusters at full power with subtle reactor pulse
        this._setThrusterPower(1.0, this.elapsed);

        // Continuous subtle rocket rumble
        if (game.cameraRig && Math.random() < 0.4) {
          game.cameraRig.shake(0.04, 0.1);
        }

        // Distance reached target score!
        if (game.state.distance >= this.targetDistance || this.flightTime >= MAX_FLY_DURATION) {
          game.state.distance = Math.max(game.state.distance, this.targetDistance);
          game.state.score = Math.floor(game.state.distance * CONFIG.scorePerMeter) + game.state.coins * CONFIG.coinScore;

          this.phase = 'descend';
          this.elapsed = 0;

          // Decelerate
          game.speedOverride = CONFIG.cruiseSpeed;
        }
        break;
      }

      case 'descend': {
        // Lower back to the track and pitch back to vertical
        const k = Math.min(1, this.elapsed / DESCEND_TIME);
        const sk = smoothstep(k);

        const h = THREE.MathUtils.lerp(FLY_HEIGHT, this.player.floorY, sk);
        this.player.y = Math.max(this.player.floorY, h);
        this.player.vy = 0;
        this.player.grounded = false;

        // Pitch back: -1.42 -> 0
        const pitch = THREE.MathUtils.lerp(-1.42, 0, sk);
        this.player.root.rotation.x = pitch;
        this.ironRoot.rotation.x = pitch;

        this.ironRoot.position.set(px, this.player.y + 0.22, pz + 0.38);

        this._setThrusterPower(1.0 - sk * 0.4, this.elapsed);

        if (k >= 1) {
          this.phase = 'depart';
          this.elapsed = 0;

          // Release player safely
          this.player.y = this.player.floorY;
          this.player.grounded = true;
          this.player.controlsLocked = false;
          this.player.clearOverride();
          this.player.root.rotation.x = 0;

          // Restore normal game speed and give post-flight grace
          game.speedOverride = null;
          if (game.obstacles) game.obstacles.grace(1.5);
          if (game.cameraRig) {
            game.cameraRig.setTilt(false);
            game.cameraRig.shake(0.12, 0.25);
          }
        }
        break;
      }

      case 'depart': {
        // Iron Man rockets up into the sky and departs
        const k = Math.min(1, this.elapsed / DEPART_TIME);
        const sk = smoothstep(k);

        this.ironRoot.position.y += 35 * dt;
        this.ironRoot.position.z -= 18 * dt;
        this.ironRoot.rotation.x = -0.7;

        this._setThrusterPower(1.2, this.elapsed);

        if (k >= 1) {
          this.ironRoot.visible = false;
          this._setThrusterPower(0, 0);
          this.phase = 'idle';
          this.active = false;
        }
        break;
      }
    }

    this.ironModel.update(dt);
  }

  update(dt) {
    // nothing needed after player update
  }

  reset() {
    if (this.active) {
      this.player.controlsLocked = false;
      this.player.clearOverride();
      this.player.root.rotation.x = 0;
      game.speedOverride = null;
      if (game.cameraRig) game.cameraRig.setTilt(false);
      if (game.obstacles) game.obstacles.grace(0);
    }
    this.active = false;
    this.used = false;
    this.elapsed = 0;
    this.flightTime = 0;
    this.phase = 'idle';
    this.ironRoot.visible = false;
    this.ironRoot.rotation.set(0, 0, 0);
    this._setThrusterPower(0, 0);
  }
}
