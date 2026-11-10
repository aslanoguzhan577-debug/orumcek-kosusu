# 11.2 — İlk beş dakika: anlatım ve ekran düzeni

Design hand-off, 2026-11-10. **Design only; no game changes or commits.** Engineering prose is English; all shipping copy is Turkish. Read this index, then the linked recipes in task order.

## Concept: the friend inside the comic

The first screen is a comic cover with a visible vinyl hero and one obvious red **OYNA!**. The run is the lesson: a cheeky yellow narrator explains a thing when it arrives, then leaves. Small round timers and a truthful ability button keep the road readable. Character choice is a toy stage; help is four actual comic pages; the market is two tidy sticker tabs. Loud ink, red corner tabs, dotted sky, cream paper and short Turkish lines carry the spectacle without a tutorial level or a new asset pipeline.

| Read | Contract |
|---|---|
| [Narration](11-2-anlati-kutusu.md) | complete copy/trigger/storage catalogue, queue, 11.3/11.5 adapters |
| [Hero ability](11-2-kahraman.md) | gift accounting, truthful states, duration defect |
| [Character stage](11-2-karakter-secimi.md) | all 11 ribbons, grid, real scene/camera recipe |
| [Comic help](11-2-nasil-oynanir.md) | four pages, all copy, navigation |
| [Layout](11-2-yerlesim.md) | menu, market, HUD, sound, CSS and viewport maths |
| [Coding tasks](11-2-gorevler.md) | ordered independently working changes, assertions, phone checks, unresolved choices |
| [Progress](ilerleme-11-2-tasarim.md) | finished sections, decisions, successor instructions |

## Scope and authority

Bindings read: HARITA, PLAN §11 rules/11.2, 11.5 first captions/HUD/warnings/missions, existing index/UI/shop/web/hero clocks, main/camera/input/mission contracts. No generator, mission goal, difficulty, sound synthesis, unlock or score formula redesign. Keep `spidey.skin/name/scores/helpSeen`, both sound keys, mission save and purchased inventory intact. Character costumes retain the common web action. Never claim that they have no gameplay action.

Production touch points: `index.html`, `ui.css`, `src/ui.js` (including `showScreen`, `paintSkin`, `onPlay`, `openHelp`, `paintMarket`, `hudFlash`, `updateHud`, click handlers), `src/shop.js` start inventory, `src/powerups/web.js` and individual hero skill clocks, `src/main.js`/`src/camera.js` menu stage and run viewport; new small pure `src/ui-onboarding.js` and `src/ui-onboarding-copy.js` (tables separate from state), assertions in `tools/test-skills.mjs`, existing UI/hero QA mocks where selectors change. Keep current IDs or update every mock/caller in the same task. No new dependency, image file, runtime texture generation, additional renderer, render loop or post-processing.

11.2 owns caption presentation and HUD geometry. 11.5 owns lane warnings, danger timings, event reward maths and mission definitions. Preserve its caption IDs `gap/gate/girder/venom/goblin` and `spidey.seen`. Its proposed `top:22%`, standalone event banners and vertical `#h-event` gauge are replaced by this shared layout. Its logic assertions still apply. Concurrent11.5 work added rowWarn/rowPass emitters and event state fields during this pass; final narrow source check confirms them, while full event director integration is not assumed. Adapters remain safe when values are zero/absent. At initial bearings11.3's index referenced missing siblings; its district event below is explicitly proposed. Other designers are editing this workspace, so source line numbers refer to the stated read snapshot.

## Decisions and reasons

| Decision | Reason |
|---|---|
| OYNA goes straight to the existing intro/run after name validation; help is opt-in | Four mandatory pages would contradict a game that explains itself without stopping the run. Existing helpSeen remains, but never gates OYNA. |
| Gift for eight special heroes, once per skin; three costumes receive no gift | The stated problem is empty unique abilities. Costumes clearly retain three-slot web cartridges. |
| Gift fills at least one slot before purchased charge transfer; a full gift leaves banked inventory banked | No lost paid charge and no invisible extra stock above the hero cap. |
| One caption shell, one queue, no duplicate mission/event banners | One place to read and no competing overlays. |
| A permanently reserved HUD sky band, gameplay rendered below it | A CSS box over the existing camera cannot guarantee that it never covers a lane. An actual viewport boundary can. This is a director-review choice because it changes road framing. |
| Eight timed tokens, then seven plus `+N`; overflow rotates with a fixed rule | No second row, no shrinking icons to unreadable sizes. |
| Market scrolls only its ten-upgrade list | Four consumables fit; permanent levels cannot reasonably fit ten readable rows on a small phone. |
| Hero portraits are CSS placeholders in prototypes; production uses existing icons and real 3D stage | No image files or duplicate model system. The prototypes approve layout and paper/ink language, not model likeness. |

## Five-minute beat sheet (opportunities, not forced scheduling)

0–15 s: cover, name, OYNA, existing skippable intro. After `intro phase:end`, a single lane hint; jump/slide hints follow only their first successful actions. First special-hero run gets a gift and visible ready button. 15–90 s: first collected power explains itself; an empty-button tap explains refilling. 90–180 s: mission completion explains sets, first Bugle explains temporary ×2. 180–300 s: another run, choose a character, optionally inspect the four-panel guide/market. Do not force rewards, pickups or mission completion into these timestamps; random generation and player skill remain unchanged.

## Visual tokens / shared constraints

Use existing `#ui` variables: ink `#0d0d14`, cream `#fff6dc`, red `#e0262c`, red-d `#a8141a`, blue `#1a3cb0`, navy `#0c1a4a`, yellow `#ffd23a`; sky `#8fd0ff`. Added paper-yellow `#ffe9a3`, muted `#797b87`, cyan `#8feaff`, green `#35e06a`. Headings Bangers `var(--font-h)`, body Baloo 2 `var(--font-b)`. Never set new variables outside `#ui` in production. Fixed numbers below are CSS pixels, before safe insets. Default border 3 px, hard shadow 4 px right/down, radius 12 px; caption radius 2 px. Text ink on paper; white text only on ink/red/blue. UI controls minimum 44×44; focus 3 px yellow plus 2 px ink outer ring. No colour-only state. `prefers-reduced-motion`: no pulse, rotation tween, shake, puff or overshoot; 100 ms opacity only. Captions use `role=status aria-live=polite aria-atomic=true`; the road warnings themselves are immediate visual geometry.

## Evidence and approval limits

**No browser was opened.** 360×740, 490×805 and 740×360 fits are computed from border-box CSS tracks. Font glyph extents, safe-inset browser behaviour, scene projections, camera distance and perceived readability have not been seen. No screenshot or real-device performance claim is made. Six direct HTML pages link the game's `../../ui.css` and Google font URL; shared prototype CSS/JS are in the same folder. They contain static fixture data and isolated demonstration interactions, never call the game, never write localStorage and never purchase anything. Serve from the project root using the existing server, then open their paths on the owner's phone; fonts need internet, fallback fonts remain available.

Open [caption](proto/11-2-anlati-kutusu.html), [menu](proto/11-2-menu.html), [character](proto/11-2-karakter.html), [help](proto/11-2-nasil-oynanir.html), [market](proto/11-2-market.html), [HUD](proto/11-2-hud.html). The exact reusable CSS is [11-2-proto.css](proto/11-2-proto.css); its fixture-only scenery/toy classes are labelled and must not replace Three.js.
