// Prototype-only fixtures: no persistent gift claims or game events.
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let giftUsed = false;
function iconArt(key) {
  const names = {'🧲':'magnet','🕸️':'web','🕷️':'spider','⚡':'bolt','✓':'check','〰':'sense','↑':'arrow','↗':'jet','🎭':'mask','↝':'tracer','👊':'fist','🛡️':'shield','♥':'heart','🦇':'bat','📰':'bugle','×2':'bugle'};
  return '<svg class="svg-ico" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + (names[key] || key) + '"/></svg>';
}
// Approval fixtures only. No imports, purchases, game access or persistent writes.
const root = document.querySelector('#ui.prototype');
const select = (query) => root.querySelector(query);
const all = (query) => [...root.querySelectorAll(query)];
all('[data-nav]').forEach(button => button.addEventListener('click', () => {
  location.href = button.dataset.nav;
}));
all('[data-toggle-sound]').forEach(button => button.addEventListener('click', () => {
  const on = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(on));
  button.textContent = `${button.dataset.toggleSound}: ${on ? 'AÇIK' : 'KAPALI'}`;
}));
all('[data-skin]').forEach(button => button.addEventListener('click', () => {
  all('[data-skin]').forEach(token => token.setAttribute('aria-pressed', String(token === button)));
  select('#stage-name').textContent = button.dataset.name;
  select('#stage-ability').textContent = button.dataset.ability;
  select('#stage-description').textContent = button.dataset.description;
  select('#stage-gift').textContent = button.dataset.costume ? 'Kostüm · ortak ağ · hediye verilmez' : 'İlk koşuna 1 hediye şarj!';
  select('#gift-used').hidden = button.dataset.costume || !giftUsed;
  select('#stage-gift').hidden = !button.dataset.costume && giftUsed;
  select('.hero-stage > .toy').dataset.hero = button.dataset.skin;
  button.classList.remove('popping');
  void button.offsetWidth;
  button.classList.add('popping');
  const puff = select('.puff');
  puff.hidden = false;
  puff.style.animation = 'none';
  void puff.offsetWidth;
  puff.style.animation = '';
  clearTimeout(root.puffTimer);
  root.puffTimer = setTimeout(() => { puff.hidden = true; }, 240);
}));
let page = 0;
function showPage(index, focus = false) {
  const pages = all('.comic-page');
  if (!pages.length) return;
  page = Math.max(0, Math.min(3, index));
  pages.forEach((node, i) => { node.hidden = i !== page; node.inert = i !== page; });
  all('[data-page]').forEach((button, i) => {
    if (i === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  select('[data-prev]').disabled = page === 0;
  select('[data-next]').textContent = page === 3 ? 'ANLADIM!' : 'İLERİ →';
  select('#page-count').textContent = `${page + 1} / 4`;
  if (focus) pages[page].querySelector('h2').focus();
}
all('[data-page]').forEach(button => button.addEventListener('click', () => showPage(Number(button.dataset.page), true)));
select('[data-prev]')?.addEventListener('click', () => showPage(page - 1, true));
select('[data-next]')?.addEventListener('click', () => {
  if (page === 3) location.href = '11-2-menu.html';
  else showPage(page + 1, true);
});
if (root.dataset.demo === 'help') {
  showPage(0);
  let pointer = null;
  all('.comic-page').forEach(node => {
    node.style.touchAction = 'pan-y';
    node.addEventListener('pointerdown', event => {
      if (pointer) { pointer = null; return; }
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    node.addEventListener('pointercancel', () => { pointer = null; });
    node.addEventListener('pointerup', event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) showPage(page + (dx < 0 ? 1 : -1), true);
    });
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      showPage(page + (event.key === 'ArrowRight' ? 1 : -1), true);
    }
  });
}
function activateTab(name) {
  all('[role=tab]').forEach(tab => {
    const on = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
  });
  all('[role=tabpanel]').forEach(panel => {
    panel.hidden = panel.dataset.panel !== name;
    panel.scrollTop = 0;
  });
}
all('[role=tab]').forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = all('[role=tab]').find(other => other !== tab);
    activateTab(next.dataset.tab);
    next.focus();
  });
});
let marketExample = 0;
const marketFixtures = all('.market-row').map(row => ({
  row, info: row.querySelector('.item-info').innerHTML,
  button: row.querySelector('.price'), price: row.querySelector('.price').innerHTML,
  label: row.querySelector('.price').getAttribute('aria-label')
}));
select('[data-market-fixture]')?.addEventListener('click', event => {
  marketExample = (marketExample + 1) % 3;
  event.currentTarget.textContent = ['ÖRNEK: NORMAL', 'ÖRNEK: AZ ALTIN', 'ÖRNEK: DOLU'][marketExample];
  select('#fixture-wallet').textContent = marketExample === 1 ? '40' : '640';
  for (const fixture of marketFixtures) {
    const { row, button } = fixture;
    row.querySelector('.item-info').innerHTML = fixture.info;
    button.innerHTML = fixture.price;
    button.disabled = marketExample !== 0;
    button.setAttribute('aria-label', fixture.label);
    const lines = row.querySelectorAll('.item-info small');
    if (marketExample === 1) lines[lines.length - 1].textContent = 'Altın yetmiyor';
    if (marketExample === 2) {
      const upgrade = row.closest('[data-panel]').dataset.panel === 'upgrade';
      button.textContent = upgrade ? 'EN ÜST' : 'DOLU';
      button.setAttribute('aria-label', row.querySelector('b').textContent + (upgrade ? ', en üst seviye' : ', stok dolu'));
      if (upgrade) {
        const max = lines[0].textContent.match(/\/(\d+)/)[1];
        lines[0].firstChild.textContent = `Sv. ${max}/${max}`;
        row.querySelectorAll('.pips i').forEach(pip => pip.classList.add('on'));
        lines[lines.length - 1].textContent = 'Tamamı sende!';
      } else {
        const cap = lines[0].textContent.match(/\/(\d+)/)[1];
        lines[0].textContent = `${cap}/${cap} · Tamamı sende!`;
      }
    }
  }
  select('#market-status').textContent = 'Görünüm maketi. Örnek durum değişti; satın alma yapılmaz.';
});
all('[data-fixture-buy]').forEach(button => button.addEventListener('click', () => {
  select('#market-status').textContent = 'Görünüm maketi · Satın alma yapılmaz.';
}));
const captionNode = select('.caption');
let queue = [], captionTimer = null;
function showCaption(heading, text, icon = '🧲', tab = 'İLK KEZ!') {
  if (!captionNode) return;
  captionNode.hidden = false;
  select('.caption-copy b').textContent = heading + ' ';
  select('.caption-copy span').textContent = text;
  select('.caption-icon').innerHTML = iconArt(icon);
  select('.caption-tab').textContent = tab;
  captionNode.classList.remove('enter');
  captionNode.classList.remove('leave');
  void captionNode.offsetWidth;
  captionNode.classList.add('enter');
}
function playQueue() {
  clearTimeout(captionTimer);
  if (!queue.length) return;
  const next = queue.shift();
  showCaption(...next);
  const status = select('#queue-status');
  if (status) status.textContent = `Kutuda 1 · Sırada ${queue.length}`;
  captionTimer = setTimeout(() => {
    captionNode.classList.add('leave');
    captionTimer = setTimeout(() => {
      captionNode.hidden = true;
      if (queue.length) captionTimer = setTimeout(playQueue, 120);
      else if (status) status.textContent = 'Sıra boş · Tekrar deneyebilirsin.';
    }, reduceMotion() ? 100 : 160);
  }, (reduceMotion() ? 100 : 220) + 2500);
}
all('[data-caption-demo]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.captionDemo;
  queue = kind === 'district' ? [['MIDTOWN!', 'Mahalle bizim, koşu senin.', 'city', 'YENİ BÖLGE!']]
    : kind === 'narrator' ? [['GÖREV TAMAM!', 'Üç rozete doğru bir adım daha.', '✓', 'ANLATICI']]
    : kind === 'queue' ? [
    ['MIKNATIS!', 'Altınlar artık sana koşuyor.', '🧲'],
    ['BİR ROZET CEPTE!', 'Üç görevi bitir, çarpanın büyüsün.', '✓']
  ] : kind === 'safety' ? [['VENOM HAMLESİ!', 'Kırmızı şeritten hemen çık!', '🕷️']]
    : [['MIKNATIS!', 'Altınlar artık sana koşuyor.', '🧲']];
  playQueue();
}));
const ability = select('.action-dock .ability');
all('[data-pill-state]').forEach(button => button.addEventListener('click', () => {
  const state = button.dataset.pillState;
  ability.classList.remove('ready', 'empty', 'active', 'blocked', 'costume');
  ability.classList.add(state === 'costume' ? 'active' : state);
  ability.classList.toggle('costume', state === 'costume');
  ability.querySelector('b').textContent = state === 'costume' ? 'AĞ' : 'VENOM GÜCÜ';
  ability.querySelector('.glyph').innerHTML = iconArt(state === 'costume' ? 'web' : '⚡');
  ability.style.setProperty('--p', '.6');
  select('.ability-count').textContent = state === 'costume' ? 'AĞDA' : state === 'empty' ? '0 / 1' : state === 'active' ? 'AKTİF · 5 sn' : state === 'blocked' ? 'BİRAZDAN' : '1 / 1 · DOKUN';
  const gift = select('.gift-sticker');
  if (gift) gift.hidden = state !== 'ready' || giftUsed;
  ability.setAttribute('aria-label', state === 'empty' ? 'Şarj yok. Doldurmayı öğren.' : 'Kahraman gücü görünüm örneği');
}));
ability?.addEventListener('click', () => {
  if (ability.classList.contains('empty')) {
    clearTimeout(captionTimer); queue = [];
    ability.classList.remove('shaking'); void ability.offsetWidth; ability.classList.add('shaking');
    showCaption('ŞARJ YOK!', 'Yoldan kartuş kap; markette 75 altın.', '🕸️', 'ŞARJ LAZIM!');
  } else if (ability.classList.contains('ready')) {
    ability.classList.remove('ready'); ability.classList.add('active');
    ability.style.setProperty('--p', '.4');
    select('.ability-count').textContent = 'AKTİF · 5 sn';
    const gift = select('.gift-sticker'); if (gift) gift.hidden = true;
    showCaption('VENOM PATLAMASI!', 'Miles elektrikle yolu açar.', '⚡');
  }
});
// Width-adaptive slots; informational tokens are not tap targets.
function powerPlan(width, count) {
  const capacity = Math.max(2, Math.min(8, Math.floor((width + 8) / 40)));
  const visible = count > capacity ? capacity - 1 : count;
  return { visible, hidden: count - visible };
}
let expandedPowers = false, overflowIndex = 0, hiddenPowers = [];
const powerNodes = all('.powers > .power:not(#fixture-overflow)');
function drawPowers() {
  const row = select('.powers'); if (!row) return;
  const count = expandedPowers ? 9 : 8;
  const plan = powerPlan(row.clientWidth, count);
  powerNodes.forEach((node, i) => { node.hidden = i >= plan.visible; });
  hiddenPowers = powerNodes.slice(plan.visible, count);
  overflowIndex = 0;
  select('#fixture-overflow').hidden = plan.hidden === 0;
  paintOverflow();
  const status = select('#pause-powers');
  if (status) status.textContent = 'Aktif güçler: ' + powerNodes.slice(0, count).map(node => node.getAttribute('aria-label')).join(' · ');
}
function paintOverflow() {
  if (!hiddenPowers.length) return;
  const node = hiddenPowers[overflowIndex % hiddenPowers.length], overflow = select('#fixture-overflow');
  overflow.querySelector('.glyph').innerHTML = node.querySelector('.glyph').innerHTML;
  overflow.querySelector('small').textContent = '+' + hiddenPowers.length;
  overflow.style.setProperty('--p', node.style.getPropertyValue('--p'));
  overflow.setAttribute('aria-label', hiddenPowers.length + ' güç daha: ' + hiddenPowers.map(item => item.getAttribute('aria-label')).join(', '));
}
select('[data-overflow]')?.addEventListener('click', event => {
  expandedPowers = !expandedPowers;
  event.currentTarget.setAttribute('aria-pressed', String(expandedPowers));
  event.currentTarget.textContent = expandedPowers ? '8 GÜCE DÖN' : '9 GÜCÜ GÖR';
  drawPowers();
});
if (select('.powers')) {
  drawPowers();
  window.addEventListener('resize', drawPowers);
  setInterval(() => {
    if (document.hidden || reduceMotion() || !select('#pause-veil')?.hidden) return;
    overflowIndex++; paintOverflow();
  }, 1500);
}
const pauseVeil = select('#pause-veil');
select('[data-pause-demo]')?.addEventListener('click', () => {
  pauseVeil.hidden = false;
  select('[data-resume-demo]').focus();
});
select('[data-resume-demo]')?.addEventListener('click', () => {
  pauseVeil.hidden = true;
  select('[data-pause-demo]').focus();
});
root.addEventListener('keydown', event => {
  const veil = [pauseVeil].find(node => node && !node.hidden);
  if (event.key === 'Tab' && veil) {
    const controls = [...veil.querySelectorAll('button:not(:disabled), input, [tabindex="0"]')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (!veil.contains(document.activeElement) || document.activeElement === first)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (!veil.contains(document.activeElement) || document.activeElement === last)) {
      event.preventDefault(); first?.focus();
    }
  }
  if (event.key !== 'Escape') return;
  if (pauseVeil && !pauseVeil.hidden) { pauseVeil.hidden = true; select('[data-pause-demo]').focus(); }
});

all('[data-gift-used]').forEach(button => button.addEventListener('click', () => {
  giftUsed = !giftUsed;
  button.textContent = giftUsed ? 'HEDİYE AÇ' : 'HEDİYE';
  const strip = select('#gift-used'); if (strip) strip.hidden = !giftUsed || ['spider', 'gwen', 'mcu'].includes(select('.hero-stage > .toy')?.dataset.hero);
  const gift = select('.gift-sticker'); if (gift) gift.hidden = giftUsed;
  const label = select('.demo-label'); if (label) label.hidden = giftUsed;
  const stageGift = select('#stage-gift'); if (stageGift) stageGift.hidden = giftUsed;
}));
