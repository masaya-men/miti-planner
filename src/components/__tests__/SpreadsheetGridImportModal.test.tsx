// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SpreadsheetGridImportModal,
  autoAssignSingleSlots,
  setColumnValues,
  sortResultPartyBySlots,
} from '../SpreadsheetGridImportModal';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';

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
  'gridImport.pending_phase_warning': '貼り付けた内容が未追加です。「このフェーズを追加」を押してください。',
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
  'gridImport.phase_name_label': 'フェーズ名（任意・空なら自動）',
  'gridImport.phase_name_placeholder': '例: P1 神々の像',
  'gridImport.add_phase': 'このフェーズを追加',
  'gridImport.add_phase_next': 'このフェーズを追加して次へ',
  'gridImport.added_phases_label': '追加済みフェーズ',
  'gridImport.detected_phase': 'フェーズ「{{name}}」: イベント{{events}}件・軽減{{mits}}件',
  'gridImport.add_more_or_next': '次のフェーズがあれば同じ手順でもう1枚。無ければそのまま作成。',
  'gridImport.flow_hint': 'スプシで A1 をクリック → Ctrl+A → Ctrl+C → ここで Ctrl+V',
  'gridImport.skipped_label': '読み取れなかった軽減（{{count}}件）',
  'gridImport.skipped_count': '読めなかった技 {{count}}件',
  'gridImport.skipped_note': 'LoPo に無い技・表記ゆれが理由です。これらは取り込まれません。',
  'gridImport.party_assign_label': 'パーティの枠を割り当て',
  'gridImport.party_assign_hint': 'ジョブを MT〜D4 に割り当ててください',
  'gridImport.party_role_tank': 'タンク',
  'gridImport.party_role_healer': 'ヒーラー',
  'gridImport.party_role_dps': 'DPS',
  'gridImport.party_slot_unassigned': '未選択',
  'gridImport.rights_notice': '取り込んだ内容はご自身の控えからの変換です。',
  'common.cancel': 'キャンセル',
};

/** {{name}} 等のプレースホルダを置換した文字列を返す簡易 t。 */
function interpolate(tmpl: string, vars?: Record<string, unknown>): string {
  if (!vars) return tmpl;
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => interpolate(JA[k] ?? k, vars),
    i18n: { language: 'ja' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

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

const DEFAULT_SEL = { level: null, category: null, bossId: null, title: '' } as never;

/** step2 のグリッド貼り付けサーフェス(aria-label = paste_prompt)を返す。 */
function gridPasteSurface(): HTMLElement {
  return screen.getByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)');
}

/** step1 → 次へ で step2 へ進める。 */
function goToGridStep() {
  fireEvent.click(screen.getByText('次へ'));
}

/**
 * parseMitigationSheet が読める行列(matrix)TSV を組み立てる。
 * - ジョブ行 3 ジョブ(ナイト/白魔道士/忍者) → tank/healer/dps が混在
 * - Skill 行(ランパート=解決可 / アサイラム=解決可 / かげぬい=LoPo 未知=skipped)
 */
function matrixTSV(): string {
  const T = (cells: string[]) => cells.join('\t');
  return [
    T(['Phase', 'Total Time', 'Action', 'Type', 'Hit', 'Mit', 'Mit', 'Mit']),
    T(['', '', '', '', '', 'ナイト', '白魔道士', '忍者']),
    T(['', '', 'Skill', '', '', 'ランパート', 'アサイラム', 'かげぬい']),
    T(['開幕', '0:16', 'ビッグブラスト', 'Magic', '100,000', 'TRUE', 'TRUE', 'TRUE']),
  ].join('\n');
}

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

  it('Step2: matrix未追加でも「この内容で作成」は押せる(常時作成・自動取込=§9.7 D)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // 旧 pending バナー(袋小路)は撤去済 → 出ない
    expect(screen.queryByText('貼り付けた内容が未追加です。「このフェーズを追加」を押してください。')).toBeNull();
    // 未追加(entries 空・partyComplete=true)でも create は活性(作成時に自動取込)
    const createBtn = screen.getByText('この内容で作成').closest('button') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
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

  it('Step2: 読み取れなかった軽減はフッターに件数サマリで出る(右パネルの一覧は撤去)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // フェーズを追加 → preview が構築され skipped が確定(「かげぬい」=LoPo 未知)
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
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

  it('Step2: 貼付直後(フェーズ名未追加)でも「この内容で作成」が disabled でない(自動取込)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
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
});

// ---- sortResultPartyBySlots 純粋関数のユニットテスト ----
describe('sortResultPartyBySlots', () => {
  it('party を MT,ST,H1,H2,D1..D4 順に整列する(検出順をならべ替え)', () => {
    const result = {
      timelineEvents: [], timelineMitigations: [], phases: [], labels: [], skipped: [],
      party: [
        { slot: 'D1', jobId: 'nin' },
        { slot: 'H1', jobId: 'whm' },
        { slot: 'MT', jobId: 'pld' },
      ],
    } as unknown as SheetImportResult;
    const sorted = sortResultPartyBySlots(result);
    expect(sorted.party.map((p) => p.slot)).toEqual(['MT', 'H1', 'D1']);
  });

  it('元の result は変更しない(party 配列は新規)', () => {
    const result = {
      timelineEvents: [], timelineMitigations: [], phases: [], labels: [], skipped: [],
      party: [{ slot: 'D1', jobId: 'nin' }, { slot: 'MT', jobId: 'pld' }],
    } as unknown as SheetImportResult;
    const sorted = sortResultPartyBySlots(result);
    expect(result.party[0].slot).toBe('D1'); // 元は不変
    expect(sorted.party).not.toBe(result.party);
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
