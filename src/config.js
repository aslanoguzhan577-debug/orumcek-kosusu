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
  },
};
