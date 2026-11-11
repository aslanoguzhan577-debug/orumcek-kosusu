# 11.3 Living details: pooled, bounded, never in the way

Everything in this file is **computed, not seen** (no prototype: these are particles and small props whose look is fixed by the numbers below). One new system, `src/city-life.js`, with `update(dt)` and `reset()`; every pool is an `InstancedMesh` built in `initCity`, `count = 0` and `visible = false` while idle. Placement uses its own hash `hash(n) = fract(sin(n * 127.1) * 43758.5453)`, never the generator's RNG. Pure decisions (`flockAt`, `weatherAt`, `celebrationKind`) live in `src/city-logic.js` so node can test them.

| Pool | Instances | Geometry | Material | Draw calls while active |
|---|---|---|---|---|
| birds (wings up) + birds (wings down) | 12 + 12 | merged boxes, 5 per bird | plain toon, `instanceColor` | 2 |
| steam | 24 | icosahedron, detail 0 | `MeshBasicMaterial` | 1 |
| weather (rain / snow / ticker tape) | 160 | unit box | `MeshBasicMaterial({ transparent: true, depthWrite: false })`, `instanceColor` | 1 |
| sparks (fireworks) | 120 | unit box | `MeshBasicMaterial`, `instanceColor` | 1 |
| blimp + banner | 1 + 1 mesh | `11-3-modeller.md` §6 | toon / basic | 2 |

Worst case 7 extra draw calls, about 2.5k triangles.

## 1 Pigeons (Midtown, Chinatown, dawn Midtown)

**Model** (one bird, metres, origin at the feet, nose towards −z; build twice):

