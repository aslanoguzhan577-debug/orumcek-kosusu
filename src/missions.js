// missions.js (PLAN.md 10) — three missions make one set; finishing a set raises the score
// multiplier base by 1, permanently (x30 at most). Progress is counted from the event bus only,
// never from the game's own logic; the save (spidey.missions) is written when a mission completes
// and at game over, not every frame. A broken or stale save starts over at set 1.
//
// Set N is picked from the seed N, so every player sees the same missions in the same order.
// "Tek koşuda" (onerun) missions start over at every run start unless already finished.
//
// makeSet / count / reach / completeSet are pure (plain objects in and out) so that
// tools/test-skills.mjs can drive them in node without a browser.

import { game } from './game.js';
import { emit, events } from './events.js';
import { createRng } from './patterns.js';

const KEY = 'spidey.missions';
const PER_SET = 3;
const MAX_BASE = 30;

// goal = base + growth * (set - 1)
export const MISSION_POOL = [
  { id: 'coins',     text: '{n} altın topla',                    base: 50,   growth: 25 },
  { id: 'coinsRun',  text: 'Tek koşuda {n} altın topla',         base: 25,   growth: 10, onerun: true },
  { id: 'jump',      text: '{n} kez zıpla',                      base: 30,   growth: 15 },
  { id: 'jumpRun',   text: 'Tek koşuda {n} kez zıpla',           base: 12,   growth: 6,  onerun: true },
  { id: 'slide',     text: '{n} kez kay',                        base: 15,   growth: 8 },
  { id: 'lane',      text: '{n} kez şerit değiştir',             base: 25,   growth: 12 },
  { id: 'web',       text: '{n} kez ağ at',                      base: 10,   growth: 5 },
  { id: 'powerup',   text: '{n} güç topla',                      base: 4,    growth: 2 },
  { id: 'magnet',    text: '{n} mıknatıs topla',                 base: 2,    growth: 1 },
  { id: 'sense',     text: 'Örümcek hissiyle {n} kez kaç',        base: 4,    growth: 3 },
  { id: 'iron',      text: 'Iron Spider ile {n} kez kurtul',      base: 3,    growth: 2 },
  { id: 'special',   text: '{n} kez kahraman yeteneği kullan',    base: 3,    growth: 2 },
  { id: 'scoreRun',  text: 'Tek koşuda {n} puan yap',            base: 1200, growth: 600, onerun: true },
  { id: 'noStumble', text: 'Tökezlemeden {n} m koş',             base: 300,  growth: 150, onerun: true },
  { id: 'noCoins',   text: 'Altın toplamadan {n} puan yap',      base: 700,  growth: 350, onerun: true },
];

const BY_ID = new Map(MISSION_POOL.map((d) => [d.id, d]));

export function missionText(id, goal) {
  const def = BY_ID.get(id);
  return def ? def.text.replace('{n}', String(goal)) : '';
}

export function goalFor(def, set) {
  return def.base + def.growth * (set - 1);
}

export function makeSet(set) {
  const rng = createRng(set * 7919);
  const pool = MISSION_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) { // Fisher-Yates
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, PER_SET).map((def) => ({ id: def.id, goal: goalFor(def, set), progress: 0, done: false }));
}

function finish(it) {
  it.progress = it.goal;
  it.done = true;
  return it;
}

// One counted event (a coin, a jump ...). Returns the items that just completed.
export function count(items, id, by = 1) {
  const done = [];
  for (const it of items) {
    if (it.id !== id || it.done) continue;
    it.progress = Math.min(it.goal, Math.max(0, it.progress + by));
    if (it.progress >= it.goal) done.push(finish(it));
  }
  return done;
}

// A measured value (the run's score, metres since the last stumble ...). It may fall back to 0:
// that is how a "tek koşuda" value mission is lost mid-run. Returns the items that just completed.
export function reach(items, id, value) {
  const done = [];
  for (const it of items) {
    if (it.id !== id || it.done) continue;
    it.progress = Math.min(it.goal, Math.max(0, Math.floor(value)));
    if (it.progress >= it.goal) done.push(finish(it));
  }
  return done;
}

