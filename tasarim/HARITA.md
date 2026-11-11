# Örümcek Koşusu — code map

Read-only map for designer/coder agents. Every claim carries `file:line`.
Paths are relative to the repository root. Turkish UI strings are quoted as-is.

## 1 File map

### Entry and core

| File | Role | Key lines |
|---|---|---|
| `index.html` | page, import map, loader, HUD, all screens | 30-37 import map; 40-50 loader; 51 canvas; 55 `#ui`; 163 menu `data-music`/`data-sfx` row; 230 pause `data-music`/`data-sfx` row; 270 module entry |
| `style.css` | page frame only (full-screen canvas, no zoom/selection) | 1-30 |
| `ui.css` | every `#ui` component and comic theme | 25 `.lbl`; 38 `.btn`; 67 `.card`; 83 `.screen`; 265 `.hud`; 559 `.hud-timers`; 560 `.pgauge`; 959 toasts |
| `src/main.js` | renderer, scene, skins, system wiring, frame loop | 54-67 renderer/camera; 70-79 skins; 84-171 systems (163-165 RoadEvents); 181 fonts ready; 182 city; 186-193 input; 209-237 loop; 240 warm-up |
| `src/game.js` | run state, flow, per-frame update contract | 14-38 state (33-35 event fields); 45 mult (incl. `event`); 53 API; 69 `naturalSpeed`; 117 `emit('menu')`; 182-227 update; 230-258 reset |
| `src/config.js` | all tunables | 4 `CONFIG`; 6-37 core; 147-470 systems (372-395 `events`); 471-509 approved `city` tables and budgets |
| `src/events.js` | single `EventTarget` bus | 2-5 name contract (incl. `menu`, `newRecord {score}`, `districtEnter {id,lap}`); 9 bus; 11-13 `emit` |
| `src/player.js` | lanes, jump, gravity, slide, hitbox, model state | 39 class; 107-119 actions; 214-300 update |
| `src/world.js` | endless track segments and recycle callbacks | 24 `laneX`; 98 class; 131 `onRecycle`; 147 `update`; 199 blob shadow |
| `src/obstacles.js` | obstacle/coin/pickup system, row groups, pits, patches, event hits | 126 class; 149-160 hooks; 264 pickups; 305 event hits; 411 floor; 437 collide; 457-460 pit-only surf/drop exemption; 528 draw |
| `src/obstacle-art.js` | instanced obstacle and coin art, nine row/patch kinds | 40 `ShapeBuilder` (`rx/ry/rz`); 281-398 row recipes; 474 `createObstacleArt`; 481-498 kinds; 504-505 explicit coin/rim materials; 507 `addRow`; 525 `addPatch` |
| `src/event-logic.js` | pure event row/timing/reward maths | 8 rAt; 9 floorW; 11 warnAt; 12 restAt; 13 doubleChance; 16 nextRow; 34 nearestSafe; 43 rewardFor |
| `src/patterns.js` | pure seeded track generator | 49 `createRng`; 66-121 speed/difficulty/length; 128 `descLanes`; 136 `girderOffset`; 157 class; 192 `_block`; 330-342 extras; 345 `_row`; 361 `_placeRow`; 387 `_eventZone` |
| `src/road-events.js` | manual Venom event director, lifecycle, hits/sense/rewards; optional art injected | 11 constructor; 23 reset; 37 calm; 43 start; 62 update; 85 volley; 139 sense; 152 reward; 161 end; 172 hide |
| `src/chaser.js` | Venom chase/hunt, stumble, catch cam | 43 class; 57-59 hooks; 76 reset; 131 hunt; 139 endHunt; 149 stumble; 172 catch; 235 update |
| `src/intro.js` | start-of-run clip and its camera | 28 class; 37-47 phases; 67 `begin`; 80-134 update/emit |
| `src/camera.js` | follow rig, kick, dolly, shot blend | 24 class; 50-75 camera controls; 114 snap; 132 update |
| `src/input.js` | keyboard/swipe/tap/double-tap to actions | 19-29 `KEYMAP`; 37 `createInput`; 121-133 listeners |
| `src/curve.js` | curved-world material patch and bend state | 48-70 shader patch; 122 `curve`; 126 update; 157 `offsetAt` |
| `src/xray.js` | player silhouette through obstacles | 35 `createXray`; 14 render order |
| `src/lights.js` | hemisphere + one directional sun, no shadow maps | 7-15 |
| `src/quality.js` | adaptive pixel ratio | 9 `createAdaptiveRatio`; 28 `tick` |
| `src/warmup.js` | precompile/upload all city variants, district pieces, facade and board materials | 13 warmUp; 35 city geometry; 44 all dress/portal geometry; 62 temporary board instance counts |
| `src/city-pieces.js` | approved bridge/dawn/Chinatown/Metro recipes and anchor validation | 54 gate; 78 ctDress; 99 ctFest; 130 tower; 148 vapur; 160 tileQuad; 175 shellGeo; 209 station; 236 mouth; 266 createCityPieces |
| `src/city-boards.js` | fixed instanced atlas pool with swap-remove | 4 createBoards; 23 take; 33 release; 43 update; curve hook chains via existing setter |
| `src/daycycle.js` | scenery-only light/sky clock; explicit coin and rim references | 5 createDayCycle; 10 update; reusable phase/disc storage |
| `src/city-tex.js` | approved node-safe painters and shader source | 6 rng; 224/228 Midtown; 319/320 Chinatown; 388/393 Neon; 412 tunnel; 446 skyline mask; 488 sky shaders; 541 facadeHook; 577 water; 596-688 page helpers; 706 tabela; 731 shore |
| `src/city-logic.js` | pure district/day/dressing logic and anchor capacities | 5 ANCHOR_COUNTS; 16 districtInfo; 81 dressFor; 104 districtEvent; 110 createAnnouncer |
| `src/city.js` | pooled district chunks, atlases, cached dressing and last game system | 465 initCity; 507 materials/pools; 523 cached plans; 556 assign; 616 scenery update; 621 reset; 622 gameover cleanup |
| `src/fx.js` | event-driven comic VFX, own rAF | 478 `initFx`; 662-1404 handlers; 247-267 words |
| `src/vfxCore.js` | pooled toon particles, stickers, screen panels | 224 `ToonPool`; 451 `initVfx`; 560-663 spawners; 691-729 screen/impact |
| `src/pickup-art.js` | 3D pickup builders and 2D HUD power icons | 15 icon kinds; 811 `drawPowerIcon`; 959-2040 builders |
| `src/ui.js` | menu/HUD/pause/over/market/scores/share | 52-75 elements; 79-80 sound buttons; 95-100 timers; 123 screens; 152-158 market; 473-477 sound toggles; 657-663 hidden-page pause; 688-877 HUD; 890-895 frame |
| `src/audio.js` | Web Audio graph, SFX voices, mute settings, event glue | 18-19 settings/coin state; 25-28 toggle API; 37-77 `ensureContext`; 80-116 unlock + visibility; 117 `menu` listener; 120-129 claim/release; 287-304 coin voice; 306-541 `SOUNDS`; 544 `MIN_GAP`; 546-558 `play`; 564-592 event glue; 595-601 intro map; 603 `audioStats` |
| `src/audio-logic.js` | pure audio maths and tables (no Web Audio) | 1 storage keys; 2-11 load/save settings; 13 `hz`; 15-27 coin ladder; 29-36 `VoicePool`; 38-40 pool size + ducking; 42-120 music tables (chords, patterns, tiers, stinger gate) |
| `src/music.js` | synthesized layered music, tension bed and stingers | 35-67 `initMusic` graph + scheduler tick; 68-87 on/off, duck, stats; 90-121 voice factory; 123-274 instruments; 275-284 crackle; 286-404 sequencer, menu song, scene machine, run song; 405-417 caught + tension; 420-449 stingers; 450-499 gate + event listeners |
| `src/missions.js` | mission sets and score multiplier base | 16 key; 100-107 set advance; 136 state; 162-202 counting |
| `src/shop.js` | coin bank, upgrades, consumables, saves | 7-10 keys; 12-29 tables; 32-40 defaults; 70-197 API |

### Power-ups and hero skills

| File | Role | Key lines |
|---|---|---|
| `src/powerups/web.js` | web cartridge + zip/glide | 109 save read; 175 `web` event |
| `src/powerups/ironspider.js` | Iron Spider suit, inventory, save, saves | 39-50 storage; 124 `ironOn`; 184 deck-level pit save position; 188 `ironSave` |
| `src/powerups/hero-specials.js` | 8 hero modes, shared activation/absorb | 34 `HERO_SKINS`; 248 class; 300-308 configs; 336 activate; 674 Cap exit animation (no general grace); 819 absorb |
| `src/powerups/skillHelloKitty.js` | Hello Kitty flying heart | 129 class; 208-209 start; 338-339 end |
| `src/powerups/skillBatman.js` | Batman glide/cloak | 125 class; 273-274 start; 487-488 end |
| `src/powerups/skillSpiderman2002.js` | Raimi web slingshot | 19 icon; 221 anticipation; 337-338 launch |
| `src/powerups/skillIronMan.js` | Iron Man unibeam | 100 class; 220-221 start; 327 end |
| `src/powerups/skillBlackPanther.js` | Panther kinetic release | 70 class; 149-150 shockwave; 288 end |
| `src/powerups/sense.js` | spider-sense auto-dodge, pits/gates/girders and two-lane escapes | 131 simulation (actual Euler step + swept tail); 203 walls; 226-255 timer; 300 lane search; 329 two-lane fallback; 349 dodge |
| `src/powerups/magnet.js` | coin magnet | 27 class; 35-43 register; 85-117 pull |
| `src/powerups/bugle.js` | x2 score front page | 41-71 on/off |
| `src/powerups/spring.js` | high-jump shoes | 42-72 on/off |
| `src/powerups/swing.js` | 8 s web swinging + coin ribbon | 33 class; 50-58 register; 82 start; 108 place |
| `src/powerups/decoy.js` | one forgiven stumble and lure | 85-102 events |
| `src/powerups/wall.js` | wall run | 107-136 on/off |
| `src/powerups/tracer.js` | drone traces open lane, temp multiplier | 80-148 events |
| `src/powerups/flash.js` | start-of-run flash score boost consumable | 48 `flashBoost` |
| `src/powerups/repulsor.js` | Iron Man jet boost consumable | no event of its own |

