// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';
import {
  autoAssignSingleSlots,
} from '../gridImport/gridImportModel';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
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

// resolveEventTargets は実装をそのまま使う(純関数なのでモック不要)。

describe('SpreadsheetGridImportModal', () => {
  it('開いているとタイトルを表示し、Step1はコンテンツ選択+次へ', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={vi.fn()} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    expect(screen.getByText('スプレッドシートから取り込む')).toBeInTheDocument();
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
    expect(screen.getByText('次へ')).toBeInTheDocument();
    expect(screen.queryByText('列ごとに貼り付け')).toBeNull();
  });

  it('閉じていると何も描画しない', () => {
    const { container } = render(
      <SpreadsheetGridImportModal isOpen={false} onClose={vi.fn()} onImport={async () => true} defaultSelection={DEFAULT_SEL} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('次へでStep2へ進むと、正典の列見出し+貼り付けプロンプトが表示される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    expect(screen.getByText('時間')).toBeInTheDocument();
    expect(screen.getByText('敵の攻撃')).toBeInTheDocument();
    expect(screen.getByText('攻撃の対象')).toBeInTheDocument();
    expect(screen.getByText('ダメージ種別')).toBeInTheDocument();
    expect(screen.getByText('ここにスプレッドシートを貼り付け (Ctrl+V)')).toBeInTheDocument();
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument();
  });

  it('Step2: 自作TSV貼り付けで列が検出されグリッドに反映される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    const tsv = '時間\t敵の攻撃\n0:16\tばりばりルインガ\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsv } });
    expect(screen.getByText('ばりばりルインガ')).toBeInTheDocument();
  });

  it('Step2: 行列(TRUE/FALSE)形式を貼っても弾かず、グリッドに内容が出る(no-bounce)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    expect(screen.getByText('ビッグブラスト')).toBeInTheDocument();
  });

  it('Step2: matrix貼付→フェーズ名+追加して次へで✓チップに積まれ、グリッドが空に戻る', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // フェーズ名を入力 → 追加して次へ
    fireEvent.change(screen.getByPlaceholderText('例: P1 神々の像'), { target: { value: 'P1 開幕' } });
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
    // フェーズ・バーの✓チップにフェーズ名が出る(旧右パネルの一覧は廃止)
    expect(screen.getByText('P1 開幕')).toBeInTheDocument();
    // グリッドは空状態に戻る(次のタブを貼れる)
    expect(screen.getByText('ここにスプレッドシートを貼り付け (Ctrl+V)')).toBeInTheDocument();
  });

  it('Step2: matrixドラフト中にフェーズ名を打つと「フェーズ」列へ即時ミラーされる(①a)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // 入力前: フェーズ名はまだグリッドに出ていない
    expect(screen.queryByText('P1 神々の像')).toBeNull();
    // フェーズ名を打つ(まだ「追加」は押さない)
    fireEvent.change(screen.getByPlaceholderText('例: P1 神々の像'), { target: { value: 'P1 神々の像' } });
    // フェーズ列(band-start 先頭行)に即時反映される(effect で table 再構築)
    expect(screen.getByText('P1 神々の像')).toBeInTheDocument();
  });

  it('Step2: matrix未追加でも旧 pending 袋小路バナーは出ない(§9.7 D)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // 旧 pending バナー(袋小路)は撤去済 → 出ない(作成時に自動取込する設計)
    expect(screen.queryByText('貼り付けた内容が未追加です。「このフェーズを追加」を押してください。')).toBeNull();
  });

  it('Step2: メンバー列が MT→ST→H1→H2→D1〜D4 順(タンクがヒーラーより前)で表示される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 検出順がジョブ行順(ナイト=tank, 白魔=healer, 忍者=dps)になるよう貼る
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    const text = gridPasteSurface().textContent ?? '';
    const idxTank = text.indexOf('ナイト');
    const idxHealer = text.indexOf('白魔道士');
    const idxDps = text.indexOf('忍者');
    expect(idxTank).toBeGreaterThanOrEqual(0);
    expect(idxHealer).toBeGreaterThan(idxTank);   // MT(tank) は H1(healer) より前
    expect(idxDps).toBeGreaterThan(idxHealer);    // H1(healer) は D1(dps) より前
  });

  it('Step3: 読み取れなかった軽減はフッターに件数サマリで出る(右パネルの一覧は撤去)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // フェーズを追加 → preview が構築され skipped が確定(「かげぬい」=LoPo 未知)
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
    // パーティ割当ステップ(step3)へ進む → skipped_count はフッターに出る
    goToPartyStep();
    // フッターに件数サマリ(skipped_count)。旧右パネルの一覧/理由ノートは撤去済。
    expect(screen.getByText('読めなかった技 1件')).toBeInTheDocument();
    expect(screen.queryByText('忍者 / かげぬい')).toBeNull();
    expect(screen.queryByText('LoPo に無い技・表記ゆれが理由です。これらは取り込まれません。')).toBeNull();
  });

  it('Step2 → 戻る で Step1 (コンテンツ選択) に戻る', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument();
    fireEvent.click(screen.getByText('戻る'));
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
    expect(screen.queryByText('列ごとに貼り付け')).toBeNull();
  });

  it('autoAssignSingleSlots: ロール内1メンバー列→先頭枠を自動割当', () => {
    const jobs = [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' }];
    const table: GridTable = {
      columns: [{ field: 'member', header: 'ナイト', jobId: 'pld', slot: null }],
      rows: [['ランパート']],
    };
    const result = autoAssignSingleSlots(table, jobs as never);
    expect(result.columns[0].slot).toBe('MT');
  });

  it('Step2: 列ごとに貼り付けボタンでbyColumnModeに切替→各列にtextareaが現れる', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    expect(screen.queryByPlaceholderText('貼り付け（1行1件）')).toBeNull();
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    const colTextareas = screen.getAllByPlaceholderText('貼り付け（1行1件）');
    expect(colTextareas.length).toBeGreaterThan(0);
  });

  it('Step2: 列ごとに貼り付けで時間列に値を入力するとグリッドに反映される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    const colTextareas = screen.getAllByPlaceholderText('貼り付け（1行1件）');
    fireEvent.change(colTextareas[0], { target: { value: 'P1\nP2\n' } });
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
  });

  it('「この列は？」セレクタに「メンバー」は含まれない(Fix1a)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\n値1\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    const optionValues = Array.from(selector.options).map((o) => o.value);
    expect(optionValues).not.toContain('member');
    expect(optionValues).not.toContain('unknown');
    expect(optionValues).toContain('ignore');
  });

  it('jobId なし member 列はパーティ不完全ブロックを発生させない(Fix1b)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '時間\t敵の攻撃\n0:16\tばりばりルインガ\n' } });
    expect(screen.queryByText('スキルのあるメンバー列に枠を割り当てると作成できます。')).toBeNull();
  });

  it('「有名」/famous 文言はどこにも出ない', () => {
    const { container } = render(
      <SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />,
    );
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    expect(container.textContent ?? '').not.toContain('有名');
    expect((container.textContent ?? '').toLowerCase()).not.toContain('famous');
  });

  // ── §9.7 右パネル廃止・スプシ面集約(Task 6) ──
  it('Step2: 右パネルを廃止(旧右パネルの「追加済みフェーズ」「パーティの枠を割り当て」ラベルが無い)+Ctrl+A導線が出る', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // 旧右パネルの見出し(縦並びリスト/パーティ枠パネル)はもう無い
    expect(screen.queryByText('追加済みフェーズ')).toBeNull();
    expect(screen.queryByText('パーティの枠を割り当て')).toBeNull();
    // 代わりに Ctrl+A 導線がグリッド上部に常時表示
    expect(screen.getByText('スプシで A1 をクリック → Ctrl+A → Ctrl+C → ここで Ctrl+V')).toBeInTheDocument();
  });
});
