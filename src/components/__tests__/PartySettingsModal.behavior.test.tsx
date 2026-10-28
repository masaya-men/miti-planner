// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, cleanup } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => (typeof d === 'string' ? d : k) }),
}));

vi.mock('../JobMigrationModal', () => ({
  JobMigrationModal: (p: { batchTasks?: unknown[]; onConfirm: (m: string) => void; onCancel: () => void }) => (
    <div data-testid="migration-modal" data-count={p.batchTasks?.length}>
      <button data-testid="mig-confirm" onClick={() => p.onConfirm('reset')} />
      <button data-testid="mig-cancel" onClick={() => p.onCancel()} />
    </div>
  ),
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
import { JOBS as STATIC_JOBS } from '../../data/mockData';

const jobOf = (id: string) => useMitigationStore.getState().partyMembers.find((m) => m.id === id)?.jobId;

beforeEach(() => {
  useMitigationStore.setState({
    partyMembers: useMitigationStore.getState().partyMembers.map((m) => ({ ...m, jobId: m.id === 'MT' ? 'war' : null })),
    timelineMitigations: [],
    myMemberId: null,
  } as never);
});
afterEach(cleanup);

describe('PartySettingsModal の動き', () => {
  it('開くと 8 スロットが並び、押すと選択中の案内に切り替わり、もう一度押すと戻る', () => {
    render(<PartySettingsModal isOpen onClose={() => {}} />);
    for (let i = 0; i < 8; i++) expect(document.getElementById(`party-slot-${i}`)).toBeTruthy();
    expect(document.body.textContent).toContain('party.configuration_desc');
    fireEvent.click(document.getElementById('party-slot-1')!);
    expect(document.body.textContent).toContain('party.manual_mode_desc');
    fireEvent.click(document.getElementById('party-slot-1')!);
    expect(document.body.textContent).toContain('party.configuration_desc');
  });

  it('変更なしで Enter / Escape を押すと onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<PartySettingsModal isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('閉じている間はキー入力で onClose が呼ばれない', () => {
    const onClose = vi.fn();
    render(<PartySettingsModal isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ジョブを外して閉じると、軽減があっても確認なしで反映される', () => {
    useMitigationStore.setState({
      timelineMitigations: [{ id: 'x1', ownerId: 'MT', mitigationId: 'rampart', time: 10 }] as never,
    });
    const onClose = vi.fn();
    const { container } = render(<PartySettingsModal isOpen onClose={onClose} />);
    fireEvent.click(document.querySelector('[data-tutorial-remove="MT"]')!);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(jobOf('MT')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="migration-modal"]')).toBeNull();
  });

  it('スターを押すと自分のジョブが切り替わる', () => {
    render(<PartySettingsModal isOpen onClose={() => {}} />);
    const slot = document.getElementById('party-slot-0')!;
    fireEvent.click(slot.querySelectorAll('button')[0]);
    expect(useMitigationStore.getState().myMemberId).toBe('MT');
    fireEvent.click(slot.querySelectorAll('button')[0]);
    expect(useMitigationStore.getState().myMemberId).toBeNull();
  });

  describe('軽減のある席のジョブ変更', () => {
    const pld = () => STATIC_JOBS.find((j) => j.id === 'pld')!;
    beforeEach(() => {
      useMitigationStore.setState({
        timelineMitigations: [{ id: 'x1', ownerId: 'MT', mitigationId: 'rampart', time: 10 }] as never,
      });
    });

    it('閉じようとすると移行確認が出て、閉じない', () => {
      const onClose = vi.fn();
      render(<PartySettingsModal isOpen onClose={onClose} />);
      act(() => { capturedOnDrop!(pld(), '0'); });
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(document.querySelector('[data-testid="migration-modal"]')?.getAttribute('data-count')).toBe('1');
      expect(onClose).not.toHaveBeenCalled();
      expect(jobOf('MT')).toBe('war');
    });

    it('確認をやめると元の画面に戻り、確定すると反映して閉じる', () => {
      const onClose = vi.fn();
      render(<PartySettingsModal isOpen onClose={onClose} />);
      act(() => { capturedOnDrop!(pld(), '0'); });
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.click(document.querySelector('[data-testid="mig-cancel"]')!);
      expect(document.querySelector('[data-testid="migration-modal"]')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.click(document.querySelector('[data-testid="mig-confirm"]')!);
      expect(jobOf('MT')).toBe('pld');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
