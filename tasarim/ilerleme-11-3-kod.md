# 11.3 code handover - tasks 1-6 complete in code

Stopped after task 6, as requested. Tasks 7-11 are NOT started. Task 11 still requires the owner's approval. No commit, new library, build step, generator change, save migration/key, character lock or loss of earned progress. Browser/phone acceptance is pending; code-complete does not mean visually approved or GPU-budget certified.

The four checks passed before continuing the previous coder's work (skills 216136). No inherited failing check needed repair. Tasks 4, 5 and 6 were then implemented in order, with all four checks and syntax checks passing and this handover rewritten at each checkpoint.

## Step 0 - complete
- src/powerups/hero-specials.js:674 removes the general 0.1 s collision grace.
- src/obstacles.js:457-460 ignores pits during active surf, or while the shield exit animation is active and lastY > floorY with vy <= 0. Gates/girders keep swept collisions.
- Grepped _collide, grace, _capExit, deactivate and beforePlayer callers/wrappers first; hook chaining is unchanged.
- tools/test-skills.mjs:1365 retains speed 19/39, standing/sliding, 120 FPS/dtCap exits over a 6 m pit. :1389 adds the real expiry-frame pit/gate/girder regression; a later pit still hits.
- Checks after Step 0: skills 213391; patterns/quality/audio and touched-file syntax passed. Rendering delta zero.

## Task 1 - complete
- src/config.js:471-509 contains CONFIG.city, with every approved route, phase, disc, light, texture, pool and future life number unchanged.
- src/city-logic.js: pure loop/district/day/segment helpers, linear RGB blending, tunnel/city envelopes, dressing/portal table and districtEvent.
- tools/test-skills.mjs:23-94 covers all ten listed asserts: boundaries, segment counts, light/fog floors, exact phase/disc values, 701 portal windows and the 13 km event sequence.
- phaseAt/discAt optionally write into supplied buffers so task 2 allocates no phase objects/arrays per frame; ordinary calls return independent results. Festival stays false until task 10, as ordered.
- Checks after task 1: skills 216103; patterns/quality/audio and syntax passed. Rendering delta zero.

## Task 2 - code complete; browser/phone verification unavailable
- src/daycycle.js:5 updates only the approved scenery, two existing lights, fog/sky, coin intensity and obstacle rims; phase/disc storage is reused.
- src/city-tex.js: approved rng, sky mask/shaders and shore painter; the bridge shader delta is ported unchanged.
- src/city.js:444 replaces the old canvas skyline painter with the shader plane. :543 registers the last game system, emits through createAnnouncer, and resets clock/announcer at restart/menu/gameover. Pause preserves the exact frame. A post-hit mode/halt guard prevents a final stale update.
- ?gun=<metres> is rounded to 20 m, held in cityShift, and added only to city clock/announcements; task 4 must also use it for scenery assignment. World, score and obstacle generation are unchanged.
- The old growing segment-spec cache is now 300 specs built at load, reused by serial modulo 300. Its no-repeat-within-three rule also holds across the loop boundary (checked). This removes allocations on recycle.
- src/obstacle-art.js:504-505 exposes coinMaterial/rims explicitly; no runtime traversal. main.js:240 passes city textures to existing warmUp. events.js documents districtEnter. No new light or event polling.
- tools/test-skills.mjs:96 proves three announcements, no duplicate and reset/re-entry.
- Checks after task 2: skills 216105; patterns/quality/audio and syntax passed. Geometry delta 0 calls / 0 triangles; replacement mask storage unchanged, shore +0.25 MiB.

