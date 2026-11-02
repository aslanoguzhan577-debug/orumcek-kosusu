// skillHelloKitty.js — Hello Kitty "Flying Heart Rise" (Uçan Kalp Yükselişi) Special Skill
//
// 1. "Flying Heart Rise" (Uçan Kalp Yükselişi):
//    - Under character's feet: A real 3D chubby pink heart modeled with THREE.Shape
//      (bezierCurveTo heart contour) and THREE.ExtrudeGeometry (bevelEnabled: true,
//      bevelSegments: 5, depth: 0.28). Color #ff66b2, emissive #ff1493.
//    - Includes Hello Kitty's signature 3D cherry-red ribbon bow, feathered angelic flapping wings,
//      concentric pearlescent inlay, glowing halo disc, and a radiant pink point light.
//    - Lifts the character smoothly (smoothstep easing) over 8.0 seconds to a safe height
//      (floorY += 3.6m) to easily glide above trains (2.88m) and barriers (0.8m).
//    - Trailing stream of pink & white sparkles (AdditiveBlending) and tumbling mini 3D hearts.
//    - Safe soft landing at the end of 8s granting the player a protection grace period (1.5s).
//    - Collision absorption (absorbHit): Heart burst glitter nova explosion, shatters/removes obstacles,
//      shakes camera, and keeps the player flying safely.
//    - UI SVG Icon: Glossy pink chubby heart SVG string (HEART_SVG_ICON) with ribbon bow and sparkles.
//
// 2. Strict Standards:
//    - NO flat spheres or cylinders for effect visuals.
//    - THREE.AdditiveBlending, transparent: true, depthWrite: false on VFX elements.
//    - Uses createGlowTexture and shatterObstacle from ../vfxCore.js.
//    - Exported createHelloKittySkill factory and HelloKittySkill class.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { createGlowTexture, shatterObstacle } from '../vfxCore.js';

// ------------------------------------------------------------------ UI SVG ICON
export const HEART_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <radialGradient id="hkGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffb6c1" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="#ff1493" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ff1493" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hkHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff94c2"/>
      <stop offset="38%" stop-color="#ff66b2"/>
      <stop offset="78%" stop-color="#ff1493"/>
      <stop offset="100%" stop-color="#c7005a"/>
    </linearGradient>
    <linearGradient id="hkGlossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="hkBowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d6d"/>
      <stop offset="50%" stop-color="#ff1744"/>
      <stop offset="100%" stop-color="#a80020"/>
    </linearGradient>
    <filter id="hkDropGlow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="3.2" result="glow"/>
      <feComposite in="SourceGraphic" in2="glow" operator="over"/>
    </filter>
  </defs>
  <!-- Background Radiant Aura -->
  <circle cx="50" cy="50" r="46" fill="url(#hkGlow)" />
  <!-- Main Chubby Heart with 3D drop glow -->
  <path d="M 50,84 C 50,84 15,62 15,36 C 15,22 25,12 38,12 C 45,12 50,17 50,21 C 50,17 55,12 62,12 C 75,12 85,22 85,36 C 85,62 50,84 50,84 Z"
        fill="url(#hkHeartGrad)"
        filter="url(#hkDropGlow)"
        stroke="#ffffff"
        stroke-width="1.8" />
  <!-- Chubby Gloss Highlight -->
  <path d="M 23,34 C 23,24 30,17 40,16 C 34,18 29,24 28,33 C 27,40 31,48 31,48 C 31,48 23,42 23,34 Z"
        fill="url(#hkGlossGrad)" />
  <ellipse cx="64" cy="22" rx="7" ry="3.5" transform="rotate(-25 64 22)" fill="#ffffff" opacity="0.65" />
  <!-- Cute Hello Kitty Bow on Left Notch -->
  <g transform="translate(22, 14) scale(0.68)">
    <ellipse cx="14" cy="18" rx="10" ry="7" transform="rotate(-22 14 18)" fill="url(#hkBowGrad)" stroke="#7a0017" stroke-width="1.2" />
    <ellipse cx="34" cy="16" rx="10" ry="7" transform="rotate(22 34 16)" fill="url(#hkBowGrad)" stroke="#7a0017" stroke-width="1.2" />
    <circle cx="24" cy="18" r="5.5" fill="#ff1744" stroke="#7a0017" stroke-width="1.2" />
    <circle cx="23" cy="16" r="1.8" fill="#ffffff" opacity="0.85" />
  </g>
  <!-- Magical Sparkle Stars -->
  <path d="M 76,28 Q 78,34 84,36 Q 78,38 76,44 Q 74,38 68,36 Q 74,34 76,28 Z" fill="#ffffff" />
  <path d="M 28,68 Q 29,72 33,73 Q 29,74 28,78 Q 27,74 23,73 Q 27,72 28,68 Z" fill="#ffffff" opacity="0.9" />
  <circle cx="78" cy="62" r="2.2" fill="#ffffff" opacity="0.85" />
