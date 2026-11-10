// tasarim/proto/sehir-tex.js — REFERENCE IMPLEMENTATION of every canvas texture and shader
// snippet of stage 11.3 (tasarim/11-3-sehir.md). The coder copies these functions into
// src/city-tex.js (textures) and src/city.js / src/daycycle.js (shaders) unchanged, except the
// "export" lines. No three.js import here: every drawer takes a 2D context and draws.
// Seen in tasarim/proto/sheet.html (all textures) and applied live by tasarim/proto/live.js.

export const INK = '#1c1016';
export const FONT_H = "'Bangers', Impact, 'Arial Black', sans-serif";
export const FONT_B = "800 1px 'Baloo 2', 'Arial Black', sans-serif"; // size patched per use

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Glow atlases: pixels of an always-on light (sign, ad, neon) get alpha 128. Canvas source-over
// onto opaque black never lowers alpha, so it is written raw afterwards.
export function markAlwaysOn(g, x, y, w, h) {
  const im = g.getImageData(x, y, w, h);
  for (let i = 3; i < im.data.length; i += 4) im.data[i] = 128;
  g.putImageData(im, x, y);
}

function inkRect(g, x, y, w, h, fill, lw = 4) {
  if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
  g.lineWidth = lw; g.strokeStyle = INK; g.strokeRect(x, y, w, h);
}

// ===================================================================== FACADE ATLASES
// 1024 x 1024, 4 x 4 cells of 256 px. Cell (c, r): x = c*256, y = r*256 (canvas y down).
// Geometry uv: 1 unit = 1 window bay; texture.repeat = (0.25, 0.25), RepeatWrapping, so each
// atlas tile covers 4 x 4 bays and every bay shows a different cell. Wall pixels are WHITE /
// near-white: the building's vertex colour tints them (as today).
// The glow atlas (512 x 512, cells of 128) has the same layout at half scale: black = no light.
// Its ALPHA marks what the night hash may switch: alpha 255 = a window (switched per bay by
// uWinOn), alpha 128 = always on when lit (signs, ads, neon).

// --- Midtown cell grammar (also the base of the others) ---
const GLASS = { x: 64, y: 60, w: 128, h: 146 };

function midWall(g, x0, y0, r) {
  g.fillStyle = '#ffffff'; g.fillRect(x0, y0, 256, 256);
  // brick courses + staggered joints (very light: tint multiplies them)
  g.fillStyle = '#e9e9e9';
  for (let y = 6; y < 256; y += 16) {
    g.fillRect(x0, y0 + y, 256, 2);
    const off = (y / 16) % 2 ? 0 : 16;
    for (let x = off; x < 256; x += 32) g.fillRect(x0 + x, y0 + y - 14, 2, 14);
  }
  // pilaster shadow at both bay edges (reads as a column between windows)
  g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(x0, y0, 10, 256); g.fillRect(x0 + 246, y0, 10, 256);
  // two random soot streaks under the sill
  g.fillStyle = 'rgba(40,30,40,0.08)';
  for (let i = 0; i < 2; i++) g.fillRect(x0 + 70 + r() * 110, y0 + 232, 6 + r() * 8, 24);
}

function midFrame(g, x0, y0, frame = '#f4efe6') {
  inkRect(g, x0 + 36, y0 + 30, 184, 20, '#d9d0c4', 4);   // lintel
  inkRect(g, x0 + 36, y0 + 214, 184, 18, '#cfc5b7', 4);  // sill
  inkRect(g, x0 + 52, y0 + 50, 152, 166, frame, 6);       // frame
}

function glassBase(g, x, y, top = '#35557a', bot = '#1d3150') {
  const gr = g.createLinearGradient(0, y, 0, y + GLASS.h);
  gr.addColorStop(0, top); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(x, y, GLASS.w, GLASS.h);
}

function glare(g, x, y) {
  g.save(); g.beginPath(); g.rect(x, y, GLASS.w, GLASS.h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + 50, y - 10); g.lineTo(x, y + 70); g.fill();
  g.beginPath(); g.moveTo(x + 60, y); g.lineTo(x + 84, y); g.lineTo(x, y + 116); g.lineTo(x, y + 92); g.fill();
  g.restore();
}

function mullions(g, x, y, col = '#f4efe6') {
  g.fillStyle = col;
  g.fillRect(x, y + 66, GLASS.w, 8);
  g.fillRect(x + 60, y, 8, GLASS.h);
  g.lineWidth = 3; g.strokeStyle = INK;
  g.strokeRect(x, y + 66, GLASS.w, 8);
  g.strokeRect(x + 60, y, 8, GLASS.h);
  g.lineWidth = 4; g.strokeRect(x, y, GLASS.w, GLASS.h);
}

// interiors: day versions (d) on the 256 cell; the glow versions are drawn by midGlowCell
const MID_KINDS = ['plain', 'blindsHalf', 'curtRed', 'curtTeal', 'plant', 'ac', 'cat', 'poster',
  'lamp', 'blindsFull', 'person', 'open', 'star', 'boarded', 'blindsTilt', 'plainLight'];

function catShape(g, x, y, s) { // sitting cat, seen from behind, tail curled; origin = bottom centre
  g.beginPath();
  g.ellipse(x, y - 14 * s, 13 * s, 16 * s, 0, 0, Math.PI * 2);          // body
  g.ellipse(x, y - 36 * s, 10 * s, 9 * s, 0, 0, Math.PI * 2);            // head
  g.moveTo(x - 9 * s, y - 40 * s); g.lineTo(x - 7 * s, y - 52 * s); g.lineTo(x - 2 * s, y - 43 * s); // ears
  g.moveTo(x + 9 * s, y - 40 * s); g.lineTo(x + 7 * s, y - 52 * s); g.lineTo(x + 2 * s, y - 43 * s);
  g.fill();
  g.lineWidth = 5 * s; g.lineCap = 'round'; g.strokeStyle = g.fillStyle;
  g.beginPath(); g.moveTo(x + 10 * s, y - 4 * s); g.quadraticCurveTo(x + 30 * s, y, x + 24 * s, y - 22 * s); g.stroke();
}

function personShape(g, x, y, s) { // head + shoulders, origin = bottom centre
  g.beginPath();
  g.arc(x, y - 52 * s, 14 * s, 0, Math.PI * 2);
  g.moveTo(x - 30 * s, y); g.quadraticCurveTo(x - 30 * s, y - 34 * s, x, y - 36 * s);
  g.quadraticCurveTo(x + 30 * s, y - 34 * s, x + 30 * s, y); g.closePath();
  g.fill();
}

