# 11.5 Yol sürprizleri — events (B Venom Hamlesi, C Yeşil Cin baskını, D shared rules)

Index and CONFIG: `tasarim/11-5-yol-surprizleri.md`. `E` below = `CONFIG.events`, `P` = `CONFIG.patterns`.
Both events run on a zone the generator reserved (file 1, A.6 `_eventZone`): `[d, d + len]` has no
obstacle, coin or pickup in any lane, so the only threats are the event's own.

## S Shared machinery

### S.1 `src/event-logic.js` (pure, no Three.js; node tests import it)

```js
import { CONFIG } from './config.js';
import { difficultyAt, endlessK } from './patterns.js';
const E = CONFIG.events, P = CONFIG.patterns;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// the checker's reaction time at distance d (check-patterns.mjs rAt): 0.6 s, toward 0.4 s in the endless phase
export const rAt = (d) => lerp(P.checkGapTime, P.minReaction, endlessK(difficultyAt(d)));
// least warning for a row that makes the player cross `delta` lanes
export const floorW = (delta, d) => rAt(d) + delta * (CONFIG.laneSwitchTime + E.switchSlack) + E.inputSlack;
const ease = (d) => Math.min(difficultyAt(d), P.difficultyMax) / P.difficultyMax;   // 0..1 up to difficultyMax
export const warnAt = (d) => Math.max(floorW(1, d), lerp(E.warnEasy, E.warnHard, ease(d)) * lerp(1, E.warnEndless, endlessK(difficultyAt(d))));
export const restAt = (d) => lerp(E.restEasy, E.restHard, ease(d)) * lerp(1, E.restEndless, endlessK(difficultyAt(d)));
export const doubleChance = (d) => clamp((difficultyAt(d) - E.doubleFrom) / E.doubleSpan, 0, E.doubleMax);

// One row of danger. safePrev[lane] = lanes the player may be standing in when the warning
// appears; aim = the lane the row is aimed at. Always draws exactly two numbers.
// Returns { deadly: [bool x3], delta, warn }: delta = the most lanes anyone in safePrev has to
// cross to a safe lane, warn = seconds he gets for it (never below floorW(delta)).
export function nextRow(rng, safePrev, aim, d) {
  const roll = rng(), pick = rng();
  const cands = [];
  if (roll < doubleChance(d)) {
    for (let c = 0; c < 3; c++) if (c !== aim) cands.push([c !== 0, c !== 1, c !== 2]); // only lane c is safe
  }
  if (!cands.length) cands.push([aim === 0, aim === 1, aim === 2]);                       // single: the aimed lane
  const deadly = cands[Math.min(cands.length - 1, Math.floor(pick * cands.length))];
  let delta = 0;
  for (let p = 0; p < 3; p++) {
    if (!safePrev[p]) continue;
    let near = 3;
    for (let c = 0; c < 3; c++) if (!deadly[c]) near = Math.min(near, Math.abs(p - c));
    delta = Math.max(delta, near);
  }
  return { deadly, delta, warn: Math.max(warnAt(d), floorW(delta, d)) };
}

// nearest safe lane of a row from `lane` (ties: the centre lane); used by spider-sense and by the goblin's aim
export function nearestSafe(deadly, lane) {
  let best = lane, bestD = 9;
  for (let c = 0; c < 3; c++) {
    const dd = Math.abs(c - lane) + (c === 1 ? 0 : 0.01);
    if (!deadly[c] && dd < bestD) { best = c; bestD = dd; }
  }
  return best;
}

export const rewardFor = (kind, dodged, hits) => ({
  coins: dodged * (kind === 'venom' ? E.venom.coinPerDodge : E.goblin.coinPerRow) + (hits === 0 ? E[kind].cleanCoins : 0),
  mult: hits === 0 ? E.bonusClean : E.bonusHit,
  clean: hits === 0,
});
```

What the curve gives (r = 0.6 s until 14.5 km):

| Distance | diff | warnAt | restAt | floorW(1) / floorW(2) | double chance | Venom strikes in 7.4 s | Goblin rows |
|---|---|---|---|---|---|---|---|
| 1.2 km | 0.46 | 1.16 s | 0.34 s | 0.88 / 1.10 | 0 | 4 | 5 |
| 3 km | 1.01 | 0.99 s | 0.22 s | 0.88 / 1.10 | 0.51 | 5 | 6 |
| 14.5 km | 1.30 | 0.90 s | 0.15 s | 0.88 / 1.10 | 0.60 | 6 | 7 |
| ~18 km (k = 0.5) | 1.50 | 0.80 s | 0.12 s | 0.78 / 1.00 | 0.60 | 7 | 7 |
| k -> 1 | grows | 0.70 s | 0.09 s | 0.68 / 0.90 | 0.60 | 8 | 8 |

