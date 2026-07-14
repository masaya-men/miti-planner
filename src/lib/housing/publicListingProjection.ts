/**
 * 公開窓口レスポンスの許可リスト方式 射影 (2026-07-14 P1・設計書 §4.2)。
 *
 * - firebase 非依存の pure 関数 (窓口 api から import + 単体テスト可能)。
 * - 住所系フィールド (ADDRESS_FIELDS) は visibility==='public' のときだけ含める。
 *   'unlisted' では 1 つも含めない (= 射影で住所を守る二重防御の片方)。
 * - 許可リストに無いフィールド (reportCount / restoreCount / updatedAt / lastTweetCheckAt 等) は
 *   public でも一切返さない。新フィールドを card/detail で使うようになったら SAFE_FIELDS に足す。
 */

/** 住所系。public のときだけ返す。unlisted では絶対に含めない。 */
export const ADDRESS_FIELDS = [
  'dc', 'server', 'area', 'ward', 'plot', 'size', 'apartmentBuilding', 'roomNumber', 'addressKey',
] as const;

/** 住所以外の安全フィールド。public / unlisted 両方で返す。 */
const SAFE_FIELDS = [
  'ownerUid', 'title', 'description', 'tags',
  'imageMode', 'postUrl', 'ogImageUrl', 'thumbnailPath', 'thumbnailPaths',
  'sourceImageUrls', 'sourceImageAspectRatios',
  'youtubeVideoId', 'videoUrl', 'videoPosterUrl', 'videoAspectRatio',
  'tweetId', 'buildingType', 'roomKind',
  'createdAt', 'lastConfirmedAt', 'publishUntil',
] as const;

export function projectPublicListing(
  id: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const visibility = raw.visibility === 'unlisted' ? 'unlisted' : 'public';
  // 窓口は「可視 doc のみ」を返すため isHidden/deletedAt は固定値でよい。
  const out: Record<string, unknown> = { id, visibility, isHidden: false, deletedAt: null };
  for (const f of SAFE_FIELDS) {
    if (raw[f] !== undefined) out[f] = raw[f];
  }
  if (visibility === 'public') {
    for (const f of ADDRESS_FIELDS) {
      if (raw[f] !== undefined) out[f] = raw[f];
    }
  }
  if (out.tags === undefined) out.tags = [];
  return out;
}
