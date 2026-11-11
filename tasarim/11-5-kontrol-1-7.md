VERDICT: READY TO COMMIT

Re-check after the fix pass on stage 11.5, coding tasks 1–7 (three row obstacles — rail gap, signal
gate, swinging crane girder — their collisions, instanced art, spider-sense support, the fairness
rules in `tools/check-patterns.mjs`, the pure event maths and the Venom event director; events are not
switched on yet). Authority: `tasarim/11-5-gorevler.md`, `tasarim/11-5-yol-surprizleri.md`,
`tasarim/11-5-olaylar.md`, `tasarim/11-5-modeller.md`; the repair handover is
`tasarim/ilerleme-11-5-kod.md`. Checker only: nothing below was fixed by me.

## Earlier defects — re-verified against the code, not against the handover

| # | Was | Now |
|---|---|---|
| 1 (bug) | Cap shield-surf exit over a rail gap ended the run | fixed: `src/powerups/hero-specials.js:674-675` grants `obstacles.grace(0.1)` at `_capExit`, and the regression is real — `tools/test-skills.mjs:1281-1305` drives the actual `HeroSpecials` prototype over a 6 m pit at 19/39 m/s × 1/120 s and dtCap × sliding/standing, asserting no crash and that the gap survives (`patches.length === 0`). |
| 2 (polish) | dead `cameraRig`/`this.zone`/`venom.dolly` | fixed: constructor takes `art = {}` only (`src/road-events.js:11-21`), `reset()` owns `eventKind/eventTime/eventBonusTime/mult.event` (`:23-34`), no `dolly` key in `CONFIG.events.venom` (`src/config.js:391-392`). `setDolly` has no event caller (`src/camera.js:54`, callers `wall.js:105,134`, `skillSpiderman2002.js:182,333`). One stale doc number remains → defect 4. |
| 3 (polish) | `'goblin'` handed to the director would run venom tempo | fixed: `start(kind)` rejects any kind but venom (`src/road-events.js:44`) and `tools/test-skills.mjs:1569` asserts `director.start('goblin') === false` plus "Goblin logic belongs to task 9". The whole task-9 rewrite is recorded in `tasarim/ilerleme-11-5-kod.md` and `tasarim/HARITA.md:363`. |
| 4 (polish) | allocation every frame of the slam window | fixed: the slam hit test scans the deadly mask numerically (`src/road-events.js:110-111`) and `_lanes`/`_position` run only for discrete payloads (`:149-150`); `tools/test-skills.mjs:1562-1568` replaces both helpers with throwing functions and runs three unhit slam frames — a real regression, not a count assert. |
| 5 (polish) | ironSave spark inside a hole | fixed: `src/powerups/ironspider.js:184` uses `part.pit ? 0 : (part.y0 + part.y1) / 2`. |
| 6 (doc) | girder clearance stated 0.75 m | fixed: `tasarim/11-5-yol-surprizleri.md:172` now says 0.6 m and quotes the checker's `>= 0.5 m` clause over `[-0.2, 1.2]`, which matches `tools/check-patterns.mjs:203-212` and `CONFIG.obstacles.girder` (`src/config.js:164`). |
| 7 (hygiene) | three work packages mixed | excluded by the user; the tree is now 11.5-only (see CHECK 2). |

## Defects found in this pass

1. **polish** — `tools/check-patterns.mjs:212` is a vacuous clause: `hd / speedAt(P.rows.girderAt -
   O.spawnDistance) > G.lockTime` with `hd = CONFIG.playerDepth / 2 = 0.3` (`:166`),
   `speedAt(1540) ≈ 22` and `lockTime = 1.2` gives 0.014 s; the test could only fire below 0.25 m/s,
   which the speed curve never reaches (`src/config.js:10-21`). Comment says "the beam may overlap the
   player longitudinally only inside the locked interval", the code checks no such thing. Expected: a
   passability proof, not a tautology. Fix direction: either drop it, or intersect the actual
   longitudinal overlap window of a girder row (`d - hd … d + len + hd`) with the parked interval and
   fail when any part of it falls outside `[-0.2, lockTime]`.
2. **polish** — `tools/check-patterns.mjs:334` (C11) hardcodes `v * 7` while the generator suppresses
   pickups for `CONFIG.events.pickupClear = 9` s (`src/patterns.js:330`, `src/config.js:379`). The
   checker therefore proves a narrower clearance than the code enforces; a regression to 8 s still
   prints OK. Same shape at `:335` (C12) where `endD + E.rowClear - 1` grants 1 m of undocumented slack
   against `src/patterns.js:396`. Fix direction: read `E.pickupClear`/`E.rowClear` and keep any fudge
   in one named constant with a comment.
