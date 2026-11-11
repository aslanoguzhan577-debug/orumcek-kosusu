# 11.2 — Four-page pocket comic

## Behaviour and frame

Reuse `#scr-help/#b-help-ok`; no mandatory onPlay redirect. Four `.comic-page` elements built once; only selected page exposed, others hidden/inert. Start page1 on every menu open; close with top-right44×44 `Kapat` returns to original menu (not automatic run). Last action **ANLADIM!** sets existing `spidey.helpSeen='1'`, returns menu. Skipping via close does not set it. Do not clear seen hints or gift flags. A future pause entry returns pause without resuming; do not add that entry in this stage. Swiping >40px horizontally and >1.4×vertical delta changes exactly one page on pointerup; clamp0..3, reset pointer on cancel/second finger. `touch-action:pan-y`, no listener on game canvas. Tap **İLERİ →**, **← GERİ** or any of four44px dot buttons; arrow keys when focus is inside help. Dots have `aria-label="{n}. sayfa"` and aria-current=page. Focus current page heading after explicit navigation, no keyboard trap. Screen reader reads heading then panels in reading order. Enter transition160ms translateX(12→0)/opacity ease-out; reduce motion100ms fade. No auto-advance.

Frame portrait `height:100dvh`, padding12 safe, max-width424; rows44 `minmax(0,1fr)` 44 44, gap8. Header text `CEP ÇİZGİ ROMANI` 24 Bangers + close44. Page title28/30, kicker13/16 Baloo. Page paper cream border3 shadow4 radius4 padding10; internal grid gap8, gutters ink-visible; each panel border3 ink radius3 and background white/blue/yellow. Body16/19 Baloo, headings22/24 Bangers, speech bubble15/18 Baloo bold, border2, radius16, triangular tail from CSS. Illustrative motion lines3px, halftone pattern9px, proper white gutters8px. Page1 panel grid2×2 plus note; page2 grid2×2 plus collection note; page3 two stacked panels; page4 two stacked panels. Panel fixtures use existing `#i-arrow/#i-web/#i-spider/#i-camera` and existing power canvas icons; drawn mini lanes/coins/rings in CSS. No screenshots or new image assets. Motion28 on compact screens; big multiplier32 tilted; no body paragraph longer than four compact lines. Explanatory examples are illustrative, never live save values.

### Corrected fit sums (review finding1)

Border-box, safe insets0. At360×740 page =740−24−44−44−44−24=**560**, inner534. Page1/2 fixed title30 + kicker16 + note32 + disclosure44 + four gaps8 =154, leaving**380**, not472. Two rows(380−8)/2=186; border6 + padding top8/bottom14 leaves **158** for actual content (sixpx tail allowance included). At <=400 use motion28, icons24, heading19/20. Panel1:28 + two-line heading40 + body38 + bubble32 + three gaps5 =**153<=158**. Panel4:28+20+38+32+15=**133<=158**. Page2's worst panel fits <=154 (body at most4×19). Do not vertically center clipped overflow: panel overflow is visible, page can scroll as an accessibility fallback.

At490×805: page625/inner599; same154 gives445 panels, rows218.5, content190.5. The maximum across page1 panels is153. Wider panel body173px makes heading 'ŞERİT DEĞİŞTİR'169.4 fit one line:44+24+19+32+15=134<=190.5; panel4 <=153. Page3 title can wrap to60 at360:534−60−16−16−24=418, rows205/content177. Big multiplier is32/.9=28.8, not64; maximum panel156. Page4:534−30−16−32−24=432, rows212/content184; maximum panel145.5. At490 page3 content209.5 (largest142.8), page4 content216.5 (largest165.5); no glyph is reduced below12.

At740×360: usable716×336; header44+gap8 =>page284. Navigation rail**112**, gap8, paper596, inner570×258. Four panels widths(570−18)/4=138, inner122. Actual three in-flow gaps total15 (details is positioned out of flow):26+14+28+15=83, leaving175; panel content175−border6−padding16=**153**. Page1 panel1:28+40+17+31+9=125<=153; panel4:28+20+34+31+9=122. Whole-page1 maximum139<=153; page2 maximum125<=153. Page3/4 two columns:282/inner266, panels >=189/content167; with32px multiplier and page4 motion24/sticker22, page3 maximum142<=167, page4 maximum126<=153 (two-line note reduces its available height). Details are a left-rail popover, scrollable when expanded. At320/280 use **one column**, natural-height panels >=160 and page-only vertical scrolling. All four pages remain accessible; no promise of zero scroll at these narrow widths or text enlargement. Header can wrap at280 without clipping its44px close button.

These are computed estimates, not observed font geometry. The checker estimates word wrapping for every panel, including speech bubbles and tails. Production replaces finished SVG stand-ins with the code-drawn game symbols; prototype labels this once on page1 in12px text. Actions keep the game's .btn style. Labels and bubble text stay >=12; navigation/close stay >=44.

## Page 1 — controls (read in ten seconds)

Title `1 · RAYLAR SENİN!`; kicker `Parmağın kahramanın direksiyonu.`

| Panel | Drawing | Exact text |
|---|---|---|
| 1 | three lanes, token moves sideways, two arrow symbols | `ŞERİT DEĞİŞTİR` / `Sağa sola kaydır.` / bubble `Yol açın!` |
| 2 | low block, hero arc, up-arrow, two speed lines | `HOP!` / `Yukarı kaydır, zıpla.` |
| 3 | high bar, ducked hero, down-arrow | `VIZZT!` / `Aşağı kaydır, altından kay.` |
| 4 | web to roof, up arrow repeated, one slot | `THWIP!` / `Havada yine yukarı: ağ at.` / bubble `Bir şarj gider!` |

Footnote `Güç ağı değiştirir. Duraklat: II.` plus12px `Kod simgeleri yerine temsili çizim.` Desktop disclosure **TUŞLAR** (details, not expanded by default): `Şerit: ← → / A D · Zıpla: ↑ / W · Kay: ↓ / S · Güç: E / Q / F · Çift dokun: Space · Flaş: C · Duraklat: P / Esc`. Preserve all five original controls across pages1/4, including honest double-tap note below.

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

Logic only in test-skills: page index clamp0..3, 40px threshold/axis ratio, one gesture one step, cancel resets, close preserves return state, only final action writes helpSeen. UI inspection: all page copy visible without scrolling at360×740, speech tails stay in panels, page2 not a dense list, landscape four controls read left-to-right, dots44 and close44, Turkish font glyphs and keyboard focus visible. Finished CSS/SVG stand-in drawings and content in prototype are the liftable panel structure; production replaces stand-in icons with existing icon canvases once at UI init.
