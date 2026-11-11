# Current run — 11.3 Chinatown finished: wall dragons, lifecycle audit, corrective sweep, task 11 (2026-11-11)

Only this top section is current status; everything below the `---` is archived history. This run took the ordered work the previous run stopped in front of and finished it: the 2g wall dragon, the 2h lifecycle and no-collider audit, the corrective sweep of sections 1–3 and K1–K10, and approved task 11. All four baseline checks pass after every step. No commit, no new library, no build step, no save write or migration, no character lock, no relaxed fairness rule.

Files changed here: `src/config.js`, `src/city-tex.js`, `src/city-chinatown.js`, `src/city-dragon.js`, `src/patterns.js`, `src/city-logic.js`, `tools/test-skills.mjs`, `tools/check-patterns.mjs` (task 11 placement rules only), `tasarim/HARITA.md`, `tasarim/11-3-kaplamalar.md` and this file. The foreign `tools/scratch-wallpeak.mjs` reported by the previous run is no longer in the workspace; this run left no temporary file. `git diff --check` exits 0.

## The 2g blocker, paid with the design's own cut ladder

The previous run stopped because a K9 wall head plus the shared glyph/banner pools could not fit the extension share at the design's `hash % 4 === 0` density: it measured 24592 triangles against the 20000 share (`tasarim/11-3-chinatown-ek.md:10`). Nothing was silently retuned. The ladder at `:156-163` is what the design says to do when it does not fit, and the progress-file note below is what it says to record.

Measured peak simultaneous wall heads over the real 300-chunk city, with the resulting extension total (`CONFIG.city.dragon.wallEvery` → heads → triangles): 4 → over; 6 → 18 → 24592; 8 → 14 → 20608; 9 → 14 → 20608; **10 → 12 → 18616 fits**. Cuts 3 and 4 together (rings 12→9, drop the dance outline) save only 144 + 2324 = 2468 triangles, so density is the only lever that can pay for a 1000-triangle head anywhere near 1-in-6. Installed: cut 2, wall dragons head-only with no rings and no tail fan (`src/city-dragon.js:78`), and cut 1 deepened to one head per ten facades (`wallEvery: 10`, `src/config.js:483`). Signs and banners were not cut, as the ladder requires. The wall head is 996 triangles, inside the 1000 cap and the `≤ 1000` target (`:76`); the dance head is 1856, inside its `≤ 3000`.

## Ordered checkpoints

| Step | Result before proceeding |
|---|---|
| 1 baseline | DONE — four checks pass; test-skills OK 323222 checks; patterns 150 seeds × 38424 m, margin ≥ 0.4 s |
| 1b no building dots | DONE — test-skills OK 323256 checks; asserts at `tools/test-skills.mjs:1596`, `:1603`, `:1607` |
| 2g wall head | DONE under the cut ladder — `src/city-dragon.js:78` `wallGeometry()`, `src/city-chinatown.js:34` head pool, `src/config.js:483` density; budget assert `tools/test-skills.mjs:2075` |
| 2h lifecycle + no-collider audit | DONE — `tools/test-skills.mjs:2005`–`:2032` |
| corrective sweep of §1–§3 / K1–K10 | DONE — geometry and texture halves verified, non-changes listed below |
| task 11 | DONE — `tools/test-skills.mjs:230`–`:249` (11.1), `:251`–`:269` (11.2); frequencies below |

## Task 11 — rows placed only in their home district

`ROW_HOME = { gap: ['bridge'], gate: ['tunnel'], girder: ['midtown', 'neon', 'dawn'] }` lives in `src/city-logic.js:16`. Both endpoints of the placed row must be inside the home list (`src/patterns.js:355`), after the existing unlock distances (`:354`). When the no-repeat rule empties the table, the same call retries once without it (`:359` `fresh.length ? fresh : homes`). Chinatown places no row: the block returns null, the block stays ordinary, the row stays due (`nextRowD` untouched) and the one existing RNG roll is still consumed, so downstream streams are not re-timed (`src/patterns.js:360`). Asserts: both Chinatown windows at 1600 m and 2400 m, the roll-consumption equality, and the single-home retry at 2800 m (`tools/test-skills.mjs:230`–`:249`).

Zone kind is now `goblin` iff the zone starts in Neon, otherwise `venom` (`src/patterns.js:402`), and a zone that would overlap the tunnel window `base+3340 … base+3700` returns null and stays due (`:403-405`). `tools/check-patterns.mjs` was extended with the two new invariants (home district per row endpoint, no zone inside a tunnel), which is a task-11 fairness change, not a Chinatown scenery change: the collider table `patterns.js` still contains no dragon, banner, tassel or Chinatown word, asserted at `tools/test-skills.mjs:2030`, and design `:7`'s "scenery is never an obstacle" holds.

Frequencies after task 11, over 150 seeds × 38424 m: **row obstacles/km 1.4 (was 2.0), event zones/km 0.5 (unchanged)**, coins in ≥ 2 lanes in 40 % of 20 m stretches (3 lanes: 9 %), every seed passable, margin ≥ 0.4 s everywhere. The row fall is the expected consequence of gating two of three row types to districts and is recorded as expected, not a failure (`tasarim/11-3-gorevler.md:201`).

## Corrective sweep — what was checked and what was deliberately not changed

Confirmed conforming against `tasarim/11-3-chinatown-ek.md` §1–§3 and K1–K10: the eight stroke characters, 10×10 grid, round caps/joins and width 1.1 (`src/city-tex.js:751`); red/gold alternation by `hash % 2` (`src/city-chinatown.js:50`); adjacent-differ and meaningful-pair sign seeding (`src/city-chinatown.js:15-21`); the horizontal banner cloth, five notches, gold border and `大吉大吉` (`src/city-tex.js:767`, `:778`); the rope sag, shared lantern lift and sway-by-matrix-only with one shared glyph pool (`src/city-pieces.js:85-87`, `src/city-chinatown.js:37`, `:53`); the 40 % vertical banners at `hash % 10 < 4` with their gold tassel (`src/city-chinatown.js:62-69`); the dragon's eight colours, three materials only, shared toon gradient, merged vertex colours (`src/city-dragon.js:9`, `:113`, `:114`, `src/city-chinatown.js:29`); the dance head/jaw/fan/rings/pole recipes and their wave, axis, clearance and 60/16 m window (`src/city-dragon.js:14`, `:134-160`); the scale texture built once at load (`src/city-dragon.js:108-112`).

Deliberate non-changes, each with the reason:

- `src/city-tex.js` still does not import `CONFIG`. It is a dependency-free canvas module that the node sandbox and several painters load directly; pulling config in would change that contract to read two constants. The doubled gold stroke at `:778` was annotated instead of rewritten, because the clip keeps exactly the designed 0,06 m.
- The legacy `glyph()` facade noise is shared by Midtown and Neon signs, is not a Chinatown rule, and stays.
- `VERTICAL_CHARACTERS` includes a pattern that repeats one character over three cells (`大吉大`). K4 asks for four fixed seeded three-glyph patterns and gets four; the repeat is inside the approved shape, so it stays.
- `addOutline` keeps its own cached ink material. It is existing house machinery shared with obstacles, its draw calls are inside the 12-call extension share, and replacing it would add a fourth Chinatown material, which K1 forbids more strongly.
- K6's "if there is no lantern string, every 24 m" fallback is unreachable: `ctDress()` in `src/city-pieces.js:81-87` always lays two lantern strings plus the rope for both variants. No dead branch was added for a case the city cannot produce; the normal midpoint cadence is what runs and what is asserted.
- Two unread config fields (`border`, `notch`) were deleted from `CONFIG.city.chinatown` (`src/config.js:482`); the banner geometry hardcodes them.

## Implemented-bullet checklist

