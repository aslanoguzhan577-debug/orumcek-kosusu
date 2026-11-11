# 11.2 — The ability button tells the truth

Keep `#h-web`, its label/slots/hint IDs and current activation API. Reposition into the bottom-right action dock; do not implement a second skill. It is **112×64 px** portrait, **112×52** landscape (100px wide at280); label17/18 Bangers, icon20, count12/12 Baloo; padding3, gap0. Content50 + padding6 + inherited .btn borders8 =64. Landscape padding2, icon12h, label16/16, count12/12:40+4+8=52. Existing game .btn border4 ink, radius14, shadow0 6. Count is `charges / cap`, cap from `game.web.getMaxCharges()` (costumes 3, Raimi 2, other heroes 1). A use costs **one**, including Raimi; cartridge fills to cap. Iron Spider is a separate core button, never consumes this counter.

| Priority / state | Predicate | Look / exact copy | Tap / accessibility |
|---|---|---|---|
| 1 active | heroSpecials.active or costume web.zipping | selected colour, icon, timer ring 4 px; `AKTİF`, remaining ceil seconds | no second use; aria-label `Yetenek aktif, {n} saniye kaldı`; ring uses actual skill clock |
| 2 blocked | halted/controlsLocked/verticalLocked, not active | fill #797b87, cream text with2px ink stroke, `BİRAZDAN`; retain count | no spend; label `Şimdi kullanılamıyor`; no misleading refill hint |
| 3 empty | charges===0 | background #d5d5d9, icon grayscale(1), ink label; tilted red outlined `ŞARJ YOK` stamp 15/16 px at right -2/top 8, rotate(-12deg) | shake 180 ms x=[0,-3,3,-2,0], empty narration; button remains enabled/focusable, aria-label `Şarj yok. Yoldan kartuş al veya marketten 75 altına doldur.` |
| 4 ready | charges>0 | yellow #ffd23a for costume; hero colours below; 2 px outer ink ring pulses scale(1→1.06→1), 1300 ms ease-in-out | call existing tryActivate once; aria-label `{ability}, {charges} şarj. Kullan.` |

Order is deliberate: an active ability with zero remaining stock is **active**, never empty. A locked airborne player with charges is **blocked**, never empty. Pause hides the run dock. Costume web duration is not a fixed timer: while `web.zipping`, ring is a solid ink solid outline and `AĞDA`; no invented seconds. On failed ready activation do not decrement; map next state from the actual system. UI never changes game.state.

Special rings: read `hs.timeRemaining/hs.maxTime` only if it matches the delegated skill clock. Ring fraction clamp 0..1, update quantized to 1/200 like current gauges; after fixing durations, expose the real remaining/max for every delegated skill (including Raimi). Numeral ceil seconds changes at most once a second. SVG circle radius18, circumference113.097; dashoffset=`113.097*(1-fraction)`; rotate(-90deg). Ready pulses stop when hidden or reduced motion. Active timer must not double-appear as `#h-ironbar`; remove that bar after the ring migration. Iron suit timer appears in `#h-iron` ring concurrently with hero skill, not through the old mutually exclusive bar.

Hero colours: hulk #77df59/ink, cap blue/white, miles red/white, kitty #ffb5da/ink, batman yellow/ink, raimi red/white, ironman #b8edff/ink, panther #6a2fa0/white. Ring white on dark fill, ink otherwise; include label/count for non-colour recognition. Costume `AĞ`, ready text `DOKUN`; hero display names come from character document. Short pill labels (one line in112px): `HULK EZER`, `KALKAN`, `VENOM GÜCÜ`, `UÇAN KALP`, `PELERİN`, `MANCINIK`, `TEK IŞIN`, `VİBRANYUM`; aria-label and ribbon retain full ability names. Desktop helper `E`; no change to Q/E/F, C, P/Esc bindings.

## First-run gift accounting

New guarded key **`spidey.gifts`**, object `{hulk:1,...}` (only eight whitelisted IDs). No reset or migration of old keys. A veteran without the key is eligible, even if helpSeen exists. `spidey.seen['gift.hulk']` is merely the announcement; it cannot determine grant eligibility. Storage denied: in-memory dedup for this page, gifts may recur after reload; no dependency on a remote store.

