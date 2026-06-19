import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { AppliedMitigation } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';

const applied = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: 'x1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

const mockHandlers = (): CollabHandlers => ({
  add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
  upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(), importBulk: vi.fn(), batch: vi.fn(),
  undo: vi.fn(), redo: vi.fn(),
});

describe('useMitigationStore 共同編集分岐 (段取り②-a)', () => {
  beforeEach(() => {
    useMitigationStore.setState({ timelineMitigations: [], _collabActive: false, _collabHandlers: null });
  });

  it('共同編集中の add/remove/updateTime は handlers に委譲し、timelineMitigations を直接変えない', () => {
    const handlers = mockHandlers();
    useMitigationStore.getState().enterCollabMode(handlers);

    const m = applied({ id: 'c1' });
    useMitigationStore.getState().addMitigation(m);
    expect(handlers.add).toHaveBeenCalledWith(m);
    // 直接 set せず、反映は observeDeep→_applyMitigationsFromCollab 経由のみ
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);

    useMitigationStore.getState().removeMitigation('c1');
    expect(handlers.remove).toHaveBeenCalledWith('c1');

    useMitigationStore.getState().updateMitigationTime('c1', 50);
    expect(handlers.updateTime).toHaveBeenCalledWith('c1', 50);
  });

  it('_applyMitigationsFromCollab は timelineMitigations に反映する', () => {
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    useMitigationStore.getState()._applyMitigationsFromCollab([applied({ id: 'r1' }), applied({ id: 'r2', ownerId: 'H1' })]);
    expect(useMitigationStore.getState().timelineMitigations.map((m) => m.id).sort()).toEqual(['r1', 'r2']);
  });

  it('exitCollabMode 後は従来通り set() で反映し handlers を呼ばない', () => {
    const handlers = mockHandlers();
    useMitigationStore.getState().enterCollabMode(handlers);
    useMitigationStore.getState().exitCollabMode();
    expect(useMitigationStore.getState()._collabActive).toBe(false);

    useMitigationStore.getState().addMitigation(applied({ id: 'solo1' }));
    expect(handlers.add).not.toHaveBeenCalled();
    expect(useMitigationStore.getState().timelineMitigations.map((m) => m.id)).toContain('solo1');
  });
});

describe('②-b-1 apply(Y→store 反映)', () => {
  beforeEach(() => {
    useMitigationStore.setState({ timelineEvents: [], phases: [], labels: [], memos: [], _collabActive: false, _collabHandlers: null });
  });
  it('_applyEventsFromCollab は time 昇順で反映', () => {
    useMitigationStore.getState()._applyEventsFromCollab([
      { id: 'b', time: 50, name: { ja: 'b' }, damageType: 'magical' },
      { id: 'a', time: 10, name: { ja: 'a' }, damageType: 'magical' },
    ] as any);
    expect(useMitigationStore.getState().timelineEvents.map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('_applyPhasesFromCollab は startTime 昇順で反映', () => {
    useMitigationStore.getState()._applyPhasesFromCollab([
      { id: 'p2', name: { ja: 'p2' }, startTime: 60, endTime: 100 },
      { id: 'p1', name: { ja: 'p1' }, startTime: 0, endTime: 59 },
    ] as any);
    expect(useMitigationStore.getState().phases.map((p) => p.id)).toEqual(['p1', 'p2']);
  });
  it('_applyMetaFromCollab は currentLevel/aaSettings/schAetherflowPatterns を反映', () => {
    useMitigationStore.getState()._applyMetaFromCollab({ currentLevel: 80, aaSettings: { damage: 5, type: 'physical', target: 'ST' }, schAetherflowPatterns: { H2: 2 } });
    expect(useMitigationStore.getState().currentLevel).toBe(80);
    expect(useMitigationStore.getState().aaSettings).toEqual({ damage: 5, type: 'physical', target: 'ST' });
    expect(useMitigationStore.getState().schAetherflowPatterns).toEqual({ H2: 2 });
  });
});

describe('②-b-2 partyMembers apply（Y→store 反映）', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({ partyMembers: [], currentLevel: 100, _collabActive: false, _collabHandlers: null }));

  it('_applyPartyMembersFromCollab は partyMembers を反映し computedValues をローカル再計算する', () => {
    useMitigationStore.getState()._applyPartyMembersFromCollab([member({ computedValues: { stale: 1 } })]);
    const m0 = useMitigationStore.getState().partyMembers[0];
    expect(m0.id).toBe('MT');
    expect(m0.jobId).toBe('pld');
    expect(m0.computedValues).not.toEqual({ stale: 1 });
    expect(typeof m0.computedValues).toBe('object');
  });
});

describe('②-b-1 events 委譲', () => {
  beforeEach(() => useMitigationStore.setState({ timelineEvents: [], _collabActive: false, _collabHandlers: null }));
  const e = { id: 'e1', time: 30, name: { ja: '技' }, damageType: 'magical' } as any;
  it('addEvent は upsertItems に委譲し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().addEvent(e);
    expect(h.upsertItems).toHaveBeenCalledWith('timelineEvents', [e]);
    expect(useMitigationStore.getState().timelineEvents).toEqual([]);
  });
  it('updateEvent は id+patch を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateEvent('e1', { time: 45 });
    expect(h.upsertItems).toHaveBeenCalledWith('timelineEvents', [{ id: 'e1', time: 45 }]);
  });
  it('removeEvent は removeItems に委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().removeEvent('e1');
    expect(h.removeItems).toHaveBeenCalledWith('timelineEvents', ['e1']);
  });
});

