# 11.2 — Ordered implementation and acceptance

This is a future coding recipe. **No tasks below have been implemented in game code.** Apply one task at a time, preserve working entry points, run checks before proceeding. `visual-short` means the actual visual markup/CSS change is under about150 lines; the copy table and prior tested scheduler are reused. Never cut accessibility/error handling to meet that estimate. `visual-spec` means follow the exact linked CSS/markup recipe, then inspect on phone; visual effort is not subject to minimal-art rules.

## Check gate after every task

Run `node tools/test-skills.mjs`, `node tools/test-ui-hud-qa.mjs`, `node tools/test-hero-specials-qa.mjs`, `node tools/test-qa-deep-audit.mjs`. For task4/9 camera/render changes also run `node tools/check-quality.mjs` and a phone play/resize pass. Pattern generator isn't changed; run `node tools/check-patterns.mjs` at final integration using its normal defaults. Do not claim these pass from this design hand-off: they were not run, because game code was not modified. Any changed DOM ID/query updates the UI QA mock in the same task. No unconditional future-module imports. Temporarily absent new UI nodes must be safely ignored until the corresponding visual task lands.

## 1 · Make advertised hero durations real — `hard`

Files: `src/powerups/web.js`, `hero-specials.js`, `skillIronMan.js`, `skillBlackPanther.js`, `skillSpiderman2002.js`; assertions in `tools/test-skills.mjs`, existing hero QA as needed. Follow [hero duration evidence](11-2-kahraman.md). Keep Iron Spider's working12+.5×level behaviour. Pass effective duration into delegated skills, preserve one-charge cost, make real remaining/max available for rings. Raimi's extra time belongs to flight/coast, never anticipation or launch force. All validation clamps upgrade level to shop max20; reject NaN/negative/malformed saved levels consistently with shop validation. Do not trust direct raw JSON as a new trust boundary.

Add asserts: at lv0,1,20 each of8 heroes reports actual base, base+.5, base+10 (Raimi base is verified phase sum); Iron Spider12/12.5/22. Simulate beyond original duration and before extended duration: active remains true; past new end: false. Parent ring clock equals delegated clock within dt. Invalid levels -1/NaN/1000 never exceed validated0..20. Blocked activation consumes0, success exactly1, cartridge fills correct cap1/2/3. If existing root logic decrements before an activation that can reject, move decrement after success in the same shared path. Phone: Iron Man hold ends cleanly, Panther isn't frozen, Raimi actually coasts longer and lands safely; buy lv1 and verify not only label changes. Requires inspection of Raimi constants before implementation, not new design permission.

## 2 · Add pure onboarding state and copy — `routine`

Files: new `src/ui-onboarding.js` (guarded seen storage, small queue, gift eligibility/pill/tab predicates only where needed by following tasks), `src/ui-onboarding-copy.js` (catalogue), `tools/test-skills.mjs`. No DOM or new generic event bus. Do not export a framework or configurable priority system; use the fixed rules in [narration](11-2-anlati-kutusu.md). Module can initially be imported only by tests; game remains unchanged.

Add asserts: invalid JSON/array/null/string ⇒ empty seen; `{gap:1,otherStage:1}` preserves unknown key on write but only whitelisted catalogue keys qualify; `gap:0/'1'` not seen; setItem throws ⇒ no throw and in-memory dedup. Duplicate active/pending ID gives one; A/B same priority is FIFO; 9th pending applies cap8 and drops worst/newest; safety preempts flavour and stale row never replays; non-visible/paused/intro/halted dt adds0. Hold999ms not seen,1000ms seen (after220ms entry); interrupted before threshold remains eligible. One active only. Bugle first2 coalesces and marks both IDs only after hold. MissionSet same frame wins over missionDone; no lost first-mission ID. Quiet launch events produce no control lesson. Max4 ordinary new hints per run; safety/refill exempt; refill6000ms throttle. Gift and availability hints have declared priority2; ordinary controls3.

## 3 · Grant first-run gifts without losing paid stock — `hard`

Files: `src/shop.js` start listener, `src/powerups/web.js` grant result/API if needed, pure module, tests. No grant in UI. Key `spidey.gifts`, eight whitelisted heroes, one per first `start` after reset, gift before bank transfer; bank decrement by amount actually transferred. Keep old saves and sound/mission/name keys. Gift result cleared every start; announcement registered now but can wait until task6 renders it.

Add asserts: all8 heroes first start+1/next0, start→restart0, pause/resume0, menu selection0, per-skin independent; costumes0 and don't get claimed; Raimi first bank2 ⇒charges2/bank1, Hulk first bank1 ⇒charges1/bank1, next Hulk bank1 ⇒charges1/bank0. Corrupt/blocked gift storage doesn't crash and in-page repeat doesn't duplicate. Reload saved claims grants0. Intro skip/abandon does not refund. Paid stock preserved for existing saves with more than current hero cap. Phone: fresh Miles ready, next run empty; switch Kitty gets its own gift; buying before first run preserves banked purchase; no duplicate sticker on resume.

