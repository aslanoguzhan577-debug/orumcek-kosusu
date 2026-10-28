// input.js — turns keyboard, touch swipes, taps and mouse drags into game actions.
// It knows nothing about the game: it only calls onAction(name) with one of
//   'left' | 'right' | 'up' | 'down'   (swipe or arrows / WASD)
//   'double'                           (double tap or Space)  -> G10 Iron Spider
//   'tap'                              (single tap or Enter)  -> start / resume placeholder
//   'pause'                            (P or Escape)
//
// Gesture rules:
// - A swipe fires as soon as the finger passes CONFIG.input.swipeThreshold on its
//   dominant axis, and only once per touch.
// - A tap is a touch that barely moved and was short. Two taps close in time and
//   space make a 'double'. Any swipe clears the pending tap, so a swipe can never
//   become half of a double tap.
// - Only the first finger counts; extra fingers are ignored.
// Pointer events are read from the canvas only, so UI buttons above it still work.

import { CONFIG } from './config.js';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'double',
  Enter: 'tap',
  KeyP: 'pause', Escape: 'pause',
};

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function createInput(canvas, onAction) {
  const cfg = CONFIG.input;
  let active = null;   // the touch/drag being tracked
  let lastTap = null;  // { t, x, y } of the previous tap, for double tap

  // ---------- keyboard ----------
  function onKeyDown(e) {
    if (isTypingTarget(e.target)) return;
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    onAction(action);
  }

  // ---------- pointer (touch + mouse drag) ----------
  function onPointerDown(e) {
    if (active) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    active = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      fired: false,
      moved: false,
    };
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function onPointerMove(e) {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    const dx = e.clientX - active.x0;
    const dy = e.clientY - active.y0;
    if (!active.moved && Math.hypot(dx, dy) > cfg.tapSlop) active.moved = true;
    if (active.fired) return;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < cfg.swipeThreshold) return;
    active.fired = true;
    lastTap = null;
    if (ax > ay) onAction(dx < 0 ? 'left' : 'right');
    else onAction(dy < 0 ? 'up' : 'down');
  }

  function onPointerUp(e) {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    const now = performance.now();
    const isTap = !active.fired && !active.moved && (now - active.t0) <= cfg.tapMaxTime * 1000;
    active = null;
    if (!isTap) {
      lastTap = null;
      return;
    }
    if (lastTap &&
        now - lastTap.t <= cfg.doubleTapWindow * 1000 &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <= cfg.doubleTapDistance) {
      lastTap = null;
      onAction('double');
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      onAction('tap');
    }
  }

  function onPointerCancel(e) {
    if (active && e.pointerId === active.id) active = null;
    lastTap = null;
  }

  // Forget half-finished gestures (called on start/resume so the tap that
  // started the run cannot pair with the next tap into a double tap).
  function reset() {
    active = null;
    lastTap = null;
  }

  const prevent = (e) => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  // Stop the browser from scrolling, zooming, long-press menus and fake mouse events.
  canvas.addEventListener('touchstart', prevent, { passive: false });
  canvas.addEventListener('touchmove', prevent, { passive: false });
  canvas.addEventListener('touchend', prevent, { passive: false });
  canvas.addEventListener('contextmenu', prevent);
  canvas.addEventListener('dblclick', prevent);
  document.addEventListener('gesturestart', prevent); // iOS pinch zoom
  window.addEventListener('blur', reset);

  return {
    reset,
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('touchstart', prevent);
      canvas.removeEventListener('touchmove', prevent);
      canvas.removeEventListener('touchend', prevent);
      canvas.removeEventListener('contextmenu', prevent);
      canvas.removeEventListener('dblclick', prevent);
      document.removeEventListener('gesturestart', prevent);
      window.removeEventListener('blur', reset);
    },
  };
}
