import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import postcss from 'postcss';
// @ts-expect-error mjs の共通部品(型定義なし)
import { findOrderPairs, parseRules, subjectClasses } from '../../../scripts/css-colocation/cssRules.mjs';
// @ts-expect-error mjs の共通部品(型定義なし)
import { classGroups } from '../../../scripts/css-colocation/classGroups.mjs';
// @ts-expect-error mjs の設定(型定義なし)
import { CLASSES, prefixRe } from '../../../scripts/css-colocation/scopes/index.mjs';
import { buildImportGraph, cssImporters, dependsOnOwner } from './importGraph';

// 標準の部品の CSS は「部品の隣に <部品名>.css を置き、部品が import する」(2026-10-28 移行・設計書
// docs/superpowers/specs/2026-10-28-index-css-colocation-design.md)。共有は src/styles/base/ の許可したものだけ。
// 部品の CSS はほぼ遅延読み込みで、後読みの CSS 同士の並びは画面を開いた順で変わる。部品の CSS 同士で
// 同じ要素の同じ性質を同じ詳細度で書くと、開き方次第で勝ち負けが変わる(=順番頼り)ので禁止。
const SRC = resolve(__dirname, '../..');
const SHARED_DIR = join(SRC, 'styles/base');
const COMPONENTS = join(SRC, 'components');

/** src/styles/base/ に置いてよい共有ファイル(なぜ共有か)。入口 src/index.css が起動時に読む */
const SHARED_ALLOW: Record<string, string> = {
  'tokens-admin.css': '管理画面のトークン。全画面で効く',
  'tokens-dark.css': 'ダークテーマのトークン(色・寸法)。全部品が使う',
  'tokens-light.css': 'ライトテーマのトークン(色・寸法)。全部品が使う',
  'tokens-columns.css': 'タイムラインの列幅トークン(--col-*)。複数部品と計算が読む',
  'global.css': 'html・body・* など全体に効く規則',
  'glass.css': '3 部品以上が使う共通部品(.glass-* の面)',
  'shared-parts.css': '3 部品以上が使う共通部品(サイドバー項目・スクロールバー等)',
  'properties.css': '@property。部品の隣へ移すと Tailwind が作る未対応ブラウザ向けの初期値が消えるため共有',
};

/** 入口 src/index.css に置いてよい @ルール。@theme は @import 先へ移すと Tailwind の規則が消えるので入口に残す */
const ENTRY_AT_RULES = ['import', 'source', 'custom-variant', 'theme', 'keyframes'];
/** @theme(--animate-*)が使う keyframes */
const ENTRY_KEYFRAMES = ['ripple', 'gearSpin'];

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p, ext, out);
    } else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

const rel = (p: string) => relative(SRC, p).replace(/\\/g, '/');
// housing・military は別の移行で済み(それぞれの見張りが守る)
const componentCss = walk(COMPONENTS, '.css').filter((f) => !/[\\/](housing|military)[\\/]/.test(f));
const sharedCss = readdirSync(SHARED_DIR).filter((n) => n.endsWith('.css'));
/** CLASSES にあるが規則が残っていない class(recast-row=RecastRow.css にコメントで名前が出るだけ・旧ラッパーは廃止済み/
 *  water-drop・glass-tier1=どの部品も使わず unused/ に置いていた規則を 10-28 に消した) */
const NO_RULE = ['recast-row', 'water-drop', 'glass-tier1'];
/** 同じフォルダの部品でなく、上のフォルダの部品が import する CSS(今回の移行より前から。理由つきで足す) */
const IMPORTED_FROM_PARENT: Record<string, string> = {
  'components/timeline/sheet/sheet.css': 'スプシ表示の複数部品が共有する見た目。Timeline.tsx が import する',
};
const classSet = new Set<string>(CLASSES);

