/**
 * テンプレートエディター スプレッドシート型テーブル
 * インライン編集・フェーズ区切り・ハイライト・削除ボタンを備えた編集テーブル
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';
import type { EditState } from '../../hooks/useTemplateEditor';
import { formatTime, parseTimeString } from '../../utils/templateConversions';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface TemplateEditorProps {
  events: TimelineEvent[];
  phases: TemplateData['phases'];
  editState: EditState;
  showUntranslatedOnly: boolean;
  onUpdateCell: (eventId: string, field: string, value: any) => void;
  onDeleteEvent: (eventId: string) => void;
}

type RowItem =
  | { type: 'phase-separator'; phaseId: number; phaseName: string }
  | { type: 'event'; event: TimelineEvent; phaseId: number };

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

function getPhaseForTime(
  time: number,
  phases: TemplateData['phases'],
): { id: number; name: string } {
  // startTimeSec <= time となる最後のフェーズを選択
  let result = phases[0] ?? { id: 1, startTimeSec: 0, name: undefined };
  for (const phase of phases) {
    if (phase.startTimeSec <= time) {
      result = phase;
    }
  }
  return { id: result.id, name: result.name ?? `P${result.id}` };
}

type CellHighlight = 'autofilled' | 'modified' | 'none';

function getCellHighlight(
  eventId: string,
  field: string,
  editState: EditState,
): CellHighlight {
  const key = `${eventId}:${field}`;
  if (editState.autoFilled.has(key)) return 'autofilled';
  if (editState.modified.has(key)) return 'modified';
  return 'none';
}

function highlightClass(highlight: CellHighlight): string {
  if (highlight === 'autofilled') return 'bg-blue-500/[0.06]';
  if (highlight === 'modified') return 'bg-amber-500/[0.06]';
  return '';
}

function highlightTextClass(highlight: CellHighlight): string {
  if (highlight === 'autofilled') return 'text-blue-400';
  if (highlight === 'modified') return 'text-amber-400';
  return '';
}

// ─────────────────────────────────────────────
// EditableCell — テキスト/数値のインライン編集セル
// ─────────────────────────────────────────────

interface EditableCellProps {
  value: string;
  highlight: CellHighlight;
  showAutoLabel?: boolean;
  isUntranslatedPlaceholder?: boolean;
  inputType?: 'text' | 'number';
  onCommit: (value: string) => void;
}

function EditableCell({
  value,
  highlight,
  showAutoLabel = false,
  isUntranslatedPlaceholder = false,
  inputType = 'text',
  onCommit,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // 外部からの値変化に追従（編集中は無視）
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleCommit() {
    setEditing(false);
    if (draft !== value) {
      onCommit(draft);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-app-text/40 text-xs text-app-text focus:outline-none py-0.5"
      />
    );
  }

  if (isUntranslatedPlaceholder) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="block w-full text-xs text-app-text-muted/60 border-b border-dashed border-app-text/20 cursor-pointer py-0.5 select-none"
      >
        未翻訳 — クリックで入力
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`block w-full text-xs cursor-pointer py-0.5 select-none ${highlightTextClass(highlight)}`}
    >
      {value || <span className="text-app-text-muted/40">—</span>}
      {showAutoLabel && (
        <span className="ml-1 text-[9px] text-blue-400 opacity-70">自動</span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────
// DropdownCell — セレクトボックスのインライン編集セル
// ─────────────────────────────────────────────

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownCellProps {
  value: string;
  options: DropdownOption[];
  highlight: CellHighlight;
  onCommit: (value: string) => void;
}

function DropdownCell({ value, options, highlight, onCommit }: DropdownCellProps) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open && selectRef.current) {
      selectRef.current.focus();
    }
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onCommit(e.target.value);
    setOpen(false);
  }

  const label = options.find((o) => o.value === value)?.label ?? value;

  if (open) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={handleChange}
        onBlur={() => setOpen(false)}
        className="w-full bg-app-bg text-xs text-app-text border border-app-text/30 rounded focus:outline-none [&>option]:bg-app-bg [&>option]:text-app-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={() => setOpen(true)}
      className={`block w-full text-xs cursor-pointer py-0.5 select-none ${highlightTextClass(highlight)}`}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────

export function TemplateEditor({
  events,
  phases,
  editState,
  showUntranslatedOnly,
  onUpdateCell,
  onDeleteEvent,
}: TemplateEditorProps) {
  const { t } = useTranslation();

  // フィルタリング
  const filteredEvents = showUntranslatedOnly
    ? events.filter((ev) => !ev.name.en.trim())
    : events;

  // フェーズ区切りを含むフラット行リストを構築
  const rows: RowItem[] = [];
  let lastPhaseId: number | null = null;

  for (const event of filteredEvents) {
    const phase = getPhaseForTime(event.time, phases);

    if (phase.id !== lastPhaseId) {
      rows.push({
        type: 'phase-separator',
        phaseId: phase.id,
        phaseName: phase.name,
      });
      lastPhaseId = phase.id;
    }

    rows.push({ type: 'event', event, phaseId: phase.id });
  }

  // ダメージ種別の選択肢
  const damageTypeOptions: DropdownOption[] = [
    { value: 'magical', label: t('admin.tpl_damage_magical') },
    { value: 'physical', label: t('admin.tpl_damage_physical') },
    { value: 'unavoidable', label: t('admin.tpl_damage_unavoidable') },
    { value: 'enrage', label: t('admin.tpl_damage_enrage') },
  ];

  // ターゲットの選択肢
  const targetOptions: DropdownOption[] = [
    { value: 'AoE', label: t('admin.tpl_target_aoe') },
    { value: 'MT', label: t('admin.tpl_target_mt') },
    { value: 'ST', label: t('admin.tpl_target_st') },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <colgroup>
          <col style={{ width: '60px' }} />
          <col style={{ width: '80px' }} />
          <col style={{ width: '1fr' }} className="min-w-[120px]" />
          <col style={{ width: '1fr' }} className="min-w-[120px]" />
          <col style={{ width: '80px' }} />
          <col style={{ width: '70px' }} />
          <col style={{ width: '60px' }} />
          <col style={{ width: '40px' }} />
        </colgroup>

        <thead>
          <tr className="border-b border-app-text/10 text-left text-app-text-muted">
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_time')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_phase')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_ja')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_en')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage_type')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_target')}</th>
            <th className="pb-2 font-normal">{t('admin.tpl_editor_delete')}</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            if (row.type === 'phase-separator') {
              return (
                <tr key={`phase-${row.phaseId}-${index}`} className="bg-blue-500/[0.08]">
                  <td colSpan={8} className="py-1 px-2 font-bold text-blue-400 text-[11px]">
                    {row.phaseName}
                  </td>
                </tr>
              );
            }

            const { event } = row;
            const evId = event.id;

            const timeHighlight = getCellHighlight(evId, 'time', editState);
            const nameJaHighlight = getCellHighlight(evId, 'name.ja', editState);
            const nameEnHighlight = getCellHighlight(evId, 'name.en', editState);
            const damageHighlight = getCellHighlight(evId, 'damageAmount', editState);
            const damageTypeHighlight = getCellHighlight(evId, 'damageType', editState);
            const targetHighlight = getCellHighlight(evId, 'target', editState);

            const isEnUntranslated = !event.name.en.trim();
            const isEnAutoFilled = editState.autoFilled.has(`${evId}:name.en`);

            return (
              <tr
                key={evId}
                className="border-b border-app-text/5 hover:bg-white/[0.03] transition-colors"
              >
                {/* 時間 */}
                <td className={`py-1 pr-2 ${highlightClass(timeHighlight)}`}>
                  <EditableCell
                    value={formatTime(event.time)}
                    highlight={timeHighlight}
                    onCommit={(val) => {
                      const parsed = parseTimeString(val);
                      if (parsed !== null) {
                        onUpdateCell(evId, 'time', parsed);
                      }
                    }}
                  />
                </td>

                {/* フェーズ（読み取り専用） */}
                <td className="py-1 pr-2 text-app-text-muted">
                  {getPhaseForTime(event.time, phases).name}
                </td>

                {/* 技名(JA) */}
                <td className={`py-1 pr-2 ${highlightClass(nameJaHighlight)}`}>
                  <EditableCell
                    value={event.name.ja}
                    highlight={nameJaHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'name.ja', val)}
                  />
                </td>

                {/* 技名(EN) */}
                <td className={`py-1 pr-2 ${highlightClass(nameEnHighlight)}`}>
                  <EditableCell
                    value={event.name.en}
                    highlight={nameEnHighlight}
                    showAutoLabel={isEnAutoFilled && !isEnUntranslated}
                    isUntranslatedPlaceholder={isEnUntranslated && !isEnAutoFilled}
                    onCommit={(val) => onUpdateCell(evId, 'name.en', val)}
                  />
                </td>

                {/* ダメージ */}
                <td className={`py-1 pr-2 ${highlightClass(damageHighlight)}`}>
                  <EditableCell
                    value={event.damageAmount !== undefined ? String(event.damageAmount) : ''}
                    highlight={damageHighlight}
                    inputType="number"
                    onCommit={(val) => {
                      const num = val === '' ? undefined : parseInt(val, 10);
                      onUpdateCell(evId, 'damageAmount', isNaN(num as number) ? undefined : num);
                    }}
                  />
                </td>

                {/* 種別 */}
                <td className={`py-1 pr-2 ${highlightClass(damageTypeHighlight)}`}>
                  <DropdownCell
                    value={event.damageType}
                    options={damageTypeOptions}
                    highlight={damageTypeHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'damageType', val)}
                  />
                </td>

                {/* 対象 */}
                <td className={`py-1 pr-2 ${highlightClass(targetHighlight)}`}>
                  <DropdownCell
                    value={event.target ?? 'AoE'}
                    options={targetOptions}
                    highlight={targetHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'target', val)}
                  />
                </td>

                {/* 削除ボタン */}
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(evId)}
                    className="text-app-text-muted/50 hover:text-red-400 transition-colors cursor-pointer text-sm leading-none"
                    aria-label={t('admin.tpl_editor_delete')}
                  >
                    x
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
