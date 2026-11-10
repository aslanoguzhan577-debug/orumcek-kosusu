# 11.5 design — progress (rewritten, not a diary)

Agent: fable-tasarim-11-5. Scope: design and modelling recipes only, files under `tasarim/` only. No code, no tests, no model code.

## 1 Done so far
- The design is complete on disk in four files (see §4). No browser tab was ever opened: nothing to restore.
- Code read once, do not re-read: `tasarim/HARITA.md`, PLAN.md §10-11, `src/patterns.js`, `config.js`, `obstacles.js`, `tools/check-patterns.mjs`, `chaser.js`, `powerups/sense.js`, `game.js`, `main.js`, `obstacle-art.js`, `powerups/tracer.js`, `missions.js`; parts of `ironspider.js`, `hero-specials.js`, `skillIronMan.js`, `skillBlackPanther.js`, `camera.js`, `world.js`, `player.js`, `venom.js`, `vfxCore.js`, `curve.js`, `warmup.js`, `toon.js` helper headers, ui.js `hudFlash`.

## 2 Decisions (reason in one line)
- Gap and gate are full-track rows; girder covers centre + one outer lane: new decisions for the player, per-lane fairness proof stays.
- Wide obstacle = one lane collider per lane, linked in `group`, first is `owner` (draws): sense / Iron Spider / hero smashes / camera are lane-keyed and keep working unchanged.
- Girder collision static (parked pose), art swings by `girderOffset(tau, open)`, parked for the last 1.2 s: provable; collision only matters at tau ~ 0.
- Gap = `pit` part (never a floor; hit while feet < 0.35): a low box would be stepped onto (`stepUp` 0.4).
- Removing a group member: mates get `z = 1e6` (released next frame), never spliced: hero code iterates `obstacles.active` by reverse index.
- Removed gap leaves a steel patch plate in a separate `patches` list: Iron Man's beam re-destroys whatever stays in `active` every frame.
- Events run on generator-reserved empty zones; the generator waits with "calm blocks" until every lane is empty: fairness by construction, checkable (C8-C12).
- One pure row function `nextRow` for strikes and bombs; warning = `max(warnAt(d), floorW(delta, d))`: never below the checker's reaction time plus lane changes.
- Event hit = `obstacles.eventHit(x)` -> `_hit('side', …)`: stumble / decoy / hero absorb / Venom catch rules reused; Venom forgives one hit in his own event (`chaser.spare`).
- Reward multiplier = new `game.mult.event` (tracer.js writes `mult.temp` absolutely).
- Events are skipped at the trigger (flight, hero special, tracer, boost, Venom not away) and aborted without reward if those start mid-event.
- Director never imports art; `main.js` passes it in, calls are guarded: node tests run logic only.
- Zones are generated from task 5 but the director's zone hook is installed last (task 13): no event is live before its visuals.
- Goblin = one vertex-coloured soft toon material, 10 meshes, single-piece limbs: <= 18 draw calls.
- Owner's rule applied: no model code by the designer; `11-5-modeller.md` holds primitive-by-primitive recipes; visual tasks marked `visual-short` (<150 lines) or `visual-spec`.
- No browser prototypes (quota): numbers come from code geometry; each recipe has a "Look at" list and the few numbers a checker may tune; framing risks are open question Q8.

## 3 Left, in order
Nothing in the design pass. Done at the end: `tasarim/HARITA.md` got the missing `menu` event row; vault note `knowledge/concepts/kosu-oyunu-set-parca-olay-tasarimi.md` created and receipt `spidermanoyun-fable-tasarim-11-5-yol-surprizleri-2026-11-10` sent; final report handed back.
Next for the manager: decide D1-D6 (`11-5-gorevler.md` H), add the vault note to `knowledge/index.md`, then hand tasks 1-15 to the coders in order.

## 4 Files
| File | State |
|---|---|
| `tasarim/11-5-yol-surprizleri.md` | complete: index, concept, decisions, CONFIG block, A.1-A.4 obstacles, A.5 `obstacles.js` changes, A.6 generator code, A.7 checker rules C1-C14 |
| `tasarim/11-5-olaylar.md` | complete: S shared machinery (`event-logic.js` code, director lifecycle, hit / dodge / sense rules), B Venom Hamlesi, C Yeşil Cin baskını, D shared rules (spacing, pause / reset, scaling, events table with sound hooks, HUD / captions, missions) |
| `tasarim/11-5-modeller.md` | complete: M0 conventions + `addRow` / `addPatch`, M1 gap, M2 gate, M3 girder, M4 lane warnings, M5 tendrils, M6 bombs / rings / columns, M7 Goblin + glider (hierarchy, parts, face canvas, pose table, flight), M8 fx handlers |
| `tasarim/11-5-gorevler.md` | complete: E budget, F 15 ordered tasks with asserts and fairness cases, G open questions Q1-Q10, H manager decisions D1-D6 |
| `tasarim/ilerleme-11-5-tasarim.md` | this file |

## 5 A successor must not redo
- Do not re-derive the numbers: jump air time above 0.25 m = 0.488 s (gap window >= 0.25 s from 600 m on); `floorW(1) = 0.88 s`, `floorW(2) = 1.10 s` until the endless phase; zone length = speed x 12 s covers a 10 s event with the 1 s end margin; at most 2 rows alive (art caps 3).
- Known unverified points are listed as questions in `11-5-gorevler.md` G (facePatch deform contract, fx word function name, setDolly users, test harness stubs, Cap surf height, coin banking, scaled instances with toon shading, portrait framing, audio throttling, truss clipping). They are for the coder / checker, not for another design pass.
- If the design must change: the recipe file wins over the short art tables in file 1; CONFIG lives only in file 1 §2.
