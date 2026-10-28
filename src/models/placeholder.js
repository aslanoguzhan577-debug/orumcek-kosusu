// placeholder.js — simple stand-in characters built from basic shapes, implementing
// the shared model interface until the real models (G3/G4) arrive:
//   create...() -> { root, setState(name), update(dt) }
//   root origin at the feet, facing -Z, about CONFIG.playerHeight tall.
// Player states: idle, run, jump, slide, web, stumble, caught.  Venom: run, reach, catch.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { toonMaterial, addOutline } from './toon.js';

const OUTLINE = 0.025;

// Capsule hanging down from its pivot (pivot = shoulder / hip).
function limb(radius, length, material) {
  const geo = new THREE.CapsuleGeometry(radius, length, 3, 8);
  geo.translate(0, -(length / 2 + radius), 0);
  const mesh = new THREE.Mesh(geo, material);
  addOutline(mesh, OUTLINE);
  const pivot = new THREE.Group();
  pivot.add(mesh);
  return pivot;
}

function damp(current, target, k) {
  return current + (target - current) * k;
}

// Pose values that blend smoothly between states.
function makePose() {
  return {
    bodyY: 0, bodyRotX: 0, bodyRotZ: 0, scaleY: 1, scaleXZ: 1,
    armLX: 0, armLZ: 0, armRX: 0, armRZ: 0,
    legLX: 0, legRX: 0,
  };
}

function resetPose(p) {
  for (const key in p) p[key] = 0;
  p.scaleY = 1;
  p.scaleXZ = 1;
}

function applyPose(p, parts) {
  parts.body.position.y = p.bodyY;
  parts.body.rotation.x = p.bodyRotX;
  parts.body.rotation.z = p.bodyRotZ;
  parts.body.scale.set(p.scaleXZ, p.scaleY, p.scaleXZ);
  parts.armL.rotation.set(p.armLX, 0, p.armLZ);
  parts.armR.rotation.set(p.armRX, 0, p.armRZ);
  parts.legL.rotation.x = p.legLX;
  parts.legR.rotation.x = p.legRX;
}

// ---------------------------------------------------------------- player

export function createPlaceholderPlayer() {
  const H = CONFIG.playerHeight;           // ~1.6
  const red = toonMaterial(0xd62828);
  const blue = toonMaterial(0x2346c8);
  const white = toonMaterial(0xffffff);

  const root = new THREE.Group();
  root.name = 'placeholder-player';
  const body = new THREE.Group();
  root.add(body);

  // Legs (hip at 0.42)
  const legL = limb(0.11, 0.2, blue);
  const legR = limb(0.11, 0.2, blue);
  legL.position.set(-0.12, 0.42, 0);
  legR.position.set(0.12, 0.42, 0);
  body.add(legL, legR);

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.22, 3, 10), red);
  torso.position.y = 0.69;
  addOutline(torso, OUTLINE);
  body.add(torso);

  // Arms (shoulder at 0.92)
  const armL = limb(0.08, 0.22, red);
  const armR = limb(0.08, 0.22, red);
  armL.position.set(-0.27, 0.92, 0);
  armR.position.set(0.27, 0.92, 0);
  body.add(armL, armR);

  // Big chibi head with two white eyes looking -Z
  const headR = 0.33;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), red);
  head.position.y = H - headR;
  addOutline(head, OUTLINE);
  body.add(head);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white);
    eye.scale.set(1, 0.75, 0.35);
    eye.position.set(side * 0.13, 0.05, -headR + 0.04);
    eye.rotation.z = side * -0.35;
    addOutline(eye, 0.06);
    head.add(eye);
  }

  const parts = { body, armL, armR, legL, legR };
  const pose = makePose();
  const target = makePose();
  let state = 'idle';
  let t = 0;
  let stateTime = 0;

  function setState(name) {
    if (name === state) return;
    state = name;
    stateTime = 0;
  }

  function update(dt) {
    t += dt;
    stateTime += dt;
    resetPose(target);
    const run = Math.sin(t * 14);

    switch (state) {
      case 'run':
        target.bodyY = Math.abs(run) * 0.07;
        target.bodyRotX = -0.15;
        target.legLX = run * 0.9;
        target.legRX = -run * 0.9;
        target.armLX = -run * 0.8;
        target.armRX = run * 0.8;
        target.armLZ = -0.2;
        target.armRZ = 0.2;
        break;
      case 'jump': // arms up and out, knees to the belly
        target.armLZ = -2.3;
        target.armRZ = 2.3;
        target.legLX = 1.3;
        target.legRX = 1.3;
        target.bodyY = 0.12;
        break;
      case 'slide': // squashed low (hitbox is CONFIG.slideHeight)
        target.scaleY = 0.47;
        target.scaleXZ = 1.15;
        target.bodyRotX = 0.25;
        target.legLX = 1.2;
        target.legRX = 1.2;
        target.armLZ = -1.2;
        target.armRZ = 1.2;
        break;
      case 'web': // right arm straight up
        target.armRZ = 2.9;
        target.armLZ = -0.6;
        target.legLX = 0.6;
        target.legRX = -0.3;
        target.bodyY = 0.08;
        break;
      case 'stumble': // wobble and flail
        target.bodyRotZ = Math.sin(stateTime * 22) * 0.35 * Math.max(0, 1 - stateTime);
        target.bodyRotX = 0.2;
        target.armLZ = -1.6 + Math.sin(t * 25) * 0.5;
        target.armRZ = 1.6 - Math.sin(t * 25) * 0.5;
        target.legLX = run * 0.6;
        target.legRX = -run * 0.6;
        break;
      case 'caught': // knocked flat on the back
        target.bodyRotX = 1.45;
        target.bodyY = 0.25;
        target.armLZ = -2.6;
        target.armRZ = 2.6;
        target.legLX = 0.3;
        target.legRX = -0.2;
        break;
      case 'idle':
      default:
        target.scaleY = 1 + Math.sin(t * 2.5) * 0.02;
        target.armLZ = -0.15;
        target.armRZ = 0.15;
        break;
    }

    const k = 1 - Math.exp(-18 * dt);
    for (const key in pose) pose[key] = damp(pose[key], target[key], k);
    applyPose(pose, parts);
  }

  update(0);
  return { root, setState, update };
}

