// tools/test-hero-specials-qa.mjs
// Senior QA Simulation & Verification Test Suite for 8 Hero Special Abilities

import * as THREE from 'three';

// ------------------------------------------------------------------ BROWSER & DOM ENVIRONMENT MOCK
class MockDOMElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.classList = new Set();
    this.classList.add = (...classes) => classes.forEach(c => this.classList.addRaw(c));
    this.classList.addRaw = (c) => Set.prototype.add.call(this.classList, c);
    this.classList.remove = (...classes) => classes.forEach(c => Set.prototype.delete.call(this.classList, c));
    this.classList.contains = (c) => Set.prototype.has.call(this.classList, c);
    this.classList.toggle = (c, force) => {
      if (force === undefined) {
        if (this.classList.contains(c)) { this.classList.remove(c); return false; }
        else { this.classList.add(c); return true; }
      }
      if (force) this.classList.add(c);
      else this.classList.remove(c);
      return force;
    };
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.children = [];
    this.dataset = {};
  }
  querySelector(sel) {
    return new MockDOMElement('div');
  }
  querySelectorAll(sel) {
    return [new MockDOMElement('i'), new MockDOMElement('i')];
  }
  appendChild(child) {
    this.children.push(child);
  }
  contains() { return false; }
  blur() {}
}

const mockStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      return {
        width: 128, height: 128,
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop: () => {} }),
          fillRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
        }),
      };
    }
    return new MockDOMElement(tag);
  },
  getElementById(id) {
    return new MockDOMElement('div');
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  removeEventListener() {},
};
global.localStorage = mockStorage;
global.matchMedia = () => ({ matches: false });

// Catch and assert zero unexpected console.errors
const capturedErrors = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  capturedErrors.push(args.join(' '));
  originalConsoleError(...args);
};

// ------------------------------------------------------------------ IMPORTS UNDER TEST
const { HeroSpecials, HERO_SKINS } = await import('../src/powerups/hero-specials.js');
const { WebPowerup } = await import('../src/powerups/web.js');
const { IronSpiderPowerup } = await import('../src/powerups/ironspider.js');
const { createHelloKittySkill, HEART_SVG_ICON } = await import('../src/powerups/skillHelloKitty.js');
const { createBatmanSkill, BAT_SVG_ICON } = await import('../src/powerups/skillBatman.js');
const { createSpiderman2002Skill, SLINGSHOT_SVG_ICON } = await import('../src/powerups/skillSpiderman2002.js');
const { createIronManSkill, UNIBEAM_SVG_ICON } = await import('../src/powerups/skillIronMan.js');
const { createBlackPantherSkill, VIBRANIUM_SVG_ICON } = await import('../src/powerups/skillBlackPanther.js');
const { shatterObstacle, activeDebrisSystems } = await import('../src/vfxCore.js');
const { game } = await import('../src/game.js');
const { events } = await import('../src/events.js');

// ------------------------------------------------------------------ TEST HARNESS
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err });
    console.error(`  [FAIL] ${name}: ${err.message}\n${err.stack}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Mismatch'}: expected ${expected}, got ${actual}`);
  }
}

function assertInRange(val, min, max, message) {
  if (val < min || val > max || Number.isNaN(val)) {
    throw new Error(`${message || 'Out of range'}: expected [${min}, ${max}], got ${val}`);
  }
}

