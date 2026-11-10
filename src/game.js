// game.js — run state and run flow (start / pause / resume / restart / game over).
// The UI only READS game.state and calls the API below; it never writes state.
// main.js wires the world, player and render objects in with game.init().
//
// Systems (G2 obstacles, G8 chaser, G9 web, G10 iron spider ...) plug in with
//   game.addSystem({ beforePlayer(dt) {...}, update(dt) {...}, reset() {...} })  (all optional)
// Each frame while running: world.update -> beforePlayer(dt) of every system (move things,
// set player.floorY) -> player.update -> update(dt) of every system (collisions, pickups).
// reset() runs at every run start, after the core state has been reset.

import { CONFIG } from './config.js';
import { emit } from './events.js';

const state = {
  mode: 'menu',     // 'menu' | 'running' | 'paused' | 'over'
  score: 0,
  coins: 0,
  distance: 0,      // metres run this round
  speed: 0,         // current m/s
  multiplier: 1,    // (mult.base + mult.run + mult.temp) * mult.factor, every running frame
  webCharges: 0,    // G9
  ironCount: 0,     // G10 (persistent inventory; NOT reset per run)
  ironTime: 0,      // G10 seconds left
  senseTime: 0,     // spider-sense seconds left (powerups/sense.js), 0 = off
  magnetTime: 0,    // magnet seconds left (powerups/magnet.js), 0 = off
  bugleTime: 0,     // Bugle Manşeti seconds left (powerups/bugle.js): > 0 = factor 2
  springTime: 0,    // Örümcek Yayı seconds left (powerups/spring.js): > 0 = higher jumps
  swingTime: 0,     // Ağ Salınışı seconds left (powerups/swing.js): > 0 = swinging above the track
  decoyTime: 0,     // Ağ Kuklası seconds left (powerups/decoy.js): > 0 = one stumble is forgiven
  wallTime: 0,      // Duvar Koşusu seconds left (powerups/wall.js): > 0 = running on the wall
  wallMetres: 0,    // metres run on a wall this round (missions.js measures it)
  tracerTime: 0,    // Örümcek İzi seconds left (powerups/tracer.js): > 0 = the drone traces the lane
  time: 0,         // seconds of running this round (extra, not in contract)
  intro: false,     // true while the start-of-run clip plays (intro.js)
};

// Score multiplier (PLAN.md 10): missions.js owns base (1 + finished mission sets, max 30);
// the power-ups own run (Flaş Fotoğraf), temp (Örümcek İzi) and factor 2 (Bugle Manşeti).
// factor is read off state.bugleTime instead of being written by the bugle: zeroing that
// at a run start can then never leave a stale x2 behind.
const mult = { base: 1, run: 0, temp: 0, factor: 1 };

// How much higher a normal jump goes while the Örümcek Yayı is on (player.js / sense.js).
export const jumpScale = () => (state.springTime > 0 ? CONFIG.spring.jumpScale : 1);

// The distance score accumulates here already multiplied; coin score never multiplies.
let scoreAcc = 0;

