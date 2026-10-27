import type { PlanMemo } from '../../types';
import { appendProgressPoint, removeProgressPointById, setProgressPointNoteById, insertProgressPoint, makeProgressPointId } from '../../lib/progressLogic';
import { MEMO_LIMITS } from '../../types/firebase';
import type { MitigationState, SliceContext } from './types';

export const createMemoProgressSlice = ({ set, get }: SliceContext): Pick<MitigationState,
    'setToolMode' | 'addMemo' | 'updateMemo' | 'deleteMemo' | 'deleteAllMemos' | 'recordReachedPoint' | 'removeProgressPoint' | 'setCleared' | 'setActiveDays' | 'setActiveHours' | 'setProgressPointNote' | 'clearAllProgressPoints' | 'insertProgressPointAt'
> => ({
    // メモ機能 アクション (#57)
    setToolMode: (mode) => set({ toolMode: mode }),

    addMemo: (input) => {
        if (get()._collabReadonly && !get()._collabActive) return false; // 純粋な閲覧者のみブロック
        const current = get().memos;
        if (current.length >= MEMO_LIMITS.MAX_MEMOS_PER_PLAN) return false;
        const now = Date.now();
        const memo: PlanMemo = {
            id: `memo_${crypto.randomUUID()}`,
            text: input.text,
            timeSec: input.timeSec,
            xRatio: input.xRatio,
            createdAt: now,
            updatedAt: now,
        };
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('memos', [memo]);
            return true;
        }
        set({ memos: [...current, memo] });
        return true;
    },

    updateMemo: (id, patch) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('memos', [{ id, ...patch }]);
            return;
        }
        set((state) => ({
            memos: state.memos.map(m =>
                m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m
            ),
        }));
    },

    deleteMemo: (id) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('memos', [id]);
            return;
        }
        set((state) => ({
            memos: state.memos.filter(m => m.id !== id),
        }));
    },

    deleteAllMemos: () => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('memos', get().memos.map(m => m.id));
            return;
        }
        set({ memos: [] });
    },

    // 進捗トラッキング アクション (#HUD)
    // Plan 2: collab active 時は handlers へ委譲。非 collab 時はローカル set() のみ(Plan 1 と同じ)。
    recordReachedPoint: (reachedPos) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        const point = { id: makeProgressPointId(), ts: Date.now(), reachedPos };
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.upsertItems('progressPoints', [point]);
            return;
        }
        set((state) => ({
            progress: { ...state.progress, points: appendProgressPoint(state.progress.points, point) },
        }));
    },
    removeProgressPoint: (id) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('progressPoints', [id]);
            return;
        }
        set((state) => ({
            progress: { ...state.progress, points: removeProgressPointById(state.progress.points, id) },
        }));
    },
    setCleared: (cleared) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.setMeta('progressCleared', cleared);
            return;
        }
        set((state) => ({ progress: { ...state.progress, cleared } }));
    },
    setActiveDays: (n) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        // undefined(クリア)は Yjs Map に保存できないためローカルのみ。数値の場合のみ委譲。
        if (n !== undefined && get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.setMeta('progressActiveDays', n);
            return;
        }
        set((state) => ({ progress: { ...state.progress, activeDays: n } }));
    },
    setActiveHours: (n) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        // undefined(クリア)は Yjs Map に保存できないためローカルのみ。数値の場合のみ委譲。
        if (n !== undefined && get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.setMeta('progressActiveHours', n);
            return;
        }
        set((state) => ({ progress: { ...state.progress, activeHours: n } }));
    },
    setProgressPointNote: (id, note) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        if (get()._collabActive && get()._collabHandlers) {
            // メモは点の部分更新 = upsert で note フィールドだけ送る(applyUpsert が部分更新)。
            // 空 note を送っても既存 note を消せない(空文字 set になる)が、
            // 表示側で空 note 非表示のため許容(進捗は飾り)。
            get()._collabHandlers!.upsertItems('progressPoints', [{ id, note: note.trim() }]);
            return;
        }
        set((state) => ({
            progress: { ...state.progress, points: setProgressPointNoteById(state.progress.points, id, note) },
        }));
    },
    clearAllProgressPoints: () => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.removeItems('progressPoints', get().progress.points.map((p) => p.id));
            return;
        }
        set((state) => ({ progress: { ...state.progress, points: [] } }));
    },
    insertProgressPointAt: (index, point) => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者ブロック
        if (get()._collabActive && get()._collabHandlers) {
            get()._collabHandlers!.insertItemAt('progressPoints', index, point);
            return;
        }
        set((state) => ({ progress: { ...state.progress, points: insertProgressPoint(state.progress.points, index, point) } }));
    },
});
