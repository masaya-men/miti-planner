/**
 * ハウジング物件ページ (/housing/listing/:id) 専用 OGP カード — URL 組み立て + 署名ヘルパー
 *
 * カード画像は `/api/og?type=listing&img=<写真URL>&sig=<HMAC>`(既存 Edge Function `/api/og` の
 * 拡張分岐、api/og/_listingCard.ts が担当)で生成する。新規 Serverless/Edge Function は増やさない。
 *
 * 設計・署名方式は src/lib/ogpTourInviteCard.ts / src/lib/ogpHousingerCard.ts と同型
 * (HMAC-SHA256(secret=process.env.CRON_SECRET) の先頭 24 hex・パラメータ順固定)。
 * Web Crypto (`crypto.subtle`) のみ使用(Node 18+/Edge 双方で動作・単体テストも Node で通る)。
 *
 * パラメータ順序(固定・sig を除く): type → ver → img。
 */

const SIG_PARAM = 'sig';
const CARD_VERSION = '1';
const SIG_HEX_LENGTH = 24;

export interface ListingOgCardInput {
  /** 物件の代表写真 URL(絶対 URL)。 */
  img: string;
}

export function buildListingOgCardParams(input: ListingOgCardInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'listing');
  params.set('ver', CARD_VERSION);
  params.set('img', input.img || '');
  return params;
}

function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sigBuf);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signListingOgCardParams(params: URLSearchParams, secret: string): Promise<string> {
  const fullHex = await hmacSha256Hex(secret, params.toString());
  return fullHex.slice(0, SIG_HEX_LENGTH);
}

export async function buildListingOgCardUrl(
  origin: string,
  input: ListingOgCardInput,
  secret: string,
): Promise<string> {
  const params = buildListingOgCardParams(input);
  const sig = await signListingOgCardParams(params, secret);
  params.set(SIG_PARAM, sig);
  return `${origin}/api/og?${params.toString()}`;
}

export async function verifyListingOgCardSig(searchParams: URLSearchParams, secret: string): Promise<boolean> {
  const sig = searchParams.get(SIG_PARAM);
  if (!sig) return false;
  const withoutSig = new URLSearchParams(searchParams);
  withoutSig.delete(SIG_PARAM);
  const expected = await signListingOgCardParams(withoutSig, secret);
  return timingSafeEqualHex(expected, sig);
}