### Models

| File | Role | Key lines |
|---|---|---|
| `src/models/toon.js` | shared toon material, outline, canvas/texture helpers, `TubeShape`, `PoseBlend` | 58 `toonMaterial`; 144 `addOutline`; 176-585 helpers |
| `src/models/heroKit.js` | merge sculpted extras into head/torso; swatch UVs | 89 `attach`; 117 `rangeToggle`; 143 `headPoint` |
| `src/models/spiderman.js` | shared Funko-style body builder and classic skin | 558 `createSpiderCharacter`; 1226 `createSpiderman` |
| `src/models/ironspider.js` | Iron Spider paint + four gold arms | 456 `createIronSpider` |
| `src/models/venom.js` | chibi Venom | 399 `createVenom` |
| `src/models/placeholder.js` | simple stand-ins for player/Venom | 56 player; 190 Venom |
| `src/models/hellokitty.js` | Hello Kitty skin | 117 `createHelloKitty` |
| `src/models/gwen.js` | Spider-Gwen skin | 181 `createGwen` |
| `src/models/miles.js` | Miles Morales skin | 119 `createMiles` |
| `src/models/raimi.js` | 2002 Raimi Spider-Man skin | 157 `createRaimi` |
| `src/models/mcu.js` | MCU Homecoming skin | 80 `createMcuSpidey` |
| `src/models/ironman.js` | Iron Man skin | 149 `createIronMan` |
| `src/models/panther.js` | Black Panther skin | 135 `createPanther` |
| `src/models/batman.js` | Batman skin with rigged merged cape | 172 `createBatman` |
| `src/models/cap.js` | Captain America skin with back shield | 188 `createCap` |
| `src/models/hulk.js` | Hulk skin | 147 `createHulk` |

### Tools and docs

| File | Role | Key lines |
|---|---|---|
| `tools/serve.py` | local no-cache server on port 5173 | 5-12 |
| `tools/check-patterns.mjs` | fairness/solvability invariant test | 1-20 contract; 22-23 imports |
| `tools/check-quality.mjs` | adaptive-resolution assertion script | 1-23 |
| `tools/test-skills.mjs` | powers/missions/audio and 11.3/11.5 assertions | 23 route/clock; 96 announcer; 102 painters; 1389 Cap pit exit; 1466 shared U; 1476 board pools/recipes/Metro/wiring/reset; 1753 director; 1886 allocation guard; 1908 audio |
| `tools/test-audio.mjs` | fake `AudioContext` lifecycle + music/stinger/leak soak; imported by `test-skills.mjs`, also runnable alone | 24-79 fake context; 81-95 pump + cap asserts; 97-202 behaviour asserts |
| `tools/test-ui-hud-qa.mjs` | DOM-mocked HUD/market QA for 8 heroes | 1-2 |
| `tools/test-hero-specials-qa.mjs` | simulation QA of 8 specials | 1-2 |
| `tools/test-qa-deep-audit.mjs` | regression suite for 3 hero fixes | 1-2 |
| `tools/stub-hooks.mjs` | node resolver stubs for `three`, world, curve, pickup/obstacle art | 1-6; 8-67 |
| `PLAN.md` | product plan; section list only used here | 30-82 sections 1-9; 177-211 §10; 213-266 §11 |
| `README.md` | run notes | not mapped |
| `AGENTS.md` | lazy-senior working rules | not mapped |
| `viewer.html`, `audio-test.html` | model/audio sandboxes | `audio-test.html` 47-48 imports `isSfxOn/setSfxOn`, 107-108 toggles them; `viewer.html` not mapped |
| `tasarim/11-1-ses-muzik.md`, `tasarim/proto/*` | design notes/prototypes | not mapped |

## 2 Boot and frame order

1. `index.html` loads Google fonts and `style.css` + `ui.css` (13-15), then the import map for `three@0.170.0` (30-37), then `src/main.js` as a module (270).
2. `main.js` imports config/events/game/world/player/systems/models/UI (4-52); side-effect imports are at 49-52.
3. Renderer/quality/output (55-59); scene/fog/lights (61-64); camera/rig (66-67).
4. World (70); all skins built once and saved skin selected (73-76); player and hidden skin roots (77-79).
5. Shadow (81-82); `game.init` (84).
6. System order: obstacles (85), chaser (89), web (92), Iron Spider (98), sense (138), magnet (141),
   bugle (144), spring (147), swing (150), decoy (154), wall (157), tracer (160), RoadEvents (163),
   flash (166), repulsor (169). Hero specials belong to web.
7. Front/side absorb hooks (102-113), catch absorb (114-119), double action (120-126); decoy chains
   the chaser's side-stumble hook and RoadEvents never replaces it.
8. Skin switching (127-137); road event director is exposed as `game.roadEvents` (165).
   It receives no event art yet, and installs no zone hook (manual Venom only until task 13).
9. Scene/camera/rig assigned (176-179), intro (180), font readiness (181), city/fx (182-183), `window.game` (184). City registers the last system.
10. Input reset on start/resume/intro end (187-193); resize (196-205); initial camera snap (206).
11. Warm-up (240) compiles/uploads behind the loader, including the explicit city textures.

Frame loop (`main.js:209-237`): dt capped at CONFIG.dtCap (211); quality tick (213);
game update (216); curve/chaser bank (218-219); camera unless paused (220); xray (221);
shadow (224-234); render (236).

`game.update` order (`game.js:182-227`):

1. paused returns (182); hit-stop consumes time and returns (183-186); intro drives clip and returns (187-190).
2. While running and not `halted`: advance time, natural speed, speed override/fade, distance, `world.update`, then every system `beforePlayer(dt)` (194-215).
3. `player.update(dt, running)` always (217).
4. While running: every system `update(dt)` (220), compute `mult.factor` from `bugleTime`, `state.multiplier` incl. `mult.event`, then distance score + coin score (222-225).

`_resetRun` order (`game.js:230-258`): score/coins/distance/speed/multipliers (`run`/`temp`/`event`/`factor`)/time/webCharges/flags, then `world.reset()`, `player.reset()`, every system `reset()`, intro reset. `ironCount` is persistent inventory and is deliberately not reset (252).

## 3 Event bus

`events.js` is a single `EventTarget` (9); `emit(name, detail)` dispatches a `CustomEvent` (11-13). Cross-system communication goes through it; UI only reads `game.state` and calls game methods (`game.js:1-2`).

Audio auto-listens to **every** `SOUNDS` key except `start` and `i_*` (`audio.js:589-592`), so any event named in `SOUNDS` also plays a sound. `music.js` adds its own listeners for `venomNear`, `venomFar`, `pickup`, `missionDone`, `missionSet`, `gameover`, `newRecord` (455-499); `audio.play()` skips the `gameover` SFX while music is on (`audio.js:548`). `fx.js` skips events whose detail has `quiet: true` (`fx.js:669`); `vfxCore.sfx()` emits with that flag (`vfxCore.js:727-729`).

