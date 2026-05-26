/**
 * ハウジング物件サムネ画像の クライアント側 圧縮 / リサイズ / EXIF 削除。
 *
 * 設計判断 (2026-05-26):
 * - 長辺 1920px (= 1080p) にリサイズ。 詳細画面の画像エリア (CSS 700-900px、 retina 物理 1400-1800px) に対応。
 * - AVIF を第一選択、 非対応ブラウザは WebP fallback。
 * - quality 0.6 (AVIF) で約 100-200KB に収まる想定。
 * - browser-image-compression は内部で EXIF を自動削除する (orientation のみ保持して回転反映)。
 * - useWebWorker:true でメインスレッドをブロックしない (大画像でも UI 凍結回避)。
 */
import imageCompression from 'browser-image-compression';

const TARGET_MAX_WIDTH_OR_HEIGHT = 1920;
// 2026-05-26 ユーザーフィードバック: 0.6 だと画質が下がりすぎ (虹色アーティファクト)、
// 0.75 に引き上げ。 1080p AVIF/WebP で 100-200KB に収まる業界スイートスポット。
const TARGET_QUALITY = 0.75;
const SERVER_MAX_BYTES = 1 * 1024 * 1024; // backend 側 1MB 上限と合わせる

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
 * AVIF サポート検出。
 *
 * 2026-05-26: 旧実装は truncated base64 AVIF を使っていて WebP に fallback してしまっていた。
 * Image() に短い valid AVIF を load させて onload/onerror で判定する堅牢版に置き換え。
 * Chrome 85+ / Edge 85+ / Firefox 93+ / Safari 16+ で AVIF 対応 (2026 年 95%+ 普及)。
 */
async function detectAvifSupport(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  // 1x1 transparent AVIF (validated minimal AVIF, 76 bytes)
  const AVIF_1x1 =
    'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAEOAAEAAAAdAAAAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAGppcHJwAAAASGlwY28AAAAUaXNwZQAAAAAAAAABAAAAAQAAABBwYXNwAAAAAQAAAAEAAAAUYXYxQ4EgAAAKBzgABpAQ0AIAAAAQcGl4aQAAAAADCAgIAAAAF2lwbWEAAAAAAAAAAQABBIECgwQAAAAlbWRhdAoHOAAGkBDQAjITFkAAAEgAAAB52TCi6P4UAFUAUVUA';
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width === 1 && img.height === 1);
    img.onerror = () => resolve(false);
    img.src = AVIF_1x1;
  });
}

let _avifSupport: Promise<boolean> | null = null;
function getAvifSupport() {
  if (!_avifSupport) _avifSupport = detectAvifSupport();
  return _avifSupport;
}

/**
 * File を リサイズ + 圧縮 + base64 化する。
 * - 入力: ユーザーが <input type="file"> で選択した画像 (JPEG/PNG/HEIC/WebP/AVIF)
 * - 出力: 長辺 1920px、 100-200KB 程度の AVIF or WebP の base64 + mimeType
 */
export async function compressHousingImage(file: File): Promise<CompressedImage> {
  const avifOk = await getAvifSupport();
  const targetType = avifOk ? 'image/avif' : 'image/webp';

  const compressed = await imageCompression(file, {
    maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024),
    maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: targetType,
    initialQuality: TARGET_QUALITY,
  });

  // 結果が 1MB を超える場合は再度品質を下げて圧縮
  let final = compressed;
  if (final.size > SERVER_MAX_BYTES) {
    final = await imageCompression(file, {
      maxSizeMB: SERVER_MAX_BYTES / (1024 * 1024) * 0.9,
      maxWidthOrHeight: TARGET_MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: targetType,
      initialQuality: 0.4,
    });
  }

  const dataUrl = await imageCompression.getDataUrlFromFile(final);
  // 'data:image/avif;base64,xxxx' → 'xxxx'
  const base64 = dataUrl.split(',')[1] ?? '';

  return {
    base64,
    mimeType: final.type,
    file: final,
    originalBytes: file.size,
    compressedBytes: final.size,
  };
}
