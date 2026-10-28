// アプリの入口から import をたどる。
//  reachable      = 実際に読み込まれるファイル(部品の隣に置いた CSS は、 その部品が読み込まれないと画面に届かない)
//  cssImportOrder = CSS が読み込まれる並び(ESM は import 文の順に依存先を先に評価し、 Vite はその順で CSS を並べる)
// 型だけの import(import type / export type)はビルドで消えるのでたどらない。
import path from 'node:path';

// 1 文ずつ: import ... from 'x' / import 'x' / export ... from 'x'(type だけのものは除く)
const STATEMENT_RE = /(?:^|[\s;])(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
const DYNAMIC_RE = /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

/** ファイル内の import の行き先を書かれた順に(型だけのものを除く) */
function specsOf(text) {
  return [...text.matchAll(STATEMENT_RE)].filter((m) => !m[2]).map((m) => m[3]);
}

function resolver(exists) {
  return (from, spec) => {
    const base = path.posix.join(path.posix.dirname(from), spec);
    return EXTS.map((e) => base + e).find((p) => /\.tsx?$/.test(p) && exists(p)) ?? null;
  };
}

export function reachable(entry, readFile, exists) {
  const resolve = resolver(exists);
  const staticFiles = new Set();
  const dynamicFiles = new Set();
  const walk = (start, set, onDynamic) => {
    const queue = [start];
    while (queue.length) {
      const file = queue.pop();
      if (set.has(file)) continue;
      set.add(file);
      const text = readFile(file);
      for (const spec of specsOf(text)) {
        const next = resolve(file, spec);
        if (next) queue.push(next);
      }
      for (const m of text.matchAll(DYNAMIC_RE)) {
        const next = resolve(file, m[1]);
        if (next) onDynamic(next);
      }
    }
  };
  const dynamicStarts = [];
  walk(entry, staticFiles, (f) => dynamicStarts.push(f));
  for (let i = 0; i < dynamicStarts.length; i++) {
    walk(dynamicStarts[i], dynamicFiles, (f) => dynamicStarts.push(f));
  }
  for (const f of staticFiles) dynamicFiles.delete(f);
  return { staticFiles, dynamicFiles };
}

/** 入口から普通の import だけで読まれる CSS を、 ビルドで並ぶ順に返す */
export function cssImportOrder(entry, readFile, exists) {
  const resolve = resolver(exists);
  const visited = new Set();
  const order = [];
  const seenCss = new Set();
  const visit = (file) => {
    visited.add(file);
    for (const spec of specsOf(readFile(file))) {
      if (spec.endsWith('.css')) {
        const css = path.posix.join(path.posix.dirname(file), spec);
        if (!seenCss.has(css)) {
          seenCss.add(css);
          order.push(css);
        }
        continue;
      }
      const next = resolve(file, spec);
      if (next && !visited.has(next)) visit(next);
    }
  };
  visit(entry);
  return order;
}