| Event | Emit site(s) | Detail | Listeners |
|---|---|---|---|
| `start` | game.js:101 (first), :108 (restart) | `{restart}` | audio.js:564; chaser.js:59; shop.js:204; vfxCore.js:457; ui.js:612; main.js:188 |
| `pause` | game.js:134 | `{}` | audio.js:574; missions.js:196 |
| `resume` | game.js:140 | `{}` | audio.js:581; main.js:192 |
| `districtEnter` | city.js:637 via city-logic.js:110 createAnnouncer | `{id, lap}`, once at start, then 60 m ahead | 11.2 may listen; no polling |
| `menu` | game.js:117 (`toMenu`) | none | audio.js:117 (clears `paused`, resumes context); tools/test-skills.mjs:988. missions.js:198's comment "toMenu emits no event" is stale |
| `gameover` | game.js:147 | `{score, coins, distance}` | audio auto (SOUNDS `gameover`, skipped while music is on: audio.js:548); music.js:487 (closing phrase); missions.js:195; shop.js:219; vfxCore.js:456; ui.js:606; road-events.js:17 (abort/reset) |
| `newRecord` | ui.js:608 (only when the run beat the best) | `{score}` | music.js:495 (record fanfare) |
| `intro` | intro.js:75 start, :116 end (`skipped?`), :132 each phase | `{phase}` / `{phase:'end',skipped}` | audio.js:596; fx.js:1322; main.js:192 |
| `lane` | player.js:129 | `{dir, lane}` | audio auto; fx.js? no `lane` handler; missions COUNTED (missions.js:166) |
| `jump` | player.js:151; skillSpiderman2002.js:337 | `{}` | audio auto; fx.js:700; missions COUNTED (163-164) |
| `land` | player.js:246; skillSpiderman2002.js:256 | `{}` | audio auto; fx.js:771 |
| `slide` | player.js:206 | `{}` | audio auto; fx.js:801; missions COUNTED (165) |
| `pickup` | obstacles.js:405 | `{type, position}` | fx.js:864; music.js:465 (crash stinger + duck); missions.js:177 (also type missions `magnet`, `bugle`) |
| `stumble` | obstacles.js:496 | `{position}` | audio auto; fx.js:829; missions.js:194 (resets no-stumble run) |
| `crash` | obstacles.js:502 | `{position}` | audio auto; fx.js:842 |
| `coin` | obstacles.js:519; magnet.js:126 | `{position}` | audio auto; fx.js:671; missions COUNTED (163) |
| `eventStart` | road-events.js:59 | `{kind,duration}` | later tasks 8/12/13/14 |
| `strikeWarn` | road-events.js:95 | `{lanes,warn}` | later art/FX/audio |
| `strikeSlam` | road-events.js:106 | `{lanes}` | later art/FX/audio |
| `strikeHit` | road-events.js:116 | `{position}` | later FX/audio; shared side-hit also emits stumble |
| `eventDodge` | road-events.js:127 | `{kind,position}` | later FX/missions/audio |
| `eventReward` | road-events.js:157 | `{kind,coins,mult,clean,position}` | silent run-coin deposit; later FX/HUD/audio |
| `eventEnd` | road-events.js:169 | `{kind,clean,hits,dodged,aborted}` | later FX/missions/audio |
| `eventBonusOff` | road-events.js:71 | `{}` | event multiplier expires; later HUD/audio |
| `rowWarn` | obstacles.js:346 | `{type, open, position}` | none yet (task 12/14) |
| `rowPass` | obstacles.js:350 | `{type, position}` | none yet (task 12/13/14) |
| `gapPatch` | obstacles.js:319 | `{position}` | none yet (task 12/14) |
| `web` | web.js:175; sfx in skillSpiderman2002.js:220 | `{from, to}`; quiet variant may carry `{from:number,to:0}` | audio auto; fx.js:885 (quiet skipped) |
| `venomNear` | chaser.js:177, :253 | `{}` | audio auto; fx.js:1303; music.js:455 (tension in) |
| `venomFar` | chaser.js:166, :258 | `{}` | audio auto; fx.js:1304; music.js:461 (tension out) |
| `caught` | chaser.js:275 | `{}` | audio auto; fx.js:859; music.js:405 (bar break + duck) |
| `missionDone` | missions.js:147 | `{id, text}` | ui.js:435; music.js:472 (bell run, coalesced) |
| `missionSet` | missions.js:151 | set object incl. `multiplier` | ui.js:436; music.js:481 (set chord) |
| `ironOn` | ironspider.js:124; skillIronMan.js:220 (`sfx`) | `{}` / `{position,quiet}` | audio auto; fx.js:917 |
| `ironOff` | ironspider.js:166; skillIronMan.js:326 (`sfx`) | `{}` / `{quiet}` | audio auto; fx.js:928 |
| `ironSave` | ironspider.js:188 | `{positions}` | audio auto; fx.js:940 |
| `ironGrab` | ironspider.js:153 | `{position}` | fx.js:755 |
| `senseOn` | sense.js:234 | `{}` | audio auto; fx.js:1016 |
| `senseOff` | sense.js:254, :227 reset | `{}` / `{reset:true}` | audio auto; fx.js:1023 |
| `senseDodge` | sense.js:355 | `{action, position}` | audio auto; fx.js:1028; missions COUNTED (171) |
| `magnetOn` | magnet.js:57 | `{}` | audio auto; fx.js:1054 |
| `magnetOff` | magnet.js:81, :50 reset | `{}` / `{reset:true}` | audio auto; fx.js:1055 |
| `magnetCoin` | magnet.js:115 | `{position}` | fx.js:1056 |
| `bugleOn` | bugle.js:49 | `{}` | fx.js:1095; missions type mission (missions.js:180) |
| `bugleOff` | bugle.js:71, :41 reset | `{}` / `{reset:true}` | fx.js:1105 |
| `springOn` | spring.js:50 | `{}` | fx.js:1082 |
| `springOff` | spring.js:72, :42 reset | `{}` / `{reset:true}` | fx.js:1086 |
| `swingOn` | swing.js:94 | `{duration}` | fx.js:1143; missions COUNTED (168) |
| `swingOff` | swing.js:103 | `{}` / `{reset:true}` | fx.js:1172 |
| `swingArc` | swing.js:151 | `{side}` | fx.js:1160 |
| `decoyOn` | decoy.js:85 | `{duration, position}` | fx.js:1200; missions COUNTED (169) |
| `decoyLure` | decoy.js:86 | `{position}` | fx.js:1209 |
| `decoyUse` | decoy.js:94 | `{position}` | fx.js:1226 |
| `decoyOff` | decoy.js:102 | `{}` / `{reset:true}` | fx.js? no handler; no listener found |
| `wallOn` | wall.js:107 | `{duration, side}` | fx.js:1235 |
| `wallOff` | wall.js:136 | `{}` / `{reset:true}` | fx.js:1250 |
| `tracerOn` | tracer.js:80 | `{duration}` | fx.js:1262 |
| `tracerOff` | tracer.js:91 | `{}` / `{reset:true}` | fx.js:1294 |
| `tracerLost` | tracer.js:138 | `{position}` | fx.js:1284 |
| `tracerStep` | tracer.js:148 | `{temp, position}` | fx.js:1274; missions COUNTED (170) |
| `flashBoost` | flash.js:48 | `{bonus}` | fx.js:1108; ui.js:437 |
| `specialOn` | hero-specials.js:360, 381, 399, 419, 427; skillBatman.js:274; skillHelloKitty.js:209; skillBlackPanther.js:150 | `{mode, duration, label?}` | no listener found |
| `specialOff` | hero-specials.js:913; skillBatman.js:488; skillHelloKitty.js:339; skillSpiderman2002.js:390; skillBlackPanther.js:288 | `{mode?, expired?}` | no listener found |
| `hulkRoar` | hero-specials.js:359 | `{}` | audio auto |
| `capShieldSurf` | hero-specials.js:380 | `{}` | audio auto |
| `milesVenomBlast` | hero-specials.js:398 | `{}` | audio auto |
| `hulkSmash` | hero-specials.js:537, 571 (`sfx`) | `{position, quiet}` | audio auto; fx.js:964 |
| `capShieldGong` | hero-specials.js:857 (`sfx`) | `{position, quiet}` | audio auto; fx.js:975 |
| `venomBlastNova` | hero-specials.js:864; skillIronMan.js:235 (`sfx`) | `{position, quiet}` | audio auto; fx.js:985 |
| `slingshotAnticipation` | skillSpiderman2002.js:221 | `{charges}` | no listener found |
| `slingshotLaunch` | skillSpiderman2002.js:338 | `{vy, speedBoost}` | no listener found |
| `kittyFlyStart` | skillHelloKitty.js:208 | `{duration}` | no listener found |
| `kittyHeartBurst` | skillHelloKitty.js:323 | `{position}` | no listener found |
| `kittyFlyEnd` | skillHelloKitty.js:338 | `{}` | no listener found |
| `batmanGlideStart` | skillBatman.js:273 | `{duration}` | no listener found |
| `batmanCloakSweep` | skillBatman.js:471 | `{position}` | no listener found |
| `batmanGlideEnd` | skillBatman.js:487 | `{expired}` | no listener found |
| `vibraniumShockwave` | skillBlackPanther.js:149 | `{position}` | no listener found |
| `vibraniumShatter` | skillBlackPanther.js:243 | `{position}` | no listener found |
| `vibraniumAbsorb` | skillBlackPanther.js:275 | `{position}` | no listener found |
| `unibeam` | skillIronMan.js:221 | `{position}` | no listener found |
| `unibeamEnd` | skillIronMan.js:327 | `{expired}` | no listener found |

`fx.js` also listens to `start` (clear all) and `gameover` (1397-1404). `missions.js` listens to the counted events plus `pickup`, `stumble`, `gameover`, `pause` (162-196). No power-up system subscribes to the bus; power-ups call each other directly.

## 4 Player

`Player` owns only x and y; z stays 0 (`player.js:1-3`).

| Concern | Facts |
|---|---|
| Construction | group named `player`, hitbox `Box3`, hooks `onAirUp`/`onDoubleAction` (40-50) |
| Model swap | `setModel` removes previous root (53-58); `useModel` keeps both roots and toggles visibility (60-69) |
| Reset | lane center, x from `laneX`, y/vy/floor 0, grounded, slide/queue/coyote/override flags, state `idle` (71-100) |
| Actions | `left/right/up/down/double/special/flash`; `tap` ignored while running (107-119) |
| Lane change | bounds-checked; `_laneT` eased with smoothstep over `CONFIG.laneSwitchTime` (122-131, 218-223) |
| Bounce back | side hit returns to previous lane only mid-change (134-142) |
| Jump | `vy = sqrt(2*g*h)`, default height `CONFIG.jumpHeight * jumpScale()`; emits `jump` (144-152) |
| Override | `setOverride(name, seconds)` / `clearOverride`; `Infinity` persists (154-162) |
| Up | grounded/coyote jumps; near-floor falling press queues a jump; otherwise `hooks.onAirUp` (164-177) |
| Down | airborne fast drop (`fastDropSpeed`), queues slide if `slideAfterDrop`; grounded starts slide unless recovering (179-191) |
| Rescue slide | sense.js can force a slide ignoring recovery (194-199) |
| Slide | duration `slideDuration`, recover `slideRecover`, emits `slide` once (201-212) |
| Vertical update | follows floor, leaves edge into coyote fall, gravity * `gravityScale`, landing emits `land`, queued jump/slide fires (225-253) |
| Model state | `override` > `idle` (not running) > `slide` > `jump` > `run` (276-287) |
| Visuals | root placed at x/y; lean/bank damped (289-296); `model.update(dt, game.state.speed)` (298) |
| Hitbox | width/depth from config, height `slideHeight` while sliding (302-308) |
| Locks | `controlsLocked` blocks input; `verticalLocked` blocks up/down and swing/wall own height (16-18, 108, 165, 180) |

