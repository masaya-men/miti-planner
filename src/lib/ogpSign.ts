/**
 * OGP カード URL の署名(HMAC-SHA256)に使う共通部品。
 * api/ からも import される(api 側は .js 付きで読む)。
 */

/** Web Crypto の ArrayBuffer 結果を可読な hex 文字列にする。 */
export function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sigBuf);
}

/** 定数時間比較（タイミング攻撃対策。長さが違う時点で即 false = 長さ情報のみ漏れるが hex 固定長なので実害なし）。 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
