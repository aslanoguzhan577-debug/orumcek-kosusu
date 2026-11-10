# 11.5 Yol sürprizleri — build recipes for every visual

For the coder who types the models out. No design judgement is needed: every part is a primitive
with size, place, rotation, parent and colour. Where this file and the short art tables in
`11-5-yol-surprizleri.md` (A.1–A.3) or `11-5-olaylar.md` (B.4, C.2) differ, **this file wins**.
Not prototyped: the numbers marked *(tune)* in each "look at" list may be adjusted by the visual
checker, nothing else.

## M0 Conventions

| Thing | Rule |
|---|---|
| Axes | +X right, +Y up, forward is -Z; the player is at z = 0 and looks toward -Z. Characters are built facing -Z (his right hand is at +X). |
| Units | metres, radians |
| Obstacle art | `src/obstacle-art.js`: `ShapeBuilder.box(w, h, d, x, y, z, color, opts)` = a box of that size **centred** at (x, y, z); `opts.rx / rz` rotate it about its own centre before the move; `opts.hull: false` = no outline shell for this box; `opts.visible: false` = outline shell only. Add `opts.ry` (one line, `g.rotateY(opts.ry)` between rx and rz). All boxes of a kind merge into one geometry (`build()`), drawn by one `InstancedKind(scene, shape, material, outlineMaterial, capacity)` with the shared vertex-colour toon `material` and the shared `outlineMaterial` (obstacle-art.js:347-348). A kind whose boxes are all `hull: false` gets no outline mesh. |
| Origin of obstacle art | middle of the NEAR face (the face toward the player) on the deck, y = 0; the body extends to -Z. z > 0 = on the deck before the obstacle. |
| Colours | hex, as vertex colours. Shared names: INK `0x15171c`, STEEL `0x3a3d45`, YEL `0xffc93c`, BLK `0x22242a`, RED `0xe63946`, WHT `0xf4f4f4`, RAIL `0xc8ced8`. |
| Event art | `src/event-art.js` (new): plain meshes / InstancedMeshes built once by `create…()` functions, added to the scene hidden (`visible = false`), `frustumCulled = false`. Materials: `toonMaterial(color, opts)` (toon.js:58; `shade: 'soft'` = the vinyl ramp), outlines by `addOutline(mesh, thickness, color)` (toon.js:144; works on an InstancedMesh). |
| Nothing at run time | no `new` geometry, material, texture or canvas after load; per-frame code only writes matrices, positions, `opacity`, `map.offset`, `TubeShape.set`. Reuse module-level `Vector3` / `Matrix4` temps. |

New obstacle-art API (called by `obstacles._draw`):

```js
// one wide obstacle; z = world z of its near face, tau = seconds until it reaches the player
addRow(type, z, len, open, tau) {
  if (type === 'gap') {
    kinds.gapHole.add(m.makeScale(1, 1, len).setPosition(0, 0, z));
    kinds.gapEnds.add(m.makeTranslation(0, 0, z));
  } else if (type === 'gate') {
    kinds.gateFrame.add(m.makeTranslation(0, 0, z));
    const u = Math.min(1, Math.max(0, (tau - G.dropTo) / (G.dropFrom - G.dropTo)));   // G = CONFIG.obstacles.gate
    kinds.gateShutter.add(m.makeTranslation(0, G.raised * u * u * (3 - 2 * u), z));
  } else { // girder
    const th = girderOffset(tau, open) / (R.pivotY - 1.2);                               // R = CONFIG.obstacles.girder
    kinds.girderBeam.add(m.makeRotationZ(th).setPosition(R.pivotY * Math.sin(th), R.pivotY * (1 - Math.cos(th)), z));
    kinds.girderJib.add(m.makeTranslation(0, 0, z));
    for (let lane = 0; lane < 3; lane++) (lane === open ? kinds.girderGo : kinds.girderPad).add(m.makeTranslation(laneX(lane), 0, z));
  }
},
addPatch(z, len) {
  kinds.gapHole.add(m.makeScale(1, 1, len).setPosition(0, 0, z));
  kinds.gapEnds.add(m.makeTranslation(0, 0, z));
  kinds.gapPatch.add(m.makeScale(1, 1, len).setPosition(0, 0, z));
},
```

Capacities: `gapHole 3, gapEnds 3, gapPatch 3, gateFrame 3, gateShutter 3, girderBeam 3, girderJib 3, girderPad 6, girderGo 3`.

## M1 Ray Yarığı (`gapHole`, `gapEnds`, `gapPatch`)

```
TOP VIEW (len = 4)                      x: -3.7 ........ 0 ........ +3.7
 z = -4   ==========FAR LIP (bright)=================   <- f = 1
          |  lit wall  | ribs | | | | | | | |       |   f 0.94-0.985
          |  mid wall                                |   f 0.80-0.94
          |  low wall                                |   f 0.55-0.80
          |  ABYSS (near black)                      |   f 0.02-0.55
 z =  0   ----------near ink edge--------------------   <- f = 0
     [pole]  curl curl   curl curl   curl curl  [pole]   bent rails, lip plates
 z = +2        ^           ^           ^                  yellow chevrons (point to -Z)
 z = +4        ^           ^           ^
SIDE VIEW (x = 3.45)        sign 0.9 x 0.9 (diamond) centre y 2.9
   pole 0.16 x 3.4, bands of 0.567   |  rail curl tip y 0.75   |  hole surface y 0.075
```

**`gapHole`**: built 1 m long (z from 0 to -1), every box `hull: false`. A helper `strip(f0, f1, color, w = 7.4, y = 0.075, h = 0.02, x = 0)` = `box(w, h, f1 - f0, x, y, -(f0 + f1) / 2, color, { hull: false })`.

