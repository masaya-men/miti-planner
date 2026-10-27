import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// ハウジングの窓は HousingPanelModal(見出し付きのガラス窓)か HousingDialogShell(小さな確認窓)を使う
// (2026-10-27 整頓⑥)。どちらも Esc は一番上だけ・外側クリックは入力後ガード付き。殻を使わない窓が増えたらここで止める。
// 共通の ModalShell 側の見張り(src/components/ui/__tests__/ModalShell.guard.test.ts)はハウジングを対象外にしている。
const ROOT = resolve(__dirname, '..');

/** 殻そのもの */
const SHELLS = ['HousingPanelModal.tsx', 'HousingDialogShell.tsx'];

/** 窓ではない(閉じない終了画面・窓の有無を見るだけ)。窓になったら殻を使い、ここから消す。 */
const NOT_WINDOW: Record<string, string> = {
  'pages/JoinTourPage.tsx': 'ツアー終了の画面(閉じずにボタンで移動する)',
  'pages/TourNavPage.tsx': 'ツアー終了の画面(閉じずにボタンで移動する)',
  'shell/HousingPullToRefresh.tsx': '窓が開いているかを調べるだけ',
};

// 画面を覆う窓の目印: aria-modal / ハウジングの背景クラス・背景色トークン / 全面固定
const isOverlay = (src: string) =>
  /aria-modal|className="[^"]*housing-[a-z-]*backdrop|--housing-detail-backdrop-bg|fixed inset-0/.test(src);
const usesShell = (src: string) => /<HousingPanelModal\b|<HousingDialogShell\b/.test(src);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

const files = walk(ROOT).map((full) => ({
  key: relative(ROOT, full).replace(/\\/g, '/'),
  src: readFileSync(full, 'utf8'),
}));

describe('ハウジングの窓は殻(HousingPanelModal / HousingDialogShell)を使う', () => {
  it('殻を使わない新しい窓が無い', () => {
    const offenders = files
      .filter((f) => !SHELLS.includes(f.key) && !(f.key in NOT_WINDOW))
      .filter((f) => isOverlay(f.src) && !usesShell(f.src))
      .map((f) => f.key);
    expect(offenders, '窓は HousingPanelModal か HousingDialogShell を使う').toEqual([]);
  });

  it('殻を使う窓が自前で Esc を聞いていない(重なると下の窓まで閉じるため)', () => {
    const selfEsc = files
      .filter((f) => !SHELLS.includes(f.key) && isOverlay(f.src) && usesShell(f.src))
      .filter((f) => /key === ['"]Escape['"]/.test(f.src))
      .map((f) => f.key);
    expect(selfEsc).toEqual([]);
  });

  it('一覧の古い記載が残っていない', () => {
    const stale = Object.keys(NOT_WINDOW).filter((key) => {
      const f = files.find((x) => x.key === key);
      return !f || !isOverlay(f.src) || usesShell(f.src);
    });
    expect(stale).toEqual([]);
  });
});