describe('②-b-1 phases 委譲', () => {
  beforeEach(() => useMitigationStore.setState({
    phases: [{ id: 'p1', name: { ja: 'P1' }, startTime: 0, endTime: 100 }] as any,
    timelineEvents: [{ id: 'e1', time: 120, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _collabActive: false, _collabHandlers: null,
  }));
  it('addPhase は新フェーズ + クリップ対象を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().addPhase(50, { ja: 'P2' } as any);
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('phases');
    const p1 = items.find((i: any) => i.id === 'p1');
    expect(p1.endTime).toBe(49); // 含有 p1 を startTime-1 でクリップ
    const np = items.find((i: any) => i.id !== 'p1');
    expect(np.startTime).toBe(50);
    expect(useMitigationStore.getState().phases.find((p) => p.id === 'p1')!.endTime).toBe(100); // store 直変更なし
  });
  it('updatePhase(rename) は id+name を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updatePhase('p1', { ja: 'NEW' } as any);
    expect(h.upsertItems).toHaveBeenCalledWith('phases', [{ id: 'p1', name: { ja: 'NEW' } }]);
  });
  it('removePhase は removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().removePhase('p1');
    expect(h.removeItems).toHaveBeenCalledWith('phases', ['p1']);
  });
});

describe('②-b-1 labels 委譲', () => {
  beforeEach(() => useMitigationStore.setState({
    labels: [{ id: 'l1', name: { ja: 'L1' }, startTime: 0, endTime: 100 }] as any,
    timelineEvents: [{ id: 'e1', time: 120, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _collabActive: false, _collabHandlers: null,
  }));
  it('addLabel は新ラベル+クリップを upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().addLabel(50, { ja: 'L2' } as any);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('labels');
    expect(items.find((i: any) => i.id === 'l1').endTime).toBe(49);
  });
  it('updateLabel(rename) は id+name を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateLabel('l1', { ja: 'NEW' } as any);
    expect(h.upsertItems).toHaveBeenCalledWith('labels', [{ id: 'l1', name: { ja: 'NEW' } }]);
  });
  it('removeLabel は removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().removeLabel('l1');
    expect(h.removeItems).toHaveBeenCalledWith('labels', ['l1']);
  });
});

