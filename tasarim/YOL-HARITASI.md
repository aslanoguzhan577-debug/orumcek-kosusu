# Örümcek Koşusu: yol haritası ve devir belgesi

Yazıldığı gün: 2026-11-11. Yazan: yönetici (Fable 5.2). Bu belge, yönetici başka projeye geçtiği için işi devralacak kişi ya da model içindir. Tek başına okunup işe devam edilebilecek şekilde yazıldı. Ürün niyeti PLAN.md Bölüm 11'de; kod haritası `tasarim/HARITA.md`'de.

Ölçüt: Oğuzhan bitince "bununla gurur duyuyorum" demeli; arkadaşları "ne oyun yapmışlar aga" demeli.

## 1. Bugünkü durum

| Aşama | İçerik | Durum | Sıradaki adım |
|---|---|---|---|
| 11.1 | Altın sesi, katmanlı müzik, Müzik/Efekt düğmeleri | Yayında (9e46dcc) | Oğuzhan telefonda dinleyecek; şikâyet gelirse `tasarim/11-1-ses-muzik.md`'deki sayılar ayarlanır |
| 11.5 | Ray yarığı, sinyal kapısı, vinç kirişi, Venom Hamlesi, Yeşil Cin baskını | Tasarım tamam (`11-5-*.md`, 15 görev). Kod görevi 1-7 bitti, testler geçiyor. Üç engel yolda; olaylar henüz kapalı | Qwen kontrolü (`11-5-kontrol-1-7.md`), sonra görev 8-15 |
| 11.2 | İlk karşılaşma ipuçları, kahraman düğmesi, karakter seçimi, çizgi roman "nasıl oynanır", telefon yerleşimi | Tasarım + 6 prototip yayında (245e314). Qwen 3.8 Max incelemesi: düzeltme gerek (`11-2-inceleme.md`, 2 engel + 5 hata). Düzeltme turu başlatıldı | Yeniden inceleme, Oğuzhan'ın onayı, sonra 12 kod görevi |
| 11.3 | Bölgeler, gün döngüsü, kaplamalar, Bugle panoları, canlı ayrıntılar | Tasarım tamam (`11-3-*.md`, 8 belge, 11 sıralı kod görevi, prototipler). Fable başladı, Opus bitirdi. Hiçbir sayı ekranda görülmedi | Qwen 3.8 Max incelemesi, Oğuzhan'ın prototiplere bakması, sonra kod |
| 11.4 | Oyun sonu çizgi roman sayfası, Venom'un yutma animasyonu, kapak albümü, mesafe rekoru, günün parkuru | Başlamadı | Tasarım (yön aşağıda, Bölüm 4) |
| 11.6 | Çevrimiçi skor tablosu | Karar bekliyor | Oğuzhan sunucu hesabına karar verecek |

Her aşamanın ayrıntılı durumu kendi ilerleme dosyasında: `tasarim/ilerleme-<aşama>-<rol>.md`. İşe başlamadan önce ilgili ilerleme dosyası okunur.

Yayında olmayan, çalışma klasöründe duran iş: 11.5 kod görevleri 1-7. Kontrol geçerse yerelde commit edilir ama **push edilmez**: yeni engelleri kimse ekranda görmedi ve `main` dalı herkese açık yayındır (GitHub Pages). Oğuzhan `localhost:5173`'te bakıp onaylayınca push edilir.

## 2. Çalışma düzeni (Oğuzhan'ın kuralları, o değiştirene kadar geçerli)

Roller:
- **Yönetici** yalnız plan, brif ve karar üretir. Proje dosyası açmaz, test etmez, commit atmaz.
- **Fable 5.2**: yalnız tasarım ve modelleme. Tarayıcı kullanmaz (kota). Şimdilik başka projeye ayrıldı; bu projede 11.3'ün bitirilmesi için Opus'a izin verildi.
- **GPT 6.1 Sol** (Codex): zor ya da uzun kod; betimlenmiş plandan tasarım. Korumalı ortamı commit, push ve vault yazımını engeller.
- **DeepSeek-Flash** (Qoder): rutin kod, harita bakımı, commit + push + vault kaydı.
- **Qwen3.8-Flash xhigh** (Qoder): kod kontrolcüsü. **Qwen3.8-Max xhigh** (Qoder): tasarım ve prototip incelemecisi (kodu okuyarak; tarayıcısı yok).
- Başka model alt ajan yapılmaz.

Komutlar (proje klasöründen):
- Sol: `node ~/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs task --write --fresh --model gpt-6.1-sol --effort high "<brif>"`
- Qoder işçisi: `bash ~/.claude-evren/qoder-ajan.sh <tam proje yolu> "<brif>" <DeepSeek-Flash | Qwen3.8-Flash | Qwen3.8-Max> <efor>`

