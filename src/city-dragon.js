// city-dragon.js — load-time merged dragon recipes and fixed dance instance buffers.
import * as THREE from 'three';
import { fin, pBox, pCyl, merge } from './city-pieces.js';
import { getToonGradient, addOutline } from './models/toon.js';
import { drawDragonScales } from './city-tex.js';
import { CONFIG } from './config.js';
import { TRACK } from './world.js';
import { districtAt, loopMetre } from './city-logic.js';

export const DRAGON_COLORS = { red: 0xd62828, dark: 0xa4161a, gold: 0xf6c445, orange: 0xf08c00,
  blue: 0x2546a8, white: 0xfff8e7, black: 0x111111, wood: 0x7a4a21 };
const deg = Math.PI / 180;
const tailScales = [0.8, 0.6, 0.4];

export function dragonPose(i, time, side, out) {
  const C = CONFIG.city.dragon;
  out.x = side * (TRACK.fenceOuter + C.sideOffset) + C.waveX * Math.sin(2 * time - 0.5 * i);
  out.y = TRACK.fenceTop + 1.2 + 0.42 + C.waveY * Math.sin(4 * time - 0.6 * i);
  out.z = i < 0 ? 0 : 0.55 + 0.7 / 2 + C.spacing * i;
  return out;
}

export function dragonGeometry() {
  const P = [], J = [], F = [], S = [];
  P.flat = J.flat = F.flat = S.flat = true;
  const C = DRAGON_COLORS;
  fin(P, new THREE.SphereGeometry(0.5, 16, 12).scale(1.0, 0.8, 1.1), C.red, 0, 0, 0);
  fin(P, new THREE.SphereGeometry(0.5, 16, 12).scale(0.8, 0.45, 0.55), C.red, 0, -0.1, 0.75);
  pBox(P, 0, 0.125, 0.75, 0.82, 0.06, 0.58, C.gold);
  for (const s of [-1, 1]) {
    fin(P, new THREE.SphereGeometry(0.06, 4, 3), C.black, s * 0.18, 0.125, 0.9);
    fin(P, new THREE.SphereGeometry(0.22, 8, 6), C.white, s * 0.32, 0.3, 0.35);
    fin(P, new THREE.CircleGeometry(0.13, 8), C.blue, s * 0.32, 0.3, 0.57);
    fin(P, new THREE.CircleGeometry(0.065, 8), C.black, s * 0.32, 0.3, 0.572);
    fin(P, new THREE.TorusGeometry(0.22, 0.04, 4, 8, Math.PI), C.gold, s * 0.32, 0.3, 0.35);
    pCyl(P, s * 0.25, 0.4 + 0.3 * Math.cos(30 * deg), -0.15, 0.06, 0.06, 0.6, 6, C.gold, -30 * deg, 0, -s * 15 * deg);
    pCyl(P, s * 0.25 + s * 0.15 * Math.sin(45 * deg), 0.66 + 0.15 * Math.cos(45 * deg), -0.15,
      0.06, 0.06, 0.3, 6, C.gold, -30 * deg, 0, -s * 45 * deg);
    pCyl(P, s * 0.1, 0.4 + 0.125 * Math.cos(30 * deg), 0.2 + 0.125 * Math.sin(30 * deg), 0.015, 0.015, 0.25, 6, C.gold, 30 * deg);
    fin(P, new THREE.SphereGeometry(0.08, 4, 3), 0xe11d48, s * 0.1, 0.4 + 0.25 * Math.cos(30 * deg), 0.2 + 0.25 * Math.sin(30 * deg));
    for (const y of [0.53, -0.12]) {
      const x = s * (y > 0 ? 0.32 : 0.48);
      fin(P, new THREE.SphereGeometry(0.2, 6, 4).scale(1, 1, 0.3), C.white, x, y, 0.42);
      fin(P, new THREE.SphereGeometry(0.18, 6, 4).scale(1, 1, 0.3), C.blue, x, y, 0.43);
    }
  }
  for (let k = 0; k < 10; k++) {
    const theta = (-135 + 30 * k) * deg, x = 0.45 * Math.sin(theta), y = 0.45 * Math.cos(theta);
    fin(P, new THREE.ConeGeometry(0.12, 0.45, 4).scale(1, 1, 0.3), k % 2 ? C.orange : C.gold, x, y, -0.45, -30 * deg, 0, -theta);
    fin(P, new THREE.SphereGeometry(0.05, 4, 3), C.blue,
      x + 0.225 * Math.sin(theta) * Math.cos(30 * deg), y + 0.225 * Math.cos(theta) * Math.cos(30 * deg), -0.45 - 0.225 * Math.sin(30 * deg));
  }
  // Jaw geometry is local to the skull's lower rear hinge (0,-0.4,-0.55).
  pBox(J, 0, 0, 0.4, 0.72, 0.16, 0.8, C.red);
  pBox(J, 0, 0.085, 0.4, 0.68, 0.01, 0.76, C.dark);
  pBox(J, 0, 0.1, 0.4, 0.3, 0.05, 0.5, C.dark);
  fin(P, new THREE.SphereGeometry(0.1, 6, 4), C.gold, 0, -0.3, 0.55);
  for (let i = 0; i < 6; i++) {
    const x = -0.3 + 0.6 * i / 5;
    fin(P, new THREE.ConeGeometry(0.05, 0.13, 4), C.white, x, 0.03, 1.0, 0, 0, Math.PI);
    fin(J, new THREE.ConeGeometry(0.05, 0.13, 4), C.white, x, 0.145, 0.75);
  }
  for (let i = 0; i < 7; i++) fin(J, new THREE.ConeGeometry(0.03, 0.35, 4), C.white,
    -0.27 + i * 0.09, -0.08 - 0.175 * Math.cos(30 * deg), 0.4 - 0.175 * Math.sin(30 * deg), -30 * deg, 0, Math.PI);
  for (let i = 0; i < 5; i++) {
    const theta = (-60 + 30 * i) * deg;
    fin(F, new THREE.ConeGeometry(0.12, 0.5, 4).scale(1, 1, 0.3), C.gold,
      -0.25 * Math.sin(theta), 0, -0.25 * Math.cos(theta), -Math.PI / 2, theta);
  }
  pCyl(S, 0, 0, 0, 0.04, 0.04, 2.2, 6, C.wood);
  const geometry = { head: merge(P), jaw: merge(J), fan: merge(F), pole: merge(S),
    ring: new THREE.CylinderGeometry(0.42, 0.42, 0.7, 12, 1, true) };
  for (const key in geometry) geometry[key].computeBoundingSphere();
  return geometry;
}

