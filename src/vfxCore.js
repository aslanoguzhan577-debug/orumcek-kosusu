// vfxCore.js — Advanced AAA Visual Effects Architecture for Örümcek Koşusu
// High-performance Three.js visual effects engine with particle pools, glowing textures,
// 3D physics-based obstacle shattering, dynamic camera FOV/shake, dynamic flash lights,
// and multi-layer energy beams.

import * as THREE from 'three';

// ------------------------------------------------------------------ GLOW TEXTURE GENERATOR
const glowTextureCache = new Map();

/**
 * Creates or retrieves a radial gradient glow texture with soft exponential falloff.
 * 128x128 Canvas, createRadialGradient, AdditiveBlending-ready RGBA CanvasTexture.
 * Signature supports both (primaryColor, coreColor) and (coreColor, outerColor).
 */
export function createGlowTexture(primaryColor = '#ffffff', coreColor = '#ffffff', size = 128) {
  const key = `${primaryColor}_${coreColor}_${size}`;
  if (glowTextureCache.has(key)) {
    return glowTextureCache.get(key);
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, coreColor);
  grad.addColorStop(0.35, primaryColor);
  grad.addColorStop(0.7, primaryColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  glowTextureCache.set(key, tex);
  return tex;
}

// ------------------------------------------------------------------ 3D OBSTACLE SHATTER ENGINE
export const activeDebrisSystems = [];

/**
 * Shatters an obstacle into 22+ 3D debris pieces (DodecahedronGeometry/BoxGeometry)
 * and 35 AdditiveBlending spark sprites with blast velocity, gravity (-26 m/s²), and 3-axis rotation.
 * Automatically disposed after 1.2 seconds.
 * Supports both signatures:
 *   shatterObstacle(scene, position, accentColor)
 *   shatterObstacle(scene, obstacle, options)
 */
export function shatterObstacle(scene, posOrObstacle, accentOrOptions = {}) {
  if (!scene || !posOrObstacle) return;

  let center = new THREE.Vector3();
  let baseColor = 0x8899aa;
  let emissiveColor = 0x000000;
  let sparkColor = '#ffaa33';
  let blastForce = 9.5;

  if (posOrObstacle instanceof THREE.Vector3 || (typeof posOrObstacle.x === 'number' && typeof posOrObstacle.z === 'number' && !posOrObstacle.parts)) {
    center.set(posOrObstacle.x, posOrObstacle.y != null ? posOrObstacle.y : 1.0, posOrObstacle.z);
    if (typeof accentOrOptions === 'number' || typeof accentOrOptions === 'string') {
      baseColor = accentOrOptions;
      emissiveColor = accentOrOptions;
      sparkColor = accentOrOptions;
    } else if (accentOrOptions && typeof accentOrOptions === 'object') {
      baseColor = accentOrOptions.color || 0x8899aa;
      emissiveColor = accentOrOptions.emissive || baseColor;
      sparkColor = accentOrOptions.sparkColor || '#ffaa33';
      blastForce = accentOrOptions.blastForce || 9.5;
    }
  } else {
    const ob = posOrObstacle;
    center.set(ob.x || 0, ob.y || 1.0, ob.z || 0);
    const opts = typeof accentOrOptions === 'object' ? accentOrOptions : {};
    baseColor = opts.color || ob.color || 0x8899aa;
    emissiveColor = opts.emissive || (typeof accentOrOptions === 'number' ? accentOrOptions : 0x000000);
    sparkColor = opts.sparkColor || '#ffaa33';
    blastForce = opts.blastForce || 9.5;
  }

  const group = new THREE.Group();
  group.position.copy(center);
  scene.add(group);

  const pieces = [];
  const geometries = [
    new THREE.DodecahedronGeometry(0.18),
    new THREE.BoxGeometry(0.22, 0.22, 0.22),
    new THREE.DodecahedronGeometry(0.13),
  ];

  const pieceMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: emissiveColor,
    emissiveIntensity: 0.9,
    roughness: 0.35,
    metalness: 0.4,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });

  // 22 3D debris fragments
  for (let i = 0; i < 22; i++) {
    const geo = geometries[i % geometries.length];
    const mesh = new THREE.Mesh(geo, pieceMat.clone());

    const rx = (Math.random() - 0.5) * 1.5;
    const ry = (Math.random() - 0.2) * 1.6;
    const rz = (Math.random() - 0.5) * 1.5;
    mesh.position.set(rx, ry, rz);

    const dir = new THREE.Vector3(rx, ry + 0.5, rz).normalize();
    const speed = blastForce * (0.65 + Math.random() * 0.85);
    const vel = dir.multiplyScalar(speed);
    vel.y += 3.8 + Math.random() * 4.2;

    const rotVel = new THREE.Vector3(
      (Math.random() - 0.5) * 18.0,
      (Math.random() - 0.5) * 18.0,
      (Math.random() - 0.5) * 18.0
    );

    group.add(mesh);
    pieces.push({ mesh, vel, rotVel });
  }

  // 35 AdditiveBlending luminous spark particles
  const sparkGeo = new THREE.PlaneGeometry(0.20, 0.20);
  const sparkHex = typeof sparkColor === 'number' ? `#${sparkColor.toString(16).padStart(6, '0')}` : sparkColor;
  const sparkTex = createGlowTexture(sparkHex, '#ffffff');
  const sparkMat = new THREE.MeshBasicMaterial({
    map: sparkTex,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const sparks = [];
  for (let i = 0; i < 35; i++) {
    const sMesh = new THREE.Mesh(sparkGeo, sparkMat.clone());
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2.0,
      Math.random() * 2.0 + 0.2,
      (Math.random() - 0.5) * 2.0
    ).normalize();
    const vel = dir.multiplyScalar(blastForce * 1.35 * (0.8 + Math.random() * 0.7));
    group.add(sMesh);
    sparks.push({ mesh: sMesh, vel });
  }

  activeDebrisSystems.push({
    group,
    pieces,
    sparks,
    geometries,
    age: 0,
    duration: 1.2,
    scene,
  });
}

