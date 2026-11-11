# 11.3 ek: Chinatown'a çince tabelalar, flamalar ve ejderha

Oğuzhan'ın 2026-11-11 isteği; tasarım yöneticinin. Chinatown'un bugünkü tasarımına (`11-3-bolgeler.md`, `11-3-canli-ayrintilar.md`, görev 10'un festival süsü) **eklenir**, onu değiştirmez. Görev 10 aynı şeyden (fener, flama) birini zaten kuruyorsa ikincisi kurulmaz: onunki bu belgeye göre genişletilir.

## Kesin kurallar

- **Hiçbiri engel değil.** Chinatown'a yeni engel konmaz (Oğuzhan'ın onayladığı varsayılan). Ejderha, flama, tabela yalnız görüntüdür: çarpışma yok, `tools/check-patterns.mjs` değişmez.
- Flamalar ve ejderha, oyuncunun en yüksek zıplama/uçuş tepesinin **en az 1 m üstünde** ya da korkuluk ötesindedir. Hiçbir zaman bir şeridin, bir engelin, bir altının ya da bir uyarının önünü kapatmaz.
- Yalnız Chinatown'da görünür; başka bölgede `visible = false` (sıfır çizim çağrısı). Yükte bir kez kurulur, ısınmada (warm-up) derlenir. Koşu sırasında doku/malzeme üretimi yok, kare başına bellek ayırma yok.
- Bütçe (Oğuzhan'ın kararıyla genişletildi; hedef iPhone 11 ve üstü: 150 çizim çağrısı, 250k üçgen, +60 MB doku) aşılmaz. Bu ekin payı: **en çok 14 çizim çağrısı, 32k üçgen, 4 MB doku.** Sığmazsa aşağıdaki "kesme sırası"na uyulur ve ilerleme dosyasına yazılır.

## 1. Tabelalardaki küçük kareler: çince karakterler

Chinatown binalarındaki tabelaların içindeki küçük karelere birer karakter yazılır. Kırmızı (`0xc8102e`) zemin üzerine altın (`0xf6c445`), ya da altın zemin üzerine kırmızı; ikisi tabeladan tabelaya karışık.

**Karakterler fontla değil, fırça vuruşlarıyla çizilir.** Telefonda çince yazı tipi olmayabilir, o zaman kutucuk (tofu) çıkar. Her karakter 10×10'luk bir ızgarada vuruş listesidir. Canvas'ta `lineCap = 'round'`, `lineJoin = 'round'`, çizgi kalınlığı 1,1 ızgara birimi. Eğik vuruşlar `quadraticCurveTo` ile hafifçe kavislidir (kontrol noktası, düz çizginin ortasından 0,6 birim dışarı). Hepsi yükte bir kez, tek bir doku atlasına (8 hücre) çizilir. Tabela dokusu bu atlastan kopyalanır ya da UV ile okunur, kod tabanının tabelaları nasıl kuruyorsa öyle.

| Karakter | Anlamı | Vuruşlar (x,y; y aşağı doğru artar) |
|---|---|---|
| 大 | büyük | yatay (1,4)→(9,4); sola düşen (5,1)→(1,9) kavisli; sağa düşen (5,4)→(9,9) kavisli |
| 吉 | uğur | yatay (1.5,2)→(8.5,2); dikey (5,0.5)→(5,4.5); yatay (3,4.5)→(7,4.5); dikdörtgen (2.5,6)→(7.5,9.5) |
| 中 | orta | dikdörtgen (2,3)→(8,7); dikey (5,0.5)→(5,9.5) |
| 山 | dağ | dikey (5,1)→(5,8); dikey (1.5,4)→(1.5,8); dikey (8.5,4)→(8.5,8); yatay (1.5,8)→(8.5,8) |
| 日 | güneş | dikdörtgen (2.5,1)→(7.5,9); yatay (2.5,5)→(7.5,5) |
| 王 | kral | yatay (2,1.5)→(8,1.5); yatay (2.5,5)→(7.5,5); yatay (1,8.5)→(9,8.5); dikey (5,1.5)→(5,8.5) |
| 火 | ateş | nokta (2,3)→(3,4.5); nokta (8,3)→(7,4.5); sola düşen (5,1)→(1.5,9.5) kavisli; sağa düşen (5,5)→(9,9.5) kavisli |
| 木 | ağaç | yatay (1,3.5)→(9,3.5); dikey (5,0.5)→(5,9.5); sola düşen (5,3.5)→(1,8.5); sağa düşen (5,3.5)→(9,8.5) |

Tabelalar karakteri tohumla (seed) seçer; yan yana iki kare aynı karakteri almaz. Çok kareli tabelalar öncelikle anlamlı ikilileri yazar: **大吉** (büyük uğur), **中山** (bir sokak adı), **山王**.

## 2. Kırmızı flamalar (yolun üstünden geçen)

- Tavandaki fener dizilerinin arasında, yaklaşık her 2. fener dizisinin ortasında, yolun bir yanından öbür yanına bir ip gerilir ve ipe yatay bir flama asılır.
- Flama: kırmızı `0xc8102e` kumaş, 0,9 m yüksek, yolun tüm genişliği artı her yanda 0,5 m. Üst kenarı ipte; alt kenarı 5 dişli kırlangıç kuyruğu (üçgen kesikler, 0,2 m derin). Altın `0xf6c445` 0,06 m kenar şeridi.
- Ortasında dört karakter **大吉大吉**, altın renkte, flama yüksekliğinin %70'i boyunda, aralarında bir karakterlik yarım boşluk. Atlas dokusundan okunur.
- İp: koyu `0x3a2a1a`, ortası 0,25 m sarkık.
- Yükseklik: mevcut fenerlerle aynı askı yüksekliği. Flamanın alt ucu, oyuncunun en yüksek tepesinin en az 1 m üstündedir. Bu sağlanamıyorsa flama da fenerler kadar yükselir.
- Hareket: her flama kendi ekseni etrafında ±3°, 0,7 Hz, örnekten örneğe faz kayık. Yalnız örnek matrisi değişir.
- Tek `InstancedMesh`: bir çizim çağrısı. Atlas dokusu tabelalarla ortaktır.

**Duvar flamaları (dikey):** Bina cephelerinde, birinci-ikinci kat hizasında, ara sıra (her binanın %40'ında) dar dikey kırmızı flamalar asılır: 0,5 × 2,2 m. Üstten alta üç karakter, alt ucunda altın püskül (küçük koni, 0,2 m). Aynı atlas, aynı `InstancedMesh` ailesi.

## 3. Ejderha

Referans: Oğuzhan'ın yolladığı ejderha dansı fotoğrafları. Oyunun diğer modelleri gibi Funko ve çizgi roman tarzında: iri göz, kalın hatlar, toon malzeme (`getToonGradient`), modellerdeki mürekkep dış çizgi (`INK`) yöntemi. Hepsi koddan, model dosyası yok.

### 3a. Renkler

| Ad | Renk | Nerede |
|---|---|---|
| kırmızı | `0xd62828` | kafa, gövde |
| koyu kırmızı | `0xa4161a` | dil, ağız içi |
| altın | `0xf6c445` | boynuz, dudak şeridi, yele, pullar |
| turuncu | `0xf08c00` | yele ara dilimleri, pul gölgesi |
| mavi | `0x2546a8` | kaş/yanak yamaları |
| beyaz | `0xfff8e7` | dişler, göz akı, sakal |
| siyah | `0x111111` | göz bebeği, burun delikleri |
| tahta | `0x7a4a21` | sopalar |

Çok renkli parçalar, yükte tek geometride birleştirilir (köşe rengi ya da küçük renk paleti dokusu: kod tabanı hangisini kullanıyorsa). Böylece kafa 1, çene 1, gövde 1, sopa 1 çizim çağrısıdır.

### 3b. Kafa (boyu ~1,6 m; ölçüler metre, kafanın kendi ekseninde, +z ileri)

- **Kafatası:** köşeleri yuvarlatılmış kutu 1,0 g × 0,8 y × 1,1 d, kırmızı.
- **Burun:** kutu 0,8 × 0,45 × 0,55, kafatasının önünde (z +0,75), 0,1 aşağıda. Üst kenarında altın dudak şeridi (0,82 × 0,06 × 0,58).
- **Burun delikleri:** iki siyah küre, r 0,06, burnun üstünde, x ±0,18.
- **Alt çene (ayrı parça):** kutu 0,72 × 0,16 × 0,8, menteşesi kafatasının alt-arka kenarında. 25° açık durur; dans ederken ±10°, 0,6 Hz açılıp kapanır. İçi koyu kırmızı.
- **Dil ve inci:** koyu kırmızı yassı kutu 0,3 × 0,05 × 0,5, alt çenenin içinde. Ağzın ortasında altın küre r 0,1.
- **Dişler:** beyaz koniler (r 0,05, boy 0,13, 4 kenar). Üst dudakta 6, alt çenede 6, aşağı/yukarı bakar.
- **Gözler:** iki beyaz küre r 0,22, kafatasının üst-yan köşelerinde (x ±0,32, y +0,3, z +0,35), dışarı taşkın. Önlerinde mavi iris diski r 0,13, onun önünde siyah bebek r 0,065. Üstlerinde altın göz kapağı: yarım torus, r 0,22, kalınlık 0,04.
- **Boynuzlar:** iki altın silindir r 0,06, boy 0,6, kafatasının üstünden (x ±0,25) çıkar, 30° geriye ve 15° dışa yatık. Her birinin ortasından 45° yukarı açılan 0,3 m'lik bir dal.
- **Alın ponponları:** iki ince sap (silindir r 0,015, boy 0,25), ucunda kırmızı küre r 0,08 (`0xe11d48`), gözlerin arasından öne eğik.
- **Yele:** kafanın arkasında yelpaze gibi açılan 10 yassı dilim (yassılaştırılmış koni, 0,45 boy). Altın ve turuncu sırayla, her birinin ucunda küçük mavi yama.
- **Kaş/yanak yamaları:** gözlerin üstünde ve yanaklarda mavi yassı kubbeler (küre 0,18, z ekseninde 0,3 basık), beyaz 0,02 kenarlı.
- **Sakal:** çenenin altından sarkan 7 ince krem koni (r 0,03, boy 0,35), hafif arkaya yatık.
- Üçgen hedefi: dans ejderhasının kafası ≤ 3.000, duvar kafası (aşağıda) ≤ 1.400. K9'un bütün parçaları bulunur, hiçbiri silinmez; üçgeni azaltan tek şey K9'daki düşük segment sayılarıdır. (Sınır önce 900'dü, sonra 1.000'e çıktı; zorunlu parçalarla tutmadığı için yönetici 1.400 yaptı.)

### 3c. Gövde ve kuyruk

- 12 halka, her biri `CylinderGeometry(0.42, 0.42, 0.7, 12, 1, true)`, kırmızı, tek `InstancedMesh`.
- Pul dokusu (yükte bir kez, 256×256): kırmızı zemin üzerinde üst üste binen yarım daire pullar, altın dolgu, turuncu iç gölge, `0x7a1010` ince kontur. Her halkanın alt kenarında sarı (`0xffd23f`) saçak şeridi: dokunun alt %12'si dikey çizgilerle.
- Son 3 halka kuyruğa doğru incelir: yarıçap ×0,8, ×0,6, ×0,4. En sonda altın kuyruk yelpazesi: 5 yassı koni, 0,5 m.
- **Sopalar:** her iki halkada bir, halkanın altından aşağı inen tahta silindir (r 0,04, boy 2,2). Alt uçları korkuluğun arkasında kaybolur; taşıyanlar görünmez. Tek `InstancedMesh`.

### 3d. Ejderha dansı (asıl gösteri)

- Her Chinatown geçişinde bir kez, bölgenin ilk üçte birinde, yolun sol ya da sağ yanında (tohumla seçilir), **korkuluğun ötesinde.** Ejderha yolun dışındadır ve hiçbir şeridin üstüne taşmaz.
- Yerinde dans eder; oyuncu yanından geçer. Ejderha yol boyunca ~10 m uzanır. Gövde, kafayı izleyen bir dalga çizer: halka i için
  - yükseklik = taban + 0,35·sin(4t − 0,6i)
  - yanal = 0,2·sin(2t − 0,5i)
  
  Taban, halkanın altı korkuluk tepesinden 1,2 m yukarıdadır. Kafa da aynı dalgayla sallanır ve çenesini açıp kapar.
- Her halka komşusuna doğru döner (bir öncekine bakar), böylece gövde kopuk değil, kıvrık görünür.
- Yol virajlıysa yerleşim, kod tabanının şehir parçalarını yola nasıl oturttuğuna (`curve` / `rAt`) göre yapılır.
- Görünürlük: oyuncu dansın 60 m önüne gelince görünür olur, 15 m arkasında kalınca gizlenir.

### 3e. Duvarda asılı ejderhalar: KALDIRILDI (yönetici, 2026-11-11)

Bütün parçalarıyla kafa 3.652 üçgen tuttu; ne 900'e, ne 1.000'e, ne 1.400'e sığdı. Parça silerek sığdırma denemeleri de ejderhayı bozdu. Ejderha maskotunu dans ejderhası taşır. 3e, K9 ve kesme sırasının 1-2. adımları geçersizdir. Kod, CONFIG ve testlerde duvar ejderhasından hiçbir şey kalmaz. Aşağıdaki eski metin yalnızca kayıt için duruyor.

### (eski) 3e. Duvarda asılı ejderhalar (ara sıra)

- Chinatown binalarının yaklaşık her 4'ünde 1'inde, yola bakan cephede, ikinci kat hizasında, duvara asılı bir ejderha kafası. Hafif öne eğik, ağzı 20° açık, hareketsiz.
- Arkasından cephe boyunca S biçiminde sarkan **4 halkalık** kısa gövde. Gövde yine kuyruk yelpazesiyle biter.
- Kafa basit sürümdür (≤ 900 üçgen): göz, boynuz, diş ve sakal sayısı yarıya iner, yele 6 dilim.
- Kafa bir `InstancedMesh`, halkalar dans ejderhasının halka `InstancedMesh`'ini paylaşır (örnek sayısı artar, çizim çağrısı artmaz).

## Kesin kararlar (yukarıdaki her "ya da", "yaklaşık", "kod tabanı hangisini" ifadesinin yerine geçer)

Bu bölüm yukarıdakiyle çelişirse bu bölüm geçerlidir. Burada yazmayan bir seçim çıkarsa: önce onaylı prototipteki değer, o da yoksa en küçük seçenek alınır ve ilerleme dosyasındaki "Kendi kararlarım" başlığına bir satır yazılır. Listede olmayan hiçbir şey eklenmez, listedeki hiçbir şey atlanmaz.

**K1. Malzemeler.** Tam olarak üç yeni malzeme, yükte bir kez kurulur:
- `dragonMat = new MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() })`: kafa, çene, kuyruk yelpazesi, sopa.
- `scaleMat = new MeshToonMaterial({ map: pulDokusu, gradientMap: getToonGradient() })`: gövde halkaları.
- `glyphMat`: tabela ve flamalar için atlas dokulu malzeme. Tabelaların bugünkü malzeme türüyle aynı tür, `alphaTest: 0.5`.

Her parçanın rengi, birleştirmeden önce geometriye köşe rengi olarak yazılır (3a'daki tablodan). Kafanın parçaları `BufferGeometryUtils.mergeGeometries` ile tek geometri olur. Bu fonksiyon projede yoksa parçaları elle tek `BufferGeometry`'ye eklemek için 20 satırlık bir döngü yazılır.

**K2. Yuvarlak kutular.** "Köşeleri yuvarlatılmış kutu" yazan her yer elipsoittir: `SphereGeometry(0.5, 16, 12)` verilen g × y × d ile ölçeklenir (kafatası 1,0 × 0,8 × 1,1; burun 0,8 × 0,45 × 0,55). Alt çene, dil, dudak şeridi düz `BoxGeometry`'dir.

**K3. Yele.** 10 dilimin her biri `ConeGeometry(0.12, 0.45, 4)`, z'de 0,3 ile basılır. Dilim k (0..9):
- kafa eksenine dik düzlemde, z = −0,45'te, eksenden 0,45 uzaklıktadır;
- açısı θ = −135° + 30°·k, +y'den z ekseni etrafında ölçülür (alt kısım boş kalır, sakal orada);
- ucu dışa bakar ve 30° geriye (−z) yatıktır;
- rengi çift k'da altın, tek k'da turuncu;
- ucunda mavi küre r 0,05.

**K4. Atlas.** Tek canvas, 1024 × 256:
- 1. satır: 8 hücre (128 × 128), kırmızı zemin üzerinde altın karakter.
- 2. satır: aynı 8 karakter, altın zemin üzerinde kırmızı.
- Karakter hücrenin %80'i büyüklüğünde, ortada. Izgara birimi = hücre × 0,08.

Flama dokusu ayrı bir canvas, 1024 × 128: kırmızı zemin, 0,06 m'ye karşılık gelen altın kenar, 大吉大吉 altın. Kırlangıç kuyruğu dişleri saydam çizilir (`alphaTest` keser). Duvar flamaları 128 × 512 dikey canvas: üç karakter alt alta, tohumla seçilmiş 3 karakterin 4 sabit dizilişinden biri.

**K5. Tabelalar.** Chinatown tabelalarının kod tabanındaki her kare hücresine bir karakter. Kurulum sırasında hücrenin UV'si atlas hücresine ayarlanır. Karakter `hash(segmentId, tabelaNo, hücreNo) % 8` ile seçilir; komşu hücre aynı çıkarsa bir sonraki karakter alınır. Renk düzeni tabela başına `hash % 2`. İki ve üç hücreli tabelalar sırayla 大吉 / 中山 / 山王 yazar (`hash % 3`).

**K6. Yatay flamalar.** Kod tabanındaki tavan fener dizilerinden her 2.'sinin ardından, o diziyle bir sonraki dizinin tam ortasında bir flama. Fener dizisi yoksa her 24 m'de bir.
- Flamanın üst kenarı fener ipinin yüksekliğinde.
- Assert: alt kenarı ≥ CONFIG'deki en yüksek oyuncu tepesi + 1,0 m. Tutmazsa bütün flamalar ve onların fenerleri birlikte gerektiği kadar yükseltilir. Yalnız flama yükseltilmez; ip havada kalır.

**K7. Duvar flamaları.** Chinatown binalarının `hash % 10 < 4` olanlarına birer tane.
- Yola bakan cephede, cephe genişliğinin `0,2 + 0,6·(hash/2³²)` oranındaki yatay noktada.
- Üst ucu binanın tabanından 6,0 m yukarıda, duvardan 0,1 m önde.
- Püskül `ConeGeometry(0.06, 0.2, 6)`, altın, flamanın alt ucunun ortasında, tepesi yukarı.

**K8. Dans ejderhasının yeri.**
- Kafa, döngünün `1700 + (seed % 100)` metresinde. Taraf: `seed % 2 === 0` ise sol, değilse sağ.
- Yanal konum: şeridin ve korkuluğun dış yüzünün 1,0 m ötesi. Değer CONFIG'e `dragon.sideOffset` olarak, korkuluğun dış yüzünden ölçülerek yazılır.
- Yola oturtma: şehrin yan parçalarını yola oturtan fonksiyon (HARITA.md'de) kullanılır; yeni yerleştirme kodu yazılmaz.
- Kafa koşucuya doğru bakar (−ileri yön); gövde ileriye doğru uzanır. Oyuncu önce yüzü, sonra gövdeyi görür.
- Halkalar arası 0,75 m. Halka i'nin ekseni, i−1'in konumuna bakar (i = 0'ın bir öncekisi kafanın arka noktasıdır).

**K9. Duvar ejderhası.** Ana kafanın yarı detaylı sürümü, ölçek 0,7. Ana kafayla aynı parçalar, şu farklarla:
- göz 2, ama iris ve bebek tek disk;
- boynuz dalsız;
- 4+4 diş, 4 sakal, 6 yele dilimi.

Dudak şeridi, burun delikleri, dil, inci, ponponlar, yamalar, göz kapakları ve yele uçları **kalır**.

Düşük segment: bütün küre ve elipsoitler `SphereGeometry(r, 10, 8)`, silindirler 6 kenar, torus `(r, tüp, 4, 8)`, koniler 4 kenar.
- 4 halka (ölçek 0,7) cephe düzleminde, kafaya göre (cephe boyunca, aşağı): (0,8, −0,3), (1,5, −0,1), (2,2, −0,4), (2,9, −0,2) m.
- Kuyruk yelpazesi (3,5, −0,3) m'de.
- Seçim: `hash % 4 === 0` olan binalar, ikinci kat hizası = binanın tabanından 4,5 m.

**K10. Yasaklar.** Ejderha, flama ve tabelaya çarpışma kutusu verilmez. `tools/check-patterns.mjs` ve `src/patterns.js` bu iş için değişmez. Kare başına yalnız örnek matrisleri ve çenenin açısı güncellenir; `new` yok. Matrisler önceden ayrılmış `Matrix4` / `Vector3` / `Quaternion` nesneleriyle hesaplanır.

## Kesme sırası (bütçeye sığmazsa, bu sırayla)

0. Kesme sırasına yalnız sahnenin toplamı tavanı (150 çağrı / 250k üçgen / +60 MB) aşarsa geçilir. Ekin kendi payını aşmak tek başına kesme sebebi değildir; yalnız ilerleme dosyasına yazılır.
1. Duvar ejderhalarının sıklığı 4'te 1'den 6'da 1'e.
2. Duvar ejderhalarının gövdesi kalkar, yalnız kafa kalır.
3. Dans ejderhasının halka sayısı 12'den 9'a.
4. Dans ejderhasından dış çizgi kalkar.

Çince tabelalar ve flamalar kesilmez.

## Kabul

- `?gun=` ile Chinatown'a girildiğinde: tabela karelerinde karakterler; yolun üstünde 大吉大吉 yazılı kırmızı flamalar; bir kez ejderha dansı; ara sıra duvar ejderhası.
- Başka bölgede bunların hiçbiri görünmez ve çizim çağrısı eklemez.
- Yeniden başlatma, oyun sonu ve menü hiçbir şey bırakmaz.
- Assert kontrolleri: karakter atlasında 8 hücre dolu; aynı tabelada yan yana aynı karakter yok; flama alt ucu ≥ en yüksek oyuncu tepesi + 1 m; dans ejderhasının hiçbir halkası şerit sınırının içine girmiyor (dalganın en uç noktasında da); Chinatown dışında ejderha/flama `visible` false.
