// Static artifact checks only. No browser, game execution or production onboarding tests.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Script } from 'node:vm';

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
assert.equal(740 - 24 - 86 - 16 - 380, 234);
assert.equal(805 - 24 - 86 - 16 - 380, 299);
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
assert.equal(16 + 16 + 10 + 4 + 6, 52);
console.log('OK — 6 pages, IDs/local links, 11 heroes, 4 comic pages, 14 market rows, JS syntax, computed fit arithmetic. Browser/phone rendering NOT checked.');
