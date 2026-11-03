// tools/test-skills.mjs — mission setleri, skor çarpanı ve yeni skor formülü (PLAN.md 10).
// Run: node tools/test-skills.mjs
// No browser: game.js runs on stubbed world / player, missions.js on a stubbed localStorage.

import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';

const KEY = 'spidey.missions';
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
};

let checks = 0;
const eq = (a, b, msg) => { checks++; assert.equal(a, b, msg); };
const ok = (c, msg) => { checks++; assert.ok(c, msg); };
const json = (v) => JSON.stringify(v);

const { game, jumpScale } = await import('../src/game.js');
game.world = { update() {}, reset() {} };
game.player = { update() {}, reset() {}, handleAction() {} };
game.intro = null;

// ---------- skor: mesafe çarpanla birikir, altın çarpılmaz ----------
game.mult.base = 3;
game.start();
eq(game.state.mode, 'running', 'start() starts a run');
for (let i = 0; i < 10; i++) game.update(0.1);
eq(game.state.multiplier, 3, 'multiplier = (base + run + temp) * factor');
eq(game.state.score, Math.floor(game.state.distance * CONFIG.scorePerMeter * 3), 'distance score is multiplied');
ok(game.state.score > Math.floor(game.state.distance * CONFIG.scorePerMeter), 'multiplied beats the old formula');

game.halted = true;                 // halted kare: mesafe yerinde sayılır, skor satırı yine çalışır
const before = game.state.score;
game.state.coins = 10;
game.update(0.1);
eq(game.state.score - before, 10 * CONFIG.coinScore, 'coins add coinScore, never multiplied');
game.halted = false;

game.mult.run = 5; game.mult.temp = 2; game.mult.factor = 2;
game.restart();
eq(game.mult.base, 3, 'base survives a run');
eq(game.mult.run, 0, 'run boost resets');
eq(game.mult.temp, 0, 'temp boost resets');
eq(game.mult.factor, 1, 'factor resets');
eq(game.state.multiplier, 3, 'the first frame already runs at x3');
eq(game.state.score, 0, 'score resets');
eq(game.state.coins, 0, 'coins reset');

// ---------- missions.js (bozuk kayıtla yüklenir: defaults bekleniyor) ----------
store.set(KEY, '{bozuk');
const ms = await import('../src/missions.js');
const sys = game.systems[game.systems.length - 1];
eq(ms.missions.set, 1, 'broken save = set 1');
eq(ms.missions.level, 0, 'broken save = level 0');
eq(json(ms.missions.items), json(ms.makeSet(1)), 'broken save = fresh missions');
eq(game.mult.base, 1, 'x1 with no finished set');
eq(store.get(KEY), '{bozuk', 'loading alone does not write');

// ---------- set üretimi ----------
eq(json(ms.makeSet(5)), json(ms.makeSet(5)), 'same set number = same missions');
const s5 = ms.makeSet(5);
eq(s5.length, 3, 'three missions per set');
eq(new Set(s5.map((i) => i.id)).size, 3, 'the three are different');
eq(s5[0].progress, 0, 'missions start at 0');
eq(s5[0].done, false, 'missions start open');
const def5 = ms.MISSION_POOL.find((d) => d.id === s5[0].id);
eq(s5[0].goal, def5.base + def5.growth * 4, 'the amount grows with the set');
eq(ms.missionText('coins', 50), '50 altın topla', 'Turkish text carries the amount');
eq(ms.missionText('sense', 7), 'Örümcek hissiyle 7 kez kaç', 'text template');
ok(ms.MISSION_POOL.every((d) => d.base >= 1 && d.growth >= 1), 'every pool amount is at least 1');
eq(ms.MISSION_POOL.filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i).length, ms.MISSION_POOL.length, 'pool ids are unique');

// ---------- saf sayma ----------
const pure = [{ id: 'jump', goal: 3, progress: 0, done: false }];
eq(ms.count(pure, 'coins').length, 0, 'a foreign event counts nowhere');
eq(pure[0].progress, 0, 'and does not advance anything');
ms.count(pure, 'jump');
eq(pure[0].progress, 1, 'a counted event advances progress');
const finished = ms.count(pure, 'jump', 2);
eq(finished.length, 1, 'reaching the goal completes the mission');
eq(pure[0].done, true, 'done flag set');
eq(pure[0].progress, 3, 'progress stops at the goal');
eq(ms.count(pure, 'jump').length, 0, 'a finished mission does not count again');
eq(ms.reach(pure, 'jump', 0).length, 0, 'a finished mission is never re-measured');

// ---------- olay kabloları: sayma, ölçme, kaydetme zamanı, set bitimi ----------
const doneIds = [];
const setUps = [];
const { events, emit } = await import('../src/events.js');
events.addEventListener('missionDone', (e) => doneIds.push(e.detail.id));
events.addEventListener('missionSet', (e) => setUps.push(e.detail));

