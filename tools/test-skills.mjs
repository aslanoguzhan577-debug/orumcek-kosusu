// tools/test-skills.mjs — mission setleri, skor çarpanı, yeni güçler ve Ağ Salınışı (PLAN.md 10).
// Run: node tools/test-skills.mjs
// No browser: game.js runs on stubbed world / player, missions.js on a stubbed localStorage.

import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { speedAt } from '../src/patterns.js';

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
eq(s5[0].goal, ms.goalFor(def5, 5), 'the goal is what the set says for that mission');
eq(ms.goalFor({ base: 10, growth: 25 }, 5), 110, 'goal = base + growth * (set - 1)');
eq(ms.goalFor({ base: 2, growth: 1, max: 5 }, 9), 5, 'a capped goal stops at the cap');
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

// ---------- B1: koşu başka nasıl biterse bitsin görev ilerlemesi kaydedilir ----------
ms.missions.items = [
  { id: 'jump', goal: 5, progress: 0, done: false },
  { id: 'coinsRun', goal: 5, progress: 0, done: false },
  { id: 'lane', goal: 5, progress: 0, done: false },
];
game.restart();                        // the run is live
store.set(KEY, 'sentinel');
emit('jump'); emit('jump');
eq(store.get(KEY), 'sentinel', 'plain progress is still not saved on every event');
game.pause();
ok(store.get(KEY) !== 'sentinel', 'a pause writes the save');
eq(JSON.parse(store.get(KEY)).items[0].progress, 2, 'with what the run has done so far');
emit('jump');
game.toMenu();
eq(JSON.parse(store.get(KEY)).items[0].progress, 3, 'quitting to the menu saves it');
game.restart();
store.set(KEY, 'sentinel');
emit('jump');
game.restart();
eq(JSON.parse(store.get(KEY)).items[0].progress, 4, 'the next run start saves the run that ended');

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
store.set(KEY, json({ set: 3, level: 2, items: [{ id: 'coins', goal: 999, progress: 0, done: false }, { id: 'jump', goal: 30, progress: 0, done: false }, { id: 'lane', goal: 25, progress: 0, done: false }] }));
const msOld = await import('../src/missions.js?stale');
eq(msOld.missions.set, 3, 'a stale save (pool changed) keeps its set');
eq(msOld.missions.level, 2, 'a stale save keeps its level = the earned multiplier');
eq(json(msOld.missions.items), json(ms.makeSet(3)), 'a stale save gets that set\'s fresh missions');

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
// a fat wallet: the market block below buys every six power-up upgrade to its maxLevel
store.set('orumcek_kosusu_save', json({ totalCoins: 5000000, upgrades: { magnet: 0, spiderSense: 0, ironSpider: 0, heroSpecial: 0 }, bankedHeroCharge: 0, jetStarts: 0, flashBoosters: 0 }));
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

// ---------- kayış ritmi (player.js): spam uzatmaz, ayağa kalkış hatırlanır ----------
const { register } = await import('node:module');
register('./stub-hooks.mjs', import.meta.url); // node'da three yok: src/player.js öyle yüklenir
const { Player } = await import('../src/player.js');
const DT = 1 / 60;
const pl = new Player({ root: {}, setState() {}, update() {} });
const until = (fn, max = 300) => { let n = 0; while (!fn() && n < max) { pl.update(DT, true); n++; } return n; };

pl.reset();
pl.handleAction('down');
eq(pl.sliding, true, 'down starts a slide');
pl.handleAction('down');
pl.handleAction('down');
eq(pl.slideTimer, CONFIG.slideDuration, 'a press while sliding does not extend the slide');
let frames = until(() => !pl.sliding);
ok(Math.abs(frames * DT - CONFIG.slideDuration) <= DT, `the slide lasts exactly slideDuration (${frames} frames)`);
ok(pl._slideRecover > 0, 'he stands up for slideRecover seconds');

pl.handleAction('down');
eq(pl.sliding, false, 'a press during the recovery does not start a slide yet');
frames = until(() => pl.sliding);
eq(pl.sliding, true, 'the remembered press starts the next slide');
ok(Math.abs(frames * DT - CONFIG.slideRecover) <= DT, `the next slide comes exactly when the recovery ends (${frames} frames)`);

pl.reset();
pl.handleAction('down');
until(() => !pl.sliding);
pl.handleAction('down');
pl.handleAction('up');
ok(!pl.grounded, 'a jump during the recovery works');
eq(pl._slideQueued, false, 'and the jump drops the remembered press');

pl.reset();
pl.handleAction('down');
until(() => !pl.sliding);
pl.handleAction('down');
pl.rescueSlide();
eq(pl.sliding, true, 'the spider-sense rescue slides through the recovery');

pl.reset();
eq(pl._slideRecover, 0, 'reset clears the recovery');

// ---------- Ağ Salınışı (powerups/swing.js): yüksekte salınır, çarpmaz, havada altın dizer ----------
const { SwingPowerup } = await import('../src/powerups/swing.js');
const SW_G = CONFIG.swing;
const graceAsk = [];
const fakeObs = {
  coins: [], _coinPool: [{ tag: 'reused' }], registered: null,
  registerPickup(kind, hooks) { this.registered = { kind, hooks }; },
  generator: { extras: [], addExtra(fn) { this.extras.push(fn); } },
  grace(s) { graceAsk.push(s); },
};
const anchors = [];
let lineHidden = 0;
const fakeWeb = {
  drawLineTo(a) { anchors.push({ x: a.x, y: a.y, z: a.z }); },
  hideLine() { lineHidden++; },
};
let venomDrops = 0;
const fakeChaser = { isNear: true, _dropBack() { venomDrops++; } };
const swingLog = [];
events.addEventListener('swingOn', () => swingLog.push('on'));
events.addEventListener('swingArc', (e) => swingLog.push(e.detail.side));
events.addEventListener('swingOff', (e) => swingLog.push(e.detail.reset ? 'reset' : 'off'));

game.restart();
game.state.intro = false;
const swing = game.addSystem(new SwingPowerup({ player: pl, obstacles: fakeObs, web: fakeWeb, chaser: fakeChaser }));
eq(fakeObs.registered.kind, 'swing', 'the swing registers its pickup');
eq(fakeObs.generator.extras.length, 1, 'and one pattern extra');
ok(fakeObs.registered.hooks.create(), 'its pickup model comes from pickup-art');

