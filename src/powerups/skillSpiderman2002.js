// skillSpiderman2002.js — Spider-Man 2002 (Raimi): "Web Slingshot" (Mancınık Ağ)
//
// Gameplay (unchanged): 2 charges (1 per use); 0.30 s anticipation, then a launch (vy 20,
// gravity x0.58, +18 m/s) over everything, a cushioned landing, hits absorbed all the way.
// Look (vfxCore.js, all built at load):
//   * two clean web lines (white core, dark rim — the web.js style) shoot to the buildings on
//     both sides and splat there; he leans back and stretches like a drawn slingshot;
//   * release: the lines snap away toward the walls, squash -> stretch, a dust ring at his feet,
//     thin speed lines at the screen edges, the camera eases back and follows him up so he
//     never leaves the frame;
//   * landing: a toon web pattern pops onto the ground, dust ring, THWIP!.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { VFX_TEXTURES, puffBurst, sticker, edgeLines, kick, sfx, chunkBurst, sparkBurst, triggerCameraShake } from '../vfxCore.js';

export const SLINGSHOT_SVG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2.5 4.5 L12 14.5 L21.5 4.5" />
  <path d="M12 14.5 L12 21.5" stroke-width="2.2" />
  <circle cx="12" cy="14.5" r="2.8" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="1.5" />
  <circle cx="12" cy="14.5" r="1.1" fill="currentColor" />
  <path d="M6 8 L12 12.5 L18 8" opacity="0.65" stroke-dasharray="1 1.5" />
  <circle cx="2.5" cy="4.5" r="1.6" fill="currentColor" />
  <circle cx="21.5" cy="4.5" r="1.6" fill="currentColor" />
