import { useState, useCallback, useMemo } from 'react';
import type { TimelineEvent, LocalizedString } from '../types';
import type { TemplateData } from '../data/templateLoader';
import { isLegacyLabelFormat, migrateLabels } from '../utils/labelMigration';

/** TemplateData.labels の要素型 */
export type TemplateLabel = NonNullable<TemplateData['labels']>[number];

/** FFLogs翻訳マッチ結果 */
export interface TranslationMatchResult {
  lang: 'en' | 'zh' | 'ko';
  /** eventId → 翻訳名 */
  translations: Map<string, string>;
  /** eventId → GUID（GUIDが未設定だったイベント用） */
  guids: Map<string, number>;
}

export interface EditState {
  original: TimelineEvent[];
  originalPhases: TemplateData['phases'];
  originalLabels: TemplateLabel[];
  current: TimelineEvent[];
  currentPhases: TemplateData['phases'];
  currentLabels: TemplateLabel[];
  modified: Set<string>;   // "eventId:fieldName"
  autoFilled: Set<string>; // "eventId:fieldName"
  deleted: Set<string>;    // eventId
}

const emptyState = (): EditState => ({
  original: [],
  originalPhases: [],
  originalLabels: [],
  current: [],
  currentPhases: [],
  currentLabels: [],
  modified: new Set(),
  autoFilled: new Set(),
  deleted: new Set(),
});

/**
 * mechanicGroup から TemplateLabel[] を導出するヘルパー。
 * migrateLabels を使って Label[] → TemplateLabel[] に変換する。
 */
function deriveLabelsFromEvents(
  events: TimelineEvent[],
  phases: TemplateData['phases'],
): TemplateLabel[] {
  const hasLegacy = isLegacyLabelFormat({ labels: undefined, timelineEvents: events });
  if (!hasLegacy) return [];

  const phasesForMigration = (phases || []).map(p => ({
    id: `phase_${p.id}`,
    name: p.name || { ja: '', en: '' },
    startTime: p.startTimeSec,
  }));
  const migrated = migrateLabels(events, phasesForMigration);

  return migrated.map((label, i) => ({
    id: i + 1,
    startTimeSec: label.startTime,
    name: label.name,
    ...(label.endTime !== undefined ? { endTimeSec: label.endTime } : {}),
  }));
}