// yerleştirme: blok başına tam bir rastgele sayı (rayların determinantlığı için şart)
const pushed = [];
let rolls = 0;
const block = (A, free) => ({
  rng: () => { rolls++; return 0.05; }, A, route: 1, pickups: 0, routeFree: free,
  farFromPickup: () => true, push: (o) => pushed.push(o),
});
fakeObs.generator.extras[0](block(100, [90, 130]));
eq(rolls, 1, 'the swing extra draws exactly one random number per block');
eq(pushed.length, 1, 'a free stretch of the route lane gets a pickup');
eq(pushed[0].kind, 'swing', 'of kind swing');
fakeObs.generator.extras[0](block(120, [110, 150]));
eq(pushed.length, 1, 'the minimum gap keeps the next one away');
eq(rolls, 2, 'and the declined block still drew its one number');

// another flight owns the height: the pickup counts (obstacles.js emits it), the swing does not start
game.heroSpecials = { active: true };
swing.start();
eq(game.state.swingTime, 0, 'no swing while another flight is up');
eq(swing.active, false, 'and nothing is queued for later');
delete game.heroSpecials;

pl.reset();
game.state.speed = CONFIG.startSpeed;
const st = game.state;
swing.start();
eq(st.swingTime, SW_G.duration, 'collecting fills the countdown');
eq(pl.verticalLocked, true, 'and takes the height away from the jump');
eq(swingLog.pop(), 'on', 'swingOn announced');
eq(venomDrops, 1, 'Venom falls back');

let upFrames = 0, minY = Infinity, lockTested = false, coinsAtStop = -1;
const roof = CONFIG.obstacles.wagon.height;
while (swing.active) {
  pl.floorY = st.swingTime < 0.5 ? roof : 0;  // obstacles.js: her karede taze zemin (sonda bir vagon)
  swing.beforePlayer(DT);
  pl.update(DT, true);
  swing.update(DT);
  upFrames++;
  if (swing.time > 1 && swing.time < SW_G.duration - 1) minY = Math.min(minY, pl.y);
  if (coinsAtStop < 0 && st.swingTime <= SW_G.coinStop) coinsAtStop = fakeObs.coins.length;
  if (!lockTested && swing.time > 2) {
    lockTested = true;
    pl.handleAction('up');
    eq(pl.grounded, true, 'up does nothing while he swings');
    pl.handleAction('down');
    eq(pl.sliding, false, 'and neither does down');
    pl.handleAction('left');
    eq(pl.lane, 0, 'lanes still change');
  }
}
ok(Math.abs(upFrames * DT - SW_G.duration) <= DT * 2, `the countdown ends the swing (${upFrames} frames)`);
eq(st.swingTime, 0, 'the countdown stops at 0');
eq(swing.active, false, 'and the swing is over');
eq(pl.verticalLocked, false, 'the jump is his again');
ok(minY > CONFIG.obstacles.wagon.height, `he stays above every train roof (${minY.toFixed(2)} m)`);
ok(graceAsk.every((g) => g > 0), 'every swing frame asks for collision grace');
eq(graceAsk.length, upFrames + 1, 'once per frame, plus the landing');
eq(graceAsk[graceAsk.length - 1], 1.5, 'the landing gets the usual 1.5 s');
eq(anchors.length, upFrames, 'the web line is redrawn every frame');
eq(anchors[0].y, SW_G.height + SW_G.anchorRise, 'to an anchor high on the facade');
ok(anchors[0].z < 0, 'and ahead of him');
const arcs = swingLog.filter((v) => v === 1 || v === -1);
ok(arcs.length >= Math.floor(SW_G.duration / SW_G.arcTime) - 1, 'a new web shot each arc');
ok(arcs.every((s, i) => s === (i % 2 ? -1 : 1)), 'the anchor alternates sides');
eq(new Set(anchors.map((a) => a.x)).size, 2, 'both sides of the street');
ok(fakeObs.coins.length > 5, 'the swing lays a coin ribbon');
ok(fakeObs.coins.some((c) => c.tag === 'reused'), 'with pooled coin objects');
ok(fakeObs.coins.every((c) => c.y > CONFIG.obstacles.wagon.height), 'all of it in the air');
eq(new Set(fakeObs.coins.map((c) => c.x)).size, CONFIG.laneCount, 'the ribbon snakes over all lanes');
eq(fakeObs.coins.length, coinsAtStop, 'and stops before the landing');
eq(swingLog[swingLog.length - 1], 'off', 'swingOff announced');
ok(Math.abs(pl.y - roof) < 0.05, `he lands on the train roof under him (${pl.y.toFixed(2)} m)`);
eq(swing.surfaceY, roof, 'and the shadow floor follows it');
ok(pl.grounded, 'grounded');
ok(lineHidden > 0, 'the web line is hidden');
ok(pl.x < -CONFIG.laneWidth * 0.9, 'the lane change survived the swing');

swingLog.length = 0;
const graceBefore = graceAsk.length;
swing.start();
ok(swing.active, 'a later pickup swings again');
game.restart();
eq(st.swingTime, 0, 'a run start clears the countdown');
eq(swing.active, false, 'and the swing');
eq(pl.verticalLocked, false, 'and the height lock');
eq(swingLog[swingLog.length - 1], 'reset', 'announced as a reset, without a landing');
eq(graceAsk.length, graceBefore, 'the reset asks for no landing grace');

swingLog.length = 0;
swing.start();
game.halted = true;      // yakalanma sahnesi: dünya durur, ağ çizgisi ekranda kalamaz
swing.update(DT);
eq(swing.active, false, 'a catch ends the swing');
eq(st.swingTime, 0, 'and its countdown');
eq(graceAsk.length, graceBefore, 'the quiet end asks for no grace');
eq(swingLog[swingLog.length - 1], 'reset', 'announced without a landing');
game.halted = false;

// ---------- yeni güçler: sahte dünya ----------
const { laneX } = await import('../src/world.js');   // stub'da da aynı formül
const fakeScene = { added: [], add(...o) { this.added.push(...o); } };
const mkObs = () => {
  const asked = [];
  return {
    asked, coins: [], _coinPool: [], hooks: {}, registered: null,
    registerPickup(kind, hooks) { this.registered = { kind, hooks }; },
    generator: { extras: [], addExtra(fn) { this.extras.push(fn); } },
    grace(s) { asked.push(s); },
  };
};
// blok başına tam bir rastgele sayı + itilen toplar
const probe = (extra, log, name) => {
  let rolls = 0;
  const block = (A, lane, free, B = A + 100) => ({
    rng: () => { rolls++; return 0.05; }, A, B, route: lane, pickups: 0, routeFree: free,
    farFromPickup: () => true, push: (o) => log.push(o),
  });
  return { rolls: () => rolls, block };
};

