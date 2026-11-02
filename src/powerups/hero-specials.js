// powerups/hero-specials.js — Subway Surfers-Grade Character Special Skills:
//
// 1. HULK -> "Hulk Smash" (6.0s duration, max 1 charge):
//    - Glowing radioactive green fissure ground cracks extending from feet.
//    - Heavy stomp shockwave rings radiating on the ground with concrete dust particles.
//    - Multi-layer raging gamma plasma aura: inner emerald core sphere, outer corona,
//      electric lightning tendrils.
//    - Smashes all obstacles in front/sides without dying. Smashed obstacles burst into
//      heavy concrete debris + comic "SMASH!" / "GÜM!" / "BAM!" floaters + green flash.
//      Debounced to max 1 crash FX per 120ms.
//    - Stumble immunity during smash.
//    - Safety grace(0.5) on expiry.
//
// 2. CAPTAIN AMERICA -> "Shield Surfing" (8.0s duration, max 1 charge):
//    - 3D Vibranium Shield spinning under his boots (brushed metal, concentric
//      red/silver/blue rings, 3D extruded star, foot grip pads).
//    - Hover height: exactly 0.32m above ground (0.22m sliding), adjusted via beforePlayer
//      on player.floorY to eliminate jitter.
//    - Hurdle (0.8m) and trains (2.88m) CANNOT be cleared without jumping! Must jump!
//    - Aerodynamic wind wake ribbons streaming off the shield while jumping.
//    - Continuous high-velocity friction spark stream trailing behind on the pavement +
//      cyan kinetic energy cushion disc.
//    - Collision absorption: Vibranium kinetic blast absorbs the impact, metallic gong sound,
//      circular expanding vibranium shockwave ring, ends surfing safely, grants 1.5s grace,
//      player continues running without dying.
//
// 3. MILES MORALES -> "Venom Bio-Electricity" (7.0s duration, max 1 charge):
//    - Spider-Verse / Insomniac authentic bio-electricity: multi-branching golden yellow &
//      electric orange lightning bolts crackling rapidly across suit, hands, and feet.
//    - Trailing electric streamers and sparks flowing behind his back as he runs at +10 m/s fixed speed boost.
//    - Pulsing amber/orange bio-luminescent point light and ground glow.
//    - Collision absorption: Blinding "VENOM BLAST" electric nova explosion, radial lightning ring,
//      shockwave, obstacle instantly vaporized into sparks, ends skill safely, grants 1.5s grace,
//      player continues running without dying!

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { laneX } from '../world.js';
import {
  updateShatterDebris,
  updateFlashLights,
  updateCameraFov,
} from '../vfxCore.js';
import { createHelloKittySkill } from './skillHelloKitty.js';
import { createBatmanSkill } from './skillBatman.js';
import { createSpiderman2002Skill } from './skillSpiderman2002.js';
import { createIronManSkill } from './skillIronMan.js';
import { createBlackPantherSkill } from './skillBlackPanther.js';

export const HERO_SKINS = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];

// ------------------------------------------------------------------ REALISTIC VFX TEXTURE LOADER
const texLoader = new THREE.TextureLoader();

const HULK_FISSURE_TEX = texLoader.load('assets/vfx/hulk_fissure_crack.jpg');
HULK_FISSURE_TEX.colorSpace = THREE.SRGBColorSpace;

const HULK_SHOCKWAVE_TEX = texLoader.load('assets/vfx/hulk_gamma_shockwave.jpg');
HULK_SHOCKWAVE_TEX.colorSpace = THREE.SRGBColorSpace;

const CAP_DISC_TEX = texLoader.load('assets/vfx/cap_shield_disc.png');
CAP_DISC_TEX.colorSpace = THREE.SRGBColorSpace;

const CAP_SHOCKWAVE_TEX = texLoader.load('assets/vfx/cap_vibranium_shockwave.png');
CAP_SHOCKWAVE_TEX.colorSpace = THREE.SRGBColorSpace;

const MILES_LIGHTNING_TEX = texLoader.load('assets/vfx/miles_venom_lightning.jpg');
MILES_LIGHTNING_TEX.colorSpace = THREE.SRGBColorSpace;

const MILES_NOVA_TEX = texLoader.load('assets/vfx/miles_venom_nova.png');
MILES_NOVA_TEX.colorSpace = THREE.SRGBColorSpace;

export const HERO_SPECIAL_TEXTURES = [
  HULK_FISSURE_TEX,
  HULK_SHOCKWAVE_TEX,
  CAP_DISC_TEX,
  CAP_SHOCKWAVE_TEX,
  MILES_LIGHTNING_TEX,
  MILES_NOVA_TEX,
];

