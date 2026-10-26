// @ts-check
/**
 * 見本画像の生成(1 回だけ実行して images/*.png をコミットする)。
 *   node scripts/visual-regress/fixtures/make-images.mjs
 * 写真用 12 枚(1200x800)= 色相を 30° ずつずらした単色 + 中央に大きく番号。
 * アバター用 4 枚(256x256)= 同様に色相違い + 番号。
 * SVG を読むのはこの生成スクリプトだけ(アプリ側は SVG 読込禁止のため PNG に落とす)。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'images');
fs.mkdirSync(OUT, { recursive: true });

/** HSL(度, 0-1, 0-1) → #rrggbb */
function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

async function make(file, w, h, hue, label) {
  const size = Math.round(Math.min(w, h) * 0.6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${hsl(hue, 0.55, 0.5)}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="700" font-size="${size}" fill="#ffffff">${label}</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, file));
}

for (let i = 0; i < 12; i++) await make(`photo-${String(i + 1).padStart(2, '0')}.png`, 1200, 800, i * 30, String(i + 1));
for (let i = 0; i < 4; i++) await make(`avatar-${i + 1}.png`, 256, 256, i * 90 + 15, String(i + 1));
console.log('生成:', fs.readdirSync(OUT).length, '枚');