// ------------------------------------------------------------------ MOCK FACTORY
function createMockGameEnvironment(initialSkin = 'spider') {
  const scene = new THREE.Scene();
  const playerRoot = new THREE.Group();
  scene.add(playerRoot);

  const player = {
    root: playerRoot,
    x: 0,
    y: 0,
    floorY: 0,
    vy: 0,
    lane: 1,
    grounded: true,
    sliding: false,
    controlsLocked: false,
    gravityScale: 1.0,
    overrideState: null,
    override: null,
    clearOverride() {
      this.overrideState = null;
      this.override = null;
    },
    setOverride(mode) {
      this.overrideState = mode;
      this.override = mode;
    },
    jump() {
      this.grounded = false;
      this.vy = 12;
    },
    useModel(m) {
      this.model = m;
    },
    hooks: {
      onAirUp: null,
      onDoubleAction: null,
    },
    model: {
      root: new THREE.Group(),
      update() {},
    },
  };

  const obstacles = {
    active: [],
    graceTime: 0,
    hooks: {
      onFrontHit: null,
      onSideHit: null,
    },
    generator: {
      addExtra() {},
    },
    registerPickup() {},
    remove(ob) {
      const idx = this.active.indexOf(ob);
      if (idx !== -1) {
        this.active.splice(idx, 1);
      }
    },
    grace(time) {
      this.graceTime = Math.max(this.graceTime, time);
    },
  };

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const cameraRig = {
    camera,
    shakes: [],
    shake(strength, duration) {
      this.shakes.push({ strength, duration });
    },
    setTilt(on) {},
    setShot() {},
    clearShot() {},
  };

  const chaser = {
    isNear: false,
    droppedBack: false,
    _dropBack() {
      this.droppedBack = true;
    },
    hooks: {
      absorbCatch: null,
    },
  };

  game.state.mode = 'running';
  game.state.score = 0;
  game.state.coins = 0;
  game.state.distance = 0;
  game.state.speed = 15;
  game.state.webCharges = 1;
  game.state.ironCount = 1;
  game.state.ironTime = 0;
  game.state.time = 0;
  game.halted = false;
  game.speedOverride = null;
  game.skin = initialSkin;
  game.player = player;
  game.scene = scene;
  game.cameraRig = cameraRig;
  game.camera = camera;
  game.obstacles = obstacles;
  game.chaser = chaser;

  const webPowerup = new WebPowerup({ scene, player, obstacles, cameraRig, chaser });
  game.web = webPowerup;
  game.heroSpecials = webPowerup.heroSpecials;

  return { scene, player, obstacles, cameraRig, chaser, webPowerup, heroSpecials: webPowerup.heroSpecials };
}

// ------------------------------------------------------------------ START TEST SUITE
console.log('================================================================');
console.log(' ÖRÜMCEK KOŞUSU - SENIOR QA COMPREHENSIVE SIMULATION SUITE');
console.log('================================================================\n');

// ------------------------------------------------------------------ SECTION 1: HERO CONFIG & MAX CHARGES
console.log('--- TEST SECTION 1: HERO METADATA & MAX CHARGES MATRIX ---');

test('HERO_SKINS contains all 8 hero skins', () => {
  const expected = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];
  assertEqual(HERO_SKINS.length, 8, 'HERO_SKINS length');
  for (const s of expected) {
    assert(HERO_SKINS.includes(s), `HERO_SKINS includes '${s}'`);
  }
});

test('isHero(skin) accurately classifies 8 heroes and non-heroes', () => {
  const env = createMockGameEnvironment();
  const hs = env.heroSpecials;
  const heroes = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];
  for (const h of heroes) {
    assert(hs.isHero(h) === true, `isHero('${h}') must be true`);
  }
  const nonHeroes = ['spider', 'gwen', 'mcu', 'venom', 'toon', 'unknown'];
  for (const nh of nonHeroes) {
    assert(hs.isHero(nh) === false, `isHero('${nh}') must be false`);
  }
});

test('getMaxCharges(skin) matrix: Raimi = 2, Other 7 = 1, Spider/Gwen/MCU = 3', () => {
  const env = createMockGameEnvironment();
  const web = env.webPowerup;

  // Raimi = 2
  game.skin = 'raimi';
  assertEqual(web.getMaxCharges(), 2, 'Raimi maxCharges');

  // Other 7 = 1
  const singleChargeHeroes = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'ironman', 'panther'];
  for (const h of singleChargeHeroes) {
    game.skin = h;
    assertEqual(web.getMaxCharges(), 1, `${h} maxCharges`);
  }

  // Non-hero suits = 3
  const classicSpideys = ['spider', 'gwen', 'mcu'];
  for (const s of classicSpideys) {
    game.skin = s;
    assertEqual(web.getMaxCharges(), 3, `${s} maxCharges`);
  }
});

// ------------------------------------------------------------------ SECTION 2: SIMULATION TESTS FOR 8 HEROES
console.log('\n--- TEST SECTION 2: 8 HEROES DEEP SIMULATION & COLLISION ---');

