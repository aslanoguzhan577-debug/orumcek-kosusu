// tasarim/proto/11-3-mansetler.js — the Daily Bugle headline catalogue of stage 11.3 and the pure
// rules that choose them (see tasarim/11-3-bugle.md). No three.js, no DOM: the coder moves this
// file to src/bugle-logic.js unchanged and tests it from tools/test-skills.mjs.
// {N} = player name (upper case, tr-TR), {X} = the run's mission multiplier, {B} = best score.

// [kicker, headline, sub line, photo]
export const HEADLINES = {
  generic: [
    ['SON DAKİKA', '{N} YİNE KAÇTI!', 'Venom eli boş döndü · Sayfa 3', 'spidey'],
    ['TEHLİKE', 'VENOM AÇ KALDI', 'Uzmanlar: "Koşun" diyor', 'venom'],
    ['BAŞYAZI', 'ÖRÜMCEK: TEHDİT Mİ, TEHLİKE Mİ?', 'Jameson: "İkisi de!"', 'spidey'],
    ['ÖZEL HABER', 'RAYLARDA KOŞAN ADAM KİM?', 'Biletsiz yolculuk skandalı büyüyor', 'spidey'],
    ['SKANDAL', '{N} BİLET ALMADI!', 'Metro idaresi şokta', 'spidey'],
    ['EKONOMİ', 'ALTINLAR NEREYE GİDİYOR?', 'Bugle soruyor, {N} susuyor', 'spidey'],
    ['TRAFİK', 'MASKELİ KOŞUCU TRAFİĞİ FELÇ ETTİ', 'Makinist: "Yine mi o?"', 'spidey'],
    ['JAMESON', 'FOTOĞRAF İSTİYORUM!', 'Genel yayın yönetmeni masaya vurdu', 'spidey'],
    ['RÖPORTAJ', 'VENOM: "ÇOK HIZLI"', 'Simbiyot ilk kez konuştu', 'venom'],
    ['ANKET', '{N} NE ZAMAN DURACAK?', 'Şehrin yüzde 97\'si: "Durmasın"', 'spidey'],
  ],
  chase: [   // remaining score to the record: <= 5000, <= 1000, <= 100
    ['CANLI', 'REKORA 5.000 KALDI', 'Jameson tırnak yiyor', 'spidey'],
    ['CANLI', 'REKORA 1.000 KALDI!', 'Jameson kahvesini döktü', 'spidey'],
    ['BASKI DURDU', 'REKOR BİR ADIM ÖTEDE!!', 'Manşet hazır, mürekkep bekliyor', 'spidey'],
  ],
  broken: [
    ['ÖZEL BASKI', 'REKOR PARAMPARÇA!', '{N} tarihe ağ attı', 'spidey'],
    ['ÖZEL BASKI', 'ESKİ REKOR ÇÖPE GİTTİ', 'Yenisi hâlâ yazılıyor', 'spidey'],
  ],
  first: [['YENİ YÜZ', 'KİM BU ÇAYLAK: {N}?', 'İlk koşu, ilk sayfa', 'spidey']],
  stumble: [
    ['REZALET', 'SENDELEDİ! FOTOĞRAFI BİZDE', 'Görgü tanığı: "Güldüm"', 'spidey'],
    ['REZALET', '{N} TÖKEZLEDİ, VENOM GÜLDÜ', 'Simbiyot keyifli', 'venom'],
    ['SİGORTA', 'AYAĞI TAKILDI: SİGORTA ÖDEMİYOR', 'Poliçede "ray" yazmıyor', 'spidey'],
  ],
  mult: [
    ['EKONOMİ', 'x{X} ÇARPAN: EKONOMİ SARSILDI', 'Altın fiyatları {N}\'e bağlı', 'spidey'],
    ['EKONOMİ', 'x{X}! MERKEZ BANKASI TOPLANDI', 'Faiz kararı: "Koşsun"', 'spidey'],
  ],
  night: [
    ['GECE BASKISI', '{N} GECEYİ GÖRDÜ!', 'Şehir uyuyor, o koşuyor', 'spidey'],
    ['GECE BASKISI', 'GECE YARISI KOŞUCUSU: {N}', 'Komşular: "Ses yapmıyor"', 'spidey'],
    ['GECE BASKISI', 'UYKU YOK, ALTIN ÇOK', 'Yastık üreticileri tedirgin', 'spidey'],
  ],
  loop: [
    ['SABAH BASKISI', '{N} SABAHI ETTİ', 'Annesi merakta', 'spidey'],
    ['2. GÜN', 'İKİNCİ GÜN: HÂLÂ KOŞUYOR', 'Bugle muhabiri yoruldu', 'spidey'],
    ['SABAH BASKISI', 'EVE GİTMEYEN KAHRAMAN', 'Venom da gitmiyor', 'venom'],
  ],
  skin: {    // key = spidey.skin id; unknown ids fall back to `spider`
    spider: ['MAHALLE', 'DOST CANLISI MI? HİÇ SANMIYORUZ', 'Mahalleli ikiye bölündü', 'spidey'],
    kitty: ['MODA', 'PEMBE TEHLİKE RAYLARDA!', 'Fiyonklu şüpheli aranıyor', 'spidey'],
    gwen: ['MAGAZİN', 'BEYAZ KAPÜŞONLU KİM?', 'Bale mi, kaçış mı?', 'spidey'],
    miles: ['ŞOK', 'İKİ ÖRÜMCEK Mİ VAR?!', 'Jameson: "Biri bile fazlaydı"', 'spidey'],
    raimi: ['NOSTALJİ', '2002\'DEN GELEN ADAM', 'Eski usul ağ, yeni usul kaçış', 'spidey'],
    mcu: ['İŞ DÜNYASI', 'STAJYER İŞE GEÇ KALDI', 'Bay Stark yorum yapmadı', 'spidey'],
    ironman: ['CEMİYET', 'MİLYARDER TRENE BİNDİ', 'Limuzin bozuldu mu?', 'spidey'],
    panther: ['DIŞ HABERLER', 'KRAL RAYLARDA', 'Wakanda\'dan resmî ziyaret', 'spidey'],
    batman: ['YANLIŞ ADRES', 'YANLIŞ ŞEHİR, YARASA!', 'Gotham treni çoktan kaçtı', 'spidey'],
    cap: ['ULAŞIM', 'KAPTAN, KALKAN BİLET DEĞİL', 'Kondüktör kararlı', 'spidey'],
    hulk: ['BELEDİYE', 'RAYLAR DAYANIR MI?', 'Endişe büyük: 5 ton yeşil', 'spidey'],
  },
};

