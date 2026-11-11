// src/daycycle.js — distance-driven light and scenery updates; gameplay keeps its own palette.
import { CONFIG } from './config.js';
import { phaseAt, tunnelAt, discAt, cityAt, mixHex, weatherAt, loopOf, loopMetre } from './city-logic.js';

export function createDayCycle({ scene, hemi, sun, sky, tinted, coin, obstacle, glow = [], boards = [], water, uniforms, track }) {
  const p = { sunPos: [0, 0, 0] }, disc = [0, 0, 0, 0];
  const T = CONFIG.city.tunnelLook, u = sky.uniforms;
  const weather = { kind: null, k: 0 }, trackBase = track?.emissive.clone(), trackIntensity = track?.emissiveIntensity;
  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    update(d) {
      phaseAt(d, p); discAt(d, disc);
      weatherAt(loopOf(d), loopMetre(d), weather);
      const t = tunnelAt(d);
      const fog = mixHex(p.fog, T.fog, t);
      scene.background.setHex(fog); scene.fog.color.setHex(fog);
      scene.fog.near = p.fogNear; scene.fog.far = p.fogFar;
      hemi.color.setHex(mixHex(p.hemiSky, T.hemiSky, t)); hemi.groundColor.setHex(p.hemiGround);
      hemi.intensity = lerp(p.hemiI, T.hemiI, t);
      sun.color.setHex(p.sun); sun.intensity = lerp(p.sunI, T.sunI, t);
      sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
      if (uniforms) uniforms.uWinOn.value = p.winOn;
      for (const m of tinted) {
        m.color.setHex(p.tint);
        m.emissiveIntensity = p.glow * (m.emissiveMap && weather.kind === 'rain' ? 1 + CONFIG.city.life.rain.glow * weather.k : 1);
      }
      if (track) {
        const wet = weather.kind && weather.k > 0 ? CONFIG.city.life[weather.kind] : null;
        if (wet) { track.emissive.setHex(wet.sheen); track.emissiveIntensity = wet.intensity * weather.k; }
        else { track.emissive.copy(trackBase); track.emissiveIntensity = trackIntensity; }
      }
      if (coin) coin.emissiveIntensity = lerp(p.coin, T.coin, t);
      if (obstacle) obstacle.emissive.copy(obstacle.color).multiplyScalar(CONFIG.city.obstacleGlow * lerp(p.nightBlend, 1, t));
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
