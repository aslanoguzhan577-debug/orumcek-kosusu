// skillBlackPanther.js — Black Panther: Vibranyum Kinetik Şok Dalgası
//
// Karakter Özel Yeteneği:
// Mor / Menekşe (#7b2cbf, #c77dff, #ffffff) kinetik enerji patlaması:
// 1. Çift katmanlı genişleyen mor IcosahedronGeometry enerji kubbesi (radius 1.5m -> 7.5m).
// 2. Zeminde yayılan 3 kademeli altıgen (RingGeometry, thetaSegments: 6) şok halkaları.
// 3. Çevredeki engellere ve kinetik hatta çarpan 15 adet kırıklı (jagged) mor-beyaz şimşek arkı (LineSegments).
// 4. Çevredeki tüm engelleri (16m yarıçap, tüm şeritler) shatterObstacle ile mor kristal parçalarına
//    (color: 0x9d4edd, emissive: 0xc77dff) ayırarak yok eder.
// 5. Göğüs/zemin merkezli parlak mor PointLight ve kamera sarsıntısı tetikler.
// 6. 1 şarj tanımlanır, ~5.5 sn sürer. Vibranyum Kinetik Sprint Hız Artışı (+14 m/s).
// 7. UI ikonu: Mor vibranyum dişli / kinetik şok SVG ikonu (VIBRANIUM_SVG_ICON).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { emit } from '../events.js';
import { game } from '../game.js';
import {
  createGlowTexture,
  shatterObstacle,
  triggerCameraShake,
  triggerFlashLight,
} from '../vfxCore.js';

// ------------------------------------------------------------------ UI SVG ICON
export const VIBRANIUM_SVG_ICON = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bp-vib-radial" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="30%" stop-color="#c77dff" stop-opacity="0.8"/>
      <stop offset="65%" stop-color="#7b2cbf" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#3c096c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bp-claw-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#e0aaff"/>
      <stop offset="100%" stop-color="#7b2cbf"/>
    </linearGradient>
    <filter id="bp-vib-glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Arka Plan Kinetik Enerji Halkaları -->
  <circle cx="50" cy="50" r="46" stroke="#c77dff" stroke-width="1.8" stroke-dasharray="5 3" opacity="0.65"/>
  <circle cx="50" cy="50" r="41" fill="url(#bp-vib-radial)"/>
  <circle cx="50" cy="50" r="38" stroke="#9d4edd" stroke-width="1.5" opacity="0.75"/>
  <!-- Wakanda Altıgen Geometrik Kafes -->
  <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" stroke="#e0aaff" stroke-width="1.6" fill="none" opacity="0.55"/>
  <!-- Kinetik Şok Işınları -->
  <path d="M50 16 L50 6 M50 84 L50 94 M16 50 L6 50 M84 50 L94 50 M26 26 L18 18 M74 74 L82 82 M26 74 L18 82 M74 26 L82 18" stroke="#ffffff" stroke-width="2.0" stroke-linecap="round" filter="url(#bp-vib-glow)"/>
  <!-- Vibranyum Pençe Dişleri Kolyesi (10 Dişli Çark Dizilimi) -->
  <g fill="url(#bp-claw-grad)" stroke="#3c096c" stroke-width="0.8" filter="url(#bp-vib-glow)">
    <polygon points="50,21 46.5,33 53.5,33"/>
    <polygon points="67,26.5 61,36.5 66.5,39"/>
    <polygon points="77.5,41 68,48 71.5,52.5"/>
    <polygon points="77.5,59 71.5,47.5 68,52" transform="rotate(36 72 54)"/>
    <polygon points="67,73.5 66,61 61,63.5"/>
    <polygon points="50,79 53.5,67 46.5,67"/>
    <polygon points="33,73.5 39,63.5 34,61"/>
    <polygon points="22.5,59 32,52 28.5,47.5"/>
    <polygon points="22.5,41 28.5,52.5 32,48" transform="rotate(-36 28 46)"/>
    <polygon points="33,26.5 34,39 39,36.5"/>
  </g>
  <!-- Merkezi Kinetik Çekirdek -->
  <polygon points="50,38 60.5,44 60.5,56 50,62 39.5,56 39.5,44" fill="#240046" stroke="#c77dff" stroke-width="1.6"/>
  <circle cx="50" cy="50" r="4.8" fill="#ffffff" filter="url(#bp-vib-glow)"/>