// The 16 atlas slots (2048 x 1024, slot i at x = (i % 4) * 512, y = floor(i / 4) * 256).
export const SLOT = { G1: 0, G2: 1, G3: 2, WANTED: 3, TOP5: 4, CHASE5K: 5, CHASE1K: 6, CHASE100: 7, BROKEN: 8, STUMBLE: 9, MULT: 10, SKIN: 11, NIGHT: 12, LOOP: 13, G4: 14, VENOM: 15 };

const fill = (row, v) => row.map((t, i) => (i === 3 ? t : t.replaceAll('{N}', v.name).replaceAll('{X}', String(v.mult)).replaceAll('{B}', v.best.toLocaleString('tr-TR'))));
const at = (list, n) => list[((n % list.length) + list.length) % list.length];

// What every slot shows for this player. runs = number of finished runs (rotates the jokes).
// Returns 16 entries: { type: 'page', row } | { type: 'wanted' } | { type: 'top5' }.
export function buildSlots({ name, best, mult, skin, runs }) {
  const v = { name, best, mult };
  const H = HEADLINES, page = (row) => ({ type: 'page', row: fill(row, v) });
  const gen = [0, 2, 3, 4, 5, 6, 7, 9];                    // generics without the two Venom ones
  const s = new Array(16);
  s[SLOT.G1] = page(H.generic[at(gen, runs)]);
  s[SLOT.G2] = page(H.generic[at(gen, runs + 3)]);
  s[SLOT.G3] = page(H.generic[at(gen, runs + 5)]);
  s[SLOT.G4] = page(H.generic[at(gen, runs + 6)]);
  s[SLOT.VENOM] = page(H.generic[runs % 2 ? 8 : 1]);
  s[SLOT.WANTED] = best > 0 ? { type: 'wanted' } : page(H.first[0]);
  s[SLOT.TOP5] = { type: 'top5' };
  s[SLOT.CHASE5K] = page(H.chase[0]); s[SLOT.CHASE1K] = page(H.chase[1]); s[SLOT.CHASE100] = page(H.chase[2]);
  s[SLOT.BROKEN] = page(at(H.broken, runs));
  s[SLOT.STUMBLE] = page(at(H.stumble, runs));
  s[SLOT.MULT] = page(at(H.mult, runs));
  s[SLOT.SKIN] = page(H.skin[skin] || H.skin.spider);
  s[SLOT.NIGHT] = page(at(H.night, runs));
  s[SLOT.LOOP] = page(at(H.loop, runs));
  return s;
}

