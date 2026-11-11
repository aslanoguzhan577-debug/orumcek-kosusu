# 11.3 Coding tasks, budget, open questions

Ordered so that after **every** task the game runs, nothing visible regresses and all four checks pass: `node tools/test-skills.mjs`, `node tools/check-patterns.mjs`, `node tools/check-quality.mjs`, `node tools/test-audio.mjs`, plus `node --check` on every touched file. Each task also updates the rows of `tasarim/HARITA.md` it changes (§1 file map, §3 events, §11 world, §14 CONFIG, §15 tests).

Marks: `routine` = a cheap fast coder can do it from the text · `hard` = needs a strong coder · `visual-short` = code under ~150 lines · `visual-spec` = typed out from the recipe, zero design judgment.

**The recipe for every piece is code that already exists**: the functions of `tasarim/proto/11-3-kit.js` (cited by line) and the painters of `tasarim/proto/sehir-tex.js`. "Copy" below means: paste the function body unchanged; only the deltas listed in the task are allowed. Nobody has seen anything marked *not seen* in `11-3-sehir.md`; numbers there are computed.

Line numbers in `src/` come from `HARITA.md` and drift while 11.5 is being coded: re-read HARITA before each task.

## 0 Shared rules for every task

- Nothing is created during a run: every texture, material, geometry, mesh and instanced pool is built in `initCity` (behind the loader) and reaches `warmup.js`. In a run only uniforms, colours, `visible`, instance matrices / counts and small UV buffers change.
- Never write a gameplay material except the three exceptions of `11-3-gun-dongusu.md` §1 (coin `emissiveIntensity`, obstacle outline `color`, track `emissive` for wet rails).
- Scenery never calls the generator's RNG. Placement hash: `hash(n) = fract(sin(n * 127.1) * 43758.5453)`.
- No scenic geometry inside `|x| < CONFIG.city.clearX` (4.6 m) below `CONFIG.city.clearY` (9.5 m). One deliberate exception: the tunnel haunches (`SEC`, kit 278) slope into the box beyond the outer lanes; over the outer lane centre (x ±2.2, `laneWidth`) the roof is at 9.8 m, 1 m above the highest body top (8.8 m), and over x ±2.7 at 9.47 m.
- New events: `districtEnter { id, lap }`, `recordPass { score }`, `flock { position }`. None of them is a `SOUNDS` key, so audio stays silent (`audio.js` auto-listens only to `SOUNDS` keys).
- Saves: no new key, no migration.
- Prefix every new file with a one-line header comment in the house style.

## 1 CONFIG (added in task 1, read by every later task)

```js
city: {
  loop: 6000,                                     // m: one day
  districts: [['midtown', 0], ['chinatown', 1500], ['bridge', 2540], ['tunnel', 3340], ['neon', 3700], ['dawn', 5200]],
  announceAhead: 60,                              // m: districtEnter fires this far before a border
  tunnel: [3330, 3360, 3670, 3700],               // m: darkness closes 3330-3360, opens 3670-3700
  cityFade: [2460, 2600, 3400, 3420],             // m: skyline layers fade out (bridge) and back in (in the tunnel)
  clearX: 4.6, clearY: 9.5,                       // m: empty box over the lanes
  texScale: 1,                                    // 0.5 = low-memory textures (11-3-kaplamalar.md §1)
  boards: { tabela: 32, ads: 40, bugle: 24 },     // instanced board capacities
  life: { birds: 12, steam: 24, weather: 160, sparks: 120 },
  weather: [4200, 4240, 4460, 4500],              // m (loop metres): night weather envelope, loop 2 on
  stumbleNews: 600,                               // m: STUMBLE headline window
  repaintEvery: 1,                                // s: Bugle signature check while not running
  phase: { DAY: {...}, GOLDEN: {...}, SUNSET: {...}, NIGHT: {...}, DAWN: {...} },   // = kit lines 20-34, values unchanged
  phaseKeys: [[0, 'DAY'], [1300, 'DAY'], [1700, 'GOLDEN'], [2440, 'GOLDEN'], [2700, 'SUNSET'], [3340, 'SUNSET'],
    [3520, 'NIGHT'], [5000, 'NIGHT'], [5300, 'DAWN'], [5650, 'DAWN'], [6000, 'DAY']],
  discKeys: [...],                                // = kit lines 40-43, unchanged
  tunnelLook: { fog: 0x0a0b16, hemiSky: 0xbfe8ff, hemiI: 1.15, sunI: 1.0, coin: 3, rim: 1 },
  rim: 0xffb020,
},
```

