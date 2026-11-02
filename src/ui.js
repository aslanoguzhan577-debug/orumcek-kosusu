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
import { HEART_SVG_ICON } from './powerups/skillHelloKitty.js';
import { BAT_SVG_ICON } from './powerups/skillBatman.js';
import { SLINGSHOT_SVG_ICON } from './powerups/skillSpiderman2002.js';
import { UNIBEAM_SVG_ICON } from './powerups/skillIronMan.js';
import { VIBRANIUM_SVG_ICON } from './powerups/skillBlackPanther.js';

const KEY_NAME = 'spidey.name';
const KEY_SKIN = 'spidey.skin';
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
  web: $('h-web'),
  webLbl: $('h-web-lbl') || ($('h-web') ? $('h-web').querySelector('.lbl') : null),
  webSlots: $('h-web-slots') || ($('h-web') ? $('h-web').querySelector('.slots') : null),
  webHint: $('h-web-hint') || ($('h-web') ? $('h-web').querySelector('.key-hint') : null),
  iron: $('h-iron'), ironN: $('h-iron-n'), ironHint: $('h-iron-hint'),
  ironBar: $('h-ironbar'), ironFill: $('h-ironfill'),
  ironLbl: $('h-ironbar-lbl') || ($('h-ironbar') ? $('h-ironbar').querySelector('.lbl') : null),
  ironIco: $('h-iron') ? $('h-iron').querySelector('.iron-ico') : null,
  menu: $('scr-menu'), market: $('scr-market'), mkCoins: $('mk-coins'), mkList: $('mk-list'), skin: $('scr-skin'), skinBtn: $('b-skin'), skinOk: $('b-skin-close'), mkBtn: $('b-market'), mkClose: $('b-market-close'), help: $('scr-help'), pauseScr: $('scr-pause'), over: $('scr-over'), overMarket: $('b-over-market'),
  nameBox: $('m-namebox'), name: $('m-name'), best: $('m-best'), bestName: $('m-bestname'),
  play: $('b-play'), helpBtn: $('b-help'), helpOk: $('b-help-ok'),
  resume: $('b-resume'), restart: $('b-restart'), pauseMenu: $('b-pause-menu'),
  again: $('b-again'), share: $('b-share'), overMenu: $('b-over-menu'),
  oScore: $('o-score'), oCoins: $('o-coins'), oDist: $('o-dist'), oBest: $('o-best'),
  oRecord: $('o-record'), oList: $('o-list'),
  repulsor: $('h-repulsor'), repulsorTimer: $('h-repulsor-timer'),
};
if (!el.hud || !el.menu) {
  console.warn('[ui] #ui markup missing from index.html');
}
const screens = { intro: $('intro-hint'), hud: el.hud, menu: el.menu, market: el.market, skin: el.skin, help: el.help, pause: el.pauseScr, over: el.over };
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
const cache = { score: -1, coins: -1, web: -1, ironN: -1, ironShow: null, ironBar: null, barScale: -1, low: null, hint: null, repulsorShow: null, repulsorText: '', heroSkin: null };

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
  if (name === 'market') paintMarket();
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

function paintSkin() {
  for (const b of document.querySelectorAll('[data-skin]')) b.classList.toggle('on', b.dataset.skin === (game.skin || 'spider'));
}