// ---------- Ağ Kuklası (powerups/decoy.js): ilk tökezleme Venom'u yaklaştırmez ----------
const { DecoyPowerup } = await import('../src/powerups/decoy.js');
const DG = CONFIG.decoy;
let toldVenom = 0;
const dcObs = mkObs();
dcObs.hooks.onSideStumble = () => { toldVenom++; return true; };  // the chaser installed its own first
const decoyLog = [];
events.addEventListener('decoyOn', () => decoyLog.push('on'));
events.addEventListener('decoyLure', () => decoyLog.push('lure'));
events.addEventListener('decoyUse', () => decoyLog.push('use'));
events.addEventListener('decoyOff', (e) => decoyLog.push(e.detail.reset ? 'reset' : 'off'));

game.restart();
game.state.intro = false;
game.state.speed = CONFIG.startSpeed;
fakeChaser.isNear = true;
const decoy = game.addSystem(new DecoyPowerup({ player: pl, obstacles: dcObs, chaser: fakeChaser, scene: fakeScene }));
eq(dcObs.registered.kind, 'decoy', 'the decoy registers its pickup');
eq(dcObs.generator.extras.length, 1, 'and one pattern extra');
ok(dcObs.registered.hooks.create(), 'its pickup model comes from pickup-art');
const dp = [], dprobe = probe(dcObs.generator.extras[0], dp);
dcObs.generator.extras[0](dprobe.block(100, 1, [90, 130]));
eq(dprobe.rolls(), 1, 'the decoy extra draws exactly one random number per block');
eq(dp[0].kind, 'decoy', 'a free stretch of the route lane gets a decoy');
eq(dp[0].lane, 1, 'in the route lane');
dcObs.generator.extras[0](dprobe.block(120, 1, [110, 150]));
eq(dp.length, 1, 'the minimum gap keeps the next one away');
eq(dprobe.rolls(), 2, 'and the declined block still drew its one number');

venomDrops = 0;
decoyLog.length = 0;
pl.reset();
decoy.start();
eq(game.state.decoyTime, DG.duration, 'collecting fills the countdown');
eq(decoy.spare, 1, 'exactly one stumble is forgiven');
eq(decoy.dummy.root.visible, true, 'the doll is left on the track');
eq(venomDrops, 1, 'Venom turns to it and falls back');
eq(decoyLog.join(','), 'on,lure', 'decoyOn and decoyLure announced');

game.state.decoyTime = 5;
dcObs.hooks.onSideStumble({});
eq(toldVenom, 0, 'the forgiven stumble never reaches the chaser');
eq(decoy.spare, 0, 'one stumble only');
eq(game.state.decoyTime, 0, 'the power is spent with it');
eq(decoyLog.join(','), 'on,lure,use,off', 'the forgiven stumble announces decoyUse + decoyOff');
dcObs.hooks.onSideStumble({});
eq(toldVenom, 1, 'the next stumble is the chaser\'s own business again');
let fell = 0;
while (decoy.dummy.root.visible && fell < 200) { decoy.beforePlayer(DT); fell++; }
ok(decoy.dummy.lean.rotation.x < -0.5, `the used doll topples over (${decoy.dummy.lean.rotation.x.toFixed(2)})`);
eq(decoy.dummy.root.visible, false, 'and goes out of sight');

pl.reset();
decoy.start();
const zStart = decoy.dummy.root.position.z;
for (let i = 0; i < 30; i++) decoy.beforePlayer(DT);
ok(decoy.dummy.root.position.z > zStart, 'the doll is left behind: it scrolls toward the camera');
ok(decoy.dummy.root.position.z <= DG.behind, 'and is hidden as soon as it is far enough back');
decoy.reset();

fakeChaser.isNear = false;
decoyLog.length = 0;
decoy.start();
ok(!decoyLog.includes('lure'), 'nothing is counted as a bait when Venom was already far');
decoyLog.length = 0;
const dropsBefore = venomDrops;
decoy.start();
eq(venomDrops, dropsBefore, 'and he is not told to fall back again');
game.restart();
eq(game.state.decoyTime, 0, 'a run start clears the decoy');
eq(decoy.active, false, 'and the power');
eq(decoy.spare, 0, 'the forgiven stumble does not survive the run');
eq(decoyLog[decoyLog.length - 1], 'reset', 'decoyOff {reset} announced');

// ---------- Duvar Koşusu (powerups/wall.js): şeridin dışındaki duvarda koşar, çarpmaz ----------
const { WallPowerup } = await import('../src/powerups/wall.js');
const WG = CONFIG.wall;
const wlObs = mkObs();
wlObs._coinPool = [{ tag: 'reused' }];
const dollies = [];
const wallLog = [];
events.addEventListener('wallOn', (e) => wallLog.push(['on', e.detail.side]));
events.addEventListener('wallOff', (e) => wallLog.push(e.detail.reset ? 'reset' : 'off'));
const rig = { setDolly(back, follow) { dollies.push([back, follow]); } };

game.restart();
game.state.intro = false;
game.state.speed = CONFIG.startSpeed;
const wall = game.addSystem(new WallPowerup({ player: pl, obstacles: wlObs, chaser: fakeChaser, scene: fakeScene, cameraRig: rig }));
eq(wlObs.registered.kind, 'wall', 'the wall registers its pickup');
eq(wlObs.generator.extras.length, 1, 'and one pattern extra');
ok(wlObs.registered.hooks.create(), 'its pickup model comes from pickup-art');
const wp = [], wprobe = probe(wlObs.generator.extras[0], wp);
wlObs.generator.extras[0](wprobe.block(700, 0, [690, 730]));
eq(wprobe.rolls(), 1, 'the wall extra draws exactly one random number per block');
eq(wp[0].kind, 'wall', 'and pushes a wall pickup');