3. **polish** — the girder's fairness rests on its collider being static per lane: `_placeRow` parks
   the beam over the covered lane and `open` names the free outer lane (`src/patterns.js:361`,
   `descLanes` `:128`), while the swing is art only (`girderOffset` `src/patterns.js:136`,
   `src/obstacle-art.js:505-521`). That is a legitimate design decision, but nothing in the checker or
   the tests says so: `C6` (`tools/check-patterns.mjs:317-320`) proves the approach and landing lanes
   and `C7` proves the art pose, and neither would fail if task 8 made the collider follow the swing.
   Fix direction: leave as-is for 11.5 but record the invariant in `tasarim/HARITA.md:312` (already
   "art only") as a hard rule task 8 must extend C6/C7 before moving any collider.
4. **polish / doc** — `tasarim/11-5-yol-surprizleri.md:84` still lists `dolly: 1.6` in the CONFIG block
   it proposes, while `src/config.js:391-392` has no such key and no code reads one. Expected: the
   design's number to describe the shipped tree, or the key to exist. Fix direction: delete the field
   from the design snippet or mark it "task 8".
5. **polish** — `src/powerups/hero-specials.js:675` fixes defect 1 with a general 0.1 s collision
   grace, which silences every hit in that window (at 39 m/s the player crosses ~3.9 m — enough to
   pass a gate shutter 0.35 m deep or a girder 0.5 m deep, `src/config.js:163-164`), not only the pit.
   The pit-only behaviour the design asks for is the exemption that already exists while the surf is
   active (`src/obstacles.js:457`). Expected: only a pit may not punish the exit frame. Fix direction:
   extend the surf exemption to "surf just ended and still dropping" in `_collide` instead of a global
   grace, or shrink the grace to the frames the pit actually spans.

Nothing here blocks the commit: no crash, no unwinnable track, no state leak, no allocation or pool
violation.

## CHECK 1 — commands (run exactly, nothing appended)

- `node tools/test-skills.mjs` → last line `OK 213388 checks`
- `node tools/check-patterns.mjs` → last line `OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.`
- `node tools/check-quality.mjs` → last line `OK: adaptive resolution`
- `node tools/test-audio.mjs` → last line `OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)`

All four exit 0; none refused. `peak music` is printed only (`tools/test-audio.mjs:207`) and varies
(36 now, 38 in the previous pass) — not an assertion.

## CHECK 2 — git status

16 modified (`src/chaser.js`, `src/config.js`, `src/game.js`, `src/main.js`, `src/obstacle-art.js`,
`src/obstacles.js`, `src/patterns.js`, `src/powerups/hero-specials.js`, `src/powerups/ironspider.js`,
`src/powerups/sense.js`, `tools/check-patterns.mjs`, `tools/stub-hooks.mjs`, `tools/test-skills.mjs`,
`tasarim/11-5-yol-surprizleri.md`, `tasarim/HARITA.md`, `tasarim/ilerleme-11-5-kod.md`) and exactly the
two intended new files (`src/event-logic.js`, `src/road-events.js`); +1294/−355. No stray build
output, no scratch file, no new dependency, no `package.json`/`node_modules`. Git reports CRLF
normalisation warnings on 7 files — informational, pre-existing.

## CHECK 3 — tasks 1–7

