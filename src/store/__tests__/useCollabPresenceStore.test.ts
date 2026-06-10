import { describe, it, expect, beforeEach } from 'vitest';
import { useCollabPresenceStore } from '../useCollabPresenceStore';
import type { RosterEntry } from '../../lib/collab/presence';

const entry = (clientId: number): RosterEntry => ({
  clientId, color: '#fff', jobId: null, isEditor: true, cursorEnabled: true, isLocal: false,
});

beforeEach(() => useCollabPresenceStore.setState({ roster: [] }));

describe('useCollabPresenceStore', () => {
  it('setRoster で roster を置き換える', () => {
    useCollabPresenceStore.getState().setRoster([entry(1), entry(2)]);
    expect(useCollabPresenceStore.getState().roster).toHaveLength(2);
  });
  it('clear で空にする', () => {
    useCollabPresenceStore.getState().setRoster([entry(1)]);
    useCollabPresenceStore.getState().clear();
    expect(useCollabPresenceStore.getState().roster).toEqual([]);
  });
});