| Item | Status and file:line |
|---|---|
| §1 red/gold, exact strokes, grid, seed, adjacent differ, pairs | DONE — `src/city-tex.js:751`; `src/city-chinatown.js:15`, `:50`; `tools/test-skills.mjs:1960`–`:1968` |
| §2 banner cloth/notches/border, rope sag, shared lift, sway matrix-only, single pool | DONE — `src/city-tex.js:767`; `src/city-pieces.js:85`; `src/city-chinatown.js:37`, `:53`; `tools/test-skills.mjs:1988`, `:1993` |
| §2 vertical banners 40 %, tassel, shared glyph family | DONE — `src/city-chinatown.js:62`–`:69`; `tools/test-skills.mjs:1974`–`:1977` |
| §3a–d dancer: colours, materials, parts, wave, axes, clearance, window | DONE — `src/city-dragon.js:9`–`:72`, `:134`–`:160`; `tools/test-skills.mjs:2037`, `:2046`–`:2055` |
| §3e wall dragons: head-only, facade-mounted, 4,5 m above base, 0,7 scale, 15° nose-down bake, one pool, shared material | DONE — `src/city-dragon.js:78`–`:106`; `src/city-chinatown.js:34`, `:58`–`:60`; `tools/test-skills.mjs:1978`–`:1999` |
| K1 three materials, created once, merged vertex colours | DONE — `src/city-dragon.js:113`, `:114`; `src/city-chinatown.js:29`–`:31` |
| K4 three atlas sources, fixed vertical patterns | DONE — `src/city-tex.js:319`, `:767`, `:788`, `:797` |
| K5 old cells, both faces, seeded UV, colour and pair hashes | DONE — `src/city-chinatown.js:10`–`:21`, `:49`–`:50` |
| K6 midpoint cadence and clearance above max player top + 1 m | DONE — `src/city-pieces.js:85`; `src/city-logic.js:5`; `tools/test-skills.mjs:1988` |
| K7 vertical placement, offset 0,1 m, top at base + 6, tassel below | DONE — `src/city-chinatown.js:62`–`:69` |
| K8 dance anchor 1700 + seed % 100, side parity, outside fence | DONE — `src/city-dragon.js:135`–`:139`; `src/config.js:483` |
| K9 wall head ≤ 1000 at 0,7, combined eye disc, branchless horns, 4+4 teeth, 4 beard, 6 mane, `hash % wallEvery` | DONE — `src/city-dragon.js:81`–`:103`; 996 triangles; density deepened per the ladder above |
| K10 no colliders, no scenery words in the pattern table, no per-frame `new`, preallocated transforms | DONE — `tools/test-skills.mjs:2029`–`:2032`, `:2055` |
| 2h lifecycle: start/gameover/menu leave zero instances and hide every mesh; restart re-seeds from nothing; recycle drops and replaces exactly one segment's own signs, tassels and heads; dispose empties the wall pool | DONE — `tools/test-skills.mjs:2005`–`:2027` |
| Task 11.1 home districts, both endpoints, unlocks, no-repeat retry, due row, existing roll | DONE — `src/patterns.js:349`–`:370`; `tools/test-skills.mjs:230`–`:249` |
| Task 11.2 goblin iff Neon, tunnel overlap stays due | DONE — `src/patterns.js:399`–`:405`; `tools/test-skills.mjs:251`–`:269` |
| 150 seeds × 30 km district/endpoint/zone/determinism asserts | DONE — `tools/check-patterns.mjs` (new home-district and tunnel invariants), `tools/test-skills.mjs:227` |
| Human acceptance: characters legible, overhead banner, one dance, occasional wall head | NOT DONE — no browser or phone pass was run in this session |

## Kendi kararlarım

- Cut 1 was deepened from the ladder's 6 to 10 facades, with the measured 8/9 → 14 heads → 20608 numbers pinned into the assert message at `tools/test-skills.mjs:1970`, so nobody re-tightens it without re-measuring.
- The budget assert was never weakened. When the suite went red at 24592, the cause was a concurrent edit that had set `wallEvery: 6`; the fix was the design's ladder, not the cap.
- Cut 2 (head-only) was taken before cuts 3 and 4, because those two together cannot pay for 1-in-6. K9's wall body rings and tail fan offsets are therefore unimplemented by design, not forgotten.
- The wall head bakes a 15° nose-down pitch and mounts at facade fraction 0,9 along its depth so it stands clear of the vertical-banner band; both are asserted from the instance matrix rather than from prose.
- The Chinatown test fixture now gives each segment two facades (real chunks have up to five) and every per-segment proxy sums over buildings. Seeding coverage no longer depends on hash luck, which is what made a 1-in-10 density look broken when it was not.
- `districtEvent`, day-cycle and dot removal from step 1b were re-read and still match the design; only the two dead config fields and the border annotation changed under the sweep.
- Task 11 touched the generator and its fairness checker. That is the approved task, not the Chinatown work; the scenery remains collision-free and `check-patterns.mjs`'s fairness thresholds are unchanged.

## Budget — computed by the harness, not measured on a phone

Owner ceiling 150 calls / 250 000 triangles / 60 000 000 texture bytes (`src/config.js:481`). Completed Chinatown share: **12 calls, 18 616 triangles, 3 932 160 bytes (≈ 3.93 MB)**, peak 12 wall heads over 5-facade chunks. Whole stage: 117 calls, 182 394 triangles, 42 991 608 bytes (≈ 42.99 MB). Dance dragon 4 792 triangles (head 1 856, jaw 140, fan 40, 12 rings × 24, 6 poles × 24). Asserts: `tools/test-skills.mjs:2075` (own share) and `:2076` (owner ceiling). No renderer.info or device measurement was taken.

## Last check lines

- `node tools/test-skills.mjs`: OK 323598 checks — `Chinatown computed bounds: {"buildingMax":5,"wallPeak":12,"extensionCalls":12,"extensionTriangles":18616,"extensionTextureBytes":3932160,"stageCalls":117,"stageTriangles":182394,"stageTextureBytes":42991608}`
- `node tools/check-patterns.mjs`: checked 150 seeds × 38424 m (18.1 s); row obstacles/km 1.4; event zones/km 0.5; coins in ≥ 2 lanes in 40 % of 20 m stretches (3 lanes: 9 %); OK: every seed has a passable route; reaction margin ≥ 0.4 s everywhere.
- `node tools/check-quality.mjs`: OK: adaptive resolution
- `node tools/test-audio.mjs`: OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)
- `node --check`: exit 0 for `src/config.js`, `src/city-tex.js`, `src/city-chinatown.js`, `src/city-dragon.js`, `src/city-pieces.js`, `src/city-logic.js`, `src/city.js`, `src/daycycle.js`, `src/patterns.js`, `tools/test-skills.mjs`.

## Phone review — not performed

Still owed by a human: `?gun=0` and `400` (same facade set, no dots), `1700`/`2100` golden Chinatown, `3700` Neon with Goblin zones, `4300`, `5500` dawn. In Chinatown the eye characters must be legible, the overhead `大吉大吉` readable, exactly one dance visible and a wall head only occasionally — now genuinely rare at one per ten facades.

Next coder: the ordered 11.3 coding scope is complete. What remains is human acceptance in the browser and on the phone, and tasks 9/10 (steam, festival cadence), which are still absent from the source for their own documented contradictions — do not read the lantern cadence or the K6 fallback as finished work. Everything below this line is archived.

---

# Archived run - STOPPED before task9 runtime work (2026-11-11)

Step1 and B1/B2/B3 are complete. Raised budget verified. Task9 cannot satisfy all its steam numbers; task10 was not started, preserving the ordered dependency and explicit stop rule. No commit, new library, build step, save write/migration, character lock or generator/fairness change. Prior uncommitted work is preserved below as history. R2 is accepted (wall cap1200); this run did not resume separate2g wall-head work.

## Task9 blocker - exact steam recipe exceeds its fixed pool

Binding recipe tasarim/11-3-canli-ayrintilar.md:53 places vents on variants1/5/9, active at segment z[-120,+10], up to3 live, producing a puff every0.28s with life3.4s. Pool capacity24 is src/config.js:486 and the acceptance limit is tasarim/11-3-canli-ayrintilar.md:97. Three continuously active vents need at least3*floor(3.4/0.28)=36 simultaneous puffs. The higher GPU budget does not change this explicit24-instance limit.

A read-only20-minute diagnostic used the actual mulberry32/seed424242 and300-spec sequence (src/city.js:55,:624), segCentre (src/city-logic.js:15), districtAt and speedAt (src/patterns.js:66), dt1/60. It aged/released puffs at3.4s, accumulated a0.28s timer per eligible serial, and conservatively capped eligible vents at3. First demand25 at t42s / d594.523049m (current vents serial36/37, variants1/5; older puffs still alive); peak37 in20minutes. No diagnostic file remains.

Dropping/stealing live puffs changes life or emission cadence; choosing fewer emitting vents changes the recipe; raising24 changes the pool/assert; using one global0.28s timer changes per-vent cadence. No compromise was invented. No task9 runtime pool, partial scene, or knowingly failing acceptance test was installed. Resume task9 after a manager decision on capacity, lifetime, cadence or which vents emit, then task10.

## Ordered checkpoints

| Step | Result before proceeding |
|---|---|
| Step1 baseline | four checks pass; test-skills OK323840 checks |
| B1 | four checks and touched JS syntax pass; OK323846 checks |
| B2 | four checks and touched JS syntax pass; OK323209 checks |
| B3 | four checks and touched JS syntax pass; OK323220 checks |
| Final menu cleanup / deletion of obsolete hull expansion | four checks and all8 touched JS/MJS syntax pass; OK323222 checks |

