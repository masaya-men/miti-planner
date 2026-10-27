// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => (typeof d === 'string' ? d : k) }),
}));

let lastNewJobName: string | undefined;
vi.mock('../JobMigrationModal', () => ({
  JobMigrationModal: (p: { newJob?: { name?: { ja?: string } } }) => {
    lastNewJobName = p.newJob?.name?.ja;
    return <div data-testid="migration-modal" />;
  },
}));

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

import { PartySettingsModal } from '../PartySettingsModal';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useMasterDataStore } from '../../store/useMasterDataStore';
import { JOBS as STATIC_JOBS } from '../../data/mockData';

describe('PartySettingsModal ジョブ一覧の更新', () => {
  it('開いている間にジョブ一覧が更新されたら、閉じる時の移行確認は新しい一覧のジョブ情報を使う', () => {
    const pld = STATIC_JOBS.find((j) => j.id === 'pld')!;
    useMitigationStore.setState({
      partyMembers: useMitigationStore.getState().partyMembers.map((m) => (m.id === 'MT' ? { ...m, jobId: 'war' } : m)),
      timelineMitigations: [{ id: 'x1', ownerId: 'MT', mitigationId: 'rampart', time: 10 }] as never,
    });
    render(<PartySettingsModal isOpen onClose={() => {}} />);
    act(() => { capturedOnDrop!(pld, '0'); }); // 下書きの MT を PLD に

    act(() => {
      useMasterDataStore.setState({
        skills: { jobs: STATIC_JOBS.map((j) => (j.id === 'pld' ? { ...j, name: { ...j.name, ja: '更新後ナイト' } } : j)), mitigations: [] },
      } as never);
    });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(lastNewJobName).toBe('更新後ナイト');
  });
});