## Task 3 - code complete; browser/phone verification unavailable
- src/city-tex.js: all requested approved painters/helpers, facadeHook and drawTabela. Source comparison verified 15 functions and both original sky shader strings unchanged; CONFIG's five phases also match exactly. Only prototype T. qualification was removed from copied kit painters.
- src/city.js:479 builds exactly textures 1-11 once, retains their canvases, uses the specified wrap/repeat/colour spaces/mipmaps and anisotropy min(4,max) only on 1/3/5/7. texScale affects 1-7 and 11, per texture inventory; mask/shore/water sizes stay fixed.
- src/city.js:495 creates all three facade materials with the same U; all chunks use Midtown for now. Curve's existing onBeforeCompile wrapper remains in charge; no hook was replaced outside its setter contract.
- src/city.js:162 adds both exact corner strips and the cornice ink line. Brown water tower chance is the designed 0.25. :228 removes the old cream/accent billboard artwork and records the exact 4.4 x 2.2 Bugle anchor. :439 prebuilds mirrored anchor records; seg.city.anchors already selects the right set without recycle allocation. Anchors remain unused until task 8.
- Old makeFacadeTexture/256-square texture and old skyline canvas painter are deleted.
- src/main.js:181 waits for document.fonts.ready before city paint, so atlas lettering uses the approved fonts. src/warmup.js:43 compiles one mesh per facade material; all 11 textures are uploaded through the existing texture list.
- tools/test-skills.mjs:102 checks node-safe painter exports; :1466 checks that the actual three facade-construction hooks share every U entry. Painters were not rendered headless.
- Checks after task 3: skills 216136; patterns/quality/audio and all 12 touched JS/MJS syntax checks passed.

## Task 4 - complete in code
- src/city-pieces.js:6-38 helpers copy the prototype; sQuad stores board anchors, kit keeps tabela/ads/bugle lists. :107-158 builds all 40 cable segments, tower and Istanbul vapur; :257 builds the MIDTOWN dawn sign. Dimensions, colours, placement, materials and recipe bodies are unchanged.
- src/city-boards.js:4 builds the fixed tabela pool (capacity from CONFIG.city.boards). :23 take composes a cached local matrix and atlas rectangle; :33 release swap-removes records; :43 update adds the segment z and uploads matrices once. Unknown-owner release is a no-op. No run-time texture/material/geometry creation.
- src/city-logic.js:5 exports the prescribed ANCHOR_COUNTS for all future builders. createCityPieces throws at load if any implemented builder's anchor count disagrees.
- src/city.js:507 builds shared materials/pools and single portal groups; :523 caches 300 district plans and transformed portal board anchors at load; :556 extends existing assign. Chunk mirroring never reaches dress/portal/board text. Negative city metres stay Midtown. world.onRecycle chaining and unsubscribe are preserved.
- src/city.js:606 builds the 900 x 900 water plane at (0,-40,-300), using the existing water atlas; :616 updates water visibility from d-60/d/d+120 and links its colour/scroll to the day cycle. Bridge chunks are hidden; world's deck/rails/sleepers are untouched.
- src/warmup.js:44 visits every dress/portal geometry and material, including those not initially visible; :62 temporarily gives every board mesh at least one instance, then restores its exact count. Existing curve onBeforeCompile setter still chains the board hook.
- tools/test-skills.mjs:1476 tests the actual pool with lightweight Three adapters: 13 live segments over two loops, matrix/UV ownership after swap-remove, unknown release, reset to zero and future anchor counts. CPU peaks: tabela 27/32, ads 35/40, bugle 18/24; ads/bugle are simulated only.
- At this checkpoint unavailable task 5-7 pieces temporarily kept a working city chunk. That transitional fallback was removed after task 6 supplied every chunk-replacing piece.
- Checkpoint results: skills OK 218274 checks; patterns/quality/audio passed; node --check passed all 6 files touched in this continuation.

## Task 5 - complete in code
- src/city-pieces.js:41 lantern, :49 lanternString, :54 gate and :78 ctDress copy the approved recipes unchanged, including palette, shop x=+/-6.95, hanging marks, shop/name atlas rectangles and laundry. :99 ctFest merges ctDress(1) with the extra lantern string at z=0. Festival selection still waits for task 10.
- src/city.js:513 adds gate to the one-object portal pool; the existing district table selects Chinatown facades and both dress variants. Warm-up automatically includes all these new geometries. No extra texture/material.
- tools/test-skills.mjs:1621 checks the actual ct0/ct1/ctFest/gate anchor counts and compares the entire Chinatown recipe block with the approved source.
- Checkpoint results: skills OK 218279 checks; patterns/quality/audio passed; node --check passed all 6 files.