</svg>`;

// ------------------------------------------------------------------ BLACK PANTHER SKILL
export class BlackPantherSkill {
  constructor({ scene, player, obstacles, cameraRig, chaser } = {}) {
    this.scene = scene;
    this.player = player;
    this.obstacles = obstacles;
    this.cameraRig = cameraRig;
    this.chaser = chaser;

    // Yetenek Yapılandırması
    this.name = 'panther';
    this.label = 'VİBRANYUM ŞOKU';
    this.duration = 5.5; // 5.5 saniye süre (Vibranyum Kinetik Sprint)
    this.maxTime = 5.5;
    this.timeRemaining = 0;
    this.timeAlive = 0;
    this.active = false;
    this.charges = 1;
    this.maxCharges = 1;
    this.mode = 'panther';
    this.vibraniumSvgIcon = VIBRANIUM_SVG_ICON;
    this.baseSpeed = null;

    this._lastShatterCheck = 0;

    // Kök Görsel Grubu
    this.root = new THREE.Group();
    this.root.name = 'blackPantherVibraniumShockwave';
    this.root.visible = false;

    // 1. ÇİFT KATMANLI GENİŞLEYEN MOR ICOSAHEDRON ENERJİ KUBBESİ (Radius 1.5 -> 7.5m)
    this._buildEnergyDome();

    // 2. ZEMİNDE YAYILAN 3 KADEMELİ ALTIĞEN ŞOK HALKALARI (RingGeometry, thetaSegments: 6)
    this._buildHexShockRings();

    // 3. 15 ADET KIRIKLI (JAGGED) MOR-BEYAZ ŞİMŞEK ARKI (LineSegments)
    this._buildLightningArcs();

    // 4. GÖĞÜS / ZEMİN MERKEZLİ PARLAK MOR POINTLIGHT
    this.chestLight = new THREE.PointLight(0xc77dff, 0, 22);
    this.chestLight.position.set(0, 0.85, 0);
    this.root.add(this.chestLight);

    // Kök grubu oyuncu köküne bağla
    if (this.player && this.player.root) {
      this.player.root.add(this.root);
    } else if (this.scene) {
      this.scene.add(this.root);
    }
  }

  // ------------------------------------------------------------------ 1. ICOSAHEDRON KUBBE
  _buildEnergyDome() {
    this.domeGroup = new THREE.Group();
    this.domeGroup.position.set(0, 0.85, 0);
    this.root.add(this.domeGroup);

    // İç Katman: Parlayan yarı saydam mor Icosahedron kubbe
    this.innerDomeGeo = new THREE.IcosahedronGeometry(1.0, 2);
    this.innerDomeMat = new THREE.MeshBasicMaterial({
      color: 0x9d4edd,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.innerDomeMesh = new THREE.Mesh(this.innerDomeGeo, this.innerDomeMat);
    this.domeGroup.add(this.innerDomeMesh);

    // Dış Katman: Geometrik kafesli menekşe Icosahedron wireframe
    this.outerDomeGeo = new THREE.IcosahedronGeometry(1.14, 1);
    this.outerDomeMat = new THREE.MeshBasicMaterial({
      color: 0xc77dff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.outerDomeMesh = new THREE.Mesh(this.outerDomeGeo, this.outerDomeMat);
    this.domeGroup.add(this.outerDomeMesh);

    // Çekirdek Kinetik Parlama Sprite'ı
    const glowTex = createGlowTexture('#c77dff', '#ffffff', 128);
    this.coreGlowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });
    this.coreGlow = new THREE.Sprite(this.coreGlowMat);
    this.coreGlow.scale.set(3.2, 3.2, 1.0);
    this.domeGroup.add(this.coreGlow);
  }

  // ------------------------------------------------------------------ 2. ALTIĞEN ŞOK HALKALARI
  _buildHexShockRings() {
    this.groundRingsGroup = new THREE.Group();
    this.groundRingsGroup.position.set(0, 0.035, 0);
    this.root.add(this.groundRingsGroup);

    this.hexRings = [];

    // 3 Kademeli Konsantrik Altıgen Halkalar (thetaSegments: 6)
    const ringConfigs = [
      { inner: 0.25, outer: 0.65, color: 0xffffff, baseOpacity: 0.95 },
      { inner: 0.85, outer: 1.45, color: 0xc77dff, baseOpacity: 0.85 },
      { inner: 1.65, outer: 2.50, color: 0x7b2cbf, baseOpacity: 0.70 },
    ];

    for (let i = 0; i < ringConfigs.length; i++) {
      const cfg = ringConfigs[i];
      const geo = new THREE.RingGeometry(cfg.inner, cfg.outer, 6);
      geo.rotateX(-Math.PI / 2);

      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.baseOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      this.groundRingsGroup.add(mesh);

      this.hexRings.push({
        mesh,
        geo,
        mat,
        baseOpacity: cfg.baseOpacity,
        speed: (i + 1) * 1.35,
      });
    }
  }

  // ------------------------------------------------------------------ 3. 15 ŞİMŞEK ARKI
  _buildLightningArcs() {
    this.arcCount = 15;
    this.subSegmentsPerArc = 5; // Her ark 5 kırıklı alt parçadan oluşur
    this.verticesPerArc = this.subSegmentsPerArc * 2; // LineSegments için her segment 2 nokta
    const totalVertices = this.arcCount * this.verticesPerArc;

    this.lightningPositions = new Float32Array(totalVertices * 3);
    this.lightningColors = new Float32Array(totalVertices * 3);

    this.lightningGeo = new THREE.BufferGeometry();
    this.lightningGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.lightningPositions, 3)
    );
    this.lightningGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(this.lightningColors, 3)
    );

    this.lightningMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      linewidth: 2,
    });

    this.lightningLines = new THREE.LineSegments(this.lightningGeo, this.lightningMat);
    this.root.add(this.lightningLines);

    // Renk tanımları
    this._colWhite = new THREE.Color(0xffffff);
    this._colViolet = new THREE.Color(0xc77dff);
    this._colPurple = new THREE.Color(0x7b2cbf);
    this._colDarkPurple = new THREE.Color(0x3c096c);
  }

  // ------------------------------------------------------------------ AKTİVASYON
  activate() {
    if (this.active) return false;
    if (game && (game.halted || (this.player && this.player.controlsLocked))) return false;

    this.active = true;
    this.timeAlive = 0;
    this.timeRemaining = this.duration;
    this.root.visible = true;

    // Vibranyum Kinetik Sprint Boost (Ciddi hız artışı: en az +14 m/s boost)
    this.baseSpeed = game.state ? game.state.speed : 18;
    game.speedOverride = Math.min(CONFIG.topSpeed + 14, this.baseSpeed + 14);

    // Başlangıç animasyon boyutunu sıfırla (1.5m)
    this.innerDomeMesh.scale.setScalar(1.5);
    this.outerDomeMesh.scale.setScalar(1.5 * 1.12);
    this.coreGlow.scale.setScalar(3.2);

    // Göğüs merkezli parlak mor PointLight burst
    if (this.chestLight) {
      this.chestLight.color.setHex(0xc77dff);
      this.chestLight.intensity = 7.5;
    }

    const chestWorldPos = new THREE.Vector3(
      this.player ? this.player.x : 0,
      (this.player ? this.player.y : 0) + 0.85,
      0
    );

    // AAA VFX Core: Flaş patlama ışığı ve kamera sarsıntısı
    triggerFlashLight(this.scene, chestWorldPos, 0xc77dff, 9.0, 0.48);
    triggerCameraShake(this.cameraRig, 0.48, 0.42);

    // Chaser / Venom yakınsa geri püskürt
    if (this.chaser && this.chaser.isNear && typeof this.chaser._dropBack === 'function') {
      this.chaser._dropBack();
    }

    // Çevredeki tüm engelleri anında 16m yarıçapta paramparça et
    this.shatterNearbyObstacles(16.0);

    // Olay yayını
    emit('vibraniumShockwave', { position: chestWorldPos });
    emit('specialOn', { mode: 'panther', duration: this.duration });

    return true;
  }

  // ------------------------------------------------------------------ GÜNCELLEME
  update(time, dt) {
    // Esnek argüman desteği: update(dt) veya update(time, dt)
    if (dt === undefined) {
      dt = time || 0.016;
      time = this.timeAlive;
    }

    if (!this.active) return;
    if (game && game.halted) return;

    this.timeAlive += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    if (this.timeRemaining <= 0) {
      this.deactivate();
      return;
    }

    // Yetenek aktif olduğu sürece hız takviyesini koru
    if (this.baseSpeed != null && game.state) {
      game.speedOverride = Math.min(CONFIG.topSpeed + 14, this.baseSpeed + 14);
    }

    const progress = Math.min(1.0, this.timeAlive / this.duration);

    // 1. KUBBE GENİŞLEMESİ (Radius 1.5 -> 7.5m)
    // Patlayıcı kinetik genişleme eğrisi (hızlı dışa doğru, kinetik titreşimli)
    const expandEase = 1.0 - Math.pow(1.0 - Math.min(1.0, progress * 1.8), 3.0);
    const baseRadius = 1.5 + (7.5 - 1.5) * expandEase;
    const pulse = 1.0 + Math.sin(this.timeAlive * 34.0) * 0.055;
    const currentRadius = baseRadius * pulse;

    this.innerDomeMesh.scale.setScalar(currentRadius);
    this.outerDomeMesh.scale.setScalar(currentRadius * 1.12);
    this.coreGlow.scale.setScalar(3.2 * (1.0 + Math.sin(this.timeAlive * 24.0) * 0.25));

    // Çift katmanlı zıt yönlü dönüş
    this.innerDomeMesh.rotation.x += dt * 1.9;
    this.innerDomeMesh.rotation.y += dt * 2.6;
    this.outerDomeMesh.rotation.x -= dt * 2.2;
    this.outerDomeMesh.rotation.z += dt * 3.1;

    // Süre sonuna doğru pürüzsüz sönümleme
    const fade = progress < 0.72 ? 1.0 : Math.max(0, 1.0 - (progress - 0.72) / 0.28);
    this.innerDomeMat.opacity = 0.38 * fade;
    this.outerDomeMat.opacity = 0.85 * fade;
    this.coreGlowMat.opacity = 0.90 * fade;

    // 2. ZEMİN ALTIĞEN ŞOK HALKALARI GÜNCELLEMESİ
    if (this.player) {
      // Karakter zıplasa bile şok halkalarını zemine yapışık tut
      const groundOffset = (this.player.floorY != null ? this.player.floorY - this.player.y : 0) + 0.035;
      this.groundRingsGroup.position.y = groundOffset;
    }

    for (let i = 0; i < this.hexRings.length; i++) {
      const ring = this.hexRings[i];
      // 3 kademeli dışa doğru dalgalanan altıgen şok halkaları
      const cycle = (this.timeAlive * 1.25 + i * 0.33) % 1.0;
      const ringScale = 0.45 + cycle * 5.8;
      ring.mesh.scale.set(ringScale, ringScale, 1.0);

      // Zıt yönlerde dönen Wakanda altıgen kafes örüntüsü
      const dir = i % 2 === 0 ? 1 : -1;
      ring.mesh.rotation.z += dt * (1.5 + i * 0.8) * dir;

      // Genişledikçe yumuşakça sönümlenir
      const ringAlpha = Math.sin(cycle * Math.PI) * fade;
      ring.mat.opacity = ring.baseOpacity * ringAlpha;
    }

    // 3. 15 KIRIKLI ŞİMŞEK ARKI GÜNCELLEMESİ
    this._updateLightning(this.timeAlive, currentRadius);

    // 4. GÖĞÜS DİNAMİK IŞIK GÜNCELLEMESİ
    if (this.chestLight) {
      this.chestLight.intensity = (5.2 + Math.sin(this.timeAlive * 32.0) * 1.8) * fade;
    }

    // 5. SÜREKLİ KİNETİK BARİYER: Genişleyen kubbe alanına giren engelleri yok et
    if (this.timeAlive - this._lastShatterCheck > 0.06) {
      this._lastShatterCheck = this.timeAlive;
      this.shatterNearbyObstacles(Math.min(16.0, currentRadius + 2.0));
    }
  }

  // ------------------------------------------------------------------ ŞİMŞEK ARK DİNAMİĞİ
  _updateLightning(time, currentRadius) {
    const pos = this.lightningPositions;
    const col = this.lightningColors;

    // Yakındaki engelleri hedef al
    const targets = [];
    if (this.obstacles && this.obstacles.active) {
      const list = this.obstacles.active;
      const px = this.player ? this.player.x : 0;
      for (let i = 0; i < list.length && targets.length < this.arcCount; i++) {
        const o = list[i];
        if (o.z >= -16.0 && (o.z - (o.length || 0)) <= 4.0) {
          const cy = o.parts && o.parts[0] ? (o.parts[0].y0 + o.parts[0].y1) * 0.5 : 1.0;
          // Yerel koordinat farkı
          targets.push(new THREE.Vector3(o.x - px, cy - 0.85, o.z));
        }
      }
    }

    let ptr = 0;
    const origin = new THREE.Vector3(0, 0.85, 0);

    for (let arc = 0; arc < this.arcCount; arc++) {
      let target;

      if (arc < targets.length) {
        target = targets[arc];
      } else {
        // Engeller yoksa kubbe perimetresine doğru radyal fışkır
        const theta = (arc / this.arcCount) * Math.PI * 2 + Math.sin(time * 8.0 + arc) * 0.4;
        const phi = (Math.sin(arc * 3.7 + time * 5.0) * 0.45 + 0.5) * Math.PI;
        const r = currentRadius * (0.85 + Math.random() * 0.3);
        target = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * r,
          Math.cos(phi) * r * 0.55 + 0.85,
          Math.sin(phi) * Math.sin(theta) * r
        );
      }

      // 5 kırıklı alt parça (jagged segments)
      let prevPoint = origin.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15
      ));

      for (let seg = 1; seg <= this.subSegmentsPerArc; seg++) {
        const t = seg / this.subSegmentsPerArc;
        const nextPoint = new THREE.Vector3().lerpVectors(origin, target, t);

        // Uç nokta hariç ara noktalara zikzak kinetik kırılma (jagged jitter) ekle
        if (seg < this.subSegmentsPerArc) {
          const jitterAmount = 0.42 * Math.sin(t * Math.PI);
          nextPoint.x += (Math.random() - 0.5) * jitterAmount * 1.8;
          nextPoint.y += (Math.random() - 0.5) * jitterAmount * 1.8;
          nextPoint.z += (Math.random() - 0.5) * jitterAmount * 1.8;
        }

        // Segment Başlangıç Noktası
        pos[ptr * 3] = prevPoint.x;
        pos[ptr * 3 + 1] = prevPoint.y;
        pos[ptr * 3 + 2] = prevPoint.z;

        const c1 = (t - 1 / this.subSegmentsPerArc) < 0.35 ? this._colWhite : this._colViolet;
        col[ptr * 3] = c1.r;
        col[ptr * 3 + 1] = c1.g;
        col[ptr * 3 + 2] = c1.b;
        ptr++;

        // Segment Bitiş Noktası
        pos[ptr * 3] = nextPoint.x;
        pos[ptr * 3 + 1] = nextPoint.y;
        pos[ptr * 3 + 2] = nextPoint.z;

        const c2 = t > 0.65 ? this._colPurple : this._colViolet;
        col[ptr * 3] = c2.r;
        col[ptr * 3 + 1] = c2.g;
        col[ptr * 3 + 2] = c2.b;
        ptr++;

        prevPoint = nextPoint;
      }
    }

    this.lightningGeo.attributes.position.needsUpdate = true;
    this.lightningGeo.attributes.color.needsUpdate = true;
  }

  // ------------------------------------------------------------------ 4. 16M ENGEL İMHASI
  shatterNearbyObstacles(radius = 16.0) {
    if (!this.obstacles || !this.obstacles.active || !this.scene) return 0;

    const list = this.obstacles.active;
    const px = this.player ? this.player.x : 0;
    let count = 0;

    for (let i = list.length - 1; i >= 0; i--) {
      const o = list[i];
      if (!o) continue;

      const dx = Math.abs(o.x - px);
      // Şeritler arası ve Z eksenindeki mesafe kontrolü (16m yarıçap, tüm şeritler)
      const nearFace = o.z;
      const farFace = o.z - (o.length || 0);

      const inZReach = nearFace >= -radius && farFace <= 4.0;
      const inXReach = dx <= radius;

      if (inZReach && inXReach) {
        // Engelin 3D merkez noktasını belirle
        let cy = 1.0;
        if (o.parts && o.parts[0]) {
          cy = (o.parts[0].y0 + o.parts[0].y1) * 0.5;
        }
        const cz = o.z - (o.length || 0) * 0.5;
        const shatterPos = new THREE.Vector3(o.x, cy, cz);

        // AAA VFX Core: Mor kristal parçalarına (color: 0x9d4edd, emissive: 0xc77dff) ayırarak parçala
        shatterObstacle(this.scene, shatterPos, {
          color: 0x9d4edd,
          emissive: 0xc77dff,
          sparkColor: '#c77dff',
          blastForce: 13.5,
        });

        // Engeli oyundan temizle
        this.obstacles.remove(o);

        // Olay bildirimleri
        emit('crash', { position: shatterPos });
        emit('vibraniumShatter', { position: shatterPos });
        count++;
      }
    }

    if (count > 0) {
      // Çarpışma glitch'lerini önlemek için küçük tolerans
      this.obstacles.grace(0.35);
    }

    return count;
  }

  // ------------------------------------------------------------------ ABSORB HIT
  absorbHit(hit) {
    if (!this.active) return false;

    // Çarpan engeli parçala
    if (hit && hit.obstacle) {
      const o = hit.obstacle;
      const cy = o.parts && o.parts[0] ? (o.parts[0].y0 + o.parts[0].y1) * 0.5 : 1.0;
      const shatterPos = hit.position
        ? hit.position.clone()
        : new THREE.Vector3(o.x, cy, o.z);

      shatterObstacle(this.scene, shatterPos, {
        color: 0x9d4edd,
        emissive: 0xc77dff,
        sparkColor: '#c77dff',
        blastForce: 14.5,
      });

      this.obstacles.remove(o);
    }

    // 16 metre yarıçaptaki diğer tüm engelleri de yok et
    this.shatterNearbyObstacles(16.0);

    // Sarsıntı ve mor kinetik patlama flaşı
    const centerPos = hit && hit.position
      ? hit.position
      : new THREE.Vector3(
          this.player ? this.player.x : 0,
          (this.player ? this.player.y : 0) + 0.85,
          0
        );

    triggerFlashLight(this.scene, centerPos, 0xc77dff, 9.5, 0.45);
    triggerCameraShake(this.cameraRig, 0.45, 0.40);

    // Güvenlik süresi ver (oyuncu kesintisiz koşmaya devam eder)
    this.obstacles.grace(1.5);

    emit('vibraniumAbsorb', { position: centerPos });
    return true;
  }

  // ------------------------------------------------------------------ DEAKTİVASYON
  deactivate() {
    // Hız aşımını temizle ve sıfırla
    if (this.baseSpeed != null) {
      game.speedOverride = null;
      this.baseSpeed = null;
    }

    if (!this.active) return;
    this.active = false;
    this.timeRemaining = 0;
    this.root.visible = false;

    if (this.chestLight) {
      this.chestLight.intensity = 0;
    }

    // Bitiş anında oyuncuya koruyucu tolerans
    if (this.obstacles && typeof this.obstacles.grace === 'function') {
      this.obstacles.grace(0.35);
    }

    emit('specialOff', { mode: 'panther' });
  }

  // ------------------------------------------------------------------ SIFIRLAMA (RESET)
  reset() {
    this.deactivate();
    this.timeAlive = 0;
    this.timeRemaining = 0;
  }

  // ------------------------------------------------------------------ TEMİZLEME (DISPOSE)
  dispose() {
    this.deactivate();

    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }

    // Tüm Three.js geometrilerini ve materyallerini temizle
    this.root.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.dispose();
      }
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.hexRings = [];
  }
}

// ------------------------------------------------------------------ FACTORY FUNCTION
export function createBlackPantherSkill(params) {
  return new BlackPantherSkill(params);
}

export default createBlackPantherSkill;
