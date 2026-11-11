# 11.3 The Daily Bugle boards: the city talks about the player

Logic source: `proto/11-3-mansetler.js` (catalogue, `buildSlots`, `bugleDeck`, `heroSlot`, `recordPassed`, self-check that runs on import; verified in node). It moves to `src/bugle-logic.js` unchanged. Sheet for the owner: `proto/11-3-bugle.html`. Painters: `drawBuglePage`, `drawRecordBoard`, `drawTopFive` in `proto/sehir-tex.js` (seen on the texture sheet). The boards in the game camera are **not seen**.

## 1 The idea

J. Jonah Jameson's paper has bought every board in town and it is obsessed with one runner: this one. A board never shows a neutral fact; it shouts, it is slightly unfair, and it knows the player's name, best score, friends' scores, character, and what just happened in this run. The first night board, sixteen metres wide on the arch after the tunnel, says "{N} GECEYİ GÖRDÜ!".

## 2 Sixteen slots, painted before the run

The Bugle atlas is 2048 x 1024 = 16 slots of 512 x 256 (`SLOT` in the module). `buildSlots({ name, best, mult, skin, runs })` decides what each slot says for this player; `runs` (number of saved scores) rotates the jokes between runs.

| Slot | Content | Shown when (`bugleDeck`) |
|---|---|---|
| G1, G2, G3, G4 | four different generic headlines | always, in rotation |
| VENOM | one of the two Venom headlines | always, in rotation |
| WANTED | ARANIYOR: {N}, the best score, "REKOR PUAN · ÖDÜL: YOK, ONUR VAR"; on a first run the `first` headline instead | always |
| TOP5 | ŞEHRİN EN HIZLILARI: the saved top 5, the player's rows in red | always |
| CHASE5K / CHASE1K / CHASE100 | record countdown, tabloid-rounded | best ≥ 10000 and ≤ 5000 left / best ≥ 2000 and ≤ 1000 left / ≤ 100 left |
| BROKEN | record broken | from the moment the score passes the best, for the rest of the run (twice in the deck) |
| STUMBLE | a stumble headline | for 600 m after a stumble |
| MULT | multiplier headline with the run's mission multiplier | multiplier ≥ 5 |
| SKIN | the headline of the selected character | always (first in a calm run) |
| NIGHT | a night headline | `dayPhaseAt` is night |
| LOOP | dawn / second day headline | dawn district, or loop ≥ 2 |

Board number `n` (a counter that grows with every Bugle board placed in the run) shows `deck[n mod deck.length]`: urgent slots sit at the front of the deck, so the next boards that appear react to what just happened. The hero board on the Neon arch always shows `heroSlot()`: NIGHT, or BROKEN after a record.

`ctx` for `bugleDeck`: `score = floor(state.score)`, `best` = the top score of `spidey.scores` (the value `ui.js` uses for its record flag), `mult = state.multiplier`, `d = world.distance`, `stumbleD` = distance at the last `stumble` event (−1 at run start), `night`, `dawn`, `loop` from `city-logic.js`.

## 3 Lifecycle: no texture work inside a run

- `paintBugle()` (`11-3-kaplamalar.md` §3.3) repaints the one existing canvas and sets `needsUpdate`. Computed cost: 16 pages of canvas drawing plus one 8 MB upload, some tens of milliseconds on a phone. **Not measured.**
- It runs only while no run is in progress. The city system keeps a signature string `name|skin|best|runs|multiplier` read from `spidey.name`, `spidey.skin`, `spidey.scores` and the mission state; once per second while `state.mode !== 'running'` it compares and repaints if the signature changed. That covers: first load (after the fonts are ready), a new name, a new character, a finished run (new scores), a completed mission set.
- At `start` it compares once more; if the player changed the name and pressed play within that second, it repaints right there, under the screen change (the only repaint that can coincide with a start; never later).
- During the run a board changes what it shows only by its per-instance UV rectangle, and only when its segment is recycled 164 m ahead, beyond the fog end (155-160 m). A visible board never changes.
- No canvas, texture, material or mesh is created after `initCity`.

## 4 Boards are instances

