// colocate.mjs の「書き出し」部分。 計画(planColocation の結果)を実際のファイルへ反映する。
// 書き始める前に全部の行き先を検査し、 1 つでも書けない物があれば何も書き換えずに止まる(途中で止まって半端に残さない)。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { render, addCssImport, removeCssImport } from './planColocation.mjs';

/** 実ファイルに書く io。 テストは同じ形の記憶上の io を渡す */
export const realIO = {
  read: (f) => fs.readFileSync(f, 'utf8'),
  write: (f, text) => fs.writeFileSync(f, text),
  rm: (f) => fs.rmSync(f),
  exists: (f) => fs.existsSync(f),
  mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
  gitRmCached: (f) => execFileSync('git', ['rm', '--cached', '-q', f]),
};

/**
 * @param {object} args
 * @param {object} args.p        planColocation の結果
 * @param {object} args.sc       対象ごとの設定(scopes/<名前>.mjs)
 * @param {Array}  args.sources  移す元の CSS(role つき)
 * @param {string[]} [args.only] 部品フォルダ以下の絞り込み
 */
export function applyPlan({ p, sc, sources, only, io = realIO }) {
  const C = sc.componentsDir;
  const inScope = (out) => {
    if (!only) return true;
    const rel = out.startsWith(`${sc.sharedDir}/`) ? '_shared' : path.posix.dirname(out).slice(C.length + 1) || '.';
    return only.some((o) => (o === '.' ? rel === '.' : rel === o || rel.startsWith(`${o}/`)));
  };
  const moving = p.units.filter((u) => u.dest.out && inScope(u.dest.out));
  const importerOf = new Map(moving.map((u) => [u.dest.out, u.dest.importer]));
  const outputs = render(p.units, (u) => (u.dest.out && inScope(u.dest.out) ? u.dest.out : null));
  const remaining = render(p.units, (u) => (u.dest.out && inScope(u.dest.out) ? null : u.src));
  const touched = new Set(moving.map((u) => u.src));
  const isShared = (out) => out.startsWith(`${sc.sharedDir}/`);
  /** 行き先の共有ファイルが「足せる元ファイル」か */
  const appendable = (out) => sources.some((s) => s.file === out && s.role !== 'pending') && existsAfterRemoval(out);

  // 書く前の検査: 書けない行き先をすべて集める(元のファイルが空になって消える物は、 消えた後の状態で見る)
  const willRemove = new Set(sources.filter((s) => touched.has(s.file) && !remaining.get(s.file)).map((s) => s.file));
  const existsAfterRemoval = (f) => io.exists(f) && !willRemove.has(f);
  const problems = [];
  if (!io.exists(sc.entry)) problems.push(`入口 ${sc.entry} が無い`);
  for (const s of sources) {
    if (!touched.has(s.file)) continue;
    for (const tsx of remaining.get(s.file) ? [] : s.importers ?? []) if (!io.exists(tsx)) problems.push(`${s.file} を読んでいた ${tsx} が無い`);
  }
  for (const out of outputs.keys()) {
    if (appendable(out)) continue;
    if (isShared(out)) {
      if (existsAfterRemoval(out)) problems.push(`${out} が既にある`);
      continue;
    }
    const tsx = importerOf.get(out);
    if (!tsx || !io.exists(tsx)) problems.push(`${out} を import する部品 ${tsx ?? '(不明)'} が無い`);
    // 部品の隣に同名の CSS が既にあれば末尾に足す。 同名が無い新規は、 元のファイルを消した大文字小文字違いでなければそのまま作れる
  }
  if (problems.length) throw new Error(`書き出せない行き先があるので、 何も書き換えずに止めた:\n- ${problems.join('\n- ')}`);

  let entryText = io.read(sc.entry).replace(/\r\n/g, '\n');
  // 先に元のファイルを書き換える。 空になったものは消し、 読んでいた import(入口の @import か部品の import)も消す
  // (古い名前 milspecFooter.css → 新しい名前 MilspecFooter.css のような大文字小文字だけの改名を Windows で書けるように)
  const removed = [];
  for (const s of sources) {
    if (!touched.has(s.file)) continue;
    const css = remaining.get(s.file);
    if (css) {
      io.write(s.file, css);
      continue;
    }
    io.rm(s.file);
    removed.push(s.file);
    if (!s.importers) entryText = entryText.replace(`${sc.importLine(s.file)}\n`, '');
    for (const tsx of s.importers ?? []) {
      const spec = path.posix.relative(path.posix.dirname(tsx), s.file);
      io.write(tsx, removeCssImport(io.read(tsx), spec));
    }
  }
  const sharedImports = [];
  for (const [out, css] of outputs) {
    const name = path.basename(out, '.css');
    // 行き先が残る共有の元ファイル(例 military の primitives.css)なら末尾に足す(元の並び=共有の規則が先、 を保つ)
    if (appendable(out)) {
      io.write(out, `${io.read(out).replace(/\s*$/, '\n\n')}${css}`);
      continue;
    }
    // 部品の隣に同名の CSS が既にあれば末尾に足す(部品はもう import している。 addCssImport は二重に足さない)
    if (!isShared(out) && io.exists(out)) {
      io.write(out, `${io.read(out).replace(/\s*$/, '\n\n')}${css}`);
      const tsx = importerOf.get(out);
      io.write(tsx, addCssImport(io.read(tsx), `${name}.css`));
      continue;
    }
    // 大文字小文字だけ違う古いファイルを消した場合、 git(大文字小文字を区別しない設定)の索引に古い名前が残るので外す
    const caseTwin = removed.find((f) => f !== out && f.toLowerCase() === out.toLowerCase());
    if (caseTwin) io.gitRmCached(caseTwin);
    if (isShared(out)) {
      const isUnused = out.startsWith(`${sc.unusedDir}/`);
      const head = isUnused ? sc.sharedHeader.unused : (sc.sharedHeader[name] ?? `/* 共有: ${name} */`);
      io.mkdir(path.dirname(out));
      io.write(out, `${head}\n${css}`);
      sharedImports.push(sc.importLine(out));
      continue;
    }
    io.write(out, sc.header(name) + css);
    const tsx = importerOf.get(out);
    io.write(tsx, addCssImport(io.read(tsx), `${name}.css`));
  }
  if (sharedImports.length) entryText = sc.addSharedImports(entryText, sharedImports);
  io.write(sc.entry, entryText);
  return { outputs: outputs.size, moving: moving.length };
}
