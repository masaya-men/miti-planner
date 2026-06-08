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
