VERDICT: READY TO COMMIT

Scope checked: 11.3 tasks 1–6 as coded, plus the 11.5 shield-surf pit fix. Nothing was edited except this file.

## 1. Commands (run exactly, nothing appended)

| Command | Result |
|---|---|
| `node tools/test-skills.mjs` | `OK 222391 checks` + the city triangle accounting line |
| `node tools/check-patterns.mjs` | passable-route OK |
| `node tools/check-quality.mjs` | `OK: adaptive resolution` |
| `node tools/test-audio.mjs` | `OK`, peak music 36 (38 inside test-skills; ordering variance, cosmetic) |

## 2. Working tree

Modified: `src/city.js` (344), `src/config.js` (+39), `src/events.js` (+1), `src/main.js` (3), `src/obstacle-art.js` (+2), `src/obstacles.js` (5), `src/powerups/hero-specials.js` (−1), `src/warmup.js` (+11), `tasarim/HARITA.md` (61), `tools/test-skills.mjs` (+324). New: `src/city-boards.js`, `src/city-logic.js`, `src/city-pieces.js`, `src/city-tex.js`, `src/daycycle.js`, `tasarim/ilerleme-11-3-kod.md`. 621 insertions / 170 deletions. No stray files, no build artefacts, no editor junk. `src/patterns.js` and `tools/check-patterns.mjs` untouched — Task 11 correctly not started.

## 3. Task by task

| Task | Status | Evidence |
|---|---|---|
| 1 loop/clock logic | DONE | `src/city-logic.js` `loopOf/phaseAt/discAt/tunnelAt/cityAt/mixHex`; asserts `test-skills.mjs:25-94` |
| 2 day cycle, no gameplay repaint | DONE | `src/daycycle.js` (scenery-only; obstacles reached only via explicit `coin`/`rims` refs); `src/main.js` wiring |
| 3 district swap on recycle | DONE | `src/city.js` plans/`seq` cache, `dressFor`; `test-skills.mjs:1553-1687` incl. `plans.length === 300`, inward-face assert |
| 4 board instancing | DONE | `src/city-boards.js` (unit plane, `vMapUv = aUv.xy + uv * aUv.zw`, swap-remove); `test-skills.mjs:1476-1551`, two-loop no-leak walk, peaks `{tabela:27, ads:35, bugle:18}` |
| 5 textures + painters | DONE | `src/city-tex.js` (751 lines: `facadeHook`, `drawTabela`, `drawShore`, `BRIDGE_SKY_FRAG` at 743-751 replaces targets at 502/531); `main.js` `await document.fonts.ready` |
| 6 warm-up covers the new work | DONE | `src/warmup.js:43-48` facade/piece meshes, `62-76` forces every board `mesh.count` and restores in `finally` |
| 7–10 (Bugle, blimp/birds/steam, weather/festival, Neon+dawn dress) | MISSING — correctly | `city.js` builds portals only for `['tower','vapur','midtownSign','gate','mouth']`; `dressFor('neon',k).portal = ['gantry',0,0]` and the missing `pieces.neon*` are skipped by the `!!plan.dress?.plain` / `plan.portal && portals[...]` guards. Night runs, just undressed. Safe to commit. |

## 4. Fairness untouched

`git diff src/config.js` has zero deletions — every distance, speed, spacing and difficulty number survives verbatim. `tinted` holds city materials only; no obstacle body is ever recoloured. Night readability floors R2–R4 asserted for every 10 m of the loop (`test-skills.mjs:45-55`). Worst colour pair found and judged acceptable: Chinatown lantern red `PAPER = 0xe8312f` (`city-pieces.js:40`, unlit `dressGlow`, full brightness at night) vs hazard red `0xe63946` (`obstacle-art.js`). Hue gap 0.02 — nearly identical. It is not a gameplay hazard: the lanterns live on the facade wall above the rails, never in a lane, and the amber rim (`obstacle-art.js:505`, `CONFIG.city.rim`) is the lane marker. Worth one look on a phone at `?gun=2700`.

## 5. 11.5 surf fix — correct

`src/obstacles.js:456-460` exempts a pit only, never a gate or girder, and only while `part.pit && ((surf.active && surf.mode === 'cap') || (surf.cap.exit >= 0 && p.lastY > p.floorY && p.vy <= 0))`. The general `obstacles.grace(0.1)` is gone (`hero-specials.js:674` deleted) — verified against the source, not the summary. Two notes:
- The exit branch stays true for the whole ~0.38 s exit flip, so an ordinary jump that lands over a pit inside that window is forgiven. Narrow, non-exploitable, but it is a behaviour change outside the surf.
- `cap.exit` only drains through `_capShield`, which returns early when the shield is hidden. Any future path that hides the shield before `_capExit()` would make pit immunity permanent. Latent, not live.

## 6. Reset rules

`world.reset()` assigns `seg.serial = i` from 0 and fires every recycle callback, so no board, plan or anchor state survives a restart; serials are never negative, so `specFor(serial)` is safe. Asserted by the reset walk in `test-skills.mjs:1553-1687` (pool drains to 0).

## 7. Budget — computed, not measured

Triangles ≈ 96,964 + 9 × 3,344 + 648 ≈ **127.7k** < 140k. Draw calls ≈ **97** worst point (Chinatown + gate) < 105. Textures ≈ 34.9 MB new − 5.33 MB old skyline − 0.07 MB old facade ≈ **+29.5 MB** net < +38 MB. All three inside ceiling.

**Gap to close:** the acceptance in `11-3-gorevler.md §3` asks for real `renderer.info.render.calls/triangles` at 0, 1450, 2800, 3500, 3650, 4300 m. `ilerleme-11-3-kod.md:72` records those as UNAVAILABLE (browser host refused twice). I did not measure either and am not guessing a number for someone else's instrument. The clause reads "before task 2 and after task 10", so it does not block a stage 1–6 commit — it must be run before the stage closes. Note also that task 10's festival dress (4,772 tris/segment) lands the projection at ≈140k: measure it when task 10 lands, do not assume today's margin holds.

## 8. Old saves

No persistence or storage file appears in the diff. Save loading is byte-for-byte unchanged.

## 9. Test quality

No vacuous asserts found. The new 324 lines run real module source in `node:vm` with fake THREE stubs, check exact values (`eq(json(peaks), json({tabela:27, ads:35, bugle:18}))`, `json([0.5,0.27,0.11,0xfff0a0])`), walk two full loops for leaks, and include a negative test (`assert.throws(buildPieces, /City anchor count: midtownSign.tabela/)`) plus a source-fidelity guard (`ok(pieceSource.includes(ctRecipe), 'approved Chinatown recipes ported unchanged')`).

## 10. HARITA.md

Already updated by the coder and verified line by line: module rows 35-39, `districtEnter` row 156, `?gun=` row 514, pit rule row 285; cited addresses `city.js:637`, `config.js:471`, `city-pieces.js:54/78/99/130/148/160/175/209/236/266` all correct. No edit needed from me.

Director decisions respected: night at 3.7 km, ferry, no new 11.5 obstacle in Chinatown, `districtEnter` on the event bus with no polling (`events.js:5`), Task 11 not started.
