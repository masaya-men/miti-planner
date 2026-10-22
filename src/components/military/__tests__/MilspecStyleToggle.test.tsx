// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import i18n from '../../../i18n';
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

  it('説明は向きに関係なく「見た目を切り替える」・素の title は付けない', () => {
    const { rerender } = renderToggle();
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
    expect(btn.hasAttribute('title')).toBe(false);
    act(() => useThemeStore.getState().setThemeStyle('military'));
    rerender(<TransitionOverlayProvider><MilspecStyleToggle /></TransitionOverlayProvider>);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
  });

  it('standard のとき svg は親の文字色を継ぐ(ホバー反転で白地に白にならない)', () => {
    const { container } = renderToggle();
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('class') ?? '').not.toMatch(/text-app-text|text-app-text-muted/);
  });

  it('5 言語すべてに theme_style_switch がある', () => {
    for (const lng of ['ja', 'en', 'zh', 'zh-Hant', 'ko']) {
      expect(i18n.getResource(lng, 'translation', 'app.theme_style_switch')).toBeTruthy();
    }
  });
});
