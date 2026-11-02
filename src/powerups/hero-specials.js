// powerups/hero-specials.js — hero special skills manager + Hulk, Captain America, Miles.
// Look: "Spider-Verse comic + vinyl toy" (vfxCore.js): cel-shaded outlined shapes, halftone,
// stickers, impact frames, hit-stop, squash & stretch. Everything is built at load and pooled.
//
// 1. HULK "Gamma Smash" (6 s): crouch -> hop -> slam (or a ground pound when used mid-air):
//    freeze frame, cream/green comic panel, the ground breaks into tilted toon slabs with gamma
//    light in the gaps, rubble + dust, SMASH!. Hulk runs 12 % bigger, every step thumps the
//    camera; everything in reach bursts into rubble (same reach / grace as before).
// 2. CAPTAIN AMERICA "Shield Surf" (8 s): a big glossy shield (rings + raised star) under his
//    boots, 0.32 m hover (0.22 sliding), rail sparks streaming back. A block: GONG!, star burst,
//    freeze frame, the shield flips back onto his back and the skill ends (1.5 s grace).
// 3. MILES "Venom Strike" (7 s, +10 m/s): animates "on twos" (12 fps), thin gold bio-electric
//    arcs hug his arms and legs, red / cyan chromatic ghosts glitch in now and then, BZZT! +
//    halftone burst on activation, a camouflage flicker at the end. A block: ZZAP! and the
//    skill ends (1.5 s grace).
// Kitty, Batman, Raimi, Iron Man and Black Panther live in their own skill files.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import { toonMaterial, addOutline } from '../models/toon.js';
import {
  initVfx, updateVfx, resetVfx, VFX_TEXTURES, INK, updateCameraFov,
  chunkBurst, puffBurst, sparkBurst, spark, sticker, burst, groundRing, impactFrame,
  hitStop, kick, sfx, ghostLayer, ghostMaterial, rigOf,
} from '../vfxCore.js';
import { createHelloKittySkill } from './skillHelloKitty.js';
import { createBatmanSkill } from './skillBatman.js';
import { createSpiderman2002Skill } from './skillSpiderman2002.js';
import { createIronManSkill } from './skillIronMan.js';
import { createBlackPantherSkill } from './skillBlackPanther.js';

export const HERO_SKINS = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];

// every canvas texture of the effects (filled at construction, read by main.js's warm-up)
export const HERO_SPECIAL_TEXTURES = VFX_TEXTURES;

const HULK = { glow: 0xe4ff8c, hot: 0xfaffd8, dim: 0x4f8f34, rock: [0xa8a3b5, 0xc9c3d6, 0x8a8499, 0x6cb83e], dust: [0xeee9de, 0xdcd5c7] };
const MILES = { gold: 0xffd23a, white: 0xfff6c8, red: 0xe0263f, cyan: 0x36c8ff };
const CAP = { blue: 0x2f57b5, red: 0xd23a3a, white: 0xf4f4f6, sparks: [0xffd23a, 0xffe98a, 0xffffff] };

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ HULK: gamma ground crack
// Seven jagged concrete slabs that tilt up around the slam point, lime gamma light in the gaps,
// ink cracks running out beyond them. Scrolls away with the world.
function createGammaCrack(scene) {
  const root = new THREE.Group();
  root.name = 'hulkCrack';
  root.visible = false;
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const glowMat = new THREE.MeshBasicMaterial({ color: HULK.glow });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28).rotateX(-Math.PI / 2), glowMat);
  glow.position.y = 0.012;
  root.add(glow);

  const slabMat = toonMaterial(0x8e8696);
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const slabs = [];
  const N = 7, R0 = 0.24;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + 0.11, a1 = ((i + 1) / N) * Math.PI * 2 - 0.11;
    const mid = (a0 + a1) / 2;
    const r1 = 0.9 + rand() * 0.25;
    const pts = [];
    const n = 5;
    for (let k = 0; k <= n; k++) { // outer jagged edge
      const a = a0 + ((a1 - a0) * k) / n;
      const r = r1 * (k % 2 ? 0.9 + rand() * 0.06 : 1);
      pts.push([r * Math.cos(a - mid) - R0, r * Math.sin(a - mid)]);
    }
    for (let k = 2; k >= 0; k--) { // inner edge
      const a = a0 + ((a1 - a0) * k) / 2;
      pts.push([R0 * (k === 1 ? 1.25 : 1) * Math.cos(a - mid) - R0, R0 * Math.sin(a - mid)]);
    }
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }).rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const slab = new THREE.Mesh(geo, slabMat);
    // ink: the same slab scaled up around its own centre, back faces only
    const ink = new THREE.Mesh(geo, inkMat);
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2, cz = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    ink.scale.set(1.06, 1.5, 1.08);
    ink.position.set(cx * -0.06, -0.025, cz * -0.08);
    slab.add(ink);
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(mid) * R0, 0, Math.sin(mid) * R0);
    pivot.rotation.y = -mid;
    const tilt = new THREE.Group();
    pivot.add(tilt);
    tilt.add(slab);
    root.add(pivot);
    slabs.push({ tilt, target: 0.35 + rand() * 0.3 });
  }

  // ink cracks out beyond the slabs, a lime core in their first half
  const cracks = [], cores = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.4;
    const len = 0.9 + rand() * 1.2;
    const pts = [];
    let ang = a;
    for (let k = 0; k <= 4; k++) {
      const r = 0.85 + (len * k) / 4;
      ang += (rand() - 0.5) * 0.35;
      pts.push([Math.cos(ang) * r, Math.sin(ang) * r, ang]);
    }
    const wedge = (w0, upto) => {
      const L = [], Rr = [];
      for (let k = 0; k <= upto; k++) {
        const w = w0 * (1 - k / 4.4);
        const [x, y, an] = pts[k];
        L.push(new THREE.Vector2(x - Math.sin(an) * w, y + Math.cos(an) * w));
        Rr.unshift(new THREE.Vector2(x + Math.sin(an) * w, y - Math.cos(an) * w));
      }
      return new THREE.Shape([...L, ...Rr]);
    };
    cracks.push(wedge(0.085, 4));
    cores.push(wedge(0.032, 2));
  }
  const crackMesh = new THREE.Mesh(new THREE.ShapeGeometry(cracks).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: INK }));
  crackMesh.position.y = 0.014;
  const coreMesh = new THREE.Mesh(new THREE.ShapeGeometry(cores).rotateX(Math.PI / 2), glowMat);
  coreMesh.position.y = 0.018;
  root.add(crackMesh, coreMesh);
  scene.add(root);

  let t = -1;
  return {
    root,
    trigger(x, y, z) {
      root.position.set(x, y, z);
      root.rotation.y = Math.random() * 6.283;
      root.scale.setScalar(1);
      root.visible = true;
      t = 0;
      this.update(0, 0);
    },
    update(dt, dz) {
      if (t < 0) return;
      t += dt;
      root.position.z += dz;
      if (t > 1.3) { t = -1; root.visible = false; return; }
      for (const s of slabs) {
        const k = t < 0.06 ? (t / 0.06) * 1.5 : t < 0.2 ? 1.5 - ((t - 0.06) / 0.14) * 0.5 : 1;
        s.tilt.rotation.z = s.target * k;
        s.tilt.position.y = 0.02 * Math.min(1, t / 0.06);
      }
      glowMat.color.setHex(HULK.hot).lerp(_c0.setHex(HULK.glow), Math.min(1, t / 0.18));
      if (t > 0.5) glowMat.color.lerp(_c0.setHex(HULK.dim), Math.min(1, (t - 0.5) / 0.6));
      if (t > 1.0) { const k = (t - 1.0) / 0.3; root.position.y -= dt * 0.4; root.scale.setScalar(1 - 0.2 * k); }
    },
    hide() { t = -1; root.visible = false; },
  };
}
const _c0 = new THREE.Color();

