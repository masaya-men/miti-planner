import type { MockListing } from '../../data/housing/mockListings';

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
 * canDisplayAddress の共有ツアー拡張版 (revealAddress で OR ゲート)。
 * revealAddress=true (参加者ページ) は無条件に住所表示を許可する。共有ツアーの snapshot は
 * buildTourSnapshots(toTourSnapshot) が幹事の実住所を無条件で写すため (§共有ツアー同期設計)、
 * revealAddress=true の時点で area/ward は実質必ず揃っている。
 * revealAddress=false (既定・ホスト) では canDisplayAddress と完全に同じ判定・同じ型 narrowing。
 * `(revealAddress || canDisplayAddress(listing))` を呼び出し側にインライン展開すると
 * TypeScript は `||` の真分岐で type predicate を narrowing できず (area が `T['area'] | undefined`
 * のまま) ビルドが落ちるため、明示的な type guard として定義して narrowing を型に保証させる。
 */
export function canDisplayAddressWithReveal<
  T extends { visibility?: 'public' | 'unlisted' | 'private'; area?: unknown; ward?: number },
>(listing: T, revealAddress: boolean): listing is T & { area: NonNullable<T['area']>; ward: number } {
  return revealAddress || canDisplayAddress(listing);
}

/** canDisplayFullAddress の共有ツアー拡張版 (revealAddress で OR ゲート)。理由は canDisplayAddressWithReveal と同じ。 */
export function canDisplayFullAddressWithReveal<
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
  revealAddress: boolean,
): listing is T & {
  area: NonNullable<T['area']>;
  ward: number;
  dc: string;
  server: string;
  region: NonNullable<T['region']>;
} {
  return revealAddress || canDisplayFullAddress(listing);
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
