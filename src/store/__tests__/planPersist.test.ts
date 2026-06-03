/**
 * プラン永続化ヘルパ テスト (2026-06-03)
 *
 * _dirtyPlanIds / _deletedPlanIds (Set) を localStorage に永続化するための
 * partialize (Set→配列) / merge (配列→Set) の純粋ヘルパ。
 *
 * 目的: 同期インテント (未保存=dirty / 削除済み=deleted) をリロード跨ぎで保持し、
 * 「削除→リロードで一瞬復活」「未保存編集の消失」の窓を塞ぐ。
 */
import { describe, it, expect } from 'vitest';
import { partializePlanState, mergePersistedPlanState } from '../planPersist';
import type { SavedPlan } from '../../types';

function makePlan(id: string): SavedPlan {
    return {
        id, ownerId: 'local', ownerDisplayName: '', title: id, contentId: 'm1s',
        isPublic: false, copyCount: 0, useCount: 0,
        data: {} as any, createdAt: 1, updatedAt: 1,
    };
}

describe('partializePlanState', () => {
    it('永続化対象 (plans/currentPlanId/lastActivePlanId) を含める', () => {
        const persisted = partializePlanState({
            plans: [makePlan('a')],
            currentPlanId: 'a',
            lastActivePlanId: 'a',
            _dirtyPlanIds: new Set(),
            _deletedPlanIds: new Set(),
        });
        expect(persisted.plans.map(p => p.id)).toEqual(['a']);
        expect(persisted.currentPlanId).toBe('a');
        expect(persisted.lastActivePlanId).toBe('a');
    });

    it('Set を配列に変換して永続化する (Set は JSON 化できないため)', () => {
        const persisted = partializePlanState({
            plans: [],
            currentPlanId: null,
            lastActivePlanId: null,
            _dirtyPlanIds: new Set(['d1', 'd2']),
            _deletedPlanIds: new Set(['x1']),
        });
        expect(Array.isArray(persisted._dirtyPlanIds)).toBe(true);
        expect(persisted._dirtyPlanIds.sort()).toEqual(['d1', 'd2']);
        expect(persisted._deletedPlanIds).toEqual(['x1']);
    });
});

describe('mergePersistedPlanState', () => {
    it('配列を Set に戻す', () => {
        const current = { _dirtyPlanIds: new Set(), _deletedPlanIds: new Set(), foo: 'bar' };
        const merged = mergePersistedPlanState(
            { plans: [], _dirtyPlanIds: ['d1'], _deletedPlanIds: ['x1', 'x2'] },
            current,
        );
        expect(merged._dirtyPlanIds instanceof Set).toBe(true);
        expect([...merged._dirtyPlanIds]).toEqual(['d1']);
        expect([...merged._deletedPlanIds].sort()).toEqual(['x1', 'x2']);
    });

    it('永続データにフィールドが無くても空 Set にフォールバックする (旧データ互換)', () => {
        const current = { _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() };
        const merged = mergePersistedPlanState({ plans: [] }, current);
        expect(merged._dirtyPlanIds instanceof Set).toBe(true);
        expect([...merged._dirtyPlanIds]).toEqual([]);
        expect([...merged._deletedPlanIds]).toEqual([]);
    });

    it('current の関数/初期値を保持しつつ永続データで上書きする', () => {
        const fn = () => 'kept';
        const current = {
            someFn: fn, plans: [] as SavedPlan[], currentPlanId: null as string | null,
            _dirtyPlanIds: new Set<string>(), _deletedPlanIds: new Set<string>(),
        };
        const merged = mergePersistedPlanState(
            { plans: [makePlan('a')], currentPlanId: 'a', _dirtyPlanIds: [], _deletedPlanIds: [] },
            current,
        );
        expect(merged.someFn).toBe(fn);
        expect(merged.plans.map((p: SavedPlan) => p.id)).toEqual(['a']);
        expect(merged.currentPlanId).toBe('a');
    });

    it('round-trip: partialize → merge で Set のメンバーが復元される', () => {
        const persisted = partializePlanState({
            plans: [], currentPlanId: null, lastActivePlanId: null,
            _dirtyPlanIds: new Set(['d1', 'd2']),
            _deletedPlanIds: new Set(['x1']),
        });
        const merged = mergePersistedPlanState(persisted, {
            _dirtyPlanIds: new Set(), _deletedPlanIds: new Set(),
        });
        expect([...merged._dirtyPlanIds].sort()).toEqual(['d1', 'd2']);
        expect([...merged._deletedPlanIds]).toEqual(['x1']);
    });
});
