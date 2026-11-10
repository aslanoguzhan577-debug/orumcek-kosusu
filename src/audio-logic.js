export const KEY_MUSIC = 'spidey.music', KEY_SFX = 'spidey.sfx', KEY_MUTED_OLD = 'spidey.muted';
export function loadSettings(get) {            // get(key) -> string | null
  const old = get(KEY_MUTED_OLD) === '1';
  const pick = (k) => { const v = get(k); return v === '1' ? true : v === '0' ? false : !old; };
  return { music: pick(KEY_MUSIC), sfx: pick(KEY_SFX) };
}
export function saveSettings(set, s) {         // set(key, value)
  set(KEY_MUSIC, s.music ? '1' : '0');
  set(KEY_SFX, s.sfx ? '1' : '0');
  set(KEY_MUTED_OLD, !s.music && !s.sfx ? '1' : '0');   // an older build opened later still respects "all off"
}

export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const COIN_MIDI = [81, 84, 86, 88, 91, 93, 96, 98];        // A5 C6 D6 E6 G6 A6 C7 D7
export const COIN_COMP = [1.00, 0.95, 0.90, 0.86, 0.81, 0.77, 0.73, 0.70];
export const COIN_RESET = 0.6;     // s without any coin -> back to step 0
export const COIN_GAP = 1 / 12;    // s between two coin sounds (12 / s)
export function coinNext(st, now) {
  if (now - st.lastCoin > COIN_RESET) st.streak = 0;
  st.lastCoin = now;
  if (now - st.lastPlay < COIN_GAP - 1e-4) return -1;
  st.lastPlay = now;
  const i = st.streak < 8 ? st.streak : 4 + ((st.streak - 8) % 4);
  st.streak++;
  return i;
}

export class VoicePool {
  constructor(max, reserve) { this.max = max; this.reserve = reserve; this.used = 0; }
  claim(prio, cost) {
    if (this.used + cost > this.max - this.reserve[prio]) return false;
    this.used += cost; return true;
  }
  release(cost) { this.used = Math.max(0, this.used - cost); }
}

export const musicPoolMax = (cores) => cores <= 4 ? 36 : 44;
export const shouldDuck = (cur, now, level) => now >= cur.until || level <= cur.level;
export const DUCK_SFX = { crash: 0.45, caught: 0.45, hulkSmash: 0.45, venomBlastNova: 0.45, ironSave: 0.5, hulkRoar: 0.5, capShieldGong: 0.55, milesVenomBlast: 0.55 };

export const CH = {
  Am: { root: 45, tones: [57, 60, 64] }, F: { root: 41, tones: [57, 60, 65] },
  C: { root: 48, tones: [55, 60, 64] }, G: { root: 43, tones: [55, 59, 62] },
  Em: { root: 40, tones: [55, 59, 64] },
  Fmaj7: { root: 41, tones: [53, 57, 60, 64] }, Em7: { root: 40, tones: [52, 55, 59, 62] },
  Dm7: { root: 38, tones: [50, 53, 57, 60] }, Am7: { root: 45, tones: [55, 57, 60, 64] },
};

export const MENU_BARS = ['Fmaj7', 'Em7', 'Dm7', 'Am7', 'Fmaj7', 'Em7', 'Dm7', 'Am7'];

export const M_KICK = [1,0,0,0, 0,0,0,0, 0,0,0.7,0, 0,0,0,0];

export const M_RIM  = [0,0,0,0, 0.8,0,0,0, 0,0,0,0, 0.8,0,0,0];

export const M_HAT  = [0.35,0,0.2,0, 0.35,0,0.2,0, 0.35,0,0.2,0, 0.35,0,0.2,0.15];

export const M_BASS = [[0,0,6,0.9],[10,7,2,0.7],[14,12,2,0.6]];

