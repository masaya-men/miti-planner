// @vitest-environment happy-dom
// 一時検査(整頓⑤): 分割前後で画面の中身と onImport/onClose の呼び出しが変わらないことの記録。Task 4 で削除する。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';
import type { TemplateData } from '../../types/template';
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
  'gridImport.mobile_assign_party': 'パーティの枠を割り当て',
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

const DEFAULT_SEL = { contentId: null, level: null, category: null, title: '' } as never;
const SEL_WITH_TITLE = { contentId: 'ビッグブラストレイド', level: null, category: 'dungeon', title: '' } as never;

const rec: unknown[] = [];
const onClose = () => { rec.push(['onClose']); };
const makeOnImport = (ret: boolean) => async (result: unknown, opts: unknown) => { rec.push(['onImport', result, opts]); return ret; };

function snap(label: string) {
  const norm = (s: string) => s.replace(/\b([a-z]+)_[a-z0-9]{6,}_[a-z0-9]+\b/g, '$1_ID');
  expect({ label, html: norm(document.body.innerHTML), rec: JSON.parse(norm(JSON.stringify(rec))) }).toMatchSnapshot(label);
}
function open(sel: never = DEFAULT_SEL, ret = true) {
  return render(<SpreadsheetGridImportModal isOpen onClose={onClose} onImport={makeOnImport(ret)} defaultSelection={sel} />);
}
const surface = () => screen.getByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)');
const paste = (text: string) => fireEvent.paste(surface(), { clipboardData: { getData: () => text } });
const next = () => fireEvent.click(screen.getByText('次へ'));
const combos = () => screen.getAllByRole('combobox') as HTMLSelectElement[];
const slotSelects = () => combos().filter((s) => Array.from(s.options).some((o) => o.text === '枠は？'));
const targetSelects = () => combos().filter((s) => s.getAttribute('aria-label') === '攻撃の対象を選択');
const tmpl = () => ({ timelineEvents: [{ id: 't1', time: 16, name: { ja: 'ビッグブラスト', en: 'BB' }, damageType: 'magical', target: 'MT' }] }) as unknown as TemplateData;

function matrixTSV(): string {
  const T = (cells: string[]) => cells.join('\t');
  return [
    T(['Phase', 'Total Time', 'Action', 'Type', 'Hit', 'Mit', 'Mit', 'Mit']),
    T(['', '', '', '', '', 'ナイト', '白魔道士', '忍者']),
    T(['', '', 'Skill', '', '', 'ランパート', 'アサイラム', 'かげぬい']),
    T(['開幕', '0:16', 'ビッグブラスト', 'Magic', '100,000', 'TRUE', 'TRUE', 'TRUE']),
  ].join('\n');
}
const GRID_TSV = '時間\t敵の攻撃\tナイト\n0:16\tビッグブラスト\tランパート\n';

beforeEach(() => { rec.length = 0; vi.mocked(useIsMobile).mockReturnValue(false); vi.mocked(getTemplate).mockResolvedValue(null); });
afterEach(() => { vi.mocked(useIsMobile).mockReturnValue(false); vi.mocked(getTemplate).mockResolvedValue(null); });

