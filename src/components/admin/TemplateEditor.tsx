/**
 * テンプレートエディター スプレッドシート型テーブル
 * フラットテーブル形式 — フェーズ・ラベル・技名(JA/EN/ZH/KO)・種別・対象・ダメージ
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent, LocalizedString } from '../../types';
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
  onUpdateLabel: (mechanicGroupJa: string, newLabel: LocalizedString) => void;
  onUpdatePhaseName: (phaseId: number, phaseName: LocalizedString) => void;
  selectedIds: Set<string>;
  onToggleSelect: (eventId: string) => void;
  onToggleSelectAll: () => void;
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

function getPhaseForTime(
  time: number,
  phases: TemplateData['phases'],
): { id: number; name: string; nameObj?: LocalizedString } {
  let result = phases[0] ?? { id: 1, startTimeSec: 0, name: undefined };
  for (const phase of phases) {
    if (phase.startTimeSec <= time) {
      result = phase;
    }
  }
  const nameObj = result.name
    ? (typeof result.name === 'string' ? { ja: '', en: result.name } : result.name as LocalizedString)
    : undefined;
  const displayName = nameObj ? (nameObj.en || nameObj.ja || `P${result.id}`) : `P${result.id}`;
  return { id: result.id, name: displayName, nameObj };
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
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

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
        className="w-full bg-transparent border-b border-app-text/40 text-app-lg text-app-text focus:outline-none py-0.5"
      />
    );
  }

  if (isUntranslatedPlaceholder) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="block w-full text-app-lg text-app-text-muted/60 border-b border-dashed border-app-text/20 cursor-pointer py-0.5 select-none"
      >
        {t('admin.tpl_editor_untranslated_placeholder')}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`block w-full text-app-lg cursor-pointer py-0.5 select-none ${highlightTextClass(highlight)}`}
    >
      {value || <span className="text-app-text-muted/40">—</span>}
      {showAutoLabel && (
        <span className="ml-1 text-app-sm text-blue-400 opacity-70">{t('admin.tpl_editor_auto_label')}</span>
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
        className="w-full bg-app-bg text-app-lg text-app-text border border-app-text/30 rounded focus:outline-none [&>option]:bg-app-bg [&>option]:text-app-text"
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
      className={`block w-full text-app-lg cursor-pointer py-0.5 select-none ${highlightTextClass(highlight)}`}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// LocalizedEditPopover — 4言語編集ポップオーバー
// ─────────────────────────────────────────────

interface LocalizedEditPopoverProps {
  title: string;
  initial: LocalizedString;
  labels: { ja: string; en: string; zh: string; ko: string };
  onApply: (value: LocalizedString) => void;
  onCancel: () => void;
}

function LocalizedEditPopover({ title, initial, labels, onApply, onCancel }: LocalizedEditPopoverProps) {
  const { t } = useTranslation();
  const [ja, setJa] = useState(initial.ja);
  const [en, setEn] = useState(initial.en);
  const [zh, setZh] = useState(initial.zh ?? '');
  const [ko, setKo] = useState(initial.ko ?? '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  function handleApply() {
    onApply({
      ja,
      en,
      ...(zh ? { zh } : {}),
      ...(ko ? { ko } : {}),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }

  const inputClass = 'w-full px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const labelClass = 'text-app-base text-app-text-muted';

  return (
    <div
      ref={popoverRef}
      onKeyDown={handleKeyDown}
      className="absolute z-50 bg-app-bg border border-app-text/20 rounded-lg p-3 shadow-lg min-w-[240px]"
      style={{ top: '100%', left: 0, marginTop: '2px' }}
    >
      <h4 className="text-app-lg font-medium mb-2">{title}</h4>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>{labels.ja}</label>
          <input type="text" value={ja} onChange={(e) => setJa(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className={labelClass}>{labels.en}</label>
          <input type="text" value={en} onChange={(e) => setEn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{labels.zh}</label>
          <input type="text" value={zh} onChange={(e) => setZh(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
        <div>
          <label className={labelClass}>{labels.ko}</label>
          <input type="text" value={ko} onChange={(e) => setKo(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-app-lg px-3 py-1 rounded border border-app-text/20 text-app-text-muted hover:bg-app-text/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_phase_edit_cancel')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="text-app-lg px-3 py-1 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_phase_edit_apply')}
        </button>
      </div>
    </div>
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
  onUpdateLabel,
  onUpdatePhaseName,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: TemplateEditorProps) {
  const { t } = useTranslation();

  // フェーズ・ラベル編集ポップオーバーの状態
  const [editingPhase, setEditingPhase] = useState<{ phaseId: number; eventId: string } | null>(null);
  const [editingLabel, setEditingLabel] = useState<{ mechanicGroupJa: string; eventId: string } | null>(null);

  // フィルタリング
  const filteredEvents = showUntranslatedOnly
    ? events.filter((ev) => !ev.name.en.trim())
    : events;

  // ラベルグループの先頭行を判定するため、前の行のmechanicGroup.jaを追跡
  const isFirstInGroup = (index: number): boolean => {
    if (index === 0) return true;
    const current = filteredEvents[index]?.mechanicGroup?.ja || '';
    const prev = filteredEvents[index - 1]?.mechanicGroup?.ja || '';
    return current !== prev;
  };

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
      <table className="w-full text-app-lg border-collapse">
        <colgroup>
          <col style={{ width: '32px' }} />  {/* チェックボックス */}
          <col style={{ width: '70px' }} />  {/* フェーズ */}
          <col style={{ width: '120px' }} /> {/* ラベル */}
          <col style={{ width: '55px' }} />  {/* 時間 */}
          <col className="min-w-[100px]" />  {/* 技名JA */}
          <col className="min-w-[100px]" />  {/* 技名EN */}
          <col className="min-w-[100px]" />  {/* 技名ZH */}
          <col className="min-w-[100px]" />  {/* 技名KO */}
          <col style={{ width: '70px' }} />  {/* 種別 */}
          <col style={{ width: '60px' }} />  {/* 対象 */}
          <col style={{ width: '80px' }} />  {/* ダメージ */}
          <col style={{ width: '40px' }} />  {/* 削除 */}
        </colgroup>

        <thead>
          <tr className="border-b border-app-text/10 text-left text-app-text-muted">
            <th className="pb-2 pr-1">
              <input
                type="checkbox"
                checked={filteredEvents.length > 0 && filteredEvents.every((ev) => selectedIds.has(ev.id))}
                onChange={onToggleSelectAll}
                className="cursor-pointer accent-blue-500"
              />
            </th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_phase')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_label')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_time')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_ja')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_en')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_zh')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_ko')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage_type')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_target')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage')}</th>
            <th className="pb-2 font-normal">{t('admin.tpl_editor_delete')}</th>
          </tr>
        </thead>

        <tbody>
          {filteredEvents.map((event, index) => {
            const evId = event.id;
            const phase = getPhaseForTime(event.time, phases);
            const firstInGroup = isFirstInGroup(index);
            const labelJa = event.mechanicGroup?.ja || '';

            const timeHighlight = getCellHighlight(evId, 'time', editState);
            const nameJaHighlight = getCellHighlight(evId, 'name.ja', editState);
            const nameEnHighlight = getCellHighlight(evId, 'name.en', editState);
            const nameZhHighlight = getCellHighlight(evId, 'name.zh', editState);
            const nameKoHighlight = getCellHighlight(evId, 'name.ko', editState);
            const damageHighlight = getCellHighlight(evId, 'damageAmount', editState);
            const damageTypeHighlight = getCellHighlight(evId, 'damageType', editState);
            const targetHighlight = getCellHighlight(evId, 'target', editState);

            const isEnUntranslated = !event.name.en.trim();
            const isEnAutoFilled = editState.autoFilled.has(`${evId}:name.en`);
            const isZhUntranslated = !(event.name.zh ?? '').trim();
            const isZhAutoFilled = editState.autoFilled.has(`${evId}:name.zh`);
            const isKoUntranslated = !(event.name.ko ?? '').trim();
            const isKoAutoFilled = editState.autoFilled.has(`${evId}:name.ko`);

            return (
              <tr
                key={evId}
                className="border-b border-app-text/5 hover:bg-white/[0.03] transition-colors"
              >
                {/* チェックボックス */}
                <td className="py-1 pr-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(evId)}
                    onChange={() => onToggleSelect(evId)}
                    className="cursor-pointer accent-blue-500"
                  />
                </td>

                {/* フェーズ */}
                <td className="py-1 pr-2 text-app-text-muted text-app-base relative">
                  <span
                    onClick={() => setEditingPhase({ phaseId: phase.id, eventId: evId })}
                    className="cursor-pointer hover:text-app-text transition-colors"
                  >
                    {phase.name}
                  </span>
                  {editingPhase?.eventId === evId && (
                    <LocalizedEditPopover
                      title={t('admin.tpl_phase_edit_title')}
                      initial={phase.nameObj ?? { ja: '', en: '' }}
                      labels={{
                        ja: t('admin.tpl_phase_name_ja'),
                        en: t('admin.tpl_phase_name_en'),
                        zh: t('admin.tpl_phase_name_zh'),
                        ko: t('admin.tpl_phase_name_ko'),
                      }}
                      onApply={(value) => {
                        onUpdatePhaseName(editingPhase.phaseId, value);
                        setEditingPhase(null);
                      }}
                      onCancel={() => setEditingPhase(null)}
                    />
                  )}
                </td>

                {/* ラベル（グループ先頭行のみ表示・編集可能） */}
                <td className="py-1 pr-2 text-app-base font-medium text-app-text-muted relative">
                  {firstInGroup && labelJa ? (
                    <>
                      <span
                        onClick={() => setEditingLabel({ mechanicGroupJa: labelJa, eventId: evId })}
                        className="text-app-text cursor-pointer hover:text-blue-400 transition-colors"
                      >
                        {labelJa}
                      </span>
                      {editingLabel?.eventId === evId && (
                        <LocalizedEditPopover
                          title={t('admin.tpl_label_edit_title')}
                          initial={event.mechanicGroup ?? { ja: '', en: '' }}
                          labels={{
                            ja: t('admin.tpl_label_name_ja'),
                            en: t('admin.tpl_label_name_en'),
                            zh: t('admin.tpl_label_name_zh'),
                            ko: t('admin.tpl_label_name_ko'),
                          }}
                          onApply={(value) => {
                            onUpdateLabel(editingLabel.mechanicGroupJa, value);
                            setEditingLabel(null);
                          }}
                          onCancel={() => setEditingLabel(null)}
                        />
                      )}
                    </>
                  ) : null}
                </td>

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

                {/* 技名(ZH) */}
                <td className={`py-1 pr-2 ${highlightClass(nameZhHighlight)}`}>
                  <EditableCell
                    value={event.name.zh ?? ''}
                    highlight={nameZhHighlight}
                    showAutoLabel={isZhAutoFilled && !isZhUntranslated}
                    isUntranslatedPlaceholder={isZhUntranslated && !isZhAutoFilled}
                    onCommit={(val) => onUpdateCell(evId, 'name.zh', val)}
                  />
                </td>

                {/* 技名(KO) */}
                <td className={`py-1 pr-2 ${highlightClass(nameKoHighlight)}`}>
                  <EditableCell
                    value={event.name.ko ?? ''}
                    highlight={nameKoHighlight}
                    showAutoLabel={isKoAutoFilled && !isKoUntranslated}
                    isUntranslatedPlaceholder={isKoUntranslated && !isKoAutoFilled}
                    onCommit={(val) => onUpdateCell(evId, 'name.ko', val)}
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

                {/* 削除ボタン */}
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(evId)}
                    className="text-app-text-muted/50 hover:text-red-400 transition-colors cursor-pointer text-app-2xl leading-none"
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
