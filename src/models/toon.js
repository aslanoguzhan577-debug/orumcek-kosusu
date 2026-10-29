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

// Soft "vinyl toy" ramp for the characters (opts.shade = 'soft'): still a toon terminator,
// but a smooth one, so rounded vinyl forms read instead of flat bands.
let softGradientMap = null;
export function getSoftGradient() {
  if (softGradientMap) return softGradientMap;
  const n = 32;
  const steps = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const s = THREE.MathUtils.smoothstep(x, 0.3, 0.72);
    steps[i] = Math.round(255 * (0.4 + 0.6 * s));
  }
  softGradientMap = new THREE.DataTexture(steps, n, 1, THREE.RedFormat);
  softGradientMap.minFilter = THREE.LinearFilter;
  softGradientMap.magFilter = THREE.LinearFilter;
  softGradientMap.generateMipmaps = false;
  softGradientMap.needsUpdate = true;
  return softGradientMap;
}

// opts: any MeshToonMaterial parameter (map, emissive, transparent, side ...), plus
//   shade: 'soft'                                       smooth vinyl ramp instead of 3 hard steps
//   rim:   { color, threshold = 0.62, strength = 1, soft = 0.03 }   rim light on the silhouette
//   gloss: { color, threshold = 0.94, strength = 1, soft = 0.008 }  "wet" highlight (fixed in
//          view space, upper left; mixes toward color, hard edge unless soft is raised)
//   sheen: { color, threshold = 0.6, strength = 0.3, soft = 0.35 }  broad soft satin highlight
//          (added, same direction as gloss)
export function toonMaterial(color = 0xffffff, opts = {}) {
  const { rim, gloss, sheen, shade, ...rest } = opts;
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: shade === 'soft' ? getSoftGradient() : getToonGradient(),
    ...rest,
  });
  if (rim || gloss || sheen) addToonFx(mat, rim, gloss, sheen);
  return mat;
}

const GLOSS_DIR = new THREE.Vector3(-0.45, 0.65, 0.62).normalize(); // view space, upper left

