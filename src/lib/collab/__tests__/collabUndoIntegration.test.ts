import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { createPlanUndoManager } from '../planUndoManager';
import { appliedToYMap, readMitigations, indexOfMitigation, YJS_MITIGATIONS_KEY } from '../yjsMitigations';
import type { AppliedMitigation } from '../../../types';
import type { CollabHandlers } from '../collabTypes';

// startCollabSession の最小再現: yarr.observeDeep→_applyMitigationsFromCollab、
// handlers.add/remove/undo/redo を実 Y.Doc + 実 UndoManager に結ぶ。
// これで store.undo() → handler.undo → um.undo → observeDeep → store 反映 の実連鎖を踏む
// (no-op mock では起きない入れ子 set を再現し、Critical#1 の desync を検出する)。
function wire(doc: Y.Doc) {
  const yarr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
  const apply = () => useMitigationStore.getState()._applyMitigationsFromCollab(readMitigations(doc));
  yarr.observeDeep(apply);
  const planUndo = createPlanUndoManager([yarr], (cu, cr) => useMitigationStore.getState()._setCollabUndoRedo(cu, cr));
  const handlers: Partial<CollabHandlers> = {
    add: (m: AppliedMitigation) => doc.transact(() => yarr.push([appliedToYMap(m)]), 'local'),
    remove: (id: string) => doc.transact(() => { const i = indexOfMitigation(yarr, id); if (i >= 0) yarr.delete(i, 1); }, 'local'),
    undo: () => planUndo.undo(),
    redo: () => planUndo.redo(),
  };
  return { doc, yarr, planUndo, handlers, disconnect: () => { yarr.unobserveDeep(apply); planUndo.destroy(); } };
}

const sample = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: 'm1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

beforeEach(() => useMitigationStore.setState({ timelineMitigations: [], _collabActive: false, _collabHandlers: null, _collabReadonly: false }));

describe('②-c Critical#1: collab undo/redo で store と Y.Doc が desync しない(実エンジン)', () => {
  it('add→undo 後、store.timelineMitigations が Y.Doc と一致する(両方空)', () => {
    const w = wire(new Y.Doc());
    useMitigationStore.getState().enterCollabMode(w.handlers as CollabHandlers);
    useMitigationStore.getState().addMitigation(sample({ id: 'a1' }));
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['a1']);
    expect(readMitigations(w.doc).map(m => m.id)).toEqual(['a1']);
    useMitigationStore.getState().undo();
    // バグ版: store にゴースト 'a1' が残り doc は空 → 不一致で FAIL。修正版: 両方空。
    expect(readMitigations(w.doc)).toEqual([]);
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(readMitigations(w.doc).map(m => m.id));
    w.disconnect();
  });

  it('add→undo→redo 後、store と Y.Doc が一致する(両方 a1)', () => {
    const w = wire(new Y.Doc());
    useMitigationStore.getState().enterCollabMode(w.handlers as CollabHandlers);
    useMitigationStore.getState().addMitigation(sample({ id: 'a1' }));
    useMitigationStore.getState().undo();
    useMitigationStore.getState().redo();
    expect(readMitigations(w.doc).map(m => m.id)).toEqual(['a1']);
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['a1']);
    w.disconnect();
  });
});
