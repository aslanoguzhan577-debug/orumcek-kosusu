// intro.js — the start-of-run clip (Temple Run / Subway Surfers style), ~5 s, skippable.
//
// The world stands still; the clip happens on the track BEHIND the player's start spot
// (z > 0) and ends with Spider-Man running through z = 0 at start speed, so the run
// continues seamlessly and score / distance / obstacles are untouched.
//   swing x N  reverse-angle camera ahead of him looking back; he swings toward it on
//              webs (line to an anchor high above, out of frame), Venom runs/leaps below
//   webEmpty   one more shot, nothing comes ("TIK TIK")
//   fall, roll he drops to the deck and rolls forward
//   roar       Venom closes in and roars
//   scream     Spider-Man looks back, screams
//   run        he bolts; the camera orbits from the front to the normal chase camera
//   end        controls on (also sent with {skipped: true} when skipped)
// emit('intro', {phase}) on every phase (each swing too). game.state.intro is true while
// it plays. game.js: start()/restart() call begin(), update(dt) replaces the normal frame
// while it plays, any input action calls skip(), _resetRun() calls reset().
// Pause freezes it (game.update returns early); collisions are off (no systems run).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { emit } from './events.js';
import { game } from './game.js';

const P = CONFIG.intro;
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;

export class Intro {
  constructor({ scene, player, chaser, web, cameraRig }) {
    this.scene = scene;
    this.player = player;
    this.chaser = chaser;
    this.web = web;
    this.rig = cameraRig;
    this.active = false;

    this.phases = [];
    for (let i = 0; i < P.swings; i++) this.phases.push({ name: 'swing', time: P.swingTime, index: i });
    this.phases.push(
      { name: 'webEmpty', time: P.webEmptyTime },
      { name: 'fall', time: P.fallTime },
      { name: 'roll', time: P.rollTime },
      { name: 'roar', time: P.roarTime },
      { name: 'scream', time: P.screamTime },
      { name: 'run', time: P.runTime },
    );
    this.total = this.phases.reduce((s, ph) => s + ph.time, 0);

    // Where each stage starts (metres behind the start spot), worked back from z = 0:
    // the run goes from rest to start speed over runTime.
    this.zRun = 0.5 * CONFIG.startSpeed * P.runTime;
    this.zRoll = this.zRun + P.rollDistance;
    this.zFall = this.zRoll + P.fallForward;
    this.zEmpty = this.zFall + P.emptyForward;
    this.zSwing = this.zEmpty + P.swings * P.swingLength;

    this.t = 0;
    this.phaseIndex = -1;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this._camPosT = new THREE.Vector3();
    this._camLookT = new THREE.Vector3();
    this._anchor = new THREE.Vector3();
    this._orbit = { r0: 0, h0: 0, a0: 0, look: new THREE.Vector3() };
  }