Counts fall when checks over deleted hull primitives/old contrast recipes are replaced with the new acceptance assertions. No fairness check was weakened.

## Final item and implemented-bullet checklist

| Item / bullet | Status and file:line |
|---|---|
| Step1 four exact checks; fix failures first | DONE - tools/test-skills.mjs:1; tools/check-patterns.mjs:1; tools/check-quality.mjs:1; tools/test-audio.mjs:1; no failure |
| B1 exact0.45*sqrt(tone), one formula for every facade | DONE - src/config.js:479; src/city-tex.js:565; shared U src/city.js:518 |
| B1 radius/spacing<=0.45 assert; initial/recycled dress equal | DONE - tools/test-skills.mjs:1553,:1559,:2017,:2022 |
| B2 every hanger bottom within0.02m of rail top at same z | DONE - src/city-pieces.js:127; tools/test-skills.mjs:1837,:1841 |
| B2 one0.08-cube0x222222 clamp/hanger, all in one InstancedMesh | DONE - src/city-pieces.js:128; src/city.js:531; tools/test-skills.mjs:1840,:1849,:1851 |
| B2 cable endpoints within0.05m of actual tower tops | DONE - src/config.js:480; src/city-pieces.js:117,:123; tools/test-skills.mjs:1845,:1848 |
| B2 load/warm-up, reset/gameover/menu/dispose cleanup | DONE - src/city.js:531,:661,:707,:727,:747,:764; src/warmup.js:69; tools/test-skills.mjs:2036 |
| B3 delete obstacle hull construction and cosmetic coloured edges | DONE - src/obstacle-art.js:36,:216,:277,:440. Generic optional shell serves only coin geometry; no obstacle returns a shell |
| B3 existing shared material, emissive=colour*k; no tint/new material/instance-colour change | DONE - src/obstacle-art.js:441,:470; src/daycycle.js:27; src/config.js:481 |
| B3 day0 / tunnel0.18 / night0.18 / linear existing phase/tunnel blend | DONE - src/daycycle.js:28; tools/test-skills.mjs:1521 |
| B3 non-emissive type unchanged and listed | DONE - tools/test-skills.mjs:1527. All actual obstacle bodies share the existing emissive-capable toon material, so none lacks emissive. Separate coin rim is MeshBasicMaterial and unchanged |
| B3 no cosmetic frame/outline/hull pass asserts | DONE - tools/test-skills.mjs:2051,:2087. Physical signal-gate structure and girder remain actual obstacles |
| Budget ceiling single-source150/250000/60000000, no old ceiling duplicate | DONE / already set - src/config.js:482; tools/test-skills.mjs:1966 consumes it; tools/check-quality.mjs:1 has no stage ceiling |
| Allowed design budget lines already raised | DONE / verified unchanged - tasarim/11-3-gorevler.md:213,:215; tasarim/11-3-sehir.md:20 |
| Task9 blimp model/banner/glyph atlas/HUD UVs | NOT DONE - ordered stop at steam contradiction; tasarim/11-3-gorevler.md:175 remains pending |
| Task9 pigeon geometry/placement/obstacle rejection/burst/event and deterministic flockAt | NOT DONE - same stop; tasarim/11-3-canli-ayrintilar.md:17 |
| Task9 gull event/flight/peel-away/shared bird pools | NOT DONE - same stop; tasarim/11-3-canli-ayrintilar.md:41 |
| Task9 steam placement/cadence/life/radius/colour/geometry | NOT DONE - incompatible24-pool demand, tasarim/11-3-canli-ayrintilar.md:53,:97 |
| Task9 bird/puff20-minute/reset and flock asserts | NOT DONE - cannot honestly assert exact steam demand<=24; tasarim/11-3-canli-ayrintilar.md:94,:97 |
| Task10 record fireworks/tape/tunnel wait/Goblin suspension | NOT DONE - task9 blocked; tasarim/11-3-gorevler.md:187 |
| Task10 rain/snow/wet sheen/reduced motion | NOT DONE - task9 blocked; tasarim/11-3-canli-ayrintilar.md:74 |
| Task10 loopFlavor/weatherAt/celebrationKind and400-loop share asserts | NOT DONE - task9 blocked; tasarim/11-3-gorevler.md:187 |
| Task10 festival cached plans, reuse existing lantern/banner sets and align K6 | NOT DONE - task9 blocked; inherited normal K6 assertions still pass, tools/test-skills.mjs:1905 |
| Map changed roles/CONFIG/events/tests | DONE - tasarim/HARITA.md:22,:34,:39,:105,:515,:538,:599,:610 |
| Task11 | NOT DONE by scope; src/patterns.js:1 unchanged |
| Browser/phone and renderer.info acceptance | NOT DONE - no rendering/device measurement in this run |

## Kendi kararlarım

- B1 retained existing shared uDotRadius, with sole CONFIG coefficient0.45; no clamp/second formula.
- B2 actual tower top32.8 is existing cornice32.5+0.6/2; cable uses that CONFIG value. Deleted old0.3m cable span overrun so endpoints meet exactly.
- B2 reuses createBoards' fixed swap-remove pool for box clamps; warm-up draws one instance. Existing event cleanup is shared by gameover/menu; no hook is replaced.
- B3 normalizes existing p.rim by NIGHT.rim0.8, blends to1 with the existing tunnel factor and multiplies by0.18; phase timing/linear interpolation stays intact.
- B3 deletes cosmetic hulls/hull-only boxes, yellow ramp edges, patch end rims and gate yellow trim; actual hazard faces/physical gate/girder structures and coin rim remain.
- No steam compromise chosen. R2 resolves old wall900 cap; separate wall-head work is outside this run's ordered items.

## Budget - computed upper bounds, not renderer.info

Single CONFIG ceiling150 calls /250000 triangles /60000000 net texture bytes (src/config.js:482). Checker city baseline-relative bound105 calls, installed extension11, conservative installed-stage bound116 calls /170442 triangles /42991608 bytes (~42.99MB). Bridge plain/glow max936 triangles plus16 clamps*12=192: total1128/segment, same as before; one global clamp draw replaces merged boxes. B3 removes calls/triangles; no saving was credited. No texture cut or old-ceiling fallback. Task9/10 resources are absent: these are installed-stage bounds, not certification of unfinished tasks or phone measurements.

## Last check lines

- node tools/test-skills.mjs: OK 323222 checks
- node tools/check-patterns.mjs: OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
- node tools/check-quality.mjs: OK: adaptive resolution
- node tools/test-audio.mjs: OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music36)
- node --check: exit0 for src/config.js,src/city-tex.js,src/city-pieces.js,src/city.js,src/daycycle.js,src/obstacle-art.js,src/warmup.js,tools/test-skills.mjs. No scratch files or commit.

## Human phone review / next coder

- ?gun=0 and400: exact0.45*sqrt(tone) shadow dots on initial/recycled facades; inspect windows/bricks at portrait resolution.
- ?gun=2700 and3100: each hanger lands on its one dark clamp/railing at the same z; cables reach both tower tops.
- ?gun=3500 and4300: no obstacle outline pass/yellow trim; shared body emission times0.18. Name next obstacle lane at20 and39m/s; no phone acceptance claimed.
- Restart, pause/resume, gameover->menu and fresh run: no clamp or glow residue. Capture renderer.info at0/1450/2800/3500/3650/4300 and target-phone adaptive resolution.
- ?gun=10300 remains future task10 rain review. Resolve steam capacity, then9, then10. Task11 untouched.

---

# Earlier run — STOPPED at 2g / wall-dragon triangle contradiction (2026-11-11)

Step 1 and 2a–2f are complete in order. Stopped at 2g under the owner's instruction to stop when an item cannot be finished cleanly. 2h and task 11 are NOT complete. No commit, new library, build step, save write/migration, character lock or lost progress. src/patterns.js and tools/check-patterns.mjs are unchanged.

The inherited handover below says tasks 9–10 were NOT implemented (the latest earlier attempt stopped at B1). This differs from the current request's assumption. This run did not add those tasks or revisit B1/B2/B3. It extends the existing task-5 lanterns and signs; no second set was made. Festival ctFest exists as a recipe but remains unselected because task 10 is absent.

## 2g blocker — fixed K2 geometry cannot fit the wall-head limit

K2 requires BOTH skull and nose to be SphereGeometry(0.5,16,12): tasarim/11-3-chinatown-ek.md:115. Each has 2*16*(12-1)=352 triangles, total704. K9 fixes two eyes, branchless horns, 4+4 teeth, four beard cones and six mane slices: tasarim/11-3-chinatown-ek.md:149. The wall head is one InstancedMesh, including its static 20-degree jaw: tasarim/11-3-chinatown-ek.md:102. Its <=900 cap is at tasarim/11-3-chinatown-ek.md:101.