Her aşamanın döngüsü:
1. Tasarım belgesi + telefon prototipi (`tasarim/`, `tasarim/proto/`).
2. Qwen 3.8 Max incelemesi (`tasarim/<aşama>-inceleme.md`); düzeltme turu.
3. Prototipler push edilir, Oğuzhan telefonda bakar ve onaylar (görünüşü yalnız o görebiliyor).
4. Kod: tasarımın sıralı görevleri. `hard` ve `visual-spec` Sol'a, `routine` DeepSeek'e. Her görevden sonra dört kontrol.
5. Qwen 3.8 Flash xhigh kontrolü; eksikler kodlayana döner.
6. DeepSeek commit + push + vault kaydı. Oğuzhan telefonda dener.

Her brifte bulunması gerekenler:
- "Önce `tasarim/HARITA.md`'yi oku, yalnız dokunacağın dosyaları aç; yapıyı değiştirirsen haritayı güncelle."
- "İlerleme dosyanı güncel tut" (yapılan, kararlar ve nedeni, kalan, sonrakinin tekrar etmemesi gerekenler).
- Ponytail aşama kuralı: mantık, HUD, kayıt, testler için "en küçük eksiksiz değişiklik"; görsel ve ses için sadelik kuralı yok.
- Komutlar "tam yazıldığı gibi" çalıştırılır; `git add -A` yok, dosyalar adıyla eklenir.
- Dört kontrol: `node tools/test-skills.mjs`, `node tools/check-patterns.mjs`, `node tools/check-quality.mjs`, `node tools/test-audio.mjs`.

Değişmez ürün kuralları: görsel ve ses dosyası yok (her şey kodla); dinamik ışık yok; koşu sırasında doku ya da malzeme üretimi yok; her şey instanced ya da havuzlu; zorluk sabitlenmez ve her tohumda en az 0,4 sn tepki payıyla geçilebilir yol kalır; karakterler kilitlenmez, kazanılan hiçbir şey geri alınmaz; eski kayıtlar yüklenir.

Tarayıcıda test eden olursa: kendi sekmesi, `localStorage.clear()` yok, `preview_stop` yok, kayıt anahtar anahtar geri yüklenir. Uygulama içi tarayıcının kaydı uygulama yeniden başlayınca silinir.

## 3. Sıradaki işler, sırayla

### 3.1 11.5'i bitir
1. `tasarim/11-5-kontrol-1-7.md`'deki Qwen bulguları varsa Sol'a düzelttir.
2. Oğuzhan `localhost:5173`'te üç engele baksın: yarığın okunaklılığı, kapının altından kayma payı, kirişin iki yönü, 360×740 ve yatay, virajda, en yüksek hızda. Onaylarsa push.
3. Görev 8-12 Sol'a (8 şerit uyarıları ve dokunaçlar, 9 Cin mantığı, 10 bombalar, 11 Cin ve planör modeli, 12 çizgi roman efektleri). Sol'un devir notu: kapanış pozları 8,8 sn'de başlar, ödül ve bitiş 10 sn'de; tasarımın B.3 bölümündeki ödül ifadesi S.2 ile uzlaştırılacak; olay yarıda kesilince kamera dolly'sinin sahibi net olmalı.
4. Görev 13-15 DeepSeek'e (bölgeleri aç, HUD, ipuçları, görevler: olaylar canlıya çıkar; ses kancaları; ölçüm ve harita). Qwen'in 11.2 incelemesindeki not: `road-events.js:46`'daki `kind !== 'venom'` kapısı yüzünden Cin için `eventStart` ateşlenmiyor; görev 13'te düzeltilir.
5. Qwen xhigh kontrolü, sonra push. Oğuzhan Venom Hamlesi'ni ve Cin baskınını telefonda dener.
6. Altı yeni görev eklenince açık görev seti bir kez yenilenir; çarpan korunur. Oğuzhan'a önceden söylendi.

### 3.2 11.2'yi kodla
1. Düzeltme turundan sonra Qwen 3.8 Max'e yeniden incelet; "sahibi görebilir" kararı çıkınca prototipleri push et.
2. Oğuzhan'ın kararları: görev kartı **bugünkü hâliyle kalır** (büyük Bangers yazı, yıldız patlaması rozetleri), yalnız sığacak kadar sıkışır; butonlar oyunun bugünkü stilinde kalır. Onay bekleyen dört varsayılan: HUD bandı 196/100 px; hediye şarj yalnız özel yeteneği olan 8 kahramana; "nasıl oynanır" isteğe bağlı; Raimi'nin yükseltmesi uçuş süresini uzatır.
3. Kod, `tasarim/11-2-gorevler.md` sırasıyla. İlk görev gerçek bir hata: marketteki kahraman süre yükseltmeleri para alıyor ama işlemiyor.
4. Bölge duyuruları için `districtEnter` olayı 11.3 ile gelecek; 11.2 bu ipuçlarını o zamana kadar kapalı tutar.