export const game = {
  state,
  mult,

  obstacles: null,  // G2 obstacle system (main.js)
  chaser: null,     // G8 Venom (main.js)
  web: null,        // G9 web cartridge / zip (main.js)
  iron: null,       // G10 Iron Spider (main.js)
  intro: null,      // start-of-run clip (main.js): begin(), update(dt), skip(), reset()

  // True during the catch sequence (G8): mode stays 'running', but the world, speed and
  // distance stop; the player and systems' update(dt) still run so the catch can play.
  // Systems that move or collide check game.halted.
  halted: false,
  speedOverride: null,
  hitStopT: 0,      // seconds of freeze frame left (hero specials' impacts)
  naturalSpeed: CONFIG.startSpeed, // un-boosted speed; a boost can't leave state.speed raised for good
  fadeRate: 0,      // m/s per second a finished boost falls back to naturalSpeed; 0 = no fall

  // Placeholder control: while true, a tap / any key starts the run from the menu,
  // a tap resumes from pause and restarts after game over.
  // G12 (menu UI) sets this to false and drives game.start()/resume()/restart() itself.
  tapToStart: true,

  // Filled by main.js
  world: null,
  player: null,
  scene: null,
  camera: null,
  cameraRig: null,
  renderer: null,

  systems: [],

  init({ world, player }) {
    this.world = world;
    this.player = player;
  },

  addSystem(system) {
    this.systems.push(system);
    return system;
  },

  start() {
    if (state.mode !== 'menu' && state.mode !== 'over') return;
    this._resetRun();
    state.mode = 'running';
    emit('start', { restart: false });
    if (this.intro) this.intro.begin();
  },

  restart() {
    this._resetRun();
    state.mode = 'running';
    emit('start', { restart: true });
    if (this.intro) this.intro.begin();
  },

  // Back to the main menu: start layout, nothing moving, mode 'menu' (G12 "Ana menü").
  toMenu() {
    if (state.mode === 'menu') return;
    this._resetRun();
    state.mode = 'menu';
    emit('menu');
    if (this.cameraRig) this.cameraRig.snap(this.player);
  },

  // Freeze frame: the whole simulation holds for a moment (the frame keeps rendering).
  hitStop(seconds) {
    if (state.mode === 'running' && !state.intro) this.hitStopT = Math.max(this.hitStopT, seconds);
  },

  // Freeze the world for the catch sequence (see halted).
  halt() {
    this.halted = true;
  },

  pause() {
    if (state.mode !== 'running') return;
    state.mode = 'paused';
    emit('pause');
  },

  resume() {
    if (state.mode !== 'paused') return;
    state.mode = 'running';
    emit('resume');
  },

  // Ends the run (G2 crash, G8 caught). Emits gameover {score, coins, distance}.
  gameOver() {
    if (state.mode !== 'running') return;
    state.mode = 'over';
    emit('gameover', {
      score: state.score,
      coins: state.coins,
      distance: Math.floor(state.distance),
    });
  },

  // Input actions from input.js: left, right, up, down, double, tap, pause.
  handleAction(name) {
    const mode = state.mode;
    if (name === 'pause') {
      if (mode === 'running') this.pause();
      else if (mode === 'paused') this.resume();
      return;
    }
    if (mode === 'menu') {
      if (this.tapToStart) this.start();
      return;
    }
    if (mode === 'paused') {
      if (this.tapToStart && name === 'tap') this.resume();
      return;
    }
    if (mode === 'over') {
      if (this.tapToStart && name === 'tap') this.restart();
      return;
    }
    if (state.intro) {
      this.intro.skip(); // any tap / swipe / key skips the clip
      return;
    }
    this.player.handleAction(name);
  },

  // Called once per frame by main.js with a capped dt.
  update(dt) {
    if (state.mode === 'paused') return;
    if (this.hitStopT > 0 && state.mode === 'running') { // a freeze never outlives the run
      this.hitStopT -= dt;
      return;
    }
    if (state.intro) {
      this.intro.update(dt); // the clip drives player, Venom and camera; the world waits
      return;
    }
    const running = state.mode === 'running';
    const dist0 = state.distance;

    if (running && !this.halted) {
      state.time += dt;
      const accel = this.naturalSpeed < CONFIG.cruiseSpeed ? CONFIG.acceleration
        : this.naturalSpeed < CONFIG.maxSpeed ? CONFIG.acceleration2 : CONFIG.acceleration3;
      this.naturalSpeed = Math.min(CONFIG.topSpeed, this.naturalSpeed + accel * dt);
      if (this.speedOverride != null) {
        // a boost is instant: the jet's 800 m/s must reach its distance without ramping
        this.fadeRate = 0;
        state.speed = this.speedOverride;
      } else if (state.speed > this.naturalSpeed) {
        // the boost just ended: ease down to the natural speed instead of hitting a wall
        if (!this.fadeRate) this.fadeRate = (state.speed - this.naturalSpeed) / CONFIG.boostFadeTime;
        state.speed = Math.max(this.naturalSpeed, state.speed - this.fadeRate * dt);
        if (state.speed === this.naturalSpeed) this.fadeRate = 0;
      } else {
        this.fadeRate = 0;
        state.speed = this.naturalSpeed;
      }
      state.distance += state.speed * dt;
      this.world.update(dt, state.speed);
      for (const s of this.systems) if (s.beforePlayer) s.beforePlayer(dt);
    }

    this.player.update(dt, running);

    if (running) {
      for (const s of this.systems) if (s.update) s.update(dt);
      // every metre gained this frame (a power-up's distance jump included) is paid at the multiplier
      mult.factor = state.bugleTime > 0 ? 2 : 1;
      state.multiplier = (mult.base + mult.run + mult.temp) * mult.factor;
      scoreAcc += (state.distance - dist0) * CONFIG.scorePerMeter * state.multiplier;
      state.score = Math.floor(scoreAcc) + state.coins * CONFIG.coinScore;
    }
  },

  _resetRun() {
    state.score = 0;
    state.coins = 0;
    state.distance = 0;
    scoreAcc = 0;
    mult.run = 0;
    mult.temp = 0;
    mult.factor = 1;
    state.multiplier = mult.base; // base is permanent (missions.js)
    state.time = 0;
    state.speed = CONFIG.startSpeed;
    this.naturalSpeed = CONFIG.startSpeed;
    state.webCharges = 0;
    this.halted = false;
    this.speedOverride = null;
    this.fadeRate = 0;
    this.hitStopT = 0;
    state.ironTime = 0;
    state.bugleTime = 0;
    state.springTime = 0;
    state.wallMetres = 0;
    // state.ironCount is persistent inventory (G10 loads/saves it) — left alone.
    this.world.reset();
    this.player.reset();
    for (const s of this.systems) if (s.reset) s.reset();
    if (this.intro) this.intro.reset();
  },
};
