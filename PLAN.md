# Spider-Man Koşu Oyunu — Plan

Arkadaşlarla skor yarışı için yapılan, yayınlanmayacak bir hayran oyunu. Tarayıcıda çalışır (telefon + PC), Three.js ile yapılır, kurulum gerektirmez.

## Kararlar

| Konu | Karar |
|---|---|
| Mekan | New York gibi şehir içi, yerden yüksek tren hattı. 3 şerit. |
| Kontroller | Telefon: kaydırma. PC: ok tuşları / WASD. |
| Normal zıplama | Yukarı kaydır. Şarj harcamaz. Poz: kollar yukarı-yana açık, dizler karna çekik. |
| Ağ atma | Havadayken **ikinci kez yukarı** kaydır. 1 şarj harcar. Ağ çok dik açıyla kadraj dışına atılır. Önde tren varsa çatısına iner, yoksa uzun süzülen yüksek zıplama yapar. |
| Ağ doldurucu | Yoldan toplanır, şarjı 3'e doldurur (en fazla 3). |
| Tren üstü | Gelen trenler hareketli. Bazı yerlerde sabit vagonlar ve rampalar var. |
| Iron Spider | Yoldan toplanan çekirdekler cihazda birikir. Çift dokunuş (PC: Space) ile açılır, 5 sn sürer. Çarpınca etki hemen biter ve önündeki 2 saniyelik yoldaki tüm engeller parçalanır. |
| Başlangıç klibi | Her koşunun başında ~5 sn, dokununca/tuşla geçilir (Temple Run / Subway Surfers girişi gibi). Kamera önden bakar; Spider-Man ağla sallana sallana Venom'dan kaçar, ağ atıcısı boşalır ("TIK TIK"), yere düşüp yuvarlanır, Venom yaklaşınca "AAA!" diye bağırıp koşmaya başlar, kamera arkaya döner ve oyun başlar. |
| Kıvrılan sokaklar | Rastgele aralıklarla (çok sık değil) yol uzakta yumuşakça sağa ya da sola kıvrılır; şehir, raylar, trenler birlikte bükülür (görsel "eğik dünya", oyuncunun olduğu yerde bükülme sıfır, oynanış ve adalet değişmez). Kamera ve karakter virajın içine hafifçe yatar. |
| Trenin arkasında görünürlük | Yan şeride geçince karakter ortadaki trenin arkasında kaybolmaz: kamera yanal takibi artar ve engelin arkasında kalan kısım parlak bir siluet olarak görünür. |
| Bitmeyen zorluk | Zorluk hiçbir zaman sabitlenmez: hız tavanına kadar yavaşça artmaya, sonra yoğunluk, kombinasyonlar ve tren hızıyla zorlaşmaya devam eder. Her an geçilebilir bir yol vardır ama gittikçe darlaşır; çok uzun hayatta kalmak neredeyse imkânsızlaşır. |
| Örümcek hissi | Yerden toplanır, otomatik başlar, 5 sn sürer: o sürede kaçamayacağın engellerden karakter kendisi kaçar (zıplar, kayar ya da şerit değiştirir). Logo: bizim Funko Spider-Man kafası ve çevresinde sarı zikzak "his" çizgileri. |
| Mıknatıs | Yerden toplanır, otomatik başlar, 5 sn sürer: süre boyunca çevredeki altınlar karaktere uçup toplanır. |
| Ağ bekleme süresi | İki ağ atışı arasında en az 1,2 sn (oyun süresi; duraklayınca durur). |
| Power-up sıklığı | Güçler (ağ, Iron Spider, örümcek hissi, mıknatıs) eskisinin yaklaşık yarısı sıklıkta çıkar; iki güç toplama noktası arasında en az 300 m olur. |
| Altın dizilimi | Altınlar her zaman en az iki şeritte: paralel sıralar, şerit değiştiren zikzaklar, engellerin üstünden kavisler (Subway Surfers gibi). |
| Kayma animasyonu | Spider-Man'in ikonik örümcek çömelmesi: eller ve ayaklar yerde, bacaklar açık, alçak ve hızlı kayış; görsel tepe bariyer tahtasının (0,95 m) altında, çarpışma kutusu 0,75 m aynı kalır. |
| Iron Spider kolları | Zıplarken 4 altın kol yere vurup karakteri havaya iter. Kayarken önde yüksek bariyer varsa kollar ileri fırlar, bariyeri tutar ("ÇANK!") ve karakteri altından fırlatır gibi geçirir. Sadece görsel; oynanışı değiştirmez. |
| Venom | Yandan sürtünme/küçük engel = tökezleme, Venom yaklaşır. Birkaç saniye içinde ikinci tökezleme = yakalanma. Önden çarpma = yakalanma. |
| Görsel | Chibi (2–2,5 kafa boyu), toon gölgelendirme + kalın dış çizgi. Karakterler önce kodla, temel şekillerden. |

