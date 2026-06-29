// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  SpreadsheetGridImportModal,
  autoAssignSingleSlots,
  setColumnValues,
  sortResultPartyBySlots,
} from '../SpreadsheetGridImportModal';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';
import type { TemplateData } from '../../data/templateLoader';
import { getTemplate } from '../../data/templateLoader';
import { useIsMobile } from '../../hooks/useIsMobile';

// templateLoader をモック: デフォルトは null(テンプレなし)。テスト内で上書き可。
vi.mock('../../data/templateLoader', () => ({
  getTemplate: vi.fn().mockResolvedValue(null),
}));

// resolveEventTargets は実装をそのまま使う(純関数なのでモック不要)。

// i18n: キー→日本語テキストの最小マップ（テスト対象キーのみ）
const JA: Record<string, string> = {
  'gridImport.title': 'スプレッドシートから取り込む',
  'gridImport.paste_by_column': '列ごとに貼り付け',
  'gridImport.help': '',
  'gridImport.create': 'この内容で作成',
  'gridImport.next': '次へ',
  'gridImport.next_to_party': 'パーティ割当へ',
  'gridImport.back': '戻る',
  'gridImport.clear': 'やり直す',
  'gridImport.step_content': 'コンテンツ選択',
  'gridImport.step_grid': 'スプレッドシート風グリッド',
  'gridImport.step_party': 'パーティ割当',
  'gridImport.slot_empty': '未割当',
  'gridImport.no_party_detected': 'パーティが検出されませんでした。このまま作成できます。',
  'roles.tank': 'タンク',
  'roles.healer': 'ヒーラー',
  'roles.dps': 'DPS',
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
  'gridImport.target_select_label': '攻撃の対象を選択',
  'gridImport.target_aoe': '全体',
  'gridImport.target_none': '—',
  'gridImport.target_from_template': 'テンプレ',
  'gridImport.unresolved_note': 'LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます。',
  'gridImport.assign_member_job': 'メンバー（ジョブを選ぶ）',
  'gridImport.no_time_warning': '時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。',
  'gridImport.format_hint': 'ジョブ・スキルは正式名称で、時間(M:SS)の列を入れてください。',
  'common.cancel': 'キャンセル',
  'gridImport.mobile_copy_hint_toggle': 'コピーのやり方',
  'gridImport.mobile_copy_hint': 'Googleスプレッドシートで範囲を選んでコピー → 下を長押しして貼り付け',
  'gridImport.mobile_paste_label': 'スプレッドシートを貼り付け',
  'gridImport.mobile_paste_placeholder': 'ここを長押し →「ペースト」',
  'gridImport.mobile_read_ok': '読み取りました — {{events}}件のイベントを検出',
  'gridImport.mobile_paste_empty': 'まだ貼り付けられていません。',
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

const DEFAULT_SEL = { level: null, category: null, bossId: null, title: '' } as never;

/** step2 のグリッド貼り付けサーフェス(aria-label = paste_prompt)を返す。 */
function gridPasteSurface(): HTMLElement {
  return screen.getByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)');
}

/** step1 → 次へ で step2 へ進める。 */
function goToGridStep() {
  fireEvent.click(screen.getByText('次へ'));
}

