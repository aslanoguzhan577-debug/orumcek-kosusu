// skillIronMan.js — Iron Man Arc Reactor Unibeam Special Skill
// AAA Visual Effects, Multi-Layer Energy Beam, 3D Obstacle Shattering, and Dynamic Camera Shake.

import * as THREE from 'three';
import { emit } from '../events.js';
import {
  createGlowTexture,
  shatterObstacle,
  triggerCameraShake,
  triggerFlashLight,
  create3LayerUnibeam,
} from '../vfxCore.js';

// ------------------------------------------------------------------ UI SVG ICON
export const UNIBEAM_SVG_ICON = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="arcGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="40%" stop-color="#00e5ff" stop-opacity="0.95" />
      <stop offset="80%" stop-color="#0077ff" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#002244" stop-opacity="0" />
    </radialGradient>
    <filter id="arcFilter" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.2" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <!-- Outer Reactor Casing Rings -->
  <circle cx="32" cy="32" r="30" stroke="#00e5ff" stroke-width="2.5" opacity="0.45" />
  <circle cx="32" cy="32" r="26" stroke="#00e5ff" stroke-width="1.8" stroke-dasharray="6 3" />
  <circle cx="32" cy="32" r="22" stroke="#ffffff" stroke-width="1.2" opacity="0.85" />

  <!-- 8 Segmented Induction Magnetic Coils -->
  <g stroke="#00e5ff" stroke-width="2.4" stroke-linecap="round">
    <line x1="32" y1="6" x2="32" y2="12" />
    <line x1="32" y1="52" x2="32" y2="58" />
    <line x1="6" y1="32" x2="12" y2="32" />
    <line x1="52" y1="32" x2="58" y2="32" />
    <line x1="13.6" y1="13.6" x2="17.8" y2="17.8" />
    <line x1="46.2" y1="46.2" x2="50.4" y2="50.4" />
    <line x1="50.4" y1="13.6" x2="46.2" y2="17.8" />
    <line x1="17.8" y1="46.2" x2="13.6" y2="50.4" />
  </g>

  <!-- Triangular Geometric Core Reticle -->
  <polygon points="32,16 45.8,40 18.2,40" stroke="#00e5ff" stroke-width="2" fill="none" opacity="0.9" />
  <polygon points="32,48 45.8,24 18.2,24" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.65" />

  <!-- Central Arc Core Glow & Energy Plasma Lens -->
  <circle cx="32" cy="32" r="14" fill="url(#arcGlow)" filter="url(#arcFilter)" />
  <circle cx="32" cy="32" r="7.5" fill="#ffffff" />
  <circle cx="32" cy="32" r="4.2" fill="#dcf8ff" />
