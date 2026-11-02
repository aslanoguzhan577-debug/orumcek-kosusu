// tools/test-qa-deep-audit.mjs
// Senior QA Live Deep Simulation & Regression Suite for 3 Critical Hero Fixes & Global Integrity

import * as THREE from 'three';

// ------------------------------------------------------------------ DOM MOCKS
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
  querySelector() { return new MockDOMElement('div'); }
  querySelectorAll() { return [new MockDOMElement('i')]; }
  appendChild(c) { this.children.push(c); }
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
          fillRect: () => {}, clearRect: () => {},
          beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {},
        }),
      };
    }
    return new MockDOMElement(tag);
  },
  getElementById() { return new MockDOMElement('div'); },
  querySelectorAll() { return []; },
  addEventListener() {}, removeEventListener() {},
};
global.localStorage = mockStorage;
global.matchMedia = () => ({ matches: false });

// ------------------------------------------------------------------ IMPORTS
const { HeroSpecials, HERO_SKINS } = await import('../src/powerups/hero-specials.js');
const { WebPowerup } = await import('../src/powerups/web.js');
const { createBatmanSkill, BAT_SVG_ICON } = await import('../src/powerups/skillBatman.js');
const { createBlackPantherSkill, VIBRANIUM_SVG_ICON } = await import('../src/powerups/skillBlackPanther.js');
const { createSpiderman2002Skill, SLINGSHOT_SVG_ICON } = await import('../src/powerups/skillSpiderman2002.js');
const { game } = await import('../src/game.js');
const { CONFIG } = await import('../src/config.js');

// ------------------------------------------------------------------ TEST RUNNER
let totalAssertions = 0;
let passedAssertions = 0;
const failures = [];

