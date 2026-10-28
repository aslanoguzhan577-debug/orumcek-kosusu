// lights.js — the one lighting setup shared by the game (main.js) and viewer.html,
// so models look the same in both. Hemisphere + one directional "sun", no shadow maps.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export function addLights(scene) {
  const c = CONFIG.lights;
  const hemi = new THREE.HemisphereLight(c.skyColor, c.groundColor, c.hemiIntensity);
  const sun = new THREE.DirectionalLight(c.sunColor, c.sunIntensity);
  sun.position.set(c.sunPosition[0], c.sunPosition[1], c.sunPosition[2]);
  sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target);
  return { hemi, sun };
}
