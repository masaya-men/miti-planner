// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useTweetVideoFrames,
  __resetTweetVideoFramesForTests,
} from '../useTweetVideoFrames';
import { extractVideoFrames } from '../extractVideoFrames';

vi.mock('../extractVideoFrames', () => ({
  extractVideoFrames: vi.fn(),
  // computeSeekSeconds も同じ module からの export。 hook は直接呼ばないが、
  // mock factory は名前付き export を全て差し替える必要がある。
  computeSeekSeconds: vi.fn(),
}));

const mockExtract = vi.mocked(extractVideoFrames);

const URL_A = 'https://video.twimg.com/a.mp4';
const URL_B = 'https://video.twimg.com/b.mp4';
const URL_C = 'https://video.twimg.com/c.mp4';

describe('useTweetVideoFrames', () => {
  beforeEach(() => {
    __resetTweetVideoFramesForTests();
    mockExtract.mockReset();
  });

  it('returns [] until extraction succeeds, then the 3 data URLs', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c']);
    const { result } = renderHook(() =>
      useTweetVideoFrames('id1', URL_A, true),
    );
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual(['a', 'b', 'c']));
    expect(mockExtract).toHaveBeenCalledOnce();
    expect(mockExtract).toHaveBeenCalledWith({
      src: `/api/tweet-video?url=${encodeURIComponent(URL_A)}`,
      fractions: [0, 0.25, 0.5],
    });
  });

  it('returns cached frames instantly on a second hook with the same id', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c']);
    const first = renderHook(() => useTweetVideoFrames('id2', URL_A, true));
    await waitFor(() => expect(first.result.current.length).toBe(3));

    mockExtract.mockClear();
    const second = renderHook(() => useTweetVideoFrames('id2', URL_A, true));
    expect(second.result.current).toEqual(['a', 'b', 'c']);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('does nothing while enabled=false (cards out of view do not decode)', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c']);
    const { result } = renderHook(() =>
      useTweetVideoFrames('id3', URL_A, false),
    );
    expect(result.current).toEqual([]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('runs extractions one at a time — later cards wait for the slot', async () => {
    const resolvers: Array<(v: readonly string[]) => void> = [];
    mockExtract.mockImplementation(
      () =>
        new Promise<readonly string[]>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    renderHook(() => useTweetVideoFrames('id4', URL_A, true));
    renderHook(() => useTweetVideoFrames('id5', URL_B, true));
    renderHook(() => useTweetVideoFrames('id6', URL_C, true));

    // 最初の 1 つだけ走る、 残りは queue。
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolvers[0]?.(['a1', 'a2', 'a3']);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolvers[1]?.(['b1', 'b2', 'b3']);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockExtract).toHaveBeenCalledTimes(3));

    // 最後の pending promise を drain (vitest teardown hang 回避)。
    resolvers[2]?.(['c1', 'c2', 'c3']);
  });

  it('keeps frames=[] on extraction failure (poster-only fallback)', async () => {
    mockExtract.mockRejectedValueOnce(new Error('decode failed'));
    const { result } = renderHook(() =>
      useTweetVideoFrames('id7', URL_A, true),
    );
    expect(result.current).toEqual([]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toEqual([]);
  });
});
