// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: string) => (typeof d === 'string' ? d : k) }),
}));
vi.mock('../JobMigrationModal', () => ({ JobMigrationModal: () => <div /> }));

import { PartySettingsModal } from '../PartySettingsModal';
import { useTutorialStore } from '../../store/useTutorialStore';

afterEach(() => {
  cleanup();
  useTutorialStore.setState({ isActive: false });
});

describe('PartySettingsModal とチュートリアル', () => {
  it('チュートリアル中はパーティ設定の外を押しても閉じない', () => {
    useTutorialStore.setState({ isActive: true });
    const onClose = vi.fn();
    render(<PartySettingsModal isOpen onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(0);
  });

  it('チュートリアルでない時は外を押すと閉じる', () => {
    const onClose = vi.fn();
    render(<PartySettingsModal isOpen onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