A two-lane row whose only safe lane is two lanes away gets `floorW(2)` whatever the tempo, so the
warning is never shorter than the checker's reaction time plus the lane changes. The tempo keeps
rising with the endless share `k`, which never reaches 1: no plateau.

### S.2 The director: `src/road-events.js`, class `RoadEvents`

A game system (`update(dt)`, `reset()`), built in `main.js` after the tracer:
`new RoadEvents({ player, obstacles, chaser, cameraRig, art })`, `game.roadEvents`; `art = { warnings, tendrils, bombs, markers, columns, goblin, shadow }` is built by `main.js` from `event-art.js` / `models/goblin.js` and may be missing (node tests): every art call is guarded, the director itself never imports those files.
Its own RNG: `createRng((obstacles.seed ^ 0x9e3779b9) >>> 0)`, re-made in `reset()` (same track + same moves = same event).
It installs `obstacles.hooks.onEventZone = (z) => { this.zone = z; }` (zones are > 800 m apart, the horizon is 164 m: one pending zone is enough). That one line is added last, in task 13: until then events start only through `start(kind)`.

State it writes: `game.state.eventKind` (`null | 'venom' | 'goblin'`), `game.state.eventTime` (seconds left of the running event), `game.state.eventBonusTime` (seconds left of the reward multiplier), `game.mult.event`.
`game.js` changes: the three state fields; `mult = { base: 1, run: 0, temp: 0, event: 0, factor: 1 }`; `state.multiplier = (mult.base + mult.run + mult.temp + mult.event) * mult.factor`; `_resetRun` zeroes `mult.event`.

```
update(dt):
  if game.halted: if active -> _end(aborted = true); return         // the catch is playing
  if st.eventBonusTime > 0:
     st.eventBonusTime = max(0, st.eventBonusTime - dt)
     if it reached 0: game.mult.event = 0; emit('eventBonusOff')
  if not active:
     z = this.zone
     if z and world.distance >= z.d:
        this.zone = null
        if world.distance < z.d + 30 and _calm() and chaser.mode === 'away': _begin(z)
     return
  if not _calm(): _end(true); return                                 // a flight / special started
  t += dt;  st.eventTime = max(0, duration - t)
  early = world.distance > z.d + z.len - st.speed * E.endMargin      // never over the next obstacles
  run the kind's own update (B.3 / C.3); it calls _finish() when its outro is over, or at once if early
```

`_calm()` = `game.speedOverride == null && !game.swing.active && !game.wall.active && !game.web.zipping && !(game.heroSpecials && game.heroSpecials.active) && st.tracerTime <= 0 && !player.controlsLocked`.
A zone whose trigger fails is not retried: it is a quiet stretch of empty track.
Distances are read from `game.world.distance` (the generator's metres), never `state.distance`.

`_finish()` (the event ran to its end): `r = rewardFor(kind, dodged, hits)`; `st.coins += r.coins`; `game.mult.event = r.mult`; `st.eventBonusTime = E.bonusTime`; `emit('eventReward', { kind, coins: r.coins, mult: r.mult, clean: r.clean, position: {x: player.x, y: player.y + 1.6, z: 0} })`; then `_end(false)`.
The reward coins are added silently (no `coin` events: 85 coin sounds and coin-mission ticks in one frame are not wanted).

`_end(aborted)`: hide every pooled visual of the event; `cameraRig.setDolly(0, 0)` if the event had set it; venom: `chaser.endHunt(hits > 0)`; `st.eventKind = null; st.eventTime = 0`; `emit('eventEnd', { kind, clean: !aborted && hits === 0, hits, dodged, aborted })`. An aborted event pays nothing.

`reset()` (run start / menu): hide everything without events, `zone = null`, `active = null`, `st.eventKind = null`, `st.eventTime = 0`, `st.eventBonusTime = 0`, `game.mult.event = 0`, new RNG.
Also `events.addEventListener('gameover', () => { if (this.active) this._end(true); })`.

Test / console entry: `roadEvents.start(kind)` begins an event now with a fake zone `{ kind, d: world.distance, len: 1e9 }` if `_calm()`; returns whether it started. Tasks F-7..F-10 are checked with it before the generator makes zones.

### S.3 Hits, dodges, spider-sense

| Rule | Exact |
|---|---|
| In the lane | `Math.abs(player.x - laneX(lane)) < E.laneHalf` (1.0: half way through a lane change he is in neither lane) |
| Vulnerable | `!obstacles.graced && player.y < E.hitHeight` (2.2: a jump does not dodge; landing grace, flights and saves do) |
| A hit | `obstacles.eventHit(laneX(lane))`: goes through `_hit('side', …)`: hero special may absorb, `stumble` event, stumble pose, then the chaser's stumble rule (and the decoy's forgiveness in front of it). `hits++`. At most one hit per strike / per bomb row. |
| A dodge | the strike / row ended without a hit: `dodged++`, `emit('eventDodge', { kind, position: player feet })` |
| Spider-sense | while `st.senseTime > 0`, a danger aimed at `player.lane` and due within `E.senseActTime`: `c = nearestSafe(deadly, player.lane)`; `player.changeLane(Math.sign(c - player.lane))`; `game.sense.dodges++`; `emit('senseDodge', { action: 'left' | 'right', position })`. One change per frame; a two-lane escape is finished on the next frames by the same rule (0.14 + 0.14 s < 0.45 s). |
| Iron Spider | not a front hit, so the suit stays; a second hit that would be a catch goes through `chaser.hooks.absorbCatch` (suit breaks, he is saved) as today |

