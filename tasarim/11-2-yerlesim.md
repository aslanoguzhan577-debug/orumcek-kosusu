# 11.2 — Phone-first layout contract

The exact DOM/CSS recipes live also in `proto/11-2-proto.css`. Prototype `.prototype` is a local isolation scope; translate it to production `#ui` and keep old IDs/handlers. Do not copy fixture-only `.toy/.scene/.road` as gameplay. All positions below use **layout viewport CSS pixels**, `100dvh`, border-box, no devicePixelRatio scaling. Safe insets add to outside padding; don't count browser chrome twice. Common rules:

```css
#ui { --st:env(safe-area-inset-top,0px); --sb:env(safe-area-inset-bottom,0px);
  --sl:env(safe-area-inset-left,0px); --sr:env(safe-area-inset-right,0px); }
#ui .fit-screen { height:100dvh; min-height:0; overflow:hidden;
  padding:calc(12px + var(--st)) max(12px,var(--sr)) calc(12px + var(--sb)) max(12px,var(--sl)); }
#ui .fit-screen > * { min-width:0; min-height:0; }
#ui button:focus-visible, #ui input:focus-visible { outline:3px solid var(--yellow); outline-offset:3px; }
```

Default portrait max-content width424. Breakpoint **min-width440** only increases paper widths/font where stated; never scales all UI by transform. Landscape rules only `(orientation:landscape) and (max-height:500px)`. At text zoom/keyboard/smaller than stated usable heights, allow the relevant sheet to scroll with overscroll-behavior:contain. Main action remains a44px button; do not hide name validation. Menu focus into input may use browser's scroll, and returns to fit after blur. No fullscreen promise when software keyboard is open.

## Main menu

`.menu-layout` grid rows `86px minmax(120px,1fr) 380px`, gap8; inner height H-24-safeTop-safeBottom. Logo Bangers44/40, cream top line/yellow second line, stroke3 ink and shadow4, rotate(-3deg), centered. Clear hero window is the flexible middle band, no overlay card or mission text. At360×740:716-86-16-380=**234px**; y106..340. At490×805:299px; same width424. Small hero caption `MAHALLE SENİ BEKLİYOR!` on a 12px sticker at band upper right, not across hero. Stage framing follows character document (use actual menu-band DOM rect; its earlier rough y/H formula is only a fallback).

Menu card380 includes borders6 + padding20 + internal gaps6×6=36 + rows `[52,18,56,44,44,44,44]`=302 + spare16 =380. Use explicit grid rows `52px 18px 56px 44px 44px 44px 44px`, row-gap6, padding10, align-content:center. Name label12/14 + input height36/font18, max12 chars existing validator; label `OYUNCU ADI`, placeholder `Adını yaz`. Best row14/18 `EN İYİ · {score}`. Play56 high Bangers32 red. Character/market two columns gap8,44 high Bangers20 (`KARAKTER`, `MARKET`). Help full44 Bangers20 blue `NASIL OYNANIR?`. Sound row two equal columns44, Bangers16; labels `MÜZİK: AÇIK/KAPALI`, `EFEKT: AÇIK/KAPALI`. Missions button44 navy fill, three small inline progress badges plus `GÖREVLER · {done}/3` label16. No nested buttons; whole mission strip opens a sheet. Keep `m-ms-title/list` inside the expanded sheet, not duplicated IDs.

Mission sheet: bottom inset12/safe, width min(100%-24,424), padding12 border3 radius18; title `GÖREVLER · SET {set} · ×{base}`, rows min64, text16/19 progress current/goal14, 4px bar. Bottom copy `Üçünü bitir, kalıcı çarpanın +1 olsun.` and44px `TAMAM`. aria-expanded on strip, focus title then close returns strip; Escape/backdrop closes without starting run. `m-ms-list` still reads missionText, not hard-coded sample goals. No new mission definitions or reset.

