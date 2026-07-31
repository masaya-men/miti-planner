/**
 * WebP/AVIF → PNG 変換 (サーバー側、sharp使用)。
 *
 * satori (@vercel/og、OGPカード生成に使用) はWebP/AVIFを描画できない
 * (api/og/_housingerCard.ts の sniffSupportedImageMime 参照)。物件写真は
 * ブラウザ側でWebP優先圧縮されるため、OGPカードの代表作としてそのまま渡すと
 * 黙って読み飛ばされる。アップロード時にPNG派生版も並行保存し、OGP生成側は
 * WebP/AVIF由来のURLを見たら同じパスの .png 版を優先して使う (拡張子違いの
 * 兄弟ファイルのみ・Firestoreスキーマは変更しない)。
 */
import sharp from 'sharp';

const CONVERTIBLE_MIME = new Set(['image/webp', 'image/avif']);

/**
 * 物件写真のPNG派生版に使う長辺上限 (px)。OGPカードでの実際の表示サイズ
 * (HERO_SIZE=220px/GRID_THUMB=84px、api/og/_housingerCard.ts) より十分大きい値。
 * アップロード時 (_uploadThumbnailHandler.ts) とバックフィル
 * (scripts/backfill-listing-thumbnail-png.ts) の両方で同じ値を使う。
 */
export const LISTING_THUMBNAIL_PNG_MAX_DIMENSION = 480;

/**
 * PNG変換が必要な形式 (WebP/AVIF) なら変換したBufferを返す。
 * 既にsatori対応形式 (PNG/JPEG) なら null (変換不要)。
 * 変換自体が失敗した場合も null (呼び出し側は「派生版なし」として無視する・致命的にしない)。
 *
 * maxDimension: 指定時は長辺をこのpx以下に縮小してからPNG化する (小さければ拡大しない)。
 * PNGは非可逆圧縮のWebPより大幅にファイルサイズが増える (実測で長辺1920pxの物件写真が
 * 15〜20倍に膨れることを確認・2026-07-31)。OGPカードでの実際の表示サイズはHERO_SIZE=220px/
 * GRID_THUMB=84px (api/og/_housingerCard.ts) 程度なので、それより十分大きい480pxまで
 * 縮小しても表示品質に影響なく、ファイルサイズ・Storage容量・OGP生成時のfetch量を大きく削減できる。
 */
export async function convertToPngIfNeeded(
  buf: Buffer,
  mimeType: string,
  opts: { maxDimension?: number } = {},
): Promise<Buffer | null> {
  if (!CONVERTIBLE_MIME.has(mimeType)) return null;
  try {
    let img = sharp(buf);
    if (opts.maxDimension) {
      img = img.resize(opts.maxDimension, opts.maxDimension, { fit: 'inside', withoutEnlargement: true });
    }
    return await img.png().toBuffer();
  } catch (e) {
    console.error('[housing/_imageFormatConvert] webp/avif->png conversion failed (non-fatal):', e);
    return null;
  }
}
