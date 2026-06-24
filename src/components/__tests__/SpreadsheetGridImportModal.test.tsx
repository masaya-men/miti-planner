// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpreadsheetGridImportModal, autoAssignSingleSlots, setColumnValues } from '../SpreadsheetGridImportModal';
import type { GridTable } from '../../lib/sheetImport/gridTypes';

// i18n: キー→日本語テキストの最小マップ（テスト対象キーのみ）
const JA: Record<string, string> = {
  'gridImport.title': 'スプレッドシートから取り込む',
  'gridImport.paste_whole': 'まるごと貼り付け（Ctrl+A → Ctrl+C → 貼り付け）',
  'gridImport.paste_by_column': '列ごとに貼り付け',
  'gridImport.help': '',
  'gridImport.create': 'この内容で作成',
  'gridImport.status_ok': 'OK',
  'gridImport.status_partial': '一部読めない',
  'gridImport.status_empty': '空 / 任意',
  'gridImport.paste_placeholder': 'ここに貼り付け',
  'gridImport.famous_sheet_warning': '有名スプシ形式です。別経路をお使いください。',
  'gridImport.pending_draft_warning': '貼り付け欄に未取込の内容があります。',
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

describe('SpreadsheetGridImportModal', () => {
  it('開いているとタイトルと2つの貼り付けボタンを表示', () => {
    render(
      <SpreadsheetGridImportModal
        isOpen
        onClose={vi.fn()}
        onImport={async () => true}
        defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never}
      />,
    );
    expect(screen.getByText('スプレッドシートから取り込む')).toBeInTheDocument();
    expect(screen.getByText(/まるごと貼り付け/)).toBeInTheDocument();
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument();
  });

  it('閉じていると何も描画しない', () => {
    const { container } = render(
      <SpreadsheetGridImportModal isOpen={false} onClose={vi.fn()} onImport={async () => true}
        defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('まるごと貼り付けで見出しから列が自動検出される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true}
      defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />);
    const ta = screen.getByPlaceholderText(/貼り付け/);
    fireEvent.change(ta, { target: { value: '時間\t敵の攻撃\n0:16\tばりばりルインガ\n' } });
    fireEvent.click(screen.getByText(/まるごと貼り付け/));
    expect(screen.getByText('ばりばりルインガ')).toBeInTheDocument();
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

  it('未取込draftがある→作成ボタン無効(pending_draft)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true}
      defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />);
    const ta = screen.getByPlaceholderText(/貼り付け/);
    // まるごとを押さずに draft だけある → hasPendingDraft=true → blockReason='pending_draft' → disabled
    fireEvent.change(ta, { target: { value: '時間\t敵の攻撃\n0:16\tばりばりルインガ\n' } });
    // まるごとボタンは押さない
    const btn = screen.getByText('この内容で作成').closest('button');
    expect(btn).toBeDisabled();
  });

  it('列ごとに貼り付けボタンでbyColumnModeに切替→各列にtextareaが現れる', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true}
      defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />);
    // 初期状態ではcolumn-pasteのtextareaは存在しない
    expect(screen.queryByPlaceholderText('貼り付け（1行1件）')).toBeNull();
    // 列ごとボタンをクリック
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    // 各列ヘッダーにtextareaが現れる（BASE_FIELDS = 7列）
    const colTextareas = screen.getAllByPlaceholderText('貼り付け（1行1件）');
    expect(colTextareas.length).toBeGreaterThan(0);
  });

  it('列ごとに貼り付け: 時間列に値を入力するとグリッドに反映される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true}
      defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />);
    // byColumnModeを有効化
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    // 最初の列（フェーズ列=BASE_FIELDS[0]）のtextareaを取得して貼り付け
    const colTextareas = screen.getAllByPlaceholderText('貼り付け（1行1件）');
    fireEvent.change(colTextareas[0], { target: { value: 'P1\nP2\n' } });
    // グリッド行に P1, P2 が出現する
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
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
    // time列(index=1)に新しい値を書き込む
    const result = setColumnValues(table, 1, ['1:00', '2:00']);
    expect(result.rows[0][1]).toBe('1:00');
    expect(result.rows[1][1]).toBe('2:00');
    // 他列は変わらない
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
    // 他列は既存 or 空文字
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
    expect(table.rows[0][0]).toBe('P1'); // 元は変わらない
    expect(result.rows[0][0]).toBe('NEW');
  });
});