### 3.3 11.3'ü bitir ve kodla
1. Tasarım bitti. Qwen 3.8 Max inceler. Prototipler push edilir, Oğuzhan bakar: `tasarim/proto/11-3-canli.html` (oyunun kendisi yeni görünümle, bölge düğmeleri ve tur), `11-3-bugle.html` (bütün manşetler), `sheet.html` (kaplamalar). `11-3-canli.html` oyunun kodunu yüklediği için `localhost:5173` üzerinden açılır.
2. Kod sırası `tasarim/11-3-gorevler.md`'de, 11 görev: şehir mantığı ve ayarlar (rutin); gün döngüsü ve gökyüzü (zor); çizgi roman cepheleri; bölge sistemi ve köprü (zor); Chinatown; metro tüneli; Neon Meydan; Bugle panoları (zor); zeplin, güvercin, martı, buhar; rekor havai fişeği, yağmur ve kar; 11.5 engellerini kendi bölgelerine yerleştirme (zor). Bütçe bağlayıcı: en çok 105 çizim çağrısı ve 140 bin üçgen (bugün 76 ve 97 bin), dokular +38 MB.
   - Görev 11 üreticiye dokunur. PLAN "11.3 üreticiyi değiştirmez" diyor, 11.5 tasarımı ise bu bağlantıyı 11.3'e bırakıyor. Varsayılan: en sonda yapılır, yalnız hangi engel türünün konduğu değişir, `check-patterns` ile doğrulanır. Oğuzhan'ın onayı gerekir.
   - Tasarımın varsayılanları (itiraz yoksa kalır): gece 3,7 km'de başlar, üçüncü gece kar yağar, köprüde İstanbul vapuru geçer, Chinatown'a yeni engel konmaz.
3. 11.3 gelince 11.5'e bağlanacaklar: ray yarığı Köprü'de, sinyal kapısı tünelde, Yeşil Cin gecede; bölge geçişinde `districtEnter` olayı.
4. Bu aşamanın en büyük riski performans: her görevden sonra çizim çağrısı ve kare süresi ölçülür, Oğuzhan gerçek telefonda akıcılığa bakar. Engeller her bölgede ve gece net okunmalı.

### 3.4 11.4'ü tasarla ve kodla
Tasarımcı: Fable ayrıldığı için Opus ya da betimlenmiş plandan Sol. Yön Bölüm 4'te.

### 3.5 Bölüm 11'den sonra temizlik
- README'yi oyunun bugünkü hâline göre yeniden yaz.
- Eski test dosyalarını (`tools/test-ui-hud-qa.mjs`, `test-hero-specials-qa.mjs`, `test-qa-deep-audit.mjs`) ya çalışır hâle getir ya sil.
- Bilinen küçük kusurlar: Batman pelerini açılırken omuza sıkışıyor; yatay ekranda Flaş butonu göstergelere biniyor (11.2 yerleşimi çözmeli, doğrula).
- Denge turu: yeni engellerle güçlerin km başına sıklığını yeniden ölç; altın ekonomisi (ilk koşuda yüzlerce altın birikiyor, yükseltmeler ucuz kalıyor) kapak albümü ödülleriyle birlikte ayarlanır.
- Gerçek telefonda 20 dakikalık koşu: bellek, ısınma, kare süresi.

## 4. 11.4 için yaratıcı yön: "Bir koşu daha"

Fikir: her koşu bir çizgi roman sayısıdır ve oyun sonu o sayının son sayfasıdır.

