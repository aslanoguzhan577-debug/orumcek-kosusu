# 11.5 Yol sürprizleri — design (index + obstacles)

Stage 11.5 of PLAN.md. Three files:

| File | Content |
|---|---|
| `tasarim/11-5-yol-surprizleri.md` (this) | concept, decisions, CONFIG, **A** the three obstacles, the generator and checker rules |
| `tasarim/11-5-olaylar.md` | **B** Venom Hamlesi, **C** Yeşil Cin baskını, **D** shared event rules |
| `tasarim/11-5-modeller.md` | **M0–M8** build recipes for every visual (each part as a primitive call, materials, poses, ASCII silhouettes). Where it differs from the short art tables in A.1–A.3 here, the recipe file wins. |
| `tasarim/11-5-gorevler.md` | **E** performance budget, **F** 15 ordered coding tasks with asserts, **G** open questions, **H** decisions for the manager |
| `tasarim/ilerleme-11-5-tasarim.md` | progress / hand-over note of the design pass |

Line references are to the code as of commit `56cd6cd` + the working tree (see `tasarim/HARITA.md`).
Not prototyped in the browser (quota): every number below is derived from the code's geometry and
physics; the visual tasks in F list what a checker must look at and which numbers may be tuned.

## 0 Concept

The track stops being a conveyor of boxes. Three **set-piece obstacles** span the whole track, so
no lane escapes them and each one owns one verb: the **Ray Yarığı** (a chasm across all three
tracks: jump), the **Sinyal Kapısı** (a signal gantry whose shutter drops as you arrive: slide), and
the **Vinç Kirişi** (a yellow lattice girder that swings on a crane and parks across two lanes:
get to the lane with the green arrows). Two **events** then take over a cleared stretch of track
for 10 seconds: in **Venom Hamlesi** the chaser comes into frame and whips tendrils onto the lane
you stand in (red lane warning, then the slam); in **Yeşil Cin baskını** the Goblin swoops over
your head on his glider, flies backwards in front of you and lays rows of pumpkin bombs you read
ahead. A hit in an event is a stumble (the existing two-mistakes rule: Venom closes in, the second
one is a catch); surviving pays coins and a temporary score multiplier, a flawless one pays more
and ends with a punchline (Venom face-plants; the Goblin gets webbed and spins off).

## 1 Decisions that shape everything

| # | Decision | Why |
|---|---|---|
| 1 | Gap and gate are **rows**: one descriptor, all three lanes. Girder covers two lanes (centre + one outer). | New decisions for the player (no lane escape), and the fairness proof stays per lane. |
| 2 | A wide obstacle is spawned as **one lane collider per lane it occupies**, each at `laneX(lane)`, linked in a `group`; only the first (`owner`) draws. | Every lane-keyed system (sense `PartList`, Iron Spider clear, hero smashes, catch-cam side, camera block) keeps working unchanged: to them it is "two wagons side by side". |
| 3 | The girder's **collision is static** (its parked pose); only the art swings. The swing is a pure function of time-to-arrival `tau`, parked for the last `lockTime` seconds. | Collision can only happen at `tau ~ 0`, where art and collision agree; the checker proves the clearance from the same function. |
| 4 | Events run on a **zone the generator reserves** (no obstacles, coins or pickups in any lane). | "Never unfair with the obstacles already on the track" becomes true by construction and checkable in `check-patterns.mjs`. |
| 5 | Strikes and bombs come from **one pure row function** (`nextRow`), aimed at the player's lane, whose warning time is extended to the lane distance it demands. | One fairness rule, one test, both events. |
| 6 | An event hit goes through `obstacles._hit('side', …)`. | Stumble, Venom near, decoy forgiveness, hero absorb, Iron Spider catch-absorb all apply with no new code. |
| 7 | The reward multiplier is a new field **`game.mult.event`**, not `mult.temp`. | `tracer.js` writes `mult.temp` absolutely (`= 0`, `++`, tracer.js:87, 136, 147); sharing it would let the tracer wipe the reward. |
| 8 | Removing a wide obstacle removes its whole group; a removed gap leaves a **steel patch plate** over the hole. | Hero smashes use reverse index loops over `obstacles.active` (hero-specials.js:826, ironspider.js:178): mates are not spliced, they are sent to `z = 1e6` and the normal release collects them next frame. |

## 2 CONFIG entries (all new; `src/config.js`)

