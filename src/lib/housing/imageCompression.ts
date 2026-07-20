/**
 * ハウジング物件サムネ画像の クライアント側 圧縮 / リサイズ / EXIF 削除。
 *
 * 設計判断 (2026-05-26):
 * - 長辺 1920px (= 1080p) にリサイズ。 詳細画面の画像エリア (CSS 700-900px、 retina 物理 1400-1800px) に対応。
 * - 出力フォーマット: **WebP 優先**。 AVIF はブラウザの canvas.toBlob が 2026 年現在
 *   どのブラウザでも未対応のため、 クライアント側 encode 不可。 Twitter/Instagram/Pinterest
 *   も同じ理由でクライアント WebP + サーバー側 AVIF 変換が業界スタンダード。
 *   サーバー側 AVIF 変換は β 以降の TODO (Vercel Functions + sharp)。
 * - quality 0.75 で約 100-200KB に収まる業界スイートスポット。
 * - browser-image-compression は内部で EXIF を自動削除する (orientation のみ保持して回転反映)。
 * - useWebWorker:true でメインスレッドをブロックしない (大画像でも UI 凍結回避)。
 *
 * 修正 (2026-07-20、 実利用中に発覚した画質バグ3件への対応):
 * - `alwaysKeepResolution: true` を指定。 未指定 (既定 false) だと `browser-image-compression` は
 *   maxSizeMB に収まらない場合 quality だけでなく **解像度そのもの**を段階的に縮めるため、
 *   複雑な画像が数百px四方まで極小化する事故が実データで確認された。 quality を主レバーにする。
 * - WebP 非対応ブラウザ (古い Safari 等) では `canvas.toBlob` が仕様上 PNG に無言フォールバックする。
 *   PNG は可逆形式で quality パラメータが効かず (写真圧縮が苦手・のちの再圧縮でも縮まない)、
 *   結果的に 1MB 上限を超えてサーバーに 413 で拒否される (カバー画像消失の実例と一致)。
 *   事前に canvas の WebP encode 対応を feature-detect し、 非対応なら JPEG (quality 可変・
 *   ほぼ全ブラウザ対応) にフォールバックする。
 */
import imageCompression from 'browser-image-compression';

const TARGET_MAX_WIDTH_OR_HEIGHT = 1920;
const TARGET_QUALITY = 0.75;
const SERVER_MAX_BYTES = 1 * 1024 * 1024; // backend 側 1MB 上限と合わせる
const PREFERRED_OUTPUT_TYPE = 'image/webp';
const FALLBACK_OUTPUT_TYPE = 'image/jpeg';

let cachedWebpSupport: boolean | undefined;

/** canvas.toBlob/toDataURL が WebP encode に対応しているかを feature-detect する (結果はキャッシュ)。 */
function supportsWebpEncoding(): boolean {
  if (cachedWebpSupport !== undefined) return cachedWebpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    cachedWebpSupport = canvas.toDataURL(PREFERRED_OUTPUT_TYPE).startsWith('data:image/webp');
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

export interface CompressedImage {
  /** pure base64 (data URL prefix 抜き) */
  base64: string;
  /** 'image/webp' | 'image/jpeg' (WebP encode 非対応ブラウザは jpeg にフォールバック) */
  mimeType: string;
  /** 圧縮後の Blob/File、 プレビュー用 */
  file: File;
  /** デバッグ表示用 */
  originalBytes: number;
  compressedBytes: number;
}

/**
 * File を リサイズ + 圧縮 + base64 化する。
 * - 入力: ユーザーが <input type="file"> で選択した画像 (JPEG/PNG/HEIC/WebP/AVIF)
 * - 出力: 長辺 1920px、 100-200KB 程度の WebP (非対応ブラウザは JPEG) の base64 + mimeType
 */
export async function compressHousingImage(file: File): Promise<CompressedImage> {
  const outputType = supportsWebpEncoding() ? PREFERRED_OUTPUT_TYPE : FALLBACK_OUTPUT_TYPE;

  const compressed = await imageCompression(file, {
    maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024),
    maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: outputType,
    initialQuality: TARGET_QUALITY,
    alwaysKeepResolution: true,
  });

  // 結果が 1MB を超える場合は再度品質を下げて圧縮 (解像度はまだ維持)
  let final = compressed;
  if (final.size > SERVER_MAX_BYTES) {
    final = await imageCompression(file, {
      maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024) * 0.9,
      maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: outputType,
      initialQuality: 0.4,
      alwaysKeepResolution: true,
    });
  }

  // 最終手段: quality 側だけでは極端な画像 (異常に複雑/高解像度な原本) が 1MB を割らないことがある。
  // ここで初めて解像度縮小も許容し、 サーバーの 413 (too_large) 拒否 = 画像消失を確実に防ぐ。
  if (final.size > SERVER_MAX_BYTES) {
    final = await imageCompression(file, {
      maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024) * 0.9,
      maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: outputType,
      initialQuality: 0.2,
      alwaysKeepResolution: false,
    });
  }

  const dataUrl = await imageCompression.getDataUrlFromFile(final);
  // 'data:image/webp;base64,xxxx' → 'xxxx'
  const base64 = dataUrl.split(',')[1] ?? '';

  return {
    base64,
    mimeType: final.type,
    file: final,
    originalBytes: file.size,
    compressedBytes: final.size,
  };
}