| Task | State | Evidence |
|---|---|---|
| 1 rail gap (all-lane jump cell, pit) | DONE | descriptor/colliders `src/patterns.js:345-360`, `src/obstacles.js:54-57` (`pitTop 0.35`, `pit: true`), group spawn `src/obstacles.js:212-221`, pit never supplies a floor in the real collision
(`src/obstacles.js:411-434`) and in the sense simulation (`src/powerups/sense.js:143`); 0.7/km in the checker. |
| 2 signal gate (all-lane slide cell) | DONE | `src/obstacles.js:59-62` (`bottom 0.95`, `top 3.3`, `depth 0.35`), shutter drop art `src/obstacle-art.js:505-521`, 0.7/km. |
| 3 crane girder (two-lane, parked collider) | DONE | `src/obstacles.js:64-67`, `girderOffset` `src/patterns.js:136`, art pivot/pads/arrows `src/obstacle-art.js:488-496,505-521`, 0.6/km, weights `src/config.js:469`. |
| 4 collisions and row events | DONE | `src/obstacles.js:198-244` (group, one `owner`, pool reuse clears `owner/warned/passed/hit/open`), `313-326` (mates to `z = 1e6`, one `gapPatch` per group), `342-351` (`rowWarn` at tau ≤ 2.4, `rowPass` only when nothing hit). |
| 5 spider-sense | DONE | pit never used as floor `src/powerups/sense.js:143`, front hit for a pit `:197`, swept tail `:192`, Player-matching Euler step `:134`, girder as wall `:203`, gate as `high` `:276`, action order `:277`, two-lane escape `:329-345`; sense exercised at 120/60/30/20 FPS in `tools/test-skills.mjs:1323-1362`. |
| 6 fairness rules | DONE with defects 1–2 above | `tools/check-patterns.mjs:166-212,317-335` (C3 swept Euler jump window, C6 approach/landing, C7 swing/lock, C8–C12 zone rules, capacity accounting). |
| 7 pure event maths + director | DONE | `src/event-logic.js:8-43`, `src/road-events.js:10-172`, chaser hunt/spare/pose `src/chaser.js:84-86,131-147,151,304,312`, state/mult `src/game.js:33-35,45,224,237`, wiring `src/main.js:163-165`. Director is manual-venom-only by decision; `onEventZone` remains a no-op (`src/obstacles.js:153,211`). |

Design numbers vs code, all agreed: rows first at 600 m, gates 1100 m, girders 1700 m, 260–520 m apart,
combo 0.4 (`src/config.js:461-469`); first event at 1200 m (`:374`) matches the "first Venom lunge at
1.2 km" decision, and Goblin zones alternate from the same schedule (`src/patterns.js:387`) with the
first Goblin raid near 3 km; gap and gate span all three lanes (`descLanes` `src/patterns.js:128`); an
event hit is a stumble and the second a catch (`src/chaser.js:135` `spare = 1`, `:149-163`,
`src/road-events.js` hits through `obstacles.eventHit` `:307`); the reward uses `game.mult.event` with
+3 flawless / +1 survived for 12 s (`src/config.js:389-390`, `src/road-events.js:152-160`); Cap's surf
crosses gaps by the explicit exemption (`src/obstacles.js:457`) plus exit grace (`hero-specials.js:675`).

## CHECK 4 — fairness (the important one)

`node tools/check-patterns.mjs` → `checked 150 seeds x 38424 m (18.6 s); per km: coin 202.6, wagons
12.3, pickup 4.0, low 9.4, high 9.3, train 8.1, car 9.5, gap 0.7, gate 0.7, girder 0.6, event 0.5`,
rows 2.0/km, zones 0.5/km, coins covering ≥2 lanes 44% (3 lanes 12%), worst per-minute reaction margin
0.45 s from km 10 on (limit 0.4). Max simultaneously alive instances `gapHole/ends/patch/gateFrame/
gateShutter/girderBeam/girderJib 1, girderPad 2, girderGo 1` inside pools 3/3/3/3/3/3/3/6/3.

The rules prove passability rather than asserting it: the gap is modelled as an all-lane JUMP cell whose
clear window must exceed the swept Euler jump (`tools/check-patterns.mjs:196-200`, i.e. the real
`Player` integrator, including a 20 FPS tail), the gate as an all-lane SLIDE cell, and the girder keeps
two lane-change windows to its open lane with the swing pose sampled at `tau ∈ [-0.2, 1.2]` (`:203-212`,
`:317-320`). Route search and the per-minute margin bisection are untouched: `git diff
tools/check-patterns.mjs` is 104 added lines with **no existing rule deleted or loosened** — the only
concern is the two clauses above (defects 1 and 2), which under-test rather than over-test. No
special-case for the new types exists: `empty()`/`mark()` and the cell typing are shared by all kinds.
Spacing numbers changed from the design: none. `gapMin/gapMax/gapEndless`, `firstAt/gateAt/girderAt`,
`comboChance`, `pickupClear 9`, `rowClear 120`, `endMargin 1.0`, `bonusTime 12` all read as designed;
the girder's 0.6 m clearance (not the design's earlier 0.75 m) is sound — it is `top 2.1` against a
1.5 m apex and the checker only claims `>= 0.5 m` horizontally.

## CHECK 5 — interactions (read, not run)

