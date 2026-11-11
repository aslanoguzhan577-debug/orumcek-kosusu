# 11.3 Day cycle, the tunnel curtain, readability

Source: `proto/11-3-kit.js` (`PHASE`, `PHASE_KEYS`, `DISC_KEYS`, `TUNNEL`, `tunnelAt`, `cityAt`, `tick`). The DAY, GOLDEN, SUNSET (after two corrections) and tunnel-rhythm values were judged in the game camera; NIGHT, DAWN, the tunnel light floor, coin glow and own-colour obstacle body emission are **not seen**.

## 1 One system, one function per frame

`src/daycycle.js` (new) owns one `update(distance)` called from the city system's `update(dt)`. It computes `p = phaseAt(distance)`, `t = tunnelAt(distance)`, `c = cityAt(distance)` and writes them into objects that already exist. It creates nothing. Colours blend in linear RGB (`Color.lerp` after `setHex`), numbers blend linearly.

| Written every frame | Value |
|---|---|
| `scene.background`, `scene.fog.color` | `mix(p.fog, 0x0a0b16, t)` |
| `scene.fog.near / far` | `p.fogNear / p.fogFar` |
| hemisphere `color / groundColor / intensity` | `mix(p.hemiSky, 0xbfe8ff, t)` / `p.hemiGround` / `mix(p.hemiI, 1.15, t)` |
| sun `color / intensity / position` | `p.sun` / `mix(p.sunI, 1.0, t)` / `p.sunPos` |
| **scenery tint**: `color` of the three facade materials, the city plain material, the blimp material | `p.tint` |
| facade `emissiveIntensity`; hook uniforms `uHalftone, uDotTint, uBaseTone, uWinOn, uSunLum` | `p.glow`; `p.halftone, p.dotTint, p.baseTone, p.winOn`, `p.sunI * luminance(sun.color) / π` |
| glow material `color` (lanterns, lamps, neon tubes) | grey `mix(0.8, 1, p.lamp)` |
| board materials `color` (names, ads, Bugle) | grey `p.sign` |
| water `color`, `map.offset.y` | `p.water`, `(distance / 100) % 1` |
| coin material `emissiveIntensity` | `mix(p.coin, 3, t)` |
| obstacle body material `emissive` | `material.color × (0.18 × mix(p.nightBlend, 1, t))`; outline always ink |
| sky uniforms | §3 |

Track, pickups, characters, Venom: **never written** (except the wet-track sheen). Obstacle bodies keep their colour and receive only the own-colour emission above; outlines always stay ink.

## 2 Phase table

Blend keys in loop metres (`s = distance mod 6000`), linear between neighbours:

`0 DAY · 1300 DAY · 1700 GOLDEN · 2440 GOLDEN · 2700 SUNSET · 3340 SUNSET · 3520 NIGHT · 5000 NIGHT · 5300 DAWN · 5650 DAWN · 6000 DAY`

The light warms 200 m before the gate; the sunset arrives as the bridge opens; SUNSET to NIGHT happens entirely inside the tunnel (3340-3520); the sky starts to pale 200 m before the dawn sign.

