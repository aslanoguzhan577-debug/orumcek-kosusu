# 11.3 Models: every piece, as a build recipe

**How to build.** Each piece below is one function in `tasarim/proto/11-3-kit.js`. Its body is a list of `pBox(list, cx, cy, cz, sx, sy, sz, colour, rx, ry, rz)` / `pCyl(list, cx, cy, cz, rTop, rBottom, h, segments, colour, rx, ry, rz)` calls with **the same signatures as the helpers in `src/city.js`**, plus three small helpers defined at the top of the kit (`pSph` = scaled 8 x 6 sphere, `sQuad` = textured quad with an atlas rectangle, `fin` = colour + place any geometry). The coder types the function into the game unchanged: no number is to be chosen. Two pieces use `THREE.ExtrudeGeometry` with the shape written out in the function.

Coordinates are segment-local: x across (+ right), y up (0 = running surface, street at −11, water at −40), z along the track, **+z towards the camera**; a segment is z −10 … +10.

Lists and their materials:

| List in the kit | Merged into | Material | Night behaviour |
|---|---|---|---|
| `P` | `dressPlain` | the city's existing plain toon material (`vertexColors`) | darkened by the scenery tint |
| `G` (`glowList()`, no height shade) | `dressGlow` | one `MeshBasicMaterial({ vertexColors: true })` | stays bright; colour grey 0.8 by day, 1 at night |
| `S`, `A`, `B` (`sQuad`) | not merged in the game: each quad becomes one **board instance** (`11-3-bugle.md` §4) with the same position, size, turn and atlas rectangle. **Exception**: the station's tiled back wall (`station`, kit 326-330) is merged into the station's tunnel shell geometry with white vertex colours (`11-3-gorevler.md` task 6) | board materials | unlit |
| tunnel shell | `shellMesh` | `MeshBasicMaterial({ map: tunnel atlas, vertexColors: true })` | unlit, own light rhythm |

No outline shells on scenery (the ink lives in the textures and in the ink strips below). No collider anywhere in this file.

Triangle counts are computed from the primitive lists, not measured.

---

## 1 Midtown polish (`city.js`, existing builders) — not seen

| Where | Add |
|---|---|
| `addSolid`, after the cornice line | ink corner strips: `pBox(P, s * (r0 - 0.03), (yA + yB) / 2, zA + 0.06, 0.1, yB - yA, 0.12, 0x1c1016)` and the same at `zB - 0.06`; ink line under the cornice: `pBox(P, s * (r0 - 0.05), yB - 0.36, zc, 0.12, 0.1, w, 0x1c1016)` |
| `makeBuilding` | water tower chance for `brown` 0.12 to 0.25 (silhouettes against the dawn sky) |
| `addBillboard` | delete the cream panel and the three accent bars (the last 7 lines); instead record a Bugle anchor at `at(0, 1.4 + hB / 2, 0.2)`: `{ kind: 'bugle', x, y, z, ry, w: 4.4, h: 2.2 }` in a new `anchors` array returned by `buildVariant`. When the chunk is mirrored (`scale.x = -1`) the anchor uses `-x` and `-ry`. |
| facade material | the Midtown atlas pair + `facadeHook` (halftone shadow band) |

Cost: 36 triangles per building block.

## 2 Chinatown

### 2.1 `lantern(P, G, x, y, z, r = 0.3)` — seen

Paper body: sphere radius `r`, squashed to 0.85 high, `e8312f`, in the glow list. Gold caps (`f6c64a`): two 8-sided cones at `y ± 0.82 r`, 0.09 high. Tassel: box 0.05 x 0.32 x 0.05 under the lower cap. Height over all 0.6 m + 0.35 m tassel. 156 triangles.

### 2.2 `lanternString(P, G, z, n = 4)` — seen

```
front (looking along the track)                 side
 x -7.5                 0                 +7.5
 y 12.6 \_____                      _____/        one row, 0.6 m deep
         o   o \__o__        __o__/ o   o
                     o  o  o                     y 11.0 line, lanterns 0.42 m below
   lowest tassel tip 9.9 m  (empty box ends at 9.5)
```

Two straight ink lines (0.04 x 0.04) from the facades (x ±7.5, y 12.6) to the middle (y 11.0); 9 lanterns 1.5 m apart. 1.4k triangles.

