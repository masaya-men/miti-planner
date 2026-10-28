import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import { mockHandlers } from './collabStoreTestHelpers';

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
    upsertItems: vi.fn(), removeItems: vi.fn(), insertItemAt: vi.fn(), setMeta: vi.fn(),
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

    it('collab中の insertProgressPointAt(削除の取り消し)は insertItemAt(progressPoints) へ委譲しローカル set しない', () => {
        const insertItemAt = vi.fn();
        const store = useMitigationStore.getState();
        store.enterCollabMode({ ...noopHandlers, insertItemAt });
        const point = { id: 'pt_undo', ts: 2, reachedPos: 20 };
        store.insertProgressPointAt(1, point);
        expect(insertItemAt).toHaveBeenCalledWith('progressPoints', 1, point);
        expect(useMitigationStore.getState().progress.points).toHaveLength(0);
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
