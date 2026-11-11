VERDICT: NEEDS FIXES

Check of stage 11.5, coding tasks 1–7 (three row obstacles, collisions, art, spider-sense, fairness
rules, pure event maths, the Venom director). Checker only: nothing below was fixed.
Design authority: `tasarim/11-5-gorevler.md` (tasks, E budget, Q1–Q10, D1–D6).

## Defects

1. **bug** — Cap's shield surf ending above a rail gap ends the run.
   `src/powerups/hero-specials.js:899-905` drops the player with `floorY = Math.max(0, floorY - 0.32)`;
   a pit never supplies a floor (`src/obstacles.js:421`), the pit exemption only holds while the special
   is still active (`src/obstacles.js:457`), so the next `_collide` takes the fall-into-pit branch
   `part.pit && py0 >= prevTop` → `kind = 'front'` (`src/obstacles.js:477`) → `crash` → `onFrontHit` →
   `src/main.js:102` dispatcher (special no longer active) → Iron Spider absorb only if charged →
   otherwise game over. Expected: D6 (`11-5-gorevler.md:172`) — the surf crosses gaps without jumping;
   this also answers open question Q5 (`:156`): the surf height is 0.32 m standing / 0.22 m sliding
   (`hero-specials.js:444-449`) against `gap.pitTop = 0.35` (`config.js:162`), so mid-surf is safe only
   because of the explicit exemption. Fix direction: keep the exemption for the exit frame (grace
   ~0.1 s at `_capExit`), or let an active surf supply the pit top as a floor, or delay the exit until
   the player is off the pit.
