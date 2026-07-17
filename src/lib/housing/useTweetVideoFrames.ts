import { useEffect, useState } from 'react';
import { extractVideoFrames } from './extractVideoFrames';
import { buildTweetVideoProxyUrl } from './tweetVideoProxy';

/**
 * 2026-05-27 Allmarks (マイコラージュ) からハウジングへ移植。
 *
 * 動画カードの ambient slideshow に「3 フレーム抽出」 を供給する hook。
 * フレームは process-wide cache に乗るので、 スクロールで cull → 再 mount でも即返る。
 * 抽出は同時 1 件のみ (= MAX_CONCURRENT)、 残りは FIFO 待ち。
 * 失敗時は [] (= 呼出側で poster fallback)。
 *
 * 並行 1 の理由 (Allmarks コメント):
 *   hero 動画再生中に同時抽出 2 件走らせると GPU を 3 decoder で押し切って
 *   初回 scroll-in に 4K stutter が出た。 1 件ずつ = hero + 1 = 2 decoder に
 *   抑えて fill-rate 内に収める。 wall time は伸びるが「stutter」 ではなく
 *   「ゆっくり波及して揃う」 体感になる。
 */

/** 0% / 25% / 50%。 75% は dark / end-card frame を踏むので skip。 */
const SEEK_FRACTIONS = [0, 0.25, 0.5] as const;

/** プロセス全体で持つキャッシュ。 unmount/scroll-cull/re-mount を跨いで残る。
 *  ページ全リロードで消える (= in-memory by design)。 */
const frameCache = new Map<string, readonly string[]>();
/** 同 listing の二重抽出を排除 (drag preview などで同カード 2 個存在する場合)。 */
const inFlight = new Map<string, Promise<readonly string[]>>();

const MAX_CONCURRENT = 1;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (activeCount < MAX_CONCURRENT) {
      activeCount++;
      resolve();
    } else {
      waitQueue.push(() => {
        activeCount++;
        resolve();
      });
    }
  });
}

function releaseSlot(): void {
  activeCount = Math.max(0, activeCount - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/**
 * 単一の動画カードに 3 フレーム抽出を駆動する hook。
 * - enabled=false (= 画面外 / lightbox open) のときは抽出走らない (queue を圧迫しない)
 * - 抽出中・失敗は [] を返す (= 呼出側で poster fallback)
 * - 同タブ内では cache でほぼ即返る
 */
export function useTweetVideoFrames(
  listingId: string,
  videoUrl: string | undefined,
  enabled: boolean,
): readonly string[] {
  const [frames, setFrames] = useState<readonly string[]>(
    () => frameCache.get(listingId) ?? [],
  );

  useEffect(() => {
    // listingId/videoUrl が変わった直後、 まだこの listing 用の frames を確定
    // できない間は必ずここで空へ倒す。 呼び出し元 (TourLivingMedia 等) は
    // key を付けずに listing prop だけ差し替えるため、 この hook の内部 state
    // (frames) は listing が変わっても前の listing の値を保持したまま残る
    // (useState 初期化子は mount 時 1 回しか走らない)。 動画を持たない listing へ
    // 進んだときに一切 setFrames が呼ばれないと、 前の listing (動画あり) の
    // 抽出結果がそのまま描画され続ける「画像だけ前の家のまま固定される」 バグに
    // なる (2026-07-17 実機再現)。
    if (!videoUrl || !listingId) {
      setFrames([]);
      return;
    }
    const cached = frameCache.get(listingId);
    if (cached) {
      setFrames(cached);
      return;
    }
    // この listingId 用のキャッシュがまだ無い = 前の listing の frames を
    // 使い回してはいけないので即座にクリア (enabled=false でも実行する)。
    setFrames([]);
    if (!enabled) return;

    let cancelled = false;
    const proxied = buildTweetVideoProxyUrl(videoUrl);

    const existing = inFlight.get(listingId);
    const promise =
      existing ??
      (async (): Promise<readonly string[]> => {
        await acquireSlot();
        try {
          const out = await extractVideoFrames({
            src: proxied,
            fractions: SEEK_FRACTIONS,
          });
          frameCache.set(listingId, out);
          return out;
        } finally {
          releaseSlot();
          inFlight.delete(listingId);
        }
      })();
    if (!existing) inFlight.set(listingId, promise);

    promise
      .then((out) => {
        if (!cancelled) setFrames(out);
      })
      .catch(() => {
        /* poster-only fallback — frames は [] のまま */
      });

    return (): void => {
      cancelled = true;
    };
  }, [listingId, videoUrl, enabled]);

  return frames;
}

/** テスト専用: module-level cache + concurrency state をリセット。 */
export function __resetTweetVideoFramesForTests(): void {
  frameCache.clear();
  inFlight.clear();
  activeCount = 0;
  waitQueue.length = 0;
}
