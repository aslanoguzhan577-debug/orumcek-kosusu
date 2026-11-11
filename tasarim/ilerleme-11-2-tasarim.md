# 11.2 tasarım devri — inceleme düzeltmesi, 2026-11-11

Tasarım ve altı prototip düzeltildi. Oyun uygulaması yapılmadı; commit yok. Yazılan dosyalar yalnız11-2-*.md, proto/11-2-* ve bu nottur. Önceden var olan oyun/tools/HARITA/11.3/11.5 değişiklikleri bu çalışmanın parçası değildir.

## Bulguların sonucu (ilk incelemedeki numaralar)

| # | Düzeltme | Hesap / kanıt |
|---|---|---|
|1 blocker|Yardımda <=400 motion28, h3 19/20; kuyruk için6px alt pay. Paneller kırpmıyor; büyük ×2 artık32. Dört sayfanın tüm panelleri kontrol ediliyor.|360: iç534−(30+16+32+44+32)=380; (380−8)/2=186; border6+padding22 sonrası158; panel1 içerik153<=158.490:599−154=445, satır218.5/iç190.5; en çok153. Yatay:112px ray,596px kâğıt, panellerin içi153; en çok139. Aşağıdaki tablo diğer sayfaları da gösterir.|
|2 blocker|Yatay anlatı52px, y44, dönüş yok. İki satır için38px gerçek içerik; gölge de bant içinde.|52−6−8=38=2×19.740: kopya445, yaklaşık470px hediye iki satır; alt44+52+3=99<100.360/490 portre54−6−10=38.320/280:234 bant,92 kutu,76 içerik/four19px lines.|
|3 bug|Ana menü özgün görev kartıyla açık. Yatay üç sütun; yardım tam genişlikte. Ad alanı60:14+2+44; girişin kendisi de44px.|360 menü:716−64−296−200−24=132 kahraman alanı.490:781−64−296−200−24=197.740:140+12+296+12+256=716;296px kontrol gereksinimi336'ya sığar; yardımın içerik alanı250px, tahmini yazı159px.|
|4 bug|Yatay çarpan40 (içi36>=×12 için28.05). Olay etiketi y43..59; güçler y8..40; etiket sağ ucu178, anlatı solda180. Portrede etiket için çarpan92 genişletildi.|360/490 portre olay etiketi87.2<=92, y46..62; güç64'te başlar. Yatayda ne güçlere ne anlatı simgesine değer.320/280 dar skor/altın sütunları ayrıca tanımlı.|
|5 bug|Karşıdan konumlanan iki dock grubu kaldırıldı; dört sütunlu grid. Dar genişlikte ilk üç hedef44, yetenek en az100.|360:336−288=48 =>üç16px aralık.490:(466−288)/3=59.33.740:(716−288)/3=142.67.320:(296−244)/3=17.33.280:256−132−100=24 =>üç8px aralık.|
|6 bug|Dokuzuncu görsel yuva yok. Kapasite en çok8; fazlada ilk kapasite−1 + '+N'. Maket düğmesi gerçekten9 aktif güce geçer. Gizli simge/halka1500ms dönüşür; duraklatmada tüm adlar/süreler.|360:7+2;312<=328.490:312<=458.740:312<=496.320:6+3;272<=288.280:5+4;232<=248.12 aktifte360:7+5. Reduced-motion sabit gizli simge ve sayaç; pause dönüşü durdurur.|
|7 bug|stage-note ve blocked yetenek krem yazı,2px mürekkep kontur; sahne üzerinde12px etiket.|Okuma sınırı krem/mürekkep çiftidir; zayıf gri/sahne dolgusu artık metin sınırını belirlemez. Gerçek sahne üzerinde kontrol hâlâ telefonda.|
|8 polish|Görünür metin >=12; mini rozet düğmeleri kaldırıldı. Giriş dahil hedefler >=44.100ms yalnız opacity fallback; empty-shake0/100 dönüşü; gerçek SVG r18/C113.097. Kostüm AĞDA, ANLATICI/YENİ BÖLGE!, kullanılmış hediye şeridi çizildi.|Beş districtEnter satırı 'arrives with stage11.3', disabled/unbound. Goblin kapısı ve11.5 görev13 bağımlılığı görev listesinde; eventKind+eventTime kenarını izleyen UI adaptörü aynı hint ID'sine fallback. İkisi de yoksa ipucu/seen üretmez.|

## Hesaplanan yardım içerik / kullanılabilir yükseklik (px)

| Boyut | Sayfa1 | Sayfa2 | Sayfa3 | Sayfa4 |
|---|---:|---:|---:|---:|
|360×740|153 /158|135 /158|156 /177|145.5 /184|
|490×805|153 /190.5|140 /190.5|142.8 /209.5|165.5 /216.5|
|740×360|139 /153|125 /153|142 /167|126 /153|

