/**
 * 検査用の道具: src/ の import のつながり(どのファイルがどのファイルを読むか)を作る。
 *
 * 仕事はこれだけ。循環を探す側は noCircularImports.test.ts。
 * madge の自前の読み取りは「import 先を探すたびに TypeScript の解決処理を最初からやり直す」ため
 * 約 2000 ファイルで 16〜40 秒かかり、全体テストの同時実行で 60 秒を超えて落ちていた。
 * ここでは ts.preProcessFile(構文木を作らない軽い読み取り)で import 文だけ拾い、
 * 相対パスだけを自前で解決する(tsconfig.app.json に paths/baseUrl が無いので、
 * 相対でない import = npm パッケージで、循環には関わらない)。
 * 拾う範囲は madge と同じ: import / import type / export ... from / 動的 import() / require()。
 */
import fs from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const SOURCE_EXT = /\.(tsx?|mjs|jsx?)$/;
/** 相対 import の末尾に足して探す候補(拡張子なし・ディレクトリ index) */
const SUFFIXES = ['', '.ts', '.tsx', '.js', '.mjs', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

const forward = (p: string) => p.split(sep).join('/');

function listSources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listSources(p, out);
    else if (SOURCE_EXT.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function isFile(p: string): boolean {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

/** './x.js' と書いてあっても実体が x.ts のことがある(ESM の書き方)ので、その候補も作る */
function candidates(base: string): string[] {
  const alt = /\.(m?js)$/.test(base) ? [base.replace(/\.m?js$/, '.ts'), base.replace(/\.m?js$/, '.tsx')] : [];
  return [...SUFFIXES.map((s) => base + s), ...alt];
}

/**
 * srcDir 配下の全ファイルから import をたどったグラフ({ ファイル: [読んでいるファイル] })。
 * キーは srcDir からの相対パス(madge と同じ表記)。src の外(api/・scripts/)へ出ても、
 * そこから辿れるファイルは madge と同様にグラフへ入れる。
 */
export function buildImportGraph(srcDir: string): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const key = (f: string) => forward(relative(srcDir, f));
  const queue = listSources(srcDir);
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i];
    const info = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true);
    const deps = new Set<string>();
    for (const imp of info.importedFiles) {
      if (!imp.fileName.startsWith('.')) continue;
      const hit = candidates(resolve(dirname(file), imp.fileName)).find((c) => SOURCE_EXT.test(c) && isFile(c));
      if (!hit) continue;
      deps.add(key(hit));
      if (!seen.has(hit)) { seen.add(hit); queue.push(hit); }
    }
    graph[key(file)] = [...deps].sort();
  }
  return graph;
}