Even EXCLUDING the whole jaw, a deliberately underestimated head-only count is 704 + 6*8 (six specified four-sided mane cones) + 4*8 (upper teeth only) + 2*6 (minimum 3×2 eye spheres) + 2*12 (minimum three-sided closed horns) + 2*6 (minimum nostril spheres) + 12 (lip box) + 6*6 (minimum blue mane-tip spheres) + 2*6 (minimum red pompom spheres) + 2*12 (minimum closed pompom stems) = 916. This excludes all iris discs, brow/cheek patches, eyelids, pearl and the entire lower jaw, lower teeth, tongue and beard. Thus the blocker holds whether the900 cap counts the jaw separately or together. K9 changes the listed counts; it does not remove the remaining explicitly required facial parts. A0.7 scale does not reduce triangles; mergeGeometries concatenates rather than simplifies. Reducing K2 tessellation, deleting listed parts, or raising900 requires overriding a binding decision. No substitute/partial wall decoration was installed. The cut order reduces instance counts or whole bodies, not the triangle count of one required head, so it cannot solve this contradiction. No cut was applied.
## Ordered checkpoints (all four checks + node --check before the next sub-step)

| Step | test-skills last line | Other checks |
|---|---|---|
| 1 baseline | OK 241011 checks | patterns margin >=0.4 s; quality/audio OK |
| 2a glyph atlas + raised budget | OK 241192 checks | same four checks and touched JS syntax passed |
| 2b existing sign squares | OK 308258 checks | same |
| 2c horizontal banners/sway | OK 308271 checks | same |
| 2d facade banners/tassels | OK 308278 checks | same |
| 2e dragon model/rings/scale map | OK 308358 checks | same |
| 2f dance/window + physical sway correction | OK 323839 checks | same; final eight-cell nonempty assertion checked below |

The final small sway correction accounts for nonuniform plane scale, so the physical angle is exactly ±3 degrees; the matrix assert checks this (tools/test-skills.mjs:1915). No timing/colour was retuned.

## Final item and design-bullet checklist

| Run item / design bullet | Status and file:line |
|---|---|
| Step 1: four checks, fix failures first | DONE — tools/test-skills.mjs:1; tools/check-patterns.mjs:1; tools/check-quality.mjs:1; tools/test-audio.mjs:1; no baseline failure |
| 2a / §1: all eight exact stroke tables 大 吉 中 山 日 王 火 木 | DONE — src/city-tex.js:766 |
| §1: 10×10 grid, round caps/joins, width1.1, quadratic offset0.6 outward | DONE — src/city-tex.js:777; trace asserts tools/test-skills.mjs:25 |
| K4: 1024×256, eight128² cells in each colour row, 80% centred/grid0.08 | DONE — src/city.js:500; src/city-tex.js:777 |
| 2b / K5: every existing square, both faces, seeded UVs/colours, adjacent characters differ, meaningful pairs | DONE — src/city-pieces.js:93; src/city-chinatown.js:10; src/city-chinatown.js:15; src/city-chinatown.js:40; tools/test-skills.mjs:1894 |
| 2c / §2: red0xc8102e, gold0xf6c445, height0.9, road width+0.5 each side, five0.2 m cuts,0.06 m border | DONE — src/city-tex.js:799; src/city-chinatown.js:35; src/config.js:483 |
| §2: 大吉大吉,70% character height, half-character gaps, separate1024×128 source | DONE — src/city-tex.js:811; src/city.js:502 |
| §2: dark0x3a2a1a rope, sag0.25, matching lantern suspension/lift | DONE — src/city-pieces.js:85; src/city-logic.js:5; src/city-pieces.js:51 |
| §2/K6: every second existing string then midpoint;24 m fallback if none | DONE for current normal dressing — src/city-chinatown.js:35; existing rows always exist; no24 m fallback is needed. NOT DONE for a future selected festival: task10 is absent and its three-row cadence is not connected |
| §2: ±3°,0.7 Hz, per-instance phase, matrix-only sway, one glyph/banner InstancedMesh | DONE — src/city-boards.js:44; src/city-chinatown.js:49; tools/test-skills.mjs:1915 |
| K6: bottom >= highest player top+1; lift lanterns and banners together if needed | DONE — src/city-logic.js:5; src/city-pieces.js:51; tools/test-skills.mjs:1909; current lift0, tip10.1 >=8.8+1 |
| 2d/K7: hash%10<4; facing facade; fraction0.2+0.6*hash/2^32; topbase+6; offset0.1 | DONE — src/city.js:280; src/city.js:652; src/city-chinatown.js:51 |
| §2/K4/K7:0.5×2.2 vertical cloth, four fixed three-character128×512 patterns, gold Cone(0.06,0.2,6) point up | DONE — src/city-tex.js:820; src/city-tex.js:829; src/city.js:507; src/city-chinatown.js:32; src/city-chinatown.js:59 |
| K1: exactly three NEW materials; shared toon gradient; merged vertex-colour parts | DONE — glyphMat src/city-chinatown.js:29; dragonMat/scaleMat src/city-dragon.js:82; shared painter/merge src/city-pieces.js:14 and src/city-pieces.js:31. Existing Spider INK material is reused from its cache |
| 2e/3a: all eight exact palette colours | DONE — src/city-dragon.js:9 |
| 3b/K2: skull/nose ellipsoids with exact sizes and front/down offset; gold lip, two black nostrils | DONE — src/city-dragon.js:26 |
| 3b: separate0.72×0.16×0.8 jaw at lower-rear hinge, dark interior,0.3×0.05×0.5 tongue, gold pearl r0.1 | DONE — src/city-dragon.js:53; src/city-dragon.js:109 |
| 3b: six upper/six lower four-sided teeth r0.05,h0.13 | DONE — src/city-dragon.js:57 |
| 3b: white eyes r0.22 at specified coordinates; blue iris0.13, black pupil0.065, gold half-torus0.22/0.04 | DONE — src/city-dragon.js:31 |
| 3b:0.6 m horns r0.06,30° rear/15° outward,0.3 m branches45° | DONE — src/city-dragon.js:35 |
| 3b:0.015×0.25 pompom stems, red0xe11d48 r0.08 tips | DONE — src/city-dragon.js:38 |
| 3b/K3: ten Cone(0.12,0.45,4),z-scale0.3; z=-0.45,r0.45; theta=-135+30k; rear30°; alternating gold/orange, blue r0.05 tips | DONE — src/city-dragon.js:46 |
| 3b: blue brow/cheek domes r0.18,z-scale0.3, white0.02 rims | DONE — src/city-dragon.js:40 |
| 3b: seven cream beard cones r0.03,h0.35, backward lean | DONE — src/city-dragon.js:62 |
| 3b: main head <=3000 triangles | DONE — 1856 head +140 jaw =1996; tools/test-skills.mjs:1937 |
| 3c:12 exact open Cylinder(0.42,0.42,0.7,12,1,true) in one pool | DONE — src/city-dragon.js:71; src/city-dragon.js:91 |
| 3c:256² red/gold/orange/dark-contour scales and yellow bottom12% fringe | DONE — src/city-tex.js:834; src/city-dragon.js:77 |
| 3c: final3 radii0.8/0.6/0.4 and five0.5 m fan cones | DONE — src/city-dragon.js:12; src/city-dragon.js:64; src/city-dragon.js:116 |
| 3c: poles every2 rings, wood r0.04,h2.2, hidden lower ends behind fence, one pool | DONE — src/city-dragon.js:69; src/city-dragon.js:118 |
| 2f/3d/K8: once per crossing;1700+seed%100, parity side, external fence+sideOffset1.0, face toward runner/body forward | DONE — src/config.js:484; src/world.js:40; src/city-dragon.js:14; src/city-dragon.js:101 |
| 3d: exact vertical/lateral waves, base fence+1.2+radius; head uses same wave at index-1 | DONE — src/city-dragon.js:14 |
| K8: ring interval0.75, axes toward previous;0 points at rear head point | DONE — src/city-dragon.js:112 |
| 3d/K8: existing curved-world placement | DONE — src/city-dragon.js:84 uses normal InstancedMesh/materials; existing shared shader hook src/curve.js:48 bends them; no CPU bend/double offset |
| 3b/3d: jaw25° ±10°,0.6 Hz | DONE — src/city-dragon.js:108; tools/test-skills.mjs:1956 |
| 3d: visible60 m before to15 m behind; outside Chinatown false | DONE — src/city-dragon.js:102; tools/test-skills.mjs:1949 |
| 2g/3e/K9: wall head <=900; two combined-disc eyes, branchless horns,4+4 teeth,4 beard,6 mane,scale0.7 | NOT DONE — K2 plus retained parts exceeds900; blocker above, tasarim/11-3-chinatown-ek.md:115 and :149 |
| 3e/K9: hash%4===0, base+4.5, forward tilt, static20° jaw; one head InstancedMesh | NOT DONE — stopped at wall-head contradiction |
| 3e/K9: four0.7 rings in existing body pool at(0.8,-0.3)/(1.5,-0.1)/(2.2,-0.4)/(2.9,-0.2), fan(3.5,-0.3) | NOT DONE — stopped before installing partial wall dragons |
| 2h/Kabul: all eight occupied glyphs; adjacent sign characters differ | DONE during2a/2b — tools/test-skills.mjs:36; tools/test-skills.mjs:1894 |
| Kabul: banner clearance; entire oriented dance rings outside lane/fence bounds at wave extremes | DONE during2c/2f — tools/test-skills.mjs:1909; tools/test-skills.mjs:1943 |
| Kabul: Chinatown-only visibility | DONE for installed glyph/banner families and dancer — tools/test-skills.mjs:1917; tools/test-skills.mjs:1952; wall dragons NOT DONE |
| Kabul: restart/gameover/menu leave nothing | DONE in code for installed pieces — src/city-chinatown.js:64; src/city-chinatown.js:71; src/city-dragon.js:131; pool/clear asserts tools/test-skills.mjs:1919 and :1960. NOT DONE on a real browser/phone; full event-lifecycle soak is not claimed |
| K10: no collider; no scenic generator/fairness edit; only matrices/jaw during frames, no new | DONE in implementation — src/city-chinatown.js:77; src/city-dragon.js:101; src/city-boards.js:44. NOT DONE as the requested final dedicated no-collider assert audit:2h was not reached |
| Loading/warm-up: all textures/materials/geometries exist before run | DONE — src/city.js:500; src/city-dragon.js:76; src/warmup.js:66 |
| 2h complete acceptance sweep | NOT DONE — stopped at2g; browser/phone visual acceptance also pending |
| Raised owner budget, only two allowed design budget edits, remove old-ceiling cut | DONE — src/config.js:482; tools/test-skills.mjs:1780; src/city.js:697; tasarim/11-3-gorevler.md:213; tasarim/11-3-sehir.md:20. check-quality had no old ceiling |
| Map rows updated for changed roles/locations | DONE — tasarim/HARITA.md:18; tasarim/HARITA.md:35 |
| Step3/task11: ROW_HOME; endpoint masks/unlocks; no-repeat retry; ordinary-block fallback and same roll | NOT DONE — ordered run stopped at2g; src/patterns.js untouched |
| Task11: Goblin iff Neon; tunnel-overlap zone deferral; unchanged spacing | NOT DONE — ordered run stopped at2g |
| Task11:150 seeds×30km district/determinism assertions and new per-km frequencies | NOT DONE — task11 not started. Existing unchanged generator still reports rows2.0/km and zones0.5/km; these are baseline, not new frequencies |