## Bölümler

Her bölüm sonunda oyun açılıp denenebilir durumda olur. 1–5 oynanış (karakterler kutu), 6–7 görsel, 8–9 paylaşım.

### 1. İskelet ve koşu çekirdeği
- Proje yapısı, Three.js, kamera, sonsuz yol.
- 3 şerit, şerit değiştirme, zıplama, kayma; klavye + kaydırma.
- Zamanla artan hız, mesafeden skor.
- **Bitti:** Telefonda ve PC'de bir kutu koşuyor, şerit değiştiriyor, zıplıyor, kayıyor.

### 2. Dünya ve engeller
- Alçak bariyer (zıpla), yüksek bariyer (kay), araba/taksi, gelen tren, sabit vagon (rampalı ve rampasız).
- Tren üstünde koşma, vagonlar arası zıplama, vagon bitince yere inme.
- Her zaman en az bir geçilebilir yol bırakan engel dizilimi üretici.
- Paralar, oyun sonu ve yeniden başlatma.
- **Bitti:** Adil, oynanabilir bir koşu.

### 3. Venom kovalaması
- Başlangıçta arkadan kovalayıp geri kalması.
- Tökezleme sistemi, yakalanma.
- **Bitti:** Tökezleyince Venom'un yaklaştığı görülüyor, ikincide yakalıyor.

### 4. Ağ doldurucu
- Toplama, 3 şarj, havada ikinci yukarı ile ağ.
- Kadraj dışına dik ağ çizgisi, yay çizerek tren çatısına çıkma veya uzun süzülme.
- Şarj göstergesi.
- **Bitti:** Şarj sadece bilinçli ikinci kaydırmayla harcanıyor.

### 5. Iron Spider
- Çekirdek toplama ve cihazda biriktirme, çift dokunuşla açma.
- Süre çubuğu; çarpınca etkinin bitmesi ve öndeki 2 saniyelik yolun temizlenmesi.
- **Bitti:** Çarpmada ölmüyor, öndeki engeller parçalanıyor, zırh dağılıyor.

### 6. Karakterler (chibi)
- Spider-Man, Iron Spider (sırtta 4 altın bacak), Venom: kodla, temel şekillerden.
- Toon materyal, dış çizgi, kodla çizilen ağ deseni, göz ve logolar.
- Kodla animasyonlar: koşu, zıplama pozu, kayma, ağ atma, tökezleme, yakalanma, Venom'un koşusu ve uzanması.
- **Bitti:** Kutuların yerinde chibi karakterler.

### 7. Şehir, efektler, ses
- İki yanda tekrar eden binalar, yüksek ray, gökyüzü, sis.
- Ağ çizgisi, parçalanma, para parıltısı, dönüşüm parlaması, kamera sarsıntısı.
- Kodla üretilen efekt sesleri (dosya gerekmez).

### 8. Menü, arayüz, skor
- Ana menü, isim girme, oyun sonu ekranı, cihazdaki en iyi skor.
- "Skoru paylaş" butonu (WhatsApp vb. için hazır metin).
- Zorluk ayarı.

### 9. Arkadaşlarla paylaşım
- Oyunu bir linkte yayına alma (GitHub Pages veya Netlify).
- İsteğe bağlı: ortak online skor tablosu (Firebase/Supabase ücretsiz katman, hesabı senin açman gerekir).
- İsteğe bağlı: "günün parkuru" — herkes aynı parkuru oynar, yarış adil olur.

## Uygulama planı (ajanlar)

Yönetici görevleri alt ajanlara verir, sonuçları kontrol edip birleştirir. Kendisi özellik kodu yazmaz; paralel işleri birleştirirken sadece bağlantı satırları ekler.

### Akış
1. Başlamadan önce klasörde yerel git (internete gitmez). Her görevden sonra kayıt noktası.
2. Her görevden sonra: oyun tarayıcıda açılır, konsol hatalarına ve "Bitti" şartına bakılır, telefon boyutunda denenir, sonra kaydedilir.
3. Sorun varsa iş aynı ajana geri gönderilir (bağlam onda).
4. Aynı anda çalışan ajanlar asla aynı dosyaya dokunmaz.

### Görevler