## 4 · Fit HUD band, timer row and action homes — `hard`

Files: `index.html`, `ui.css`, `src/ui.js` timer DOM/read/cache, `src/main.js` renderer viewport, `src/camera.js` resize input; UI QA mocks. Use [layout HUD](11-2-yerlesim.md). First move existing actions and timers together, then change viewport in same task: never ship an overlap between old and new homes. Band196+safeTop portrait,100+safeTop landscape;8 tokens32 with7 gaps8px; action heights64/52. Keep `h-event` reserved/hidden until eventBonusTime>0; tolerate absent event fields. Replace repulsor PNG `<img>` with existing drawn icon. Remove vertical gauges only after rings consume all eight timers. Keep old web pill behaviour until task5. Keep game.score/multiplier unchanged.

Add logic assertions: `8*32+7*8===312`,312<=360-32,9*32+8*8>328; overflow counts for8/9/12 ⇒0/2/5 with7 visible plus token; fixed order stable as timers expire, hidden icon cycle every1500ms, pause freezes cycle. Refresh/refill timer max cannot make fraction>1; t<=0 hides. Viewport for360×740⇒360×544,490×805⇒490×609,740×360⇒740×260; safeTop24 subtracts24 further; output height never<=0 (fallback use full frame for extreme keyboard resize). Event total fixture `(2+0+1+3)*2===12`, label gets state multiplier, not recalculated twice; event tag reads3/bonusTime. Phone: all8 powers and flash/jet/core/ability coexist, controls don't collide, no lane/hero crosses opaque sky band, landscape rotation twice restores aspect, intro→run only one resize, clear no black edge, lane swipes still use full canvas. Check outer-lane hero behind dock at high speed; adjust camera framing if needed without moving narrator onto road.

## 5 · Show truthful ability and zırh states — `visual-short`

Files: `index.html` existing h-web children, `ui.css`, `src/ui.js` state cache; [hero button recipe](11-2-kahraman.md).112×64/52 ability;56×64/52 core. Reuse tested pure state mapping. One active ring per owning button; remove h-ironbar after both rings work. Ready ring1300ms, empty shake180ms, gift sticker4000ms. Tap empty sends scheduler item, never disables button. Until task6 it can safely show label-only status in button aria-live; do not add another toast component.

Add asserts to mapping: active true +charges0⇒active; locked+charges1⇒blocked; unlocked0⇒empty; unlocked1⇒ready. Cases for all8 hero modes, three costumes, cap1/2/3; active costume zip labelAĞDA with no fake seconds. Rejected activation keeps charges; empty tap cannot call use/spend. Phone: grayscale stamp readable, empty tap visibly responds, active zero doesn't sayŞARJ YOK, touch44+, no hidden desktop-only control, reduced motion quiet.

## 6 · Attach the one caption shell to all current triggers — `visual-short`

Files: `index.html` h-caption, `ui.css`, `src/ui.js` event bindings/frame update; existing hudFlash becomes an adapter into same scheduler; no parallel `flashes` queue/setTimeout chain. Copy stays in table from task2. Exact shell in [narration](11-2-anlati-kutusu.md) / prototype. Timer220/2500/160/120ms. Keep transient mission/flash announcements using the shared shell after first-time lessons. All currently existing triggers listed there get adapters; future ones task12. No game pause, no simulation speed edits, no DOM creation per pickup.

Assertions are scheduler tests from task2 plus integration fake-event tests: pickup.web/iron correct kinds; quiet ironOn doesn't teach suit; specialOn mode filters eight; availabilityfalse→true enqueues once, expires at7s; gift after intro end, not over intro; gameover clears without writing unseen; no stale mission toast in next run. Phone: queue two, pause during hold, resume, crash before seen threshold, refresh after seen; show longest refill/gift line on360, caption under scores not on road, first short Iron Man hint arrives before effect ends if no safety warning.

## 7 · Make main menu a fitted cover — `visual-spec`

Files: `index.html` menu/mission-sheet IDs, `ui.css`, `src/ui.js` refreshMenu/sheet return/name focus/onPlay, QA mocks. Use [menu tracks](11-2-yerlesim.md), prototype11-2-menu. Rows86/234/380 at360×740, exact name/play/sound/mission homes. OYNA validates existing name then starts directly. Keep helpSeen key but never use it as mandatory play gate. Until task9 the clear hero band shows existing scene (no new fake hero), then real menu framing upgrades it. Mission strip opens same live list in a sheet.