### 2.3 `ctDress(v)`, v = 0 / 1 — seen

Two lantern strings (z −4 and +6, or −6 and +4); four **hanging vertical signs** on 1.9 m ink brackets, alternating sides at `x = ±6.3`, 0.95 x 3.6 x 0.16 m, centre 5.2 to 7.0 m high, colours paper red / gold / teal / dark lacquer, each with three square marks on both faces (kept as boxes: seen, they read as glyph signs at speed and need no third mesh; the painted glyph signs of the Chinatown atlas, rectangle `(58 + 256 i, 776, 140, 240)` px, stay on the facades); two **shop name boards** 6 x 0.75 m at `x = ±6.95`, y 2.2, facing the track, on an ink backing; one **laundry line** at 7.9 m along one facade with five cloths (0.75 x 0.95 m: cream, red, green, yellow, blue).
Decision: the game keeps the prototype's fixed x (shop boards ±6.95, hanging signs ±6.3), because the dressing is per segment, not per chunk variant; in front of deeper facades they float up to 2 m out, which was seen and reads as bracket signs. 3.3k triangles.

`ctFest` (loop 2 festival): `ctDress(1)` plus a third `lanternString` at z 0 with `n = 4`.

### 2.4 `gate()` Ejder Kapısı — seen

```
front                                                 side (z)
        ____________________________  15.5 finials      ___
   \___/____________________________\___/  14.7 roof    |   | 3.0 deep roof
        | ==== upper beam 13.8 ==== |                   |   |
        | [   CHINATOWN  8 x 2    ] |  12.5             | | | 0.9 deep beams
  __/===| ==== lower beam 11.0 ==== |===\__  wings 10.9 | | |
  |     |O                         O|     |  lanterns 9.95, x ±4.95
  |     |                           |     |
  |     |       10.2 m clear        |     |             1.0 x 1.0 columns
 ±10.3 ±5.6                        ±5.6  ±10.3
  street −11                                beam underside 10.6
```

Lacquer red `c8202f` columns from the street to 13.8 m with a stone drum at deck level and a gold ring; lower and upper beams 12.2 m long; dark lacquer name board backing 8.6 x 2.2; five gold brackets; jade `2f9e7a` roof 14 x 0.35 x 3 with two upturned eave slabs (turned ±0.45 rad); gold ridge and finials; side wings with their own small jade roofs (turned ±0.1 rad) and outer posts at ±10.3. Name board: board instance 8 x 2 m, tabela rectangle 0. About 0.7k triangles.

## 3 Köprü

### 3.1 `cableY(m)` and `cableSeg(k)`, k = 0 … 39 — seen

Main cable height over the bridge metre `m`: `3 + 27 (m / 200)²` up to the first tower (200 m), `6 + 24 (2 (m − 200) / 400 − 1)²` between the towers, mirrored after 600 m. Tops out at 30 m at the towers, 6 m at mid-span. 40 geometries are built in a loop at load (about 400 triangles each).

Per segment and side: one main cable box 0.45 x 0.45 from `cableY(20 k)` at z +10 to `cableY(20 k + 20)` at z −10, `x = ±5.0`; eight **suspenders** 0.07 x 0.07 every 2.5 m from the deck edge (y 1.0) up to the cable (skipped where the cable is below 1.6 m): at 26 m/s they pass at 10.4 per second, the zoetrope; edge girder 0.3 x 1.4; lower chord and four diagonals under the deck; a lamp post (4 m, glow head `ffd36b`) on even `k`. Two cross beams under the deck.

### 3.2 `tower()` — seen (as a dark silhouette)

```
front                                   side
 ______________________ 32.8             _____
|______________________| cornice 31.6   |_____| 6.0
|   _       /\       _   |              |     |
|  | |     /  \     | |  | slits 25     |     | 5.0 deep
|         /    \         |  apex 24     |     |
|        |      |        |              |     |
|        | 10.8 |        |  spring 13   |     |
|  4.2   |      |  4.2   |              |     |
|________|      |________|  y −42 (under water)
−9.6   −5.4    5.4     9.6
```

