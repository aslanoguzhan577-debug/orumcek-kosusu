# 11.5 Yol sürprizleri — budget, coding tasks, open questions

Index: `tasarim/11-5-yol-surprizleri.md` (A = obstacles, generator, checker), `11-5-olaylar.md`
(S, B, C, D = events), `11-5-modeller.md` (M0–M8 = build recipes).

## E Performance budget (binding)

Rules: no dynamic light; no geometry, material, texture or canvas created after the loader is
gone; everything below is built in a constructor, added to the scene hidden, and compiled /
uploaded by the existing warm-up (warmup.js renders the whole scene once with everything visible);
every repeated thing is an InstancedMesh or a fixed pool; no post-processing; per-frame code
allocates nothing (module-level temps; event detail objects only on discrete events).

| Thing | Built at load | Pool / capacity | Draw calls while on screen |
|---|---|---|---|
| Ray Yarığı | 3 instanced kinds | 3 each | `gapHole` 1 + `gapEnds` 2 = 3 (+1 `gapPatch`) |
| Sinyal Kapısı | 2 instanced kinds | 3 each | 2 + 2 = 4 |
| Vinç Kirişi | 4 instanced kinds | beam 3, jib 3, pad 6, go 3 | 2 + 1 + 1 + 1 = 5 |
| lane warnings | 6 meshes, 6 materials, 1 texture 128 × 512 | 3 lanes | <= 4 |
| tendrils | 4 `TubeShape(16, 8)` + outlines, 1 material | 4 | <= 8 |
| pumpkin bombs | 1 InstancedMesh + outline, 1 texture 256 × 128 | 8 | 2 |
| target rings | 1 InstancedMesh, 1 texture 256 × 256 | 8 | 1 |
| light columns | 1 InstancedMesh | 8 | 1 |
| Yeşil Cin | 10 meshes (8 outlined), 3 materials, 1 texture 512 × 384, held bomb, blob shadow | 1 | 18 + 2 + 1 = 21 |
| stickers | 3 more 256 × 128 textures in the existing table | existing 3 sticker sprites | 0 |
| lane colliders | — | the obstacle `_pool` (unbounded, objects reused) | 0 |

| Situation | Extra draw calls | Note |
|---|---|---|
| normal track, one row obstacle in view | +3 to +5 | a row block holds nothing else, so the block is cheaper than a busy one |
| endless combo (gap + gate) | +7 | |
| Venom Hamlesi | +12 | on an empty zone (no obstacle kinds drawn at all) |
| Yeşil Cin baskını | +25 | on an empty zone; the most expensive moment of 11.5 |

Triangles: Goblin ~7 k (+ the same again for outlines), four tendrils ~1 k (+ outlines), girder beam ~0.6 k, bombs 8 × 0.3 k. New texture memory < 1.5 MB.
Done when: `renderer.info.render.calls` and the smoothed frame time are recorded before and after on the test phone for (a) the busiest normal block, (b) each row type, (c) both events; the adaptive pixel ratio (quality.js) does not step down in an event where it did not step down on a busy block before.

## F Ordered coding tasks

After every task the game runs, `node tools/check-patterns.mjs` and `node tools/test-skills.mjs`
(and the three QA scripts) pass. Marks: `routine` (cheap fast coder, from the text), `hard`
(strong coder), `visual-short` (art, under ~150 lines), `visual-spec` (art for the spec coder, from
the M recipes). Row obstacles go live in task 5, events in task 13; nothing is live before its
visuals exist.

### 1 Config, state, pure helpers — `routine`
Files: `src/config.js` (the whole block of file 1 §2), `src/game.js` (state `eventKind: null, eventTime: 0, eventBonusTime: 0`; `mult.event`; the multiplier formula; `_resetRun` zeroes `mult.event`), `src/patterns.js` (`descLength` cases, exports `descLanes`, `girderOffset`, `AFTER_TIME` entries; no generation change).
Asserts (test-skills): `game.mult.event = 2` -> after one running update `state.multiplier === (base + run + temp + 2) * factor`; a restart zeroes it; `descLanes({type:'gap'})` = [0,1,2], `descLanes({type:'girder', open: 0})` = [1,2], `open: 2` = [1,0], `descLanes({type:'low', lane: 2})` = [2]; `girderOffset(0, 2) === -1.1`, `girderOffset(0, 0) === 1.1`, `girderOffset(2.2, 2)` = +1.1 (±1e-9), `girderOffset(1.2, 2) === -1.1`, `|girderOffset(t, open)| <= 1.1` for t in 0..8 step 0.05; `descLength({type:'gap', len: 4.5}) === 4.5`.

