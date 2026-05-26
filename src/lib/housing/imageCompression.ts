/**
 * ハウジング物件サムネ画像の クライアント側 圧縮 / リサイズ / EXIF 削除。
 *
 * 設計判断 (2026-05-26):
 * - 長辺 1920px (= 1080p) にリサイズ。 詳細画面の画像エリア (CSS 700-900px、 retina 物理 1400-1800px) に対応。
 * - 出力フォーマット: **WebP 固定**。 AVIF はブラウザの canvas.toBlob が 2026 年現在
 *   どのブラウザでも未対応のため、 クライアント側 encode 不可。 Twitter/Instagram/Pinterest
 *   も同じ理由でクライアント WebP + サーバー側 AVIF 変換が業界スタンダード。
 *   サーバー側 AVIF 変換は β 以降の TODO (Vercel Functions + sharp)。
 * - quality 0.75 で約 100-200KB に収まる業界スイートスポット。
 * - browser-image-compression は内部で EXIF を自動削除する (orientation のみ保持して回転反映)。
 * - useWebWorker:true でメインスレッドをブロックしない (大画像でも UI 凍結回避)。
 */
import imageCompression from 'browser-image-compression';

const TARGET_MAX_WIDTH_OR_HEIGHT = 1920;
const TARGET_QUALITY = 0.75;
const SERVER_MAX_BYTES = 1 * 1024 * 1024; // backend 側 1MB 上限と合わせる
const OUTPUT_TYPE = 'image/webp';

export interface CompressedImage {
  /** pure base64 (data URL prefix 抜き) */
  base64: string;
  /** 'image/avif' | 'image/webp' */
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
 * - 出力: 長辺 1920px、 100-200KB 程度の WebP の base64 + mimeType
 */
export async function compressHousingImage(file: File): Promise<CompressedImage> {
  const compressed = await imageCompression(file, {
    maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024),
    maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: OUTPUT_TYPE,
    initialQuality: TARGET_QUALITY,
  });

  // 結果が 1MB を超える場合は再度品質を下げて圧縮
  let final = compressed;
  if (final.size > SERVER_MAX_BYTES) {
    final = await imageCompression(file, {
      maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024) * 0.9,
      maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: OUTPUT_TYPE,
      initialQuality: 0.4,
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
