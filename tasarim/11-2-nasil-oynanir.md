# 11.2 — Four-page pocket comic

## Behaviour and frame

Reuse `#scr-help/#b-help-ok`; no mandatory onPlay redirect. Four `.comic-page` elements built once; only selected page exposed, others hidden/inert. Start page1 on every menu open; close with top-right44×44 `Kapat` returns to original menu (not automatic run). Last action **ANLADIM!** sets existing `spidey.helpSeen='1'`, returns menu. Skipping via close does not set it. Do not clear seen hints or gift flags. A future pause entry returns pause without resuming; do not add that entry in this stage. Swiping >40px horizontally and >1.4×vertical delta changes exactly one page on pointerup; clamp0..3, reset pointer on cancel/second finger. `touch-action:pan-y`, no listener on game canvas. Tap **İLERİ →**, **← GERİ** or any of four44px dot buttons; arrow keys when focus is inside help. Dots have `aria-label="{n}. sayfa"` and aria-current=page. Focus current page heading after explicit navigation, no keyboard trap. Screen reader reads heading then panels in reading order. Enter transition160ms translateX(12→0)/opacity ease-out; reduce motion100ms fade. No auto-advance.

Frame portrait `height:100dvh`, padding12 safe, max-width424; rows44 `minmax(0,1fr)` 44 44, gap8. Header text `CEP ÇİZGİ ROMANI` 24 Bangers + close44. Page title28/30, kicker13/16 Baloo. Page paper cream border3 shadow4 radius4 padding10; internal grid gap8, gutters ink-visible; each panel border3 ink radius3 and background white/blue/yellow. Body16/19 Baloo, headings22/24 Bangers, speech bubble15/18 Baloo bold, border2, radius16, triangular tail from CSS. Illustrative motion lines3px, halftone pattern9px, proper white gutters8px. Page1 panel grid2×2 plus note; page2 grid2×2 plus collection note; page3 two stacked panels; page4 two stacked panels. Panel fixtures use existing `#i-arrow/#i-web/#i-spider/#i-camera` and existing power canvas icons; drawn mini lanes/coins/rings in CSS. No screenshots or new image assets. Largest heading `THWIP!`32 tilted; no body paragraph longer than two lines. Explanatory examples are illustrative, never live save values.

At360×740: inner716 minus header44, footer44, navigation44 and gaps24 leaves560 page height. Page chrome padding20 border6 +title30+kicker16+gaps16 leaves472 for panels (minimum body fits computed). At490×805:625 page. At740×360: layout max-widthnone; columns148 minmax(0,1fr), header spans both; page row2, header44 and gap8 leave284; left rail dots and action buttons stacked; page panels side-by-side in a four-column grid (page1/2), two columns(page3/4). Landscape help body14/17, title24/26. Optional TUŞLAR/SARFLAR details move to a cream card in the left rail, bottom112px/left12px/width148px (max-height180, pan-y when expanded), so the four panels keep their full reading height. Page min-height260; if enlarged text/safe-area leaves less room, allow page scroll only, never clip content or reduce text below14.

## Page 1 — controls (read in ten seconds)

Title `1 · RAYLAR SENİN!`; kicker `Parmağın kahramanın direksiyonu.`

| Panel | Drawing | Exact text |
|---|---|---|
| 1 | three lanes, token moves sideways, two arrow symbols | `ŞERİT DEĞİŞTİR` / `Sağa sola kaydır.` / bubble `Yol açın!` |
| 2 | low block, hero arc, up-arrow, two speed lines | `HOP!` / `Yukarı kaydır, zıpla.` |
| 3 | high bar, ducked hero, down-arrow | `VIZZT!` / `Aşağı kaydır, altından kay.` |
| 4 | web to roof, up arrow repeated, one slot | `THWIP!` / `Havada yine yukarı: ağ at.` / bubble `Bir şarj gider!` |

