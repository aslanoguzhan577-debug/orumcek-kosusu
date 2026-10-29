// ui.js (G12) — menu, HUD, pause menu, game-over screen, local scores, sharing.
//
// Hooks into the game only through the public API:
//   reads   game.state (mode, score, coins, distance, webCharges, ironCount, ironTime,
//                       senseTime, magnetTime: seconds left, undefined = 0)
//   calls   game.start() / pause() / resume() / restart()
//   listens events: start, pause, resume, gameover
// It sets game.tapToStart = false (the G1 tap-anywhere placeholder is off).
// Markup lives in index.html (#ui), styling in ui.css. All DOM is built once; the frame
// loop only touches an element when its value changed.
//
// "Ana menü" from pause / game over calls game.toMenu() (mode 'menu', start layout) and
// shows the menu overlay; OYNA then calls game.start().

import { game } from './game.js';
import { events } from './events.js';
import { setMuted, isMuted } from './audio.js';
import { drawPowerIcon } from './pickup-art.js';

const KEY_NAME = 'spidey.name';
const KEY_SCORES = 'spidey.scores';
const KEY_HELP = 'spidey.helpSeen';
const OVER_DELAY_MS = 750;   // let the crash be seen before the game-over card
const MAX_NAME = 12;

// ---------- storage (always guarded) ----------
function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode etc. */ } }

function loadScores() {
  try {
    const arr = JSON.parse(lsGet(KEY_SCORES) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && Number.isFinite(e.s))
      .map((e) => ({ n: String(e.n || '').slice(0, MAX_NAME), s: Math.floor(e.s), t: e.t || 0 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5);
  } catch (e) { return []; }
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const el = {
  hud: $('hud'),
  score: $('h-score'), coins: $('h-coins'), pause: $('h-pause'),
  web: $('h-web'), iron: $('h-iron'), ironN: $('h-iron-n'), ironHint: $('h-iron-hint'),
  ironBar: $('h-ironbar'), ironFill: $('h-ironfill'),
  menu: $('scr-menu'), help: $('scr-help'), pauseScr: $('scr-pause'), over: $('scr-over'),
  nameBox: $('m-namebox'), name: $('m-name'), best: $('m-best'), bestName: $('m-bestname'),
  play: $('b-play'), helpBtn: $('b-help'), helpOk: $('b-help-ok'),
  resume: $('b-resume'), restart: $('b-restart'), pauseMenu: $('b-pause-menu'),
  again: $('b-again'), share: $('b-share'), overMenu: $('b-over-menu'),
  oScore: $('o-score'), oCoins: $('o-coins'), oDist: $('o-dist'), oBest: $('o-best'),
  oRecord: $('o-record'), oList: $('o-list'),
};
if (!el.hud || !el.menu) {
  console.warn('[ui] #ui markup missing from index.html');
}
const screens = { intro: $('intro-hint'), hud: el.hud, menu: el.menu, help: el.help, pause: el.pauseScr, over: el.over };
const slots = el.web ? Array.from(el.web.querySelectorAll('.slot')) : [];
const muteButtons = Array.from(document.querySelectorAll('[data-mute]'));
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
if ($('intro-hint')) $('intro-hint').textContent = coarse ? 'Geçmek için dokun' : 'Geçmek için tıkla veya bir tuşa bas';
if (el.ironHint) el.ironHint.textContent = coarse ? 'çift dokun' : 'space';

// ---------- state ----------
let scores = loadScores();
let current = '';          // screen name currently shown
let forced = null;         // 'menu' | 'help' overlay chosen by the player
let helpThenStart = false;
let helpReturn = null;
let overAt = Infinity;     // time (ms) from which the game-over card may show
let lastResult = null;     // { name, score, coins, distance, record, entry }
let ironMax = 1;
let prevIronTime = 0;
const timers = ['sense', 'magnet'].map((kind) => {
  const box = $('h-' + kind);
  const cv = box && box.querySelector('canvas');
  if (cv) drawPowerIcon(cv, kind);
  return { box: box || document.createElement('div'), fill: (box && box.querySelector('.fill')) || document.createElement('div'), max: 1, prev: 0, show: null, q: -1, low: null };
});
const cache = { score: -1, coins: -1, web: -1, ironN: -1, ironShow: null, ironBar: null, barScale: -1, low: null, hint: null };

game.tapToStart = false;

const fmt = (n) => Math.floor(n).toLocaleString('tr-TR');

// ---------- name ----------
function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME); }
function getName() { return cleanName(el.name && el.name.value); }
if (el.name) {
  el.name.value = cleanName(lsGet(KEY_NAME));
  el.name.addEventListener('input', () => {
    lsSet(KEY_NAME, getName());
    el.nameBox.classList.remove('need');
  });
  el.name.addEventListener('blur', () => { el.name.value = getName(); });
  el.name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.name.blur(); onPlay(); }
  });
}