## B Venom Hamlesi

### B.1 What the player lives through

Venom's roar comes from behind the camera, the camera pulls back and for the first time in a run
he is **in the picture**: full size, shoulders and grin filling the bottom third. Black tendrils
grow out of his back and rear up over Spider-Man's head; the lane he stands in turns red, the red
fills toward his feet, and the tendril whips down along that lane. Move, and it cracks the deck
beside you; stay, and you stumble with Venom one mistake away. Later in the run two lanes go red
at once. Survive the volley and his last lunge misses.

### B.2 Chaser changes (`chaser.js`)

| Change | Exact |
|---|---|
| fields | `spare = 0`, `hunting = false`, `pose = null`; all three cleared in `reset()` |
| `hunt()` | `mode = 'near'; timer = Infinity; arrived = false; spare = 1; hunting = true;` (the existing `near` case then emits `venomNear` when he arrives: vignette and sound come for free) |
| `endHunt(wasHit)` | `hunting = false; pose = null; spare = 0;` then, only if `mode === 'near'`: `wasHit ? (timer = C.nearTime) : _dropBack()` |
| `onStumble()` | after the `CATCHING` guard: `if (this.mode === 'near' && this.spare > 0) { this.spare--; return; }`. So in the event the first hit is forgiven by Venom himself and the second is a catch (unless `absorbCatch`). |
| `_nearGap()` | uses `hunting ? E.venom.screenShare : C.maxScreenShare`, and `this.root.scale.x` instead of `C.nearScale` for the head top |
| scale target in `update` | `CATCHING ? 1 : hunting ? E.venom.scale : C.nearScale` |
| model state in `update` | `if (this.pose && !CATCHING.has(this.mode)) state = this.pose;` |

### B.3 Timeline (event time `t`, seconds; `V = E.venom`)

| t | Phase | Logic | Look and sound hooks |
|---|---|---|---|
| 0 | start | `st.eventKind = 'venom'`; `chaser.hunt()`; `chaser.pose = 'roar'`; `cameraRig.setDolly(V.dolly, 0)`; `emit('eventStart', { kind: 'venom', duration: 10 })` | banner "VENOM HAMLESİ!"; shake 0.25 / 0.5 s; all three warning strips flicker once (0.25 s at opacity 0.3: he is measuring the lanes); sound: roar |
| 0.9 | intro | `chaser.pose = 'reach'` | four tendrils grow out of his back (0.25 s each, 0.08 s apart) and sway |
| 1.4 | volley | loop below until `t >= 10 - V.outro` (8.8) | |
| 8.8 | outro | no new strike; a strike already warned is played to its end first; then `_finish()` data is computed and `eventReward` emitted at once | flawless: `chaser.pose = 'catch'` for 0.6 s (the lunge that misses), fx word `gum` + dust at his feet, then he falls back; with a hit: `chaser.pose = 'roar'` and he stays near for `nearTime` |
| 10 | end | `_end(false)`: `chaser.endHunt(hits > 0)`, dolly back to 0 | tendrils retract (0.3 s) |

Volley loop (one strike at a time, never overlapping):

```
if no strike is running and cooldown <= 0 and (8.8 - t) >= warnAt(d) + V.slamTime:
   row = nextRow(rng, oneHot(player.lane), player.lane, world.distance)
   strike = { deadly: row.deadly, warn: row.warn, left: row.warn, phase: 'warn', hit: false }
   emit('strikeWarn', { lanes, warn: row.warn })
strike.phase 'warn':  left -= dt;  spider-sense rule (S.3) while left <= E.senseActTime;
                      at left <= 0: phase = 'slam', left = V.slamTime, emit('strikeSlam', { lanes })
strike.phase 'slam':  each frame, for each deadly lane: in the lane and vulnerable and !strike.hit -> hit (S.3), emit('strikeHit', { position })
                      left -= dt; at left <= 0: if !strike.hit -> dodge (S.3); strike = null; cooldown = restAt(d)
cooldown -= dt
```

`oneHot(player.lane)`: the row is judged from the lane he is in (or moving into) when the warning
appears; the strike is always aimed at him, so every strike asks for a move.