Landscape menu: `.menu-layout` columns `minmax(0,1fr) 360px`, rows `minmax(0,1fr)`, gap16. Logo is absolute top12 left12 widthcalc(100%-388px) height70 font36/34. Hero band is left column y86..H-24, min0. Card occupies right column height100%, compact grid columns1fr1fr: name spans2 h46, best spans2 h18, OYNA spans2 h48, character+market44, help+missions44, music+sfx44; gaps6 (5), padding10/border6 gives304px. At740×360 right height336, inner310, rows244+gaps30=274 =>36 spare centered. No vertical scrolling. At usable portrait height<650 reduce logo70 and hero min80; if still too short allow card pan-y; required740/805 unaffected.

## Market: two sticker tabs

Keep `#scr-market/#mk-coins/#mk-list/#b-market-close`; heading becomes **MARKET**, not `YETENEK GELİŞTİRME`. Frame max424 width, full usable height; rows44 32 44 minmax(0,1fr) 44, gap8, padding12 safe. Header `MARKET`36/38, subhead `Bir koşuluk numara mı, kalıcı güç mü?`14/18 can be in header tooltip/details (not another track); wallet32 `CÜZDAN · {n} altın`18. Tabs44 each50% width, Bangers22, border3 ink, rotate(-2deg)/(2deg), shadow3; selected yellow and ink underline4; role=tablist `Market bölümleri`, tab IDs `mk-tab-sarf/mk-tab-upgrade`, aria-selected, controls; ArrowLeft/Right switches focus+tab. Always open on **SARF**; tab change resets panel scroll to0; purchases repaint preserve selected tab/focus/scroll. Return from pause/over respects existing marketReturn. No changes to cost formula or inventory cap.

Panel `.mk-list` min-height0 overflow-y:auto, background cream, border3, padding8; gap8 flex-column. Consumable row height**88**, upgrade row height**96** including border2/padding8; grid columns **36px minmax(0,1fr) 76px**, gap8; icon32, text column min-width0, name Bangers18/19 max2 lines, body Baloo13/16; price button76×44 Bangers20, coin symbol16. `overflow-wrap:normal;word-break:normal;hyphens:none`, no letter columns. At360 frame336: panel width336, content314 after borders6/padding16; row inner294 after border4/pad16; columns36+166? **Exact:** row width314, inner294; columns36 + (294-36-76-16=166) +76; all fit. At490 panel424 gives254px text. Name display strings below chosen to fit166px in two lines; no shrinking font below18. Consumables88px; upgrades96px to retain a two-line name plus exact level and duration. panel enough for4 consumables at360: usable716 -(44+32+44+44+32 gaps)=520; four88+three8+panel22=398 <=520. Upgrade content10×96+9×8+22=1054; panel520, **534px scroll**. Landscape full width max640: header/wallet share top44, tabs44 +close44 same bottom? Use rows44 44 minmax(0,1fr)44 gaps8, so list180 at740×360, about one full and next row; row width improves, scrolling deliberate. Keep close outside list. Do not compress ten upgrades to unreadable cards.

| Sarf key / price / cap | Name | Detail |
|---|---|---|
| ironCore /100/5 | `Zırh Çekirdeği` | `{n}/5 · Zırh için 1 kullanım` |
| heroCharge /75/skin cap | `Kahraman Şarjı` or costume `Ağ Şarjı` | `{n}/{cap} · Bir sonraki koşuya` |
| jetStart /400/3 | `Jet Başlangıcı` | `{n}/3 · İlk 7 sn'de kullan` |
| flashBooster /300/9 | `Flaş Fotoğraf` | `{n}/9 · İlk 7 sn'de kullan` |

