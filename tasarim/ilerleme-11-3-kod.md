# 11.3 - manager rulings A-C and checker follow-up (2026-11-11)

This run follows steps 1-5 in order. Existing uncommitted tasks 7-11 stay in place; no commit, dependency, save change, subagent or background worker is added.

## Step 1 - DONE

The four exact checks passed before edits: test-skills OK 1694548 checks; check-patterns OK, reaction margin >= 0.4 s; check-quality OK: adaptive resolution; test-audio OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36).

## Step 2 / ruling A - DONE

Removed the wall-head geometry, placement, instance buffers, append/copy path, CONFIG keys and former K9 assertions. Warm-up consumes the surviving Chinatown meshes list, which no longer contains a wall dragon. Dance head/jaw/fan/pole geometry, 12 rings and four outlines are unchanged. Glyphs, horizontal/facade banners and tassels retain their existing formulas and ownership.

Files: src/city-dragon.js:77 (dance-only factory), src/city-chinatown.js:32 (dance only) and :83 (surviving warm-up list), src/config.js:483 (dance-only config), tools/test-skills.mjs:2039 (absence assertions and existing banner/reset coverage). The only production callers were createChinatown -> createDragon and city.js:698 -> createChinatown; warmup.js:66 uses the returned list.

All four checks pass after A: test-skills OK 1694415 checks; patterns OK, margin >= 0.4 s; quality OK; audio OK (8 cores, peak music 36). node --check passes for src/city-dragon.js, src/city-chinatown.js, src/config.js and tools/test-skills.mjs.

Preliminary post-removal scan: ?gun=1351600, 123 calls / 173650 triangles / 43515896 texture bytes; call peak 123 at ?gun=1600. Step 4 will audit this computation before accepting the final worst point. No fallback cut applied.

## Kendi kararlarım

- A: remove only wall-dragon ownership from the existing shared ring/fan path; keep the dance-only path and all banner/sign recipes unchanged.

## Ordered work noted after A (completed below, except defect 4)

Step 3: own-colour obstacle emission with permanent ink, exact R7/doc edits and assertions. Step 4: recompute and assert the actual worst window against the single CONFIG ceiling; cut only if required. Step 5: verify already-fixed defects 3/5a/5c; resolve unused rim via B; assess the head/jaw/fan bounding-sphere sweep. Finish with file:line checklist and phone stops.

## Step 3 / ruling B - DONE

src/daycycle.js:33 now computes material.emissive = material.color * (CONFIG.city.obstacleGlow * lerp(p.nightBlend, 1, tunnelAt(d))) on the existing shared obstacle material. src/obstacle-art.js:505 exports that same material; the sole production clock caller src/city.js:710 passes it. Outline ink 0x15171c is never written by the clock, nor tinted or normalised through NIGHT.rim. src/config.js:479 owns obstacleGlow 0.18; phase values use nightBlend, with NIGHT = 1; tunnelLook.rim is gone. No new material or per-frame object is created.

Exact R7 and the requested source/readability/phase/tunnel lines in tasarim/11-3-gun-dongusu.md:3,21,24,57,59,106 now describe body emission and ink; tasarim/11-3-gorevler.md:41-42 replaces the amber controls. The shared gameplay-write exception at :14 is updated for the same ruling. Existing owner ceilings in gorevler section 3 and sehir are already 150 / 250k / +60 MB and need no duplicate edit.

Tests at tools/test-skills.mjs:1599-1621 freeze the body colour and ink, exercise each phase, tunnel entry/exit and reset, verify each emission channel and exact k endpoints/intermediates. All four checks pass: test-skills OK 1694491 checks; patterns OK, margin >= 0.4 s; quality OK; audio OK (8 cores, peak music 36). node --check passes on all five B-touched JS files.

Budget unchanged from A (source computation, not GPU measurement). Step 4 is next; no cut made.

## Kendi kararlarım

- B: use the nearest existing phase blend values (prototype sunset 0.25, dawn 0.1, day/golden 0), rename their purpose to nightBlend, and set NIGHT to the ruling's full blend 1. This removes the NIGHT.rim division while keeping linear phaseKeys interpolation; tunnel blends toward 1. k at sunset is 0.045, full night/tunnel 0.18, half dusk-to-dawn 0.099. No hue is introduced.

## Step 4 / ruling C - DONE

