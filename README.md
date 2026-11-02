# 🕷️ Örümcek Koşusu (Spider Run) — 3D Endless Runner

Three.js tabanlı, Subway Surfers mekaniklerine ve AAA görsel efektlerine sahip modern 3D sonsuz koşu oyunu.

---

## 🌟 Öne Çıkan Özellikler ve 8 Kahraman Özel Yetenek Sistemi

Oyunda klasik kostümlerin (Spider-Man, Spider-Gwen, Spider-Man MCU) yanı sıra her birine özel olarak geliştirilmiş benzersiz 8 kahraman yeteneği bulunmaktadır:

### 1. 👊 Hulk — "Hulk Smash"
- **Süre & Şarj:** 6.0 saniye süre, maksimum 1 şarj.
- **Mekanik:** Ayaklardan yayılan radyoaktif yeşil zemin yarıkları (`hulk_fissure_crack`) ve gama şok dalgaları (`hulk_gamma_shockwave`). Önüne ve yanına çıkan tüm trenleri ve engelleri parçalayarak ilerler.
- **Korumalar:** Sendeleme (stumble) muafiyeti ve yetenek bitiminde 0.5s güvenlik toleransı.

### 2. 🛡️ Kaptan Amerika — "Shield Surfing"
- **Süre & Şarj:** 8.0 saniye süre, maksimum 1 şarj.
- **Mekanik:** Ayakların altında dönen 3D Vibranium Kalkan, kinetik enerji yastığı (`cap_shield_disc`), asfaltta sürtünme kıvılcımları ve havada süzülme (0.32m ayakta / 0.22m kayma).
- **Zıplama Şartı:** Tren ve yüksek bariyerlerden zıplayarak geçilmesi gerekir.
- **Çarpışma Emilimi:** Olası bir çarpmada kalkan gong sesiyle darbeyi emer, engeli parçalar ve oyuncuya 1.5s dokunulmazlık (grace) vererek yeteneği güvenle sonlandırır.

### 3. ⚡ Miles Morales — "Venom Bio-Electricity"
- **Süre & Şarj:** 7.0 saniye süre, maksimum 1 şarj.
- **Mekanik:** Spider-Verse ve Insomniac oyunlarına sadık altın sarısı ve turuncu biyoelektrik yıldırımları (`miles_venom_lightning`), gövde kıvılcımları ve **+10 m/s hız takviyesi**.
- **Çarpışma Emilimi:** Çarpışma anında kör edici "Venom Nova" elektrik patlaması (`miles_venom_nova`) açılır, engel atomize edilir ve 1.5s koruma süresiyle koşu devam eder.

### 4. 💖 Hello Kitty — "Uçan Kalp Yükselişi (Flying Heart Rise)"
- **Süre & Şarj:** 8.0 saniye süre, maksimum 1 şarj.
- **Mekanik:** Ayakların altında `THREE.Shape` ve `THREE.ExtrudeGeometry` ile modellenmiş tombul pembe kalp (`#ff66b2`, emissive `#ff1493`) sörf platformu, 3D melek kanatları ve kırmızı fiyonk.
- **Uçuş İrtifası:** Smoothstep ile yumuşakça **3.6m güvenli irtifaya** yükselerek trenlerin (2.88m) ve bariyerlerin (0.8m) üzerinden süzülür.
- **Efektler:** Arkadan dökülen pembe-beyaz ışıltılar ve mini 3D kalp parçacıkları; inişte 1.5s yumuşak iniş koruması.

### 5. 🦇 Batman — "Gece Pelerini Süzülüşü (800 Metre)"
- **Mesafe & Şarj:** Süreye değil, katı **800 metre mesafeye bağlı**, maksimum 1 şarj.
- **Uçuş İrtifası:** 0-40m aralığında yumuşak kalkışla **3.6m irtifaya** yükselir, tren ve bariyerlerin üzerinden rahatça uçar, 750-800m aralığında yumuşak iniş yapar ve 1.5s iniş koruması sağlar.
- **24x12 Segmentli Pelerin Fiziği:** 325 tepe noktalı aerodinamik yarasa kanadı pelerin, gerçek zamanlı sinüs dalgası rüzgar fiziğiyle (`pos.z = sin(x*5 + time*22)*0.12*yRatio`) dalgalanır.
- **Efektler:** Kanat ucu rüzgar çizgileri (vortex trails), 3D kanat çırpan yarasa sürüsü parçacıkları, ray zemininde irtifayla küçülen gerçekçi gölge takibi ve 800 metreye göre orantılı azalan HUD çubuğu.