describe('②-b-1 memos/planMeta 委譲', () => {
  beforeEach(() => useMitigationStore.setState({
    memos: [{ id: 'mo1', text: 'a', timeSec: 1, xRatio: 0.1, createdAt: 1, updatedAt: 1 }],
    schAetherflowPatterns: { H1: 1 },
    timelineMitigations: [],
    currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));
  it('updateMemo は id+patch を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateMemo('mo1', { text: 'b' });
    expect(h.upsertItems).toHaveBeenCalledWith('memos', [{ id: 'mo1', text: 'b' }]);
  });
  it('deleteMemo は removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().deleteMemo('mo1');
    expect(h.removeItems).toHaveBeenCalledWith('memos', ['mo1']);
  });
  it('deleteAllMemos は現存 id を全 removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().deleteAllMemos();
    expect(h.removeItems).toHaveBeenCalledWith('memos', ['mo1']);
  });
  it('addMemo は memos に upsert し true を返す(store 直変更なし)', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const ret = useMitigationStore.getState().addMemo({ text: 'new', timeSec: 5, xRatio: 0.2 });
    expect(ret).toBe(true);
    expect((h.upsertItems as any).mock.calls[0][0]).toBe('memos');
    expect((h.upsertItems as any).mock.calls[0][1][0]).toMatchObject({ text: 'new', timeSec: 5, xRatio: 0.2 });
    expect(useMitigationStore.getState().memos).toHaveLength(1); // 直変更なし
  });
  it('setAaSettings は setMeta(aaSettings) に委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const aa = { damage: 9, type: 'magical', target: 'MT' } as const;
    useMitigationStore.getState().setAaSettings(aa);
    expect(h.setMeta).toHaveBeenCalledWith('aaSettings', aa);
  });
  it('setCurrentLevel は setMeta(currentLevel) に委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setCurrentLevel(80);
    expect(h.setMeta).toHaveBeenCalledWith('currentLevel', 80);
  });
  it('setSchAetherflowPattern は値を setMeta + 転化を ②-a handler 経由で配置', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setSchAetherflowPattern('H2', 2);
    expect(h.setMeta).toHaveBeenCalledWith('schAetherflowPatterns', { H1: 1, H2: 2 });
    // pattern 2 → 転化を time 14 で add(mitigations は ②-a 経路)
    expect((h.add as any).mock.calls[0][0]).toMatchObject({ mitigationId: 'dissipation', ownerId: 'H2', time: 14, duration: 30 });
  });
});

describe('②-b-1 importTimelineEvents バルク委譲', () => {
  beforeEach(() => useMitigationStore.setState({ timelineEvents: [], phases: [], labels: [], _collabActive: false, _collabHandlers: null }));
  it('importBulk に events と(変換後)phases/labels を渡す', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const events = [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any;
    const importPhases = [{ id: 1, startTimeSec: 0, name: { ja: 'P1' } }];
    useMitigationStore.getState().importTimelineEvents(events, importPhases as any, undefined);
    expect(h.importBulk).toHaveBeenCalledTimes(1);
    const [evArg, phArg, lbArg] = (h.importBulk as any).mock.calls[0];
    expect(evArg.map((e: any) => e.id)).toEqual(['e1']);
    expect(phArg[0].id).toBe('phase_1'); // ソロ版と同じ変換(phase_<id>)
    expect(lbArg).toBeUndefined();
    expect(useMitigationStore.getState().timelineEvents).toEqual([]); // store 直変更なし
  });
});

describe('②-c collab 中の undo/redo は handlers に委譲する', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineEvents: [{ id: 'e1', time: 10, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _collabActive: false, _collabHandlers: null, _collabReadonly: false,
    _collabCanUndo: false, _collabCanRedo: false,
  }));

  it('collab 中の undo は handlers.undo に委譲し、ローカル状態を直接変えない', () => {
    const h = mockHandlers();
    useMitigationStore.getState().enterCollabMode(h);
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().undo();
    expect(h.undo).toHaveBeenCalledTimes(1);
    expect(useMitigationStore.getState().timelineEvents).toBe(before); // 反映は observeDeep 経由のみ
  });

  it('collab 中の redo は handlers.redo に委譲する', () => {
    const h = mockHandlers();
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().redo();
    expect(h.redo).toHaveBeenCalledTimes(1);
  });

  it('純粋閲覧者(active=false, readonly=true)は undo/redo を委譲しない(多層防御)', () => {
    const h = mockHandlers();
    // enterCollabMode を呼ばない=純粋閲覧者(active=false)。readonly のみ true。
    useMitigationStore.setState({ _collabActive: false, _collabHandlers: h, _collabReadonly: true });
    useMitigationStore.getState().undo();
    useMitigationStore.getState().redo();
    expect(h.undo).not.toHaveBeenCalled();
    expect(h.redo).not.toHaveBeenCalled();
  });

  it('編集者ジョイナー(active=true, readonly=true)は undo/redo を委譲する', () => {
    const h = mockHandlers();
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.setState({ _collabReadonly: true }); // 編集者ジョイナーは active=true かつ readonly=true(persist-skip)
    useMitigationStore.getState().undo();
    useMitigationStore.getState().redo();
    expect(h.undo).toHaveBeenCalledTimes(1);
    expect(h.redo).toHaveBeenCalledTimes(1);
  });

  it('_setCollabUndoRedo がフラグを更新する', () => {
    useMitigationStore.getState()._setCollabUndoRedo(true, false);
    expect(useMitigationStore.getState()._collabCanUndo).toBe(true);
    expect(useMitigationStore.getState()._collabCanRedo).toBe(false);
  });

  it('exitCollabMode で undo/redo 可否フラグが false に戻る', () => {
    useMitigationStore.getState()._setCollabUndoRedo(true, true);
    useMitigationStore.getState().exitCollabMode();
    expect(useMitigationStore.getState()._collabCanUndo).toBe(false);
    expect(useMitigationStore.getState()._collabCanRedo).toBe(false);
  });
});

