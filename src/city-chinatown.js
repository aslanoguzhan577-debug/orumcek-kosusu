// Chinatown scenery shares the existing board pool and curved-world material hook.
import { createBoards } from './city-boards.js';
import { CONFIG } from './config.js';
import { districtAt, segCentre, lanternLift } from './city-logic.js';
import { TRACK } from './world.js';
import { events } from './events.js';
import * as THREE from 'three';
import { createDragon } from './city-dragon.js';

export const chinatownHash = (segmentId, sign = 0, cell = 0) => {
  const n = Math.sin((segmentId * 32 + sign * 8 + cell) * 127.1) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 4294967296);
};
const pairs = [[0, 1], [2, 3], [3, 5]];
export function signCharacter(segmentId, sign, cell, cells) {
  if (cells === 2 || cells === 3) return pairs[chinatownHash(segmentId, sign) % 3][cell % 2];
  let previous = -1;
  for (let i = 0; i <= cell; i++) {
    let next = chinatownHash(segmentId, sign, i) % 8;
    if (next === previous) next = (next + 1) % 8;
    previous = next;
  }
  return previous;
}

export function createChinatown(game, texture, pieces, cityShift, variants, textures) {
  const buildingMax = Math.max(...variants.map((v) => v.buildings.length));
  const pool = createBoards(texture, CONFIG.world.segmentCount * (26 + buildingMax));
  const glyphMat = pool.mesh.material;
  glyphMat.alphaTest = 0.5;
  const tassels = createBoards(texture, CONFIG.world.segmentCount * buildingMax, new THREE.ConeGeometry(0.06, 0.2, 6), glyphMat);
  const dragon = createDragon(game, textures);
  const rect = [0, 0, 128, 128];
  const bannerRect = [0, 256, 1024, 128];
  const banner = { x: 0, y: 11 + lanternLift() + (CONFIG.city.chinatown.ropeSag - CONFIG.city.chinatown.bannerHeight) / 2,
    z: -10, ry: 0, w: TRACK.halfWidth * 2 + 1, h: CONFIG.city.chinatown.bannerHeight + CONFIG.city.chinatown.ropeSag, sway: true, phase: 0 };
  const vertical = { x: 0, y: 0, z: 0, ry: 0, w: 0.5, h: 2.2 };
  const tassel = { x: 0, y: 0, z: 0, ry: 0, w: 1, h: 1 };
  const verticalRect = [0, 384, 128, 512], goldRect = [0, 128, 1, 1];
  const assign = (seg) => {
    pool.release(seg);
    tassels.release(seg);
    if (districtAt(segCentre(seg.serial) + cityShift) !== 'chinatown') return;
    for (const a of seg.city.plan.dress.anchors.glyph) {
      rect[0] = signCharacter(seg.serial, a.sign, a.cell, a.cells) * 128;
      rect[1] = (chinatownHash(seg.serial, a.sign) % 2) * 128;
      pool.take(seg, a, rect, 1024, texture.image.height);
    }
    let bannerNumber = 0;
    for (const a of seg.city.plan.dress.anchors.banner) {
      banner.phase = chinatownHash(seg.serial, 0, bannerNumber++) / 4294967296 * Math.PI * 2;
      banner.z = a.z;
      pool.take(seg, banner, bannerRect, 1024, texture.image.height);
    }
    for (let i = 0; i < seg.city.buildings.length; i++) {
      const b = seg.city.buildings[i], hash = chinatownHash(seg.serial, i + 4);
      if (hash % 10 >= 4) continue;
      vertical.x = b.side * (b.front - 0.1); vertical.y = b.base + 6.0 - 2.2 / 2;
      vertical.z = b.zA + (b.zB - b.zA) * (0.2 + 0.6 * (hash / 4294967296));
      vertical.ry = -b.side * Math.PI / 2;
      verticalRect[0] = (hash % 4) * 128;
      pool.take(seg, vertical, verticalRect, 1024, texture.image.height);
      tassel.x = vertical.x; tassel.y = b.base + 6.0 - 2.2 - 0.2 / 2; tassel.z = vertical.z;
      tassels.take(seg, tassel, goldRect, 1024, texture.image.height);
    }
  };
  const clear = () => {
    for (const seg of game.world.segments) {
      pool.release(seg); tassels.release(seg);
    }
    pool.update(); tassels.update();
    pool.mesh.visible = tassels.mesh.visible = false;
    dragon.clear();
  };
  const reset = () => { clear(); for (const seg of game.world.segments) assign(seg); };
  const off = game.world.onRecycle(assign);
  game.scene.add(pool.mesh, tassels.mesh);
  events.addEventListener('start', reset);
  events.addEventListener('gameover', clear);
  events.addEventListener('menu', clear);
  reset();
  return {
    pool, tassels, dragon, meshes: [pool.mesh, tassels.mesh, ...dragon.meshes, ...dragon.outlines], glyphMat,
    update(d, time = 0) {
      pool.update(time); tassels.update();
      const visible = districtAt(d) === 'chinatown' && game.state.mode === 'running';
      pool.mesh.visible = visible && pool.mesh.count > 0; tassels.mesh.visible = visible && tassels.mesh.count > 0;
      dragon.update(d, time, game.obstacles.seed);
    },
    dispose() {
      clear(); off(); game.scene.remove(pool.mesh, tassels.mesh);
      for (const mesh of dragon.meshes) game.scene.remove(mesh);
      events.removeEventListener('start', reset); events.removeEventListener('gameover', clear); events.removeEventListener('menu', clear);
    },
  };
}