describe('標準の CSS の置き場所(index.css 移行後)', () => {
  it('src/styles/base/ には許可一覧のファイルしか無い', () => {
    // 使われていない規則の置き場 unused/ は 10-28 に確かめて消した。使わない規則は置いておかずに消す
    const entries = readdirSync(SHARED_DIR).sort();
    expect(entries, '新しい共有は SHARED_ALLOW に理由つきで足す。部品の見た目なら部品の隣へ').toEqual(Object.keys(SHARED_ALLOW).sort());
  });

  it('入口 index.css は Tailwind の設定・@import・@theme・@theme が使う keyframes(ripple・gearSpin)だけ', () => {
    const root = postcss.parse(readFileSync(join(SRC, 'index.css'), 'utf8'));
    const bad: string[] = [];
    for (const n of root.nodes) {
      if (n.type === 'comment') continue;
      if (n.type !== 'atrule' || !ENTRY_AT_RULES.includes(n.name)) bad.push(n.toString().slice(0, 60));
      else if (n.name === 'keyframes' && !ENTRY_KEYFRAMES.includes(n.params)) bad.push(`@keyframes ${n.params}`);
    }
    expect(bad, '入口に書いてよいのは Tailwind の行・@import・@theme・ripple/gearSpin だけ。規則は部品の隣か共有へ').toEqual([]);
    const first = root.nodes.find((n) => n.type !== 'comment');
    expect(first?.toString(), '@import "tailwindcss" が先頭でないと Tailwind が @import 先の中身を捨てる').toBe('@import "tailwindcss"');
  });

  it('CLASSES の規則は共有(src/styles/base/)に無く、 部品の隣の CSS にあり、 その CSS は同じフォルダの部品が import している', () => {
    const inShared: string[] = [];
    for (const n of sharedCss) {
      for (const r of parseRules(readFileSync(join(SHARED_DIR, n), 'utf8'), n)) {
        if (r.type === 'atrule' || !r.selector) continue;
        if (subjectClasses(r.selector, prefixRe).some((c: string) => classSet.has(c))) inShared.push(`${n}: ${r.selector}`);
      }
    }
    expect(inShared, 'CLASSES の class は部品の隣の CSS に置く。共有へ戻さない').toEqual([]);

    // 規則のセレクタに出る class(右端でなくても数える)
    const found = new Set<string>();
    for (const f of componentCss) {
      for (const r of parseRules(readFileSync(f, 'utf8'), rel(f))) {
        for (const m of (r.selector ?? '').matchAll(/\.([\w-]+)/g)) found.add(m[1]);
      }
    }
    const missing = CLASSES.filter((c: string) => !found.has(c) && !NO_RULE.includes(c));
    expect(missing, '部品の隣の CSS に規則が見つからない class').toEqual([]);

    const orphans = componentCss.filter((css) => !(rel(css) in IMPORTED_FROM_PARENT)).filter((css) => {
      const line = `import './${basename(css)}';`;
      return !readdirSync(dirname(css))
        .filter((n) => /\.tsx?$/.test(n))
        .some((n) => readFileSync(join(dirname(css), n), 'utf8').includes(line));
    });
    expect(orphans.map(rel), '同じフォルダの部品から import されていない CSS').toEqual([]);
  });

  // 2026-10-28 追加: MitigationSheetPreview が自分の見た目を持たず、隣の MitigationSheet.css に頼っていた
  // (MitigationSheet を消すと上限整理・共有取り込みのプレビューが崩れる)。同じ形を新しく作らせない。
  it('部品の CSS の class を書く部品は、その CSS を読む部品と必ず一緒に描かれる(他の部品の CSS に頼らない)', () => {
    const graph = buildImportGraph(SRC);
    // 部品の class(- か _ を含む名前)。テーマの印は対象外
    const anyClass = /^(?!(theme-(light|dark|military)|milspec-app)$)\w+[-_][\w-]+$/;
    const bad: string[] = [];
    for (const css of componentCss) {
      const owners = cssImporters(graph, rel(css));
      const oks = owners.map((o) => dependsOnOwner(graph, o));
      const subjects = new Set<string>();
      for (const r of parseRules(readFileSync(css, 'utf8'), rel(css))) {
        if (r.type === 'atrule' || !r.selector) continue;
        for (const c of subjectClasses(r.selector, anyClass)) subjects.add(c);
      }
      for (const c of subjects) {
        const re = new RegExp(`(?<![\\w-])${c.replace(/-/g, '\\-')}(?![\\w-])`);
        for (const [file, text] of graph.code) {
          if (re.test(text) && !oks.some((ok) => ok(file))) bad.push(`.${c}(${rel(css)})を ${file} が書いている`);
        }
      }
    }
    expect(bad, 'その部品の見た目はその部品の隣の CSS へ(他の画面からも使う子部品は、親の CSS に頼らず自分の CSS を持つ)').toEqual([]);
  });

  it('部品 CSS 同士の順番頼りの組は 0', () => {
    const rules = componentCss.flatMap((f) => parseRules(readFileSync(f, 'utf8'), rel(f)));
    const related = classGroups(walk(SRC, '.tsx').map((f) => readFileSync(f, 'utf8')), prefixRe);
    const cross = findOrderPairs(rules, related, prefixRe, { rightNames: true })
      .filter(([a, b]: Array<{ file: string }>) => a.file !== b.file)
      .map(([a, b, prop]: [{ file: string; selector: string; media: string }, { file: string; selector: string }, string]) =>
        `[${prop}] ${a.media ? `@media ${a.media} ` : ''}${a.selector} (${a.file}) ⇄ ${b.selector} (${b.file})`);
    expect(cross, '同じ要素の同じ性質を別の部品の CSS が同じ詳細度で書いている。上書きされる側の部品の CSS にまとめる').toEqual([]);
  });
});