// Task 4: 進捗操作の collab 委譲 + Yjs→store 反映
const noopHandlers = {
    add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
    upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(),
    importBulk: vi.fn(), batch: vi.fn(), undo: vi.fn(), redo: vi.fn(),
};

describe('Task4: 進捗操作の collab 委譲', () => {
    beforeEach(() => {
        useMitigationStore.setState({
            progress: { points: [], cleared: false },
            _collabActive: false, _collabHandlers: null, _collabReadonly: false,
        } as any);
        vi.clearAllMocks();
    });

    it('collab中の recordReachedPoint は upsertItems(progressPoints) へ委譲しローカル set しない', () => {
        const upsertItems = vi.fn();
        const store = useMitigationStore.getState();
        store.clearAllProgressPoints();
        store.enterCollabMode({ ...noopHandlers, upsertItems });
        store.recordReachedPoint(40);
        expect(upsertItems).toHaveBeenCalledWith('progressPoints', [expect.objectContaining({ reachedPos: 40, id: expect.stringMatching(/^pt_/) })]);
        expect(useMitigationStore.getState().progress.points).toHaveLength(0); // ローカルには積まない
        store.exitCollabMode();
    });

    it('collab中の removeProgressPoint は removeItems(progressPoints) へ委譲する', () => {
        const removeItems = vi.fn();
        const store = useMitigationStore.getState();
        store.enterCollabMode({ ...noopHandlers, removeItems });
        store.removeProgressPoint('pt_x');
        expect(removeItems).toHaveBeenCalledWith('progressPoints', ['pt_x']);
        store.exitCollabMode();
    });

    it('collab中の setCleared は setMeta(progressCleared) へ委譲する', () => {
        const setMeta = vi.fn();
        const store = useMitigationStore.getState();
        store.enterCollabMode({ ...noopHandlers, setMeta });
        store.setCleared(true);
        expect(setMeta).toHaveBeenCalledWith('progressCleared', true);
        store.exitCollabMode();
    });

    it('_applyProgressPointsFromCollab は points を置き換える', () => {
        const store = useMitigationStore.getState();
        store._applyProgressPointsFromCollab([{ id: 'pt_z', ts: 1, reachedPos: 5 }]);
        expect(useMitigationStore.getState().progress.points).toEqual([{ id: 'pt_z', ts: 1, reachedPos: 5 }]);
    });

    it('_applyProgressPointsFromCollab は id なし点に id を補完して保持する(旧形式 Yjs 在室防御)', () => {
        const store = useMitigationStore.getState();
        store._applyProgressPointsFromCollab([
            { ts: 1, reachedPos: 10 } as any,  // id なし(旧形式)
            { ts: 2, reachedPos: 20 } as any,  // id なし(旧形式)
        ]);
        const points = useMitigationStore.getState().progress.points;
        // 2件とも保持(消えていない)
        expect(points).toHaveLength(2);
        // id が補完されている
        expect(points[0].id).toMatch(/^pt_/);
        expect(points[1].id).toMatch(/^pt_/);
        // reachedPos は元のまま
        expect(points[0].reachedPos).toBe(10);
        expect(points[1].reachedPos).toBe(20);
    });

    it('_applyMetaFromCollab は進捗スカラーを反映する', () => {
        const store = useMitigationStore.getState();
        store._applyMetaFromCollab({ progressCleared: true, progressActiveDays: 4 });
        const p = useMitigationStore.getState().progress;
        expect(p.cleared).toBe(true);
        expect(p.activeDays).toBe(4);
    });

    it('collab中の setProgressPointNote は upsertItems(progressPoints) で note フィールドだけ送る', () => {
        const upsertItems = vi.fn();
        const store = useMitigationStore.getState();
        store.enterCollabMode({ ...noopHandlers, upsertItems });
        store.setProgressPointNote('pt_a', '  メモ  ');
        expect(upsertItems).toHaveBeenCalledWith('progressPoints', [{ id: 'pt_a', note: 'メモ' }]);
        store.exitCollabMode();
    });

    it('collab中の clearAllProgressPoints は全 id を removeItems に委譲する', () => {
        // ローカルに点を仕込んでからcollab開始するシナリオ(委譲前に state から id を読む)
        useMitigationStore.setState({
            progress: { points: [{ id: 'pt_1', ts: 1, reachedPos: 10 }, { id: 'pt_2', ts: 2, reachedPos: 20 }], cleared: false },
            _collabActive: false, _collabHandlers: null, _collabReadonly: false,
        } as any);
        const removeItems = vi.fn();
        const store = useMitigationStore.getState();
        store.enterCollabMode({ ...noopHandlers, removeItems });
        store.clearAllProgressPoints();
        expect(removeItems).toHaveBeenCalledWith('progressPoints', ['pt_1', 'pt_2']);
        store.exitCollabMode();
    });
});

