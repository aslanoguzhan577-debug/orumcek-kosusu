# 11.2 design progress — complete hand-off, 2026-11-10

## Done
- Read HARITA/PLAN §11 and only relevant11.5/11.3 interfaces plus exact UI/shop/web/hero/camera/input/mission sources.
- Seven final design documents with English engineering and Turkish shipping copy; complete hint catalogue, triggers/storage/queue; gift accounting and pill states; all11 ribbons and real-scene camera recipe; four help pages; exact three-target layouts;12 ordered coding tasks with files/asserts/phone checks; questions/fallbacks and four director defaults.
- Six standalone HTML approval pages, shared local CSS/fixture JS and static assert checker. Menu navigation, mission sheet,11 hero selections/puff, four-page swipe/dots, market tabs + normal/low/full previews, caption queue/exit, pill states/overflow/pause/sound demos.
- HARITA §17 corrections: costume web/capacity, real double-tap priority, gift absence/paid bank clearing, working Iron Spider duration and partial delegated hero duration defect, existing image URL needing replacement.
- Static check passed: node tasarim/proto/11-2-check.mjs. Validates six pages, IDs, local links, seven doc link sets,11 heroes,4 comic pages,14 market rows, CSS brace balance, JS parse and computed dimensions. node --check tasarim/proto/11-2-proto.js also passed.

## Decisions + reason
- Keep spidey.seen and five11.5 caption IDs: shared component remains compatible.
- Gift eight specials once, before paid-stock transfer; subtract transferred stock only: no purchased charge lost.
- OYNA starts directly after name validation: no mandatory reading gate.
- Reserve196px portrait/100px landscape sky band; render run below it: narrator cannot cover road geometry.
-8 timed tokens, then7 + count; dedicated event warning and bonus tag: HUD never grows vertically.
- Character sheet332px with4×3 cells68px; face44 + two12px label lines: all11 fit computed phone targets.
- Sarf rows88px/upgrades96px: exact levels and two-line names have room.
- Caption tab10/10px at top-7: clears the event row within fixed band.
- Single existing renderer/model set, bounding-box diagonal fit×1.18: no image assets or duplicate3D system.

## Files — final
- 11-2-ilk-bes-dakika.md: index/concept/scope/decisions/evidence limits.
- 11-2-anlati-kutusu.md: full hint copy/triggers/seen rules/queue/adapters.
- 11-2-kahraman.md: truthful states/gift/paid-stock examples/duration repair.
- 11-2-karakter-secimi.md:11 ribbons/grid/scene camera and return recipe.
- 11-2-nasil-oynanir.md: four comic pages/copy/navigation/accessibility.
- 11-2-yerlesim.md: menu/market/HUD/pause/sound CSS/fit ledger.
- 11-2-gorevler.md:12 ordered marked tasks/asserts/check gate/questions/director defaults.
- proto/11-2-anlati-kutusu.html, 11-2-menu.html, 11-2-karakter.html, 11-2-nasil-oynanir.html, 11-2-market.html, 11-2-hud.html: final approval fixtures.
- proto/11-2-proto.css/js and 11-2-check.mjs: final shared assets/static check.
- HARITA.md: current evidence addendum; concurrent11.5 owner's map edits preserved.

## What remains — in order
1. Owner opens six pages on phone; director confirms/changes four selected defaults in tasks document.
2. Coder performs tasks1–12; all game assertions and real phone acceptance are future work.
3. Verify actual fonts/safe-insets,3D framing/top-speed visibility and reduced-motion/accessibility on device before shipping.

## Successor must not redo
Do not re-explore the whole repo, rebuild models, add images/libraries, duplicate narrator queues or change mission goals/difficulty. Read design index, then tasks in order. Only tasarim/ was written by this design pass; no game/tool/PLAN implementation, no commit. Other concurrent work changed src/, tools/ and11.3/11.5 documents during this turn; preserve it. Initial source snapshot lacked11.5 emitters; final narrow reread confirmed rowWarn/rowPass in obstacles.js:342–351 and event fields in game.js:33–45. Event director/district integration is still a guarded contract, not a completed integration claim. Line numbers can move while that work continues.

## Evidence limits
No browser opened, screenshots taken or real phone layout observed. All target fits, timer-ring maths and camera starting values are computed. Prototype CSS toy/scenery and some symbolic pickup glyphs are labelled placeholders; production uses existing icon canvases and real3D. Fixture queue is a demo, not the production scheduler implementation. Game regression tests were not run for design-only changes. Prescribed external Python executable was access-denied; no vault receipt was written and no external source reference was invented.