function webPoster(g, x, y, w, h, red = '#d8262c', ink = INK) { // spider-mask poster
  g.fillStyle = red; g.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h * 0.48;
  g.strokeStyle = ink; g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h); g.stroke();
  }
  for (let k = 1; k <= 3; k++) { g.beginPath(); g.ellipse(cx, cy, k * w * 0.16, k * h * 0.14, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#ffffff'; g.lineWidth = 3;
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(cx + s * w * 0.2, cy - h * 0.05, w * 0.15, h * 0.1, s * 0.5, 0, Math.PI * 2);
    g.fill(); g.stroke();
  }
}

function midCell(g, x0, y0, kind, r) {
  midWall(g, x0, y0, r);
  midFrame(g, x0, y0);
  const x = x0 + GLASS.x, y = y0 + GLASS.y;
  glassBase(g, x, y);
  g.save(); g.beginPath(); g.rect(x, y, GLASS.w, GLASS.h); g.clip();
  switch (kind) {
    case 'blindsHalf':
      for (let i = 0; i < 7; i++) inkRect(g, x, y + i * 10, GLASS.w, 8, '#efe3c4', 1.5); break;
    case 'blindsFull':
      for (let i = 0; i < 15; i++) inkRect(g, x, y + i * 10, GLASS.w, 8, '#f2e8cf', 1.5); break;
    case 'blindsTilt':
      g.fillStyle = '#e6dcc2';
      for (let i = -4; i < 16; i++) { g.save(); g.translate(x, y + i * 12); g.rotate(-0.35); g.fillRect(0, 0, 180, 6); g.restore(); }
      break;
    case 'curtRed': case 'curtTeal': {
      const c = kind === 'curtRed' ? '#d6453d' : '#2f9e9a';
      for (const s of [0, 1]) {
        g.fillStyle = c; g.beginPath();
        const ex = s ? x + GLASS.w : x, dir = s ? -1 : 1;
        g.moveTo(ex, y); g.lineTo(ex + dir * 52, y); g.quadraticCurveTo(ex + dir * 26, y + 80, ex + dir * 40, y + GLASS.h);
        g.lineTo(ex, y + GLASS.h); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
      }
      break;
    }
    case 'plant':
      g.fillStyle = '#3fa65a';
      for (const [dx, dy, rr] of [[40, 110, 22], [60, 96, 26], [82, 112, 20], [52, 124, 18]]) { g.beginPath(); g.arc(x + dx, y + dy, rr, 0, 7); g.fill(); }
      inkRect(g, x + 38, y + 126, 44, 20, '#b0583a', 3); break;
    case 'cat': g.fillStyle = '#0d0d14'; catShape(g, x + 34, y + GLASS.h, 1.1); break;
    case 'poster': webPoster(g, x + 18, y + 14, 70, 96); break;
    case 'lamp':
      g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(x + 84, y + 60); g.lineTo(x + 112, y + 60); g.lineTo(x + 118, y + 84); g.lineTo(x + 78, y + 84); g.fill();
      g.fillStyle = '#2a2a33'; g.fillRect(x + 96, y + 84, 4, 50); break;
    case 'person': g.fillStyle = '#16233b'; personShape(g, x + 90, y + GLASS.h, 1.0); break;
    case 'open':
      g.fillStyle = '#0f1626'; g.fillRect(x, y + 74, GLASS.w, 72);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 10, y + 74); g.quadraticCurveTo(x + 40, y + 110, x + 20, y + 146); g.lineTo(x + 6, y + 146); g.lineTo(x + 6, y + 74); g.fill();
      break;
    case 'star':
      g.fillStyle = '#ffd23a'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 9 : 20; g.lineTo(x + 96 + Math.cos(a) * rr, y + 30 + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke(); break;
    case 'plainLight': glassBase(g, x, y, '#4f77a0', '#2b4a70'); break;
    default: break;
  }
  g.restore();
  if (kind === 'boarded') {
    g.fillStyle = '#8f6a48'; g.fillRect(x, y, GLASS.w, GLASS.h);
    for (let i = 0; i < 4; i++) inkRect(g, x - 6, y + 8 + i * 36, GLASS.w + 12, 26, '#c8955f', 3);
    inkRect(g, x, y, GLASS.w, GLASS.h, null, 4);
  } else {
    if (kind !== 'open') glare(g, x, y);
    mullions(g, x, y);
  }
  if (kind === 'ac') { // window AC box hanging over the sill
    inkRect(g, x0 + 92, y0 + 186, 72, 46, '#c9ccd2', 4);
    g.fillStyle = '#8d939c'; for (let i = 0; i < 5; i++) g.fillRect(x0 + 100, y0 + 194 + i * 7, 56, 3);
  }
}