Three `InstancedMesh` of one unit plane, each with the board hook of `11-3-kaplamalar.md` §4.3 and an `InstancedBufferAttribute aUv` (4 floats):

| Mesh | Map | Capacity | Who uses it |
|---|---|---|---|
| `boardsTabela` | tabela | 32 | portal name boards, Chinatown shop names |
| `boardsAds` | Neon day atlas (ads rows) | 40 | Neon ad boards |
| `boardsBugle` | Bugle atlas | 24 | Neon Bugle boards, the arch, Midtown roof billboards |

Each kit / chunk variant carries an `anchors` array: `{ kind, x, y, z, ry, w, h, rect }` in segment-local metres (every `sQuad` call of `11-3-kit.js` is one anchor: its arguments are exactly these fields). On recycle of a segment: free the instances it owned (swap-remove), then for each anchor of its new dressing take an instance, store `(seg, local matrix)`, write `aUv` (`rect` divided by the atlas size; for Bugle anchors the rectangle of the slot from `bugleDeck`). Every frame, for each live instance: world matrix = local matrix with `seg.group.position.z` added to the z translation; then one `instanceMatrix.needsUpdate` per mesh (at most 96 matrices). The curved world bends instances like everything else. `frustumCulled = false`, `count` = live instances.

Anchor counts (computed): Chinatown 2 tabela per segment; Neon 4 per segment (in three segments: 4 Bugle + 8 ads); Midtown about one Bugle per three segments (the chunks that have a roof billboard); portals 1 each, the arch 2.

## 5 The record moment inside a run

`newRecord` fires only on the game-over screen. For the city, the city system checks `recordPassed(prevScore, score, best)` every frame and, once per run, emits `recordPass { score }`. From that frame `bugleDeck` puts BROKEN first; the celebration (fireworks at night, ticker tape by day) is in `11-3-canli-ayrintilar.md` §5. Music may hook the same event later (not in this stage).

## 6 The catalogue (38 headlines; {N} = name, {X} = multiplier)

