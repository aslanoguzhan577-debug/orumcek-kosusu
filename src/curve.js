// curve.js — "curved world": the street ahead bends left / right now and then. Visual only:
// gameplay stays straight (lanes, z, collisions untouched).
//
// The road has a curvature profile k(s) along the run distance s (straight stretches, then a
// curve that eases in, holds and eases out, sometimes an S-bend). Every frame the lateral
// offset of the road ahead, seen from the player's own heading, is sampled into a small
// uniform array:  x(d) = integral 0..d of (heading(s + u) - heading(s)) du,  d = metres ahead.
// So the bend is 0 (and flat) at the player, curves arrive from the distance and pass him.
// Behind the player (z > 0: Venom, the camera, the intro clip) nothing bends.
//
// Every material gets it: Material.prototype.onBeforeCompile is wrapped (chained with the
// material's own hook) to swap <project_vertex> for a bent one, so meshes, InstancedMesh,
// Points and sprites all bend in the vertex stage. Custom ShaderMaterials call
// curveWorld(worldPos) themselves (fx.js, xray.js).
//
//   import { curve } from './curve.js';  (import before any material is created)
//   curve.update(distance, speed, amp)   once per frame (main.js); amp 0..1 fades the bend
//   curve.offsetAt(z)                    lateral offset at world z (JS side, e.g. camera)
//   curve.bank                           -1..1 curvature at the player (lean into the turn)

import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.curve;
const N = 36;                         // samples, C.sampleStep apart (0 .. 210 m)
const X = new Float32Array(N);        // lateral offset per sample (uniform vec4[9])

const U = {
  curveX: { value: X },
  curveStep: { value: C.sampleStep },
};

const HEAD = /* glsl */`
uniform vec4 curveX[${N / 4}];
uniform float curveStep;
float curveAt( int i ) { return curveX[ i / 4 ][ i % 4 ]; }
vec4 curveWorld( vec4 w ) {
  float f = -w.z / curveStep;
  if ( f > 0.0 ) {
    f = min( f, ${N - 1}.0 - 0.001 ); // past the last sample: hold (keeps the skyline calm)
    int i = int( f );
    w.x += mix( curveAt( i ), curveAt( i + 1 ), f - float( i ) );
  }
  return w;
}
`;

const MV_LINE = 'mvPosition = modelViewMatrix * mvPosition;';
if (!THREE.ShaderChunk.project_vertex.includes(MV_LINE)) console.warn('curve.js: project_vertex changed');
const PROJECT = THREE.ShaderChunk.project_vertex.replace(MV_LINE, 'mvPosition = viewMatrix * curveWorld( modelMatrix * mvPosition );');
const SPRITE_LINE = 'vec4 mvPosition = modelViewMatrix[ 3 ];';

function patchShader(shader, material) {
  if (material.isRawShaderMaterial) return;
  shader.uniforms.curveX = U.curveX;
  shader.uniforms.curveStep = U.curveStep;
  let vs = shader.vertexShader.replace('#include <project_vertex>', PROJECT);
  if (material.isSpriteMaterial) vs = vs.replace(SPRITE_LINE, 'vec4 mvPosition = viewMatrix * curveWorld( modelMatrix[ 3 ] );');
  shader.vertexShader = HEAD + vs;
}

// Chain: material.onBeforeCompile = fn stores fn; the renderer always gets the wrapper.
function curvedCompile(shader, renderer) {
  if (this.__onBeforeCompile) this.__onBeforeCompile(shader, renderer);
  patchShader(shader, this);
}
Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', {
  configurable: true,
  get() { return curvedCompile; },
  set(fn) { if (fn !== curvedCompile) this.__onBeforeCompile = fn; },
});
// the default cache key was onBeforeCompile.toString(): keep it per material's own hook
THREE.Material.prototype.customProgramCacheKey = function () {
  return this.__onBeforeCompile ? this.__onBeforeCompile.toString() : '';
};

// ---------- curvature profile ----------
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);

const pieces = [];       // { s0, s1, k0, k1 } back to back, k eases k0 -> k1
let cursor = 0;
let lastDistance = 0;

function push(len, k0, k1) {
  const s0 = pieces.length ? pieces[pieces.length - 1].s1 : 0;
  pieces.push({ s0, s1: s0 + Math.max(1, len), k0, k1 });
}

// one straight stretch followed by one curve (or S-bend); lengths from seconds at speed v
function plan(v) {
  push(rand(C.straightMin, C.straightMax) * v, 0, 0);
  const dir = Math.random() < 0.5 ? -1 : 1;
  let k = dir / rand(C.radiusMin, C.radiusMax);
  const ease = C.easeTime * v;
  push(ease, 0, k);
  push(rand(C.holdMin, C.holdMax) * v, k, k);
  if (Math.random() < C.sBendChance) {
    const k2 = -dir / rand(C.radiusMin, C.radiusMax);
    push(ease * 1.6, k, k2);
    push(rand(C.holdMin, C.holdMax) * v * 0.8, k2, k2);
    k = k2;
  }
  push(ease, k, 0);
}

// k at distance s; calls must not go backwards within one frame (cursor walks forward)
function kAt(s) {
  while (cursor < pieces.length - 1 && s >= pieces[cursor].s1) cursor++;
  const p = pieces[cursor];
  if (s <= p.s0) return p.k0;
  const t = Math.min(1, (s - p.s0) / (p.s1 - p.s0));
  return p.k0 + (p.k1 - p.k0) * smooth(t);
}

function reset() {
  pieces.length = 0;
  cursor = 0;
  X.fill(0);
}

export const curve = {
  bank: 0,
  uniforms: U,

  update(distance, speed, amp = 1) {
    if (distance < lastDistance || !pieces.length) reset(); // new run (world.reset)
    lastDistance = distance;
    if (!C.enabled) amp = 0;
    const step = C.sampleStep;
    const horizon = distance + step * N + 50;
    const v = Math.max(speed, CONFIG.startSpeed);
    while (!pieces.length || pieces[pieces.length - 1].s1 < horizon) plan(v);
    // drop pieces well behind the player
    while (pieces.length > 1 && pieces[0].s1 < distance - 50) pieces.shift();

    cursor = 0;
    const h = step / 2;
    let kPrev = kAt(distance);
    const kMax = 1 / C.radiusMin;
    this.bank = THREE.MathUtils.clamp(kPrev / kMax, -1, 1) * amp;
    let th = 0, x = 0;
    X[0] = 0;
    for (let j = 1; j < N; j++) {
      for (let q = 1; q <= 2; q++) {
        const kNext = kAt(distance + ((j - 1) * 2 + q) * h);
        const thNext = th + (kPrev + kNext) * 0.5 * h;
        x += (th + thNext) * 0.5 * h;
        th = thNext;
        kPrev = kNext;
      }
      X[j] = x * amp;
    }
  },

  // lateral offset of the bent world at world z (0 behind the player)
  offsetAt(z) {
    const f = Math.min(-z / C.sampleStep, N - 1.001);
    if (!(f > 0)) return 0;
    const i = Math.floor(f);
    return X[i] + (X[i + 1] - X[i]) * (f - i);
  },

  _pieces: pieces, // the planned profile (console / tests can inspect or replace it)
};