// glow cell (128 px; s = 0.5 of the day coordinates)
const WARM = ['#ffe59a', '#ffbe4d'];
function glowGlass(g, x, y, w, h, c0, c1) {
  const gr = g.createRadialGradient(x + w / 2, y + h * 0.45, 4, x + w / 2, y + h / 2, h * 0.75);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
function midGlowCell(g, x0, y0, kind) {
  g.fillStyle = '#000000'; g.fillRect(x0, y0, 128, 128);
  const x = x0 + 32, y = y0 + 30, w = 64, h = 73;
  if (kind === 'boarded' || kind === 'open') return; // always dark
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  switch (kind) {
    case 'curtTeal': case 'person': glowGlass(g, x, y, w, h, '#c8f1ff', '#5fb8ff'); break;   // TV blue
    case 'poster': glowGlass(g, x, y, w, h, ...WARM); webPoster(g, x + 9, y + 7, 35, 48, '#ff4a3c', '#3a0606'); break;
    case 'blindsTilt': glowGlass(g, x, y, w, h, '#ffffff', '#cfe6ff'); break;               // office white
    case 'plainLight': glowGlass(g, x, y, w, h, '#ffd0e0', '#ff8fb5'); break;               // party pink
    case 'lamp': glowGlass(g, x, y, w, h, '#fff6c8', '#ffb238'); break;
    default: glowGlass(g, x, y, w, h, ...WARM);
  }
  g.fillStyle = '#1a0d05';
  if (kind === 'cat') catShape(g, x + 17, y + h, 0.55);
  if (kind === 'person') { g.fillStyle = '#06101c'; personShape(g, x + 45, y + h, 0.5); }
  if (kind === 'plant') for (const [dx, dy, rr] of [[20, 55, 11], [30, 48, 13], [41, 56, 10]]) { g.beginPath(); g.arc(x + dx, y + dy, rr, 0, 7); g.fill(); }
  if (kind === 'blindsHalf' || kind === 'blindsFull') {
    g.fillStyle = 'rgba(60,30,0,0.55)';
    const n = kind === 'blindsHalf' ? 4 : 8;
    for (let i = 0; i < n; i++) g.fillRect(x, y + 3 + i * 9, w, 3);
  }
  if (kind === 'curtRed') {
    g.fillStyle = '#8a2414';
    g.fillRect(x, y, 22, h); g.fillRect(x + w - 22, y, 22, h);
  }
  g.restore();
  g.fillStyle = '#000000'; g.fillRect(x, y + 33, w, 4); g.fillRect(x + 30, y, 4, h); // mullions
}

export function drawMidtownAtlas(g) {
  const r = rng(1101);
  MID_KINDS.forEach((k, i) => midCell(g, (i % 4) * 256, Math.floor(i / 4) * 256, k, r));
}
export function drawMidtownGlow(g) {
  MID_KINDS.forEach((k, i) => midGlowCell(g, (i % 4) * 128, Math.floor(i / 4) * 128, k));
}

// --- Chinatown: stucco walls, green frames, red shutters, balconies, and 4 sign cells ---
const CT_KINDS = ['shutRed', 'greenPlain', 'balcony', 'lanternWin', 'shutRed2', 'laundry', 'greenCurt', 'round',
  'balcony2', 'greenPlain2', 'shutOpen', 'lanternWin2', 'signA', 'signB', 'signC', 'signD'];

export function glyph(g, cx, cy, s, r) { // pseudo-CJK block: 3-6 brush strokes in a square (no font)
  g.lineCap = 'square'; g.lineWidth = s * 0.14;
  g.beginPath();
  g.moveTo(cx - s * 0.4, cy - s * 0.3); g.lineTo(cx + s * 0.4, cy - s * 0.3);         // top bar
  const n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const t = r();
    if (t < 0.35) { const yy = cy - s * 0.15 + r() * s * 0.5; g.moveTo(cx - s * 0.35, yy); g.lineTo(cx + s * 0.35, yy); }
    else if (t < 0.7) { const xx = cx - s * 0.3 + r() * s * 0.6; g.moveTo(xx, cy - s * 0.4); g.lineTo(xx, cy + s * 0.4); }
    else { g.moveTo(cx, cy - s * 0.1); g.lineTo(cx + (r() < 0.5 ? -1 : 1) * s * 0.4, cy + s * 0.4); }
  }
  g.stroke();
}

function ctWall(g, x0, y0, r) {
  g.fillStyle = '#ffffff'; g.fillRect(x0, y0, 256, 256);
  g.fillStyle = 'rgba(80,60,40,0.06)'; // stucco stains, vertical drips
  for (let i = 0; i < 6; i++) g.fillRect(x0 + r() * 250, y0 + r() * 120, 3 + r() * 6, 40 + r() * 90);
  g.fillStyle = '#ececec'; g.fillRect(x0, y0 + 244, 256, 12);           // floor band
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0 + 244); g.lineTo(x0 + 256, y0 + 244); g.stroke();
}

function ctCell(g, x0, y0, kind, r) {
  ctWall(g, x0, y0, r);
  if (kind.startsWith('sign')) { // vertical shop sign over two thirds of the bay
    const red = kind === 'signB' || kind === 'signD';
    const bg = red ? '#d8262c' : '#f6c64a', fg = red ? '#f6c64a' : '#b01a20';
    inkRect(g, x0 + 58, y0 + 8, 140, 240, bg, 8);
    g.lineWidth = 4; g.strokeStyle = fg; g.strokeRect(x0 + 70, y0 + 20, 116, 216);
    g.strokeStyle = fg;
    for (let i = 0; i < 3; i++) glyph(g, x0 + 128, y0 + 60 + i * 68, 52, r);
    return;
  }
  const x = x0 + 72, y = y0 + 44, w = 112, h = 150;
  // arched top window in a jade frame
  g.beginPath(); g.moveTo(x - 12, y + h + 10); g.lineTo(x - 12, y + 30); g.arc(x + w / 2, y + 30, w / 2 + 12, Math.PI, 0); g.lineTo(x + w + 12, y + h + 10); g.closePath();
  g.fillStyle = kind.includes('2') ? '#e98b6d' : '#2f9e7a'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + 30); g.arc(x + w / 2, y + 30, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#3d5f73'); gr.addColorStop(1, '#1d2f3c');
  g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.stroke();
  g.save(); g.clip();
  if (kind === 'greenCurt') { g.fillStyle = '#f6c64a'; g.fillRect(x, y, 30, h); g.fillRect(x + w - 30, y, 30, h); }
  if (kind.startsWith('lanternWin')) { g.fillStyle = '#e8312f'; g.beginPath(); g.ellipse(x + w / 2, y + 70, 22, 18, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = '#f6c64a'; g.fillRect(x + w / 2 - 10, y + 50, 20, 4); g.fillRect(x + w / 2 - 10, y + 86, 20, 4); }
  if (kind === 'round') { g.fillStyle = '#f6c64a'; g.beginPath(); g.arc(x + w / 2, y + 60, 26, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(x, y + 40); g.lineTo(x + 40, y); g.lineTo(x + 60, y); g.lineTo(x, y + 90); g.fill();
  g.restore();
  g.fillStyle = INK; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + 80, w, 4);
  if (kind.startsWith('shut')) { // red louvred shutters, one open on shutOpen
    for (const s of kind === 'shutOpen' ? [-1] : [-1, 1]) {
      const sx = s < 0 ? x - 46 : x + w + 2;
      inkRect(g, sx, y + 20, 44, h - 20, '#c8302a', 4);
      g.fillStyle = '#8a1c18'; for (let i = 0; i < 9; i++) g.fillRect(sx + 6, y + 30 + i * 14, 32, 4);
    }
  }
  if (kind.startsWith('balcony')) { // jade railing over the lower third + a potted plant
    inkRect(g, x0 + 30, y0 + 186, 196, 10, '#2f9e7a', 4);
    g.fillStyle = INK; for (let i = 0; i < 12; i++) g.fillRect(x0 + 36 + i * 16, y0 + 196, 4, 44);
    inkRect(g, x0 + 30, y0 + 236, 196, 8, '#2f9e7a', 4);
  }
  if (kind === 'laundry') { // a line with three garments across the bay
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0 + 170); g.quadraticCurveTo(x0 + 128, y0 + 190, x0 + 256, y0 + 170); g.stroke();
    for (const [dx, c] of [[60, '#ffffff'], [120, '#3fb6e8'], [180, '#f6c64a']]) inkRect(g, x0 + dx - 16, y0 + 176, 32, 40, c, 3);
  }
}

function ctGlowCell(g, x0, y0, kind, r) {
  g.fillStyle = '#000000'; g.fillRect(x0, y0, 128, 128);
  if (kind.startsWith('sign')) { // signs: always-on (alpha 128), warm neon outline + glyphs
    const red = kind === 'signB' || kind === 'signD';
    g.fillStyle = red ? '#ff3b30' : '#ffc93c'; g.fillRect(x0 + 29, y0 + 4, 70, 120);
    g.strokeStyle = '#fff4c0'; g.lineWidth = 3; g.strokeRect(x0 + 35, y0 + 10, 58, 108);
    for (let i = 0; i < 3; i++) glyph(g, x0 + 64, y0 + 30 + i * 34, 26, r);
    markAlwaysOn(g, x0, y0, 128, 128);
    return;
  }
  const x = x0 + 36, y = y0 + 22, w = 56, h = 75;
  g.save(); g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + 15); g.arc(x + w / 2, y + 15, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); g.clip();
  const lantern = kind.startsWith('lanternWin') || kind === 'round';
  glowGlass(g, x, y, w, h, lantern ? '#ffb199' : '#ffe2a0', lantern ? '#ff4a3a' : '#ffa640');
  g.fillStyle = '#000'; g.fillRect(x + w / 2 - 1, y, 2, h); g.fillRect(x, y + 40, w, 2);
  g.restore();
}