ms.missions.set = 1;
ms.missions.level = 0;
ms.missions.items = [
  { id: 'coinsRun', goal: 3, progress: 0, done: false },
  { id: 'powerup', goal: 3, progress: 0, done: false },
  { id: 'noStumble', goal: 100, progress: 0, done: false },
];
game.state.coins = 0; game.state.distance = 0; game.state.score = 0;

store.set(KEY, 'sentinel');
emit('coin');
eq(ms.missions.items[0].progress, 1, 'a coin counts into the run mission');
eq(store.get(KEY), 'sentinel', 'plain progress is not saved');

emit('pickup', { type: 'sense' });
eq(ms.missions.items[1].progress, 1, 'a pickup counts as a power-up');
emit('pickup', { type: 'magnet' });
eq(ms.missions.items[1].progress, 2, 'the magnet pickup is a power-up too');
eq(doneIds.length, 0, 'nothing announced before a goal is reached');

game.state.distance = 40;
emit('stumble');
game.state.distance = 90;
sys.update();
eq(ms.missions.items[2].progress, 50, 'metres are measured since the last stumble');
game.state.distance = 10;
sys.update();
eq(ms.missions.items[2].progress, 0, 'a stumble drops the stretch back to 0');
game.state.distance = 200;
sys.update();
eq(ms.missions.items[2].done, true, '100 metres without a stumble completes it');
eq(json(doneIds), json(['noStumble']), 'missionDone {id} fired');
ok(store.get(KEY) !== 'sentinel', 'completing saves');

emit('coin'); emit('coin');
eq(ms.missions.items[0].done, true, 'three coins in one run complete the run mission');
emit('pickup', { type: 'web' });
eq(ms.missions.set, 2, 'a finished set moves on');
eq(ms.missions.level, 1, 'and raises the level');
eq(game.mult.base, 2, 'base = 1 + finished sets');
eq(json(ms.missions.items), json(ms.makeSet(2)), 'the new set is generated');
eq(json(setUps), json([{ set: 2, multiplier: 2 }]), 'missionSet {set, multiplier} fired');
eq(json(doneIds), json(['noStumble', 'coinsRun', 'powerup']), 'each mission announced once');
eq(json(JSON.parse(store.get(KEY)).items), json(ms.makeSet(2)), 'the save holds the new set');

// ---------- mıknatıs / Iron Spider / his ayrı sayılır ----------
ms.missions.items = [
  { id: 'magnet', goal: 1, progress: 0, done: false },
  { id: 'iron', goal: 1, progress: 0, done: false },
  { id: 'sense', goal: 1, progress: 0, done: false },
];
emit('pickup', { type: 'web' });
eq(ms.missions.items[0].progress, 0, 'only a magnet pickup counts as a magnet');
emit('pickup', { type: 'magnet' });
eq(ms.missions.items[0].done, true, 'magnet pickup counts');
emit('ironSave');
emit('senseDodge');
eq(ms.missions.set, 3, 'the second finished set moves on again');
eq(game.mult.base, 3, 'x3 after two sets');
eq(json(setUps.map((u) => u.multiplier)), json([2, 3]), 'each set announces its own multiplier');

// ---------- ölçülen puan görevleri ----------
ms.missions.items = [
  { id: 'scoreRun', goal: 1000, progress: 0, done: false },
  { id: 'noCoins', goal: 2000, progress: 0, done: false },
  { id: 'slide', goal: 2, progress: 0, done: false },
];
game.state.score = 600; game.state.coins = 0;
sys.update();
eq(ms.missions.items[0].progress, 600, 'the run score is measured');
eq(ms.missions.items[1].progress, 600, 'so is the coin-free run score');
game.state.coins = 1;
sys.update();
eq(ms.missions.items[1].progress, 0, 'a coin voids the coin-free mission for this run');
eq(ms.missions.items[0].progress, 600, 'the plain run-score mission keeps its progress');
game.state.coins = 0; game.state.score = 1000;
sys.update();
eq(ms.missions.items[0].done, true, 'the run score goal completes it');
eq(ms.missions.items[1].done, false, 'the voided one stays open');
game.state.score = 2000;
sys.update();
eq(ms.missions.items[1].done, true, 'a coin-free run still reaches its goal');
emit('slide'); emit('slide');
eq(ms.missions.set, 4, 'all three done = the next set');

// ---------- "tek koşuda" sıfırlanması ----------
ms.missions.items = [
  { id: 'coinsRun', goal: 5, progress: 4, done: false },
  { id: 'jump', goal: 5, progress: 2, done: false },
  { id: 'scoreRun', goal: 1200, progress: 1500, done: true },
];
sys.reset();
eq(ms.missions.items[0].progress, 0, 'a "tek koşuda" mission starts over every run');
eq(ms.missions.items[1].progress, 2, 'a total mission keeps its progress');
eq(ms.missions.items[2].done, true, 'a finished mission stays finished');