Install grant in the **single shop start path** (current shop.js start listener), after `_resetRun` has set webCharges=0, before bankedHeroCharge transfer. Do not depend on listener registration order between ui.js and shop.js. Read selected `game.skin`, whitelist eight heroes. First start/restart with eligible skin: increment available charges by one capped by `getMaxCharges`, set claimed=1 immediately and persist; publish a UI-readable grant result for this start, e.g. `game.web.lastGiftSkin` reset on every start (do not persist a second count). UI enqueues gift only from that result and waits until intro ends. All other starts grant 0. Opening selection, changing skin, preview animation, help, pause/resume never grants/claims. An abandoned or skipped intro still consumes this first-run present; no retry farming.

Then transfer `take = min(maxCharges-currentCharges, bankedHeroCharge)`, subtract **only take** from banked stock, save. Examples:

| Skin / claim / bank | Gift | Charge after transfer | Bank after |
|---|---:|---:|---:|
| Hulk first / 0 | 1 | 1 | 0 |
| Hulk first / 1 | 1 | 1 | 1 |
| Hulk claimed / 1 | 0 | 1 | 0 |
| Raimi first / 2 | 1 | 2 | 1 |
| Spider costume / 1 | 0 | 1 | 0 |

`HEDİYE ŞARJ!` also appears as a 13/14 px yellow sticker on ability button for 4000 ms of playable run time; no tap target; full caption copy is in narration catalogue. Sticker top -13, right 0; dock leaves 16 px room above it. No gift for three costumes by default; director may extend explicitly with the same accounting, see tasks decisions.

Claimed state: replace gift promise with12px **Hediyeni kullandın · Kartuş ya da market.** strip; costumes show **Kostüm · ortak ağ · hediye verilmez**. Prototype toggles demonstrate the strip without saved-data writes. Costume AĞDA has a solid full ring and no seconds. Active SVG r18/C113.097 uses actual fraction (prototype .6 in active example/.4 on activation), never a conic-gradient. Reduced motion:100ms opacity only for entry/exit, no ring pulse/shake/rotation tween; empty-shake has explicit0% and100% return endpoints.

## Iron Spider and double tap: truth in the help text

Current `main.js` double-action hook tries a charged unique hero ability first, otherwise Iron Spider. So never teach `double always means Iron Spider`. Prefer explicit `#h-iron` tap on phone. Help's exact note: `Çift dokun: dolu kahraman gücü; yoksa zırh.` Costs: zırh core market 100, max5; hero/web market charge 75; track cartridge fills cap. Both controls remain supported, no remapping in this stage.

## Duration evidence and required repair

Confirmed: `ironspider.js:116–122` adds upgrade level×0.5 to 12 s. `web.js:107–115` computes each hero base+level×0.5. Hulk/Cap/Miles consume it; Kitty/Batman delegate activate(dur). **Iron Man** calls activate() and resets fixed 2.2 s (`skillIronMan.js:200–205`); **Panther** calls activate() with fixed duration 5.5 (`skillBlackPanther.js:115–122`). **Raimi** activate() has anticipation/flight phases and receives no duration argument (`skillSpiderman2002.js:198+`); shared remaining clock is not decremented in its branch (`hero-specials.js:493–496`). This is not an open question about whether all upgrades work: these are identified missing paths.

Repair recipe for coder: pass validated effective duration to those three activate methods. Iron Man extends only the active post-shot hold (`timeRemaining`), preserving lock/shoot timings; Panther sets per-activation duration and remaining, preserving shock timing normalized to that duration. Raimi preserves anticipation/launch speed and extends the flight/coast phase by **0.5 s per level**; expose anticipation+flight remaining/max to parent and ring. Read its actual phase constants before editing, ensure extended flight never changes the launch physics/grace period unintentionally. Never globally slow skill animations. Resolve discrepancy between Raimi's label base3 and actual phase sum by showing actual phase sum in UI, not fabricated 3 s. If director rejects longer flight, pause sale of hero upgrade **for Raimi only** with copy `Bu güç için süre yükseltmesi hazırlanıyor.` until fixed, preserving purchased levels (fallback, not preferred). No tests or fixes performed during this design pass.
