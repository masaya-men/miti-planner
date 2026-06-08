import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { AppliedMitigation } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';

const applied = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: 'x1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

const mockHandlers = (): CollabHandlers => ({
  add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
  upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(), importBulk: vi.fn(),
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
