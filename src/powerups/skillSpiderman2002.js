// skillSpiderman2002.js — Spider-Man 2002 (Raimi) Special Skill
// "Mancınık Ağ Zıplaması / Slingshot Web Jump"
//
// 1. Two-charge slingshot web mechanic (maxCharges: 2, 1 charge consumed per use).
// 2. Anticipation Phase (0.30s):
//    - High-tension twin white webs anchored to side buildings (x = -8 and x = +8).
//    - Web cables feature glowing white core, tensile silk sheath, and 4 pulsing energy rings.
//    - Hand glow flares and wall anchor web bursts with soft exponential falloff.
//    - Character leans backward (player.root.rotation.x = -0.6) bracing like a drawn slingshot.
//    - Camera FOV contracts (60 -> 50) and camera rig vibrates with elastic tension rumble.
// 3. Launch Phase (Slingshot Web Launch):
//    - Webs snap forward / dissolve with high-speed elastic release.
//    - Camera FOV instantly surges to 70 with an intense impulse shake.
//    - High-velocity parabolic launch (vy = 18 m/s, floorY elevated, obstacle clearance).
//    - Forward speed lines slipstream and expanding wind compression rings erupt.
// 4. Soft Landing:
//    - Smooth cushioned touchdown with ground web shockwave mandala.
//    - Obstacle immunity throughout flight and landing (absorbHit / grace).
// 5. Visual Standards:
//    - THREE.AdditiveBlending, transparent: true, depthWrite: false.
//    - Integrated with vfxCore (createGlowTexture, triggerCameraFov, triggerCameraShake, updateCameraFov, shatterObstacle).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import {
  createGlowTexture,
  triggerCameraFov,
  triggerCameraShake,
  updateCameraFov,
  shatterObstacle,
} from '../vfxCore.js';

export const SLINGSHOT_SVG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2.5 4.5 L12 14.5 L21.5 4.5" />
  <path d="M12 14.5 L12 21.5" stroke-width="2.2" />
  <circle cx="12" cy="14.5" r="2.8" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="1.5" />
  <circle cx="12" cy="14.5" r="1.1" fill="currentColor" />
  <path d="M6 8 L12 12.5 L18 8" opacity="0.65" stroke-dasharray="1 1.5" />
  <circle cx="2.5" cy="4.5" r="1.6" fill="currentColor" />
  <circle cx="21.5" cy="4.5" r="1.6" fill="currentColor" />