pl.reset();
pl.verticalLocked = true;                        // another flight owns the height
wall.start();
eq(wall.active, false, 'no wall run while another flight is up');
eq(game.state.wallTime, 0, 'and nothing is queued for later');
pl.verticalLocked = false;

pl.x = 1.0;                                      // right half of the track
wall.start();
eq(wall.active, true, 'collecting starts the run');
eq(wall.side, 1, 'he takes the near facade');
eq(pl.lane, CONFIG.laneCount - 1, 'and commits to its outer lane');
eq(pl.verticalLocked, true, 'up / down are the wall\'s now');
eq(game.state.wallTime, WG.duration, 'the countdown is filled');
eq(game.state.wallMetres, 0, 'the metre counter starts at 0');
eq(dollies[dollies.length - 1][0], WG.camBack, 'the camera pulls back so he stays in frame');
eq(wallLog[0][0], 'on', 'wallOn announced');
eq(wallLog[0][1], 1, 'with the side he chose');

let wf = 0, minH = Infinity, maxH = 0, roll = 0;
while (wall.active) {
  pl.floorY = wf === 5 ? CONFIG.obstacles.wagon.height : 0;   // a wagon roof passes under him
  wall.beforePlayer(DT);
  pl.update(DT, true);
  wall.update(DT);
  wf++;
  if (wall.lift > 0.99) { minH = Math.min(minH, pl.y); maxH = Math.max(maxH, pl.y); roll = pl.root.rotation.z; }
}
ok(Math.abs(wf * DT - WG.duration) <= DT * 2, `the countdown ends the wall run (${wf} frames)`);
ok(minH > CONFIG.obstacles.wagon.height, `he runs above every train roof (${minH.toFixed(2)} m)`);
ok(Math.abs(maxH - WG.height) < 0.05, 'a roof under him does not lift him higher');
ok(Math.abs(Math.abs(roll) - Math.PI / 2) < 0.05, 'his body is rolled a quarter turn onto the wall');
ok(wlObs.asked.slice(0, wf).every((g) => g > 0), 'every wall frame asks for collision grace');
eq(wlObs.asked.length, wf + 1, 'once per frame, plus the landing');
eq(wlObs.asked[wlObs.asked.length - 1], 1.5, 'the landing gets the usual 1.5 s');
ok(game.state.wallMetres > (WG.duration - WG.liftTime) * CONFIG.startSpeed * 0.9, 'the metres on the wall are counted');
ok(wlObs.coins.length > 3, 'a coin row runs along the wall');
ok(wlObs.coins.every((c) => c.x === WG.x), 'on the wall itself, not in a lane');
ok(wlObs.coins.every((c) => c.y > CONFIG.obstacles.wagon.height), 'at his height, above the deck');
ok(wlObs.coins.some((c) => c.tag === 'reused'), 'with pooled coin objects');
ok(wall.panels[1].scrolled > 0, 'the facade rushes past under his hands');
eq(wallLog[wallLog.length - 1], 'off', 'wallOff announced');
eq(pl.verticalLocked, false, 'the jump is his again');
eq(pl.lane, CONFIG.laneCount - 1, 'he lands back in that outer lane');
ok(Math.abs(pl.x - laneX(CONFIG.laneCount - 1)) < 0.05, 'standing in it');
ok(pl.grounded, 'grounded on the deck');

wall.start();
pl.handleAction('left');                          // a press toward the inside
wall.beforePlayer(DT);
eq(game.state.wallTime, WG.landingTime, 'it ends the wall run at once');
while (wall.active) { wall.beforePlayer(DT); wall.update(DT); }   // he lands
wall.start();                                     // a fresh run: what does NOT end it
pl.handleAction('right');                         // outward: the lane he already owns
wall.beforePlayer(DT);
ok(game.state.wallTime > WG.landingTime, 'an outward press keeps it going');
pl.handleAction('up');
wall.beforePlayer(DT);
ok(game.state.wallTime > WG.landingTime, 'and so does a jump press');
wallLog.length = 0;
const wAsk = wlObs.asked.length;
game.restart();
eq(game.state.wallTime, 0, 'a run start clears the wall');
eq(wall.active, false, 'and the run');
eq(pl.verticalLocked, false, 'and the height lock');
eq(game.state.wallMetres, 0, 'and the metre counter');
eq(wallLog[wallLog.length - 1], 'reset', 'announced as a reset, without a landing');
eq(wlObs.asked.length, wAsk, 'the reset asks for no landing grace');
wallLog.length = 0;
wall.start();
game.halted = true;                               // the catch froze the world
wall.update(DT);
eq(wall.active, false, 'a catch ends the wall run');
eq(game.state.wallTime, 0, 'and its countdown');
eq(pl.verticalLocked, false, 'and gives the height back');
eq(wlObs.asked.length, wAsk, 'the quiet end asks for no grace');
game.halted = false;

// B5: bir yakalama duvarda yakalarsa yere iner, havada asılı kalmaz
pl.reset();
pl.x = 1.0;
wall.start();
for (let i = 0; i < 30; i++) { pl.floorY = 0; wall.beforePlayer(DT); pl.update(DT, true); wall.update(DT); }
ok(wall.height > 1, 'he is up on the wall face');
ok(pl.y > 1 && pl.x > 3, `floating out there (${pl.x.toFixed(2)}, ${pl.y.toFixed(2)})`);
game.halted = true;
wall.update(DT);
game.halted = false;
eq(wall.active, false, 'the catch ended the run');
eq(pl.verticalLocked, false, 'the height is released');
eq(pl.lane, CONFIG.laneCount - 1, 'back in the outer lane he ran in');
eq(pl._prevLane, CONFIG.laneCount - 1, 'and the lane history agrees');
eq(pl._laneT, 1, 'a finished lane change, so nothing keeps sliding');
ok(Math.abs(pl.x - laneX(CONFIG.laneCount - 1)) < 0.05, `standing in it (${pl.x.toFixed(2)})`);
eq(pl.floorY, wall.surfaceY, 'the floor is the deck again');
ok(Math.abs(pl.y - pl.floorY) < 0.05, `on the floor, not floating (${pl.y.toFixed(2)})`);
eq(pl.vy, 0, 'and not falling');
ok(pl.grounded, 'grounded');

