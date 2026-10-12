/**
 * HOUSING SNAP (housingsnap.com) の物件ページから「作者名」と「作者本人の X ポスト」を拾う純関数群。
 *
 * 背景 (2026-10-12): HOUSING SNAP のページは twitter:card="photo" (X で廃止済みの形式) を宣言しているため、
 * 新着ツイートの最後に HOUSING SNAP の URL を置いても X はカードを出せず、代わりに LoPo のカードが目立つ。
 * ページに作者本人の X ポストへのリンクが載っていることが多いので、それを引用先にして作者を目立たせる。
 * Firebase 非依存 (api/ と src/ の両方から使う)。
 */

/** X / Twitter のポスト URL を https://x.com/<user>/status/<id> に正規化する。ポストでなければ null。 */
export function normalizeXStatusUrl(url: string): string | null {
  const m = url.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

/** housingsnap.com/<数字> の物件ページ URL か (取りに行ってよい URL を限定する)。 */
export function isHousingSnapPostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /^(www\.)?housingsnap\.com$/.test(u.hostname) && /^\/\d+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 物件ページ HTML から作者名 (/?user=... のリンク文字) と作者の X ポスト (最初の status リンク) を拾う。 */
export function parseHousingSnapCreator(html: string): { postUrl: string | null; name: string | null } {
  if (typeof html !== 'string' || !html) return { postUrl: null, name: null };
  let postUrl: string | null = null;
  // 共有ボタン (twitter.com/intent/tweet) は status を含まないので normalizeXStatusUrl で自然に除外される
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const normalized = normalizeXStatusUrl(decodeEntities(m[1]));
    if (normalized) { postUrl = normalized; break; }
  }
  const nameMatch = html.match(/href="\/\?user=[^"]*"[^>]*>([^<]{1,60})</);
  const name = nameMatch ? decodeEntities(nameMatch[1]).trim() || null : null;
  return { postUrl, name };
}
