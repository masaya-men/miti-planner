import { describe, it, expect } from 'vitest';
import { keepPlansEditedDuring, markWorkingStore, workingStoreEditedSince } from '../keepLocalEditsOnRemoteLoad';
import type { SavedPlan } from '../../types';

const plan = (id: string, updatedAt: number) => ({ id, updatedAt }) as SavedPlan;

describe('keepPlansEditedDuring(読み直しの間の手元の変更を結果に戻す)', () => {
    it('間に手元で保存した表は、サーバー側の内容ではなく手元の物を使う', () => {
        const a = plan('a', 1);
        const aEdited = plan('a', 5);
        const { plans, editedIds } = keepPlansEditedDuring([plan('a', 9)], [a], [aEdited]);
        expect(plans).toEqual([aEdited]);
        expect([...editedIds]).toEqual(['a']);
    });

    it('間に何も変えていない表は、読み直しの結果(サーバー側)をそのまま使う', () => {
        const a = plan('a', 1);
        const remote = plan('a', 9);
        const { plans, editedIds } = keepPlansEditedDuring([remote], [a], [a]);
        expect(plans[0]).toBe(remote);
        expect(editedIds.size).toBe(0);
    });

    it('間に消した表は復活させず、間に作った表は残す', () => {
        const a = plan('a', 1);
        const b = plan('b', 1);
        const created = plan('c', 5);
        const { plans } = keepPlansEditedDuring([a, b], [a, b], [a, created]);
        expect(plans.map((p) => p.id)).toEqual(['a', 'c']);
    });

    it('サーバーにだけある表(別端末で作った表)は今まで通り加わる', () => {
        const a = plan('a', 1);
        const { plans } = keepPlansEditedDuring([a, plan('r', 3)], [a], [a]);
        expect(plans.map((p) => p.id)).toEqual(['a', 'r']);
    });
});

describe('workingStoreEditedSince(作業ストアが同じ表のまま編集されたか)', () => {
    const base = { _loadedPlanId: 'p1', timelineMitigations: [], timelineEvents: [], phases: [], partyMembers: [] };

    it('軽減の一覧が差し替わっていれば編集あり', () => {
        const mark = markWorkingStore(base);
        expect(workingStoreEditedSince(mark, { ...base, timelineMitigations: [] })).toBe(true);
    });

    it('何も変わっていなければ編集なし', () => {
        expect(workingStoreEditedSince(markWorkingStore(base), base)).toBe(false);
    });

    it('別の表に切り替わった場合は編集とみなさない(切替は今まで通り)', () => {
        const mark = markWorkingStore(base);
        expect(workingStoreEditedSince(mark, { ...base, _loadedPlanId: 'p2', timelineMitigations: [] })).toBe(false);
    });
});