| Part | `pBox` (cx, cy, cz, sx, sy, sz) | Colour |
|---|---|---|
| body | 0, 0.14, 0, 0.16, 0.16, 0.34 | instance colour (pigeon `8a8f9c`, gull `f2f2f2`) |
| head | 0, 0.26, −0.2, 0.12, 0.12, 0.12 | same |
| beak | 0, 0.24, −0.28, 0.04, 0.04, 0.06 | `f2a53a` (vertex colour, not tinted by the instance: paint instance colour into the other parts' vertex colours as white) |
| wing, wings-up geometry | ∓0.17, 0.30, 0, 0.3, 0.03, 0.2, turned `rz = ∓0.9` | same |
| wing, wings-down geometry | ∓0.21, 0.11, 0, 0.3, 0.03, 0.2, turned `rz = ±0.5` | same |

Instance scale 1.6 in flight, 1.0 perched. Flap: bird `i` is drawn from the wings-up mesh when `floor(time * 9 + i * 0.37)` is even, else from the wings-down mesh (the other mesh gets scale 0 for that bird). Perched birds use wings-down and bob: `y += 0.03 * max(0, sin(time * 6 + i))`.

**Where.** One candidate per 400 m block `b = floor(d / 400)`: it exists if `hash(b * 7.3) < 0.7`; its place is `d0 = 400 b + 80 + 240 * hash(b * 3.1)`; rejected if `d0 < 300`, if the district at `d0` is not midtown / chinatown / dawn, or if a district border is within 100 m. `flockAt(d)` returns the next accepted `d0` at or after `d`.
When the flock's segment comes into range (d0 − distance < 150): reject it for good if any obstacle of the live pool lies within ±15 m of `d0` (read-only look at `obstacles`); otherwise perch 9 birds on the rails: lane = `floor(hash(b * 5.9) * 3)`, birds at `x = laneX(lane) ± 0.72` (the two rails) alternating, `z` spaced 0.45 m, `y = 0.06`, each turned by `hash(i) * 2π`.

**Burst.** When `d0 − distance < max(34, speed * 1.3)`: bird `i` (0-8) takes off with a fan angle `a = (-70 + 140 * i / 8)°` from straight up:

```
vx = sin(a) * 4.5        vy = 5.5 + cos(a) * 3        vz = -(speed + 5)   (ahead of the runner)
after 0.5 s:  vz eases to -(speed - 12) over 0.4 s    (the runner passes underneath)
```

By the time the runner reaches `d0` every bird is above 7 m. Life 2.2 s, scale to 0 over the last 0.3 s. One flock at a time. Emits `flock { position }` for a later sound; no sound in this stage.

## 2 Gulls (Köprü)

Same pool, white. One event per crossing, at bridge metre `250 + 200 * hash(loop * 2.7)` (between the towers). Five gulls take station beside the runner on side `s = hash(loop) < 0.5 ? -1 : 1`:

```
x = s * (7 + 1.3 i)     y = 5 + 0.8 i + 0.6 sin(0.8 time + i)     z = -12 - 6 i  (relative to the player, drifting back at 1 m/s)
```

Flap at 3 per second instead of 9. After 12 s they peel away: `x += s * 6 * dt`, `y += 2 * dt`, gone at |x| > 30. They never come inside |x| 6.

## 3 Steam (Midtown, Chinatown, Neon Meydan, dawn)

Chunk variants 1, 5 and 9 own a street vent at local `(s * 6.0, -11, 3)` on side `s = +1` (mirrored with the chunk). Up to three vents are live; a vent emits while its segment's z is between −120 and +10. Every 0.28 s one puff: start at the vent with jitter z ±0.3 m and x 0 … +0.3 m outward only, rise 4.2 m/s, drift 0.5 m/s away from the track, travel with the world, life 3.4 s (top at 3.3 m above the deck). Geometry `IcosahedronGeometry(1, 0)`; instance scale = radius in metres: `0.4 → 1.2` at 60 % of life (ease out `1 - (1 - u)²`, `u = age / (0.6 life)`), then `→ 0` linearly. Inner edge of a puff ≥ 6.0 − 1.2 = 4.8 m: never inside the empty box (computed; an earlier 5.6 m vent with 1.7 m puffs reached 3.9 m). Colour: `mix(0xf4f1e6, phase.fog, 0.35)`, unlit, so at night it is a pale cut-out against the dark street: comic steam, no transparency.

## 4 The blimp

Model and banner: `11-3-modeller.md` §6. Shown value = `clamp(round(state.multiplier), 1, 99)` (the number the HUD shows); UVs rewritten only when it changes (banner layout: `11-3-modeller.md` §6). Visible everywhere except the tunnel (`tunnelAt > 0.5` hides it; it is back before the exit because it sits 120 m ahead). On the Köprü it hangs in the open sky left of the sun: fine.

## 5 The record moment

Trigger: `recordPass` (`11-3-bugle.md` §5), once per run. `celebrationKind(phaseId, tunnelFactor)` returns `'fireworks'` at night, `'tape'` otherwise, `'wait'` inside the tunnel (the celebration starts when `tunnelAt` falls below 0.1; if the run ends first it is dropped).

**Fireworks (night).** 11 shells, one every 0.7 s. Three shells may be alive; each owns 40 sparks.

| Value | Number |
|---|---|
| shell centre | `x = -45 + 90 * hash(k)`, `y = 48 + 22 * hash(k + 0.5)`, `z = -140` (in front of the sky plane at −166.5, above every roof) |
| shell colour | `[ff2fa8, 22e6ff, ffe23a, 8cff3a, ffffff][k mod 5]`; every fifth spark white |
| spark direction | Fibonacci sphere, 40 points |
| spark position at age τ = t / 1.3 | `centre + dir * 16 * (1 - (1 - τ)³) - (0, 3 τ², 0)` |
| spark size | 0.7 m, `* (1 - smoothstep(0.6, 1, τ))` |

Paused while the Yeşil Cin event of 11.5 is on screen. With reduced motion: no sparks.

**Ticker tape (day, golden hour, sunset, dawn).** A New York parade for the runner: 6 s, 140 pieces from the weather pool: 0.18 x 0.5 x 0.02 m, colours `ffffff, ffd23a, d8262c, 2f80ed`, opacity 1, falling 2.6 m/s, `x += 0.6 sin(2.3 t + phase)`, spinning 4 rad/s about z. Spawn volume: `4.8 ≤ |x| ≤ 10`, y 2-16, z −60 … 0 around the player (two curtains along the facades: the lanes stay clear, rule R9). On the bridge the curtains hang in the open air beside the cables: fine.

## 6 Night weather (loop 2 onward, Neon Meydan metres 4200-4500 of the loop)

`weatherAt(loop, s)` returns `{ kind: 'rain' | 'snow' | null, k }`: kind from `loopFlavor(loop)` (`11-3-bolgeler.md` §6), `k` = envelope `smoothstep(4200, 4240, s) * (1 - smoothstep(4460, 4500, s))`. Live instances = `round(160 * k)`.

| | Rain | Snow |
|---|---|---|
| piece | 0.03 x 1.1 x 0.03 m, turned `rz = 0.2` | 0.09 m cube |
| colour, opacity | `bfe6ff`, 0.55 | `ffffff`, 0.9 |
| motion | fall 24 m/s, `vx = -4.9` | fall 2.2 m/s, `x += 0.5 sin(1.7 t + phase)` |
| volume around the player | x −10 … 10, y 0 … 16, z −45 … 5; a piece below y 0 respawns at the top with new hashed x, z | same |
| over the lanes | a respawn that lands in `\|x\| < 4.6` is kept only 40 % of the time | full density (flakes are small and slow) |
| ground | track material `emissive = 0x24407a`, `emissiveIntensity = 0.3 k` (a cool wet sheen on rails and sleepers; the track material is otherwise untouched); facade `glow * (1 + 0.1 k)` | track `emissive = 0x8090c0`, intensity `0.12 k` |

Rain and snow never change fog distance, light or any gameplay value. With reduced motion: no pieces, the sheen stays.

## 7 Asserts for `tools/test-skills.mjs`

1. `flockAt(0)` ≥ 300; no flock position lies in bridge, tunnel or neon, or within 100 m of a border, over 0 – 30000 m; consecutive flocks are at least 160 m apart.
2. `weatherAt(1, s).kind` is null for every `s`; `weatherAt(2, 4300).kind === 'rain'`; `weatherAt(3, 4300).kind === 'snow'`; `k` is 0 outside 4200-4500 and 1 at 4350.
3. `celebrationKind('night', 0) === 'fireworks'`, `('golden', 0) === 'tape'`, `('night', 1) === 'wait'`.
4. Pools: a 20-minute simulated run (dt 1/60, speed curve of `patterns.js`) never asks for more than 12 birds, 39 puffs, 160 weather pieces, 120 sparks, and every pool is empty after `reset()`.
5. Fireworks: 11 shells in 8 s, at most 3 alive at once.
