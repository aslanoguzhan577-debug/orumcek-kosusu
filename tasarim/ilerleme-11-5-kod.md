# 11.5 kod ilerlemesi

Plan: `tasarim/11-5-gorevler.md`. Tasarım: `11-5-yol-surprizleri.md` (A), `11-5-olaylar.md` (B–D),
`11-5-modeller.md` (M). Kod haritası: `HARITA.md`.

## Tamamlanan görevler

### Görev 1 — config, state, saf yardımcılar (DONE)

| Dosya | Değişiklik |
|---|---|
| `src/config.js` | `obstacles.gap/gate/girder/rowWarnTime` (162-166); `patterns.rows` (461-469); yeni üst düzey `events` grubu (372-395). Sayılar tasarım §2'den birebir. |
| `src/game.js` | `state.eventKind/eventTime/eventBonusTime` (33-35); `mult.event` (45); çarpan formülü `(base + run + temp + event) * factor` (224); `_resetRun` `mult.event = 0` (238). |
| `src/patterns.js` | `descLength` gap/gate/girder -> `desc.len` (105-107); `AFTER_TIME` gap 0.75 / gate 0.6 / girder 0.5 (124); yeni `descLanes` (128) ve `girderOffset` (136). Üretim davranışı değişmedi. |
| `tools/test-skills.mjs` | import genişletildi (7); görev 1 assert'leri eklendi (52-73): olay çarpanı skora girer, restart sıfırlar; `descLanes` 5 durum; `girderOffset` park/sebest/|x|<=amp taraması; `descLength` gap/girder. |
| `tasarim/HARITA.md` | §1 dosya satır aralıkları, §2 update/_resetRun, §3 emit satırları, §6 yardımcı tablosu + `_block` adımları, §8 satır referansları, §14 CONFIG tablosu (yeni `events` satırı, `rows`, satır engelleri), §15 test satırı, §16 sistem döngüsü. |

Kontroller (hepsi geçti): `node tools/test-skills.mjs` -> `OK 1337 checks`; `check-patterns.mjs` ->
`OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.`; `check-quality.mjs` ->
`OK: adaptive resolution`; `test-audio.mjs` -> `OK: audio lifecycle, stingers and simulated 20-minute soak …`.
Temas eden dosyalarda `node --check` temiz.

### Görev 1 kararları

- D1–D6 (tasarım H) bağlayıcı kabul edildi; görev 1 bunların hiçbirini koda bağlamaz (engel/olay yok).
- Görev 1 "no generation change" dediği için `PatternGenerator.reset()` yeni zamanlama alanları
  (`nextRowD`, `lastRow`, `nextEventD` gibi) **eklenmedi**; bunlar görev 5'te `_block`/`_row` ile gelir.
- `_resetRun` yalnız `mult.event` sıfırlar; `state.eventKind/eventTime/eventBonusTime` alanlarının
  sahibi road-events sistemidir (11-5-olaylar.md S.2 `reset()`, görev 7), mevcut "her sistem kendi
  zamanlayıcısını sıfırlar" kuralıyla aynı.
- `descLanes` her çağrıda yeni dizi döner (spawn anında bir kez çağrılır; kare başına çağrılmamalı).
- `girderOffset` işaretli x döner: `open` 2 -> park halinde -1.1 (kapalı dış şerit tarafı),
  `open` 0 -> +1.1; `tau = lockTime + period/2 = 2.2`'de açık şeridin üstünde (+1.1).

### Görev 2 — collider grupları, pit, yama, olay vuruşu (DONE)

| Dosya | Değişiklik |
|---|---|
| `src/obstacles.js` | gap/gate/girder şekilleri ve len anahtarlı gap cache; spawn'da tek `descLanes` çağrısı, grup ve owner; havuz bayraklarının sıfırlanması; pit zemin değildir, yukarıdan düşüş front hit; Cap sörfü pit'i açıkça yok sayar; grup kaldırma, yama taşıma/shift/reset; rowWarn/rowPass; graced/eventHit/onEventZone. |
| `src/obstacle-art.js` | Görev 2'nin istediği boş `addRow`/`addPatch` metotları. |
| `tools/stub-hooks.mjs` | Obstacles için no-op obstacle-art, sonraki sense kontrolü için createSensePickup stub'u. Gerçek collider ve Player kullanılır. |
| `tools/test-skills.mjs` | 20/39 m/s: grup, front/side hit, pit floor/düşüş/jump, patch/shift/reset, reverse-index clear, gate slide, girder lane/pass, ilk tau uyarısı, event grace/absorb/zone, Cap y=0 muafiyeti. |
| `tasarim/HARITA.md` | Yeni gruplar, kancalar, pit, yama ve art arayüzü. |

