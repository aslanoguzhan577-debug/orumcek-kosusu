// config.js — every tunable number of the game lives here (G1 owns, others add keys).
// Units: metres, seconds, m/s. Forward is -Z, the world scrolls toward +Z.

export const CONFIG = {
  // --- Lanes ---
  laneCount: 3,
  laneWidth: 2.2,          // distance between lane centres
  laneSwitchTime: 0.14,    // seconds for one lane change (works mid-air too)

  // --- Speed and score ---
  startSpeed: 11,          // m/s at run start
  maxSpeed: 28,            // m/s cap
  acceleration: 0.15,      // m/s gained per second
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
    fovPortrait: 72,       // vertical FOV in tall portrait
    portraitAspect: 0.46,  // aspect at which the portrait values fully apply
    height: 3.4,           // above the player's floor
    distance: 6.2,         // behind the player (+Z)
    lookAhead: 7,          // look at a point this far ahead (-Z)
    lookHeight: 0.9,
    followX: 0.55,         // fraction of player x the camera follows (landscape)
    followXPortrait: 0.15, // ... in portrait (keeps all lanes on screen)
    sideMargin: 0.7,       // extra metres kept visible beyond the outer lane centre
    maxScale: 2.2,         // max factor the offsets may grow to fit a narrow screen
    dampX: 8,              // follow speed (higher = snappier)
    dampY: 5,
    jumpFollow: 0.25,      // how much of a jump the camera follows
    zipLookUp: 2.2,        // web zip: look this much higher (G9)
    tiltRate: 4,
    shotRate: 7,           // blend speed into / out of the catch cam (G8)
  },

  // --- World / track ---
  world: {
    segmentLength: 20,
    segmentCount: 9,
    backZ: 16,             // segments fully behind this z are recycled to the front
    sleeperSpacing: 0.75,
    postSpacing: 5,
  },

  // --- Rendering ---
  render: {
    maxPixelRatio: 2,
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
  },

  // --- Coins (G2) ---
  coins: {
    spacing: 2.4,          // metres between coins in a row
    height: 0.6,           // coin centre above the feet of a running player
    pickupSize: 0.4,       // half size of the coin pickup box
    maxRow: 10,
  },
  coinScore: 10,           // score per coin (score = distance * scorePerMeter + coins * coinScore)

  // --- Venom chase (G8). Gaps are metres behind the player (+Z). ---
  chaser: {
    introTime: 1.3,        // seconds Venom stays right behind at run start
    nearTime: 4.5,         // seconds he stays close after a stumble; a 2nd stumble inside = caught
    farGap: 30,            // where he waits when he has fallen back (off screen)
    minGap: 2.6,           // closest he gets while chasing (catching goes closer)
    headScreenY: 0.11,     // when close, the top of his head sits this high on screen
                           // (fraction from the bottom): only head + shoulders show
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

  // --- Web cartridge and web zip (G9) ---
  web: {
    maxCharges: 3,
    pickupChance: 0.22,    // per pattern block with a free stretch on the route lane
    pickupChanceFull: 0.04, // ... while already holding maxCharges
    pickupMinGap: 180,     // metres between two cartridges at least
    pickupY: 0.15,         // height of the cartridge's bottom above the track
    pickupScale: 1.3,
    hangHeight: 6,         // nothing ahead: rise to this height above the floor ...
    hangGravityScale: 0.3, // ... and float down with this much gravity
    roofLookTime: 2.6,     // look for a train / wagon roof arriving within this many seconds
    roofClear: 0.35,       // feet this far above the roof when its front reaches the player
    maxRiseSpeed: 34,      // fastest upward speed of a zip (m/s)
    minGravityScale: 0.12, // gentlest gravity while rising toward a far roof
    lineMaxTime: 1.6,      // the web line disappears after this long (or on landing)
    lineRadius: 0.03,
    anchorHeight: 45,      // anchor high on a building: above the player ...
    anchorAhead: 24,       // ... ahead (-Z) ...
    anchorSide: 8,         // ... and to the side (facades at |x| 7-9 m), always out of frame
    handOffset: [0.32, 1.72, -0.05], // raised right hand in the 'web' pose, from the feet
  },

  // --- Iron Spider (G10) ---
  iron: {
    duration: 22,          // seconds the suit lasts
    maxCount: 5,           // most cores you can hold
    pickupChance: 0.16,    // per pattern block with a free stretch on the route lane
    pickupChanceFull: 0.04, // ... while holding maxCount
    pickupMinGap: 500,     // metres between two cores at least (about 1 per 900-1200 m)
    pickupY: 0.15,
    pickupScale: 1.3,
    clearTime: 2,          // a save clears everything reaching the player within this many s
    graceTime: 0.5,        // no collisions for this long after a save
    storageKey: 'spidey.iron',
  },

  // --- Pattern generator (G2) ---
  seed: null,              // null = new random track each run; a number = same track every run
  patterns: {
    safeStart: 60,         // metres with no obstacles at run start
    reactionTime: 0.5,     // seconds a player needs to react (used for spacing)
    blockTimeEasy: 1.5,    // seconds of running per pattern block at the start ...
    blockTimeHard: 1.05,   // ... and at full difficulty
    difficultyDistance: 2500, // metres until full difficulty
    trainStart: 200,       // no oncoming trains before this distance
    checkGapTime: 0.6,     // tools/check-patterns.mjs: min seconds between two actions in a lane
  },
};