```js
// inside obstacles: { ... }
gap:    { lenMin: 4, lenMax: 6, lenTime: 0.16, pitTop: 0.35, width: 2.2 },
gate:   { bottom: 0.95, top: 3.3, depth: 0.35, width: 2.2, raised: 1.9, dropFrom: 2.4, dropTo: 1.6 },
girder: { length: 4.4, bottom: 0.3, top: 2.1, depth: 0.5, amp: 1.1, period: 2.0, lockTime: 1.2, pivotY: 16 },
rowWarnTime: 2.4,        // s before arrival: rowWarn event (horn / clang, first-time caption)

// inside patterns: { ... }
rows: {
  firstAt: 600,          // m: first gap
  gateAt: 1100,          // m: gates join
  girderAt: 1700,        // m: girders join
  gapMin: 260, gapMax: 520, // m between two rows (random in between) ...
  gapEndless: 0.7,       // ... times this at endless k = 1
  comboChance: 0.4,      // at k = 1: gap -> gate (or gate -> gap) back to back
  weights: { gap: 3, gate: 3, girder: 2.5 },
},

// new top-level group
events: {
  firstAt: 1200,         // m: first event zone is due (never in the first km)
  gapMin: 1400, gapMax: 2200, // m from a zone's end to the next due point ...
  gapEndless: 0.6,       // ... times this at endless k = 1
  tail: 2.0,             // s of reserved track beyond the event's duration (speed grows up to 1.5 m/s in 10 s)
  endMargin: 1.0,        // s: an event stops this long before its zone ends, whatever the clock says
  pickupClear: 9,        // s: no pickup this long before a zone is due (a flight would skip it)
  rowClear: 120,         // m after a zone before the next row obstacle
  hitHeight: 2.2,        // feet below this are hit (a normal jump, apex 1.5, does not dodge)
  laneHalf: 1.0,         // |player.x - laneX| below this = in that lane
  warnEasy: 1.3, warnHard: 0.9, warnEndless: 0.78,   // s of warning: start, difficultyMax, x at k = 1
  restEasy: 0.45, restHard: 0.15, restEndless: 0.6,  // s between a slam and the next warning
  switchSlack: 0.08,     // s added per lane to laneSwitchTime (a human's second swipe)
  inputSlack: 0.06,      // s added once
  doubleFrom: 0.5, doubleSpan: 1.0, doubleMax: 0.6,  // two-lane rows: chance = clamp((diff - from) / span, 0, max)
  senseActTime: 0.45,    // spider-sense moves him this long before a slam / blast (= sense.laneActTime)
  bonusTime: 12,         // s the reward multiplier lasts
  bonusClean: 3, bonusHit: 1, // game.mult.event after a flawless / a survived event
  venom:  { duration: 10, intro: 1.4, outro: 1.2, slamTime: 0.12, holdTime: 0.25, retractTime: 0.3,
            coinPerDodge: 5, cleanCoins: 25, dolly: 1.6, scale: 1.0, screenShare: 0.34 },
  goblin: { duration: 10, intro: 1.6, outro: 1.4, lead: 1.6, fly: 0.45, blastAhead: 0.6, blastBehind: 1.0,
            coinPerRow: 6, cleanCoins: 30, stationZ: -13, stationY: 3.5, height: 1.85 },
},
```

## A The three obstacles

Common facts used below: lanes at x = -2.2, 0, 2.2 (`laneX`); deck half width 3.7, side walls at
x = ±3.85 (world.js:35-73); running surface y = 0, rail tops y = 0.06; a jump has
`vy = sqrt(2*42*1.5) = 11.22 m/s`, 0.534 s of air; the player's hit box is 0.7 wide, 0.6 deep,
1.6 tall (0.75 sliding); `_collide` tests feet at `y + 0.1` (obstacles.js:374).
`tau = -o.z / max(speed, 1)` = seconds until the obstacle's near face reaches the player.

### A.1 Ray Yarığı — `gap` (jump)

| | |
|---|---|
| Shape | A chasm across the whole deck, `len` metres long. `len = clamp(round(v * 0.16 * 2) / 2, 4, 6)`, v = the generator's block speed (so 4 m up to 26 m/s, 6 m from 37 m/s). |
| Collision | Three lane colliders, each one part `{ x0: -1.1, x1: 1.1, y0: -1, y1: 0.35, f0: 0, f1: len, pit: true }`. A `pit` part is **never a floor** and is hit while the feet are below `pitTop`: running in (front), or coming down into it from above (front). |
| Passing it | Feet must stay at `y >= 0.25` over `len + 0.5` m. A normal jump is above 0.25 for 0.488 s; needed: `(len + 0.5) / v`. Timing window = 0.488 - that: 0.25 s at 19 m/s (600 m), 0.31 s at 26 m/s, 0.32 s at 39 m/s (len 6). The checker asserts `>= 0.15 s` for every gap. |
| Front hit | `crash` -> `hooks.onCrash` -> Venom catch (unchanged path). The catch knockback (3 m, chaser.js:294) slides the world ahead, so he ends up standing on the near lip: no fall animation is needed. |
| Side hit | Cannot happen in a full row (every lane is pit). The rule that exists (side -> stumble + bounce back) stays for safety. |
| Telegraph | Seen from the spawn horizon (>= 100 m clear of fog): two 3.4 m red/white poles with yellow diamond "jump" signs at the near lip (a goal post), the bright far lip over a black band, yellow chevrons on every lane's last 4 m, bent rail ends. `rowWarn {type:'gap'}` at tau = 2.4 s (sound: two-tone klaxon). `rowPass {type:'gap'}` when cleared (sound: whoosh; fx: the existing `hop` word). |
| Removed by a power | The colliders go; the hole keeps being drawn with a riveted steel **patch plate** slammed over it (`gapPatch` event: fx `cank` word + sparks). |

