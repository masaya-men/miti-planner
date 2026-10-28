/**
 * 検査: ブラウザ標準のツールチップ(HTML の title 属性)を新しく増やさない。
 *
 * 目的: アプリのツールチップは LoPo の部品 `src/components/ui/Tooltip` に統一する。
 *   title 属性だと灰色のブラウザ標準の箱が出てしまい、見た目が揃わず、スプシ表示の
 *   「+(数)」のような取りこぼしが起きた(2026-10-23)。
 *
 * 方式(歯止め): src/ 配下の .tsx で、小文字のタグ(button / span / div / a / img など
 *   = 本物の HTML 要素)に付いた `title=` を数える。
 *   - 下の ALLOWED に「ファイル → 今ある個数」を書いてある。今あるものは許可。
 *   - 許可より増える、または許可に無いファイルに新しく出たら、このテストが落ちる。
 *   - 直して減ったら、ALLOWED の数も減らす(減る分には落ちない)。
 * 数えない: 大文字のコンポーネント(`<Modal title=...>` は部品の props で HTML の title ではない)、
 *   svg の `<title>` 要素、input の placeholder、コメント内、テストファイル。
 *
 * 新しい UI でツールチップが要るときは `import { Tooltip } from '.../ui/Tooltip'` で包む。
 *   どうしても title が要る箇所(読み上げ専用の補助など)は理由を添えて ALLOWED に足す。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..');

/** ファイル(src からの相対・/ 区切り) → 許可する title 属性の個数 */
const ALLOWED: Record<string, number> = {
  'components/LocalImportDialog.tsx': 1,
  'components/LoginModal.tsx': 2,
  'components/MitigationSheetPreview.tsx': 2,
  'components/PipView.tsx': 11,
  'components/PulseSettings.tsx': 1,
  'components/admin/AdminSkills.tsx': 1,
  'components/gridImport/GridImportPhaseBar.tsx': 1,
  'components/gridImport/GridView.tsx': 1,
  'components/housing/browse/ListingCard.tsx': 2,
  'components/housing/browse/TourTrayRow.tsx': 1,
  'components/housing/listing/HousingActionBar.tsx': 1,
  'components/housing/listing/HousingPhotoGallery.tsx': 1,
  'components/housing/listing/HousingShareButton.tsx': 1,
  'components/housing/housinger/HousingerIdentity.tsx': 2,
  'components/housing/register/HousingRegisterFieldBadge.tsx': 1,
  'components/housing/shell/AppHeader.tsx': 1,
  'components/housing/tour/TourInvitePanel.tsx': 1,
  'components/housing/tour/TourMobileBar.tsx': 1,
  'components/housing/tour/TourVisitedList.tsx': 1,
  'components/housing/workspace/HousingCardVideoOverlay.tsx': 1,
  'components/military/MilspecContentTree.tsx': 3,
  'components/military/MilspecNotifBeacon.tsx': 1,
  'components/military/MilspecRail.tsx': 1,
  'components/military/MilspecVent.tsx': 1,
  'components/military/header/AuxPanel.tsx': 1,
  'components/military/header/ModeLever.tsx': 1,
  'components/military/header/ThemeRocker.tsx': 1,
  'components/progress/ActivityScrub.tsx': 1,
  'components/progress/ProgressRecordPanel.tsx': 1,
  'components/share/ShareOgPreview.tsx': 1,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(p, out);
    } else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

// コメント(行コメントとブロックコメント)を空白に置き換える(行数は保つ)
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (_m, pre) => pre);
}

/** 小文字タグ(HTML 要素)に付いた title= の個数 */
export function countNativeTitleAttrs(source: string): number {
  const code = stripComments(source);
  let count = 0;
  const re = /(?<![\w.-])title=(?=[{"'])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    // 直前の「<タグ名」を探す(属性の途中の > は => や } 内にもあるので、最後の <英字 を採る)
    const head = code.slice(0, m.index);
    const tag = /<([A-Za-z][\w.]*)(?=[\s/>])(?![\s\S]*<[A-Za-z][\w.]*[\s/>])/.exec(head.slice(Math.max(0, head.length - 4000)));
    const name = tag?.[1] ?? '';
    if (/^[a-z]/.test(name)) count++;
  }
  return count;
}

describe('ブラウザ標準の title 属性を増やさない', () => {
  it('数え方: 小文字タグの title= だけ数える', () => {
    expect(countNativeTitleAttrs('<button title="a" />')).toBe(1);
    expect(countNativeTitleAttrs('<span\n  className="x"\n  title={t("k")}\n>')).toBe(1);
    expect(countNativeTitleAttrs('<Modal title="a" />')).toBe(0);
    expect(countNativeTitleAttrs('<svg><title>a</title></svg>')).toBe(0);
    expect(countNativeTitleAttrs('// <button title="a">\n<div />')).toBe(0);
    expect(countNativeTitleAttrs('<input placeholder="a" />')).toBe(0);
  });

  it('許可リストより増えていない', () => {
    const actual: Record<string, number> = {};
    for (const f of walk(SRC)) {
      const n = countNativeTitleAttrs(readFileSync(f, 'utf8'));
      if (n > 0) actual[relative(SRC, f).split(sep).join('/')] = n;
    }
    if (process.env.PRINT_TITLE_ALLOWED) {
      console.log(Object.entries(actual).sort().map(([k, v]) => `  '${k}': ${v},`).join('\n'));
    }
    const over = Object.entries(actual)
      .filter(([f, n]) => n > (ALLOWED[f] ?? 0))
      .map(([f, n]) => `${f}: ${n} 個(許可 ${ALLOWED[f] ?? 0})`);
    expect(over, 'title 属性が増えています。LoPo の Tooltip(src/components/ui/Tooltip)で包んでください:\n' + over.join('\n')).toEqual([]);
  });
});
