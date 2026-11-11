# 11.2 — Shared comic narrator

## Shell and lifecycle

Create once inside `#hud`: `#h-caption.caption[hidden]`, `.caption-tab`, `.caption-icon[aria-hidden=true]`, `.caption-copy` with a heading and one sentence. `ev-caption` becomes an alias on this shell, never a second element. Copy via textContent. Icon is the existing 96×96 pickup canvas rendered at 30×30; hero uses its existing UI SVG/emoji; actions use existing `#i-arrow/#i-web/#i-camera`. No image URLs. Caption: paper `#ffe9a3`, ink 3 px, shadow 3px 3px, rotate(-1deg); red tab `İLK KEZ!`, 12/14 px Bangers, padding0 5, right8/top-14, 2 px ink, rotate(4deg). Ordinary repeats use tab `ANLATICI`; district visits use `YENİ BÖLGE!`; refill uses `ŞARJ LAZIM!` after its first display.

Portrait shell left/right 16, top `safeTop + 134`, height 54, padding 5px 8px; grid `30px minmax(0,1fr)` gap 7; inline heading19/19 px, sentence17/19 px Bangers, letter-spacing .15px. At width >=440 max-width 424 centered; sentence18/19. No ellipsis or line clamp. Heading and sentence share the same inline flow; the combined copy occupies at most two19px lines; catalogue below uses `/` as the breath between heading/sentence, rendered as a space (never a forced third line or literal slash). Landscape shell left180/right64/top `safeTop + 44`, height52; icon 24, heading/body inline 18/19, padding 4px 7px; copy wraps at word boundaries into at most two lines. The longest safety line is split in the catalogue for the phone check. Full CSS: prototype `.caption` plus HUD breakpoint. Do not add new bottom toasts.

Entry 220 ms: translateY(-8px) scale(.92) rotate(-1deg) → scale(1.035) at 70% → scale(1), easing cubic-bezier(.2,1.4,.4,1). Hold **2500 ms**, exit 160 ms translateX(-14px)/opacity 0 ease-in; gap 120 ms. Total slot 3000 ms. Run clock advances only in visible, running, non-intro, non-halted mode. Pause/hidden freezes shell and elapsed time. `gameover/menu/start` clears pending transient items, hides current, resets run counters; do not mark an interrupted item seen. Gift item is registered on start and deferred until intro ends. Deferred first-time item can qualify again next run if not seen. Cap ordinary first-time hints at 4 per run; safety and explicit empty taps exempt. This is a reading budget, not a mechanics lock.

## Queue / persistence: exact rules

Reuse `spidey.seen`: JSON object `{id:1}`. Accept only own string keys in this catalogue with value exactly 1; ignore unknown keys for lookup but preserve them on save (11.3/11.5 compatibility). Reject null, array, primitives or invalid JSON as `{}`. Guard reads/writes; keep in-memory seen if writes fail. Never clear another key. Store only after **1000 ms of uninterrupted visible hold** (entry does not count); interruption resets that hold eligibility. Gift-claimed storage is separate from hint-seen storage.

`enqueue({id,text,icon,priority,context})`: ignore already seen first-time IDs and IDs active/pending. One shell, FIFO within priority. Priorities: safety 0, explicit refill 1, gift 2, power/control 3, mission 4, district 5. Maximum 8 pending (active excluded); when full discard newest among worst priority, never lose a safety item to flavour. Do not mark discarded IDs. Controls caused by a special launch (`jump` from Raimi) must not count as a control discovery: qualify only when no special is active and !detail.quiet. Never narrate intro `web`/quiet VFX events.

