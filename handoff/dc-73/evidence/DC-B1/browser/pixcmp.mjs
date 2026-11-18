// Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced) + pixel comparison. Usage: node pixcmp.mjs a.png b.png
import fs from 'node:fs'; import zlib from 'node:zlib';
const dec = f => { const b = fs.readFileSync(f); let p = 8, w, h, ct, idat = [];
  while (p < b.length) { const n = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('unsupported'); } if (t === 'IDAT') idat.push(d); p += 12 + n; }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * bpp), st = w * bpp;
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], s = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1));
    for (let x = 0; x < st; x++) { const a = x >= bpp ? out[y * st + x - bpp] : 0, u = y ? out[(y - 1) * st + x] : 0, c = x >= bpp && y ? out[(y - 1) * st + x - bpp] : 0;
      const pa = Math.abs(u - c), pb = Math.abs(a - c), pc = Math.abs(a + u - 2 * c), pr = pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      out[y * st + x] = (s[x] + [0, a, u, (a + u) >> 1, pr][f]) & 255; } }
  return { w, h, bpp, out }; };
const [A, B] = process.argv.slice(2).map(dec);
let diff = 0; if (A.w !== B.w || A.h !== B.h || A.bpp !== B.bpp) diff = -1; else for (let i = 0; i < A.out.length; i += A.bpp) if (A.out.compare(B.out, i, i + A.bpp, i, i + A.bpp)) diff++;
console.log(`${process.argv[2].split('/').pop()} vs ${process.argv[3].split('/').pop()}: ${A.w}x${A.h}, differing pixels ${diff}`);
process.exitCode = diff ? 1 : 0;