// ---------- market (src/shop.js is loaded lazily so a missing file cannot break the game) ----------
let shop = null;
let marketReturn = 'menu';
async function openMarket() {
  try { shop = shop || await import('./shop.js'); } catch (e) { console.warn('[ui] shop.js yok', e); return; }
  marketReturn = forced || (game.state.mode === 'over' ? 'over' : (game.state.mode === 'paused' ? 'pause' : 'menu'));
  forced = 'market';
  paintMarket();
}
function paintMarket() {
  if (!shop) return;
  const wallet = shop.getPlayerData().totalCoins;
  el.mkCoins.textContent = fmt(wallet);
  el.mkList.textContent = '';

  // 1. KULLANIM HAKLARI (ŞARJLAR & ÇEKİRDEKLER)
  const secConsumable = document.createElement('div');
  secConsumable.className = 'mk-section-title';
  secConsumable.textContent = '⚡ KULLANIM HAKLARI & ÇEKİRDEKLER';
  el.mkList.appendChild(secConsumable);

  // A) Iron Spider Kullanım Hakkı Satın Alma (+1 Çekirdek)
  {
    const item = shop.CONSUMABLE_ITEMS.ironCore;
    const count = shop.getIronCoreCount();
    const max = item.maxCount || 5;
    const isFull = count >= max;
    const cost = item.cost;

    const row = document.createElement('div');
    row.className = 'mk-item consumable iron-spider';
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    drawPowerIcon(cv, 'ironSpider');

    const info = document.createElement('div'); info.className = 'mk-info';
    const nm = document.createElement('b'); nm.textContent = item.name;
    const du = document.createElement('small');
    du.innerHTML = `Mevcut: <strong style="color:var(--yellow);">${count} / ${max}</strong> · ${item.desc}`;
    info.append(nm, du);

    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'btn small mk-buy' + (isFull ? '' : ' gold');
    if (isFull) {
      buy.textContent = 'MAKS';
      buy.disabled = true;
    } else {
      buy.disabled = wallet < cost;
      buy.append(document.createTextNode(fmt(cost) + ' '), Object.assign(document.createElement('i'), { className: 'coin-ico' }));
      buy.addEventListener('click', () => {
        if (shop.buyIronCore()) {
          paintMarket();
          if (game.state.mode === 'running') updateHud();
        }
      });
    }
    row.append(cv, info, buy);
    el.mkList.appendChild(row);
  }

  // B) Kahraman Şarjı / Ağ Satın Alma (+1 Şarj)
  {
    const item = shop.CONSUMABLE_ITEMS.heroCharge;
    const skin = game.skin || 'spider';
    const HERO_SKINS = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];
    const isHero = HERO_SKINS.includes(skin);
    const max = skin === 'raimi' ? 2 : (isHero ? 1 : 3);
    const cur = (game.state.mode === 'running')
      ? (game.state.webCharges || 0)
      : (shop.getPlayerData().bankedHeroCharge || 0);
    const isFull = cur >= max;
    const cost = item.cost;

    const row = document.createElement('div');
    row.className = 'mk-item consumable hero-special';
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    drawPowerIcon(cv, isHero ? 'heroSpecial' : 'web');

    const info = document.createElement('div'); info.className = 'mk-info';
    const nm = document.createElement('b');
    nm.textContent = isHero ? `${skin.toUpperCase()} ŞARJI` : 'AĞ ŞARJI';
    const du = document.createElement('small');
    du.innerHTML = `Mevcut: <strong style="color:var(--cyan);">${cur} / ${max}</strong> · ${item.desc}`;
    info.append(nm, du);

    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'btn small mk-buy';
    if (isFull) {
      buy.textContent = 'MAKS';
      buy.disabled = true;
    } else {
      buy.disabled = wallet < cost;
      buy.append(document.createTextNode(fmt(cost) + ' '), Object.assign(document.createElement('i'), { className: 'coin-ico' }));
      buy.addEventListener('click', () => {
        if (shop.buyHeroCharge()) {
          paintMarket();
          if (game.state.mode === 'running') updateHud();
        }
      });
    }
    row.append(cv, info, buy);
    el.mkList.appendChild(row);
  }

  // 2. SÜRE YÜKSELTMELERİ (DURATION UPGRADES)
  const secUpgrades = document.createElement('div');
  secUpgrades.className = 'mk-section-title';
  secUpgrades.textContent = '🛠️ SÜRE YÜKSELTMELERİ';
  el.mkList.appendChild(secUpgrades);

  for (const key of Object.keys(shop.SKILL_UPGRADE_CONFIG)) {
    const c = shop.SKILL_UPGRADE_CONFIG[key];
    const lvl = shop.getPlayerData().upgrades[key] | 0;
    const max = lvl >= c.maxLevel;
    const cost = max ? 0 : shop.getUpgradeCost(key);
    const cur = shop.getEffectiveSkillDuration(key);
    const row = document.createElement('div'); row.className = 'mk-item';
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    drawPowerIcon(cv, key);
    const info = document.createElement('div'); info.className = 'mk-info';
    const nm = document.createElement('b'); nm.textContent = `${c.name} · Sv. ${lvl}`;
    const du = document.createElement('small');
    du.textContent = max ? `${+cur.toFixed(1)} sn (en yüksek seviye)` : `${+cur.toFixed(1)} sn → ${+(cur + c.stepDuration).toFixed(1)} sn`;
    info.append(nm, du);
    const buy = document.createElement('button'); buy.type = 'button'; buy.className = 'btn small mk-buy';
    if (max) { buy.textContent = 'MAX'; buy.disabled = true; }
    else {
      buy.disabled = wallet < cost;
      buy.append(document.createTextNode(fmt(cost) + ' '), Object.assign(document.createElement('i'), { className: 'coin-ico' }));
      buy.addEventListener('click', () => { if (shop.buyUpgrade(key)) paintMarket(); });
    }
    row.append(cv, info, buy);
    el.mkList.appendChild(row);
  }
}

