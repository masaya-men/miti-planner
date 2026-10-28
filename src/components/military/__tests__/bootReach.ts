import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

// src/main.tsx から「静的 import」だけをたどって届く .ts/.tsx(動的 import()・React.lazy・型だけの import は除く)。
// 起動時に読まれる部品の CSS は、後読みの共有との勝ち負けが逆転しうるので、見張り(militaryCssColocation.guard)が使う。
const STATIC_IMPORT = /(?:^|\n)[ \t]*(?:import(?!\s+type\b)[^'"();]*?from\s*|import\s+|export\s[^'"();]*?from\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const TS_EXT = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

export interface BootGraphIO {
  read: (srcRel: string) => string | undefined;
}

/** entry(src からの相対パス)から静的 import でたどれる .ts/.tsx と、それらが import する相対 CSS(どちらも src からの相対パス) */
export function bootReach(entry: string, io: BootGraphIO): { files: Set<string>; css: Map<string, string[]> } {
  const files = new Set<string>();
  const css = new Map<string, string[]>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (files.has(f)) continue;
    const text = io.read(f);
    if (text === undefined) continue;
    files.add(f);
    for (const m of text.matchAll(STATIC_IMPORT)) {
      const base = posix.join(posix.dirname(f), m[1]);
      if (base.endsWith('.css')) {
        css.set(f, [...(css.get(f) ?? []), base]);
        continue;
      }
      const hit = TS_EXT.map((e) => base + e).find((p) => /\.tsx?$/.test(p) && io.read(p) !== undefined);
      if (hit) stack.push(hit);
    }
  }
  return { files, css };
}

/** 実ファイルを読む io(src を根にする) */
export function fsBootIO(src: string): BootGraphIO {
  return { read: (p) => { const abs = join(src, p); return existsSync(abs) ? readFileSync(abs, 'utf8') : undefined; } };
}
