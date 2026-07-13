import type { MockListing } from '../../data/housing/mockListings';
import { getTagById } from '../../data/housingTags';
import { formatHousingAddress } from './formatHousingAddress';
import { regionLabel, type RegionLocale } from '../../data/housing/regionMap';
import { katakanaReading } from '../../data/housing/dcServerMap';

type TFunc = (key: string) => string;

/**
 * listing 1件を「検索可能テキスト」(表示名を連結した小文字文字列) に変換する。
 * 対象: タイトル / 説明文 / 静的タグ(公式・季節・テーマ)の表示名 / 住所表示名 /
 *       サーバー名 / DC 名 / 地域表示名。個人タグ名はここには含めない (API 側で拾う)。
 */
export function buildListingSearchText(
  listing: MockListing,
  t: TFunc,
  lang: string,
  locale: RegionLocale,
): string {
  const parts: string[] = [];
  if (listing.title) parts.push(listing.title);
  if (listing.description) parts.push(listing.description);
  for (const id of listing.tags) {
    const tag = getTagById(id);        // 個人タグは undefined → skip
    if (tag) parts.push(t(tag.i18nKey));
  }
  parts.push(
    formatHousingAddress(
      {
        area: listing.area,
        ward: listing.ward,
        buildingType: listing.buildingType,
        plot: listing.plot,
        apartmentBuilding: listing.apartmentBuilding,
        roomNumber: listing.roomNumber,
      },
      lang,
    ),
  );
  parts.push(listing.server);
  parts.push(listing.dc);
  // 日本ワールド/DC はカタカナ読みでも検索可能に (略称は部分一致で自動対応)。
  const serverKana = katakanaReading(listing.server);
  if (serverKana) parts.push(serverKana);
  const dcKana = katakanaReading(listing.dc);
  if (dcKana) parts.push(dcKana);
  parts.push(regionLabel(listing.region, locale));
  return parts.join(' ').toLowerCase();
}

/**
 * 検索テキストがキーワードに一致するか。複数語は空白区切りで AND、大文字小文字無視の部分一致。
 * keyword が空 (trim 後 0 文字) なら常に true。
 */
export function matchesKeyword(searchText: string, keyword: string): boolean {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => searchText.includes(w));
}