Safety `rowWarn/eventStart` preempts: hide current immediately, requeue it if its context still holds; show safety immediately without entry scaling. RowWarn expires when the same row passes/arrival deadline 2400 ms after trigger; never replay it late. If two safety warnings collide, newest live hazard wins; do not replay the earlier hazard. First-safety captions can be replaced after 1000 ms hold and still count seen. World warnings always render, even if caption was seen. Event warning title bypasses queue into reserved HUD slot (layout document); its explanatory first caption still uses this queue. Explicit empty tap cancels a queued refill duplicate, shakes immediately, then queues at priority 1; repeatable, at most once per 6000 ms; no permanent suppression after first lesson. Later mission completions and set banners use same queue with `ANLATICI` and collapse simultaneous missionDone into `GÖREV TAMAM! / Üç rozete doğru bir adım daha.`; if missionSet arrives same frame, show only set message and leave first-mission ID eligible next time. Later event reward text: `KUSURSUZ! +{coins} ALTIN / Çarpana +{mult}, 12 saniye!` or `ATLATTIN! +{coins} ALTIN / Çarpana +{mult}, 12 saniye!`, no first-time ID, never for aborted eventEnd. Flash repeat: `ÇEK BAKALIM! / Bu koşunun çarpanına +{bonus}!`.

Context expiry: power item only while its corresponding timer >0 (cartridge/core 12 s after pickup); active skill only while same special remains active; action 8 s after trigger; mission/reward 12 s; district only while still in that district; gift remains current run. Drop invalid item before selecting next. First skill messages for short 2.2 s Iron Man may therefore be clipped; show on activation immediately after any safety item, before ordinary power items (special activation uses priority 2). Never explain an effect as active after it ended.

## Complete catalogue

`/` = intended breath/line break. All IDs below use `spidey.seen[id] = 1` unless marked repeat. **Existing** means verified event; **adapter** means a UI transition/predicate, not an invented event. **Future** is an integration contract, never proof that its emitter is wired. During this design pass concurrent11.5 work added `rowWarn/rowPass` emitters (`obstacles.js:342–351`) and event state fields (`game.js:33–35`); these were narrowly re-read at final check. Event director wiring is not claimed.

