// shop.js — coins banked across runs and the skill upgrades bought with them.
// Saved in localStorage (SAVE_KEY); every storage access is guarded, a broken save = defaults.

import { events } from './events.js';
import { CONFIG } from './config.js';

const SAVE_KEY = 'orumcek_kosusu_save';
const IRON_PRIMARY_KEY = (CONFIG && CONFIG.iron && CONFIG.iron.storageKey) || 'spidey.iron';
const IRON_FALLBACK_KEY = 'orumcek_kosusu_iron_count';
const IRON_DURATION = (CONFIG && CONFIG.iron && CONFIG.iron.duration) || 12;

export const SKILL_UPGRADE_CONFIG = {
  magnet:      { name: 'Mıknatıs',            baseDuration: 5,  stepDuration: 0.2, baseCost: 50,  costMultiplier: 1.35, maxLevel: 25 },
  spiderSense: { name: 'Örümcek Hissi',       baseDuration: 5,  stepDuration: 0.2, baseCost: 50,  costMultiplier: 1.35, maxLevel: 25 },
  ironSpider:  { name: 'Iron Spider Zırhı',   baseDuration: IRON_DURATION, stepDuration: 0.5, baseCost: 100, costMultiplier: 1.4,  maxLevel: 20 },
  heroSpecial: { name: 'Özel Kahraman Gücü',  baseDuration: 6,  stepDuration: 0.5, baseCost: 120, costMultiplier: 1.4,  maxLevel: 20 },
};

export const CONSUMABLE_ITEMS = {
  ironCore:   { name: 'Iron Spider Kullanım Hakkı', desc: '+1 Zırh Çekirdeği (Space / Çift dokun)', cost: 100, maxCount: (CONFIG && CONFIG.iron && CONFIG.iron.maxCount) || 5 },
  heroCharge: { name: 'Kahraman Şarjı / Ağ',        desc: '+1 Özel Yetenek / Ağ Şarjı [E]',        cost: 75,  maxCount: 1 },
  jetStart:   { name: 'Iron Man Jet Başlangıcı',    desc: 'Koşu başında 2000 m uçuş (ilk 7 sn, HUD butonu)', cost: 400, maxCount: 3 },
  flashBooster: { name: 'Flaş Fotoğraf', desc: 'Koşu başında çarpana +5 / +6 / +7 (ilk 7 sn, en fazla 3)', cost: 300, maxCount: 9 },
};

function defaults() {
  return {
    totalCoins: 250,
    upgrades: { magnet: 0, spiderSense: 0, ironSpider: 0, heroSpecial: 0 },
    bankedHeroCharge: 0,
    jetStarts: 0,
    flashBoosters: 0,
  };
}

function load() {
  const d = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    const coins = Number(saved?.totalCoins);
    if (Number.isFinite(coins) && coins >= 0) d.totalCoins = coins;
    const heroCharge = Number(saved?.bankedHeroCharge);
    if (Number.isFinite(heroCharge) && heroCharge >= 0) d.bankedHeroCharge = Math.floor(heroCharge);
    const jetStarts = Number(saved?.jetStarts);
    if (Number.isInteger(jetStarts) && jetStarts >= 0 && jetStarts <= CONSUMABLE_ITEMS.jetStart.maxCount) d.jetStarts = jetStarts;
    const flashBoosters = Number(saved?.flashBoosters);
    if (Number.isInteger(flashBoosters) && flashBoosters >= 0 && flashBoosters <= CONSUMABLE_ITEMS.flashBooster.maxCount) d.flashBoosters = flashBoosters;
    for (const key of Object.keys(SKILL_UPGRADE_CONFIG)) {
      const lv = Number(saved?.upgrades?.[key]);
      if (Number.isInteger(lv) && lv >= 0 && lv <= SKILL_UPGRADE_CONFIG[key].maxLevel) {
        d.upgrades[key] = lv;
      }
    }
  } catch (e) { /* no save, or broken: defaults */ }
  return d;
}

const data = load();

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* yoksay */ }
}

export function getPlayerData() {
  return {
    totalCoins: data.totalCoins,
    upgrades: { ...data.upgrades },
    bankedHeroCharge: data.bankedHeroCharge || 0,
    jetStarts: data.jetStarts || 0,
    flashBoosters: data.flashBoosters || 0,
    ironCount: getIronCoreCount(),
  };
}

export function getUpgradeCost(key) {
  const c = SKILL_UPGRADE_CONFIG[key];
  if (!c) return 0;
  const lv = data.upgrades[key] || 0;
  return Math.floor(c.baseCost * c.costMultiplier ** lv);
}

export function getEffectiveSkillDuration(key) {
  const c = SKILL_UPGRADE_CONFIG[key];
  if (!c) return 5;
  const lv = data.upgrades[key] || 0;
  return Math.round((c.baseDuration + lv * c.stepDuration) * 100) / 100;
}