| Strike | Deadly lanes | Lanes to cross | From |
|---|---|---|---|
| Kırbaç (single) | his lane | 1 | always |
| Çatal (double) | his lane + one other; the safe lane is next to him | 1 | diff 0.5 (~1.3 km), chance up to 0.6 |
| Çatal, far side | his outer lane + the centre; the safe lane is the far outer one | 2 (warning stretched to `floorW(2)`) | same roll, half of the doubles from an outer lane |

### B.4 Visuals (all built at load in `src/event-art.js`, added to the scene hidden; warm-up compiles them)

**Lane warnings** (`createLaneWarnings()` -> `{ show(lane, p, t), flash(lane), hide(lane) }`):

| Piece | Exact |
|---|---|
| base strip, one per lane | `PlaneGeometry(2.0, 30, 1, 10)` laid flat, centre `(laneX, 0.085, -12)` (z from +3 to -27); `MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })`, `renderOrder = 4`; one material per lane, one shared texture |
| texture | canvas 128 × 512: fill `#ff1f3d`; 45° stripes `#b3122b`, 24 px wide every 48 px; 6 px edge lines `#4a0a10` left and right; a white 60 % chevron every 128 px pointing at the player; `wrapT = RepeatWrapping`, `repeat.y = 4`, `offset.y += dt * 1.5` (flows toward him) |
| opacity | `0.45 + 0.2 * sin(time * lerp(8, 26, p))` (pulses faster as the slam nears) |
| fill strip, one per lane | `PlaneGeometry(2.0, 27, 1, 9)` laid flat with its far edge at the origin, mesh at `(laneX, 0.09, -27)`, `scale.z = p` (the bright red grows from far away to his feet and arrives exactly at the slam); material colour `0xff1f3d`, opacity `lerp(0.5, 0.85, p)` |
| `p` | `1 - strike.left / strike.warn` |
| slam flash | base strip colour white, opacity 0.9 for 0.06 s, then both strips hidden |

Standard materials, so `curve.js` bends them with the track. 6 meshes, at most 4 visible.

**Tendrils** (`createTendrils(4)` -> each `{ mesh, set(points, radii) }`): `TubeShape(16, 8)` (toon.js:477), `toonMaterial(0x14141b, <venom.js GLOSS options>)`, `addOutline(mesh, 0.03, 0x050509)`, `frustumCulled = false`. Four, because two retract while two rear up at the fastest tempo.

Root `R = (chaser.x, chaser.y + 1.5, chaser.gap - 0.2)`. Sixteen points sampled on a centripetal Catmull-Rom through five control points; `xL = laneX(lane)`, `time` in seconds:

| Pose | C0 | C1 | C2 | C3 | C4 (tip) |
|---|---|---|---|---|---|
| rear (warning) | R | (lerp(R.x, xL, 0.3), R.y + 2.2, R.z - 1.0) | (lerp(R.x, xL, 0.7), 5.2, 1.0) | (xL, 5.0 + 0.3 sin 7t, -2.5) | (xL + 0.25 sin 9t, 3.9 + 0.25 sin 11t, -4.2) |
| slam (lying on the lane) | R | (lerp(R.x, xL, 0.5), R.y + 1.4, R.z - 1.2) | (xL, 1.6, 1.2) | (xL, 0.22, -1.5) | (xL, 0.2, -9.0) |
| idle (intro / between strikes) | R | (R.x + side * 0.8, R.y + 1.6, R.z - 0.4) | (R.x + side * 1.5, R.y + 2.4 + 0.3 sin 3t, R.z - 1.2) | (R.x + side * 1.9, R.y + 2.0, R.z - 2.0) | (R.x + side * 1.7 + 0.3 sin 5t, R.y + 1.3, R.z - 2.6) |

`side` = -1, -0.4, 0.4, 1 for the four tendrils. Blends: idle -> rear over 0.25 s (smoothstep) when the warning starts; rear -> slam over `V.slamTime` with `u * u` (it accelerates into the deck); slam held `V.holdTime`; slam -> idle over `V.retractTime`. Radii: `lerp(0.26, 0.09, f ** 0.8)` along the length, times 1.2 in the slam pose. A single strike uses the tendril on that side; a double uses two.

**Slam and hit FX** (fx.js handlers, pooled kit only):

| Event | Effect |
|---|---|
| `strikeWarn` | sound: rising hiss, length = `warn` |
| `strikeSlam` | per lane at (xL, 0, -3): `chunkBurst({ n: 8, force: 7, colors: [0x6f6a64, 0x3a3d45, 0x14141b] })`, `puffBurst({ n: 6, ring: true, radius: 0.7 })`, `groundRing({ r0: 0.3, r1: 2.6, color: 0x14141b, edge: 0xff1f3d, life: 0.3 })`; `cameraRig.shake(0.18, 0.2)`; sticker `slak` ("ŞLAK!") beside the lane; no hit-stop (control must stay crisp) |
| `strikeHit` | `hitStop(0.06)`, `impactFrame({ bg: 0x14141b, dot: 0x3a0d16, line: 0xff1f3d })`, `flash('white', 0.3, 160)`, ink drops from the `normal` particle pool |
| `eventDodge` (venom) | small `plus1`-style pop at his feet is NOT used (it means tracer); instead 4 coin-gold sparks: `sparkBurst({ n: 4, colors: [0xffc700, 0xffffff] })` |
| `eventReward` (venom) | coin fountain: 24 gold sparks + sticker `kapow` if clean; banner (D.5) |

