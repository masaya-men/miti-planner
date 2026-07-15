/**
 * 登録ページ (RegisterPage) のオートセーブ純関数 (Task14)。
 *
 * localStorage に「テキスト系フィールドのみ」を JSON 保存し、次回マウント時に復元する。
 * 画像バイナリ (localImages) と SNS 派生 state (tweetData/ogpResult/sourceImageUrls) は
 * **保存しない** — サイズが大きい / 再取得可能 / 陳腐化する ため。復元時は保存済み SNS URL
 * (postUrl) から取得のみ再実行して画像 state を再構築する (spec §「復元と SNS 派生 state の
 * 相互作用」= docs/superpowers/specs/2026-07-02-housing-register-page-design.md:120)。
 *
 * serialize/restore は純関数として切り出し、localStorage への読み書きは RegisterPage 側の
 * effect が担う (テスト容易性のため)。
 */

/** localStorage key。spec §オートセーブ (:119) 準拠。 */
export const AUTOSAVE_KEY = 'housing-register-draft';

/**
 * オートセーブ対象のテキスト系フィールド一覧。
 * 住所選択 (dc/server/area/ward/buildingType/plot/size/apartmentBuilding/roomKind/roomNumber) +
 * タイトル/コメント/タグ + SNS URL (postUrl) + 公開設定 (visibility/publishUntil) を持つ。
 *
 * すべて任意 — 途中入力の一部だけが保存されるのが通常。
 */
export interface AutosaveDraft {
  // 紹介セクション
  title?: string;
  description?: string;
  tags?: string[];

  // 住所セクション (RegisterAddressValues のテキスト/数値系をフラットに保持)
  dc?: string;
  server?: string;
  area?: string;
  ward?: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  size?: string;
  apartmentBuilding?: 1 | 2;
  roomKind?: 'private_chamber' | 'apartment_room';
  roomNumber?: number;

  // SNS URL (画像そのものではなく URL のみ保存 → 復元時に再取得)
  postUrl?: string;

  // 公開設定
  visibility?: 'public' | 'unlisted' | 'private';
  publishUntil?: number | null;
}

/**
 * オートセーブ対象キー (この配列に無いキーは serialize で捨てる)。
 * `undefined` の値はスキップし、空 draft は `{}` を JSON 化する。
 */
const TEXT_KEYS: (keyof AutosaveDraft)[] = [
  'title',
  'description',
  'tags',
  'dc',
  'server',
  'area',
  'ward',
  'buildingType',
  'plot',
  'size',
  'apartmentBuilding',
  'roomKind',
  'roomNumber',
  'postUrl',
  'visibility',
  'publishUntil',
];

/**
 * テキスト系フィールドだけを抜き出して JSON 文字列化する。
 * localImages のバイナリ・SNS 派生 state (tweetData/ogpResult/sourceImageUrls) は
 * 入力に含まれていても TEXT_KEYS のホワイトリストで自動的に除外される。
 */
export function serializeDraft(values: Partial<AutosaveDraft>): string {
  const picked: Partial<AutosaveDraft> = {};
  for (const key of TEXT_KEYS) {
    const v = values[key];
    if (v !== undefined) {
      // 型安全のためキャストは 1 箇所に閉じる (key に対応する値型は保証済み)。
      (picked as Record<string, unknown>)[key] = v;
    }
  }
  return JSON.stringify(picked);
}

/**
 * serialize 済み文字列を AutosaveDraft に復元する。
 * - null / 空文字 → null (保存なし)
 * - パース失敗 (壊れた JSON) → null (握りつぶす)
 * - object でない (配列/数値/文字列リテラル) → null
 */
export function restoreDraft(raw: string | null): Partial<AutosaveDraft> | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Partial<AutosaveDraft>;
  } catch {
    return null;
  }
}

/**
 * ドラフトに「ユーザーが実際に入力した意味のある値」が 1 つでもあるかを判定する。
 *
 * 空文字のタイトル/コメント (`''`)・既定の `visibility:'public'`・`publishUntil:null` は
 * 「何も入力していない」と見なして false に落とす。これを保存前ガード (空ドラフトを
 * localStorage に書かない) と復元通知ガード (中身のないドラフトで「復元しました」を出さない)
 * の両方に通し、「開いただけで毎回『入力途中を復元しました』が出る」バグを根治する。
 *
 * size は (area × plot) からの導出値でユーザーの直接入力ではないため、住所判定には
 * 選択項目 (dc/server/area/ward/buildingType/plot/apartmentBuilding/roomKind/roomNumber) のみを使う。
 */
export function hasMeaningfulDraft(d: Partial<AutosaveDraft>): boolean {
  return (
    !!d.title?.trim() ||
    !!d.description?.trim() ||
    (Array.isArray(d.tags) && d.tags.length > 0) ||
    d.dc != null ||
    d.server != null ||
    d.area != null ||
    d.ward != null ||
    d.buildingType != null ||
    d.plot != null ||
    d.apartmentBuilding != null ||
    d.roomKind != null ||
    d.roomNumber != null ||
    !!d.postUrl?.trim() ||
    d.visibility === 'private' ||
    d.publishUntil != null
  );
}
