// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThemeStore, applyThemeClasses, resolveThemeStyle, useEffectiveThemeStyle } from '../useThemeStore';
import { useTutorialStore } from '../useTutorialStore';
import { registerThemeTutorialSync } from '../themeTutorialSync';

const hasMilitary = () => document.documentElement.classList.contains('theme-military');

describe('チュートリアル中は標準の見た目', () => {
  beforeEach(() => {
    registerThemeTutorialSync();
    useTutorialStore.setState({ isActive: false, activeTutorialId: null });
    useThemeStore.setState({ theme: 'dark', themeStyle: 'military' });
    applyThemeClasses('dark', 'military');
  });

  it('resolveThemeStyle: 権限ありでもチュートリアル中は standard', () => {
    expect(resolveThemeStyle('military', true, false)).toBe('military');
    expect(resolveThemeStyle('military', true, true)).toBe('standard');
  });

  it('開始 → 実効 standard・<html> から military が外れる', () => {
    const { result } = renderHook(() => useEffectiveThemeStyle());
    expect(result.current).toBe('military');
    act(() => { useTutorialStore.setState({ isActive: true, activeTutorialId: 'main' }); });
    expect(result.current).toBe('standard');
    expect(hasMilitary()).toBe(false);
    expect(useThemeStore.getState().themeStyle).toBe('military');
  });

  it('completeTutorial / skipTutorial 後は military に戻り、保存値は無傷', () => {
    const { result } = renderHook(() => useEffectiveThemeStyle());
    for (const end of ['completeTutorial', 'skipTutorial'] as const) {
      act(() => { useTutorialStore.setState({ isActive: true, activeTutorialId: 'main' }); });
      expect(result.current).toBe('standard');
      expect(hasMilitary()).toBe(false);
      act(() => {
        useTutorialStore.getState()[end]();
        // skipTutorial は終了確認待ち(pendingExit)にするだけ。確定は confirmExit
        if (end === 'skipTutorial') useTutorialStore.getState().confirmExit();
      });
      expect(useTutorialStore.getState().isActive).toBe(false);
      expect(result.current).toBe('military');
      expect(hasMilitary()).toBe(true);
      expect(useThemeStore.getState().themeStyle).toBe('military');
    }
  });

  it('チュートリアル中に保存値を変えても実効は standard(終了後に反映)', () => {
    const { result } = renderHook(() => useEffectiveThemeStyle());
    act(() => { useTutorialStore.setState({ isActive: true, activeTutorialId: 'main' }); });
    act(() => { useThemeStore.getState().setThemeStyle('standard'); });
    act(() => { useThemeStore.getState().setThemeStyle('military'); });
    expect(result.current).toBe('standard');
    expect(hasMilitary()).toBe(false);
    act(() => { useTutorialStore.getState().confirmExit(); });
    expect(result.current).toBe('military');
    expect(hasMilitary()).toBe(true);
  });
});
