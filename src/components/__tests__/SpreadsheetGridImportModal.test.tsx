// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpreadsheetGridImportModal, autoAssignSingleSlots, setColumnValues } from '../SpreadsheetGridImportModal';
import type { GridTable } from '../../lib/sheetImport/gridTypes';

// i18n: キー→日本語テキストの最小マップ（テスト対象キーのみ）
const JA: Record<string, string> = {
  'gridImport.title': 'スプレッドシートから取り込む',
  'gridImport.paste_by_column': '列ごとに貼り付け',
  'gridImport.help': '',
  'gridImport.create': 'この内容で作成',
  'gridImport.next': '次へ',
  'gridImport.back': '戻る',
  'gridImport.step_content': 'コンテンツ選択',
  'gridImport.step_grid': 'スプレッドシート風グリッド',
  'gridImport.status_ok': 'OK',
  'gridImport.status_partial': '一部読めない',
  'gridImport.status_empty': '空 / 任意',
  'gridImport.paste_placeholder': 'ここに貼り付け',
  'gridImport.paste_prompt': 'ここにスプレッドシートを貼り付け (Ctrl+V)',
  'gridImport.paste_hint': '全選択(Ctrl+A)→コピー(Ctrl+C)→ここで貼り付け(Ctrl+V)',
  'gridImport.parse_failed': '貼り付けた内容をうまく読み取れませんでした。',
  'gridImport.no_phases_warning': 'イベントがありません。',
  'gridImport.party_incomplete_warning': 'スキルのあるメンバー列に枠を割り当てると作成できます。',
  'gridImport.this_column': 'この列は？',
  'gridImport.ignore_column': '無視',
  'gridImport.assign_slot': '枠は？',
  'gridImport.col_unknown': '不明な列',
  'gridImport.col_ignore': '無視',
  'gridImport.col_member': 'メンバー',
  'gridImport.col_phase': 'フェーズ',
  'gridImport.col_label': 'ラベル',
  'gridImport.col_time': '時間',
  'gridImport.col_action': '敵の攻撃',
  'gridImport.col_damage': 'ダメージ',
  'gridImport.col_target': '攻撃の対象',
  'gridImport.col_damageType': 'ダメージ種別',
  'gridImport.slot_unassigned_warning': '枠が未割当のメンバー列があります',
  'gridImport.summary': '{{labels}}ラベル・{{events}}イベント・軽減{{mits}}件',
  'gridImport.col_paste_placeholder': '貼り付け（1行1件）',
  'common.cancel': 'キャンセル',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => JA[k] ?? k,
    i18n: { language: 'ja' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../hooks/useSkillsData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useSkillsData')>();
  return {
    ...actual,
    getJobsFromStore: () => [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' }],
    getMitigationsFromStore: () => [{ id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 0, type: 'all', value: 0 }],
  };
});

const DEFAULT_SEL = { level: null, category: null, bossId: null, title: '' } as never;

/** step2 のグリッド貼り付けサーフェス(aria-label = paste_prompt)を返す。 */
function gridPasteSurface(): HTMLElement {
  return screen.getByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)');
}

/** step1 → 次へ で step2 へ進める。 */
function goToGridStep() {
  fireEvent.click(screen.getByText('次へ'));
}

