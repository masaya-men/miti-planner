import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { AppliedMitigation, PartyMember, TimelineEvent } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';

const applied = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
    id: 'x1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

const mockHandlers = (): CollabHandlers => ({
    add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
    upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(), importBulk: vi.fn(), batch: vi.fn(),
});

/**
 * B-2 多層防御: 閲覧者 (read-only joiner) は plan の中身を変える mutation を一切実行できない。
 *
 * ⑤-3b の readonly joiner は enterCollabMode を呼ばない (= _collabActive=false /
 * _collabReadonly=true) ため、Timeline 外 (ヘッダーのジョブ選択など) から setMemberJob 等を
 * 直接呼ぶと、委譲分岐に入らず pushHistory+set でローカルだけ書き換わってしまっていた。
 * 全 content mutation に _collabReadonly 早期 return を入れて塞ぐ。
 */
describe('useMitigationStore: 閲覧者 read-only ガード (多層防御)', () => {
    beforeEach(() => {
        useMitigationStore.setState({
            timelineMitigations: [],
            timelineEvents: [],
            phases: [],
            labels: [],
            memos: [],
            partyMembers: [
                { id: 'MT', jobId: 'war', role: 'tank', stats: {}, computedValues: {}, mode: 'tank' } as unknown as PartyMember,
            ],
            _collabActive: false,
            _collabHandlers: null,
            _collabReadonly: true, // 閲覧者
        });
    });

    it('setMemberJob は閲覧者では no-op (ローカルも変えない)', () => {
        useMitigationStore.getState().setMemberJob('MT', null);
        expect(useMitigationStore.getState().partyMembers.find(m => m.id === 'MT')?.jobId).toBe('war');
    });

    it('addMitigation は閲覧者では no-op', () => {
        useMitigationStore.getState().addMitigation(applied({ id: 'ro1' }));
        expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    });

    it('addEvent は閲覧者では no-op', () => {
        useMitigationStore.getState().addEvent({ id: 'e1', name: { ja: 'x', en: 'x' }, time: 10 } as unknown as TimelineEvent);
        expect(useMitigationStore.getState().timelineEvents).toEqual([]);
    });

    it('setCurrentLevel は閲覧者では no-op', () => {
        const before = useMitigationStore.getState().currentLevel;
        useMitigationStore.getState().setCurrentLevel(70);
        expect(useMitigationStore.getState().currentLevel).toBe(before);
    });

    it('clearAllMitigations は閲覧者では no-op', () => {
        useMitigationStore.setState({ timelineMitigations: [applied({ id: 'keep' })], _collabReadonly: true });
        useMitigationStore.getState().clearAllMitigations();
        expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['keep']);
    });

    it('addMemo は閲覧者では no-op (false を返す)', () => {
        const ok = useMitigationStore.getState().addMemo({ text: 'x', timeSec: 1, xRatio: 0.1 });
        expect(ok).toBe(false);
        expect(useMitigationStore.getState().memos).toEqual([]);
    });

    it('閲覧者解除 (_collabReadonly=false) なら通常どおり編集できる (ガードがソロ編集を壊さない)', () => {
        useMitigationStore.setState({ _collabReadonly: false });
        useMitigationStore.getState().addMitigation(applied({ id: 'solo1' }));
        expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toContain('solo1');
    });

    it('閲覧者が誤って編集を試みても collab handlers へ伝播しない', () => {
        const handlers = mockHandlers();
        // _collabActive=true + readonly の保険ケース (将来 readonly でも接続する設計に備える)
        useMitigationStore.setState({ _collabActive: true, _collabHandlers: handlers, _collabReadonly: true });
        useMitigationStore.getState().addMitigation(applied({ id: 'ro2' }));
        expect(handlers.add).not.toHaveBeenCalled();
    });
});