| # | Call |
|---|---|
| 1 | `strip(0, 0.02, INK)` |
| 2 | `strip(0.02, 0.55, 0x0d0b12)` |
| 3 | `strip(0.55, 0.80, 0x2b2733)` |
| 4 | `strip(0.80, 0.94, 0x55505a)` |
| 5 | `strip(0.94, 0.985, 0x8d8880)` |
| 6 | `strip(0.985, 1, 0xe8e2d4, 7.4, 0.09, 0.03)` |
| 7–14 | for i = 0..7: `strip(0.55, 0.985, 0x1a1820, 0.12, 0.078, 0.02, -3.2 + i * 0.914)` |

**`gapEnds`** (not scaled). Hull only where stated.

| # | Part | Call(s) |
|---|---|---|
| 1 | pole shells | for sx of [-1, 1]: `box(0.16, 3.4, 0.16, sx * 3.45, 1.7, 0.3, WHT, { visible: false })` |
| 2 | pole bands | for sx, for i = 0..5: `box(0.16, 0.567, 0.16, sx * 3.45, 0.283 + i * 0.567, 0.3, i % 2 ? WHT : RED, { hull: false })` |
| 3 | sign back | for sx: `box(1.0, 1.0, 0.04, sx * 3.45, 2.9, 0.4, BLK, { rz: Math.PI / 4 })` |
| 4 | sign face | for sx: `box(0.9, 0.9, 0.06, sx * 3.45, 2.9, 0.41, YEL, { rz: Math.PI / 4, hull: false })` |
| 5 | arrow shaft | for sx: `box(0.12, 0.42, 0.07, sx * 3.45, 2.84, 0.42, BLK, { hull: false })` |
| 6 | arrow head | for sx, for a of [-1, 1]: `box(0.12, 0.3, 0.07, sx * 3.45 + a * 0.09, 3.04, 0.42, BLK, { rz: a * 0.7, hull: false })` |
| 7 | lip plate | for lane x of [-2.2, 0, 2.2]: `box(2.0, 0.1, 0.25, x, 0.06, 0.12, 0x8d8880, { hull: false })` |
| 8 | bent rails | for lane x, for r of [-0.72, 0.72]: `box(0.1, 0.1, 0.5, x + r, 0.12, 0.2, RAIL, { rx: -0.4, hull: false })`, `box(0.1, 0.1, 0.5, x + r, 0.36, 0.02, RAIL, { rx: -0.9, hull: false })`, `box(0.1, 0.1, 0.5, x + r, 0.68, -0.05, 0xff7a1a, { rx: -1.4, hull: false })` |
| 9 | chevrons | for lane x, for z of [2.0, 4.0], for a of [-1, 1]: `box(0.9, 0.022, 0.22, x + a * 0.36, 0.075, z, YEL, { ry: a * 0.6, hull: false })` (the two bars meet at the lane centre on the -Z side; if the V opens the wrong way, flip the sign of `ry`) |

**`gapPatch`**: built 1 m long, all `hull: false`: `strip(0, 1, 0x9aa1ad, 7.0, 0.09, 0.08)`; `strip(0, 0.08, YEL, 7.0, 0.092, 0.085)`; `strip(0.92, 1, YEL, 7.0, 0.092, 0.085)`; for i = 0..5: `strip(0.16 + i * 0.13, 0.18 + i * 0.13, 0x5b616c, 6.6, 0.092, 0.085)`; ink sides: for sx: `box(0.06, 0.09, 1, sx * 3.5, 0.09, -0.5, INK, { hull: false })`.

Look at: from 60 m, 30 m and 10 m at 20 and 39 m/s the slab reads as a hole (dark near, lit far wall), not as a carpet; poles visible from the fog edge; chevrons point forward. *(tune)*: the five strip colours, f breakpoints.

## M2 Sinyal Kapısı (`gateFrame`, `gateShutter`)

```
FRONT VIEW (seen from the player)             y
  [#] [#] [#]   signal heads 0.7 x 0.9, lamp red on top      4.8 top of heads
 ================================ truss 7.9 x 0.5            3.9 / 3.4
 |  | | | | | | | | | | | | | |  |  15 bars, 0.48 apart      3.3 bar top (shutter down)
 |  | | | V | | | V | | | V | |  |  yellow "duck" V          1.65
 |  [=o=======o========o======]  |  boom 7.2 x 0.26, lamps   1.21 / 0.95  <- slide under
 |                               |
post x = -3.78                 post x = +3.78   lanes at -2.2, 0, 2.2
SIDE VIEW: everything within z = 0 .. -0.35 (posts 0.3 deep, bars 0.07)
Shutter raised (tau >= 2.4 s): whole shutter +1.9 m (boom at 2.85 .. 3.11, bars up to 5.2)
```

**`gateFrame`** (z centre -0.175 unless noted):

| # | Part | Call(s) |
|---|---|---|
| 1 | posts | for sx: `box(0.3, 3.9, 0.3, sx * 3.78, 1.95, -0.175, STEEL)` |
| 2 | base plates | for sx: `box(0.6, 0.12, 0.6, sx * 3.78, 0.06, -0.175, STEEL, { hull: false })` |
| 3 | truss | `box(7.9, 0.5, 0.4, 0, 3.65, -0.175, STEEL)` |
| 4 | truss strip | `box(7.9, 0.1, 0.42, 0, 3.42, -0.175, YEL, { hull: false })` |
| 5 | head housings | for lane x: `box(0.7, 0.9, 0.25, x, 4.35, -0.05, INK)` |
| 6 | red lamps | for lane x: `box(0.34, 0.34, 0.06, x, 4.55, 0.1, 0xff2d2d, { hull: false })` |
| 7 | green lamps (dark) | for lane x: `box(0.34, 0.34, 0.06, x, 4.15, 0.1, 0x1d5c33, { hull: false })` |
| 8 | lamp glints | for lane x: `box(0.1, 0.1, 0.07, x + 0.08, 4.63, 0.1, 0xffffff, { hull: false })` |

