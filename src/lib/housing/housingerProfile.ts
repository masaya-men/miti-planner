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

/**
 * 短縮共有 URL (`/h/<name>-<code>`) 用の識別コードの桁数。16進数8桁 = 約43億通りで、
 * ハウジンガー規模で偶然の衝突が起きる確率は現実的に無視できる (仮に起きても衝突検知は
 * resolveHousingerUidByShortCode 側で先頭一致 limit(1) が拾うだけ = 実害は極小)。
 */
const HOUSINGER_SHORT_CODE_LENGTH = 8;

/**
 * uid (`hashed:<hex>` 形式) から短縮 URL 用の識別コードを作る。既存の一方向ハッシュの
 * 先頭 8 文字を流用するだけなので、新しいデータの保存・既存ユーザーへの移行は一切不要
 * (2026-07-16 に一度却下された「名前を鍵にする」A案と違い、名前は判定に使わない飾りに留める)。
 */
export function getHousingerShortCode(uid: string): string {
  return stripHashedPrefix(normalizeHousingerUid(uid)).slice(0, HOUSINGER_SHORT_CODE_LENGTH).toLowerCase();
}

/**
 * 表示名を短縮 URL の飾り部分として使える形に整形する。文字・数字 (Unicode の「文字」
 * 「数字」カテゴリ、日本語/中国語/韓国語等の表記も含む) 以外の記号・絵文字は取り除き
 * (URL の区切り文字として意味を持つ `/ ? # % &` は当然含まれる。絵文字は一部クライアントで
 * URL エンコードされて長い %XX の羅列になり「短い URL」の趣旨を損なうため除外する)、
 * 空白はハイフンに統一する。整形後に空になる場合 (絵文字・記号のみの名前等) は null を返し、
 * 呼び出し側は識別コードだけの URL にフォールバックする。
 */
export function slugifyHousingerName(displayName: string, maxLength = 20): string | null {
  const cleaned = displayName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * ハウジンガー短縮 URL (`/h/<slug>`) の slug 部分を組み立てる。実際にどのプロフィールを
 * 開くかは末尾の識別コードだけで判定し、名前部分はあくまで見た目 (改名しても既存リンクは
 * 壊れない・同名の人がいても混ざらない)。
 */
export function buildHousingerShortSlug(displayName: string, uid: string): string {
  const code = getHousingerShortCode(uid);
  const namePart = slugifyHousingerName(displayName);
  return namePart ? `${namePart}-${code}` : code;
}

/**
 * 短縮 URL の slug から識別コード (末尾の16進数8桁) だけを取り出す。飾りの名前部分は無視する。
 * 形式に合わなければ null (不正な slug・ページ側は not-found 扱いにする)。
 */
export function extractHousingerShortCode(slug: string): string | null {
  const match = new RegExp(`(?:^|-)([0-9a-f]{${HOUSINGER_SHORT_CODE_LENGTH}})$`, 'i').exec(slug);
  return match ? match[1].toLowerCase() : null;
}

/** プロフィール通報理由 (spec §6.2)。listing の REPORT_REASONS とは独立。 */
export const HOUSINGER_REPORT_REASONS = [
  'inappropriate_name', 'inappropriate_avatar', 'impersonation', 'other',
] as const;
export type HousingerReportReason = typeof HOUSINGER_REPORT_REASONS[number];
export function isValidHousingerReportReason(v: unknown): v is HousingerReportReason {
  return typeof v === 'string' && (HOUSINGER_REPORT_REASONS as readonly string[]).includes(v);
}
