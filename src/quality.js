// quality.js — adaptive resolution: steps the renderer's pixel ratio down while frames stay
// slow and back up when there is headroom. Settings: CONFIG.render.adaptive.
// Paused / hidden / loading time never counts (the caller only feeds real running frames).

import { CONFIG } from './config.js';

const A = CONFIG.render.adaptive;

export function createAdaptiveRatio(onChange) {
  const top = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio);
  const steps = [top, ...A.steps.filter((r) => r < top)];
  let idx = 0;
  let avg = 1000 / 60;
  let slow = 0, fast = 0, calm = 0, settle = 0;
  let lock = A.lockTime, lockLeft = 0, clock = 0, upAt = -1e9;

  function go(i) {
    idx = i;
    slow = fast = calm = 0;
    settle = A.settle;
    avg = (A.slowMs + A.fastMs) / 2;
    onChange(steps[idx]);
  }

  return {
    get ratio() { return steps[idx]; },
    // frameMs: time since the previous rendered frame (ms); call once per real frame
    tick(frameMs) {
      const dt = frameMs / 1000;
      if (frameMs > 250) { slow = fast = calm = 0; return; } // hidden tab / long pause: ignore
      if (settle > 0) { settle -= dt; return; }
      lockLeft -= dt;
      clock += dt;
      avg += (frameMs - avg) * 0.1;
      slow = avg > A.slowMs ? slow + dt : 0;
      fast = avg < A.fastMs ? fast + dt : 0;
      calm = avg <= A.slowMs ? calm + dt : 0;
      if (slow >= A.slowTime && idx < steps.length - 1) {
        // dropping again soon after a step up = that step up was too much: wait longer next time
        lock = clock - upAt < A.lockTime ? Math.min(lock * 2, 480) : A.lockTime;
        lockLeft = lock;
        go(idx + 1);
      } else if (idx > 0 && lockLeft <= 0 && (fast >= A.fastTime || calm >= A.probeTime)) {
        upAt = clock;
        go(idx - 1);
      }
    },
  };
}