export function createDragon(game, textures) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  drawDragonScales(canvas.getContext('2d'));
  const pulDokusu = new THREE.CanvasTexture(canvas); pulDokusu.colorSpace = THREE.SRGBColorSpace;
  pulDokusu.generateMipmaps = false; pulDokusu.minFilter = THREE.LinearFilter; textures.push(pulDokusu);
  const dragonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() });
  const scaleMat = new THREE.MeshToonMaterial({ map: pulDokusu, gradientMap: getToonGradient() });
  const geometry = dragonGeometry(), meshes = [], outlines = [];
  const make = (key, mat, capacity, ink) => {
    const mesh = new THREE.InstancedMesh(geometry[key], mat, capacity);
    mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.visible = false; meshes.push(mesh); game.scene.add(mesh);
    if (ink) outlines.push(addOutline(mesh));
    return mesh;
  };
  const head = make('head', dragonMat, 1, true), jaw = make('jaw', dragonMat, 1, true);
  const ring = make('ring', scaleMat, CONFIG.city.dragon.rings, true);
  const fan = make('fan', dragonMat, 1, true), pole = make('pole', dragonMat, 6);
  const points = Array.from({ length: CONFIG.city.dragon.rings }, () => new THREE.Vector3());
  const headPosition = new THREE.Vector3(), previous = new THREE.Vector3(), direction = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1), unit = new THREE.Vector3(1, 1, 1), size = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), identity = new THREE.Quaternion();
  const matrix = new THREE.Matrix4(), headMatrix = new THREE.Matrix4(), jawMatrix = new THREE.Matrix4();
  let jawAngle = CONFIG.city.dragon.jaw * deg;
  return { geometry, dragonMat, scaleMat, meshes, outlines, head, jaw, ring, fan, pole,
    get jawAngle() { return jawAngle; },
    update(d, time, seed) {
      const C = CONFIG.city.dragon, headD = d - loopMetre(d) + 1700 + (seed % 100), delta = headD - d;
      const visible = game.state.mode === 'running' && districtAt(d) === 'chinatown' && delta <= C.ahead && delta >= -C.behind;
      if (!visible) { this.clear(); return; }
      const side = seed % 2 === 0 ? -1 : 1;
      dragonPose(-1, time, side, headPosition); headPosition.z = -delta;
      headMatrix.compose(headPosition, identity, unit); head.setMatrixAt(0, headMatrix);
      jawAngle = (C.jaw + C.jawSwing * Math.sin(2 * Math.PI * C.jawHz * time)) * deg;
      jawMatrix.makeRotationX(jawAngle); jawMatrix.setPosition(0, -0.4, -0.55);
      matrix.multiplyMatrices(headMatrix, jawMatrix); jaw.setMatrixAt(0, matrix);
      previous.copy(headPosition); previous.z -= 0.55;
      for (let i = 0; i < C.rings; i++) {
        const point = points[i]; dragonPose(i, time, side, point); point.z = -delta - point.z;
        direction.subVectors(previous, point).normalize(); quaternion.setFromUnitVectors(yAxis, direction);
        const taper = i >= C.rings - 3 ? tailScales[i - (C.rings - 3)] : 1;
        size.set(taper, 1, taper); matrix.compose(point, quaternion, size); ring.setMatrixAt(i, matrix);
        if (i % 2 === 0) {
          matrix.compose(point, identity, unit); matrix.elements[13] -= 0.42 * taper + 2.2 / 2;
          pole.setMatrixAt(i / 2, matrix);
        }
        if (i === C.rings - 1) {
          quaternion.setFromUnitVectors(zAxis, direction); matrix.compose(point, quaternion, unit);
          matrix.elements[14] -= 0.7 / 2; fan.setMatrixAt(0, matrix);
        }
        previous.copy(point);
      }
      head.count = jaw.count = fan.count = 1; ring.count = C.rings; pole.count = 6;
      for (const mesh of meshes) { mesh.visible = true; mesh.instanceMatrix.needsUpdate = true; }
      for (const outline of outlines) { outline.count = outline.parent.count; outline.visible = true; }
    },
    clear() {
      for (const mesh of meshes) { mesh.count = 0; mesh.visible = false; }
      for (const outline of outlines) outline.count = 0;
      jawAngle = CONFIG.city.dragon.jaw * deg;
    },
  };
}