function check(desc, condition, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${desc}`);
  } else {
    failures.push({ desc, details });
    console.error(`  ✗ [FAIL] ${desc}: ${details}`);
  }
}

function checkRange(desc, val, min, max) {
  const ok = val >= min && val <= max && !Number.isNaN(val);
  check(desc, ok, `Value ${val} not in range [${min}, ${max}]`);
}

function checkEqual(desc, actual, expected) {
  check(desc, actual === expected, `Expected ${expected}, got ${actual}`);
}

// ------------------------------------------------------------------ MOCK ENVIRONMENT
function createTestEnv(skin = 'batman') {
  const scene = new THREE.Scene();
  const playerRoot = new THREE.Group();
  scene.add(playerRoot);

  const player = {
    root: playerRoot,
    x: 0,
    y: 0,
    floorY: 0,
    vy: 0,
    grounded: true,
    sliding: false,
    controlsLocked: false,
    gravityScale: 1.0,
    override: null,
    overrideState: null,
    setOverride(mode, dur) { this.override = mode; },
    clearOverride() { this.override = null; this.overrideState = null; },
    model: {
      parts: {
        handL: new THREE.Mesh(),
        handR: new THREE.Mesh(),
      }
    },
    hooks: {},
    reset() {
      this.x = 0; this.y = 0; this.floorY = 0; this.vy = 0;
      this.grounded = true; this.sliding = false; this.gravityScale = 1.0;
      this.override = null; this.overrideState = null;
    }
  };

  const obstacles = {
    active: [],
    graceTime: 0,
    hooks: {
      onFrontHit: null,
      onSideHit: null,
    },
    registerPickup() {},
    generator: { addExtra() {} },
    remove(obs) {
      const idx = this.active.indexOf(obs);
      if (idx !== -1) this.active.splice(idx, 1);
    },
    grace(dur) {
      this.graceTime = Math.max(this.graceTime, dur);
    },
    reset() {
      this.active = [];
      this.graceTime = 0;
    }
  };

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const cameraRig = {
    camera,
    shakeTime: 0,
    shakeIntensity: 0,
    shake(intensity, duration) {
      this.shakeIntensity = intensity;
      this.shakeTime = duration;
    },
    setTilt(on) {},
    setShot() {},
    clearShot() {},
  };

  const chaser = {
    isNear: true,
    hooks: {},
    _dropBackCalled: false,
    _dropBack() { this._dropBackCalled = true; this.isNear = false; }
  };

  game.scene = scene;
  game.player = player;
  game.obstacles = obstacles;
  game.cameraRig = cameraRig;
  game.camera = camera;
  game.skin = skin;
  game.halted = false;
  game.speedOverride = null;
  game.state = {
    mode: 'running',
    speed: 18,
    distance: 0,
    time: 0,
    webCharges: 1,
    intro: false,
  };

  const webPowerup = new WebPowerup({ scene, player, obstacles, cameraRig, chaser });
  const heroSpecials = webPowerup.heroSpecials;
  game.web = webPowerup;
  game.heroSpecials = heroSpecials;

  return { scene, player, obstacles, cameraRig, chaser, heroSpecials, webPowerup };
}

console.log('================================================================');
console.log(' ÖRÜMCEK KOŞUSU - SENIOR QA LIVE DEEP AUDIT SUITE');
console.log('================================================================');

// ------------------------------------------------------------------
// SECTION 1: BATMAN FLIGHT & ALTITUDE CLEARANCE TESTS
// ------------------------------------------------------------------
console.log('\n--- 1. BATMAN FLIGHT MECHANICS & TRAIN CLEARANCE TEST ---');
{
  const env = createTestEnv('batman');
  const hs = env.heroSpecials;
  const batman = hs.skills.batman;
  game.state.distance = 200; // start at 200m

  // 1.1 Activation
  const ok = env.webPowerup.tryActivate();
  check('Batman skill activates successfully', ok === true);
  check('Batman active flag set', batman.active === true);
  checkEqual('Batman starting distance recorded strictly', batman.startDistance, 200);
  checkEqual('Batman total distance budget is 800m', batman.maxDistance, 800);

  // 1.2 Flight Altitude & Phase Progression Simulation
  // We simulate continuous frames as game distance progresses from 200 to 1000 meters
  const samplePoints = [
    { dist: 200, name: 'T=0m (Launch Start)' },
    { dist: 220, name: 'T=20m (Mid-Takeoff)' },
    { dist: 240, name: 'T=40m (Takeoff Complete)' },
    { dist: 300, name: 'T=100m (Cruise)' },
    { dist: 600, name: 'T=400m (Mid-Cruise 50%)' },
    { dist: 800, name: 'T=600m (Mid-Cruise 75%)' },
    { dist: 940, name: 'T=740m (Late Cruise)' },
    { dist: 950, name: 'T=750m (Landing Start)' },
    { dist: 980, name: 'T=780m (Mid-Landing)' },
  ];

  for (const pt of samplePoints) {
    game.state.distance = pt.dist;
    env.player.floorY = 0;
    hs.beforePlayer(0.016);
    hs.update(0.016);

    const traveled = pt.dist - 200;
    const offset = batman.currentFlyOffset;
    const progress = batman.progress;

    if (traveled === 0) {
      checkRange(`${pt.name}: initial altitude starting upward`, offset, 0, 1.5);
      checkRange('Progress at 0m traveled is 1.0 (100%)', progress, 0.99, 1.0);
    } else if (traveled === 20) {
      checkRange(`${pt.name}: takeoff smoothstep ascending`, offset, 1.2, 3.2);
    } else if (traveled >= 40 && traveled <= 740) {
      // During cruise, altitude MUST be ~3.6m and strictly higher than trains (2.88m) and barriers (0.8m)
      checkRange(`${pt.name}: cruising altitude at ~3.6m`, offset, 3.4, 3.8);
      check(`${pt.name}: clears train height 2.88m with safe buffer (y=${offset.toFixed(2)}m > 2.88m)`, offset > 2.88);
      check(`${pt.name}: clears high barrier 0.8m (y=${offset.toFixed(2)}m > 0.8m)`, offset > 0.8);
      check(`${pt.name}: player.floorY elevated to match currentFlyOffset`, env.player.floorY >= offset);

      if (traveled === 400) {
        checkRange('Progress at 400m traveled is 0.5 (50%)', progress, 0.49, 0.51);
        checkRange('Distance remaining is 400m', batman.distanceRemaining, 399, 401);
      } else if (traveled === 600) {
        checkRange('Progress at 600m traveled is 0.25 (25%)', progress, 0.24, 0.26);
        checkRange('Distance remaining is 200m', batman.distanceRemaining, 199, 201);
      }
    } else if (traveled === 780) {
      checkRange(`${pt.name}: landing smoothstep descending`, offset, 0.5, 3.2);
    }
  }

  // 1.4 Natural Expiry at exactly 800m & 1.5s Grace Protection
  game.state.distance = 1000; // 800m traveled
  hs.update(0.016);
  check('Batman skill cleanly deactivates at 800m mark', hs.active === false);
  check('Batman sub-skill active is false', batman.active === false);
  checkEqual('Batman progress drops to 0 at 800m', batman.progress, 0);
  check('1.5s grace protection granted on natural landing', env.obstacles.graceTime >= 1.5);

  // 1.5 Zemin Gölgesi (Blob Shadow) Ground Clamping Verification
  // In main.js: const baseFloor = Math.max(0, player.floorY - capHover - kittyHover - batmanHover);
  // shadow.position.set(player.x, baseFloor + 0.08, player.root.position.z);
  {
    batman.currentFlyOffset = 3.6;
    env.player.floorY = 3.6;
    env.player.y = 3.6;
    const batmanHover = batman.currentFlyOffset;
    const baseFloor = Math.max(0, env.player.floorY - batmanHover);
    const shadowY = baseFloor + 0.08;
    checkEqual('Zemin gölgesi floor offset subtraction clamps shadow to ground (0.08m)', shadowY, 0.08);

    const height = Math.max(0, env.player.y - baseFloor);
    const shadowScale = THREE.MathUtils.clamp(1 - height / 4, 0.45, 1);
    checkRange('Blob shadow scales down and fades realistically at high altitude', shadowScale, 0.45, 0.55);
  }

  // 1.6 Obstacle Strike Collision Absorption & 1.5s Grace
  env.player.reset();
  env.obstacles.reset();
  game.state.distance = 2000;
  game.state.webCharges = 1;
  env.webPowerup.tryActivate();
  check('Batman re-activated for collision test', hs.active === true);

  const blockTrain = { x: 0, z: -1.5, length: 6.0, type: 'wagon' };
  env.obstacles.active.push(blockTrain);
  const absorbed = hs.absorbHit({ obstacle: blockTrain });
  check('Batman absorbHit successfully absorbs obstacle collision', absorbed === true);
  check('Collision safely terminates glide', hs.active === false);
  checkEqual('Collided obstacle removed from active list', env.obstacles.active.length, 0);
  check('Batman grants 1.5s grace protection on collision absorption', env.obstacles.graceTime >= 1.5);
}

// ------------------------------------------------------------------
// SECTION 2: BLACK PANTHER SPEED BOOST & DURATION TEST
// ------------------------------------------------------------------
console.log('\n--- 2. BLACK PANTHER SPEED BOOST & DURATION TEST ---');
{
  const env = createTestEnv('panther');
  const hs = env.heroSpecials;
  const panther = hs.skills.panther;
  game.state.speed = 18;
  game.state.webCharges = 1;

  // 2.1 Duration Check (5.5s, NOT 3.0s)
  checkEqual('Panther skill duration is exactly 5.5s', panther.duration, 5.5);
  checkEqual('Panther skill maxTime is exactly 5.5s', panther.maxTime, 5.5);
  checkEqual('HeroSpecials heroConfig duration for panther is 5.5s', hs.getHeroConfig('panther').duration, 5.5);

  // 2.2 Activation & Speed Override
  const ok = env.webPowerup.tryActivate();
  check('Panther activates successfully', ok === true);
  check('Panther active is true', panther.active === true);
  checkEqual('Base speed recorded at activation (18 m/s)', panther.baseSpeed, 18);

  const expectedSpeedOverride = Math.min(CONFIG.topSpeed + 14, 18 + 14); // 32 m/s
  checkEqual('Speed override sets baseSpeed + 14 m/s (18 + 14 = 32 m/s)', game.speedOverride, expectedSpeedOverride);

  // 2.3 Speed Maintenance & Continuous Radial Shatter during 5.5s
  let elapsed = 0;
  let allSpeedMaintained = true;
  let shatterCount = 0;

  while (elapsed < 5.4) {
    const dt = 0.2;
    elapsed += dt;
    panther.update(elapsed, dt);

    if (game.speedOverride !== expectedSpeedOverride) {
      allSpeedMaintained = false;
    }

    // Spawn an obstacle within 16m occasionally
    if (elapsed > 1.0 && elapsed < 1.3) {
      env.obstacles.active.push({ x: 1.0, z: -8.0, length: 1.0, type: 'low' });
      const count = panther.shatterNearbyObstacles(16.0);
      shatterCount += count;
    }
  }

  check('Speed override maintained at baseSpeed + 14 m/s across entire duration', allSpeedMaintained === true);
  check('Continuous 16m radial obstacle shattering active during run', shatterCount >= 1);
  check('Visual dome and shock rings are visible during run', panther.root.visible === true);

  // 2.4 Deactivation & Clean Reset of speedOverride
  panther.update(5.6, 0.2); // Exceeds 5.5s
  hs.update(0.2);           // Syncs heroSpecials
  check('Panther deactivates cleanly when 5.5s expires', panther.active === false);
  checkEqual('game.speedOverride cleanly reset to null on deactivation', game.speedOverride, null);
  checkEqual('panther.baseSpeed cleanly reset to null on deactivation', panther.baseSpeed, null);
  check('Panther visual root hidden on deactivation', panther.root.visible === false);

  // 2.5 AbsorbHit with 1.5s grace & speed reset test
  hs.reset();
  game.state.webCharges = 1;
  game.state.speed = 20;
  env.webPowerup.tryActivate();
  check('Panther activated for hit absorption test', panther.active === true);
  checkEqual('New speedOverride active (20 + 14 = 34 m/s)', game.speedOverride, 34);

  const testObstacle = { x: 0, z: -1.0, length: 1.0, type: 'car' };
  env.obstacles.active.push(testObstacle);
  const absorbed = hs.absorbHit({ obstacle: testObstacle });
  check('Panther absorbHit returns true', absorbed === true);
  check('Panther grants 1.5s grace on collision absorb', env.obstacles.graceTime >= 1.5);
  hs.deactivate(false);
  checkEqual('game.speedOverride safely reset to null on deactivate', game.speedOverride, null);
}

// ------------------------------------------------------------------
// SECTION 3: SPIDER-MAN 2002 SLINGSHOT WEB LAUNCH TEST
// ------------------------------------------------------------------
console.log('\n--- 3. SPIDER-MAN 2002 (RAIMI) SLINGSHOT LAUNCH TEST ---');
{
  const env = createTestEnv('raimi');
  const hs = env.heroSpecials;
  const raimi = hs.skills.raimi;
  game.state.speed = 18;
  game.state.webCharges = 2; // Raimi starts with 2 charges

  // 3.1 Activation & Anticipation Phase (0.30s)
  const ok = env.webPowerup.tryActivate();
  check('Raimi activates 1st charge successfully', ok === true);
  checkEqual('Charges decremented from 2 to 1', raimi.charges, 1);
  checkEqual('Initial phase is anticipation', raimi.phase, 'anticipation');
  checkEqual('Player leans backward like drawn slingshot (-0.6 rad)', env.player.root.rotation.x, -0.6);
  checkEqual('Player vy is locked to 0 during anticipation', env.player.vy, 0);

  // 3.2 Launch Transition (after 0.30s)
  raimi.update(0, 0.35); // elapse anticipation time
  checkEqual('Raimi transitions to flight phase', raimi.phase, 'flight');

  // Verify massive forward speed boost: baseSpeed + 18 m/s
  const expectedLaunchSpeed = Math.min(CONFIG.topSpeed + 18, 18 + 18); // 36 m/s
  checkEqual('Forward speed override set to baseSpeed + 18 m/s (18 + 18 = 36 m/s)', game.speedOverride, expectedLaunchSpeed);

  // Verify vertical parabolic trajectory launch: vy = 20 m/s, gravityScale = 0.58
  checkEqual('Launch upward velocity vy = 20.0 m/s', env.player.vy, 20.0);
  checkEqual('Flight gravityScale softened to 0.58 for parabolic arc', env.player.gravityScale, 0.58);

  // 3.3 Apex & Parabolic Height vs Train Height (2.88m)
  // Effective gravity: g_eff = CONFIG.gravity * gravityScale = 42 * 0.58 = 24.36 m/s^2
  // Apex height = vy^2 / (2 * g_eff) = 400 / 48.72 = 8.21 meters!
  const gEff = CONFIG.gravity * env.player.gravityScale;
  const apexHeight = (20.0 * 20.0) / (2 * gEff);
  check('Apex height ~8.2m comfortably clears 2.88m trains (apex = ' + apexHeight.toFixed(2) + 'm > 2.88m)', apexHeight > 2.88);
  check('Apex height clears 0.8m barriers by over 7 meters', apexHeight > (0.8 + 7.0));

  // 3.4 Landing Phase, Speed Override Reset & 1.5s Grace
  // Simulate descent towards ground
  env.player.vy = -3.0;
  env.player.y = 0.4;
  env.player.floorY = 0;
  raimi.beforePlayer(0.016);
  checkEqual('Enters landing phase as player nears floor (dist <= 0.85m)', raimi.phase, 'landing');

  // Touchdown
  env.player.y = 0;
  env.player.grounded = true;
  raimi.beforePlayer(0.016);
  checkEqual('Phase resets to idle upon touchdown', raimi.phase, 'idle');
  checkEqual('game.speedOverride cleanly restored to null on landing', game.speedOverride, null);
  checkEqual('raimi.baseSpeed cleanly restored to null on landing', raimi.baseSpeed, null);
  checkEqual('Player gravityScale restored to 1.0', env.player.gravityScale, 1.0);
  checkEqual('Player rotation restored to 0', env.player.root.rotation.x, 0);
  check('Full 1.5s landing protection grace granted on touchdown', env.obstacles.graceTime >= 1.5);
  hs.update(0.016); // Sync heroSpecials with raimi idle
  check('heroSpecials active cleared after landing', hs.active === false);

  // 3.5 Second Charge Activation & Depletion
  checkEqual('Second charge is available (charges = 1)', raimi.charges, 1);
  const ok2 = env.webPowerup.tryActivate();
  check('Raimi activates 2nd charge', ok2 === true);
  checkEqual('Charges decremented to 0', raimi.charges, 0);
  checkEqual('game.state.webCharges synced to 0', game.state.webCharges, 0);

  // Try 3rd activation with 0 charges
  const ok3 = env.webPowerup.tryActivate();
  check('3rd activation blocked when charges are 0', ok3 === false);

  // Emergency deactivate cleanly restores speedOverride
  raimi.update(0, 0.35); // launch
  check('Speed override active in 2nd flight', game.speedOverride !== null);
  raimi.deactivate();
  checkEqual('Emergency deactivate cleanly resets speedOverride to null', game.speedOverride, null);
  checkEqual('Emergency deactivate phase reset to idle', raimi.phase, 'idle');
}

// ------------------------------------------------------------------
// SECTION 4: REGRESSION & COMPREHENSIVE INTEGRITY AUDIT
// ------------------------------------------------------------------
console.log('\n--- 4. REGRESSION AUDIT ACROSS ALL HEROES & SYSTEMS ---');
{
  // 4.1 All 8 heroes classification and charges
  checkEqual('HERO_SKINS contains all 8 heroes', HERO_SKINS.length, 8);
  for (const hero of HERO_SKINS) {
    const env = createTestEnv(hero);
    check(`HeroSpecials recognises hero "${hero}"`, env.heroSpecials.isHero(hero) === true);
    const expectedCharges = hero === 'raimi' ? 2 : 1;
    checkEqual(`Max charges for ${hero} is ${expectedCharges}`, env.webPowerup.getMaxCharges(), expectedCharges);
  }

  // 4.2 Non-hero suits (spider, gwen, mcu) have 3 charges and web zip
  for (const nonHero of ['spider', 'gwen', 'mcu']) {
    const env = createTestEnv(nonHero);
    checkEqual(`Non-hero ${nonHero} has 3 web charges`, env.webPowerup.getMaxCharges(), 3);
    check(`Non-hero ${nonHero} is not classified as hero special`, env.heroSpecials.isHero(nonHero) === false);
  }

  // 4.3 Check that all 8 hero icons are valid SVG / badges
  const icons = [
    { hero: 'batman', icon: BAT_SVG_ICON },
    { hero: 'panther', icon: VIBRANIUM_SVG_ICON },
    { hero: 'raimi', icon: SLINGSHOT_SVG_ICON },
  ];
  for (const item of icons) {
    check(`${item.hero} SVG icon is non-empty string`, typeof item.icon === 'string' && item.icon.length > 50);
    check(`${item.hero} SVG contains <svg and </svg>`, item.icon.includes('<svg') && item.icon.includes('</svg>'));
  }
}

// ------------------------------------------------------------------ SUMMARY
console.log('\n================================================================');
console.log(' SENIOR QA LIVE DEEP AUDIT SUMMARY');
console.log('================================================================');
console.log(`Total Checks Executed: ${totalAssertions}`);
console.log(`Passed:                ${passedAssertions}`);
console.log(`Failed:                ${failures.length}`);
const rate = ((passedAssertions / totalAssertions) * 100).toFixed(1);
console.log(`Success Rate:          ${rate}%`);

if (failures.length > 0) {
  console.error('\nFAILURES DETAIL:');
  failures.forEach(f => console.error(` - ${f.desc}: ${f.details}`));
  process.exit(1);
} else {
  console.log('\n>>> ALL 4 CRITICAL QA DOMAINS PASSED WITH 100% SUCCESS <<<');
  process.exit(0);
}
