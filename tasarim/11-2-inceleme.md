# 11.2 inceleme raporu

**İlk inceleme kararı: NEEDS DESIGN FIXES** — aşağıdaki1–8 bulguları ilk sürümün tarihsel kanıtıdır. 2026-11-11 tasarım düzeltmesi:1–8 ele alındı; yeni ölçüler ve kalan telefon kabulü [ilerleme notunda](ilerleme-11-2-tasarim.md). Tarayıcı açılmadı. Eski satır numaraları/toplamlar düzeltilmiş sürümü tarif etmez.

1. **blocker** `proto/11-2-proto.css:57–59` + `11-2-nasil-oynanir.html`: yardım sayfası 1, **360×740'ta kırpılıyor**. comic-page içi 534; sabitler 30+16+32+44+32 = 154 → paneller 380 → satır 186 → içerik **164**. Panel 1 = 44+48+38+32+20 = **182** (h3 "ŞERİT DEĞİŞTİR" 14×0,55×22 = 169 > 129 → 2 satır), panel 4 = **176**. `overflow:hidden` + `justify-content:center` 18/12 px'i kesiyor, `bubble:after` kuyruğu kopuyor — tasarımın kendi kabul satırı ihlal. Dokümanın "472" toplamı yanlış (gerçek 380); 490×805 geçiyor. Yön: ≤400px'te motion 28 / h3 19.

2. **blocker** `:91`: yatay anlatı kutusu 8 px kısa — 44−6−8 = **30** içerik, iki 19px satır = **38**. Kopya sütunu 461, `gift` satırı 119+351 = 470. 42 satırın ≥6'sı sarar, 100px bandın altına yola dökülür. Yön: height 52 ya da kopya 16/17.

3. **bug** `:87`: yatay menü satır 5 — "NASIL OYNANIR?" **160** / içerik **138** → 2 satır **58** / iz **44**; ikinci satır MÜZİK-EFEKT'in üstüne düşer. `.missions-strip` 113+54+9 = **176** / 138 → rozetler ~14px'e ezilir, "12" kırpılır. `.name-field` 14+36+2 = **52** / iz **46** → input 6 px kesik.

4. **bug** `:91`: yatay `.mult` içerik **24**, "×12" 3×0,55×17 = **28** → kırpık. `.event-tag` (x140–207, y37–49) `.powers` (y8–40) ile 43×3 px çakışıyor.

5. **bug** dock boşluğu = **W−328** (jet 140'ta biter, iron W−188'de başlar): 320px'te 8 px, Fold kapağında (280px) 48 px örtüşme. Dokümanın "20px"i yalnız 360'ta doğru.

6. **bug** `:71`, `11-2-hud.html`: 9. jeton 9×32+8×8 = **344 > 328**; `overflow:hidden` kesiyor, prototipin "9 GÜCÜ GÖR" düğmesi cevapsız bozuk hâli sergiliyor.

7. **bug** kontrast: `.stage-note` 11px, rengi/zemini yok → #0d0d14 / #263963 ≈ **1,66:1**; `.ability.blocked` **4,29:1**. Yön: krem metin + mürekkep kontur.

8. **polish**: 12px altı — `.power small` 9, yatay `.event-tag` 9, `.score-cell small`/`.bugle-tag`/`.caption-tab` 10, `.stage-note`/`.demo-label` 11. 44px altı — `.mini-badge` 27 (yatay 18). Hareket — `:94` reduced-motion animasyonu tümüyle kapatıyor (doküman "100 ms opacity"), `empty-shake`'te 0%/100% yok, `.active-clock` statik `conic-gradient(72%)` (doküman SVG r=18, C=113,097). Eksik durum — kostüm `AĞDA`, `ANLATICI`/`YENİ BÖLGE!` etiketleri, "zaten hediye" şeridi çizilmiyor. Tetikleyici — var olmayan tek olay `districtEnter` (5 satır); `eventStart kind==='goblin'` `road-events.js:46`'daki `kind !== 'venom'` kapısıyla ateşlenmez; kalan 35 satır gerçek/adaptör.

**Geçti:** menü 364/380 · levha 332 = 6+24+24+16+218+44 · jeton 218, hücre 71,25/93,25 · market sarf 400≤520 (yükseltme 1054 kayar, istenen) · bant 12–56/64–96/102–126/134–188 ≤196 · 8 jeton 312≤328 · yol 544/609/260 · portre kutular en kötü 1,86 satır · `.page-dots` 44×44 · ui.css çakışması yalnız `.coin-ico` · görev sırası güvenli, assert'ler doğru.

**Yalnız telefonda:** gerçek Bangers genişliği, 3B sahne üstünde metin, 240 ms puff/dönüş hissi, çentikli cihazda güvenli alan.

---

## Devir notu (handoff)

**Durum: 11 parçanın 11'i de bitti. Kalan parça yok.** Rapor yukarıda; aşağısı devralan için ayrıntı.

### Parça parça ne yapıldı

