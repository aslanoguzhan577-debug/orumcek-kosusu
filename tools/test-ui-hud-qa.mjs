// tools/test-ui-hud-qa.mjs
// Senior QA HUD, UI & Shop Integration Test Suite for 8 Hero Characters

import * as THREE from 'three';

// ------------------------------------------------------------------ DOM MOCK WITH QUERY SELECTORS
class MockNode {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.classList = new Set();
    this.classList.add = (...classes) => classes.forEach(c => Set.prototype.add.call(this.classList, c));
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
    this._value = '';
    this.dataset = {};
  }
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  querySelector(sel) {
    if (sel === '.lbl') return new MockNode('span');
    if (sel === '.slots') return new MockNode('div');
    if (sel === '.key-hint') return new MockNode('span');
    if (sel === '.iron-ico') return new MockNode('span');
    if (sel === '.fill') return new MockNode('div');
    if (sel === 'canvas') return null;
    return new MockNode('div');
  }
  querySelectorAll(sel) {
    if (sel === '.slot') {
      const s1 = new MockNode('i');
      s1.classList.add('slot');
      const s2 = new MockNode('i');
      s2.classList.add('slot');
      return [s1, s2];
    }
    return [];
  }
  appendChild(child) {
    this.children.push(child);
  }
  addEventListener() {}
  removeEventListener() {}
  blur() {}
  focus() {}
}

const elementRegistry = new Map();
function getOrCreateElement(id, tag = 'div') {
  if (!elementRegistry.has(id)) {
    elementRegistry.set(id, new MockNode(tag, id));
  }
  return elementRegistry.get(id);
}

// Prepopulate required index.html UI IDs
const REQUIRED_IDS = [
  'hud', 'h-score', 'h-coins', 'h-pause', 'h-web', 'h-web-lbl', 'h-web-slots', 'h-web-hint',
  'h-iron', 'h-iron-n', 'h-iron-hint', 'h-ironbar', 'h-ironfill', 'h-ironbar-lbl',
  'scr-menu', 'scr-market', 'mk-coins', 'mk-list', 'scr-skin', 'b-skin', 'b-skin-close',
  'b-market', 'b-market-close', 'scr-help', 'scr-pause', 'scr-over', 'b-over-market',
  'm-namebox', 'm-name', 'm-best', 'm-bestname', 'b-play', 'b-help', 'b-help-ok',
  'b-resume', 'b-restart', 'b-pause-menu', 'b-again', 'b-share', 'b-over-menu',
  'o-score', 'o-coins', 'o-dist', 'o-best', 'o-record', 'o-list', 'h-repulsor', 'h-repulsor-timer',
  'intro-hint', 'h-sense', 'h-magnet'
];

REQUIRED_IDS.forEach(id => getOrCreateElement(id));

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
let uiFrameCallback = null;
global.requestAnimationFrame = (cb) => {
  uiFrameCallback = cb;
  return 1;
};
global.cancelAnimationFrame = () => {};
global.document = {
  body: new MockNode('body'),
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
    return new MockNode(tag);
  },
  getElementById(id) {
    return getOrCreateElement(id);
  },
  querySelectorAll() {
    return [];
  },
  addEventListener() {},
  removeEventListener() {},
  activeElement: null,
};
global.localStorage = mockStorage;
global.matchMedia = () => ({ matches: false });

const { game } = await import('../src/game.js');
const { WebPowerup } = await import('../src/powerups/web.js');
const { HEART_SVG_ICON } = await import('../src/powerups/skillHelloKitty.js');
const { BAT_SVG_ICON } = await import('../src/powerups/skillBatman.js');
const { SLINGSHOT_SVG_ICON } = await import('../src/powerups/skillSpiderman2002.js');
const { UNIBEAM_SVG_ICON } = await import('../src/powerups/skillIronMan.js');
const { VIBRANIUM_SVG_ICON } = await import('../src/powerups/skillBlackPanther.js');
const shop = await import('../src/shop.js');
await import('../src/ui.js');
function updateUi() {
  if (uiFrameCallback) uiFrameCallback(performance.now());
}

