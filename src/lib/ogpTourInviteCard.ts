/**
 * ツアー招待ページ (/housing/tour/:tourToken) 専用 OGP カード — URL 組み立て + 署名ヘルパー
 * 設計・署名方式は src/lib/ogpHousingerCard.ts と同型(HMAC-SHA256・パラメータ順固定)。
 * 背景画像はビルド時埋め込み(api/og/_tourInviteBg.generated.ts)のためパラメータは name のみ。
 */

import { hmacSha256Hex, timingSafeEqualHex } from './ogpSign.js';

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

async function signTourInviteOgCardParams(params: URLSearchParams, secret: string): Promise<string> {
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