Extension points documented at `player.js:5-24`: `onAirUp`, `onDoubleAction`, `floorY`, `jump(height)`, `gravityScale`, `setOverride`, `controlsLocked`, `verticalLocked`, `setModel`/`useModel`, `hitbox`, `lastX`/`lastY`, `bounceBack`.

## 5 Obstacles and collisions

`Obstacles` owns pools and all collision outcomes (`obstacles.js:126-170`). The generator emits the
`gap` / `gate` / `girder` rows and the `event` zones (`patterns.js:345`, `387`); rows collide and draw
normally, a zone only calls `hooks.onEventZone`, still the default no-op (`obstacles.js:153`, `211`), so
no road event starts on its own before task 13 — `game.roadEvents.start('venom')` is the only entry.

| Concern | Facts |
|---|---|
| Generator | `PatternGenerator(1)`; optional fixed `CONFIG.seed` (132-134) |
| Pools | obstacles `_pool`, coins `_coinPool`, pickup pools per kind, pending trains; scrolling `patches` cleared by reset (136-145, 176-180) |
| Hooks | `onFrontHit`/`onSideHit` absorb; `onSideStumble` reacts after stumble (chain wrappers); `onCrash`; `onEventZone(desc)` default no-op (149-160, 211) |
| Row groups | `gap`/`gate`: 3 lane colliders; `girder`: centre + covered outer lane; `descLanes` once at spawn, shared `group`, one `owner`; pool reuse resets row flags (212-244) |
| Row removal | requested collider spliced immediately, mates sent to `z = 1e6` for next-frame release; gap leaves one patch and emits `gapPatch` (313-325) |
| Row events | owner emits `rowWarn {type,open,position}` at tau <= 2.4; `rowPass {type,position}` after the swept far face clears (`z - dz - length`), only if no group member hit (342-351) |
| Default crash | lock controls, `caught` pose, `game.gameOver()` (154-158) |
| Generation trigger | `world.onRecycle` computes far distance and generates (162-165) |
| Movement | obstacles move `(runSpeed + ownSpeed) * dt`; coins/pickups/patches move at run speed; release behind `CONFIG.obstacles.releaseZ` (331-378) |
| Train spawn | `_spawnTrains` called every `beforePlayer` (376) |
| Floor | `_floorUnder` checks overlap/top/stepUp; ramps rise with speed; `pit` parts never supply a floor (411-434) |
| Collision gate | `_graceTimer > 0` disables collision; `grace(seconds)`, `graced`; `eventHit(x)` enters shared side-hit path unless graced (301-310, 437-438) |
| Pit collision | feet below `gap.pitTop`, entering or falling from above = front hit; active Cap surf ignores pits; exit only exempts pits while the shield exit animation is active, lastY is above floorY and vy ≤ 0 (`obstacles.js:457-460`). Gates/girders retain swept hits; no general exit grace (`hero-specials.js:674`) |
| Swept test | player current and previous x/y, swept z span `[pfMin, fMax]` so thin bars cannot tunnel (439-483) |
| Hit side | front/side decided by separation and crossing time; jump-up-into-bar and fall-into-pit count front (462-478) |
| One hit | returns after the first hit per frame (480-481) |
| Side hit | absorbed hook first; cooldown `sideHitCooldown`; bounce, `stumble` pose, emit `stumble`, then `onSideStumble`/`onSideHit` (490-499) |
| Front hit | `onFrontHit` may absorb; else emit `crash`, call `onCrash` (501-503) |
| Pickup registration | `registerPickup(kind, {create, onCollect})` stores a pool (264-266) |
| Pickup placement | pooled art root, visible, world position (268-279); release returns to pool (281-286) |
| Pickup collect | box ~1 m tall, origin at bottom (`s = 0.55`), x/y/z overlap, then `onCollect()`, emit `pickup`, release (393-407) |
| Extra coins | `obstacles.extraCoins` is drawn with normal coins (magnet.js:33) |
| Coin collect | box `coins.pickupSize`, increments `state.coins`, emits `coin` (506-522) |
| Draw | art `begin/add/addRow/addPatch/addCoin/end(time)`; owner draws once, removed mates skipped (525-537); rows animate by tau, patches retain hole + ends |

Obstacle descriptors are plain objects made by `patterns.js` (the header comment at 6-13 lists only the
pre-11.5 kinds). Collision reads `o.parts` with per-part `x0/x1`, `f0/f1`, `y0/y1`, optional `ramp` or
`pit` (`obstacles.js:33-114`, 411-481). The new forms: `{ type: 'gap', lane, d, len }` and
`{ type: 'gate', lane, d, len }` (all three lanes, `lane` unused), `{ type: 'girder', lane, d, len, open }`
(`open` = the free outer lane, 0 or 2) and `{ type: 'event', kind, d, len }`.

## 6 Pattern generator

Pure logic, no Three.js (`patterns.js:1-2`), so node tests can run it.

| Function | Line | Purpose |
|---|---|---|
| `createRng(seed)` | 49 | mulberry32; one stream per track |
| `randomSeed()` | 60 | uint32 seed |
| `speedAt(d)` | 66 | expected speed from the three acceleration phases |
| `difficultyAt(d)` | 80 | 0→1→`difficultyMax`, then logarithmic endless growth |
| `endlessK(diff)` | 90 | endless share 0→1 |
| `descLength(desc)` | 96 | track length of a descriptor (`gap`/`gate`/`girder` use `len`) |
| `trainSpawnD(meetD, speed)` | 115 | where an oncoming train appears |
| `descLanes(desc)` | 128 | lanes a row covers: gap/gate `[0,1,2]`, girder `[1, 2 - open]`, else `[lane]` |
| `girderOffset(tau, open)` | 136 | signed x of the girder's swing (art only; parks at `lockTime`) |
| `PatternGenerator` | 157 | `reset`, `addExtra`, `generateUntil`, `_block`, route/coin helpers |

`_block` (192-343) generates a block. Safe-start blocks have only coins. Once a row or zone
is due, all lanes drain in calm blocks, then a row or zone is placed; the block stretches to its end.
Ordinary blocks retain route changes, route obstacles/combos, side obstacles/trains and coin rows.
Extras run once on **every** block, including safe-start, calm, row and zone blocks (330-342).
They receive `{rng, A, B, speed, difficulty, route, routeFree, pickups, farFromPickup, push}`;
`routeFree` is null on special/calm blocks and within `events.pickupClear` of a due zone.
Pickup extras still consume their one roll before early return; tracer records all block routes.

`_row` (345) selects unlocked gap/gate/girder types without consecutive repeats; endless adds
gap/gate combos, with a full 0.6 s run-up for each partner. `_placeRow` (361) places all-lane
jump/slide rows or a parked two-lane girder, with two lane-change windows to its open outer lane.
`_eventZone` (387) alternates Venom/Goblin zones from 1200 m, keeps all lanes empty, suppresses
pickups before zones and rows for 120 m afterwards. Zone hooks remain no-ops until task 13.

`tools/check-patterns.mjs` checks C1-C14: lane-expanded cells, coin profiles, gap jump timing
(including 20 FPS swept-tail viability), row approach/landing, girder swing/locked clearance,
zone emptiness/length/spacing/pickup clearance, owner-counted art and patch lifetime capacities,
all old invariants and the unchanged route search/per-minute reaction margin.

## 7 Chaser / Venom and road events

`Chaser` (chaser.js:43) owns the chase and catch camera; its original modes are away, intro,
near, catch, lunge, caught. Constructor installs side-stumble/crash hooks (57-58); decoy wraps
side-stumble later. RoadEvents uses `obstacles.eventHit` and leaves this chain intact.

| Concern | Facts |
|---|---|
| Reset | clears spare/hunting/pose; normal away/hidden state (76-91) |
| Hunt | near, infinite timer, one spare hit, hunting=true (131-137) |
| End hunt | clear spare/hunting/pose; if still near, drop back when clean or nearTime when hit (139-147); never replaces catch mode |
| Stumble | catching guard, then consume hunt spare; otherwise existing near -> absorbCatch or catch (149-163) |
| Catch | halt/lock player, choose shot side, knockback (172-199); shot aim (202-210) |
| Near gap | camera projection, current root scale, hunting screenShare from events.venom (216-233) |
| Update | existing chase/catch machine, forced pose except while catching, hunting scale target (235-324) |
| Placement | model/shadow follow player/floor (326-337) |

