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
const missionVeil = select('#mission-veil');
select('[data-open-missions]')?.addEventListener('click', event => {
  missionVeil.hidden = false;
  event.currentTarget.setAttribute('aria-expanded', 'true');
  select('#mission-title').focus();
});
function closeMissions() {
  if (!missionVeil) return;
  missionVeil.hidden = true;
  const opener = select('[data-open-missions]');
  opener.setAttribute('aria-expanded', 'false');
  opener.focus();
}
select('[data-close-missions]')?.addEventListener('click', closeMissions);
missionVeil?.addEventListener('click', event => { if (event.target === missionVeil) closeMissions(); });
all('[data-skin]').forEach(button => button.addEventListener('click', () => {
  all('[data-skin]').forEach(token => token.setAttribute('aria-pressed', String(token === button)));
  select('#stage-name').textContent = button.dataset.name;
  select('#stage-ability').textContent = button.dataset.ability;
  select('#stage-description').textContent = button.dataset.description;
  select('#stage-gift').textContent = button.dataset.costume ? 'Kostüm · ortak ağ' : 'İlk koşuna 1 hediye şarj!';
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
  select('.caption-icon').textContent = icon;
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
    }, 160);
  }, 2720);
}
all('[data-caption-demo]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.captionDemo;
  queue = kind === 'queue' ? [
    ['MIKNATIS!', 'Altınlar artık sana koşuyor.', '🧲'],
    ['BİR ROZET CEPTE!', 'Üç görevi bitir, çarpanın büyüsün.', '✓']
  ] : kind === 'safety' ? [['VENOM HAMLESİ!', 'Kırmızı şeritten hemen çık!', '🕷️']]
    : [['MIKNATIS!', 'Altınlar artık sana koşuyor.', '🧲']];
  playQueue();
}));
const ability = select('.action-dock .ability');
all('[data-pill-state]').forEach(button => button.addEventListener('click', () => {
  const state = button.dataset.pillState;
  ability.classList.remove('ready', 'empty', 'active', 'blocked');
  ability.classList.add(state);
  select('.ability-count').textContent = state === 'empty' ? '0 / 1' : state === 'active' ? 'AKTİF · 5 sn' : state === 'blocked' ? 'BİRAZDAN' : '1 / 1 · DOKUN';
  const gift = select('.gift-sticker');
  if (gift) gift.hidden = state !== 'ready';
  ability.setAttribute('aria-label', state === 'empty' ? 'Şarj yok. Doldurmayı öğren.' : 'Kahraman gücü görünüm örneği');
}));
ability?.addEventListener('click', () => {
  if (ability.classList.contains('empty')) {
    clearTimeout(captionTimer); queue = [];
    ability.classList.remove('shaking'); void ability.offsetWidth; ability.classList.add('shaking');
    showCaption('ŞARJ YOK!', 'Yoldan kartuş kap; markette 75 altın.', '🕸️', 'ŞARJ LAZIM!');
  } else if (ability.classList.contains('ready')) {
    ability.classList.remove('ready'); ability.classList.add('active');
    select('.ability-count').textContent = 'AKTİF · 5 sn';
    const gift = select('.gift-sticker'); if (gift) gift.hidden = true;
    showCaption('VENOM PATLAMASI!', 'Miles elektrikle yolu açar.', '⚡');
  }
});
select('[data-overflow]')?.addEventListener('click', event => {
  const on = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  event.currentTarget.setAttribute('aria-pressed', String(on));
  select('#fixture-tracer').hidden = on;
  select('#fixture-overflow').hidden = !on;
  event.currentTarget.textContent = on ? '8 GÜCE DÖN' : '9 GÜCÜ GÖR';
});
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
  const veil = [missionVeil, pauseVeil].find(node => node && !node.hidden);
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
  if (missionVeil && !missionVeil.hidden) closeMissions();
  if (pauseVeil && !pauseVeil.hidden) { pauseVeil.hidden = true; select('[data-pause-demo]').focus(); }
});