// ---------- Örümcek İzi (powerups/tracer.js): insansız şeridi izler, şerit ödüllendirir ----------
const { TracerPowerup } = await import('../src/powerups/tracer.js');
const TG = CONFIG.tracer;
const trObs = mkObs();
const tracer = game.addSystem(new TracerPowerup({ player: pl, obstacles: trObs, scene: fakeScene }));
eq(trObs.registered.kind, 'tracer', 'the tracer registers its pickup');
eq(trObs.generator.extras.length, 1, 'and one pattern extra');
ok(trObs.registered.hooks.create(), 'its pickup model comes from pickup-art');

const tp = [], tprobe = probe(trObs.generator.extras[0], tp);
for (let i = 0; i < 6; i++) trObs.generator.extras[0](tprobe.block(i * 100, i % 2, null));
eq(tprobe.rolls(), 6, 'the tracer extra draws exactly one random number per block');
eq(tracer._segs.length, 6, 'and records the route of every block');
eq(tracer._laneAt(50), 0, 'the first block routes lane 0');
eq(tracer._laneAt(150), 1, 'the next one already goes the other way');
eq(tracer._laneAt(900), 1, 'past what was recorded: the last known lane');
trObs.generator.extras[0](tprobe.block(600, 0, [610, 660]));
eq(tp.length, 1, 'a free stretch of the route lane gets a tracer');
eq(tp[0].kind + ',' + tp[0].lane, 'tracer,0', 'of this kind, in the route lane');
trObs.generator.extras[0](tprobe.block(700, 1, [690, 740]));
eq(tp.length, 1, 'the minimum gap keeps the next block empty');
eq(tprobe.rolls(), 8, 'and the declined block still drew its one number');
trObs.generator.extras[0](tprobe.block(1300, 2, [1310, 1360]));
eq(tp.length, 2, 'far enough on, the route lane gets another');
eq(tracer._laneAt(1350), 2, 'and the strip knows that block');

const steps = [];
events.addEventListener('tracerStep', (e) => steps.push(e.detail.temp));
events.addEventListener('tracerLost', () => steps.push('lost'));
const trLog = [];
events.addEventListener('tracerOn', () => trLog.push('on'));
events.addEventListener('tracerOff', (e) => trLog.push(e.detail.reset ? 'reset' : 'off'));

game.restart();
game.state.intro = false;
game.state.speed = CONFIG.startSpeed;
game.world.distance = 50;
pl.x = laneX(2);
tracer._segs.length = 0;
tracer._lastA = -Infinity;
tracer._lastPickupD = -Infinity;
trObs.generator.extras[0](tprobe.block(0, 2, null, 200));
trObs.generator.extras[0](tprobe.block(200, 0, null, 400));
tracer.start();
eq(game.state.tracerTime, TG.duration, 'collecting fills the countdown');
eq(trLog[trLog.length - 1], 'on', 'tracerOn announced');
tracer.update(DT);
eq(tracer.drone.root.visible, true, 'the drone flies');
eq(tracer.drone.root.position.y, TG.height, 'the drone hovers at its height');
eq(tracer.drone.root.position.z, -TG.ahead, 'ahead of him');
eq(tracer.drone.root.position.x, laneX(2), 'in the lane the route takes there');
ok(tracer.ribbon.shown > 1, 'and paints the strip on it');
game.state.tracerTime = TG.duration;
for (let i = 0; i < Math.round(TG.stepTime / DT) + 2; i++) { tracer.update(DT); game.world.distance += game.state.speed * DT; }
eq(game.mult.temp, 1, 'five seconds on the strip = temp +1');
eq(steps[steps.length - 1], 1, 'and it is announced');
game.state.multiplier = 0;
game.update(DT);                          // the real score line: (base + run + temp) * factor
eq(game.state.multiplier, game.mult.base + game.mult.run + game.mult.temp, 'temp pays the score multiplier');
game.world.distance = 190;
tracer.ribbon.segs.length = 0;
tracer.update(DT);
ok(tracer.ribbon.segs.some((s) => s.x0 !== s.x1), 'the strip crosses over to the new route lane');
game.world.distance = 50;
pl.x = laneX(2) + (TG.ribbonWidth + CONFIG.playerWidth) / 2 - 0.05;
tracer.update(DT);
eq(game.mult.temp, 1, 'the strip is as wide as it reads');
pl.x = laneX(0);
for (let i = 0; i < 3; i++) tracer.update(DT);
eq(game.mult.temp, 0, 'stepping off the strip zeroes the bonus');
eq(steps[steps.length - 1], 'lost', 'and says so');
const lostN = steps.length;
tracer.update(DT);
eq(steps.length, lostN, 'only once, not every frame');
pl.x = laneX(2);
game.state.tracerTime = TG.duration;
for (let i = 0; i < Math.round(TG.stepTime / DT) - 3; i++) tracer.update(DT);
eq(game.mult.temp, 0, 'the timer starts over: no early +1');
for (let i = 0; i < 5; i++) tracer.update(DT);
eq(game.mult.temp, 1, 'and pays a full stepTime later');
game.mult.temp = TG.maxTemp;
game.state.tracerTime = TG.duration;
const capN = steps.length;
for (let i = 0; i < Math.round(TG.stepTime / DT) + 2; i++) tracer.update(DT);
eq(game.mult.temp, TG.maxTemp, 'the bonus stops at the cap');
eq(steps.length, capN, 'a capped step is not counted as earned');
while (tracer.active) tracer.update(DT);
eq(game.state.tracerTime, 0, 'the countdown ends the trace');
eq(game.mult.temp, 0, 'and takes the bonus with it');
eq(tracer.ribbon.shown, 0, 'the strip is gone');
eq(tracer.drone.root.visible, false, 'and the drone flies off');
eq(trLog[trLog.length - 1], 'off', 'tracerOff announced');
tracer.start();
game.restart();
eq(game.state.tracerTime, 0, 'a run start clears the tracer');
eq(tracer.active, false, 'and the trace');
eq(trLog[trLog.length - 1], 'reset', 'announced as a reset');
tracer.start();
game.halted = true;
tracer.update(DT);
eq(tracer.active, false, 'a catch ends the trace');
eq(game.mult.temp, 0, 'and its bonus');
game.halted = false;

