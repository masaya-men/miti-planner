/**
 * テンプレートエディター スプレッドシート型テーブル
 * フラットテーブル形式 — フェーズ・ラベル・技名(JA/EN/ZH/ZH-Hant/KO)・種別・対象・ダメージ
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent, LocalizedString } from '../../types';
import type { TemplateData } from '../../types/template';
import type { EditState, TemplateLabel } from '../../hooks/useTemplateEditor';
import { formatTime, parseTimeString } from '../../utils/templateConversions';
import { parseSheetAliases } from '../../lib/sheetImport/carryOverTargets';
import { getPhaseForTime, getLabelForTime, getCellHighlight, highlightClass } from './templates/templateEditorHelpers';
import { EditableCell } from './templates/EditableCell';
import { DropdownCell, type DropdownOption } from './templates/DropdownCell';
import { LocalizedEditPopover } from './templates/LocalizedEditPopover';
import { PhaseNamesEditor } from './templates/PhaseNamesEditor';
import { TemplateEditorTableHead } from './templates/TemplateEditorTableHead';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface TemplateEditorProps {
  events: TimelineEvent[];
  phases: TemplateData['phases'];
  labels: TemplateLabel[];
  editState: EditState;
  showUntranslatedOnly: boolean;
  onUpdateCell: (eventId: string, field: string, value: unknown) => void;
  onDeleteEvent: (eventId: string) => void;
  onSetLabelAtTime: (timeSec: number, labelName: LocalizedString | null) => void;
  onUpdatePhaseName: (phaseId: number, name: LocalizedString) => void;
  selectedIds: Set<string>;
  onToggleSelect: (eventId: string) => void;
  onToggleSelectAll: () => void;
}
// ─────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────

export function TemplateEditor({
  events,
  phases,
  labels,
  editState,
  showUntranslatedOnly,
  onUpdateCell,
  onDeleteEvent,
  onSetLabelAtTime,
  onUpdatePhaseName,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: TemplateEditorProps) {
  const { t } = useTranslation();

  // ラベル編集ポップオーバーの状態
  const [editingLabel, setEditingLabel] = useState<{ timeSec: number; labelStartTimeSec: number; pos: { x: number; y: number }; nameObj: LocalizedString } | null>(null);

  // フィルタリング
  const filteredEvents = showUntranslatedOnly
    ? events.filter((ev) => !ev.name.en.trim())
    : events;

  // ラベルグループの先頭行を判定: labels[] から取得したラベルIDが前行と異なるか
  const isFirstInLabelGroup = (index: number, currentLabel: TemplateLabel | null): boolean => {
    if (index === 0) return true;
    const prevLabel = getLabelForTime(filteredEvents[index - 1]?.time ?? 0, labels);
    return currentLabel?.id !== prevLabel?.id;
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
    <>
    {/* フェーズ名編集（時刻は固定、名前のみ編集可能） */}
    {phases.length > 0 && (
      <PhaseNamesEditor phases={phases} onUpdatePhaseName={onUpdatePhaseName} />
    )}

    <div className="overflow-x-auto">
      <table className="w-full text-app-lg border-collapse">
        <TemplateEditorTableHead
          allSelected={filteredEvents.length > 0 && filteredEvents.every((ev) => selectedIds.has(ev.id))}
          onToggleSelectAll={onToggleSelectAll}
        />

        <tbody>
          {filteredEvents.map((event, index) => {
            const evId = event.id;
            const phase = getPhaseForTime(event.time, phases);
            const currentLabel = getLabelForTime(event.time, labels);
            const firstInLabelGroup = isFirstInLabelGroup(index, currentLabel);
            const labelJa = currentLabel?.name?.ja || '';

            const timeHighlight = getCellHighlight(evId, 'time', editState);
            const nameJaHighlight = getCellHighlight(evId, 'name.ja', editState);
            const nameEnHighlight = getCellHighlight(evId, 'name.en', editState);
            const nameZhHighlight = getCellHighlight(evId, 'name.zh', editState);
            const nameZhHantHighlight = getCellHighlight(evId, 'name.zh-Hant', editState);
            const nameKoHighlight = getCellHighlight(evId, 'name.ko', editState);
            const altNameJaHighlight = getCellHighlight(evId, 'altName.ja', editState);
            const altNameEnHighlight = getCellHighlight(evId, 'altName.en', editState);
            const altNameZhHighlight = getCellHighlight(evId, 'altName.zh', editState);
            const altNameZhHantHighlight = getCellHighlight(evId, 'altName.zh-Hant', editState);
            const altNameKoHighlight = getCellHighlight(evId, 'altName.ko', editState);
            const damageHighlight = getCellHighlight(evId, 'damageAmount', editState);
            const damageTypeHighlight = getCellHighlight(evId, 'damageType', editState);
            const targetHighlight = getCellHighlight(evId, 'target', editState);

            const isEnUntranslated = !event.name.en.trim();
            const isEnAutoFilled = editState.autoFilled.has(`${evId}:name.en`);
            const isZhUntranslated = !(event.name.zh ?? '').trim();
            const isZhAutoFilled = editState.autoFilled.has(`${evId}:name.zh`);
            const isZhHantUntranslated = !(event.name['zh-Hant'] ?? '').trim();
            const isZhHantAutoFilled = editState.autoFilled.has(`${evId}:name.zh-Hant`);
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

                {/* フェーズ（表示のみ） */}
                <td className="py-1 pr-2 text-app-text-muted text-app-base">
                  {phase.name}
                </td>

                {/* ラベル（グループ先頭行: ラベル名表示・編集、非先頭行: ＋で新境界追加） */}
                <td className="py-1 pr-2 text-app-base font-medium text-app-text-muted">
                  {firstInLabelGroup ? (
                    <span
                      onClick={(e) => {
                        const isAtBoundary = labels.some(l => l.startTimeSec === event.time);
                        setEditingLabel({
                          timeSec: event.time,
                          labelStartTimeSec: currentLabel?.startTimeSec ?? event.time,
                          pos: { x: e.clientX, y: e.clientY },
                          nameObj: isAtBoundary ? (currentLabel?.name ?? { ja: '', en: '' }) : { ja: '', en: '' },
                        });
                      }}
                      className={`cursor-pointer transition-colors ${labelJa ? 'text-app-text hover:text-blue-400' : 'text-app-text-muted/40 hover:text-blue-400'}`}
                    >
                      {labelJa || '＋'}
                    </span>
                  ) : (
                    <span
                      onClick={(e) => {
                        setEditingLabel({
                          timeSec: event.time,
                          labelStartTimeSec: event.time,
                          pos: { x: e.clientX, y: e.clientY },
                          nameObj: { ja: '', en: '' },
                        });
                      }}
                      className="cursor-pointer text-app-text-muted/20 hover:text-blue-400 transition-colors"
                    >
                      ＋
                    </span>
                  )}
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

                {/* 技名(ZH-Hant) */}
                <td className={`py-1 pr-2 ${highlightClass(nameZhHantHighlight)}`}>
                  <EditableCell
                    value={event.name['zh-Hant'] ?? ''}
                    highlight={nameZhHantHighlight}
                    showAutoLabel={isZhHantAutoFilled && !isZhHantUntranslated}
                    isUntranslatedPlaceholder={isZhHantUntranslated && !isZhHantAutoFilled}
                    onCommit={(val) => onUpdateCell(evId, 'name.zh-Hant', val)}
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

                {/* or技名(JA) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameJaHighlight)}`}>
                  <EditableCell
                    value={event.altName?.ja ?? ''}
                    highlight={altNameJaHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.ja', val)}
                  />
                </td>

                {/* or技名(EN) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameEnHighlight)}`}>
                  <EditableCell
                    value={event.altName?.en ?? ''}
                    highlight={altNameEnHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.en', val)}
                  />
                </td>

                {/* or技名(ZH) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameZhHighlight)}`}>
                  <EditableCell
                    value={event.altName?.zh ?? ''}
                    highlight={altNameZhHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.zh', val)}
                  />
                </td>

                {/* or技名(ZH-Hant) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameZhHantHighlight)}`}>
                  <EditableCell
                    value={event.altName?.['zh-Hant'] ?? ''}
                    highlight={altNameZhHantHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.zh-Hant', val)}
                  />
                </td>

                {/* or技名(KO) */}
                <td className={`py-1 pr-2 ${highlightClass(altNameKoHighlight)}`}>
                  <EditableCell
                    value={event.altName?.ko ?? ''}
                    highlight={altNameKoHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'altName.ko', val)}
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

                {/* デバフ軽減不可 */}
                <td className="py-1 pr-2 text-center">
                  <input
                    type="checkbox"
                    data-testid="tpl-ignores-debuff-mit"
                    checked={!!event.ignoresDebuffMitigation}
                    onChange={(e) => onUpdateCell(evId, 'ignoresDebuffMitigation', e.target.checked)}
                    className="w-4 h-4 accent-red-500 cursor-pointer"
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

                {/* スプシ表記 */}
                <td className="py-1 pr-2">
                  <EditableCell
                    value={event.sheetAliases?.join(', ') ?? ''}
                    highlight={getCellHighlight(evId, 'sheetAliases', editState)}
                    onCommit={(val) => onUpdateCell(evId, 'sheetAliases', parseSheetAliases(val))}
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

    {/* ラベル編集ポップオーバー（テーブル外にfixed表示） */}
    {editingLabel && (
      <LocalizedEditPopover
        title={t('admin.tpl_label_edit_title')}
        initial={editingLabel.nameObj}
        position={editingLabel.pos}
        labels={{
          ja: t('admin.tpl_label_name_ja'),
          en: t('admin.tpl_label_name_en'),
          zh: t('admin.tpl_label_name_zh'),
          'zh-Hant': t('admin.tpl_label_name_zh_hant'),
          ko: t('admin.tpl_label_name_ko'),
        }}
        onApply={(value) => {
          const isEmpty = !value.ja && !value.en && !value.zh && !value['zh-Hant'] && !value.ko;
          if (isEmpty) {
            // 削除: 囲んでいるラベルの境界を削除
            onSetLabelAtTime(editingLabel.labelStartTimeSec, null);
          } else {
            // 追加/更新: クリックした行の時刻にラベル境界を設定
            onSetLabelAtTime(editingLabel.timeSec, value);
          }
          setEditingLabel(null);
        }}
        onCancel={() => setEditingLabel(null)}
      />
    )}

    </>
  );
}
