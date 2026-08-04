/**
 * ハウジングタグマスタ
 *
 * 計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md
 *
 * - 4 kind 構成: 公式 (official) 23 / 季節 (season) 12 / テーマ (theme) 12 / 初心者 (beginner) 1。
 *   旧 6 カテゴリ約 147 タグ (taste/scene/season/environment/structure/other) は引退。
 *   (個人 (personal) kind は 2026-08-04 に廃止済み。 詳細は次項)
 * - 公式・季節・テーマは静的レジストリ (このファイル)。 個人タグ (`personal` kind) は
 *   2026-08-04 に概念ごと廃止 (計画書: docs/superpowers/plans/2026-08-04-housing-tag-search-by-owner.md)。
 *   ハウジンガー名検索は Firestore `housing_profiles` + `listing.ownerUid` の直接判定に一本化され、
 *   個人タグを動的管理していた `personal_tags` コレクションと `PERSONAL_TAG_LIMIT_PER_USER` は
 *   ともに削除済み。 `personal_` prefix 自体は探すページのフィルター状態が使う擬似 ID として
 *   引き続き存在する (isPersonalTagIdFormat / PERSONAL_TAG_ID_PREFIX 参照)。
 * - id は kind ごとに prefix 統一 (`official_` / `season_` / `theme_` / `personal_`)。
 * - i18nKey 経由で 4 言語表示 (実訳は src/locales/{ja,en,ko,zh}.json)。
 * - kind の一覧・表示順は HOUSING_TAG_KINDS (このファイル) から導出する。
 *   コンポーネント側で kind 名の switch/if-chain を書かず、 この配列を map する設計にすること
 *   (将来 kind を増やすときは、 ここに 1 エントリ足す + ロケール追加だけで済む構造)。
 * - 公式タグ 23 種の EN 表記はゲーム内正式名そのまま (意訳禁止・出典:
 *   https://ffxiv.consolegameswiki.com/wiki/Estate_Tags)。 JA/KO/ZH は公式ソース照合が必要。
 */

export const HOUSING_TAG_KINDS = ['official', 'season', 'theme', 'beginner'] as const;
export type HousingTagKind = typeof HOUSING_TAG_KINDS[number];

/**
 * 静的レジストリを持つ kind。 2026-08-04 に personal kind が廃止されたため、 現時点では
 * HOUSING_TAG_KINDS と内容が一致する (将来また動的管理の kind が増えたときのために
 * 別の配列として残す)。
 */
export const STATIC_HOUSING_TAG_KINDS = ['official', 'season', 'theme', 'beginner'] as const;
export type StaticHousingTagKind = typeof STATIC_HOUSING_TAG_KINDS[number];

export interface HousingTag {
  id: string;
  kind: HousingTagKind;
  i18nKey: string;
}

const t = (id: string, kind: StaticHousingTagKind): HousingTag => ({
  id,
  kind,
  i18nKey: `housing.tag.${id}`,
});

/**
 * 公式 23 (ゲーム内「ハウスアピール」)。 表記はゲーム内の正式名そのまま (意訳・「◯◯系」化禁止)。
 * EN 出典: https://ffxiv.consolegameswiki.com/wiki/Estate_Tags
 */
const OFFICIAL_TAGS: readonly HousingTag[] = [
  t('official_emporium', 'official'),
  t('official_boutique', 'official'),
  t('official_designer_home', 'official'),
  t('official_message_book', 'official'),
  t('official_tavern', 'official'),
  t('official_eatery', 'official'),
  t('official_visitors_welcome', 'official'),
  t('official_under_renovation', 'official'),
  t('official_immersive_experience', 'official'),
  t('official_aquarium', 'official'),
  t('official_sanctum', 'official'),
  t('official_cafe', 'official'),
  t('official_florist', 'official'),
  t('official_library', 'official'),
  t('official_atelier', 'official'),
  t('official_bathhouse', 'official'),
  t('official_garden', 'official'),
  t('official_bakery', 'official'),
  t('official_concert_hall', 'official'),
  t('official_venue', 'official'),
  t('official_photo_studio', 'official'),
  t('official_haunted_house', 'official'),
  t('official_far_eastern', 'official'),
];

