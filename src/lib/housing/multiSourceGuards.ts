/**
 * 複数投稿URL登録 (Batch2・2026-07-21) の共通ガード。
 * 登録ページ (RegisterPage) と編集ページ (HousingEditSourcePanel) の両方から使う、
 * 「重複URLの拒否」「動画1本制限」の判定だけを持つ純関数。副作用 (トースト表示等) は
 * 呼び出し側の責務とする。
 */

/** 既に使われている投稿URL一覧の中に candidate と完全一致するものがあるか。 */
export function isDuplicatePostUrl(existingUrls: readonly string[], candidate: string): boolean {
  return existingUrls.includes(candidate);
}

/**
 * 動画は1物件1本まで。既に動画を保持している状態で、今回のURLにも動画が含まれる場合は
 * その動画部分を拒否する (画像は呼び出し側で別途マージしてよい)。
 */
export function shouldRejectIncomingVideo(hasExistingVideo: boolean, incomingHasVideo: boolean): boolean {
  return hasExistingVideo && incomingHasVideo;
}