| # | Parça | Sonuç |
|---|---|---|
| 1 | Prototipler ayakta mı | Evet. Altı sayfa da `../../ui.css` + Google Fonts'a bağlanıyor, `/tasarim/proto/`'dan servis edilince çözülür. `11-2-proto.js` (242 satır) import etmiyor, oyuna dokunmuyor, storage yazmıyor → okuyarak script hatası yok. Bağımlılık: tüm CSS değişkenleri, `#ui [hidden]{display:none!important}` ve `.coin-ico` yalnız ui.css'te; ui.css yüklenmezse kenarlık/zemin/font shorthand'ları computed-value anında geçersiz kalır ve çöker. |
| 2 | Ölçü/aritmetik | Rapor 1–6. Ayrıca doğrulanan geçişler "Geçti" satırında. |
| 3 | Dokunma hedefi / punto / Türkçe satır kırılması | Rapor 8. `NASIL OYNANIR?`, `ŞERİT DEĞİŞTİR`, `Havada yine yukarı: ağ at.`, `Bir şarj gider!` dar sütunlarda 2 satıra sarıyor; eğik kutularda (`rotate(-12deg)` state-stamp, `rotate(-7deg)` motion) harf kırpılması yok çünkü hepsinde yeterli padding var. |
| 4 | Okunurluk | Rapor 7. Geçenler: `.paper` krem/#0d0d14 ≈ 17:1, `.action` beyaz/#e0262c ≈ 4,9:1, `.sticker` #0d0d14/#ffd23a ≈ 12:1, `.state-stamp` kırmızı/krem = 4,61:1 (sınırda geçer), `.ribbon` beyaz/#0d0d14 ≈ 18:1, `.cover-title` krem + 3px mürekkep kontur → sahne üstünde yeterli. `.stage-name` beyaz + 2px kontur → geçer. Tek zeminsiz metin `.stage-note`. |
| 5 | Koşu içi HUD | Üç şeridi ve kahraman alanını kapatan yok: bant 196px (yatay 100px) opak gökyüzü, `.run-scene` onun altında başlıyor, `.caption` `pointer-events:none`. 740px ekranda 544px yol kalıyor (≈%74) → yeterli. 8+ jeton: rapor 6. Flash/jet ile iki ses düğmesi hiç aynı ekranda değil (ses düğmeleri yalnız menüde) → örtüşme riski yok; dock içindeki tek risk rapor 5. |
| 6 | Tutarlılık | Proto, ui.css değişkenlerini (`--red --blue --navy --yellow --ink --cream --font-h --font-b`) aynen kullanıyor, kopya değişken tanımlamıyor. Tek paylaşılan sınıf `.coin-ico`; `.paper/.action/.sticker/.panel/.bubble` ui.css'te yok → icat edilmiş ama çakışmayan yeni sınıflar. Aile birliği: kenarlık 3px (2px küçük öğelerde), gölge 4px/2px, radius 16/12/10/2, eğiklik −7°/−5°/−3°/−2°/−12° → tasarım dokümanındaki token satırıyla uyumlu. |
| 7 | Hareket | `puff .24s`, `token-pop .18s`, `caption-in .22s`, `caption-out .16s`, `ready-ring 1.3s`, `empty-shake .18s` → hiçbiri 400ms üstü değil, giriş bloklamıyor (`.caption{pointer-events:none}`). Reduced-motion bloğu var ama rapor 8'deki gibi fazla sert. |
| 8 | Tasarım ↔ prototip | Var olanlar: pill ready/empty "ŞARJ YOK"/active/blocked, hediye çıkartması, anlatı kuyruğu (5 örnek + 3000ms), market iki sekme + NORMAL/AZ ALTIN/DOLU, 11 karakter jetonu + 11'inin de yetenek metni, 4 yardım sayfası + noktalar + son sayfa "ANLADIM!". Eksikler rapor 8'de. |
| 9 | İpucu tablosu | 42 satırın 35'i gerçek olay ya da dürüstçe "adapter" etiketli; 2'si "integration pending" (`rowWarn` gerçekten var, `obstacles.js:346`); 5'i `districtEnter` diye var olmayan bir olay öneriyor. Depolama kuralı (`spidey.seen[id]=1`, `charge.empty` için 6000ms, `gift.{skin}` için `spidey.gifts`) tutarlı. Metin uzunlukları: portre en kötü 1,86 satır → geçer; yatay rapor 2. |
| 10 | Görevler | 12 görevin sırası güvenli (her adımdan sonra oyun çalışır: 1–4 veri/olay katmanı, 5–8 UI, 9–11 entegrasyon, 12 temizlik). Kapı betikleri mevcut (`tools/test-*.mjs`, `check-quality.mjs`). Assert aritmetiği elle doğrulandı, yanlış yok. Risk: `proto/11-2-check.mjs` DOM düzeni ölçmüyor, bu yüzden rapor 1–5 ondan geçiyor; 11.2'nin kabulü için gerçek cihaz/tarayıcı ölçümü şart. |
| 11 | Türkçe metin | Yazım ve karakterler temiz (ı İ ş ğ ü ö ç yerinde), ton istenen "arkadaşına anlatan muzip anlatıcı". Anlaşılmayacak tek yer: `11-2-ilk-bes-dakika.md:25`'teki bitişik yazılmış kelimeler (doküman içi, oyuncuya gitmiyor). "Çekirdek" (Iron Spider) ve "Kartuş" (ağ) ayrımı ilk koşuda karışabilir; `pickup.iron` kutusu "Zırh düğmesine dokun" diyerek bunu bağlıyor → yeterli. |

### Devralanın dikkatine
- Rapor **bilerek** 450 kelime sınırında; yukarıdan düşürülen ayrıntılar bu tabloda.
- Varsayımlar: güvenli alan girintileri 0 (`st=sb=sl=sr=0`), `100dvh` = pencere yüksekliği, Bangers genişliği `karakter × 0,55 × font-size`, Baloo 2 gövde `× 0,5`. Tüm ölçüler border-box.
- Hiçbir dosya düzeltilmedi. Bu oturumda yazılan tek dosya `tasarim/11-2-inceleme.md`.
- Sayılar `st=0` varsayımıyla; çentikli cihazda bant ve caption `var(--st)` kadar aşağı kayar, yol yüksekliği aynı kalır (bant yüksekliği de `+var(--st)`).
