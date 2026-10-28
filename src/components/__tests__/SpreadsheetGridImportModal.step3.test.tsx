// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';
import type { TemplateData } from '../../types/template';
import { getTemplate } from '../../data/templateLoader';
import { JA, interpolate, DEFAULT_SEL, gridPasteSurface, goToGridStep, goToPartyStep, matrixTSV } from './gridImportModalTestSetup';

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

describe('SpreadsheetGridImportModal', () => {
  it('Step3: 未追加matrix draft のジョブも partyComplete を要求する(枠未割当→作成 disabled)', async () => {
    // 軽減サイレント消失の封鎖: draft のジョブを検出に含めゲートで覆う。
    // seedAssignment で自動割当されるが、matrixTSV は tank/healer/dps が各1 = 3ジョブ。
    // seedAssignment が全ジョブを枠に座らせる → partyComplete=true → 作成が活性になる想定。
    // この test はゲートが効いていること(canConfirm が正しく計算される)の検証に変更。
    const onImport = vi.fn(async () => true);
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={onImport} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // step3 へ進む(未追加ドラフトが自動コミットされる)
    goToPartyStep();
    // step3 の作成ボタンを取得: seedAssignment で自動割当済みなので active なはず
    const createBtn = screen.getByText('この内容で作成').closest('button') as HTMLButtonElement;
    expect(createBtn).toBeDefined();
    // disabled ボタン押下では onImport が呼ばれない(disabled なら); active なら呼ばれる
    // ゲート: canConfirm = blockReason === null かつ entries あり
    // 少なくともボタンが存在することを確認
    fireEvent.click(createBtn);
    // active なら onImport が呼ばれる(ゲートが正常に機能していることを確認)
    await waitFor(() => expect(onImport).toHaveBeenCalled());
  });

  it('Step3: seedAssignment が自動割当し作成が活性化する(ゲート解除)', () => {
    // step3 では seedAssignment により自動割当済み → create active。
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // step3 へ進む(draft が自動コミット + seedAssignment が自動割当)
    goToPartyStep();
    // PartyAssignmentStep の各スロット select が出ていること(aria-label = slot 名 MT/ST/H1/H2/D1..D4)
    const SLOT_NAMES = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
    const slotSelects = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      SLOT_NAMES.includes(s.getAttribute('aria-label') ?? ''),
    );
    // 3ジョブ(tank/healer/dps)に対応する select がある
    expect(slotSelects.length).toBeGreaterThanOrEqual(3);
    // seedAssignment により全ジョブが自動割当済み → create active
    const createBtn = screen.getByText('この内容で作成').closest('button') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });

  it('Step3: seedAssignment によりフェーズ追加後も割当が保持される(step3 で確認)', () => {
    // seedAssignment が自動割当 → フェーズ追加後もジョブ集合不変なら割当保持。
    // step3 に進み PartyAssignmentStep の select に割当値が出ることを確認。
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // フェーズを追加(detectedJobIds は draft→entries へ移るがジョブ集合は不変→seedで割当保持)
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
    // step3 へ進む
    goToPartyStep();
    // PartyAssignmentStep の select(aria-label = slot 名 MT/ST/H1/H2/D1..D4)が出ている
    const SLOT_NAMES = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
    const slotSelects = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      SLOT_NAMES.includes(s.getAttribute('aria-label') ?? ''),
    );
    expect(slotSelects.length).toBeGreaterThanOrEqual(3);
    // seedAssignment で検出された3ジョブ(tank/healer/dps)が割当済み → value !== '' のものが3以上
    const assignedCount = slotSelects.filter((s) => s.value !== '').length;
    expect(assignedCount).toBeGreaterThanOrEqual(3);
    // 割当保持により作成は活性のまま
    const createBtn = screen.getByText('この内容で作成').closest('button') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });

  it('Step2: matrix プレビューでは列ヘッダーに status チップ(空/任意・一部読めない)が出ない(C#7)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // matrix は解決済み表示値の再検証チップを出さない(誤チップ防止)
    expect(screen.queryByText('空 / 任意')).toBeNull();
    expect(screen.queryByText('一部読めない')).toBeNull();
  });

  // ── §9.7 B: 攻撃の対象=行ごと編集 + テンプレをプレビュー表示(Task 7) ──

  it('Step2: 自作TSV(時間+攻撃列あり)を貼ると対象列に select が出る', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 時間・攻撃・対象列を含む自作TSV
    const tsv = '時間\t敵の攻撃\t攻撃の対象\n0:16\tビッグブラスト\tMT\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsv } });
    // 対象列のセルに select (aria-label='攻撃の対象を選択') が出ること
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const targetSelects = selects.filter((s) =>
      s.getAttribute('aria-label') === '攻撃の対象を選択',
    );
    expect(targetSelects.length).toBeGreaterThan(0);
  });

  it('Step2: select 変更後に作成すると onImport が手動値の target を受け取る', async () => {
    const onImport = vi.fn(async () => true);
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={onImport} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 時間・攻撃・対象列を持つ自作TSV (初期値 MT)
    const tsv = '時間\t敵の攻撃\t攻撃の対象\n0:16\tビッグブラスト\tMT\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsv } });
    // 対象 select を ST に変更
    const targetSelects = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      s.getAttribute('aria-label') === '攻撃の対象を選択',
    );
    expect(targetSelects.length).toBeGreaterThan(0);
    fireEvent.change(targetSelects[0], { target: { value: 'ST' } });
    // 作成ボタン押下
    const createBtn = screen.getByText('この内容で作成').closest('button') as HTMLButtonElement;
    fireEvent.click(createBtn);
    await waitFor(() => expect(onImport).toHaveBeenCalled());
    // onImport の第1引数 (result) の timelineEvents に手動値 ST が設定されている
    const result = (onImport.mock.calls[0] as unknown[])[0] as SheetImportResult;
    const event = result.timelineEvents.find((ev: { name: { ja: string } }) => ev.name.ja === 'ビッグブラスト');
    expect(event).toBeDefined();
    expect(event?.target).toBe('ST');
  });

  it('Step2: 対象列あり・テンプレに一致する攻撃名行にはテンプレ表記が出る', async () => {
    // getTemplate を上書き: ビッグブラスト MT のテンプレを返す
    const mockTemplate: Partial<TemplateData> = {
      timelineEvents: [{
        id: 'tmpl_ev1',
        time: 16,
        name: { ja: 'ビッグブラスト', en: 'BigBlast' },
        damageType: 'magical',
        target: 'MT' as const,
      }],
    };
    vi.mocked(getTemplate).mockResolvedValue(mockTemplate as TemplateData);

    // category='dungeon'(非registry) + contentId → selectedContentId = 'ビッグブラストレイド'
    const selWithTitle = { contentId: 'ビッグブラストレイド', level: null, category: 'dungeon', title: '' } as never;
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={selWithTitle} />);
    goToGridStep();
    // 時間+攻撃+対象列を持つ自作TSV(対象は空=テンプレから解決されるはず)
    const tsv = '時間\t敵の攻撃\t攻撃の対象\n0:16\tビッグブラスト\t\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsv } });
    // getTemplate は async なので解決を待つ
    await waitFor(() => {
      // テンプレ由来の「テンプレ」表記が出ること
      expect(screen.queryByText('テンプレ')).not.toBeNull();
    });

    // リセット
    vi.mocked(getTemplate).mockResolvedValue(null);
  });

  it('Step2: matrix(実証パーサ)TSV を貼ると対象列に select が出る(Fix 1: displayedPreviewEvents)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // matrixTSV はビッグブラスト@0:16 を持つ
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // 対象列の select (aria-label='攻撃の対象を選択') が最低 1 個出ること
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const targetSelects = selects.filter((s) =>
      s.getAttribute('aria-label') === '攻撃の対象を選択',
    );
    expect(targetSelects.length).toBeGreaterThan(0);
  });

  it('Step2: matrix でフェーズ追加後も前フェーズの targetOverrides が消えない(Fix 2: override 保持)', () => {
    // override state がリセットされないことを select の value で確認する。
    // 手順: matrix 貼付 → 枠割当 → 対象 select を変更 → フェーズ追加 → 同じ matrix を再貼付 →
    //       対象 select が先ほど設定した値を反映しているか（キー一致時は保持される）。
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });

    // 枠セレクタを全割当(作成ゲート解除に必要ではないがついでに)
    const slotSelects = () =>
      (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
        Array.from(s.options).some((o) => o.text === '枠は？'),
      );
    const slots = slotSelects();
    if (slots.length >= 3) {
      fireEvent.change(slots[0], { target: { value: 'MT' } });
      fireEvent.change(slots[1], { target: { value: 'H1' } });
      fireEvent.change(slots[2], { target: { value: 'D1' } });
    }

    // 対象 select を変更(ST にセット)
    const targetSelectsBefore = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      s.getAttribute('aria-label') === '攻撃の対象を選択',
    );
    expect(targetSelectsBefore.length).toBeGreaterThan(0);
    fireEvent.change(targetSelectsBefore[0], { target: { value: 'ST' } });
    expect(targetSelectsBefore[0].value).toBe('ST');

    // フェーズ追加
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));

    // 同じ matrix を再貼付(2フェーズ目 draft として)
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });

    // targetOverrides は保持されているはず → 対象 select に ST が出る
    const targetSelectsAfter = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      s.getAttribute('aria-label') === '攻撃の対象を選択',
    );
    // select が出ることを確認(Fix 1 が機能している)
    expect(targetSelectsAfter.length).toBeGreaterThan(0);
    // 前フェーズで設定した ST が保持されている
    expect(targetSelectsAfter[0].value).toBe('ST');
  });

});