// "demet" easter egg: ~3 s of floating hearts at the start of a run
function heartRain() {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden';
  for (let i = 0; i < 400; i++) {
    const h = document.createElement('span');
    h.textContent = '❤';
    h.className = 'heart-fly';
    h.style.cssText = `left:${Math.random() * 100}%;font-size:${20 + Math.random() * 36}px;animation-delay:${Math.random() * 2}s;animation-duration:${1.6 + Math.random() * 0.8}s`;
    layer.appendChild(h);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4600);
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
onButton(el.mkBtn, openMarket);
onButton(el.skinBtn, () => { forced = 'skin'; paintSkin(); });
onButton(el.skinOk, () => { forced = 'menu'; });
for (const b of document.querySelectorAll('[data-skin]')) {
  onButton(b, () => {
    lsSet(KEY_SKIN, b.dataset.skin);
    if (game.setSkin) game.setSkin(b.dataset.skin);
    paintSkin();
  });
}
onButton(el.mkClose, () => { forced = marketReturn || 'menu'; });
if (el.overMarket) onButton(el.overMarket, openMarket);
onButton(el.pause, () => game.pause());
onButton(el.resume, () => game.resume());
onButton(el.restart, () => { forced = null; game.restart(); });
onButton(el.pauseMenu, goMenu);
onButton(el.again, startRun);
onButton(el.overMenu, goMenu);
onButton(el.share, () => shareScore());
for (const b of muteButtons) onButton(b, () => { setMuted(!isMuted()); paintMute(); });
paintMute();

// ---------- repulsor boost & hero special skill buttons ----------
function triggerHeroSpecial() {
  if (game.state.mode !== 'running' || game.halted) return;
  if (game.web && typeof game.web.tryActivate === 'function') {
    game.web.tryActivate();
  }
}

onButton(el.web, () => {
  triggerHeroSpecial();
});

onButton(el.repulsor, () => {
  if (game.repulsor && game.repulsor.available) game.repulsor.activate();
});
onButton(el.iron, () => {
  if (game.iron && game.state.mode === 'running') game.iron.activate();
});

const HERO_SPECIAL_KEYS = new Set(['KeyE', 'KeyQ', 'KeyF']);
window.addEventListener('keydown', (e) => {
  if (HERO_SPECIAL_KEYS.has(e.code)) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (game.state && game.state.mode === 'running') {
      e.preventDefault();
      triggerHeroSpecial();
    }
  }
});
// ---------- keyboard ----------
// Runs before input.js (capture). Outside a run, game keys must not leak into the game
// (e.g. P / Esc would resume a game that is hidden behind the menu overlay).
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter', 'KeyP', 'Escape', 'KeyQ', 'KeyE', 'KeyF']);
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
events.addEventListener('start', () => { if (getName().toLowerCase() === 'demet') heartRain(); forced = null; overAt = Infinity; resetHudCache(); });

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

  const skin = game.skin || 'spider';
  const HERO_SKINS = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];
  const isHero = HERO_SKINS.includes(skin);

  // Karakter skin değiştiğinde Hero Skill göstergesini güncelle (1 slot veya 3 slot)
  if (skin !== cache.heroSkin) {
    cache.heroSkin = skin;
    cache.web = -1; // slotların durumunu güncellemeye zorla

    if (el.web) {
      el.web.classList.remove(...HERO_SKINS);
      if (isHero) el.web.classList.add(skin);
    }

    if (el.webLbl) {
      if (skin === 'hulk') el.webLbl.textContent = 'HULK SMASH';
      else if (skin === 'cap') el.webLbl.textContent = 'SHIELD SURF';
      else if (skin === 'miles') el.webLbl.textContent = 'VENOM BLAST';
      else if (skin === 'kitty') el.webLbl.textContent = 'UÇAN KALP';
      else if (skin === 'batman') el.webLbl.textContent = 'GECE PELERİNİ';
      else if (skin === 'raimi') el.webLbl.textContent = 'MANCINIK AĞ';
      else if (skin === 'ironman') el.webLbl.textContent = 'UNIBEAM';
      else if (skin === 'panther') el.webLbl.textContent = 'VİBRANYUM ŞOK';
      else el.webLbl.textContent = 'AĞ';
    }

    if (el.webHint) {
      el.webHint.textContent = coarse ? 'DOKUN' : 'E';
    }

    if (el.webSlots) {
      if (skin === 'hulk') {
        el.webSlots.innerHTML = '<i class="slot"><span class="hero-ico">👊</span></i>';
      } else if (skin === 'cap') {
        el.webSlots.innerHTML = '<i class="slot"><span class="hero-ico">🛡️</span></i>';
      } else if (skin === 'miles') {
        el.webSlots.innerHTML = '<i class="slot"><span class="hero-ico">⚡</span></i>';
      } else if (skin === 'kitty') {
        el.webSlots.innerHTML = `<i class="slot"><span class="hero-ico">${HEART_SVG_ICON}</span></i>`;
      } else if (skin === 'batman') {
        el.webSlots.innerHTML = `<i class="slot"><span class="hero-ico">${BAT_SVG_ICON}</span></i>`;
      } else if (skin === 'raimi') {
        el.webSlots.innerHTML = `<i class="slot"><span class="hero-ico">${SLINGSHOT_SVG_ICON}</span></i>` +
                               `<i class="slot"><span class="hero-ico">${SLINGSHOT_SVG_ICON}</span></i>`;
      } else if (skin === 'ironman') {
        el.webSlots.innerHTML = `<i class="slot"><span class="hero-ico">${UNIBEAM_SVG_ICON}</span></i>`;
      } else if (skin === 'panther') {
        el.webSlots.innerHTML = `<i class="slot"><span class="hero-ico">${VIBRANIUM_SVG_ICON}</span></i>`;
      } else {
        el.webSlots.innerHTML = '<i class="slot"><svg><use href="#i-web"/></svg></i>' +
                               '<i class="slot"><svg><use href="#i-web"/></svg></i>' +
                               '<i class="slot"><svg><use href="#i-web"/></svg></i>';
      }
    }
  }

  // Hero Skill şarj slotlarını güncelle
  if (st.webCharges !== cache.web) {
    cache.web = st.webCharges;
    const currentSlots = el.webSlots ? Array.from(el.webSlots.querySelectorAll('.slot')) : [];
    if (skin === 'raimi') {
      if (currentSlots[0]) currentSlots[0].classList.toggle('on', st.webCharges >= 1);
      if (currentSlots[1]) currentSlots[1].classList.toggle('on', st.webCharges >= 2);
    } else if (isHero) {
      if (currentSlots[0]) currentSlots[0].classList.toggle('on', st.webCharges >= 1);
    } else {
      for (let i = 0; i < currentSlots.length; i++) {
        currentSlots[i].classList.toggle('on', i < st.webCharges);
      }
    }
  }

  // Iron Spider rozeti (h-iron): TÜM karakterler için Iron Spider çekirdek sayısını gösterir
  const n = st.ironCount | 0;
  const ironActive = Boolean(st.ironTime > 0);
  const showIron = n > 0 || ironActive;
  if (showIron !== cache.ironShow) { cache.ironShow = showIron; el.iron.hidden = !showIron; }
  if (n !== cache.ironN) { cache.ironN = n; el.ironN.textContent = String(n); }
  const hintOn = n > 0 && !ironActive;
  if (hintOn !== cache.hint) { cache.hint = hintOn; el.ironHint.hidden = !hintOn; }

  // Süre çubuğu (Hero Special yeteneği veya Iron Spider için)
  const heroSpecActive = Boolean(game.web?.heroSpecials?.active || game.heroSpecials?.active);
  const ironSuitActive = Boolean(st.ironTime > 0);

  if (heroSpecActive) {
    const hs = game.web?.heroSpecials || game.heroSpecials;
    const mode = hs.mode || skin;
    const cfg = hs.getHeroConfig(mode);
    if (el.ironLbl) el.ironLbl.textContent = cfg ? cfg.label : 'ÖZEL YETENEK';
    if (el.ironBar) {
      el.ironBar.hidden = false;
      el.ironBar.classList.remove(...HERO_SKINS);
      el.ironBar.classList.add(mode);
      let k = 0;
      if (mode === 'batman') {
        const curDist = (typeof st.distance === 'number') ? st.distance : (hs.startDistance || 0);
        const startDist = hs.startDistance || 0;
        k = Math.min(1, Math.max(0, (800 - (curDist - startDist)) / 800));
      } else {
        k = Math.min(1, Math.max(0, hs.timeRemaining / (hs.maxTime || 1)));
      }
      const q = Math.round(k * 200) / 200;
      if (q !== cache.barScale) { cache.barScale = q; el.ironFill.style.transform = `scaleX(${q})`; }
      const low = k < 0.2;
      if (low !== cache.low) { cache.low = low; el.ironBar.classList.toggle('low', low); }
    }
  } else if (ironSuitActive) {
    const t = st.ironTime || 0;
    if (t > 0 && prevIronTime <= 0) ironMax = t;
    if (t > ironMax) ironMax = t;
    prevIronTime = t;

    if (el.ironLbl) el.ironLbl.textContent = 'IRON SPIDER';
    if (el.ironBar) {
      el.ironBar.hidden = false;
      el.ironBar.classList.remove(...HERO_SKINS);
      const k = Math.min(1, Math.max(0, t / (ironMax || 1)));
      const q = Math.round(k * 200) / 200;
      if (q !== cache.barScale) { cache.barScale = q; el.ironFill.style.transform = `scaleX(${q})`; }
      const low = k < 0.2;
      if (low !== cache.low) { cache.low = low; el.ironBar.classList.toggle('low', low); }
    }
  } else {
    prevIronTime = 0;
    if (el.ironBar) {
      el.ironBar.hidden = true;
      el.ironBar.classList.remove(...HERO_SKINS);
    }
  }

  updateTimer(timers[0], st.senseTime || 0);
  updateTimer(timers[1], st.magnetTime || 0);

  // Repulsor boost button (Iron Man fly skill)
  if (el.repulsor && game.repulsor) {
    const rep = game.repulsor;
    const wl = rep.windowLeft;
    const shouldShow = !st.intro && st.mode === 'running' && wl > 0 && !rep.active && !rep.used;
    if (shouldShow !== cache.repulsorShow) {
      cache.repulsorShow = shouldShow;
      el.repulsor.hidden = !shouldShow;
    }
    if (shouldShow) {
      const txt = Math.ceil(wl) + 's';
      if (txt !== cache.repulsorText) {
        cache.repulsorText = txt;
        el.repulsorTimer.textContent = ' ' + txt;
      }
      // Blink when < 3s left
      el.repulsor.classList.toggle('low', wl < 3);
    }
  }
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