The 403-loop window scan recomputed after A now names ?gun=1351600 (festival Chinatown): 123 calls / 173650 triangles / 43515896 texture bytes. Maximum calls are also 123, first at ?gun=1600. The independent coarse bound is 123 / 176862 / 43515896. The unchanged ceiling is CONFIG.city.budget at src/config.js:481 (150 / 250000 / 60000000). tools/test-skills.mjs now asserts the computed worstPoint, worstCalls and texture total as well as each scanned window and the separate conservative bound. No expected location/triangle constant replaces the computation.

Extension after wall removal: 11 calls / 6664 triangles (coarse full-pool bound) / 3932160 texture bytes. The full scene fits, so Chinatown cut steps 3 and 4 are NOT TRIGGERED: dance retains 12 rings and four outlines. No other cut applied. The budget computation retains the checker's accepted baseline-relative method and reserves full life/weather/spark capacities; it is a source-computed upper bound, not renderer.info or phone measurement.

All four exact checks passed: test-skills OK 1694492 checks; patterns OK, margin >= 0.4 s; quality OK; audio OK (8 cores, peak music 36). node --check tools/test-skills.mjs passed. Step 5 is next.

## Step 5 - DONE for blockers/bugs and small polish; defect 4 remains

Defect 1 is settled by A; defect 2 by B. Defect 3 (paused Bugle) remains fixed at src/city.js:586; its paused cadence, signature early-out and upload assertions remain in tools/test-skills.mjs. Defect 5a is settled by the absence of any hull write in daycycle; 5b by removing tunnelLook.rim in B; 5c remains fixed at src/patterns.js:404, using ordered CONFIG district boundaries and the existing retuned-boundary tests. No spacing/fairness/generator code was changed this run.

Removed the remaining wall-only board-matrix override and UV-less option in src/city-boards.js:5, after searching all createBoards callers (city.js, city-chinatown.js and tests); none of the surviving callers uses either. This leaves banners/signs/clamps on the identical default UV and compose path. Strengthened actual obstacle-art factory checks: every non-coin kind shares the exact exported body material and keeps the same outline; coins use a different material.

NOT DONE - checker polish defect 4: tools/test-skills.mjs PieceGeometry.rotate/translate/scale and computeBoundingSphere are no-op/count stubs, and BoardRotation.setFromUnitVectors is a no-op. The existing ring-pose sweep is valid, but the requested merged head/jaw/fan spheres and world transforms cannot be obtained from those stubs. Extending the sweep alone would test fabricated bounds. Replacing the geometry/quaternion harness exceeds this run's expressly limited few-line polish work, so only this item is skipped. Production dance geometry/placement is unchanged under ruling A. A phone should inspect both sides of the dance; automated head/jaw/fan clearance is not certified.

All four exact checks pass after this final code change: test-skills OK 1694508 checks; patterns OK, margin >= 0.4 s; quality OK; audio OK (8 cores, peak music 36). Budget remains ?gun=1351600:123/173650/43515896; call peak123 at ?gun=1600. The next coder must not restore wall geometry or amber rims; defect4 needs real geometry maths before a meaningful bound sweep.

## Kendi kararlarım

- Step5: remove the wall-only optional matrix/UV paths after confirming no remaining caller needs them; keep every surviving board's default behaviour unchanged.
- Defect4: apply the stated few-line polish limit literally; retain and report the coverage gap instead of adding synthetic bounds or changing the required dance model.

## Final item-by-item checklist

This table is the final status; earlier “next” notes above record the required sequential checkpoints. Only eight JS files were touched in this run: src/city-dragon.js, src/city-chinatown.js, src/city-boards.js, src/config.js, src/daycycle.js, src/obstacle-art.js, src/city.js and tools/test-skills.mjs. Documentation edits are this file, HARITA and the explicitly authorised R7 lines in gun-dongusu/gorevler. Other existing working-tree edits remain in place.

