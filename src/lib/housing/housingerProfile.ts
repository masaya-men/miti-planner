/**
 * ハウジンガープロフィール (spec 2026-07-10-housinger-profile-design.md)
 * クライアント・サーバー (api/housing) 両方から import される純関数と定数。
 */

/** ひとこと自己紹介の最大文字数 (spec §3.1) */
export const HOUSINGER_BIO_MAX_LENGTH = 100;

/** SNS リンク許可ホスト (spec §6.1)。拡張はここに 1 行足すだけ。 */
export const HOUSINGER_SNS_ALLOWED_HOSTS = [
  'x.com', 'www.x.com',
  'twitter.com', 'www.twitter.com',
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'jp.finalfantasyxiv.com', 'na.finalfantasyxiv.com', 'eu.finalfantasyxiv.com',
] as const;

export type SnsUrlValidation =
  | { ok: true }
  | { ok: false; error: 'invalid_url' | 'not_https' | 'host_not_allowed' };

export function validateHousingerSnsUrl(url: string): SnsUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'not_https' };
  // ホストは完全一致のみ (evil-x.com / x.com.evil.com を弾く)
  if (!(HOUSINGER_SNS_ALLOWED_HOSTS as readonly string[]).includes(parsed.hostname)) {
    return { ok: false, error: 'host_not_allowed' };
  }
  return { ok: true };
}

/**
 * 個人タグ ID を uid から決定的に導出 (spec §3.3。名前由来スラッグ禁止 = 改名で不変)。
 * uid は 'hashed:<hex>' 形式 (api/_lib/hashUid.ts)。prefix を剥いて使う。
 */
export function personalTagIdForUid(uid: string): string {
  return `personal_${uid.replace(/^hashed:/, '')}`;
}

/**
 * personal_tags の既存ドキュメント (ownerUid == uid) があれば、その ID をそのまま再利用する。
 * タグ刷新 Phase B 統合契約1「1人1個制約は tagId が uid 決定的なので構造的に満たされる」は
 * 新規公開者には成り立つが、旧 create-personal-tag 経路 (ランダム slug ID) で既にタグを作成
 * 済みのユーザーには成り立たない。 uid 決定的な id で新規ドキュメントを作ると、そのユーザーは
 * 2 つの personal_tags ドキュメントを持つことになり 1 人 1 個の不変条件が壊れる。
 *
 * そのため呼び出し側 (upsert ハンドラ) は必ず「ownerUid == uid の既存ドキュメントがあるか」を
 * 先にクエリし、その結果 (id の配列) をこの関数に渡す。既存があれば ID がどんな形式でも
 * そのまま再利用する (delete+recreate すると、その ID を参照している既存 listing の tags 配列
 * が壊れるため、ID は変えない)。既存が無ければ uid 決定的な canonical id で新規作成する。
 *
 * @param existingIds ownerUid == uid で見つかった personal_tags ドキュメント id の一覧。
 *   通常は 0 または 1 件。2 件以上は本来起こり得ない異常系だが、その場合も決定的に
 *   1 件目 (呼び出し側のクエリ順) を正としてこれ以上増やさない。
 */
export function resolvePersonalTagId(uid: string, existingIds: readonly string[]): string {
  if (existingIds.length > 0) return existingIds[0];
  return personalTagIdForUid(uid);
}

/** プロフィール通報理由 (spec §6.2)。listing の REPORT_REASONS とは独立。 */
export const HOUSINGER_REPORT_REASONS = [
  'inappropriate_name', 'inappropriate_avatar', 'impersonation', 'other',
] as const;
export type HousingerReportReason = typeof HOUSINGER_REPORT_REASONS[number];
export function isValidHousingerReportReason(v: unknown): v is HousingerReportReason {
  return typeof v === 'string' && (HOUSINGER_REPORT_REASONS as readonly string[]).includes(v);
}
