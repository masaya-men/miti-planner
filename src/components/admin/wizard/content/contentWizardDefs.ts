/** コンテンツ追加ウィザードの選択肢・ステップ定義 */
import type { WizardStep } from '../useWizard';

export interface CategoryDef {
  value: string;
  labelJa: string;
  labelEn: string;
}

export interface LevelDef {
  value: number;
  labelJa: string;
  labelEn: string;
}

export const CATEGORIES: CategoryDef[] = [
  { value: 'savage',   labelJa: '零式',       labelEn: 'Savage' },
  { value: 'ultimate', labelJa: '絶',          labelEn: 'Ultimate' },
  { value: 'dungeon',  labelJa: 'ダンジョン', labelEn: 'Dungeon' },
  { value: 'raid',     labelJa: 'レイド',      labelEn: 'Raid' },
  { value: 'custom',   labelJa: 'その他',      labelEn: 'Misc' },
];

export const LEVELS: LevelDef[] = [
  { value: 100, labelJa: 'Lv100（黄金）',        labelEn: 'Lv100 (Dawntrail)' },
  { value: 90,  labelJa: 'Lv90（暁月）',          labelEn: 'Lv90 (Endwalker)' },
  { value: 80,  labelJa: 'Lv80（漆黒）',          labelEn: 'Lv80 (Shadowbringers)' },
  { value: 70,  labelJa: 'Lv70（紅蓮）',          labelEn: 'Lv70 (Stormblood)' },
];

// KNOWN_SERIES は廃止。 CONTENT_SERIES (contents.json 由来) を動的に使う。
// step 内で current level + category=savage で絞り込んで使用する。

// ---- ステップ定義 --------------------------------------------------------

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'category',   label: 'admin.content_wiz_category',   required: true },
  { id: 'level',      label: 'admin.content_wiz_level',      required: true },
  { id: 'contentId',  label: 'admin.content_wiz_id',         required: true },
  { id: 'nameJa',     label: 'admin.content_wiz_name_ja',    required: true },
  { id: 'nameEn',     label: 'admin.content_wiz_name_en',    required: true },
  // シリーズ step は零式のときだけ表示 (絶は seriesId=contentId 自動、 dungeon/raid/custom は seriesId 不要)
  { id: 'series',     label: 'admin.content_wiz_series',     required: true, condition: (d) => d.category === 'savage' },
  { id: 'patch',      label: 'admin.content_wiz_patch',      required: false },
  { id: 'fflogsId',   label: 'admin.content_wiz_fflogs',     required: false },
];