## Kendi kararlarım

- K5 left hash unspecified: reused the living-detail design's sine hash127.1/43758.5453, tuple segmentId*32+sign*8+cell, converted to uint32; never consumes the track RNG.
- Three-cell signs alternate their meaningful pair, repeating its first character in cell3; both faces agree. Existing0.02 m marks become planes at outer surface z±0.11.
- K1 permits one glyph material while K4 needs separate source canvases: preserve exact character/horizontal/vertical source sizes and copy pixels into one1024×896 GPU sheet, no mipmaps/linear filter (existing Bugle precedent); cone tassels sample one gold background pixel. No canvas work during a run.
- Existing normal rows alternate10/8/12 m; after every second row the next midpoint is local z=-10. No24 m fallback is needed because current dressing always has strings. No festival cadence was invented for absent task10.
- Rope uses the existing two-straight-half construction,0.25 m sag,8.4 m span. Alpha makes the cloth top follow the rope. Sway axis is horizontalX around its top edge, phase from the same seed. Nonuniform scaling is cancelled in its rotation matrix.
- Vertical triplets are generated once with existing painter seed3303; use full128 px width,64 px top/bottom margins. Mirrored buildings reverse side only, keeping text readable. Base is actual street-11 m, hence K7 top=-5 m relative to deck.
- Extended createBoards only for geometry/material reuse by cones; every previous caller retains defaults, existing curve hook remains chained.
- Unspecified small sphere segments:4×3 nostrils/pompoms/mane tips,6×4 pearl/patches,8×6 eyes; iris/pupil8 segments, half-torus4×8; K2's16×12 skull/nose remain exact. Six-sided wood/stem/horn cylinders follow existing city poles; main head remains below its explicit target.
- Face placements derive from specified skull/nose extents: lip y0.125,z0.75; nostrils y0.125,z0.9; iris/pupil z0.57/0.572; brow/cheek y0.53/-0.12, cheek x±0.48, patch z0.42/0.43. No positional recipe existed in the approved prototypes.
- Jaw uses literal lower-rear skull hinge(0,-0.4,-0.55); centre localz0.4; dark inside box0.68×0.01×0.76; tongue localy0.1,z0.4; pearl at(0,-0.3,0.55). Teeth x=-0.3..0.3, uppery0.03,z1 and lowery0.145,z0.75. These open placements follow surrounding part extents.
- Beard backward lean and pompom forward lean use nearest given30°; stems x±0.1, rooty0.4,z0.2. Beard x=-0.27..0.27. Tail fan uses five0.5 m cones, four sides/z-scale0.3 and30° angle increments from-60° to60°.
- Scale cell size was open:32 px half circles, rows16 px apart,1 px dark contour; orange inner semicircle r12 offsety2; bottom12% uses2 px yellow strokes every4 px. Exact prescribed colours retained.
- Head takes the same wave at index-1; first ring centre0.55+0.7/2=0.9 m behind the head, then0.75 m intervals. Fan begins half a ring beyond the last centre. Fence outer/top derive from unchanged world geometry (including outer post face4.05 m and wall top0.52 m); sideOffset is exactly1.0 m from that face.
- Reused cached Spider outline thickness0.02/INK0x1c1016 on head,jaw,rings,fan; thin wood poles use their own toon silhouette. No new outline material is allocated because main builds Spider before city.
- No wall-head interpretation was chosen at the K2/900 contradiction, no partial wall scenery or unused future wall pool retained.

## Budget (computed, not captured renderer.info)

Owner ceiling is single-source CONFIG.city.budget =150 calls /250000 triangles /60000000 net texture bytes (src/config.js:482). Removed the old-budget fog dress cut entirely; texScale stays1. No cut order was applied because installed resources fit.

Actual recipe/chunk walk remains baseline-relative105 calls. Installed extension is bounded by11 calls (two glyph families, five dragon parts, four cached INK hulls),6664 triangles (conservative13-segment/full-five-buildings selection, includes ropes and original sign glyph faces),3932160 GPU texture bytes (1024×896 RGBA8 +256² RGBA8, no mipmaps). This is <12 /20000 /4000000. Main head1856+jaw140=1996, fan40, pole24, each open ring24. Actual max buildings per variant5. Fixed pools do not grow.

Conservative installed-stage bounds are116 calls /170442 triangles /42991608 net texture bytes (~42.99 MB,41.00 MiB). Triangle bound deliberately adds all13 segments at the largest festival recipe,5018 polish triangles,3000 portal allowance,96 board quads and the whole extension to the inherited96964 baseline. It double-counts some replaced scenery and is a CPU bound, not a GPU measurement. No phone frame-time, loader-time or adaptive-step capture. Tasks9–10 are absent, so these are installed-stage values, not certification of those unfinished features.

## Last required checks

- node tools/test-skills.mjs: OK 323840 checks.
- node tools/check-patterns.mjs: OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
- node tools/check-quality.mjs: OK: adaptive resolution.
- node tools/test-audio.mjs: OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music36).
- node --check passed for all11 touched JS/MJS files: src/config.js,src/world.js,src/city-logic.js,src/city-tex.js,src/city-boards.js,src/city-pieces.js,src/city-chinatown.js,src/city-dragon.js,src/city.js,src/warmup.js,tools/test-skills.mjs. No scratch files or commit.

## Human phone review / next coder