export function drawChinatownAtlas(g) { const r = rng(2202); CT_KINDS.forEach((k, i) => ctCell(g, (i % 4) * 256, Math.floor(i / 4) * 256, k, r)); }
export function drawChinatownGlow(g) { const r = rng(2203); CT_KINDS.forEach((k, i) => ctGlowCell(g, (i % 4) * 128, Math.floor(i / 4) * 128, k, r)); }

// --- Neon Square: rows 0-1 = 8 curtain-wall / LED cells, rows 2-3 = 4 ads of 2 x 1 cells ---
export const NEON_ADS = [
  { t: 'AĞ SPREY', s: 'ŞİMDİ %50 DAHA YAPIŞKAN!', bg: '#ff2fa8', fg: '#ffe23a', ic: 'can' },
  { t: 'OSCORP', s: 'YARIN BUGÜNDEN İYİ. GALİBA.', bg: '#1e2140', fg: '#8cff3a', ic: 'atom' },
  { t: 'PİZZA AĞI', s: 'DİLİMİ AĞLA YAKALA!', bg: '#ffe23a', fg: '#e0262c', ic: 'pizza' },
  { t: 'STARK', s: 'ZIRH KİRALIK · SAATLİK', bg: '#c8202f', fg: '#ffd23a', ic: 'arc' },
];

function neonCell(g, x0, y0, i, r) {
  g.fillStyle = '#ffffff'; g.fillRect(x0, y0, 256, 256);
  // curtain wall: 4 x 3 glass panes, ink mullions, one neon band
  const pane = ['#3a4f8f', '#2c3a6e', '#47308a', '#253060'][i % 4];
  for (let cx = 0; cx < 4; cx++) for (let cy = 0; cy < 3; cy++) {
    const gr = g.createLinearGradient(0, y0 + cy * 80, 0, y0 + cy * 80 + 70);
    gr.addColorStop(0, '#6f86c8'); gr.addColorStop(1, pane);
    g.fillStyle = gr; g.fillRect(x0 + 8 + cx * 61, y0 + 14 + cy * 80, 55, 66);
  }
  g.fillStyle = INK;
  for (let cx = 0; cx <= 4; cx++) g.fillRect(x0 + 4 + cx * 61, y0 + 10, 5, 244);
  for (let cy = 0; cy <= 3; cy++) g.fillRect(x0 + 4, y0 + 10 + cy * 80, 249, 5);
  const band = ['#ff2fa8', '#22e6ff', '#ffe23a', '#7b3cff', '#8cff3a', '#22e6ff', '#ff2fa8', '#ffe23a'][i];
  if (i % 2 === 0) { g.fillStyle = band; g.fillRect(x0, y0 + 248, 256, 8); }
  if (i === 3 || i === 6) { // LED ticker cell: dotted strip
    g.fillStyle = '#14162a'; g.fillRect(x0 + 6, y0 + 92, 244, 72);
    g.fillStyle = band;
    for (let x = 0; x < 30; x++) for (let y = 0; y < 7; y++) if (r() < 0.45) g.fillRect(x0 + 12 + x * 8, y0 + 100 + y * 9, 5, 6);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.moveTo(x0, y0 + 60); g.lineTo(x0 + 80, y0); g.lineTo(x0 + 110, y0); g.lineTo(x0, y0 + 110); g.fill();
}

function adIcon(g, kind, cx, cy, s, fg) {
  g.lineWidth = s * 0.08; g.strokeStyle = INK; g.fillStyle = fg;
  if (kind === 'can') { g.fillRect(cx - s * 0.25, cy - s * 0.3, s * 0.5, s * 0.75); g.strokeRect(cx - s * 0.25, cy - s * 0.3, s * 0.5, s * 0.75); g.fillRect(cx - s * 0.1, cy - s * 0.48, s * 0.2, s * 0.18); g.strokeRect(cx - s * 0.1, cy - s * 0.48, s * 0.2, s * 0.18); }
  if (kind === 'atom') { for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(cx, cy, s * 0.48, s * 0.17, i * Math.PI / 3, 0, 7); g.strokeStyle = fg; g.stroke(); } g.beginPath(); g.arc(cx, cy, s * 0.1, 0, 7); g.fill(); }
  if (kind === 'pizza') { g.beginPath(); g.moveTo(cx - s * 0.4, cy - s * 0.35); g.lineTo(cx + s * 0.4, cy - s * 0.35); g.lineTo(cx, cy + s * 0.45); g.closePath(); g.fillStyle = '#ffc04a'; g.fill(); g.stroke(); g.fillStyle = '#e0262c'; for (const [dx, dy] of [[-0.15, -0.15], [0.12, -0.1], [0, 0.12]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, s * 0.07, 0, 7); g.fill(); } }
  if (kind === 'arc') { g.beginPath(); g.arc(cx, cy, s * 0.4, 0, 7); g.fillStyle = '#bff6ff'; g.fill(); g.stroke(); g.beginPath(); g.arc(cx, cy, s * 0.22, 0, 7); g.fillStyle = '#ffffff'; g.fill(); g.stroke(); }
}