// ---------- screens ----------
function showScreen(name) {
  if (name === current) return;
  current = name;
  for (const k in screens) if (screens[k]) screens[k].hidden = k !== name;
  const active = document.activeElement;
  if (active && active !== document.body && active.blur && !(screens[name] && screens[name].contains(active))) active.blur();
  if (name === 'menu') refreshMenu();
  if (name === 'hud') resetHudCache();
  if (name === 'pause' || name === 'menu') paintMute();
}

function wantScreen(now) {
  if (forced) return forced;
  switch (game.state.mode) {
    case 'running': return game.state.intro ? 'intro' : 'hud';
    case 'paused': return 'pause';
    case 'over': return now >= overAt ? 'over' : 'hud';
    default: return 'menu';
  }
}

function refreshMenu() {
  const top = scores[0];
  el.best.textContent = top ? fmt(top.s) : '0';
  el.bestName.textContent = top && top.n ? top.n : '';
}

// ---------- actions ----------
function startRun() {
  forced = null;
  overAt = Infinity;
  if (game.state.mode === 'menu') game.start(); else game.restart();
}
function onPlay() {
  if (!getName()) {
    el.name.focus();
    el.nameBox.classList.add('need');
    el.nameBox.classList.remove('shake');
    void el.nameBox.offsetWidth; // restart the shake animation
    el.nameBox.classList.add('shake');
    return;
  }
  lsSet(KEY_NAME, getName());
  el.name.blur();
  if (lsGet(KEY_HELP) !== '1') openHelp(true); else startRun();
}
function openHelp(thenStart) {
  helpThenStart = thenStart;
  helpReturn = forced;
  forced = 'help';
  el.helpOk.textContent = thenStart ? 'BAŞLA!' : 'TAMAM!';
}
function closeHelp() {
  lsSet(KEY_HELP, '1');
  if (helpThenStart) startRun(); else forced = helpReturn;
}
function goMenu() {
  if (typeof game.toMenu === 'function') game.toMenu();
  forced = 'menu';
}

function paintMute() {
  const text = isMuted() ? 'SES: KAPALI' : 'SES: AÇIK';
  for (const b of muteButtons) if (b.textContent !== text) b.textContent = text;
}

function onButton(node, fn) {
  if (!node) return;
  node.addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (b.blur) b.blur();
    fn(e);
  });
}
onButton(el.play, onPlay);
onButton(el.helpBtn, () => openHelp(false));
onButton(el.helpOk, closeHelp);
onButton(el.pause, () => game.pause());
onButton(el.resume, () => game.resume());
onButton(el.restart, () => { forced = null; game.restart(); });
onButton(el.pauseMenu, goMenu);
onButton(el.again, startRun);
onButton(el.overMenu, goMenu);
onButton(el.share, () => shareScore());
for (const b of muteButtons) onButton(b, () => { setMuted(!isMuted()); paintMute(); });
paintMute();

// ---------- keyboard ----------
// Runs before input.js (capture). Outside a run, game keys must not leak into the game
// (e.g. P / Esc would resume a game that is hidden behind the menu overlay).
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter', 'KeyP', 'Escape']);
window.addEventListener('keydown', (e) => {
  if (!GAME_KEYS.has(e.code)) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const s = current;
  if (s === 'hud' || s === 'intro' || s === 'pause' || s === '') return;
  if (e.repeat) { e.stopImmediatePropagation(); return; }
  e.stopImmediatePropagation();
  if (tag === 'BUTTON') return; // native click on Enter / Space
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    if (s === 'menu') onPlay();
    else if (s === 'help') closeHelp();
    else if (s === 'over') startRun();
  } else if (e.code === 'Escape' && s === 'help') {
    closeHelp();
  }
}, true);

// ---------- game over / scores ----------
function recordScore(detail) {
  const name = getName() || 'Adsız';
  const score = Math.max(0, Math.floor(detail.score || 0));
  const prevBest = scores.length ? scores[0].s : 0;
  const entry = { n: name, s: score, t: Date.now() };
  if (score > 0) {
    scores.push(entry);
    scores.sort((a, b) => b.s - a.s);
    scores = scores.slice(0, 5);
    lsSet(KEY_SCORES, JSON.stringify(scores));
  }
  lastResult = {
    name, score,
    coins: detail.coins || 0,
    distance: detail.distance || 0,
    record: score > 0 && score > prevBest,
    entry,
  };
}

function paintOver() {
  const r = lastResult;
  if (!r) return;
  el.oScore.textContent = fmt(r.score);
  el.oCoins.textContent = fmt(r.coins);
  el.oDist.textContent = fmt(r.distance);
  el.oBest.textContent = fmt(scores.length ? scores[0].s : r.score);
  el.oRecord.hidden = !r.record;
  el.share.textContent = 'SKORU PAYLAŞ';
  el.oList.textContent = '';
  for (let i = 0; i < 5; i++) {
    const li = document.createElement('li');
    const e = scores[i];
    if (e) {
      if (e === r.entry) li.className = 'me';
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = String(i + 1);
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.n || 'Adsız';
      const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = fmt(e.s);
      li.append(rk, nm, sc);
    } else {
      li.className = 'empty';
      li.textContent = '—';
    }
    el.oList.appendChild(li);
  }
}