| Görev | Bölüm |
|---|---|
| G1 İskelet ve koşu çekirdeği | 1 |
| G2 Dünya ve engeller | 2 |
| G3 Spider-Man + Iron Spider modelleri | 6 |
| G4 Venom modeli | 6 |
| G5 Sesler | 7 |
| G6 Karakterleri oyuna takma | 6 |
| G7 Şehir ortamı | 7 |
| G8 Venom kovalaması | 3 |
| G9 Ağ doldurucu | 4 |
| G10 Iron Spider | 5 |
| G11 Efektler, ses bağlama, güç göstergeleri | 7 |
| G12 Menü, arayüz, skor | 8 |
| G13 Son kontrol ve ayar | — |
| G14 Paylaşım | 9 |

### Ajanlar

Aynı koda dokunan görevler aynı ajanda toplanır. Ajan bir görevi bitirince kontrol edilir, sonra aynı ajana bir sonraki görev verilir; bağlam onda kalır.

| Ajan | Model | Efor | Görevler |
|---|---|---|---|
| A1 Mekanik | Opus | high | G1, G2, G8, G9, G10 |
| A2 Karakterler | Opus | high | G3, G4, G6 |
| A3 Ortam ve arayüz | Sonnet | high | G5, G7, G12, G11, G14 |
| A4 Son kontrol | Opus | high | G13 (taze gözle baksın diye ayrı) |

### Sıra