| Run item / implemented design bullet | Status and current evidence |
|---|---|
| Step 1: four exact checks before changes; fix failures first | DONE — initial results recorded at tasarim/ilerleme-11-3-kod.md:7; all passed, no baseline failure to fix. |
| A: delete wall geometry builders | DONE — src/city-dragon.js:77 follows the unchanged dance recipe directly; tools/test-skills.mjs:2040 rejects any wall builder. |
| A: delete wall instances and pools, including shared ring/fan append slots | DONE — src/city-dragon.js:92 allocates only one head/jaw/fan, 12 rings and six poles; tools/test-skills.mjs:2039 asserts no wall object/pool API exists. |
| A: delete wall placement | DONE — src/city-chinatown.js:40 assigns only glyphs/banners/tassels; tools/test-skills.mjs:2040 rejects wall placement/append code. |
| A: delete wall CONFIG entries | DONE — src/config.js:483 and tools/test-skills.mjs:2041. |
| A: delete wall warm-up entries | DONE — src/city-chinatown.js:83 returns only surviving meshes to src/warmup.js:66; there is no separate wall warm-up branch. |
| A: remove legacy wall/K9 assertions, add absence assert | DONE — tools/test-skills.mjs:2039; the obsolete incomplete-head acceptance, wall ownership and K9 budget assertions are deleted. |
| A: remove remaining wall-only shared-board support | DONE — src/city-boards.js:5 uses the surviving default UV path; src/city-boards.js:30 always composes from the existing anchor fields, with no matrix override. |
| A: preserve dancing dragon geometry, animation, banners, facade banners, signs and glyph atlas | DONE — src/city-dragon.js:23 recipe and :103 animation unchanged; src/city-chinatown.js:44 glyphs, :50 banners, :56 facade banners/tassels unchanged; src/city-tex.js:745 atlas unchanged this run. Existing glyph, cadence, phase and clearance checks remain at tools/test-skills.mjs:2024 and :2347. |
| B: outlines always pre-11.3 ink, including tunnel | DONE — src/obstacle-art.js:476 creates the unchanged 0x15171c ink; src/daycycle.js:33 writes only body emission; tools/test-skills.mjs:1615 checks ink at noon/sunset/night/tunnel. |
| B: no amber/yellow tint, NIGHT.rim division or per-frame outline colour writes | DONE — tools/test-skills.mjs:1618 rejects these paths; src/config.js:527 has no tunnelLook.rim; phase entries use nightBlend at src/config.js:507. |
| B: own-colour body emission on the existing shared obstacle material | DONE — src/obstacle-art.js:505 exports the same material, src/city.js:710 passes it, src/daycycle.js:33 writes emissive.copy(color).multiplyScalar(k). tools/test-skills.mjs:2469 verifies every obstacle kind uses that exact shared material and coins are separate. |
| B: k = 0 by day, 0.18 full night/tunnel, linear by existing phase/tunnel blend | DONE — src/config.js:479 and :507 phase endpoints; src/daycycle.js:33; tools/test-skills.mjs:1612 exact coefficients and :1607 per-channel blend checks. |
| B: exact R7 text | DONE — tasarim/11-3-gun-dongusu.md:106 matches the ruling verbatim, including ×. |
| B: change only rim descriptions on the requested day-cycle lines | DONE — tasarim/11-3-gun-dongusu.md:3, :21, :24, :57, :59. |
| B: replace amber CONFIG descriptions in tasks file | DONE — tasarim/11-3-gorevler.md:41 and :42; the corresponding gameplay-write exception is updated at :14. |
| B: asserts for noon/sunset/night/tunnel ink, zero/full/blended k and reset | DONE — tools/test-skills.mjs:1604 and :1612; frozen body colour and frozen ink reject colour mutations. |
| C: single owner ceiling 150 calls / 250000 triangles / +60000000 bytes | DONE — src/config.js:481 is the single numerical ceiling consumed by tests. Design ceiling already correct at tasarim/11-3-gorevler.md:213 and :215, tasarim/11-3-sehir.md:20; no duplicate ceiling added. |
| C: recompute after wall removal and name worst point with ?gun | DONE — tools/test-skills.mjs:2290 computes 403 loops; :2322 prints ?gun=1351600, 123 calls / 173650 triangles / 43515896 bytes; call peak123 first at ?gun=1600. |
| C: scene-budget assert uses computed worst point | DONE — tools/test-skills.mjs:2320 asserts worstPoint/worstCalls and actual computed texture total; per-window and coarse checks remain. |
| C: cut order steps 3 then 4 only if still over 250k; never cut anything else | DONE — no cut condition triggered; src/config.js:483 retains12 rings and tools/test-skills.mjs:2018 retains four outlines. The independent coarse full-scene bound176862 also fits. |
| C: report real overrun and largest scene part if still too large | DONE — condition not triggered; source-computed totals fit. No overrun is hidden or “fixed” by reducing required detail. |
| Step 5: checker defect1 BLOCKER | DONE — ruling A removes the wall-head requirement and its incomplete implementation; tools/test-skills.mjs:2039. |
| Step 5: checker defect2 BUG | DONE — ruling B implements the authorised recipe; src/daycycle.js:33 and tasarim/11-3-gun-dongusu.md:106. |
| Step 5: checker defect3, paused Bugle cadence | DONE (verified existing fix) — src/city.js:586 skips only running mode; tools/test-skills.mjs:1770 checks interval, repaint/upload, new name/best and unchanged-signature early-out. |
| Step 5: checker defect4, merged head/jaw/fan sphere sweep | NOT DONE — tools/test-skills.mjs:1830 transforms and :1833 bounds are no-ops; :1679 quaternion direction is a no-op. Real geometry/quaternion support is missing from this harness and replacing it exceeds a few-line polish fix. Only rings are certified at :2099. No invented bounds or model changes were introduced. |
| Step 5: checker defect5a, constant outline colour rewrite | DONE — src/daycycle.js:32 proceeds directly to body emission at :33, with no hull input or loop; frozen-ink/no-write checks at tools/test-skills.mjs:1615 and :1618. |
| Step 5: checker defect5b, dead tunnelLook.rim | DONE — src/config.js:527 and tools/test-skills.mjs:1619. |
| Step 5: checker defect5c, hardcoded event tunnel offsets | DONE (verified existing fix) — src/patterns.js:404 reads the ordered CONFIG districts; tools/test-skills.mjs:292 temporarily retunes both boundaries and tests exact endpoints, later loops and rejection remaining due. |
| Lifecycle and reset after removal | DONE — src/city-chinatown.js:67 clear, :75 reset and :90 dispose; src/city-dragon.js:133 clear. tools/test-skills.mjs:2057 checks menu/gameover/restart/recycle ownership, :2118 dance clear. Shared emission resets via src/city.js:733 and :777 / daycycle.update(0). |
| Preserve saves, characters, earned progress, generator spacing and fairness | DONE — no save/character/generator/fairness file edited this run; existing save and fairness assertions pass in tools/test-skills.mjs:22 and tools/check-patterns.mjs:41. |
| No new library, build step, dynamic light, runtime texture/material or per-frame allocation | DONE — existing load-time material src/obstacle-art.js:475 reused; src/daycycle.js:33 adds one nonallocating colour write; dance buffers built at src/city-dragon.js:77. Hot-path allocation guards remain at tools/test-skills.mjs:2095 and :2119. |
| Update affected code-map rows | DONE — tasarim/HARITA.md:17, :22, :36, :37, :38, :39, :530, :604, :615. |
| Four checks after every fix, syntax on every touched JS, final diff whitespace | DONE — checkpoint results above; final results below; all eight node --check calls and git diff --check exit0. |
| No commit, scratch file, subagent or running worker | DONE — final file set described above; no commit or worker was started; all tool command sessions have completed. |

