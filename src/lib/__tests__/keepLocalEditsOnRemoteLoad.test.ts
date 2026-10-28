import { describe, it, expect } from 'vitest';
import { resolveRemoteLoad, markWorkingStore, workingStoreEditedSince, samePlanContent } from '../keepLocalEditsOnRemoteLoad';
import type { PlanData, SavedPlan } from '../../types';

const data = (...mitIds: string[]) => ({ timelineMitigations: mitIds.map((id) => ({ id })) }) as unknown as PlanData;
const plan = (id: string, updatedAt: number, d: PlanData = data()) => ({ id, title: id, updatedAt, data: d }) as SavedPlan;
const idle = { _loadedPlanId: null, getSnapshot: () => data() };
const resolve = (merged: SavedPlan[], input: SavedPlan[], current: SavedPlan[]) => resolveRemoteLoad({
    merged, inputPlans: input, currentPlans: current, currentPlanId: null, workingMark: markWorkingStore(idle), working: idle,
});

describe('resolveRemoteLoad(読み直しの間の手元の変更を結果に戻す)', () => {
    it('間に手元で中身を変えた表は、サーバー側の内容ではなく手元の物を使う', () => {
        const a = plan('a', 1);
        const aEdited = plan('a', 5, data('m'));
        const r = resolve([plan('a', 9)], [a], [aEdited]);
        expect(r.plans).toEqual([aEdited]);
        expect([...r.keptIds]).toEqual(['a']);
        expect(r.conflicts).toEqual([]);
    });

    it('間に何も変えていない表は、読み直しの結果(サーバー側)をそのまま使う', () => {
        const a = plan('a', 1);
        const remote = plan('a', 9, data('r'));
        const r = resolve([remote], [a], [a]);
        expect(r.plans[0]).toBe(remote);
        expect(r.keptIds.size).toBe(0);
    });

    it('表を開いた・切り替えただけ(中身が同じで updatedAt だけ進んだ)は編集とみなさない', () => {
        const a = plan('a', 1);
        const remote = plan('a', 9, data('r'));
        const r = resolve([remote], [a], [plan('a', 7)]);
        expect(r.plans[0]).toBe(remote);
        expect(r.keptIds.size).toBe(0);
    });

    it('手元もサーバーも中身が変わっていたら、サーバーを採って手元は競合コピーに回す', () => {
        const a = plan('a', 1);
        const remote = plan('a', 9, data('r'));
        const aEdited = plan('a', 5, data('m'));
        const r = resolve([remote], [a], [aEdited]);
        expect(r.plans[0]).toBe(remote);
        expect(r.conflicts).toEqual([aEdited]);
    });

    it('間に消した表は復活させず、間に作った表は残す', () => {
        const a = plan('a', 1);
        const b = plan('b', 1);
        const created = plan('c', 5);
        const r = resolve([a, b], [a, b], [a, created]);
        expect(r.plans.map((p) => p.id)).toEqual(['a', 'c']);
    });

    it('サーバーにだけある表(別端末で作った表)は今まで通り加わる', () => {
        const a = plan('a', 1);
        const r = resolve([a, plan('r', 3)], [a], [a]);
        expect(r.plans.map((p) => p.id)).toEqual(['a', 'r']);
    });

    it('圧縮された表は中身を比べられないので、編集とみなさない', () => {
        expect(samePlanContent(plan('a', 1, data('x')), { ...plan('a', 2), archived: true } as SavedPlan)).toBe(true);
    });

    // 再レビュー Minor A: 起動時の黙った圧縮は archived を立てずに data を外す
    it('黙って圧縮された表(中身が無く圧縮データだけ)も編集とみなさず、余計な競合コピーを作らない', () => {
        const a = plan('a', 1, data('x'));
        const silentlyCompressed = { ...a, data: undefined, compressedData: 'gz' } as unknown as SavedPlan;
        expect(samePlanContent(a, silentlyCompressed)).toBe(true);
        const remote = plan('a', 9, data('r'));
        const r = resolve([remote], [a], [silentlyCompressed]);
        expect(r.plans[0]).toBe(remote);
        expect(r.conflicts).toEqual([]);
    });

    // 再レビュー Minor B: 取り込み前は圧縮されていた表を開いて本当に編集し、サーバー側も新しくなっていた
    it('圧縮されていた表を開いて編集し、サーバーも新しい時は、サーバーを採って手元を競合コピーに残す', () => {
        const archivedA = { id: 'a', title: 'a', updatedAt: 1, archived: true, compressedData: 'gz' } as unknown as SavedPlan;
        const opened = plan('a', 5, data());
        const remote = plan('a', 9, data('r'));
        const r = resolveRemoteLoad({
            merged: [remote], inputPlans: [archivedA], currentPlans: [opened], currentPlanId: 'a',
            workingMark: markWorkingStore({ _loadedPlanId: 'a', getSnapshot: () => data() }),
            working: { _loadedPlanId: 'a', getSnapshot: () => data('m') },
        });
        expect(r.plans[0]).toBe(remote);
        expect(r.keepWorking).toBe(false);
        expect(r.conflicts.map((c) => c.data)).toEqual([data('m')]);
    });

    // 再レビュー Minor C: 表ごとの表示設定も保存される中身
    it('表ごとの表示設定(自分の担当・隠したメンバー・並び順)の違いも編集とみなす', () => {
        const a = plan('a', 1, data());
        for (const view of [{ myMemberId: 'MT' }, { hiddenPartyMemberIds: ['H1'] }, { timelineSortOrder: 'role' }]) {
            expect(samePlanContent(a, plan('a', 2, { ...data(), ...view } as PlanData))).toBe(false);
        }
    });
});

describe('workingStoreEditedSince(作業ストアが同じ表のまま中身ごと変わったか)', () => {
    const at = (planId: string | null, d: PlanData) => ({ _loadedPlanId: planId, getSnapshot: () => d });

    it('軽減が増えていれば編集あり', () => {
        const mark = markWorkingStore(at('p1', data()));
        expect(workingStoreEditedSince(mark, at('p1', data('m')))).toBe(true);
    });

    it('入れ物が差し替わっただけで中身が同じなら編集なし', () => {
        const mark = markWorkingStore(at('p1', data('m')));
        expect(workingStoreEditedSince(mark, at('p1', data('m')))).toBe(false);
    });

    it('別の表に切り替わった場合は編集とみなさない(切替は今まで通り)', () => {
        const mark = markWorkingStore(at('p1', data()));
        expect(workingStoreEditedSince(mark, at('p2', data('m')))).toBe(false);
    });
});