- Iron Spider absorb: dispatcher still first (`src/main.js:102-113`), front hits route through
  `obstacles.hooks.onFrontHit` → `iron._absorb`; a pit front hit is absorbable and now draws at deck
  level (`src/powerups/ironspider.js:184`). The absorb sweep iterates `obstacles.active` backwards and
  calls `remove()`, which is group-safe (`src/obstacles.js:313-326`; asserted with mixed
  gap+gate+low groups at `tools/test-skills.mjs:1229-1235`).
- Flights / wall run / zip immunity: the director refuses to start while any of them owns height or
  speed (`src/road-events.js:37-40`) and aborts mid-event if one takes over (`:74`).
- Magnet and coin placement: `src/powerups/magnet.js:107` pulls coins in every lane at any height,
  which is required for rows whose coins sit over a pit or under a gate; the generator keeps coin
  profiles per km unchanged (202.6/km). Rows are placed only with their full run-up, so a magnet flight
  never turns a row into a dead end.
- Obstacle-smashing specials: `src/powerups/hero-specials.js:542-555` and `:820-868` remove colliders
  through `obstacles.remove()` + `grace()`, so groups, one patch per group and `rowPass` suppression all
  hold (asserted `tools/test-skills.mjs:1229-1240`).
- Spider-sense auto-dodge: gap → jump, gate → slide, girder → lane (wall-classified, `sense.js:203`);
  the two-lane escape at `sense.js:329-345` is what makes the `doubleChance` rows survivable without
  input, and skips during zip/locked controls (`:260`) so it cannot fight a flight.
