// repulsor.js — Iron Man Repulsor Boost (jet start, a market item; stock: shop.js):
// In the first 7 seconds of any run, press the bottom-left button.
// Iron Man swoops in from behind, grabs the player from behind/above,
// rotates both characters into a horizontal rocket flight pose, and fires
// full ARC-REACTOR CYAN/BLUE LINEAR REPULSOR THRUSTERS to rocket forward
// until reaching 2000 score!
// Then descends, lands the player safely on the track, and blasts off into space.

import * as THREE from 'three';
import { game } from '../game.js';
import { CONFIG } from '../config.js';
import { createIronMan } from '../models/ironman.js';
import { getJetStartCount, useJetStart } from '../shop.js';
import { puffBurst, sparkBurst, spark, burst, sticker, impactFrame, hitStop, kick, edgeLines } from '../vfxCore.js';

const FLY_HEIGHT = 4.8;             // altitude during horizontal flight
const ARRIVE_TIME = 0.40;           // swoop in from behind camera
const LIFTOFF_TIME = 0.45;          // grab player, rise and pitch horizontal
const MAX_FLY_DURATION = 3.2;       // max flight time to cover the distance
const DESCEND_TIME = 0.50;          // descent and level out back to track
const DEPART_TIME = 0.60;           // Iron Man rockets up into the clouds
const WINDOW_SECONDS = 7;           // skill window from run start

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// Toon repulsor flame: one cone per boot / palm, banded by the view angle (white-hot core,
// cyan, blue rim) with a flicker; one shared material, no lights.
const FLAME_VERT = /* glsl */`
varying vec3 vN;
varying vec3 vV;
varying float vT;
void main() {
  vT = -position.y;                       // 0 at the nozzle, 1 at the tip
  vec4 mv = viewMatrix * curveWorld(modelMatrix * vec4(position, 1.0));
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FLAME_FRAG = /* glsl */`
varying vec3 vN;
varying vec3 vV;
varying float vT;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV))) * (1.0 - vT * 0.6);
  vec3 col = f > 0.5 ? vec3(1.0) : f > 0.22 ? vec3(0.5, 0.91, 1.0) : vec3(0.18, 0.48, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;
const flameGeo = new THREE.ConeGeometry(1, 1, 12, 1, true).rotateX(Math.PI).translate(0, -0.5, 0); // base at 0, tip at -1
let flameMat = null;

function createThrusterAssembly() {
  flameMat = flameMat || new THREE.ShaderMaterial({ vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, side: THREE.DoubleSide, fog: false });
  const group = new THREE.Group();
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.frustumCulled = false;
  group.add(flame);
  group.visible = false;
  return {
    group,
    setPower(power, time) {
      group.visible = power > 0.01;
      if (!group.visible) return;
      const flick = 1 + Math.sin(time * 60) * 0.08 + Math.sin(time * 37) * 0.06;
      flame.scale.set(0.13 * power, 1.25 * power * flick, 0.13 * power);
    },
  };
}

export class RepulsorBoost {
  constructor({ player, scene }) {
    this.player = player;
    this.scene = scene;
    this.active = false;
    this.used = false;
    this.phase = 'idle'; // 'arrive' | 'liftoff' | 'fly' | 'descend' | 'depart' | 'idle'
    this.elapsed = 0;
    this.flightTime = 0;
    this.targetDistance = 2000;

    // Helper Iron Man model
    this.ironModel = createIronMan();
    this.ironRoot = this.ironModel.root;
    this.ironRoot.visible = false;
    this.ironModel.setState('jump');
    scene.add(this.ironRoot);

    // Build linear cyan thrusters (2 boots, 2 hands)
    this.thrusters = [];
    const thrusterDefs = [
      { x: -0.12, y: 0.04, z: 0 },       // left boot
      { x: 0.12, y: 0.04, z: 0 },        // right boot
      { x: -0.27, y: 0.32, z: -0.06 },   // left hand
      { x: 0.27, y: 0.32, z: -0.06 },    // right hand
    ];

    for (const def of thrusterDefs) {
      const th = createThrusterAssembly();
      th.group.position.set(def.x, def.y, def.z);
      this.ironRoot.add(th.group);
      this.thrusters.push(th);
    }
  }

  get available() {
    return !this.active
      && !this.used
      && getJetStartCount() > 0
      && game.state.mode === 'running'
      && !game.state.intro
      && game.state.time <= WINDOW_SECONDS;
  }

  get windowLeft() {
    if (this.used || this.active) return 0;
    if (game.state.mode !== 'running') return WINDOW_SECONDS;
    return Math.max(0, WINDOW_SECONDS - game.state.time);
  }

  activate() {
    if (!this.available) return;
    if (!useJetStart()) return;
    this._launch();
  }

  // the flight itself (activate() has paid for it)
  _launch() {
    this.active = true;
    this.used = true;
    this.elapsed = 0;
    this.flightTime = 0;
    this.phase = 'arrive';

    // Target: advance until score/distance reaches 2000!
    this.targetDistance = game.state.distance < 2000 ? 2000 : (game.state.distance + 2000);

    // Show Iron Man, high above and behind the player (out of the camera's near zone)
    this.ironRoot.visible = true;
    this.ironModel.setState('jump');
    this.ironRoot.position.set(this.player.x + 2.5, this.player.y + 8.0, this.player.root.position.z + 3.0);
    this._trailT = 0;
    this.ironRoot.rotation.set(-0.6, 0, 0);

    // Thrusters start firing with arc-reactor cyan energy
    this._setThrusterPower(0.65, 0);
  }

  _setThrusterPower(p, time) {
    for (const th of this.thrusters) th.setPower(p, time);
  }

  // repulsor exhaust: short white / cyan streaks off the boots (player frame)
  _exhaust(n, back) {
    const r = this.ironRoot;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      spark(r.position.x + s * 0.12, r.position.y + 0.05, r.position.z + 0.3,
        s * (0.5 + Math.random()), -0.5 - Math.random(), back * (0.7 + Math.random() * 0.6),
        0.14 + Math.random() * 0.1, 0.07, i % 3 ? 0x7fe9ff : 0xffffff, false);
    }
  }

  beforePlayer(dt) {
    if (!this.active) return;
    this.elapsed += dt;

    // While boost is active, keep player invincible
    if (this.phase !== 'depart' && this.phase !== 'idle') {
      if (game.obstacles) game.obstacles.grace(0.5);
    }

    const px = this.player.x;
    const pz = this.player.root.position.z;

    switch (this.phase) {
      case 'arrive': {
        // Iron Man swoops in from behind camera to right behind player's back
        const k = Math.min(1, this.elapsed / ARRIVE_TIME);
        const sk = smoothstep(k);

        const targetY = this.player.y + 0.22;
        const targetZ = pz + 0.38;

        this.ironRoot.position.set(
          THREE.MathUtils.lerp(px + 2.5, px, sk),
          THREE.MathUtils.lerp(this.player.y + 8.0, targetY, sk),
          THREE.MathUtils.lerp(pz + 3.0, targetZ, sk)
        );
        this._exhaust(1, 6);
        this.ironRoot.rotation.x = THREE.MathUtils.lerp(-0.6, 0, sk);

        this._setThrusterPower(0.65 + sk * 0.35, this.elapsed);

        if (k >= 1) {
          this.phase = 'liftoff';
          this.elapsed = 0;

          // Lock player controls, superhero flight pose
          this.player.controlsLocked = true;
          this.player.setOverride('soar', Infinity);

          // Tilt camera up to capture the ascent
          if (game.cameraRig) game.cameraRig.setTilt(true);
          // the grab: a blast of smoke off the track, FWOOSH!
          const p = this.player;
          puffBurst({ x: p.x, y: p.floorY + 0.05, z: 0 }, { n: 10, ring: true, radius: 0.6, speed: 4.5, size: 0.75, rise: 0.8, colors: [0xeeeef2, 0xd6d8e0], scroll: false });
          sticker('fwoosh', new THREE.Vector3(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.4, -1.4), { follow: p.root, life: 0.8 });
          kick(0.3);
        }
        break;
      }

      case 'liftoff': {
        // Both characters lift off and pitch forward into horizontal rocket pose!
        const k = Math.min(1, this.elapsed / LIFTOFF_TIME);
        const sk = smoothstep(k);

        const h = THREE.MathUtils.lerp(this.player.floorY, FLY_HEIGHT, sk);
        this.player.y = h;
        this.player.vy = 0;
        this.player.grounded = false;

        // Pitch both forward horizontally: 0 -> -1.42 radians (~82 degrees prone)
        const pitch = THREE.MathUtils.lerp(0, -1.42, sk);
        this.player.root.rotation.x = pitch;
        this.ironRoot.rotation.x = pitch;

        // Iron Man holding player from behind/above
        this.ironRoot.position.set(px, h + 0.22, pz + 0.38);

        this._setThrusterPower(0.85 + sk * 0.15, this.elapsed);

        this._exhaust(2, 8);
        if (k >= 1) {
          this.phase = 'fly';
          this.elapsed = 0;
          this.flightTime = 0;
          // sonic boom: vapour rings, freeze frame, comic panel, speed lines
          const at = new THREE.Vector3(px, h + 0.3, pz + 0.6);
          burst('ring', at, { size: 0.8, grow: 6, life: 0.45 });
          burst('ring', at, { size: 0.4, grow: 3.5, life: 0.35 });
          hitStop(0.05);
          impactFrame({ at, bg: 0xe8f7ff, dot: 0xbfe6ff, line: 0xc8202f });
          sparkBurst(at, { n: 14, speed: 7, colors: [0xffffff, 0x7fe9ff, 0xffd23a], scroll: false });
          edgeLines(0.85);
          kick(-0.5);
        }
        break;
      }

      case 'fly': {
        this.flightTime += dt;

        // Aerodynamic hover wave
        const bob = Math.sin(this.flightTime * 9) * 0.08;
        const h = FLY_HEIGHT + bob;
        this.player.y = h;
        this.player.vy = 0;
        this.player.grounded = false;

        // Locked in horizontal flight
        this.player.root.rotation.x = -1.42;
        this.ironRoot.rotation.x = -1.42;
        this.ironRoot.position.set(px, h + 0.22, pz + 0.38);

        // Calculate supersonic speed to hit exactly 2000 score in ~2.8s
        const distRemaining = Math.max(0, this.targetDistance - game.state.distance);
        const timeRemaining = Math.max(0.15, MAX_FLY_DURATION - this.flightTime);
        const neededSpeed = distRemaining / timeRemaining;
        const speed = THREE.MathUtils.clamp(neededSpeed, 250, 800);

        game.speedOverride = speed;

        // Arc-reactor linear thrusters at full power with subtle reactor pulse
        this._setThrusterPower(1.0, this.elapsed);
        this._exhaust(2, 14);

        // Continuous subtle rocket rumble
        if (game.cameraRig && Math.random() < 0.4) {
          game.cameraRig.shake(0.04, 0.1);
        }

        // Distance reached target score; game.update pays these metres into the multiplied accumulator.
        if (game.state.distance >= this.targetDistance || this.flightTime >= MAX_FLY_DURATION) {
          game.state.distance = Math.max(game.state.distance, this.targetDistance);

          this.phase = 'descend';
          this.elapsed = 0;

          // Decelerate
          game.speedOverride = CONFIG.cruiseSpeed;
          edgeLines(0);
        }
        break;
      }

      case 'descend': {
        // Lower back to the track and pitch back to vertical
        const k = Math.min(1, this.elapsed / DESCEND_TIME);
        const sk = smoothstep(k);

        const h = THREE.MathUtils.lerp(FLY_HEIGHT, this.player.floorY, sk);
        this.player.y = Math.max(this.player.floorY, h);
        this.player.vy = 0;
        this.player.grounded = false;

        // Pitch back: -1.42 -> 0
        const pitch = THREE.MathUtils.lerp(-1.42, 0, sk);
        this.player.root.rotation.x = pitch;
        this.ironRoot.rotation.x = pitch;

        this.ironRoot.position.set(px, this.player.y + 0.22, pz + 0.38);

        this._setThrusterPower(1.0 - sk * 0.4, this.elapsed);

        if (k >= 1) {
          this.phase = 'depart';
          this.elapsed = 0;

          // Release player safely
          this.player.y = this.player.floorY;
          this.player.grounded = true;
          this.player.controlsLocked = false;
          this.player.clearOverride();
          this.player.root.rotation.x = 0;

          // Restore normal game speed and give post-flight grace
          game.speedOverride = null;
          if (game.obstacles) game.obstacles.grace(1.5);
          if (game.cameraRig) {
            game.cameraRig.setTilt(false);
            game.cameraRig.shake(0.12, 0.25);
          }
          puffBurst({ x: px, y: this.player.floorY + 0.05, z: 0 }, { n: 8, ring: true, radius: 0.5, speed: 3.5, size: 0.6, rise: 0.5, colors: [0xeeeef2, 0xd6d8e0], scroll: false });
          kick(0.25);
        }
        break;
      }

      case 'depart': {
        // Iron Man rockets up into the sky and departs
        const k = Math.min(1, this.elapsed / DEPART_TIME);
        const sk = smoothstep(k);

        this.ironRoot.position.y += 35 * dt;
        this.ironRoot.position.z -= 18 * dt;
        this.ironRoot.rotation.x = -0.7;

        this._setThrusterPower(1.2, this.elapsed);
        this._trailT -= dt;
        if (this._trailT <= 0) { // smoke trail up into the sky
          this._trailT = 0.035;
          puffBurst({ x: this.ironRoot.position.x, y: this.ironRoot.position.y - 0.2, z: this.ironRoot.position.z }, { n: 1, size: 0.55, speed: 0.4, rise: 0.2, life: 0.55, colors: [0xffffff, 0xe6e8ee] });
        }

        if (k >= 1) {
          burst('star', this.ironRoot.position, { size: 0.3, grow: 1.4, life: 0.35, spin: 4, scroll: true });
          this.ironRoot.visible = false;
          this._setThrusterPower(0, 0);
          this.phase = 'idle';
          this.active = false;
        }
        break;
      }
    }

    this.ironModel.update(dt);
  }

  update(dt) {
    // nothing needed after player update
  }

  reset() {
    if (this.active) {
      this.player.controlsLocked = false;
      this.player.clearOverride();
      this.player.root.rotation.x = 0;
      game.speedOverride = null;
      if (game.cameraRig) game.cameraRig.setTilt(false);
      if (game.obstacles) game.obstacles.grace(0);
      edgeLines(0);
    }
    this.active = false;
    this.used = false;
    this.elapsed = 0;
    this.flightTime = 0;
    this.phase = 'idle';
    this.ironRoot.visible = false;
    this.ironRoot.rotation.set(0, 0, 0);
    this._setThrusterPower(0, 0);
  }
}