Logic asserts: sheet open/close doesn't change run mode, Escape returns opener, missionDone updates correct badges, onPlay empty name starts0, valid name starts1 regardless helpSeen; no mission goal/reset changes. Visual: no new assertion about CSS pixels in Node DOM mocks. Phone: all actions/three badges visible at360×740, name keyboard can open/close, red OYNA unmistakable, mission sheet can close, sound labels both fit at740×360. No scroll except accessibility/keyboard fallback.

## 8 · Split market into two sticker tabs — `visual-spec`

Files: `index.html` tablist/panels, `ui.css`, `src/ui.js` paintMarket/build rows/selectedTab, UI QA mock. [Market recipe](11-2-yerlesim.md), prototype11-2-market. Names shortened for presentation only; preserve all4 consumables and10 upgrades,88px consumables/96px upgrades, icon36/textminmax/price76,5 pips plus exact level. Tabs44, opening alwaysSARF. Keep marketReturn, price formulas, cap validation and purchase functions.

Add asserts: initialSarf, switchUpgrade, repaint retainsUpgrade/scroll, close→open resetsSarf/scroll0; only selected panel visible; purchase callback bound once after repeated renders; false purchase leaves wallet unchanged; insufficient/full no spend; bank count/cap correct with gift bank leftover; level0/1/20 pips obey fraction and exact level label retains numeric truth. Row fit maths: inner294 -36-76-16=166 text at360. Phone: four sarfs visible, ten upgrades accessible by panel scroll, header/tabs/close fixed, longest name no letter column, wallet/status updates, key navigation and purchase focus preserved. Mark duration upgrade disabled only if task1's required repairs cannot be delivered, preserving earned levels and naming the limitation.

## 9 · Frame the existing 3D hero in menu/selection — `hard`

Files: `src/main.js` one view owner in existing loop, `src/camera.js` restore/resize, `src/ui.js showScreen`/resize hook; optional ui.css stage burst. Follow exact [camera sequence](11-2-karakter-secimi.md). SetMenuView uses measured DOM rect; task7 menu band already exists; until task10 use the current selection screen's top reserved area, otherwise skip selection preview safely. FOV35, bbox fit×1.18, spin.22rad/s selection/.08 menu, transition180ms. Existing models only, restore all root transforms/visibility/viewport/FOV before intro. No new render loop, dynamic lights or per-select material/texture allocation.

Asserts: bounding-box distance fits tallest/widest of11 conservative extents; stage enter→exit preserves original root quaternion/scale/FOV/visibility; rapid selection leaves exactly one skin visible; menu/help/market transitions do not grant gifts; run restores chase and correct HUD viewport. Mock numeric geometry, not pixels. Phone: all11 heads/boots/cape/ears fit, hero facing front at entry, don't spin hidden skins, selecting under repeated taps produces one puff, exit/pause/restart no camera shot leak; twenty selection cycles no growing render objects. Distances remain computed until this pass.

## 10 · Replace cards with eleven round tokens — `visual-spec`

Files: `index.html` scr-skin, `ui.css`, `src/ui.js paintSkin`/ribbon map and existing `[data-skin]` listeners; UI QA mock. Use [character sheet](11-2-karakter-secimi.md) plus prototype.332px sheet with24 title/218grid/44button,4columns×3rows,68px cell,44px face. Keep all11 skin IDs and exact Turkish ribbons. Portrait names use existing icon/model identity; no downloaded portraits. CSS placeholder faces are approval art only; production tokens use existing skin icons inside44 circles, real scene is the hero portrait.

Assert grid maths in test-skills: at360 outer336 ⇒inner306 ⇒cell71.25 >=44;4*71.25+3*7===306;3*68+2*7===218;6+24+24+16+218+44===332; at490 outer424⇒cell93.25; at740×360 landscape sheet360,inner338, grid230 with3rows72.666... >=60. Exactly11 unique IDs, costume flag exactly spider/gwen/mcu, no lock flag, selection immediately preserves existing saved skin. Phone: all11 at once without scroll on target sizes, selected check/pop and full name/ribbon correct, fingers can distinguish each44 face, body does not hide under sheet, return menu keeps selection.

## 11 · Build the four-page comic — `visual-spec`

Files: `index.html` help pages/dots, `ui.css`, `src/ui.js openHelp/closeHelp`/swipe handlers; page selection predicate can stay inline unless reused. [All copy/panels](11-2-nasil-oynanir.md), prototype11-2-nasil-oynanir. Four pages only, finalANLADIM; no forced help on first OYNA. Existing icons drawn once; no images. Portrait header44/pageflex/dots44/nav44 gaps8, landscape left148 navigation rail.