| ID | Icon | Exact trigger and qualifier | Player copy |
|---|---|---|---|
| `control.lane` | ↔ arrow | existing `intro` detail.phase==='end'; if no intro: first HUD visible after existing `start` | `YOL SENİN! / Sağa sola kaydır, şerit değiştir.` |
| `control.jump` | ↑ arrow | existing `jump`, first normal successful jump | `HOP! / Yukarı kaydır, engeli aş.` |
| `control.slide` | ↓ arrow | existing `slide`, first normal slide | `VIZZT! / Aşağı kaydır, altından kay.` |
| `control.web` | web | existing `web`, !quiet, !intro, costume skin, zipping | `THWIP! / Havada yine yukarı: bir şarjla ağ at!` |
| `control.double` | spider | adapter after successful `#h-iron` activation or canvas double resolved to Iron Spider; existing `ironOn`, !quiet, not special-active | `ÇİFT DOKUN! / Çekirdeğin varsa zırhı çağır.` |
| `control.pause` | Ⅱ | existing `resume`, following first user `pause`; defer until HUD returns | `BİR NEFES! / Sağ üstteki II ile duraklat.` |
| `pickup.web` | web | existing `pickup`, type==='web' | `KARTUŞ! / Ağ ve kahraman şarjların doldu.` |
| `pickup.iron` | ironSpider | existing `pickup`, type==='iron' (registered kind; not ironSpider) | `ZIRH ÇEKİRDEĞİ! / Zırh düğmesine dokun, korun.` |
| `power.sense` | sense | existing `senseOn` | `ÖRÜMCEK HİSSİ! / Tehlikeden otomatik sıyrılırsın.` |
| `power.magnet` | magnet | existing `magnetOn` | `MIKNATIS! / Altınlar artık sana koşuyor.` |
| `power.bugle` | bugle | existing `bugleOn` | `MANŞET OLDUN! / Mesafeden gelen puan iki kat!` |
| `power.spring` | spring | existing `springOn` | `YAY GİBİ! / Şimdi daha yükseğe zıplarsın.` |
| `power.swing` | swing | existing `swingOn` | `AĞ SALINIŞI! / Havada süzül, altınları kap.` |
| `power.decoy` | decoy | existing `decoyOn` | `KUKLA SAHNEDE! / Bir hatayı senin yerine yer.` |
| `power.wall` | wall | existing `wallOn` | `DUVAR KOŞUSU! / Raylar doluysa duvarlar bizim.` |
| `power.tracer` | tracer | existing `tracerOn` | `İZİ TAKİP ET! / Doğru şeritte çarpanın büyür.` |
| `power.iron` | ironSpider | existing `ironOn`, !quiet, st.ironTime>0 | `DEMİR GİBİ! / Zırhın darbelere karşı yanında.` |
| `power.flash` | camera | adapter first game.flash.available false→true after intro; not flashBoost | `FLAŞ FIRSATI! / İlk 7 sn: dokun, çarpanı artır.` |
| `power.jet` | ironSpider | adapter first game.repulsor.available false→true after intro | `JET TAKSİ! / İlk 7 saniyede dokun, ileri uç.` |
| `special.hulk` | 👊 | existing `specialOn`, mode==='hulk' | `SMASH! / Hulk engelleri paramparça eder.` |
| `special.cap` | 🛡️ | existing `specialOn`, mode==='cap' | `KALKAN SÖRFÜ! / Kalkanla kay, engellere dikkat!` |
| `special.miles` | ⚡ | existing `specialOn`, mode==='miles' | `VENOM PATLAMASI! / Miles elektrikle yolu açar.` |
| `special.kitty` | existing heart SVG | existing `specialOn`, mode==='kitty' | `UÇAN KALP! / Kitty kalbiyle havaya yükselir.` |
| `special.batman` | existing bat SVG | existing `specialOn`, mode==='batman' | `GECE PELERİNİ! / Batman süzülür, yolu açar.` |
| `special.raimi` | existing slingshot SVG | existing `specialOn`, mode==='raimi' | `MANCINIK AĞ! / Ağı ger, ileri fırla!` |
| `special.ironman` | existing unibeam SVG | existing `specialOn`, mode==='ironman' | `TEK IŞIN! / Iron Man ışınla yolu temizler.` |
| `special.panther` | existing vibranium SVG | existing `specialOn`, mode==='panther' | `VİBRANYUM ŞOKU! / Biriken enerjiyle yolu aç.` |
| `charge.empty` | web or selected hero | adapter `#h-web` tap, pill state empty, >=6000ms since prior refill | `ŞARJ YOK! / Yoldan kartuş kap; markette 75 altın.` |
| `gift.{skin}` (8 IDs) | selected hero | adapter confirmed gift grant at existing `start`; show after intro end | `HEDİYE ŞARJ! / İlk koşuna bizden. Güç düğmesine dokun!` |
| `mission.first` | ✔ | existing `missionDone` | `BİR ROZET CEPTE! / Üç görevi bitir, çarpanın büyüsün.` |
| `mission.set` | × | existing `missionSet`, detail.multiplier | `SET TAMAM! / Kalıcı çarpanın artık ×{multiplier}!` |
| `mult.first2` | bugle ×2 | adapter existing `bugleOn` first game.mult.factor 1→2; if power.bugle not seen, show power.bugle text once and mark both IDs after hold | `İKİ KAT! / Bu güç sürerken mesafe puanı ×2.` |
| `gap` | ↑ | **existing emitter; integration pending** `rowWarn`, type==='gap' | `RAYLAR KOPMUŞ! / Yukarı kaydır, yarıktan atla!` |
| `gate` | ↓ | **existing emitter; integration pending** `rowWarn`, type==='gate' | `SİNYAL KAPISI İNİYOR! / Aşağı kaydır, altından kay!` |
| `girder` | ↔ | **existing emitter; integration pending** `rowWarn`, type==='girder', retain detail.open | `VİNÇ KİRİŞİ! / Yeşil okların şeridine geç!` |
| `venom` | spider | **future** `eventStart`, kind==='venom' | `VENOM HAMLESİ! / Kırmızı şeritten hemen çık!` |
| `goblin` | bomb DOM circle | **future, gated today** `eventStart`, kind==='goblin'; fallback: frame adapter sees eventKind enter goblin with eventTime>0 (same dedup) | `YEŞİL CİN! / Bombalı şeritten uzak dur!` |
| `district.midtown` | city DOM blocks | **disabled — arrives with stage 11.3** `districtEnter {id:'midtown',lap}`; first menu-to-run district query after intro | `MIDTOWN! / Mahalle bizim, koşu senin.` |
| `district.chinatown` | lantern DOM | **disabled — arrives with stage 11.3** `districtEnter {id:'chinatown',lap}` | `CHINATOWN! / Fenerler yandı, sen parılda.` |
| `district.bridge` | web | **disabled — arrives with stage 11.3** `districtEnter {id:'bridge',lap}` | `KÖPRÜDEYİZ! / Manzara şahane, gözün raylarda.` |
| `district.tunnel` | signal DOM | **disabled — arrives with stage 11.3** `districtEnter {id:'tunnel',lap}` | `METRO TÜNELİ! / Işıklar az, refleksler tam gaz.` |
| `district.neon` | ⚡ | **disabled — arrives with stage 11.3** `districtEnter {id:'neon',lap}` | `NEON MEYDAN! / Şehrin yıldızı sensin.` |