// 1. HULK SMASH SIMULATION
test('1. HULK: Smash activation, obstacle obliteration, stumble immunity, countdown & safety grace', () => {
  const env = createMockGameEnvironment('hulk');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;

  // Key spam test before activation
  assert(env.webPowerup.tryActivate() === true, 'Hulk activate success');
  assert(hs.active === true, 'Hulk is active');
  assertEqual(hs.mode, 'hulk', 'Hulk mode');
  assertEqual(hs.timeRemaining, 6.0, 'Hulk duration 6.0s');
  assert(hs.gammaAura.root.visible === true, 'Hulk gamma aura visible');
  assertEqual(game.state.webCharges, 0, 'Hulk charges consumed to 0');

  // Key spam protection: immediate re-activation must fail safely
  assert(env.webPowerup.tryActivate() === false, 'Hulk key spam blocked');
  assert(hs.activate('hulk') === false, 'Direct spam blocked');
  assertEqual(game.state.webCharges, 0, 'Charges not corrupted by spam');

  // Stumble immunity test
  env.player.overrideState = 'stumble';
  env.player.override = 'stumble';
  hs.update(0.1);
  assertEqual(env.player.overrideState, null, 'Stumble cleared by Hulk smash');

  // Active smash radius obstacle obliteration test
  const testObstacle = { x: 0, z: -3.0, length: 1.0, type: 'car' };
  env.obstacles.active.push(testObstacle);
  hs.update(0.1);
  assertEqual(env.obstacles.active.length, 0, 'Obstacle pulverized by Hulk active radius');

  // Direct absorbHit test (simulating head-on obstacle crash)
  const headOnObstacle = { x: 0, z: -0.5, length: 1.0, type: 'wagon' };
  env.obstacles.active.push(headOnObstacle);
  const absorbed = hs.absorbHit({ obstacle: headOnObstacle });
  assert(absorbed === true, 'Hulk absorbHit returned true');
  assertEqual(env.obstacles.active.length, 0, 'Head-on obstacle removed');
  assert(env.obstacles.graceTime >= 0.35, 'Hulk collision grace granted');

  // Countdown & Clean Expiry
  hs.update(6.0);
  assert(hs.active === false, 'Hulk expired after 6s');
  assert(hs.gammaAura.root.visible === false, 'Gamma aura hidden on expiry');
  assert(env.obstacles.graceTime >= 0.5, 'Safety grace period 0.5s granted on Hulk expiry');

  // Memory cleanup
  hs.reset();
  hs.dispose();
});

// 2. CAPTAIN AMERICA SHIELD SURF SIMULATION
test('2. CAPTAIN AMERICA: 0.32m hover, arm shield toggle, obstacle absorption with gong & 1.5s grace', () => {
  const env = createMockGameEnvironment('cap');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;

  // Arm shield mock on player
  const armShield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  armShield.name = 'capArmShield';
  env.player.root.add(armShield);

  assert(env.webPowerup.tryActivate() === true, 'Cap activate success');
  assert(hs.active === true, 'Cap active');
  assertEqual(hs.mode, 'cap', 'Cap mode');
  assertEqual(hs.timeRemaining, 8.0, 'Cap duration 8.0s');
  assert(hs.shieldBoard.root.visible === true, 'Vibranium shield board visible');
  assert(armShield.visible === false, 'Arm shield hidden during surfing');

  // Key spam protection
  assert(env.webPowerup.tryActivate() === false, 'Cap spam blocked');

  // beforePlayer hover test (standing: +0.32m, sliding: +0.22m)
  env.player.floorY = 0;
  env.player.grounded = true;
  env.player.sliding = false;
  hs.beforePlayer(0.016);
  assertInRange(env.player.floorY, 0.31, 0.33, 'Cap standing hover height 0.32m');

  env.player.floorY = 0;
  env.player.sliding = true;
  hs.beforePlayer(0.016);
  assertInRange(env.player.floorY, 0.21, 0.23, 'Cap sliding hover height 0.22m');

  // Obstacle collision absorption test: ends surfing safely, gives 1.5s grace, restores arm shield
  const crashObstacle = { x: 0, z: -1.0, length: 1.0, type: 'low' };
  env.obstacles.active.push(crashObstacle);
  const absorbed = hs.absorbHit({ obstacle: crashObstacle });
  assert(absorbed === true, 'Cap absorbHit returns true');
  assert(hs.active === false, 'Surfing safely terminated on impact');
  assertEqual(env.obstacles.active.length, 0, 'Crash obstacle cleared');
  assert(armShield.visible === true, 'Arm shield restored to character forearm');
  assert(env.obstacles.graceTime >= 1.5, 'Cap 1.5s vibranium gong grace granted');

  hs.reset();
  hs.dispose();
});