console.log('================================================================');
console.log(' HUD & SHOP INTEGRATION QA SUITE (8 HEROES)');
console.log('================================================================\n');

const tests = [];
function test(name, fn) {
  try {
    fn();
    tests.push({ name, pass: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    tests.push({ name, pass: false, error: err });
    console.error(`  [FAIL] ${name}: ${err.message}\n${err.stack}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

// ------------------------------------------------------------------ TEST SECTION 1: HUD CONFIG LABELS & ICONS
test('HUD updates label and icon correctly when switching between all 8 heroes', () => {
  const heroes = [
    { skin: 'hulk', expectedLabel: 'HULK SMASH', iconSnippet: '👊' },
    { skin: 'cap', expectedLabel: 'SHIELD SURF', iconSnippet: '🛡️' },
    { skin: 'miles', expectedLabel: 'VENOM BLAST', iconSnippet: '⚡' },
    { skin: 'kitty', expectedLabel: 'UÇAN KALP', iconSnippet: HEART_SVG_ICON },
    { skin: 'batman', expectedLabel: 'GECE PELERİNİ', iconSnippet: BAT_SVG_ICON },
    { skin: 'raimi', expectedLabel: 'MANCINIK AĞ', iconSnippet: SLINGSHOT_SVG_ICON },
    { skin: 'ironman', expectedLabel: 'UNIBEAM', iconSnippet: UNIBEAM_SVG_ICON },
    { skin: 'panther', expectedLabel: 'VİBRANYUM ŞOK', iconSnippet: VIBRANIUM_SVG_ICON },
  ];

  const webEl = getOrCreateElement('h-web');
  const webLbl = getOrCreateElement('h-web-lbl');
  const webSlots = getOrCreateElement('h-web-slots');

  game.state.mode = 'running';
  game.state.intro = false;
  game.state.score = 500;
  game.state.coins = 20;

  for (const h of heroes) {
    game.skin = h.skin;
    game.state.webCharges = h.skin === 'raimi' ? 2 : 1;
    updateUi();

    assertEqual(webLbl.textContent, h.expectedLabel, `${h.skin} HUD label`);
    assert(webEl.classList.contains(h.skin), `${h.skin} web gauge class on container`);
    assert(webSlots.innerHTML.includes(h.iconSnippet), `${h.skin} icon in slots HTML`);

    if (h.skin === 'raimi') {
      // Raimi has 2 slot icons!
      const count = (webSlots.innerHTML.match(/hero-ico/g) || []).length;
      assertEqual(count, 2, 'Raimi has exactly 2 slot icons');
    }
  }
});

// ------------------------------------------------------------------ TEST SECTION 2: HUD DURATION & DISTANCE BAR (EL.IRONBAR)
test('HUD Duration/Distance Bar (.ironbar) switches class & scale for each hero', () => {
  const ironBar = getOrCreateElement('h-ironbar');
  const ironFill = getOrCreateElement('h-ironfill');
  const ironLbl = getOrCreateElement('h-ironbar-lbl');

  // Setup game hero specials
  const scene = new THREE.Scene();
  const player = { root: new THREE.Group(), x: 0, y: 0, floorY: 0, hooks: {}, clearOverride() {} };
  const obstacles = {
    active: [],
    hooks: {},
    grace() {},
    registerPickup() {},
    generator: { addExtra() {} },
  };
  const cameraRig = { camera: { fov: 60, updateProjectionMatrix() {} }, shake() {}, setTilt() {} };
  const chaser = { hooks: {} };
  const webPowerup = new WebPowerup({ scene, player, obstacles, cameraRig, chaser });
  game.web = webPowerup;
  game.heroSpecials = webPowerup.heroSpecials;

  // 1. Hulk Special Active: duration bar
  game.state.mode = 'running';
  game.state.intro = false;
  game.skin = 'hulk';
  webPowerup.tryActivate();
  updateUi();

  assert(ironBar.hidden === false, 'Ironbar visible during Hulk Smash');
  assert(ironBar.classList.contains('hulk'), 'Ironbar has hulk class');
  assertEqual(ironLbl.textContent, 'HULK SMASH', 'Ironbar label for Hulk');

  // Deactivate
  webPowerup.heroSpecials.deactivate(false);
  updateUi();
  assert(ironBar.hidden === true, 'Ironbar hidden after Hulk deactivation');

  // 2. Batman Special Active: distance-based bar (800m)
  game.skin = 'batman';
  game.state.distance = 200;
  webPowerup.tryActivate();
  updateUi();

  assert(ironBar.hidden === false, 'Ironbar visible during Batman glide');
  assert(ironBar.classList.contains('batman'), 'Ironbar has batman class');
  assertEqual(ironLbl.textContent, 'GECE PELERİNİ', 'Ironbar label for Batman');

  // At distance 600m (400m traveled out of 800m): scaleX should be 0.50
  game.state.distance = 600;
  updateUi();
  assert(ironFill.style.transform.includes('scaleX(0.5)'), `Batman 50% scaleX (got ${ironFill.style.transform})`);

  // At distance 960m (760m traveled -> 40m remaining, k = 40/800 = 0.05 < 0.20): low warning class toggled!
  game.state.distance = 960;
  updateUi();
  assert(ironBar.classList.contains('low'), 'Ironbar has low warning class when < 20% remaining');

  webPowerup.heroSpecials.deactivate(false);
});

// ------------------------------------------------------------------ TEST SECTION 3: SHOP PURCHASES FOR HERO CHARGES
test('Shop: buyHeroCharge correctly handles 1 charge limit for heroes, 2 for Raimi, and 3 for Classic Spidey', () => {
  mockStorage.setItem('orumcek_kosusu_save', JSON.stringify({
    totalCoins: 1000,
    upgrades: { magnet: 0, spiderSense: 0, ironSpider: 0, heroSpecial: 0 },
    bankedHeroCharge: 0
  }));

  // Hulk in menu (banked hero charge max 1)
  window.game = game;
  game.skin = 'hulk';
  game.state.mode = 'menu';

  const bought1 = shop.buyHeroCharge();
  assert(bought1 === true, 'Bought 1st hero charge for Hulk');
  assertEqual(shop.getPlayerData().bankedHeroCharge, 1, 'Hulk banked charge = 1');

  // Buying 2nd hero charge while capped at 1: MUST return false
  const bought2 = shop.buyHeroCharge();
  assert(bought2 === false, 'Hulk cannot buy 2nd charge beyond max 1');

  // Raimi in running game (webCharges max 2)
  game.skin = 'raimi';
  game.state.mode = 'running';
  game.state.webCharges = 0;

  const raimiBuy1 = shop.buyHeroCharge();
  assert(raimiBuy1 === true, 'Raimi bought charge 1');
  assertEqual(game.state.webCharges, 1, 'Raimi webCharges = 1');

  const raimiBuy2 = shop.buyHeroCharge();
  assert(raimiBuy2 === true, 'Raimi bought charge 2');
  assertEqual(game.state.webCharges, 2, 'Raimi webCharges = 2');

  const raimiBuy3 = shop.buyHeroCharge();
  assert(raimiBuy3 === false, 'Raimi cannot buy charge 3 beyond max 2');
});

// ------------------------------------------------------------------ SUMMARY
console.log('\n================================================================');
console.log(' HUD & SHOP TEST SUMMARY');
console.log('================================================================');
const total = tests.length;
const passed = tests.filter(t => t.pass).length;
const failed = tests.filter(t => !t.pass).length;
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
