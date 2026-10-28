// toon.js — the shared cartoon look for every character (and the track):
//   toonMaterial(color, opts)          MeshToonMaterial with a 3-step hard gradient
//                                      (+ optional opts.rim / opts.gloss cartoon highlights)
//   addOutline(mesh, thickness, color) thick dark outline (inverted hull), works for InstancedMesh too
// Character helpers (G3/G4):
//   canvasTexture(w, h, draw)          texture drawn with the 2D canvas API
//   smoothLathe(profile, opts)         smooth body part from a [radius, y] profile
//   facePatch(...)                     curved patch that hugs a round head (eyes, mouth decals)
//   TubeShape                          tapered tube along points (tongue, claws), re-shapable per frame
//   PoseBlend                          blends between animation poses over ~0.12 s
// Model files (spiderman.js, ironspider.js, venom.js, placeholder.js) use these.

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

// opts: any MeshToonMaterial parameter (map, emissive, transparent, side ...), plus
//   rim:   { color, threshold = 0.62, strength = 1 }   hard cartoon rim light on the silhouette
//   gloss: { color, threshold = 0.94, strength = 1 }   hard "wet" highlight (fixed in view space)
export function toonMaterial(color = 0xffffff, opts = {}) {
  const { rim, gloss, ...rest } = opts;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
    ...rest,
  });
  if (rim || gloss) addToonFx(mat, rim, gloss);
  return mat;
}

const GLOSS_DIR = new THREE.Vector3(-0.45, 0.65, 0.62).normalize(); // view space, upper left

function addToonFx(mat, rim, gloss) {
  const u = {
    fxRimColor: { value: new THREE.Color(rim ? rim.color ?? 0xffffff : 0x000000) },
    fxRimThreshold: { value: rim ? rim.threshold ?? 0.62 : 2 },
    fxRimStrength: { value: rim ? rim.strength ?? 1 : 0 },
    fxGlossColor: { value: new THREE.Color(gloss ? gloss.color ?? 0xffffff : 0xffffff) },
    fxGlossThreshold: { value: gloss ? gloss.threshold ?? 0.94 : 2 },
    fxGlossStrength: { value: gloss ? gloss.strength ?? 1 : 0 },
    fxGlossDir: { value: GLOSS_DIR },
  };
  mat.userData.fx = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader =
      'uniform vec3 fxRimColor;\nuniform float fxRimThreshold;\nuniform float fxRimStrength;\n' +
      'uniform vec3 fxGlossColor;\nuniform float fxGlossThreshold;\nuniform float fxGlossStrength;\nuniform vec3 fxGlossDir;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{
          vec3 fxN = normalize( normal );
          vec3 fxV = normalize( vViewPosition );
          float fxR = 1.0 - clamp( dot( fxN, fxV ), 0.0, 1.0 );
          outgoingLight += fxRimColor * fxRimStrength * smoothstep( fxRimThreshold, fxRimThreshold + 0.03, fxR );
          float fxS = dot( fxN, normalize( fxGlossDir + fxV ) );
          outgoingLight = mix( outgoingLight, fxGlossColor, fxGlossStrength * smoothstep( fxGlossThreshold, fxGlossThreshold + 0.008, fxS ) );
        }
        #include <opaque_fragment>`
      );
  };
  mat.customProgramCacheKey = () => 'toon-fx';
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
  if (mesh.isInstancedMesh) {
    // shares the instance matrices, so it follows every instance
    outline = new THREE.InstancedMesh(geo, getOutlineMaterial(thickness, color), mesh.count);
    outline.instanceMatrix = mesh.instanceMatrix;
    outline.frustumCulled = false;
  } else if (geo.type === 'BoxGeometry') {
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

// ---------- character helpers ----------

// A texture painted with the 2D canvas API: draw(ctx, w, h). Canvas y=0 is texture v=1.
export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Smooth round body part: profile = [[radius, y], ...] from bottom to top (first and
// last radius 0 = closed ends). The profile is smoothed and resampled evenly by arc
// length so a texture is not stretched. UV: u around (u = 0.5 faces -Z, the front;
// u = 0.25 faces +X), v = 0 at the bottom, 1 at the top.
// Returns the geometry; geometry.userData.vOfY(y) gives v at height y on the front.
export function smoothLathe(profile, { segments = 16, samples = 16, scaleX = 1, scaleZ = 1 } = {}) {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getSpacedPoints(samples);
  for (const p of pts) p.x = Math.max(p.x, 0);
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  const geo = new THREE.LatheGeometry(pts, segments);
  if (scaleX !== 1 || scaleZ !== 1) geo.scale(scaleX, 1, scaleZ);
  const ys = pts.map((p) => p.y);
  geo.userData.arcLength = curve.getLength();
  geo.userData.vOfY = (y) => {
    if (y <= ys[0]) return 0;
    for (let i = 1; i < ys.length; i++) {
      if (y <= ys[i]) return (i - 1 + (y - ys[i - 1]) / Math.max(ys[i] - ys[i - 1], 1e-6)) / (ys.length - 1);
    }
    return 1;
  };
  return geo;
}

// Curved patch lying on the front (-Z) of a sphere of radius `radius` centred at the
// origin, for face decals. The patch spans angles a (left/right, radians, + = viewer's
// right) in [a0, a1] and b (up/down) in [b0, b1]. The texture is seen unmirrored from
// the front. deform(v) may reshape points exactly like the head mesh was reshaped.
export function facePatch(radius, a0, a1, b0, b1, offset = 0.004, { segX = 16, segY = 8, deform = null } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1, segX, segY);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const a = a0 + (pos.getX(i) + 0.5) * (a1 - a0);
    const b = b0 + (pos.getY(i) + 0.5) * (b1 - b0);
    v.set(-Math.sin(a) * Math.cos(b), Math.sin(b), -Math.cos(a) * Math.cos(b)).multiplyScalar(radius + offset);
    if (deform) deform(v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Recomputes normals and gives vertices that share a position (UV seams, poles) one
// averaged normal, so the outline shell has no cracks after a mesh was reshaped.
export function smoothNormals(geo) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(i);
  }
  const n = new THREE.Vector3();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of g) n.x += nor.getX(i), n.y += nor.getY(i), n.z += nor.getZ(i);
    n.normalize();
    for (const i of g) nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
  return geo;
}

