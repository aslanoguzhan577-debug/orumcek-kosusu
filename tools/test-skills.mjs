// tools/test-skills.mjs — mission setleri, skor çarpanı, yeni güçler ve Ağ Salınışı (PLAN.md 10).
// Run: node tools/test-skills.mjs
// No browser: game.js runs on stubbed world / player, missions.js on a stubbed localStorage.

import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { PatternGenerator, createRng, speedAt, descLength, descLanes, girderOffset } from '../src/patterns.js';
import { floorW, warnAt, restAt, doubleChance, nextRow, nearestSafe, rewardFor } from '../src/event-logic.js';
import { districtAt, districtInfo, segCentre, phaseAt, discAt, tunnelAt, cityAt, mixHex, loopMetre, loopOf, dayPhaseAt, dressFor, districtEvent, createAnnouncer, ANCHOR_COUNTS, lanternLift, flockAt, cityHash, loopFlavor, weatherAt, celebrationKind } from '../src/city-logic.js';
import * as cityTex from '../src/city-tex.js';
import { SLOT, buildSlots, bugleDeck, heroSlot, recordPassed } from '../src/bugle-logic.js';

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

// Task 10: the fixed first three nights and deterministic later-loop distribution.
eq(json([1,2,3].map(loopFlavor)), json([{weather:null,festival:false},{weather:'rain',festival:true},{weather:'snow',festival:false}]), 'first three loop flavours');
ok(loopFlavor(4).festival, 'fourth loop is a festival');
let rainyLoops = 0, snowyLoops = 0;
for (let loop = 4; loop <= 403; loop++) {
  const flavor = loopFlavor(loop), h = cityHash(loop);
  eq(flavor.weather, h < 0.5 ? 'rain' : h < 0.75 ? 'snow' : null, 'weather uses the prescribed hash thresholds');
  eq(flavor.festival, loop % 2 === 0, 'only even later loops have festival dress');
  rainyLoops += flavor.weather === 'rain'; snowyLoops += flavor.weather === 'snow';
}
ok(rainyLoops/400 >= 0.4 && rainyLoops/400 <= 0.6 && snowyLoops/400 >= 0.15 && snowyLoops/400 <= 0.35, '400-loop rain and snow shares');
for (let s = 0; s <= 6000; s += 10) {
  eq(weatherAt(1,s).kind, null, 'first night always clear');
  if (s <= 4200 || s >= 4500) eq(weatherAt(2,s).k, 0, 'weather envelope zero outside its window');
}
for (const [s,k] of [[4200,0],[4220,0.5],[4240,1],[4350,1],[4460,1],[4480,0.5],[4500,0]]) eq(weatherAt(2,s).k,k,'exact smooth weather envelope');
eq(weatherAt(2,4300).kind,'rain','second night rain'); eq(weatherAt(3,4300).kind,'snow','third night snow');
eq(celebrationKind('night',0),'fireworks','night celebration'); eq(celebrationKind('golden',0),'tape','day celebration');
eq(celebrationKind('night',1),'wait','tunnel celebration waits'); eq(celebrationKind('night',0.1),'wait','wait until strictly below 0.1');
for (const loop of [1,2,3,4,5,6]) eq(dressFor('chinatown',1,loop).dress,loopFlavor(loop).festival?'ctFest':'ct1','festival selects the existing Chinatown recipe');

// Chinatown 2a: every cell paints real strokes; curves bulge 0.6 grid units outward.
{
  const cells = [], curves = [];
  let from;
  const g = { save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, closePath() {},
    fillRect: (...r) => cells.push(r), moveTo: (x, y) => { from = [x, y]; }, lineTo() {},
    quadraticCurveTo: (...q) => curves.push([...from, ...q]), stroke() {
      eq(g.lineCap, 'round', 'round brush caps'); eq(g.lineJoin, 'round', 'round brush joins'); eq(g.lineWidth, 1.1, 'exact grid brush width');
    } };
  cityTex.drawChineseAtlas(g);
  eq(cityTex.CHINESE_STROKES.length, 8, 'eight occupied character cells in each row');
  ok(cityTex.CHINESE_STROKES.every((cell) => cell.length > 0), 'all eight glyph cells contain brush paths');
  eq(cells.length, 16, 'red/gold and gold/red rows');
  eq(curves.length, 8, 'four curved strokes per colour row');
  for (const [x0,y0,cx,cy,x1,y1] of curves) {
    const mx = (x0+x1)/2, my = (y0+y1)/2;
    ok(Math.abs(Math.hypot(cx-mx,cy-my)-0.6) < 1e-12, 'quadratic control point exact offset');
    ok((cx-mx)*(mx-5)+(cy-my)*(my-5) >= 0, 'curve bulges away from character centre');
  }
}

// ---------- 11.3 task 1: route, linear colour clock, dressing and announcements ----------
for (const [d, id] of [[0, 'midtown'], [1499, 'midtown'], [1500, 'chinatown'], [2539, 'chinatown'],
  [2540, 'bridge'], [3339, 'bridge'], [3340, 'tunnel'], [3699, 'tunnel'], [3700, 'neon'],
  [5199, 'neon'], [5200, 'dawn'], [5999, 'dawn'], [6000, 'midtown'], [9340, 'tunnel'], [-5, 'midtown']]) {
  eq(districtAt(d), id, `district boundary ${d}`);
}
const segmentCounts = {};
let previousDistrict = null;
for (let serial = 0; serial <= 304; serial++) {
  const d = segCentre(serial), [id, k] = districtInfo(d);
  if (d < 0) continue;
  if (id !== previousDistrict) eq(k, 0, `first ${id} segment`);
  segmentCounts[id] = (segmentCounts[id] || 0) + 1;
  previousDistrict = id;
}
eq(json(segmentCounts), json({ midtown: 75, chinatown: 52, bridge: 40, tunnel: 18, neon: 75, dawn: 40 }), 'segment counts');
eq(json(districtInfo(segCentre(80))), json(['chinatown', 0, 1500]), 'first Chinatown segment');
for (const [d, key, value] of [[0, 'fog', 0x9ad4ff], [2000, 'fog', 0xffcf96], [3000, 'tint', 0x8a4a6c],
  [4000, 'fog', 0x1b1a4a], [5500, 'fog', 0xf4c4cc]]) eq(phaseAt(d)[key], value, `phase ${d}`);
ok(Math.abs(phaseAt(1500).hemiI - 1.55) < 1e-9, 'golden blend midpoint');
eq(json(phaseAt(8000)), json(phaseAt(2000)), 'phase repeats each loop');
for (let d = 0; d <= 6000; d += 10) {
  const p = phaseAt(d), t = tunnelAt(d), T = CONFIG.city.tunnelLook;
  const hemiI = p.hemiI + (T.hemiI - p.hemiI) * t, sunI = p.sunI + (T.sunI - p.sunI) * t;
  if (t === 0) ok(hemiI >= 1.4 && sunI >= 1.75, `outside light floor ${d}`);
  else ok(hemiI >= T.hemiI && sunI >= T.sunI, `tunnel light floor ${d}`);
  ok(p.fogNear >= 42 && p.fogFar >= 155, `fog floor ${d}`);
  for (const hex of [mixHex(p.hemiSky, T.hemiSky, t), p.sun]) {
    const rgb = [hex >> 16, (hex >> 8) & 255, hex & 255];
    ok(Math.min(...rgb) >= 0.62 * Math.max(...rgb), `pale light ${d}`);
  }
}
for (const [d, t] of [[3300, 0], [3345, 0.5], [3500, 1], [3685, 0.5], [3720, 0]]) eq(tunnelAt(d), t, `tunnel ${d}`);
for (const [d, t] of [[2000, 1], [2530, 0.5], [3000, 0], [3410, 0.5], [4000, 1]]) eq(cityAt(d), t, `skyline ${d}`);
eq(mixHex(0, 0xffffff, 0.5), 0xbcbcbc, 'linear RGB midpoint');
eq(mixHex(0x3f9eee, 0x080a26, 0), 0x3f9eee, 'colour start');
eq(mixHex(0x3f9eee, 0x080a26, 1), 0x080a26, 'colour end');
eq(loopOf(5999), 1, 'first loop'); eq(loopOf(6000), 2, 'second loop');
eq(dayPhaseAt(4000), 'night', 'Neon night'); eq(dayPhaseAt(3500), 'night', 'tunnel night');
eq(dayPhaseAt(5300), 'dawn', 'dawn phase');
for (const [id, k, expected] of [
  ['bridge', 10, { chunk: false, facade: null, dress: 'cable10', portal: ['tower', 10, 0] }],
  ['bridge', 24, { chunk: false, facade: null, dress: 'cable24', portal: ['vapur', 0, Math.PI] }],
  ['tunnel', 0, { chunk: false, facade: null, dress: 'shell', portal: ['mouth', 10, 0] }],
  ['tunnel', 17, { chunk: false, facade: null, dress: 'shell', portal: ['mouth', -10, Math.PI] }],
  ['tunnel', 9, { chunk: false, facade: null, dress: 'station1', portal: null }],
  ['neon', 0, { chunk: true, facade: 'neon', dress: null, portal: ['gantry', 0, 0] }],
  ['chinatown', 0, { chunk: true, facade: 'chinatown', dress: 'ct0', portal: ['gate', 10, 0] }],
  ['dawn', 0, { chunk: true, facade: 'midtown', dress: null, portal: ['midtownSign', 10, 0] }],
]) eq(json(dressFor(id, k, 1)), json(expected), `${id} dressing ${k}`);
for (let serial = 0; serial <= 700; serial++) {
  const live = new Set();
  for (let n = serial; n < serial + 13; n++) {
    const d = segCentre(n), [id, k] = districtInfo(d), portal = dressFor(id, k, loopOf(d)).portal;
    if (portal) { ok(!live.has(portal[0]), `portal ${portal[0]} reusable at ${serial}`); live.add(portal[0]); }
  }
}
const announcements = [];
let lastDistrict = null;
for (let d = 0; d <= 13000; d++) {
  const event = districtEvent(lastDistrict, d);
  if (event) { announcements.push([d, event.id, event.lap]); lastDistrict = event.id; }
}
eq(json(announcements), json([[0, 'midtown', 1], [1440, 'chinatown', 1], [2480, 'bridge', 1],
  [3280, 'tunnel', 1], [3640, 'neon', 1], [5140, 'dawn', 1], [5940, 'midtown', 2],
  [7440, 'chinatown', 2], [8480, 'bridge', 2], [9280, 'tunnel', 2], [9640, 'neon', 2], [11140, 'dawn', 2], [11940, 'midtown', 3]]), 'exact district events');
ok(announcements.every((e, i) => i === 0 || e[1] !== announcements[i - 1][1]), 'no repeated district');
const phaseStorage = { sunPos: [0, 0, 0] }, discStorage = [0, 0, 0, 0];
eq(phaseAt(1500, phaseStorage), phaseStorage, 'reused phase storage');
eq(discAt(2700, discStorage), discStorage, 'reused disc storage');
eq(json(discStorage), json([0.5, 0.27, 0.11, 0xfff0a0]), 'approved sunset disc');

const cityEvents = [];
const announcer = createAnnouncer((name, detail) => cityEvents.push([name, detail]));
for (const d of [0, 1440, 1441, 2480]) announcer.update(d);
eq(json(cityEvents), json(['midtown', 'chinatown', 'bridge'].map((id) => ['districtEnter', { id, lap: 1 }])), 'city announcer emits three entries');
announcer.reset(); announcer.update(0);
eq(json(cityEvents[3]), json(['districtEnter', { id: 'midtown', lap: 1 }]), 'reset announces Midtown again');
for (const name of ['facadeHook', 'drawMidtownAtlas', 'drawMidtownGlow', 'drawChinatownAtlas', 'drawChinatownGlow',
  'drawNeonAtlas', 'drawNeonGlow', 'drawTunnelAtlas', 'drawSkylineMask', 'drawShore', 'drawWater', 'drawTabela',
  'drawBuglePage', 'drawRecordBoard', 'drawTopFive', 'glyph']) eq(typeof cityTex[name], 'function', `node-safe painter ${name}`);

// ---------- 11.3 task 8: unchanged catalogue and exact news boundaries ----------
{
  const base = { score: 0, best: 20000, mult: 1, d: 0, stumbleD: -1, night: false, loop: 1, dawn: false };
  const slots = buildSlots({ name: 'OĞUZ', best: 0, mult: 3, skin: 'unknown', runs: 0 });
  eq(slots.length, 16, 'first-run Bugle has sixteen slots');
  ok(!json(slots).includes('{N}') && !json(slots).includes('{X}') && slots.every((s) => !s.row?.some((t) => t.includes('{'))), 'first-run copy has no unfilled tokens');
  eq(bugleDeck(base)[0], SLOT.SKIN, 'calm deck leads with selected character');
  eq(bugleDeck({ ...base, score: 15000 })[0], SLOT.CHASE5K, '5000 countdown boundary');
  ok(!bugleDeck({ ...base, best: 9999, score: 5000 }).includes(SLOT.CHASE5K), '5000 headline needs a 10000 record');
  eq(bugleDeck({ ...base, score: 19900 })[0], SLOT.CHASE100, '100 countdown boundary');
  eq(bugleDeck({ ...base, score: 20001 })[0], SLOT.BROKEN, 'broken record leads the deck');
  for (const score of [0, 50, 20001]) ok(!bugleDeck({ ...base, best: 0, score }).some((s) => [SLOT.BROKEN, SLOT.CHASE5K, SLOT.CHASE1K, SLOT.CHASE100].includes(s)), 'first run never chases an absent record');
  eq(CONFIG.city.stumbleNews, 600, 'unchanged catalogue matches configured stumble duration');
  ok(bugleDeck({ ...base, d: CONFIG.city.stumbleNews, stumbleD: 0 }).includes(SLOT.STUMBLE), 'stumble includes last configured metre');
  ok(!bugleDeck({ ...base, d: CONFIG.city.stumbleNews + 1, stumbleD: 0 }).includes(SLOT.STUMBLE), 'stumble expires next metre');
  let prev = 0, hits = 0;
  for (let score = 0; score <= 25000; score += 7) { if (recordPassed(prev, score, 20000)) hits++; ok(!recordPassed(prev, score, 0), 'no first-run recordPass'); prev = score; }
  eq(hits, 1, 'rising score crosses record exactly once');
}

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

// ---------- 11.5 görev 1: olay çarpanı, satır yardımcıları ----------
game.mult.event = 2;
game.update(0.1);
eq(game.state.multiplier, (game.mult.base + game.mult.run + game.mult.temp + 2) * game.mult.factor, 'event multiplier pays the score');
game.restart();
eq(game.mult.event, 0, 'the event multiplier resets at a run start');

eq(json(descLanes({ type: 'gap' })), json([0, 1, 2]), 'a gap spans all lanes');
eq(json(descLanes({ type: 'gate' })), json([0, 1, 2]), 'a gate spans all lanes');
eq(json(descLanes({ type: 'girder', open: 0 })), json([1, 2]), 'the girder covers the centre and the other outer lane');
eq(json(descLanes({ type: 'girder', open: 2 })), json([1, 0]), 'from the other side the covered lanes swap');
eq(json(descLanes({ type: 'low', lane: 2 })), json([2]), 'a normal obstacle keeps its lane');

eq(girderOffset(0, 2), -1.1, 'parked over the covered lanes');
eq(girderOffset(0, 0), 1.1, 'parked over the covered lanes (from the other side)');
ok(Math.abs(girderOffset(2.2, 2) - 1.1) <= 1e-9, 'at the far end of the swing it hangs over the open lane');
eq(girderOffset(1.2, 2), -1.1, 'it is already parked at lockTime');
for (const open of [0, 2]) {
  for (let t = 0; t <= 8 + 1e-9; t += 0.05) ok(Math.abs(girderOffset(t, open)) <= 1.1 + 1e-9, `girder stays within amp (open ${open}, tau ${t.toFixed(2)})`);
}
eq(descLength({ type: 'gap', len: 4.5 }), 4.5, 'a gap is as long as its len');
eq(descLength({ type: 'girder', len: 0.5 }), 0.5, 'a girder is as long as its len');

// ---------- 11.5 görev 5: seeded rows/zones, extras on every block ----------
{
  const generate = () => {
    const gen = new PatternGenerator(7919);
    let blocks = 0, extras = 0, specials = 0, calm = 0;
    const out = [];
    gen.addExtra((ctx) => {
      extras++;
      if (ctx.routeFree) ctx.push({ type: 'pickup', lane: ctx.route, d: (ctx.routeFree[0] + ctx.routeFree[1]) / 2, y: 1 });
    });
    while (gen.cursor < 30000) {
      const due = gen.cursor >= Math.min(gen.nextRowD, gen.nextEventD);
      const start = out.length;
      gen._block(out); blocks++;
      const batch = out.slice(start);
      const special = batch.some((o) => ['gap', 'gate', 'girder', 'event'].includes(o.type));
      if (special) specials++;
      else if (due) calm++;
      if (special || due) ok(!batch.some((o) => o.type === 'pickup'), 'special/calm blocks suppress pickups');
      eq(extras, blocks, 'extra exactly once per block, including safe start');
    }
    ok(specials > 0 && calm > 0, 'special and draining calm blocks exercised');
    for (const type of ['gap', 'gate', 'girder', 'event']) ok(out.some((o) => o.type === type), `${type} generated`);
    return out;
  };
  eq(json(generate()), json(generate()), 'same seed gives identical descriptors over 30 km');
  for (let seed = 1; seed <= 150; seed++) {
    eq(json(new PatternGenerator(seed).generateUntil(30000)), json(new PatternGenerator(seed).generateUntil(30000)), '150 seeds: deterministic descriptors over 30 km');
  }
}