Asserts: index clamped0..3;39px swipe ignored,41px dominant horizontal advances once, mostly vertical ignored; pointercancel and second pointer cancel; arrow/dot navigation same result; last button writes helpSeen only once and returns original screen without starting; top close does not mark seen. Phone: each page ten-second comprehension, first page four gutters/bubbles, all text legible on360 and740 landscape, page2 explains eight powers without a list wall, page4 never promises costume gift, final action reachable with text enlargement (scroll fallback).

## 12 · Connect future stages and finish regression — `routine`

Files: `src/ui.js` guarded future event listeners, copy table/pure module as needed, `index.html #h-event`, HUD QA mock, tools/test-skills. No11.5 game system implementation in11.2. Bind rowWarn/eventStart/eventReward/eventEnd/eventBonusOff as optional bus events, preserve five caption IDs and spidey.seen. For11.3 bind proposed districtEnter only after its actual event contract is agreed; otherwise expose a local UI adapter function for later caller. Do not add nonexistent imports/state requirements. No second ev-caption, event banner or mission queue.

Asserts using synthetic bus events: gap/gate/girder type filters; row warning deadline2400ms; event title immediate, abort hides and pays0 UI reward; bonus gauge follows eventBonusTime, not eventTime, total tag+3 doesn't rewrite score; legacy seen `{gap:1}` suppresses caption; district repeated lap suppressed and drops if district already changed. All check gate commands and pattern checker pass. Phone run5min on fresh storage and existing save;8+ powers, empty/ready/active, set completion, both sound states, return-market paths and rapid rotate. Later11.5 owner additionally performs a real run past3.5km. Avoid describing synthetic events as an integrated11.5 test today.

## Questions that code did not settle / fallbacks

| Question / evidence limit | Default / fallback |
|---|---|
| Is reducing road viewport to544px on360×740 fun and legible at top speed? Geometry is computed, no browser observation. | Review HUD prototype, then real camera pass task4. Default196px band. If road feels short, try band180 only after reducing caption font/copy/rows together and recomputing all y tracks; never overlay lanes to hide the problem. |
| Do we gift eight specials or all11 skins? Creative line says “each hero”, problem specifically8 empty abilities. | Default8 unique specials. Director can include three costumes with one web charge, same accounting and truthful copy; no auto change here. |
| Does Raimi's real phase sum justify nominal3s and which part should extend? Source shows no passed duration; exact physical feel is unseen. | Keep anticipation/force fixed, add.5s/lv coast, ring uses actual phase sum. If unacceptable pause Raimi-only duration sale with stated copy and preserve bought levels until resolved. |
| Is a cold/new player comfortable skipping mandatory help? No user test available. | Default OYNA straight to existing intro; always visibleNASIL OYNANIR. Director can ask for a single nonblocking menu pointer, never forced four pages. |
| District event names/IDs in11.3 siblings are not present in the inspected index; district event wiring was not available at the initial source snapshot. | Proposed districtEnter with five IDs; adapter maps actual names without changing seen IDs. Do not tell coder it already emits. |
| Are all font glyphs/labels and safe insets correct on owner's phone? Not observed. | Existing Google fonts, computed max widths. Shorten copy first; preserve14+ body,44 touch, scroll at accessibility sizes. |
| Can “once” survive private mode storage failure? Browser platform cannot promise persistence. | In-page dedup; no lost run, no remote save. Hint/gift can recur after reload. |
| Does director want11.5 district/event teaching compressed into first5min? Generation depends on skill and future districts. | Explain when encountered; never force hazards/spawns in onboarding. |

Known, not an open question: **Iron Spider upgrade works**; delegated hero bonus paths above are partial defects. Also existing double tap prioritizes charged hero, so old help's unconditionalIron Spider wording is wrong.

## Director decisions for approval (defaults already chosen)

1. Approve permanently reserved196/100px comic sky band (guarantees lane clearance; changes camera framing).
2. Approve gift scope8 unique specials and bank-preserving transfer (no hidden charge loss).
3. Approve OYNA without mandatory four-page help (comic guide remains one tap away).
4. Approve Raimi's duration bonus as longer coast, preserving launch/anticipation (requires physics/phone verification).

No decision blocks the design files; coder follows defaults unless director changes them. No new gameplay, unlocks, daily content or monetization proposed.

## What was checked in this design pass

See `proto/11-2-check.mjs` and run `node tasarim/proto/11-2-check.mjs`; script checks source links, IDs, fixture counts, JS parse and target-size arithmetic only. It is **not a browser/DOM-layout test**, does not implement future game logic tests, and does not claim screenshots or phone approval. Prototype script demonstrates states with fixture data; its queue is deliberately simpler than the production scheduler contract. Real rendering, glyph widths, dynamic safe-area/browser chrome and performance remain for the owner/coder checks above.
