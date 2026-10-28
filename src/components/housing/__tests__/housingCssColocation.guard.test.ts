import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
// @ts-expect-error mjs の共通部品(型定義なし)
import { findOrderPairs, parseRules } from '../../../../scripts/housing-css/cssRules.mjs';
// @ts-expect-error mjs の共通部品(型定義なし)
import { classGroups } from '../../../../scripts/housing-css/classGroups.mjs';

// ハウジングの CSS は「部品の隣に <部品名>.css を置き、部品が import する」(2026-10-28 移行・設計書
// docs/superpowers/specs/2026-10-28-housing-css-colocation-design.md)。共有は src/styles/housing/ の許可したものだけ。
// 部品の CSS 同士で同じ要素の同じ性質を同じ詳細度で書くと、読み込み順で勝ち負けが変わる(=順番頼り)ので禁止。
const SRC = resolve(__dirname, '../../..');
const HOUSING = resolve(__dirname, '..');
const SHARED_DIR = join(SRC, 'styles/housing');

/** src/styles/housing/ に置いてよい共有ファイル(なぜ共有か) */
const SHARED_ALLOW: Record<string, string> = {
  'tokens.css': '色・寸法などのトークン',
  'shell-frame.css': '画面全体の外枠・背景',
  'shell-header.css': '上のヘッダー・タブ・検索の外枠',
  'primitives.css': '3 つ以上の機能で使う下地(ボタン・入力欄・項目・スピナー・窓の背景・出現の動き・骨組み・フォーカス枠)',
  'page-frame.css': '全画面ページ(詳細・編集・ハウジンガー・短縮リンク)の共通の外枠',
  'ward-map.css': '地図の土台(ツアー案内・区画地図・開発用の作図ページ)',
  'theme-reveal.css': '昼夜切替の画面全体の動き',
  'scale-pc.css': 'PC の表示倍率',
  'scale-svg-icons.css': 'SVG アイコンの倍率',
  'center-tokens.css': '中央パネルの倍率トークン(scripts/housing-scale/center-tokens.mjs が生成)',
};

/** JSX に見つからない規則の置き場(減らすだけ。確かめて消したらここからも消す) */
const UNUSED_ALLOW = [
  '02-filter-panel.css', '04-register-ward-minimap.css', '05-favorites-modal.css', '06-manner-dialog.css', '07-skeleton.css',
  '08-toast.css', '09-register-field-badge.css', '10-register-form-base.css', '11-register-image-upload.css',
  '12-register-checklist.css', '16-register-confirm-summary.css', '17-login-account.css', '19-detail.css',
  '24-report-guide-modal.css', '29-register-page-layout.css', '39-browse-housinger-view.css', '42-card-marquee.css',
  '47-tour-add-temp-house.css', '53-tour-invite.css', '54-theme-reveal.css', '62-mobile-layout.css',
];

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== '__tests__') walk(p, ext, out);
    } else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

const componentCss = walk(HOUSING, '.css');
const rel = (p: string) => relative(SRC, p).replace(/\\/g, '/');

describe('ハウジング CSS の置き場所', () => {
  it('部品の CSS は同じフォルダの .tsx が import している', () => {
    const orphans = componentCss.filter((css) => {
      const line = `import './${basename(css)}';`;
      return !readdirSync(dirname(css))
        .filter((n) => n.endsWith('.tsx'))
        .some((n) => readFileSync(join(dirname(css), n), 'utf8').includes(line));
    });
    expect(orphans.map(rel), '同じフォルダの部品から import されていない CSS(置き去り)').toEqual([]);
  });

  it('共有フォルダは許可したファイルだけ', () => {
    const shared = readdirSync(SHARED_DIR).filter((n) => n !== 'unused').sort();
    expect(shared, '新しい共有は SHARED_ALLOW に理由つきで足す。部品の見た目なら部品の隣へ').toEqual(Object.keys(SHARED_ALLOW).sort());
    const unused = readdirSync(join(SHARED_DIR, 'unused'));
    const added = unused.filter((n) => !UNUSED_ALLOW.includes(n));
    expect(added, 'unused/ は減らすだけ').toEqual([]);
  });

  it('部品の CSS 同士で順番頼りが無い', () => {
    const rules = componentCss.flatMap((f) => parseRules(readFileSync(f, 'utf8'), rel(f)));
    const related = classGroups(walk(SRC, '.tsx').map((f) => readFileSync(f, 'utf8')));
    const cross = findOrderPairs(rules, related)
      .filter(([a, b]: Array<{ file: string }>) => a.file !== b.file)
      .map(([a, b, prop]: [{ file: string; selector: string; media: string }, { file: string; selector: string }, string]) =>
        `[${prop}] ${a.media ? `@media ${a.media} ` : ''}${a.selector} (${a.file}) ⇄ ${b.selector} (${b.file})`);
    expect(cross, '同じ要素の同じ性質を別の部品の CSS が同じ詳細度で書いている。上書きされる側の部品の CSS にまとめる').toEqual([]);
  });
});