// B3: bir Iron Man jet başlangıcı state.distance'ı ileri atar; şerit dünyayı takip eder
game.world.distance = 50;
game.state.distance = 5000;                    // the jet jumped the run 5 km ahead of the world
tracer.start();
tracer.ribbon.segs.length = 0;
tracer.update(DT);
eq(tracer.onX, laneX(2), 'the strip is read at the world distance, not the run distance');
eq(tracer.drone.root.position.x, laneX(2), 'and the drone flies in the lane the route takes there');
ok(tracer.ribbon.segs.every((s) => s.x0 === laneX(2) && s.x1 === laneX(2)), 'the ribbon is drawn on that lane');
game.state.distance = game.world.distance;     // the two agree again
tracer._stop(true);

// ---------- B4: ağ ve kahraman yeteneği Ağ Salınışı / Duvar Koşusu sırasında ateşlenmez ----------
const { WebPowerup } = await import('../src/powerups/web.js');
const { HeroSpecials } = await import('../src/powerups/hero-specials.js');
// the guard is what is under test, not the art: a bare instance with only the fields it reads
const zip = Object.create(WebPowerup.prototype);
zip.player = pl;
zip.heroSpecials = { isHero: () => false, active: false };
zip.line = { visible: false };
zip.anchor = { set() {}, clone: () => ({}) };
zip._handPosition = () => {};
zip._updateLine = () => {};
zip.zip = null;
zip._lastShotT = -Infinity;
game.restart();
game.state.intro = false;
game.state.webCharges = 3;
pl.reset();
pl.grounded = false;
pl.verticalLocked = true;                      // a power-up owns the height
eq(zip.tryShoot(), false, 'no web zip while a power-up owns the height');
eq(game.state.webCharges, 3, 'and no charge is spent');
eq(zip.zip, null, 'no zip starts');
pl.grounded = true;
zip.tryActivate();
eq(pl.vy, 0, 'a press does not jump him either');
pl.verticalLocked = false;
pl.grounded = false;
zip._lastShotT = -Infinity;
eq(zip.tryShoot(), true, 'positive control: the same shot fires once the flag is off');
eq(game.state.webCharges, 2, 'and now the charge is spent');
zip._endZip();

swing.start();                                 // a real Ağ Salınışı takes the height
eq(pl.verticalLocked, true, 'the swing owns it');
pl.grounded = false;
zip._lastShotT = -Infinity;
eq(zip.tryShoot(), false, 'the zip refuses during a real swing');
game.restart();                                // ends the swing

const arms = [];
zip.heroSpecials = { isHero: () => true, active: false, getHeroConfig: (s) => ({ name: s, duration: 6 }), activate: (skin, dur) => { arms.push([skin, dur]); return true; } };
game.state.webCharges = 1;
game.skin = 'hulk';
pl.verticalLocked = true;
eq(zip.tryActivate(), false, 'no hero special while a power-up owns the height');
eq(arms.length, 0, 'nothing is armed and no charge is spent');
eq(game.state.webCharges, 1, 'the charge is still there');
pl.verticalLocked = false;
zip.tryActivate();
eq(arms.length, 1, 'positive control: the same press arms it once the flight is over');
game.skin = 'spider';

const hsArms = [];
const hs = Object.create(HeroSpecials.prototype);
hs.player = pl;
hs.active = false;
hs.skills = { kitty: { activate: (d) => { hsArms.push(d); return true; } } };
pl.verticalLocked = true;
eq(hs.activate('kitty', 8), false, 'the specials manager refuses too');
eq(hsArms.length, 0, 'and does not arm the skill');
pl.verticalLocked = false;
eq(hs.activate('kitty', 8), true, 'positive control: it runs when the height is free');
eq(hs.active, true, 'and is now active');
hs.active = false;

// ---------- market: altı yer gücü de yükseltilebilir (shop.js) ----------
const UP_KEYS = ['bugle', 'spring', 'swing', 'decoy', 'wall', 'tracer'];
const upDur = (c, lv) => Math.round((c.baseDuration + lv * c.stepDuration) * 100) / 100;
for (const k of UP_KEYS) {
  const c = shop.SKILL_UPGRADE_CONFIG[k];
  eq(c.baseDuration, CONFIG[k].duration, `${k}: the base duration is the CONFIG value, not a copy`);
  eq(shop.getEffectiveSkillDuration(k), CONFIG[k].duration, `${k}: level 0 = the CONFIG length`);
}
for (const k of UP_KEYS) {
  const c = shop.SKILL_UPGRADE_CONFIG[k];
  for (let lv = 1; lv <= c.maxLevel; lv++) {
    eq(shop.getUpgradeCost(k), Math.floor(c.baseCost * c.costMultiplier ** (lv - 1)), `${k}: level ${lv} costs baseCost * costMultiplier^${lv - 1}`);
    ok(shop.buyUpgrade(k), `${k}: level ${lv} is for sale`);
    eq(shop.getEffectiveSkillDuration(k), upDur(c, lv), `${k}: level ${lv} lasts ${upDur(c, lv)} s`);
  }
  eq(shop.buyUpgrade(k), false, `${k}: buying stops at maxLevel ${c.maxLevel}`);
  eq(shop.getPlayerData().upgrades[k], c.maxLevel, `${k}: the level is in the save`);
  eq(shop.getEffectiveSkillDuration(k), upDur(c, c.maxLevel), `${k}: the last length is the designer's ${upDur(c, c.maxLevel)} s`);
}

// the started power-up takes the shop duration, the way the magnet does
const { BuglePowerup } = await import('../src/powerups/bugle.js');
const { SpringPowerup } = await import('../src/powerups/spring.js');
const bug = new BuglePowerup({ obstacles: mkObs() });
bug.start();
eq(game.state.bugleTime, upDur(shop.SKILL_UPGRADE_CONFIG.bugle, 12), 'the bugle doubles the score for its maxed 13 s');
const spr = new SpringPowerup({ obstacles: mkObs() });
spr.start();
eq(game.state.springTime, upDur(shop.SKILL_UPGRADE_CONFIG.spring, 20), 'the spring jumps for its maxed 16 s');
bug.update(DT); spr.update(DT);
game.state.bugleTime = 0; game.state.springTime = 0;
decoy.start();
eq(game.state.decoyTime, upDur(shop.SKILL_UPGRADE_CONFIG.decoy, 20), 'the doll forgives for its maxed 30 s');
decoy.reset();
tracer.start();
eq(game.state.tracerTime, upDur(shop.SKILL_UPGRADE_CONFIG.tracer, 20), 'the drone traces for its maxed 15 s');
tracer._stop(true);