- **Venom'un yutması.** Yakalanınca Venom siyah balçık gibi çözülür, dokunaçlar karakteri ayaklarından yukarı sarar, karakter bir an çırpınır; dev çene kameranın üstüne kapanır, ekran kararır, "GULP!" patlar. Yaklaşık 1,5 sn, dokunarak geçilir. Balçık modeli örter, bu yüzden 11 karakterde aynı çalışır; parçalar havuzludur. Trene çarpma gibi başka ölümler için de aynı uzunlukta kısa birer kapanış karesi düşünülür.
- **Son sayfa.** Karartı bir çizgi roman sayfasına açılır: üstte son anın dondurulmuş karesi ve ölüm nedenini söyleyen anlatı kutusu ("VENOM BU SEFER AÇ DEĞİLDİ"); altında koşunun özeti paneller hâlinde: skor, mesafe, altın, bu koşuda ilerleyen görev rozetleri tek tek dolarak. En altta tek satır "sıradaki hedef" (rekora kalan puan, bitmek üzere olan görev ya da açılmak üzere olan kapak) ve büyük bir "BİR DAHA!" butonu. Bugünkü koyu düz ekranın yerini alır.
- **Kapak albümü.** Başarımlar çizgi roman kapağı olarak açılır: yaklaşık 20 kapak, kodla çizilir, her birinde oyuncunun adı ve o başarının sayısı vardır ("ÖRÜMCEK KOŞUSU #7: GECEYİ GÖREN ADAM"). Örnekler: ilk 5 km, geceye ulaşmak, x10 çarpan, Venom Hamlesi'nden hiç vurulmadan çıkmak, Cin'i atlatmak, her bölgeyi görmek, bir koşuda hiç sendelememek. Her kapak altın öder. Karakterler kilitlenmez; albüm, altının ve uzun vadeli hedefin yeni adresidir. Kapak açıldığında oyun sonu sayfasında büyük bir an olur.
- **Adil rekor.** Skorun yanında çarpandan bağımsız "en uzun mesafe" rekoru tutulur; ilk 5 listesinde her skorun yanında çarpan rozeti görünür. Eski x1 rekorları silinmez.
- **Günün parkuru.** Her gün herkese aynı tohum: aynı yol, aynı engeller. Günlük en iyi ayrı tutulur; paylaşım metni günü, skoru ve mesafeyi taşır. Sunucu gerekmez; arkadaşlar mesajla kıyaslar. Menüde tek bir sticker buton.

## 5. Daha ilerisi (Bölüm 12 adayları, öncelik sırasıyla)

1. **Paylaşım kartı.** Oyun sonu sayfasından tek dokunuşla resim: Bugle manşeti, skor, kahraman. Arkadaş grubuna atılan şey oyunun reklamıdır; bu projede en çok karşılık verecek küçük iş bu.
2. **Çevrimiçi skor tablosu ve haftalık meydan okuma** (11.6 kararına bağlı). Günün parkuru bunun sunucusuz ön adımı.
3. **Kahraman kimliği.** Her kahramana küçük bir pasif ve bir bedel (örneğin Hulk engel kırar ama yavaş şerit değiştirir). Karakter seçimini zevkten karara çevirir; dengesi zahmetlidir.
4. **Ana ekrana ekleme (PWA), çevrimdışı çalışma, titreşim.** Telefonda uygulama gibi durur.
5. **Mevsimler.** Kış New York'u, Cadılar Bayramı: 11.3'ün bölge ve gün döngüsü altyapısı üzerine yalnız palet ve birkaç sahne parçası.
6. **Erişilebilirlik.** Renk körlüğüne uygun şerit uyarıları, azaltılmış hareket, tek elle oyun ayarı.
7. **Bölüm sonu karşılaşması.** Her tam şehir turunun sonunda kısa bir Venom finali.

## 6. Oğuzhan'dan beklenen kararlar

1. 11.2'nin dört varsayılanı (Bölüm 3.2).
2. 11.5 engelleri ekranda iyi görünüyor mu (push onayı).
3. 11.3 prototipleri: bölgeler, gün döngüsü, Bugle panoları; 11.3 görev 11 (engellerin bölgelere yerleştirilmesi) için onay.
4. 11.4'ü kim tasarlasın: Opus mu, betimlenmiş plandan Sol mu.
5. 11.6: çevrimiçi skor tablosu için sunucu hesabı açılacak mı.
6. Oyun herkese açık yayında ve Marvel ile Sanrio karakterleri kullanıyor; kaldırılma riski biliniyor. Arkadaş çevresi dışında yayılacaksa depoyu özel yapmak düşünülmeli.

## 7. Riskler

- **Kimse görmeden yazılan görseller.** İşçilerin hiçbiri tarayıcı açamıyor; ölçüler hesapla çıkıyor. Her görsel iş Oğuzhan'ın telefonda bakmasıyla kapanır; bu adım atlanırsa bozuk ekran yayına gider.
- **Adalet.** Yeni engel ve olaylar `tools/check-patterns.mjs`'e öğretilmeden yola çıkmamalı; denetçinin "OK" satırı her commit'ten önce görülür.
- **Performans.** 11.3 çizim yükünü artırır; bütçe tasarımda yazılı, ölçüm her görevde yapılır.
- **Kota.** Fable ve Opus aynı 5 saatlik sınırı paylaşıyor; uzun tasarım işleri ilerleme dosyası olmadan başlatılmaz.
- **Aynı dosyaya iki yazar.** Kod yazan işler sırayla; paralel işler ayrı klasörlerde (`tasarim/` ile `src/`).
