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
 * personalTagIdForUid の逆変換。 探すページのタグ検索でハウジンガーを選んだとき、
 * その擬似 ID (`personal_<hex>`) から本来の uid (`hashed:<hex>`) を復元するために使う
 * (applyFilters.ts の ownerUid 判定、 PersonalTagFilterLink.tsx のプロフィール解決)。
 */
export function ownerUidFromPersonalFilterId(filterId: string): string {
  return `hashed:${filterId.replace(/^personal_/, '')}`;
}

/**
 * ハウジンガーページの共有 URL / 内部リンク用に 'hashed:' prefix を剥がす (#3・見た目のみの短縮)。
 * 例: 'hashed:d34d9c…' → 'd34d9c…'。prefix が無ければそのまま返す。一方向ハッシュ値のため
 * 剥がしても復元不可 = プライバシー影響ゼロ。URL から `hashed:` の語とコロンを消して警戒感を減らす。
 */
export function stripHashedPrefix(uid: string): string {
  return uid.replace(/^hashed:/, '');
}

/**
 * ルートパラメータ (`hashed:` prefix 有無どちらも来うる) を内部 ID 形式 'hashed:<hex>' に正規化する。
 * housing_profiles の doc ID / listing の ownerUid / auth uid はすべて 'hashed:<hex>' 形式なので、
 * URL から prefix を外しても、取得・本人判定の前にここで必ず復元する。これにより新 URL
 * (prefix 無し) も旧 URL ('hashed:…') も同じ内部 ID に解決される (後方互換)。
 */
export function normalizeHousingerUid(uid: string): string {
  return uid.startsWith('hashed:') ? uid : `hashed:${uid}`;
}

/** プロフィール通報理由 (spec §6.2)。listing の REPORT_REASONS とは独立。 */
export const HOUSINGER_REPORT_REASONS = [
  'inappropriate_name', 'inappropriate_avatar', 'impersonation', 'other',
] as const;
export type HousingerReportReason = typeof HOUSINGER_REPORT_REASONS[number];
export function isValidHousingerReportReason(v: unknown): v is HousingerReportReason {
  return typeof v === 'string' && (HOUSINGER_REPORT_REASONS as readonly string[]).includes(v);
}
