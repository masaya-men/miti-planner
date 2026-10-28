/**
 * テンプレートエディター — セル表示まわりの小さな計算(フェーズ・ラベル・ハイライト)
 */
import type { LocalizedString } from '../../../types';
import type { TemplateData } from '../../../types/template';
import type { EditState, TemplateLabel } from '../../../hooks/useTemplateEditor';

export function getPhaseForTime(
  time: number,
  phases: TemplateData['phases'],
): { id: number; name: string; nameObj?: LocalizedString; startTimeSec: number } {
  let result = phases[0] ?? { id: 1, startTimeSec: 0, name: undefined };
  for (const phase of phases) {
    if (phase.startTimeSec <= time) {
      result = phase;
    }
  }
  const nameObj = result.name
    ? (typeof result.name === 'string' ? { ja: '', en: result.name } : result.name as LocalizedString)
    : undefined;
  const displayName = nameObj ? (nameObj.ja || nameObj.en || `P${result.id}`) : `P${result.id}`;
  return { id: result.id, name: displayName, nameObj, startTimeSec: result.startTimeSec ?? 0 };
}

/** 指定時刻が属するラベルを返す（ラベルの startTimeSec 以上で次のラベルの startTimeSec 未満） */
export function getLabelForTime(
  time: number,
  labels: TemplateLabel[],
): TemplateLabel | null {
  if (labels.length === 0) return null;
  let result: TemplateLabel | null = null;
  for (const label of labels) {
    if (label.startTimeSec <= time) {
      result = label;
    }
  }
  return result;
}

export type CellHighlight = 'autofilled' | 'modified' | 'none';

export function getCellHighlight(
  eventId: string,
  field: string,
  editState: EditState,
): CellHighlight {
  const key = `${eventId}:${field}`;
  if (editState.autoFilled.has(key)) return 'autofilled';
  if (editState.modified.has(key)) return 'modified';
  return 'none';
}

export function highlightClass(highlight: CellHighlight): string {
  if (highlight === 'autofilled') return 'bg-blue-500/[0.06]';
  if (highlight === 'modified') return 'bg-amber-500/[0.06]';
  return '';
}

export function highlightTextClass(highlight: CellHighlight): string {
  if (highlight === 'autofilled') return 'text-blue-400';
  if (highlight === 'modified') return 'text-amber-400';
  return '';
}
