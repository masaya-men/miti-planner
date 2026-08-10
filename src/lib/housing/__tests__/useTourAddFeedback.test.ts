// @vitest-environment happy-dom
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useTourAddFeedback } from '../useTourAddFeedback';

beforeEach(() => {
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [], manualOrder: false });
  useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
  useEphemeralListingsStore.setState({ ephemeralListings: [] } as never);
});

describe('useTourAddFeedback', () => {
  it('トレイが空なら追加できてisAddedがtrueになりanimStateがsuccessになる', () => {
    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));
    expect(result.current.isAdded).toBe(false);

    act(() => {
      const outcome = result.current.attemptToggle();
      expect(outcome).toBe('added');
    });

    expect(result.current.isAdded).toBe(true);
    expect(result.current.animState).toBe('success');
    expect(useTourTrayStore.getState().trayIds).toEqual(['house1']);
  });

  it('別リージョンの家がすでにトレイにあると追加をブロックしerrorMessageを立てる', () => {
    useHousingListingsStore.setState({
      listings: [{ id: 'other1', region: 'NA' } as never],
      myListings: [],
    } as never);
    useTourTrayStore.setState({ trayIds: ['other1'], pinnedIds: [], manualOrder: false });

    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));

    act(() => {
      const outcome = result.current.attemptToggle();
      expect(outcome).toBe('blocked');
    });

    expect(result.current.isAdded).toBe(false);
    expect(result.current.animState).toBe('error');
    expect(result.current.errorMessage).toBe('housing.tour.region_block');
    expect(useTourTrayStore.getState().trayIds).toEqual(['other1']);
  });

  it('追加済みの状態でattemptToggleを呼ぶと演出なしでトレイから外れる', () => {
    useTourTrayStore.setState({ trayIds: ['house1'], pinnedIds: [], manualOrder: false });
    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));
    expect(result.current.isAdded).toBe(true);

    act(() => {
      const outcome = result.current.attemptToggle();
      expect(outcome).toBe('removed');
    });

    expect(result.current.isAdded).toBe(false);
    expect(result.current.animState).toBe('idle');
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
  });

  it('animStateは一定時間後にidleへ自動で戻る(success)', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));
    act(() => {
      result.current.attemptToggle();
    });
    expect(result.current.animState).toBe('success');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.animState).toBe('idle');
    vi.useRealTimers();
  });
});
