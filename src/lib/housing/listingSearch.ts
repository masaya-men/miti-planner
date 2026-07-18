import type { MockListing } from '../../data/housing/mockListings';
import { getTagById } from '../../data/housingTags';
import { formatHousingAddress } from './formatHousingAddress';
import { regionLabel, type RegionLocale } from '../../data/housing/regionMap';
import { katakanaReading } from '../../data/housing/dcServerMap';
import { searchNamesFor } from './housingTerms';

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
  // unlisted は住所系フィールドが射影で欠落している (窓口が落とす)。
  // 住所/server/dc/region を push すると undefined 由来のゴミが混じり、かつ
  // 住所が検索対象になってしまう。§8.6 の「場所では出ない・キーワード/タグでは出る」に合わせ、
  // 住所系はここで丸ごと skip する (title/description/静的タグは上で push 済)。
  if (listing.visibility !== 'unlisted' && listing.area !== undefined && listing.ward !== undefined) {
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
    const server = listing.server ?? '';
    const dc = listing.dc ?? '';
    if (server) parts.push(server);
    if (dc) parts.push(dc);
    // KR/CN は世界名が JP ワールドと衝突しうる (例: Carbuncle は Elemental(JP) と Korea 両方に存在)。
    // JP_KATAKANA_READINGS は JP ワールドのみを想定した名前引きのため、KR/CN では引かない。
    const cnkr = listing.region === 'KR' || listing.region === 'CN';
    // 日本ワールド/DC はカタカナ読みでも検索可能に (略称は部分一致で自動対応)。
    const serverKana = cnkr ? null : katakanaReading(server);
    if (serverKana) parts.push(serverKana);
    const dcKana = cnkr ? null : katakanaReading(dc);
    if (dcKana) parts.push(dcKana);
    // 辞書名でも検索可能に (ko/zh/en)。ja は KR の慣用カタカナ誤爆 (spec §5) だけでなく
    // 西洋ワールド (例: Gilgamesh→ギルガメッシュ) にも波及するため、常に含めない。
    for (const n of searchNamesFor('world', server)) parts.push(n);
    for (const n of searchNamesFor('dc', dc)) parts.push(n);
    if (listing.region !== undefined) parts.push(regionLabel(listing.region, locale));
  }
  return parts.join(' ').toLowerCase();
}

/** カタカナをひらがなに正規化 (ひらがな入力でもカタカナ読みにヒットさせる)。 */
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * 検索テキストがキーワードに一致するか。複数語は空白区切りで AND、大文字小文字無視の部分一致。
 * カタカナ/ひらがなは区別しない (「まな」でも「マナ」でもヒット)。keyword が空なら常に true。
 */
export function matchesKeyword(searchText: string, keyword: string): boolean {
  const normText = toHiragana(searchText);
  const words = toHiragana(keyword.trim().toLowerCase()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => normText.includes(w));
}
