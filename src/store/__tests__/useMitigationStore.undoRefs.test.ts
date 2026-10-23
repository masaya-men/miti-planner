import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';

// 取り消し・やり直しで、変わっていない配列(メンバー・フェーズ等)の参照が保たれること。
// 参照が変わると、行・列の memo が外れて全体が描き直される(Ctrl+Z が重い原因)。
describe('undo/redo: 変わっていない配列は同じ参照のまま', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    useMitigationStore.setState({
      timelineMitigations: [{ id: 'm1', mitigationId: 'x', time: 5, duration: 5, ownerId: 'MT' } as never],
      phases: [{ id: 'p1', name: { ja: 'a' }, startTime: 0, endTime: 100 } as never],
      _history: [], _future: [],
    });
  });

  it('undo', () => {
    const before = useMitigationStore.getState();
    const { partyMembers, phases, timelineEvents, labels } = before;
    useMitigationStore.getState().removeMitigation('m1');
    expect(useMitigationStore.getState().timelineMitigations).toHaveLength(0);
    useMitigationStore.getState().undo();
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toHaveLength(1);
    expect(after.partyMembers).toBe(partyMembers);
    expect(after.phases).toBe(phases);
    expect(after.timelineEvents).toBe(timelineEvents);
    expect(after.labels).toBe(labels);
  });

  it('redo', () => {
    const { partyMembers, phases } = useMitigationStore.getState();
    useMitigationStore.getState().removeMitigation('m1');
    useMitigationStore.getState().undo();
    useMitigationStore.getState().redo();
    const after = useMitigationStore.getState();
    expect(after.timelineMitigations).toHaveLength(0);
    expect(after.partyMembers).toBe(partyMembers);
    expect(after.phases).toBe(phases);
  });

  it('中身が変わった配列は戻る(フェーズを足してから undo)', () => {
    useMitigationStore.getState().removeMitigation('m1');
    const phasesNow = useMitigationStore.getState().phases;
    useMitigationStore.setState({ phases: [] });
    useMitigationStore.getState().undo();
    expect(useMitigationStore.getState().phases).toHaveLength(phasesNow.length);
  });
});
