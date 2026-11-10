# 11.1 Kulak: coin sound and music (design)

Status: design, ready for coding. Author: opus-tasarim-ses, 2026-11-10.
Reference implementation you can listen to and port from: `tasarim/proto/ses-proto.js` + `tasarim/proto/ses.html`
(open http://localhost:5173/tasarim/proto/ses.html, every sound and theme has a button, "Ölç" renders offline and prints levels).
**Where this file and the prototype disagree, this file wins.** Where this file says "port verbatim", copy the prototype code as it is
(rename `E.g.*` to the music module's own variables, nothing else).

---

## 0. Concept

"Saturday-morning cartoon on a vinyl toy shelf." The menu is a lazy lo-fi loop: a warm FM electric piano, a toy **music box** melody,
soft swung drums and a quiet **vinyl crackle** (the Funko vinyl pun). The run theme is a bright comic-book chase in **A minor**:
punchy phone-friendly drums, a buzzing harmonic bass, chord stabs, a catchy saw lead with a dotted-eighth echo, and an arpeggio
for very long runs. Layers open one by one as the speed tier climbs, each entrance announced by a noise riser and a crash on a
4-bar boundary, while the tempo creeps from 112 to 128 BPM. When Venom is close a heartbeat and a beating A/B♭ drone come in and
the melody steps back. Everything is in A minor / C major so the coin ladder (C major pentatonic) always sounds "in tune" with the
music. Coins become a soft sine "pling" that climbs an 8-step pentatonic ladder.

All melodies, progressions and patterns in this file are original. Do not replace them with anything recognisable.

---

## 1. Architecture

### 1.1 Files

| File | Change |
|---|---|
| `src/audio-logic.js` | **new**, pure (no `window`, no `document`, no AudioContext): settings load/save, coin ladder + rate cap, tier / BPM / layer maps, voice pool, scene map, small helpers, all song data. Imported by `audio.js`, `music.js` and `tools/test-skills.mjs`. |
| `src/music.js` | **new**: music graph, instruments, sequencer, scenes, tension, stingers, ducking. Imports `audio-logic.js`, `events.js`, `game.js`. |
| `src/audio.js` | settings (two toggles), new output graph (limiter), coin redesign, `unlocked` gate, visibility suspend, ducking calls, `audioStats()`. |
| `src/game.js` | `toMenu()` emits `menu` (1 line). |
| `src/events.js` | comment line: add `menu`, `newRecord {score}`. |
| `src/ui.js` | two toggle buttons instead of the SES button; emit `newRecord`. |
| `index.html` | two buttons instead of each `data-mute` button. |
| `audio-test.html` | the mute button uses the new effect toggle. |
| `tools/test-skills.mjs` | asserts listed per task (section 7). |

### 1.2 Audio graph (built once in `audio.js` `ensureContext()` + `music.js` `initMusic()`)

```
sfx voices ─► master (gain SFX_VOL 0.55 | 0) ─► sfxComp (existing: -16 dB, knee 8, ratio 12, 3 ms, 200 ms) ─┐
coin voices ─► coinIn (gain 1) ─► coinLP (lowpass 5200 Hz, Q 0.5) ─► master                                 │
                                                                                                          ├─► limiter ─► out (gain 0.9) ─► destination
music voices ─► layer gains ─► [drums: dSat] [bass: bSat ─► bassLP] ─► musicLP ─► fade ─► duck ─► musicGain ┤
lead/stab voices also ─► echoIn (0.22) ─► delay ─► echoLP (2600) ─► musicLP ; echoLP ─► fb (0.28) ─► delay  │
stinger voices ─► stingerGain (2.2) ─────────────────────────────────────────────────────────► musicGain ───┘
```

| Node | Type | Setting |
|---|---|---|
| `limiter` | DynamicsCompressor | threshold **-4** dB, knee **0**, ratio **20**, attack **0.001** s, release **0.08** s |
| `out` | Gain | **0.9** |
| `master` (= sfx bus, existing variable) | Gain | `SFX_VOL = 0.55` when effects on, 0 when off (existing `MASTER_VOL`) |
| `sfxComp` | existing compressor | unchanged, but connects to `limiter` instead of `ctx.destination` |
| `coinIn` → `coinLP` | Gain 1 → Biquad lowpass | 5200 Hz, Q 0.5 |
| `musicGain` | Gain | `MUSIC_VOL = 0.14` when music on, 0 when off (`setTargetAtTime(v, now, 0.03)`) |
| `duck` | Gain | 1 (ducking, section 3.9) |
| `fade` | Gain | scene fades (section 3.8); `SCENE_GAIN = { menu: 1.6, run: 1.0 }` |
| `musicLP` | Biquad lowpass | 16000 Hz, Q 0.7 (caught sweep, section 3.8) |
| `stingerGain` | Gain | `STINGER_GAIN = 2.2` (stingers bypass `fade`, `duck`, `musicLP`) |
| `delay` | DelayNode(max 1.0) | `delayTime = 0.75 * 60 / bpm` (dotted 8th), updated each bar with `setTargetAtTime(v, t, 0.05)` |
| `echoIn` / `echoLP` / `fb` | Gain / lowpass / Gain | 0.22 / 2600 Hz Q 0.7 / 0.28 |
| layer gains | Gain ×7 | `LAYER_GAIN = { drums: 1.0, bass: 0.9, chords: 0.8, lead: 0.85, arp: 0.6, tension: 1.0, crackle: 1.0 }`; `tension` starts at **0** |
| `dSat` | WaveShaper | curve `tanh(1.6x)/tanh(1.6)`, 1024 points, oversample '2x'; `layer.drums → dSat → musicLP` |
| `bSat` → `bassLP` | WaveShaper → lowpass | curve k = 1.8, '2x' → 3200 Hz Q 0.7; `layer.bass → bSat → bassLP → musicLP` |
| noise buffer | AudioBuffer | reuse the existing `noiseBuf` (2 s white noise); music must not build its own |
| crackle buffer | AudioBuffer 3 s | built once in `initMusic`, port verbatim from `makeEngine` |

The iOS silent unlock buffer keeps connecting to `ctx.destination` (unchanged). Everything else ends in `limiter`.

`music.js` exports `initMusic(ctx, dest, noiseBuf, isUnlocked)` (called once from `ensureContext()` with `dest = limiter`), `setMusicOn(on)`,
`duckMusic(level, hold, relTau = 0.25)`, `musicStats()`. It listens to its own events (section 5) at module load and drives itself
with a 25 ms `setInterval` (section 3.7).

### 1.3 Measured levels (prototype, offline render, 44.1 kHz, mono)

| Scenario | Peak dBFS | max 300 ms RMS | Band RMS (300 ms max) |
|---|---|---|---|
| old coin ×10 | -8.7 | -20.1 | 2-5 kHz: **-17.2** |
| **new coin ×10** | **-15.0** | -26.6 | 2-5 kHz: **-26.5** (9.3 dB less harsh energy) |
| new coin, magnet 30 coins/s | -14.8 | -26.6 | rate cap holds the level |
| jump ×4 (existing SFX, reference) | -8.2 | -26.3 | 250-6000 Hz: -25.0 |
| menu theme | -9.1 | -21.3 | 250-6000 Hz: -27.0 |
| run tier 0 / 2 / 3 / 4 | -10.9 / -9.5 / -10.4 / -10.2 | -21.4 … -20.6 | 250-6000 Hz: -25.1 … -23.2 |
| run tier 4 + Venom | -9.5 | -20.3 | -23.2 |
| busiest: tier 4 + Venom + magnet + jumps + set stinger | **-5.2** | -17.3 | no clipping, limiter idle |
| record / closing / mission stinger | -4.7 / -15.4 / -18.5 | | |

So: music sits at about the level of a jump's body, effects peak 5-8 dB above it, coins are the quietest effect, nothing reaches
the limiter except rare stacked peaks. If the owner wants more or less music, change only `MUSIC_VOL` (0.10 … 0.20).

---

## 2. Coin sound

### 2.1 Why the old one hurts
Square wave at 988-3950 Hz (odd harmonics far into 5-15 kHz), plus a 0.26 s sine a fifth above at gain 0.22: loud, long, and a
square's buzz sits right in the ear's most sensitive band; at 10 coins/s the tails pile up into a whine.

### 2.2 New "pling"
Two sines per coin, a tiny pitch scoop (softens the onset), fast exponential decay, shared low-pass, level compensated per step
(higher notes sound louder to the ear, so they are played quieter).

| Part | Osc | Frequency | Envelope (gain param) | Stop |
|---|---|---|---|---|
| body | sine | `f * 0.985` at t, `linearRampToValueAtTime(f, t + 0.010)` | `setValueAtTime(0,t)`, `linearRamp(P, t+0.004)`, `setTargetAtTime(0, t+0.004, 0.030)` | t + 0.14 |
| shine | sine | `2 f` | `setValueAtTime(0,t)`, `linearRamp(P*0.18, t+0.002)`, `setTargetAtTime(0, t+0.002, 0.016)` | t + 0.08 |

`P = 0.12 * COIN_COMP[step]`. Both gains → `coinIn`. Audible length ≈ 120 ms (-35 dB at 0.12 s). Voice cost **2**, low priority
(`claim(true, 2)` in the existing SFX pool: skipped above 14 voices). Release: `body.onended` disconnects all four nodes and calls the
existing `release(nodes, 2)`.

### 2.3 Ladder (A minor pentatonic = C major pentatonic, in key with the music)

| step | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| note | A5 | C6 | D6 | E6 | G6 | A6 | C7 | D7 |
| MIDI `COIN_MIDI` | 81 | 84 | 86 | 88 | 91 | 93 | 96 | 98 |
| Hz (`hz(m) = 440·2^((m−69)/12)`) | 880.00 | 1046.50 | 1174.66 | 1318.51 | 1567.98 | 1760.00 | 2093.00 | 2349.32 |
| `COIN_COMP` | 1.00 | 0.95 | 0.90 | 0.86 | 0.81 | 0.77 | 0.73 | 0.70 |

Rules (`coinNext(st, now)` in `audio-logic.js`, port verbatim from the prototype; `st = { streak: 0, lastCoin: -10, lastPlay: -10 }`):
1. If `now - st.lastCoin > COIN_RESET (0.6 s)`, `streak = 0`. Every coin event updates `lastCoin`, played or not.
2. Rate cap: if `now - st.lastPlay < COIN_GAP - 1e-4` (`COIN_GAP = 1/12 s`) return **-1** (no sound, streak does not advance).
3. Step: `streak < 8 ? streak : 4 + ((streak - 8) % 4)` then `streak++`. After the top it keeps sparkling over the top four steps
   (G6 A6 C7 D7 …) instead of hammering one note.

`now` is `ctx.currentTime`. In `audio.js` `SOUNDS.coin()` becomes: `const i = coinNext(coinState, ctx.currentTime); if (i >= 0) coinVoice(i);`.
Delete `coinCombo`, `lastCoinAt` and the `coin: 0.025` entry of `MIN_GAP`.

---

## 3. Music

### 3.1 Key, grid, tempo

| | Menu | Run |
|---|---|---|
| Key | A minor (chords from C major / A minor) | A minor |
| Grid | 16 steps per 4/4 bar (16th notes), 8-bar loop | 16 steps per bar, 8-bar phrase, layer entrances on 4-bar boundaries |
| Tempo | 84 BPM fixed | `bpmFor(naturalSpeed)`: 112 at 11 m/s → 122 at 26 → 128 at 39 |
| Swing | 0.58 (odd 16ths late by `(0.58-0.5)*2*stepDur`) | none (0.5) |
| Step duration | `15 / bpm` s | same, re-read at every bar start only |

```
bpmFor(s) = round2( 112 + 10*clamp01((s-11)/15) + 6*clamp01((s-26)/13) )   // round2 = round to 0.5
```

`naturalSpeed` is `game.naturalSpeed` (un-boosted: the Iron Man jet's 800 m/s must not jump the tier).

### 3.2 Chords (MIDI)

| Name | Bass root | Voicing (stabs / EP) |
|---|---|---|
| Am | 45 (A2 110 Hz) | 57 60 64 |
| F | 41 (F2 87 Hz) | 57 60 65 |
| C | 48 (C3 131 Hz) | 55 60 64 |
| G | 43 (G2 98 Hz) | 55 59 62 |
| Em | 40 (E2 82 Hz) | 55 59 64 |
| Fmaj7 | 41 | 53 57 60 64 |
| Em7 | 40 | 52 55 59 62 |
| Dm7 | 38 | 50 53 57 60 |
| Am7 | 45 | 55 57 60 64 |

Run bars 1-8: **Am F C G | F G Em Am**. Menu bars 1-8: **Fmaj7 Em7 Dm7 Am7 | Fmaj7 Em7 Dm7 Am7**.

### 3.3 Patterns (port verbatim from the prototype into `audio-logic.js`)

Drum arrays are 16 velocities (0 = silent). Note lists are `[step, value, lengthInSteps, velocity]`.

| Name | Data |
|---|---|
| `KICK_A` (tier 0-2) | `1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0` |
| `KICK_B` (tier 3+) | `1,0,0,0, 0,0,0,0.6, 1,0,0.7,0, 0,0,0,0` |
| `SNARE` | `0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0.25` |
| `FILL` (bar 8, steps 12-15, tier 1+) | snare velocities `0.45, 0.6, 0.75, 0.95`; on those steps no regular snare and no hats |
| `HAT_A` (tier 0-2, 8ths) | `0.45,0,0.8,0, 0.45,0,0.8,0, 0.45,0,0.8,0, 0.45,0,0.8,0` |
| `HAT_B` (tier 3+, 16ths) | `0.7,0.3,0.9,0.3, 0.7,0.3,0.9,0.3, 0.7,0.3,0.9,0.3, 0.7,0.3,0,0.3` + open hat on step **14** vel 0.7 |
| `BASS_A` (tier 0-2) `[step, semitones above root, len, vel]` | `[0,0,2,1] [3,0,1,.7] [6,12,1,.8] [8,0,2,1] [11,0,1,.7] [14,7,2,.8]` |
| `BASS_B` (tier 3+) | `[0,0,2,1] [3,0,1,.7] [4,12,1,.8] [6,0,1,.7] [8,0,2,1] [10,12,1,.8] [11,0,1,.7] [13,7,1,.75] [14,12,2,.85]` |
| `STABS` (tier 1+) `[step, len, vel]`, all chord tones | `[2,1,.9] [6,1,.7] [10,1,.9] [13,2,.8]` |
| `ARP_ORDER` (tier 4, every step) | `0,1,2,3,2,1,0,1, 2,3,2,1,0,1,2,3` into `[tone0+12, tone1+12, tone2+12, tone0+24]`, vel 0.9 on steps 0/4/8/12 else 0.6 |
| `M_KICK` (menu, ×0.7) | `1,0,0,0, 0,0,0,0, 0,0,0.7,0, 0,0,0,0` |
| `M_RIM` | `0,0,0,0, 0.8,0,0,0, 0,0,0,0, 0.8,0,0,0` |
| `M_HAT` | `0.35,0,0.2,0, 0.35,0,0.2,0, 0.35,0,0.2,0, 0.35,0,0.2,0.15` |
| `M_BASS` (soft bass) | `[0,0,6,.9] [10,7,2,.7] [14,12,2,.6]` |
| menu EP | every bar on step 0: all chord tones, strummed `+0.018 s` per note (low to high), length 15 steps, vel 0.8 |

**Run lead** (`LEAD[bar]`, `[step, MIDI, len]`, vel 1):

| Bar (chord) | Notes |
|---|---|
| 1 Am | `[0,76,2] [3,81,1] [4,79,2] [6,76,2] [10,74,1] [11,76,3]` |
| 2 F | `[0,72,2] [3,77,1] [4,76,2] [6,72,2] [8,69,2] [11,72,1] [12,74,4]` |
| 3 C | `[0,76,2] [3,79,1] [4,84,2] [6,83,1] [7,79,1] [8,76,4] [12,79,2] [14,81,2]` |
| 4 G | `[0,79,3] [3,74,1] [4,74,2] [6,71,2] [8,74,6] [14,76,1] [15,79,1]` |
| 5 F | `[0,81,2] [3,84,1] [4,81,2] [6,77,2] [8,76,2] [10,77,1] [11,76,1] [12,72,4]` |
| 6 G | `[0,74,2] [3,79,1] [4,83,2] [6,79,2] [8,86,4] [12,84,2] [14,83,2]` |
| 7 Em | `[0,83,2] [3,79,1] [4,76,2] [6,71,2] [8,74,2] [10,76,2] [12,79,2] [14,83,2]` |
| 8 Am | `[0,81,6] [8,76,2] [11,79,1] [12,81,4]` |

**Menu music box** (`BOX[bar]`, vel 1):

| Bar (chord) | Notes |
|---|---|
| 1 Fmaj7 | `[0,81,3] [3,79,1] [4,76,4] [10,72,2] [12,74,4]` |
| 2 Em7 | `[0,79,6] [8,74,2] [10,76,2] [12,71,4]` |
| 3 Dm7 | `[0,77,3] [3,76,1] [4,72,4] [10,69,2] [12,72,4]` |
| 4 Am7 | `[0,76,8] [12,74,2] [14,72,2]` |
| 5 Fmaj7 | `[0,69,2] [2,72,2] [4,77,2] [6,76,2] [8,72,8]` |
| 6 Em7 | `[0,71,2] [2,74,2] [4,79,4] [10,76,2] [12,74,4]` |
| 7 Dm7 | `[0,72,2] [2,74,2] [4,77,2] [6,81,2] [8,79,4] [12,77,4]` |
| 8 Am7 | `[0,76,12]` |

Menu drums play only from bar 5 of the first loop on (`bar >= 4`): the first 11 s are piano, music box, bass and crackle.

### 3.4 Tiers and layers

| Tier | `naturalSpeed` | Reached after (run time) | Layers added |
|---|---|---|---|
| 0 | < 13.5 | 0 s | kick A, snare, 8th hats, bass A |
| 1 | ≥ 13.5 | ~17 s | chord stabs, bar-8 snare fill |
| 2 | ≥ 17 | ~40 s | **lead** |
| 3 | ≥ 22 | ~73 s | kick B, 16th hats + open hat, bass B |
| 4 | ≥ 32 | ~8.8 min | arpeggio, lead "sparkle" octave, crash on every bar 1 of the 8-bar phrase |

`TIER_SPEEDS = [13.5, 17, 22, 32]`, `tierFor(s) = TIER_SPEEDS.filter(v => s >= v).length`.
`layersFor(t) = { fill: t>=1, stabs: t>=1, lead: t>=2, kickB: t>=3, hatsB: t>=3, bassB: t>=3, arp: t>=4, sparkle: t>=4, crash8: t>=4 }`.
`layersFor` is pure. On low-end phones (`navigator.hardwareConcurrency <= 4`) `music.js` plays the arp only if `layers.arp && !LOW_END`.

**Entrance** (the "level up" moment), checked inside the run song's step function, `want = tierFor(game.naturalSpeed)`:
- `want > tier && bar % 4 === 3 && step === 12` → riser (4 steps long) on the drums layer.
- `want > tier && bar % 4 === 0 && step === 0` → `tier = want`, crash vel 1 on the drums layer. The new patterns start on this
  same step. No gain fades: layers start on the downbeat, which is how a band brings in an instrument.
- The run song's first bar uses `tier = tierFor(naturalSpeed)` directly (no riser).
- Tiers never go down inside a run.

### 3.5 Instruments (port verbatim from `I` in the prototype)

`perc(p,t,peak,att,tau)` = `setValueAtTime(0,t); linearRampToValueAtTime(peak,t+att); setTargetAtTime(0,t+att,tau)`.
`adsr(p,t,peak,att,sus,dTau,tOff,rTau)` = as perc, then `setTargetAtTime(peak*sus, t+att, dTau); setTargetAtTime(0, tOff, rTau)`.
Every gain node starts at `gain.value = 0`. "cost" = sources in the voice = what it claims from the music pool.

| Instrument | Sources | Filter | Envelope | Stop | Cost / prio | Phone notes |
|---|---|---|---|---|---|---|
| kick | sine 150→48 Hz (exp, 0.10 s) peak 0.55·v; triangle 220→110 (exp, 0.03 s) peak 0.35·v | – | perc att 2 ms τ 70 ms; knock att 1 ms τ 18 ms | +0.30 / +0.12 | 2 / 0 | the 220 Hz knock + `dSat` harmonics are what a phone hears |
| snare | noise; triangle 210→165 (0.06 s) | noise: bandpass 1900 Q 0.9 | noise peak 0.42·v τ 55 ms; body 0.28·v τ 40 ms | +0.30 / +0.20 | 2 / 0 | |
| rim (menu) | noise; triangle 420 | bandpass 2600 Q 3 | 0.16·v τ 12 ms; 0.12·v τ 20 ms | +0.10 / +0.12 | 2 / 0 | |
| hat | noise | highpass 7000 Q 0.7 | closed 0.10·v τ 12 ms; open 0.08·v τ 70 ms | +0.08 / +0.40 | 1 / 3 | above the harsh band, low level |
| crash | noise | highpass 4500 Q 0.5 | 0.11·v att 2 ms τ 450 ms | +1.6 | 1 / 0 | |
| riser | noise | bandpass Q 2.5, 700→5500 Hz exp over dur | linear 0→0.07 over dur, →0 in 20 ms | +dur+0.05 | 1 / 3 | |
| bass | saw f; square f +6 cents ×0.45; sine f (sub) | saw+square: lowpass Q 3.5, start `min(14f,1800)`, `setTargetAtTime(max(5f,420), t+5ms, 0.09)` | adsr 0.30·v, att 4 ms, sus 0.65, dτ 0.12, rτ 0.03; sub 0.18·v same | gate +0.15 | 3 / 1 | 82-131 Hz roots are inaudible on phones: the saw/square harmonics 250-1500 Hz through `bSat` carry the pitch (missing-fundamental effect); the sub sine is for headphones |
| bass soft (menu, closing) | saw f; sine f | lowpass Q 1, start `min(6f,1800)` → `max(3.5f,300)` | adsr 0.22·v …; sub 0.18·v | gate +0.15 | 2 / 1 | |
| lead | 2 saws ±7 cents | lowpass Q 1.0, 3400 → `setTargetAtTime(1900, t, 0.15)` | adsr 0.13·v, att 8 ms, sus 0.6, dτ 0.18, rτ 0.06 | gate +0.30 | 2 / 2 | output also to `echoIn`; notes ≥ 0.35 s get vibrato: LFO sine 5.5 Hz, depth 0 until +0.18 s, ramps to `f*0.0045` Hz (≈ 8 cents) by +0.30 s, into both saw frequencies; tier 4 "sparkle": + sine 2f at 0.25 into the same amp |
| stab | saw | lowpass Q 2, 3200 → τ 0.05 → 650 | perc 0.07·v att 3 ms τ 80 ms | +0.40 | 1 / 3 | also to `echoIn` |
| arp | triangle | – | perc 0.06·v att 2 ms τ 60 ms | +0.30 | 1 / 3 | |
| ep (FM piano) | carrier sine f, modulator sine f → mod gain (Hz) `1.8f` → τ 0.25 → `0.3f`, into carrier.frequency | – | adsr 0.075·v, att 6 ms, sus 0, dτ 1.2, rτ 0.25 | gate +0.8 | 2 / 3 | |
| box (music box) | sine f; sine 2f | – | f: perc 0.085·v τ 0.32; 2f: perc 0.0187·v τ 0.12 | +1.6 / +0.8 | 2 / 3 | |
| bell (missions) | carrier sine f, modulator sine 3.5f, mod gain `1.2f` → τ 0.08 → 0 | – | perc 0.12·v att 2 ms τ 0.35 | +2.0 | 2 / 0 | |
| drone (tension) | 2 saws at MIDI 45 (110 Hz) and 46 (116.54 Hz): 6.5 Hz beating | lowpass Q 5: 380 → linear 950 at mid-bar → 380 at bar end | 0 → 0.075 linear in 0.15 s, hold, `setTargetAtTime(0, end-0.05, 0.08)` | bar +0.3 | 2 / 3 | harmonics up to 950 Hz are the audible part |
| heart (tension) | sine 95→52 (0.12 s); sine 190→110 (0.08 s) | – | 0.5·v τ 80 ms; 0.22·v τ 50 ms | +0.40 / +0.30 | 2 / 1 | the 190 Hz partial is the one a phone plays |
| crackle (menu) | one looping BufferSource of the crackle buffer | highpass 1000 Q 0.7 | constant gain 0.09 | stopped when the menu song stops | not pooled (1 persistent source) | ~22 clicks/s, the vinyl texture |

Destinations: kick/snare/rim/hat/crash/riser → layer `drums`; bass → `bass`; stab, ep → `chords`; lead, box → `lead`; arp → `arp`;
drone, heart → `tension`; crackle → `crackle`; all stinger notes → `stingerGain` (stinger voices use prio 0 everywhere, bass prio 1).

### 3.6 Voice pools and node release

| Pool | Max cost | Rule |
|---|---|---|
| SFX (existing `claim/release` in audio.js) | 24 (`MAX_VOICES`), low-priority sounds only up to 14 (`SOFT_VOICES`) | unchanged; coin uses `claim(true, 2)` |
| Music (`new VoicePool(max, [0, 4, 8, 12, 16])`) | **44**, low-end phone **36** (`musicPoolMax(cores) = cores <= 4 ? 36 : 44`, cores = `navigator.hardwareConcurrency || 8`) | `claim(prio, cost)` succeeds only if `used + cost <= max - reserve[prio]`; a refused note is simply not played |

Simulated over 16 bars of tier 4 + Venom with the release times above: peak 32 cost, **0 notes dropped** at 44; at 36 only arp/hat
notes drop (that is why low-end phones lose the arp). Hard cap overall: 44 + 24 = 68 sources.

Release rule (port `voice()` verbatim): every voice gives each source a `stop()` time when it is created; the last source's `onended`
disconnects **every** node of the voice and calls `pool.release(cost)`. `release` never goes below 0. Persistent nodes (built once,
never per note): the graph in 1.2 and the crackle source while the menu plays. The crackle source is stopped with `stop()` and its
three nodes disconnected when the menu song ends. Nothing else may be created outside `voice()`.
`audioStats()` (audio.js) returns `{ sfx: voices, music: musicStats() }`, `musicStats()` returns `{ used: pool.used, scene, tier, bpm }`:
the 20-minute check reads these.

### 3.7 Sequencer and scheduler (`music.js`)

`Seq` class: port verbatim from the prototype (`start(t)`, `run(until)`, step 0 re-reads `song.bpm()`, swing offset on odd steps).

```js
const LOOKAHEAD = 0.12, TICK_MS = 25;
setInterval(tick, TICK_MS);
function tick() {
  if (!ctx || ctx.state !== 'running' || !isUnlocked()) return;   // no sound before the first tap
  const want = musicScene(game.state.mode, game.state.intro);
  if (want !== 'hold' && want !== scene) changeScene(want);
  if (scene === 'over' && !overMenu && ctx.currentTime > overT + 7) { overMenu = true; startSong('menu', ctx.currentTime + 0.05); }
  if (!musicOn || !seq) return;
  seq.next = resyncTime(seq.next, ctx.currentTime);               // after a throttled timer: skip, never burst
  seq.run(ctx.currentTime + LOOKAHEAD);
}
```

`isUnlocked` is the 4th argument of `initMusic`: `audio.js` calls `initMusic(ctx, limiter, noiseBuf, () => unlocked)` (`unlocked` turns
true in the first gesture handler). `music.js` never imports `audio.js` (no import cycle).

`musicScene(mode, intro)`: `'menu'` → `'menu'`; `'running'` with `intro` → `'silent'`; `'running'` → `'run'`; `'over'` → `'over'`;
`'paused'` → `'hold'` (keep whatever plays; the context is suspended anyway).
`resyncTime(next, now) = next < now - 0.05 ? now + 0.05 : next`.

### 3.8 Scenes and fades

`changeScene(to)` (always: `seq = null`, crackle stop at `now + 1.0`, tension off instantly, `overMenu = false`):

| to | Action |
|---|---|
| `menu` | fade: `cancelScheduledValues(now)`, `setValueAtTime(fade.gain.value, now)`, `setTargetAtTime(0, now, 0.25)`; then `startSong('menu', now + (scene === 'none' ? 0.05 : 1.0))` |
| `silent` (intro) | fade to 0 with τ 0.25 (≈ 0.8 s) |
| `run` | `startSong('run', now + 0.35)` (after the start jingle) |
| `over` | fade to 0 with τ 0.1; `overT = now`; game-over stinger is decided by the events (3.10) |

`startSong(kind, t)`: `musicLP.frequency.cancelScheduledValues(t); setValueAtTime(16000, t)`; duck back to 1; fade
`setValueAtTime(0, t)` then `setTargetAtTime(SCENE_GAIN[kind], t, kind === 'menu' ? 0.8 : 0.01)` (menu fades in over ≈ 2.5 s, run
starts at full); for the menu also start the crackle at `t` (only if `musicOn`); `song = kind === 'menu' ? menuSong() : runSong()`;
`seq = new Seq(song); seq.start(t)`. Then `scene = to` (for the over-menu case scene stays `'over'`).

Music toggled on while `scene` is menu-like and no crackle runs → start the crackle. Music toggled off → `musicGain` to 0 (τ 0.03),
the scheduler stops creating notes; on again, `resyncTime` jumps the sequencer to now.

**Caught** (`caught` event, scene `run`): `musicLP.frequency`: `cancelScheduledValues(now)`, `setValueAtTime(current, now)`,
`exponentialRampToValueAtTime(300, now + 0.45)`; `duckMusic(0.5, 0.6)`. The music sounds like it is swallowed. `gameover` follows
0.35 s later and the over-scene fade ends it.

### 3.9 Ducking

`duckMusic(level, hold, relTau = 0.25)` on the `duck` node: if `!shouldDuck({ level: duckLevel, until: duckUntil }, now, level)` return;
else `duckLevel = level; duckUntil = now + hold; p.cancelScheduledValues(now); p.setValueAtTime(p.value, now);
p.setTargetAtTime(level, now, 0.01); p.setTargetAtTime(1, now + hold, relTau)`.
`shouldDuck(cur, now, level) = now >= cur.until || level <= cur.level` (a deeper duck always wins; a shallower one waits).

| Trigger | level | hold (s) | Where |
|---|---|---|---|
| SFX `crash`, `caught`, `hulkSmash`, `venomBlastNova` | 0.45 | 0.25 | `audio.js` `play()`: `const d = DUCK_SFX[name]; if (d) duckMusic(d, 0.25);` |
| SFX `ironSave`, `hulkRoar` | 0.5 | 0.25 | same table |
| SFX `capShieldGong`, `milesVenomBlast` | 0.55 | 0.25 | same table |
| pickup stinger | 0.6 | 0.30 | music.js (instead of the prototype's two `duck.gain` lines) |
| mission done / set stinger | 0.55 | 0.6 / 1.0 | music.js |
| Venom near | – | – | not a duck: lead layer gain ×0.5, chords ×0.7 (`setTarget… τ 0.2`), back to 1 on far |

`DUCK_SFX = { crash: 0.45, caught: 0.45, hulkSmash: 0.45, venomBlastNova: 0.45, ironSave: 0.5, hulkRoar: 0.5, capShieldGong: 0.55, milesVenomBlast: 0.55 }`.

### 3.10 Tension and stingers

**Tension** (scene `run` only): `venomNear` → `tension = true`, `layer.tension` `setTargetAtTime(1, now, 0.17)` (≈ 0.5 s in), lead/chords
step back (3.9). `venomFar` → `tension = false`, tension layer `setTargetAtTime(0, now, 0.6)` (≈ 2 s out). While `tension` is true the
run song plays: drone on step 0 of every bar (bar long), heart vel 1 on steps 0 and 8, vel 0.65 on steps 3 and 11 ("lub-dub").
Any scene change sets the tension layer to 0 at once and `tension = false` (a restart while Venom was near must not keep it).

**Stingers** (only when `musicOn`; all through `stingerGain`; port the `ST` functions verbatim except the duck lines):

| Stinger | Event | When | Content |
|---|---|---|---|
| power-up | `pickup` (any type), scene `run`, `stingerReady(lastPickupAt, now)` = `now - lastPickupAt >= 2.0` | `song.pickupAt = now + 0.30`; the run song fires it on the first even step whose time ≥ pickupAt; `duckMusic(0.6, 0.30)` at `now` | crash vel 0.8, kick vel 0.8, a stab of the **current bar's** chord one octave up, vel 1. It answers the pickup's own effect jingle a beat later and is always in key. |
| mission done | `missionDone` | `ctx.currentTime + 0.02`, through a 0 ms timer so several `missionDone` in one frame give one stinger | bells C6 E6 G6 C7 at +0, 0.08, 0.16, 0.24 s, vel 0.9/0.9/0.9/1.1 |
| set done (multiplier up) | `missionSet` | clears the pending mission timer, plays instead | mission bells + at +0.36 s: crash, bass C3 0.4 s, lead C5 E5 G5 C6 0.45 s vel 0.8 |
| new record | `newRecord` (new, 5.2) | clears the pending game-over timer; `t = now + 0.35` | 2.6 s fanfare: lead A4 C5 E5 (triplet) → A5, G5 A5 → C6 → **C#6** (A major ending), stabs Am G F **A**, kicks on each beat, crash, bells A6+E6 |
| closing phrase | `gameover` | `overTimer = setTimeout(() => play closing at now + 0.6, 0)`; `newRecord` in the same dispatch cancels it | 5.5 s: EP Fmaj7 → E7sus4 → E7 → Am(add9), music box E5 D5 C5 B4 G#4 A4 (+A5), soft bass F2 E2 A2 |

Mission stingers also `duckMusic(0.55, 0.6)` (set: hold 1.0) when scene is `run`.
When music is on, the old SFX `gameover` jingle is skipped: in `audio.js` `play()`: `if (name === 'gameover' && musicOn()) return;`.
After the over phrase the menu theme comes back by itself after 7 s (3.7) if the player is still on the game-over screen.

---

## 4. Controls

### 4.1 Settings (in `audio-logic.js`, port these exactly)

```js
export const KEY_MUSIC = 'spidey.music', KEY_SFX = 'spidey.sfx', KEY_MUTED_OLD = 'spidey.muted';
export function loadSettings(get) {            // get(key) -> string | null
  const old = get(KEY_MUTED_OLD) === '1';
  const pick = (k) => { const v = get(k); return v === '1' ? true : v === '0' ? false : !old; };
  return { music: pick(KEY_MUSIC), sfx: pick(KEY_SFX) };
}
export function saveSettings(set, s) {         // set(key, value)
  set(KEY_MUSIC, s.music ? '1' : '0');
  set(KEY_SFX, s.sfx ? '1' : '0');
  set(KEY_MUTED_OLD, !s.music && !s.sfx ? '1' : '0');   // an older build opened later still respects "all off"
}
```

`audio.js` wraps localStorage with try/catch like today (`get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }`).
Old saves: `spidey.muted = '1'` → both off; `'0'` or missing → both on; once a new key exists it wins. Garbage values fall back to the old key.

`audio.js` exports (replacing `setMuted` / `isMuted`): `isMusicOn()`, `setMusicOn(v)`, `isSfxOn()`, `setSfxOn(v)`. `setSfxOn` sets the
`master` gain like `applyMasterGain()` does today (`sfx ? MASTER_VOL : 0`); `play()` returns early when `!sfx` (replaces the `muted` check).
`setMusicOn` calls `music.js` `setMusicOn`. Both save immediately.

### 4.2 UI

- `index.html` line ~158 (menu): remove the `data-mute` button from the first `.row`; add after the second `.row`:
  `<div class="row"><button class="btn small yellow" type="button" data-music aria-pressed="true">MÜZİK: AÇIK</button><button class="btn small yellow" type="button" data-sfx aria-pressed="true">EFEKT: AÇIK</button></div>`
- `index.html` line ~230 (pause card): replace the `data-mute` button with the same `<div class="row">…</div>`.
- `ui.js`: import `{ isMusicOn, setMusicOn, isSfxOn, setSfxOn }`; replace `muteButtons` / `paintMute` with:

```js
const musicButtons = Array.from(document.querySelectorAll('[data-music]'));
const sfxButtons = Array.from(document.querySelectorAll('[data-sfx]'));
function paintToggle(list, on, label) {
  const text = `${label}: ${on ? 'AÇIK' : 'KAPALI'}`;
  for (const b of list) { if (b.textContent !== text) b.textContent = text; b.setAttribute('aria-pressed', String(on)); }
}
function paintSound() { paintToggle(musicButtons, isMusicOn(), 'MÜZİK'); paintToggle(sfxButtons, isSfxOn(), 'EFEKT'); }
for (const b of musicButtons) onButton(b, () => { setMusicOn(!isMusicOn()); paintSound(); });
for (const b of sfxButtons) onButton(b, () => { setSfxOn(!isSfxOn()); paintSound(); });
paintSound();
```
- `audio-test.html` lines 48/107/108: use `isSfxOn` / `setSfxOn` (button text unchanged).

### 4.3 Autoplay, hidden tab, pause

| Case | Rule (`audio.js`) |
|---|---|
| before the first gesture | `let unlocked = false;` set `true` inside `unlock()`; `play()` returns if `!unlocked`; the music tick returns if `!unlocked`. The context is still created suspended by `prepareAudio()`. |
| tab hidden / `pagehide` | `document.addEventListener('visibilitychange', …)`: hidden → `ctx.suspend()`; visible → `ctx.resume()` only if `!paused` (the game pauses itself on hide while running, so a run stays silent until DEVAM). `window.addEventListener('pagehide', () => ctx && ctx.suspend())`. |
| context interrupted (iOS call, Siri) | `ctx.onstatechange`: if state is not `'running'` and `!paused && !document.hidden`, add the unlock listeners again (today they are removed for good after the first success). |
| pause → ANA MENÜ | `game.toMenu()` now emits `menu`; `audio.js` listens: `paused = false; ctx.resume()` (today the menu would stay suspended). |
| suspended context | `ctx.currentTime` stops, so the scheduler (`seq.next < now + LOOKAHEAD`) schedules nothing; on resume `resyncTime` skips the missed steps. |

---

## 5. Integration map

### 5.1 Existing events used (names verified in the code)

| Event | Emitted in | Music / audio reaction |
|---|---|---|
| `start` | game.js `start()` / `restart()` | existing (paused=false, resume, start jingle); music changes scene by polling |
| `pause` / `resume` | game.js | existing suspend / resume of the whole context |
| `intro` `{phase}` | intro.js | existing SFX; music: `game.state.intro` polling → scene `silent` |
| `coin` | obstacles.js, powerups/magnet.js | new coin ladder + rate cap |
| `pickup` `{type}` | obstacles.js | existing SFX + power-up stinger |
| `venomNear` / `venomFar` | chaser.js | existing growl SFX + tension on / off |
| `caught` | chaser.js | existing SFX + duck + low-pass swallow |
| `crash`, `ironSave`, `hulkSmash`, `hulkRoar`, `venomBlastNova`, `capShieldGong`, `milesVenomBlast` | obstacles.js, ironspider.js, hero-specials.js | existing SFX + `DUCK_SFX` |
| `gameover` | game.js `gameOver()` | closing phrase (unless `newRecord`), old SFX jingle skipped when music is on |
| `missionDone` / `missionSet` | missions.js `onDone()` | mission stingers |

### 5.2 New events

| Event | Emit where (exact) | Listener |
|---|---|---|
| `menu` | `game.js` `toMenu()`, after `state.mode = 'menu';`: `emit('menu');` | `audio.js`: `paused = false`, resume the context |
| `newRecord` `{score}` | `ui.js` gameover listener, right after `recordScore(e.detail \|\| {});`: `if (lastResult && lastResult.record) emit('newRecord', { score: lastResult.score });` (import `emit` from `./events.js`) | `music.js`: record fanfare instead of the closing phrase |

Add both to the comment list in `events.js`.

### 5.3 Polled state (no event exists, none needed)
`game.state.mode`, `game.state.intro` (scene), `game.naturalSpeed` (tier, BPM). Read in the 25 ms tick and in the run song's step.

---

## 6. Ordered coding tasks

Each task leaves the game working. Run `node tools/test-skills.mjs` after each. Line counts are estimates.

| # | Task | Files | ≈ lines |
|---|---|---|---|
| 1 | **Two toggles + gates.** `audio-logic.js` with settings (4.1); `audio.js`: settings, `isMusicOn/setMusicOn/isSfxOn/setSfxOn` (music flag stored only, no music yet), `unlocked` gate, visibility/pagehide/onstatechange (4.3), `menu` listener; `game.js` `emit('menu')`; `events.js` comment; `ui.js` + `index.html` toggles (4.2); `audio-test.html`. | audio-logic, audio, game, events, ui, index.html, audio-test.html, test-skills | 150 |
| 2 | **Coin.** `COIN_MIDI`, `COIN_COMP`, `COIN_RESET`, `COIN_GAP`, `hz`, `coinNext` in audio-logic; `audio.js`: limiter + `out` (1.2), `coinIn`/`coinLP`, `coinVoice(step)` (2.2), new `SOUNDS.coin`, delete old coin state and `MIN_GAP.coin`. | audio-logic, audio, test-skills | 90 |
| 3 | **Music graph + instruments.** `VoicePool`, `musicPoolMax` in audio-logic; `music.js`: `initMusic(ctx, dest, noiseBuf, isUnlocked)` builds every music node of 1.2, crackle buffer, `voice()`, helpers, all instruments of 3.5 (port `I`), `setMusicOn`, `duckMusic` + `shouldDuck`, `musicStats`; `audio.js` calls `initMusic` from `ensureContext()`, `DUCK_SFX` in `play()`, `audioStats()`. No songs yet. | audio-logic, music, audio, test-skills | 290 |
| 4 | **Sequencer + menu theme.** Menu data (`CH`, `MENU_BARS`, `M_*`, `BOX`) and `musicScene`, `resyncTime` in audio-logic; `music.js`: `Seq`, tick + `setInterval`, `changeScene` / `startSong` (3.7, 3.8), crackle start/stop, `menuSong`. | audio-logic, music, test-skills | 220 |
| 5 | **Run theme.** Run data (`RUN_BARS`, `KICK_*`, `SNARE`, `FILL`, `HAT_*`, `BASS_*`, `STABS`, `ARP_ORDER`, `LEAD`), `TIER_SPEEDS`, `tierFor`, `bpmFor`, `layersFor` in audio-logic; `music.js`: `runSong` using `layersFor` and `game.naturalSpeed`, entrances (riser/crash), echo time per bar, low-end arp off, caught swallow (3.8). | audio-logic, music, test-skills | 200 |
| 6 | **Tension + stingers.** `stingerReady` in audio-logic; `music.js`: tension on/off (3.10), pickup / mission / set / record / closing stingers, the 0 ms timers, over → menu after 7 s; `ui.js` `newRecord` emit; `audio.js` skip SFX `gameover` when music is on. | audio-logic, music, ui, audio, events, test-skills | 200 |
| 7 | **QA (Sonnet, browser + phone).** Section 8 checklist. No code unless a check fails. | – | – |

---

## 7. Assert checks per task (append to `tools/test-skills.mjs` before the final `console.log`)

Import once: `const AL = await import('../src/audio-logic.js');` (pure module, works in node).

**Task 1 (settings, `menu` event)**
```js
const kv = (o) => (k) => (k in o ? o[k] : null);
eq(json(AL.loadSettings(kv({}))), json({ music: true, sfx: true }), 'no save: music and effects on');
eq(json(AL.loadSettings(kv({ 'spidey.muted': '1' }))), json({ music: false, sfx: false }), 'old mute save: both off');
eq(json(AL.loadSettings(kv({ 'spidey.muted': '0' }))), json({ music: true, sfx: true }), 'old unmuted save: both on');
eq(json(AL.loadSettings(kv({ 'spidey.muted': '1', 'spidey.music': '1' }))), json({ music: true, sfx: false }), 'a new key beats the old one');
eq(json(AL.loadSettings(kv({ 'spidey.music': 'x' }))), json({ music: true, sfx: true }), 'garbage falls back');
const saved = {}; AL.saveSettings((k, v) => { saved[k] = v; }, { music: false, sfx: true });
eq(json(saved), json({ 'spidey.music': '0', 'spidey.sfx': '1', 'spidey.muted': '0' }), 'save writes both keys + legacy');
AL.saveSettings((k, v) => { saved[k] = v; }, { music: false, sfx: false });
eq(saved['spidey.muted'], '1', 'all off keeps the legacy mute key');
eq(json(AL.loadSettings(kv(saved))), json({ music: false, sfx: false }), 'save -> load round trip');
let menuSeen = 0; events.addEventListener('menu', () => menuSeen++);
game.state.mode = 'over'; game.toMenu();
eq(menuSeen, 1, 'toMenu emits menu'); eq(game.state.mode, 'menu', 'toMenu reaches the menu');
```

**Task 2 (coin ladder + cap)**
```js
const cs = () => ({ streak: 0, lastCoin: -10, lastPlay: -10 });
let s1 = cs(); const seqIdx = []; for (let i = 0; i < 12; i++) seqIdx.push(AL.coinNext(s1, i * 0.1));
eq(seqIdx.join(','), '0,1,2,3,4,5,6,7,4,5,6,7', 'ladder climbs 8 steps then sparkles on the top four');
eq(AL.coinNext(s1, 1.1 + 0.61), 0, 'a 0.61 s break starts again at step 0');
let s2 = cs(); let played = 0; for (let i = 0; i < 30; i++) if (AL.coinNext(s2, i / 30) >= 0) played++;
ok(played <= 12 && played >= 10, `30 magnet coins in 1 s play ${played} sounds (cap 12/s)`);
let s3 = cs(); const mag = []; for (let i = 0; i < 9; i++) { const k = AL.coinNext(s3, i / 30); if (k >= 0) mag.push(k); }
eq(mag.join(','), '0,1,2', 'skipped coins do not advance the ladder');
eq(AL.COIN_MIDI.length, 8, '8 ladder steps');
ok(AL.COIN_MIDI.every((m) => [9, 0, 2, 4, 7].includes(m % 12)), 'ladder is A minor pentatonic');
ok(Math.abs(AL.hz(AL.COIN_MIDI[0]) - 880) < 0.01 && Math.abs(AL.hz(AL.COIN_MIDI[7]) - 2349.32) < 0.01, 'ladder spans 880-2349 Hz');
ok(AL.COIN_COMP.every((c, i) => i === 0 || c < AL.COIN_COMP[i - 1]), 'higher steps play quieter');
```

**Task 3 (voice pool, ducking)**
```js
const vp = new AL.VoicePool(44, [0, 4, 8, 12, 16]);
let n = 0; while (vp.claim(4, 1)) n++;
eq(n, 28, 'lowest priority stops at max - 16');
ok(vp.claim(0, 2), 'top priority still gets a voice');
eq(vp.claim(3, 3), false, 'prio 3 is refused above max - 12');
for (let i = 0; i < 100; i++) vp.release(1);
eq(vp.used, 0, 'release never goes below 0');
for (let i = 0; i < 10000; i++) { if (vp.claim(i % 5, 1 + (i % 3))) vp.release(1 + (i % 3)); }
eq(vp.used, 0, '10000 claim/release cycles leak nothing');
eq(AL.musicPoolMax(4), 36, 'low-end phone pool'); eq(AL.musicPoolMax(8), 44, 'normal pool');
ok(AL.shouldDuck({ level: 0.6, until: 5 }, 4, 0.45), 'a deeper duck wins');
eq(AL.shouldDuck({ level: 0.45, until: 5 }, 4, 0.6), false, 'a shallower duck waits');
ok(AL.shouldDuck({ level: 0.45, until: 5 }, 5, 0.6), 'after the hold any duck applies');
```

**Task 4 (scenes, scheduler, menu data)**
```js
eq(AL.musicScene('menu', false), 'menu', 'menu scene');
eq(AL.musicScene('running', true), 'silent', 'intro is silent');
eq(AL.musicScene('running', false), 'run', 'run scene');
eq(AL.musicScene('paused', false), 'hold', 'pause keeps the scene');
eq(AL.musicScene('over', false), 'over', 'over scene');
eq(AL.resyncTime(10, 10.02), 10, 'on time: unchanged');
eq(AL.resyncTime(9, 10), 10.05, 'late: skip ahead, never burst');
const A_MINOR = [9, 11, 0, 2, 4, 5, 7];
for (const p of [AL.M_KICK, AL.M_RIM, AL.M_HAT]) eq(p.length, 16, 'menu drum pattern has 16 steps');
eq(AL.BOX.length, 8, 'music box has 8 bars'); eq(AL.MENU_BARS.length, 8, 'menu has 8 chords');
ok(AL.BOX.flat().every((x) => x[0] >= 0 && x[0] + x[2] <= 16 && A_MINOR.includes(x[1] % 12)), 'music box notes stay in their bar and in A minor');
ok(AL.MENU_BARS.every((c) => AL.CH[c]), 'every menu chord exists');
```

**Task 5 (tiers, tempo, run data)**
```js
eq(AL.tierFor(11), 0, 'start speed = tier 0'); eq(AL.tierFor(13.5), 1, 'tier 1 at 13.5');
eq(AL.tierFor(17), 2, 'tier 2 at 17'); eq(AL.tierFor(22), 3, 'tier 3 at 22'); eq(AL.tierFor(39), 4, 'top speed = tier 4');
eq(AL.bpmFor(11), 112, '112 BPM at start'); eq(AL.bpmFor(26), 122, '122 at cruise'); eq(AL.bpmFor(39), 128, '128 at top');
eq(AL.bpmFor(800), 128, 'a boost never runs the tempo away');
let lastB = 0; for (let s = 11; s <= 39; s += 0.5) { ok(AL.bpmFor(s) >= lastB, 'tempo never falls'); lastB = AL.bpmFor(s); }
eq(json(AL.layersFor(0)), json({ fill: false, stabs: false, lead: false, kickB: false, hatsB: false, bassB: false, arp: false, sparkle: false, crash8: false }), 'tier 0 layers');
ok(AL.layersFor(2).lead && !AL.layersFor(1).lead, 'the lead opens at tier 2');
ok(AL.layersFor(4).arp && !AL.layersFor(3).arp, 'the arp opens at tier 4');
for (const t of [1, 2, 3, 4]) ok(Object.keys(AL.layersFor(t)).every((k) => !AL.layersFor(t - 1)[k] || AL.layersFor(t)[k]), `tier ${t} keeps every lower layer`);
for (const p of [AL.KICK_A, AL.KICK_B, AL.SNARE, AL.HAT_A, AL.HAT_B, AL.ARP_ORDER]) eq(p.length, 16, 'run pattern has 16 steps');
eq(AL.LEAD.length, 8, 'lead has 8 bars'); eq(AL.RUN_BARS.length, 8, 'run has 8 chords');
ok(AL.LEAD.flat().every((x) => x[0] >= 0 && x[0] + x[2] <= 16 && A_MINOR.includes(x[1] % 12)), 'lead notes stay in their bar and in A minor');
ok([...AL.BASS_A, ...AL.BASS_B].every((x) => x[0] + x[2] <= 16), 'bass notes stay in their bar');
```

**Task 6 (stinger rate)**
```js
ok(AL.stingerReady(-10, 0), 'first pickup stinger plays');
eq(AL.stingerReady(5, 6.5), false, 'a second pickup within 2 s is quiet');
ok(AL.stingerReady(5, 7), 'after 2 s it plays again');
```

---

## 8. QA checklist (task 7, Sonnet)

1. `node tools/test-skills.mjs` passes; `node tools/check-patterns.mjs` still passes.
2. Fresh profile, load the game: silence until the first tap; menu theme fades in after the tap; console clean.
3. Toggles: MÜZİK off → music stops within 0.1 s, effects stay; EFEKT off → jumps/coins silent, music stays; both survive a reload;
   `localStorage['spidey.muted']='1'` with no new keys → both load off.
4. Start a run: menu fades during the intro, the run theme starts after the start jingle; with the speed raised in the console
   (`game.naturalSpeed = 17` etc.) layers enter on the next 4-bar boundary with a riser + crash.
5. Stumble → heartbeat + drone in ~0.5 s, melody softer; Venom falls back → gone in ~2 s. Caught → music "swallowed", closing phrase.
   Beat the top score → record fanfare instead.
6. Pickup → effect jingle, then the music's stab+crash a beat later; two pickups within 2 s → one stinger.
7. Hide the tab (menu and run) → silence; come back → menu resumes / run stays paused and silent until DEVAM. Pause → ANA MENÜ → menu theme plays.
8. Soak: a 20-minute run with `game.naturalSpeed` stepped to 39 (or long autoplay): every minute log
   `(await import('/src/audio.js')).audioStats()`; `music.used` stays ≤ 44 and returns to < 10 after a game over; `sfx` returns to 0;
   Chrome task manager memory flat (± 10 MB).
9. Owner listens on his phone: `tasarim/proto/ses.html` "Eski altın / Yeni altın" and the themes, before task 2 is merged if possible.

---

## 9. Not in this stage
Per-zone music (11.3 zones could later swap `RUN_BARS` / lead), stereo panning (phones are mono), a volume slider, separate stinger toggle.
