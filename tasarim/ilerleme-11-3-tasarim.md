# 11.3 design handover

Agents: fable-tasarim-11-3 (art director, prototypes + first docs), then **opus-tasarim-11-3-bitirme** (finishing: tasks, budget, consistency). Design only; write scope `tasarim/11-3-*`, `tasarim/proto/11-3-*`, this file, wrong rows of `HARITA.md`. No browser, no tests, no commit.

## Done
- Prototypes: `proto/11-3-kit.js`, `proto/11-3-canli.html`, `proto/11-3-mansetler.js`, `proto/11-3-bugle.html`.
- Docs by the art director: `11-3-sehir.md`, `11-3-bolgeler.md`, `11-3-gun-dongusu.md`, `11-3-kaplamalar.md`, `11-3-modeller.md`, `11-3-bugle.md`, `11-3-canli-ayrintilar.md`.
- Finisher:
  - `11-3-gorevler.md` WRITTEN: 11 ordered tasks with marks, CONFIG block, asserts with exact values, phone checks; binding budget (§3); open questions (§4); owner's phone list (§5).
  - `11-3-bolgeler.md`: `subway` -> `tunnel`; §4 now `districtEnter { id, lap }` (11.2 owns copy, proposals kept); portal/hosts/living-details table added under §1; §5 generator hook = task 11 (keeps unlock distances); §6 loop table without captions, exact hash rule.
  - `11-3-canli-ayrintilar.md`: steam vent x 6.0, puff radius 0.4 -> 1.2 (old numbers entered the empty box); `subway` -> `tunnel`.
  - Prototypes: id `subway` -> `tunnel` in kit + canli.html; relative paths (`../../src/...`, `../../index.html`, kit URL built from `location.href`) so they work under any base path; bugle.html storage reads guarded.
  - Verified: 11 skin ids in `index.html` = headline keys; segment counts per district; portal metres (gate 1504, towers 2744/3144, mouth 3344, exit 3704, arch 3714, dawn sign 5204).

## Decisions + reason (one line each)
- Loop 6000 m: Midtown 0-1500, Chinatown 1500-2540, Köprü 2540-3340, Metro 3340-3700, Neon 3700-5200, dawn 5200-6000. Reason: dawn gets a place, night is 1.5 km.
- Night painted on scenery, lights keep a floor. Reason: seen, toys stay readable.
- District event `districtEnter { id, lap }`, ids `midtown chinatown bridge tunnel neon dawn`. Reason: 11-2-anlati-kutusu.md listens for exactly that.
- Generator hook is task 11, last, needs the manager's go; keeps 11.5's unlock distances. Reason: PLAN says 11.3 does not change the generator, 11.5 hands it the hook; keeping unlocks makes each new obstacle debut at home.
- Station tile wall merged into the tunnel shell geometry (white vertex colours). Reason: one draw call less, no board pool needed for it.
- `?gun=<m>` debug param shifts only what the city shows. Reason: owner and checker can see the night without a 4-minute run.
- R3 light-colour rule threshold 0.62 (GOLDEN sun `ffd0a0` = 0.627 was seen and approved; 0.63 contradicted it).
- Budget ceiling: ≤ 105 draw calls, ≤ 140k triangles anywhere; +38 MB net textures (15 MB at texScale 0.5).

  - Also done: `11-3-gun-dongusu.md` R3 -> 0.62; `11-3-bugle.md` skins verified + power-up name note; `11-3-modeller.md` station exception, shop-board x decision, exact blimp banner layout (`state.multiplier`); `11-3-sehir.md` index, shared names, budget line, decision 0 (task 11), relative-path note; `11-3-gorevler.md` tunnel-haunch exception to the empty box; grep pass clean.
  - Vault: note `knowledge/concepts/sonsuz-kosu-mesafe-gun-dongusu.md`; receipt `spidermanoyun-opus-tasarim-11-3-bitirme-sehir-tasarimi-2026-11-11`.

## Left, in order
**Design: nothing.** Next: manager decides open question 9 (task 11) and the owner looks at the prototypes; then coding from `11-3-gorevler.md` task 1. HARITA: no wrong row found, unchanged.

## File states
- All 11-3 docs and prototypes on disk and current; `11-3-gorevler.md` complete.
- Earlier prototypes (`sehir-tex.js`, `tables.js`, `live.js`, `sheet.html`, `view.html`) unchanged; `tables.js` still says `subway` (superseded file, not in scope).

## Successor must know
- **localStorage was NOT restored** after the art director's browser tests (missions progress counted 5 runs; a banked hero charge may be spent). Already reported.
- `newRecord` fires at game over only; the in-run record moment uses `recordPassed()`.
- Do not redo the docs or prototypes; do not touch `src/`, `tools/`, `11-2-*`, `11-5-*`.