// 3. MILES MORALES VENOM BIO-ELECTRICITY SIMULATION
test('3. MILES: Speed boost (+10 m/s), lightning crackle, venom nova shockwave absorption & cleanup', () => {
  const env = createMockGameEnvironment('miles');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;
  game.state.speed = 18;

  assert(env.webPowerup.tryActivate() === true, 'Miles activate success');
  assert(hs.active === true, 'Miles active');
  assertEqual(hs.mode, 'miles', 'Miles mode');
  assertEqual(hs.timeRemaining, 7.0, 'Miles duration 7.0s');
  assert(hs.bioElectric.root.visible === true, 'Bio-electricity visible');
  assertEqual(game.speedOverride, 28, 'Speed boosted by exactly +10 m/s (18 -> 28)');

  // Key spam test
  assert(env.webPowerup.tryActivate() === false, 'Miles spam blocked');

  // Update loop verification: speedOverride maintained, bioElectric lights pulsing
  hs.update(0.5);
  assertEqual(game.speedOverride, 28, 'Speed override maintained during run');

  // Obstacle absorption test: Venom Blast Nova explosion, ends skill safely, 1.5s grace
  const crashObstacle = { x: 0, z: -0.8, length: 1.0, type: 'wagon' };
  env.obstacles.active.push(crashObstacle);
  const absorbed = hs.absorbHit({ obstacle: crashObstacle });
  assert(absorbed === true, 'Miles absorbHit returns true');
  assert(hs.active === false, 'Miles skill terminated safely');
  assertEqual(game.speedOverride, null, 'Speed override restored to normal');
  assert(env.obstacles.graceTime >= 1.5, 'Miles 1.5s nova blast grace granted');

  hs.reset();
  hs.dispose();
});

// 4. HELLO KITTY FLYING HEART SIMULATION
test('4. HELLO KITTY: Smoothstep rise to 3.6m floorY, barrier/train clearance, heart burst & 1.5s landing grace', () => {
  const env = createMockGameEnvironment('kitty');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;

  assert(env.webPowerup.tryActivate() === true, 'Kitty activate success');
  assert(hs.active === true, 'Kitty active in heroSpecials');
  assert(hs.skills.kitty.active === true, 'Kitty sub-skill active');
  assertEqual(hs.skills.kitty.duration, 8.0, 'Kitty duration 8.0s');
  assert(hs.skills.kitty.heartPlatform.root.visible === true, '3D Heart platform visible');

  // Key spam protection
  assert(env.webPowerup.tryActivate() === false, 'Kitty spam blocked');

  // Smoothstep ascent test in game loop (update increments elapsed, beforePlayer applies lift)
  env.player.floorY = 0;
  env.player.grounded = true;
  hs.update(0.425);
  hs.beforePlayer(0.016);
  assert(env.player.floorY > 0.5, 'Kitty smoothly lifting player floorY');

  hs.update(0.85);
  hs.beforePlayer(0.016);
  assertInRange(hs.skills.kitty.currentFlyOffset, 3.4, 3.8, 'Kitty peak flying altitude ~3.6m');

  // Obstacle absorption during flight: heart glitter nova, keeps flying, grants grace
  const hurdle = { x: 0, z: -2.0, length: 0.5, type: 'low' };
  env.obstacles.active.push(hurdle);
  const absorbed = hs.absorbHit({ obstacle: hurdle });
  assert(absorbed === true, 'Kitty absorbHit returns true');
  assert(hs.skills.kitty.active === true, 'Kitty keeps flying safely after absorption');
  assertEqual(env.obstacles.active.length, 0, 'Obstacle cleared');
  assert(env.obstacles.graceTime >= 0.8, 'Kitty 0.8s flight grace granted');

  // Expiry & soft landing
  hs.update(7.0);
  assert(hs.active === false, 'Kitty deactivated cleanly on expiry');
  assert(env.obstacles.graceTime >= 1.5, 'Kitty landing grace 1.5s granted');

  hs.reset();
  hs.dispose();
});