export function drawAd(g, x0, y0, W, H, ad, r, glow = false) {
  if (glow) { // glow version: lettering, icon and frame bright, background at 35 % (always on)
    g.fillStyle = '#000'; g.fillRect(x0, y0, W, H);
    g.fillStyle = ad.bg; g.globalAlpha = 0.35; g.fillRect(x0, y0, W, H); g.globalAlpha = 1;
  } else {
    g.fillStyle = ad.bg; g.fillRect(x0, y0, W, H);
    // halftone corner (bottom right), 8 px pitch scaled to W
    const p = W / 64; g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += p) for (let x = 0; x < W; x += p) {
      const k = Math.max(0, (x / W) + (y / H) - 0.9) * 1.6;
      if (k > 0.05) { g.beginPath(); g.arc(x0 + x + ((y / p) % 2 ? p / 2 : 0), y0 + y, Math.min(k, 0.5) * p * 0.9, 0, 7); g.fill(); }
    }
  }
  adIcon(g, ad.ic, x0 + H * 0.5, y0 + H * 0.5, H * 0.7, ad.fg);
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  let size = H * 0.42; g.font = `${size}px ${FONT_H}`;
  const maxW = W - H * 1.05;
  if (g.measureText(ad.t).width > maxW) { size *= maxW / g.measureText(ad.t).width; g.font = `${size}px ${FONT_H}`; }
  g.lineWidth = size * 0.16; g.strokeStyle = INK; g.strokeText(ad.t, x0 + H * 0.95, y0 + H * 0.4);
  g.fillStyle = glow ? '#ffffff' : ad.fg; g.fillText(ad.t, x0 + H * 0.95, y0 + H * 0.4);
  let s2 = H * 0.13; g.font = `800 ${s2}px 'Baloo 2', sans-serif`;
  if (g.measureText(ad.s).width > maxW) { s2 *= maxW / g.measureText(ad.s).width; g.font = `800 ${s2}px 'Baloo 2', sans-serif`; }
  g.fillStyle = glow ? ad.fg : '#ffffff'; g.lineWidth = s2 * 0.25; g.strokeText(ad.s, x0 + H * 0.97, y0 + H * 0.74); g.fillText(ad.s, x0 + H * 0.97, y0 + H * 0.74);
  g.lineWidth = Math.max(4, W / 64); g.strokeStyle = glow ? ad.fg : INK; g.strokeRect(x0 + 3, y0 + 3, W - 6, H - 6);
  if (glow) markAlwaysOn(g, x0, y0, W, H);
}

export function drawNeonAtlas(g) {
  const r = rng(3303);
  for (let i = 0; i < 8; i++) neonCell(g, (i % 4) * 256, Math.floor(i / 4) * 256, i, r);
  NEON_ADS.forEach((ad, i) => drawAd(g, (i % 2) * 512, 512 + Math.floor(i / 2) * 256, 512, 256, ad, r));
}
export function drawNeonGlow(g) {
  const r = rng(3304);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) { // panes glow cool white/violet, the neon band is always on
    const x0 = (i % 4) * 128, y0 = Math.floor(i / 4) * 128;
    for (let cx = 0; cx < 4; cx++) for (let cy = 0; cy < 3; cy++) {
      if (r() < 0.3) continue;
      g.fillStyle = r() < 0.5 ? '#cfe0ff' : '#b8a8ff';
      g.fillRect(x0 + 4 + cx * 30.5, y0 + 7 + cy * 40, 27, 33);
    }
    if (i % 2 === 0) { g.fillStyle = ['#ff2fa8', '#ffe23a', '#8cff3a', '#ff2fa8'][i / 2]; g.fillRect(x0, y0 + 124, 128, 4); markAlwaysOn(g, x0, y0 + 124, 128, 4); }
  }
  NEON_ADS.forEach((ad, i) => drawAd(g, (i % 2) * 256, 256 + Math.floor(i / 2) * 128, 256, 128, ad, r, true));
}

// --- Subway tunnel / station tiles: one 1024 x 512 atlas, 4 x 2 cells of 256 ---
// cells: 0 tunnel concrete, 1 tunnel concrete + cable trays, 2 tunnel + emergency niche,
// 3 tile wall, 4 tile wall + mosaic name tablet left half, 5 right half, 6 tile + "42" mosaic,
// 7 tile + METRO arrow. Glow atlas 512 x 256: only the niche lamp and the tablets' frame.
export function drawTunnelAtlas(g) {
  const r = rng(4404);
  for (let i = 0; i < 8; i++) {
    const x0 = (i % 4) * 256, y0 = Math.floor(i / 4) * 256;
    if (i < 3) {
      g.fillStyle = '#ffffff'; g.fillRect(x0, y0, 256, 256);
      g.fillStyle = 'rgba(0,0,0,0.10)';
      for (let k = 0; k < 40; k++) g.fillRect(x0 + r() * 256, y0 + r() * 256, 2 + r() * 10, 2 + r() * 3);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, y0 + 124, 256, 6);  // form-work joint
      g.fillRect(x0 + 126, y0, 6, 256);
      if (i === 1) for (let k = 0; k < 3; k++) inkRect(g, x0, y0 + 40 + k * 14, 256, 6, '#6b6f78', 2);
      if (i === 2) { inkRect(g, x0 + 80, y0 + 140, 96, 116, '#2a2d36', 5); inkRect(g, x0 + 110, y0 + 150, 36, 16, '#ffd36b', 3); }
    } else {
      g.fillStyle = '#ffffff'; g.fillRect(x0, y0, 256, 256);
      g.fillStyle = '#d9d4c7';                                            // grout
      for (let y = 0; y < 256; y += 16) g.fillRect(x0, y0 + y, 256, 2);
      for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < 256; x += 32) g.fillRect(x0 + x, y0 + y, 2, 16);
      g.fillStyle = '#2f80c4'; g.fillRect(x0, y0 + 196, 256, 14);         // blue band
      g.fillStyle = '#f2b632'; g.fillRect(x0, y0 + 210, 256, 6);
      if (i === 4 || i === 5) { // name tablet across two cells: "ÖRÜMCEK CAD."
        inkRect(g, x0 + (i === 4 ? 24 : -8), y0 + 60, i === 4 ? 240 : 240, 96, '#7a2a1e', 6);
        g.fillStyle = '#f3e6c8'; g.fillRect(x0 + (i === 4 ? 34 : 2), y0 + 70, 220, 76);
        g.font = `64px ${FONT_H}`; g.textBaseline = 'middle'; g.fillStyle = '#1c1016';
        g.textAlign = i === 4 ? 'right' : 'left';
        g.fillText(i === 4 ? 'ÖRÜMCEK' : ' CAD.', x0 + (i === 4 ? 256 : 0), y0 + 110);
      }
      if (i === 6) { g.beginPath(); g.arc(x0 + 128, y0 + 100, 62, 0, 7); g.fillStyle = '#2f80c4'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.font = `76px ${FONT_H}`; g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.fillText('42', x0 + 128, y0 + 104); }
      if (i === 7) { inkRect(g, x0 + 30, y0 + 60, 196, 80, '#12161f', 5); g.font = `54px ${FONT_H}`; g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.fillText('METRO ►', x0 + 128, y0 + 102); }
    }
  }
}
export function drawTunnelGlow(g) {
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffd36b'; g.fillRect(256 + 55, 75, 18, 8);        // niche lamp (cell 2)
  g.fillStyle = '#ffffff'; g.fillRect(128 * 3 + 15, 128 + 30, 98, 40); // METRO sign (cell 7)
  markAlwaysOn(g, 256 + 55, 75, 18, 8);
  markAlwaysOn(g, 128 * 3 + 15, 128 + 30, 98, 40);
}

