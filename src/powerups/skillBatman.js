// skillBatman.js — Batman "Gece Pelerini Süzülüşü - 800 Metre" Special Skill
// Subway Surfers AAA-Grade Character Special Skill Module for Batman
//
// FEATURING:
// 1. Distance-Based Glide (800 Meters):
//    - Strictly distance-governed: (currentDistance - startDistance < 800)
//    - Smooth proportional progress depletion: progress = Math.max(0, 1 - (dist - startDist) / 800)
// 2. Aerodynamic Glide Position:
//    - Batman pitches forward horizontally into aerodynamic glide stance (rotation.x = 0.52)
//    - Catching thermals hover lift (beforePlayer floorY offset) eliminating ground jitter
//    - Stumble & trip immunity during the flight
// 3. 24x12 Multi-Segmented Bat-Wing Glider Mantle:
//    - 24 horizontal x 12 vertical segments (325 vertices) THREE.PlaneGeometry
//    - Scalloped trailing bat wing contour with swept aerodynamic tips
//    - Real-time sine-wave wind physics: pos.z = sin(x*5 + time*22)*0.12*yRatio + harmonic flutter
//    - Obsidian satin mantle with luminous aerodynamic wind sheath & yellow bat emblem
// 4. Wingtip Wind Trails (Rüzgar Çizgileri):
//    - High-velocity swirling wingtip vortex ribbons with THREE.AdditiveBlending and depthWrite: false
//    - Soft radial gradient glow falloff via createGlowTexture
// 5. 3D Little Black Bat Swarm Particles:
//    - Swarm of articulated 3D bats with scalloped wings flapping at 35Hz
//    - Glowing atmospheric wisps trailing behind into the night air
// 6. Collision Absorption (absorbHit):
//    - Sweeping night cloak flings obstacles away, shattering them into 3D debris & gold sparks
//    - Radial bat-vortex cloak shockwave, camera shake, dynamic flash light, 1.5s grace exit
// 7. Iconic Bat Silhouette SVG String (BAT_SVG_ICON):
//    - High-definition sharp bat emblem exported for UI HUD bar and badges

import * as THREE from 'three';
import { createGlowTexture, shatterObstacle, triggerFlashLight } from '../vfxCore.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { CONFIG } from '../config.js';

// ------------------------------------------------------------------ CONFIG & CONSTANTS
export const BATMAN_GLIDE_DISTANCE = 800; // 800 meters total glide
export const FLY_ALTITUDE = 3.6;          // High flight altitude in meters (clears 2.88m trains & 0.8m barriers)
export const TAKEOFF_DIST = 40;           // Smooth climb distance in meters
export const LANDING_DIST = 50;           // Smooth landing distance in meters
export const TAKEOFF_TIME = 0.8;          // Smooth climb fallback duration (seconds)
export const LANDING_TIME = 1.0;          // Smooth landing fallback duration (seconds)
const GLIDE_PITCH_ANGLE = 0.52;           // Forward aerodynamic glide pitch in radians (~30 deg)
const CAPE_SEGMENTS_X = 24;               // 24 columns
const CAPE_SEGMENTS_Y = 12;               // 12 rows
const CAPE_WINGSPAN = 2.8;                // 2.8 meters wingspan
const CAPE_LENGTH = 1.6;                  // 1.6 meters length

// Helper: smoothstep easing 0 -> 1
function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// ------------------------------------------------------------------ BAT SVG ICON (HUD / UI)
export const BAT_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100%" height="100%" fill="currentColor">
  <path d="M 50 16
    C 52 11, 54 6, 56 2
    C 57 8, 60 11, 65 13
    C 75 8, 86 11, 98 20
    C 92 28, 89 38, 92 50
    C 83 45, 73 47, 65 54
    C 60 46, 54 45, 50 51
    C 46 45, 40 46, 35 54
    C 27 47, 17 45, 8 50
    C 11 38, 8 28, 2 20
    C 14 11, 25 8, 35 13
    C 40 11, 43 8, 44 2
    C 46 6, 48 11, 50 16 Z" />
