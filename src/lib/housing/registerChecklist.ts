/**
 * 登録ページ右カラム「入力チェックパネル」の導出純関数 (Task13)。
 *
 * 住所は必須、タイトル/画像は推奨 (公開をブロックしない)。RegisterCheckPanel の表示と
 * Confirm/submit の disabled 判定 (Task14) が本モジュールを単一ソースとして参照する。
 *
 * 2026-07-10 (文言バグ修正): 以前は行ラベルに `housing.register.check.title` を使っていたが、
 * これは RegisterCheckPanel の**見出し**キーと同一で、行に「登録前に確認」と出ていた。
 * 見出しは `check.panel_title` に分離し、行は名詞 (`check.row_*`) に変更。
 * さらに、同じ行を「確認セクションの不足アクション」でも使い回していたため、
 * 名詞 (行) と命令文 (不足アクション) で **キーを 2 系統に分けた** (labelKey / missingLabelKey)。
 * 行は「✓ 住所」、不足アクションは「住所を入力してください」と、それぞれ自然に読める。
 */

export type RegisterChecklistKey = 'address' | 'title' | 'image';

export interface RegisterChecklistItem {
  key: RegisterChecklistKey;
  done: boolean;
  /** チェックパネルの行ラベル (名詞。アイコン ✓/⚠ が状態を表すため命令文にしない)。 */
  labelKey: string;
  /** 確認セクションの「不足しているアクション」リスト用 (命令文)。 */
  missingLabelKey: string;
  /** 必須項目か (タイトル/画像は推奨=false)。isReadyToPublish は required=true の行のみ見る。 */
  required: boolean;
}

export interface RegisterChecklistInput {
  addressOk: boolean;
  /**
   * 住所確認ゲート (C案・2026-07-10)。値が妥当でも、確認ボタンを押すまでは
   * done にしない。未確認時の不足アクションは「住所を入力してください」ではなく
   * 「住所を確認してください」(missing_address_confirm) を出す。
   */
  addressConfirmed: boolean;
  titleOk: boolean;
  /** 静止画 or 動画/YouTube のいずれかがあるか (メディアの有無)。 */
  hasImage: boolean;
  /**
   * 画像/動画を必須にするか (2026-07-15)。新規登録=true (メディアなしでは公開不可)、
   * edit / 一時ツアーは false=推奨のまま。省略時は false。
   */
  imageRequired?: boolean;
}

export function computeRegisterChecklist(input: RegisterChecklistInput): RegisterChecklistItem[] {
  return [
    {
      key: 'address',
      done: input.addressOk && input.addressConfirmed,
      labelKey: 'housing.register.check.row_address',
      missingLabelKey: input.addressOk
        ? 'housing.register.check.missing_address_confirm'
        : 'housing.register.check.missing_address',
      required: true,
    },
    {
      // 2026-07-10: タイトルは任意化 (未入力なら一覧カードは住所を表示)。
      // 推奨行として残すが required=false で公開をブロックしない (画像と同じ扱い)。
      key: 'title',
      done: input.titleOk,
      labelKey: 'housing.register.check.row_title',
      missingLabelKey: 'housing.register.check.missing_title',
      required: false,
    },
    {
      key: 'image',
      done: input.hasImage,
      labelKey: input.imageRequired
        ? 'housing.register.check.row_image_required'
        : 'housing.register.check.row_image',
      missingLabelKey: 'housing.register.check.missing_image',
      required: input.imageRequired ?? false,
    },
  ];
}

/**
 * 必須行 (住所) が全て done かで公開可否を判定する。タイトル/画像 (推奨) は見ない。
 */
export function isReadyToPublish(items: RegisterChecklistItem[]): boolean {
  return items.filter((i) => i.required).every((i) => i.done);
}
