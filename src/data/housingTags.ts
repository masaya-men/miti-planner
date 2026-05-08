/**
 * ハウジングタグマスタ
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §12 / 付録 A
 *
 * - 6 カテゴリ × 約 147 タグ
 * - i18nKey 経由で 4 言語表示 (実訳は src/locales/{ja,en,ko,zh}.json)
 * - 韓国語 / 中国語の品質が「(未確認)」のものは Phase 1 後にネイティブチェック
 */

export const HOUSING_TAG_CATEGORIES = [
  'taste',
  'scene',
  'season',
  'environment',
  'structure',
  'other',
] as const;
export type HousingTagCategory = typeof HOUSING_TAG_CATEGORIES[number];

export interface HousingTag {
  id: string;
  category: HousingTagCategory;
  i18nKey: string;
}

const t = (id: string, category: HousingTagCategory): HousingTag => ({
  id,
  category,
  i18nKey: `housing.tag.${id}`,
});

export const HOUSING_TAGS: readonly HousingTag[] = [
  // テイスト (45)
  t('wafu', 'taste'), t('wamodern', 'taste'), t('chinese', 'taste'), t('korean', 'taste'),
  t('western', 'taste'), t('modern', 'taste'), t('minimal', 'taste'), t('natural', 'taste'),
  t('nordic', 'taste'), t('antique', 'taste'), t('vintage', 'taste'), t('retro', 'taste'),
  t('taisho_roman', 'taste'), t('rustic', 'taste'), t('country', 'taste'), t('cottagecore', 'taste'),
  t('gothic', 'taste'), t('dark_academia', 'taste'), t('industrial', 'taste'), t('steampunk', 'taste'),
  t('cyberpunk', 'taste'), t('scifi', 'taste'), t('fantasy', 'taste'), t('marchen', 'taste'),
  t('bohemian', 'taste'), t('luxury', 'taste'), t('chic', 'taste'), t('elegant', 'taste'),
  t('romantic', 'taste'), t('cute', 'taste'), t('pop', 'taste'), t('monochrome', 'taste'),
  t('dark', 'taste'), t('light', 'taste'), t('flashy', 'taste'), t('calm', 'taste'),
  t('simple', 'taste'), t('warm', 'taste'), t('cool', 'taste'), t('mystical', 'taste'),
  t('ruins', 'taste'), t('horror', 'taste'), t('witch', 'taste'), t('alchemist', 'taste'),
  t('sage_mage', 'taste'),
  // シーン・用途 (40)
  t('residence', 'scene'), t('apartment_room', 'scene'), t('bedroom', 'scene'), t('living_room', 'scene'),
  t('dining_room', 'scene'), t('kitchen', 'scene'), t('bath', 'scene'), t('study', 'scene'),
  t('childrens_room', 'scene'), t('walkin_closet', 'scene'), t('cafe', 'scene'), t('coffee_shop', 'scene'),
  t('jun_kissa', 'scene'), t('bar', 'scene'), t('izakaya', 'scene'), t('tavern', 'scene'),
  t('nightclub', 'scene'), t('host_club', 'scene'), t('restaurant', 'scene'), t('diner', 'scene'),
  t('ramen_shop', 'scene'), t('food_stall', 'scene'), t('tea_room', 'scene'), t('bakery', 'scene'),
  t('shop', 'scene'), t('boutique', 'scene'), t('flower_shop', 'scene'), t('bookstore', 'scene'),
  t('library', 'scene'), t('gallery', 'scene'), t('atelier', 'scene'), t('workshop', 'scene'),
  t('photo_studio', 'scene'), t('temple', 'scene'), t('shrine', 'scene'), t('church', 'scene'),
  t('school', 'scene'), t('hospital', 'scene'), t('inn', 'scene'), t('hotel', 'scene'),
  // 季節・イベント (20)
  t('spring', 'season'), t('summer', 'season'), t('autumn', 'season'), t('winter', 'season'),
  t('cherry_blossom', 'season'), t('autumn_leaves', 'season'), t('snow', 'season'), t('beach', 'season'),
  t('tanabata', 'season'), t('halloween', 'season'), t('christmas', 'season'), t('valentine', 'season'),
  t('new_year', 'season'), t('hinamatsuri', 'season'), t('easter', 'season'), t('summer_festival', 'season'),
  t('starlight', 'season'), t('guardian_day', 'season'), t('matsuri', 'season'), t('illumination', 'season'),
  // 環境・舞台設定 (12)
  t('forest', 'environment'), t('desert', 'environment'), t('snowland', 'environment'),
  t('tropical', 'environment'), t('mediterranean', 'environment'), t('grassland', 'environment'),
  t('mountain', 'environment'), t('cave', 'environment'), t('underwater', 'environment'),
  t('space', 'environment'), t('floating_island', 'environment'), t('otherworld', 'environment'),
  // 構造・特殊 (15)
  t('rooftop', 'structure'), t('basement', 'structure'), t('garden', 'structure'),
  t('terrace', 'structure'), t('courtyard', 'structure'), t('multilevel', 'structure'),
  t('multifloor', 'structure'), t('atrium', 'structure'), t('loft', 'structure'),
  t('attic', 'structure'), t('gimmick', 'structure'), t('hidden_room', 'structure'),
  t('warp_room', 'structure'), t('floating_furniture', 'structure'), t('photogenic', 'structure'),
  // その他 (15)
  t('ghibli_style', 'other'), t('pirate', 'other'), t('medieval', 'other'), t('castle', 'other'),
  t('haunted_mansion', 'other'), t('yukaku', 'other'), t('ryugujo', 'other'), t('treehouse', 'other'),
  t('camp', 'other'), t('abandoned_factory', 'other'), t('lab', 'other'), t('prison', 'other'),
  t('funeral', 'other'), t('casino', 'other'), t('theater', 'other'),
];

export function getTagsByCategory(category: HousingTagCategory): HousingTag[] {
  return HOUSING_TAGS.filter((tag) => tag.category === category);
}

export function getTagById(id: string): HousingTag | undefined {
  return HOUSING_TAGS.find((tag) => tag.id === id);
}

export function isValidTagId(id: string): boolean {
  return HOUSING_TAGS.some((tag) => tag.id === id);
}