New stickers in `vfxCore.js` `STICKERS` (built at load): `slak: ['ŞLAK!', '#ffffff', '#1c1016']`, `boom: ['BOOM!', '#ffd23a', '#ff7a1a']`, `haha: ['HA HA HA!', '#d7ff5a', '#6a2fa0']`.

## C Yeşil Cin baskını

### C.1 What the player lives through

A cackle, and a bat-winged shadow slides over the track from behind. The Goblin's glider buzzes
Spider-Man's head, banks, turns around and hangs in front of him, flying backwards, grinning at
the player. He sways over the lane he is about to bomb and tosses a pumpkin: an orange target
ring and a column of light mark the spot far ahead, the bomb arcs down onto it, and the ring
rushes toward you with the track. Two or three rows are in view at once; you read the gaps and
weave. Each bomb goes off as you pass it. Get through clean and a web line snags the glider:
"THWIP!", he spins away shrieking and coins rain down.

### C.2 The Goblin and his kit (`src/models/goblin.js`, `src/event-art.js`)

`createGoblin(bombs)` -> `{ root, hand, setState(name), update(dt), textures }`. Built once in `main.js`, added hidden; `textures` joins the warm-up list (main.js:235). Vinyl-toy proportions like the heroes (head ~45 % of the figure), `toonMaterial` + `addOutline(…, 0.025, 0x15171c)`, total height `E.goblin.height` = 1.85 m standing on the glider deck (y = 0 = deck top).
**The table below is the overview; the binding build recipe (every primitive, pivot, pose formula) is `11-5-modeller.md` M6 and M7.** Limbs are single pre-bent pieces (no elbows or knees), 10 meshes, <= 18 draw calls.

| Part | Geometry | Colour |
|---|---|---|
| head | sphere r 0.42, `boxify(geo, 3)`, centre y 1.25; face baked into one 512² canvas texture | skin `0x4fbf3a` |
| face (texture) | two huge slanted almond eyes, 0.26 wide, `0xffe94a` with a 10 px ink rim, no pupils; grin from cheek to cheek, white teeth with ink gaps; pointed chin shading | ink `0x15171c` |
| hood | shell r 0.445 over the top and back 60 % of the head (theta from 0 to 0.6 PI), front edge an ink line | `0x6a2fa0` |
| stocking tail | `TubeShape(8, 6)` from the hood's back, 0.7 m, radius 0.09 -> 0.02, flutters (`sin(time * 12 - f * 4) * 0.08 * f`) | `0x6a2fa0` |
| ears | 2 cones r 0.09, length 0.34, pointing out and up 35° from the head's sides | `0x4fbf3a` |
| torso | `roundCube` 0.36 × 0.42 × 0.26, centre y 0.72; scalloped hem (5 small cones) | tunic `0x6a2fa0` |
| arms, legs | capsules r 0.075 (arms 0.34 long in two segments, legs 0.36 in two) | scale-mail green `0x3da12e` |
| gloves, boots | `roundCube` 0.16 mitts; boots 0.14 × 0.12 × 0.26 with a curled-up toe (cone) | `0x3b1a63` |
| satchel | box 0.22 × 0.2 × 0.12 on the left hip, strap across the chest | `0xff7a1a`, strap `0x8a4b1f` |
| `hand` | empty Object3D in the right mitt: bombs start here | — |
| glider body | `roundCube` 0.5 × 0.16 × 1.5 (long axis z), nose plate | `0x3b1a63`, nose `0x9aa1ad` |
| glider wings | 2 extruded flat shapes 0.05 thick, root chord 0.9 at x 0.25, tip chord 0.25 at x 1.5, swept back 25°, trailing edge with 3 bat scallops; span 3.0 m | `0x6a2fa0`, 0.06 ink edge strip |
| thrusters | 2 cylinders r 0.12 × 0.3 at the tail; flame cones r 0.1 × 0.5, `MeshBasicMaterial`, `scale.z = 1 + 0.3 * sin(time * 40)` | `0x9aa1ad`, flame `0xff7a1a` |

One vertex-coloured material for the whole body; meshes and merge order: M7.2.