## Final validation and handoff

| Exact command | Last line (exit0) |
|---|---|
| node tools/test-skills.mjs | OK 1694508 checks |
| node tools/check-patterns.mjs | OK: every seed has a passable route; reaction margin >= 0.4 s everywhere. |
| node tools/check-quality.mjs | OK: adaptive resolution |
| node tools/test-audio.mjs | OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36) |

node --check passed on all eight JS files listed above, including city-boards. git diff --check passed (only Git LF/CRLF notices). No browser or phone session was started. Budget figures are the existing baseline-relative source accounting with full pools reserved, not measured renderer/GPU peaks or frame time. The conservative bound is123 calls /176862 triangles; the scanned worst window is123 /173650 at ?gun=1351600. Textures are43515896 bytes (43.52 MB), below60000000.

Phone checks: ?gun=0 noon versus ?gun=2880 sunset, ?gun=3500 tunnel and ?gun=4300 night: identify the next obstacle lane within0.5s at20 and39m/s, with ink outlines throughout. ?gun=1660 then1700: watch the full dance face/jaw/fan, both sides across seeds, confirm scenery never crosses the fence/flight corridor. ?gun=1351600: festival Chinatown worst computed window; ?gun=1600: first call peak. Check retained glyphs/banners, no wall dragons, smooth motion and phone stutter/adaptive resolution. Pause and wait one repaintEvery interval after changing a signature input to verify Bugle refresh. The existing ?gun parameter shifts city scenery/time only (src/city.js:475), not score or generator progress.

Remaining: only checker polish defect4's automated head/jaw/fan clearance proof. Human phone readability, iPhone11 frame time, thermal/GPU memory and the adaptive-resolution plateau are unmeasured. Do not treat passing scripts as those visual/device acceptances.