describe('SpreadsheetGridImportModal', () => {
  it('開いているとタイトルを表示し、Step1はコンテンツ選択+次へ', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={vi.fn()} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    expect(screen.getByText('スプレッドシートから取り込む')).toBeInTheDocument();
    // Step1 フッターは キャンセル + 次へ
    expect(screen.getByText('キャンセル')).toBeInTheDocument();
    expect(screen.getByText('次へ')).toBeInTheDocument();
    // Step1 ではグリッド本体・列ごと貼り付けは未表示
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
    // 列見出し
    expect(screen.getByText('時間')).toBeInTheDocument();
    expect(screen.getByText('敵の攻撃')).toBeInTheDocument();
    expect(screen.getByText('攻撃の対象')).toBeInTheDocument();
    expect(screen.getByText('ダメージ種別')).toBeInTheDocument();
    // 空状態の貼り付けプロンプト(本文)
    expect(screen.getByText('ここにスプレッドシートを貼り付け (Ctrl+V)')).toBeInTheDocument();
    // 列ごと貼り付け fallback ボタンも表示
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument();
  });

  it('Step2: グリッド本体への貼り付け(自作TSV)で列が検出されグリッドに反映される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    const tsv = '時間\t敵の攻撃\n0:16\tばりばりルインガ\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsv } });
    expect(screen.getByText('ばりばりルインガ')).toBeInTheDocument();
  });

  it('Step2: 行列(TRUE/FALSE)形式を貼っても弾かず、グリッドに内容が出る(no-bounce)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // parseMitigationSheet が読める最小の行列 TSV:
    const T = (cells: string[]) => cells.join('\t');
    const matrix = [
      T(['Phase', 'Total Time', 'Action', 'Type', 'Hit', 'Mitigation', 'Mitigation', 'Mitigation']),
      T(['', '', 'TestBoss', '', '', 'ナイト', '白魔道士', '戦士']),           // ジョブ行(3ジョブ)
      T(['', '', 'Skill', '', '', 'リプライザル', 'アサイラム', 'ランパート']),  // Skill 行
      T(['開幕', '0:16', 'ビッグブラスト', 'Magic', '100,000', 'TRUE', 'FALSE', 'FALSE']),
    ].join('\n');
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrix } });
    // 弾き(誘導)が起きず、攻撃名がグリッドに出る
    expect(screen.getByText('ビッグブラスト')).toBeInTheDocument();
  });

  it('Step2 → 戻る で Step1 (コンテンツ選択) に戻る', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument(); // Step2 にいる
    fireEvent.click(screen.getByText('戻る'));
    // Step1 に戻り、キャンセル + 次へ が見える / グリッド要素は消える
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
    // 初期状態ではcolumn-pasteのtextareaは存在しない
    expect(screen.queryByPlaceholderText('貼り付け（1行1件）')).toBeNull();
    // 列ごとボタンをクリック
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    // 各列ヘッダーにtextareaが現れる（BASE_FIELDS = 7列）
    const colTextareas = screen.getAllByPlaceholderText('貼り付け（1行1件）');
    expect(colTextareas.length).toBeGreaterThan(0);
  });

  it('Step2: 列ごとに貼り付けで時間列に値を入力するとグリッドに反映される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    const colTextareas = screen.getAllByPlaceholderText('貼り付け（1行1件）');
    // 最初の列（フェーズ列=BASE_FIELDS[0]）に貼る
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
    expect(container.textContent ?? '').not.toContain('有名');
    expect((container.textContent ?? '').toLowerCase()).not.toContain('famous');
  });
});

// ---- setColumnValues 純粋関数のユニットテスト ----
describe('setColumnValues', () => {
  it('指定列に値が書き込まれ、他列は保持される', () => {
    const table: GridTable = {
      columns: [
        { field: 'phase', header: 'フェーズ' },
        { field: 'time', header: '時間' },
        { field: 'action', header: '敵の攻撃' },
      ],
      rows: [
        ['P1', '0:10', 'Attack1'],
        ['P2', '0:20', 'Attack2'],
      ],
    };
    const result = setColumnValues(table, 1, ['1:00', '2:00']);
    expect(result.rows[0][1]).toBe('1:00');
    expect(result.rows[1][1]).toBe('2:00');
    expect(result.rows[0][0]).toBe('P1');
    expect(result.rows[0][2]).toBe('Attack1');
    expect(result.rows[1][0]).toBe('P2');
    expect(result.rows[1][2]).toBe('Attack2');
  });

  it('values が既存行より多い場合、行が追加され他列は空文字で埋まる', () => {
    const table: GridTable = {
      columns: [
        { field: 'phase', header: 'フェーズ' },
        { field: 'time', header: '時間' },
      ],
      rows: [['P1', '0:10']],
    };
    const result = setColumnValues(table, 0, ['P1', 'P2', 'P3']);
    expect(result.rows.length).toBe(3);
    expect(result.rows[0][0]).toBe('P1');
    expect(result.rows[1][0]).toBe('P2');
    expect(result.rows[2][0]).toBe('P3');
    expect(result.rows[0][1]).toBe('0:10');
    expect(result.rows[1][1]).toBe('');
    expect(result.rows[2][1]).toBe('');
  });

  it('values が既存行より少ない場合、不足分は空文字になる', () => {
    const table: GridTable = {
      columns: [{ field: 'phase', header: 'フェーズ' }],
      rows: [['P1'], ['P2'], ['P3']],
    };
    const result = setColumnValues(table, 0, ['X']);
    expect(result.rows.length).toBe(3);
    expect(result.rows[0][0]).toBe('X');
    expect(result.rows[1][0]).toBe('');
    expect(result.rows[2][0]).toBe('');
  });

  it('元の table は変更されない(pure function)', () => {
    const table: GridTable = {
      columns: [{ field: 'phase', header: 'フェーズ' }],
      rows: [['P1']],
    };
    const result = setColumnValues(table, 0, ['NEW']);
    expect(table.rows[0][0]).toBe('P1');
    expect(result.rows[0][0]).toBe('NEW');
  });
});