- ?gun=1500 or1600: characters appear on every hanging sign face; 大吉大吉 above the lanes, five transparent cuts/gold border/dark rope, small phased cloth sway. Check the banner text and cut-outs at portrait speed, and that lanterns never read as obstacles.
- ?gun=1640: begin before every possible seeded dance trigger (head1700–1799). Player sees the face first, then twelve curved/tapered rings, fan and six wood poles outside the fence. Check facial silhouette, mouth/jaw, ink outline, scale detail and that the next obstacle is clear.
- ?gun=1800 /2200: inspect seeded vertical banners at actual base+6 m, gold tassels, readable front-facing characters. No wall dragons yet.
- ?gun=0 /2540 /3500 /4300: all new glyph/banner/dragon meshes hidden outside Chinatown. Pause freezes motion; restart/gameover/menu clear installed pools. On phone capture renderer.info, loading duration and adaptive ratio; none measured here.
- Resume at2g only after the owner resolves whether the wall900 cap can rise or K2 tessellation can be reduced for walls. Then2h dedicated acceptance audit, then approved task11, without weakening check-patterns. Re-read actual generator callers before task11; no type/spacing edit was made here.

---

# Earlier handovers (history only)
# Current run — STOPPED at Step 2 / B1 (2026-11-11)

The ordered run stopped at the first contradictory acceptance rule, as instructed: "If you cannot finish something cleanly, stop there, leave the game working and the checks passing." No runtime code, prototype, design budget, save, character, library or generator was changed in this run. No commit. The earlier coder's uncommitted work is preserved below as history, not acceptance of the new rules.

## B1 blocker — exact prototype radius contradicts the no-overlap limit

The approved host imports the kit (`tasarim/proto/11-3-canli.html:37`); the kit imports `./sehir-tex.js` (`tasarim/proto/11-3-kit.js:12`) and installs `T.facadeHook(U)` (`tasarim/proto/11-3-kit.js:461`). That hook uses unit-spaced cells (`tasarim/proto/sehir-tex.js:574`) and `r = 0.66 * sqrt(tone)` (`tasarim/proto/sehir-tex.js:577`). In a wall's direct-light shadow, `tone = halftone` (`tasarim/proto/sehir-tex.js:573`). DAY therefore has radius/spacing = 0.66 * sqrt(0.85) = 0.608490; phases with halftone 1 reach 0.66. Both exceed the required 0.45. Matching the prototype's radius, spacing, side selection, colour and opacity exactly cannot also satisfy radius/spacing <= 0.45. Changing spacing, capping radius or changing tone would depart from an explicitly fixed parameter; no replacement was invented.

The inherited runtime still uses `CONFIG.city.dotRadius = 0.22` (`src/config.js:479`, consumed by `src/city-tex.js:565`). It passes separation, but does NOT match the prototype. B1 is not complete. To resume, the owner must resolve whether the 0.45 bound overrides the prototype radius formula, or provide a corrected approved prototype. The following ordered items have not been started.

## Current-run checklist

| Item / acceptance bullet | Status and evidence |
|---|---|
| Step 1: all four checks before changes | DONE — commands below; existing runners `tools/test-skills.mjs:1`, `tools/check-patterns.mjs:1`, `tools/check-quality.mjs:1`, `tools/test-audio.mjs:1` |
| B1: compare previous coder with exact approved dot recipe | DONE — contradiction traced above to `tasarim/proto/sehir-tex.js:573` / `:577`; inherited change documented below |
| B1: radius / spacing <= 0.45 for every facade | DONE for existing runtime — new assert on all three shared facade hooks and all five phase maxima, `tools/test-skills.mjs:1541` |
| B1: first-frame district facade, including starts at 0 and 400 m | DONE for existing assignment — `src/city.js:614`; explicit same-district test uses the same initial serial at cityShift 0 / 400, `tools/test-skills.mjs:1883`; existing 13-start-segment checks retained at `tools/test-skills.mjs:1890` |
| B1: exact prototype parameters AND separation | NOT DONE — incompatible radius constraints, `tasarim/proto/sehir-tex.js:577`; no runtime correction applied |
| B1: listed asserts (a), (b) | DONE — `tools/test-skills.mjs:1541`, `tools/test-skills.mjs:1886`; these do not claim prototype equality |
| B2: hanger bottom at railing within 0.02 m | NOT DONE in this run — stopped at B1; inherited implementation has not been reaccepted |
| B2: 0.08 cube clamps, 0x222222, ONE InstancedMesh | NOT DONE — stopped at B1; inherited merged clamps do not satisfy the new instancing rule |
| B2: cable ends within 0.05 m of tower tops, all distance asserts | NOT DONE in this run — stopped at B1 |
| B3: delete all obstacle frame/outline drawing code | NOT DONE — stopped at B1 |
| B3: existing shared emissive = color * k, k 0 / 0.18 / linear blend; non-emissive inventory | NOT DONE — stopped at B1; inherited cool-colour intensity is not accepted as this formula |
| B3: no-frame and three-phase asserts | NOT DONE — stopped at B1 |
| Task 9: blimp model/banner/glyph painter and HUD multiplier UVs | NOT DONE — stopped at B1 |
| Task 9: deterministic flockAt, exact pigeon/burst rules and obstacle rejection | NOT DONE — stopped at B1 |
| Task 9: bridge gulls | NOT DONE — stopped at B1 |
| Task 9: vent ownership and exact steam recipe | NOT DONE — stopped at B1 |
| Task 9: prebuilt CONFIG pools, warm-up, lifecycle and bird/puff soak asserts | NOT DONE — stopped at B1 |
| Task 10: record fireworks/tape, tunnel wait, Goblin pause | NOT DONE — stopped at B1 |
| Task 10: deterministic loopFlavor, rain/snow, sheen and facade glow | NOT DONE — stopped at B1 |
| Task 10: festival cached plans/three lantern strings, future K4/instanced-family compatibility | NOT DONE — stopped at B1; no Chinatown extension built |
| Task 10: reduced motion, reset/menu/gameover cleanup and listed distribution/weather/spark asserts | NOT DONE — stopped at B1 |
| Raised budget: single-source 150 calls / 250k triangles / +60 MB; two permitted design edits; remove old-budget cut | NOT DONE — stopped at B1 before changing the budget implementation or design lines; the owner's ceiling remains binding for resumed work |
| HARITA rows | NOT DONE / unnecessary this run — no mapped runtime role or location changed; existing uncommitted map edits preserved |
| Task 11 | NOT DONE — explicitly outside this run |

- 2b DONE — existing 24 square faces per segment now carry UV glyph anchors (src/city-pieces.js:89); shared alpha-tested basic glyph material and seeded pairs/colours (src/city-chinatown.js:7). Existing board pool and curved material hook reused. warmup uploads the new fixed pool (src/warmup.js:65). No duplicate signs. All four checks/syntax pass: OK 308258 checks; patterns margin >= 0.4 s; quality/audio OK.
- 2b budget: extension +1 call, 624 glyph triangles at full 13-segment occupancy; removes 3744 old square-box triangles, net -3120. Base-relative call bound plus glyph = 106/150, atlas still +1394606 bytes. No cut.

- 2c DONE — horizontal 大吉大吉 canvas, 5 transparent 0.2 m cuts, red/gold 0.06 m border (src/city-tex.js:43); one banner per two existing strings at local z=-10 (src/city-chinatown.js:30), dark rope merged into existing dress (src/city-pieces.js:86). Board entries store phase and sway around the top edge ±3° / 0.7 Hz (src/city-boards.js:52). Shared glyphMat, one InstancedMesh for glyphs and banners. Clearance/lift rule shared with lanterns: src/city-logic.js:5. All four checks and touched JS syntax pass: OK 308271 checks; fairness margin >=0.4 s; quality/audio OK.
- 2c budget: no extra call beyond the glyph family; 26 banner triangles +312 merged rope triangles over 13 segments. Combined 1024×384 texture, no mipmaps: 1572864 bytes; stage net 40632312 bytes. Base-relative calls <=106 including this family. No cut.

- 2d DONE — load-time real-building metadata with mirrored side only (src/city.js:280, :450, :654); hash%10<4, exact facade fraction, base+6 m top, 0.1 m offset, 0.5×2.2 m cloth, 0.06×0.2 six-sided cone (src/city-chinatown.js:47). Four load-time 128×512 patterns, copied into the shared sheet (src/city-tex.js:drawVerticalBanner; src/city.js:514). Pooled tassels reuse glyphMat, no fourth material. All four checks/syntax pass: OK 308278 checks; fairness margin >=0.4 s; quality/audio OK.
- 2d budget: shared sheet 1024×896 RGBA8, no mipmaps = 3670016 bytes; whole-stage net 42729464 bytes. Two extension calls (glyphs and tassels). Upper bound 13*(25+B)*2 glyph triangles plus 13*B*12 tassel triangles, B=max actual buildings per variant. No cut, no new RNG call in city building generation.

