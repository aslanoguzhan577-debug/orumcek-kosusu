// toon.js — the shared cartoon look for every character (and the track):
//   toonMaterial(color, opts)          MeshToonMaterial with a 3-step hard gradient
//   addOutline(mesh, thickness, color) thick dark outline (inverted hull)
// Model files (spiderman.js, ironspider.js, venom.js, placeholder.js) use these.
// G3/G4 may refine this file; keep the two function signatures.

import * as THREE from 'three';

// ---------- toon shading ----------

let gradientMap = null;

// 3 brightness steps, NearestFilter so the bands stay hard.
export function getToonGradient() {
  if (gradientMap) return gradientMap;
  const steps = new Uint8Array([90, 175, 255]);
  gradientMap = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

// opts: any MeshToonMaterial parameter (map, emissive, transparent, side ...).
export function toonMaterial(color = 0xffffff, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
    ...opts,
  });
}

// ---------- outline (inverted hull) ----------
// A second copy of the mesh, drawn back faces only, in a dark flat colour,
// pushed outward along its normals. It is added as a child of the mesh, so it
// follows every animation. Materials are cached per thickness + colour.
//
// Boxes have split normals (pushing faces apart would open cracks at the corners),
// so box geometries are scaled up around their centre instead.

const outlineMaterials = new Map();

function getOutlineMaterial(thickness, color) {
  const key = thickness + '|' + color;
  let mat = outlineMaterials.get(key);
  if (mat) return mat;
  mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.userData.outlineThickness = { value: thickness };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = mat.userData.outlineThickness;
    shader.vertexShader = 'uniform float outlineThickness;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      'vec3 transformed = vec3( position ) + normalize( normal ) * outlineThickness;'
    );
  };
  mat.customProgramCacheKey = () => 'toon-outline';
  outlineMaterials.set(key, mat);
  return mat;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

// thickness in the mesh's local units (metres for unscaled meshes).
export function addOutline(mesh, thickness = 0.025, color = 0x111111) {
  const geo = mesh.geometry;
  let outline;
  if (geo.type === 'BoxGeometry') {
    outline = new THREE.Mesh(geo, getOutlineMaterial(0, color));
    if (!geo.boundingBox) geo.computeBoundingBox();
    _box.copy(geo.boundingBox);
    _box.getSize(_size);
    _box.getCenter(_center);
    const sx = (_size.x + thickness * 2) / Math.max(_size.x, 1e-4);
    const sy = (_size.y + thickness * 2) / Math.max(_size.y, 1e-4);
    const sz = (_size.z + thickness * 2) / Math.max(_size.z, 1e-4);
    outline.scale.set(sx, sy, sz);
    outline.position.set(_center.x * (1 - sx), _center.y * (1 - sy), _center.z * (1 - sz));
  } else {
    outline = new THREE.Mesh(geo, getOutlineMaterial(thickness, color));
  }
  outline.name = 'outline';
  outline.userData.isOutline = true;
  outline.raycast = () => {}; // never hit by picking
  mesh.add(outline);
  return outline;
}