</svg>`;

// ------------------------------------------------------------------ MATH & EASING HELPERS
function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// ------------------------------------------------------------------ 3D CHUBBY HEART SHAPE BUILDER
/**
 * Generates a cute, chubby, perfectly symmetrical heart contour via bezier curves.
 */
export function createHeartShape(scale = 1.0) {
  const shape = new THREE.Shape();
  const tipY = -0.65 * scale;
  const waistY = 0.22 * scale;
  const lobeY = 0.65 * scale;
  const notchY = 0.32 * scale;
  const halfW = 0.82 * scale;

  shape.moveTo(0, tipY);
  // Left curve upwards to waist
  shape.bezierCurveTo(-halfW * 0.42, -0.38 * scale, -halfW, -0.06 * scale, -halfW, waistY);
  // Left upper lobe crest
  shape.bezierCurveTo(-halfW, lobeY, -halfW * 0.32, lobeY * 1.12, -0.04 * scale, notchY * 1.22);
  // Center notch dip
  shape.bezierCurveTo(-0.02 * scale, notchY * 1.05, 0, notchY, 0, notchY);
  // Right notch to right upper lobe crest
  shape.bezierCurveTo(0, notchY, 0.02 * scale, notchY * 1.05, 0.04 * scale, notchY * 1.22);
  shape.bezierCurveTo(halfW * 0.32, lobeY * 1.12, halfW, lobeY, halfW, waistY);
  // Right waist downwards to bottom tip
  shape.bezierCurveTo(halfW, -0.06 * scale, halfW * 0.42, -0.38 * scale, 0, tipY);

  return shape;
}

/**
 * Creates layered feathered angelic wings for Hello Kitty's flying heart.
 */
function createWingShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.2, 0.12, 0.45, 0.22, 0.65, 0.25);
  s.bezierCurveTo(0.55, 0.1, 0.45, 0.0, 0.58, -0.05);
  s.bezierCurveTo(0.45, -0.12, 0.35, -0.18, 0.48, -0.25);
  s.bezierCurveTo(0.3, -0.22, 0.12, -0.15, 0, 0);
  return s;
}

/**
 * Creates Hello Kitty's signature 3D red ribbon bow.
 */
function create3DBow() {
  const bowGroup = new THREE.Group();
  bowGroup.name = 'kitty3DBow';

  const bowMat = new THREE.MeshStandardMaterial({
    color: 0xff1744,
    emissive: 0x880018,
    emissiveIntensity: 0.38,
    roughness: 0.25,
    metalness: 0.08,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xaa7700,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.8,
  });

  // Ribbon loop shape
  const loopShape = new THREE.Shape();
  loopShape.moveTo(0, 0);
  loopShape.bezierCurveTo(0.08, 0.06, 0.16, 0.09, 0.18, 0.0);
  loopShape.bezierCurveTo(0.16, -0.09, 0.08, -0.06, 0, 0);

  const loopGeo = new THREE.ExtrudeGeometry(loopShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelThickness: 0.015,
    bevelSize: 0.015,
  });
  loopGeo.center();

  // Left loop
  const leftLoop = new THREE.Mesh(loopGeo, bowMat);
  leftLoop.position.set(-0.10, 0, 0);
  leftLoop.rotation.z = 0.25;
  bowGroup.add(leftLoop);

  // Right loop
  const rightLoop = new THREE.Mesh(loopGeo.clone(), bowMat);
  rightLoop.position.set(0.10, 0, 0);
  rightLoop.rotation.z = -0.25;
  rightLoop.scale.set(-1, 1, 1);
  bowGroup.add(rightLoop);

  // Center knot
  const knotGeo = new THREE.DodecahedronGeometry(0.048, 1);
  const knot = new THREE.Mesh(knotGeo, bowMat);
  bowGroup.add(knot);

  // Center golden button accent
  const buttonGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.018, 12);
  buttonGeo.rotateX(Math.PI / 2);
  const button = new THREE.Mesh(buttonGeo, goldMat);
  button.position.set(0, 0, 0.04);
  bowGroup.add(button);

  return bowGroup;
}

// ------------------------------------------------------------------ 3D CHUBBY HEART FLYING PLATFORM
/**
 * Constructs the authentic 3D chubby pink heart vehicle equipped with:
 * - ExtrudeGeometry with bevelEnabled: true, bevelSegments: 5, depth: 0.28.
 * - Glossy candy-pink MeshStandardMaterial (#ff66b2, emissive #ff1493).
 * - Concentric pearlescent white/pink inlay heart.
 * - Hello Kitty's signature 3D cherry-red bow.
 * - Flapping feathered angel wings.
 * - Additive glowing halo cushion disc (using createGlowTexture).
 * - Radiant pink point light.
 */
function createHeartPlatform() {
  const root = new THREE.Group();
  root.name = 'helloKittyHeartPlatform';

  // 1. MAIN 3D CHUBBY PINK HEART (ExtrudeGeometry: depth 0.28, bevelSegments: 5)
  const mainShape = createHeartShape(1.0);
  const heartGeo = new THREE.ExtrudeGeometry(mainShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    steps: 2,
  });
  heartGeo.center();
  // Rotate so it lies flat under the player's boots (twin lobes forward, sleek tip rear)
  heartGeo.rotateX(-Math.PI / 2);

  const heartMat = new THREE.MeshStandardMaterial({
    color: 0xff66b2,
    emissive: 0xff1493,
    emissiveIntensity: 0.42,
    roughness: 0.20,
    metalness: 0.10,
  });

  const heartMesh = new THREE.Mesh(heartGeo, heartMat);
  heartMesh.position.set(0, 0, 0);
  root.add(heartMesh);

  // 2. CONCENTRIC PEARLESCENT INLAY HEART
  const inlayShape = createHeartShape(0.76);
  const inlayGeo = new THREE.ExtrudeGeometry(inlayShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    steps: 1,
  });
  inlayGeo.center();
  inlayGeo.rotateX(-Math.PI / 2);

  const inlayMat = new THREE.MeshStandardMaterial({
    color: 0xfff0f5,
    emissive: 0xffb6c1,
    emissiveIntensity: 0.48,
    roughness: 0.18,
    metalness: 0.12,
  });

  const inlayMesh = new THREE.Mesh(inlayGeo, inlayMat);
  inlayMesh.position.set(0, 0.155, 0);
  root.add(inlayMesh);

  // 3. HELLO KITTY'S 3D RED BOW ACCENT (placed at the front-left lobe of the heart)
  const bow = create3DBow();
  bow.position.set(-0.42, 0.21, -0.38);
  bow.rotation.set(-0.25, 0.15, -0.2);
  bow.scale.set(1.4, 1.4, 1.4);
  root.add(bow);

  // 4. ANGELIC FLAPPING FEATHERED WINGS
  const wingShape = createWingShape();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelThickness: 0.015,
    bevelSize: 0.015,
  });
  wingGeo.center();

  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffb6c1,
    emissiveIntensity: 0.35,
    roughness: 0.30,
    metalness: 0.05,
  });

  const wingLeft = new THREE.Mesh(wingGeo, wingMat);
  wingLeft.position.set(-0.88, 0.02, -0.05);
  wingLeft.scale.set(1.1, 1.1, 1.1);

  const wingRight = new THREE.Mesh(wingGeo.clone(), wingMat);
  wingRight.position.set(0.88, 0.02, -0.05);
  wingRight.scale.set(-1.1, 1.1, 1.1);

  root.add(wingLeft);
  root.add(wingRight);

  // 5. GLOWING ENERGY CUSHION DISC (AdditiveBlending, transparent, depthWrite: false)
  const glowTex = createGlowTexture('#ff66b2', '#ffffff');
  const glowGeo = new THREE.PlaneGeometry(2.5, 2.5);
  glowGeo.rotateX(-Math.PI / 2);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glowDisc = new THREE.Mesh(glowGeo, glowMat);
  glowDisc.position.set(0, -0.16, 0);
  root.add(glowDisc);

  // 6. CONCENTRIC SHIMMER RING
  const ringGeo = new THREE.RingGeometry(0.95, 1.42, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff1493,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shimmerRing = new THREE.Mesh(ringGeo, ringMat);
  shimmerRing.position.set(0, -0.165, 0);
  root.add(shimmerRing);

  // 7. RADIANT PINK POINT LIGHT (illuminating tracks and trains below)
  const pinkLight = new THREE.PointLight(0xff66cc, 3.2, 8.5);
  pinkLight.position.set(0, -0.32, 0);
  root.add(pinkLight);

  return {
    root,
    heartMesh,
    inlayMesh,
    bow,
    wingLeft,
    wingRight,
    glowDisc,
    shimmerRing,
    pinkLight,
    update(time, dt) {
      // Gentle wing flapping animation
      const flap = Math.sin(time * 7.5);
      wingLeft.rotation.z = flap * 0.24;
      wingRight.rotation.z = -flap * 0.24;
      wingLeft.rotation.y = 0.18 + Math.cos(time * 7.5) * 0.12;
      wingRight.rotation.y = -0.18 - Math.cos(time * 7.5) * 0.12;

      // Subtle aerodynamic pitch/roll bobbing
      heartMesh.rotation.z = Math.sin(time * 3.2) * 0.04;
      heartMesh.rotation.x = Math.sin(time * 4.0) * 0.03;

      // Counter-rotate luminous discs
      glowDisc.rotation.y += dt * 1.8;
      shimmerRing.rotation.y -= dt * 2.4;

      // Pulsing glow aura
      const pulse = Math.sin(time * 6.0);
      glowDisc.scale.set(1.0 + pulse * 0.08, 1.0, 1.0 + pulse * 0.08);
      pinkLight.intensity = 2.8 + Math.sin(time * 8.0) * 0.6;
    },
    dispose() {
      heartGeo.dispose();
      heartMat.dispose();
      inlayGeo.dispose();
      inlayMat.dispose();
      wingGeo.dispose();
      wingMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}

// ------------------------------------------------------------------ MINI 3D HEART PARTICLES POOL
/**
 * Mini 3D extruded hearts that stream behind Hello Kitty as she flies.
 */
class MiniHeartPool {
  constructor(scene, count = 22) {
    this.scene = scene;
    this.pool = [];
    this.active = [];

    const miniShape = createHeartShape(0.14);
    this.geo = new THREE.ExtrudeGeometry(miniShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      steps: 1,
    });
    this.geo.center();

    const colors = [0xff66b2, 0xff1493, 0xff85c2, 0xffffff, 0xff99cc];
    for (let i = 0; i < count; i++) {
      const col = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: 0xff1493,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.08,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        age: 0,
        lifespan: 0.8,
        initialScale: 1.0,
      });
    }
  }

  spawn(x, y, z, runSpeed) {
    let p = this.pool.pop();
    if (!p) {
      if (this.active.length > 0) {
        p = this.active.shift();
      } else {
        return;
      }
    }

    const scale = 0.75 + Math.random() * 0.6;
    p.mesh.scale.set(scale, scale, scale);
    p.initialScale = scale;
    p.mesh.position.set(
      x + (Math.random() - 0.5) * 0.9,
      y - 0.15 + (Math.random() - 0.5) * 0.25,
      z + 0.45 + Math.random() * 0.25
    );
    p.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    // Drifts backwards relative to runner + gentle outward scatter
    p.vel.set(
      (Math.random() - 0.5) * 1.6,
      (Math.random() - 0.2) * 1.2,
      runSpeed * 0.65 + 1.2 + Math.random() * 2.0
    );

    p.rotVel.set(
      (Math.random() - 0.5) * 9.0,
      (Math.random() - 0.5) * 9.0,
      (Math.random() - 0.5) * 9.0
    );

    p.age = 0;
    p.lifespan = 0.65 + Math.random() * 0.35;
    p.mat.opacity = 0.95;
    p.mesh.visible = true;
    this.active.push(p);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      if (p.age >= p.lifespan) {
        p.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
      } else {
        const k = p.age / p.lifespan;
        p.mesh.position.x += p.vel.x * dt;
        p.mesh.position.y += p.vel.y * dt;
        p.mesh.position.z += p.vel.z * dt;

        p.mesh.rotation.x += p.rotVel.x * dt;
        p.mesh.rotation.y += p.rotVel.y * dt;
        p.mesh.rotation.z += p.rotVel.z * dt;

        const s = p.initialScale * Math.max(0, 1.0 - k * 0.85);
        p.mesh.scale.set(s, s, s);
        p.mat.opacity = Math.max(0, 0.95 * (1.0 - k));
      }
    }
  }

  reset() {
    for (const p of this.active) {
      p.mesh.visible = false;
      this.pool.push(p);
    }
    this.active.length = 0;
  }

  dispose() {
    this.reset();
    for (const p of this.pool) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    this.geo.dispose();
    this.pool.length = 0;
  }
}

// ------------------------------------------------------------------ SPARKLE STARDUST SPRITE POOL
/**
 * Luminous pink & white AdditiveBlending sparkles trailing behind the heart.
 */
class SparkleTrailPool {
  constructor(scene, count = 38) {
    this.scene = scene;
    this.pool = [];
    this.active = [];

    const texPink = createGlowTexture('#ff69b4', '#ffffff', 128);
    const texWhite = createGlowTexture('#ffffff', '#ffb6c1', 128);
    this.geo = new THREE.PlaneGeometry(0.24, 0.24);

    for (let i = 0; i < count; i++) {
      const isPink = i % 2 === 0;
      const mat = new THREE.MeshBasicMaterial({
        map: isPink ? texPink : texWhite,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.pool.push({
        mesh,
        mat,
        vel: new THREE.Vector3(),
        age: 0,
        lifespan: 0.6,
        baseScale: 1.0,
      });
    }
  }

  spawn(x, y, z, runSpeed) {
    let s = this.pool.pop();
    if (!s) {
      if (this.active.length > 0) {
        s = this.active.shift();
      } else {
        return;
      }
    }

    const scale = 0.8 + Math.random() * 0.7;
    s.baseScale = scale;
    s.mesh.scale.set(scale, scale, scale);
    s.mesh.position.set(
      x + (Math.random() - 0.5) * 1.2,
      y - 0.12 + (Math.random() - 0.5) * 0.28,
      z + 0.40 + Math.random() * 0.20
    );
    s.mesh.rotation.z = Math.random() * Math.PI * 2;

    s.vel.set(
      (Math.random() - 0.5) * 1.8,
      (Math.random() - 0.3) * 1.0,
      runSpeed * 0.6 + 0.8 + Math.random() * 1.8
    );

    s.age = 0;
    s.lifespan = 0.50 + Math.random() * 0.30;
    s.mat.opacity = 0.95;
    s.mesh.visible = true;
    this.active.push(s);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      s.age += dt;
      if (s.age >= s.lifespan) {
        s.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(s);
      } else {
        const k = s.age / s.lifespan;
        s.mesh.position.x += s.vel.x * dt;
        s.mesh.position.y += s.vel.y * dt;
        s.mesh.position.z += s.vel.z * dt;

        s.mesh.rotation.z += dt * 5.0;
        const twinkle = 0.8 + Math.sin(s.age * 22.0) * 0.25;
        const sc = s.baseScale * (1.0 - k * 0.6) * twinkle;
        s.mesh.scale.set(sc, sc, sc);
        s.mat.opacity = Math.max(0, 0.95 * (1.0 - k));
      }
    }
  }

  reset() {
    for (const s of this.active) {
      s.mesh.visible = false;
      this.pool.push(s);
    }
    this.active.length = 0;
  }

  dispose() {
    this.reset();
    for (const s of this.pool) {
      this.scene.remove(s.mesh);
      s.mat.dispose();
    }
    this.geo.dispose();
    this.pool.length = 0;
  }
}

// ------------------------------------------------------------------ HELLO KITTY SPECIAL SKILL CLASS
export class HelloKittySkill {
  constructor({ scene, player, obstacles, cameraRig, chaser } = {}) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    // Flight parameters
    this.FLY_ALTITUDE = 3.6;          // Clears trains (2.88m) and barriers (0.8m) easily!
    this.TAKEOFF_TIME = 0.85;         // Smooth easing ascent duration
    this.LANDING_TIME = 0.95;         // Gentle cushioning descent duration
    this.DEFAULT_DURATION = 8.0;      // 8.0s skill duration

    this.active = false;
    this.duration = this.DEFAULT_DURATION;
    this.timeRemaining = 0;
    this.maxTime = this.DEFAULT_DURATION;
    this.elapsed = 0;
    this.timeAlive = 0;
    this.currentFlyOffset = 0;
    this._lastSparkleSpawn = 0;
    this._lastHitTime = -Infinity;

    // Build the 3D Chubby Heart Platform and attach to player's root
    this.heartPlatform = createHeartPlatform();
    this.heartPlatform.root.visible = false;
    this.heartPlatform.root.position.set(0, -0.16, 0); // Sits comfortably under player's feet
    if (this.player && this.player.root) {
      this.player.root.add(this.heartPlatform.root);
    }

    // Particle systems attached to world scene
    this.miniHearts = scene ? new MiniHeartPool(scene, 24) : null;
    this.sparkles = scene ? new SparkleTrailPool(scene, 42) : null;

    // Active transient shockwave/burst systems
    this.transientFX = [];

    // Collision absorption hooks setup
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

  get heartSvgIcon() {
    return HEART_SVG_ICON;
  }

  /**
   * Activates the 8.0s Flying Heart Rise skill.
   */
  activate(duration) {
    if (this.active || game.halted || (this.player && this.player.controlsLocked)) {
      return false;
    }

    const dur = (typeof duration === 'number' && duration > 0) ? duration : this.DEFAULT_DURATION;
    this.active = true;
    this.duration = dur;
    this.maxTime = dur;
    this.timeRemaining = dur;
    this.elapsed = 0;
    this.timeAlive = 0;
    this.currentFlyOffset = 0;
    this._lastHitTime = -Infinity;

    // Show heart platform under feet
    this.heartPlatform.root.visible = true;
    if (this.heartPlatform.pinkLight) {
      this.heartPlatform.pinkLight.intensity = 3.2;
    }

    // Clear stumble or overrides
    if (this.player && typeof this.player.clearOverride === 'function') {
      this.player.clearOverride();
    }

    // Drop chaser back
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') {
      this.chaser._dropBack();
    }

    // Camera liftoff shake & sound events
    if (this.cameraRig && typeof this.cameraRig.shake === 'function') {
      this.cameraRig.shake(0.18, 0.28);
    }

    emit('kittyFlyStart', { duration: this.duration });
    emit('specialOn', { mode: 'kitty', duration: this.duration, label: 'FLYING HEART' });
    return true;
  }

  /**
   * Called every frame right before player movement.
   * Smoothly eases player.floorY up to +3.6m to fly over obstacles and trains.
   */
  beforePlayer(dt) {
    if (!this.active && this.currentFlyOffset <= 0) return;

    if (this.active) {
      // Calculate smooth ascent, cruise, and gentle descent easing
      let liftRatio = 1.0;
      if (this.elapsed < this.TAKEOFF_TIME) {
        liftRatio = smoothstep(this.elapsed / this.TAKEOFF_TIME);
      } else if (this.timeRemaining < this.LANDING_TIME) {
        liftRatio = smoothstep(this.timeRemaining / this.LANDING_TIME);
      }

      // Gentle floating bob in mid-air
      const bob = Math.sin(this.timeAlive * 3.5) * 0.08;
      this.currentFlyOffset = (this.FLY_ALTITUDE + bob) * liftRatio;
    } else {
      // Smooth descent back to 0 if deactivated prematurely
      this.currentFlyOffset = Math.max(0, this.currentFlyOffset - dt * 6.0);
    }

    if (this.player) {
      const baseFloor = this.player.floorY || 0;
      this.player.floorY = Math.max(baseFloor + this.currentFlyOffset, this.currentFlyOffset);
      if (this.player.grounded || this.player.y < this.player.floorY) {
        this.player.y = this.player.floorY;
        this.player.vy = 0;
        this.player.grounded = true;
      }
    }
  }

  /**
   * Main per-frame update loop. Supports both update(time, dt) and update(dt).
   */
  update(arg1, arg2) {
    let dt = 0.016;
    let time = this.timeAlive;

    if (typeof arg2 === 'number') {
      time = arg1;
      dt = arg2;
    } else if (typeof arg1 === 'number') {
      dt = arg1;
      time = this.timeAlive + dt;
    }

    this.timeAlive += dt;

    // Update transient burst/shockwave FX
    this._updateTransientFX(dt);

    // Update world particles
    if (this.miniHearts) this.miniHearts.update(dt);
    if (this.sparkles) this.sparkles.update(dt);

    if (!this.active || game.halted) return;

    this.elapsed += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    // Update heart platform visual animations (wings flapping, glowing halo pulse, light flicker)
    this.heartPlatform.update(this.timeAlive, dt);

    // Cute banking tilt when changing lanes
    if (this.player) {
      const laneDelta = (this.player.x - (this.player.lastX || this.player.x));
      this.heartPlatform.root.rotation.z = -laneDelta * 1.8;
    }

    // Stream sparkles & mini 3D hearts from the back of the heart platform
    const runSpeed = (game.state && typeof game.state.speed === 'number') ? game.state.speed : 15;
    const px = this.player ? this.player.x : 0;
    const py = this.player ? this.player.y : this.currentFlyOffset;
    const pz = (this.player && this.player.root) ? this.player.root.position.z : 0;

    // Emit particles at steady frequency
    if (this.timeAlive - this._lastSparkleSpawn > 0.045) {
      this._lastSparkleSpawn = this.timeAlive;
      if (this.sparkles) {
        this.sparkles.spawn(px, py, pz, runSpeed);
        this.sparkles.spawn(px, py, pz, runSpeed);
      }
      if (this.miniHearts && Math.random() < 0.65) {
        this.miniHearts.spawn(px, py, pz, runSpeed);
      }
    }

    // Check expiration: safe soft landing
    if (this.timeRemaining <= 0) {
      this.deactivate(true);
    }
  }

  /**
   * Spawns the Heart Burst Glitter Nova when colliding with or shattering an obstacle.
   */
  spawnHeartBurst(pos) {
    if (!this.scene) return;
    const hitPos = pos ? pos.clone() : new THREE.Vector3(this.player ? this.player.x : 0, 1.2, 0);

    // 1. Multi-layer expanding glowing heart shockwave disc (AdditiveBlending)
    const glowTex = createGlowTexture('#ff1493', '#ffffff', 128);
    const waveGeo = new THREE.PlaneGeometry(3.5, 3.5);
    waveGeo.rotateX(-Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.copy(hitPos);
    this.scene.add(waveMesh);

    // 2. High-intensity flash point light
    const flashLight = new THREE.PointLight(0xff66cc, 6.0, 9.0);
    flashLight.position.copy(hitPos);
    this.scene.add(flashLight);

    this.transientFX.push({
      waveMesh,
      waveMat,
      waveGeo,
      flashLight,
      age: 0,
      duration: 0.45,
    });

    // 3. Radial burst of mini 3D hearts and sparks
    const runSpeed = (game.state && typeof game.state.speed === 'number') ? game.state.speed : 15;
    if (this.miniHearts) {
      for (let i = 0; i < 12; i++) {
        this.miniHearts.spawn(hitPos.x, hitPos.y, hitPos.z, runSpeed * 0.3);
      }
    }
    if (this.sparkles) {
      for (let i = 0; i < 20; i++) {
        this.sparkles.spawn(hitPos.x, hitPos.y, hitPos.z, runSpeed * 0.3);
      }
    }

    // 4. AAA 3D debris shattering via vfxCore
    try {
      shatterObstacle(this.scene, hitPos, {
        color: 0xff66b2,
        emissive: 0xff1493,
        sparkColor: '#ff66b2',
        blastForce: 10.5,
      });
    } catch (e) {
      // Fallback safe
    }
  }

  /**
   * Absorbs collision, creates sparkling heart burst, removes obstacle, grants grace.
   */
  absorbHit(hit) {
    if (!this.active) return false;

    // Debounce to prevent multiple hits within a single frame
    const now = performance.now();
    if (now - this._lastHitTime < 100) return true;
    this._lastHitTime = now;

    // Remove hit obstacle
    if (hit && hit.obstacle && this.obstacles && typeof this.obstacles.remove === 'function') {
      this.obstacles.remove(hit.obstacle);
    }

    // Clear any obstacles in immediate player path
    if (this.obstacles && Array.isArray(this.obstacles.active) && this.player) {
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - this.player.x) <= 2.2 && o.z > -7.0 && (o.z - o.length) < 2.5) {
          this.obstacles.remove(o);
        }
      }
    }

    const hitPos = (hit && hit.position) ? hit.position : new THREE.Vector3(this.player ? this.player.x : 0, 1.2, 0);

    // Heart Burst Nova VFX
    this.spawnHeartBurst(hitPos);

    // Audio & game events
    emit('kittyHeartBurst', { position: hitPos.clone() });
    emit('crash', { position: hitPos.clone() });

    // Camera punch
    if (this.cameraRig && typeof this.cameraRig.shake === 'function') {
      this.cameraRig.shake(0.28, 0.35);
    }

    // Short protection grace
    if (this.obstacles && typeof this.obstacles.grace === 'function') {
      this.obstacles.grace(0.8);
    }

    return true;
  }

  /**
   * Deactivates the skill, performs soft landing, and grants 1.5s protection grace.
   */
  deactivate(expired = false) {
    if (!this.active) return;
    this.active = false;
    this.timeRemaining = 0;

    // Soft landing glitter puff
    if (this.player) {
      const landPos = new THREE.Vector3(this.player.x, 0.2, (this.player.root ? this.player.root.position.z : 0));
      this.spawnHeartBurst(landPos);
    }

    // Hide heart platform
    this.heartPlatform.root.visible = false;
    if (this.heartPlatform.pinkLight) {
      this.heartPlatform.pinkLight.intensity = 0;
    }

    // Player landing safe landing grace period
    if (this.obstacles && typeof this.obstacles.grace === 'function') {
      this.obstacles.grace(1.5);
    }

    emit('kittyFlyEnd');
    emit('specialOff');
  }

  _updateTransientFX(dt) {
    if (!this.transientFX || this.transientFX.length === 0) return;

    for (let i = this.transientFX.length - 1; i >= 0; i--) {
      const fx = this.transientFX[i];
      fx.age += dt;
      if (game.state && game.state.mode === 'running' && !game.halted) {
        const speed = typeof game.state.speed === 'number' ? game.state.speed : 15;
        fx.waveMesh.position.z += speed * dt;
        fx.flashLight.position.z += speed * dt;
      }

      const k = fx.age / fx.duration;
      if (k >= 1.0) {
        if (this.scene) {
          this.scene.remove(fx.waveMesh);
          this.scene.remove(fx.flashLight);
        }
        fx.waveGeo.dispose();
        fx.waveMat.dispose();
        this.transientFX.splice(i, 1);
      } else {
        const s = 0.4 + 2.8 * Math.sin(k * Math.PI * 0.5);
        fx.waveMesh.scale.set(s, s, s);
        fx.waveMat.opacity = Math.max(0, 0.98 * (1.0 - k));
        fx.flashLight.intensity = Math.max(0, 6.0 * (1.0 - k * 1.5));
      }
    }
  }

  reset() {
    if (this.active) this.deactivate(false);
    this.currentFlyOffset = 0;
    this.elapsed = 0;
    this.timeRemaining = 0;
    this.timeAlive = 0;
    this._lastHitTime = -Infinity;

    if (this.miniHearts) this.miniHearts.reset();
    if (this.sparkles) this.sparkles.reset();

    if (this.transientFX && this.transientFX.length > 0) {
      for (const fx of this.transientFX) {
        if (this.scene) {
          this.scene.remove(fx.waveMesh);
          this.scene.remove(fx.flashLight);
        }
        fx.waveGeo.dispose();
        fx.waveMat.dispose();
      }
      this.transientFX.length = 0;
    }
  }

  dispose() {
    this.reset();

    if (this.heartPlatform) {
      if (this.player && this.player.root) {
        this.player.root.remove(this.heartPlatform.root);
      }
      this.heartPlatform.dispose();
    }

    if (this.miniHearts) this.miniHearts.dispose();
    if (this.sparkles) this.sparkles.dispose();
  }
}

// ------------------------------------------------------------------ FACTORY EXPORT
export function createHelloKittySkill(options = {}) {
  return new HelloKittySkill(options);
}

export default createHelloKittySkill;