describe('Task4: readonly ガード — setProgressPointNote', () => {
    it('純粋閲覧者 (_collabActive=false, _collabReadonly=true) は setProgressPointNote をブロックする', () => {
        useMitigationStore.setState({
            progress: { points: [{ id: 'pt_a', ts: 1, reachedPos: 10, note: '既存メモ' }], cleared: false },
            _collabActive: false, _collabHandlers: null, _collabReadonly: true,
        } as any);
        useMitigationStore.getState().setProgressPointNote('pt_a', 'x');
        // readonly なので note は変わらないはず
        expect(useMitigationStore.getState().progress.points[0].note).toBe('既存メモ');
    });
});

describe('②-c Critical#2: collab 退出で solo 履歴が残らない(revoke/disconnect 後の巻き戻し防止)', () => {
  it('enterCollabMode は入室前 solo 履歴(_history/_future)をクリアする', () => {
    useMitigationStore.setState({
      _collabActive: false, _collabHandlers: null,
      _history: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any,
      _future: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any,
    });
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    expect(useMitigationStore.getState()._history).toEqual([]);
    expect(useMitigationStore.getState()._future).toEqual([]);
  });

  it('exitCollabMode は _history/_future をクリアし、直後の solo undo を no-op にする(入室前データへ巻き戻さない)', () => {
    const h = mockHandlers();
    // 入室前に solo 履歴があった状況を作る
    useMitigationStore.setState({
      timelineEvents: [{ id: 'collab-edit', time: 10, name: { ja: 'x' }, damageType: 'magical' }] as any,
      _history: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any,
      _future: [], _collabActive: false, _collabHandlers: null, _collabReadonly: false,
    });
    useMitigationStore.getState().enterCollabMode(h); // ここで _history はクリアされる
    useMitigationStore.getState().exitCollabMode();    // 退出でも空のまま
    expect(useMitigationStore.getState()._history).toEqual([]);
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().undo(); // solo no-op(_history 空)
    expect(useMitigationStore.getState().timelineEvents).toBe(before); // 巻き戻らない
  });
});

describe('solo の undo/redo は従来どおりローカル履歴で動く(回帰)', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineEvents: [{ id: 'e1', time: 10, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _history: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any,
    _future: [],
    _collabActive: false, _collabHandlers: null, _collabReadonly: false,
  }));
  it('collab でない undo はローカル履歴を復元する', () => {
    useMitigationStore.getState().undo();
    expect(useMitigationStore.getState().timelineEvents).toEqual([]); // 履歴(空)へ戻る
  });
});