// ===================================================================== SKYLINE MASK + SKY SHADER
// 2048 x 512, channels: R = far layer, G = near layer, B = lit window dots, A = 255.
// The sky shader paints sky gradient, sun/moon, stars and tints the two layers per phase.
export function drawSkylineMask(g, W = 2048, H = 512) {
  const r = rng(99);
  g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const layer = (col, minH, maxH, minW, maxW, winChance) => {
    let x = -20;
    while (x < W) {
      const w = minW + r() * (maxW - minW), h = minH + r() * (maxH - minH);
      g.fillStyle = col; g.fillRect(x, H - h, w, h);
      if (r() < 0.25) g.fillRect(x + w * 0.25, H - h - 30 - r() * 40, w * 0.5, 60);
      if (r() < 0.12) g.fillRect(x + w * 0.5 - 2, H - h - 70, 4, 70);
      g.fillStyle = '#0000ff';
      for (let wy = H - h + 8; wy < H - 20; wy += 10) for (let wx = x + 5; wx < x + w - 5; wx += 8) if (r() < winChance) g.fillRect(wx, wy, 4, 5);
      x += w + (r() < 0.3 ? 8 : 0);
    }
  };
  layer('#ff0000', 90, 300, 40, 90, 0.35);
  g.globalCompositeOperation = 'source-over';
  // near layer overwrites R (so the near buildings are pure G)
  const near = () => {
    let x = -20;
    while (x < W) {
      const w = 50 + r() * 60, h = 70 + r() * 150;
      g.fillStyle = '#00ff00'; g.fillRect(x, H - h, w, h);
      if (r() < 0.25) g.fillRect(x + w * 0.25, H - h - 30 - r() * 40, w * 0.5, 60);
      g.fillStyle = '#00ff00';
      for (let wy = H - h + 8; wy < H - 20; wy += 10) for (let wx = x + 5; wx < x + w - 5; wx += 8) if (r() < 0.45) { g.fillStyle = '#00ffff'; g.fillRect(wx, wy, 4, 5); }
      x += w + (r() < 0.3 ? 8 : 0);
    }
  };
  near();
  // the stepped art-deco spire straight ahead (centre), near layer
  const cx = W / 2;
  g.fillStyle = '#00ff00';
  for (const [w, h] of [[64, 300], [46, 360], [30, 400], [16, 425]]) g.fillRect(cx - w / 2, H - h, w, h);
  g.fillRect(cx - 2, H - 470, 4, 50);
  g.fillStyle = '#00ffff';
  for (let wy = H - 290; wy < H - 20; wy += 10) for (let wx = cx - 28; wx < cx + 28; wx += 8) if (r() < 0.5) g.fillRect(wx, wy, 4, 5);
  g.fillRect(cx - 3, H - 476, 6, 6); // spire beacon (lit at night)
}