Art, kind `gapHole` (built 1 m long, instance scaled in z by `len`; origin = near lip centre, extends to -Z; **no outline**, 1 draw call). All boxes 0.02 thick at y = 0.075 unless noted; f = fraction of the length from the near lip:

| Piece | Size (x) | f range | Colour |
|---|---|---|---|
| near ink edge | 7.4 | 0 – 0.02 | `0x15171c` |
| abyss | 7.4 | 0.02 – 0.55 | `0x0d0b12` |
| far wall, low | 7.4 | 0.55 – 0.80 | `0x2b2733` |
| far wall, mid | 7.4 | 0.80 – 0.94 | `0x55505a` |
| far wall, lit top | 7.4 | 0.94 – 0.985 | `0x8d8880` |
| far lip (y = 0.09, 0.03 thick) | 7.4 | 0.985 – 1 | `0xe8e2d4` |
| 8 ribs on the far wall (y = 0.078) | 0.12 each, x = -3.2 + i * 0.914 | 0.55 – 0.985 | `0x1a1820` |

Why it reads as a hole: from the chase camera (3.4 m up, looking forward) a real 1.5 m deep pit shows almost only its far wall; the slab paints exactly that (dark at the near side, lit under the far lip, vertical ribs). 11.3 swaps the abyss colour for water on the bridge.

Art, kind `gapEnds` (not scaled; origin = near lip centre; things with z > 0 lie before the lip, toward the player; outline hull only on poles and signs, 2 draw calls):

| Piece | Geometry | Colour |
|---|---|---|
| 2 poles, x = ±3.45, z = 0.3 | box 0.16 × 3.4 × 0.16, as 6 stacked bands of 0.567 | `0xe63946` / `0xf4f4f4` alternating |
| 2 signs on the poles, y = 2.9, facing +Z | black box 1.0 × 1.0 × 0.04 and yellow box 0.9 × 0.9 × 0.06, both `rz = PI/4`; black up-arrow: shaft 0.12 × 0.5 × 0.07 + two 0.12 × 0.3 × 0.07 at `rz = ±0.7` | `0x22242a`, `0xffc93c` |
| jagged lip plate per lane | box 2.0 × 0.1 × 0.25 at (laneX, 0.06, 0.12) | `0x8d8880` |
| bent rails, per lane at x = laneX ± 0.72 | 3 boxes 0.1 × 0.1 × 0.5, `rx` = -0.4, -0.9, -1.4, centres (y, z) = (0.12, 0.2), (0.36, 0.02), (0.68, -0.05) | `0xc8ced8`, last one `0xff7a1a` (hot tip) |
| 2 chevrons per lane, z = 2.0 and 4.0, pointing -Z | two boxes 0.9 × 0.022 × 0.22 at `ry = ±0.6`, y = 0.075, meeting at the lane centre | `0xffc93c` |

Art, kind `gapPatch` (built 1 m long, scaled like `gapHole`; hull = one box; 2 draw calls): plate 7.0 × 0.08 × 1 at y = 0.09 `0x9aa1ad`; hazard strips f 0–0.08 and 0.92–1 `0xffc93c`; 6 cross tread lines 6.6 × 0.085 × 0.02 `0x5b616c`.

`ShapeBuilder.box` gains one option, `ry` (rotate about Y before translating), for the chevrons.

### A.2 Sinyal Kapısı — `gate` (slide)

