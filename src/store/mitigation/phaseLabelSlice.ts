import type { Phase, Label } from '../../types';
import type { MitigationState, SliceContext } from './types';

export const createPhaseLabelSlice = ({ set, get, pushHistory }: SliceContext): Pick<MitigationState,
    'addPhase' | 'updatePhase' | 'removePhase' | 'updatePhaseEndTime' | 'updatePhaseStartTime' | 'addLabel' | 'updateLabel' | 'removeLabel' | 'updateLabelEndTime' | 'updateLabelStartTime'
> => ({
    addPhase: (startTime, name) => {
        const exists = get().phases.some(p => p.startTime === startTime);
        if (exists) return;
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const state = get();
            const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
            const nextPhase = sorted.find(p => p.startTime > startTime);
            const containingPhase = sorted.find(p => p.startTime <= startTime && p.endTime >= startTime);
            let endTime: number;
            if (nextPhase) endTime = nextPhase.startTime - 1;
            else if (containingPhase) endTime = containingPhase.endTime;
            else {
                const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                endTime = Math.max(maxEventTime, startTime + 1);
            }
            const newPhase: Phase = { id: crypto.randomUUID(), name, startTime, endTime };
            const clipped = state.phases
                .filter(p => p.endTime >= startTime && p.startTime < startTime)
                .map(p => ({ id: p.id, endTime: startTime - 1 }));
            get()._collabHandlers!.upsertItems('phases', [newPhase, ...clipped]);
            return;
        }
        pushHistory();
        set((state) => {
            const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
            const nextPhase = sorted.find(p => p.startTime > startTime);
            // 新規約: endTime === startTime でも含有とみなす（描画は endTime+1 まで）
            const containingPhase = sorted.find(p => p.startTime <= startTime && p.endTime >= startTime);
            let endTime: number;
            if (nextPhase) {
                endTime = nextPhase.startTime - 1;
            } else if (containingPhase) {
                endTime = containingPhase.endTime;
            } else {
                const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                endTime = Math.max(maxEventTime, startTime + 1);
            }
            const newPhase: Phase = {
                id: crypto.randomUUID(),
                name,
                startTime,
                endTime,
            };
            const clippedPhases = state.phases.map(p => {
                // 含有フェーズを新 startTime の 1 秒前で終わらせる（gap は意図的に残せる仕様）
                if (p.endTime >= startTime && p.startTime < startTime) {
                    return { ...p, endTime: startTime - 1 };
                }
                return p;
            });
            return { phases: [...clippedPhases, newPhase].sort((a, b) => a.startTime - b.startTime) };
        });
    },

    updatePhase: (id, name) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('phases', [{ id, name }]);
            return;
        }
        pushHistory();
        set((state) => ({
            phases: state.phases.map(p => p.id === id ? { ...p, name } : p)
        }));
    },

    removePhase: (id) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('phases', [id]);
            return;
        }
        pushHistory();
        set((state) => ({
            phases: state.phases.filter(p => p.id !== id)
        }));
    },

    updatePhaseEndTime: (id, newEndTime) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const sorted = [...get().phases].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(p => p.id === id);
            if (idx < 0) return;
            const self = sorted[idx];
            const nextPhase = sorted[idx + 1];
            let final = Math.max(newEndTime, self.startTime + 1);
            if (nextPhase && final >= nextPhase.startTime) {
                final = Math.min(final, nextPhase.endTime - 2);
                get()._collabHandlers!.upsertItems('phases', [
                    { id, endTime: final }, { id: nextPhase.id, startTime: final + 1 },
                ]);
            } else {
                get()._collabHandlers!.upsertItems('phases', [{ id, endTime: final }]);
            }
            return;
        }
        pushHistory();
        set((state) => {
            const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(p => p.id === id);
            if (idx < 0) return {};
            const self = sorted[idx];
            const nextPhase = sorted[idx + 1];
            let final = Math.max(newEndTime, self.startTime + 1);
            if (nextPhase && final >= nextPhase.startTime) {
                // 新規約: next.startTime = final + 1。next の最低幅 1 秒確保のため final ≤ next.endTime - 2
                final = Math.min(final, nextPhase.endTime - 2);
                return {
                    phases: state.phases.map(p => {
                        if (p.id === id) return { ...p, endTime: final };
                        if (p.id === nextPhase.id) return { ...p, startTime: final + 1 };
                        return p;
                    })
                };
            }
            return {
                phases: state.phases.map(p => p.id === id ? { ...p, endTime: final } : p)
            };
        });
    },

    updatePhaseStartTime: (id, newStartTime) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const sorted = [...get().phases].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(p => p.id === id);
            if (idx < 0) return;
            const self = sorted[idx];
            const prevPhase = idx > 0 ? sorted[idx - 1] : null;
            let final = Math.max(newStartTime, 0);
            final = Math.min(final, self.endTime - 1);
            if (prevPhase && final <= prevPhase.endTime) {
                final = Math.max(final, prevPhase.startTime + 2);
                get()._collabHandlers!.upsertItems('phases', [
                    { id, startTime: final }, { id: prevPhase.id, endTime: final - 1 },
                ]);
            } else {
                get()._collabHandlers!.upsertItems('phases', [{ id, startTime: final }]);
            }
            return;
        }
        pushHistory();
        set((state) => {
            const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(p => p.id === id);
            if (idx < 0) return {};
            const self = sorted[idx];
            const prevPhase = idx > 0 ? sorted[idx - 1] : null;
            let final = Math.max(newStartTime, 0);
            final = Math.min(final, self.endTime - 1);
            if (prevPhase && final <= prevPhase.endTime) {
                // 新規約: prev.endTime = final - 1。prev の最低幅 1 秒確保のため final ≥ prev.startTime + 2
                final = Math.max(final, prevPhase.startTime + 2);
                return {
                    phases: state.phases.map(p => {
                        if (p.id === id) return { ...p, startTime: final };
                        if (p.id === prevPhase.id) return { ...p, endTime: final - 1 };
                        return p;
                    })
                };
            }
            return {
                phases: state.phases.map(p => p.id === id ? { ...p, startTime: final } : p)
            };
        });
    },

    addLabel: (startTime, name) => {
        const exists = get().labels.some(l => l.startTime === startTime);
        if (exists) return;
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const state = get();
            const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
            const nextLabel = sorted.find(l => l.startTime > startTime);
            const containingLabel = sorted.find(l => l.startTime <= startTime && l.endTime >= startTime);
            let endTime: number;
            if (nextLabel) endTime = nextLabel.startTime - 1;
            else if (containingLabel) endTime = containingLabel.endTime;
            else {
                const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                endTime = Math.max(maxEventTime, startTime + 1);
            }
            const newLabel: Label = { id: crypto.randomUUID(), name, startTime, endTime };
            const clipped = state.labels
                .filter(l => l.endTime >= startTime && l.startTime < startTime)
                .map(l => ({ id: l.id, endTime: startTime - 1 }));
            get()._collabHandlers!.upsertItems('labels', [newLabel, ...clipped]);
            return;
        }
        pushHistory();
        set((state) => {
            const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
            const nextLabel = sorted.find(l => l.startTime > startTime);
            const containingLabel = sorted.find(l => l.startTime <= startTime && l.endTime >= startTime);
            let endTime: number;
            if (nextLabel) {
                endTime = nextLabel.startTime - 1;
            } else if (containingLabel) {
                endTime = containingLabel.endTime;
            } else {
                const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                endTime = Math.max(maxEventTime, startTime + 1);
            }
            const newLabel: Label = {
                id: crypto.randomUUID(),
                name,
                startTime,
                endTime,
            };
            const clippedLabels = state.labels.map(l => {
                if (l.endTime >= startTime && l.startTime < startTime) {
                    return { ...l, endTime: startTime - 1 };
                }
                return l;
            });
            return { labels: [...clippedLabels, newLabel].sort((a, b) => a.startTime - b.startTime) };
        });
    },

    updateLabel: (id, name) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('labels', [{ id, name }]);
            return;
        }
        pushHistory();
        set((state) => ({
            labels: state.labels.map(l => l.id === id ? { ...l, name } : l)
        }));
    },

    removeLabel: (id) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('labels', [id]);
            return;
        }
        pushHistory();
        set((state) => ({
            labels: state.labels.filter(l => l.id !== id)
        }));
    },

    updateLabelEndTime: (id, newEndTime) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const sorted = [...get().labels].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(l => l.id === id);
            if (idx < 0) return;
            const self = sorted[idx];
            const next = sorted[idx + 1];
            let final = Math.max(newEndTime, self.startTime + 1);
            if (next && final >= next.startTime) {
                final = Math.min(final, next.endTime - 2);
                get()._collabHandlers!.upsertItems('labels', [
                    { id, endTime: final }, { id: next.id, startTime: final + 1 },
                ]);
            } else {
                get()._collabHandlers!.upsertItems('labels', [{ id, endTime: final }]);
            }
            return;
        }
        pushHistory();
        set((state) => {
            const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(l => l.id === id);
            if (idx < 0) return {};
            const self = sorted[idx];
            const nextLabel = sorted[idx + 1];
            let final = Math.max(newEndTime, self.startTime + 1);
            if (nextLabel && final >= nextLabel.startTime) {
                final = Math.min(final, nextLabel.endTime - 2);
                return {
                    labels: state.labels.map(l => {
                        if (l.id === id) return { ...l, endTime: final };
                        if (l.id === nextLabel.id) return { ...l, startTime: final + 1 };
                        return l;
                    })
                };
            }
            return {
                labels: state.labels.map(l => l.id === id ? { ...l, endTime: final } : l)
            };
        });
    },

    updateLabelStartTime: (id, newStartTime) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            const sorted = [...get().labels].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(l => l.id === id);
            if (idx < 0) return;
            const self = sorted[idx];
            const prev = idx > 0 ? sorted[idx - 1] : null;
            let final = Math.max(newStartTime, 0);
            final = Math.min(final, self.endTime - 1);
            if (prev && final <= prev.endTime) {
                final = Math.max(final, prev.startTime + 2);
                get()._collabHandlers!.upsertItems('labels', [
                    { id, startTime: final }, { id: prev.id, endTime: final - 1 },
                ]);
            } else {
                get()._collabHandlers!.upsertItems('labels', [{ id, startTime: final }]);
            }
            return;
        }
        pushHistory();
        set((state) => {
            const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
            const idx = sorted.findIndex(l => l.id === id);
            if (idx < 0) return {};
            const self = sorted[idx];
            const prevLabel = idx > 0 ? sorted[idx - 1] : null;
            let final = Math.max(newStartTime, 0);
            final = Math.min(final, self.endTime - 1);
            if (prevLabel && final <= prevLabel.endTime) {
                final = Math.max(final, prevLabel.startTime + 2);
                return {
                    labels: state.labels.map(l => {
                        if (l.id === id) return { ...l, startTime: final };
                        if (l.id === prevLabel.id) return { ...l, endTime: final - 1 };
                        return l;
                    })
                };
            }
            return {
                labels: state.labels.map(l => l.id === id ? { ...l, startTime: final } : l)
            };
        });
    },
});
