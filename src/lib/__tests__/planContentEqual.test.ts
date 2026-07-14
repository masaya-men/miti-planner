/**
 * 共有中身の同一判定 (偽競合コピー防止の中核・2026-07-14)
 *
 * 共同編集(collab)は本体保存を DO が代行し、保存の度に Firestore へ
 * updatedAt = serverTimestamp を書く (= クライアントの Date.now を必ず追い越す)。
 * そのため「リモートの方が新しい」は collab では常態であり、中身が同じでも
 * 偽の競合コピーが量産される。
 *
 * isSharedPlanContentEqual は「DO が保存する共有中身フィールド」だけを比較し、
 * 一致していれば偽競合 (= コピー不要) と判定する。
 * - myMemberId 等 DO 非保存フィールドは比較対象外 (含めると偽コピーが消えない)
 * - id キー配列は順序非依存 (Yjs/dedupeById で順序が変わりうる)
 * - undefined ≈ 空 (未マイグレ既存プランと空配列を差分にしない)
 */
import { describe, it, expect } from 'vitest';
import { isSharedPlanContentEqual } from '../planContentEqual';
import type { PlanData } from '../../types';

/** 最小の共有中身。テストごとに override する。 */
function makeData(over: Partial<PlanData> = {}): PlanData {
    return {
        currentLevel: 90,
        timelineEvents: [{ id: 'e1', time: 10 } as any],
        timelineMitigations: [
            { id: 'm1', skillId: 's1', time: 5 } as any,
            { id: 'm2', skillId: 's2', time: 20 } as any,
        ],
        phases: [{ id: 'p1' } as any],
        labels: [{ id: 'l1' } as any],
        partyMembers: [{ id: 'pm1' } as any],
        aaSettings: { damage: 100, type: 'magical', target: 'MT' },
        schAetherflowPatterns: { s1: 1 },
        memos: [{ id: 'mo1' } as any],
        progress: { points: [{ id: 'pt1' } as any], cleared: false },
        ...over,
    };
}

describe('isSharedPlanContentEqual', () => {
    it('共有中身が完全に同じなら true', () => {
        expect(isSharedPlanContentEqual(makeData(), makeData())).toBe(true);
    });

    it('myMemberId だけ違っても true (DO 非保存フィールドは無視)', () => {
        const a = makeData({ myMemberId: 'pm1' });
        const b = makeData({ myMemberId: null });
        expect(isSharedPlanContentEqual(a, b)).toBe(true);
    });

    it('timelineMitigations の順序だけ違っても true (id キーで順序非依存)', () => {
        const a = makeData();
        const b = makeData({
            timelineMitigations: [
                { id: 'm2', skillId: 's2', time: 20 } as any,
                { id: 'm1', skillId: 's1', time: 5 } as any,
            ],
        });
        expect(isSharedPlanContentEqual(a, b)).toBe(true);
    });

    it('timelineMitigations の要素の値が違えば false (本物の中身差分)', () => {
        const a = makeData();
        const b = makeData({
            timelineMitigations: [
                { id: 'm1', skillId: 's1', time: 5 } as any,
                { id: 'm2', skillId: 's2', time: 99 } as any, // time が違う
            ],
        });
        expect(isSharedPlanContentEqual(a, b)).toBe(false);
    });

    it('片方だけ要素が多ければ false (ローカルに未配送の編集=本物の乖離)', () => {
        const a = makeData();
        const b = makeData({
            timelineMitigations: [
                { id: 'm1', skillId: 's1', time: 5 } as any,
                { id: 'm2', skillId: 's2', time: 20 } as any,
                { id: 'm3', skillId: 's3', time: 30 } as any, // 1件多い
            ],
        });
        expect(isSharedPlanContentEqual(a, b)).toBe(false);
    });

    it('labels が undefined と [] は同一とみなす (undefined ≈ 空)', () => {
        const a = makeData({ labels: undefined });
        const b = makeData({ labels: [] });
        expect(isSharedPlanContentEqual(a, b)).toBe(true);
    });

    it('progress が undefined と 空progress は同一とみなす', () => {
        const a = makeData({ progress: undefined });
        const b = makeData({ progress: { points: [], cleared: false } });
        expect(isSharedPlanContentEqual(a, b)).toBe(true);
    });

    it('progress.cleared が違えば false', () => {
        const a = makeData({ progress: { points: [], cleared: false } });
        const b = makeData({ progress: { points: [], cleared: true } });
        expect(isSharedPlanContentEqual(a, b)).toBe(false);
    });

    it('両方 undefined/null なら true (空同士)', () => {
        expect(isSharedPlanContentEqual(undefined, undefined)).toBe(true);
        expect(isSharedPlanContentEqual(null, null)).toBe(true);
    });

    it('片方だけ実データを持てば false (空 vs 非空)', () => {
        expect(isSharedPlanContentEqual(undefined, makeData())).toBe(false);
    });

    it('id 重複配列は先勝ちで比較する (dedupeById と整合・load 後は先頭が残る)', () => {
        // local に同一 id の重複。load 時 dedupeById(先勝ち) で先頭だけ残るので、
        // 先頭が remote と同じなら実質同一とみなすべき (最後勝ちだと誤って差分判定する)。
        const a = makeData({
            timelineMitigations: [
                { id: 'm1', skillId: 's1', time: 5 } as any,
                { id: 'm1', skillId: 's1', time: 99 } as any, // dup id・後勝ちだと time:99 で誤差分
                { id: 'm2', skillId: 's2', time: 20 } as any,
            ],
        });
        const b = makeData(); // m1(time:5), m2(time:20)
        expect(isSharedPlanContentEqual(a, b)).toBe(true);
    });

    it('schAetherflowPatterns の値が違えば false', () => {
        const a = makeData({ schAetherflowPatterns: { s1: 1 } });
        const b = makeData({ schAetherflowPatterns: { s1: 2 } });
        expect(isSharedPlanContentEqual(a, b)).toBe(false);
    });
});