Son kontroller: `test-skills` **OK 1449 checks**; `check-patterns` **OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.**;
`check-quality` **OK: adaptive resolution**; `test-audio` **OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)**.
Dokunulan JS/MJS dosyalarında `node --check` geçti.

Kararlar / devir:
- D6 geometriyle değil `part.pit && game.heroSpecials.active && mode === 'cap'` ile uygulanır; y=0'da bile absorb tüketmez/yama bırakmaz.
- Kancalar yeniden bağlanmadı: main'in absorb kancaları, chaser'ın onSideStumble ve decoy'nun zinciri aynı yoldan çalışır.
- `remove` yalnız istenen collider'ı splice eder, diğerlerini normal release'e bırakır; kaldırılan owner uyarı/pass/çizim üretmez.
- `eventHit` true = vuruş yolu denendi; absorb/cooldown yine `_hit` içindedir. Grace false döndürür.
- Yeni engel üretimi ve olay çalıştırma yok. Görsel/telefon kontrolü görev 3'te.

### Görev 3 — engel görselleri (DONE; gerçek görüntü kontrolü bekliyor)

| Dosya | Değişiklik |
|---|---|
| `src/obstacle-art.js` | ShapeBuilder `ry`; M1 delik şeritleri/kaburgaları, bantlı direkler, ok tabelaları, kıvrık raylar, chevron ve yama; M2 direk/truss/sinyaller, şeritli boom, barlar, bağlar, lambalar ve V'ler; M3 bütün kiriş parçaları, jib, zebra pad ve yeşil oklar. Dokuz tür kapasitesi M0 gibi, ortak malzeme, sadece belirtilen hull'lar. `addRow` tau matrisleri ve `addPatch`. |
| `tools/test-skills.mjs` | Gerçek builder/API kaynaklarını headless recorder ile çalıştıran primitive/hull sayısı ve kapasite assert'leri; 4–6 m gap/yama scale, sabit direkler, gate drop uç/orta zamanları, iki yönde girder pivot/pad/go kontrolleri. GPU/shading testi değildir. |
| `tasarim/HARITA.md` | Yeni türler, kapasiteler, tarifler ve art API satırları. |

Son kontroller: `test-skills` **OK 1515 checks**; `check-patterns` **OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.**;
`check-quality` **OK: adaptive resolution**; `test-audio` **OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)**.
Dokunulan JS/MJS dosyalarında `node --check` geçti.

Kararlar / devir:
- M0–M3 öncelikli: gapPatch tüm parçaları hull:false + ink yan şeritleridir; A.1'in eski hull tanımı uygulanmadı. Hook block M3 satır 10'un varsayılan hull'u korunur.
- Tarifin izin verdiği işaret düzeltmesi: gapEnds/girderGo chevron'larında `ry = -a * 0.6`; Three.js Y rotasyonuyla uçlar böyle -Z'de birleşir. Geometrik uç yönü assert ile kontrol edilir.
- Yeni tüm geometri/material constructor'da oluşur, sahneye eklenir. Mevcut warm-up sahnenin tamamını compile/render eder; warmup değişmedi.
- Tarayıcı kontrolü denendi: **The browser access host is unavailable**. Portre/yatay, düz/viraj, toon non-uniform scale ve gerçek telefon draw-call/frame-time ölçümü doğrulanmadı; M1–M3 Look at listeleri insan kontrolü olarak kalıyor.
- Üretim hâlâ değişmedi; elle `_spawn` ile kontrol edilir, otomatik row/olay yok.

### Görev 4 — his: pit, gate, girder ve iki şerit kaçışı (DONE)

| Dosya | Değişiklik |
|---|---|
| `src/powerups/sense.js` | Pit simülasyon zemininden çıkarılır, içine düşüş vuruştur; gate high gibi slide, girder wall gibi lane kaçışı seçer. Doğrudan komşu yoksa iki şerit kaçışı: ara şeridin duvar zamanı > iki geçiş + 0.08, uzak şerit simülasyonu temiz. Ara şeritte mevcut yan temas da reddedilir. |
| `src/obstacles.js` | Row pass, önceki z konumundaki son kenar da oyuncuyu geçtiğinde verilir (`z - dz - length`); son overlap karesinde gerçekleşen hit'ten önce pass verilmez. |
| `src/obstacle-art.js` | Son incelemede M1/M3'ün izin verdiği chevron Y-rotasyon işaret düzeltmesi; başka tarif değişmedi. |
| `tools/test-skills.mjs` | 120/60/30/20 FPS: gap jump / gate slide 19/26/39 m/s; girder iki yönde, orta ve kapalı dış şeritten bir/iki hareket, 20/39 m/s. Her koşulda hit yok, tek rowPass. Low/high/wagons regresyonları; ara şerit yan temas/çok yakın duvar ve dolu uzak şerit kaçışını reddetme; son overlap'te hit varsa pass yok. |
| `tasarim/HARITA.md` | Yeni sense kuralları, gerçek satır referansları, row event'leri, havuz/art/test haritası. |