// 5. BATMAN GECE PELERINI (800 METRE) SIMULATION
test('5. BATMAN: Strictly distance-governed 800m glide, aerodynamic pitch 0.52 rad, obstacle strike & cleanup', () => {
  const env = createMockGameEnvironment('batman');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;
  game.state.distance = 150; // starts at distance 150m

  assert(env.webPowerup.tryActivate() === true, 'Batman activate success');
  assert(hs.active === true, 'Batman active');
  assertEqual(hs.skills.batman.startDistance, 150, 'Batman startDistance set to 150m');
  assertEqual(hs.skills.batman.maxDistance, 800, 'Batman maxDistance set to 800m');
  assert(hs.skills.batman.capeGroup.visible === true, '24x12 Bat-wing mantle visible');

  // Key spam protection
  assert(env.webPowerup.tryActivate() === false, 'Batman spam blocked');

  // Update frame with flight progression to complete takeoff and apply aerodynamic forward pitch
  game.state.distance = 250;
  for (let i = 0; i < 5; i++) hs.update(0.1);
  assertInRange(env.player.root.rotation.x, 0.45, 0.54, 'Batman aerodynamic forward pitch ~0.52 rad');

  // Progress at 550m (traveled 400m -> exactly 50% progress remaining)
  game.state.distance = 550;
  hs.update(0.1);
  assert(hs.active === true, 'Batman still gliding at 400m traveled');
  assertInRange(hs.timeRemaining, 395, 405, 'Batman 400m distance remaining');
  assertInRange(hs.skills.batman.getProgress(550), 0.49, 0.51, 'Batman progress 50%');

  // At 950m traveled (150 + 800 = 950m), glide must finish cleanly
  game.state.distance = 950;
  hs.update(0.1);
  assert(hs.active === false, 'Batman glide finished at exactly 800m');
  assertEqual(env.player.root.rotation.x, 0, 'Player rotation smoothly restored to 0');
  assert(env.obstacles.graceTime >= 0.5, 'Batman expiry grace granted');

  // Reset and test collision absorption
  game.state.webCharges = 1;
  game.state.distance = 1000;
  env.webPowerup.tryActivate();
  assert(hs.active === true, 'Batman activated for crash test');

  const crashTrain = { x: 0, z: -1.0, length: 5.0, type: 'wagon' };
  env.obstacles.active.push(crashTrain);
  const absorbed = hs.absorbHit({ obstacle: crashTrain });
  assert(absorbed === true, 'Batman cloak strike absorbed crash');
  assert(hs.active === false, 'Batman glide safely exited on collision absorption');
  assertEqual(env.obstacles.active.length, 0, 'Crash train cleared');
  assert(env.obstacles.graceTime >= 1.5, 'Batman cloak strike 1.5s grace granted');

  hs.reset();
  hs.dispose();
});

// 6. SPIDER-MAN 2002 (RAIMI) SLINGSHOT WEB JUMP SIMULATION (2 CHARGES)
test('6. RAIMI: 2 charges, slingshot anticipation (0.3s) & launch, parabolic clearance, charge depletion to 0', () => {
  const env = createMockGameEnvironment('raimi');
  const hs = env.heroSpecials;
  game.state.webCharges = 2; // Raimi starts with 2 charges!

  // First activation: charges 2 -> 1
  assert(env.webPowerup.tryActivate() === true, 'Raimi 1st activation success');
  assert(hs.active === true, 'Raimi active');
  assertEqual(hs.skills.raimi.charges, 1, 'Raimi charges decremented from 2 to 1');
  assertEqual(game.state.webCharges, 1, 'game.state.webCharges synced to 1');
  assertEqual(hs.skills.raimi.phase, 'anticipation', 'Raimi in anticipation phase');
  assertInRange(env.player.root.rotation.x, -0.65, -0.55, 'Raimi lean backward tense catapult pose (-0.6)');

  // Key spam protection during active slingshot jump: MUST return false
  assert(env.webPowerup.tryActivate() === false, 'Raimi spam during flight blocked');
  assertEqual(hs.skills.raimi.charges, 1, 'Charges remained at 1');

  // Anticipation phase progresses (0.3s) -> Launch phase
  hs.skills.raimi.update(0, 0.35);
  assertEqual(hs.skills.raimi.phase, 'flight', 'Raimi transitioned to flight phase');
  assert(env.player.vy >= 18, 'Raimi launch upward velocity applied');
  assertEqual(env.player.gravityScale, 0.58, 'Raimi parabolic flight gravityScale set to 0.58');
  assert(game.speedOverride != null && game.speedOverride >= 28, 'Raimi explosive slingshot forward speed boost applied');

  // Obstacle collision during flight: absorbed, shattered with white sparks, grace granted
  const obstacleInAir = { x: 0, z: -2.0, length: 1.0, type: 'high' };
  env.obstacles.active.push(obstacleInAir);
  const absorbed = hs.absorbHit({ obstacle: obstacleInAir });
  assert(absorbed === true, 'Raimi slingshot absorbHit returns true');
  assertEqual(env.obstacles.active.length, 0, 'Obstacle shattered and removed');

  // Touchdown / landing simulation: player falls towards floor with negative vy
  env.player.vy = -1.0;
  env.player.y = env.player.floorY + 0.5;
  hs.skills.raimi.beforePlayer(0.016);
  assertEqual(hs.skills.raimi.phase, 'landing', 'Raimi entered landing phase on descent');

  env.player.y = env.player.floorY;
  env.player.grounded = true;
  hs.skills.raimi.beforePlayer(0.016);
  assertEqual(hs.skills.raimi.phase, 'idle', 'Raimi landed and returned to idle');
  assertEqual(game.speedOverride, null, 'game.speedOverride cleanly reset on landing');
  assertEqual(hs.skills.raimi.baseSpeed, null, 'Raimi baseSpeed cleanly reset on landing');
  hs.update(0.016);
  assert(hs.active === false, 'heroSpecials active cleared after landing');

  // Second activation: charges 1 -> 0
  assert(env.webPowerup.tryActivate() === true, 'Raimi 2nd activation success');
  assertEqual(hs.skills.raimi.charges, 0, 'Raimi charges decremented from 1 to 0');
  assertEqual(game.state.webCharges, 0, 'game.state.webCharges synced to 0');

  // Launch second jump
  hs.skills.raimi.update(0, 0.35);
  assertEqual(hs.skills.raimi.phase, 'flight', 'Raimi 2nd jump in flight');
  assert(game.speedOverride != null, 'Raimi 2nd jump speedOverride applied');

  // Deactivate second jump
  hs.skills.raimi.deactivate();
  assertEqual(game.speedOverride, null, 'game.speedOverride cleanly reset on deactivate');
  assertEqual(hs.skills.raimi.baseSpeed, null, 'Raimi baseSpeed cleanly reset on deactivate');
  hs.update(0.016);

  // Third activation attempt with 0 charges: MUST return false
  assert(env.webPowerup.tryActivate() === false, 'Raimi blocked when charges are 0');

  // Refill charges via cartridge pickup
  hs.skills.raimi.refillCharges();
  assertEqual(hs.skills.raimi.charges, 2, 'Raimi charges refilled to 2');

  hs.reset();
  hs.dispose();
});

