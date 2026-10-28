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
| Iron Spider | Yoldan toplanan çekirdekler cihazda birikir. Çift dokunuş (PC: Space) ile açılır, 20–25 sn sürer. Çarpınca etki hemen biter ve önündeki 2 saniyelik yoldaki tüm engeller parçalanır. |
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
- Olaylar: `src/events.js` → `events` (EventTarget) ve `emit(name, detail)`. İsimler: `start, pause, resume, gameover {score, coins, distance}, jump, land, slide, lane {dir}, coin {position}, stumble, crash {position}, caught, pickup {type}, web {from, to}, ironOn, ironOff, ironSave {positions}, venomNear, venomFar`.
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
- **G11:** Olaylara abone ol, oyun mantığına dokunma. Parçacık havuzu. Kamera sarsıntısı hafif. Ağ şarjı ve Iron Spider süre göstergeleri de burada.
- **G12:** Sadece `ui.js`, `ui.css` ve `index.html`'deki `#ui` katmanı; oyuna game API'si ve olaylarla bağlanır (G8–G10 ile aynı anda çalışır). Sekme değişince oyun dursun. Paylaş butonu (`navigator.share`, yoksa panoya kopyala). İsim ve en iyi skor cihazda.
- **G13:** Telefon boyutunda akıcılık, konsol hataları, 10+ dakikalık koşu, adalet ve zorluk eğrisi.
- **G14:** Kullanıcının hesabıyla yapılır (GitHub veya Netlify); online skor tablosu kararı o zaman verilir.