**`gateShutter`** (drawn at y offset `raise`):

| # | Part | Call(s) |
|---|---|---|
| 1 | boom shell | `box(7.2, 0.26, 0.2, 0, 1.08, -0.175, WHT, { visible: false })` |
| 2 | boom stripes | for i = 0..11: `box(0.6, 0.26, 0.2, -3.3 + i * 0.6, 1.08, -0.175, i % 2 ? WHT : RED, { hull: false })` |
| 3 | bars | for i = 0..14: `box(0.07, 2.1, 0.07, -3.36 + i * 0.48, 2.25, -0.175, 0x55595f, { hull: false })` |
| 4 | ties | for y of [1.9, 2.6]: `box(7.2, 0.06, 0.06, 0, y, -0.175, 0x55595f, { hull: false })` |
| 5 | boom lamps | for lane x: `box(0.3, 0.3, 0.08, x, 1.08, -0.03, 0xff2d2d, { hull: false })`, `box(0.1, 0.1, 0.09, x + 0.07, 1.15, -0.03, 0xffffff, { hull: false })` |
| 6 | duck V | for lane x, for a of [-1, 1]: `box(0.5, 0.12, 0.05, x + a * 0.2, 1.65, -0.13, YEL, { rz: a * 0.6, hull: false })` (V points down; flip the sign of `rz` if it points up) |

Look at: the shutter is fully down at 1.6 s at every speed; the track behind stays readable through the bars; a slide passes under the boom with visible air; red lamps read from 80 m. *(tune)*: bar colour, lamp sizes.

## M3 Vinç Kirişi (`girderBeam`, `girderJib`, `girderPad`, `girderGo`)

```
FRONT VIEW, parked, open lane = right (lane 2)           y
 =========red/white jib 26 x 0.9 (y 16.5)==========      16.5   (trolley at x 0, y 16.1)
                    | main cable 0.07                     3.72 .. 16
                  [hook block 0.5 x 0.45]                 3.5
                  /        \   slings to x = +-1.4        2.1 .. 3.3
 o|=============================|o   beacons              2.2
  |\  /|\  /|\  /|\  /|  top chord                        2.03
  | \/ | \/ | \/ | \/ |  4 bays 1.065 wide, zig-zag
  | /\ | /\ | /\ | /\ |  bottom chord                     0.37   (0.3 = collision bottom)
 x: -3.3 ........ -1.1 ......... +1.1     | open lane x = +2.2: green chevrons on the deck
 covered: lanes 0 and 1 (zebra pads on the deck, z 0 .. +7)
SIDE VIEW: truss 0.5 deep (z 0 .. -0.5), two faces at z = -0.07 and -0.43
```

**`girderBeam`** (model centred on x = 0; `Z1 = -0.07`, `Z2 = -0.43`; hull only on the shells in rows 1 and 5):

| # | Part | Call(s) |
|---|---|---|
| 1 | chords | for y of [0.37, 2.03], for z of [Z1, Z2]: `box(4.4, 0.14, 0.14, 0, y, z, 0xf5b417)` |
| 2 | verticals | for x of [-2.13, -1.065, 0, 1.065, 2.13], for z of [Z1, Z2]: `box(0.1, 1.52, 0.1, x, 1.2, z, 0xf5b417, { hull: false })` |
| 3 | diagonals | for b = 0..3, for z of [Z1, Z2]: `box(0.08, 1.86, 0.08, -1.5975 + b * 1.065, 1.2, z, 0xd9960a, { rz: (b % 2 ? 1 : -1) * 0.611, hull: false })` |
| 4 | cross ties (top) | for x of [-2.13, 0, 2.13]: `box(0.08, 0.08, 0.36, x, 2.03, -0.25, 0xd9960a, { hull: false })` |
| 5 | end plate shells | for sx: `box(0.12, 1.8, 0.5, sx * 2.2, 1.2, -0.25, YEL, { visible: false })` |
| 6 | end plate bands | for sx, for i = 0..4: `box(0.12, 0.36, 0.5, sx * 2.2, 0.48 + i * 0.36, -0.25, i % 2 ? BLK : YEL, { hull: false })` |
| 7 | beacons | for sx: `box(0.2, 0.16, 0.2, sx * 2.2, 2.2, -0.25, 0xffa51f, { hull: false })` |
| 8 | slings | for a of [-1, 1]: `box(0.05, 1.85, 0.05, a * 0.7, 2.7, -0.25, 0x2a2d34, { rz: a * 0.862, hull: false })` (each runs from (a * 1.4, 2.1) up to (0, 3.3); flip the sign of `rz` if they splay outward) |
| 9 | hook | `box(0.14, 0.3, 0.14, 0, 3.2, -0.25, RED, { hull: false })` |
| 10 | hook block | `box(0.5, 0.45, 0.4, 0, 3.5, -0.25, 0xf5b417)` |
| 11 | main cable | `box(0.07, 12.3, 0.07, 0, 9.86, -0.25, 0x2a2d34, { hull: false })` |

**`girderJib`** (all `hull: false`): for i = 0..4: `box(5.2, 0.9, 0.9, -10.4 + i * 5.2, 16.5, -0.25, i % 2 ? WHT : RED)`; trolley `box(1.0, 0.5, 0.8, 0, 16.1, -0.25, STEEL)`.