</svg>`;

const MAX_CHARGES = 2;
const ANTICIPATION_TIME = 0.30;
const LAUNCH_VY = 20.0;
const BASE_FOV = 60;
const ANTICIPATION_FOV = 50;
const LAUNCH_FOV = 70;

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _handL = new THREE.Vector3();
const _handR = new THREE.Vector3();
const _anchorL = new THREE.Vector3();
const _anchorR = new THREE.Vector3();

/**
 * Creates a single high-fidelity tensile web cable with core, outer glow, and energy rings.
 */
function createWebCable(side = -1) {
  const group = new THREE.Group();
  group.name = `slingshotWebCable_${side < 0 ? 'L' : 'R'}`;

  // Unit cylinder translated so origin is at the base
  const unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);

  // 1. Core tensile beam: brilliant white
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMesh = new THREE.Mesh(unitCylGeo, coreMat);
  group.add(coreMesh);

  // 2. Outer glowing silk sheath
  const sheathMat = new THREE.MeshBasicMaterial({
    color: 0x90e0ef,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sheathMesh = new THREE.Mesh(unitCylGeo, sheathMat);
  group.add(sheathMesh);

  // 3. Four pulsing energy rings distributed along the cable
  const ringGeo = new THREE.TorusGeometry(0.24, 0.038, 8, 22);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00f2fe,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const rings = [];
  for (let i = 0; i < 4; i++) {
    const ringMesh = new THREE.Mesh(ringGeo, ringMat.clone());
    group.add(ringMesh);
    rings.push(ringMesh);
  }

  // 4. Anchor wall web burst decal
  const anchorTex = createGlowTexture('#00b4d8', '#ffffff', 128);
  const anchorMat = new THREE.SpriteMaterial({
    map: anchorTex,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const anchorSprite = new THREE.Sprite(anchorMat);
  anchorSprite.scale.set(2.4, 2.4, 1.0);
  group.add(anchorSprite);

  // 5. Hand grip flare
  const gripTex = createGlowTexture('#ffffff', '#ffffff', 64);
  const gripMat = new THREE.SpriteMaterial({
    map: gripTex,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const gripSprite = new THREE.Sprite(gripMat);
  gripSprite.scale.set(1.1, 1.1, 1.0);
  group.add(gripSprite);

  return {
    group,
    coreMesh,
    sheathMesh,
    rings,
    anchorSprite,
    gripSprite,
    geometries: [unitCylGeo, ringGeo],
    materials: [coreMat, sheathMat, ringMat, anchorMat, gripMat],
    update(from, to, tensionRatio, time) {
      _dir.subVectors(to, from);
      const len = _dir.length();
      if (len < 0.01) return;

      const normDir = _dir.clone().divideScalar(len);
      const quat = new THREE.Quaternion().setFromUnitVectors(_up, normDir);

      // Core stretch
      coreMesh.position.copy(from);
      coreMesh.quaternion.copy(quat);
      const coreR = 0.045 + tensionRatio * 0.015;
      coreMesh.scale.set(coreR, len, coreR);

      // Sheath stretch
      sheathMesh.position.copy(from);
      sheathMesh.quaternion.copy(quat);
      const sheathR = 0.12 + Math.sin(time * 35) * 0.02;
      sheathMesh.scale.set(sheathR, len, sheathR);
      sheathMat.opacity = 0.55 + Math.sin(time * 40) * 0.25;

      // Energy rings positioning & pulsing
      const ringQuat = new THREE.Quaternion().setFromUnitVectors(_up, normDir);
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const segT = (i + 1) / (rings.length + 1);
        // Tension wave vibration along the line
        const wave = Math.sin(time * 45 + i * 1.8) * 0.03;
        ring.position.lerpVectors(from, to, THREE.MathUtils.clamp(segT + wave, 0.05, 0.95));
        ring.quaternion.copy(ringQuat);

        const pulse = 1.0 + Math.sin(time * 50 + i * 1.6) * 0.35 + tensionRatio * 0.25;
        ring.scale.set(pulse, pulse, pulse);
        ring.material.opacity = 0.65 + Math.sin(time * 55 + i * 2.0) * 0.35;
      }

      // Anchor decal on building wall
      anchorSprite.position.copy(to);
      const aScale = 2.2 + Math.sin(time * 30) * 0.4 + tensionRatio * 0.6;
      anchorSprite.scale.set(aScale, aScale, 1.0);
      anchorMat.opacity = 0.75 + tensionRatio * 0.25;

      // Hand grip flare
      gripSprite.position.copy(from);
      const gScale = 1.0 + Math.random() * 0.4 + tensionRatio * 0.5;
      gripSprite.scale.set(gScale, gScale, 1.0);
    },
    setVisible(v) {
      group.visible = v;
    },
    dispose() {
      for (const g of this.geometries) g.dispose();
      for (const m of this.materials) m.dispose();
      for (const r of this.rings) r.material.dispose();
    },
  };
}

/**
 * Creates high-speed aerodynamic streak lines that tunnel past the player during slingshot flight.
 */
function createSpeedLines(count = 36) {
  const group = new THREE.Group();
  group.name = 'slingshotSpeedLines';

  const lineGeo = new THREE.BoxGeometry(0.045, 0.045, 6.2);
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0x90e0ef,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lines = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(lineGeo, lineMat.clone());
    const speed = 75.0 + Math.random() * 35.0;
    const relX = (Math.random() - 0.5) * 5.8;
    const relY = Math.random() * 4.0;
    const z = -26.0 + Math.random() * 32.0;

    mesh.position.set(relX, relY, z);
    group.add(mesh);
    lines.push({ mesh, relX, relY, speed, length: 6.2 });
  }

  group.visible = false;

  return {
    group,
    lines,
    lineGeo,
    lineMat,
    update(dt, playerPos, active) {
      if (!active) {
        group.visible = false;
        return;
      }
      group.visible = true;

      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        item.mesh.position.z += item.speed * dt;
        item.mesh.position.x = playerPos.x + item.relX;
        item.mesh.position.y = playerPos.y + item.relY;

        if (item.mesh.position.z > 8.0) {
          item.mesh.position.z = -24.0 - Math.random() * 6.0;
          item.relX = (Math.random() - 0.5) * 5.5;
          item.relY = Math.random() * 3.8 - 0.3;
        }

        const edgeDist = Math.abs(item.mesh.position.z);
        const alpha = THREE.MathUtils.clamp(1.0 - edgeDist / 25.0, 0.2, 0.95);
        item.mesh.material.opacity = alpha * (0.6 + Math.random() * 0.4);
      }
    },
    dispose() {
      lineGeo.dispose();
      lineMat.dispose();
      lines.forEach(l => l.mesh.material.dispose());
    },
  };
}

/**
 * Creates expanding aerodynamic wind compression shockwave rings.
 */
function createWindRings(count = 6) {
  const group = new THREE.Group();
  group.name = 'slingshotWindRings';

  const ringGeo = new THREE.TorusGeometry(0.85, 0.05, 10, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const rings = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(ringGeo, ringMat.clone());
    mesh.visible = false;
    group.add(mesh);
    rings.push({
      mesh,
      active: false,
      age: 0,
      duration: 0.65,
      delay: i * 0.045,
      startScale: 0.8,
      endScale: 4.8,
      speedZ: 28.0,
    });
  }

  return {
    group,
    rings,
    ringGeo,
    ringMat,
    trigger(origin) {
      for (const r of rings) {
        r.active = true;
        r.age = -r.delay;
        r.mesh.position.copy(origin);
        r.mesh.scale.setScalar(r.startScale);
        r.mesh.material.opacity = 0.9;
        r.mesh.visible = false;
      }
    },
    update(dt) {
      let anyActive = false;
      for (const r of rings) {
        if (!r.active) continue;
        r.age += dt;
        if (r.age < 0) continue;

        r.mesh.visible = true;
        anyActive = true;
        const prog = r.age / r.duration;
        if (prog >= 1.0) {
          r.active = false;
          r.mesh.visible = false;
          continue;
        }

        const ease = 1 - Math.pow(1 - prog, 2.5);
        const s = THREE.MathUtils.lerp(r.startScale, r.endScale, ease);
        r.mesh.scale.set(s, s, s * 0.5);
        r.mesh.position.z += r.speedZ * dt;
        r.mesh.material.opacity = Math.max(0, (1.0 - prog) * 0.9);
      }
      group.visible = anyActive;
    },
    dispose() {
      ringGeo.dispose();
      ringMat.dispose();
      rings.forEach(r => r.mesh.material.dispose());
    },
  };
}

/**
 * Creates an expanding web cushion mandala disc on the pavement upon landing.
 */
function createLandingCushion() {
  const group = new THREE.Group();
  group.name = 'slingshotLandingCushion';

  const discGeo = new THREE.RingGeometry(0.2, 2.4, 32);
  discGeo.rotateX(-Math.PI / 2);
  const glowTex = createGlowTexture('#00b4d8', '#ffffff', 128);
  const discMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0x90e0ef,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  group.add(discMesh);
  group.visible = false;

  let active = false;
  let age = 0;
  const duration = 0.55;

  return {
    group,
    trigger(pos) {
      group.position.copy(pos);
      group.position.y += 0.02;
      group.visible = true;
      active = true;
      age = 0;
      discMesh.scale.setScalar(0.4);
      discMat.opacity = 0.95;
    },
    update(dt) {
      if (!active) return;
      age += dt;
      const prog = age / duration;
      if (prog >= 1.0) {
        active = false;
        group.visible = false;
        return;
      }
      const ease = 1 - Math.pow(1 - prog, 3);
      const s = THREE.MathUtils.lerp(0.4, 2.6, ease);
      discMesh.scale.setScalar(s);
      discMat.opacity = Math.max(0, (1.0 - prog) * 0.95);
    },
    dispose() {
      discGeo.dispose();
      discMat.dispose();
    },
  };
}

/**
 * Helper to fetch hand positions from player model or approximate offsets.
 */
function getHandPositions(player, leftOut, rightOut) {
  const parts = player.model?.parts;
  if (parts?.handL && typeof parts.handL.getWorldPosition === 'function') {
    parts.handL.getWorldPosition(leftOut);
  } else {
    player.root.localToWorld(leftOut.set(-0.38, 0.76, -0.20));
  }

  if (parts?.handR && typeof parts.handR.getWorldPosition === 'function') {
    parts.handR.getWorldPosition(rightOut);
  } else if (player.model?.hand && typeof player.model.hand.getWorldPosition === 'function') {
    player.model.hand.getWorldPosition(rightOut);
  } else {
    player.root.localToWorld(rightOut.set(0.38, 0.76, -0.20));
  }
}

/**
 * Factory for Spider-Man 2002 (Raimi) Special Skill.
 *
 * @param {Object} options
 * @param {THREE.Scene} options.scene
 * @param {Player} options.player
 * @param {Obstacles} options.obstacles
 * @param {CameraRig} options.cameraRig
 * @param {THREE.PerspectiveCamera} options.camera
 * @returns {Object} Spiderman 2002 Skill instance
 */
export function createSpiderman2002Skill({ scene, player, obstacles, cameraRig, camera }) {
  const actualScene = scene || game?.scene;
  const actualPlayer = player || game?.player;
  const actualObstacles = obstacles || game?.obstacles;
  const actualCameraRig = cameraRig || game?.cameraRig;
  const actualCamera = camera || actualCameraRig?.camera || game?.camera;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'skillSpiderman2002Root';
  if (actualScene) actualScene.add(rootGroup);

  // Sub-VFX components
  const cableL = createWebCable(-1);
  const cableR = createWebCable(1);
  rootGroup.add(cableL.group);
  rootGroup.add(cableR.group);
  cableL.setVisible(false);
  cableR.setVisible(false);

  const speedLines = createSpeedLines(36);
  rootGroup.add(speedLines.group);

  const windRings = createWindRings(6);
  rootGroup.add(windRings.group);

  const landingCushion = createLandingCushion();
  rootGroup.add(landingCushion.group);

  // Skill state
  let maxCharges = MAX_CHARGES;
  let charges = MAX_CHARGES;
  let active = false;
  let phase = 'idle'; // 'idle' | 'anticipation' | 'flight' | 'landing'
  let anticipationTimer = 0;
  let flightTimer = 0;
  let flightStartY = 0;
  let baseSpeed = null;

  function syncGameCharges() {
    if (game?.state) {
      game.state.webCharges = charges;
    }
  }

  const skill = {
    name: 'spiderman2002',
    maxCharges,
    get charges() {
      return charges;
    },
    set charges(val) {
      charges = Math.max(0, Math.min(maxCharges, val));
      syncGameCharges();
    },
    get baseSpeed() {
      return baseSpeed;
    },
    set baseSpeed(val) {
      baseSpeed = val;
    },
    slingshotSvgIcon: SLINGSHOT_SVG_ICON,
    get active() {
      return active;
    },
    get phase() {
      return phase;
    },

    /**
     * Activates the slingshot web jump skill if charges are available.
     * @returns {boolean} true if activation started, false otherwise.
     */
    activate() {
      if (active || phase !== 'idle') return false;
      if (charges <= 0) return false;
      if (game?.halted || actualPlayer?.controlsLocked) return false;

      charges--;
      syncGameCharges();

      active = true;
      phase = 'anticipation';
      anticipationTimer = 0;
      flightTimer = 0;
      flightStartY = actualPlayer.y;

      // Make web cables visible
      cableL.setVisible(true);
      cableR.setVisible(true);

      // Character leans backward like a tense catapult
      actualPlayer.root.rotation.x = -0.6;
      actualPlayer.setOverride?.('web', ANTICIPATION_TIME + 0.15);

      // Camera FOV contracts (60 -> 50) and tension rumble
      triggerCameraFov(actualCamera, ANTICIPATION_FOV, ANTICIPATION_TIME);
      triggerCameraShake(actualCameraRig, 0.18, ANTICIPATION_TIME);

      emit('slingshotAnticipation', { charges });
      emit('web', { from: actualPlayer.x, to: 0 });

      return true;
    },

    /**
     * Called before player physics update each frame.
     * Runs after obstacles move, before player updates.
     */
    beforePlayer(dt) {
      if (!active) return;

      // 1. ANTICIPATION: hold catapult tension pose & brace position
      if (phase === 'anticipation') {
        actualPlayer.root.rotation.x = -0.6;
        actualPlayer.vy = 0;
        actualObstacles?.grace(0.35);
        return;
      }

      // 2. FLIGHT: clear all obstacles and smoothly track parabolic trajectory
      if (phase === 'flight') {
        flightTimer += dt;
        actualObstacles?.grace(0.40);

        // Forward aerodynamic dive posture
        const diveAngle = actualPlayer.vy > 0 ? 0.35 : -0.15;
        actualPlayer.root.rotation.x = THREE.MathUtils.lerp(
          actualPlayer.root.rotation.x,
          diveAngle,
          Math.min(1.0, dt * 8.0)
        );

        // Check if descending towards floor/train roof or touched ground
        if (actualPlayer.grounded || actualPlayer.y <= actualPlayer.floorY + 0.08) {
          phase = 'landing';
        } else if (actualPlayer.vy < 0) {
          const distToFloor = actualPlayer.y - actualPlayer.floorY;
          if (distToFloor <= 0.85) {
            phase = 'landing';
          }
        }
        return;
      }

      // 3. LANDING: cushioned descent onto ground or roof
      if (phase === 'landing') {
        actualObstacles?.grace(0.65);
        // Soften falling speed for silk-smooth landing
        if (actualPlayer.vy < -5.5) {
          actualPlayer.vy = -5.5;
        }

        // When touching floor
        if (actualPlayer.grounded || actualPlayer.y <= actualPlayer.floorY + 0.08) {
          actualPlayer.y = actualPlayer.floorY;
          actualPlayer.vy = 0;
          actualPlayer.grounded = true;
          actualPlayer.gravityScale = 1.0;
          actualPlayer.root.rotation.x = 0;

          // Spawn ground mandala cushion
          landingCushion.trigger(new THREE.Vector3(actualPlayer.x, actualPlayer.floorY, 0));

          // Camera restored to standard FOV (60)
          triggerCameraFov(actualCamera, BASE_FOV, 0.45);
          triggerCameraShake(actualCameraRig, 0.22, 0.25);

          // Full obstacle grace period on touchdown (1.5s)
          actualObstacles?.grace(1.5);
          emit('land');

          // Smoothly reset slingshot speed boost
          if (this.baseSpeed != null && game?.state) {
            game.speedOverride = null;
            this.baseSpeed = null;
          }

          active = false;
          phase = 'idle';
        }
      }
    },

    /**
     * Updates visual effects and state transitions each frame.
     */
    update(time, dt) {
      // Ensure Camera FOV tweens progress continuously
      updateCameraFov(dt);

      // Update independent visual components
      windRings.update(dt);
      landingCushion.update(dt);
      speedLines.update(dt, actualPlayer, phase === 'flight');

      if (!active) return;

      // --- PHASE 1: ANTICIPATION (0.30s) ---
      if (phase === 'anticipation') {
        anticipationTimer += dt;
        const tensionProgress = Math.min(1.0, anticipationTimer / ANTICIPATION_TIME);

        // Maintain slingshot back-tilt
        actualPlayer.root.rotation.x = -0.6;

        // Fetch hand positions
        getHandPositions(actualPlayer, _handL, _handR);

        // Building anchor targets at x = -8 and x = +8
        const anchorY = actualPlayer.y + 4.2;
        const anchorZ = -10.0;
        _anchorL.set(-8.0, anchorY, anchorZ);
        _anchorR.set(8.0, anchorY, anchorZ);

        // High-frequency elastic tension jitter
        const jitter = Math.sin(anticipationTimer * 85.0) * (0.02 + tensionProgress * 0.04);
        _handL.y += jitter;
        _handR.y += jitter;

        // Update tensile cables
        cableL.update(_handL, _anchorL, tensionProgress, anticipationTimer);
        cableR.update(_handR, _anchorR, tensionProgress, anticipationTimer);

        // Check anticipation complete -> SLINGSHOT LAUNCH!
        if (anticipationTimer >= ANTICIPATION_TIME) {
          phase = 'flight';
          cableL.setVisible(false);
          cableR.setVisible(false);

          // 1. Record base speed and apply explosive forward slingshot boost!
          this.baseSpeed = game?.state ? game.state.speed : 18;
          if (game?.state) {
            game.speedOverride = Math.min(CONFIG.topSpeed + 18, this.baseSpeed + 18);
          }

          // 2. Camera FOV explosive surge (70) & punchy impulse shake
          triggerCameraFov(actualCamera, LAUNCH_FOV, 0.18);
          triggerCameraShake(actualCameraRig, 0.45, 0.40);

          // 3. Parabolic Web Jump physics launch
          actualPlayer.vy = LAUNCH_VY;
          actualPlayer.grounded = false;
          // Soften gravity (0.58) to produce an epic soaring arc over trains & hurdles
          actualPlayer.gravityScale = 0.58;
          actualPlayer.root.rotation.x = 0.35;
          actualPlayer.setOverride?.('jump', 2.0);

          // 4. Wind shockwave rings erupt from launch origin
          windRings.trigger(new THREE.Vector3(actualPlayer.x, actualPlayer.y + 0.8, -0.5));

          emit('jump');
          emit('slingshotLaunch', { vy: LAUNCH_VY, speedBoost: game?.speedOverride });
        }
      }
      // --- PHASE 2 & 3: FLIGHT / LANDING ---
      else if (phase === 'flight' || phase === 'landing') {
        // Fallback safety if airborne takes too long (> 3.5s)
        if (flightTimer > 3.5 && (actualPlayer.grounded || flightTimer > 4.5)) {
          this.deactivate();
        }
      }
    },

    /**
     * Safely absorbs any obstacle collision during slingshot anticipation, flight, or landing.
     * Shatters obstacle into 3D debris and preserves player flow.
     *
     * @param {Object} hit
     * @returns {boolean} true if absorbed, false otherwise
     */
    absorbHit(hit) {
      if (!active && phase === 'idle') return false;

      if (actualObstacles) {
        if (hit?.obstacle) {
          actualObstacles.remove(hit.obstacle);
        }

        // Clean out nearby forward obstacles in the landing corridor
        const list = actualObstacles.active;
        if (list) {
          for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            if (Math.abs(o.x - actualPlayer.x) <= 2.2 && o.z >= -8.0 && (o.z - o.length) <= 3.0) {
              actualObstacles.remove(o);
            }
          }
        }
        actualObstacles.grace(1.5);
      }

      const hitPos = hit?.position || new THREE.Vector3(actualPlayer.x, actualPlayer.y || 1.0, 0);
      shatterObstacle(actualScene, hitPos, 0xffffff);
      triggerCameraShake(actualCameraRig, 0.35, 0.30);
      emit('crash', { position: hitPos.clone() });

      return true;
    },

    /**
     * Refills charges to maximum.
     */
    refillCharges() {
      charges = maxCharges;
      syncGameCharges();
    },

    /**
     * Deactivates the skill and resets visual & player state immediately.
     */
    deactivate() {
      // Cleanly reset slingshot speed override
      if (this.baseSpeed != null && game?.state) {
        game.speedOverride = null;
        this.baseSpeed = null;
      }

      active = false;
      phase = 'idle';
      anticipationTimer = 0;
      flightTimer = 0;

      cableL.setVisible(false);
      cableR.setVisible(false);
      speedLines.group.visible = false;
      windRings.group.visible = false;
      landingCushion.group.visible = false;

      if (actualPlayer) {
        actualPlayer.gravityScale = 1.0;
        actualPlayer.root.rotation.x = 0;
        if (actualPlayer.override === 'web' || actualPlayer.override === 'jump') {
          actualPlayer.clearOverride?.();
        }
      }

      triggerCameraFov(actualCamera, BASE_FOV, 0.35);
      emit('specialOff');
    },

    /**
     * Full reset of the skill.
     */
    reset() {
      this.deactivate();
      charges = maxCharges;
      syncGameCharges();
    },

    /**
     * Comprehensive disposal of all 3D geometries, materials, and textures.
     */
    dispose() {
      this.deactivate();
      cableL.dispose();
      cableR.dispose();
      speedLines.dispose();
      windRings.dispose();
      landingCushion.dispose();

      if (actualScene && rootGroup.parent === actualScene) {
        actualScene.remove(rootGroup);
      }
    },
  };

  return skill;
}

export default createSpiderman2002Skill;