Show carried bank stock separately if > selected capacity: `Stok: {bank} · Bu koşuya en çok {cap}`. It stays banked under gift rule. Upgrade names in existing config order: `Mıknatıs`, `Örümcek Hissi`, `Iron Spider Zırhı`, `Kahraman Gücü`, `Bugle Manşeti`, `Örümcek Yayı`, `Ağ Salınışı`, `Ağ Kuklası`, `Duvar Koşusu`, `Örümcek İzi`. Alias names are presentation only. Level row `Sv. {n}/{max}` plus **five pips**, pip i filled if level/max >=(i+1)/5; preserve exact level number (pips aren't five total purchasable levels). Duration line `{now} → {next} sn`, hero `+{bonus} → +{nextBonus} sn`. Turkish decimal comma, at most2 decimals. Max copy `EN ÜST`, price state `DOLU` for capped consumables. Insufficient funds button disabled + inline `Altın yetmiyor`13; max disabled + `Tamamı sende!`; success updates wallet/count/duration synchronously, small200ms pip pop, live status `Alındı!` with item name; purchase failures re-read wallet and `Şimdi alınamadı. Tekrar dene.` No extra confirmation for75 coins. No sale price invented. No assertion that all hero duration upgrades work until task1 fixes them.

## HUD: stable sky band, eight tokens, separate event warning

Portrait opaque sky band `.hud-band` top0 height**196px + safeTop**; gradient sky to #bde8ff, halftone dots at opacity .12. Never grows/shrinks based on activity, so the camera doesn't jump on pickup. Game render viewport begins y=196+safeTop and extends to H (including bottom safe inset). HTML canvas remains full viewport; main renderer clears full viewport sky, then sets WebGL viewport bottom-left `(0,0,W,H-band)`, scissor same, render once. CameraRig.resize gets `(W,H-band)`. Do not change CSS canvas height: pointer coordinates remain native and swipes work. `game.state.intro` uses full viewport; switch to band at intro end, resize/snap before first run frame. Pause retains band framing; over/caught uses same run viewport until over screen; menu/character/market/help full-frame preview as specified. Rendering projection shift is a deliberate visual change: compare route readability on phone before coding later scenery stages. No runtime textures/lights added.

Band row geometry (top positions include safeTop):

| Row | Portrait x/y/size |
|---|---|
| Score | x12 y12, width W-24, h44; grid `minmax(76px,1fr) 68px 64px 44px`, gaps6; score/coins/mult/pause |
| Powers | x16 y64, width W-32, h32; flex gap8, no wrap; diameter**32** icon24 |
| Event | xcenter y102, max280 wide, h24; hidden content but reserved track |
| Caption | x16 y134, width min(W-32,424), h54 +shadow/rotation extent <=8; band ends196 |

Score label10/11 Bangers, numeral22/24 tabular Baloo; allow large scores down to18px via digit-count class >=8, compact displayed number only if >=1e9 (`1,2 Mr` accessible full score). Coins16, small coin16, multiplier24. Show base x1 instead of hiding so owner always knows where it lives. Gold Bugle tag `×2`10 on badge top right, event tag **`OLAY +{n}`**10/12 red/yellow at badge bottom with ceil bonus seconds e.g. `OLAY +3 · 12`; total remains state.multiplier, do not add bonus twice. Example `(base2 +run0 +temp1 +event3)*factor2=×12`. Caption explains only distance score. Event bonus and Bugle can coexist with two distinct tiny tags; reserve score cell64×44 and put event tag on adjacent centred event row when both overflow? **Fixed decision:** event bonus tag sits directly below multiplier at y47 (height12), with row64 still6px clear. Bugle tag inside cell; no third row.

Powers order fixed current order `sense magnet bugle spring swing decoy wall tracer`, followed by future `event`. Ring radius14/circumference87.965, stroke3 ink backing and yellow remaining arc, icon24 centred; label is accessible `Mıknatıs, {ceil} saniye`, visible 10px shorthand under icon inside32 (`HİS, MIK, ×2, YAY, AĞ, KUK, DUV, İZ, +`). At <=20% fraction arc red and static `!` badge, no flashing. Updating existing token doesn't reorder. Eight fit exactly:8×32+7×8=**312 <=328** at360. Nine or more: first7 in fixed order plus a **`+{activeCount-7}`**32 token. Overflow token cycles the hidden active icons every1500ms and keeps `+N` small count; no touch target in run. Pause shows all full names/remaining in its sheet. Keep `#h-event` for 11.5 DOM QA, move into hidden pool or visible row as appropriate; it follows eventBonusTime and ring (never active eventTime). Event bonus also always readable on multiplier tag even when token overflows. Iron timer is on zırh action; hero timer on ability action, not duplicated in token row.

Event slot text: active `VENOM HAMLESİ! · {ceil(eventTime)} sn` ink background/white/red border; `YEŞİL CİN BASKINI! · {n} sn` purple #6a2fa0/lime #d7ff5a. Font17/20 Bangers; do not add `rowWarn` danger text here if active event uses it. Outside events rowWarn briefly uses slot `RAY YARIĞI · ZIPLA!`, `SİNYAL KAPISI · KAY!`, `VİNÇ · YEŞİL ŞERİDE!` until deadline; first-time explanation still caption. Text is immediately set on eventStart, not queued. Clear on eventEnd/abort, never award on abort. No banner at centre of road. Lane warnings remain 3D, at actual lane positions with red hatching and chevrons as 11.5; DOM doesn't counterfeit their positions.

Action dock portrait bottom `12px+safeBottom`: flash left12 width60 height64, jet left80 width60 height64, Iron core right132 width56 height64, ability right12 width112 height64. This layout at360 leaves20px between left jet end140 and Iron start172. Dock gap0/padding3; icons22, labels13/14, counters12/12; main ability label17/18. Landscape padding2, icon16h, labels13/14 (ability16/16), counters10/10. This fits64/52px without vertical overflow. Flash label `FLAŞ`, sub `{ceil}s · {stock}`; jet `JET`, sub `{ceil}s`; core `ZIRH` sub `{stock}`; hidden unavailable buttons leave their slots empty, others never shift. Replace existing `img[src=ironman-icon.png]` with existing ironSpider canvas/vector icon (no file). Gift top -13 has reserved clearance. Dock pointer-events:none, buttons auto, underlying lane swipes remain possible elsewhere. No sound toggles during run; both have fixed menu/pause homes.

Landscape band height**100+safeTop**. Grid x12/right12 top8 gap8 columns `144px minmax(0,1fr) 44px` rows32 44; powers middle top row, pause right; score left row1, with small coin/mult inline and score18. Event slot left row2 top56 width144 height36, wraps at two lines16/16; the bonus tag occupies y39–51 above it; caption middle row2 x164 right64 h44. At740 middle width512; 8 tokens312 fit, no flash overlap. Scissor run viewport740×260. Dock bottom8+safeBottom, buttons52 high with same x positions. Inset safeLeft/right applies to both dock and band. At very narrow landscape <620 token gap4 and diameter28,7+overflow rule unchanged; body never <14 in sheets.

## Pause / sound homes

Pause remains a centered card max360; header `DURAKLATILDI`32, resume52, restart44, sound row44 each, menu44, gap8,padding12,border3. Optional active powers readout has max-height112 overflow:auto under resume, labels14. Portrait fits card<370; landscape card grid2 columns with resume spans2, restart/menu paired, sound pair, active-list optional max64; total<=300. Both toggles use existing `data-music/data-sfx`, aria-pressed; button font16, no icon-only mute. Do not create a third sound state. Sound keys and audio lifecycle unchanged.

## Computed fit ledger (no browser observation)

| Target | Menu clear hero band | Character sheet/grid | Market panel | HUD road viewport |
|---|---:|---|---:|---|
|360×740|234px|332px / 4×3, cells71.25×68|520px / four consumables398|360×544|
|490×805|299px|332px / cells93.25×68|585px|490×609|
|740×360|left340 (716-360-16)|360×336 / rows72.67|180px|740×260|

Safe areas reduce available hero/stage/list heights, not touch targets. With top24/bottom20, portrait menu hero190, market476, road520. Font loading/letter widths and 3D framing are **unseen**; acceptance must measure actual scrollHeight/clientHeight and bounding rects on phone. Keep the fitted dimensions, adjust copy before shrinking text.
