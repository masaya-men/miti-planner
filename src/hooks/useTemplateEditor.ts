import { useState, useCallback, useMemo } from 'react';
import type { TimelineEvent } from '../types';
import type { TemplateData } from '../data/templateLoader';

export interface EditState {
  original: TimelineEvent[];
  originalPhases: TemplateData['phases'];
  current: TimelineEvent[];
  currentPhases: TemplateData['phases'];
  modified: Set<string>;   // "eventId:fieldName"
  autoFilled: Set<string>; // "eventId:fieldName"
  deleted: Set<string>;    // eventId
}

const emptyState = (): EditState => ({
  original: [],
  originalPhases: [],
  current: [],
  currentPhases: [],
  modified: new Set(),
  autoFilled: new Set(),
  deleted: new Set(),
});

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
  const loadEvents = useCallback(
    (events: TimelineEvent[], phases: TemplateData['phases']) => {
      const clonedEvents = structuredClone(events);
      const clonedPhases = structuredClone(phases);
      setState({
        original: clonedEvents,
        originalPhases: clonedPhases,
        current: structuredClone(clonedEvents),
        currentPhases: structuredClone(clonedPhases),
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

  // 全データを置き換え（loadEvents と同じ）
  const replaceAll = useCallback(
    (events: TimelineEvent[], phases: TemplateData['phases']) => {
      const clonedEvents = structuredClone(events);
      const clonedPhases = structuredClone(phases);
      setState({
        original: clonedEvents,
        originalPhases: clonedPhases,
        current: structuredClone(clonedEvents),
        currentPhases: structuredClone(clonedPhases),
        modified: new Set(),
        autoFilled: new Set(),
        deleted: new Set(),
      });
    },
    [],
  );

  // ギミックグループのフェーズを変更
  const updatePhaseForGroup = useCallback(
    (mechanicGroupJa: string, phaseId: number, phaseName: string) => {
      setState((prev) => {
        // このギミックグループの最初のイベントの時刻を取得
        const firstEvent = prev.current.find(
          (ev) => ev.mechanicGroup?.ja === mechanicGroupJa && !prev.deleted.has(ev.id),
        );
        if (!firstEvent) return prev;

        const startTimeSec = firstEvent.time;
        const newPhases = structuredClone(prev.currentPhases);

        // 既存フェーズを探す
        const existing = newPhases.find((p) => p.id === phaseId);
        if (existing) {
          existing.startTimeSec = startTimeSec;
          if (phaseName) existing.name = phaseName;
        } else {
          // 新しいフェーズを追加
          newPhases.push({ id: phaseId, startTimeSec, name: phaseName });
          newPhases.sort((a, b) => a.startTimeSec - b.startTimeSec);
        }

        return { ...prev, currentPhases: newPhases, modified: new Set([...prev.modified, '__phases__']) };
      });
    },
    [],
  );

  // ラベル英語名を更新
  const updateLabelEn = useCallback(
    (mechanicGroupJa: string, enValue: string) => {
      setState((prev) => {
        const updated = prev.current.map((ev) => {
          if (ev.mechanicGroup?.ja === mechanicGroupJa && !prev.deleted.has(ev.id)) {
            return { ...ev, mechanicGroup: { ...ev.mechanicGroup, en: enValue } };
          }
          return ev;
        });
        // modified に該当イベントIDを追加
        const modifiedIds = new Set(prev.modified);
        updated.forEach((ev, i) => {
          if (ev !== prev.current[i]) modifiedIds.add(ev.id);
        });
        return { ...prev, current: updated, modified: modifiedIds };
      });
    },
    [],
  );

  // 保存用データを返す
  const getSaveData = useCallback(() => {
    return {
      events: state.current.filter((ev) => !state.deleted.has(ev.id)),
      phases: state.currentPhases,
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
    replaceAll,
    getSaveData,
    updatePhaseForGroup,
    updateLabelEn,
    autoPropagate,
    setAutoPropagate,
  };
}
