/**
 * 動画 (mp4) から指定 fraction の静止フレームを canvas 経由で抽出する
 * (2026-05-26 新設、 Allmarks `lib/board/extract-video-frames.ts` を LoPo に移植)。
 *
 * 用途: ハウジング登録モーダルで Twitter 動画ツイートが入力されたとき、
 * 動画の 0% / 25% / 50% 地点の静止画 3 枚を取り出して既存
 * `localImages` (CompressedImage[]) に push する。
 *
 * 同一 origin 必須 (落とし穴 d):
 *   `canvas.toDataURL()` は tainted canvas で throw する。 元の `video.twimg.com`
 *   を src に直接指定すると CORS で tainted 扱いになる。 LoPo では必ず
 *   `/api/tweet-video?url=<encoded>` (= 同一 origin proxy) を src に渡すこと。
 *
 * LoPo 統一値 (Allmarks 640px JPEG 0.7 → LoPo 1920px WebP 0.75):
 *   `imageCompression` (browser-image-compression) と同じ長辺 1920px、 WebP 0.75。
 *   これで詳細画面 retina (CSS 700-900px × DPR 2-3 = 1400-2700px) もカバー。
 */

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MIME_TYPE = 'image/webp';
const DEFAULT_QUALITY = 0.75;

export interface ExtractVideoFramesOptions {
    readonly src: string;
    readonly fractions: readonly number[];
    readonly maxWidth?: number;
    readonly mimeType?: string;
    readonly quality?: number;
}

/**
 * duration × fractions[] を 0.01s 精度に丸めて重複排除し、 昇順 sort する。
 * - fractions は 0..1 想定、 0.99 で clamp (= 末尾の dark/end-card frame 回避)
 * - 短い動画で 25% と 50% が同じ秒数に丸まる場合は 1 つに dedup
 * 純関数 (test 対象)。
 */
export function computeSeekSeconds(
    duration: number,
    fractions: readonly number[],
): readonly number[] {
    if (!Number.isFinite(duration) || duration <= 0) return [];
    const seen = new Set<number>();
    const out: number[] = [];
    for (const f of fractions) {
        if (!Number.isFinite(f)) continue;
        const clamped = Math.max(0, Math.min(f, 0.99));
        const s = Math.round(clamped * duration * 100) / 100;
        if (!seen.has(s)) {
            seen.add(s);
            out.push(s);
        }
    }
    return out.sort((a, b) => a - b);
}

/**
 * 動画から fractions の各地点の静止フレームを抽出する。
 * 同一 origin の src 必須 (詳細は上記 docstring)。
 * 失敗時は throw (caller は poster-only fallback で対応)。
 */
export async function extractVideoFrames(
    opts: ExtractVideoFramesOptions,
): Promise<readonly string[]> {
    const {
        src,
        fractions,
        maxWidth = DEFAULT_MAX_WIDTH,
        mimeType = DEFAULT_MIME_TYPE,
        quality = DEFAULT_QUALITY,
    } = opts;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = src;

    try {
        await waitForEvent(video, 'loadedmetadata');
        const seconds = computeSeekSeconds(video.duration, fractions);
        if (seconds.length === 0) throw new Error('no extractable frames');

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw <= 0 || vh <= 0) throw new Error('no video dimensions');

        const canvas = document.createElement('canvas');
        const scale = vw > maxWidth ? maxWidth / vw : 1;
        canvas.width = Math.max(1, Math.round(vw * scale));
        canvas.height = Math.max(1, Math.round(vh * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');

        const frames: string[] = [];
        for (const s of seconds) {
            await seekTo(video, s);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL(mimeType, quality));
        }
        return frames;
    } finally {
        // GPU/CPU の decode buffer を解放 (連続抽出での decode context 積み上がり防止)
        video.removeAttribute('src');
        try {
            video.load();
        } catch {
            /* unmount race は無視 */
        }
    }
}

function waitForEvent(video: HTMLVideoElement, event: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const onOk = (): void => {
            cleanup();
            resolve();
        };
        const onErr = (): void => {
            cleanup();
            reject(new Error(`video ${event} failed`));
        };
        const cleanup = (): void => {
            video.removeEventListener(event, onOk);
            video.removeEventListener('error', onErr);
        };
        video.addEventListener(event, onOk, { once: true });
        video.addEventListener('error', onErr, { once: true });
    });
}

function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const onSeeked = (): void => {
            cleanup();
            resolve();
        };
        const onErr = (): void => {
            cleanup();
            reject(new Error('seek failed'));
        };
        const cleanup = (): void => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onErr);
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onErr, { once: true });
        video.currentTime = seconds;
    });
}