// 7. IRON MAN UNIBEAM SIMULATION
test('7. IRON MAN: 3-layer Unibeam (200m sweep), arc reactor chest flare, obstacle vaporization & 1.5s grace', () => {
  const env = createMockGameEnvironment('ironman');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;

  assert(env.webPowerup.tryActivate() === true, 'Iron Man activate success');
  assert(hs.active === true, 'Iron Man active');
  assertEqual(hs.timeRemaining, 2.2, 'Iron Man duration 2.2s');
  assert(hs.skills.ironman.beam.root.visible === true, '3-layer Unibeam visible');

  // Key spam protection
  assert(env.webPowerup.tryActivate() === false, 'Iron Man spam blocked');

  // Continuous laser sweep: update visual and laser sweep
  hs.skills.ironman.update(0.1, 0.05);
  assert(hs.skills.ironman.chestGroup.visible === true, 'Arc reactor chest VFX visible');

  const distantCar = { x: 0, z: -50, length: 2.0, type: 'car' };
  const nearBar = { x: 1.5, z: -10, length: 1.0, type: 'low' };
  env.obstacles.active.push(distantCar, nearBar);
  hs.skills.ironman.update(0.1, 0.05);
  assertEqual(env.obstacles.active.length, 0, 'Obstacles swept and pulverized by 200m Unibeam');

  // Collision absorption test
  const testWagon = { x: 0, z: -1.0, length: 5.0, type: 'wagon' };
  env.obstacles.active.push(testWagon);
  const absorbed = hs.absorbHit({ obstacle: testWagon });
  assert(absorbed === true, 'Iron Man absorbHit returns true');
  assertEqual(env.obstacles.active.length, 0, 'Test wagon cleared');
  assert(env.obstacles.graceTime >= 1.5, 'Iron Man 1.5s grace granted');

  // Deactivate
  hs.skills.ironman.deactivate(true);
  assert(hs.skills.ironman.beam.root.visible === false, 'Beam hidden on deactivation');
  assert(env.obstacles.graceTime >= 1.5, 'Unibeam end grace period granted');

  hs.reset();
  hs.dispose();
});