// ------------------------------------------------------------------ HULK SMASH ASSETS
function createGammaAura() {
  const g = new THREE.Group();
  g.name = 'hulkGammaAura';

  // 1. Inner core pulsing gamma sphere
  const sphereGeo = new THREE.SphereGeometry(1.26, 24, 16);
  sphereGeo.translate(0, 0.85, 0);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  g.add(sphere);

  // 2. Outer corona gamma sphere
  const coronaGeo = new THREE.SphereGeometry(1.58, 20, 14);
  coronaGeo.translate(0, 0.85, 0);
  const coronaMat = new THREE.MeshBasicMaterial({
    color: 0x18cc11,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  g.add(corona);

  // 3. PHOTOREALISTIC HULK FISSURE CRACK DECAL (AI GENERATED TEXTURE)
  const fissureGroup = new THREE.Group();
  fissureGroup.position.set(0, 0.035, 0);
  g.add(fissureGroup);

  const fissurePlaneGeo = new THREE.PlaneGeometry(3.6, 3.6);
  fissurePlaneGeo.rotateX(-Math.PI / 2);
  const fissureMat = new THREE.MeshBasicMaterial({
    map: HULK_FISSURE_TEX,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.95,
  });
  const fissureDecal = new THREE.Mesh(fissurePlaneGeo, fissureMat);
  fissureGroup.add(fissureDecal);

  // Secondary pulsating ground glow disc
  const fissureGlowGeo = new THREE.RingGeometry(0.2, 2.0, 32);
  fissureGlowGeo.rotateX(-Math.PI / 2);
  const fissureGlowMat = new THREE.MeshBasicMaterial({
    color: 0x22ee11,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const fissureGlowDisc = new THREE.Mesh(fissureGlowGeo, fissureGlowMat);
  fissureGroup.add(fissureGlowDisc);

  // 4. PHOTOREALISTIC GAMMA STOMP SHOCKWAVE (AI GENERATED TEXTURE)
  const shockwaveGeo1 = new THREE.PlaneGeometry(3.4, 3.4);
  shockwaveGeo1.rotateX(-Math.PI / 2);
  shockwaveGeo1.translate(0, 0.04, 0);
  const shockwaveMat1 = new THREE.MeshBasicMaterial({
    map: HULK_SHOCKWAVE_TEX,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.85,
  });
  const shockwave1 = new THREE.Mesh(shockwaveGeo1, shockwaveMat1);
  g.add(shockwave1);

  const shockwaveGeo2 = new THREE.PlaneGeometry(2.8, 2.8);
  shockwaveGeo2.rotateX(-Math.PI / 2);
  shockwaveGeo2.translate(0, 0.05, 0);
  const shockwaveMat2 = new THREE.MeshBasicMaterial({
    map: HULK_SHOCKWAVE_TEX,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.7,
  });
  const shockwave2 = new THREE.Mesh(shockwaveGeo2, shockwaveMat2);
  g.add(shockwave2);

  // 5. Dynamic Gamma Point Light
  const gammaLight = new THREE.PointLight(0x44ff11, 0, 14);
  gammaLight.position.y = 0.85;
  g.add(gammaLight);

  return {
    root: g,
    gammaLight,
    update(time, dt, sliding = false) {
      const auraY = sliding ? -0.35 : 0;
      sphere.position.y = auraY;
      corona.position.y = auraY;
      gammaLight.position.y = 0.85 + auraY;

      // Aura breathing & pulsing
      const pulse1 = 1 + Math.sin(time * 16) * 0.14;
      sphere.scale.set(pulse1, pulse1 * 1.06, pulse1);

      const pulse2 = 1 + Math.cos(time * 21) * 0.12;
      corona.scale.set(pulse2, pulse2 * 1.04, pulse2);

      // Fissure ground cracks pulse and jitter
      const fScale = 1.0 + Math.sin(time * 16) * 0.08;
      fissureDecal.scale.set(fScale, 1, fScale);
      fissureMat.opacity = 0.82 + Math.sin(time * 24) * 0.18;
      fissureGlowMat.opacity = 0.3 + Math.sin(time * 12) * 0.15;

      // Stomp shockwave expansion
      const t1 = (time * 3.4) % 1.0;
      const s1 = 0.4 + t1 * 1.5;
      shockwave1.scale.set(s1, 1, s1);
      shockwaveMat1.opacity = 0.9 * (1.0 - t1);
      shockwave1.rotation.y = time * 2.0;

      const t2 = (time * 3.4 + 0.5) % 1.0;
      const s2 = 0.3 + t2 * 1.4;
      shockwave2.scale.set(s2, 1, s2);
      shockwaveMat2.opacity = 0.75 * (1.0 - t2);
      shockwave2.rotation.y = -time * 1.8;

      // Gamma point light pulse
      gammaLight.intensity = 4.8 + Math.sin(time * 24) * 1.8 + Math.cos(time * 42) * 0.8;
    },
    dispose() {
      g.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}

// ------------------------------------------------------------------ CAPTAIN AMERICA SHIELD ASSETS
function createVibraniumShield() {
  const g = new THREE.Group();
  g.name = 'vibraniumShieldBoard';

  const R = 0.40;
  const H = 0.038;

  // Group that spins under the player's boots
  const shieldMesh = new THREE.Group();
  g.add(shieldMesh);

  // Outer bevel rim - Vibranium chrome alloy
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, H, 40),
    new THREE.MeshStandardMaterial({
      color: 0xe8ecf2,
      roughness: 0.22,
      metalness: 0.92,
    })
  );
  shieldMesh.add(rim);

  // Ring 1 (Outer Red)
  const red1 = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.94, R * 0.94, H + 0.002, 40),
    new THREE.MeshStandardMaterial({
      color: 0xcc1824,
      roughness: 0.28,
      metalness: 0.85,
    })
  );
  shieldMesh.add(red1);

  // Ring 2 (White/Silver)
  const white1 = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.74, R * 0.74, H + 0.004, 40),
    new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      roughness: 0.25,
      metalness: 0.88,
    })
  );
  shieldMesh.add(white1);

  // Ring 3 (Inner Red)
  const red2 = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.54, R * 0.54, H + 0.006, 40),
    new THREE.MeshStandardMaterial({
      color: 0xcc1824,
      roughness: 0.28,
      metalness: 0.85,
    })
  );
  shieldMesh.add(red2);

  // Ring 4 (Centre Blue Field)
  const blue = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.34, R * 0.34, H + 0.008, 40),
    new THREE.MeshStandardMaterial({
      color: 0x1b4da6,
      roughness: 0.26,
      metalness: 0.86,
    })
  );
  shieldMesh.add(blue);

  // Centre Silver Star (3D Extruded Star)
  const starShape = new THREE.Shape();
  const rStar = R * 0.30;
  const rIn = rStar * 0.42;
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? rIn : rStar;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.008, bevelEnabled: false });
  starGeo.rotateX(-Math.PI / 2);
  starGeo.translate(0, H / 2 + 0.005, 0);
  const starMesh = new THREE.Mesh(
    starGeo,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.95,
    })
  );
  shieldMesh.add(starMesh);

  // Underside dish
  const backDish = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.96, R * 0.70, 0.02, 32),
    new THREE.MeshStandardMaterial({
      color: 0x3a3f47,
      roughness: 0.45,
      metalness: 0.8,
    })
  );
  backDish.position.y = -H / 2 - 0.006;
  shieldMesh.add(backDish);

  // Foot grip pads (where Cap's boots stand on the shield)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.8 });
  const padGeo = new THREE.BoxGeometry(0.12, 0.004, 0.22);
  for (const sx of [-0.11, 0.11]) {
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(sx, H / 2 + 0.004, 0);
    shieldMesh.add(pad);
  }

  // Non-spinning FX group
  const fxGroup = new THREE.Group();
  g.add(fxGroup);

  // Dynamic friction spark ring
  const sparkGeo = new THREE.RingGeometry(R * 0.55, R * 1.35, 32);
  sparkGeo.rotateX(-Math.PI / 2);
  sparkGeo.translate(0, -H / 2 - 0.012, 0);
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffcc33,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const sparkRing = new THREE.Mesh(sparkGeo, sparkMat);
  fxGroup.add(sparkRing);

  // Vibranium kinetic energy cushion disc (HIGH-RES PHOTOREALISTIC TEXTURE)
  const energyGeo = new THREE.PlaneGeometry(R * 2.8, R * 2.8);
  energyGeo.rotateX(-Math.PI / 2);
  energyGeo.translate(0, -H / 2 - 0.008, 0);
  const energyMat = new THREE.MeshBasicMaterial({
    map: CAP_DISC_TEX,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const energyDisc = new THREE.Mesh(energyGeo, energyMat);
  fxGroup.add(energyDisc);

  // Aerodynamic wind wake ribbons (visible while jumping mid-air)
  const wakeGroup = new THREE.Group();
  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0xd0f5ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const wakeGeo = new THREE.PlaneGeometry(0.12, 0.95, 1, 6);
  wakeGeo.rotateX(Math.PI / 2);
  wakeGeo.translate(0, 0, 0.48);
  const wakeL = new THREE.Mesh(wakeGeo, wakeMat);
  wakeL.position.set(-R * 0.75, 0, 0);
  const wakeR = new THREE.Mesh(wakeGeo.clone(), wakeMat);
  wakeR.position.set(R * 0.75, 0, 0);
  wakeGroup.add(wakeL, wakeR);
  wakeGroup.visible = false;
  fxGroup.add(wakeGroup);

  // Kinetic ground spark light
  const sparkLight = new THREE.PointLight(0x33ccff, 2.5, 4.0);
  sparkLight.position.set(0, -H / 2 - 0.06, 0);
  fxGroup.add(sparkLight);

  return {
    root: g,
    shieldMesh,
    sparkRing,
    energyDisc,
    wakeGroup,
    sparkLight,
    update(time, dt, isGrounded, isSliding) {
      // Rapid clean spinning under boots
      shieldMesh.rotation.y += dt * 20.0;

      // Counter-rotate textured vibranium cushion disc
      energyDisc.rotation.z -= dt * 6.0;

      // Counter-rotate spark ring
      sparkRing.rotation.z -= dt * 12.0;

      if (isGrounded) {
        // Skimming over ground/roof: high-velocity friction sparks & cyan cushion disc
        wakeGroup.visible = false;
        const pulse = Math.sin(time * 24);
        const flicker = 0.65 + Math.random() * 0.35;
        sparkRing.material.opacity = isSliding ? 0.95 : flicker;
        sparkRing.scale.set(1 + pulse * 0.08, 1 + pulse * 0.08, 1);
        energyDisc.material.opacity = isSliding ? 0.95 : (0.75 + Math.sin(time * 16) * 0.2);
        energyDisc.scale.set(1 + pulse * 0.06, 1 + pulse * 0.06, 1);
        sparkLight.color.setHex(isSliding ? 0xffaa22 : 0x00f0ff);
        sparkLight.intensity = isSliding ? 3.8 : (2.4 + Math.random() * 0.8);
      } else {
        // Airborne jump: wind wake ribbons stream behind the shield
        wakeGroup.visible = true;
        wakeL.scale.y = 1 + Math.sin(time * 18) * 0.15;
        wakeR.scale.y = 1 + Math.cos(time * 18) * 0.15;
        sparkRing.material.opacity = 0.15;
        energyDisc.material.opacity = 0.9;
        sparkLight.color.setHex(0x00f0ff);
        sparkLight.intensity = 1.2;
      }
    },
    dispose() {
      g.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}

// ------------------------------------------------------------------ MILES MORALES BIO-ELECTRICITY
function createBioElectricity() {
  const g = new THREE.Group();
  g.name = 'milesBioElectricity';

  // 1. PHOTOREALISTIC SPIDER-VERSE BIO-ELECTRIC LIGHTNING (AI GENERATED TEXTURE)
  const lightningGroup = new THREE.Group();
  g.add(lightningGroup);

  const lightningPlanes = [];
  const planeGeo = new THREE.PlaneGeometry(1.6, 1.6);
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: MILES_LIGHTNING_TEX,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(planeGeo, mat);
    mesh.position.set(
      (i % 2 === 0 ? 0.15 : -0.15),
      0.82 + (i - 1.5) * 0.22,
      (i < 2 ? 0.12 : -0.12)
    );
    lightningGroup.add(mesh);
    lightningPlanes.push(mesh);
  }

  // 2. Multi-branching high-voltage electric spark tendrils
  const lineCount = 20;
  const positions = new Float32Array(lineCount * 2 * 3);
  const colors = new Float32Array(lineCount * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    linewidth: 2,
  });
  const lines = new THREE.LineSegments(geo, mat);
  g.add(lines);

  // 3. Ground bio-electric glow disc
  const discGeo = new THREE.RingGeometry(0.1, 1.4, 24);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const groundDisc = new THREE.Mesh(discGeo, discMat);
  groundDisc.position.y = 0.04;
  g.add(groundDisc);

  // 4. Dynamic bio-luminescent Point Light
  const glowLight = new THREE.PointLight(0xffaa00, 0, 10);
  glowLight.position.y = 0.85;
  g.add(glowLight);

  const yellow = new THREE.Color(0xffea00);
  const orange = new THREE.Color(0xff5500);
  const white = new THREE.Color(0xffffff);

  return {
    root: g,
    glowLight,
    update(time) {
      // Spider-Verse frame-stepped lightning animation (18 FPS)
      const frame = Math.floor(time * 18);
      for (let i = 0; i < lightningPlanes.length; i++) {
        const p = lightningPlanes[i];
        const seed = frame * 11 + i * 23;
        const visible = Math.sin(seed) > -0.35;
        p.visible = visible;
        if (visible) {
          p.rotation.y = (frame * 1.57 + i * Math.PI / 2) + Math.sin(seed * 2) * 0.25;
          p.rotation.z = Math.sin(seed * 3) * 0.35;
          const sc = 0.85 + Math.abs(Math.sin(seed * 5)) * 0.45;
          p.scale.set(sc, sc, sc);
          p.material.opacity = 0.8 + Math.abs(Math.sin(seed * 7)) * 0.2;
        }
      }

      const pos = geo.attributes.position.array;
      const col = geo.attributes.color.array;

      for (let i = 0; i < lineCount; i++) {
        const idx = i * 6;
        const cy = 0.15 + Math.random() * 1.35;
        const r1 = 0.14 + Math.random() * 0.38;
        const a1 = Math.random() * Math.PI * 2;
        const r2 = 0.18 + Math.random() * 0.48;
        const a2 = a1 + (Math.random() - 0.5) * 1.6;

        pos[idx] = Math.cos(a1) * r1;
        pos[idx + 1] = cy;
        pos[idx + 2] = Math.sin(a1) * r1;

        pos[idx + 3] = Math.cos(a2) * r2;
        pos[idx + 4] = cy + (Math.random() - 0.5) * 0.3;
        pos[idx + 5] = Math.sin(a2) * r2;

        const cChoice = i % 3 === 0 ? white : (i % 2 === 0 ? yellow : orange);
        col[idx] = cChoice.r;
        col[idx + 1] = cChoice.g;
        col[idx + 2] = cChoice.b;

        const cChoice2 = i % 2 === 0 ? yellow : orange;
        col[idx + 3] = cChoice2.r;
        col[idx + 4] = cChoice2.g;
        col[idx + 5] = cChoice2.b;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      groundDisc.scale.setScalar(1 + Math.sin(time * 20) * 0.12);
      discMat.opacity = 0.35 + Math.sin(time * 25) * 0.2;

      glowLight.intensity = 3.8 + Math.sin(time * 32) * 1.6;
    },
    dispose() {
      g.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}

// ------------------------------------------------------------------ HERO SPECIALS MANAGER
export class HeroSpecials {
  constructor({ scene, player, obstacles, cameraRig, chaser }) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    this.active = false;
    this.mode = null; // 'hulk' | 'cap' | 'miles'
    this.timeRemaining = 0;
    this.maxTime = 0;
    this.timeAlive = 0;
    this._lastSmashTime = -Infinity;
    this.milesBaseSpeed = null;

    // Visual effect groups attached to player.root
    this.gammaAura = createGammaAura();
    this.gammaAura.root.visible = false;
    player.root.add(this.gammaAura.root);

    this.shieldBoard = createVibraniumShield();
    this.shieldBoard.root.visible = false;
    this.shieldBoard.root.position.set(0, -0.02, 0);
    player.root.add(this.shieldBoard.root);

    this.bioElectric = createBioElectricity();
    this.bioElectric.root.visible = false;
    player.root.add(this.bioElectric.root);

    // 5 New Modular Character Skills
    this.skills = {
      kitty: createHelloKittySkill({ scene, player, obstacles, cameraRig, chaser }),
      batman: createBatmanSkill({ scene, player, obstacles, cameraRig, chaser }),
      raimi: createSpiderman2002Skill({ scene, player, obstacles, cameraRig, camera: cameraRig?.camera }),
      ironman: createIronManSkill({ scene, player, obstacles, cameraRig }),
      panther: createBlackPantherSkill({ scene, player, obstacles, cameraRig, chaser }),
    };
    this.startDistance = 0;

    // Active 3D textured transient shockwaves & explosion FX
    this.transientFX = [];

    const prevFront = obstacles.hooks.onFrontHit;
    obstacles.hooks.onFrontHit = (hit) => {
      if (this.active && this.absorbHit(hit)) return true;
      return prevFront ? prevFront(hit) : false;
    };
    const prevSide = obstacles.hooks.onSideHit;
    obstacles.hooks.onSideHit = (hit) => {
      if (this.active && this.absorbHit(hit)) return true;
      return prevSide ? prevSide(hit) : false;
    };
    const prevCatch = chaser.hooks.absorbCatch;
    chaser.hooks.absorbCatch = () => {
      if (this.active && this.absorbHit()) return true;
      return prevCatch ? prevCatch() : false;
    };
  }

  spawnTexturedShockwave(type, pos) {
    if (!this.scene) return;
    const g = new THREE.Group();
    const groundY = (this.player && this.player.floorY != null ? this.player.floorY : 0) + 0.035;
    g.position.set(pos.x, groundY, pos.z);

    let tex = null;
    let size = 3.6;
    let maxScale = 2.4;
    let dur = 0.45;

    if (type === 'hulk') {
      tex = HULK_SHOCKWAVE_TEX;
      size = 3.8;
      maxScale = 2.8;
      dur = 0.48;
    } else if (type === 'cap') {
      tex = CAP_SHOCKWAVE_TEX;
      size = 3.4;
      maxScale = 2.5;
      dur = 0.42;
    } else if (type === 'miles') {
      tex = MILES_NOVA_TEX;
      size = 4.2;
      maxScale = 3.0;
      dur = 0.55;
    }

    if (!tex) return;

    const planeGeo = new THREE.PlaneGeometry(size, size);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.95,
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    g.add(planeMesh);

    const billGeo = new THREE.PlaneGeometry(size * 0.85, size * 0.85);
    const billMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      opacity: 0.9,
    });
    const billMesh = new THREE.Mesh(billGeo, billMat);
    billMesh.position.y = 0.75;
    g.add(billMesh);

    this.scene.add(g);
    this.transientFX.push({
      root: g,
      planeMat,
      billMat,
      planeGeo,
      billGeo,
      age: 0,
      duration: dur,
      maxScale,
    });
  }

  isHero(skin) {
    return HERO_SKINS.includes(skin);
  }

  getHeroConfig(skin) {
    if (skin === 'hulk') {
      return { name: 'hulk', duration: 6.0, label: 'HULK SMASH', icon: '👊', className: 'hulk' };
    }
    if (skin === 'cap') {
      return { name: 'cap', duration: 8.0, label: 'SHIELD SURF', icon: '🛡️', className: 'cap' };
    }
    if (skin === 'miles') {
      return { name: 'miles', duration: 7.0, label: 'VENOM BLAST', icon: '⚡', className: 'miles' };
    }
    if (skin === 'kitty') {
      return { name: 'kitty', duration: 8.0, label: 'UÇAN KALP', icon: '💖', className: 'kitty' };
    }
    if (skin === 'batman') {
      return { name: 'batman', distance: 800, duration: 25.0, label: 'GECE PELERİNİ', icon: '🦇', className: 'batman', isDistance: true };
    }
    if (skin === 'raimi') {
      return { name: 'raimi', duration: 3.0, label: 'MANCINIK AĞ', icon: '🕸️', className: 'raimi', maxCharges: 2 };
    }
    if (skin === 'ironman') {
      return { name: 'ironman', duration: 2.2, label: 'UNIBEAM', icon: '💥', className: 'ironman' };
    }
    if (skin === 'panther') {
      return { name: 'panther', duration: 5.5, label: 'VİBRANYUM ŞOK', icon: '🟣', className: 'panther' };
    }
    return null;
  }

  _hideArmShield() {
    const s = this.player.root.getObjectByName('capArmShield');
    if (s) s.visible = false;
  }

  _restoreArmShield() {
    const s = this.player.root.getObjectByName('capArmShield');
    if (s) s.visible = true;
  }

  activate(skin, overrideDuration) {
    const cfg = this.getHeroConfig(skin);
    if (!cfg) return false;
    if (this.active || game.halted || (this.player && this.player.controlsLocked)) return false;

    const dur = (overrideDuration && overrideDuration > 0) ? overrideDuration : cfg.duration;

    // 1. HULK SMASH
    if (skin === 'hulk') {
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      this._lastSmashTime = -Infinity;
      this.gammaAura.root.visible = true;
      if (this.gammaAura.gammaLight) this.gammaAura.gammaLight.intensity = 4.8;
      this.player.clearOverride();
      this.obstacles.grace(0.3);
      if (this.chaser && this.chaser.isNear) this.chaser._dropBack();
      if (this.cameraRig) this.cameraRig.shake(0.35, 0.45);
      emit('hulkRoar');
      emit('hulkSmash', { position: new THREE.Vector3(this.player.x, 1.0, 0) });
      emit('specialOn', { mode: this.mode, duration: this.maxTime });
      return true;
    }

    // 2. CAPTAIN AMERICA SHIELD SURF
    if (skin === 'cap') {
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      this.shieldBoard.root.visible = true;
      this._hideArmShield();
      if (this.player.grounded) {
        this.player.floorY += 0.32;
        this.player.y = this.player.floorY;
      }
      if (this.cameraRig) this.cameraRig.shake(0.12, 0.22);
      emit('capShieldSurf');
      emit('specialOn', { mode: this.mode, duration: this.maxTime });
      return true;
    }

    // 3. MILES MORALES VENOM BIO-ELECTRICITY
    if (skin === 'miles') {
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      this.bioElectric.root.visible = true;
      this.milesBaseSpeed = game.state.speed;
      game.speedOverride = Math.min(CONFIG.topSpeed + 10, this.milesBaseSpeed + 10);
      if (this.cameraRig) this.cameraRig.shake(0.15, 0.28);
      emit('milesVenomBlast');
      emit('specialOn', { mode: this.mode, duration: this.maxTime });
      return true;
    }

    // 4. HELLO KITTY: UÇAN KALP
    if (skin === 'kitty') {
      const ok = this.skills.kitty.activate(dur);
      if (!ok) return false;
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      return true;
    }

    // 5. BATMAN: GECE PELERİNİ (800 METRE)
    if (skin === 'batman') {
      const startDist = (game.state && typeof game.state.distance === 'number')
        ? game.state.distance
        : (game.world?.distance || 0);
      this.startDistance = startDist;
      const ok = this.skills.batman.activate(startDist);
      if (!ok) return false;
      this.active = true;
      this.mode = skin;
      this.timeRemaining = 800;
      this.maxTime = 800;
      this.timeAlive = 0;
      return true;
    }

    // 6. SPIDER-MAN 2002 (RAIMI): MANCINIK AĞ
    if (skin === 'raimi') {
      if (this.skills.raimi) {
        this.skills.raimi.charges = game.state.webCharges;
      }
      const ok = this.skills.raimi.activate();
      if (!ok) return false;
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      emit('specialOn', { mode: 'raimi', duration: this.maxTime });
      return true;
    }

    // 7. IRON MAN: UNIBEAM
    if (skin === 'ironman') {
      if (this.skills.ironman) {
        this.skills.ironman.charges = 1;
      }
      const ok = this.skills.ironman.activate();
      if (!ok) return false;
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      emit('specialOn', { mode: 'ironman', duration: this.maxTime });
      return true;
    }

    // 8. BLACK PANTHER: VİBRANYUM ŞOK
    if (skin === 'panther') {
      const ok = this.skills.panther.activate();
      if (!ok) return false;
      this.active = true;
      this.mode = skin;
      this.timeRemaining = dur;
      this.maxTime = dur;
      this.timeAlive = 0;
      return true;
    }

    return false;
  }

  beforePlayer(dt) {
    if (this.skills?.kitty && (this.skills.kitty.active || this.skills.kitty.currentFlyOffset > 0)) {
      this.skills.kitty.beforePlayer(dt);
    }
    if (this.skills?.batman && (this.skills.batman.active || this.skills.batman.currentFlyOffset > 0)) {
      this.skills.batman.beforePlayer(dt);
    }

    if (!this.active || game.halted) return;

    if (this.mode === 'cap') {
      // Hover height: 0.32m when running/jumping, 0.22m when sliding to clear high barriers
      const hover = (this.player.sliding && this.player.grounded) ? 0.22 : 0.32;
      this.player.floorY += hover;
      if (this.player.grounded) {
        this.player.y = this.player.floorY;
      }
    } else if (this.mode === 'raimi' && this.skills?.raimi) {
      this.skills.raimi.beforePlayer(dt);
    }
  }

  update(dt) {
    // 1. AAA VFX Core Updates
    updateShatterDebris(dt, game.state?.speed || 0);
    updateFlashLights(dt);
    updateCameraFov(dt);

    // 2. Update transient 3D impact shockwaves & explosion FX (Hulk, Cap, Miles)
    if (this.transientFX && this.transientFX.length > 0) {
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
          fx.billGeo.dispose();
          fx.planeMat.dispose();
          fx.billMat.dispose();
          this.transientFX.splice(i, 1);
        } else {
          const s = 0.3 + (fx.maxScale - 0.3) * Math.sin(k * Math.PI * 0.5);
          fx.root.scale.set(s, s, s);
          const alpha = Math.max(0, 1.0 - k);
          fx.planeMat.opacity = 0.95 * alpha;
          fx.billMat.opacity = 0.9 * alpha;
        }
      }
    }

    // 3. Update modular sub-skills
    if (this.skills?.kitty) this.skills.kitty.update(dt);
    if (this.skills?.batman) this.skills.batman.update(dt);
    if (this.skills?.raimi) this.skills.raimi.update(this.timeAlive, dt);
    if (this.skills?.ironman) this.skills.ironman.update(this.timeAlive, dt);
    if (this.skills?.panther) this.skills.panther.update(this.timeAlive, dt);

    if (!this.active || game.halted) return;

    this.timeAlive += dt;

    // 4. Batman Distance Control: mesafe >= 800 ise deactivate(true)
    if (this.mode === 'batman') {
      const curDist = (game.state && typeof game.state.distance === 'number')
        ? game.state.distance
        : (game.world?.distance || 0);
      const traveled = Math.max(0, curDist - this.startDistance);
      this.timeRemaining = Math.max(0, 800 - traveled);
      if (traveled >= 800 || !this.skills.batman.active) {
        this.deactivate(true);
        return;
      }
      return;
    }

    // 5. Modular skill deactivation sync
    if (this.mode === 'kitty') {
      this.timeRemaining = this.skills.kitty.timeRemaining;
      if (!this.skills.kitty.active || this.timeRemaining <= 0) {
        this.deactivate(true);
        return;
      }
      return;
    }

    if (this.mode === 'raimi') {
      if (!this.skills.raimi.active) {
        this.deactivate(false);
        return;
      }
      return;
    }

    if (this.mode === 'ironman') {
      this.timeRemaining = this.skills.ironman.timeRemaining;
      if (!this.skills.ironman.active || this.timeRemaining <= 0) {
        this.deactivate(true);
        return;
      }
      return;
    }

    if (this.mode === 'panther') {
      this.timeRemaining = this.skills.panther.timeRemaining;
      if (!this.skills.panther.active || this.timeRemaining <= 0) {
        this.deactivate(true);
        return;
      }
      return;
    }

    // 6. Hulk, Cap, Miles duration countdown
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      this.deactivate(true);
      return;
    }

    // 1. HULK SMASH: obliterate obstacles in front and sides!
    if (this.mode === 'hulk') {
      this.gammaAura.update(this.timeAlive, dt, this.player.sliding);

      // Immune to stumble during Hulk Smash
      if (this.player.overrideState === 'stumble' || this.player.override === 'stumble') {
        this.player.clearOverride();
      }

      const p = this.player;
      const smashReach = 5.2;
      const list = this.obstacles.active;
      let smashed = false;
      let lastSmashedPos = null;

      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        const dx = Math.abs(o.x - p.x);
        if (dx <= 2.2) {
          if (o.z >= -smashReach && (o.z - o.length) <= 2.2) {
            this.obstacles.remove(o);
            smashed = true;
            lastSmashedPos = new THREE.Vector3(o.x, 1.0, Math.max(o.z, -3.5));
          }
        }
      }

      if (smashed) {
        const now = performance.now();
        if (now - this._lastSmashTime > 120) {
          this._lastSmashTime = now;
          const pos = lastSmashedPos || new THREE.Vector3(p.x, 1.0, -1.0);
          this.spawnTexturedShockwave('hulk', pos);
          emit('hulkSmash', { position: pos });
          emit('crash', { position: pos });
          if (this.cameraRig) this.cameraRig.shake(0.35, 0.35);
        }
        this.obstacles.grace(0.25);
      }
    }
    // 2. CAPTAIN AMERICA: Shield Surfing
    else if (this.mode === 'cap') {
      this.shieldBoard.update(
        this.timeAlive,
        dt,
        this.player.grounded,
        this.player.sliding
      );
    }
    // 3. MILES MORALES: Venom Bio-Electricity
    else if (this.mode === 'miles') {
      this.bioElectric.update(this.timeAlive);
      if (this.milesBaseSpeed != null) {
        game.speedOverride = Math.min(CONFIG.topSpeed + 10, this.milesBaseSpeed + 10);
      }
    }
  }

  absorbHit(hit) {
    if (!this.active) return false;

    // 1. HULK SMASH
    if (this.mode === 'hulk') {
      if (hit?.obstacle) {
        this.obstacles.remove(hit.obstacle);
      }
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - this.player.x) <= 2.2 && o.z >= -8.0 && (o.z - o.length) <= 3.0) {
          this.obstacles.remove(o);
        }
      }
      this.obstacles.grace(0.35);

      const now = performance.now();
      if (now - this._lastSmashTime > 120) {
        this._lastSmashTime = now;
        const hitPos = (hit && hit.position) ? hit.position : new THREE.Vector3(this.player.x, 1.0, 0);
        this.spawnTexturedShockwave('hulk', hitPos);
        emit('hulkSmash', { position: hitPos.clone() });
        emit('crash', { position: hitPos.clone() });
        if (this.cameraRig) this.cameraRig.shake(0.35, 0.35);
      }
      return true;
    }

    // 2. CAPTAIN AMERICA
    if (this.mode === 'cap') {
      this.deactivate(false);
      if (hit?.obstacle) {
        this.obstacles.remove(hit.obstacle);
      }
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - this.player.x) <= 1.8 && o.z > -7.0 && (o.z - o.length) < 2.0) {
          this.obstacles.remove(o);
        }
      }
      const hitPos = (hit && hit.position) ? hit.position : new THREE.Vector3(this.player.x, 1.0, 0);
      this.spawnTexturedShockwave('cap', hitPos);
      emit('capShieldGong', { position: hitPos.clone() });
      emit('crash', { position: hitPos.clone() });
      if (this.cameraRig) this.cameraRig.shake(0.3, 0.35);
      this.obstacles.grace(1.5);
      return true;
    }

    // 3. MILES MORALES
    if (this.mode === 'miles') {
      this.deactivate(false);
      if (hit?.obstacle) {
        this.obstacles.remove(hit.obstacle);
      }
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - this.player.x) <= 1.8 && o.z > -7.0 && (o.z - o.length) < 2.0) {
          this.obstacles.remove(o);
        }
      }
      const hitPos = (hit && hit.position) ? hit.position : new THREE.Vector3(this.player.x, 1.0, 0);
      this.spawnTexturedShockwave('miles', hitPos);
      emit('venomBlastNova', { position: hitPos.clone() });
      emit('crash', { position: hitPos.clone() });
      if (this.cameraRig) this.cameraRig.shake(0.32, 0.35);
      this.obstacles.grace(1.5);
      return true;
    }

    // 4. HELLO KITTY
    if (this.mode === 'kitty' && this.skills?.kitty) {
      return this.skills.kitty.absorbHit(hit);
    }

    // 5. BATMAN
    if (this.mode === 'batman' && this.skills?.batman) {
      const res = this.skills.batman.absorbHit(hit);
      if (!this.skills.batman.active) {
        this.deactivate(false);
      }
      return res;
    }

    // 6. SPIDER-MAN 2002 (RAIMI)
    if (this.mode === 'raimi' && this.skills?.raimi) {
      return this.skills.raimi.absorbHit(hit);
    }

    // 7. IRON MAN
    if (this.mode === 'ironman' && this.skills?.ironman) {
      return this.skills.ironman.absorbHit(hit);
    }

    // 8. BLACK PANTHER
    if (this.mode === 'panther' && this.skills?.panther) {
      return this.skills.panther.absorbHit(hit);
    }

    return false;
  }

  deactivate(expired = false) {
    const mode = this.mode;
    this.active = false;
    this.timeRemaining = 0;

    // Deactivate modular sub-skills
    if (mode === 'kitty' && this.skills?.kitty?.active) this.skills.kitty.deactivate(expired);
    if (mode === 'batman' && this.skills?.batman?.active) this.skills.batman.deactivate(expired);
    if (mode === 'raimi' && this.skills?.raimi?.active) this.skills.raimi.deactivate();
    if (mode === 'ironman' && this.skills?.ironman?.active) this.skills.ironman.deactivate(expired);
    if (mode === 'panther' && this.skills?.panther?.active) this.skills.panther.deactivate();

    // Reset visual effects
    if (this.gammaAura) {
      this.gammaAura.root.visible = false;
      if (this.gammaAura.gammaLight) this.gammaAura.gammaLight.intensity = 0;
    }

    if (this.shieldBoard) {
      this.shieldBoard.root.visible = false;
      if (this.shieldBoard.sparkLight) this.shieldBoard.sparkLight.intensity = 0;
    }

    if (mode === 'cap') {
      this._restoreArmShield();
      if (this.player.grounded) {
        this.player.floorY = Math.max(0, this.player.floorY - 0.32);
        this.player.y = this.player.floorY;
      }
    }

    if (this.bioElectric) {
      this.bioElectric.root.visible = false;
      if (this.bioElectric.glowLight) this.bioElectric.glowLight.intensity = 0;
    }

    if (mode === 'miles' || mode === 'raimi' || this.milesBaseSpeed != null) {
      game.speedOverride = null;
      this.milesBaseSpeed = null;
    }

    if (mode === 'hulk' && expired) {
      // Safety grace on expiry
      this.obstacles.grace(0.5);
    }

    this.mode = null;
    emit('specialOff');
  }

  reset() {
    if (this.active) this.deactivate(false);
    if (this.skills) {
      for (const s of Object.values(this.skills)) {
        if (s && typeof s.reset === 'function') s.reset();
      }
    }
    if (this.transientFX && this.transientFX.length > 0) {
      for (const fx of this.transientFX) {
        if (this.scene) this.scene.remove(fx.root);
        if (fx.planeGeo) fx.planeGeo.dispose();
        if (fx.billGeo) fx.billGeo.dispose();
        if (fx.planeMat) fx.planeMat.dispose();
        if (fx.billMat) fx.billMat.dispose();
      }
      this.transientFX = [];
    }
    this.timeRemaining = 0;
    this.timeAlive = 0;
    this.mode = null;
    this._lastSmashTime = -Infinity;
    this.startDistance = 0;
  }

  dispose() {
    this.reset();
    if (this.skills) {
      for (const s of Object.values(this.skills)) {
        if (s && typeof s.dispose === 'function') s.dispose();
      }
    }
    if (this.gammaAura?.dispose) this.gammaAura.dispose();
    if (this.shieldBoard?.dispose) this.shieldBoard.dispose();
    if (this.bioElectric?.dispose) this.bioElectric.dispose();
    HULK_FISSURE_TEX.dispose();
    HULK_SHOCKWAVE_TEX.dispose();
    CAP_DISC_TEX.dispose();
    CAP_SHOCKWAVE_TEX.dispose();
    MILES_LIGHTNING_TEX.dispose();
    MILES_NOVA_TEX.dispose();
  }
}