// ------------------------------------------------------------------ CAP: the surf shield
// A domed lathe with hard-banded vertex colours (red / white / red rings, blue centre), a raised
// glossy star on an ink star, a silver lip; ink outline. Gloss + rim = the fake metal highlight.
function createShieldBoard() {
  const root = new THREE.Group();
  root.name = 'vibraniumShieldBoard';
  const spin = new THREE.Group();
  root.add(spin);
  const R = 0.58;
  const h = (r) => 0.085 * (1 - (r / R) ** 2);
  const bands = [[0, 0.2, 0x2a5bc4], [0.2, 0.31, 0xc8202f], [0.31, 0.42, 0xf4f4f6], [0.42, 0.53, 0xc8202f], [0.53, R, 0xdfe3ec]];
  const prof = [], cols = [];
  for (const [r0, r1, col] of bands) {
    for (const r of [r0 + 0.0015, (r0 + r1) / 2, r1]) { prof.push(new THREE.Vector2(r, h(r))); cols.push(col); }
  }
  prof.push(new THREE.Vector2(R + 0.006, -0.02), new THREE.Vector2(R * 0.82, -0.045), new THREE.Vector2(0.001, -0.05));
  cols.push(0xdfe3ec, 0x26324d, 0x26324d);
  prof.reverse(); // lathe winding: bottom centre -> rim -> top centre faces outward
  cols.reverse();
  const segs = 48;
  const geo = new THREE.LatheGeometry(prof, segs);
  const colors = [];
  const cc = new THREE.Color();
  for (let i = 0; i <= segs; i++) for (let j = 0; j < prof.length; j++) { cc.setHex(cols[j]).convertSRGBToLinear(); colors.push(cc.r, cc.g, cc.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, toonMaterial(0xffffff, {
    vertexColors: true,
    gloss: { color: 0xffffff, threshold: 0.93, strength: 0.85 },
    rim: { color: 0xffffff, threshold: 0.7, strength: 0.35 },
  }));
  addOutline(dome, 0.022, INK);
  spin.add(dome);

  const starShape = (R1, r1) => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r1 : R1;
      i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    return s;
  };
  const inkStar = new THREE.Mesh(new THREE.ShapeGeometry(starShape(0.205, 0.088)).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: INK }));
  inkStar.position.y = h(0) + 0.002;
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.17, 0.07), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }).rotateX(-Math.PI / 2);
  const star = new THREE.Mesh(starGeo, toonMaterial(0xf6f7fb, { gloss: { color: 0xffffff, threshold: 0.9, strength: 1 }, rim: { color: 0xffffff, threshold: 0.6, strength: 0.4 } }));
  star.position.y = h(0) + 0.004;
  spin.add(inkStar, star);
  root.visible = false;
  return { root, spin };
}

