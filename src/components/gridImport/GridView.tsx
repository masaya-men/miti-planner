import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { getJobsFromStore, getMitigationsFromStore } from '../../hooks/useSkillsData';
import type { TimelineEvent } from '../../types';
import type { GridTable, GridField } from '../../lib/sheetImport/gridTypes';
import { validateGridColumn } from '../../lib/sheetImport/validateGridColumn';
import { SLOTS_BY_ROLE, type PartySlot } from '../../lib/sheetImport/partyAssignment';
import { resolveEventTarget } from '../../lib/sheetImport/resolveEventTargets';
import type { CarryTarget } from '../../lib/sheetImport/carryOverTargets';
import { resolveSheetSkill } from '../../lib/sheetImport/resolveSheetSkill';
import { type ImportSource, type Lang4, ASSIGNABLE_FIELDS } from './gridImportModel';

/** グリッド本体: 列ヘッダー(チップ)+ 行データ。member 列は MT→D4 順(gridRowsFromResult が party 順=PARTY_SLOTS 順に出力)。 */
export const GridView: React.FC<{
  table: GridTable; setTable: (t: GridTable) => void;
  deps: { mitigations: ReturnType<typeof getMitigationsFromStore>; jobs: ReturnType<typeof getJobsFromStore> };
  source: ImportSource;
  byColumnMode: boolean;
  onColumnPaste: (colIndex: number, text: string) => void;
  /**
   * 対象列セルのインタラクティブ表示に必要。
   * preview.timelineEvents を時刻昇順にソートした配列。
   * grid の行は time が解釈できるものだけ event になるため index 整合が取れないケースがある→
   * (time, name.ja) でマッチする方式を使う。
   */
  previewEvents: TimelineEvent[];
  templateEvents: TimelineEvent[];
  /** 安定キー(`${time}|${name.ja}`) → CarryTarget | 'none' */
  targetOverrides: Record<string, CarryTarget | 'none'>;
  /** 対象 override を変更したとき。key は安定キー。 */
  onTargetOverride: (key: string, value: CarryTarget | 'none') => void;
  /** グリッド表示言語 (ja/en/ko/zh)。ジョブ名ローカライズに使用。 */
  gridLang: Lang4;
}> = ({ table, setTable, deps, source, byColumnMode, onColumnPaste,
        previewEvents, templateEvents, targetOverrides, onTargetOverride, gridLang }) => {
  const { t } = useTranslation();
  const cellsOf = (ci: number) => table.rows.map((r) => r[ci] ?? '');

  /**
   * 「この列は？→メンバー(ジョブを選ぶ)」の2段選択: どの列インデックスがジョブ選択待ちかを保持。
   * null = 選択待ち列なし。
   */
  const [pendingMemberColIdx, setPendingMemberColIdx] = useState<number | null>(null);

  // 列の field を変更
  const setColField = (ci: number, field: GridField) => {
    const cols = table.columns.map((c, i) =>
      i !== ci ? c : field === 'ignore' ? { field: 'ignore' as GridField, header: c.header } : { ...c, field }
    );
    setTable({ ...table, columns: cols });
  };

  /**
   * unknown 列をジョブ付き member 列に変換する(2段選択の確定ステップ)。
   * jobId が必須なため永久デッドエンドにならない。
   */
  const setColMember = (ci: number, jobId: string) => {
    const cols = table.columns.map((c, i) =>
      i !== ci ? c : { field: 'member' as GridField, header: c.header, jobId, slot: null }
    );
    setTable({ ...table, columns: cols });
    setPendingMemberColIdx(null);
  };

  // member 列の枠を変更(自作テーブル)
  const setColSlot = (ci: number, slot: PartySlot | null) => {
    const cols = table.columns.map((c, i) => i !== ci ? c : { ...c, slot });
    setTable({ ...table, columns: cols });
  };

  /**
   * グリッド行に対応する TimelineEvent を (time, name.ja) で検索する。
   * - matrix の場合: 行は gridRowsFromResult の time/action セルから特定できる。
   * - grid の場合: 行は時刻が解釈できるものだけ event になるため index 整合 NG → 同様に検索。
   * 対象列のインデックスを使って行から time/action を抽出し previewEvents でマッチ。
   */
  const iTime = table.columns.findIndex((c) => c.field === 'time');
  const iAction = table.columns.findIndex((c) => c.field === 'action');
  const iTarget = table.columns.findIndex((c) => c.field === 'target');

  /** 行から対応する event を検索する。previewEvents は安定キーでマッチ。 */
  const findEventForRow = (row: string[]): TimelineEvent | null => {
    // time セルは "M:SS" 形式 → 秒数に変換してマッチ
    const timeCell = iTime >= 0 ? (row[iTime] ?? '').trim() : '';
    const actionCell = iAction >= 0 ? (row[iAction] ?? '').trim() : '';
    if (!timeCell && !actionCell) return null;
    // M:SS → 秒数
    const parseMSS = (s: string): number | null => {
      const m = s.match(/^(-?)(\d+):(\d{2})$/);
      if (!m) return null;
      const sign = m[1] === '-' ? -1 : 1;
      return sign * (parseInt(m[2]) * 60 + parseInt(m[3]));
    };
    const timeSec = parseMSS(timeCell);
    if (timeSec === null) return null;
    // previewEvents から (time, name.ja) で探す
    return previewEvents.find((ev) => ev.time === timeSec && ev.name.ja === actionCell) ?? null;
  };

  return (
    <table className="w-full text-app-lg border-separate" style={{ borderSpacing: 0 }}>
      <thead>
        <tr>
          {table.columns.map((c, ci) => {
            // matrix は解決済み表示値の再検証で誤チップが出るためチップ自体を出さない(計算もスキップ)。
            const st = source !== 'matrix' ? validateGridColumn(c, cellsOf(ci), deps) : null;
            const job = c.field === 'member' ? deps.jobs.find((j) => j.id === c.jobId) : undefined;
            const role = job ? (job.role as 'tank' | 'healer' | 'dps') : undefined;
            return (
              <th key={ci} className="sticky top-0 bg-app-surface2 border-b border-r border-app-border px-3 py-2 text-left">
                <div className="flex flex-col gap-1 min-w-[90px]">
                  <span className="font-bold">
                    {c.field === 'member' ? c.header : c.field === 'unknown' ? (c.header || t('gridImport.col_unknown')) : t(`gridImport.col_${c.field}`)}
                  </span>
                  {st && <StatusChip status={st} />}
                  {/* 列ごと貼り付けモード: 各列に textarea(自作テーブルのみ)。
                      key にテーブル形状を含めることで、貼り付け後やリセット後に
                      古いテキストが残らないよう React に再マウントさせる。 */}
                  {byColumnMode && (
                    <textarea
                      key={`col-paste-${ci}-${table.rows.length}-${table.columns.length}`}
                      className="mt-1 w-full h-16 rounded border border-app-border bg-app-surface2 text-app-text text-app-sm px-1 py-0.5 resize-none focus:outline-none focus:border-app-text"
                      placeholder={t('gridImport.col_paste_placeholder')}
                      onChange={(e) => onColumnPaste(ci, e.target.value)}
                    />
                  )}
                  {/* 「この列は？」セレクタ (unknown 列・自作テーブルのみ)。
                      ③ standalone help 行は畳み、help 文言はこの場の title に寄せた(モックに help 行は無い)。 */}
                  {c.field === 'unknown' && source !== 'matrix' && (
                    <>
                      <select
                        title={t('gridImport.help')}
                        className="mt-1 w-full appearance-none bg-app-surface2 border border-app-border rounded px-1 py-0.5 text-app-sm text-app-text focus:outline-none"
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__member__') {
                            // 2段選択: まずジョブ選択待ちにする
                            setPendingMemberColIdx(ci);
                          } else if (val) {
                            setPendingMemberColIdx(null);
                            setColField(ci, val as GridField);
                          }
                        }}
                      >
                        <option value="">{t('gridImport.this_column')}</option>
                        {ASSIGNABLE_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {f === 'ignore' ? t('gridImport.ignore_column') : t(`gridImport.col_${f}`)}
                          </option>
                        ))}
                        <option value="__member__">{t('gridImport.assign_member_job')}</option>
                      </select>
                      {/* 2段目: ジョブ選択(pendingMemberColIdx がこの列を指しているとき) */}
                      {pendingMemberColIdx === ci && (
                        <select
                          className="mt-1 w-full appearance-none bg-app-surface2 border border-app-amber-border rounded px-1 py-0.5 text-app-sm text-app-text focus:outline-none"
                          value=""
                          aria-label={t('gridImport.assign_member_job')}
                          onChange={(e) => {
                            const jobId = e.target.value;
                            if (jobId) setColMember(ci, jobId);
                          }}
                        >
                          <option value="">{t('gridImport.assign_member_job')}</option>
                          {deps.jobs.map((j) => (
                            <option key={j.id} value={j.id}>{(j.name[gridLang as keyof typeof j.name] ?? j.name.ja) || j.id}</option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                  {/* 枠セレクタは自作(grid)のみ。matrix の割当はステップ3に集約。 */}
                  {c.field === 'member' && role && source === 'grid' && (
                    <select
                      className="mt-1 w-full appearance-none bg-app-surface2 border border-app-border rounded px-1 py-0.5 text-app-sm text-app-text focus:outline-none"
                      value={c.slot ?? ''}
                      onChange={(e) => {
                        const val = e.target.value as PartySlot | '';
                        setColSlot(ci, val || null);
                      }}
                    >
                      <option value="">{t('gridImport.assign_slot')}</option>
                      {SLOTS_BY_ROLE[role].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, ri) => {
          // 対象列セルの編集: 行に対応する event を特定して resolve する
          const rowEvent = iTarget >= 0 ? findEventForRow(r) : null;
          const stableKey = rowEvent ? `${rowEvent.time}|${rowEvent.name.ja}` : null;
          // overridesById は event.id ベースだが、セル表示は安定キーベース override から直接計算
          const resolvedForRow = rowEvent
            ? (() => {
                const ov = stableKey ? targetOverrides[stableKey] : undefined;
                // resolveEventTarget と同じ優先順を再現(overrides[id] を安定キーで引く)
                const dummyOverridesById: Record<string, CarryTarget | 'none'> = ov !== undefined
                  ? { [rowEvent.id]: ov }
                  : {};
                return resolveEventTarget(rowEvent, templateEvents, dummyOverridesById);
              })()
            : null;

          return (
            <tr key={ri}>
              {table.columns.map((col, ci) => {
                // 対象列のみ <select> に。それ以外は通常テキスト。
                if (col.field === 'target' && rowEvent && resolvedForRow) {
                  const isTemplate = resolvedForRow.source === 'template';
                  return (
                    <td key={ci} className="border-b border-r border-app-border px-2 py-1">
                      <select
                        aria-label={t('gridImport.target_select_label')}
                        className={clsx(
                          'w-full appearance-none rounded border px-1 py-0.5 text-app-sm focus:outline-none focus:border-app-text',
                          'bg-app-surface2 border-app-border',
                          isTemplate ? 'text-app-text-muted' : 'text-app-text',
                        )}
                        value={resolvedForRow.target ?? 'none'}
                        onChange={(e) => {
                          if (!stableKey) return;
                          onTargetOverride(stableKey, e.target.value as CarryTarget | 'none');
                        }}
                      >
                        <option value="MT">MT</option>
                        <option value="ST">ST</option>
                        <option value="AoE">{t('gridImport.target_aoe')}</option>
                        <option value="none">{t('gridImport.target_none')}</option>
                      </select>
                      {isTemplate && (
                        <span className="block text-app-sm text-app-text-muted mt-0.5">
                          {t('gridImport.target_from_template')}
                        </span>
                      )}
                    </td>
                  );
                }
                // member 列: ` / ` 分割 → 各パートを resolveSheetSkill で判定して描画。
                if (col.field === 'member') {
                  const cellText = r[ci] ?? '';
                  const jobJa = deps.jobs.find((j) => j.id === col.jobId)?.name.ja ?? '';
                  const parts = cellText.split(' / ');

                  // grid かつ全パートが未解決 → セル全体を編集可能 input にする(在席編集)。
                  // grid の member セルは 1 セル = 1 スキルのため分割不要、セル全体を input に。
                  const isUnresolved = (p: string) =>
                    p.trim() !== '' && resolveSheetSkill(jobJa, p.trim(), deps.mitigations) === null;
                  const hasAnyUnresolved = parts.some(isUnresolved);

                  if (source === 'grid' && hasAnyUnresolved) {
                    return (
                      <td key={ci} className="border-b border-r border-app-border px-2 py-1">
                        <input
                          type="text"
                          defaultValue={cellText}
                          className="w-full bg-transparent text-app-amber underline decoration-dotted text-app-sm focus:outline-none focus:border-b focus:border-app-amber"
                          onBlur={(e) => {
                            const newVal = e.target.value;
                            const newRows = table.rows.map((row, rowIdx) => {
                              if (rowIdx !== ri) return row;
                              const newRow = [...row];
                              newRow[ci] = newVal;
                              return newRow;
                            });
                            setTable({ ...table, rows: newRows });
                          }}
                        />
                      </td>
                    );
                  }

                  // matrix or grid で一部/全部解決済み → パートごとに色分けして表示。
                  return (
                    <td key={ci} className="border-b border-r border-app-border px-3 py-1.5">
                      {parts.map((part, pi) => {
                        const trimmed = part.trim();
                        const resolved = trimmed === '' || resolveSheetSkill(jobJa, trimmed, deps.mitigations) !== null;
                        return (
                          <span key={pi}>
                            {pi > 0 && <span className="text-app-text-muted"> / </span>}
                            <span className={clsx(resolved ? 'text-app-text' : 'text-app-amber underline decoration-dotted')}>
                              {part}
                            </span>
                          </span>
                        );
                      })}
                    </td>
                  );
                }

                return (
                  <td key={ci} className="border-b border-r border-app-border px-3 py-1.5 text-app-text">{r[ci] ?? ''}</td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

const StatusChip: React.FC<{ status: 'ok' | 'partial' | 'empty' }> = ({ status }) => {
  const { t } = useTranslation();
  const map = {
    ok: 'text-app-blue bg-app-blue-dim border-app-blue-border',
    partial: 'text-app-amber bg-app-amber-dim border-app-amber-border',
    empty: 'text-app-text-muted bg-app-text/5 border-app-border',
  } as const;
  const label = status === 'ok' ? t('gridImport.status_ok') : status === 'partial' ? t('gridImport.status_partial') : t('gridImport.status_empty');
  return <span className={clsx('text-app-sm font-bold rounded-full px-2 py-0.5 border w-max', map[status])}>{label}</span>;
};