| Field | DAY | GOLDEN | SUNSET | NIGHT | DAWN |
|---|---|---|---|---|---|
| skyTop | `3f9eee` | `4f86d8` | `35297a` | `080a26` | `6b8fd8` |
| skyMid | `8fd0ff` | `ffc27a` | `e2507e` | `191c56` | `f6b0c8` |
| horizon | `c9e9ff` | `ffe0a0` | `ffa040` | `3b2f80` | `ffe0b8` |
| fog (= background) | `9ad4ff` | `ffcf96` | `f07c5c` | `1b1a4a` | `f4c4cc` |
| fogNear / fogFar | 45 / 160 | 44 / 158 | 44 / 158 | 42 / 155 | 45 / 160 |
| skyline far / near layer | `a9c6e6` / `8fb0d8` | `e0a084` / `b9727e` | `8a3f78` / `552a60` | `1d1d48` / `121236` | `b89ab8` / `9a7aa8` |
| skyline window colour, amount | `ffffff`, 0.2 | `ffe2a0`, 0.2 | `ffd27a`, 0.5 | `ffd27a`, 0.9 | `ffe2a0`, 0.25 |
| hemi sky / ground | `dff1ff` / `6b5d50` | `ffeedb` / `7a5648` | `ffe0dc` / `6a4458` | `a8b6ff` / `5a3a78` | `ffe0f0` / `6a5670` |
| hemi intensity | 1.6 | 1.5 | 1.5 | 1.4 | 1.5 |
| sun colour | `fff1dc` | `ffd0a0` | `ffc4a4` | `cfd8ff` | `ffd0b0` |
| sun intensity | 2.2 | 2.5 | 2.1 | 1.75 | 2.0 |
| sun position | −6, 12, 6 | −10, 5, 7 | −9, 4, 2 | 6, 12, 7 | 6, 6, 7 |
| **tint** (scenery multiplier) | `ffffff` | `ffdcb8` | `8a4a6c` | `5a62a6` | `f0c4d4` |
| sign (board brightness) | 0.9 | 0.95 | 1 | 1 | 0.95 |
| lamp (glow pieces) | 0.25 | 0.7 | 1 | 1 | 0.6 |
| halftone / baseTone | 0.85 / 0 | 1 / 0.05 | 1 / 0.12 | 1 / 0.25 | 0.95 / 0.08 |
| dotTint | `4a5296` | `9a4f7a` | `6a2f7a` | `2a2a70` | `8a6aa8` |
| winOn (share of lit windows) / glow | 0 / 0 | 0.1 / 0.35 | 0.5 / 0.8 | 0.85 / 1.15 | 0.25 / 0.45 |
| stars / sky dots | 0 / 1 | 0 / 1 | 0.15 / 0.8 | 1 / 0 | 0.1 / 0.8 |
| water | `2f86cc` | `e0955c` | `d8556a` | `1a2a6a` | `c890b0` |
| coin emissive intensity | 1 | 1.2 | 1.5 | 2.2 | 1.2 |
| nightBlend (body emission blend; k = 0.18 × nightBlend) | 0 | 0 | 0.25 | 1 | 0.1 |

Tunnel overrides, blended by `t`: fog `0a0b16`, hemi sky `bfe8ff`, hemi 1.15, sun 1.0, coin 3, body emission k 0.18; outline always ink.

"Windows go dark one by one" at dawn costs nothing: the facade hook lights a window when `hash(window cell) < uWinOn`, so as `winOn` falls 0.85 to 0.25 over 5000-5300 m each window switches off at its own moment.

## 3 The sky

The existing skyline plane (700 x 175 m at z −166.5) keeps its geometry and gets one `ShaderMaterial` (`SKY_VERT` / `SKY_FRAG` of `proto/sehir-tex.js`, plus the three-line change in `11-3-kit.js`: uniforms `uCity`, `uShoreTex`). It paints: a three-stop gradient (`horizon` at v 0.2, `skyMid` at 0.45, `skyTop` at 1), comic halftone dots in the low sky, the sun or moon disc with an ink ring and two halo rings, four-point stars, then the two skyline layers and their lit windows from the RGB mask.

| Uniform | Value |
|---|---|
| `uTop, uMid, uHorizon, uFar, uNear, uWin, uWinOn, uStars, uDots` | from the phase |
| `uSun` (u, v, radius), `uSunCol` | disc keys below |
| `uDark` | `t` (inside the tunnel the far end is black) |
| `uCity` | `cityAt(distance)`: 1 in the city; falls to 0 over 2460-2600 m; back to 1 over 3400-3420 m (unseen, in the tunnel) |

**The bridge sky.** With the street walls gone the skyline layers are 75 m tall at 166 m: seen, they read as a wall. So on the approach they fade into the haze (`uCity` 1 to 0) and a low far shore fades in from `uShoreTex` (1024 x 64 mask, drawn between v 0.195 and 0.305: at most 12 m tall at that distance, with a few lit windows). The horizon is at v 0.2 (camera height 3.4 m on a plane whose foot is at −32 m).

**The disc is always straight ahead** (u 0.5), so the track points at it.

