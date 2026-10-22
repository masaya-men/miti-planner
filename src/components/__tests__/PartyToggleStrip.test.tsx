// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { id?: string }) => (o?.id ? `${k}:${o.id}` : k) }),
}));
vi.mock('../../hooks/useSkillsData', async (orig) => ({ ...(await orig<object>()), useJobs: () => [] }));
vi.mock('../ui/Tooltip', () => ({ Tooltip: ({ children }: { children?: React.ReactNode }) => children }));

import { PartyToggleStrip } from '../PartyToggleStrip';
import { useMitigationStore } from '../../store/useMitigationStore';

const memberToggles = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('data-member-toggle'));

describe('PartyToggleStrip', () => {
  beforeEach(() => {
    // 2 重 rAF を即時化
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    useMitigationStore.setState({ hiddenPartyMemberIds: [] });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('8 人分のトグルと ALL が描かれ、非表示の人は aria-pressed=false', () => {
    useMitigationStore.setState({ hiddenPartyMemberIds: ['D1'] });
    render(<PartyToggleStrip sortOrder="role" />);
    expect(memberToggles()).toHaveLength(8);
    expect(screen.getByRole('button', { name: /D1/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /MT/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ui.party_visibility_all_tooltip' })).toBeInTheDocument();
  });

  it('並びは sortOrder に従う', () => {
    render(<PartyToggleStrip sortOrder="light_party" />);
    expect(memberToggles().map((b) => b.getAttribute('data-member-toggle')))
      .toEqual(['MT', 'H1', 'D1', 'D3', 'ST', 'H2', 'D2', 'D4']);
  });

  it('トグルを押すと非表示/再表示が切り替わり、ALL で全員表示に戻る', () => {
    render(<PartyToggleStrip sortOrder="role" />);
    fireEvent.click(screen.getByRole('button', { name: /D1/ }));
    expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual(['D1']);
    fireEvent.click(screen.getByRole('button', { name: /MT/ }));
    expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual(['D1', 'MT']);
    fireEvent.click(screen.getByRole('button', { name: 'ui.party_visibility_all_tooltip' }));
    expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]);
  });

  it('区切り線: role は役割の境目(2 本)、light_party は 4 人目と 5 人目の間だけ(1 本)', () => {
    const { container, rerender } = render(<PartyToggleStrip sortOrder="role" />);
    // ALL の後ろの区切りを除いたメンバー間の区切り
    expect(container.querySelectorAll('[data-member-sep]')).toHaveLength(2);
    rerender(<PartyToggleStrip sortOrder="light_party" />);
    expect(container.querySelectorAll('[data-member-sep]')).toHaveLength(1);
  });
});