// ShaderMaterial for the skyline plane (700 x 175 m, as today). curve.js prepends curveWorld.
export const SKY_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * curveWorld( modelMatrix * vec4( position, 1.0 ) );
}`;
export const SKY_FRAG = /* glsl */`
uniform sampler2D uMask;
uniform vec3 uTop, uMid, uHorizon;      // sky gradient (v 1.0 / 0.45 / 0.2)
uniform vec3 uFar, uNear, uWin;          // far layer, near layer, lit window colour
uniform float uWinOn;                    // 0..1 window dots
uniform vec3 uSunCol; uniform vec3 uSun; // uSun = (u, v, radius in v units); radius 0 = none
uniform float uStars;                    // 0..1
uniform float uDots;                     // 0..1 halftone dots in the low sky
uniform float uDark;                     // 0..1 tunnel blackout
varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
  vec4 m = texture2D(uMask, vUv);
  float t = smoothstep(0.2, 0.45, vUv.y);
  vec3 sky = mix(uHorizon, uMid, t);
  sky = mix(sky, uTop, smoothstep(0.45, 1.0, vUv.y));
  // comic halftone in the lower sky: dots of the mid colour over the horizon band
  vec2 q = vec2(vUv.x * 4.0, vUv.y) * vec2(700.0, 175.0) / 2.2;   // ~2.2 m pitch on the plane
  q = vec2(q.x + q.y, q.y - q.x) * 0.70710678;
  float tone = (1.0 - smoothstep(0.18, 0.5, vUv.y)) * 0.55 * uDots;
  float d = length(fract(q) - 0.5);
  sky = mix(sky, uMid, (1.0 - smoothstep(0.62 * sqrt(tone) - 0.06, 0.62 * sqrt(tone) + 0.06, d)) * step(0.01, tone));
  // sun / moon: flat disc, ink ring, 3 rings of halo
  vec2 sp = vec2((vUv.x - uSun.x) * 4.0, vUv.y - uSun.y);
  float sd = length(sp);
  if (uSun.z > 0.0) {
    sky = mix(sky, mix(sky, uSunCol, 0.35), step(sd, uSun.z * 2.2));
    sky = mix(sky, mix(sky, uSunCol, 0.6), step(sd, uSun.z * 1.5));
    sky = mix(sky, vec3(0.11, 0.06, 0.09), step(sd, uSun.z * 1.06));
    sky = mix(sky, uSunCol, step(sd, uSun.z));
  }
  // stars: sparse 4-point twinkles above v 0.35
  vec2 sc = floor(vUv * vec2(320.0, 80.0));
  float s = step(0.985, h21(sc)) * smoothstep(0.35, 0.6, vUv.y) * uStars;
  vec2 f = fract(vUv * vec2(320.0, 80.0)) - 0.5;
  s *= step(min(abs(f.x), abs(f.y)), 0.08) * step(max(abs(f.x), abs(f.y)), 0.42);
  sky = mix(sky, vec3(1.0, 0.97, 0.85), s);
  vec3 col = mix(sky, uFar, m.r);
  col = mix(col, uNear, m.g);
  col = mix(col, uWin, m.b * uWinOn * max(m.r, m.g));
  gl_FragColor = vec4(mix(col, vec3(0.02, 0.02, 0.05), uDark), 1.0);
  #include <colorspace_fragment>
}`;

// ===================================================================== HALFTONE + NIGHT WINDOWS
// Facade materials (toonMaterial(0xffffff, { map, emissiveMap, emissive: 0xffffff, vertexColors }))
// get this hook. U = the ONE shared uniforms object of daycycle.js.
export function facadeHook(U) {
  return function (shader) {
    shader.uniforms.uHalftone = U.uHalftone;
    shader.uniforms.uDotTint = U.uDotTint;
    shader.uniforms.uBaseTone = U.uBaseTone;
    shader.uniforms.uSunLum = U.uSunLum;
    shader.uniforms.uWinOn = U.uWinOn;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uHalftone; uniform vec3 uDotTint; uniform float uBaseTone; uniform float uSunLum; uniform float uWinOn;
float htHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
  totalEmissiveRadiance *= emissiveColor.a < 0.75 ? 1.0 : step( htHash( floor( vEmissiveMapUv * 4.0 ) ), uWinOn );
#endif`)
      .replace('#include <opaque_fragment>', `{
  vec3 htBase = outgoingLight - totalEmissiveRadiance;
  const vec3 LUM = vec3( 0.299, 0.587, 0.114 );
  float htLit = dot( reflectedLight.directDiffuse, LUM ) / max( dot( diffuseColor.rgb, LUM ) * uSunLum, 1e-4 );
  float tone = max( clamp( 1.0 - htLit, 0.0, 1.0 ), uBaseTone ) * uHalftone;
  vec2 q = vMapUv * 32.0;                                   // 8 dots per window bay
  q = vec2( q.x + q.y, q.y - q.x ) * 0.70710678;             // 45 degree screen
  float d = length( fract( q ) - 0.5 );
  float r = 0.66 * sqrt( tone );
  float aa = fwidth( d ) * 0.75 + 1e-4;
  float dotM = 1.0 - smoothstep( r - aa, r + aa, d );
  float px = fwidth( q.x ) + fwidth( q.y );                 // dot cells per pixel
  float cover = mix( dotM, min( 3.14159 * r * r, 1.0 ), smoothstep( 0.35, 0.8, px ) );
  outgoingLight = mix( htBase, htBase * uDotTint, cover ) + totalEmissiveRadiance;
}
#include <opaque_fragment>`);
  };
}

// ===================================================================== WATER (Bridge)
// 512 x 512, RepeatWrapping, repeat (6, 6) on a 600 x 600 m plane; offset.y scrolls with distance.
export function drawWater(g) {
  const r = rng(5505);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);    // tinted by material.color per phase
  g.fillStyle = 'rgba(0,30,80,0.10)';
  for (let y = 0; y < 512; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 512; x += 16) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) { // comic wave ticks: a white "~" with an ink underside
    const x = r() * 512, y = r() * 512, w = 26 + r() * 30;
    for (const [dy, col, lw] of [[3, '#1c3f6e', 5], [0, '#ffffff', 5]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      g.moveTo(x - w / 2, y + dy); g.quadraticCurveTo(x - w / 4, y - 7 + dy, x, y + dy); g.quadraticCurveTo(x + w / 4, y + 7 + dy, x + w / 2, y + dy);
      g.stroke();
    }
  }
}