// ---------------------------------------------------------------- venom

export function createPlaceholderVenom() {
  const black = toonMaterial(0x16161d);
  const white = toonMaterial(0xffffff);
  const mouthMat = toonMaterial(0x8a1020);

  const root = new THREE.Group();
  root.name = 'placeholder-venom';
  const body = new THREE.Group();
  root.add(body);
  const S = 1.25; // bigger than the player, still chibi

  const legL = limb(0.14, 0.2, black);
  const legR = limb(0.14, 0.2, black);
  legL.position.set(-0.17, 0.48, 0);
  legR.position.set(0.17, 0.48, 0);
  body.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.3, 3, 10), black);
  torso.position.y = 0.85;
  addOutline(torso, OUTLINE);
  body.add(torso);

  // White spider emblem on the chest (front = -Z)
  const emblem = new THREE.Group();
  emblem.position.set(0, 0.92, -0.29);
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.04), white);
  emblem.add(core);
  for (const side of [-1, 1]) {
    for (const tilt of [0.6, -0.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.03), white);
      leg.position.set(side * 0.1, tilt * 0.08, 0);
      leg.rotation.z = side * tilt;
      emblem.add(leg);
    }
  }
  body.add(emblem);

  const armL = limb(0.11, 0.38, black);
  const armR = limb(0.11, 0.38, black);
  armL.position.set(-0.4, 1.1, 0);
  armR.position.set(0.4, 1.1, 0);
  body.add(armL, armR);

  const headR = 0.4;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), black);
  head.position.y = CONFIG.playerHeight * S - headR;
  addOutline(head, OUTLINE);
  body.add(head);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), white);
    eye.scale.set(1.1, 0.6, 0.3);
    eye.position.set(side * 0.17, 0.1, -headR + 0.05);
    eye.rotation.z = side * -0.5;
    addOutline(eye, 0.06);
    head.add(eye);
  }
  // Wide grin: dark red mouth with a white teeth strip
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mouthMat);
  mouth.scale.set(1.3, 0.45, 0.3);
  mouth.position.set(0, -0.14, -headR + 0.06);
  head.add(mouth);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), white);
  teeth.position.set(0, -0.11, -headR + 0.02);
  head.add(teeth);

  const parts = { body, armL, armR, legL, legR };
  const pose = makePose();
  const target = makePose();
  let state = 'run';
  let t = 0;

  function setState(name) {
    state = name;
  }

  function update(dt) {
    t += dt;
    resetPose(target);
    const run = Math.sin(t * 11);
    switch (state) {
      case 'reach': // arms stretched forward
        target.bodyRotX = -0.3;
        target.armLX = 1.5 + Math.sin(t * 9) * 0.15;
        target.armRX = 1.5 - Math.sin(t * 9) * 0.15;
        target.legLX = run * 0.9;
        target.legRX = -run * 0.9;
        target.bodyY = Math.abs(run) * 0.06;
        break;
      case 'catch': // lunge and grab
        target.bodyRotX = -0.6;
        target.bodyY = 0.15;
        target.armLX = 2.2;
        target.armRX = 2.2;
        target.armLZ = 0.4;
        target.armRZ = -0.4;
        target.scaleY = 1.08;
        break;
      case 'run':
      default:
        target.bodyRotX = -0.25;
        target.bodyY = Math.abs(run) * 0.1;
        target.legLX = run * 1.0;
        target.legRX = -run * 1.0;
        target.armLX = -run * 1.0;
        target.armRX = run * 1.0;
        target.armLZ = -0.3;
        target.armRZ = 0.3;
        break;
    }
    const k = 1 - Math.exp(-14 * dt);
    for (const key in pose) pose[key] = damp(pose[key], target[key], k);
    applyPose(pose, parts);
  }

  update(0);
  return { root, setState, update };
}