| Group | Kicker | Headline | Sub line |
|---|---|---|---|
| generic | SON DAKİKA | {N} YİNE KAÇTI! | Venom eli boş döndü · Sayfa 3 |
| generic | TEHLİKE | VENOM AÇ KALDI | Uzmanlar: "Koşun" diyor |
| generic | BAŞYAZI | ÖRÜMCEK: TEHDİT Mİ, TEHLİKE Mİ? | Jameson: "İkisi de!" |
| generic | ÖZEL HABER | RAYLARDA KOŞAN ADAM KİM? | Biletsiz yolculuk skandalı büyüyor |
| generic | SKANDAL | {N} BİLET ALMADI! | Metro idaresi şokta |
| generic | EKONOMİ | ALTINLAR NEREYE GİDİYOR? | Bugle soruyor, {N} susuyor |
| generic | TRAFİK | MASKELİ KOŞUCU TRAFİĞİ FELÇ ETTİ | Makinist: "Yine mi o?" |
| generic | JAMESON | FOTOĞRAF İSTİYORUM! | Genel yayın yönetmeni masaya vurdu |
| generic | RÖPORTAJ | VENOM: "ÇOK HIZLI" | Simbiyot ilk kez konuştu |
| generic | ANKET | {N} NE ZAMAN DURACAK? | Şehrin yüzde 97'si: "Durmasın" |
| chase | CANLI | REKORA 5.000 KALDI | Jameson tırnak yiyor |
| chase | CANLI | REKORA 1.000 KALDI! | Jameson kahvesini döktü |
| chase | BASKI DURDU | REKOR BİR ADIM ÖTEDE!! | Manşet hazır, mürekkep bekliyor |
| broken | ÖZEL BASKI | REKOR PARAMPARÇA! | {N} tarihe ağ attı |
| broken | ÖZEL BASKI | ESKİ REKOR ÇÖPE GİTTİ | Yenisi hâlâ yazılıyor |
| first | YENİ YÜZ | KİM BU ÇAYLAK: {N}? | İlk koşu, ilk sayfa |
| stumble | REZALET | SENDELEDİ! FOTOĞRAFI BİZDE | Görgü tanığı: "Güldüm" |
| stumble | REZALET | {N} TÖKEZLEDİ, VENOM GÜLDÜ | Simbiyot keyifli |
| stumble | SİGORTA | AYAĞI TAKILDI: SİGORTA ÖDEMİYOR | Poliçede "ray" yazmıyor |
| mult | EKONOMİ | x{X} ÇARPAN: EKONOMİ SARSILDI | Altın fiyatları {N}'e bağlı |
| mult | EKONOMİ | x{X}! MERKEZ BANKASI TOPLANDI | Faiz kararı: "Koşsun" |
| night | GECE BASKISI | {N} GECEYİ GÖRDÜ! | Şehir uyuyor, o koşuyor |
| night | GECE BASKISI | GECE YARISI KOŞUCUSU: {N} | Komşular: "Ses yapmıyor" |
| night | GECE BASKISI | UYKU YOK, ALTIN ÇOK | Yastık üreticileri tedirgin |
| loop | SABAH BASKISI | {N} SABAHI ETTİ | Annesi merakta |
| loop | 2. GÜN | İKİNCİ GÜN: HÂLÂ KOŞUYOR | Bugle muhabiri yoruldu |
| loop | SABAH BASKISI | EVE GİTMEYEN KAHRAMAN | Venom da gitmiyor |
| skin `spider` (and unknown ids) | MAHALLE | DOST CANLISI MI? HİÇ SANMIYORUZ | Mahalleli ikiye bölündü |
| skin `kitty` | MODA | PEMBE TEHLİKE RAYLARDA! | Fiyonklu şüpheli aranıyor |
| skin `gwen` | MAGAZİN | BEYAZ KAPÜŞONLU KİM? | Bale mi, kaçış mı? |
| skin `miles` | ŞOK | İKİ ÖRÜMCEK Mİ VAR?! | Jameson: "Biri bile fazlaydı" |
| skin `raimi` | NOSTALJİ | 2002'DEN GELEN ADAM | Eski usul ağ, yeni usul kaçış |
| skin `mcu` | İŞ DÜNYASI | STAJYER İŞE GEÇ KALDI | Bay Stark yorum yapmadı |
| skin `ironman` | CEMİYET | MİLYARDER TRENE BİNDİ | Limuzin bozuldu mu? |
| skin `panther` | DIŞ HABERLER | KRAL RAYLARDA | Wakanda'dan resmî ziyaret |
| skin `batman` | YANLIŞ ADRES | YANLIŞ ŞEHİR, YARASA! | Gotham treni çoktan kaçtı |
| skin `cap` | ULAŞIM | KAPTAN, KALKAN BİLET DEĞİL | Kondüktör kararlı |
| skin `hulk` | BELEDİYE | RAYLAR DAYANIR MI? | Endişe büyük: 5 ton yeşil |

The eleven skin keys are **verified** against the skin cards of `index.html` (`data-skin` = `spider kitty gwen miles raimi mcu ironman panther batman cap hulk`, lines 177-187). An unknown id falls back to `spider`, so a future skin breaks nothing.

Naming: the module is `src/bugle-logic.js`; do not confuse it with the power-up `src/powerups/bugle.js` (and its `bugle` event / `state.bugleTime`), which it never touches.

## 7 Asserts for `tools/test-skills.mjs` (import `src/bugle-logic.js`; its own self-check already throws on import)

1. `buildSlots` returns 16 entries for a first-run player (`best 0`) and no entry contains `{`.
2. Deck order: calm run starts with SKIN; `left ≤ 5000` puts CHASE5K first only when `best ≥ 10000`; `left ≤ 100` puts CHASE100 first; `score > best` puts BROKEN first; `best = 0` never yields BROKEN or a CHASE slot.
3. STUMBLE is in the deck at `d − stumbleD = 600` and not at 601.
4. `recordPassed` is true for exactly one frame of a rising score and never when `best = 0`.
5. Board pools: after 400 simulated recycles across a full loop the live counts never exceed the capacities 32 / 40 / 24 and return to the same value at the same loop position (no leak).