// The slots a Bugle board may show right now, most urgent first. Board number n shows deck[n % deck.length].
// ctx: { score, best, mult, d (run metres), stumbleD (metres of the last stumble or -1), night, loop (1..), dawn }
export function bugleDeck(c) {
  const deck = [], left = c.best - c.score;
  if (c.best > 0 && left < 0) deck.push(SLOT.BROKEN, SLOT.BROKEN);
  else if (c.best > 0 && left <= 100) deck.push(SLOT.CHASE100, SLOT.CHASE100);
  else if (c.best >= 2000 && left <= 1000) deck.push(SLOT.CHASE1K, SLOT.CHASE1K);
  else if (c.best >= 10000 && left <= 5000) deck.push(SLOT.CHASE5K);
  if (c.stumbleD >= 0 && c.d - c.stumbleD <= 600) deck.push(SLOT.STUMBLE);
  if (c.mult >= 5) deck.push(SLOT.MULT);
  if (c.night) deck.push(SLOT.NIGHT);
  if (c.loop >= 2 || c.dawn) deck.push(SLOT.LOOP);
  deck.push(SLOT.SKIN, SLOT.WANTED, SLOT.G1, SLOT.TOP5, SLOT.G2, SLOT.VENOM, SLOT.G3, SLOT.G4);
  return deck;
}
// the hero board on the Neon Meydan arch
export const heroSlot = (c) => (c.best > 0 && c.score > c.best ? SLOT.BROKEN : SLOT.NIGHT);
// true once, on the frame the score passes a real record (drives fireworks / ticker tape)
export const recordPassed = (prevScore, score, best) => best > 0 && prevScore <= best && score > best;

// self-check (runs on import; throws on a broken rule)
{
  const ok = (c, m) => { if (!c) throw new Error('11-3-mansetler: ' + m); };
  const count = Object.values(HEADLINES).reduce((n, g) => n + (Array.isArray(g) ? g.length : Object.keys(g).length), 0);
  ok(count >= 30, 'at least 30 headlines');
  const base = { score: 0, best: 20000, mult: 1, d: 0, stumbleD: -1, night: false, loop: 1, dawn: false };
  ok(bugleDeck(base)[0] === SLOT.SKIN, 'calm run starts with the skin headline');
  ok(bugleDeck({ ...base, score: 15500 })[0] === SLOT.CHASE5K, '5000 left');
  ok(bugleDeck({ ...base, score: 19950 })[0] === SLOT.CHASE100, '100 left');
  ok(bugleDeck({ ...base, score: 20001 })[0] === SLOT.BROKEN, 'record broken');
  ok(!bugleDeck({ ...base, best: 0, score: 50 }).includes(SLOT.BROKEN), 'no record talk on a first run');
  ok(bugleDeck({ ...base, d: 900, stumbleD: 400 }).includes(SLOT.STUMBLE) && !bugleDeck({ ...base, d: 1100, stumbleD: 400 }).includes(SLOT.STUMBLE), 'stumble headline lasts 600 m');
  ok(recordPassed(19990, 20010, 20000) && !recordPassed(20010, 20030, 20000) && !recordPassed(0, 10, 0), 'record edge');
  ok(buildSlots({ name: 'OĞUZ', best: 0, mult: 3, skin: 'yok', runs: 7 }).every((x) => x && (x.type !== 'page' || !x.row[1].includes('{'))), 'all slots filled');
}
