# 11.3 Districts: the route, recycling, portals, captions

Source of every number here: `proto/11-3-kit.js` (`LOOP`, `DISTRICTS`, `districtInfo`, `tunnelAt`, `cityAt`, `assign`). Times are computed from CONFIG's speed curve (11 m/s, +0.15 m/s² to 26, then +0.014), not measured.

## 1 The route (one loop = 6000 m)

| # | id | Name on screen | Run metres (loop 1) | Length | Segments | Reached after | Phase |
|---|---|---|---|---|---|---|---|
| 1 | `midtown` | MIDTOWN | 0 – 1500 | 1500 | 75 | 0 s | noon |
| 2 | `chinatown` | CHINATOWN | 1500 – 2540 | 1040 | 52 | 86 s | golden hour |
| 3 | `bridge` | KÖPRÜ | 2540 – 3340 | 800 | 40 | 126 s | sunset |
| 4 | `tunnel` | METRO TÜNELİ | 3340 – 3700 | 360 | 18 | 157 s (inside for 13.4 s) | dark; night falls outside |
| 5 | `neon` | NEON MEYDAN | 3700 – 5200 | 1500 | 75 | 170 s | night |
| 6 | `dawn` | MIDTOWN (şafak) | 5200 – 6000 | 800 | 40 | 225 s | dawn |
| – | `midtown` | MIDTOWN | 6000 – 7500 | … | | 253 s | second noon |

`dawn` is Midtown's kit and atlas under the dawn sky: the place the player started in, seen in pink light. Every border is a multiple of 20 m, so a 20 m segment never straddles two districts.

| id | Palette (hex) | Facade | Dressing per segment | Signature silhouette |
|---|---|---|---|---|
| midtown / dawn | brick `c0553f`, brownstone `8a4f3c`, cream `f0cf7c`, glass `6ec6d9`, cab yellow `f6c026`, ink `1c1016` | Midtown atlas (16 window kinds) + glow | none (the chunk itself: water towers, fire escapes) + Bugle board on roof billboards | water tower on a roof line; the stepped spire straight ahead |
| chinatown | lacquer `c8202f`, paper red `e8312f`, gold `f6c64a`, jade `2f9e7a`, teal `1f6f6b`, dark lacquer `7a1620`, cream `f3e2c0` | Chinatown atlas (arched windows, shutters) + glow | `ctDress(0/1)`: 2 lantern strings, 4 hanging signs, 2 shop boards, 1 laundry line | sagging dotted line of lanterns across the sky |
| bridge | stone `c9b79c`, cable `3b4352`, girder `5a6472`, lamp `ffd36b`, water per phase | none (city chunk hidden) | `cableSeg(k)`: 2 main cables, 16 suspenders, girders, lamp posts | pointed stone arch with the sun inside it |
| tunnel | shell dark `0b0e22` to lit `3d6c98`, lamp `c8f8ff`, cyan `5ff3ff`, magenta `ff2fa8`, tile `f3ecd9`, band `2f80c4`, safety yellow `ffe23a` | none | `shell()` or `station(n)` | ring of light rushing at the camera |
| neon | frame `2a2a33`, magenta `ff2fa8`, cyan `22e6ff`, yellow `ffe23a`, lime `8cff3a`, violet `7b3cff` | Neon atlas (glass grid, ad bands) + glow | `neonDress(0/1/2)`: 4 boards in two tiers | boards stacked to the sky, bulbs |

| id | Portal piece (passed at) | Hosts from 11.5 (after task 11) | Living details |
|---|---|---|---|
| midtown | none at 0 m; loop 2+ enters from dawn with no portal | girder, Venom | pigeons, steam, blimp, Bugle roof boards |
| chinatown | Ejder Kapısı gate (1504 m) | Venom only (the classic district) | pigeons, steam, blimp; festival on loop 2 / even loops |
| bridge | stone towers (2744, 3144 m) | gap, Venom | gulls, ferry, water, blimp |
| tunnel | METRO mouth (3344 m), exit wall (3704 m) | gate only (no zone overlaps it) | station crowd; blimp hidden |
| neon | billboard arch with the hero Bugle board (3714 m) | girder, Goblin (only here), Venom never | steam, blimp, rain / snow on loop 2+, record fireworks |
| dawn | MIDTOWN steel sign (5204 m) | girder, Venom | pigeons, steam, blimp, windows going dark |