// Merges indexed geometries that have position, normal and uv into one (fewer draw calls).
export function mergeGeos(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const index = new (vCount > 65535 ? Uint32Array : Uint16Array)(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) index[io + i] = src[i] + vo;
      io += src.length;
    } else {
      for (let i = 0; i < n; i++) index[io + i] = vo + i;
      io += n;
    }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

// Tapered tube through a list of points (tongue, claws, tendrils). Call
// set(points, radii) whenever the shape should change (cheap, reuses buffers).
export class TubeShape {
  constructor(count, radial = 7) {
    this.count = count;
    this.radial = radial;
    const verts = count * (radial + 1) + 1; // + tip
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    const uv = new Float32Array(verts * 2);
    const index = [];
    for (let i = 0; i < count; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        uv[k * 2] = j / radial;
        uv[k * 2 + 1] = i / (count - 1);
        if (i < count - 1 && j < radial) {
          const a = k, b = k + radial + 1, c = k + 1, d = k + radial + 2;
          index.push(a, c, b, c, d, b);
        }
      }
    }
    const tip = verts - 1;
    const last = (count - 1) * (radial + 1);
    for (let j = 0; j < radial; j++) index.push(last + j, last + j + 1, tip);
    uv[tip * 2] = 0.5;
    uv[tip * 2 + 1] = 1;
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(index);
    this._t = new THREE.Vector3();
    this._n = new THREE.Vector3(1, 0, 0);
    this._b = new THREE.Vector3();
    this._d = new THREE.Vector3();
  }

  set(points, radii, tipLength = 0.6) {
    const pos = this.geometry.attributes.position.array;
    const nor = this.geometry.attributes.normal.array;
    const { count, radial } = this;
    const T = this._t, N = this._n, B = this._b, D = this._d;
    N.set(1, 0, 0);
    for (let i = 0; i < count; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[Math.min(i + 1, count - 1)];
      T.subVectors(p1, p0).normalize();
      // parallel transport of the side vector keeps the tube from twisting
      N.addScaledVector(T, -N.dot(T));
      if (N.lengthSq() < 1e-6) N.set(0, 0, 1).addScaledVector(T, -T.z);
      N.normalize();
      B.crossVectors(T, N);
      const p = points[i];
      const r = radii[i];
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        D.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        const k = (i * (radial + 1) + j) * 3;
        pos[k] = p.x + D.x * r;
        pos[k + 1] = p.y + D.y * r;
        pos[k + 2] = p.z + D.z * r;
        nor[k] = D.x;
        nor[k + 1] = D.y;
        nor[k + 2] = D.z;
      }
    }
    // rounded tip a little beyond the last point
    const pl = points[count - 1];
    const k = (count * (radial + 1)) * 3;
    pos[k] = pl.x + T.x * radii[count - 1] * tipLength;
    pos[k + 1] = pl.y + T.y * radii[count - 1] * tipLength;
    pos[k + 2] = pl.z + T.z * radii[count - 1] * tipLength;
    nor[k] = T.x;
    nor[k + 1] = T.y;
    nor[k + 2] = T.z;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
}

// Blends animation poses. A pose is a flat object of numbers.
//   const blend = new PoseBlend(defaults, 0.12);
//   on state change: blend.start();
//   every frame: const t = blend.target(); ...fill t...; const pose = blend.finish(dt);
// The new pose fades in from a frozen copy of the last shown pose (smoothstep), so a
// looping animation keeps its full swing and states never snap.
export class PoseBlend {
  constructor(defaults, time = 0.12) {
    this.defaults = { ...defaults };
    this.time = time;
    this.out = { ...defaults };
    this.from = { ...defaults };
    this.goal = { ...defaults };
    this.w = 1;
  }
  start() {
    Object.assign(this.from, this.out);
    this.w = 0;
  }
  target() {
    return Object.assign(this.goal, this.defaults);
  }
  finish(dt) {
    this.w = Math.min(1, this.w + dt / this.time);
    const s = this.w * this.w * (3 - 2 * this.w);
    for (const k in this.out) this.out[k] = this.from[k] + (this.goal[k] - this.from[k]) * s;
    return this.out;
  }
}
