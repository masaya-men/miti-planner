import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

// src の .ts/.tsx の相対 import のつながり(テスト・型定義は除く)。見張り用。
// 「class を書く部品が、その class の CSS を読む部品と必ず一緒に描かれるか」を確かめるのに使う。

/**
 * コメントと「要素を探すだけ」のセレクタ(closest・querySelector・matches の引数)を除いた本文。
 * class 名がそこに出るだけの部品は描いていないので書き手にしない。
 */
const stripComments = (text: string) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
  .replace(/\.(closest|querySelector|querySelectorAll|matches)\(\s*(['"`])[^'"`]*\2/g, '.$1(');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

export interface ImportGraph {
  /** src からの相対パス(/ 区切り) → コメントを除いた本文 */
  code: Map<string, string>;
  /** a が直接 import するファイル */
  deps: Map<string, Set<string>>;
  /** a を直接 import するファイル */
  users: Map<string, Set<string>>;
}

export function buildImportGraph(src: string): ImportGraph {
  const files = walk(src).map((f) => relative(src, f).replace(/\\/g, '/'));
  const known = new Set(files);
  const code = new Map(files.map((f) => [f, stripComments(readFileSync(join(src, f), 'utf8'))]));
  const deps = new Map<string, Set<string>>();
  const users = new Map<string, Set<string>>(files.map((f) => [f, new Set<string>()]));
  for (const f of files) {
    const out = new Set<string>();
    for (const m of code.get(f)!.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const base = posix.join(posix.dirname(f), m[1]);
      const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((p) => known.has(p));
      if (hit) {
        out.add(hit);
        users.get(hit)!.add(f);
      }
    }
    deps.set(f, out);
  }
  return { code, deps, users };
}

/**
 * owner(CSS を読む部品)の見た目に頼ってよい書き手か。
 * よい = owner 自身 / owner を直接描く部品(書き手本人だけ) / owner の中でしか使われない子(使う側をたどると全部 owner)。
 * 他の画面からも使われる子は、owner が無くても描かれる=見た目が欠ける(または読み込み順頼み)ので不可。
 * 「owner を描く親の下にいる兄弟」も不可(親が owner をやめると崩れる)。
 */
export function dependsOnOwner(graph: ImportGraph, owner: string) {
  const memo = new Map<string, boolean>();
  const ok = (w: string, stack: Set<string>): boolean => {
    if (w === owner) return true;
    if (memo.has(w)) return memo.get(w)!;
    if (stack.has(w)) return true;
    stack.add(w);
    const us = [...(graph.users.get(w) ?? [])];
    const r = us.length > 0 && us.every((u) => ok(u, stack));
    stack.delete(w);
    memo.set(w, r);
    return r;
  };
  return (writer: string) => !!graph.deps.get(writer)?.has(owner) || ok(writer, new Set());
}

/** css(src からの相対パス)を import している部品 */
export function cssImporters(graph: ImportGraph, css: string): string[] {
  return [...graph.code.keys()].filter((f) =>
    [...graph.code.get(f)!.matchAll(/import\s+['"](\.{1,2}\/[^'"]+\.css)['"]/g)].some((m) => posix.join(posix.dirname(f), m[1]) === css));
}
