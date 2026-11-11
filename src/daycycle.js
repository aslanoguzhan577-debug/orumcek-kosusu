// src/daycycle.js — distance-driven light and scenery updates; gameplay keeps its own palette.
import { CONFIG } from './config.js';
import { phaseAt, tunnelAt, discAt, cityAt, mixHex } from './city-logic.js';

export function createDayCycle({ scene, hemi, sun, sky, tinted, coin, rims, glow = [], boards = [], water, uniforms }) {
  const p = { sunPos: [0, 0, 0] }, disc = [0, 0, 0, 0];
  const T = CONFIG.city.tunnelLook, u = sky.uniforms;
  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    update(d) {
      phaseAt(d, p); discAt(d, disc);
      const t = tunnelAt(d);
      const fog = mixHex(p.fog, T.fog, t);
      scene.background.setHex(fog); scene.fog.color.setHex(fog);
      scene.fog.near = p.fogNear; scene.fog.far = p.fogFar;
      hemi.color.setHex(mixHex(p.hemiSky, T.hemiSky, t)); hemi.groundColor.setHex(p.hemiGround);
      hemi.intensity = lerp(p.hemiI, T.hemiI, t);
      sun.color.setHex(p.sun); sun.intensity = lerp(p.sunI, T.sunI, t);
      sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
      if (uniforms) {
        uniforms.uHalftone.value = p.halftone; uniforms.uDotTint.value.setHex(p.dotTint);
        uniforms.uBaseTone.value = p.baseTone; uniforms.uWinOn.value = p.winOn;
        uniforms.uSunLum.value = p.sunI * (0.299 * sun.color.r + 0.587 * sun.color.g + 0.114 * sun.color.b) / Math.PI;
      }
      for (const m of tinted) { m.color.setHex(p.tint); m.emissiveIntensity = p.glow; }
      if (coin) coin.emissiveIntensity = lerp(p.coin, T.coin, t);
      for (const r of rims) r.m.color.setHex(mixHex(r.base, CONFIG.city.rim, lerp(p.rim, T.rim, t)));
      for (const m of glow) m.color.setScalar(lerp(0.8, 1, p.lamp));
      for (const m of boards) m.color.setScalar(p.sign);
      if (water) { water.color.setHex(p.water); water.map.offset.y = (d / 100) % 1; }
      u.uTop.value.setHex(p.skyTop); u.uMid.value.setHex(p.skyMid); u.uHorizon.value.setHex(p.horizon);
      u.uFar.value.setHex(p.far); u.uNear.value.setHex(p.near); u.uWin.value.setHex(p.win); u.uWinOn.value = p.skyWin;
      u.uSun.value.set(disc[0], disc[1], disc[2]); u.uSunCol.value.setHex(disc[3]);
      u.uStars.value = p.stars; u.uDots.value = p.skyDots; u.uDark.value = t; u.uCity.value = cityAt(d);
    },
  };
}