// an upgraded flight still ends with the player back on the floor / in a lane
pl.reset();
game.state.speed = CONFIG.startSpeed;
swing.start();
eq(st.swingTime, upDur(shop.SKILL_UPGRADE_CONFIG.swing, 16), 'a maxed swing takes 12 s');
let sf = 0;
while (swing.active) { pl.floorY = 0; swing.beforePlayer(DT); pl.update(DT, true); swing.update(DT); sf++; }
ok(Math.abs(sf * DT - upDur(shop.SKILL_UPGRADE_CONFIG.swing, 16)) <= DT * 2, `the upgraded swing runs all of it (${sf} frames)`);
eq(pl.verticalLocked, false, 'the height is given back');
ok(pl.grounded && Math.abs(pl.y - pl.floorY) < 0.05, `he lands (${pl.y.toFixed(2)} m)`);

pl.reset();
pl.x = 1.0;
wall.start();
eq(game.state.wallTime, upDur(shop.SKILL_UPGRADE_CONFIG.wall, 15), 'a maxed wall run takes 9 s');
let wf2 = 0;
while (wall.active) { pl.floorY = 0; wall.beforePlayer(DT); pl.update(DT, true); wall.update(DT); wf2++; }
ok(Math.abs(wf2 * DT - upDur(shop.SKILL_UPGRADE_CONFIG.wall, 15)) <= DT * 2, `the upgraded wall run ends on its countdown (${wf2} frames)`);
eq(pl.lane, CONFIG.laneCount - 1, 'he ends in the outer lane');
ok(pl.grounded && Math.abs(pl.y - pl.floorY) < 0.05, `and on the floor (${pl.y.toFixed(2)} m)`);
game.restart();

// ---------- yeni görev kabloları ----------
eq(ms.missionText('decoy', 3), '3 Ağ Kuklası topla', 'decoy mission text');
eq(ms.missionText('wall', 30), 'Duvarda 30 m koş', 'wall mission text');
ok(ms.MISSION_POOL.find((d) => d.id === 'wall').onerun, 'the wall metres are per run');
ms.missions.set = 9;
ms.missions.level = 8;
ms.missions.items = [
  { id: 'decoy', goal: 2, progress: 0, done: false },
  { id: 'wall', goal: 30, progress: 0, done: false },
  { id: 'tracer', goal: 2, progress: 0, done: false },
];
emit('decoyOn');
eq(ms.missions.items[0].progress, 1, 'the decoy pickup itself counts into the decoy mission');
emit('decoyLure');
eq(ms.missions.items[0].progress, 1, 'a bait is not counted as well: the pickup is the goal');
emit('tracerStep', { temp: 1 });
eq(ms.missions.items[2].progress, 1, 'a strip step counts into the tracer mission');
game.state.wallMetres = 35;
sys.update();
eq(ms.missions.items[1].done, true, 'the metres run on a wall are measured');
emit('decoyOn');
emit('tracerStep', { temp: 2 });
eq(ms.missions.set, 10, 'all three done = the next set');
eq(game.mult.base, ms.missions.level + 1, 'and the permanent multiplier again');

// ---------- B2: hiçbir görev bir deriye bağlı değil, her hedef erişilebilir ----------
ok(!ms.MISSION_POOL.some((d) => d.id === 'special'), 'no mission needs a hero special: the default skin has none');
eq(ms.MISSION_POOL.filter((d) => d.max === 5).map((d) => d.id).sort().join(','), 'bugle,decoy,magnet,swing', 'the rare pickups cap their goal at 5');
eq(ms.goalFor(ms.MISSION_POOL.find((d) => d.id === 'tracer'), 60), 6, 'the tracer steps cap at 6');
eq(ms.goalFor(ms.MISSION_POOL.find((d) => d.id === 'wall'), 60), 120, 'the wall metres cap at 120');
for (let set = 1; set <= 60; set++) {
  for (const it of ms.makeSet(set)) {
    const def = ms.MISSION_POOL.find((d) => d.id === it.id);
    ok(it.goal <= (def.max === undefined ? Infinity : def.max), `set ${set}: ${it.id} goal ${it.goal} stays reachable`);
  }
}
const wallRun = (WG.duration - WG.liftTime - WG.landingTime) * speedAt(3000);
ok(wallRun >= 120, `a base wall run where the pickup first appears covers ${wallRun.toFixed(0)} m >= the 120 m cap`);

// Audio task 1
const AL = await import('../src/audio-logic.js');
const kv = (o) => (k) => (k in o ? o[k] : null);
eq(json(AL.loadSettings(kv({}))), json({ music: true, sfx: true }), 'no save: music and effects on');
eq(json(AL.loadSettings(kv({ 'spidey.muted': '1' }))), json({ music: false, sfx: false }), 'old mute save: both off');
eq(json(AL.loadSettings(kv({ 'spidey.muted': '0' }))), json({ music: true, sfx: true }), 'old unmuted save: both on');
eq(json(AL.loadSettings(kv({ 'spidey.muted': '1', 'spidey.music': '1' }))), json({ music: true, sfx: false }), 'a new key beats the old one');
eq(json(AL.loadSettings(kv({ 'spidey.music': 'x' }))), json({ music: true, sfx: true }), 'garbage falls back');
const saved = {}; AL.saveSettings((k, v) => { saved[k] = v; }, { music: false, sfx: true });
eq(json(saved), json({ 'spidey.music': '0', 'spidey.sfx': '1', 'spidey.muted': '0' }), 'save writes both keys + legacy');
AL.saveSettings((k, v) => { saved[k] = v; }, { music: false, sfx: false });
eq(saved['spidey.muted'], '1', 'all off keeps the legacy mute key');
eq(json(AL.loadSettings(kv(saved))), json({ music: false, sfx: false }), 'save -> load round trip');
let menuSeen = 0; events.addEventListener('menu', () => menuSeen++);
game.state.mode = 'over'; game.toMenu();
eq(menuSeen, 1, 'toMenu emits menu'); eq(game.state.mode, 'menu', 'toMenu reaches the menu');