## 2 How a recycled segment learns where it is

`world.js` lays segment `i` at `z = 96 - 10 - 20 i` and gives every recycled segment the next `serial`; `world.reset()` restarts serials at 0. So the centre of a segment in run metres is

```
segCentre(serial) = serial * 20 - 86
```

and its district is `districtInfo(segCentre(serial))`, which returns `[id, k, start]`: `k` is the index of the segment inside its district (0 = first), `-1` before the start line. Because borders are multiples of 20 and centres are `20 n - 86`, the first segment of a district begins 4 m after the nominal border: the player passes a portal at `border + 4 m`.

The city's existing `assign(seg)` (city.js) is extended, not replaced. Per recycled segment, in this order (no allocation: every mesh named here exists from load and is only shown, hidden or given another pre-built geometry):

| District | City chunk (facade + plain) | Dress meshes (plain + glow) | Extra on `k` |
|---|---|---|---|
| midtown, dawn | visible, facade material `midtown` | hidden | dawn `k = 0`: `midtownSign` at local z +10 |
| chinatown | visible, facade material `chinatown` | `ct[k % 2]` | `k = 0`: `gate` at z +10 |
| bridge | **hidden** | `cable[k]` (40 geometries) | `k = 10, 30`: `tower` at z +10; `k = 6, 24`: `vapur` (second one turned 180°) |
| tunnel | **hidden** | `shell`, or `station[k - 8]` for `k = 8, 9, 10` | `k = 0`: `mouth` at z +10; `k = 17`: `mouth` at z −10 turned 180° (exit wall) |
| neon | visible, facade material `neon` | `neon[k % 3]` for `k ≥ 1` | `k = 0`: `gantry` at z 0 |