## Task 6 - complete in code
- src/city-pieces.js:175 shellGeo, :198 tunnelLights, :207 shell and :236 mouth copy the prototype unchanged, including inward section, baked lamp rhythm, cyan/magenta lines, concrete wall, hazard band and M roundel. Station people use rng from city-tex.js (:209).
- Required delta only: :160 tileQuad preserves the prototype UVs/size/position, deletes normal, adds white colour and converts to non-indexed; :233 station merges those eight wall quads with shellGeo(true).toNonIndexed(). No tunnelFlat material or extra wall mesh/board pool exists. Stations have only shellMesh + dressGlow, matching ordinary tunnel segments.
- src/city.js:507 creates MeshBasicMaterial({map: atlases.tunnel, vertexColors:true}); :566 fixed shellMesh uses it, :586 assigns its prebuilt geometry/visibility. The mouth is re-parented for the exit at z=-10, ry=PI. Existing warm-up's tunnel-kind loop uploads and compiles every shell/station variant; no extra warm-up branch is needed.
- src/city.js:622 gameover clears board ownership, portals, dress/shell visibility, day clock and announcer and restores Midtown scenery without touching gameplay distance/score. Normal run/menu resets use world's existing re-fire; pause freezes all city updates. dispose removes the matching event handler.
- tools/test-skills.mjs:1628 onward checks exact shell/mouth source recipes, inward section normals, the 112-triangle closed shell, 96-triangle merged station shell/wall, white tile colours and compatible attributes, every cached plan, exit board transform, single portal reuse and old-owner safety, bridge/Chinatown assignment, and gameover/restart cleanup.
- Checkpoint results: skills OK 222391 checks; patterns/quality/audio passed; node --check passed all 6 files. No task-7 builder or pool was started. All district geometry and chunk-plain bounding spheres are computed at load, with 81 assertions covering district bounds, to avoid first-visibility allocations during a run.

## Decisions and design numbers
- No design number, palette, size, position, light floor, phase boundary, district length, clear box or pool capacity was changed. No detail fallback was used. CONFIG.city.texScale stays 1.
- Implementation choices: 300 plans and transformed portal anchors cached at load to avoid recycling allocations; anchors stay unmirrored while only chunks mirror; station walls merged as ordered; gameover explicitly clears visual pool ownership. There are no new lights, post-processing, per-frame texture/material/geometry creation or generator RNG calls.
- r170 source compatibility was verified against the upstream meshbasic.glsl.js and uv_vertex.glsl.js: uv_vertex exists and vMapUv is available for the prescribed override. Actual GPU compile is unverified. Source: https://raw.githubusercontent.com/mrdoob/three.js/r170/src/renderers/shaders/ShaderChunk/uv_vertex.glsl.js and the sibling ShaderLib/meshbasic.glsl.js.