// ---------- 11.3 görev 11: a row is placed only in its home district ----------
{
  const R = CONFIG.patterns.rows;
  for (const free of [1600, 2400]) {
    const v = speedAt(free), shiftWin = v * (CONFIG.laneSwitchTime + CONFIG.patterns.reactionTime) + 2;
    const gen = new PatternGenerator(9), stream = createRng(9);
    const out = [];
    stream();                                    // the one roll every due block consumes
    eq(gen._row(out, free, v, 0, shiftWin, 1), null, `no row type is at home at ${free} m`);
    eq(out.length, 0, 'the masked block places no row descriptor');
    eq(gen.nextRowD, R.firstAt, 'the row stays due instead of being spent');
    eq(gen.rng(), stream(), 'the existing roll is consumed even when no row results');
  }
  const free = 2800, v = speedAt(free), shiftWin = v * (CONFIG.laneSwitchTime + CONFIG.patterns.reactionTime) + 2;
  const gen = new PatternGenerator(9);
  gen.lastRow = 'gap';
  const out = [];
  ok(gen._row(out, free, v, 0, shiftWin, 1) !== null, 'the no-repeat rule is dropped when only one type is at home');
  eq(out.filter((o) => o.type === 'gap').length, 1, 'that retry still places the bridge gap');
}

// ---------- 11.3 görev 11.2: a zone is Goblin only in Neon, a tunnel overlap keeps it due ----------
{
  const kinds = new Set(); let blocked = 0;
  for (const free of [400, 1200, 2000, 2800, 3300, 4400, 5600, 9300]) {
    const v = speedAt(free), gen = new PatternGenerator(9), out = [], due = gen.nextEventD;
    const end = gen._eventZone(out, free, v, 0);
    if (end === null) {
      blocked++;
      eq(out.length, 0, `a zone overlapping the tunnel places nothing at ${free} m`);
      eq(gen.nextEventD, due, `that zone stays due instead of being spent at ${free} m`);
      continue;
    }
    kinds.add(out[0].kind);
    eq(out[0].kind, districtAt(out[0].d) === 'neon' ? 'goblin' : 'venom', `zone kind follows the district it starts in at ${free} m`);
    ok(gen.nextEventD > end, `the next zone is scheduled past the one just placed at ${free} m`);
  }
  eq(json([...kinds].sort()), json(['goblin', 'venom']), 'both kinds occur and Goblin appears only in Neon');
  ok(blocked >= 2, 'the tunnel overlap branch is exercised');
  const districts = CONFIG.city.districts, tunnel = districts.findIndex(([id]) => id === 'tunnel');
  const saved = [districts[tunnel][1], districts[tunnel + 1][1]];
  try {
    districts[tunnel][1] = 3100; districts[tunnel + 1][1] = 3900;
    const duration = CONFIG.events.venom.duration + CONFIG.events.tail;
    for (const base of [0, CONFIG.city.loop]) for (const d of [3100-duration-1, 3100-duration, 3100-duration+1, 3200, 3800, 3900]) {
      const gen = new PatternGenerator(9), out = [], due = gen.nextEventD;
      const end = gen._eventZone(out, base + d - CONFIG.patterns.checkGapTime - 1, 1, 0);
      const overlap = d < 3900 && d + duration > 3100;
      eq(end === null, overlap, 'event exclusion follows retuned district boundaries, including exact endpoints and later loops');
      if (overlap) { eq(out.length, 0, 'retuned tunnel places no event'); eq(gen.nextEventD, due, 'retuned rejection leaves event due'); }
    }
  } finally {
    [districts[tunnel][1], districts[tunnel + 1][1]] = saved;
  }
}

// ---------- 11.5 görev 6: pure event rows and timing ----------
{
  const E = CONFIG.events, P = CONFIG.patterns;
  let lastWarn = Infinity, lastRest = Infinity;
  const rng = createRng(11506);
  for (const d of [1200, 3000, 8000, 14600, 20000, 60000, 300000]) {
    ok(warnAt(d) >= floorW(1, d), 'warning includes one-lane reaction floor');
    ok(warnAt(d) <= lastWarn && restAt(d) <= lastRest && restAt(d) > 0, 'warning/rest decrease without a finite plateau');
    lastWarn = warnAt(d); lastRest = restAt(d);
    ok(doubleChance(d) <= 0.6, 'two-lane chance is capped');
    ok(E.goblin.lead >= Math.max(E.warnEasy, floorW(2, d)) + 0.1, 'Goblin lead covers every row warning');
    for (let mask = 1; mask < 8; mask++) for (let aim = 0; aim < 3; aim++) {
      const prev = [0, 1, 2].map((l) => !!(mask & (1 << l)));
      if (!prev[aim]) continue;
      for (let n = 0; n < 500; n++) {
        let draws = 0;
        const row = nextRow(() => { draws++; return rng(); }, prev, aim, d);
        eq(draws, 2, 'each row consumes exactly two draws');
        ok(row.deadly.some((v) => !v) && row.deadly[aim], 'aim is deadly and at least one lane is safe');
        let delta = 0;
        for (let l = 0; l < 3; l++) if (prev[l]) {
          const distances = [0, 1, 2].filter((c) => !row.deadly[c]).map((c) => Math.abs(c - l));
          delta = Math.max(delta, Math.min(...distances));
        }
        eq(row.delta, delta, 'delta matches brute-force worst escape');
        ok(row.warn >= floorW(delta, d), 'row covers its full escape floor');
        ok(row.warn >= P.minReaction + delta * CONFIG.laneSwitchTime, 'row retains human reaction plus every lane crossing');
      }
    }
  }
  eq(doubleChance(1200), 0, 'first Venom has single-lane strikes');
  ok(E.venom.duration - E.venom.intro - E.venom.outro >= 3 * (warnAt(1200) + E.venom.slamTime + restAt(1200)), 'at least three strikes fit');
  eq(json(rewardFor('venom', 4, 0)), json({ coins: 45, mult: 3, clean: true }), 'flawless Venom reward');
  eq(json(rewardFor('goblin', 5, 1)), json({ coins: 30, mult: 1, clean: false }), 'survived Goblin reward');
  eq(nearestSafe([true, false, false], 0), 1, 'nearest centre escape');
  eq(nearestSafe([true, true, false], 0), 2, 'two-lane escape');
  eq(nearestSafe([false, true, false], 1), 0, 'equal outer lanes tie left');
}

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

// ---------- 11.5 görev 2: gerçek collider / player döngüsü, çizim headless ----------
const { Obstacles } = await import('../src/obstacles.js');
const rowDT = 1 / 120;
const rowLog = [];
const rowListeners = ['crash', 'stumble', 'rowWarn', 'rowPass', 'gapPatch', 'senseDodge'].map((name) => {
  const fn = (e) => rowLog.push({ name, ...e.detail, atD: game.world.distance });
  events.addEventListener(name, fn);
  return [name, fn];
});
const rowSaved = { player: game.player, world: game.world, heroSpecials: game.heroSpecials, web: game.web };
function rowHarness(speed, lane = 1) {
  const player = new Player({ root: {}, setState() {}, update() {} });
  player.lane = lane;
  player.x = player.lastX = player._laneFromX = laneX(lane);
  const world = { distance: 0, segments: [], onRecycle() {} };
  const ob = new Obstacles({ add() {} }, world, player);
  let crashes = 0, stumbles = 0;
  ob.hooks.onCrash = () => { crashes++; };
  ob.hooks.onSideStumble = () => { stumbles++; };
  game.player = player; game.world = world; game.web = null; game.heroSpecials = null;
  game.state.speed = speed; game.state.springTime = 0; game.halted = false;
  rowLog.length = 0;
  return {
    player, ob, world,
    get crashes() { return crashes; }, get stumbles() { return stumbles; },
    step(dt = rowDT, sense = null) {
      world.distance += speed * dt;
      ob.beforePlayer(dt);
      sense?.beforePlayer(dt);
      player.update(dt, true);
      ob.update(dt);
    },
    run(seconds, sense = null, dt = rowDT) { for (let t = 0; t < seconds; t += dt) this.step(dt, sense); },
    spawn(type, d = 8, open = 2, len = type === 'gap' ? 4 : type === 'gate' ? CONFIG.obstacles.gate.depth : CONFIG.obstacles.girder.depth) {
      ob._spawn({ type, lane: 1, d: world.distance + d, len, open });
    },
  };
}
const rowCount = (name, type) => rowLog.filter((e) => e.name === name && (!type || e.type === type)).length;
for (const speed of [20, 39]) {
  let h = rowHarness(speed);
  h.spawn('gap');
  eq(h.ob.active.length, 3, 'gap: three colliders');
  eq(json(h.ob.active.map((o) => o.lane)), json([0, 1, 2]), 'gap: all lanes');
  eq(h.ob.active.filter((o) => o.owner).length, 1, 'gap: one owner');
  ok(h.ob.active.every((o) => o.group === h.ob.active[0].group), 'gap: shared group');
  h.run(1);
  eq(rowCount('crash'), 1, `ground gap: one crash at ${speed}`);
  eq(h.crashes, 1, 'front hook once');
  eq(h.player.floorY, 0, 'pit never raises the floor');
  eq(rowCount('rowPass'), 0, 'a hit row is not passed');

  h = rowHarness(speed); h.spawn('gap', speed * 0.1); h.player.jump(); h.run(0.8);
  eq(rowCount('crash'), 0, `jump before lip at ${speed}`);
  eq(rowCount('rowPass', 'gap'), 1, 'jump passes the gap once');
  h = rowHarness(speed); h.spawn('gap', -1);
  h.player.y = 1; h.player.vy = -16; h.player.grounded = false;
  h.run(0.3);
  eq(rowCount('crash'), 1, 'falling into the pit is a front hit');
  h.run(0.5); eq(rowCount('rowPass'), 0, 'falling into a row never earns a pass');
  h = rowHarness(speed); h.spawn('gap', -4.1);
  h.player.y = 0.35; h.player.vy = -7; h.player.grounded = false;
  h.step(1 / 60);
  eq(rowCount('crash'), 1, 'swept far edge can still hit on the last overlap frame');
  eq(rowCount('rowPass'), 0, 'beforePlayer must not award a pass before that collision');

  h = rowHarness(speed); h.spawn('gap');
  const mates = [...h.ob.active], removed = mates[1];
  h.ob.remove(removed);
  ok(!h.ob.active.includes(removed), 'remove splices the requested collider immediately');
  ok(h.ob.active.every((o) => o.z === 1e6), 'mates wait for normal release');
  eq(h.ob.patches.length, 1, 'one patch per group');
  eq(rowCount('gapPatch'), 1, 'one patch event');
  h.step();
  ok(mates.every((o) => !h.ob.active.includes(o)), 'all mates released next frame');
  const patchZ = h.ob.patches[0].z;
  h.ob.shift(-2);
  eq(h.ob.patches[0].z, patchZ - 2, 'catch knockback shifts patches');
  h.run(1);
  eq(rowCount('crash'), 0, 'patch is safe to run across');
  h.ob.reset(); eq(h.ob.patches.length, 0, 'reset clears patches');
  h.spawn('low', 30, 2, CONFIG.obstacles.low.depth);
  eq(h.ob.active[0].group, null, 'reused normal collider has no group');
  eq(h.ob.active[0].owner, false, 'reused normal collider is not an owner');

  h = rowHarness(speed); h.spawn('gap'); h.spawn('gate', 20); h.spawn('low', 30, 2, CONFIG.obstacles.low.depth);
  for (let i = h.ob.active.length - 1; i >= 0; i--) h.ob.remove(h.ob.active[i]);
  h.step(); eq(h.ob.active.length, 0, 'reverse-index hero clear removes mixed groups safely');
  eq(rowCount('gapPatch'), 1, 'reverse clear patches once');
  eq(rowCount('rowPass'), 0, 'removed owners emit no pass');

  h = rowHarness(speed); h.spawn('gate'); h.run(1);
  eq(rowCount('crash'), 1, 'standing hits gate');
  h = rowHarness(speed); h.spawn('gate'); h.player.rescueSlide(); h.run(1);
  eq(rowCount('crash'), 0, 'slide clears gate');
  eq(rowCount('rowPass', 'gate'), 1, 'gate passed once');
  for (const lane of [0, 1, 2]) {
    h = rowHarness(speed, lane); h.spawn('girder'); h.run(1);
    eq(rowCount('crash'), lane === 2 ? 0 : 1, `girder lane ${lane}`);
    eq(rowCount('rowPass', 'girder'), lane === 2 ? 1 : 0, 'girder group pass is emitted once');
  }
  h = rowHarness(speed, 2); h.spawn('girder', speed * 0.045); h.player.changeLane(-1); h.run(0.2);
  eq(rowCount('stumble'), 1, 'switching beside the girder stumbles');
  for (const type of ['gap', 'gate', 'girder']) {
    h = rowHarness(speed); h.spawn(type, speed * 2.5);
    h.run(0.09); eq(rowCount('rowWarn'), 0, 'no early row warning');
    while (-h.ob.active[0].z / speed > CONFIG.obstacles.rowWarnTime) h.step();
    eq(rowCount('rowWarn'), 1, 'warning on first frame at tau <= 2.4');
    h.run(0.2); eq(rowCount('rowWarn'), 1, 'warning once per row');
  }
  h = rowHarness(speed); h.spawn('gap');
  game.heroSpecials = { active: true, mode: 'cap' };
  let absorbed = 0;
  h.ob.hooks.onFrontHit = () => { absorbed++; return true; };
  h.run(1);
  eq(absorbed, 0, 'Cap ignores pits explicitly even at ground height');
  eq(rowCount('crash'), 0, 'Cap surf gap has no hit');
  eq(h.ob.patches.length, 0, 'surf does not destroy the gap');
  h = rowHarness(speed);
  h.ob.grace(1); eq(h.ob.graced, true, 'graced getter');
  eq(h.ob.eventHit(0), false, 'grace refuses event hit');
  eq(rowCount('stumble'), 0, 'graced hit is silent');
  h.run(1.1); eq(h.ob.graced, false, 'grace expires');
  eq(h.ob.eventHit(0), true, 'event hit reaches shared side path');
  eq(rowCount('stumble'), 1, 'event stumbles'); eq(h.stumbles, 1, 'side stumble hook');
  h.ob.hooks.onSideHit = (hit) => { h.ob.remove(hit.obstacle); return true; };
  h.run(0.4); h.ob.eventHit(0);
  eq(rowCount('stumble'), 1, 'side absorb suppresses event stumble');
  let zone = null;
  h.ob.hooks.onEventZone = (desc) => { zone = desc; };
  const desc = { type: 'event', kind: 'venom', d: 1200, len: 400 };
  h.ob._spawn(desc);
  eq(zone, desc, 'zone hook receives original descriptor');
  eq(h.ob.active.length, 0, 'zone has no collider');
}
// The surf expires after Player.update, before the collider reads lastY from the hover frame.
for (const speed of [19, 39]) for (const dt of [1 / 120, CONFIG.dtCap]) for (const sliding of [false, true]) {
  const h = rowHarness(speed);
  h.spawn('gap', -1, 2, 6);
  const surf = Object.assign(Object.create(HeroSpecials.prototype), {
    player: h.player, obstacles: h.ob, active: true, mode: 'cap', skills: {}, cap: {},
    shield: { root: { rotation: { set() {} } } },
  });
  game.heroSpecials = surf;
  if (sliding) h.player.rescueSlide();
  h.ob.beforePlayer(dt);
  surf.beforePlayer(dt);
  h.player.update(dt, true);
  surf.deactivate(true);
  h.ob.update(dt);
  h.run(0.6, null, dt);
  eq(rowCount('crash') + rowCount('stumble'), 0, 'Cap exit over a long gap never hits');
  eq(h.ob.patches.length, 0, 'Cap exit leaves the gap intact');
  eq(h.ob.graced, false, 'Cap exit grants no general grace');
  h.spawn('gap', speed * 0.1);
  h.run(0.5, null, dt);
  eq(rowCount('crash'), 1, 'a later gap still hits after Cap exit');
}

for (const type of ['gap', 'gate', 'girder']) {
  const h = rowHarness(39);
  h.spawn(type, 0.4);
  const surf = Object.assign(Object.create(HeroSpecials.prototype), {
    player: h.player, obstacles: h.ob, active: true, mode: 'cap', skills: {}, cap: {},
    shield: { root: { rotation: { set() {} } } },
  });
  game.heroSpecials = surf;
  h.ob.beforePlayer(rowDT);
  surf.beforePlayer(rowDT);
  h.player.update(rowDT, true);
  surf.deactivate(true);
  h.ob.update(rowDT);
  eq(h.crashes, type === 'gap' ? 0 : 1, `Cap exit forgives only the pit: ${type}`);
}