| Dalga | A1 Mekanik | A2 Karakterler | A3 Ortam ve arayüz |
|---|---|---|---|
| 1 | G1 | — | — |
| 2 | G2 | G3 + G4 (viewer'da) | G5, G7 |
| 3 | — | G6 | — |
| 4 | G8 → G9 → G10 | — | G12 |
| 5 | — | — | G11 |
| 6 | A4: G13 | | |
| 7 | — | — | G14 (kullanıcının hesabıyla) |

### Ortak sözleşme (G1 kurar, herkes uyar)
- Birim metre. Oyuncu z=0'da kalır, ileri yön -Z, dünya +Z yönünde akar. Kamera oyuncunun arkasında (+Z) ve üstünde.
- Three.js 0.170.0, `index.html`'deki importmap ile CDN'den. Yerelde `python -m http.server 5173` ile açılır.
- Dosyalar ve sahipleri:
  - G1: `index.html`, `style.css`, `viewer.html`, `src/main.js`, `src/game.js`, `src/config.js`, `src/events.js`, `src/input.js`, `src/player.js`, `src/world.js`, `src/models/toon.js`, `src/models/placeholder.js`
  - G2: `src/obstacles.js`, `src/world.js` ve çarpışma için G1 dosyalarında gereken değişiklikler
  - G3/G4: `src/models/spiderman.js`, `src/models/ironspider.js`, `src/models/venom.js`, `src/models/toon.js`
  - G5: `src/audio.js` · G7: `src/city.js` · G8: `src/chaser.js` · G9: `src/powerups/web.js` · G10: `src/powerups/ironspider.js` · G11: `src/fx.js` · G12: `src/ui.js`, `ui.css`
- Model arayüzü: `createSpiderman()`, `createIronSpider()`, `createVenom()` → `{ root, setState(name), update(dt) }`. `root` orijini ayak hizasında, yüzü -Z'ye bakar, boyu yaklaşık `CONFIG.playerHeight`. Oyuncu durumları: `idle, run, jump, slide, web, stumble, caught`. Venom: `run, reach, catch`.
- Olaylar: `src/events.js` → `events` (EventTarget) ve `emit(name, detail)`. İsimler: `start, pause, resume, gameover {score, coins, distance}, jump, land, slide, lane {dir}, coin {position}, stumble, crash {position}, caught, pickup {type}, web {from, to}, ironOn, ironOff, ironSave {positions}, ironGrab {position}, venomNear, venomFar, intro {phase}`. Klip aşamaları sırayla: `start, swing (her sallanışta), webEmpty, fall, roll, roar, scream, run, end` (`end` geçişte de gelir, `{skipped: true}` ile).
- Yeni güçler: `pickup {type: 'sense'|'magnet'}`, `senseOn`, `senseOff`, `senseDodge {action: 'jump'|'slide'|'left'|'right', position}`, `magnetOn`, `magnetOff`, `magnetCoin {position}`. Arayüz için `game.state.senseTime` ve `game.state.magnetTime` (saniye, 0 = kapalı). Eşya görselleri `src/pickup-art.js` içinde `createSensePickup()` ve `createMagnetPickup()`.
- Klip için ek model durumları: oyuncu `swing, fall, roll, scared`; Venom `roar`. Klip sürerken `game.state.intro === true` (arayüz HUD'u gizler).
- Iron Spider modeli ek olarak `setGrabTarget(worldPos | null)` sunar: oyun, kayarken önündeki yüksek bariyerin tutma noktasını her kare bildirir (yoksa `null`). Bariyer tam üstünden geçerken oyun `ironGrab {position}` yayınlar.
- Oyun durumu (arayüz sadece okur): `game.state = { mode: 'menu'|'running'|'paused'|'over', score, coins, distance, speed, webCharges, ironCount, ironTime }`. API: `game.start()`, `game.pause()`, `game.resume()`, `game.restart()`.

### Tüm ajanlar için kurallar
- Önce PLAN.md'yi oku. Sadece sana verilen dosyalara dokun.
- Sadece Three.js. Yeni kütüphane ve build adımı yok.
- Ayarlanabilir sayılar `src/config.js`'te.
- Hareketler kare hızından bağımsız (dt ile, dt üst sınırlı).
- Önce telefon: düşük poligon, pahalı gölge ve post-processing yok, sık oluşan nesneler havuzdan.
- Referans görseller kullanılmaz; her şey kodla.
- Ekrandaki yazılar Türkçe.
- Bitirince kısa rapor: ne yapıldı, hangi dosyalar, bilinen sorunlar, nasıl denenir.

### Görevlere özel uyarılar
- **G1:** Oyuncu orijinde kalsın, dünya aksın (uzun koşuda sayı hassasiyeti bozulmasın). Dokunmatikte sayfa kaymasın, yakınlaşmasın. Çift dokunuş ve "havada ikinci yukarı" için girişte yer ayır. Oyun olaylarını (zıplama, para, çarpma vb.) tek bir `EventTarget` üzerinden yayınla. Modeller için ortak arayüz, toon + dış çizgi yardımcıları ve modelleri tek tek gösteren `viewer.html` kur.
- **G2:** Her dizilimde, o anki hızdaki tepki süresiyle geçilebilen en az bir yol kalsın. Gelen trenin yaklaşma hızı = oyuncu hızı + tren hızı. Önden çarpma (ölüm) ile yandan sürtünme (tökezleme) ayrı. Vagon bitince yere düşüş. Nesne havuzu.
- **G3:** 2–2,5 kafa boyu. Ağ deseni canvas dokusuyla. Zıplama pozu: kollar yukarı-yana açık, dizler karna çekik. Iron Spider aynı gövde, kırmızı-altın-siyah, sırtta 4 altın bacak. Durumlar: idle, run, jump, slide, web, stumble, caught.
- **G4:** Spider-Man'den iri ama yine chibi. Geniş sırıtış, dişler, dil, beyaz örümcek amblemi. Durumlar: run, reach, catch. G3 ile aynı stil yardımcılarını kullan.
- **G5:** Web Audio ile kodla üretilen sesler, dosya yok. Telefonda ses ilk dokunuşta açılır. Sessize alma.
- **G6:** Oyuncu durumunu model durumuna eşle. Çarpışma kutuları değişmesin.
- **G7:** Binalar havuzdan tekrar kullanılır. Sis uzakta belirmeyi gizler. Yükseltilmiş rayın altında sütunlar. Draw call düşük.
- **G8:** Tökezleme süresi config'te. Venom yaklaşınca ekranda görünmeli. Yakalanınca kontroller kilitlenir.
- **G9:** İkinci yukarı sadece havadayken ve şarj > 0 iken. İniş noktası, hareketli trenin iniş anındaki konumuna göre. Yay sırasında tren biterse yere iniş. Kayarken ağ atılmaz.
- **G10:** Çift dokunuş kaydırmayla karışmasın. Temizlenecek bölge her engelin kendi yaklaşma hızına göre (gelen tren daha hızlı yaklaşır), tüm şeritlerde. Envanter localStorage'da, hata yakalamalı. Açıkken tekrar açılamaz.
- **G11:** Olaylara abone ol, oyun mantığına dokunma. Parçacık havuzu. Kamera sarsıntısı hafif.
- **G12:** Sadece `ui.js`, `ui.css` ve `index.html`'deki `#ui` katmanı; oyuna game API'si ve olaylarla bağlanır (G2 ile aynı anda çalışır). Ağ şarjı ve Iron Spider süre göstergeleri de burada. Sekme değişince oyun dursun. Paylaş butonu (`navigator.share`, yoksa panoya kopyala). İsim ve en iyi skor cihazda.
- **G13:** Telefon boyutunda akıcılık, konsol hataları, 10+ dakikalık koşu, adalet ve zorluk eğrisi.
- **G14:** Kullanıcının hesabıyla yapılır (GitHub veya Netlify); online skor tablosu kararı o zaman verilir.

## 10. Görevler, skor çarpanı ve yeni güçler (2026-11-03)

Subway Surfers'ın (Poki web sürümü, REA ile incelendi) görev → çarpan sistemi ve bizde karşılığı olmayan güçleri, Spider-Man temasıyla. Sadece mekanik alınır; isim, görsel, ses alınmaz.

### Skor çarpanı
- `game.mult = { base: 1, run: 0, temp: 0, factor: 1 }`; her kare `game.state.multiplier = (base + run + temp) * factor`.
  base = 1 + tamamlanan görev seti sayısı (kalıcı, en fazla 30). run = Flaş Fotoğraf (+5/+6/+7, koşu başına). temp = Örümcek İzi (0–3). factor = 2 Bugle Manşeti açıkken.
  Her koşu başında run, temp sıfırlanır, factor 1 olur; base kalır.
- Skor birikir: her koşan karede `mesafe artışı × scorePerMeter × multiplier` eklenir; altın başına `coinScore` (10) çarpılmaz. `game.state.score = floor(birikmiş mesafe puanı) + coins × coinScore`.
- HUD: skorun yanında "x5" rozeti; değişince zıplar, factor 2 iken altın parlar.

### Görevler (`src/missions.js`)
- Aynı anda 3 görev = bir set. İlerleme cihazda (`spidey.missions`, bozuk kayıt = baştan). Üçü bitince base +1, yeni set gelir (`missionSet {set, multiplier}` olayı, ekranda "ÇARPAN x6!"). Tek görev bitince `missionDone {id, text}` + kısa bildirim.
- Setler set numarasından tohumlu seçilir: tüm arkadaşlar aynı sırayla aynı görevleri görür. Miktarlar setle büyür.
- "Tek koşuda" görevlerin ilerlemesi her koşu başında sıfırlanır (bitmişse kalır).
- Havuz (olaydan sayılır): altın topla (toplam / tek koşu), zıpla (toplam / tek koşu), kay, şerit değiştir, ağ at, güç topla, mıknatıs topla, örümcek hissiyle kaç, Iron Spider ile kurtul, kahraman yeteneği kullan, tek koşuda X puan, tökezlemeden X m, altın toplamadan X puan.
- Ana menüde "Görevler · Set N · xM" kartı: 3 satır, ilerleme çubuğu, tik.

### Aktarılan güçler (Subway Surfers karşılığı)
| Bizde | Karşılığı | Nasıl |
|---|---|---|
| Ağ Salınışı (`swing`, yerden) | Jetpack | 8 sn binalar arasında yüksekte ağla sallanır (girişteki `swing` pozu), havada altın şeridi, engeller değmez, inişte 1,5 sn koruma. |
| Örümcek Yayı (`spring`, yerden) | Süper Ayakkabı | 10 sn zıplama ~2,2 kat (tren çatısına doğrudan çıkar). |
| Bugle Manşeti (`bugle`, yerden) | 2x Çarpan | 10 sn factor = 2. Uçan Daily Bugle gazetesi. |
| Flaş Fotoğraf (market sarf) | Skor Takviyesi | Koşunun ilk 7 sn'sinde HUD butonu, koşu başına en fazla 3: run = 4 + kullanım (+5, +6, +7). |

Zaten olanlar: Mıknatıs (Coin Magnet), Iron Spider (Kaykay), Iron Man jeti (Hızlı Başlangıç), ağ / mancınık (Pogo).

### Yeni güçler
- **Ağ Kuklası (`decoy`, yerden):** Ağdan bir kukla bırakır, Venom ona kanıp en geriye düşer; 20 sn içindeki ilk tökezleme Venom'u yaklaştırmaz.
- **Duvar Koşusu (`wall`, yerden):** 6 sn yandaki bina cephesine sıçrar ve duvarda koşar; engeller değmez, duvarda altın sırası; bitince en yakın dış şeride iner, 1,5 sn koruma.
- **Örümcek İzi (`tracer`, yerden):** 10 sn küçük bir drone önde uçar, her zaman açık olan güvenli şeride parlayan ağ izi çizer. İz üzerinde her 3 sn kalınca temp +1 (en fazla +3), izden çıkınca temp 0.

### Ponytail ayarı (aşamaya göre, kullanıcı kararı)
Full: oyun mantığı, kayıt / skor formülü, HUD ve menü, güçlerin oynanış kodu, testler. Ponytail kapalı (sadelik kuralı uygulanmaz, gösterişli yapılır; efektler YAPILIR): güç görselleri / efektler / ikonlar / eşya modelleri ve konsept tasarım.