2. **polish** — dead fields and an unimplemented number in the director: `cameraRig` is stored and never
   used (`src/road-events.js:15`), `this.zone` is written and never read (`:27`), `events.venom.dolly: 1.6`
   (`src/config.js:392`) has no effect. Consistent with the task-7 handover ("dolly is deliberately not
   set"), but `ilerleme-11-5-kod.md:186-188` already warns task 8 about ownership.
3. **polish** — `start()` only accepts `'venom'` (`src/road-events.js:46`) while `_begin`, `update` and
   `_venom` read `E[zone.kind]` then hardcode the venom tempo (`:78` `V.duration`, `:87`), so a `'goblin'`
   zone handed to the director would run venom timing. Correct today (task 9 not written); do not let it
   survive task 9.
4. **polish** — per-frame allocation inside the slam window: `_lanes()` returns a fresh array
   (`src/road-events.js:150`) and is called every frame of the 0.12 s slam while un-hit (`:108`, `:113-114`),
   about 7–8 arrays per strike; `_position()` (`:151`) a fresh object per emit. Against the E budget rule
   "per-frame code allocates nothing"; discrete-event payloads are allowed, the slam-frame call is not.
5. **polish** — `src/powerups/ironspider.js:184` places the ironSave VFX at `y = -0.325`, a value that
   assumes a solid bar; absorbed over a `gap` part the spark draws inside the hole.
6. **polish / doc** — `tasarim/11-5-yol-surprizleri.md:172` states 0.75 m of air above the girder beam;
   `girder.bottom 0.3` + `top 2.1` + `length 4.4` (`config.js:164`) gives 0.6 m over the covered lane.
   Code, the M3 recipe and the checker agree with each other; the design sentence is the outlier.
7. **hygiene (CHECK 2)** — the tree mixes three work packages. 11.5: 11 modified code/tool files
   (+1130/−135) and untracked `src/event-logic.js`, `src/road-events.js`. Unrelated: 7 modified
   `tasarim/11-2-*.md`, 9 modified `tasarim/proto/11-2-*`, `tools/` proto check (+416/−135), untracked
   `11-2-inceleme.md`, 8 `tasarim/11-3-*.md`, 4 `proto/11-3-*`, `YOL-HARITASI.md`. `tasarim/ilerleme-11-5-kod.md`
   belongs with the 11.5 commit. No stray build output, no scratch file, no new dependency.

## CHECK 1 — commands (run exactly, nothing appended)

`node tools/test-skills.mjs` → last line `OK 213346 checks`
`node tools/check-patterns.mjs` → last line `OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.`
`node tools/check-quality.mjs` → last line `OK: adaptive resolution`
`node tools/test-audio.mjs` → last line `OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 38)`
All four passed. The `peak music` number is printed only (`tools/test-audio.mjs:207`), never asserted, and
it varies run to run (36 / 38 observed).

## CHECK 2 — git status

See defect 7. Nothing in the 11.5 set is unnecessary; every src/tools file the tasks name is present.

## CHECK 3 — tasks 1–7

| Task | State | Evidence |
|---|---|---|
| 1 config, state, helpers | DONE | `config.js:162-165` row groups + `373-395` events; `game.js:33-35`, `:45`, `:224` `(base+run+temp+event)*factor`, `:237` reset; `patterns.js:105-107` descLength, `:124` AFTER_TIME, `:128` descLanes, `:136` girderOffset; `test-skills.mjs:53-73` |
| 2 collisions | DONE | `obstacles.js:212-244` group/owner/pool flags, `:313-325` remove + mates `z = 1e6` + patch, `:342-351` rowWarn/rowPass, `:411-434` pit not a floor, `:457`/`:477` pit rules, `:301-310` grace/eventHit; all 13 assert groups present at `test-skills.mjs:1146-1280` |
| 3 obstacle art | DONE, visual check pending | `obstacle-art.js:40` `ry`, `:281-397` nine recipes, `:488-496` nine kinds with the E capacities, `:505` addRow, `:523` addPatch; recipe/hull/capacity asserts at `test-skills.mjs:1321-1388`; the coder recorded the browser as unavailable (`ilerleme-11-5-kod.md:72`) |
| 4 spider-sense | DONE | `sense.js:203` girder is a wall, gate is high (`:273`), `:134` real Euler/swept step, `:131-` pit skipped in the floor loop, `:329-345` two-lane fallback; asserts `test-skills.mjs:1281-1320` |
| 5 generator + checker | DONE | `patterns.js:192-224` due dispatch, `:345` `_row`, `:361` `_placeRow`, `:387` `_eventZone`; `check-patterns.mjs:98+` C1–C14; asserts `test-skills.mjs:76-103`; summary line reports rows/km and zones/km as task 5 demands |
| 6 event logic | DONE | `event-logic.js:8,9,11,12,13,16,34,43`; property asserts `test-skills.mjs:104-142` |
| 7 director | DONE | `road-events.js:11/24/39/45/64/87/140/153/162/173`; `chaser.js:76/131/139/149/216/235`; `main.js:163-165`; asserts `test-skills.mjs:1389+` |

Director decisions: D1 gap/gate span all three lanes — as designed (`patterns.js:128-134`); D2 event hit
= stumble, second = catch — as designed (`obstacles.js:307-310` → `_hit` side path, `chaser.hunt()` + one
`spare`); D3 `game.mult.event` +3 clean / +1 survived for 12 s — as designed (`event-logic.js:43-46`,
`road-events.js:153-160`, `config.js:389-390`); D5 first Venom at 1200 m, Goblin next, alternating every
1400–2200 m — as designed (`config.js:374-375`, `patterns.js:394-395`); D6 Cap surf crosses gaps — **not**
as designed (defect 1); D4 missions and the reward field are task 13, correctly untouched.

## CHECK 4 — fairness, the part that matters most

Not weakened. The route search, the reaction-margin rule and the cell model in `tools/check-patterns.mjs`
are the same code path for old and new obstacles: `gap` is an all-lane JUMP cell, `gate` an all-lane SLIDE
cell, the girder's two parked BLOCK lanes plus the free outer lane take part in the search, and the swing
is sampled over `tau −0.2 … 1.2` in both directions. C3 keeps the analytic ≥ 0.15 s jump window and adds a
positive Euler/swept jump window at `CONFIG.dtCap` — an extra condition, not a relaxed one. No existing
rule was special-cased away and no CONFIG tuning number was changed to reach OK. The three spacing edits
`ilerleme-11-5-kod.md:116-123` lists are all *more* conservative and each is sound: row-combo partner moved
to `routeNext` (+`v*0.6+1` m of run-up), zone start `+1` m, zone `laneFree` filled to `end+1` m so a rounded
cell cannot touch the inclusive zone end. Measured on the default run (150 seeds × 38 424 m): gap 0.7/km,
gate 0.7/km, girder 0.6/km, rows 2.0/km, zones 0.5/km, lowest minute margin 0.45 s against the 0.4 s floor.

## CHECK 5 — interactions

- Iron Spider absorb: intact. Every outcome still goes through `_hit` (`obstacles.js:486-504`) and `main.js:102-126`
  wraps the previous hook instead of replacing it; the row path adds no new absorb route.
- Flights and the wall run: immune, and not by luck — `wall.js:182` re-arms `grace(0.2)` every frame,
  `skillBatman.js:264` `grace(0.4)`, `:472/:486` `grace(1.5)`; `_collide` returns at `obstacles.js:437-438`
  while `_graceTimer > 0`. So the exact boundary (wall feet at `wall.height 3.2` → `y0 = 3.3` vs
  `gate.bottom 0.95 / top 3.3`, `config.js:163`, `:341`) is unreachable; `FLY_ALTITUDE 3.6`
  (`skillBatman.js:23`, `skillHelloKitty.js:137`) sits above the gate either way.
- Magnet and coin placement: `magnet.js:85-117` selects coins by the z/x window at any height and ignores
  obstacle type, so the gap-arc and gate-slide coins are pulled normally; `_placeRow` coins go through the
  existing `_coinRow`/`_routeCoins` path (`patterns.js:361-385`, `:489-517`).
- Obstacle-smashing specials: `hero-specials.js:819-879` calls `obstacles.remove` / parks mates; the row
  group path (`obstacles.js:313-325`) keeps the single-patch rule (`group.patched`) and the pool flags
  (`:227-246`), and the reverse-index clear that `ironspider.js:178` does is covered by a test
  (`test-skills.mjs:1146+`).
- Spider-sense: gap → jump, gate → slide, girder → one or two lane actions depending on the start lane,
  the two-lane escape only accepting a middle lane whose earliest wall is later than
  `2 * laneSwitchTime + 0.08` and a far lane that simulates to `Infinity` (`sense.js:329-345`).
- Pools and limits: the checker's instance capacities equal the nine art kinds' constructor capacities
  (`obstacle-art.js:488-496`: 3 each, `girderPad` 6) and stay reserved across a patch's lifetime.
- Hook chaining: no hook is assigned without calling the previous one (`obstacles.js:9-16` documents it,
  `main.js:102-126` and `decoy.js` follow it); `onEventZone` stays the default no-op (`obstacles.js:153`).
- Open questions answered here: **Q5** no — see defect 1; **Q6** yes, reward coins are banked
  (`game.js:147` emits `gameover {score, coins, distance}` → `shop.js:219-222`); **Q10** unreachable —
  a row or a zone consumes the whole block (`patterns.js:216-224`) and `_placeRow` drains all three lanes,
  so no wagon roof or wall run can be beside a gate.
- Not a defect although it looks like one: a zone is generated every ~2 km and does nothing, leaving
  ~300 m of empty track. `11-5-gorevler.md:79` states this is intended until task 13.

## CHECK 6 — reset rules

Clean. `game._resetRun()` (`game.js:230-258`) zeroes `mult.event` (`:237`) and calls every system's
`reset()`; `RoadEvents.reset()` (`road-events.js:24-38`) clears zone, active, strike, t, cooldown, hits,
dodged, outroAt, `eventKind/eventTime/eventBonusTime/mult.event` and re-seeds its RNG, and its constructor
subscribes to `gameover` (`:18`). `Obstacles.reset()` (`:172-189`) clears `patches`, `_graceTimer` and
`_sideHitTimer`. A halt mid-swing or mid-lunge: `_hit`'s crash path locks controls, the director ends the
event aborted without a reward (`:66-70`, `:76-78`), and the girder/gate art is rebuilt from `tau` every
frame with nothing retained, so no visual state survives. A test replays 100 paused frames and gets the
same volley as the unpaused run.

## CHECK 7 — performance rules

Passed on every binding rule: no light is added anywhere in the diff; the nine new kinds and their
outlines are built inside `createObstacleArt` with the shared `material` / `outlineMaterial`
(`obstacle-art.js:488-496`) and are compiled by the existing warm-up; `addRow`/`addPatch` reuse two
closure-level `Matrix4` temps (`:499-500`, `:505-527`) and allocate nothing per frame. Only defect 4
(small allocations during a 0.12 s slam window) touches the budget. Draw-call and frame-time numbers on
the test phone are not measured — task 15.

## CHECK 8 — test quality

The asserts are real, not vacuous: `eq(draws, 2, 'each row consumes exactly two draws')`, a brute-force
recomputation of `delta`, monotonic `warnAt`/`restAt`, `doubleChance` bounds, `rewardFor` exact objects,
`o.z === 1e6` for parked mates, `group === null` on a reused pooled collider, `rowWarn` exactly once at the
first frame with `tau <= 2.4`, sense swept over `dt ∈ {1/120, 1/60, 1/30, dtCap}` × 19/26/39 m/s, and the
recipes run through `node:vm` against the real builder counting primitives, hulls and capacities.
213 346 is the number of `eq`/`ok` calls executed (`test-skills.mjs:17-19`, printed at `:1538`); almost all
of it comes from task 6's property sweep (7 distances × every non-empty mask × every valid aim × 500 draws
× ~5 asserts) plus the `girderOffset` sweep. Cost: the whole file runs in 1.1 s — no slowdown. The jump from
1 747 (task 4) to 213 101 (task 6) is that sweep, not diluted checking.

## CHECK 9 — HARITA.md

The coder's rewrite is accurate; line refs I verified (road-events 11/24/39/45/64/87/140/153/162/173, the
eight event-emission lines, obstacle-art 40/474/481-496/505/523, patterns 128/136/192/345/361/387, sense
131/203/300/329, event-logic 8-43) all match. Three statements were stale or incomplete and are now patched:
§5's "the generator does not emit rows yet" (false since task 5 — replaced with the zone-hook/no-op fact),
§5's descriptor paragraph (the `patterns.js:6-13` header comment still lists only pre-11.5 kinds; the four
new descriptor forms are recorded in HARITA and flagged there), and the stub pointer `41-56` → `41-66`.

## Left for a human on a phone

Everything visual: M1–M3 "Look at" lists (a hole must read as a hole at 39 m/s, signs and gate signals from
the horizon, shutter down by 1.6 s, the green girder lane visibly clear in both swing directions in portrait
360 × 740 and landscape, on a straight and in a curve), the non-uniform instance shading (Q7), portrait
framing of tall things (Q8), and the E budget's draw-call / frame-time recording (task 15). Headless checks
test no GPU.
