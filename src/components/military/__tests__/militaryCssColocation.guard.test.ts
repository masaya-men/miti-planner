import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
// @ts-expect-error mjs の共通部品(型定義なし)
import { findOrderPairs, parseRules } from '../../../../scripts/css-colocation/cssRules.mjs';
// @ts-expect-error mjs の共通部品(型定義なし)
import { classGroups } from '../../../../scripts/css-colocation/classGroups.mjs';

// MIL-SPEC の CSS は「部品の隣に <部品名>.css を置き、部品が import する」(2026-10-28 移行・設計書
// docs/superpowers/specs/2026-10-28-military-css-colocation-design.md)。共有は src/styles/military/ の許可したものだけ。
// 部品の CSS はほぼ遅延読み込みで、後読みの CSS 同士の並びは画面を開いた順で変わる。部品の CSS 同士で
// 同じ要素の同じ性質を同じ詳細度で書くと、開き方次第で勝ち負けが変わる(=順番頼り)ので禁止。
const SRC = resolve(__dirname, '../../..');
const MILITARY = resolve(__dirname, '..');
const SHARED_DIR = join(SRC, 'styles/military');
const PREFIX = /^milspec-/;

/** src/styles/military/ に置いてよい共有ファイル(なぜ共有か)。入口 src/styles/military.css が起動時に読む */
const SHARED_ALLOW: Record<string, string> = {
  'palette.css': 'MIL-SPEC の色の決まり(--ms-* / --ma-*)。全部品が使う',
  'semantic-tokens.css': '本番の意味トークン(--color-* 等)を MIL-SPEC へ付け替える。標準の部品にも効く',
  'standard-revert.css': 'ボードの中に描く窓(.glass-tier3)を標準の見た目へ掛け戻す。標準の部品に効く',
  'backdrop.css': '画面全体の背景・走査線・フォント(標準の Layout が描く [data-app-shell] に効く)',
  'standard-parts.css': '標準の部品を .theme-military で描き変える規則。標準の部品は MIL-SPEC の後読みより先に画面に出る',
  'boot-parts.css': '起動時から読まれる MIL-SPEC 部品(src/main.tsx から静的 import で届く)の見た目。後読みに置くと共有との勝ち負けが逆転しうる',
  'primitives.css': '3 つ以上の MIL-SPEC 部品が使う共通部品(装甲板・基板・押下フィードバック等)',
};

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p, ext, out);
    } else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

const componentCss = walk(MILITARY, '.css');
const rel = (p: string) => relative(SRC, p).replace(/\\/g, '/');

describe('MIL-SPEC CSS の置き場所', () => {
  it('部品の CSS は同じフォルダの .tsx が import している', () => {
    const orphans = componentCss.filter((css) => {
      const line = `import './${basename(css)}';`;
      return !readdirSync(dirname(css))
        .filter((n) => n.endsWith('.tsx'))
        .some((n) => readFileSync(join(dirname(css), n), 'utf8').includes(line));
    });
    expect(orphans.map(rel), '同じフォルダの部品から import されていない CSS(置き去り・別フォルダからの import)').toEqual([]);
  });

  it('共有フォルダは許可したファイルだけ', () => {
    // 使われていない規則の置き場 unused/ は 10-28 に確かめて全部消した。使わない規則は置いておかずに消す
    const shared = readdirSync(SHARED_DIR).sort();
    expect(shared, '新しい共有は SHARED_ALLOW に理由つきで足す。部品の見た目なら部品の隣へ').toEqual(Object.keys(SHARED_ALLOW).sort());
  });

  it('部品の CSS 同士で順番頼りが無い', () => {
    const rules = componentCss.flatMap((f) => parseRules(readFileSync(f, 'utf8'), rel(f)));
    const related = classGroups(walk(SRC, '.tsx').map((f) => readFileSync(f, 'utf8')), PREFIX);
    // rightNames: .milspec-key:hover .sh と .milspec-keybtn:hover .sh のように別の祖先を経て同じ要素に効く組も拾う
    const cross = findOrderPairs(rules, related, PREFIX, { rightNames: true })
      .filter(([a, b]: Array<{ file: string }>) => a.file !== b.file)
      .map(([a, b, prop]: [{ file: string; selector: string; media: string }, { file: string; selector: string }, string]) =>
        `[${prop}] ${a.media ? `@media ${a.media} ` : ''}${a.selector} (${a.file}) ⇄ ${b.selector} (${b.file})`);
    expect(cross, '同じ要素の同じ性質を別の部品の CSS が同じ詳細度で書いている。上書きされる側の部品の CSS にまとめる').toEqual([]);
  });
});