</svg>`;

const MAX_CHARGES = 2;
const ANTICIPATION_TIME = 0.30;
const LAUNCH_VY = 20.0;
const SHOOT = 0.08;   // web lines reach the walls
const SNAP = 0.12;    // web lines whip away after the release

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _hand = [new THREE.Vector3(), new THREE.Vector3()];
const _anchor = [new THREE.Vector3(), new THREE.Vector3()];

// radial web (white strands, dark rim) for the wall splats and the landing pattern
function webTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const C = 128, spokes = 12;
  const pts = (r, k) => [C + Math.cos((k / spokes) * 6.283) * r, C + Math.sin((k / spokes) * 6.283) * r];
  const draw = (w, col) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineCap = g.lineJoin = 'round';
    g.beginPath();
    for (let k = 0; k < spokes; k++) { g.moveTo(C, C); g.lineTo(...pts(118, k)); }
    for (const r of [26, 50, 76, 102]) {
      for (let k = 0; k < spokes; k++) {
        const [x0, y0] = pts(r, k), [x1, y1] = pts(r, k + 1);
        const [mx, my] = pts(r * 0.86, k + 0.5); // strands sag toward the centre
        if (k === 0) g.moveTo(x0, y0);
        g.quadraticCurveTo(mx, my, x1, y1);
      }
    }
    g.stroke();
  };
  draw(9, '#1d2433');
  draw(4, '#ffffff');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  VFX_TEXTURES.push(tex);
  return tex;
}

function getHandPositions(player, leftOut, rightOut) {
  const hand = player.model?.hand;
  player.root.updateMatrixWorld();
  if (hand && typeof hand.getWorldPosition === 'function') hand.getWorldPosition(rightOut);
  else player.root.localToWorld(rightOut.set(0.38, 0.76, -0.2));
  // the left hand mirrors the right one around the body's centre line
  leftOut.copy(rightOut);
  leftOut.x = player.root.position.x * 2 - rightOut.x;
}

export function createSpiderman2002Skill({ scene, player, obstacles, cameraRig }) {
  const actualScene = scene || game?.scene;
  const actualPlayer = player || game?.player;
  const actualObstacles = obstacles || game?.obstacles;
  const actualCameraRig = cameraRig || game?.cameraRig;

  const rootGroup = new THREE.Group();
  rootGroup.name = 'skillSpiderman2002Root';
  actualScene.add(rootGroup);

  // web lines, exactly the web.js look
  const lineR = CONFIG.web.lineRadius;
  const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x1d2433, side: THREE.BackSide, fog: false });
  const lines = [0, 1].map(() => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(geo, coreMat);
    core.scale.set(lineR, 1, lineR);
    const rim = new THREE.Mesh(geo, rimMat);
    rim.scale.set(lineR * 1.9, 1, lineR * 1.9);
    g.add(core, rim);
    g.visible = false;
    g.frustumCulled = core.frustumCulled = rim.frustumCulled = false;
    rootGroup.add(g);
    return g;
  });
  const webTex = webTexture();
  const splats = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: webTex, fog: false }));
    s.visible = false;
    rootGroup.add(s);
    return s;
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  decal.visible = false;
  decal.renderOrder = 4;
  rootGroup.add(decal);
  let decalT = -1;

  function setLine(i, from, to) {
    _dir.subVectors(to, from);
    const len = _dir.length();
    const l = lines[i];
    if (len < 0.01) { l.visible = false; return; }
    l.visible = true;
    l.position.copy(from);
    l.quaternion.setFromUnitVectors(_up, _dir.divideScalar(len));
    l.scale.set(1, len, 1);
  }

  // slingshot squash & stretch on the current model root
  const sq = { model: null, base: 1, v: 1, vel: 0, to: 1 };
  function squash(dt) {
    if (!sq.model) return;
    sq.vel += ((sq.to - sq.v) * 300 - sq.vel * 15) * dt;
    sq.v += sq.vel * dt;
    const y = Math.max(0.6, sq.v), xz = 1 / Math.sqrt(y);
    sq.model.root.scale.set(sq.base * xz, sq.base * y, sq.base * xz);
    if (!active && Math.abs(sq.v - 1) < 0.004 && Math.abs(sq.vel) < 0.05) restoreScale();
  }
  function restoreScale() {
    if (sq.model) sq.model.root.scale.setScalar(sq.base);
    sq.model = null;
    sq.v = sq.to = 1;
    sq.vel = 0;
  }

  let maxCharges = MAX_CHARGES;
  let charges = MAX_CHARGES;
  let active = false;
  let phase = 'idle'; // 'idle' | 'anticipation' | 'flight' | 'landing'
  let anticipationTimer = 0;
  let flightTimer = 0;
  let snapT = -1;
  let baseSpeed = null;

  function syncGameCharges() {
    if (game?.state) game.state.webCharges = charges;
  }

  function land() {
    const p = actualPlayer;
    decal.position.set(p.x, p.floorY + 0.03, 0);
    decal.rotation.y = Math.random() * 6.283;
    decal.visible = true;
    decalT = 0;
    puffBurst({ x: p.x, y: p.floorY + 0.05, z: 0 }, { n: 8, ring: true, radius: 0.5, speed: 3.4, size: 0.55, rise: 0.5, scroll: false });
    sticker('thwip', new THREE.Vector3(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.2, -1.3), { life: 0.75 });
    kick(0.3);
    triggerCameraShake(actualCameraRig, 0.12, 0.2);
    sq.to = 1;
    sq.v = 0.8;
    sq.vel = 0;
  }

  function lookOff() {
    edgeLines(0);
    if (actualCameraRig?.setDolly) actualCameraRig.setDolly(0, 0);
    actualCameraRig?.setTilt?.(false);
  }

  const skill = {
    name: 'spiderman2002',
    maxCharges,
    get charges() { return charges; },
    set charges(val) {
      charges = Math.max(0, Math.min(maxCharges, val));
      syncGameCharges();
    },
    get baseSpeed() { return baseSpeed; },
    set baseSpeed(val) { baseSpeed = val; },
    slingshotSvgIcon: SLINGSHOT_SVG_ICON,
    get active() { return active; },
    get phase() { return phase; },

    activate() {
      if (active || phase !== 'idle') return false;
      if (charges <= 0) return false;
      if (game?.halted || actualPlayer?.controlsLocked) return false;

      charges--;
      syncGameCharges();

      active = true;
      phase = 'anticipation';
      anticipationTimer = 0;
      flightTimer = 0;
      snapT = -1;

      actualPlayer.root.rotation.x = -0.35;
      actualPlayer.setOverride?.('web', ANTICIPATION_TIME + 0.15);
      if (sq.model && sq.model !== actualPlayer.model) restoreScale();
      if (!sq.model) { sq.model = actualPlayer.model; sq.base = sq.model.root.scale.y; }
      sq.to = 1.12; // drawn back: stretched tall and thin

      sfx('web', { from: actualPlayer.x, to: 0 });
      emit('slingshotAnticipation', { charges });
      return true;
    },

    beforePlayer(dt) {
      if (!active) return;
      const p = actualPlayer;
      if (phase === 'anticipation') {
        p.root.rotation.x = -0.35;
        p.vy = 0;
        actualObstacles?.grace(0.35);
        return;
      }
      if (phase === 'flight') {
        flightTimer += dt;
        actualObstacles?.grace(0.40);
        const diveAngle = p.vy > 0 ? 0.35 : -0.15;
        p.root.rotation.x = THREE.MathUtils.lerp(p.root.rotation.x, diveAngle, Math.min(1.0, dt * 8.0));
        sq.to = p.vy > 4 ? 1.14 : 1;
        if (p.grounded || p.y <= p.floorY + 0.08) phase = 'landing';
        else if (p.vy < 0 && p.y - p.floorY <= 0.85) phase = 'landing';
        return;
      }
      if (phase === 'landing') {
        actualObstacles?.grace(0.65);
        if (p.vy < -5.5) p.vy = -5.5;
        if (p.grounded || p.y <= p.floorY + 0.08) {
          p.y = p.floorY;
          p.vy = 0;
          p.grounded = true;
          p.gravityScale = 1.0;
          p.root.rotation.x = 0;
          land();
          lookOff();
          actualObstacles?.grace(1.5);
          emit('land');
          if (this.baseSpeed != null && game?.state) {
            game.speedOverride = null;
            this.baseSpeed = null;
          }
          active = false;
          phase = 'idle';
        }
      }
    },

    update(time, dt) {
      squash(dt);
      if (decalT >= 0) { // landing web: pops in, holds, shrinks; scrolls with the world
        decalT += dt;
        const run = game.state.mode === 'running' && !game.halted;
        if (run) decal.position.z += game.state.speed * dt;
        const k = decalT < 0.08 ? (decalT / 0.08) * 1.15 : decalT < 0.16 ? 1.15 - ((decalT - 0.08) / 0.08) * 0.15 : decalT > 0.7 ? Math.max(0, 1 - (decalT - 0.7) / 0.15) : 1;
        decal.scale.setScalar(3.2 * k);
        if (decalT > 0.85) { decal.visible = false; decalT = -1; }
      }
      if (snapT >= 0) { // released lines whip back to the walls
        snapT += dt;
        const k = Math.min(1, snapT / SNAP);
        for (let i = 0; i < 2; i++) {
          _from.lerpVectors(_hand[i], _anchor[i], k * k);
          setLine(i, _from, _anchor[i]);
          splats[i].scale.setScalar(1.4 * (1 - k));
        }
        if (k >= 1) {
          snapT = -1;
          for (let i = 0; i < 2; i++) { lines[i].visible = false; splats[i].visible = false; }
        }
      }
      if (!active) return;

      if (phase === 'anticipation') {
        anticipationTimer += dt;
        const p = actualPlayer;
        p.root.rotation.x = -0.35;
        getHandPositions(p, _hand[0], _hand[1]);
        const anchorY = p.y + 4.2;
        _anchor[0].set(-8.0, anchorY, -10.0);
        _anchor[1].set(8.0, anchorY, -10.0);
        const shoot = Math.min(1, anticipationTimer / SHOOT);
        const tension = Math.min(1, anticipationTimer / ANTICIPATION_TIME);
        for (let i = 0; i < 2; i++) {
          _to.lerpVectors(_hand[i], _anchor[i], shoot);
          _to.y += Math.sin(anticipationTimer * 90 + i * 2) * 0.05 * tension; // humming tension
          setLine(i, _hand[i], _to);
          splats[i].visible = shoot >= 1;
          splats[i].position.copy(_anchor[i]);
          splats[i].scale.setScalar(1.4 + (shoot >= 1 ? Math.max(0, 0.6 - (anticipationTimer - SHOOT) * 6) : 0));
        }

        if (anticipationTimer >= ANTICIPATION_TIME) {
          phase = 'flight';
          snapT = 0;

          this.baseSpeed = game?.state ? game.state.speed : 18;
          if (game?.state) game.speedOverride = Math.min(CONFIG.topSpeed + 18, this.baseSpeed + 18);

          p.vy = LAUNCH_VY;
          p.grounded = false;
          p.gravityScale = 0.58;
          p.root.rotation.x = 0.35;
          p.setOverride?.('jump', 2.0);

          // release: squash, then the flight stretch; dust at his feet, edge speed lines,
          // the camera eases back and follows the arc
          sq.v = 0.78;
          sq.vel = 0;
          sq.to = 1.14;
          puffBurst({ x: p.x, y: p.floorY + 0.05, z: 0.1 }, { n: 7, ring: true, radius: 0.45, speed: 3.6, size: 0.6, rise: 0.6, scroll: false });
          sparkBurst({ x: p.x, y: p.y + 0.9, z: 0 }, { n: 8, speed: 5, colors: [0xffffff, 0xdfe8ff], scroll: false });
          kick(-0.5);
          edgeLines(0.55);
          if (actualCameraRig?.setDolly) actualCameraRig.setDolly(2.2, 1);
          actualCameraRig?.setTilt?.(true); // look up with the arc
          triggerCameraShake(actualCameraRig, 0.14, 0.2);

          emit('jump');
          emit('slingshotLaunch', { vy: LAUNCH_VY, speedBoost: game?.speedOverride });
        }
      } else if (phase === 'flight' || phase === 'landing') {
        if (flightTimer > 3.5 && (actualPlayer.grounded || flightTimer > 4.5)) this.deactivate();
      }
    },

    absorbHit(hit) {
      if (!active && phase === 'idle') return false;
      if (actualObstacles) {
        if (hit?.obstacle) actualObstacles.remove(hit.obstacle);
        const list = actualObstacles.active;
        if (list) {
          for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            if (Math.abs(o.x - actualPlayer.x) <= 2.2 && o.z >= -8.0 && (o.z - o.length) <= 3.0) actualObstacles.remove(o);
          }
        }
        actualObstacles.grace(1.5);
      }
      const hitPos = hit?.position || new THREE.Vector3(actualPlayer.x, actualPlayer.y || 1.0, 0);
      chunkBurst(hitPos, { n: 9, force: 8, colors: [0xc9c3d6, 0xc8282e, 0x2b4fa8] });
      sparkBurst(hitPos, { n: 10, speed: 7, colors: [0xffffff, 0xdfe8ff] });
      triggerCameraShake(actualCameraRig, 0.2, 0.25);
      sfx('crash', { position: hitPos.clone() });
      return true;
    },

    refillCharges() {
      charges = maxCharges;
      syncGameCharges();
    },

    deactivate() {
      if (this.baseSpeed != null && game?.state) {
        game.speedOverride = null;
        this.baseSpeed = null;
      }
      const was = active;
      active = false;
      phase = 'idle';
      anticipationTimer = 0;
      flightTimer = 0;
      snapT = -1;
      for (let i = 0; i < 2; i++) { lines[i].visible = false; splats[i].visible = false; }
      lookOff();
      sq.to = 1;
      if (actualPlayer) {
        actualPlayer.gravityScale = 1.0;
        actualPlayer.root.rotation.x = 0;
        if (actualPlayer.override === 'web' || actualPlayer.override === 'jump') actualPlayer.clearOverride?.();
      }
      if (was) emit('specialOff');
    },

    // run start: the charges belong to game.state (web.js); never hand out free ones here
    reset() {
      this.deactivate();
      restoreScale();
      decal.visible = false;
      decalT = -1;
      charges = 0;
    },

    dispose() {
      this.reset();
      if (rootGroup.parent) rootGroup.parent.remove(rootGroup);
    },
  };

  return skill;
}

export default createSpiderman2002Skill;
