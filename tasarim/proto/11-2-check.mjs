// Static artifact checks only. No browser, game execution or production onboarding tests.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Script, runInNewContext } from 'node:vm';

const base = new URL('./', import.meta.url);
const names = ['anlati-kutusu', 'menu', 'karakter', 'nasil-oynanir', 'market', 'hud'];
const pages = new Map();
const voidTags = new Set(['meta', 'link', 'input', 'br', 'hr', 'img', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track']);
for (const name of names) {
  const html = await readFile(new URL(`11-2-${name}.html`, base), 'utf8');
  pages.set(name, html);
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /href="\.\.\/\.\.\/ui\.css"/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Bangers&family=Baloo\+2/);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /<img\b|<iframe\b|src=".*?src\/main\.js/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${name}: duplicate IDs`);
  for (const match of html.matchAll(/\b(?:aria-controls|aria-labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(' ')) assert(ids.includes(id), `${name}: missing ${id}`);
  }
  for (const match of html.matchAll(/\b(?:href|src|data-nav)="([^"]+)"/g)) {
    const value = match[1];
    if (/^https?:/.test(value)) continue;
    if (value.startsWith('#')) { assert(ids.includes(value.slice(1)), `${name}: bad symbol ${value}`); continue; }
    await access(new URL(value, base));
  }
  const stack = [];
  for (const tag of html.matchAll(/<(\/?)([a-z][\w:-]*)(?:\s[^<>]*?)?(\/?)>/gi)) {
    const [, closing, rawName, selfClosing] = tag;
    const tagName = rawName.toLowerCase();
    if (voidTags.has(tagName)) continue;
    if (closing) assert.equal(stack.pop(), tagName, `${name}: unbalanced ${tagName}`);
    else if (!selfClosing) stack.push(tagName);
  }
  assert.equal(stack.length, 0, `${name}: unclosed markup`);
}
assert.equal([...pages.get('karakter').matchAll(/class="hero-token"/g)].length, 11);
assert.equal([...pages.get('karakter').matchAll(/data-costume="true"/g)].length, 3);
assert.equal([...pages.get('nasil-oynanir').matchAll(/class="comic-page paper"/g)].length, 4);
assert.equal([...pages.get('market').matchAll(/class="market-row"/g)].length, 14);
assert.equal([...pages.get('market').matchAll(/role="tab"/g)].length, 2);
assert.equal([...pages.get('hud').matchAll(/class="caption"/g)].length, 1);
const js = await readFile(new URL('11-2-proto.js', base), 'utf8');
new Script(js);
assert.doesNotMatch(js, /localStorage\s*\.|sessionStorage\s*\.|\bfetch\s*\(|\bwindow\.game\b/);
const css = await readFile(new URL('11-2-proto.css', base), 'utf8');
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /height:calc\(196px \+ var\(--st\)\)/);
assert.match(css, /height:calc\(100px \+ var\(--st\)\)/);
assert.match(css, /grid-template-rows:24px 218px 44px/);
assert.match(css, /data-panel=upgrade\] \.market-row\{height:96px/);
assert.match(css, /\.hud-pause\{grid-column:3;height:44px/);
let braceDepth = 0;
for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
  if (char === '{') braceDepth++;
  if (char === '}') braceDepth--;
  assert(braceDepth >= 0, 'CSS closing brace without opener');
}
assert.equal(braceDepth, 0, 'Unclosed CSS block');
for (const name of ['ilk-bes-dakika', 'anlati-kutusu', 'kahraman', 'karakter-secimi', 'nasil-oynanir', 'yerlesim', 'gorevler']) {
  const url = new URL(`../11-2-${name}.md`, base);
  const markdown = await readFile(url, 'utf8');
  assert.doesNotMatch(markdown, /\uFFFD/, 'UTF-8 replacement character');
  for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(match[1]) || match[1].startsWith('#')) continue;
    await access(new URL(match[1].split('#')[0], url));
  }
}
// Independent border-box arithmetic; this does NOT measure glyphs or actual CSS layout.
assert.equal(8 * 32 + 7 * 8, 312);
assert(312 <= 360 - 32);
assert(9 * 32 + 8 * 8 > 360 - 32);
assert.equal((336 - 6 - 24 - 3 * 7) / 4, 71.25);
assert.equal((424 - 6 - 24 - 3 * 7) / 4, 93.25);
assert.equal(3 * 68 + 2 * 7, 218);
assert.equal(6 + 24 + 24 + 16 + 218 + 44, 332);
assert.equal(740 - 24 - 64 - 24 - 296 - 200, 132);
assert.equal(805 - 24 - 64 - 24 - 296 - 200, 197);
assert.equal(740 - 196, 544);
assert.equal(805 - 196, 609);
assert.equal(360 - 100, 260);
assert.equal(716 - 44 - 32 - 44 - 44 - 32, 520);
assert.equal(4 * 88 + 3 * 8 + 22, 398);
assert.equal(10 * 96 + 9 * 8 + 22, 1054);
assert.equal(314 - 4 - 16 - 36 - 76 - 16, 166);
assert.equal(336 - 6 - 16 - 24 - 16 - 44, 230);
assert.equal(44 + 2 * 12, 68);
assert.equal(22 + 18 + 12 + 6 + 6, 64);
assert.equal(12 + 16 + 12 + 4 + 8, 52);

