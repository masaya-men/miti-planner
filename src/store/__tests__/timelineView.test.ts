// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { useThemeStore, resolveTimelineView } from '../useThemeStore';
describe('timelineView', () => {
  it('既定は lanes。setTimelineView で sheet に変わる', () => {
    expect(useThemeStore.getState().timelineView).toBe('lanes');
    useThemeStore.getState().setTimelineView('sheet');
    expect(useThemeStore.getState().timelineView).toBe('sheet');
  });
  it('resolveTimelineView: 権限なし / チュートリアル中 / スマホ は常に lanes。保存値は使わない', () => {
    expect(resolveTimelineView('sheet', true, false, false)).toBe('sheet');
    expect(resolveTimelineView('sheet', false, false, false)).toBe('lanes');
    expect(resolveTimelineView('sheet', true, true, false)).toBe('lanes');
    expect(resolveTimelineView('sheet', true, false, true)).toBe('lanes');
    expect(resolveTimelineView('lanes', true, false, false)).toBe('lanes');
  });
  it('persist version 3: 旧 state(timelineView 無し)は lanes に補われる', () => {
    const migrate = (useThemeStore as unknown as { persist: { getOptions(): { migrate: (s: unknown, v: number) => unknown } } }).persist.getOptions().migrate;
    expect((migrate({ theme: 'dark', themeStyle: 'standard' }, 2) as { timelineView: string }).timelineView).toBe('lanes');
  });
});