export const BOX = [
  [[0,81,3],[3,79,1],[4,76,4],[10,72,2],[12,74,4]],
  [[0,79,6],[8,74,2],[10,76,2],[12,71,4]],
  [[0,77,3],[3,76,1],[4,72,4],[10,69,2],[12,72,4]],
  [[0,76,8],[12,74,2],[14,72,2]],
  [[0,69,2],[2,72,2],[4,77,2],[6,76,2],[8,72,8]],
  [[0,71,2],[2,74,2],[4,79,4],[10,76,2],[12,74,4]],
  [[0,72,2],[2,74,2],[4,77,2],[6,81,2],[8,79,4],[12,77,4]],
  [[0,76,12]],
];

export function musicScene(mode, intro) {
  if (mode === 'paused') return 'hold';
  if (mode === 'running') return intro ? 'silent' : 'run';
  return mode === 'over' ? 'over' : 'menu';
}
export const resyncTime = (next, now) => next < now - 0.05 ? now + 0.05 : next;

export const TIER_SPEEDS = [13.5, 17, 22, 32];
export const tierFor = (s) => TIER_SPEEDS.filter((v) => s >= v).length;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const bpmFor = (s) => Math.round((112 + 10 * clamp01((s - 11) / 15) + 6 * clamp01((s - 26) / 13)) * 2) / 2;

export const layersFor = (t) => ({ fill: t >= 1, stabs: t >= 1, lead: t >= 2, kickB: t >= 3, hatsB: t >= 3, bassB: t >= 3, arp: t >= 4, sparkle: t >= 4, crash8: t >= 4 });

export const RUN_BARS = ['Am', 'F', 'C', 'G', 'F', 'G', 'Em', 'Am'];

export const KICK_A = [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0];

export const KICK_B = [1,0,0,0, 0,0,0,0.6, 1,0,0.7,0, 0,0,0,0];

export const SNARE  = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0.25];

export const FILL   = [0.45, 0.6, 0.75, 0.95];

export const HAT_A  = [0.45,0,0.8,0, 0.45,0,0.8,0, 0.45,0,0.8,0, 0.45,0,0.8,0];

export const HAT_B  = [0.7,0.3,0.9,0.3, 0.7,0.3,0.9,0.3, 0.7,0.3,0.9,0.3, 0.7,0.3,0,0.3];

export const OPEN_B_STEP = 14;

export const BASS_A = [[0,0,2,1],[3,0,1,0.7],[6,12,1,0.8],[8,0,2,1],[11,0,1,0.7],[14,7,2,0.8]];

export const BASS_B = [[0,0,2,1],[3,0,1,0.7],[4,12,1,0.8],[6,0,1,0.7],[8,0,2,1],[10,12,1,0.8],[11,0,1,0.7],[13,7,1,0.75],[14,12,2,0.85]];

export const STABS = [[2,1,0.9],[6,1,0.7],[10,1,0.9],[13,2,0.8]];

export const ARP_ORDER = [0,1,2,3,2,1,0,1, 2,3,2,1,0,1,2,3];

export const LEAD = [
  [[0,76,2],[3,81,1],[4,79,2],[6,76,2],[10,74,1],[11,76,3]],
  [[0,72,2],[3,77,1],[4,76,2],[6,72,2],[8,69,2],[11,72,1],[12,74,4]],
  [[0,76,2],[3,79,1],[4,84,2],[6,83,1],[7,79,1],[8,76,4],[12,79,2],[14,81,2]],
  [[0,79,3],[3,74,1],[4,74,2],[6,71,2],[8,74,6],[14,76,1],[15,79,1]],
  [[0,81,2],[3,84,1],[4,81,2],[6,77,2],[8,76,2],[10,77,1],[11,76,1],[12,72,4]],
  [[0,74,2],[3,79,1],[4,83,2],[6,79,2],[8,86,4],[12,84,2],[14,83,2]],
  [[0,83,2],[3,79,1],[4,76,2],[6,71,2],[8,74,2],[10,76,2],[12,79,2],[14,83,2]],
  [[0,81,6],[8,76,2],[11,79,1],[12,81,4]],
];

export const stingerReady = (last, now) => now - last >= 2.0;
