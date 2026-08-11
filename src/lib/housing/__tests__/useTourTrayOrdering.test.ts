// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useTourTrayOrdering } from '../useTourTrayOrdering';
import type { MockListing } from '../../../data/housing/mockListings';
import type { DragEndEvent } from '@dnd-kit/core';

const listing = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, ...over,
});

// region 自動順は JP < NA < EU (resolveTourOrder.test.ts と同じ ALL_REGIONS 前提)。
const dragEvent = (activeId: string, overId: string): DragEndEvent =>
  ({ active: { id: activeId }, over: { id: overId } }) as unknown as DragEndEvent;

beforeEach(() => {
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [] });
  useHousingListingsStore.setState({
    listings: [
      listing({ id: 'na', region: 'NA', dc: 'Aether', server: 'Gilgamesh', addressKey: 'n' }),
      listing({ id: 'jp', region: 'JP', addressKey: 'j' }),
      listing({ id: 'eu', region: 'EU', dc: 'Chaos', server: 'Cerberus', addressKey: 'e' }),
    ],
    myListings: [],
  } as never);
  useEphemeralListingsStore.setState({ ephemeralListings: [] } as never);
});

describe('useTourTrayOrdering (2026-08-11: ドラッグ=自動ピン化)', () => {
  it('ドラッグで確定したカードは、その場でピン留めされる', () => {
    useTourTrayStore.setState({ trayIds: ['jp', 'na', 'eu'], pinnedIds: [] });
    const onChange = (ids: string[]) => useTourTrayStore.setState({ trayIds: ids });
    const { result } = renderHook(() => useTourTrayOrdering(useTourTrayStore.getState().trayIds, onChange));

    act(() => {
      result.current.handleDragEnd(dragEvent('eu', 'jp'));
    });

    expect(useTourTrayStore.getState().pinnedIds).toEqual(['eu']);
  });

  it('別のカードをドラッグしても、既存のピンは無効化されない(2026-08-11 修正対象のバグ)', () => {
    useTourTrayStore.setState({ trayIds: ['jp', 'na', 'eu'], pinnedIds: ['jp'] });
    const onChange = (ids: string[]) => useTourTrayStore.setState({ trayIds: ids });
    const { result } = renderHook(() => useTourTrayOrdering(useTourTrayStore.getState().trayIds, onChange));

    act(() => {
      result.current.handleDragEnd(dragEvent('eu', 'na'));
    });

    const pinned = useTourTrayStore.getState().pinnedIds;
    expect(pinned).toContain('jp');
    expect(pinned).toContain('eu');
  });

  it('効率順に並び替えは全ピン(ドラッグ由来含む)を解除して自動順に戻す', () => {
    useTourTrayStore.setState({ trayIds: ['eu', 'jp', 'na'], pinnedIds: ['eu', 'na'] });
    const onChange = (ids: string[]) => useTourTrayStore.setState({ trayIds: ids });
    const { result } = renderHook(() => useTourTrayOrdering(useTourTrayStore.getState().trayIds, onChange));

    act(() => {
      result.current.onSortEfficient();
    });

    expect(useTourTrayStore.getState().pinnedIds).toEqual([]);
    expect(useTourTrayStore.getState().trayIds).toEqual(['jp', 'na', 'eu']);
  });
});