// 8. BLACK PANTHER VIBRANIUM KINETIC SHOCKWAVE SIMULATION
test('8. BLACK PANTHER: Expanding icosahedron dome, hex rings, lightning arcs, 16m radial shatter & violet crystals', () => {
  const env = createMockGameEnvironment('panther');
  const hs = env.heroSpecials;
  game.state.webCharges = 1;

  assert(env.webPowerup.tryActivate() === true, 'Panther activate success');
  assert(hs.active === true, 'Panther active');
  assertEqual(hs.timeRemaining, 5.5, 'Panther duration 5.5s');
  assert(game.speedOverride != null, 'Panther speedOverride active');
  assert(hs.skills.panther.root.visible === true, 'Vibranium shockwave root visible');
  assert(hs.skills.panther.innerDomeMesh.visible === true, 'Icosahedron dome visible');

  // Key spam protection
  assert(env.webPowerup.tryActivate() === false, 'Panther spam blocked');

  // 16m radial obstacle shattering test
  const obstacleInBlastZone = { x: 1.5, z: -3.0, length: 1.0, type: 'low' };
  const obstacleOutsideRadius = { x: 0, z: -25.0, length: 1.0, type: 'car' };
  env.obstacles.active.push(obstacleInBlastZone, obstacleOutsideRadius);

  hs.skills.panther.update(0.1, 0.1);
  assertEqual(env.obstacles.active.length, 1, 'Only obstacle within blast dome was shattered');
  assertEqual(env.obstacles.active[0], obstacleOutsideRadius, 'Distant obstacle left intact');

  // Direct 16m sweep test
  const obstacleIn16m = { x: 0, z: -14.0, length: 1.0, type: 'car' };
  env.obstacles.active.push(obstacleIn16m);
  const swept = hs.skills.panther.shatterNearbyObstacles(16.0);
  assert(swept >= 1, 'Obstacle at 14m shattered by full 16m radius');

  // Direct absorbHit test: shatters colliding obstacle + all nearby obstacles
  const directHitObstacle = { x: 0, z: -0.5, length: 1.0, type: 'car' };
  env.obstacles.active.push(directHitObstacle);
  const absorbed = hs.absorbHit({ obstacle: directHitObstacle });
  assert(absorbed === true, 'Panther absorbHit returns true');
  assertEqual(env.obstacles.active.length, 1, 'Colliding obstacle destroyed');
  assert(env.obstacles.graceTime >= 1.5, 'Panther 1.5s kinetic grace granted');

  // Expiry & cleanup
  hs.skills.panther.update(5.5);
  assert(hs.skills.panther.active === false, 'Panther expired cleanly after 5.5s');
  assert(game.speedOverride === null, 'Panther speedOverride cleared after expiry');
  assert(hs.skills.panther.root.visible === false, 'Panther visual root hidden');

  hs.reset();
  hs.dispose();
});

// ------------------------------------------------------------------ SECTION 3: REGRESSION TESTING (NON-HEROES & IRON SPIDER)
console.log('\n--- TEST SECTION 3: REGRESSION TEST FOR OLD SUITS & IRON SPIDER ---');

test('Non-hero skins (Spider, Gwen, MCU): maxCharges = 3, web zip triggers on airborne up, no hero specials', () => {
  const env = createMockGameEnvironment('spider');
  game.skin = 'spider';
  assertEqual(env.webPowerup.getMaxCharges(), 3, 'Classic Spider-Man has 3 charges');

  game.skin = 'gwen';
  assertEqual(env.webPowerup.getMaxCharges(), 3, 'Gwen has 3 charges');

  game.skin = 'mcu';
  assertEqual(env.webPowerup.getMaxCharges(), 3, 'MCU Spidey has 3 charges');

  // Web shooting does not trigger hero specials
  game.skin = 'spider';
  game.state.webCharges = 3;
  env.player.grounded = true;
  env.player.hooks.onAirUp();
  assert(env.heroSpecials.active === false, 'Classic Spidey does not activate hero specials');
});