- Hook chaining: `obstacles.hooks` defaults at `src/obstacles.js:149-159`; chaser installs side-stumble
  and crash (`src/chaser.js:57-58`), decoy wraps `onSideStumble` and calls the previous one
  (`src/powerups/decoy.js`), `main.js:102-119` chains front/side absorb and `absorbCatch` to Iron
  Spider, and RoadEvents only ever calls `obstacles.eventHit` (`:307`) — no hook is replaced without
  invoking the prior owner. Verified by the chained-hook asserts at
  `tools/test-skills.mjs:1571-1575` ("decoy consumes its spare before Venom is told", "next hit reaches
  Venom through wrapper").

## CHECK 6 — reset rules

Pause and hit-stop freeze the whole event clock (`game.js:182-190` returns before any system update;
`road-events.js:63` refuses to tick outside `running`). A halt mid-girder-swing or mid-Venom-lunge
aborts the event (`road-events.js:51-54,74` → `_end(true)` → `chaser.endHunt`, `spare/hunting/pose`
cleared `src/chaser.js:139-143`) and `beforePlayer` never runs while halted (`game.js:195`), so no
`rowWarn`/`rowPass`/spawn fires against a frozen world. `game._resetRun` zeroes
`eventKind/eventTime/eventBonusTime` and `mult.event` (`game.js:33-35,237`) and calls every system's
`reset()` (`:255`), which returns parked mates and pooled colliders, clears `patches`, coins, pending
trains, pickups and both row timers (`obstacles.js:172-189`), clears the sense timer
(`sense.js:226-230`) and the chaser's spare/hunting/pose (`chaser.js:76-91`). One cosmetic residue:
`RoadEvents.reset()` re-seeds its own rng from `obstacles.seed` (`road-events.js:34`), so a restart
re-plays the same strike sequence — deterministic by design, and only the director stream shifts by one
run. The camera dolly is left only by its real owners (`wall.js:134`, `skillSpiderman2002.js:182`); no
event writes it. No camera or warning state can outlive a run.

## CHECK 7 — performance rules

Nine new instanced kinds are built once at load (`src/obstacle-art.js:488-496`, capacities
3/3/3/3/3/3/3/6/3 matching the E budget), inside the existing `begin/add/addRow/addPatch/addCoin/end`
contract (`:505-527`) that reuses a module-level `Matrix4` — no per-frame allocation, no material or
texture creation. No dynamic light was added (`src/lights.js:7-15` unchanged in the diff). Obstacle
shapes go through the existing `shapeCache` keyed `type|cars|ramp|gap-len` (`src/obstacles.js:101-117`),
so gap length variants do not rebuild geometry. Sense's simulation writes into preallocated slots and
matches Player's Euler step (`src/powerups/sense.js:131-134`). The event path allocates nothing in the
slam window (`src/road-events.js:110-111`, guarded by the throwing-helper test). Colliders are pooled and
`_addObstacle` resets all row flags on reuse (`src/obstacles.js:242-243`).

## CHECK 8 — test quality

577 `eq(`/`ok(` call sites, whole suite in 1.17 s wall clock — the suite is not slow. The 213 388 count
is dominated by one loop: `tools/test-skills.mjs:115-131` runs 7 distances × 12 valid
`(mask, aim)` pairs × 500 draws of `nextRow` with 5 assertions per draw ≈ 210 000 of the total; the
remaining ~3 400 come from everything else (e.g. the 20 km generator replay at `:86-96`, the row
harness at `:1148-1280`, sense at four frame rates at `:1323-1362`, the art-matrix recipes at
`:1363-1430`, the director lifecycle at `:1431-1570`). The repair pass added 42 checks (213 346 →
213 388); stage 11.1's suite was at 1 002, so the growth is all 11.5 and all of it is in the
draw-count loop, not in new redundancy.

The new asserts are real, not vacuous: they drive the actual `Player`, `Obstacles`, `Chaser`,
`HeroSpecials` and `RoadEvents` classes through the headless harness (`tools/test-skills.mjs:1148-1182`,
`tools/stub-hooks.mjs` stubs only `three`, `world.js`, `curve.js` and the two art modules), and they
assert on counts (`eq(h.crashes, 1)`, `eq(rowCount('rowPass'), 0)`, "not every frame" at `:859`), on
geometry (`eq(h.player.floorY, 0)`), on ordering (`beforePlayer must not award a pass before that
collision`), and on allocation (`:1562-1568`). Weak spots worth knowing: the instanced art itself is
covered only by recipe/matrix asserts at `:1363-1430` because `obstacle-art.js` is stubbed headless —
visual correctness is a human check; and `this.dodges` (`sense.js:212,354`) is a test-only counter that
`reset()` does not clear, harmless today because the director test injects its own stub
(`tools/test-skills.mjs:1459`).

## CHECK 9 — HARITA.md

`tasarim/HARITA.md` was already updated by the coder and every 11.5 claim in it was re-verified line by
line against the code; nothing needed changing and I made no edit to it. Checked: file map rows
(`:15` main.js systems 163-165 ✓; `:16` game.js 33-35/45 ✓; `:21` obstacles.js 126/149-160/264/411/437/525
✓, `eventHit` at 307 within the cited 305 ✓; `:22` obstacle-art 481-498 kinds (real 481-496), `addRow`
505 ✓, `addPatch` 523 ✓; `:25` road-events 11/23/37/43/62/139/152/161/172 ✓, "85 volley" is the
`_venom` body (declaration at 84 — within the map's usual ±1 pointer tolerance); `:26` chaser
43/76/131/139/149/172/235/326 ✓; `:58` sense 131/203/226-255/300/329/349 ✓; `:52` hero-specials 674 ✓;
`:34` `:349` order ✓). Obstacle types and descriptor forms §5 (`:292-296` ✓, `descLanes` `[0,1,2]` for
gap/gate and `[1, 2 - open]` for girder ✓), hooks and pools §5 (`:265-290` ✓ incl. mates parked at
`z = 1e6` and one patch per group), events §7 (`:351-363` ✓: manual-venom-only, no zone hook, dolly and
Goblin deferred to tasks 8/9, S.2 reward timing), CONFIG §14 (`:566` rows 162-166 ✓, `:581` events
372-395 ✓ with no `dolly`), tools §15 (`:593-596` ✓) and §12 capacities (`:524` caps 3/3/3/3/3/3/3/6/3
at 488-496 ✓).

## What passed

All four required commands green; tree clean and 11.5-only; tasks 1–7 DONE; fairness proven by an
independent cell/route model with no existing rule weakened and only 150-seed numbers matching the
design; interactions read end to end with correct hook chaining; reset/halt/pause leak-free; no dynamic
light, no per-frame allocation, everything instanced or pooled; new tests exercise the real classes.

## What only a human on a phone can judge

Whether the gap lip, gate shutter and swinging girder read as obstacles at 2.4 s of warning on a
5-inch screen; whether one swipe is enough for the two-lane girder escape; whether the pit art and its
patch look like a hole in the deck rather than a shadow; whether Venom's lunge and the 0.45 s margin at
endless speed feel fair in the thumb, and whether the `rowWarn`/`strikeWarn` audio-visual cues (task 12
and 14) land before the collision.
