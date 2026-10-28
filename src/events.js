// events.js — the single game event bus. Everyone listens here; game code emits here.
// Names (PLAN.md contract): start, pause, resume, gameover {score, coins, distance},
// jump, land, slide, lane {dir}, coin {position}, stumble, crash {position}, caught,
// pickup {type}, web {from, to}, ironOn, ironOff, ironSave {positions}, venomNear, venomFar.
//
// Listen:  events.addEventListener('jump', (e) => { ... e.detail ... });

export const events = new EventTarget();

export function emit(name, detail = {}) {
  events.dispatchEvent(new CustomEvent(name, { detail }));
}