function addToonFx(mat, rim, gloss, sheen) {
  const u = {
    fxRimColor: { value: new THREE.Color(rim ? rim.color ?? 0xffffff : 0x000000) },
    fxRimThreshold: { value: rim ? rim.threshold ?? 0.62 : 2 },
    fxRimStrength: { value: rim ? rim.strength ?? 1 : 0 },
    fxRimSoft: { value: rim ? rim.soft ?? 0.03 : 0.03 },
    fxGlossColor: { value: new THREE.Color(gloss ? gloss.color ?? 0xffffff : 0xffffff) },
    fxGlossThreshold: { value: gloss ? gloss.threshold ?? 0.94 : 2 },
    fxGlossStrength: { value: gloss ? gloss.strength ?? 1 : 0 },
    fxGlossSoft: { value: gloss ? gloss.soft ?? 0.008 : 0.008 },
    fxGlossDir: { value: gloss && gloss.dir ? gloss.dir.clone().normalize() : GLOSS_DIR },
    fxSheenColor: { value: new THREE.Color(sheen ? sheen.color ?? 0xffffff : 0x000000) },
    fxSheenThreshold: { value: sheen ? sheen.threshold ?? 0.6 : 2 },
    fxSheenStrength: { value: sheen ? sheen.strength ?? 0.3 : 0 },
    fxSheenSoft: { value: sheen ? sheen.soft ?? 0.35 : 0.35 },
  };
  mat.userData.fx = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader =
      'uniform vec3 fxRimColor;\nuniform float fxRimThreshold;\nuniform float fxRimStrength;\nuniform float fxRimSoft;\n' +
      'uniform vec3 fxGlossColor;\nuniform float fxGlossThreshold;\nuniform float fxGlossStrength;\nuniform float fxGlossSoft;\nuniform vec3 fxGlossDir;\n' +
      'uniform vec3 fxSheenColor;\nuniform float fxSheenThreshold;\nuniform float fxSheenStrength;\nuniform float fxSheenSoft;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{
          vec3 fxN = normalize( normal );
          vec3 fxV = normalize( vViewPosition );
          float fxR = 1.0 - clamp( dot( fxN, fxV ), 0.0, 1.0 );
          outgoingLight += fxRimColor * fxRimStrength * smoothstep( fxRimThreshold, fxRimThreshold + fxRimSoft, fxR );
          float fxS = dot( fxN, normalize( fxGlossDir + fxV ) );
          outgoingLight += fxSheenColor * fxSheenStrength * smoothstep( fxSheenThreshold, fxSheenThreshold + fxSheenSoft, fxS );
          outgoingLight = mix( outgoingLight, fxGlossColor, fxGlossStrength * smoothstep( fxGlossThreshold, fxGlossThreshold + fxGlossSoft, fxS ) );
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

// ---------- textures baked from the 3D surface ----------
// A "grid" reads the surface point under any (u, v) of a lathe or a UV sphere, so a texture
// can be painted in model space (front / back projections, directions on a head) instead of
// in the stretched UV space: grid.at(u, v, p, n?) fills position p (and normal n if given).

function makeGrid(geo, cols, rows, idx) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array;
  return {
    at(u, v, p, n) {
      const fu = Math.min(Math.max(u, 0), 1) * cols, fv = Math.min(Math.max(v, 0), 1) * rows;
      const i0 = Math.min(Math.floor(fu), cols - 1), j0 = Math.min(Math.floor(fv), rows - 1);
      const a = fu - i0, b = fv - j0;
      const k00 = idx(i0, j0) * 3, k10 = idx(i0 + 1, j0) * 3, k01 = idx(i0, j0 + 1) * 3, k11 = idx(i0 + 1, j0 + 1) * 3;
      const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
      p.set(
        P[k00] * w00 + P[k10] * w10 + P[k01] * w01 + P[k11] * w11,
        P[k00 + 1] * w00 + P[k10 + 1] * w10 + P[k01 + 1] * w01 + P[k11 + 1] * w11,
        P[k00 + 2] * w00 + P[k10 + 2] * w10 + P[k01 + 2] * w01 + P[k11 + 2] * w11
      );
      if (n) {
        n.set(
          N[k00] * w00 + N[k10] * w10 + N[k01] * w01 + N[k11] * w11,
          N[k00 + 1] * w00 + N[k10 + 1] * w10 + N[k01 + 1] * w01 + N[k11 + 1] * w11,
          N[k00 + 2] * w00 + N[k10 + 2] * w10 + N[k01 + 2] * w01 + N[k11 + 2] * w11
        ).normalize();
      }
      return p;
    },
  };
}

// grid for a (smooth)LatheGeometry, also after boxify / scaling / deforming its vertices
export function latheGrid(geo) {
  const S = geo.parameters.segments, n = geo.parameters.points.length;
  return makeGrid(geo, S, n - 1, (i, j) => i * n + j);
}

// grid for a SphereGeometry (u around, v = 1 at the top), also after reshaping its vertices
export function sphereGrid(geo) {
  const W = geo.parameters.widthSegments, H = geo.parameters.heightSegments;
  return makeGrid(geo, W, H, (i, j) => (H - j) * (W + 1) + i);
}

// Paints `count` textures of W x H texels at once: paint(outs, u, v) is called for every
// texel (u, v as in the geometry's UVs) and fills outs[k] = [r, g, b] (0..255, start black).
// Use a grid (latheGrid / sphereGrid) inside paint to find the surface point under (u, v).
export function bakeTextures(W, H, paint, count = 1) {
  const canvases = [], datas = [], imgs = [], outs = [];
  for (let k = 0; k < count; k++) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const img = c.getContext('2d').createImageData(W, H);
    canvases.push(c);
    imgs.push(img);
    datas.push(img.data);
    outs.push([0, 0, 0]);
  }
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      for (let k = 0; k < count; k++) { const o = outs[k]; o[0] = 0; o[1] = 0; o[2] = 0; }
      paint(outs, (x + 0.5) / W, v);
      const i = (y * W + x) * 4;
      for (let k = 0; k < count; k++) {
        const d = datas[k], o = outs[k];
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
      }
    }
  }
  return canvases.map((c, k) => {
    c.getContext('2d').putImageData(imgs[k], 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  });
}

// unit direction from the centre of a UV sphere (pole up) for texture coordinates u, v
export function sphereDir(u, v, out) {
  const th = (1 - v) * Math.PI, ph = u * Math.PI * 2, st = Math.sin(th);
  return out.set(-Math.cos(ph) * st, Math.cos(th), Math.sin(ph) * st);
}

