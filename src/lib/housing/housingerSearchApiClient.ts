/**
 * /api/housing?action=search-housingers クライアント。
 * ヘッダー検索窓 (AppHeader.tsx) のハウジンガー名サジェスト専用
 * (探すページ「ハウジンガー」チップ一覧の全件取得 = publishedHousingers.ts の直接読みとは別経路。
 *  こちらは検索キーワード単位のサーバーサイド前方一致検索 + rate limit を要するため API 経由)。
 */
import { buildHousingHeaders } from '../housingAuthHeaders';
import type { PublishedHousinger } from './publishedHousingers';

export async function searchPublishedHousingers(query: string): Promise<PublishedHousinger[]> {
  const headers = await buildHousingHeaders(false);
  const res = await fetch(`/api/housing?action=search-housingers&q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(`search-housingers failed: ${res.status}`);
  const body = (await res.json()) as { housingers: PublishedHousinger[] };
  return body.housingers;
}
