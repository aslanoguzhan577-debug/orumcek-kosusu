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
import { RoadEvents } from './road-events.js';
import { WebPowerup } from './powerups/web.js';
import { IronSpiderPowerup } from './powerups/ironspider.js';
import { SensePowerup } from './powerups/sense.js';
import { MagnetPowerup } from './powerups/magnet.js';
import { BuglePowerup } from './powerups/bugle.js';
import { SpringPowerup } from './powerups/spring.js';
import { SwingPowerup } from './powerups/swing.js';
import { DecoyPowerup } from './powerups/decoy.js';
import { WallPowerup } from './powerups/wall.js';
import { TracerPowerup } from './powerups/tracer.js';
import { FlashBooster } from './powerups/flash.js';
import { RepulsorBoost } from './powerups/repulsor.js';
import { HERO_SPECIAL_TEXTURES } from './powerups/hero-specials.js';
import { Intro } from './intro.js';
import { createInput } from './input.js';
import { CameraRig } from './camera.js';
import { addLights } from './lights.js';
import { createSpiderman } from './models/spiderman.js';
import { createIronSpider } from './models/ironspider.js';
import { createHelloKitty } from './models/hellokitty.js';
import { createGwen } from './models/gwen.js';
import { createMiles } from './models/miles.js';
import { createRaimi } from './models/raimi.js';
import { createMcuSpidey } from './models/mcu.js';
import { createIronMan } from './models/ironman.js';
import { createPanther } from './models/panther.js';
import { createBatman } from './models/batman.js';
import { createCap } from './models/cap.js';
import { createHulk } from './models/hulk.js';
import { createVenom } from './models/venom.js';
import { initCity } from './city.js';
import { initFx } from './fx.js';
import { createAdaptiveRatio } from './quality.js';
import { warmUp } from './warmup.js';
import { createXray } from './xray.js';
import './audio.js';
import './shop.js';
import './missions.js';
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
// The ONE place the player's skins are created: both built once (behind the loading screen),
// the chosen one is the player's model, the other hangs hidden under player.root.
const SKIN_KEY = 'spidey.skin';
const skins = { spider: createSpiderman(), kitty: createHelloKitty(), gwen: createGwen(), miles: createMiles(), raimi: createRaimi(), mcu: createMcuSpidey(), ironman: createIronMan(), panther: createPanther(), batman: createBatman(), cap: createCap(), hulk: createHulk() };
let skin = 'spider';
try { if (skins[localStorage.getItem(SKIN_KEY)]) skin = localStorage.getItem(SKIN_KEY); } catch (e) { /* default */ }
const player = new Player(skins[skin]);
for (const k in skins) if (skins[k] !== player.model) { player.root.add(skins[k].root); skins[k].root.visible = false; }
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
const web = new WebPowerup({ scene, player, obstacles, cameraRig, chaser });
game.addSystem(web);
game.web = web;
game.heroSpecials = web.heroSpecials;
// Iron Spider model: built once here, toggled by the power-up.
const iron = new IronSpiderPowerup({ player, obstacles, chaser, ironModel: createIronSpider() });
game.addSystem(iron);
game.iron = iron;

// Hero Specials & Iron Spider unified collision/action hooks
obstacles.hooks.onFrontHit = (hit) => {
  if (web.heroSpecials && web.heroSpecials.active) {
    return web.heroSpecials.absorbHit(hit);
  }
  return iron._absorb(hit);
};
obstacles.hooks.onSideHit = (hit) => {
  if (web.heroSpecials && web.heroSpecials.active) {
    return web.heroSpecials.absorbHit(hit);
  }
  return false;
};
chaser.hooks.absorbCatch = () => {
  if (web.heroSpecials && web.heroSpecials.active) {
    return web.heroSpecials.absorbHit();
  }
  return iron._absorb();
};
player.hooks.onDoubleAction = () => {
  const isHero = web.heroSpecials.isHero(game.skin);
  if (isHero && game.state.webCharges >= 1 && !web.heroSpecials.active) {
    return web.tryActivate();
  }
  return iron.activate();
};
// Menu skin choice: the suit power-up swaps back to whichever skin is chosen.
game.skins = skins;
web.heroSpecials.prepare(skins); // per-skin effect layers, built at load
game.skin = skin;
game.setSkin = (name) => {
  if (!skins[name]) return;
  if (web.heroSpecials && web.heroSpecials.active) web.heroSpecials.deactivate(false);
  game.skin = name;
  iron.normalModel = skins[name];
  if (!iron.active) player.useModel(skins[name]);
};
const sense = new SensePowerup({ player, obstacles }); // spider-sense auto-dodge
game.addSystem(sense);
game.sense = sense;
const magnet = new MagnetPowerup({ player, obstacles }); // coin magnet
game.addSystem(magnet);
game.magnet = magnet;
const bugle = new BuglePowerup({ obstacles }); // x2 score multiplier
game.addSystem(bugle);
game.bugle = bugle;
const spring = new SpringPowerup({ obstacles }); // super-high jump
game.addSystem(spring);
game.spring = spring;
const swing = new SwingPowerup({ player, obstacles, web, chaser }); // web-swing above the city
game.addSystem(swing);
game.swing = swing;
// built after the chaser: the decoy chains the side-stumble hook the chaser installed
const decoy = new DecoyPowerup({ player, obstacles, chaser, scene }); // one forgiven stumble
game.addSystem(decoy);
game.decoy = decoy;
const wall = new WallPowerup({ player, obstacles, chaser, scene, cameraRig }); // run on the facade
game.addSystem(wall);
game.wall = wall;
const tracer = new TracerPowerup({ player, obstacles, scene }); // drone traces the open lane
game.addSystem(tracer);
game.tracer = tracer;
const roadEvents = new RoadEvents({ player, obstacles, chaser });
game.addSystem(roadEvents);
game.roadEvents = roadEvents;
const flash = new FlashBooster(); // market consumable: start-of-run score boost
game.addSystem(flash);
game.flash = flash;
const repulsor = new RepulsorBoost({ player, scene }); // Iron Man fly boost
game.addSystem(repulsor);
game.repulsor = repulsor;
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
  const capHover = (web.heroSpecials && web.heroSpecials.active && web.heroSpecials.mode === 'cap') ? 0.32 : 0;
  const kitty = web.heroSpecials?.skills?.kitty;
  const batman = web.heroSpecials?.skills?.batman;
  const flying = (batman && batman.currentFlyOffset > 0.001) ? batman : (kitty && kitty.currentFlyOffset > 0) ? kitty : swing.active ? swing : wall.active ? wall : null;
  // a flyer holds one altitude above the street, so its saved surface is the shadow's floor
  const baseFloor = flying ? flying.surfaceY : Math.max(0, player.floorY - capHover);
  const height = Math.max(0, player.y - baseFloor); // (z: the intro clip moves the root)
  const s = THREE.MathUtils.clamp(1 - height / 4, 0.45, 1);
  shadow.position.set(player.x, baseFloor + 0.08, player.root.position.z);
  shadow.scale.set(s, s, 1);
  shadow.material.opacity = s;

  renderer.render(scene, camera);
});

// Start-up warm-up (behind the loading screen): shaders, textures, pooled objects.
warmUp(game, [...fx.textures, ...HERO_SPECIAL_TEXTURES, ...Object.values(skins).flatMap((m) => m.textures || [])]);