Footnote `Kahraman gücü ağı değiştirir. Duraklat: sağ üstte II.` Desktop disclosure **TUŞLAR** (details, not expanded by default): `Şerit: ← → / A D · Zıpla: ↑ / W · Kay: ↓ / S · Güç: E / Q / F · Çift dokun: Space · Flaş: C · Duraklat: P / Esc`. Preserve all five original controls across pages1/4, including honest double-tap note below.

## Page 2 — powers

Title `2 · YOLDAN KAP!`; kicker `Dokunmana gerek yok; üstünden geç.`

| Panel | Exact text / icons |
|---|---|
| yellow coin spiral | `MIKNATIS` / `Altınlar sana koşar.`; `MANŞET` / `Mesafe puanı ×2.`; magnet + bugle icons |
| blue springboard | `HİS + YAY` / `Otomatik kaçış. Daha yüksek zıplayış.`; sense + spring |
| pink airy arc | `SALIN + DUVARA ÇIK` / `Salınış ve duvar koşusu yol açar.`; swing + wall |
| cream decoy trail | `KUKLA + İZ` / `Kukla bir hatayı yer. İzi takip et, çarpanı büyüt.`; decoy + tracer |

Footnote, two small icon labels: `Kartuş: şarjı doldurur. Çekirdek: zırhı açar.` Bottom speech bubble `Halka bitince güç biter!` These are all eight timed pickups plus both charge/core pickups. Flash/jet live in market, not ground pickups: small optional details **KOŞU BAŞI SARFLARI** text `Marketin flaşı çarpanı artırır, jeti ileri uçurur. Düğmeleri ilk 7 saniyede kullan.` Keep this collapsed so page remains a ten-second read.

## Page 3 — missions and multiplier

Title `3 · ÜÇ ROZET, DAHA ÇOK PUAN!`; kicker `Görevler koşudan koşuya devam eder.`

Panel1 three badges: `20 altın topla` with `12/20`, `5 kez zıpla` with `5/5 ✓`, `3 kez kay` with `1/3`; banner `ÜÇÜNÜ BİTİR → KALICI ÇARPAN +1`. Bubble `Yeni sette yeni hedefler!` Use examples only, not a redefinition of mission goals.

Panel2 oversized cream multiplier `×2` and formula `100 m → 200 puan`; below `Çarpan mesafe puanını büyütür.` and coin icon `Altın puanı ayrıca eklenir.` Paper corner note `Manşet ×2'si geçicidir. Set çarpanı kalır.` No claim that coins multiply; no claim that any HUD x2 necessarily means Bugle. 11.5 event extra tag is taught by first event reward in-run; don't cram future rewards into this help panel.

## Page 4 — your hero button

Title `4 · GÜCÜNÜ GÖSTER!`; kicker `Karakterini seç, düğmesine dokun.`

Panel1 ready pill and gift sticker: `İLK KOŞUNA HEDİYE!` / `Özel gücü olan her kahramana 1 şarj.`; bubble `Doluysa dokun, sahne senin!` Show selected hero icon statically Miles fixture; costumes show same generic explanation, not a fake gift promise to Spider-Man.

Panel2 empty pill + cartridge trail: `ŞARJ YOK MU?` / `Yoldan kartuş al. Ya da marketten 75 altına şarj kap.` / bubble `Aktifken halka süreyi gösterir.`

Footnotes `Klasik kostümlerde düğme ağ atar.` and `Çift dokun: dolu kahraman gücü; yoksa zırh.` Final red action `ANLADIM!`. Top close still works; no trapped tutorial.

## Assertions / phone acceptance

Logic only in test-skills: page index clamp0..3, 40px threshold/axis ratio, one gesture one step, cancel resets, close preserves return state, only final action writes helpSeen. UI inspection: all page copy visible without scrolling at360×740, speech tails stay in panels, page2 not a dense list, landscape four controls read left-to-right, dots44 and close44, Turkish font glyphs and keyboard focus visible. CSS placeholder drawings and content in prototype are the liftable panel structure; production replaces icon placeholders with existing icon canvases once at UI init.
