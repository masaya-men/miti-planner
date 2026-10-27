// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => d ?? k }),
}));
vi.mock('../JobMigrationModal', () => ({
  JobMigrationModal: () => <div data-testid="migration-modal" />,
}));

// ドロップ確定時に呼ばれる onDrop を取り出すため、ドラッグ処理だけ差し替える
let capturedOnDrop: ((item: unknown, targetId: string) => void) | null = null;
vi.mock('../../hooks/useDragAndDrop', () => ({
  useDragAndDrop: (opts: { onDrop: (item: unknown, targetId: string) => void }) => {
    capturedOnDrop = opts.onDrop;
    return {
      isDragging: false, item: null, position: { x: 0, y: 0 }, activeTargetId: null,
      startDrag: vi.fn(), moveDrag: vi.fn(), endDrag: vi.fn(), setActiveTarget: vi.fn(),
    };
  },
}));

import { MobilePartyWithTabs as MobilePartySettings } from '../MobilePartySettings';
import { useMitigationStore } from '../../store/useMitigationStore';
import { JOBS as STATIC_JOBS } from '../../data/mockData';

describe('MobilePartySettings ドロップ', () => {
  it('軽減が後から配置された後にドロップでジョブ変更すると、最新の配置で判定して移行確認が出る', () => {
    const pld = STATIC_JOBS.find((j) => j.id === 'pld')!;
    useMitigationStore.setState({
      partyMembers: useMitigationStore.getState().partyMembers.map((m) => (m.id === 'MT' ? { ...m, jobId: 'war' } : m)),
      timelineMitigations: [],
    });
    render(<MemoryRouter><MobilePartySettings /></MemoryRouter>);

    act(() => {
      useMitigationStore.setState({
        timelineMitigations: [{ id: 'x1', ownerId: 'MT', mitigationId: 'rampart', time: 10 }] as never,
      });
    });
    act(() => { capturedOnDrop!(pld, 'MT'); });

    expect(screen.queryByTestId('migration-modal')).not.toBeNull();
    expect(useMitigationStore.getState().partyMembers.find((m) => m.id === 'MT')?.jobId).toBe('war');
  });
});
