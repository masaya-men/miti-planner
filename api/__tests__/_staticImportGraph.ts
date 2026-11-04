/**
 * テスト用ヘルパー: 入口ファイルから「静的 import」で到達するファイルと bare specifier の集合を返す。
 *
 * - `import ... from '...'` / `import '...'` / `export ... from '...'` を辿る。
 * - `import type` / `export type` と動的 `import('...')` は除外(起動時に読まれないため)。
 * - 相対の `.js` は `.ts` に読み替える(api/ は NodeNext で `.js` 拡張子付き import)。
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// 行頭の import/export 文(複数行にまたがる `{ ... }` も含む)の from 句 or 副作用 import を拾う。
const STATIC_RE = /^\s*(import|export)\s+(type\s+)?([^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

function resolveRelative(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    base,
    `${base}.ts`,
    resolve(base, 'index.ts'),
  ];
  for (const c of candidates) {
    if (existsSync(c) && /\.(ts|tsx|js|mjs)$/.test(c)) return c;
  }
  return null;
}

export function collectStaticImports(entryAbsPath: string): { files: Set<string>; bareSpecifiers: Set<string> } {
  const files = new Set<string>();
  const bareSpecifiers = new Set<string>();
  const stack = [entryAbsPath];
  while (stack.length > 0) {
    const file = stack.pop();
    if (files.has(file)) continue;
    files.add(file);
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(STATIC_RE)) {
      const isTypeOnly = Boolean(m[2]);
      const spec = m[4];
      if (isTypeOnly) continue;
      // `export { a }` のような from 無し export は m[3] 無しでも spec を拾わない(正規表現上 '...' が無い)
      if (m[1] === 'export' && !m[3]) continue;
      if (spec.startsWith('.')) {
        const target = resolveRelative(file, spec);
        if (target) stack.push(target);
      } else {
        bareSpecifiers.add(spec);
      }
    }
  }
  return { files, bareSpecifiers };
}