Each segment owns four fixed child meshes: `dressPlain` (the city's plain toon material, so it takes the scenery tint), `dressGlow` (unlit vertex colours), `shellMesh` (tunnel material) and one shared **portal slot** per piece type. Portal pieces are single objects, one of each (`gate`, `tower`, `vapur`, `mouth`, `gantry`, `midtownSign`): the two towers are 400 m apart and the two tunnel walls 340 m apart, more than the 256 m a segment lives, so one object serves both. At recycle time the piece is moved into the owning segment's group with `seg.group.add(piece)` (a re-parent, no allocation), given its local z and rotation from the table, and shown; when that segment recycles again the piece is hidden. Boards (name boards, shop names, ads, Bugle pages) are instances, see `11-3-bugle.md` §4.

Mirroring: the chunk's existing left/right flip stays for the chunk only. Dress meshes are never flipped (text would mirror).

Reset: `world.reset()` re-fires every segment, so a new run redresses everything; nothing else to do.

## 3 Portals

| Into | Piece (function in `11-3-kit.js`) | Player passes at | Clear opening | What sells it |
|---|---|---|---|---|
| Chinatown | `gate()` Ejder Kapısı | 1504 m | 10.2 m wide between columns, beam underside 10.6 m | red columns from the street, jade roof with upturned eaves, name board, two big lanterns |
| Köprü | first `tower()` at bridge metre 200 | 2744 m (and 3144 m) | arch 10.8 m wide, apex 24 m | the sun inside the arch; the city has already dissolved 80 m earlier |
| Metro | `mouth()` | 3344 m | the tunnel section (9.4 m wide, apex 10.4 m) | 88 m wide concrete wall, yellow/black band, blue "M" roundel |
| Neon Meydan | tunnel exit, then `gantry()` 10 m later | 3704 m, 3714 m | board underside 12.2 m, legs at ±9.6 m | a 16 x 8 m Bugle board with the player's name, two rows of bulbs |
| Midtown (dawn) | `midtownSign()` | 5204 m | beam at 11.6 m, posts at ±6.2 m | plain steel sign: the party is over |

No portal has a collider. The loop border at 6000 m (dawn to noon) has no portal: the light simply finishes rising.

## 4 District announcements (the caption box and all its copy belong to 11.2)

11.3 only emits the fact, under the name and ids that `11-2-anlati-kutusu.md` already listens for:

```
events.emit('districtEnter', { id, lap })   // id from districtAt, lap = loopOf(distance + 60)
```

- At the first city update of a run (after the intro) it emits the district the run starts in (`midtown`, lap 1): 11.2's "first menu-to-run district query".
- Afterwards it emits once whenever `districtAt(distance + CONFIG.city.announceAhead)` (60 m) differs from the last emitted id: about 2.3 s before the portal at 26 m/s. So the sequence per loop is midtown, chinatown (1440 m), bridge (2480), tunnel (3280), neon (3640), dawn (5140), then midtown of the next lap (5940).
- 11.3 emits every entry on every lap; 11.2 decides what to show (it announces each district's first encounter once, gives priority to safety prompts and first-time hints, and has no `dawn` entry yet). Logic: `createAnnouncer` / `districtEvent` in `city-logic.js` (`11-3-gorevler.md` task 1-2).

**Copy proposals for the 11.2 owner (not binding, 11.2 decides):** `dawn` → `ŞAFAK! / Geceyi çıkardın. Bunu kaç kişi gördü?`; a lap-2+ variant per district: Chinatown `Ejder seni tanıdı.`, Köprü `Manzara aynı, sen daha hızlısın.`, Metro `Sonraki durak: yine gece.`, Neon `Panolar hâlâ senden bahsediyor.`, Şafak `Bir gece daha bitti. Efsane.`, Midtown `{lap}. gün. Şehir sana alıştı.`

## 5 What 11.5 gets from this stage

Pure functions exported by `src/city-logic.js` (no three.js; 11.5's generator may import them):

| Function | Returns |
|---|---|
| `districtAt(d)` | `'midtown' \| 'chinatown' \| 'bridge' \| 'tunnel' \| 'neon' \| 'dawn'` (the ids of 11.2's caption catalogue, plus `dawn`) |
| `dayPhaseAt(d)` | `'day'` (midtown), `'golden'` (chinatown), `'sunset'` (bridge), `'night'` (tunnel, neon), `'dawn'` (dawn) |
| `loopOf(d)` | `floor(d / 6000) + 1` |

| 11.5 element | Lives in | Note for its art |
|---|---|---|
| `gap` (ray yarığı) | bridge only | abyss slab colour = the phase's `water` colour (sunset `d8556a`), so the hole shows the sea |
| `gate` (sinyal kapısı) | tunnel only | its red lamps are the brightest thing in the tunnel; the station stretch (`k` 8-10, 3500-3560 m) is fine for it |
| `girder` (vinç kirişi) | midtown, neon, dawn | at night its outline takes the amber rim like every obstacle |
| Venom hamlesi | anywhere except tunnel (a zone overlapping 3340-3700 waits until 3700) | the red lane warning must not compete with the tunnel's magenta line |
| Yeşil Cin | `dayPhaseAt(d) === 'night'` **and** `districtAt(d) === 'neon'` | he needs sky; fireworks pause while he is on screen |

The hook into the generator is `11-3-gorevler.md` task 11 (the last task, waiting for the manager's go): a district mask on `_row`'s type table and `goblin iff districtAt(start) === 'neon'` in `_eventZone`. It **keeps** 11.5's unlock distances (`firstAt / gateAt / girderAt`) instead of dropping them, so in loop 1 every new obstacle debuts in its home district (the first girder appears in Neon Meydan, after 3.7 km). It changes which kind is placed, never spacing, speed or difficulty; Chinatown places no row. Venom zones never overlap the tunnel.

## 6 From the second loop on

Order and lengths never change (friends compare landmarks; 11.5 keeps stable windows). Freshness comes from dressing, weather and words, all decided by the pure function `loopFlavor(loop)`:

| Loop | Chinatown | Night weather (Neon metres 4200-4500 of the loop) | Bugle |
|---|---|---|---|
| 1 | normal | clear: the first night is the clean postcard | night headlines |
| 2 | **festival**: every segment uses `ctFest` (= `ctDress(1)` + a third lantern string at z 0) | **rain**, always | `loop` headlines join the deck ("{N} SABAHI ETTİ") |
| 3 | normal | **snow**, always | same |
| 4+ | festival on even loops | `h = hash(loop)`: rain if `h < 0.5`, snow if `h < 0.75`, else clear | same |

Captions per lap are 11.2's (proposals in §4). Festival costs one more pre-built dress geometry (`ctFest`). Rain and snow share one particle pool (`11-3-canli-ayrintilar.md` §6). "İkinci gece yağmur yağıyor", "üçüncü gece kar" are deterministic on purpose: they are brag lines.
