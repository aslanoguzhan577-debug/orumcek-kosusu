import { CONFIG } from './config.js';
import { game } from './game.js';
import { events, emit } from './events.js';
import { createRng } from './patterns.js';
import { nextRow, nearestSafe, restAt, rewardFor } from './event-logic.js';
import { laneX } from './world.js';

const E = CONFIG.events, V = E.venom;

export class RoadEvents {
  constructor({ player, obstacles, chaser, art = {} }) {
    this.player = player;
    this.obstacles = obstacles;
    this.chaser = chaser;
    this.art = art;
    this.reset();
    events.addEventListener('gameover', () => {
      if (this.active) this._end(true);
      this.reset();
    });
  }

  reset() {
    if (this.chaser.hunting) this.chaser.endHunt(false);
    this._hide();
    this.active = null;
    this.strike = null;
    this.t = this.cooldown = this.hits = this.dodged = 0;
    this.outroAt = null;
    game.state.eventKind = null;
    game.state.eventTime = 0;
    game.state.eventBonusTime = 0;
    game.mult.event = 0;
    this.rng = createRng((this.obstacles.seed ^ 0x9e3779b9) >>> 0);
  }

  _calm() {
    return game.speedOverride == null && !game.swing?.active && !game.wall?.active
      && !game.web?.zipping && !game.heroSpecials?.active && game.state.tracerTime <= 0
      && !this.player.controlsLocked;
  }

  start(kind) {
    if (kind !== 'venom' || this.active || game.state.mode !== 'running' || game.state.intro
      || game.halted || game.world.distance < E.firstAt || !this._calm() || this.chaser.mode !== 'away') return false;
    this._begin({ kind, d: game.world.distance, len: 1e9 });
    return true;
  }

  _begin(zone) {
    this.active = zone;
    this.t = this.cooldown = this.hits = this.dodged = 0;
    this.strike = null;
    this.outroAt = null;
    game.state.eventKind = zone.kind;
    game.state.eventTime = E[zone.kind].duration;
    this.chaser.hunt();
    this.chaser.pose = 'roar';
    emit('eventStart', { kind: zone.kind, duration: E[zone.kind].duration });
  }

  update(dt) {
    if (game.state.mode !== 'running' || game.state.intro) return;
    if (game.halted) {
      if (this.active) this._end(true);
      return;
    }
    const st = game.state;
    if (st.eventBonusTime > 0) {
      st.eventBonusTime = Math.max(0, st.eventBonusTime - dt);
      if (st.eventBonusTime === 0) { game.mult.event = 0; emit('eventBonusOff'); }
    }
    if (!this.active) return;
    if (!this._calm()) { this._end(true); return; }
    this.t += dt;
    st.eventTime = Math.max(0, V.duration - this.t);
    const z = this.active;
    if (game.world.distance > z.d + z.len - st.speed * E.endMargin) {
      this._finish();
      return;
    }
    this._venom(dt);
  }

  _venom(dt) {
    const d = game.world.distance;
    if (this.t >= 0.9 && this.outroAt == null) this.chaser.pose = 'reach';
    if (this.cooldown > 0) this.cooldown -= dt;
    if (!this.strike && this.t >= V.intro && this.cooldown <= 0 && this.t < V.duration - V.outro) {
      const lane = this.player.lane;
      const row = nextRow(this.rng, [lane === 0, lane === 1, lane === 2], lane, d);
      // A double may require a longer warning than the base tempo; fit that actual warning.
      if (V.duration - V.outro - this.t >= row.warn + V.slamTime) {
        this.strike = { ...row, left: row.warn, phase: 'warn', hit: false };
        emit('strikeWarn', { lanes: this._lanes(row.deadly), warn: row.warn });
      }
    }
    const s = this.strike;
    if (s) {
      if (s.phase === 'warn') {
        s.left -= dt;
        this._sense(s.deadly, s.left);
        if (s.left <= 0) {
          s.phase = 'slam';
          s.left = V.slamTime;
          emit('strikeSlam', { lanes: this._lanes(s.deadly) });
        }
      } else {
        if (!s.hit) {
          for (let lane = 0; lane < 3; lane++) {
            if (!s.deadly[lane]) continue;
            if (Math.abs(this.player.x - laneX(lane)) < E.laneHalf && this.player.y < E.hitHeight && !this.obstacles.graced) {
              if (this.obstacles.eventHit(laneX(lane))) {
                s.hit = true;
                this.hits++;
                emit('strikeHit', { position: this._position(0.8) });
              }
              break;
            }
          }
        }
        if (game.halted) { this._end(true); return; }
        s.left -= dt;
        if (s.left <= 0) {
          if (!s.hit) {
            this.dodged++;
            emit('eventDodge', { kind: this.active.kind, position: this._position() });
          }
          this.strike = null;
          this.cooldown = restAt(d);
        }
      }
    }
    if (!this.strike && this.t >= V.duration - V.outro && this.outroAt == null) this.outroAt = this.t;
    if (this.outroAt != null) this.chaser.pose = this.hits ? 'roar' : this.t - this.outroAt < 0.6 ? 'catch' : 'run';
    if (this.t >= V.duration && !this.strike) this._finish();
  }

  _sense(deadly, left) {
    const p = this.player;
    if (game.state.senseTime <= 0 || left > E.senseActTime || !deadly[p.lane]) return;
    const dir = Math.sign(nearestSafe(deadly, p.lane) - p.lane);
    if (dir && p.changeLane(dir)) {
      game.sense.dodges++;
      emit('senseDodge', { action: dir < 0 ? 'left' : 'right', position: this._position() });
    }
  }

  _lanes(deadly) { return [0, 1, 2].filter((lane) => deadly[lane]); }
  _position(y = 0) { return { x: this.player.x, y: this.player.y + y, z: 0 }; }

  _finish() {
    const kind = this.active.kind, r = rewardFor(kind, this.dodged, this.hits);
    game.state.coins += r.coins;
    game.mult.event = r.mult;
    game.state.eventBonusTime = E.bonusTime;
    emit('eventReward', { kind, ...r, position: this._position(1.6) });
    this._end(false);
  }

  _end(aborted) {
    const kind = this.active.kind;
    this._hide();
    this.chaser.endHunt(this.hits > 0);
    this.active = null;
    this.strike = null;
    game.state.eventKind = null;
    game.state.eventTime = 0;
    emit('eventEnd', { kind, clean: !aborted && this.hits === 0, hits: this.hits, dodged: this.dodged, aborted });
  }

  _hide() {
    for (let lane = 0; lane < 3; lane++) this.art.warnings?.hide(lane);
    for (const tendril of this.art.tendrils || []) tendril.mesh.visible = false;
    for (const kind of ['bombs', 'markers', 'columns']) this.art[kind]?.count(0);
    if (this.art.goblin) this.art.goblin.root.visible = false;
    if (this.art.shadow) this.art.shadow.visible = false;
  }
}
