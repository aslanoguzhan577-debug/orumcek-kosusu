VERDICT: NEEDS FIXES

Re-check after the fix pass. All four commands re-run, all green (last lines below). I fixed nothing.

## Really done

- **B1** facade hook only switches night windows — `Object.keys(shader.uniforms) === 'uWinOn'`, no dot/halftone/fwidth path, toon chain intact (`tools/test-skills.mjs:1595-1597`, `:1603`, `:1607`; `src/config.js:479`, `src/city-tex.js:565`, `src/city.js:518`).
- **B2** 16 hangers per bridge segment, bottom meets rail top within 0.02 m, top meets the main cable, one clamp each, railing beneath (`tools/test-skills.mjs:1881-1887`).
- **B3** body emission = colour × the exact day/tunnel blend (`src/daycycle.js:24-26`, `tools/test-skills.mjs:1565-1566`), cleared on reset (`:1569`), non-emissive materials untouched (`:1572`), ink hulls retained (`src/obstacle-art.js:17,43,81,506`, `tools/test-skills.mjs:2184`).
- **Task 11** as written: `ROW_HOME` verbatim (`src/city-logic.js:16`), both span ends masked, roll consumed, empty table places nothing and leaves the row due (`src/patterns.js:41,349,352-356`), goblin iff the zone starts in Neon, tunnel overlap skipped (`:399-405`), asserted at `tools/test-skills.mjs:230-269`.
- **Fairness — the decisive check: PASS.** The `tools/check-patterns.mjs` diff adds only the home-district row rule, the district-derived zone kind and the tunnel-zone rule. No spacing, margin, speed or difficulty number was touched, loosened or special-cased; still 150 seeds × 38 424 m with "reaction margin >= 0.4 s everywhere", so district obstacles are proven passable.
- Scenery: no colliders, nothing written to saves (no `setItem` in `src/city.js`), no per-frame `new` (`tools/test-skills.mjs:2075`), pools emptied and hidden on start/gameover/menu (`src/city-chinatown.js:81-84`, `src/city-dragon.js:136-137`), hidden outside Chinatown.
- Budget, harness-computed: extension 12 calls / 18 616 tris / 3 932 160 B; stage 117 / 182 394 / 42 991 608 vs 150 / 250 000 / 60 MB.

## Defects — 1-3 need an owner ruling, not a coder

1. **blocker** tasks 9 and 10 absent; `src/city-life.js` does not exist (`tasarim/11-3-gorevler.md:171-189`). Task 9 sits on a real contradiction: 3 vents × 0.28 s × 3.4 s life = 36 concurrent puffs (`tasarim/11-3-canli-ayrintilar.md:53`) against a 24 pool and the assert at `:97`. Pick capacity/lifetime/cadence; task 10 follows.
2. **blocker** the 20 000-tri extension share is unreachable as designed — 1-in-6 with cuts 2+3+4 measures ≈ 22 124 (`tasarim/ilerleme-11-3-kod.md:11`). The fit was bought with `wallEvery: 10` (`src/config.js:483`), past the ladder's 1-in-6 (`tasarim/11-3-chinatown-ek.md:157`) and the mandated `hash % 4` (`:152`), and pinned as if sanctioned at `tools/test-skills.mjs:1990`.
3. **bug** the 996-tri wall head (`src/city-dragon.js:78-103`) reaches the cap only by dropping the mandated gold lip strip (`tasarim/11-3-chinatown-ek.md:65`, a box per K2 `:115`) plus nostrils, mouth lining, tongue, pearl, pomps, brow/cheek patches, lids and blue mane tips. K9 halves listed counts, it does not delete parts. Frozen as asserts at `tools/test-skills.mjs:1961,1971`.
4. **polish** dead import `ROW_HOME`, `tools/test-skills.mjs:9`.
5. **polish** determinism assert spans 20 km (`:227`) where `gorevler.md:198` asks 30 km.

Progress file is current and honest (`tasarim/ilerleme-11-3-kod.md:30,60-76`): per-km frequencies reported (rows 1.4/km, was 2.0; zones 0.5/km), own decisions listed.

## Only a human on a phone can judge

`?gun=1500` bridge hangers read as attached, gulls beside you, no yellow frames; `?gun=2540` tunnel gate; `?gun=3500` Neon girder; `?gun=4300` Chinatown wall heads legible at speed, banners clear of the rails; `?gun=10300` rain/festival not testable, task 10 absent.

## Last check lines

- `node tools/test-skills.mjs` → `OK 323598 checks`
- `node tools/check-patterns.mjs` → `OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.`
- `node tools/check-quality.mjs` → `OK: adaptive resolution`
- `node tools/test-audio.mjs` → `OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)`

No command refused. `tasarim/HARITA.md` corrected for `obstacle-art.js`, `patterns.js` task 11, `daycycle.js` emission, `city-logic.js` exports, `city-chinatown.js` head-only wall dragons, Palette row.