// ------------------------------------------------------------------ MILES: bio-electric arcs
// World-space ribbons (gold core over a dark ink ribbon), rebuilt "on twos" along the limbs.
const ARCS = 6, PTS = 7;
function createArcs(scene) {
  const make = (color, order) => {
    const pos = new Float32Array(ARCS * PTS * 2 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let a = 0; a < ARCS; a++) for (let i = 0; i < PTS - 1; i++) {
      const v = (a * PTS + i) * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false;
    m.renderOrder = order;
    m.visible = false;
    scene.add(m);
    return m;
  };
  return {
    ink: make(0x2a0d12, 12),
    core: make(MILES.gold, 13),
    pts: new Float32Array(ARCS * PTS * 3), // relative to the player root
    on: new Uint8Array(ARCS),
  };
}

// ------------------------------------------------------------------ HERO SPECIALS MANAGER
export class HeroSpecials {
  constructor({ scene, player, obstacles, cameraRig, chaser }) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    this.active = false;
    this.mode = null;
    this.timeRemaining = 0;
    this.maxTime = 0;
    this.timeAlive = 0;
    this._lastSmashTime = -Infinity;
    this._lastImpact = -Infinity;
    this.milesBaseSpeed = null;

    initVfx({ scene, cameraRig });

    this.crack = createGammaCrack(scene);
    this.shield = createShieldBoard();
    this.shield.root.position.set(0, -0.02, 0);
    player.root.add(this.shield.root);
    this.arcs = createArcs(scene);

    this.hulk = { phase: null, t: 0, model: null, base: 1, k: 1, kTo: 1, sq: 1, sqV: 0, sqTo: 1, rig: null, cross: 0, steam: 0 };
    this.cap = { exit: -1, hover: 0, acc: 0, pop: 0 };
    this.milesFx = { model: null, update: null, acc: 0, step: 0, ghostT: 0.5, ghostOn: 0, rig: null, layers: null, camo: false };

    this.skills = {
      kitty: createHelloKittySkill({ scene, player, obstacles, cameraRig, chaser }),
      batman: createBatmanSkill({ scene, player, obstacles, cameraRig, chaser }),
      raimi: createSpiderman2002Skill({ scene, player, obstacles, cameraRig, camera: cameraRig?.camera }),
      ironman: createIronManSkill({ scene, player, obstacles, cameraRig }),
      panther: createBlackPantherSkill({ scene, player, obstacles, cameraRig, chaser }),
    };
    this.startDistance = 0;
  }

  // main.js, once the skins exist (still at load): per-skin ghost / overlay layers and rigs.
  prepare(skins) {
    if (skins.hulk) this.hulk.rig = rigOf(skins.hulk);
    if (skins.miles) {
      this.milesFx.rig = rigOf(skins.miles);
      this.milesFx.layers = [ghostMaterial(MILES.red, 0.62, 0.22), ghostMaterial(MILES.cyan, 0.62, 0.22)].map((m) => ghostLayer(skins.miles, m));
    }
    if (skins.panther && this.skills.panther.prepare) this.skills.panther.prepare(skins.panther);
  }

  isHero(skin) {
    return HERO_SKINS.includes(skin);
  }

  getHeroConfig(skin) {
    if (skin === 'hulk') return { name: 'hulk', duration: 6.0, label: 'HULK SMASH', icon: '👊', className: 'hulk' };
    if (skin === 'cap') return { name: 'cap', duration: 8.0, label: 'SHIELD SURF', icon: '🛡️', className: 'cap' };
    if (skin === 'miles') return { name: 'miles', duration: 7.0, label: 'VENOM BLAST', icon: '⚡', className: 'miles' };
    if (skin === 'kitty') return { name: 'kitty', duration: 8.0, label: 'UÇAN KALP', icon: '💖', className: 'kitty' };
    if (skin === 'batman') return { name: 'batman', duration: 8.0, label: 'GECE PELERİNİ', icon: '🦇', className: 'batman' };
    if (skin === 'raimi') return { name: 'raimi', duration: 3.0, label: 'MANCINIK AĞ', icon: '🕸️', className: 'raimi', maxCharges: 2 };
    if (skin === 'ironman') return { name: 'ironman', duration: 2.2, label: 'UNIBEAM', icon: '💥', className: 'ironman' };
    if (skin === 'panther') return { name: 'panther', duration: 5.5, label: 'VİBRANYUM ŞOK', icon: '🟣', className: 'panther' };
    return null;
  }

  _armShield(visible) {
    const s = this.player.root.getObjectByName('capArmShield');
    if (s) s.visible = visible;
  }

  _chest(out) {
    return out.set(this.player.x, this.player.y + 0.9, 0);
  }

  _impact(opts, minGap = 0.45) {
    const now = performance.now() / 1000;
    if (now - this._lastImpact < minGap) return;
    this._lastImpact = now;
    impactFrame({ at: this._chest(_p), ...opts });
  }

  _start(skin, dur) {
    this.active = true;
    this.mode = skin;
    this.timeRemaining = dur;
    this.maxTime = dur;
    this.timeAlive = 0;
  }

  activate(skin, overrideDuration) {
    const cfg = this.getHeroConfig(skin);
    if (!cfg) return false;
    if (this.active || game.halted || (this.player && this.player.controlsLocked)) return false;
    const dur = (overrideDuration && overrideDuration > 0) ? overrideDuration : cfg.duration;
    const p = this.player;

    if (skin === 'hulk') {
      this._start(skin, dur);
      this._lastSmashTime = -Infinity;
      p.clearOverride();
      this.obstacles.grace(0.3);
      if (this.chaser && this.chaser.isNear) this.chaser._dropBack();
      const H = this.hulk;
      if (H.model && H.model !== p.model) this._hulkRestore(); // a previous settle still running
      H.model = p.model;
      H.base = H.model.root.scale.y;
      H.kTo = 1.12;
      H.cross = 0;
      if (p.grounded) { H.phase = 'crouch'; H.t = 0; H.sqTo = 0.78; }
      else { H.phase = 'air'; H.t = 0; p.vy = -CONFIG.fastDropSpeed; H.sqTo = 1.16; } // ground pound
      this.cameraRig.shake(0.08, 0.3);
      emit('hulkRoar');
      emit('specialOn', { mode: this.mode, duration: this.maxTime });
      return true;
    }

    if (skin === 'cap') {
      this._start(skin, dur);
      this.cap.exit = -1;
      this.cap.pop = 0;
      this.shield.root.visible = true;
      this.shield.root.position.set(0, -0.02, 0);
      this._armShield(false);
      if (p.grounded) {
        p.floorY += 0.32;
        p.y = p.floorY;
      }
      this._chest(_p);
      sparkBurst({ x: p.x, y: p.floorY, z: 0.1 }, { n: 14, speed: 6, up: 0.2, colors: CAP.sparks, scroll: false });
      puffBurst({ x: p.x, y: p.floorY - 0.25, z: 0.1 }, { n: 6, ring: true, radius: 0.5, speed: 2.6, size: 0.5, rise: 0.4, colors: HULK.dust, scroll: false });
      kick(0.25);
      this.cameraRig.shake(0.08, 0.2);
      emit('capShieldSurf');
      emit('specialOn', { mode: this.mode, duration: this.maxTime });
      return true;
    }

    if (skin === 'miles') {
      this._start(skin, dur);
      this.milesBaseSpeed = game.state.speed;
      game.speedOverride = Math.min(CONFIG.topSpeed + 10, this.milesBaseSpeed + 10);
      this._milesOn();
      this._chest(_p);
      hitStop(0.06);
      this._impact({ bg: 0xffe066, dot: 0xf2a516, line: MILES.red }, 0);
      burst('halftone', _a.set(p.x, p.y + 0.95, -0.4), { color: MILES.gold, size: 1.2, grow: 3.6, life: 0.4, follow: p.root });
      sticker('bzzt', _a.set(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.3, -1.2), { follow: p.root, life: 0.85 });
      sparkBurst(_p, { n: 18, speed: 7, colors: [MILES.gold, MILES.white, MILES.red], scroll: false });
      kick(0.4);
      this.cameraRig.shake(0.12, 0.25);
      emit('milesVenomBlast');
      emit('specialOn', { mode: this.mode, duration: this.maxTime });
      return true;
    }

    if (skin === 'kitty') {
      if (!this.skills.kitty.activate(dur)) return false;
      this._start(skin, dur);
      return true;
    }

    if (skin === 'batman') {
      this.startDistance = (game.state && typeof game.state.distance === 'number') ? game.state.distance : (game.world?.distance || 0); // ui.js still reads it for the bar
      if (!this.skills.batman.activate(dur)) return false;
      this._start(skin, dur);
      return true;
    }

    if (skin === 'raimi') {
      this.skills.raimi.charges = game.state.webCharges;
      if (!this.skills.raimi.activate()) return false;
      this._start(skin, dur);
      emit('specialOn', { mode: 'raimi', duration: this.maxTime });
      return true;
    }

    if (skin === 'ironman') {
      this.skills.ironman.charges = 1;
      if (!this.skills.ironman.activate()) return false;
      this._start(skin, dur);
      emit('specialOn', { mode: 'ironman', duration: this.maxTime });
      return true;
    }

    if (skin === 'panther') {
      if (!this.skills.panther.activate()) return false;
      this._start(skin, dur);
      return true;
    }
    return false;
  }

  beforePlayer(dt) {
    if (this.skills.kitty && (this.skills.kitty.active || this.skills.kitty.currentFlyOffset > 0)) this.skills.kitty.beforePlayer(dt);
    if (this.skills.batman && (this.skills.batman.active || this.skills.batman.currentFlyOffset > 0)) this.skills.batman.beforePlayer(dt);
    if (!this.active || game.halted) return;

    if (this.mode === 'cap') {
      // 0.32 m hover running / jumping, 0.22 m sliding (clears the high barriers)
      const hover = (this.player.sliding && this.player.grounded) ? 0.22 : 0.32;
      this.cap.hover = hover;
      this.player.floorY += hover;
      if (this.player.grounded) this.player.y = this.player.floorY;
    } else if (this.mode === 'raimi') {
      this.skills.raimi.beforePlayer(dt);
    } else if (this.mode === 'hulk' && this.hulk.phase === 'crouch') {
      this.hulk.t += dt;
      if (this.hulk.t >= 0.11) { // release: hop, then slam on landing
        this.player.jump(0.9);
        this.player.setOverride('run', 1); // a power leap, not the spider flip
        this.hulk.phase = 'air';
        this.hulk.sqTo = 1.16;
        this.hulk.sqV += 6;
      }
    }
  }

  update(dt) {
    updateVfx(dt);
    updateCameraFov(dt);
    const running = game.state.mode === 'running' && !game.halted;
    this.crack.update(dt, running ? game.state.speed * dt : 0);
    this._hulkScale(dt);
    this._capShield(dt);

    if (this.skills.kitty) this.skills.kitty.update(dt);
    if (this.skills.batman) this.skills.batman.update(dt);
    if (this.skills.raimi) this.skills.raimi.update(this.timeAlive, dt);
    if (this.skills.ironman) this.skills.ironman.update(this.timeAlive, dt);
    if (this.skills.panther) this.skills.panther.update(this.timeAlive, dt);

    if (!this.active || game.halted) return;
    this.timeAlive += dt;

    if (this.mode === 'batman') {
      this.timeRemaining = this.skills.batman.timeRemaining;
      if (!this.skills.batman.active || this.timeRemaining <= 0) this.deactivate(true);
      return;
    }
    if (this.mode === 'kitty') {
      this.timeRemaining = this.skills.kitty.timeRemaining;
      if (!this.skills.kitty.active || this.timeRemaining <= 0) this.deactivate(true);
      return;
    }
    if (this.mode === 'raimi') {
      if (!this.skills.raimi.active) this.deactivate(false);
      return;
    }
    if (this.mode === 'ironman' || this.mode === 'panther') {
      const s = this.skills[this.mode];
      this.timeRemaining = s.timeRemaining;
      if (!s.active || this.timeRemaining <= 0) this.deactivate(true);
      return;
    }

    // Hulk, Cap, Miles: duration countdown
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining <= 0) {
      this.deactivate(true);
      return;
    }
    if (this.mode === 'hulk') this._hulkUpdate(dt);
    else if (this.mode === 'cap') this._capRails(dt);
    else if (this.mode === 'miles') {
      if (this.milesBaseSpeed != null) game.speedOverride = Math.min(CONFIG.topSpeed + 10, this.milesBaseSpeed + 10);
      this._milesUpdate(dt);
    }
  }

  // ---------------------------------------------------------------- HULK
  _hulkSlam() {
    const p = this.player;
    const H = this.hulk;
    H.phase = 'run';
    if (p.override === 'run') p.clearOverride();
    H.sq = 0.7; H.sqV = 0; H.sqTo = 1;
    const fy = p.floorY;
    this.crack.trigger(p.x, fy, 0);
    groundRing({ x: p.x, y: fy, z: 0 }, { r0: 0.4, r1: 4.2, width: 0.55, life: 0.42, color: HULK.glow, edge: 0xffffff });
    chunkBurst({ x: p.x, y: fy + 0.15, z: 0 }, { n: 14, force: 8, size: 0.24, colors: HULK.rock, floor: fy });
    puffBurst({ x: p.x, y: fy + 0.1, z: 0 }, { n: 10, ring: true, radius: 0.9, speed: 4.2, size: 0.75, rise: 0.8, colors: HULK.dust, life: 0.6 });
    sticker('smash', _a.set(p.x + (p.x > 0.5 ? -1.3 : 1.3), fy + 2.4, -1.4), { life: 0.9, width: 0.4 });
    hitStop(0.075);
    this._impact({ bg: 0xfdf6d3, dot: 0xd8f08a, line: 0x24502c }, 0);
    kick(0.55);
    this.cameraRig.shake(0.28, 0.4);
    sfx('hulkSmash', { position: _chest(p) });
    // everything right in front is flattened by the slam too
    this._hulkReach(5.2);
  }

  _hulkReach(reach) {
    const p = this.player;
    const list = this.obstacles.active;
    let hitPos = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (Math.abs(o.x - p.x) <= 2.2 && o.z >= -reach && (o.z - o.length) <= 2.2) {
        this.obstacles.remove(o);
        hitPos = _b.set(o.x, 1.0, Math.max(o.z, -3.5));
      }
    }
    if (hitPos) this._hulkSmashFx(hitPos);
    return !!hitPos;
  }

  _hulkSmashFx(pos) {
    this.obstacles.grace(0.25);
    const now = performance.now();
    if (now - this._lastSmashTime <= 120) return;
    this._lastSmashTime = now;
    chunkBurst(pos, { n: 12, force: 9, size: 0.28, colors: [0xc9c3d6, 0xa8a3b5, 0xe0262c, 0xffd23a] });
    puffBurst(pos, { n: 4, size: 0.8, speed: 2.5, colors: HULK.dust });
    sparkBurst(pos, { n: 8, speed: 7, colors: [HULK.glow, 0xffffff] });
    const keys = ['smash', 'krak', 'bam'];
    sticker(keys[(Math.random() * 3) | 0], _a.set(pos.x + (pos.x > this.player.x ? 0.6 : -0.6), pos.y + 1.6, pos.z), { width: 0.3, life: 0.6 });
    hitStop(0.05);
    this._impact({ bg: 0xfdf6d3, dot: 0xd8f08a, line: 0x24502c }, 0.6);
    kick(0.35);
    this.cameraRig.shake(0.22, 0.3);
    sfx('hulkSmash', { position: pos.clone() });
  }

  _hulkUpdate(dt) {
    const p = this.player;
    const H = this.hulk;
    if (p.override === 'stumble') p.clearOverride(); // immune to stumbles
    if (H.phase === 'air') {
      H.sqTo = p.vy > 0 ? 1.16 : 1.08;
      if (p.grounded) this._hulkSlam();
      return; // smashing waits for the slam
    }
    if (H.phase === 'crouch') return;
    this._hulkReach(5.2);

    // footfalls: the legs cross under the body -> a heavy step
    const rig = H.rig;
    if (rig && p.model === H.model && p.grounded && !p.sliding) {
      const c = Math.sign(rig.hipL.rotation.x - rig.hipR.rotation.x);
      if (c && H.cross && c !== H.cross) {
        this.cameraRig.shake(0.045, 0.1);
        H.sqV -= 2.2;
        const side = c > 0 ? 1 : -1;
        puffBurst({ x: p.x + side * 0.22, y: p.floorY + 0.05, z: 0.15 }, { n: 2, size: 0.32, speed: 1.4, rise: 0.4, life: 0.35, colors: HULK.dust, vz: 2 });
      }
      if (c) H.cross = c;
    }
    // gamma steam off the shoulders, small and behind the head
    H.steam -= dt;
    if (H.steam <= 0) {
      H.steam = 0.16;
      const s = Math.random() < 0.5 ? -1 : 1;
      puffBurst({ x: p.x + s * 0.32, y: p.y + 1.15, z: 0.12 }, { n: 1, size: 0.18, speed: 0.4, rise: 1.6, life: 0.45, colors: [0xbfe89a, 0xd8f5b8], drag: 2, scroll: false });
    }
  }

  // root scale (bigger Hulk) + squash & stretch spring; settles back after the skill
  _hulkScale(dt) {
    const H = this.hulk;
    if (!H.model) return;
    if (H.phase === 'crouch') H.sqTo = 0.78;
    H.k += (H.kTo - H.k) * Math.min(1, dt * 8);
    H.sqV += ((H.sqTo - H.sq) * 340 - H.sqV * 16) * dt;
    H.sq += H.sqV * dt;
    const sy = Math.max(0.55, H.sq), sxz = 1 / Math.sqrt(sy);
    H.model.root.scale.set(H.base * H.k * sxz, H.base * H.k * sy, H.base * H.k * sxz);
    if (!this.active || this.mode !== 'hulk') {
      if (Math.abs(H.k - 1) < 0.004 && Math.abs(H.sq - 1) < 0.004 && Math.abs(H.sqV) < 0.05) this._hulkRestore();
    }
  }

  _hulkRestore() {
    const H = this.hulk;
    if (H.model) H.model.root.scale.setScalar(H.base);
    H.model = null;
    H.phase = null;
    H.k = H.kTo = 1;
    H.sq = H.sqTo = 1;
    H.sqV = 0;
  }

  // ---------------------------------------------------------------- CAP
  _capRails(dt) {
    const p = this.player;
    if (!p.grounded) return;
    const ground = p.floorY - this.cap.hover;
    this.cap.acc += dt * (p.sliding ? 120 : 80);
    while (this.cap.acc >= 1) {
      this.cap.acc -= 1;
      const s = Math.random() < 0.5 ? -1 : 1;
      const hex = CAP.sparks[(Math.random() * 3) | 0];
      spark(p.x + s * rnd(0.3, 0.5), ground + 0.03, rnd(0.25, 0.5), s * rnd(0.6, 2.8), rnd(0.8, 2.8), rnd(4, 9), rnd(0.12, 0.24), rnd(0.06, 0.1), hex, false);
    }
  }

  _capShield(dt) {
    const S = this.shield, C = this.cap, p = this.player;
    if (!S.root.visible) return;
    if (C.exit >= 0) { // flips up onto his back, shrinking, then the back shield takes over
      C.exit += dt;
      const t = Math.min(1, C.exit / 0.38);
      const e = smooth(t);
      S.root.position.set(0, -0.02 + (1.0 - -0.02) * e + Math.sin(t * Math.PI) * 0.6, 0.22 * e);
      S.root.rotation.set(-t * Math.PI * 3, 0, 0);
      S.root.scale.setScalar(1 - 0.55 * e);
      if (t >= 1) {
        S.root.visible = false;
        S.root.rotation.set(0, 0, 0);
        S.root.scale.setScalar(1);
        S.root.position.set(0, -0.02, 0);
        C.exit = -1;
        if (!(this.active && this.mode === 'cap')) this._armShield(true);
        sparkBurst(_a.set(p.x, p.y + 1.0, 0.25), { n: 6, speed: 3, colors: [0xffffff, CAP.sparks[0]], scroll: false });
      }
      return;
    }
    C.pop += dt;
    const k = C.pop < 0.08 ? 0.4 + (C.pop / 0.08) * 0.8 : C.pop < 0.2 ? 1.2 - ((C.pop - 0.08) / 0.12) * 0.2 : 1;
    S.root.scale.setScalar(k);
    S.spin.rotation.y += dt * 7;
    S.root.rotation.x = THREE.MathUtils.clamp(-p.vy * 0.012, -0.18, 0.18) + (C.pop < 0.18 ? (1 - C.pop / 0.18) * Math.PI * 2 : 0);
  }

  _capExit() {
    this.cap.exit = 0;
    this.shield.root.rotation.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- MILES
  _milesOn() {
    const M = this.milesFx;
    const model = this.player.model;
    M.model = model;
    M.update = model.update;
    M.acc = 0;
    M.step = 0;
    M.ghostT = 0.35;
    M.ghostOn = 0;
    M.camo = false;
    const orig = M.update;
    model.update = (dt, speed) => { // "on twos": the pose advances in 12 fps steps
      M.acc += dt;
      if (M.acc < 1 / 12) return;
      const n = Math.ceil(M.acc / CONFIG.dtCap);
      for (let i = 0; i < n; i++) orig(M.acc / n, speed);
      M.acc = 0;
      M.step++;
    };
    this.arcs.ink.visible = this.arcs.core.visible = true;
    this._milesArcs(true);
  }

  _milesOff() {
    const M = this.milesFx;
    if (M.model && M.update) M.model.update = M.update;
    M.model = null;
    M.update = null;
    this.arcs.ink.visible = this.arcs.core.visible = false;
    this._milesCamo(false);
    if (M.layers) for (const l of M.layers) l.setVisible(false);
  }

  _milesCamo(on) {
    const M = this.milesFx;
    if (!M.layers || M.camo === on) return;
    M.camo = on;
    for (const o of M.layers[0].originals) o.visible = !on;
  }

  // new arc paths along shoulder -> elbow -> hand and hip -> knee -> foot (+ two hand sparks)
  _milesArcs(regen) {
    const M = this.milesFx, A = this.arcs, p = this.player;
    const rig = M.rig;
    if (!rig || p.model !== M.model) { A.ink.visible = A.core.visible = false; return; }
    const root = p.root.position;
    if (regen) {
      const chains = [
        [rig.shoulderR, rig.elbowR, rig.hand], [rig.shoulderL, rig.elbowL, null],
        [rig.hipR, rig.kneeR, null], [rig.hipL, rig.kneeL, null],
      ];
      for (let a = 0; a < ARCS; a++) {
        A.on[a] = Math.random() < (a < 4 ? 0.72 : 0.5) ? 1 : 0;
        if (!A.on[a]) continue;
        if (a < 4) {
          const [j0, j1, j2] = chains[a];
          j0.getWorldPosition(_a);
          j1.getWorldPosition(_b);
          if (j2) j2.getWorldPosition(_c);
          else _c.copy(_b).sub(_a).multiplyScalar(0.95).add(_b); // forearm / shin end
        } else { // a short spark jumping off a hand
          (a === 4 ? rig.hand : rig.elbowL).getWorldPosition(_a);
          _b.set(_a.x + rnd(-0.25, 0.25), _a.y + rnd(-0.1, 0.25), _a.z + rnd(-0.1, 0.2));
          _c.set(_b.x + rnd(-0.25, 0.25), _b.y + rnd(-0.15, 0.2), _b.z);
        }
        for (let i = 0; i < PTS; i++) {
          const t = i / (PTS - 1);
          const u = t * 2;
          if (u <= 1) _p.lerpVectors(_a, _b, u); else _p.lerpVectors(_b, _c, u - 1);
          const j = i === 0 || i === PTS - 1 ? 0.02 : 0.11;
          const k = (a * PTS + i) * 3;
          A.pts[k] = _p.x - root.x + rnd(-j, j);
          A.pts[k + 1] = _p.y - root.y + rnd(-j, j);
          A.pts[k + 2] = _p.z - root.z + rnd(-j * 0.5, j * 0.5);
        }
      }
    }
    const cam = this.cameraRig.camera.position;
    const ip = A.ink.geometry.attributes.position, cp = A.core.geometry.attributes.position;
    for (let a = 0; a < ARCS; a++) {
      for (let i = 0; i < PTS; i++) {
        const k = (a * PTS + i) * 3;
        const v = (a * PTS + i) * 2;
        if (!A.on[a]) { ip.setXYZ(v, 0, -50, 0); ip.setXYZ(v + 1, 0, -50, 0); cp.setXYZ(v, 0, -50, 0); cp.setXYZ(v + 1, 0, -50, 0); continue; }
        _p.set(A.pts[k] + root.x, A.pts[k + 1] + root.y, A.pts[k + 2] + root.z);
        const i0 = Math.max(0, i - 1) * 3 + a * PTS * 3, i1 = Math.min(PTS - 1, i + 1) * 3 + a * PTS * 3;
        _a.set(A.pts[i1] - A.pts[i0], A.pts[i1 + 1] - A.pts[i0 + 1], A.pts[i1 + 2] - A.pts[i0 + 2]); // tangent
        _b.subVectors(cam, _p).normalize();                                                        // to camera
        _c.crossVectors(_a, _b).normalize();
        _p.addScaledVector(_b, 0.14);
        const taper = 1 - Math.abs(i / (PTS - 1) - 0.5);
        const wi = 0.055 * taper + 0.014, wc = 0.026 * taper + 0.006;
        ip.setXYZ(v, _p.x + _c.x * wi, _p.y + _c.y * wi, _p.z + _c.z * wi);
        ip.setXYZ(v + 1, _p.x - _c.x * wi, _p.y - _c.y * wi, _p.z - _c.z * wi);
        _p.addScaledVector(_b, 0.01);
        cp.setXYZ(v, _p.x + _c.x * wc, _p.y + _c.y * wc, _p.z + _c.z * wc);
        cp.setXYZ(v + 1, _p.x - _c.x * wc, _p.y - _c.y * wc, _p.z - _c.z * wc);
      }
    }
    ip.needsUpdate = cp.needsUpdate = true;
  }

  _milesUpdate(dt) {
    const M = this.milesFx, p = this.player;
    const step = M.step;
    const regen = step !== M.lastStep;
    M.lastStep = step;
    this._milesArcs(regen);
    if (regen && Math.random() < 0.3) {
      M.rig?.hand.getWorldPosition(_a);
      sparkBurst(_a, { n: 2, speed: 3, colors: [MILES.gold, MILES.white], life: 0.18, width: 0.04, scroll: false });
    }
    if (!M.layers) return;
    const [red, cyan] = M.layers;
    const camo = this.timeRemaining < 0.5;
    if (regen) {
      // chromatic glitch: now and then for 2 steps, red / cyan copies jump out to the sides
      M.ghostT -= 1 / 12;
      if (M.ghostOn > 0) M.ghostOn--;
      else if (M.ghostT <= 0) { M.ghostOn = 2; M.ghostT = rnd(0.3, 0.6); }
      if (camo) this._milesCamo(step % 3 !== 0); // camouflage flicker: mostly see-through
      const show = M.ghostOn > 0 || M.camo;
      red.setVisible(show);
      cyan.setVisible(show);
      if (show) {
        const d = M.camo ? 0.03 : rnd(0.07, 0.12);
        const r = red.meshes[0]?.material.uniforms, c = cyan.meshes[0]?.material.uniforms;
        if (r && c) {
          r.uOffset.value.set(-d, rnd(-0.03, 0.03), 0);
          c.uOffset.value.set(d, rnd(-0.03, 0.03), 0);
          r.uAlpha.value = c.uAlpha.value = M.camo ? 0.38 : 0.62;
          r.uPush.value = c.uPush.value = M.camo ? 0 : 0.22;
        }
      }
    }
    if (red.on) { red.sync(); cyan.sync(); }
  }

  // ---------------------------------------------------------------- hits
  absorbHit(hit) {
    if (!this.active) return false;
    const p = this.player;

    if (this.mode === 'hulk') {
      if (hit?.obstacle) this.obstacles.remove(hit.obstacle);
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - p.x) <= 2.2 && o.z >= -8.0 && (o.z - o.length) <= 3.0) this.obstacles.remove(o);
      }
      this.obstacles.grace(0.35);
      this._hulkSmashFx(hit?.position ? _b.copy(hit.position) : _b.set(p.x, 1.0, -0.5));
      return true;
    }

    if (this.mode === 'cap' || this.mode === 'miles') {
      const mode = this.mode;
      this.deactivate(false);
      if (hit?.obstacle) this.obstacles.remove(hit.obstacle);
      const list = this.obstacles.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if (Math.abs(o.x - p.x) <= 1.8 && o.z > -7.0 && (o.z - o.length) < 2.0) this.obstacles.remove(o);
      }
      const at = hit?.position ? _b.copy(hit.position) : _b.set(p.x, 1.0, -0.6);
      at.z = Math.min(at.z, -0.4);
      hitStop(0.08);
      kick(0.45);
      this.cameraRig.shake(0.26, 0.35);
      if (mode === 'cap') {
        burst('star', _a.copy(at).setY(at.y + 0.2), { size: 0.6, grow: 3, life: 0.35, spin: 3 });
        groundRing({ x: p.x, y: p.floorY, z: 0 }, { r0: 0.5, r1: 3.2, width: 0.28, life: 0.32, color: 0x8fb0ff, edge: 0xffffff });
        sparkBurst(at, { n: 24, speed: 9, colors: CAP.sparks, up: 0.2 });
        chunkBurst(at, { n: 8, force: 7, size: 0.22, colors: [0xc9c3d6, 0xe0262c, 0xffd23a] });
        sticker('gong', _a.set(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.3, -1.4), { life: 0.85 });
        this._impact({ bg: 0xfff3e0, dot: 0xf6c6c0, line: CAP.blue }, 0);
        sfx('capShieldGong', { position: at.clone() });
      } else {
        burst('halftone', _a.copy(at), { color: MILES.gold, size: 1, grow: 3.4, life: 0.35 });
        sparkBurst(at, { n: 26, speed: 10, colors: [MILES.gold, MILES.white, MILES.red] });
        chunkBurst(at, { n: 8, force: 8, size: 0.22, colors: [0x2a0d12, MILES.red, MILES.gold] });
        sticker('zzap', _a.set(p.x + (p.x > 0.5 ? -1.2 : 1.2), p.y + 2.3, -1.4), { life: 0.85 });
        this._impact({ bg: 0xffe066, dot: 0xf2a516, line: MILES.red }, 0);
        sfx('venomBlastNova', { position: at.clone() });
      }
      this.obstacles.grace(1.5);
      return true;
    }

    if (this.mode === 'kitty' && this.skills.kitty) return this.skills.kitty.absorbHit(hit);
    if (this.mode === 'batman' && this.skills.batman) {
      const res = this.skills.batman.absorbHit(hit);
      if (!this.skills.batman.active) this.deactivate(false);
      return res;
    }
    if (this.mode === 'raimi' && this.skills.raimi) return this.skills.raimi.absorbHit(hit);
    if (this.mode === 'ironman' && this.skills.ironman) return this.skills.ironman.absorbHit(hit);
    if (this.mode === 'panther' && this.skills.panther) return this.skills.panther.absorbHit(hit);
    return false;
  }

  deactivate(expired = false) {
    const mode = this.mode;
    this.active = false;
    this.timeRemaining = 0;

    if (mode === 'kitty' && this.skills.kitty?.active) this.skills.kitty.deactivate(expired);
    if (mode === 'batman' && this.skills.batman?.active) this.skills.batman.deactivate(expired);
    if (mode === 'raimi' && this.skills.raimi?.active) this.skills.raimi.deactivate();
    if (mode === 'ironman' && this.skills.ironman?.active) this.skills.ironman.deactivate(expired);
    if (mode === 'panther' && this.skills.panther?.active) this.skills.panther.deactivate();

    if (mode === 'hulk') {
      this.hulk.kTo = 1;
      this.hulk.sqTo = 1;
      this.hulk.sqV -= 4; // a last vinyl wobble while he shrinks back
      this.hulk.phase = null;
      if (expired) this.obstacles.grace(0.5);
    }
    if (mode === 'cap') {
      this._capExit();
      if (this.player.grounded) {
        this.player.floorY = Math.max(0, this.player.floorY - 0.32);
        this.player.y = this.player.floorY;
      }
    }
    if (mode === 'miles') this._milesOff();
    if (mode === 'miles' || mode === 'raimi' || this.milesBaseSpeed != null) {
      game.speedOverride = null;
      this.milesBaseSpeed = null;
    }
    this.mode = null;
    emit('specialOff');
  }

  reset() {
    if (this.active) this.deactivate(false);
    for (const s of Object.values(this.skills)) if (s && typeof s.reset === 'function') s.reset();
    resetVfx();
    this.crack.hide();
    this._hulkRestore();
    this._milesOff();
    this.cap.exit = -1;
    this.shield.root.visible = false;
    this.shield.root.rotation.set(0, 0, 0);
    this.shield.root.scale.setScalar(1);
    this.shield.root.position.set(0, -0.02, 0);
    this._armShield(true);
    this.timeRemaining = 0;
    this.timeAlive = 0;
    this.mode = null;
    this._lastSmashTime = -Infinity;
    this.startDistance = 0;
  }

  dispose() {
    this.reset();
    for (const s of Object.values(this.skills)) if (s && typeof s.dispose === 'function') s.dispose();
  }
}

function _chest(p) {
  return new THREE.Vector3(p.x, p.y + 0.9, 0);
}