describe('②-b-2 partyMembers 単純変更の委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT' }), member({ id: 'H1', jobId: 'whm', role: 'healer' })],
    currentLevel: 100, _collabActive: false, _collabHandlers: null,
  }));

  it('updateMemberStats は当該メンバーを partyMembers に upsert し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateMemberStats('MT', { hp: 999999 });
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('partyMembers');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('MT');
    expect(items[0].stats.hp).toBe(999999);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.stats.hp).toBe(100000);
  });

  it('applyDefaultStats は全メンバーを partyMembers に upsert し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().applyDefaultStats(90);
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('partyMembers');
    expect(items.map((m: any) => m.id).sort()).toEqual(['H1', 'MT']);
    expect(useMitigationStore.getState().partyMembers.every((m) => m.computedValues && Object.keys(m.computedValues).length === 0)).toBe(true);
  });
});

describe('②-b-2 setMemberJob 委譲（カスケード batch）', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('setMemberJob は batch に委譲し、partyMembers upsert に新 jobId を含め、store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setMemberJob('MT', 'war');
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const pmUpsert = ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers');
    expect(pmUpsert).toBeTruthy();
    expect(pmUpsert.items.find((m: any) => m.id === 'MT').jobId).toBe('war');
    expect(ops.some((o) => o.key === 'timelineMitigations' && o.kind === 'remove')).toBe(true);
    expect(ops.some((o) => o.key === 'timelineMitigations' && o.kind === 'upsert')).toBe(true);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.jobId).toBe('pld');
  });
});

describe('②-b-2 changeMemberJobWithMitigations 委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('batch に委譲し partyMembers upsert に新 jobId・mitigations upsert に渡した配列を含む', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const mitis = [applied({ id: 'cm1', mitigationId: 'rampart_war', ownerId: 'MT' })];
    useMitigationStore.getState().changeMemberJobWithMitigations('MT', 'war', mitis);
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    expect(ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers').items[0].jobId).toBe('war');
    const mitUpsert = ops.find((o) => o.kind === 'upsert' && o.key === 'timelineMitigations');
    expect(mitUpsert.items.some((m: any) => m.id === 'cm1')).toBe(true);
    expect(useMitigationStore.getState().partyMembers[0].jobId).toBe('pld');
  });
});

describe('②-b-2 updatePartyBulk 委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' }), member({ id: 'ST', jobId: 'war' })],
    timelineMitigations: [], timelineEvents: [], currentLevel: 100,
    _collabActive: false, _collabHandlers: null,
  }));

  it('batch に委譲し、更新メンバーを partyMembers upsert・mitigations を replace する', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updatePartyBulk([{ memberId: 'MT', jobId: 'drk' }]);
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const pm = ops.find((o) => o.kind === 'upsert' && o.key === 'partyMembers');
    expect(pm.items.map((m: any) => m.id)).toEqual(['MT']);
    expect(pm.items[0].jobId).toBe('drk');
    expect(ops.some((o) => o.kind === 'replace' && o.key === 'timelineMitigations')).toBe(true);
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')!.jobId).toBe('pld');
  });
});