// Audio task 2
const cs = () => ({ streak: 0, lastCoin: -10, lastPlay: -10 });
let s1 = cs(); const seqIdx = []; for (let i = 0; i < 12; i++) seqIdx.push(AL.coinNext(s1, i * 0.1));
eq(seqIdx.join(','), '0,1,2,3,4,5,6,7,4,5,6,7', 'ladder climbs 8 steps then sparkles on the top four');
eq(AL.coinNext(s1, 1.1 + 0.61), 0, 'a 0.61 s break starts again at step 0');
let s2 = cs(); let played = 0; for (let i = 0; i < 30; i++) if (AL.coinNext(s2, i / 30) >= 0) played++;
ok(played <= 12 && played >= 10, `30 magnet coins in 1 s play ${played} sounds (cap 12/s)`);
let s3 = cs(); const mag = []; for (let i = 0; i < 9; i++) { const k = AL.coinNext(s3, i / 30); if (k >= 0) mag.push(k); }
eq(mag.join(','), '0,1,2', 'skipped coins do not advance the ladder');
eq(AL.COIN_MIDI.length, 8, '8 ladder steps');
ok(AL.COIN_MIDI.every((m) => [9, 0, 2, 4, 7].includes(m % 12)), 'ladder is A minor pentatonic');
ok(Math.abs(AL.hz(AL.COIN_MIDI[0]) - 880) < 0.01 && Math.abs(AL.hz(AL.COIN_MIDI[7]) - 2349.32) < 0.01, 'ladder spans 880-2349 Hz');
ok(AL.COIN_COMP.every((c, i) => i === 0 || c < AL.COIN_COMP[i - 1]), 'higher steps play quieter');

// Audio task 3
const vp = new AL.VoicePool(44, [0, 4, 8, 12, 16]);
let n = 0; while (vp.claim(4, 1)) n++;
eq(n, 28, 'lowest priority stops at max - 16');
ok(vp.claim(0, 2), 'top priority still gets a voice');
eq(vp.claim(3, 3), false, 'prio 3 is refused above max - 12');
for (let i = 0; i < 100; i++) vp.release(1);
eq(vp.used, 0, 'release never goes below 0');
for (let i = 0; i < 10000; i++) { if (vp.claim(i % 5, 1 + (i % 3))) vp.release(1 + (i % 3)); }
eq(vp.used, 0, '10000 claim/release cycles leak nothing');
eq(AL.musicPoolMax(4), 36, 'low-end phone pool'); eq(AL.musicPoolMax(8), 44, 'normal pool');
ok(AL.shouldDuck({ level: 0.6, until: 5 }, 4, 0.45), 'a deeper duck wins');
eq(AL.shouldDuck({ level: 0.45, until: 5 }, 4, 0.6), false, 'a shallower duck waits');
ok(AL.shouldDuck({ level: 0.45, until: 5 }, 5, 0.6), 'after the hold any duck applies');

// Audio task 4
eq(AL.musicScene('menu', false), 'menu', 'menu scene');
eq(AL.musicScene('running', true), 'silent', 'intro is silent');
eq(AL.musicScene('running', false), 'run', 'run scene');
eq(AL.musicScene('paused', false), 'hold', 'pause keeps the scene');
eq(AL.musicScene('over', false), 'over', 'over scene');
eq(AL.resyncTime(10, 10.02), 10, 'on time: unchanged');
eq(AL.resyncTime(9, 10), 10.05, 'late: skip ahead, never burst');
const A_MINOR = [9, 11, 0, 2, 4, 5, 7];
for (const p of [AL.M_KICK, AL.M_RIM, AL.M_HAT]) eq(p.length, 16, 'menu drum pattern has 16 steps');
eq(AL.BOX.length, 8, 'music box has 8 bars'); eq(AL.MENU_BARS.length, 8, 'menu has 8 chords');
ok(AL.BOX.flat().every((x) => x[0] >= 0 && x[0] + x[2] <= 16 && A_MINOR.includes(x[1] % 12)), 'music box notes stay in their bar and in A minor');
ok(AL.MENU_BARS.every((c) => AL.CH[c]), 'every menu chord exists');

// Audio task 5
eq(AL.tierFor(11), 0, 'start speed = tier 0'); eq(AL.tierFor(13.5), 1, 'tier 1 at 13.5');
eq(AL.tierFor(17), 2, 'tier 2 at 17'); eq(AL.tierFor(22), 3, 'tier 3 at 22'); eq(AL.tierFor(39), 4, 'top speed = tier 4');
eq(AL.bpmFor(11), 112, '112 BPM at start'); eq(AL.bpmFor(26), 122, '122 at cruise'); eq(AL.bpmFor(39), 128, '128 at top');
eq(AL.bpmFor(800), 128, 'a boost never runs the tempo away');
let lastB = 0; for (let s = 11; s <= 39; s += 0.5) { ok(AL.bpmFor(s) >= lastB, 'tempo never falls'); lastB = AL.bpmFor(s); }
eq(json(AL.layersFor(0)), json({ fill: false, stabs: false, lead: false, kickB: false, hatsB: false, bassB: false, arp: false, sparkle: false, crash8: false }), 'tier 0 layers');
ok(AL.layersFor(2).lead && !AL.layersFor(1).lead, 'the lead opens at tier 2');
ok(AL.layersFor(4).arp && !AL.layersFor(3).arp, 'the arp opens at tier 4');
for (const t of [1, 2, 3, 4]) ok(Object.keys(AL.layersFor(t)).every((k) => !AL.layersFor(t - 1)[k] || AL.layersFor(t)[k]), `tier ${t} keeps every lower layer`);
for (const p of [AL.KICK_A, AL.KICK_B, AL.SNARE, AL.HAT_A, AL.HAT_B, AL.ARP_ORDER]) eq(p.length, 16, 'run pattern has 16 steps');
eq(AL.LEAD.length, 8, 'lead has 8 bars'); eq(AL.RUN_BARS.length, 8, 'run has 8 chords');
ok(AL.LEAD.flat().every((x) => x[0] >= 0 && x[0] + x[2] <= 16 && A_MINOR.includes(x[1] % 12)), 'lead notes stay in their bar and in A minor');
ok([...AL.BASS_A, ...AL.BASS_B].every((x) => x[0] + x[2] <= 16), 'bass notes stay in their bar');

// Audio task 6
ok(AL.stingerReady(-10, 0), 'first pickup stinger plays');
eq(AL.stingerReady(5, 6.5), false, 'a second pickup within 2 s is quiet');
ok(AL.stingerReady(5, 7), 'after 2 s it plays again');

await import('./test-audio.mjs');

console.log(`OK ${checks} checks`);

