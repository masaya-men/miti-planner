// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { CursorOverlay } from '../CursorOverlay';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';
import type { RosterEntry } from '../../../lib/collab/presence';

const tMap = new Map<number, number>([[0, 0], [100, 1000]]);
const refs = () => ({
  timeToYMapRef: { current: tMap } as React.RefObject<Map<number, number>>,
  sheetWidthRef: { current: 800 } as React.RefObject<number>,
});

const peer = (over: Partial<RosterEntry>): RosterEntry => ({
  clientId: 0, color: '#222', jobId: null, isEditor: true, cursorEnabled: true, isLocal: false, ...over,
});

afterEach(() => useCollabPresenceStore.getState().clear());

describe('CursorOverlay', () => {
  it('自分以外 & cursorEnabled の peer の数だけ要素を描く', () => {
    useCollabPresenceStore.setState({
      roster: [
        peer({ clientId: 1, isLocal: true }),               // 自分 → 除外
        peer({ clientId: 2, color: '#222' }),               // 描く
        peer({ clientId: 3, cursorEnabled: false }),        // OFF → 除外
      ],
    });
    const { container } = render(<CursorOverlay {...refs()} />);
    expect(container.querySelectorAll('[data-cursor-id]').length).toBe(1);
    expect(container.querySelector('[data-cursor-id="2"]')).not.toBeNull();
  });

  it('描く相手がいなければ何も描かない(null を返す)', () => {
    useCollabPresenceStore.setState({ roster: [peer({ clientId: 1, isLocal: true })] });
    const { container } = render(<CursorOverlay {...refs()} />);
    expect(container.querySelectorAll('[data-cursor-id]').length).toBe(0);
  });
});