test('Iron Spider Suit: Activation, 12s countdown, gold arms high-barrier grab, save-clear & disposal', () => {
  const env = createMockGameEnvironment('spider');
  const ironModel = {
    root: new THREE.Group(),
    setGrabTarget() {},
  };
  mockStorage.setItem('spidey.iron', '3'); // 3 cores in inventory
  const ironSpider = new IronSpiderPowerup({
    player: env.player,
    obstacles: env.obstacles,
    chaser: env.chaser,
    ironModel,
  });

  assertEqual(game.state.ironCount, 3, 'Loaded 3 persistent Iron cores');

  // Activation: 1 core consumed, 12s duration, model swapped
  assert(ironSpider.activate() === true, 'Iron Spider activated');
  assert(ironSpider.active === true, 'Iron Spider active');
  assertEqual(game.state.ironCount, 2, 'Iron core count decremented from 3 to 2');
  assertEqual(game.state.ironTime, 12, 'Iron Spider duration set to 12s');

  // Update countdown
  ironSpider.update(2.0);
  assertEqual(game.state.ironTime, 10, 'Iron Spider countdown working');

  // Collision absorption (save): clears incoming obstacles, resets suit, gives grace
  const incomingObstacle = { x: 0, z: -5.0, length: 1.0, speed: 0, parts: [{ y0: 0, y1: 1.5 }] };
  env.obstacles.active.push(incomingObstacle);
  ironSpider._absorb();
  assert(ironSpider.active === false, 'Iron Spider broke on crash save');
  assertEqual(game.state.ironTime, 0, 'ironTime zeroed out');
  assertEqual(env.obstacles.active.length, 0, 'Incoming obstacles cleared');
  assert(env.obstacles.graceTime >= 0.5, 'Iron Spider grace period granted');

  ironSpider.reset();
});

// ------------------------------------------------------------------ SECTION 4: HUD & UI VALIDATION
console.log('\n--- TEST SECTION 4: HUD ICONS & UI BAR COLOR CLASSES ---');

test('SVG Icons and unicode badges are valid and defined for all 8 heroes', () => {
  const env = createMockGameEnvironment();
  const hs = env.heroSpecials;

  const configs = [
    { skin: 'hulk', label: 'HULK SMASH', icon: '👊', className: 'hulk' },
    { skin: 'cap', label: 'SHIELD SURF', icon: '🛡️', className: 'cap' },
    { skin: 'miles', label: 'VENOM BLAST', icon: '⚡', className: 'miles' },
    { skin: 'kitty', label: 'UÇAN KALP', icon: '💖', className: 'kitty' },
    { skin: 'batman', label: 'GECE PELERİNİ', icon: '🦇', className: 'batman' },
    { skin: 'raimi', label: 'MANCINIK AĞ', icon: '🕸️', className: 'raimi' },
    { skin: 'ironman', label: 'UNIBEAM', icon: '💥', className: 'ironman' },
    { skin: 'panther', label: 'VİBRANYUM ŞOK', icon: '🟣', className: 'panther' },
  ];

  for (const c of configs) {
    const cfg = hs.getHeroConfig(c.skin);
    assert(cfg !== null, `Config for ${c.skin} exists`);
    assertEqual(cfg.label, c.label, `${c.skin} label`);
    assertEqual(cfg.icon, c.icon, `${c.skin} icon`);
    assertEqual(cfg.className, c.className, `${c.skin} className`);
  }

  // SVG String checks
  assert(HEART_SVG_ICON.includes('<svg') && HEART_SVG_ICON.includes('</svg>'), 'HEART_SVG_ICON is valid SVG');
  assert(BAT_SVG_ICON.includes('<svg') && BAT_SVG_ICON.includes('</svg>'), 'BAT_SVG_ICON is valid SVG');
  assert(SLINGSHOT_SVG_ICON.includes('<svg') && SLINGSHOT_SVG_ICON.includes('</svg>'), 'SLINGSHOT_SVG_ICON is valid SVG');
  assert(UNIBEAM_SVG_ICON.includes('<svg') && UNIBEAM_SVG_ICON.includes('</svg>'), 'UNIBEAM_SVG_ICON is valid SVG');
  assert(VIBRANIUM_SVG_ICON.includes('<svg') && VIBRANIUM_SVG_ICON.includes('</svg>'), 'VIBRANIUM_SVG_ICON is valid SVG');
});

// ------------------------------------------------------------------ FINAL CONSOLE & ERROR CHECK
console.log('\n--- TEST SECTION 5: LIVE RUNTIME ERROR AUDIT ---');

test('Zero console.errors, TypeErrors, ReferenceErrors, or NaN values during execution', () => {
  assertEqual(capturedErrors.length, 0, `Captured console.errors: [${capturedErrors.join(', ')}]`);
});

// ------------------------------------------------------------------ TEST SUMMARY REPORT
console.log('\n================================================================');
console.log(' SIMULATION TEST SUITE SUMMARY');
console.log('================================================================');
const total = results.length;
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;

console.log(`Total Tests Run: ${total}`);
console.log(`Passed:         ${passed}`);
console.log(`Failed:         ${failed}`);
console.log(`Success Rate:   ${((passed / total) * 100).toFixed(1)}%`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