`RoadEvents` (road-events.js:10) is registered after tracer (main.js:163-165). It owns eventKind,
eventTime, eventBonusTime and mult.event, and has its own RNG derived from the obstacle seed.
Only `game.roadEvents.start('venom')` starts events: running, >=1200 m, chaser away, no flight,
special, zip, tracer, speed override or locked controls. No onEventZone hook is installed yet.
Venom starts with one spare, then aimed rows use pure nextRow warnings and nearestSafe for sense.
Hits go through the shared side-hit path, with one hit per strike; a halt aborts immediately.
Finish grants silent coins and +3 clean / +1 survived for 12 s, then ends the hunt. The closing
pose starts at 8.8 s; reward/end happen at 10 s (S.2); an early zone boundary finishes before any
new slam. Pause/hit-stop freeze dt; restart/menu/gameover clear event state and reward clocks.

Art is optional and injected; the director imports no art module and reset/end hide supplied
objects. Task 8 must add warnings/tendrils and camera dolly ownership (cameraRig/venom.dolly are absent until then); task 9 adds Goblin logic;
task 13 connects zone scheduling. The gameover listener aborts without reward and resets (17-20). Slam collision scans the deadly mask directly (110-111); array/position helpers run only for discrete event payloads (149-150). Pending zone storage is deferred to task 13. Task 9 must replace the Venom-only start guard, timer/dispatch and hunt lifecycle together (43-59, 76-82, 161-170).

## 8 Power-up recipe

A **timed ground pickup** needs all of the following touch points. `magnet.js` and `swing.js` are the reference pair.

| # | Touch point | Evidence / required edit |
|---|---|---|
| 1 | `CONFIG` group | Add a group like `magnet` (config.js:271-284) or `swing` (305-321): `duration`, `pickupChance`, `pickupMinGap`, `pickupY`, `pickupScale`. Global spacing is `CONFIG.pickups.minGapAny` (207-210). |
| 2 | Game state | Add a timer/flag beside `state.magnetTime` / `state.swingTime` (game.js:25-35). `_resetRun` zeroes only some timers (248-251); each system's `reset()` owns its own. |
| 3 | Timer source | Use `getEffectiveSkillDuration('<key>')` (shop.js:88-93), never the raw config duration. |
| 4 | New `src/powerups/<name>.js` | Constructor: `obstacles.registerPickup(kind, {create, onCollect})` (magnet.js:35-42, swing.js:50-57), then `obstacles.generator.addExtra(ctx => this._place(ctx))` (magnet.js:43, swing.js:58), then `this.reset()`. |
| 5 | Reset | Return flying objects to pools, emit `<kind>Off {reset:true}` only if active, zero timer (magnet.js:47-52). |
| 6 | Start | Set timer, emit `<kind>On {duration}` once if it was off (magnet.js:54-58, swing.js:82-95). Swing also refuses while another owner of height is active (swing.js:82-85). |
| 7 | Placement | `_place(ctx)`: one `ctx.rng()` roll, reset the per-instance last-pickup distance if the generator reset, require `ctx.routeFree` and `ctx.pickups === 0`, minimum free length 4, own `pickupMinGap`, `ctx.farFromPickup(d)`, then `ctx.push({type:'pickup', kind, lane:ctx.route, d:(d0+d1)/2, y:pickupY})` (magnet.js:62-71, swing.js:108-117). |
| 8 | Per-frame | `beforePlayer(dt)` for movement/height/pull; `update(dt)` for countdown; stop on `game.halted` (magnet.js:73-117, swing.js:120-164). |
| 9 | Main wiring | Import in `main.js` (13-24), construct after `obstacles` exists (137-167), `game.addSystem(x)`, `game.<name> = x`. Timing matters: decoy is deliberately built after chaser (152-155). |
| 10 | 3D art | Add `create<Name>Pickup()` in `pickup-art.js`, pooled by `obstacles.registerPickup`; the builder returns `{root, update(dt)}` (e.g. magnet 994, swing 1238, decoy 1788). `warmup.js:26-33` instantiates every registered kind once. |
| 11 | 2D icon | Add a branch to `drawPowerIcon(canvas, kind)` (pickup-art.js:811-840) and the kind to `ui.js:94` timer list. |
| 12 | HUD markup | Add `<div class="pgauge <kind>" id="h-<kind>"><canvas></canvas><div class="track"><div class="fill"></div></div>` beside index.html:98-129. |
| 13 | HUD CSS | Add `.pgauge.<kind> .fill` gradient beside ui.css:589-596; base gauge at 560-588. |
| 14 | HUD read | Add `updateTimer(timers[i], st.<kind>Time)` beside ui.js:830-837; order must match ui.js:94. |
| 15 | FX | Add `on('<kind>On')`, `on('<kind>Off')` (and any per-tick event) beside fx.js:1054-1301. Emit with `quiet:true` via `sfx()` only when the effect draws itself (vfxCore.js:726-729). |
| 16 | Audio (optional) | Add a `SOUNDS.<event>()` function (`audio.js:306-541`); the auto-listener at `audio.js:589-592` then subscribes it, so the name must not start with `i_`. Music ducking goes in `DUCK_SFX` (`audio-logic.js:40`), a fanfare in `ST` (`music.js:420-448`). |
| 17 | Missions | Add the event to `COUNTED` (missions.js:162-173); the `pickup` counter is automatic (177-182). Per-frame metrics go in `MEASURED` (187-192). |
| 18 | Shop upgrade | Add a key to `SKILL_UPGRADE_CONFIG` (shop.js:12-23) and to `defaults().upgrades` (35); market lists keys automatically (ui.js:337-359). |
| 19 | Tests | Extend `tools/test-skills.mjs` (powers/swing) and, if it changes generation, `tools/check-patterns.mjs`. Headless imports may need stubs in `tools/stub-hooks.mjs:41-66`. |
| 20 | Pickup collision shape | No edit needed, but know the box: origin at bottom, ~1 m tall, half-size 0.55 (obstacles.js:398-403). |

Existing timed/ground and charge power-ups:

| Kind | File | Config | Behaviour |
|---|---|---|---|
| web cartridge | `powerups/web.js` | config.js:212-233 | up to 3 charges; not timed; zip/glide |
| iron core | `powerups/ironspider.js` | 235-252 | persistent inventory; 12 s suit; save on hit |
| sense | `powerups/sense.js` | 257-288 | 5 s auto-dodge; pit jump, gate slide, girder lane escape; two-lane fallback 329-345 |
| magnet | `powerups/magnet.js` | 271-284 | 5 s coin pull |
| bugle | `powerups/bugle.js` | 286-293 | 10 s score factor 2 |
| spring | `powerups/spring.js` | 295-303 | 10 s jump ×2.2 |
| swing | `powerups/swing.js` | 305-321 | 8 s swinging + air coin ribbon |
| decoy | `powerups/decoy.js` | 323-331 | 20 s, one forgiven stumble |
| wall | `powerups/wall.js` | 333-348 | 6 s wall run |
| tracer | `powerups/tracer.js` | 350-365 | 10 s drone + temp multiplier up to +3 |

Hero specials are **not pickups**: they are activated with a web charge on a hero skin (`main.js:120-126`; `game.web.tryActivate()`).

| Skin | Mode | Duration | Extra |
|---|---|---|---|
| Hulk | `hulk` | 6.0 s | smash |
| Captain America | `cap` | 8.0 s | shield surf |
| Miles | `miles` | 7.0 s | venom blast |
| Hello Kitty | `kitty` | 8.0 s | flying heart |
| Batman | `batman` | 8.0 s | glide/cloak |
| Raimi Spider-Man | `raimi` | 3.0 s | slingshot, capacity 2; one charge per activation |
| Iron Man | `ironman` | 2.2 s | unibeam |
| Black Panther | `panther` | 5.5 s | vibranium shock |

Durations and labels: `hero-specials.js:300-308`; `HERO_SKINS` at 34; activation/absorb at 336-438 and 820-881.

## 9 UI

`index.html` owns the DOM; `ui.js` owns behaviour; `ui.css` owns styling (index.html:53-55).

| Area | DOM | Behaviour |
|---|---|---|
| Loader | `#loading` inline markup/CSS (index.html:17-43) | removed when `game.ready` (ui.js:877-889) |
| Canvas | `#game` (51) | renderer target (main.js:55-56) |
| HUD | `#hud` (69-144) | score/coins/mult (71-73), pause (74), web gauge (77-84), iron badge/bar (86-94), 8 power gauges (98-129), repulsor (132-135), flash (138-141) |
| Menu | `#scr-menu` (146-171) | name, best, play, help, character, market, missions, sound row (163) |
| Skin | `#scr-skin` (173-192) | skin cards |
| Market | `#scr-market` (194-204) | wallet + `#mk-list` |
| Help | `#scr-help` (206-222) | controls |
| Pause | `#scr-pause` (224-235) | resume/restart/menu, sound row (230) |
| Over | `#scr-over` (237-265) | score/coins/distance/best, top-5, again/market/share/menu |

`ui.js` screen flow:

| Concern | Facts |
|---|---|
| Element cache | `el` map 52-75; required `hud` + `menu` else abort 76-78; sound buttons collected by attribute 79-80 |
| Screen map | `intro/hud/menu/market/skin/help/pause/over` (77) |
| Desired screen | mode + intro + `overAt` delay (135-144); `OVER_DELAY_MS = 750` (31) |
| Show | toggles `hidden`, blurs focus, repaints menu/market, resets HUD cache, repaints sound labels on menu/pause (123-133) |
| Sound toggles | `paintToggle`/`paintSound` (473-477) write `MÜZİK: AÇIK/KAPALI`, `EFEKT: AÇIK/KAPALI` and `aria-pressed` on every `[data-music]`/`[data-sfx]`; wired through `onButton` (click + `blur()`) at 509-511, painted once at 511 and again on every screen change (132); state lives in `audio.js` |
| Hidden page | `visibilitychange` and `pagehide` pause a running game (657-663) |
| HUD timers | kinds `sense,magnet,bugle,spring,swing,decoy,wall,tracer` (95-100); drawn with `drawPowerIcon`; bar logic `updateTimer` 674-687 |
| HUD update | cached DOM writes (688-877); hero special label/gauge, iron, repulsor, flash |
| Market | `paintMarket` (158-367): 4 consumables (171-336) then upgrade rows from `SKILL_UPGRADE_CONFIG` (338-364) |
| Missions panel | 390-420; toast/banner queue 421-437 |
| Name | persisted on input, max 12 (107-120, 32) |
| Start | requires non-empty name; first run opens help (440-467) |
| Keyboard | game keys (538-556); Enter/Space start, Escape closes help; `BUTTON` targets are left to the native click |
| Scores | top 5 in `spidey.scores` (38-46, 559-578) |
| Over screen | record flag, top-5 list (579-612); `gameover` listener feeds it (606) and emits `newRecord` on a record (608) |
| Share | copies fallback text and uses `navigator.share` when present (614-656) |
| Frame | own rAF: loader, screen, HUD (890-895) |

`style.css` only handles the page frame; UI styling belongs in `ui.css` (style.css:1-2).

## 10 Audio

Code-generated Web Audio; no sound files (`audio.js:1-2`). Three modules: `audio.js` owns the context and SFX, `music.js` owns the sequenced soundtrack, `audio-logic.js` holds the pure maths and the settings table shared by both.

| Concern | Facts |
|---|---|
| Context | created suspended at start-up behind the loading screen (`prepareAudio`, `audio.js:78`, comment 76-77); the first gesture only resumes it (`unlock`, 80-96) |
| Unlock | `pointerdown, touchstart, touchend, pointerup, click, keydown` on window with `{capture, passive}` (`UNLOCK_EVENTS` 99, opts 100, add/remove 101-107); iOS silent 1-sample buffer 87-95; `visibilitychange` suspends and resumes (108-112), `pagehide` suspends (113), `resumeContext` (114-116); `ctx.onstatechange` re-arms listeners after an interruption (68-71) |
| Output chain | SFX: `master 0.55 → comp (-16 dB, knee 8, 12:1) → limiter (-4 dB, knee 0, 20:1) → out 0.9 → destination` (`audio.js:43-56`). `music.js` is handed the **limiter** as its destination (`audio.js:67`), so the EFEKT toggle cannot mute music; music never passes through `master` |
| Settings | `spidey.music` + `spidey.sfx`, load/save with legacy `spidey.muted` fallback and mirror (`audio-logic.js:1-11`, wrapped in try/catch by `audio.js:17`, 20); API `isMusicOn/setMusicOn/isSfxOn/setSfxOn` (`audio.js:25-28`); `setSfxOn` only ramps `master` (`applyMasterGain` 29-34, τ 0.015), `setMusicOn` ramps the music bus (`music.js:68-75`) |
| SFX voices | `MAX_VOICES 24`, `SOFT_VOICES 14` (above 14 only `low !== true` sounds play); claim/release `audio.js:120-129`; `voices` is not clamped at release (127) |
| Coin bus | `coinIn → lowpass 5200 Q 0.5 → master` (`audio.js:57-60`); one-voice ladder `coinNext` over MIDI `[81,84,86,88,91,93,96,98]` × comp `[1.0…0.7]`, reset after `COIN_RESET 0.6` s, min gap `COIN_GAP 1/12` s (`audio-logic.js:15-27`, used by `audio.js:290-304`) |
| Sound map | `SOUNDS` 306-541; names listed below |
| Playback | `play(name, detail)` gates on `settings.sfx`, `unlocked`, `!paused`, `!document.hidden`, `ctx.state === 'running'` (`audio.js:546-547`); skips the gameover SFX while music is on (548); per-name `MIN_GAP` throttle (544, no `coin` key); `DUCK_SFX[name]` ducks music 0.25 s out (555-556, table `audio-logic.js:40`) |
| Auto-subscribe | every `SOUNDS` key except `start`/`i_*` (`audio.js:589-592`) |
| Start/pause/resume/menu | `start` clears `paused`, schedules the jingle 40 ms later unless the intro took over, resumes the context (562-573); `pause` suspends (574-580); `resume` resumes (581-587); `menu` clears `paused` and resumes (`audio.js:117`) |
| Intro | `INTRO_SOUND` maps phase `swing→i_swing, webEmpty→i_webEmpty, fall→i_fall, roll→i_roll, roar→i_roar, scream→i_scream, run→start` (`audio.js:595`); the listener marks `introActive` on `start`, replays `start` on a skipped `end` (596-601) |
| Music graph | `musicGain 0.14 → limiter`, `duck → musicGain`, `fade → duck`, `lowpass 16 kHz Q 0.7 → fade`, layer gains → lowpass, stingers → musicGain at gain 2.2 (so they ignore `fade`) (`music.js:38-41, 49`, `21-25`) |
| Echo and colour | dotted-8th echo: `echoIn 0.22 → delay 0.75 × 60/bpm → echoLP 2600 Q 0.7 → musicLP`, feedback 0.28 (`music.js:43-47`); soft-clip shapers on the drums layer (k 1.6) and bass (k 1.8 → lowpass 3200) (`music.js:50-55`) |
| Scheduler | 16-step grid, look-ahead 0.12 s on a 25 ms `setInterval` (`music.js:9, 66, 357-365`); `resyncTime` skips ahead instead of bursting (`audio-logic.js:76`); far-future notes queue in `pendingVoices` (`music.js:91-92`) |
| Music voices | `VoicePool` of `musicPoolMax(cores)` = 36 on ≤4 cores else 44, with per-layer reserves 0/4/8/12/16 (`music.js:65`, `audio-logic.js:29-38`); release on `onended` (`music.js:99-103`) |
| Scenes | `menu / silent / run / over / hold` from `musicScene(mode, intro)` (`audio-logic.js:71-75`), re-evaluated every tick (`music.js:350-351`); `changeScene` clears queue/timers/tension, fades `fade` to 0 (τ 0.1 into `over`, 0.25 otherwise) and starts the new song on a delay (`music.js:329-347`); `startSong` ramps `fade` to the scene gain (τ 0.8 into menu, 0.01 otherwise) and resets lp/duck (`music.js:318-328`); scene gain `menu 1.6`, `run 1.0` (`music.js:24`); 7 s after game over `tick` cross-fades into the menu song (`music.js:352-354`) |
| Songs | A minor, 16-step grid, 8-bar phrases (`audio-logic.js:42-49`, `MENU_BARS` 50, `BOX` 60-69); menu song: swing 0.58, fixed BPM 84, drums from bar 4 only (`music.js:300-316`); run song: swing 0.5, BPM 112→122→128 by speed tier (`bpmFor`, `audio-logic.js:78-83`), per-tier layer set from `layersFor` (`music.js:371-386`), echo delay follows BPM (376), riser + crash on a tier change (377-378), arp dropped on low-end hardware (390) |
| Tension | `venomNear` sets `tension` and `setTension` ramps the drone layer in (τ 0.17) while ducking lead ×0.5 and chords ×0.7 (τ 0.6 out); `venomFar` disarms (`music.js:412-417`, `455-460`); while armed the run song adds a drone on step 0 and hearts at steps 0/8 (1.0) and 3/11 (0.65) (`music.js:391-395`) |
| Stingers | `ST.pickup/missionDone/missionSet/record/closing` (`music.js:420-448`), gated by `stingerReady` 2 s (`audio-logic.js:120`); `caught` sweeps the music lowpass to 300 Hz in 0.45 s and ducks 0.5 for 0.6 s (`music.js:405-410`) |
| Crackle | one 3 s vinyl buffer: 0.004-amplitude noise plus 66 one-to-three-sample clicks (~22/s) built at init (`music.js:56-62`); looped through highpass 1000 → gain 0.09 → the `crackle` layer, and it holds a pool voice while playing (`music.js:275-284`, `276-277`) |

`SOUNDS` keys: `jump, land, slide, lane, coin, senseOn, senseDodge, senseOff, magnetOn, magnetOff, web, ironOn, ironOff, ironSave, stumble, crash, venomNear, caught, gameover, start, hulkRoar, hulkSmash, capShieldSurf, capShieldGong, milesVenomBlast, venomBlastNova, i_swing, i_webEmpty, i_fall, i_roll, i_roar, i_scream` (`audio.js:306-541`).

Power-ups without a `SOUNDS` entry (bugle, spring, swing, decoy, wall, tracer, flash, hero `specialOn`) are silent unless a sound is added; their feedback is visual.

## 11 World and look

11.3 pure logic: `city-logic.js` reads `CONFIG.city` (config.js:471), preserving the approved 6000 m route and phase/disc tables. `districtEvent` announces 60 m ahead; negative distances stay Midtown. City runs last as a game system; reset clears the announcer and returns the day clock to zero; gameover also empties board pools, hides portals/dress/shell and restores Midtown facades without changing gameplay distance or score (`city.js:621-631`). Pause freezes the exact scene.


