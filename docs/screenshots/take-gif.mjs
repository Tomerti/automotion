// Records the README's hero animation, run.gif: the "Ends in ab" NFA running aab, as it plays.
// First: npm run build && npx vite preview --port 4173
// Then:  node docs/screenshots/take-gif.mjs [baseUrl]
//
// No dependencies beyond Playwright: PNG frames are decoded with zlib, and the GIF is encoded
// here. Each frame stores only the rectangle that changed, with unchanged pixels inside it
// transparent, so the file stays small.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const BASE = process.argv[2] ?? 'http://localhost:4173/automotion/';
const SCENES = fileURLToPath(new URL('./scenes.json', import.meta.url));
const OUT = fileURLToPath(new URL('./run.gif', import.meta.url));
const VIEWPORT = { width: 1280, height: 760 };
const HOLD_MS = 2500; // how long the verdict stays up before the loop starts again

// --- PNG decoding (8-bit RGB / RGBA, non-interlaced: what Chromium writes) -------------------

function decodePng(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const colorType = data[9];
      if (data[8] !== 8 || data[12] !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error('unsupported PNG');
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  // Packed 0xRRGGBB per pixel.
  const rgb = new Uint32Array(width * height);
  for (let i = 0; i < rgb.length; i++) {
    const o = i * channels;
    rgb[i] = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
  }
  return { width, height, rgb };
}

// --- GIF encoding ------------------------------------------------------------------------------

const TRANSPARENT = 255;

/** The 255 most used colors across all frames (index 255 is transparent). */
function buildPalette(frames) {
  const counts = new Map();
  for (const f of frames) {
    for (const c of f.rgb) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((p, q) => q[1] - p[1])
    .slice(0, 255)
    .map(([c]) => c);
}

function indexer(palette) {
  const exact = new Map(palette.map((c, i) => [c, i]));
  return (c) => {
    const hit = exact.get(c);
    if (hit !== undefined) return hit;
    const r = c >> 16;
    const g = (c >> 8) & 255;
    const b = c & 255;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = ((p >> 16) - r) ** 2 + (((p >> 8) & 255) - g) ** 2 + ((p & 255) - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    exact.set(c, best);
    return best;
  };
}

/** GIF LZW, as data sub-blocks. */
function lzw(indices, minCodeSize = 8) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = [];
  let bitBuf = 0;
  let bitLen = 0;
  let codeSize = minCodeSize + 1;
  const emit = (code) => {
    bitBuf |= code << bitLen;
    bitLen += codeSize;
    while (bitLen >= 8) {
      out.push(bitBuf & 255);
      bitBuf >>>= 8;
      bitLen -= 8;
    }
  };
  let dict = new Map();
  let next = end + 1;
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      next = end + 1;
      codeSize = minCodeSize + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(end);
  if (bitLen > 0) out.push(bitBuf & 255);
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return blocks;
}

function encodeGif(frames, palette) {
  const { width, height } = frames[0];
  const toIndex = indexer(palette);
  const bytes = [];
  const u16 = (n) => bytes.push(n & 255, (n >> 8) & 255);
  bytes.push(...Buffer.from('GIF89a'));
  u16(width);
  u16(height);
  bytes.push(0xf7, 0, 0); // global color table, 256 entries
  for (let i = 0; i < 256; i++) {
    const c = palette[i] ?? 0;
    bytes.push(c >> 16, (c >> 8) & 255, c & 255);
  }
  bytes.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever

  let prev = null;
  for (const f of frames) {
    const idx = new Uint8Array(f.rgb.length);
    for (let i = 0; i < idx.length; i++) idx[i] = toIndex(f.rgb[i]);
    // The rectangle that changed since the previous frame (all of it for the first).
    let x0 = 0;
    let y0 = 0;
    let x1 = width - 1;
    let y1 = height - 1;
    if (prev) {
      x0 = width;
      y0 = height;
      x1 = -1;
      y1 = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (idx[y * width + x] !== prev[y * width + x]) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) {
        x0 = y0 = x1 = y1 = 0; // nothing changed: a 1-pixel, fully transparent frame
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y0 + y) * width + x0 + x;
        sub[y * w + x] = prev && idx[i] === prev[i] ? TRANSPARENT : idx[i];
      }
    }
    const delay = Math.max(2, Math.round(f.delayMs / 10));
    // Graphic control: keep the previous frame (disposal 1), transparent index 255.
    bytes.push(0x21, 0xf9, 4, 0b00000101, delay & 255, (delay >> 8) & 255, TRANSPARENT, 0);
    bytes.push(0x2c);
    u16(x0);
    u16(y0);
    u16(w);
    u16(h);
    bytes.push(0);
    bytes.push(8, ...lzw(sub));
    prev = idx;
  }
  bytes.push(0x3b);
  return Buffer.from(bytes);
}

// --- Recording ---------------------------------------------------------------------------------

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('automotion:seen-help', '1'));
  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);

  // The same automata and view as run.png.
  const history = page.getByRole('navigation', { name: 'History' });
  const entry = (name) => history.getByTestId('history-item').filter({ hasText: name });
  await page.getByLabel('Import file').setInputFiles(SCENES);
  page.once('dialog', (d) => d.accept());
  await entry('Untitled').click();
  await page.keyboard.press('Delete');
  await entry('Untitled').waitFor({ state: 'detached' });
  await page
    .locator('.av-toast')
    .first()
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => {});
  await entry('Ends in ab (NFA)').click();
  await page.getByRole('button', { name: 'Fit' }).click();
  await page.getByLabel('Word').fill('aab');
  await page.mouse.move(0, 400);
  await page.waitForTimeout(600);

  // Screenshot as fast as possible while the run plays, keeping each frame's real duration.
  const shots = [];
  const grab = async () => shots.push({ at: Date.now(), png: await page.screenshot() });
  await grab();
  await page.getByLabel('Word').press('Enter');
  const verdict = page.getByTestId('verdict');
  while (!(await verdict.isVisible())) await grab();
  const until = Date.now() + 1200; // let the verdict banner settle in
  while (Date.now() < until) await grab();

  const frames = shots.map((s, i) => ({
    ...decodePng(s.png),
    delayMs: i + 1 < shots.length ? shots[i + 1].at - s.at : HOLD_MS,
  }));
  frames[0].delayMs = 900; // the word typed in, before Enter
  const gif = encodeGif(frames, buildPalette(frames));
  writeFileSync(OUT, gif);
  console.log(`wrote run.gif: ${frames.length} frames, ${(gif.length / 1024).toFixed(0)} KB`);
} finally {
  await browser.close();
}
