import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * 入口 CSS の `@import "./xxx.css";` を順番どおりにたどり、中身を 1 本につなげた文字列を返す。
 * housing.css は入口(@import の並び)だけで、本体は src/styles/housing/*.css に分けてあるため、
 * CSS を文字で読むテストはこれ経由で読む。
 */
export function readCssBundle(entryPath: string): string {
  const entry = readFileSync(entryPath, 'utf8');
  const dir = dirname(entryPath);
  const importRe = /@import\s+["']([^"']+)["']\s*;/g;
  let out = '';
  let last = 0;
  for (const m of entry.matchAll(importRe)) {
    if (!m[1].startsWith('.')) continue; // @import "tailwindcss" のようなパッケージ指定は展開しない
    out += entry.slice(last, m.index);
    out += readCssBundle(resolve(dir, m[1]));
    last = (m.index ?? 0) + m[0].length;
  }
  return out + entry.slice(last);
}