States (`PoseBlend`, 0.12 s): `fly` (knees bent 35°, torso leaning 20° toward the player, left hand on the satchel, right arm cocked with a pumpkin in the mitt, whole figure bobbing ±0.05 m at 2.1 Hz); `throw` (0.35 s: right arm up and over, torso twists 25°, back to `fly`); `laugh` (0.8 s: head back 30°, shoulders shaking at 14 Hz); `hit` (spinning out: arms and legs flung wide, `root.rotation.z += 14 * dt`).

Pumpkin bombs (`createBombs(8)`): one `InstancedMesh` + outline. Sphere r 0.28 scaled y 0.85, 16 segments, vertex colours alternating `0xff7a1a` / `0xe2600f` per segment pair (the ribs), a green stem cone (`0x3da12e`) and a carved face from a 128² canvas map (black triangle eyes, zig-zag mouth, yellow `0xffe94a` inside). Target markers (`createBombMarkers(8)`): one `InstancedMesh` of flat quads 2.0 × 2.0 at y = 0.085 with a 256² canvas map (dashed orange/black ring, 35 % orange fill, pumpkin-skull icon), `MeshBasicMaterial` transparent, `depthWrite: false`, polygon offset as the lane strips. Light columns: one `InstancedMesh` of open cylinders r 0.18 × 7 m, `MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, fog: false })`. A blob shadow under the glider: `createBlobShadow(0.9)` (world.js:199).

### C.3 Timeline (`G = E.goblin`)

| t | Phase | Logic | Look and sound hooks |
|---|---|---|---|
| 0 | start | `st.eventKind = 'goblin'`; `emit('eventStart', { kind: 'goblin', duration: 10 })`; `safePrev = [true, true, true]`; `lastD = -Infinity`; `nextToss = G.intro` | banner "YEŞİL CİN BASKINI!"; sound: cackle + jet |
| 0 – 1.6 | swoop in | position on the cubic Bezier P0 (5, 9, 8) -> P1 (2, 2.6, -2) -> P2 (-2.5, 5.5, -16) -> P3 (0, 3.5, -13), `u = smoothstep(t / 1.6)`; faces along his velocity until t = 1.2, then yaws 180° (one barrel roll about z) to face +Z by 1.6 | shadow passes over the player at t ~ 0.5; `flash('green', 0.25, 200)`; sticker `haha` at t = 1.5 |
| 1.6 – 7.0 | bombing | toss rule below | model `throw` on each toss |
| until rows are done | wait | no toss; the rows on the track are still live | |
| 8.6 | outro | when every row is resolved and `t >= 10 - G.outro`: `_finish()` data + `eventReward` | clean: sticker `thwip` on the glider, model `hit`, he flies to (8, 12, -40) in 1.2 s while spinning, coin fountain; with a hit: model `laugh`, climbs to (-7, 14, -45) in 1.4 s |
| 10 | end | `_end(false)` | |

Station (1.6 s on): `x` is damped (rate 5) toward `aimX` = the mean `laneX` of the row he tosses next (0 when idle); `y = 3.5 + 0.35 sin(2.1 t)`; `z = -13 + 1.2 sin(0.9 t)`; roll = `clamp(-vx * 0.12, -0.5, 0.5)`. He is the telegraph before the telegraph: he hangs over the lane he bombs.

Toss rule (at `t >= nextToss`, while `nextToss <= 10 - G.outro - G.lead` = 7.0):

```
aim  = safePrev[player.lane] ? player.lane : nearestSafe(not(safePrev), player.lane)   // where he has to be by then
row  = nextRow(rng, safePrev, aim, world.distance)
D    = max(world.distance + st.speed * G.lead, lastD + st.speed * row.warn)            // metres; row.warn s after the row before it
if D > zone.d + zone.len - st.speed * E.endMargin: stop tossing
for each deadly lane: take a bomb { lane, D, fly: 0, from: hand world position } ; marker + column at (laneX, D)
rows.push({ D, deadly: row.deadly, hit: false, done: false })
emit('goblinToss', { lanes, position: hand })
safePrev = not(row.deadly);  lastD = D;  nextToss += warnAt(world.distance)
```

Every row is visible `G.lead` = 1.6 s or more before it arrives, which is longer than any gap between rows (`max(warnAt, floorW(2))` <= 1.3 s), so the next row is always on the track before you pass the current one. Asserted: `G.lead >= max(E.warnEasy, floorW(2, d)) + 0.1` for every `d`.

Per bomb, each frame (`z = -(D - world.distance)`):

| When | What |
|---|---|
| `fly < G.fly` | `u = fly / G.fly`; position = `lerp(from, (laneX, 0.3, z), u) + (0, 2.2 * 4u(1 - u), 0)`; spins 9 rad/s; at `u = 1`: `emit('bombLand', { position })` |
| on the deck | at `(laneX, 0.3, z)`, scale `1 + 0.08 sin(time * lerp(10, 30, closeness))`, closeness = `1 + z / (speed * G.lead)` clamped 0..1 |
| `z >= -G.blastAhead` | bomb, marker and column hidden; `emit('bombBlast', { position, lane })` |
| row live while `-G.blastAhead <= z <= G.blastBehind` | each frame: in a deadly lane and vulnerable and `!row.hit` -> hit (S.3); `model.setState('laugh')` |
| `z > G.blastBehind` | `row.done = true`; if `!row.hit`: dodge (S.3) |