// All three done -> next set, level +1 (base = 1 + level, never above MAX_BASE).
// Returns { set, multiplier } or null while the set is still open.
export function completeSet(save) {
  if (!save.items.length || !save.items.every((it) => it.done)) return null;
  save.level = Math.min(save.level + 1, MAX_BASE - 1);
  save.set += 1;
  save.items = makeSet(save.set);
  return { set: save.set, multiplier: 1 + save.level };
}

function defaults() {
  return { set: 1, level: 0, items: makeSet(1) };
}

// null = broken or stale save (unknown mission, other amounts, other order, bad numbers).
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!Number.isInteger(s.set) || s.set < 1) return null;
    if (!Number.isInteger(s.level) || s.level < 0 || s.level > s.set - 1) return null;
    if (!Array.isArray(s.items) || s.items.length !== PER_SET) return null;
    const fresh = makeSet(s.set);
    const items = [];
    for (let i = 0; i < PER_SET; i++) {
      const want = fresh[i];
      const got = s.items[i];
      if (!got || got.id !== want.id || got.goal !== want.goal) return null;
      const progress = Number(got.progress);
      if (!Number.isFinite(progress) || progress < 0) return null;
      items.push({
        id: want.id,
        goal: want.goal,
        progress: Math.floor(Math.min(want.goal, progress)),
        done: Boolean(got.done) || progress >= want.goal,
      });
    }
    return { set: s.set, level: Math.min(s.level, MAX_BASE - 1), items };
  } catch (e) { return null; }
}

export const missions = load() || defaults();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(missions)); } catch (e) { /* private mode etc. */ }
}

function applyBase() {
  game.mult.base = Math.min(MAX_BASE, 1 + missions.level);
}

function onDone(done) {
  for (const it of done) emit('missionDone', { id: it.id, text: missionText(it.id, it.goal) });
  const up = completeSet(missions);
  applyBase();
  persist();
  if (up) emit('missionSet', up);
}

function bump(ids, by) {
  const items = missions.items; // the whole event counts into the set that is open now
  const done = [];
  for (const id of ids) done.push(...count(items, id, by));
  if (done.length) onDone(done);
}

// Which missions each event feeds.
const COUNTED = {
  coin: ['coins', 'coinsRun'],
  jump: ['jump', 'jumpRun'],
  slide: ['slide'],
  lane: ['lane'],
  web: ['web'],
  senseDodge: ['sense'],
  ironSave: ['iron'],
  specialOn: ['special'],
};
for (const name in COUNTED) events.addEventListener(name, () => bump(COUNTED[name], 1));

// Every pickup is a power-up; the magnet one is also the magnet mission.
events.addEventListener('pickup', (e) => {
  const ids = ['powerup'];
  if (e.detail && e.detail.type === 'magnet') ids.push('magnet');
  bump(ids, 1);
});

// The run-value missions are measured every frame (no events carry them); a stumble restarts
// the "tökezlemeden" stretch, a coin voids the "altın toplamadan" run.
let stumbleAt = 0;
const MEASURED = {
  scoreRun: (st) => st.score,
  noStumble: (st) => st.distance - stumbleAt,
  noCoins: (st) => (st.coins > 0 ? 0 : st.score),
};

events.addEventListener('stumble', () => { stumbleAt = game.state.distance; });
events.addEventListener('gameover', persist);

applyBase();

game.addSystem({
  reset() {
    stumbleAt = 0;
    for (const it of missions.items) if (!it.done && BY_ID.get(it.id).onerun) it.progress = 0;
  },
  update() {
    const st = game.state;
    const items = missions.items; // a finished set is swapped out; its leftovers are all done
    for (const it of items) {
      const measure = MEASURED[it.id];
      if (!measure || it.done) continue;
      const v = measure(st);
      if (Math.floor(v) === it.progress) continue;
      const done = reach(items, it.id, v);
      if (done.length) onDone(done);
    }
  },
});