</svg>`;

// ------------------------------------------------------------------ 3D ARTICULATED BAT PARTICLE
function create3DBatMesh() {
  const batGroup = new THREE.Group();

  // Central sleek fuselage body
  const bodyGeo = new THREE.ConeGeometry(0.042, 0.22, 6);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x111116,
    roughness: 0.35,
    metalness: 0.5,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  batGroup.add(bodyMesh);

  // Bat pointed ears
  const earGeo = new THREE.ConeGeometry(0.016, 0.05, 4);
  const earMat = bodyMat;
  const leftEar = new THREE.Mesh(earGeo, earMat);
  leftEar.position.set(-0.022, 0.02, 0.08);
  leftEar.rotation.x = -0.2;
  leftEar.rotation.z = -0.3;
  batGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, earMat);
  rightEar.position.set(0.022, 0.02, 0.08);
  rightEar.rotation.x = -0.2;
  rightEar.rotation.z = 0.3;
  batGroup.add(rightEar);

  // Scalloped bat wings (left & right)
  const leftWingGroup = new THREE.Group();
  leftWingGroup.position.set(-0.035, 0.005, 0);

  const leftWingShape = new THREE.Shape();
  leftWingShape.moveTo(0, 0);
  leftWingShape.lineTo(-0.25, 0.07);
  leftWingShape.lineTo(-0.22, -0.05);
  leftWingShape.quadraticCurveTo(-0.16, -0.02, -0.13, -0.07);
  leftWingShape.quadraticCurveTo(-0.07, -0.02, 0, -0.04);
  leftWingShape.closePath();

  const wingGeo = new THREE.ShapeGeometry(leftWingShape);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x0c0d12,
    roughness: 0.45,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const leftWingMesh = new THREE.Mesh(wingGeo, wingMat);
  leftWingMesh.rotation.x = Math.PI / 2;
  leftWingGroup.add(leftWingMesh);
  batGroup.add(leftWingGroup);

  const rightWingGroup = new THREE.Group();
  rightWingGroup.position.set(0.035, 0.005, 0);

  const rightWingShape = new THREE.Shape();
  rightWingShape.moveTo(0, 0);
  rightWingShape.lineTo(0.25, 0.07);
  rightWingShape.lineTo(0.22, -0.05);
  rightWingShape.quadraticCurveTo(0.16, -0.02, 0.13, -0.07);
  rightWingShape.quadraticCurveTo(0.07, -0.02, 0, -0.04);
  rightWingShape.closePath();

  const rightWingGeo = new THREE.ShapeGeometry(rightWingShape);
  const rightWingMesh = new THREE.Mesh(rightWingGeo, wingMat);
  rightWingMesh.rotation.x = Math.PI / 2;
  rightWingGroup.add(rightWingMesh);
  batGroup.add(rightWingGroup);

  // Glowing shadow wisp trailing behind bat
  const glowGeo = new THREE.PlaneGeometry(0.24, 0.24);
  const glowTex = createGlowTexture('#334466', '#88ccff', 64);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.set(0, 0, -0.07);
  batGroup.add(glowMesh);

  return {
    root: batGroup,
    leftWing: leftWingGroup,
    rightWing: rightWingGroup,
    glowMesh,
    active: false,
    age: 0,
    maxAge: 1.0,
    vel: new THREE.Vector3(),
    rotVel: new THREE.Vector3(),
    flapOffset: Math.random() * Math.PI * 2,
  };
}

// ------------------------------------------------------------------ WINGTIP WIND TRAILS
function createWindTrails() {
  const group = new THREE.Group();
  group.name = 'batmanWindTrails';

  const trailCount = 14;
  const trails = [];
  const trailGeo = new THREE.PlaneGeometry(0.07, 1.9, 1, 4);
  trailGeo.rotateX(Math.PI / 2); // Stretch along Z axis

  const trailTex = createGlowTexture('#66aacc', '#ffffff', 128);
  const trailMat = new THREE.MeshBasicMaterial({
    map: trailTex,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < trailCount; i++) {
    const mesh = new THREE.Mesh(trailGeo, trailMat.clone());
    group.add(mesh);
    const isLeft = i % 2 === 0;
    trails.push({
      mesh,
      isLeft,
      offsetZ: (i / trailCount) * 2.6,
      speed: 13.0 + (i % 5) * 2.2,
      baseX: isLeft ? -1.35 : 1.35,
      baseY: -0.36 + ((i % 3) - 1) * 0.08,
      vortexRadius: 0.09 + (i % 4) * 0.025,
      vortexSpeed: 24.0 + (i % 3) * 6.0,
      phase: (i / trailCount) * Math.PI * 2,
    });
  }

  return { group, trails };
}

// ------------------------------------------------------------------ BATMAN SPECIAL SKILL CLASS
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

    // Flight altitude offset (clears 2.88m trains & 0.8m barriers; read by main.js for shadow)
    this.FLY_ALTITUDE = FLY_ALTITUDE;
    this.TAKEOFF_DIST = TAKEOFF_DIST;
    this.LANDING_DIST = LANDING_DIST;
    this.TAKEOFF_TIME = TAKEOFF_TIME;
    this.LANDING_TIME = LANDING_TIME;
    this.currentFlyOffset = 0;
    this.elapsed = 0;
    this.timeAlive = 0;

    // Distance tracking (800 meters total)
    this.maxDistance = BATMAN_GLIDE_DISTANCE;
    this.startDistance = 0;
    this.distanceTraveled = 0;
    this.distanceRemaining = this.maxDistance;
    this.progress = 1.0;

    // UI compatibility properties
    this.maxTime = this.maxDistance;
    this.timeRemaining = this.maxDistance;
    this._elapsedTime = 0;
    this._origCapes = [];

    // Cape Group (anchored to player.root at upper spine/shoulders)
    this.capeGroup = new THREE.Group();
    this.capeGroup.name = 'batmanGliderCape';
    this.capeGroup.position.set(0, 0.96, -0.08);
    this.capeGroup.visible = false;

    // 1. Multi-segmented 24x12 Bat-Wing Glider Mantle
    this._buildCapeGeometry();

    // 2. Wingtip Wind Trails
    this.windTrails = createWindTrails();
    this.capeGroup.add(this.windTrails.group);

    // 3. 3D Little Black Bat Swarm
    this.batPoolSize = 24;
    this.batPool = [];
    this.batGroup = new THREE.Group();
    this.batGroup.name = 'batmanBatSwarm';
    this.capeGroup.add(this.batGroup);

    for (let i = 0; i < this.batPoolSize; i++) {
      const bat = create3DBatMesh();
      bat.root.visible = false;
      this.batGroup.add(bat.root);
      this.batPool.push(bat);
    }

    // Attach cape group to player root
    if (this.player && this.player.root) {
      this.player.root.add(this.capeGroup);
    }

    // Transient shockwaves for collision absorb
    this.transientFX = [];

    // Unified collision hooks integration
    if (this.obstacles && this.obstacles.hooks) {
      const prevFront = this.obstacles.hooks.onFrontHit;
      this.obstacles.hooks.onFrontHit = (hit) => {
        if (this.active && this.absorbHit(hit)) return true;
        return prevFront ? prevFront(hit) : false;
      };

      const prevSide = this.obstacles.hooks.onSideHit;
      this.obstacles.hooks.onSideHit = (hit) => {
        if (this.active && this.absorbHit(hit)) return true;
        return prevSide ? prevSide(hit) : false;
      };
    }

    if (this.chaser && this.chaser.hooks) {
      const prevCatch = this.chaser.hooks.absorbCatch;
      this.chaser.hooks.absorbCatch = () => {
        if (this.active && this.absorbHit()) return true;
        return prevCatch ? prevCatch() : false;
      };
    }
  }

  // ------------------------------------------------------------------ 24x12 CAPE BUILDER
  _buildCapeGeometry() {
    // 24 width segments (25 cols), 12 height segments (13 rows) -> 325 vertices
    const cols = CAPE_SEGMENTS_X;
    const rows = CAPE_SEGMENTS_Y;
    const totalVerts = (cols + 1) * (rows + 1);

    const geo = new THREE.PlaneGeometry(CAPE_WINGSPAN, CAPE_LENGTH, cols, rows);
    this.capeGeo = geo;

    // Sculpt base vertex positions into authentic bat wing glider silhouette
    const baseArr = new Float32Array(totalVerts * 3);
    const pos = geo.attributes.position;

    for (let i = 0; i < totalVerts; i++) {
      const iy = Math.floor(i / (cols + 1)); // 0 (top shoulders) to 12 (bottom hem)
      const ix = i % (cols + 1);            // 0 (left tip) to 24 (right tip)

      const u = (ix / cols) * 2 - 1;        // -1.0 to 1.0 (horizontal span)
      const v = iy / rows;                  // 0.0 (top) to 1.0 (bottom)
      const absU = Math.abs(u);

      // Flaring bat wingspan profile
      const spanFactor = (v < 0.35)
        ? (0.35 + 0.65 * (v / 0.35))
        : (1.0 - 0.14 * Math.pow((v - 0.35) / 0.65, 2));
      const bx = u * (CAPE_WINGSPAN * 0.5) * Math.max(0.32, spanFactor);

      // Scalloped trailing edge with 3 distinct curved bat arches per wing
      const arch = Math.sin(absU * Math.PI * 3.0);
      const scallopCut = (v > 0.55) ? ((v - 0.55) / 0.45) * (0.16 * (1.0 - Math.abs(arch))) : 0;
      const wingtipLift = (v > 0.4) ? Math.pow(absU, 2.5) * 0.16 : 0;
      const by = -v * CAPE_LENGTH + scallopCut + wingtipLift;

      // Aerodynamic camber profile (airfoil arch in Z)
      const camber = Math.sin(v * Math.PI * 0.75) * 0.15 - Math.pow(absU, 1.8) * 0.12;
      const bz = camber - 0.03;

      const i3 = i * 3;
      baseArr[i3] = bx;
      baseArr[i3 + 1] = by;
      baseArr[i3 + 2] = bz;

      pos.setXYZ(i, bx, by, bz);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    this.capeBasePositions = baseArr;

    // Solid obsidian mantle material
    const mantleMat = new THREE.MeshStandardMaterial({
      color: 0x0a0b10,
      roughness: 0.35,
      metalness: 0.4,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    this.capeMesh = new THREE.Mesh(geo, mantleMat);
    this.capeGroup.add(this.capeMesh);

    // Luminous aerodynamic wind sheath overlay (AdditiveBlending)
    const sheathGeo = geo.clone();
    const sheathTex = createGlowTexture('#2b4c7e', '#88ccee', 128);
    const sheathMat = new THREE.MeshBasicMaterial({
      map: sheathTex,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.sheathMesh = new THREE.Mesh(sheathGeo, sheathMat);
    this.sheathMesh.position.z = 0.015;
    this.capeGroup.add(this.sheathMesh);

    // Glowing yellow bat emblem centered on back
    const emblemGeo = new THREE.PlaneGeometry(0.55, 0.32);
    const emblemTex = createGlowTexture('#f4c922', '#ffffff', 128);
    const emblemMat = new THREE.MeshBasicMaterial({
      map: emblemTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.emblemMesh = new THREE.Mesh(emblemGeo, emblemMat);
    this.emblemMesh.position.set(0, -0.32, 0.05);
    this.capeGroup.add(this.emblemMesh);
  }

  // ------------------------------------------------------------------ HERO CONFIG FOR UI
  getHeroConfig(skin = 'batman') {
    return {
      name: 'batman',
      duration: this.maxDistance,
      distance: this.maxDistance,
      label: this.label,
      icon: this.batSvgIcon,
      className: 'batman',
    };
  }

  // ------------------------------------------------------------------ ACTIVATE (DISTANCE-BASED)
  activate(startDistance) {
    if (this.active || game.halted || (this.player && this.player.controlsLocked)) return false;

    // Capture starting distance strictly
    const dist = (typeof startDistance === 'number' && Number.isFinite(startDistance))
      ? startDistance
      : (game.state?.distance || game.distance || 0);

    this.startDistance = dist;
    this.distanceTraveled = 0;
    this.distanceRemaining = this.maxDistance;
    this.progress = 1.0;
    this.active = true;
    this.timeRemaining = this.maxDistance;
    this.maxTime = this.maxDistance;
    this.elapsed = 0;
    this.timeAlive = 0;
    this.currentFlyOffset = 0;

    // Reveal custom 24x12 cape
    this.capeGroup.visible = true;

    // Hide default walking cape on Batman character to avoid overlap
    this._hideDefaultCape();

    // Gliding stance: clear trip/stumble, camera shake burst, grace period
    if (this.player && typeof this.player.clearOverride === 'function') this.player.clearOverride();
    if (this.obstacles && typeof this.obstacles.grace === 'function') this.obstacles.grace(0.4);
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') this.chaser._dropBack();
    if (this.cameraRig && typeof this.cameraRig.shake === 'function') this.cameraRig.shake(0.22, 0.35);

    emit('batmanGlideStart', { distance: this.startDistance, maxDistance: this.maxDistance });
    emit('specialOn', { mode: 'batman', duration: this.maxDistance, distance: this.maxDistance });
    return true;
  }

  // ------------------------------------------------------------------ BEFORE PLAYER (FLIGHT AERODYNAMICS)
  beforePlayer(dt) {
    if (!this.active && this.currentFlyOffset <= 0.001) return;

    if (this.active && !game.halted) {
      this.timeAlive += dt;
      this.elapsed += dt;

      // Current distance progression
      const gameDist = (game.state && typeof game.state.distance === 'number')
        ? game.state.distance
        : (game.distance || 0);
      const distTraveled = Math.max(this.distanceTraveled, Math.max(0, gameDist - this.startDistance));
      const distRemaining = Math.max(0, this.maxDistance - distTraveled);

      // Smooth takeoff: 0 -> 1 over TAKEOFF_DIST (or TAKEOFF_TIME)
      let takeoffRatio = 1.0;
      if (distTraveled < this.TAKEOFF_DIST) {
        takeoffRatio = smoothstep(distTraveled / this.TAKEOFF_DIST);
      }
      if (this.elapsed < this.TAKEOFF_TIME) {
        takeoffRatio = Math.max(takeoffRatio, smoothstep(this.elapsed / this.TAKEOFF_TIME));
      }

      // Smooth landing: 1 -> 0 over the last LANDING_DIST
      let landingRatio = 1.0;
      if (distRemaining < this.LANDING_DIST) {
        landingRatio = smoothstep(distRemaining / this.LANDING_DIST);
      }

      const liftRatio = Math.max(0, Math.min(1, Math.min(takeoffRatio, landingRatio)));

      // Aerodynamic cruise bobbing
      const bob = Math.sin(this.timeAlive * 3.0) * 0.1;
      this.currentFlyOffset = (this.FLY_ALTITUDE + bob) * liftRatio;
    } else {
      // Smooth descent back to ground level if deactivated prematurely or finished
      this.currentFlyOffset = Math.max(0, this.currentFlyOffset - dt * 3.5);
    }

    if (this.player && this.currentFlyOffset > 0.001) {
      this.player.floorY += this.currentFlyOffset;
      if (this.player.grounded || this.player.y < this.player.floorY) {
        this.player.y = this.player.floorY;
        this.player.vy = 0;
        this.player.grounded = true;
      }
    }

    // Stumble & trip immunity during the flight
    if (this.player && (this.active || this.currentFlyOffset > 0.5)) {
      if (this.player.overrideState === 'stumble' || this.player.override === 'stumble') {
        this.player.clearOverride();
      }
    }
  }

  // ------------------------------------------------------------------ UPDATE
  update(timeOrDt, dtOrDist, currentDistance) {
    // Accommodate update(time, dt, currentDistance) or update(dt)
    let time, dt, dist;
    if (arguments.length === 1) {
      dt = timeOrDt;
      this.timeAlive = (this.timeAlive || 0) + dt;
      time = this.timeAlive;
      dist = game.state?.distance || game.distance || (this.startDistance + this.distanceTraveled);
    } else if (arguments.length === 2) {
      if (typeof dtOrDist === 'number' && dtOrDist > 5.0) {
        dt = timeOrDt;
        dist = dtOrDist;
        this.timeAlive = (this.timeAlive || 0) + dt;
        time = this.timeAlive;
      } else {
        time = timeOrDt;
        dt = dtOrDist;
        this.timeAlive = time;
        dist = game.state?.distance || game.distance || (this.startDistance + this.distanceTraveled);
      }
    } else {
      time = timeOrDt;
      dt = dtOrDist;
      this.timeAlive = time;
      dist = (typeof currentDistance === 'number' && Number.isFinite(currentDistance))
        ? currentDistance
        : (game.state?.distance || game.distance || (this.startDistance + this.distanceTraveled));
    }

    // Update transient cloak-sweep shockwave debris & light bursts
    this._updateTransientFX(dt);

    if (!this.active || game.halted) return;

    // Distance progression calculation: strictly (currentDistance - startDistance < 800)
    this.distanceTraveled = Math.max(0, dist - this.startDistance);
    this.distanceRemaining = Math.max(0, this.maxDistance - this.distanceTraveled);
    this.progress = Math.max(0, Math.min(1, 1 - (this.distanceTraveled / this.maxDistance)));

    // Mirror to timeRemaining for HUD/UI bar bindings
    this.timeRemaining = this.distanceRemaining;

    // Check distance expiry
    if (this.distanceTraveled >= this.maxDistance) {
      this.deactivate(true);
      return;
    }

    // 1. Horizontal aerodynamic glide position pitch (rotation.x = 0.52)
    // Pitch blends smoothly in during takeoff, remains at 0.52 during cruise, blends back on landing
    if (this.player && this.player.root) {
      let pitchBlend = 1.0;
      if (this.distanceTraveled < this.TAKEOFF_DIST) {
        pitchBlend = smoothstep(this.distanceTraveled / this.TAKEOFF_DIST);
      } else if (this.distanceRemaining < this.LANDING_DIST) {
        pitchBlend = smoothstep(this.distanceRemaining / this.LANDING_DIST);
      }
      const targetPitch = GLIDE_PITCH_ANGLE * pitchBlend;
      this.player.root.rotation.x = THREE.MathUtils.lerp(
        this.player.root.rotation.x,
        targetPitch,
        Math.min(1, dt * 11)
      );
    }

    // 2. Real-time sine-wave wind physics on 24x12 cape vertices:
    // pos.z = sin(x*5 + time*22)*0.12*yRatio + aerodynamic harmonics
    this._updateCapePhysics(time);

    // 3. Update wingtip wind trails
    this._updateWindTrails(time, dt);

    // 4. Update 3D little black bat silhouette swarm
    this._updateBatSwarm(time, dt);
  }

  // ------------------------------------------------------------------ REAL-TIME CAPE SINE WAVE PHYSICS
  _updateCapePhysics(time) {
    const pos = this.capeGeo.attributes.position;
    const arr = pos.array;
    const base = this.capeBasePositions;
    const count = pos.count;
    const cols = CAPE_SEGMENTS_X;
    const rows = CAPE_SEGMENTS_Y;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const bx = base[i3];
      const by = base[i3 + 1];
      const bz = base[i3 + 2];

      const iy = Math.floor(i / (cols + 1));
      const ix = i % (cols + 1);
      const u = (ix / cols) * 2 - 1;
      const absU = Math.abs(u);
      const yRatio = iy / rows; // 0 at shoulders, 1 at trailing hem

      // Primary sine wave physics: pos.z = sin(x*5 + time*22)*0.12*yRatio
      const wave1 = Math.sin(bx * 5.0 + time * 22.0) * 0.12 * yRatio;

      // High-frequency turbulent flutter harmonics
      const wave2 = Math.sin(bx * 11.0 - time * 32.0) * 0.038 * yRatio;

      // Chordwise aerodynamic wave
      const waveChord = Math.cos(by * 7.0 + time * 18.0) * 0.045 * yRatio;

      // Wingtip turbulence and flap lift
      const tipFlap = Math.cos(time * 26.0 + absU * 4.0) * 0.055 * yRatio * absU;

      arr[i3] = bx + Math.sin(time * 12.0 + by * 3.5) * 0.02 * yRatio;
      arr[i3 + 1] = by + Math.cos(time * 14.0 + bx * 4.5) * 0.02 * yRatio;
      arr[i3 + 2] = bz + wave1 + wave2 + waveChord + tipFlap;
    }

    pos.needsUpdate = true;
    this.capeGeo.computeVertexNormals();

    // Mirror to sheath mesh
    const sheathPos = this.sheathMesh.geometry.attributes.position;
    sheathPos.copy(pos);
    sheathPos.needsUpdate = true;

    // Pulsing sheath & emblem intensity
    this.sheathMesh.material.opacity = 0.28 + Math.sin(time * 16.0) * 0.12;
    this.emblemMesh.material.opacity = 0.75 + Math.sin(time * 20.0) * 0.2;
  }

  // ------------------------------------------------------------------ WINGTIP WIND TRAILS UPDATE
  _updateWindTrails(time, dt) {
    const trails = this.windTrails.trails;
    for (let i = 0; i < trails.length; i++) {
      const tr = trails[i];
      tr.offsetZ += dt * tr.speed;
      if (tr.offsetZ > 2.8) {
        tr.offsetZ = -0.2;
      }

      const swirlAngle = time * tr.vortexSpeed + tr.phase + tr.offsetZ * 3.8;
      const r = tr.vortexRadius * (1.0 + tr.offsetZ * 0.85);

      tr.mesh.position.set(
        tr.baseX + Math.cos(swirlAngle) * r,
        tr.baseY + Math.sin(swirlAngle) * r,
        -tr.offsetZ
      );

      const alpha = Math.max(0, 1.0 - (tr.offsetZ / 2.8));
      tr.mesh.material.opacity = alpha * 0.85;
      tr.mesh.scale.set(1.0 + tr.offsetZ * 0.4, 1.0, 1.0 + tr.offsetZ * 0.6);
    }
  }

  // ------------------------------------------------------------------ 3D BAT SWARM UPDATE
  _updateBatSwarm(time, dt) {
    // Periodic spawn of little 3D bats from wingtips and cape hem
    if (Math.random() < 0.65) {
      const bat = this.batPool.find((b) => !b.active);
      if (bat) {
        bat.active = true;
        bat.age = 0;
        bat.maxAge = 0.75 + Math.random() * 0.45;
        bat.root.visible = true;

        const isLeft = Math.random() < 0.5;
        const spawnX = (isLeft ? -1 : 1) * (1.15 + Math.random() * 0.35);
        const spawnY = -0.3 + (Math.random() - 0.5) * 0.25;
        const spawnZ = -0.15;

        bat.root.position.set(spawnX, spawnY, spawnZ);
        bat.vel.set(
          (Math.random() - 0.5) * 5.0 + (isLeft ? -1.5 : 1.5),
          (Math.random() - 0.5) * 3.2,
          -(16.0 + Math.random() * 12.0)
        );
        bat.rotVel.set(
          (Math.random() - 0.5) * 4.0,
          (Math.random() - 0.5) * 6.0,
          (Math.random() - 0.5) * 4.0
        );
      }
    }

    // Animate active bats
    for (let i = 0; i < this.batPool.length; i++) {
      const bat = this.batPool[i];
      if (!bat.active) continue;

      bat.age += dt;
      if (bat.age >= bat.maxAge) {
        bat.active = false;
        bat.root.visible = false;
        continue;
      }

      // High-frequency wing flapping (35 Hz)
      const flapAngle = Math.sin(time * 36.0 + bat.flapOffset) * 0.68;
      bat.leftWing.rotation.y = flapAngle;
      bat.rightWing.rotation.y = -flapAngle;
      bat.leftWing.rotation.z = flapAngle * 0.4;
      bat.rightWing.rotation.z = -flapAngle * 0.4;

      // Flight trajectory
      bat.root.position.x += bat.vel.x * dt;
      bat.root.position.y += bat.vel.y * dt;
      bat.root.position.z += bat.vel.z * dt;

      bat.root.rotation.x += bat.rotVel.x * dt;
      bat.root.rotation.y += bat.rotVel.y * dt;
      bat.root.rotation.z += bat.rotVel.z * dt;

      // Scale down and fade as bat disperses into darkness
      const k = bat.age / bat.maxAge;
      const scale = Math.max(0.01, 1.0 - k * 0.7);
      bat.root.scale.setScalar(scale);
      bat.glowMesh.material.opacity = Math.max(0, 0.7 * (1.0 - k));
    }
  }

  // ------------------------------------------------------------------ COLLISION ABSORPTION (absorbHit)
  absorbHit(hit) {
    if (!this.active) return false;

    // Obstacle hit location
    const hitPos = (hit && hit.position)
      ? hit.position.clone()
      : new THREE.Vector3(this.player.x, 1.0, 0);

    // 1. Shatter obstacle with high-force 3D debris & glowing golden bat sparks
    shatterObstacle(this.scene, hitPos, {
      color: 0x16161f,
      emissive: 0x242436,
      sparkColor: '#f4c922',
      blastForce: 16.5,
    });

    // 2. Remove the collided obstacle safely
    if (hit?.obstacle && this.obstacles) {
      this.obstacles.remove(hit.obstacle);
    }

    // 3. Clear clearing corridor ahead to ensure completely safe exit
    if (this.obstacles && this.obstacles.active) {
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - this.player.x) <= 2.2 && o.z > -7.0 && (o.z - o.length) < 2.5) {
          this.obstacles.remove(o);
        }
      }
    }

    // 4. Dynamic Dark Knight Cloak Sweep Shockwave Disc (AdditiveBlending)
    this._spawnCloakShockwave(hitPos);

    // 5. Radial bat swarm blast (burst of 10 bats shooting outward)
    this._spawnRadialBatBurst(hitPos);

    // 6. Camera shake & dynamic flash light
    if (this.cameraRig) this.cameraRig.shake(0.42, 0.48);
    triggerFlashLight(this.scene, hitPos, 0xf4c922, 6.0, 0.4);

    // 7. Emit events
    emit('batmanCloakSweep', { position: hitPos.clone() });
    emit('crash', { position: hitPos.clone() });

    // 8. Grant safety grace period and exit glide safely
    if (this.obstacles) this.obstacles.grace(1.5);
    this.deactivate(false);

    return true;
  }

  // ------------------------------------------------------------------ TRANSIENT CLOAK SHOCKWAVE
  _spawnCloakShockwave(pos) {
    if (!this.scene) return;

    const g = new THREE.Group();
    const groundY = (this.player && this.player.floorY != null ? this.player.floorY : 0) + 0.04;
    g.position.set(pos.x, groundY, pos.z);

    const size = 4.2;
    const planeGeo = new THREE.PlaneGeometry(size, size);
    planeGeo.rotateX(-Math.PI / 2);
    const planeTex = createGlowTexture('#f4c922', '#ffffff', 128);
    const planeMat = new THREE.MeshBasicMaterial({
      map: planeTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.95,
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    g.add(planeMesh);

    this.scene.add(g);
    this.transientFX.push({
      root: g,
      planeMat,
      planeGeo,
      age: 0,
      duration: 0.45,
      maxScale: 2.8,
    });
  }

  // ------------------------------------------------------------------ RADIAL BAT BURST ON ABSORB
  _spawnRadialBatBurst(pos) {
    for (let i = 0; i < 10; i++) {
      const bat = this.batPool.find((b) => !b.active);
      if (!bat) break;

      bat.active = true;
      bat.age = 0;
      bat.maxAge = 0.6 + Math.random() * 0.35;
      bat.root.visible = true;

      const angle = (i / 10) * Math.PI * 2;
      const speed = 14.0 + Math.random() * 8.0;

      bat.root.position.set(0, 0, 0);
      bat.vel.set(
        Math.cos(angle) * speed,
        Math.random() * 6.0 + 2.0,
        Math.sin(angle) * speed - 10.0
      );
      bat.rotVel.set(
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0
      );
    }
  }

  // ------------------------------------------------------------------ UPDATE TRANSIENT FX
  _updateTransientFX(dt) {
    if (!this.transientFX || this.transientFX.length === 0) return;

    for (let i = this.transientFX.length - 1; i >= 0; i--) {
      const fx = this.transientFX[i];
      fx.age += dt;

      if (game.state?.mode === 'running' && !game.halted) {
        fx.root.position.z += (game.state?.speed || 15) * dt;
      }

      const k = fx.age / fx.duration;
      if (k >= 1.0) {
        if (this.scene) this.scene.remove(fx.root);
        fx.planeGeo.dispose();
        fx.planeMat.dispose();
        this.transientFX.splice(i, 1);
      } else {
        const s = 0.3 + (fx.maxScale - 0.3) * Math.sin(k * Math.PI * 0.5);
        fx.root.scale.set(s, s, s);
        fx.planeMat.opacity = Math.max(0, 0.95 * (1.0 - k));
      }
    }
  }

  // ------------------------------------------------------------------ DEACTIVATE
  deactivate(expired = false) {
    if (!this.active) return;
    this.active = false;
    this.distanceRemaining = 0;
    this.progress = 0;
    this.timeRemaining = 0;

    // Hide custom cape
    if (this.capeGroup) this.capeGroup.visible = false;

    // Restore default character cape
    this._restoreDefaultCape();

    // Smoothly restore player rotation back to upright
    if (this.player && this.player.root) {
      this.player.root.rotation.x = 0;
    }

    // Safety grace period on soft landing (1.5s protection duration)
    if (this.obstacles && typeof this.obstacles.grace === 'function') {
      this.obstacles.grace(1.5);
    }

    emit('batmanGlideEnd', { expired });
    emit('specialOff', { mode: 'batman', expired });
  }

  // ------------------------------------------------------------------ GET REMAINING DISTANCE & PROGRESS
  getRemainingDistance(currentDistance) {
    if (!this.active) return 0;
    const dist = (typeof currentDistance === 'number' && Number.isFinite(currentDistance))
      ? currentDistance
      : (game.state?.distance || game.distance || (this.startDistance + this.distanceTraveled));
    return Math.max(0, this.maxDistance - (dist - this.startDistance));
  }

  getProgress(currentDistance) {
    if (!this.active) return 0;
    return Math.max(0, Math.min(1, this.getRemainingDistance(currentDistance) / this.maxDistance));
  }

  // ------------------------------------------------------------------ HIDE / RESTORE DEFAULT CAPE
  _hideDefaultCape() {
    this._origCapes = [];
    if (!this.player || !this.player.root) return;
    this.player.root.traverse((obj) => {
      if (obj.isMesh && obj !== this.capeMesh && obj !== this.sheathMesh && obj !== this.emblemMesh) {
        if (obj.geometry && obj.geometry.parameters &&
            obj.geometry.parameters.widthSegments === 4 &&
            obj.geometry.parameters.heightSegments === 8) {
          obj.visible = false;
          this._origCapes.push(obj);
        }
      }
    });
  }

  _restoreDefaultCape() {
    if (this._origCapes && this._origCapes.length > 0) {
      this._origCapes.forEach((c) => {
        c.visible = true;
      });
      this._origCapes = [];
    }
  }

  // ------------------------------------------------------------------ DISPOSE
  dispose() {
    this.deactivate(false);

    if (this.capeGroup && this.player && this.player.root) {
      this.player.root.remove(this.capeGroup);
    }

    if (this.capeGroup) {
      this.capeGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    if (this.transientFX) {
      this.transientFX.forEach((fx) => {
        if (this.scene) this.scene.remove(fx.root);
        if (fx.planeGeo) fx.planeGeo.dispose();
        if (fx.planeMat) fx.planeMat.dispose();
      });
      this.transientFX = [];
    }
  }
}

// ------------------------------------------------------------------ FACTORY FUNCTION & EXPORTS
export function createBatmanSkill(params = {}) {
  return new BatmanSkill(params);
}

export default createBatmanSkill;