| | |
|---|---|
| Shape | A signal gantry over the whole track: posts outside the rails, a truss on top, a signal head over each lane, and a **bar shutter** (see-through, so the track behind stays readable) that hangs raised and drops to slide height as the player approaches. |
| Collision | Three lane colliders, each one part `{ x0: -1.1, x1: 1.1, y0: 0.95, y1: 3.3, f0: 0, f1: 0.35 }` (same bottom as `high`, so a slide, 0.75 tall, passes exactly as today). Static: the shutter's animation is art only and is fully down from tau = 1.6 s (62 m at top speed). |
| Front hit / side hit | As `high` (front = crash; jumping up into it = front; side is impossible in a full row). |
| Telegraph | Posts and truss are 4.8 m tall, visible over everything on the track. Shutter raised by 1.9 m until tau = 2.4 s, then drops with smoothstep until tau = 1.6 s; three red lamps and yellow "duck" chevrons ride on its boom. `rowWarn {type:'gate'}` at tau = 2.4 s (sound: bell + ratchet; the drop starts on it). `rowPass {type:'gate'}` when slid under (sound: whoosh). |

Art, kind `gateFrame` (static, x = 0; origin = near face; 2 draw calls):

| Piece | Geometry | Colour |
|---|---|---|
| 2 posts, x = ±3.78 | box 0.3 × 3.9 × 0.3 at y = 1.95, z = -0.175; base plate 0.6 × 0.12 × 0.6 | `0x3a3d45` |
| truss | box 7.9 × 0.5 × 0.4 at y = 3.65, z = -0.175; yellow strip 7.9 × 0.1 × 0.42 at y = 3.42 | `0x3a3d45`, `0xffc93c` |
| 3 signal heads, x = laneX | housing 0.7 × 0.9 × 0.25 at y = 4.35, z = -0.05; lit red lamp 0.34 × 0.34 × 0.06 at y = 4.55, z = 0.1; dark green lamp same size at y = 4.15 | `0x15171c`, `0xff2d2d`, `0x1d5c33` |

Art, kind `gateShutter` (x = 0; instance y = `raise(tau)`; hull = boom only; 2 draw calls). `raise(tau) = 1.9 * smoothstep((tau - 1.6) / (2.4 - 1.6))`, clamped 0..1 inside:

| Piece | Geometry | Colour |
|---|---|---|
| boom | 12 boxes 0.6 × 0.26 × 0.2 side by side, x from -3.3, y = 1.08, z = -0.175 | `0xe63946` / `0xf4f4f4` alternating |
| 15 bars | box 0.07 × 2.1 × 0.07 at x = -3.36 + i * 0.48, y = 2.25, z = -0.175 | `0x55595f` |
| 2 ties | box 7.2 × 0.06 × 0.06 at y = 1.9 and 2.6 | `0x55595f` |
| 3 boom lamps, x = laneX | box 0.3 × 0.3 × 0.08 at y = 1.08, z = -0.03; white glint 0.1 × 0.1 × 0.09 offset (0.07, 0.07) | `0xff2d2d`, `0xffffff` |
| 3 "duck" chevrons, x = laneX, y = 1.65, z = -0.13 | two boxes 0.5 × 0.12 × 0.05 at `rz = ±0.6` forming a V pointing down | `0xffc93c` |

### A.3 Vinç Kirişi — `girder` (get to the open lane)

| | |
|---|---|
| Shape | A yellow lattice truss girder, 4.4 m long (exactly two lanes), 1.8 m tall, 0.5 m deep, hung from a tower-crane jib 16 m above the track. It swings across the track like a pendulum and **parks** over the centre lane and one outer lane for the last 1.2 s. The other outer lane (`open`) is the way through. |
| Collision | Two lane colliders (centre lane and the covered outer lane), each one part `{ x0: -1.1, x1: 1.1, y0: 0.3, y1: 2.1, f0: 0, f1: 0.5 }`: too low to slide under (0.75), too tall to jump (apex 1.5; the Örümcek Yayı, apex 3.3, clears it, as it clears a `high` today). Static = the parked pose. |
| Motion (art only) | Beam centre x: `girderOffset(tau, open)` in `patterns.js`. With `s = open === 0 ? -1 : 1` (s points at the open lane): for `tau > 1.2`: `x = -s * 1.1 * cos(2 * PI * (tau - 1.2) / 2.0)`; for `tau <= 1.2`: `x = -s * 1.1`. So at tau = 2.2 s it hangs over the open lane, sweeps the centre, and is parked across the two covered lanes from 1.2 s out (47 m at top speed, 23 m at 19 m/s). Behind the player (tau < 0) it stays parked. |
| Clearance proof | Parked, the beam's end toward the open lane is at 1.1 m from the track centre; the player in the open lane starts at 1.85 m: 0.75 m of air. The checker asserts `>= 0.5 m` for every `tau` in [-0.2, 1.2]. |
| Front hit | In a covered lane: crash (a wall). |
| Side hit | Changing into a covered lane while beside the beam: stumble + bounce back (existing rule). |
| Telegraph | (1) the swing itself, from the horizon: >= 4 s at any speed, with the red/white jib overhead; (2) on the deck, the 7 m before the beam: black/yellow zebra pads on the two covered lanes with a red edge, **green chevrons on the open lane**; these never move and are the truth from the first frame; (3) `rowWarn {type:'girder', open}` at tau = 2.4 s (sound: crane horn, two honks + steel creak): the beam is then leaving the open lane; (4) parked from 1.2 s. `rowPass {type:'girder'}` (sound: heavy whoosh). |

