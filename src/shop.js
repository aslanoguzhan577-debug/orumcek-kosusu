// shop.js — coins banked across runs and the skill upgrades bought with them.
// Saved in localStorage (SAVE_KEY); every storage access is guarded, a broken save = defaults.

import { events } from './events.js';

const SAVE_KEY = 'orumcek_kosusu_save';

export const SKILL_UPGRADE_CONFIG = {
  magnet:      { name: 'Mıknatıs',      baseDuration: 5, stepDuration: 0.2, baseCost: 50, costMultiplier: 1.35, maxLevel: 25 },
  spiderSense: { name: 'Örümcek Hissi', baseDuration: 5, stepDuration: 0.2, baseCost: 50, costMultiplier: 1.35, maxLevel: 25 },
};

function defaults() {
  return { totalCoins: 0, upgrades: { magnet: 0, spiderSense: 0 } };
}

function load() {
  const d = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    const coins = Number(saved.totalCoins);
    if (Number.isFinite(coins) && coins >= 0) d.totalCoins = Math.floor(coins);
    for (const key of Object.keys(d.upgrades)) {
      const lv = Number(saved.upgrades?.[key]);
      if (Number.isInteger(lv) && lv >= 0 && lv <= SKILL_UPGRADE_CONFIG[key].maxLevel) d.upgrades[key] = lv;
    }
  } catch (e) { /* no save, or broken: defaults */ }
  return d;
}

const data = load();

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* yoksay */ }
}

export function getPlayerData() {
  return { totalCoins: data.totalCoins, upgrades: { ...data.upgrades } };
}

export function getUpgradeCost(key) {
  const c = SKILL_UPGRADE_CONFIG[key];
  return Math.floor(c.baseCost * c.costMultiplier ** data.upgrades[key]);
}

export function getEffectiveSkillDuration(key) {
  const c = SKILL_UPGRADE_CONFIG[key];
  return Math.round((c.baseDuration + data.upgrades[key] * c.stepDuration) * 100) / 100;
}

export function buyUpgrade(key) {
  const c = SKILL_UPGRADE_CONFIG[key];
  if (!c || data.upgrades[key] >= c.maxLevel) return false;
  const cost = getUpgradeCost(key);
  if (data.totalCoins < cost) return false;
  data.totalCoins -= cost;
  data.upgrades[key]++;
  save();
  return true;
}

events.addEventListener('gameover', (e) => {
  data.totalCoins += Math.max(0, Math.floor(Number(e.detail?.coins) || 0));
  save();
});