describe('markupLock', () => {
  it('閉じている', () => {
    render(<SpreadsheetGridImportModal isOpen={false} onClose={onClose} onImport={makeOnImport(true)} defaultSelection={DEFAULT_SEL} />);
    snap('closed');
  });

  it('step1 既定選択なし', () => { open(); snap('step1-nosel'); });

  it('step1 既定選択あり', async () => {
    vi.mocked(getTemplate).mockResolvedValue(tmpl());
    open(SEL_WITH_TITLE);
    await act(async () => { await Promise.resolve(); });
    snap('step1-sel');
  });

  it('step2 空 PC', () => { open(); next(); snap('step2-empty-pc'); });
  it('step2 空 スマホ', () => { vi.mocked(useIsMobile).mockReturnValue(true); open(); next(); snap('step2-empty-mobile'); });

  it('見出し形式 PC: 枠未割当→割当→作成', async () => {
    open(); next();
    paste('時間\t敵の攻撃\tナイト\tナイト\n0:16\tビッグブラスト\tランパート\tランパート\n');
    snap('grid-pc-unassigned');
    fireEvent.change(slotSelects()[0], { target: { value: 'MT' } });
    snap('grid-pc-assign-1');
    fireEvent.change(slotSelects()[1], { target: { value: 'ST' } });
    snap('grid-pc-assign-2');
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    snap('grid-pc-created');
  });

  it('見出し形式 PC: 単独ロール自動割当→作成', async () => {
    open(); next(); paste(GRID_TSV);
    snap('grid-pc-auto');
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    snap('grid-pc-auto-created');
  });

  it('見出し形式 スマホ', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    open(); next();
    fireEvent.click(screen.getByText('コピーのやり方'));
    snap('mobile-hint-open');
    fireEvent.change(screen.getByLabelText('スプレッドシートを貼り付け'), { target: { value: '時間\tナイト\tナイト\n0:16\tランパート\tランパート\n' } });
    snap('mobile-grid');
    const sel = screen.getAllByLabelText('枠は？') as HTMLSelectElement[];
    fireEvent.change(sel[0], { target: { value: 'MT' } });
    fireEvent.change(sel[1], { target: { value: 'ST' } });
    snap('mobile-grid-assigned');
  });

  it('スマホ 行列形式', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    open(); next();
    fireEvent.change(screen.getByLabelText('スプレッドシートを貼り付け'), { target: { value: matrixTSV() } });
    snap('mobile-matrix');
  });

  it('列ごと貼り付けモード', () => {
    open(); next();
    fireEvent.click(screen.getByText('列ごとに貼り付け'));
    snap('bycolumn-on');
    fireEvent.change(screen.getAllByPlaceholderText('貼り付け（1行1件）')[0], { target: { value: 'P1\nP2\n' } });
    snap('bycolumn-filled');
    fireEvent.change(screen.getAllByPlaceholderText('貼り付け（1行1件）')[2], { target: { value: '0:10\n0:20\n' } });
    snap('bycolumn-filled-2');
  });

  it('unknown 列→この列は？→メンバー→ジョブ選択', () => {
    open(); next();
    paste('不明列A\t時間\nランパート\t0:10\n');
    snap('unknown-pasted');
    fireEvent.change(screen.getByDisplayValue('この列は？'), { target: { value: '__member__' } });
    snap('unknown-member');
    const js = combos().find((s) => s.getAttribute('aria-label') === 'メンバー（ジョブを選ぶ）')!;
    fireEvent.change(js, { target: { value: 'pld' } });
    snap('unknown-job');
  });

  it('対象 select を手動 override→作成', async () => {
    open(); next();
    paste('時間\t敵の攻撃\t攻撃の対象\tナイト\n0:16\tビッグブラスト\t\tランパート\n');
    snap('override-before');
    fireEvent.change(targetSelects()[0], { target: { value: 'ST' } });
    snap('override-after');
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    snap('override-created');
  });

  it('時間列なしの警告', () => {
    open(); next();
    paste('敵の攻撃\tナイト\nビッグブラスト\tランパート\n');
    snap('no-time');
  });

  it('テンプレ表記(対象)', async () => {
    vi.mocked(getTemplate).mockResolvedValue(tmpl());
    open(SEL_WITH_TITLE); next();
    paste('時間\t敵の攻撃\t攻撃の対象\n0:16\tビッグブラスト\t\n');
    await waitFor(() => expect(screen.queryByText('テンプレ')).not.toBeNull());
    snap('template-target');
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    snap('template-created');
  });

  it('行列形式: フェーズ名→追加→もう1枚→次へ→入替→作成', async () => {
    open(); next();
    paste(matrixTSV());
    snap('matrix-pasted');
    fireEvent.change(screen.getByPlaceholderText('例: P1 神々の像'), { target: { value: 'P1 開幕' } });
    snap('matrix-phasename');
    fireEvent.click(screen.getByText('このフェーズを追加して次へ'));
    snap('matrix-added');
    paste(matrixTSV());
    snap('matrix-second');
    fireEvent.click(screen.getByText('パーティ割当へ'));
    snap('matrix-step3');
    const slotSel = (n: string) => combos().find((s) => s.getAttribute('aria-label') === n)!;
    const mtV = slotSel('MT').value;
    fireEvent.change(slotSel('ST'), { target: { value: mtV } });
    snap('matrix-swapped');
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    snap('matrix-created');
  });

  it('行列形式: 未追加のまま次へ(自動積み)→作成', async () => {
    open(); next();
    paste(matrixTSV());
    fireEvent.click(screen.getByText('パーティ割当へ'));
    snap('matrix-auto-step3');
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    snap('matrix-auto-created');
  });

  it('行列形式の解釈不能(parseFailed)', () => {
    open(); next();
    paste('Phase\tTotal Time\tAction\tMit\nfoo\tbar\tbaz\tTRUE\n');
    snap('parse-failed');
  });

  it('クリアボタン/戻るボタン', () => {
    open(); next();
    paste(GRID_TSV);
    fireEvent.click(screen.getByText('やり直す'));
    snap('cleared');
    fireEvent.click(screen.getByText('戻る'));
    snap('back-to-1');
    next();
    snap('forward-again');
    fireEvent.click(screen.getByText('戻る'));
    fireEvent.click(screen.getByText('キャンセル'));
    snap('cancelled');
  });

  it('クリップボードから貼る(成功・失敗)', async () => {
    const orig = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const setCb = (readText: () => Promise<string>) =>
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText } });
    setCb(async () => '');
    open(); next();
    await act(async () => { fireEvent.click(screen.getByText('gridImport.paste_button')); });
    snap('clipboard-fail-empty');
    setCb(async () => { throw new Error('x'); });
    await act(async () => { fireEvent.click(screen.getByText('gridImport.paste_button')); });
    snap('clipboard-fail-throw');
    setCb(async () => GRID_TSV);
    await act(async () => { fireEvent.click(screen.getByText('gridImport.paste_button')); });
    snap('clipboard-ok');
    if (orig) Object.defineProperty(navigator, 'clipboard', orig);
  });

  it('onImport が false なら閉じない', async () => {
    open(DEFAULT_SEL, false); next(); paste(GRID_TSV);
    fireEvent.click(screen.getByText('この内容で作成'));
    await waitFor(() => expect(rec.length).toBeGreaterThan(0));
    await act(async () => { await Promise.resolve(); });
    snap('import-false');
  });
});
