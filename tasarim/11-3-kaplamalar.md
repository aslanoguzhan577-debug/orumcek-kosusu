# 11.3 Textures and shader hooks

Rule of this file: a painter that already exists in `tasarim/proto/` is the recipe. The coder moves the listed functions into `src/city-tex.js` **unchanged** (they are pure canvas 2D code, no three.js) and does not redraw anything by taste. The sheet `proto/sheet.html` shows the earlier designer's painters; they were seen and approved by the art director.

## 1 Inventory

All built once in `initCity`, handed to `warmUp(game, textures)` so `renderer.initTexture` uploads them behind the loader. The canvases are kept (three re-uploads from them after a lost context); only the Bugle canvas is ever repainted.

| # | Texture | Size | Painter (file) | Wrap / repeat | Mipmaps | Used by | GPU MB |
|---|---|---|---|---|---|---|---|
| 1 | Midtown day atlas | 1024² | `drawMidtownAtlas` (sehir-tex) | repeat, 0.25 x 0.25 | yes | facade `midtown` map | 5.3 |
| 2 | Midtown glow | 512² | `drawMidtownGlow` | repeat, 0.25 | yes | facade `midtown` emissiveMap | 1.3 |
| 3 | Chinatown day atlas | 1024² | `drawChinatownAtlas` | repeat, 0.25 | yes | facade `chinatown` map | 5.3 |
| 4 | Chinatown glow | 512² | `drawChinatownGlow` | repeat, 0.25 | yes | emissiveMap | 1.3 |
| 5 | Neon day atlas | 1024² | `drawNeonAtlas` | repeat, 0.25 | yes | facade `neon` map **and** the ad boards (instanced, own UV maths, §4) | 5.3 |
| 6 | Neon glow | 512² | `drawNeonGlow` | repeat, 0.25 | yes | emissiveMap | 1.3 |
| 7 | Tunnel atlas | 1024 x 512 | `drawTunnelAtlas` | clamp | yes | tunnel shell, station wall | 2.7 |
| 8 | Skyline mask (R far, G near, B windows) | 2048 x 512 | `drawSkylineMask` | clamp, **no colour space** | yes | sky shader | 5.3 |
| 9 | Far shore mask (R silhouette, G windows) | 1024 x 64 | `drawShore` (11-3-kit) | repeat, no colour space | no | sky shader | 0.3 |
| 10 | Water | 512² | `drawWater` | repeat, 9 x 9 | yes | water plane | 1.3 |
| 11 | Tabela (names + shop boards) | 1024² | `drawTabela` (11-3-kit) | clamp | yes | name / shop boards (instanced) | 5.3 |
| 12 | Bugle atlas, 16 slots | 2048 x 1024 | `paintBugle` (§3) | clamp | **no** (linear filter; repaint must stay cheap) | Bugle boards (instanced) | 8.0 |
| 13 | Blimp banner glyphs | 1024 x 128 | `drawBlimpGlyphs` (§3) | clamp | no | blimp banner | 0.5 |
| | **Total** | | | | | | **43.2** |

Computed (RGBA8, ×1.33 with mipmaps), not measured. The old 256² window texture of `makeFacadeTexture` and the old canvas skyline are deleted (−0.3 MB, −5.3 MB): net growth about **+38 MB**. Low-memory switch: `CONFIG.city.texScale = 0.5` halves the size of textures 1-7 and 11 (painters are written in atlas pixels, so wrap the context in `g.scale(0.5, 0.5)`): total 15 MB. Default 1; the checker decides from the phone.

Anisotropy: `min(4, max)` on 1, 3, 5, 7 as today; 1 on the rest.

## 2 What the existing painters contain (so nobody repaints them)

| Atlas | Layout | Content |
|---|---|---|
| Midtown day | 4 x 4 cells of 256 px, one cell = one window bay x one floor | wall courses, lintel, sill, ink frame (4 px, `#1c1016`), 16 kinds (`MID_KINDS`): plain, half blinds, red curtain, teal curtain, plant, air conditioner, cat, spider-mask poster and eight more |
| Midtown glow | 4 x 4 cells of 128 px | warm glass `#ffe59a` / `#ffbe4d` with the same silhouettes (cat, person, poster) in black; two cool TV-blue windows, one pink; three cells stay dark |
| Chinatown day | 4 x 4 | arched windows on cream, red shutters, green frames, balconies, a lantern in the window, laundry; bottom row = four vertical glyph signs (red / yellow) |
| Chinatown glow | 4 x 4 | warm arches, two red-paper windows, the four signs dimly lit |
| Neon day | rows 0-1: 8 glass-grid cells with magenta / yellow / lime sill lines; rows 2-3: four ads of 512 x 256: AĞ SPREY, OSCORP, PİZZA AĞI, STARK | |
| Neon glow | same layout at half size | random lit office cells (lilac), the ads at night strength, the sill lines marked always-on |
| Tunnel | 4 x 2 cells of 256 | 0-2 concrete (plain, cable trays, niche with lamp), 3 tile, 4-5 the "ÖRÜMCEK CAD." mosaic tablet across two cells, 6 tile + "42" roundel, 7 tile + "METRO ►" |

Because the facade UVs of `city.js` are in cell units (u = bay, v = floor) and the texture repeats 0.25, bay `i` on floor `j` shows atlas cell `(i mod 4, j mod 4)`: sixteen different windows per four bays and four floors, with no change to `Facade.quad`. On the Neon facade this makes ad bands two floors high every four floors: intended (Times Square), **not seen**; if the cut words at building edges look wrong on the phone, the fallback is one line: paint rows 2-3 of the neon *facade* copy with the glass cells again (the ad boards read the ads from a second, unrepeated atlas then: +5.3 MB).

## 3 New painters