Spider-sense: for the nearest row not yet done with `-z / speed <= E.senseActTime` and `row.deadly[player.lane]`: the S.3 rule.

FX: `bombLand`: `puffBurst({ n: 3, size: 0.3 })`; `bombBlast`: `burst('glow', { color: 0xff9a2e, size: 1.2, grow: 4, life: 0.25, additive: true })`, `chunkBurst({ n: 10, force: 9, colors: [0xff7a1a, 0xe2600f, 0x3da12e, 0x22242a] })`, `puffBurst({ n: 6, colors: [0x55505a, 0x8d8880] })`, `cameraRig.shake(0.2, 0.25)`, sticker `boom` for one bomb per row; `eventReward` (goblin): 30 gold sparks falling from the glider's position.

**11.3 hook (one line):** the Goblin is the night event: `_eventZone` asks `dayPhaseAt(d) === 'night'` instead of alternating; his glider flames, the bombs' carved faces and the light columns are the things that glow in the dark.

## D Shared rules

### D.1 One at a time, and spacing

| Rule | How it is guaranteed |
|---|---|
| one event at a time | one `active` in the director; zones are >= `E.gapMin * E.gapEndless` = 840 m apart (checker C10) |
| never in the first km | `E.firstAt` = 1200 m (checker C10); the first Goblin comes at ~2.9 – 3.7 km |
| never over obstacles | zone empty in every lane (C8); the director stops `E.endMargin` s before the zone's end |
| never during a flight / special / boost | `_calm()` at the trigger; pickups are kept `E.pickupClear` s away from a due zone (C11) so that this is rare |
| never while Venom is already close | `chaser.mode === 'away'` at the trigger |
| a flight or special started mid-event | `_calm()` fails -> `_end(aborted)`, no reward (the player traded the reward for the power) |
| row obstacles | none in a zone nor for `E.rowClear` m after it (C12) |
| after the event | the zone's last `E.tail` s are plain empty track: the player picks a lane with the next obstacles in view |

### D.2 Pause, game over, restart, menu

