# 11.3 Şehir yaşıyor — one run, one day, one trip across the city

Design by the art director, 2026-11-11. Documents and prototypes only: no game code, tool, save or PLAN.md was changed.

## How to read this set

| File | What it fixes |
|---|---|
| [11-3-bolgeler.md](11-3-bolgeler.md) | the route, how a recycled segment learns its district, portals, captions, what 11.5 gets, loop variations |
| [11-3-gun-dongusu.md](11-3-gun-dongusu.md) | every phase number, the sky, the tunnel curtain, the readability rules |
| [11-3-kaplamalar.md](11-3-kaplamalar.md) | texture list, recipes, the two shader hooks, memory |
| [11-3-modeller.md](11-3-modeller.md) | every piece: silhouette, recipe function, placement, material, pooling |
| [11-3-bugle.md](11-3-bugle.md) | the Daily Bugle boards: slots, 38 headlines, when each shows, the hitch-free lifecycle |
| [11-3-canli-ayrintilar.md](11-3-canli-ayrintilar.md) | pigeons, gulls, steam, blimp, fireworks, ticker tape, rain, snow |
| [11-3-gorevler.md](11-3-gorevler.md) | **start here to code**: the CONFIG block, 11 ordered tasks with marks, files, asserts and phone checks; the binding performance budget (§3); open questions with fallbacks (§4); the owner's phone list (§5) |
| [ilerleme-11-3-tasarim.md](ilerleme-11-3-tasarim.md) | handover: done, decisions, what is left |

