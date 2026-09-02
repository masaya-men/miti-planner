/**
 * OGP カード生成で外部画像 URL を安全に取り込む共有ヘルパー。
 * api/og/_housingerCard.ts / api/og/_listingCard.ts の両方から使う。
 *
 * satori (@vercel/og) は WebP/AVIF 非対応で、渡すとレンダリングが空 PNG になる実バグがあるため
 * (2026-07-17 実測)、先頭バイトのマジックナンバーで PNG/JPEG/GIF のみ通す。
 * content-type は CDN によって不正確なことがあるため実バイトで判定する。
 *
 * レンダリング中の画像 fetch 失敗は ImageResponse 生成後の非同期ストリーム内で起きて
 * try/catch で捕捉できないため、要素ツリーに渡す前に必ずここで data URI 化しておくこと。
 */

/** 画像1枚あたりの取得タイムアウト(外部SNS画像等が遅い/無応答でもカード生成全体を巻き込まない)。 */
export const IMAGE_FETCH_TIMEOUT_MS = 4000;
/** 異常に大きい画像レスポンスを弾く上限(OGP用途でここまでのサイズは不要)。 */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** ArrayBuffer → base64 文字列(edge runtime に `Buffer` は無いため `btoa` + チャンク処理で実装)。 */
export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000; // 32KB刻み(String.fromCharCode の引数上限を避けるため一括展開しない)
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * 先頭バイトのマジックナンバーから satori が扱える画像形式か判定する。
 * satori (@vercel/og) は WebP/AVIF 非対応で、渡すとレンダリングが
 * 「TypeError: u2 is not iterable」で落ちて空の 200 PNG が返る実バグを踏んだ
 * (2026-07-17 実測・Firebase Storage のアバターが image/webp)。
 * content-type は CDN によって不正確なことがあるため、実バイトで判定する。
 */
export function sniffSupportedImageMime(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  return null; // WebP (RIFF....WEBP) / AVIF / その他は satori 非対応なので除外
}

/**
 * 画像 URL を fetch して base64 data URI 化する。失敗(ネットワークエラー・非2xx・
 * satori 非対応形式 (WebP等)・タイムアウト・サイズ超過)時は null を返す
 * (呼び出し側は「画像無し」として扱う = アバターならプレースホルダ・一覧画像なら省く)。
 */
export async function fetchAsDataUri(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > IMAGE_MAX_BYTES) return null;
    const mime = sniffSupportedImageMime(buf);
    if (!mime) return null;
    return `data:${mime};base64,${arrayBufferToBase64(buf)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