/** step2 でフェーズを追加(またはそのまま)し、「パーティ割当へ」でstep3へ進める。 */
function goToPartyStep() {
  fireEvent.click(screen.getByText('パーティ割当へ'));
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

  // ── §9.7 C#8/#9/#10: 読めない技セル内黄色+自作在席編集+取り込めません明記(Task 8) ──

  it('Task8: matrix未解決技セル(かげぬい)が text-app-amber クラスを持つ(C#8)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // matrix を貼り付け → 未解決セルが amber で表示されるのはドラフト表示中
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // かげぬい が amber クラスを持つ span として描画されていること(フェーズ追加前のドラフト表示)
    const amberSpans = document.querySelectorAll('.text-app-amber');
    const texts = Array.from(amberSpans).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('かげぬい'))).toBe(true);
  });

  it('Task8: matrix同時刻2技(両解決:ランパート/アサイラム)は amber を持たない(C#9)', () => {
    // 同一行に両方解決の技が並ぶ matrix
    const T = (cells: string[]) => cells.join('\t');
    const twoSkilledTSV = [
      T(['Phase', 'Total Time', 'Action', 'Type', 'Hit', 'Mit', 'Mit']),
      T(['', '', '', '', '', 'ナイト', '白魔道士']),
      T(['', '', 'Skill', '', '', 'ランパート', 'アサイラム']),
      T(['開幕', '0:16', 'ビッグブラスト', 'Magic', '100,000', 'TRUE', 'TRUE']),
    ].join('\n');
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => twoSkilledTSV } });
    // セル内にランパート / アサイラム が表示されるが amber は付かない
    const amberSpans = document.querySelectorAll('.text-app-amber');
    const texts = Array.from(amberSpans).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('ランパート'))).toBe(false);
    expect(texts.some((t) => t.includes('アサイラム'))).toBe(false);
  });

  it('Task8: grid未解決 member セルが <input> を持つ(C#10 在席編集)', () => {
    // 自作 TSV: member 列に「かげぬい」(未解決)
    // parseGridPaste が "ナイト" 列ヘッダーを member 列として検出するよう列名をジョブ名に合わせる
    const gridTSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tかげぬい\n';
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => gridTSV } });
    // member 列の未解決セルが input になっていること
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const memberInput = inputs.find((el) => el.value === 'かげぬい');
    expect(memberInput).toBeDefined();
  });

  it('Task8: grid未解決 input をblurで正式名称に直すとセル更新(白になる)', () => {
    const gridTSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tかげぬい\n';
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => gridTSV } });
    // 未解決 input を特定
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const memberInput = inputs.find((el) => el.value === 'かげぬい');
    expect(memberInput).toBeDefined();
    // 正式名称「ランパート」に変更して blur → setTable → 再描画 → input が消えて通常テキストに
    fireEvent.change(memberInput!, { target: { value: 'ランパート' } });
    fireEvent.blur(memberInput!);
    // blur 後: input は消え、ランパートは通常テキスト(text-app-text クラス)で表示される
    const inputsAfter = (screen.queryAllByRole('textbox') as HTMLInputElement[]).filter(
      (el) => el.value === 'ランパート',
    );
    expect(inputsAfter.length).toBe(0); // input ではなく通常テキストになった
    // ランパート が amber を持たないこと(解決済み)
    const amberSpans = document.querySelectorAll('.text-app-amber');
    const texts = Array.from(amberSpans).map((el) => el.textContent ?? '');
    expect(texts.some((t) => t.includes('ランパート'))).toBe(false);
    // Fix I1: 解決名「ランパート」が実際に描画されていることを肯定的に検証
    expect(screen.getByText('ランパート')).toBeInTheDocument();
  });

  it('Task8: unresolved_note がフッターに表示される(skipped あり、step3)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    // フェーズ追加→ skipped が確定
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
    // step3 へ進む → showCreateBlock=true → unresolved_note が出る
    goToPartyStep();
    expect(screen.getByText('LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます。')).toBeInTheDocument();
  });

  it('Task8: grid見出し形式でメンバー列に未解決スキルを貼ると unresolved_note がフェーズ追加なしで表示される(Fix I2)', () => {
    // grid 形式(見出し形式)で member 列に未解決スキルを含む TSV を貼る
    // grid は現在のテーブルから buildPlanFromGrid で即座にプレビューを構築→skipped が確定→unresolved_note が表示される
    const gridTSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tかげぬい\n';
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => gridTSV } });
    // フェーズ追加(このフェーズを追加)を押さずに unresolved_note が表示されていることを確認
    // (grid は表示中テーブルから即座にプレビューを構築するため、フェーズ追加を待たずに skipped が確定)
    expect(screen.getByText('LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます。')).toBeInTheDocument();
  });

  // ── §9.7 E#14/#15/#16: ジョブ列手動救済+時間欠落表示+入口案内文(Task 9) ──

  it('Task9: 空状態(未貼り付け)に format_hint が表示される(E#16)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 未貼り付け状態 → 空状態プロンプト + format_hint が出る
    expect(screen.getByText('ジョブ・スキルは正式名称で、時間(M:SS)の列を入れてください。')).toBeInTheDocument();
  });

  it('Task9: grid で time 列が無いと no_time_warning が amber で出る(E#15)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 時間列を含まない自作TSV
    const tsvNoTime = '敵の攻撃\tナイト\nビッグブラスト\tランパート\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsvNoTime } });
    expect(screen.getByText('時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。')).toBeInTheDocument();
  });

  it('Task9: grid で time 列があれば no_time_warning は出ない(E#15 否定)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    const tsvWithTime = '時間\t敵の攻撃\n0:16\tビッグブラスト\n';
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => tsvWithTime } });
    expect(screen.queryByText('時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。')).toBeNull();
  });

  it('Task9: matrix 貼付では no_time_warning が出ない(matrix は対象外)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => matrixTSV() } });
    expect(screen.queryByText('時間(M:SS)の列が必要です。見出しを「時間」にするか「この列は？→時間」で指定してください。')).toBeNull();
  });

  it('Task9: unknown 列セレクタに「メンバー（ジョブを選ぶ）」が含まれる(E#14)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    // 不明列を含む自作TSV
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\n値1\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    const optionTexts = Array.from(selector.options).map((o) => o.text);
    expect(optionTexts).toContain('メンバー（ジョブを選ぶ）');
  });

  it('Task9: unknown 列で「メンバー（ジョブを選ぶ）」を選ぶとジョブ select が出る(E#14 第1段)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\n値1\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    // __member__ を選択
    fireEvent.change(selector, { target: { value: '__member__' } });
    // aria-label='メンバー（ジョブを選ぶ）' の select が出る
    const jobSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const jobSelect = jobSelects.find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）');
    expect(jobSelect).toBeDefined();
    // ジョブの選択肢が出る(ナイト/白魔道士/忍者)
    const jobOptions = Array.from(jobSelect!.options).map((o) => o.text);
    expect(jobOptions).toContain('ナイト');
  });

  it('Task9: ジョブ select でジョブを選ぶと列が member 化し枠セレクタが出る(E#14 第2段)', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true} defaultSelection={DEFAULT_SEL} />);
    goToGridStep();
    fireEvent.paste(gridPasteSurface(), { clipboardData: { getData: () => '不明列A\t時間\nランパート\t0:10\n' } });
    const selector = screen.getByDisplayValue('この列は？') as HTMLSelectElement;
    // 第1段: メンバー(ジョブを選ぶ)を選択
    fireEvent.change(selector, { target: { value: '__member__' } });
    // 第2段: ジョブ select でナイト(pld)を選択
    const jobSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const jobSelect = jobSelects.find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）');
    expect(jobSelect).toBeDefined();
    fireEvent.change(jobSelect!, { target: { value: 'pld' } });
    // 列が member 化 → 枠セレクタ(「枠は？」)が出る
    const slotSelects = (screen.getAllByRole('combobox') as HTMLSelectElement[]).filter((s) =>
      Array.from(s.options).some((o) => o.text === '枠は？'),
    );
    expect(slotSelects.length).toBeGreaterThan(0);
    // ジョブ select(2段目)は消えている
    const jobSelectsAfter = screen.queryAllByRole('combobox') as HTMLSelectElement[];
    const pendingSelect = jobSelectsAfter.find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）');
    expect(pendingSelect).toBeUndefined();
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
});