### 6. 🕸️ Spider-Man 2002 (Raimi) — "Mancınık Ağ Zıplaması (Slingshot Web Jump)"
- **Kullanım Hakkı:** **2 şarj** (HUD'da 2 kademeli sapan göstergesi).
- **Gerilim Evresi (0.30s):** Yan binalara bağlanan çift gergin beyaz ağ kabloları, karakterin geriye yaylanması (`rotation.x = -0.6 rad`), kamera FOV daralması (60 -> 50).
- **İleri Roket Fırlama:** Ağlar serbest kaldığında anında **+18 m/s devasa ileri hız patlaması** (`game.speedOverride`), dikey fırlama hızı (`vy = 20.0 m/s`), **8.2m apeks tepe irtifasına** ulaşan parabolik devasa uçuş ve aerodinamik hız çizgileri.
- **İniş:** Asfaltta parlayan dairesel ağ şok minderi (mandala), hız aşımının temizce sıfırlanması ve 1.5s iniş koruma toleransı.

### 7. 💥 Iron Man — "Ark Reaktörü Unibeam Patlaması"
- **Süre & Şarj:** 2.2 saniye atış süresi, maksimum 1 şarj.
- **3 Katmanlı Işın Motoru:** Göğüsten ileriye doğru beyaz çekirdek silindir + titreşen `#00e5ff` mavi plazma silindir + 160 m/s ile ileri akan 12 adet `TorusGeometry` şok halkası.
- **200 Metre Şerit Temizleme:** Şeritteki 200 metreye kadar olan tüm engelleri 3D parçalara ve kıvılcımlara ayırarak buharlaştırır (`shatterObstacle`).
- **Repulsor Boost:** Dükkandan veya HUD üzerinden kullanılabilen roket uçuşu desteği ve karikatürize Iron Man ikonu.

### 8. 🟣 Black Panther — "Vibranyum Kinetik Şok Dalgası"
- **Süre & Şarj:** **5.5 saniye** süre, maksimum 1 şarj.
- **Vibranyum Kinetik Sprint:** Aktivasyon anında hıza **+14 m/s ciddi hız takviyesi** uygulanır; yetenek bittiğinde hız güvenle sıfırlanır.
- **Genişleyen Kubbe:** 1.5m'den 7.5m'ye patlayıcı şekilde büyüyen çift katmanlı mor `IcosahedronGeometry` kubbesi.
- **16 Metre Radyal İmha:** 3 kademeli altıgen zemin şok halkaları ve engellere kilitlenen 15 kırıklı şimşek arkı eşliğinde, 16 metre yarıçaptaki tüm engelleri mor kristal parçalarına ayırarak yok eder.

---

## 🦾 Evrensel Iron Spider ve Zırh Çekirdeği Mekaniği

- **Her Karakterde Aktif:** Kostüm fark etmeksizin tüm karakterlerde `Space` veya ekrana **çift dokunma** ile 12 saniyelik Iron Spider modu devreye girer.
- **Mekanik Altın Kollar:** 4 mekanik altın kol açılır, ölümcül çarpmalarda oyuncuyu havaya kaldırıp kurtarır (`save-clear`).
- **Mağaza (Shop) Entegrasyonu:** Mağazadan altın karşılığında **+1 Zırh Çekirdeği** ve kahraman özel yetenek şarjları satın alınabilir.

---

## 📁 Proje Mimarisi ve Eklenen / Değiştirilen Dosyalar

```
orumcek-kosusu/
├── assets/
│   └── vfx/                             # Yüksek çözünürlüklü fotogerçekçi VFX dokuları
│       ├── cap_shield_disc.png          # Kaptan Amerika kalkan kinetik diski
│       ├── cap_vibranium_shockwave.png  # Vibranyum şok dalgası
│       ├── hulk_fissure_crack.jpg       # Hulk zemin yarıkları
│       ├── hulk_gamma_shockwave.jpg     # Gama zemin dalgası
│       ├── miles_venom_lightning.jpg    # Biyoelektrik şimşek dokusu
│       └── miles_venom_nova.png         # Venom blast patlama dalgası
├── src/
│   ├── vfxCore.js                       # AAA parçacık motoru, 3D enkaz fiziği, dinamik FOV & ışık patlamaları
│   ├── powerups/
│   │   ├── hero-specials.js             # 8 Kahramanın merkezi yetenek yöneticisi
│   │   ├── skillHelloKitty.js           # Hello Kitty uçan kalp yetenek modülü
│   │   ├── skillBatman.js               # Batman 800m gece pelerini uçuş modülü
│   │   ├── skillSpiderman2002.js        # Spider-Man 2002 mancınık ağ fırlama modülü
│   │   ├── skillIronMan.js              # Iron Man 3 katmanlı Unibeam modülü
│   │   ├── skillBlackPanther.js         # Black Panther kinetik sprint & şok modülü
│   │   ├── ironspider.js                # Evrensel Iron Spider zırh yöneticisi
│   │   ├── web.js                       # Ağ atma ve şarj kota sistemi (1/2/3 şarj mantığı)
│   │   └── repulsor.js                  # Iron Man repulsor uçuş desteği
│   ├── shop.js                          # Mağaza ve kalıcı kayıt (localStorage) sistemi
│   ├── ui.js                            # Dinamik HUD ikonları, slotlar ve geri sayım çubukları
│   └── main.js                          # Sahne döngüsü, gölge kotu ve karakter entegrasyonu
├── ui.css                               # Kahraman temalı degrade barlar, SVG slotları ve responsive stiller
├── tools/                               # Kapsamlı otomatik QA test paketleri
│   ├── test-hero-specials-qa.mjs        # 15 temel yetenek & çarpışma QA testi
│   ├── test-ui-hud-qa.mjs               # 3 HUD, slot ve mağaza QA testi
│   └── test-qa-deep-audit.mjs           # 118 kontrol noktalı derin simülasyon denetimi
└── index.html                           # Oyun arayüzü, SVG tanımları ve import haritası
```

---

## 🎮 Kontroller (Controls)

| İşlem | Klavye Tuşları | Dokunmatik / Mobil |
|---|---|---|
| **Şerit Değiştirme** | `A` / `D` veya `Sol` / `Sağ` Ok Tuşları | Sola / Sağa Kaydırma (Swipe Left/Right) |
| **Zıplama** | `W` veya `Yukarı` Ok | Yukarı Kaydırma (Swipe Up) |
| **Kayma** | `S` veya `Aşağı` Ok | Aşağı Kaydırma (Swipe Down) |
| **Özel Kahraman Yeteneği / Ağ** | `E`, `Q`, `F` Tuşları | HUD Yetenek Butonuna Dokunma |
| **Iron Spider Zırhı** | `Space` Tuşu | Ekrana Çift Dokunma (Double Tap) |
| **Duraklatma** | `P` veya `Escape` | Sağ Üst Pause Butonu |

---

## 🧪 Test ve Kalite Güvencesi (QA)

Tüm kod tabanı aşağıdaki otomatik doğrulama süreçlerinden başarıyla geçmiştir:

```bash
# Tüm JS dosyalarının sözdizimi denetimi
node --check src/vfxCore.js src/powerups/hero-specials.js src/powerups/skill*.js

# 8 Kahraman yetenek simülasyon testi
node tools/test-hero-specials-qa.mjs

# HUD, slot göstergeleri ve mağaza entegrasyon testi
node tools/test-ui-hud-qa.mjs

# 118 kontrol noktalı canlı derin simülasyon denetimi
node tools/test-qa-deep-audit.mjs

# 150 tohum x 38.4 km sonsuz yol ve engel örüntü testi
node tools/check-quality.mjs
node tools/check-patterns.mjs
```

**Sonuç:** %100 Başarı (118/118 Kontrol Noktası PASS, 0 Hata, 0 Bug).
