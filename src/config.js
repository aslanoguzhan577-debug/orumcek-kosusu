// config.js — every tunable number of the game lives here (G1 owns, others add keys).
// Units: metres, seconds, m/s. Forward is -Z, the world scrolls toward +Z.

export const CONFIG = {
  // --- Lanes ---
  laneCount: 3,
  laneWidth: 2.2,          // distance between lane centres
  laneSwitchTime: 0.14,    // seconds for one lane change (works mid-air too)

  // --- Speed and score ---
  // Three phases: start -> cruiseSpeed quickly (~100 s), then slowly on to maxSpeed (~8.8 min),
  // then creeping on to topSpeed, the hard cap (~18.5 min).
  startSpeed: 11,          // m/s at run start
  cruiseSpeed: 26,         // end of the first phase
  maxSpeed: 32,            // second phase end (fx / run cadence treat this as "full speed")
  topSpeed: 39,            // hard cap, end of the third phase
  acceleration: 0.15,      // m/s gained per second, first phase
  acceleration2: 0.014,    // m/s gained per second, second phase
  acceleration3: 0.012,    // m/s gained per second, third phase
  boostFadeTime: 0.6,      // s: a skill's speed boost eases back to the natural speed
  scorePerMeter: 1,

  // --- Player body / hitbox ---
  playerHeight: 1.6,       // models are built to about this height
  playerWidth: 0.7,
  playerDepth: 0.6,
  slideHeight: 0.75,       // hitbox height while sliding

  // --- Jump, gravity, slide ---
  gravity: 42,             // m/s^2
  jumpHeight: 1.5,         // apex height of a normal jump
  fastDropSpeed: 28,       // downward speed when "down" is pressed mid-air
  slideAfterDrop: true,    // a fast drop turns into a slide on landing
  jumpBufferHeight: 0.6,   // "up" pressed while falling this close to the floor = jump on landing
  coyoteTime: 0.12,        // "up" this soon after running off a roof edge = normal jump, not a web
  slideDuration: 0.7,
  slideRecover: 0.25,      // s he stands up before the next slide can start (a press in it is remembered)

  // --- Input ---
  input: {
    swipeThreshold: 28,    // px of finger travel before a swipe fires
    tapSlop: 12,           // px a tap may move and still count as a tap
    tapMaxTime: 0.3,       // s a tap may last
    doubleTapWindow: 0.3,  // s between two taps for a double tap
    doubleTapDistance: 60, // px the two taps may be apart
  },

  // --- Camera (offsets are relative to the player) ---
  camera: {
    fov: 60,               // vertical FOV in landscape
    fovPortrait: 60,       // vertical FOV in tall portrait (narrower = flatter, bigger hero)
    portraitAspect: 0.46,  // aspect at which the portrait values fully apply
    height: 3.4,           // above the player's floor
    distance: 6.2,         // behind the player (+Z)
    lookAhead: 7,          // look at a point this far ahead (-Z)
    lookHeight: 0.9,
    followX: 0.55,         // fraction of player x the camera follows (landscape)
    followXPortrait: 0.3,  // ... in portrait
    followBlocked: 0.7,    // ... while a tall obstacle (train, wagon) stands between the
                           // camera and the player (side lane, train in the middle)
    blockHeight: 2,        // obstacles at least this tall count
    blockAhead: 6,         // ... from this far ahead of the player back to the camera
    blockRate: 4,          // how fast the follow changes (damping rate)
    curveLook: 30,         // curved world: the camera yaws toward the road this far ahead ...
    curveYaw: 0.6,         // ... this much of the way
    curveRoll: 0.03,       // radians the camera banks at full curvature
    sideMargin: 0.45,      // extra metres kept visible beyond the outer lane centre ...
    fitAhead: 4,           // ... this far ahead of the player (where obstacles come from)
    playerMargin: 0.6,     // the player in an outer lane: this much beyond his lane centre
                           // stays visible at his own depth
    maxScale: 2.2,         // max factor the offsets may grow to fit a narrow screen
    minScale: 0.9,         // ... and may shrink to on a wide one (bigger hero in landscape)
    dampX: 8,              // follow speed (higher = snappier)
    dampY: 5,
    jumpFollow: 0.25,      // how much of a jump the camera follows
    zipLookUp: 2.2,        // web zip: look this much higher (G9)
    tiltRate: 4,
    shotRate: 7,           // blend speed into / out of the catch cam (G8)
  },

  // --- Curved world (src/curve.js): visual only, gameplay stays straight ---
  curve: {
    enabled: true,
    straightMin: 15,       // seconds of straight road between two curves ...
    straightMax: 30,
    radiusMin: 220,        // curve radius in metres (smaller = sharper)
    radiusMax: 380,
    easeTime: 2.5,         // seconds to ease into / out of a curve
    holdMin: 3,            // seconds a curve holds at full bend
    holdMax: 7,
    sBendChance: 0.3,      // a curve turns straight into the opposite one
    sampleStep: 6,         // metres between bend samples (36 samples = 210 m)
    lean: 0.12,            // radians Spider-Man / Venom lean into a full curve
  },

  // --- X-ray silhouette: the player's parts hidden behind obstacles (src/xray.js) ---
  xray: {
    color: 0xff5a4a,
    edge: 0x4a0a10,        // darker toward the silhouette's rim
    pull: 0.35,            // metres an occluder must be in front before it shows
  },

  // --- World / track ---
  world: {
    segmentLength: 20,
    segmentCount: 13,
    backZ: 96,             // segments fully behind this z are recycled to the front
                           // (track reaches 96 m behind the player for the intro clip's
                           // reverse angle; behind the chase camera it is culled)
    sleeperSpacing: 0.75,
    postSpacing: 5,
  },

  // --- Rendering ---
  render: {
    maxPixelRatio: 2,
    // Adaptive resolution (src/quality.js): starts at min(devicePixelRatio, maxPixelRatio) and
    // steps down through these values (only those below the start are used) while frames are slow.
    adaptive: {
      steps: [2, 1.5, 1.25, 1],
      slowMs: 17.5,        // smoothed frame time above this for slowTime -> one step down
      slowTime: 1.5,
      fastMs: 11,          // below this for fastTime -> one step up
      fastTime: 6,
      probeTime: 30,       // 60 Hz screens never show < 11 ms: after this long without being
                           // slow, try one step up anyway (a failed try locks probing out,
                           // for longer each time)
      lockTime: 30,        // no step up for this long after a step down (doubles on every repeat)
      settle: 1,           // s ignored after a change (the resize itself costs a frame)
    },
    skyColor: 0x8fd0ff,
    fogNear: 45,
    fogFar: 160,
  },

  lights: {
    skyColor: 0xdff1ff,
    groundColor: 0x6b5d50,
    hemiIntensity: 1.6,
    sunColor: 0xfff1dc,
    sunIntensity: 2.2,
    sunPosition: [-6, 12, 6],
  },

  dtCap: 1 / 20,           // longest frame step in seconds

  // --- Obstacles (G2). Sizes in metres; "length" runs along the track. ---
  obstacles: {
    stepUp: 0.4,           // ledges this much above the feet are stepped onto, not crashed into
    stumbleTime: 0.6,      // seconds of the 'stumble' model state after a side hit
    sideHitCooldown: 0.35, // ignore further side hits for this long
    low:  { width: 1.9, height: 0.8, depth: 0.35 },              // jump over
    high: { width: 1.9, bottom: 0.95, top: 2.5, depth: 0.35 },   // slide under (gap > slideHeight)
    car:  { width: 1.6, length: 3.2, height: 1.13, hoodHeight: 0.78, hood: 0.75, trunk: 0.5 },
    wagon: { width: 2.05, height: 2.88, length: 9, gap: 0.5 },  // gap < playerDepth: roofs join
    rampLength: 6,
    trainSpeedMin: 6,      // own speed of oncoming trains (m/s, added to the run speed)
    trainSpeedMax: 11,
    spawnDistance: 160,    // oncoming trains appear this far ahead
    releaseZ: 16,          // obstacles / coins / pickups this far behind are released
    // Stage 11.5 row obstacles: one descriptor, all lanes; each lane gets its own collider.
    gap:    { lenMin: 4, lenMax: 6, lenTime: 0.16, pitTop: 0.35, width: 2.2 },
    gate:   { bottom: 0.95, top: 3.3, depth: 0.35, width: 2.2, raised: 1.9, dropFrom: 2.4, dropTo: 1.6 },
    girder: { length: 4.4, bottom: 0.3, top: 2.1, depth: 0.5, amp: 1.1, period: 2.0, lockTime: 1.2, pivotY: 16 },
    rowWarnTime: 2.4,      // s before arrival: rowWarn event (horn / clang, first-time caption)
  },

  // --- Coins (G2) ---
  coins: {
    spacing: 3.4,          // metres between coins in a row
    height: 0.6,           // coin centre above the feet of a running player
    pickupSize: 0.4,       // half size of the coin pickup box
    maxRow: 14,
    // coins in more than the route lane (patterns.js): per block, the chance of a row /
    // obstacle coins in a second lane, and in the third lane too
    sideChance: 0.95,
    thirdChance: 0.4,
    routeRowChance: 0.85,  // a row on the route lane's free stretch
    zigzagChance: 0.7,     // a diagonal line across when the route moves one lane
    roofChance: 0.7,       // a row on the roof of stationary wagons (no ramp)
    trapTime: 0.8,         // side-lane rows end this many s before a blocking car / train
  },
  coinScore: 10,          // score per coin (score = distance * scorePerMeter + coins * coinScore)

  // --- Venom chase (G8). Gaps are metres behind the player (+Z). ---
  chaser: {
    introTime: 1.3,        // seconds Venom stays right behind at run start
    nearTime: 4.5,         // seconds he stays close after a stumble; a 2nd stumble inside = caught
    farGap: 30,            // where he waits when he has fallen back (off screen)
    minGap: 2.6,           // closest he gets while chasing (catching goes closer)
    maxScreenShare: 0.24,  // when close, he fills at most this much of the screen height
    feetMargin: 0.08,      // ... and his head stays this far (NDC) below Spider-Man's feet
    nearScale: 0.8,        // his size while chasing (the catch cam shows him at full size)
    approachRate: 3.5,     // how fast he closes in (damping rate)
    retreatRate: 1.4,      // how fast he falls back
    followRate: 6,         // how fast he follows the lane and height
    catchStartGap: 11,     // a catch starts at most this far back ...
    catchSpeed: 22,        // ... and rushes in at this speed (m/s)
    catchGap: 1.1,         // where he grabs the player
    lungeTime: 0.7,        // catch cam on Venom's face before 'caught' (ink splash)
    afterCaught: 0.35,     // seconds between 'caught' and game over
    knockback: 3,          // metres the player is yanked back during a catch ...
    knockbackSpeed: 9,     // ... at this speed (m/s)
    catchSide: 0.75,       // Venom lunges in this far toward the catch cam's side
    shotSide: 3.2,         // catch cam: metres to the side of the player ...
    shotHeight: 2.8,       // ... above the floor ...
    shotAhead: 1.6,        // ... and in front (-Z), looking back at Venom's face
                           // (small enough that the view passes in front of whatever he hit)
    heightFactor: 1.3,     // assumed size vs playerHeight if the model cannot be measured
  },

  // --- Power-ups of all kinds (patterns.js keeps the gap between any two pickups) ---
  pickups: {
    minGapAny: 300,        // metres between two power-up pickups, whatever their kind
  },

  // --- Web cartridge and web zip (G9) ---
  web: {
    maxCharges: 3,
    pickupChance: 0.11,    // per pattern block with a free stretch on the route lane
    pickupChanceFull: 0.04, // ... while already holding maxCharges
    pickupMinGap: 350,     // metres between two cartridges at least (about 1 per 1400 m)
    pickupY: 0.15,         // height of the cartridge's bottom above the track
    pickupScale: 1.3,
    hangHeight: 6,         // nothing ahead: rise to this height above the floor ...
    hangGravityScale: 0.3, // ... and float down with this much gravity
    roofLookTime: 2.6,     // look for a train / wagon roof arriving within this many seconds
    roofClear: 0.35,       // feet this far above the roof when its front reaches the player
    maxRiseSpeed: 34,      // fastest upward speed of a zip (m/s)
    minGravityScale: 0.12, // gentlest gravity while rising toward a far roof
    cooldown: 1.2,         // game seconds between two web shots (a refused shot costs nothing)
    lineMaxTime: 1.6,      // the web line disappears after this long (or on landing)
    lineRadius: 0.03,
    anchorHeight: 45,      // anchor high on a building: above the player ...
    anchorAhead: 24,       // ... ahead (-Z) ...
    anchorSide: 8,         // ... and to the side (facades at |x| 7-9 m), always out of frame
    handOffset: [0.32, 1.72, -0.05], // fallback web line start (models without a hand marker)
  },

  // --- Iron Spider (G10) ---
  iron: {
    duration: 12,          // seconds the suit lasts
    maxCount: 5,           // most cores you can hold
    pickupChance: 0.08,    // per pattern block with a free stretch on the route lane
    pickupChanceFull: 0.04, // ... while holding maxCount
    pickupMinGap: 900,     // metres between two cores at least (about 1 per 1800-2400 m)
    pickupY: 0.15,
    pickupScale: 1.3,
    clearTime: 2,          // a save clears everything reaching the player within this many s
    graceTime: 0.5,        // no collisions for this long after a save
    storageKey: 'spidey.iron',
    // gold arms grab a high barrier while sliding (visual only): reach = speed * leadTime,
    // clamped; ~0.3-0.4 s for the arms to reach out
    grabLeadTime: 0.35,
    grabReachMin: 4.5,
    grabReachMax: 9,
  },

  // --- Spider-sense (powerups/sense.js) ---
  sense: {
    duration: 5,           // seconds of auto-dodge after a pickup
    pickupChance: 0.4,     // per pattern block with a free stretch on the route lane (and no
                           // other pickup there: web / core go first) ...
    pickupMinGap: 900,     // ... and this many metres after the last one: ~1 per 2000 m
    pickupY: 0.15,
    pickupScale: 1.3,
    lookAhead: 0.7,       // s: obstacles reaching the player within this are simulated
    actTime: 0.3,          // s: dodge only a hit this close (later = "he could not have")
    laneActTime: 0.45,     // ... for a wall / train face (a lane change; the next lane may close)
    laneClearTime: 0.6,    // a lane is a way out if no wall / train reaches the player sooner
    laneRankTime: 1.5,     // of two ways out, take the one whose next wall is further (up to this) ...
    centerBonus: 0.25,     // ... counting the middle lane this many s better (two ways out from there)
    simStep: 1 / 120,      // s per step of the jump / slide prediction
  },

  // --- Magnet (powerups/magnet.js) ---
  magnet: {
    duration: 5,           // seconds
    pickupChance: 0.15,    // like sense: ~1 per 1600 m (the web cartridge: ~1 per 1400 m)
    pickupMinGap: 400,
    pickupY: 0.15,
    pickupScale: 1.3,
    ahead: 22,             // pull coins this many metres ahead ...
    behind: 2,             // ... up to this far behind ...
    side: 5,               // ... and this far to the side (all three lanes), at any height
    flyTime: 0.32,         // s from the coin's place to Spider-Man
    arc: 0.9,              // m the flight bows upward
    chest: 0.9,            // target height above the feet
  },

  // --- Bugle Manşeti (powerups/bugle.js): the Daily Bugle front page, x2 score multiplier ---
  bugle: {
    duration: 10,          // seconds of factor = 2
    pickupChance: 0.15,    // like the magnet: ~1 per 1600 m
    pickupMinGap: 400,
    pickupY: 0.15,
    pickupScale: 1.3,
  },

  // --- Örümcek Yayı (powerups/spring.js): web-spring shoes, a much higher jump ---
  spring: {
    duration: 10,          // seconds
    jumpScale: 2.2,        // a normal jump reaches this times the usual apex
    pickupChance: 0.15,
    pickupMinGap: 400,
    pickupY: 0.15,
    pickupScale: 1.3,
  },

  // --- Ağ Salınışı (powerups/swing.js): 8 s binalar arasında yüksekte ağla salınma ---
  swing: {
    duration: 8,           // seconds
    height: 6,             // m: the middle of the arc; a wagon roof is 2.88, so nothing reaches him
    arcRise: 1.2,          // the arc swings this much above and below `height`
    arcTime: 0.7,          // seconds per arc (the intro clip's swing cadence)
    takeoffTime: 0.5,      // s to rise to the arc ...
    landingTime: 0.8,      // ... and to get back down at the end (1.5 s grace after)
    pickupChance: 0.17,  // last in the extras order, so it only gets the blocks the others passed on: first one at ~3 km
    pickupMinGap: 500,
    pickupY: 0.15,
    pickupScale: 1.3,
    anchorAhead: 12,       // the web anchor on the facade: this far ahead of the arc's middle ...
    anchorRise: 26,        // ... and this far above the swing height (CONFIG.web.anchorSide: |x| 8 m)
    coinAhead: 22,         // the air coin ribbon is laid this far ahead (the magnet's reach)
    coinStop: 1,           // and stops this many seconds before the end
  },

  // --- Ağ Kuklası (powerups/decoy.js): a web dummy left on the track; Venom takes the bait ---
  decoy: {
    duration: 20,          // seconds the first side stumble is forgiven (one stumble only)
    pickupChance: 0.16,  // last in the extras order, so it only gets the blocks the others passed on: first one at ~3 km
    pickupMinGap: 600,
    pickupY: 0.15,
    pickupScale: 1.3,
    behind: 20,            // the dummy is out of sight (and out of play) this far behind
  },

  // --- Duvar Koşusu (powerups/wall.js): 6 s running sideways on the wall beside the track ---
  wall: {
    duration: 6,           // seconds
    height: 3.2,           // m: his feet above the deck; above every train roof (2.88)
    x: 3.5,                // m: |x| of his feet; the comic wall face rises out of the trackside
                           // wall at 3.65, so his soles nearly touch it
    liftTime: 0.35,        // s to hop up to the wall ...
    landingTime: 0.5,      // ... and to drop back onto the deck at the end (1.5 s grace after)
    camBack: 2.4,          // m the camera pulls back: his feet stay inside a tall portrait frame
    pickupChance: 0.22,  // last in the extras order, so it only gets the blocks the others passed on: first one at ~3 km
    pickupMinGap: 600,
    pickupY: 0.15,
    pickupScale: 1.3,
    coinAhead: 22,         // the wall coin row is laid this far ahead
    coinStop: 0.8,         // and stops this many seconds before the end
  },

  // --- Örümcek İzi (powerups/tracer.js): a drone traces the open lane; staying on it pays ---
  tracer: {
    duration: 10,          // seconds the drone flies
    stepTime: 3,           // s on the traced lane per +1 of game.mult.temp (x3 at 9 s of the 10) ...
    maxTemp: 3,            // ... up to this
    ahead: 6,              // m the drone flies in front of the player
    height: 2.5,           // m above the deck
    leadTime: 3,           // s of track ahead the ribbon is already traced
    ribbonSpacing: 3,      // m between the ribbon's stamps ...
    ribbonTail: 8,         // ... and how far behind the player the strip is still drawn (m)
    ribbonWidth: 1.5,      // m across
    pickupChance: 0.32,  // last in the extras order, so it only gets the blocks the others passed on: first one at ~3 km
    pickupMinGap: 600,
    pickupY: 0.15,
    pickupScale: 1.3,
  },

  // --- Road events (11.5): Venom Hamlesi and Yeşil Cin baskını on a reserved zone ---
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
              coinPerDodge: 5, cleanCoins: 25, scale: 1.0, screenShare: 0.34 },
    goblin: { duration: 10, intro: 1.6, outro: 1.4, lead: 1.6, fly: 0.45, blastAhead: 0.6, blastBehind: 1.0,
              coinPerRow: 6, cleanCoins: 30, stationZ: -13, stationY: 3.5, height: 1.85 },
  },

  // --- Start-of-run intro clip (intro.js). Seconds unless noted; z is metres behind the
  //     player's start spot (the world stands still during the clip). ---
  intro: {
    swings: 3,
    swingTime: 0.7,        // per swing
    webEmptyTime: 0.3,     // the shot that does not come ("TIK TIK")
    fallTime: 0.5,
    rollTime: 0.5,
    roarTime: 0.55,
    screamTime: 0.5,
    runTime: 0.9,          // from the crouch to full start speed; the camera swings behind
    swingLength: 9,        // metres along the track per swing
    swingHigh: 7,          // height at the ends of a swing ...
    swingLow: 3.2,         // ... and at its lowest point
    emptyForward: 1.5,     // metres drifted during the failed shot
    fallForward: 4,
    rollDistance: 3.5,
    anchorHeight: 34,      // web anchors: this far above the swing's low point ...
    anchorAhead: 4,        // ... and this far ahead of it (toward the camera); out of frame
    anchorSide: 6,
    venomLag: 8,           // Venom runs this far behind during the swings
    venomLeap: 2.4,        // his leap height in the middle swing
    venomRoarGap: 3.2,     // how close he gets while roaring
    camSide: 1.4,          // reverse-angle camera: to the side ...
    camDistSwing: 10,      // ... and this far ahead of Spider-Man while he swings ...
    camDistGround: 6.5,    // ... and on the ground
    camHeight: 2.2,        // height above the deck (+ a share of Spider-Man's height)
    camFollowY: 0.45,
    orbitPullIn: 0.5,      // run phase: the camera orbit comes this much closer beside him ...
    orbitRise: 1.5,        // ... and this much higher
    fogNear: 14,           // tighter fog while the camera looks back down the track
    fogFar: 58,            // (hides the end of the track behind)
  },

  // --- Pattern generator (G2) ---
  seed: null,              // null = new random track each run; a number = same track every run
  patterns: {
    safeStart: 60,         // metres with no obstacles at run start
    reactionTime: 0.5,     // seconds a player needs to react (used for spacing)
    blockTimeEasy: 1.5,    // seconds of running per pattern block at the start ...
    blockTimeHard: 1.05,   // ... and at full difficulty (0.915 s at difficultyMax) ...
    blockTimeEndless: 0.76, // ... shrinking toward this in the endless phase (k -> 1)
    difficultyDistance: 2500, // metres until difficulty 1 (first phase) ...
    difficultyDistance2: 12000, // ... then it creeps on to difficultyMax over this many metres
    difficultyMax: 1.3,
    // Endless phase (after difficultyMax, ~8.8 min): difficulty keeps growing as
    // difficultyMax + endlessGain * ln(1 + metres past it / endlessScale), with no plateau.
    // The extra part h drives the "hard" knobs through k = h / (h + endlessHalf) (0 -> 1, never
    // quite there): tighter route spacing, jump->slide combos, fuller side lanes, more and
    // faster trains.
    endlessGain: 0.4,
    endlessScale: 5000,
    endlessHalf: 0.2,
    afterTimeHard: 0.72,   // route spacing after an obstacle shrinks to this share at k = 1
    comboChance: 0.55,     // chance of a 2nd route obstacle in the same block at k = 1
    sideSecondChance: 0.6, // chance of a 2nd obstacle in a side lane in the same block at k = 1
    sideGapHard: 2,        // random extra gap after side-lane obstacles: 0-6 m -> 0-this
    blockWeightHard: 2.5,  // extra weight of stationary wagons in side lanes at k = 1
    trainSpeedMinHard: 9,  // oncoming train speed range at k = 1
    trainSpeedMaxHard: 16,
    trainStart: 200,       // no oncoming trains before this distance
    checkGapTime: 0.6,     // tools/check-patterns.mjs: min seconds between two actions in a lane ...
    minReaction: 0.4,      // ... which may shrink to this in the endless phase (never lower)
    // Stage 11.5 row obstacles (gap / gate / girder) share one generator schedule.
    rows: {
      firstAt: 600,        // m: first gap
      gateAt: 1100,        // m: gates join
      girderAt: 1700,      // m: girders join
      gapMin: 260, gapMax: 520, // m between two rows (random in between) ...
      gapEndless: 0.7,     // ... times this at endless k = 1
      comboChance: 0.4,    // at k = 1: gap -> gate (or gate -> gap) back to back
      weights: { gap: 3, gate: 3, girder: 2.5 },
    },
  },
  city: {
    loop: 6000,
    districts: [['midtown', 0], ['chinatown', 1500], ['bridge', 2540], ['tunnel', 3340], ['neon', 3700], ['dawn', 5200]],
    announceAhead: 60,
    tunnel: [3330, 3360, 3670, 3700],
    cityFade: [2460, 2600, 3400, 3420],
    clearX: 4.6, clearY: 9.5,
    texScale: 1,
    boards: { tabela: 32, ads: 40, bugle: 24 },
    life: { birds: 12, steam: 24, weather: 160, sparks: 120 },
    weather: [4200, 4240, 4460, 4500],
    stumbleNews: 600,
    repaintEvery: 1,
    phase: {
      DAY: { skyTop: 0x3f9eee, skyMid: 0x8fd0ff, horizon: 0xc9e9ff, fog: 0x9ad4ff, far: 0xa9c6e6, near: 0x8fb0d8, win: 0xffffff, skyWin: 0.2,
        hemiSky: 0xdff1ff, hemiGround: 0x6b5d50, hemiI: 1.6, sun: 0xfff1dc, sunI: 2.2, sunPos: [-6, 12, 6], tint: 0xffffff, sign: 0.9,
        halftone: 0.85, baseTone: 0, dotTint: 0x4a5296, winOn: 0, glow: 0, stars: 0, skyDots: 1, fogNear: 45, fogFar: 160, water: 0x2f86cc, lamp: 0.25, coin: 1, rim: 0 },
      GOLDEN: { skyTop: 0x4f86d8, skyMid: 0xffc27a, horizon: 0xffe0a0, fog: 0xffcf96, far: 0xe0a084, near: 0xb9727e, win: 0xffe2a0, skyWin: 0.2,
        hemiSky: 0xffeedb, hemiGround: 0x7a5648, hemiI: 1.5, sun: 0xffd0a0, sunI: 2.5, sunPos: [-10, 5, 7], tint: 0xffdcb8, sign: 0.95,
        halftone: 1, baseTone: 0.05, dotTint: 0x9a4f7a, winOn: 0.1, glow: 0.35, stars: 0, skyDots: 1, fogNear: 44, fogFar: 158, water: 0xe0955c, lamp: 0.7, coin: 1.2, rim: 0 },
      SUNSET: { skyTop: 0x35297a, skyMid: 0xe2507e, horizon: 0xffa040, fog: 0xf07c5c, far: 0x8a3f78, near: 0x552a60, win: 0xffd27a, skyWin: 0.5,
        hemiSky: 0xffe0dc, hemiGround: 0x6a4458, hemiI: 1.5, sun: 0xffc4a4, sunI: 2.1, sunPos: [-9, 4, 2], tint: 0x8a4a6c, sign: 1,
        halftone: 1, baseTone: 0.12, dotTint: 0x6a2f7a, winOn: 0.5, glow: 0.8, stars: 0.15, skyDots: 0.8, fogNear: 44, fogFar: 158, water: 0xd8556a, lamp: 1, coin: 1.5, rim: 0.25 },
      NIGHT: { skyTop: 0x080a26, skyMid: 0x191c56, horizon: 0x3b2f80, fog: 0x1b1a4a, far: 0x1d1d48, near: 0x121236, win: 0xffd27a, skyWin: 0.9,
        hemiSky: 0xa8b6ff, hemiGround: 0x5a3a78, hemiI: 1.4, sun: 0xcfd8ff, sunI: 1.75, sunPos: [6, 12, 7], tint: 0x5a62a6, sign: 1,
        halftone: 1, baseTone: 0.25, dotTint: 0x2a2a70, winOn: 0.85, glow: 1.15, stars: 1, skyDots: 0, fogNear: 42, fogFar: 155, water: 0x1a2a6a, lamp: 1, coin: 2.2, rim: 0.8 },
      DAWN: { skyTop: 0x6b8fd8, skyMid: 0xf6b0c8, horizon: 0xffe0b8, fog: 0xf4c4cc, far: 0xb89ab8, near: 0x9a7aa8, win: 0xffe2a0, skyWin: 0.25,
        hemiSky: 0xffe0f0, hemiGround: 0x6a5670, hemiI: 1.5, sun: 0xffd0b0, sunI: 2.0, sunPos: [6, 6, 7], tint: 0xf0c4d4, sign: 0.95,
        halftone: 0.95, baseTone: 0.08, dotTint: 0x8a6aa8, winOn: 0.25, glow: 0.45, stars: 0.1, skyDots: 0.8, fogNear: 45, fogFar: 160, water: 0xc890b0, lamp: 0.6, coin: 1.2, rim: 0.1 },
    },
    phaseKeys: [[0, 'DAY'], [1300, 'DAY'], [1700, 'GOLDEN'], [2440, 'GOLDEN'], [2700, 'SUNSET'], [3340, 'SUNSET'],
      [3520, 'NIGHT'], [5000, 'NIGHT'], [5300, 'DAWN'], [5650, 'DAWN'], [6000, 'DAY']],
    discKeys: [[0, 0.5, 0.95, 0, 0xfff0b0], [1300, 0.5, 0.95, 0, 0xfff0b0], [1700, 0.5, 0.42, 0.075, 0xfffbe0],
      [2440, 0.5, 0.3, 0.085, 0xfff6c8], [2700, 0.5, 0.27, 0.11, 0xfff0a0], [3340, 0.5, 0.2, 0.125, 0xffc070],
      [3341, 0.38, 0.6, 0.06, 0xf4f0d8], [5000, 0.38, 0.6, 0.06, 0xf4f0d8], [5300, 0.38, 0.5, 0, 0xf4f0d8],
      [5301, 0.5, 0.12, 0.07, 0xffb08a], [5650, 0.5, 0.26, 0.07, 0xfff0c8], [6000, 0.5, 0.95, 0, 0xfff0b0]],
    tunnelLook: { fog: 0x0a0b16, hemiSky: 0xbfe8ff, hemiI: 1.15, sunI: 1.0, coin: 3, rim: 1 },
    rim: 0xffb020,
  },
};
