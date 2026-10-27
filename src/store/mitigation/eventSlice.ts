import { ensurePhaseEndTimes } from '../../utils/phaseMigration';
import { completeTutorialEvent } from '../tutorialBridge';
import { resolveImportEvents } from '../../utils/importModes';
import type { MitigationState, SliceContext } from './types';

export const createEventSlice = ({ set, get, pushHistory }: SliceContext): Pick<MitigationState,
    'addEvent' | 'importTimelineEvents' | 'updateEvent' | 'removeEvent'
> => ({
    addEvent: (event) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('timelineEvents', [event]);
            completeTutorialEvent('event:saved');
            return;
        }
        pushHistory();
        set((state) => ({
            timelineEvents: [...state.timelineEvents, event].sort((a, b) => a.time - b.time)
        }));
        completeTutorialEvent('event:saved');
    },

    importTimelineEvents: (events, importPhases, importLabels, mode) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック
        const current = get().timelineEvents;
        const resolved = resolveImportEvents(current, events, mode);
        const maxEventTime = resolved.events.length > 0
            ? resolved.events.reduce((max, e) => Math.max(max, e.time), 0)
            : undefined;

        // 取り込むフェーズを Phase 形へ変換（append は既存最終時刻より後だけ）
        const cutoff = resolved.appendFromTime;
        const incomingPhases = importPhases
            ? importPhases
                .filter(p => p.startTimeSec >= 0)
                .filter(p => cutoff === null || p.startTimeSec > cutoff)
                .map(p => ({ id: `phase_${p.id}`, name: p.name, startTime: p.startTimeSec }))
            : undefined;
        // append は既存フェーズに連結、replace は取り込み分のみ
        // append かつカットオフ以降に新規フェーズがない場合は既存フェーズを触らない
        const mergedPhases = !importPhases
            ? undefined
            : (mode === 'append' && (incomingPhases?.length ?? 0) === 0)
                ? undefined // append: カットオフ以降に新規フェーズなし → 既存フェーズを触らない
                : ensurePhaseEndTimes(
                    mode === 'append'
                        ? [...get().phases, ...(incomingPhases ?? [])]
                        : (incomingPhases ?? []),
                    maxEventTime,
                  );
        // labels: append は触らない、replace は取り込み分
        const finalLabels = mode === 'append' ? undefined : importLabels;

        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.importBulk(resolved.events, mergedPhases, finalLabels, resolved.clearMitigations);
            if (events.length > 0) completeTutorialEvent('content:selected');
            return;
        }
        pushHistory();
        const update: Partial<ReturnType<typeof get>> = {
            timelineEvents: resolved.events,
        };
        if (resolved.clearMitigations) {
            update.timelineMitigations = [];
        }
        if (mergedPhases) {
            update.phases = mergedPhases;
        }
        if (finalLabels) {
            update.labels = finalLabels;
        }
        set(update as any);
        if (events.length > 0) {
            completeTutorialEvent('content:selected');
        }
    },

    updateEvent: (id, updatedEvent) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('timelineEvents', [{ id, ...updatedEvent }]);
            return;
        }
        pushHistory();
        set((state) => ({
            timelineEvents: state.timelineEvents.map(e => e.id === id ? { ...e, ...updatedEvent } : e).sort((a, b) => a.time - b.time)
        }));
    },

    removeEvent: (id) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('timelineEvents', [id]);
            return;
        }
        pushHistory();
        set((state) => ({
            timelineEvents: state.timelineEvents.filter(e => e.id !== id)
        }));
    },
});