// A flat picture drawn with the 2D canvas API over the rectangle x0..x1, y0..y1 (model
// metres) of a front or back view, read back per texel by bakeTextures. draw(g, toPx, k):
// toPx(x, y) gives canvas pixels for model-space x, y; k = pixels per metre.
// view 'front' is seen from -Z (model +X on the left), 'back' from +Z.
export function flatPicture(x0, x1, y0, y1, pxPerM, view, draw) {
  const W = Math.round((x1 - x0) * pxPerM), H = Math.round((y1 - y0) * pxPerM);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const front = view === 'front';
  const toPx = (x, y) => [front ? (x1 - x) * pxPerM : (x - x0) * pxPerM, (y1 - y) * pxPerM];
  draw(g, toPx, pxPerM, W, H);
  const data = g.getImageData(0, 0, W, H).data;
  return {
    // blends the picture at model point (x, y) over out (rgb 0..255); returns its alpha
    over(x, y, out) {
      const fx = (front ? (x1 - x) : (x - x0)) * pxPerM - 0.5, fy = (y1 - y) * pxPerM - 0.5;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      if (ix < -1 || iy < -1 || ix >= W || iy >= H) return 0;
      const ax = fx - ix, ay = fy - iy;
      let r = 0, gg = 0, b = 0, a = 0;
      for (let q = 0; q < 4; q++) {
        const sx = ix + (q & 1), sy = iy + (q >> 1);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const w = ((q & 1) ? ax : 1 - ax) * ((q >> 1) ? ay : 1 - ay);
        const i = (sy * W + sx) * 4;
        const al = data[i + 3] / 255 * w;
        r += data[i] * al; gg += data[i + 1] * al; b += data[i + 2] * al; a += al;
      }
      if (a <= 0) return 0;
      out[0] = out[0] * (1 - a) + r;
      out[1] = out[1] * (1 - a) + gg;
      out[2] = out[2] * (1 - a) + b;
      return a;
    },
  };
}

// Tapered stroke along a quadratic curve p0 -> (c) -> p2 (pixels), widths w0 -> w1 (pixels).
export function taperCurve(g, p0, c, p2, w0, w1, n = 28) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1];
    let tx = 2 * u * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]);
    let ty = 2 * u * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]);
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push([x - ty * w, y + tx * w]);
    R.push([x + ty * w, y - tx * w]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (const p of L) g.lineTo(p[0], p[1]);
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(p0[0], p0[1], w0 / 2, 0, Math.PI * 2);
  g.fill();
}

// '#rrggbb' -> [r, g, b]
export function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
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

// Funko-style shaping. roundCube(v, n): pushes a point of a sphere (centred at the origin)
// out toward a rounded cube; n = 2 keeps the sphere, higher n = boxier (3 = soft cube).
export function roundCube(v, n = 3) {
  const len = v.length();
  if (len < 1e-9) return v;
  const k = Math.pow(
    Math.pow(Math.abs(v.x) / len, n) + Math.pow(Math.abs(v.y) / len, n) + Math.pow(Math.abs(v.z) / len, n),
    -1 / n
  );
  return v.multiplyScalar(k);
}

// Squares off the round cross-section of a lathe (around Y) into a rounded box, keeping
// its UVs. n as in roundCube. Call smoothNormals() afterwards.
export function boxify(geo, n = 3.5) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-9) continue;
    const k = Math.pow(Math.pow(Math.abs(x) / r, n) + Math.pow(Math.abs(z) / r, n), -1 / n);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  p.needsUpdate = true;
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
  // time (optional): blend length for this change only (e.g. a snappy drop into a slide)
  start(time = this.time) {
    Object.assign(this.from, this.out);
    this.w = 0;
    this.cur = time;
  }
  target() {
    return Object.assign(this.goal, this.defaults);
  }
  finish(dt) {
    this.w = Math.min(1, this.w + dt / (this.cur || this.time));
    const s = this.w * this.w * (3 - 2 * this.w);
    for (const k in this.out) this.out[k] = this.from[k] + (this.goal[k] - this.from[k]) * s;
    return this.out;
  }
}
