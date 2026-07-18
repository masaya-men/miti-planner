/**
 * ツアー招待ページ (/housing/tour/:tourToken) 専用 OGP カード — URL 組み立て + 署名ヘルパー
 * 設計・署名方式は src/lib/ogpHousingerCard.ts と同型(HMAC-SHA256・パラメータ順固定)。
 * 背景画像はビルド時埋め込み(api/og/_tourInviteBg.generated.ts)のためパラメータは name のみ。
 */

const SIG_PARAM = 'sig';
const CARD_VERSION = '1';
const SIG_HEX_LENGTH = 24;

export interface TourInviteOgCardInput {
  /** 幹事が招待発行時に書いた短い文章。空文字/未指定可。 */
  name: string;
}

export function buildTourInviteOgCardParams(input: TourInviteOgCardInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'tour');
  params.set('ver', CARD_VERSION);
  params.set('name', input.name || '');
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

export async function signTourInviteOgCardParams(params: URLSearchParams, secret: string): Promise<string> {
  const fullHex = await hmacSha256Hex(secret, params.toString());
  return fullHex.slice(0, SIG_HEX_LENGTH);
}

export async function buildTourInviteOgCardUrl(
  origin: string,
  input: TourInviteOgCardInput,
  secret: string,
): Promise<string> {
  const params = buildTourInviteOgCardParams(input);
  const sig = await signTourInviteOgCardParams(params, secret);
  params.set(SIG_PARAM, sig);
  return `${origin}/api/og?${params.toString()}`;
}

export async function verifyTourInviteOgCardSig(searchParams: URLSearchParams, secret: string): Promise<boolean> {
  const sig = searchParams.get(SIG_PARAM);
  if (!sig) return false;
  const withoutSig = new URLSearchParams(searchParams);
  withoutSig.delete(SIG_PARAM);
  const expected = await signTourInviteOgCardParams(withoutSig, secret);
  return timingSafeEqualHex(expected, sig);
}
