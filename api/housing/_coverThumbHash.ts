/**
 * 画像 Buffer から ThumbHash(base64・約40文字)を計算する。
 * カードのぼかしプレースホルダ(直接アップロード物件の代表画像のみ)に使う。
 * ThumbHash は最大 100px の縮小画像で計算する。失敗は throw せず null(呼び出し側は
 * 「ハッシュ無し = 従来どおり背景色」で続行する)。
 */
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';

export async function computeCoverThumbHash(buf: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buf)
      .resize(100, 100, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const hash = rgbaToThumbHash(info.width, info.height, data);
    return Buffer.from(hash).toString('base64');
  } catch (e) {
    console.error('[housing/_coverThumbHash] failed (non-fatal):', e);
    return null;
  }
}
