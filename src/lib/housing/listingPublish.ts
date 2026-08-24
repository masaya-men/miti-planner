import type { MockListing } from '../../data/housing/mockListings.js';

/**
 * 表示時点で「実質公開中」かを判定する遅延評価 (spec A-1)。
 * visibility 未設定 doc は公開扱い (バックフィル前の保険)。
 * publishUntil を過ぎていたら公開扱いしない。now は呼び出し側が渡す (閲覧端末の時計)。
 */
export function isEffectivelyPublic(
  listing: { visibility?: 'public' | 'unlisted' | 'private'; publishUntil?: number | null },
  nowMs: number,
): boolean {
  if (listing.visibility === 'private') return false;
  if (listing.publishUntil != null && listing.publishUntil <= nowMs) return false;
  return true;
}

/** カード/詳細で住所を隠すべきか (unlisted のみ true)。public/private/未設定は false。 */
export function isAddressHidden(listing: { visibility?: 'public' | 'unlisted' | 'private' }): boolean {
  return listing.visibility === 'unlisted';
}

/**
 * MockListing 系 (galleryAdapter 経由) で「住所を安全に組み立てて良いか」の type guard。
 * unlisted は galleryAdapter の窓口で area/ward が undefined になる (§3.5 確定2) ため、
 * `!isAddressHidden` だけでは TypeScript 上 area/ward の undefined が消えない。
 * この guard を通すと area/ward が確定型になり、formatHousingAddress 系へそのまま渡せる。
 * (isAddressHidden の否定と実質等価: unlisted 以外は area/ward が必ず両方揃っている前提)
 */
export function canDisplayAddress<
  T extends { visibility?: 'public' | 'unlisted' | 'private'; area?: unknown; ward?: number },
>(listing: T): listing is T & { area: NonNullable<T['area']>; ward: number } {
  return !isAddressHidden(listing) && listing.area !== undefined && listing.ward !== undefined;
}

/**
 * formatFullHousingAddress (リージョン/DC/ワールド込み完全住所) 用の type guard。
 * canDisplayAddress (area/ward) に加えて dc/server/region も要求する。
 * 個別の `!== undefined` 比較を並べるだけでは (TS の仕様上) オブジェクト全体の型は narrowing
 * されない ( formatFullHousingAddress にそのまま渡すと undefined のまま扱われる) ため、
 * 必ずこの type guard 経由で呼ぶこと。
 */
export function canDisplayFullAddress<
  T extends {
    visibility?: 'public' | 'unlisted' | 'private';
    area?: unknown;
    ward?: number;
    dc?: string;
    server?: string;
    region?: unknown;
  },
>(
  listing: T,
): listing is T & {
  area: NonNullable<T['area']>;
  ward: number;
  dc: string;
  server: string;
  region: NonNullable<T['region']>;
} {
  return (
    canDisplayAddress(listing)
    && listing.dc !== undefined
    && listing.server !== undefined
    && listing.region !== undefined
  );
}

/**
 * 一覧表示用に「公開クエリの結果」と「自分の登録クエリの結果」を合流する (spec A-3)。
 * - 公開クエリ結果からは他人の期限切れ (実質非公開) を除外する。
 * - 自分の登録は visibility/期限に関係なく全て残す (本人はバッジ付きで見える)。
 * - id で dedup (自分の公開物件が両クエリに出るため)。
 */
export function mergeListingsForViewer(
  publicListings: MockListing[],
  myListings: MockListing[],
  viewerUid: string | null,
  nowMs: number,
): MockListing[] {
  const byId = new Map<string, MockListing>();
  for (const l of publicListings) {
    if (l.ownerUid === viewerUid || isEffectivelyPublic(l, nowMs)) byId.set(l.id, l);
  }
  for (const l of myListings) {
    if (l.ownerUid === viewerUid) byId.set(l.id, l);
  }
  return Array.from(byId.values());
}

/**
 * 探すページの NEW バッジ対象期間 (ミリ秒) の既定値。
 * 管理画面 (master/config.newListingWindowDays) で日数を変更可能 (2026-08-16)。
 * Firestore未取得時 (起動直後・オフラインフォールバック) はこの既定値 (7日) を使う。
 */
export const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 投稿から windowMs 以内かどうか (探すページの NEW バッジ判定用)。
 * windowMs 省略時は既定7日 (NEW_LISTING_WINDOW_MS)。呼び出し側は通常
 * master/config.newListingWindowDays 由来の値 (useMasterData) を渡す。
 */
export function isNewListing(createdAt: number, nowMs: number, windowMs: number = NEW_LISTING_WINDOW_MS): boolean {
  return nowMs - createdAt < windowMs;
}

/**
 * 管理者が任意の物件に手動でNEWリボンを固定表示させる機能 (2026-08-24)。
 * publishUntil (公開終了日時) と同じ「未来なら有効・遅延評価」の設計。cron 等での自動解除は
 * 不要で、期限を過ぎたら次に読まれたタイミングで自動的に通常判定 (isNewListing) へフォールバックする。
 */
export function isPinnedNew(pinnedNewUntil: number | null | undefined, nowMs: number): boolean {
  return typeof pinnedNewUntil === 'number' && nowMs < pinnedNewUntil;
}

/**
 * OGPカードの代表作として選択可能か(spec 2026-07-31 §確定済みの決定「選べる物件の条件」)。
 * visibility が明示的に 'public' であることを要求する(unlisted=住所非公開・private・未設定は不可)。
 * isEffectivelyPublic と異なり visibility 未設定を許容しない(選択は本人の能動的操作のため、
 * バックフィル前の保険的デフォルトに頼らず厳密に判定する)。
 */
export function isEligibleForOgRepresentative(
  listing: { visibility?: 'public' | 'unlisted' | 'private'; publishUntil?: number | null },
  nowMs: number,
): boolean {
  if (listing.visibility !== 'public') return false;
  if (listing.publishUntil != null && listing.publishUntil <= nowMs) return false;
  return true;
}
