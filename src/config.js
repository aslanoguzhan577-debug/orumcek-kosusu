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
};