`phaseKeys` names the phase instead of holding the object (the only change from the kit). The full phase table is printed in `11-3-gun-dongusu.md` §2.

## 2 The tasks

### Task 1 — pure city logic — `routine`

Files: `src/config.js` (the block above), `src/city-logic.js` (new, no three.js import), `tools/test-skills.mjs`.

Exports of `src/city-logic.js` (port from the kit, lines cited):

| Function | Source / rule |
|---|---|
| `loopMetre(d)` | `((d % loop) + loop) % loop` |
| `loopOf(d)` | `floor(max(0, d) / loop) + 1` |
| `districtInfo(d)` | kit 47-53 → `[id, k, start]`; `d < 0` → `['midtown', -1, 0]` |
| `districtAt(d)` | `districtInfo(d)[0]` |
| `dayPhaseAt(d)` | by district: midtown `'day'`, chinatown `'golden'`, bridge `'sunset'`, tunnel and neon `'night'`, dawn `'dawn'` |
| `segCentre(serial)` | `serial * 20 - 86` (`world.js` lays segment `i` at `z = 96 - 10 - 20 i`) |
| `tunnelAt(d)`, `cityAt(d)` | kit 55-59 and 444, with the CONFIG ranges; `smoothstep(a, b, x)` written out: `t = clamp((x-a)/(b-a), 0, 1); t*t*(3-2t)` |
| `mixHex(a, b, t)` | sRGB hex → linear (`c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`), lerp, back (`c <= 0.0031308 ? 12.92c : 1.055 c^(1/2.4) - 0.055`), `round(c * 255)`: identical to three's `Color.setHex().lerp().getHex()` |
| `phaseAt(d)` | kit 63-75 with `mixHex`; numbers lerp, `sunPos` lerps per element |
| `discAt(d)` | kit 77-84 |
| `dressFor(id, k, loop)` | the table of `11-3-bolgeler.md` §2 as data: `{ chunk: bool, facade: 'midtown'|'chinatown'|'neon'|null, dress: string|null, portal: [name, z, ry]|null }`; dress keys `'ct0' 'ct1' 'ctFest' 'cable0'..'cable39' 'shell' 'station0'..'station2' 'neon0'..'neon2'`; Chinatown uses `'ctFest'` when `loopFlavor(loop).festival` (task 10 adds `loopFlavor`; until then `festival` is false) |
| `districtEvent(lastId, d)` | returns `{ id, lap }` when `districtAt(d + announceAhead)` differs from `lastId`, else `null`; `lap = loopOf(d + announceAhead)`; with `lastId === null` (run start) returns `{ id: districtAt(d), lap: loopOf(d) }` |

Asserts (each a `check(...)` line in the house style):