/**
 * 季節 12。 現実世界の文言を採用する (FF14 イベント名にしない)。
 * 旧レジストリの同名 id (season カテゴリ) から re-prefix、 4 言語訳は既存を再利用。
 * 削除: cherry_blossom / autumn_leaves / snow / beach / starlight / guardian_day / matsuri / illumination
 */
const SEASON_TAGS: readonly HousingTag[] = [
  t('season_spring', 'season'),
  t('season_summer', 'season'),
  t('season_autumn', 'season'),
  t('season_winter', 'season'),
  t('season_new_year', 'season'),
  t('season_valentine', 'season'),
  t('season_hinamatsuri', 'season'),
  t('season_easter', 'season'),
  t('season_tanabata', 'season'),
  t('season_summer_festival', 'season'),
  t('season_halloween', 'season'),
  t('season_christmas', 'season'),
];

/**
 * テーマ 12。 botanical のみ新規、 他は旧レジストリの id を re-prefix (4 言語訳は既存を再利用)。
 */
const THEME_TAGS: readonly HousingTag[] = [
  t('theme_wafu', 'theme'),
  t('theme_wamodern', 'theme'),
  t('theme_modern', 'theme'),
  t('theme_natural', 'theme'),
  t('theme_antique', 'theme'),
  t('theme_gothic', 'theme'),
  t('theme_marchen', 'theme'),
  t('theme_cyberpunk', 'theme'),
  t('theme_fantasy', 'theme'),
  t('theme_gimmick', 'theme'),
  t('theme_ruins', 'theme'),
  t('theme_botanical', 'theme'),
];

/**
 * 初心者タグ (1 件のみ)。 自己申告で「まだ不慣れです」を可視化するタグ。
 * 公式/季節/テーマとは性質が異なる自己申告カテゴリのため kind を分けている。
 */
const BEGINNER_TAGS: readonly HousingTag[] = [
  t('beginner_sprout', 'beginner'),
];

/** 静的タグ全件 (公式23 + 季節12 + テーマ12 + 初心者1 = 48)。 個人タグはここに含まれない。 */
export const HOUSING_TAGS: readonly HousingTag[] = [
  ...OFFICIAL_TAGS,
  ...SEASON_TAGS,
  ...THEME_TAGS,
  ...BEGINNER_TAGS,
];

export function getTagsByKind(kind: StaticHousingTagKind): HousingTag[] {
  return HOUSING_TAGS.filter((tag) => tag.kind === kind);
}

/** 静的レジストリ (公式/季節/テーマ) に存在する id か。 個人タグ id はここでは判定しない。 */
export function getTagById(id: string): HousingTag | undefined {
  return HOUSING_TAGS.find((tag) => tag.id === id);
}

export function isStaticTagId(id: string): boolean {
  return HOUSING_TAGS.some((tag) => tag.id === id);
}

/**
 * 個人タグ形式の擬似 id (`personal_` + 英数字/アンダースコアのみ) の形式検証。
 * 2026-08-04: 実在確認 (旧 api/housing/_personalTagAttachGuard.ts、 Firestore personal_tags に
 * 存在し isHidden=false か) は personal_tags 廃止に伴い削除済み。 現在この関数は探すページの
 * フィルター状態から「ハウジンガー選択の擬似 ID (`personal_<hex>`)」を判別する目的でのみ使う
 * (applyFilters.ts 参照。 ownerUidFromPersonalFilterId で本来の uid へ逆変換する)。
 */
const PERSONAL_TAG_ID_PATTERN = /^personal_[a-z0-9_]{1,64}$/;
export function isPersonalTagIdFormat(id: string): boolean {
  return PERSONAL_TAG_ID_PATTERN.test(id);
}

/**
 * タグ id の構造的妥当性 (静的レジストリに存在するか)。
 * 2026-08-04: ハウジンガー検索は listing.tags ではなく ownerUid ベースの判定に変わったため、
 * personal_ 形式は物件の tags フィールドに書き込める値としてはもう無効。
 * (personal_ 形式の文字列は探すページのフィルター選択状態の中でのみ意味を持つ擬似 ID —
 *  isPersonalTagIdFormat / applyFilters.ts 参照)
 */
export function isValidTagId(id: string): boolean {
  return isStaticTagId(id);
}
