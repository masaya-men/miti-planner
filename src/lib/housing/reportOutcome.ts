/**
 * 通報の自動非表示判定 (2026-07-14 P0-5)。
 * 「延べ通報数」ではなく「相異なる通報者数」で数える。
 * dedup は (reporterUid, 対象) 単位だが、旧仕様 ((reporterUid, reason) 単位) の時代に
 * 作られた同一ユーザーの複数 report が reports に残っていても distinct で正しく数えられる。
 */

/** 既存 reports の reporterUid 群 + 今回の通報者から、相異なる通報者数を数える */
export function countUniqueReporters(
  existingReporterUids: Array<string | undefined>,
  newReporterUid: string,
): number {
  const uids = new Set<string>();
  for (const uid of existingReporterUids) {
    if (typeof uid === 'string' && uid) uids.add(uid);
  }
  uids.add(newReporterUid);
  return uids.size;
}

export interface ListingReportOutcome {
  /** 相異なる通報者数 (今回の通報者を含む)。listing.reportCount に保存する */
  newCount: number;
  shouldHide: boolean;
}

export function computeListingReportOutcome(
  existingReporterUids: Array<string | undefined>,
  newReporterUid: string,
  threshold: number,
  alreadyHidden: boolean,
): ListingReportOutcome {
  const newCount = countUniqueReporters(existingReporterUids, newReporterUid);
  return { newCount, shouldHide: !alreadyHidden && newCount >= threshold };
}