1. `districtAt` at 0, 1499 → midtown; 1500, 2539 → chinatown; 2540, 3339 → bridge; 3340, 3699 → tunnel; 3700, 5199 → neon; 5200, 5999 → dawn; 6000 → midtown; 9340 → tunnel; −5 → midtown.
2. Over serials 0 … 304: the first segment of every district has `k = 0`; segment counts per district are midtown 75 (serials 5-79), chinatown 52, bridge 40, tunnel 18, neon 75, dawn 40; `districtInfo(segCentre(80))` is `['chinatown', 0, 1500]`.
3. `phaseAt(0).fog === 0x9ad4ff`, `phaseAt(2000).fog === 0xffcf96`, `phaseAt(3000).tint === 0x8a4a6c`, `phaseAt(4000).fog === 0x1b1a4a`, `phaseAt(5500).fog === 0xf4c4cc`, `|phaseAt(1500).hemiI − 1.55| < 1e-9`, `phaseAt(8000)` deep-equals `phaseAt(2000)`.
4. Readability floors (11-3-gun-dongusu.md R2-R4), for every loop metre 0 … 6000 step 10, with the tunnel mix applied as `daycycle` will (`hemiI = lerp(p.hemiI, 1.15, t)`, `sunI = lerp(p.sunI, 1.0, t)`): outside the tunnel (`t = 0`) `hemiI ≥ 1.4`, `sunI ≥ 1.75`; always `fogNear ≥ 42`, `fogFar ≥ 155`; for `hemiSky` and `sun` the smallest channel ≥ 0.62 × the largest.
5. `tunnelAt(3300) === 0`, `tunnelAt(3345) === 0.5`, `tunnelAt(3500) === 1`, `tunnelAt(3685) === 0.5`, `tunnelAt(3720) === 0`; `cityAt(2000) === 1`, `cityAt(2530) === 0.5`, `cityAt(3000) === 0`, `cityAt(3410) === 0.5`, `cityAt(4000) === 1`.
6. `mixHex(0x000000, 0xffffff, 0.5) === 0xbcbcbc`; `mixHex(a, b, 0) === a`, `mixHex(a, b, 1) === b` for 0x3f9eee / 0x080a26.
7. `loopOf(5999) === 1`, `loopOf(6000) === 2`, `dayPhaseAt(4000) === 'night'`, `dayPhaseAt(3500) === 'night'`, `dayPhaseAt(5300) === 'dawn'`.
8. `dressFor`: `('bridge', 10)` → `{ chunk: false, dress: 'cable10', portal: ['tower', 10, 0] }`; `('bridge', 24)` → portal `['vapur', 0, Math.PI]`; `('tunnel', 0)` portal `['mouth', 10, 0]`; `('tunnel', 17)` portal `['mouth', -10, Math.PI]`; `('tunnel', 9)` dress `'station1'`; `('neon', 0)` → dress null, portal `['gantry', 0, 0]`, facade `'neon'`; `('chinatown', 0)` portal `['gate', 10, 0]`; `('dawn', 0)` portal `['midtownSign', 10, 0]`, facade `'midtown'`.
9. Portal re-use: walking serials 0 … 700 with a live window of 13 consecutive serials, no portal name is required by two live segments at once (towers 20 segments apart, mouths 17, ferries 18).
10. `districtEvent` walked over d = 0 … 13000 step 1 emits exactly: midtown(1) at d 0, chinatown(1) at 1440, bridge(1) at 2480, tunnel(1) at 3280, neon(1) at 3640, dawn(1) at 5140, midtown(2) at 5940, chinatown(2) at 7440, … ; never the same id twice in a row.

Phone: nothing changes on screen. CONFIG only.

### Task 2 — day cycle, sky, city system — `hard`

Files: `src/daycycle.js` (new), `src/city.js`, `src/main.js`, `src/warmup.js`, `src/city-tex.js` (new; only `drawSkylineMask`, `SKY_VERT`, `SKY_FRAG` and `rng` moved from `proto/sehir-tex.js` now, plus `drawShore` from kit 424-435), `tools/test-skills.mjs`.