The two stock-window hints are 7-second opportunities: expire when available=false; priority 2 before ordinary pickup hints. If both are present show one combined caption `KOŞU BAŞI FIRSATI! / Flaş çarpanı artırır; jet ileri uçurur.` and mark both IDs after hold. Availability is evaluated after gift; do not enqueue 3 competing welcomes on the same frame. Gift first, opportunities second, lane hint third; lane hint can remain eligible for the next run.

Districts: **districtEnter does not exist today. All five rows stay disabled and unbound until stage11.3 supplies a real emitter/adapter.** Announce each first encounter once, not every lap. Stage11.3 adapter may map its actual event name to districtEnter; no invented listener now. These IDs and copy are owned here. No day/night caption until requested. Lane red strips/bomb rings are 3D 11.5 art below the HUD band; caption is supplementary and cannot replace their 0.78–1.3 s warning.

Landscape52−6−8=38 content equals two19px lines; at740 copy width445, worst gift470 wraps to two. Unrotated shell ends96+shadow3=99 <100. Portrait360/490 content38 also fits two lines. At320/280 use234px reserved band and92px caption, content76 (four19px lines); copy widths229/189 and all catalogue entries fit at most four estimated lines. See layout ledger; no browser measurement.

Goblin dependency: road-events.js:46 currently rejects kind !== venom before eventStart. Stage11.5 task13 must remove that gate. Until then fallback is the fallback adapter in the existing UI update loop (running, non-intro, eventKind changes to goblin and eventTime>0), never a fabricated event or hazard spawn. If neither event nor state transition exists, no hint fires and seen remains unset; synthetic prototype buttons prove appearance only.

## Assertions / accessibility

Pure scheduler inputs: `dt`, run visibility/mode, context snapshot; DOM only reflects output. Test corrupt/read-only storage, dedup active and pending, exactly one active, FIFO ties, queue cap 8, safety preemption/expiry, seen threshold at 999/1000 ms hold, pause, restart, coalescing Bugle and missionSet, no quiet-event teaching. No timer-based browser sleep tests. Full assertion list and file order in coding tasks. Caption pointer-events:none, never takes focus; help reproduces essential instructions for deliberate reading. Empty ability remains a real focusable button, with explanatory aria-label, not disabled.
