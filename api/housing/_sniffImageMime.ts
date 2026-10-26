/**
 * アップロード画像の先頭バイトから実際の形式を判定する (申告 mimeType との突き合わせ用)。
 * 対応: PNG / JPEG / WebP / AVIF。それ以外 (SVG など) は null。
 */
export function sniffUploadImageMime(buf: Uint8Array): string | null {
  const b = buf;
  const at = (i: number, s: string) =>
    b.length >= i + s.length && Array.from(s).every((c, k) => b[i + k] === c.charCodeAt(0));
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (at(4, 'ftyp') && (at(8, 'avif') || at(8, 'avis'))) return 'image/avif';
  return null;
}