One `ExtrudeGeometry` (depth 5): rectangle 19.2 x 73 with a pointed-arch hole (jambs at ±5.4 up to 13 m, two quadratic curves through control points (∓5.4, 20.5) to the apex (0, 24)), stone `c9b79c`; cornice 20.6 x 1.2 x 6; two slit windows with a 45° square as pointed top; stone course lines every 4 m; an ink strip on each arch jamb. About 450 triangles. Stands at the near edge of bridge segments 10 and 30.
Art note (seen): lit stone disappears into the orange sky. The SUNSET `tint` `8a4a6c` turns it into a dark plum silhouette with the sun inside the arch; that is the postcard.

### 3.3 `vapur()` — not seen

White ferry 6 x 24 m on the water at x 30: dark blue waterline band, cream cabin with a window band, upper deck, yellow funnel with a black top. 100 triangles. In bridge segments 6 and 24 (the second turned 180°, so it sails on the other side).

### 3.4 Water — seen in the lower corners

One plane 900 x 900 m, 60 cuts along z (it bends with the curved world), at y −40, centred 300 m ahead of the camera, `MeshBasicMaterial({ map: water, fog: true })`, colour and scroll from the day cycle. Visible only while `districtAt(distance − 60 … distance + 120)` is the bridge.

## 4 Metro tüneli

### 4.1 Section and `shellGeo(open)` — seen (lighter version)

```
        _________          y 10.4   x ±1.3
      /           \        y 9.0    x ±3.4
     /             \
    |               |      y 6.0    x ±4.7
    |   3 lanes     |
    |_______________|      y −1     x ±4.7   (deck fills the bottom)
```

