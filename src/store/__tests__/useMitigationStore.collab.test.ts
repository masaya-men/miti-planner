import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { AppliedMitigation } from '../../types';
import type { CollabHandlers } from '../../lib/collab/collabTypes';

const applied = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: 'x1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

const mockHandlers = (): CollabHandlers => ({ add: vi.fn(), remove: vi.fn(), updateTime: vi.fn() });

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
