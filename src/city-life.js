// city-life.js — fixed birds, steam, blimp, celebration and night-weather pools.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { cityHash, flockAt, loopMetre, loopOf, districtAt, dayPhaseAt, phaseAt, tunnelAt, weatherAt, celebrationKind } from './city-logic.js';
import { birdGeometry, puffGeometry, blimp, blimpBanner } from './city-pieces.js';
import { toonMaterial } from './models/toon.js';
import { laneX } from './world.js';
import { emit, events } from './events.js';

const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createCityLife(game, glyphs, cityShift) {
  const C = CONFIG.city.life, F = C.flock, S = C.puff, G = C.gull;
  const birdMat = toonMaterial(0xffffff, { vertexColors: true });
  // Preserve the beak's exact vertex colour while tinting only white body/wing vertices.
  birdMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      #ifdef USE_COLOR
        vColor = color;
        #ifdef USE_INSTANCING_COLOR
          if (all(greaterThan(color, vec3(0.999)))) vColor *= instanceColor;
        #endif
      #endif`);
  };
  const make = (geometry, material, count) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    mesh.count = 0; mesh.visible = false; game.scene.add(mesh); return mesh;
  };
  const up = make(birdGeometry(true), birdMat, C.birds), down = make(birdGeometry(false), birdMat, C.birds);
  const initialColor = new THREE.Color(0x8a8f9c);
  for (let i = 0; i < C.birds; i++) { up.setColorAt(i, initialColor); down.setColorAt(i, initialColor); }
  up.instanceColor.setUsage(THREE.DynamicDrawUsage); down.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const steam = make(puffGeometry(), new THREE.MeshBasicMaterial(), C.steam);
  const weather = make(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), C.weather);
  const sparks = make(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), C.sparks);
  for (let i = 0; i < C.weather; i++) weather.setColorAt(i, initialColor);
  for (let i = 0; i < C.sparks; i++) sparks.setColorAt(i, initialColor);
  weather.instanceColor.setUsage(THREE.DynamicDrawUsage); sparks.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const blimpMat = toonMaterial(0xffffff, { vertexColors: true });
  const airship = new THREE.Mesh(blimp().plain, blimpMat);
  const banner = new THREE.Mesh(blimpBanner(), new THREE.MeshBasicMaterial({ map: glyphs }));
  airship.add(banner); airship.rotation.y = C.blimp.ry; airship.visible = false; game.scene.add(airship);
  const meshes = [up, down, steam, weather, sparks, airship, banner];
  const birds = Array.from({ length: C.birds }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, ry: 0 }));
  const puffs = Array.from({ length: C.steam }, () => ({ age: -1, x: 0, z: 0, side: 1 }));
  const vents = game.world.segments.map((seg) => ({ seg, serial: -1, timer: 0 }));
  const pieces = Array.from({ length: C.weather }, () => ({ x: 0, y: 0, z: 0, phase: 0 }));
  const W = C.fireworks, V = C.volume, tape = C.tape;
  const shells = Array.from({ length: W.live }, () => ({ age: -1, k: 0 }));
  const directions = Array.from({ length: W.sparks }, (_, i) => {
    const y = 1 - 2 * i / (W.sparks - 1), r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
  });
  const celebration = { kind: null, time: 0, fired: 0, seen: false };
  const forecast = { kind: null, k: 0 };
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const fog = new THREE.Color(), phase = { sunPos: [0, 0, 0] }, flockPosition = { x: 0, y: 0, z: 0 };
  const flockDetail = { position: flockPosition };
  let time = 0, lastD = 0, nextFlock = 0, flockD = 0, age = 0, birdCount = 0, birdKind = '', gullLoop = 0, side = 1, puffSerial = 0, value = -1;
  let weatherKind = null, weatherSerial = 0;
  const put = (mesh, i, x, y, z, size, ry = 0) => {
    position.set(x, y, z); scale.set(size, size, size); rotation.setFromAxisAngle(yAxis, ry);
    matrix.compose(position, rotation, scale); mesh.setMatrixAt(i, matrix);
  };
  const putPiece = (mesh, i, x, y, z, size, rz) => {
    position.set(x, y, z); scale.set(size[0], size[1], size[2]); rotation.setFromAxisAngle(zAxis, rz);
    matrix.compose(position, rotation, scale); mesh.setMatrixAt(i, matrix);
  };
  const spawnWeather = (p, kind, first) => {
    const spec = C[kind], inset = spec.sway || 0;
    let n, x;
    do { n = weatherSerial++; x = V.x[0] + inset + (V.x[1] - V.x[0] - 2 * inset) * cityHash(n + 0.1); }
    while (kind === 'rain' && Math.abs(x) < CONFIG.city.clearX && cityHash(n + 0.2) >= spec.laneShare);
    p.x = x; p.y = first ? V.y[0] + (V.y[1] - V.y[0]) * cityHash(n + 0.3) : V.y[1];
    p.z = V.z[0] + (V.z[1] - V.z[0]) * cityHash(n + 0.4); p.phase = cityHash(n + 0.5) * Math.PI * 2;
  };
  const onRecord = () => {
    if (game.state.mode !== 'running' || game.halted || celebration.seen) return;
    celebration.seen = true;
    const d = game.world.distance + cityShift;
    celebration.kind = celebrationKind(dayPhaseAt(d), tunnelAt(d)); celebration.time = celebration.fired = 0;
    if (reduceMotion && celebration.kind === 'fireworks') celebration.kind = null;
  };
  events.addEventListener('recordPass', onRecord);
  const reset = () => {
    time = age = birdCount = gullLoop = puffSerial = 0; value = -1; birdKind = '';
    lastD = game.world.distance + cityShift; nextFlock = flockAt(lastD);
    for (const puff of puffs) puff.age = -1;
    for (const vent of vents) { vent.serial = -1; vent.timer = 0; }
    celebration.kind = weatherKind = null; celebration.time = celebration.fired = weatherSerial = 0; celebration.seen = false;
    for (const shell of shells) shell.age = -1;
    up.count = down.count = steam.count = weather.count = sparks.count = 0;
    for (const mesh of meshes) mesh.visible = false;
  };
  reset();
  return {
    meshes, up, down, steam, weather, sparks, airship, banner, puffs, birds, pieces, shells, celebration, reset,
    update(dt, d = game.world.distance + cityShift) {
      if (game.state.mode !== 'running' || game.halted) return;
      const speed = game.state.speed, dz = d - lastD, id = districtAt(d), lap = loopOf(d);
      time += dt; lastD = d; if (age >= 0) age += dt;
      let perchedNow = false;
      if (!birdCount && nextFlock - d < F.range) {
        flockD = nextFlock; nextFlock = flockAt(flockD + 1);
        let blocked = flockD < d;
        for (const obstacle of game.obstacles.active) {
          const near = d - obstacle.z;
          if (near <= flockD + F.avoid && near + obstacle.length >= flockD - F.avoid) blocked = true;
        }
        if (!blocked) {
          birdKind = 'pigeon'; birdCount = 9; age = -1; perchedNow = true;
          const b = Math.floor(flockD / F.block), lane = Math.floor(cityHash(b * 5.9) * 3);
          for (let i = 0; i < birdCount; i++) {
            const bird = birds[i]; bird.x = laneX(lane) + (i % 2 ? 0.72 : -0.72);
            bird.y = 0.06; bird.z = -(flockD - d) - i * 0.45; bird.ry = cityHash(i) * Math.PI * 2;
            const a = (-F.fan + 2 * F.fan * i / 8) * Math.PI / 180;
            bird.vx = Math.sin(a) * F.vx; bird.vy = F.vy + Math.cos(a) * F.lift;
          }
        }
      }
      if (birdKind === 'pigeon' && birdCount && age < 0 && flockD - d < Math.max(F.launch, speed * F.ahead)) {
        if (reduceMotion) birdCount = 0;
        else {
          age = 0; flockPosition.x = birds[4].x; flockPosition.y = 0.06; flockPosition.z = -(flockD - d);
          emit('flock', flockDetail);
        }
      }
      if (id === 'bridge' && gullLoop !== lap && loopMetre(d) >= 2540 + 250 + 200 * cityHash(lap * 2.7)) {
        gullLoop = lap; birdKind = 'gull'; birdCount = 5; age = 0; side = cityHash(lap) < 0.5 ? -1 : 1;
        for (let i = 0; i < birdCount; i++) { birds[i].x = side * (7 + 1.3 * i); birds[i].y = 5 + 0.8 * i; birds[i].z = -12 - 6 * i; }
      }
      if (birdKind === 'pigeon' && age >= F.life) birdCount = 0;
      up.count = down.count = birdCount;
      color.setHex(birdKind === 'gull' ? 0xf2f2f2 : 0x8a8f9c);
      for (let i = 0; i < birdCount; i++) {
        const bird = birds[i], flying = birdKind === 'gull' || age >= 0;
        if (birdKind === 'gull') {
          bird.z += dt;
          if (age > G.life) { bird.x += side * G.peelX * dt; bird.y += G.peelY * dt; }
          if (Math.abs(bird.x) > G.endX) { put(up, i, 0, 0, 0, 0); put(down, i, 0, 0, 0, 0); continue; }
        } else if (flying) {
          bird.x += bird.vx * dt; bird.y += bird.vy * dt;
          const vz = -(speed + F.forward) + (F.forward + F.pass) * Math.max(0, Math.min(1, (age - F.easeAt) / F.easeTime));
          bird.z += (speed + vz) * dt;
        } else if (!perchedNow) bird.z += dz;
        const size = flying ? F.scale * (birdKind === 'pigeon' ? Math.min(1, (F.life - age) / F.fade) : 1) : 1;
        const flap = flying && Math.floor(time * (birdKind === 'gull' ? G.flap : F.flap) + i * 0.37) % 2 === 0;
        const y = bird.y + (birdKind === 'gull' ? 0.6 * Math.sin(0.8 * time + i) : flying ? 0 : 0.03 * Math.max(0, Math.sin(time * 6 + i)));
        put(up, i, bird.x, y, bird.z, flap ? size : 0, flying ? 0 : bird.ry);
        put(down, i, bird.x, y, bird.z, flap ? 0 : size, flying ? 0 : bird.ry);
        up.setColorAt(i, color); down.setColorAt(i, color);
      }
      if (birdKind === 'gull' && birdCount && Math.abs(birds[0].x) > G.endX) { birdCount = 0; up.count = down.count = 0; }
      up.visible = down.visible = birdCount > 0;
      up.instanceMatrix.needsUpdate = down.instanceMatrix.needsUpdate = true;
      if (up.instanceColor) up.instanceColor.needsUpdate = down.instanceColor.needsUpdate = true;
      for (const puff of puffs) if (puff.age >= 0) { puff.age += dt; puff.z += dz; if (puff.age >= S.life) puff.age = -1; }
      let liveVents = 0;
      for (const vent of vents) {
        const seg = vent.seg, c = seg.city, z = seg.group.position.z;
        if (vent.serial !== seg.serial) { vent.serial = seg.serial; vent.timer = 0; }
        if (!c.plan.chunk || (c.variant !== 1 && c.variant !== 5 && c.variant !== 9) || z < -120 || z > 10 || liveVents >= 3) { vent.timer = 0; continue; }
        liveVents++; vent.timer += dt;
        while (vent.timer >= S.interval) {
          vent.timer -= S.interval;
          let free = -1;
          for (let i = 0; i < puffs.length; i++) if (puffs[i].age < 0) { free = i; break; }
          if (free < 0) throw new Error('City steam capacity exceeded');
          const puff = puffs[free], s = c.group.scale.x;
          puff.age = 0; puff.side = s; puff.x = s * (6 + 0.3 * cityHash(puffSerial));
          puff.z = z + 3 + (cityHash(puffSerial + 0.5) * 2 - 1) * 0.3; puffSerial++;
        }
      }
      steam.count = 0;
      for (const puff of puffs) if (puff.age >= 0) {
        const u = puff.age / S.life, grow = Math.min(1, u / S.grow);
        const radius = u < S.grow ? S.radius[0] + (S.radius[1] - S.radius[0]) * (1 - (1 - grow) ** 2) : S.radius[1] * (1 - u) / (1 - S.grow);
        put(steam, steam.count++, puff.x + puff.side * S.drift * puff.age, -11 + S.rise * puff.age, puff.z, radius);
      }
      phaseAt(d, phase); fog.setHex(phase.fog); steam.material.color.setHex(S.color).lerp(fog, S.fog);
      steam.visible = steam.count > 0; steam.instanceMatrix.needsUpdate = true;
      airship.position.set(C.blimp.x + C.blimp.sway * Math.sin(time / C.blimp.period), C.blimp.y, C.blimp.z);
      airship.material.color.setHex(phase.tint); airship.visible = tunnelAt(d) <= 0.5; banner.visible = true;
      const n = Math.max(1, Math.min(99, Math.round(game.state.multiplier)));
      if (n !== value) {
        value = n;
        const uv = banner.geometry.getAttribute('uv'), tens = n < 10 ? n : Math.floor(n / 10), ones = n < 10 ? 11 : n % 10;
        for (let v = 0; v < 4; v++) { uv.setXY(8 + v, (tens + v % 2) / 16, v < 2 ? 1 : 0); uv.setXY(12 + v, (ones + v % 2) / 16, v < 2 ? 1 : 0); }
        uv.needsUpdate = true;
      }
      if (celebration.kind === 'wait' && tunnelAt(d) < 0.1) celebration.kind = celebrationKind(dayPhaseAt(d), tunnelAt(d));
      if (reduceMotion && celebration.kind === 'fireworks') celebration.kind = null;
      if (celebration.kind === 'tape' && celebration.time === 0) {
        // Inset by the rotating half-diagonal and sway so the full cloth stays outside the lanes.
        const edge = Math.hypot(tape.size[0], tape.size[1]) / 2, lo = Math.max(tape.x[0], CONFIG.city.clearX + edge);
        for (let i = 0; i < tape.count; i++) {
          const p = pieces[i], s = i % 2 ? 1 : -1;
          p.x = s * (lo + tape.sway + (tape.x[1] - edge - lo - 2 * tape.sway) * cityHash(i + 0.1));
          p.y = tape.y[0] + (tape.y[1] - tape.y[0]) * cityHash(i + 0.2);
          p.z = tape.z[0] + (tape.z[1] - tape.z[0]) * cityHash(i + 0.3); p.phase = cityHash(i + 0.4) * Math.PI * 2;
        }
      }
      sparks.count = weather.count = 0;
      if (celebration.kind === 'fireworks' && game.state.eventKind !== 'goblin') {
        celebration.time += dt;
        for (const shell of shells) if (shell.age >= 0) { shell.age += dt; if (shell.age >= W.life) shell.age = -1; }
        while (celebration.fired < W.shells && celebration.fired * W.interval <= celebration.time) {
          const shell = shells[celebration.fired % W.live];
          shell.k = celebration.fired; shell.age = celebration.time - celebration.fired * W.interval; celebration.fired++;
        }
        for (const shell of shells) if (shell.age >= 0) {
          const k = shell.k, u = shell.age / W.life, r = W.radius * (1 - (1 - u) ** 3);
          const fade = Math.max(0, Math.min(1, (u - W.fade) / (1 - W.fade))), size = W.size * (1 - fade * fade * (3 - 2 * fade));
          const x = W.x[0] + (W.x[1] - W.x[0]) * cityHash(k), y = W.y[0] + (W.y[1] - W.y[0]) * cityHash(k + 0.5);
          for (let i = 0; i < W.sparks; i++) {
            const dir = directions[i], slot = sparks.count++;
            put(sparks, slot, x + dir.x * r, y + dir.y * r - W.gravity * u * u, W.z + dir.z * r, size);
            color.setHex(i % 5 === 4 ? 0xffffff : W.colors[k % W.colors.length]); sparks.setColorAt(slot, color);
          }
        }
        if (celebration.fired === W.shells && sparks.count === 0) celebration.kind = null;
      }
      if (celebration.kind === 'tape') {
        celebration.time += dt; weatherKind = null; weather.material.opacity = 1;
        if (celebration.time >= tape.life) celebration.kind = null;
        else for (let i = 0; i < tape.count; i++) {
          const p = pieces[i], t = celebration.time, y = p.y - tape.fall * t;
          if (y < 0) continue;
          const slot = weather.count++;
          putPiece(weather, slot, p.x + tape.sway * Math.sin(tape.hz * t + p.phase), y, p.z, tape.size, tape.spin * t + p.phase);
          color.setHex(tape.colors[i % tape.colors.length]); weather.setColorAt(slot, color);
        }
      } else {
        weatherAt(lap, loopMetre(d), forecast);
        const kind = !reduceMotion && forecast.k > 0 ? forecast.kind : null;
        if (kind) {
          const spec = C[kind];
          if (weatherKind !== kind) for (const p of pieces) spawnWeather(p, kind, true);
          weather.material.opacity = spec.opacity; weather.count = Math.round(C.weather * forecast.k); color.setHex(spec.color);
          for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i]; p.y -= spec.fall * dt;
            if (p.y < V.y[0]) spawnWeather(p, kind, false);
            if (kind === 'rain') { p.x += spec.vx * dt; if (p.x < V.x[0]) p.x += V.x[1] - V.x[0]; }
            if (i >= weather.count) continue;
            putPiece(weather, i, p.x + (kind === 'snow' ? spec.sway * Math.sin(spec.hz * time + p.phase) : 0), p.y, p.z, spec.size, spec.rz || 0);
            weather.setColorAt(i, color);
          }
        }
        weatherKind = kind;
      }
      sparks.visible = sparks.count > 0; weather.visible = weather.count > 0;
      sparks.instanceMatrix.needsUpdate = weather.instanceMatrix.needsUpdate = true;
      sparks.instanceColor.needsUpdate = weather.instanceColor.needsUpdate = true;
    },
    dispose() { reset(); events.removeEventListener('recordPass', onRecord); game.scene.remove(up, down, steam, weather, sparks, airship); },
  };
}
