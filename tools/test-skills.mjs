// tools/test-skills.mjs — mission setleri, skor çarpanı, yeni güçler ve Ağ Salınışı (PLAN.md 10).
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
game.state.distance = 50;
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
for (let i = 0; i < Math.round(TG.stepTime / DT) + 2; i++) { tracer.update(DT); game.state.distance += game.state.speed * DT; }
eq(game.mult.temp, 1, 'five seconds on the strip = temp +1');
eq(steps[steps.length - 1], 1, 'and it is announced');
game.state.multiplier = 0;
game.update(DT);                          // the real score line: (base + run + temp) * factor
eq(game.state.multiplier, game.mult.base + game.mult.run + game.mult.temp, 'temp pays the score multiplier');
game.state.distance = 190;
tracer.ribbon.segs.length = 0;
tracer.update(DT);
ok(tracer.ribbon.segs.some((s) => s.x0 !== s.x1), 'the strip crosses over to the new route lane');
game.state.distance = 50;
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

// ---------- yeni görev kabloları ----------
eq(ms.missionText('decoy', 3), '3 kez Venom\'u kuklayla kandır', 'decoy mission text');
eq(ms.missionText('wall', 30), 'Duvarda 30 m koş', 'wall mission text');
ok(ms.MISSION_POOL.find((d) => d.id === 'wall').onerun, 'the wall metres are per run');
ms.missions.set = 9;
ms.missions.level = 8;
ms.missions.items = [
  { id: 'decoy', goal: 2, progress: 0, done: false },
  { id: 'wall', goal: 30, progress: 0, done: false },
  { id: 'tracer', goal: 2, progress: 0, done: false },
];
emit('decoyLure');
eq(ms.missions.items[0].progress, 1, 'a real bait counts into the decoy mission');
emit('tracerStep', { temp: 1 });
eq(ms.missions.items[2].progress, 1, 'a strip step counts into the tracer mission');
game.state.wallMetres = 35;
sys.update();
eq(ms.missions.items[1].done, true, 'the metres run on a wall are measured');
emit('decoyLure');
emit('tracerStep', { temp: 2 });
eq(ms.missions.set, 10, 'all three done = the next set');
eq(game.mult.base, ms.missions.level + 1, 'and the permanent multiplier again');

console.log(`OK ${checks} checks`);

