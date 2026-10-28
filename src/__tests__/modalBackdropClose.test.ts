/**
 * 検査: 全画面の背景(窓の後ろの暗幕)を持つ部品は、必ず backdropClose を使う。
 *
 * 目的: 窓の外側クリックの挙動(押し始めも離しも背景のときだけ閉じる・下の要素へ貫通しない・
 *   入力途中は自動で閉じない)を `src/utils/backdropClose.ts` に一本化してある。
 *   窓ごとに自前の onClick を書くと、挙動が揃わず保守できなくなる(2026-10-23 に約 30 個を統一)。
 *
 * 方式(歯止め): src/ 配下の .tsx で、同じ行に `fixed` と `inset-0` が両方ある要素(=全画面の背景になりうる要素)
 *   を持つファイルが、backdropClose を使っていなければ落ちる。
 *   - 下の ALLOWED は「今ある例外」。窓の背景ではない全画面要素(レイアウト・オーバーレイ・チュートリアル等)や、
 *     まだ未統一の窓。理由を添えてある。
 *   - 新しく窓を作るときは共通の殻 `ModalShell`(src/components/ui/ModalShell.tsx・中で backdropClose を使う)を使う。窓以外の全画面要素なら理由を添えて ALLOWED に足す。
 *   - 統一できたら ALLOWED から消す(消す方向は落ちない)。
 * 数えない: テストファイル。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..');

/** 許可リスト(src からの相対・/ 区切り) → 理由 */
const ALLOWED: Record<string, string> = {
  // 窓の背景ではない全画面要素
  'components/AppFooter.tsx': '窓ではない(フッターの全画面要素)',
  'components/GridOverlay.tsx': '窓ではない(グリッド表示)',
  'components/ImportProgressOverlay.tsx': '進行表示。外側クリックでは閉じない',
  'components/LanguageSwitcher.tsx': '小さなドロップダウン(別方式)',
  'components/layout/AuthRedirectingOverlay.tsx': 'ログイン処理中の全画面表示(窓ではない)',
  'components/layout/LayoutOverlays.tsx': 'スマホのカンペ全画面表示(窓ではない)',
  'components/MobileFab.tsx': '窓ではない(浮遊ボタン)',
  'components/MobileGuide.tsx': 'ガイド表示(別方式)',
  'components/pip/PipEditMenu.tsx': 'ピクチャーインピクチャー表示',
  'components/RenderPendingIndicator.tsx': '窓ではない(描画待ちの表示)',
  'components/landing/LandingPage.tsx': 'ランディングページ',
  'components/military/MilspecLayout.tsx': 'アプリ全体のレイアウト',
  'components/progress/ProgressCelebration.tsx': '演出表示',
  'components/tutorial/TutorialBlocker.tsx': 'チュートリアルの操作制御',
  'components/tutorial/TutorialOverlay.tsx': 'チュートリアルの表示',
  'components/tutorial/animations/CompletionCard.tsx': 'チュートリアルの演出',
  'components/tutorial/animations/FakeCompletionCard.tsx': 'チュートリアルの演出',
  // 窓だが未統一(要対応)
  'components/LimitResolutionSheet.tsx': '要統一(下から出るシート。背景クリックは自前の onClick)',
  'components/WelcomeSetup.tsx': '要統一(初回設定。意図的に閉じない可能性)',
  'components/admin/AdminSystemNotifications.tsx': '管理画面(別担当)',
  'components/admin/CsvImportModal.tsx': '管理画面(別担当)',
  'components/admin/FflogsTimelineImportModal.tsx': '管理画面(別担当)',
  'components/admin/FflogsTranslationModal.tsx': '管理画面(別担当)',
  'components/admin/PlanToTemplateModal.tsx': '管理画面(別担当)',
  'components/admin/SheetTargetMatchModal.tsx': '管理画面(別担当)',
  'components/admin/SkillFormModal.tsx': '管理画面(別担当)',
  'components/housing/HousingDuplicateWarningDialog.tsx': 'ハウジング(独自トンマナ・別担当)',
  'components/housing/HousingOnboardingDialog.tsx': 'ハウジング(独自トンマナ・別担当)',
  'components/housing/register/HousingRegisterImageField.tsx': 'ハウジング(独自トンマナ・別担当)',
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

const hasFullScreenLayer = (src: string) =>
  src.split('\n').some((l) => /\bfixed\b/.test(l) && /\binset-0\b/.test(l));

describe('全画面の背景を持つ部品は backdropClose を使う', () => {
  const offenders: string[] = [];
  const staleAllowed: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).split(sep).join('/');
    const src = readFileSync(file, 'utf8');
    if (!hasFullScreenLayer(src)) { if (rel in ALLOWED) staleAllowed.push(rel); continue; }
    if (src.includes('backdropClose') || src.includes('<ModalShell')) continue;
    if (!(rel in ALLOWED)) offenders.push(rel);
  }
  it('backdropClose を使っていない全画面の背景が新しく増えていない', () => {
    expect(offenders, `backdropClose を使うか、理由つきで ALLOWED に足す: ${offenders.join(', ')}`).toEqual([]);
  });
  it('許可リストに、もう該当しない古いファイルが残っていない', () => {
    expect(staleAllowed).toEqual([]);
  });
});