events.addEventListener('gameover', (e) => {
  recordScore(e.detail || {});
  paintOver();
  overAt = performance.now() + OVER_DELAY_MS;
});
events.addEventListener('start', () => { forced = null; overAt = Infinity; resetHudCache(); });

// ---------- share ----------
let shareTimer = 0;
function flashShare(text) {
  el.share.textContent = text;
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => { el.share.textContent = 'SKORU PAYLAŞ'; }, 2000);
}
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}
async function shareScore() {
  const r = lastResult;
  if (!r) return;
  const url = location.origin + location.pathname;
  const text = `Örümcek Koşusu'nda ${fmt(r.score)} puan yaptım! Beni geçebilir misin? — ${r.name}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Örümcek Koşusu', text, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  flashShare((await copyText(`${text} ${url}`)) ? 'KOPYALANDI!' : 'KOPYALANAMADI');
}

// ---------- pause when the page is hidden ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state.mode === 'running') game.pause();
});
window.addEventListener('pagehide', () => {
  if (game.state.mode === 'running') game.pause();
});

// ---------- HUD ----------
function resetHudCache() {
  cache.score = cache.coins = cache.web = cache.ironN = cache.barScale = -1;
  cache.ironShow = cache.ironBar = cache.low = cache.hint = null;
  prevIronTime = 0;
  for (const g of timers) { g.max = 1; g.prev = 0; g.show = null; g.q = -1; g.low = null; }
}

// Örümcek hissi / Mıknatıs gauges: value when it switched on = 100 %, blinks in the last 20 %
function updateTimer(g, t) {
  const active = t > 0;
  if (active && g.prev <= 0) g.max = t;
  if (t > g.max) g.max = t;
  g.prev = t;
  if (active !== g.show) { g.show = active; g.box.hidden = !active; }
  if (!active) return;
  const k = Math.min(1, Math.max(0, t / g.max));
  const q = Math.round(k * 200) / 200;
  if (q !== g.q) { g.q = q; g.fill.style.transform = `scaleX(${q})`; }
  const low = k < 0.2;
  if (low !== g.low) { g.low = low; g.box.classList.toggle('low', low); }
}

function updateHud() {
  const st = game.state;
  if (st.score !== cache.score) { cache.score = st.score; el.score.textContent = fmt(st.score); }
  if (st.coins !== cache.coins) { cache.coins = st.coins; el.coins.textContent = fmt(st.coins); }

  if (st.webCharges !== cache.web) {
    cache.web = st.webCharges;
    for (let i = 0; i < slots.length; i++) slots[i].classList.toggle('on', i < st.webCharges);
  }

  const n = st.ironCount | 0;
  const t = st.ironTime || 0;
  const active = t > 0;
  if (active && prevIronTime <= 0) ironMax = t; // value when it switched on = 100 %
  if (t > ironMax) ironMax = t;
  prevIronTime = t;

  const show = n > 0 || active;
  if (show !== cache.ironShow) { cache.ironShow = show; el.iron.hidden = !show; }
  if (n !== cache.ironN) { cache.ironN = n; el.ironN.textContent = String(n); }
  const hintOn = n > 0 && !active;
  if (hintOn !== cache.hint) { cache.hint = hintOn; el.ironHint.hidden = !hintOn; }
  if (active !== cache.ironBar) { cache.ironBar = active; el.ironBar.hidden = !active; }
  if (active) {
    const k = Math.min(1, Math.max(0, t / ironMax));
    const q = Math.round(k * 200) / 200;
    if (q !== cache.barScale) { cache.barScale = q; el.ironFill.style.transform = `scaleX(${q})`; }
    const low = k < 0.2;
    if (low !== cache.low) { cache.low = low; el.ironBar.classList.toggle('low', low); }
  }

  updateTimer(timers[0], st.senseTime || 0);
  updateTimer(timers[1], st.magnetTime || 0);
}

// ---------- frame loop ----------
// the loader stays until game.ready (src/warmup.js: shaders compiled, textures uploaded)
function hideLoader() {
  const l = document.getElementById('loading');
  if (!l) return;
  performance.mark('spidey-ready');
  l.classList.add('done');
  setTimeout(() => l.remove(), 400);
}

let loaderHidden = false;
function frame(now) {
  requestAnimationFrame(frame);
  if (!loaderHidden && game.ready) { loaderHidden = true; hideLoader(); }
  showScreen(wantScreen(now));
  if (current === 'hud') updateHud();
}
requestAnimationFrame(frame);