| Concern | Facts |
|---|---|
| Track geometry | box-built deck/sleepers/rails/walls, vertex colours (`world.js:47-97`) |
| Track markers | `TRACK` 35; `laneX(lane)` 24 |
| Segments | 13 segments × 20 m (`config.js:104-112`); 96 m kept behind |
| Recycle | `onRecycle(fn)` returns unsubscribe (132-138); `reset` re-fires all (141-145); `update` scrolls and recycles (147-163) |
| Blob shadow | canvas radial texture (182-198), factory (199) |
| City | 300 chunk specs and district recipes cached at load; assign (`city.js:556`) swaps facade/plain/dress/shell geometry, board instances and single portal objects; only chunks mirror. Bridge and tunnel hide chunks |
| Skyline | one 700 × 175 shader plane (`city.js:447`), approved RGB skyline/shore masks; curve shader wrapper still chains |
| City API | `{skyline, variants, textures, atlases, facades, dayCycle, cityShift, pieces, materials, boards, portals, dispose}` (`city.js:644`); dispose removes recycle/gameover/system hooks and fixed city children |
| Debug city | `?gun=<metres>` rounds to a 20 m city-only shift; score, generator and world distance stay unchanged |
| Lighting | hemisphere + one directional sun, no shadow maps (`lights.js:1-2, 7-15`) |
| Curved world | every material's shader patched (48-70); bend samples 36 × 6 m (24-26); `curve.update` 126; `curve.offsetAt` 157 |
| Camera | follow, portrait fit, blocked-follow, shot blend, kick/shake (`camera.js:24-171`) |
| X-ray | shared shader, `GreaterDepth`, player render group 10 (`xray.js:6-14, 35-69`) |
| Resolution | adaptive steps `[2,1.5,1.25,1]` (`config.js:115-134`); algorithm `quality.js:9-49` |
| Warm-up | fonts before city paint (`main.js:181`); all chunk/facade/dress/portal geometries and board shader instances, sky and all 11 explicit city textures (`warmup.js:13`) |
| Palette | approved five-phase sky/fog/scenery table in `CONFIG.city.phase` (`config.js:484`), fog near ≥42/far ≥155; toon shading `toon.js:20-67`; gameplay bodies retain their materials |

## 12 VFX and art kits

| Kit | Facts |
|---|---|
| `fx.js` | event-only subscriber (`fx.js:1-17`); `initFx` 478; normal pool 360 + additive glow pool 300 with 28 reserved (checkpoint from read; pool construction before 671); 5 comic text sprites; DOM speed lines/vignette/flash/caught splash; own rAF so effects survive `over` (15-17) |
| fx handlers | `coin` 671, `jump` 700, `ironGrab` 755, `land` 771, `slide` 801, `stumble` 829, `crash` 842, `caught` 859, `pickup` 864, `web` 885, `iron*` 917-963, hero hits 964-1015, `sense*` 1016-1053, magnet 1054-1081, spring 1082-1094, bugle 1095-1107, flash 1108-1142, swing 1143-1199, decoy 1200-1234, wall 1235-1261, tracer 1262-1302, venom 1303-1321, intro 1322-1396, start/gameover 1397-1404 |
| Comic words | 16 base words + `x5/x6/x7` shutter stickers (`fx.js:247-267`) |
| `vfxCore.js` | `initVfx` 451; pools of chunks/puffs/sparks, 9 sticker sprite slots, 3 rings; `ToonPool` 224; spawners 560-663; `impactFrame` 691; `edgeLines` 713; `hitStop` 717; `kick` 722; `sfx` 727 |
| vfx stickers | keys `smash,krak,bam,bzzt,zzap,whoom,thwip,gong,yay,boing,kapow,bwoom,fwoosh` (86-100) |
| Ghost/shatter | `ghostLayer` 797, `ghostMaterial` 850, `shatterObstacle` 884, compatibility camera/light helpers 906-935 |
| `pickup-art.js` | icon switch 811-840; builders: web 247, iron 251, sense 959, magnet 994, bugle 1121, spring 1156, swing 1238, decoy 1788, wall 1821, tracer 1854; props: dummy 1914, drone 1946, wall panel 1978, ribbon 2006 |
| `obstacle-art.js` | one InstancedMesh + optional outline per kind; `ShapeBuilder` 40-86; `createObstacleArt` 474; old kinds capacities 24/24/24/24/64/16/256 (481-487); row kinds `gapHole/gapEnds/gapPatch/gateFrame/gateShutter/girderBeam/girderJib/girderPad/girderGo`, caps 3/3/3/3/3/3/3/6/3 (488-496) |
| Obstacle art API | `begin/add(kind,x,y,z,colorIndex)/addRow(type,z,len,open,tau)/addPatch(z,len)/addCoin/end(time)` 505-553; gap/patch z scale, gate CONFIG smoothstep, girder high pivot + static pads/arrows; all built at load and included in warm-up's scene traversal |
| `toon.js` | 3-step gradient 20-29, soft vinyl ramp 34-49, `toonMaterial` 58, outline shell 119-171, canvas texture 176, lathe/sphere grids 220-271, `flatPicture` 277, `smoothLathe` 349, `facePatch` 373, `roundCube`/`boxify` 414-438, `TubeShape` 477, `PoseBlend` 561 |
| `heroKit.js` | merged sculpted extras with hidden swatch UVs 1-7, `attach` 89, `rangeToggle` 117, `headPoint`/`headRing` 143-168 |
| Models | every hero is a Funko-style vinyl figure on `createSpiderCharacter`; `spiderman.js:558`; Iron Spider adds four arms `ironspider.js:456`; Venom `venom.js:399`; skins listed in §1 |

## 13 Persistence

Storage access is generally guarded; a broken save falls back to defaults. See the 11.2 verification addendum for raw upgrade-read limits.

| Key | Writer | Reader | Shape |
|---|---|---|---|
| `spidey.skin` | ui.js:495 (skin button) | main.js:73-76; ui.js:28 | skin id string |
| `spidey.name` | ui.js:113, 454 | ui.js:111 | string, max 12 |
| `spidey.scores` | ui.js:568 | ui.js:40 | array of `{n,s,t}`, top 5 |
| `spidey.helpSeen` | ui.js:465 | ui.js:456 | `'1'` |
| `spidey.missions` | missions.js:139 on gameover/pause/visibility/pagehide (195-202) | missions.js:112 | `{set, level, items:[{id,goal,progress,done}]}` |
| `spidey.music`, `spidey.sfx` | audio.js:23 via `saveSettings` | audio.js:17 via `loadSettings` (`audio-logic.js:1-11`) | `'1'` / `'0'`; an absent key falls back to the inverted legacy `spidey.muted`, and `spidey.muted` is rewritten on every save as `'1'` only when both toggles are off (`audio-logic.js:2-11`) |
| `orumcek_kosusu_save` | shop.js:67 on start/gameover (204, 219) | shop.js:45; also web.js:109, ironspider.js:118 | `{totalCoins, upgrades, bankedHeroCharge, jetStarts, flashBoosters}` |
| `spidey.iron` | ironspider.js:49; shop.js:129 | ironspider.js:39; shop.js:8/109 | integer core count |
| `orumcek_kosusu_iron_count` | ironspider.js:50; shop.js:130 | ironspider.js:39; shop.js:109 | legacy mirror |

Defaults: shop starts with 250 coins and 10 upgrade levels at 0 (`shop.js:32-40`). Mission defaults: set 1, level 0, three generated items (`missions.js:105-107`). Score = floor(distance score) + coins × 10 (`game.js:220-221`, `config.js:178`).

## 14 CONFIG

`config.js` is the only tuning file; units are metres/seconds/m/s (`config.js:1-2`).

| Group | Lines | Main knobs |
|---|---|---|
| lanes | 5-8 | 3 lanes, 2.2 m apart, 0.14 s switch |
| speed/score | 10-21 | 11→26→32→39 m/s; accelerations 0.15/0.014/0.012; score 1/m |
| player | 23-27 | height 1.6, width 0.7, depth 0.6, slide height 0.75 |
| jump/slide | 29-37 | gravity 42, jump 1.5, fast drop 28, coyote 0.12, slide 0.7, recover 0.25 |
| input | 39-46 | swipe 28 px, tap slop 12, tap ≤0.3 s, double window 0.3 s / 60 px |
| camera | 48-79 | FOV 60, height 3.4, distance 6.2, follow/damping/portrait fit |
| curve | 81-94 | straight 15-30 s, radius 220-380, ease 2.5, hold 3-7, lean 0.12 |
| xray | 96-101 | color, edge, pull 0.35 |
| world | 103-112 | segment 20 × 13, backZ 96, sleeper/post spacing |
| render | 114-134 | pixel ratio 2, adaptive steps, sky/fog |
| lights | 136-143 | hemi 1.6, sun 2.2 |
| dtCap | 145 | 1/20 s |
| obstacles | 147-166 | stepUp 0.4, stumble 0.6, cooldown 0.35, sizes, train speeds, spawn/release; 11.5 rows: `gap`/`gate`/`girder`/`rowWarnTime` (162-166) |
| coins | 168-182 | spacing 3.4, height 0.6, pickup 0.4, row/zigzag/roof/trap chances |
| coinScore | 183 | 10 |
| chaser | 185-210 | intro 1.3, near 4.5, far 30, min 2.6, catch speeds/gaps/camera |
| pickups | 212-215 | global min gap 300 m |
| web | 217-238 | 3 charges, chances/gaps, hang/roof/zip/line/anchor |
| iron | 240-257 | 12 s, 5 cores, chances, clear/grace, storage key, grab reach |
| sense | 259-274 | 5 s, chance 0.4, gap 900, look-ahead/sim step |
| magnet | 276-289 | 5 s, chance 0.15, gap 400, ahead 22/side 5/fly 0.32/arc 0.9 |
| bugle | 291-298 | 10 s, chance 0.15, gap 400 |
| spring | 300-308 | 10 s, jump ×2.2, chance 0.15 |
| swing | 310-326 | 8 s, height 6±1.2, arc 0.7, takeoff 0.5, landing 0.8, anchors, coin ribbon |
| decoy | 328-336 | 20 s, chance 0.16, gap 600, behind 20 |
| wall | 338-353 | 6 s, height 3.2, x 3.5, lift/landing, camera back, coin row |
| tracer | 355-370 | 10 s, step 3 s, max temp 3, drone/ribbon geometry |
| events | 372-395 | 11.5 road events: firstAt 1200, zone gaps/tail/margins, warn/rest curves, `senseActTime` 0.45, bonus +3/+1 for 12 s, `venom`/`goblin` timings |
| intro | 397-429 | 3 swings, phase times, swing geometry, Venom lag, reverse camera, fog |
| seed | 432 | null = random run, number = same track |
| patterns | 433-470 | safe start 60, block times, difficulty curve, endless knobs, train start, reaction limits; `rows` schedule (461-469) |
| city | 471-509 | 6000 m loop, six districts, 60 m announcements, exact phase/disc tables, tunnel/readability floors, texture scale and later board/life pools |