export function useTemplateEditor() {
  const [state, setState] = useState<EditState>(emptyState);
  const [autoPropagate, setAutoPropagate] = useState(true);

  // visibleEvents: current を deleted 除外してフィルタ
  const visibleEvents = useMemo(
    () => state.current.filter((ev) => !state.deleted.has(ev.id)),
    [state.current, state.deleted],
  );

  // 未翻訳カウント（name.en が空白のもの）
  const untranslatedCount = useMemo(
    () => visibleEvents.filter((ev) => !ev.name.en.trim()).length,
    [visibleEvents],
  );

  // 変更あり判定
  const hasChanges = useMemo(
    () => state.modified.size > 0 || state.deleted.size > 0,
    [state.modified, state.deleted],
  );

  // データをロード（全リセット）
  // labels が渡されればそのまま使い、なければ mechanicGroup から移行する
  const loadEvents = useCallback(
    (events: TimelineEvent[], phases: TemplateData['phases'], labels?: TemplateLabel[]) => {
      const clonedEvents = structuredClone(events);
      const clonedPhases = structuredClone(phases);
      let clonedLabels: TemplateLabel[];

      if (labels && labels.length > 0) {
        clonedLabels = structuredClone(labels);
      } else {
        // mechanicGroup から labels を導出
        clonedLabels = deriveLabelsFromEvents(clonedEvents, clonedPhases);
      }

      setState({
        original: clonedEvents,
        originalPhases: clonedPhases,
        originalLabels: structuredClone(clonedLabels),
        current: structuredClone(clonedEvents),
        currentPhases: structuredClone(clonedPhases),
        currentLabels: structuredClone(clonedLabels),
        modified: new Set(),
        autoFilled: new Set(),
        deleted: new Set(),
      });
    },
    [],
  );

  // セル値を更新
  const updateCell = useCallback(
    (eventId: string, field: string, value: unknown) => {
      setState((prev) => {
        const newCurrent = structuredClone(prev.current);
        const ev = newCurrent.find((e) => e.id === eventId);
        if (!ev) return prev;

        const oldJa = ev.name.ja;
        const oldEn = ev.name.en;

        switch (field) {
          case 'time':
            ev.time = value as number;
            break;
          case 'name.ja':
            ev.name.ja = value as string;
            break;
          case 'name.en':
            ev.name.en = value as string;
            break;
          case 'name.zh':
            ev.name.zh = value as string;
            break;
          case 'name.ko':
            ev.name.ko = value as string;
            break;
          case 'damageAmount':
            ev.damageAmount = value as number | undefined;
            break;
          case 'damageType':
            ev.damageType = value as TimelineEvent['damageType'];
            break;
          case 'target':
            ev.target = value as TimelineEvent['target'];
            break;
          default:
            return prev;
        }

        const key = `${eventId}:${field}`;
        const newModified = new Set(prev.modified);
        newModified.add(key);

        const newAutoFilled = new Set(prev.autoFilled);
        newAutoFilled.delete(key);

        // 翻訳自動伝播
        const translationFields = ['name.en', 'name.ja', 'name.zh', 'name.ko'] as const;
        if (autoPropagate && translationFields.includes(field as typeof translationFields[number])) {
          const oldZh = ev.name.zh ?? '';
          const oldKo = ev.name.ko ?? '';

          for (const other of newCurrent) {
            if (other.id === eventId || prev.deleted.has(other.id)) continue;

            if (field === 'name.en') {
              if (other.name.ja === oldJa && (other.name.en === '' || other.name.en === oldEn)) {
                other.name.en = value as string;
                newAutoFilled.add(`${other.id}:name.en`);
              }
            } else if (field === 'name.ja') {
              if (other.name.en === oldEn && oldEn !== '' && (other.name.ja === '' || other.name.ja === oldJa)) {
                other.name.ja = value as string;
                newAutoFilled.add(`${other.id}:name.ja`);
              }
            } else if (field === 'name.zh') {
              if (other.name.ja === oldJa && ((other.name.zh ?? '') === '' || (other.name.zh ?? '') === oldZh)) {
                other.name.zh = value as string;
                newAutoFilled.add(`${other.id}:name.zh`);
              }
            } else if (field === 'name.ko') {
              if (other.name.ja === oldJa && ((other.name.ko ?? '') === '' || (other.name.ko ?? '') === oldKo)) {
                other.name.ko = value as string;
                newAutoFilled.add(`${other.id}:name.ko`);
              }
            }
          }
        }

        return {
          ...prev,
          current: newCurrent,
          modified: newModified,
          autoFilled: newAutoFilled,
        };
      });
    },
    [autoPropagate],
  );

  // イベント削除
  const deleteEvent = useCallback((eventId: string) => {
    setState((prev) => {
      const newDeleted = new Set(prev.deleted);
      newDeleted.add(eventId);
      return { ...prev, deleted: newDeleted };
    });
  }, []);

  // 元に戻す
  const undo = useCallback(() => {
    setState((prev) => ({
      ...prev,
      current: structuredClone(prev.original),
      currentPhases: structuredClone(prev.originalPhases),
      currentLabels: structuredClone(prev.originalLabels),
      modified: new Set(),
      autoFilled: new Set(),
      deleted: new Set(),
    }));
  }, []);

  // 英語名を自動入力
  const autoFillEnNames = useCallback(
    (matches: Map<string, string>) => {
      setState((prev) => {
        const newCurrent = structuredClone(prev.current);
        const newAutoFilled = new Set(prev.autoFilled);

        for (const ev of newCurrent) {
          if (prev.deleted.has(ev.id)) continue;
          if (matches.has(ev.name.ja) && !ev.name.en.trim()) {
            ev.name.en = matches.get(ev.name.ja)!;
            newAutoFilled.add(`${ev.id}:name.en`);
          }
        }

        return { ...prev, current: newCurrent, autoFilled: newAutoFilled };
      });
    },
    [],
  );

  // 翻訳を一括適用（zh/ko + GUID保存）
  const applyTranslation = useCallback(
    (result: TranslationMatchResult) => {
      setState((prev) => {
        const newCurrent = structuredClone(prev.current);
        const newAutoFilled = new Set(prev.autoFilled);

        for (const ev of newCurrent) {
          if (prev.deleted.has(ev.id)) continue;

          const translation = result.translations.get(ev.id);
          if (translation) {
            ev.name[result.lang] = translation;
            newAutoFilled.add(`${ev.id}:name.${result.lang}`);
          }

          const guid = result.guids.get(ev.id);
          if (guid && !ev.guid) {
            ev.guid = guid;
          }
        }

        return { ...prev, current: newCurrent, autoFilled: newAutoFilled };
      });
    },
    [],
  );

  // 全データを置き換え（loadEvents と同じ）
  const replaceAll = useCallback(
    (events: TimelineEvent[], phases: TemplateData['phases'], labels?: TemplateLabel[]) => {
      const clonedEvents = structuredClone(events);
      const clonedPhases = structuredClone(phases);
      let clonedLabels: TemplateLabel[];

      if (labels && labels.length > 0) {
        clonedLabels = structuredClone(labels);
      } else {
        clonedLabels = deriveLabelsFromEvents(clonedEvents, clonedPhases);
      }

      setState({
        original: clonedEvents,
        originalPhases: clonedPhases,
        originalLabels: structuredClone(clonedLabels),
        current: structuredClone(clonedEvents),
        currentPhases: structuredClone(clonedPhases),
        currentLabels: structuredClone(clonedLabels),
        modified: new Set(),
        autoFilled: new Set(),
        deleted: new Set(),
      });
    },
    [],
  );

  // フェーズ名のみを更新（ID指定、境界時刻は変更しない）
  const updatePhaseName = useCallback(
    (phaseId: number, name: LocalizedString) => {
      setState((prev) => {
        const newPhases = structuredClone(prev.currentPhases);
        const phase = newPhases.find(p => p.id === phaseId);
        if (!phase) return prev;
        phase.name = name;
        return { ...prev, currentPhases: newPhases, modified: new Set([...prev.modified, '__phases__']) };
      });
    },
    [],
  );

  // ─────────────────────────────────────────────
  // ラベル CRUD（labels[] ベース）
  // ─────────────────────────────────────────────

  /** ラベルを追加（指定時刻に新しいラベル境界を作成） */
  const addLabel = useCallback(
    (timeSec: number, name: LocalizedString) => {
      setState((prev) => {
        const newLabels = structuredClone(prev.currentLabels);
        const maxId = newLabels.reduce((max, l) => Math.max(max, l.id), 0);
        newLabels.push({ id: maxId + 1, startTimeSec: timeSec, name });
        newLabels.sort((a, b) => a.startTimeSec - b.startTimeSec);
        return { ...prev, currentLabels: newLabels, modified: new Set([...prev.modified, '__labels__']) };
      });
    },
    [],
  );

  /** ラベルを更新（ID指定で名前を変更） */
  const updateLabel = useCallback(
    (labelId: number, name: LocalizedString) => {
      setState((prev) => {
        const newLabels = structuredClone(prev.currentLabels);
        const label = newLabels.find((l) => l.id === labelId);
        if (!label) return prev;
        label.name = name;
        return { ...prev, currentLabels: newLabels, modified: new Set([...prev.modified, '__labels__']) };
      });
    },
    [],
  );

  /** ラベルを削除（ID指定） */
  const removeLabel = useCallback(
    (labelId: number) => {
      setState((prev) => {
        const newLabels = prev.currentLabels.filter((l) => l.id !== labelId);
        return { ...prev, currentLabels: newLabels, modified: new Set([...prev.modified, '__labels__']) };
      });
    },
    [],
  );

  /** ラベルを時刻で追加/更新/削除する（フェーズのsetPhaseAtTimeと同じパターン） */
  const setLabelAtTime = useCallback(
    (timeSec: number, labelName: LocalizedString | null) => {
      setState((prev) => {
        let newLabels = structuredClone(prev.currentLabels);
        const isEmpty = !labelName || (!labelName.ja && !labelName.en && !labelName.zh && !labelName.ko);

        const existingIdx = newLabels.findIndex((l) => l.startTimeSec === timeSec);

        if (isEmpty) {
          if (existingIdx >= 0) {
            newLabels.splice(existingIdx, 1);
          }
        } else {
          if (existingIdx >= 0) {
            newLabels[existingIdx].name = labelName;
          } else {
            const maxId = newLabels.reduce((max, l) => Math.max(max, l.id), 0);
            newLabels.push({ id: maxId + 1, startTimeSec: timeSec, name: labelName });
            newLabels.sort((a, b) => a.startTimeSec - b.startTimeSec);
          }
        }

        return { ...prev, currentLabels: newLabels, modified: new Set([...prev.modified, '__labels__']) };
      });
    },
    [],
  );

  // 複数イベントのフィールドを一括更新
  const bulkUpdate = useCallback(
    (eventIds: Set<string>, changes: Record<string, unknown>) => {
      setState((prev) => {
        const newCurrent = structuredClone(prev.current);
        const newModified = new Set(prev.modified);

        for (const ev of newCurrent) {
          if (!eventIds.has(ev.id) || prev.deleted.has(ev.id)) continue;

          for (const [field, value] of Object.entries(changes)) {
            switch (field) {
              case 'name.ja':
                ev.name.ja = value as string;
                break;
              case 'name.en':
                ev.name.en = value as string;
                break;
              case 'target':
                ev.target = value as TimelineEvent['target'];
                break;
              case 'damageAmount':
                ev.damageAmount = value as number | undefined;
                break;
              case 'damageType':
                ev.damageType = value as TimelineEvent['damageType'];
                break;
            }
            newModified.add(`${ev.id}:${field}`);
          }
        }

        return { ...prev, current: newCurrent, modified: newModified };
      });
    },
    [],
  );

  // 保存用データを返す
  const getSaveData = useCallback(() => {
    return {
      events: state.current.filter((ev) => !state.deleted.has(ev.id)),
      phases: state.currentPhases,
      labels: state.currentLabels,
    };
  }, [state]);

  return {
    state,
    visibleEvents,
    untranslatedCount,
    hasChanges,
    loadEvents,
    updateCell,
    deleteEvent,
    undo,
    autoFillEnNames,
    applyTranslation,
    replaceAll,
    getSaveData,
    updatePhaseName,
    addLabel,
    updateLabel,
    removeLabel,
    setLabelAtTime,
    bulkUpdate,
    autoPropagate,
    setAutoPropagate,
  };
}
