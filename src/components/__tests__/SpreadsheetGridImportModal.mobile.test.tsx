// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';
import { useIsMobile } from '../../hooks/useIsMobile';
import { JA, interpolate, DEFAULT_SEL, goToGridStep, matrixTSV } from './gridImportModalTestSetup';

// templateLoader をモック: デフォルトは null(テンプレなし)。テスト内で上書き可。
vi.mock('../../data/templateLoader', () => ({
  getTemplate: vi.fn().mockResolvedValue(null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => interpolate(JA[k] ?? k, vars),
    i18n: { language: 'ja' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));

// マトリクス/メンバー順テスト用にタンク+ヒーラー+DPS のジョブを用意。
// パラディン=ナイト(tank)・白魔=ヒーラー・忍者=DPS。
vi.mock('../../hooks/useSkillsData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useSkillsData')>();
  return {
    ...actual,
    getJobsFromStore: () => [
      { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' },
      { id: 'whm', name: { ja: '白魔道士', en: 'White Mage' }, role: 'healer', icon: '' },
      { id: 'nin', name: { ja: '忍者', en: 'Ninja' }, role: 'dps', icon: '' },
    ],
    getMitigationsFromStore: () => [
      { id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 20, type: 'all', value: 0 },
      { id: 'asylum_whm', jobId: 'whm', name: { ja: 'アサイラム', en: 'Asylum' }, recast: 0, duration: 24, type: 'all', value: 0 },
    ],
  };
});

describe('SpreadsheetGridImportModal（スマホ分岐）', () => {
  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(true);
  });
  afterEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it('スマホでは Step2 に貼付 textarea を出し、編集グリッドを出さない', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 貼付 textarea がある
    expect(screen.getByLabelText('スプレッドシートを貼り付け')).toBeInTheDocument();
    // PC グリッドの貼付サーフェス(Ctrl+V プロンプト)は出ない
    expect(screen.queryByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)')).toBeNull();
    // 列ごと貼り付けトグルも出ない
    expect(screen.queryByText('列ごとに貼り付け')).toBeNull();
  });

  it('未貼付では「パーティ割当へ」は無効、貼付後に有効化＋確認サマリー表示', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 未貼付ガード: matrix 判定前は source==='none' で「割当へ」disabled
    const nextBtn = screen.getByText('パーティ割当へ').closest('button')!;
    expect(nextBtn).toBeDisabled();
    // textarea へ matrix TSV を流し込む(onChange 経由)
    fireEvent.change(screen.getByLabelText('スプレッドシートを貼り付け'), { target: { value: matrixTSV() } });
    // 確認サマリーが出る(イベント1件検出)
    expect(screen.getByText('読み取りました — 1件のイベントを検出')).toBeInTheDocument();
    // ガード解除
    expect(nextBtn).not.toBeDisabled();
  });

  it('スマホ grid: メンバー列ごとに枠割当リストを出し、割当で作成可能になる', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 2 タンク列(同ジョブ)= 自動割当されず未割当
    fireEvent.change(screen.getByLabelText('スプレッドシートを貼り付け'), {
      target: { value: '時間\tナイト\tナイト\n0:16\tランパート\tランパート\n' },
    });
    // 割当リストの見出しが出る
    expect(screen.getByText('パーティの枠を割り当て')).toBeInTheDocument();
    // 枠 select が 2 つ(メンバー列 2)
    const selects = screen.getAllByLabelText('枠は？');
    expect(selects.length).toBe(2);
    // 作成ボタンは未割当で無効
    const createBtn = screen.getByText('この内容で作成').closest('button')!;
    expect(createBtn).toBeDisabled();
    // 2 列に MT/ST を割り当て
    fireEvent.change(selects[0], { target: { value: 'MT' } });
    fireEvent.change(selects[1], { target: { value: 'ST' } });
    // 作成可能に
    expect(createBtn).not.toBeDisabled();
  });
});