describe('②-b-2 bulk mitigation 操作の委譲', () => {
  const member = (over: Partial<import('../../types').PartyMember> = {}): import('../../types').PartyMember => ({
    id: 'MT', jobId: 'pld', role: 'tank',
    stats: { hp: 100000, mainStat: 4000, det: 2000, crt: 3000, ten: 1000, ss: 400, wd: 140 },
    computedValues: {}, ...over,
  });
  beforeEach(() => useMitigationStore.setState({
    partyMembers: [member({ id: 'MT', jobId: 'pld' }), member({ id: 'H1', jobId: 'whm', role: 'healer' })],
    timelineMitigations: [applied({ id: 'a1', ownerId: 'MT' }), applied({ id: 'a2', ownerId: 'H1' })],
    timelineEvents: [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any,
    currentLevel: 100, _collabActive: false, _collabHandlers: null,
  }));

  it('clearMitigationsByMember は当該メンバーの mit id を removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().clearMitigationsByMember('MT');
    expect(h.removeItems).toHaveBeenCalledWith('timelineMitigations', ['a1']);
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(2);
  });

  it('clearAllMitigations は timelineMitigations を replace [] する', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().clearAllMitigations();
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    expect(ops).toEqual([{ kind: 'replace', key: 'timelineMitigations', items: [] }]);
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(2);
  });

  it('applyAutoPlan は mitigations replace + events の warning を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const newMits = [applied({ id: 'auto1', ownerId: 'MT' })];
    useMitigationStore.getState().applyAutoPlan({ mitigations: newMits, warnings: ['e1'] });
    expect(h.batch).toHaveBeenCalledTimes(1);
    const ops = (h.batch as any).mock.calls[0][0] as Array<any>;
    const rep = ops.find((o) => o.kind === 'replace' && o.key === 'timelineMitigations');
    expect(rep.items.some((m: any) => m.id === 'auto1')).toBe(true);
    const evUp = ops.find((o) => o.kind === 'upsert' && o.key === 'timelineEvents');
    expect(evUp.items.find((e: any) => e.id === 'e1').warning).toBe(true);
    expect(useMitigationStore.getState().timelineMitigations.map((m) => m.id)).toEqual(['a1', 'a2']);
  });
});

describe('②-b-2 restoreFromSnapshot ガード', () => {
  it('collab 中は restoreFromSnapshot が状態を変えない（no-op）', () => {
    useMitigationStore.setState({
      partyMembers: [{ id: 'MT', jobId: 'pld', role: 'tank', stats: { hp: 1, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 }, computedValues: {} }] as any,
      timelineEvents: [{ id: 'keep', time: 1, name: { ja: 'k' }, damageType: 'magical' }] as any,
      _collabActive: false, _collabHandlers: null,
    });
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().restoreFromSnapshot({
      currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
      partyMembers: [], myMemberId: null, myJobHighlight: false, hideEmptyRows: true,
    } as any);
    expect(useMitigationStore.getState().timelineEvents).toBe(before);
  });
});

describe('⑤-3b collab readonly persist ガード', () => {
  beforeEach(() => useMitigationStore.setState({ _collabReadonly: false }));
  it('setCollabReadonly が _collabReadonly を切り替える', () => {
    useMitigationStore.getState().setCollabReadonly(true);
    expect(useMitigationStore.getState()._collabReadonly).toBe(true);
    useMitigationStore.getState().setCollabReadonly(false);
    expect(useMitigationStore.getState()._collabReadonly).toBe(false);
  });
});

// トップレベル afterEach: enterCollabMode のリークを vmThreads 下でも防ぐ
afterEach(() => useMitigationStore.getState().exitCollabMode());

describe('②-b collab 中の連鎖確定は upsertItems に委譲する(データ消失根治)', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineMitigations: [], timelineEvents: [],
    aetherflowChainPrompt: null, astrologianDrawChainPrompt: null,
    _collabActive: false, _collabHandlers: null, _collabReadonly: false,
  }));
  it('confirmAetherflowChain は collab 中 upsertItems(timelineMitigations) に委譲し store を直変更しない', () => {
    const h = mockHandlers();
    useMitigationStore.setState({ aetherflowChainPrompt: { memberId: 'H1', startTime: 14 } });
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().confirmAetherflowChain();
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    expect((h.upsertItems as any).mock.calls[0][0]).toBe('timelineMitigations');
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]); // store 直変更なし(反映は observeDeep 経由)
    expect(useMitigationStore.getState().aetherflowChainPrompt).toBeNull(); // プロンプトは解除
  });
  it('confirmAstrologianDrawChain は collab 中 upsertItems(timelineMitigations) に委譲し store を直変更しない', () => {
    const h = mockHandlers();
    useMitigationStore.setState({ astrologianDrawChainPrompt: { memberId: 'H1', startTime: 14, startKind: 'astral_draw' } });
    useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().confirmAstrologianDrawChain();
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    expect((h.upsertItems as any).mock.calls[0][0]).toBe('timelineMitigations');
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(useMitigationStore.getState().astrologianDrawChainPrompt).toBeNull();
  });
});
