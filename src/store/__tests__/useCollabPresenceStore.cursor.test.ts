import { describe, it, expect, beforeEach } from 'vitest';
import { useCollabPresenceStore } from '../useCollabPresenceStore';

describe('useCollabPresenceStore cursor 状態', () => {
  beforeEach(() => useCollabPresenceStore.getState().clear());

  it('初期は cursorEnabled=false(オプトイン), jobId=null, cursorFallback=false', () => {
    const s = useCollabPresenceStore.getState();
    expect(s.cursorEnabled).toBe(false);
    expect(s.jobId).toBeNull();
    expect(s.cursorFallback).toBe(false);
  });
  it('setCursorEnabled / setJobId / setCursorFallback が反映', () => {
    const s = useCollabPresenceStore.getState();
    s.setCursorEnabled(true);
    s.setJobId('war');
    s.setCursorFallback(true);
    const n = useCollabPresenceStore.getState();
    expect(n.cursorEnabled).toBe(true);
    expect(n.jobId).toBe('war');
    expect(n.cursorFallback).toBe(true);
  });
  it('clear で roster と cursor 状態が初期化(jobId は保持しない)', () => {
    const s = useCollabPresenceStore.getState();
    s.setCursorEnabled(true);
    s.setJobId('war');
    s.clear();
    const n = useCollabPresenceStore.getState();
    expect(n.roster).toEqual([]);
    expect(n.cursorEnabled).toBe(false);
    expect(n.jobId).toBeNull();
    expect(n.cursorFallback).toBe(false);
  });
});