Son kontroller (görev 4 sonu):
- `node tools/test-skills.mjs` → **OK 1747 checks**
- `node tools/check-patterns.mjs` → **OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.** (150 seed × 38424 m)
- `node tools/check-quality.mjs` → **OK: adaptive resolution**
- `node tools/test-audio.mjs` → **OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)**
- Dokunulan bütün JS/MJS dosyalarında `node --check` geçti (görev 1 dosyaları da yeniden kontrol edildi); `git diff --check` temiz.

Tarifteki kısa sense değişikliklerinin neden tek başına yetmediği:
- 19 m/s gap testinde, sadece pit/high/wall eklemek erken jump ve deliğin sonunda crash üretti.
- `simulate` artık en az `S.simStep` olmak üzere gerçek obstacle `dz / closingSpeed` kare adımını kullanır: Player'ın Euler düşüşüyle aynı hesap. Hit penceresi, obstacle zaten hareket ettiği için önceki kareden süpürülen son kenarı da içerir.
- Aynı test 60 FPS'te rowPass'in hit'ten önce yayıldığını gösterdi; owner pass kontrolündeki `-o.dz` bunu önler. Bunlar CONFIG sayısı değiştirmeden çarpışma/tahmin eşlemesidir.

## Task 5 - generator rows/zones and fairness checker (DONE)

Files: src/patterns.js:163 (schedule reset), :192 (blocks/extras), :345 (row choice/combos),
:361 (wide row placement), :387 (zones); tools/check-patterns.mjs:98 onward;
tools/test-skills.mjs:76; tasarim/HARITA.md sections 1/6/15.

- Gap and gate occupy all lanes; girder occupies centre + one outer lane and routes through
  the other outer lane. Types unlock at CONFIG distances, avoid consecutive repeats and get
  endless combos/shorter intervals. Venom/Goblin zones alternate from the 1200 m due point.
- Every extra runs once per block, including safe-start, calm, row and zone blocks. Safe-start
  remains coin-only. Special/calm blocks and the pickupClear approach expose routeFree=null.
  Same seed produces identical descriptors over 20 km; tests cover every block and all new types.
- C1-C14 are implemented. Wide descriptors expand per lane for route/overlap/coin checks;
  owner art counts only once. All nine new art kinds are capacity checked. Gap hole/ends/patch
  capacity stays reserved through patch release. Pits are not floor; gap cells include the
  worst 20 FPS swept tail. C3 retains the analytic >=0.15 s jump window and also requires a
  positive Euler/swept jump window at dtCap. The moving girder's longitudinal contact lies in
  its locked interval; its two parked BLOCK lanes and free outer lane participate in route
  search. Clearance is checked across tau -0.2..1.2 and both directions, plus the opposite swing.
- Spacing corrections, with no existing rule weakened and no CONFIG tuning:
  1. Seed 15851 failed C4 for endless combos. Partner free changed from
     routeNext - v*checkGapTime - 1 to routeNext: adds v*0.6+1 metres so every partner has the
     full run-up despite shrinking endless recovery. Other row spacing curves still tighten.
  2. Zone start changed free+v*0.6 to free+v*0.6+1 m for speed-growth/grid slack.
  3. Zone laneFree changed end to end+1 m so a later side collider and its rounded cell cannot
     enter the inclusive zone end (seeds 15851/23770 and others). The zone descriptor length
     and all event CONFIG numbers stay as designed.
- Task-end checks: test-skills OK 3066 checks; check-patterns 150 seeds x 38424 m,
  last line OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
  Lowest measured minute margin 0.45 s (default margin subset: 40 seeds). Per km: gap 0.7,
  gate 0.7, girder 0.6, zones 0.5; combined rows 2.0. Quality/audio/node --check all passed.

## Task 6 - pure event row and timing functions (DONE)

Files: src/event-logic.js:8, :16, :34, :43; tools/test-skills.mjs:104; tasarim/HARITA.md.

- S.1 functions use CONFIG exactly: rAt/floorW, warnAt/restAt/doubleChance, nextRow,
  nearestSafe and rewardFor. nextRow consumes exactly two RNG draws; delta is the worst
  nearest escape over every safePrev lane. Rewards use D3 (+3 clean / +1 survived).
- Tests: seven distances from 1200 to 300000 m; every nonempty safePrev mask, every valid aim,
  500 seeded draws each. Brute-force delta, safe lane/aim, warning floors, monotonic tempo,
  double cap, Goblin lead, three-strike fit, reward examples and nearestSafe ties all pass.