  begin() {
    this.active = true;
    game.state.intro = true;
    this.t = 0;
    this.phaseIndex = -1;
    this.player.controlsLocked = true;
    this.scene.fog.near = P.fogNear;
    this.scene.fog.far = P.fogFar;
    emit('intro', { phase: 'start' });
    this._advance();
    this._pose(0, true);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.total) {
      this._finish(false);
      return;
    }
    this._advance();
    this._pose(dt, false);
  }

  skip() {
    if (this.active) this._finish(true);
  }

  // Run reset / menu: drop the clip quietly.
  reset() {
    if (!this.active) return;
    this._cleanup();
    this.rig.clearShot();
  }

  _cleanup() {
    this.active = false;
    game.state.intro = false;
    this.web.hideLine();
    this.scene.fog.near = CONFIG.render.fogNear;
    this.scene.fog.far = CONFIG.render.fogFar;
  }

  _finish(skipped) {
    this._cleanup();
    this.player.reset(); // lane centre, z = 0, controls on, model state from the run
    if (skipped) this.chaser._startIntro();
    else this.chaser.continueFromClip();
    this.rig.snap(this.player);
    emit('intro', skipped ? { phase: 'end', skipped: true } : { phase: 'end' });
  }

  // Emit the phases we have entered since last frame.
  _advance() {
    let t = this.t;
    let i = 0;
    while (i < this.phases.length - 1 && t >= this.phases[i].time) {
      t -= this.phases[i].time;
      i++;
    }
    this._u = Math.min(1, t / this.phases[i].time);
    while (this.phaseIndex < i) {
      this.phaseIndex++;
      const ph = this.phases[this.phaseIndex];
      if (ph.name === 'run') this._startOrbit();
      emit('intro', { phase: ph.name });
    }
  }

  _pose(dt, snap) {
    const ph = this.phases[this.phaseIndex];
    const u = this._u;
    let zS = 0, yS = 0, pState = 'swing';
    let zV = 0, yV = 0, vState = 'run';
    let dist = P.camDistGround;
    let lookVenom = 0;
    this.web.hideLine();

    switch (ph.name) {
      case 'swing': {
        const z0 = this.zSwing - ph.index * P.swingLength;
        zS = z0 - P.swingLength * u;
        const k = 2 * u - 1;
        yS = P.swingLow + (P.swingHigh - P.swingLow) * k * k;
        zV = zS + P.venomLag;
        if (ph.index === 1) yV = P.venomLeap * Math.sin(Math.PI * u);
        vState = yV > 0.2 ? 'reach' : 'run';
        dist = P.camDistSwing;
        // web to an anchor high above the low point of this swing (out of frame)
        const side = ph.index % 2 ? -1 : 1;
        this._anchor.set(side * P.anchorSide, P.swingLow + P.anchorHeight, z0 - P.swingLength / 2 - P.anchorAhead);
        this.web.drawLineTo(this._anchor);
        break;
      }
      case 'webEmpty':
        zS = this.zEmpty - P.emptyForward * u;
        yS = P.swingHigh + 0.3 * Math.sin(Math.PI * u);
        pState = 'web';
        zV = zS + P.venomLag;
        dist = lerp(P.camDistSwing, P.camDistGround, u * 0.4);
        break;
      case 'fall':
        zS = this.zFall - P.fallForward * u;
        yS = P.swingHigh * (1 - u * u);
        pState = 'fall';
        zV = zS + P.venomLag * (1 - 0.3 * u);
        dist = lerp(P.camDistSwing, P.camDistGround, 0.4 + 0.6 * u);
        break;
      case 'roll':
        zS = this.zRoll - P.rollDistance * (1 - (1 - u) * (1 - u));
        pState = 'roll';
        zV = lerp(this.zFall - P.fallForward + P.venomLag * 0.7, this.zRun + P.venomRoarGap, smooth(u));
        lookVenom = 0.2 * u;
        break;
      case 'roar':
        zS = this.zRun;
        pState = 'roll'; // still crouched from the roll
        zV = this.zRun + P.venomRoarGap;
        vState = 'roar';
        lookVenom = 0.4;
        break;
      case 'scream':
        zS = this.zRun;
        pState = 'scared';
        zV = this.zRun + P.venomRoarGap;
        vState = 'roar';
        lookVenom = 0.4;
        break;
      case 'run':
        zS = this.zRun * (1 - u * u); // from rest to start speed, reaching z = 0
        pState = 'run';
        zV = zS + P.venomRoarGap + 1.2 * u;
        break;
      default:
        break;
    }

    this._posePlayer(zS, yS, pState, dt);
    this.chaser.clipPose(0, yV, zV, vState, dt);

    if (ph.name === 'run') {
      this._orbitCamera(zS, u);
    } else {
      // reverse angle: ahead of Spider-Man, looking back at him (and Venom behind)
      this._camPosT.set(P.camSide, P.camHeight + P.camFollowY * yS, zS - dist);
      this._camLookT.set(0, yS + 0.9, zS);
      if (lookVenom > 0) {
        this._camLookT.x += (0 - this._camLookT.x) * lookVenom;
        this._camLookT.y += (yV + this.chaser.height * 0.7 - this._camLookT.y) * lookVenom;
        this._camLookT.z += (zV - this._camLookT.z) * lookVenom;
      }
      if (snap) {
        this.camPos.copy(this._camPosT);
        this.camLook.copy(this._camLookT);
      } else {
        const k = 1 - Math.exp(-P.camDamp * dt);
        this.camPos.lerp(this._camPosT, k);
        this.camLook.lerp(this._camLookT, k);
      }
    }
    this.rig.setShot(this.camPos, this.camLook, true);
  }

  _posePlayer(z, y, state, dt) {
    const p = this.player;
    p.x = 0;
    p.y = y;
    p.floorY = 0;
    p.root.position.set(0, y, z);
    if (state !== p._modelState) {
      p._modelState = state;
      p.state = state;
      p.model.setState(state);
    }
    p.model.update(dt);
  }

  // Remember where the camera is (relative to Spider-Man) when the run starts.
  _startOrbit() {
    const o = this._orbit;
    const dx = this.camPos.x;
    const dz = this.camPos.z - this.zRun;
    o.r0 = Math.hypot(dx, dz);
    o.h0 = this.camPos.y;
    o.a0 = Math.atan2(dx, -dz); // 0 = straight ahead of him, PI = straight behind
    o.look.copy(this.camLook);
  }

  // Orbit from the reverse angle to exactly the chase camera's pose (so the hand-over to
  // rig.snap() at the end is seamless); fog eases back to normal.
  _orbitCamera(zS, u) {
    const o = this._orbit;
    const c = CONFIG.camera;
    const s = smooth(u);
    const a = lerp(o.a0, Math.PI, s);
    const mid = Math.sin(Math.PI * s); // 0 at both ends, 1 halfway (beside him)
    // pull in and rise halfway (stays over the deck, clear of the facades)
    const r = lerp(o.r0, c.distance * this.rig.scale, s) * (1 - P.orbitPullIn * mid);
    const h = lerp(o.h0, c.height * this.rig.scale, s) + P.orbitRise * mid;
    this.camPos.set(Math.sin(a) * r, h, zS - Math.cos(a) * r);
    // look at Spider-Man for most of the move, then hand over to the chase camera's target
    const toHim = Math.min(1, u * 4);
    const toChase = s * s * s;
    const fx = 0, fy = 0.9, fz = zS;
    this.camLook.set(
      lerp(lerp(o.look.x, fx, toHim), 0, toChase),
      lerp(lerp(o.look.y, fy, toHim), c.lookHeight, toChase),
      lerp(lerp(o.look.z, fz, toHim), -c.lookAhead, toChase),
    );
    this.scene.fog.near = lerp(P.fogNear, CONFIG.render.fogNear, s);
    this.scene.fog.far = lerp(P.fogFar, CONFIG.render.fogFar, s);
  }
}
