// warmup.js — runs once at start-up, behind the loading screen: builds everything that would
// otherwise be built on first use and makes the GPU compile every shader and upload every
// texture / buffer, so nothing hitches once the game is playable. game.ready is set at the end
// (ui.js removes #loading only then).

import * as THREE from 'three';
import { events } from './events.js';
import { prepareAudio } from './audio.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function warmUp(game, textures = []) {
  const { renderer, scene, camera } = game;
  try {
    // web fonts: fx.js redraws its word textures when Bangers arrives, so wait for it (capped)
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load("64px 'Bangers'", 'GÜMÇŞİ'), document.fonts.load("800 16px 'Baloo 2'", 'GÜMÇŞİ')]).catch(() => {}),
        sleep(3000),
      ]);
    }
    try { prepareAudio(); } catch (e) { /* no audio: fine */ }
    await nextFrame();

    // one pooled instance of every pickup kind (shared geometry / materials are built now)
    const ob = game.obstacles;
    const made = [];
    for (const kind in ob.pickupKinds) {
      ob._addPickup(kind, 0, 1, -6);
      made.push(ob.pickups[ob.pickups.length - 1]);
    }
    await nextFrame();

    // every city chunk variant: only the ones on screen now are in the scene, the rest would
    // be uploaded to the GPU the first time a recycled segment shows them
    const temp = [];
    const c0 = game.world.segments[0].city;
    if (game.city && c0) {
      for (const v of game.city.variants) {
        temp.push(new THREE.Mesh(v.facade, c0.facade.material), new THREE.Mesh(v.plain, c0.plain.material));
      }
      scene.add(...temp);
    }

    // 1. compile every material (hidden objects included), in parallel where the browser can
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch (e) { /* the render below compiles whatever is missing */ }
    for (const t of textures) renderer.initTexture(t);

    // 2. one render with everything visible and culling off uploads every buffer / texture.
    // No await in here: other per-frame code (fx, obstacles) would hide things again.
    const saved = [];
    scene.traverse((o) => {
      if (!o.visible || o.frustumCulled) saved.push([o, o.visible, o.frustumCulled]);
      o.visible = true;
      o.frustumCulled = false;
    });
    try {
      renderer.render(scene, camera);
    } finally {
      scene.remove(...temp);
      for (const [o, v, c] of saved) { o.visible = v; o.frustumCulled = c; }
      for (const pk of made) { const i = ob.pickups.indexOf(pk); if (i >= 0) ob._releasePickup(i); }
    }

    // two normal frames overwrite the canvas before the loader goes
    await nextFrame();
    await nextFrame();
  } catch (e) {
    console.warn('warm-up failed', e);
  }
  game.ready = true;
  events.dispatchEvent(new Event('ready'));
}
