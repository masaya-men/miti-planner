// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParticipantDots } from '../ParticipantDots';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';
import type { RosterEntry } from '../../../lib/collab/presence';

const entry = (clientId: number): RosterEntry => ({
  clientId, color: '#34d399', jobId: null, isEditor: true, cursorEnabled: false, isLocal: false,
});

describe('ParticipantDots ①人数分ドット', () => {
  beforeEach(() => useCollabPresenceStore.getState().clear());

  it('connectionCount > roster なら不足分を無名ドットで補い、合計を確実な人数に一致させる', () => {
    useCollabPresenceStore.setState({ roster: [entry(1), entry(2)], connectionCount: 4 });
    render(<ParticipantDots />);
    const all = screen.getAllByTestId('participant-dot');
    expect(all).toHaveLength(4);
    // 名前付き(roster)2 + 無名(不足)2
    expect(all.filter((d) => d.hasAttribute('data-anon'))).toHaveLength(2);
  });

  it('connectionCount 未取得(null)なら roster 分だけ表示(フォールバック)', () => {
    useCollabPresenceStore.setState({ roster: [entry(1), entry(2)], connectionCount: null });
    render(<ParticipantDots />);
    const all = screen.getAllByTestId('participant-dot');
    expect(all).toHaveLength(2);
    expect(all.filter((d) => d.hasAttribute('data-anon'))).toHaveLength(0);
  });

  it('connectionCount <= roster なら無名ドットは出さない(名前付きのみ)', () => {
    useCollabPresenceStore.setState({ roster: [entry(1), entry(2), entry(3)], connectionCount: 2 });
    render(<ParticipantDots />);
    const all = screen.getAllByTestId('participant-dot');
    expect(all).toHaveLength(3);
    expect(all.filter((d) => d.hasAttribute('data-anon'))).toHaveLength(0);
  });
});