## Budget evidence and limits
- Actual renderer.info.render.calls/triangles at 0,1450,2800,3500,3650,4300 m, both before task 2 and now: UNAVAILABLE. Browser host returned 'The browser access host is unavailable'; native Edge returned 'Computer Use was not approved to use Microsoft Edge'. No workaround bypassed the denial. No phone FPS, adaptive step, shader screenshot or +0.5 s loader result is claimed.
- CPU primitive triangle accounting from the actual builders (box subdivisions, cylinder caps, sphere slices and planar extrusion upper bounds): bridge max 600, tower 364, vapur 236, Chinatown 3344, festival 4772, gate 648, ordinary tunnel incl. glow 376, largest station incl. glow 1324, mouth 284, dawn sign 48. These are recipe counts, not a captured GPU frame. They supersede the design's rough per-piece triangle estimates without changing a recipe.
- Station shell/wall has exactly 96 triangles and no separate wall call. Ordinary tunnel shell is 112 triangles. Each complete tunnel/station draws two meshes; bridge dressing replaces at most two chunk meshes. One global tabela mesh serves all name/shop pictures.
- Design-based draw accounting through task 6: a conservative Chinatown window is baseline 76 + 26 dress calls + gate 2 + tabela 1 = 105; the design's prototype 134k worst-case plus the prior coder's <=5018-triangle chunk-polish bound is about 139k. These are estimates tied to the design baseline, NOT proof of the 105/140k GPU ceilings. A browser capture is still required before acceptance; check-quality only tests adaptive resolution.
- Recalculated exact RGBA8 mip-chain inventory: 36,612,776 bytes new minus 5,941,936 deleted = +30,670,840 bytes (+29.25 MiB). Tasks 4-6 add ZERO textures. With the two future non-mipped atlases, projected full-stage net is +37.75 MiB, within the design's 38 MiB convention. Actual device allocation is unmeasured.
- Baseline chunk accounting retained from tasks 2-3: largest chunk 3370 -> 3430 triangles; largest same-variant increase 386; all 13 copies bound extra chunk cost by 5018 triangles.

## Last required check lines
- node tools/test-skills.mjs: OK 222391 checks
- node tools/check-patterns.mjs: OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
- node tools/check-quality.mjs: OK: adaptive resolution
- node tools/test-audio.mjs: OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)
- node --check: exit 0 for src/city.js, src/city-pieces.js, src/city-boards.js, src/city-logic.js, src/warmup.js, tools/test-skills.mjs. All earlier checks remain in the suite. git diff --check passed.

## Next coder - begin task 7, nothing beyond task 6 was started here
- Re-read HARITA. Add FRAME/TUBE/board/gantry/neonDress unchanged. pieces is a flat map of prebuilt recipes; add gantry to city's fixed portal list. Existing planAt collects tabela/ads/bugle anchors and applies portal transforms. It runs at load; rebuild those plans only after all recipes exist.
- Add ads pool (40) using the SAME atlases.neon texture object (its facade repeat is intentionally bypassed by the board UV hook). Add bugle pool (24) on the prescribed 2048x1024 black placeholder with the 16 slot frames, slot NIGHT=12. Do not implement real Bugle headlines before task 8.
- Extend dayCycle's board material list, presently tabela only. updateScenery, assign/release, gameover/dispose and warm-up already loop all pools. Warm-up temporarily renders one instance even if a pool starts empty.
- Midtown roof anchors remain in seg.city.anchors, already normal/mirrored as needed, unused until task 8. They are not currently in planAt's dress/portal anchor lists.
- Later task 10 must cache normal AND festival plans (current plans use loop 1); ctFest is prebuilt but not selected yet. Do not call the allocating dressFor helper in every recycle just to enable festival.
- No ordering or design choice blocks task 7. Its known visual question is Neon facade ad words cut at building edges (design open question 2). Default uses the shared atlas. A separate facade/ad atlas fallback costs ~5.3 MiB and would exceed the projected full-stage texture budget at texScale 1, so apply the design's texScale 0.5 fallback first if that visual fallback becomes necessary.
- Task 11 remains owner-gated and is outside this run. No obstacle selection, spacing, difficulty or fairness has changed.

## Human phone review still needed
- ?gun=1440: gate, jade roof, high lantern strings, shop names/laundry; ask an unfamiliar viewer whether lanterns read as obstacles.
- ?gun=2480 then 2700-3200: city fades to shore, cable rhythm, both stone arches with the sun, white Istanbul ferry/yellow funnel and pink water; next obstacle lane remains obvious.
- ?gun=3280 then 3500: METRO/hazard/M entry, lamps and two neon lines, clear glowing coins/amber rims, tiled station and silhouette crowd/red-cap kid; exit wall orientation and night transition. Neon gantry/boards wait for task 7.
- ?gun=5200: MIDTOWN sign at dawn. Check pause/resume, restart, gameover->menu and a second run for stale boards/portals/light. Check loader time and adaptive resolution on the owner's phone.
