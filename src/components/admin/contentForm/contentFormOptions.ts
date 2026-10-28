/** コンテンツ編集フォーム — 選択肢の一覧と入力欄の class */

/** カテゴリ定義 */
export const CATEGORIES = [
  { value: 'savage', ja: '零式', en: 'Savage' },
  { value: 'ultimate', ja: '絶', en: 'Ultimate' },
  { value: 'dungeon', ja: 'ダンジョン', en: 'Dungeon' },
  { value: 'raid', ja: 'レイド', en: 'Raid' },
  { value: 'custom', ja: 'その他', en: 'Misc' },
] as const;

export const LEVELS = [
  { value: 100, ja: 'Lv100（黄金）', en: 'Lv100 (Dawntrail)' },
  { value: 90, ja: 'Lv90（暁月）', en: 'Lv90 (Endwalker)' },
  { value: 80, ja: 'Lv80（漆黒）', en: 'Lv80 (Shadowbringers)' },
  { value: 70, ja: 'Lv70（紅蓮）', en: 'Lv70 (Stormblood)' },
] as const;

// KNOWN_SERIES は廃止。 contentRegistry.ts の CONTENT_SERIES (= contents.json から自動生成) を動的に使う。
// これで「ドロップダウンの ID」 と「実体の ID」 が必ず一致する。

/** 零式の層選択 */
export const SAVAGE_TIERS = [
  { value: 1, ja: '1層', en: 'Floor 1' },
  { value: 2, ja: '2層', en: 'Floor 2' },
  { value: 3, ja: '3層', en: 'Floor 3' },
  { value: 4, ja: '4層（通し）', en: 'Floor 4' },
  { value: 5, ja: '4層 前半', en: 'Floor 4 Phase 1' },
  { value: 6, ja: '4層 後半', en: 'Floor 4 Phase 2' },
] as const;

export const inputClass =
  'w-full px-2 py-1.5 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
export const selectClass =
  'w-full px-2 py-1.5 text-app-lg bg-app-bg border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text [&>option]:bg-app-bg [&>option]:text-app-text';
export const labelClass = 'block text-app-base font-bold text-app-text-muted mb-0.5';
export const exampleClass = 'text-app-sm text-app-text-muted/50';