</svg>`;

const _v3 = new THREE.Vector3();

// ------------------------------------------------------------------ IRON MAN SPECIAL SKILL CLASS
export class IronManSkill {
  constructor({ scene, player, obstacles, cameraRig }) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;

    this.active = false;
    this.charges = 1;
    this.maxCharges = 1;
    this.duration = 2.2;
    this.timeRemaining = 0;
    this.unibeamSvgIcon = UNIBEAM_SVG_ICON;

    // Build 3-layer Unibeam system (length 200m, radius 0.55m, plasma 0x00e5ff)
    // Layer 1: Core Cylinder (#ffffff)
    // Layer 2: Pulsing Plasma Cylinder (#00e5ff)
    // Layer 3: 12 Torus Shock Rings + Chest PointLight
    this.beam = create3LayerUnibeam(200, 0.55, 0x00e5ff);
    this.beam.root.visible = false;
    if (this.scene) {
      this.scene.add(this.beam.root);
    }

    // Arc Reactor Chest Flare & Swirling Energy Vortex VFX
    this._createChestVFX();

    // Hook collision systems for auto-absorption while active
    if (this.obstacles && this.obstacles.hooks) {
      const prevFrontHit = this.obstacles.hooks.onFrontHit;
      this.obstacles.hooks.onFrontHit = (hit) => {
        if (this.absorbHit(hit)) return true;
        if (typeof prevFrontHit === 'function') return prevFrontHit(hit);
        return false;
      };
    }
  }

  // Calculate current chest Arc Reactor position in world space
  getChestPosition() {
    if (!this.player) return _v3.set(0, 0.9, 0);
    const chestY = this.player.sliding ? (this.player.y + 0.45) : (this.player.y + 0.88);
    return _v3.set(this.player.x, chestY, -0.15);
  }

  // Create Arc Reactor chest emitter disc, counter-rotating energy rings, and swirling charge sparks
  _createChestVFX() {
    const group = new THREE.Group();
    group.name = 'arcReactorChestVFX';

    // 1. Arc Reactor Central Glow Sprite
    const glowTex = createGlowTexture('#00e5ff', '#ffffff', 128);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    group.add(glowMesh);

    // 2. Dual Concentric Tech Energy Rings at Chest
    const ringGeo1 = new THREE.RingGeometry(0.12, 0.38, 32);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    group.add(ring1);

    const ringGeo2 = new THREE.RingGeometry(0.42, 0.52, 32);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    group.add(ring2);

    // 3. 14 Swirling Core Charge Sparks
    const sparkGeo = new THREE.PlaneGeometry(0.16, 0.16);
    const sparkTex = createGlowTexture('#38bdf8', '#ffffff', 64);
    const sparkMat = new THREE.MeshBasicMaterial({
      map: sparkTex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const sparks = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(sparkGeo, sparkMat.clone());
      group.add(s);
      sparks.push({
        mesh: s,
        angle: (i / 14) * Math.PI * 2,
        baseRadius: 0.32 + (i % 3) * 0.14,
        speed: 8.5 + (i % 4) * 2.5,
        zOffset: -0.05 * (i % 4),
      });
    }

    this.chestGroup = group;
    this.chestGlowMesh = glowMesh;
    this.chestRing1 = ring1;
    this.chestRing2 = ring2;
    this.chestSparks = sparks;

    if (this.scene) {
      this.scene.add(group);
    }
    group.visible = false;
  }

  // Update dynamic chest animations and swirling vortex particles
  _updateChestVFX(time, dt, chestPos) {
    if (!this.chestGroup) return;
    this.chestGroup.visible = true;
    this.chestGroup.position.copy(chestPos);

    // Pulse glow
    const pulse = 1.0 + Math.sin(time * 36) * 0.22;
    this.chestGlowMesh.scale.set(pulse, pulse, 1.0);
    this.chestGlowMesh.rotation.z = time * 2.2;

    this.chestRing1.rotation.z = -time * 4.2;
    this.chestRing2.rotation.z = time * 3.6;

    for (let i = 0; i < this.chestSparks.length; i++) {
      const sp = this.chestSparks[i];
      sp.angle += sp.speed * dt;
      const r = sp.baseRadius * (0.8 + Math.sin(time * 22 + i) * 0.25);
      sp.mesh.position.set(
        Math.cos(sp.angle) * r,
        Math.sin(sp.angle) * r,
        sp.zOffset + Math.sin(time * 30 + i) * 0.05
      );
      sp.mesh.scale.setScalar(0.75 + Math.sin(time * 24 + i) * 0.3);
    }
  }

  // Annihilate obstacles in player's lane up to 200m ahead into 3D debris and orange-blue sparks
  _destroyObstaclesInRange() {
    if (!this.obstacles || !this.obstacles.active) return;
    const list = this.obstacles.active;
    const px = this.player ? this.player.x : 0;

    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      // Karakterle aynı şeritteki (Math.abs(o.x - player.x) <= 2.0) ve 200m ileriye kadar (o.z >= -200 && o.z <= 4.0)
      if (Math.abs(o.x - px) <= 2.0 && o.z >= -200.0 && o.z <= 4.0) {
        const shatterPos = { x: o.x, y: 1.0, z: o.z };

        // 3D enkaz parçaları + turuncu kıvılcımlar (orange sparks #ff8800)
        shatterObstacle(this.scene, o, {
          color: 0x00e5ff,
          emissive: 0x0099ff,
          sparkColor: '#ff8800',
          blastForce: 14.5,
        });

        // Eşzamanlı mavi-beyaz plazma kıvılcım patlaması (cyan sparks #00e5ff)
        shatterObstacle(this.scene, shatterPos, {
          color: 0xffffff,
          emissive: 0x00e5ff,
          sparkColor: '#00e5ff',
          blastForce: 11.5,
        });

        // Engeli oyundan kaldır ve crash efekti tetikle
        this.obstacles.remove(o);
        emit('crash', { position: new THREE.Vector3(o.x, 1.0, o.z) });
      }
    }
  }

  // ------------------------------------------------------------------ ACTIVATE
  activate() {
    if (this.active || this.charges <= 0) return false;

    this.charges--;
    this.active = true;
    this.duration = 2.2;
    this.timeRemaining = 2.2;

    const chestPos = this.getChestPosition();

    // Attach & show 3-layer Unibeam
    this.beam.root.visible = true;
    this.beam.root.position.copy(chestPos);

    // Göğüste mavi PointLight patlaması
    triggerFlashLight(this.scene, chestPos, 0x00e5ff, 8.5, 0.65);

    // Güçlü kamera sarsıntısı: triggerCameraShake(cameraRig, 0.42, 0.55)
    triggerCameraShake(this.cameraRig, 0.42, 0.55);

    // Initial obstacle clear along beam path
    this._destroyObstaclesInRange();

    emit('unibeam', { position: chestPos.clone() });
    emit('ironOn', { position: chestPos.clone() });

    return true;
  }

  // ------------------------------------------------------------------ UPDATE
  update(time, dt) {
    if (!this.active) {
      if (this.chestGroup) this.chestGroup.visible = false;
      return;
    }

    this.timeRemaining -= dt;
    const chestPos = this.getChestPosition();

    // Keep beam tracking player's chest
    this.beam.root.position.copy(chestPos);
    this.beam.update(time, dt);

    // Update chest visual effects
    this._updateChestVFX(time, dt, chestPos);

    // Continuous beam annihilation of obstacles entering the line of fire
    this._destroyObstaclesInRange();

    // Soft fade-out during the final 0.45 seconds
    if (this.timeRemaining <= 0.45) {
      const fade = Math.max(0, this.timeRemaining / 0.45);
      this.beam.coreMesh.material.opacity = 0.95 * fade;
      this.beam.plasmaMesh.material.opacity = 0.75 * fade;
      if (this.beam.unibeamLight) {
        this.beam.unibeamLight.intensity = (5.0 + Math.sin(time * 40) * 2.5) * fade;
      }
      for (let i = 0; i < this.beam.rings.length; i++) {
        this.beam.rings[i].material.opacity *= fade;
      }
      if (this.chestGlowMesh) {
        this.chestGlowMesh.material.opacity = 0.95 * fade;
      }
    }

    // Expiry
    if (this.timeRemaining <= 0) {
      this.deactivate(true);
    }
  }

  // ------------------------------------------------------------------ ABSORB HIT
  absorbHit(hit) {
    if (!this.active) return false;

    const hitPos = (hit && hit.position) ? hit.position : this.getChestPosition();

    if (hit && hit.obstacle) {
      // Unibeam vaporizes obstacle into debris and sparks
      shatterObstacle(this.scene, hit.obstacle, {
        color: 0x00e5ff,
        emissive: 0x00bfff,
        sparkColor: '#ff8800',
        blastForce: 15.0,
      });
      shatterObstacle(this.scene, hitPos, {
        color: 0xffffff,
        emissive: 0x00e5ff,
        sparkColor: '#00e5ff',
        blastForce: 12.0,
      });
      this.obstacles.remove(hit.obstacle);
    }

    triggerCameraShake(this.cameraRig, 0.38, 0.45);
    if (this.obstacles && typeof this.obstacles.grace === 'function') {
      this.obstacles.grace(1.5);
    }

    emit('crash', { position: hitPos.clone() });
    return true;
  }

  // ------------------------------------------------------------------ DEACTIVATE
  deactivate(expired = false) {
    if (!this.active) return;

    this.active = false;
    this.timeRemaining = 0;

    if (this.beam?.root) {
      this.beam.root.visible = false;
      // Reset opacities for subsequent uses
      this.beam.coreMesh.material.opacity = 0.95;
      this.beam.plasmaMesh.material.opacity = 0.75;
    }

    if (this.chestGroup) {
      this.chestGroup.visible = false;
    }

    // Atış sonrasında grace period verir
    if (this.obstacles && typeof this.obstacles.grace === 'function') {
      this.obstacles.grace(1.5);
    }

    emit('unibeamEnd');
    emit('ironOff');
  }

  // ------------------------------------------------------------------ RESET
  reset() {
    this.deactivate(false);
    this.charges = this.maxCharges;
  }

  // ------------------------------------------------------------------ DISPOSE
  dispose() {
    this.deactivate(false);

    if (this.beam) {
      if (this.scene && this.beam.root) {
        this.scene.remove(this.beam.root);
      }
      this.beam.dispose();
    }

    if (this.chestGroup) {
      if (this.scene) {
        this.scene.remove(this.chestGroup);
      }
      this.chestGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
  }
}

// ------------------------------------------------------------------ FACTORY FUNCTION
export function createIronManSkill({ scene, player, obstacles, cameraRig }) {
  return new IronManSkill({ scene, player, obstacles, cameraRig });
}
