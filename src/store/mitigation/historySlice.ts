import { reuseEqualArray } from '../../utils/stableArray';
import type { PartyMember, Label } from '../../types';
import { normalizeProgress } from '../../lib/progressLogic';
import { migratePhases, repairLastPhaseEndTime, repairAdjacentPhaseBoundaries } from '../../utils/phaseMigration';
import { migrateLabels, isLegacyLabelFormat, ensureLabelEndTimes, repairLastLabelEndTime, repairAdjacentLabelBoundaries } from '../../utils/labelMigration';
import { calculateMemberValues } from '../../utils/calculator';
import { buildScholarAutoInserts, hasAnyAetherflow } from '../../utils/scholarAutoInsert';
import { buildAstrologianAutoInserts, hasAnyAstrologianDraw } from '../../utils/astrologianAutoInsert';
import type { HistorySnapshot, MitigationState, SliceContext } from './types';

export const createHistorySlice = ({ set, get }: SliceContext): Pick<MitigationState,
    'getSnapshot' | 'loadSnapshot' | 'undo' | 'redo'
> => ({
    getSnapshot: () => {
        const state = get();
        return {
            currentLevel: state.currentLevel,
            timelineEvents: state.timelineEvents,
            timelineMitigations: state.timelineMitigations,
            phases: state.phases,
            labels: state.labels,
            partyMembers: state.partyMembers,
            aaSettings: state.aaSettings,
            schAetherflowPatterns: state.schAetherflowPatterns,
            myMemberId: state.myMemberId,
            memos: state.memos,
            progress: state.progress,
            hiddenPartyMemberIds: state.hiddenPartyMemberIds,
            timelineSortOrder: state.timelineSortOrder,
        };
    },

    loadSnapshot: (snapshot, planId) => {
        // 共同編集中は部屋の状態(seed)が唯一の正。別プランの読込で無言 desync させない。
        if (get()._collabActive) return;
        const membersWithComputed = snapshot.partyMembers.map((m: PartyMember) => ({
            ...m,
            computedValues: calculateMemberValues(m, snapshot.currentLevel)
        }));

        // timelineEvents の最大時刻を計算（最終フェーズ/ラベルの endTime フォールバックに使用）
        const maxEventTime = snapshot.timelineEvents.length > 0
            ? snapshot.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
            : undefined;

        const migratedPhases = migratePhases(snapshot.phases ?? [], maxEventTime);
        const labels: Label[] = isLegacyLabelFormat(snapshot as any)
            ? migrateLabels(snapshot.timelineEvents, migratedPhases)
            : ensureLabelEndTimes((snapshot as any).labels ?? [], maxEventTime);

        // 過去バグ（最終フェーズ/ラベルの endTime が startTime+1 で保存されている）を修復
        const lastRepairedPhases = maxEventTime !== undefined
            ? repairLastPhaseEndTime(migratedPhases, snapshot.timelineEvents, maxEventTime)
            : migratedPhases;
        const lastRepairedLabels = maxEventTime !== undefined
            ? repairLastLabelEndTime(labels, snapshot.timelineEvents, maxEventTime)
            : labels;

        // 旧隣接規約 (endTime === next.startTime) を新規約 (endTime + 1 === next.startTime) に修復
        const finalPhases = repairAdjacentPhaseBoundaries(lastRepairedPhases);
        const finalLabels = repairAdjacentLabelBoundaries(lastRepairedLabels);

        // 学者の aetherflow 自動挿入マイグレーション
        // 旧プラン (pattern 時代) は dissipation のみ配置されていて aetherflow が無い。
        // aetherflow が 1 つでもあるプラン（新形式・編集後保存）はユーザー編集尊重で触らない。
        let migratedMitigations = [...snapshot.timelineMitigations];
        for (const member of membersWithComputed) {
            if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, migratedMitigations)) {
                const inserts = buildScholarAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
                migratedMitigations.push(...inserts);
            }
            if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, migratedMitigations)) {
                const inserts = buildAstrologianAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
                migratedMitigations.push(...inserts);
            }
        }

        set({
            currentLevel: snapshot.currentLevel,
            timelineEvents: snapshot.timelineEvents,
            timelineMitigations: migratedMitigations,
            phases: finalPhases,
            labels: finalLabels,
            partyMembers: membersWithComputed,
            aaSettings: snapshot.aaSettings,
            schAetherflowPatterns: snapshot.schAetherflowPatterns,
            myMemberId: snapshot.myMemberId ?? null,
            // メモ: 未マイグレ既存プランは undefined → [] にフォールバック
            memos: snapshot.memos ?? [],
            // 進捗: 未マイグレ既存プランは undefined → デフォルト値にフォールバック
            progress: normalizeProgress(snapshot.progress),
            // 表示メンバー絞り込み/並び替えは以前ブラウザ全体の見た目設定として持ち回っており、
            // 別プランを開くたびに前のプランの設定が意図せず引き継がれる不具合だった。
            // プランごとに独立して記憶する仕様に変更(2026-08-26)。未マイグレ既存プランは
            // フィールド自体が無い(undefined)ため初期値にフォールバック。
            hiddenPartyMemberIds: snapshot.hiddenPartyMemberIds ?? [],
            timelineSortOrder: snapshot.timelineSortOrder ?? 'light_party',
            // Reset Undo/Redo on load
            _history: [],
            _future: [],
            // 根治: このスナップショットの持ち主を記録(保存先=loadedPlanId の決定に使う)。
            ...(planId !== undefined ? { _loadedPlanId: planId } : {}),
        });

        // チュートリアル: content:selected はSidebar.tsx側でトランジション完了後に発火する
        // （loadSnapshot内で即座に発火すると、ローディング中にSTEP2に進んでしまう）
    },

    // Undo: collab 中は CRDT undo へ委譲(set 外・反映は observeDeep の単一 set)。solo は従来のローカル履歴。
    undo: () => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみ no-op(編集者ジョイナーは active=true で委譲へ)
        if (get()._collabActive) { get()._collabHandlers?.undo(); return; } // ②-c: CRDT undo へ委譲。set() を挟まない=入れ子 set による store↔Y.Doc desync を回避
        set((state) => {
            if (state._history.length === 0) return state;
            const previous = state._history[state._history.length - 1];
            const newHistory = state._history.slice(0, -1);
            const currentSnapshot: HistorySnapshot = {
                timelineMitigations: state.timelineMitigations,
                timelineEvents: state.timelineEvents,
                phases: state.phases,
                labels: state.labels,
                partyMembers: state.partyMembers
            };
            return {
                _history: newHistory,
                _future: [currentSnapshot, ...state._future],
                timelineMitigations: previous.timelineMitigations,
                // 履歴の配列は pushHistory が複製したもの。中身が現在と同じなら現在の参照を保つ
                // (参照が変わると、無関係な全行・全列が「変わった」とみなされて描き直される)
                timelineEvents: reuseEqualArray(state.timelineEvents, previous.timelineEvents) as typeof previous.timelineEvents,
                phases: reuseEqualArray(state.phases, previous.phases) as typeof previous.phases,
                labels: reuseEqualArray(state.labels, previous.labels) as typeof previous.labels,
                partyMembers: reuseEqualArray(state.partyMembers, previous.partyMembers) as typeof previous.partyMembers,
            };
        });
    },

    // Redo: collab 中は CRDT redo へ委譲(set 外)。solo は従来のローカル履歴。
    redo: () => {
        if (get()._collabReadonly && !get()._collabActive) return; // 純粋閲覧者のみ no-op
        if (get()._collabActive) { get()._collabHandlers?.redo(); return; } // ②-c: CRDT redo へ委譲(入れ子 set 回避)
        set((state) => {
            if (state._future.length === 0) return state;
            const next = state._future[0];
            const newFuture = state._future.slice(1);
            const currentSnapshot: HistorySnapshot = {
                timelineMitigations: state.timelineMitigations,
                timelineEvents: state.timelineEvents,
                phases: state.phases,
                labels: state.labels,
                partyMembers: state.partyMembers
            };
            return {
                _history: [...state._history, currentSnapshot],
                _future: newFuture,
                timelineMitigations: next.timelineMitigations,
                timelineEvents: reuseEqualArray(state.timelineEvents, next.timelineEvents) as typeof next.timelineEvents,
                phases: reuseEqualArray(state.phases, next.phases) as typeof next.phases,
                labels: reuseEqualArray(state.labels, next.labels) as typeof next.labels,
                partyMembers: reuseEqualArray(state.partyMembers, next.partyMembers) as typeof next.partyMembers,
            };
        });
    },
});
