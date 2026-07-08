import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useHousingTourStore } from '../useHousingTourStore';

describe('useHousingTourStore — フェーズ/見学タイマー', () => {
  beforeEach(() => {
    useHousingTourStore.getState().reset();
    useHousingTourStore.getState().setListings(['a', 'b', 'c']);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T14:32:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('初期状態は moving / viewStartAt=null', () => {
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('moving');
    expect(s.viewStartAt).toBeNull();
  });

  it('startViewing で viewing + 開始時刻が入る', () => {
    useHousingTourStore.getState().startViewing();
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('viewing');
    expect(s.viewStartAt).toBe(new Date('2026-07-08T14:32:00').getTime());
  });

  it('next で moving に戻り viewStartAt=null', () => {
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().next();
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('moving');
    expect(s.viewStartAt).toBeNull();
    expect(s.currentIndex).toBe(1);
  });

  it('prev でも moving に戻る', () => {
    useHousingTourStore.getState().next();
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().prev();
    const s = useHousingTourStore.getState();
    expect(s.phase).toBe('moving');
    expect(s.viewStartAt).toBeNull();
    expect(s.currentIndex).toBe(0);
  });

  it('start / reset も moving + viewStartAt=null', () => {
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().start();
    expect(useHousingTourStore.getState().phase).toBe('moving');
    expect(useHousingTourStore.getState().viewStartAt).toBeNull();
    useHousingTourStore.getState().startViewing();
    useHousingTourStore.getState().reset();
    expect(useHousingTourStore.getState().phase).toBe('moving');
    expect(useHousingTourStore.getState().viewStartAt).toBeNull();
  });
});