1. `createDayCycle({ scene, hemi, sun, sky, tinted, coin, rims, glow, boards, water })` in `daycycle.js`: `update(d)` does exactly kit `tick()` (548-570) minus the blimp and water-visibility lines (later tasks), reading `phaseAt / tunnelAt / discAt / cityAt` from `city-logic.js`. It allocates nothing per frame (`Color` objects reused).
2. Sky: replace the skyline plane's material with the `ShaderMaterial` of kit 486-491 (`SKY_VERT`, `SKY_FRAG` = `sehir-tex` SKY_FRAG with the kit's 436-442 replace, uniforms as listed). Delete the old canvas skyline painter (`city.js` 478-548 per HARITA): the mask texture replaces it.
3. The city becomes a system: `initCity(game)` (called at `main.js:181`, after every other `addSystem`) calls `game.addSystem({ update, reset })`, so it runs last. It keeps the light references it needs from `game.scene` at init (hemisphere and directional light, the only two). The system has `update(dt)` → `dayCycle.update(world.distance + cityShift)` and `reset()` → `dayCycle.update(0)` and district state cleared. It also emits `districtEnter` with `districtEvent` (task 1) every frame.
4. `tinted` = the city chunks' facade and plain materials (today's materials; task 3 replaces the facade ones). `coin` = the coin `InstancedMesh` material (`emissive 0x4a3000` in `obstacle-art.js`, pass it from `createObstacleArt` instead of the kit's traversal). `rims` = the obstacle outline materials (BackSide basic materials, except the coin outline `0x4d2600`), each stored with its base colour. Pass them explicitly; no scene traversal at runtime.
5. Debug: the URL parameter `?gun=<metres>` sets `cityShift = round(value / 20) * 20` (default 0). It shifts **only** what the city shows (day cycle, districts); the generator and score are untouched. One line in HARITA §11. (So the owner and the checker can look at the night without playing 4 minutes.)
6. Warm-up: the sky material and the two mask textures go through `warmUp(game, textures)`.

Asserts (the three.js parts cannot run headless): put the announcement state in a pure `createAnnouncer(emit)` in `city-logic.js` (`update(d)` calls `districtEvent(last, d)` and emits `'districtEnter'`; `reset()` sets `last = null`); the city system only calls it. Check: updates at 0, 1440, 1441, 2480 emit 3 events, ids midtown, chinatown, bridge, all `lap 1`; after `reset()` an update at 0 emits midtown again.

Phone (`?gun=` values in metres): at 0 the game looks like today except the new sky; `?gun=1700` warm sky, sun in the street's end; `?gun=2700` orange-magenta, big sun; `?gun=3500` inside the tunnel region: black sky (no tunnel yet: Midtown in the dark is expected at this task); `?gun=4200` night sky with stars and moon, buildings dark blue, **train, barriers, coins as clear as at noon**; `?gun=5500` pink dawn. Coins glow brighter at night, obstacle edges amber.

### Task 3 — comic facades and Midtown polish — `visual-spec`

Files: `src/city-tex.js` (move the rest of `proto/sehir-tex.js` in unchanged: `drawMidtownAtlas`, `drawMidtownGlow`, `drawChinatownAtlas`, `drawChinatownGlow`, `drawNeonAtlas`, `drawNeonGlow`, `drawTunnelAtlas`, `drawWater`, `drawBuglePage`, `drawRecordBoard`, `drawTopFive`, `glyph`, `facadeHook`, `FONT_H` and their helpers; plus `drawTabela` from kit 116-146), `src/city.js`, `src/warmup.js`.

1. Textures 1-11 of `11-3-kaplamalar.md` §1 built once in `initCity` with the kit's `tex()` (kit 450-458), anisotropy `min(4, renderer.capabilities.getMaxAnisotropy())` on 1, 3, 5, 7, else 1; `texScale` wraps each painter in `g.scale(texScale, texScale)` on a canvas of the scaled size.
2. Three facade materials exactly as `facadeMat` (kit 459-463), sharing one uniforms object `U` (kit 447). In this task every chunk uses `midtown`.
3. Midtown polish exactly as `11-3-modeller.md` §1 (ink corner strips, ink cornice line, water tower chance 0.25, billboard → anchor record; the anchor is unused until task 8, the old cream panel is deleted).
4. Delete `makeFacadeTexture` and its 256² texture.
5. Warm-up: every new texture through `textures`; one mesh per facade material in the warm-up scene.

Asserts: `facadeHook` source is a function and the three facade materials share one `U` (checked in a node-safe way: `city-tex.js` exports `facadeHook` and painters without importing three; `typeof` checks only). Painters are not tested headless.

Phone: Midtown from 0 m: windows vary (16 kinds, a cat, a spider-mask poster), a halftone dot band in the shadow side of each building, ink lines at corners. Barriers and trains as readable as before. Check the loading time is not visibly longer (budget: +0.5 s on the phone).

### Task 4 — district system, Köprü, dawn sign, tabela boards — `hard`

Files: `src/city.js`, `src/city-pieces.js` (new), `src/city-boards.js` (new), `src/warmup.js`, `tools/test-skills.mjs`.

1. `city-pieces.js`: the helpers of kit 87-113 (`shade`, `fin`, `pBox`, `pCyl`, `pSph`, `glowList`, `merge`, `kit`) and, in this task, `cableY` / `cableSeg` (kit 224-244), `tower` (246-263), `vapur` (264-274), `midtownSign` (402-409). **Delta**: in the game `sQuad(L, w, h, x, y, z, ry, rect, W = 1024, H = 1024)` pushes an anchor `{ w, h, x, y, z, ry, rect, W, H }` instead of a geometry, and `kit()` returns anchor lists unmerged under the same key (`tabela`, `ads`, `bugle`): `{ plain, glow, anchors: { tabela: [...] } }`.
2. Each segment gets four fixed children, created once: `dressPlain` (city plain toon material), `dressGlow` (`MeshBasicMaterial({ vertexColors: true })`), `shellMesh` (tunnel material, task 6), all with `matrixAutoUpdate = false`; plus the portal slot. On recycle (`world.onRecycle`, extending `assign`): `c = segCentre(seg.serial) + cityShift; [id, k] = districtInfo(c); d = dressFor(id, k, loopOf(c))`; chunk group `visible = d.chunk`; facade material from `d.facade`; `dressPlain.geometry / dressGlow.geometry` = the pre-built geometries of `d.dress` (hidden when null); release the segment's board instances, take new ones for the dress anchors; if `d.portal`: re-parent that single piece (`seg.group.add(piece)`), set `position.z`, `rotation.y`, show it; a piece whose owning segment recycles to something else is hidden.
3. `city-boards.js`: `createBoards(atlasTexture, capacity)` → an `InstancedMesh` of one unit `PlaneGeometry(1, 1)` with `MeshBasicMaterial({ map })` + the hook of `11-3-kaplamalar.md` §4.3, an `InstancedBufferAttribute aUv` (4 floats), `frustumCulled = false`. API: `take(seg, anchor, rect, W, H)`, `release(seg)` (swap-remove), `update()` (world matrix = local anchor matrix with the segment group's z added; one `needsUpdate` per mesh). Anchor local matrix: `compose((x, y, z), quaternion from ry, (w, h, 1))`. In this task only the `tabela` pool (capacity 32).
4. Water: kit 498-499, `fog: true`, visible while any of `districtAt(d - 60)`, `districtAt(d)`, `districtAt(d + 120)` is `bridge`; colour and scroll from the day cycle.
5. Bridge segments hide the chunk (cars, buildings); the deck, sleepers and rails are the world's and stay.

Asserts: (a) board pool: `take` / `release` on a fake 13-segment window walked over 2 loops with the anchor counts `{ ct0: 2, ct1: 2, ctFest: 2, neon0: { ads: 2, bugle: 2 }, neon1: { ads: 3, bugle: 1 }, neon2: { ads: 3, bugle: 1 }, gate: 1, mouth: 1, gantry: { tabela: 1, bugle: 1 }, midtownSign: 1 }` (export them as `ANCHOR_COUNTS` from `city-logic.js`; `city-pieces.js` throws at load if a builder yields a different count) never exceeds 32 / 40 / 24 and returns to the same live count at the same loop position (no leak); (b) `release` of an unknown segment is a no-op.

Phone (`?gun=`): 2480 the city melts into haze, the far shore appears; 2700-3200 cables strobe past, two dark stone arches with the sun inside the first, the white ferry with a yellow funnel far below, pink water; 5200 the steel MIDTOWN sign at dawn. The lanes and obstacles on the bridge read as clearly as in Midtown.

### Task 5 — Chinatown — `visual-spec`

Files: `src/city-pieces.js`, `src/city.js`.

Copy: `lantern` (kit 163-168), `lanternString` (171-174), `gate` (176-198), `ctDress` (200-219). Add `ctFest = ctDress(1)` plus `lanternString(P, G, 0, 4)` merged into its plain/glow lists. Palette constants kit 162. Chinatown facade material `chinatown` (task 3). Shop board x stays as in the kit (`s * 6.95`, seen and accepted). Tabela atlas rectangles `nameRect` / `shopRect` (kit 121-122).

Asserts: `ANCHOR_COUNTS` for `ct0`, `ct1`, `ctFest`, `gate` match the builders (the load-time throw of task 4 covers it).

Phone: `?gun=1440`: the red gate with the jade roof and CHINATOWN board 60 m ahead, honey light; lantern strings high overhead (never read as obstacles: ask a friend who has not seen it), hanging signs, Turkish shop names readable at speed (EJDER DÖNER, ÇAYCI WONG …), laundry.

### Task 6 — Metro tunnel — `visual-spec`

Files: `src/city-pieces.js`, `src/city.js`, `src/warmup.js`.

Copy: `SEC`, `FACE_LIGHT` (kit 278-279), `shellGeo` (282-304), `tunnelLights` (305-313), `shell` (314), `station` (316-341), `mouth` (343-362). Tunnel material `MeshBasicMaterial({ map: tunnelAtlas, vertexColors: true })`. **Delta (one draw call less than the prototype)**: the station's tiled back wall quads (kit 326-330) are real geometry, not board instances: build them as `PlaneGeometry`, delete `normal`, add a white `color` attribute, and merge them with `shellGeo(true)` (both via `toNonIndexed()`) into the station's `tunnel` geometry, so a station segment draws `shellMesh` + `dressGlow` like every tunnel segment. Station people: `rng` from `city-tex.js`.

Asserts: the tunnel/station geometries keep inward faces only (a node-safe check of `SEC`: every face's inward normal points to `x = 0`) — optional; the portal re-use assert of task 1 covers the exit wall.

Phone: `?gun=3280`: concrete wall with the yellow/black band and blue M roundel, METRO / SONRAKİ DURAK: GECE board; inside: dark blue, lamps and two neon lines rushing, **coins glowing**, barriers with amber rims; one bright station with a silhouette crowd (kid in a red cap waves); 13 s later out into the night. Judge: thrilling, not a burden. If obstacles are hard to see in here, raise the tunnel light floor first (open question 5).

### Task 7 — Neon Meydan — `visual-spec`

Files: `src/city-pieces.js`, `src/city.js`, `src/city-boards.js`.

Copy: `FRAME`, `TUBE` (kit 365), `board` (367-375), `adRect` (376), `gantry` (378-390), `neonDress` (392-401). Neon facade material `neon`. New pool `ads` (capacity 40) on the Neon day atlas (the same texture object as the facade map; the board hook ignores its 0.25 repeat). **Delta**: Bugle anchors (`gantry` 16 x 8, `neonDress` 8 x 4) take instances from a `bugle` pool created here on a placeholder: the Bugle atlas canvas (2048 x 1024) filled black with the 16 slot frames; their rectangle is the slot rectangle `[(i % 4) * 512, floor(i / 4) * 256, 512, 256]` with `i = SLOT.NIGHT` (12) for now. Task 8 makes them talk.

Asserts: `ANCHOR_COUNTS` for `neon0..2` and `gantry`; pool walk of task 4 now includes ads and bugle.

Phone: `?gun=3640`: out of the tunnel straight under the bulb arch with a 16 m board and NEON MEYDAN on top; then a canyon of boards in two tiers, ads (AĞ SPREY, OSCORP, PİZZA AĞI, STARK), lit windows. Check: ad words cut at building edges on the facades look fine or wrong (open question 2).

### Task 8 — Daily Bugle boards — `hard`

Files: `src/bugle-logic.js` (new: `proto/11-3-mansetler.js` copied unchanged, including its self-check; not to be confused with the power-up `src/powerups/bugle.js`), `src/city-tex.js` (`paintBugle`, `11-3-kaplamalar.md` §3.3), `src/city.js`, `tools/test-skills.mjs`.

1. Lifecycle exactly as `11-3-bugle.md` §3: signature `name|skin|best|runs|multiplier`; check every `repaintEvery` s while `state.mode !== 'running'`; once more on `start`; repaint = `paintBugle` + `needsUpdate`. First paint after `document.fonts.ready`.
2. At recycle, each Bugle anchor takes `deck[n % deck.length]` from `bugleDeck(ctx)` with the board counter `n` (reset on `reset()`); the gantry anchor takes `heroSlot(ctx)`. Midtown roof anchors (task 3) join the Bugle pool. `ctx` as `11-3-bugle.md` §2; `stumbleD` from the `stumble` event; `loop` / `night` / `dawn` from `city-logic.js`.
3. `recordPass`: each frame `recordPassed(prev, floor(state.score), best)`, emitted once per run.

Asserts: the five of `11-3-bugle.md` §7, with `stumbleNews` from CONFIG; plus: a recycle-time choice for a board 164 m ahead never changes while it is visible (simulate: the slot stored at take time is the slot read until release).

Phone: start a run: Midtown roof boards with the player's name and score; `?gun=3640` the arch says `<İSİM> GECEYİ GÖRDÜ!`; stumble once and the next boards mock it; change the name in the menu, start again: the boards show the new name with no hitch at start. Strike unfunny headlines on `proto/11-3-bugle.html`.

### Task 9 — blimp, pigeons, gulls, steam — `visual-spec`

Files: `src/city-life.js` (new: `update(dt)`, `reset()`), `src/city-logic.js` (`flockAt`), `src/city-pieces.js` (`blimp`, kit 411-420; bird and puff geometries), `src/city-tex.js` (`drawBlimpGlyphs`, `11-3-kaplamalar.md` §3.4), `src/city.js`, `tools/test-skills.mjs`.

Recipes: blimp and banner `11-3-modeller.md` §6; birds, gulls, steam `11-3-canli-ayrintilar.md` §1-§4 (every size, colour and curve is there). Pools as the table at the top of that file, sizes from `CONFIG.city.life`.

Asserts: `11-3-canli-ayrintilar.md` §7 items 1 and 4 (birds and puffs part); `flockAt` is pure and deterministic.

Phone: Midtown and Chinatown: now and then a flock bursts off the rails ahead in a fan and clears above head height before you arrive; steam puffs from street vents beside (never over) the track; the cream blimp far left with ÇARPAN x<n> matching the HUD multiplier; gulls fly beside you on the bridge.

### Task 10 — record celebration, night weather, festival — `visual-spec`

Files: `src/city-life.js`, `src/city-logic.js` (`loopFlavor`, `weatherAt`, `celebrationKind`), `src/city.js` (`ctFest` from `dressFor`), `tools/test-skills.mjs`.

Recipes: fireworks, ticker tape, rain, snow and the wet sheen: `11-3-canli-ayrintilar.md` §5-§6; `loopFlavor`: `11-3-bolgeler.md` §6 with `h = hash(loop)`: rain if `h < 0.5`, snow if `h < 0.75`, else clear (loops ≥ 4); festival on loop 2 and even loops ≥ 4. Reduced motion (`matchMedia('(prefers-reduced-motion: reduce)')`, read once at load like `fx.js`): no sparks, no rain/snow pieces; the sheen and board changes stay. Fireworks pause while 11.5's Goblin is on screen (`state.eventKind === 'goblin'`; a no-op until 11.5 ships him).

Asserts: `11-3-canli-ayrintilar.md` §7 items 2, 3, 4 (weather and sparks part), 5; `loopFlavor(1..4)` = clear / rain+festival / snow / festival; over loops 4 … 403 the rain share is within 0.4-0.6 and snow within 0.15-0.35.

Phone: beat your record at night: fireworks over the skyline; beat it by day: ticker tape along the facades (lanes stay clear). Second loop (`?gun=10300`): rain in Neon Meydan with wet rails, the festival Chinatown with three lantern strings.

### Task 11 — district hook in the 11.5 generator — `hard` (needs the manager's go: open question 9)

Files: `src/patterns.js` (`_row`, `_eventZone` only), `tools/test-skills.mjs`. The one place 11.3 touches the generator; 11.5's design hands this hook to 11.3 (`11-5-yol-surprizleri.md` §A hook line, `11-5-olaylar.md` Goblin hook). It changes **which kind** is placed, never spacing, speed or difficulty numbers.

1. Row masks (pure, in `city-logic.js`): `ROW_HOME = { gap: ['bridge'], gate: ['tunnel'], girder: ['midtown', 'neon', 'dawn'] }`. In `_row`, a type enters the weight table only if `districtAt(d)` and `districtAt(d + len)` are both in its home list (after the existing unlock distances, which stay: so in loop 1 every new obstacle debuts in its home district, the first girder in Neon Meydan). If the no-repeat rule empties the table, retry once without the no-repeat rule; if it is still empty (Chinatown), no row is placed: the row stays due and this block is an ordinary block. RNG: the existing roll is consumed exactly as today, whether or not a row results.
2. Zones: `_eventZone` picks `goblin` iff `districtAt(start) === 'neon'`, else `venom` (alternation removed). A zone whose `[start, start + len]` overlaps a tunnel range is not placed; it stays due until `loopMetre` passes 3700.

Asserts: 150 seeds × 30 km: every gap's `[d, d + len]` lies in the bridge, every gate in the tunnel, every girder in midtown / neon / dawn; no zone overlaps 3340-3700 of any loop; every Goblin zone starts in Neon Meydan; same seed → identical descriptors (determinism); `check-patterns.mjs` prints its OK line. Report the new per-km frequencies of rows and zones in the progress file (they fall: expected, not a failure).

Phone: the rail gap appears only on the bridge, the signal gate only in the tunnel, the crane girder in Midtown / Neon; the Goblin only at night.

## 3 Performance budget (binding)

Baseline measured in the unbatched prototype at 126 m: **76 draw calls, 96,964 triangles**. The prototype draws one mesh per kit list; the game design draws 2 meshes per segment plus one instanced mesh per board kind, so game numbers are computed equal or lower. **Frame time on a phone is not measured.**

| Place (worst moment) | Prototype measured | Game, computed | Ceiling |
|---|---|---|---|
| Midtown | 79 / 91k | 76 + boards 1 + blimp 2 + birds 2 + steam 1 = 82 | |
| Chinatown, gate in view | 103 / 134k | 76 + 2 per visible dressed segment (~9) = 94, + boards 1, gate 2, life 5 = 102 | |
| Köprü | 71-94 / 73-90k | dress replaces chunk: 76 + water 1 + tower or ferry 1 + blimp 2 + gulls 2 = 82 | |
| Metro tunnel | 77-80 / 72-74k | shell + glow replace chunk: 76 + mouth 3 = 79 (blimp hidden) | |
| Neon Meydan, loop 2 rain + record fireworks | not seen | 76 + 18 + ads 1 + bugle 1 + gantry 2 + blimp 2 + steam 1 + weather 1 + sparks 1 = 103 | |
| **Any point of the loop** | | | **≤ 105 draw calls, ≤ 140k triangles** |

- Texture memory: **+43.2 MB** new, −5.6 MB deleted = **+38 MB net** at `texScale 1`; 15 MB at `texScale 0.5` (computed, RGBA8 × 1.33 mipmaps).
- Shader programs: + facade (one shared), sky, board hook, basic-vertex-colour, basic-map-vertex-colour: all compiled in the warm-up.
- Per-frame CPU: ≤ 96 board matrices, ≤ 316 particle matrices (12 + 24 + 160 + 120), one `update(d)` with about 40 uniform/colour writes. No allocation per frame.
- **Acceptance (PLAN 11.3 "bitti sayılır")**: the checker records `renderer.info.render.calls / triangles` at 0, 1450, 2800, 3500, 3650, 4300 m (`?gun=`) before task 2 and after task 10; on the owner's phone the adaptive resolution (`quality.js`) must not settle on a lower step in Neon Meydan than in today's Midtown.
- **How districts swap**: only on recycle, 164 m ahead, beyond the fog end: chunk group visibility, facade material reference, dress geometry reference, board instances, one portal re-parent. No material is recoloured per segment; the day cycle recolours the shared materials once per frame.
- If over budget, cut in this order: (1) `texScale 0.5`; (2) hide `dressPlain` / `dressGlow` of segments whose z < −120 (fog is ≥ 85 % there): −6 calls; (3) drop the laundry lines and hanging-sign marks from `ctDress` (−1k triangles per segment); (4) steam off.

## 4 Open questions, each with its built-in default

| # | Question | Default / fallback |
|---|---|---|
| 1 | Board hook written blind against three r170 `uv_vertex` chunk | checker greps the chunk once; fallback: one 4-vertex geometry per board, UVs written at recycle (+1 call per visible board) |
| 2 | Neon facade ad bands cut at building edges | fallback: paint the facade copy's rows 2-3 with glass cells, ads from a second atlas (+5.3 MB) |
| 3 | Texture memory on the owner's phone | `texScale 0.5` if the page reloads or textures go black |
| 4 | Night readability | raise the R2 floor first: night hemi 1.4 → 1.5, sun 1.75 → 1.9; never touch obstacle colours |
| 5 | Tunnel too dark or too bright | lit shell `3d6c98` → `4a80b0` (brighter) or → `2f5a84` (darker); light floor 1.15 / 1.0 stays |
| 6 | Pigeons on the rails mistaken for obstacles | perch them on the side walls (`x = ±4.7`, `y = 1.2`) instead of the rails |
| 7 | Headline painter shrinks a long headline under 0.9 m cap height (58 px) | shorten that headline; the painter is not changed |
| 8 | Night begins at 3.7 km (~2 m 50 s of clean running) | keep; the tunnel at 3.34 km is the promise |
| 9 | Task 11 changes which obstacle the generator picks (PLAN says 11.3 does not change the generator; 11.5 hands it this hook) | do task 11 last, type choice only, gated by check-patterns; if refused, skip it: 11.5 runs district-agnostic and nothing else in 11.3 depends on it |
| 10 | Snow on the third night | in (task 10); drop if the task runs long |
| 11 | The ferry is an Istanbul vapur | in |
| 12 | Loop 2+ keeps order and lengths | keep (landmarks comparable between friends) |
| 13 | Chinatown hosts no 11.5 obstacle | keep: one district stays classic |
| 14 | Dawn and loop-2 caption copy | 11.2 owns all caption copy; proposals in `11-3-bolgeler.md` §4 |

## 5 What the owner looks at on his phone

Before coding (the prototypes, served with the game: `python tools/serve.py`, then `http://<pc-ip>:5173/tasarim/proto/...`):

1. `11-3-canli.html` — the real game with the new look; jump buttons per district, a slider, **TUR** (a tour with collisions off, 7 s per stop). Not in it: pigeons, steam, rain, fireworks, the real 16-slot Bugle wording (it shows 8 sample boards). In it but never seen by anyone: the darker tunnel, Neon Meydan, dawn, the blimp, coin glow and amber rims: his eyes are the first.
2. `11-3-bugle.html` — all 38 headlines with his saved name; strike the unfunny ones.
3. `sheet.html` — window, sign and tile textures.

After coding, with `?gun=<metres>` on the game URL: 0 (Midtown, comic facades), 1440 (gate), 2700 (bridge postcard), 3280 (tunnel mouth → station → night), 3640 (first night board with his name), 4300 (Neon canyon), 5140 (dawn sign, windows going dark), 10300 (second night, rain). Every time: can he name the lane of the next obstacle at a glance? That is the one test that matters.
