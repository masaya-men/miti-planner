// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAllmarksImport } from '../useAllmarksImport';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { EPHEMERAL_POOL_LIMIT, createEphemeralListing, type EphemeralInput } from '../ephemeralListing';
import type { HousingExtractResult } from '../parseHousingFromText';

const mockFetchUrls = vi.fn();
const mockResolve = vi.fn();
vi.mock('../allmarksImport', () => ({
  fetchAllmarksShareUrls: (...a: unknown[]) => mockFetchUrls(...a),
  resolveHousingAddressFromUrl: (...a: unknown[]) => mockResolve(...a),
}));

function houseResult(overrides: Partial<HousingExtractResult> & { dc: string; server: string }): HousingExtractResult {
  return { area: 'Mist', ward: 5, plot: 10, size: 'M', ambiguity: [], ...overrides };
}

const baseInput: EphemeralInput = {
  area: 'Mist',
  ward: 5,
  buildingType: 'house',
  plot: 10,
  size: 'M',
};

beforeEach(() => {
  useEphemeralListingsStore.getState().clear();
  mockFetchUrls.mockReset();
  mockResolve.mockReset();
});

describe('useAllmarksImport (2026-08-19 Allmarksまとめてインポート)', () => {
  it('全件成功: added=総数、一時プールに全件入り、onAddが件数分呼ばれる', async () => {
    const urls = ['u1', 'u2', 'u3'];
    mockFetchUrls.mockResolvedValueOnce(urls);
    mockResolve.mockImplementation(async (url: string) =>
      ({ result: houseResult({ dc: 'Elemental', server: 'Carbuncle' }), source: { postUrl: url } }),
    );
    const onAdd = vi.fn();
    const { result } = renderHook(() => useAllmarksImport());

    await act(async () => {
      await result.current.start('Ab3xY9', null, onAdd);
    });

    expect(result.current.progress.status).toBe('done');
    expect(result.current.progress.total).toBe(3);
    expect(result.current.progress.added).toBe(3);
    expect(result.current.progress.failed).toBe(0);
    expect(onAdd).toHaveBeenCalledTimes(3);
    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(3);
  });

  it('住所を読み取れなかったURLはfailedに数え、追加しない', async () => {
    mockFetchUrls.mockResolvedValueOnce(['u1', 'u2']);
    mockResolve
      .mockResolvedValueOnce({ result: houseResult({ dc: 'Elemental', server: 'Carbuncle' }), source: { postUrl: 'u1' } })
      .mockResolvedValueOnce(null); // 読み取れなかった
    const onAdd = vi.fn();
    const { result } = renderHook(() => useAllmarksImport());

    await act(async () => {
      await result.current.start('Ab3xY9', null, onAdd);
    });

    expect(result.current.progress.added).toBe(1);
    expect(result.current.progress.failed).toBe(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('DC/Serverが取れず不完全な住所はfailed扱い (推測で埋めない)', async () => {
    mockFetchUrls.mockResolvedValueOnce(['u1']);
    mockResolve.mockResolvedValueOnce({
      result: { area: 'Mist', ward: 5, plot: 10, size: 'M', ambiguity: [] }, // dc/server無し
      source: { postUrl: 'u1' },
    });
    const { result } = renderHook(() => useAllmarksImport());

    await act(async () => {
      await result.current.start('Ab3xY9', null, vi.fn());
    });

    expect(result.current.progress.added).toBe(0);
    expect(result.current.progress.failed).toBe(1);
  });

  it('地域跨ぎ (JP→EU) はブロックしfailed扱い、既存トレイの地域は変えない', async () => {
    mockFetchUrls.mockResolvedValueOnce(['u1', 'u2']);
    mockResolve
      .mockResolvedValueOnce({ result: houseResult({ dc: 'Elemental', server: 'Carbuncle' }), source: { postUrl: 'u1' } }) // JP: OK
      .mockResolvedValueOnce({ result: houseResult({ dc: 'Chaos', server: 'Cerberus' }), source: { postUrl: 'u2' } }); // EU: ブロック
    const { result } = renderHook(() => useAllmarksImport());

    await act(async () => {
      await result.current.start('Ab3xY9', 'JP', vi.fn());
    });

    expect(result.current.progress.added).toBe(1);
    expect(result.current.progress.failed).toBe(1);
  });

  it('共有が空 (期限切れ/不正リンク) は shareNotFound=true', async () => {
    mockFetchUrls.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useAllmarksImport());

    await act(async () => {
      await result.current.start('Ab3xY9', null, vi.fn());
    });

    expect(result.current.progress.status).toBe('done');
    expect(result.current.progress.shareNotFound).toBe(true);
  });

  it('一時プールの上限に達したら打ち切り、limitReached=true', async () => {
    // 上限ぎりぎり (残り1件分) まで既存データで埋めておく。
    for (let i = 0; i < EPHEMERAL_POOL_LIMIT - 1; i++) {
      useEphemeralListingsStore.getState().add(createEphemeralListing({ ...baseInput, ward: (i % 30) + 1 }));
    }
    mockFetchUrls.mockResolvedValueOnce(['u1', 'u2', 'u3']);
    mockResolve.mockImplementation(async (url: string) =>
      ({ result: houseResult({ dc: 'Elemental', server: 'Carbuncle' }), source: { postUrl: url } }),
    );
    const { result } = renderHook(() => useAllmarksImport());

    await act(async () => {
      await result.current.start('Ab3xY9', null, vi.fn());
    });

    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(EPHEMERAL_POOL_LIMIT);
    expect(result.current.progress.limitReached).toBe(true);
  });

  it('cancel: 進行中に呼ぶと即座に idle へ戻る', async () => {
    mockFetchUrls.mockImplementationOnce(() => new Promise(() => {})); // 永久に解決しない = fetching-list のまま止める
    const { result } = renderHook(() => useAllmarksImport());

    act(() => {
      void result.current.start('Ab3xY9', null, vi.fn());
    });
    await waitFor(() => expect(result.current.progress.status).toBe('fetching-list'));

    act(() => {
      result.current.cancel();
    });

    expect(result.current.progress.status).toBe('idle');
  });
});