- Task-end checks: test-skills OK 213101 checks; check-patterns 150 x 38424 m with the same
  OK line/frequencies/margin; quality OK: adaptive resolution; audio OK: audio lifecycle,
  stingers and simulated 20-minute soak (8 cores, peak music 36); node --check passed.

## Task 7 - director, Venom logic and chaser hunting (DONE)

Files: src/road-events.js:11 (director/reset), :39 (calm/start), :64 (lifecycle), :87 (volley),
:140 (sense), :153 (reward/end); src/chaser.js:76, :131, :139, :149, :216, :235;
src/main.js:13, :163; tools/stub-hooks.mjs:11, :16, :38; tools/test-skills.mjs:1389;
tasarim/HARITA.md sections 1/2/3/7/15.

- Registered after tracer as game.roadEvents. Manual start('venom') only: running, >=1200 m,
  away chaser, one event, no special/flight/zip/tracer/boost/locked controls. Goblin returns
  false until task 9. Director imports no art module, accepts optional art and hides it on
  reset/end. No onEventZone hook or automatic activation is installed (task 13).
- Seeded event RNG is reset from obstacles.seed xor 0x9e3779b9. Aimed strikes never overlap;
  actual row.warn (including two-lane floor) must fit before the volley cutoff. Sense makes
  real lane changes, counts dodges and emits senseDodge. Shared eventHit -> side-hit -> decoy
  wrapper -> chaser remains intact; Iron Spider/hero absorb paths retain their ownership.
- Hunt grants one spare stumble; next unabsorbed mistake catches. Hunting scale/screen share
  and forced poses use CONFIG; ending a hunt never replaces an active catch animation.
- Finish silently adds coins, sets mult.event and the full 12 s timer, then emits reward/end.
  Clean drops Venom away; a hit leaves him near for nearTime. Expiry emits eventBonusOff once.
  Pause/hit-stop freeze; restart/menu/gameover clear event state and bonus; halt or a mid-event
  special aborts without reward. Short zones finish before a slam can cross endMargin.
- Timing decision for task 8: S.2 says _finish rewards then _end; B.3 also mentions reward at
  8.8 s but _end at 10 s. This implementation follows S.2: outro pose starts at 8.8 s, reward
  and end at 10 s (or the early zone boundary). Clean catch pose lasts 0.6 s. If reward FX must
  fire at 8.8 s while the event remains active, separate reward delivery from end in task 8;
  do not duplicate rewards or reset the 12 s timer twice.
- Tested with real game.update, Player, Obstacles and Chaser at 1500/20000 m: refusal guards,
  first hit/second catch, clean and hit-once survival rewards, full bonus/expiry, sense/grace,
  warning floors/serialization, identical seeded volley through 100 paused frames, restart,
  menu/gameover/halt/special aborts, early boundary, decoy chain and catch absorption.
- Final exact checks:
  node tools/test-skills.mjs -> OK 213346 checks
  node tools/check-patterns.mjs -> OK: every seed has a passable route; reaction margin >= 0.4 s everywhere.
  node tools/check-quality.mjs -> OK: adaptive resolution
  node tools/test-audio.mjs -> OK: audio lifecycle, stingers and simulated 20-minute soak (8 cores, peak music 36)
  node --check passed for all eight JS/MJS files touched in this pass; git diff --check passed.
  Pattern report: 150 seeds x 38424 m; gap 0.7/km, gate 0.7/km, girder 0.6/km,
  combined rows 2.0/km, zones 0.5/km; lowest measured minute margin 0.45 s.

## Next coder: task 8 (nothing from 8+ implemented)

- Add event-art warnings/tendrils and guarded driving calls; main constructs/passes the art.
  Director already exposes strike {deadly,delta,warn,left,phase,hit}, t, hits, dodged, outroAt.
- Dolly is deliberately not set in task 7. Task 8 must track ownership: on abort, do not clear
  a new wall/Raimi skill's dolly after that skill has taken over the camera. Audit all setDolly
  callers again; do not assume _calm implies a flight cannot have started on the abort frame.
- Manual console entry is game.roadEvents.start('venom') at >=1.2 km with an away chaser.
  Zones remain quiet track; Goblin logic (9), art (8/10/11), FX/HUD/missions/audio and automatic
  zone hookup (12-14) remain deferred exactly as requested. Save formats are unchanged.
- Human phone QA still needed: 360x740 portrait + landscape, straight + curves, start and
  39 m/s; hole reads as a hole, signs and gate signals read at distance, shutter down at 1.6 s,
  green girder lane stays visibly clear in both swing directions, patch shading/scale and
  draw calls/frame time. Headless checks do not test GPU/rendering. For task 8 also inspect
  Venom framing and lane-strip fill reaching the feet exactly at slam.
- No commit, no new library/build step, no scratch files. Existing tasks 1-4 and unrelated
  user 11.3 design/prototype files were preserved. No required logic task remains unfinished.
