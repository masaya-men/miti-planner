/**
 * 新着ツイート下書き用: HOUSING SNAP の物件ページを取りに行き、作者名と作者本人の X ポストを拾う。
 * 背景と解析ロジックは src/lib/housing/housingSnapCreator.ts。
 *
 * 呼び出し元 (_registerListingHandler) は登録レスポンス前にこれを await するため、短いタイムアウトで打ち切る
 * (Discord 送信の 5 秒と合わせても関数の制限時間に収める)。失敗は常に「見つからなかった」扱いで投げない。
 */
import { isHousingSnapPostUrl, parseHousingSnapCreator } from '../../src/lib/housing/housingSnapCreator.js';

const TIMEOUT_MS = 2500;

export async function fetchHousingSnapCreator(postUrl: string): Promise<{ postUrl: string | null; name: string | null }> {
  const none = { postUrl: null, name: null };
  // 取りに行くのは housingsnap.com/<数字> だけ (任意 URL への fetch を許さない)
  if (!isHousingSnapPostUrl(postUrl)) return none;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(postUrl, { signal: ac.signal, redirect: 'error', headers: { 'User-Agent': 'LoPoBot/1.0 (+https://lopoly.app/about)' } });
    if (!resp.ok) return none;
    return parseHousingSnapCreator(await resp.text());
  } catch (err) {
    console.warn('[housing/register-listing] housingsnap creator lookup failed:', err);
    return none;
  } finally {
    clearTimeout(timer);
  }
}