/**
 * Updates all active shatter debris systems.
 */
export function updateShatterDebris(dt, scrollSpeed = 0) {
  const gravity = -26.0;

  for (let sIdx = activeDebrisSystems.length - 1; sIdx >= 0; sIdx--) {
    const sys = activeDebrisSystems[sIdx];
    sys.age += dt;

    if (scrollSpeed > 0) {
      sys.group.position.z += scrollSpeed * dt;
    }

    const lifeProgress = sys.age / sys.duration;
    const fade = Math.max(0, 1.0 - Math.pow(lifeProgress, 1.4));

    // Update chunks
    for (let i = 0; i < sys.pieces.length; i++) {
      const p = sys.pieces[i];
      p.vel.y += gravity * dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;
      p.mesh.rotation.z += p.rotVel.z * dt;

      p.mesh.scale.setScalar(Math.max(0.01, fade));
      p.mesh.material.opacity = fade;
    }

    // Update sparks
    for (let i = 0; i < sys.sparks.length; i++) {
      const sp = sys.sparks[i];
      sp.vel.y += gravity * 0.45 * dt;
      sp.mesh.position.x += sp.vel.x * dt;
      sp.mesh.position.y += sp.vel.y * dt;
      sp.mesh.position.z += sp.vel.z * dt;
      sp.mesh.scale.setScalar(Math.max(0.01, fade * 1.2));
      sp.mesh.material.opacity = fade;
    }

    // Dispose and remove when expired
    if (sys.age >= sys.duration) {
      if (sys.scene) sys.scene.remove(sys.group);
      sys.pieces.forEach(p => {
        p.mesh.material.dispose();
      });
      sys.sparks.forEach(s => {
        s.mesh.material.dispose();
      });
      sys.geometries.forEach(g => g.dispose());
      activeDebrisSystems.splice(sIdx, 1);
    }
  }
}

// ------------------------------------------------------------------ FLASH POINT LIGHT
const activeFlashLights = [];

/**
 * Triggers a temporary dynamic THREE.PointLight burst that softly fades.
 */
export function triggerFlashLight(scene, position, color = 0xffffff, intensity = 5.0, duration = 0.4) {
  if (!scene) return null;
  const light = new THREE.PointLight(color, intensity, 18);
  if (position instanceof THREE.Vector3) {
    light.position.copy(position);
  } else if (position && typeof position.x === 'number') {
    light.position.set(position.x, position.y || 1.0, position.z || 0);
  }
  scene.add(light);

  const entry = {
    light,
    scene,
    initialIntensity: intensity,
    duration,
    age: 0,
  };
  activeFlashLights.push(entry);
  return light;
}