Shared names across the set: district ids `midtown chinatown bridge tunnel neon dawn` (the same ids as 11.2's caption catalogue); events `districtEnter { id, lap }`, `recordPass { score }`, `flock { position }`; new modules `src/city-logic.js` (pure), `src/daycycle.js`, `src/city-tex.js`, `src/city-pieces.js`, `src/city-boards.js`, `src/bugle-logic.js` (pure), `src/city-life.js`; CONFIG group `CONFIG.city`.

Budget in one line (computed, not measured on a phone): ≤ 105 draw calls and ≤ 140k triangles at any point of the loop (today 76 / 97k), +38 MB net texture memory (15 MB with `texScale 0.5`), nothing created during a run.

Prototype files are part of the design (the recipes live in them):

| File | Role |
|---|---|
| `proto/11-3-kit.js` | **the numbers and the build recipes**: phase tables, district table, every piece as `pBox` / `pCyl` calls with the signature of `src/city.js` |
| `proto/11-3-canli.html` | the real game in a frame with the 11.3 look applied; jump buttons, slider, TUR |
| `proto/11-3-mansetler.js` | headline catalogue + pure chooser + self-check (moves to `src/bugle-logic.js` unchanged) |
| `proto/11-3-bugle.html` | every Bugle board drawn with the saved player name |
| `proto/sehir-tex.js`, `proto/sheet.html` | earlier designer's texture painters and their sheet: **kept as the texture authority** |

`proto/tables.js` and `proto/live.js` are superseded by `11-3-kit.js`. An earlier first pass of this file (route 1500/1100/900/360/2140) is replaced by this one.

## Concept

The track runs west and the player chases the sun. Distance is the clock: the first 1.5 km is the Midtown everyone knows at clean noon, now inked like a comic page. Through a red and gold gate the street narrows into Chinatown and the light turns to honey; lantern strings cross high overhead and shop signs joke in Turkish. Then the walls fall away: on the Köprü the city dissolves into haze, a huge sun sits on the water straight ahead, two stone towers pass as dark backlit arches and the suspenders strobe by like a zoetrope. A tunnel mouth marked METRO, "SONRAKİ DURAK: GECE", swallows the track: the tunnel is the stage curtain. Inside it is dark, lamps and two neon lines rush past, coins glow, one lit station flashes by with a silhouette crowd. While the player cannot see the sky it turns to night, and the first thing outside is a sixteen metre Daily Bugle board on an arch of bulbs: "<İSİM> GECEYİ GÖRDÜ!". Neon Meydan is a canyon of boards that talk about this player. After 1.5 km of night the neon thins, the sky goes pink, and the player is back in Midtown at dawn: the same street, water towers against a pale sky, before a second noon. Six kilometres, one day. "I reached the night" and "I saw the morning" are the things friends will brag about.

Two ideas carry the readability: **night is painted on the scenery, never on the toys** (track, obstacles, coins and characters stay lit like a stage while the city around them goes dark), and **the sun is a character** (always straight ahead, so every phase has one clear picture).

## Scope that cannot move

- No new light, shadow map, post-processing, image file, dependency or build step. The existing hemisphere light and sun are tinted and moved; signs and windows are emissive or unlit surfaces.
- Every texture, material, geometry and shader variant exists before the first run starts (built behind the loader, warmed in `warmup.js`). During a run nothing is created; only uniforms, visibility, instance matrices and small UV buffers change.
- The pattern generator, speed curve and difficulty are untouched. Scenery uses its own hash; it never calls the generator's RNG, never collides, never reserves track.
- Nothing scenic enters the box `|x| < 4.6 m, y < 9.5 m` (highest flight: swing 7.2 m + body 1.6 m = 8.8 m).
- Saves: no new key, no migration. The boards read `spidey.name`, `spidey.scores`, `spidey.skin`.
- Player-facing text is Turkish. Midtown, Chinatown, Daily Bugle and Neon Meydan are proper names.

## What was seen and what was not

The prototype was judged in the real game camera (portrait 390 x 844) until the browser was withdrawn for cost. Marked honestly:

| Seen in the game camera | Computed or written blind, **not seen** |
|---|---|
| Midtown with the 16-kind window atlas | Midtown ink edges and halftone at phone resolution |
| Ejder Kapısı from 80 m | Neon Meydan: arch, boards, neon facade atlas on the shared chunks |
| Chinatown at golden hour: lantern strings, hanging signs, tint | dawn Midtown, the MIDTOWN gantry |
| Köprü: sky opening, far shore, dark towers, suspenders, pink water in the lower corners | sun disc at its final size and height |
| Metro mouth with hazard band and METRO board | the darker tunnel shell and the lower tunnel light floor |
| tunnel light rhythm, the two neon lines, station columns | station crowd, tablets, exit wall |
| readability of track, coins, barriers, trains in all of the above | coin glow, amber obstacle rim, blimp, every living detail, rain, fireworks |
| draw calls and triangles of the unbatched prototype | frame time on a phone, GPU memory |

Three things changed because they were seen: saturated sunset light turned the white train salmon (light colours are now pale, mood comes from sky, fog and scenery tint); the skyline plane read as a wall on the bridge (it now fades into a low far shore); the lit stone tower vanished into the orange sky (towers are now a dark backlit silhouette).

## For the owner: what to open on the phone

The pages use relative paths: they work wherever the repository root is served (`python tools/serve.py` on the PC, phone on the same Wi-Fi at `http://<pc-ip>:5173/...`, or a static host that serves the whole repo under any base path). They need the internet for three.js (CDN) and Google Fonts, like the game. After coding, the list in `11-3-gorevler.md` §5 (game URL with `?gun=<metres>`) replaces this one.

1. `http://<pc>:5173/tasarim/proto/11-3-canli.html` — the real game with the new look. Press **TUR** to be carried through the day with collisions off (7 s per stop), or play normally and use the buttons to jump. Judge: does each district feel like a place, is every obstacle as clear as today, is the tunnel dark enough to be a thrill but not a burden, is the first night board a "vay" moment.
2. `http://<pc>:5173/tasarim/proto/11-3-bugle.html` — all 38 headlines with your name. Strike the ones that are not funny.
3. `http://<pc>:5173/tasarim/proto/sheet.html` — the window, sign and tile textures.

The prototype is not optimised (it adds a mesh per piece) and has no pigeons, steam, rain or fireworks; those are specified in `11-3-canli-ayrintilar.md`.

## Decisions asked from the manager (defaults are built in, nothing blocks)

The full list with technical fallbacks is `11-3-gorevler.md` §4; these are the ones that need a person.

| # | Question | Default |
|---|---|---|
| 0 | Task 11: 11.3 puts the 11.5 obstacles in their home districts by changing which kind the generator picks (PLAN says 11.3 leaves the generator alone; 11.5's design hands it this hook) | do it, last, kind only, gated by check-patterns; skipping it breaks nothing else |
| 1 | Night starts at 3.7 km (about 2 min 50 s of clean running). Earlier? | keep; the tunnel at 3.34 km is the promise |
| 2 | Snow on the third night (same particle pool as rain) | in, as the last step of the weather task; drop it if the task runs long |
| 3 | The ferry under the bridge is a white Istanbul-style vapur with a yellow funnel: a wink for the friends | in |
| 4 | Loop 2 keeps the order and the lengths; only dressing, weather and headlines change | keep: landmarks stay comparable between friends, 11.5 keeps stable windows |
| 5 | Chinatown hosts none of the three new 11.5 obstacles | keep: one district stays "classic" |
| 6 | The earlier designer's 16 window kinds include a spider-mask poster and a cat; ads say AĞ SPREY, OSCORP, PİZZA AĞI, STARK | keep |
