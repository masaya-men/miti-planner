// アプリの入口から import をたどり、 実際に読み込まれるファイルを集める。
// 部品の隣に置いた CSS は、 その部品が読み込まれないと画面に届かないため、 持ち主の候補をここで絞る。
// 返り値: staticFiles = 入口から普通の import だけで届くファイル / dynamicFiles = import() を経て初めて届くファイル
import path from 'node:path';

const SPEC_RE = [
  /(?:^|[\s;])(?:import|export)\s[^'";]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g,
  /(?:^|[\s;])import\s*['"](\.{1,2}\/[^'"]+)['"]/g,
];
const DYNAMIC_RE = /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

export function reachable(entry, readFile, exists) {
  const resolve = (from, spec) => {
    const base = path.posix.join(path.posix.dirname(from), spec);
    return EXTS.map((e) => base + e).find((p) => /\.tsx?$/.test(p) && exists(p)) ?? null;
  };
  const staticFiles = new Set();
  const dynamicFiles = new Set();
  const walk = (start, set, onDynamic) => {
    const queue = [start];
    while (queue.length) {
      const file = queue.pop();
      if (set.has(file)) continue;
      set.add(file);
      const text = readFile(file);
      for (const re of SPEC_RE) {
        for (const m of text.matchAll(re)) {
          const next = resolve(file, m[1]);
          if (next) queue.push(next);
        }
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