320 ve280 portrede yardım tek sütun ve yalnız sayfa kaydırması; menü gerekirse kayar ve kart hep açık; karakter başlığı iki satır, levha352, hücreler61.25/51.25×68 ve yüz44; market satırları116/132, liste kayar. HUD7/6 yuva ve234px bant kullanır. Güvenli alanlar0 kabul edildi. Daha dar yatay HUD234px yığılı düzene döner; menü yatay kaydırılır. Metin büyütmede/güvenli alanlarda içerik kaydırılır, hedefler küçülmez.

## Sahip kararı ve neden

Görev kartı artık onay sorusu değildir: index.html'deki card/mission-card/ms-* yapısı, ui.css'deki Bangers/starburst/TAMAM stili ve paintMissions çıktısı korunacak. GÖREVLER · SET n · xN başlığı kalır. Yalnız boşluklar ve kısa ekran başlığı sıkışır. Kartı yeniden tasarlamak, küçük üç rozetli özete çevirmek veya listeyi başka pencerede saklamak yasaktır. Prototip örnekleri mevcut missionText kalıplarıdır; hedef verisini değiştirmez. Tuşlar oyunun mevcut .btn stilini alır; yeni kenarlık/gölge ailesi üretilmez.

Simgeler artık boş yer değildir: mıknatıs, his, kalkan, jet, kukla, iz, yıldırım vb. inline SVG; kahraman/surat CSS çizimidir. Her sayfada bir12px temsili çizim etiketi bulunur. Bunlar oyunun kodla çizilen simge/3B modellerinin yer tutucusudur; oyun varlıklarını değiştirme kararı değildir.

## Kontrol kanıtı ve sınırı

node tasarim/proto/11-2-check.mjs geçti: altı sayfa/bağlantı/ID,11 karakter,4 yardım sayfası,14 market satırı, JS sözdizimi, CSS kaynak ve breakpoint koşulları; dört yardım sayfasının kelime-satır tahminleri ve42 ipucu satırı; gerçek powerPlan ile0/1/8/9/12/20 güç, üç hedef ve320/280; dock44px alt sınırı, eksik durumlar ve oyun düğme/kart sınıfları. İlk iki blocker'ın eski CSS değerleri bellekte geri konduğunda denetim beklendiği gibi reddeder. node --check proto JS de geçer.

**Tarayıcı açılmadı. Bütün ölçüler hesaplandı, görülmedi.** Bangers genişliği karakter×.55×punto (+gerçek CSS harf aralığı), Baloo×.5 varsayımıdır. Bu betik DOM/glyph/screenshot ölçmez. Prototip sayaçları sabit fixture değerleridir; üretim zamanlayıcısı/seen/gift mantığı uygulanmadı. Oyun regresyonları ve gerçek donanım performansı çalıştırılmadı.

## Kalan iş / sahibin yeniden bakacağı yerler

1. Telefonda ana menüyü yeniden aç: özgün üç görev/yıldız rozetler, büyük yazı, ad girişi, aynı düğme hissi;360×740 ve740×360.
2. Yardımın dört sayfasını hem yönde oku: özellikle sayfa1 başlığı/konuşma kuyruğu ve sayfa3/4 alt metinleri.490×805 ve varsa320/280 dar görünümü de dene.
3. Anlatıda en uzun hediye/refill, ANLATICI ve YENİ BÖLGE! örneklerine bak; bölge örneği yalnız görsel demo,11.3 entegrasyonu değildir.
4. HUD'da9 gücü aç, duraklatıp tümünü oku; BOŞ/AKTİF/BİRAZDAN/KOSTÜM AĞDA ve HEDİYE durumlarını dene. Sistem azaltılmış hareket ayarında100ms fade, konturlu metin ve çentik payını gözle kontrol et.
5. Kodlayıcı daha sonra11.2-gorevler sırasını uygular. Gerçek kamera/yol görüşü, kayıt/gift koruması, özel güç süreleri ve11.5 görev13/Goblin ile11.3 bölge adaptörü ayrı uygulama kabulüdür.

## Devralan neyi yeniden yapmamalı

Özgün görev kartı kararını açma. Oyun koduna bu tasarım düzeltmesi adına müdahale etme. İkinci anlatı/sıra/mission ekranı, yeni görsel dosya/kütüphane veya sahte districtEnter emiteri ekleme. Tasarım indeksini ve görev listesini oku; tüm repoyu yeniden keşfetme. Hesap geçmesini telefon onayı diye yazma; önceki kullanıcı değişikliklerini geri alma. İnceleme raporunun eski satır/toplamları tarihsel kanıt olarak bırakıldı; bu not ve güncel reçeteler düzeltilmiş durumu tarif eder.