export function updateFlashLights(dt) {
  for (let i = activeFlashLights.length - 1; i >= 0; i--) {
    const fl = activeFlashLights[i];
    fl.age += dt;
    const progress = fl.age / fl.duration;
    if (progress >= 1.0) {
      if (fl.scene) fl.scene.remove(fl.light);
      fl.light.dispose();
      activeFlashLights.splice(i, 1);
    } else {
      fl.light.intensity = fl.initialIntensity * Math.max(0, 1.0 - progress);
    }
  }
}

// ------------------------------------------------------------------ CAMERA SHAKE & FOV CONTROLLER
let activeFovTween = null;

export function triggerCameraFov(camera, targetFov, duration = 0.35, onComplete = null) {
  if (!camera) return;
  const startFov = camera.fov;
  activeFovTween = {
    camera,
    startFov,
    targetFov,
    duration,
    elapsed: 0,
    onComplete,
  };
}

export function updateCameraFov(dt) {
  if (!activeFovTween) return;
  const tw = activeFovTween;
  tw.elapsed += dt;
  const t = Math.min(1.0, tw.elapsed / tw.duration);
  const ease = 1 - Math.pow(1 - t, 3);
  tw.camera.fov = THREE.MathUtils.lerp(tw.startFov, tw.targetFov, ease);
  tw.camera.updateProjectionMatrix();

  if (t >= 1.0) {
    if (tw.onComplete) tw.onComplete();
    activeFovTween = null;
  }
}

export function triggerCameraShake(cameraRig, strength = 0.35, duration = 0.35) {
  if (cameraRig && typeof cameraRig.shake === 'function') {
    cameraRig.shake(strength, duration);
  }
}

// ------------------------------------------------------------------ 3-LAYER ENERGY BEAM BUILDER
export function create3LayerUnibeam(length = 200, radius = 0.55, plasmaColor = 0x00e5ff) {
  const root = new THREE.Group();
  root.name = 'unibeam3Layer';

  // 1. White Core Cylinder
  const coreGeo = new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, length, 16, 1, true);
  coreGeo.rotateX(Math.PI / 2);
  coreGeo.translate(0, 0, -length / 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  root.add(coreMesh);

  // 2. Pulsing Cyan Plasma Cylinder
  const plasmaGeo = new THREE.CylinderGeometry(radius, radius * 1.25, length, 24, 1, true);
  plasmaGeo.rotateX(Math.PI / 2);
  plasmaGeo.translate(0, 0, -length / 2);
  const plasmaMat = new THREE.MeshBasicMaterial({
    color: plasmaColor,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plasmaMesh = new THREE.Mesh(plasmaGeo, plasmaMat);
  root.add(plasmaMesh);

  // 3. 12 Forward-Traveling Torus Shock Rings
  const ringCount = 12;
  const torusGeo = new THREE.TorusGeometry(radius * 1.6, 0.08, 12, 28);
  const torusMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.Mesh(torusGeo, torusMat.clone());
    ring.position.z = -(i / ringCount) * length;
    root.add(ring);
    rings.push(ring);
  }

  // Chest dynamic burst PointLight
  const unibeamLight = new THREE.PointLight(plasmaColor, 6.0, 35);
  unibeamLight.position.set(0, 0, -2);
  root.add(unibeamLight);

  return {
    root,
    coreMesh,
    plasmaMesh,
    rings,
    unibeamLight,
    update(time, dt) {
      const pulse = 1.0 + Math.sin(time * 30) * 0.18;
      coreMesh.scale.set(pulse, pulse, 1.0);
      plasmaMesh.scale.set(1.0 + Math.cos(time * 24) * 0.22, 1.0 + Math.cos(time * 24) * 0.22, 1.0);
      plasmaMat.opacity = 0.65 + Math.sin(time * 35) * 0.25;

      const ringSpeed = 160.0;
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        ring.position.z -= ringSpeed * dt;
        if (ring.position.z < -length) {
          ring.position.z += length;
        }
        const depthRatio = Math.abs(ring.position.z) / length;
        ring.scale.setScalar(1.0 + depthRatio * 1.5);
        ring.material.opacity = (1.0 - depthRatio * 0.7) * (0.6 + Math.random() * 0.4);
      }

      unibeamLight.intensity = 5.0 + Math.sin(time * 40) * 2.5;
    },
    dispose() {
      root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    },
  };
}
