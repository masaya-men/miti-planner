// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../LoginModal', () => ({ LoginModal: () => null }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { FFLogsImportModal } from '../FFLogsImportModal';
import { useAuthStore } from '../../store/useAuthStore';

describe('FFLogsImportModal スワイプで閉じる', () => {
  it('親が onClose を差し替えた後のスワイプでは、新しい onClose が呼ばれる', () => {
    useAuthStore.setState({ user: { uid: 'u1' } } as never);
    const oldClose = vi.fn();
    const newClose = vi.fn();
    const { rerender } = render(<FFLogsImportModal isOpen onClose={oldClose} />);
    rerender(<FFLogsImportModal isOpen onClose={newClose} />);

    const handle = document.querySelector('.cursor-grab') as HTMLElement;
    expect(handle).toBeTruthy();
    fireEvent.touchStart(handle, { touches: [{ clientY: 0 }] });
    fireEvent.touchMove(handle, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(handle);

    expect(oldClose).not.toHaveBeenCalled();
    expect(newClose).toHaveBeenCalledTimes(1);
  });
});
