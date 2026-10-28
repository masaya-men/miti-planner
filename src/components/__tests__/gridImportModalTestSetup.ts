import { screen, fireEvent } from '@testing-library/react';

// i18n: キー→日本語テキストの最小マップ（テスト対象キーのみ）
export const JA: Record<string, string> = {
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
export function interpolate(tmpl: string, vars?: Record<string, unknown>): string {
  if (!vars) return tmpl;
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export const DEFAULT_SEL = { level: null, category: null, bossId: null, title: '' } as never;

/** step2 のグリッド貼り付けサーフェス(aria-label = paste_prompt)を返す。 */
export function gridPasteSurface(): HTMLElement {
  return screen.getByLabelText('ここにスプレッドシートを貼り付け (Ctrl+V)');
}

/** step1 → 次へ で step2 へ進める。 */
export function goToGridStep() {
  fireEvent.click(screen.getByText('次へ'));
}

/** step2 でフェーズを追加(またはそのまま)し、「パーティ割当へ」でstep3へ進める。 */
export function goToPartyStep() {
  fireEvent.click(screen.getByText('パーティ割当へ'));
}

/**
 * parseMitigationSheet が読める行列(matrix)TSV を組み立てる。
 * - ジョブ行 3 ジョブ(ナイト/白魔道士/忍者) → tank/healer/dps が混在
 * - Skill 行(ランパート=解決可 / アサイラム=解決可 / かげぬい=LoPo 未知=skipped)
 */
export function matrixTSV(): string {
  const T = (cells: string[]) => cells.join('\t');
  return [
    T(['Phase', 'Total Time', 'Action', 'Type', 'Hit', 'Mit', 'Mit', 'Mit']),
    T(['', '', '', '', '', 'ナイト', '白魔道士', '忍者']),
    T(['', '', 'Skill', '', '', 'ランパート', 'アサイラム', 'かげぬい']),
    T(['開幕', '0:16', 'ビッグブラスト', 'Magic', '100,000', 'TRUE', 'TRUE', 'TRUE']),
  ].join('\n');
}
