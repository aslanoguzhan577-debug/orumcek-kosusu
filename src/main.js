// main.js — entry point: renderer, scene, lights, camera, the frame loop, and the
// wiring of world + player + input + city into game. The #ui overlay belongs to ui.js.

import * as THREE from 'three';
import { curve } from './curve.js'; // first: patches every material's shader (curved world)
import { CONFIG } from './config.js';
import { events } from './events.js';
import { game } from './game.js';
import { World, createBlobShadow } from './world.js';
import { Player } from './player.js';
import { Obstacles } from './obstacles.js';
import { Chaser } from './chaser.js';
import { WebPowerup } from './powerups/web.js';
import { IronSpiderPowerup } from './powerups/ironspider.js';
import { SensePowerup } from './powerups/sense.js';
import { MagnetPowerup } from './powerups/magnet.js';
import { Intro } from './intro.js';
import { createInput } from './input.js';
import { CameraRig } from './camera.js';
import { addLights } from './lights.js';
import { createSpiderman } from './models/spiderman.js';
import { createIronSpider } from './models/ironspider.js';
import { createVenom } from './models/venom.js';
import { initCity } from './city.js';
import { initFx } from './fx.js';
import { createAdaptiveRatio } from './quality.js';
import { warmUp } from './warmup.js';
import { createXray } from './xray.js';
import './audio.js';
import './shop.js';
import './ui.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const quality = createAdaptiveRatio(() => resize());
renderer.setPixelRatio(quality.ratio);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.render.skyColor);
scene.fog = new THREE.Fog(CONFIG.render.skyColor, CONFIG.render.fogNear, CONFIG.render.fogFar);
addLights(scene);

const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, CONFIG.render.fogFar + 20);
const cameraRig = new CameraRig(camera);

// ---------- world + player ----------
const world = new World(scene);
// The ONE place the player's model is created (G6: swap for createSpiderman()).
const player = new Player(createSpiderman());
scene.add(player.root);

const shadow = createBlobShadow(0.55);
scene.add(shadow);

game.init({ world, player });
const obstacles = new Obstacles(scene, world, player);
game.addSystem(obstacles);
game.obstacles = obstacles;
// The ONE place Venom's model is created (G6: swap for createVenom()).
const chaser = new Chaser(scene, player, obstacles, createVenom());
game.addSystem(chaser);
game.chaser = chaser;
const web = new WebPowerup({ scene, player, obstacles, cameraRig });
game.addSystem(web);
game.web = web;
// Iron Spider model: built once here, toggled by the power-up.
const iron = new IronSpiderPowerup({ player, obstacles, chaser, ironModel: createIronSpider() });
game.addSystem(iron);
game.iron = iron;
const sense = new SensePowerup({ player, obstacles }); // spider-sense auto-dodge
game.addSystem(sense);
game.sense = sense;
const magnet = new MagnetPowerup({ player, obstacles }); // coin magnet
game.addSystem(magnet);
game.magnet = magnet;
// x-ray silhouette over both suits (the Iron Spider model is a child of player.root by now)
const xray = createXray(player.root);
game.xray = xray;
game.curve = curve;
game.scene = scene;
game.camera = camera;
game.cameraRig = cameraRig;
game.renderer = renderer;
game.intro = new Intro({ scene, player, chaser, web, cameraRig });
game.city = initCity(game);
const fx = initFx(game);
window.game = game; // handy in the console while developing

// ---------- input ----------
const input = createInput(canvas, (action) => game.handleAction(action));
events.addEventListener('start', () => {
  input.reset();
  cameraRig.snap(player);
});
events.addEventListener('resume', () => input.reset());
events.addEventListener('intro', (e) => { if (e.detail.phase === 'end') input.reset(); });

// ---------- resize ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(quality.ratio);
  renderer.setSize(w, h, false);
  cameraRig.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();
cameraRig.snap(player);

// ---------- frame loop ----------
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(Math.max((now - last) / 1000, 0), CONFIG.dtCap);
  // adaptive resolution: only real, running frames count (not loading, pause or a hidden tab)
  if (game.ready && game.state.mode !== 'paused' && !document.hidden) quality.tick(now - last);
  last = now;

  game.update(dt);
  // curved world: fades out in the catch cam (it looks back across the track)
  curve.update(world.distance, game.state.speed, 1 - cameraRig.shotBlend);
  chaser.root.rotation.z = -curve.bank * CONFIG.curve.lean;
  if (game.state.mode !== 'paused') cameraRig.update(dt, player);
  xray.enabled = !game.state.intro && !game.halted && cameraRig.shotBlend < 0.05;

  // Blob shadow stays on the floor and shrinks / fades while in the air.
  const height = Math.max(0, player.y - player.floorY); // (z: the intro clip moves the root)
  const s = THREE.MathUtils.clamp(1 - height / 4, 0.45, 1);
  shadow.position.set(player.x, player.floorY + 0.08, player.root.position.z);
  shadow.scale.set(s, s, 1);
  shadow.material.opacity = s;

  renderer.render(scene, camera);
});

// Start-up warm-up (behind the loading screen): shaders, textures, pooled objects.
warmUp(game, [...fx.textures, ...(player.model.textures || [])]);