**`girderPad`** (all `hull: false`; instance at the lane's x): `box(2.15, 0.02, 7.0, 0, 0.07, 3.5, BLK)`; for i = 0..6: `box(2.15, 0.022, 0.5, 0, 0.072, 0.5 + i, YEL)`; for sx: `box(0.1, 0.03, 7.0, sx * 1.03, 0.075, 3.5, RED)`.

**`girderGo`** (all `hull: false`): for z of [1.5, 3.5, 5.5], for a of [-1, 1]: `box(0.9, 0.022, 0.26, a * 0.36, 0.075, z, 0x35e06a, { ry: a * 0.6 })` (points to -Z, like the gap chevrons).

Motion: the beam's instance matrix in `addRow` above. Parked it leans 4° (`theta = ∓0.074`): correct, it hangs from the jib's centre.

Look at: with `open` = 0 and = 2: the parked beam covers exactly the two zebra lanes and its end stays clear of a player in the green lane; from far it visibly sweeps; it is parked 1.2 s before arrival at 19, 26 and 39 m/s; nothing of it is in the open lane during the last 1.2 s. *(tune)*: yellow tones, pad stripe count.

## M4 Lane warnings (`createLaneWarnings()` in `event-art.js`)

Returns `{ root, show(lane, p, time), flash(lane), hide(lane), update(dt) }`. 6 meshes, 3 base materials + 3 fill materials, 1 shared texture.

| Step | Exact |
|---|---|
| texture | `canvasTexture(128, 512, draw)` (toon.js:176), `wrapS = wrapT = RepeatWrapping`, `repeat.set(1, 4)`, sRGB. `draw`: fill `#ff1f3d`; then `g.fillStyle = '#b3122b'`, for k = -4..20: a parallelogram (0, k*48) (128, k*48 - 128) (128, k*48 - 104) (0, k*48 + 24); edge lines: `fillRect(0, 0, 6, 512)` and `fillRect(122, 0, 6, 512)` in `#4a0a10`; chevrons: `strokeStyle = 'rgba(255,255,255,0.6)'`, `lineWidth = 10`, for y0 of [64, 192, 320, 448]: polyline (34, y0 - 16) (64, y0 + 16) (94, y0 - 16) |
| base geometry | `new THREE.PlaneGeometry(2.0, 30, 1, 10).rotateX(-Math.PI / 2)` (shared by the 3 base meshes) |
| base mesh, lane L | position `(laneX(L), 0.085, -12)`; `new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })`; `renderOrder = 4` |
| fill geometry | `new THREE.PlaneGeometry(2.0, 27, 1, 9).rotateX(-Math.PI / 2).translate(0, 0, 13.5)` (its far edge is at local z = 0, it grows toward +Z) |
| fill mesh, lane L | position `(laneX(L), 0.09, -27)`; `MeshBasicMaterial({ color: 0xff1f3d, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })`; `renderOrder = 5` |
| `show(L, p, time)` | both visible; base `color.set(0xffffff)`, `opacity = 0.45 + 0.2 * Math.sin(time * (8 + 18 * p))`; fill `scale.z = Math.max(0.001, p)`, `opacity = 0.5 + 0.35 * p` |
| `flash(L)` | fill hidden; base `opacity = 0.9` (map kept: the stripes just go bright); start a 0.06 s timer; when it runs out `hide(L)` |
| `hide(L)` | both invisible |
| `update(dt)` | `map.offset.y += dt * 1.5`; run the flash timers |

If the chevrons flow away from the player, negate the offset speed.

## M5 Tendrils (`createTendrils(4)` in `event-art.js`)

Returns an array of `{ mesh, pose(kind, …) }`; the director drives them (B.4 of the events file has the state machine and the three poses' control points).

| Step | Exact |
|---|---|
| shape | `const tube = new TubeShape(16, 8)` (toon.js:477); `mesh = new THREE.Mesh(tube.geometry, mat)`; `frustumCulled = false`; `addOutline(mesh, 0.03, 0x050509)` |
| material (one, shared by the four) | `toonMaterial(0x14141b, { shade: 'soft', gloss: { color: 0xffffff, threshold: 0.972, strength: 0.95, soft: 0.01 }, sheen: { color: 0xffffff, threshold: 0.75, strength: 0.06, soft: 0.2 }, rim: { color: 0xc4d0ff, threshold: 0.8, strength: 0.32, soft: 0.04 } })` (venom.js:38 `GLOSS`) |
| per tendril, built once | `ctrlA`, `ctrlB` = two arrays of 5 `Vector3` (the pose being left and the pose being entered), `ctrl` = 5 `Vector3` (their blend), `curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal')`, `pts` = 16 `Vector3`, `radii` = `Float32Array(16)` |
| each frame while visible | fill `ctrlA` / `ctrlB` from the pose formulas, `ctrl[i].lerpVectors(ctrlA[i], ctrlB[i], u)` (`u` = the blend's eased progress), `curve.getPoint(i / 15, pts[i])` for i = 0..15, `radii[i] = (0.26 + (0.09 - 0.26) * Math.pow(i / 15, 0.8)) * thick * grow`, `tube.set(pts, radii, 0.9)` |
| `thick` | 1, and 1.2 in the slam pose (blend with `u`) |
| `grow` | 0 -> 1 over 0.25 s when the tendril first appears (intro), 1 -> 0 over 0.3 s when the event ends; `mesh.visible = grow > 0.01` |

```
SIDE VIEW (z to the left = ahead)                     y
            C3 (-2.5, 5.0)  ___  C2 (1.0, 5.2)        5
   tip C4 (-4.2, 3.9) _/         \__ C1               4      REAR pose: hooked over his head
                                      \
   player (z 0, head 1.6)              R (Venom's back, z = gap, y + 1.5)
   SLAM pose: R -> C1 -> C2 (1.2, 1.6) -> C3 (-1.5, 0.22) -> tip (-9.0, 0.2): 9 m lying on the lane
   radius 0.26 at the root -> 0.09 at the tip
```

Look at: in portrait the reared tendril is inside the frame above the player's head and clearly over ONE lane; the slam lands along the red lane and nowhere else; four tendrils never tangle through the player model. *(tune)*: C2 / C3 heights, radii.

## M6 Pumpkin bombs, target rings, light columns (`event-art.js`)

`createBombs(8)` -> `{ mesh, geometry, material, set(i, x, y, z, spin, scale), count(n) }`:

| Step | Exact |
|---|---|
| body | `new THREE.SphereGeometry(0.28, 16, 10).scale(1, 0.85, 1)` |
| stem | `new THREE.ConeGeometry(0.05, 0.14, 8).rotateZ(0.3).translate(0.02, 0.29, 0)`; its UVs are overwritten to the single texel (0.98, 0.02) (the green corner of the map) so both parts share the map |
| merge | toon.js `mergeGeos([body, stem])` (both are indexed with position, normal, uv) |
| map | `canvasTexture(256, 128, draw)`, sRGB. `draw`: for i = 0..15 `fillRect(i * 16, 0, 16, 128)` alternating `#ff7a1a` / `#e2600f`; 2 px lines `#b24a08` at every `i * 16`; face centred on x = 64 (u = 0.25 faces +Z, toward the player): eyes = triangles (38,60)(56,60)(47,42) and (72,60)(90,60)(81,42), mouth = polygon (34,78)(44,72)(54,80)(64,72)(74,80)(84,72)(94,78)(84,94)(74,88)(64,96)(54,88)(44,94); all three filled `#ffe94a`, stroked `#15171c` 3 px; last: `fillStyle = '#3da12e'`, `fillRect(244, 120, 12, 8)` (the stem's texel) |
| material | `toonMaterial(0xffffff, { map, shade: 'soft', emissive: 0x331400 })` |
| mesh | `new THREE.InstancedMesh(geometry, material, 8)`, `count = 0`, `instanceMatrix.setUsage(DynamicDrawUsage)`, `frustumCulled = false`; `addOutline(mesh, 0.03, 0x15171c)` |
| `set(i, x, y, z, spin, scale)` | matrix = `compose(position, quaternion from Euler(spin, 0, spin * 0.7), scale)`; on the deck `spin = 0` so the face looks at the player |

`createBombMarkers(8)`: geometry `new THREE.PlaneGeometry(2.0, 2.0).rotateX(-Math.PI / 2)`; map `canvasTexture(256, 256, draw)`: clear; circle r 92 at (128, 128) filled `rgba(255,122,26,0.35)`; ring r 104, `lineWidth = 22`, stroke `#ff7a1a`; same ring again with `setLineDash([28, 22])`, stroke `#15171c`; the bomb's eyes and mouth scaled 1.6 about (128, 128) (source centre (64, 68)), filled `rgba(21,23,28,0.8)`. Material `MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })`; `InstancedMesh(…, 8)`, `renderOrder = 4`. Instance: position `(laneX, 0.085, z)`, `rotation.y = time * 2`, scale `1 + 0.06 * Math.sin(time * 8)`.

`createBombColumns(8)`: geometry `new THREE.CylinderGeometry(0.18, 0.18, 7, 10, 1, true).translate(0, 3.5, 0)`; material `MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })`; `InstancedMesh(…, 8)`. Instance: position `(laneX, 0, z)`, scale x and z `1 + 0.25 * Math.sin(time * 10)`.

```
bomb: 0.56 wide x 0.48 tall, stem to 0.36      marker: 2.0 x 2.0 ring on the lane (lane = 2.2)
column: 0.36 wide x 7 tall, additive orange    bomb sits at y 0.3 in the ring's centre
```

Look at: a ring + column is readable at 60 m in portrait at 39 m/s; two lanes of rings side by side leave the third lane visibly clean; the carved face looks at the player on the deck. *(tune)*: column opacity and height, ring fill alpha.

## M7 Yeşil Cin and his glider (`src/models/goblin.js`)

`createGoblin(bombs)` -> `{ root, hand, setState(name), update(dt), textures }`; `bombs` = the object from `createBombs` (its geometry and material are reused for the pumpkin in his hand). Built once in `main.js`; `root.visible = false`.

```
FRONT VIEW (he faces the viewer)               y (deck = 0)      SIDE VIEW (he faces left)
        /\              /\      ears to 1.72                         ___  hood tail 0.7 long ~~~>
   ____/  \____________/  \____                1.85 hood top       /     \
  |  hood (purple)             |               1.82                |  head  |  0.88 deep
  | \\  ==      ==  //  eyes   |  head 0.92 w  1.38 head centre    |  0.88  |
  |      (teeth grin)          |       0.88 h                       \_____/ leans 20 deg forward
   \__________________________/                0.94 chin              |  torso 0.42 wide,
        _|  tunic  |_  arm up with pumpkin     0.90                  /|  0.6 tall
       /_|__belt___|_\  satchel on his left    0.44 hips            / |
          | |   | |    legs 0.44               0.00 deck           _/ |_  surf stance: one foot
 ====================================== glider: span 3.0, body 0.52 x 0.18 x 1.6   0.18 fwd, one 0.2 back
 wings: root chord 0.9 -> tip 0.25, 3 bat scallops behind; 2 thrusters + flames at the tail (z +0.86 .. +1.5)
```

### M7.1 Helpers (top of the file)

| Helper | Definition |
|---|---|
| `paint(geo, hex)` | adds a `color` attribute with `hex` on every vertex (copy of `colorize`, obstacle-art.js:24); returns `geo` |
| `blob(n, sx, sy, sz, seg = 14)` | copy of `blobGeo` (venom.js:287): `SphereGeometry(1, seg, round(seg * 0.7))`, every vertex through `roundCube(v, n)` (toon.js:414), then scaled by (sx, sy, sz), then `smoothNormals` |
| `put(geo, x, y, z, rx = 0, ry = 0, rz = 0)` | `geo.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z)`; returns `geo` |
| `fuse(list)` | `mergeGeometries(list.map((g) => g.toNonIndexed()))` from `three/addons/utils/BufferGeometryUtils.js` (toon.js `mergeGeos` would drop the colours). Every part must be painted first. |
| `cap(r, len)` | `new THREE.CapsuleGeometry(r, len, 4, 10)` (axis Y, total length `len + 2r`) |
| `cone(r, h)` | `new THREE.ConeGeometry(r, h, 8)` (tip at +Y) |

Colours: SKIN `0x4fbf3a`, MAIL `0x3da12e`, HOOD `0x6a2fa0`, DARK `0x3b1a63`, BAG `0xff7a1a`, FLAP `0x8a4b1f`, METAL `0x9aa1ad`.
Materials (3, built once): `VINYL = toonMaterial(0xffffff, { vertexColors: true, shade: 'soft', gloss: { color: 0xffffff, threshold: 0.93, strength: 0.5, soft: 0.02 } })`; `FACE = toonMaterial(0xffffff, { map: faceTex, shade: 'soft' })`; `FLAME = new THREE.MeshBasicMaterial({ vertexColors: true })`.
Outline: `addOutline(mesh, 0.025, 0x15171c)` on every VINYL mesh (0.02 on the tail); none on the face and flames.

### M7.2 Hierarchy (10 meshes; parent, pivot in the parent, parts in merge order)

| # | Node | Parent | Pivot (x, y, z) | Geometry = `fuse([...])` of these painted parts |
|---|---|---|---|---|
| 0 | `rig` (Group) | `root` | (0, 0, 0) | — |
| 1 | `glider` (Mesh, VINYL) | `rig` | (0, 0, 0) | body `put(blob(4, 0.26, 0.09, 0.8), 0, -0.09, 0.05)` DARK · nose `put(blob(3, 0.2, 0.07, 0.22), 0, -0.08, -0.78)` METAL · wing R and wing L (below) HOOD · thrusters, for sx of [-1, 1]: `put(new THREE.CylinderGeometry(0.11, 0.13, 0.32, 12), sx * 0.2, -0.1, 0.86, Math.PI / 2)` METAL · stirrups `put(blob(3, 0.09, 0.03, 0.14), -0.12, 0.015, -0.18)` and `put(blob(3, 0.09, 0.03, 0.14), 0.12, 0.015, 0.2)` METAL |
| 2 | `flames` (Group) with one Mesh (FLAME) | `rig` | (0, -0.1, 1.02) | for sx: `put(cone(0.1, 0.5), sx * 0.2, 0, 0.25, Math.PI / 2)` `0xff7a1a` · for sx: `put(cone(0.05, 0.3), sx * 0.2, 0, 0.15, Math.PI / 2)` `0xffe94a` |
| 3 | `pelvis` (Group) | `rig` | (0, 0.44, 0) | — |
| 4 | `legL` (Mesh, VINYL) | `pelvis` | (-0.12, 0, 0) | leg geometry (one geometry shared by both legs): thigh `put(cap(0.085, 0.12), 0, -0.10, -0.05, 0.5)` MAIL · shin `put(cap(0.075, 0.12), 0, -0.29, -0.06, -0.45)` MAIL · boot `put(blob(3, 0.085, 0.06, 0.15), 0, -0.40, -0.05)` DARK · toe `put(cone(0.04, 0.12), 0, -0.36, -0.21, -1.0)` DARK |
| 5 | `legR` (Mesh, VINYL) | `pelvis` | (0.12, 0, 0) | same geometry |
| 6 | `spine` (Group) | `pelvis` | (0, 0, 0) | — |
| 7 | `torso` (Mesh, VINYL) | `spine` | (0, 0, 0) | tunic: `smoothLathe([[0, -0.08], [0.16, -0.07], [0.21, 0], [0.2, 0.14], [0.19, 0.3], [0.15, 0.44], [0.07, 0.52], [0, 0.53]], { segments: 16, samples: 14, scaleZ: 0.72 })`, then `boxify(geo, 3)`, `smoothNormals(geo)` HOOD · hem, for k = 0..5, a = k * PI / 3: `put(cone(0.06, 0.1), 0.17 * cos(a), -0.1, 0.12 * sin(a), Math.PI)` HOOD · belt `put(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 16).scale(1, 1, 0.72), 0, 0.05, 0)` DARK · satchel `put(blob(3.5, 0.11, 0.1, 0.07), -0.2, 0, -0.02)` BAG · flap `put(blob(3.5, 0.115, 0.035, 0.075), -0.2, 0.075, -0.02)` FLAP |
| 8 | `armL` (Mesh, VINYL) | `spine` | (-0.2, 0.40, 0) | arm geometry (shared): upper `put(cap(0.07, 0.12), 0, -0.10, 0)` MAIL · fore `put(cap(0.065, 0.1), 0, -0.26, -0.06, 0.6)` MAIL · mitt `put(blob(2.6, 0.085, 0.09, 0.085), 0, -0.36, -0.13)` DARK |
| 9 | `armR` (Mesh, VINYL) | `spine` | (0.2, 0.40, 0) | same geometry; child `hand` = `Object3D` at (0, -0.44, -0.17); child of `hand`: `heldBomb = new THREE.Mesh(bombs.geometry, bombs.material)` + `addOutline(heldBomb, 0.03, 0x15171c)` |
| 10 | `head` (Group) | `spine` | (0, 0.94, 0) | — |
| 11 | `skull` (Mesh, VINYL) | `head` | (0, 0, 0) | skull `blob(2.6, 0.46, 0.44, 0.44, 24)` SKIN · ears, for sx: `put(cone(0.085, 0.36), sx * 0.57, 0.19, 0.02, 0, 0, -sx * 0.971)` SKIN · hood: `new THREE.SphereGeometry(1, 24, 12, 0, 2 * PI, 0, 0.56 * PI)`, every vertex through `roundCube(v, 2.6)` then scaled (0.485, 0.465, 0.465), `smoothNormals`, then `rotateX(0.5)` HOOD · peak `put(cone(0.07, 0.16), 0, 0.30, -0.42, 2.9)` HOOD |
| 12 | `face` (Mesh, FACE) | `head` | (0, 0, 0) | `facePatch(1, -1.0, 1.0, -0.75, 0.55, 0.006, { segX: 20, segY: 12, deform: (v) => { roundCube(v, 2.6); v.x *= 0.46; v.y *= 0.44; v.z *= 0.44; return v; } })` (toon.js:373; same reshaping as the skull) |
| 13 | `tail` (Mesh, `toonMaterial(HOOD, { shade: 'soft' })`, outline 0.02) | `head` | (0, 0, 0) | `new TubeShape(8, 6)`; set every frame (M7.4) |

Wings (part of `glider`): `shape = new THREE.Shape()` through the points (x, y) = (0.2, -0.45) (1.5, 0.05) (1.5, 0.3) (1.2, 0.18) (1.05, 0.5) (0.75, 0.28) (0.55, 0.62) (0.2, 0.45), closed; `wingR = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }).rotateX(Math.PI / 2)` (shape y becomes z, the 0.05 thickness goes below y = 0), then `rotateZ(0.12)` (tips 0.15 m up), then `translate(0, -0.06, 0)`. `wingL` = the same with every shape x negated and the point order reversed, `rotateZ(-0.12)`.

Face texture: `faceTex = canvasTexture(512, 384, draw)`, sRGB; `textures = [faceTex]`. `draw` (canvas pixels, x to the viewer's right, y down; the second eye / brow / nostril uses `512 - x`):

| Step | Exact |
|---|---|
| 1 skin | fill all `#4fbf3a` |
| 2 eyes (both) | path: `moveTo(226, 190)`, `quadraticCurveTo(170, 96, 70, 96)`, `quadraticCurveTo(110, 205, 226, 190)`; fill `#ffe94a`; stroke `#15171c`, `lineWidth = 12`, `lineJoin = 'round'` |
| 3 brows (both) | line (236, 150) -> (60, 70), stroke `#15171c`, `lineWidth = 16`, `lineCap = 'round'` |
| 4 grin | path: `moveTo(96, 250)`, `quadraticCurveTo(256, 350, 416, 250)`, `quadraticCurveTo(256, 285, 96, 250)`; fill `#f4f4f6`; stroke `#15171c` 10 |
| 5 teeth | `save()`, the grin path again + `clip()`, for i = 0..8: line (128 + i * 32, 240) -> (128 + i * 32, 340), stroke `#15171c` 5; `restore()` |
| 6 grin corners | arcs r 14 centred (92, 244) and (420, 244), from 0.2 PI to 1.2 PI, stroke `#15171c` 8 |
| 7 nostrils (both) | line (244, 222) -> (248, 236), stroke `#15171c` 5 |
| 8 chin | arc centre (256, 340) r 34 from 0.2 PI to 0.8 PI, stroke `#3da12e` 6 |

### M7.3 Pose (a `PoseBlend(defaults, 0.12)`, toon.js:561; `t` = model time, `st` = seconds in the state)

Applied each `update(dt)`: `rig.position.y = p.rigY`; `spine.rotation.set(p.spineRX, p.spineRY, 0)`; `head.rotation.x = p.headRX`; `armR.rotation.set(p.armRX, 0, p.armRZ)`; `armL.rotation.set(p.armLX, 0, p.armLZ)`; `legL.rotation.set(p.legLX, 0, -0.12)`; `legR.rotation.set(p.legRX, 0, 0.12)`.
(Positive `rotation.x` swings a hanging limb forward, toward -Z; `armRZ > 0` and `armLZ < 0` lift the arms away from the body. If a limb goes the wrong way, flip that sign in the table, not the geometry.)

| Key | `fly` (default, loops) | `throw` (0.35 s, then `fly`) | `laugh` (0.8 s, then `fly`) | `hit` (until reset) |
|---|---|---|---|---|
| rigY | `0.03 * sin(6.3 * t)` | same as fly | `0.03 * sin(88 * t)` | 0 |
| spineRX | `-0.35 + 0.04 * sin(6.3 * t)` | `-0.35 - 0.2 * sin(PI * min(1, st / 0.35))` | -0.15 | 0.4 |
| spineRY | 0 | `0.4 * sin(PI * min(1, st / 0.35))` | 0 | 0 |
| headRX | 0.3 | 0.3 | 0.8 | 0.9 |
| armRX | `2.4 + 0.08 * sin(6.3 * t + 1)` | `2.4 + (0.7 - 2.4) * (1 - (1 - min(1, st / 0.15)) ** 2)` | 0.4 | 2.8 |
| armRZ | 0.25 | 0.25 | 0.9 | 1.2 |
| armLX | 0.3 | 0.3 | 0.3 | 2.8 |
| armLZ | -0.45 | -0.45 | -0.9 | -1.2 |
| legLX | 0.35 | 0.35 | 0.35 | 0.9 |
| legRX | -0.35 | -0.35 | -0.35 | -0.9 |

`setState(name)`: `if (name === state) return` except for `throw` (it restarts); `st = 0`; `blend.start()`. `heldBomb.visible = state !== 'throw' && state !== 'hit'` (the bomb in his hand "becomes" the one the director launches from `hand`).

### M7.4 Per-frame extras in `update(dt)`

| Thing | Formula |
|---|---|
| flames | `flames.scale.z = 1 + 0.3 * Math.sin(t * 40)` |
| hood tail | for i = 0..7, `f = i / 7`: point = `(0.08 * f * sin(t * 12 - f * 4), 0.36 - 0.25 * f * f + 0.04 * f * sin(t * 9 - f * 3), 0.30 + 0.62 * f)`, radius = `0.09 + (0.02 - 0.09) * f`; `tube.set(pts, radii, 0.9)` (preallocated `pts`) |

### M7.5 What the director does with `root` (C.3 of the events file has the timeline)

| Phase | `root.position` | `root.rotation` |
|---|---|---|
| swoop in, `u = smoothstep(t / 1.6)` | cubic Bezier P0 (5, 9, 8), P1 (2, 2.6, -2), P2 (-2.5, 5.5, -16), P3 (0, 3.5, -13) at `u` | `y = 0` while `t < 1.2`, then `y = PI * smoothstep((t - 1.2) / 0.4)`; `z = 2 * PI * smoothstep((t - 1.2) / 0.4)` (one roll while he turns) |
| station | `x += (aimX - x) * (1 - exp(-5 * dt))`; `y = 3.5 + 0.35 * sin(2.1 * t)`; `z = -13 + 1.2 * sin(0.9 * t)` | `y = PI`; `z = clamp(vx * 0.12, -0.5, 0.5)` with `vx` = this frame's x speed (flip the sign if he banks out of the turn) |
| exit, clean, `u = (t - t0) / 1.2` | lerp from where he is to (8, 12, -40) with `u * u` | `z += 14 * dt`; model state `hit` |
| exit, hit, `u = (t - t0) / 1.4` | lerp to (-7, 14, -45) with `u * u` | `y = PI`; model state `laugh` |

Blob shadow: `createBlobShadow(0.9)` (world.js:199) at `(root.x, 0.08, root.z)`, opacity 0.5, visible while he is.

Look at: in portrait at the station he sits in the upper middle of the screen, never over the player and never hiding the bomb rings; grin and yellow eyes read at 13 m; the silhouette (ears, wings, hood tail) reads against the sky and against facades; the swoop passes over the player's head without clipping the camera; ink outlines have no cracks on the head and limbs. *(tune)*: station y / z, his overall scale (`root.scale`, default 1), head tilt, VINYL gloss.

## M8 VFX handlers (fx.js, pooled kit only; one handler per event)

Helpers used: `chunkBurst`, `puffBurst`, `sparkBurst`, `burst`, `groundRing`, `sticker`, `impactFrame`, `hitStop`, `edgeLines` (vfxCore.js:560-727), fx.js's own `flash(kind, alpha, ms)` (fx.js:593) and its WORDS sprites (`hop`, `cank`, `gum` exist, fx.js:247). `L(lane)` = `laneX(lane)`.

| Event | Calls |
|---|---|
| `rowPass` `gap` | word `hop` at (player.x, player.y + 2.1, -1) |
| `rowPass` `gate` | `sparkBurst({ x: player.x, y: 1.0, z: 0 }, { n: 5, speed: 5, colors: [0xff2d2d, 0xffffff], up: 0.1 })` |
| `rowPass` `girder` | `edgeLines(0.8)`, and `edgeLines(0)` after 0.25 s of fx time |
| `gapPatch` | word `cank` at (0, 1.8, position.z); `sparkBurst({ x: 0, y: 0.2, z: position.z }, { n: 16, speed: 8, colors: [0xffc93c, 0xffffff], flat: 1 })` |
| `strikeSlam`, per lane | at `q = { x: L(lane), y: 0.1, z: -3 }`: `chunkBurst(q, { n: 8, force: 7, size: 0.22, colors: [0x6f6a64, 0x3a3d45, 0x14141b] })`; `puffBurst(q, { n: 6, ring: true, radius: 0.7, size: 0.5 })`; `groundRing(q, { r0: 0.3, r1: 2.6, width: 0.4, life: 0.3, color: 0x14141b, edge: 0xff1f3d, scroll: true })`; once per slam: `game.cameraRig.shake(0.18, 0.2)` and `sticker('slak', { x: L(lane) + (L(lane) > 0.5 ? -1.3 : 1.3), y: 1.7, z: -2.5 }, { width: 0.3, life: 0.5 })` |
| `strikeHit` | `hitStop(0.06)`; `impactFrame({ at: position, bg: 0x14141b, dot: 0x3a0d16, line: 0xff1f3d })`; `flash('white', 0.3, 160)` |
| `eventDodge` | `sparkBurst(position, { n: 4, speed: 4, colors: [0xffc700, 0xffffff], up: 0.8 })` |
| `bombLand` | `puffBurst(position, { n: 3, size: 0.3, rise: 0.6, scroll: true })` |
| `bombBlast` | `burst('glow', position, { color: 0xff9a2e, size: 1.2, grow: 4, life: 0.25, additive: true })`; `chunkBurst(position, { n: 10, force: 9, size: 0.24, colors: [0xff7a1a, 0xe2600f, 0x3da12e, 0x22242a] })`; `puffBurst(position, { n: 6, size: 0.6, colors: [0x55505a, 0x8d8880] })`; `game.cameraRig.shake(0.2, 0.25)`; `sticker('boom', { x: position.x, y: 2.0, z: -1.5 }, { width: 0.32, life: 0.5 })` for the first bomb of a row only |
| `eventStart` venom | `game.cameraRig.shake(0.25, 0.5)` |
| `eventStart` goblin | `flash('green', 0.25, 200)`; after 1.5 s of fx time `sticker('haha', goblin root position, { width: 0.4, life: 0.9 })` |
| `eventReward` | `sparkBurst(position, { n: clean ? 30 : 16, speed: 7, colors: [0xffc700, 0xffe94a, 0xffffff], up: 1 })`; if `clean`: venom: word `gum` at (chaser.x, 1.2, chaser.gap) and `puffBurst` there; goblin: `sticker('thwip', goblin root position, { width: 0.4, life: 0.8 })` |

New `STICKERS` (vfxCore.js:86): `slak: ['ŞLAK!', '#ffffff', '#1c1016']`, `boom: ['BOOM!', '#ffd23a', '#ff7a1a']`, `haha: ['HA HA HA!', '#d7ff5a', '#6a2fa0']`.