{
  const { IronSpiderPowerup } = await import('../src/powerups/ironspider.js');
  const h = rowHarness(20);
  h.spawn('gap', -1);
  h.spawn('low', 4, 2, CONFIG.obstacles.low.depth);
  let savedPositions;
  const onSave = (e) => { savedPositions = e.detail.positions; };
  events.addEventListener('ironSave', onSave);
  const suit = Object.assign(Object.create(IronSpiderPowerup.prototype), {
    active: true, obstacles: h.ob, player: { useModel() {} }, ironModel: {}, normalModel: {},
  });
  ok(suit._absorb(), 'Iron Spider absorbs beside a gap');
  eq(savedPositions.filter((p) => p.y === 0).length, 1, 'gap save spark is at deck level');
  const low = CONFIG.obstacles.low;
  eq(savedPositions.filter((p) => p.y === low.height / 2).length, 1, 'solid obstacle spark keeps its centre height');
  eq(h.ob.patches.length, 1, 'Iron Spider still patches the gap once');
  events.removeEventListener('ironSave', onSave);
}
// ---------- 11.5 görev 4: his, gerçek hareket ve çarpışma döngüsü ----------
const { SensePowerup } = await import('../src/powerups/sense.js');
for (const dt of [rowDT, 1 / 60, 1 / 30, CONFIG.dtCap]) for (const speed of [19, 26, 39]) for (const type of ['gap', 'gate']) {
  const h = rowHarness(speed);
  h.spawn(type, speed * 1.5, 2, type === 'gap' ? Math.min(6, Math.max(4, Math.round(speed * CONFIG.obstacles.gap.lenTime * 2) / 2)) : CONFIG.obstacles.gate.depth);
  const sense = new SensePowerup({ player: h.player, obstacles: h.ob });
  sense.start(); h.run(2.3, sense, dt);
  eq(json(rowLog.filter((e) => e.name === 'senseDodge').map((e) => e.action)), json([type === 'gap' ? 'jump' : 'slide']), `${type}: sense chooses the row verb at ${speed}`);
  eq(rowCount('crash') + rowCount('stumble'), 0, `${type}: sense clears it at ${speed}, dt ${dt}: ${json(rowLog)}`);
  eq(rowCount('rowPass', type), 1, `${type}: sense passes the row`);
}
for (const dt of [rowDT, 1 / 60, 1 / 30, CONFIG.dtCap]) for (const speed of [20, 39]) for (const open of [0, 2]) for (const lane of [1, 2 - open]) {
  const h = rowHarness(speed, lane);
  h.spawn('girder', speed * 1.5, open);
  const sense = new SensePowerup({ player: h.player, obstacles: h.ob });
  sense.start(); h.run(2.3, sense, dt);
  const action = open === 2 ? 'right' : 'left';
  eq(json(rowLog.filter((e) => e.name === 'senseDodge').map((e) => e.action)), json(Array(Math.abs(open - lane)).fill(action)), `girder: sense crosses from ${lane} to ${open} at ${speed}`);
  eq(h.player.lane, open, 'sense reaches the green lane');
  eq(rowCount('crash') + rowCount('stumble'), 0, 'sense crosses both covered lanes without hit');
  eq(rowCount('rowPass', 'girder'), 1, 'sense passes the girder once');
}
// Existing shapes still use their original verb / lane escape.
for (const [type, expected] of [['low', 'jump'], ['high', 'slide'], ['wagons', 'left']]) {
  const h = rowHarness(20);
  h.ob._spawn({ type, lane: 1, d: 30, len: descLength({ type, cars: 1 }), cars: 1 });
  const sense = new SensePowerup({ player: h.player, obstacles: h.ob });
  sense.start(); h.run(2.3, sense);
  eq(rowLog.find((e) => e.name === 'senseDodge')?.action, expected, `${type}: original sense action`);
  eq(rowCount('crash') + rowCount('stumble'), 0, `${type}: original sense remains safe`);
}
for (const blocked of ['beside', 'tooSoon', 'farLane']) {
  const h = rowHarness(20, 0);
  h.spawn('girder', 8);
  const lane = blocked === 'farLane' ? 2 : 1;
  h.ob._spawn({ type: 'wagons', lane, d: blocked === 'beside' ? 0 : 5, len: CONFIG.obstacles.wagon.length, cars: 1 });
  const sense = new SensePowerup({ player: h.player, obstacles: h.ob });
  eq(sense._freeLane(h.player, 20, h.ob.active), 0, `two-lane escape rejects ${blocked}`);
}

// ---------- 11.5 görev 3: M0–M3 parçaları, kapasite ve runtime matrisleri ----------
const { readFile } = await import('node:fs/promises');
const { runInNewContext } = await import('node:vm');
{
  const { createDayCycle } = await import('../src/daycycle.js');
  class TestColor {
    constructor(r = 0.3, g = 0.6, b = 0.9) { this.r=r; this.g=g; this.b=b; }
    setHex(hex) { this.hex = hex; return this; } setScalar() { return this; } set() { return this; }
    copy(c) { this.r=c.r; this.g=c.g; this.b=c.b; this.hex=c.hex; return this; }
    clone() { return new TestColor().copy(this); }
    multiplyScalar(k) { this.r*=k; this.g*=k; this.b*=k; return this; }
  }
  const c = () => new TestColor(), light = () => ({ color: c(), groundColor: c(), position: c() });
  const obstacle = Object.freeze({ color: Object.freeze(c()), emissive: c(), emissiveIntensity: 1 }), coin = {}, sky = { uniforms: {} };
  for (const key of ['uTop','uMid','uHorizon','uFar','uNear','uWin','uWinOn','uSun','uSunCol','uStars','uDots','uDark','uCity']) sky.uniforms[key] = { value: c() };
  const rim = { m: { color: Object.freeze(c().setHex(0x15171c)) }, base: 0x15171c };
  const options = { scene: { background: c(), fog: { color: c() } }, hemi: light(), sun: light(), sky, tinted: [], coin, obstacle, rims: [rim] };
  const clock = createDayCycle(options);
  const originalColour = json(obstacle.color);
  for (const d of [0, 2570, 3330, 3345, 3500, 3685, 3700, 4300, 5300, 6000]) {
    clock.update(d);
    eq(json(obstacle.color), originalColour, 'body emission never changes the obstacle colour');
    const k = CONFIG.city.obstacleGlow * (phaseAt(d).nightBlend * (1-tunnelAt(d)) + tunnelAt(d));
    for (const channel of ['r','g','b']) ok(Math.abs(obstacle.emissive[channel] - obstacle.color[channel] * k) < 1e-12, 'R7: emission is own colour times linear day/tunnel k');
    eq(obstacle.emissiveIntensity, 1, 'R7: the shared material emission intensity is unchanged');
    eq(rim.m.color.hex, 0x15171c, 'D4: obstacle outline keeps its pre-11.3 ink in every phase and tunnel blend');
  }
  for (const [d,k] of [[0,0],[1300,0],[2440,0],[2700,0.045],[3345,0.114375],[3500,0.18],[4300,0.18],[5150,0.099],[6000,0]]) {
    clock.update(d);
    for (const channel of ['r','g','b']) ok(Math.abs(obstacle.emissive[channel]-obstacle.color[channel]*k)<1e-12, 'R7: exact noon/sunset/tunnel/night/dawn/reset coefficient');
    eq(rim.m.color.hex, 0x15171c, 'R7: noon, sunset, night and tunnel outlines always ink');
  }
  const daySource = await readFile(new URL('../src/daycycle.js', import.meta.url), 'utf8');
  ok(!/NIGHT\.rim|ffb020|rims|outline.*setHex/.test(daySource), 'R7: no rim normalisation or outline tint/write path');
  ok(!('rim' in CONFIG.city.tunnelLook) && !('rim' in CONFIG.city.phase.NIGHT), 'R7: obsolete outline controls removed');
  const track = { emissive: c().setHex(0x123456), emissiveIntensity: 0.07 }, facade = { color: c(), emissiveMap: {} }, plain = { color: c() };
  const wetClock = createDayCycle({ ...options, tinted: [facade,plain], track });
  for (const [d,hex,k,boost] of [[10300,0x24407a,0.3,1.1],[10220,0x24407a,0.15,1.05],[16300,0x8090c0,0.12,1]]) {
    wetClock.update(d); eq(track.emissive.hex,hex,'wet track colour'); eq(track.emissiveIntensity,k,'wet track exact intensity');
    ok(Math.abs(facade.emissiveIntensity-phaseAt(d).glow*boost)<1e-12,'rain boosts only facade glow by 10 percent');
    eq(plain.emissiveIntensity,phaseAt(d).glow,'plain scenery glow unchanged');
    eq(options.scene.fog.near,phaseAt(d).fogNear,'weather preserves reaction fog'); eq(options.hemi.intensity,phaseAt(d).hemiI,'weather never changes lights');
  }
  for (const d of [0,4300,10500]) { wetClock.update(d); eq(track.emissive.hex,0x123456,'dry/reset restores original track emission'); eq(track.emissiveIntensity,0.07,'dry/reset restores original track intensity'); }
}
const citySource = await readFile(new URL('../src/city.js', import.meta.url), 'utf8');
ok(citySource.includes('dispose() {\n      dayCycle.update(0);'), 'city disposal restores the dry track and shared day state');
eq(await readFile(new URL('../src/bugle-logic.js', import.meta.url), 'utf8'), await readFile(new URL('../tasarim/proto/11-3-mansetler.js', import.meta.url), 'utf8'), 'Bugle catalogue including import self-check copied unchanged');
{
  const text = [], frames = [];
  const g = { font: '', fillText: (t) => text.push(String(t)), strokeText() {},
    measureText(t) { return { width: String(t).length * parseFloat(this.font) * 0.4 }; } };
  for (const name of ['fillRect','beginPath','arc','fill','ellipse','stroke','moveTo','lineTo','quadraticCurveTo','closePath','save','restore','rect','clip','translate','rotate']) g[name] = () => {};
  g.strokeRect = (...args) => frames.push(args);
  const slots = buildSlots({ name: 'OĞUZ', best: 20000, mult: 5, skin: 'kitty', runs: 1 });
  cityTex.paintBugle(g, slots, 'OĞUZ', 20000, [{ n: 'OĞUZ', s: 20000 }]);
  eq(frames.filter(([x,y,w,h]) => w === 504 && h === 248 && x % 512 === 4 && y % 256 === 4).length, 16, 'all sixteen slots retain their approved frame');
  ok(text.includes('ŞEHRİN EN HIZLILARI') && text.some((t) => t.includes('ARANIYOR: OĞUZ')), 'atlas dispatches real top-five and wanted painters');
  for (const [x,y] of frames) ok(x >= 0 && y >= 0 && x < 2048 && y < 1024, 'painted frames stay inside sixteen-slot atlas');
}
const sharedFacade = runInNewContext(citySource.slice(citySource.indexOf('  const U ='), citySource.indexOf('  const plainMat =')) + '\n({ U, facades });', {
  THREE: { Color: class {} }, CONFIG, toonMaterial: (colour, options) => ({ ...options }), facadeHook: cityTex.facadeHook, atlases: {},
});
for (const material of Object.values(sharedFacade.facades)) {
  const shader = { uniforms: {}, fragmentShader: '#include <common>\n#include <emissivemap_fragment>\n#include <opaque_fragment>' };
  material.onBeforeCompile(shader);
  for (const name in sharedFacade.U) eq(shader.uniforms[name], sharedFacade.U[name], `facades share ${name}`);
  eq(Object.keys(shader.uniforms).join(), 'uWinOn', 'B1: facade hook only switches night windows');
  ok(!/uDot|uHalftone|uBaseTone|uSunLum|fwidth|outgoingLight\s*=/.test(shader.fragmentShader), 'B1: no facade dot or flat shadow drawing path');
  ok(shader.fragmentShader.endsWith('#include <opaque_fragment>'), 'B1: existing toon surface shading stays intact');
}
{
  const g = { measureText: () => ({ width: 100 }), createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }), getImageData: () => ({ data: new Uint8ClampedArray(4) }) };
  for (const name of ['fillRect','strokeRect','beginPath','closePath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','ellipse','fill','stroke','save','restore','clip','rect','translate','scale','rotate','fillText','strokeText','putImageData']) g[name] = () => {};
  g.arc = (x, y, radius) => ok(radius > 4, 'B1: building atlas arcs are window/sign illustrations, never a field of dots');
  for (const paint of ['drawMidtownAtlas','drawMidtownGlow','drawChinatownAtlas','drawChinatownGlow','drawNeonAtlas','drawNeonGlow','drawTunnelAtlas']) cityTex[paint](g);
  const source = await readFile(new URL('../src/city-tex.js', import.meta.url), 'utf8');
  const buildingPainters = source.slice(source.indexOf('// ===================================================================== FACADE ATLASES'), source.indexOf('// ===================================================================== SKYLINE MASK'));
  ok(!/halftone|dotted|y\s*<\s*7|k\s*<\s*40/.test(buildingPainters), 'B1: building texture painters contain no halftone, LED dot grid or concrete speckle path');
}