- 2e DONE — merged vertex-colour head/jaw/fan/pole recipes in src/city-dragon.js:12, 12 open cylinder rings at load :87; scale painter src/city-tex.js:drawDragonScales. K2 ellipsoids, K3 ten mane slices, every named facial part, six upper/six lower teeth and seven beard cones retained. dragonMat/scaleMat use shared toon gradient; cached existing 0.02 / 0x1c1016 INK hull material reused. Warm-up sees all fixed meshes and hulls through the existing Chinatown mesh list. All four checks/syntax pass: OK 308358 checks; patterns margin >=0.4 s; quality/audio OK.
- 2e budget: head 1856, jaw 140, fan 40, pole24 triangles; main head including jaw 1996 <=3000. Fixed scale texture 256×256 RGBA8/no mipmaps =262144 bytes; complete extension textures 3932160 bytes (<4 MB), stage net 42991608 bytes. Dragon pools remain hidden until 2f. No cut.

## Kendi kararlarım

- Unspecified small curved details use 4×3 spheres (nose holes, pompoms and mane tips), 6×4 pearl/patch spheres, 8×6 eyes, eight-segment iris/pupil discs and 4×8 half-tori; K2's two 16×12 ellipsoids stay exact. Six-sided cylinders follow the existing city poles. These preserve every part under the explicit head triangle target.
- Unspecified face placements derive from the given skull/nose extents; the jaw geometry uses the literal lower-rear skull hinge (0,-0.4,-0.55). Slight backward beard lean and forward pompom lean use the nearest specified 30° angle. Tail fan uses five 0.5 m four-sided flattened cones, spread by the existing 30° mane increment.
- Scale recipe leaves cell size open: 32 px overlapping half circles in staggered rows 16 px apart; gold fill, orange inner shadow, 1 px 0x7a1010 contour, bottom exactly 12% red with 2 px yellow lines every 4 px. No file/image dependency.

- Vertical pattern seed uses existing painter seed 3303; four triplets are chosen once from the eight glyphs, avoiding adjacent duplicates. Cloth cells use the available 128 px width, 64 px top/bottom margins. The building base is the existing street level -11 m, so K7 top is -5 m relative to the deck; this follows the explicit base-relative recipe.
- Extended createBoards only to accept an existing geometry/material for the cone family; existing callers retain their defaults and the curved-world hook remains chained.

- K1 requires one glyph material while K4 requires separate source canvases: pack their unchanged pixels into one GPU sheet; the exact 1024×256 character canvas and 1024×128 banner canvas remain load-time sources. Linear filtering/no mipmaps uses the existing Bugle atlas precedent, so the complete future sheet plus scale map can fit the extension's 4 MB share.
- K6 normal lantern rows alternate at 10/8/12 m; after every second row, the midpoint is local z=-10. Rope uses the existing two straight-half construction, sag 0.25 m, full road width plus 0.5 m each side (8.4 m). Cloth upper edge follows that sag in alpha. Sway axis is the horizontal top edge (X); phase comes from the same seed hash. Required lift currently 0 m, lowest tip 10.1 m >= 8.8+1.

- K5 leaves the hash formula open: used the living-detail design's sine hash (127.1 / 43758.5453), with tuple encoded as segmentId*32 + sign*8 + cell and a uint32 result. Three-cell signs repeat the first character of their selected meaningful pair in the third cell. Both faces match; existing 0.02 m marks become planes at their outer surface z ±0.11.

- No visual value was chosen: retained the existing runtime at the B1 contradiction and added only the two explicitly requested B1 assertions; did not choose a precedence between incompatible acceptance rules.

## Last check lines and budget

All four passed before changes and again after the B1 assert additions:

- `node tools/test-skills.mjs`: `OK 241011 checks`.
- `node tools/check-patterns.mjs`: `OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.`
- `node tools/check-quality.mjs`: `OK: adaptive resolution`.
- `node tools/test-audio.mjs`: `OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)`.
- `node --check tools/test-skills.mjs`: exit 0. This is the only JS/MJS file changed by this run.

No rendering resources were added: delta 0 draw calls / 0 triangles / 0 texture bytes. Re-run CPU accounting still reports 104 baseline-relative calls (the inherited checker still prints /105), Bugle peak 19/24, bridge segment max 1128, Chinatown 3344, festival 4772, Neon max 288 triangles per recipe. The earlier conservative Neon estimate 106170 triangles and +37.25 MiB net texture inventory below remain inherited estimates, not new GPU measurements; no whole-run renderer maximum or phone frame time was captured. New owner ceiling: 150 / 250000 / +60 MB; updating its old encoded limits is pending, not claimed done.

Phone review still pending: `?gun=0` and `?gun=400` for the inherited facade appearance (assertions confirm shared texture material, not visual approval). Later `?gun=2700`, `3500`, `4300`, `10300` checks remain pending with B2/B3/tasks 9-10. No scratch files.

---

# Previous coder's handover — preserved historical record

Stopped after task 8. Nothing from tasks 9-11 or the Chinatown extension was implemented. Task 11 IS owner-approved, for its later ordered turn; it changes type choice only. No commit, library, build step, generator/fairness change, save write/migration, character lock or loss of earned progress.

Code and CPU assertions are complete. Browser/phone acceptance and captured GPU budget numbers remain pending. This is not visual approval or measured device certification.

## Checkpoints in this run (each completed before starting the next)

| Item | test-skills last line | Other checks |
|---|---|---|
| Fix 1: facades | OK 222438 checks | patterns, quality, audio, touched JS syntax passed |
| Fix 2: bridge | OK 227360 checks | same four checks and touched JS syntax passed |
| Fix 3: obstacle frames | OK 227384 checks | same four checks and touched JS syntax passed |
| Task 7: Neon | OK 227649 checks | same four checks and touched JS syntax passed |
| Task 8: Bugle | OK 240994 checks | same four checks and all ten touched JS/MJS syntax passed |

## Fix 1 - dotted facades

- Root cause: src/city-tex.js:541 facadeHook used radius 0.66 * sqrt(tone). On walls without direct sun, DAY tone 0.85 gives radius 0.608 cells: dots overlap and almost fill the wall, multiplying the window/brick atlas blue. Fonts already finish before initCity (main.js:181); all atlases are painted at load and initial/recycled segments already share assign. No stale placeholder or district-only initialization was found.
- src/config.js:479 adds dotRadius=0.22; city.js:502 shares uDotRadius across all three materials; city-tex.js:565 uses it. Maximum geometric/minified dot coverage is now 15.21%, so the actual windows/brickwork survive in shadow. This owner-requested fix deliberately departs from the prototype's 0.66. Other phase colours, atlas repeat and eight dots per bay stay unchanged.
- tools/test-skills.mjs:1534 checks shared uniforms and five phase coverage bounds; :1859 checks every start segment against a later Midtown segment for the same facade material/plain/glow dress. Zero added calls, triangles or texture bytes.

## Fix 2 - bridge hangers

- Root cause: copied cableSeg ended hangers at x=+/-5,y=1 above empty air; the world deck/fence is narrower. No attachment geometry existed. Main cable endpoints at tower metres 200/600 were already correct at y=30.
- src/city-pieces.js:110 adds a connected edge walk, rail, supports and one dark 0.08 m clamp per hanger, merged into the existing plain mesh. CONFIG.city.bridge holds railX=5, railTop=1, clamp=0.08. Cable equation, tower positions, eight hangers per side/segment and all spacing remain the approved numbers.
- tools/test-skills.mjs:1794 checks 640 hanger bottoms/tops/clamps, 80 cable segments' endpoints and both tower heights. Bridge maximum goes 600 -> 1128 triangles per segment (+528; <=6864 over all 13 live segments), zero added calls/textures. The edge walk is structural bridge geometry, outside playable lanes.

## Fix 3 - amber obstacle frames

- Root cause: daycycle recoloured the shared BackSide obstacle hull from ink to amber (80% night, 100% tunnel), producing a selection-frame effect.
- src/daycycle.js:27 stops writing hull colours. obstacle-art.js:475/505 exposes the existing shared obstacleMaterial instead of rims; city.js:675 passes it explicitly. Hulls keep their original ink. CONFIG.city.obstacleGlow uses the existing NIGHT sun colour cfd8ff and intensity 0.3 times the same darkness envelope: a smooth broad body lift, zero at reset/noon. No new shader, light or draw.
- tools/test-skills.mjs:1477 exercises the actual daycycle, compares the ten barrier/train/car primary colours' body-vs-deck linear-luminance contrast against pre-fix body lighting in tunnel and night, and verifies reset/no hull recolouring. These CPU checks are not a screen-space contrast or phone acceptance claim; the unwanted amber border is intentionally removed.