| Loop metre | v (centre) | radius (v units) | colour | Reads as |
|---|---|---|---|---|
| 0 – 1300 | 0.95 | 0 | – | noon: sun overhead, out of frame |
| 1700 | 0.42 | 0.075 | `fffbe0` | sun comes down into the street's end, behind the spire |
| 2440 | 0.30 | 0.085 | `fff6c8` | |
| 2700 | 0.27 | 0.11 | `fff0a0` | big sun over the far shore, inside the first tower's arch |
| 3340 | 0.20 | 0.125 | `ffc070` | half sunk: the fogged water plane covers the lower half (the plane writes no depth, the water is drawn over it) |
| 3341 – 5000 | 0.60 | 0.06 | `f4f0d8` | moon, upper left of centre (u 0.38) |
| 5300 | 0.50 | 0 | | moon gone |
| 5301 – 5650 | 0.12 to 0.26 | 0.07 | `ffb08a` to `fff0c8` | new sun lifts off the horizon |
| 6000 | 0.95 | 0 | | noon |

## 4 The tunnel is the curtain

`tunnelAt(d) = smoothstep(3330, 3360, s) * (1 - smoothstep(3670, 3700, s))`: the dark closes over 30 m as the mouth passes and opens over the last 30 m. While `t = 1` the sky plane is black, the fog is `0a0b16`, and the phase table runs from SUNSET to NIGHT unseen. The player enters under an orange sky and comes out under stars 13 s later.

Inside, light comes from the shell itself (unlit material, vertex colours `0b0e22` to `3d6c98` in a 5 m rhythm), lamps `c8f8ff` every 5 m, a cyan line at 3.3 m and a magenta line at 0.9 m on both walls, dark ribs every 10 m. The station (3500-3560 m) is the one bright flash: cream tile wall, warm lights, blue columns, black silhouettes.

## 5 Readability is sacred: the rules, with numbers

| # | Rule | Number |
|---|---|---|
| R1 | Night lives on scenery only. | `tint` multiplies facade, city plain, dress plain, blimp. No gameplay material is in that list. |
| R2 | The two lights never fall below a floor, so track, obstacles and characters keep their value. | outside: hemi ≥ 1.4, sun ≥ 1.75 (today 1.6 / 2.2). Tunnel: 1.15 / 1.0, and there the shell is dark, so contrast rises. |
| R3 | Light colours stay pale so toys keep their hue (a white train must stay white). | hemisphere sky colour and sun colour: min channel ≥ 0.62 × max channel at every metre (GOLDEN sun `ffd0a0` = 0.627 is the most saturated in the table, seen and approved); ground colours are exempt. Assert: `11-3-gorevler.md` task 1 #4 |
| R4 | Fog never eats the reaction margin. | fogNear ≥ 42 m, fogFar ≥ 155 m. At the top speed 39 m/s, 42 m is 1.08 s: more than the generator's 0.5 s reaction time plus the 0.14 s lane switch. |
| R5 | Fog colour is the sky's low band, so far obstacles fade into the horizon, never into a wall colour. | `fog` per phase above |
| R6 | Coins and pickups glow where it is dark. | coin emissive ×2.2 at night, ×3 in the tunnel; pickup art already carries its own emissive parts |
| R7 | Obstacles stay readable at night. | outline always ink; body emissive = own colour × k, k 0 by day, 0.18 in the tunnel and at full night, linear by the day/tunnel blend |
| R8 | The hero light: characters never go dark. | they are lit by the floor of R2 and keep their own toon rim; nothing else is needed (the stage-light principle, seen working at sunset) |
| R9 | Nothing scenic near the lanes. | empty box `\|x\| < 4.6 m`, `y < 9.5 m`; lowest lantern tip 9.9 m, gate beam underside 10.6 m, tunnel roof over the outer lane 9.8 m |
| R10 | Red and yellow belong to danger. | lanterns are red but small (0.6 m), in strings, above 9.9 m; no scenery uses red/white or yellow/black stripes except the tunnel mouth band, which is a real "duck your head" landmark and sits on a wall |
| R11 | Boards are read in a glance or not at all. | headline cap height ≥ 0.9 m on an 8 x 4 m board; boards stand at `\|x\| ≥ 5.4 m`, never above the centre lane except the arch at 12.2 m and up |
| R12 | Reduced motion. | with `prefers-reduced-motion`: no rain streaks, no fireworks sparks (boards still change), pigeons do not burst |

Acceptance for the checker: at 20 m/s and at 39 m/s, in every district, a tester names the lane of the next obstacle within 0.5 s from a still frame. If night fails, raise the floor of R2 before touching anything else.