emit('gameover', { score: 10, coins: 2, distance: 30 });
eq(json(JSON.parse(store.get(KEY)).items[1]), json({ id: 'jump', goal: 5, progress: 2, done: false }), 'game over saves');

// ---------- çarpan tavanı ----------
const capped = { set: 1, level: 0, items: ms.makeSet(1) };
let up = null;
for (let i = 0; i < 60; i++) {
  for (const it of capped.items) { it.progress = it.goal; it.done = true; }
  up = ms.completeSet(capped) || up;
}
eq(capped.level, 29, 'the level stops at 29 finished sets');
eq(up.multiplier, 30, 'the multiplier never passes x30');

// ---------- eski / uyumsuz kayıt ----------
store.set(KEY, json({ set: 1, level: 0, items: [{ id: 'coins', goal: 999, progress: 0, done: false }, { id: 'jump', goal: 30, progress: 0, done: false }, { id: 'lane', goal: 25, progress: 0, done: false }] }));
const msOld = await import('../src/missions.js?stale');
eq(msOld.missions.set, 1, 'a stale save = set 1');
eq(msOld.missions.level, 0, 'a stale save = level 0');
eq(json(msOld.missions.items), json(ms.makeSet(1)), 'a stale save = fresh missions');

// ---------- Bugle Manşeti çarpanı ve Örümcek Yayı sıçrayışı (game.js okur) ----------
game.state.bugleTime = 0;
game.restart();
eq(game.mult.factor, 1, 'no bugle = factor 1');
game.state.bugleTime = CONFIG.bugle.duration;
game.update(0.1);
eq(game.mult.factor, 2, 'bugleTime > 0 = factor 2');
eq(game.state.multiplier, (game.mult.base + game.mult.run + game.mult.temp) * 2, 'the multiplier carries the x2');
game.state.bugleTime = 0;
game.update(0.1);
eq(game.mult.factor, 1, 'when the bugle runs out the x2 is gone');
game.state.bugleTime = 4;
game.restart();
eq(game.state.bugleTime, 0, 'a run start clears the bugle');
eq(game.mult.factor, 1, 'and no stale x2 survives it');

eq(jumpScale(), 1, 'a normal jump is the normal height');
game.state.springTime = CONFIG.spring.duration;
eq(jumpScale(), CONFIG.spring.jumpScale, 'the spring raises the default jump');
game.state.springTime = 0;
eq(jumpScale(), 1, 'and drops it back');

// ---------- Flaş Fotoğraf (market sarf: koşu başı çarpan takviyesi) ----------
store.set('orumcek_kosusu_save', json({ totalCoins: 5000, upgrades: { magnet: 0, spiderSense: 0, ironSpider: 0, heroSpecial: 0 }, bankedHeroCharge: 0, jetStarts: 0, flashBoosters: 0 }));
const shop = await import('../src/shop.js');
const { FlashBooster } = await import('../src/powerups/flash.js');
const boosts = [];
events.addEventListener('flashBoost', (e) => boosts.push(e.detail.bonus));

game.restart();
game.state.intro = false;
game.state.time = 0;
const fl = new FlashBooster();
eq(fl.available, false, 'no stock = no boost');
eq(fl.use(), false, 'and nothing is spent');

ok(shop.buyFlashBooster(), 'the market sells one');
eq(fl.count, 1, 'the stock is in the save');
eq(fl.available, true, 'inside the first 7 s of a run it is usable');
game.state.intro = true;
eq(fl.available, false, 'not during the intro clip');
game.state.intro = false;
game.state.time = 8;
eq(fl.available, false, 'and not after the window');
eq(fl.windowLeft, 0, 'the window shows 0');
game.state.time = 3;
eq(fl.windowLeft, 4, 'the window counts down');

eq(fl.use(), true, 'one tap spends it');
eq(boosts.length, 1, 'and announces the boost');
eq(game.mult.run, 5, 'the first tap = x5');
eq(fl.count, 0, 'the stock is empty');
eq(shop.buyFlashBooster(), true, 'buy another');
eq(shop.buyFlashBooster(), true, 'and another');
eq(fl.use(), true, 'the second run use works');
eq(game.mult.run, 6, 'the second tap = x6');
ok(shop.buyFlashBooster(), 'and a third');
eq(fl.use(), true, 'the third use works');
eq(game.mult.run, 7, 'the third tap = x7');
eq(fl.available, false, 'three is the cap for one run');
eq(fl.use(), false, 'and a fourth tap spends nothing');
eq(fl.count, 1, 'so the stock stays where it was');
game.update(0.1);
eq(game.state.multiplier, (game.mult.base + 7) * game.mult.factor, 'the run part pays the score');
fl.reset();
game.mult.run = 0;
eq(fl.use(), true, 'a fresh run can spend the spare');
eq(game.mult.run, 5, 'and it starts at x5 again');

console.log(`OK ${checks} checks`);
