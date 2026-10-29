// world.js — the endless elevated track: recycled segments that scroll toward +Z
// while the player stays at z = 0 (keeps numbers small on long runs).
// Also: laneX() helper and createBlobShadow().
//
// Putting things on the track (G2):
//   world.onRecycle((segment) => { ... })
// is called every time a segment is (re)placed at the far end, and for every
// segment, nearest first, on world.reset() (run start). A segment is
//   { group, content, serial, length, items }
//   - add your meshes to segment.content (local z from -length/2 to +length/2,
//     -Z is further ahead); they scroll with the segment automatically
//   - segment.items is a free array for you to remember what you placed there,
//     so you can return it to your pool on the next recycle
//   - serial counts segments since run start (0, 1, 2 ...); use it to keep the
//     first few segments empty
//   - segment.group.position.z is the segment centre in world space

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { toonMaterial } from './models/toon.js';

// World x of a lane index (0 = left lane, laneCount-1 = right lane).
export function laneX(lane) {
  return (lane - (CONFIG.laneCount - 1) / 2) * CONFIG.laneWidth;
}

// Track measurements (y = 0 is the running surface = sleeper tops).
const SLEEPER_LEN = 1.8;
const RAIL_GAUGE = 1.44;
const BED_TOP = -0.08;          // gravel bed surface
const DECK_THICK = 0.9;
const WALL_H = 0.6;

export const TRACK = {
  halfWidth: ((CONFIG.laneCount - 1) / 2) * CONFIG.laneWidth + SLEEPER_LEN / 2 + 0.6,
  bedTop: BED_TOP,
  deckBottom: BED_TOP - DECK_THICK,
};

// long pieces get cuts every ~4 m so the curved world (curve.js) can bend them smoothly
function box(w, h, d, x, y, z) {
  return new THREE.BoxGeometry(w, h, d, 1, 1, Math.max(1, Math.round(d / 4))).translate(x, y, z);
}

// One merged geometry, shared by all segments.
function buildTrackGeometries() {
  const L = CONFIG.world.segmentLength;
  const half = TRACK.halfWidth;
  const deck = [box(half * 2, DECK_THICK, L, 0, BED_TOP - DECK_THICK / 2, 0)];
  const sleepers = [];
  const rails = [];
  const walls = [];

  const sp = CONFIG.world.sleeperSpacing;
  const nSleepers = Math.round(L / sp);
  for (let lane = 0; lane < CONFIG.laneCount; lane++) {
    const x = laneX(lane);
    for (let i = 0; i < nSleepers; i++) {
      sleepers.push(box(SLEEPER_LEN, 0.08, 0.24, x, -0.04, -L / 2 + sp * (i + 0.5)));
    }
    rails.push(box(0.1, 0.1, L, x - RAIL_GAUGE / 2, 0.01, 0));
    rails.push(box(0.1, 0.1, L, x + RAIL_GAUGE / 2, 0.01, 0));
  }

  for (const side of [-1, 1]) {
    const wx = side * (half + 0.15);
    walls.push(box(0.3, WALL_H, L, wx, BED_TOP + WALL_H / 2, 0));
    const ps = CONFIG.world.postSpacing;
    for (let z = -L / 2 + ps / 2; z < L / 2; z += ps) {
      walls.push(box(0.4, 1.3, 0.4, wx, BED_TOP + 0.65, z));
    }
  }

  // One geometry, colours baked into vertex colours: 1 draw call per segment.
  const all = [];
  const paint = (list, hex) => {
    const c = new THREE.Color(hex);
    for (const g of list) {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      all.push(g);
    }
  };
  paint(deck, TRACK_COLORS.deck);
  paint(sleepers, TRACK_COLORS.sleepers);
  paint(rails, TRACK_COLORS.rails);
  paint(walls, TRACK_COLORS.walls);
  const g = mergeGeometries(all);
  for (const part of all) part.dispose();
  return g;
}

const TRACK_COLORS = { deck: 0x6f6a64, sleepers: 0x6b4a33, rails: 0xc8ced8, walls: 0xa3a7ae };

export class World {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.distance = 0;            // metres scrolled since reset
    this._recycleCallbacks = [];
    this._nextSerial = 0;

    const geo = buildTrackGeometries();
    const mat = toonMaterial(0xffffff, { vertexColors: true });

    for (let i = 0; i < CONFIG.world.segmentCount; i++) {
      const group = new THREE.Group();
      group.name = 'segment';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false; // static inside the segment
      mesh.updateMatrix();
      group.add(mesh);
      const content = new THREE.Group();
      content.name = 'segment-content';
      group.add(content);
      scene.add(group);
      this.segments.push({
        group,
        content,
        serial: 0,
        length: CONFIG.world.segmentLength,
        items: [],
      });
    }
    this._layout();
  }

  // Register fn(segment, world). Returns an unsubscribe function.
  onRecycle(fn) {
    this._recycleCallbacks.push(fn);
    return () => {
      const i = this._recycleCallbacks.indexOf(fn);
      if (i >= 0) this._recycleCallbacks.splice(i, 1);
    };
  }

  // Back to the start layout; fires recycle callbacks for every segment.
  reset() {
    this.distance = 0;
    this._layout();
    for (const seg of this.segments) this._fire(seg);
  }

  update(dt, speed) {
    const dz = speed * dt;
    this.distance += dz;
    const L = CONFIG.world.segmentLength;
    const total = L * this.segments.length;
    const backZ = CONFIG.world.backZ;
    for (const seg of this.segments) {
      const p = seg.group.position;
      p.z += dz;
      while (p.z - L / 2 > backZ) {
        p.z -= total;
        seg.serial = this._nextSerial++;
        this._fire(seg);
      }
    }
  }

  // Segment 0 starts just behind the camera; the rest line up ahead (-Z).
  _layout() {
    const L = CONFIG.world.segmentLength;
    const backZ = CONFIG.world.backZ;
    this.segments.forEach((seg, i) => {
      seg.group.position.set(0, 0, backZ - L / 2 - i * L);
      seg.serial = i;
    });
    this._nextSerial = this.segments.length;
  }

  _fire(seg) {
    for (const fn of this._recycleCallbacks) fn(seg, this);
  }
}

// Soft round shadow decal (no shadow maps). Place it at floor height + 0.08.
let shadowTexture = null;
function getShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  shadowTexture = new THREE.CanvasTexture(c);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;
  return shadowTexture;
}

export function createBlobShadow(radius = 0.55) {
  const mat = new THREE.MeshBasicMaterial({
    map: getShadowTexture(),
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  mesh.name = 'blob-shadow';
  return mesh;
}
