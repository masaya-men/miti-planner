// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MilspecStyleToggle } from '../MilspecStyleToggle';
import { useThemeStore } from '../../../store/useThemeStore';
import { TransitionOverlayProvider } from '../../ui/TransitionOverlay';

const renderToggle = () =>
  render(<TransitionOverlayProvider><MilspecStyleToggle /></TransitionOverlayProvider>);

// runTransition は演出のため callback を setTimeout(500ms) で遅延実行する。
// クリック後の状態変化を検証するテストはフェイクタイマーで演出時間を進める。
const flushTransition = async () => {
  await vi.advanceTimersByTimeAsync(1500);
};

describe('MilspecStyleToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('クリックで standard → military に切り替わる', async () => {
    renderToggle();
    fireEvent.click(screen.getByRole('button'));
    await flushTransition();
    expect(useThemeStore.getState().themeStyle).toBe('military');
  });

  it('military のときもう一度クリックで standard に戻る', async () => {
    useThemeStore.setState({ themeStyle: 'military' });
    renderToggle();
    fireEvent.click(screen.getByRole('button'));
    await flushTransition();
    expect(useThemeStore.getState().themeStyle).toBe('standard');
  });

  it('aria-pressed が themeStyle を反映する', () => {
    useThemeStore.setState({ themeStyle: 'military' });
    renderToggle();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
