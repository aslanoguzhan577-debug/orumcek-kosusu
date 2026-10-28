// main.js — entry point: renderer, scene, lights, camera, the frame loop, and the
// wiring of world + player + input into game. Also the tiny G1 placeholder text in
// #ui (#g1-hint / #g1-hud) that G12 replaces; the code below skips it if it is gone.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { events } from './events.js';
import { game } from './game.js';
import { World, createBlobShadow } from './world.js';
import { Player } from './player.js';
import { createInput } from './input.js';
import { CameraRig } from './camera.js';
import { addLights } from './lights.js';
import { createPlaceholderPlayer } from './models/placeholder.js';
import './audio.js';

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.render.skyColor);
scene.fog = new THREE.Fog(CONFIG.render.skyColor, CONFIG.render.fogNear, CONFIG.render.fogFar);
addLights(scene);

const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, CONFIG.render.fogFar + 20);
const cameraRig = new CameraRig(camera);

// ---------- world + player ----------
const world = new World(scene);
const player = new Player(createPlaceholderPlayer());
scene.add(player.root);

const shadow = createBlobShadow(0.55);
scene.add(shadow);

game.init({ world, player });
game.scene = scene;
game.camera = camera;
game.cameraRig = cameraRig;
game.renderer = renderer;
window.game = game; // handy in the console while developing

// ---------- input ----------
const input = createInput(canvas, (action) => game.handleAction(action));
events.addEventListener('start', () => {
  input.reset();
  cameraRig.snap(player);
});
events.addEventListener('resume', () => input.reset());

// ---------- resize ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.setSize(w, h, false);
  cameraRig.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();
cameraRig.snap(player);

// ---------- G1 placeholder UI (G12 replaces #ui contents) ----------
const hint = document.getElementById('g1-hint');
const hud = document.getElementById('g1-hud');
let lastHudText = '';
function updatePlaceholderUI() {
  const st = game.state;
  if (hint) {
    let text = '';
    if (st.mode === 'menu') text = 'Başlamak için dokun';
    else if (st.mode === 'paused') text = 'Duraklatıldı — devam için dokun';
    else if (st.mode === 'over') text = 'Oyun bitti — tekrar için dokun';
    if (hint.textContent !== text) hint.textContent = text;
    hint.hidden = text === '';
  }
  if (hud) {
    const text = st.mode === 'menu' ? '' : `Skor: ${st.score}   ${st.speed.toFixed(1)} m/sn`;
    if (text !== lastHudText) {
      hud.textContent = text;
      lastHudText = text;
    }
  }
}

// ---------- frame loop ----------
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(Math.max((now - last) / 1000, 0), CONFIG.dtCap);
  last = now;

  game.update(dt);
  if (game.state.mode !== 'paused') cameraRig.update(dt, player);

  // Blob shadow stays on the floor and shrinks / fades while in the air.
  const height = Math.max(0, player.y - player.floorY);
  const s = THREE.MathUtils.clamp(1 - height / 4, 0.45, 1);
  shadow.position.set(player.x, player.floorY + 0.08, 0);
  shadow.scale.set(s, s, 1);
  shadow.material.opacity = s;

  updatePlaceholderUI();
  renderer.render(scene, camera);
});
