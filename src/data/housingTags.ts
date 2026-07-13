/**
 * ハウジングタグマスタ
 *
 * 計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md
 *
 * - 3+1 kind 構成: 公式 (official) 23 / 季節 (season) 12 / テーマ (theme) 12 / 個人 (personal)
 *   旧 6 カテゴリ約 147 タグ (taste/scene/season/environment/structure/other) は引退。
 * - 公式・季節・テーマは静的レジストリ (このファイル)。 個人タグは Firestore `personal_tags`
 *   コレクションで動的管理する (1 ユーザー 1 個、 PERSONAL_TAG_LIMIT_PER_USER で定数化)。
 * - id は kind ごとに prefix 統一 (`official_` / `season_` / `theme_` / `personal_`)。
 * - i18nKey 経由で 4 言語表示 (実訳は src/locales/{ja,en,ko,zh}.json)。
 * - kind の一覧・表示順は HOUSING_TAG_KINDS (このファイル) から導出する。
 *   コンポーネント側で kind 名の switch/if-chain を書かず、 この配列を map する設計にすること
 *   (将来 kind を増やすときは、 ここに 1 エントリ足す + ロケール追加だけで済む構造)。
 * - 公式タグ 23 種の EN 表記はゲーム内正式名そのまま (意訳禁止・出典:
 *   https://ffxiv.consolegameswiki.com/wiki/Estate_Tags)。 JA/KO/ZH は公式ソース照合が必要。
 */

export const HOUSING_TAG_KINDS = ['official', 'season', 'theme', 'personal'] as const;
export type HousingTagKind = typeof HOUSING_TAG_KINDS[number];

/** 静的レジストリを持つ kind (personal は Firestore 動的管理のためこの配列には含めない)。 */
export const STATIC_HOUSING_TAG_KINDS = ['official', 'season', 'theme'] as const;
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

/** 静的タグ全件 (公式23 + 季節12 + テーマ12 = 47)。 個人タグはここに含まれない。 */
export const HOUSING_TAGS: readonly HousingTag[] = [
  ...OFFICIAL_TAGS,
  ...SEASON_TAGS,
  ...THEME_TAGS,
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
 * 個人タグ id の形式検証 (`personal_` + 英数字/アンダースコアのみ)。
 * **実在確認 (Firestore personal_tags に存在し isHidden=false か) はこの関数の責務外**。
 * サーバー側 (api/housing 登録・編集ハンドラ) が別レイヤーで行う。
 */
const PERSONAL_TAG_ID_PATTERN = /^personal_[a-z0-9_]{1,64}$/;
export function isPersonalTagIdFormat(id: string): boolean {
  return PERSONAL_TAG_ID_PATTERN.test(id);
}

/**
 * タグ id の構造的妥当性 (静的レジストリに存在 OR 個人タグ形式)。
 * `validateTags` (housingValidation.ts) から同期的に呼ばれるため、 Firestore アクセスを伴う
 * 個人タグの実在確認はここでは行わない (前述の isPersonalTagIdFormat と同じ制約)。
 */
export function isValidTagId(id: string): boolean {
  return isStaticTagId(id) || isPersonalTagIdFormat(id);
}
