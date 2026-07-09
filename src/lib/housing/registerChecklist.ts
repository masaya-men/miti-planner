/**
 * 登録ページ右カラム「入力チェックパネル」の導出純関数 (Task13)。
 *
 * 住所/タイトルは必須、画像は推奨(公開をブロックしない)。RegisterCheckPanel の表示と
 * Confirm/submit の disabled 判定 (Task14) が本モジュールを単一ソースとして参照する。
 */

export type RegisterChecklistKey = 'address' | 'title' | 'image';

export interface RegisterChecklistItem {
  key: RegisterChecklistKey;
  done: boolean;
  labelKey: string;
  /** 必須項目か (画像は推奨=false)。isReadyToPublish は required=true の行のみ見る。 */
  required: boolean;
}

export interface RegisterChecklistInput {
  addressOk: boolean;
  titleOk: boolean;
  hasImage: boolean;
}

export function computeRegisterChecklist(input: RegisterChecklistInput): RegisterChecklistItem[] {
  return [
    {
      key: 'address',
      done: input.addressOk,
      labelKey: 'housing.register.check.address',
      required: true,
    },
    {
      // 2026-07-10: タイトルは任意化 (未入力なら一覧カードは住所を表示)。
      // 推奨行として残すが required=false で公開をブロックしない (画像と同じ扱い)。
      key: 'title',
      done: input.titleOk,
      labelKey: 'housing.register.check.title',
      required: false,
    },
    {
      key: 'image',
      done: input.hasImage,
      labelKey: 'housing.register.check.image',
      required: false,
    },
  ];
}

/**
 * 必須行 (address/title) が全て done かで公開可否を判定する。画像 (推奨) は見ない。
 */
export function isReadyToPublish(items: RegisterChecklistItem[]): boolean {
  return items.filter((i) => i.required).every((i) => i.done);
}