// ---------- 11.3 task 4: actual fixed board pool, UVs and two-loop recycle walk ----------
{
  class BoardVector {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { return this.set(v.x,v.y,v.z); }
    subVectors(a,b) { return this.set(a.x-b.x,a.y-b.y,a.z-b.z); }
    normalize() { const n = Math.hypot(this.x,this.y,this.z); return this.set(this.x/n,this.y/n,this.z/n); }
  }
  class BoardRotation {
    constructor() { this.angle = 0; }
    setFromAxisAngle(axis, angle) { this.angle = angle; this.axis = axis; return this; }
    setFromUnitVectors() { this.angle = 0; return this; }
  }
  class BoardMatrix {
    constructor() { this.elements = new Float32Array(16); }
    compose(p, q, s) {
      const e = this.elements, c = Math.cos(q.angle), n = Math.sin(q.angle);
      e.fill(0); e[0] = c * s.x; e[2] = -n * s.x; e[5] = s.y; e[8] = n * s.z; e[10] = c * s.z;
      if (q.axis?.z === 1) { e[0]=c*s.x; e[1]=n*s.x; e[2]=e[8]=0; e[4]=-n*s.y; e[5]=c*s.y; e[10]=s.z; }
      e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1; return this;
    }
    copy(m) { this.elements.set(m.elements); return this; }
    setPosition(x,y,z) { this.elements[12]=x; this.elements[13]=y; this.elements[14]=z; return this; }
    multiplyMatrices(a,b) { return this.copy(a).multiply(b); }
    makeRotationX(a) {
      const e = this.elements; e.fill(0); e[0] = e[15] = 1; e[5] = e[10] = Math.cos(a); e[6] = Math.sin(a); e[9] = -Math.sin(a); return this;
    }
    multiply(m) {
      const a = [...this.elements], b = m.elements;
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) this.elements[c*4+r] = a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
      return this;
    }
  }
  class BoardAttribute {
    constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
    setUsage() {}
    setXYZW(i, ...v) { this.array.set(v, i * 4); }
  }
  class BoardPlane { setAttribute(k, a) { this[k] = a; } }
  class BoardMesh {
    constructor(geometry, material, n) {
      this.geometry = geometry; this.material = material;
      this.instanceMatrix = new BoardAttribute(new Float32Array(n * 16), 16);
    }
    setMatrixAt(i, m) { this.instanceMatrix.array.set(m.elements, i * 16); }
  }
  const THREE = { PlaneGeometry: BoardPlane, MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); } },
    InstancedBufferAttribute: BoardAttribute, InstancedMesh: BoardMesh, Matrix4: BoardMatrix, Vector3: BoardVector, Quaternion: BoardRotation };
  const boardSource = await readFile(new URL('../src/city-boards.js', import.meta.url), 'utf8');
  const createBoards = runInNewContext(boardSource.replace(/^import .*$/gm, '').replace('export ', '') + '\ncreateBoards;', { THREE, CONFIG });
  const pools = Object.fromEntries(Object.entries(CONFIG.city.boards).map(([kind, n]) => [kind, createBoards({}, n)]));
  const anchor = { x: 3, y: 7, z: -2, w: 8, h: 2, ry: Math.PI / 2, rect: [512, 128, 512, 128], W: 1024, H: 1024 };
  const segA = { group: { position: { z: -100 } } }, segB = { group: { position: { z: -80 } } };
  const p = pools.tabela;
  p.take(segA, anchor); p.take(segB, { ...anchor, x: -6, rect: [0, 384, 512, 64] }); p.release(segA); p.update();
  eq(p.mesh.count, 1, 'swap-remove keeps the other owner');
  eq(p.mesh.instanceMatrix.array[12], -6, 'swap-remove preserves the local matrix');
  eq(p.mesh.instanceMatrix.array[14], -82, 'board follows segment z');
  eq(json([...p.mesh.geometry.aUv.array.slice(0, 4)]), json([0, 0.5625, 0.5, 0.0625]), 'swap-remove preserves atlas rectangle');
  p.release(segB); p.take(segA, anchor); p.update();
  ok(Math.abs(p.mesh.instanceMatrix.array[2] + 8) < 1e-6, 'board width follows its Y rotation');
  eq(json([...p.mesh.geometry.aUv.array.slice(0, 4)]), json([0.5, 0.75, 0.5, 0.125]), 'pixel rectangle uses bottom-left UVs');
  const beforeUnknown = json([...p.mesh.geometry.aUv.array]); p.release({}); p.update();
  eq(p.mesh.count, 1, 'unknown segment release is a no-op');
  eq(json([...p.mesh.geometry.aUv.array]), beforeUnknown, 'unknown release keeps UVs');
  p.release(segA);
  const paintCalls = [], recordEvents = [], newsStore = new Map();
  const newsGame = { state: { mode: 'menu', score: 0, multiplier: 3 }, mult: { base: 3 }, addSystem: (s) => s };
  const newsWorld = { distance: 0 }, newsAtlas = { image: { getContext: () => ({}) } };
  let decksBuilt = 0;
  const news = runInNewContext(
    citySource.slice(citySource.indexOf('  const bugleRects ='), citySource.indexOf('  const portals =')) +
    citySource.slice(citySource.indexOf('  const system ='), citySource.indexOf("  events.addEventListener('gameover'")) +
    '\n({ ctx, currentDeck, updateNewsContext, takeBugle, resetNews, onStumble, updateIdle, refreshBugle, system });', {
      CONFIG, SLOT, buildSlots, bugleDeck: (c) => { decksBuilt++; return bugleDeck(c); }, heroSlot, recordPassed,
      boards: { bugle: pools.bugle }, game: newsGame, world: newsWorld, cityShift: 3640, atlases: { bugle: newsAtlas },
      localStorage: { getItem: (key) => newsStore.get(key) || null }, paintBugle: (...args) => paintCalls.push(args),
      dayPhaseAt, loopOf, districtAt, updateScenery() {}, announcer: { update() {} }, reset() {},
      emit: (name, detail) => recordEvents.push({ name, detail }),
    });
  eq(decksBuilt, 80, 'all decks prebuilt at load');
  eq(paintCalls.length, 1, 'first Bugle paint at city init after main fonts await');
  for (const best of [0, 100, 1999, 2000, 9999, 10000, 20000]) for (const score of [0, best - 5001, best - 5000, best - 1001, best - 1000, best - 101, best - 100, best, best + 1]) {
    for (let flags = 0; flags < 16; flags++) {
      Object.assign(news.ctx, { best, score: Math.max(0, score), mult: flags & 2 ? 5 : 1, d: CONFIG.city.stumbleNews,
        stumbleD: flags & 1 ? 0 : -1, night: !!(flags & 4), loop: 1, dawn: !!(flags & 8) });
      eq(json(news.currentDeck()), json(bugleDeck(news.ctx)), 'cached deck agrees with unchanged chooser at every threshold/flag');
    }
  }
  news.updateNewsContext();
  news.takeBugle(segA, anchor); pools.bugle.update();
  const fixedUv = json([...pools.bugle.mesh.geometry.aUv.array.slice(0, 4)]);
  newsGame.state.mode = 'running'; newsGame.state.score = 999999; newsWorld.distance = 900;
  news.onStumble(); news.updateNewsContext();
  for (let frame = 0; frame < 120; frame++) { pools.bugle.update(); news.system.update(); news.updateIdle(1); }
  eq(json([...pools.bugle.mesh.geometry.aUv.array.slice(0, 4)]), fixedUv, '164m-ahead recycle choice stays fixed until release despite score/stumble/day changes');
  eq(paintCalls.length, 1, 'run never repaints atlas');
  eq(decksBuilt, 80, 'run and recycle never allocate a catalogue deck');
  news.takeBugle(segB, { ...anchor, hero: true }); pools.bugle.update();
  eq(json([...pools.bugle.mesh.geometry.aUv.array.slice(4, 8)]), json([0, 0, 0.25, 0.25]), 'gantry takes NIGHT from real 16-slot atlas');
  pools.bugle.release(segA); pools.bugle.release(segB);
  newsStore.set('spidey.name', '  ipek  '); newsStore.set('spidey.scores', json([{ n: 'ipek', s: 100 }, null, { n: 'bad', s: '999' }]));
  newsGame.state.mode = 'paused'; newsAtlas.needsUpdate = false;
  news.updateIdle(CONFIG.city.repaintEvery / 2); eq(paintCalls.length, 1, 'paused repaint respects configured interval');
  news.updateIdle(CONFIG.city.repaintEvery / 2); eq(paintCalls.length, 2, 'changed paused signature repaints once');
  eq(newsAtlas.needsUpdate, true, 'paused repaint uploads the changed atlas');
  eq(paintCalls.at(-1)[2], 'İPEK', 'name uses Turkish upper case and UI length/whitespace rules');
  eq(paintCalls.at(-1)[3], 100, 'malformed score entries never change best');
  news.updateIdle(2); eq(paintCalls.length, 2, 'unchanged signature does no canvas work');
  newsGame.state.mode = 'menu'; newsStore.set('spidey.skin', 'black');
  news.updateIdle(CONFIG.city.repaintEvery / 2); eq(paintCalls.length, 2, 'menu repaint respects configured interval');
  news.updateIdle(CONFIG.city.repaintEvery / 2); eq(paintCalls.length, 3, 'changed menu signature repaints once');
  newsGame.state.mode = 'running'; news.resetNews(); recordEvents.length = 0;
  for (const score of [0, 100, 101, 110, 50, 120]) { newsGame.state.score = score; news.system.update(); }
  eq(json(recordEvents), json([{ name: 'recordPass', detail: { score: 101 } }]), 'real city emits one recordPass per run, even if score later falls');
  news.resetNews(); newsGame.state.score = 0; news.updateNewsContext();
  eq(news.ctx.stumbleD, -1, 'restart clears stumble news');
  newsStore.set('spidey.name', 'ECE');
  const onStart = runInNewContext(citySource.slice(citySource.indexOf('  const onStart ='), citySource.indexOf('  const onGameOver =')) + '\nonStart;', {
    refreshBugle: news.refreshBugle, reset: () => news.resetNews(), cityShift: 3640,
  });
  onStart(); eq(paintCalls.at(-1)[2], 'ECE', 'start catches a name changed inside the polling interval');
  newsGame.state.mode = 'menu'; newsStore.set('spidey.scores', '{broken'); news.refreshBugle();
  eq(paintCalls.at(-1)[3], 0, 'broken score JSON falls back without rewriting old saves');
  const shader = { vertexShader: '#include <common>\n#include <uv_vertex>' };
  p.mesh.material.onBeforeCompile(shader);
  ok(shader.vertexShader.includes('attribute vec4 aUv;') && shader.vertexShader.includes('vMapUv = aUv.xy + uv * aUv.zw;'), 'board hook overrides repeated facade map UVs');
  const window = Array.from({ length: 13 }, () => ({ group: { position: { z: 0 } } }));
  const peaks = { tabela: 0, ads: 0, bugle: 0 }, firstLoop = new Map();
  for (let serial = 0; serial < 613; serial++) {
    const seg = window[serial % 13];
    for (const pool of Object.values(pools)) pool.release(seg);
    const d = segCentre(serial), [id, k] = districtInfo(d), recipe = dressFor(id, k, loopOf(d));
    for (const name of [recipe.dress, recipe.portal?.[0]]) {
      const counts = ANCHOR_COUNTS[name];
      for (const kind in pools) {
        const n = typeof counts === 'number' ? (kind === 'tabela' ? counts : 0) : (counts?.[kind] || 0);
        for (let i = 0; i < n; i++) pools[kind].take(seg, anchor);
      }
    }
    for (const kind in pools) {
      const pool = pools[kind]; pool.update(); peaks[kind] = Math.max(peaks[kind], pool.mesh.count);
      ok(pool.mesh.count <= CONFIG.city.boards[kind], `board capacity ${kind} at ${serial}`);
    }
    const counts = json(Object.values(pools).map((pool) => pool.mesh.count));
    if (serial >= 17 && serial < 300) firstLoop.set(serial, counts);
    if (serial >= 317 && serial < 600) eq(counts, firstLoop.get(serial - 300), 'same loop position has the same live count');
  }
  eq(json(peaks), json({ tabela: 27, ads: 35, bugle: 18 }), 'full-stage board capacity peaks');
  for (const seg of window) for (const pool of Object.values(pools)) pool.release(seg);
  for (const pool of Object.values(pools)) { pool.update(); eq(pool.mesh.count, 0, 'reset releases every board'); }

  class PieceAttribute {
    constructor(array, itemSize) { this.array = new Float32Array(array); this.itemSize = itemSize; this.count = this.array.length / itemSize; }
    getX(i) { return this.array[i * this.itemSize]; } getY(i) { return this.array[i * this.itemSize + 1]; }
    setXY(i, x, y) { this.array[i * this.itemSize] = x; this.array[i * this.itemSize + 1] = y; }
  }
  class PieceGeometry {
    constructor(triangles = 0) {
      this.triangles = triangles;
      this.attributes = { position: new PieceAttribute([], 3), normal: new PieceAttribute([], 3), uv: new PieceAttribute([], 2) };
    }
    rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; }
    translate() { return this; } scale() { return this; }
    dispose() {}
    computeBoundingSphere() { this.boundsReady = true; }
    deleteAttribute(k) { delete this.attributes[k]; } setAttribute(k, a) { this.attributes[k] = a; }
    getAttribute(k) { return this.attributes[k]; }
    setIndex(idx) { this.index = idx; this.triangles = idx.length / 3; }
    toNonIndexed() {
      if (!this.index) return this;
      const g = new PieceGeometry(this.triangles); g.attributes = {};
      for (const [k, a] of Object.entries(this.attributes)) {
        const values = this.index.flatMap((i) => [...a.array.slice(i * a.itemSize, (i + 1) * a.itemSize)]);
        g.setAttribute(k, new PieceAttribute(values, a.itemSize));
      }
      return g;
    }
  }
  class PiecePlane extends PieceGeometry {
    constructor() {
      super(2);
      this.setAttribute('position', new PieceAttribute(new Float32Array(12), 3));
      this.setAttribute('normal', new PieceAttribute(new Float32Array(12), 3));
      this.setAttribute('uv', new PieceAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      this.setIndex([0, 2, 1, 2, 3, 1]);
    }
  }
  class PiecePath {
    constructor() { this.holes = []; this.points = 0; this.curves = 0; }
    moveTo() { this.points++; } lineTo() { this.points++; }
    quadraticCurveTo() { this.curves++; } closePath() {}
  }
  const pieceSource = await readFile(new URL('../src/city-pieces.js', import.meta.url), 'utf8');
  const pieceContext = { CONFIG, ANCHOR_COUNTS, lanternLift, TRACK: { halfWidth: 3.7 }, rng: cityTex.rng, mergeGeometries: (list) => {
    const g = new PieceGeometry(list.reduce((sum, p) => sum + p.triangles, 0)); g.attributes = {};
    const keys = Object.keys(list[0].attributes).sort();
    for (const p of list) eq(json(Object.keys(p.attributes).sort()), json(keys), 'merged piece attributes match');
    for (const k of keys) g.setAttribute(k, new PieceAttribute(list.flatMap((p) => [...p.attributes[k].array]), list[0].attributes[k].itemSize));
    return g;
  }, THREE: {
    Color: class { constructor() { this.r = this.g = this.b = 0; } setHex() {} copy() { return this; } lerp() { return this; } },
    MathUtils: { clamp: (n, a, b) => Math.max(a, Math.min(b, n)) },
    BufferGeometry: class extends PieceGeometry { constructor() { super(); this.attributes = {}; } },
    BoxGeometry: class extends PieceGeometry { constructor(x, y, z, a = 1, b = 1, c = 1) { super(4 * (a * b + a * c + b * c)); } },
    CylinderGeometry: class extends PieceGeometry { constructor(rt, rb, h, n, rows=1, open=false) { super(n * (2*rows + (open ? 0 : (rt > 0 ? 1 : 0) + (rb > 0 ? 1 : 0)))); } },
    SphereGeometry: class extends PieceGeometry { constructor(r, w, h, phi = 0, phiLength = Math.PI * 2, theta = 0, thetaLength = Math.PI) { super(2*w*h - (theta === 0 ? w : 0) - (theta + thetaLength >= Math.PI ? w : 0)); } }, PlaneGeometry: PiecePlane,
    ExtrudeGeometry: class extends PieceGeometry {
      constructor(shape, { curveSegments = 12 }) {
        const points = [shape, ...shape.holes].reduce((n, p) => n + p.points + p.curves * curveSegments, 0);
        super(4 * points + 4 * shape.holes.length - 4);
      }
    }, Shape: PiecePath, Path: PiecePath, BufferAttribute: PieceAttribute, Float32BufferAttribute: PieceAttribute,
  } };
  const recipe = runInNewContext(pieceSource.replace(/^import .*$/gm, '').replaceAll('export ', '') + '\n({ createCityPieces, SEC, shellGeo, fin, pBox, pCyl, merge });', pieceContext);
  const buildPieces = recipe.createCityPieces;
  const pieces = buildPieces();
  const chunkContext = { CONFIG, TRACK: { deckBottom: -0.98 }, mergeGeometries: pieceContext.mergeGeometries,
    THREE: { ...pieceContext.THREE, MathUtils: { ...pieceContext.THREE.MathUtils, lerp: (a, b, t) => a + (b - a) * t },
      Color: class {
        constructor() { this.r = this.g = this.b = 0; }
        setHex() { return this; } multiplyScalar() { return this; } getHex() { return 0; }
      } },
  };
  const chunkRecipe = runInNewContext(citySource.slice(citySource.indexOf('const CITY ='), citySource.indexOf('// ---------- public API')) +
    '\n({ buildVariant, mulberry32 });', chunkContext);
  const chunks = Array.from({ length: 12 }, (_, i) => chunkRecipe.buildVariant(i));
  const chunkSpecs = runInNewContext(citySource.slice(citySource.indexOf('  const seqRng ='), citySource.indexOf('  const assign =')) + '\nseq;', {
    variants: chunks, CONFIG, SEG_L: 20, mulberry32: chunkRecipe.mulberry32,
  });
  let actualBuglePeak = 0;
  let cityCallBound = 0;
  const actualCounts = new Map();
  for (let serial = 0; serial < 913; serial++) {
    const seg = window[serial % 13];
    for (const pool of Object.values(pools)) pool.release(seg);
    const d = segCentre(serial), [id, k] = districtInfo(d), plan = dressFor(id, k, loopOf(d));
    for (const name of [plan.dress, plan.portal?.[0]]) {
      for (const kind in pools) for (const a of pieces[name]?.anchors?.[kind] || []) pools[kind].take(seg, a);
    }
    if (plan.chunk && plan.facade === 'midtown') {
      for (const a of chunks[chunkSpecs[serial % 300].v].anchors) pools.bugle.take(seg, a, [0, 0, 512, 256], 2048, 1024);
    }
    actualBuglePeak = Math.max(actualBuglePeak, pools.bugle.mesh.count);
    for (const kind in pools) ok(pools[kind].mesh.count <= CONFIG.city.boards[kind], `actual dress/chunk pool capacity ${kind}`);
    if (serial >= 12) for (const scroll of [0, 13.99, 14, 19.99]) {
      let calls = 76;
      for (let i = 0; i < 13; i++) {
        const metre = segCentre(serial - 12 + i), [district, index] = districtInfo(metre), recipe = dressFor(district, index, loopOf(metre));
        const dress = pieces[recipe.dress], portal = pieces[recipe.portal?.[0]], z = 86 + scroll - 20 * i;
        if (!recipe.chunk) calls -= 2;
        calls += (dress?.plain ? 1 : 0) + (dress?.glow ? 1 : 0);
        if (dress?.tunnel) calls++;
        if (portal) calls += (portal.plain ? 1 : 0) + (portal.glow ? 1 : 0) + (portal.tunnel ? 1 : 0);
      }
      calls += Object.values(pools).filter((pool) => pool.mesh.count > 0).length;
      if (Array.from({ length: 13 }, (_, i) => districtAt(segCentre(serial - 12 + i))).includes('bridge')) calls++;
      cityCallBound = Math.max(cityCallBound, calls);
      ok(calls <= CONFIG.city.budget.calls, 'baseline-relative draw bound includes overlapping portals and district boundaries');
    }
    const counts = json(Object.values(pools).map((p) => p.mesh.count));
    if (serial >= 17 && serial < 300) actualCounts.set(serial, counts);
    if (serial >= 317 && serial < 600) eq(counts, actualCounts.get(serial - 300), 'actual roof/dress pool count repeats without leaks');
  }
  for (const seg of window) for (const pool of Object.values(pools)) pool.release(seg);
  for (const pool of Object.values(pools)) { pool.update(); eq(pool.mesh.count, 0, 'all actual board pools empty after release'); }
  console.log('Actual Bugle pool peak including roofs:', actualBuglePeak, '/ 24; chunk roof anchors:', chunks.map((c) => c.anchors.length).join(','));
  console.log('City baseline-relative draw-call bound across district/portal overlaps:', cityCallBound, '/', CONFIG.city.budget.calls);
  const bridgeBoxes = [];
  const bridgeRecipe = runInNewContext(pieceSource.slice(pieceSource.indexOf('const STEEL ='), pieceSource.indexOf('// stone tower')).replaceAll('export ', '') + '\n({ cableSeg, cableY });', {
    CONFIG, INK: 0x1c1016, glowList: () => [], kit: (o) => o,
    pBox: (list, ...box) => bridgeBoxes.push(box), pCyl() {},
  });
  for (let k = 0; k < 40; k++) {
    bridgeBoxes.length = 0; const span = bridgeRecipe.cableSeg(k);
    const hangers = bridgeBoxes.filter((b) => b[3] === 0.07 && b[5] === 0.07);
    eq(hangers.length, 16, 'every bridge segment has sixteen attached hangers');
    for (const [x, y, z, , h] of hangers) {
      ok(Math.abs(y - h / 2 - CONFIG.city.bridge.railTop) <= 0.02, 'B2: hanger bottom meets railing top within 0.02 m');
      const cable = bridgeRecipe.cableY(20 * k) + (bridgeRecipe.cableY(20 * k + 20) - bridgeRecipe.cableY(20 * k)) * (10 - z) / 20;
      ok(Math.abs(y + h / 2 - cable) < 1e-9, 'hanger top meets straight main cable');
      eq(span.clamps.filter((a) => a.x === x && a.y === CONFIG.city.bridge.railTop && a.z === z).length, 1, 'B2: exactly one clamp at each hanger along-track position');
      ok(bridgeBoxes.some((b) => b[0] === x && b[3] === 0.12 && b[1] + b[4] / 2 === CONFIG.city.bridge.railTop && Math.abs(z) <= b[5] / 2), 'B2: railing exists beneath the hanger');
    }
    for (const b of bridgeBoxes.filter((b) => b[3] === 0.45)) {
      const dz = Math.cos(b[7]) * b[5] / 2, dy = Math.sin(b[7]) * b[5] / 2;
      ok(Math.abs(dz - 10) < 1e-9 && Math.abs(b[1] - dy - bridgeRecipe.cableY(20 * k)) < 1e-9 && Math.abs(b[1] + dy - bridgeRecipe.cableY(20 * k + 20)) < 1e-9, 'main cable endpoints join adjacent spans');
    }
  }
  for (const metre of [200, 600]) ok(Math.abs(bridgeRecipe.cableY(metre) - (32.5 + 0.6 / 2)) <= 0.05, 'B2: main cable endpoint within 0.05 m of actual tower top');
  eq(CONFIG.city.bridge.clamp, 0.08, 'B2: clamp box is 0.08 m on all axes');
  ok(citySource.includes('new THREE.BoxGeometry(clampSize, clampSize, clampSize), new THREE.MeshBasicMaterial({ color: 0x222222 })'), 'B2: clamps use one exact box geometry and dark material');
  eq((citySource.match(/const bridgeClamps = createBoards/g) || []).length, 1, 'B2: all clamps share one InstancedMesh pool');
  for (const piece of Object.values(pieces)) for (const kind of ['plain', 'glow', 'tunnel']) {
    if (piece[kind]) ok(piece[kind].boundsReady, 'district geometry bounds exist before the run');
  }
  eq(Object.keys(pieces).filter((name) => name.startsWith('cable')).length, 40, 'all bridge cable geometries built at load');
  eq(pieces.midtownSign.anchors.tabela.length, ANCHOR_COUNTS.midtownSign, 'dawn builder yields the prescribed anchors');
  for (const name of ['gantry', 'neon0', 'neon1', 'neon2']) {
    for (const kind of ['ads', 'bugle', 'tabela']) eq(pieces[name].anchors[kind]?.length || 0, ANCHOR_COUNTS[name][kind] || 0, `Neon builder anchor contract ${name}.${kind}`);
    for (const a of pieces[name].anchors.bugle) {
      eq(json(a.rect), json([0, 768, 512, 256]), 'Neon placeholder uses NIGHT slot 12');
      eq(a.W, 2048, 'Bugle anchors use the sixteen-slot atlas width');
    }
  }
  const nearDress = CONFIG.world.segmentCount;
  ok(76 + nearDress * 2 + 3 + 2 <= CONFIG.city.budget.calls, 'conservative Neon baseline + dress + three board pools + portal fits call ceiling');
  for (const name of ['ct0', 'ct1', 'ctFest', 'gate']) {
    eq(pieces[name].anchors.tabela.length, ANCHOR_COUNTS[name], `Chinatown builder anchor contract ${name}`);
  }
  const prototype = await readFile(new URL('../tasarim/proto/11-3-kit.js', import.meta.url), 'utf8');
  const ctRecipe = prototype.slice(prototype.indexOf('const RED ='), prototype.indexOf('// ------------------------------------------------------------------ BRIDGE'));
  for (const part of ['function lantern(', 'function gate()']) {
    const a = ctRecipe.indexOf(part), b = ctRecipe.indexOf('\n}', a) + 2;
    ok(pieceSource.includes(ctRecipe.slice(a, b)), 'existing lanterns and gate retain approved recipes');
  }
  const chinaSource = await readFile(new URL('../src/city-chinatown.js', import.meta.url), 'utf8');
  const sceneAdded = [];
  const chinaGame = { state: { mode: 'running' }, obstacles: { seed: 12 }, scene: { add(...meshes) { sceneAdded.push(...meshes); }, remove() {} }, world: {
    segments: Array.from({ length: 13 }, (_, i) => ({ serial: i, group: { position: { z: -20 * i } }, city: {
      plan: { dress: pieces.ct0 }, buildings: [{ side: 1, front: 7, base: -11, zA: -8, zB: 8 }, { side: -1, front: 6, base: -11, zA: -18, zB: -8 }],
    } })),
    onRecycle: (fn) => { chinaGame.recycle = fn; return () => {}; },
  } };
  const dragonSource = await readFile(new URL('../src/city-dragon.js', import.meta.url), 'utf8');
  const dragonTrack = { halfWidth: 3.7, fenceOuter: 4.05, fenceTop: 0.52 };
  const dragonModule = dragonSource.replace(/^import .*$/gm, '').replaceAll('export ', '');
  const dragonGlobals = {
    CONFIG, ...recipe, createBoards, TRACK: dragonTrack, districtAt, loopMetre,
    getToonGradient: () => ({}), drawDragonScales() {},
    addOutline: (mesh) => ({ parent: mesh, count: 0, visible: true }),
    document: { createElement: () => ({ getContext: () => ({}) }) },
    THREE: { ...pieceContext.THREE,
      Matrix4: BoardMatrix, Vector3: BoardVector, Quaternion: BoardRotation,
      MeshToonMaterial: class { constructor(o) { Object.assign(this, o); } },
      CanvasTexture: class { constructor(image) { this.image = image; } },
      InstancedMesh: BoardMesh,
      SphereGeometry: class extends PieceGeometry { constructor(r,w,h) { super(2*w*(h-1)); Object.assign(this, { kind: 'sphere', r, w, h }); } },
      ConeGeometry: class extends PieceGeometry { constructor(r,h,n) { super(n*2); Object.assign(this, { kind: 'cone', r, h, n }); } },
      CircleGeometry: class extends PieceGeometry { constructor(r,n) { super(n); Object.assign(this, { kind: 'circle', r, n }); } },
      TorusGeometry: class extends PieceGeometry { constructor(r,t,a,b) { super(2*a*b); Object.assign(this, { kind: 'torus', r, t, a, b }); } },
    },
  };
  const dragonApi = runInNewContext(dragonModule + '\n({ dragonGeometry, dragonPose, createDragon });', dragonGlobals);
  const dragonGeometry = dragonApi.dragonGeometry();
  ok(dragonGeometry.head.triangles + dragonGeometry.jaw.triangles <= 3000, 'full dancing head including jaw stays within 3000 triangles');
  eq(dragonGeometry.fan.triangles, 40, 'tail has five flattened four-sided cones');
  eq(dragonGeometry.ring.triangles, 24, 'rings are the specified twelve-sided open cylinders');
  const dance = dragonApi.createDragon({ scene: { add() {} }, state: { mode: 'running' } }, []);
  eq(dance.meshes.length, 5, 'the dance dragon draws as head, jaw, ring, fan and pole');
  eq(dance.outlines.length, 4, 'kesme sırası 4 uygulanmadı: head, jaw, ring and fan keep their ink hull');
  const chinaEvents = new EventTarget();
  const china = runInNewContext(chinaSource.replace(/^import .*$/gm, '').replaceAll('export ', '') + '\n({ createChinatown, signCharacter, chinatownHash });', {
    createBoards, CONFIG, districtAt, segCentre, lanternLift, THREE: { ConeGeometry: BoardPlane, Matrix4: BoardMatrix, Vector3: BoardVector, Quaternion: BoardRotation }, TRACK: { halfWidth: 3.7 }, events: chinaEvents,
    createDragon: () => dance,
  });
  for (let serial = 0; serial < 600; serial++) for (let sign = 0; sign < 4; sign++) for (const count of [1, 2, 3, 8]) {
    let previous = -1;
    for (let cell = 0; cell < count; cell++) {
      const next = china.signCharacter(serial, sign, cell, count);
      ok(next >= 0 && next < 8 && next !== previous, 'seeded adjacent sign characters differ'); previous = next;
      eq(next, china.signCharacter(serial, sign, cell, count), 'sign character deterministic');
    }
  }
  const decoration = china.createChinatown(chinaGame, { image: { height: 896 } }, pieces, 1600, [{ buildings: [1, 1] }]);
  const perFacade = (divisor, limit) => chinaGame.world.segments.reduce(
    (n, s) => n + s.city.buildings.filter((_, j) => china.chinatownHash(s.serial, j + 4) % divisor < limit).length, 0);
  const verticalCount = perFacade(10, 4);
  eq(decoration.pool.mesh.count, 13 * 25 + verticalCount, 'every sign, horizontal banner and seeded vertical banner is pooled');
  eq(decoration.tassels.mesh.count, verticalCount, 'each vertical banner has one tassel');
  eq(decoration.tassels.mesh.material, decoration.glyphMat, 'tassels share the glyph material');
  ok(!Object.keys(decoration).some((k) => /wall/i.test(k)) && !Object.keys(decoration.dragon).some((k) => /wall/i.test(k)), 'ruling A: no wall dragon object or pool exists');
  ok(!/wallGeometry|wallRings|wallFans|wallCapacity|wallAnchor|wallOffsets|appendWalls/.test(dragonSource + chinaSource), 'ruling A: no wall dragon builder, placement or warm-up entry remains');
  ok(!Object.keys(CONFIG.city.dragon).some((k) => /wall/i.test(k)), 'ruling A: no wall dragon CONFIG entries');
  eq(cityTex.VERTICAL_CHARACTERS.length, 4, 'four fixed vertical patterns');
  for (let i = 0; i < 4; i++) {
    const glyphCopies = [];
    cityTex.drawVerticalBanner({ fillRect() {}, drawImage: (...a) => glyphCopies.push(a) }, {}, i);
    eq(glyphCopies.length, 3, 'vertical banner copies three brush characters');
  }
  ok(11 + lanternLift() - CONFIG.city.chinatown.bannerHeight >= CONFIG.swing.height + CONFIG.swing.arcRise + CONFIG.playerHeight + 1, 'banner lowest edge clears maximum player top by one metre');
  decoration.update(1800, 0.13);
  const firstSway = [...decoration.pool.mesh.instanceMatrix.array.slice(24*16,25*16)];
  decoration.update(1800, 0.4);
  ok(json(firstSway) !== json([...decoration.pool.mesh.instanceMatrix.array.slice(24*16,25*16)]), 'banner sway changes only its instance matrix');
  const swayElements = decoration.pool.mesh.instanceMatrix.array, phase = china.chinatownHash(0)/4294967296*Math.PI*2;
  ok(Math.abs(Math.atan2(swayElements[24*16+6],swayElements[24*16+5])-3*Math.PI/180*Math.sin(2*Math.PI*0.7*0.4+phase))<1e-7, 'physical banner angle is exact despite nonuniform scale');
  for (const d of [0, 2540, 3500, 4300, 5500]) { decoration.update(d); ok(!decoration.pool.mesh.visible, 'glyph signs hidden outside Chinatown'); }
  decoration.update(1800); ok(decoration.pool.mesh.visible, 'glyph signs visible in Chinatown');
  const pooled = () => decoration.pool.mesh.count + decoration.tassels.mesh.count;
  for (const name of ['gameover', 'menu']) {
    chinaEvents.dispatchEvent(new Event(name));
    eq(pooled(), 0, `${name} leaves no Chinatown instance`);
    ok(!decoration.pool.mesh.visible && !decoration.tassels.mesh.visible, `${name} hides every Chinatown mesh`);
  }
  chinaEvents.dispatchEvent(new Event('start'));
  eq(pooled(), 13 * 25 + 2 * verticalCount, 'restart re-seeds signs and tassels from nothing');
  const leave = chinaGame.world.segments[0];
  // A Chinatown segment owns its sign cells and horizontal banner plus, per facade, a possible vertical banner
  // with its tassel on the qualifying facade.
  const facadeCells = chinaGame.world.segments[0].city.buildings.map((_, j) => j + 4);
  const seed = (serial) => pieces.ct0.anchors.glyph.length + 1 + facadeCells.reduce(
    (n, cell) => n + (china.chinatownHash(serial, cell) % 10 < 4 ? 2 : 0), 0);
  leave.serial = 200; chinaGame.recycle(leave); // 200 · 20 m lands in the neon loop, outside every Chinatown window
  eq(pooled(), 13 * 25 + 2 * verticalCount - seed(0), 'a segment recycled out of Chinatown drops exactly its own signs, banners and tassel');
  leave.serial = 3; chinaGame.recycle(leave);
  eq(pooled(), 13 * 25 + 2 * verticalCount - seed(0) + seed(3), 'recycling within Chinatown replaces the segment instances instead of stacking them');
  leave.serial = 0; chinaGame.recycle(leave);
  eq(pooled(), 13 * 25 + 2 * verticalCount, 'the same segment recycled back re-seeds its own instances');
  decoration.dispose(); eq(decoration.pool.mesh.count, 0, 'scenery disposal empties glyph pool');
  for(const seg of chinaGame.world.segments) {
    const [,k]=districtInfo(segCentre(seg.serial)+7600);
    seg.city.plan.dress=k%2?pieces.ctFestOdd:pieces.ctFest;
  }
  const festivalDecoration=china.createChinatown(chinaGame,{image:{height:896}},pieces,7600,[{buildings:[1,1]}]);
  const festivalBanners=chinaGame.world.segments.reduce((n,s)=>n+s.city.plan.dress.anchors.banner.length,0);
  eq(festivalDecoration.pool.mesh.count,13*24+festivalBanners+verticalCount,'festival extends the original shared glyph and banner pool');
  for(const name of ['gameover','menu']) { chinaEvents.dispatchEvent(new Event(name)); eq(festivalDecoration.pool.mesh.count,0,'festival ownership clears on '+name); }
  chinaEvents.dispatchEvent(new Event('start')); festivalDecoration.update(7700,0.4);
  eq(festivalDecoration.pool.mesh.count,13*24+festivalBanners+verticalCount,'festival restart restores exact ownership without duplicates');
  const festivalAngles=[], festivalUv=festivalDecoration.pool.mesh.geometry.aUv.array, festivalMatrices=festivalDecoration.pool.mesh.instanceMatrix.array;
  for(let i=0;i<festivalDecoration.pool.mesh.count;i++) if(festivalUv[i*4+2]===1) festivalAngles.push(Math.atan2(festivalMatrices[i*16+6],festivalMatrices[i*16+5]));
  eq(new Set(festivalAngles).size,festivalBanners,'every festival banner has its own deterministic sway phase, including two in one segment');
  festivalDecoration.dispose();
  const patternSource = await readFile(new URL('../src/patterns.js', import.meta.url), 'utf8');
  ok(!/obstacles\s*\.\s*(add|spawn)|_addObstacle|new THREE\.Box3\(/.test(chinaSource + dragonSource + boardSource), 'K10: no dragon, banner or sign ever registers a collider');
  ok(!/dragon|chinatown|tassel|banner/i.test(patternSource), 'K10: the collider pattern table was not touched for Chinatown scenery');
  ok([decoration.pool.mesh, decoration.tassels.mesh].every((mesh) => sceneAdded.includes(mesh)), 'K10: Chinatown scenery hangs on the scene root, outside every segment group');
  ok(!/\bnew\b/.test(chinaSource.slice(chinaSource.indexOf('    update(d, time'))), 'K10: the Chinatown frame updates matrices only, no allocation');
  ok(!/\bnew\b/.test(boardSource.slice(boardSource.indexOf('    update(time'))), 'K10: the shared board pool frame update allocates nothing');
  const point = {};
  for (const side of [-1,1]) for (let t=0;t<32;t+=0.1) for (let i=0;i<12;i++) {
    dragonApi.dragonPose(i,t,side,point);
    ok(Math.abs(point.x)-Math.hypot(0.42,0.7/2) >= CONFIG.laneCount*CONFIG.laneWidth/2, 'oriented dragon ring stays outside every lane at wave extremes');
    ok(Math.abs(point.x)-Math.hypot(0.42,0.7/2) > dragonTrack.fenceOuter, 'entire oriented ring stays behind outer fence');
  }
  const textureList = [], dancer = dragonApi.createDragon(chinaGame, textureList);
  eq(textureList.length, 1, 'scale texture is built once at load');
  for (const seed of [12,13]) {
    const at = 1700 + seed%100;
    for (const [d,visible] of [[at-60.01,false],[at-60,true],[at,true],[at+15,true],[at+15.01,false],[4300,false]]) {
      dancer.update(d, 0.3, seed);
      eq(dancer.head.visible, visible, 'exact dance window and Chinatown mask');
      eq(dancer.ring.count, visible ? 12 : 0, 'twelve rings only in dance window');
      if (visible) {
        eq(dancer.pole.count, 6, 'one pole every two rings');
        ok(Math.abs(dancer.jawAngle-(25+10*Math.sin(2*Math.PI*0.6*0.3))*Math.PI/180)<1e-12, 'exact jaw motion');
      }
    }
  }
  dancer.clear(); ok(dancer.meshes.every((m)=>!m.visible && m.count===0), 'dragon clear hides every pool');
  ok(!/\bnew\b/.test(dragonSource.slice(dragonSource.indexOf('    update(d,'), dragonSource.indexOf('    clear()'))), 'dance update allocates no objects');
  console.log('Dragon head/jaw/fan/pole triangles:', dragonGeometry.head.triangles, dragonGeometry.jaw.triangles, dragonGeometry.fan.triangles, dragonGeometry.pole.triangles);
  // Task 9: run the actual life updater against fixed meshes and the real chunk sequence.
  const lifeSource = await readFile(new URL('../src/city-life.js', import.meta.url), 'utf8');
  class LifeColor {
    constructor(hex = 0xffffff) { this.setHex(hex); }
    setHex(hex) { this.hex = hex; this.r = (hex >> 16) / 255; this.g = ((hex >> 8) & 255) / 255; this.b = (hex & 255) / 255; return this; }
    lerp(c, k) { for (const key of ['r','g','b']) this[key] += (c[key] - this[key]) * k; return this; }
  }
  class LifeMesh extends BoardMesh {
    constructor(geometry, material, n = 1) { super(geometry, material, n); this.capacity = n; this.position = new BoardVector(); this.rotation = {}; this.children = []; this.count = 0; this.visible = false; }
    add(mesh) { this.children.push(mesh); }
    setColorAt(i, c) { if (!this.instanceColor) this.instanceColor = new BoardAttribute(new Float32Array(this.capacity * 3), 3); this.instanceColor.array.set([c.r,c.g,c.b], i*3); }
  }
  const birdParts = runInNewContext(pieceSource.replace(/^import .*$/gm, '').replaceAll('export ', '') + '\n({ birdGeometry, blimp, blimpBanner, puffGeometry });', {
    ...pieceContext, THREE: { ...pieceContext.THREE, IcosahedronGeometry: class extends PieceGeometry { constructor(r, detail) { super(20); eq(r, 1, 'puff unit radius'); eq(detail, 0, 'puff detail zero'); } } },
  });
  eq(birdParts.birdGeometry(true).triangles, 60, 'wings-up bird is exactly five boxes');
  eq(birdParts.birdGeometry(false).triangles, 60, 'wings-down bird is exactly five boxes');
  eq(birdParts.blimp().plain.triangles, 520, 'approved blimp geometry, including partial sphere band');
  eq(birdParts.blimpBanner().getAttribute('uv').count, 16, 'blimp has four indexed quads, sixteen vertices');
  const lifeEvents = [], lifeGame = { halted: false, state: { mode: 'running', speed: 11, multiplier: 1 }, scene: { add() {}, remove() {} }, obstacles: { active: [] }, world: { distance: 0, segments: Array.from({ length: 13 }, (_, i) => ({ serial: i, group: { position: { z: 86 - 20*i } }, city: { group: { scale: { x: 1 } }, plan: { chunk: true }, variant: 0 } })) } };
  const lifeEventsBus = new EventTarget();
  const lifeGlobals = { CONFIG, cityHash, flockAt, loopMetre, loopOf, districtAt, dayPhaseAt, phaseAt, tunnelAt, weatherAt, celebrationKind, laneX, ...birdParts, events: lifeEventsBus,
    toonMaterial: () => ({ color: new LifeColor() }), emit: (name, detail) => lifeEvents.push({ name, position: { ...detail.position }, d: lifeGame.world.distance }),
    THREE: { ...THREE, BoxGeometry: pieceContext.THREE.BoxGeometry, Color: LifeColor, Mesh: LifeMesh, InstancedMesh: LifeMesh,
      MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); this.color = new LifeColor(); } } } };
  const createLife = runInNewContext(lifeSource.replace(/^import .*$/gm, '').replaceAll('export ', '') + '\ncreateCityLife;', lifeGlobals);
  const life = createLife(lifeGame, {}, 0);
  const birdShader = { vertexShader: '#include <color_vertex>' }; life.up.material.onBeforeCompile(birdShader);
  ok(birdShader.vertexShader.includes('if (all(greaterThan(color, vec3(0.999))))'), 'bird instance tint leaves the orange beak vertex colour intact');
  eq(CONFIG.city.life.steam, 39, 'manager: 39 puffs without changing cadence or life');
  eq(CONFIG.city.life.puff.interval, 0.28, 'steam cadence'); eq(CONFIG.city.life.puff.life, 3.4, 'steam lifetime');
  ok(life.meshes.every((m) => !m.visible), 'all life meshes hidden at load');
  for (let d = 0; d < 30000;) {
    const f = flockAt(d), id = districtAt(f), s = loopMetre(f);
    ok(f >= Math.max(300,d) && ['midtown','chinatown','dawn'].includes(id), 'flocks only in their districts after 300 m');
    for (const [,border] of CONFIG.city.districts) ok(Math.abs(s-border) >= 100, 'flock away from district borders');
    ok(CONFIG.city.loop-s >= 100, 'flock away from loop border');
    eq(f, flockAt(d), 'flockAt is deterministic');
    const next = flockAt(f+1); ok(next-f >= 160, 'consecutive flocks at least 160 m apart'); d = f+1;
  }
  let birdPeak = 0, puffPeak = 0, weatherPeak = 0, sparkPeak = 0, gullFrames = 0, perchedFrames = 0;
  for (let frame = 0; frame < 20*60*60; frame++) {
    const speed = speedAt(lifeGame.world.distance); lifeGame.state.speed = speed; lifeGame.world.distance += speed/60;
    const d = lifeGame.world.distance;
    for (let i = 0; i < 13; i++) {
      const seg = lifeGame.world.segments[i];
      seg.group.position.z = 86 - 20*seg.serial + d;
      while (seg.group.position.z - 10 > 96) { seg.serial += 13; seg.group.position.z -= 260; }
      const spec = chunkSpecs[seg.serial % 300]; seg.city.variant = spec.v; seg.city.group.scale.x = spec.flip ? -1 : 1;
      seg.city.plan.chunk = !['bridge','tunnel'].includes(districtAt(segCentre(seg.serial)));
    }
    if (d >= 10250 && !life.celebration.seen) lifeEventsBus.dispatchEvent(new Event('recordPass'));
    life.update(1/60);
    birdPeak = Math.max(birdPeak, life.up.count); puffPeak = Math.max(puffPeak, life.steam.count);
    weatherPeak = Math.max(weatherPeak,life.weather.count); sparkPeak = Math.max(sparkPeak,life.sparks.count);
    ok(life.up.count <= 12 && life.down.count <= 12 && life.steam.count <= 39, '20-minute actual life updater stays within both capacities');
    ok(life.weather.count <= 160 && life.sparks.count <= 120, '20-minute weather and spark requests fit their fixed pools');
    for (let i = 0; i < life.steam.count; i++) {
      const a = life.steam.instanceMatrix.array, x = a[i*16+12], radius = Math.abs(a[i*16]);
      ok(Math.abs(x) - radius >= 4.8-1e-6, 'every live puff stays outside scenic clearance');
    }
    if (life.up.count === 5) { gullFrames++; for (const bird of life.birds.slice(0,5)) ok(Math.abs(bird.x) >= 6, 'gulls never enter track'); }
    if (life.up.count === 9 && life.birds[0].y === 0.06) perchedFrames++;
    const burst = lifeEvents.at(-1);
    if (life.up.count === 9 && life.birds[0].y > 0.06 && burst && d >= burst.d - burst.position.z) {
      ok(life.birds.slice(0, 9).every((bird) => bird.y > 7), 'all pigeons clear seven metres before the runner reaches the flock');
    }
  }
  ok(birdPeak === 9 && puffPeak >= 25 && gullFrames > 0 && perchedFrames > 0, 'soak exercises perched pigeons, gulls and the expanded puff pool');
  ok(lifeEvents.length > 0 && lifeEvents.every((e)=>e.name==='flock'), 'pigeons emit only the silent flock event');
  console.log('Task 9 twenty-minute peaks:', json({ birds: birdPeak, puffs: puffPeak, bursts: lifeEvents.length }));
  ok(weatherPeak === 160 && sparkPeak > 0,'twenty-minute run exercises full weather and simultaneous celebration');
  console.log('Task 10 twenty-minute peaks:',json({weather:weatherPeak,sparks:sparkPeak,rainShare:rainyLoops/400,snowShare:snowyLoops/400}));
  life.reset(); eq(life.up.count + life.down.count + life.steam.count, 0, 'reset empties every task9 pool');
  eq(life.weather.count+life.sparks.count,0,'reset empties weather and sparks'); ok(life.shells.every((s)=>s.age<0) && !life.celebration.kind,'reset drops pending and live celebrations');
  ok(life.meshes.every((m)=>!m.visible) && life.puffs.every((p)=>p.age<0), 'reset hides blimp and clears every puff lifetime');
  lifeGame.world.distance = flockAt(0)-100; life.reset(); lifeGame.obstacles.active.push({ z: -100, length: 1 }); life.update(1/60);
  eq(life.up.count, 0, 'an obstacle within 15 m rejects a flock for good');
  lifeGame.obstacles.active.length = 0; life.update(1/60); eq(life.up.count,0,'rejected flock is never retried');
  life.reset(); lifeGame.obstacles.active.push({ z: -70, length: 40 }); life.update(1/60);
  eq(life.up.count, 0, 'long obstacle span rejects a flock even when its front is more than fifteen metres away');
  lifeGame.obstacles.active.length = 0;
  lifeGame.world.distance = 0; life.reset();
  for (const [n,tens,ones] of [[1,1,11],[5,5,11],[12,1,2],[99,9,9],[200,9,9]]) {
    lifeGame.state.multiplier=n; life.update(0); const uv=life.banner.geometry.getAttribute('uv');
    eq(uv.getX(8),tens/16,'blimp tens or single-digit cell'); eq(uv.getX(12),ones/16,'blimp ones or blank cell');
    uv.needsUpdate=false; life.update(0); eq(uv.needsUpdate,false,'unchanged multiplier never rewrites UVs');
  }
  for (const [d,visible] of [[0,true],[3500,false],[3685,true],[4300,true]]) { life.update(0,d); eq(life.airship.visible,visible,'blimp tunnel mask'); }
  const frozen = json(life.steam.instanceMatrix.array); lifeGame.state.mode='paused'; life.update(5); eq(json(life.steam.instanceMatrix.array),frozen,'pause freezes life');
  const startRecord = (d) => {
    lifeGame.state.mode='running'; lifeGame.state.eventKind=null; lifeGame.world.distance=d; life.reset();
    lifeEventsBus.dispatchEvent(new Event('recordPass'));
  };
  startRecord(4300); life.update(0);
  eq(life.sparks.count,40,'first shell owns exactly forty sparks'); eq(life.celebration.fired,1,'first shell immediate');
  const sparkMatrix=life.sparks.instanceMatrix.array;
  ok(Math.abs(sparkMatrix[12]+45)<1e-6 && Math.abs(sparkMatrix[13]-(48+22*cityHash(0.5)))<1e-5 && sparkMatrix[14]===-140,'first shell exact centre in front of sky');
  for (let i=0;i<40;i++) {
    const rgb=[...life.sparks.instanceColor.array.slice(i*3,i*3+3)];
    eq(json(rgb.map((c)=>Math.round(c*255))),json(i%5===4?[255,255,255]:[255,47,168]),'shell colour with every fifth spark white');
  }
  life.update(0.5);
  const shellTime=life.celebration.time, shellAge=life.shells.find((s)=>s.age>=0).age;
  const u=shellAge/1.3;
  ok(Math.abs(life.sparks.instanceMatrix.array[13]-(48+22*cityHash(0.5)+16*(1-(1-u)**3)-3*u*u))<1e-5,'Fibonacci pole follows the exact cubic expansion and gravity');
  lifeGame.state.eventKind='goblin'; life.update(0.05);
  eq(life.celebration.time,shellTime,'Goblin freezes shell schedule'); eq(life.shells.find((s)=>s.age>=0).age,shellAge,'Goblin freezes existing sparks'); eq(life.sparks.count,0,'Goblin hides fireworks while on screen');
  lifeGame.state.eventKind=null; life.update(1/60); ok(life.sparks.count>0,'fireworks resume after Goblin');
  lifeEventsBus.dispatchEvent(new Event('recordPass')); eq(life.celebration.fired,1,'repeated record event cannot restart celebration');
  let activeShellPeak=0;
  for (let frame=0;frame<8*60;frame++) { life.update(1/60); activeShellPeak=Math.max(activeShellPeak,life.shells.filter((s)=>s.age>=0).length); }
  eq(life.celebration.fired,11,'eleven shells launch within eight seconds'); ok(activeShellPeak<=3,'at most three shells alive');
  for (let frame=0;frame<2*60;frame++) life.update(1/60);
  eq(life.sparks.count,0,'last spark expires'); eq(life.celebration.kind,null,'completed firework scheduler stops');
  startRecord(3500); life.update(0.05); eq(life.celebration.kind,'wait','record inside tunnel queues celebration'); eq(life.sparks.count+life.weather.count,0,'waiting creates no pieces');
  life.update(0.05,3685); eq(life.celebration.fired,0,'half-open tunnel still waits');
  life.update(0.05,3700); eq(life.celebration.kind,'fireworks','tunnel exit starts night celebration');
  startRecord(3500); life.reset(); life.update(0.05,3700); eq(life.sparks.count,0,'reset drops queued tunnel celebration');
  startRecord(1700); life.update(0); eq(life.weather.count,140,'day record uses exactly 140 tape pieces from weather pool'); eq(life.weather.material.opacity,1,'tape opacity one');
  for(let i=0;i<140;i++) {
    const a=life.weather.instanceMatrix.array, offset=i*16, x=a[offset+12], y=a[offset+13], z=a[offset+14];
    ok(Math.abs(x)>=4.8 && Math.abs(x)<=10 && y>=2 && y<=16 && z>=-60 && z<=0,'tape spawn volume');
    ok(Math.abs(x)-(Math.abs(a[offset])+Math.abs(a[offset+4]))/2>=4.6,'entire rotating tape clears the lane box');
    ok(Math.abs(Math.hypot(a[offset],a[offset+1])-0.18)<1e-6 && Math.abs(Math.hypot(a[offset+4],a[offset+5])-0.5)<1e-6 && Math.abs(a[offset+10]-0.02)<1e-6,'exact tape dimensions and Z rotation');
  }
  const tapeOrigin={...life.pieces[0]}; life.update(0.5);
  ok(Math.abs(life.weather.instanceMatrix.array[12]-(tapeOrigin.x+0.6*Math.sin(2.3*0.5+tapeOrigin.phase)))<1e-5,'exact ticker sway');
  ok(Math.abs(life.weather.instanceMatrix.array[13]-(tapeOrigin.y-2.6*0.5))<1e-5,'exact ticker fall');
  for(let i=0;i<6*60;i++) life.update(1/60);
  eq(life.weather.count,0,'ticker ends after six seconds');
  for(const [d,opacity,size] of [[10300,0.55,[0.03,1.1,0.03]],[16300,0.9,[0.09,0.09,0.09]]]) {
    lifeGame.world.distance=d; life.reset(); life.update(0);
    eq(life.weather.count,160,'night weather fills its single pool'); eq(life.weather.material.opacity,opacity,'weather opacity');
    const a=life.weather.instanceMatrix.array;
    ok(Math.abs(Math.hypot(a[0],a[1])-size[0])<1e-6 && Math.abs(Math.hypot(a[4],a[5])-size[1])<1e-6 && Math.abs(a[10]-size[2])<1e-6,'rain or snow exact dimensions');
    if(d===10300) ok(Math.abs(Math.atan2(a[1],a[0])-0.2)<1e-6,'rain tilt 0.2 radians');
    const p={...life.pieces[0]}; life.update(1/60);
    ok(Math.abs(life.pieces[0].y-(p.y-(d===10300?24:2.2)/60))<1e-9,'exact weather fall speed');
    life.pieces[0].y=-1; life.update(0); eq(life.pieces[0].y,16,'weather below ground respawns at top');
    for(const piece of life.pieces) ok(piece.x>=-10 && piece.x<=10 && piece.z>=-45 && piece.z<=5,'hashed weather positions stay in volume');
    life.update(0,d+200); eq(life.weather.count,0,'weather outside envelope has zero instances');
  }
  eq(life.weather.instanceColor.array.length,160*3,'weather instance colours preallocated at load'); eq(life.sparks.instanceColor.array.length,120*3,'spark instance colours preallocated at load');
  const reducedLife = runInNewContext(lifeSource.replace(/^import .*$/gm, '').replaceAll('export ', '') + '\ncreateCityLife;', { ...lifeGlobals, matchMedia:()=>({matches:true}) })(lifeGame,{},0);
  lifeGame.state.mode='running'; lifeGame.world.distance=flockAt(0)-20; reducedLife.reset(); reducedLife.update(1/60);
  eq(reducedLife.up.count,0,'reduced motion suppresses pigeon burst');
  for(const d of [10300,16300]) { lifeGame.world.distance=d; reducedLife.reset(); lifeEventsBus.dispatchEvent(new Event('recordPass')); reducedLife.update(1/60); eq(reducedLife.weather.count+reducedLife.sparks.count,0,'reduced motion suppresses rain, snow and fireworks'); }
  lifeGame.world.distance=3500; reducedLife.reset(); lifeEventsBus.dispatchEvent(new Event('recordPass')); reducedLife.update(1/60,3700); eq(reducedLife.sparks.count,0,'reduced motion also suppresses queued tunnel fireworks');
  reducedLife.dispose(); life.dispose();
  lifeEventsBus.dispatchEvent(new Event('recordPass')); ok(!life.celebration.seen && !reducedLife.celebration.seen,'dispose removes both record listeners');
  const lifeTriangles = 2*CONFIG.city.life.birds*60 + CONFIG.city.life.steam*20 + birdParts.blimp().plain.triangles + 8;
  ok(lifeTriangles <= 3000, 'full task9 pools fit the existing 3000-triangle life reserve');
  console.log('Task 9 computed resources:', json({ calls: 5, triangles: lifeTriangles, textureBytes: 1024*128*4 }));
  ok(!/\bnew\b|\.map\(|\.filter\(|\.slice\(|\.subarray\(/.test(lifeSource.slice(lifeSource.indexOf('    update(dt,'),lifeSource.indexOf('    dispose()')) .replace("throw new Error('City steam capacity exceeded');",'')), 'life update uses preallocated state only');
  const buildingMax = Math.max(...chunks.map((c)=>c.buildings.length));
  const inked = dance.outlines.length;
  const dragonTriangles = 2*(dragonGeometry.head.triangles+dragonGeometry.jaw.triangles+dragonGeometry.fan.triangles+12*dragonGeometry.ring.triangles)+6*dragonGeometry.pole.triangles;
  const extensionCalls = 2 + dance.meshes.length + inked, extensionTriangles = dragonTriangles + 13*(25+buildingMax)*2 + 13*buildingMax*12 + 13*24;
  const extensionTextureBytes = (1024*896+256*256)*4;
  const stageTextureBytes = 39059448 + extensionTextureBytes + 1024*128*4;
  const task10Triangles = (CONFIG.city.life.weather + CONFIG.city.life.sparks)*12;
  const triangleBound = 96964 + 5018 + 13*Math.max(...Object.values(pieces).map((p)=>(p.plain?.triangles||0)+(p.glow?.triangles||0)+(p.tunnel?.triangles||0))) + 3000 + 96*2 + extensionTriangles + lifeTriangles + task10Triangles;
  ok(extensionCalls <= 14 && extensionTextureBytes <= 4000000, `Chinatown calls/textures fit its share; triangles reported, cuts depend on whole stage: ${json({ extensionCalls, extensionTriangles })}`);
  ok(cityCallBound+extensionCalls+7 <= CONFIG.city.budget.calls && triangleBound <= CONFIG.city.budget.triangles && stageTextureBytes <= CONFIG.city.budget.textureBytes, 'conservative completed-stage resource accounting fits owner ceiling');
  console.log('Chinatown computed bounds:', json({ buildingMax, extensionCalls, extensionTriangles, extensionTextureBytes, stageCalls: cityCallBound+extensionCalls+7, stageTriangles: triangleBound, stageTextureBytes }));
  // Walk actual seeded facade ownership through 403 loops, with full life/weather/spark capacities reserved.
  const pieceTriangles=(p)=>(p?.plain?.triangles||0)+(p?.glow?.triangles||0)+(p?.tunnel?.triangles||0);
  let worstPoint={gun:0,calls:0,triangles:0}, worstCalls={gun:0,calls:0};
  for(let serial=12;serial<403*300+13;serial++) {
    let calls=76, triangles=96964+5018+96*2+lifeTriangles+task10Triangles, glyphs=0, ct=false, bridge=false;
    const kinds=new Set();
    for(let n=serial-12;n<=serial;n++) {
      const d=segCentre(n), [id,k]=districtInfo(d), plan=dressFor(id,k,loopOf(d));
      let name=plan.dress;
      if(id==='chinatown' && k===51) name=name==='ctFest'?'ctFestEnd':'ctEnd';
      else if(name==='ctFest' && k%2) name='ctFestOdd';
      const piece=pieces[name], portal=pieces[plan.portal?.[0]], chunk=chunks[chunkSpecs[n%300].v];
      if(!plan.chunk) calls-=2;
      calls+=(piece?.plain?1:0)+(piece?.glow?1:0)+(piece?.tunnel?1:0)+(portal?.plain?1:0)+(portal?.glow?1:0);
      triangles+=pieceTriangles(piece)+pieceTriangles(portal);
      for(const kind of ['tabela','ads','bugle']) if(piece?.anchors?.[kind]?.length || portal?.anchors?.[kind]?.length || (kind==='bugle' && plan.facade==='midtown' && chunk.anchors.length)) kinds.add(kind);
      if(id==='chinatown') {
        ct=true; glyphs+=24+piece.anchors.banner.length;
        for(let j=0;j<chunk.buildings.length;j++) {
          const hash=china.chinatownHash(n,j+4);
          if(hash%10<4) { glyphs++; triangles+=12; }
        }
      }
      if(id==='bridge') bridge=true;
    }
    if(ct) { calls+=extensionCalls; triangles+=dragonTriangles+glyphs*2; }
    calls+=kinds.size+7+(bridge?2:0); // water and the single clamp pool
    if(bridge) triangles+=CONFIG.world.segmentCount*16*12;
    const gun=(serial-12)*20;
    if(triangles>worstPoint.triangles) worstPoint={gun,calls,triangles};
    if(calls>worstCalls.calls) worstCalls={gun,calls};
    ok(calls<=CONFIG.city.budget.calls && triangles<=CONFIG.city.budget.triangles,`403-loop window bound ${json({gun,calls,triangles,glyphs})}`);
  }
  ok(worstCalls.calls <= CONFIG.city.budget.calls && worstPoint.triangles <= CONFIG.city.budget.triangles && stageTextureBytes <= CONFIG.city.budget.textureBytes,
    `scene budget at computed worst ?gun=${worstPoint.gun}: ${json({ ...worstPoint, textureBytes: stageTextureBytes, callPeak: worstCalls })}`);
  console.log('403-loop computed worst point:',json({...worstPoint,textureBytes:stageTextureBytes,callPeak:worstCalls}));
  ok(pieceSource.includes(prototype.slice(prototype.indexOf('const SEC ='), prototype.indexOf('function station(n)'))), 'approved tunnel section, light rhythm and shell copied unchanged');
  ok(pieceSource.includes(prototype.slice(prototype.indexOf('function mouth()'), prototype.indexOf('// ------------------------------------------------------------------ NEON MEYDAN'))), 'approved metro mouth copied unchanged');
  eq(pieces.mouth.anchors.tabela.length, ANCHOR_COUNTS.mouth, 'metro mouth builder anchor contract');
  for (let f = 0; f < recipe.SEC.length - 1; f++) {
    const [x0, y0] = recipe.SEC[f], [x1, y1] = recipe.SEC[f + 1];
    ok((y1 - y0) * -(x0 + x1) - (x1 - x0) * -(y0 + y1) > 0, 'every shell face points inward');
  }
  eq(pieces.shell.tunnel.triangles, 112, 'closed tunnel shell has seven inward faces');
  for (const name of ['station0', 'station1', 'station2']) {
    const g = pieces[name].tunnel;
    eq(g.triangles, 96, `${name}: open shell plus eight back-wall quads`);
    eq(json(Object.keys(g.attributes).sort()), json(['color', 'position', 'uv']), `${name}: compatible shell/wall attributes`);
    ok([...g.attributes.color.array.slice(-48 * 3)].every((n) => n === 1), `${name}: tile vertices stay white`);
    ok(!pieces[name].tunnelFlat && !pieces[name].anchors, `${name}: no extra wall board mesh`);
  }
  const planSource = citySource.slice(citySource.indexOf('  const planAt ='), citySource.indexOf('  const variants =', citySource.indexOf('  const planAt =')));
  const planned = runInNewContext(planSource + '\n({ plans, festivalPlans, beforeStart });', {
    pieces, CONFIG, SEG_L: 20, districtInfo, dressFor, loopOf, loopMetre, segCentre,
  });
  eq(planned.plans.length, 300, 'all district recipes cached before the run');
  eq(planned.festivalPlans.length,300,'all festival recipes cached before the run');
  for(const [plans,festival] of [[planned.plans,false],[planned.festivalPlans,true]]) {
    const rows=[], banners=[];
    for(let i=0;i<plans.length;i++) if(plans[i].facade==='chinatown') {
      const [,k]=districtInfo(i*20+14), centre=i*20+14, piece=plans[i].dress;
      for(const z of festival?[4,0,-6]:k%2?[4,-6]:[6,-4]) rows.push(centre-z);
      for(const a of piece.anchors.banner) banners.push(centre-a.z);
      eq(piece.anchors.glyph.length,24,'festival keeps the original signs, no duplicate family');
      eq(piece.anchors.tabela.length,2,'festival keeps original shop boards');
      ok(11+lanternLift()-CONFIG.city.chinatown.bannerHeight>=CONFIG.swing.height+CONFIG.swing.arcRise+CONFIG.playerHeight+1,'K6 normal and festival banners keep shared lantern clearance');
    }
    const expected=[]; for(let i=1;i+1<rows.length;i+=2) expected.push((rows[i]+rows[i+1])/2);
    eq(json(banners),json(expected),'K6 every banner is midway after every second actual lantern string, including segment boundaries');
    eq(rows.length,festival?156:104,'exactly three festival or two normal strings per segment');
  }
  const exit = planned.plans.find((p) => p.portal?.[0] === 'mouth' && p.portal[2] === Math.PI);
  ok(Math.abs(exit.anchors.tabela[0].z + 12.17) < 1e-9 && exit.anchors.tabela[0].ry === Math.PI, 'exit wall board follows its reused portal rotation');
  eq(planned.plans[167].dress, pieces.shell, 'tunnel shell assigned without a city chunk');
  const makeSegment = (serial) => ({ serial, group: { position: { z: -40 }, add(o) { o.parent = this; } },
    city: { group: { scale: {} }, facade: {}, plain: {}, dressPlain: {}, dressGlow: {}, shellMesh: {}, portal: null } });
  const mouth = { position: {}, rotation: {} }, facades = { midtown: {}, chinatown: {}, neon: {} };
  const boardPools = { tabela: createBoards({}, CONFIG.city.boards.tabela), ads: createBoards({}, CONFIG.city.boards.ads), bugle: pools.bugle };
  const assignContext = {
    variants: chunks, specFor: (serial) => ({ v: chunkSpecs[serial % 300].v, flip: true }),
    plans: planned.plans, festivalPlans: planned.festivalPlans, loopFlavor, loopOf, beforeStart: planned.beforeStart, SEG_L: 20, cityShift: 0,
    bridgeClamps: createBoards({}, 208), clampRect: [0,0,1,1],
    segCentre, loopMetre, facades, boards: boardPools, portals: { mouth }, updateNewsContext: news.updateNewsContext, takeBugle: news.takeBugle,
  };
  const assign = runInNewContext(citySource.slice(citySource.indexOf('  const assign ='), citySource.indexOf('  for (const seg of world.segments) assign(seg);')) + '\nassign;', assignContext);
  const festivalSeg=makeSegment(90);
  for(const [shift,festival] of [[6000,true],[12000,false],[18000,true]]) {
    assignContext.cityShift=shift; assign(festivalSeg);
    const index=Math.floor(loopMetre(segCentre(90)+shift)/20);
    eq(festivalSeg.city.plan,(festival?planned.festivalPlans:planned.plans)[index],'real recycle selects cached plans for each loop');
    for(const pool of Object.values(boardPools)) pool.release(festivalSeg);
  }
  assignContext.cityShift=0;
  const entrySeg = makeSegment(172), exitSeg = makeSegment(189);
  assign(entrySeg); assign(exitSeg); assign(Object.assign(entrySeg, { serial: 185 }));
  ok(exitSeg.city.shellMesh.visible && !exitSeg.city.group.visible, 'tunnel shell replaces the city chunk');
  eq(mouth.parent, exitSeg.group, 'one portal moves from entry to exit');
  ok(mouth.visible && mouth.rotation.y === Math.PI, 'recycling the old owner cannot hide the reused exit wall');
  eq(boardPools.tabela.mesh.count, 1, 'recycling removes only the old portal board');
  assign(Object.assign(entrySeg, { serial: 140 }));
  ok(!entrySeg.city.group.visible && entrySeg.city.dressPlain.visible && !entrySeg.city.shellMesh.visible, 'bridge replaces city with cables and clears the old shell');
  assign(Object.assign(entrySeg, { serial: 90 }));
  ok(entrySeg.city.group.visible && entrySeg.city.facade.material === facades.chinatown && entrySeg.city.dressGlow.visible, 'Chinatown uses its atlas and dress');
  eq(entrySeg.city.group.scale.x, -1, 'only the chunk group mirrors');
  const initialSegments = Array.from({ length: 13 }, (_, serial) => makeSegment(serial));
  for (const [start, district] of [[0, 'midtown'], [1500, 'chinatown'], [3700, 'neon'], [5200, 'midtown']]) {
    const atZero = makeSegment(5), at400 = makeSegment(5);
    assignContext.cityShift = start; assign(atZero);
    assignContext.cityShift = start + 400; assign(at400);
    eq(atZero.city.facade.material, at400.city.facade.material, `B1: segments built at metres 0 and 400 in ${district} share the facade texture set`);
    eq(atZero.city.facade.material, facades[district], 'B1: initial facade is the painted district material');
    for (const pool of Object.values(boardPools)) { pool.release(atZero); pool.release(at400); }
  }
  assignContext.cityShift = 0;
  const laterMidtown = makeSegment(35); assign(laterMidtown);
  for (const seg of initialSegments) {
    assign(seg);
    eq(seg.city.facade.material, laterMidtown.city.facade.material, 'start and recycled Midtown share the painted atlas and shader');
    eq(seg.city.dressPlain.visible, laterMidtown.city.dressPlain.visible, 'start and recycled Midtown share the facade dress');
    eq(seg.city.dressGlow.visible, laterMidtown.city.dressGlow.visible, 'start and recycled Midtown share the glow dress');
  }
  ok(boardPools.bugle.mesh.count > 0, 'real assign places existing Midtown roof anchors in the Bugle pool');
  let resetCount = 0;
  const onGameOver = runInNewContext(citySource.slice(citySource.indexOf('  const onGameOver ='), citySource.indexOf('  const system =', citySource.indexOf('  const onGameOver ='))) + '\nonGameOver;', {
    world: { segments: [entrySeg, exitSeg, laterMidtown, ...initialSegments] }, boards: boardPools, bridgeClamps: assignContext.bridgeClamps, facades, portals: { mouth }, reset: () => resetCount++, life: { reset() {} },
  });
  onGameOver();
  eq(boardPools.tabela.mesh.count, 0, 'game over empties district board pools');
  eq(boardPools.bugle.mesh.count, 0, 'game over empties Midtown roof Bugle ownership too');
  ok(!mouth.visible && !exitSeg.city.shellMesh.visible && exitSeg.city.group.visible, 'game over clears portal and tunnel state');
  eq(resetCount, 1, 'game over resets day and district announcer once');
  eq(assignContext.bridgeClamps.mesh.count, 0, 'B2: game over empties the clamp pool');
  ok(citySource.includes("events.addEventListener('menu', onGameOver)") && citySource.includes("events.removeEventListener('menu', onGameOver)"), 'B2: menu shares cleanup and dispose removes the listener');
  assign(exitSeg);
  ok(mouth.visible && exitSeg.city.shellMesh.visible, 'restart can dress the same segment again');
  const primitiveCounts = Object.fromEntries(Object.entries(pieces).map(([name, p]) => [name,
    (p.plain?.triangles || 0) + (p.glow?.triangles || 0) + (p.tunnel?.triangles || 0)]));
  console.log('City primitive triangle accounting:', json({ bridgeMax: Math.max(...Object.entries(primitiveCounts).filter(([n]) => n.startsWith('cable')).map(([, n]) => n)),
    tower: primitiveCounts.tower, vapur: primitiveCounts.vapur, chinatown: primitiveCounts.ct0, festival: primitiveCounts.ctFest,
    gate: primitiveCounts.gate, shell: primitiveCounts.shell, stationMax: primitiveCounts.station1, mouth: primitiveCounts.mouth,
    neonMax: Math.max(primitiveCounts.neon0, primitiveCounts.neon1, primitiveCounts.neon2), gantry: primitiveCounts.gantry }));
  pieceContext.ANCHOR_COUNTS = { ...ANCHOR_COUNTS, midtownSign: 2 };
  checks++; assert.throws(buildPieces, /City anchor count: midtownSign.tabela/, 'builder count mismatch fails at load');
}
const artSource = await readFile(new URL('../src/obstacle-art.js', import.meta.url), 'utf8');
ok(/hullGeometry/.test(artSource) && /this\.hulls/.test(artSource) && /OUTLINE_T/.test(artSource), 'D4: original obstacle outline construction is retained');
ok(artSource.includes('const OUTLINE_COLOR = 0x15171c;') && !/0xffb020|amber|orange.*outline|yellow.*outline/i.test(artSource), 'D4: original ink outline exists without yellow/amber/orange additions');
class RecipeShape {
  constructor() { this.boxes = []; }
  box(...args) { this.boxes.push(args); return this; }
  build() { return this.boxes; }
}
class RecipeMatrix {
  makeScale(x, y, z) { this.scale = [x, y, z]; this.angle = 0; return this.setPosition(0, 0, 0); }
  makeTranslation(x, y, z) { this.scale = [1, 1, 1]; this.angle = 0; return this.setPosition(x, y, z); }
  makeRotationZ(angle) { this.makeTranslation(0, 0, 0); this.angle = angle; return this; }
  setPosition(x, y, z) { this.position = [x, y, z]; return this; }
}
class RecipeKind {
  constructor(scene, shape, material, outline, capacity) { this.shape = shape; this.material = material; this.outlineMaterial = outline; this.capacity = capacity; this.instances = []; }
  begin() { this.instances.length = 0; }
  add(m) { this.instances.push({ position: [...m.position], scale: [...m.scale], angle: m.angle }); }
  end() {}
}
const emptyShape = () => [];
const recipeArt = runInNewContext(
  artSource.slice(artSource.indexOf('const INK ='), artSource.indexOf('// Coin:')) +
  artSource.slice(artSource.indexOf('export function createObstacleArt')).replace('export ', '') + '\ncreateObstacleArt({});',
  {
    CONFIG, laneX, girderOffset, ShapeBuilder: RecipeShape, InstancedKind: RecipeKind,
    THREE: { Matrix4: RecipeMatrix, MeshBasicMaterial: class {} },
    toonMaterial: () => ({}), OUTLINE_COLOR: 0x15171c, CAR_COLORS: [],
    buildLow: emptyShape, buildHigh: emptyShape, buildCarBody: emptyShape, buildCarDetail: emptyShape,
    buildWagon: emptyShape, buildRamp: emptyShape, buildCoin: emptyShape,
  },
);
const recipeExpected = {
  gapHole: [14, 0, 3], gapEnds: [57, 0, 3], gapPatch: [11, 0, 3],
  gateFrame: [18, 0, 3], gateShutter: [42, 0, 3], girderBeam: [44, 0, 3],
  girderJib: [6, 0, 3], girderPad: [10, 0, 6], girderGo: [6, 0, 3],
};
for (const [name, kind] of Object.entries(recipeArt.kinds)) {
  if (name !== 'coin') eq(kind.material, recipeArt.obstacleMaterial, `R7: ${name} uses the existing shared body material`);
  if (name !== 'coin' && name !== 'carDetail') eq(kind.outlineMaterial, recipeArt.rims[0].m, `D4: ${name} keeps the shared outline pass`);
}
ok(recipeArt.obstacleMaterial !== recipeArt.coinMaterial, 'R7: obstacle emission never changes the coin material');
for (const [name, [boxes, hulls, capacity]] of Object.entries(recipeExpected)) {
  const kind = recipeArt.kinds[name];
  eq(kind.shape.length, boxes, `${name}: all recipe primitives`);
  eq(kind.capacity, capacity, `${name}: fixed instance budget`);
}
for (const name of ['gapEnds', 'girderGo']) {
  for (const b of recipeArt.kinds[name].shape.filter((box) => box[7]?.ry)) {
    const lane = Math.round(b[3] / CONFIG.laneWidth);
    const towardCenter = -Math.sign(b[3] - lane * CONFIG.laneWidth) * b[0] / 2;
    ok(-Math.sin(b[7].ry) * towardCenter < 0, `${name}: chevron apex points forward (-Z)`);
  }
}
for (const len of [4, 4.5, 5, 5.5, 6]) {
  recipeArt.begin(); recipeArt.addPatch(-80, len);
  eq(recipeArt.kinds.gapHole.instances[0].scale[2], len, 'hole scales with length');
  eq(recipeArt.kinds.gapPatch.instances[0].scale[2], len, 'patch scales with length');
  eq(recipeArt.kinds.gapEnds.instances[0].scale[2], 1, 'signs and rails never stretch');
}
for (const [tau, raised] of [[3, 1.9], [2.4, 1.9], [2, 0.95], [1.6, 0], [-1, 0]]) {
  recipeArt.begin(); recipeArt.addRow('gate', -80, 0.35, undefined, tau);
  ok(Math.abs(recipeArt.kinds.gateShutter.instances[0].position[1] - raised) < 1e-9, 'gate drops by CONFIG smoothstep');
}
for (const open of [0, 2]) for (const tau of [-0.2, 1.2, 2.2]) {
  recipeArt.begin(); recipeArt.addRow('girder', -80, 0.5, open, tau);
  eq(recipeArt.kinds.girderPad.instances.length, 2, 'two fixed warning pads');
  eq(recipeArt.kinds.girderGo.instances[0].position[0], laneX(open), 'green arrows stay in the open lane');
  eq(recipeArt.kinds.girderBeam.instances[0].angle, girderOffset(tau, open) / (CONFIG.obstacles.girder.pivotY - 1.2), 'beam swings around its high pivot');
}

// ---------- 11.5 görev 7: actual game/player/obstacle/chaser event loop ----------
{
  const { Chaser } = await import('../src/chaser.js');
  const { RoadEvents } = await import('../src/road-events.js');
  const saved = { ...game }, savedState = { ...game.state }, savedMult = { ...game.mult };
  const h = rowHarness(20);
  h.world.update = (dt, speed) => { h.world.distance += dt * speed; };
  h.world.reset = () => { h.world.distance = 0; };
  game.camera = null;
  game.cameraRig = { scale: 1, clearShot() {}, setShot() {}, snap() {} };
  const chaser = new Chaser({ add() {} }, h.player, h.ob, { root: {}, setState() {}, update() {} });
  const director = new RoadEvents({ player: h.player, obstacles: h.ob, chaser });
  game.systems = [h.ob, chaser, director];
  game.chaser = chaser; game.roadEvents = director;
  game.intro = null;
  h.ob.fixedSeed = 11507;
  let log = [], target = null, avoid = () => false;
  const names = ['eventStart', 'strikeWarn', 'strikeSlam', 'strikeHit', 'eventDodge', 'eventReward', 'eventEnd', 'eventBonusOff', 'stumble', 'senseDodge', 'coin'];
  const listeners = names.map((name) => {
    const fn = (e) => {
      log.push({ name, ...e.detail, t: game.state.time, d: h.world.distance, aim: h.player.lane, bonusTime: game.state.eventBonusTime });
      if (name === 'strikeWarn' && avoid()) target = nearestSafe([0, 1, 2].map((l) => e.detail.lanes.includes(l)), h.player.lane);
    };
    events.addEventListener(name, fn); return [name, fn];
  });
  const count = (name) => log.filter((e) => e.name === name).length;
  const reset = (d) => {
    game.swing = { active: false }; game.wall = { active: false }; game.web = { zipping: false };
    game.heroSpecials = { active: false }; game.sense = { dodges: 0 };
    game.restart();
    game.state.intro = false;
    game.state.senseTime = game.state.tracerTime = 0;
    chaser.mode = 'away';
    h.world.distance = game.state.distance = d;
    game.naturalSpeed = game.state.speed = speedAt(d);
    log = []; target = null; avoid = () => false;
  };
  const step = () => {
    if (game.state.mode === 'running' && !game.halted && target != null && h.player.lane !== target) h.player.changeLane(Math.sign(target - h.player.lane));
    game.update(1 / 60);
  };
  const run = (seconds) => { for (let n = 0; n < Math.round(seconds * 60); n++) step(); };
  const until = (done) => {
    for (let n = 0; n < 900 && !done(); n++) step();
    ok(done(), 'event reaches its expected boundary within 15 s');
  };
  const start = () => {
    ok(director.start('venom'), 'manual Venom starts');
    eq(game.state.eventKind, 'venom', 'director owns event kind');
    eq(chaser.mode, 'near', 'hunt brings Venom near'); eq(chaser.spare, 1, 'hunt forgives one hit');
  };
  for (const d of [1500, 20000]) {
    reset(d);
    for (const [owner, key, value] of [[game.swing, 'active', true], [game.wall, 'active', true], [game.web, 'zipping', true], [game.heroSpecials, 'active', true], [game.state, 'tracerTime', 1], [game, 'speedOverride', 100], [h.player, 'controlsLocked', true]]) {
      const old = owner[key]; owner[key] = value;
      eq(director.start('venom'), false, `start refuses ${key}`); owner[key] = old;
    }
    start(); eq(director.start('venom'), false, 'only one event at a time');
    until(() => count('strikeHit') > 0);
    eq(count('stumble'), 1, 'first event hit stumbles'); eq(game.halted, false, 'first hit is forgiven'); eq(chaser.spare, 0, 'first hit consumes spare');
    until(() => !director.active);
    eq(count('stumble'), 2, 'second strike stumbles through the shared hook');
    eq(game.halted, true, 'second strike catches'); eq(chaser.mode, 'catch', 'catch animation retains ownership');
    eq(log.find((e) => e.name === 'eventEnd').aborted, true, 'catch aborts the event immediately');
    eq(count('eventReward'), 0, 'catch has no reward');

    reset(d); avoid = () => true; start(); run(11);
    eq(count('strikeHit') + count('stumble'), 0, 'moving to nearestSafe avoids every strike');
    ok(director.dodged >= 3, 'at least three strikes resolved');
    const reward = log.find((e) => e.name === 'eventReward');
    eq(reward.coins, director.dodged * 5 + 25, 'clean reward pays per dodge plus bonus');
    eq(reward.mult, 3, 'clean reward multiplier'); eq(game.state.coins, reward.coins, 'reward goes into run coins');
    eq(reward.bonusTime, 12, 'clean reward starts a full twelve-second timer');
    eq(count('coin'), 0, 'reward emits no individual coin events');
    eq(game.mult.event, 3, 'reward uses its own multiplier'); eq(chaser.mode, 'away', 'clean hunt drops Venom back');
    const cleanRows = log.filter((e) => e.name === 'strikeWarn').map((e) => ({ lanes: e.lanes, warn: e.warn }));
    const warns = log.filter((e) => e.name === 'strikeWarn');
    for (let i = 0; i < warns.length; i++) {
      const w = warns[i];
      const delta = Math.min(...[0, 1, 2].filter((l) => !w.lanes.includes(l)).map((l) => Math.abs(l - w.aim)));
      ok(w.warn >= floorW(delta, w.d), 'every emitted warning covers its actual lane distance');
      if (i) ok(w.t - warns[i - 1].t >= warns[i - 1].warn + CONFIG.events.venom.slamTime - 1 / 60, 'next warning waits for previous strike resolution');
    }
    run(12); eq(game.mult.event, 0, 'event multiplier expires'); eq(game.state.eventBonusTime, 0, 'bonus timer expires');
    eq(count('eventBonusOff'), 1, 'bonus off once');

    reset(d); avoid = () => director.hits > 0; start();
    until(() => !director.active);
    eq(director.hits, 1, 'one hit then dodging survives');
    const hitReward = log.find((e) => e.name === 'eventReward');
    eq(hitReward.mult, 1, 'survival reward is +1'); eq(hitReward.coins, director.dodged * 5, 'hit loses clean coins');
    eq(chaser.mode, 'near', 'surviving a hit leaves Venom near'); ok(chaser.timer <= CONFIG.chaser.nearTime, 'near timer is finite again');
    eq(game.state.eventBonusTime, 12, 'full bonus duration at event completion');

    reset(d); game.state.senseTime = 99; start(); run(11);
    eq(count('strikeHit'), 0, 'sense dodges without input');
    ok(count('senseDodge') >= count('strikeWarn'), 'sense makes at least one change per strike');
    eq(game.sense.dodges, count('senseDodge'), 'sense dodge counter follows event dodges');
    reset(d); h.ob.grace(99); start(); run(11);
    eq(count('strikeHit'), 0, 'landing/save grace protects event hits');

    reset(d); avoid = () => true; start(); run(2);
    game.pause();
    const frozen = json([director.t, director.strike, chaser.gap, h.world.distance, game.state.eventTime, game.state.eventBonusTime]);
    run(100 / 60);
    eq(json([director.t, director.strike, chaser.gap, h.world.distance, game.state.eventTime, game.state.eventBonusTime]), frozen, '100 paused frames freeze every event clock');
    game.resume(); run(9);
    eq(json(log.filter((e) => e.name === 'strikeWarn').map((e) => ({ lanes: e.lanes, warn: e.warn }))), json(cleanRows), 'pause preserves the seeded volley');

    reset(d); start(); run(2); game.restart();
    eq(game.state.eventKind, null, 'restart clears event'); eq(game.mult.event, 0, 'restart clears multiplier');
    eq(chaser.spare, 0, 'restart clears spare'); eq(chaser.hunting, false, 'restart clears hunting'); eq(chaser.pose, null, 'restart clears forced pose');

    reset(d); start(); run(2); game.heroSpecials.active = true; step();
    eq(log.find((e) => e.name === 'eventEnd').aborted, true, 'mid-event special aborts'); eq(count('eventReward'), 0, 'special abort has no reward');
    reset(d); start(); run(2); game.halt(); step();
    eq(game.state.eventKind, null, 'external halt aborts'); eq(count('eventReward'), 0, 'halt pays nothing');

    reset(d); start(); director.active.len = game.state.speed * 3;
    run(5);
    ok(!log.some((e) => e.name === 'strikeSlam' && e.d > d + speedAt(d) * 3 - speedAt(e.d) * CONFIG.events.endMargin), 'short zone never slams beyond early-end line');
    eq(game.state.eventKind, null, 'short zone ends');

    reset(d); start(); run(2); game.gameOver();
    eq(game.state.eventKind, null, 'game over clears active event'); eq(game.mult.event, 0, 'game over clears multiplier');
    eq(game.state.eventBonusTime, 0, 'game over clears bonus clock'); eq(count('eventReward'), 0, 'game over abort pays nothing');
    reset(d); start(); run(2); game.toMenu();
    eq(game.state.eventKind, null, 'menu clears event'); eq(chaser.hunting, false, 'menu clears hunt');
  }
  reset(999); eq(director.start('venom'), false, 'no event in first kilometre');
  reset(1500); start();
  until(() => director.strike?.phase === 'slam');
  const lanes = director._lanes, position = director._position;
  director._lanes = director._position = () => { throw new Error('allocation helper called during an unhit slam frame'); };
  h.player.x = laneX(nearestSafe(director.strike.deadly, h.player.lane));
  for (let n = 0; n < 3; n++) director._venom(1 / 60);
  eq(director.strike.hit, false, 'unhit slam frames use no array or position allocation helper');
  director._lanes = lanes; director._position = position;
  reset(1500); eq(director.start('goblin'), false, 'Goblin logic belongs to task 9');
  // A decoy wrapper installed after the chaser must still intercept the first stumble.
  const chained = h.ob.hooks.onSideStumble;
  let decoySpare = 1;
  h.ob.hooks.onSideStumble = (hit) => { if (decoySpare) { decoySpare--; return; } chained(hit); };
  start(); h.ob.eventHit(0); eq(chaser.spare, 1, 'decoy consumes its spare before Venom is told');
  h.ob._sideHitTimer = 0; h.ob.eventHit(0); eq(chaser.spare, 0, 'next hit reaches Venom through wrapper');
  chaser.hooks.absorbCatch = () => true;
  h.ob._sideHitTimer = 0; h.ob.eventHit(0); eq(game.halted, false, 'Iron Spider catch absorb still saves him');
  director.reset();
  for (const [name, fn] of listeners) events.removeEventListener(name, fn);
  Object.assign(game, saved); Object.assign(game.state, savedState); Object.assign(game.mult, savedMult);
}

for (const [name, fn] of rowListeners) events.removeEventListener(name, fn);
Object.assign(game, rowSaved);

await import('./test-audio.mjs');

console.log(`OK ${checks} checks`);