### 3.1 `drawTabela(g)`: 1024 x 1024 (written, in `11-3-kit.js`; seen only on the gate and the tunnel mouth)

1. Fill black.
2. Six district boards, 512 x 128 each, board `i` at `x = (i % 2) * 512`, `y = floor(i / 2) * 128`:
   fill `#14162a`; title in Bangers 78 px centred at y + 50: stroke 18 px in the glow colour at alpha 0.35, stroke 7 px at alpha 1, fill white; sub line Baloo 2 800 20 px at y + 106 in the accent colour; 6 px accent frame inset 5 px.

   | i | Title | Sub line | Glow | Accent |
   |---|---|---|---|---|
   | 0 | CHINATOWN | FENERLER YANDI | `#e8312f` | `#f6c64a` |
   | 1 | KÖPRÜ | DERİN NEFES AL | `#ff8a5c` | `#ffd36b` |
   | 2 | METRO | SONRAKİ DURAK: GECE | `#2f80c4` | `#f2b632` |
   | 3 | NEON MEYDAN | ŞEHİR UYUMAZ | `#ff2fa8` | `#22e6ff` |
   | 4 | MIDTOWN | GÜNAYDIN ŞEHİR | `#2f80ed` | `#ffd23a` |
   | 5 | ÖRÜMCEK CAD. | PERON 1 | `#2f80c4` | `#f3ecd9` |

3. Eight Chinatown shop boards, 512 x 64 each, board `i` at `x = (i % 2) * 512`, `y = 384 + floor(i / 2) * 64`: background `['#c8202f', '#1f6f6b', '#f6c64a', '#7a1620'][i % 4]`, ink colour `['#f6c64a', '#f3e2c0', '#7a1620', '#f6c64a'][i % 4]`; 4 px frame inset 5 px; one `glyph()` mark (34 px) at each end; name in Bangers 46 px centred.
   Names: **EJDER DÖNER · WOK'N ROLL · ÇAYCI WONG · KUNG FU KUAFÖR · PANDA BÜFE · ŞANGHAY MANTI · BAMBU TERZİ · NOODLE USTA**.
4. y 640-1024 stays black (reserve).

### 3.2 `drawShore(g)`: 1024 x 64 (written, seen on the bridge)

Black; walk x from 0: building width `6 + r * 18`, height `8 + r * 26` (+22 for 8 % of them), filled `#ff0000`; 10 % get a 2 x 10 antenna; windows `#ffff00` 2 x 2 px every 4 x 5 px with chance 0.3. RNG `rng(606)`.

### 3.3 `paintBugle(g, slots, name, best, list)`: 2048 x 1024

Slot `i` at `x = (i % 4) * 512`, `y = floor(i / 4) * 256`, 512 x 256. For each of the 16 entries of `buildSlots()` (`11-3-mansetler.js`): `type 'page'` calls `drawBuglePage(g, x, y, 512, 256, { kicker, headline, sub, photo })`; `'wanted'` calls `drawRecordBoard(g, x, y, 512, 256, name, best)`; `'top5'` calls `drawTopFive(g, x, y, 512, 256, list, name)`. All three painters exist in `sehir-tex.js` and already shrink the headline to fit two lines. Then `texture.needsUpdate = true`. When this may run: `11-3-bugle.md` §3.

### 3.4 `drawBlimpGlyphs(g)`: 1024 x 128

Sixteen cells of 64 x 128. Fill `#12161f`. Cells 0-9: the digit in Bangers 104 px centred, stroke `#d8262c` 10 px, fill `#ffd23a`. Cell 10: `x` the same way. Cell 11: empty. Cells 12-15 (256 px wide together): `ÇARPAN` in Bangers 58 px, white, centred. A row of `#ffd23a` 6 x 6 px bulbs every 14 px along the top and bottom edge of the whole strip.

## 4 Shader hooks (three, each compiled once)

**4.1 Facade** — `facadeHook(U)` of `sehir-tex.js`, set as `onBeforeCompile` on the three facade materials (`toonMaterial(0xffffff, { map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true })`). It adds: per-window on/off (`step(hash(floor(vEmissiveMapUv * 4)), uWinOn)`, always-on pixels marked by emissive alpha) and the comic halftone: where the toon light is in its dark band, dots of `uDotTint` are multiplied in, 8 dots per window bay on a 45° screen, anti-aliased, fading to a flat tone when dots get smaller than a pixel. `U` is one shared uniforms object. The three materials share one program. Seen working in Midtown, Chinatown, bridge approach.

**4.2 Sky** — §3 of `11-3-gun-dongusu.md`. `SKY_VERT` calls `curveWorld()` itself (curve.js injects it into every non-raw material).

**4.3 Boards** — one hook for the three instanced board materials (`MeshBasicMaterial({ map })`), so an instance picks its picture with a per-instance `aUv = (u0, v0, uSize, vSize)`:

```js
mat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aUv;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = aUv.xy + uv * aUv.zw;\n#endif');
};
```

It bypasses the texture's repeat on purpose (that is what lets the ad boards read the repeated Neon atlas). **Written blind against three r170's `uv_vertex` chunk: the coder checks the chunk name once**; fallback with no shader work: give every board its own 4-vertex geometry clone and write the UVs at recycle time (+1 draw call per board).

The tunnel shell, glow pieces and water use plain `MeshBasicMaterial`; dress plain uses the city's own plain toon material. No other custom shader.

## 5 Order in the warm-up

`initCity` builds textures 1-13, the materials, every piece geometry and the instanced meshes; `warmup.js` already adds every chunk variant to the scene for one render: extend that list with one mesh per dress geometry, per portal piece and per facade material, and make the instanced meshes draw one instance for that frame. Then all 13 textures go through the `textures` argument. Nothing is left for the first frame of a district.
