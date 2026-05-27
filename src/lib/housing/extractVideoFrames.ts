/**
 * 2026-05-27 Allmarks (マイコラージュ) からハウジングへ移植。
 * X (Twitter) 動画カードの ambient slideshow に「3 フレーム抽出」 を供給する。
 *
 * 同 origin 必須: `src` は `/api/tweet-video?url=...` proxy を通すこと
 * (= canvas.toDataURL は tainted canvas で throw する)。
 */

/**
 * duration (秒) + fraction 配列 (0..1) から、 実際に seek する秒数を返す。
 * - 末尾 (= 黒い end-card) を避けるため 0.99 で clamp
 * - 短いクリップで丸めると同じ秒に重なるので dedup
 * - 昇順 sort (= 前方 seek のみで decoder を進める)
 * - 不正入力は []
 * 純関数。
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
 * 動画を seek して duration の所定 fraction で静止フレームを切り出す。
 * 出力は data URL (JPEG)、 board に出す解像度上限 (maxWidth) 内にスケール。
 *
 * 投げる: invalid src / unreadable duration / decode error / seek error。
 * 呼出側は throw を「このカードは poster only fallback」 と解釈する。
 */
export async function extractVideoFrames(opts: {
  readonly src: string;
  readonly fractions: readonly number[];
  readonly maxWidth?: number;
  readonly mimeType?: string;
  readonly quality?: number;
}): Promise<readonly string[]> {
  const {
    src,
    fractions,
    maxWidth = 640,
    mimeType = 'image/jpeg',
    quality = 0.7,
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
    // 抽出後に decode context を解放しないと、 連続抽出で Chromium 系が
    // GPU buffer を保持しっぱなしになる。
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      /* ignore — unmount race */
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