| Moment | Result |
|---|---|
| pause | `game.update` returns before any system runs: the event, its timers and its art freeze; resume continues exactly there (all event motion is driven by the director's `dt`, none by wall-clock time) |
| hit-stop | same: everything holds |
| catch (`game.halted`) | the director aborts the event at once (visuals hidden, no reward); the chaser plays its catch |
| game over | `gameover` listener -> `_end(true)` |
| restart / menu | `_resetRun` -> `reset()` of every system: director back to nothing, `mult.event = 0`, `eventBonusTime = 0`, chaser `spare / hunting / pose` cleared, obstacles' `patches` cleared, generator schedule back to `firstAt` |

### D.3 Difficulty scaling

| Knob | Start | At `difficultyMax` | Endless (k -> 1) |
|---|---|---|---|
| row spacing | 260 – 520 m | same | × 0.7 |
| row combos (gap + gate) | 0 | 0 | chance 0.4 × k |
| gap length | 4 m | 5 m | 6 m (follows speed) |
| event spacing | 1400 – 2200 m | same | × 0.6 |
| warning time | 1.3 s | 0.9 s | × 0.78, never below `floorW` |
| rest between strikes | 0.45 s | 0.15 s | × 0.6 |
| two-lane rows | 0 | chance 0.6 | 0.6 |

### D.4 Events emitted (VFX and sound hang on these; nothing else)

| Event | Detail | Emitted by | VFX | Sound (for the audio owner) |
|---|---|---|---|---|
| `rowWarn` | `{ type, open?, position }` | obstacles.js, tau <= 2.4 s | first-time caption; gate: none more (the drop is art); girder: none | gap: two-tone klaxon; gate: bell + ratchet; girder: two crane honks + creak |
| `rowPass` | `{ type, position }` | obstacles.js | gap: fx word `hop`; gate: 3 sparks overhead; girder: `edgeLines` blip | whoosh (heavier for the girder) |
| `gapPatch` | `{ position }` | obstacles.js `remove` | fx word `cank`, `sparkBurst` | steel clang |
| `eventStart` | `{ kind, duration }` | director | banner, caption | venom: roar; goblin: cackle + jet; music: tension layer while `state.eventKind` is set |
| `strikeWarn` | `{ lanes, warn }` | director | lane strips, tendril rears | rising hiss of length `warn` |
| `strikeSlam` | `{ lanes }` | director | B.4 | whip crack + thud |
| `strikeHit` | `{ position }` | director | B.4 | (the `stumble` sound already plays) |
| `goblinToss` | `{ lanes, position }` | director | model `throw` | spring "boing" + giggle |
| `bombLand` | `{ position }` | director | puff | thunk |
| `bombBlast` | `{ position, lane }` | director | C.3 | boom (throttled: the audio `MIN_GAP`) |
| `eventDodge` | `{ kind, position }` | director | gold sparks | soft tick, rising one pentatonic step per dodge in the event |
| `eventReward` | `{ kind, coins, mult, clean, position }` | director | fountain, banner | fanfare; longer if `clean` |
| `eventEnd` | `{ kind, clean, hits, dodged, aborted }` | director | hide everything | tension layer off |
| `eventBonusOff` | `{}` | director | HUD gauge off | soft down-chime |

Existing events that fire as side effects: `stumble`, `venomNear`, `venomFar`, `senseDodge`, `crash`, `caught`.

### D.5 HUD, banners, captions

| Need | Exact |
|---|---|
| start banner | `events.addEventListener('eventStart', …)` -> `hudFlash(kind === 'venom' ? 'VENOM HAMLESİ!' : 'YEŞİL CİN BASKINI!', 'ms-banner ev-' + kind)`; `ui.css`: `.ev-venom` ink background `#14141b`, white text, red `#ff1f3d` stroke; `.ev-goblin` purple `#6a2fa0` background, text `#d7ff5a` |
| reward banner | `eventReward` -> `hudFlash((clean ? 'KUSURSUZ! ' : '') + '+' + coins + ' ALTIN · ÇARPAN +' + mult, 'ms-banner')` |
| reward gauge | one more power gauge by the recipe in HARITA §8 steps 11–14: kind `event`, `<div class="pgauge event" id="h-event">`, reads `st.eventBonusTime` against `E.bonusTime`; icon = a red/yellow comic burst with "x+" (new branch in `drawPowerIcon`); fill gradient `#ff1f3d` -> `#ffc93c`. The multiplier badge already shows the new total and bumps when it changes. |
| no in-event HUD | the scene is the HUD (red lanes, rings); `state.eventTime` exists for 11.2 if it wants a bar |
| first-time captions | new class `ev-caption` (yellow narration box `#ffe14a`, 3 px ink border, top 22 %, max-width 86 %), shown through the same `hudFlash` queue; ids and texts below; seen ids are stored in `localStorage['spidey.seen']` as a JSON object `{ id: 1 }` (guarded like every other key; a broken value = nothing seen). 11.2's narration boxes replace the look later and keep the ids. |

| Caption id | Trigger | Text |
|---|---|---|
| `gap` | first `rowWarn` of type `gap` | RAYLAR KOPMUŞ! ZIPLA! |
| `gate` | first `rowWarn` of type `gate` | SİNYAL KAPISI İNİYOR! ALTINDAN KAY! |
| `girder` | first `rowWarn` of type `girder` | VİNÇ KİRİŞİ! YEŞİL OKLARIN ŞERİDİNE GEÇ! |
| `venom` | first `eventStart` venom | VENOM HAMLESİ! KIRMIZI ŞERİTTEN ÇIK! |
| `goblin` | first `eventStart` goblin | YEŞİL CİN! BOMBALI ŞERİTTEN UZAK DUR! |

### D.6 Missions to add (`MISSION_POOL`; every goal capped)

| id | Text | base | growth | max | Counted from |
|---|---|---|---|---|---|
| `gapJump` | `{n} ray yarığından atla` | 3 | 2 | 20 | `rowPass` type `gap` |
| `gateSlide` | `{n} sinyal kapısının altından kay` | 2 | 2 | 16 | `rowPass` type `gate` |
| `girderPass` | `{n} vinç kirişinden sıyrıl` | 1 | 1 | 8 | `rowPass` type `girder` |
| `venomDodge` | `Venom'un {n} hamlesinden kaç` | 4 | 3 | 30 | `eventDodge` kind `venom` |
| `goblinDodge` | `Yeşil Cin'in {n} bombasından kaç` | 3 | 2 | 20 | `eventDodge` kind `goblin` |
| `eventClean` | `{n} baskını hasarsız atlat` | 1 | 1 | 4 | `eventEnd` with `clean` |

None is `onerun`: progress adds up over runs, so each is reachable by anyone who gets to 600 m (gap), 1.2 km (Venom) or ~3 km (Goblin; the same reach as the existing `swing` mission). Counting is a typed listener like the `pickup` one (missions.js:177): `rowPass` -> `{ gap: 'gapJump', gate: 'gateSlide', girder: 'girderPass' }[type]`.
Side effect to accept: a longer pool reshuffles `makeSet`, so a player's open set is replaced once (missions.js:109 "stale set": set number and multiplier level are kept, the three open missions restart).
