# Stage 11.5 coding handoff - tasks 1-7 repair pass

Scope: checker tasarim/11-5-kontrol-1-7.md, defects 1-6. Defect 7 is explicitly
excluded by the user. Tasks 8+ remain deferred. No commit or save-format change.

## Numbered defects

1. FIXED - D6 retains the explicit active-Cap pit exemption in src/obstacles.js:457;
   no geometry tuning. _capExit now grants 0.1 s via the existing grace method
   (src/powerups/hero-specials.js:675), protecting the hover-to-deck drop before
   collision reads lastY. Regression tools/test-skills.mjs:1281 drives real Player/
   collider updates: expiry over a 6 m gap at 19/39 m/s, standing/sliding, 120/20 FPS.
   No hit or patch; grace expires and the next unprotected gap still crashes.
2. FIXED - removed unused cameraRig constructor/storage and unread pending zone
   field (src/road-events.js:11, :23), plus the camera argument in src/main.js:163
   and tools/test-skills.mjs:1442. Removed unused events.venom.dolly:1.6 from
   src/config.js:392. Camera ownership/dolly belongs to task 8; pending zone
   storage/hook belongs to task 13. Neither was implemented here. Other event
   tuning still follows task 1's CONFIG specification.
3. HANDOFF RESOLVED AS AUTHORIZED - Venom-only support retained. Task 9 must change
   these together: start's guard (src/road-events.js:43-47), _begin's unconditional
   hunt/roar (:50-59), update's V.duration timer and _venom dispatch (:76-82), and
   _end's unconditional hunt teardown (:161-170). Goblin needs its own duration,
   update and lifecycle; do not merely allow 'goblin' in start. Existing rejection
   assert remains at tools/test-skills.mjs:1569. No runtime change for this item.
4. FIXED - slam scans numeric lane indices and reads the deadly mask directly
   (src/road-events.js:110-111), without a temporary array. _lanes and _position
   (:149-150) run only at discrete emits. Position snapshots stay fresh so retained
   payloads cannot change later. Regression tools/test-skills.mjs:1561 makes both
   allocation helpers throw during three consecutive unhit slam frames.
5. FIXED - pit ironSave positions use y=0 (deck level); solid parts retain their
   midpoint (src/powerups/ironspider.js:184). Regression tools/test-skills.mjs:1306
   invokes real absorb, checking both heights and one gap patch. The missing Iron
   pickup export was added to the headless stub (tools/stub-hooks.mjs:49).
   Shared absorb callers/hooks/wrappers were searched; their chains are unchanged.
6. FIXED - the single allowed design edit is the clearance-proof row at
   tasarim/11-5-yol-surprizleri.md:172: covered-lane beam top 2.1 minus normal jump
   apex 1.5 = 0.6 m. Horizontal open-lane clearance retains the checker's >=0.5 m
   rule. No CONFIG geometry or fairness rule changed.
7. EXCLUDED - mixed-work-package hygiene is not this repair pass. Existing work
   was preserved; nothing was reverted, staged or committed.

## Tasks 1-7 retained

- 1: row/event CONFIG, event state/multiplier, descLength/descLanes/girderOffset.
- 2: collider groups, explicit pits (never floors), one patch per removed gap,
  owner warnings/passes, eventHit through the shared side-hit path.
- 3: M0-M3 recipes, nine instanced row/patch kinds, capacities and warm-up.
  GPU/phone visual checks remain pending; headless recipe tests are not renders.
- 4: sense simulation for pit/gate/girder and validated two-lane escapes.
- 5: seeded rows/zones and C1-C14. Zones stay quiet until task 13. All-lane gap/
  gate, girder free outer lane, no pickups in row/zone blocks. Conservative spacing
  remains: combo partner at routeNext, zone start +1 m, zone laneFree to end+1 m.
- 6: pure timing, nextRow (exactly two draws), nearestSafe and rewards; seeded
  property sweep retained.
- 7: manual Venom director, aimed rows/sense, hunt spare then catch, rewards +3/+1
  for 12 s, lifecycle/reset/abort. Entry: game.roadEvents.start('venom'), running,
  >=1200 m, chaser away, no special/flight/zip/tracer/boost or locked controls.

## Next coder: task 8

- Build warnings/tendrils in main; inject optional art into RoadEvents, keep calls
  guarded and art imports out of the director. strike still exposes
  {deadly,delta,warn,left,phase,hit}; t/hits/dodged/outroAt remain available.
- Restore cameraRig argument and CONFIG.events.venom.dolly=1.6 when implementing
  their behavior. Audit every setDolly caller (wall/Raimi); track event ownership
  so abort cannot clear the camera after a new skill takes over.
- Timing follows S.2: outro pose at 8.8 s, reward/end at 10 s or early zone boundary;
  clean catch pose lasts 0.6 s. B.3 mentions reward at 8.8 s: if task 8 changes this,
  separate reward from end without duplicate payment or a second bonus reset.
- Follow defect 3's task-9 dispatch note. Zone storage/hook is task 13. Goblin,
  other art, event FX/HUD/missions/audio and automatic activation remain deferred.
- Human QA: 360x740 portrait/landscape, straight/curve, start/top speed, readable
  holes/signs/gates, gate down at 1.6 s, clear girder lane both ways, patch shading/
  non-uniform scale, Venom framing and warning fill. Phone draw-call/frame-time
  measurement belongs to task 15. Browser/GPU/phone QA was not run in this pass.
- Save keys/readers/formats are unchanged; old-save coverage in test-skills passes.

## Verification

- node tools/test-skills.mjs -> OK 213388 checks
- node tools/check-patterns.mjs -> OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
- node tools/check-quality.mjs -> OK: adaptive resolution
- node tools/test-audio.mjs -> OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)
- node --check passed for all seven touched JS/MJS files: src/config.js,
  src/main.js, src/road-events.js, src/powerups/hero-specials.js,
  src/powerups/ironspider.js, tools/stub-hooks.mjs, tools/test-skills.mjs.
- Pattern run: 150 seeds x 38424 m; rows 2.0/km, zones 0.5/km; minimum minute
  reaction margin 0.45 s. Fairness checker unchanged in this repair pass.
- git diff --check passed; no scratch files created.