## Task 7 - Neon Meydan

- src/city-pieces.js:266-301 copies FRAME/TUBE/board/gantry/neonDress. Only required delta: Bugle rect [0,768,512,256] in the 2048x1024 atlas (NIGHT=12). Two board tiers, four 8x4 m pictures/segment, all struts/tubes, gantry 16x8 m picture with underside 12.2 m and both bulb rows retain the approved recipes.
- src/city.js:514 adds ads pool40 on the SAME atlases.neon object as the facade, Bugle pool24 and one gantry portal. At task-7 checkpoint the Bugle texture was the required black/frame placeholder; task 8 replaced its painter, not its texture or material. The existing warm-up automatically covers every new pool/piece and uploads all 12 textures.
- tools/test-skills.mjs checks real neon0/1/2 and gantry anchor counts, the 16-slot UV dimensions, builder bounds and the existing two-loop board walk.
- Applied the design's fog-detail budget fallback: CONFIG.city.dressFogZ=-120; city.js:683 hides dress plain/glow there, restoring the cached plan on approach. Shell geometry stays continuous. No other detail was cut; texScale stays 1. At most 12 dress centres can be nearer than this cutoff, given recycle backZ+halfLength=106.

## Task 8 - Daily Bugle

- src/bugle-logic.js is byte-for-byte proto/11-3-mansetler.js, including its import self-check and all wording. No modification to the power-up Bugle.
- src/city-tex.js:689 paintBugle dispatches all 16 slots to the approved page/wanted/top-five painters on the existing non-mipped 2048x1024 canvas.
- src/city.js:533 reads guarded existing name/skin/top-five saves, uses UI-compatible numeric score filtering/floor/sort and Turkish uppercase names, and compares name|skin|best|runs|multiplier (mission base). First paint occurs after main's fonts await. At start it checks again before dressing; only changed signatures repaint + needsUpdate. There are no save writes.
- city.js:562 updateIdle is called from the EXISTING main renderer loop (main.js:217): once per CONFIG.city.repaintEvery in menu/over. No new timer/rAF/system. Paused runs are deliberately excluded to preserve the visible atlas, even if a mission multiplier changed before pausing; they remain ongoing runs until restart/menu/gameover. This resolves the design's broad mode!='running' wording against the owner's pause/visible-board invariants.
- city.js:517-531 prebuilds all 80 deck states using the unchanged bugleDeck. The allocation-free selector agrees with it for every score threshold, best threshold and flag combination in tests; CONFIG.stumbleNews is asserted equal to its unchanged 600 m catalogue limit. Cached slot rectangles/ctx/matrices are reused.
- city.js:549/555 chooses at take time only, using floor(score), best, state.multiplier, actual world distance/stumble distance and shifted city phase/loop/dawn. The gantry anchor is marked hero at cached plan construction and takes heroSlot; other boards take deck[n % length]. Midtown/dawn roof anchors now use the same Bugle pool and preserve their mirrored local positions/turns without mirroring text.
- city.js:690 resets counter/stumble/previous-score/record latch and re-dresses fixed segments after world's reset and again at start after the signature check. No resource creation. The existing reset order (world before systems) thus cannot leave previous-run news on initial boards. Gameover releases every pool/portal, restores Midtown/noon and clears dress/shell. dispose unsubscribes start/stumble/gameover/recycle/system hooks.
- city.js:713 emits recordPass {score} once per run on crossing an existing best; best=0 never fires. No audio/celebration subscriber was added (task 10 owns celebration).
- Tests include the five design asserts, 80 cached-deck equivalence, actual painter dispatch/slot frames, a slot selected 164 m ahead unchanged for 120 visible updates, hero UV, no canvas work during run/pause, menu cadence/signature, immediate start name change, corrupt saves, actual once-only record event, reset and roof ownership cleanup.
- Actual chunks have roof-anchor counts [1,0,0,2,2,1,2,1,2,1,0,0]. A 913-recycle, 13-live-segment walk using actual builders + actual 300-serial chunk sequence peaks at Bugle19/24; all pools release to zero and same loop positions repeat. The original recipe-only walk remains tabela27/32, ads35/40, bugle18/24.

## Budget evidence (computed, not captured GPU frames)

- Draw accounting now walks all 913 actual recipe/chunk windows at four scroll offsets (including both sides of the fog cutoff), counts all overlapping portals, all live board pools and tunnel/bridge chunk replacements. Maximum baseline-relative bound is 104/105 calls. A rough full-city formula gives <=105, but the detailed walk is the stronger boundary evidence. Both use the design baseline76 and do not certify renderer.info at runtime.
- Exact primitive accounting from actual builder calls: bridge max1128, tower364, vapur236, Chinatown3344, festival4772 (not selected yet), gate648, tunnel incl glow376, largest station1324, mouth284, Neon dress288, gantry540. Each board is 2 triangles. Stations retain the 96-triangle merged shell/wall and two calls.
- Conservative Neon triangle estimate: 96964 design baseline + 12*288 dress + 96*2 boards + 540 gantry + 5018 prior chunk-polish bound = 106170 (<140000). Prior Chinatown ~139k estimate loses at least one far 3344-triangle dress under the fallback (~136k); bridge remains ~97k including fix 2. These baseline-based estimates are not captured maxima for every character/effect.
- RGBA8 inventory: 36612776 bytes (tasks1-6 textures) + 8388608 Bugle - 5941936 deleted old textures = 39059448 bytes net, +37.25 MiB. Future blimp glyphs add 0.5 MiB -> projected full-stage +37.75 MiB, within the design's 38 MiB convention. No second ad atlas, texture downscale or new image files. Device allocation unmeasured.
- Browser access host reported unavailable; native Edge returned 'Computer Use was not approved to use Microsoft Edge'. No alternate control bypass. renderer.info captures at 0/1450/2800/3500/3650/4300, GPU shader screenshots, phone frame time/adaptive step and +0.5 s loader timing could not be checked. Do not call these measured or visually accepted.

## Last required check lines

- node tools/test-skills.mjs: OK 240994 checks
- node tools/check-patterns.mjs: OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
- node tools/check-quality.mjs: OK: adaptive resolution
- node tools/test-audio.mjs: OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)
- node --check: exit0 for src/config.js, src/city.js, src/city-tex.js, src/city-pieces.js, src/daycycle.js, src/obstacle-art.js, src/bugle-logic.js, src/main.js, src/events.js, tools/test-skills.mjs. git diff --check passes. No scratch files or commit.

## Inherited work and next coder

- Tasks1-6 and the 11.5 surf fix remain intact: Cap pit-only exit handling, shared city U, full CONFIG route/clock, 300 fixed chunk specs/plans, cached/mirrored roof anchors, board swap-remove, all Chinatown/bridge/tunnel recipes, merged station walls, portal re-use and all warm-up variants. Earlier checkpoint OK222391. No fairness checks were weakened.
- Begin task9 next; this run ends at8. Tasks9-10 own life, record celebrations, weather/festival and the Chinatown extension. Read the extension's own budget and cut order then. It was pre-existing untracked input and was left untouched.
- Task10 must pre-cache normal AND festival plans: plans currently cover loop1 dressing; ctFest is built but not selected. Do not allocate new dressing plans on recycle. The fog fallback is already active; include it when budgeting later life/dragon/banner calls and triangles.
- Task11 is approved, last, WHICH obstacle only; no spacing/fairness change. Snow third night, Istanbul vapur and no Chinatown obstacle remain binding.
- Re-check Neon cut ad words on the owner's phone before choosing the second-atlas fallback: that atlas would exceed projected full-stage texture budget at texScale1; apply the design's texScale0.5 fallback first if needed.

## Phone review still required

- ?gun=0: windows/bricks and small shadow dots from the first frame, including later recycled buildings. Change name/skin in menu, start immediately, inspect roof news; no hitch or old name.
- ?gun=2700 then 3100: every vertical hanger meets its clamped railing, rail supports meet the edge walk, cables meet both towers; white Istanbul vapur/yellow funnel and pink water.
- ?gun=3280 / 3500 / 4300: tunnel/night obstacles have ink edges and a broad cool body lift, no amber selection frames. At 20 and 39 m/s name the next obstacle lane within 0.5s; test on phone.
- ?gun=3640 / 4300: 16m hero Bugle arch, NEON MEYDAN, bulbs, two board tiers and ads. Next recycled boards react to a stumble for600m or a broken record; visible pages never change.
- ?gun=5200: dawn MIDTOWN sign and roof boards; pause/resume, gameover->menu, restart and a second run leave no stale news/portal/glow. Capture budgets at design checkpoints and compare adaptive resolution/loader time on phone.