Art (origin = middle of the beam's near face on the deck):

Kind `girderBeam` (the only moving piece; 2 draw calls; hull = the four chords and the end plates). Instance matrix = `T(0, 16, z) * Rz(theta) * T(0, -16, 0)`, `theta = girderOffset(tau, open) / (16 - 1.2)`; the model itself is centred on x = 0:

| Piece | Geometry | Colour |
|---|---|---|
| 4 chords | box 4.4 × 0.14 × 0.14 at y = 0.37 and 2.03, z = -0.07 and -0.43 | `0xf5b417` |
| 10 verticals | box 0.1 × 1.52 × 0.1 at x = -2.13, -1.065, 0, 1.065, 2.13, y = 1.2, on both faces | `0xf5b417` |
| 8 diagonals | box 0.08 × 1.86 × 0.08 in each of the 4 bays, y = 1.2, `rz = ±0.611` alternating (zig-zag), on both faces | `0xd9960a` |
| 2 end plates, x = ±2.2 | 5 stacked bands 0.12 × 0.36 × 0.5, y from 0.3 | `0xffc93c` / `0x22242a` |
| 2 beacons | box 0.2 × 0.16 × 0.2 at (±2.2, 2.2, -0.25) | `0xffa51f` |
| 2 slings | box 0.05 × 1.85 × 0.05 from (±1.4, 2.1) to (0, 3.3), i.e. centre (±0.7, 2.7), `rz = ∓0.862` | `0x2a2d34` |
| hook block + hook | box 0.5 × 0.45 × 0.4 at y = 3.5; box 0.14 × 0.3 × 0.14 at y = 3.2 | `0xf5b417`, `0xe63946` |
| main cable | box 0.07 × 12.3 × 0.07, centre y = 9.86 | `0x2a2d34` |

Kind `girderJib` (static at x = 0, no outline, 1 draw call): jib box 26 × 0.9 × 0.9 at y = 16.5, z = -0.25, as 5 segments of 5.2 alternating `0xe63946` / `0xf4f4f4`; trolley box 1.0 × 0.5 × 0.8 at y = 16.1 `0x3a3d45`.

Kind `girderPad` (one instance per covered lane at `laneX`, no outline, 1 draw call), lying on z from 0 to +7, y = 0.07: base 2.15 × 0.02 × 7.0 `0x22242a`; 7 stripes 2.15 × 0.022 × 0.5 at z = 0.5 + i `0xffc93c`; red edge strips 0.1 × 0.03 × 7.0 at x = ±1.03 `0xe63946`.

Kind `girderGo` (one instance at `laneX(open)`, no outline, 1 draw call): 3 chevrons at z = 1.5, 3.5, 5.5 pointing -Z, each two boxes 0.9 × 0.022 × 0.26 at `ry = ±0.6`, y = 0.075, `0x35e06a`.

### A.4 How every existing system treats them

| System | gap | gate | girder |
|---|---|---|---|
| Generator / checker cell | JUMP in all 3 lanes | SLIDE in all 3 lanes | BLOCK in 2 lanes, the open lane FREE |
| Route rule | it is the block's one route obstacle | same | the route **is** the open lane; no route obstacle in that block |
| Spider-sense (sense.js) | jumps (the simulation learns `pit` parts); order `jump, lane, slide` as for `low` | treated as `high`: `slide, lane, jump` | treated as a wall: lane change; from the covered outer lane it crosses the centre first (new two-step rule, task F-4) |
| Iron Spider front absorb (ironspider.js:170) | colliders removed -> patch plate; 0.5 s grace carries him over | removed | removed (both colliders, whole beam) |
| Hero smashes / beams (Hulk, Cap, Miles, Kitty, Batman, Iron Man, Panther) | `obstacles.remove` -> patch plate | whole gate gone, their own rubble FX | whole girder gone |
| Cap's shield surf | hovers at 0.32 m: feet test 0.42 >= 0.35, so he **surfs over gaps** (kept on purpose) | must still be absorbed / avoided | absorbed on hit |
| Flights, Ağ Salınışı, Duvar Koşusu, landing grace | immune: `_collide` returns while `_graceTimer > 0` (obstacles.js:368); a pit is no floor, so nothing lands on it | immune | immune |
| Örümcek Yayı | any jump clears it | apex 3.3 just clears the top (as with `high`) | clears it |
| Coins | a 7-coin jump arc over the gap in every lane (`_routeCoins`, as for `low`) | 3 low coins under the shutter in every lane (as for `high`) | a ground row in the open lane from 0.8 s before to 4 m after; none in the covered lanes |
| Magnet | pulls the arcs as usual | — | — |
| Pickups | never inside a row block (`routeFree = null`) | same | same |
| Iron Spider gold-arm grab (`_updateGrab`, `high` only) | — | not added (skipped: cosmetic) | — |
| Catch-cam side, camera `_blocked` | read lane colliders: no change | no change | no change |
| Web zip roof search (`wagons`/`train` only) | ignored | ignored | ignored |
| Pools | lane colliders come from the unbounded `_pool`; art caps: `gapHole` 3, `gapEnds` 3, `gapPatch` 3, `gateFrame` 3, `gateShutter` 3, `girderBeam` 3, `girderJib` 3, `girderPad` 6, `girderGo` 3 | | |

At most two rows are alive at once (spacing >= 260 * 0.7 = 182 m against a 200 m life window; a combo pair is two different types), so a cap of 3 has slack; the checker asserts it.

**11.3 hook (one line):** `_row()` picks the type from a weight table; 11.3 multiplies those weights by a district table (`gap` only on the Köprü, `gate` only in the Metro tüneli, `girder` in Midtown / Neon Meydan) and drops the `firstAt / gateAt / girderAt` distances.

### A.5 `obstacles.js` changes (exact)

1. **Shapes.** `gapShape(len)`, `gateShape()`, `girderShape()` return `{ parts: [the part above], visuals: [] }`. `getShape` key becomes `type|cars|ramp|len` where `len` is `desc.len` for `gap`, else 0.
2. **Spawn.** In `_spawn`: `type === 'event'` -> `this.hooks.onEventZone(desc)` (new hook, default no-op), nothing else. `gap | gate | girder` -> for each `lane` of `descLanes(desc)` (patterns.js): `o = this._addObstacle({ ...desc, lane }, z, 0)`, `o.group = group`, `o.open = desc.open`; `group[0].owner = true`. `_addObstacle` resets `group = null, owner = false, warned = false, passed = false, hit = false, open = undefined` on every object it hands out (the pool is shared with ordinary obstacles).
3. **Floor.** `_floorUnder`: `if (part.pit) continue;` at the top of the part loop.
4. **Collision.** `_collide`: before the final `else continue`, add `else if (part.pit && py0 >= prevTop) kind = 'front'; // dropped into the pit from above`. `_hit`: set `o.hit = true` first.
5. **Remove.** `remove(o)`: if `o.type === 'gap'` and `o.z` is finite-near (`o.z < 1e5`), push `{ z: o.z, len: o.length }` to `this.patches` once per group (skip if the group is already `patched`) and `emit('gapPatch', { position })`. Then remove `o` as today, and for every other member `m` of `o.group`: `m.z = 1e6` (the release test in `beforePlayer` collects it next frame; every consumer already skips things far behind). Do not splice mates: callers iterate `active` by index.
6. **Patches.** `this.patches` (array of `{z, len}`): moved by `v * dt` in `beforePlayer`, dropped when `z - len > releaseZ`, cleared in `reset()`, shifted in `shift(dz)`.
7. **Row events.** In `beforePlayer`, for each `o.owner`: `tau = -o.z / max(v, 1)`; if `!o.warned && tau <= O.rowWarnTime`: `warned = true`, `emit('rowWarn', { type, open, position: {x: 0, y: 1, z: o.z} })`. If `!o.passed && o.z - o.length > playerDepth / 2`: `passed = true`, and if no member of the group has `hit`: `emit('rowPass', { type, position: {x: player.x, y: player.y, z: 0} })`.
8. **Draw.** In `_draw`: for each `o.owner`: `art.addRow(o.type, o.z, o.length, o.open, tau)`; for each patch: `art.addPatch(z, len)`.
9. **Event hits.** `get graced() { return this._graceTimer > 0; }` and
   `eventHit(x) { if (this._graceTimer > 0) return false; this._hit('side', { type: 'event', x, z: 0, dz: 0, length: 0, speed: 0, parts: [], halfWidth: 1 }); return true; }`.
   (`remove()` of that pseudo obstacle is a no-op: it is not in `active` and has no group.)

### A.6 Generator changes (`patterns.js`, exact)

Helpers: `descLength`: add `case 'gap': case 'gate': case 'girder': return desc.len;`.
New exports: `descLanes(desc)` -> `[0, 1, 2]` for `gap`/`gate`; `[1, 2 - desc.open]` for `girder` (centre first, then the covered outer lane; `open` is 0 or 2); `[desc.lane]` otherwise. `girderOffset(tau, open)` as in A.3.
`AFTER_TIME` gains `gap: 0.75, gate: 0.6, girder: 0.5`.

`reset()` adds: `this.nextRowD = P.rows.firstAt; this.lastRow = null; this.nextEventD = CONFIG.events.firstAt; this.eventKind = 'venom';` (no RNG draw in `reset`).

`_block(out)`: `B` becomes `let`. Everything up to and including the `A < P.safeStart` early return, `shiftWin` and `afterScale` stays. Then:

```js
let route = this.route, routeFree = null;
const due = A >= this.nextEventD ? 'event' : A >= this.nextRowD ? 'row' : null;
if (due) {
  // a special needs every lane empty: the lanes are left to run out, then it is placed
  const free = Math.max(A + 1, this.routeNext, this.laneFree[0], this.laneFree[1], this.laneFree[2]);
  if (free > B - 1) {
    // calm block: nothing new anywhere, just the route's coin row
    if (rng() < C.routeRowChance) this._coinRow(out, route, Math.max(A, this.laneFree[route]), B - 1, 0);
  } else {
    B = Math.max(B, due === 'event' ? this._eventZone(out, free, v, k) : this._row(out, free, v, k, shiftWin, afterScale));
    this.cursor = B;
    route = this.route;               // a girder may have moved it
  }
} else {
  // ... steps 1, 2, 3, 3b exactly as today (they set route and routeFree) ...
}
// 4. extras: as today, with two changes: they run in special and calm blocks too (the tracer
// records every block's route), and no pickup near a zone:
if (due || B > this.nextEventD - v * CONFIG.events.pickupClear) routeFree = null;
```

`free <= B - 1` always becomes true: a calm block adds nothing, and the longest thing a lane can
still hold is a train sweep (< 100 m). The special itself may reach past `B`; the block is
stretched to its end.

```js
// A row obstacle; every lane is empty from `free` on. Returns the metre the block must reach.
_row(out, free, v, k, shiftWin, afterScale) {
  const R = CONFIG.patterns.rows, rng = this.rng;
  const table = [['gap', R.weights.gap]];
  if (free >= R.gateAt) table.push(['gate', R.weights.gate]);
  if (free >= R.girderAt) table.push(['girder', R.weights.girder]);
  const open = table.length > 1 ? table.filter(([n]) => n !== this.lastRow) : table;
  const type = pickWeighted(rng, open);
  let end = this._placeRow(out, type, free, v, shiftWin, afterScale);
  // endless: jump -> slide (or slide -> jump) across the whole track, as soon as the spacing allows
  if (type !== 'girder' && k > 0 && rng() < R.comboChance * k) {
    end = this._placeRow(out, type === 'gap' ? 'gate' : 'gap', this.routeNext - v * P.checkGapTime - 1, v, shiftWin, afterScale);
  }
  this.lastRow = type;
  this.nextRowD = end + lerp(R.gapMin, R.gapMax, rng()) * lerp(1, R.gapEndless, k);
  return end + 1;
}

_placeRow(out, type, free, v, shiftWin, afterScale) {
  const O = CONFIG.obstacles;
  if (type === 'girder') {
    // the open lane is an outer lane and the route goes there; two lane-change windows of empty
    // track in front, so even the far outer lane has a proven way across
    if (this.route === CENTER_LANE) this.route = this.rng() < 0.5 ? 0 : LANES - 1;
    const open = this.route;
    const d = free + 2 * shiftWin;
    const desc = { type, lane: CENTER_LANE, d, len: O.girder.depth, open };
    out.push(desc);
    const after = d + desc.len + v * AFTER_TIME.girder * afterScale + 1.5;
    for (let lane = 0; lane < LANES; lane++) if (lane !== open) this.laneFree[lane] = after;
    this.routeNext = Math.max(this.routeNext, after);
    this._coinRow(out, open, d - v * 0.8, d + desc.len + 4, 0);
    return d + desc.len;
  }
  const d = free + v * P.checkGapTime + 1;      // a full checker reaction of empty track in every lane
  const len = type === 'gap' ? clamp(Math.round(v * O.gap.lenTime * 2) / 2, O.gap.lenMin, O.gap.lenMax) : O.gate.depth;
  const desc = { type, lane: CENTER_LANE, d, len };
  out.push(desc);
  // every lane was forced through it, so every lane gets the landing / stand-up room
  const after = d + len + v * AFTER_TIME[type] * afterScale + 1.5;
  for (let lane = 0; lane < LANES; lane++) {
    this.laneFree[lane] = after;
    this._routeCoins(out, { type, lane, d, len }, v);
  }
  this.routeNext = after;
  return d + len;
}

// An event zone: [d, d + len] stays empty in every lane. Returns its end.
_eventZone(out, free, v, k) {
  const E = CONFIG.events, kind = this.eventKind;
  const d = free + v * P.checkGapTime;
  const end = d + v * (E[kind].duration + E.tail);
  out.push({ type: 'event', kind, d, len: end - d });
  for (let lane = 0; lane < LANES; lane++) this.laneFree[lane] = end;
  this.routeNext = end + v * P.reactionTime;
  this.eventKind = kind === 'venom' ? 'goblin' : 'venom';
  this.nextEventD = end + lerp(E.gapMin, E.gapMax, this.rng()) * lerp(1, E.gapEndless, k);
  this.nextRowD = Math.max(this.nextRowD, end + E.rowClear);
  return end;
}
```

`_routeCoins`: `desc.type === 'low' || 'car'` branch also takes `'gap'`; the `'high'` branch also takes `'gate'`.
`_sideObstacleCoins` and `room()` never see the new types (special blocks skip step 3).

Difficulty never plateaus: row spacing and event spacing shrink with the endless share `k`, combos
appear with `k`, and `k` itself never reaches 1 (patterns.js:90).

**11.3 hook for events (one line):** `_eventZone` picks `kind` from `dayPhaseAt(d)` (a pure function of distance in 11.3): `goblin` only while the phase is night, `venom` otherwise; the alternation flag goes away.

### A.7 What `tools/check-patterns.mjs` must learn

Expand wide descriptors first: `statics` gets one entry per lane of `descLanes(o)` (same `d`, `len`, `type`); `event` descriptors go to their own list `zones` and are skipped like pickups in the counts.

| # | Check | Rule |
|---|---|---|
| C1 | cell kinds | `gap` -> JUMP, `gate` -> SLIDE, `girder` -> BLOCK, each on `[d - hd, d + len + hd]` of its lanes |
| C2 | coin profile | `gate`: `highCell` with `O.gate.bottom / top` (keep the bar's own numbers per cell: store the type, pick the numbers in the coin test); `girder`: `floorTop = O.girder.top`; `gap`: nothing solid |
| C3 | gap is jumpable | for every gap: `2 * sqrt(2 * (jumpHeight - (pitTop - 0.1)) / gravity) - (len + playerDepth) / speedAt(d - 60) >= 0.15` |
| C4 | row run-up | every lane FREE on `[d - speedAt(d) * P.checkGapTime, d - hd)` before a `gap` / `gate` |
| C5 | row landing | every lane FREE on `(d + len + hd, d + len + speedAt(d) * 0.4]` after a `gap` / `gate` |
| C6 | girder open lane | the `open` lane FREE on `[d - 2 * speedAt(d) * (laneSwitchTime + reactionTime), d + len + hd]`, and the other two lanes FREE on that stretch before `d - hd` |
| C7 | girder clearance | for `tau` from -0.2 to `lockTime` step 0.01 and both `open` values (`s = open === 0 ? -1 : 1`): `(laneWidth - playerWidth / 2) - (s * girderOffset(tau, open) + length / 2) >= 0.5`; `girderOffset(0, open) === -s * amp`; and the swing really sweeps: `s * girderOffset(lockTime + period / 2, open) === amp` |
| C8 | zone is empty | no static, no train BLOCK cell, no coin and no pickup with `d` in `[z.d - speedAt(z.d) * P.checkGapTime, z.d + z.len]`, in any lane |
| C9 | zone is long enough | with `T = E[z.kind].duration`: `z.len >= speedAt(z.d) * T + 0.5 * CONFIG.acceleration * T * T + speedAt(z.d + z.len) * E.endMargin` (the whole event fits before the director's early-end line) |
| C10 | zone spacing | first `z.d >= E.firstAt`; next `z.d - (prev.d + prev.len) >= E.gapMin * E.gapEndless`; kinds alternate starting with `venom` |
| C11 | no flight into a zone | no pickup with `d` in `[z.d - speedAt(z.d) * 7, z.d + z.len]` |
| C12 | rows keep off zones | no row with `d` in `[z.d, z.d + z.len + E.rowClear - 1]` |
| C13 | pools | `CAP` gains `gapHole: 3, gateFrame: 3, girderBeam: 3` (one per descriptor, alive from `d - HORIZON` to `d + len + RELEASE`) |
| C14 | they exist | `gap`, `gate`, `girder`, `event` are in the "never generated" list (default 20-minute run) |

The existing route search and the per-minute reaction margin run unchanged over the new cells; the margin must stay `>= P.minReaction` in every minute.
