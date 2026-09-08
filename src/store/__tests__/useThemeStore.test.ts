// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore, applyThemeClasses } from '../useThemeStore';

describe('useThemeStore themeStyle 軸', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
  });

  it('themeStyle の既定は standard', () => {
    expect(useThemeStore.getState().themeStyle).toBe('standard');
  });

  it('setThemeStyle("military") で state が更新され <html> に theme-military が付く', () => {
    useThemeStore.getState().setThemeStyle('military');
    expect(useThemeStore.getState().themeStyle).toBe('military');
    expect(document.documentElement.classList.contains('theme-military')).toBe(true);
    // 明るさ軸のクラスは維持
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('setThemeStyle("standard") で theme-military が外れる', () => {
    useThemeStore.getState().setThemeStyle('military');
    useThemeStore.getState().setThemeStyle('standard');
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });

  it('setTheme("light") は themeStyle=military を保ったまま theme-light に切り替える', () => {
    useThemeStore.getState().setThemeStyle('military');
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('theme-military')).toBe(true);
  });

  it('applyThemeClasses は3クラスを冪等に正規化する', () => {
    document.documentElement.className = 'theme-dark theme-military foo';
    applyThemeClasses('light', 'standard');
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
    expect(document.documentElement.classList.contains('foo')).toBe(true); // 無関係クラスは触らない
  });
});

describe('useThemeStore persist migrate', () => {
  it('version<2 の永続値に themeStyle が無ければ standard を補う', () => {
    // migrate 関数を直接叩く(persist の内部形に合わせる)
    const migrated = (useThemeStore.persist.getOptions().migrate as any)(
      { theme: 'dark', contentLanguage: 'ja', mobileEffectBarMode: 'icon' },
      1,
    );
    expect(migrated.themeStyle).toBe('standard');
  });
});
