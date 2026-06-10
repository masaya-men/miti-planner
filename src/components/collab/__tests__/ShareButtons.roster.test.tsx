// @vitest-environment happy-dom
// src/components/collab/__tests__/ShareButtons.roster.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareButtons } from '../../ShareButtons';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';
import type { RosterEntry } from '../../../lib/collab/presence';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => (o?.count != null ? `${k}:${o.count}` : k),
    i18n: { language: 'ja' },
  }),
}));
vi.mock('../../../store/useAuthStore', () => ({ useAuthStore: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../../LoginModal', () => ({ LoginModal: () => null }));

const entry = (id: number): RosterEntry => ({
  clientId: id, color: '#fff', jobId: null, isEditor: true, cursorEnabled: true, isLocal: false,
});

beforeEach(() => {
  useCollabSessionStore.setState({ active: true } as any);
  useCollabPresenceStore.setState({ roster: [entry(1), entry(2), entry(3)] });
});

describe('ShareButtons チップ人数', () => {
  it('active かつ roster があれば人数つきチップを表示', () => {
    render(<ShareButtons contentLabel={null} currentPlan={undefined} />);
    expect(screen.getByText('collab.chip_active_count:3')).toBeInTheDocument();
  });
});
