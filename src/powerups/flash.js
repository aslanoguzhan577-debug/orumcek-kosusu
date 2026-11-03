// powerups/flash.js — Flaş Fotoğraf (PLAN.md 10): a market consumable that raises the RUN part of
// the score multiplier. In the first 7 seconds of a run the HUD button (or the C key)
// spends one Flaş Fotoğraf: game.mult.run = 4 + the number spent this run, so the first tap makes
// it x5, the next x6, the third x7 and no more. Emitting 'flashBoost' {bonus} is all the feedback
// the rest of the game needs — ui.js owns the button, its HUD banner and the x-badge, shop.js owns
// the stock (localStorage). game._resetRun zeroes the run part every start.
// No THREE in here: tools/test-skills.mjs drives the whole thing in node.

import { game } from '../game.js';
import { emit } from '../events.js';
import { getFlashBoosterCount, useFlashBooster } from '../shop.js';

const WINDOW_SECONDS = 7;   // the boost belongs to the start of a run, like the jet start
const MAX_PER_RUN = 3;      // the three steps of the item: +5, +6, +7

export class FlashBooster {
  constructor() {
    this.uses = 0;
  }

  reset() {
    this.uses = 0;
  }

  get count() {
    return getFlashBoosterCount();
  }

  get available() {
    return this.uses < MAX_PER_RUN
      && getFlashBoosterCount() > 0
      && game.state.mode === 'running'
      && !game.state.intro
      && game.state.time <= WINDOW_SECONDS;
  }

  get windowLeft() {
    if (this.uses >= MAX_PER_RUN) return 0;
    if (game.state.mode !== 'running') return WINDOW_SECONDS;
    return Math.max(0, WINDOW_SECONDS - game.state.time);
  }

  // One tap: spends the item, pays the multiplier, tells everyone about it.
  use() {
    if (!this.available || !useFlashBooster()) return false;
    this.uses++;
    game.mult.run = 4 + this.uses;
    emit('flashBoost', { bonus: game.mult.run });
    return true;
  }
}