export function buyUpgrade(key) {
  const c = SKILL_UPGRADE_CONFIG[key];
  if (!c || (data.upgrades[key] || 0) >= c.maxLevel) return false;
  const cost = getUpgradeCost(key);
  if (data.totalCoins < cost) return false;
  data.totalCoins -= cost;
  data.upgrades[key] = (data.upgrades[key] || 0) + 1;
  save();
  return true;
}

export function getIronCoreCount() {
  let count = 0;
  try {
    const raw = localStorage.getItem(IRON_PRIMARY_KEY) || localStorage.getItem(IRON_FALLBACK_KEY);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0) count = n;
  } catch (e) {}
  if (typeof window !== 'undefined' && window.game?.state && Number.isFinite(window.game.state.ironCount)) {
    count = Math.max(count, window.game.state.ironCount);
  }
  const max = CONSUMABLE_ITEMS.ironCore.maxCount || 5;
  return Math.min(max, count);
}

export function buyIronCore() {
  const item = CONSUMABLE_ITEMS.ironCore;
  if (!item || data.totalCoins < item.cost) return false;
  const max = item.maxCount || 5;
  let cur = getIronCoreCount();
  if (cur >= max) return false;
  data.totalCoins -= item.cost;
  cur = Math.min(max, cur + 1);
  try {
    localStorage.setItem(IRON_PRIMARY_KEY, String(cur));
    localStorage.setItem(IRON_FALLBACK_KEY, String(cur));
  } catch (e) {}
  if (typeof window !== 'undefined' && window.game?.state) {
    window.game.state.ironCount = cur;
  }
  save();
  return true;
}

export function buyHeroCharge() {
  const item = CONSUMABLE_ITEMS.heroCharge;
  if (!item || data.totalCoins < item.cost) return false;
  const skin = (typeof window !== 'undefined' && window.game?.skin) || 'spider';
  const HERO_SKINS = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];
  const isHero = HERO_SKINS.includes(skin);
  const max = skin === 'raimi' ? 2 : (isHero ? 1 : 3);

  if (typeof window !== 'undefined' && window.game?.state && window.game.state.mode === 'running') {
    if ((window.game.state.webCharges || 0) >= max) return false;
    data.totalCoins -= item.cost;
    window.game.state.webCharges = Math.min(max, (window.game.state.webCharges || 0) + 1);
  } else {
    if ((data.bankedHeroCharge || 0) >= max) return false;
    data.totalCoins -= item.cost;
    data.bankedHeroCharge = Math.min(max, (data.bankedHeroCharge || 0) + 1);
  }
  save();
  return true;
}

export function getJetStartCount() {
  return data.jetStarts || 0;
}

export function buyJetStart() {
  const item = CONSUMABLE_ITEMS.jetStart;
  if (!item || data.totalCoins < item.cost) return false;
  const max = item.maxCount || 3;
  if (getJetStartCount() >= max) return false;
  data.totalCoins -= item.cost;
  data.jetStarts = Math.min(max, getJetStartCount() + 1);
  save();
  return true;
}

export function useJetStart() {
  if (getJetStartCount() <= 0) return false;
  data.jetStarts = getJetStartCount() - 1;
  save();
  return true;
}

export function getFlashBoosterCount() {
  return data.flashBoosters || 0;
}

export function buyFlashBooster() {
  const item = CONSUMABLE_ITEMS.flashBooster;
  if (!item || data.totalCoins < item.cost) return false;
  const max = item.maxCount || 9;
  if (getFlashBoosterCount() >= max) return false;
  data.totalCoins -= item.cost;
  data.flashBoosters = Math.min(max, getFlashBoosterCount() + 1);
  save();
  return true;
}

export function useFlashBooster() {
  if (getFlashBoosterCount() <= 0) return false;
  data.flashBoosters = getFlashBoosterCount() - 1;
  save();
  return true;
}

events.addEventListener('start', () => {
  if (data.bankedHeroCharge > 0 && typeof window !== 'undefined' && window.game?.state) {
    const skin = window.game?.skin || 'spider';
    const HERO_SKINS = ['hulk', 'cap', 'miles', 'kitty', 'batman', 'raimi', 'ironman', 'panther'];
    const isHero = HERO_SKINS.includes(skin);
    const max = skin === 'raimi' ? 2 : (isHero ? 1 : 3);
    window.game.state.webCharges = Math.min(max, Math.max(window.game.state.webCharges || 0, data.bankedHeroCharge));
    data.bankedHeroCharge = 0;
    save();
  }
  if (typeof window !== 'undefined' && window.game?.state) {
    window.game.state.ironCount = getIronCoreCount();
  }
});

events.addEventListener('gameover', (e) => {
  data.totalCoins += Math.max(0, Math.floor(Number(e.detail?.coins) || 0));
  save();
});