// ===================================================================== BUGLE BILLBOARD ATLAS
// 1024 x 1024 = 8 slots of 512 x 256 (slot i: x = (i % 2) * 512, y = floor(i / 2) * 256).
// Redrawn ONLY at load, after game over and after a name change (never during a run).
export function drawBuglePage(g, x0, y0, W, H, { kicker, headline, sub, photo = 'spidey' }) {
  g.fillStyle = '#f4f1e6'; g.fillRect(x0, y0, W, H);
  // newsprint dots
  g.fillStyle = 'rgba(28,16,22,0.06)';
  for (let y = 4; y < H; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < W; x += 6) g.fillRect(x0 + x, y0 + y, 2, 2);
  // masthead
  g.fillStyle = '#12161f'; g.fillRect(x0 + 10, y0 + 10, W - 20, 46);
  g.font = `40px ${FONT_H}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
  g.fillText('DAILY BUGLE', x0 + 22, y0 + 35);
  g.font = `800 15px 'Baloo 2', sans-serif`; g.textAlign = 'right'; g.fillStyle = '#ffd23a';
  g.fillText(kicker, x0 + W - 20, y0 + 35);
  // photo box (right third): halftone comic panel
  const px = x0 + W - 150, py = y0 + 66, pw = 138, ph = H - 78;
  g.fillStyle = '#ffd23a'; g.fillRect(px, py, pw, ph);
  g.fillStyle = 'rgba(224,38,44,0.55)';
  for (let y = 0; y < ph; y += 9) for (let x = (y / 9) % 2 ? 4.5 : 0; x < pw; x += 9) { g.beginPath(); g.arc(px + x, py + y, 1 + 3 * (y / ph), 0, 7); g.fill(); }
  if (photo === 'spidey') { // mask head, comic
    const cx = px + pw / 2, cy = py + ph * 0.52, rr = Math.min(pw, ph) * 0.36;
    g.fillStyle = '#d8262c'; g.beginPath(); g.ellipse(cx, cy, rr, rr * 1.12, 0, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.12); g.stroke(); }
    g.fillStyle = '#ffffff'; g.lineWidth = 3;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * rr * 0.42, cy - rr * 0.1, rr * 0.3, rr * 0.2, s * 0.55, 0, 7); g.fill(); g.stroke(); }
  } else { // 'venom' : black blob, white eyes, teeth
    const cx = px + pw / 2, cy = py + ph * 0.52, rr = Math.min(pw, ph) * 0.38;
    g.fillStyle = '#12161f'; g.beginPath(); g.ellipse(cx, cy, rr, rr * 1.1, 0, 0, 7); g.fill();
    g.fillStyle = '#ffffff';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * rr * 0.1, cy - rr * 0.2); g.quadraticCurveTo(cx + s * rr * 0.9, cy - rr * 0.8, cx + s * rr * 0.75, cy + rr * 0.05); g.closePath(); g.fill(); }
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(cx - rr * 0.55 + i * rr * 0.18, cy + rr * 0.35); g.lineTo(cx - rr * 0.46 + i * rr * 0.18, cy + rr * 0.6); g.lineTo(cx - rr * 0.37 + i * rr * 0.18, cy + rr * 0.35); g.fill(); }
  }
  g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(px, py, pw, ph);
  // headline, up to 2 lines, Bangers, shrink to fit
  const tw = W - 190, words = headline.split(' ');
  let size = 64, lines;
  for (;;) {
    g.font = `${size}px ${FONT_H}`;
    lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > tw && cur) { lines.push(cur); cur = w; } else cur = t; }
    lines.push(cur);
    if (lines.length <= 2 && lines.every((l) => g.measureText(l).width <= tw)) break;
    size -= 2;
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#12161f';
  const top = y0 + 66 + size * 0.92;
  lines.forEach((l, i) => g.fillText(l, x0 + 18, top + i * size * 0.98));
  // sub line + column rules
  g.font = `800 17px 'Baloo 2', sans-serif`; g.fillStyle = '#c8202f';
  g.fillText(sub, x0 + 18, y0 + H - 22);
  g.fillStyle = 'rgba(18,22,31,0.25)';
  g.fillRect(x0 + 18, y0 + H - 46, tw, 3);
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(x0 + 4, y0 + 4, W - 8, H - 8);
}

export function drawTopFive(g, x0, y0, W, H, list, me) {
  g.fillStyle = '#12161f'; g.fillRect(x0, y0, W, H);
  g.font = `40px ${FONT_H}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = INK;
  g.fillStyle = '#ffd23a'; g.fillText('ŞEHRİN EN HIZLILARI', x0 + W / 2, y0 + 30);
  const rows = list.length ? list : [{ n: '???', s: 0 }];
  rows.slice(0, 5).forEach((e, i) => {
    const y = y0 + 68 + i * 36;
    const mine = e.n === me;
    g.fillStyle = mine ? '#d8262c' : (i % 2 ? '#1c2233' : '#232a3e');
    g.fillRect(x0 + 14, y - 16, W - 28, 32);
    g.font = `30px ${FONT_H}`; g.textAlign = 'left'; g.fillStyle = i === 0 ? '#ffd23a' : '#ffffff';
    g.fillText(`${i + 1}. ${e.n || '???'}`, x0 + 26, y + 1);
    g.textAlign = 'right'; g.fillText(e.s.toLocaleString('tr-TR'), x0 + W - 26, y + 1);
  });
  g.strokeStyle = '#ffd23a'; g.lineWidth = 6; g.strokeRect(x0 + 4, y0 + 4, W - 8, H - 8);
}

export function drawRecordBoard(g, x0, y0, W, H, name, best) {
  g.save(); g.beginPath(); g.rect(x0, y0, W, H); g.clip();   // the sunburst stays inside the slot
  g.fillStyle = '#d8262c'; g.fillRect(x0, y0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < W; x += 10) { g.beginPath(); g.arc(x0 + x, y0 + y, 2.6, 0, 7); g.fill(); }
  // sunburst behind the number
  g.save(); g.translate(x0 + W / 2, y0 + H * 0.62); g.fillStyle = 'rgba(255,210,58,0.35)';
  for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -30); g.lineTo(W, 30); g.fill(); }
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = `40px ${FONT_H}`; g.lineWidth = 9; g.strokeStyle = INK; g.fillStyle = '#ffffff';
  g.strokeText('ARANIYOR: ' + name, x0 + W / 2, y0 + 44); g.fillText('ARANIYOR: ' + name, x0 + W / 2, y0 + 44);
  g.font = `96px ${FONT_H}`; g.lineWidth = 14; g.fillStyle = '#ffd23a';
  const t = best.toLocaleString('tr-TR');
  g.strokeText(t, x0 + W / 2, y0 + H * 0.62); g.fillText(t, x0 + W / 2, y0 + H * 0.62);
  g.font = `800 18px 'Baloo 2', sans-serif`; g.fillStyle = '#ffffff'; g.fillText('REKOR PUAN · ÖDÜL: YOK, ONUR VAR', x0 + W / 2, y0 + H - 24);
  g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(x0 + 4, y0 + 4, W - 8, H - 8);
  g.restore();
}

export function drawDistrictSign(g, x0, y0, W, H, text, sub, c1, c2) { // gate / arch name boards
  g.fillStyle = '#14162a'; g.fillRect(x0, y0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = `92px ${FONT_H}`;
  g.lineWidth = 22; g.strokeStyle = c1; g.globalAlpha = 0.35; g.strokeText(text, x0 + W / 2, y0 + H * 0.45);
  g.globalAlpha = 1; g.lineWidth = 8; g.strokeStyle = c1; g.strokeText(text, x0 + W / 2, y0 + H * 0.45);
  g.fillStyle = '#ffffff'; g.fillText(text, x0 + W / 2, y0 + H * 0.45);
  g.font = `800 22px 'Baloo 2', sans-serif`; g.fillStyle = c2; g.fillText(sub, x0 + W / 2, y0 + H * 0.82);
  g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(x0 + 6, y0 + 6, W - 12, H - 12);
}

// ===================================================================== BLIMP BANNER
// 512 x 128; redrawn only when the shown multiplier changes (a few times per run, 0.1 ms upload).
export function drawBlimpBanner(g, mult) {
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = '#12161f'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#ffd23a';
  for (let x = 6; x < 512; x += 14) { g.fillRect(x, 6, 6, 6); g.fillRect(x, 116, 6, 6); }  // bulb border
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = `30px ${FONT_H}`; g.fillStyle = '#ffffff'; g.fillText('ÇARPAN', 110, 66);
  g.font = `92px ${FONT_H}`; g.lineWidth = 10; g.strokeStyle = '#d8262c'; g.fillStyle = '#ffd23a';
  g.strokeText('x' + mult, 330, 68); g.fillText('x' + mult, 330, 68);
}
