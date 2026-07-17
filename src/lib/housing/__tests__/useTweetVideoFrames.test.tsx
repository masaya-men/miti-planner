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
    // 開発機の .env.local (VITE_MEDIA_PROXY_BASE_URL) に左右されないよう「未設定」を固定
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', '');
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

  // 回帰テスト: ツアー左パネルの「画像だけ前の家のまま固定される」バグ再現。
  // TourLivingMedia は同一コンポーネントインスタンスのまま listing prop だけが
  // 差し替わる (key なし・再マウントされない)。動画持ちの家を表示 → 抽出完了後、
  // 次に動画を持たない家へ進んだとき、この hook の内部 state (frames) が古い
  // 抽出結果のまま残ってはいけない。
  it('resets frames to [] when navigating from a video listing to one without a video (stuck-image regression)', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c']);
    const { result, rerender } = renderHook(
      ({ id, url }: { id: string; url: string | undefined }) =>
        useTweetVideoFrames(id, url, true),
      { initialProps: { id: 'video-listing', url: URL_A as string | undefined } },
    );
    await waitFor(() => expect(result.current).toEqual(['a', 'b', 'c']));

    // ツアーが次の家 (動画なし) へ進む
    rerender({ id: 'no-video-listing', url: undefined });

    expect(result.current).toEqual([]);
  });

  it('resets frames to [] when navigating to a different (not-yet-cached) video listing', async () => {
    mockExtract.mockResolvedValueOnce(['a', 'b', 'c']);
    const { result, rerender } = renderHook(
      ({ id, url }: { id: string; url: string | undefined }) =>
        useTweetVideoFrames(id, url, true),
      { initialProps: { id: 'video-listing-a', url: URL_A as string | undefined } },
    );
    await waitFor(() => expect(result.current).toEqual(['a', 'b', 'c']));

    let resolveB: ((v: readonly string[]) => void) | undefined;
    mockExtract.mockImplementationOnce(
      () => new Promise<readonly string[]>((resolve) => { resolveB = resolve; }),
    );
    rerender({ id: 'video-listing-b', url: URL_B as string | undefined });

    // 抽出完了前は空 (前の家 A のフレームが見えてはいけない)
    expect(result.current).toEqual([]);

    // acquireSlot() の resolve が microtask を挟むため、 extractVideoFrames が
    // 実際に呼ばれる (= resolveB が代入される) までポーリングで待つ。
    await waitFor(() => expect(resolveB).toBeDefined());
    await act(async () => {
      resolveB?.(['x', 'y', 'z']);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current).toEqual(['x', 'y', 'z']));
  });
});
