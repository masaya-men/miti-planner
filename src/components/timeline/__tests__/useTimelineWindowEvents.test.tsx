// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimelineTutorialEvents } from '../useTimelineWindowEvents';

function makeArgs(isMobileView: boolean) {
  return {
    tutorialActive: false,
    tutorialStepIndex: 1,
    mobilePartyOpen: false,
    isMobileView,
    setIsAaModeEnabled: vi.fn(),
    setAaSettingsOpen: vi.fn(),
    setPartySettingsOpenLocal: vi.fn(),
    setMobilePartyOpen: vi.fn(),
    setMitigationSelectorOpen: vi.fn(),
    setIsModalOpen: vi.fn(),
    setPhaseDropdownOpen: vi.fn(),
    setGimmickDropdownOpen: vi.fn(),
    setMechanicSearchOpen: vi.fn(),
  };
}

describe('useTimelineTutorialEvents', () => {
  it('画面幅が変わって isMobileView が切り替わったら、新しい判定でパーティ設定を開く', () => {
    const args = makeArgs(false);
    const { rerender, unmount } = renderHook((p) => useTimelineTutorialEvents(p), { initialProps: args });
    rerender({ ...args, isMobileView: true });
    window.dispatchEvent(new Event('tutorial:open-party-modal'));
    expect(args.setMobilePartyOpen).toHaveBeenCalledWith(true);
    expect(args.setPartySettingsOpenLocal).not.toHaveBeenCalled();
    unmount();
  });
});