// Regression guards tie arithmetic to the actual source, including breakpoint overrides.
function block(source, marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, `Missing CSS: ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 1, end = open + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return source.slice(open + 1, end - 1);
}
const rule = (source, selector) => block(source, `#ui.prototype ${selector}{`);
const px = (declarations, property) => {
  const match = declarations.match(new RegExp(`(?:^|;)${property}:([\\d.]+)px`));
  assert(match, `${property}: ${declarations}`);
  return Number(match[1]);
};
function geometry(source) {
  const compact = block(source, '@media(max-width:400px)');
  const land = block(source, '@media(orientation:landscape) and (max-height:500px)');
  const motion = px(rule(compact, '.motion'), 'font-size');
  const heading = px(rule(compact, '.panel h3'), 'line-height');
  // Reviewer panel1: two heading lines, two body lines, bubble + three gaps.
  assert(motion + 2 * heading + 38 + 32 + 15 <= 158, 'Blocker1: help panel clips at360');
  const caption = rule(land, '.caption');
  assert(px(caption, 'height') - 6 - 8 >= 2 * 19, 'Blocker2: landscape caption < two lines');
  assert(px(caption, 'height') + 44 + 3 <= 100, 'Caption shadow enters road');
  assert.match(caption, /transform:none/);
  assert(px(rule(land, '.score-cell.mult'), 'width') - 4 >= 3 * .55 * 17);
  assert(px(rule(land, '.event-tag'), 'top') + 8 + 2 >= 40, 'Event tag overlaps powers');
  assert.match(rule(land, '.menu-paper'), /grid-template-rows:60px 18px 48px 44px 44px 44px/);
}
geometry(css);
// Prove the checker rejects both old blockers, rather than only asserting happy constants.
assert.throws(() => geometry(css.replace('.motion{font-size:28px;line-height:28px', '.motion{font-size:40px;line-height:28px')), /Blocker1/);
assert.throws(() => geometry(css.replace('height:52px;max-width:none', 'height:44px;max-width:none')), /Blocker2/);

assert.doesNotMatch(css, /font(?:-size)?:(?:9|10|11)px/);
assert.doesNotMatch(css + js + pages.get('menu'), /missions-strip|mini-badge|mission-veil|open-missions/);
assert.match(pages.get('menu'), /class="card mission-card"/);
for (const name of ['ms-title', 'ms-list', 'ms-row', 'ms-txt', 'ms-n', 'ms-now', 'ms-goal']) {
  assert(pages.get('menu').includes(`class="${name}"`));
}
assert.match(pages.get('menu'), /GÖREVLER · SET 1 · x1/);
assert.equal(14 + 2 + 44, 60);
assert(13 * .55 * 20 + 13 * 1.2 + 20 + 8 <= 270, 'Full-width landscape help');
assert(8 + 12 + 21 + 4 + 3 * 46 + 12 <= 200, 'Original mission card');
assert.equal(140 + 12 + 296 + 12 + 256, 740 - 24);
for (const html of pages.values()) {
  for (const tag of html.matchAll(/<button\b([^>]*)>/g)) {
    if (/hero-token|data-page/.test(tag[1])) continue;
    assert.match(tag[1], /class="btn /, 'Game button style');
  }
  assert.match(html, /temsili çizim/, 'Stand-in art is labelled once');
}
assert.match(css, /quiet-in \.1s/);
assert.match(css, /quiet-out \.1s/);
assert.match(css, /empty-shake\{0%,100%/);
assert.match(css, /stroke-dasharray:113\.097/);
assert.doesNotMatch(css, /conic-gradient\(var\(--yellow\) 72%/);
assert.match(pages.get('hud'), /data-pill-state="costume"/);
assert.match(js, /'AĞDA'/);
assert.match(pages.get('anlati-kutusu'), /data-caption-demo="narrator"/);
assert.match(pages.get('anlati-kutusu'), /data-caption-demo="district"/);
assert.match(pages.get('karakter'), /id="gift-used"/);
assert.match(css, /\.ability\.blocked\{[^}]*color:var\(--cream\)[^}]*stroke:2px var\(--ink\)/);
assert.match(css, /\.stage-note\{[^}]*font-size:12px[^}]*color:var\(--cream\)/);

// Execute the real pure slot planner, including9+ and narrow screens.
const planSource = js.match(/function powerPlan\(width, count\) \{[\s\S]*?\n\}/)[0];
const plan = runInNewContext(`(${planSource})`);
for (const [width, capacity] of [[328, 8], [458, 8], [496, 8], [288, 7], [248, 6]]) {
  for (const count of [0, 1, 8, 9, 12, 20]) {
    const result = plan(width, count);
    const slots = result.visible + (result.hidden > 0 ? 1 : 0);
    assert(slots <= capacity);
    assert(slots * 32 + Math.max(0, slots - 1) * 8 <= width);
    assert.equal(result.visible + result.hidden, count);
    if (count > capacity) assert.equal(result.hidden, count - capacity + 1);
  }
}
for (const width of [360, 490, 740, 320, 280]) {
  const widths = width <= 340 ? [44, 44, 44, Math.min(112, width - 24 - 132 - 24)] : [60, 60, 56, 112];
  assert(widths.every(w => w >= 44));
  assert(widths.reduce((a, b) => a + b) + 3 * 8 <= width - 24, `Dock overlaps at${width}`);
}

// Text estimates: reviewer assumptions, word boundaries and explicit BRs, NOT glyph measurements.
const textOf = html => html.replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<br\s*\/?\s*>/g, '\n').replace(/<[^>]*>/g, '').trim();
function lines(text, width, size, factor = .5, spacing = 0) {
  let total = 0;
  for (const paragraph of text.split('\n')) {
    let used = 0, n = 1;
    for (const word of paragraph.trim().split(/\s+/)) {
      const length = word.length * (size * factor + spacing);
      assert(length <= width, `Unbroken word ${word}: ${length}>${width}`);
      const space = used ? size * factor + spacing : 0;
      if (used + space + length > width) { n++; used = length; }
      else used += space + length;
    }
    total += n;
  }
  return total;
}
const comic = pages.get('nasil-oynanir');
const articles = [...comic.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(m => m[1]);
for (const [width, height] of [[360, 740], [490, 805], [740, 360]]) {
  const landscape = width > height;
  const paperWidth = landscape ? width - 24 - 112 - 8 : Math.min(width, 448) - 24;
  const paperHeight = height - 24 - (landscape ? 52 : 156);
  const innerWidth = paperWidth - 26, innerHeight = paperHeight - 26;
  const rows = [];
  for (const [pageIndex, article] of articles.entries()) {
    const title = textOf(article.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)[1]);
    const kicker = textOf(article.match(/<p class="comic-kicker">([\s\S]*?)<\/p>/)[1]);
    const note = textOf(article.match(/<p class="comic-note">([\s\S]*?)<\/p>/)[1]);
    const details = article.includes('<details>') && !landscape;
    const fixed = lines(title, innerWidth, landscape ? 24 : 28, .55) * (landscape ? 26 : 30)
      + lines(kicker, innerWidth, landscape ? 12 : 13) * (landscape ? 14 : 16)
      + lines(note, innerWidth, landscape ? 12 : 13) * (landscape ? 14 : 16)
      + (details ? 44 : 0) + (details ? 4 : 3) * (landscape ? 5 : 8);
    const columns = landscape ? (pageIndex < 2 ? 4 : 2) : (pageIndex < 2 ? 2 : 1);
    const rowCount = landscape ? 1 : 2;
    const panelWidth = (innerWidth - (columns - 1) * (landscape ? 6 : 8)) / columns;
    const contentWidth = panelWidth - (landscape ? 16 : 22);
    const available = (innerHeight - fixed - (rowCount - 1) * 8) / rowCount - (landscape ? 22 : 28);
    let maximum = 0;
    for (const panel of article.matchAll(/<section class="panel[^>]*>([\s\S]*?)<\/section>/g)) {
      const body = panel[1];
      let needed = 0, children = 0;
      for (const element of body.matchAll(/<(div|h3|p|span|strong)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
        const [, tag, attrs, html] = element, text = textOf(html);
        children++;
        if (/class="motion"/.test(attrs)) needed += landscape ? (pageIndex === 3 ? 24 : 28) : (width <= 400 ? 28 : 44);
        else if (/comic-badges/.test(attrs)) needed += landscape ? 65 : 74;
        else if (/big-mult/.test(attrs)) needed += 28.8;
        else if (/sticker/.test(attrs)) needed += landscape ? 22 : 26.5;
        else if (tag === 'h3') needed += lines(text, contentWidth, landscape || width <= 400 ? 19 : 22, .55) * (landscape || width <= 400 ? 20 : 24);
        else if (/bubble/.test(attrs)) needed += lines(text, contentWidth - 18, landscape ? 14 : 15) * (landscape ? 17 : 18) + 14;
        else needed += lines(text, contentWidth, landscape ? 14 : 16) * (landscape ? 17 : 19);
      }
      needed += Math.max(0, children - 1) * (landscape ? 3 : 5);
      assert(needed <= available, `Help${pageIndex + 1} at${width}x${height}: ${needed.toFixed(1)}>${available.toFixed(1)}`);
      maximum = Math.max(maximum, needed);
    }
    rows.push(`${pageIndex + 1}:${maximum.toFixed(1)}/${available.toFixed(1)}`);
  }
  console.log(`Computed help content/available ${width}x${height}: ${rows.join(' · ')}`);
}
const narration = await readFile(new URL('../11-2-anlati-kutusu.md', base), 'utf8');
assert.equal([...narration.matchAll(/disabled — arrives with stage 11\.3/g)].length, 5);
const tasks = await readFile(new URL('../11-2-gorevler.md', base), 'utf8');
assert.match(tasks, /stage11\.5 task13 removes the kind !== venom gate/);
for (const [width, copyWidth, maxLines] of [[360, 269, 2], [490, 365, 2], [740, 445, 2], [320, 229, 4], [280, 189, 4]]) {
  for (const line of narration.split('\n').filter(line => /^\| `/.test(line))) {
    const copy = line.match(/`([^`]+ \/ [^`]+)`/);
    assert(copy, line);
    const combined = copy[1].replaceAll('{multiplier}', '30').replaceAll('{skin}', 'miles');
    let used = 0, count = 1;
    for (const [part, text] of combined.split(' / ').entries()) {
      const size = width === 740 ? 18 : part === 0 ? 19 : width >= 440 ? 18 : 17;
      for (const word of text.split(/\s+/)) {
        const length = word.length * (size * .55 + .15);
        assert(length <= copyWidth, word);
        const space = used ? size * .55 + .15 : 0;
        if (used + space + length > copyWidth) { count++; used = length; }
        else used += space + length;
      }
    }
    assert(count <= maxLines, `Caption at${width} (${count} lines): ${combined}`);
  }
}
console.log('OK — 6 pages, source guards, blocker regression mutations, all comic panels/catalogue estimates,9+ and narrow slots/dock, states/art/button style. Computed only; browser/phone NOT checked.');