### 2 Wide obstacles, pits, event hits in `obstacles.js` — `hard`
Files: `src/obstacles.js` (file 1 A.5, all nine points), `src/obstacle-art.js` (only two empty methods `addRow() {}` and `addPatch() {}` so `_draw` can call them).
Asserts (test-skills, driving the harness's `Obstacles` with `_spawn(desc)` and stepped updates at 20 and 39 m/s):
- a `gap` descriptor (len 4): 3 colliders in `active`, lanes 0/1/2, exactly one `owner`, shared `group`;
- running into it on the ground: `crash` once, `hooks.onCrash` once; `player.floorY` stays 0 over it;
- a jump started 0.1 s before the lip: no hit, `rowPass {type:'gap'}` exactly once;
- placed mid-gap at y = 1 and falling: front hit (the pit rule);
- `remove(collider)`: it leaves `active` at once, its mates have `z === 1e6`, one more `beforePlayer` and none of the group is in `active`; `patches.length === 1`; `gapPatch` once; running across the patch: no hit;
- a reverse index loop that calls `remove` on everything in `active` (as ironspider.js:178 does) with a gap row, a gate row and a `low` present: no exception, `active` empty one frame later;
- `gate` row: standing = `crash`; sliding = no hit and `rowPass {type:'gate'}`;
- `girder`, `open: 2`: lanes 0 and 1 = `crash`; lane 2 = `rowPass {type:'girder'}`; a lane change 2 -> 1 started beside the beam = `stumble`;
- `rowWarn` exactly once per row, at the first frame with `tau <= 2.4`;
- `eventHit(0)`: `false` and no `stumble` while graced; otherwise `stumble` and the `onSideStumble` hook; with `hooks.onSideHit` returning true: no `stumble`;
- `reset()` empties `patches`; an object reused from the pool for a `low` has `group === null`, `owner === false`;
- `{type:'event'}`: `hooks.onEventZone` called with it, `active` unchanged.

### 3 Obstacle art — `visual-spec`
Files: `src/obstacle-art.js` (the `ry` option, nine kinds, `addRow`, `addPatch`): recipes M0–M3.
Checker, in the browser console of a running game: `game.obstacles._spawn({ type: 'gap', lane: 1, d: game.world.distance + 80, len: 4 })`, the same with `type: 'gate', len: 0.35` and `type: 'girder', len: 0.5, open: 0 | 2`; look at the "Look at" lists of M1, M2, M3 at start speed and at top speed, in portrait 360 × 740 and in landscape, on a straight and in a curve (everything bends with the track).

### 4 Spider-sense learns the new shapes — `hard`
File: `src/powerups/sense.js`.
- `isWall`: also `it.o.type === 'girder'`. `high`: `threat.o.type === 'high' || threat.o.type === 'gate'`.
- `simulate`, floor loop: `if (it.part.pit) continue;`. Hit loop: `if (entering || rising || it.part.pit) return tn;`.
- `_freeLane`, when no direct lane was found (`best === 0`): for `dir` of [-1, 1] with both `p.lane + dir` and `p.lane + 2 * dir` on the track: collect lane `p.lane + dir` over `S.laneRankTime`; its earliest wall (`isWall`, `t0 > 0`) must come later than `2 * CONFIG.laneSwitchTime + 0.08`; then collect lane `p.lane + 2 * dir` and require `simulate(p, list, null, 0, S.laneClearTime) === Infinity`; if so return `dir` (the next frames finish the crossing by the normal rule).
Asserts: with the sense on and no input: gap row -> `senseDodge {action:'jump'}`, no hit, at 19, 26 and 39 m/s; gate row -> `'slide'`, no hit; girder `open: 2` from lane 1 -> one `'right'`; from lane 0 -> two `'right'` and no hit, at 20 and 39 m/s; mirrored for `open: 0`; every existing sense assert unchanged.

### 5 Generator rows and zones, and the checker — `hard`
Files: `src/patterns.js` (file 1 A.6, complete, zones included), `tools/check-patterns.mjs` (file 1 A.7, C1–C14).
Zones are generated from now on but nothing listens (`hooks.onEventZone` is the default no-op): until task 13 a zone is a quiet stretch of empty track.
Asserts (test-skills): two generators with the same seed give identical descriptor lists over 20 km; a counting extra is called exactly once per block, special and calm blocks included; no `pickup` descriptor comes from a block that placed a row or a zone.
Fairness (check-patterns, default run 150 seeds × 20 minutes): C1–C14, the route search finds a way on every seed, and the per-minute reaction margin stays `>= 0.4 s`. Report rows per km and zones per km in the summary line.

### 6 `src/event-logic.js` — `hard`
File: new, exactly S.1 of the events file.
Asserts (test-skills), for `d` in [1200, 3000, 8000, 14600, 20000, 60000, 300000], 500 seeded draws each, every non-empty `safePrev` and every `aim` with `safePrev[aim]`:
- `deadly` has at least one safe lane; `deadly[aim]` is true;
- `delta` equals a brute-force recomputation; `warn >= floorW(delta, d)`; `warn >= P.minReaction + delta * CONFIG.laneSwitchTime`;
- `warnAt(d) >= floorW(1, d)`; `warnAt` and `restAt` never grow with `d`; `restAt(d) > 0`; `doubleChance(1200) === 0`, `doubleChance(d) <= 0.6`;
- `E.goblin.lead >= Math.max(E.warnEasy, floorW(2, d)) + 0.1`;
- at least 3 strikes fit: `E.venom.duration - E.venom.intro - E.venom.outro >= 3 * (warnAt(1200) + E.venom.slamTime + restAt(1200))`;
- `rewardFor('venom', 4, 0)` = `{ coins: 45, mult: 3, clean: true }`; `rewardFor('goblin', 5, 1)` = `{ coins: 30, mult: 1, clean: false }`;
- `nearestSafe([true, false, false], 0) === 1`; `nearestSafe([true, true, false], 0) === 2`; `nearestSafe([false, true, false], 1)` is 0.

### 7 The director, Venom Hamlesi logic, chaser changes — `hard`
Files: `src/road-events.js` (new: S.2, S.3, B.3), `src/chaser.js` (B.2), `src/main.js` (construct after the tracer, `game.roadEvents`).
The director never imports `event-art.js`: `main.js` passes the art objects in (`{ warnings, tendrils, bombs, markers, columns, goblin }`), every call is guarded (`this.art.warnings?.show(…)`), so node tests run it with no art. It does **not** install `obstacles.hooks.onEventZone` yet; events start only through `roadEvents.start(kind)`.
Asserts (test-skills, `start('venom')`, stepped at 1/60 s, at world distances 1500 and 20000):
- `start` is refused while `swing.active`, `wall.active`, a hero special is active, `tracerTime > 0` or `speedOverride != null`; otherwise it sets `state.eventKind`, `chaser.mode === 'near'`, `chaser.spare === 1`;
- a player who never moves: the first strike hits (`stumble`), not caught; the second is a catch (`game.halted`), the event ends `aborted`, no `eventReward`;
- a player who moves to `nearestSafe` on every `strikeWarn`: no hit, `dodged >= 3`, `eventReward` with `coins === dodged * 5 + 25` and `mult === 3`; `state.coins` grew by that; `mult.event === 3`, `eventBonusTime === 12`; chaser back to `'away'`; 12 s later `mult.event === 0` and `eventBonusOff` once;
- hit once, then dodge: `mult === 1`, no clean coins, chaser `'near'` with `timer <= nearTime` at the end;
- sense on, no input: no hit, one `senseDodge` or more per strike;
- `obstacles.grace(99)`, no input: no hit;
- no second `strikeWarn` before the first strike resolved; every `strikeWarn.warn >= floorW(delta, d)`;
- pausing for 100 frames mid-event changes nothing: same number of strikes as the unpaused run with the same seed;
- restart mid-event: `eventKind === null`, `mult.event === 0`, `chaser.spare === 0`, `chaser.hunting === false`;
- a hero special switched on mid-event: `eventEnd {aborted: true}`, no reward;
- a fake zone that ends early: no `strikeSlam` once `world.distance > zone.d + zone.len - speed * E.endMargin`.

### 8 Venom Hamlesi visuals — `visual-spec`
Files: `src/event-art.js` (new: `createLaneWarnings`, `createTendrils`: M4, M5), `src/road-events.js` (drive them: B.3 / B.4; `cameraRig.setDolly`), `src/main.js` (build the art, pass it in).
Checker: `game.roadEvents.start('venom')` on a run at ~1.5 km and (console speed-up) at top speed. Look at: Venom is clearly in the frame, bigger than in a normal chase, and never covers the player or the lanes ahead; the red lane is unmistakable in portrait and its fill reaches the feet exactly when the tendril lands; the slam lies on the red lane only; two red lanes leave one clearly clean lane; pause freezes everything mid-whip; after the event the camera is back where it was; "Look at" of M4, M5.

### 9 Yeşil Cin logic — `hard`
File: `src/road-events.js` (C.3; art calls guarded as before).
Asserts (`start('goblin')`, distances 3000 and 20000):
- every row has a safe lane; `D[k] - D[k-1] >= speed * row.warn - 0.5`; at its toss every row is `>= speed * E.goblin.lead - 0.5` m ahead;
- a player who stays in the aimed lane: `stumble` at the first row, chaser `'near'`; hit again inside `nearTime`: catch;
- a player who goes to `nearestSafe` of the nearest live row: no hit; `dodged` = number of rows; `eventReward.coins === rows * 6 + 30`;
- never more than 8 bombs alive (also with `difficultyAt` forced deep into the endless phase);
- sense on, no input: no hit;
- no toss lands beyond `zone.d + zone.len - speed * E.endMargin`; every row is resolved before `eventEnd`;
- the same abort / pause / restart asserts as task 7.

### 10 Bombs, rings, columns — `visual-short`
Files: `src/event-art.js` (`createBombs`, `createBombMarkers`, `createBombColumns`: M6), `src/road-events.js` (set the instances), `src/main.js`.
Checker: `start('goblin')` (the Goblin himself is still missing: bombs appear from a point at (aimX, 3.5, -13)). "Look at" of M6.

### 11 Yeşil Cin model — `visual-spec`
Files: `src/models/goblin.js` (new: M7.1–M7.4), `src/road-events.js` (M7.5 + shadow), `src/main.js` (create, add hidden, `textures` into the `warmUp` list).
Checker: `start('goblin')` at 3 km and at top speed, portrait and landscape; also `viewer.html` if it takes a model by name. "Look at" of M7.

### 12 Comic FX for rows and events — `visual-short`
Files: `src/fx.js` (one handler per row of M8), `src/vfxCore.js` (3 stickers).
Checker: each handler once (rows from task 3's console lines, events from `start`); particle pools never run dry during a Goblin raid (blast + reward together); `prefers-reduced-motion` still weakens shake and flash (fx.js:24).

### 13 Switch on: zones, HUD, captions, missions — `routine`
Files: `src/road-events.js` (install `obstacles.hooks.onEventZone`), `src/ui.js` + `ui.css` + `index.html` (D.5: banners, `ev-caption`, gauge `h-event`), `src/pickup-art.js` (`drawPowerIcon` branch `event`), `src/missions.js` (D.6: six pool entries, typed listeners for `rowPass`, `eventDodge`, `eventEnd`).
Asserts: for sets 1..80 every new mission's goal is `<=` its `max`; `rowPass {type:'gap'}` bumps only `gapJump`; `eventEnd {clean: false}` and `{aborted: true}` do not bump `eventClean`; a caption id is shown once and never again after a reload of `spidey.seen`, and a broken `spidey.seen` value counts as "nothing seen"; the HUD QA script finds `#h-event` and it follows `state.eventBonusTime`; a zone crossed on a real generated track starts the event (`eventStart`) and a zone crossed while swinging does not.
Checker: a full run past 3.5 km in the browser: both events arrive on their own, banners and captions do not overlap the mission toasts (same queue), the gauge fits the row of power gauges on 360 × 740.

### 14 Sound hooks — `routine` (audio owner)
Files: the audio module(s) only. One sound per row of the "Sound" column in D.4, registered under the event's own name so the existing auto-subscribe picks it up; the tension layer follows `state.eventKind`. No game code changes.

### 15 Measure and map — `routine`
Record the E "done when" numbers in the vault / PLAN notes; add the new files, events, state fields, CONFIG groups and the `spidey.seen` key to `tasarim/HARITA.md`.

## G Open questions (not checked in code; the coder or checker answers each before or during its task)

| # | Question | Task | If the answer is no |
|---|---|---|---|
| Q1 | Does `facePatch`'s `deform` take the unit-sphere point and may it scale it (as M7.2 row 12 assumes)? See how `spiderman.js` / hero models call it. | 11 | build the face patch with radius 0.44 and apply only `roundCube` + the x stretch the same way those models do |
| Q2 | What is fx.js's function for showing a WORDS sprite (name, arguments)? M8 says "word `hop` at …". | 12 | use `sticker()` with a new `STICKERS` entry of the same text |
| Q3 | Does anything else call `cameraRig.setDolly` (wall.js does for `camBack`)? The director resets it to (0, 0) at an event's end. | 8 | reset only if `!game.wall.active`, which `_calm()` already implies while an event runs: confirm |
| Q4 | How does `tools/test-skills.mjs` build `Obstacles`, `Chaser` and the player headless, and does the `three` stub cover what `road-events.js` uses (`Vector3` only)? | 2, 7 | extend `tools/stub-hooks.mjs` |
| Q5 | Is Cap's surf height really >= 0.25 m for the whole surf (so "Cap surfs over gaps" always holds)? | 2 | either accept a hit at the surf's start / end or lower `pitTop` to 0.3 |
| Q6 | Does shop.js bank `state.coins` at game over (so reward coins are kept)? | 7 | emit what the shop listens to |
| Q7 | Does a non-uniform instance scale (`gapHole`, `gapPatch` stretched in z) shade correctly with the toon material? Only top faces show. | 3 | build five fixed lengths (4, 4.5, 5, 5.5, 6) instead of scaling |
| Q8 | Portrait framing of the reared tendril (C2 / C3 at y ~5) and of the Goblin's station (0, 3.5, -13) at the largest camera scale (2.2): both were computed, not seen. | 8, 11 | move them with the *(tune)* numbers |
| Q9 | Audio `MIN_GAP` throttling: are two `bombBlast` in one frame and a run of `eventDodge` ticks handled? | 14 | audio owner's call |
| Q10 | A player on a wagon roof or in a wall run passes through the gate's truss / posts for a frame. Accepted as is? | 3 | raise the truss to 5.2 m |

## H Decisions for the manager

| # | Decision taken in the design | Alternative |
|---|---|---|
| D1 | Gap and gate span all three lanes (no lane escape); they are rare (one row per ~390 m) and telegraphed from the horizon. | per-lane versions (then they are a `low` and a `high` with new paint) |
| D2 | An event hit is a stumble; the second mistake is a catch. Venom forgives the first hit of his own event himself. | a hit ends the run (harsher, shorter events) |
| D3 | Reward: coins (`5 / 6` per dodge, `+25 / +30` flawless) and `game.mult.event` = +3 flawless / +1 survived for 12 s. A new field, because `mult.temp` belongs to the tracer. | only coins; or route it through `mult.temp` and change tracer.js to add / subtract instead of assign |
| D4 | Six new missions; adding them replaces every player's currently open set once (level and set number stay). | add fewer, or none in this stage |
| D5 | Until 11.3: first event due at 1.2 km (Venom), the Goblin at ~3 km, then alternating every 1.4 – 2.2 km. | Goblin first / random kind |
| D6 | Cap's shield surf crosses gaps without jumping (falls out of the numbers; kept as a perk). | raise `pitTop` above the surf height |
