// Generates build/icon.png — a simple clock-face app icon — using only Node's
// built-in zlib, so there are no opaque committed binaries and the asset can be
// regenerated deterministically with `node scripts/generate-icon.js`.

const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const SIZE = 256;

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Build RGBA pixels.
const cx = SIZE / 2;
const cy = SIZE / 2;
const R = SIZE / 2 - 6;

function blend(base, over, a) {
  return Math.round(base * (1 - a) + over * a);
}

// Accent gradient colors.
const bgTop = [79, 140, 255];
const bgBot = [124, 92, 246];
const face = [17, 24, 39];
const hand = [237, 242, 255];

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1)); // +1 filter byte per row
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let r = 0, g = 0, b = 0, a = 0;

    if (dist <= R) {
      // rounded gradient background
      const t = y / SIZE;
      r = Math.round(bgTop[0] * (1 - t) + bgBot[0] * t);
      g = Math.round(bgTop[1] * (1 - t) + bgBot[1] * t);
      b = Math.round(bgTop[2] * (1 - t) + bgBot[2] * t);
      a = 255;

      // inner face disc
      if (dist <= R * 0.8) {
        r = face[0]; g = face[1]; b = face[2];
      }

      // clock hands (drawn as thick line segments from center)
      // hour hand pointing up-right (~10 o'clock -> 2 o'clock feel)
      const drawHand = (angle, length, width) => {
        const ex = cx + Math.sin(angle) * length;
        const ey = cy - Math.cos(angle) * length;
        // distance from point (x,y) to segment (cx,cy)-(ex,ey)
        const vx = ex - cx, vy = ey - cy;
        const wx = x - cx, wy = y - cy;
        const len2 = vx * vx + vy * vy;
        let tt = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
        tt = Math.max(0, Math.min(1, tt));
        const px = cx + tt * vx, py = cy + tt * vy;
        const d2 = Math.hypot(x - px, y - py);
        if (d2 <= width) {
          r = hand[0]; g = hand[1]; b = hand[2];
        }
      };
      if (dist <= R * 0.8) {
        drawHand(Math.PI * 0.33, R * 0.42, 6); // hour
        drawHand(Math.PI * 1.1, R * 0.62, 4); // minute
        // center hub
        if (dist <= 8) {
          r = hand[0]; g = hand[1]; b = hand[2];
        }
      }

      // simple antialiasing at the outer edge
      if (dist > R - 1.5) {
        a = Math.round(blend(0, 255, Math.max(0, R - dist + 1.5) / 1.5));
      }
    }

    raw[p++] = r;
    raw[p++] = g;
    raw[p++] = b;
    raw[p++] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
