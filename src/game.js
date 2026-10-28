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
  webCharges: 0,    // G9
  ironCount: 0,     // G10 (persistent inventory; NOT reset per run)
  ironTime: 0,      // G10 seconds left
  time: 0,          // seconds of running this round (extra, not in contract)
};

export const game = {
  state,

  obstacles: null,  // G2 obstacle system (main.js)

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
  },

  restart() {
    this._resetRun();
    state.mode = 'running';
    emit('start', { restart: true });
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
    this.player.handleAction(name);
  },

  // Called once per frame by main.js with a capped dt.
  update(dt) {
    if (state.mode === 'paused') return;
    const running = state.mode === 'running';

    if (running) {
      state.time += dt;
      state.speed = Math.min(CONFIG.maxSpeed, state.speed + CONFIG.acceleration * dt);
      state.distance += state.speed * dt;
      this.world.update(dt, state.speed);
      for (const s of this.systems) if (s.beforePlayer) s.beforePlayer(dt);
    }

    this.player.update(dt, running);

    if (running) {
      for (const s of this.systems) if (s.update) s.update(dt);
      state.score = Math.floor(state.distance * CONFIG.scorePerMeter) + state.coins * CONFIG.coinScore;
    }
  },

  _resetRun() {
    state.score = 0;
    state.coins = 0;
    state.distance = 0;
    state.time = 0;
    state.speed = CONFIG.startSpeed;
    state.webCharges = 0;
    state.ironTime = 0;
    // state.ironCount is persistent inventory (G10 loads/saves it) — left alone.
    this.world.reset();
    this.player.reset();
    for (const s of this.systems) if (s.reset) s.reset();
  },
};