## 15 Tools and tests

No `package.json` and no `node_modules` at the repo root (root glob). Browser imports `three` from the CDN import map (`index.html:30-37`). Tools are plain node ESM scripts run individually.

| Command / file | What it proves |
|---|---|
| `python tools/serve.py` | serves the game at `http://localhost:5173` with `Cache-Control: no-store` (serve.py:1-12) |
| `node tools/check-patterns.mjs [seeds] [metres] [marginSeeds]` | independent solvability model, 20-minute speed curve, reaction margin, static/train overlap, coin placement, pool capacity (1-20) |
| `node tools/check-quality.mjs` | adaptive ratio steps down/up, locks, hidden-tab gaps, failed probe backoff (1-23) |
| `node tools/test-skills.mjs` | missions/powers/audio/11.5 fairness; 11.3 route/clock/events (`:23`), shared U (`:1466`), real board pool/two-loop capacity/UVs, recipe anchor contracts, station merge/inward faces, portal reuse and gameover/restart (`:1476`) |
| `node tools/test-audio.mjs` | audio only: a fake `AudioContext` proves gesture gating, hidden-tab silence, per-bus mute, ladder/coalescing behaviour, stinger timing, voice caps and a simulated 20-minute leak soak (1-208) |
| `node tools/test-ui-hud-qa.mjs` | HUD/market/shop integration for 8 heroes with a DOM mock (1-2) |
| `node tools/test-hero-specials-qa.mjs` | simulation/verification of 8 hero specials with DOM mock (1-2) |
| `node tools/test-qa-deep-audit.mjs` | regression suite for 3 critical hero fixes and global integrity (1-2) |
| `tools/stub-hooks.mjs` | node resolver hooks: stubs `three`, `world.js` (`laneX`), `curve.js`, `pickup-art.js`, `obstacle-art.js` (no-op drawing) so real obstacles/player/power-ups import headless (1-67) |

These are assertion scripts, not a test runner: they print `OK` / `FAIL` and set `process.exitCode` (e.g. check-patterns.mjs:41-44). Visual output is not tested; there are no browser-automation tests in `tools/`.

## 16 Conventions and limits

**Architecture**

- The event bus is the only cross-system channel (`events.js:1-6`). UI reads `game.state` and calls the game API; it never writes state (`game.js:1-2`).
- Systems implement optional `beforePlayer(dt)`, `update(dt)`, `reset()` and are run in registration order (`game.js:5-9, 215, 221, 255`).
- Extension hooks are plain objects: player (45-48), obstacles (149-160), chaser (47). Plug in by assignment; reaction wrappers chain the previous hook (`obstacles.js:9-16`, decoy.js:56-63).
- All tunables live in `CONFIG`; section owners add keys there (`config.js:1`).
- Pools are preallocated and reused: obstacles/coins/pickups (obstacles.js:136-143), fx particles/text (fx.js:6-12), vfxCore (vfxCore.js:451+), instanced art (obstacle-art.js:421-498).
- The generator is one seeded stream; extras must consume their roll unconditionally to keep tracks deterministic (`patterns.js:32`, `magnet.js:62-65`).
- Models are built once in `main.js`; skins are hidden children, not rebuilt (main.js:71-78). Iron Spider and Venom are also single instances (88, 96).
- UI strings are Turkish; code comments are mixed Turkish/English. Keep the local style.

**Known limits**

- `dt` is capped at 1/20 s; longer frames are not simulated (config.js:145, main.js:210).
- Collision processes at most one hit per frame (`obstacles.js:480-481`); grace periods are the escape hatch.
- The pattern generator assumes the speed curve in `game.js`; `tools/check-patterns.mjs` is the guard (patterns.js:64-76).
- Toon shading is a 3-step or soft ramp; no shadow maps (`lights.js:1-2`). Outlines are inverted hulls (toon.js:111-171).
- `prefers-reduced-motion` weakens shake/flash and removes speed lines (`fx.js:24-26`).
- localStorage is best-effort; private mode/broken JSON falls back to defaults (`shop.js:45-61`, `missions.js:110-134`).
- Audio is fully code-generated; the soundtrack is a sequenced synth in `music.js`, not a file (`audio.js:1-2`, `music.js:1-2`).
- Music enters the graph at the limiter, so the EFEKT toggle mutes SFX only and MÜZİK mutes music only (`audio.js:67`, §10).
- The music voice pool is sized by `navigator.hardwareConcurrency` (36 on ≤4 cores, else 44), so note density is device-dependent (`audio-logic.js:38`, `music.js:65`).
- `music.js` keeps its own 25 ms `setInterval` running for the life of the page; it no-ops while the context is not running (`music.js:66, 349`).
- Pickups without a `SOUNDS` key are silent; see §10.
- The market upgrade list is driven by object key order; adding a key changes both menu order and save validation (`shop.js:12-23, 54-59`; `ui.js:337`).
- `PLAN.md` §11.3-11.6 describes city/day-cycle/road-event roadmaps; this map only covers code that exists in `src/` (PLAN.md:213-266).
- Not mapped in this pass: `README.md`, `AGENTS.md`, `viewer.html`, `tasarim/11-1-ses-muzik.md`, `tasarim/proto/*`, and the exact line ranges of `pickup-art.js` intermediate builders (247-810 were skimmed in the earlier pass, not re-read here).

## 17 11.2 source verification addendum (2026-11-10)

This section is current code evidence, not implementation of the proposed 11.2 design.

| Correction / clarification | Verified source |
|---|---|
| Three costume-only skins (spider/gwen/mcu) retain common web zip, capacity3. Eight unique heroes replace web with a special; Raimi capacity2, cost1, others capacity1. A cartridge fills to the selected cap. | web.js:46–55,82–86,99–138; skillSpiderman2002.js:198–205 |
| Double action prioritizes a charged unique hero ability; only otherwise Iron Spider. Existing help's unconditional “Çift dokun: Iron Spider” is misleading. Explicit h-iron click always calls iron.activate. | main.js:120–126; index.html:216; ui.js:531–533 |
| Iron Spider duration upgrades ARE read: 12 s + level×0.5. Raw read checks finite positive level but does not clamp the direct saved value to shop max20. | ironspider.js:116–122 |
| Hero duration upgrade is read in web.js, then partly lost at delegated skill entry: Iron Man fixed2.2, Panther fixed5.5, Raimi fixed phase clocks. Kitty/Batman receive dur; Hulk/Cap/Miles use parent dur. Parent Raimi remaining is not decremented in its mode branch. | web.js:107–137; hero-specials.js:401–435,493–503; skillIronMan.js:200–205; skillBlackPanther.js:115–122; skillSpiderman2002.js:198–218 |
| shop.start transfers banked charge after run reset and clears ALL bank stock; no per-hero first-run gift currently exists. 11.2 proposes preserving untransferred paid stock. | shop.js:204–216; game.js:94–105,226–249 |
| h-web empty tap silently attempts activation and does nothing today; no ready/empty explanatory state. | ui.js:514–523; web.js:99–105 |
| OYNA currently opens help before first run if helpSeen!=1. Proposed opt-in comic is a behaviour change. | ui.js:450–466 |
| Menu/skin are full-screen overlays on the chase scene; no dedicated selection stage camera exists. All11 roots are already built and reused. game.scene/camera/cameraRig are assigned. | main.js:71–79,127–137,176–178; camera.js:76–171 |
| Existing index contains a repulsor img URL ironman-icon.png, contrary to the file-free art direction; 11.2 must replace this reference with existing drawn icon, not add an image. | index.html:133 |
| Final narrow recheck during concurrent11.5 work: rowWarn/rowPass emitters now exist, and eventKind/eventTime/eventBonusTime plus mult.event are defined. No full event-director integration is claimed by11.2. Shared spidey.seen/component remain proposed11.2 work. | obstacles.js:342–351; game.js:33–45; tasarim/11-5-olaylar.md:D.4–D.6 |

The duration values in §8 are nominal bases. They are not proof that every delegated clock consumes upgrades. §8's generic recipe “use getEffectiveSkillDuration” is a rule for new ground powers; current web/iron code instead reads saved levels directly.