Seven inward faces, each cut into eight 2.5 m slices along z. Vertex colour = `mix(0b0e22, 3d6c98, b)` with `b = (1 at lamp z, 0.3 at the slice between lamps) × face light` (walls 0.55, haunches 0.8, roof 1). UVs: one concrete cell of the tunnel atlas per 5 m (`cell = (floor(j / 2) + face) mod 3`). `open = true` leaves out the right wall and right haunch. 112 triangles. Faces point inward only: a camera outside the wall (Venom's catch shot) sees through it.

### 4.2 `tunnelLights(G, open)` — seen

Ceiling lamps 0.7 x 0.08 x 1.8 `c8f8ff` at z −7.5, −2.5, 2.5, 7.5; on each closed wall a cyan line `5ff3ff` at 3.3 m and a magenta line `ff2fa8` at 0.9 m, both 20 m long; dark ribs `0c0e1e` at z −10 and 0 (wall pieces 0.2 x 7 x 0.5 and a roof piece).

### 4.3 `station(n)`, n = 4, 8, 5 for tunnel segments 8, 9, 10 — partly seen

Right side open. Platform slab top at y 1.0 from x 4.4 to 13 (`8a8d96`), yellow safety line `ffe23a` at the edge, station ceiling at 10.5, four blue columns `2f80c4` at x 5.4, four warm light bars `ffe9b0` over the platform, back wall at x 12.98 made of 5 m tile cells (tunnel atlas cells 3, 4, 5, 6: the ÖRÜMCEK CAD. tablet and the "42" roundel) with a plain tile strip above. `n` silhouette people (`14162a`): legs box, torso box, head sphere, scaled 0.9-1.15, placed by `rng(77 + n)`; person 2 is a kid in a red cap who waves, person 4 holds a lit phone. All in the glow list (unlit) so the crowd is a pure black cut-out against the lit tiles. About 1.3k triangles.

### 4.4 `mouth()` — seen

`ExtrudeGeometry` (depth 2): wall 88 m wide from y −42 to 21 with the tunnel section as the hole, concrete `8a8d96`; parapet; a yellow / black band of seven boxes following the section 0.35 m outside it; name board 8 x 2 m (tabela rectangle 2) at 13.3 m; blue roundel (20-sided disc, radius 1.7) at 17.4 m with a white "M" of four boxes. Entry: z +10 of tunnel segment 0. Exit wall: the same object turned 180° at z −10 of segment 17.

## 5 Neon Meydan — not seen

### 5.1 `board(P, G, S, x, y, z, ry, w, h, rect, i)`

Dark frame `2a2a33` 0.5 m larger than the picture and 0.3 deep; a neon tube border of four 0.12 m boxes in `TUBE[i % 4]` (magenta, cyan, yellow, lime) in the glow list; the picture is one board instance.

### 5.2 `gantry()`

```
front
   [   NEON MEYDAN  12 x 3   ]   22.3
 o o o o o o o o o o o o o o o   bulbs 20.45
 |  DAILY BUGLE              |
 |  {N} GECEYİ GÖRDÜ!  16x8  |   centre 16.2, underside 12.2
 o o o o o o o o o o o o o o o   bulbs 11.95
 ===========================     beam 11.5
 |\                         /|   braces
 |                           |   legs 0.9 x 0.9 at x ±9.6, from the street
```

Two rows of 17 bulbs (0.3 m cubes, alternating `ffe23a` / `ff2fa8`). The 16 x 8 m picture is a Bugle instance showing `heroSlot()`. Stands at z 0 of the first Neon segment, 10 m after the tunnel exit: the exit frames it. About 560 triangles.

### 5.3 `neonDress(v)`, v = 0, 1, 2

Four boards of 8 x 4 m per segment in two tiers, turned 0.35 rad towards the track, each with a strut back to the facade:

| Side | z | centre y | x |
|---|---|---|---|
| left | +6 | 11.6 | −9.6 |
| right | −4 | 11.6 | +9.6 |
| left | −6 | 16.6 | −9.6 |
| right | +4 | 16.6 | +9.6 |

Board `i` of variant `v` is a Bugle board when `(i + v) mod 3 = 0`, else an ad (`adRect((i + v) mod 4)` of the Neon atlas). Inner edge of a board is at |x| 5.8: outside the empty box.

### 5.4 `midtownSign()`

Steel posts at x ±6.2, beam at 11.6 m, black panel 8.6 x 2.6 with the MIDTOWN board (tabela rectangle 4). Near edge of the first dawn segment.

## 6 The Bugle blimp — not seen

```
side (26 m)                               front
      ________________________                __
   .-'                        '-.__|        /    \   hull radius 4.2
  (    [ ÇARPAN   x 1 2 ]          |>      |  ()  |
   '-.________________________.-'  |        \ __ /
              [____]  gondola               fins x4, 4.6 m
```

`blimp()`: cream hull (sphere scaled 4.2, 4.2, 13), red band around the equator, four red tail fins at z +10.6, black gondola with a lit window strip, and a black banner plate 12.8 x 3.9 m on the hull's +x side. On the plate (to add in the game, 0.06 m outside it): four quads reading the glyph strip of `11-3-kaplamalar.md` §3.4, merged into one banner geometry (16 vertices, `MeshBasicMaterial({ map: glyphs })`):

| Quad | Size (m) | Centre in hull-local (x, y, z) | Strip cells (u range) |
|---|---|---|---|
| `ÇARPAN` | 7 x 3.5 | 4.46, −0.4, +2.625 | 12-15 (0.75 … 1.0) |
| `x` | 1.75 x 3.5 | 4.46, −0.4, −1.75 | 10 |
| tens | 1.75 x 3.5 | 4.46, −0.4, −3.5 | digit, or 11 (blank) |
| ones | 1.75 x 3.5 | 4.46, −0.4, −5.25 | digit, or 11 (blank) |

Each quad is a `PlaneGeometry(w, h)` turned `rotateY(+π/2)`, so it faces +x and its u runs towards −z, which is left-to-right for the runner. Cell `c` spans u `c/16 … (c+1)/16`, v 0 … 1. Shown value `n = clamp(round(state.multiplier), 1, 99)` (the number the HUD shows); for `n < 10` the tens quad shows the digit and the ones quad cell 11 (reads "ÇARPAN x5"). Only the 8 vertices of tens + ones get new UVs (16 floats), and only when `n` changes.
It is one scene-level mesh (not in a segment) at `(-34 + 6 sin(time / 9 s), 44, -120)`, `rotation.y = -1.25` (broadside, plate towards the runner), toon material tinted by the scenery tint, hidden while `tunnelAt > 0.5`. About 500 triangles, 2 draw calls with the banner.

## 7 Counts

| Piece | Triangles | Draw calls it adds |
|---|---|---|
| dress of one Chinatown segment | 3.3k | 2 (plain, glow) |
| one bridge segment | 0.4k | 2, replacing the chunk's 2 |
| one tunnel segment / station | 0.3k / 1.3k | 2, replacing the chunk's 2 |
| one Neon segment | 0.3k + 4 instances | 2 |
| portal piece | 0.2k – 0.7k | 1 or 2, one piece on screen at a time |
